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
  function li() { return lang() === "en" ? 1 : 0; }
  /* Textos que guarda la base de datos en español (tareas y pendientes): se muestran en inglés si el panel está en inglés. */
  var DBT = { "Entrevista registrada": "Interview recorded", "Entrevista actualizada": "Interview updated", "Instituto Morphe: contactarlo": "Instituto Morphe: contact them", "Incorporación o asuntos legales": "Incorporation or legal matters", "Finanzas de la iglesia": "Church finances", "Finanzas personales y retiro": "Personal finances and retirement", "Ministerio de jóvenes": "Youth ministry", "Matrimonio y familia": "Marriage and family", "Cuidado pastoral o consejería": "Pastoral care or counseling", "Mentoría pastoral": "Pastoral mentoring", "Formación de liderazgo": "Leadership training", "Compañerismo y conexión": "Fellowship & connection",
    "Conferencias y actividades regionales": "Regional conferences and activities", "Recursos ministeriales": "Ministry resources", "Licencias y credenciales": "Licenses & credentials",
    "Conferencia anual": "Annual conference", "Cuidado pastoral": "Pastoral care", "Credenciales para su equipo": "Credentials for their team",
    "Instituto Morphe: contactarlo": "Instituto Morphe: contact them", "Taller local en su iglesia": "Local workshop at their church",
    "Credencial impresa": "Credential printed", "Credencial por imprimir": "Credential to print", "Descargó la Parte C en PDF": "Downloaded Part C as PDF", "Caso atendido": "Case closed",
    "incorporar la iglesia": "incorporate the church", "estatutos y junta": "bylaws and board", "estructurar ministerios": "structure ministries", "cumplimiento anual": "annual compliance" };
  function dbt(s) {
    s = String(s == null ? "" : s); if (lang() !== "en") return s; if (DBT[s]) return DBT[s];
    var m;
    if ((m = /^Llamar a (.+) para darle la bienvenida y enviarle las instrucciones de pago$/.exec(s))) return "Call " + m[1] + " to welcome them and send the payment instructions";
    if ((m = /^Llamar a (.+) para comunicarle la decisión$/.exec(s))) return "Call " + m[1] + " to share the decision";
    if ((m = /^El presidente devolvió la aplicación de (.+): revise su nota$/.exec(s))) return "The president returned " + m[1] + "'s application: review the note";
    if ((m = /^Imprimir y enviar la credencial (.+)$/.exec(s))) return "Print and mail credential " + m[1];
    if ((m = /^(Pago confirmado|Exento de cuota \(board\)) · credencial (\S+)( \(ya existente\) vinculada| activada)$/.exec(s))) return (m[1] === "Pago confirmado" ? "Payment confirmed" : "Fee exempt (board)") + " · credential " + m[2] + (m[3] === " activada" ? " activated" : " (existing) linked");
    if ((m = /^Credencial enviada(.*)$/.exec(s))) return "Credential mailed" + m[1];
    if ((m = /^Foto de credencial cambiada · (.+)$/.exec(s))) return "Credential photo changed · " + ({ "sin reimprimir": "no reprint", "reimpresión $25 por cobrar": "reprint, $25 to collect", "reimpresión sin costo": "reprint at no cost" }[m[1]] || m[1]);
    if ((m = /^Cobrar \$25 de reimpresión · credencial (.*)$/.exec(s))) return "Collect $25 for reprint · credential " + m[1];
    if ((m = /^Orientación: (.+)$/.exec(s))) return "Guidance: " + m[1].split(", ").map(function (x) { return DBT[x] || x; }).join(", ");
    return s;
  }
  /* Textos fijos (al cargar) que cambian con el idioma: se convierten en texto al usarse. */
  var LZP = { toString: function () { return xx(this.es, this.en); }, valueOf: function () { return this.toString(); } };
  ["toUpperCase", "toLowerCase", "slice", "indexOf", "replace", "split", "trim", "charAt"].forEach(function (m) { LZP[m] = function () { var s = this.toString(); return s[m].apply(s, arguments); }; });
  function LZ(es, en) { var o = Object.create(LZP); o.es = es; o.en = en; return o; }
  var MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], MEN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function d8(s) { if (!s) return null; var str = String(s); var d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + "T12:00:00") : new Date(str); return isNaN(d) ? null : d; }
  function fd(s) { var d = d8(s); return d ? (lang() === "en" ? MEN[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() : d.getDate() + " " + MES[d.getMonth()] + " " + d.getFullYear()) : "—"; }
  function fdt(s) { var d = d8(s); if (!d) return ""; var h = d.getHours(), m = d.getMinutes(); return fd(s) + " · " + ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " a.m." : " p.m."); }
  function ago(s) {
    var d = d8(s); if (!d) return ""; var days = Math.floor((Date.now() - d.getTime()) / 864e5);
    if (days < 1) { var h = Math.floor((Date.now() - d.getTime()) / 36e5); return h < 1 ? xx("hace un momento", "just now") : xx("hace " + h + (h === 1 ? " hora" : " horas"), h + (h === 1 ? " hour ago" : " hours ago")); }
    if (days < 45) return xx("hace " + days + (days === 1 ? " día" : " días"), days + (days === 1 ? " day ago" : " days ago"));
    var mo = Math.round(days / 30); return mo < 12 ? xx("hace " + mo + " meses", mo + " months ago") : xx("hace más de un año", "over a year ago");
  }
  function daysTo(s) { var d = d8(s); if (!d) return null; var t = new Date(); t.setHours(12, 0, 0, 0); return Math.round((d - t) / 864e5); }
  function ini(n) { return String(n || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase() || "—"; }
  function has() { var r = (ST.me && ST.me.roles) || []; for (var i = 0; i < arguments.length; i++) if (r.indexOf(arguments[i]) >= 0) return true; return false; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  var ERR = {
    forbidden: LZ("No tiene permiso para esta acción.", "You don't have permission for this action."), mfa_required: LZ("Necesita verificar su código de dos pasos.", "Please verify your two-step code."),
    note_required: LZ("Escriba una nota.", "Write a note."), reason_required: LZ("Elija el motivo.", "Choose the reason."), bad_status: LZ("La aplicación cambió de estado. Recargue la página.", "The application changed status. Please reload the page."),
    already_paid: LZ("Este pago ya se había registrado.", "This payment was already recorded."), email_in_use: LZ("Ya existe un miembro con ese correo.", "A member with that email already exists."),
    summary_required: LZ("Escriba un resumen.", "Write a summary."), own_application: LZ("Nadie puede revisar ni decidir su propia aplicación.", "No one can review or decide their own application."), not_found: LZ("No se encontró el registro.", "Record not found."), bad_payment: LZ("Revise el monto y la fecha.", "Check the amount and the date.")
  };
  function errMsg(e) { var m = (e && (e.message || e.error_description)) || ""; for (var k in ERR) if (m.indexOf(k) >= 0) return ERR[k]; return xx("Algo salió mal. Intente de nuevo.", "Something went wrong. Please try again.") + (m ? " (" + m + ")" : ""); }
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
  function opt(f, v) { var o = (f.o || []).filter(function (z) { return String(z[0]) === String(v); })[0]; return o ? o[lang() === "en" && o[2] ? 2 : 1] : v; }
  function fval(f, d) {
    var v = d[f.k], t = f.type || "text";
    if (v == null || v === "" || (Array.isArray(v) && !v.length) || v === false) return "";
    if (t === "radio" || t === "select" || t === "morphe") return opt(f, v);
    if (t === "checks") return v.filter(function (z) { return z !== "other"; }).map(function (z) { return opt(f, z); }).concat(v.indexOf("other") >= 0 && d[f.k + "_other"] ? [d[f.k + "_other"]] : []).join(", ");
    if (t === "scale") return v + xx(" de 5 (1 = ", " of 5 (1 = ") + f.sc[0][li()] + ", 5 = " + f.sc[1][li()] + ")";
    if (t === "tier") return v === "ministro" ? xx("Ministro · $75 / año", "Minister · $75 / year") : xx("Pastor · $100 / año", "Pastor · $100 / year");
    if (t === "consent") return xx("Autorizado", "Authorized");
    if (t === "faith") return xx("Afirma la Declaración de Fe", "Affirms the Statement of Faith");
    if (f.in === "date") return fd(v);
    return String(v);
  }
  function lbl(f) { return f.tag ? f.tag[li()] : f.type === "faith" ? xx("Declaración de Fe", "Statement of Faith") : f.type === "consent" ? xx("Autorización", "Authorization") : f.type === "tier" ? xx("Membresía", "Membership") : f.type === "morphe" ? "Instituto Morphe" : (f.l ? f.l[li()] : f.k); }
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
    return '<div class="st-sec"><h4>' + esc(sec.t[li()]) + '</h4><div class="st-kv">' + items.map(function (i) { return '<div class="' + (i[2] ? "w" : "") + '"><small>' + esc(i[0]) + "</small><p>" + esc(i[1]).replace(/\n/g, "<br>") + "</p></div>"; }).join("") + "</div></div>";
  }
  function ben(k) { var b = (SC.NEEDS || []).filter(function (z) { return z[0] === k; })[0] || (SC.BENEFITS || []).filter(function (z) { return z[0] === k; })[0]; return b ? b[1 + li()] : k; }
  function findF(part, k) { var out = null; (SC[part] || []).forEach(function (s) { s.f.forEach(function (f) { if (f.k === k) out = f; }); }); return out; }

  /* ---------- encabezado y pestañas ---------- */
  var ROLE_N = { admin: LZ("Administrador", "Administrator"), membership: LZ("Membresía", "Membership"), treasury: LZ("Tesorería", "Treasury"), care: LZ("Cuidado pastoral", "Pastoral care"), president: LZ("Presidente", "President") };
  function tabs(cur) {
    var ov = ST.ov || {}, apps = ov.apps || {}, t = [];
    if (has("president")) t.push(["inbox", xx("Para su aprobación", "For your approval"), apps.recommended]);
    if (has("admin", "membership", "president", "care")) t.push(["apps", xx("Aplicaciones", "Applications"), (apps["new"] || 0) || null]);
    t.push(["members", xx("Miembros", "Members"), null]);
    if (has("admin", "membership", "president", "care")) t.push(["needs", xx("Necesidades", "Needs"), null]);
    if (has("care")) t.push(["care", xx("Cuidado pastoral", "Pastoral care"), ov.care || null]);
    t.push(["events", xx("Eventos", "Events"), null]);
    return '<div class="st-tabs" role="navigation">' + t.map(function (x) { return '<a class="' + (cur === x[0] ? "on" : "") + '" href="#/staff/' + x[0] + '">' + x[1] + (x[2] ? ' <span class="ct">' + x[2] + "</span>" : "") + "</a>"; }).join("") + xx("<a href=\"#/membership\">Mi credencial</a></div>", "<a href=\"#/membership\">My credential</a></div>");
  }
  function hero(cur, eyebrow, title, sub, back) {
    var roles = (ST.me.roles || []).map(function (r) { return '<span class="st-role">' + ROLE_N[r] + "</span>"; }).join(" ");
    return '<div class="hero sm st-hero"><div class="wrap">' + (back ? '<a class="st-back" href="' + back[0] + '">‹ ' + back[1] + "</a>" : "") +
      '<div class="eyebrow">' + esc(eyebrow) + "</div><h1>" + esc(title) + '</h1><div class="st-who">' + (sub != null ? sub : (back ? "" : '<span class="sx-hi">' + sxHello() + "</span>") + '<span class="sx-roles">' + roles + "</span>") + "</div>" + (back ? "" : tabs(cur)) + "</div></div>";
  }
  function sxHello() {
    var h = new Date().getHours(), n = String((ST.me && ST.me.name) || "").split(" ")[0];
    return (h < 12 ? xx("Buenos días", "Good morning") : h < 19 ? xx("Buenas tardes", "Good afternoon") : xx("Buenas noches", "Good evening")) + (n ? ", " + esc(n) : "") + ".";
  }
  function body(html) { return '<section class="st-body"><div class="wrap">' + html + "</div></section>"; }
  /* ---------- menú lateral del panel ---------- */
  var SX_ICO = {
    inbox: "M4 13h4l2 3h4l2-3h4M4 13l2.5-8h11l2.5 8v6H4z", apps: "M9 12h6M9 16h6M7 3h7l5 5v13H7z",
    members: "M9 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20c-.4-2.6-1.9-4.3-4-5",
    needs: "M4 19V9M10 19V5M16 19v-7M22 19H2", care: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
    events: "M3 5h18v16H3zM16 3v4M8 3v4M3 10h18", cred: "M3 5h18v14H3zM14 10h4M14 14h3M9 9a2 2 0 1 1 0 4a2 2 0 0 1 0-4"
  };
  function sxCur() {
    var p = (KR() || "").replace(/^#\/?/, "").split("/"), v = p[1] || "";
    return { app: "apps", member: "members", event: "events" }[v] || v || (has("president") ? "inbox" : has("admin", "membership", "care") ? "apps" : "members");
  }
  function shell(html) {
    var ov = ST.ov || {}, apps = ov.apps || {}, cur = sxCur(), me = ST.me || {};
    function it(k, label, n) { return '<a class="' + (cur === k ? "on" : "") + '" href="#/staff/' + k + '"><svg viewBox="0 0 24 24"><path d="' + SX_ICO[k] + '"/></svg><span>' + label + "</span>" + (n ? "<i>" + n + "</i>" : "") + "</a>"; }
    var m = "";
    if (has("president")) m += it("inbox", xx("Para su aprobación", "For your approval"), apps.recommended);
    if (has("admin", "membership", "president", "care")) m += it("apps", xx("Aplicaciones", "Applications"), apps["new"] || 0);
    m += it("members", xx("Miembros", "Members"), ov.members_total);
    if (has("admin", "membership", "president", "care")) m += it("needs", xx("Necesidades", "Needs"), null);
    if (has("care")) m += it("care", xx("Cuidado pastoral", "Pastoral care"), ov.care);
    var roles = (me.roles || []).map(function (r) { return String(ROLE_N[r] || r); }).join(" · ");
    return '<div class="sx"><aside class="sx-side"><div class="sx-in"><div class="sx-me"><div class="sx-av">' + esc(ini(me.name)) + '</div><div><b>' + esc(me.name || "") + "</b><span>" + esc(roles) + "</span></div></div>" +
      '<div class="sx-nav"><div class="sx-lbl">' + xx("Membresía", "Membership") + "</div>" + m +
      '<div class="sx-lbl">' + xx("Actividades", "Activities") + "</div>" + it("events", xx("Eventos", "Events"), null) +
      '<div class="sx-lbl">' + xx("Yo", "Me") + '</div><a href="#/membership"><svg viewBox="0 0 24 24"><path d="' + SX_ICO.cred + '"/></svg><span>' + xx("Mi credencial", "My credential") + "</span></a></div></div></aside>" +
      '<div class="sx-main">' + html + "</div></div>";
  }
  function put(html) {
    if (!ROOT) return;
    var h = (KR() || "").replace(/^#\/?/, ""), me = ST.me;
    if (me && me.aal === "aal2" && me.roles && me.roles.length && /^staff(\/|$)/.test(h) && html.indexOf("st-hero") >= 0) html = shell(html);
    ROOT.innerHTML = html;
  }
  function loading(cur, title) { put(hero(cur, xx("Panel del equipo", "Team panel"), title) + body(xx("<p class=\"st-wait\">Cargando…</p>", "<p class=\"st-wait\">Loading…</p>"))); }

  /* ---------- acceso: sesión, rol y verificación en dos pasos ---------- */
  function gate() {
    var c = sb();
    if (!c) { put(hero0(xx("No pudimos conectar", "We couldn't connect"), xx("Intente de nuevo en unos minutos.", "Please try again in a few minutes."))); return Promise.resolve(false); }
    return c.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { put(hero0(xx("Panel del equipo", "Team panel"), xx("Inicie sesión en el <a href=\"#/membership\">Área de Miembros</a> con su correo del equipo y regrese aquí.", "Sign in to the <a href=\"#/membership\">Members Area</a> with your team email and come back here."))); return false; }
      return rpc("staff_me").then(function (me) {
        ST.me = me;
        if (!me.roles || !me.roles.length) { put(denied()); return false; }
        if (me.aal === "aal2") return true;
        return mfaScreen().then(function () { return false; });
      });
    }).catch(function (e) { put(hero0(xx("No pudimos conectar", "We couldn't connect"), esc(errMsg(e)))); return false; });
  }
  function hero0(t, p) { return xx("<div class=\"hero sm st-hero\"><div class=\"wrap\"><div class=\"eyebrow\">Panel del equipo</div><h1>", "<div class=\"hero sm st-hero\"><div class=\"wrap\"><div class=\"eyebrow\">Team panel</div><h1>") + esc(t) + '</h1><div class="st-who"><span>' + p + "</span></div><div style=\"height:40px\"></div></div></div>" + body(""); }
  function denied() {
    return xx("<div class=\"hero sm st-hero\"><div class=\"wrap\"><div class=\"eyebrow\">Panel del equipo</div><h1>Acceso restringido</h1><div style=\"height:40px\"></div></div></div>", "<div class=\"hero sm st-hero\"><div class=\"wrap\"><div class=\"eyebrow\">Team panel</div><h1>Restricted access</h1><div style=\"height:40px\"></div></div></div>") +
      body('<div class="st-card st-deny"><div class="st-cb">' + ico("lock") + xx("<div><b>Esta sección es solo para personal autorizado.</b><p>Si cree que necesita acceso, hable con el administrador.</p><a class=\"btn navy\" href=\"#/membership\">Ir a mi Área de Miembros</a></div></div></div>", "<div><b>This section is for authorized staff only.</b><p>If you think you need access, talk to the administrator.</p><a class=\"btn navy\" href=\"#/membership\">Go to my Members Area</a></div></div></div>"));
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
    }).catch(function (e) { put(hero0(xx("Verificación en dos pasos", "Two-step verification"), esc(errMsg(e)))); });
  }
  function mfaForm(fid, totp) {
    var setup = totp ? xx("<ol class=\"st-steps\"><li>Instale en su celular una app de códigos, por ejemplo <b>Google Authenticator</b> o <b>Microsoft Authenticator</b>.</li><li>En la app, toque <b>+</b> y escanee este código:</li></ol><div class=\"st-qr\"><img alt=\"Código QR\" src=\"", "<ol class=\"st-steps\"><li>Install an authenticator app on your phone, for example <b>Google Authenticator</b> or <b>Microsoft Authenticator</b>.</li><li>In the app, tap <b>+</b> and scan this code:</li></ol><div class=\"st-qr\"><img alt=\"QR code\" src=\"") + esc(totp.qr_code) + xx("\"><p>¿No puede escanear? Escriba esta clave: <code>", "\"><p>Can't scan it? Type this key: <code>") + esc(totp.secret) + xx("</code></p></div><p class=\"st-mfa-p\">3. Escriba el código de 6 dígitos que muestra la app:</p>", "</code></p></div><p class=\"st-mfa-p\">3. Enter the 6-digit code the app shows:</p>") :
      xx("<p class=\"st-mfa-p\">Abra su app de códigos (Google Authenticator u otra) y escriba el código de 6 dígitos de <b>KAI</b>.</p>", "<p class=\"st-mfa-p\">Open your authenticator app (Google Authenticator or another) and enter the 6-digit code for <b>KAI</b>.</p>");
    put(xx("<div class=\"hero sm st-hero\"><div class=\"wrap\"><div class=\"eyebrow\">Panel del equipo</div><h1>", "<div class=\"hero sm st-hero\"><div class=\"wrap\"><div class=\"eyebrow\">Team panel</div><h1>") + (totp ? xx("Active la verificación en dos pasos", "Turn on two-step verification") : xx("Verificación en dos pasos", "Two-step verification")) + xx("</h1><div class=\"st-who\"><span>Hola, ", "</h1><div class=\"st-who\"><span>Hello, ") + esc(ST.me.name) + xx(". Por seguridad, el panel pide un código además de su contraseña.</span></div><div style=\"height:40px\"></div></div></div>", ". For security, the panel asks for a code in addition to your password.</span></div><div style=\"height:40px\"></div></div></div>") +
      body('<div class="st-card st-mfa"><div class="st-cb">' + setup + xx("<form id=\"st-mfa\"><input class=\"st-in st-code\" inputmode=\"numeric\" autocomplete=\"one-time-code\" maxlength=\"6\" pattern=\"\\d{6}\" placeholder=\"000000\" required><button class=\"btn gold\" type=\"submit\">Verificar</button></form><p class=\"st-msg\" id=\"st-mfa-msg\"></p></div></div>", "<form id=\"st-mfa\"><input class=\"st-in st-code\" inputmode=\"numeric\" autocomplete=\"one-time-code\" maxlength=\"6\" pattern=\"\\d{6}\" placeholder=\"000000\" required><button class=\"btn gold\" type=\"submit\">Verify</button></form><p class=\"st-msg\" id=\"st-mfa-msg\"></p></div></div>")));
    var f = $("#st-mfa"); var inp = $(".st-code", f); inp.focus();
    f.addEventListener("submit", function (ev) {
      ev.preventDefault(); var code = inp.value.replace(/\D/g, ""); if (code.length !== 6) return;
      var b = $("button", f); b.disabled = true;
      sb().auth.mfa.challengeAndVerify({ factorId: fid, code: code }).then(function (r) {
        if (r.error) throw r.error; route();
      }).catch(function () { $("#st-mfa-msg").textContent = xx("Código incorrecto o vencido. Intente con el código nuevo.", "Wrong or expired code. Try the new code."); b.disabled = false; inp.select(); });
    });
  }

  /* ---------- router ---------- */
  function route() {
    if (typeof evInit === "function") evInit();
    var h = (KR() || "").replace(/^#\/?/, ""), seq = ++ST.seq;
    ROOT = $("#stx"); if (!ROOT) return;
    if (/^pago\//.test(h)) { payPage(decodeURIComponent(h.slice(5))); return; }
    var p = h.split("/").slice(1);
    gate().then(function (ok) {
      if (!ok || seq !== ST.seq) return;
      return Promise.all([rpc("staff_overview"), ST.team ? ST.team : rpc("staff_team")]).then(function (r) {
        ST.ov = r[0]; ST.team = r[1]; if (seq !== ST.seq) return;
        var v = p[0] || (has("president") ? "inbox" : has("admin", "membership", "care") ? "apps" : "members");
        var need = { interview: ["admin", "membership", "president", "care"], inbox: ["president"], apps: ["admin", "membership", "president", "care"], app: ["admin", "membership", "president", "care", "treasury"], needs: ["admin", "membership", "president", "care"], care: ["care"] }[v];
        if (need && !has.apply(null, need)) { put(denied()); return; }
        if (v === "inbox") return inbox();
        if (v === "apps") return appList(p[1] || "", decodeURIComponent(p[2] || ""));
        if (v === "app") return appDetail(p[1]);
        if (v === "interview") return interviewPage(p[1]);
        if (v === "members") return memList(p[1] || "all", decodeURIComponent(p[2] || ""));
        if (v === "member") return memDetail(p[1]);
        if (v === "needs") return needs();
        if (v === "care") return care(p[1]);
        if (v === "events" && window.KAIEVP) return KAIEVP.list(p[1]);
        if (v === "event" && window.KAIEVP) return KAIEVP.detail(p[1], p[2]);
        put(denied());
      });
    }).catch(function (e) { put(hero0(xx("No pudimos cargar el panel", "We couldn't load the panel"), esc(errMsg(e)))); });
  }

  /* ---------- Entrevista (referencias, ordenación y cuidado pastoral · todo opcional) ---------- */
  function ivCard(a) {
    var box = $("#st-ivw", ROOT); if (!box || !has("admin", "membership", "president", "care")) return;
    rpc("staff_interview_get", { p_id: a.id }).then(function (x) {
      var iv = x.interview, done = !!(iv && iv.saved_at);
      box.innerHTML = '<div class="st-card st-ivc' + (done ? " done" : "") + '"><div class="st-cb"><div><b>' + (done ? xx("✓ Entrevista registrada", "✓ Interview recorded") : xx("Entrevista pendiente", "Interview pending")) + "</b><span>" +
        (done ? esc([iv.date ? fd(iv.date) : fd(iv.saved_at), (iv.who || []).join(", ") || iv.saved_by].filter(Boolean).join(" · ")) : xx("Referencias, ordenación y cuidado pastoral · todo opcional", "References, ordination and pastoral care · all optional")) + '</span></div><a class="btn ' + (done ? "navy" : "gold") + ' sm" href="#/staff/interview/' + a.id + '">' + (done ? xx("Ver / editar", "View / edit") : xx("Hacer entrevista", "Start interview")) + "</a></div></div>";
    }).catch(function () { box.innerHTML = ""; });
  }
  function interviewPage(id) {
    loading("apps", xx("Entrevista", "Interview"));
    return rpc("staff_interview_get", { p_id: id }).then(function (x) {
      var M = JSON.parse(JSON.stringify(x.interview || {})), R = JSON.parse(JSON.stringify(x.refs || {})), C = JSON.parse(JSON.stringify(x.care || {}));
      var careEdit = !!(x.care_role || !x.care_saved);
      if (!M.date) M.date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
      M.who = M.who || (ST.me && ST.me.name ? [ST.me.name] : []);
      function v(o, k) { return o[k] == null ? "" : o[k]; }
      function inp(src, k, ph, type) { return '<input class="st-in" data-src="' + src + '" data-k="' + k + '" type="' + (type || "text") + '" value="' + esc(v(src === "R" ? R : src === "M" ? M : C, k)) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + ">"; }
      function area(src, k, ph) { return '<textarea class="st-in" data-src="' + src + '" data-k="' + k + '" rows="3"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + ">" + esc(v(src === "R" ? R : src === "M" ? M : C, k)) + "</textarea>"; }
      function btns(src, k, o, multi) { var cur = (src === "M" ? M : C)[k]; return '<div class="iv-bt" data-src="' + src + '" data-k="' + k + '"' + (multi ? ' data-multi="1"' : "") + ">" + o.map(function (q) { var on = multi ? (cur || []).indexOf(q[0]) >= 0 : String(cur) === String(q[0]); return '<button type="button" data-v="' + esc(q[0]) + '"' + (on ? ' class="on"' : "") + ">" + esc(lang() === "en" ? (q[2] || q[1]) : q[1]) + "</button>"; }).join("") + "</div>"; }
      function q(label, inner, when, note) { return '<div class="iv-q"' + (when ? ' data-when="' + when + '"' : "") + "><label>" + label + "</label>" + inner + (note ? "<small>" + note + "</small>" : "") + "</div>"; }
      function cField(f) {
        var t = f.type || "text", L = f.l ? esc(lang() === "en" ? f.l[1] : f.l[0]) : "";
        if (t === "sub" || t === "finbox" || t === "offer" || t === "care") return "";
        if (t === "scale") return q(L, btns("C", f.k, [1, 2, 3, 4, 5].map(function (n) { return [String(n), String(n)]; })), f.when, f.sc ? esc((lang() === "en" ? f.sc[0][1] : f.sc[0][0]) + " → " + (lang() === "en" ? f.sc[1][1] : f.sc[1][0])) : "");
        if (t === "radio") return q(L, btns("C", f.k, f.o), f.when);
        if (t === "checks") return q(L, btns("C", f.k, f.o.concat(f.other ? [["other", "Otro", "Other"]] : []), true) + (f.other ? '<div class="iv-sub" data-when="' + f.k + '=other">' + inp("C", f.k + "_other", xx("¿Cuál?", "Which?")) + "</div>" : ""), f.when);
        if (t === "consent") return q("", '<label class="iv-chk"><input type="checkbox" data-src="C" data-k="fin_consent"' + (C.fin_consent ? " checked" : "") + "> " + xx("Autoriza a KAI a compartir solo su nombre y contacto con el equipo de planeación financiera.", "Authorizes KAI to share only their name and contact with the financial planning team.") + "</label>", f.when);
        if (t === "area") return q(L, area("C", f.k), f.when);
        return q(L, inp("C", f.k), f.when);
      }
      var team = (ST.team || []).map(function (t) { return [t.name || t.email, t.name || t.email]; });
      var info = [[xx("Teléfono", "Phone"), KPH(x.phone)], [xx("Correo", "Email"), x.email], [xx("Iglesia", "Church"), [x.church, [x.city, x.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")],
        [xx("Cónyuge", "Spouse"), x.spouse_name], [xx("Ordenación (según su aplicación)", "Ordination (per application)"), [x.ordained_by, x.ordained_year].filter(Boolean).join(" · ")]].filter(function (r) { return r[1]; });
      var careH = careEdit ? SC.C.map(function (s) { return '<div class="iv-grp"><h4>' + esc(lang() === "en" ? s.t[1] : s.t[0]) + "</h4>" + s.f.map(cField).join("") + "</div>"; }).join("")
        : '<div class="iv-lock">🔒 ' + xx("Las respuestas de cuidado pastoral ya se guardaron. Por confidencialidad, solo las ve el equipo de Cuidado pastoral.", "The pastoral care answers were already saved. For confidentiality, only the Pastoral care team can see them.") + "</div>";
      var html = '<div class="iv-tip">💬 ' + xx("<b>Todo es opcional.</b> Platique con naturalidad y pregunte solo lo que fluya; no tiene que llenar todo. Puede guardar y volver después.", "<b>Everything is optional.</b> Have a natural conversation and ask only what flows; you don't have to fill everything. You can save and come back later.") + "</div>" +
        '<div class="st-card"><h3>' + esc(x.name) + " <small>" + esc(x.app_no) + '</small></h3><div class="st-cb iv-info">' + info.map(function (r) { return "<div><small>" + r[0] + "</small><p>" + esc(r[1]) + "</p></div>"; }).join("") + "</div></div>" +
        '<div class="st-card"><h3>' + xx("1 · La entrevista", "1 · The interview") + '</h3><div class="st-cb">' +
          q(xx("Fecha", "Date"), inp("M", "date", "", "date")) +
          q(xx("¿Quién la hizo?", "Who conducted it?"), btns("M", "who", team, true)) +
          q(xx("¿Mostró su certificado de ordenación?", "Did they show their ordination certificate?"), btns("M", "ord_seen", [["y", "Sí", "Yes"], ["n", "No", "No"], ["none", "No lo tiene", "Doesn't have it"], ["na", "No se preguntó", "Not asked"]])) +
          q(xx("Notas sobre su ordenación", "Notes about their ordination"), area("M", "ord_note", xx("Ej.: se ordenó en 1995 en…, el concilio ya no existe…", "E.g. ordained in 1995 at…, the council no longer exists…"))) + "</div></div>" +
        '<div class="st-card"><h3>' + xx("2 · Referencias pastorales", "2 · Pastoral references") + '</h3><div class="st-cb">' + ["ref1", "ref2"].map(function (r, i) {
          return '<div class="iv-ref"><h4>' + xx("Referencia ", "Reference ") + (i + 1) + '</h4><div class="iv-g2">' + inp("R", r + "_name", xx("Nombre", "Name")) + inp("R", r + "_rel", xx("Iglesia o relación", "Church or relationship")) + inp("R", r + "_phone", xx("Teléfono", "Phone"), "tel") + inp("R", r + "_email", xx("Correo", "Email"), "email") + "</div></div>";
        }).join("") + "</div></div>" +
        '<div class="st-card iv-care"><h3>' + xx("3 · Cuidado pastoral <small>Confidencial</small>", "3 · Pastoral care <small>Confidential</small>") + '</h3><div class="st-cb"><p class="iv-note">' + xx("Solo el equipo de Cuidado pastoral podrá ver estas respuestas después de guardarlas. Pregunte con tacto; el pastor puede no contestar.", "Only the Pastoral care team will be able to see these answers after saving. Ask gently; the pastor may choose not to answer.") + "</p>" + careH + "</div></div>" +
        '<div class="st-card"><h3>' + xx("4 · Notas de la entrevista", "4 · Interview notes") + '</h3><div class="st-cb">' + area("M", "notes", xx("Impresiones generales, próximos pasos… (las ve el equipo de membresía)", "General impressions, next steps… (seen by the membership team)")) + "</div></div>" +
        '<div class="iv-save"><a class="btn navy" href="#/staff/app/' + x.id + '">' + xx("Cancelar", "Cancel") + '</a><p class="st-msg" id="iv-m"></p><button class="btn gold" id="iv-go">' + xx("Guardar entrevista", "Save interview") + "</button></div>";
      put(hero("apps", xx("Entrevista de membresía", "Membership interview"), x.name, null, ["#/staff/app/" + x.id, xx("Aplicación", "Application")]) + body('<div class="iv-wrap">' + html + "</div>"));
      var W = $(".iv-wrap", ROOT);
      function obj(src) { return src === "R" ? R : src === "M" ? M : C; }
      function when() { $$("[data-when]", W).forEach(function (el) { var p = el.dataset.when.split("="), cur = C[p[0]], vals = p[1].split(","); var ok = Array.isArray(cur) ? cur.some(function (z) { return vals.indexOf(z) >= 0; }) : vals.indexOf(String(cur)) >= 0; el.hidden = !ok; }); }
      W.addEventListener("input", function (e) { var t = e.target; if (!t.dataset.k) return; obj(t.dataset.src)[t.dataset.k] = t.type === "checkbox" ? t.checked : t.value; });
      W.addEventListener("change", function (e) { var t = e.target; if (t.type === "checkbox" && t.dataset.k) obj(t.dataset.src)[t.dataset.k] = t.checked; });
      W.addEventListener("click", function (e) {
        var b = e.target.closest(".iv-bt button"); if (!b) return;
        var g = b.parentNode, o = obj(g.dataset.src), k = g.dataset.k, val = b.dataset.v;
        if (g.dataset.multi) { var arr = Array.isArray(o[k]) ? o[k] : (o[k] = []), i = arr.indexOf(val); if (i >= 0) arr.splice(i, 1); else arr.push(val); b.classList.toggle("on", i < 0); }
        else { if (String(o[k]) === val) { delete o[k]; b.classList.remove("on"); } else { o[k] = /^\d$/.test(val) && g.dataset.src === "C" ? +val : val; $$("button", g).forEach(function (z) { z.classList.toggle("on", z === b); }); } }
        when();
      });
      when();
      $("#iv-go", W).onclick = function () {
        var btn = this, m = $("#iv-m", W); btn.disabled = true; m.textContent = xx("Guardando…", "Saving…");
        var p = { meta: M, refs: R }; if (careEdit) p.care = C;
        rpc("staff_interview_save", { p_id: x.id, p: p }).then(function () { toast(xx("Entrevista guardada.", "Interview saved.")); KGO("/staff/app/" + x.id); })
          .catch(function (er) { btn.disabled = false; m.textContent = errMsg(er); });
      };
    }).catch(function (e) { put(hero0(xx("No pudimos cargar la entrevista", "We couldn't load the interview"), esc(errMsg(e)))); });
  }

  /* ---------- 1) Aplicaciones ---------- */
  var APP_ST = { "new": ["new", LZ("Nueva", "New")], in_review: ["rev", LZ("En revisión", "In review")], recommended: ["rec", LZ("Con el presidente", "With the president")], approved: ["ok", LZ("Aprobada", "Approved")], declined: ["no", LZ("No aprobada", "Not approved")], withdrawn: ["no", LZ("Retirada", "Withdrawn")] };
  function pill(s, pres) { var x = s === "recommended" && pres ? ["rec", xx("Con el Administrador", "With the Administrator")] : APP_ST[s] || ["no", s]; return '<span class="st-pill ' + x[0] + '">' + x[1] + "</span>"; }
  function refsHTML(a) { var o = ""; for (var i = 0; i < (a.refs_total || 0); i++) o += '<i class="' + (i < a.refs_done ? "ok" : "") + '"></i>'; return '<div class="st-refs">' + o + "<em>" + (a.refs_total ? a.refs_done + xx(" de ", " of ") + a.refs_total : "—") + "</em></div>"; }
  function tasksHTML() {
    var t = (ST.ov && ST.ov.my_tasks) || []; if (!t.length) return "";
    return xx("<div class=\"st-card st-tasks\"><h3>Sus tareas <small>", "<div class=\"st-card st-tasks\"><h3>Your tasks <small>") + t.length + "</small></h3><ul>" + t.map(function (x) {
      var href = x.application_id ? "#/staff/app/" + x.application_id : x.member_kid ? "#/staff/member/" + x.member_kid : "";
      return '<li><a href="' + href + '">' + esc(dbt(x.title)) + "</a><span>" + ago(x.created_at) + '</span><button class="st-mini" data-act="task" data-id="' + x.id + '">' + xx("Hecho", "Done") + '</button></li>';
    }).join("") + "</ul></div>";
  }
  function appList(st, q) {
    loading("apps", xx("Aplicaciones de membresía", "Membership applications"));
    var page = 0;
    function load() {
      return rpc("staff_apps", { p_status: st || null, p_q: q || null, p_offset: page * 25 }).then(function (r) {
        var ov = ST.ov, a = ov.apps || {}, tot = 0; for (var k in a) tot += a[k];
        var seg = [["", xx("Todas", "All"), tot], ["new", xx("Nuevas", "New"), a["new"] || 0], ["in_review", xx("En revisión", "In review"), a.in_review || 0], ["recommended", xx("Con el presidente", "With the president"), a.recommended || 0], ["approved", xx("Aprobadas", "Approved"), a.approved || 0], ["declined", xx("No aprobadas", "Not approved"), a.declined || 0]];
        var rows = r.rows.map(function (x) {
          var name = x.cred_name || ((x.first_name || "") + " " + (x.last_name || ""));
          var sp = (x.spouse || []).map(function (s) { return xx("<span class=\"st-cp\">⇄ Cónyuge · ", "<span class=\"st-cp\">⇄ Spouse · ") + esc(s.app_no) + "</span>"; }).join(" ");
          return '<a class="st-row" href="#/staff/app/' + x.id + '"><div class="st-no">' + esc(x.app_no) + '</div><div class="st-p"><div class="st-av">' + esc(ini(name)) + '</div><div style="min-width:0"><b>' + esc(name) + "</b><span>" + esc([x.title, x.church, [x.city, x.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + "</span>" + sp + '</div></div><div class="st-tier"><b>' + (x.tier === "ministro" ? xx("Ministro", "Minister") : "Pastor") + "</b><span>$" + (x.fee || "") + xx(" / año</span></div><div class=\"st-date\">", " / year</span></div><div class=\"st-date\">") + fd(x.created_at) + "<span>" + ago(x.created_at) + "</span></div>" + refsHTML(x) + '<div class="st-pill-c">' + pill(x.status, x.president_app) + '</div><div class="go">›</div></a>';
        }).join("") || xx("<div class=\"st-empty\">No hay aplicaciones aquí.</div>", "<div class=\"st-empty\">No applications here.</div>");
        put(hero("apps", xx("Panel del equipo", "Team panel"), xx("Aplicaciones de membresía", "Membership applications")) + body(tasksHTML() +
          xx("<div class=\"st-stats\"><div class=\"st-stat hl\"><small>Nuevas</small><b>", "<div class=\"st-stats\"><div class=\"st-stat hl\"><small>New</small><b>") + (a["new"] || 0) + xx("</b><span>Esperan revisión</span></div><div class=\"st-stat\"><small>En revisión</small><b>", "</b><span>Awaiting review</span></div><div class=\"st-stat\"><small>In review</small><b>") + (a.in_review || 0) + '</b><span>' + (a.recommended || 0) + xx(" con el presidente</span></div><div class=\"st-stat\"><small>Aprobadas este año</small><b>", " with the president</span></div><div class=\"st-stat\"><small>Approved this year</small><b>") + (ov.year_approved || 0) + "</b><span>" + (ov.year_approved_pastor || 0) + xx(" pastores · ", " pastors · ") + ((ov.year_approved || 0) - (ov.year_approved_pastor || 0)) + xx(" ministros</span></div><div class=\"st-stat\"><small>Recibidas este año</small><b>", " ministers</span></div><div class=\"st-stat\"><small>Received this year</small><b>") + (ov.year_received || 0) + "</b><span>" + (ov.couples || 0) + xx(" matrimonios enlazados</span></div></div>", " linked couples</span></div></div>") +
          '<div class="st-bar"><div class="st-seg">' + seg.map(function (s) { var ic = { "": ["all", "#0b1f4b"], "new": ["plus", "#1f5fbf"], in_review: ["search", "#c27b0e"], recommended: ["cap", "#6d4bd1"], approved: ["ok", "#0f7a3d"], declined: ["no", "#b42318"] }[s[0]] || ["all"]; return '<a class="' + (s[0] === st ? "on" : "") + '" href="#/staff/apps/' + s[0] + '">' + KTAB(ic[0], ic[1]) + s[1] + " <i>" + s[2] + "</i></a>"; }).join("") + '</div><form class="st-search" id="st-q">' + ico("search") + '<input name="q" value="' + esc(q) + xx("\" placeholder=\"Buscar por nombre, iglesia o número\"></form></div>", "\" placeholder=\"Search by name, church or number\"></form></div>") +
          xx("<div class=\"st-table\"><div class=\"st-row th\"><div>Número</div><div>Solicitante</div><div>Membresía</div><div>Enviada</div><div>Referencias</div><div>Estado</div><div></div></div>", "<div class=\"st-table\"><div class=\"st-row th\"><div>Number</div><div>Applicant</div><div>Membership</div><div>Submitted</div><div>References</div><div>Status</div><div></div></div>") + rows + "</div>" + pager(r.total, page) +
          '<div class="st-foot"><div class="st-lock">' + ico("lock") + xx("<span>Las respuestas de cuidado pastoral (Parte C) <b>solo las ve el equipo de Cuidado pastoral.</b></span></div></div>", "<span>Pastoral care answers (Part C) <b>are only seen by the Pastoral care team.</b></span></div></div>")));
        bindSearch("#/staff/apps/" + st + "/");
        $$(".st-pg button", ROOT).forEach(function (b) { b.onclick = function () { page = +b.dataset.p; load(); }; });
      });
    }
    return load();
  }
  function pager(total, page) { var n = Math.ceil(total / 25); if (n < 2) return ""; var o = ""; for (var i = 0; i < n; i++) o += '<button class="' + (i === page ? "on" : "") + '" data-p="' + i + '">' + (i + 1) + "</button>"; return '<div class="st-pages st-pg">' + o + "</div>"; }
  function bindSearch(base) { var f = $("#st-q", ROOT); if (f) f.onsubmit = function (e) { e.preventDefault(); KGO(base + encodeURIComponent(f.q.value.trim())); }; }

  /* ---------- 2) Detalle de aplicación ---------- */
  var REASONS = ["Referencias no confirmadas", "No afirma la Declaración de Fe", "Información incompleta", "Otro"];
  var REASONS_EN = { "Referencias no confirmadas": "References not confirmed", "No afirma la Declaración de Fe": "Does not affirm the Statement of Faith", "Información incompleta": "Incomplete information", "Otro": "Other" };
  function reasonName(r) { return lang() === "en" ? (REASONS_EN[r] || r) : r; }
  var EV = { submitted: LZ("envió su aplicación", "submitted the application"), start: LZ("comenzó la revisión", "started the review"), ref: LZ("marcó contactada una referencia", "marked a reference as contacted"), interview: LZ("registró la entrevista", "recorded the interview"), note: "nota", recommend: LZ("envió su recomendación al presidente", "sent the recommendation to the president"), decide: LZ("decisión del presidente", "president's decision"), pay_claim: LZ("indicó que envió su pago por Zelle", "said they sent the payment by Zelle"), pay: LZ("confirmó el pago", "confirmed the payment"), photo: LZ("cambió la foto de la credencial", "changed the credential photo"), print: LZ("actualizó la credencial impresa", "updated the printed credential") };
  function evLine(e, applicant) {
    var who = e.actor || applicant, txt = EV[e.kind] || e.kind, cls = e.kind === "note" ? "note" : "sys";
    if (e.kind === "recommend") txt = xx("recomendó ", "recommended ") + (e.meta && e.meta.rec === "approve" ? "aprobar" : xx("no aprobar", "not approving")) + (e.meta && e.meta.reason ? " · " + e.meta.reason : "");
    if (e.kind === "decide") txt = { approve: xx("aprobó la aplicación", "approved the application"), decline: xx("no aprobó la aplicación", "did not approve the application"), "return": xx("la devolvió al equipo", "returned it to the team") }[e.meta && e.meta.decision] || txt;
    if (e.kind === "ref") txt = xx("marcó contactada la referencia ", "marked as contacted the reference ") + (e.meta && e.meta.ref === "ref2" ? "2" : "1");
    return '<li class="' + cls + '"><b>' + esc(who) + (e.kind === "note" ? xx(" · nota", " · note") : " " + txt) + "</b><time>" + fdt(e.at) + "</time>" + (e.note && e.kind !== "submitted" && e.kind !== "pay_claim" ? "<p>" + esc(dbt(e.note)) + "</p>" : "") + "</li>";
  }
  function appDetail(id) {
    loading("apps", xx("Aplicación", "Application"));
    return rpc("staff_app", { p_id: id }).then(function (a) {
      var d = a.data || {}, name = a.cred_name || ((a.first_name || "") + " " + (a.last_name || "")), files = a.files || {};
      var flow = [[xx("Recibida", "Received"), fd(a.created_at)], [xx("En revisión", "In review"), a.reviewer ? a.reviewer : xx("Sin asignar", "Unassigned")], [xx("Recomendación del equipo", "Team recommendation"), a.rec ? (a.rec === "approve" ? xx("Aprobar", "Approve") : xx("No aprobar", "Do not approve")) + " · " + (a.rec_by || "") : xx("Aprobar o no aprobar", "Approve or not approve")], [xx("Decisión del presidente", "President's decision"), a.status === "approved" ? xx("Aprobada", "Approved") : a.status === "declined" ? xx("No aprobada", "Not approved") : xx("Cierra el proceso", "Closes the process")]];
      var cur = { "new": 0, in_review: 1, recommended: 3, approved: 4, declined: 4, withdrawn: 4 }[a.status];
      var flowH = '<div class="st-flow">' + flow.map(function (f, i) { var c = i < cur ? "dn" : i === cur ? "cur" : ""; return '<div class="' + c + '"><small>' + (i < cur ? "✓ " : "") + xx("Paso ", "Step ") + (i + 1) + (i === cur ? xx(" · Ahora", " · Now") : "") + "</small><b>" + f[0] + "</b><span>" + esc(f[1]) + "</span></div>"; }).join("") + "</div>";
      var spouse = (a.spouse || []).map(function (s) { return '<a class="st-cp" href="#/staff/app/' + s.id + xx("\">⇄ Cónyuge · ", "\">⇄ Spouse · ") + esc(s.name) + " · " + esc(s.app_no) + "</a>"; }).join(" ");
      var idcard = '<div class="st-card"><div class="st-cb st-id"><div><div class="st-ph" id="st-photo">' + esc(ini(name)) + '</div>' + (canAppPhoto(a) ? xx("<button class=\"st-phbtn\" data-act=\"photo\">📷 Cambiar foto</button>", "<button class=\"st-phbtn\" data-act=\"photo\">📷 Change photo</button>") : "") + '</div><div><div class="st-kv">' +
        kv(xx("Título en credencial", "Title on credential"), a.title) + kv(xx("Nombre en credencial", "Name on credential"), a.cred_name) + kv(xx("Membresía", "Membership"), a.tier === "ministro" ? xx("Ministro · $75 / año", "Minister · $75 / year") : xx("Pastor · $100 / año", "Pastor · $100 / year")) +
        kv(xx("Correo", "Email"), a.email) + kv(xx("Teléfono", "Phone"), KPH(a.phone)) + kv(xx("Ciudad", "City"), [a.city, a.state].filter(Boolean).join(", ")) + kv(xx("Iglesia", "Church"), a.church) + kv(xx("Dirección postal", "Mailing address"), [d.address, d.zip].filter(Boolean).join(" · ")) + kv(xx("Firmó", "Signed"), (a.signed_name || "") + " · " + fd(a.signed_at)) +
        "</div>" + (spouse ? '<div style="margin-top:12px">' + spouse + "</div>" : "") + "</div></div></div>";
      var partA = SC.A.map(function (s) { return secHTML(s, d, ["tier", "email", "phone", "city", "state", "address", "zip"]); }).join("");
      var nb = (a.needs && a.needs.data) || {}, pr = (a.needs && a.needs.priorities) || [];
      var partB = (pr.length ? xx("<div class=\"st-sec\"><h4>Sus prioridades</h4><div class=\"st-prio\">", "<div class=\"st-sec\"><h4>Their priorities</h4><div class=\"st-prio\">") + pr.map(function (p, i) { return "<span>" + (i + 1) + ". " + esc(ben(p)) + "</span>"; }).join("") + "</div></div>" : "") + SC.B.map(function (s) { return secHTML(s, nb); }).join("");
      var docs = [["photo", xx("Foto de credencial", "Credential photo")], ["doc_ord", xx("Certificado de ordenación", "Ordination certificate")], ["doc_letter", xx("Carta de recomendación", "Recommendation letter")]].filter(function (k) { return k[0] === "photo" || files[k[0]]; }).map(function (k) {
        return files[k[0]] ? '<a class="st-doc" href="#" data-file="' + esc(files[k[0]]) + '"><i>' + esc((files[k[0]].split(".").pop() || "").toUpperCase()) + "</i><div><b>" + k[1] + xx("</b><span>Ver</span></div></a>", "</b><span>View</span></div></a>") : '<div class="st-doc miss"><i>—</i><div><b>' + k[1] + xx("</b><span>No adjuntó</span></div></div>", "</b><span>Not attached</span></div></div>");
      }).join("") + '<a class="st-doc" href="#" data-file="' + a.id + xx("/application.pdf\"><i>PDF</i><div><b>Copia de la aplicación</b><span>Firmada · ", "/application.pdf\"><i>PDF</i><div><b>Copy of the application</b><span>Signed · ") + fd(a.signed_at) + "</span></div></a>";
      var tabsH = xx("<div class=\"st-card\"><nav class=\"st-sub\"><a class=\"on\" href=\"#\" data-tab=\"A\">Parte A · Solicitud</a><a href=\"#\" data-tab=\"B\">Parte B · Necesidades</a><a href=\"#\" data-tab=\"D\">Documentos</a></nav><div data-pane=\"A\">", "<div class=\"st-card\"><nav class=\"st-sub\"><a class=\"on\" href=\"#\" data-tab=\"A\">Part A · Application</a><a href=\"#\" data-tab=\"B\">Part B · Needs</a><a href=\"#\" data-tab=\"D\">Documents</a></nav><div data-pane=\"A\">") + (partA || xx("<div class=\"st-sec\">Sin respuestas.</div>", "<div class=\"st-sec\">No answers.</div>")) + '</div><div data-pane="B" hidden>' + (partB || xx("<div class=\"st-sec\">Sin respuestas.</div>", "<div class=\"st-sec\">No answers.</div>")) + '</div><div data-pane="D" hidden><div class="st-cb st-docs">' + docs + "</div></div></div>";
      var refs = ["ref1", "ref2"].filter(function (r) { return d[r + "_name"]; }).map(function (r) {
        var done = (a.refs || {})[r], canRef = has("admin", "membership") && ["new", "in_review"].indexOf(a.status) >= 0;
        return '<div class="st-ref"><div><b>' + esc(d[r + "_name"]) + "</b><p>" + esc([d[r + "_church"], KPH(d[r + "_phone"]), d[r + "_email"], d[r + "_years"] ? xx("Lo conoce hace ", "Has known them for ") + d[r + "_years"] + xx(" años", " years") : ""].filter(Boolean).join(" · ")) + "</p></div>" +
          (done ? xx("<span class=\"ok\">✓ Contactada</span>", "<span class=\"ok\">✓ Contacted</span>") + (done.note ? '<div class="nt">“' + esc(done.note) + "” · " + esc(done.by) + ", " + fd(done.at) + "</div>" : "") : canRef ? '<button class="st-mini" data-act="ref" data-ref="' + r + xx("\">Marcar contactada</button>", "\">Mark contacted</button>") : xx("<span class=\"st-muted\">Pendiente</span>", "<span class=\"st-muted\">Pending</span>")) + "</div>";
      }).join("");
      var nref = ["ref1", "ref2"].filter(function (r) { return d[r + "_name"]; }).length;
      var refsH = xx("<div class=\"st-card\"><h3>Referencias <small>", "<div class=\"st-card\"><h3>References <small>") + Object.keys(a.refs || {}).length + xx(" de ", " of ") + nref + xx(" contactadas</small></h3>", " contacted</small></h3>") + (refs || xx("<div class=\"st-cb\">No dio referencias.</div>", "<div class=\"st-cb\">No references given.</div>")) + "</div>";
      var side = actionBox(a, name);
      var log = xx("<div class=\"st-card\"><h3>Historial y notas <small>Registro interno</small></h3><ul class=\"st-log\">", "<div class=\"st-card\"><h3>History and notes <small>Internal record</small></h3><ul class=\"st-log\">") + (a.events || []).map(function (e) { return evLine(e, name); }).join("") + xx("</ul><div class=\"st-add\"><textarea id=\"st-note\" placeholder=\"Agregar una nota interna…\"></textarea><div><span>Las notas no se pueden editar ni borrar.</span><button class=\"st-mini\" data-act=\"note\">Agregar nota</button></div></div></div>", "</ul><div class=\"st-add\"><textarea id=\"st-note\" placeholder=\"Add an internal note…\"></textarea><div><span>Notes cannot be edited or deleted.</span><button class=\"st-mini\" data-act=\"note\">Add note</button></div></div></div>");
      put('<div class="hero sm st-hero"><div class="wrap"><a class="st-back" href="#/staff/' + (has("president") && a.status === "recommended" ? "inbox" : "apps") + '">‹ ' + (has("president") && a.status === "recommended" ? xx("Para su aprobación", "For your approval") : xx("Aplicaciones", "Applications")) + xx("</a><div class=\"st-dhead\"><div><div class=\"eyebrow\">Aplicación ", "</a><div class=\"st-dhead\"><div><div class=\"eyebrow\">Application ") + esc(a.app_no) + "</div><h1>" + esc(name) + '</h1><div class="st-who"><span>' + esc([a.title, a.church, [a.city, a.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + '</span></div></div><div class="st-dmeta">' + pill(a.status, a.president_app) + (a.reviewer ? xx("<span class=\"st-taken\">Revisa: <b>", "<span class=\"st-taken\">Reviewer: <b>") + esc(a.reviewer) + "</b></span>" : "") + "</div></div></div></div>" +
        body(flowH + '<div class="st-dgrid"><div>' + idcard + (a.limited ? "" : '<div id="st-ivw"></div>' + tabsH + refsH) + "</div><div>" + side + log + "</div></div>"));
      if (files.photo) signed(files.photo).then(function (u) { if (u) { var p = $("#st-photo", ROOT); if (p) p.innerHTML = '<img src="' + esc(u) + '" alt="">'; } });
      bindApp(a, name);
      if (!a.limited) ivCard(a);
    });
  }
  function kv(l, v) { return v ? "<div><small>" + esc(l) + "</small><p>" + esc(v) + "</p></div>" : ""; }
  function actionBox(a, name) {
    if (["new", "in_review"].indexOf(a.status) >= 0 && has("admin", "membership") && a.mine) {
      return xx("<div class=\"st-card\"><h3>Su propia aplicación</h3><div class=\"st-cb\"><p class=\"st-subline\" style=\"margin:0\">Otra persona de Membresía la revisa y la recomienda. Nadie puede revisar ni decidir su propia aplicación.</p></div></div>", "<div class=\"st-card\"><h3>Your own application</h3><div class=\"st-cb\"><p class=\"st-subline\" style=\"margin:0\">Another Membership team member reviews and recommends it. No one can review or decide their own application.</p></div></div>");
    }
    if (["new", "in_review"].indexOf(a.status) >= 0 && has("admin", "membership")) {
      return xx("<div class=\"st-card st-rec\" id=\"st-recbox\"><h3>Recomendación del equipo <small>Paso 3</small></h3><div class=\"st-cb\">", "<div class=\"st-card st-rec\" id=\"st-recbox\"><h3>Team recommendation <small>Step 3</small></h3><div class=\"st-cb\">") +
        (a.status === "new" ? xx("<p class=\"lead2\">Nadie ha tomado esta aplicación.</p><button class=\"btn gold\" data-act=\"start\" style=\"width:100%;margin-bottom:18px\">Comenzar revisión</button>", "<p class=\"lead2\">No one has taken this application.</p><button class=\"btn gold\" data-act=\"start\" style=\"width:100%;margin-bottom:18px\">Start review</button>") : "") +
        xx("<p class=\"lead2\">Cuando termine la revisión, deje su recomendación. La aplicación pasa a la bandeja del presidente para la decisión final.</p>", "<p class=\"lead2\">When you finish the review, leave your recommendation. The application goes to the president's inbox for the final decision.</p>") +
        xx("<div class=\"st-opt\" data-pick=\"rec\"><label data-v=\"approve\">✓ Aprobar</label><label class=\"no\" data-v=\"decline\">No aprobar</label></div>", "<div class=\"st-opt\" data-pick=\"rec\"><label data-v=\"approve\">✓ Approve</label><label class=\"no\" data-v=\"decline\">Do not approve</label></div>") +
        xx("<div id=\"st-reason\" hidden><span class=\"lbl\">Motivo</span><select class=\"st-sel\" id=\"st-reason-s\"><option value=\"\">Elija…</option>", "<div id=\"st-reason\" hidden><span class=\"lbl\">Reason</span><select class=\"st-sel\" id=\"st-reason-s\"><option value=\"\">Choose…</option>") + REASONS.map(function (r) { return '<option value="' + esc(r) + '">' + esc(reasonName(r)) + "</option>"; }).join("") + "</select></div>" +
        xx("<span class=\"lbl\">¿Por qué? · Nota para el presidente</span><textarea id=\"st-recnote\"></textarea><p class=\"req\">La nota es obligatoria. Queda en el historial y no se puede borrar.</p><button class=\"btn gold\" data-act=\"recommend\">Enviar al presidente</button><p class=\"st-msg light\" id=\"st-recmsg\"></p></div></div>", "<span class=\"lbl\">Why? · Note for the president</span><textarea id=\"st-recnote\"></textarea><p class=\"req\">The note is required. It stays in the history and cannot be deleted.</p><button class=\"btn gold\" data-act=\"recommend\">Send to the president</button><p class=\"st-msg light\" id=\"st-recmsg\"></p></div></div>");
    }
    if (a.status === "recommended") {
      var rb = '<span class="st-recb ' + (a.rec === "approve" ? "y" : "n") + '">' + (a.rec === "approve" ? xx("✓ El equipo recomienda aprobar", "✓ The team recommends approving") : xx("El equipo recomienda no aprobar", "The team recommends not approving")) + "</span>" + (a.rec_reason ? xx("<br><span class=\"st-why\">Motivo: ", "<br><span class=\"st-why\">Reason: ") + esc(reasonName(a.rec_reason)) + "</span>" : "") + '<p class="st-q">' + esc(a.rec_note) + '</p><div class="st-by">' + esc(a.rec_by || "") + " · " + fd(a.rec_at) + "</div>";
      if (a.can_decide) return '<div class="st-card">' + (a.president_app ? xx("<h3>Aplicación del presidente <small>La decide el Administrador</small></h3>", "<h3>The president's application <small>Decided by the Administrator</small></h3>") : "") + '<div class="st-cb">' + rb + "</div></div>" + decisionBox(a, name);
      return '<div class="st-card"><h3>' + (a.president_app ? xx("Espera la decisión del Administrador", "Awaiting the Administrator's decision") : xx("Con el presidente", "With the president")) + xx(" <small>Paso 4</small></h3><div class=\"st-cb\">", " <small>Step 4</small></h3><div class=\"st-cb\">") + rb + "</div></div>";
    }
    if (a.status === "approved") {
      var paid = !!a.member_kid;
      return '<div class="st-card st-rec"><h3>' + (paid ? xx("Miembro activo", "Active member") : xx("Aprobada · pendiente de pago", "Approved · payment pending")) + "</h3><div class=\"st-cb\">" +
        (paid ? xx("<p class=\"lead2\">El pago se confirmó y su credencial está activa.</p><a class=\"btn gold\" href=\"#/staff/member/", "<p class=\"lead2\">The payment was confirmed and the credential is active.</p><a class=\"btn gold\" href=\"#/staff/member/") + a.member_kid + xx("\">Ver perfil del miembro</a>", "\">View member profile</a>") :
          '<p class="lead2">' + (a.pay_claimed_at ? xx("<b>Indicó que ya envió su pago por Zelle</b> (", "<b>Said they already sent the payment by Zelle</b> (") + fd(a.pay_claimed_at) + xx("). Verifique en el banco y registre el pago.", "). Check the bank and record the payment.") : xx("Envíele la bienvenida con las instrucciones de pago. Cuando llegue el Zelle, Tesorería registra el pago.", "Send the welcome email with the payment instructions. When the Zelle arrives, Treasury records the payment.")) + "</p>" +
          xx("<a class=\"btn gold\" href=\"#\" data-act=\"mail-welcome\" style=\"margin-bottom:8px\">Correo de bienvenida</a>", "<a class=\"btn gold\" href=\"#\" data-act=\"mail-welcome\" style=\"margin-bottom:8px\">Welcome email</a>") + (a.pay_token ? xx("<button class=\"btn line-w\" data-act=\"copy-link\" style=\"margin-bottom:8px\">Copiar enlace de pago</button>", "<button class=\"btn line-w\" data-act=\"copy-link\" style=\"margin-bottom:8px\">Copy payment link</button>") : "") +
          (has("admin", "treasury") ? xx("<button class=\"btn line-w\" data-act=\"pay\" style=\"width:100%\">Registrar pago</button>", "<button class=\"btn line-w\" data-act=\"pay\" style=\"width:100%\">Record payment</button>") : "")) +
        "</div></div>";
    }
    if (a.status === "declined") return xx("<div class=\"st-card\"><h3>No aprobada</h3><div class=\"st-cb\"><p class=\"st-q\">", "<div class=\"st-card\"><h3>Not approved</h3><div class=\"st-cb\"><p class=\"st-q\">") + esc(a.decision_note || "") + '</p><div class="st-by">' + esc(a.decided_by || "") + " · " + fd(a.decided_at) + xx("</div><a class=\"btn navy\" href=\"#\" data-act=\"mail-decline\" style=\"margin-top:14px\">Correo para comunicar la decisión</a></div></div>", "</div><a class=\"btn navy\" href=\"#\" data-act=\"mail-decline\" style=\"margin-top:14px\">Email to share the decision</a></div></div>");
    return "";
  }
  function decisionBox(a, name) {
    return xx("<div class=\"st-card st-rec st-decbox\"><h3>Su decisión</h3><div class=\"st-cb\"><div class=\"st-opt three\" data-pick=\"dec\"><label data-v=\"approve\">✓ Aprobar</label><label class=\"no\" data-v=\"decline\">No aprobar</label><label data-v=\"return\">Devolver al equipo</label></div><span class=\"lbl\">Su nota · queda en el historial</span><textarea id=\"st-decnote\"></textarea>", "<div class=\"st-card st-rec st-decbox\"><h3>Your decision</h3><div class=\"st-cb\"><div class=\"st-opt three\" data-pick=\"dec\"><label data-v=\"approve\">✓ Approve</label><label class=\"no\" data-v=\"decline\">Do not approve</label><label data-v=\"return\">Return to the team</label></div><span class=\"lbl\">Your note · stays in the history</span><textarea id=\"st-decnote\"></textarea>") +
      xx("<div class=\"st-next\" id=\"st-next\" hidden></div><button class=\"btn gold\" data-act=\"decide\">Confirmar</button><p class=\"st-msg light\" id=\"st-decmsg\"></p></div></div>", "<div class=\"st-next\" id=\"st-next\" hidden></div><button class=\"btn gold\" data-act=\"decide\">Confirm</button><p class=\"st-msg light\" id=\"st-decmsg\"></p></div></div>");
  }
  function nextText(v, a, name) {
    if (v === "approve") return xx("<span class=\"lbl\">Al confirmar</span><ol><li><span>Queda como <b>Aprobada · pendiente de pago</b>.</span></li><li><span>A <b>", "<span class=\"lbl\">When you confirm</span><ol><li><span>It becomes <b>Approved · payment pending</b>.</span></li><li><span><b>") + esc(a.reviewer || a.rec_by || xx("quien la revisó", "The reviewer")) + xx("</b> le aparece la tarea de <b>llamar</b> a ", "</b> gets a task to <b>call</b> ") + esc(name) + xx(" y enviarle el <b>correo de bienvenida</b> con las instrucciones de pago ($", " and send the <b>welcome email</b> with the payment instructions ($") + (a.fee || "") + xx(").</span></li><li><span>Al registrar el pago se activa su credencial con código QR y recibe su invitación para entrar.</span></li></ol>", ").</span></li><li><span>When the payment is recorded, the credential with QR code is activated and they receive their invitation to sign in.</span></li></ol>");
    if (v === "decline") return xx("<span class=\"lbl\">Al confirmar</span><ol><li><span>Queda como <b>No aprobada</b>.</span></li><li><span>A <b>", "<span class=\"lbl\">When you confirm</span><ol><li><span>It becomes <b>Not approved</b>.</span></li><li><span><b>") + esc(a.reviewer || a.rec_by || xx("quien la revisó", "The reviewer")) + xx("</b> le aparece la tarea de comunicarle la decisión personalmente.</span></li></ol>", "</b> gets a task to share the decision personally.</span></li></ol>");
    return xx("<span class=\"lbl\">Al confirmar</span><ol><li><span>La aplicación regresa a <b>En revisión</b> con su nota para que el equipo revise lo que pidió.</span></li></ol>", "<span class=\"lbl\">When you confirm</span><ol><li><span>The application goes back to <b>In review</b> with your note so the team can look at what you asked.</span></li></ol>");
  }
  function bindPick(box, cb) { $$("label", box).forEach(function (l) { l.onclick = function () { $$("label", box).forEach(function (z) { z.classList.toggle("on", z === l); }); box.dataset.val = l.dataset.v; if (cb) cb(l.dataset.v); }; }); }
  function canAppPhoto(a) { return has("admin", "membership", "treasury") && !a.member_kid && ["declined", "withdrawn"].indexOf(a.status) < 0; }
  function bindApp(a, name) {
    $$(".st-sub a", ROOT).forEach(function (t) { t.onclick = function (e) { e.preventDefault(); $$(".st-sub a", ROOT).forEach(function (z) { z.classList.toggle("on", z === t); }); $$("[data-pane]", ROOT).forEach(function (p) { p.hidden = p.dataset.pane !== t.dataset.tab; }); }; });
    $$("[data-file]", ROOT).forEach(function (l) { l.onclick = function (e) { e.preventDefault(); var w = window.open("", "_blank"); signed(l.dataset.file).then(function (u) { if (u && w) w.location = u; else { if (w) w.close(); toast(xx("No se pudo abrir el archivo.", "Could not open the file."), true); } }); }; });
    var rp = $('[data-pick="rec"]', ROOT); if (rp) bindPick(rp, function (v) { $("#st-reason", ROOT).hidden = v !== "decline"; });
    var dp = $('[data-pick="dec"]', ROOT); if (dp) bindPick(dp, function (v) { var n = $("#st-next", ROOT); n.hidden = false; n.innerHTML = nextText(v, a, name); $('[data-act="decide"]', ROOT).textContent = { approve: xx("Confirmar aprobación", "Confirm approval"), decline: xx("Confirmar: no aprobar", "Confirm: do not approve"), "return": xx("Devolver al equipo", "Return to the team") }[v]; });
    function act(p, btn, msgEl) {
      if (ST.busy) return; ST.busy = true; if (btn) btn.disabled = true;
      return rpc("staff_app_act", p).then(function () { ST.busy = false; toast(xx("Guardado.", "Saved.")); route(); }).catch(function (e) { ST.busy = false; if (btn) btn.disabled = false; if (msgEl) msgEl.textContent = errMsg(e); else toast(errMsg(e), true); });
    }
    on("start", function (b) { act({ p_id: a.id, p_act: "start" }, b); });
    on("photo", function () { var p = $("#st-photo img", ROOT); photoModal({ name: name, old: p ? p.src : null, save: appPhotoSave(a) }); });
    on("note", function (b) { var n = $("#st-note", ROOT).value.trim(); if (!n) return toast(xx("Escriba la nota.", "Write the note."), true); act({ p_id: a.id, p_act: "note", p_note: n }, b); });
    on("ref", function (b) {
      var row = b.parentNode; if ($(".st-refform", row)) return;
      row.insertAdjacentHTML("beforeend", xx("<div class=\"st-refform\"><textarea placeholder=\"¿Qué dijo la referencia? (opcional)\"></textarea><button class=\"st-mini solid\">Guardar</button></div>", "<div class=\"st-refform\"><textarea placeholder=\"What did the reference say? (optional)\"></textarea><button class=\"st-mini solid\">Save</button></div>"));
      $(".st-refform button", row).onclick = function () { act({ p_id: a.id, p_act: "ref", p_arg: b.dataset.ref, p_note: $(".st-refform textarea", row).value.trim() || null }, this); };
    });
    on("recommend", function (b) {
      var v = rp.dataset.val, n = $("#st-recnote", ROOT).value.trim(), r = $("#st-reason-s", ROOT).value, m = $("#st-recmsg", ROOT);
      if (!v) return (m.textContent = xx("Elija Aprobar o No aprobar.", "Choose Approve or Do not approve."));
      if (v === "decline" && !r) return (m.textContent = xx("Elija el motivo.", "Choose the reason."));
      if (!n) return (m.textContent = xx("Escriba por qué.", "Write why."));
      act({ p_id: a.id, p_act: "recommend", p_note: n, p_arg: v, p_arg2: v === "decline" ? r : null }, b, m);
    });
    on("decide", function (b) {
      var v = dp.dataset.val, n = $("#st-decnote", ROOT).value.trim(), m = $("#st-decmsg", ROOT);
      if (!v) return (m.textContent = xx("Elija una opción.", "Choose an option.")); if (!n) return (m.textContent = xx("Escriba su nota.", "Write your note."));
      act({ p_id: a.id, p_act: "decide", p_note: n, p_arg: v }, b, m);
    });
    on("pay", function () { payModal({ app: a, name: name }); });
    on("mail-welcome", function () { mailWelcome(a, name); });
    on("copy-link", function (b) { try { navigator.clipboard.writeText(SITE + "/pago/" + a.pay_token); b.textContent = xx("Enlace copiado", "Link copied"); } catch (e) { prompt(xx("Enlace de pago:", "Payment link:"), SITE + "/pago/" + a.pay_token); } });
    on("mail-decline", function () { mailDecline(a, name); });
  }
  function on(act, fn) { $$('[data-act="' + act + '"]', ROOT).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); fn(b, e); }; }); }

  /* ---------- correos (Fase 1: se abren en su programa de correo) ---------- */
  function mailto(to, subj, bodyTxt) { location.href = "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(bodyTxt); }
  function mailWelcome(a, name) {
    var es = (a.data && a.data.lang_pref) !== "en";
    (function () {
      var link = a.pay_token ? SITE + "/pago/" + a.pay_token : SITE + "/membership";
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
    loading("inbox", xx("Para su aprobación", "For your approval"));
    return rpc("staff_apps", { p_status: "recommended" }).then(function (r) {
      r.rows = r.rows.filter(function (x) { return x.can_decide; });
      var n = r.rows.length;
      var cards = r.rows.map(function (x) {
        var name = x.cred_name || ((x.first_name || "") + " " + (x.last_name || ""));
        return '<div class="st-ic" data-id="' + x.id + '"><div><div class="st-p"><div class="st-av">' + esc(ini(name)) + '</div><div><span class="st-appno">' + esc(x.app_no) + "</span><b>" + esc(name) + "</b><span>" + esc([x.title, x.church, [x.city, x.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + xx("</span></div></div><div class=\"meta\"><span>Membresía <b>", "</span></div></div><div class=\"meta\"><span>Membership <b>") + (x.tier === "ministro" ? xx("Ministro · $75", "Minister · $75") : "Pastor · $100") + xx("</b></span><span>Referencias <b>", "</b></span><span>References <b>") + x.refs_done + xx(" de ", " of ") + x.refs_total + xx("</b></span><span>Documentos <b>", "</b></span><span>Documents <b>") + x.docs + xx(" de 2</b></span></div></div><div><span class=\"st-recb ", " of 2</b></span></div></div><div><span class=\"st-recb ") + (x.rec === "approve" ? "y" : "n") + '">' + (x.rec === "approve" ? xx("✓ El equipo recomienda aprobar", "✓ The team recommends approving") : xx("El equipo recomienda no aprobar", "The team recommends not approving")) + "</span>" + (x.rec_reason ? xx("<br><span class=\"st-why\">Motivo: ", "<br><span class=\"st-why\">Reason: ") + esc(reasonName(x.rec_reason)) + "</span>" : "") + '<p class="st-q">' + esc(x.rec_note) + '</p><div class="st-by">' + esc(x.rec_by || "") + xx(" · Membresía · ", " · Membership · ") + fd(x.rec_at) + '</div></div><div class="st-act"><button class="btn gold" data-open="' + x.id + xx("\">Decidir</button><a class=\"btn navy\" href=\"#/staff/app/", "\">Decide</button><a class=\"btn navy\" href=\"#/staff/app/") + x.id + xx("\">Ver aplicación</a><small>Recibida ", "\">View application</a><small>Received ") + ago(x.created_at) + "</small></div></div>";
      }).join("") || xx("<div class=\"st-card\"><div class=\"st-cb st-empty\">No hay aplicaciones esperando su decisión. ¡Todo al día!</div></div>", "<div class=\"st-card\"><div class=\"st-cb st-empty\">No applications awaiting your decision. All caught up!</div></div>");
      put(hero("inbox", xx("Panel del equipo", "Team panel"), xx("Para su aprobación", "For your approval"), xx("<span>Hola, ", "<span>Hello, ") + esc(ST.me.name) + xx("</span><span class=\"st-role\">Presidente</span><span>", "</span><span class=\"st-role\">President</span><span>") + (n ? n + (n === 1 ? xx(" aplicación recomendada espera", " recommended application awaits") : xx(" aplicaciones recomendadas esperan", " recommended applications await")) + xx(" su decisión", " your decision") : xx("Sin pendientes", "Nothing pending")) + "</span>") +
        body('<div class="st-inbox">' + cards + xx("</div><div class=\"st-foot\"><div class=\"st-lock\"><span>Si elige <b>Devolver al equipo</b>, la aplicación regresa a “En revisión” con su nota.</span></div></div>", "</div><div class=\"st-foot\"><div class=\"st-lock\"><span>If you choose <b>Return to the team</b>, the application goes back to “In review” with your note.</span></div></div>")));
      $$("[data-open]", ROOT).forEach(function (b) {
        b.onclick = function () {
          var card = b.closest(".st-ic"), x = r.rows.filter(function (z) { return z.id === b.dataset.open; })[0], name = x.cred_name || x.first_name;
          $$(".st-ic.open", ROOT).forEach(function (c) { c.classList.remove("open"); var d = $(".st-dec", c); if (d) d.remove(); });
          card.classList.add("open");
          card.insertAdjacentHTML("beforeend", xx("<div class=\"st-dec\"><div><h4>Su decisión</h4><div class=\"st-opt three\" data-pick=\"dec\"><label data-v=\"approve\">✓ Aprobar</label><label class=\"no\" data-v=\"decline\">No aprobar</label><label data-v=\"return\">Devolver al equipo</label></div><span class=\"lbl\">Su nota · queda en el historial</span><textarea></textarea><button class=\"btn gold\" data-go>Confirmar</button><p class=\"st-msg light\"></p></div><div class=\"st-next\"><span class=\"lbl\">Elija una opción</span><p style=\"color:#b9c6e4;font-size:13.5px;margin:0\">Aquí verá qué pasa al confirmar.</p></div></div>", "<div class=\"st-dec\"><div><h4>Your decision</h4><div class=\"st-opt three\" data-pick=\"dec\"><label data-v=\"approve\">✓ Approve</label><label class=\"no\" data-v=\"decline\">Do not approve</label><label data-v=\"return\">Return to the team</label></div><span class=\"lbl\">Your note · stays in the history</span><textarea></textarea><button class=\"btn gold\" data-go>Confirm</button><p class=\"st-msg light\"></p></div><div class=\"st-next\"><span class=\"lbl\">Choose an option</span><p style=\"color:#b9c6e4;font-size:13.5px;margin:0\">Here you'll see what happens when you confirm.</p></div></div>"));
          var dp = $('[data-pick="dec"]', card), nx = $(".st-next", card), go = $("[data-go]", card), m = $(".st-msg", card);
          bindPick(dp, function (v) { nx.innerHTML = nextText(v, { reviewer: x.reviewer || x.rec_by, fee: x.fee }, name); go.textContent = { approve: xx("Confirmar aprobación", "Confirm approval"), decline: xx("Confirmar: no aprobar", "Confirm: do not approve"), "return": xx("Devolver al equipo", "Return to the team") }[v]; });
          go.onclick = function () {
            var v = dp.dataset.val, n2 = $("textarea", card).value.trim();
            if (!v) return (m.textContent = xx("Elija una opción.", "Choose an option.")); if (!n2) return (m.textContent = xx("Escriba su nota.", "Write your note."));
            go.disabled = true;
            rpc("staff_app_act", { p_id: x.id, p_act: "decide", p_note: n2, p_arg: v }).then(function () { toast(xx("Decisión registrada.", "Decision recorded.")); route(); }).catch(function (e) { go.disabled = false; m.textContent = errMsg(e); });
          };
          card.scrollIntoView({ behavior: "smooth", block: "start" });
        };
      });
    });
  }

  /* ---------- 4) Miembros ---------- */
  var M_ST = { active: ["ok", LZ("Activa", "Active")], expired: ["exp", LZ("Vencida", "Expired")], inactive: ["no", LZ("Inactiva", "Inactive")], print: ["prt", LZ("Por imprimir", "To print")], pay: ["pay", LZ("Pendiente de pago", "Payment pending")] };
  var KIND = { call: LZ("Llamada", "Call"), video: LZ("Videollamada", "Video call"), coffee: LZ("Café o visita", "Coffee or visit"), workshop: LZ("Taller", "Workshop"), incorp: LZ("Incorporación", "Incorporation"), orient: LZ("Orientación", "Guidance"), counsel: LZ("Consejería", "Counseling"), prayer: LZ("Oración", "Prayer"), event: LZ("Evento", "Event"), other: LZ("Otro", "Other") };
  function memList(filter, q) {
    loading("members", xx("Miembros", "Members"));
    var page = 0;
    function load() {
      return rpc("staff_members", { p_filter: filter, p_q: q || null, p_offset: page * 25 }).then(function (r) {
        var ov = ST.ov;
        var al = [["pay", xx("Pendientes de pago", "Payments pending"), ov.pay_pending, ov.pay_claimed ? ov.pay_claimed + xx(" dicen que ya pagaron por Zelle", " say they already paid by Zelle") : xx("Aprobados que aún no pagan", "Approved but not yet paid")],
          ["renew", xx("Renovaciones", "Renewals"), ov.renew_soon + ov.expired, ov.renew_soon + xx(" vencen en 30 días · ", " expire within 30 days · ") + ov.expired + xx(" vencidas", " expired")],
          ["nocontact", xx("Más de 90 días sin contacto", "More than 90 days without contact"), ov.no_contact, xx("Nadie del equipo los ha contactado", "No one from the team has contacted them")],
          ["print", xx("Credenciales por imprimir", "Credentials to print"), ov.to_print + ov.printed, ov.printed ? ov.printed + xx(" impresas, falta enviar", " printed, still to mail") : xx("Imprimir y enviar", "Print and mail")]];
        var cls = { pay: "pay", renew: "ren", nocontact: "cnt", print: "prt" };
        var rows = r.rows.map(function (m) {
          var s = M_ST[m.state_k] || ["no", m.state_k], dt = daysTo(m.valid_through);
          var href = m.kind === "pending" ? "#/staff/app/" + m.id : "#/staff/member/" + m.kid;
          var vig = m.kind === "pending" ? "—" : fd(m.valid_through) + (dt != null && dt < 0 ? xx("<span>Venció ", "<span>Expired ") + ago(m.valid_through) + "</span>" : dt != null && dt <= 30 ? xx("<span>Vence en ", "<span>Expires in ") + dt + (dt === 1 ? xx(" día", " day") : xx(" días", " days")) + "</span>" : "");
          var lc = m.kind === "pending" ? (m.pay_claimed_at ? xx("<b class=\"st-claim\">Dice que ya pagó</b><span>", "<b class=\"st-claim\">Says they already paid</b><span>") + fd(m.pay_claimed_at) + "</span>" : xx("Aprobada ", "Approved ") + ago(m.decided_at) + xx("<span>Esperando pago</span>", "<span>Awaiting payment</span>")) :
            ago(m.last_contact) + "<span>" + esc([KIND[m.last_kind] || (m.last_kind ? m.last_kind : xx("Ingreso", "Joined")), (m.last_team || []).join(", ")].filter(Boolean).join(" · ")) + "</span>";
          var old = m.kind !== "pending" && daysTo(m.last_contact) < -90;
          return '<a class="st-mrow" href="' + href + '"><div class="st-p"><div class="st-av">' + (m.photo_url ? '<img src="' + esc(m.photo_url) + '" alt="">' : esc(ini(m.name))) + '</div><div style="min-width:0"><b>' + esc(m.name) + "</b><span>" + esc([m.title, m.church, [m.city, m.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + '</span></div></div><div class="st-cr"><b>' + esc(m.credential_no || "—") + xx("</b><span>Cuenta ", "</b><span>Account ") + esc(m.account_no || "—") + '</span></div><div class="st-vig' + (dt != null && dt <= 30 ? " warn" : "") + '">' + vig + '</div><div class="st-lc' + (old ? " old" : "") + '">' + lc + '</div><div><span class="st-pill ' + s[0] + '">' + s[1] + (m.renew_claimed_at ? xx(" · pagó", " · paid") : "") + '</span></div><div class="go">›</div></a>';
        }).join("") || xx("<div class=\"st-empty\">No hay miembros aquí.</div>", "<div class=\"st-empty\">No members here.</div>");
        var seg = [["all", xx("Todos", "All")], ["active", xx("Activos", "Active")], ["pastor", xx("Pastores", "Pastors")], ["ministro", xx("Ministros", "Ministers")], ["expired", xx("Vencidos", "Expired")]];
        put(hero("members", xx("Panel del equipo", "Team panel"), xx("Miembros", "Members"), xx("<span>Hola, ", "<span>Hello, ") + esc(ST.me.name) + "</span>" + (ST.me.roles || []).map(function (x) { return '<span class="st-role">' + ROLE_N[x] + "</span>"; }).join(" ") + "<span>" + ov.members_total + xx(" miembros · ", " members · ") + ov.members_active + xx(" activos</span>", " active</span>")) +
          body(tasksHTML() + '<div class="st-alerts">' + al.map(function (x) { return '<a class="st-al ' + cls[x[0]] + (filter === x[0] ? " on" : "") + '" href="#/staff/members/' + x[0] + '"><b>' + (x[2] || 0) + "</b><strong>" + x[1] + "</strong><span>" + x[3] + "</span></a>"; }).join("") + "</div>" +
            '<div class="st-bar"><div class="st-seg">' + seg.map(function (s) { var ic = { all: ["all", "#0b1f4b"], active: ["act", "#0f7a3d"], pastor: ["person", "#1f5fbf"], ministro: ["cap", "#6d4bd1"], expired: ["clock", "#b42318"] }[s[0]] || ["all"]; return '<a class="' + (filter === s[0] ? "on" : "") + '" href="#/staff/members/' + s[0] + '">' + KTAB(ic[0], ic[1]) + s[1] + "</a>"; }).join("") + '</div><form class="st-search" id="st-q">' + ico("search") + '<input name="q" value="' + esc(q) + xx("\" placeholder=\"Buscar por nombre, iglesia, ciudad o número\"></form></div>", "\" placeholder=\"Search by name, church, city or number\"></form></div>") +
            xx("<div class=\"st-table\"><div class=\"st-mrow th\"><div>Miembro</div><div>Credencial</div><div>Vigente hasta</div><div>Último contacto</div><div>Estado</div><div></div></div>", "<div class=\"st-table\"><div class=\"st-mrow th\"><div>Member</div><div>Credential</div><div>Valid until</div><div>Last contact</div><div>Status</div><div></div></div>") + rows + "</div>" + pager(r.total, page) +
            xx("<div class=\"st-foot\"><div class=\"st-lock\"><span>Al hacer clic en una alerta, la lista muestra solo esos miembros. <b>Último contacto</b> se actualiza cada vez que alguien del equipo anota un acompañamiento.</span></div></div>", "<div class=\"st-foot\"><div class=\"st-lock\"><span>Clicking an alert shows only those members in the list. <b>Last contact</b> updates every time someone on the team logs a care entry.</span></div></div>")));
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
    loading("members", xx("Miembro", "Member"));
    return rpc("staff_member", { p_member: kid }).then(function (m) {
      var s = M_ST[m.state_k] || ["no", m.state_k];
      var lastLog = (m.log || []).filter(function (x) { return x.src === "log"; })[0];
      var team = (ST.team || []).map(function (t) { return [t.name || t.email, t.name || t.email]; });
      var mine = ST.me.name;
      var form = xx("<div class=\"st-card st-new\"><h3>Registrar acompañamiento <small>Toma 1 minuto</small></h3><div class=\"st-cb\">", "<div class=\"st-card st-new\"><h3>Log a care entry <small>Takes 1 minute</small></h3><div class=\"st-cb\">") +
        xx("<div class=\"st-f\"><small>Tipo</small>", "<div class=\"st-f\"><small>Type</small>") + chips("kind", Object.keys(KIND).map(function (k) { return [k, k === "video" ? xx("Videollamada / Zoom", "Video call / Zoom") : k === "orient" ? xx("Orientación / estructura", "Guidance / structure") : KIND[k]]; }), [], false) + "</div>" +
        xx("<div class=\"st-f\"><small>A quién se apoyó</small>", "<div class=\"st-f\"><small>Who was supported</small>") + chips("who", [["pastor", "Pastor"], ["matrimonio", xx("Matrimonio", "Couple")], ["familia", xx("Familia", "Family")], ["congregacion", xx("Congregación", "Congregation")]], [], true) + "</div>" +
        xx("<div class=\"st-row3\" style=\"grid-template-columns:1fr 2fr\"><div class=\"st-f\"><small>Fecha</small><input type=\"date\" class=\"st-in\" id=\"lg-date\" value=\"", "<div class=\"st-row3\" style=\"grid-template-columns:1fr 2fr\"><div class=\"st-f\"><small>Date</small><input type=\"date\" class=\"st-in\" id=\"lg-date\" value=\"") + today() + '" max="' + today() + xx("\"></div><div class=\"st-f\"><small>¿Quién del equipo de KAI estuvo?</small>", "\"></div><div class=\"st-f\"><small>Who from the KAI team was there?</small>") + chips("team", team.concat([["+", xx("+ Otro", "+ Other")]]), [mine], true) + '<input class="st-in" id="lg-other" placeholder="Nombre de la otra persona" hidden style="margin-top:8px"></div></div>' +
        xx("<div class=\"st-f\"><small>Resumen</small><textarea class=\"st-in\" id=\"lg-sum\" placeholder=\"¿Qué se hizo? ¿Cómo está el pastor, su familia o su iglesia?\"></textarea></div>", "<div class=\"st-f\"><small>Summary</small><textarea class=\"st-in\" id=\"lg-sum\" placeholder=\"What was done? How are the pastor, their family or their church doing?\"></textarea></div>") +
        xx("<div class=\"st-row3\" style=\"grid-template-columns:2fr 1fr 1fr\"><div class=\"st-f\"><small>Siguiente paso (opcional)</small><input class=\"st-in\" id=\"lg-next\" placeholder=\"Ej. Enviar la lista de documentos\"></div><div class=\"st-f\"><small>Para cuándo</small><input type=\"date\" class=\"st-in\" id=\"lg-due\"></div><div class=\"st-f\"><small>Quién</small><select class=\"st-in\" id=\"lg-owner\"><option value=\"\">—</option>", "<div class=\"st-row3\" style=\"grid-template-columns:2fr 1fr 1fr\"><div class=\"st-f\"><small>Next step (optional)</small><input class=\"st-in\" id=\"lg-next\" placeholder=\"e.g. Send the list of documents\"></div><div class=\"st-f\"><small>Due</small><input type=\"date\" class=\"st-in\" id=\"lg-due\"></div><div class=\"st-f\"><small>Who</small><select class=\"st-in\" id=\"lg-owner\"><option value=\"\">—</option>") + team.map(function (t) { return "<option>" + esc(t[0]) + "</option>"; }).join("") + "</select></div></div>" +
        xx("<div class=\"st-f\"><small>Quién lo puede ver</small><div class=\"st-lvl\" data-pick=\"lvl\"><label class=\"on\" data-v=\"g\"><b>General</b><span>Lo ve todo el equipo.</span></label><label data-v=\"c\"><b>Confidencial</b><span>Solo Cuidado pastoral. Los demás ven la fecha y que hubo contacto.</span></label></div></div>", "<div class=\"st-f\"><small>Who can see it</small><div class=\"st-lvl\" data-pick=\"lvl\"><label class=\"on\" data-v=\"g\"><b>General</b><span>The whole team sees it.</span></label><label data-v=\"c\"><b>Confidential</b><span>Pastoral care only. Others see the date and that there was contact.</span></label></div></div>") +
        xx("<div class=\"ft\"><span class=\"st-msg\" id=\"lg-msg\"></span><button class=\"btn gold\" data-act=\"log\">Guardar en el registro</button></div></div></div>", "<div class=\"ft\"><span class=\"st-msg\" id=\"lg-msg\"></span><button class=\"btn gold\" data-act=\"log\">Save to the log</button></div></div></div>");
      var whoN = { pastor: "Pastor", matrimonio: xx("Matrimonio", "Couple"), familia: xx("Familia", "Family"), congregacion: xx("Congregación", "Congregation") };
      var entries = (m.log || []).map(function (x) {
        if (x.src === "event") {
          var t = x.kind === "decide" ? xx("Aprobada por el Presidente", "Approved by the President") : x.kind === "pay" ? (x.note || xx("Pago registrado", "Payment recorded")) : x.kind === "print" ? x.note : x.kind === "renew_claim" ? xx("Indicó que envió su renovación por Zelle", "Said they sent their renewal by Zelle") : x.note;
          return '<div class="st-ent sys" data-who=""><div class="st-ico">✓</div><div><div class="st-eh"><b>' + esc(dbt(t)) + "</b><time>" + fd(x.d) + '</time></div><div class="by">' + esc(x.actor || "") + "</div></div></div>";
        }
        var conf = x.conf && x.summary == null;
        return '<div class="st-ent' + (x.conf ? " conf" : "") + '" data-who="' + (x.who || []).join(" ") + '"' + (x.next_step && !x.next_done_at ? ' data-pend="1"' : "") + '><div class="st-ico">' + (x.conf ? "CONF." : esc((KIND[x.kind] || x.kind).toUpperCase().slice(0, 8))) + '</div><div><div class="st-eh"><b>' + (conf ? xx("Contacto confidencial · Cuidado pastoral", "Confidential contact · Pastoral care") : esc(KIND[x.kind] || x.kind) + (x.conf ? xx(" · confidencial", " · confidential") : "")) + "</b><time>" + fd(x.d) + '</time></div><div class="st-tags">' + (x.who || []).map(function (w) { return "<i>" + whoN[w] + "</i>"; }).join("") + "</div>" +
          (conf ? xx("<p>El contenido solo lo ve el equipo de Cuidado pastoral.</p>", "<p>The content is only seen by the Pastoral care team.</p>") : "<p>" + esc(x.summary) + "</p>") + '<div class="by">' + esc((x.team || []).join(", ") || x.author) + (x.author ? xx(" · registró ", " · logged ") + esc(x.author) : "") + "</div>" +
          (x.next_step ? '<div class="nx' + (x.next_done_at ? " done" : "") + xx("\"><b>Siguiente paso:</b> ", "\"><b>Next step:</b> ") + esc(x.next_step) + (x.next_due ? " · " + fd(x.next_due) : "") + (x.next_owner ? " · " + esc(x.next_owner) : "") + (x.next_done_at ? xx(" · ✓ hecho", " · ✓ done") : ' <button class="st-mini sm" data-act="nextdone" data-id="' + x.id + xx("\">Marcar hecho</button>", "\">Mark done</button>")) + "</div>" : "") + "</div></div>";
      }).join("") || xx("<div class=\"st-cb st-empty\">Todavía no hay anotaciones. La primera puede ser una llamada de bienvenida.</div>", "<div class=\"st-cb st-empty\">No entries yet. The first one could be a welcome call.</div>");
      var nlog = (m.log || []).filter(function (x) { return x.src === "log"; }).length;
      var tl = xx("<div class=\"st-card\"><h3>Registro de acompañamiento <small>", "<div class=\"st-card\"><h3>Care log <small>") + nlog + (nlog === 1 ? xx(" anotación", " entry") : xx(" anotaciones", " entries")) + xx("</small></h3><div class=\"st-tl-f\"><span class=\"on\" data-f=\"\">Todo</span><span data-f=\"pastor\">Pastor</span><span data-f=\"matrimonio\">Matrimonio</span><span data-f=\"familia\">Familia</span><span data-f=\"congregacion\">Congregación</span><span data-f=\"pend\">Pendientes</span></div><div id=\"st-tl\">", "</small></h3><div class=\"st-tl-f\"><span class=\"on\" data-f=\"\">All</span><span data-f=\"pastor\">Pastor</span><span data-f=\"matrimonio\">Couple</span><span data-f=\"familia\">Family</span><span data-f=\"congregacion\">Congregation</span><span data-f=\"pend\">Pending</span></div><div id=\"st-tl\">") + entries + "</div></div>";
      var canPay = has("admin", "treasury"), dt = daysTo(m.valid_through);
      var vs = M_ST[m.state_k === "print" ? "active" : m.state_k] || s;
      var cardM = xx("<div class=\"st-mc\"><div class=\"hd\"><span>Credencial</span><span class=\"st-mcst ", "<div class=\"st-mc\"><div class=\"hd\"><span>Credential</span><span class=\"st-mcst ") + vs[0] + '">' + vs[1] + '</span></div><div class="bd"><div class="mph">' + (m.photo_url ? '<img src="' + esc(m.photo_url) + '" alt="">' : esc(ini(m.name))) + "</div><div><small>" + esc(m.title || "") + "</small><b>" + esc(m.name) + "</b><span>" + esc([m.church, [m.city, m.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + "</span></div></div>" +
        xx("<dl><div><dt>Credencial</dt><dd>", "<dl><div><dt>Credential</dt><dd>") + esc(m.credential_no || "—") + xx("</dd></div><div><dt>Cuenta</dt><dd>", "</dd></div><div><dt>Account</dt><dd>") + esc(m.account_no || "—") + xx("</dd></div><div><dt>Miembro desde</dt><dd>", "</dd></div><div><dt>Member since</dt><dd>") + fd(m.member_since) + xx("</dd></div><div><dt>Vigente hasta</dt><dd>", "</dd></div><div><dt>Valid until</dt><dd>") + fd(m.valid_through) + (dt != null && dt <= 30 ? ' <em class="st-warn-t">' + (dt < 0 ? "vencida" : xx("vence en ", "expires in ") + dt + " d") + "</em>" : "") + "</dd></div></dl>" +
        xx("<div class=\"acts\"><a href=\"#\" data-act=\"cred\">Ver credencial</a>", "<div class=\"acts\"><a href=\"#\" data-act=\"cred\">View credential</a>") + (canPay ? xx("<a href=\"#\" data-act=\"renew\">Registrar pago</a>", "<a href=\"#\" data-act=\"renew\">Record payment</a>") : "") + "</div>" + (has("admin", "membership", "treasury") ? xx("<a href=\"#\" class=\"st-phchg\" data-act=\"photo\">📷 Cambiar foto</a>", "<a href=\"#\" class=\"st-phchg\" data-act=\"photo\">📷 Change photo</a>") : "") + (m.renew_claimed_at ? xx("<p class=\"st-claimed\">Indicó que envió su renovación por Zelle · ", "<p class=\"st-claimed\">Said they sent their renewal by Zelle · ") + fd(m.renew_claimed_at) + "</p>" : "") + "</div>";
      var PS = { none: "—", to_print: xx("Por imprimir", "To print"), printed: xx("Impresa", "Printed"), shipped: xx("Enviada", "Mailed") };
      var printBox = xx("<div class=\"st-card\"><h3>Credencial impresa <small>", "<div class=\"st-card\"><h3>Printed credential <small>") + PS[m.print_status] + "</small></h3><div class=\"st-cb\">" + (m.mail_address ? xx("<p class=\"st-addr\"><small>Enviar a</small>", "<p class=\"st-addr\"><small>Mail to</small>") + esc(m.mail_address) + "</p>" : "") +
        (canPay ? '<div class="st-print">' + ["to_print", "printed", "shipped"].map(function (k) { return '<button class="' + (m.print_status === k ? "on" : "") + '" data-print="' + k + '">' + PS[k] + "</button>"; }).join("") + xx("</div><input class=\"st-in\" id=\"st-track\" placeholder=\"Número de rastreo (opcional)\" value=\"", "</div><input class=\"st-in\" id=\"st-track\" placeholder=\"Tracking number (optional)\" value=\"") + esc(m.tracking || "") + '" style="margin-top:10px">' : "<p>" + (m.print_updated_at ? xx("Actualizado ", "Updated ") + fd(m.print_updated_at) : "") + "</p>") + "</div></div>";
      var FS = { pending: ["p", xx("Pendiente", "Pending")], in_progress: ["e", xx("En proceso", "In progress")], done: ["d", xx("Atendido", "Done")] };
      var fu = (m.followups || []);
      var fuBox = xx("<div class=\"st-card\"><h3>Pendientes <small>", "<div class=\"st-card\"><h3>Follow-ups <small>") + fu.filter(function (f) { return f.status !== "done"; }).length + '</small></h3><ul class="st-todo">' + (fu.map(function (f) {
        return xx("<li><b><span class=\"src\">Parte B</span>", "<li><b><span class=\"src\">Part B</span>") + esc(dbt(f.label)) + "</b><span>" + esc(f.owner || xx("Sin asignar", "Unassigned")) + (f.note ? " · " + esc(f.note) : "") + '</span><select class="st-fu" data-id="' + f.id + '">' + Object.keys(FS).map(function (k) { return '<option value="' + k + '"' + (f.status === k ? " selected" : "") + ">" + FS[k][1] + "</option>"; }).join("") + '</select><select class="st-fuo" data-id="' + f.id + xx("\"><option value=\"\">Responsable…</option>", "\"><option value=\"\">Owner…</option>") + team.map(function (t) { return "<option" + (f.owner === t[0] ? " selected" : "") + ">" + esc(t[0]) + "</option>"; }).join("") + "</select></li>";
      }).join("") || xx("<li><span>Sin pendientes de la aplicación.</span></li>", "<li><span>No follow-ups from the application.</span></li>")) + "</ul></div>";
      var ap = m.application || {};
      var datos = xx("<div class=\"st-card\"><h3>Datos</h3><div class=\"st-cb\"><div class=\"st-kv two\">", "<div class=\"st-card\"><h3>Details</h3><div class=\"st-cb\"><div class=\"st-kv two\">") + kv(xx("Correo", "Email"), m.email) + kv(xx("Teléfono", "Phone"), KPH(m.phone)) + kv(ap.marital === "c" ? xx("Cónyuge", "Spouse") : xx("Estado civil", "Marital status"), ap.spouse_name || "") + kv(xx("Hijos", "Children"), ap.children) +
        (ap.priorities && ap.priorities.length ? xx("<div class=\"w\"><small>Prioridades al aplicar</small><p>", "<div class=\"w\"><small>Priorities when applying</small><p>") + ap.priorities.map(function (p, i) { return (i + 1) + ". " + esc(ben(p)); }).join(" · ") + "</p></div>" : "") +
        (ap.id && has("admin", "membership", "president", "care") ? '<div class="w"><a class="st-link" href="#/staff/app/' + ap.id + xx("\">Ver aplicación ", "\">View application ") + esc(ap.app_no) + " ›</a></div>" : "") + "</div></div></div>";
      var payH = (m.payments || []).length ? xx("<div class=\"st-card\"><h3>Pagos</h3><ul class=\"st-todo\">", "<div class=\"st-card\"><h3>Payments</h3><ul class=\"st-todo\">") + m.payments.map(function (p) { return "<li><b>$" + (+p.amount) + " · " + (p.kind === "new" ? xx("Ingreso", "Joined") : xx("Renovación", "Renewal")) + "</b><span>" + fd(p.paid_on) + (+p.amount === 0 ? xx(" · Exento (board)", " · Exempt (board)") : " · Zelle") + (p.ref ? " " + esc(p.ref) : "") + " · " + esc(p.by) + "</span></li>"; }).join("") + "</ul></div>" : "";
      put(xx("<div class=\"hero sm st-hero\"><div class=\"wrap\"><a class=\"st-back\" href=\"#/staff/members\">‹ Miembros</a><div class=\"st-dhead\"><div><div class=\"eyebrow\">Miembro · cuenta ", "<div class=\"hero sm st-hero\"><div class=\"wrap\"><a class=\"st-back\" href=\"#/staff/members\">‹ Members</a><div class=\"st-dhead\"><div><div class=\"eyebrow\">Member · account ") + esc(m.account_no || "—") + "</div><h1>" + esc(m.name) + '</h1><div class="st-who"><span>' + esc([m.title, m.church, [m.city, m.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + '</span></div></div><div class="st-dmeta"><span class="st-pill ' + s[0] + '">' + s[1] + xx("</span><span class=\"st-taken\">Último contacto: <b>", "</span><span class=\"st-taken\">Last contact: <b>") + (lastLog ? ago(lastLog.d) : xx("sin registros", "no entries")) + "</b></span></div></div></div></div>" +
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
      if (!kind) return (msg.textContent = xx("Elija el tipo.", "Choose the type.")); if (!who.length) return (msg.textContent = xx("Elija a quién se apoyó.", "Choose who was supported.")); if (!sum) return (msg.textContent = xx("Escriba el resumen.", "Write the summary."));
      b.disabled = true;
      rpc("staff_log_add", { p_member: m.kid, p_kind: kind, p_who: who, p_team: team, p_on: $("#lg-date", ROOT).value || today(), p_summary: sum, p_next: $("#lg-next", ROOT).value.trim() || null, p_due: $("#lg-due", ROOT).value || null, p_owner: $("#lg-owner", ROOT).value || null, p_conf: lvl.dataset.val === "c" })
        .then(function () { toast(xx("Guardado en el registro.", "Saved to the log.")); route(); }).catch(function (e) { b.disabled = false; msg.textContent = errMsg(e); });
    });
    on("nextdone", function (b) { rpc("staff_log_next_done", { p_id: +b.dataset.id }).then(route).catch(function (e) { toast(errMsg(e), true); }); });
    on("renew", function () { payModal({ member: m, name: m.name }); });
    on("photo", function () { photoModal({ name: m.name, old: m.photo_url, member: true, save: memberPhotoSave(m) }); });
    on("cred", function () {
      var x = { full_name: m.name, title: m.title, credential_no: m.credential_no, valid_through: m.valid_through, member_since: m.member_since, church: m.church, city: m.city, state: m.state, photo_url: m.photo_url, verify_code: m.verify_code, status: m.state_k === "inactive" ? "inactive" : "active" };
      var c = window.KAI && window.KAI.cred ? window.KAI.cred(x) : null;
      if (!c) { window.open(SITE + "/verify/" + (m.verify_code || ""), "_blank"); return; }
      var ov = modal(xx("<h3>Credencial · ", "<h3>Credential · ") + esc(m.name) + xx("</h3><div class=\"bd\"><div class=\"ctab\"><button type=\"button\" data-s=\"f\" aria-pressed=\"true\">Frente</button><button type=\"button\" data-s=\"b\" aria-pressed=\"false\">Reverso</button></div><div class=\"cardv\"><div class=\"kc\" data-c=\"f\">", "</h3><div class=\"bd\"><div class=\"ctab\"><button type=\"button\" data-s=\"f\" aria-pressed=\"true\">Front</button><button type=\"button\" data-s=\"b\" aria-pressed=\"false\">Back</button></div><div class=\"cardv\"><div class=\"kc\" data-c=\"f\">") + c.front + '</div><div class="kc" data-c="b" hidden>' + c.back + xx("</div></div><p class=\"st-small\" style=\"margin-top:16px\">Así la ve el miembro en su Área de Miembros. <a class=\"st-link\" href=\"", "</div></div><p class=\"st-small\" style=\"margin-top:16px\">This is how the member sees it in their Members Area. <a class=\"st-link\" href=\"") + SITE + "/verify/" + esc(m.verify_code || "") + xx("\" target=\"_blank\" rel=\"noopener\">Página de verificación del QR ›</a></p><div class=\"ft\"><button class=\"btn navy\" data-close>Cerrar</button></div></div>", "\" target=\"_blank\" rel=\"noopener\">QR verification page ›</a></p><div class=\"ft\"><button class=\"btn navy\" data-close>Close</button></div></div>"));
      ov.querySelector(".st-modal").style.maxWidth = "680px";
      $$(".ctab button", ov).forEach(function (b) { b.onclick = function () { $$(".ctab button", ov).forEach(function (z) { z.setAttribute("aria-pressed", z === b); }); $$("[data-c]", ov).forEach(function (k) { k.hidden = k.dataset.c !== b.dataset.s; }); }; });
    });
    $$("[data-print]", ROOT).forEach(function (b) { b.onclick = function () { rpc("staff_print_set", { p_member: m.kid, p_status: b.dataset.print, p_tracking: ($("#st-track", ROOT) || {}).value || null }).then(function () { toast(xx("Credencial impresa: actualizado.", "Printed credential: updated.")); route(); }).catch(function (e) { toast(errMsg(e), true); }); }; });
    $$(".st-fu", ROOT).forEach(function (s) { s.onchange = function () { rpc("staff_followup_set", { p_id: +s.dataset.id, p_status: s.value }).then(function () { toast(xx("Pendiente actualizado.", "Follow-up updated.")); }).catch(function (e) { toast(errMsg(e), true); }); }; });
    $$(".st-fuo", ROOT).forEach(function (s) { s.onchange = function () { var st = $('.st-fu[data-id="' + s.dataset.id + '"]', ROOT).value; rpc("staff_followup_set", { p_id: +s.dataset.id, p_status: st === "pending" && s.value ? "in_progress" : st, p_owner: s.value }).then(route).catch(function (e) { toast(errMsg(e), true); }); }; });
  }

  /* ---------- Registrar pago (nuevo miembro o renovación) ---------- */
  function modal(html) {
    var ov = document.createElement("div"); ov.className = "st-ov"; ov.innerHTML = '<div class="st-modal" role="dialog" aria-modal="true">' + html + "</div>";
    document.body.appendChild(ov); ov.addEventListener("click", function (e) { if (e.target === ov || e.target.closest("[data-close]")) ov.remove(); });
    return ov;
  }
  /* ---------- Cambiar foto de credencial (aplicación o miembro) ---------- */
  function cropTo(img, pos) {
    var W = 800, H = 1000, base = Math.max(W / img.naturalWidth, H / img.naturalHeight), sc = base * pos.z;
    var dw = img.naturalWidth * sc, dh = img.naturalHeight * sc, ox = (dw - W) / 2, oy = (dh - H) / 2;
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.drawImage(img, -ox - pos.x * ox, -oy - pos.y * oy, dw, dh);
    return new Promise(function (res) { c.toBlob(function (b) { res(b); }, "image/jpeg", 0.88); });
  }
  function photoModal(o) {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp"; inp.style.display = "none"; document.body.appendChild(inp);
    inp.onchange = function () { var f = inp.files && inp.files[0]; inp.remove(); if (f) open(f); };
    inp.click();
    function open(file) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast(xx("Use una foto JPG o PNG (las fotos HEIC del iPhone no se pueden ajustar aquí).", "Use a JPG or PNG photo (iPhone HEIC photos can't be adjusted here)."), true);
      var url = URL.createObjectURL(file), pos = { x: 0, y: 0, z: 1 }, nat = { w: 1, h: 1 }, reprint = "none";
      var opts = o.member ? xx("<small class=\"ph-lb\">Credencial impresa</small>", "<small class=\"ph-lb\">Printed credential</small>") + '<div class="ph-opt" data-pick="rp">' +
        [["none", xx("No reimprimir", "Don't reprint"), xx("Se queda con la credencial impresa actual.", "They keep their current printed credential.")],
         ["paid", xx("Reimprimir · $25", "Reprint · $25"), xx("El miembro paga la reimpresión. Tesorería recibe el pendiente de cobro.", "The member pays for the reprint. Treasury gets a task to collect it.")],
         ["free", xx("Reimprimir gratis", "Reprint for free"), xx("Error de KAI o miembro del Board.", "KAI error or Board member.")]].map(function (r, i) {
          return '<label class="' + (i ? "" : "on") + '" data-v="' + r[0] + '"><input type="radio" name="ph-rp"' + (i ? "" : " checked") + "><div><b>" + r[1] + "</b><span>" + r[2] + "</span></div></label>";
        }).join("") + "</div>" : "";
      var ov = modal(xx("<h3>Cambiar foto · ", "<h3>Change photo · ") + esc(o.name) + '</h3><div class="bd"><div class="ph-crop"><div><div class="ph-frame"><img alt=""></div>' +
        '<label class="ph-zoom"><span>−</span><input type="range" min="1" max="3" step="0.01" value="1"><span>+</span></label>' +
        xx("<p class=\"ph-help\">Arrastre la foto para centrar el rostro · use la barra para acercar o alejar.</p>", "<p class=\"ph-help\">Drag the photo to center the face · use the slider to zoom in or out.</p>") +
        '</div><div><div class="ph-cmp"><div class="old">' + (o.old ? '<img src="' + esc(o.old) + '" alt="">' : '<i>' + esc(ini(o.name)) + "</i>") + xx("Antes</div><b>→</b><div class=\"new\"><canvas width=\"160\" height=\"200\"></canvas>Nueva</div></div>", "Before</div><b>→</b><div class=\"new\"><canvas width=\"160\" height=\"200\"></canvas>New</div></div>") +
        '<p class="ph-note">' + (o.member ? xx("La credencial digital y la página de verificación del QR se actualizan al guardar. El cambio queda en el historial.", "The digital credential and the QR verification page update when you save. The change is logged in the history.")
          : xx("Esta foto se usará en su credencial cuando se active la membresía. El cambio queda en el historial.", "This photo will be used on their credential when the membership is activated. The change is logged in the history.")) + "</p>" + opts +
        xx("</div></div><div class=\"ft\"><span class=\"st-msg\" id=\"ph-msg\"></span><button class=\"btn navy\" data-close>Cancelar</button><button class=\"btn gold\" id=\"ph-go\">Guardar foto nueva</button></div></div>", "</div></div><div class=\"ft\"><span class=\"st-msg\" id=\"ph-msg\"></span><button class=\"btn navy\" data-close>Cancel</button><button class=\"btn gold\" id=\"ph-go\">Save new photo</button></div></div>"));
      var md = ov.querySelector(".st-modal"); md.classList.add("ph-m");
      var box = $(".ph-frame", ov), im = $("img", box), rg = $(".ph-zoom input", ov), pv = $(".ph-cmp canvas", ov), off = { ox: 0, oy: 0 };
      function draw() {
        var W = box.clientWidth, H = box.clientHeight, base = Math.max(W / nat.w, H / nat.h), sc = base * pos.z;
        var dw = nat.w * sc, dh = nat.h * sc; off = { ox: (dw - W) / 2, oy: (dh - H) / 2 };
        im.style.width = dw + "px"; im.style.height = dh + "px"; im.style.left = (-off.ox - pos.x * off.ox) + "px"; im.style.top = (-off.oy - pos.y * off.oy) + "px";
        var g = pv.getContext("2d"), k = pv.width / W; g.fillStyle = "#fff"; g.fillRect(0, 0, pv.width, pv.height);
        g.drawImage(im, (-off.ox - pos.x * off.ox) * k, (-off.oy - pos.y * off.oy) * k, dw * k, dh * k);
      }
      im.onload = function () { nat = { w: im.naturalWidth, h: im.naturalHeight }; draw(); };
      im.onerror = function () { ov.remove(); toast(xx("No se pudo leer esa foto. Pruebe con otra.", "Could not read that photo. Try another one."), true); };
      im.src = url;
      window.addEventListener("resize", draw);
      var drag = null;
      box.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; try { box.setPointerCapture(e.pointerId); } catch (er) {} box.classList.add("dg"); });
      box.addEventListener("pointermove", function (e) {
        if (!drag) return;
        pos.x = off.ox > 0 ? Math.max(-1, Math.min(1, drag.px - (e.clientX - drag.x) / off.ox)) : 0;
        pos.y = off.oy > 0 ? Math.max(-1, Math.min(1, drag.py - (e.clientY - drag.y) / off.oy)) : 0;
        draw();
      });
      function up() { drag = null; box.classList.remove("dg"); }
      box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
      rg.addEventListener("input", function () { pos.z = +rg.value; draw(); });
      var rp = $('[data-pick="rp"]', ov);
      if (rp) $$("label", rp).forEach(function (l) { l.onclick = function () { $$("label", rp).forEach(function (z) { z.classList.toggle("on", z === l); $("input", z).checked = z === l; }); reprint = l.dataset.v; }; });
      var obs = new MutationObserver(function () { if (!ov.isConnected) { URL.revokeObjectURL(url); window.removeEventListener("resize", draw); obs.disconnect(); } });
      obs.observe(document.body, { childList: true });
      var go = $("#ph-go", ov), msg = $("#ph-msg", ov);
      go.onclick = function () {
        go.disabled = true; msg.textContent = xx("Guardando…", "Saving…");
        cropTo(im, pos).then(function (b) { if (!b) throw new Error("crop"); return o.save(b, reprint); })
          .then(function () { ov.remove(); toast(xx("Foto actualizada.", "Photo updated.")); route(); })
          .catch(function (e) { go.disabled = false; msg.textContent = errMsg(e); });
      };
    }
  }
  function appPhotoSave(a) {
    return function (b) {
      var c = sb(), path = "staff/" + a.id + "/photo-" + Date.now() + ".jpg";
      return c.storage.from(BUCKET).upload(path, b, { contentType: "image/jpeg", upsert: false }).then(function (u) {
        if (u.error) throw u.error; return rpc("staff_app_photo", { p_app: a.id, p_path: path });
      });
    };
  }
  function memberPhotoSave(m) {
    return function (b, reprint) {
      var c = sb(), name = (m.credential_no || m.kid) + "-" + Date.now() + ".jpg";
      return c.storage.from(PHOTOS).upload(name, b, { contentType: "image/jpeg", upsert: false }).then(function (u) {
        if (u.error) throw u.error;
        return rpc("staff_member_photo_change", { p_member: m.kid, p_url: c.storage.from(PHOTOS).getPublicUrl(name).data.publicUrl, p_reprint: reprint });
      });
    };
  }
  function payModal(o) {
    var isNew = !!o.app, a = o.app || {}, m = o.member || {}, fee = isNew ? a.fee : (m.tier === "ministro" ? 75 : 100);
    var d = a.data || {}, addr = isNew ? [d.address, a.city, [a.state, d.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") : (m.mail_address || "");
    var ov = modal(xx("<h3>Registrar pago · ", "<h3>Record payment · ") + (isNew ? xx("nuevo miembro", "new member") : xx("renovación", "renewal")) + '</h3><div class="bd"><p style="margin:0 0 14px"><b>' + esc(o.name) + xx("</b> · cuenta ", "</b> · account ") + esc(isNew ? a.app_no : m.account_no || "—") + "</p>" +
      xx("<div class=\"st-row3\"><div class=\"st-f\"><small>Monto</small><input class=\"st-in\" id=\"py-amt\" type=\"number\" min=\"1\" step=\"1\" value=\"", "<div class=\"st-row3\"><div class=\"st-f\"><small>Amount</small><input class=\"st-in\" id=\"py-amt\" type=\"number\" min=\"1\" step=\"1\" value=\"") + fee + xx("\"></div><div class=\"st-f\"><small>Fecha en que llegó</small><input class=\"st-in\" id=\"py-date\" type=\"date\" value=\"", "\"></div><div class=\"st-f\"><small>Date received</small><input class=\"st-in\" id=\"py-date\" type=\"date\" value=\"") + today() + '" max="' + today() + xx("\"></div><div class=\"st-f\"><small>Forma de pago</small><input class=\"st-in\" value=\"Zelle\" disabled></div></div>", "\"></div><div class=\"st-f\"><small>Payment method</small><input class=\"st-in\" value=\"Zelle\" disabled></div></div>") +
      (isNew ? xx("<p style=\"margin:0 0 12px;font-size:13.5px\">Credencial que se asignará: <b>", "<p style=\"margin:0 0 12px;font-size:13.5px\">Credential to be assigned: <b>") + (a.board ? esc(a.board.cred_no) + xx("</b> · número reservado del Board", "</b> · reserved Board number") : esc(a.cred_next || "PA") + "-" + new Date().getFullYear() + xx("-…</b> · siguiente número según el título", "-…</b> · next number for the title")) + "</p>" : "") +
      xx("<div class=\"st-f\" style=\"margin-top:12px\"><small>Número de confirmación de Zelle (opcional)</small><input class=\"st-in\" id=\"py-ref\"></div>", "<div class=\"st-f\" style=\"margin-top:12px\"><small>Zelle confirmation number (optional)</small><input class=\"st-in\" id=\"py-ref\"></div>") +
      (isNew ? xx("<div class=\"st-f\" style=\"margin-top:12px\"><small>Dirección para enviar la credencial impresa</small><input class=\"st-in\" id=\"py-addr\" value=\"", "<div class=\"st-f\" style=\"margin-top:12px\"><small>Address to mail the printed credential</small><input class=\"st-in\" id=\"py-addr\" value=\"") + esc(addr) + '"></div>' : "") +
      xx("<div class=\"st-f\" style=\"margin-top:12px\"><small>Nota (opcional)</small><input class=\"st-in\" id=\"py-note\"></div>", "<div class=\"st-f\" style=\"margin-top:12px\"><small>Note (optional)</small><input class=\"st-in\" id=\"py-note\"></div>") +
      '<ul style="margin:16px 0">' + (isNew ? xx("<li>Se crea su credencial con código QR, vigente por un año.</li><li>Se le envía el correo para crear su contraseña y ver su credencial.</li><li>Pasa a la lista de credenciales por imprimir.</li>", "<li>Their credential with QR code is created, valid for one year.</li><li>They receive the email to create their password and see their credential.</li><li>It goes to the list of credentials to print.</li>") : xx("<li>Su credencial se renueva por un año desde su vencimiento actual (", "<li>Their credential is renewed for one year from its current expiration (") + fd(m.valid_through) + xx(").</li><li>Pasa a la lista de credenciales por imprimir.</li>", ").</li><li>It goes to the list of credentials to print.</li>")) + "</ul>" +
      xx("<p class=\"st-msg\" id=\"py-msg\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>Cancelar</button><button class=\"btn gold\" id=\"py-go\">Confirmar pago", "<p class=\"st-msg\" id=\"py-msg\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>Cancel</button><button class=\"btn gold\" id=\"py-go\">Confirm payment") + (isNew ? xx(" y activar", " and activate") : "") + "</button></div></div>");
    var go = $("#py-go", ov), msg = $("#py-msg", ov), armed = false;
    go.onclick = function () {
      var amt = +$("#py-amt", ov).value, date = $("#py-date", ov).value, exempt = false;
      if ((!amt && !exempt) || !date) return (msg.textContent = xx("Revise el monto y la fecha.", "Check the amount and the date."));
      if (!armed) { armed = true; go.textContent = exempt ? xx("Sí, confirmar: exento (board)", "Yes, confirm: exempt (board)") : xx("Sí, confirmar: llegó $", "Yes, confirm: received $") + amt; msg.textContent = exempt ? xx("Confirme que es miembro del board y no paga cuota.", "Confirm they are a board member and don't pay a fee.") : xx("Confirme que el pago ya está en la cuenta de KAI.", "Confirm the payment is already in KAI's account."); return; }
      go.disabled = true; msg.textContent = xx("Guardando…", "Saving…");
      rpc("staff_pay_confirm", { p_app: isNew ? a.id : null, p_member: isNew ? null : m.kid, p_amount: amt, p_paid_on: date, p_ref: $("#py-ref", ov).value.trim() || null, p_note: $("#py-note", ov).value.trim() || null, p_address: isNew ? $("#py-addr", ov).value.trim() || null : null, p_method: exempt ? "exempt" : "zelle" })
        .then(function (r) { if (!r.new) { ov.remove(); toast(xx("Renovación registrada.", "Renewal recorded.")); route(); return; } return activate(r, ov); })
        .catch(function (e) { go.disabled = false; armed = false; go.textContent = xx("Confirmar pago y activar", "Confirm payment and activate"); msg.textContent = errMsg(e); });
    };
  }
  function activate(r, ov) {
    var c = sb(), steps = [], msg = $("#py-msg", ov);
    msg.textContent = xx("Pago guardado. Preparando la credencial…", "Payment saved. Preparing the credential…");
    var photoP = r.photo ? c.storage.from(BUCKET).download(r.photo).then(function (d) {
      if (d.error) throw d.error; var ext = /png/.test(d.data.type) ? "png" : "jpg", name = r.credential_no + "." + ext;
      return c.storage.from(PHOTOS).upload(name, d.data, { contentType: d.data.type || "image/jpeg", upsert: false }).then(function (u) {
        if (u.error && !/exists|Duplicate/i.test(u.error.message || "")) throw u.error;
        var url = c.storage.from(PHOTOS).getPublicUrl(name).data.publicUrl;
        return rpc("staff_member_photo", { p_member: r.kid, p_url: url });
      });
    }).then(function () { steps.push(xx("✓ Foto copiada a la credencial", "✓ Photo copied to the credential")); }).catch(function () { steps.push(xx("✗ No se pudo copiar la foto: súbala desde Supabase", "✗ Could not copy the photo: upload it from Supabase")); }) : Promise.resolve(r.existing ? 0 : steps.push(xx("· No había foto", "· There was no photo")));
    if (r.existing) steps.push(xx("✓ Ya tenía credencial: se conservó su número y se vinculó la aplicación", "✓ Already had a credential: their number was kept and the application was linked"));
    return photoP.then(function () {
      if (r.existing) return;
      return c.functions.invoke("kai-invite", { body: { email: r.email, redirect: SITE + "/password" } }).then(function (x) {
        if (x.error) throw x.error; steps.push(xx("✓ Invitación enviada a ", "✓ Invitation sent to ") + r.email);
      }).catch(function () { steps.push(xx("✗ No se pudo enviar la invitación. Envíela desde Supabase → Authentication → Users → Invite, al correo ", "✗ Could not send the invitation. Send it from Supabase → Authentication → Users → Invite, to ") + r.email); });
    }).then(function () {
      $(".bd", ov).innerHTML = xx("<p style=\"margin:0 0 6px\"><b>Credencial ", "<p style=\"margin:0 0 6px\"><b>Credential ") + esc(r.credential_no) + xx(" activada</b>, vigente hasta ", " activated</b>, valid until ") + fd(r.valid_to) + '.</p><ul style="margin:12px 0 18px;list-style:none;padding:0">' + steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ul><div class="ft"><a class="btn gold" href="#/staff/member/' + r.kid + xx("\" data-close>Ver perfil del miembro</a></div>", "\" data-close>View member profile</a></div>");
    });
  }

  /* ---------- 5) Necesidades (Parte B) ---------- */
  function needs() {
    loading("needs", xx("Necesidades", "Needs"));
    return rpc("staff_needs").then(function (n) {
      function bars(title, obj, labelFn, total) {
        var k = Object.keys(obj || {}).sort(function (a, b) { return obj[b] - obj[a]; }); if (!k.length) return "";
        var mx = Math.max.apply(null, k.map(function (x) { return obj[x]; }));
        return '<div class="st-card"><h3>' + title + "</h3><div class=\"st-cb st-bars\">" + k.map(function (x) { return '<div><span>' + esc(labelFn(x)) + '</span><i style="--w:' + Math.round(obj[x] / mx * 100) + '%"></i><b>' + obj[x] + (total ? " · " + Math.round(obj[x] / total * 100) + "%" : "") + "</b></div>"; }).join("") + "</div></div>";
      }
      var fo = findF("B", "orient"), fw = findF("B", "ws_topics"), fs = findF("B", "season");
      put(hero("needs", xx("Panel del equipo", "Team panel"), xx("Necesidades de los pastores", "Pastors' needs")) + body(
        xx("<div class=\"st-stats\"><div class=\"st-stat hl\"><small>Aplicaciones</small><b>", "<div class=\"st-stats\"><div class=\"st-stat hl\"><small>Applications</small><b>") + n.total + xx("</b><span>Respondieron la Parte B</span></div><div class=\"st-stat\"><small>Quieren un taller</small><b>", "</b><span>Answered Part B</span></div><div class=\"st-stat\"><small>Want a workshop</small><b>") + n.ws_yes + xx("</b><span>En su iglesia o región</span></div><div class=\"st-stat\"><small>Instituto Morphe</small><b>", "</b><span>At their church or region</span></div><div class=\"st-stat\"><small>Instituto Morphe</small><b>") + n.morphe + xx("</b><span>Pidieron que los contacten</span></div><div class=\"st-stat\"><small>Orientación legal</small><b>", "</b><span>Asked to be contacted</span></div><div class=\"st-stat\"><small>Legal guidance</small><b>") + Object.keys(n.orient || {}).reduce(function (s, k) { return s + n.orient[k]; }, 0) + xx("</b><span>Solicitudes de orientación</span></div></div>", "</b><span>Guidance requests</span></div></div>") +
        '<div class="st-ngrid">' + bars(xx("Lo que más les urge (top 3)", "What is most urgent (top 3)"), n.priorities, ben, n.total) + bars(xx("Qué más les serviría", "What else would help them"), n.also, ben, n.total) + bars(xx("Recursos que buscan", "Resources they are looking for"), n.resources, function (x) { var fr = findF("B", "resources"); return fr ? opt(fr, x) : x; }) + bars(xx("Orientación que piden", "Guidance requested"), n.orient, function (x) { return fo ? opt(fo, x) : x; }) + bars(xx("Temas para talleres", "Workshop topics"), n.ws_topics, function (x) { return fw ? opt(fw, x) : x; }) + bars(xx("¿Cómo describen su temporada?", "How do they describe their season?"), n.season, function (x) { return fs ? opt(fs, x) : x; }) + "</div>"));
    });
  }

  /* ---------- 6) Cuidado pastoral (Parte C) ---------- */
  var FLAG = { contact: ["c", LZ("Pidió contacto", "Asked for contact")], burnout: ["r", LZ("Agotamiento", "Burnout")], loss: ["r", LZ("Duelo", "Grief")], lonely: ["r", LZ("Soledad", "Loneliness")], marriage: ["r", LZ("Matrimonio", "Couple")], conflict: ["r", LZ("Conflicto", "Conflict")], finance: ["f", LZ("Finanzas", "Finances")] };
  function care(id) {
    loading("care", xx("Cuidado pastoral", "Pastoral care"));
    return rpc("care_list").then(function (list) {
      var sel = id || (list[0] && list[0].id);
      var cnt = function (f) { return list.filter(function (x) { return (x.flags || []).indexOf(f) >= 0; }).length; };
      var alert = cnt("burnout") + cnt("loss") + cnt("lonely") + cnt("marriage") + cnt("conflict");
      var lst = xx("<div class=\"st-clist\"><h3>Requieren atención · ", "<div class=\"st-clist\"><h3>Need attention · ") + list.length + "</h3>" + (list.map(function (x) {
        return '<a class="st-ci' + (x.id === sel ? " on" : "") + '" href="#/staff/care/' + x.id + '"><div class="st-av">' + esc(ini(x.name)) + "</div><div><b>" + esc(x.name) + "</b><span>" + (x.member_kid ? xx("Miembro · ", "Member · ") : xx("Aplicación · ", "Application · ")) + esc(x.app_no) + (x.owner ? " · " + esc(x.owner) : xx(" · sin asignar", " · unassigned")) + '</span><div class="fl">' + (x.flags || []).map(function (f) { return '<i class="' + FLAG[f][0] + '">' + FLAG[f][1] + "</i>"; }).join("") + "</div></div></a>";
      }).join("") || xx("<div class=\"st-cb st-empty\">Nadie requiere atención por ahora.</div>", "<div class=\"st-cb st-empty\">No one needs attention right now.</div>")) + "</div>";
      var head = hero("care", xx("Panel del equipo", "Team panel"), xx("Cuidado pastoral", "Pastoral care"), xx("<span>Hola, ", "<span>Hello, ") + esc(ST.me.name) + xx("</span><span class=\"st-role\">Cuidado pastoral</span><span>Confidencial · solo su equipo ve esta sección</span>", "</span><span class=\"st-role\">Pastoral care</span><span>Confidential · only your team sees this section</span>"));
      var alerts = '<div class="st-alerts" style="margin-bottom:22px"><div class="st-al cnt on"><b>' + cnt("contact") + xx("</b><strong>Pidieron contacto</strong><span>Querían que alguien los llamara</span></div><div class=\"st-al ren\"><b>", "</b><strong>Asked for contact</strong><span>Wanted someone to call them</span></div><div class=\"st-al ren\"><b>") + alert + xx("</b><strong>Señales de alerta</strong><span>Agotamiento, duelo, soledad o conflicto</span></div><div class=\"st-al pay\"><b>", "</b><strong>Warning signs</strong><span>Burnout, grief, loneliness or conflict</span></div><div class=\"st-al pay\"><b>") + cnt("finance") + xx("</b><strong>Consultas financieras</strong><span>Autorizaron contacto con asesores</span></div><div class=\"st-al prt\"><b>", "</b><strong>Financial questions</strong><span>Authorized contact with advisors</span></div><div class=\"st-al prt\"><b>") + list.filter(function (x) { return !x.owner; }).length + xx("</b><strong>Sin asignar</strong><span>Nadie ha tomado el caso</span></div></div>", "</b><strong>Unassigned</strong><span>No one has taken the case</span></div></div>");
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
    var ind = [[xx("Salud espiritual", "Spiritual health"), "spirit"], [xx("Salud física y emocional", "Physical and emotional health"), "health"], [xx("Matrimonio", "Marriage"), "marriage"]].filter(function (x) { return d[x[1]]; }).map(function (x) { var f = findF("C", x[1]); return "<div><small>" + x[0] + "</small>" + dots(d[x[1]]) + "<span><b>" + d[x[1]] + xx(" de 5</b> · ", " of 5</b> · ") + (f ? "1 = " + f.sc[0][li()] + ", 5 = " + f.sc[1][li()] : "") + "</span></div>"; }).join("");
    var secs = SC.C.map(function (s) { var h = secHTML(s, d); return h ? '<div class="st-card"><h3>' + esc(s.t[li()]) + xx(" <small>Parte C</small></h3>", " <small>Part C</small></h3>") + h.replace('<div class="st-sec"><h4>' + esc(s.t[li()]) + "</h4>", '<div class="st-sec">') + "</div>" : ""; }).join("");
    var notes = (c.notes || []).map(function (n) { var t = { care_take: xx("tomó el caso", "took the case"), care_note: xx("· nota", "· note"), care_pdf: xx("descargó la Parte C en PDF", "downloaded Part C as PDF"), care_closed: xx("cerró el caso", "closed the case") }[n.kind] || n.kind; return '<li class="' + (n.kind === "care_note" ? "note" : "sys") + '"><b>' + esc(n.actor || "") + " " + t + "</b><time>" + fdt(n.at) + "</time>" + (n.kind === "care_note" || n.kind === "care_closed" ? "<p>" + esc(n.note || "") + "</p>" : "") + "</li>"; }).join("");
    return '<div class="st-card"><h3>' + esc(c.name) + ' <span class="st-pdfb">' + (c.owner ? "" : xx("<button class=\"st-mini\" data-act=\"take\">Tomar el caso</button>", "<button class=\"st-mini\" data-act=\"take\">Take the case</button>")) + xx("<button class=\"btn gold\" data-act=\"pdf\">Descargar Parte C (PDF)</button></span></h3><div class=\"st-cb\"><p class=\"st-subline\">", "<button class=\"btn gold\" data-act=\"pdf\">Download Part C (PDF)</button></span></h3><div class=\"st-cb\"><p class=\"st-subline\">") + esc([c.title, c.church, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + xx(" · Respondió el ", " · Answered on ") + fd(c.created_at) + xx(" al aplicar", " when applying") + (c.owner ? xx(" · Lleva el caso: <b>", " · Case owner: <b>") + esc(c.owner) + "</b>" : "") + '</p><div class="st-kv" style="margin-bottom:18px">' + kv(xx("Teléfono", "Phone"), KPH(c.phone)) + kv(xx("Correo", "Email"), c.email) + kv(xx("Cónyuge", "Spouse"), c.spouse_name) + "</div>" + (ind ? '<div class="st-ind">' + ind + "</div>" : "") + "</div></div>" + secs +
      xx("<div class=\"st-card\"><h3>Notas confidenciales <small>Solo Cuidado pastoral</small></h3><ul class=\"st-log\">", "<div class=\"st-card\"><h3>Confidential notes <small>Pastoral care only</small></h3><ul class=\"st-log\">") + (notes || xx("<li class=\"sys\"><b>Sin notas todavía</b></li>", "<li class=\"sys\"><b>No notes yet</b></li>")) + xx("</ul><div class=\"st-add\"><textarea id=\"cn-note\" placeholder=\"Agregar una nota confidencial…\"></textarea><div><span>Solo la ve Cuidado pastoral. No se puede editar ni borrar.</span><span><button class=\"st-mini\" data-act=\"close\">Cerrar caso</button> <button class=\"st-mini solid\" data-act=\"cnote\">Agregar nota</button></span></div></div></div>", "</ul><div class=\"st-add\"><textarea id=\"cn-note\" placeholder=\"Add a confidential note…\"></textarea><div><span>Only Pastoral care sees it. It cannot be edited or deleted.</span><span><button class=\"st-mini\" data-act=\"close\">Close case</button> <button class=\"st-mini solid\" data-act=\"cnote\">Add note</button></span></div></div></div>");
  }
  function bindCare(c) {
    function act(a, note, b) { if (b) b.disabled = true; return rpc("care_act", { p_id: c.id, p_act: a, p_note: note || null }).then(function () { if (a !== "pdf") route(); }).catch(function (e) { if (b) b.disabled = false; toast(errMsg(e), true); }); }
    on("take", function (b) { act("take", null, b); });
    on("cnote", function (b) { var n = $("#cn-note", ROOT).value.trim(); if (!n) return toast(xx("Escriba la nota.", "Write the note."), true); act("note", n, b); });
    on("close", function (b) { var n = $("#cn-note", ROOT).value.trim(); if (!confirmInline(b, xx("¿Cerrar el caso? Sale de la lista.", "Close the case? It leaves the list."))) return; act("close", n || xx("Caso atendido", "Case closed"), b); });
    on("pdf", function () { carePdf(c, act); });
  }
  function confirmInline(b, q) { if (b.dataset.armed) return true; b.dataset.armed = "1"; b.textContent = xx("Sí, cerrar", "Yes, close"); toast(q); return false; }
  function pw() { var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", o = "", r = new Uint32Array(9); crypto.getRandomValues(r); for (var i = 0; i < 9; i++) { o += A[r[i] % A.length]; if (i === 2 || i === 5) o += "-"; } return o; }
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function loadPdf() { if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve(); return loadScript(PDFLIB[0]).then(function () { return loadScript(PDFLIB[1]); }); }
  function carePdf(c, act) {
    var pass = pw(), when = fdt(new Date().toISOString()), wm = xx("CONFIDENCIAL · DESCARGADO POR ", "CONFIDENTIAL · DOWNLOADED BY ") + (ST.me.name || "").toUpperCase() + " · " + when.toUpperCase();
    var ov = modal(xx("<h3>Descargar Parte C · Confidencial</h3><div class=\"bd\"><p style=\"margin:0\">Se descargará un PDF con las respuestas de la Parte C de <b>", "<h3>Download Part C · Confidential</h3><div class=\"bd\"><p style=\"margin:0\">A PDF will be downloaded with the Part C answers of <b>") + esc(c.name) + xx("</b>. Para abrirlo se necesita esta contraseña:</p><div class=\"st-pw\"><div><small>Contraseña del PDF</small><b>", "</b>. This password is needed to open it:</p><div class=\"st-pw\"><div><small>PDF password</small><b>") + pass + xx("</b></div><button type=\"button\" id=\"pw-copy\">Copiar</button></div><div class=\"st-wm\">Cada página llevará la marca de agua: <b>", "</b></div><button type=\"button\" id=\"pw-copy\">Copy</button></div><div class=\"st-wm\">Each page will carry the watermark: <b>") + esc(xx("Confidencial · descargado por ", "Confidential · downloaded by ") + ST.me.name + " · " + when) + xx("</b></div><ul><li>La contraseña se muestra solo esta vez; no la envíe en el mismo correo o mensaje que el PDF.</li><li>La descarga queda registrada en el historial del pastor.</li><li>Borre el archivo cuando ya no lo necesite.</li></ul><p class=\"st-msg\" id=\"pw-msg\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>Cancelar</button><button class=\"btn gold\" id=\"pw-go\">Descargar PDF</button></div></div>", "</b></div><ul><li>The password is shown only this once; don't send it in the same email or message as the PDF.</li><li>The download is recorded in the pastor's history.</li><li>Delete the file when you no longer need it.</li></ul><p class=\"st-msg\" id=\"pw-msg\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>Cancel</button><button class=\"btn gold\" id=\"pw-go\">Download PDF</button></div></div>"));
    $("#pw-copy", ov).onclick = function () { try { navigator.clipboard.writeText(pass); this.textContent = xx("Copiada", "Copied"); } catch (e) {} };
    $("#pw-go", ov).onclick = function () {
      var b = this; b.disabled = true; $("#pw-msg", ov).textContent = xx("Preparando…", "Preparing…");
      loadPdf().then(function () {
        var d = c.care || {}, content = [{ text: xx("Cuidado pastoral · Parte C", "Pastoral care · Part C"), fontSize: 9, bold: true, color: "#b8892e", characterSpacing: 1.2 }, { text: c.name, fontSize: 18, bold: true, color: "#0b1f4b", margin: [0, 2, 0, 2] }, { text: [c.title, c.church, [c.city, c.state].filter(Boolean).join(", "), xx("Aplicación ", "Application ") + c.app_no, xx("Respondió el ", "Answered on ") + fd(c.created_at)].filter(Boolean).join(" · "), fontSize: 9, color: "#5b6577", margin: [0, 0, 0, 12] }];
        SC.C.forEach(function (s) {
          var rows = []; s.f.forEach(function (f) { if (!f.k || !shown(f, d)) return; var v = fval(f, d); if (v) rows.push([{ text: lbl(f).toUpperCase(), fontSize: 7, bold: true, color: "#b8892e" }, { text: v, fontSize: 10 }]); });
          if (!rows.length) return;
          content.push({ text: s.t[li()].toUpperCase(), fontSize: 9, bold: true, color: "#0b1f4b", margin: [0, 10, 0, 4] });
          content.push({ table: { widths: [150, "*"], body: rows }, layout: { hLineColor: function () { return "#e2e8f1"; }, vLineWidth: function () { return 0; }, hLineWidth: function () { return 0.6; }, paddingTop: function () { return 4; }, paddingBottom: function () { return 4; } } });
        });
        if ((c.notes || []).some(function (n) { return n.kind === "care_note"; })) { content.push({ text: xx("NOTAS CONFIDENCIALES", "CONFIDENTIAL NOTES"), fontSize: 9, bold: true, color: "#0b1f4b", margin: [0, 14, 0, 4] }); c.notes.filter(function (n) { return n.kind === "care_note"; }).forEach(function (n) { content.push({ text: [{ text: (n.actor || "") + " · " + fdt(n.at) + "\n", fontSize: 8, color: "#5b6577" }, { text: n.note || "", fontSize: 10 }], margin: [0, 0, 0, 6] }); }); }
        var dd = { pageSize: "LETTER", pageMargins: [48, 60, 48, 50], version: "1.7", userPassword: pass, ownerPassword: pw() + pw(), permissions: { printing: "highResolution", modifying: false, copying: false, annotating: false },
          watermark: { text: xx("CONFIDENCIAL", "CONFIDENTIAL"), color: "#b42318", opacity: 0.08, bold: true },
          header: { text: wm, alignment: "center", fontSize: 7.5, color: "#b42318", margin: [0, 24, 0, 0], characterSpacing: 0.6 },
          footer: function (p, n) { return { text: xx("Kingdom Alliance International · Confidencial · Página ", "Kingdom Alliance International · Confidential · Page ") + p + xx(" de ", " of ") + n, alignment: "center", fontSize: 7.5, color: "#5b6577", margin: [0, 16, 0, 0] }; },
          info: { title: xx("Parte C · ", "Part C · ") + c.app_no, author: "Kingdom Alliance International" }, content: content, defaultStyle: { fontSize: 10, color: "#101828" } };
        window.pdfMake.createPdf(dd).download("KAI-ParteC-" + c.app_no + ".pdf");
        return act("pdf");
      }).then(function () { $("#pw-msg", ov).textContent = xx("Listo. La descarga quedó registrada.", "Done. The download was recorded."); b.textContent = xx("Descargado", "Downloaded"); })
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
      $$(".kx-staffbtn, .kx-none-acts").forEach(function (b) { b.remove(); }); var old = $("#kx-mbox"); if (old) old.remove();
      if (!r.data || !r.data.session) return;
      c.rpc("staff_me").then(function (x) {
        if (x.data && x.data.roles && x.data.roles.length) {
          var btn = '<a class="btn gold kx-staffbtn" href="#/staff">' + xx("Panel del equipo", "Team panel") + "</a>";
          var out = $("#m-in .mhead .m-out");
          if (out && !$("#m-in .kx-staffbtn")) { if (!out.parentNode.classList.contains("kx-acts")) { var w = document.createElement("div"); w.className = "kx-acts"; out.parentNode.insertBefore(w, out); w.appendChild(out); } out.insertAdjacentHTML("beforebegin", btn); }
          var nf = $("#m-none .form"); if (nf && !$(".kx-none-acts", nf)) {
            var h3 = $("h3", nf), p = $("p.sub", nf);
            if (h3) { h3.removeAttribute("data-i"); h3.textContent = xx("Todavía no tienes credencial de miembro", "You don't have a member credential yet"); }
            if (p) { p.removeAttribute("data-i"); p.textContent = xx("Tu cuenta del equipo ya está activa. Cuando llenes tu aplicación y quede aprobada, tu credencial aparecerá aquí.", "Your team account is active. Once you fill out your application and it is approved, your credential will appear here."); }
            var outb = $(".m-out", nf), acts = '<div class="kx-acts kx-none-acts" style="margin:6px 0 14px">' + btn.replace('class="btn gold kx-staffbtn"', 'class="btn gold"') + '<a class="btn navy" href="#/apply">' + xx("Llenar mi aplicación", "Fill out my application") + "</a></div>";
            if (outb) outb.insertAdjacentHTML("beforebegin", acts); else nf.insertAdjacentHTML("beforeend", acts);
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
