// WhatsYourShare Service Worker
// Handles Web Push notifications and basic offline caching.

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

// Push event — display notification
self.addEventListener("push", (event) => {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: "WhatsYourShare", body: event.data.text() }
  }

  const { title = "WhatsYourShare", body = "", icon = "/icon-192.png", url = "/dashboard", tag } = data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/icon-192.png",
      tag,
      data: { url },
      vibrate: [200, 100, 200],
    })
  )
})

// Notification click — open or focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/dashboard"

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url)
      })
  )
})
