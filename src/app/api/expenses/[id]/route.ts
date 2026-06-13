import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notifyUser, sendExpenseEditedEmail } from "@/lib/email"
import { z } from "zod"

const splitEntrySchema = z.object({
  userId: z.string(),
  amount: z.number().nonnegative(),
})

const patchSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  category: z.string().optional(),
  currency: z.string().length(3).optional(),
  paidById: z.string().optional(),
  date: z.string().optional(),
  tripDayId: z.string().nullable().optional(),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SELECTED"]).optional(),
  splits: z.array(splitEntrySchema).min(1).optional(),
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

  const { date, tripDayId, amount, splits, splitType, currency, ...rest } = parsed.data

  // Determine splits to write
  let splitsUpdate = {}
  if (splits && splits.length > 0) {
    // Explicit splits provided — use them directly
    splitsUpdate = {
      splits: {
        deleteMany: {},
        createMany: { data: splits },
      },
    }
  } else if (amount !== undefined) {
    // Amount changed but no explicit splits — recalculate equal
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
      ...(currency !== undefined ? { currency } : {}),
      ...(splitType !== undefined ? { splitType } : {}),
      ...(date ? { date: new Date(date) } : {}),
      ...(tripDayId !== undefined ? { tripDayId: tripDayId ?? null } : {}),
      ...splitsUpdate,
    },
    include: {
      paidBy: { select: { id: true, name: true, avatar: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  })
  // Notify other group members — fire and forget
  const otherMembers = expense.group.members.filter((m: { userId: string }) => m.userId !== session.user.id)
  for (const m of otherMembers) {
    notifyUser(m.userId, "expenseEdited", (to, name) =>
      sendExpenseEditedEmail({
        to, name,
        action: "edited",
        description: expense.description,
        groupName: expense.group.name,
        groupId: expense.group.id,
      })
    ).catch(() => {})
  }

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

  // Notify other group members — fire and forget
  const otherMembers = expense.group.members.filter((m: { userId: string }) => m.userId !== session.user.id)
  for (const m of otherMembers) {
    notifyUser(m.userId, "expenseEdited", (to, name) =>
      sendExpenseEditedEmail({
        to, name,
        action: "deleted",
        description: expense.description,
        groupName: expense.group.name,
        groupId: expense.group.id,
      })
    ).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
