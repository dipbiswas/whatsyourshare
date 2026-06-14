/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session for Pro or Family subscription.
 * Body: { plan: "PRO" | "FAMILY" }
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { config } from "@/lib/config"
import { z } from "zod"

const schema = z.object({
  plan: z.enum(["PRO", "FAMILY"]),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, stripeCustomerId: true },
  })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const origin = req.headers.get("origin") ?? "http://localhost:3000"

  // Create or reuse Stripe customer
  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: session.user.id },
    })
    customerId = customer.id
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    })
  }

  const stripeId = parsed.data.plan === "PRO"
    ? await config.pricing.planProStripeId().then((id) => id || process.env.STRIPE_PRICE_PRO || "")
    : await config.pricing.planFamilyStripeId().then((id) => id || process.env.STRIPE_PRICE_FAMILY || "")

  if (!stripeId) return NextResponse.json({ error: "Stripe price ID not configured for this plan" }, { status: 503 })

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: stripeId, quantity: 1 }],
    success_url: `${origin}/settings?billing=success`,
    cancel_url: `${origin}/settings?billing=cancelled`,
    metadata: { userId: session.user.id, plan: parsed.data.plan },
    subscription_data: { metadata: { userId: session.user.id, plan: parsed.data.plan } },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
