import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-roles";
import {
  createLaunchPreviewToken,
  isLaunchPreviewEmail,
  LAUNCH_PREVIEW_COOKIE,
  resolveLaunchGateState,
} from "@/lib/launch-gate";
import { resolveWorkosBaseUrl } from "@/lib/workos-redirect";

export async function GET(request: NextRequest) {
  const publicOrigin = resolveWorkosBaseUrl(request.url);
  if (!publicOrigin) {
    return Response.json(
      {
        error: {
          code: "service.public_origin_unavailable",
          message: "Private preview is temporarily unavailable",
        },
      },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const gate = resolveLaunchGateState();
  if (!gate.active) {
    return NextResponse.redirect(new URL("/", publicOrigin), 303);
  }

  const user = await getCurrentUser();
  if (!user) {
    const signIn = new URL("/sign-in", publicOrigin);
    signIn.searchParams.set("returnTo", "/launch-preview");
    return NextResponse.redirect(signIn, 303);
  }

  const allowed =
    !user.isBanned &&
    !user.deletionRequestedAt &&
    (isAdminRole(user.role) || isLaunchPreviewEmail(user.email));
  if (!allowed) {
    return NextResponse.redirect(new URL("/?preview=denied", publicOrigin), 303);
  }

  const secret = process.env.LAUNCH_PREVIEW_SECRET;
  if (!gate.configured || gate.launchAt === null || !secret) {
    return Response.json(
      {
        error: {
          code: "service.launch_preview_unavailable",
          message: "Private preview is temporarily unavailable",
        },
      },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const response = NextResponse.redirect(new URL("/", publicOrigin), 303);
  response.cookies.set({
    name: LAUNCH_PREVIEW_COOKIE,
    value: createLaunchPreviewToken(user.email, secret, gate.launchAt),
    expires: new Date(gate.launchAt),
    httpOnly: true,
    path: "/",
    priority: "high",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
