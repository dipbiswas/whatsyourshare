import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushToGroup } from "@/lib/push"
import { z } from "zod"

const splitSchema = z.object({
  userId: z.string(),
  amount: z.number().positive(),
})

const expenseSchema = z.object({
  groupId: z.string(),
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.string().default("General"),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE"]).default("EQUAL"),
  visibility: z.enum(["GROUP", "PAYERS_ONLY"]).default("GROUP"),
  paidById: z.string(),
  date: z.string().optional(),
  splits: z.array(splitSchema).min(1),
  recurringExpenseId: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = expenseSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { splits, date, ...rest } = parsed.data

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId: rest.groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const expense = await prisma.expense.create({
    data: {
      ...rest,
      date: date ? new Date(date) : new Date(),
      splits: { createMany: { data: splits } },
    },
    include: {
      paidBy: { select: { id: true, name: true, avatar: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  })

  await prisma.group.update({ where: { id: rest.groupId }, data: { updatedAt: new Date() } })

  // Push notifications — fire-and-forget
  const group = await prisma.group.findUnique({ where: { id: rest.groupId }, select: { name: true } })
  sendPushToGroup(rest.groupId, session.user.id, {
    title: `New expense in ${group?.name ?? "your group"}`,
    body: `${expense.paidBy.name} added "${expense.description}" · $${expense.amount.toFixed(2)}`,
    url: `/groups/${rest.groupId}`,
    tag: `expense-${expense.id}`,
  }).catch(() => {}) // non-blocking

  return NextResponse.json(expense, { status: 201 })
}
