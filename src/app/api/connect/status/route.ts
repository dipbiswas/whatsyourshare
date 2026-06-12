import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user?.stripeConnectId) {
    return NextResponse.json({ connected: false, onboarded: false })
  }

  const account = await stripe.accounts.retrieve(user.stripeConnectId)
  const onboarded = account.details_submitted && !account.requirements?.currently_due?.length

  if (onboarded && !user.stripeOnboarded) {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeOnboarded: true },
    })
  }

  return NextResponse.json({
    connected: true,
    onboarded: onboarded ?? false,
    connectId: user.stripeConnectId,
    payoutsEnabled: account.payouts_enabled,
    chargesEnabled: account.charges_enabled,
  })
}
