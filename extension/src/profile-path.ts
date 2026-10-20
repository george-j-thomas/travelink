// Which Instagram profile a page belongs to, worked out from the page's URL path alone.
// Pure and DOM-free so it can be checked from Node. The handle rules (valid characters, length,
// reserved routes like /explore/) come from the app's shared module, bundled in by esbuild.
import { parseProfileLink } from "../../src/lib/instagram-handle"

/**
 * The handle of the profile at `pathname` (`location.pathname` on www.instagram.com, so it starts
 * with `/`): the profile itself (`/<handle>/`), a profile tab (`/<handle>/tagged/`,
 * `/<handle>/reels/`…) or a post opened from the profile (`/<handle>/p/<id>/`). Handles come back
 * lowercase. Null on every other page: the feed, posts, reels, stories, explore, messages,
 * settings, and paths that aren't valid handles.
 */
export function profileHandleFromPath(pathname: string): string | null {
  const parsed = parseProfileLink(`https://www.instagram.com${pathname}`)
  return parsed.ok ? parsed.handle : null
}
