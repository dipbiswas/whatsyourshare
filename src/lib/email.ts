/**
 * Email sending utility using Resend.
 * Set RESEND_API_KEY in .env.
 * Set RESEND_FROM_EMAIL to your verified sender (e.g. "WhatsYourShare <noreply@whatsyourshare.app>")
 */
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder")
const FROM = process.env.RESEND_FROM_EMAIL ?? "WhatsYourShare <noreply@whatsyourshare.app>"

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
