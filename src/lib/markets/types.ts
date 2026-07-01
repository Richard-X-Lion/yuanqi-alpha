export type MarketType = "CN" | "HK" | "US";

export interface MarketDefinition {
  id: MarketType;
  label: string;
  shortLabel: string;
  currency: "CNY" | "HKD" | "USD";
  framework: "china-a-share" | "alpha-agents";
  placeholder: string;
}

export const MARKET_DEFINITIONS: Record<MarketType, MarketDefinition> = {
  CN: {
    id: "CN",
    label: "A股",
    shortLabel: "A股",
    currency: "CNY",
    framework: "china-a-share",
    placeholder: "输入股票名称或代码，如 贵州茅台 / 600519",
  },
  HK: {
    id: "HK",
    label: "港股",
    shortLabel: "港股",
    currency: "HKD",
    framework: "alpha-agents",
    placeholder: "输入股票名称或代码，如 腾讯控股 / 00700",
  },
  US: {
    id: "US",
    label: "美股",
    shortLabel: "美股",
    currency: "USD",
    framework: "alpha-agents",
    placeholder: "输入公司名称或Ticker，如 Apple / AAPL",
  },
};

export const MARKET_OPTIONS = Object.values(MARKET_DEFINITIONS);

export const POPULAR_STOCKS_BY_MARKET: Record<MarketType, Array<{ code: string; name: string }>> = {
  CN: [
    { code: "600519", name: "贵州茅台" },
    { code: "000858", name: "五粮液" },
    { code: "601318", name: "中国平安" },
    { code: "300750", name: "宁德时代" },
    { code: "002594", name: "比亚迪" },
    { code: "600036", name: "招商银行" },
    { code: "000001", name: "平安银行" },
    { code: "601899", name: "紫金矿业" },
  ],
  HK: [
    { code: "00700", name: "腾讯控股" },
    { code: "09988", name: "阿里巴巴-W" },
    { code: "03690", name: "美团-W" },
    { code: "01810", name: "小米集团-W" },
    { code: "00941", name: "中国移动" },
    { code: "01211", name: "比亚迪股份" },
  ],
  US: [
    { code: "AAPL", name: "Apple" },
    { code: "MSFT", name: "Microsoft" },
    { code: "NVDA", name: "NVIDIA" },
    { code: "GOOGL", name: "Alphabet" },
    { code: "AMZN", name: "Amazon" },
    { code: "META", name: "Meta" },
  ],
};

export function parseMarket(value: unknown): MarketType | null {
  return value === "CN" || value === "HK" || value === "US" ? value : null;
}

export function normalizeSecurityInput(value: string, market: MarketType): string {
  const trimmed = value.trim();
  if (market === "CN") return /^\d{1,6}$/.test(trimmed) ? trimmed.padStart(6, "0") : trimmed;
  if (market === "HK") return /^\d{1,5}$/.test(trimmed) ? trimmed.padStart(5, "0") : trimmed;
  return trimmed.toUpperCase().replace(/\s+/g, "");
}

export function isDirectSecurityCode(value: string, market: MarketType): boolean {
  if (market === "CN") return /^\d{6}$/.test(value);
  if (market === "HK") return /^\d{5}$/.test(value);
  return /^[A-Z][A-Z0-9.-]{0,14}$/.test(value);
}

export function isValidSecurityInput(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 40 && !/[\u0000-\u001f\u007f]/.test(trimmed);
}

