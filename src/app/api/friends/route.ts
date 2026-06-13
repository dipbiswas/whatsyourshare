/**
 * GET /api/friends
 * Returns all unique users the current user has shared a group with,
 * regardless of balance. Used for quick-add in AddMemberDialog.
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  // Find all group members across all groups the user belongs to
  const groupMembers = await prisma.groupMember.findMany({
    where: {
      group: { members: { some: { userId } } },
      userId: { not: userId }, // exclude self
    },
    select: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
    distinct: ["userId"],
    orderBy: { user: { name: "asc" } },
  })

  const friends = groupMembers.map((m) => m.user)

  return NextResponse.json(friends)
}
