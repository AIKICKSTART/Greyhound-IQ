"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUserProfile } from "@/lib/auth";
import { withDbRequestContext } from "@/lib/db-context";
import { isFullAccessDemo } from "@/lib/demo-access";
import { messengerLayoutSchema } from "@/lib/messenger-layout";

export async function updateMessengerLayoutPreference(formData: FormData) {
  if (isFullAccessDemo()) throw new Error("demo.read_only");

  const current = await requireCurrentUserProfile();
  const parsed = messengerLayoutSchema.safeParse(
    formData.get("messengerLayout")
  );
  if (!parsed.success) redirect("/account/profile#messenger-layout-error");

  const result = await withDbRequestContext(current, (tx) =>
    tx.profile.updateMany({
      where: {
        id: current.profileId,
        userId: current.dbUserId,
      },
      data: { messengerLayout: parsed.data },
    })
  );
  if (result.count !== 1) throw new Error("auth.forbidden");

  revalidatePath("/", "layout");
  revalidatePath("/account/profile");
  revalidatePath("/pulse");
  redirect("/account/profile#messenger-layout-updated");
}
