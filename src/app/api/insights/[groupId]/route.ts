import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { subDays, subMonths, format } from "date-fns"
import { config } from "@/lib/config"
import { checkScanQuota, deductScan } from "@/lib/scan-quota"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { groupId } = await params

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const quota = await checkScanQuota(session.user.id, "ai_insight")
  if (!quota.allowed) return NextResponse.json({ error: quota.message }, { status: quota.reason === "plan_limit" ? 403 : 429 })

  const now = new Date()
  const thirtyDaysAgo = subDays(now, 30)
  const sixtyDaysAgo = subDays(now, 60)

  // Last 30 days
  const recent = await prisma.expense.findMany({
    where: { groupId, date: { gte: thirtyDaysAgo } },
    select: { description: true, amount: true, category: true, date: true },
  })

  // Prior 30 days (for comparison)
  const prior = await prisma.expense.findMany({
    where: { groupId, date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    select: { amount: true, category: true },
  })

  if (recent.length === 0) {
    return NextResponse.json({ insights: ["No expenses in the last 30 days to analyse."], generatedAt: now })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback: compute basic insights without AI
    const total = recent.reduce((s, e) => s + e.amount, 0)
    const byCategory: Record<string, number> = {}
    for (const e of recent) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
    const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
    return NextResponse.json({
      insights: [
        `Total group spending in the last 30 days: $${total.toFixed(2)}.`,
        topCat ? `Largest category: ${topCat[0]} ($${topCat[1].toFixed(2)}).` : null,
      ].filter(Boolean),
      generatedAt: now,
    })
  }

  // Build a compact summary for the AI
  const recentTotal = recent.reduce((s, e) => s + e.amount, 0)
  const priorTotal = prior.reduce((s, e) => s + e.amount, 0)

  const recentByCategory: Record<string, number> = {}
  const priorByCategory: Record<string, number> = {}
  for (const e of recent) recentByCategory[e.category] = (recentByCategory[e.category] ?? 0) + e.amount
  for (const e of prior) priorByCategory[e.category] = (priorByCategory[e.category] ?? 0) + e.amount

  const summary = {
    period: `${format(thirtyDaysAgo, "MMM d")} – ${format(now, "MMM d")}`,
    totalSpent: recentTotal.toFixed(2),
    priorPeriodTotal: priorTotal.toFixed(2),
    expenseCount: recent.length,
    categoryBreakdown: Object.entries(recentByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt.toFixed(2),
        priorAmount: (priorByCategory[cat] ?? 0).toFixed(2),
      })),
    topExpenses: recent
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((e) => ({ description: e.description, amount: e.amount.toFixed(2), category: e.category })),
  }

  const [aiModel, aiMaxTokens] = await Promise.all([
    config.platform.aiModel(),
    config.platform.aiMaxTokens(),
  ])

  const response = await client.messages.create({
    model: aiModel,
    max_tokens: aiMaxTokens,
    messages: [
      {
        role: "user",
        content: `Analyse this group's shared expense data and return exactly 3–4 short, specific, actionable insights as a JSON array of strings. Be direct and use numbers. No fluff.

Data: ${JSON.stringify(summary)}

Return ONLY a JSON array, e.g.: ["insight 1", "insight 2", "insight 3"]`,
      },
    ],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : "[]"
  const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()

  let insights: string[]
  try {
    insights = JSON.parse(clean)
    if (!Array.isArray(insights)) insights = [clean]
  } catch {
    insights = [text]
  }

  await deductScan(session.user.id, "ai_insight", quota.useBonus)

  return NextResponse.json({ insights: insights.slice(0, 4), generatedAt: now })
}
