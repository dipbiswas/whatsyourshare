"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Sparkles, Loader2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const PACKS = [
  { id: "small", scans: 10, price: "$2.49", perScan: "$0.25", popular: false },
  { id: "large", scans: 50, price: "$6.99", perScan: "$0.14", popular: true  },
] as const

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentBonus?: number
}

export function ScanTopupDialog({ open, onOpenChange, currentBonus = 0 }: Props) {
  const [selected, setSelected] = useState<"small" | "large">("large")
  const [loading, setLoading] = useState(false)

  async function handlePurchase() {
    setLoading(true)
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: selected }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { toast.error("Could not start checkout"); return }
      window.location.href = data.url
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            Top up AI scans
          </DialogTitle>
          <DialogDescription>
            One-time purchase — scans never expire and work across all your groups.
            {currentBonus > 0 && (
              <span className="block mt-1 text-indigo-600 dark:text-indigo-400 font-medium">
                You currently have {currentBonus} bonus scan{currentBonus !== 1 ? "s" : ""}.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-1">
          {PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => setSelected(pack.id)}
              className={cn(
                "w-full flex items-center justify-between rounded-xl border-2 px-4 py-3.5 transition-all text-left relative",
                selected === pack.id
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                  : "border-border hover:border-indigo-300 hover:bg-accent"
              )}
            >
              {pack.popular && (
                <span className="absolute -top-2.5 left-3 text-[10px] font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                  Best value
                </span>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{pack.scans} AI scans</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pack.perScan} per scan</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold text-foreground">{pack.price}</p>
                <p className="text-[10px] text-muted-foreground">one-time</p>
              </div>
            </button>
          ))}
        </div>

        <Button
          onClick={handlePurchase}
          disabled={loading}
          className="w-full mt-1 bg-indigo-600 hover:bg-indigo-700 gap-2"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
            : <><Zap className="h-4 w-4" /> Buy {PACKS.find((p) => p.id === selected)?.scans} scans — {PACKS.find((p) => p.id === selected)?.price}</>
          }
        </Button>

        <p className="text-center text-[11px] text-muted-foreground -mt-1">
          Secure checkout via Stripe. Scans are added instantly after payment.
        </p>
      </DialogContent>
    </Dialog>
  )
}
