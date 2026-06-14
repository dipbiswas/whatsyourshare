import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { checkAndFlag } from "@/lib/moderation"
import { z } from "zod"

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
})

async function getTripAndMembership(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, group: { members: { some: { userId } } } },
    select: { id: true, groupId: true },
  })
  return trip
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const trip = await getTripAndMembership(id, session.user.id)
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = await (prisma as any).actionItem.findMany({
    where: { tripId: id },
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
      expense: { select: { id: true, description: true, amount: true, currency: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(items)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const trip = await getTripAndMembership(id, session.user.id)
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { dueDate, ...rest } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = await (prisma as any).actionItem.create({
    data: {
      ...rest,
      tripId: id,
      createdById: session.user.id,
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
      expense: { select: { id: true, description: true, amount: true, currency: true } },
    },
  })

  checkAndFlag("ACTION_ITEM", item.id, item.title, session.user.id).catch(() => {})

  return NextResponse.json(item, { status: 201 })
}
