import assert from "node:assert/strict";
import test from "node:test";
import { assertSafePublicUrl, parsePublicHttpsUrl } from "./public-url";
import { safeExternalFetch } from "./safe-fetch";

test("requires HTTPS and rejects local targets", () => {
  assert.throws(() => parsePublicHttpsUrl("http://api.example.com"), /HTTPS/);
  assert.throws(() => parsePublicHttpsUrl("https://127.0.0.1"), /私有|环回|保留/);
  assert.throws(() => parsePublicHttpsUrl("https://203.0.113.10"), /私有|环回|保留/);
  assert.throws(() => parsePublicHttpsUrl("https://[2001:db8::1]"), /私有|环回|保留/);
  assert.throws(() => parsePublicHttpsUrl("https://localhost/v1"), /本机|局域网/);
});

test("accepts a hostname only when every resolved address is public", async () => {
  await assert.doesNotReject(() => assertSafePublicUrl(
    "https://api.example.com/v1",
    "测试服务",
    async () => [{ address: "8.8.8.8", family: 4 }],
  ));

  await assert.rejects(() => assertSafePublicUrl(
    "https://api.example.com/v1",
    "测试服务",
    async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.8", family: 4 },
    ],
  ), /不允许访问/);
});

test("connection-time safe fetch rejects a private IP before opening a socket", async () => {
  await assert.rejects(
    () => safeExternalFetch("https://127.0.0.1/private"),
    /私有|环回|保留/,
  );
});
