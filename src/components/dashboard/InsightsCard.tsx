"use client"

import { useEffect, useState } from "react"
import { Sparkles, Loader2, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Props {
  groupId: string
  groupName: string
}

export function InsightsCard({ groupId, groupName }: Props) {
  const [insights, setInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/insights/${groupId}`)
      if (!res.ok) return
      const data = await res.json()
      setInsights(data.insights ?? [])
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [groupId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded && !loading) return null

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-50 border border-indigo-100">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Insights · {groupName}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-indigo-400 hover:text-indigo-600"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading && insights.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-indigo-500 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analysing spending patterns…
          </div>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-indigo-900">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
