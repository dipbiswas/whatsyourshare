/**
 * POST /api/connect/onboard
 *
 * Creates a Stripe Connect Express account (if not exists) and returns
 * an account onboarding link. Users complete KYC on Stripe's hosted page,
 * then return to /settings?connect=success.
 *
 * After onboarding the user can receive ACH transfers for settled debts.
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function POST() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

  let connectId = user.stripeConnectId

  // Create Express account if first time
  if (!connectId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      metadata: { userId: user.id },
    })
    connectId = account.id
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeConnectId: connectId },
    })
  }

  // Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: connectId,
    refresh_url: `${appUrl}/settings?connect=refresh`,
    return_url: `${appUrl}/settings?connect=success`,
    type: "account_onboarding",
  })

  return NextResponse.json({ url: accountLink.url })
}
