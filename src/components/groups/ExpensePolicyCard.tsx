"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Shield, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

const CATEGORIES = ["Food", "Transport", "Accommodation", "Entertainment", "Utilities", "Healthcare", "Shopping", "Other"]

interface Props {
  groupId: string
}

interface Policy {
  maxAmountNoReceipt: number
  requiresApprovalAbove: number
  allowedCategories: string
}

export function ExpensePolicyCard({ groupId }: Props) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [maxNoReceipt, setMaxNoReceipt] = useState("25")
  const [approvalAbove, setApprovalAbove] = useState("100")
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/groups/${groupId}/policy`)
      .then((r) => r.ok ? r.json() : null)
      .then((p: Policy | null) => {
        if (p) {
          setPolicy(p)
          setMaxNoReceipt(String(p.maxAmountNoReceipt))
          setApprovalAbove(String(p.requiresApprovalAbove))
          setSelectedCats(p.allowedCategories ? p.allowedCategories.split(",") : [])
        }
      })
  }, [groupId])

  const toggleCat = (cat: string) => {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxAmountNoReceipt: Number(maxNoReceipt),
          requiresApprovalAbove: Number(approvalAbove),
          allowedCategories: selectedCats,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Policy saved")
    } catch {
      toast.error("Failed to save policy")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-600" />
          <CardTitle className="text-base">Expense Policy</CardTitle>
        </div>
        <CardDescription>
          Control spending rules and approval workflows for this team workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="maxNoReceipt">Max amount without receipt ($)</Label>
            <Input
              id="maxNoReceipt"
              type="number"
              min={0}
              value={maxNoReceipt}
              onChange={(e) => setMaxNoReceipt(e.target.value)}
            />
            <p className="text-xs text-gray-400">Expenses above this require a receipt attachment</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approvalAbove">Requires approval above ($)</Label>
            <Input
              id="approvalAbove"
              type="number"
              min={0}
              value={approvalAbove}
              onChange={(e) => setApprovalAbove(e.target.value)}
            />
            <p className="text-xs text-gray-400">Admin must approve expenses above this amount</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Allowed categories</Label>
          <p className="text-xs text-gray-400">Select categories members can expense. Leave all unchecked to allow any category.</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {CATEGORIES.map((cat) => (
              <Badge
                key={cat}
                variant={selectedCats.includes(cat) ? "default" : "outline"}
                className={`cursor-pointer select-none ${selectedCats.includes(cat) ? "bg-indigo-600 hover:bg-indigo-700" : "hover:bg-gray-100"}`}
                onClick={() => toggleCat(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        <Button onClick={save} disabled={saving} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? "Saving…" : "Save Policy"}
        </Button>
      </CardContent>
    </Card>
  )
}
