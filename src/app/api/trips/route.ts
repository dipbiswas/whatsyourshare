import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  groupId: z.string(),
  name: z.string().min(1).max(100),
  destination: z.string().optional(),
  coverEmoji: z.string().optional(),
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
      group: { select: { id: true, name: true, currency: true } },
      _count: { select: { days: true } },
      fund: { select: { id: true, status: true, targetAmount: true, currency: true } },
    },
    orderBy: { startDate: "desc" },
  })

  return NextResponse.json(trips)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId: parsed.data.groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { startDate, endDate, ...rest } = parsed.data

  const trip = await prisma.trip.create({
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

  return NextResponse.json(trip, { status: 201 })
}
