self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "You have a new notification",
      data: {
        url: data.url || "/orders"
      },
      vibrate: [200, 100, 200],
      requireInteraction: true
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "WILDBIRD", options)
    );
  } catch (error) {
    console.error("Push event error:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/orders";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
