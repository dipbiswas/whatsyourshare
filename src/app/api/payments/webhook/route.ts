/**
 * POST /api/payments/webhook
 *
 * Stripe webhook endpoint. Handles:
 *  - checkout.session.completed  → mark contribution PAID
 *  - checkout.session.expired    → (no-op, user can retry)
 *
 * Configure in Stripe Dashboard:
 *   Endpoint: https://yourapp.com/api/payments/webhook
 *   Events:   checkout.session.completed
 */
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import type Stripe from "stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature") ?? ""
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ""

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    const stripeSessionId = session.id
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null

    // Find and mark the contribution paid
    const contribution = await prisma.fundContribution.findUnique({
      where: { stripeSessionId },
    })

    if (contribution && contribution.status !== "PAID") {
      await prisma.fundContribution.update({
        where: { id: contribution.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          stripePaymentIntentId: paymentIntentId,
        },
      })
    }
  }

  return NextResponse.json({ received: true })
}

// Stripe sends raw bodies — disable Next.js body parsing
export const config = { api: { bodyParser: false } }
