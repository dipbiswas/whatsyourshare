import { prisma } from "@/lib/prisma"

// In-memory cache keyed by config key, with TTL
let cache: Map<string, { value: unknown; expiresAt: number }> = new Map()
const CACHE_TTL_MS = 60_000 // 1 minute

function parseValue(raw: string, type: string): unknown {
  if (type === "boolean") return raw === "true"
  if (type === "number") return parseFloat(raw)
  try { return JSON.parse(raw) } catch { return raw }
}

async function get(key: string): Promise<unknown> {
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const row = await (prisma as any).systemConfig.findUnique({ where: { key } })
  if (!row) throw new Error(`Config key "${key}" not found`)

  const value = parseValue(row.value, row.type)
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  return value
}

export function invalidateCache() {
  cache = new Map()
}

// Typed getters
export const config = {
  platform: {
    feeRate:       () => get("platform.fee_rate")       as Promise<number>,
    aiModel:       () => get("platform.ai_model")       as Promise<string>,
    aiMaxTokens:   () => get("platform.ai_max_tokens")  as Promise<number>,
    stripeEnabled: () => get("platform.stripe_enabled") as Promise<boolean>,
    adminEmail:    () => get("platform.admin_email")    as Promise<string>,
  },
  pricing: {
    topupSmall: () => Promise.all([
      get("pricing.topup_small.scans")          as Promise<number>,
      get("pricing.topup_small.price_cents")    as Promise<number>,
      get("pricing.topup_small.stripe_price_id")as Promise<string>,
    ]).then(([scans, priceCents, stripeId]) => ({ scans, priceCents, stripeId })),
    topupLarge: () => Promise.all([
      get("pricing.topup_large.scans")          as Promise<number>,
      get("pricing.topup_large.price_cents")    as Promise<number>,
      get("pricing.topup_large.stripe_price_id")as Promise<string>,
    ]).then(([scans, priceCents, stripeId]) => ({ scans, priceCents, stripeId })),
    planPro:          () => get("pricing.plan_pro.price_cents")        as Promise<number>,
    planFamily:       () => get("pricing.plan_family.price_cents")     as Promise<number>,
    planProStripeId:  () => get("pricing.plan_pro.stripe_price_id")    as Promise<string>,
    planFamilyStripeId: () => get("pricing.plan_family.stripe_price_id") as Promise<string>,
  },
  plans: {
    free: () => Promise.all([
      get("plans.free.max_groups")        as Promise<number>,
      get("plans.free.max_ai_scans")      as Promise<number>,
      get("plans.free.can_create_events") as Promise<boolean>,
    ]).then(([maxGroups, maxAiScans, canCreateEvents]) => ({ maxGroups, maxAiScans, canCreateEvents })),
    pro: () => Promise.all([
      get("plans.pro.max_groups")        as Promise<number>,
      get("plans.pro.max_ai_scans")      as Promise<number>,
      get("plans.pro.can_create_events") as Promise<boolean>,
    ]).then(([maxGroups, maxAiScans, canCreateEvents]) => ({ maxGroups, maxAiScans, canCreateEvents })),
    family: () => Promise.all([
      get("plans.family.max_groups")        as Promise<number>,
      get("plans.family.max_ai_scans")      as Promise<number>,
      get("plans.family.can_create_events") as Promise<boolean>,
    ]).then(([maxGroups, maxAiScans, canCreateEvents]) => ({ maxGroups, maxAiScans, canCreateEvents })),
  },
}
