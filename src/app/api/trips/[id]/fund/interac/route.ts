/**
 * POST /api/trips/[id]/fund/interac
 * Records an Interac e-Transfer contribution directly as PAID (honour system).
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({ amount: z.number().positive() })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: tripId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { amount } = parsed.data

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, group: { members: { some: { userId: session.user.id } } } },
    include: { fund: true },
  })

  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  if (!trip.fund) return NextResponse.json({ error: "No fund set up" }, { status: 400 })
  if (trip.fund.status !== "COLLECTING") return NextResponse.json({ error: "Fund is not collecting" }, { status: 400 })

  const contribution = await prisma.fundContribution.upsert({
    where: { fundId_userId: { fundId: trip.fund.id, userId: session.user.id } },
    create: {
      fundId: trip.fund.id,
      userId: session.user.id,
      amount,
      status: "PAID",
      paidAt: new Date(),
    },
    update: {
      amount,
      status: "PAID",
      paidAt: new Date(),
    },
  })

  return NextResponse.json({ contribution })
}
