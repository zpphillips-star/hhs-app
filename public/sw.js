self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Hallowed Hop Society'
  const options = {
    body: data.body || 'A new beer awaits.',
    icon: '/icon.png',
    badge: '/icon.png',
    data: {
      url: data.url || '/beers',
      notificationId: data.notificationId || null,
      userId: data.userId || null,
    },
    vibrate: [200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || '/beers'
  const notificationId = event.notification.data?.notificationId
  const userId = event.notification.data?.userId

  event.waitUntil(
    Promise.all([
      // Track the open — fire and forget, don't block navigation
      notificationId
        ? fetch('/api/notification-open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationId, userId }),
          }).catch(() => {})
        : Promise.resolve(),

      // Open/focus the app
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        if (clients.openWindow) return clients.openWindow(url)
      }),
    ])
  )
})
