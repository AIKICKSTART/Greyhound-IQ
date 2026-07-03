// Next.js 16 renamed middleware -> proxy. This must sit at src/proxy.ts (same
// level as src/app). Export a named `proxy` handler; Next wraps it with its
// adapter. authkitProxy provides WorkOS session management so withAuth() works.
import type { NextRequest, NextFetchEvent } from "next/server";
import { authkitProxy } from "@workos-inc/authkit-nextjs";
import { resolveWorkosRedirectUri } from "@/lib/workos-redirect";

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const handler = authkitProxy({
    redirectUri: resolveWorkosRedirectUri(request.url),
  });

  return handler(request, event);
}

// Match all routes except Next static assets and public images, which must not
// be intercepted (breaks CSS/fonts/images, esp. with Tailwind v4).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|images/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|webmanifest)).*)"],
};
