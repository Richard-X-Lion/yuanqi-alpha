import { UserDataConfig } from "@/lib/agents/config";
import { MarketData, FinancialData, FundFlowData, StockDataResult } from "./types";
import { safeExternalFetch } from "@/lib/security/safe-fetch";

export function getMarketCode(stockCode: string): string {
  // 沪市6开头=1, 深市0/3开头=0
  return stockCode.startsWith("6") ? `1.${stockCode}` : `0.${stockCode}`;
}

// Build headers with optional user-provided API key
// Falls back to MX_APIKEY env var for Eastmoney official API access
export function buildDataHeaders(userConfig?: UserDataConfig, extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ...extraHeaders,
  };
  // Use user-provided API key first, then fall back to MX_APIKEY env var
  const apiKey = userConfig?.apiKey || process.env.MX_APIKEY;
  if (apiKey) {
    headers["apikey"] = apiKey;
  }
  return headers;
}

// Resolve base URL with user config override
export function resolveDataUrl(defaultUrl: string, userConfig?: UserDataConfig): string {
  if (userConfig?.baseUrl) {
    // If user provided baseUrl, append the path from default URL
    try {
      const defaultParsed = new URL(defaultUrl);
      const userBase = userConfig.baseUrl.replace(/\/$/, "");
      return `${userBase}${defaultParsed.pathname}${defaultParsed.search}`;
    } catch {
      return userConfig.baseUrl;
    }
  }
  return defaultUrl;
}

export function fetchDataSource(
  url: string,
  init: Omit<RequestInit, "body">,
  userConfig?: UserDataConfig,
  label = "自定义数据源",
): Promise<Response> {
  return userConfig?.baseUrl ? safeExternalFetch(url, init, label) : fetch(url, init);
}

export async function fetchMarketData(stockCode: string, userDataConfig?: UserDataConfig): Promise<MarketData | null> {
  const secid = getMarketCode(stockCode);
  const fields = "f43,f44,f45,f46,f47,f48,f50,f51,f52,f55,f57,f58,f60,f116,f117,f162,f167,f168,f169,f170,f171,f292";

  // Method A: push2 API (with user config override)
  const defaultUrlA = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}`;
  const urlA = resolveDataUrl(defaultUrlA, userDataConfig);
  try {
    console.log(`[MarketData] Trying: ${urlA}`);
    const resp = await fetchDataSource(urlA, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: buildDataHeaders(userDataConfig, { Referer: "https://quote.eastmoney.com/" }),
    }, userDataConfig, "自定义行情数据源");
    console.log(`[MarketData] push2 status: ${resp.status}`);
    if (resp.ok) {
      const json = await resp.json();
      const d = json?.data;
      if (d) {
        return {
          code: stockCode,
          name: d.f58 || stockCode,
          price: (d.f43 || 0) / 100,
          changePct: (d.f170 || 0) / 100,
          pe: (d.f162 || 0) / 100,
          pb: (d.f167 || 0) / 100,
          totalMv: Math.round((d.f116 || 0) / 100000000),
          circMv: Math.round((d.f117 || 0) / 100000000),
          turnoverRate: (d.f168 || 0) / 100,
          amount: Math.round((d.f47 || 0) / 100000000),
          high52w: (d.f51 || 0) / 100,
          low52w: (d.f52 || 0) / 100,
          volume: d.f47 || 0,
          open: (d.f44 || 0) / 100,
          high: (d.f45 || 0) / 100,
          low: (d.f46 || 0) / 100,
          prevClose: (d.f60 || 0) / 100,
        };
      }
    }
  } catch (e) {
    console.log(`[MarketData] push2 failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Method B: qt.gtimg.cn
  const prefix = stockCode.startsWith("6") ? "sh" : "sz";
  const urlB = `https://qt.gtimg.cn/q=${prefix}${stockCode}`;
  try {
    console.log(`[MarketData] Fallback trying: ${urlB}`);
    const resp = await fetch(urlB, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    console.log(`[MarketData] qt.gtimg.cn status: ${resp.status}`);
    if (resp.ok) {
      // qt.gtimg.cn returns GBK-encoded text, must decode properly
      const buffer = await resp.arrayBuffer();
      const text = new TextDecoder("gbk").decode(buffer);
      const varMatch = text.match(/v_[^=]+="([^"]+)"/);
      if (varMatch) {
        const parts = varMatch[1].split("~");
        if (parts.length > 48) {
          return {
            code: stockCode,
            name: parts[1] || stockCode,
            price: parseFloat(parts[3]) || 0,
            changePct: parseFloat(parts[32]) || 0,
            pe: parseFloat(parts[39]) || 0,
            pb: parseFloat(parts[46]) || 0,
            totalMv: Math.round(parseFloat(parts[44]) || 0),  // already in 亿
            circMv: Math.round(parseFloat(parts[44]) || 0),    // same for now
            turnoverRate: parseFloat(parts[38]) || 0,
            amount: Math.round(parseFloat(parts[37]) || 0),    // already in 万
            high52w: parseFloat(parts[41]) || 0,
            low52w: parseFloat(parts[42]) || 0,
            volume: parseFloat(parts[36]) || 0,
            open: parseFloat(parts[5]) || 0,
            high: parseFloat(parts[33]) || 0,
            low: parseFloat(parts[34]) || 0,
            prevClose: parseFloat(parts[4]) || 0,
          };
        }
      }
    }
  } catch (e) {
    console.log(`[MarketData] qt.gtimg.cn failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return null;
}

export async function fetchFinancialData(stockCode: string, userDataConfig?: UserDataConfig): Promise<FinancialData | null> {
  const prefix = stockCode.startsWith("6") ? "SH" : "SZ";
  const defaultUrl = `https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/ZYZBAjaxNew?type=0&code=${prefix}${stockCode}`;
  const url = resolveDataUrl(defaultUrl, userDataConfig);
  try {
    console.log(`[FinancialData] Trying: ${url}`);
    const resp = await fetchDataSource(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: buildDataHeaders(userDataConfig, { Referer: "https://emweb.securities.eastmoney.com/" }),
    }, userDataConfig, "自定义财务数据源");
    if (!resp.ok) { console.log(`[FinancialData] Status: ${resp.status}`); return null; }
    const json = await resp.json();
    const latest = json?.data?.[0];
    if (!latest) { console.log(`[FinancialData] No data in response`); return null; }

    const result: FinancialData = {
      roe: parseFloat(latest.ROEJQ || latest.XSROEJQ || "0") || 0,
      netProfitMargin: parseFloat(latest.XSJLL || latest.ZZCJLL || "0") || 0,
      grossMargin: parseFloat(latest.XSMLL || latest.MLL || "0") || 0,
      revenueGrowth: parseFloat(latest.TOTALOPERATEREVETZ || latest.YYSRZZ || "0") || 0,
      profitGrowth: parseFloat(latest.PARENTNETPROFITTZ || latest.KCFJCXSYJLRTZ || "0") || 0,
      debtRatio: parseFloat(latest.ZCFZL || "0") || 0,
      eps: parseFloat(latest.EPSJB || latest.EPSXS || latest.MGSY || "0") || 0,
      bvps: parseFloat(latest.BPS || latest.MGJZC || "0") || 0,
      revenue: Math.round((parseFloat(latest.TOTALOPERATEREVE || "0") || 0) / 100000000),
      netProfit: Math.round((parseFloat(latest.PARENTNETPROFIT || "0") || 0) / 100000000),
      reportDate: latest.REPORT_DATE_NAME || "",
    };
    console.log(`[FinancialData] OK: ROE=${result.roe}%, NetMargin=${result.netProfitMargin}%, GrossMargin=${result.grossMargin}%, RevGrowth=${result.revenueGrowth}%, ProfitGrowth=${result.profitGrowth}%, EPS=${result.eps}, Report=${result.reportDate}`);
    return result;
  } catch (e) {
    console.log(`[FinancialData] Failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export async function fetchFundFlowData(stockCode: string, userDataConfig?: UserDataConfig): Promise<FundFlowData | null> {
  const secid = getMarketCode(stockCode);

  // Method A: fflow/kline/get
  const defaultUrlA = `https://push2.eastmoney.com/api/qt/stock/fflow/kline/get?secid=${secid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&lmt=10&klt=101`;
  const urlA = resolveDataUrl(defaultUrlA, userDataConfig);
  try {
    console.log(`[FundFlow] Trying: ${urlA}`);
    const resp = await fetchDataSource(urlA, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: buildDataHeaders(userDataConfig, { Referer: "https://quote.eastmoney.com/" }),
    }, userDataConfig, "自定义资金流数据源");
    console.log(`[FundFlow] kline status: ${resp.status}`);
    if (resp.ok) {
      const json = await resp.json();
      const klines: string[] = json?.data?.klines || [];
      if (klines.length > 0) {
        const latest = klines[klines.length - 1].split(",");
        // Eastmoney returns fund flow in yuan, convert to wan (万) for display
        const toWan = (v: string) => Math.round((parseFloat(v) || 0) / 10000);
        const recentDays = klines.slice(-5).map((k) => {
          const parts = k.split(",");
          return { date: parts[0], mainNet: toWan(parts[1]), hugeNet: toWan(parts[2]) };
        });
        return {
          mainNetInflow: toWan(latest[1]),
          hugeNetInflow: toWan(latest[2]),
          bigNetInflow: toWan(latest[3]),
          midNetInflow: toWan(latest[4]),
          smallNetInflow: toWan(latest[5]),
          recentDays,
        };
      }
    }
  } catch (e) {
    console.log(`[FundFlow] kline failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Method B: fflow/daykline/get
  const defaultUrlB = `https://push2.eastmoney.com/api/qt/stock/fflow/daykline/get?secid=${secid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65`;
  const urlB = resolveDataUrl(defaultUrlB, userDataConfig);
  try {
    console.log(`[FundFlow] Fallback trying: ${urlB}`);
    const resp = await fetchDataSource(urlB, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: buildDataHeaders(userDataConfig, { Referer: "https://quote.eastmoney.com/" }),
    }, userDataConfig, "自定义资金流数据源");
    console.log(`[FundFlow] daykline status: ${resp.status}`);
    if (resp.ok) {
      const json = await resp.json();
      const klines: string[] = json?.data?.klines || [];
      if (klines.length > 0) {
        const latest = klines[klines.length - 1].split(",");
        const toWan = (v: string) => Math.round((parseFloat(v) || 0) / 10000);
        const recentDays = klines.slice(-5).map((k) => {
          const parts = k.split(",");
          return { date: parts[0], mainNet: toWan(parts[1]), hugeNet: toWan(parts[2]) };
        });
        return {
          mainNetInflow: toWan(latest[1]),
          hugeNetInflow: toWan(latest[2]),
          bigNetInflow: toWan(latest[3]),
          midNetInflow: toWan(latest[4]),
          smallNetInflow: toWan(latest[5]),
          recentDays,
        };
      }
    }
  } catch (e) {
    console.log(`[FundFlow] daykline failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Method C: qt.gtimg.cn fallback (derive from full quote data)
  try {
    const prefix = stockCode.startsWith("6") ? "sh" : "sz";
    const urlC = `https://qt.gtimg.cn/q=${prefix}${stockCode}`;
    console.log(`[FundFlow] Fallback C trying: ${urlC}`);
    const resp = await fetch(urlC, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    console.log(`[FundFlow] qt.gtimg.cn status: ${resp.status}`);
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      const text = new TextDecoder("gbk").decode(buffer);
      const varMatch = text.match(/v_[^=]+="([^"]+)"/);
      if (varMatch) {
        const parts = varMatch[1].split("~");
        if (parts.length > 8) {
          // parts[6]=volume, parts[7]=outer_vol(买盘), parts[8]=inner_vol(卖盘)
          const outerVol = parseInt(parts[7]) || 0;  // 主买(外盘)
          const innerVol = parseInt(parts[8]) || 0;   // 主卖(内盘)
          const mainNet = outerVol - innerVol;
          // Estimate: outer = huge+big, inner as counterpart
          const hugeNet = Math.round(mainNet * 0.4);
          const bigNet = Math.round(mainNet * 0.3);
          const midNet = Math.round(mainNet * 0.2);
          const smallNet = Math.round(mainNet * 0.1);
          return {
            mainNetInflow: mainNet,
            hugeNetInflow: hugeNet,
            bigNetInflow: bigNet,
            midNetInflow: midNet,
            smallNetInflow: smallNet,
            recentDays: [],
          };
        }
      }
    }
  } catch (e) {
    console.log(`[FundFlow] qt.gtimg.cn failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log(`[FundFlow] All methods failed for ${stockCode}`);
  return null;
}

export function getStockNameByCode(code: string): string {
  // Fallback map - real name is obtained from market API
  const map: Record<string, string> = {
    "600519": "贵州茅台", "000858": "五粮液", "601318": "中国平安",
    "300750": "宁德时代", "002594": "比亚迪", "600036": "招商银行",
    "000001": "平安银行", "601899": "紫金矿业", "600900": "长江电力",
    "601012": "隆基绿能", "000333": "美的集团", "600276": "恒瑞医药",
  };
  return map[code] || code;
}

export async function fetchAllStockData(stockCode: string, requestHeaders?: Headers, userDataConfig?: UserDataConfig): Promise<StockDataResult> {
  // We need to import fetchStockNews and webSearchNews here to avoid circular dependencies
  const { fetchStockNews, webSearchNews } = await import("./news");

  // Fetch market data first to get the correct stock name (with user config)
  const market = await fetchMarketData(stockCode, userDataConfig);
  const stockName = market?.name;

  // Then fetch the rest in parallel, passing the correct name for news
  const [financial, fundFlow, news, webNews] = await Promise.all([
    fetchFinancialData(stockCode, userDataConfig),
    fetchFundFlowData(stockCode, userDataConfig),
    fetchStockNews(stockCode, stockName, userDataConfig),
    stockName ? webSearchNews(stockName, stockCode, requestHeaders) : Promise.resolve([]),
  ]);

  return {
    market,
    financial,
    fundFlow,
    news,
    webNews,
    dataStatus: {
      market: market !== null,
      financial: financial !== null,
      news: news.length > 0,
      fundFlow: fundFlow !== null,
      webNews: webNews.length > 0,
    },
  };
}
