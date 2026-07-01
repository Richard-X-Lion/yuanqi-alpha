'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  type ApiConfig,
  type LLMProviderConfig,
  type DataProviderConfig,
  type MCPServerConfigItem,
  buildDefaultConfig,
  saveConfig,
  loadConfig,
  DEFAULT_LLM_CONFIGS,
  DEFAULT_DATA_CONFIG,
} from '@/lib/api-config';
import { MODEL_SUGGESTIONS } from '@/lib/agents/config';

// ============================================================
// Icon Components
// ============================================================

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
  );
}

function KeyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
  );
}

function SaveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
  );
}

function RotateCcwIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
  );
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
  );
}

// ============================================================
// LLM Config Card
// ============================================================

function LLMConfigCard({
  label,
  icon,
  color,
  config,
  defaultConfig,
  onChange,
  modelSuggestion,
}: {
  label: string;
  icon: string;
  color: string;
  config: LLMProviderConfig;
  defaultConfig: LLMProviderConfig;
  onChange: (updated: LLMProviderConfig) => void;
  modelSuggestion: string;
}) {
  const [showKey, setShowKey] = useState(false);
  const isModelMissing = !config.model?.trim();

  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${isModelMissing ? 'border-yellow-500/50' : 'border-border'}`}>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ backgroundColor: `${color}10` }}>
        <span className="text-xl">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        {isModelMissing && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-medium">需配置模型</span>
        )}
      </div>
      <div className="p-5 space-y-4">
        {/* Model Name */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            模型名称 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => onChange({ ...config, model: e.target.value })}
            placeholder={`如：${modelSuggestion}`}
            className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition ${isModelMissing ? 'border-yellow-500/50' : 'border-border'}`}
          />
          <p className="mt-1 text-[11px] text-muted-foreground/60">
            必填。请填写您要使用的具体模型名称，如 {modelSuggestion}
          </p>
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Base URL</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
            placeholder={defaultConfig.baseUrl}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
          />
          <p className="mt-1 text-[11px] text-muted-foreground/60">OpenAI 兼容接口地址，如 https://api.deepseek.com</p>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-1"
            >
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground/60">密钥仅保存在当前浏览器会话；分析时会经本站后端转发给对应模型服务</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MCP Config Section
// ============================================================

function MCPConfigSection({
  config,
  onUpdateServer,
  onAddServer,
  onRemoveServer,
  onToggleEnabled,
}: {
  config: ApiConfig;
  onUpdateServer: (index: number, updated: MCPServerConfigItem) => void;
  onAddServer: () => void;
  onRemoveServer: (index: number) => void;
  onToggleEnabled: (enabled: boolean) => void;
}) {
  const [testing, setTesting] = useState<Record<number, { status: 'idle' | 'testing' | 'success' | 'error'; message?: string }>>({});

  const testConnection = async (index: number, server: MCPServerConfigItem) => {
    if (!server.url.trim()) return;
    setTesting(prev => ({ ...prev, [index]: { status: 'testing' } }));
    try {
      const response = await fetch('/api/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server }),
      });
      const result = await response.json() as { serverInfo?: { name?: string; version?: string }; toolCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error || `连接失败 (${response.status})`);
      setTesting(prev => ({
        ...prev,
        [index]: {
          status: 'success',
          message: `连接成功！${result.serverInfo?.name || server.name} v${result.serverInfo?.version || '-'}，${result.toolCount || 0} 个工具`,
        },
      }));
    } catch (e) {
      setTesting(prev => ({
        ...prev,
        [index]: {
          status: 'error',
          message: e instanceof Error ? e.message : '连接失败',
        },
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium">MCP 数据源（可选）</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              通过 Model Context Protocol (MCP) 连接专业金融数据源。启用后，系统将优先使用 MCP 数据源获取股票数据。
              支持从 MCP Servers 介绍页面复制配置 JSON 粘贴添加。
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleEnabled(!config.mcp.enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.mcp.enabled ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${config.mcp.enabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
          </button>
          <span className="text-xs text-muted-foreground">
            {config.mcp.enabled ? 'MCP 数据源已启用' : 'MCP 数据源已禁用'}
          </span>
        </div>
      </div>

      {config.mcp.enabled && (
        <>
          {config.mcp.servers.map((server, index) => (
            <div key={server.id} className={`rounded-lg border bg-card overflow-hidden transition ${server.enabled ? 'border-border' : 'border-border/50 opacity-60'}`}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{server.name || `MCP Server ${index + 1}`}</h3>
                  {testing[index]?.status === 'success' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">已连接</span>
                  )}
                  {testing[index]?.status === 'error' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">连接失败</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => testConnection(index, server)}
                    disabled={testing[index]?.status === 'testing'}
                    className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition disabled:opacity-50"
                  >
                    {testing[index]?.status === 'testing' ? '测试中...' : '测试连接'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateServer(index, { ...server, enabled: !server.enabled })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${server.enabled ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${server.enabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveServer(index)}
                    className="text-xs px-2 py-1 rounded text-red-400 hover:text-red-300 transition"
                  >
                    删除
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {testing[index]?.message && (
                  <div className={`text-xs p-2 rounded ${testing[index].status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {testing[index].message}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">显示名称</label>
                  <input
                    type="text"
                    value={server.name}
                    onChange={(e) => onUpdateServer(index, { ...server, name: e.target.value })}
                    placeholder="如：恒生聚源数据"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">MCP Server URL</label>
                  <input
                    type="text"
                    value={server.url}
                    onChange={(e) => onUpdateServer(index, { ...server, url: e.target.value })}
                    placeholder="https://api.example.com/mcp-server?token=xxx"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground/60">完整的 MCP Server URL，包含 token 等认证参数</p>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onAddServer}
            className="w-full py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition text-sm"
          >
            + 添加 MCP Server
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================
// Data Provider Card
// ============================================================

function DataProviderCard({
  config,
  defaultConfig,
  onChange,
}: {
  config: DataProviderConfig;
  defaultConfig: DataProviderConfig;
  onChange: (updated: DataProviderConfig) => void;
}) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden transition ${config.enabled ? 'border-border' : 'border-border/50 opacity-60'}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{config.name || defaultConfig.name}</h3>
        <button
          type="button"
          onClick={() => onChange({ ...config, enabled: !config.enabled })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.enabled ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
        </button>
      </div>
      <div className="p-5 space-y-4">
        {/* Provider Name */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">数据源名称</label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => onChange({ ...config, name: e.target.value })}
            placeholder="如：东方财富、Tushare、自定义数据源"
            disabled={!config.enabled}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Base URL</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
            placeholder={defaultConfig.baseUrl || "https://api.example.com"}
            disabled={!config.enabled}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-[11px] text-muted-foreground/60">留空则使用系统默认的免费数据源</p>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Key（可选）</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
            placeholder="如需要认证，请输入您的 API Key"
            disabled={!config.enabled}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-[11px] text-muted-foreground/60">部分数据源无需密钥，留空即可</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Settings Page
// ============================================================

export default function SettingsPage() {
  const [config, setConfig] = useState<ApiConfig>(buildDefaultConfig());
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'llm' | 'data' | 'mcp'>('llm');

  useEffect(() => {
    const savedConfig = loadConfig();
    if (savedConfig) {
      // Merge with defaults for any missing fields
      const defaults = buildDefaultConfig();
      setConfig({
        llm: {
          fundamental: { ...defaults.llm.fundamental, ...savedConfig.llm.fundamental },
          sentiment: { ...defaults.llm.sentiment, ...savedConfig.llm.sentiment },
          capital: { ...defaults.llm.capital, ...savedConfig.llm.capital },
          moderator: { ...defaults.llm.moderator, ...savedConfig.llm.moderator },
        },
        data: { ...defaults.data, ...savedConfig.data },
        mcp: {
          enabled: savedConfig.mcp?.enabled ?? false,
          servers: savedConfig.mcp?.servers?.length
            ? savedConfig.mcp.servers
            : defaults.mcp.servers,
        },
      });
    }
  }, []);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const defaults = buildDefaultConfig();
    setConfig(defaults);
    saveConfig(defaults);
  };

  const updateLLMConfig = (key: keyof ApiConfig['llm'], updated: LLMProviderConfig) => {
    setConfig((prev) => ({
      ...prev,
      llm: { ...prev.llm, [key]: updated },
    }));
    setSaved(false);
  };

  const updateDataConfig = (updated: DataProviderConfig) => {
    setConfig((prev) => ({
      ...prev,
      data: updated,
    }));
    setSaved(false);
  };

  const updateMCPServer = (index: number, updated: MCPServerConfigItem) => {
    setConfig((prev) => {
      const newServers = [...(prev.mcp?.servers || [])];
      newServers[index] = updated;
      return {
        ...prev,
        mcp: { ...prev.mcp, servers: newServers },
      };
    });
    setSaved(false);
  };

  const addMCPServer = () => {
    setConfig((prev) => {
      const newServers = [...(prev.mcp?.servers || [])];
      newServers.push({
        id: `custom-${Date.now()}`,
        name: "自定义MCP",
        url: "",
        enabled: true,
      });
      return {
        ...prev,
        mcp: { ...prev.mcp, servers: newServers, enabled: true },
      };
    });
    setSaved(false);
  };

  const removeMCPServer = (index: number) => {
    setConfig((prev) => {
      const newServers = [...(prev.mcp?.servers || [])];
      newServers.splice(index, 1);
      return {
        ...prev,
        mcp: { ...prev.mcp, servers: newServers },
      };
    });
    setSaved(false);
  };

  const configuredLLMCount = Object.values(config.llm).filter((c) => c.apiKey.trim()).length;
  const totalLLMCount = Object.keys(config.llm).length;
  const enabledMCPCount = config.mcp?.servers?.filter((s) => s.enabled).length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition text-sm"
            >
              <ArrowLeftIcon />
              <span>返回首页</span>
            </Link>
            <div className="w-px h-4 bg-border" />
            <h1 className="text-sm font-semibold text-foreground">API 配置管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition"
            >
              <RotateCcwIcon />
              重置默认
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition ${
                saved
                  ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {saved ? <CheckIcon /> : <SaveIcon />}
              {saved ? '已保存' : '保存配置'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Info Banner */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <KeyIcon />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground font-medium">配置说明</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                API Key 仅在当前浏览器会话中保存，发起分析时会通过 HTTPS 发送到本应用服务端并转发给您配置的模型平台；服务端不会持久化密钥。
                大模型 API 必须兼容 OpenAI 接口格式 (/v1/chat/completions)。
                四个 Agent 均需配置模型与 API Key；MCP 可选，未配置时使用系统内置免费行情与资讯数据源。
                第三个模型槽位在A股框架中负责资金面，在港美股 AlphaAgents 框架中负责估值与价格量分析。
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
            <span className="text-muted-foreground">
              大模型已配置：<span className="text-foreground font-medium">{configuredLLMCount}/{totalLLMCount}</span>
            </span>
            <span className="text-muted-foreground">
              自定义数据源：<span className="text-foreground font-medium">{config.data.enabled ? '已启用' : '未启用'}</span>
            </span>
            <span className="text-muted-foreground">
              MCP数据源：<span className="text-foreground font-medium">{enabledMCPCount > 0 ? `${enabledMCPCount}个已启用` : '未启用'}</span>
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-lg bg-muted/50 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('llm')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              activeTab === 'llm' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            大模型 API
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              activeTab === 'data' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            数据源 API
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mcp')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              activeTab === 'mcp' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            MCP 数据源
          </button>
        </div>

        {/* LLM Config Section */}
        {activeTab === 'llm' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
              <p className="text-sm text-yellow-400 font-medium">模型配置说明</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                每个 Agent 必须单独配置模型名称。系统不会预设任何默认模型，请根据您的 API 密钥所属平台，填写正确的模型名称。
                例如：DeepSeek 平台可填 deepseek-v4-pro，阿里云百炼可填 qwen3.6-plus。
              </p>
            </div>
            <LLMConfigCard
              label="基本面分析师"
              icon="📊"
              color="#3b82f6"
              config={config.llm.fundamental}
              defaultConfig={DEFAULT_LLM_CONFIGS.fundamental}
              onChange={(c) => updateLLMConfig('fundamental', c)}
              modelSuggestion={MODEL_SUGGESTIONS.fundamental}
            />
            <LLMConfigCard
              label="情绪面分析师"
              icon="📰"
              color="#f59e0b"
              config={config.llm.sentiment}
              defaultConfig={DEFAULT_LLM_CONFIGS.sentiment}
              onChange={(c) => updateLLMConfig('sentiment', c)}
              modelSuggestion={MODEL_SUGGESTIONS.sentiment}
            />
            <LLMConfigCard
              label="资金面 / Valuation 分析师"
              icon="💰"
              color="#10b981"
              config={config.llm.capital}
              defaultConfig={DEFAULT_LLM_CONFIGS.capital}
              onChange={(c) => updateLLMConfig('capital', c)}
              modelSuggestion={MODEL_SUGGESTIONS.capital}
            />
            <LLMConfigCard
              label="主持人"
              icon="🎯"
              color="#8b5cf6"
              config={config.llm.moderator}
              defaultConfig={DEFAULT_LLM_CONFIGS.moderator}
              onChange={(c) => updateLLMConfig('moderator', c)}
              modelSuggestion={MODEL_SUGGESTIONS.moderator}
            />
          </div>
        )}

        {/* Data Config Section */}
        {activeTab === 'data' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium">自定义数据源（可选）</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    系统默认使用免费公开数据源。如果您有私有数据源接口，可在此配置，系统将优先使用您的数据源。
                    支持东方财富、同花顺、Tushare、AKShare 等任何兼容的数据源。
                  </p>
                </div>
              </div>
            </div>
            <DataProviderCard
              config={config.data}
              defaultConfig={DEFAULT_DATA_CONFIG}
              onChange={updateDataConfig}
            />
          </div>
        )}

        {/* MCP Config Section */}
        {activeTab === 'mcp' && (
          <MCPConfigSection
            config={config}
            onUpdateServer={updateMCPServer}
            onAddServer={addMCPServer}
            onRemoveServer={removeMCPServer}
            onToggleEnabled={(enabled) => setConfig(prev => ({ ...prev, mcp: { ...prev.mcp, enabled } }))}
          />
        )}
      </main>
    </div>
  );
}
