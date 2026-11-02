import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/artists/handles — The handles on the current user's list, with their
// artist IDs, for the browser extension's "✓ On your list". The extension
// fetches the whole list and matches profiles itself, so travel-ink never learns
// which Instagram profiles the user opens. DB only.
export async function GET() {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const userArtists = await prisma.userArtist.findMany({
      where: { userId: session.user.id },
      select: { artistId: true, artist: { select: { instagramHandle: true } } },
    })
    return NextResponse.json({
      artists: userArtists.map((ua) => ({ handle: ua.artist.instagramHandle, artistId: ua.artistId })),
    })
  } catch (err) {
    console.error("GET /api/artists/handles failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
