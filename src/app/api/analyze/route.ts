import { NextRequest } from "next/server";
import {
  UserApiConfig,
  TODAY,
  MODEL_SUGGESTIONS,
  isAgentConfigured,
  getAgentsForMarket,
} from "@/lib/agents/config";
import {
  AgentOpinion,
  ChatMessage,
} from "@/lib/agents/types";
import {
  MODERATOR_SYSTEM_PROMPT,
  buildMarketAgentPrompt,
  buildDebatePrompt,
  buildModeratorDebatePrompt,
  buildArbitrationPrompt,
} from "@/lib/agents/prompts";
import { StockDataResult } from "@/lib/data/types";
import {
  fetchAllStockData,
  getStockNameByCode,
} from "@/lib/data/stock";
import { stripCodeBlocks, streamLLM, callLLMWithRetry } from "@/lib/agents/llm";
import { parseAgentResponse } from "@/lib/agents/parser";
import { MCPDataSource, MCPServerConfig } from "@/lib/mcp";
import { assertSafePublicUrl } from "@/lib/security/public-url";
import { consumeAnalysisQuota, getClientId } from "@/lib/security/rate-limit";
import { confidenceToVoteWeight, resolveWeightedConsensus, stanceToAction, type DecidableStance } from "@/lib/agents/decision";
import { DEADLOCK_THRESHOLD, MAX_DEBATE_ROUNDS, hasDebateDeadlock, nextNoChangeStreak } from "@/lib/agents/debate-rules";
import { parseMarket, isValidSecurityInput, MARKET_DEFINITIONS } from "@/lib/markets/types";
import { resolveSecurity } from "@/lib/markets/security";
import { fetchGlobalStockData } from "@/lib/data/global";
import { assertDataSourceCompliance } from "@/lib/data/compliance";

// Vercel Hobby currently supports up to 60s for a Node.js route function.
// For full multi-agent analysis in production, consider a Pro plan or moving
// long-running orchestration to a background worker.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ============================================================
// Mock Mode
// ============================================================

const MOCK_ANALYSES: Record<string, Record<string, unknown>> = {
  fundamental: {
    stance: "BULLISH", confidence: 8, valid: true,
    reasons: ["营收增长率保持15%以上，净利润率稳居行业前三，ROE达22%", "当前PE为28倍，处于近5年35%分位，估值仍有提升空间", "品牌护城河深厚，市场份额超过30%，定价权极强"],
    evidence: ["ROE 22% > 行业均值12%", "PE 28x 近5年35%分位", "市占率>30%"],
    reservations: "宏观经济下行可能影响高端消费需求",
    analysis: `**立场：看多(BULLISH)**\n\n**核心论据：**\n1. 营收增长率保持15%以上，净利润率稳居行业前三，ROE达22%\n2. 当前PE为28倍，处于近5年35%分位，估值仍有提升空间\n3. 品牌护城河深厚，市场份额超过30%\n\n**基本面综合评分：8/10**\n\n[模拟模式 - API Key未配置]`,
  },
  sentiment: {
    stance: "BULLISH", confidence: 7, valid: true,
    reasons: ["恐慌贪婪指数72，处于贪婪区间，市场情绪偏暖", "近30天券商研报12篇，10篇买入评级", "行业政策利好频出，监管层多次表态支持消费升级"],
    evidence: ["恐慌贪婪指数72", "研报买入率83%", "3项政策利好"],
    reservations: "市场情绪过热可能引发短期回调",
    analysis: `**立场：看多(BULLISH)**\n\n**核心论据：**\n1. 恐慌贪婪指数72，处于贪婪区间，市场情绪偏暖\n2. 近30天券商研报12篇，10篇买入评级\n3. 行业政策利好频出\n\n**情绪面综合评分：7/10**\n\n[模拟模式 - API Key未配置]`,
  },
  capital: {
    stance: "NEUTRAL", confidence: 6, valid: true,
    reasons: ["近5日主力资金净流入2.3亿，但北向资金小幅净流出0.8亿", "融资余额环比增长3.2%，杠杆资金温和入场", "SHIBOR利率保持低位，市场流动性宽松"],
    evidence: ["主力净流入2.3亿", "北向净流出0.8亿", "融资余额+3.2%"],
    reservations: "北向资金流出趋势需持续关注",
    analysis: `**立场：中性(NEUTRAL)**\n\n**核心论据：**\n1. 近5日主力资金净流入2.3亿，但北向资金小幅净流出0.8亿\n2. 融资余额环比增长3.2%，杠杆资金温和入场\n3. SHIBOR利率保持低位，市场流动性宽松\n\n**资金面综合评分：6/10**\n\n[模拟模式 - API Key未配置]`,
  },
};

const GLOBAL_MOCK_ANALYSES: Record<string, Record<string, unknown>> = {
  fundamental: { stance: "BULLISH", confidence: 7, valid: true, reasons: ["核心业务保持增长", "现金流质量稳定", "行业竞争优势仍在"], evidence: ["模拟财务资料", "模拟经营数据"], reservations: "标准化财务报表仍需核验", analysis: "**立场：看多(BULLISH)**\n\n长期经营质量和竞争优势偏正面，但需进一步核验最新财报与管理层指引。\n\n[港美股模拟模式]" },
  sentiment: { stance: "NEUTRAL", confidence: 5, valid: true, reasons: ["近期资讯多空交织", "市场预期分歧较大", "缺少一致性事件催化"], evidence: ["模拟新闻资料"], reservations: "资讯覆盖有限", analysis: "**立场：中性(NEUTRAL)**\n\n近期消息面缺乏方向一致的催化，应等待更多可交叉验证的事件证据。\n\n[港美股模拟模式]" },
  capital: { stance: "BULLISH", confidence: 7, valid: true, reasons: ["20日与60日收益为正", "价格位于中期均线上方", "成交量未出现异常失真"], evidence: ["模拟价格量工具结果", "模拟波动率与回撤指标"], reservations: "技术信号不等于确定性预测", analysis: "**立场：看多(BULLISH)**\n\n价格量、动量和趋势指标整体偏多，但仍需结合波动率控制仓位。\n\n[港美股模拟模式]" },
};

function buildMockModeratorReport(action: string, confidence: number, currency: string, referencePrice: number): string {
  const move = 0.1;
  const target = action === "BUY"
    ? `${(referencePrice * (1 + move)).toFixed(2)} ${currency}`
    : action === "SELL"
      ? `${(referencePrice * (1 - move)).toFixed(2)} ${currency}`
      : `${(referencePrice * 0.95).toFixed(2)}-${(referencePrice * 1.05).toFixed(2)} ${currency}`;
  return `【投资决策】${action}\n【置信度】${confidence}%\n【目标价位】${target}（模拟情景区间）\n【风险等级】中\n【核心逻辑】\n1. 系统依据三位Agent的有效观点与加权共识生成方向\n2. 主持人仅汇总证据，不增加新的投票意见\n【关键风险】\n1. 当前为开发模拟数据，不能用于真实交易\n2. 模拟目标价不代表真实估值\n【操作建议】\n等待真实数据与模型配置完成后重新分析；当前计价币种为${currency}。\n\n[开发模拟模式]`;
}

// ============================================================
// SSE Helper
// ============================================================

function sse(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function jsonError(message: string, status: number, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function perCallSignal(requestSignal: AbortSignal, timeoutMs = 120_000): AbortSignal {
  return AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)]);
}

async function validateExternalUrls(config: UserApiConfig): Promise<void> {
  const targets = new Map<string, string>();
  for (const [agentId, llmConfig] of Object.entries(config.llm || {})) {
    if (llmConfig?.baseUrl) targets.set(llmConfig.baseUrl, `${agentId} 模型服务`);
  }
  if (config.data?.enabled && config.data.baseUrl) {
    targets.set(config.data.baseUrl, "自定义数据源");
  }
  if (config.mcp?.enabled) {
    for (const server of (config.mcp.servers || []).filter((item) => item.enabled)) {
      if (server.url) targets.set(server.url, `MCP ${server.name || server.id}`);
    }
  }
  await Promise.all([...targets].map(([url, label]) => assertSafePublicUrl(url, label)));
}

// ============================================================
// Main API Handler
// ============================================================

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 64 * 1024) return jsonError("请求内容过大", 413);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return jsonError("请求格式无效", 400);
  }

  const market = body.market === undefined ? "CN" : parseMarket(body.market);
  if (!market) return jsonError("market 必须是 CN、HK 或 US", 400);
  const stockInput = typeof body.stockCode === "string" ? body.stockCode.trim() : "";
  if (!isValidSecurityInput(stockInput)) return jsonError("请输入有效的股票名称或代码", 400);

  const quota = await consumeAnalysisQuota(getClientId(request.headers));
  if (quota.unavailable) {
    return jsonError("限流服务暂时不可用", 503, { "Retry-After": String(quota.retryAfterSeconds) });
  }
  if (!quota.allowed) {
    return jsonError("请求过于频繁，请稍后再试", 429, { "Retry-After": String(quota.retryAfterSeconds) });
  }

  let security;
  try {
    security = await resolveSecurity(stockInput, market);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "证券识别失败", 400);
  }
  const stockCode = security.code;
  const marketDefinition = MARKET_DEFINITIONS[market];
  const agents = getAgentsForMarket(market);

  const rawConfig = body.apiConfig || body.userApiConfig;
  const userApiConfig: UserApiConfig = rawConfig && typeof rawConfig === "object" ? rawConfig as UserApiConfig : {};
  const isMockMode = process.env.ENABLE_MOCK_MODE === "true" && !Object.values(userApiConfig.llm || {}).some((item) => item?.apiKey?.trim());

  if (!isMockMode) {
    try {
      assertDataSourceCompliance();
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "数据源合规状态无效", 503);
    }
  }

  const missingConfigs: string[] = [];
  for (const agent of agents) {
    if (!isAgentConfigured(agent.id, userApiConfig.llm)) missingConfigs.push(agent.name);
  }
  if (!isAgentConfigured("moderator", userApiConfig.llm)) missingConfigs.push("主持人");
  if (!isMockMode && missingConfigs.length > 0) {
    return jsonError(`以下 Agent 未配置模型名称或 API Key：${missingConfigs.join("、")}。MCP 可选，但四个大模型必须完成配置。`, 400);
  }

  try {
    if (!isMockMode) await validateExternalUrls(userApiConfig);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "外部服务地址不安全", 400);
  }

  const encoder = new TextEncoder();
  const send = (event: string, data: Record<string, unknown>) => encoder.encode(sse(event, data));

  const stream = new ReadableStream({
    async start(controller) {
      let streamClosed = false;
      const safeEnqueue = (chunk: Uint8Array) => { if (!streamClosed) { try { controller.enqueue(chunk); } catch { streamClosed = true; } } };
      const safeClose = () => { streamClosed = true; try { controller.close(); } catch { /* already closed */ } };

      // Pre-resolve moderator model for use across phases
      const moderatorModel = userApiConfig.llm?.moderator?.model || MODEL_SUGGESTIONS.moderator;

      // Variables to hold stock info for decision event
      let stockName = "";
      let prevClose = 0;

      try {
        if (isMockMode) {
          safeEnqueue(send("info", { mockMode: true, message: "开发模拟模式已启用。" }));
        }

        // ==========================================
        // Phase 1: Data Fetching
        // ==========================================
        safeEnqueue(send("phase", { phase: "data_fetch", message: "获取实时数据", status: "running" }));

        let stockData: StockDataResult;
        if (isMockMode) {
          stockData = {
            market: {
              code: stockCode, name: market === "CN" ? getStockNameByCode(stockCode) : security.name, price: market === "CN" ? 1850.5 : 200.5,
              changePct: 1.23, pe: 28.5, pb: 6.5, totalMv: 23200, circMv: 23200,
              turnoverRate: 0.45, amount: 85.6, high52w: 1920, low52w: 1480,
              volume: 4620000, open: market === "CN" ? 1835.0 : 198.0, high: market === "CN" ? 1860.0 : 202.0, low: market === "CN" ? 1830.0 : 197.0, prevClose: market === "CN" ? 1828.0 : 199.0,
              currency: marketDefinition.currency, exchange: security.exchange,
            },
            financial: market === "CN" ? { roe: 22.5, netProfitMargin: 48.3, grossMargin: 89.8, revenueGrowth: 15.2, profitGrowth: 18.6, debtRatio: 24.8, eps: 62.5, bvps: 280.3, revenue: 1505.6, netProfit: 747.3, reportDate: "2025-03-31" } : null,
            fundFlow: market === "CN" ? {
              mainNetInflow: 2300, hugeNetInflow: 1500, bigNetInflow: 800,
              midNetInflow: -500, smallNetInflow: -1800,
              recentDays: [
                { date: "2025-01-10", mainNet: 2300, hugeNet: 1500 },
                { date: "2025-01-09", mainNet: -800, hugeNet: -200 },
                { date: "2025-01-08", mainNet: 1500, hugeNet: 1000 },
                { date: "2025-01-07", mainNet: -300, hugeNet: 100 },
                { date: "2025-01-06", mainNet: 500, hugeNet: 300 },
              ],
            } : null,
            news: market === "CN" ? [
              { title: `${getStockNameByCode(stockCode)}相关板块获政策利好支持`, date: TODAY, summary: "监管层发布最新政策，支持相关行业发展", source: "模拟" },
              { title: `机构调研${getStockNameByCode(stockCode)}频次上升`, date: TODAY, summary: "近30天机构调研次数环比增长25%", source: "模拟" },
              { title: `${getStockNameByCode(stockCode)}发布业绩预告超预期`, date: TODAY, summary: "公司预计上半年净利润同比增长20%-30%", source: "模拟" },
            ] : [
              { title: `${security.name} 公布最新季度经营进展`, date: TODAY, summary: "市场正在评估收入增长、利润率与管理层指引", source: "模拟" },
              { title: `分析师更新 ${security.name} 预期`, date: TODAY, summary: "目标价与盈利预测存在分歧，需核对原始研报", source: "模拟" },
              { title: `${security.name} 近期交易活跃度变化`, date: TODAY, summary: "成交量与波动率指标出现变化，暂不代表确定方向", source: "模拟" },
            ],
            webNews: [],
            dataStatus: { market: true, financial: market === "CN", news: true, fundFlow: market === "CN", webNews: false },
            globalMetrics: market === "CN" ? undefined : { observations: 250, return20d: 4.2, return60d: 8.5, return250d: 15.3, annualizedVolatility: 24.5, maxDrawdown: -18.2, sma20: 198.3, sma60: 191.7, rsi14: 58, volumeRatio5To20: 1.12, periodStart: "2025-06-20", periodEnd: TODAY },
          };
        } else {
          // Pass user data config if provided and enabled
          const userDataConfig = userApiConfig.data?.enabled ? userApiConfig.data : undefined;
          stockData = market === "CN"
            ? await fetchAllStockData(stockCode, request.headers, userDataConfig)
            : await fetchGlobalStockData(security, request.headers);

          // Fetch MCP data if enabled
          const mcpServers = userApiConfig.mcp?.enabled
            ? (userApiConfig.mcp.servers || []).filter((s: MCPServerConfig) => s.enabled && s.url).slice(0, 5)
            : [];
          if (mcpServers.length > 0) {
            safeEnqueue(send("info", { message: `正在连接 ${mcpServers.length} 个MCP数据源...` }));
            const mcpSource = new MCPDataSource();
            try {
              for (const server of mcpServers) {
                try {
                  await mcpSource.registerServer(server);
                } catch (e) {
                  console.log(`[MCP] Failed to register ${server.name}: ${e instanceof Error ? e.message : String(e)}`);
                }
              }
              const stockName = stockData.market?.name;
              const mcpResult = await mcpSource.fetchStockData(stockCode, stockName, marketDefinition.label);
              if (Object.keys(mcpResult).length > 0) {
                stockData.mcpData = mcpResult;
                safeEnqueue(send("info", { message: `MCP数据源已接入，获取到 ${Object.keys(mcpResult).length} 类数据` }));
              }
            } catch (e) {
              console.log(`[MCP] Data fetch failed: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }

        stockName = stockData.market?.name || security.name;
        // Use prevClose (yesterday's close price) as the baseline price
        prevClose = stockData.market?.prevClose || 0;

        // Build MCP status for frontend display
        const mcpServers = userApiConfig.mcp?.enabled
          ? (userApiConfig.mcp.servers || []).filter((s: MCPServerConfig) => s.enabled && s.url).slice(0, 5)
          : [];
        const mcpDataTypes = stockData.mcpData ? Object.keys(stockData.mcpData) : [];
        const mcpStatus = {
          enabled: mcpServers.length > 0,
          connected: mcpDataTypes.length > 0 ? mcpServers.length : 0,
          failed: mcpDataTypes.length > 0 ? 0 : mcpServers.length,
          dataTypes: mcpDataTypes,
        };

        safeEnqueue(send("data_loaded", {
          marketData: stockData.dataStatus.market,
          financialData: stockData.dataStatus.financial,
          filingEvidenceCount: stockData.filings?.length || 0,
          financialSource: stockData.financial?.source || stockData.filings?.[0]?.source,
          newsCount: stockData.news.length + (stockData.webNews?.length || 0),
          webNewsCount: stockData.webNews?.length || 0,
          fundFlowData: stockData.dataStatus.fundFlow,
          priceHistoryData: (stockData.globalMetrics?.observations || 0) > 0,
          stockName,
          stockCode,
          prevClose,
          market,
          marketLabel: marketDefinition.label,
          currency: stockData.market?.currency || marketDefinition.currency,
          exchange: stockData.market?.exchange || security.exchange,
          framework: marketDefinition.framework,
          mcpStatus,
        }));

        safeEnqueue(send("phase", { phase: "data_fetch", message: "数据获取完成", status: "done" }));

        // Send news (combine traditional + web search)
        const allNews = [...stockData.news, ...(stockData.webNews || [])];
        safeEnqueue(send("news_loaded", {
          count: allNews.length,
          news: allNews,
          sources: {
            traditional: stockData.news.length,
            webSearch: stockData.webNews?.length || 0,
          }
        }));

        // ==========================================
        // Phase 2: Independent Analysis (Parallel)
        // ==========================================
        safeEnqueue(send("phase", { phase: "analysis", message: "第一阶段：独立分析（3个Agent并行）" }));

        const opinions: Record<string, AgentOpinion> = {};
        const analysesRaw: Record<string, string> = {};

        // Run all 3 agents in parallel, send agent_complete immediately when each finishes
        const agentPromises = agents.map(async (agent) => {
          const userConfig = userApiConfig.llm?.[agent.id as keyof typeof userApiConfig.llm];
          const effectiveModel = userConfig?.model || MODEL_SUGGESTIONS[agent.id];
          safeEnqueue(send("agent_start", {
            agent: agent.id, name: agent.name, model: effectiveModel, icon: agent.icon, color: agent.color,
          }));

          const userPrompt = buildMarketAgentPrompt(market, agent.id, stockCode, stockData);

          const messages: ChatMessage[] = [
            { role: "system", content: agent.systemPrompt },
            { role: "user", content: userPrompt },
          ];

          let fullContent = "";

          if (isMockMode) {
            const mockData = (market === "CN" ? MOCK_ANALYSES : GLOBAL_MOCK_ANALYSES)[agent.id];
            const mockText = typeof mockData?.analysis === "string" ? (mockData.analysis as string) : "模拟分析结果暂无。";
            safeEnqueue(send("agent_status", { agent: agent.id, model: effectiveModel, status: "mock", error: "开发模拟模式" }));
            for (let i = 0; i < mockText.length; i += 3) {
              const chunk = mockText.slice(i, i + 3);
              fullContent += chunk;
              safeEnqueue(send("agent_chunk", { agent: agent.id, content: chunk }));
              await new Promise((r) => setTimeout(r, 20));
            }
            const opinion = mockData as unknown as AgentOpinion;
            opinions[agent.id] = opinion;
            analysesRaw[agent.id] = fullContent;
            // ✅ Send agent_complete IMMEDIATELY when this agent finishes
            safeEnqueue(send("agent_complete", {
              agent: agent.id, name: agent.name,
              model: effectiveModel, icon: agent.icon, color: agent.color,
              content: fullContent, status: "fallback",
              stance: opinion.stance, score: opinion.confidence,
              reasons: opinion.reasons, evidence: opinion.evidence,
              reservations: opinion.reservations, analysis: opinion.analysis,
              parsedResult: { stance: opinion.stance, confidence: opinion.confidence, reasons: opinion.reasons, evidence: opinion.evidence, reservations: opinion.reservations, analysis: opinion.analysis },
            }));
            return;
          } else {
            let analysisFailed = false;
            let statusError: string | undefined;
            try {
              safeEnqueue(send("agent_status", { agent: agent.id, model: effectiveModel, status: "calling" }));
              for await (const chunk of streamLLM({ model: effectiveModel, provider: agent.provider, messages, temperature: 0.7, thinking: agent.thinking, signal: perCallSignal(request.signal, 180_000), agentId: agent.id, userLLMConfig: userApiConfig.llm?.[agent.id as keyof typeof userApiConfig.llm] })) {
                if (chunk.type === "content") {
                  fullContent += chunk.content;
                  safeEnqueue(send("agent_chunk", { agent: agent.id, content: chunk.content }));
                }
              }
              safeEnqueue(send("agent_status", { agent: agent.id, model: effectiveModel, status: "success" }));
            } catch (err) {
              if (request.signal.aborted) throw err;
              const errMsg = err instanceof Error ? (err.message || err.name || "未知错误") : String(err);
              analysisFailed = true;
              statusError = errMsg;
              console.error(`[Agent] ${agent.id} analysis failed: ${errMsg}`);
              console.error(`[Agent] ${agent.id} error stack:`, err instanceof Error ? err.stack : "N/A");
              safeEnqueue(send("agent_status", { agent: agent.id, model: effectiveModel, status: "error", error: errMsg }));
              fullContent += `\n\n[分析失败: ${errMsg}]`;
              safeEnqueue(send("agent_chunk", { agent: agent.id, content: `\n\n[分析失败: ${errMsg}]` }));
            }
            const opinion: AgentOpinion = analysisFailed
              ? { stance: "UNKNOWN", confidence: 0, reasons: [], evidence: [], reservations: "", analysis: "", valid: false }
              : parseAgentResponse(fullContent);
            opinions[agent.id] = opinion;
            analysesRaw[agent.id] = fullContent;
            // ✅ Send agent_complete IMMEDIATELY when this agent finishes
            safeEnqueue(send("agent_complete", {
              agent: agent.id, name: agent.name,
              model: effectiveModel, icon: agent.icon, color: agent.color,
              content: fullContent, status: opinion.valid ? "success" : "error", statusError,
              stance: opinion.stance, score: opinion.confidence,
              reasons: opinion.reasons, evidence: opinion.evidence,
              reservations: opinion.reservations, analysis: opinion.analysis,
              parsedResult: { stance: opinion.stance, confidence: opinion.confidence, reasons: opinion.reasons, evidence: opinion.evidence, reservations: opinion.reservations, analysis: opinion.analysis },
            }));
          }
        });

        // Wait for all agents to complete before proceeding to debate
        await Promise.all(agentPromises);

        // Check if at least 1 agent has valid analysis — if all failed, still proceed but with warning
        const validOpinions = Object.values(opinions).filter(o => o.valid && o.stance !== "UNKNOWN");
        if (validOpinions.length === 0) {
          safeEnqueue(send("phase", { phase: "analysis", message: "⚠️ 所有Agent分析均失败，将使用降级数据进入辩论", status: "warning" }));
        }

        // ==========================================
        // Phase 3: Multi-Round Debate (3-round deadlock)
        // ==========================================
        // 至少需要两个有效观点，避免单个模型独自替整个团队做决定
        const successfulAgents = agents.filter(a => opinions[a.id]?.valid && opinions[a.id].stance !== "UNKNOWN");
        if (successfulAgents.length < 2) {
          safeEnqueue(send("phase", { phase: "debate", message: "⚠️ 有效分析不足2个，跳过辩论阶段", status: "warning" }));
          // 发送降级决策
          safeEnqueue(send("decision", {
            action: "HOLD", confidence: 0, summary: "有效分析不足，无法形成团队共识。请检查模型配置和数据质量后重试。",
            finalOpinions: agents.map((a) => ({ agentId: a.id, name: a.name, stance: opinions[a.id]?.stance || "UNKNOWN", confidence: opinions[a.id]?.confidence || 0 })),
            stockName,
            stockCode,
            market,
            analysisPrice: prevClose, // 昨日收盘价
          }));
        } else {
          // 检查独立分析阶段是否已达成共识
          const initialStances = successfulAgents.map((a) => opinions[a.id].stance);
          const initialConsensus = initialStances.every((s) => s === initialStances[0]);

          let consensusReached = false;
          let resolvedConsensusStance: DecidableStance | null = null;
          const debateHistory: Array<{
            round: number;
            moderatorMsg?: string;
            agents: Array<{
              agentId: string; name: string; previousStance: string; currentStance: string;
              changed: boolean; coreChangeReason: string | null; response: string; confidence: number;
            }>;
            changedCount: number;
          }> = [];

          const currentOpinions: Record<string, AgentOpinion> = { ...opinions };

          {
            // 进行轮询辩论；即使独立分析已经一致，也至少完成一轮交叉复核。
            if (successfulAgents.length < agents.length) {
              safeEnqueue(send("phase", { phase: "debate", message: `⚠️ 仅${successfulAgents.length}/${agents.length}个Agent完成分析，进入辩论`, status: "warning" }));
            } else {
              safeEnqueue(send("phase", { phase: "debate", message: initialConsensus ? "第二阶段：AlphaAgents交叉复核（每位Agent至少再次发言）" : "第二阶段：轮询辩论" }));
            }

            let consecutiveNoChangeRounds = 0;

            for (let round = 1; round <= MAX_DEBATE_ROUNDS; round++) {
              safeEnqueue(send("debate_round", { round, maxRounds: MAX_DEBATE_ROUNDS, message: `辩论第${round}轮` }));

              let changedCount = 0;
              const roundResults: typeof debateHistory[number]["agents"] = [];
              const roundSnapshot: Record<string, AgentOpinion> = { ...currentOpinions };
              let moderatorGuidance = "";

              try {
                if (isMockMode) {
                  moderatorGuidance = initialConsensus
                    ? "当前三位分析师方向一致，本轮请重点复核是否存在被忽略的反向证据、数据口径偏差，以及置信度是否需要下调。"
                    : "当前三位分析师存在分歧，本轮请逐一回应其他维度的核心证据，说明是否足以改变自己的立场或置信度。";
                } else {
                  const moderatorDebatePrompt = buildModeratorDebatePrompt(
                    stockCode,
                    successfulAgents.map((a) => ({ name: a.name, opinion: roundSnapshot[a.id] })),
                    debateHistory,
                    round,
                  );
                  moderatorGuidance = await callLLMWithRetry({
                    model: moderatorModel,
                    provider: "volcengine",
                    messages: [
                      { role: "system", content: MODERATOR_SYSTEM_PROMPT },
                      { role: "user", content: moderatorDebatePrompt },
                    ],
                    temperature: 0.5,
                    signal: perCallSignal(request.signal),
                    agentId: "moderator",
                    userLLMConfig: userApiConfig.llm?.moderator,
                  });
                  moderatorGuidance = stripCodeBlocks(moderatorGuidance);
                }
              } catch (error) {
                if (request.signal.aborted) throw error;
                moderatorGuidance = "主持人提示生成失败，本轮请各分析师直接回应其他分析师的核心证据与反方观点。";
              }

              safeEnqueue(send("debate_moderator", { round, content: moderatorGuidance }));

              for (const agent of successfulAgents) {
                const previousStance = roundSnapshot[agent.id].stance;
                const otherOps = successfulAgents.filter((a) => a.id !== agent.id).map((a) => ({
                  agentId: a.id, name: a.name, opinion: roundSnapshot[a.id],
                }));

                // 构建其他Agent的完整分析映射（排除自己）
                const otherAnalyses: Record<string, string> = {};
                for (const a of successfulAgents) {
                  if (a.id !== agent.id) {
                    otherAnalyses[a.id] = analysesRaw[a.id] || "";
                  }
                }

                const debatePrompt = buildDebatePrompt(agent.id, stockCode, roundSnapshot[agent.id], otherOps, otherAnalyses, debateHistory, moderatorGuidance);
                const debateMessages: ChatMessage[] = [
                  { role: "system", content: agent.systemPrompt },
                  { role: "user", content: `你对${stockCode}的分析：\n${analysesRaw[agent.id]}` },
                  { role: "assistant", content: "已记录我的分析结论。" },
                  { role: "user", content: debatePrompt },
                ];

                let debateContent = "";
                const debateEffectiveModel = userApiConfig.llm?.[agent.id as keyof typeof userApiConfig.llm]?.model || MODEL_SUGGESTIONS[agent.id];
                safeEnqueue(send("debate_start", { agent: agent.id, name: agent.name, round, previousStance }));

                if (isMockMode) {
                  const mockChanged = market === "CN" && round === 1 && agent.id === "sentiment";
                  const mockStance = mockChanged ? "BEARISH" : previousStance;
                  const mockResponse = mockChanged
                    ? `经过辩论，我发现资金面的分歧信号比我想象的更严重，北向资金流出是一个不可忽视的警告信号。我调整立场为看空。`
                    : `我维持${previousStance === "BULLISH" ? "看多" : previousStance === "BEARISH" ? "看空" : "中性"}的判断，其他分析师的观点尚不足以说服我改变立场。`;

                  debateContent = mockResponse;
                  for (let i = 0; i < mockResponse.length; i += 3) {
                    safeEnqueue(send("debate_chunk", { agent: agent.id, content: mockResponse.slice(i, i + 3), round }));
                    await new Promise((r) => setTimeout(r, 15));
                  }

                  const newOpinion: AgentOpinion = {
                    ...roundSnapshot[agent.id], stance: mockStance,
                    confidence: mockChanged ? 5 : roundSnapshot[agent.id].confidence,
                    coreChangeReason: mockChanged ? "资金面分歧信号严重，北向资金持续流出" : undefined,
                  };
                  currentOpinions[agent.id] = newOpinion;
                  const changed = mockStance !== previousStance;
                  if (changed) changedCount++;
                  roundResults.push({
                    agentId: agent.id, name: agent.name, previousStance, currentStance: mockStance,
                    changed, coreChangeReason: changed ? "资金面分歧信号严重，北向资金持续流出" : null,
                    response: mockResponse, confidence: newOpinion.confidence,
                  });
                } else {
                  try {
                    const result = await callLLMWithRetry({ model: debateEffectiveModel, provider: agent.provider, messages: debateMessages, temperature: 0.7, thinking: agent.thinking, signal: perCallSignal(request.signal), agentId: agent.id, userLLMConfig: userApiConfig.llm?.[agent.id as keyof typeof userApiConfig.llm] });
                    const parsed = parseAgentResponse(result);
                    if (!parsed.valid || parsed.stance === "UNKNOWN") throw new Error("辩论输出格式无效");
                    // Send readable text to frontend, not raw JSON
                    const readableText = parsed.response || parsed.analysis || stripCodeBlocks(result);
                    debateContent = readableText;
                    for (let i = 0; i < readableText.length; i += 5) {
                      safeEnqueue(send("debate_chunk", { agent: agent.id, content: readableText.slice(i, i + 5), round }));
                      await new Promise((r) => setTimeout(r, 5));
                    }
                    const newStance = parsed.stance;
                    const changed = newStance !== previousStance;
                    if (changed) changedCount++;
                    currentOpinions[agent.id] = { ...parsed, coreChangeReason: changed ? (parsed.coreChangeReason || undefined) : undefined };
                    roundResults.push({
                      agentId: agent.id, name: agent.name, previousStance, currentStance: newStance,
                      changed, coreChangeReason: changed ? (parsed.coreChangeReason || null) : null,
                      response: readableText, confidence: parsed.confidence,
                    });
                  } catch (err) {
                    if (request.signal.aborted) throw err;
                    const errMsg = err instanceof Error ? err.message : "辩论调用失败";
                    console.error(`[Debate] ${agent.id} round ${round} failed: ${errMsg}`);
                    debateContent = `[辩论失败: ${errMsg}]`;
                    safeEnqueue(send("debate_chunk", { agent: agent.id, content: debateContent, round }));
                    roundResults.push({
                      agentId: agent.id, name: agent.name, previousStance, currentStance: previousStance,
                      changed: false, coreChangeReason: null, response: debateContent, confidence: roundSnapshot[agent.id].confidence,
                    });
                  }
                }

                safeEnqueue(send("debate_complete", {
                  agent: agent.id, name: agent.name, round,
                  stance: currentOpinions[agent.id].stance,
                  previousStance,
                  changed: roundResults[roundResults.length - 1]?.changed || false,
                  coreChangeReason: roundResults[roundResults.length - 1]?.coreChangeReason || null,
                  parsedResult: currentOpinions[agent.id],
                }));
              }

              debateHistory.push({ round, moderatorMsg: moderatorGuidance, agents: roundResults, changedCount });

              // Check consensus
              const stances = successfulAgents.map((a) => currentOpinions[a.id].stance);
              if (stances.every((s) => s === stances[0])) {
                consensusReached = true;
                resolvedConsensusStance = stances[0] as DecidableStance;
                safeEnqueue(send("consensus", { stance: stances[0], message: `辩论达成共识：${stances[0]}`, round }));
                break;
              }

              // Track consecutive no-change rounds
              consecutiveNoChangeRounds = nextNoChangeStreak(consecutiveNoChangeRounds, changedCount);

              if (hasDebateDeadlock(consecutiveNoChangeRounds)) {
                safeEnqueue(send("deadlock", {
                  round, message: `连续${DEADLOCK_THRESHOLD}轮无人修改观点，进入最终观点投票`,
                  consecutiveNoChange: consecutiveNoChangeRounds,
                  stances: successfulAgents.map((a) => ({ agentId: a.id, name: a.name, stance: currentOpinions[a.id].stance, confidence: currentOpinions[a.id].confidence })),
                }));
                break;
              }
            }
          }

        if (!consensusReached) {
          // ==========================================
          // Phase 4: 一次透明的置信度加权表决；无法达到2/3阈值时保持HOLD
          // ==========================================
            safeEnqueue(send("phase", { phase: "vote", message: "第四阶段：投票表决" }));
            const voteType = "最终观点置信度加权投票";
            safeEnqueue(send("vote_round", { round: 1, maxRounds: 1, type: voteType, message: voteType }));
            const voteOpinions = successfulAgents.map((agent) => currentOpinions[agent.id]);
            const voteResult = resolveWeightedConsensus(voteOpinions);
            const agentVotes = successfulAgents.map((agent) => ({
              agentId: agent.id,
              name: agent.name,
              initialStance: opinions[agent.id].stance,
              initialConfidence: opinions[agent.id].confidence,
              stance: currentOpinions[agent.id].stance,
              confidence: currentOpinions[agent.id].confidence,
              changed: opinions[agent.id].stance !== currentOpinions[agent.id].stance || opinions[agent.id].confidence !== currentOpinions[agent.id].confidence,
              weight: confidenceToVoteWeight(currentOpinions[agent.id].confidence),
            }));
            safeEnqueue(send("vote_result", {
              round: 1, type: voteType, votes: voteResult.votes,
              totalVotes: voteResult.totalVotes,
              threshold: Math.round(voteResult.threshold * 100) / 100,
              agentVotes,
              consensusReached: voteResult.stance !== null,
            }));

            if (voteResult.stance) {
              consensusReached = true;
              resolvedConsensusStance = voteResult.stance;
              safeEnqueue(send("consensus", { stance: voteResult.stance, message: `加权投票达到2/3阈值：${voteResult.stance}`, round: 1 }));
            } else {
              safeEnqueue(send("arbitration_start", {}));
              let arbitrationContent = "各方证据不足以形成2/3共识，主持人将分歧完整写入最终报告，决策保持HOLD。";
              if (!isMockMode) {
                try {
                  const arbPrompt = buildArbitrationPrompt(stockCode, successfulAgents.map((a) => ({ name: a.name, opinion: currentOpinions[a.id] })));
                  arbitrationContent = await callLLMWithRetry({ model: moderatorModel, provider: "volcengine", messages: [{ role: "system", content: MODERATOR_SYSTEM_PROMPT }, { role: "user", content: arbPrompt }], temperature: 0.5, signal: perCallSignal(request.signal), agentId: "moderator", userLLMConfig: userApiConfig.llm?.moderator });
                } catch (error) {
                  if (request.signal.aborted) throw error;
                }
              }
              safeEnqueue(send("arbitration", { content: arbitrationContent }));
              safeEnqueue(send("consensus", { stance: "NEUTRAL", message: "未达到共识阈值，按审慎原则保持HOLD", round: 1 }));
              resolvedConsensusStance = null;
            }
        }

        // ==========================================
        // Phase 5: Final Decision
        // ==========================================
        safeEnqueue(send("phase", { phase: "moderator", message: "最终阶段：主持人汇总" }));
        safeEnqueue(send("moderator_start", { name: "主持人", model: moderatorModel }));

        const finalOpinions = agents.map((agent) => ({
          agentId: agent.id, name: agent.name,
          initialStance: opinions[agent.id].stance,
          initialConfidence: opinions[agent.id].confidence,
          stance: currentOpinions[agent.id].stance,
          confidence: currentOpinions[agent.id].confidence,
          changed: opinions[agent.id].stance !== currentOpinions[agent.id].stance || opinions[agent.id].confidence !== currentOpinions[agent.id].confidence,
          reasons: currentOpinions[agent.id].reasons,
          analysis: analysesRaw[agent.id],
        }));

        const debateSummary = debateHistory
          .map((r) => `第${r.round}轮（${r.changedCount}人改变）${r.moderatorMsg ? `\n主持人提示：${r.moderatorMsg}` : ""}\n${r.agents.map((a) => `${a.name}: ${a.previousStance}${a.changed ? `→${a.currentStance}` : ""}${a.coreChangeReason ? ` (转变原因：${a.coreChangeReason})` : ""}；回应：${a.response}`).join("\n")}`)
          .join("\n");

        const marketInfo = stockData.market
          ? `\n\n行情数据：${stockData.market.name}(${stockCode}) 现价${stockData.market.price}${stockData.market.currency || marketDefinition.currency} 涨跌幅${stockData.market.changePct > 0 ? "+" : ""}${stockData.market.changePct}% PE${stockData.market.pe} PB${stockData.market.pb} 总市值${stockData.market.totalMv}亿${stockData.market.currency || marketDefinition.currency}`
          : "";
        const financialInfo = stockData.financial
          ? `\n财务估值依据：报告期${stockData.financial.reportDate}，EPS ${stockData.financial.eps}，每股净资产 ${stockData.financial.bvps}，营收增长 ${stockData.financial.revenueGrowth}%，净利润增长 ${stockData.financial.profitGrowth}%，ROE ${stockData.financial.roe}%`
          : "\n财务估值依据：标准化财务数据缺失，目标价应采用更宽的情景区间并明确不确定性。";

        // 决策方向由已经校验的团队共识产生；主持人只负责汇总，不是第四个投票者。
        const action = resolvedConsensusStance ? stanceToAction(resolvedConsensusStance) : "HOLD";
        const meanConfidence = successfulAgents.reduce((sum, agent) => sum + currentOpinions[agent.id].confidence, 0) / successfulAgents.length;
        const coverageFactor = successfulAgents.length / agents.length;
        const confidence = resolvedConsensusStance
          ? Math.max(1, Math.min(95, Math.round(meanConfidence * 10 * coverageFactor)))
          : Math.max(1, Math.min(55, Math.round(meanConfidence * 10 * coverageFactor)));

        const targetPriceInstruction = stockData.market?.price
          ? `系统已提供有效现价 ${stockData.market.price} ${stockData.market.currency || marketDefinition.currency}。目标价不得写“数据不足”；请结合现价、估值指标、财务增长和团队方向给出数值目标或区间，并注明估值方法和假设。`
          : "本次缺少有效现价，目标价位写“数据不足”，并说明缺少现价。";

        const moderatorPrompt = `以下是三位分析师对${marketDefinition.label}${stockCode}的分析和辩论全过程：${marketInfo}${financialInfo}

${finalOpinions.map((o) => `=== ${o.name} (${o.stance}, 信心度${o.confidence}/10) ===\n初始分析：${o.analysis}\n核心论据：${o.reasons.join("；")}`).join("\n\n")}

辩论过程：
${debateSummary}

系统校验结果：${resolvedConsensusStance ? `团队已形成有效共识 ${resolvedConsensusStance}` : "团队未达到2/3置信度加权阈值"}。
【系统指定输出】投资决策必须是 ${action}，置信度必须是 ${confidence}%。你只能解释该结果，不得修改方向或置信度。
【目标价要求】${targetPriceInstruction}

请综合以上信息形成最终投决报告，并完整保留关键分歧与缺失数据。`;

        const moderatorMessages: ChatMessage[] = [
          { role: "system", content: MODERATOR_SYSTEM_PROMPT },
          { role: "user", content: moderatorPrompt },
        ];

        let moderatorContent = "";

        if (isMockMode) {
          const mockModerator = buildMockModeratorReport(action, confidence, marketDefinition.currency, stockData.market?.price || prevClose || 1);
          for (let i = 0; i < mockModerator.length; i += 3) {
            const chunk = mockModerator.slice(i, i + 3);
            moderatorContent += chunk;
            safeEnqueue(send("moderator_chunk", { content: chunk }));
            await new Promise((r) => setTimeout(r, 15));
          }
        } else {
          try {
            for await (const chunk of streamLLM({ model: moderatorModel, provider: "volcengine", messages: moderatorMessages, temperature: 0.7, signal: perCallSignal(request.signal), agentId: "moderator", userLLMConfig: userApiConfig.llm?.moderator })) {
              if (chunk.type === "content") {
                moderatorContent += chunk.content;
                safeEnqueue(send("moderator_chunk", { content: chunk.content }));
              }
            }
          } catch (err) {
            if (request.signal.aborted) throw err;
            const errMsg = err instanceof Error ? err.message : "主持人调用失败";
            moderatorContent += `\n\n[报告生成失败: ${errMsg}]`;
            safeEnqueue(send("moderator_chunk", { content: `[报告生成失败: ${errMsg}]` }));
          }
        }

        if (!isMockMode && stockData.market?.price && /【目标价位】\s*数据不足/.test(moderatorContent)) {
          try {
            const repairPrompt = `请修正以下投决报告的目标价位。当前有效现价为${stockData.market.price} ${stockData.market.currency || marketDefinition.currency}，PE为${stockData.market.pe || "缺失"}，PB为${stockData.market.pb || "缺失"}，EPS为${stockData.financial?.eps ?? "缺失"}，净利润增长率为${stockData.financial?.profitGrowth ?? "缺失"}%，最终方向为${action}，置信度为${confidence}%。请基于这些已有数据给出保守的目标价或目标区间，资料不完整时标注“情景估值”并说明假设。只输出一行，格式为：【目标价位】数值或区间 币种（方法与假设）。不得输出“数据不足”。`;
            const repairedTarget = await callLLMWithRetry({ model: moderatorModel, provider: "volcengine", messages: [{ role: "system", content: MODERATOR_SYSTEM_PROMPT }, { role: "user", content: repairPrompt }], temperature: 0.3, signal: perCallSignal(request.signal), agentId: "moderator", userLLMConfig: userApiConfig.llm?.moderator });
            const targetLine = stripCodeBlocks(repairedTarget).match(/【目标价位】[^\n]+/)?.[0];
            if (targetLine && !targetLine.includes("数据不足")) {
              moderatorContent = moderatorContent.replace(/【目标价位】[^\n]*/, targetLine);
            }
          } catch (error) {
            console.error(`[Moderator] target price repair failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        // 把报告中的格式字段与系统校验结果统一，避免LLM文本和结构化决策互相矛盾。
        if (/【投资决策】\s*(BUY|SELL|HOLD)/i.test(moderatorContent)) {
          moderatorContent = moderatorContent.replace(/【投资决策】\s*(BUY|SELL|HOLD)/i, `【投资决策】${action}`);
        } else {
          moderatorContent = `【投资决策】${action}\n${moderatorContent}`;
        }
        if (/【置信度】\s*\d+%?/i.test(moderatorContent)) {
          moderatorContent = moderatorContent.replace(/【置信度】\s*\d+%?/i, `【置信度】${confidence}%`);
        } else {
          moderatorContent = moderatorContent.replace(`【投资决策】${action}`, `【投资决策】${action}\n【置信度】${confidence}%`);
        }

        safeEnqueue(send("decision", {
          action, confidence, summary: moderatorContent,
          finalOpinions: finalOpinions.map((o) => ({ agentId: o.agentId, name: o.name, initialStance: o.initialStance, initialConfidence: o.initialConfidence, stance: o.stance, confidence: o.confidence, changed: o.changed })),
          stockName,
          stockCode,
          market,
          analysisPrice: prevClose, // 昨日收盘价
        }));

        } // end else (successfulAgents.length > 0)

        safeEnqueue(send("done", {}));
        safeClose();
      } catch (err) {
        if (request.signal.aborted) {
          safeClose();
          return;
        }
        const errMsg = err instanceof Error ? err.message : "处理异常";
        safeEnqueue(send("error", { message: errMsg }));
        safeEnqueue(send("done", {}));
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" },
  });
}
