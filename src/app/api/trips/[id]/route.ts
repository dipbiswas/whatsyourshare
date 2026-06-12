import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

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
      createdBy: { select: { id: true, name: true } },
    },
  })

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 })

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

  return NextResponse.json({ ...trip, unlinkedExpenses, memberSpend })
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
