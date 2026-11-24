/* Rotina da Casa — service worker (PWA) */
var VER = 'rc-v4-1';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'icon-maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VER).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VER; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== self.location.origin) return;           // Apps Script, Firebase, fontes: direto na rede
  var rede = r.mode === 'navigate' || /config\.js$/.test(u.pathname) || /\.(html|js)$/.test(u.pathname);
  if (rede) {                                                 // rede primeiro; sem internet, usa a cópia
    e.respondWith(fetch(r).then(function (resp) {
      if (resp && resp.ok) { var cp = resp.clone(); caches.open(VER).then(function (c) { c.put(r, cp); }); }
      return resp;
    }).catch(function () {
      return caches.match(r).then(function (m) { return m || caches.match('index.html') || caches.match('./'); });
    }));
    return;
  }
  e.respondWith(caches.match(r).then(function (m) {           // ícones etc.: cópia primeiro
    return m || fetch(r).then(function (resp) {
      if (resp && resp.ok) { var cp = resp.clone(); caches.open(VER).then(function (c) { c.put(r, cp); }); }
      return resp;
    });
  }));
});

self.addEventListener('push', function (event) {
  var p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { try { p = { body: event.data.text() }; } catch (e2) {} }
  var d = p.data || p.notification || p || {};
  var nivel = parseInt(d.nivel || '1', 10) || 1;
  var sos = d.sos === '1' || d.sos === 1 || d.tipo === 'sos';
  var opt = {
    body: d.texto || d.body || '',
    tag: d.tag || d.chave || 'rotina',
    renotify: true,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    requireInteraction: nivel >= 2 || sos,
    silent: d.silent === '1' || d.silent === true,
    data: { url: d.url || './', meet: d.meet || '' }
  };
  if (sos) opt.vibrate = [400, 150, 400, 150, 800, 150, 400];
  else if (nivel >= 2) opt.vibrate = [250, 100, 250];
  if (d.meet) opt.actions = [{ action: 'meet', title: 'Abrir Meet' }];
  var titulo = d.titulo || d.title || 'Rotina da Casa';
  event.waitUntil(
    self.registration.showNotification(titulo, opt).then(function () {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function (cs) { cs.forEach(function (c) { try { c.postMessage('refresh'); } catch (e) {} }); })
  );
});

self.addEventListener('notificationclick', function (event) {
  var n = event.notification, dt = n.data || {};
  n.close();
  event.waitUntil((function () {
    if (event.action === 'meet' && dt.meet) return self.clients.openWindow(dt.meet);
    var alvo = new URL(dt.url || './', self.registration.scope).href;
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
      for (var i = 0; i < cs.length; i++) {
        if ('focus' in cs[i]) { try { cs[i].postMessage('refresh'); } catch (e) {} return cs[i].focus(); }
      }
      return self.clients.openWindow(alvo);
    });
  })());
});
