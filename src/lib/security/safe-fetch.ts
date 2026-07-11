import { lookup as dnsLookup } from "node:dns";
import { Agent, fetch as undiciFetch } from "undici";
import { assertSafePublicUrl, isPrivateOrReservedIp, parsePublicHttpsUrl } from "./public-url";

type SafeFetchInit = Omit<RequestInit, "body"> & { body?: string };

export function prefersNativeFetch(userAgent: string | undefined): boolean {
  return /cloudflare-workers|workerd/i.test(userAgent || "");
}

export function isUnsupportedAlpnError(error: unknown): boolean {
  const outer = error as Error & { cause?: Error };
  return /ALPNProtocols.+not implemented/i.test(`${outer?.message || ""} ${outer?.cause?.message || ""}`);
}

const safeAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
        if (error) {
          callback(error, "", 0);
          return;
        }
        if (addresses.length === 0 || addresses.some(({ address }) => isPrivateOrReservedIp(address))) {
          const blocked = Object.assign(new Error("外部服务解析到了不允许访问的网络地址"), { code: "EACCES" });
          callback(blocked, "", 0);
          return;
        }
        const family = typeof options === "number" ? options : options?.family;
        const allowedAddresses = addresses.filter((item) => !family || family === 0 || item.family === family);
        const selected = allowedAddresses[0] || addresses[0];
        if (typeof options === "object" && options?.all) {
          const callbackAll = callback as unknown as (
            error: NodeJS.ErrnoException | null,
            result: Array<{ address: string; family: number }>,
          ) => void;
          callbackAll(null, allowedAddresses.length ? allowedAddresses : addresses);
          return;
        }
        callback(null, selected.address, selected.family);
      });
    },
  },
  maxOrigins: 20,
});

/**
 * 用于用户可配置的服务地址。URL 先做语法检查，并在建立 socket 时
 * 重新检查 DNS 结果，关闭“预检查通过后 DNS 重绑到内网”的时间窗口。
 */
export async function safeExternalFetch(rawUrl: string, init: SafeFetchInit = {}, label = "外部服务"): Promise<Response> {
  const url = parsePublicHttpsUrl(rawUrl, label);
  await assertSafePublicUrl(url.toString(), label);
  const requestInit: RequestInit = {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: init.signal,
    redirect: "error",
  };
  try {
    if (prefersNativeFetch(globalThis.navigator?.userAgent)) {
      return await fetch(url, requestInit);
    }
    const response = await undiciFetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: init.signal,
      redirect: "error",
      dispatcher: safeAgent,
    });
    return response as unknown as Response;
  } catch (error) {
    if (isUnsupportedAlpnError(error)) {
      try {
        return await fetch(url, requestInit);
      } catch (nativeError) {
        throw new Error(`${label}连接失败：托管环境无法建立兼容的 HTTPS 连接`, { cause: nativeError });
      }
    }
    const outer = error as Error & { cause?: Error & { code?: string } };
    const cause = outer.cause;
    const detail = cause?.code === "EACCES"
      ? "域名解析到了不允许的网络地址"
      : cause?.code === "ENOTFOUND"
        ? "域名无法解析"
        : cause?.code === "ECONNREFUSED"
          ? "目标服务拒绝连接"
          : cause?.code?.startsWith("ERR_TLS")
            ? "TLS 证书校验失败"
            : cause?.message || outer.message || "未知网络错误";
    throw new Error(`${label}连接失败：${detail}`, { cause: error });
  }
}
