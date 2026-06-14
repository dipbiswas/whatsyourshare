/**
 * GET /api/payments/verify?sessionId=cs_xxx
 *
 * Called by the trip page after Stripe redirects back with ?session_id=...
 * Verifies the session with Stripe and syncs the contribution status.
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 })

  const stripeSession = await stripe.checkout.sessions.retrieve(sessionId)

  if (stripeSession.payment_status === "paid") {
    const contribution = await prisma.fundContribution.findFirst({
      where: { stripeSessionId: sessionId },
    })

    if (contribution && contribution.status !== "PAID") {
      await prisma.fundContribution.update({
        where: { id: contribution.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          stripePaymentIntentId:
            typeof stripeSession.payment_intent === "string"
              ? stripeSession.payment_intent
              : null,
        },
      })
    }
  }

  return NextResponse.json({ status: stripeSession.payment_status })
}
