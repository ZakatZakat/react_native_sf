/* Web Push Service Worker for event-curator */

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  if (!event.data) return
  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Новое событие", body: event.data.text() }
  }
  const title = payload.title || "Новое событие"
  const options = {
    body: payload.body || "",
    icon: "/vite.svg",
    badge: "/vite.svg",
    data: { url: payload.url || "/", channel: payload.channel, tags: payload.tags },
    tag: payload.url || "event",
    renotify: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    for (const c of all) {
      if (c.url.endsWith(url) && "focus" in c) return c.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})
