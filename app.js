/* KAI · App para miembros (/app)
   App instalable (PWA): Inicio con la credencial, Eventos, Avisos y Perfil.
   Usa la misma sesión de Supabase que el Área de Miembros (members.js).
   Pestaña "Equipo" solo para quienes tienen rol en el panel. */
(function () {
  "use strict";

  var A = { st: "load", user: null, m: null, roles: [], events: null, flip: false, deferred: null, unread: 0, booted: false, tab: "home" };
  var SITE = location.origin;

  function L_() { try { return window.L === "es" ? "es" : "en"; } catch (e) { return "en"; } }
  function T(es, en) { return L_() === "es" ? es : en; }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function sb() { return window.KAI && window.KAI.sb; }
  function standalone() {
    try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch (e) { return false; }
  }
  function isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function d8(s) { if (!s) return null; var d = new Date(String(s).slice(0, 10) + "T12:00:00"); return isNaN(d) ? null : d; }
  function fdate(s, o) { var d = d8(s); return d ? d.toLocaleDateString(L_() === "es" ? "es-MX" : "en-US", o || { day: "numeric", month: "long", year: "numeric" }) : ""; }
  function fdt(s, o) { var d = new Date(s); return isNaN(d) ? "" : d.toLocaleString(L_() === "es" ? "es-MX" : "en-US", o); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function state(m) {
    var st = String(m.status || "active").toLowerCase();
    if (st !== "active") return "inactive";
    var v = d8(m.valid_through); if (v && v < new Date(new Date().toDateString())) return "expired";
    return "active";
  }

  var IC = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    team: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M14 10h4M14 14h4M6 16c.8-1.5 5.2-1.5 6 0"/>',
    back: '<path d="M15 18l-6-6 6-6"/>'
  };
  function svg(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + IC[k] + "</svg>"; }

  /* ---------- datos ---------- */
  async function load() {
    var c = sb();
    if (!c) { A.st = "down"; paint(); return; }
    var s = null;
    try { s = (await c.auth.getSession()).data.session; } catch (e) { s = null; }
    if (!s) { A.st = "out"; A.m = null; paint(); return; }
    A.user = s.user;
    var cached = store("kai-app-m");
    if (cached && cached.email && String(cached.email).toLowerCase() === String(s.user.email || "").toLowerCase()) { A.m = cached; A.st = "in"; paint(); }
    try {
      var em = String(s.user.email || "").toLowerCase().replace(/[\\%_]/g, "\\$&");
      var r = await c.from("members").select("*").ilike("email", em).limit(1).maybeSingle();
      if (r.error) throw r.error;
      A.m = r.data || null; A.st = r.data ? "in" : "none";
      if (r.data) store("kai-app-m", r.data);
    } catch (e) { if (!A.m) A.st = "down"; }
    try { var me = await c.rpc("staff_me"); A.roles = (me.data && me.data.roles) || []; } catch (e) { A.roles = []; }
    paint();
    loadEvents();
  }
  async function loadEvents() {
    var c = sb(); if (!c) return;
    try {
      var r = await c.rpc("ev_public_list");
      var now = Date.now() - 6 * 3600e3;
      A.events = (r.data || []).filter(function (e) { return new Date(e.starts_at).getTime() >= now; })
        .sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); });
    } catch (e) { A.events = A.events || []; }
    if (A.st === "in" || A.st === "none") paint();
  }

  /* ---------- rutas ---------- */
  function sub() { var p = location.pathname.replace(/\/+$/, ""); var m = p.match(/^\/app\/?([a-z]*)/); return (m && m[1]) || "home"; }

  /* ---------- pintar ---------- */
  function paint() {
    var root = $("kapp"); if (!root) return;
    var tab = sub(); A.tab = tab;
    var html = "";
    if (A.st === "load") html = '<div class="ka-load"><div class="ka-sp"></div>' + T("Cargando…", "Loading…") + "</div>";
    else if (A.st === "out") html = loginHTML();
    else if (A.st === "down") html = topHTML() + '<div class="ka-empty"><h3>' + T("Sin conexión", "No connection") + "</h3><p>" + T("No pudimos conectar con KAI. Revise su internet e intente de nuevo.", "We couldn't reach KAI. Check your internet and try again.") + '</p><button class="ka-btn navy" data-a="retry">' + T("Intentar de nuevo", "Try again") + "</button></div>";
    else {
      html = topHTML();
      if (tab === "events") html += eventsHTML();
      else if (tab === "inbox") html += inboxHTML();
      else if (tab === "profile") html += profileHTML();
      else html += homeHTML();
    }
    root.innerHTML = html;
    var nv = $("ka-navw");
    if (!nv) { nv = document.createElement("div"); nv.id = "ka-navw"; document.body.appendChild(nv); }
    nv.innerHTML = (A.st === "in" || A.st === "none") && document.body.classList.contains("is-app") ? navHTML(tab) : "";
    if (A.st === "out") wireLogin();
    setBadge();
  }

  function topHTML() {
    var l = L_();
    return '<div class="ka-top"><img src="images/logo.png" alt="Kingdom Alliance International"><div class="ka-lang" role="group" aria-label="Language">' +
      '<button data-l="es" aria-pressed="' + (l === "es") + '">ES</button><button data-l="en" aria-pressed="' + (l === "en") + '">EN</button></div></div>';
  }

  function greet() { var h = new Date().getHours(); return h < 12 ? T("Buenos días", "Good morning") : h < 19 ? T("Buenas tardes", "Good afternoon") : T("Buenas noches", "Good evening"); }
  function first(m) { return String((m && m.full_name) || "").trim().split(/\s+/)[0] || ""; }

  function homeHTML() {
    var m = A.m, h = '<div class="ka-hi"><small>' + greet() + "</small><h1>" + esc(first(m) || T("Bienvenido", "Welcome")) + "</h1></div>";
    if (m && window.KAI && window.KAI.cred) {
      var c = window.KAI.cred(m), st = state(m);
      h += '<div class="ka-cred" data-a="flip" role="button" tabindex="0" aria-label="' + T("Voltear credencial", "Flip credential") + '"><div class="kc">' + (A.flip ? c.back : c.front) + "</div></div>" +
        '<div class="ka-flip"><span class="ka-ok' + (st === "active" ? "" : " bad") + '"><i>' + (st === "active" ? "✓" : "!") + "</i>" +
        (st === "active" ? T("Credencial vigente · verificada por KAI", "Valid credential · verified by KAI") : st === "expired" ? T("Credencial vencida", "Credential expired") : T("Credencial inactiva", "Credential inactive")) +
        '</span><button data-a="flip">' + (A.flip ? T("Ver frente", "Show front") : T("Ver código QR", "Show QR code")) + "</button></div>";
    } else {
      h += '<div class="ka-card"><h3>' + T("Su credencial aún no está activa", "Your credential isn't active yet") + "</h3><p>" +
        T("Cuando su membresía esté aprobada y pagada, su credencial aparecerá aquí.", "Once your membership is approved and paid, your credential will appear here.") + "</p></div>";
    }
    var ev = (A.events || [])[0];
    h += '<div class="ka-tiles">' +
      tile("/app/events", "cal", T("Eventos", "Events"), ev ? esc(evTitle(ev)) + " · " + esc(fdt(ev.starts_at, { day: "numeric", month: "short" })) : A.events ? T("Sin eventos por ahora", "No events right now") : T("Cargando…", "Loading…"), "") +
      tile("/app/inbox", "bell", T("Avisos", "Notices"), A.unread ? T(A.unread + " nuevos", A.unread + " new") : T("Al día", "All caught up"), A.unread ? "hot" : "g", A.unread) +
      tile("/app/profile", "card", T("Mi membresía", "My membership"), m && m.valid_through ? T("Vence el ", "Expires ") + esc(fdate(m.valid_through, { day: "numeric", month: "short", year: "numeric" })) : T("Ver mis datos", "View my details"), "") +
      (A.roles.length ? tile("/staff", "team", T("Equipo", "Team"), T("Panel del equipo", "Team panel"), "g") : tile("/app/profile", "user", T("Perfil", "Profile"), T("Mis datos e idioma", "My details & language"), "g")) +
      "</div>";
    h += installHTML();
    return h;
  }
  function tile(href, ic, b, s, cls, n) {
    return '<a class="ka-tile ' + (cls || "") + '" href="' + href + '"><div class="ic">' + svg(ic) + "</div><b>" + b + "</b><span>" + s + "</span>" + (n ? '<i class="ka-bdg">' + n + "</i>" : "") + "</a>";
  }
  function evTitle(e) { return L_() === "en" ? (e.title_en || e.title) : (e.title || e.title_en); }

  function installHTML() {
    if (standalone() || store("kai-app-inst-x")) return "";
    var steps = isIOS()
      ? "<ol><li>" + T("Toque <b>Compartir</b> (el cuadro con la flecha) abajo en Safari.", "Tap <b>Share</b> (the square with the arrow) in Safari.") + "</li><li>" +
        T("Elija <b>Agregar a pantalla de inicio</b>.", "Choose <b>Add to Home Screen</b>.") + "</li><li>" + T("Toque <b>Agregar</b>. ¡Listo! KAI queda junto a sus apps.", "Tap <b>Add</b>. Done! KAI sits with your apps.") + "</li></ol>"
      : A.deferred ? '<button class="ka-btn gold" data-a="install">' + T("Instalar KAI", "Install KAI") + "</button>"
      : "<ol><li>" + T("Abra el menú del navegador (⋮).", "Open the browser menu (⋮).") + "</li><li>" + T("Elija <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.", "Choose <b>Install app</b> or <b>Add to Home screen</b>.") + "</li></ol>";
    return '<div class="ka-card ka-inst"><button class="x" data-a="instx" aria-label="' + T("Cerrar", "Close") + '">×</button><h3>' +
      T("Lleve KAI en su pantalla de inicio", "Keep KAI on your home screen") + "</h3><p>" +
      T("Abra su credencial con un toque, aun sin internet, y reciba los avisos de KAI.", "Open your credential in one tap, even offline, and get KAI notices.") + "</p>" + steps + "</div>";
  }

  function eventsHTML() {
    var h = '<h2 class="ka-h2">' + T("Eventos", "Events") + "</h2>";
    if (!A.events) return h + '<div class="ka-load"><div class="ka-sp"></div></div>';
    if (!A.events.length) return h + emptyHTML("cal", T("Sin eventos por ahora", "No events right now"), T("Cuando KAI anuncie un evento, aparecerá aquí.", "When KAI announces an event, it will show up here."));
    return h + A.events.map(function (e) {
      var cx = String(e.status || "") === "cancelled";
      var d = new Date(e.starts_at);
      return '<a class="ka-ev" href="/ev/' + esc(e.slug) + '"><div class="ph" style="background-image:url(&quot;' + esc(e.photo_url || "images/mission.jpg") + '&quot;)">' +
        '<div class="dt"><b>' + esc(fdt(d, { month: "short" }).replace(".", "").toUpperCase()) + "</b><i>" + d.getDate() + "</i></div></div>" +
        '<div class="bd"><h3>' + esc(evTitle(e)) + '</h3><div class="m">' + esc(cap(fdt(d, { weekday: "long", hour: "numeric", minute: "2-digit" }))) + (e.venue ? " · " + esc(e.venue) : "") + "</div>" +
        (cx ? '<span class="cx">' + T("Cancelado", "Cancelled") + "</span>" : '<div class="go">' + (e.open ? T("Ver y registrarme →", "View & register →") : T("Ver detalles →", "View details →")) + "</div>") + "</div></a>";
    }).join("");
  }

  function inboxHTML() {
    return '<h2 class="ka-h2">' + T("Avisos", "Notices") + "</h2>" +
      emptyHTML("bell", T("No tiene avisos nuevos", "No new notices"), T("Aquí le llegarán los mensajes del equipo de KAI, los recordatorios de eventos y las respuestas a sus solicitudes.", "Messages from the KAI team, event reminders and replies to your requests will appear here.")) +
      '<div class="ka-card"><h3>' + T("Avisos en su celular", "Notices on your phone") + "</h3><p>" +
      T("Muy pronto podrá activar los avisos para recibirlos aunque la app esté cerrada, con el numerito rojo sobre el ícono de KAI.", "Soon you'll be able to turn on notices and get them even when the app is closed, with the red badge on the KAI icon.") + "</p></div>";
  }

  function profileHTML() {
    var m = A.m;
    if (!m) return '<h2 class="ka-h2">' + T("Perfil", "Profile") + "</h2>" + '<div class="ka-card"><p>' + esc(A.user && A.user.email) + "</p></div>" + outHTML();
    var st = state(m), cls = st === "active" ? "" : st === "expired" ? "exp" : "ina";
    var ph = m.photo_url ? ' style="background-image:url(&quot;' + esc(m.photo_url) + '&quot;)">' : ">" + esc(first(m).charAt(0));
    var rows = [
      [T("Estado", "Status"), '<span class="ka-pill ' + cls + '">' + (st === "active" ? T("Activa", "Active") : st === "expired" ? T("Vencida", "Expired") : T("Inactiva", "Inactive")) + "</span>"],
      [T("Credencial", "Credential"), esc(m.credential_no || "—")],
      [T("Miembro desde", "Member since"), esc(fdate(m.member_since) || "—")],
      [T("Vence", "Expires"), esc(fdate(m.valid_through) || "—")],
      [T("Iglesia", "Church"), esc(m.church || "—")],
      [T("Ciudad", "City"), esc([m.city, m.state].filter(Boolean).join(", ") || "—")],
      [T("Teléfono", "Phone"), esc(m.phone ? (window.KPH ? KPH(m.phone) : m.phone) : "—")],
      [T("Correo", "Email"), esc(m.email || "—")]
    ];
    return '<div class="ka-prof"><div class="ka-av"' + ph + "</div><div><h2>" + esc(m.full_name) + "</h2><span>" + esc(m.title || "") + "</span></div></div>" +
      '<dl class="ka-dl">' + rows.map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") + "</dl>" +
      '<div class="ka-row"><a class="ka-btn line" href="/membership">' + T("Pedir un cambio de datos", "Request a change") + "</a></div>" + outHTML();
  }
  function outHTML() { return '<button class="ka-btn line wide" data-a="out" style="margin-top:14px;border-color:#d0c7b2;color:#5b6577">' + T("Cerrar sesión", "Sign out") + "</button>"; }

  function emptyHTML(ic, h, p) { return '<div class="ka-empty"><div class="ic">' + svg(ic) + "</div><h3>" + h + "</h3><p>" + p + "</p></div>"; }

  function navHTML(tab) {
    var items = [["home", "/app", "home", T("Inicio", "Home")], ["events", "/app/events", "cal", T("Eventos", "Events")], ["inbox", "/app/inbox", "bell", T("Avisos", "Notices")], ["profile", "/app/profile", "user", T("Perfil", "Profile")]];
    if (A.roles.length) items.push(["team", "/staff", "team", T("Equipo", "Team")]);
    return '<div class="ka-nav" role="navigation" aria-label="' + T("Menú de la app", "App menu") + '"><div class="in">' + items.map(function (x) {
      return '<a href="' + x[1] + '" class="' + (tab === x[0] ? "on" : "") + '"' + (tab === x[0] ? ' aria-current="page"' : "") + ">" + svg(x[2]) + x[3] +
        (x[0] === "inbox" && A.unread ? '<i class="ka-bdg">' + A.unread + "</i>" : "") + "</a>";
    }).join("") + "</div></div>";
  }

  function loginHTML() {
    return '<div class="ka-login"><img class="lg" src="images/logo.png" alt="Kingdom Alliance International"><h1>' + T("Bienvenido a KAI", "Welcome to KAI") + '</h1><p class="sub">' +
      T("Entre con el correo y la contraseña de su Área de Miembros.", "Sign in with your Members Area email and password.") + "</p>" +
      '<form id="ka-lf" novalidate><div class="ka-fld"><label for="ka-e">' + T("Correo", "Email") + '</label><input id="ka-e" name="email" type="email" autocomplete="username" required></div>' +
      '<div class="ka-fld"><label for="ka-p">' + T("Contraseña", "Password") + '</label><input id="ka-p" name="password" type="password" autocomplete="current-password" required></div>' +
      '<button class="ka-btn gold wide" type="submit">' + T("Entrar", "Sign in") + '</button><p class="ka-msg" id="ka-lm" role="status" aria-live="polite"></p></form>' +
      '<div class="ka-links"><a href="/membership">' + T("¿Olvidó su contraseña?", "Forgot your password?") + "</a><br><br>" +
      T("¿Aún no es miembro? ", "Not a member yet? ") + '<a href="/join">' + T("Únase a KAI", "Join KAI") + "</a></div></div>";
  }
  function wireLogin() {
    var f = $("ka-lf"); if (!f) return;
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      var em = f.elements.email.value.trim(), pw = f.elements.password.value, msg = $("ka-lm"), b = f.querySelector("[type=submit]");
      msg.className = "ka-msg";
      if (!em || !pw) { msg.textContent = T("Escriba su correo y contraseña.", "Enter your email and password."); msg.className = "ka-msg err"; return; }
      b.disabled = true; msg.textContent = T("Entrando…", "Signing in…");
      try {
        var r = await sb().auth.signInWithPassword({ email: em, password: pw });
        if (r.error) {
          var code = (r.error.code || "") + " " + (r.error.message || "");
          msg.textContent = /invalid/i.test(code) ? T("El correo o la contraseña no coinciden.", "Email or password doesn't match.") : /confirm/i.test(code) ? T("Primero confirme su correo con el enlace que le enviamos.", "Please confirm your email first using the link we sent.") : T("No se pudo entrar. Intente de nuevo.", "Couldn't sign in. Please try again.");
          msg.className = "ka-msg err"; b.disabled = false; return;
        }
        A.st = "load"; paint(); load();
      } catch (x) { msg.textContent = T("No se pudo entrar. Intente de nuevo.", "Couldn't sign in. Please try again."); msg.className = "ka-msg err"; b.disabled = false; }
    });
  }

  function setBadge() {
    try { if (navigator.setAppBadge) { if (A.unread) navigator.setAppBadge(A.unread); else navigator.clearAppBadge(); } } catch (e) {}
  }

  /* ---------- acciones ---------- */
  document.addEventListener("click", async function (e) {
    var root = $("kapp"); if (!root || !root.contains(e.target)) return;
    var a = e.target.closest("[data-a],[data-l]"); if (!a) return;
    if (a.dataset.l) { window.L = a.dataset.l; try { localStorage.setItem("kai-lang", a.dataset.l); } catch (x) {} var lb = document.querySelector('.lang button[data-l="' + a.dataset.l + '"]'); if (lb) lb.click(); else paint(); return; }
    var k = a.dataset.a;
    if (k === "flip") { A.flip = !A.flip; paint(); return; }
    if (k === "retry") { A.st = "load"; paint(); load(); return; }
    if (k === "instx") { store("kai-app-inst-x", 1); paint(); return; }
    if (k === "install" && A.deferred) { A.deferred.prompt(); try { await A.deferred.userChoice; } catch (x) {} A.deferred = null; paint(); return; }
    if (k === "out") {
      a.disabled = true;
      try { await sb().auth.signOut(); } catch (x) {}
      try { localStorage.removeItem("kai-app-m"); } catch (x) {}
      A.m = null; A.roles = []; A.st = "out"; KGO("/app"); return;
    }
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('.ka-cred[data-a="flip"]')) { e.preventDefault(); A.flip = !A.flip; paint(); }
  });

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); A.deferred = e; if (A.tab === "home") paint(); });
  window.addEventListener("appinstalled", function () { A.deferred = null; paint(); });

  /* ---------- botón "Volver a la app" en páginas del sitio ---------- */
  function backBtn(v) {
    var b = $("ka-back");
    var show = standalone() && v !== "app";
    if (!show) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("a"); b.id = "ka-back"; b.className = "ka-back"; b.href = "/app"; document.body.appendChild(b); }
    b.innerHTML = svg("back") + T("Volver a la app", "Back to the app");
  }

  /* ---------- enganche con el router del sitio ---------- */
  window.KAIAPPX = {
    view: function (v) {
      document.body.classList.toggle("is-app", v === "app");
      backBtn(v);
      if (v !== "app") { var nw = $("ka-navw"); if (nw) nw.innerHTML = ""; return; }
      try { document.title = "KAI"; } catch (e) {}
      if (!A.booted) { A.booted = true; load(); }
      paint();
      if (A.events === null && A.st === "in") loadEvents();
    }
  };

  /* Al abrir la app instalada en la página de inicio del sitio, ir directo a la app */
  if (standalone() && (location.pathname === "/" || location.pathname === "/index.html") && !location.hash) {
    try { history.replaceState(null, "", "/app"); } catch (e) {}
  }

  /* Service worker (app instalable, sin internet y notificaciones) */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });
    navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.kai === "go" && e.data.url) KGO(e.data.url); });
  }

  /* Si la sesión cambia en otra parte del sitio, refrescar */
  setTimeout(function () {
    var c = sb(); if (!c) return;
    c.auth.onAuthStateChange(function (ev) {
      if (ev === "SIGNED_OUT") { A.m = null; A.roles = []; A.st = "out"; if (A.tab) paint(); }
      if (ev === "SIGNED_IN" && A.booted && A.st === "out") { A.st = "load"; load(); }
    });
  }, 0);
})();
