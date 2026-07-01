const REQUIRED_ACK_VERSION = "2026-06";

/**
 * 法务/数据授权不能靠代码自动完成。这个门禁用于防止未经审核的
 * 免费数据源被无意间直接带到公网生产环境。
 */
export function assertDataSourceCompliance(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.DATA_SOURCE_COMPLIANCE_ACK !== REQUIRED_ACK_VERSION) {
    throw new Error(`生产数据源尚未完成合规确认（需 DATA_SOURCE_COMPLIANCE_ACK=${REQUIRED_ACK_VERSION}）`);
  }
}

export const DATA_SOURCE_COMPLIANCE_VERSION = REQUIRED_ACK_VERSION;
