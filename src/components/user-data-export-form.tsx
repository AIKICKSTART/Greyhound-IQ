import { Download } from "lucide-react";

export function UserDataExportForm({
  className,
  label = "Data export",
}: {
  className: string;
  label?: string;
}) {
  return (
    <form action="/api/users/me/export" method="post">
      <button type="submit" className={className}>
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}
