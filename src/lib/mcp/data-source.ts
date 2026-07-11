import { MCPClient } from "./client";
import {
  type MCPDataEvidence,
  type MCPDataKind,
  type MCPDataSourceResult,
  type MCPServerConfig,
  type MCPTool,
} from "./types";

interface QueryPlan {
  kind: MCPDataKind;
  label: string;
  preferredTools: string[];
  keywords: RegExp;
  query: (stockCode: string, stockName: string, marketLabel: string) => string;
}

const QUERY_FIELDS = ["query", "q", "input", "prompt", "question", "text"];
const CODE_FIELDS = ["stockCode", "stock_code", "symbol", "ticker", "code"];
const NAME_FIELDS = ["stockName", "stock_name", "company", "name"];
const MARKET_FIELDS = ["market", "exchange", "marketLabel"];

const QUERY_PLANS: QueryPlan[] = [
  {
    kind: "market",
    label: "行情与估值",
    preferredTools: ["FinGeneralQuery"],
    keywords: /market|quote|price|valuation|行情|股价|估值/i,
    query: (code, name, market) => `查询${market}${name}（${code}）的最新行情、成交、估值和价格区间，返回数据日期与原始来源。`,
  },
  {
    kind: "financial",
    label: "财务与基本面",
    preferredTools: ["MacroIndustryData", "FinGeneralQuery"],
    keywords: /financial|fundamental|finance|财务|基本面|行业/i,
    query: (code, name, market) => `查询${market}${name}（${code}）的最新财务报表、盈利质量、增长、现金流、资产负债和行业竞争资料，返回报告期与原始来源。`,
  },
  {
    kind: "fundFlow",
    label: "资金与交易",
    preferredTools: ["FinGeneralQuery"],
    keywords: /capital|fund|flow|holding|position|资金|持仓|成交/i,
    query: (code, name, market) => `查询${market}${name}（${code}）的最新资金流向、机构持仓、融资融券、成交量和供需资料，返回数据日期与原始来源。`,
  },
  {
    kind: "news",
    label: "新闻与舆情",
    preferredTools: ["FinGeneralQuery"],
    keywords: /news|sentiment|media|event|新闻|资讯|舆情/i,
    query: (code, name, market) => `查询${market}${name}（${code}）的最新新闻、舆情、政策、监管与事件催化，区分事件日期和报道日期并返回原始来源。`,
  },
  {
    kind: "research",
    label: "研究报告",
    preferredTools: ["FinancialResearchReport"],
    keywords: /research|report|analyst|研报|研究|评级/i,
    query: (code, name, market) => `查询${market}${name}（${code}）的最新研究报告、评级和盈利预测变化，返回发布日期与原始来源。`,
  },
  {
    kind: "announcement",
    label: "公告与披露",
    preferredTools: ["AnnouncementData"],
    keywords: /announcement|filing|disclosure|公告|披露|财报/i,
    query: (code, name, market) => `查询${market}${name}（${code}）近三个月的重大公告、财报与监管披露，返回披露日期与原始来源。`,
  },
];

function hasSupportedArguments(tool: MCPTool): boolean {
  const properties = tool.inputSchema?.properties || {};
  const supported = new Set([...QUERY_FIELDS, ...CODE_FIELDS, ...NAME_FIELDS, ...MARKET_FIELDS]);
  return (tool.inputSchema?.required || []).every((field) => supported.has(field)) &&
    Object.keys(properties).some((field) => supported.has(field));
}

function toolScore(tool: MCPTool, plan: QueryPlan): number {
  if (!hasSupportedArguments(tool)) return -1;
  const preferredIndex = plan.preferredTools.indexOf(tool.name);
  if (preferredIndex >= 0) return 100 - preferredIndex;
  const searchable = `${tool.name} ${tool.description || ""}`;
  if (plan.keywords.test(searchable)) return 50;
  if (/query|search|lookup|查询|搜索/i.test(searchable)) return 10;
  return -1;
}

function buildToolArgs(
  tool: MCPTool,
  query: string,
  stockCode: string,
  stockName: string,
  marketLabel: string,
): Record<string, unknown> {
  const properties = tool.inputSchema?.properties || {};
  const args: Record<string, unknown> = {};
  const queryField = QUERY_FIELDS.find((field) => field in properties);
  const codeField = CODE_FIELDS.find((field) => field in properties);
  const nameField = NAME_FIELDS.find((field) => field in properties);
  const marketField = MARKET_FIELDS.find((field) => field in properties);
  if (queryField) args[queryField] = query;
  if (codeField) args[codeField] = stockCode;
  if (nameField) args[nameField] = stockName;
  if (marketField) args[marketField] = marketLabel;
  return args;
}

export class MCPDataSource {
  private clients: Map<string, MCPClient> = new Map();

  async registerServer(config: MCPServerConfig): Promise<MCPClient> {
    const client = new MCPClient(config);
    await client.initialize();
    this.clients.set(config.id, client);
    console.log(`[MCP] Registered server: ${config.name} (${config.id}), tools: ${client.availableTools.map((tool) => tool.name).join(", ")}`);
    return client;
  }

  getAllClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  private findTool(plan: QueryPlan): { serverId: string; client: MCPClient; tool: MCPTool } | null {
    let best: { serverId: string; client: MCPClient; tool: MCPTool; score: number } | null = null;
    for (const [serverId, client] of this.clients) {
      for (const tool of client.availableTools) {
        const score = toolScore(tool, plan);
        if (score >= 0 && (!best || score > best.score)) best = { serverId, client, tool, score };
      }
    }
    return best ? { serverId: best.serverId, client: best.client, tool: best.tool } : null;
  }

  private async fetchEvidence(
    plan: QueryPlan,
    stockCode: string,
    stockName: string,
    marketLabel: string,
  ): Promise<MCPDataEvidence | null> {
    const selected = this.findTool(plan);
    if (!selected) return null;
    try {
      const query = plan.query(stockCode, stockName, marketLabel);
      const result = await selected.client.callTool(
        selected.tool.name,
        buildToolArgs(selected.tool, query, stockCode, stockName, marketLabel),
      );
      if (result.isError) throw new Error(`Tool ${selected.tool.name} returned error`);
      const content = result.content.map((item) => item.text || "").join("\n").trim().slice(0, 20_000);
      if (!content) return null;
      return {
        kind: plan.kind,
        label: plan.label,
        content,
        source: {
          serverId: selected.serverId,
          serverName: selected.client.name,
          toolName: selected.tool.name,
        },
      };
    } catch (error) {
      console.log(`[MCP] ${plan.label} failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async fetchStockData(
    stockCode: string,
    stockName = stockCode,
    marketLabel = "A股",
  ): Promise<MCPDataSourceResult> {
    const entries = await Promise.all(
      QUERY_PLANS.map((plan) => this.fetchEvidence(plan, stockCode, stockName, marketLabel)),
    );
    return { entries: entries.filter((entry): entry is MCPDataEvidence => entry !== null) };
  }
}
