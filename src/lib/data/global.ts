import type { ResolvedSecurity } from "@/lib/markets/security";
import type { MarketType } from "@/lib/markets/types";
import { webSearchNews } from "./news";
import type { GlobalMarketMetrics, MarketData, StockDataResult } from "./types";
import { fetchOfficialFundamentalEvidence } from "./filings";

export interface PriceBar {
  date: string;
  close: number;
  volume: number;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function readJson(response: Response, label: string): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`${label}请求失败 (${response.status})`);
  const text = await response.text();
  if (text.length > 5_000_000) throw new Error(`${label}响应过大`);
  return JSON.parse(text) as Record<string, unknown>;
}

function scalePrice(value: unknown, decimals: number): number {
  const numeric = Number(value || 0);
  return numeric / (10 ** decimals);
}

export async function fetchGlobalMarketQuote(security: ResolvedSecurity): Promise<MarketData | null> {
  const fields = "f43,f44,f45,f46,f47,f48,f51,f52,f57,f58,f59,f60,f116,f117,f162,f167,f168,f170";
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${encodeURIComponent(security.quoteId)}&fields=${fields}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" },
      signal: AbortSignal.timeout(8_000),
      redirect: "error",
    });
    const payload = await readJson(response, "全球行情");
    const data = payload.data as Record<string, unknown> | null;
    if (!data) return null;
    const decimals = Math.min(4, Math.max(0, Number(data.f59 ?? 3)));
    const currency = security.market === "HK" ? "HKD" : "USD";
    return {
      code: security.code,
      name: String(data.f58 || security.name || security.code),
      price: scalePrice(data.f43, decimals),
      changePct: Number(data.f170 || 0) / 100,
      pe: Number(data.f162 || 0) / 100,
      pb: Number(data.f167 || 0) / 100,
      totalMv: round(Number(data.f116 || 0) / 100_000_000),
      circMv: round(Number(data.f117 || 0) / 100_000_000),
      turnoverRate: Number(data.f168 || 0) / 100,
      amount: round(Number(data.f48 || 0) / 100_000_000),
      high52w: scalePrice(data.f51, decimals),
      low52w: scalePrice(data.f52, decimals),
      volume: Number(data.f47 || 0),
      open: scalePrice(data.f46, decimals),
      high: scalePrice(data.f44, decimals),
      low: scalePrice(data.f45, decimals),
      prevClose: scalePrice(data.f60, decimals),
      currency,
      exchange: security.exchange,
    };
  } catch {
    return null;
  }
}

async function fetchPriceHistory(security: ResolvedSecurity): Promise<PriceBar[]> {
  const end = new Date();
  const begin = new Date(end);
  begin.setUTCDate(begin.getUTCDate() - 420);
  const format = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "");
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(security.quoteId)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56&klt=101&fqt=1&beg=${format(begin)}&end=${format(end)}&lmt=300`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    const payload = await readJson(response, "历史价格");
    const data = payload.data as { klines?: string[] } | null;
    const bars = (data?.klines || []).flatMap((line) => {
      const parts = line.split(",");
      const close = Number(parts[2]);
      const volume = Number(parts[5]);
      return parts[0] && Number.isFinite(close) && close > 0
        ? [{ date: parts[0], close, volume: Number.isFinite(volume) ? volume : 0 }]
        : [];
    });
    if (bars.length > 1) return bars;
  } catch {
    // Continue with the market-specific free fallback below.
  }

  if (security.market === "US") {
    try {
      const fromDate = begin.toISOString().slice(0, 10);
      const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(security.code)}/historical?assetclass=stocks&fromdate=${fromDate}&limit=300`;
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json, text/plain, */*", Referer: "https://www.nasdaq.com/" },
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      const payload = await readJson(response, "Nasdaq历史价格");
      const rows = ((payload.data as { tradesTable?: { rows?: Array<{ date?: string; close?: string; volume?: string }> } } | null)?.tradesTable?.rows || []);
      return rows.flatMap((row) => {
        const close = Number(String(row.close || "").replace(/[$,]/g, ""));
        const volume = Number(String(row.volume || "").replaceAll(",", ""));
        const parts = String(row.date || "").split("/");
        const date = parts.length === 3 ? `${parts[2]}-${parts[0]}-${parts[1]}` : "";
        return date && Number.isFinite(close) && close > 0 ? [{ date, close, volume: Number.isFinite(volume) ? volume : 0 }] : [];
      }).reverse();
    } catch {
      return [];
    }
  }

  try {
    const key = `hk${security.code}`;
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(`${key},day,,,320,qfq`)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    const payload = await readJson(response, "港股历史价格");
    const item = (payload.data as Record<string, { day?: unknown[][]; qfqday?: unknown[][] }> | undefined)?.[key];
    const rows = item?.day || item?.qfqday || [];
    return rows.flatMap((row) => {
      const close = Number(row[2]);
      const volume = Number(row[5]);
      return typeof row[0] === "string" && Number.isFinite(close) && close > 0
        ? [{ date: row[0], close, volume: Number.isFinite(volume) ? volume : 0 }]
        : [];
    });
  } catch {
    return [];
  }
}

function marketFromHistory(security: ResolvedSecurity, bars: PriceBar[]): MarketData | null {
  if (bars.length === 0) return null;
  const latest = bars.at(-1)!;
  const previous = bars.at(-2)?.close || latest.close;
  const period = bars.slice(-252);
  const currency = security.market === "HK" ? "HKD" : "USD";
  return {
    code: security.code,
    name: security.name,
    price: latest.close,
    changePct: previous > 0 ? round((latest.close / previous - 1) * 100) : 0,
    pe: 0,
    pb: 0,
    totalMv: 0,
    circMv: 0,
    turnoverRate: 0,
    amount: 0,
    high52w: Math.max(...period.map((bar) => bar.close)),
    low52w: Math.min(...period.map((bar) => bar.close)),
    volume: latest.volume,
    open: latest.close,
    high: latest.close,
    low: latest.close,
    prevClose: previous,
    currency,
    exchange: security.exchange,
  };
}

export async function fetchGlobalMarketSnapshot(security: ResolvedSecurity): Promise<{ market: MarketData | null; bars: PriceBar[] }> {
  const [liveMarket, bars] = await Promise.all([
    fetchGlobalMarketQuote(security),
    fetchPriceHistory(security),
  ]);
  return { market: liveMarket || marketFromHistory(security, bars), bars };
}

function periodReturn(bars: PriceBar[], days: number): number | null {
  if (bars.length <= days) return null;
  const start = bars[bars.length - 1 - days].close;
  const end = bars[bars.length - 1].close;
  return start > 0 ? round((end / start - 1) * 100) : null;
}

function simpleAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateGlobalMetrics(bars: PriceBar[]): GlobalMarketMetrics {
  const closes = bars.map((bar) => bar.close);
  const logReturns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const mean = simpleAverage(logReturns);
  const variance = mean === null || logReturns.length < 2
    ? null
    : logReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (logReturns.length - 1);

  let peak = 0;
  let maxDrawdown = 0;
  for (const close of closes) {
    peak = Math.max(peak, close);
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, close / peak - 1);
  }

  const lastChanges = closes.slice(-15).slice(1).map((close, index) => close - closes.slice(-15)[index]);
  const averageGain = simpleAverage(lastChanges.map((value) => Math.max(0, value)));
  const averageLoss = simpleAverage(lastChanges.map((value) => Math.max(0, -value)));
  const rsi14 = averageGain === null || averageLoss === null
    ? null
    : averageLoss === 0 ? 100 : 100 - (100 / (1 + averageGain / averageLoss));

  const volume5 = simpleAverage(bars.slice(-5).map((bar) => bar.volume));
  const volume20 = simpleAverage(bars.slice(-20).map((bar) => bar.volume));

  return {
    observations: bars.length,
    return20d: periodReturn(bars, 20),
    return60d: periodReturn(bars, 60),
    return250d: periodReturn(bars, 250),
    annualizedVolatility: variance === null ? null : round(Math.sqrt(variance) * Math.sqrt(252) * 100),
    maxDrawdown: bars.length ? round(maxDrawdown * 100) : null,
    sma20: closes.length >= 20 ? round(simpleAverage(closes.slice(-20)) || 0, 3) : null,
    sma60: closes.length >= 60 ? round(simpleAverage(closes.slice(-60)) || 0, 3) : null,
    rsi14: bars.length >= 15 && rsi14 !== null ? round(rsi14) : null,
    volumeRatio5To20: volume5 !== null && volume20 ? round(volume5 / volume20) : null,
    periodStart: bars[0]?.date || null,
    periodEnd: bars.at(-1)?.date || null,
  };
}

export async function fetchGlobalStockData(
  security: ResolvedSecurity,
  requestHeaders?: Headers,
): Promise<StockDataResult> {
  const [{ market, bars }, officialEvidence] = await Promise.all([
    fetchGlobalMarketSnapshot(security),
    fetchOfficialFundamentalEvidence(security),
  ]);
  const name = market?.name || security.name;
  const webNews = await webSearchNews(name, security.code, requestHeaders);
  const globalMetrics = calculateGlobalMetrics(bars);

  return {
    market,
    financial: officialEvidence.financial,
    fundFlow: null,
    news: [],
    webNews,
    filings: officialEvidence.filings,
    globalMetrics,
    dataStatus: {
      market: market !== null,
      financial: officialEvidence.financial !== null,
      news: false,
      fundFlow: false,
      webNews: webNews.length > 0,
    },
  };
}

export function marketLabel(market: MarketType): string {
  return market === "HK" ? "港股" : market === "US" ? "美股" : "A股";
}
