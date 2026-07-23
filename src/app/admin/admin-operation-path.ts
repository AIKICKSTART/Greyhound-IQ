export function safeAdminPath(path: string | undefined) {
  if (!path) return "/admin";
  try {
    const pathname = new URL(path, "https://admin.greyhoundiq.local").pathname;
    return pathname === "/admin" || pathname.startsWith("/admin/")
      ? pathname
      : "/admin";
  } catch {
    return "/admin";
  }
}
