"use client";

import { Download } from "lucide-react";
import { type FormEvent, useState } from "react";

type ExportStatus = "idle" | "pending" | "success" | "error";

export function UserDataExportForm({
  className,
  label = "Data export",
}: {
  className: string;
  label?: string;
}) {
  const [status, setStatus] = useState<ExportStatus>("idle");

  async function downloadExport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "pending") return;

    setStatus("pending");
    try {
      const response = await fetch("/api/users/me/export", {
        method: "POST",
      });
      if (!response.ok) throw new Error("account.export_failed");

      const objectUrl = URL.createObjectURL(await response.blob());
      const download = document.createElement("a");
      download.href = objectUrl;
      download.download = "greyhoundiq-data-export.json";
      document.body.append(download);
      download.click();
      download.remove();
      URL.revokeObjectURL(objectUrl);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={downloadExport} className="grid gap-2">
      <button
        type="submit"
        className={className}
        disabled={status === "pending"}
        aria-busy={status === "pending"}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        {status === "pending" ? "Preparing export..." : label}
      </button>
      {status !== "idle" ? (
        <p
          role={status === "error" ? "alert" : "status"}
          aria-live={status === "error" ? "assertive" : "polite"}
          className="text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]"
        >
          {status === "pending"
            ? "Preparing your data archive."
            : status === "success"
              ? "Data export downloaded."
              : "Data export could not be prepared. Try again."}
        </p>
      ) : null}
    </form>
  );
}
