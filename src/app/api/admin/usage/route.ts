import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET() {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check

  const month = new Date().toISOString().slice(0, 7)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    scansThisMonth,
    topScanners,
    groupsTotal,
    groupsThisMonth,
    expensesTotal,
    expensesThisMonth,
    settlementsThisMonth,
    tripsTotal,
    recurringTotal,
    usersWithEvents,
    usersWithRecurring,
  ] = await Promise.all([
    prisma.user.count(),
    // Total scans this month across all features
    (prisma as any).usageRecord.aggregate({
      where: { month },
      _sum: { count: true },
    }),
    // Top 10 scan consumers this month
    (prisma as any).usageRecord.groupBy({
      by: ["userId"],
      where: { month },
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
      take: 10,
    }),
    prisma.group.count(),
    prisma.group.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.expense.count(),
    prisma.expense.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.settlement.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.trip.count(),
    prisma.recurringExpense.count(),
    // Users who have created at least one event
    (prisma.user.count as any)({ where: { createdTrips: { some: {} } } }),
    // Users who have created recurring expenses
    (prisma.user.count as any)({ where: { createdRecurringExpenses: { some: {} } } }),
  ])

  // Resolve top scanner names
  const scannerIds = topScanners.map((r: any) => r.userId)
  const scannerUsers = await prisma.user.findMany({
    where: { id: { in: scannerIds } },
    select: { id: true, name: true, email: true, plan: true },
  })
  const userMap = Object.fromEntries(scannerUsers.map((u) => [u.id, u]))
  const topScannersResolved = topScanners.map((r: any) => ({
    user: userMap[r.userId] ?? { id: r.userId, name: "Unknown", email: "", plan: "FREE" },
    scans: r._sum.count ?? 0,
  }))

  const paying = await (prisma.user.count as any)({ where: { plan: { not: "FREE" } } })

  return NextResponse.json({
    totalUsers,
    payingUsers: paying,
    scansThisMonth: scansThisMonth._sum.count ?? 0,
    topScanners: topScannersResolved,
    groups: { total: groupsTotal, thisMonth: groupsThisMonth },
    expenses: { total: expensesTotal, thisMonth: expensesThisMonth },
    settlementsThisMonth,
    trips: { total: tripsTotal },
    recurringExpenses: { total: recurringTotal },
    featureAdoption: {
      events:    paying > 0 ? Math.round((usersWithEvents    / Math.max(paying, 1)) * 100) : 0,
      recurring: paying > 0 ? Math.round((usersWithRecurring / Math.max(paying, 1)) * 100) : 0,
    },
  })
}
