import assert from "node:assert/strict";
import test from "node:test";
import { assertSafePublicUrl, parsePublicHttpsUrl, resolvePublicDns } from "./public-url";
import { isUnsupportedAlpnError, prefersNativeFetch, rejectRedirectResponse, safeExternalFetch } from "./safe-fetch";

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

test("resolves A and AAAA records without node:dns.lookup", async () => {
  const dualStack = await resolvePublicDns(
    "api.example.com",
    async () => ["8.8.8.8"],
    async () => ["2001:4860:4860::8888"],
  );
  assert.deepEqual(dualStack, [
    { address: "8.8.8.8", family: 4 },
    { address: "2001:4860:4860::8888", family: 6 },
  ]);

  const ipv4Only = await resolvePublicDns(
    "api.example.com",
    async () => ["8.8.4.4"],
    async () => { throw new Error("ENODATA"); },
  );
  assert.deepEqual(ipv4Only, [{ address: "8.8.4.4", family: 4 }]);
});

test("connection-time safe fetch rejects a private IP before opening a socket", async () => {
  await assert.rejects(
    () => safeExternalFetch("https://127.0.0.1/private"),
    /私有|环回|保留/,
  );
});

test("uses the native fetch path in Cloudflare Workers", () => {
  assert.equal(prefersNativeFetch("Cloudflare-Workers"), true);
  assert.equal(prefersNativeFetch("workerd/1.0"), true);
  assert.equal(prefersNativeFetch("Node.js/22"), false);
});

test("recognizes the Worker ALPN compatibility error", () => {
  assert.equal(isUnsupportedAlpnError(new Error("The options.ALPNProtocols option is not implemented")), true);
  assert.equal(isUnsupportedAlpnError(new Error("TLS handshake failed")), false);
});

test("manual redirect handling rejects every redirect response", () => {
  assert.throws(
    () => rejectRedirectResponse(new Response(null, { status: 302 }), "测试服务"),
    /不允许的重定向/,
  );
  const ok = new Response("ok", { status: 200 });
  assert.equal(rejectRedirectResponse(ok, "测试服务"), ok);
});
