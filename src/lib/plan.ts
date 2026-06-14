import { config } from "@/lib/config"

export type UserPlan = "FREE" | "PRO" | "FAMILY"

export interface PlanLimits {
  maxGroups: number        // 0 = unlimited
  maxAiScans: number
  canCreateEvents: boolean
}

// Hardcoded fallback used only if DB config is unavailable
const PLAN_DEFAULTS: Record<string, PlanLimits> = {
  FREE:   { maxGroups: 3,  maxAiScans: 0,  canCreateEvents: false },
  PRO:    { maxGroups: 0,  maxAiScans: 20, canCreateEvents: true },
  FAMILY: { maxGroups: 0,  maxAiScans: 20, canCreateEvents: true },
}

/** Async — reads from DB config (with 1-min cache). Use this in API routes. */
export async function planLimits(plan: UserPlan | string): Promise<PlanLimits> {
  const key = String(plan).toUpperCase() as "FREE" | "PRO" | "FAMILY"
  try {
    if (key === "PRO")    return await config.plans.pro()
    if (key === "FAMILY") return await config.plans.family()
    return await config.plans.free()
  } catch {
    return PLAN_DEFAULTS[key] ?? PLAN_DEFAULTS.FREE
  }
}

export function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
