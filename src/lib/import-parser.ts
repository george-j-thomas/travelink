/**
 * Parses Instagram's "Download Your Information" JSON export
 * to extract a list of followed handles.
 *
 * Expected input: the contents of `following.json` from Instagram's data export.
 */

interface StringListEntry {
  href: string;
  value: string;
  timestamp: number;
}

interface FollowingEntry {
  title: string;
  media_list_data: unknown[];
  string_list_data: StringListEntry[];
}

interface FollowingExport {
  relationships_following: FollowingEntry[];
}

export function parseFollowingExport(jsonString: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("The uploaded file is not valid JSON");
  }

  const data = parsed as Record<string, unknown>;
  if (!data || !Array.isArray(data.relationships_following)) {
    throw new Error(
      "This doesn't look like an Instagram following export. Expected a file containing 'relationships_following'.",
    );
  }

  const entries = data.relationships_following as FollowingEntry[];
  const handles = new Set<string>();

  for (const entry of entries) {
    if (
      !Array.isArray(entry.string_list_data) ||
      entry.string_list_data.length === 0
    ) {
      continue;
    }

    const raw = entry.string_list_data[0].value;
    if (!raw || typeof raw !== "string") {
      continue;
    }

    let handle = raw.trim().toLowerCase();
    if (handle.startsWith("@")) {
      handle = handle.slice(1);
    }

    if (handle.length > 0) {
      handles.add(handle);
    }
  }

  return Array.from(handles).sort();
}
