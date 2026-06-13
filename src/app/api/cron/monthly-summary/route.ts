/**
 * POST /api/cron/monthly-summary
 *
 * Runs on the 1st of each month at 08:00 UTC (see vercel.json).
 * Secured with CRON_SECRET header.
 *
 * For every user with notificationPrefs.monthlySummary === true:
 *   1. Computes last month's expenses across all their groups
 *   2. Builds a per-group breakdown + top categories + balance
 *   3. Sends a summary email via Resend
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendMonthlySummaryEmail } from "@/lib/email"
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns"

const APP_URL = process.env.NEXTAUTH_URL ?? "https://whatsyourshare.app"

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Last month window
  const lastMonth = subMonths(new Date(), 1)
  const from = startOfMonth(lastMonth)
  const to = endOfMonth(lastMonth)
  const monthLabel = format(lastMonth, "MMMM")
  const yearLabel = lastMonth.getFullYear()

  // Fetch all users who want monthly summaries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await (prisma.user.findMany as any)({
    where: {},
    select: {
      id: true,
      name: true,
      email: true,
      notificationPrefs: true,
      groupMemberships: {
        select: {
          group: {
            select: {
              id: true,
              name: true,
              currency: true,
            },
          },
        },
      },
    },
  })

  let sent = 0
  let skipped = 0

  for (const user of users) {
    const prefs = (user.notificationPrefs ?? {}) as Record<string, boolean>
    if (prefs.monthlySummary === false) { skipped++; continue }

    const groupIds: string[] = user.groupMemberships.map(
      (m: { group: { id: string } }) => m.group.id
    )
    if (groupIds.length === 0) { skipped++; continue }

    // Fetch last month's expenses across all user's groups
    const expenses = await prisma.expense.findMany({
      where: {
        groupId: { in: groupIds },
        date: { gte: from, lte: to },
      },
      include: {
        splits: true,
        group: { select: { id: true, name: true, currency: true } },
      },
    })

    if (expenses.length === 0) { skipped++; continue }

    // Total spent per currency (full expense amounts, not just user's share)
    const totalByCurrency: Record<string, number> = {}
    for (const e of expenses) {
      totalByCurrency[e.currency] = (totalByCurrency[e.currency] ?? 0) + e.amount
    }
    const totalSpent = Object.entries(totalByCurrency).map(([currency, amount]) => ({ currency, amount }))

    // Per-group breakdown
    const groupMap = new Map<string, { name: string; currency: string; spent: number; balance: number }>()
    for (const e of expenses) {
      const g = e.group
      if (!groupMap.has(g.id)) groupMap.set(g.id, { name: g.name, currency: g.currency, spent: 0, balance: 0 })
      const entry = groupMap.get(g.id)!
      entry.spent += e.amount
      // User's share for this expense
      const myShare = e.splits.find((s: { userId: string }) => s.userId === user.id)?.amount ?? 0
      const iPaid = e.paidById === user.id ? e.amount : 0
      entry.balance += iPaid - myShare
    }

    const groups = Array.from(groupMap.values()).map((g) => ({
      name: g.name,
      currency: g.currency,
      spent: g.spent,
      youOwe: -g.balance, // positive = user owes, negative = owed to user
    }))

    // Top categories (user's share only)
    const catMap: Record<string, { amount: number; currency: string }> = {}
    for (const e of expenses) {
      const myShare = e.splits.find((s: { userId: string }) => s.userId === user.id)?.amount ?? 0
      if (myShare === 0) continue
      const key = e.category
      if (!catMap[key]) catMap[key] = { amount: 0, currency: e.currency }
      catMap[key].amount += myShare
    }
    const topCategories = Object.entries(catMap)
      .map(([category, { amount, currency }]) => ({ category, amount, currency }))
      .sort((a, b) => b.amount - a.amount)

    try {
      await sendMonthlySummaryEmail({
        to: user.email,
        name: user.name,
        month: monthLabel,
        year: yearLabel,
        totalSpent,
        groups,
        topCategories,
        dashboardUrl: APP_URL,
      })
      sent++
    } catch (err) {
      console.error(`Failed to send summary to ${user.email}:`, err)
    }
  }

  return NextResponse.json({ sent, skipped })
}
