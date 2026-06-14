import { prisma } from "@/lib/prisma"
import { planLimits, currentMonth } from "@/lib/plan"

export type QuotaCheckResult =
  | { allowed: false; reason: "plan_limit" | "exhausted"; message: string }
  | { allowed: true; useBonus: boolean; monthlyUsed: number; monthlyLimit: number; bonusScans: number }

/** Check if userId can run a scan. Does NOT deduct yet. */
export async function checkScanQuota(userId: string, feature: string): Promise<QuotaCheckResult> {
  const user = await (prisma.user.findUnique as any)({
    where: { id: userId },
    select: { plan: true, bonusScans: true },
  })

  const plan = (user?.plan ?? "FREE") as "FREE" | "PRO" | "FAMILY"
  const limits = await planLimits(plan)
  const bonusScans: number = user?.bonusScans ?? 0

  if (limits.maxAiScans === 0 && bonusScans === 0) {
    return { allowed: false, reason: "plan_limit", message: "Receipt scanning is a Pro feature. Upgrade to scan receipts." }
  }

  const month = currentMonth()
  const usage = await (prisma as any).usageRecord.findUnique({
    where: { userId_feature_month: { userId, feature, month } },
    select: { count: true },
  })
  const monthlyUsed: number = usage?.count ?? 0

  if (monthlyUsed < limits.maxAiScans) {
    return { allowed: true, useBonus: false, monthlyUsed, monthlyLimit: limits.maxAiScans, bonusScans }
  }

  if (bonusScans > 0) {
    return { allowed: true, useBonus: true, monthlyUsed, monthlyLimit: limits.maxAiScans, bonusScans }
  }

  return {
    allowed: false,
    reason: "exhausted",
    message: `You've used all ${limits.maxAiScans} monthly scans. Top up to keep going.`,
  }
}

/** Deduct one scan after a successful call. */
export async function deductScan(userId: string, feature: string, useBonus: boolean) {
  const month = currentMonth()
  if (useBonus) {
    await (prisma.user.update as any)({ where: { id: userId }, data: { bonusScans: { decrement: 1 } } })
  } else {
    await (prisma as any).usageRecord.upsert({
      where: { userId_feature_month: { userId, feature, month } },
      update: { count: { increment: 1 } },
      create: { userId, feature, month, count: 1 },
    })
  }
}
