import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateGroupBalances } from "@/lib/balance"

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { select: { userId: true } },
      expenses: {
        include: { splits: { select: { userId: true, amount: true } } },
        select: { paidById: true, amount: true, splits: { select: { userId: true, amount: true } } },
      },
      settlements: { select: { fromUserId: true, toUserId: true, amount: true } },
    },
  })

  let totalOwed = 0
  let totalOwe = 0

  for (const group of groups) {
    const balanceMap = calculateGroupBalances(
      group.members,
      group.expenses,
      group.settlements
    )
    const balance = balanceMap[userId] ?? 0
    if (balance > 0) totalOwed += balance
    else totalOwe += Math.abs(balance)
  }

  const recentExpenses = await prisma.expense.findMany({
    where: { group: { members: { some: { userId } } } },
    include: {
      group: { select: { id: true, name: true } },
      paidBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const monthlyExpenses = await prisma.expense.groupBy({
    by: ["date"],
    where: {
      group: { members: { some: { userId } } },
      date: { gte: sixMonthsAgo },
    },
    _sum: { amount: true },
  })

  const monthlyMap: Record<string, number> = {}
  for (const e of monthlyExpenses) {
    const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`
    monthlyMap[key] = (monthlyMap[key] ?? 0) + (e._sum.amount ?? 0)
  }

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    return {
      month: d.toLocaleString("default", { month: "short" }),
      amount: Math.round((monthlyMap[key] ?? 0) * 100) / 100,
    }
  })

  return NextResponse.json({
    totalOwed: Math.round(totalOwed * 100) / 100,
    totalOwe: Math.round(totalOwe * 100) / 100,
    netBalance: Math.round((totalOwed - totalOwe) * 100) / 100,
    groupCount: groups.length,
    recentExpenses,
    chartData,
  })
}
