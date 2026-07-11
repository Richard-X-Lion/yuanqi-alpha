import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketAgentPrompt, type StockDataResult } from "./prompts";

const data: StockDataResult = {
  market: null,
  financial: null,
  fundFlow: null,
  news: [],
  webNews: [],
  dataStatus: { market: true, financial: true, news: false, fundFlow: false, webNews: false },
  mcpData: {
    entries: [{
      kind: "financial",
      label: "财务与基本面",
      content: "报告期营收同比增长 12%",
      source: { serverId: "user-mcp", serverName: "用户研究数据", toolName: "company_financials" },
    }],
  },
};

test("MCP-only prompts preserve per-item source attribution", () => {
  const prompt = buildMarketAgentPrompt("CN", "fundamental", "600519", data);
  assert.match(prompt, /用户研究数据/);
  assert.match(prompt, /company_financials/);
  assert.match(prompt, /报告期营收同比增长 12%/);
  assert.match(prompt, /平台未提供、抓取或背书/);
});

test("an agent receives only MCP categories relevant to its role", () => {
  const prompt = buildMarketAgentPrompt("CN", "sentiment", "600519", data);
  assert.doesNotMatch(prompt, /报告期营收同比增长 12%/);
  assert.match(prompt, /用户 MCP 未返回适用于本角色的数据项/);
});
