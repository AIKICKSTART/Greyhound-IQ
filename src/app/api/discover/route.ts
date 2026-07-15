import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { getCurrentUser } from "@/lib/auth";
import {
  directorySearchQuerySchema,
  queryParamsObject,
} from "@/lib/query-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { discoverSocialActorsAndDogs } from "@/lib/social-discovery";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const clientIp = getClientIp(request.headers);
    const rateLimitKey = user?.dbUserId
      ? `discover:user:${user.dbUserId}`
      : `discover:ip:${clientIp || "missing-forwarded-for"}`;
    const rate = await checkRateLimit(
      rateLimitKey,
      user?.dbUserId || clientIp ? 60 : 10,
      60 * 1000
    );
    if (!rate.allowed) {
      return rateLimitExceededResponse(
        rate,
        user?.dbUserId || clientIp ? 60 : 10,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }
    const current = user?.dbUserId && user.profileId
      ? {
          ...user,
          dbUserId: user.dbUserId,
          profileId: user.profileId,
          displayName: user.name,
          profileRole: user.role ?? "member",
          verified: false,
        }
      : null;
    const query = directorySearchQuerySchema.parse(
      queryParamsObject(request.nextUrl.searchParams),
    );
    const result = await discoverSocialActorsAndDogs(
      query.q,
      current
    );
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
  } catch (err) {
    return jsonError(err, "Could not search discovery");
  }
}
