import type { LiveKitConfig } from "@/lib/call-token";

export type LiveKitRegion = "sydney" | "melbourne";

type LiveKitEnvironment = Readonly<Record<string, string | undefined>>;

export type LiveKitDeploymentConfig =
  | { mode: "disabled" }
  | { mode: "single"; config: LiveKitConfig }
  | {
      mode: "regional";
      cells: Record<LiveKitRegion, LiveKitConfig>;
    };

export function readLiveKitDeploymentConfig(
  env: LiveKitEnvironment,
  production = env.NODE_ENV === "production"
): LiveKitDeploymentConfig {
  const topology = env.LIVEKIT_TOPOLOGY?.trim() || "single";
  if (topology !== "single" && topology !== "regional") {
    throw new Error("call.livekit_topology_invalid");
  }

  if (topology === "single") {
    const config = readCell(env, "LIVEKIT", production);
    if (!config) return { mode: "disabled" };
    assertPublicOrigin(config.url, env.NEXT_PUBLIC_LIVEKIT_URL, production);
    return { mode: "single", config };
  }

  const sydney = readCell(env, "LIVEKIT_SYDNEY", production, true);
  const melbourne = readCell(env, "LIVEKIT_MELBOURNE", production, true);
  if (!sydney || !melbourne) throw new Error("call.livekit_regional_incomplete");

  assertPublicOrigin(
    sydney.url,
    env.NEXT_PUBLIC_LIVEKIT_SYDNEY_URL,
    production
  );
  assertPublicOrigin(
    melbourne.url,
    env.NEXT_PUBLIC_LIVEKIT_MELBOURNE_URL,
    production
  );
  if (new URL(sydney.url).origin === new URL(melbourne.url).origin) {
    throw new Error("call.livekit_regional_origin_shared");
  }
  if (
    sydney.apiKey === melbourne.apiKey ||
    sydney.apiSecret === melbourne.apiSecret
  ) {
    throw new Error("call.livekit_regional_credentials_shared");
  }

  return { mode: "regional", cells: { sydney, melbourne } };
}

export function selectLiveKitConfig(
  deployment: LiveKitDeploymentConfig,
  homeRegion?: LiveKitRegion
): LiveKitConfig {
  if (deployment.mode === "disabled") throw new Error("call.not_configured");
  if (deployment.mode === "single") return deployment.config;
  if (!homeRegion) throw new Error("call.room_home_required");
  return deployment.cells[homeRegion];
}

function readCell(
  env: LiveKitEnvironment,
  prefix: string,
  production: boolean,
  required = false
): LiveKitConfig | null {
  const values = [
    env[`${prefix}_URL`]?.trim(),
    env[`${prefix}_API_KEY`]?.trim(),
    env[`${prefix}_API_SECRET`]?.trim(),
  ];
  const configured = values.filter(Boolean).length;
  if (configured === 0 && !required) return null;
  if (configured !== values.length) {
    throw new Error(`call.livekit_cell_incomplete:${prefix}`);
  }

  const [url, apiKey, apiSecret] = values as [string, string, string];
  assertSecureEndpoint(url, `${prefix}_URL`, production);
  if (production && [apiKey, apiSecret].some(isPlaceholder)) {
    throw new Error(`call.livekit_credentials_placeholder:${prefix}`);
  }
  return { url, apiKey, apiSecret };
}

function assertPublicOrigin(
  serverUrl: string,
  publicValue: string | undefined,
  production: boolean
) {
  const publicUrl = publicValue?.trim();
  if (!publicUrl) return;
  assertSecureEndpoint(publicUrl, "NEXT_PUBLIC_LIVEKIT_URL", production);
  if (new URL(serverUrl).origin !== new URL(publicUrl).origin) {
    throw new Error("call.livekit_public_origin_mismatch");
  }
}

function assertSecureEndpoint(value: string, label: string, production: boolean) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`call.livekit_url_invalid:${label}`);
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "wss:" && !(url.protocol === "ws:" && loopback && !production)) {
    throw new Error(`call.livekit_url_insecure:${label}`);
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`call.livekit_url_not_origin:${label}`);
  }
}

function isPlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("your_") || normalized.includes("your-");
}
