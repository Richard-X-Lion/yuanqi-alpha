import { z } from "zod";
import { AgentOpinion, AgentStance } from "./types";
import { stripCodeBlocks, stripAllCodeBlocks } from "./llm";
import { extractBalancedJsonObjects } from "@/lib/json";

const agentOpinionSchema = z.object({
  stance: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  confidence: z.coerce.number().int().min(1).max(10),
  reasons: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  reservations: z.string().optional(),
  reservation: z.string().optional(),
  analysis: z.string().optional(),
  coreChangeReason: z.string().nullable().optional(),
  response: z.string().optional(),
});

export function parseAgentResponse(content: string): AgentOpinion {
  const cleaned = stripCodeBlocks(content);
  for (const jsonObject of extractBalancedJsonObjects(cleaned)) {
    try {
      const parsed = JSON.parse(jsonObject);
      // Strip code blocks from all text fields
      const safeParsed: Record<string, unknown> = parsed as Record<string, unknown>;
      stripAllCodeBlocks(safeParsed);

      const validation = agentOpinionSchema.safeParse(safeParsed);
      if (!validation.success) throw new Error("Agent output schema validation failed");
      const parsedOpinion = validation.data;
      const stance = parsedOpinion.stance;
      const confidence = parsedOpinion.confidence;
      const reasons = parsedOpinion.reasons;
      const evidence = parsedOpinion.evidence;
      const reservations = parsedOpinion.reservations || parsedOpinion.reservation || "";
      const coreChangeReason = parsedOpinion.coreChangeReason || undefined;
      const response = parsedOpinion.response;

      let analysis: string | undefined;
      if (parsedOpinion.analysis?.trim()) {
        analysis = parsedOpinion.analysis;
      } else if (response && response.trim().length > 0) {
        analysis = response;
      }

      return {
        stance,
        confidence,
        reasons,
        evidence,
        reservations,
        analysis: analysis || "",
        valid: true,
        coreChangeReason,
        response,
      };
    } catch { /* try the next balanced JSON object */ }
  }
  const fallbackStance = extractStance(cleaned);
  const hasUsableFallback = cleaned.length > 50 && fallbackStance !== "UNKNOWN";
  return {
    stance: hasUsableFallback ? fallbackStance : "UNKNOWN",
    confidence: hasUsableFallback ? extractScore(cleaned) : 0,
    reasons: [],
    evidence: [],
    reservations: "",
    analysis: hasUsableFallback ? cleaned : "",
    valid: hasUsableFallback,
  };
}

export function extractStance(content: string): AgentStance {
  const upper = content.toUpperCase();
  const labeled = upper.match(/(?:立场|观点|结论|STANCE)\s*[*_】\]"'：:=-]*\s*(BULLISH|BEARISH|NEUTRAL|看多|看空|中性)/i)?.[1]?.toUpperCase();
  if (labeled === "BULLISH" || labeled === "看多") return "BULLISH";
  if (labeled === "BEARISH" || labeled === "看空") return "BEARISH";
  if (labeled === "NEUTRAL" || labeled === "中性") return "NEUTRAL";

  const candidates: AgentStance[] = [];
  if (upper.includes("看多") || upper.includes("BULLISH")) candidates.push("BULLISH");
  if (upper.includes("看空") || upper.includes("BEARISH")) candidates.push("BEARISH");
  if (upper.includes("中性") || upper.includes("NEUTRAL")) candidates.push("NEUTRAL");
  return candidates.length === 1 ? candidates[0] : "UNKNOWN";
}

export function extractScore(content: string): number {
  const match = content.match(/综合评分[：:]\s*(\d+)/) || content.match(/confidence["']?\s*[:=]\s*(\d+)/);
  const score = match ? parseInt(match[1], 10) : 5;
  return Math.min(10, Math.max(1, score));
}
