import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)

  // Get all groups the user is a member of
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  })
  const groupIds = memberships.map((m) => m.groupId)

  if (groupIds.length === 0) return NextResponse.json([])

  // Fetch recent expenses, settlements, and member joins in parallel
  const [expenses, settlements, joins] = await Promise.all([
    prisma.expense.findMany({
      where: {
        groupId: { in: groupIds },
        OR: [
          { visibility: "GROUP" },
          { paidById: userId },
          { splits: { some: { userId } } },
        ],
      },
      include: {
        group: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.settlement.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        group: { select: { id: true, name: true } },
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.groupMember.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        group: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: "desc" },
      take: limit,
    }),
  ])

  // Normalise into a unified activity list
  type Activity = {
    id: string
    type: "expense" | "settlement" | "member_join"
    groupId: string
    groupName: string
    actorId: string
    actorName: string
    description: string
    amount?: number
    currency?: string
    involvedMe: boolean
    timestamp: string
  }

  const activities: Activity[] = [
    ...expenses.map((e) => ({
      id: `expense-${e.id}`,
      type: "expense" as const,
      groupId: e.group.id,
      groupName: e.group.name,
      actorId: e.paidBy.id,
      actorName: e.paidBy.id === userId ? "You" : e.paidBy.name,
      description: e.description,
      amount: e.amount,
      currency: e.currency,
      involvedMe: e.paidById === userId,
      timestamp: e.createdAt.toISOString(),
    })),
    ...settlements.map((s) => ({
      id: `settlement-${s.id}`,
      type: "settlement" as const,
      groupId: s.group.id,
      groupName: s.group.name,
      actorId: s.fromUser.id,
      actorName: s.fromUser.id === userId ? "You" : s.fromUser.name,
      description: `paid ${s.toUser.id === userId ? "you" : s.toUser.name}`,
      amount: s.amount,
      currency: s.currency,
      involvedMe: s.fromUserId === userId || s.toUserId === userId,
      timestamp: s.createdAt.toISOString(),
    })),
    ...joins.map((m) => ({
      id: `join-${m.id}`,
      type: "member_join" as const,
      groupId: m.group.id,
      groupName: m.group.name,
      actorId: m.user.id,
      actorName: m.user.id === userId ? "You" : m.user.name,
      description: "joined the group",
      involvedMe: m.userId === userId,
      timestamp: m.joinedAt.toISOString(),
    })),
  ]

  // Sort by timestamp desc, take top N
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json(activities.slice(0, limit))
}
