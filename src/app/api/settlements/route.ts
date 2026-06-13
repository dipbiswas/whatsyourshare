import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { sendPushToUser } from "@/lib/push"
import { notifyUser, sendSettlementEmail } from "@/lib/email"
import { z } from "zod"

const INSTANT_FEE_USD = 0.25   // flat fee charged to payer for instant ACH
const INSTANT_PLATFORM_KEEP = 0.10  // our revenue per instant transfer

const schema = z.object({
  groupId: z.string(),
  fromUserId: z.string().optional(), // defaults to current user; allows recording on behalf of others
  toUserId: z.string(),
  amount: z.number().positive(),
  note: z.string().max(200).optional(),
  paymentMethod: z.enum(["MANUAL", "STRIPE_ACH", "STRIPE_INSTANT"]).default("MANUAL"),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { paymentMethod, fromUserId: requestedFromId, ...rest } = parsed.data

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId: rest.groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Use requested fromUserId if provided and they're a group member; otherwise default to self
  const fromUserId = requestedFromId ?? session.user.id
  if (fromUserId !== session.user.id) {
    const fromIsMember = await prisma.groupMember.findFirst({
      where: { groupId: rest.groupId, userId: fromUserId },
    })
    if (!fromIsMember) return NextResponse.json({ error: "fromUserId is not a group member" }, { status: 400 })
  }

  const group = await prisma.group.findUnique({ where: { id: rest.groupId } })

  // For Stripe settlements verify both users are Connect-onboarded
  if (paymentMethod === "STRIPE_ACH" || paymentMethod === "STRIPE_INSTANT") {
    const [payer, payee] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromUserId } }),
      prisma.user.findUnique({ where: { id: rest.toUserId } }),
    ])

    if (!payer?.stripeConnectId || !payer.stripeOnboarded) {
      return NextResponse.json(
        { error: "You must connect your Stripe account first in Settings" },
        { status: 400 }
      )
    }
    if (!payee?.stripeConnectId || !payee.stripeOnboarded) {
      return NextResponse.json(
        { error: "The recipient hasn't connected their Stripe account yet" },
        { status: 400 }
      )
    }

    const amountInCents = Math.round(rest.amount * 100)
    const isInstant = paymentMethod === "STRIPE_INSTANT"
    const totalCharge = isInstant
      ? amountInCents + Math.round(INSTANT_FEE_USD * 100)
      : amountInCents

    // Create a Payment Intent from payer to payee via Connect
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCharge,
      currency: (group?.currency ?? "USD").toLowerCase(),
      payment_method_types: isInstant ? ["us_bank_account"] : ["us_bank_account"],
      transfer_data: { destination: payee.stripeConnectId },
      // Platform fee: for instant we keep $0.10
      application_fee_amount: isInstant ? Math.round(INSTANT_PLATFORM_KEEP * 100) : 0,
      metadata: {
        fromUserId,
        toUserId: rest.toUserId,
        groupId: rest.groupId,
        instant: String(isInstant),
      },
    })

    const settlement = await prisma.settlement.create({
      data: {
        ...rest,
        fromUserId,
        currency: group?.currency ?? "USD",
        paymentMethod,
        status: "PROCESSING",
        stripePaymentIntentId: paymentIntent.id,
      },
      include: {
        fromUser: { select: { id: true, name: true, avatar: true } },
        toUser: { select: { id: true, name: true, avatar: true } },
      },
    })

    await prisma.group.update({ where: { id: rest.groupId }, data: { updatedAt: new Date() } })

    return NextResponse.json({
      settlement,
      clientSecret: paymentIntent.client_secret,
      requiresAction: true,
    }, { status: 201 })
  }

  // MANUAL settlement — just record it, then push-notify recipient
  const settlement = await prisma.settlement.create({
    data: {
      ...rest,
      fromUserId,
      currency: group?.currency ?? "USD",
      paymentMethod: "MANUAL",
      status: "COMPLETED",
      completedAt: new Date(),
    },
    include: {
      fromUser: { select: { id: true, name: true, avatar: true } },
      toUser: { select: { id: true, name: true, avatar: true } },
    },
  })

  await prisma.group.update({ where: { id: rest.groupId }, data: { updatedAt: new Date() } })

  sendPushToUser(rest.toUserId, {
    title: "Payment received 🎉",
    body: `${settlement.fromUser.name} paid you $${rest.amount.toFixed(2)}`,
    url: `/groups/${rest.groupId}`,
    tag: `settlement-${settlement.id}`,
  }).catch(() => {})

  notifyUser(rest.toUserId, "settledWithMe", (to, name) =>
    sendSettlementEmail({
      to, name,
      fromName: settlement.fromUser.name,
      amount: rest.amount,
      currency: group?.currency ?? "USD",
      groupName: group?.name ?? "your group",
      groupId: rest.groupId,
    })
  ).catch(() => {})

  return NextResponse.json(settlement, { status: 201 })
}
