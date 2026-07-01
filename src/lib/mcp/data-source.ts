import { MCPClient } from "./client";
import { MCPServerConfig, MCPDataSourceResult } from "./types";

export class MCPDataSource {
  private clients: Map<string, MCPClient> = new Map();

  async registerServer(config: MCPServerConfig): Promise<MCPClient> {
    const client = new MCPClient(config);
    await client.initialize();
    this.clients.set(config.id, client);
    console.log(`[MCP] Registered server: ${config.name} (${config.id}), tools: ${client.availableTools.map(t => t.name).join(", ")}`);
    return client;
  }

  unregisterServer(id: string): void {
    this.clients.delete(id);
  }

  getClient(id: string): MCPClient | undefined {
    return this.clients.get(id);
  }

  getAllClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  hasTool(toolName: string): boolean {
    for (const client of this.clients.values()) {
      if (client.hasTool(toolName)) return true;
    }
    return false;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    for (const client of this.clients.values()) {
      if (client.hasTool(toolName)) {
        const result = await client.callTool(toolName, args);
        if (result.isError) {
          throw new Error(`Tool ${toolName} returned error`);
        }
        return result.content.map(c => c.text || "").join("\n").slice(0, 20_000);
      }
    }
    throw new Error(`Tool ${toolName} not found in any registered MCP server`);
  }

  async fetchStockData(stockCode: string, stockName?: string, marketLabel = "A股"): Promise<Partial<MCPDataSourceResult>> {
    const result: Partial<MCPDataSourceResult> = {};

    // Try FinGeneralQuery for structured financial data
    if (this.hasTool("FinGeneralQuery")) {
      try {
        const query = stockName
          ? `查询${marketLabel}${stockName}(${stockCode})的最新财务数据、估值与股价行情${marketLabel === "A股" ? "、资金流向" : ""}`
          : `查询${marketLabel}股票代码${stockCode}的最新财务数据、估值与股价行情`;
        result.marketData = await this.callTool("FinGeneralQuery", { query });
      } catch (e) {
        console.log(`[MCP] FinGeneralQuery failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Try MacroIndustryData for industry context
    if (this.hasTool("MacroIndustryData")) {
      try {
        const query = stockName
          ? `查询${marketLabel}${stockName}所在行业的最新景气度和竞争格局`
          : `查询${marketLabel}股票${stockCode}所在行业的最新数据`;
        result.financialData = await this.callTool("MacroIndustryData", { query });
      } catch (e) {
        console.log(`[MCP] MacroIndustryData failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Try FinancialResearchReport for research reports
    if (this.hasTool("FinancialResearchReport")) {
      try {
        const query = stockName
          ? `查询${marketLabel}${stockName}(${stockCode})的最新研究报告观点`
          : `查询${marketLabel}股票${stockCode}的最新研究报告`;
        result.researchReport = await this.callTool("FinancialResearchReport", { query });
      } catch (e) {
        console.log(`[MCP] FinancialResearchReport failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Try AnnouncementData for recent announcements
    if (this.hasTool("AnnouncementData")) {
      try {
        const query = stockName
          ? `查询${stockName}(${stockCode})近三个月的重大公告`
          : `查询股票${stockCode}近三个月的重大公告`;
        result.announcement = await this.callTool("AnnouncementData", { query });
      } catch (e) {
        console.log(`[MCP] AnnouncementData failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return result;
  }

  async fetchNewsData(stockCode: string, stockName?: string): Promise<string> {
    if (this.hasTool("FinGeneralQuery")) {
      try {
        const query = stockName
          ? `查询${stockName}(${stockCode})的最新新闻和舆情动态`
          : `查询股票${stockCode}的最新新闻和舆情动态`;
        return await this.callTool("FinGeneralQuery", { query });
      } catch (e) {
        console.log(`[MCP] FinGeneralQuery news failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return "";
  }
}

export const mcpDataSource = new MCPDataSource();
