/**
 * POST /api/billing/webhook
 * Handles Stripe Billing subscription lifecycle events.
 */
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import type Stripe from "stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature") ?? ""
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? ""

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const PLAN_MAP: Record<string, "FREE" | "PRO" | "FAMILY"> = {
    PRO: "PRO",
    FAMILY: "FAMILY",
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session
      const userId = cs.metadata?.userId
      if (!userId) break

      if (cs.mode === "subscription") {
        const planKey = cs.metadata?.plan ?? "PRO"
        const subscriptionId = cs.subscription as string
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: PLAN_MAP[planKey] ?? "PRO",
            stripeSubscriptionId: subscriptionId,
            planExpiresAt: null,
          },
        })
      } else if (cs.mode === "payment" && cs.metadata?.type === "scan_topup") {
        const scans = parseInt(cs.metadata.scans ?? "0", 10)
        if (scans > 0) {
          await (prisma.user.update as any)({
            where: { id: userId },
            data: { bonusScans: { increment: scans } },
          })
        }
      }
      break
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string; subscription_details?: { metadata?: Record<string, string> } }
      const userId = invoice.subscription_details?.metadata?.userId
      if (!userId) break
      // Extend access — subscription is active
      await prisma.user.updateMany({
        where: { id: userId },
        data: { planExpiresAt: null },
      })
      break
    }

    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      const sub = event.data.object as Stripe.Subscription & { metadata?: Record<string, string> }
      const userId = sub.metadata?.userId
      if (!userId) break
      await prisma.user.updateMany({
        where: { id: userId },
        data: { plan: "FREE", planExpiresAt: new Date(), stripeSubscriptionId: null },
      })
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
