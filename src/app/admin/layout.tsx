import type { ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";

import { requireModeratorProfile } from "@/lib/auth";
import { AdminNav } from "@/app/admin/admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireModeratorProfile();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "auth.unauthorized") {
        redirect("/sign-in");
      }
      if (err.message === "auth.forbidden" || err.message === "auth.profile_missing") {
        forbidden();
      }
    }
    throw err;
  }

  return (
    <div className="flex min-h-screen w-full">
      <AdminNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
