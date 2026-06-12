import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, planExpiresAt: true, stripeSubscriptionId: true, stripeCustomerId: true },
  })

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let subscriptionStatus: string | null = null
  let currentPeriodEnd: Date | null = null

  if (user.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
      subscriptionStatus = sub.status
      currentPeriodEnd = new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000)
    } catch {
      // subscription may have been deleted
    }
  }

  return NextResponse.json({
    plan: user.plan,
    planExpiresAt: user.planExpiresAt,
    subscriptionStatus,
    currentPeriodEnd,
    isActive: user.plan !== "FREE" && (!user.planExpiresAt || user.planExpiresAt > new Date()),
  })
}
