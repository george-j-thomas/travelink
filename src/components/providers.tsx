"use client"

import { SessionProvider } from "next-auth/react"
import { DevUserIdContext } from "@/hooks/use-current-user-id"
import { useInstagramCookieGuard } from "@/hooks/use-instagram-cookie"

function InstagramCookieGuard() {
  useInstagramCookieGuard()
  return null
}

export function Providers({
  children,
  devUserId,
}: {
  children: React.ReactNode
  devUserId: string | null
}) {
  return (
    <SessionProvider>
      <DevUserIdContext value={devUserId}>
        <InstagramCookieGuard />
        {children}
      </DevUserIdContext>
    </SessionProvider>
  )
}
