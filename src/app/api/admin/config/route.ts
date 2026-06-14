import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { invalidateCache } from "@/lib/config"

export async function GET() {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check

  const rows = await (prisma as any).systemConfig.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] })
  return NextResponse.json(rows)
}

export async function PATCH(req: Request) {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check
  const adminId = (check as { userId: string }).userId

  const { key, value } = await req.json()
  if (!key || value === undefined) return NextResponse.json({ error: "key and value required" }, { status: 400 })

  const existing = await (prisma as any).systemConfig.findUnique({ where: { key } })
  if (!existing) return NextResponse.json({ error: "Config key not found" }, { status: 404 })

  // Validate based on type
  if (existing.type === "number" && isNaN(parseFloat(value))) {
    return NextResponse.json({ error: "Value must be a number" }, { status: 400 })
  }
  if (existing.type === "boolean" && value !== "true" && value !== "false") {
    return NextResponse.json({ error: "Value must be true or false" }, { status: 400 })
  }

  const updated = await (prisma as any).systemConfig.update({
    where: { key },
    data: { value: String(value), updatedById: adminId },
  })

  // Invalidate the in-memory cache so next request picks up new value
  invalidateCache()

  return NextResponse.json(updated)
}
