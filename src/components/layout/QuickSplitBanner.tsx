"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Zap } from "lucide-react"

export function QuickSplitBanner() {
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  async function switchMode() {
    setSwitching(true)
    await fetch("/api/user/ui-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uiMode: "QUICK_SPLIT" }),
    })
    router.push("/quick-split")
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 mb-6">
      <div className="flex items-center gap-2.5">
        <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          Want something simpler?{" "}
          <span className="font-medium text-foreground">Quick Split</span> lets you add expenses and see balances on one page — no clutter.
        </p>
      </div>
      <button
        onClick={switchMode}
        disabled={switching}
        className="text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors whitespace-nowrap disabled:opacity-50"
      >
        {switching ? "Switching…" : "Try Quick Split"}
      </button>
    </div>
  )
}
