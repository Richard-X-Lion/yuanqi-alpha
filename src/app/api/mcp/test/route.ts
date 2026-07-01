import { NextRequest } from "next/server";
import { MCPClient, type MCPServerConfig } from "@/lib/mcp";
import { assertSafePublicUrl } from "@/lib/security/public-url";
import { consumeAnalysisQuota, getClientId } from "@/lib/security/rate-limit";

function json(data: Record<string, unknown>, status = 200): Response {
  return Response.json(data, { status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16 * 1024) return json({ error: "请求内容过大" }, 413);

  const quota = await consumeAnalysisQuota(`mcp-test:${getClientId(request.headers)}`);
  if (quota.unavailable) {
    return json({ error: "限流服务暂时不可用", retryAfterSeconds: quota.retryAfterSeconds }, 503);
  }
  if (!quota.allowed) {
    return json({ error: "测试过于频繁，请稍后再试", retryAfterSeconds: quota.retryAfterSeconds }, 429);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "请求格式无效" }, 400);
  }

  const candidate = (raw as { server?: Partial<MCPServerConfig> })?.server;
  if (!candidate || typeof candidate.url !== "string" || !candidate.url.trim()) {
    return json({ error: "MCP 地址不能为空" }, 400);
  }
  if (candidate.url.length > 2048) return json({ error: "MCP 地址过长" }, 400);

  const server: MCPServerConfig = {
    id: typeof candidate.id === "string" ? candidate.id.slice(0, 100) : "custom",
    name: typeof candidate.name === "string" ? candidate.name.slice(0, 100) : "自定义 MCP",
    url: candidate.url.trim(),
    enabled: true,
  };

  try {
    await assertSafePublicUrl(server.url, `MCP ${server.name}`);
    const client = new MCPClient(server);
    const initialized = await client.initialize();
    return json({
      protocolVersion: initialized.protocolVersion,
      serverInfo: initialized.serverInfo,
      toolCount: client.availableTools.length,
      tools: client.availableTools.slice(0, 50).map((tool) => tool.name),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "MCP 连接失败" }, 400);
  }
}
