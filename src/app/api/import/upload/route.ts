import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { parseFollowingExport } from "@/lib/import-parser"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// POST /api/import/upload — Parse an uploaded Instagram data export JSON file
export async function POST(request: NextRequest) {
  try {
    await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    )
  }

  const file = formData.get("file")
  // Blob, not File — the File global only exists on Node 20+
  if (!file || typeof file === "string" || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "A file field is required" },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File must be smaller than 10 MB" },
      { status: 400 }
    )
  }

  try {
    const text = await file.text()
    const accounts = parseFollowingExport(text).map((username) => ({
      username,
      fullName: null,
      profilePicUrl: null,
    }))
    return NextResponse.json({ accounts, count: accounts.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file" },
      { status: 400 }
    )
  }
}
