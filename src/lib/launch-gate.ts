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
        message: "Greyhounds IQ opens at 5:00 PM AEST on 25 July 2026",
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
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Greyhounds IQ preview</title></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#08050b;color:#fff;font-family:system-ui,sans-serif;padding:24px">
    <main><h1>Greyhounds IQ private preview is being configured.</h1><p>Please try again shortly.</p></main>
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
    <title>Greyhounds IQ launches 25 July</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; min-height: 100svh; overflow: hidden; background: #030303; color: #fff; }
      .backdrop, .backdrop img, .atmosphere { position: fixed; inset: 0; width: 100%; height: 100%; }
      .backdrop img { object-fit: cover; object-position: left center; filter: saturate(.92) contrast(1.04); }
      .atmosphere { background: linear-gradient(180deg, rgba(0,0,0,.08) 38%, rgba(0,0,0,.48) 70%, rgba(0,0,0,.94) 100%), radial-gradient(circle at 50% 54%, transparent 34%, rgba(0,0,0,.34) 100%); }
      main { position: relative; z-index: 1; width: 100%; min-height: 100vh; min-height: 100svh; display: flex; align-items: flex-end; justify-content: center; padding: 28px clamp(16px, 3vw, 44px) clamp(24px, 4vh, 44px); text-align: center; }
      .launch-panel { position: relative; width: min(920px, 100%); padding: 22px clamp(18px, 3vw, 34px) 20px; overflow: hidden; border: 1px solid rgba(207,150,49,.48); border-radius: 20px; background-color: rgba(2,2,3,.97); background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.028) 0 2px, transparent 2px 6px), repeating-linear-gradient(45deg, rgba(120,61,151,.032) 0 2px, transparent 2px 6px), linear-gradient(155deg, rgba(17,17,20,.98), rgba(1,1,2,.99) 62%, rgba(7,5,8,.99)); background-size: 8px 8px, 8px 8px, 100% 100%; box-shadow: inset 0 1px rgba(255,255,255,.09), inset 0 -1px rgba(112,52,173,.34), inset 0 0 42px rgba(0,0,0,.72), 0 28px 80px rgba(0,0,0,.82), 0 0 34px rgba(112,35,179,.12); backdrop-filter: blur(18px); }
      .launch-panel::before { content: ""; position: absolute; inset: 0 12%; height: 2px; background: linear-gradient(90deg, transparent, #f2aa29 32%, #fff0a8 50%, #9f43e8 72%, transparent); box-shadow: 0 0 18px rgba(239,163,35,.65); }
      .eyebrow { display: flex; align-items: center; justify-content: center; gap: 10px; color: #cfa858; font-size: 10px; font-weight: 850; letter-spacing: .32em; text-transform: uppercase; }
      .eyebrow::before, .eyebrow::after { content: ""; width: 42px; height: 1px; background: linear-gradient(90deg, transparent, #a76517); }
      .eyebrow::after { background: linear-gradient(90deg, #8b36d5, transparent); }
      h1 { margin: 7px 0 0; font-size: clamp(24px, 3.2vw, 38px); line-height: 1; letter-spacing: -.025em; text-transform: uppercase; }
      .lead { margin: 7px auto 0; color: #a89fad; font-size: 11px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; }
      .countdown { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 18px; }
      .unit { position: relative; padding: 15px 8px 12px; overflow: hidden; border: 1px solid rgba(139,61,204,.48); border-radius: 12px; background-color: #030304; background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.022) 0 1px, transparent 1px 5px), repeating-linear-gradient(45deg, rgba(124,58,160,.025) 0 1px, transparent 1px 5px), linear-gradient(145deg, #111114, #020203 72%); background-size: 7px 7px, 7px 7px, 100% 100%; box-shadow: inset 0 1px rgba(255,255,255,.08), inset 0 -14px 26px rgba(0,0,0,.62), 0 8px 22px rgba(0,0,0,.46); }
      .unit::before { content: ""; position: absolute; top: 0; left: 22%; right: 22%; height: 2px; background: linear-gradient(90deg, transparent, #dda033, transparent); box-shadow: 0 0 10px rgba(238,164,42,.75); }
      .value { display: block; color: #fff; font-variant-numeric: tabular-nums; font-size: clamp(34px, 5vw, 52px); font-weight: 900; line-height: .9; letter-spacing: -.04em; text-shadow: 0 2px 0 #4b3b1c, 0 0 22px rgba(173,76,241,.28); }
      .label { display: block; margin-top: 9px; color: #c59b45; font-size: 8px; font-weight: 850; letter-spacing: .24em; text-transform: uppercase; }
      .launch-time { margin: 14px 0 0; color: #f5c866; font-size: 11px; font-weight: 850; letter-spacing: .13em; text-transform: uppercase; }
      .preview { position: fixed; z-index: 3; top: 16px; right: 18px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
      .preview a { display: inline-flex; min-height: 34px; align-items: center; justify-content: center; padding: 0 12px; border: 1px solid rgba(199,171,107,.24); border-radius: 8px; background: rgba(4,4,5,.48); color: rgba(255,255,255,.58); font-size: 9px; font-weight: 750; letter-spacing: .11em; text-decoration: none; text-transform: uppercase; backdrop-filter: blur(9px); transition: color .15s ease, border-color .15s ease, background .15s ease; }
      .preview a:hover, .preview a:focus-visible { border-color: rgba(221,171,65,.72); background: rgba(9,9,11,.86); color: #fff; outline: none; }
      .denied { max-width: 280px; margin: 0; padding: 9px 11px; border: 1px solid rgba(255,118,146,.4); border-radius: 8px; background: rgba(55,7,18,.88); color: #ffdce4; font-size: 11px; }
      @media (max-width: 640px) {
        .backdrop img { object-fit: contain; object-position: center top; background: #020203; }
        .atmosphere { background: linear-gradient(180deg, rgba(0,0,0,.16), rgba(0,0,0,.06) 40%, rgba(0,0,0,.78) 68%, #020203 100%); }
        main { padding: 116px 10px 14px; }
        .launch-panel { padding: 17px 9px 14px; border-radius: 15px; }
        .eyebrow { font-size: 8px; letter-spacing: .22em; }
        .eyebrow::before, .eyebrow::after { width: 24px; }
        h1 { margin-top: 6px; font-size: clamp(21px, 7vw, 28px); }
        .lead { font-size: 8px; letter-spacing: .15em; }
        .countdown { gap: 5px; margin-top: 14px; }
        .unit { padding: 13px 2px 10px; border-radius: 9px; }
        .value { font-size: clamp(28px, 10vw, 39px); }
        .label { margin-top: 7px; font-size: 6px; letter-spacing: .12em; }
        .launch-time { margin-top: 11px; font-size: 8px; letter-spacing: .08em; }
        .preview { top: 9px; right: 9px; }
        .preview a { min-height: 30px; padding: 0 9px; background: rgba(4,4,5,.86); font-size: 8px; opacity: .82; }
      }
    </style>
  </head>
  <body>
    <picture class="backdrop" aria-hidden="true">
      <source media="(max-width: 640px)" type="image/avif" srcset="/images/launch-panther-mobile-20260724.avif">
      <source media="(max-width: 640px)" type="image/webp" srcset="/images/launch-panther-mobile-20260724.webp">
      <source type="image/avif" srcset="/images/launch-panther-20260724.avif">
      <img src="/images/launch-panther-20260724.webp" alt="" width="1672" height="941" fetchpriority="high" decoding="async">
    </picture>
    <div class="atmosphere"></div>
    <div class="preview">
      <a href="/launch-preview">Admin preview</a>
      ${deniedMessage}
    </div>
    <main>
      <section class="launch-panel" aria-labelledby="launch-title">
        <div class="eyebrow">Launch sequence</div>
        <h1 id="launch-title">Greyhounds IQ goes live</h1>
        <p class="lead">Data · Intelligence · Edge</p>
        <div class="countdown" aria-label="Time until Greyhounds IQ launches">
          <div class="unit"><span class="value" data-days>${initial.days}</span><span class="label">Days</span></div>
          <div class="unit"><span class="value" data-hours>${initial.hours.toString().padStart(2, "0")}</span><span class="label">Hours</span></div>
          <div class="unit"><span class="value" data-minutes>${initial.minutes.toString().padStart(2, "0")}</span><span class="label">Minutes</span></div>
          <div class="unit"><span class="value" data-seconds>${initial.seconds.toString().padStart(2, "0")}</span><span class="label">Seconds</span></div>
        </div>
        <p class="launch-time"><time datetime="2026-07-25T17:00:00+10:00">5:00 PM AEST · Saturday 25 July 2026</time></p>
        <noscript><p class="lead">Refresh this page after 5:00 PM AEST to enter Greyhounds IQ.</p></noscript>
      </section>
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
