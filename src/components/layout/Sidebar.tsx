"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { LayoutDashboard, Users, Receipt, Settings, LogOut, DollarSign, Plane, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useFeatureGate } from "@/lib/useFeatureGate"

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/trips", label: "Trips", icon: Plane },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface SidebarProps {
  user: { name?: string | null; email?: string | null }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const { plan } = useFeatureGate("PRO")

  const planBadge: Record<string, { label: string; className: string } | null> = {
    FREE: null,
    PRO: { label: "Pro", className: "bg-violet-100 text-violet-700 border-0 text-[10px]" },
    FAMILY: { label: "Family", className: "bg-amber-100 text-amber-700 border-0 text-[10px]" },
  }
  const badge = planBadge[plan] ?? null

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-gray-200 px-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600">
          <DollarSign className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900">WhatsYourShare</span>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
                ? "bg-violet-50 text-violet-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-semibold">
              {user.name?.charAt(0).toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              {badge && (
                <Badge className={badge.className}>
                  <Crown className="h-2 w-2 mr-0.5" />
                  {badge.label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-gray-600 hover:text-red-600 hover:bg-red-50"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
