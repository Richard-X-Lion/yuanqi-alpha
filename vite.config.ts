import { existsSync, readFileSync } from "node:fs";
import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

interface HostingConfig {
  d1?: string | null;
  r2?: string | null;
}

function readHostingConfig(): HostingConfig {
  const configUrl = new URL("./.openai/hosting.json", import.meta.url);
  if (!existsSync(configUrl)) return {};
  return JSON.parse(readFileSync(configUrl, "utf8")) as HostingConfig;
}

const hostingConfig = readHostingConfig();
const { d1, r2 } = hostingConfig;
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [{
        binding: d1,
        database_name: "site-creator-d1",
        database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
      }]
    : [],
  r2_buckets: r2
    ? [{ binding: r2, bucket_name: "site-creator-r2" }]
    : [],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
