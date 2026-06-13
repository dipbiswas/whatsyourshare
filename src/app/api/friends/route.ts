/**
 * GET /api/friends
 * Returns all unique users the current user has shared a group with,
 * regardless of balance. Used for quick-add in AddMemberDialog and Friends page.
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  // Get all groups the user belongs to
  const userGroups = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  })
  const groupIds = userGroups.map((g) => g.groupId)

  if (groupIds.length === 0) return NextResponse.json([])

  // Get all other members in those groups
  const groupMembers = await prisma.groupMember.findMany({
    where: {
      groupId: { in: groupIds },
      userId: { not: userId },
    },
    select: {
      userId: true,
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  })

  // Deduplicate by userId in JS
  const seen = new Set<string>()
  const friends = groupMembers
    .filter((m) => {
      if (seen.has(m.userId)) return false
      seen.add(m.userId)
      return true
    })
    .map((m) => m.user)
    .sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json(friends)
}
