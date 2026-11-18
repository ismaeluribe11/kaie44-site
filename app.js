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

  /* ---------- pintar ---------- */
  function paint() {
    var root = $("kapp"); if (!root) return;
    var tab = sub(); A.tab = tab;
    var html = "";
    if (A.st === "load") html = '<div class="ka-load"><div class="ka-sp"></div>' + T("Cargando…", "Loading…") + "</div>";
    else if (A.st === "out") html = loginHTML();
    else if (A.st === "down") html = hero({ eb: "KAI", title: T("Sin conexión", "No connection") }) + '<div class="ka-empty"><h3>' + T("Sin conexión", "No connection") + "</h3><p>" + T("No pudimos conectar con KAI. Revise su internet e intente de nuevo.", "We couldn't reach KAI. Check your internet and try again.") + '</p><button class="ka-btn navy" data-a="retry">' + T("Intentar de nuevo", "Try again") + "</button></div>";
    else {
      if (tab === "events") html += eventsHTML();
      else if (tab === "inbox") html += inboxHTML();
      else if (tab === "profile") html += profileHTML();
      else if (tab === "team") html += teamHTML();
      else html += homeHTML();
    }
    root.innerHTML = html;
    var nv = $("ka-navw");
    if (!nv) { nv = document.createElement("div"); nv.id = "ka-navw"; document.body.appendChild(nv); }
    nv.innerHTML = (A.st === "in" || A.st === "none") && document.body.classList.contains("is-app") ? navHTML(tab) : "";
    if (A.st === "out") wireLogin();
    if (tab === "team") wireTeam();
    setBadge();
  }

  function rings() { return '<svg class="rg" viewBox="0 0 400 400" aria-hidden="true"><g fill="none" stroke="#e3bf63"><circle cx="200" cy="200" r="190" stroke-opacity=".10"/><circle cx="200" cy="200" r="150" stroke-opacity=".14"/><circle cx="200" cy="200" r="110" stroke-opacity=".18"/><circle cx="200" cy="200" r="70" stroke-opacity=".22"/></g></svg>'; }
  function hero(o) {
    var l = L_();
    return '<div class="ka-hero ' + (o.cls || "") + '">' + rings() + '<i class="glow"></i><div class="hb"><img class="lw" src="images/logo.png" alt="Kingdom Alliance International"><div class="ka-lang" role="group" aria-label="Language">' +
      '<button data-l="es" aria-pressed="' + (l === "es") + '">ES</button><button data-l="en" aria-pressed="' + (l === "en") + '">EN</button></div></div>' +
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
        '</span><button data-a="flip">' + svg("qr") + (A.flip ? T("Ver frente", "Show front") : T("Mostrar QR", "Show QR")) + "</button></div></div>";
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
      var left = Math.max(0, Math.ceil((end - new Date()) / 864e5)), pct = Math.min(100, Math.max(4, 100 * (new Date() - start) / (end - start)));
      h += '<div class="ka-sec">' + T("Mi membresía", "My membership") + '</div><a class="ka-mem" href="/app/profile"><div class="r1"><div><b>' + (state(m) === "active" ? T("Activa", "Active") : T("Por renovar", "Needs renewal")) + "</b><span>" +
        T("Vigente hasta el ", "Valid through ") + esc(fdate(m.valid_through)) + '</span></div><div class="lf"><b>' + left + "</b><span>" + T("días", "days") + '</span></div></div><div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div></a>';
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
    var h = hero({ cls: "sm", eb: "KAI", title: T("Eventos", "Events"), sub: T("Conéctese con otros pastores", "Connect with fellow pastors") });
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

  function inboxHTML() {
    return hero({ cls: "sm", eb: "KAI", title: T("Avisos", "Notices"), sub: T("Mensajes del equipo y recordatorios", "Team messages and reminders") }) +
      '<div class="ka-empty art"><div class="bub"><i class="b1"></i><i class="b2"></i><i class="b3">' + svg("bell") + "</i></div><h3>" + T("Todo al día", "All caught up") + "</h3><p>" +
      T("Aquí le llegarán los mensajes del equipo de KAI, los recordatorios de eventos y las respuestas a sus solicitudes.", "Messages from the KAI team, event reminders and replies to your requests will appear here.") + "</p></div>" +
      '<div class="ka-card ka-tip"><span class="ic">' + svg("bell") + "</span><div><h3>" + T("Avisos en su celular", "Notices on your phone") + "</h3><p>" +
      T("Muy pronto podrá activarlos para recibirlos aunque la app esté cerrada, con el numerito sobre el ícono de KAI.", "Soon you'll be able to turn them on and get them even when the app is closed, with a badge on the KAI icon.") + "</p></div></div>";
  }

  function profileHTML() {
    var m = A.m;
    if (!m) return hero({ cls: "sm", eb: "KAI", title: T("Perfil", "Profile"), sub: esc(A.user && A.user.email) }) + outHTML();
    var st = state(m), cls = st === "active" ? "" : st === "expired" ? "exp" : "ina";
    var h = hero({ cls: "prof", title: esc(m.full_name), sub: esc(m.title || ""), side: avatar(m, "lg"),
      extra: '<div class="pchips"><span class="ka-pill ' + cls + '">' + (st === "active" ? T("Credencial activa", "Active credential") : st === "expired" ? T("Vencida", "Expired") : T("Inactiva", "Inactive")) + "</span><span>" + esc(m.credential_no || "") + "</span></div>" });
    function grp(title, rows) { return '<div class="ka-sec">' + title + '</div><dl class="ka-dl">' + rows.map(function (r) { return "<div><dt>" + svg(r[0]) + r[1] + "</dt><dd>" + r[2] + "</dd></div>"; }).join("") + "</dl>"; }
    h += grp(T("Membresía", "Membership"), [["card", T("Credencial", "Credential"), esc(m.credential_no || "—")], ["cal", T("Miembro desde", "Member since"), esc(fdate(m.member_since) || "—")], ["cal", T("Vence", "Expires"), esc(fdate(m.valid_through) || "—")]]);
    h += grp(T("Ministerio y contacto", "Ministry & contact"), [["home", T("Iglesia", "Church"), esc(m.church || "—")], ["pin", T("Ciudad", "City"), esc([m.city, m.state].filter(Boolean).join(", ") || "—")], ["bell", T("Teléfono", "Phone"), esc(m.phone ? (window.KPH ? KPH(m.phone) : m.phone) : "—")], ["user", T("Correo", "Email"), esc(m.email || "—")]]);
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
      extra: '<div class="kt-roles">' + A.roles.map(function (r) { return "<span>" + esc((ROLE_N[r] || [r, r])[L_() === "es" ? 0 : 1]) + "</span>"; }).join("") + "</div>" });
    if (t.st === "load") return h + '<div class="ka-load"><div class="ka-sp"></div></div>';
    if (t.st === "err") return h + '<div class="ka-card"><h3>' + T("No pudimos cargar el equipo", "We couldn't load the team") + '</h3><p>' + T("Revise su internet e intente de nuevo.", "Check your internet and try again.") + '</p><button class="ka-btn navy" data-a="tretry">' + T("Intentar de nuevo", "Try again") + "</button></div>";
    if (t.st === "enroll") return h + '<div class="ka-card kt-lock"><div class="ic">' + ti("lock") + "</div><h3>" + T("Active la verificación en dos pasos", "Turn on two-step verification") + "</h3><p>" +
      T("Para proteger los datos de los pastores, el equipo entra con un código de su celular. Se configura una sola vez.", "To protect pastors' data, the team signs in with a code from their phone. You set it up once.") + '</p><a class="ka-btn gold wide" href="/staff">' + T("Configurar ahora", "Set it up now") + "</a></div>";
    if (t.st === "mfa") return h + '<div class="ka-card kt-lock"><div class="ic">' + ti("lock") + "</div><h3>" + T("Verificación en dos pasos", "Two-step verification") + "</h3><p>" +
      T("Abra su app de códigos (Google Authenticator u otra) y escriba el código de 6 dígitos de KAI.", "Open your authenticator app (Google Authenticator or another) and enter KAI's 6-digit code.") +
      '</p><form id="kt-mfa" novalidate><input class="kt-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="' + T("Código", "Code") + '"><button class="ka-btn gold wide" type="submit">' + T("Verificar", "Verify") + '</button><p class="ka-msg" id="kt-mm" role="status"></p></form></div>';

    var o = t.ov, a = o.apps || {};
    h += '<div class="kt-acts"><button class="kt-act g" data-a="soon" data-w="aviso"><span class="ic">' + ti("send") + "</span><b>" + T("Enviar aviso", "Send notice") + "</b><small>" + T("A todos, al Board o a una persona", "To all, the Board or one person") + '</small></button>' +
      '<button class="kt-act" data-a="soon" data-w="reunion"><span class="ic">' + ti("zoom") + "</span><b>" + T("Nueva reunión", "New meeting") + "</b><small>" + T("Zoom, calendario y confirmación", "Zoom, calendar and RSVP") + "</small></button></div>";

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
