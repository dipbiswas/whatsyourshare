/**
 * POST /api/cards/webhook
 * Handles Stripe Issuing authorization and transaction events.
 * On authorization: approve and record CardTransaction.
 * On transaction settled: auto-create an Expense and split evenly among group members.
 */
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import type Stripe from "stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature") ?? ""
  const secret = process.env.STRIPE_ISSUING_WEBHOOK_SECRET ?? ""

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "issuing_authorization.request") {
    // Auto-approve all transactions — spending controls on the card itself enforce limits
    return NextResponse.json({ approved: true })
  }

  if (event.type === "issuing_transaction.created") {
    const txn = event.data.object as Stripe.Issuing.Transaction
    const groupId = txn.card
      ? (await stripe.issuing.cards.retrieve(txn.card as string)).metadata?.groupId
      : null

    if (!groupId) return NextResponse.json({ received: true })

    const groupCard = await prisma.groupCard.findUnique({ where: { groupId } })
    if (!groupCard) return NextResponse.json({ received: true })

    const amountUsd = Math.abs(txn.amount) / 100

    // Record the card transaction
    const cardTxn = await prisma.cardTransaction.create({
      data: {
        groupId,
        cardId: groupCard.id,
        stripeAuthId: txn.id,
        amount: amountUsd,
        currency: txn.currency.toUpperCase(),
        merchantName: txn.merchant_data?.name ?? "Unknown Merchant",
        merchantCategory: txn.merchant_data?.category ?? "other",
        approved: true,
      },
    })

    // Auto-create a group expense and split among all active members
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    })

    if (!members.length) return NextResponse.json({ received: true })

    const adminMember = await prisma.groupMember.findFirst({ where: { groupId, role: "ADMIN" }, select: { userId: true } })
    const paidById = adminMember?.userId ?? members[0].userId

    const splitAmount = amountUsd / members.length

    const expense = await prisma.expense.create({
      data: {
        groupId,
        description: cardTxn.merchantName,
        amount: amountUsd,
        currency: cardTxn.currency,
        category: cardTxn.merchantCategory,
        splitType: "EQUAL",
        paidById,
        cardTransactionId: cardTxn.id,
        approvalStatus: "APPROVED",
        splits: {
          create: members.map(({ userId }) => ({
            userId,
            amount: splitAmount,
            isPaid: userId === paidById,
          })),
        },
      },
    })

    // The Expense.cardTransactionId already links them (set during expense creation)
    void expense
  }

  return NextResponse.json({ received: true })
}
