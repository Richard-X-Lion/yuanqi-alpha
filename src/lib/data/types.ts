import type { MCPDataEvidence } from "@/lib/mcp/types";

export interface MarketData {
  code: string;
  name: string;
  price: number;
  changePct: number;
  pe: number;
  pb: number;
  totalMv: number;
  circMv: number;
  turnoverRate: number;
  amount: number;
  high52w: number;
  low52w: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  currency?: "CNY" | "HKD" | "USD";
  exchange?: string;
}

export interface GlobalMarketMetrics {
  observations: number;
  return20d: number | null;
  return60d: number | null;
  return250d: number | null;
  annualizedVolatility: number | null;
  maxDrawdown: number | null;
  sma20: number | null;
  sma60: number | null;
  rsi14: number | null;
  volumeRatio5To20: number | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface FinancialData {
  roe: number;             // ROE(%)
  netProfitMargin: number; // 净利润率/销售净利率(%)
  grossMargin: number;     // 毛利率(%)
  revenueGrowth: number;   // 营收增长率(%)
  profitGrowth: number;    // 净利润增长率(%)
  debtRatio: number;       // 资产负债率(%)
  eps: number;             // 每股收益(元)
  bvps: number;            // 每股净资产(元)
  revenue: number;         // 营业总收入(亿元)
  netProfit: number;       // 归母净利润(亿元)
  reportDate: string;      // 报告期
  currency?: "CNY" | "HKD" | "USD";
  source?: string;
  sourceUrl?: string;
  filingType?: string;
  operatingCashFlow?: number; // 亿币种单位
  assets?: number;            // 亿币种单位
  liabilities?: number;       // 亿币种单位
  equity?: number;            // 亿币种单位
}

export interface FilingEvidence {
  source: "SEC" | "HKEX";
  title: string;
  filedDate: string;
  reportDate?: string;
  filingType?: string;
  url: string;
  authoritative: true;
}

export interface FundFlowData {
  mainNetInflow: number;
  hugeNetInflow: number;
  bigNetInflow: number;
  midNetInflow: number;
  smallNetInflow: number;
  recentDays: Array<{
    date: string;
    mainNet: number;
    hugeNet: number;
  }>;
}

export interface NewsItem {
  title: string;
  date: string;
  summary: string;
  source?: string;
}

export interface MCPDataContext {
  entries: MCPDataEvidence[];
  /** @deprecated MCP-only analysis uses attributed entries. */
  marketData?: string;
  /** @deprecated MCP-only analysis uses attributed entries. */
  financialData?: string;
  /** @deprecated MCP-only analysis uses attributed entries. */
  fundFlowData?: string;
  /** @deprecated MCP-only analysis uses attributed entries. */
  newsData?: string;
  /** @deprecated MCP-only analysis uses attributed entries. */
  researchReport?: string;
  /** @deprecated MCP-only analysis uses attributed entries. */
  announcement?: string;
}

export interface StockDataResult {
  market: MarketData | null;
  financial: FinancialData | null;
  fundFlow: FundFlowData | null;
  news: NewsItem[];
  webNews: NewsItem[];
  filings?: FilingEvidence[];
  globalMetrics?: GlobalMarketMetrics;
  dataStatus: {
    market: boolean;
    financial: boolean;
    news: boolean;
    fundFlow: boolean;
    webNews: boolean;
  };
  mcpData?: MCPDataContext;
}
