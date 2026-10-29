import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { DEV_AUTH_BYPASS } from "@/lib/dev-auth"

export async function middleware(request: NextRequest) {
  if (DEV_AUTH_BYPASS) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request })
  if (!token) {
    // The login page sends the user back to this path (query string included) after
    // signing in. Relative, since it only follows paths on its own origin
    const { pathname, search } = request.nextUrl
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/artists/:path*", "/map/:path*", "/admin/:path*"],
}
