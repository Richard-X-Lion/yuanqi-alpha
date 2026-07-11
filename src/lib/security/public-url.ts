import { resolve4 as dnsResolve4, resolve6 as dnsResolve6 } from "node:dns/promises";
import { isIP } from "node:net";

type LookupResult = { address: string; family: number };
type LookupFn = (hostname: string) => Promise<LookupResult[]>;
type ResolveFn = (hostname: string) => Promise<string[]>;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff") || normalized.startsWith("2001:db8:")) return true;

  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
}

export function isPrivateOrReservedIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

function normalizedHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
}

export function parsePublicHttpsUrl(rawUrl: string, label = "外部服务"): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label}地址格式无效`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${label}仅允许使用 HTTPS`);
  }
  if (url.username || url.password) {
    throw new Error(`${label}地址不得包含用户名或密码`);
  }

  const hostname = normalizedHostname(url);
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error(`${label}不得指向本机或局域网地址`);
  }
  if (isIP(hostname) && isPrivateOrReservedIp(hostname)) {
    throw new Error(`${label}不得指向私有、环回或保留地址`);
  }

  return url;
}

export async function resolvePublicDns(
  hostname: string,
  resolve4: ResolveFn = dnsResolve4,
  resolve6: ResolveFn = dnsResolve6,
): Promise<LookupResult[]> {
  const [ipv4, ipv6] = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
  const addresses: LookupResult[] = [];
  if (ipv4.status === "fulfilled") {
    addresses.push(...ipv4.value.map((address) => ({ address, family: 4 })));
  }
  if (ipv6.status === "fulfilled") {
    addresses.push(...ipv6.value.map((address) => ({ address, family: 6 })));
  }
  if (addresses.length === 0 && ipv4.status === "rejected" && ipv6.status === "rejected") {
    throw ipv4.reason;
  }
  return addresses;
}

// Cloudflare Workers does not implement node:dns.lookup(), but does support
// resolve4()/resolve6(). Querying both record families keeps the public-address
// validation equivalent across Node and the Sites edge runtime.
const defaultLookup: LookupFn = resolvePublicDns;

export async function assertSafePublicUrl(
  rawUrl: string,
  label = "外部服务",
  lookup: LookupFn = defaultLookup,
): Promise<void> {
  const url = parsePublicHttpsUrl(rawUrl, label);
  const hostname = normalizedHostname(url);
  if (isIP(hostname)) return;

  let addresses: LookupResult[];
  try {
    addresses = await lookup(hostname);
  } catch {
    throw new Error(`${label}域名无法解析`);
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateOrReservedIp(address))) {
    throw new Error(`${label}解析到了不允许访问的网络地址`);
  }
}
