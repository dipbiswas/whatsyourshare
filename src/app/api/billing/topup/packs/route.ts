import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { config } from "@/lib/config"

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [small, large] = await Promise.all([
    config.pricing.topupSmall(),
    config.pricing.topupLarge(),
  ])

  return NextResponse.json({
    small: { scans: small.scans, priceCents: small.priceCents },
    large: { scans: large.scans, priceCents: large.priceCents },
  })
}
