"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, TrendingUp, BarChart2, ArrowLeft, Shield, ShieldAlert, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const BASE_NAV = [
  { href: "/admin/users",      label: "Users",      icon: Users },
  { href: "/admin/revenue",    label: "Revenue",    icon: TrendingUp },
  { href: "/admin/usage",      label: "Usage",      icon: BarChart2 },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldAlert, badge: true },
  { href: "/admin/config",     label: "Config",      icon: Settings },
]

interface Props {
  user: { name: string; email: string }
}

export function AdminSidebar({ user }: Props) {
  const pathname = usePathname()
  const [pendingFlags, setPendingFlags] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/admin/moderation/count")
      .then((r) => r.json())
      .then((d) => setPendingFlags(d.count ?? 0))
      .catch(() => {})
  }, [])

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-background h-full">
      {/* Header */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-7 w-7 rounded-lg bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center">
            <Shield className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <span className="text-sm font-bold text-foreground">Admin</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {BASE_NAV.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname.startsWith(href)
          const showBadge = badge && pendingFlags !== null && pendingFlags > 0
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {pendingFlags! > 99 ? "99+" : pendingFlags}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Back to app */}
      <div className="px-2 py-3 border-t border-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>
      </div>
    </aside>
  )
}
