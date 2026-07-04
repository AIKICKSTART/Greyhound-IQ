export function isModeratorRole(role: string | null | undefined) {
  return role === "admin" || role === "moderator";
}
