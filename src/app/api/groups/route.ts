import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateGroupBalances } from "@/lib/balance"
import { planLimits } from "@/lib/plan"
import { checkAndFlag } from "@/lib/moderation"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).default("USD"),
  defaultSplitType: z.string().default("EQUAL"),
  defaultSplitShares: z.record(z.string(), z.number()).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  try {
    const groups: any[] = await prisma.group.findMany({
      where: { members: { some: { userId } } },
      include: ({
        members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
        _count: { select: { expenses: true } },
        expenses: {
          select: { paidById: true, amount: true, splits: { select: { userId: true, amount: true } } },
        },
        settlements: {
          select: { fromUserId: true, toUserId: true, amount: true },
        },
        trips: {
          select: { id: true, name: true, coverEmoji: true, eventType: true, startDate: true, endDate: true },
          orderBy: { startDate: "asc" },
        },
      } as any),
      orderBy: { updatedAt: "desc" },
    })

    // Fetch guests separately to avoid breaking if GuestMember table doesn't exist yet
    let guestsByGroup: Record<string, any[]> = {}
    try {
      const allGuests = await (prisma as any).guestMember.findMany({
        where: { groupId: { in: groups.map((g: any) => g.id) }, linkedUserId: null },
        select: { id: true, name: true, email: true, groupId: true },
      })
      for (const g of allGuests) {
        if (!guestsByGroup[g.groupId]) guestsByGroup[g.groupId] = []
        guestsByGroup[g.groupId].push(g)
      }
    } catch {
      // GuestMember table may not exist yet — guests default to empty
    }

    const now = new Date()
    const result = groups.map(({ expenses, settlements, trips, ...g }: any) => {
      const guests = guestsByGroup[g.id] ?? []
      const balanceMap = calculateGroupBalances(
        g.members.map((m: any) => ({ userId: m.userId })),
        expenses,
        settlements,
        guests,
      )
      const myBalance = Math.round((balanceMap[userId] ?? 0) * 100) / 100
      const activeTrips = (trips as any[]).filter((t: any) => new Date(t.endDate) >= now)
      const isOwner = g.createdById === userId
      return { ...g, guests, myBalance, activeTrips, isOwner }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error("[GET /api/groups] error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Plan enforcement — group creation limit
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true } })
  const limits = await planLimits((user?.plan ?? "FREE") as "FREE" | "PRO" | "FAMILY")
  if (limits.maxGroups !== 0) {
    const ownedGroupCount = await prisma.groupMember.count({ where: { userId: session.user.id, role: "ADMIN" } })
    if (ownedGroupCount >= limits.maxGroups) {
      return NextResponse.json(
        { error: "plan_limit", message: `Free plan is limited to ${limits.maxGroups} groups. Upgrade to Pro for unlimited groups.` },
        { status: 403 },
      )
    }
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group = await (prisma.group.create as any)({
    data: {
      ...parsed.data,
      createdById: session.user.id,
      members: { create: { userId: session.user.id, role: "ADMIN" } },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      _count: { select: { expenses: true } },
    },
  })

  const snapText = [group.name, (group as any).description].filter(Boolean).join(" — ")
  checkAndFlag("GROUP", group.id, snapText, session.user.id).catch(() => {})

  return NextResponse.json(group, { status: 201 })
}
