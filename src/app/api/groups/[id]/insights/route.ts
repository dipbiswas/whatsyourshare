import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { checkScanQuota, deductScan } from "@/lib/scan-quota"
import { calculateGroupBalances } from "@/lib/balance"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 })
  }

  // Plan / quota enforcement
  const quota = await checkScanQuota(userId, "ai_insight")
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, message: quota.message },
      { status: quota.reason === "plan_limit" ? 403 : 429 },
    )
  }

  // Fetch group data
  const isMember = await prisma.groupMember.findFirst({ where: { groupId: params.id, userId } })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const now = new Date()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [group, thisMonthExpenses, lastMonthExpenses, allExpenses, settlements] = await Promise.all([
    prisma.group.findUnique({
      where: { id: params.id },
      select: {
        name: true,
        currency: true,
        members: { select: { userId: true, user: { select: { name: true } } } },
      },
    }),
    prisma.expense.findMany({
      where: { groupId: params.id, date: { gte: startOfThisMonth } },
      select: { amount: true, category: true, description: true, date: true, paidById: true },
    }),
    prisma.expense.findMany({
      where: { groupId: params.id, date: { gte: startOfLastMonth, lt: startOfThisMonth } },
      select: { amount: true, category: true },
    }),
    prisma.expense.findMany({
      where: { groupId: params.id },
      select: { amount: true, category: true, paidById: true, splits: { select: { userId: true, amount: true } } },
    }),
    prisma.settlement.findMany({
      where: { groupId: params.id },
      select: { fromUserId: true, toUserId: true, amount: true },
    }),
  ])

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Compute per-category sums for this and last month
  const sumByCategory = (expenses: { amount: number; category: string }[]) => {
    const map: Record<string, number> = {}
    for (const e of expenses) map[e.category] = (map[e.category] ?? 0) + e.amount
    return map
  }
  const thisMonth = sumByCategory(thisMonthExpenses)
  const lastMonth = sumByCategory(lastMonthExpenses)

  // Compute balances for settlement recommendations
  const members = group.members.map((m) => ({ userId: m.userId }))
  const balanceMap = calculateGroupBalances(members, allExpenses as any, settlements)
  const balances = group.members
    .map((m) => ({ name: m.user.name, balance: Math.round((balanceMap[m.userId] ?? 0) * 100) / 100 }))
    .filter((b) => Math.abs(b.balance) >= 0.01)

  // Average expense amount to detect anomalies
  const avgByCategory: Record<string, number> = {}
  const countByCategory: Record<string, number> = {}
  for (const e of allExpenses) {
    avgByCategory[e.category] = (avgByCategory[e.category] ?? 0) + e.amount
    countByCategory[e.category] = (countByCategory[e.category] ?? 0) + 1
  }
  for (const cat of Object.keys(avgByCategory)) {
    avgByCategory[cat] = avgByCategory[cat] / countByCategory[cat]
  }
  const recentAnomalies = thisMonthExpenses
    .filter((e) => avgByCategory[e.category] && e.amount > avgByCategory[e.category] * 2.5)
    .map((e) => ({ description: e.description, amount: e.amount, category: e.category, avg: Math.round(avgByCategory[e.category]) }))

  const prompt = `You are a financial assistant for a group expense-splitting app. Analyze this group's data and return a JSON object with three keys: "spending", "settlement", "anomalies".

Group: ${group.name} (currency: ${group.currency})
Members: ${group.members.map((m) => m.user.name).join(", ")}

This month's spending by category: ${JSON.stringify(thisMonth)}
Last month's spending by category: ${JSON.stringify(lastMonth)}
Current balances (positive = owed to them, negative = they owe): ${JSON.stringify(balances)}
Potential anomalies (expenses > 2.5× category average): ${JSON.stringify(recentAnomalies)}

Return ONLY valid JSON with this exact shape:
{
  "spending": {
    "summary": "1-2 sentence plain-English comparison of this month vs last month",
    "highlights": ["up to 3 short bullet strings about notable category changes"]
  },
  "settlement": {
    "summary": "1-2 sentence plain-English description of who owes what",
    "steps": ["up to 4 short action strings like 'Alice pays Bob $12.50'"]
  },
  "anomalies": {
    "summary": "1-2 sentence plain-English note about unusual spending (or 'No unusual spending detected this month' if none)",
    "items": ["up to 3 short bullet strings about specific anomalies"]
  }
}

Be concise and friendly. Use real names from the data. Only mention categories/amounts that are meaningful.`

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
  const insights = JSON.parse(clean)

  await deductScan(userId, "ai_insight", quota.useBonus)

  const monthlyRemaining = Math.max(0, quota.monthlyLimit - quota.monthlyUsed - (quota.useBonus ? 0 : 1))
  const bonusAfter = quota.useBonus ? quota.bonusScans - 1 : quota.bonusScans

  return NextResponse.json({ ...insights, monthlyRemaining, bonusScans: bonusAfter })
}
