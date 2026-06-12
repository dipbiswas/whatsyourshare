"use client"

import { useEffect, useState } from "react"

type Plan = "FREE" | "PRO" | "FAMILY"

interface BillingStatus {
  plan: Plan
  isActive: boolean
}

const PLAN_RANK: Record<Plan, number> = { FREE: 0, PRO: 1, FAMILY: 2 }

export function useFeatureGate(requiredPlan: Plan = "PRO") {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BillingStatus | null) => setStatus(data))
      .finally(() => setLoading(false))
  }, [])

  const allowed =
    status !== null &&
    (status.plan === "FREE" ? false : PLAN_RANK[status.plan] >= PLAN_RANK[requiredPlan]) &&
    status.isActive

  return { allowed, loading, plan: status?.plan ?? "FREE" }
}
