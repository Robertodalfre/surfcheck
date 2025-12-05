self.addEventListener('push', (event) => {
  try {
    const getPayload = () => {
      try {
        return event.data && event.data.json ? event.data.json() : {};
      } catch {
        return {};
      }
    };
    const payload = getPayload() || {};
    const n = payload.notification || {};
    const title = n.title || 'SurfCheck';
    const options = {
      body: n.body || 'Você tem uma nova notificação.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data: payload.data || {},
      vibrate: [100, 50, 100]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // noop
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
