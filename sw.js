/* KAI · Service worker de la app (PWA)
   - Red primero: el sitio siempre se ve en su versión más nueva; la copia guardada
     solo se usa si no hay internet (así la credencial abre sin señal).
   - Notificaciones (push) y el numerito sobre el ícono. */
var CACHE = "kai-app-v1";
var SHELL = ["/", "/app", "/index.html", "/app.js", "/app.css", "/members.js", "/images/logo.png", "/icon-192.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var r = e.request, u;
  if (r.method !== "GET") return;
  try { u = new URL(r.url); } catch (x) { return; }
  var same = u.origin === self.location.origin;
  var font = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname) || /cdn\.jsdelivr\.net$/.test(u.hostname);
  if (!same && !font) return;                       // Supabase y demás: directo, sin guardar
  if (same && /^\/(sw\.js|manifest\.webmanifest)$/.test(u.pathname)) return;
  e.respondWith(fetch(r).then(function (res) {
    if (res && (res.ok || res.type === "opaque")) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(r.mode === "navigate" ? "/index.html" : r, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(r.mode === "navigate" ? "/index.html" : r).then(function (m) { return m || caches.match("/index.html"); });
  }));
});

/* ---------- Notificaciones ---------- */
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  var title = d.title || "KAI";
  var opts = { body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png", tag: d.tag || undefined, data: { url: d.url || "/app/inbox" } };
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, opts),
    (typeof d.badge === "number" && self.navigator && self.navigator.setAppBadge) ? self.navigator.setAppBadge(d.badge).catch(function () {}) : null
  ]));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "/app";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      if ("focus" in cs[i]) { cs[i].postMessage({ kai: "go", url: url }); return cs[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
