// Search over artists already in travel-ink, for the Add page: matches on the
// user's own list, then the "directory" of artists other users have added.
// Database only, no external calls.

import type { Prisma } from "@prisma/client"
import { ARTIST_DTO_INCLUDE, avatarPath, profilePicUrlFor } from "@/lib/artist-dto"
import { prisma } from "@/lib/db"

/**
 * Artists any signed-in user can find in search and see the stored photo of:
 * public Business/Creator accounts (Instagram shows their profiles to anyone)
 * that someone still tracks. Not `fetchStatus: "fetched"`: early imports
 * stored fetched rows for personal, possibly private, accounts too.
 */
export const DIRECTORY_ARTIST_WHERE = {
  accountType: { in: ["business", "creator"] },
  users: { some: {} },
} satisfies Prisma.ArtistWhereInput

export const DIRECTORY_QUERY_MIN_LENGTH = 2
export const DIRECTORY_QUERY_MAX_LENGTH = 60

const MAX_RESULTS = 10
// Own matches shown even when the directory could fill the list
const MIN_OWN_RESULTS = 5
const HANDLE_CANDIDATES = 10
const NAME_CANDIDATES = 20
const HANDLE_CHARS = /^[a-z0-9._]+$/

// Like ARTIST_DTO_INCLUDE (the photo's version, never its bytes), minus bios and other locations
const SEARCH_SELECT = {
  id: true,
  instagramHandle: true,
  displayName: true,
  profilePicUrl: true,
  avatar: ARTIST_DTO_INCLUDE.avatar,
  locations: { where: { isPrimary: true }, select: { city: true, country: true }, take: 1 },
} satisfies Prisma.ArtistSelect

type SearchRow = Prisma.ArtistGetPayload<{ select: typeof SEARCH_SELECT }>

export interface DirectoryArtist {
  id: string
  instagramHandle: string
  displayName: string | null
  profilePicUrl: string | null
  /** Primary location */
  city: string | null
  country: string | null
  /** Already on the searching user's list */
  onList: boolean
}

/** Lowercase, without a leading `@` or repeated spaces. Check the length limits after this. */
export function normalizeDirectoryQuery(raw: string): string {
  return raw.trim().replace(/^@+/, "").replace(/\s+/g, " ").trim().toLowerCase()
}

/** Matches on the user's list first, then other users' artists; at most 10 in all. */
export async function searchArtistDirectory(userId: string, query: string): Promise<DirectoryArtist[]> {
  const [own, others] = await Promise.all([
    findMatches({ users: { some: { userId } } }, query),
    findMatches({ AND: [DIRECTORY_ARTIST_WHERE, { users: { none: { userId } } }] }, query),
  ])

  const ownCount = Math.min(own.length, Math.max(MIN_OWN_RESULTS, MAX_RESULTS - others.length))
  return [
    ...own.slice(0, ownCount).map((row) => toResult(row, true)),
    ...others.slice(0, MAX_RESULTS - ownCount).map((row) => toResult(row, false)),
  ]
}

// Prisma passes `%` and `_` through to LIKE as wildcards
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&")
}

async function findMatches(scope: Prisma.ArtistWhereInput, query: string): Promise<SearchRow[]> {
  const q = escapeLike(query)
  const handleLike = HANDLE_CHARS.test(query)

  // Name words, and (for handle-like queries) handle parts after a `.` or `_`
  const wordMatches: Prisma.ArtistWhereInput[] = [
    { displayName: { startsWith: q, mode: "insensitive" } },
    { displayName: { contains: ` ${q}`, mode: "insensitive" } },
  ]
  if (handleLike) {
    wordMatches.push({ instagramHandle: { contains: `.${q}` } }, { instagramHandle: { contains: `\\_${q}` } })
  }

  const [byHandle, byWord] = await Promise.all([
    handleLike
      ? prisma.artist.findMany({
          where: { AND: [scope, { instagramHandle: { startsWith: q } }] },
          select: SEARCH_SELECT,
          orderBy: { instagramHandle: "asc" },
          take: HANDLE_CANDIDATES,
        })
      : Promise.resolve([]),
    prisma.artist.findMany({
      where: { AND: [scope, { OR: wordMatches }] },
      select: SEARCH_SELECT,
      orderBy: { instagramHandle: "asc" },
      take: NAME_CANDIDATES,
    }),
  ])

  const rows = new Map<string, SearchRow>()
  for (const row of [...byHandle, ...byWord]) rows.set(row.id, row)
  return [...rows.values()]
    .map((row) => ({ row, rank: matchRank(row, query) }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.row.instagramHandle.length - b.row.instagramHandle.length ||
        (a.row.instagramHandle < b.row.instagramHandle ? -1 : 1)
    )
    .map(({ row }) => row)
}

function matchRank({ instagramHandle: handle, displayName }: SearchRow, query: string): number {
  if (handle === query) return 0
  if (handle.startsWith(query)) return 1
  const name = displayName?.toLowerCase() ?? ""
  if (name.startsWith(query) || name.includes(` ${query}`)) return 2
  if (handle.includes(`.${query}`) || handle.includes(`_${query}`)) return 3
  return 4
}

function toResult(row: SearchRow, onList: boolean): DirectoryArtist {
  const primary = row.locations[0]
  return {
    id: row.id,
    instagramHandle: row.instagramHandle,
    displayName: row.displayName,
    // Other users' artists get only our stored copy: the saved Instagram link
    // may have come from whoever added the artist first
    profilePicUrl: onList ? profilePicUrlFor(row) : row.avatar ? avatarPath(row.id, row.avatar.version) : null,
    city: primary?.city ?? null,
    country: primary?.country ?? null,
    onList,
  }
}
