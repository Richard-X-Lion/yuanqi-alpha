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

export interface MCPDataSourceResult {
  marketData?: string;
  financialData?: string;
  fundFlowData?: string;
  newsData?: string;
  researchReport?: string;
  announcement?: string;
}
