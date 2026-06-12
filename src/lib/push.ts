/**
 * Web Push notification utility.
 * Uses VAPID keys from environment variables.
 *
 * Generate VAPID keys once:
 *   npx web-push generate-vapid-keys
 * Then add to .env:
 *   VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:you@example.com
 */
import webpush from "web-push"
import { prisma } from "@/lib/prisma"

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? ""
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? ""
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@whatsyourshare.app"

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  url?: string
  tag?: string
}

/**
 * Send a push notification to all subscribed devices for a user.
 * Silently removes stale subscriptions (410 Gone).
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!vapidPublicKey || !vapidPrivateKey) return // VAPID not configured

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  const staleIds: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) {
          staleIds.push(sub.id)
        }
      }
    })
  )

  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } })
  }
}

/**
 * Send push to all members of a group (except the actor).
 */
export async function sendPushToGroup(
  groupId: string,
  excludeUserId: string,
  payload: PushPayload
) {
  const members = await prisma.groupMember.findMany({
    where: { groupId, userId: { not: excludeUserId } },
    select: { userId: true },
  })

  await Promise.allSettled(
    members.map((m) => sendPushToUser(m.userId, payload))
  )
}

export { vapidPublicKey as VAPID_PUBLIC_KEY }
