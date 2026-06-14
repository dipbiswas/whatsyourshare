import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    stripeEnabled: process.env.STRIPE_ENABLED === "true",
  })
}
