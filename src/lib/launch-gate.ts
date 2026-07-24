import { createHmac, timingSafeEqual } from "node:crypto";

import { isEmergencyControlActive } from "@/lib/emergency-controls";
import { isMaintenanceBypassPath } from "@/lib/maintenance-mode";

export const LAUNCH_PREVIEW_COOKIE = "giq-launch-preview";

const TOKEN_VERSION = "v1";
const TOKEN_PURPOSE = "greyhoundiq-launch-preview";
const MINIMUM_SECRET_LENGTH = 32;
const LAUNCH_GATE_BYPASS_PREFIXES = [
  "/sign-in",
  "/callback",
  "/launch-preview",
  "/auth/error",
  "/api/livekit/webhook",
] as const;

export interface LaunchGateState {
  active: boolean;
  configured: boolean;
  launchAt: number | null;
  retryAfterSeconds: number;
}

export function resolveLaunchGateState(
  environment: {
    NODE_ENV?: string;
    LAUNCH_GATE_ENABLED?: string;
    LAUNCH_GATE_END_AT?: string;
  } = process.env,
  now = Date.now(),
): LaunchGateState {
  if (!isEmergencyControlActive(environment.LAUNCH_GATE_ENABLED)) {
    return {
      active: false,
      configured: true,
      launchAt: null,
      retryAfterSeconds: 0,
    };
  }

  const launchAt = Date.parse(environment.LAUNCH_GATE_END_AT?.trim() ?? "");
  if (!Number.isFinite(launchAt)) {
    return {
      active: true,
      configured: false,
      launchAt: null,
      retryAfterSeconds: 60,
    };
  }

  const retryAfterSeconds = Math.max(0, Math.ceil((launchAt - now) / 1000));
  return {
    active: now < launchAt,
    configured: true,
    launchAt,
    retryAfterSeconds,
  };
}

export function isLaunchGateBypassPath(pathname: string) {
  if (isMaintenanceBypassPath(pathname)) return true;
  return LAUNCH_GATE_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isLaunchPreviewEmail(
  email: string,
  configuredEmails = process.env.LAUNCH_PREVIEW_EMAILS,
) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  return (configuredEmails ?? "")
    .split(/[,\n;]/)
    .some((candidate) => normalizeEmail(candidate) === normalizedEmail);
}

export function createLaunchPreviewToken(
  email: string,
  secret: string,
  expiresAt: number,
) {
  const normalizedEmail = normalizeEmail(email);
  assertSecret(secret);
  if (!normalizedEmail || !Number.isSafeInteger(expiresAt)) {
    throw new Error("launch_preview.invalid_token_input");
  }

  const payload = Buffer.from(
    JSON.stringify({ email: normalizedEmail, expiresAt }),
  ).toString("base64url");
  return `${TOKEN_VERSION}.${payload}.${sign(payload, secret)}`;
}

export function verifyLaunchPreviewToken(
  token: string | null | undefined,
  secret: string | undefined,
  expectedExpiry: number | null,
  now = Date.now(),
) {
  if (
    !token ||
    token.length > 2048 ||
    !secret ||
    secret.length < MINIMUM_SECRET_LENGTH ||
    !Number.isSafeInteger(expectedExpiry)
  ) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const [, payload, suppliedSignature] = parts;
  const expectedSignature = sign(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { email?: unknown; expiresAt?: unknown };
    const email =
      typeof parsed.email === "string" ? normalizeEmail(parsed.email) : null;
    const expiresAt =
      typeof parsed.expiresAt === "number" ? parsed.expiresAt : null;
    if (
      !email ||
      expiresAt === null ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt !== expectedExpiry ||
      now >= expiresAt
    ) {
      return null;
    }
    return { email, expiresAt };
  } catch {
    return null;
  }
}

export function launchGateResponse(
  request: Request,
  state: LaunchGateState,
  nonce: string,
  now = Date.now(),
) {
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const isDocument =
    request.headers.get("sec-fetch-dest")?.toLowerCase() === "document";
  const renderHtml =
    (request.method === "GET" || request.method === "HEAD") &&
    (acceptsHtml || isDocument);
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    Vary: "Accept, Cookie, Sec-Fetch-Dest",
  };

  if (renderHtml) {
    const html = launchGateHtml(
      state.launchAt,
      nonce,
      now,
      new URL(request.url).searchParams.get("preview") === "denied",
    );
    return new Response(request.method === "HEAD" ? null : html, {
      status: state.configured ? 200 : 503,
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return Response.json(
    {
      error: {
        code: "service.launch_pending",
        message: "GreyhoundIQ opens at 5:00 PM AEST on 25 July 2026",
      },
    },
    {
      status: 503,
      headers: {
        ...headers,
        "Retry-After": Math.max(1, state.retryAfterSeconds).toString(),
      },
    },
  );
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${TOKEN_PURPOSE}.${payload}`)
    .digest("base64url");
}

function assertSecret(secret: string) {
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("launch_preview.secret_too_short");
  }
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 320 ||
    !normalized.includes("@")
  ) {
    return null;
  }
  return normalized;
}

function countdownParts(launchAt: number, now: number) {
  const remaining = Math.max(0, launchAt - now);
  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1000),
  };
}

function launchGateHtml(
  launchAt: number | null,
  nonce: string,
  now: number,
  denied: boolean,
) {
  if (launchAt === null) {
    return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>GreyhoundIQ preview</title></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#08050b;color:#fff;font-family:system-ui,sans-serif;padding:24px">
    <main><h1>Private preview is being configured.</h1><p>Please try again shortly.</p></main>
  </body>
</html>`;
  }

  const initial = countdownParts(launchAt, now);
  const deniedMessage = denied
    ? '<p class="denied" role="alert">This account is not approved for pre-launch access.</p>'
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>GreyhoundIQ launches 25 July</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; overflow-x: hidden; background: #08050b; color: #fff; }
      body::before { content: ""; position: fixed; inset: 0; background: linear-gradient(180deg, rgba(8,5,11,.38), rgba(8,5,11,.92)), url("/images/landing-hero-20260724.webp") center/cover; filter: saturate(.85); transform: scale(1.02); }
      body::after { content: ""; position: fixed; inset: 0; background: radial-gradient(circle at 50% 18%, rgba(161,77,255,.28), transparent 44%), linear-gradient(120deg, rgba(255,194,62,.09), transparent 34%); }
      main { position: relative; z-index: 1; width: min(100%, 880px); min-height: 100vh; margin: auto; display: grid; align-content: center; justify-items: center; padding: 32px 20px 46px; text-align: center; }
      .logo { width: min(84vw, 420px); height: auto; filter: drop-shadow(0 12px 34px rgba(0,0,0,.62)); }
      .eyebrow { margin-top: 30px; color: #e6c4ff; font-size: 12px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; }
      h1 { max-width: 760px; margin: 14px 0 0; font-size: clamp(40px, 8vw, 78px); line-height: .97; letter-spacing: -.045em; text-wrap: balance; }
      h1 span { color: #d785ff; text-shadow: 0 0 30px rgba(180,88,255,.38); }
      .lead { max-width: 650px; margin: 22px auto 0; color: #d6cfdf; font-size: clamp(16px, 2.4vw, 20px); line-height: 1.55; }
      .countdown { width: min(100%, 720px); display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 32px; }
      .unit { padding: 20px 8px 16px; border: 1px solid rgba(216,174,255,.24); border-radius: 18px; background: linear-gradient(180deg, rgba(37,21,51,.82), rgba(16,11,23,.9)); box-shadow: inset 0 1px rgba(255,255,255,.12), 0 18px 48px rgba(0,0,0,.3); backdrop-filter: blur(14px); }
      .value { display: block; font-variant-numeric: tabular-nums; font-size: clamp(32px, 7vw, 56px); font-weight: 800; line-height: 1; }
      .label { display: block; margin-top: 9px; color: #a99fb3; font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
      .launch-time { margin: 18px 0 0; color: #ffd36d; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .preview { margin-top: 30px; }
      .preview a { display: inline-flex; min-height: 50px; align-items: center; justify-content: center; padding: 0 24px; border: 1px solid rgba(226,190,255,.72); border-radius: 13px; background: linear-gradient(180deg, #a84bde, #69228f); box-shadow: inset 0 1px rgba(255,255,255,.28), 0 15px 36px rgba(125,42,177,.38); color: white; font-weight: 800; text-decoration: none; }
      .preview p { margin: 12px 0 0; color: #9e94a8; font-size: 13px; }
      .denied { margin: 18px 0 0; padding: 11px 14px; border: 1px solid rgba(255,118,146,.4); border-radius: 10px; background: rgba(100,20,39,.55); color: #ffdce4; }
      @media (max-width: 540px) { .countdown { gap: 7px; } .unit { padding: 16px 4px 13px; border-radius: 13px; } .label { font-size: 8px; letter-spacing: .1em; } }
    </style>
  </head>
  <body>
    <main>
      <img class="logo" src="/images/logo-wordmark-purple-gold.webp" alt="GreyhoundIQ">
      <div class="eyebrow">The wait is almost over</div>
      <h1>Australian racing intelligence, <span>unleashed.</span></h1>
      <p class="lead">GreyhoundIQ opens at 5:00 PM AEST with live race cards, deep form, breeding intelligence and AI-powered insights in one premium platform.</p>
      <div class="countdown" aria-label="Time until GreyhoundIQ launches">
        <div class="unit"><span class="value" data-days>${initial.days}</span><span class="label">Days</span></div>
        <div class="unit"><span class="value" data-hours>${initial.hours.toString().padStart(2, "0")}</span><span class="label">Hours</span></div>
        <div class="unit"><span class="value" data-minutes>${initial.minutes.toString().padStart(2, "0")}</span><span class="label">Minutes</span></div>
        <div class="unit"><span class="value" data-seconds>${initial.seconds.toString().padStart(2, "0")}</span><span class="label">Seconds</span></div>
      </div>
      <p class="launch-time"><time datetime="2026-07-25T17:00:00+10:00">5:00 PM AEST · Saturday 25 July 2026</time></p>
      ${deniedMessage}
      <div class="preview">
        <a href="/launch-preview">Admin &amp; preview login</a>
        <p>Approved accounts only until launch.</p>
      </div>
      <noscript><p class="lead">Refresh this page after 5:00 PM AEST to enter GreyhoundIQ.</p></noscript>
    </main>
    <script nonce="${nonce}">
      (function () {
        var target = ${launchAt};
        var nodes = {
          days: document.querySelector("[data-days]"),
          hours: document.querySelector("[data-hours]"),
          minutes: document.querySelector("[data-minutes]"),
          seconds: document.querySelector("[data-seconds]")
        };
        function pad(value) { return String(value).padStart(2, "0"); }
        function tick() {
          var remaining = Math.max(0, target - Date.now());
          nodes.days.textContent = String(Math.floor(remaining / 86400000));
          nodes.hours.textContent = pad(Math.floor((remaining % 86400000) / 3600000));
          nodes.minutes.textContent = pad(Math.floor((remaining % 3600000) / 60000));
          nodes.seconds.textContent = pad(Math.floor((remaining % 60000) / 1000));
          if (remaining === 0) {
            window.location.replace("/");
            return;
          }
          window.setTimeout(tick, 1000);
        }
        tick();
      }());
    </script>
  </body>
</html>`;
}
