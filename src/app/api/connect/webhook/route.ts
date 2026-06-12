/**
 * POST /api/connect/webhook
 *
 * Handles Stripe Connect account.updated events to auto-sync onboarding status.
 */
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import type Stripe from "stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature") ?? ""
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? ""

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account
    const onboarded = account.details_submitted && !account.requirements?.currently_due?.length

    await prisma.user.updateMany({
      where: { stripeConnectId: account.id },
      data: { stripeOnboarded: onboarded ?? false },
    })
  }

  // Transfer paid → mark settlement COMPLETED
  // Note: "transfer.paid" is not in the strict Stripe event union; use a type assertion.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((event as any).type === "transfer.paid") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transfer = (event as any).data.object as Stripe.Transfer
    if (transfer.metadata?.settlementId) {
      await prisma.settlement.update({
        where: { id: transfer.metadata.settlementId },
        data: { status: "COMPLETED", completedAt: new Date() },
      })
    }
  }

  return NextResponse.json({ received: true })
}
