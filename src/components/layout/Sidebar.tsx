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

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-full w-60 flex-col border-r border-gray-100 bg-white">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 px-5 border-b border-gray-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 shadow-sm shadow-violet-200">
            <DollarSign className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 tracking-tight">WhatsYourShare</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive(href)
                  ? "bg-violet-600 text-white shadow-sm shadow-violet-200"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-bold">
                {user.name?.charAt(0).toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                {badge && (
                  <Badge className={cn("shrink-0", badge.className)}>
                    <Crown className="h-2 w-2 mr-0.5" />{badge.label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 text-xs"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 pb-safe">
        <div className="flex items-center justify-around px-2 pt-2 pb-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all",
                isActive(href) ? "text-violet-600" : "text-gray-400"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive(href) && "stroke-[2.5px]")} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
