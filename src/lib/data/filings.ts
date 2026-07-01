import type { ResolvedSecurity } from "@/lib/markets/security";
import type { FilingEvidence, FinancialData } from "./types";

interface OfficialFundamentalEvidence {
  financial: FinancialData | null;
  filings: FilingEvidence[];
}

interface SecTickerEntry {
  cik_str?: number;
  ticker?: string;
  title?: string;
}

interface SecFactValue {
  start?: string;
  end?: string;
  val?: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
}

interface SecCompanyFacts {
  entityName?: string;
  facts?: Record<string, Record<string, { units?: Record<string, SecFactValue[]> }>>;
}

interface HkexSearchRow {
  TITLE?: string;
  LONG_TEXT?: string;
  DATE_TIME?: string;
  FILE_LINK?: string;
  FILE_TYPE?: string;
}

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_COMPANY_FACTS_BASE = "https://data.sec.gov/api/xbrl/companyfacts";
const SEC_ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data";
const HKEX_BASE = "https://www1.hkexnews.hk";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let secTickerCache: { expiresAt: number; byTicker: Map<string, SecTickerEntry> } | null = null;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function safePercent(numerator: number | null, denominator: number | null): number {
  if (numerator === null || denominator === null || denominator === 0) return 0;
  return round((numerator / denominator) * 100);
}

function growth(current: number | null, previous: number | null): number {
  if (current === null || previous === null || previous === 0) return 0;
  return round((current / previous - 1) * 100);
}

function secHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "User-Agent": process.env.SEC_USER_AGENT || "YuanQiAlpha/1.0 research-contact@example.invalid",
  };
}

async function fetchJson<T>(url: string, label: string, headers: HeadersInit, maxBytes = 12_000_000): Promise<T> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(12_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`${label}请求失败 (${response.status})`);
  const text = await response.text();
  if (text.length > maxBytes) throw new Error(`${label}响应过大`);
  return JSON.parse(text) as T;
}

async function getSecTickerMap(): Promise<Map<string, SecTickerEntry>> {
  if (secTickerCache && secTickerCache.expiresAt > Date.now()) return secTickerCache.byTicker;
  const payload = await fetchJson<Record<string, SecTickerEntry>>(SEC_TICKERS_URL, "SEC证券目录", secHeaders(), 5_000_000);
  const byTicker = new Map<string, SecTickerEntry>();
  for (const entry of Object.values(payload)) {
    if (entry.ticker && entry.cik_str) byTicker.set(entry.ticker.toUpperCase(), entry);
  }
  secTickerCache = { expiresAt: Date.now() + CACHE_TTL_MS, byTicker };
  return byTicker;
}

function isAnnualForm(value: SecFactValue): boolean {
  return ["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"].includes(value.form || "");
}

function isAnnualDuration(value: SecFactValue): boolean {
  if (!value.start || !value.end) return false;
  const days = (Date.parse(value.end) - Date.parse(value.start)) / 86_400_000;
  return Number.isFinite(days) && days >= 250 && days <= 430;
}

function factUnits(payload: SecCompanyFacts, taxonomy: string, tag: string, unit: string): SecFactValue[] {
  return payload.facts?.[taxonomy]?.[tag]?.units?.[unit] || [];
}

function annualSeries(payload: SecCompanyFacts, tags: string[], unit: string): SecFactValue[] {
  for (const tag of tags) {
    const values = factUnits(payload, "us-gaap", tag, unit)
      .filter((value) => isAnnualForm(value) && isAnnualDuration(value) && Number.isFinite(value.val))
      .sort((a, b) => String(b.filed || "").localeCompare(String(a.filed || "")));
    const byEnd = new Map<string, SecFactValue>();
    for (const value of values) {
      if (value.end && !byEnd.has(value.end)) byEnd.set(value.end, value);
    }
    const series = [...byEnd.values()].sort((a, b) => String(b.end).localeCompare(String(a.end)));
    if (series.length > 0) return series;
  }
  return [];
}

function instantForEnd(payload: SecCompanyFacts, tags: string[], unit: string, reportDate: string): SecFactValue | null {
  for (const tag of tags) {
    const match = factUnits(payload, "us-gaap", tag, unit)
      .filter((value) => isAnnualForm(value) && value.end === reportDate && Number.isFinite(value.val))
      .sort((a, b) => String(b.filed || "").localeCompare(String(a.filed || "")))[0];
    if (match) return match;
  }
  return null;
}

function valueAtEnd(series: SecFactValue[], reportDate: string): number | null {
  const value = series.find((item) => item.end === reportDate)?.val;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function filingUrl(cik: number, accession: string): string {
  return `${SEC_ARCHIVES_BASE}/${cik}/${accession.replaceAll("-", "")}/${accession}-index.html`;
}

export function parseSecFinancialData(payload: SecCompanyFacts, cik: number): OfficialFundamentalEvidence {
  const revenueSeries = annualSeries(payload, ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"], "USD");
  const netIncomeSeries = annualSeries(payload, ["NetIncomeLoss", "ProfitLoss"], "USD");
  const grossProfitSeries = annualSeries(payload, ["GrossProfit"], "USD");
  const cashFlowSeries = annualSeries(payload, ["NetCashProvidedByUsedInOperatingActivities"], "USD");
  const epsSeries = annualSeries(payload, ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"], "USD/shares");
  const latest = revenueSeries[0] || netIncomeSeries[0];
  if (!latest?.end || !latest.accn) return { financial: null, filings: [] };

  const reportDate = latest.end;
  const previousDate = revenueSeries.find((item) => item.end !== reportDate)?.end || "";
  const revenue = valueAtEnd(revenueSeries, reportDate);
  const previousRevenue = previousDate ? valueAtEnd(revenueSeries, previousDate) : null;
  const netIncome = valueAtEnd(netIncomeSeries, reportDate);
  const previousNetIncome = previousDate ? valueAtEnd(netIncomeSeries, previousDate) : null;
  const grossProfit = valueAtEnd(grossProfitSeries, reportDate);
  const operatingCashFlow = valueAtEnd(cashFlowSeries, reportDate);
  const eps = valueAtEnd(epsSeries, reportDate);
  const assets = instantForEnd(payload, ["Assets"], "USD", reportDate)?.val ?? null;
  const liabilities = instantForEnd(payload, ["Liabilities"], "USD", reportDate)?.val ?? null;
  const equity = instantForEnd(payload, ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], "USD", reportDate)?.val ?? null;
  const previousEquity = previousDate
    ? instantForEnd(payload, ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], "USD", previousDate)?.val ?? null
    : null;
  const shares = instantForEnd(payload, ["CommonStockSharesOutstanding"], "shares", reportDate)?.val ?? null;

  const requiredCount = [revenue, netIncome, assets, equity].filter((value) => value !== null).length;
  const sourceUrl = filingUrl(cik, latest.accn);
  const filing: FilingEvidence = {
    source: "SEC",
    title: `${payload.entityName || "发行人"} ${latest.form || "年度报告"}`,
    filedDate: latest.filed || reportDate,
    reportDate,
    filingType: latest.form,
    url: sourceUrl,
    authoritative: true,
  };
  if (requiredCount < 3 || revenue === null || netIncome === null) return { financial: null, filings: [filing] };

  const averageEquity = equity !== null && previousEquity !== null ? (equity + previousEquity) / 2 : equity;
  const toHundredMillion = (value: number | null): number => value === null ? 0 : round(value / 100_000_000);
  const financial: FinancialData = {
    roe: safePercent(netIncome, averageEquity),
    netProfitMargin: safePercent(netIncome, revenue),
    grossMargin: safePercent(grossProfit, revenue),
    revenueGrowth: growth(revenue, previousRevenue),
    profitGrowth: growth(netIncome, previousNetIncome),
    debtRatio: safePercent(liabilities, assets),
    eps: eps === null ? 0 : round(eps, 4),
    bvps: equity !== null && shares ? round(equity / shares, 4) : 0,
    revenue: toHundredMillion(revenue),
    netProfit: toHundredMillion(netIncome),
    reportDate,
    currency: "USD",
    source: "SEC Company Facts (XBRL)",
    sourceUrl,
    filingType: latest.form,
    operatingCashFlow: toHundredMillion(operatingCashFlow),
    assets: toHundredMillion(assets),
    liabilities: toHundredMillion(liabilities),
    equity: toHundredMillion(equity),
  };
  return { financial, filings: [filing] };
}

export async function fetchSecFundamentals(ticker: string): Promise<OfficialFundamentalEvidence> {
  try {
    const tickerEntry = (await getSecTickerMap()).get(ticker.toUpperCase());
    if (!tickerEntry?.cik_str) return { financial: null, filings: [] };
    const cik = String(tickerEntry.cik_str).padStart(10, "0");
    const payload = await fetchJson<SecCompanyFacts>(`${SEC_COMPANY_FACTS_BASE}/CIK${cik}.json`, "SEC Company Facts", secHeaders());
    return parseSecFinancialData(payload, tickerEntry.cik_str);
  } catch {
    return { financial: null, filings: [] };
  }
}

function parseJsonpObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("港交所响应格式异常");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function formatDateForHkex(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function parseHkexDate(value: string): string {
  const [date] = value.split(" ");
  const [day, month, year] = date.split("/");
  return year && month && day ? `${year}-${month}-${day}` : value;
}

export async function fetchHkexFilings(code: string): Promise<OfficialFundamentalEvidence> {
  try {
    const prefixUrl = new URL(`${HKEX_BASE}/search/prefix.do`);
    prefixUrl.searchParams.set("callback", "yuanqi");
    prefixUrl.searchParams.set("lang", "EN");
    prefixUrl.searchParams.set("type", "A");
    prefixUrl.searchParams.set("name", code.padStart(5, "0"));
    prefixUrl.searchParams.set("market", "SEHK");
    const prefixResponse = await fetch(prefixUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!prefixResponse.ok) throw new Error(`港交所证券搜索失败 (${prefixResponse.status})`);
    const prefixText = await prefixResponse.text();
    if (prefixText.length > 500_000) throw new Error("港交所证券搜索响应过大");
    const prefix = parseJsonpObject(prefixText) as { stockInfo?: Array<{ stockId?: number; code?: string }> };
    const stockId = prefix.stockInfo?.find((item) => item.code === code.padStart(5, "0"))?.stockId;
    if (!stockId) return { financial: null, filings: [] };

    const end = new Date();
    const begin = new Date(end);
    begin.setUTCMonth(begin.getUTCMonth() - 20);
    const searchUrl = new URL(`${HKEX_BASE}/search/titleSearchServlet.do`);
    const params: Record<string, string> = {
      sortDir: "0", sortByOptions: "DateTime", category: "0", market: "SEHK",
      stockId: String(stockId), documentType: "-1", fromDate: formatDateForHkex(begin),
      toDate: formatDateForHkex(end), title: "results", searchType: "1", t1code: "",
      t2Gcode: "", t2code: "", rowRange: "20", lang: "E",
    };
    for (const [key, value] of Object.entries(params)) searchUrl.searchParams.set(key, value);
    const payload = await fetchJson<{ result?: string }>(searchUrl.toString(), "港交所公告搜索", { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, 2_000_000);
    const rows = payload.result ? JSON.parse(payload.result) as HkexSearchRow[] : [];
    const filings = rows
      .filter((row) => /(?:Quarterly|Interim|Final) Results/i.test(`${row.LONG_TEXT || ""} ${row.TITLE || ""}`) && Boolean(row.FILE_LINK))
      .slice(0, 8)
      .map((row): FilingEvidence => ({
        source: "HKEX",
        title: row.TITLE || row.LONG_TEXT || "上市公司财务公告",
        filedDate: parseHkexDate(row.DATE_TIME || ""),
        filingType: row.LONG_TEXT || row.FILE_TYPE || "Results",
        url: `${HKEX_BASE}${row.FILE_LINK}`,
        authoritative: true,
      }));
    return { financial: null, filings };
  } catch {
    return { financial: null, filings: [] };
  }
}

export async function fetchOfficialFundamentalEvidence(security: ResolvedSecurity): Promise<OfficialFundamentalEvidence> {
  if (security.market === "US") return fetchSecFundamentals(security.code);
  if (security.market === "HK") return fetchHkexFilings(security.code);
  return { financial: null, filings: [] };
}
