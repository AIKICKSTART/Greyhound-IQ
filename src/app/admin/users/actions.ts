"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth";
import { withDbSystemContext } from "@/lib/db-context";
import { checkRateLimit } from "@/lib/rate-limit";

const adminUserLookupSchema = z.union([
  z.string().trim().toLowerCase().email().max(254),
  z.string().trim().regex(/^[A-Za-z0-9_-]{1,128}$/),
]);

export async function lookupAdminUserAction(formData: FormData) {
  const current = await requireAdminProfile();
  const limit = await checkRateLimit(
    `admin-user-lookup:${current.dbUserId}`,
    12,
    60_000,
    { failClosed: true },
  );
  if (!limit.allowed) redirect("/admin/users?lookup=rate-limited");

  const parsed = adminUserLookupSchema.safeParse(formData.get("lookup"));
  if (!parsed.success) redirect("/admin/users?lookup=invalid");

  const lookup = parsed.data;
  const user = await withDbSystemContext((tx) =>
    lookup.includes("@")
      ? tx.user.findUnique({
          where: { email: lookup },
          select: { id: true },
        })
      : tx.user.findUnique({
          where: { id: lookup },
          select: { id: true },
        }),
  );
  if (!user) redirect("/admin/users?lookup=not-found");

  redirect(`/admin/users?user=${encodeURIComponent(user.id)}#selected-user`);
}
