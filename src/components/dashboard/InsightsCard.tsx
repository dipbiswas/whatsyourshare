"use client"

import { useState } from "react"
import { Sparkles, Loader2, RefreshCw, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Props {
  groupId: string
  groupName: string
  aiScansRemaining?: number
}

export function InsightsCard({ groupId, groupName, aiScansRemaining }: Props) {
  const [insights, setInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/insights/${groupId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Failed to generate insights")
        return
      }
      const data = await res.json()
      setInsights(data.insights ?? [])
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-indigo-100 dark:border-indigo-500/20 shadow-sm bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-500/10 dark:to-transparent">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Insights · {groupName}
        </CardTitle>
        {loaded && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-indigo-400 hover:text-indigo-600"
            onClick={load}
            disabled={loading}
            title="Regenerate (uses 1 scan)"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!loaded && !loading && (
          <div className="flex flex-col items-start gap-3 py-1">
            <p className="text-xs text-indigo-700/70 dark:text-indigo-400/80 flex items-center gap-1.5">
              <Zap className="h-3 w-3 shrink-0" />
              {aiScansRemaining !== undefined
                ? `Generating will use 1 of your ${aiScansRemaining} remaining scan${aiScansRemaining !== 1 ? "s" : ""}.`
                : "Generating will use 1 scan from your monthly allowance."}
            </p>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
              onClick={load}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate insights
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-indigo-500 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analysing spending patterns…
          </div>
        )}

        {error && !loading && (
          <p className="text-xs text-rose-600 dark:text-rose-400 py-1">{error}</p>
        )}

        {loaded && !loading && insights.length > 0 && (
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-indigo-900 dark:text-indigo-200">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
