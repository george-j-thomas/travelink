/**
 * Admins are configured with the ADMIN_EMAILS env var (comma-separated), not in
 * the database, so no one can promote themselves through a DB write.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.trim().toLowerCase())
}
