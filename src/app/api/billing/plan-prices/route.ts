import { NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function GET() {
  const [proPriceCents, familyPriceCents] = await Promise.all([
    config.pricing.planPro(),
    config.pricing.planFamily(),
  ])

  return NextResponse.json({
    pro: proPriceCents,
    family: familyPriceCents,
  })
}
