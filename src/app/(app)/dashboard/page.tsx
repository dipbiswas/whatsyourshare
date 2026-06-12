import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateGroupBalances, formatCurrency } from "@/lib/balance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Wallet, Users } from "lucide-react"
import { SpendingChart } from "@/components/dashboard/SpendingChart"
import { InsightsCard } from "@/components/dashboard/InsightsCard"
import { FriendBalancesCard } from "@/components/dashboard/FriendBalancesCard"
import { OnboardingCard } from "@/components/dashboard/OnboardingCard"
import { format } from "date-fns"

async function getDashboardData(userId: string) {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { select: { userId: true } },
      expenses: {
        select: {
          paidById: true,
          amount: true,
          splits: { select: { userId: true, amount: true } },
        },
      },
      settlements: { select: { fromUserId: true, toUserId: true, amount: true } },
    },
    // name is always selected as it's a required field on Group
  })

  let totalOwed = 0
  let totalOwe = 0

  for (const group of groups) {
    const balanceMap = calculateGroupBalances(
      group.members,
      group.expenses,
      group.settlements
    )
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
    where: {
      group: { members: { some: { userId } } },
      date: { gte: sixMonthsAgo },
    },
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
    return {
      month: d.toLocaleString("default", { month: "short" }),
      amount: Math.round((monthlyMap[key] ?? 0) * 100) / 100,
    }
  })

  // Pick the most active group (most expenses) for insights
  const mostActiveGroup = groups
    .map((g) => ({ id: g.id, name: g.name, count: g.expenses.length }))
    .sort((a, b) => b.count - a.count)[0] ?? null

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

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user.id) return null

  const data = await getDashboardData(session.user.id)

  const stats = [
    {
      label: "Owed to you",
      value: formatCurrency(data.totalOwed),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "You owe",
      value: formatCurrency(data.totalOwe),
      icon: TrendingDown,
      color: "text-red-500",
      bg: "bg-red-50",
    },
    {
      label: "Net balance",
      value: formatCurrency(Math.abs(data.netBalance)),
      icon: Wallet,
      color: data.netBalance >= 0 ? "text-emerald-600" : "text-red-500",
      bg: data.netBalance >= 0 ? "bg-emerald-50" : "bg-red-50",
      suffix: data.netBalance >= 0 ? "in your favor" : "you owe",
    },
    {
      label: "Active groups",
      value: String(data.groupCount),
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getGreeting()}, {session.user.name?.split(" ")[0]}
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s your expense overview</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  {"suffix" in stat && stat.suffix && (
                    <p className="text-xs text-gray-400 mt-0.5">{stat.suffix}</p>
                  )}
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Onboarding — only shown when user has no groups */}
      {data.groupCount === 0 && <OnboardingCard userName={session.user.name?.split(" ")[0] ?? "there"} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Monthly Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingChart data={data.chartData} />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentExpenses.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No expenses yet</p>
            )}
            {data.recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.description}</p>
                  <p className="text-xs text-gray-400">
                    {e.group.name} · {format(new Date(e.createdAt), "MMM d")}
                  </p>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(e.amount)}</p>
                  <Badge variant="secondary" className="text-xs">
                    {e.paidBy.name.split(" ")[0]}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Friend cross-group balances */}
        <div className="lg:col-span-1">
          <FriendBalancesCard />
        </div>
        {/* AI Insights */}
        {data.insightsGroup && (
          <div className="lg:col-span-2">
            <InsightsCard
              groupId={data.insightsGroup.id}
              groupName={data.insightsGroup.name}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}
