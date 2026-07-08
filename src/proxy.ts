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
  return response;
}

// Match all routes except Next static assets and public images, which must not
// be intercepted (breaks CSS/fonts/images, esp. with Tailwind v4).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|images/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|webmanifest)).*)"],
};
