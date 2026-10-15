// Stored artist profile photos.
//
// Instagram's profile photo links are signed and expire about 4.5 days after a
// bio fetch. After a successful Business Discovery fetch, the pipeline calls
// storeArtistAvatar() to keep a small WebP copy in Postgres (artist_avatars),
// which GET /api/artists/[id]/avatar serves. The download comes from
// Instagram's CDN, not its API, so it isn't metered (no reserveUsage).

import "server-only"
import { createHash } from "node:crypto"
import sharp from "sharp"
import { prisma } from "@/lib/db"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The largest avatar on screen is 80 CSS px; 240 px covers 3x displays. */
const AVATAR_SIZE = 240
const WEBP_QUALITY = 80
const AVATAR_CONTENT_TYPE = "image/webp"
/**
 * Hashed into every version, so new encoder settings produce new versions (and
 * URLs). Change it by hand if an encoder setting other than these two changes.
 */
const ENCODER_TAG = `webp-${AVATAR_SIZE}-q${WEBP_QUALITY}`

const DOWNLOAD_TIMEOUT_MS = 5_000
/** Business Discovery photos are 1080x1080 JPEGs of about 140 KB. */
const MAX_SOURCE_BYTES = 2 * 1024 * 1024
const MAX_SOURCE_PIXELS = 4096 * 4096
const ALLOWED_DOMAINS = ["cdninstagram.com", "fbcdn.net"]
const ALLOWED_SOURCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// Decode JPEG, PNG and WebP only; every other libvips loader stays blocked
sharp.block({ operation: ["VipsForeignLoad"] })
sharp.unblock({
  operation: ["VipsForeignLoadJpegBuffer", "VipsForeignLoadPngBuffer", "VipsForeignLoadWebpBuffer"],
})
// One small image per call, so libvips' operation cache would only hold memory
sharp.cache(false)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoredAvatar {
  version: string
  /** False when the stored copy was already made from the same image (nothing re-encoded). */
  changed: boolean
}

/** The photo couldn't be stored. Messages never include the (signed) photo URL. */
export class AvatarError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AvatarError"
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Accepts plain https links on Instagram's CDN hosts only. */
function parseCdnUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new AvatarError("The profile photo link isn't a valid URL")
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new AvatarError("The profile photo link isn't a plain https URL")
  }
  const host = url.hostname
  if (!ALLOWED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    throw new AvatarError(`The profile photo isn't on Instagram's CDN (host ${host})`)
  }
  return url
}

/** Error name plus network code: fetch errors can carry the URL elsewhere. */
function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return "unknown error"
  const code = (err.cause as { code?: unknown } | undefined)?.code
  return typeof code === "string" ? `${err.name} ${code}` : err.name
}

/** Reads a response body, giving up as soon as it passes `maxBytes`. */
async function readAtMost(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Buffer> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new AvatarError(`The profile photo is larger than ${maxBytes} bytes`)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks, total)
}

async function downloadSource(url: URL): Promise<Buffer> {
  try {
    // No redirects: they could lead off the allowed hosts
    const response = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    })
    if (response.status !== 200) {
      await response.body?.cancel()
      throw new AvatarError(`Instagram's CDN answered HTTP ${response.status}`)
    }
    const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? ""
    if (!ALLOWED_SOURCE_TYPES.has(type)) {
      await response.body?.cancel()
      throw new AvatarError(`The profile photo has an unsupported type (${type || "none"})`)
    }
    const declaredBytes = Number(response.headers.get("content-length") ?? 0)
    if (declaredBytes > MAX_SOURCE_BYTES) {
      await response.body?.cancel()
      throw new AvatarError(`The profile photo is larger than ${MAX_SOURCE_BYTES} bytes`)
    }
    if (!response.body) throw new AvatarError("The profile photo download was empty")
    return await readAtMost(response.body, MAX_SOURCE_BYTES)
  } catch (err) {
    if (err instanceof AvatarError) throw err
    throw new AvatarError(`Downloading the profile photo failed (${describeFetchError(err)})`)
  }
}

function hasImageSignature(bytes: Buffer): boolean {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)
  const isWebp =
    bytes.length >= 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP"
  return isJpeg || isPng || isWebp
}

/** Same source image and encoder settings, same version. */
function versionOf(source: Buffer): string {
  return createHash("sha256").update(`${ENCODER_TAG}\n`).update(source).digest("hex").slice(0, 16)
}

async function toAvatarWebp(source: Buffer): Promise<Buffer> {
  try {
    // Output drops metadata (EXIF, ICC) and reads only the first frame of animations
    return await sharp(source, { failOn: "warning", limitInputPixels: MAX_SOURCE_PIXELS, autoOrient: true })
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()
  } catch (err) {
    throw new AvatarError(`Converting the profile photo failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Downloads an artist's profile photo from Instagram's CDN and stores a small
 * WebP copy in place of the previous one. Downloads, so never call it inside a
 * Prisma transaction.
 *
 * @param sourceUrl the profile_picture_url Business Discovery just returned
 * @throws {AvatarError} not an Instagram CDN link, or the photo couldn't be downloaded or converted.
 *   Database errors are thrown as they are.
 */
export async function storeArtistAvatar(artistId: string, sourceUrl: string): Promise<StoredAvatar> {
  const source = await downloadSource(parseCdnUrl(sourceUrl))
  if (!hasImageSignature(source)) {
    throw new AvatarError("The profile photo isn't a JPEG, PNG or WebP image")
  }
  const version = versionOf(source)

  // Same image as the stored copy: keep its bytes and version, so browser caches stay valid
  const { count: unchanged } = await prisma.artistAvatar.updateMany({
    where: { artistId, version },
    data: { sourceUrl },
  })
  if (unchanged > 0) return { version, changed: false }

  const data = await toAvatarWebp(source)
  // A scalar artistId in `create` and a flat select let Prisma run a native
  // INSERT ... ON CONFLICT, so two fetches storing at once can't collide
  await prisma.artistAvatar.upsert({
    where: { artistId },
    create: { artistId, data, contentType: AVATAR_CONTENT_TYPE, sourceUrl, version },
    update: { data, contentType: AVATAR_CONTENT_TYPE, sourceUrl, version },
    select: { version: true },
  })
  return { version, changed: true }
}
