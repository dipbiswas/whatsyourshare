import { NextResponse } from "next/server"
import { config } from "@/lib/config"

export const dynamic = "force-dynamic"

export async function GET() {
  const stripeEnabled = await config.platform.stripeEnabled().catch(() => false)
  return NextResponse.json({ stripeEnabled })
}
