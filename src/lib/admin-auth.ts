import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/** Use in API route handlers. Returns userId or a 401/403 Response. */
export async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await (prisma.user.findUnique as any)({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return { userId: session.user.id }
}
