import { isDirectSecurityCode, isValidSecurityInput, type MarketType, normalizeSecurityInput } from "./types";

const SEARCH_TOKEN = "D43BF722C8E33BDC906FB84D85E326E8";

interface SuggestionItem {
  Code?: string;
  Name?: string;
  JYS?: string;
  Classify?: string;
  QuoteID?: string;
  UnifiedCode?: string;
  TypeUS?: string;
}

export interface ResolvedSecurity {
  market: MarketType;
  code: string;
  name: string;
  quoteId: string;
  exchange: string;
}

function belongsToMarket(item: SuggestionItem, market: MarketType): boolean {
  if (market === "CN") return item.Classify === "AStock";
  if (market === "HK") return item.Classify === "HK";
  return item.Classify === "UsStock";
}

function fallbackSecurity(input: string, market: MarketType): ResolvedSecurity | null {
  if (!isDirectSecurityCode(input, market)) return null;
  if (market === "CN") {
    return { market, code: input, name: input, quoteId: `${input.startsWith("6") ? "1" : "0"}.${input}`, exchange: input.startsWith("6") ? "SSE" : "SZSE" };
  }
  if (market === "HK") return { market, code: input, name: input, quoteId: `116.${input}`, exchange: "HKEX" };
  return null;
}

export async function resolveSecurity(input: string, market: MarketType): Promise<ResolvedSecurity> {
  if (!isValidSecurityInput(input)) throw new Error("请输入有效的股票名称或代码");
  const normalized = normalizeSecurityInput(input, market);
  const url = new URL("https://searchapi.eastmoney.com/api/suggest/get");
  url.searchParams.set("input", normalized);
  url.searchParams.set("type", "14");
  url.searchParams.set("count", "20");
  url.searchParams.set("token", SEARCH_TOKEN);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`证券搜索失败 (${response.status})`);
    const text = await response.text();
    if (text.length > 1_000_000) throw new Error("证券搜索响应过大");
    const payload = JSON.parse(text) as { QuotationCodeTable?: { Data?: SuggestionItem[] } };
    const candidates = (payload.QuotationCodeTable?.Data || []).filter((item) => belongsToMarket(item, market));
    const exact = candidates.find((item) =>
      item.Code?.toUpperCase() === normalized.toUpperCase() ||
      item.UnifiedCode?.toUpperCase() === normalized.toUpperCase() ||
      item.Name?.toUpperCase() === normalized.toUpperCase()
    );
    const commonStockCandidates = market === "US"
      ? candidates.filter((item) => item.TypeUS === "1")
      : candidates;
    // 名称搜索采用供应商相关性排序的首个普通股结果；代码输入仍要求精确匹配。
    const isNameQuery = !isDirectSecurityCode(normalized, market) || (market === "US" && (/[a-z]/.test(input) || /\s/.test(input)));
    const selected = exact || (isNameQuery ? commonStockCandidates[0] : undefined);
    if (selected?.QuoteID && selected.Code) {
      return {
        market,
        code: market === "HK" ? selected.Code.padStart(5, "0") : selected.Code.toUpperCase(),
        name: selected.Name || selected.Code,
        quoteId: selected.QuoteID,
        exchange: selected.JYS || market,
      };
    }
  } catch (error) {
    const fallback = fallbackSecurity(normalized, market);
    if (fallback) return fallback;
    throw error;
  }

  const fallback = fallbackSecurity(normalized, market);
  if (fallback) return fallback;
  throw new Error(`未找到与“${input.trim()}”完全匹配的${market === "CN" ? "A股" : market === "HK" ? "港股" : "美股"}证券`);
}
