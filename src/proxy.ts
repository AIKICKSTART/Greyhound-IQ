// Next.js 16 renamed middleware -> proxy. This must sit at src/proxy.ts (same
// level as src/app). Export a named `proxy` handler; Next wraps it with its
// adapter. authkitProxy provides WorkOS session management so withAuth() works.
import { NextRequest, NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import "@/lib/workos-env";
import {
  authkit,
  authkitProxy,
  handleAuthkitHeaders,
} from "@workos-inc/authkit-nextjs";
import {
  resolveWorkosBaseUrl,
  resolveWorkosRedirectUri,
} from "@/lib/workos-redirect";
import { contentSecurityPolicy } from "@/lib/csp";
import { applyAuthRedirectContract } from "@/lib/auth-redirect-contract";
import { createRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";
import {
  hasUnsupportedApiBodyContentType,
  hasEncodedPathSeparator,
  hasInvalidApiPathSegment,
  isBrowserCorsPreflight,
  isCrossOriginBrowserMutation,
  isUnsupportedHttpMethod,
  shouldDisableSharedApiCaching,
} from "@/lib/request-security";
import {
  DEMO_SUPPRESS_OVERLAYS_HEADER,
  isDemoOverlayRequest,
  isDemoReadMethod,
  isFullAccessDemo,
} from "@/lib/demo-access";
import { isEmergencyControlActive } from "@/lib/emergency-controls";
import {
  isMaintenanceBypassPath,
  maintenanceModeResponse,
} from "@/lib/maintenance-mode";
import {
  isLaunchGateBypassPath,
  LAUNCH_PREVIEW_COOKIE,
  launchGateResponse,
  resolveLaunchGateState,
  verifyLaunchPreviewToken,
} from "@/lib/launch-gate";

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // Cloud Run terminates TLS and forwards the client scheme + public host here.
  // Only redirect http->https when there is a REAL external forwarded host: Next
  // sets x-forwarded-proto:http on every local request (dev and `next start`),
  // so gating on the proto alone 308s localhost/CI to a dead https://localhost.
  // Requiring a non-localhost x-forwarded-host means only genuine edge traffic
  // (behind the Cloud Run LB) is upgraded.
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalForwardHost =
    !forwardedHost || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(forwardedHost);
  if (forwardedProto === "http" && !isLocalForwardHost) {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = "https:";
    httpsUrl.host = forwardedHost!;
    return NextResponse.redirect(httpsUrl, 308);
  }

  // Never let a caller choose an ID that will be trusted for GreyhoundIQ log
  // correlation. Trace propagation remains separate in the application logger.
  const requestId = createRequestId();
  // Per-request nonce so script-src drops 'unsafe-inline'. Next parses the CSP
  // from the *request* header and stamps the nonce onto its own <script> tags
  // during SSR, so it must be present on the request authkit forwards to render.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  const demo = isFullAccessDemo();
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set("Content-Security-Policy", csp);
  if (
    demo &&
    isDemoOverlayRequest(
      request.headers.get("sec-fetch-dest"),
      request.nextUrl.searchParams.get("view")
    )
  ) {
    requestHeaders.set(DEMO_SUPPRESS_OVERLAYS_HEADER, "1");
  }

  if (hasEncodedPathSeparator(request.url)) {
    return securedErrorResponse(400, "request.invalid_path", csp, requestId);
  }
  if (hasInvalidApiPathSegment(request.nextUrl.pathname)) {
    return securedErrorResponse(400, "request.invalid_identifier", csp, requestId);
  }
  if (isUnsupportedHttpMethod(request)) {
    const response = securedErrorResponse(
      405,
      "request.method_not_allowed",
      csp,
      requestId
    );
    response.headers.set("Allow", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
    return response;
  }
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    isBrowserCorsPreflight(request)
  ) {
    return securedErrorResponse(403, "cors.not_allowed", csp, requestId);
  }
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    hasUnsupportedApiBodyContentType(request)
  ) {
    return securedErrorResponse(
      415,
      "request.unsupported_media_type",
      csp,
      requestId
    );
  }
  if (
    isCrossOriginBrowserMutation(
      request,
      resolveWorkosBaseUrl(request.url)
    )
  ) {
    return securedErrorResponse(403, "auth.forbidden", csp, requestId);
  }

  if (
    isEmergencyControlActive(process.env.MAINTENANCE_MODE) &&
    !isMaintenanceBypassPath(request.nextUrl.pathname)
  ) {
    const response = maintenanceModeResponse(request);
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  // authkitProxy rebuilds forwarded request headers from `request.headers`
  // (partitionAuthkitHeaders), so the clone carries x-nonce/x-request-id into
  // render. Cookies and nextUrl survive because input is a Request instance.
  const authRequest = new NextRequest(request, { headers: requestHeaders });
  const launchGate = resolveLaunchGateState();
  let launchAuthkitHeaders: Headers | null = null;
  if (launchGate.active && !isLaunchGateBypassPath(request.nextUrl.pathname)) {
    const preview = verifyLaunchPreviewToken(
      request.cookies.get(LAUNCH_PREVIEW_COOKIE)?.value,
      process.env.LAUNCH_PREVIEW_SECRET,
      launchGate.launchAt,
    );
    const gatedResponse = () => {
      const response = launchGateResponse(request, launchGate, nonce);
      response.headers.set("Content-Security-Policy", csp);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    };
    if (!preview) return gatedResponse();

    const previewAuth = await authkit(authRequest, {
      redirectUri: resolveWorkosRedirectUri(request.url),
    });
    if (
      previewAuth.session.user?.email.trim().toLowerCase() !== preview.email
    ) {
      return gatedResponse();
    }
    launchAuthkitHeaders = previewAuth.headers;
  }

  if (demo && !isDemoReadMethod(request.method)) {
    return securedErrorResponse(403, "demo.read_only", csp, requestId);
  }

  const response = demo
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : launchAuthkitHeaders
      ? handleAuthkitHeaders(authRequest, launchAuthkitHeaders)
      : ((await authkitProxy({
          redirectUri: resolveWorkosRedirectUri(request.url),
        })(authRequest, event)) ?? NextResponse.next());

  if (
    ["/callback", "/sign-in"].includes(request.nextUrl.pathname) &&
    !applyAuthRedirectContract(
      response,
      resolveWorkosBaseUrl(request.url) ?? new URL(request.url).origin
    )
  ) {
    return securedErrorResponse(
      502,
      "auth.redirect_contract_invalid",
      csp,
      requestId
    );
  }

  // Response CSP is not in authkit's forward allowlist, so set it here for the
  // browser (redirect or next alike). X-Request-ID surfaces the id to the LB.
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  if (demo) response.headers.set("X-GreyhoundIQ-Demo", "full-access-read-only");
  if (shouldDisableSharedApiCaching(request, request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-store");
    appendVary(response.headers, "Cookie");
    appendVary(response.headers, "Authorization");
  }

  // Dynamic detail routes stream (a loading.tsx Suspense boundary commits HTTP
  // 200 before the page's notFound() runs), so missing public records otherwise
  // become indexable soft 404s. Check public existence before rendering and
  // rewrite misses to an unmatched path so Next returns its branded real 404.
  const sessionCookieName = process.env.WORKOS_COOKIE_NAME || "wos-session";
  if (
    await isMissingDetailResource(
      request.nextUrl.pathname,
      request.cookies.has(sessionCookieName)
    )
  ) {
    const rw = NextResponse.rewrite(new URL("/_not-found-404", request.url), {
      request: { headers: requestHeaders },
    });
    // Carry the per-request security headers (CSP nonce, request id) already
    // set on `response` above so the 404 has the same protections as any page.
    response.headers.forEach((value, key) => rw.headers.set(key, value));
    return rw;
  }

  // Keep auth-gated / app-shell areas out of the search index (they carry no
  // public search value). Public data pages are not listed here.
  const path = request.nextUrl.pathname;
  const noindex = [
    "/account",
    "/admin",
    "/messages",
    "/feed",
    "/pulse",
    "/marketplace/new",
    "/listings/new",
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (noindex) response.headers.set("X-Robots-Tag", "noindex, follow");

  return response;
}

function securedErrorResponse(
  status: number,
  error: string,
  csp: string,
  requestId: string
) {
  const response = NextResponse.json({ error }, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

function appendVary(headers: Headers, field: string) {
  const fields = new Set(
    (headers.get("Vary") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  fields.add(field);
  headers.set("Vary", [...fields].join(", "));
}

// Detail routes that call notFound() on a missing record. Public lookups happen
// before rendering so streamed pages retain a real HTTP 404 status.
const DETAIL_ROUTE =
  /^\/(dogs|races|tracks|p|forum|groups|listings|marketplace)\/([^/]+)\/?$/;
const FORUM_THREAD_ROUTE = /^\/(forum|groups)\/threads\/([^/]+)\/?$/;
const NON_LISTING_DETAIL_SEGMENTS = new Set(["new", "design-lab"]);

async function isMissingDetailResource(
  pathname: string,
  hasAuthenticatedSession: boolean
): Promise<boolean> {
  const threadMatch = FORUM_THREAD_ROUTE.exec(pathname);
  const match = threadMatch ?? DETAIL_ROUTE.exec(pathname);
  if (!match) return false;
  const [, routeKind, rawParam] = match;
  const kind = threadMatch ? "forum-thread" : routeKind;

  try {
    const param = decodeURIComponent(rawParam);
    // Load Prisma lazily so it stays off the request path for non-detail routes.
    const { prisma } = await import("@/lib/db");
    switch (kind) {
      case "dogs": {
        const { resolveDemoProviderRouteId } = await import(
          "@/lib/demo-route-samples"
        );
        const id = await resolveDemoProviderRouteId("dog", param);
        return (await prisma.dog.count({ where: { id } })) === 0;
      }
      case "races": {
        const { resolveDemoProviderRouteId } = await import(
          "@/lib/demo-route-samples"
        );
        const id = await resolveDemoProviderRouteId("race", param);
        return (await prisma.race.count({ where: { id } })) === 0;
      }
      case "tracks": {
        const { resolveDemoProviderRouteId } = await import(
          "@/lib/demo-route-samples"
        );
        const id = await resolveDemoProviderRouteId("track", param);
        return (await prisma.track.count({ where: { id } })) === 0;
      }
      case "p": {
        const [personalActorCount, customPageCount] = await Promise.all([
          prisma.socialActor.count({
            where: { handle: param, kind: "personal", published: true },
          }),
          prisma.customPage.count({ where: { handle: param } }),
        ]);
        return personalActorCount + customPageCount === 0;
      }
      case "forum":
      case "groups":
        return (
          (await prisma.forumCategory.count({ where: { slug: param } })) === 0
        );
      case "forum-thread":
        return (await prisma.thread.count({ where: { id: param } })) === 0;
      case "listings":
      case "marketplace":
        if (
          hasAuthenticatedSession ||
          NON_LISTING_DETAIL_SEGMENTS.has(param)
        ) {
          return false;
        }
        return (
          (await prisma.listing.count({
            where: {
              id: param,
              status: "active",
              moderationStatus: "approved",
              archivedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          })) === 0
        );
      default:
        return false;
    }
  } catch {
    // On a DB/connection error, don't block the page — let it render and handle
    // the miss itself (falls back to today's streamed not-found behavior).
    return false;
  }
}

// Match all routes except known static asset roots/files. Do not exclude by
// extension: malformed encoded paths can masquerade as an image and bypass
// request validation before Next rejects them with an unsecured 500.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images/|fonts/|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest).*)",
  ],
};
