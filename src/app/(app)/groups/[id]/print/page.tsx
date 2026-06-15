import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateGroupBalances, simplifyDebts, formatCurrency } from "@/lib/balance"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { PrintTrigger } from "./PrintTrigger"
import { PrintButton } from "./PrintButton"

interface Props {
  params: Promise<{ id: string }>
}

const CATEGORY_DOT: Record<string, string> = {
  Food: "#f97316",
  Transport: "#60a5fa",
  Accommodation: "#a78bfa",
  Entertainment: "#f472b6",
  Utilities: "#facc15",
  General: "#9ca3af",
  Other: "#2dd4bf",
}

export default async function GroupPrintPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user.id) redirect("/login")

  const group = await prisma.group.findFirst({
    where: { id, members: { some: { userId: session.user.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true } },
          splits: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { date: "desc" },
      },
      settlements: {
        include: {
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!group) redirect("/groups")

  const nameMap: Record<string, string> = {}
  for (const m of group.members) nameMap[m.userId] = m.user.name

  const balanceMap = calculateGroupBalances(
    group.members.map((m) => ({ userId: m.userId })),
    group.expenses.map((e) => ({
      paidById: e.paidById,
      amount: e.amount,
      splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
    })),
    group.settlements.map((s) => ({ fromUserId: s.fromUserId, toUserId: s.toUserId, amount: s.amount }))
  )

  const suggested = simplifyDebts(balanceMap, nameMap)
  const totalSpent = group.expenses.reduce((s, e) => s + e.amount, 0)
  const totalSettled = group.settlements.reduce((s, e) => s + e.amount, 0)

  // Category breakdown
  const categoryMap: Record<string, number> = {}
  for (const e of group.expenses) {
    categoryMap[e.category] = (categoryMap[e.category] ?? 0) + e.amount
  }
  const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])

  return (
    <>
      <PrintTrigger />
      <div className="print-page">
        <style>{`
          @media print {
            body { margin: 0; background: white; }
            body * { visibility: hidden; }
            .print-page, .print-page * { visibility: visible; }
            .print-page { width: 100%; padding: 0; }
            .no-print { display: none !important; }
            @page { margin: 1.5cm; size: A4; }
          }
          @media screen {
            .print-page { padding: 32px; max-width: 860px; margin: 0 auto; font-family: sans-serif; color: #111; }
          }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase;
               letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 6px 8px; }
          td { font-size: 13px; padding: 7px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
          tr:last-child td { border-bottom: none; }
          .section { margin-bottom: 32px; }
          .section-title { font-size: 15px; font-weight: 700; color: #111; margin: 0 0 12px;
                           padding-bottom: 6px; border-bottom: 2px solid #4f46e5; display: inline-block; }
          .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 32px; }
          .stat-box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
          .stat-label { font-size: 11px; color: #6b7280; font-weight: 500; margin-bottom: 4px; }
          .stat-value { font-size: 22px; font-weight: 800; color: #111; }
          .badge { display: inline-block; font-size: 10px; font-weight: 600; border-radius: 4px;
                   padding: 1px 6px; background: #f3f4f6; color: #374151; }
          .balance-positive { color: #059669; font-weight: 700; }
          .balance-negative { color: #e11d48; font-weight: 700; }
          .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; flex-shrink: 0; }
          .settlement-row { background: #f0fdf4; }
          .header { margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-start; }
          .header-left h1 { font-size: 26px; font-weight: 800; margin: 0 0 4px; color: #111; }
          .header-left p { font-size: 12px; color: #6b7280; margin: 0; }
          .header-right { text-align: right; font-size: 11px; color: #9ca3af; }
          .logo { font-size: 13px; font-weight: 700; color: #4f46e5; }
          .suggested-row { background: #fefce8; }
          .no-data { font-size: 12px; color: #9ca3af; padding: 12px 0; }
        `}</style>

        {/* Header */}
        <div className="header">
          <div className="header-left">
            <h1>{group.name}</h1>
            {group.description && <p style={{ marginTop: 2 }}>{group.description}</p>}
            <p style={{ marginTop: 4 }}>{group.members.length} members · {group.currency}</p>
          </div>
          <div className="header-right">
            <div className="logo">WhatsYourShare</div>
            <div style={{ marginTop: 4 }}>Report generated {format(new Date(), "MMMM d, yyyy")}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="stat-grid">
          <div className="stat-box">
            <div className="stat-label">Total Spent</div>
            <div className="stat-value">{formatCurrency(totalSpent, group.currency)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Total Settled</div>
            <div className="stat-value">{formatCurrency(totalSettled, group.currency)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Expenses</div>
            <div className="stat-value">{group.expenses.length}</div>
          </div>
        </div>

        {/* Member Balances */}
        <div className="section">
          <div className="section-title">Member Balances</div>
          <table>
            <colgroup>
              <col style={{ width: "40%" }} />
              <col style={{ width: "40%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th style={{ textAlign: "right" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {group.members.map((m) => {
                const b = balanceMap[m.userId] ?? 0
                return (
                  <tr key={m.userId}>
                    <td style={{ fontWeight: 600 }}>{m.user.name}</td>
                    <td style={{ color: "#6b7280" }}>{m.user.email}</td>
                    <td style={{ textAlign: "right" }}>
                      {Math.abs(b) < 0.01
                        ? <span style={{ color: "#9ca3af" }}>Settled</span>
                        : <span className={b > 0 ? "balance-positive" : "balance-negative"}>
                            {b > 0 ? "+" : ""}{formatCurrency(b, group.currency)}
                          </span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Suggested Settlements */}
        {suggested.length > 0 && (
          <div className="section">
            <div className="section-title">Suggested Settlements</div>
            <table>
              <colgroup>
                <col style={{ width: "40%" }} />
                <col style={{ width: "40%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {suggested.map((s, i) => (
                  <tr key={i} className="suggested-row">
                    <td style={{ fontWeight: 600 }}>{s.fromName}</td>
                    <td>{s.toName}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {formatCurrency(s.amount, group.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Category Breakdown */}
        {categories.length > 0 && (
          <div className="section">
            <div className="section-title">Spending by Category</div>
            <table>
              <colgroup>
                <col style={{ width: "55%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "right" }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(([cat, amt]) => (
                  <tr key={cat}>
                    <td>
                      <span className="dot" style={{ backgroundColor: CATEGORY_DOT[cat] ?? "#9ca3af" }} />
                      {cat}
                    </td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(amt, group.currency)}</td>
                    <td style={{ textAlign: "right", color: "#6b7280" }}>
                      {totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Expense List */}
        <div className="section">
          <div className="section-title">All Expenses</div>
          {group.expenses.length === 0 ? (
            <p className="no-data">No expenses recorded.</p>
          ) : (
            <table>
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "36%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Paid by</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {group.expenses.map((e) => (
                  <tr key={e.id}>
                    <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{format(new Date(e.date), "MMM d, yyyy")}</td>
                    <td style={{ fontWeight: 500 }}>{e.description}</td>
                    <td><span className="badge">{e.category}</span></td>
                    <td style={{ color: "#6b7280" }}>{e.paidBy.name}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {formatCurrency(e.amount, group.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Settlements */}
        <div className="section">
          <div className="section-title">Settlements</div>
          {group.settlements.length === 0 ? (
            <p className="no-data">No settlements recorded.</p>
          ) : (
            <table>
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Note</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {group.settlements.map((s) => (
                  <tr key={s.id} className="settlement-row">
                    <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{format(new Date(s.createdAt), "MMM d, yyyy")}</td>
                    <td style={{ fontWeight: 600 }}>{s.fromUser.name}</td>
                    <td>{s.toUser.name}</td>
                    <td style={{ color: "#6b7280" }}>{s.note ?? "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#059669", whiteSpace: "nowrap" }}>
                      {formatCurrency(s.amount, group.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Print button (hidden when printing) */}
        <div className="no-print" style={{ marginTop: 32, display: "flex", gap: 12 }}>
          <PrintButton />
          <a
            href={`/groups/${group.id}`}
            style={{
              border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 20px",
              fontWeight: 600, fontSize: 14, color: "#374151", textDecoration: "none",
            }}
          >
            ← Back to group
          </a>
        </div>
      </div>
    </>
  )
}
