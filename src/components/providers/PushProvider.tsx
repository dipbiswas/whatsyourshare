"use client"

/**
 * PushProvider
 * Registers the service worker and subscribes to Web Push on mount.
 * Drop into the root layout — it renders nothing visible.
 */
import { useEffect } from "react"
import { useSession } from "next-auth/react"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function PushProvider() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user) return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return

    async function subscribe() {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
        await navigator.serviceWorker.ready

        // Check existing subscription
        let sub = await reg.pushManager.getSubscription()
        if (sub) return // already subscribed

        // Ask permission
        const permission = await Notification.requestPermission()
        if (permission !== "granted") return

        // Fetch VAPID public key
        const res = await fetch("/api/push/vapid-key")
        if (!res.ok) return
        const { publicKey } = await res.json()
        if (!publicKey) return

        // Subscribe
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })

        // Save subscription to server
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        })
      } catch (err) {
        // Silently fail — push notifications are non-critical
        console.debug("Push subscription failed:", err)
      }
    }

    subscribe()
  }, [session?.user])

  return null
}
