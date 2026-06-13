/**
 * POST /api/cron/recurring
 *
 * Called daily by Vercel Cron (see vercel.json).
 * Secured with a shared CRON_SECRET header.
 *
 * For every active RecurringExpense whose nextDueDate <= today:
 *   1. Fetches group members
 *   2. Creates an Expense with equal splits (EXACT splits coming in Phase 2)
 *   3. Advances nextDueDate to the next period
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { addWeeks, addMonths, addQuarters } from "date-fns"

function advance(date: Date, freq: "WEEKLY" | "MONTHLY" | "QUARTERLY"): Date {
  if (freq === "WEEKLY") return addWeeks(date, 1)
  if (freq === "QUARTERLY") return addQuarters(date, 1)
  return addMonths(date, 1)
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  const due = await prisma.recurringExpense.findMany({
    where: { nextDueDate: { lte: now } },
    include: {
      group: {
        include: { members: { select: { userId: true } } },
      },
    },
  })

  const results: { id: string; description: string; status: string }[] = []

  for (const template of due) {
    const memberIds = template.group.members.map((m) => m.userId)
    if (memberIds.length === 0) continue

    const perPerson = Math.round((template.lastAmount / memberIds.length) * 100) / 100

    try {
      await prisma.$transaction([
        prisma.expense.create({
          data: {
            groupId: template.groupId,
            description: template.description,
            amount: template.lastAmount,
            currency: template.currency,
            category: template.category,
            splitType: template.splitType,
            paidById: template.createdById,
            recurringExpenseId: template.id,
            date: now,
            splits: {
              createMany: {
                data: memberIds.map((userId) => ({ userId, amount: perPerson })),
              },
            },
          },
        }),
        prisma.recurringExpense.update({
          where: { id: template.id },
          data: { nextDueDate: advance(template.nextDueDate, template.frequency) },
        }),
      ])
      results.push({ id: template.id, description: template.description, status: "created" })
    } catch {
      results.push({ id: template.id, description: template.description, status: "error" })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
