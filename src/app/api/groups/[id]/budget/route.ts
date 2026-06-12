import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { startOfMonth } from "date-fns"

const budgetSchema = z.object({
  totalAmount: z.number().positive(),
  period: z.enum(["TRIP", "MONTHLY", "CUSTOM"]).default("MONTHLY"),
  startDate: z.string(),
  endDate: z.string().optional(),
  alertAt: z.number().min(0.1).max(1).default(0.8),
  categoryBudgets: z
    .array(z.object({ category: z.string(), amount: z.number().positive() }))
    .optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const budget = await prisma.groupBudget.findUnique({
    where: { groupId },
    include: { categoryBudgets: true },
  })

  if (!budget) return NextResponse.json(null)

  // Calculate current spending within the budget period
  const start = budget.startDate
  const end = budget.endDate ?? new Date()

  const expenses = await prisma.expense.findMany({
    where: { groupId, date: { gte: start, lte: end } },
    select: { amount: true, category: true },
  })

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

  const categorySpending: Record<string, number> = {}
  for (const e of expenses) {
    categorySpending[e.category] = (categorySpending[e.category] ?? 0) + e.amount
  }

  return NextResponse.json({
    ...budget,
    totalSpent: Math.round(totalSpent * 100) / 100,
    percentUsed: Math.round((totalSpent / budget.totalAmount) * 1000) / 10,
    isOverAlert: totalSpent / budget.totalAmount >= budget.alertAt,
    isOverBudget: totalSpent > budget.totalAmount,
    categorySpending,
  })
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params
  const body = await req.json()
  const parsed = budgetSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Only ADMIN members can set/update group budget
  const isMember = await prisma.groupMember.findFirst({
    where: { groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { categoryBudgets, startDate, endDate, ...rest } = parsed.data

  // Upsert budget
  const budget = await prisma.groupBudget.upsert({
    where: { groupId },
    update: {
      ...rest,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
    create: {
      groupId,
      ...rest,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
  })

  // Replace category budgets if provided
  if (categoryBudgets) {
    await prisma.categoryBudget.deleteMany({ where: { budgetId: budget.id } })
    if (categoryBudgets.length > 0) {
      await prisma.categoryBudget.createMany({
        data: categoryBudgets.map((cb) => ({ budgetId: budget.id, ...cb })),
      })
    }
  }

  return NextResponse.json(budget)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.groupBudget.deleteMany({ where: { groupId } })

  return NextResponse.json({ success: true })
}
