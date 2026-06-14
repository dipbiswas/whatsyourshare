import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

const PRO_PRICE = 4
const FAMILY_PRICE = 12
const TOPUP_SMALL_PRICE = 2.49
const TOPUP_LARGE_PRICE = 6.99
const TOPUP_SMALL_SCANS = 10
const TOPUP_LARGE_SCANS = 50

export async function GET() {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [planCounts, newThisMonth, newLastMonth] = await Promise.all([
    // Current subscriber counts
    (prisma.user.groupBy as any)({
      by: ["plan"],
      _count: { plan: true },
    }),
    // New paying users this month
    (prisma.user.count as any)({
      where: { plan: { not: "FREE" }, createdAt: { gte: startOfMonth } },
    }),
    // New paying users last month
    (prisma.user.count as any)({
      where: { plan: { not: "FREE" }, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),
  ])

  const counts: Record<string, number> = {}
  for (const row of planCounts) counts[row.plan] = row._count.plan

  const proCount = counts["PRO"] ?? 0
  const familyCount = counts["FAMILY"] ?? 0
  const freeCount = counts["FREE"] ?? 0
  const mrr = proCount * PRO_PRICE + familyCount * FAMILY_PRICE

  // Estimate top-up revenue from bonus scan grants in last 30 days
  // We track bonusScans on the user but not purchase history yet,
  // so we approximate from usageRecord bonus deductions — for now surface scan purchases
  // by looking at users whose bonusScans > 0 (rough proxy)
  const usersWithBonus = await (prisma.user.count as any)({ where: { bonusScans: { gt: 0 } } })

  // Monthly history (last 6 months)
  const history = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" })
      return (prisma.user.count as any)({ where: { plan: { not: "FREE" }, createdAt: { gte: d, lt: end } } })
        .then((count: number) => ({ label, newSubscribers: count }))
    })
  )

  // Churn: users who downgraded to FREE in last 30 days (approximate via planExpiresAt)
  const recentChurn = await (prisma.user.count as any)({
    where: { plan: "FREE", planExpiresAt: { gte: thirtyDaysAgo } },
  })

  return NextResponse.json({
    mrr,
    proCount,
    familyCount,
    freeCount,
    totalUsers: proCount + familyCount + freeCount,
    newPayingThisMonth: newThisMonth,
    newPayingLastMonth: newLastMonth,
    recentChurn,
    usersWithBonusScans: usersWithBonus,
    history: history.reverse(),
    pricing: { pro: PRO_PRICE, family: FAMILY_PRICE, topupSmall: TOPUP_SMALL_PRICE, topupLarge: TOPUP_LARGE_PRICE },
  })
}
