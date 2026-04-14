import Anthropic from "@anthropic-ai/sdk"

export interface ParsedLocation {
  locationName: string // Full location string, e.g. "Tokyo, Japan"
  city: string | null
  country: string | null
  isGuestSpot: boolean
  startDate: string | null // ISO date string or null
  endDate: string | null
}

const SYSTEM_PROMPT = `You are an expert at extracting location information from tattoo artist Instagram bios.

Given the bio text, extract all locations mentioned. For each location, determine:
- The full location name (city + country/state)
- The city name separately
- The country name separately
- Whether it's a guest spot (temporary visit) or home base (permanent)
- Any dates associated with guest spots

Common patterns in tattoo artist bios:
- Emoji flags (🇯🇵 = Japan, 🇺🇸 = USA, 🇬🇧 = UK, etc.)
- City abbreviations (NYC = New York City, LA = Los Angeles, SF = San Francisco, LDN = London)
- "Based in [city]" or "Home: [city]" → primary/home base location
- "Guest spot @ [shop] [city] [dates]" → guest spot
- "Traveling to [city] [month]" → guest spot
- "@shophandle" → Instagram handle for a shop, NOT a location — ignore these
- "DM for bookings" → not location info, ignore
- "📍[city]" → pin emoji indicates location
- Cities separated by | or / → multiple locations (first is usually primary)

Rules:
- If the bio contains NO discernible location information, call the tool with an empty array
- If you are UNCERTAIN about a location, DO NOT include it
- Do NOT treat shop names or Instagram handles as locations
- Expand all abbreviations to full names (NYC → New York City)
- Expand emoji flags to country names
- For guest spots, extract dates if mentioned (convert to ISO format YYYY-MM-DD), null if no dates
- The first/primary location mentioned is usually the home base (isGuestSpot: false)`

const EXTRACT_LOCATIONS_TOOL: Anthropic.Tool = {
  name: "extract_locations",
  description: "Extract location data from a tattoo artist bio",
  input_schema: {
    type: "object" as const,
    properties: {
      locations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            locationName: { type: "string" },
            city: { type: ["string", "null"] },
            country: { type: ["string", "null"] },
            isGuestSpot: { type: "boolean" },
            startDate: { type: ["string", "null"] },
            endDate: { type: ["string", "null"] },
          },
          required: [
            "locationName",
            "city",
            "country",
            "isGuestSpot",
            "startDate",
            "endDate",
          ],
        },
      },
    },
    required: ["locations"],
  },
}

// Singleton client — reads ANTHROPIC_API_KEY from env automatically
const client = new Anthropic()

export async function parseBioLocations(
  bio: string | null | undefined,
): Promise<ParsedLocation[]> {
  if (!bio || bio.trim().length === 0) {
    return []
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_LOCATIONS_TOOL],
    tool_choice: { type: "tool", name: "extract_locations" },
    messages: [
      {
        role: "user",
        content: `Extract locations from this tattoo artist Instagram bio:\n\n${bio}`,
      },
    ],
  })

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  )

  if (!toolBlock) {
    return []
  }

  const input = toolBlock.input as { locations: ParsedLocation[] }
  return input.locations
}
