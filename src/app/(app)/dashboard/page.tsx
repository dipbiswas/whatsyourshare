import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateGroupBalances, formatCurrency } from "@/lib/balance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SpendingChart } from "@/components/dashboard/SpendingChart"
import { InsightsCard } from "@/components/dashboard/InsightsCard"
import { FriendBalancesCard } from "@/components/dashboard/FriendBalancesCard"
import { OnboardingCard } from "@/components/dashboard/OnboardingCard"
import { format } from "date-fns"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

const CATEGORY_COLORS: Record<string, string> = {
  Food: "bg-orange-400",
  Transport: "bg-blue-400",
  Accommodation: "bg-purple-400",
  Entertainment: "bg-pink-400",
  Utilities: "bg-yellow-400",
  General: "bg-gray-400",
  Other: "bg-teal-400",
}

async function getDashboardData(userId: string) {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { select: { userId: true } },
      expenses: {
        select: { paidById: true, amount: true, splits: { select: { userId: true, amount: true } } },
      },
      settlements: { select: { fromUserId: true, toUserId: true, amount: true } },
    },
  })

  let totalOwed = 0
  let totalOwe = 0
  for (const group of groups) {
    const balanceMap = calculateGroupBalances(group.members, group.expenses, group.settlements)
    const balance = balanceMap[userId] ?? 0
    if (balance > 0) totalOwed += balance
    else totalOwe += Math.abs(balance)
  }

  const recentExpenses = await prisma.expense.findMany({
    where: { group: { members: { some: { userId } } } },
    include: {
      group: { select: { id: true, name: true } },
      paidBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  })

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const allExpenses = await prisma.expense.findMany({
    where: { group: { members: { some: { userId } } }, date: { gte: sixMonthsAgo } },
    select: { date: true, amount: true },
  })

  const monthlyMap: Record<string, number> = {}
  for (const e of allExpenses) {
    const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`
    monthlyMap[key] = (monthlyMap[key] ?? 0) + e.amount
  }
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    return { month: d.toLocaleString("default", { month: "short" }), amount: Math.round((monthlyMap[key] ?? 0) * 100) / 100 }
  })

  const mostActiveGroup = groups.map((g) => ({ id: g.id, name: g.name, count: g.expenses.length })).sort((a, b) => b.count - a.count)[0] ?? null

  return {
    totalOwed: Math.round(totalOwed * 100) / 100,
    totalOwe: Math.round(totalOwe * 100) / 100,
    netBalance: Math.round((totalOwed - totalOwe) * 100) / 100,
    groupCount: groups.length,
    recentExpenses,
    chartData,
    insightsGroup: mostActiveGroup,
  }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user.id) return null
  const data = await getDashboardData(session.user.id)
  const firstName = session.user.name?.split(" ")[0] ?? "there"

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <p className="text-sm text-gray-400 font-medium">{getGreeting()}</p>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-0.5">{firstName}</h1>
      </div>

      {/* Onboarding */}
      {data.groupCount === 0 && <OnboardingCard userName={firstName} />}

      {/* Balance hero card */}
      {data.groupCount > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-emerald-600 mb-1">Owed to you</p>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">{formatCurrency(data.totalOwed)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100/50">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-rose-500 mb-1">You owe</p>
              <p className="text-2xl font-bold text-rose-600 tabular-nums">{formatCurrency(data.totalOwe)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart + Recent */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Monthly Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingChart data={data.chartData} />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700">Recent Expenses</CardTitle>
            <Link href="/expenses" className="text-xs text-violet-600 hover:underline flex items-center gap-0.5">
              All <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {data.recentExpenses.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No expenses yet</p>
            )}
            {data.recentExpenses.map((e) => (
              <Link key={e.id} href={`/groups/${e.group.id}`} className="flex items-center gap-3 group">
                <div className={`h-2 w-2 rounded-full shrink-0 ${CATEGORY_COLORS[e.category] ?? "bg-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-violet-700 transition-colors">{e.description}</p>
                  <p className="text-xs text-gray-400 truncate">{e.group.name} · {format(new Date(e.createdAt), "MMM d")}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">{formatCurrency(e.amount)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Friend balances + Insights */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <FriendBalancesCard />
        </div>
        {data.insightsGroup && (
          <div className="lg:col-span-2">
            <InsightsCard groupId={data.insightsGroup.id} groupName={data.insightsGroup.name} />
          </div>
        )}
      </div>
    </div>
  )
}
