// Runs once at server boot (Next instrumentation hook). Fail fast on partial
// comms configuration instead of erroring at the first user's token request.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const set = [url, key, secret].filter(Boolean).length;
  if (set > 0 && set < 3) {
    throw new Error(
      "LiveKit misconfigured: LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set together (calls are disabled only when all three are absent)."
    );
  }
  if (set === 0 && process.env.NODE_ENV === "production") {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "livekit.not_configured: video/voice calls are disabled for this deployment",
      })
    );
  }
}
