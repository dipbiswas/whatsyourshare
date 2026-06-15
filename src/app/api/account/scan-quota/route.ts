import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkScanQuota } from "@/lib/scan-quota"

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const quota = await checkScanQuota(session.user.id, "ai_action_items")
  if (!quota.allowed) {
    return NextResponse.json({ remaining: 0, bonusScans: 0 })
  }

  const monthly = quota.monthlyLimit - quota.monthlyUsed
  return NextResponse.json({
    remaining: monthly + quota.bonusScans,
    monthlyRemaining: monthly,
    bonusScans: quota.bonusScans,
  })
}
