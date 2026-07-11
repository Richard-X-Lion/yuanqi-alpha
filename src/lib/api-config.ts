// Shared API configuration types and localStorage utilities

export interface LLMProviderConfig {
  name: string;        // Display name e.g. "DeepSeek"
  apiKey: string;      // API key
  baseUrl: string;     // Base URL e.g. "https://api.deepseek.com"
  model: string;       // Model name e.g. "deepseek-v4-pro"
}

export interface MCPServerConfigItem {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface ApiConfig {
  llm: {
    fundamental: LLMProviderConfig;
    sentiment: LLMProviderConfig;
    capital: LLMProviderConfig;
    moderator: LLMProviderConfig;
  };
  mcp: {
    enabled: boolean;
    servers: MCPServerConfigItem[];
  };
}

export const DEFAULT_LLM_CONFIGS: Record<string, LLMProviderConfig> = {
  fundamental: {
    name: "基本面分析师 (DeepSeek)",
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    model: "",
  },
  sentiment: {
    name: "情绪面分析师 (阿里云百炼)",
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "",
  },
  capital: {
    name: "资金面分析师 (DeepSeek)",
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    model: "",
  },
  moderator: {
    name: "主持人 (火山引擎)",
    apiKey: "",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "",
  },
};

export const DEFAULT_MCP_SERVERS: MCPServerConfigItem[] = [
  {
    id: "gildata-tool",
    name: "恒生聚源-多智能体标准版",
    url: "https://api.gildata.com/mcp-servers/aidata-assistant-srv-tool",
    enabled: false,
  },
  {
    id: "gildata-data",
    name: "恒生聚源-综合问数综合版",
    url: "https://api.gildata.com/mcp-servers/aidata-assistant-srv-data",
    enabled: false,
  },
];

const STORAGE_KEY = "yuanqi_alpha_api_config";
const SECRET_STORAGE_KEY = "yuanqi_alpha_api_secrets";

type ApiSecrets = Record<keyof ApiConfig["llm"], string>;

function emptySecrets(): ApiSecrets {
  return { fundamental: "", sentiment: "", capital: "", moderator: "" };
}

export function loadConfig(): ApiConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as ApiConfig;
    const secretsRaw = sessionStorage.getItem(SECRET_STORAGE_KEY);
    const legacySecrets: ApiSecrets = {
      fundamental: config.llm?.fundamental?.apiKey || "",
      sentiment: config.llm?.sentiment?.apiKey || "",
      capital: config.llm?.capital?.apiKey || "",
      moderator: config.llm?.moderator?.apiKey || "",
    };
    const secrets = secretsRaw
      ? { ...emptySecrets(), ...JSON.parse(secretsRaw) as Partial<ApiSecrets> }
      : legacySecrets;

    // 一次性迁移旧版本存在 localStorage 的密钥，避免升级后配置丢失。
    if (!secretsRaw && Object.values(legacySecrets).some(Boolean)) {
      sessionStorage.setItem(SECRET_STORAGE_KEY, JSON.stringify(legacySecrets));
      const sanitized: ApiConfig = {
        ...config,
        llm: {
          fundamental: { ...config.llm.fundamental, apiKey: "" },
          sentiment: { ...config.llm.sentiment, apiKey: "" },
          capital: { ...config.llm.capital, apiKey: "" },
          moderator: { ...config.llm.moderator, apiKey: "" },
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    }
    return {
      ...config,
      llm: {
        fundamental: { ...config.llm.fundamental, apiKey: secrets.fundamental },
        sentiment: { ...config.llm.sentiment, apiKey: secrets.sentiment },
        capital: { ...config.llm.capital, apiKey: secrets.capital },
        moderator: { ...config.llm.moderator, apiKey: secrets.moderator },
      },
    };
  } catch {
    return null;
  }
}

export function saveConfig(config: ApiConfig): void {
  if (typeof window === "undefined") return;
  const secrets: ApiSecrets = {
    fundamental: config.llm.fundamental.apiKey,
    sentiment: config.llm.sentiment.apiKey,
    capital: config.llm.capital.apiKey,
    moderator: config.llm.moderator.apiKey,
  };
  const persistedConfig: ApiConfig = {
    ...config,
    llm: {
      fundamental: { ...config.llm.fundamental, apiKey: "" },
      sentiment: { ...config.llm.sentiment, apiKey: "" },
      capital: { ...config.llm.capital, apiKey: "" },
      moderator: { ...config.llm.moderator, apiKey: "" },
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedConfig));
  sessionStorage.setItem(SECRET_STORAGE_KEY, JSON.stringify(secrets));
}

export function buildDefaultConfig(): ApiConfig {
  return {
    llm: {
      fundamental: { ...DEFAULT_LLM_CONFIGS.fundamental },
      sentiment: { ...DEFAULT_LLM_CONFIGS.sentiment },
      capital: { ...DEFAULT_LLM_CONFIGS.capital },
      moderator: { ...DEFAULT_LLM_CONFIGS.moderator },
    },
    mcp: {
      enabled: false,
      servers: DEFAULT_MCP_SERVERS.map(s => ({ ...s })),
    },
  };
}

export function getEffectiveConfig(): ApiConfig {
  const saved = loadConfig();
  const defaults = buildDefaultConfig();
  if (!saved) return defaults;

  // Merge saved with defaults (so new fields get default values)
  return {
    llm: {
      fundamental: { ...defaults.llm.fundamental, ...saved.llm.fundamental },
      sentiment: { ...defaults.llm.sentiment, ...saved.llm.sentiment },
      capital: { ...defaults.llm.capital, ...saved.llm.capital },
      moderator: { ...defaults.llm.moderator, ...saved.llm.moderator },
    },
    mcp: {
      enabled: saved.mcp?.enabled ?? false,
      servers: saved.mcp?.servers?.length
        ? saved.mcp.servers
        : defaults.mcp.servers,
    },
  };
}

// Check if any LLM API key is configured (either in localStorage or env)
export function hasAnyLLMKey(): boolean {
  const config = getEffectiveConfig();
  return !!(
    config.llm.fundamental.apiKey ||
    config.llm.sentiment.apiKey ||
    config.llm.capital.apiKey ||
    config.llm.moderator.apiKey
  );
}

// Check if MCP is enabled and has any enabled servers
export function hasMCPEnabled(): boolean {
  const config = getEffectiveConfig();
  return config.mcp.enabled && config.mcp.servers.some(s => s.enabled);
}

// Get enabled MCP servers with token from URL
export function getEnabledMCPServers(): MCPServerConfigItem[] {
  const config = getEffectiveConfig();
  if (!config.mcp.enabled) return [];
  return config.mcp.servers.filter(s => s.enabled && s.url.trim());
}
