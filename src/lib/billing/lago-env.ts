import "server-only";

export type LagoEnv = {
  apiUrl: string;
  frontUrl: string;
  apiKey: string;
  webhookSecret: string;
};

export function getLagoEnv(env?: NodeJS.ProcessEnv): LagoEnv {
  assertServerRuntime();
  const sourceEnv = env ?? process.env;

  return {
    apiUrl: requireEnv(sourceEnv, "LAGO_API_URL"),
    frontUrl: requireEnv(sourceEnv, "LAGO_FRONT_URL"),
    apiKey: requireEnv(sourceEnv, "LAGO_API_KEY"),
    webhookSecret: requireEnv(sourceEnv, "LAGO_WEBHOOK_SECRET"),
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: keyof LagoEnvMap) {
  const value = env[key]?.trim();
  if (!value || looksLikePlaceholder(value)) {
    throw new Error(`billing.lago_not_configured:${key}`);
  }
  return value;
}

function looksLikePlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("your_") ||
    normalized.includes("your-") ||
    normalized.includes("example.com") ||
    normalized.includes("placeholder") ||
    normalized.startsWith("generate-")
  );
}

function assertServerRuntime() {
  if (typeof window !== "undefined") {
    throw new Error("billing.lago_server_only");
  }
}

type LagoEnvMap = {
  LAGO_API_URL: string;
  LAGO_FRONT_URL: string;
  LAGO_API_KEY: string;
  LAGO_WEBHOOK_SECRET: string;
};
