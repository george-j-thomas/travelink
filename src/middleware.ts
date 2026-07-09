import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  if (process.env.DEV_AUTH_BYPASS === "true") {
    return NextResponse.next()
  }

  const token = await getToken({ req: request })
  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/artists/:path*", "/map/:path*"],
}
