/**
 * POST /api/billing/portal
 * Creates a Stripe Billing Portal session so users can manage their subscription.
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found. Subscribe first." }, { status: 400 })
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000"

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/settings`,
  })

  return NextResponse.json({ url: portalSession.url })
}
