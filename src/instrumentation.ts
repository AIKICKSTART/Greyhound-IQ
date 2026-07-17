// Runs once at server boot (Next instrumentation hook). Fail fast on partial
// comms configuration instead of erroring at the first user's token request.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { readLiveKitDeploymentConfig } = await import("@/lib/livekit-config");
  const liveKit = readLiveKitDeploymentConfig(process.env);
  if (liveKit.mode === "disabled" && process.env.NODE_ENV === "production") {
    const { logBackgroundWarn } = await import("@/lib/logger");
    logBackgroundWarn("livekit.not_configured", {
      feature: "video_voice_calls",
      enabled: false,
    });
  }

  const realtimeSecret = process.env.REALTIME_CHANNEL_SECRET?.trim();
  if (
    process.env.NODE_ENV === "production" &&
    (!realtimeSecret ||
      realtimeSecret.toLowerCase().includes("your_") ||
      realtimeSecret.toLowerCase().includes("your-"))
  ) {
    const { logBackgroundError } = await import("@/lib/logger");
    logBackgroundError("realtime.secret_missing", {
      feature: "private_realtime_channels",
      enabled: false,
    });
  }
}
