/**
 * Service Worker — Push notification handler
 * ============================================
 * Installs immediately (skipWaiting), claims all clients on activate.
 * push event: parses incoming JSON payload (title, body, icon, badge,
 * data) and displays a notification with vibration [200, 100, 200].
 * notificationclick event: closes the notification, navigates to
 * data.path, /market/{fixtureId} if data.fixtureId exists, or / as
 * the default fallback.
 */

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
  var data = {
    title: 'WorldCup PredMarket',
    body: '',
  };

  try {
    if (event.data) {
      var parsed = event.data.json();
      for (var key in parsed) {
        data[key] = parsed[key];
      }
    }
  } catch (_) {
    data.body = event.data ? event.data.text() : '';
  }

  var options = {
    body: data.body,
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    data: data.data || {},
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var urlToOpen = new URL('/', self.location.origin);

  var nd = event.notification.data;
  if (nd && nd.path) {
    urlToOpen.pathname = nd.path;
  } else if (nd && nd.fixtureId) {
    urlToOpen.pathname = '/market/' + nd.fixtureId;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === urlToOpen.toString() && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen.toString());
      }
    })
  );
});
