import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { planLimits } from "@/lib/plan"
import { checkAndFlag } from "@/lib/moderation"
import { z } from "zod"

const createSchema = z.object({
  groupId: z.string(),
  name: z.string().min(1).max(100),
  destination: z.string().optional(),
  coverEmoji: z.string().optional(),
  eventType: z.string().default("TRIP"),
  memberIds: z.array(z.string()).optional(),
  startDate: z.string(),
  endDate: z.string(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get("groupId")

  const where = groupId
    ? { groupId, group: { members: { some: { userId: session.user.id } } } }
    : { group: { members: { some: { userId: session.user.id } } } }

  const trips = await prisma.trip.findMany({
    where,
    include: {
      group: { select: { id: true, name: true, currency: true, members: { select: { userId: true } } } },
      _count: { select: { days: true } },
      fund: { select: { id: true, status: true, targetAmount: true, currency: true } },
    },
    orderBy: { startDate: "desc" },
  })

  // Note: memberIds, hideFromNonMembers, createdById are scalar fields included by default

  const userId = session.user.id
  const visible = trips.filter((t: any) => {
    if (!t.hideFromNonMembers) return true
    const memberIds = Array.isArray(t.memberIds) ? (t.memberIds as string[]) : []
    return memberIds.length === 0 || memberIds.includes(userId) || t.createdById === userId
  })

  return NextResponse.json(visible)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [isMember, user] = await Promise.all([
    prisma.groupMember.findFirst({ where: { groupId: parsed.data.groupId, userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true } }),
  ])
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const limits = await planLimits((user?.plan ?? "FREE") as "FREE" | "PRO" | "FAMILY")
  if (!limits.canCreateEvents) {
    return NextResponse.json(
      { error: "plan_limit", message: "Events are a Pro feature. Upgrade to create events and trips." },
      { status: 403 },
    )
  }

  const { startDate, endDate, ...rest } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trip = await (prisma.trip.create as any)({
    data: {
      ...rest,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdById: session.user.id,
    },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      _count: { select: { days: true } },
    },
  })

  checkAndFlag("TRIP", trip.id, trip.name, session.user.id).catch(() => {})

  return NextResponse.json(trip, { status: 201 })
}
