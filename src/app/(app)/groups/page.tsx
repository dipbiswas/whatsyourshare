"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Receipt, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog"

interface Member {
  userId: string
  user: { id: string; name: string; email: string; avatar: string | null }
}

interface Group {
  id: string
  name: string
  description: string | null
  currency: string
  _count: { expenses: number }
  members: Member[]
  updatedAt: string
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <p className="text-gray-500 mt-1">Manage your expense groups</p>
        </div>
        <CreateGroupDialog onCreated={(g) => setGroups((prev) => [g as Group, ...prev])} />
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div className="text-center py-24">
          <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No groups yet</h3>
          <p className="text-gray-400 mt-1">Create your first group to start splitting expenses.</p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-6 flex flex-col h-full gap-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{group.name}</h3>
                      {group.description && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{group.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 ml-2">
                      {group.currency}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5" />
                      {group._count.expenses} expense{group._count.expenses !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex -space-x-2">
                      {group.members.slice(0, 4).map((m) => (
                        <Avatar key={m.userId} className="h-7 w-7 ring-2 ring-white">
                          <AvatarFallback className="text-xs bg-violet-100 text-violet-700 font-semibold">
                            {m.user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {group.members.length > 4 && (
                        <div className="h-7 w-7 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-xs text-gray-600 font-medium">
                          +{group.members.length - 4}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
