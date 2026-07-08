import type { ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";

import { requireModeratorProfile } from "@/lib/auth";

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

  return children;
}
