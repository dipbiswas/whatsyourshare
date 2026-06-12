/**
 * POST /api/cards/[groupId]/issue
 * Issues a Stripe Issuing virtual card tied to this group.
 * Requires TEAM workspace. Admin only.
 *
 * Body: { spendLimit: number, spendLimitInterval: "daily"|"weekly"|"monthly", currency?: string }
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { z } from "zod"

const schema = z.object({
  spendLimit: z.number().positive(),
  spendLimitInterval: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
  currency: z.string().length(3).default("USD"),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { groupId } = await params

  // Must be admin
  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId: session.user.id, role: "ADMIN" },
  })
  if (!membership) return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const existing = await prisma.groupCard.findUnique({ where: { groupId } })
  if (existing) return NextResponse.json({ error: "Card already issued for this group" }, { status: 409 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { spendLimit, spendLimitInterval, currency } = parsed.data

  // Ensure cardholder exists for the admin user
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  let cardholderId = user?.stripeCardholderId

  if (!cardholderId) {
    const cardholder = await stripe.issuing.cardholders.create({
      name: user?.name ?? "Group Admin",
      email: user?.email ?? undefined,
      type: "company",
      billing: {
        address: {
          line1: "123 Main St",
          city: "San Francisco",
          state: "CA",
          postal_code: "94111",
          country: "US",
        },
      },
    })
    cardholderId = cardholder.id
    await prisma.user.update({ where: { id: session.user.id }, data: { stripeCardholderId: cardholderId } })
  }

  const card = await stripe.issuing.cards.create({
    cardholder: cardholderId,
    currency: currency.toLowerCase(),
    type: "virtual",
    spending_controls: {
      spending_limits: [
        {
          amount: Math.round(spendLimit * 100),
          interval: spendLimitInterval,
        },
      ],
    },
    metadata: { groupId },
  })

  const groupCard = await prisma.groupCard.create({
    data: {
      groupId,
      stripeCardId: card.id,
      stripeCardholderIds: cardholderId,
      last4: (card as { last4?: string }).last4 ?? "",
      brand: (card as { brand?: string }).brand ?? "Visa",
      status: "ACTIVE",
      spendLimit,
      spendLimitInterval: spendLimitInterval.toUpperCase(),
      currency: currency.toUpperCase(),
    },
  })

  return NextResponse.json(groupCard, { status: 201 })
}
