import assert from "node:assert/strict";
import test from "node:test";
import { parseSecFinancialData } from "./filings";

function annual(val: number, end: string, accn: string, filed: string) {
  const year = Number(end.slice(0, 4));
  return { start: `${year - 1}-10-01`, end, val, accn, fy: year, fp: "FY", form: "10-K", filed };
}

function instant(val: number, end: string, accn: string, filed: string) {
  const year = Number(end.slice(0, 4));
  return { end, val, accn, fy: year, fp: "FY", form: "10-K", filed };
}

test("normalizes annual SEC XBRL facts without inventing missing values", () => {
  const latestAccn = "0000000000-25-000001";
  const previousAccn = "0000000000-24-000001";
  const latestEnd = "2025-09-30";
  const previousEnd = "2024-09-30";
  const fact = (units: Record<string, unknown[]>) => ({ units });
  const payload = {
    entityName: "Example Corp",
    facts: {
      "us-gaap": {
        RevenueFromContractWithCustomerExcludingAssessedTax: fact({ USD: [
          annual(400_000_000_000, latestEnd, latestAccn, "2025-11-01"),
          annual(360_000_000_000, previousEnd, previousAccn, "2024-11-01"),
        ] }),
        NetIncomeLoss: fact({ USD: [
          annual(100_000_000_000, latestEnd, latestAccn, "2025-11-01"),
          annual(80_000_000_000, previousEnd, previousAccn, "2024-11-01"),
        ] }),
        GrossProfit: fact({ USD: [annual(180_000_000_000, latestEnd, latestAccn, "2025-11-01")] }),
        NetCashProvidedByUsedInOperatingActivities: fact({ USD: [annual(120_000_000_000, latestEnd, latestAccn, "2025-11-01")] }),
        EarningsPerShareDiluted: fact({ "USD/shares": [annual(6.5, latestEnd, latestAccn, "2025-11-01")] }),
        Assets: fact({ USD: [instant(1_000_000_000_000, latestEnd, latestAccn, "2025-11-01")] }),
        Liabilities: fact({ USD: [instant(400_000_000_000, latestEnd, latestAccn, "2025-11-01")] }),
        StockholdersEquity: fact({ USD: [
          instant(500_000_000_000, latestEnd, latestAccn, "2025-11-01"),
          instant(450_000_000_000, previousEnd, previousAccn, "2024-11-01"),
        ] }),
        CommonStockSharesOutstanding: fact({ shares: [instant(15_000_000_000, latestEnd, latestAccn, "2025-11-01")] }),
      },
    },
  } as Parameters<typeof parseSecFinancialData>[0];

  const result = parseSecFinancialData(payload, 123456);
  assert.equal(result.filings.length, 1);
  assert.equal(result.financial?.source, "SEC Company Facts (XBRL)");
  assert.equal(result.financial?.revenue, 4000);
  assert.equal(result.financial?.netProfit, 1000);
  assert.equal(result.financial?.revenueGrowth, 11.11);
  assert.equal(result.financial?.profitGrowth, 25);
  assert.equal(result.financial?.grossMargin, 45);
  assert.equal(result.financial?.netProfitMargin, 25);
  assert.equal(result.financial?.debtRatio, 40);
  assert.equal(result.financial?.roe, 21.05);
  assert.equal(result.financial?.operatingCashFlow, 1200);
});

test("returns filing evidence but no normalized financials when core SEC facts are incomplete", () => {
  const payload = {
    entityName: "Incomplete Corp",
    facts: {
      "us-gaap": {
        RevenueFromContractWithCustomerExcludingAssessedTax: {
          units: { USD: [annual(10_000_000, "2025-09-30", "0000000000-25-000002", "2025-11-01")] },
        },
      },
    },
  } as Parameters<typeof parseSecFinancialData>[0];
  const result = parseSecFinancialData(payload, 123456);
  assert.equal(result.financial, null);
  assert.equal(result.filings.length, 1);
});
