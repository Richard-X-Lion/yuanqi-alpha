import { Provider, UserLLMConfig } from "./config";

export type AgentStance = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";

export interface AgentOpinion {
  stance: AgentStance;
  confidence: number;
  reasons: string[];
  evidence: string[];
  reservations: string;
  analysis: string;
  valid: boolean;
  coreChangeReason?: string;
  response?: string;
}

export interface DebateHistoryEntry {
  round: number;
  moderatorMsg?: string;
  agents: Array<{
    agentId: string;
    name: string;
    previousStance: string;
    currentStance: string;
    changed: boolean;
    coreChangeReason: string | null;
    response: string;
    confidence: number;
  }>;
  changedCount: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallOptions {
  model: string;
  provider: Provider;
  messages: ChatMessage[];
  temperature?: number;
  thinking?: boolean;
  signal?: AbortSignal;
  agentId?: string;
  userLLMConfig?: UserLLMConfig;
}

export function buildRequestBody(options: LLMCallOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    stream: true,
  };
  if (options.thinking && options.provider === "deepseek") {
    body.thinking = { type: "enabled", budget_tokens: 32000 };
  }
  return body;
}
