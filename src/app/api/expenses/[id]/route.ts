import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  category: z.string().optional(),
  paidById: z.string().optional(),
  date: z.string().optional(),
  tripDayId: z.string().nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { group: { include: { members: true } } },
  })
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isMember = expense.group.members.some((m: { userId: string }) => m.userId === session.user.id)
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { date, tripDayId, amount, ...rest } = parsed.data

  // If amount changed, recalculate equal splits
  let splitsUpdate = {}
  if (amount !== undefined) {
    const memberCount = expense.group.members.length
    const perPerson = Math.round((amount / memberCount) * 100) / 100
    splitsUpdate = {
      splits: {
        deleteMany: {},
        createMany: {
          data: expense.group.members.map((m: { userId: string }) => ({
            userId: m.userId,
            amount: perPerson,
          })),
        },
      },
    }
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...rest,
      ...(amount !== undefined ? { amount } : {}),
      ...(date ? { date: new Date(date) } : {}),
      ...(tripDayId !== undefined ? { tripDayId: tripDayId ?? null } : {}),
      ...splitsUpdate,
    },
    include: {
      paidBy: { select: { id: true, name: true, avatar: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { group: { include: { members: true } } },
  })
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isMember = expense.group.members.some((m: { userId: string }) => m.userId === session.user.id)
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.expense.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
