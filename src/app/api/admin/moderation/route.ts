import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

const PAGE_SIZE = 20

export async function GET(req: Request) {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? "PENDING"
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))

  const where = { status: status as "PENDING" | "DISMISSED" | "ACTIONED" }

  const [flags, total] = await Promise.all([
    (prisma.contentFlag as any).findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        reportedBy: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    }),
    (prisma.contentFlag as any).count({ where }),
  ])

  // Attach entity display info
  const enriched = await Promise.all(
    flags.map(async (flag: any) => {
      let entityLabel: string | null = null
      let entityAuthorName: string | null = null
      let groupId: string | null = null

      try {
        if (flag.entityType === "EXPENSE") {
          const e = await prisma.expense.findUnique({
            where: { id: flag.entityId },
            select: { description: true, paidBy: { select: { name: true } }, groupId: true },
          })
          entityLabel = e?.description ?? null
          entityAuthorName = e?.paidBy.name ?? null
          groupId = e?.groupId ?? null
        } else if (flag.entityType === "GROUP") {
          const g = await prisma.group.findUnique({
            where: { id: flag.entityId },
            select: { name: true, createdBy: { select: { name: true } } },
          })
          entityLabel = g?.name ?? null
          entityAuthorName = (g as any)?.createdBy?.name ?? null
          groupId = flag.entityId
        } else if (flag.entityType === "TRIP") {
          const t = await prisma.trip.findUnique({
            where: { id: flag.entityId },
            select: { name: true, createdBy: { select: { name: true } }, groupId: true },
          })
          entityLabel = t?.name ?? null
          entityAuthorName = t?.createdBy.name ?? null
          groupId = t?.groupId ?? null
        } else if (flag.entityType === "ACTION_ITEM") {
          const a = await (prisma as any).actionItem.findUnique({
            where: { id: flag.entityId },
            select: { title: true, createdBy: { select: { name: true } }, trip: { select: { groupId: true } } },
          })
          entityLabel = a?.title ?? null
          entityAuthorName = a?.createdBy?.name ?? null
          groupId = a?.trip?.groupId ?? null
        }
      } catch { /* entity may have been deleted */ }

      return { ...flag, entityLabel, entityAuthorName, groupId }
    })
  )

  return NextResponse.json({ flags: enriched, total, pages: Math.ceil(total / PAGE_SIZE) })
}

export async function PATCH(req: Request) {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check
  const adminId = (check as { userId: string }).userId

  const { flagId, action, note } = await req.json()
  // action: "dismiss" | "delete_content" | "warn_user"

  const flag = await (prisma.contentFlag as any).findUnique({ where: { id: flagId } })
  if (!flag) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (action === "dismiss") {
    await (prisma.contentFlag as any).update({
      where: { id: flagId },
      data: { status: "DISMISSED", resolvedById: adminId, resolvedAt: new Date(), resolveNote: note ?? "False positive" },
    })
  } else if (action === "delete_content") {
    // Delete the entity then mark flag as actioned
    try {
      if (flag.entityType === "EXPENSE") await prisma.expense.delete({ where: { id: flag.entityId } })
      else if (flag.entityType === "GROUP") await prisma.group.delete({ where: { id: flag.entityId } })
      else if (flag.entityType === "TRIP") await prisma.trip.delete({ where: { id: flag.entityId } })
      else if (flag.entityType === "ACTION_ITEM") await (prisma as any).actionItem.delete({ where: { id: flag.entityId } })
    } catch { /* already deleted */ }

    await (prisma.contentFlag as any).update({
      where: { id: flagId },
      data: { status: "ACTIONED", resolvedById: adminId, resolvedAt: new Date(), resolveNote: note ?? "Content deleted" },
    })
  } else if (action === "warn_user") {
    // Just mark actioned — future: send warning email
    await (prisma.contentFlag as any).update({
      where: { id: flagId },
      data: { status: "ACTIONED", resolvedById: adminId, resolvedAt: new Date(), resolveNote: note ?? "User warned" },
    })
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
