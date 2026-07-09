"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { LogOut, MapPin, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navLinks = [
  { href: "/artists", label: "Artists" },
  { href: "/map", label: "Map" },
] as const

function getUserInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return "?"
}

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  // In dev auth bypass mode, NextAuth has no session — show a fallback dev user.
  // The navbar only renders inside the (app) layout (authenticated routes),
  // so an unauthenticated status here means we're bypassing auth.
  const user =
    session?.user ??
    (status === "unauthenticated"
      ? { name: "Dev User", email: "dev@travelink.app", image: null }
      : null)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
      <nav
        className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6"
        aria-label="Main"
      >
        {/* ── Brand ── */}
        <Link
          href="/artists"
          className="mr-2 flex items-baseline gap-0 select-none"
        >
          <span className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:text-foreground">
            Travel
          </span>
          <span className="text-sm font-medium uppercase tracking-[0.25em] text-amber-500">
            ink
          </span>
        </Link>

        {/* ── Nav links ── */}
        <div className="flex items-center gap-1" role="navigation">
          {navLinks.map(({ href, label }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`)

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative px-3 py-1.5 text-sm font-medium transition-colors rounded-md",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {label}

                {/* Active indicator — warm amber bar */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-1 -bottom-[calc(0.5rem+1px)] h-0.5 rounded-full bg-amber-500"
                  />
                )}
              </Link>
            )
          })}
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── User menu ── */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Avatar size="default" className="cursor-pointer transition-opacity hover:opacity-80">
              {user?.image && (
                <AvatarImage
                  src={user.image}
                  alt={user.name ?? "User avatar"}
                />
              )}
              <AvatarFallback className="bg-amber-500/15 text-amber-500 text-xs font-semibold">
                {getUserInitials(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            {/* User identity */}
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                {user?.name && (
                  <span className="text-sm font-medium text-foreground truncate">
                    {user.name}
                  </span>
                )}
                {user?.email && (
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </span>
                )}
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  )
}
