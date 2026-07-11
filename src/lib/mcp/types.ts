export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface MCPCallToolResult {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
}

export type MCPDataKind =
  | "market"
  | "financial"
  | "fundFlow"
  | "news"
  | "research"
  | "announcement";

export interface MCPDataEvidence {
  kind: MCPDataKind;
  label: string;
  content: string;
  source: {
    serverId: string;
    serverName: string;
    toolName: string;
  };
}

export interface MCPDataSourceResult {
  entries: MCPDataEvidence[];
}
