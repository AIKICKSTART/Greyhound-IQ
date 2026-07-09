import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAccountSummary } from "@/lib/queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "auth.unauthorized", message: "Not signed in" } },
      { status: 401 }
    );
  }

  const account = user.dbUserId
    ? await getAccountSummary(
        {
          dbUserId: user.dbUserId,
          profileId: user.profileId ?? user.dbUserId,
          profileRole: user.role ?? "member",
          tier: user.tier,
        },
        user.email
      )
    : null;
  return NextResponse.json({
    user,
    profile: account?.profile ?? null,
  });
}
