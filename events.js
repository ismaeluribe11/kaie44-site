/* KAI · Eventos (parte pública)
   #/events            lista de eventos publicados
   #/ev/SLUG[?c=CODE]  página del evento + registro (c = enlace de cortesía del Board)
   #/evr/TOKEN         mi registro (confirmación, QR, pago por Zelle, cancelar, calendario)
   #/checkin/SLUG      check-in (equipo con login o voluntario con PIN)
   #/eval/TOKEN        evaluación anónima del equipo */
(function () {
  "use strict";
  var SITE = /(^|\.)kaie44\.org$/.test(location.hostname) ? "https://www.kaie44.org" : location.origin;
  function sb() { return window.KAI && window.KAI.sb ? window.KAI.sb : null; }
  // Pide a "kai-mail" que envíe de inmediato los correos en cola (si falla, la tarea programada los envía en minutos)
  function kick() { try { fetch("https://mejypcqqpejsxackkngb.supabase.co/functions/v1/kai-mail?kick=1", { method: "POST", keepalive: true }).catch(function () {}); } catch (e) {} }
  window.KAIEV_KICK = kick;
  function lang() { try { return window.L === "es" ? "es" : "en"; } catch (e) { return "es"; } }
  function T(es, en) { return lang() === "es" ? es : en; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function rpc(fn, args) {
    var c = sb(); if (!c) return Promise.reject(new Error("offline"));
    return c.rpc(fn, args || {}).then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  var TZ = "America/Los_Angeles";
  function fdate(iso, o) { try { return new Date(iso).toLocaleDateString(lang() === "es" ? "es-US" : "en-US", Object.assign({ timeZone: TZ }, o || { weekday: "long", day: "numeric", month: "long", year: "numeric" })).replace(/^([^\s,]+),/, "$1"); } catch (e) { return ""; } }
  function ftime(iso) { try { return new Date(iso).toLocaleTimeString(lang() === "es" ? "es-US" : "en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).replace(/\s?a\.\s?m\./, " a.m.").replace(/\s?p\.\s?m\./, " p.m."); } catch (e) { return ""; } }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function money(n) { n = +n || 0; return "$" + (n % 1 ? n.toFixed(2) : n.toFixed(0)); }
  // Texto según el idioma elegido; si falta en ese idioma, se usa el otro
  function pick(es, en) { return lang() === "en" ? (en || es || "") : (es || en || ""); }
  function title(e) { return pick(e.title, e.title_en); }
  function desc(e) { return pick(e.description, e.description_en); }
  function arrive(e) { return pick(e.arrive_note, e.arrive_note_en); }
  function paid(e) { return (+e.price_adult || 0) > 0 || (+e.price_child || 0) > 0; }
  function couple(e) { return e && e.price_mode === "couple"; }
  function mapsUrl(a) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(a || ""); }
  function errText(e) {
    var m = String((e && (e.message || e.msg)) || e || "");
    if (/ev_closed/.test(m)) return T("El registro para este evento ya está cerrado.", "Registration for this event is closed.");
    if (/ev_full/.test(m)) return T("Ya no hay lugares disponibles para este evento.", "This event is full.");
    if (/invalid_email/.test(m)) return T("Revisa tu correo electrónico.", "Please check your email address.");
    if (/invalid_guest_email/.test(m)) return T("Revisa el correo de tus invitados.", "Please check your guests' email addresses.");
    if (/missing_guest_name/.test(m)) return T("Escribe nombre y apellido de cada invitado.", "Enter first and last name for each guest.");
    if (/missing_name/.test(m)) return T("Escribe tu nombre y apellido.", "Enter your first and last name.");
    if (/courtesy_full:(\d+)/.test(m)) return T("Este enlace de cortesía solo tiene " + m.match(/courtesy_full:(\d+)/)[1] + " lugar(es) disponible(s).", "This courtesy link only has " + m.match(/courtesy_full:(\d+)/)[1] + " spot(s) left.");
    if (/bad_code/.test(m)) return T("El enlace de cortesía no es válido.", "The courtesy link is not valid.");
    if (/members_only/.test(m)) return T("Este evento es solo para miembros de KAI. Inicia sesión en el Área de Miembros.", "This event is for KAI members only. Please sign in to the Members Area.");
    if (/couple_spouse/.test(m)) return T("Este evento es para matrimonios: escribe el nombre de tu esposo(a).", "This event is for married couples: enter your spouse's name.");
    if (/couple_only_kids/.test(m)) return T("En este evento solo puedes agregar a tu esposo(a) y a tus hijos menores.", "For this event you can only add your spouse and your minor children.");
    if (/too_many_guests/.test(m)) return T("Demasiados invitados para este evento.", "Too many guests for this event.");
    if (/too_many/.test(m)) return T("Ya hay varios registros con este correo hoy. Escríbenos a info@kaie44.org.", "There are already several registrations with this email today. Write to info@kaie44.org.");
    if (/bad_pin/.test(m)) return T("PIN incorrecto o no es el día del evento.", "Wrong PIN, or today is not the event day.");
    if (/already/.test(m)) return T("Esta evaluación ya fue contestada. ¡Gracias!", "This evaluation was already submitted. Thank you!");
    if (/closed/.test(m)) return T("La evaluación ya cerró.", "The evaluation is closed.");
    if (/Failed to fetch|offline|NetworkError/i.test(m)) return T("No hay conexión. Intenta de nuevo.", "No connection. Please try again.");
    return T("Algo salió mal. Intenta de nuevo o escríbenos a info@kaie44.org.", "Something went wrong. Try again or write to info@kaie44.org.");
  }
  function hashParts() {
    var h = (location.hash || "").replace(/^#\/?/, ""), q = "", i = h.indexOf("?");
    if (i >= 0) { q = h.slice(i + 1); h = h.slice(0, i); }
    return { path: h.split("/"), q: new URLSearchParams(q) };
  }
  function qrSvg(text, size) {
    if (!window.qrcode) return "";
    var q = window.qrcode(0, "M"); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: Math.max(2, Math.floor((size || 150) / (q.getModuleCount() + 4))), margin: 2, scalable: true });
  }
  var IC = {
    cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.3-7-11.5A7 7 0 0 1 19 9.5C19 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    ppl: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.4.1 4.3 1.6 4.9 4.8"/></svg>',
    tag: '<svg viewBox="0 0 24 24"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>'
  };
  function root() { return $("#evx"); }
  function hero(eyebrow, h1) { return '<div class="hero sm"><div class="wrap"><div class="eyebrow">' + esc(eyebrow) + "</div><h1>" + esc(h1) + "</h1></div></div>"; }
  function put(html) { var r = root(); if (r) r.innerHTML = html; }
  function wait() { put(hero("Kingdom Alliance International · E4:4", T("Eventos", "Events")) + '<section class="s"><div class="wrap"><p class="evx-wait">' + T("Cargando…", "Loading…") + "</p></div></section>"); }

  /* ================= LISTA (#/events) ================= */
  var LIST = null;
  function renderList() {
    var v = $('.view[data-v="events"] section.s .wrap'); if (!v) return;
    var empty = $(".evempty", v), box = $(".evl", v);
    if (!LIST || !LIST.length) { if (empty) empty.hidden = false; if (box) box.remove(); return; }
    if (empty) empty.hidden = true;
    if (!box) { box = document.createElement("div"); box.className = "evl"; v.appendChild(box); }
    box.innerHTML = LIST.map(function (e) {
      var cx = e.status === "cancelled", tag = cx ? T("Cancelado", "Cancelled") : e.audience === "members" ? T("Solo miembros", "Members only") : T("Abierto a invitados", "Guests welcome");
      return '<article class="evc"><a class="evc-ph" href="#/ev/' + esc(e.slug) + '" style="background-image:url(&quot;' + esc(e.photo_url || "images/mission.jpg") + '&quot;)"><span class="evc-tag' + (cx ? " cx" : "") + '">' + tag + "</span></a>" +
        '<div class="evc-bd">' + (e.series ? '<div class="evc-ey">' + esc(e.series) + "</div>" : "") + "<h3>" + esc(title(e)) + "</h3>" +
        (desc(e) ? "<p>" + esc(desc(e)).slice(0, 220) + "</p>" : "") +
        '<div class="evc-dt"><div class="evc-cal"><b>' + esc(fdate(e.starts_at, { month: "short" }).replace(".", "").toUpperCase()) + "</b><i>" + esc(fdate(e.starts_at, { day: "numeric" })) + "</i></div><div><div class=\"z\">" +
        esc(cap(fdate(e.starts_at, { weekday: "long", day: "numeric", month: "long" }))) + " · " + esc(ftime(e.starts_at)) + '</div><div class="h">' + esc([e.venue, (e.address || "").split(",").slice(-2).join(",").trim()].filter(Boolean).join(" · ")) + "</div></div></div>" +
        '<div class="evc-act">' + (cx ? '<span class="evx-pill">' + T("Este evento fue cancelado", "This event was cancelled") + "</span>" : e.open ? '<a class="btn gold" href="#/ev/' + esc(e.slug) + '?go=rsvp">' + T("Confirmar asistencia", "RSVP") + "</a>" : '<span class="evx-pill">' + (e.full ? T("Cupo lleno", "Full") : T("Registro cerrado", "Registration closed")) + "</span>") +
        '<a class="evx-lnk" href="#/ev/' + esc(e.slug) + '">' + T("Ver detalles", "Details") + " →</a></div></div></article>";
    }).join("");
  }
  function loadList() {
    rpc("ev_public_list").then(function (x) { LIST = x || []; renderList(); }).catch(function () { LIST = []; renderList(); });
  }

  /* ================= DETALLE + REGISTRO (#/ev/SLUG) ================= */
  var EV = null, FORM = { guests: [] }, ME = null;
  function loadEvent(slug, code) {
    wait();
    var pv = hashParts().q.get("preview") === "1";
    (pv ? rpc("ev_staff_preview", { p_slug: slug }).catch(function () { return rpc("ev_public_get", { p_slug: slug, p_code: null }); }) : rpc("ev_public_get", { p_slug: slug, p_code: code || null })).then(function (e) {
      if (!e) { put(hero("Kingdom Alliance International · E4:4", T("Eventos", "Events")) + '<section class="s"><div class="wrap"><p>' + T("No encontramos este evento.", "We could not find this event.") + ' <a class="evx-lnk" href="#/events">' + T("Ver eventos", "See events") + "</a></p></div></section>"); return; }
      if (pv && !e.preview) { put(hero("Kingdom Alliance International · E4:4", T("Eventos", "Events")) + '<section class="s"><div class="wrap"><p>' + T("La vista previa es solo para el equipo. Inicia sesión en el Área de Miembros (con tu código de dos pasos) y abre el enlace otra vez.", "Preview is for the team only. Sign in to the Members Area (with your two-step code) and open the link again.") + "</p></div></section>"); return; }
      EV = e; EV.code = code || ""; FORM = { guests: [], cps: [] };
      return memberPrefill().then(renderEvent);
    }).catch(function (er) { put('<section class="s"><div class="wrap"><p class="evx-err">' + esc(errText(er)) + "</p></div></section>"); });
  }
  function memberPrefill() {
    var c = sb(); ME = null; if (!c) return Promise.resolve();
    return c.auth.getSession().then(function (r) {
      var s = r.data && r.data.session; if (!s) return;
      var em = String(s.user.email || "").toLowerCase();
      return c.from("members").select("full_name,email,phone,church,city,state").ilike("email", em.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle().then(function (m) {
        ME = { email: em, m: m.data || null };
      });
    }).catch(function () {});
  }
  function guestCard(i) {
    var g = FORM.guests[i] || {};
    if (couple(EV)) return '<div class="gst" data-g="' + i + '"><div class="gh"><b>' + T("Hijo(a)", "Child") + " " + (i + 1) + '</b><span class="mn">' + T("Menor de edad", "Under 18") + '</span></div><div class="r2"><input data-gf="first_name" placeholder="' + T("Nombre", "First name") + '" value="' + esc(g.first_name || "") + '"><input data-gf="last_name" placeholder="' + T("Apellido", "Last name") + '" value="' + esc(g.last_name || "") + '"></div></div>';
    return '<div class="gst" data-g="' + i + '"><div class="gh"><b>' + T("Invitado", "Guest") + " " + (i + 1) + "</b></div>" +
      '<div class="r2"><input data-gf="first_name" placeholder="' + T("Nombre", "First name") + '" value="' + esc(g.first_name || "") + '"><input data-gf="last_name" placeholder="' + T("Apellido", "Last name") + '" value="' + esc(g.last_name || "") + '"></div>' +
      (g.minor ? "" : '<input data-gf="email" type="email" class="gm" placeholder="' + T("Correo (opcional) · le enviaremos su QR", "Email (optional) · we will send their QR") + '" value="' + esc(g.email || "") + '">') + "</div>";
  }
  function totals() {
    var e = EV, cp = couple(e), n = 1 + FORM.guests.length + (cp ? 1 : 0), kids = cp ? FORM.guests.length : FORM.guests.filter(function (g) { return g.minor; }).length, ad = n - kids;
    var free = !!(e.courtesy && !e.courtesy.invalid);
    var bd = cp ? 0 : formEmails().filter(function (v, i, a) { return a.indexOf(v) === i && isBd(v); }).length;
    var tot = free ? 0 : (cp ? (+e.price_adult || 0) : Math.max(ad - bd, 0) * (+e.price_adult || 0)) + kids * (+e.price_child || 0);
    return { n: n, ad: ad, kids: kids, tot: tot, free: free, cp: cp, bd: bd };
  }
  /* ---- Registro por matrimonio: varias parejas, cada persona con teléfono y correo ---- */
  var EMRX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function cpName(h, w) {
    var a = (h.first_name || "").trim(), b = (w.first_name || "").trim(), la = (h.last_name || "").trim(), lb = (w.last_name || "").trim();
    if (!a && !b) return "";
    if (la && lb && la.toLowerCase() !== lb.toLowerCase()) return (a + " " + la).trim() + " " + T("y", "&") + " " + (b + " " + lb).trim();
    return [a, b].filter(Boolean).join(" " + T("y", "&") + " ") + (la || lb ? " " + (la || lb) : "");
  }
  function cpOk(o) { return !!((o.first_name || "").trim() && (o.last_name || "").trim() && (o.phone || "").replace(/\D/g, "").length >= 7 && EMRX.test((o.email || "").trim())); }
  function cpEmpty(c) { return !["h", "w"].some(function (q) { return ["first_name", "last_name", "phone", "email"].some(function (k) { return (c[q][k] || "").trim(); }); }); }
  function cpPerson(i, q, o, lbl) {
    function x(k, ph, t) { return '<input data-c="' + i + '" data-p="' + q + '" data-k="' + k + '" type="' + (t || "text") + '" placeholder="' + ph + '" value="' + esc(o[k] || "") + '">'; }
    return '<div class="cpw">' + lbl + '</div><div class="r2">' + x("first_name", T("Nombre", "First name")) + x("last_name", T("Apellido", "Last name")) + '</div><div class="r2">' + x("phone", T("Teléfono", "Phone"), "tel") + x("email", T("Correo", "Email"), "email") + "</div>";
  }
  function cpMe() {
    var f = $("#rsvp"); if (!f) return { h: {}, w: {} };
    function v(sel) { var el = f.querySelector(sel); return el ? el.value : ""; }
    return { h: { first_name: v("[name=first_name]"), last_name: v("[name=last_name]"), phone: v("[name=phone]"), email: v("[name=email]") },
             w: { first_name: v("#sp-fn"), last_name: v("#sp-ln"), phone: v("#sp-ph"), email: v("#sp-em") } };
  }
  function cpMax() {
    var e = EV, m = e.max_couples != null && e.max_couples !== "" ? +e.max_couples : 1e9;
    if (e.left != null) m = Math.min(m, Math.floor(+e.left / 2));
    if (e.courtesy && !e.courtesy.invalid && e.courtesy.left != null) m = Math.min(m, Math.floor(+e.courtesy.left / 2));
    return m;
  }
  function drawCouples() {
    var b = $("#ev-cps"); if (!b) return;
    b.innerHTML = (FORM.cps || []).map(function (c, i) {
      var n = i + 2;
      if (c.open) return '<div class="cpl"><div class="cph"><b><span class="cpn">' + n + "</span>" + T("Pareja", "Couple") + " " + n + "</b><span>" + T("Cada quien recibe su QR por correo", "Each person gets their QR by email") + "</span></div>" +
        cpPerson(i, "h", c.h, T("Esposo", "Husband")) + cpPerson(i, "w", c.w, T("Esposa", "Wife")) +
        '<div class="cpb"><button type="button" class="cp-ok" data-ok="' + i + '">✓ ' + T("Listo", "Done") + '</button><button type="button" class="lnkb" data-rm="' + i + '">' + T("Quitar", "Remove") + "</button></div></div>";
      return '<div class="cpd"><div><b><span class="cpn cpn-ok">' + n + "</span>" + esc(cpName(c.h, c.w)) + "</b><small>" + esc(c.h.email) + " · " + esc(c.w.email) + '</small></div><div><button type="button" class="lnkb" data-ed="' + i + '">' + T("Editar", "Edit") + '</button><button type="button" class="lnkb r" data-rm="' + i + '">' + T("Quitar", "Remove") + "</button></div></div>";
    }).join("");
    var add = $("#cp-add"), full = 1 + (FORM.cps || []).length >= cpMax();
    if (add) { add.hidden = full; var nt = $("#cp-lim"); if (nt) nt.hidden = !full || cpMax() >= 1e9; }
    renderTotals();
  }
  function cpCloseOpen() {   // valida la pareja abierta; devuelve false si le falta algo
    var msg = $("#ev-msg"), ok = true;
    (FORM.cps || []).forEach(function (c, i) {
      if (!c.open || !ok) return;
      if (cpEmpty(c)) { FORM.cps.splice(i, 1); return; }
      if (!cpOk(c.h) || !cpOk(c.w)) { ok = false; if (msg) msg.textContent = T("Pareja ", "Couple ") + (i + 2) + T(": escribe nombre, apellido, teléfono y correo de los dos.", ": enter first name, last name, phone and email for both."); return; }
      c.open = false;
    });
    if (ok && msg) msg.textContent = "";
    return ok;
  }
  /* Reconoce en vivo los correos del Board (no pagan) */
  var BOARD = {}, bdT = null, bdLast = "";
  function isBd(em) { return !!BOARD[String(em || "").trim().toLowerCase()]; }
  function formEmails() {
    var f = $("#rsvp"); if (!f) return [];
    return $$("input[type=email]", f).map(function (i) { return (i.value || "").trim().toLowerCase(); }).filter(function (v) { return EMRX.test(v); });
  }
  function boardCheck() {
    clearTimeout(bdT);
    bdT = setTimeout(function () {
      var ems = formEmails().filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 40), key = ems.join(",");
      if (key === bdLast) return;
      bdLast = key;
      if (!ems.length) { BOARD = {}; renderTotals(); return; }
      rpc("ev_board_check", { p_emails: ems }).then(function (r) { BOARD = {}; (r || []).forEach(function (x) { BOARD[x] = 1; }); renderTotals(); }).catch(function () {});
    }, 450);
  }
  function renderTotals() {
    var b = $("#ev-tot"); if (!b) return; var t = totals(), e = EV;
    if (couple(e)) {
      var me = cpMe(), list = [{ n: cpName(me.h, me.w) || T("Tu matrimonio", "Your couple"), you: true, bd: isBd(me.h.email) || isBd(me.w.email) }].concat((FORM.cps || []).map(function (c) { return { n: cpName(c.h, c.w) || T("Nueva pareja", "New couple"), bd: isBd(c.h.email) || isBd(c.w.email) }; }));
      var pr = t.free ? 0 : (+e.price_adult || 0), pd = paid(e), tot = list.reduce(function (a, x) { return a + (x.bd ? 0 : pr); }, 0);
      var h = '<div class="paybox sm cpsum"><h4>' + T("Tu registro · ", "Your registration · ") + list.length + " " + T(list.length === 1 ? "matrimonio" : "matrimonios", list.length === 1 ? "couple" : "couples") + "</h4>" +
        list.map(function (x) { return '<div class="ln"><span>' + esc(x.n) + (x.you ? " <i>· " + T("ustedes", "you") + "</i>" : "") + (x.bd ? ' <em class="bdg">Board KAI</em>' : "") + "</span><span>" + (pd ? money(x.bd ? 0 : pr) : "") + "</span></div>"; }).join("") +
        (pd ? '<div class="ln t"><span>Total</span><span>' + money(tot) + "</span></div>" : "") +
        (t.free ? '<p class="fine" style="text-align:left;margin:6px 0 0">' + T("Cortesía de ", "Courtesy of ") + esc(e.courtesy.by) + "</p>" : pd ? '<p class="fine" style="text-align:left;margin:6px 0 0">' + T("Los matrimonios del Board de KAI no pagan; el sistema los reconoce por su correo.", "KAI Board couples do not pay; they are recognized by email.") + "</p>" : "") + "</div>";
      b.innerHTML = h;
      var bar = $("#cp-bar"); if (bar) bar.innerHTML = "<div><small>" + list.length + " " + T(list.length === 1 ? "matrimonio" : "matrimonios", list.length === 1 ? "couple" : "couples") + "</small><b>" + (pd ? money(tot) : T("Sin costo", "Free")) + '</b></div><button type="button" id="cp-go">' + (pd && tot > 0 ? T("Registrarnos", "Register") : T("Confirmar", "Confirm")) + " →</button>";
      var gb = $("#cp-go"); if (gb) gb.onclick = function () { var f = $("#rsvp"); if (f.requestSubmit) f.requestSubmit(); else f.onsubmit({ preventDefault: function () {} }); };
      var btn0 = $("#ev-go"); if (btn0) btn0.textContent = pd && tot > 0 ? T("Registrarnos y ver cómo pagar", "Register and see how to pay") : T("Confirmar asistencia", "Confirm attendance");
      return;
    }
    var s = '<p class="tot">' + T("Total registrado", "Total") + ": <b>" + t.n + " " + T(t.n === 1 ? "persona" : "personas", t.n === 1 ? "person" : "people") + "</b> (" + t.ad + " " + T(t.ad === 1 ? "adulto" : "adultos", t.ad === 1 ? "adult" : "adults") + (t.kids ? " · " + t.kids + " " + T(t.kids === 1 ? "menor" : "menores", t.kids === 1 ? "minor" : "minors") : "") + ")</p>";
    if (paid(e)) {
      if (t.free) s += '<div class="paybox sm"><div class="ln t"><span>' + T("Cortesía de ", "Courtesy of ") + esc(e.courtesy.by) + '</span><span>$0</span></div></div>';
      else if (t.bd) s += '<div class="paybox sm">' + (t.ad - t.bd > 0 ? '<div class="ln"><span>' + (t.ad - t.bd) + " " + T("adulto(s)", "adult(s)") + " × " + money(e.price_adult) + "</span><span>" + money((t.ad - t.bd) * e.price_adult) + "</span></div>" : "") +
        '<div class="ln"><span>' + t.bd + ' <em class="bdg">Board KAI</em></span><span>$0</span></div><div class="ln t"><span>Total</span><span>' + money(t.tot) + "</span></div></div>";
      else s += '<div class="paybox sm">' + (t.cp ? '<div class="ln"><span>' + T("1 matrimonio", "1 married couple") + " × " + money(e.price_adult) + "</span><span>" + money(e.price_adult) + "</span></div>" :
        t.ad ? '<div class="ln"><span>' + t.ad + " " + T("adulto(s)", "adult(s)") + " × " + money(e.price_adult) + "</span><span>" + money(t.ad * e.price_adult) + "</span></div>" : "") +
        (t.kids ? '<div class="ln"><span>' + t.kids + " " + T("menor(es)", "minor(s)") + " × " + money(e.price_child) + "</span><span>" + money(t.kids * e.price_child) + "</span></div>" : "") +
        '<div class="ln t"><span>Total</span><span>' + money(t.tot) + "</span></div><p class=\"fine\" style=\"text-align:left;margin:6px 0 0\">" +
        T("Los miembros del Board de KAI no pagan; el sistema los reconoce por su correo.", "KAI Board members do not pay; they are recognized by email.") + "</p></div>";
    }
    b.innerHTML = s;
    var btn = $("#ev-go"); if (btn) btn.textContent = paid(e) && t.tot > 0 ? T("Registrarme y ver cómo pagar", "Register and see how to pay") : T("Confirmar asistencia", "Confirm attendance");
  }
  function renderEvent() {
    var e = EV, m = ME && ME.m, other = (e.other || [])[0], cty = e.courtesy;
    var info = '<div class="evd-in"><div>' + IC.cal + '<p><b>' + esc(cap(fdate(e.starts_at))) + "</b><span>" + esc(ftime(e.starts_at)) + (e.ends_at ? " – " + esc(ftime(e.ends_at)) : "") + (arrive(e) ? " · " + esc(arrive(e)) : "") + "</span></p></div>" +
      (e.venue || e.address ? "<div>" + IC.pin + "<p><b>" + esc(e.venue || "") + "</b><span>" + esc(e.address || "") + "</span></p></div>" : "") +
      (paid(e) ? "<div>" + IC.tag + "<p><b>" + money(e.price_adult) + " " + (couple(e) ? T("por matrimonio", "per married couple") : T("por adulto", "per adult")) + (+e.price_child ? " · " + money(e.price_child) + " " + T("por menor", "per minor") : "") + "</b><span>" + T("Pago por Zelle al registrarte", "Pay by Zelle after registering") + "</span></p></div>" : "") +
      "<div>" + IC.ppl + "<p><b>" + (couple(e) ? T("Para matrimonios", "For married couples") + (e.audience === "members" ? " · " + T("solo miembros de KAI", "KAI members only") : "") : e.audience === "members" ? T("Solo miembros de KAI", "KAI members only") : T("Pastores, cónyuges, familias e invitados", "Pastors, spouses, families and guests")) + "</b><span>" + (e.left != null ? e.left + " " + T("lugares disponibles", "spots left") : T("Confirma cuántas personas vienen contigo", "Tell us who is coming with you")) + "</span></p></div></div>";
    var map = e.address ? '<div class="evd-map"><iframe title="Mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' + encodeURIComponent(e.address) + '&output=embed"></iframe><div class="tx"><a href="' + mapsUrl(e.address) + '" target="_blank" rel="noopener">Google Maps ↗</a><a href="https://maps.apple.com/?q=' + encodeURIComponent(e.address) + '" target="_blank" rel="noopener">Apple Maps ↗</a><a href="https://waze.com/ul?q=' + encodeURIComponent(e.address) + '" target="_blank" rel="noopener">Waze ↗</a></div></div>' : "";
    var form;
    if (e.status === "cancelled") form = '<div class="evx-cx"><b>' + T("Este evento fue cancelado", "This event was cancelled") + "</b>" + esc(e.cancel_reason || T("Lamentamos el inconveniente.", "We apologize for the inconvenience.")) + "</div>";
    else if (!e.open) form = '<div class="rsvp"><h3>' + T("Registro cerrado", "Registration closed") + '</h3><p class="s2">' + (e.full ? T("Ya no hay lugares disponibles.", "This event is full.") : T("El registro para este evento ya está cerrado.", "Registration for this event is closed.")) + "</p></div>";
    else if (e.audience === "members" && !ME) form = '<div class="rsvp"><h3>' + T("Solo miembros", "Members only") + '</h3><p class="s2">' + T("Inicia sesión en el Área de Miembros para registrarte.", "Sign in to the Members Area to register.") + '</p><a class="btn gold" href="#/membership">' + T("Iniciar sesión", "Sign in") + "</a></div>";
    else {
      var cp = couple(e), opts = "", mg = cp ? 0 : (e.max_guests || 0);   // por ahora sin opción de menores
      for (var i = 0; i <= mg; i++) opts += '<option value="' + i + '">' + (cp ? (i === 0 ? T("Sin hijos", "No children") : i + " " + T(i === 1 ? "hijo(a)" : "hijos", i === 1 ? "child" : "children")) : (i === 0 ? T("Solo yo", "Just me") : i + " " + T(i === 1 ? "invitado" : "invitados", i === 1 ? "guest" : "guests"))) + "</option>";
      var nm = m && m.full_name ? m.full_name.split(" ") : [];
      var nmF = nm.slice(0, Math.max(1, nm.length - 1)).join(" "), nmL = nm.length > 1 ? nm[nm.length - 1] : "";
      var coupleTop = '<div class="cpl me"><div class="cph"><b><span class="cpn">1</span>' + T("Tu matrimonio", "Your couple") + "</b><span>" + T("Quien registra", "Registering") + "</span></div>" +
        '<div class="cpw">' + T("Tú", "You") + '</div><div class="r2"><input name="first_name" autocomplete="given-name" placeholder="' + T("Nombre", "First name") + '" value="' + esc(nmF) + '"><input name="last_name" autocomplete="family-name" placeholder="' + T("Apellido", "Last name") + '" value="' + esc(nmL) + '"></div>' +
        '<div class="r2"><input name="phone" type="tel" autocomplete="tel" placeholder="' + T("Teléfono", "Phone") + '" value="' + esc(m && m.phone || "") + '"><input name="email" type="email" autocomplete="email" placeholder="' + T("Correo", "Email") + '" value="' + esc(ME ? ME.email : "") + '"></div>' +
        '<div class="cpw">' + T("Tu esposo(a)", "Your spouse") + '</div><div class="r2"><input id="sp-fn" placeholder="' + T("Nombre", "First name") + '"><input id="sp-ln" placeholder="' + T("Apellido", "Last name") + '"></div>' +
        '<div class="r2"><input id="sp-ph" type="tel" placeholder="' + T("Teléfono", "Phone") + '"><input id="sp-em" type="email" placeholder="' + T("Correo", "Email") + '"></div></div>';
      var coupleMore = '<div id="ev-cps"></div><button type="button" class="cp-add" id="cp-add">＋ ' + T("Agregar otra pareja", "Add another couple") + '</button><p class="fine" id="cp-lim" hidden>' + T("Llegaron al máximo de parejas para este registro.", "You reached the maximum number of couples for this registration.") + "</p>";
      form = '<form class="rsvp" id="rsvp" novalidate><h3>' + T("Confirma tu asistencia", "RSVP") + '</h3><p class="s2">' + (e.reg_until ? T("Registro abierto hasta el ", "Registration open until ") + esc(fdate(e.reg_until + "T12:00:00", { day: "numeric", month: "long" })) + "." : "") + "</p>" +
        (cty && !cty.invalid ? '<div class="evx-cty">🎁 ' + T("Cortesía de <b>", "Courtesy of <b>") + esc(cty.by) + "</b> · " + T("tu registro no tiene costo", "no cost for you") + (cty.left != null ? " (" + cty.left + " " + T("lugares", "spots") + ")" : "") + "</div>" : "") +
        (cty && cty.invalid ? '<div class="evx-err">' + T("El enlace de cortesía no es válido; puedes registrarte normalmente.", "The courtesy link is not valid; you can register normally.") + "</div>" : "") +
        (ME ? '<div class="mem">✓ ' + T("Sesión iniciada; revisa tus datos.", "Signed in; please review your details.") + "</div>" : "") +
        (cp ? coupleTop :
        '<div class="r2"><div><label class="l">' + T("Nombre", "First name") + '</label><input name="first_name" autocomplete="given-name" value="' + esc(nmF) + '"></div><div><label class="l">' + T("Apellido", "Last name") + '</label><input name="last_name" autocomplete="family-name" value="' + esc(nmL) + '"></div></div>' +
        '<div class="r2"><div><label class="l">' + T("Teléfono", "Phone") + '</label><input name="phone" type="tel" autocomplete="tel" value="' + esc(m && m.phone || "") + '"></div><div><label class="l">' + T("Correo", "Email") + '</label><input name="email" type="email" autocomplete="email" value="' + esc(ME ? ME.email : "") + '"></div></div>') +
        '<label class="l">' + T("Iglesia o ministerio", "Church or ministry") + '</label><input name="church" placeholder="' + T("Opcional", "Optional") + '" value="' + esc(m && m.church || "") + '">' +
        '<div class="r2 c3"><div><label class="l">' + T("Ciudad", "City") + '</label><input name="city" autocomplete="address-level2" value="' + esc(m && m.city || "") + '"></div><div><label class="l">' + T("Estado", "State") + '</label><input name="state" autocomplete="address-level1" value="' + esc(m && m.state || "") + '"></div></div>' +
        (cp ? coupleMore : "") + (mg > 0 ? '<label class="l">' + (cp ? T("¿Traen hijos menores de edad?", "Bringing children under 18?") : T("¿Traes invitados?", "Bringing guests?")) + '</label><select id="ev-ng">' + opts + '</select><div id="ev-gs"></div>' : "") +
        '<label class="l">' + T("Comentarios", "Comments") + '</label><textarea name="comments" placeholder="' + T("Alergias, necesidades especiales… (opcional)", "Allergies, special needs… (optional)") + '"></textarea>' +
        '<div id="ev-tot"></div><p class="evx-err" id="ev-msg" role="alert"></p><button class="btn gold" id="ev-go" type="submit"></button><p class="fine">' + T("Te enviaremos la confirmación por correo y recordatorios antes del evento.", "We will email your confirmation and reminders before the event.") + "</p>" + (cp ? '<div class="cp-bar" id="cp-bar"></div>' : "") + "</form>";
    }
    put(hero("Kingdom Alliance International · E4:4", T("Eventos", "Events")) +
      '<section class="s evd-s"><div class="wrap"><a class="evx-lnk" href="#/events">← ' + T("Todos los eventos", "All events") + '</a><div class="evd"><div>' +
      '<div class="eyebrow evd-ey">' + esc(cap(fdate(e.starts_at))) + "</div><h2>" + esc(title(e)) + "</h2>" +
      (e.photo_url ? '<div class="evd-ph" style="background-image:url(' + esc(e.photo_url) + ')"></div>' : "") +
      (desc(e) ? '<p class="evd-desc">' + esc(desc(e)).replace(/\n/g, "<br>") + "</p>" : "") + info + map +
      (other ? '<p class="evd-other">' + T("¿Te queda más cerca otra zona?", "Is another location closer?") + ' <a class="evx-lnk" href="#/ev/' + esc(other.slug) + (e.code ? "?c=" + esc(e.code) : "") + '">' + esc(pick(other.title, other.title_en)) + " · " + esc(fdate(other.starts_at, { weekday: "long", day: "numeric", month: "long" })) + " →</a></p>" : "") +
      "</div><div id=\"rsvp-col\">" + form + "</div></div></div></section>");
    if (e.preview) {
      var st = { draft: T("BORRADOR · el público todavía no ve este evento", "DRAFT · the public cannot see this event yet"), published: T("PUBLICADO · así lo ve el público", "PUBLISHED · this is what the public sees"), closed: T("REGISTRO CERRADO", "REGISTRATION CLOSED"), cancelled: T("CANCELADO · el público no lo ve", "CANCELLED · the public cannot see it") }[e.status] || e.status;
      var sec = $(".evd-s"); if (sec) sec.insertAdjacentHTML("afterbegin", '<div class="evx-prev"><b>👁 ' + T("Vista previa", "Preview") + "</b> · " + esc(st) + ". " + T("Cambia el idioma arriba para revisar las dos versiones. El formulario no guarda registros en esta vista.", "Switch the language at the top to check both versions. The form does not save registrations in this view.") + ' <a href="#" onclick="window.close();return false">' + T("Cerrar", "Close") + "</a></div>");
    }
    var f = $("#rsvp"); if (!f) return;
    var ng = $("#ev-ng");
    function drawGuests() { var b = $("#ev-gs"); if (!b) return; var h = ""; for (var i = 0; i < FORM.guests.length; i++) h += guestCard(i); b.innerHTML = h; renderTotals(); }
    if (ng) ng.onchange = function () { var n = +ng.value; while (FORM.guests.length < n) FORM.guests.push({}); FORM.guests.length = n; drawGuests(); };
    f.addEventListener("input", function (ev) { var t = ev.target, c = t.closest(".gst"); if (c && t.dataset.gf) { var g = FORM.guests[+c.dataset.g]; if (t.type === "checkbox") { g[t.dataset.gf] = t.checked; drawGuests(); } else g[t.dataset.gf] = t.value; } });
    f.addEventListener("change", function (ev) { var t = ev.target, c = t.closest(".gst"); if (c && t.type === "checkbox") { FORM.guests[+c.dataset.g].minor = t.checked; if (t.checked) delete FORM.guests[+c.dataset.g].email; drawGuests(); } });
    if (couple(EV)) {
      f.addEventListener("input", function (ev) { var t = ev.target; if (t.dataset.c != null) { var c = FORM.cps[+t.dataset.c]; if (c) c[t.dataset.p][t.dataset.k] = t.value; } renderTotals(); });
      f.addEventListener("click", function (ev) {
        var t = ev.target.closest("button"); if (!t) return;
        if (t.id === "cp-add") { if (!cpCloseOpen()) return; FORM.cps.push({ h: {}, w: {}, open: true }); drawCouples(); var last = $$("#ev-cps .cpl input"); if (last.length) last[last.length - 8].focus(); }
        else if (t.dataset.ok != null) { cpCloseOpen(); drawCouples(); }
        else if (t.dataset.ed != null) { if (!cpCloseOpen()) return; FORM.cps[+t.dataset.ed].open = true; drawCouples(); }
        else if (t.dataset.rm != null) { FORM.cps.splice(+t.dataset.rm, 1); $("#ev-msg").textContent = ""; drawCouples(); }
      });
      drawCouples();
    }
    f.addEventListener("input", function (ev) { if (ev.target.type === "email") boardCheck(); });
    f.addEventListener("change", function (ev) { if (ev.target.type === "email") boardCheck(); });
    renderTotals(); boardCheck();
    if (hashParts().q.get("go") === "rsvp") setTimeout(function () { f.scrollIntoView({ behavior: "smooth", block: "start" }); }, 200);
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var msg = $("#ev-msg"), btn = $("#ev-go"), fd = new FormData(f), p = {};
      ["first_name", "last_name", "phone", "email", "church", "city", "state", "comments"].forEach(function (k) { p[k] = String(fd.get(k) || "").trim(); });
      p.lang = lang(); p.code = EV.code || ""; p.guests = FORM.guests.map(function (g) { var mn = couple(EV) || !!g.minor; return { first_name: (g.first_name || "").trim(), last_name: (g.last_name || "").trim(), email: mn ? "" : (g.email || "").trim(), minor: mn }; });
      if (couple(EV)) {
        var spo = { first_name: ($("#sp-fn").value || "").trim(), last_name: ($("#sp-ln").value || "").trim(), phone: ($("#sp-ph").value || "").trim(), email: ($("#sp-em").value || "").trim(), minor: false };
        if (!p.first_name || !p.last_name) return (msg.textContent = errText("missing_name"));
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email) || !p.phone) return (msg.textContent = T("Escribe tu teléfono y tu correo.", "Enter your phone and email."));
        if (!cpOk(spo)) return (msg.textContent = T("Escribe nombre, apellido, teléfono y correo de tu esposo(a).", "Enter your spouse's first name, last name, phone and email."));
        if (!p.city || !p.state) return (msg.textContent = T("Escribe tu ciudad y estado.", "Enter your city and state."));
        if (!cpCloseOpen()) { drawCouples(); return; }
        drawCouples();
        p.guests = [spo];
        FORM.cps.forEach(function (c) { ["h", "w"].forEach(function (q) { p.guests.push({ first_name: c[q].first_name.trim(), last_name: c[q].last_name.trim(), phone: c[q].phone.trim(), email: c[q].email.trim(), minor: false }); }); });
      }
      if (!p.first_name || !p.last_name) return (msg.textContent = errText("missing_name"));
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) return (msg.textContent = errText("invalid_email"));
      if (!p.phone) return (msg.textContent = T("Escribe tu teléfono.", "Enter your phone."));
      if (!p.city || !p.state) return (msg.textContent = T("Escribe tu ciudad y estado.", "Enter your city and state."));
      if (p.guests.some(function (g) { return !g.first_name || !g.last_name; })) return (msg.textContent = errText("missing_guest_name"));
      if (EV.preview) { msg.textContent = T("Vista previa: el formulario funciona, pero aquí no se guarda ningún registro.", "Preview: the form works, but no registration is saved here."); return; }
      msg.textContent = ""; btn.disabled = true; btn.textContent = T("Enviando…", "Sending…");
      rpc("ev_register", { p_slug: EV.slug, p: p }).then(function (r) { kick(); location.hash = "#/evr/" + r.token; })
        .catch(function (er) { msg.textContent = errText(er); btn.disabled = false; renderTotals(); });
    };
  }

  /* ================= MI REGISTRO (#/evr/TOKEN) ================= */
  function icsFor(e, extra) {
    var s = new Date(e.starts_at), en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 3 * 3600e3);
    function z(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
    function x(t) { return String(t || "").replace(/[,;\\]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n"); }
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KAI//Eventos//ES", "METHOD:PUBLISH", "BEGIN:VEVENT",
      "UID:" + e.slug + "@kaie44.org", "DTSTAMP:" + z(new Date()), "DTSTART:" + z(s), "DTEND:" + z(en),
      "SUMMARY:" + x(title(e)), "LOCATION:" + x([e.venue, e.address].filter(Boolean).join(", ")),
      "DESCRIPTION:" + x((extra || "") + "\n" + SITE + "/#/ev/" + e.slug),
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:" + x(title(e)), "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  }
  function gcal(e) {
    var s = new Date(e.starts_at), en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 3 * 3600e3);
    function z(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title(e)) + "&dates=" + z(s) + "/" + z(en) +
      "&location=" + encodeURIComponent([e.venue, e.address].filter(Boolean).join(", ")) + "&details=" + encodeURIComponent(SITE + "/#/ev/" + e.slug);
  }
  function outlook(e) {
    var s = new Date(e.starts_at), en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 3 * 3600e3);
    return "https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=" + encodeURIComponent(title(e)) +
      "&startdt=" + encodeURIComponent(s.toISOString()) + "&enddt=" + encodeURIComponent(en.toISOString()) + "&location=" + encodeURIComponent([e.venue, e.address].filter(Boolean).join(", "));
  }
  function downloadIcs(e) {
    var b = new Blob([icsFor(e)], { type: "text/calendar;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = (e.slug || "evento") + ".ics"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  var MY = null, MYTOK = "";
  function loadMy(tok, q) {
    MYTOK = tok; wait();
    rpc("ev_my", { p_token: tok }).then(function (x) {
      if (!x) { put(hero("Kingdom Alliance International · E4:4", T("Eventos", "Events")) + '<section class="s"><div class="wrap"><p>' + T("No encontramos este registro.", "We could not find this registration.") + "</p></div></section>"); return; }
      MY = x; renderMy();
      if (q.get("cal") === "ics") downloadIcs(x.event);
    }).catch(function (er) { put('<section class="s"><div class="wrap"><p class="evx-err">' + esc(errText(er)) + "</p></div></section>"); });
  }
  function renderMy() {
    var x = MY, e = x.event, g = x.group, ppl = (x.people || []), act = ppl.filter(function (p) { return p.status === "active"; });
    var ok = g.pay_status === "free" || g.pay_status === "paid";
    var head, body = "";
    if (e.status === "cancelled") {
      put(hero("Kingdom Alliance International · E4:4", T("Eventos", "Events")) + '<section class="s"><div class="wrap"><div class="ok"><div class="ck c">✕</div><h2>' + T("Este evento fue cancelado", "This event was cancelled") + "</h2>" + tkHTML() +
        (e.cancel_reason ? '<div class="evx-cx" style="text-align:left"><b>' + T("Motivo", "Reason") + "</b>" + esc(e.cancel_reason) + "</div>" : "") +
        '<p class="fine" style="margin-top:22px">' + T("¿Preguntas? Escríbenos a ", "Questions? Write to ") + '<a href="mailto:info@kaie44.org">info@kaie44.org</a></p></div></div></section>');
      return;
    }
    if (!act.length) head = '<div class="ck c">✕</div><h2>' + T("Registro cancelado", "Registration cancelled") + "</h2><p>" + T("Gracias por avisarnos. Si cambias de planes, puedes registrarte de nuevo.", "Thanks for letting us know. If your plans change, you can register again.") + ' <a class="evx-lnk" href="#/ev/' + esc(e.slug) + '">' + T("Ver el evento", "See the event") + "</a></p>";
    else if (ok) head = '<div class="ck">✓</div><h2>' + (x.mine ? T("¡Te esperamos!", "See you there!") : T("¡Estás registrado(a)!", "You are registered!")) + "</h2><p>" +
      (x.mine ? T("Tu asistencia quedó confirmada. Te enviamos los detalles a ", "Your attendance is confirmed. We emailed the details to ") + "<b>" + esc(g.email) + "</b>." : esc(g.by) + T(" te registró a este evento.", " registered you for this event.")) + "</p>";
    else head = '<div class="ck p">!</div><h2>' + T("Registro recibido · falta tu pago", "Registration received · payment pending") + "</h2><p>" + T("Tu lugar está apartado. Completa tu pago para confirmar tu asistencia.", "Your spot is reserved. Complete your payment to confirm.") + "</p>";
    function tkHTML() { return '<div class="tk"><dl><dt>' + T("Evento", "Event") + "</dt><dd><b>" + esc(title(e)) + "</b></dd><dt>" + T("Fecha", "Date") + "</dt><dd>" + esc(cap(fdate(e.starts_at))) + " · " + esc(ftime(e.starts_at)) + "</dd><dt>" + T("Registro", "Registration") + "</dt><dd>" + esc(g.reg_no) + "</dd></dl></div>"; }
    var tk = '<div class="tk"><dl><dt>' + T("Evento", "Event") + "</dt><dd><b>" + esc(title(e)) + "</b></dd><dt>" + T("Fecha", "Date") + "</dt><dd>" + esc(cap(fdate(e.starts_at))) + " · " + esc(ftime(e.starts_at)) + "</dd>" +
      (e.venue || e.address ? "<dt>" + T("Lugar", "Place") + "</dt><dd>" + esc([e.venue, e.address].filter(Boolean).join(" · ")) + "</dd>" : "") +
      "<dt>" + T("Registro", "Registration") + "</dt><dd>" + esc(g.reg_no) + (g.courtesy_by ? " · " + T("Cortesía de ", "Courtesy of ") + esc(g.courtesy_by) : "") + "</dd></dl></div>";
    if (x.mine && !ok && act.length) {
      body += '<div class="paybox"><h4>' + T("Pagar por Zelle", "Pay by Zelle") + " · " + money(g.total) + '</h4><div class="zl"><span>' + T("Enviar a", "Send to") + "</span><b>" + esc(e.zelle_to || T("(lo confirmaremos por correo)", "(we will confirm by email)")) + "</b><span>" + T("A nombre de", "Name") + "</span><b>" + esc(e.zelle_name || "Kingdom Alliance International") + "</b><span>" + T("En la nota", "Memo") + "</span><b>" + esc(g.reg_no + " · " + g.first_name + " " + g.last_name) + "</b></div>" +
        (g.pay_claimed ? '<p class="okmsg">✓ ' + T("Gracias, nos avisaste que ya enviaste tu pago. Te confirmaremos pronto por correo con tus códigos QR.", "Thanks, you told us you sent your payment. We will confirm by email with your QR codes soon.") + "</p>"
          : '<p class="fine" style="text-align:left">' + T("Cuando Tesorería confirme tu pago, te enviaremos tu confirmación con tus códigos QR.", "Once Treasury confirms your payment, we will email your confirmation with your QR codes.") + '</p><button class="btn navy sm" id="ev-claim">' + T("Ya envié mi pago", "I sent my payment") + "</button>") +
        "</div>" + (e.pay_card ? '<span class="soon">💳 ' + T("Pago con tarjeta · disponible pronto", "Card payment · coming soon") + "</span>" : "");
    }
    if (ok && act.length) {
      body += '<div class="qrs">' + act.map(function (p) {
        return '<div class="qrc"><div class="qrb">' + (p.qr ? qrSvg(SITE + "/#/evr/" + p.qr, 160) : "") + "</div><b>" + esc(p.name) + "</b><span>" + (p.board ? "Board KAI" : p.minor ? T("Menor", "Minor") : p.seq === 1 ? T("Registró", "Registrant") : T("Invitado(a)", "Guest")) + "</span></div>";
      }).join("") + '</div><p class="fine">' + T("Muestra estos códigos en la mesa de registro (en tu celular o impresos).", "Show these codes at the registration table (on your phone or printed).") + "</p>" +
        '<div class="acts2"><a class="btn navy sm" target="_blank" rel="noopener" href="' + gcal(e) + '">Google Calendar</a><a class="btn navy sm" href="#" id="ev-ics">Apple / iPhone</a><a class="btn navy sm" target="_blank" rel="noopener" href="' + outlook(e) + '">Outlook</a>' +
        (e.address ? '<a class="btn ol sm" target="_blank" rel="noopener" href="' + mapsUrl(e.address) + '">' + T("Cómo llegar", "Directions") + "</a>" : "") + "</div>";
    }
    if (act.length) {
      if (x.mine && couple(e)) {
        var prs = []; for (var k = 0; k < ppl.length; k += 2) prs.push([ppl[k], ppl[k + 1] || null]);
        body += '<div class="evx-mng"><h4>' + T("¿Cambio de planes?", "Change of plans?") + "</h4>" + prs.map(function (pr) {
          var a = pr[0], bb = pr[1], on = a.status === "active" || (bb && bb.status === "active"), nmx = a.name + (bb ? " " + T("y", "&") + " " + bb.name : "");
          return '<div class="mrow' + (on ? "" : " off") + '"><span>' + esc(nmx) + (on ? "" : " · " + T("cancelado", "cancelled")) + "</span>" + (on ? '<button class="lnkb" data-cancel="' + esc(a.status === "active" ? a.id : bb.id) + '">' + T("No podrán asistir", "Can't attend") + "</button>" : "") + "</div>";
        }).join("") + '<button class="lnkb" data-cancel="all">' + T("Cancelar todo el registro", "Cancel the whole registration") + '</button><p class="fine" style="text-align:left;margin:8px 0 0">' + T("Cada pareja se cancela junta: si uno de los dos no puede asistir, se cancela la pareja.", "Each couple is cancelled together: if one of them can't attend, the couple is cancelled.") + "</p></div>";
      } else if (x.mine) {
        body += '<div class="evx-mng"><h4>' + T("¿Cambio de planes?", "Change of plans?") + "</h4>" + ppl.map(function (p) {
          return '<div class="mrow' + (p.status !== "active" ? " off" : "") + '"><span>' + esc(p.name) + (p.status !== "active" ? " · " + T("cancelado", "cancelled") : "") + "</span>" + (p.status === "active" ? '<button class="lnkb" data-cancel="' + esc(p.id) + '">' + T("No podrá asistir", "Can't attend") + "</button>" : "") + "</div>";
        }).join("") + '<button class="lnkb" data-cancel="all">' + T("Cancelar todo el registro", "Cancel the whole registration") + "</button></div>";
      } else body += '<div class="evx-mng"><button class="btn ol sm" data-cancel="me">' + (couple(e) ? T("No podremos asistir", "We can't attend") : T("No podré asistir", "I can't attend")) + "</button></div>";
    }
    put(hero("Kingdom Alliance International · E4:4", T("Eventos", "Events")) + '<section class="s"><div class="wrap"><div class="ok">' + head + tk + body +
      '<p class="fine" style="margin-top:22px">' + T("¿Preguntas? Escríbenos a ", "Questions? Write to ") + '<a href="mailto:info@kaie44.org">info@kaie44.org</a></p></div></div></section>');
    var c = $("#ev-claim"); if (c) c.onclick = function () { c.disabled = true; rpc("ev_pay_claim", { p_token: MYTOK }).then(function () { return rpc("ev_my", { p_token: MYTOK }); }).then(function (y) { MY = y; renderMy(); }).catch(function (er) { c.disabled = false; alertBox(errText(er)); }); };
    var i = $("#ev-ics"); if (i) i.onclick = function (ev) { ev.preventDefault(); downloadIcs(e); };
    $$("[data-cancel]").forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.cancel, armed = b.dataset.armed;
        if (!armed) { b.dataset.armed = "1"; b.textContent = T("¿Seguro? Toca otra vez para confirmar", "Sure? Tap again to confirm"); return; }
        b.disabled = true;
        rpc("ev_cancel", { p_token: MYTOK, p_reg: v === "all" || v === "me" ? null : v }).then(function () { return rpc("ev_my", { p_token: MYTOK }); }).then(function (y) { MY = y; renderMy(); }).catch(function (er) { b.disabled = false; alertBox(errText(er)); });
      };
    });
  }
  function alertBox(t) { var p = document.createElement("div"); p.className = "evx-toast err"; p.textContent = t; document.body.appendChild(p); setTimeout(function () { p.remove(); }, 4000); }

  /* ================= CHECK-IN (#/checkin/SLUG) ================= */
  var CI = { slug: "", pin: "", who: "", data: null, filter: "all", q: "", timer: null, undo: null };
  function ciStore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function ciStart(slug) {
    CI.slug = slug; CI.pin = ciStore("kai-ci-pin-" + slug) || ""; CI.who = ciStore("kai-ci-who") || "";
    put('<div class="ci"><div class="ci-wait">' + T("Cargando…", "Loading…") + "</div></div>");
    ciLoad(true);
  }
  function ciLoad(first) {
    return rpc("ev_ci_list", { p_slug: CI.slug, p_pin: CI.pin || null }).then(function (d) { CI.data = d; ciRender(); ciPoll(); })
      .catch(function (er) { if (first || /bad_pin/.test(String(er.message))) ciPin(/bad_pin/.test(String(er.message)) && CI.pin ? errText(er) : ""); else ciToast(errText(er), true); });
  }
  function ciPoll() { clearTimeout(CI.timer); if (!root() || !$(".ci-app")) return; CI.timer = setTimeout(function () { if (document.hidden || !$(".ci-app")) return ciPoll(); rpc("ev_ci_list", { p_slug: CI.slug, p_pin: CI.pin || null }).then(function (d) { CI.data = d; ciRender(true); }).catch(function () {}).then(ciPoll); }, 6000); }
  function ciPin(err) {
    var v = "";
    put('<div class="ci-pin"><div class="ci-pc"><img src="images/logo.png" alt="KAI"><h3>' + T("Check-in del evento", "Event check-in") + "</h3><p>" + T("Escribe tu nombre y el PIN que te dio el equipo. El PIN solo sirve el día del evento.", "Enter your name and the PIN the team gave you. The PIN only works on the event day.") + '</p><input id="ci-who" placeholder="' + T("Tu nombre", "Your name") + '" value="' + esc(CI.who) + '"><div class="ci-dots"><i></i><i></i><i></i><i></i></div><div class="ci-kp">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map(function (k) { return '<button type="button" data-k="' + k + '"' + (k === "" ? ' disabled class="nil"' : "") + ">" + k + "</button>"; }).join("") +
      '</div><p class="evx-err" id="ci-err">' + esc(err || "") + '</p><p class="s">' + T("¿Eres del equipo? ", "Team member? ") + '<a href="#/membership">' + T("Inicia sesión", "Sign in") + "</a></p></div></div>");
    function dots() { $$(".ci-pin .ci-dots i").forEach(function (d, i) { d.classList.toggle("f", i < v.length); }); }
    $$(".ci-pin [data-k]").forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.k; if (k === "⌫") v = v.slice(0, -1); else if (v.length < 4) v += k; dots();
        if (v.length === 4) {
          CI.who = ($("#ci-who").value || "").trim(); ciStore("kai-ci-who", CI.who);
          if (!CI.who) { $("#ci-err").textContent = T("Escribe tu nombre primero.", "Enter your name first."); v = ""; dots(); return; }
          CI.pin = v; rpc("ev_ci_list", { p_slug: CI.slug, p_pin: v }).then(function (d) { ciStore("kai-ci-pin-" + CI.slug, v); CI.data = d; ciRender(); ciPoll(); })
            .catch(function (er) { CI.pin = ""; v = ""; dots(); $("#ci-err").textContent = errText(er); });
        }
      };
    });
  }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function ciRender(soft) {
    var d = CI.data, P = d.people || [], ev = d.event;
    var here = P.filter(function (p) { return p.in; }), regs = P.filter(function (p) { return !p.walkin; }), walk = P.filter(function (p) { return p.walkin; });
    var groups = {}; P.forEach(function (p) { (groups[p.group] = groups[p.group] || []).push(p); });
    var list = P.filter(function (p) {
      if (CI.filter === "in" && !p.in) return false; if (CI.filter === "out" && p.in) return false;
      if (CI.q) { var h = norm(p.name + " " + (p.by || "") + " " + (p.church || "") + " " + p.reg_no); return CI.q.split(/\s+/).every(function (w) { return h.indexOf(w) >= 0; }); }
      return true;
    });
    var rows = list.map(function (p) {
      var pay = "";
      if (ev.paid && p.seq === 1 && !p.walkin) {
        if (p.board) pay = '<span class="ci-tag b">Board · ' + T("sin costo", "free") + "</span>";
        else if (p.courtesy) pay = '<span class="ci-tag b">' + T("Cortesía · ", "Courtesy · ") + esc(p.courtesy) + "</span>";
        else if (p.pay === "paid") pay = '<span class="ci-tag g">' + T("Pagado", "Paid") + "</span>";
        else if (p.pay === "pending" || p.pay === "claimed") pay = '<span class="ci-tag r">' + T("Pago pendiente · ", "Payment due · ") + money(p.total) + '</span><button class="ci-door" data-door="' + esc(p.group) + '" data-amt="' + esc(p.total) + '" data-nm="' + esc(p.name) + '">' + T("Cobrar en la puerta", "Collect at door") + "</button>";
      } else if (ev.paid && p.board) pay = '<span class="ci-tag b">Board</span>';
      var tag = p.walkin ? '<span class="bdg w">' + T("Sin registro", "Walk-in") + "</span>" : p.board ? '<span class="bdg m">Board</span>' : p.member ? '<span class="bdg m">' + T("Miembro", "Member") + "</span>" : '<span class="bdg g">' + T("Invitado", "Guest") + "</span>";
      var sub = p.walkin ? T("Llegó sin registrarse", "Arrived without registering") : p.seq > 1 ? T("Invitado(a) de ", "Guest of ") + esc(p.by) + (p.minor ? " · " + T("menor", "minor") : "") : esc(p.church || p.reg_no);
      var grp = !p.in && p.seq === 1 && (groups[p.group] || []).filter(function (x) { return !x.in; }).length > 1 ? '<button class="ci-all" data-all="' + esc(p.group) + '">' + T("Marcar a todo el grupo", "Check in whole group") + "</button>" : "";
      return '<div class="ci-row' + (p.in ? " in" : "") + (p.seq > 1 ? " gs" : "") + '"><button class="cb" data-id="' + esc(p.id) + '" aria-label="' + T("Marcar llegada", "Check in") + '"></button><div class="nm"><b>' + esc(p.name) + tag + "</b><span>" + sub + "</span>" + grp + '</div><div class="pay">' + pay + '</div><div class="ci-tm">' + (p.in ? esc(ftime(p.in)) : "") + "</div></div>";
    }).join("") || '<p class="ci-none">' + T("No hay personas con ese filtro.", "No one matches.") + "</p>";
    var pct = P.length ? Math.round(100 * here.length / P.length) : 0;
    var html = '<div class="ci-app"><div class="ci-top"><img src="images/logo.png" alt=""><div class="t"><b>Check-in · ' + esc(title(ev)) + "</b><span>" + esc(cap(fdate(ev.starts_at, { weekday: "long", day: "numeric", month: "long" }))) + " · " + esc(ftime(ev.starts_at)) + "</span></div><div class=\"who\">" + esc(CI.pin ? T("Voluntario: ", "Volunteer: ") + CI.who : T("Equipo KAI", "KAI team")) + "</div>" +
      (CI.pin ? "" : '<a class="ci-back" href="#/staff/' + (ev.id ? "event/" + esc(ev.id) : "events") + '">‹ ' + T("Volver al panel", "Back to panel") + "</a>") + "</div>" +
      '<div class="ci-wrap"><div class="ci-stats"><div class="st"><div class="l">' + T("Han llegado", "Arrived") + '</div><div class="n">' + here.length + " <small>" + T("de", "of") + " " + P.length + " " + T("personas", "people") + '</small></div><div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="st"><div class="l">' + T("Registrados", "Registered") + '</div><div class="n">' + regs.filter(function (p) { return p.in; }).length + " <small>/ " + regs.length + '</small></div></div><div class="st"><div class="l">' + T("Sin registro", "Walk-ins") + '</div><div class="n">' + walk.length + "</div></div></div>" +
      '<div class="ci-tools"><label class="srch"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input id="ci-q" placeholder="' + T("Buscar por nombre, iglesia o registro…", "Search name, church or registration…") + '" value="' + esc(CI.q) + '"></label><button class="bt q" id="ci-scan">' + T("Escanear QR", "Scan QR") + '</button><button class="bt w" id="ci-walk">+ ' + T("Llegó sin registro", "Walk-in") + "</button></div>" +
      '<div class="ci-flt">' + [["all", T("Todos", "All") + " (" + P.length + ")"], ["out", T("Faltan", "Not here") + " (" + (P.length - here.length) + ")"], ["in", T("Ya llegaron", "Arrived") + " (" + here.length + ")"]].map(function (f) { return '<button data-f="' + f[0] + '"' + (CI.filter === f[0] ? ' class="on"' : "") + ">" + f[1] + "</button>"; }).join("") + "</div>" +
      '<div class="ci-list">' + rows + '</div><p class="ci-note">' + T("Toca la casilla para marcar la llegada. Se actualiza en todas las mesas.", "Tap the box to check in. Updates on every table.") + "</p></div></div>";
    var hadFocus = document.activeElement && document.activeElement.id === "ci-q", pos = hadFocus ? document.activeElement.selectionStart : 0;
    if (soft && $(".ci-app")) { var y = window.scrollY; put(html); window.scrollTo(0, y); } else put(html);
    if (hadFocus) { var qi = $("#ci-q"); qi.focus(); try { qi.setSelectionRange(pos, pos); } catch (e) {} }
    ciBind();
  }
  function ciMark(id, on) {
    var p = (CI.data.people || []).filter(function (x) { return x.id === id; })[0]; if (p) p.in = on ? new Date().toISOString() : null; ciRender(true);
    return rpc("ev_ci_mark", { p_slug: CI.slug, p_pin: CI.pin || null, p_reg: id, p_in: on, p_who: CI.who || null }).catch(function (er) { ciToast(errText(er), true); return ciLoad(); });
  }
  function ciBind() {
    var q = $("#ci-q"); if (q) q.oninput = function () { CI.q = norm(q.value.trim()); ciRender(true); };
    $$(".ci-flt [data-f]").forEach(function (b) { b.onclick = function () { CI.filter = b.dataset.f; ciRender(true); }; });
    $$(".ci-row .cb").forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.id, p = (CI.data.people || []).filter(function (x) { return x.id === id; })[0], on = !(p && p.in);
        ciMark(id, on).then(function () { if (on && p) ciToast("✓ " + p.name, false, function () { ciMark(id, false); }); });
      };
    });
    $$("[data-all]").forEach(function (b) { b.onclick = function () { var ids = (CI.data.people || []).filter(function (x) { return x.group === b.dataset.all && !x.in; }).map(function (x) { return x.id; }); Promise.all(ids.map(function (i) { return ciMark(i, true); })).then(function () { ciToast("✓ " + ids.length + " " + T("personas", "people")); }); }; });
    $$("[data-door]").forEach(function (b) { b.onclick = function () { ciDoor(b.dataset.door, b.dataset.amt, b.dataset.nm); }; });
    var s = $("#ci-scan"); if (s) s.onclick = ciScan;
    var w = $("#ci-walk"); if (w) w.onclick = ciWalk;
  }
  function ciToast(t, err, undo) {
    $$(".evx-toast").forEach(function (x) { x.remove(); });
    var p = document.createElement("div"); p.className = "evx-toast" + (err ? " err" : ""); p.innerHTML = esc(t) + (undo ? ' <u role="button">' + T("Deshacer", "Undo") + "</u>" : "");
    document.body.appendChild(p); if (undo) $("u", p).onclick = function () { p.remove(); undo(); };
    setTimeout(function () { p.remove(); }, 5000);
  }
  function modal(html) {
    var ov = document.createElement("div"); ov.className = "evx-ov"; ov.innerHTML = '<div class="evx-md">' + html + "</div>"; document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov || e.target.closest("[data-close]")) close(); });
    function close() { if (ov.onclose) ov.onclose(); ov.remove(); }
    ov.close = close; return ov;
  }
  function ciWalk() {
    var ov = modal("<h3>" + T("Llegó sin registro", "Walk-in") + "</h3><p>" + T("Se agrega a la lista y queda marcado como presente.", "Added to the list and checked in.") + '</p><label>' + T("Nombre completo", "Full name") + '</label><input id="wk-n"><div class="r2"><div><label>' + T("Teléfono o correo", "Phone or email") + '</label><input id="wk-c" placeholder="' + T("Opcional", "Optional") + '"></div><div><label>' + T("Iglesia", "Church") + '</label><input id="wk-ch" placeholder="' + T("Opcional", "Optional") + '"></div></div>' +
      '<div class="r2"><div><label>' + T("Adultos", "Adults") + '</label><input id="wk-a" type="number" min="1" value="1"></div><div><label>' + T("Niños", "Kids") + '</label><input id="wk-k" type="number" min="0" value="0"></div></div><p class="evx-err" id="wk-m"></p><div class="acts"><button class="bt w" data-close>' + T("Cancelar", "Cancel") + '</button><button class="bt g" id="wk-go">' + T("Agregar y marcar", "Add and check in") + "</button></div>");
    $("#wk-n", ov).focus();
    $("#wk-go", ov).onclick = function () {
      var n = $("#wk-n", ov).value.trim(); if (!n) return ($("#wk-m", ov).textContent = T("Escribe el nombre.", "Enter the name."));
      this.disabled = true;
      rpc("ev_ci_walkin", { p_slug: CI.slug, p_pin: CI.pin || null, p_who: CI.who || null, p: { name: n, contact: $("#wk-c", ov).value.trim(), church: $("#wk-ch", ov).value.trim(), adults: +$("#wk-a", ov).value || 1, kids: +$("#wk-k", ov).value || 0 } })
        .then(function () { ov.close(); ciToast("✓ " + n); return ciLoad(); }).catch(function (er) { $("#wk-m", ov).textContent = errText(er); });
    };
  }
  function ciDoor(group, amt, nm) {
    var m = "cash";
    var ov = modal("<h3>" + T("Cobrar en la puerta", "Collect at door") + "</h3><p><b>" + esc(nm) + "</b> · Total " + money(amt) + " · " + T("¿Cómo pagó?", "How did they pay?") + '</p><div class="rad">' +
      [["cash", T("Efectivo", "Cash")], ["zelle_door", T("Zelle en el momento", "Zelle now")], ["check", T("Cheque", "Check")]].map(function (o, i) { return '<button type="button" data-m="' + o[0] + '"' + (i === 0 ? ' class="on"' : "") + ">" + o[1] + "</button>"; }).join("") +
      '</div><p class="fine" style="text-align:left">' + T("Queda registrado quién cobró. Tesorería lo ve en el reporte del evento.", "Who collected is recorded. Treasury sees it in the event report.") + '</p><p class="evx-err" id="dp-m"></p><div class="acts"><button class="bt w" data-close>' + T("Cancelar", "Cancel") + '</button><button class="bt g" id="dp-go">' + T("Confirmar cobro de ", "Confirm ") + money(amt) + "</button></div>");
    $$("[data-m]", ov).forEach(function (b) { b.onclick = function () { m = b.dataset.m; $$("[data-m]", ov).forEach(function (x) { x.classList.toggle("on", x === b); }); }; });
    $("#dp-go", ov).onclick = function () { this.disabled = true; rpc("ev_ci_door_pay", { p_slug: CI.slug, p_pin: CI.pin || null, p_group: group, p_method: m, p_who: CI.who || null }).then(function () { ov.close(); ciToast("✓ " + T("Pago registrado", "Payment recorded")); return ciLoad(); }).catch(function (er) { $("#dp-m", ov).textContent = errText(er); }); };
  }
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }
  function ciScan() {
    var ov = modal("<h3>" + T("Escanear QR", "Scan QR") + '</h3><div class="scan"><video playsinline muted></video><div class="frame"></div></div><p class="scan-r" id="sc-r">' + T("Apunta la cámara al código QR.", "Point the camera at the QR code.") + '</p><div class="acts"><button class="bt w" data-close>' + T("Cerrar", "Close") + "</button></div>");
    var video = $("video", ov), stop = false, stream = null, busy = false, last = "", det = null, cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
    ov.onclose = function () { stop = true; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); };
    if ("BarcodeDetector" in window) { try { det = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { det = null; } }
    (det ? Promise.resolve() : loadJsQR()).then(function () {
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    }).then(function (s) { stream = s; video.srcObject = s; return video.play(); }).then(loop)
      .catch(function () { $("#sc-r", ov).textContent = T("No pudimos usar la cámara. Revisa el permiso de cámara del navegador o busca por nombre.", "Could not use the camera. Check the browser camera permission or search by name."); });
    function found(text) {
      var m = String(text).match(/evr\/([a-f0-9]{16,})/) || String(text).match(/^([a-f0-9]{24})$/); if (!m || busy || m[1] === last) return;
      busy = true; last = m[1];
      rpc("ev_ci_scan", { p_slug: CI.slug, p_pin: CI.pin || null, p_qr: m[1], p_who: CI.who || null }).then(function (r) {
        var el = $("#sc-r", ov);
        if (!r.ok) { el.className = "scan-r bad"; el.textContent = r.why === "other_event" ? T("Este QR es de otro evento.", "This QR is for another event.") : r.why === "cancelled" ? esc(r.name) + " · " + T("registro cancelado", "registration cancelled") : T("Código no encontrado.", "Code not found."); }
        else { el.className = "scan-r ok"; el.innerHTML = "✓ <b>" + esc(r.name) + "</b>" + (r.again ? " · " + T("ya había llegado", "already checked in") : "") + ((r.pay === "pending" || r.pay === "claimed") ? '<br><span class="ci-tag r">' + T("Pago pendiente · ", "Payment due · ") + money(r.total) + "</span>" : ""); if (navigator.vibrate) navigator.vibrate(80); }
        rpc("ev_ci_list", { p_slug: CI.slug, p_pin: CI.pin || null }).then(function (d) { CI.data = d; ciRender(true); }).catch(function () {});
      }).catch(function (er) { $("#sc-r", ov).textContent = errText(er); }).then(function () { setTimeout(function () { busy = false; }, 1200); setTimeout(function () { last = ""; }, 4000); });
    }
    function loop() {
      if (stop) return;
      if (video.readyState >= 2) {
        if (det) det.detect(video).then(function (c) { if (c && c[0]) found(c[0].rawValue); }).catch(function () {});
        else if (window.jsQR) { cv.width = video.videoWidth; cv.height = video.videoHeight; cx.drawImage(video, 0, 0); var im = cx.getImageData(0, 0, cv.width, cv.height), c = window.jsQR(im.data, im.width, im.height); if (c) found(c.data); }
      }
      setTimeout(loop, 250);
    }
  }

  /* ================= EVALUACIÓN (#/eval/TOKEN) ================= */
  var EQ = [["overall", "El evento en general", "The event overall"], ["atmos", "La atmósfera", "The atmosphere"], ["org", "La organización", "Organization"], ["time", "El manejo del tiempo en el programa", "Time management in the program"],
    ["venue", "El lugar", "The venue"], ["food", "La comida", "The food"], ["program", "El programa (alabanza, mensaje, oración)", "The program (worship, message, prayer)"], ["checkin", "El registro y el check-in", "Registration and check-in"], ["comms", "La comunicación antes del evento", "Communication before the event"]];
  var MOODS = [["alegre", "Alegre", "Joyful"], ["interesada", "Interesada", "Interested"], ["participativa", "Participativa", "Engaged"], ["conectada", "Conectada entre sí", "Connected"], ["cansada", "Cansada", "Tired"], ["distraida", "Distraída", "Distracted"], ["incomoda", "Incómoda", "Uncomfortable"]];
  function evalStart(tok) {
    wait();
    rpc("ev_eval_get", { p_token: tok }).then(function (x) {
      if (!x) return put('<section class="s"><div class="wrap"><p>' + T("Enlace no válido.", "Invalid link.") + "</p></div></section>");
      if (x.used || x.closed) return put('<div class="ef"><div class="hd"><img src="images/logo.png" alt=""><h1>' + T("¡Gracias!", "Thank you!") + "</h1><p>" + esc(x.title) + '</p></div><p class="ef-done">' + (x.used ? T("Tu evaluación ya fue recibida.", "Your evaluation was received.") : T("La evaluación ya cerró.", "The evaluation is closed.")) + "</p></div>");
      var A = { mood: [] };
      function stars(k) { return '<div class="stars" data-k="' + k + '">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-v="' + n + '">' + n + "</button>"; }).join("") + "</div>"; }
      function chips(k, opts, multi) { return '<div class="chips2" data-k="' + k + '"' + (multi ? ' data-multi="1"' : "") + ">" + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '">' + (lang() === "es" ? o[1] : o[2]) + "</button>"; }).join("") + "</div>"; }
      function q(k, n) { var e = EQ.filter(function (x) { return x[0] === k; })[0]; return '<div class="q"><h5>' + n + ". " + T(e[1], e[2]) + "</h5>" + stars(k) + (n === 1 ? '<div class="scale"><span>' + T("Muy mal", "Poor") + "</span><span>" + T("Excelente", "Excellent") + "</span></div>" : "") + "</div>"; }
      function ta(k, l) { return '<div class="q"><h5>' + l + '</h5><textarea data-t="' + k + '" placeholder="' + T("Escribe aquí… (opcional)", "Write here… (optional)") + '"></textarea></div>'; }
      put('<div class="ef"><div class="hd"><img src="images/logo.png" alt=""><h1>' + T("¿Cómo nos fue?", "How did it go?") + "</h1><p>" + esc(x.title) + " · " + esc(fdate(x.starts_at, { day: "numeric", month: "long" })) + '</p></div><div class="an">🔒 ' + T("Tu respuesta es anónima. No se guarda tu nombre. Toma 2–3 minutos.", "Your answer is anonymous. Your name is not saved. Takes 2–3 minutes.") + "</div>" +
        q("overall", 1) + q("atmos", 2) + '<div class="q"><h5>' + T("¿Cómo viste a la gente?", "How did people seem?") + ' <span class="sm">' + T("(marca varias)", "(choose several)") + "</span></h5>" + chips("mood", MOODS, true) + "</div>" + q("org", 3) + q("time", 4) +
        '<div class="sec">' + T("Tiempo", "Time") + '</div><div class="q"><h5>' + T("¿El programa empezó a tiempo?", "Did the program start on time?") + "</h5>" + chips("start", [["ontime", "A tiempo", "On time"], ["late15", "Hasta 15 min tarde", "Up to 15 min late"], ["late15plus", "Más de 15 min tarde", "15+ min late"]]) + "</div>" +
        '<div class="q"><h5>' + T("La duración fue…", "The length was…") + "</h5>" + chips("length", [["short", "Muy corta", "Too short"], ["ok", "Adecuada", "Just right"], ["long", "Muy larga", "Too long"]]) + "</div>" + ta("time_note", T("¿Qué parte se alargó o se quedó corta?", "Which part ran long or short?")) +
        '<div class="sec">' + T("Detalles", "Details") + "</div>" + q("venue", 5) + q("food", 6) + q("program", 7) + q("checkin", 8) + q("comms", 9) +
        '<div class="sec">' + T("Para terminar", "To finish") + '</div><div class="q"><h5>' + T("¿Lo repetirían?", "Would you do it again?") + "</h5>" + chips("again", [["yes", "Sí", "Yes"], ["changes", "Con cambios", "With changes"], ["no", "No", "No"]]) + "</div>" +
        ta("good", T("¿Qué salió bien?", "What went well?")) + ta("improve", T("¿Qué debemos mejorar?", "What should we improve?")) + ta("ideas", T("Ideas o comentarios", "Ideas or comments")) +
        '<div class="q"><p class="evx-err" id="ef-m"></p><button class="btn gold" id="ef-go" style="width:100%">' + T("Enviar evaluación", "Submit evaluation") + "</button></div></div>");
      $$(".ef .stars").forEach(function (s) { $$("button", s).forEach(function (b) { b.onclick = function () { A[s.dataset.k] = +b.dataset.v; $$("button", s).forEach(function (x) { x.classList.toggle("on", x === b); }); }; }); });
      $$(".ef .chips2").forEach(function (s) { $$("button", s).forEach(function (b) { b.onclick = function () { var k = s.dataset.k; if (s.dataset.multi) { var i = A[k].indexOf(b.dataset.v); if (i >= 0) A[k].splice(i, 1); else A[k].push(b.dataset.v); b.classList.toggle("on"); } else { A[k] = b.dataset.v; $$("button", s).forEach(function (x) { x.classList.toggle("on", x === b); }); } }; }); });
      $("#ef-go").onclick = function () {
        if (!A.overall) { $("#ef-m").textContent = T("Califica por lo menos el evento en general.", "Please rate at least the event overall."); return; }
        $$(".ef [data-t]").forEach(function (t) { var v = t.value.trim(); if (v) A[t.dataset.t] = v.slice(0, 1500); });
        var b = this; b.disabled = true;
        rpc("ev_eval_submit", { p_token: tok, p: A }).then(function () { put('<div class="ef"><div class="hd"><img src="images/logo.png" alt=""><h1>' + T("¡Gracias!", "Thank you!") + "</h1><p>" + esc(x.title) + '</p></div><p class="ef-done">' + T("Recibimos tu evaluación. Nos ayuda mucho para el próximo evento.", "We received your evaluation. It really helps us plan the next event.") + "</p></div>"); window.scrollTo(0, 0); })
          .catch(function (er) { b.disabled = false; $("#ef-m").textContent = errText(er); });
      };
    }).catch(function (er) { put('<section class="s"><div class="wrap"><p class="evx-err">' + esc(errText(er)) + "</p></div></section>"); });
  }

  /* ================= ROUTER ================= */
  var LAST = "";
  window.KAIEV = {
    view: function (v) {
      if (v === "events") { if (LIST === null) loadList(); else renderList(); return; }
      if (v !== "evx") { clearTimeout(CI.timer); LAST = ""; return; }
      var h = hashParts(), p = h.path, key = location.hash + "|" + lang();
      if (key === LAST) return; LAST = key;
      if (p[0] === "ev" && p[1]) loadEvent(decodeURIComponent(p[1]), h.q.get("c"));
      else if (p[0] === "evr" && p[1]) loadMy(p[1], h.q);
      else if (p[0] === "checkin" && p[1]) ciStart(decodeURIComponent(p[1]));
      else if (p[0] === "eval" && p[1]) evalStart(p[1]);
    },
    refresh: function () { LIST = null; }
  };
})();
