/* KAI · Panel del equipo (#/staff…), página de pago (#/pago/TOKEN)
   y avisos en el Área de Miembros (botón del panel, renovación, credencial impresa).
   Todo dato pasa por funciones de Supabase que revisan el rol y la verificación
   en dos pasos (aal2). Sin rol, no se entrega ningún dato. */
(function () {
  "use strict";
  var SC = window.KAIAPP_SCHEMA || { A: [], B: [], C: [], BENEFITS: [], TITLES: [] };
  var BUCKET = "applications", PHOTOS = "member-photos";
  var SITE = /(^|\.)kaie44\.org$/.test(location.hostname) ? "https://www.kaie44.org" : location.origin;
  var PDFLIB = ["https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js", "https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/vfs_fonts.js"];
  var ST = { me: null, ov: null, team: null, view: null, busy: false, seq: 0 };
  var ROOT = null;

  /* ---------- utilidades ---------- */
  function sb() { return window.KAI && window.KAI.sb ? window.KAI.sb : null; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function lang() { try { return window.L === "en" ? "en" : "es"; } catch (e) { return "es"; } }
  function xx(es, en) { return lang() === "es" ? es : en; }
  var MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function d8(s) { if (!s) return null; var str = String(s); var d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + "T12:00:00") : new Date(str); return isNaN(d) ? null : d; }
  function fd(s) { var d = d8(s); return d ? d.getDate() + " " + MES[d.getMonth()] + " " + d.getFullYear() : "—"; }
  function fdt(s) { var d = d8(s); if (!d) return ""; var h = d.getHours(), m = d.getMinutes(); return fd(s) + " · " + ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " a.m." : " p.m."); }
  function ago(s) {
    var d = d8(s); if (!d) return ""; var days = Math.floor((Date.now() - d.getTime()) / 864e5);
    if (days < 1) { var h = Math.floor((Date.now() - d.getTime()) / 36e5); return h < 1 ? "hace un momento" : "hace " + h + (h === 1 ? " hora" : " horas"); }
    if (days < 45) return "hace " + days + (days === 1 ? " día" : " días");
    var mo = Math.round(days / 30); return mo < 12 ? "hace " + mo + " meses" : "hace más de un año";
  }
  function daysTo(s) { var d = d8(s); if (!d) return null; var t = new Date(); t.setHours(12, 0, 0, 0); return Math.round((d - t) / 864e5); }
  function ini(n) { return String(n || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase() || "—"; }
  function has() { var r = (ST.me && ST.me.roles) || []; for (var i = 0; i < arguments.length; i++) if (r.indexOf(arguments[i]) >= 0) return true; return false; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  var ERR = {
    forbidden: "No tiene permiso para esta acción.", mfa_required: "Necesita verificar su código de dos pasos.",
    note_required: "Escriba una nota.", reason_required: "Elija el motivo.", bad_status: "La aplicación cambió de estado. Recargue la página.",
    already_paid: "Este pago ya se había registrado.", email_in_use: "Ya existe un miembro con ese correo.",
    summary_required: "Escriba un resumen.", own_application: "Nadie puede revisar ni decidir su propia aplicación.", not_found: "No se encontró el registro.", bad_payment: "Revise el monto y la fecha."
  };
  function errMsg(e) { var m = (e && (e.message || e.error_description)) || ""; for (var k in ERR) if (m.indexOf(k) >= 0) return ERR[k]; return "Algo salió mal. Intente de nuevo." + (m ? " (" + m + ")" : ""); }
  function rpc(fn, args) {
    var c = sb(); if (!c) return Promise.reject(new Error("no_client"));
    return c.rpc(fn, args || {}).then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function toast(msg, bad) {
    var t = $("#st-toast"); if (!t) { t = document.createElement("div"); t.id = "st-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.className = "st-toast on" + (bad ? " bad" : ""); clearTimeout(t._h); t._h = setTimeout(function () { t.className = "st-toast"; }, 3800);
  }
  function signed(path) {
    if (!path) return Promise.resolve(null);
    return sb().storage.from(BUCKET).createSignedUrl(path, 900).then(function (r) { return r.error ? null : r.data.signedUrl; }).catch(function () { return null; });
  }
  function ico(n) {
    var p = { search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', lock: '<rect x="4" y="11" width="16" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>' }[n];
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + p + "</svg>";
  }

  /* ---------- formato de respuestas usando el mismo esquema de la aplicación ---------- */
  function opt(f, v) { var o = (f.o || []).filter(function (z) { return String(z[0]) === String(v); })[0]; return o ? o[1] : v; }
  function fval(f, d) {
    var v = d[f.k], t = f.type || "text";
    if (v == null || v === "" || (Array.isArray(v) && !v.length) || v === false) return "";
    if (t === "radio" || t === "select" || t === "morphe") return opt(f, v);
    if (t === "checks") return v.filter(function (z) { return z !== "other"; }).map(function (z) { return opt(f, z); }).concat(v.indexOf("other") >= 0 && d[f.k + "_other"] ? [d[f.k + "_other"]] : []).join(", ");
    if (t === "scale") return v + " de 5 (1 = " + f.sc[0][0] + ", 5 = " + f.sc[1][0] + ")";
    if (t === "tier") return v === "ministro" ? "Ministro · $75 / año" : "Pastor · $100 / año";
    if (t === "consent") return "Autorizado";
    if (t === "faith") return "Afirma la Declaración de Fe";
    if (f.in === "date") return fd(v);
    return String(v);
  }
  function lbl(f) { return f.tag ? f.tag[0] : f.type === "faith" ? "Declaración de Fe" : f.type === "consent" ? "Autorización" : f.type === "tier" ? "Membresía" : f.type === "morphe" ? "Instituto Morphe" : (f.l ? f.l[0] : f.k); }
  function shown(f, d) {
    if (!f.when) return true; var p = f.when.split("="), v = d[p[0]], ok = p[1].split(",");
    return Array.isArray(v) ? v.some(function (z) { return ok.indexOf(String(z)) >= 0; }) : ok.indexOf(String(v)) >= 0;
  }
  function secHTML(sec, d, skip) {
    var items = [];
    sec.f.forEach(function (f) {
      if (!f.k || f.type === "file" || f.type === "pick" || (skip && skip.indexOf(f.k) >= 0) || !shown(f, d)) return;
      if (f.type === "cred") return;
      var v = fval(f, d); if (!v) return;
      items.push([lbl(f), v, f.type === "area" || v.length > 70]);
    });
    if (!items.length) return "";
    return '<div class="st-sec"><h4>' + esc(sec.t[0]) + '</h4><div class="st-kv">' + items.map(function (i) { return '<div class="' + (i[2] ? "w" : "") + '"><small>' + esc(i[0]) + "</small><p>" + esc(i[1]).replace(/\n/g, "<br>") + "</p></div>"; }).join("") + "</div></div>";
  }
  function ben(k) { var b = (SC.BENEFITS || []).filter(function (z) { return z[0] === k; })[0]; return b ? b[1] : k; }
  function findF(part, k) { var out = null; (SC[part] || []).forEach(function (s) { s.f.forEach(function (f) { if (f.k === k) out = f; }); }); return out; }

  /* ---------- encabezado y pestañas ---------- */
  var ROLE_N = { admin: "Administrador", membership: "Membresía", treasury: "Tesorería", care: "Cuidado pastoral", president: "Presidente" };
  function tabs(cur) {
    var ov = ST.ov || {}, apps = ov.apps || {}, t = [];
    if (has("president")) t.push(["inbox", "Para su aprobación", apps.recommended]);
    if (has("admin", "membership", "president", "care")) t.push(["apps", "Aplicaciones", (apps["new"] || 0) || null]);
    t.push(["members", "Miembros", null]);
    if (has("admin", "membership", "president", "care")) t.push(["needs", "Necesidades", null]);
    if (has("care")) t.push(["care", "Cuidado pastoral", ov.care || null]);
    t.push(["events", "Eventos", null]);
    return '<div class="st-tabs" role="navigation">' + t.map(function (x) { return '<a class="' + (cur === x[0] ? "on" : "") + '" href="#/staff/' + x[0] + '">' + x[1] + (x[2] ? ' <span class="ct">' + x[2] + "</span>" : "") + "</a>"; }).join("") + '<a href="#/membership">Mi credencial</a></div>';
  }
  function hero(cur, eyebrow, title, sub, back) {
    var roles = (ST.me.roles || []).map(function (r) { return '<span class="st-role">' + ROLE_N[r] + "</span>"; }).join(" ");
    return '<div class="hero sm st-hero"><div class="wrap">' + (back ? '<a class="st-back" href="' + back[0] + '">‹ ' + back[1] + "</a>" : "") +
      '<div class="eyebrow">' + esc(eyebrow) + "</div><h1>" + esc(title) + '</h1><div class="st-who">' + (sub != null ? sub : "<span>Hola, " + esc(ST.me.name) + "</span>" + roles) + "</div>" + (back ? "" : tabs(cur)) + "</div></div>";
  }
  function body(html) { return '<section class="st-body"><div class="wrap">' + html + "</div></section>"; }
  function put(html) { if (ROOT) { ROOT.innerHTML = html; } }
  function loading(cur, title) { put(hero(cur, "Panel del equipo", title) + body('<p class="st-wait">Cargando…</p>')); }

  /* ---------- acceso: sesión, rol y verificación en dos pasos ---------- */
  function gate() {
    var c = sb();
    if (!c) { put(hero0("No pudimos conectar", "Intente de nuevo en unos minutos.")); return Promise.resolve(false); }
    return c.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { put(hero0("Panel del equipo", 'Inicie sesión en el <a href="#/membership">Área de Miembros</a> con su correo del equipo y regrese aquí.')); return false; }
      return rpc("staff_me").then(function (me) {
        ST.me = me;
        if (!me.roles || !me.roles.length) { put(denied()); return false; }
        if (me.aal === "aal2") return true;
        return mfaScreen().then(function () { return false; });
      });
    }).catch(function (e) { put(hero0("No pudimos conectar", esc(errMsg(e)))); return false; });
  }
  function hero0(t, p) { return '<div class="hero sm st-hero"><div class="wrap"><div class="eyebrow">Panel del equipo</div><h1>' + esc(t) + '</h1><div class="st-who"><span>' + p + "</span></div><div style=\"height:40px\"></div></div></div>" + body(""); }
  function denied() {
    return '<div class="hero sm st-hero"><div class="wrap"><div class="eyebrow">Panel del equipo</div><h1>Acceso restringido</h1><div style="height:40px"></div></div></div>' +
      body('<div class="st-card st-deny"><div class="st-cb">' + ico("lock") + '<div><b>Esta sección es solo para personal autorizado.</b><p>Si cree que necesita acceso, hable con el administrador.</p><a class="btn navy" href="#/membership">Ir a mi Área de Miembros</a></div></div></div>');
  }
  function mfaScreen() {
    var c = sb();
    return c.auth.mfa.listFactors().then(function (r) {
      var all = (r.data && r.data.all) || [], ok = all.filter(function (f) { return f.factor_type === "totp" && f.status === "verified"; })[0];
      if (ok) { mfaForm(ok.id, null); return; }
      var stale = all.filter(function (f) { return f.factor_type === "totp" && f.status !== "verified"; });
      return Promise.all(stale.map(function (f) { return c.auth.mfa.unenroll({ factorId: f.id }); })).then(function () {
        return c.auth.mfa.enroll({ factorType: "totp", friendlyName: "KAI " + Date.now() });
      }).then(function (e) { if (e.error) throw e.error; mfaForm(e.data.id, e.data.totp); });
    }).catch(function (e) { put(hero0("Verificación en dos pasos", esc(errMsg(e)))); });
  }
  function mfaForm(fid, totp) {
    var setup = totp ? '<ol class="st-steps"><li>Instale en su celular una app de códigos, por ejemplo <b>Google Authenticator</b> o <b>Microsoft Authenticator</b>.</li><li>En la app, toque <b>+</b> y escanee este código:</li></ol><div class="st-qr"><img alt="Código QR" src="' + esc(totp.qr_code) + '"><p>¿No puede escanear? Escriba esta clave: <code>' + esc(totp.secret) + '</code></p></div><p class="st-mfa-p">3. Escriba el código de 6 dígitos que muestra la app:</p>' :
      '<p class="st-mfa-p">Abra su app de códigos (Google Authenticator u otra) y escriba el código de 6 dígitos de <b>KAI</b>.</p>';
    put('<div class="hero sm st-hero"><div class="wrap"><div class="eyebrow">Panel del equipo</div><h1>' + (totp ? "Active la verificación en dos pasos" : "Verificación en dos pasos") + '</h1><div class="st-who"><span>Hola, ' + esc(ST.me.name) + ". Por seguridad, el panel pide un código además de su contraseña.</span></div><div style=\"height:40px\"></div></div></div>" +
      body('<div class="st-card st-mfa"><div class="st-cb">' + setup + '<form id="st-mfa"><input class="st-in st-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" placeholder="000000" required><button class="btn gold" type="submit">Verificar</button></form><p class="st-msg" id="st-mfa-msg"></p></div></div>'));
    var f = $("#st-mfa"); var inp = $(".st-code", f); inp.focus();
    f.addEventListener("submit", function (ev) {
      ev.preventDefault(); var code = inp.value.replace(/\D/g, ""); if (code.length !== 6) return;
      var b = $("button", f); b.disabled = true;
      sb().auth.mfa.challengeAndVerify({ factorId: fid, code: code }).then(function (r) {
        if (r.error) throw r.error; route();
      }).catch(function () { $("#st-mfa-msg").textContent = "Código incorrecto o vencido. Intente con el código nuevo."; b.disabled = false; inp.select(); });
    });
  }

  /* ---------- router ---------- */
  function route() {
    if (typeof evInit === "function") evInit();
    var h = (location.hash || "").replace(/^#\/?/, ""), seq = ++ST.seq;
    ROOT = $("#stx"); if (!ROOT) return;
    if (/^pago\//.test(h)) { payPage(decodeURIComponent(h.slice(5))); return; }
    var p = h.split("/").slice(1);
    gate().then(function (ok) {
      if (!ok || seq !== ST.seq) return;
      return Promise.all([rpc("staff_overview"), ST.team ? ST.team : rpc("staff_team")]).then(function (r) {
        ST.ov = r[0]; ST.team = r[1]; if (seq !== ST.seq) return;
        var v = p[0] || (has("president") ? "inbox" : has("admin", "membership", "care") ? "apps" : "members");
        var need = { inbox: ["president"], apps: ["admin", "membership", "president", "care"], app: ["admin", "membership", "president", "care", "treasury"], needs: ["admin", "membership", "president", "care"], care: ["care"] }[v];
        if (need && !has.apply(null, need)) { put(denied()); return; }
        if (v === "inbox") return inbox();
        if (v === "apps") return appList(p[1] || "", decodeURIComponent(p[2] || ""));
        if (v === "app") return appDetail(p[1]);
        if (v === "members") return memList(p[1] || "all", decodeURIComponent(p[2] || ""));
        if (v === "member") return memDetail(p[1]);
        if (v === "needs") return needs();
        if (v === "care") return care(p[1]);
        if (v === "events" && window.KAIEVP) return KAIEVP.list(p[1]);
        if (v === "event" && window.KAIEVP) return KAIEVP.detail(p[1], p[2]);
        put(denied());
      });
    }).catch(function (e) { put(hero0("No pudimos cargar el panel", esc(errMsg(e)))); });
  }

  /* ---------- 1) Aplicaciones ---------- */
  var APP_ST = { "new": ["new", "Nueva"], in_review: ["rev", "En revisión"], recommended: ["rec", "Con el presidente"], approved: ["ok", "Aprobada"], declined: ["no", "No aprobada"], withdrawn: ["no", "Retirada"] };
  function pill(s, pres) { var x = s === "recommended" && pres ? ["rec", "Con el Administrador"] : APP_ST[s] || ["no", s]; return '<span class="st-pill ' + x[0] + '">' + x[1] + "</span>"; }
  function refsHTML(a) { var o = ""; for (var i = 0; i < (a.refs_total || 0); i++) o += '<i class="' + (i < a.refs_done ? "ok" : "") + '"></i>'; return '<div class="st-refs">' + o + "<em>" + (a.refs_total ? a.refs_done + " de " + a.refs_total : "—") + "</em></div>"; }
  function tasksHTML() {
    var t = (ST.ov && ST.ov.my_tasks) || []; if (!t.length) return "";
    return '<div class="st-card st-tasks"><h3>Sus tareas <small>' + t.length + "</small></h3><ul>" + t.map(function (x) {
      var href = x.application_id ? "#/staff/app/" + x.application_id : x.member_kid ? "#/staff/member/" + x.member_kid : "";
      return '<li><a href="' + href + '">' + esc(x.title) + "</a><span>" + ago(x.created_at) + '</span><button class="st-mini" data-act="task" data-id="' + x.id + '">Hecho</button></li>';
    }).join("") + "</ul></div>";
  }
  function appList(st, q) {
    loading("apps", "Aplicaciones de membresía");
    var page = 0;
    function load() {
      return rpc("staff_apps", { p_status: st || null, p_q: q || null, p_offset: page * 25 }).then(function (r) {
        var ov = ST.ov, a = ov.apps || {}, tot = 0; for (var k in a) tot += a[k];
        var seg = [["", "Todas", tot], ["new", "Nuevas", a["new"] || 0], ["in_review", "En revisión", a.in_review || 0], ["recommended", "Con el presidente", a.recommended || 0], ["approved", "Aprobadas", a.approved || 0], ["declined", "No aprobadas", a.declined || 0]];
        var rows = r.rows.map(function (x) {
          var name = x.cred_name || ((x.first_name || "") + " " + (x.last_name || ""));
          var sp = (x.spouse || []).map(function (s) { return '<span class="st-cp">⇄ Cónyuge · ' + esc(s.app_no) + "</span>"; }).join(" ");
          return '<a class="st-row" href="#/staff/app/' + x.id + '"><div class="st-no">' + esc(x.app_no) + '</div><div class="st-p"><div class="st-av">' + esc(ini(name)) + '</div><div style="min-width:0"><b>' + esc(name) + "</b><span>" + esc([x.title, x.church, [x.city, x.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + "</span>" + sp + '</div></div><div class="st-tier"><b>' + (x.tier === "ministro" ? "Ministro" : "Pastor") + "</b><span>$" + (x.fee || "") + ' / año</span></div><div class="st-date">' + fd(x.created_at) + "<span>" + ago(x.created_at) + "</span></div>" + refsHTML(x) + '<div class="st-pill-c">' + pill(x.status, x.president_app) + '</div><div class="go">›</div></a>';
        }).join("") || '<div class="st-empty">No hay aplicaciones aquí.</div>';
        put(hero("apps", "Panel del equipo", "Aplicaciones de membresía") + body(tasksHTML() +
          '<div class="st-stats"><div class="st-stat hl"><small>Nuevas</small><b>' + (a["new"] || 0) + '</b><span>Esperan revisión</span></div><div class="st-stat"><small>En revisión</small><b>' + (a.in_review || 0) + '</b><span>' + (a.recommended || 0) + ' con el presidente</span></div><div class="st-stat"><small>Aprobadas este año</small><b>' + (ov.year_approved || 0) + "</b><span>" + (ov.year_approved_pastor || 0) + " pastores · " + ((ov.year_approved || 0) - (ov.year_approved_pastor || 0)) + ' ministros</span></div><div class="st-stat"><small>Recibidas este año</small><b>' + (ov.year_received || 0) + "</b><span>" + (ov.couples || 0) + " matrimonios enlazados</span></div></div>" +
          '<div class="st-bar"><div class="st-seg">' + seg.map(function (s) { return '<a class="' + (s[0] === st ? "on" : "") + '" href="#/staff/apps/' + s[0] + '">' + s[1] + " <i>" + s[2] + "</i></a>"; }).join("") + '</div><form class="st-search" id="st-q">' + ico("search") + '<input name="q" value="' + esc(q) + '" placeholder="Buscar por nombre, iglesia o número"></form></div>' +
          '<div class="st-table"><div class="st-row th"><div>Número</div><div>Solicitante</div><div>Membresía</div><div>Enviada</div><div>Referencias</div><div>Estado</div><div></div></div>' + rows + "</div>" + pager(r.total, page) +
          '<div class="st-foot"><div class="st-lock">' + ico("lock") + "<span>Las respuestas de cuidado pastoral (Parte C) <b>solo las ve el equipo de Cuidado pastoral.</b></span></div></div>"));
        bindSearch("#/staff/apps/" + st + "/");
        $$(".st-pg button", ROOT).forEach(function (b) { b.onclick = function () { page = +b.dataset.p; load(); }; });
      });
    }
    return load();
  }
  function pager(total, page) { var n = Math.ceil(total / 25); if (n < 2) return ""; var o = ""; for (var i = 0; i < n; i++) o += '<button class="' + (i === page ? "on" : "") + '" data-p="' + i + '">' + (i + 1) + "</button>"; return '<div class="st-pages st-pg">' + o + "</div>"; }
  function bindSearch(base) { var f = $("#st-q", ROOT); if (f) f.onsubmit = function (e) { e.preventDefault(); location.hash = base + encodeURIComponent(f.q.value.trim()); }; }

  /* ---------- 2) Detalle de aplicación ---------- */
  var REASONS = ["Referencias no confirmadas", "No afirma la Declaración de Fe", "Información incompleta", "Otro"];
  var EV = { submitted: "envió su aplicación", start: "comenzó la revisión", ref: "marcó contactada una referencia", note: "nota", recommend: "envió su recomendación al presidente", decide: "decisión del presidente", pay_claim: "indicó que envió su pago por Zelle", pay: "confirmó el pago", print: "actualizó la credencial impresa" };
  function evLine(e, applicant) {
    var who = e.actor || applicant, txt = EV[e.kind] || e.kind, cls = e.kind === "note" ? "note" : "sys";
    if (e.kind === "recommend") txt = "recomendó " + (e.meta && e.meta.rec === "approve" ? "aprobar" : "no aprobar") + (e.meta && e.meta.reason ? " · " + e.meta.reason : "");
    if (e.kind === "decide") txt = { approve: "aprobó la aplicación", decline: "no aprobó la aplicación", "return": "la devolvió al equipo" }[e.meta && e.meta.decision] || txt;
    if (e.kind === "ref") txt = "marcó contactada la referencia " + (e.meta && e.meta.ref === "ref2" ? "2" : "1");
    return '<li class="' + cls + '"><b>' + esc(who) + (e.kind === "note" ? " · nota" : " " + txt) + "</b><time>" + fdt(e.at) + "</time>" + (e.note && e.kind !== "submitted" && e.kind !== "pay_claim" ? "<p>" + esc(e.note) + "</p>" : "") + "</li>";
  }
  function appDetail(id) {
    loading("apps", "Aplicación");
    return rpc("staff_app", { p_id: id }).then(function (a) {
      var d = a.data || {}, name = a.cred_name || ((a.first_name || "") + " " + (a.last_name || "")), files = a.files || {};
      var flow = [["Recibida", fd(a.created_at)], ["En revisión", a.reviewer ? a.reviewer : "Sin asignar"], ["Recomendación del equipo", a.rec ? (a.rec === "approve" ? "Aprobar" : "No aprobar") + " · " + (a.rec_by || "") : "Aprobar o no aprobar"], ["Decisión del presidente", a.status === "approved" ? "Aprobada" : a.status === "declined" ? "No aprobada" : "Cierra el proceso"]];
      var cur = { "new": 0, in_review: 1, recommended: 3, approved: 4, declined: 4, withdrawn: 4 }[a.status];
      var flowH = '<div class="st-flow">' + flow.map(function (f, i) { var c = i < cur ? "dn" : i === cur ? "cur" : ""; return '<div class="' + c + '"><small>' + (i < cur ? "✓ " : "") + "Paso " + (i + 1) + (i === cur ? " · Ahora" : "") + "</small><b>" + f[0] + "</b><span>" + esc(f[1]) + "</span></div>"; }).join("") + "</div>";
      var spouse = (a.spouse || []).map(function (s) { return '<a class="st-cp" href="#/staff/app/' + s.id + '">⇄ Cónyuge · ' + esc(s.name) + " · " + esc(s.app_no) + "</a>"; }).join(" ");
      var idcard = '<div class="st-card"><div class="st-cb st-id"><div><div class="st-ph" id="st-photo">' + esc(ini(name)) + '</div></div><div><div class="st-kv">' +
        kv("Título en credencial", a.title) + kv("Nombre en credencial", a.cred_name) + kv("Membresía", a.tier === "ministro" ? "Ministro · $75 / año" : "Pastor · $100 / año") +
        kv("Correo", a.email) + kv("Teléfono", a.phone) + kv("Ciudad", [a.city, a.state].filter(Boolean).join(", ")) + kv("Iglesia", a.church) + kv("Dirección postal", [d.address, d.zip].filter(Boolean).join(" · ")) + kv("Firmó", (a.signed_name || "") + " · " + fd(a.signed_at)) +
        "</div>" + (spouse ? '<div style="margin-top:12px">' + spouse + "</div>" : "") + "</div></div></div>";
      var partA = SC.A.map(function (s) { return secHTML(s, d, ["tier", "email", "phone", "city", "state", "address", "zip"]); }).join("");
      var nb = (a.needs && a.needs.data) || {}, pr = (a.needs && a.needs.priorities) || [];
      var partB = (pr.length ? '<div class="st-sec"><h4>Sus prioridades</h4><div class="st-prio">' + pr.map(function (p, i) { return "<span>" + (i + 1) + ". " + esc(ben(p)) + "</span>"; }).join("") + "</div></div>" : "") + SC.B.map(function (s) { return secHTML(s, nb); }).join("");
      var docs = [["photo", "Foto de credencial"], ["doc_ord", "Certificado de ordenación"], ["doc_letter", "Carta de recomendación"]].map(function (k) {
        return files[k[0]] ? '<a class="st-doc" href="#" data-file="' + esc(files[k[0]]) + '"><i>' + esc((files[k[0]].split(".").pop() || "").toUpperCase()) + "</i><div><b>" + k[1] + "</b><span>Ver</span></div></a>" : '<div class="st-doc miss"><i>—</i><div><b>' + k[1] + "</b><span>No adjuntó</span></div></div>";
      }).join("") + '<a class="st-doc" href="#" data-file="' + a.id + '/application.pdf"><i>PDF</i><div><b>Copia de la aplicación</b><span>Firmada · ' + fd(a.signed_at) + "</span></div></a>";
      var tabsH = '<div class="st-card"><nav class="st-sub"><a class="on" href="#" data-tab="A">Parte A · Solicitud</a><a href="#" data-tab="B">Parte B · Necesidades</a><a href="#" data-tab="D">Documentos</a></nav><div data-pane="A">' + (partA || '<div class="st-sec">Sin respuestas.</div>') + '</div><div data-pane="B" hidden>' + (partB || '<div class="st-sec">Sin respuestas.</div>') + '</div><div data-pane="D" hidden><div class="st-cb st-docs">' + docs + "</div></div></div>";
      var refs = ["ref1", "ref2"].filter(function (r) { return d[r + "_name"]; }).map(function (r) {
        var done = (a.refs || {})[r], canRef = has("admin", "membership") && ["new", "in_review"].indexOf(a.status) >= 0;
        return '<div class="st-ref"><div><b>' + esc(d[r + "_name"]) + "</b><p>" + esc([d[r + "_church"], d[r + "_phone"], d[r + "_email"], d[r + "_years"] ? "Lo conoce hace " + d[r + "_years"] + " años" : ""].filter(Boolean).join(" · ")) + "</p></div>" +
          (done ? '<span class="ok">✓ Contactada</span>' + (done.note ? '<div class="nt">“' + esc(done.note) + "” · " + esc(done.by) + ", " + fd(done.at) + "</div>" : "") : canRef ? '<button class="st-mini" data-act="ref" data-ref="' + r + '">Marcar contactada</button>' : '<span class="st-muted">Pendiente</span>') + "</div>";
      }).join("");
      var nref = ["ref1", "ref2"].filter(function (r) { return d[r + "_name"]; }).length;
      var refsH = '<div class="st-card"><h3>Referencias <small>' + Object.keys(a.refs || {}).length + " de " + nref + " contactadas</small></h3>" + (refs || '<div class="st-cb">No dio referencias.</div>') + "</div>";
      var side = actionBox(a, name);
      var log = '<div class="st-card"><h3>Historial y notas <small>Registro interno</small></h3><ul class="st-log">' + (a.events || []).map(function (e) { return evLine(e, name); }).join("") + '</ul><div class="st-add"><textarea id="st-note" placeholder="Agregar una nota interna…"></textarea><div><span>Las notas no se pueden editar ni borrar.</span><button class="st-mini" data-act="note">Agregar nota</button></div></div></div>';
      put('<div class="hero sm st-hero"><div class="wrap"><a class="st-back" href="#/staff/' + (has("president") && a.status === "recommended" ? "inbox" : "apps") + '">‹ ' + (has("president") && a.status === "recommended" ? "Para su aprobación" : "Aplicaciones") + '</a><div class="st-dhead"><div><div class="eyebrow">Aplicación ' + esc(a.app_no) + "</div><h1>" + esc(name) + '</h1><div class="st-who"><span>' + esc([a.title, a.church, [a.city, a.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + '</span></div></div><div class="st-dmeta">' + pill(a.status, a.president_app) + (a.reviewer ? '<span class="st-taken">Revisa: <b>' + esc(a.reviewer) + "</b></span>" : "") + "</div></div></div></div>" +
        body(flowH + '<div class="st-dgrid"><div>' + idcard + (a.limited ? "" : tabsH + refsH) + "</div><div>" + side + log + "</div></div>"));
      if (files.photo) signed(files.photo).then(function (u) { if (u) { var p = $("#st-photo", ROOT); if (p) p.innerHTML = '<img src="' + esc(u) + '" alt="">'; } });
      bindApp(a, name);
    });
  }
  function kv(l, v) { return v ? "<div><small>" + esc(l) + "</small><p>" + esc(v) + "</p></div>" : ""; }
  function actionBox(a, name) {
    if (["new", "in_review"].indexOf(a.status) >= 0 && has("admin", "membership") && a.mine) {
      return '<div class="st-card"><h3>Su propia aplicación</h3><div class="st-cb"><p class="st-subline" style="margin:0">Otra persona de Membresía la revisa y la recomienda. Nadie puede revisar ni decidir su propia aplicación.</p></div></div>';
    }
    if (["new", "in_review"].indexOf(a.status) >= 0 && has("admin", "membership")) {
      return '<div class="st-card st-rec" id="st-recbox"><h3>Recomendación del equipo <small>Paso 3</small></h3><div class="st-cb">' +
        (a.status === "new" ? '<p class="lead2">Nadie ha tomado esta aplicación.</p><button class="btn gold" data-act="start" style="width:100%;margin-bottom:18px">Comenzar revisión</button>' : "") +
        '<p class="lead2">Cuando termine la revisión, deje su recomendación. La aplicación pasa a la bandeja del presidente para la decisión final.</p>' +
        '<div class="st-opt" data-pick="rec"><label data-v="approve">✓ Aprobar</label><label class="no" data-v="decline">No aprobar</label></div>' +
        '<div id="st-reason" hidden><span class="lbl">Motivo</span><select class="st-sel" id="st-reason-s"><option value="">Elija…</option>' + REASONS.map(function (r) { return "<option>" + r + "</option>"; }).join("") + "</select></div>" +
        '<span class="lbl">¿Por qué? · Nota para el presidente</span><textarea id="st-recnote"></textarea><p class="req">La nota es obligatoria. Queda en el historial y no se puede borrar.</p><button class="btn gold" data-act="recommend">Enviar al presidente</button><p class="st-msg light" id="st-recmsg"></p></div></div>';
    }
    if (a.status === "recommended") {
      var rb = '<span class="st-recb ' + (a.rec === "approve" ? "y" : "n") + '">' + (a.rec === "approve" ? "✓ El equipo recomienda aprobar" : "El equipo recomienda no aprobar") + "</span>" + (a.rec_reason ? '<br><span class="st-why">Motivo: ' + esc(a.rec_reason) + "</span>" : "") + '<p class="st-q">' + esc(a.rec_note) + '</p><div class="st-by">' + esc(a.rec_by || "") + " · " + fd(a.rec_at) + "</div>";
      if (a.can_decide) return '<div class="st-card">' + (a.president_app ? "<h3>Aplicación del presidente <small>La decide el Administrador</small></h3>" : "") + '<div class="st-cb">' + rb + "</div></div>" + decisionBox(a, name);
      return '<div class="st-card"><h3>' + (a.president_app ? "Espera la decisión del Administrador" : "Con el presidente") + ' <small>Paso 4</small></h3><div class="st-cb">' + rb + "</div></div>";
    }
    if (a.status === "approved") {
      var paid = !!a.member_kid;
      return '<div class="st-card st-rec"><h3>' + (paid ? "Miembro activo" : "Aprobada · pendiente de pago") + "</h3><div class=\"st-cb\">" +
        (paid ? '<p class="lead2">El pago se confirmó y su credencial está activa.</p><a class="btn gold" href="#/staff/member/' + a.member_kid + '">Ver perfil del miembro</a>' :
          '<p class="lead2">' + (a.pay_claimed_at ? "<b>Indicó que ya envió su pago por Zelle</b> (" + fd(a.pay_claimed_at) + "). Verifique en el banco y registre el pago." : "Envíele la bienvenida con las instrucciones de pago. Cuando llegue el Zelle, Tesorería registra el pago.") + "</p>" +
          '<a class="btn gold" href="#" data-act="mail-welcome" style="margin-bottom:8px">Correo de bienvenida</a>' + (a.pay_token ? '<button class="btn line-w" data-act="copy-link" style="margin-bottom:8px">Copiar enlace de pago</button>' : "") +
          (has("admin", "treasury") ? '<button class="btn line-w" data-act="pay" style="width:100%">Registrar pago</button>' : "")) +
        "</div></div>";
    }
    if (a.status === "declined") return '<div class="st-card"><h3>No aprobada</h3><div class="st-cb"><p class="st-q">' + esc(a.decision_note || "") + '</p><div class="st-by">' + esc(a.decided_by || "") + " · " + fd(a.decided_at) + '</div><a class="btn navy" href="#" data-act="mail-decline" style="margin-top:14px">Correo para comunicar la decisión</a></div></div>';
    return "";
  }
  function decisionBox(a, name) {
    return '<div class="st-card st-rec st-decbox"><h3>Su decisión</h3><div class="st-cb"><div class="st-opt three" data-pick="dec"><label data-v="approve">✓ Aprobar</label><label class="no" data-v="decline">No aprobar</label><label data-v="return">Devolver al equipo</label></div><span class="lbl">Su nota · queda en el historial</span><textarea id="st-decnote"></textarea>' +
      '<div class="st-next" id="st-next" hidden></div><button class="btn gold" data-act="decide">Confirmar</button><p class="st-msg light" id="st-decmsg"></p></div></div>';
  }
  function nextText(v, a, name) {
    if (v === "approve") return '<span class="lbl">Al confirmar</span><ol><li><span>Queda como <b>Aprobada · pendiente de pago</b>.</span></li><li><span>A <b>' + esc(a.reviewer || a.rec_by || "quien la revisó") + "</b> le aparece la tarea de <b>llamar</b> a " + esc(name) + " y enviarle el <b>correo de bienvenida</b> con las instrucciones de pago ($" + (a.fee || "") + ").</span></li><li><span>Al registrar el pago se activa su credencial con código QR y recibe su invitación para entrar.</span></li></ol>";
    if (v === "decline") return '<span class="lbl">Al confirmar</span><ol><li><span>Queda como <b>No aprobada</b>.</span></li><li><span>A <b>' + esc(a.reviewer || a.rec_by || "quien la revisó") + "</b> le aparece la tarea de comunicarle la decisión personalmente.</span></li></ol>";
    return '<span class="lbl">Al confirmar</span><ol><li><span>La aplicación regresa a <b>En revisión</b> con su nota para que el equipo revise lo que pidió.</span></li></ol>';
  }
  function bindPick(box, cb) { $$("label", box).forEach(function (l) { l.onclick = function () { $$("label", box).forEach(function (z) { z.classList.toggle("on", z === l); }); box.dataset.val = l.dataset.v; if (cb) cb(l.dataset.v); }; }); }
  function bindApp(a, name) {
    $$(".st-sub a", ROOT).forEach(function (t) { t.onclick = function (e) { e.preventDefault(); $$(".st-sub a", ROOT).forEach(function (z) { z.classList.toggle("on", z === t); }); $$("[data-pane]", ROOT).forEach(function (p) { p.hidden = p.dataset.pane !== t.dataset.tab; }); }; });
    $$("[data-file]", ROOT).forEach(function (l) { l.onclick = function (e) { e.preventDefault(); var w = window.open("", "_blank"); signed(l.dataset.file).then(function (u) { if (u && w) w.location = u; else { if (w) w.close(); toast("No se pudo abrir el archivo.", true); } }); }; });
    var rp = $('[data-pick="rec"]', ROOT); if (rp) bindPick(rp, function (v) { $("#st-reason", ROOT).hidden = v !== "decline"; });
    var dp = $('[data-pick="dec"]', ROOT); if (dp) bindPick(dp, function (v) { var n = $("#st-next", ROOT); n.hidden = false; n.innerHTML = nextText(v, a, name); $('[data-act="decide"]', ROOT).textContent = { approve: "Confirmar aprobación", decline: "Confirmar: no aprobar", "return": "Devolver al equipo" }[v]; });
    function act(p, btn, msgEl) {
      if (ST.busy) return; ST.busy = true; if (btn) btn.disabled = true;
      return rpc("staff_app_act", p).then(function () { ST.busy = false; toast("Guardado."); route(); }).catch(function (e) { ST.busy = false; if (btn) btn.disabled = false; if (msgEl) msgEl.textContent = errMsg(e); else toast(errMsg(e), true); });
    }
    on("start", function (b) { act({ p_id: a.id, p_act: "start" }, b); });
    on("note", function (b) { var n = $("#st-note", ROOT).value.trim(); if (!n) return toast("Escriba la nota.", true); act({ p_id: a.id, p_act: "note", p_note: n }, b); });
    on("ref", function (b) {
      var row = b.parentNode; if ($(".st-refform", row)) return;
      row.insertAdjacentHTML("beforeend", '<div class="st-refform"><textarea placeholder="¿Qué dijo la referencia? (opcional)"></textarea><button class="st-mini solid">Guardar</button></div>');
      $(".st-refform button", row).onclick = function () { act({ p_id: a.id, p_act: "ref", p_arg: b.dataset.ref, p_note: $(".st-refform textarea", row).value.trim() || null }, this); };
    });
    on("recommend", function (b) {
      var v = rp.dataset.val, n = $("#st-recnote", ROOT).value.trim(), r = $("#st-reason-s", ROOT).value, m = $("#st-recmsg", ROOT);
      if (!v) return (m.textContent = "Elija Aprobar o No aprobar.");
      if (v === "decline" && !r) return (m.textContent = "Elija el motivo.");
      if (!n) return (m.textContent = "Escriba por qué.");
      act({ p_id: a.id, p_act: "recommend", p_note: n, p_arg: v, p_arg2: v === "decline" ? r : null }, b, m);
    });
    on("decide", function (b) {
      var v = dp.dataset.val, n = $("#st-decnote", ROOT).value.trim(), m = $("#st-decmsg", ROOT);
      if (!v) return (m.textContent = "Elija una opción."); if (!n) return (m.textContent = "Escriba su nota.");
      act({ p_id: a.id, p_act: "decide", p_note: n, p_arg: v }, b, m);
    });
    on("pay", function () { payModal({ app: a, name: name }); });
    on("mail-welcome", function () { mailWelcome(a, name); });
    on("copy-link", function (b) { try { navigator.clipboard.writeText(SITE + "/#/pago/" + a.pay_token); b.textContent = "Enlace copiado"; } catch (e) { prompt("Enlace de pago:", SITE + "/#/pago/" + a.pay_token); } });
    on("mail-decline", function () { mailDecline(a, name); });
  }
  function on(act, fn) { $$('[data-act="' + act + '"]', ROOT).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); fn(b, e); }; }); }

  /* ---------- correos (Fase 1: se abren en su programa de correo) ---------- */
  function mailto(to, subj, bodyTxt) { location.href = "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(bodyTxt); }
  function mailWelcome(a, name) {
    var es = (a.data && a.data.lang_pref) !== "en";
    (function () {
      var link = a.pay_token ? SITE + "/#/pago/" + a.pay_token : SITE + "/#/membership";
      var z = a;
      var zl = z.zelle_to ? (es ? "Envíe su pago por Zelle a: " : "Send your payment by Zelle to: ") + z.zelle_to + " (" + (z.zelle_name || "Kingdom Alliance International") + ")" : (es ? "Las instrucciones de Zelle están en el enlace de abajo." : "Zelle instructions are at the link below.");
      var b = es ? "Estimado(a) " + name + ":\n\n¡Bienvenido(a) a Kingdom Alliance International! Nos alegra informarle que su aplicación de membresía fue aprobada.\n\nSu número de cuenta es " + a.app_no + ". Guárdelo; lo usará en sus pagos y comunicaciones con KAI.\n\nCuota anual: $" + a.fee + "\n" + zl + "\nEn la nota del Zelle escriba: " + a.app_no + " " + name + "\n\nCuando envíe su pago, avísenos aquí: " + link + "\n\nAl confirmar su pago recibirá un correo para crear su contraseña y ver su credencial digital. Su credencial impresa le llegará en 1 a 2 semanas.\n\nBendiciones,\nKingdom Alliance International\ninfo@kaie44.org"
        : "Dear " + name + ",\n\nWelcome to Kingdom Alliance International! We are glad to let you know that your membership application has been approved.\n\nYour account number is " + a.app_no + ". Please keep it for your payments and communication with KAI.\n\nAnnual fee: $" + a.fee + "\n" + zl + "\nIn the Zelle memo write: " + a.app_no + " " + name + "\n\nOnce you send your payment, let us know here: " + link + "\n\nWhen we confirm your payment you will receive an email to create your password and see your digital credential. Your printed credential will arrive in 1 to 2 weeks.\n\nBlessings,\nKingdom Alliance International\ninfo@kaie44.org";
      mailto(a.email, es ? "Bienvenido(a) a KAI · Aplicación " + a.app_no + " aprobada" : "Welcome to KAI · Application " + a.app_no + " approved", b);
    })();
  }
  function mailDecline(a, name) {
    var es = (a.data && a.data.lang_pref) !== "en";
    var b = es ? "Estimado(a) " + name + ":\n\nGracias por su interés en Kingdom Alliance International y por el tiempo que dedicó a su aplicación (" + a.app_no + ").\n\nDespués de revisarla en oración, en este momento no podemos aprobar su membresía. Con gusto conversaremos con usted personalmente; alguien de nuestro equipo le llamará.\n\nBendiciones,\nKingdom Alliance International\ninfo@kaie44.org"
      : "Dear " + name + ",\n\nThank you for your interest in Kingdom Alliance International and for the time you gave to your application (" + a.app_no + ").\n\nAfter prayerful review, we are not able to approve your membership at this time. We would be glad to talk with you personally; someone from our team will call you.\n\nBlessings,\nKingdom Alliance International\ninfo@kaie44.org";
    mailto(a.email, es ? "Su aplicación a KAI · " + a.app_no : "Your KAI application · " + a.app_no, b);
  }

  /* ---------- 3) Bandeja del presidente ---------- */
  function inbox() {
    loading("inbox", "Para su aprobación");
    return rpc("staff_apps", { p_status: "recommended" }).then(function (r) {
      r.rows = r.rows.filter(function (x) { return x.can_decide; });
      var n = r.rows.length;
      var cards = r.rows.map(function (x) {
        var name = x.cred_name || ((x.first_name || "") + " " + (x.last_name || ""));
        return '<div class="st-ic" data-id="' + x.id + '"><div><div class="st-p"><div class="st-av">' + esc(ini(name)) + '</div><div><span class="st-appno">' + esc(x.app_no) + "</span><b>" + esc(name) + "</b><span>" + esc([x.title, x.church, [x.city, x.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + '</span></div></div><div class="meta"><span>Membresía <b>' + (x.tier === "ministro" ? "Ministro · $75" : "Pastor · $100") + "</b></span><span>Referencias <b>" + x.refs_done + " de " + x.refs_total + "</b></span><span>Documentos <b>" + x.docs + ' de 2</b></span></div></div><div><span class="st-recb ' + (x.rec === "approve" ? "y" : "n") + '">' + (x.rec === "approve" ? "✓ El equipo recomienda aprobar" : "El equipo recomienda no aprobar") + "</span>" + (x.rec_reason ? '<br><span class="st-why">Motivo: ' + esc(x.rec_reason) + "</span>" : "") + '<p class="st-q">' + esc(x.rec_note) + '</p><div class="st-by">' + esc(x.rec_by || "") + " · Membresía · " + fd(x.rec_at) + '</div></div><div class="st-act"><button class="btn gold" data-open="' + x.id + '">Decidir</button><a class="btn navy" href="#/staff/app/' + x.id + '">Ver aplicación</a><small>Recibida ' + ago(x.created_at) + "</small></div></div>";
      }).join("") || '<div class="st-card"><div class="st-cb st-empty">No hay aplicaciones esperando su decisión. ¡Todo al día!</div></div>';
      put(hero("inbox", "Panel del equipo", "Para su aprobación", "<span>Hola, " + esc(ST.me.name) + '</span><span class="st-role">Presidente</span><span>' + (n ? n + (n === 1 ? " aplicación recomendada espera" : " aplicaciones recomendadas esperan") + " su decisión" : "Sin pendientes") + "</span>") +
        body('<div class="st-inbox">' + cards + '</div><div class="st-foot"><div class="st-lock"><span>Si elige <b>Devolver al equipo</b>, la aplicación regresa a “En revisión” con su nota.</span></div></div>'));
      $$("[data-open]", ROOT).forEach(function (b) {
        b.onclick = function () {
          var card = b.closest(".st-ic"), x = r.rows.filter(function (z) { return z.id === b.dataset.open; })[0], name = x.cred_name || x.first_name;
          $$(".st-ic.open", ROOT).forEach(function (c) { c.classList.remove("open"); var d = $(".st-dec", c); if (d) d.remove(); });
          card.classList.add("open");
          card.insertAdjacentHTML("beforeend", '<div class="st-dec"><div><h4>Su decisión</h4><div class="st-opt three" data-pick="dec"><label data-v="approve">✓ Aprobar</label><label class="no" data-v="decline">No aprobar</label><label data-v="return">Devolver al equipo</label></div><span class="lbl">Su nota · queda en el historial</span><textarea></textarea><button class="btn gold" data-go>Confirmar</button><p class="st-msg light"></p></div><div class="st-next"><span class="lbl">Elija una opción</span><p style="color:#b9c6e4;font-size:13.5px;margin:0">Aquí verá qué pasa al confirmar.</p></div></div>');
          var dp = $('[data-pick="dec"]', card), nx = $(".st-next", card), go = $("[data-go]", card), m = $(".st-msg", card);
          bindPick(dp, function (v) { nx.innerHTML = nextText(v, { reviewer: x.reviewer || x.rec_by, fee: x.fee }, name); go.textContent = { approve: "Confirmar aprobación", decline: "Confirmar: no aprobar", "return": "Devolver al equipo" }[v]; });
          go.onclick = function () {
            var v = dp.dataset.val, n2 = $("textarea", card).value.trim();
            if (!v) return (m.textContent = "Elija una opción."); if (!n2) return (m.textContent = "Escriba su nota.");
            go.disabled = true;
            rpc("staff_app_act", { p_id: x.id, p_act: "decide", p_note: n2, p_arg: v }).then(function () { toast("Decisión registrada."); route(); }).catch(function (e) { go.disabled = false; m.textContent = errMsg(e); });
          };
          card.scrollIntoView({ behavior: "smooth", block: "start" });
        };
      });
    });
  }

  /* ---------- 4) Miembros ---------- */
  var M_ST = { active: ["ok", "Activa"], expired: ["exp", "Vencida"], inactive: ["no", "Inactiva"], print: ["prt", "Por imprimir"], pay: ["pay", "Pendiente de pago"] };
  var KIND = { call: "Llamada", video: "Videollamada", coffee: "Café o visita", workshop: "Taller", incorp: "Incorporación", orient: "Orientación", counsel: "Consejería", prayer: "Oración", event: "Evento", other: "Otro" };
  function memList(filter, q) {
    loading("members", "Miembros");
    var page = 0;
    function load() {
      return rpc("staff_members", { p_filter: filter, p_q: q || null, p_offset: page * 25 }).then(function (r) {
        var ov = ST.ov;
        var al = [["pay", "Pendientes de pago", ov.pay_pending, ov.pay_claimed ? ov.pay_claimed + " dicen que ya pagaron por Zelle" : "Aprobados que aún no pagan"],
          ["renew", "Renovaciones", ov.renew_soon + ov.expired, ov.renew_soon + " vencen en 30 días · " + ov.expired + " vencidas"],
          ["nocontact", "Más de 90 días sin contacto", ov.no_contact, "Nadie del equipo los ha contactado"],
          ["print", "Credenciales por imprimir", ov.to_print + ov.printed, ov.printed ? ov.printed + " impresas, falta enviar" : "Imprimir y enviar"]];
        var cls = { pay: "pay", renew: "ren", nocontact: "cnt", print: "prt" };
        var rows = r.rows.map(function (m) {
          var s = M_ST[m.state_k] || ["no", m.state_k], dt = daysTo(m.valid_through);
          var href = m.kind === "pending" ? "#/staff/app/" + m.id : "#/staff/member/" + m.kid;
          var vig = m.kind === "pending" ? "—" : fd(m.valid_through) + (dt != null && dt < 0 ? "<span>Venció " + ago(m.valid_through) + "</span>" : dt != null && dt <= 30 ? "<span>Vence en " + dt + (dt === 1 ? " día" : " días") + "</span>" : "");
          var lc = m.kind === "pending" ? (m.pay_claimed_at ? '<b class="st-claim">Dice que ya pagó</b><span>' + fd(m.pay_claimed_at) + "</span>" : "Aprobada " + ago(m.decided_at) + "<span>Esperando pago</span>") :
            ago(m.last_contact) + "<span>" + esc([KIND[m.last_kind] || (m.last_kind ? m.last_kind : "Ingreso"), (m.last_team || []).join(", ")].filter(Boolean).join(" · ")) + "</span>";
          var old = m.kind !== "pending" && daysTo(m.last_contact) < -90;
          return '<a class="st-mrow" href="' + href + '"><div class="st-p"><div class="st-av">' + (m.photo_url ? '<img src="' + esc(m.photo_url) + '" alt="">' : esc(ini(m.name))) + '</div><div style="min-width:0"><b>' + esc(m.name) + "</b><span>" + esc([m.title, m.church, [m.city, m.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + '</span></div></div><div class="st-cr"><b>' + esc(m.credential_no || "—") + "</b><span>Cuenta " + esc(m.account_no || "—") + '</span></div><div class="st-vig' + (dt != null && dt <= 30 ? " warn" : "") + '">' + vig + '</div><div class="st-lc' + (old ? " old" : "") + '">' + lc + '</div><div><span class="st-pill ' + s[0] + '">' + s[1] + (m.renew_claimed_at ? " · pagó" : "") + '</span></div><div class="go">›</div></a>';
        }).join("") || '<div class="st-empty">No hay miembros aquí.</div>';
        var seg = [["all", "Todos"], ["active", "Activos"], ["pastor", "Pastores"], ["ministro", "Ministros"], ["expired", "Vencidos"]];
        put(hero("members", "Panel del equipo", "Miembros", "<span>Hola, " + esc(ST.me.name) + "</span>" + (ST.me.roles || []).map(function (x) { return '<span class="st-role">' + ROLE_N[x] + "</span>"; }).join(" ") + "<span>" + ov.members_total + " miembros · " + ov.members_active + " activos</span>") +
          body(tasksHTML() + '<div class="st-alerts">' + al.map(function (x) { return '<a class="st-al ' + cls[x[0]] + (filter === x[0] ? " on" : "") + '" href="#/staff/members/' + x[0] + '"><b>' + (x[2] || 0) + "</b><strong>" + x[1] + "</strong><span>" + x[3] + "</span></a>"; }).join("") + "</div>" +
            '<div class="st-bar"><div class="st-seg">' + seg.map(function (s) { return '<a class="' + (filter === s[0] ? "on" : "") + '" href="#/staff/members/' + s[0] + '">' + s[1] + "</a>"; }).join("") + '</div><form class="st-search" id="st-q">' + ico("search") + '<input name="q" value="' + esc(q) + '" placeholder="Buscar por nombre, iglesia, ciudad o número"></form></div>' +
            '<div class="st-table"><div class="st-mrow th"><div>Miembro</div><div>Credencial</div><div>Vigente hasta</div><div>Último contacto</div><div>Estado</div><div></div></div>' + rows + "</div>" + pager(r.total, page) +
            '<div class="st-foot"><div class="st-lock"><span>Al hacer clic en una alerta, la lista muestra solo esos miembros. <b>Último contacto</b> se actualiza cada vez que alguien del equipo anota un acompañamiento.</span></div></div>'));
        bindSearch("#/staff/members/" + filter + "/");
        $$(".st-pg button", ROOT).forEach(function (b) { b.onclick = function () { page = +b.dataset.p; load(); }; });
      });
    }
    return load();
  }

  function chips(name, list, sel, multi) {
    return '<div class="st-chips' + (multi ? " who" : "") + '" data-chips="' + name + '"' + (multi ? ' data-multi="1"' : "") + ">" + list.map(function (c) { return '<span data-v="' + esc(c[0]) + '" class="' + (sel.indexOf(c[0]) >= 0 ? "on" : "") + '">' + esc(c[1]) + "</span>"; }).join("") + "</div>";
  }
  function chipVals(name) { return $$('[data-chips="' + name + '"] span.on', ROOT).map(function (s) { return s.dataset.v; }); }
  function memDetail(kid) {
    loading("members", "Miembro");
    return rpc("staff_member", { p_member: kid }).then(function (m) {
      var s = M_ST[m.state_k] || ["no", m.state_k];
      var lastLog = (m.log || []).filter(function (x) { return x.src === "log"; })[0];
      var team = (ST.team || []).map(function (t) { return [t.name || t.email, t.name || t.email]; });
      var mine = ST.me.name;
      var form = '<div class="st-card st-new"><h3>Registrar acompañamiento <small>Toma 1 minuto</small></h3><div class="st-cb">' +
        '<div class="st-f"><small>Tipo</small>' + chips("kind", Object.keys(KIND).map(function (k) { return [k, k === "video" ? "Videollamada / Zoom" : k === "orient" ? "Orientación / estructura" : KIND[k]]; }), [], false) + "</div>" +
        '<div class="st-f"><small>A quién se apoyó</small>' + chips("who", [["pastor", "Pastor"], ["matrimonio", "Matrimonio"], ["familia", "Familia"], ["congregacion", "Congregación"]], [], true) + "</div>" +
        '<div class="st-row3" style="grid-template-columns:1fr 2fr"><div class="st-f"><small>Fecha</small><input type="date" class="st-in" id="lg-date" value="' + today() + '" max="' + today() + '"></div><div class="st-f"><small>¿Quién del equipo de KAI estuvo?</small>' + chips("team", team.concat([["+", "+ Otro"]]), [mine], true) + '<input class="st-in" id="lg-other" placeholder="Nombre de la otra persona" hidden style="margin-top:8px"></div></div>' +
        '<div class="st-f"><small>Resumen</small><textarea class="st-in" id="lg-sum" placeholder="¿Qué se hizo? ¿Cómo está el pastor, su familia o su iglesia?"></textarea></div>' +
        '<div class="st-row3" style="grid-template-columns:2fr 1fr 1fr"><div class="st-f"><small>Siguiente paso (opcional)</small><input class="st-in" id="lg-next" placeholder="Ej. Enviar la lista de documentos"></div><div class="st-f"><small>Para cuándo</small><input type="date" class="st-in" id="lg-due"></div><div class="st-f"><small>Quién</small><select class="st-in" id="lg-owner"><option value="">—</option>' + team.map(function (t) { return "<option>" + esc(t[0]) + "</option>"; }).join("") + "</select></div></div>" +
        '<div class="st-f"><small>Quién lo puede ver</small><div class="st-lvl" data-pick="lvl"><label class="on" data-v="g"><b>General</b><span>Lo ve todo el equipo.</span></label><label data-v="c"><b>Confidencial</b><span>Solo Cuidado pastoral. Los demás ven la fecha y que hubo contacto.</span></label></div></div>' +
        '<div class="ft"><span class="st-msg" id="lg-msg"></span><button class="btn gold" data-act="log">Guardar en el registro</button></div></div></div>';
      var whoN = { pastor: "Pastor", matrimonio: "Matrimonio", familia: "Familia", congregacion: "Congregación" };
      var entries = (m.log || []).map(function (x) {
        if (x.src === "event") {
          var t = x.kind === "decide" ? "Aprobada por el Presidente" : x.kind === "pay" ? (x.note || "Pago registrado") : x.kind === "print" ? x.note : x.kind === "renew_claim" ? "Indicó que envió su renovación por Zelle" : x.note;
          return '<div class="st-ent sys" data-who=""><div class="st-ico">✓</div><div><div class="st-eh"><b>' + esc(t) + "</b><time>" + fd(x.d) + '</time></div><div class="by">' + esc(x.actor || "") + "</div></div></div>";
        }
        var conf = x.conf && x.summary == null;
        return '<div class="st-ent' + (x.conf ? " conf" : "") + '" data-who="' + (x.who || []).join(" ") + '"' + (x.next_step && !x.next_done_at ? ' data-pend="1"' : "") + '><div class="st-ico">' + (x.conf ? "CONF." : esc((KIND[x.kind] || x.kind).toUpperCase().slice(0, 8))) + '</div><div><div class="st-eh"><b>' + (conf ? "Contacto confidencial · Cuidado pastoral" : esc(KIND[x.kind] || x.kind) + (x.conf ? " · confidencial" : "")) + "</b><time>" + fd(x.d) + '</time></div><div class="st-tags">' + (x.who || []).map(function (w) { return "<i>" + whoN[w] + "</i>"; }).join("") + "</div>" +
          (conf ? "<p>El contenido solo lo ve el equipo de Cuidado pastoral.</p>" : "<p>" + esc(x.summary) + "</p>") + '<div class="by">' + esc((x.team || []).join(", ") || x.author) + (x.author ? " · registró " + esc(x.author) : "") + "</div>" +
          (x.next_step ? '<div class="nx' + (x.next_done_at ? " done" : "") + '"><b>Siguiente paso:</b> ' + esc(x.next_step) + (x.next_due ? " · " + fd(x.next_due) : "") + (x.next_owner ? " · " + esc(x.next_owner) : "") + (x.next_done_at ? " · ✓ hecho" : ' <button class="st-mini sm" data-act="nextdone" data-id="' + x.id + '">Marcar hecho</button>') + "</div>" : "") + "</div></div>";
      }).join("") || '<div class="st-cb st-empty">Todavía no hay anotaciones. La primera puede ser una llamada de bienvenida.</div>';
      var nlog = (m.log || []).filter(function (x) { return x.src === "log"; }).length;
      var tl = '<div class="st-card"><h3>Registro de acompañamiento <small>' + nlog + (nlog === 1 ? ' anotación' : ' anotaciones') + '</small></h3><div class="st-tl-f"><span class="on" data-f="">Todo</span><span data-f="pastor">Pastor</span><span data-f="matrimonio">Matrimonio</span><span data-f="familia">Familia</span><span data-f="congregacion">Congregación</span><span data-f="pend">Pendientes</span></div><div id="st-tl">' + entries + "</div></div>";
      var canPay = has("admin", "treasury"), dt = daysTo(m.valid_through);
      var vs = M_ST[m.state_k === "print" ? "active" : m.state_k] || s;
      var cardM = '<div class="st-mc"><div class="hd"><span>Credencial</span><span class="st-mcst ' + vs[0] + '">' + vs[1] + '</span></div><div class="bd"><div class="mph">' + (m.photo_url ? '<img src="' + esc(m.photo_url) + '" alt="">' : esc(ini(m.name))) + "</div><div><small>" + esc(m.title || "") + "</small><b>" + esc(m.name) + "</b><span>" + esc([m.church, [m.city, m.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + "</span></div></div>" +
        "<dl><div><dt>Credencial</dt><dd>" + esc(m.credential_no || "—") + "</dd></div><div><dt>Cuenta</dt><dd>" + esc(m.account_no || "—") + "</dd></div><div><dt>Miembro desde</dt><dd>" + fd(m.member_since) + "</dd></div><div><dt>Vigente hasta</dt><dd>" + fd(m.valid_through) + (dt != null && dt <= 30 ? ' <em class="st-warn-t">' + (dt < 0 ? "vencida" : "vence en " + dt + " d") + "</em>" : "") + "</dd></div></dl>" +
        '<div class="acts"><a href="#" data-act="cred">Ver credencial</a>' + (canPay ? '<a href="#" data-act="renew">Registrar pago</a>' : "") + "</div>" + (m.renew_claimed_at ? '<p class="st-claimed">Indicó que envió su renovación por Zelle · ' + fd(m.renew_claimed_at) + "</p>" : "") + "</div>";
      var PS = { none: "—", to_print: "Por imprimir", printed: "Impresa", shipped: "Enviada" };
      var printBox = '<div class="st-card"><h3>Credencial impresa <small>' + PS[m.print_status] + "</small></h3><div class=\"st-cb\">" + (m.mail_address ? '<p class="st-addr"><small>Enviar a</small>' + esc(m.mail_address) + "</p>" : "") +
        (canPay ? '<div class="st-print">' + ["to_print", "printed", "shipped"].map(function (k) { return '<button class="' + (m.print_status === k ? "on" : "") + '" data-print="' + k + '">' + PS[k] + "</button>"; }).join("") + '</div><input class="st-in" id="st-track" placeholder="Número de rastreo (opcional)" value="' + esc(m.tracking || "") + '" style="margin-top:10px">' : "<p>" + (m.print_updated_at ? "Actualizado " + fd(m.print_updated_at) : "") + "</p>") + "</div></div>";
      var FS = { pending: ["p", "Pendiente"], in_progress: ["e", "En proceso"], done: ["d", "Atendido"] };
      var fu = (m.followups || []);
      var fuBox = '<div class="st-card"><h3>Pendientes <small>' + fu.filter(function (f) { return f.status !== "done"; }).length + '</small></h3><ul class="st-todo">' + (fu.map(function (f) {
        return '<li><b><span class="src">Parte B</span>' + esc(f.label) + "</b><span>" + esc(f.owner || "Sin asignar") + (f.note ? " · " + esc(f.note) : "") + '</span><select class="st-fu" data-id="' + f.id + '">' + Object.keys(FS).map(function (k) { return '<option value="' + k + '"' + (f.status === k ? " selected" : "") + ">" + FS[k][1] + "</option>"; }).join("") + '</select><select class="st-fuo" data-id="' + f.id + '"><option value="">Responsable…</option>' + team.map(function (t) { return "<option" + (f.owner === t[0] ? " selected" : "") + ">" + esc(t[0]) + "</option>"; }).join("") + "</select></li>";
      }).join("") || '<li><span>Sin pendientes de la aplicación.</span></li>') + "</ul></div>";
      var ap = m.application || {};
      var datos = '<div class="st-card"><h3>Datos</h3><div class="st-cb"><div class="st-kv two">' + kv("Correo", m.email) + kv("Teléfono", m.phone) + kv(ap.marital === "c" ? "Cónyuge" : "Estado civil", ap.spouse_name || "") + kv("Hijos", ap.children) +
        (ap.priorities && ap.priorities.length ? '<div class="w"><small>Prioridades al aplicar</small><p>' + ap.priorities.map(function (p, i) { return (i + 1) + ". " + esc(ben(p)); }).join(" · ") + "</p></div>" : "") +
        (ap.id && has("admin", "membership", "president", "care") ? '<div class="w"><a class="st-link" href="#/staff/app/' + ap.id + '">Ver aplicación ' + esc(ap.app_no) + " ›</a></div>" : "") + "</div></div></div>";
      var payH = (m.payments || []).length ? '<div class="st-card"><h3>Pagos</h3><ul class="st-todo">' + m.payments.map(function (p) { return "<li><b>$" + (+p.amount) + " · " + (p.kind === "new" ? "Ingreso" : "Renovación") + "</b><span>" + fd(p.paid_on) + (+p.amount === 0 ? " · Exento (board)" : " · Zelle") + (p.ref ? " " + esc(p.ref) : "") + " · " + esc(p.by) + "</span></li>"; }).join("") + "</ul></div>" : "";
      put('<div class="hero sm st-hero"><div class="wrap"><a class="st-back" href="#/staff/members">‹ Miembros</a><div class="st-dhead"><div><div class="eyebrow">Miembro · cuenta ' + esc(m.account_no || "—") + "</div><h1>" + esc(m.name) + '</h1><div class="st-who"><span>' + esc([m.title, m.church, [m.city, m.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + '</span></div></div><div class="st-dmeta"><span class="st-pill ' + s[0] + '">' + s[1] + '</span><span class="st-taken">Último contacto: <b>' + (lastLog ? ago(lastLog.d) : "sin registros") + "</b></span></div></div></div></div>" +
        body('<div class="st-dgrid"><div>' + form + tl + "</div><div>" + cardM + fuBox + printBox + datos + payH + "</div></div>"));
      bindMember(m);
    });
  }
  function bindMember(m) {
    $$("[data-chips]", ROOT).forEach(function (box) {
      $$("span", box).forEach(function (sp) {
        sp.onclick = function () {
          if (box.dataset.multi) sp.classList.toggle("on"); else $$("span", box).forEach(function (z) { z.classList.toggle("on", z === sp); });
          if (sp.dataset.v === "+") $("#lg-other", ROOT).hidden = !sp.classList.contains("on");
        };
      });
    });
    var lvl = $('[data-pick="lvl"]', ROOT); bindPick(lvl); lvl.dataset.val = "g";
    $$(".st-tl-f span", ROOT).forEach(function (f) {
      f.onclick = function () {
        $$(".st-tl-f span", ROOT).forEach(function (z) { z.classList.toggle("on", z === f); });
        $$("#st-tl .st-ent", ROOT).forEach(function (e) { var v = f.dataset.f; e.hidden = v === "pend" ? !e.dataset.pend : v ? (" " + e.dataset.who + " ").indexOf(" " + v + " ") < 0 : false; });
      };
    });
    on("log", function (b) {
      var kind = chipVals("kind")[0], who = chipVals("who"), team = chipVals("team").filter(function (t) { return t !== "+"; }), oth = $("#lg-other", ROOT).value.trim(), sum = $("#lg-sum", ROOT).value.trim(), msg = $("#lg-msg", ROOT);
      if (oth && chipVals("team").indexOf("+") >= 0) team.push(oth);
      if (!kind) return (msg.textContent = "Elija el tipo."); if (!who.length) return (msg.textContent = "Elija a quién se apoyó."); if (!sum) return (msg.textContent = "Escriba el resumen.");
      b.disabled = true;
      rpc("staff_log_add", { p_member: m.kid, p_kind: kind, p_who: who, p_team: team, p_on: $("#lg-date", ROOT).value || today(), p_summary: sum, p_next: $("#lg-next", ROOT).value.trim() || null, p_due: $("#lg-due", ROOT).value || null, p_owner: $("#lg-owner", ROOT).value || null, p_conf: lvl.dataset.val === "c" })
        .then(function () { toast("Guardado en el registro."); route(); }).catch(function (e) { b.disabled = false; msg.textContent = errMsg(e); });
    });
    on("nextdone", function (b) { rpc("staff_log_next_done", { p_id: +b.dataset.id }).then(route).catch(function (e) { toast(errMsg(e), true); }); });
    on("renew", function () { payModal({ member: m, name: m.name }); });
    on("cred", function () {
      var x = { full_name: m.name, title: m.title, credential_no: m.credential_no, valid_through: m.valid_through, member_since: m.member_since, church: m.church, city: m.city, state: m.state, photo_url: m.photo_url, verify_code: m.verify_code, status: m.state_k === "inactive" ? "inactive" : "active" };
      var c = window.KAI && window.KAI.cred ? window.KAI.cred(x) : null;
      if (!c) { window.open(SITE + "/#/verify/" + (m.verify_code || ""), "_blank"); return; }
      var ov = modal('<h3>Credencial · ' + esc(m.name) + '</h3><div class="bd"><div class="ctab"><button type="button" data-s="f" aria-pressed="true">Frente</button><button type="button" data-s="b" aria-pressed="false">Reverso</button></div><div class="cardv"><div class="kc" data-c="f">' + c.front + '</div><div class="kc" data-c="b" hidden>' + c.back + '</div></div><p class="st-small" style="margin-top:16px">Así la ve el miembro en su Área de Miembros. <a class="st-link" href="' + SITE + "/#/verify/" + esc(m.verify_code || "") + '" target="_blank" rel="noopener">Página de verificación del QR ›</a></p><div class="ft"><button class="btn navy" data-close>Cerrar</button></div></div>');
      ov.querySelector(".st-modal").style.maxWidth = "680px";
      $$(".ctab button", ov).forEach(function (b) { b.onclick = function () { $$(".ctab button", ov).forEach(function (z) { z.setAttribute("aria-pressed", z === b); }); $$("[data-c]", ov).forEach(function (k) { k.hidden = k.dataset.c !== b.dataset.s; }); }; });
    });
    $$("[data-print]", ROOT).forEach(function (b) { b.onclick = function () { rpc("staff_print_set", { p_member: m.kid, p_status: b.dataset.print, p_tracking: ($("#st-track", ROOT) || {}).value || null }).then(function () { toast("Credencial impresa: actualizado."); route(); }).catch(function (e) { toast(errMsg(e), true); }); }; });
    $$(".st-fu", ROOT).forEach(function (s) { s.onchange = function () { rpc("staff_followup_set", { p_id: +s.dataset.id, p_status: s.value }).then(function () { toast("Pendiente actualizado."); }).catch(function (e) { toast(errMsg(e), true); }); }; });
    $$(".st-fuo", ROOT).forEach(function (s) { s.onchange = function () { var st = $('.st-fu[data-id="' + s.dataset.id + '"]', ROOT).value; rpc("staff_followup_set", { p_id: +s.dataset.id, p_status: st === "pending" && s.value ? "in_progress" : st, p_owner: s.value }).then(route).catch(function (e) { toast(errMsg(e), true); }); }; });
  }

  /* ---------- Registrar pago (nuevo miembro o renovación) ---------- */
  function modal(html) {
    var ov = document.createElement("div"); ov.className = "st-ov"; ov.innerHTML = '<div class="st-modal" role="dialog" aria-modal="true">' + html + "</div>";
    document.body.appendChild(ov); ov.addEventListener("click", function (e) { if (e.target === ov || e.target.closest("[data-close]")) ov.remove(); });
    return ov;
  }
  function payModal(o) {
    var isNew = !!o.app, a = o.app || {}, m = o.member || {}, fee = isNew ? a.fee : (m.tier === "ministro" ? 75 : 100);
    var d = a.data || {}, addr = isNew ? [d.address, a.city, [a.state, d.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") : (m.mail_address || "");
    var ov = modal('<h3>Registrar pago · ' + (isNew ? "nuevo miembro" : "renovación") + '</h3><div class="bd"><p style="margin:0 0 14px"><b>' + esc(o.name) + "</b> · cuenta " + esc(isNew ? a.app_no : m.account_no || "—") + "</p>" +
      '<div class="st-row3"><div class="st-f"><small>Monto</small><input class="st-in" id="py-amt" type="number" min="1" step="1" value="' + fee + '"></div><div class="st-f"><small>Fecha en que llegó</small><input class="st-in" id="py-date" type="date" value="' + today() + '" max="' + today() + '"></div><div class="st-f"><small>Forma de pago</small><input class="st-in" value="Zelle" disabled></div></div>' +
      (isNew ? '<p style="margin:0 0 12px;font-size:13.5px">Credencial que se asignará: <b>' + (a.board ? esc(a.board.cred_no) + "</b> · número reservado del Board" : esc(a.cred_next || "PA") + "-" + new Date().getFullYear() + "-…</b> · siguiente número según el título") + "</p>" : "") +
      '<label class="st-exempt"><input type="checkbox" id="py-ex"> <span><b>Exento de cuota</b> · miembro del board (se registra en $0)</span></label>' +
      '<div class="st-f" style="margin-top:12px"><small>Número de confirmación de Zelle (opcional)</small><input class="st-in" id="py-ref"></div>' +
      (isNew ? '<div class="st-f" style="margin-top:12px"><small>Dirección para enviar la credencial impresa</small><input class="st-in" id="py-addr" value="' + esc(addr) + '"></div>' : "") +
      '<div class="st-f" style="margin-top:12px"><small>Nota (opcional)</small><input class="st-in" id="py-note"></div>' +
      '<ul style="margin:16px 0">' + (isNew ? "<li>Se crea su credencial con código QR, vigente por un año.</li><li>Se le envía el correo para crear su contraseña y ver su credencial.</li><li>Pasa a la lista de credenciales por imprimir.</li>" : "<li>Su credencial se renueva por un año desde su vencimiento actual (" + fd(m.valid_through) + ").</li><li>Pasa a la lista de credenciales por imprimir.</li>") + "</ul>" +
      '<p class="st-msg" id="py-msg"></p><div class="ft"><button class="btn navy" data-close>Cancelar</button><button class="btn gold" id="py-go">Confirmar pago' + (isNew ? " y activar" : "") + "</button></div></div>");
    var go = $("#py-go", ov), msg = $("#py-msg", ov), armed = false, ex = $("#py-ex", ov);
    ex.onchange = function () { $("#py-amt", ov).value = ex.checked ? 0 : fee; $("#py-amt", ov).disabled = ex.checked; $("#py-ref", ov).disabled = ex.checked; armed = false; go.textContent = ex.checked ? "Confirmar exención y activar" : "Confirmar pago" + (isNew ? " y activar" : ""); };
    if (isNew ? a.board : /^K[A-Z]-/.test(m.credential_no || "")) { ex.checked = true; ex.onchange(); }   // Board: exento (nuevo y renovación)
    go.onclick = function () {
      var amt = +$("#py-amt", ov).value, date = $("#py-date", ov).value, exempt = ex.checked;
      if ((!amt && !exempt) || !date) return (msg.textContent = "Revise el monto y la fecha.");
      if (!armed) { armed = true; go.textContent = exempt ? "Sí, confirmar: exento (board)" : "Sí, confirmar: llegó $" + amt; msg.textContent = exempt ? "Confirme que es miembro del board y no paga cuota." : "Confirme que el pago ya está en la cuenta de KAI."; return; }
      go.disabled = true; msg.textContent = "Guardando…";
      rpc("staff_pay_confirm", { p_app: isNew ? a.id : null, p_member: isNew ? null : m.kid, p_amount: amt, p_paid_on: date, p_ref: $("#py-ref", ov).value.trim() || null, p_note: $("#py-note", ov).value.trim() || null, p_address: isNew ? $("#py-addr", ov).value.trim() || null : null, p_method: exempt ? "exempt" : "zelle" })
        .then(function (r) { if (!r.new) { ov.remove(); toast("Renovación registrada."); route(); return; } return activate(r, ov); })
        .catch(function (e) { go.disabled = false; armed = false; go.textContent = "Confirmar pago y activar"; msg.textContent = errMsg(e); });
    };
  }
  function activate(r, ov) {
    var c = sb(), steps = [], msg = $("#py-msg", ov);
    msg.textContent = "Pago guardado. Preparando la credencial…";
    var photoP = r.photo ? c.storage.from(BUCKET).download(r.photo).then(function (d) {
      if (d.error) throw d.error; var ext = /png/.test(d.data.type) ? "png" : "jpg", name = r.credential_no + "." + ext;
      return c.storage.from(PHOTOS).upload(name, d.data, { contentType: d.data.type || "image/jpeg", upsert: false }).then(function (u) {
        if (u.error && !/exists|Duplicate/i.test(u.error.message || "")) throw u.error;
        var url = c.storage.from(PHOTOS).getPublicUrl(name).data.publicUrl;
        return rpc("staff_member_photo", { p_member: r.kid, p_url: url });
      });
    }).then(function () { steps.push("✓ Foto copiada a la credencial"); }).catch(function () { steps.push("✗ No se pudo copiar la foto: súbala desde Supabase"); }) : Promise.resolve(r.existing ? 0 : steps.push("· No había foto"));
    if (r.existing) steps.push("✓ Ya tenía credencial: se conservó su número y se vinculó la aplicación");
    return photoP.then(function () {
      if (r.existing) return;
      return c.functions.invoke("kai-invite", { body: { email: r.email, redirect: SITE + "/#/password" } }).then(function (x) {
        if (x.error) throw x.error; steps.push("✓ Invitación enviada a " + r.email);
      }).catch(function () { steps.push("✗ No se pudo enviar la invitación. Envíela desde Supabase → Authentication → Users → Invite, al correo " + r.email); });
    }).then(function () {
      $(".bd", ov).innerHTML = '<p style="margin:0 0 6px"><b>Credencial ' + esc(r.credential_no) + " activada</b>, vigente hasta " + fd(r.valid_to) + '.</p><ul style="margin:12px 0 18px;list-style:none;padding:0">' + steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ul><div class="ft"><a class="btn gold" href="#/staff/member/' + r.kid + '" data-close>Ver perfil del miembro</a></div>';
    });
  }

  /* ---------- 5) Necesidades (Parte B) ---------- */
  function needs() {
    loading("needs", "Necesidades");
    return rpc("staff_needs").then(function (n) {
      function bars(title, obj, labelFn, total) {
        var k = Object.keys(obj || {}).sort(function (a, b) { return obj[b] - obj[a]; }); if (!k.length) return "";
        var mx = Math.max.apply(null, k.map(function (x) { return obj[x]; }));
        return '<div class="st-card"><h3>' + title + "</h3><div class=\"st-cb st-bars\">" + k.map(function (x) { return '<div><span>' + esc(labelFn(x)) + '</span><i style="--w:' + Math.round(obj[x] / mx * 100) + '%"></i><b>' + obj[x] + (total ? " · " + Math.round(obj[x] / total * 100) + "%" : "") + "</b></div>"; }).join("") + "</div></div>";
      }
      var fo = findF("B", "orient"), fw = findF("B", "ws_topics"), fs = findF("B", "season");
      put(hero("needs", "Panel del equipo", "Necesidades de los pastores") + body(
        '<div class="st-stats"><div class="st-stat hl"><small>Aplicaciones</small><b>' + n.total + '</b><span>Respondieron la Parte B</span></div><div class="st-stat"><small>Quieren un taller</small><b>' + n.ws_yes + '</b><span>En su iglesia o región</span></div><div class="st-stat"><small>Instituto Morphe</small><b>' + n.morphe + '</b><span>Pidieron que los contacten</span></div><div class="st-stat"><small>Orientación legal</small><b>' + Object.keys(n.orient || {}).reduce(function (s, k) { return s + n.orient[k]; }, 0) + "</b><span>Solicitudes de orientación</span></div></div>" +
        '<div class="st-ngrid">' + bars("Prioridades elegidas (top 3)", n.priorities, ben, n.total) + bars("Orientación que piden", n.orient, function (x) { return fo ? opt(fo, x) : x; }) + bars("Temas para talleres", n.ws_topics, function (x) { return fw ? opt(fw, x) : x; }) + bars("¿Cómo describen su temporada?", n.season, function (x) { return fs ? opt(fs, x) : x; }) + "</div>"));
    });
  }

  /* ---------- 6) Cuidado pastoral (Parte C) ---------- */
  var FLAG = { contact: ["c", "Pidió contacto"], burnout: ["r", "Agotamiento"], loss: ["r", "Duelo"], lonely: ["r", "Soledad"], marriage: ["r", "Matrimonio"], conflict: ["r", "Conflicto"], finance: ["f", "Finanzas"] };
  function care(id) {
    loading("care", "Cuidado pastoral");
    return rpc("care_list").then(function (list) {
      var sel = id || (list[0] && list[0].id);
      var cnt = function (f) { return list.filter(function (x) { return (x.flags || []).indexOf(f) >= 0; }).length; };
      var alert = cnt("burnout") + cnt("loss") + cnt("lonely") + cnt("marriage") + cnt("conflict");
      var lst = '<div class="st-clist"><h3>Requieren atención · ' + list.length + "</h3>" + (list.map(function (x) {
        return '<a class="st-ci' + (x.id === sel ? " on" : "") + '" href="#/staff/care/' + x.id + '"><div class="st-av">' + esc(ini(x.name)) + "</div><div><b>" + esc(x.name) + "</b><span>" + (x.member_kid ? "Miembro · " : "Aplicación · ") + esc(x.app_no) + (x.owner ? " · " + esc(x.owner) : " · sin asignar") + '</span><div class="fl">' + (x.flags || []).map(function (f) { return '<i class="' + FLAG[f][0] + '">' + FLAG[f][1] + "</i>"; }).join("") + "</div></div></a>";
      }).join("") || '<div class="st-cb st-empty">Nadie requiere atención por ahora.</div>') + "</div>";
      var head = hero("care", "Panel del equipo", "Cuidado pastoral", "<span>Hola, " + esc(ST.me.name) + '</span><span class="st-role">Cuidado pastoral</span><span>Confidencial · solo su equipo ve esta sección</span>');
      var alerts = '<div class="st-alerts" style="margin-bottom:22px"><div class="st-al cnt on"><b>' + cnt("contact") + '</b><strong>Pidieron contacto</strong><span>Querían que alguien los llamara</span></div><div class="st-al ren"><b>' + alert + '</b><strong>Señales de alerta</strong><span>Agotamiento, duelo, soledad o conflicto</span></div><div class="st-al pay"><b>' + cnt("finance") + '</b><strong>Consultas financieras</strong><span>Autorizaron contacto con asesores</span></div><div class="st-al prt"><b>' + list.filter(function (x) { return !x.owner; }).length + "</b><strong>Sin asignar</strong><span>Nadie ha tomado el caso</span></div></div>";
      if (!sel) { put(head + body(alerts + lst)); return; }
      return rpc("care_detail", { p_id: sel }).then(function (c) {
        put(head + body(alerts + '<div class="st-cgrid"><div>' + lst + "</div><div>" + careDetail(c) + "</div></div>"));
        bindCare(c);
      });
    });
  }
  function dots(v, bad) { v = +v || 0; var o = ""; for (var i = 1; i <= 5; i++) o += '<i class="' + (i <= v ? "on" : "") + '"></i>'; return '<div class="st-dots ' + (v >= 4 ? "lo" : v === 3 ? "md" : "") + '">' + o + "</div>"; }
  function careDetail(c) {
    var d = c.care || {};
    var ind = [["Salud espiritual", "spirit"], ["Salud física y emocional", "health"], ["Matrimonio", "marriage"]].filter(function (x) { return d[x[1]]; }).map(function (x) { var f = findF("C", x[1]); return "<div><small>" + x[0] + "</small>" + dots(d[x[1]]) + "<span><b>" + d[x[1]] + " de 5</b> · " + (f ? "1 = " + f.sc[0][0] + ", 5 = " + f.sc[1][0] : "") + "</span></div>"; }).join("");
    var secs = SC.C.map(function (s) { var h = secHTML(s, d); return h ? '<div class="st-card"><h3>' + esc(s.t[0]) + ' <small>Parte C</small></h3>' + h.replace('<div class="st-sec"><h4>' + esc(s.t[0]) + "</h4>", '<div class="st-sec">') + "</div>" : ""; }).join("");
    var notes = (c.notes || []).map(function (n) { var t = { care_take: "tomó el caso", care_note: "· nota", care_pdf: "descargó la Parte C en PDF", care_closed: "cerró el caso" }[n.kind] || n.kind; return '<li class="' + (n.kind === "care_note" ? "note" : "sys") + '"><b>' + esc(n.actor || "") + " " + t + "</b><time>" + fdt(n.at) + "</time>" + (n.kind === "care_note" || n.kind === "care_closed" ? "<p>" + esc(n.note || "") + "</p>" : "") + "</li>"; }).join("");
    return '<div class="st-card"><h3>' + esc(c.name) + ' <span class="st-pdfb">' + (c.owner ? "" : '<button class="st-mini" data-act="take">Tomar el caso</button>') + '<button class="btn gold" data-act="pdf">Descargar Parte C (PDF)</button></span></h3><div class="st-cb"><p class="st-subline">' + esc([c.title, c.church, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + " · Respondió el " + fd(c.created_at) + " al aplicar" + (c.owner ? " · Lleva el caso: <b>" + esc(c.owner) + "</b>" : "") + '</p><div class="st-kv" style="margin-bottom:18px">' + kv("Teléfono", c.phone) + kv("Correo", c.email) + kv("Cónyuge", c.spouse_name) + "</div>" + (ind ? '<div class="st-ind">' + ind + "</div>" : "") + "</div></div>" + secs +
      '<div class="st-card"><h3>Notas confidenciales <small>Solo Cuidado pastoral</small></h3><ul class="st-log">' + (notes || '<li class="sys"><b>Sin notas todavía</b></li>') + '</ul><div class="st-add"><textarea id="cn-note" placeholder="Agregar una nota confidencial…"></textarea><div><span>Solo la ve Cuidado pastoral. No se puede editar ni borrar.</span><span><button class="st-mini" data-act="close">Cerrar caso</button> <button class="st-mini solid" data-act="cnote">Agregar nota</button></span></div></div></div>';
  }
  function bindCare(c) {
    function act(a, note, b) { if (b) b.disabled = true; return rpc("care_act", { p_id: c.id, p_act: a, p_note: note || null }).then(function () { if (a !== "pdf") route(); }).catch(function (e) { if (b) b.disabled = false; toast(errMsg(e), true); }); }
    on("take", function (b) { act("take", null, b); });
    on("cnote", function (b) { var n = $("#cn-note", ROOT).value.trim(); if (!n) return toast("Escriba la nota.", true); act("note", n, b); });
    on("close", function (b) { var n = $("#cn-note", ROOT).value.trim(); if (!confirmInline(b, "¿Cerrar el caso? Sale de la lista.")) return; act("close", n || "Caso atendido", b); });
    on("pdf", function () { carePdf(c, act); });
  }
  function confirmInline(b, q) { if (b.dataset.armed) return true; b.dataset.armed = "1"; b.textContent = "Sí, cerrar"; toast(q); return false; }
  function pw() { var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", o = "", r = new Uint32Array(9); crypto.getRandomValues(r); for (var i = 0; i < 9; i++) { o += A[r[i] % A.length]; if (i === 2 || i === 5) o += "-"; } return o; }
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function loadPdf() { if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve(); return loadScript(PDFLIB[0]).then(function () { return loadScript(PDFLIB[1]); }); }
  function carePdf(c, act) {
    var pass = pw(), when = fdt(new Date().toISOString()), wm = "CONFIDENCIAL · DESCARGADO POR " + (ST.me.name || "").toUpperCase() + " · " + when.toUpperCase();
    var ov = modal('<h3>Descargar Parte C · Confidencial</h3><div class="bd"><p style="margin:0">Se descargará un PDF con las respuestas de la Parte C de <b>' + esc(c.name) + '</b>. Para abrirlo se necesita esta contraseña:</p><div class="st-pw"><div><small>Contraseña del PDF</small><b>' + pass + '</b></div><button type="button" id="pw-copy">Copiar</button></div><div class="st-wm">Cada página llevará la marca de agua: <b>' + esc("Confidencial · descargado por " + ST.me.name + " · " + when) + '</b></div><ul><li>La contraseña se muestra solo esta vez; no la envíe en el mismo correo o mensaje que el PDF.</li><li>La descarga queda registrada en el historial del pastor.</li><li>Borre el archivo cuando ya no lo necesite.</li></ul><p class="st-msg" id="pw-msg"></p><div class="ft"><button class="btn navy" data-close>Cancelar</button><button class="btn gold" id="pw-go">Descargar PDF</button></div></div>');
    $("#pw-copy", ov).onclick = function () { try { navigator.clipboard.writeText(pass); this.textContent = "Copiada"; } catch (e) {} };
    $("#pw-go", ov).onclick = function () {
      var b = this; b.disabled = true; $("#pw-msg", ov).textContent = "Preparando…";
      loadPdf().then(function () {
        var d = c.care || {}, content = [{ text: "Cuidado pastoral · Parte C", fontSize: 9, bold: true, color: "#b8892e", characterSpacing: 1.2 }, { text: c.name, fontSize: 18, bold: true, color: "#0b1f4b", margin: [0, 2, 0, 2] }, { text: [c.title, c.church, [c.city, c.state].filter(Boolean).join(", "), "Aplicación " + c.app_no, "Respondió el " + fd(c.created_at)].filter(Boolean).join(" · "), fontSize: 9, color: "#5b6577", margin: [0, 0, 0, 12] }];
        SC.C.forEach(function (s) {
          var rows = []; s.f.forEach(function (f) { if (!f.k || !shown(f, d)) return; var v = fval(f, d); if (v) rows.push([{ text: lbl(f).toUpperCase(), fontSize: 7, bold: true, color: "#b8892e" }, { text: v, fontSize: 10 }]); });
          if (!rows.length) return;
          content.push({ text: s.t[0].toUpperCase(), fontSize: 9, bold: true, color: "#0b1f4b", margin: [0, 10, 0, 4] });
          content.push({ table: { widths: [150, "*"], body: rows }, layout: { hLineColor: function () { return "#e2e8f1"; }, vLineWidth: function () { return 0; }, hLineWidth: function () { return 0.6; }, paddingTop: function () { return 4; }, paddingBottom: function () { return 4; } } });
        });
        if ((c.notes || []).some(function (n) { return n.kind === "care_note"; })) { content.push({ text: "NOTAS CONFIDENCIALES", fontSize: 9, bold: true, color: "#0b1f4b", margin: [0, 14, 0, 4] }); c.notes.filter(function (n) { return n.kind === "care_note"; }).forEach(function (n) { content.push({ text: [{ text: (n.actor || "") + " · " + fdt(n.at) + "\n", fontSize: 8, color: "#5b6577" }, { text: n.note || "", fontSize: 10 }], margin: [0, 0, 0, 6] }); }); }
        var dd = { pageSize: "LETTER", pageMargins: [48, 60, 48, 50], version: "1.7", userPassword: pass, ownerPassword: pw() + pw(), permissions: { printing: "highResolution", modifying: false, copying: false, annotating: false },
          watermark: { text: "CONFIDENCIAL", color: "#b42318", opacity: 0.08, bold: true },
          header: { text: wm, alignment: "center", fontSize: 7.5, color: "#b42318", margin: [0, 24, 0, 0], characterSpacing: 0.6 },
          footer: function (p, n) { return { text: "Kingdom Alliance International · Confidencial · Página " + p + " de " + n, alignment: "center", fontSize: 7.5, color: "#5b6577", margin: [0, 16, 0, 0] }; },
          info: { title: "Parte C · " + c.app_no, author: "Kingdom Alliance International" }, content: content, defaultStyle: { fontSize: 10, color: "#101828" } };
        window.pdfMake.createPdf(dd).download("KAI-ParteC-" + c.app_no + ".pdf");
        return act("pdf");
      }).then(function () { $("#pw-msg", ov).textContent = "Listo. La descarga quedó registrada."; b.textContent = "Descargado"; })
        .catch(function (e) { b.disabled = false; $("#pw-msg", ov).textContent = errMsg(e); });
    };
  }

  /* ---------- Página pública de pago (#/pago/TOKEN) ---------- */
  function payPage(token) {
    put('<div class="hero sm st-hero"><div class="wrap"><div class="eyebrow">' + xx("Membresía KAI", "KAI Membership") + "</div><h1>" + xx("Pago de su cuota", "Membership fee") + '</h1><div style="height:40px"></div></div></div>' + body('<p class="st-wait">' + xx("Cargando…", "Loading…") + "</p>"));
    var c = sb(); if (!c) return;
    c.rpc("kai_pay_info", { p_token: token }).then(function (r) {
      var i = r.data;
      if (r.error || !i) { put(hero0(xx("Enlace no válido", "Invalid link"), xx("Revise el enlace de su correo o escríbanos a info@kaie44.org.", "Please check the link in your email or write to info@kaie44.org."))); return; }
      var done = i.paid ? xx("¡Su pago ya fue confirmado! Revise su correo para crear su contraseña.", "Your payment has been confirmed! Check your email to create your password.") : i.claimed ? xx("Gracias. Ya nos avisó que envió su pago; lo confirmaremos en los próximos días.", "Thank you. You already told us you sent your payment; we will confirm it in the next few days.") : "";
      put('<div class="hero sm st-hero"><div class="wrap"><div class="eyebrow">' + xx("Cuenta", "Account") + " " + esc(i.app_no) + "</div><h1>" + xx("Pago de su cuota", "Membership fee") + '</h1><div class="st-who"><span>' + esc(i.name) + '</span></div><div style="height:40px"></div></div></div>' +
        body('<div class="st-paybox"><div class="st-card"><div class="st-cb"><div class="st-amt"><small>' + xx("Cuota anual", "Annual fee") + "</small><b>$" + i.amount + "</b><span>" + (i.tier === "ministro" ? xx("Ministro", "Minister") : "Pastor") + "</span></div>" +
          '<ol class="st-steps"><li>' + xx("Entre a la app de su banco y elija <b>Zelle</b>.", "Open your bank app and choose <b>Zelle</b>.") + "</li><li>" + xx("Envíe", "Send") + " <b>$" + i.amount + "</b> " + xx("a", "to") + ": <b>" + esc(i.zelle_to || xx("(le enviaremos el dato por correo)", "(we will email it to you)")) + "</b>" + (i.zelle_name ? "<br><small>" + xx("Aparecerá como", "It will show as") + ": " + esc(i.zelle_name) + "</small>" : "") + "</li><li>" + xx("En la nota escriba", "In the memo write") + ": <b>" + esc(i.app_no + " " + i.name) + "</b></li><li>" + xx("Cuando lo haya enviado, avísenos aquí:", "Once you have sent it, let us know here:") + "</li></ol>" +
          (done ? '<p class="st-okmsg">' + done + "</p>" : '<button class="btn gold" id="pay-claim">' + xx("Ya envié mi pago por Zelle", "I sent my payment by Zelle") + "</button>") +
          '<p class="st-small">' + xx("Al confirmar su pago recibirá un correo para crear su contraseña y ver su credencial digital. Su credencial impresa llegará en 1 a 2 semanas.", "Once we confirm your payment you will receive an email to create your password and see your digital credential. Your printed credential will arrive in 1 to 2 weeks.") + "</p></div></div></div>"));
      var b = $("#pay-claim", ROOT); if (b) b.onclick = function () { b.disabled = true; c.rpc("kai_pay_claim", { p_token: token }).then(function () { payPage(token); }); };
    });
  }

  /* ---------- Área de Miembros: botón del panel, renovación y credencial impresa ---------- */
  function memberArea() {
    var c = sb(); if (!c) return;
    c.auth.getSession().then(function (r) {
      $$(".kx-staffbtn").forEach(function (b) { b.remove(); }); var old = $("#kx-mbox"); if (old) old.remove();
      if (!r.data || !r.data.session) return;
      c.rpc("staff_me").then(function (x) {
        if (x.data && x.data.roles && x.data.roles.length) {
          var btn = '<a class="btn gold kx-staffbtn" href="#/staff">' + xx("Panel del equipo", "Team panel") + "</a>";
          var out = $("#m-in .mhead .m-out");
          if (out && !$("#m-in .kx-staffbtn")) { if (!out.parentNode.classList.contains("kx-acts")) { var w = document.createElement("div"); w.className = "kx-acts"; out.parentNode.insertBefore(w, out); w.appendChild(out); } out.insertAdjacentHTML("beforebegin", btn); }
          var nf = $("#m-none .form"); if (nf && !$(".kx-staffbtn", nf)) {
            var h3 = $("h3", nf), p = $("p.sub", nf);
            if (h3) { h3.removeAttribute("data-i"); h3.textContent = xx("Todavía no tienes credencial de miembro", "You don't have a member credential yet"); }
            if (p) { p.removeAttribute("data-i"); p.textContent = xx("Tu cuenta del equipo ya está activa. Cuando llenes tu aplicación y quede aprobada, tu credencial aparecerá aquí.", "Your team account is active. Once you fill out your application and it is approved, your credential will appear here."); }
            nf.insertAdjacentHTML("beforeend", '<div class="kx-acts" style="margin-top:14px">' + btn + '<a class="btn navy" href="#/apply">' + xx("Llenar mi aplicación", "Fill out my application") + "</a></div>");
          }
        }
      });
      c.rpc("member_renew_info").then(function (x) {
        var i = x.data; if (!i) return; var dt = daysTo(i.valid_through), html = "";
        if (dt != null && dt <= 30) {
          html = '<div class="kx-renew' + (dt < 0 ? " exp" : "") + '"><div><b>' + (dt < 0 ? xx("Su membresía venció el ", "Your membership expired on ") : xx("Su membresía vence el ", "Your membership expires on ")) + fd(i.valid_through) + "</b><p>" +
            (i.claimed ? xx("Gracias, ya nos avisó que envió su renovación. La confirmaremos pronto.", "Thank you, you told us you sent your renewal. We will confirm it soon.") :
              xx("Renueve enviando", "Renew by sending") + " <b>$" + i.amount + "</b> " + xx("por Zelle a", "by Zelle to") + " <b>" + esc(i.zelle_to || "info@kaie44.org") + "</b>. " + xx("En la nota escriba su número de cuenta", "In the memo write your account number") + (i.account_no ? " (" + esc(i.account_no) + ")" : "") + ".") + "</p></div>" +
            (i.claimed ? "" : '<button class="btn gold" id="kx-renew">' + xx("Ya envié mi pago", "I sent my payment") + "</button>") + "</div>";
        } else if (i.print_status === "to_print" || i.print_status === "printed") {
          html = '<div class="kx-renew info"><div><b>' + xx("Su credencial impresa está en proceso", "Your printed credential is on its way") + "</b><p>" + xx("La recibirá en 1 a 2 semanas. Mientras tanto puede usar su credencial digital.", "You will receive it in 1 to 2 weeks. Meanwhile, you can use your digital credential.") + "</p></div></div>";
        } else if (i.print_status === "shipped" && daysTo(i.print_updated_at) > -30) {
          html = '<div class="kx-renew info"><div><b>' + xx("Su credencial impresa fue enviada el ", "Your printed credential was mailed on ") + fd(i.print_updated_at) + "</b></div></div>";
        }
        if (!html) return; var p = $("#m-in .portal"); if (!p) return;
        p.insertAdjacentHTML("beforebegin", '<div id="kx-mbox">' + html + "</div>");
        var b = $("#kx-renew"); if (b) b.onclick = function () { b.disabled = true; c.rpc("member_renew_claim").then(memberArea); };
      });
    });
  }

  /* ---------- enganche con el sitio ---------- */
  function evInit() { if (window.KAIEVP && !evInit.done) { evInit.done = 1; KAIEVP.init({ esc: esc, rpc: rpc, put: put, hero: hero, hero0: hero0, body: body, loading: loading, modal: modal, toast: toast, errMsg: errMsg, has: has, denied: denied, sb: sb }); } }
  setTimeout(evInit, 0); document.addEventListener("DOMContentLoaded", evInit);
  window.KAISTAFF = {
    view: function (v) {
      ST.view = v;
      if (v === "staff") route();
      else if (v === "membership") setTimeout(memberArea, 300);
    }
  };
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest('[data-act="task"]'); if (!t) return;
    e.preventDefault(); t.disabled = true; rpc("staff_task_done", { p_id: +t.dataset.id }).then(route).catch(function (er) { toast(errMsg(er), true); });
  });
  document.addEventListener("DOMContentLoaded", function () {
    var c = sb(); if (c) c.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_IN" && ST.view === "membership") setTimeout(memberArea, 400); if (ev === "SIGNED_OUT") { ST.me = null; ST.team = null; } });
  });
})();
