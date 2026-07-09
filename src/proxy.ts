// Next.js 16 renamed middleware -> proxy. This must sit at src/proxy.ts (same
// level as src/app). Export a named `proxy` handler; Next wraps it with its
// adapter. authkitProxy provides WorkOS session management so withAuth() works.
import { NextRequest, NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import "@/lib/workos-env";
import { authkitProxy } from "@workos-inc/authkit-nextjs";
import { resolveWorkosRedirectUri } from "@/lib/workos-redirect";
import { contentSecurityPolicy } from "@/lib/csp";
import { deriveRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";

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

  const requestId = deriveRequestId(request.headers);
  // Per-request nonce so script-src drops 'unsafe-inline'. Next parses the CSP
  // from the *request* header and stamps the nonce onto its own <script> tags
  // during SSR, so it must be present on the request authkit forwards to render.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set("Content-Security-Policy", csp);

  // authkitProxy rebuilds forwarded request headers from `request.headers`
  // (partitionAuthkitHeaders), so the clone carries x-nonce/x-request-id into
  // render. Cookies and nextUrl survive because input is a Request instance.
  const authRequest = new NextRequest(request, { headers: requestHeaders });

  const handler = authkitProxy({
    redirectUri: resolveWorkosRedirectUri(request.url),
  });
  const response = (await handler(authRequest, event)) ?? NextResponse.next();

  // Response CSP is not in authkit's forward allowlist, so set it here for the
  // browser (redirect or next alike). X-Request-ID surfaces the id to the LB.
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(REQUEST_ID_HEADER, requestId);

  // Dynamic detail routes stream (a loading.tsx Suspense boundary commits HTTP
  // 200 before the page's notFound() runs), so a missing dog/race/track/custom
  // page returns 200 + not-found UI, which search engines can index as a soft
  // 404. Do a fast existence check here — before render, where the status can
  // still be set — and rewrite misses to an unmatched path so Next serves the
  // branded not-found UI with a real 404. Runs anonymously; RLS enforces the
  // same public visibility the pages use (published, non-removed custom pages).
  if (await isMissingDetailResource(request.nextUrl.pathname)) {
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

// Public detail routes that call notFound() on a missing record. The existence
// check runs anonymously; RLS scopes each read to what a public visitor sees, so
// it matches the page's own visibility (the /p page only serves published pages).
// Listings/marketplace are excluded: their visibility is viewer-dependent.
const DETAIL_ROUTE = /^\/(dogs|races|tracks|p)\/([^/]+)\/?$/;

async function isMissingDetailResource(pathname: string): Promise<boolean> {
  const match = DETAIL_ROUTE.exec(pathname);
  if (!match) return false;
  const [, kind, rawParam] = match;

  try {
    const param = decodeURIComponent(rawParam);
    // Load Prisma lazily so it stays off the request path for non-detail routes.
    const { prisma } = await import("@/lib/db");
    switch (kind) {
      case "dogs":
        return (await prisma.dog.count({ where: { id: param } })) === 0;
      case "races":
        return (await prisma.race.count({ where: { id: param } })) === 0;
      case "tracks":
        return (await prisma.track.count({ where: { id: param } })) === 0;
      case "p":
        return (await prisma.customPage.count({ where: { handle: param } })) === 0;
      default:
        return false;
    }
  } catch {
    // On a DB/connection error, don't block the page — let it render and handle
    // the miss itself (falls back to today's streamed not-found behavior).
    return false;
  }
}

// Match all routes except Next static assets and public images, which must not
// be intercepted (breaks CSS/fonts/images, esp. with Tailwind v4).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|images/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|webmanifest)).*)"],
};
