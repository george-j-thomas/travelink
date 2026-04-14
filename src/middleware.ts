export { default } from "next-auth/middleware"

export const config = {
  matcher: ["/artists/:path*", "/map/:path*"],
}
