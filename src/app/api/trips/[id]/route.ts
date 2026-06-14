import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  destination: z.string().nullable().optional(),
  eventType: z.string().optional(),
  coverEmoji: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  memberIds: z.array(z.string()).nullable().optional(),
  hideFromNonMembers: z.boolean().optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  try {
  const trip = await prisma.trip.findFirst({
    where: {
      id,
      group: { members: { some: { userId: session.user.id } } },
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          currency: true,
          members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        },
      },
      days: {
        include: {
          expenses: {
            include: {
              paidBy: { select: { id: true, name: true } },
              splits: { include: { user: { select: { id: true, name: true } } } },
            },
            orderBy: { date: "asc" },
          },
        },
        orderBy: { date: "asc" },
      },
      fund: {
        include: {
          contributions: {
            include: { user: { select: { id: true, name: true, avatar: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      // hideFromNonMembers is a scalar field, included by default
    },
  })

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Fetch group settlements so balances can account for them
  const groupSettlements = await prisma.settlement.findMany({
    where: { groupId: trip.groupId },
    select: { fromUserId: true, toUserId: true, amount: true },
  })

  // Also fetch group expenses NOT linked to any trip day (to allow linking)
  const unlinkedExpenses = await prisma.expense.findMany({
    where: { groupId: trip.groupId, tripDayId: null },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { date: "desc" },
    take: 50,
  })

  // Per-member cost breakdown
  const allLinkedExpenses = trip.days.flatMap((d) => d.expenses)
  const memberSpend: Record<string, number> = {}
  for (const e of allLinkedExpenses) {
    for (const s of e.splits) {
      memberSpend[s.user.id] = (memberSpend[s.user.id] ?? 0) + s.amount
    }
  }

  // Event-level expenses (linked directly to this trip, no day)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventExpenses = await (prisma.expense as any).findMany({
    where: { tripId: id },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { date: "desc" },
  })

  // Include event expenses in per-member spend
  for (const e of eventExpenses) {
    for (const s of e.splits) {
      memberSpend[s.user.id] = (memberSpend[s.user.id] ?? 0) + s.amount
    }
  }

  return NextResponse.json({ ...trip, unlinkedExpenses, memberSpend, groupSettlements, eventExpenses })
  } catch (err) {
    console.error("[GET /api/trips/[id]] error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { hideFromNonMembers, startDate, endDate, ...organizerFields } = parsed.data

  // hideFromNonMembers can be toggled by any trip member; other fields require organizer
  const hasOrganizerFields = Object.keys(organizerFields).length > 0

  const trip: any = await prisma.trip.findFirst({
    where: hasOrganizerFields
      ? { id, createdById: session.user.id }
      : { id, group: { members: { some: { userId: session.user.id } } } },
  })
  if (!trip) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 })

  // Verify user is a trip member when toggling hideFromNonMembers
  if (hideFromNonMembers !== undefined) {
    const memberIds = Array.isArray(trip.memberIds) ? (trip.memberIds as string[]) : []
    const isTripMember = memberIds.length === 0 || memberIds.includes(session.user.id) || trip.createdById === session.user.id
    if (!isTripMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma.trip.update as any)({
    where: { id },
    data: {
      ...organizerFields,
      ...(hideFromNonMembers !== undefined ? { hideFromNonMembers } : {}),
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const trip = await prisma.trip.findFirst({
    where: { id, createdById: session.user.id },
  })
  if (!trip) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 })

  await prisma.trip.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
