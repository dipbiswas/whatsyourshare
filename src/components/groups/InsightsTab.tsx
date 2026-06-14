"use client"

import { useState } from "react"
import { Sparkles, TrendingUp, ArrowRightLeft, AlertTriangle, Loader2, Zap, RefreshCw, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScanTopupDialog } from "@/components/billing/ScanTopupDialog"
import { cn } from "@/lib/utils"

interface Insights {
  spending: { summary: string; highlights: string[] }
  settlement: { summary: string; steps: string[] }
  anomalies: { summary: string; items: string[] }
  monthlyRemaining: number
  bonusScans: number
}

interface Props {
  groupId: string
  canUseAI: boolean
  aiScansUsed: number
  aiScansLimit: number
  bonusScans: number
}

function InsightCard({
  icon: Icon,
  title,
  color,
  summary,
  items,
}: {
  icon: React.ElementType
  title: string
  color: string
  summary: string
  items: string[]
}) {
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", color)}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function InsightsTab({ groupId, canUseAI, aiScansUsed, aiScansLimit, bonusScans: initialBonus }: Props) {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [used, setUsed] = useState(aiScansUsed)
  const [bonus, setBonus] = useState(initialBonus)
  const [showTopup, setShowTopup] = useState(false)

  const onFreePlan = !canUseAI
  const monthlyExhausted = onFreePlan || used >= aiScansLimit
  const canGenerate = !monthlyExhausted || bonus > 0

  async function runInsights() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/groups/${groupId}/insights`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? "Something went wrong")
        return
      }
      setInsights(data)
      setUsed(aiScansLimit - (data.monthlyRemaining ?? 0))
      setBonus(data.bonusScans ?? 0)
    } catch {
      setError("Failed to generate insights")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <ScanTopupDialog open={showTopup} onOpenChange={setShowTopup} currentBonus={bonus} />

      {/* Header with generate button */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            AI Insights
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {onFreePlan
              ? bonus > 0
                ? <><span className="text-indigo-600 dark:text-indigo-400">{bonus} bonus scan{bonus !== 1 ? "s" : ""}</span> · each generation uses 1</>
                : "Buy scans below to get started"
              : <>{used}/{aiScansLimit} monthly{bonus > 0 && <span className="text-indigo-600 dark:text-indigo-400"> · {bonus} bonus</span>} · each generation uses 1</>
            }
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!onFreePlan && monthlyExhausted && bonus === 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTopup(true)}
              className="gap-1.5 border-indigo-300 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Top up
            </Button>
          )}
          <Button
            size="sm"
            onClick={runInsights}
            disabled={loading || !canGenerate}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            title="Uses 1 AI scan from your allowance"
          >
            {loading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…</>
            ) : insights ? (
              <><RefreshCw className="h-3.5 w-3.5" /> Refresh</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> Generate</>
            )}
          </Button>
        </div>
      </div>

      {/* Free plan banner — no monthly allowance, but can top up */}
      {onFreePlan && bonus === 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">AI Insights — Pro feature</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Upgrade to Pro for 20 scans/month, or buy a one-time top-up pack to try it now.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium py-2 rounded-lg transition-colors">
              <Zap className="h-3 w-3" /> Upgrade to Pro — $4/mo
            </button>
            <button
              onClick={() => setShowTopup(true)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-background hover:bg-accent border border-border text-foreground/80 text-xs font-medium py-2 rounded-lg transition-colors"
            >
              <ShoppingCart className="h-3 w-3" /> Buy scans from $2.49
            </button>
          </div>
        </div>
      )}

      {/* Exhausted banner — Pro/Family with no monthly or bonus scans left */}
      {!onFreePlan && monthlyExhausted && bonus === 0 && !loading && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Monthly scans used up</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Resets next month, or top up now for instant access.
            </p>
          </div>
          <button
            onClick={() => setShowTopup(true)}
            className="shrink-0 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Zap className="h-3 w-3" /> Top up
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      {!insights && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-indigo-500" />
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Generate AI-powered spending analysis, settlement recommendations, and anomaly detection for this group.
          </p>
          <p className="text-xs text-muted-foreground/60">Uses 1 scan from your {aiScansLimit}/month allowance</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-muted-foreground">Analyzing your group's expenses…</p>
        </div>
      )}

      {insights && !loading && (
        <div className="space-y-3">
          <InsightCard
            icon={TrendingUp}
            title="Spending Analysis"
            color="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
            summary={insights.spending.summary}
            items={insights.spending.highlights}
          />
          <InsightCard
            icon={ArrowRightLeft}
            title="Settlement Recommendations"
            color="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            summary={insights.settlement.summary}
            items={insights.settlement.steps}
          />
          <InsightCard
            icon={AlertTriangle}
            title="Anomalies"
            color="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
            summary={insights.anomalies.summary}
            items={insights.anomalies.items}
          />
        </div>
      )}
    </div>
  )
}
