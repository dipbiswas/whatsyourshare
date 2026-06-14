import { NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function GET() {
  const [proPriceCents, familyPriceCents, freeLimits] = await Promise.all([
    config.pricing.planPro(),
    config.pricing.planFamily(),
    config.plans.free(),
  ])

  return NextResponse.json({
    pro: proPriceCents,
    family: familyPriceCents,
    freeMaxGroups: freeLimits.maxGroups,
  })
}
