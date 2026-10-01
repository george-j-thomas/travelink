import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { getKnownAccountTypes, MAX_ACCOUNT_TYPE_LOOKUP } from "@/lib/artist-pipeline"

// POST /api/import/account-types — Which handles earlier bio lookups found to be
// business or personal accounts. Body: { handles: string[] }. Reads the DB only;
// handles that were never looked up are left out of `types`.
export async function POST(request: NextRequest) {
  try {
    await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const handles = (body as { handles?: unknown } | null)?.handles
  if (!Array.isArray(handles) || !handles.every((h) => typeof h === "string")) {
    return NextResponse.json({ error: "handles must be an array of strings" }, { status: 400 })
  }
  if (handles.length > MAX_ACCOUNT_TYPE_LOOKUP) {
    return NextResponse.json(
      { error: `At most ${MAX_ACCOUNT_TYPE_LOOKUP} handles can be checked at once` },
      { status: 400 }
    )
  }

  try {
    return NextResponse.json({ types: await getKnownAccountTypes(handles) })
  } catch (err) {
    console.error("POST /api/import/account-types failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
