import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { eachDayOfInterval } from "date-fns"

const addDaySchema = z.object({
  date: z.string(),
  label: z.string().optional(),
})

const bulkGenerateSchema = z.object({ generate: z.literal("all") })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: tripId } = await params

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, group: { members: { some: { userId: session.user.id } } } },
  })
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()

  // bulk generate all days in trip range
  const bulk = bulkGenerateSchema.safeParse(body)
  if (bulk.success) {
    const dates = eachDayOfInterval({ start: trip.startDate, end: trip.endDate })
    const days = await Promise.all(
      dates.map((date, i) =>
        prisma.tripDay.upsert({
          where: { tripId_date: { tripId, date } },
          create: { tripId, date, label: `Day ${i + 1}` },
          update: {},
        })
      )
    )
    return NextResponse.json(days, { status: 201 })
  }

  const parsed = addDaySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const day = await prisma.tripDay.upsert({
    where: { tripId_date: { tripId, date: new Date(parsed.data.date) } },
    create: { tripId, date: new Date(parsed.data.date), label: parsed.data.label },
    update: { label: parsed.data.label },
  })

  return NextResponse.json(day, { status: 201 })
}

// PATCH a day label + link/unlink expense to/from a day
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: tripId } = await params
  const body = await req.json()

  // Link expense to a trip day
  if (body.action === "link-expense") {
    const { expenseId, dayId } = body as { expenseId: string; dayId: string | null }
    // Verify the day belongs to this trip
    if (dayId) {
      const day = await prisma.tripDay.findFirst({ where: { id: dayId, tripId } })
      if (!day) return NextResponse.json({ error: "Day not found" }, { status: 404 })
    }
    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: { tripDayId: dayId },
    })
    return NextResponse.json(expense)
  }

  // Update day label
  const { dayId, label } = body as { dayId: string; label: string }
  const day = await prisma.tripDay.update({
    where: { id: dayId },
    data: { label },
  })
  return NextResponse.json(day)
}
