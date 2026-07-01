import { MCPServerConfig, MCPTool, MCPInitializeResult, MCPCallToolResult } from "./types";
import { assertSafePublicUrl } from "@/lib/security/public-url";
import { safeExternalFetch } from "@/lib/security/safe-fetch";

let requestIdCounter = 0;
function nextId(): number {
  return ++requestIdCounter;
}

export class MCPClient {
  private config: MCPServerConfig;
  private initialized = false;
  private serverInfo?: MCPInitializeResult;
  private tools: MCPTool[] = [];
  private sessionId?: string;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  get name(): string {
    return this.config.name;
  }

  get url(): string {
    return this.config.url;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get availableTools(): MCPTool[] {
    return this.tools;
  }

  private async parseResponse(response: Response): Promise<Record<string, unknown>> {
    if (response.status === 202 || response.status === 204) return {};
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("MCP 响应过大");
    if (!contentType.includes("text/event-stream")) {
      return JSON.parse(text) as Record<string, unknown>;
    }

    const messages = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== "[DONE]");
    for (let index = messages.length - 1; index >= 0; index--) {
      try {
        return JSON.parse(messages[index]) as Record<string, unknown>;
      } catch {
        // Continue looking for the last valid JSON-RPC event.
      }
    }
    throw new Error("MCP 返回了无法解析的事件流");
  }

  private async request(method: string, params?: Record<string, unknown>, notification = false): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;

    const payload: Record<string, unknown> = { jsonrpc: "2.0", method };
    if (!notification) payload.id = nextId();
    if (params) payload.params = params;

    const response = await safeExternalFetch(this.config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    }, `MCP ${this.config.name}`);
    if (!response.ok) throw new Error(`MCP ${method} failed: ${response.status}`);
    const returnedSessionId = response.headers.get("mcp-session-id");
    if (returnedSessionId) this.sessionId = returnedSessionId;

    const data = await this.parseResponse(response);
    const error = data.error as { message?: string } | undefined;
    if (error) throw new Error(`MCP ${method} error: ${error.message || "未知错误"}`);
    return data;
  }

  async initialize(): Promise<MCPInitializeResult> {
    await assertSafePublicUrl(this.config.url, `MCP ${this.config.name}`);
    const data = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "yuanqi-alpha", version: "1.0.0" },
    });

    this.serverInfo = data.result as MCPInitializeResult;
    this.initialized = true;

    await this.request("notifications/initialized", undefined, true);

    await this.listTools();

    return this.serverInfo;
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.initialized) {
      throw new Error("MCP client not initialized");
    }

    const data = await this.request("tools/list");

    const result = data.result as { tools?: MCPTool[] } | undefined;
    this.tools = (result?.tools || []).slice(0, 100);
    return this.tools;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPCallToolResult> {
    if (!this.initialized) {
      throw new Error("MCP client not initialized");
    }

    const data = await this.request("tools/call", { name: toolName, arguments: args });

    return data.result as MCPCallToolResult;
  }

  hasTool(toolName: string): boolean {
    return this.tools.some((t) => t.name === toolName);
  }
}
