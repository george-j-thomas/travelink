// Mapbox Geocoding API client
// Forward geocoding (location name → lat/lng) for tattoo artist location resolution.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeocodingResult {
  lat: number
  lng: number
  placeName: string // Full place name from Mapbox (e.g., "Tokyo, Tokyo, Japan")
  city: string | null
  country: string | null
}

/** Raw shape of a single feature from the Mapbox Geocoding API response. */
interface MapboxFeature {
  id: string
  place_name: string
  text: string
  geometry: {
    type: string
    coordinates: [number, number] // [lng, lat] — Mapbox uses GeoJSON order
  }
  context?: Array<{
    id: string
    text: string
    short_code?: string
  }>
}

interface MapboxGeocodingResponse {
  type: string
  features: MapboxFeature[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAPBOX_GEOCODING_BASE =
  "https://api.mapbox.com/geocoding/v5/mapbox.places"

const ALLOWED_TYPES = "place,locality,neighborhood,address"

function getAccessToken(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) {
    throw new Error(
      "Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable. " +
        "Set it to a valid Mapbox public access token.",
    )
  }
  return token
}

/** Find the first context entry whose `id` starts with the given prefix. */
function findContext(
  feature: MapboxFeature,
  prefix: string,
): string | null {
  const entry = feature.context?.find((c) => c.id.startsWith(prefix))
  return entry?.text ?? null
}

/** Extract city from a Mapbox feature.
 *  If the feature itself is a place-level result, use its `text` directly.
 *  Otherwise look for a `place.*` entry in the context array. */
function extractCity(feature: MapboxFeature): string | null {
  if (feature.id.startsWith("place.")) {
    return feature.text
  }
  return findContext(feature, "place.")
}

function extractCountry(feature: MapboxFeature): string | null {
  if (feature.id.startsWith("country.")) {
    return feature.text
  }
  return findContext(feature, "country.")
}

function featureToResult(feature: MapboxFeature): GeocodingResult {
  const [lng, lat] = feature.geometry.coordinates // Mapbox returns [lng, lat]
  return {
    lat,
    lng,
    placeName: feature.place_name,
    city: extractCity(feature),
    country: extractCountry(feature),
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Forward-geocode a location name to a single lat/lng result.
 * Returns `null` when no results are found.
 */
export async function geocodeLocation(
  locationName: string,
): Promise<GeocodingResult | null> {
  const token = getAccessToken()

  const url = new URL(
    `${MAPBOX_GEOCODING_BASE}/${encodeURIComponent(locationName)}.json`,
  )
  url.searchParams.set("access_token", token)
  url.searchParams.set("limit", "1")
  url.searchParams.set("types", ALLOWED_TYPES)

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(
      `Mapbox Geocoding API error: ${response.status} ${response.statusText}`,
    )
  }

  const data: MapboxGeocodingResponse = await response.json()

  if (!data.features || data.features.length === 0) {
    return null
  }

  return featureToResult(data.features[0])
}

/**
 * Forward-geocode with up to 5 results for autocomplete suggestions.
 * Returns an empty array when the query is empty or too short (< 2 chars).
 */
export async function geocodeAutocomplete(
  query: string,
): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const token = getAccessToken()

  const url = new URL(
    `${MAPBOX_GEOCODING_BASE}/${encodeURIComponent(query.trim())}.json`,
  )
  url.searchParams.set("access_token", token)
  url.searchParams.set("limit", "5")
  url.searchParams.set("types", ALLOWED_TYPES)

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(
      `Mapbox Geocoding API error: ${response.status} ${response.statusText}`,
    )
  }

  const data: MapboxGeocodingResponse = await response.json()

  if (!data.features) {
    return []
  }

  return data.features.map(featureToResult)
}
