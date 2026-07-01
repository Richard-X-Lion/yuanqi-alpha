import { NextRequest } from "next/server";
import { fetchGlobalMarketSnapshot } from "@/lib/data/global";
import { fetchMarketData } from "@/lib/data/stock";
import { resolveSecurity } from "@/lib/markets/security";
import { parseMarket } from "@/lib/markets/types";
import { assertDataSourceCompliance } from "@/lib/data/compliance";

export async function GET(request: NextRequest): Promise<Response> {
  const code = request.nextUrl.searchParams.get("code")?.trim() || "";
  const market = parseMarket(request.nextUrl.searchParams.get("market") || "CN");
  if (!market || !code) return Response.json({ error: "market 或 code 参数无效" }, { status: 400 });

  try {
    assertDataSourceCompliance();
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "数据源合规状态无效" }, { status: 503 });
  }

  try {
    const security = await resolveSecurity(code, market);
    const quote = market === "CN"
      ? await fetchMarketData(security.code)
      : (await fetchGlobalMarketSnapshot(security)).market;
    if (!quote) return Response.json({ error: "未获取到行情" }, { status: 404 });
    return Response.json({
      market,
      code: security.code,
      name: quote.name,
      price: quote.price,
      prevClose: quote.prevClose,
      changePct: quote.changePct,
      currency: quote.currency || (market === "CN" ? "CNY" : market === "HK" ? "HKD" : "USD"),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "行情获取失败" }, { status: 502 });
  }
}
