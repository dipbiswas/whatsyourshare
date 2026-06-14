import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { planLimits, currentMonth } from "@/lib/plan"

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  const user = await (prisma.user.findUnique as any)({
    where: { id: userId },
    select: { plan: true, bonusScans: true },
  })

  const plan = (user?.plan ?? "FREE") as "FREE" | "PRO" | "FAMILY"
  const limits = planLimits(plan)
  const bonusScans: number = user?.bonusScans ?? 0

  const [groupCount, receiptUsage, insightUsage] = await Promise.all([
    prisma.groupMember.count({ where: { userId, role: "ADMIN" } }),
    (prisma as any).usageRecord.findUnique({
      where: { userId_feature_month: { userId, feature: "receipt_scan", month: currentMonth() } },
      select: { count: true },
    }),
    (prisma as any).usageRecord.findUnique({
      where: { userId_feature_month: { userId, feature: "ai_insight", month: currentMonth() } },
      select: { count: true },
    }),
  ])

  const monthlyUsed = (receiptUsage?.count ?? 0) + (insightUsage?.count ?? 0)

  return NextResponse.json({
    plan,
    groupCount,
    maxGroups: limits.maxGroups === Infinity ? null : limits.maxGroups,
    canCreateEvents: limits.canCreateEvents,
    aiScansUsed: monthlyUsed,
    aiScansLimit: limits.maxAiScans,
    bonusScans,
  })
}
