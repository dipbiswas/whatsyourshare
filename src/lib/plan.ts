export type UserPlan = "FREE" | "PRO" | "FAMILY"

export const PLAN_LIMITS = {
  FREE:   { maxGroups: 3, maxAiScans: 0,  canCreateEvents: false },
  PRO:    { maxGroups: Infinity, maxAiScans: 20, canCreateEvents: true },
  FAMILY: { maxGroups: Infinity, maxAiScans: 20, canCreateEvents: true },
} as const

export function planLimits(plan: UserPlan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE
}

export function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
