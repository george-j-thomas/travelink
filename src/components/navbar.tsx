"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { LogOut, MapPin, ShieldCheck, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { BrandMark } from "@/components/brand/marks"
import { MetalCanvas } from "@/components/metal/metal-canvas"
import { SpikeStar } from "@/components/metal/ornaments"
import { Button } from "@/components/ui/button"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
      ? { name: "Dev User", email: "dev@travelink.app", image: null, isAdmin: true }
      : null)

  return (
    <header className="metal-bar sticky top-0 z-40 w-full">
      {/* Moving sheen across the gunmetal */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-sheen opacity-60" />
      <nav
        className="relative mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6"
        aria-label="Main"
      >
        {/* ── Brand: live chrome emblem + wordmark ── */}
        <Link href="/artists" aria-label="Travelink home" className="mr-4 flex items-center gap-0.5">
          <MetalCanvas
            scene="emblem"
            className="-my-2 -ml-3 size-12"
            fallback={<SpikeStar className="m-2.5 size-7" points={10} seed={5} />}
          />
          <BrandMark />
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
                  "relative flex items-center gap-2 rounded-full px-3.5 py-1.5 font-wide text-[0.68rem] font-bold uppercase tracking-[0.12em] transition-colors",
                  isActive
                    ? "btn-gunmetal"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active indicator: a lit diode */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-brand-300 shadow-[0_0_6px_2px_rgb(39_200_161/0.7)]"
                  />
                )}
                {label}
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
            <span className="relative block rounded-full p-[3px]">
              <span aria-hidden="true" className="chrome-ring absolute inset-0 [--ring-w:2px]" />
              <Avatar size="default" className="cursor-pointer transition-opacity hover:opacity-80">
                {user?.image && (
                  <AvatarImage
                    src={user.image}
                    alt={user.name ?? "User avatar"}
                  />
                )}
                <AvatarFallback className="bg-[radial-gradient(circle_at_35%_30%,#3a444b,#14181b_80%)] text-gun-100 text-xs font-semibold">
                  {getUserInitials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            {/* User identity — Base UI requires GroupLabel inside a Group */}
            <DropdownMenuGroup>
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
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {user?.isAdmin && (
              <DropdownMenuItem render={<Link href="/admin" />}>
                <ShieldCheck className="mr-2 size-4" />
                Admin
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <span aria-hidden="true" className="flow-line pointer-events-none absolute inset-x-0 bottom-0 h-0.5" />
    </header>
  )
}
