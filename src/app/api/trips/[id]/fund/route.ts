import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const fundSchema = z.object({
  targetAmount: z.number().positive().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["COLLECTING", "CLOSED", "DISBURSED"]).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: tripId } = await params

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, group: { members: { some: { userId: session.user.id } } } },
    select: { id: true },
  })
  if (!trip) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const fund = await prisma.tripFund.findUnique({
    where: { tripId },
    include: {
      contributions: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
      },
    },
  })

  return NextResponse.json(fund)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: tripId } = await params
  const body = await req.json()
  const parsed = fundSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, group: { members: { some: { userId: session.user.id } } } },
    select: { id: true },
  })
  if (!trip) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { targetAmount, currency, description, status } = parsed.data
  const fund = await prisma.tripFund.upsert({
    where: { tripId },
    create: { tripId, targetAmount: targetAmount ?? 0, currency: currency ?? "USD", description, status },
    update: { ...(targetAmount !== undefined && { targetAmount }), ...(currency && { currency }), ...(description !== undefined && { description }), ...(status && { status }) },
  })

  return NextResponse.json(fund)
}
