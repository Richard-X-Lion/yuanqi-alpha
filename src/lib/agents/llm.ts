import { LLMCallOptions } from "./types";
import { resolveProvider } from "./config";
import { safeExternalFetch } from "@/lib/security/safe-fetch";

// Strip markdown code blocks from LLM output - aggressive version
export function stripCodeBlocks(text: string): string {
  if (!text) return "";
  return text
    // Remove opening code block markers: ```json, ```javascript, etc.
    .replace(/```(?:json|javascript|js|python|py|text|markdown|md|html|css|bash|sh|sql|typescript|ts|yaml|yml|toml|xml|java|c|cpp|go|rs|rb|php)?\s*\n?/gi, "")
    // Remove any remaining ``` markers (opening or closing)
    .replace(/```/g, "")
    .trim();
}

// Strip code blocks from all text fields in an object
export function stripAllCodeBlocks(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "string") {
      obj[key] = stripCodeBlocks(val);
    } else if (Array.isArray(val)) {
      obj[key] = val.map((item: unknown) => typeof item === "string" ? stripCodeBlocks(item) : item);
    }
  }
}

function buildRequestBody(options: LLMCallOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model, messages: options.messages,
    stream: true,
  };
  // DeepSeek V4 models: thinking mode disables temperature support
  // Only add temperature when thinking is NOT enabled
  const isDeepSeekV4 = options.provider === "deepseek" && (options.model.includes("v4") || options.model.includes("deepseek-chat") || options.model.includes("deepseek-reasoner"));
  if (isDeepSeekV4 && options.thinking) {
    // Thinking mode: don't send temperature (not supported)
    body.thinking = { type: "enabled", budget_tokens: 32000 };
  } else {
    // Non-thinking mode or other providers: temperature is supported
    body.temperature = options.temperature ?? 0.7;
  }
  // Explicitly disable thinking when thinking=false for DeepSeek V4
  if (isDeepSeekV4 && options.thinking === false) {
    body.thinking = { type: "disabled" };
  }
  // Add max_tokens to prevent model looping with excessively long outputs
  body.max_tokens = 4096;
  return body;
}

/**
 * 用户既可能填写 API 根地址，也可能直接粘贴完整的 chat/completions 地址。
 * 统一在这里拼接，避免生成 .../chat/completions/chat/completions。
 */
export function buildChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(normalized)) return normalized;
  return `${normalized}/chat/completions`;
}

export async function* streamLLM(options: LLMCallOptions): AsyncGenerator<{ type: "content" | "thinking"; content: string }> {
  const resolved = resolveProvider(options.agentId || "", options.model, options.userLLMConfig);
  const url = buildChatCompletionsUrl(resolved.baseUrl);
  const body = buildRequestBody({ ...options, model: resolved.resolvedModel });

  const response = await safeExternalFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolved.apiKey}` },
    body: JSON.stringify(body), signal: options.signal, redirect: "error",
  }, `${options.agentId || "Agent"} 模型服务`);

  console.log(`[streamLLM] provider=${options.provider} model=${resolved.resolvedModel} status=${response.status} ok=${response.ok}`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(`[streamLLM] ERROR: status=${response.status} body=${errorText.slice(0, 500)}`);
    throw new Error(`LLM API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法获取响应流");
  const decoder = new TextDecoder();
  let buffer = "";
  let emittedContent = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        if (!emittedContent) throw new Error("模型返回空内容");
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.reasoning_content) yield { type: "thinking", content: delta.reasoning_content };
        if (delta.content) {
          emittedContent = true;
          yield { type: "content", content: delta.content };
        }
      } catch { /* skip */ }
    }
  }
  if (!emittedContent) throw new Error("模型返回空内容");
}

export async function callLLM(options: LLMCallOptions): Promise<string> {
  const resolved = resolveProvider(options.agentId || "", options.model, options.userLLMConfig);
  const url = buildChatCompletionsUrl(resolved.baseUrl);
  const body = buildRequestBody({ ...options, model: resolved.resolvedModel, temperature: options.temperature ?? 0.7 });
  (body as Record<string, unknown>).stream = false;

  console.log(`[callLLM] provider=${options.provider} model=${resolved.resolvedModel} url=${url} hasKey=${!!resolved.apiKey}`);

  const response = await safeExternalFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolved.apiKey}` },
    body: JSON.stringify(body), signal: options.signal, redirect: "error",
  }, `${options.agentId || "Agent"} 模型服务`);

  console.log(`[callLLM] response status=${response.status} ok=${response.ok}`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(`[callLLM] ERROR: status=${response.status} body=${errorText.slice(0, 500)}`);
    throw new Error(`LLM API error (${response.status}): ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const reasoning = data.choices?.[0]?.message?.reasoning_content ?? "";
  if (reasoning) {
    console.log(`[callLLM] thinking mode active, reasoning length=${reasoning.length}`);
  }
  console.log(`[callLLM] content length=${content.length} first100=${content.slice(0, 100)}`);
  const cleaned = stripCodeBlocks(content);
  if (!cleaned) throw new Error("模型返回空内容");
  return cleaned;
}

// Check if error is a retryable model loop error
function isRetryableLoopError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || "";
  return msg.includes("模型循环") || msg.includes("请求已被中断") || msg.includes("loop") || msg.includes("interrupted");
}

// Call LLM with retry for model loop errors
export async function callLLMWithRetry(
  options: LLMCallOptions,
  maxRetries = 2
): Promise<string> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const opts = { ...options };
      if (attempt > 0) {
        // On retry, slightly increase temperature to avoid repetition
        opts.temperature = Math.min((opts.temperature ?? 0.7) + 0.15 * attempt, 1.0);
        console.log(`[callLLMWithRetry] attempt ${attempt + 1}/${maxRetries + 1} with temperature=${opts.temperature}`);
      }
      return await callLLM(opts);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!isRetryableLoopError(err) || attempt >= maxRetries) {
        throw err;
      }
      console.log(`[callLLMWithRetry] model loop detected, retrying... (${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError || new Error("LLM call failed after retries");
}
