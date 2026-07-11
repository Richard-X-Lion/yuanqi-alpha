export interface AnalysisModeResult {
  isMockMode: boolean;
  reasons: string[];
}

export function resolveAnalysisMode(
  missingModelNames: string[],
  enabledMcpCount: number,
): AnalysisModeResult {
  const reasons: string[] = [];
  if (missingModelNames.length > 0) reasons.push(`未完整配置模型：${missingModelNames.join("、")}`);
  if (enabledMcpCount === 0) reasons.push("未配置可用的用户 MCP 数据源");
  return { isMockMode: reasons.length > 0, reasons };
}
