import assert from "node:assert/strict";
import test from "node:test";
import { buildChatCompletionsUrl } from "./llm";

test("appends chat completions to an API root URL", () => {
  assert.equal(
    buildChatCompletionsUrl("https://api.deepseek.com"),
    "https://api.deepseek.com/chat/completions",
  );
});

test("does not duplicate a full chat completions URL", () => {
  assert.equal(
    buildChatCompletionsUrl("https://ark.cn-beijing.volces.com/api/v3/chat/completions/"),
    "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  );
});
