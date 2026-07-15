"use client";

import { CheckCircle2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AdminOperationStatus() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  if (searchParams.get("adminResult") !== "success") return null;

  return (
    <div
      role="status"
      className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.08] px-4 py-3 text-[13px] text-emerald-100 shadow-[0_14px_36px_rgba(0,0,0,0.22)] sm:mx-6 lg:mx-10"
    >
      <CheckCircle2 className="size-5 shrink-0 text-emerald-300" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <strong className="font-semibold">Admin change saved.</strong>{" "}
        The dashboard and audit views have been refreshed.
      </span>
      <button
        type="button"
        aria-label="Dismiss success message"
        className="giq-icon-button giq-button giq-button-carbon min-h-11 min-w-11"
        onClick={() => {
          const next = new URLSearchParams(searchParams.toString());
          next.delete("adminResult");
          const query = next.toString();
          router.replace(query ? `${pathname}?${query}` : pathname, {
            scroll: false,
          });
        }}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
