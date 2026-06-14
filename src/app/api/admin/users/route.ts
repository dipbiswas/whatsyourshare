import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET(req: Request) {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") ?? ""
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = 20

  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] }
    : {}

  const [users, total] = await Promise.all([
    (prisma.user.findMany as any)({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        isAdmin: true,
        bonusScans: true,
        createdAt: true,
        _count: { select: { groupMemberships: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  // Fetch scan usage this month for each user
  const month = new Date().toISOString().slice(0, 7)
  const userIds = users.map((u: any) => u.id)
  const usageRecords = await (prisma as any).usageRecord.findMany({
    where: { userId: { in: userIds }, month },
    select: { userId: true, feature: true, count: true },
  })
  const usageMap: Record<string, number> = {}
  for (const r of usageRecords) {
    usageMap[r.userId] = (usageMap[r.userId] ?? 0) + r.count
  }

  const result = users.map((u: any) => ({
    ...u,
    groupCount: u._count.groupMemberships,
    scansThisMonth: usageMap[u.id] ?? 0,
    _count: undefined,
  }))

  return NextResponse.json({ users: result, total, page, pages: Math.ceil(total / limit) })
}
