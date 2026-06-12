/**
 * GET /api/groups/[id]/export?format=csv|qbo&from=ISO&to=ISO
 *
 * Exports group expenses as CSV or QuickBooks-compatible IIF file.
 * Available to TEAM/ENTERPRISE workspace members.
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params
  const { searchParams } = new URL(req.url)
  const exportFormat = searchParams.get("format") ?? "csv"
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const isMember = await prisma.groupMember.findFirst({ where: { groupId, userId: session.user.id } })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const group = await prisma.group.findUnique({ where: { id: groupId } })

  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      ...(from || to ? {
        date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
      approvalStatus: { not: "REJECTED" },
    },
    include: {
      paidBy: { select: { name: true } },
      splits: { include: { user: { select: { name: true } } } },
    },
    orderBy: { date: "asc" },
  })

  if (exportFormat === "qbo") {
    // QuickBooks IIF format
    const lines = [
      "!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO",
      "!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT",
      "!ENDTRNS",
    ]
    for (const e of expenses) {
      const dateStr = format(new Date(e.date), "MM/dd/yyyy")
      lines.push(`TRNS\tEXPENSE\t${dateStr}\tExpenses:${e.category}\t${e.paidBy.name}\t-${e.amount.toFixed(2)}\t${e.description}`)
      for (const s of e.splits) {
        lines.push(`SPL\tEXPENSE\t${dateStr}\tAccounts Payable\t${s.user.name}\t${s.amount.toFixed(2)}`)
      }
      lines.push("ENDTRNS")
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${group?.name ?? "group"}-expenses.iif"`,
      },
    })
  }

  // CSV format
  const rows = [
    ["Date", "Description", "Category", "Amount", "Currency", "Paid By", "Split With", "Approval Status"].join(","),
  ]
  for (const e of expenses) {
    const splitWith = e.splits.map((s) => s.user.name).join("; ")
    rows.push([
      format(new Date(e.date), "yyyy-MM-dd"),
      `"${e.description.replace(/"/g, '""')}"`,
      e.category,
      e.amount.toFixed(2),
      e.currency,
      `"${e.paidBy.name}"`,
      `"${splitWith}"`,
      e.approvalStatus,
    ].join(","))
  }

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${group?.name ?? "group"}-expenses.csv"`,
    },
  })
}
