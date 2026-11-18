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
    back: '<path d="M15 18l-6-6 6-6"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7h-4M17 21v-1"/>',
    zoom: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    pin: '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'
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
    try { var me = await c.rpc("staff_me"); A.me = me.data || null; A.roles = (me.data && me.data.roles) || []; } catch (e) { A.roles = []; }
    paint();
    loadEvents();
    loadInbox();
    pushCheck();
    if (A.roles.length) loadTeam();
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
  function sub2() { var m = location.pathname.match(/^\/app\/[a-z]+\/([a-z]+)/); return (m && m[1]) || ""; }
  function qn() { try { return +new URLSearchParams(location.search).get("n") || 0; } catch (e) { return 0; } }

  /* ---------- pintar ---------- */
  function paint() {
    var root = $("kapp"); if (!root) return;
    var tab = sub(); A.tab = tab;
    var key = tab + "/" + sub2(); if (key !== A.lastKey) { if (sub2()) A.cmp = null; A.lastKey = key; }
    var html = "";
    if (A.st === "load") html = '<div class="ka-load"><div class="ka-sp"></div>' + T("Cargando…", "Loading…") + "</div>";
    else if (A.st === "out") html = loginHTML();
    else if (A.st === "down") html = hero({ eb: "KAI", title: T("Sin conexión", "No connection") }) + '<div class="ka-empty"><h3>' + T("Sin conexión", "No connection") + "</h3><p>" + T("No pudimos conectar con KAI. Revise su internet e intente de nuevo.", "We couldn't reach KAI. Check your internet and try again.") + '</p><button class="ka-btn navy" data-a="retry">' + T("Intentar de nuevo", "Try again") + "</button></div>";
    else {
      if (tab === "events") html += eventsHTML();
      else if (tab === "inbox") html += inboxHTML();
      else if (tab === "profile") html += profileHTML();
      else if (tab === "team") html += sub2() === "aviso" ? composeHTML("notice") : sub2() === "reunion" ? composeHTML("meeting") : teamHTML();
      else html += homeHTML();
    }
    root.innerHTML = html;
    if (A.lastTab !== tab) { root.classList.remove("ka-enter"); void root.offsetWidth; root.classList.add("ka-enter"); A.lastTab = tab; window.scrollTo(0, 0); }
    var nv = $("ka-navw");
    if (!nv) { nv = document.createElement("div"); nv.id = "ka-navw"; document.body.appendChild(nv); }
    nv.innerHTML = (A.st === "in" || A.st === "none") && document.body.classList.contains("is-app") ? navHTML(tab) : "";
    if (A.st === "out") wireLogin();
    if (tab === "team") { wireTeam(); if (sub2()) wireCompose(); }
    if (tab === "inbox") inboxOpened();
    setBadge();
  }

  function rings() { return '<svg class="rg" viewBox="0 0 400 400" aria-hidden="true"><g fill="none" stroke="#e3bf63"><circle cx="200" cy="200" r="190" stroke-opacity=".10"/><circle cx="200" cy="200" r="150" stroke-opacity=".14"/><circle cx="200" cy="200" r="110" stroke-opacity=".18"/><circle cx="200" cy="200" r="70" stroke-opacity=".22"/></g></svg>'; }
  function hero(o) {
    var l = L_();
    return '<div class="ka-hero ' + (o.cls || "") + '">' + rings() + '<i class="glow"></i><div class="hb"><img class="lw" src="images/logo.png" alt="Kingdom Alliance International">' + (o.top || "") + "</div>" +
      '<div class="ht"><div class="tx">' + (o.eb ? "<small>" + o.eb + "</small>" : "") + "<h1>" + o.title + "</h1>" + (o.sub ? "<p>" + o.sub + "</p>" : "") + "</div>" + (o.side || "") + "</div>" + (o.extra || "") + "</div>";
  }
  function avatar(m, cls) {
    var ph = m && m.photo_url;
    return '<div class="ka-av ' + (cls || "") + '"' + (ph ? ' style="background-image:url(&quot;' + esc(ph) + '&quot;)">' : ">" + esc(first(m).charAt(0) || "K")) + "</div>";
  }
  function todayLong() { return cap(new Date().toLocaleDateString(L_() === "es" ? "es-MX" : "en-US", { weekday: "long", day: "numeric", month: "long" })); }

  function greet() { var h = new Date().getHours(); return h < 12 ? T("Buenos días", "Good morning") : h < 19 ? T("Buenas tardes", "Good afternoon") : T("Buenas noches", "Good evening"); }
  function first(m) { return String((m && m.full_name) || "").trim().split(/\s+/)[0] || ""; }

  function homeHTML() {
    var m = A.m;
    var h = hero({ cls: "home", eb: greet(), title: esc(first(m) || T("Bienvenido", "Welcome")), sub: todayLong(), side: m ? '<a href="/app/profile" class="avl" aria-label="' + T("Mi perfil", "My profile") + '">' + avatar(m) + "</a>" : "" });
    if (m && window.KAI && window.KAI.cred) {
      var c = window.KAI.cred(m), st = state(m);
      h += '<div class="ka-credw"><div class="ka-cred' + (A.flip ? " back" : "") + '" data-a="flip" role="button" tabindex="0" aria-label="' + T("Voltear credencial", "Flip credential") + '"><div class="kc">' + (A.flip ? c.back : c.front) + "</div></div>" +
        '<div class="ka-flip"><span class="ka-ok' + (st === "active" ? "" : " bad") + '"><i>' + (st === "active" ? "✓" : "!") + "</i>" +
        (st === "active" ? T("Vigente · verificada por KAI", "Valid · verified by KAI") : st === "expired" ? T("Credencial vencida", "Credential expired") : T("Credencial inactiva", "Credential inactive")) +
        '</span><button data-a="qrfull">' + svg("qr") + T("Mostrar QR", "Show QR") + "</button></div></div>";
    } else {
      h += '<div class="ka-credw"><div class="ka-card ka-nocred"><h3>' + T("Su credencial aún no está activa", "Your credential isn't active yet") + "</h3><p>" +
        T("Cuando su membresía esté aprobada y pagada, su credencial aparecerá aquí.", "Once your membership is approved and paid, your credential will appear here.") + "</p></div></div>";
    }
    h += '<div class="ka-qa">' +
      qa("/app/events", "cal", "tc", T("Eventos", "Events")) +
      qa("/app/inbox", "bell", "gd", T("Avisos", "Notices"), A.unread) +
      qa("/app/profile", "card", "bl", T("Membresía", "Membership")) +
      (A.roles.length ? qa("/app/team", "team", "nv", T("Equipo", "Team"), A.tcount) : qa("/app/profile", "user", "nv", T("Perfil", "Profile"))) + "</div>";
    var ev = (A.events || [])[0];
    if (ev) {
      var d = new Date(ev.starts_at), days = Math.ceil((d - new Date()) / 864e5);
      h += '<div class="ka-sec">' + T("Próximo evento", "Next event") + '</div><a class="ka-next" href="/ev/' + esc(ev.slug) + '" style="background-image:url(&quot;' + esc(ev.photo_url || "images/mission.jpg") + '&quot;)">' +
        '<span class="cd">' + (days <= 0 ? T("¡Hoy!", "Today!") : days === 1 ? T("Mañana", "Tomorrow") : T("En " + days + " días", "In " + days + " days")) + "</span>" +
        '<div class="nb"><div class="dt"><b>' + esc(fdt(d, { month: "short" }).replace(".", "").toUpperCase()) + "</b><i>" + d.getDate() + "</i></div><div><h3>" + esc(evTitle(ev)) + "</h3><p>" + esc(cap(fdt(d, { weekday: "long", hour: "numeric", minute: "2-digit" }))) + (ev.venue ? " · " + esc(ev.venue) : "") + "</p></div></div>" +
        '<span class="go">' + (ev.open ? T("Registrarme", "Register") : T("Ver evento", "View event")) + " →</span></a>";
    }
    if (m && m.valid_through) {
      var end = d8(m.valid_through), start = new Date(end); start.setFullYear(start.getFullYear() - 1);
      var left = Math.max(0, Math.ceil((end - new Date()) / 864e5)), pct = Math.min(100, Math.max(left ? 3 : 0, 100 * left / Math.max(1, (end - start) / 864e5))), warn = left <= 30;
      h += '<div class="ka-sec">' + T("Mi membresía", "My membership") + '</div><a class="ka-mem' + (warn ? " warn" : "") + '" href="/app/profile"><div class="r1"><div><b>' + (state(m) !== "active" || left === 0 ? T("Renueve su membresía", "Renew your membership") : warn ? T("Renueve pronto", "Renew soon") : T("Activa y al día", "Active and current")) + "</b><span>" +
        T("Vigente hasta el ", "Valid through ") + esc(fdate(m.valid_through)) + '</span></div><div class="lf"><b>' + left + "</b><span>" + T("días restantes", "days left") + '</span></div></div><div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div>' + (warn ? '<span class="rn">' + T("Renovar ahora →", "Renew now →") + "</span>" : "") + "</a>";
    }
    h += installHTML();
    return h;
  }
  function qa(href, ic, c, label, n) { return '<a class="qa q-' + c + '" href="' + href + '"><span class="ic">' + svg(ic) + (n ? '<i class="ka-bdg">' + n + "</i>" : "") + "</span>" + label + "</a>"; }
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
    var h = hero({ cls: "sm", eb: T("Comunidad", "Community"), title: T("Eventos", "Events"), sub: T("Conéctese con otros pastores", "Connect with fellow pastors") });
    if (!A.events) return h + '<div class="ka-load"><div class="ka-sp"></div></div>';
    if (!A.events.length) return h + emptyHTML("cal", T("Sin eventos por ahora", "No events right now"), T("Cuando KAI anuncie un evento, aparecerá aquí.", "When KAI announces an event, it will show up here."));
    return h + '<div class="ka-list">' + A.events.map(function (e, i) {
      var cx = String(e.status || "") === "cancelled", d = new Date(e.starts_at), days = Math.ceil((d - new Date()) / 864e5);
      return '<a class="ka-ev" href="/ev/' + esc(e.slug) + '" style="--i:' + i + ';background-image:url(&quot;' + esc(e.photo_url || "images/mission.jpg") + '&quot;)">' +
        '<div class="dt"><b>' + esc(fdt(d, { month: "short" }).replace(".", "").toUpperCase()) + "</b><i>" + d.getDate() + "</i></div>" +
        (cx ? '<span class="cd cx">' + T("Cancelado", "Cancelled") + "</span>" : '<span class="cd">' + (days <= 0 ? T("¡Hoy!", "Today!") : days === 1 ? T("Mañana", "Tomorrow") : T("En " + days + " días", "In " + days + " days")) + "</span>") +
        '<div class="bd"><h3>' + esc(evTitle(e)) + '</h3><p>' + svg("cal") + esc(cap(fdt(d, { weekday: "long", hour: "numeric", minute: "2-digit" }))) + "</p>" + (e.venue ? "<p>" + svg("pin") + esc(e.venue) + "</p>" : "") +
        (cx ? "" : '<span class="go">' + (e.open ? T("Registrarme", "Register") : T("Ver detalles", "View details")) + " →</span>") + "</div></a>";
    }).join("") + "</div>";
  }

  /* ---------- Avisos (bandeja del miembro) ---------- */
  async function loadInbox() {
    var c = sb(); if (!c) return;
    try {
      var r = await c.rpc("my_notices"); if (r.error) throw r.error;
      A.inbox = r.data || { rows: [], unread: 0 };
      A.unread = A.inbox.unread || 0;
    } catch (e) { A.inbox = A.inbox || { rows: [], unread: 0, off: true }; }
    if (A.st === "in" || A.st === "none") paint();
  }
  function inboxOpened() {
    var id = qn();
    if (id && A.inbox) { var n = (A.inbox.rows || []).filter(function (x) { return x.id === id; })[0]; if (n && !n.read) markRead(n); }
  }
  async function markRead(n) {
    n.read = true; A.unread = Math.max(0, (A.unread || 0) - 1); if (A.inbox) A.inbox.unread = A.unread; setBadge();
    try { await sb().rpc("notice_read", { p_id: n.id }); } catch (e) {}
  }
  function agoT(s) {
    var m = (Date.now() - new Date(s).getTime()) / 6e4;
    if (m < 1) return T("Ahora", "Now"); if (m < 60) return T("Hace " + Math.floor(m) + " min", Math.floor(m) + " min ago");
    if (m < 1440) return T("Hace " + Math.floor(m / 60) + " h", Math.floor(m / 60) + " h ago");
    return cap(fdt(s, { day: "numeric", month: "short" }));
  }
  function meetWhen(n) { return cap(fdt(n.starts_at, { weekday: "long", day: "numeric", month: "long" })) + " · " + fdt(n.starts_at, { hour: "numeric", minute: "2-digit" }); }
  function icsHref(n) {
    var z = function (d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }, s = new Date(n.starts_at), e = new Date(s.getTime() + (n.minutes || 60) * 6e4);
    var x = function (t) { return String(t || "").replace(/[,;\\]/g, "\\$&").replace(/\n/g, "\\n"); };
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KAI//App//ES", "BEGIN:VEVENT", "UID:kai-" + n.id + "@kaie44.org", "DTSTAMP:" + z(new Date()), "DTSTART:" + z(s), "DTEND:" + z(e),
      "SUMMARY:" + x(n.title), "DESCRIPTION:" + x((n.body ? n.body + "\n\n" : "") + (n.zoom_url ? "Zoom: " + n.zoom_url : "")), n.zoom_url ? "LOCATION:" + x(n.zoom_url) : "", "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:" + x(n.title), "END:VALARM", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  }
  function gcalHref(n) {
    var z = function (d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }, s = new Date(n.starts_at), e = new Date(s.getTime() + (n.minutes || 60) * 6e4);
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(n.title) + "&dates=" + z(s) + "/" + z(e) + "&details=" + encodeURIComponent((n.body || "") + (n.zoom_url ? "\n\nZoom: " + n.zoom_url : ""));
  }

  function inboxHTML() {
    var id = qn(), ib = A.inbox;
    if (id && ib) { var one = (ib.rows || []).filter(function (x) { return x.id === id; })[0]; if (one) return noticeHTML(one); }
    var h = hero({ cls: "sm", eb: T("Bandeja", "Inbox"), title: T("Avisos", "Notices"), sub: A.unread ? T(A.unread + (A.unread === 1 ? " sin leer" : " sin leer"), A.unread + " unread") : T("Mensajes del equipo y recordatorios", "Team messages and reminders") });
    h += pushCardHTML();
    if (!ib) return h + '<div class="ka-load"><div class="ka-sp"></div></div>';
    var rows = ib.rows || [];
    if (!rows.length) return h + '<div class="ka-empty art"><div class="bub"><i class="b1"></i><i class="b2"></i><i class="b3">' + svg("bell") + "</i></div><h3>" + T("Todo al día", "All caught up") + "</h3><p>" +
      T("Aquí le llegarán los mensajes del equipo de KAI, las invitaciones a reuniones y los recordatorios.", "Messages from the KAI team, meeting invitations and reminders will appear here.") + "</p></div>";
    if (A.unread) h += '<div class="kn-bar"><span>' + T("Recientes", "Recent") + '</span><button data-a="readall">' + T("Marcar todo como leído", "Mark all as read") + "</button></div>";
    return h + '<div class="kn-list">' + rows.map(function (n, i) {
      var meet = n.kind === "meeting";
      return '<a class="kn' + (n.read ? "" : " new") + (meet ? " meet" : "") + '" href="/app/inbox?n=' + n.id + '" style="--i:' + i + '"><span class="ic">' + svg(meet ? "cal" : "bell") + "</span><span class=\"tx\"><b>" + esc(n.title) + "</b>" +
        "<small>" + (meet ? esc(meetWhen(n)) + (n.cancelled ? " · " + T("Cancelada", "Cancelled") : n.rsvp === "yes" ? " · ✓ " + T("Asistiré", "Going") : n.rsvp === "no" ? " · " + T("No puedo", "Can't go") : "") : esc(n.body || "")) + "</small>" +
        '<em>' + esc(n.from || "KAI") + " · " + esc(agoT(n.at)) + "</em></span>" + (n.read ? "" : '<i class="dot"></i>') + "</a>";
    }).join("") + "</div>";
  }
  function noticeHTML(n) {
    var meet = n.kind === "meeting", past = meet && new Date(n.starts_at).getTime() + (n.minutes || 60) * 6e4 < Date.now();
    var h = '<div class="kn-top"><a href="/app/inbox" class="bk">' + svg("back") + T("Avisos", "Notices") + "</a></div>";
    h += '<div class="kn-det' + (meet ? " meet" : "") + '"><span class="tag">' + (meet ? T("Invitación · Reunión", "Invitation · Meeting") : T("Aviso", "Notice")) + "</span><h1>" + esc(n.title) + "</h1>" +
      '<p class="by">' + T("De ", "From ") + esc(n.from || "KAI") + " · " + esc(agoT(n.at)) + "</p>";
    if (meet) {
      h += '<div class="when"><div class="dt"><b>' + esc(fdt(n.starts_at, { month: "short" }).replace(".", "").toUpperCase()) + "</b><i>" + new Date(n.starts_at).getDate() + "</i></div><div><b>" + esc(cap(fdt(n.starts_at, { weekday: "long", day: "numeric", month: "long" }))) + "</b><span>" +
        esc(fdt(n.starts_at, { hour: "numeric", minute: "2-digit" })) + (n.minutes ? " · " + n.minutes + " min" : "") + (n.zoom_url ? " · Zoom" : "") + "</span></div></div>";
    }
    if (n.body) h += '<div class="msg">' + esc(n.body).replace(/\n/g, "<br>") + "</div>";
    if (meet && n.cancelled) h += '<div class="kn-cx">' + T("Esta reunión se canceló.", "This meeting was cancelled.") + "</div>";
    else if (meet && !past) {
      h += '<div class="kn-acts">' + (n.zoom_url ? '<a class="ka-btn zoom wide" href="' + esc(n.zoom_url) + '" target="_blank" rel="noopener">' + svg("zoom") + T("Abrir Zoom", "Open Zoom") + "</a>" : "") +
        '<div class="two"><a class="ka-btn line" href="' + icsHref(n) + '" download="KAI-reunion.ics">' + svg("cal") + T("Calendario", "Calendar") + '</a><a class="ka-btn line" href="' + gcalHref(n) + '" target="_blank" rel="noopener">Google</a></div>' +
        '<div class="rs"><b>' + T("¿Podrá asistir?", "Will you attend?") + '</b><div class="two"><button class="ka-btn ' + (n.rsvp === "yes" ? "ok on" : "line") + '" data-a="rsvp" data-v="yes" data-id="' + n.id + '">✓ ' + T("Asistiré", "I'll be there") + '</button><button class="ka-btn ' + (n.rsvp === "no" ? "no on" : "line") + '" data-a="rsvp" data-v="no" data-id="' + n.id + '">' + T("No puedo", "Can't make it") + "</button></div>" +
        (n.invited ? '<p class="cnt">' + T(n.yes + " de " + n.invited + " confirmaron", n.yes + " of " + n.invited + " confirmed") + "</p>" : "") + "</div></div>";
    } else if (n.url && /^\//.test(n.url)) h += '<a class="ka-btn tc wide" href="' + esc(n.url) + '">' + T("Abrir", "Open") + " →</a>";
    return h + "</div>";
  }

  /* ---------- Activar avisos en este celular ---------- */
  function pushState() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return isIOS() && !standalone() ? "install" : "nosup";
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "granted" && A.pushOn) return "on";
    return "off";
  }
  function pushCardHTML() {
    var st = pushState();
    if (st === "on") return '<div class="kp on"><span class="ic">' + svg("bell") + "</span><div><b>" + T("Avisos activados", "Notices are on") + "</b><span>" + T("Le llegarán a este celular aunque la app esté cerrada.", "They'll reach this phone even when the app is closed.") + "</span></div></div>";
    if (st === "nosup") return "";
    var p = st === "install" ? T("Primero agregue KAI a su pantalla de inicio (Compartir → Agregar a pantalla de inicio) y ábrala desde el ícono.", "First add KAI to your home screen (Share → Add to Home Screen) and open it from the icon.")
      : st === "denied" ? T("Los avisos están bloqueados. Actívelos en Ajustes → Notificaciones → KAI.", "Notices are blocked. Turn them on in Settings → Notifications → KAI.")
      : T("Reciba los avisos del equipo y los recordatorios de reuniones en su celular, con el numerito sobre el ícono.", "Get team notices and meeting reminders on your phone, with a badge on the icon.");
    return '<div class="kp"><span class="ic">' + svg("bell") + "</span><div><b>" + T("Active los avisos", "Turn on notices") + "</b><span>" + p + "</span>" +
      (st === "off" ? '<button class="ka-btn tc" data-a="pushon">' + T("Activar avisos", "Turn on notices") + "</button>" : "") + '<p class="ka-msg" id="kp-m"></p></div></div>';
  }
  function b64u(s) { var p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  async function pushCheck() {
    try { if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return; var r = await navigator.serviceWorker.ready; var s = await r.pushManager.getSubscription(); A.pushOn = !!s; if (s) saveSub(s); } catch (e) {}
  }
  async function saveSub(s) {
    var j = s.toJSON(); try { await sb().rpc("push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent.slice(0, 180) }); } catch (e) {}
  }
  async function pushOn() {
    var m = $("kp-m"); function say(t) { if (m) { m.textContent = t; m.className = "ka-msg err"; } }
    try {
      var k = await sb().rpc("kai_vapid_public"); if (k.error || !k.data) { say(T("Los avisos aún no están listos. Intente más tarde.", "Notices aren't ready yet. Try again later.")); return; }
      var perm = await Notification.requestPermission(); if (perm !== "granted") { paint(); return; }
      var reg = await navigator.serviceWorker.ready;
      var s = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(k.data) });
      await saveSub(s); A.pushOn = true; paint();
    } catch (e) { say(T("No se pudo activar. Intente de nuevo.", "Couldn't turn them on. Please try again.")); }
  }

  /* ---------- Enviar aviso / Nueva reunión (equipo) ---------- */
  var TPL = [
    ["Bienvenida", "Welcome", "¡Bienvenido a la familia KAI!", "Su membresía fue aprobada. Abra la app para ver su credencial y los próximos eventos."],
    ["Recordatorio de evento", "Event reminder", "Recordatorio: ", "¡Lo esperamos! Su boleto está en la pestaña Eventos de la app."],
    ["Aviso al Board", "Board notice", "Junta del Board", "Junta del Board el jueves a las 7 p. m. por Zoom. Confirme su asistencia."],
    ["Credencial activa", "Credential active", "Su credencial ya está activa", "Ábrala en la app cuando la necesite. También puede mostrar el código QR."],
    ["Renovación", "Renewal", "Su membresía vence pronto", "Renueve en un toque desde la app para mantener su credencial activa."],
    ["Oración", "Prayer", "Oremos juntos", ""]
  ];
  function C() { return A.cmp || (A.cmp = { aud: has("admin", "president") ? "all" : "board", people: [], when: "now", tpl: -1 }); }
  function composeHTML(kind) {
    var c = C(), meet = kind === "meeting"; c.kind = kind;
    if (meet && !c.mInit) { c.mInit = 1; c.aud = "board"; c.title = c.title || T("Reunión del Board", "Board meeting"); c.minutes = c.minutes || 60; }
    if (c.done) return doneHTML();
    var h = '<div class="kn-top"><a href="/app/team" class="bk" data-a="cmpx">' + svg("back") + T("Equipo", "Team") + "</a></div>";
    h += '<div class="kc-h"><span class="ic ' + (meet ? "nv" : "tc") + '">' + (meet ? svg("zoom") : svg("send")) + "</span><div><h1>" + (meet ? T("Nueva reunión", "New meeting") : T("Enviar aviso", "Send notice")) + "</h1><p>" +
      (meet ? T("Zoom, calendario y confirmación en un solo paso.", "Zoom, calendar and RSVP in one step.") : T("Llega como notificación; a quien no la tiene activada, por correo.", "Arrives as a notification; by email to anyone without them on.")) + "</p></div></div>";
    // A quién
    var opts = meet ? [["board", T("Todo el Board", "Whole Board")], ["people", T("Personas", "People")]]
      : [].concat(has("admin", "president") ? [["all", T("Todos los miembros", "All members")]] : [], [["board", T("Solo el Board", "Board only")]], has("admin", "president", "membership") ? [["event", T("Un evento", "An event")]] : [], [["people", T("Personas", "People")]]);
    h += '<div class="kc-sec">' + (meet ? T("Invitados", "Guests") : T("¿A quién?", "To whom?")) + '</div><div class="kc-chips">' + opts.map(function (o) { return '<button data-a="aud" data-v="' + o[0] + '" class="' + (c.aud === o[0] ? "on" : "") + '">' + o[1] + "</button>"; }).join("") + "</div>";
    if (c.aud === "event") h += '<select class="kc-in" id="kc-ev"><option value="">' + T("Elija el evento…", "Choose the event…") + "</option>" + (A.events || []).map(function (e) { return '<option value="' + esc(e.id) + '"' + (c.event === String(e.id) ? " selected" : "") + ">" + esc(evTitle(e)) + "</option>"; }).join("") + "</select>";
    if (c.aud === "people" || meet) {
      h += '<div class="kc-ppl">' + c.people.map(function (p, i) { return '<span>' + esc(p.name || p.email) + '<button data-a="pdel" data-i="' + i + '" aria-label="' + T("Quitar", "Remove") + '">×</button></span>'; }).join("") +
        '<input id="kc-q" class="kc-in" placeholder="' + (meet ? T("Agregar a un pastor (nombre o correo)…", "Add a pastor (name or email)…") : T("Buscar por nombre o correo…", "Search by name or email…")) + '" autocomplete="off"><div id="kc-res" class="kc-res"></div></div>';
    }
    if (!meet) {
      h += '<div class="kc-sec">' + T("Mensajes listos", "Ready-made messages") + '</div><div class="kc-tpl">' + TPL.map(function (t, i) { return '<button data-a="tpl" data-i="' + i + '" class="' + (c.tpl === i ? "on" : "") + '">' + (L_() === "es" ? t[0] : t[1]) + "</button>"; }).join("") + "</div>";
    }
    h += '<div class="kc-sec">' + T("Título", "Title") + '</div><input class="kc-in" id="kc-t" maxlength="120" value="' + esc(c.title || "") + '" placeholder="' + (meet ? T("Ej. Conversación de bienvenida", "E.g. Welcome conversation") : T("Ej. Cena Navideña este domingo", "E.g. Christmas Dinner this Sunday")) + '">';
    if (meet) {
      h += '<div class="kc-sec">' + T("Día", "Day") + '</div><input class="kc-in" id="kc-d" type="date" value="' + esc(c.date || "") + '"><div class="kc-row3"><div><div class="kc-sec">' + T("Hora", "Time") + '</div><input class="kc-in" id="kc-h" type="time" value="' + esc(c.time || "19:00") + '"></div><div><div class="kc-sec">' + T("Duración", "Length") + '</div><select class="kc-in" id="kc-m">' +
        [30, 45, 60, 90].map(function (x) { return '<option value="' + x + '"' + (+c.minutes === x ? " selected" : "") + ">" + x + " min</option>"; }).join("") + "</select></div></div>" +
        '<div class="kc-sec">' + T("Enlace de Zoom", "Zoom link") + '</div><input class="kc-in" id="kc-z" type="url" inputmode="url" value="' + esc(c.zoom || "") + '" placeholder="https://zoom.us/j/…">';
    }
    h += '<div class="kc-sec">' + (meet ? T("Nota (opcional)", "Note (optional)") : T("Mensaje", "Message")) + '</div><textarea class="kc-in" id="kc-b" rows="' + (meet ? 3 : 5) + '" maxlength="2000" placeholder="' + (meet ? T("Ej. Traiga su Biblia y sus preguntas.", "E.g. Bring your questions.") : T("Escriba el mensaje…", "Write the message…")) + '">' + esc(c.body || "") + "</textarea>";
    if (!meet) {
      h += '<div class="kc-sec">' + T("¿Cuándo?", "When?") + '</div><div class="ka-seg"><button data-a="when" data-v="now" aria-pressed="' + (c.when === "now") + '">' + T("Ahora", "Now") + '</button><button data-a="when" data-v="later" aria-pressed="' + (c.when === "later") + '">' + T("Programar", "Schedule") + "</button></div>" +
        (c.when === "later" ? '<input class="kc-in" id="kc-at" type="datetime-local" value="' + esc(c.at || "") + '" style="margin-top:10px">' : "");
    }
    // vista previa
    h += '<div class="kc-sec">' + T("Así se verá", "Preview") + '</div><div class="kc-pv"><div class="nt"><span class="ai"></span><div><small><span>KAI</span><span>' + T("ahora", "now") + '</span></small><b id="pv-t">' + esc((meet ? "📅 " : "") + (c.title || T("Título del aviso", "Notice title"))) + '</b><span id="pv-b">' +
      esc(meet ? (c.date ? cap(fdt(c.date + "T" + (c.time || "19:00"), { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })) : T("Día y hora de la reunión", "Meeting day and time")) : (c.body || T("El mensaje aparece aquí.", "The message shows here."))) + "</span></div></div></div>";
    h += '<p class="kc-cnt" id="kc-cnt"></p><p class="ka-msg" id="kc-msg"></p><button class="ka-btn ' + (meet ? "navy" : "tc") + ' wide kc-go" data-a="send">' + (meet ? T("Enviar invitación", "Send invitation") : c.when === "later" ? T("Programar aviso", "Schedule notice") : T("Enviar aviso", "Send notice")) + "</button>";
    return '<div class="kc">' + h + "</div>";
  }
  function doneHTML() {
    var c = A.cmp, meet = c.kind === "meeting";
    return '<div class="kc-done"><div class="ok">' + ti("check") + "</div><h1>" + (meet ? T("¡Invitación enviada!", "Invitation sent!") : c.when === "later" ? T("¡Aviso programado!", "Notice scheduled!") : T("¡Aviso enviado!", "Notice sent!")) + "</h1><p>" +
      (c.count ? T("Llegará a " + c.count + (c.count === 1 ? " persona." : " personas."), "It will reach " + c.count + (c.count === 1 ? " person." : " people.")) : "") + " " + (meet ? T("Usted verá aquí quién confirma.", "You'll see here who confirms.") : "") + '</p><a class="ka-btn navy wide" href="/app/team" data-a="cmpx">' + T("Volver a Equipo", "Back to Team") + "</a></div>";
  }
  function audJSON() {
    var c = C(), a = {};
    if (c.aud === "all") a.all = true;
    if (c.aud === "board") a.board = true;
    if (c.aud === "event" && c.event) a.event = c.event;
    if (c.people.length && (c.aud === "people" || c.kind === "meeting")) a.emails = c.people.map(function (p) { return p.email; });
    return a;
  }
  var cntT = null;
  function recount() {
    clearTimeout(cntT); cntT = setTimeout(async function () {
      var el = $("kc-cnt"); if (!el) return; var a = audJSON();
      if (!a.all && !a.board && !a.event && !(a.emails && a.emails.length)) { el.textContent = ""; return; }
      try { var r = await sb().rpc("staff_audience_count", { p_aud: a }); if (r.error) throw r.error; var t = r.data.total, pu = r.data.push; A.cmp.count = t;
        el.innerHTML = "<b>" + T("Llegará a " + t + (t === 1 ? " persona" : " personas"), "Reaches " + t + (t === 1 ? " person" : " people")) + "</b> · " + T(pu + " por notificación, " + (t - pu) + " por correo", pu + " by notification, " + (t - pu) + " by email");
      } catch (e) { el.textContent = ""; }
    }, 250);
  }
  function syncFields() {
    var c = C(), g = function (id) { var e = $(id); return e ? e.value : undefined; };
    ["t", "b", "d", "h", "m", "z", "at"].forEach(function (k) { var v = g("kc-" + k); if (v !== undefined) c[{ t: "title", b: "body", d: "date", h: "time", m: "minutes", z: "zoom", at: "at" }[k]] = v; });
    var ev = $("kc-ev"); if (ev) c.event = ev.value;
  }
  function wireCompose() {
    var root = $("kapp"); if (!root || !$("kc-t")) return;
    root.querySelectorAll(".kc-in").forEach(function (el) {
      el.addEventListener("input", function () {
        syncFields(); var c = C(), meet = c.kind === "meeting";
        var pt = $("pv-t"), pb = $("pv-b");
        if (pt) pt.textContent = (meet ? "📅 " : "") + (c.title || T("Título del aviso", "Notice title"));
        if (pb) pb.textContent = meet ? (c.date ? cap(fdt(c.date + "T" + (c.time || "19:00"), { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })) : T("Día y hora de la reunión", "Meeting day and time")) : (c.body || T("El mensaje aparece aquí.", "The message shows here."));
      });
    });
    var ev = $("kc-ev"); if (ev) ev.addEventListener("change", function () { syncFields(); recount(); });
    var q = $("kc-q"), res = $("kc-res"), qt = null;
    if (q) q.addEventListener("input", function () {
      clearTimeout(qt); var v = q.value.trim(); if (v.length < 2) { res.innerHTML = ""; return; }
      qt = setTimeout(async function () {
        try { var r = await sb().rpc("staff_people", { p_q: v }); var L = (r.data || []).filter(function (p) { return !C().people.some(function (x) { return x.email === p.email; }); });
          var em = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && !L.some(function (p) { return p.email === v.toLowerCase(); }) ? [{ email: v.toLowerCase(), name: v.toLowerCase(), sub: T("Correo", "Email") }] : [];
          A.cmpRes = L.concat(em);
          res.innerHTML = A.cmpRes.map(function (p, i) { return '<button data-a="padd" data-i="' + i + '"><b>' + esc(p.name || p.email) + "</b><span>" + esc(p.sub || p.email) + "</span></button>"; }).join("") || '<p class="none">' + T("Sin resultados", "No results") + "</p>";
        } catch (e) { res.innerHTML = ""; }
      }, 220);
    });
    recount();
  }
  async function sendCompose(btn) {
    syncFields(); var c = C(), meet = c.kind === "meeting", m = $("kc-msg");
    function err(t) { m.textContent = t; m.className = "ka-msg err"; btn.disabled = false; }
    var a = audJSON();
    if (!a.all && !a.board && !a.event && !(a.emails && a.emails.length)) return err(T("Elija a quién va dirigido.", "Choose who it's for."));
    if (!String(c.title || "").trim()) return err(T("Escriba un título.", "Enter a title."));
    if (!meet && !String(c.body || "").trim()) return err(T("Escriba el mensaje.", "Write the message."));
    var p = { kind: c.kind, title: c.title.trim(), body: (c.body || "").trim(), audience: a };
    if (meet) {
      if (!c.date || !c.time) return err(T("Elija el día y la hora.", "Choose the day and time."));
      var st = new Date(c.date + "T" + c.time); if (isNaN(st) || st < new Date()) return err(T("La fecha ya pasó.", "That date has passed."));
      if (c.zoom && !/^https:\/\//i.test(c.zoom.trim())) return err(T("El enlace de Zoom debe empezar con https://", "The Zoom link must start with https://"));
      p.starts_at = st.toISOString(); p.minutes = +c.minutes || 60; p.zoom_url = (c.zoom || "").trim() || null; p.url = "/app/inbox";
    } else if (c.when === "later") {
      var at = new Date(c.at || ""); if (isNaN(at) || at < new Date()) return err(T("Elija una fecha y hora futuras.", "Choose a future date and time."));
      p.send_at = at.toISOString();
    }
    btn.disabled = true; m.className = "ka-msg"; m.textContent = T("Enviando…", "Sending…");
    try {
      var r = await sb().rpc("staff_notice_send", { p: p }); if (r.error) throw r.error;
      try { sb().functions.invoke("kai-push?kick=1", { body: {} }); } catch (x) {}
      c.done = true; paint(); loadSent();
    } catch (e) {
      var msg = String((e && e.message) || e);
      err(/no_recipients/.test(msg) ? T("No hay destinatarios con correo.", "No recipients with email.") : /forbidden/.test(msg) ? T("Su rol no permite enviar a ese grupo.", "Your role can't send to that group.") : /mfa/.test(msg) ? T("Verifique su código de dos pasos en Equipo.", "Verify your two-step code in Team.") : T("No se pudo enviar. Intente de nuevo.", "Couldn't send. Please try again."));
    }
  }

  /* ---------- Enviados (en Equipo) ---------- */
  async function loadSent() { try { var r = await sb().rpc("staff_notice_list", { p_limit: 12 }); if (!r.error) { A.sent = r.data || []; if (A.tab === "team") paint(); } } catch (e) {} }
  function sentHTML() {
    if (!A.sent) { loadSent(); A.sent = []; }
    if (!A.sent.length) return "";
    return '<h2 class="kt-h">' + T("Enviados", "Sent") + '</h2><div class="kt-list">' + A.sent.slice(0, 8).map(function (n) {
      var meet = n.kind === "meeting", sch = n.status === "scheduled", cx = n.status === "cancelled";
      var sub = cx ? T("Cancelado", "Cancelled") : sch ? T("Programado · ", "Scheduled · ") + fdt(n.send_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
        : meet ? fdt(n.starts_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + " · " + T(n.yes + " de " + n.total + " asistirán", n.yes + " of " + n.total + " going")
        : T(n.total + " personas · " + n.read + " lo leyeron", n.total + " people · " + n.read + " read it");
      return '<div class="kt-row k-' + (meet ? "zoom" : "send") + '"><span class="ic">' + ti(meet ? "zoom" : "send") + '</span><span class="tx"><b>' + esc(n.title) + "</b><small>" + esc(sub) + "</small></span>" +
        ((sch || (meet && !cx && new Date(n.starts_at) > new Date())) ? '<button class="kt-x" data-a="ncancel" data-id="' + n.id + '">' + T("Cancelar", "Cancel") + "</button>" : "") + "</div>";
    }).join("") + "</div>";
  }

  function profileHTML() {
    var m = A.m;
    if (!m) return hero({ cls: "sm", title: T("Perfil", "Profile"), sub: esc(A.user && A.user.email) }) + outHTML();
    var st = state(m), cls = st === "active" ? "" : st === "expired" ? "exp" : "ina";
    var h = hero({ cls: "prof", title: esc(m.full_name), sub: esc(m.title || ""), side: avatar(m, "lg"),
      extra: '<div class="pchips"><span class="ka-pill ' + cls + '">' + (st === "active" ? T("Credencial activa", "Active credential") : st === "expired" ? T("Vencida", "Expired") : T("Inactiva", "Inactive")) + "</span><span>" + esc(m.credential_no || "") + "</span></div>" });
    function grp(title, rows) { return '<div class="ka-sec">' + title + '</div><dl class="ka-dl">' + rows.map(function (r) { return "<div><dt>" + svg(r[0]) + r[1] + "</dt><dd>" + r[2] + "</dd></div>"; }).join("") + "</dl>"; }
    h += grp(T("Membresía", "Membership"), [["card", T("Credencial", "Credential"), esc(m.credential_no || "—")], ["cal", T("Miembro desde", "Member since"), esc(fdate(m.member_since) || "—")], ["cal", T("Vence", "Expires"), esc(fdate(m.valid_through) || "—")]]);
    h += grp(T("Ministerio y contacto", "Ministry & contact"), [["home", T("Iglesia", "Church"), esc(m.church || "—")], ["pin", T("Ciudad", "City"), esc([m.city, m.state].filter(Boolean).join(", ") || "—")], ["bell", T("Teléfono", "Phone"), esc(m.phone ? (window.KPH ? KPH(m.phone) : m.phone) : "—")], ["user", T("Correo", "Email"), esc(m.email || "—")]]);
    var l = L_();
    h += '<div class="ka-sec">' + T("Idioma de la app", "App language") + '</div><div class="ka-seg" role="group" aria-label="Language"><button data-l="es" aria-pressed="' + (l === "es") + '">Español</button><button data-l="en" aria-pressed="' + (l === "en") + '">English</button></div>';
    return h + '<a class="ka-btn line wide" href="/membership" style="margin-top:16px">' + T("Pedir un cambio de datos", "Request a change") + "</a>" + outHTML();
  }
  function outHTML() { return '<button class="ka-btn line wide" data-a="out" style="margin-top:14px;border-color:#d0c7b2;color:#5b6577">' + T("Cerrar sesión", "Sign out") + "</button>"; }

  function emptyHTML(ic, h, p) { return '<div class="ka-empty"><div class="ic">' + svg(ic) + "</div><h3>" + h + "</h3><p>" + p + "</p></div>"; }

  function navHTML(tab) {
    var items = [["home", "/app", "home", T("Inicio", "Home")], ["events", "/app/events", "cal", T("Eventos", "Events")], ["inbox", "/app/inbox", "bell", T("Avisos", "Notices")], ["profile", "/app/profile", "user", T("Perfil", "Profile")]];
    if (A.roles.length) items.push(["team", "/app/team", "team", T("Equipo", "Team")]);
    return '<div class="ka-nav" role="navigation" aria-label="' + T("Menú de la app", "App menu") + '"><div class="in">' + items.map(function (x) {
      return '<a href="' + x[1] + '" class="' + (tab === x[0] ? "on" : "") + '"' + (tab === x[0] ? ' aria-current="page"' : "") + ">" + svg(x[2]) + x[3] +
        (x[0] === "inbox" && A.unread ? '<i class="ka-bdg">' + A.unread + "</i>" : "") + (x[0] === "team" && A.tcount ? '<i class="ka-bdg">' + A.tcount + "</i>" : "") + "</a>";
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

  function sheet(w) {
    var old = $("ka-sheet"); if (old) old.remove();
    var d = document.createElement("div"); d.id = "ka-sheet"; d.className = "ka-sheet";
    var t = w === "reunion" ? T("Nueva reunión", "New meeting") : T("Enviar aviso", "Send notice");
    d.innerHTML = '<div class="bg" data-x="1"></div><div class="pn" role="dialog" aria-modal="true" aria-label="' + t + '"><i class="gr"></i><h3>' + t + "</h3><p>" +
      T("Se activa en el siguiente paso, cuando instalemos las notificaciones en Supabase.", "This turns on in the next step, once notifications are installed in Supabase.") +
      '</p><button class="ka-btn navy wide" data-x="1">' + T("Entendido", "Got it") + "</button></div>";
    document.body.appendChild(d);
    d.addEventListener("click", function (e) { if (e.target.dataset.x) d.remove(); });
  }
  function setBadge() {
    try { if (navigator.setAppBadge) { if (A.unread) navigator.setAppBadge(A.unread); else navigator.clearAppBadge(); } } catch (e) {}
  }


  /* ---------- Equipo (solo con rol en el panel) ---------- */
  var ROLE_N = { admin: ["Administrador", "Administrator"], president: ["Presidente", "President"], membership: ["Membresía", "Membership"], treasury: ["Tesorería", "Treasury"], care: ["Cuidado pastoral", "Pastoral care"], credentials: ["Credenciales", "Credentials"] };
  function has() { for (var i = 0; i < arguments.length; i++) if (A.roles.indexOf(arguments[i]) >= 0) return true; return false; }
  var TI = {
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    zoom: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>',
    doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    pay: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    renew: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    chart: '<path d="M3 3v18h18M7 15l4-4 3 3 5-6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>'
  };
  function ti(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + TI[k] + "</svg>"; }

  async function loadTeam() {
    var c = sb(); if (!c || !A.roles.length) return;
    A.team = A.team || { st: "load" };
    try {
      var me = await c.rpc("staff_me"); A.me = me.data || A.me;
      if (!A.me || A.me.aal !== "aal2") {
        var f = await c.auth.mfa.listFactors();
        var all = (f.data && f.data.all) || [], ok = all.filter(function (x) { return x.factor_type === "totp" && x.status === "verified"; })[0];
        A.team = { st: ok ? "mfa" : "enroll", fid: ok && ok.id };
      } else {
        var r = await c.rpc("staff_overview");
        if (r.error) throw r.error;
        A.team = { st: "ok", ov: r.data };
      }
    } catch (e) { A.team = { st: "err" }; }
    A.tcount = teamCount();
    paint();
  }
  function teamCount() {
    var t = A.team; if (!t || t.st !== "ok") return 0;
    var o = t.ov, a = o.apps || {}, n = (o.my_tasks || []).length;
    if (has("president")) n += a.recommended || 0;
    if (has("treasury", "admin")) n += o.pay_claimed || 0;
    if (has("care")) n += o.care || 0;
    return n;
  }

  function teamHTML() {
    var t = A.team || { st: "load" };
    var name = (A.me && A.me.name) || first(A.m);
    var h = hero({ cls: "team", eb: T("Equipo KAI", "KAI team"), title: T("Hola, ", "Hello, ") + esc(String(name || "").split(" ")[0]), sub: todayLong(),
      extra: '<div class="kt-roles">' + A.roles.map(function (r) { return esc((ROLE_N[r] || [r, r])[L_() === "es" ? 0 : 1]); }).join(" · ") + "</div>" });
    if (t.st === "load") return h + '<div class="ka-load"><div class="ka-sp"></div></div>';
    if (t.st === "err") return h + '<div class="ka-card"><h3>' + T("No pudimos cargar el equipo", "We couldn't load the team") + '</h3><p>' + T("Revise su internet e intente de nuevo.", "Check your internet and try again.") + '</p><button class="ka-btn navy" data-a="tretry">' + T("Intentar de nuevo", "Try again") + "</button></div>";
    if (t.st === "enroll") return h + '<div class="ka-card kt-lock"><div class="ic">' + ti("lock") + "</div><h3>" + T("Active la verificación en dos pasos", "Turn on two-step verification") + "</h3><p>" +
      T("Para proteger los datos de los pastores, el equipo entra con un código de su celular. Se configura una sola vez.", "To protect pastors' data, the team signs in with a code from their phone. You set it up once.") + '</p><a class="ka-btn gold wide" href="/staff">' + T("Configurar ahora", "Set it up now") + "</a></div>";
    if (t.st === "mfa") return h + '<div class="ka-card kt-lock"><div class="ic">' + ti("lock") + "</div><h3>" + T("Verificación en dos pasos", "Two-step verification") + "</h3><p>" +
      T("Abra su app de códigos (Google Authenticator u otra) y escriba el código de 6 dígitos de KAI.", "Open your authenticator app (Google Authenticator or another) and enter KAI's 6-digit code.") +
      '</p><form id="kt-mfa" novalidate><input class="kt-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="' + T("Código", "Code") + '"><button class="ka-btn gold wide" type="submit">' + T("Verificar", "Verify") + '</button><p class="ka-msg" id="kt-mm" role="status"></p></form></div>';

    var o = t.ov, a = o.apps || {};
    h += '<div class="kt-acts"><a class="kt-act g" href="/app/team/aviso"><span class="ic">' + ti("send") + "</span><b>" + T("Enviar aviso", "Send notice") + "</b><small>" + T("A todos, al Board o a una persona", "To all, the Board or one person") + '</small></a>' +
      '<a class="kt-act" href="/app/team/reunion"><span class="ic">' + ti("zoom") + "</span><b>" + T("Nueva reunión", "New meeting") + "</b><small>" + T("Zoom, calendario y confirmación", "Zoom, calendar and RSVP") + "</small></a></div>";

    var rows = [];
    function row(href, ic, label, sub, n, hot) { rows.push('<a class="kt-row k-' + ic + (hot && n ? " hot" : "") + '" href="' + href + '"><span class="ic">' + ti(ic) + "</span><span class=\"tx\"><b>" + label + "</b><small>" + sub + "</small></span>" + (n ? '<i class="kt-n">' + n + "</i>" : '<i class="kt-ok">' + ti("check") + "</i>") + '<span class="ch">' + ti("chev") + "</span></a>"); }
    if (has("president")) row("/staff/inbox", "crown", T("Esperan su decisión", "Awaiting your decision"), T("Aplicaciones recomendadas por el equipo", "Applications recommended by the team"), a.recommended || 0, 1);
    if (has("admin", "membership", "president", "care")) {
      row("/staff/apps/new", "doc", T("Aplicaciones nuevas", "New applications"), T("Recién llegadas, sin revisar", "Just arrived, not reviewed"), a["new"] || 0, 1);
      row("/staff/apps/in_review", "search", T("En revisión", "In review"), T("El equipo las está revisando", "The team is reviewing them"), a.in_review || 0, 0);
    }
    if (has("treasury", "admin")) row("/staff/members/pay", "pay", T("Pagos por confirmar", "Payments to confirm"), o.pay_claimed ? T(o.pay_claimed + " dicen que ya pagaron por Zelle", o.pay_claimed + " say they paid by Zelle") : T("Aprobados que aún no pagan: ", "Approved, not yet paid: ") + (o.pay_pending || 0), o.pay_claimed || 0, 1);
    if (has("credentials", "treasury", "admin")) row("/staff/members/print", "print", T("Credenciales por imprimir", "Credentials to print"), o.printed ? T(o.printed + " impresas, falta enviar", o.printed + " printed, still to mail") : T("Imprimir y enviar", "Print and mail"), (o.to_print || 0) + (o.printed || 0), 0);
    if (has("care")) row("/staff/care", "heart", T("Cuidado pastoral", "Pastoral care"), T("Pastores que necesitan atención", "Pastors who need attention"), o.care || 0, 1);
    row("/staff/members/renew", "renew", T("Renovaciones", "Renewals"), T((o.renew_soon || 0) + " vencen en 30 días · " + (o.expired || 0) + " vencidas", (o.renew_soon || 0) + " expire in 30 days · " + (o.expired || 0) + " expired"), (o.renew_soon || 0) + (o.expired || 0), 0);
    row("/staff/members/nocontact", "phone", T("Sin contacto en 90 días", "No contact in 90 days"), T("Nadie del equipo los ha llamado", "No one on the team has called them"), o.no_contact || 0, 0);
    h += '<h2 class="kt-h">' + T("Para hoy", "For today") + '</h2><div class="kt-list">' + rows.join("") + "</div>";

    var tk = o.my_tasks || [];
    h += '<h2 class="kt-h">' + T("Sus tareas", "Your tasks") + (tk.length ? ' <i class="kt-n">' + tk.length + "</i>" : "") + "</h2>";
    h += tk.length ? '<div class="kt-list">' + tk.map(function (x) {
      var href = x.application_id ? "/staff/app/" + x.application_id : x.member_kid ? "/staff/member/" + x.member_kid : "";
      return '<div class="kt-task"><a href="' + esc(href) + '"><b>' + esc(taskT(x.title)) + "</b><small>" + esc(ago(x.created_at)) + '</small></a><button data-a="tdone" data-id="' + x.id + '">' + T("Hecho", "Done") + "</button></div>";
    }).join("") + "</div>" : '<div class="kt-none">' + ti("check") + T("No tiene tareas pendientes.", "You have no pending tasks.") + "</div>";

    h += sentHTML();
    var go = [];
    if (has("admin", "membership", "president", "care")) go.push(["/staff/apps", "doc", T("Aplicaciones", "Applications")]);
    go.push(["/staff/members", "users", T("Miembros", "Members")]);
    go.push(["/staff/events", "cal2", T("Eventos", "Events")]);
    if (has("admin", "membership", "president")) go.push(["/staff/needs", "chart", T("Necesidades", "Needs")]);
    h += '<h2 class="kt-h">' + T("Accesos", "Shortcuts") + '</h2><div class="kt-go">' + go.map(function (g) {
      return '<a href="' + g[0] + '"><span class="ic">' + (g[1] === "cal2" ? svg("cal") : ti(g[1])) + "</span>" + g[2] + "</a>";
    }).join("") + "</div>";
    return h;
  }
  function taskT(t) {
    if (L_() === "es") return t;
    return String(t).replace(/^Imprimir y enviar la credencial/, "Print and mail credential").replace(/^Llamar a (.+) para darle la bienvenida y enviarle las instrucciones de pago$/, "Call $1 to welcome them and send the payment instructions").replace(/^Llamar a (.+) para comunicarle la decisión$/, "Call $1 to share the decision");
  }
  function ago(s) {
    var d = (Date.now() - new Date(s).getTime()) / 864e5;
    if (d < 1) return T("Hoy", "Today"); if (d < 2) return T("Ayer", "Yesterday");
    return T("Hace " + Math.floor(d) + " días", Math.floor(d) + " days ago");
  }
  function wireTeam() {
    var f = $("kt-mfa"); if (!f) return;
    var inp = f.querySelector(".kt-code");
    f.addEventListener("submit", async function (e) {
      e.preventDefault(); var code = inp.value.replace(/\D/g, ""), m = $("kt-mm");
      if (code.length !== 6) { m.textContent = T("Escriba los 6 dígitos.", "Enter all 6 digits."); m.className = "ka-msg err"; return; }
      var b = f.querySelector("button"); b.disabled = true;
      try {
        var r = await sb().auth.mfa.challengeAndVerify({ factorId: A.team.fid, code: code });
        if (r.error) throw r.error;
        A.team = { st: "load" }; paint(); loadTeam();
      } catch (x) { m.textContent = T("Código incorrecto o vencido. Pruebe con el código nuevo.", "Wrong or expired code. Try the new one."); m.className = "ka-msg err"; b.disabled = false; inp.select(); }
    });
  }

  /* ---------- acciones ---------- */
  document.addEventListener("click", async function (e) {
    var root = $("kapp"); if (!root || !root.contains(e.target)) return;
    var a = e.target.closest("[data-a],[data-l]"); if (!a) return;
    if (a.dataset.l) { window.L = a.dataset.l; try { localStorage.setItem("kai-lang", a.dataset.l); } catch (x) {} var lb = document.querySelector('.lang button[data-l="' + a.dataset.l + '"]'); if (lb) lb.click(); else paint(); return; }
    var k = a.dataset.a;
    if (k === "flip") { A.flip = !A.flip; paint(); return; }
    if (k === "qrfull") { qrFull(); return; }
    if (k === "pushon") { a.disabled = true; await pushOn(); return; }
    if (k === "readall") { (A.inbox.rows || []).forEach(function (n) { n.read = true; }); A.unread = 0; A.inbox.unread = 0; paint(); try { await sb().rpc("notice_read", { p_id: null }); } catch (x) {} return; }
    if (k === "rsvp") {
      var id = +a.dataset.id, v = a.dataset.v, n = (A.inbox.rows || []).filter(function (x) { return x.id === id; })[0];
      if (n) { if (n.rsvp !== "yes" && v === "yes") n.yes = (n.yes || 0) + 1; if (n.rsvp === "yes" && v !== "yes") n.yes = Math.max(0, (n.yes || 0) - 1); n.rsvp = v; paint(); }
      try { await sb().rpc("notice_rsvp", { p_id: id, p_ans: v }); } catch (x) {}
      return;
    }
    if (k === "aud") { syncFields(); C().aud = a.dataset.v; paint(); return; }
    if (k === "tpl") { var t = TPL[+a.dataset.i], cc = C(); cc.tpl = +a.dataset.i; cc.title = t[2] + (+a.dataset.i === 1 && A.events && A.events[0] ? evTitle(A.events[0]) : ""); cc.body = t[3]; paint(); return; }
    if (k === "when") { syncFields(); C().when = a.dataset.v; paint(); return; }
    if (k === "padd") { syncFields(); var pp = (A.cmpRes || [])[+a.dataset.i]; if (pp) C().people.push(pp); paint(); var qi = $("kc-q"); if (qi) qi.focus(); return; }
    if (k === "pdel") { syncFields(); C().people.splice(+a.dataset.i, 1); paint(); return; }
    if (k === "send") { await sendCompose(a); return; }
    if (k === "cmpx") { A.cmp = null; return; }
    if (k === "ncancel") {
      if (!confirm(T("¿Cancelar este envío? A los invitados de una reunión les llegará el aviso de que se canceló.", "Cancel this? Meeting guests will be told it was cancelled."))) return;
      a.disabled = true; try { await sb().rpc("staff_notice_cancel", { p_id: +a.dataset.id }); try { sb().functions.invoke("kai-push?kick=1", { body: {} }); } catch (x) {} } catch (x) {} loadSent(); return;
    }
    if (k === "tretry") { A.team = { st: "load" }; paint(); loadTeam(); return; }
    if (k === "soon") { sheet(a.dataset.w); return; }
    if (k === "tdone") {
      a.disabled = true;
      try { var r = await sb().rpc("staff_task_done", { p_id: +a.dataset.id }); if (r.error) throw r.error; a.closest(".kt-task").classList.add("done"); setTimeout(loadTeam, 350); } catch (x) { a.disabled = false; }
      return;
    }
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


  /* ---------- Credencial en pantalla completa (para escanear) ---------- */
  function qrFull() {
    var m = A.m; if (!m) return;
    var base = /(^|\.)kaie44\.org$/.test(location.hostname) ? "https://www.kaie44.org" : location.origin;
    var url = base + "/verify/" + encodeURIComponent(m.verify_code || ""), qr = "";
    try { var q = window.qrcode(0, "M"); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }); } catch (e) { qr = '<p style="color:#5b6577">' + T("Sin conexión para generar el código.", "Offline: can't build the code.") + "</p>"; }
    var st = state(m), d = document.createElement("div"); d.id = "ka-qr"; d.className = "ka-qr";
    d.innerHTML = '<button class="x" data-x="1" aria-label="' + T("Cerrar", "Close") + '">×</button><div class="in"><img src="images/logo.png" alt="KAI">' +
      '<div class="who">' + avatar(m) + "<div><b>" + esc(m.full_name) + "</b><span>" + esc(m.title || "") + "</span></div></div>" +
      '<div class="code">' + qr + '</div><div class="st ' + (st === "active" ? "ok" : "no") + '">' + (st === "active" ? "✓ " + T("Credencial vigente", "Valid credential") : T("Credencial no vigente", "Credential not valid")) + "</div>" +
      '<p class="no">' + esc(m.credential_no || "") + "</p><p class=\"hint\">" + T("Suba el brillo de su pantalla para que el código se lea mejor.", "Turn up your screen brightness so the code scans easily.") + "</p></div>";
    document.body.appendChild(d);
    d.addEventListener("click", function (e) { if (e.target.dataset.x || e.target === d) d.remove(); });
  }

  /* ---------- Jalar hacia abajo para actualizar ---------- */
  (function () {
    var y0 = null, dy = 0, ind = null;
    function on() { return document.body.classList.contains("is-app") && !document.body.classList.contains("is-appteam") && /^(home|inbox|team|events)$/.test(A.tab) && (A.st === "in" || A.st === "none"); }
    window.addEventListener("touchstart", function (e) { if (!on() || window.scrollY > 0) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
    window.addEventListener("touchmove", function (e) {
      if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy <= 0) return;
      if (!ind) { ind = document.createElement("div"); ind.className = "ka-ptr"; ind.innerHTML = '<i class="ka-sp"></i>'; document.body.appendChild(ind); }
      var p = Math.min(dy, 110); ind.style.transform = "translate(-50%," + (p * .6) + "px) rotate(" + (p * 3) + "deg)"; ind.style.opacity = Math.min(1, p / 70);
    }, { passive: true });
    window.addEventListener("touchend", function () {
      if (y0 == null) return; y0 = null;
      if (ind && dy > 75) { ind.classList.add("go"); refresh().then(function () { if (ind) { ind.remove(); ind = null; } }); }
      else if (ind) { ind.remove(); ind = null; }
    });
  })();
  function refresh() {
    var jobs = [loadEvents()];
    if (A.roles.length) jobs.push(loadTeam());
    jobs.push(load());
    return Promise.all(jobs).catch(function () {});
  }

  /* ---------- Pantalla de bienvenida al abrir la app instalada ---------- */
  (function () {
    if (!standalone() || !/^\/app/.test(location.pathname)) return;
    var sp = document.createElement("div"); sp.className = "ka-splash"; sp.innerHTML = '<img src="images/logo.png" alt="Kingdom Alliance International"><i></i>';
    (document.body || document.documentElement).appendChild(sp);
    var t0 = Date.now();
    function done() { var w = Math.max(0, 650 - (Date.now() - t0)); setTimeout(function () { sp.classList.add("out"); setTimeout(function () { sp.remove(); }, 450); }, w); }
    var iv = setInterval(function () { if (A.st !== "load") { clearInterval(iv); done(); } }, 80);
    setTimeout(function () { clearInterval(iv); done(); }, 2500);
  })();

  /* ---------- botón "Volver a la app" en páginas del sitio ---------- */
  function backBtn(v) {
    var b = $("ka-back");
    var show = standalone() && v !== "app";
    if (!show) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("a"); b.id = "ka-back"; b.className = "ka-back"; b.href = "/app"; document.body.appendChild(b); }
    b.innerHTML = svg("back") + T("Volver a la app", "Back to the app");
  }

  /* Barra superior de app para las pantallas del equipo */
  function appBar() {
    var b = $("ka-appbar");
    if (!b) { b = document.createElement("div"); b.id = "ka-appbar"; b.className = "ka-appbar"; document.body.insertBefore(b, document.body.firstChild); }
    var p = location.pathname.replace(/\/+$/, ""), deep = /^\/staff\/(app|member|interview|event)\//.test(p);
    b.innerHTML = '<a class="bk" href="' + (deep ? "javascript:history.back()" : "/app/team") + '">' + svg("back") + "<span>" + (deep ? T("Atrás", "Back") : T("Equipo", "Team")) + "</span></a>" +
      '<img src="images/logo.png" alt="KAI"><span class="sp"></span>';
  }
  /* ---------- enganche con el router del sitio ---------- */
  window.KAIAPPX = {
    view: function (v) {
      if (v === "home" && standalone() && !A.homeOk) { A.homeOk = true; KGO("/app", true); return; }
      A.homeOk = true;
      if (v === "app") { try { sessionStorage.setItem("kai-in-app", "1"); } catch (e) {} }
      var inApp = standalone(); try { inApp = inApp || sessionStorage.getItem("kai-in-app") === "1"; } catch (e) {}
      var teamMode = v === "staff" && inApp && !/^\/pago\//.test(location.pathname);
      document.body.classList.toggle("is-app", v === "app" || teamMode);
      document.body.classList.toggle("is-appteam", teamMode);
      backBtn(teamMode ? "app" : v);
      if (teamMode) { appBar(); var nt = $("ka-navw"); if (!nt) { nt = document.createElement("div"); nt.id = "ka-navw"; document.body.appendChild(nt); } nt.innerHTML = navHTML("team"); return; }
      var ab = $("ka-appbar"); if (ab) ab.remove();
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
    navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.kai === "go" && e.data.url) { loadInbox(); KGO(e.data.url); } if (e.data && e.data.kai === "push") loadInbox(); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && A.booted && A.st === "in") { loadInbox(); if (A.roles.length && A.tab === "team") loadTeam(); } });
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
