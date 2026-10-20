// Build-time settings. build.mjs validates TRAVELINK_URL and substitutes the resulting origin for
// __TRAVELINK_ORIGIN__ through esbuild's `define`, so this module only works inside a build.
declare const __TRAVELINK_ORIGIN__: string

/** travel-ink's origin, e.g. `https://travelink.example`: no path and no trailing slash. */
export const TRAVELINK_ORIGIN: string = __TRAVELINK_ORIGIN__
