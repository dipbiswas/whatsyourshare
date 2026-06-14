/**
 * POST /api/payments/checkout
 *
 * Creates a Stripe Checkout Session for a trip fund contribution.
 * The platform earns 1.5% on every successful payment.
 *
 * Body: { tripId, amount }  (amount in the fund's currency, e.g. 200 = $200.00)
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { config } from "@/lib/config"
import { z } from "zod"

const schema = z.object({
  tripId: z.string(),
  amount: z.number().positive(),
})

function errJson(err: unknown) {
  const e = err as Record<string, unknown>
  return {
    message: (err instanceof Error ? err.message : null) ?? String(err),
    code: e?.code,
    type: e?.type,
    param: e?.param,
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { tripId, amount } = parsed.data

    // Fetch the trip + fund
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, group: { members: { some: { userId: session.user.id } } } },
      include: {
        fund: true,
        group: { select: { currency: true } },
      },
    })

    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 })
    if (!trip.fund) return NextResponse.json({ error: "No fund set up for this trip" }, { status: 400 })
    if (trip.fund.status !== "COLLECTING") {
      return NextResponse.json({ error: "Fund is no longer collecting" }, { status: 400 })
    }

    const currency = (trip.fund.currency ?? trip.group.currency ?? "usd").toLowerCase()
    const amountInCents = Math.round(amount * 100)
    const feeRate = await config.platform.feeRate().catch(() => 0.015)
    const platformFeeInCents = Math.round(amountInCents * feeRate)

    const appUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    console.log("[payments/checkout] appUrl:", appUrl, "currency:", currency, "amountInCents:", amountInCents)

    // Create or update a PENDING contribution row first
    const contribution = await prisma.fundContribution.upsert({
      where: { fundId_userId: { fundId: trip.fund.id, userId: session.user.id } },
      create: {
        fundId: trip.fund.id,
        userId: session.user.id,
        amount,
        status: "PENDING",
      },
      update: { amount, status: "PENDING" },
    })

    // Create Stripe Checkout Session
    let checkoutSession: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
    try {
      checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `Trip Fund: ${trip.name}`,
                description: trip.fund.description ?? `Contribution to ${trip.name} trip fund`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          tripId,
          fundId: trip.fund.id,
          userId: session.user.id,
          contributionId: contribution.id,
          platformFeeInCents: String(platformFeeInCents),
        },
        success_url: `${appUrl}/trips/${tripId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/trips/${tripId}?payment=cancelled`,
      })
    } catch (err: unknown) {
      const info = errJson(err)
      console.error("[payments/checkout] Stripe error:", JSON.stringify(info))
      return NextResponse.json({ error: info.message, ...info }, { status: 502 })
    }

    // Store the Stripe session ID on the contribution
    await prisma.fundContribution.update({
      where: { id: contribution.id },
      data: { stripeSessionId: checkoutSession.id },
    })

    return NextResponse.json({ url: checkoutSession.url, sessionId: checkoutSession.id })
  } catch (err: unknown) {
    const info = errJson(err)
    console.error("[payments/checkout] Unhandled error:", JSON.stringify(info))
    return NextResponse.json({ error: info.message, ...info }, { status: 500 })
  }
}
