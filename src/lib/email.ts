/**
 * Email sending utility using Resend.
 * Set RESEND_API_KEY in .env.
 * Set RESEND_FROM_EMAIL to your verified sender (e.g. "WhatsYourShare <noreply@whatsyourshare.app>")
 */
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"

const APP_URL = process.env.NEXTAUTH_URL ?? "https://whatsyourshare.app"

/**
 * Check a user's notification preference and send an email if enabled.
 * prefKey matches the keys in NotifPrefs (e.g. "expenseAdded").
 * Fire-and-forget: always call with .catch(() => {}) at the call site.
 */
export async function notifyUser(
  userId: string,
  prefKey: string,
  send: (to: string, name: string) => Promise<unknown>
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (prisma.user.findUnique as any)({
      where: { id: userId },
      select: { email: true, name: true, notificationPrefs: true },
    })
    if (!user) return
    const prefs = (user.notificationPrefs ?? {}) as Record<string, boolean>
    // Default is true for all prefs unless explicitly set to false
    if (prefs[prefKey] === false) return
    await send(user.email, user.name)
  } catch (err) {
    console.error(`notifyUser(${prefKey}) failed:`, err)
  }
}

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder")
const FROM = process.env.RESEND_FROM_EMAIL ?? "WhatsYourShare <noreply@whatsyourshare.app>"

// ── Shared HTML wrapper ───────────────────────────────────────────────────────

function emailWrap(body: string) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:28px;">
        <div style="width:32px;height:32px;background:#7c3aed;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:18px;font-weight:bold;">$</span>
        </div>
        <span style="font-weight:700;font-size:18px;color:#111827;">WhatsYourShare</span>
      </div>
      ${body}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <p style="color:#d1d5db;font-size:12px;margin:0;">
        Manage notification preferences in your
        <a href="${APP_URL}/settings" style="color:#a78bfa;text-decoration:none;">account settings</a>.
      </p>
    </div>
  `
}

function ctaButton(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${label} →</a>`
}

// ── Added to a group ──────────────────────────────────────────────────────────

export async function sendAddedToGroupEmail({
  to, name, inviterName, groupName, groupId,
}: { to: string; name: string; inviterName: string; groupName: string; groupId: string }) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `You've been added to "${groupName}" on WhatsYourShare`,
    html: emailWrap(`
      <p style="color:#6b7280;margin:0 0 4px;">Hi ${name.split(" ")[0]},</p>
      <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 12px;">You're in a new group!</h1>
      <p style="color:#374151;margin:0 0 20px;">
        <strong>${inviterName}</strong> added you to <strong>"${groupName}"</strong>.
        You can now split expenses and settle up with the group.
      </p>
      ${ctaButton(`${APP_URL}/groups/${groupId}`, "View Group")}
    `),
  })
}

// ── Expense edited / deleted ──────────────────────────────────────────────────

export async function sendExpenseEditedEmail({
  to, name, action, description, groupName, groupId,
}: { to: string; name: string; action: "edited" | "deleted"; description: string; groupName: string; groupId: string }) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Expense "${description}" was ${action} in ${groupName}`,
    html: emailWrap(`
      <p style="color:#6b7280;margin:0 0 4px;">Hi ${name.split(" ")[0]},</p>
      <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 12px;">Expense ${action}</h1>
      <div style="background:#f9fafb;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
        <p style="margin:0;font-weight:600;color:#111827;">${description}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">in <strong>${groupName}</strong></p>
      </div>
      <p style="color:#374151;margin:0 0 20px;font-size:14px;">
        ${action === "deleted" ? "This expense has been removed from the group." : "This expense has been updated — your balance may have changed."}
      </p>
      ${ctaButton(`${APP_URL}/groups/${groupId}`, "View Group")}
    `),
  })
}

// ── Recurring expense due ─────────────────────────────────────────────────────

export async function sendRecurringDueEmail({
  to, name, description, amount, currency, groupName, groupId, nextDate,
}: { to: string; name: string; description: string; amount: number; currency: string; groupName: string; groupId: string; nextDate: string }) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Recurring expense "${description}" was added to ${groupName}`,
    html: emailWrap(`
      <p style="color:#6b7280;margin:0 0 4px;">Hi ${name.split(" ")[0]},</p>
      <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 12px;">Recurring expense added</h1>
      <div style="background:#f5f3ff;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
        <p style="margin:0;font-weight:700;font-size:18px;color:#111827;">${description}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#7c3aed;">${currency} ${amount.toFixed(2)} · ${groupName}</p>
      </div>
      <p style="color:#374151;margin:0 0 4px;font-size:14px;">The splits have been recorded and your balance updated.</p>
      <p style="color:#9ca3af;font-size:13px;margin:0 0 20px;">Next occurrence: <strong>${nextDate}</strong></p>
      ${ctaButton(`${APP_URL}/groups/${groupId}`, "View Group")}
    `),
  })
}

// ── Settlement received ───────────────────────────────────────────────────────

export async function sendSettlementEmail({
  to, name, fromName, amount, currency, groupName, groupId,
}: { to: string; name: string; fromName: string; amount: number; currency: string; groupName: string; groupId: string }) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `${fromName} paid you ${currency} ${amount.toFixed(2)} in ${groupName}`,
    html: emailWrap(`
      <p style="color:#6b7280;margin:0 0 4px;">Hi ${name.split(" ")[0]},</p>
      <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 12px;">You received a payment 🎉</h1>
      <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;margin-bottom:20px;border:1px solid #bbf7d0;">
        <p style="margin:0;font-size:26px;font-weight:800;color:#16a34a;">${currency} ${amount.toFixed(2)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#15803d;">from <strong>${fromName}</strong> · ${groupName}</p>
      </div>
      <p style="color:#374151;margin:0 0 20px;font-size:14px;">Your balance in this group has been updated.</p>
      ${ctaButton(`${APP_URL}/groups/${groupId}`, "View Group")}
    `),
  })
}

export async function sendInviteEmail({
  to,
  inviterName,
  groupName,
  inviteUrl,
}: {
  to: string
  inviterName: string
  groupName: string
  inviteUrl: string
}) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterName} invited you to "${groupName}" on WhatsYourShare`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:24px;">
          <div style="width:32px;height:32px;background:#7c3aed;border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:18px;font-weight:bold;">$</span>
          </div>
          <span style="font-weight:700;font-size:18px;color:#111827;">WhatsYourShare</span>
        </div>

        <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">
          You're invited to split expenses!
        </h1>
        <p style="color:#6b7280;margin:0 0 24px;">
          <strong>${inviterName}</strong> invited you to join the group
          <strong>"${groupName}"</strong> on WhatsYourShare — the smarter way to split bills.
        </p>

        <a href="${inviteUrl}"
           style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          Accept Invitation →
        </a>

        <p style="color:#9ca3af;font-size:13px;margin-top:24px;">
          This invite expires in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#d1d5db;font-size:12px;margin:0;">
          WhatsYourShare · Enterprise expense splitting
        </p>
      </div>
    `,
  })
}

export async function sendMonthlySummaryEmail({
  to,
  name,
  month,
  year,
  totalSpent,
  groups,
  topCategories,
  dashboardUrl,
}: {
  to: string
  name: string
  month: string       // e.g. "May"
  year: number
  totalSpent: { currency: string; amount: number }[]
  groups: { name: string; currency: string; spent: number; youOwe: number }[]
  topCategories: { category: string; amount: number; currency: string }[]
  dashboardUrl: string
}) {
  const firstName = name.split(" ")[0]

  const totalsHtml = totalSpent.length
    ? totalSpent.map((t) => `<span style="font-size:28px;font-weight:800;color:#111827;">${t.currency} ${t.amount.toFixed(2)}</span>`).join(" &nbsp;+&nbsp; ")
    : `<span style="font-size:28px;font-weight:800;color:#111827;">$0.00</span>`

  const groupRows = groups.map((g) => `
    <tr>
      <td style="padding:10px 12px;font-weight:600;color:#111827;">${g.name}</td>
      <td style="padding:10px 12px;color:#6b7280;text-align:right;">${g.currency} ${g.spent.toFixed(2)}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600;color:${g.youOwe > 0.01 ? "#ef4444" : g.youOwe < -0.01 ? "#10b981" : "#9ca3af"};">
        ${g.youOwe > 0.01 ? `You owe ${g.currency} ${g.youOwe.toFixed(2)}` : g.youOwe < -0.01 ? `Owed ${g.currency} ${Math.abs(g.youOwe).toFixed(2)}` : "Settled ✓"}
      </td>
    </tr>
  `).join("")

  const categoryRows = topCategories.slice(0, 5).map((c) => `
    <tr>
      <td style="padding:8px 12px;color:#374151;">${c.category}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600;color:#111827;">${c.currency} ${c.amount.toFixed(2)}</td>
    </tr>
  `).join("")

  return resend.emails.send({
    from: FROM,
    to,
    subject: `Your ${month} spending summary — WhatsYourShare`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background:#ffffff;">

        <!-- Logo -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
          <div style="width:32px;height:32px;background:#7c3aed;border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:18px;font-weight:bold;">$</span>
          </div>
          <span style="font-weight:700;font-size:18px;color:#111827;">WhatsYourShare</span>
        </div>

        <p style="color:#6b7280;margin:0 0 4px;font-size:14px;">Hi ${firstName},</p>
        <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 4px;">Your ${month} ${year} summary</h1>
        <p style="color:#9ca3af;font-size:13px;margin:0 0 28px;">Here's a recap of your shared expenses last month.</p>

        <!-- Total -->
        <div style="background:#f5f3ff;border-radius:16px;padding:20px 24px;margin-bottom:24px;text-align:center;">
          <p style="margin:0 0 4px;color:#7c3aed;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Total spent across all groups</p>
          <div>${totalsHtml}</div>
        </div>

        ${groups.length > 0 ? `
        <!-- Groups breakdown -->
        <h2 style="font-size:15px;font-weight:700;color:#111827;margin:0 0 10px;">By group</h2>
        <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;margin-bottom:24px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9ca3af;font-weight:600;">Group</th>
              <th style="padding:8px 12px;text-align:right;font-size:12px;color:#9ca3af;font-weight:600;">Spent</th>
              <th style="padding:8px 12px;text-align:right;font-size:12px;color:#9ca3af;font-weight:600;">Balance</th>
            </tr>
          </thead>
          <tbody>${groupRows}</tbody>
        </table>
        ` : ""}

        ${topCategories.length > 0 ? `
        <!-- Top categories -->
        <h2 style="font-size:15px;font-weight:700;color:#111827;margin:0 0 10px;">Top categories</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
          <tbody>${categoryRows}</tbody>
        </table>
        ` : ""}

        <a href="${dashboardUrl}"
           style="display:inline-block;background:#7c3aed;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:32px;">
          View Dashboard →
        </a>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;" />
        <p style="color:#d1d5db;font-size:12px;margin:0;">
          You're receiving this because monthly summaries are enabled in your
          <a href="${dashboardUrl}/settings" style="color:#a78bfa;text-decoration:none;">account settings</a>.
        </p>
      </div>
    `,
  })
}

export async function sendExpenseNotificationEmail({
  to,
  name,
  description,
  amount,
  currency,
  groupName,
  paidByName,
  dashboardUrl,
}: {
  to: string
  name: string
  description: string
  amount: number
  currency: string
  groupName: string
  paidByName: string
  dashboardUrl: string
}) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `New expense in "${groupName}": ${description}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <p style="color:#6b7280;margin:0 0 16px;">Hi ${name},</p>
        <p style="color:#111827;margin:0 0 16px;">
          <strong>${paidByName}</strong> added a new expense to <strong>${groupName}</strong>:
        </p>
        <div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:24px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#111827;">${description}</p>
          <p style="margin:4px 0 0;color:#6b7280;">${currency} ${amount.toFixed(2)}</p>
        </div>
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          View in App →
        </a>
      </div>
    `,
  })
}
