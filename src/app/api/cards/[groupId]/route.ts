/**
 * GET /api/cards/[groupId]
 * Returns the Stripe Issuing virtual card details for this group.
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { groupId } = await params

  const isMember = await prisma.groupMember.findFirst({ where: { groupId, userId: session.user.id } })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const groupCard = await prisma.groupCard.findUnique({
    where: { groupId },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 20 } },
  })

  if (!groupCard) return NextResponse.json(null)

  // Fetch live card details from Stripe Issuing (masked PAN, expiry)
  let stripeCard = null
  try {
    stripeCard = await stripe.issuing.cards.retrieve(groupCard.stripeCardId)
  } catch {
    // Gracefully degrade if Stripe Issuing not available in this account
  }

  return NextResponse.json({
    id: groupCard.id,
    groupId,
    stripeCardId: groupCard.stripeCardId,
    status: groupCard.status,
    spendLimit: groupCard.spendLimit,
    spendLimitInterval: groupCard.spendLimitInterval,
    currency: groupCard.currency,
    transactions: groupCard.transactions,
    last4: (stripeCard as { last4?: string } | null)?.last4,
    expMonth: (stripeCard as { exp_month?: number } | null)?.exp_month,
    expYear: (stripeCard as { exp_year?: number } | null)?.exp_year,
  })
}
