import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check

  const count = await (prisma as any).contentFlag.count({ where: { status: "PENDING" } })
  return NextResponse.json({ count })
}
