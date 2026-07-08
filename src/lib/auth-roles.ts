export function isAdminRole(role: string | null | undefined) {
  return role === "admin";
}

export function isModeratorRole(role: string | null | undefined) {
  return isAdminRole(role) || role === "moderator";
}
