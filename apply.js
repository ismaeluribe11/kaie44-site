/* KAI · Membership application (#/apply). Requires apply_schema.js, supabase-js and the site's globals L, F, FES. */
(function () {
  "use strict";
  var SB_URL = "https://mejypcqqpejsxackkngb.supabase.co";
  var SB_KEY = "sb_publishable_l8led4zWMBxUVnCY06WJzQ_GPPMcBke";
  var BUCKET = "applications";
  var DRAFT = "kai-apply-draft-v1";
  var SC = window.KAIAPP_SCHEMA;
  var PARTS = { a: SC.A, b: SC.B, c: SC.C };
  var FEES = { pastor: 100, ministro: 75 };
  function payNote(cls) {
    return '<div class="ap-pay' + (cls ? " " + cls : "") + '"><span class="ap-pay-i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span><div><small>' +
      xx("Su cuota anual · solo después de ser aprobado", "Your annual fee · only after approval") + "</small><b>" +
      xx("Le enviaremos las instrucciones de pago por correo.", "We will send you the payment instructions by email.") + "</b><span>" +
      xx("Llegan junto con su carta de aprobación. No tiene que pagar nada para aplicar.", "They come with your approval letter. You don't need to pay anything to apply.") + "</span></div></div>";
  }
  var ICONS = ["<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\"/>", "<path d=\"M22 10 12 5 2 10l10 5 10-5z\"/><path d=\"M6 12v5c3 3 9 3 12 0v-5\"/>", "<circle cx=\"12\" cy=\"5\" r=\"2.5\"/><circle cx=\"5\" cy=\"18\" r=\"2.5\"/><circle cx=\"19\" cy=\"18\" r=\"2.5\"/><path d=\"M12 7.5V12M12 12l-5.5 4.5M12 12l5.5 4.5\"/>", "<path d=\"M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>", "<rect x=\"2\" y=\"7\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\"/>", "<rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/><circle cx=\"8\" cy=\"11\" r=\"2\"/><path d=\"M5 16c.5-1.5 1.7-2 3-2s2.5.5 3 2M14 10h5M14 14h4\"/>", "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M16 2v4M8 2v4M3 10h18\"/>", "<path d=\"M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z\"/>"];
  var LOCK = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

  /* ---------- state ---------- */
  var GOTO = null, S = {}, FILES = {}, PREV = {}, SIG = { drawn: false }, SIG2 = { drawn: false }, CUR = null, LASTLANG = null, BUSY = false, DONE = null, PDFURL = null;
  try { S = JSON.parse(localStorage.getItem(DRAFT) || "{}") || {}; } catch (e) { S = {}; }
  if (!S.agree) S.agree = {};
  var saveT = null;
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(DRAFT, JSON.stringify(S)); } catch (e) {} }, 300); }
  /* Archivos (foto y documentos) guardados en este dispositivo, para no perderlos al recargar o salir */
  var FDB = null;
  function fdb() {
    if (FDB) return FDB;
    FDB = new Promise(function (res) {
      try { var rq = indexedDB.open("kai-apply-files", 1); rq.onupgradeneeded = function () { rq.result.createObjectStore("f"); }; rq.onsuccess = function () { res(rq.result); }; rq.onerror = function () { res(null); }; } catch (e) { res(null); }
    });
    return FDB;
  }
  function fput(k, v) { fdb().then(function (db) { if (!db) return; try { var tx = db.transaction("f", "readwrite"); if (v == null) tx.objectStore("f").delete(k); else tx.objectStore("f").put(v, k); } catch (e) {} }); }
  function fclear() { fdb().then(function (db) { if (!db) return; try { db.transaction("f", "readwrite").objectStore("f").clear(); } catch (e) {} }); }
  function fload() {
    return fdb().then(function (db) {
      if (!db) return;
      return new Promise(function (res) {
        try {
          var out = {}, st = db.transaction("f", "readonly").objectStore("f"), cur = st.openCursor();
          cur.onsuccess = function () { var c = cur.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); };
          cur.onerror = function () { res({}); };
        } catch (e) { res({}); }
      });
    }).then(function (o) {
      if (!o) return;
      Object.keys(o).forEach(function (k) {
        var v = o[k]; if (!v) return;
        if (k === "_orig" || k === "_orig_sp_photo") { var og = ORIG[k === "_orig" ? "photo" : "sp_photo"]; og.photo = v.blob || null; og.pos = v.pos || { x: 0, y: 0, z: 1 }; return; }
        if (!FILES[k]) { if (v.name == null && v.blob) { FILES[k] = v.blob; FILES[k].name = v.n || k; } else FILES[k] = v; if (k === "photo" || k === "sp_photo") PREV[k] = URL.createObjectURL(FILES[k]); }
      });
    }).catch(function () {});
  }

  function lang() { return window.L === "es" ? "es" : "en"; }
  function x(a) { return a ? (lang() === "es" ? a[0] : a[1]) : ""; }
  function xx(es, en) { return lang() === "es" ? es : en; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function $(sel, r) { return (r || document).querySelector(sel); }
  function $$(sel, r) { return Array.prototype.slice.call((r || document).querySelectorAll(sel)); }

  /* ---------- schema helpers ---------- */
  var ALL = {};
  ["a", "b", "c"].forEach(function (p) { PARTS[p].forEach(function (sec) { sec.f.forEach(function (f) { if (f.k) { f._p = p; ALL[f.k] = f; } }); }); });
  function active(f) {
    if (!f || !f.when) return true;
    var w = f.when.split("="), src = ALL[w[0]], vals = w[1].split(",");
    if (src && !active(src)) return false;
    var v = S[w[0]];
    return Array.isArray(v) ? v.some(function (z) { return vals.indexOf(z) >= 0; }) : vals.indexOf(v) >= 0;
  }
  function filled(f) {
    var v = S[f.k];
    if (f.type === "file") return !!FILES[f.k];
    if (f.type === "pick") return v && v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "boolean") return v;
    return v != null && String(v).trim() !== "";
  }
  function optLabel(f, val) { var o = (f.o || []).filter(function (z) { return z[0] === val; })[0]; return o ? (lang() === "es" ? o[1] : o[2]) : val; }

  /* ---------- small builders ---------- */
  function track(cur) {
    var items = [["a", xx("Parte A", "Part A")], ["b", xx("Parte B", "Part B")], ["r", xx("Revisión final", "Final review")]];
    var ix = ["a", "b", "r"].indexOf(cur);
    return '<ol class="ap-track">' + items.map(function (it, i) {
      var cls = i < ix ? "done" : i === ix ? "on" : "";
      return '<li class="' + cls + '">' + (i ? '<i class="ar"></i>' : "") + (cls ? "<span>" + it[1] + "</span>" : it[1]) + "</li>";
    }).join("") + "</ol>";
  }
  function head(cur, eyebrow, title, lead, chips) {
    return '<div class="ap-head"><div class="wrap">' + track(cur) + '<div class="ap-ttl"><div class="eyebrow">' + eyebrow + "</div><h1>" + title + "</h1><p>" + lead + '</p><div class="ap-chips">' + chips.map(function (c) { return "<span>" + c + "</span>"; }).join("") + "</div></div></div></div>";
  }
  /* Ayuda: si tienen problemas con la aplicación, llamar a Ismael */
  var HELP_TEL = "+19092759909", HELP_NUM = "(909) 275-9909";
  var PHONE_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
  function helpLine(cls) {
    return '<div class="ap-help ' + (cls || "") + '"><span class="ic">' + PHONE_IC + '</span><div><b>' + xx("¿Problemas con la aplicación?", "Having trouble with the application?") + '</b><span>' + xx("Llame a Ismael", "Call Ismael") + (cls === "in-side" ? "<br>" : " · ") + '<a href="tel:' + HELP_TEL + '">' + HELP_NUM + "</a></span></div></div>";
  }
  function side(title, links, prog) {
    return '<aside class="ap-side"><h4>' + title + "</h4><ol>" + links.map(function (l) { return '<li><a href="#' + l[0] + '" data-jump="' + l[0] + '"><b>' + l[1] + "</b>" + l[2] + "</a></li>"; }).join("") + '</ol><div class="pg"><span class="pgt">' + prog + '</span><div class="bar"><i class="pgb"></i></div></div>' + helpLine("in-side") + '</aside>';
  }
  // Descripción de cada beneficio: la misma del sitio (página "Hazte miembro")
  function needDef(c) { return (SC.NEEDS || []).filter(function (z) { return z[0] === c; })[0] || (SC.BENEFITS || []).filter(function (z) { return z[0] === c; })[0] || [c, c, c]; }
  function benDesc(b) { try { return (window.D && window.D[lang()] && window.D[lang()]["bd" + (b[3] + 1)]) || ""; } catch (e) { return ""; } }
  function sortedOpts(f) {
    if (!f.sort) return f.o;
    var i = lang() === "es" ? 1 : 2, first = f.o[0], last = f.o[f.o.length - 1], hasOther = last[0] === "other";
    var mid = f.o.slice(1, hasOther ? -1 : undefined).sort(function (a, b) { return a[i].localeCompare(b[i], lang()); });
    return [first].concat(mid, hasOther ? [last] : []);
  }
  var CARD_IC = { thriving: "🌱", stable: "⚓", tired: "🔄", crisis: "⛈️" };
  function opts(f, multi) {
    var h = '<div class="ap-opts' + (f.cards ? " cards" : "") + '">' + f.o.map(function (o) {
      return '<label><input type="' + (multi ? "checkbox" : "radio") + '" name="' + f.k + '" value="' + o[0] + '"' + (multi ? " data-multi" : "") + ">" + (f.cards && CARD_IC[o[0]] ? '<span class="ic">' + CARD_IC[o[0]] + "</span>" : "") + (lang() === "es" ? o[1] : o[2]) + "</label>";
    }).join("");
    if (f.other) h += '<label><input type="checkbox" name="' + f.k + '" value="other" data-multi>' + xx("Otro", "Other") + "</label>";
    h += "</div>";
    if (f.other) h += '<div class="ap-cond" data-when="' + f.k + '=other"><input class="ap-otro" name="' + f.k + '_other" placeholder="' + xx("Escriba cuál", "Please specify") + '"></div>';
    return h;
  }
  function scale(f) {
    var h = '<div class="ap-scale"><span class="lo">' + x(f.sc[0]) + '</span><div class="bx">';
    for (var i = 1; i <= 5; i++) h += '<label><input type="radio" name="' + f.k + '" value="' + i + '"><span>' + i + "</span></label>";
    return h + '</div><span class="hi">' + x(f.sc[1]) + "</span></div>";
  }
  // Texto en singular y en plural: el plural se muestra cuando aplican los dos cónyuges (clase .pairmode)
  function dual(sg, pl) { return pl ? '<span class="sg">' + sg + '</span><span class="pl">' + pl + "</span>" : sg; }
  function xl(f) { return dual(x(f.l), f.lp ? x(f.lp) : ""); }
  function lab(f) {
    var t = xl(f);
    if (f.opt) t += ' <span class="opt">(' + (f.optL ? x(f.optL) : xx("opcional", "optional")) + ")</span>";
    if (f.s2) t += ' <span class="opt">(' + x(f.s2) + ")</span>";
    return "<label>" + t + "</label>";
  }
  function wrapAttr(f, extra) {
    var cls = "fld w" + (f.w || 6) + (f.when ? " ap-cond" : "") + (extra ? " " + extra : "");
    return 'class="' + cls + '" data-k="' + (f.k || "") + '"' + (f.when ? ' data-when="' + f.when + '"' : "");
  }
  function faithHTML() {
    try {
      var src = lang() === "es" ? window.FES : window.F;
      return (src || []).map(function (a, i) {
        var tt = (window.D && window.D[lang()] && window.D[lang()]["ft" + (i + 1)]) || "";
        return '<div class="dc-art"><b>' + (i + 1) + "</b><div>" + (tt ? '<h6 class="dc-h">' + esc(tt) + "</h6>" : "") + a[0].map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "<small>" + esc(a[1]) + "</small></div></div>";
      }).join("");
    } catch (e) { return ""; }
  }

  var TIMES = (function () { var a = []; for (var h = 6; h <= 22; h++) { ["00", "30"].forEach(function (m) { if (h === 22 && m === "30") return; a.push((h > 12 ? h - 12 : h) + ":" + m + (h >= 12 ? " PM" : " AM")); }); } return a; })();
  /* ---------- field renderer ---------- */
  function field(f) {
    var t = f.type || "text", k = f.k;
    if (t === "note") return '<div ' + wrapAttr(f, "ap-note") + "><p>" + x(f.l) + "</p></div>";
    if (t === "sub") return '<div class="ap-sub w6">' + x(f.l) + (f.opt ? ' <span class="opt">(' + xx("opcional", "optional") + ")</span>" : "") + "</div>";
    if (t === "offer") return '<div class="ap-offer w6">' + xx("KAI cuenta con un equipo de agentes con licencia estatal en planes de retiro, seguros de vida y educación financiera.", "KAI has a team of state-licensed agents in retirement plans, life insurance and financial education.") + "</div>";
    if (t === "care") return '<p class="ap-care w6">' + xx("KAI ofrece acompañamiento pastoral, no servicios clínicos. Cuando una situación lo requiera, podemos recomendarle ayuda profesional.", "KAI offers pastoral support, not clinical services. When a situation calls for it, we can recommend professional help.") + "</p>";
    if (t === "who") {
      return '<div ' + wrapAttr(f) + '><p class="ap-who-q">' + xx("¿Quién va a aplicar?", "Who is applying?") + '</p><div class="ap-tier ap-who">' +
        '<label><input type="radio" name="who" value="solo"><b>' + xx("INDIVIDUAL", "INDIVIDUAL") + "</b><strong>" + xx("Solo yo", "Just me") + "</strong><span>" + xx("Una credencial a mi nombre.", "One credential in my name.") + "</span></label>" +
        '<label><input type="radio" name="who" value="pair"><b>' + xx("MATRIMONIO", "COUPLE") + "</b><strong>" + xx("Mi cónyuge y yo", "My spouse and I") + "</strong><span>" + xx("Una sola solicitud y dos credenciales: una para cada uno.", "One application and two credentials: one for each of us.") + "</span></label></div></div>";
    }
    if (t === "tier") {
      var tk = k || "tier";
      return '<div ' + wrapAttr(f) + '><p class="ap-tl pl">' + (f.sp ? xx("Membresía de su cónyuge", "Your spouse's membership") : xx("Su membresía", "Your membership")) + '</p><div class="ap-tier">' +
        '<label><input type="radio" name="' + tk + '" value="pastor"><b>PASTOR</b><strong>$100<small> / ' + xx("año", "year") + "</small></strong><span>" + xx("Pastor(a) principal, Obispo, Apóstol", "Senior pastor, Bishop, Apostle") + "</span></label>" +
        '<label><input type="radio" name="' + tk + '" value="ministro"><b>' + xx("MINISTRO", "MINISTER") + "</b><strong>$75<small> / " + xx("año", "year") + "</small></strong><span>" + xx("Pastor asociado, evangelista, misionero u otro ministro", "Associate pastor, evangelist, missionary or other minister") + "</span></label></div>" + (f.sp ? "" : payNote("sm")) + "</div>";
    }
    if (t === "cred") {
      var pre = f.sp ? "sp_" : "", pk = pre + "photo", sfx = f.sp ? "-sp" : "";
      var img = PREV[pk] ? '<img id="ap-ph' + sfx + '" src="' + PREV[pk] + '" alt="" title="' + xx("Clic para ajustar", "Click to adjust") + '">' : '<div class="ph0" id="ap-ph' + sfx + '">' + xx("Su foto aparecerá aquí", "Your photo will appear here") + "</div>";
      return '<div class="fld w6" data-k="' + pk + '"><div class="ap-cred"><div class="ap-ph-col"><div class="frame">' + img + '</div><div class="ap-phbtns" id="ap-phbtns' + sfx + '"' + (PREV[pk] ? "" : " hidden") + '><button type="button" class="ap-phb" data-phadj="' + pk + '">' + xx("Ajustar", "Adjust") + '</button><button type="button" class="ap-phb del" data-phdel="' + pk + '">' + xx("Eliminar", "Delete") + '</button></div></div><div class="ap-cred-f">' +
        '<div class="fld" data-k="' + pre + 'title"><label>' + xx("Título en la credencial", "Title on credential") + '</label><select name="' + pre + 'title"><option value="">' + xx("Elija el título…", "Choose the title…") + "</option>" + titlesSorted().map(function (o) { return '<option value="' + o[0] + '">' + (lang() === "es" ? o[1] : o[2]) + "</option>"; }).join("") + "</select></div>" +
        '<div class="fld" data-k="' + pre + 'cred_name"><label>' + xx("Nombre en la credencial", "Name on credential") + '</label><input name="' + pre + 'cred_name" placeholder="' + (f.sp ? "María Elena Pérez" : "Juan Carlos Pérez") + '"><small>' + xx("Como desea que aparezca, sin el título", "As it should appear, without the title") + "</small></div>" +
        '<div class="ap-upl"><label class="ap-up">' + xx("Subir o tomar foto", "Upload or take photo") + '<input type="file" accept="image/*" data-file="' + pk + '"></label><small>' + xx("De frente, con fondo claro, sin lentes oscuros ni gorra.", "Facing forward, light background, no sunglasses or hat.") + '</small></div><div class="ap-errm" data-errfor="' + pk + '"></div></div></div></div>';
    }
    if (t === "samead") {
      return '<div ' + wrapAttr(f) + '><label class="chk"><input type="checkbox" name="' + k + '">' + x(f.l) + "</label></div>";
    }
    if (t === "svc") {
      var top = '<option value="">' + xx("Hora…", "Time…") + "</option>" + TIMES.map(function (o) { return "<option>" + o + "</option>"; }).join("");
      return '<div ' + wrapAttr(f, "ap-svc") + "><label>" + x(f.l) + '</label><div class="svc-row"><select name="' + k + '">' + top + '</select></div><div class="svc-row svc2"><select name="' + k + '_2">' + top + '</select><button type="button" class="svc-x" data-svc-rm="' + k + '" aria-label="' + xx("Quitar horario", "Remove time") + '">×</button></div><button type="button" class="svc-add" data-svc-add="' + k + '">+ ' + xx("Otro horario", "Another time") + "</button></div>";
    }
    if (t === "faith" && f.sp) {
      return '<div ' + wrapAttr(f) + '><label class="chk"><input type="checkbox" name="' + k + '">' + xx("Mi cónyuge afirma la Declaración de Fe de Kingdom Alliance International.", "My spouse affirms the Statement of Faith of Kingdom Alliance International.") + "</label></div>";
    }
    if (t === "faith") {
      return '<div class="fld w6" data-k="faith_ok"><details class="ap-doc"><summary>' + xx("Leer la Declaración de Fe de KAI", "Read KAI's Statement of Faith") + "<span>" + xx("Leer", "Read") + '</span></summary><div class="dc-b">' + faithHTML() + '</div></details><label class="chk"><input type="checkbox" name="faith_ok">' + xx("Afirmo la Declaración de Fe de Kingdom Alliance International.", "I affirm the Statement of Faith of Kingdom Alliance International.") + "</label></div>";
    }
    if (t === "file") {
      var fn = FILES[k] ? '<small class="fn">✓ ' + esc(FILES[k].name) + "</small>" : "";
      return '<div class="ap-file w6" data-k="' + k + '"><p>' + x(f.l) + (f.s ? "<small>" + x(f.s) + "</small>" : "") + fn + '</p><label class="ap-up">' + xx("Subir archivo", "Upload file") + '<input type="file" accept="image/*,.pdf" data-file="' + k + '"></label></div>';
    }
    if (t === "pick") {
      return '<div class="fld w6" data-k="priorities">' + (f.l ? lab(f) : "") + (f.s ? '<small class="ap-pick-h">' + dual(x(f.s), f.ls ? x(f.ls) : "") + "</small>" : "") + '<div class="ap-pick chips">' + SC.NEEDS.map(function (b) {
        return '<button type="button" data-b="' + b[0] + '"><em></em><b>' + (lang() === "es" ? b[1] : b[2]) + "</b></button>";
      }).join("") + '</div><div class="ap-pick-st"><i>1</i><i>2</i><i>3</i><span></span></div></div>';
    }
    if (t === "morphe") {
      return '<div class="fld w6" data-k="morphe"><div class="ap-morphe"><div><b>Instituto Morphe</b><p>' + xx("KAI colabora con el Instituto Morphe para ofrecer formación de liderazgo a pastores, ministros, líderes y laicos. ¿Le gustaría recibir más información?", "KAI partners with Instituto Morphe to provide leadership development for pastors, ministers, leaders and lay people. Would you like more information?") + "</p></div></div>" + opts(f) + "</div>";
    }
    if (t === "consent") {
      return '<div ' + wrapAttr(f) + '><label class="ap-consent"><input type="checkbox" name="fin_consent">' + xx("Autorizo a KAI a compartir solo mi nombre y mis datos de contacto con su equipo de planeación financiera. Mis demás respuestas de cuidado pastoral no se comparten.", "I authorize KAI to share only my name and contact details with its financial planning team. My other pastoral care answers are not shared.") + "</label></div>";
    }
    var inner;
    if (t === "radio") inner = opts(f);
    else if (t === "checks") inner = opts(f, true);
    else if (t === "scale") inner = scale(f);
    else if (t === "area") inner = '<textarea name="' + k + '"' + (f.ph ? ' placeholder="' + esc(x(f.ph)) + '"' : "") + "></textarea>";
    else if (t === "select") inner = '<select name="' + k + '"><option value="">' + xx("Elija una opción…", "Choose an option…") + "</option>" + sortedOpts(f).map(function (o) { return '<option value="' + o[0] + '">' + (lang() === "es" ? o[1] : o[2]) + "</option>"; }).join("") + "</select>";
    else {
      var ty = f.in === "email" ? "email" : f.in === "tel" ? "tel" : f.in === "date" ? "date" : "text";
      inner = '<input name="' + k + '" type="' + ty + '"' + (f.in === "num" ? ' inputmode="numeric"' : "") + (f.future ? ' min="' + (function () { var d = new Date(Date.now() + 864e5); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); })() + '"' : "") + (f.ph ? ' placeholder="' + esc(x(f.ph)) + '"' : "") + ">";
    }
    if (f.tag) {
      return '<div ' + wrapAttr(f, "ap-q") + '><div class="qh"><span>' + x(f.tag) + "</span><p>" + xl(f) + "</p></div>" + inner + "</div>";
    }
    if (f.desc) return '<div ' + wrapAttr(f, "ap-descf") + '><h4 class="ap-subt">' + xl(f) + (f.req ? ' <span class="ap-req">' + xx("Obligatorio", "Required") + "</span>" : "") + '</h4><div class="ap-desc">' + (lang() === "es" ? f.desc[0] : f.desc[1]).map(function (pp) { return "<p>" + pp + "</p>"; }).join("") + "</div>" + inner + "</div>";
    return '<div ' + wrapAttr(f) + ">" + lab(f) + inner + (f.s ? "<small>" + x(f.s) + "</small>" : "") + "</div>";
  }

  function pairHTML(sec) {
    var L = sec.f.filter(function (f) { return f.pp && !f.sp; }).map(field).join(""), R = sec.f.filter(function (f) { return f.pp && f.sp; }).map(field).join("");
    return '<div class="ap-pair w6"><div class="ap-pcol"><h4 class="ap-pt pl">' + xx("Usted", "You") + '</h4><div class="ap-g6">' + L + '</div></div><div class="ap-pcol ap-cond" data-when="who=pair"><h4 class="ap-pt">' + xx("Su cónyuge", "Your spouse") + '</h4><div class="ap-g6">' + R + "</div></div></div>";
  }
  function section(sec, i) {
    var h = "", box = null, paired = false;
    sec.f.forEach(function (f) {
      if (f.pp) { if (!paired) { paired = true; h += pairHTML(sec); } return; }
      if (f.type === "finbox") { box = ""; return; }
      if (box !== null && f.box) { box += field(f); return; }
      if (box !== null && !f.box) { h += finBox(box); box = null; }
      h += field(f);
    });
    if (box !== null) h += finBox(box);
    var hint = sec.h ? '<p class="hint' + (sec.skip ? " skip" : "") + '">' + dual(x(sec.h), sec.hp ? x(sec.hp) : "") + "</p>" : "";
    return '<div class="ap-blk" id="ap-' + sec.id + '"><h3><i>' + ("0" + (i + 1)).slice(-2) + "</i>" + x(sec.t) + "</h3>" + hint + '<div class="ap-g6">' + h + "</div></div>";
  }
  function finBox(inner) {
    return '<div class="ap-fin w6"><h4>' + xx("Planeación financiera", "Financial planning") + " <span>" + xx("Equipo KAI", "KAI team") + "</span></h4><p>" + xx("KAI colabora con una firma de profesionales con licencia estatal que se especializan en planes de retiro, seguros de vida, planificación patrimonial y educación financiera para los pastores y sus miembros.", "KAI partners with a firm of state-licensed professionals that specialize in retirement planning, life insurance, estate planning and financial education for pastors and their members.") + '</p><div class="ap-g6">' + inner + "</div></div>";
  }

  /* ---------- screens ---------- */
  function intro() {
    var parts = [
      ["A", xx("PARTE A", "PART A"), xx("Solicitud de membresía", "Membership application"), xx("Quién es usted, su familia y su ministerio.", "Who you are, your family and your ministry."), [xx("Datos personales y familia", "Personal information and family"), xx("Declaración de Fe", "Statement of Faith"), xx("Ministerio actual y trabajo", "Current ministry and work"), xx("Historial y formación", "Background and training"), xx("Foto para su credencial", "Photo for your credential")], "", xx("La revisa el Comité de Membresía", "Reviewed by the Membership Committee"), ""],
      ["B", xx("PARTE B", "PART B"), xx("¿En qué podemos servirle?", "How can we serve you?"), xx("Dónde está hoy y qué necesita.", "Where you are today and what you need."), [xx("Lo que más le urge", "What is most urgent"), xx("Formación de líderes", "Leader development"), xx("Su iglesia", "Your church")], "", xx("La revisa el liderazgo de KAI", "Reviewed by KAI's leadership"), ""]
    ];
    var has = Object.keys(S).some(function (k) { return k !== "agree" && k !== "married" && S[k] && (!Array.isArray(S[k]) || S[k].length); });
    return '<div class="hero sm"><div class="wrap"><div class="eyebrow">' + xx("Membresía · Kingdom Alliance International", "Membership · Kingdom Alliance International") + "</div><h1>" + xx("Aplicación de Membresía", "Membership Application") + '</h1><p class="lead ap">' + xx("El paquete de membresía tiene dos metas: conocer al pastor y descubrir qué necesita, para que KAI pueda servirle desde el primer día.", "The membership application has two goals: to get to know you and to discover what you need, so KAI can serve you from day one.") + '</p><p class="ap-meta">' + xx("Dos partes y una revisión final", "Two parts and a final review") + "</p></div></div>" +
      (window.KAIGUIDE ? KAIGUIDE("bar") : "") +
      '<section class="s alt"><div class="wrap"><div class="eyebrow" style="color:var(--gold)">' + xx("Cómo funciona", "How it works") + '</div><h2 style="margin:16px 0 0">' + xx("Dos partes, en este orden", "Two parts, in this order") + '</h2><button type="button" class="ap-privlink" id="ap-priv">' + PRIV_ICON + '<span>' + xx("Aviso de Privacidad y Confidencialidad de la Aplicación de Membresía", "Membership Application Privacy and Confidentiality Notice") + '</span><em>' + (S.agree && S.agree.priv_read ? xx("✓ Leído", "✓ Read") : xx("Leer", "Read")) + '</em></button><div class="ap-steps">' +
      parts.map(function (p) {
        return '<div class="card ' + p[7] + '"><span class="num"' + (p[7] ? ' style="color:rgba(11,31,75,.18)"' : "") + ">" + p[0] + '</span><div class="n">' + p[1] + '</div><div class="wrapc"><h3>' + p[2] + "</h3><p>" + p[3] + '</p><ul class="ap-list">' + p[4].map(function (z) { return "<li>" + z + "</li>"; }).join("") + '</ul><div class="ap-foot">' + (p[5] ? "<span><b>" + p[5] + "</b></span>" : "") + "<span>" + p[6] + "</span></div></div></div>";
      }).join("") + '</div><button type="button" class="ap-privlink ap-signlink" id="ap-sign">' + SIGN_ICON + '<span>' + xx("Instrucciones para la Revisión Final y Firma", "Final Review and Signature Instructions") + '</span><em>' + (S.agree && S.agree.sign_read ? xx("✓ Leído", "✓ Read") : xx("Leer", "Read")) + "</em></button></div></section>" +
      '<section class="s"><div class="wrap ap-two"><div><div class="eyebrow" style="color:var(--gold)">' + xx("Antes de empezar", "Before you start") + "</div><h2>" + xx("Tenga a la mano", "Have these ready") + '</h2><ul class="ap-list"><li>' + xx("Una foto de frente, con fondo claro, para su credencial", "A front-facing photo with a light background for your credential") + "</li><li>" + xx("Si son matrimonio, pueden aplicar juntos en una sola solicitud: tengan a la mano la foto y los datos de ambos", "If you are a married couple, you can apply together in one application: have both photos and details ready") + "</li><li>" + xx("Quién le ordenó y en qué año", "Who ordained you and in what year") + '</li></ul></div><div><div class="eyebrow" style="color:var(--gold)">' + xx("Después de enviar", "After you submit") + "</div><h2>" + xx("Qué sigue", "What's next") + '</h2><div class="vals"><div><h3>' + xx("Revisión", "Review") + "</h3><p>" + xx("El Comité de Membresía revisará su aplicación.", "The Membership Committee will review your application.") + "</p></div><div><h3>" + xx("Una conversación con usted", "A conversation with you") + "</h3><p>" + xx("Alguien de nuestro equipo se comunicará con usted para conocerle mejor, en persona, por teléfono o por video. Es una plática sencilla sobre su ministerio y en qué podemos acompañarle.", "Someone from our team will reach out to get to know you better, in person, by phone or by video. It is a simple conversation about your ministry and how we can walk alongside you.") + "</p></div><div><h3>" + xx("Respuesta", "Response") + "</h3><p>" + xx("Al concluir la revisión de su aplicación, KAI le notificará por escrito el estado de su membresía. Si su aplicación es aprobada, la notificación incluirá las instrucciones para el pago de la cuota anual de membresía y cualquier otro paso necesario para completar su inscripción.", "Upon completion of the application review, KAI will notify you in writing of your membership status. If your application is approved, the notification will include instructions for payment of the annual membership fee and any remaining steps required to finalize your enrollment.") + "</p></div><div><h3>" + xx("Bienvenida", "Welcome") + "</h3><p>" + xx("Al completar el proceso de inscripción, recibirá acceso al Área de Miembros de KAI y se le emitirá su credencial ministerial.", "Upon completion of the enrollment process, you will receive access to the KAI Members Area and be issued your ministerial credential.") + "</p></div></div></div></div></section>" +
      '<section class="s alt"><div class="wrap ap-fee"><div><div class="eyebrow" style="color:var(--gold)">' + xx("Cuota anual", "Annual fee") + '</div><h2>' + xx("Membresía con credencial", "Membership with credential") + '</h2><p class="sub">' + xx("La cuota anual cubre un año de membresía en KAI e incluye la emisión de su credencial ministerial.", "The annual fee covers one year of KAI membership and includes issuance of your ministerial credential.") + '</p>' + payNote() + '</div><div class="ap-tiers"><div class="card"><div class="n">PASTOR</div><p class="ap-price">$100<small> / ' + xx("año", "year") + "</small></p><p>" + xx("Pastor(a) principal, Obispo, Apóstol.", "Senior pastor, Bishop, Apostle.") + '</p></div><div class="card"><div class="n">' + xx("MINISTRO", "MINISTER") + '</div><p class="ap-price">$75<small> / ' + xx("año", "year") + "</small></p><p>" + xx("Pastor asociado, evangelista, misionero u otro ministro.", "Associate pastor, evangelist, missionary or other minister.") + "</p></div></div></div></section>" +
      '<section class="s band"><div class="wrap"><h2>' + (has ? xx("Continúe donde se quedó", "Pick up where you left off") : xx("¿Listo para empezar?", "Ready to begin?")) + "</h2><p>" + xx("Su avance se guarda en este dispositivo, así que puede pausar y continuar después.", "Your progress is saved on this device, so you can pause and continue later.") + '</p><a class="btn gold" href="#/apply/a">' + (has ? xx("Continuar aplicación", "Continue application") : xx("Iniciar aplicación", "Start application")) + "</a>" + (has ? ' <button type="button" class="btn line" id="ap-reset" style="margin-left:10px;background:transparent;cursor:pointer">' + xx("Empezar de nuevo", "Start over") + "</button>" : "") + "</div></section>";
  }

  var PMETA = {
    a: { n: "A", eb: ["Parte A de 2", "Part A of 2"], t: ["Solicitud de membresía", "Membership application"], p: ["Cuéntenos quién es usted y cuál es su ministerio. Los campos marcados como opcionales pueden quedar en blanco.", "Tell us who you are and about your ministry. Fields marked optional may be left blank."], ch: [["7 secciones", "7 sections"], ["Se guarda automáticamente", "Saved automatically"]], prev: null, next: "b", nextT: ["Siguiente: Parte B", "Next: Part B"], end: ["Final de la Parte A", "End of Part A"] },
    b: { n: "B", eb: ["Parte B de 2", "Part B of 2"], t: ["¿En qué podemos servirle?", "How can we serve you?"], p: ["Queremos saber dónde está hoy y qué necesita, para que KAI le sea útil desde el primer día. Toque las opciones; casi no tendrá que escribir.", "We want to know where you are today and what you need, so KAI can be useful to you from day one. Tap the options; you will hardly need to type."], ch: [["5 secciones · ≈ 5 minutos", "5 sections · ≈ 5 minutes"], ["Se guarda automáticamente", "Saved automatically"]], prev: "a", next: "r", nextT: ["Siguiente: Revisión final", "Next: Final review"], end: ["Final de la Parte B", "End of Part B"] },
    c: { n: "C", eb: ["Parte C de 3 · Confidencial", "Part C of 3 · Confidential"], t: ["Cuidado pastoral", "Pastoral care"], p: ["Queremos saber cómo está usted, su familia y su ministerio en esta temporada, para acompañarle de verdad.", "We want to know how you, your family and your ministry are doing in this season, so we can truly walk with you."], ch: [["Todas las preguntas son opcionales", "All questions are optional"], ["Confidencial", "Confidential"]], prev: "b", next: "r", nextT: ["Siguiente: Revisión final", "Next: Final review"], end: ["Final de la Parte C", "End of Part C"] }
  };
  function partScreen(p) {
    var m = PMETA[p], secs = PARTS[p];
    var links = secs.map(function (s, i) { return ["ap-" + s.id, ("0" + (i + 1)).slice(-2), x(s.t)]; });
    var conf = p === "c" ? '<div class="ap-conf-note"><span class="lk">' + LOCK + "</span><div><b>" + xx("Esta parte es confidencial", "This part is confidential") + "</b><p>" + xx("Solo el equipo de cuidado pastoral de KAI ve la información de esta sección. No forma parte de la evaluación de su membresía. Todas las preguntas son opcionales; responda con la libertad que desee.", "Only KAI's pastoral care team sees the information in this section. It is not part of your membership evaluation. All questions are optional; answer as freely as you wish.") + '</p><button type="button" class="ap-privlink" id="ap-priv">' + PRIV_ICON + '<span>' + xx("Aviso de Privacidad y Confidencialidad de la Aplicación de Membresía", "Membership Application Privacy and Confidentiality Notice") + '</span><em>' + (S.agree && S.agree.priv_read ? xx("✓ Leído", "✓ Read") : xx("Leer", "Read")) + "</em></button></div></div>" : "";
    return head(p, x(m.eb), x(m.t), x(m.p), m.ch.map(x)) +
      '<section class="ap-body"><div class="wrap ap-grid">' + side(xx("En esta parte", "In this part"), links, "") + '<div class="ap-main">' + conf + secs.map(section).join("") +
      '<div class="ap-miss" id="ap-miss" role="alert"></div><div class="ap-nav"><p><b>' + x(m.end) + "</b>" + (p === "c" ? xx("Ahora podrá revisar todas sus respuestas antes de enviar.", "Next you can review all your answers before submitting.") : xx("Su avance se guarda automáticamente en este dispositivo.", "Your progress is saved automatically on this device.")) + '</p><div class="acts">' + (m.prev ? '<a class="btn ghost" href="#/apply/' + m.prev + '">' + xx("Atrás", "Back") + "</a>" : "") + '<a class="btn gold" href="#/apply/' + (m.next === "r" ? "review" : m.next) + '" data-next="' + p + '">' + x(m.nextT) + "</a></div></div>" + helpLine("below") + "</div></div></section>";
  }

  /* ---------- review ---------- */
  function longDate(v) { if (!/^\d{4}-\d\d-\d\d$/.test(v)) return v; return new Date(v + "T12:00:00").toLocaleDateString(lang() === "es" ? "es-MX" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
  function fmt(f) {
    var v = S[f.k], t = f.type || "text";
    if (f.future && v) return esc(longDate(v));
    if (t === "radio" || t === "select" || t === "morphe") return esc(optLabel(f, v));
    if (t === "checks") return esc((v || []).filter(function (z) { return z !== "other"; }).map(function (z) { return optLabel(f, z); }).concat((v || []).indexOf("other") >= 0 && S[f.k + "_other"] ? [S[f.k + "_other"]] : []).join(", "));
    if (t === "scale") { var d = ""; for (var i = 1; i <= 5; i++) d += '<i class="' + (i <= v ? "on" : "") + '"></i>'; return '<span class="rv-dots">' + d + "</span> <small>" + v + " / 5</small>"; }
    if (t === "svc") return esc([v, S[f.k + "_2"]].filter(Boolean).join(" · "));
    if (t === "who") return v === "pair" ? xx("Matrimonio · dos credenciales", "Couple · two credentials") : xx("Individual", "Individual");
    if (t === "tier") return v === "ministro" ? xx("Ministro", "Minister") + " · $75 / " + xx("año", "year") : "Pastor · $100 / " + xx("año", "year");
    if (t === "consent") return v ? "✓ " + xx("Autorizado", "Authorized") : "";
    if (t === "faith") return v ? "✓ " + xx("Afirma la Declaración de Fe", "Affirms the Statement of Faith") : "";
    if (t === "file") return FILES[f.k] ? esc(FILES[f.k].name) : "";
    if (f.in === "date" && v) { try { var p = v.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(lang() === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return esc(v); } }
    return esc(v);
  }
  function reviewSection(sec) {
    var cells = [], quotes = [], files = [];
    sec.f.forEach(function (f) {
      if (!f.k || !active(f) || f.type === "pick" || f.nr) return;
      if (f.type === "file") { files.push('<span class="' + (FILES[f.k] ? "" : "no") + '">' + x(f.l) + "</span>"); return; }
      if (!filled(f)) return;
      var label = f.tag ? x(f.tag) : f.type === "who" ? xx("Solicitud", "Application") : f.type === "tier" ? xx("Membresía", "Membership") : f.type === "faith" ? xx("Declaración de Fe", "Statement of Faith") : f.type === "consent" ? xx("Autorización", "Authorization") : f.type === "morphe" ? "Instituto Morphe" : x(f.l);
      if (f.sp) label = xx("Cónyuge · ", "Spouse · ") + label;
      if (f.type === "svc") label = xx("Servicio · ", "Service · ") + label;
      if (f.type === "area") quotes.push('<div class="w"><dt>' + label + '</dt><dd class="rv-quote">' + esc(S[f.k]).replace(/\n/g, "<br>") + "</dd></div>");
      else cells.push("<div" + ((label || "").length > 60 ? ' class="w"' : "") + "><dt>" + label + "</dt><dd>" + fmt(f) + "</dd></div>");
    });
    if (sec.f.some(function (f) { return f.type === "cred"; })) {
      var cc = ["<div><dt>" + xx("Título en credencial", "Title on credential") + "</dt><dd>" + esc(titleLabel()) + "</dd></div>", "<div><dt>" + xx("Nombre en credencial", "Name on credential") + "</dt><dd>" + esc(S.cred_name || "—") + "</dd></div>"];
      if (S.who === "pair") cc.push("<div><dt>" + xx("Cónyuge · Título en credencial", "Spouse · Title on credential") + "</dt><dd>" + esc(titleLabel("sp_")) + "</dd></div>", "<div><dt>" + xx("Cónyuge · Nombre en credencial", "Spouse · Name on credential") + "</dt><dd>" + esc(S.sp_cred_name || "—") + "</dd></div>");
      cells = cc.concat(cells);
    }
    var body = "";
    if (sec.f.some(function (f) { return f.type === "pick"; })) {
      var pr = (S.priorities || []).map(function (c, i) { var b = needDef(c); return "<div><em>" + (i + 1) + "</em>" + (b ? (lang() === "es" ? b[1] : b[2]) : c) + "</div>"; }).join("");
      body += pr ? '<div class="rv-rank">' + pr + "</div>" : "";
    }
    if (cells.length || quotes.length) body += '<dl class="rv-dl">' + cells.join("") + quotes.join("") + "</dl>";
    if (files.length) body += '<div class="rv-files">' + files.join("") + "</div>";
    if (!body) body = '<p class="rv-empty">' + xx("Sin respuestas", "No answers") + "</p>";
    return '<div class="rv-grp"><h5>' + x(sec.t) + "</h5>" + body + "</div>";
  }
  function titleLabel(pre) { var t = S[(pre || "") + "title"] || "Pastor"; var o = SC.TITLES.filter(function (z) { return z[0] === t; })[0]; return o ? (lang() === "es" ? o[1] : o[2]) : t; }
  function titlesSorted() { var i = lang() === "es" ? 1 : 2; return SC.TITLES.slice().sort(function (a, b) { return a[i].localeCompare(b[i], lang()); }); }
  var OLD_TITLES = { "Pastora": "Pastor", "Reverendo": "Pastor", "Reverenda": "Pastor", "Apóstol": "Apostle", "Obispo": "Bishop", "Evangelista": "Evangelist", "Misionero": "Missionary", "Misionera": "Missionary", "Ministro": "Ordained Minister" };
  function initials(pre) { pre = pre || ""; var a = (S[pre + "cred_name"] || ((S[pre + "first_name"] || "") + " " + (S[pre + "last_name"] || ""))).trim().split(/\s+/); return ((a[0] || "")[0] || "") + ((a.length > 1 ? a[a.length - 1] : "")[0] || ""); }
  function partStatus(p) {
    var secs = PARTS[p], n = secs.filter(function (s) { return (s.id === "a3" && S.who === "pair") || s.f.some(function (f) { return f.k && active(f) && filled(f); }); }).length;
    return [n, secs.length];
  }
  function review() {
    var P = S.who === "pair", tier = S.tier || "pastor";
    function heroCard(pre) {
      var tr = S[pre + "tier"] || "pastor", ph = PREV[pre + "photo"] ? '<img src="' + PREV[pre + "photo"] + '" alt="">' : "<div>" + esc(initials(pre).toUpperCase() || "KAI") + "</div>";
      return '<div class="rv-cred"><div class="hd"><span>Kingdom Alliance International</span><span class="tier">' + (tr === "pastor" ? "PASTOR" : xx("MINISTRO", "MINISTER")) + '</span></div><div class="bd"><div class="phx">' + ph + "</div><div><small>" + esc(titleLabel(pre)) + "</small><b>" + esc(S[pre + "cred_name"] || ((S[pre + "first_name"] || "") + " " + (S[pre + "last_name"] || "")).trim() || "—") + '</b><div class="ch">' + esc([S.church, [S.city, S.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + '</div></div></div><div class="ft"><div>' + xx("Membresía", "Membership") + "<strong>" + (tr === "pastor" ? "Pastor" : xx("Ministro", "Minister")) + " · $" + FEES[tr] + " / " + xx("año", "year") + '</strong></div><div style="text-align:right">' + xx("Idioma", "Language") + "<strong>" + (S.lang_pref === "en" ? "English" : "Español") + "</strong></div></div></div>";
    }
    var tier2 = S.sp_tier || "pastor", feeTotal = FEES[tier] + (P ? FEES[tier2] : 0);
    var a = partStatus("a"), b = partStatus("b");
    var PL0 = S.who === "pair";
    var ag = [["fe", PL0 ? xx("Afirmamos la Declaración de Fe de KAI.", "We affirm KAI's Statement of Faith.") : xx("Afirmo la Declaración de Fe de KAI.", "I affirm KAI's Statement of Faith.")], ["pacto", PL0 ? xx("Aceptamos el Pacto de Membresía.", "We accept the Membership Covenant.") : xx("Acepto el Pacto de Membresía.", "I accept the Membership Covenant.")], ["etica", PL0 ? xx("Aceptamos el Código de Ética Ministerial.", "We accept the Ministerial Code of Ethics.") : xx("Acepto el Código de Ética Ministerial.", "I accept the Ministerial Code of Ethics.")], ["datos", PL0 ? xx("Aceptamos la política de Uso y Protección de Datos de KAI.", "We accept KAI's Data Use and Protection policy.") : xx("Acepto la política de Uso y Protección de Datos de KAI.", "I accept KAI's Data Use and Protection policy.")]];
    var today = new Date().toLocaleDateString(lang() === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric" });
    return head("r", xx("Último paso", "Last step"), xx("Revisión final", "Final review"), xx("Revise sus respuestas. Puede corregir cualquier parte antes de firmar y enviar su aplicación.", "Review your answers. You can correct any part before signing and submitting your application."), [xx("Revise", "Review"), xx("Firme", "Sign"), xx("Envíe", "Submit")]) +
      '<section class="ap-body"><div class="wrap ap-grid">' + side(xx("Su aplicación", "Your application"), [["rv-s0", "✓", xx("Resumen", "Summary")], ["rv-s1", "A", xx("Solicitud", "Application")], ["rv-s2", "B", xx("Necesidades", "Needs")], ["rv-s4", "✎", xx("Firma y envío", "Sign and submit")]], "") + '<div class="ap-main">' +
      '<div class="rv-hero' + (P ? " pair" : "") + '" id="rv-s0">' + (P ? '<div class="rv-creds">' + heroCard("") + heroCard("sp_") + "</div>" : heroCard("")) +
      '<div class="rv-stat"><h4>' + xx("Estado de su aplicación", "Application status") + "</h4><ul>" +
      stat(xx("Parte A · Solicitud", "Part A · Application"), a[0] + " / " + a[1], a[0] === a[1]) + stat(xx("Parte B · Necesidades", "Part B · Needs"), b[0] + " / " + b[1], b[0] > 0) + "</ul></div></div>" +
      card("rv-s1", "A", xx("Solicitud de membresía", "Membership application"), xx("La revisa el Comité de Membresía", "Reviewed by the Membership Committee"), "a", PARTS.a.map(reviewSection).join("")) +
      card("rv-s2", "B", xx("¿En qué podemos servirle?", "How can we serve you?"), xx("La revisa el liderazgo de KAI", "Reviewed by KAI's leadership"), "b", PARTS.b.map(reviewSection).join("")) +
      '<div class="rv-card rv-sign" id="rv-s4"><div class="rv-top"><span class="lt">✎</span><div><h3>' + xx("Acuerdos y firma", "Agreements and signature") + "</h3><p>" + xx("Lea, acepte y firme con su dedo o con el mouse", "Read, accept and sign with your finger or mouse") + '</p></div></div><div class="rv-body"><div class="rv-agree">' +
      ag.map(function (g) { var read = g[0] !== "refs"; return '<label data-ag="' + g[0] + '"' + (g[0] === "refs" ? ' class="rv-agb"' : "") + '><input type="checkbox" name="agree_' + g[0] + '"' + (read && !S.agree[g[0] + "_read"] ? " disabled" : "") + ">" + g[1] + (read ? '<button type="button" class="rv-read' + (S.agree[g[0] + "_read"] ? " done" : "") + '" data-doc="' + g[0] + '">' + (S.agree[g[0] + "_read"] ? xx("Leído", "Read") : xx("Leer", "Read")) + "</button>" : "") + "</label>"; }).join("") +
      '</div><p class="rv-hintr">' + xx("Abra cada documento con “Leer” para poder aceptarlo.", "Open each document with “Read” to be able to accept it.") + '</p><div class="ap-errm" data-errfor="agree"></div>' +
      sigPad("", P) + (P ? sigPad("sp_", P) : "") +
      '<div class="rv-fee"><div><p><strong class="rv-feet">' + (P ? xx("Cuotas anuales", "Annual Fees") : xx("Cuota anual", "Annual Fee")) + "</strong>" + xx("Solo después de ser aprobado. Le enviaremos las instrucciones de pago por correo.", "Only after you are approved. We will send you the payment instructions by email.") + "</p><b>$" + feeTotal + ' <small style="font:500 14px var(--sans);color:var(--mut)">' + (P ? (tier === "pastor" ? "Pastor $100" : xx("Ministro", "Minister") + " $75") + " + " + (tier2 === "pastor" ? "Pastor $100" : xx("Ministro", "Minister") + " $75") : (tier === "pastor" ? "Pastor" : xx("Ministro", "Minister"))) + '</small></b></div><div class="rv-tags"><span class="hl">' + (P ? xx("Incluye una credencial para cada uno", "Includes a credential for each of you") : xx("Incluye credencial ministerial", "Includes ministry credential")) + "</span></div></div></div></div>" +
      '<p class="hp" aria-hidden="true"><label>Leave empty <input name="hp_field" tabindex="-1" autocomplete="off"></label></p>' +
      '<div class="ap-nav"><p><b>' + xx("¿Todo listo?", "All set?") + "</b>" + xx("Al enviar, el Comité de Membresía recibirá su aplicación.", "When you submit, the Membership Committee will receive your application.") + '</p><div class="acts"><a class="btn ghost" href="#/apply/c">' + xx("Atrás", "Back") + '</a><button type="button" class="btn gold" id="rv-send">' + xx("Enviar aplicación", "Submit application") + '</button></div></div><p class="ap-sendmsg" id="rv-msg"></p>' + helpLine("below") + '</div></div></section>';
  }
  function sigPad(pre, P) {
    var n = pre ? "2" : "", today = new Date().toLocaleDateString(lang() === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric" });
    return (P ? '<p class="rv-whosig">' + (pre ? xx("Firma de su cónyuge", "Your spouse's signature") : xx("Su firma", "Your signature")) + "</p>" : "") +
      '<div class="rv-pad"><div>' + (P ? "" : '<div class="fld" style="margin:0 0 8px"><label>' + xx("Su firma", "Your signature") + "</label></div>") + '<div class="rv-canvas"><canvas id="rv-sig' + n + '"></canvas><span class="x">×</span><span class="ln"></span><span class="sp">' + xx("Firme aquí con su dedo o con el mouse", "Sign here with your finger or mouse") + '</span><button type="button" class="rv-clear">' + xx("Borrar", "Clear") + '</button></div><div class="ap-errm" data-errfor="sig' + n + '"></div></div><div><div class="fld" data-k="' + pre + 'signed_name"><label>' + xx("Nombre completo", "Full name") + '</label><input name="' + pre + 'signed_name"></div><div class="fld" style="margin:0"><label>' + xx("Fecha", "Date") + '</label><input value="' + today + '" readonly></div></div></div>';
  }
  function stat(l, r, ok) { return '<li><i class="' + (ok ? "" : "no") + '">' + (ok ? "✓" : "–") + "</i>" + l + "<span>" + r + "</span></li>"; }
  function card(id, lt, t, sub, p, body) { return '<div class="rv-card" id="' + id + '"><div class="rv-top"><span class="lt">' + lt + "</span><div><h3>" + t + "</h3><p>" + sub + '</p></div><a class="rv-edit" href="#/apply/' + p + '">' + xx("Editar", "Edit") + '</a></div><div class="rv-body">' + body + "</div></div>"; }
  function countC() { var n = 0; PARTS.c.forEach(function (s) { s.f.forEach(function (f) { if (f.k && active(f) && filled(f)) n++; }); }); return n + " " + xx("preguntas respondidas · ocultas por privacidad", "questions answered · hidden for privacy"); }
  function doneScreen() {
    return head("r", xx("Aplicación enviada", "Application submitted"), xx("¡Gracias!", "Thank you!"), xx("Hemos recibido su aplicación.", "We have received your application."), [xx("Enviada", "Submitted")]) +
      '<section class="ap-body"><div class="wrap" style="max-width:760px"><div class="rv-ok"><div class="ck">✓</div><h2>' + xx("¡Aplicación enviada!", "Application submitted!") + '</h2><div class="rv-no"><small>' + (/·/.test(DONE) ? xx("Sus números de aplicación", "Your application numbers") : xx("Su número de aplicación", "Your application number")) + "</small><b>" + esc(DONE) + "</b><span>" + (/·/.test(DONE) ? xx("Guárdenlos. Cada uno será también su número de cuenta con KAI.", "Keep them. Each will also be your KAI account number.") : xx("Guárdelo. Será también su número de cuenta con KAI.", "Keep it. It will also be your KAI account number.")) + "</span></div>" + (PDFURL ? '<p style="margin:4px 0 22px"><a class="btn gold" id="ap-pdf" href="' + PDFURL + '" download="KAI-' + xx("Aplicacion", "Application") + "-" + esc(DONE) + '.pdf">' + xx("Descargar mi copia firmada (PDF)", "Download my signed copy (PDF)") + '</a><br><small style="color:var(--mut,#5b6577)">' + xx("Incluye todas sus respuestas, su firma y los documentos que aceptó. Guárdela en un lugar seguro.", "Includes all your answers, your signature and the documents you accepted. Keep it somewhere safe.") + "</small></p>" : "") + "<p>" + xx("El Comité de Membresía revisará su aplicación y alguien de nuestro equipo se comunicará con usted para una breve conversación y conocerle mejor.", "The Membership Committee will review your application, and someone from our team will reach out for a brief conversation to get to know you better.") + "</p>" + (window.KAIGUIDE ? KAIGUIDE("card") : "") + "<p>" + xx("Si tiene preguntas, escríbanos a info@kaie44.org e incluya su número de aplicación.", "If you have questions, write to info@kaie44.org and include your application number.") + '</p><p style="margin-top:22px"><a class="btn navy" href="#/home">' + xx("Volver al inicio", "Back to home") + "</a></p></div></div></section>";
  }

  /* ---------- binding ---------- */
  function restore(root) {
    $$("input[name],select[name],textarea[name]", root).forEach(function (el) {
      var k = el.name, v = S[k];
      if (k.indexOf("agree_") === 0) { el.checked = !!S.agree[k.slice(6)]; return; }
      if (el.type === "radio") el.checked = v === el.value;
      else if (el.type === "checkbox") el.checked = el.hasAttribute("data-multi") ? Array.isArray(v) && v.indexOf(el.value) >= 0 : !!v;
      else if (el.tagName === "SELECT") { if (k === "title" && OLD_TITLES[v]) { v = S.title = OLD_TITLES[v]; } if (v != null) el.value = v; else { S[k] = el.value; } }
      else if (v != null) el.value = v;
    });
    conds(root); pickDraw(root); progress(root);
  }
  function syncDerived() { S.married = (S.who === "pair" || S.marital === "c") ? "y" : "n"; }
  function conds(root) {
    syncDerived();
    if (CUR) CUR.classList.toggle("pairmode", S.who === "pair");
    $$(".ap-cond[data-when]", root).forEach(function (c) {
      var w = c.getAttribute("data-when").split("="), v = S[w[0]], vals = w[1].split(",");
      var srcF = ALL[w[0]];
      var ok = (Array.isArray(v) ? v.some(function (z) { return vals.indexOf(z) >= 0; }) : vals.indexOf(v) >= 0) && (!srcF || active(srcF));
      c.classList.toggle("show", ok);
    });
    $$(".ap-svc", root).forEach(function (w) { var kk = w.getAttribute("data-k"); if (S[kk + "_2"]) w.classList.add("has2"); });
  }
  function sameAddr(on) {
    var m = { church_addr: "address", church_city: "city", church_state: "state", church_zip: "zip" };
    Object.keys(m).forEach(function (k) { var v = on ? (S[m[k]] || "") : ""; S[k] = v; var el = $('[name="' + k + '"]', CUR); if (el) el.value = v; });
  }
  function onInput(e) {
    var el = e.target, k = el.name;
    if (!k || k === "hp_field") return;
    if (k.indexOf("agree_") === 0) { S.agree[k.slice(6)] = el.checked; if (["fe", "pacto", "etica", "datos"].every(function (z) { return S.agree[z]; })) { var ae = $('[data-errfor="agree"]', CUR); if (ae) ae.textContent = ""; } }
    else if (el.type === "checkbox" && el.hasAttribute("data-multi")) {
      S[k] = $$('input[name="' + k + '"]:checked', CUR).map(function (z) { return z.value; });
    } else if (el.type === "checkbox") S[k] = el.checked;
    else if (el.type === "radio") { if (el.checked) S[k] = el.value; }
    else S[k] = el.value;
    if (k === "church_same") sameAddr(el.checked);
    var w = el.closest(".fld,.ap-file,.ap-q"); if (w) { w.classList.remove("err"); var em = $(":scope > .ap-errm", w); if (em) em.textContent = ""; }
    credErrClear();
    conds(CUR); progress(CUR); save();
  }
  function progress(root) {
    var pg = $(".pgt", root), p = CUR && CUR.getAttribute("data-scr");
    if (!pg || !PARTS[p]) { if (pg && p === "r") { pg.textContent = xx("Listo para firmar", "Ready to sign"); $(".pgb", root).style.width = "100%"; } return; }
    var st = partStatus(p);
    pg.textContent = st[0] + " " + xx("de", "of") + " " + st[1] + " " + xx("secciones", "sections");
    $(".pgb", root).style.width = (st[0] / st[1] * 100) + "%";
  }
  function pickDraw(root) {
    var pk = $(".ap-pick", root); if (!pk) return;
    var ord = S.priorities || [];
    $$("button", pk).forEach(function (b) { var i = ord.indexOf(b.dataset.b); b.classList.toggle("sel", i >= 0); $("em", b).textContent = i >= 0 ? i + 1 : ""; });
    pk.classList.toggle("full", ord.length >= 3);
    $$(".ap-pick-st i", root).forEach(function (s, i) { s.classList.toggle("on", i < ord.length); });
    $(".ap-pick-st span", root).textContent = ord.length >= 3 ? xx("Listo", "Done") : xx("Elija ", "Choose ") + (3 - ord.length);
  }
  function compress(file) {
    return new Promise(function (res) {
      if (!/^image\//.test(file.type) || /hei[cf]/i.test(file.type)) return res(file);
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var m = 1000, w = img.width, h = img.height, s = Math.min(1, m / Math.max(w, h)), c = document.createElement("canvas");
        c.width = Math.round(w * s); c.height = Math.round(h * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { URL.revokeObjectURL(url); if (!b) return res(file); b.name = file.name.replace(/\.[^.]+$/, "") + ".jpg"; res(b); }, "image/jpeg", 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }
  function onFile(e) {
    var el = e.target, k = el.getAttribute("data-file"), f = el.files && el.files[0];
    if (!k || !f) return;
    if (f.size > 10485760) { alertMsg(el, xx("El archivo pasa de 10 MB. Intente con uno más pequeño.", "The file is over 10 MB. Please try a smaller one.")); el.value = ""; return; }
    compress(f).then(function (b) {
      if (k === "photo" || k === "sp_photo") { el.value = ""; ORIG[k].photo = b; ORIG[k].pos = { x: 0, y: 0, z: 1 }; return cropPhoto(b, ORIG[k].pos).then(function (c) { setPhoto(k, c); openCrop(k); }); }
      FILES[k] = b; if (!FILES[k].name) FILES[k].name = f.name; fput(k, { blob: b, n: f.name });
      if (false) {}
      else { var row = $('.ap-file[data-k="' + k + '"] p', CUR); if (row) { var o = $(".fn", row); if (o) o.remove(); row.insertAdjacentHTML("beforeend", '<small class="fn">✓ ' + esc(f.name) + "</small>"); } }
      progress(CUR);
    });
  }
  /* ---------- foto: ajustar (mover/acercar) y eliminar ---------- */
  var ORIG = { photo: { photo: null, pos: { x: 0, y: 0, z: 1 } }, sp_photo: { photo: null, pos: { x: 0, y: 0, z: 1 } } };
  function oKey(pk) { return pk === "photo" ? "_orig" : "_orig_sp_photo"; }
  function resetOrig() { ORIG.photo.photo = null; ORIG.sp_photo.photo = null; ORIG.photo.pos = { x: 0, y: 0, z: 1 }; ORIG.sp_photo.pos = { x: 0, y: 0, z: 1 }; }
  function setPhoto(pk, blob) {
    var og = ORIG[pk], sfx = pk === "sp_photo" ? "-sp" : "";
    if (PREV[pk]) try { URL.revokeObjectURL(PREV[pk]); } catch (e) {}
    if (!blob) { delete FILES[pk]; PREV[pk] = null; fput(pk, null); fput(oKey(pk), null); } else { blob.name = "photo.jpg"; FILES[pk] = blob; PREV[pk] = URL.createObjectURL(blob); fput(pk, { blob: blob, n: "photo.jpg" }); fput(oKey(pk), og.photo ? { blob: og.photo, pos: og.pos } : null); }
    var ph = $("#ap-ph" + sfx, CUR);
    if (ph) ph.outerHTML = PREV[pk] ? '<img id="ap-ph' + sfx + '" src="' + PREV[pk] + '" alt="" title="' + xx("Clic para ajustar", "Click to adjust") + '">' : '<div class="ph0" id="ap-ph' + sfx + '">' + xx("Su foto aparecerá aquí", "Your photo will appear here") + "</div>";
    var bt = $("#ap-phbtns" + sfx, CUR); if (bt) bt.hidden = !PREV[pk];
    if (blob) { var em = $('[data-errfor="' + pk + '"]', CUR); if (em) em.textContent = ""; }
    credErrClear();
    progress(CUR);
  }
  function credErrClear() {
    ["", "sp_"].forEach(function (pre) {
      var pw = $('[data-k="' + pre + 'photo"]', CUR); if (!pw) return;
      if (S[pre + "title"] && (S[pre + "cred_name"] || "").trim() && FILES[pre + "photo"]) { pw.classList.remove("err"); $$(".ap-errm", pw).forEach(function (m) { m.textContent = ""; }); }
    });
  }
  function loadImg(blob) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = URL.createObjectURL(blob); }); }
  // Recorte 4:5. pos.x / pos.y de -1 a 1 (desplazamiento), pos.z = acercamiento (1 a 3)
  function cropPhoto(blob, pos) {
    return loadImg(blob).then(function (img) {
      var W = 800, H = 1000, base = Math.max(W / img.width, H / img.height), sc = base * pos.z;
      var dw = img.width * sc, dh = img.height * sc, ox = (dw - W) / 2, oy = (dh - H) / 2;
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      c.getContext("2d").drawImage(img, -ox - pos.x * ox, -oy - pos.y * oy, dw, dh);
      return new Promise(function (res) { c.toBlob(function (b) { res(b); }, "image/jpeg", 0.88); });
    }).catch(function () { return blob; });
  }
  function openCrop(pk) {
    pk = pk || "photo"; var og = ORIG[pk];
    if (!og.photo && FILES[pk]) { og.photo = FILES[pk]; og.pos = { x: 0, y: 0, z: 1 }; }
    if (!og.photo) return;
    var pos = { x: og.pos.x, y: og.pos.y, z: og.pos.z };
    var M = document.createElement("div"); M.className = "rv-modal on ap-cropm";
    M.innerHTML = '<div class="rv-mbox" role="dialog" aria-modal="true"><div class="rv-mhd"><div><small>' + xx("Foto de credencial", "Credential photo") + (pk === "sp_photo" ? " · " + xx("su cónyuge", "your spouse") : "") + "</small><h3>" + xx("Ajuste la foto", "Adjust the photo") + '</h3></div><button class="rv-mx" type="button" aria-label="Close">×</button></div><div class="rv-mbd"><p class="ap-crophelp">' + xx("Arrastre la foto para centrar su rostro y use la barra para acercar o alejar.", "Drag the photo to center your face and use the slider to zoom in or out.") + '</p><div class="ap-crop"><div class="ap-cropbox"><img alt=""><i class="g1"></i><i class="g2"></i></div></div><label class="ap-zoom"><span>−</span><input type="range" min="1" max="3" step="0.01"><span>+</span></label></div><div class="rv-mft"><p><button type="button" class="btn navy ap-cropdel">' + xx("Eliminar foto", "Delete photo") + '</button></p><button type="button" class="btn gold ap-cropok">' + xx("Guardar", "Save") + "</button></div></div>";
    document.body.appendChild(M); document.body.style.overflow = "hidden";
    var box = $(".ap-cropbox", M), im = $("img", box), rg = $("input", M), url = URL.createObjectURL(og.photo), nat = { w: 1, h: 1 };
    rg.value = pos.z;
    function draw() {
      var W = box.clientWidth, H = box.clientHeight, base = Math.max(W / nat.w, H / nat.h), sc = base * pos.z;
      var dw = nat.w * sc, dh = nat.h * sc, ox = (dw - W) / 2, oy = (dh - H) / 2;
      im.style.width = dw + "px"; im.style.height = dh + "px"; im.style.left = (-ox - pos.x * ox) + "px"; im.style.top = (-oy - pos.y * oy) + "px";
      M._o = { ox: ox, oy: oy };
    }
    im.onload = function () { nat = { w: im.naturalWidth, h: im.naturalHeight }; draw(); };
    im.src = url;
    var drag = null;
    box.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; try { box.setPointerCapture(e.pointerId); } catch (er) {} box.classList.add("dg"); });
    box.addEventListener("pointermove", function (e) {
      if (!drag) return; var o = M._o || { ox: 0, oy: 0 };
      pos.x = o.ox > 0 ? Math.max(-1, Math.min(1, drag.px - (e.clientX - drag.x) / o.ox)) : 0;
      pos.y = o.oy > 0 ? Math.max(-1, Math.min(1, drag.py - (e.clientY - drag.y) / o.oy)) : 0;
      draw();
    });
    function up() { drag = null; box.classList.remove("dg"); }
    box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
    rg.addEventListener("input", function () { pos.z = +rg.value; draw(); });
    function close() { URL.revokeObjectURL(url); M.remove(); document.body.style.overflow = ""; }
    M.addEventListener("click", function (e) { if (e.target === M || e.target.closest(".rv-mx")) close(); });
    $(".ap-cropok", M).onclick = function () { og.pos = pos; cropPhoto(og.photo, pos).then(function (b) { setPhoto(pk, b); close(); }); };
    $(".ap-cropdel", M).onclick = function () { og.photo = null; setPhoto(pk, null); close(); };
  }
  function alertMsg(el, msg) { var w = el.closest(".fld,.ap-file"); if (!w) return; var m = $(".ap-errm", w) || (w.insertAdjacentHTML("beforeend", '<div class="ap-errm"></div>'), $(".ap-errm:last-child", w)); m.textContent = msg; w.classList.add("err"); }

  /* Nombre claro de cada dato que falta, con su sección */
  var MISS_NAMES = {
    title: ["Título en la credencial", "Title on the credential"], cred_name: ["Nombre en la credencial", "Name on the credential"],
    photo: ["Foto para la credencial", "Credential photo"], tier: ["Tipo de membresía", "Membership type"],
    faith_ok: ["Aceptar la Declaración de Fe", "Accept the Statement of Faith"],
    iv_date1: ["Día de la conversación de bienvenida", "Welcome conversation day"], iv_time1: ["Hora de la conversación de bienvenida", "Welcome conversation time"],
    iv_spouse: ["Confirmar que su cónyuge estará presente", "Confirm that your spouse will be present"],
    who: ["Quién va a aplicar (individual o matrimonio)", "Who is applying (individual or couple)"],
    sp_title: ["Cónyuge · Título en la credencial", "Spouse · Title on the credential"], sp_cred_name: ["Cónyuge · Nombre en la credencial", "Spouse · Name on the credential"],
    sp_photo: ["Cónyuge · Foto para la credencial", "Spouse · Credential photo"], sp_tier: ["Cónyuge · Tipo de membresía", "Spouse · Membership type"],
    sp_faith_ok: ["Cónyuge · Aceptar la Declaración de Fe", "Spouse · Accept the Statement of Faith"],
    signed_name: ["Su nombre completo debajo de la firma", "Your full name below the signature"], sp_signed_name: ["Cónyuge · Nombre completo debajo de la firma", "Spouse · Full name below the signature"]
  };
  function secOf(k) {
    var r = null;
    ["a", "b", "c"].forEach(function (p) { PARTS[p].forEach(function (sec, i) { sec.f.forEach(function (f) { if (f.k === k || (f.type === "cred" && /^(sp_)?(title|cred_name|photo)$/.test(k))) r = r || [p, i, sec]; }); }); });
    return r;
  }
  function missName(k) {
    var f = ALL[k], nm = MISS_NAMES[k] ? x(MISS_NAMES[k]) : (f && f.ml ? x(f.ml) : f && f.l ? x(f.l) : k);
    if (!MISS_NAMES[k] && f && f.sp) nm = xx("Cónyuge · ", "Spouse · ") + nm;
    if (f && f.in === "email" && filled(f)) nm += " " + xx("(revise que esté bien escrito)", "(check that it is typed correctly)");
    return nm;
  }
  function missList(keys, withPart) {
    var seen = {};
    return "<ul>" + keys.filter(function (k) { if (seen[k]) return false; seen[k] = 1; return true; }).map(function (k) {
      var s = secOf(k), where = s ? (withPart ? xx("Parte ", "Part ") + s[0].toUpperCase() + " · " : "") + ("0" + (s[1] + 1)).slice(-2) + " " + x(s[2].t) : "";
      var href = s ? (withPart ? "#/apply/" + s[0] : "#") : "#";
      return '<li><a href="' + href + '" ' + (withPart ? 'data-goto="' + k + '"' : 'data-miss="' + k + '"') + '><b>' + esc(missName(k)) + "</b>" + (where ? "<span>" + esc(where) + "</span>" : "") + "</a></li>";
    }).join("") + "</ul>";
  }
  function showMiss(box, keys, title, withPart) {
    if (!box) return;
    if (!keys.length) { box.innerHTML = ""; box.classList.remove("on"); return; }
    box.innerHTML = '<p><b>' + title + "</b>" + xx("Toque cada uno para ir directo a él.", "Tap each one to go straight to it.") + "</p>" + missList(keys, withPart);
    box.classList.add("on");
  }

  function validate(p) {
    var miss = [];
    PARTS[p].forEach(function (sec) {
      sec.f.forEach(function (f) {
        if (f.type === "cred") {
          var pre = f.sp ? "sp_" : "";
          if (f.sp && S.who !== "pair") return;
          if (!S[pre + "title"]) miss.push(pre + "title");
          if (!(S[pre + "cred_name"] || "").trim()) miss.push(pre + "cred_name");
          if (!FILES[pre + "photo"]) miss.push(pre + "photo");
          return;
        }
        if (f.req && active(f) && !filled(f)) miss.push(f.k);
        if (f.in === "email" && filled(f) && active(f) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(S[f.k].trim())) miss.push(f.k);
        if (f.k === "sp_email" && active(f) && filled(f) && S.email && S.sp_email.trim().toLowerCase() === S.email.trim().toLowerCase() && miss.indexOf("sp_email") < 0) miss.push("sp_email");
      });
    });
    $$(".err", CUR).forEach(function (z) { z.classList.remove("err"); });
    miss.forEach(function (k) {
      var w = $('[data-k="' + k + '"]', CUR); if (!w) return;
      w.classList.add("err");
      var m = $(":scope > .ap-errm", w) || $('[data-errfor="' + k + '"]', w);
      if (!m) { w.insertAdjacentHTML("beforeend", '<div class="ap-errm"></div>'); m = w.lastElementChild; }
      m.textContent = (k === "photo" || k === "sp_photo") ? xx("Suba una foto para la credencial.", "Please upload a photo for the credential.") : (k === "sp_email" && S.email && (S.sp_email || "").trim().toLowerCase() === S.email.trim().toLowerCase()) ? xx("El correo de su cónyuge debe ser distinto al suyo.", "Your spouse's email must be different from yours.") : (ALL[k] && ALL[k].in === "email" && filled(ALL[k])) ? xx("Revise el correo electrónico.", "Please check the email address.") : xx("Este dato es necesario.", "This information is required.");
    });
    var box = $("#ap-miss", CUR);
    showMiss(box, miss, miss.length === 1 ? xx("Falta 1 dato para continuar:", "1 item is missing before you can continue:") : xx("Faltan " + miss.length + " datos para continuar:", miss.length + " items are missing before you can continue:"), false);
    if (miss.length) { if (box) box.scrollIntoView({ behavior: "smooth", block: "center" }); else { var first = $(".err", CUR); if (first) first.scrollIntoView({ behavior: "smooth", block: "center" }); } }
    return !miss.length;
  }

  /* ---------- documents modal ---------- */
  function docHTML(k) {
    if (k === "fe") return faithHTML();
    var d = SC.DOCS[k], es = lang() === "es";
    return '<p class="dc-in">' + x(d.i) + '</p><ol class="dc-list">' + d.x.map(function (it) { var z = es ? it[0] : it[1]; return "<li><b>" + z[0] + ".</b> " + z[1] + "</li>"; }).join("") + "</ol>" + (d.c ? '<p class="dc-in">' + x(d.c) + "</p>" : "");
  }
  var PRIV_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>';
  var SIGN_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var SIGNTXT = {
    es: ["Antes de enviar su aplicación, tendrá la oportunidad de revisar un resumen de sus respuestas y hacer las correcciones necesarias. Después se le pedirá que revise y firme electrónicamente el Pacto de Membresía usando su dedo, el mouse u otro dispositivo de entrada compatible.",
      "Al firmar y enviar, usted certifica que la información proporcionada es correcta y completa según su leal saber y entender, y afirma que ha leído, entiende y acepta los términos del Pacto de Membresía."],
    en: ["Before submitting your application, you will have the opportunity to review a summary of your responses and make any necessary corrections. You will then be asked to review and electronically sign the Membership Covenant using your finger, mouse, or other compatible input device.",
      "By signing and submitting, you certify that the information provided is accurate and complete to the best of your knowledge and affirm that you have read, understand, and agree to the terms of the Membership Covenant."]
  };
  var PRIV = {
    es: ["Kingdom Alliance International (KAI) respeta su privacidad y está comprometida con proteger la confidencialidad de su información.",
      "Toda la información que usted presente en su aplicación de membresía y en su entrevista, incluidos los documentos que la acompañan, se usará únicamente para procesar y revisar su aplicación, determinar su elegibilidad y tomar una decisión sobre la aprobación de su membresía.",
      "El acceso a cada parte de su aplicación está restringido al personal de KAI debidamente autorizado cuyas responsabilidades asignadas requieran dicho acceso. Estas personas deben mantener la confidencialidad y solo pueden revisar y procesar la información en la medida necesaria para cumplir con sus responsabilidades de revisión de aplicaciones.",
      "KAI nunca venderá, alquilará, intercambiará ni usará la información de su aplicación con fines de mercadeo. Su información no se compartirá con personas u organizaciones externas, excepto cuando la divulgación sea requerida por la ley aplicable o por una orden judicial legalmente exigible. Cualquier divulgación requerida se limitará a la información que la ley exija."],
    en: ["Kingdom Alliance International (KAI) respects your privacy and is committed to protecting the confidentiality of your information.",
      "All information submitted in your membership application and in your interview, including accompanying documents, will be used solely to process and review your application, determine eligibility, and make a membership approval decision.",
      "Access to each part of your application is restricted to duly authorized KAI personnel whose assigned responsibilities require that access. These individuals must maintain confidentiality and may review and process information only as necessary to fulfill their application review responsibilities.",
      "KAI will never sell, rent, trade, or use your application information for marketing purposes. Your information will not be shared with outside individuals or organizations, except where disclosure is required by applicable law or a legally enforceable court order. Any required disclosure will be limited to the information legally required."]
  };
  function openDoc(k) {
    var M = $("#rv-modal");
    if (!M) { document.body.insertAdjacentHTML("beforeend", '<div class="rv-modal" id="rv-modal" role="dialog" aria-modal="true"><div class="rv-mbox"><div class="rv-mhd"><div><small>Kingdom Alliance International</small><h3></h3></div><button class="rv-mx" type="button" aria-label="Close">×</button></div><div class="rv-mbd"></div><div class="rv-mft"><p></p><button type="button" class="btn gold" id="rv-acc"></button></div></div></div>'); M = $("#rv-modal");
      M.addEventListener("click", function (e) { if (e.target === M || e.target.closest(".rv-mx")) closeDoc(); });
      $("#rv-acc", M).addEventListener("click", function () {
        var key = M.getAttribute("data-k");
        if (key === "priv" || key === "sign") { S.agree[key + "_read"] = new Date().toISOString(); save(); closeDoc(); var pl = $("#ap-" + key + " em", CUR); if (pl) { pl.textContent = xx("✓ Leído", "✓ Read"); pl.parentNode.classList.add("done"); } return; }
        S.agree[key + "_read"] = true; S.agree[key] = true; save(); closeDoc();
        var l = $('[data-ag="' + key + '"]', CUR); if (l) { var i = $("input", l); i.disabled = false; i.checked = true; var b = $(".rv-read", l); b.classList.add("done"); b.textContent = xx("Leído", "Read"); }
      });
    }
    M.setAttribute("data-k", k);
    if (k === "priv" || k === "sign") {
      var isP = k === "priv";
      $("h3", M).textContent = isP ? xx("Aviso de Privacidad y Confidencialidad", "Privacy and Confidentiality Notice") : xx("Instrucciones para la Revisión Final y Firma", "Final Review and Signature Instructions");
      $(".rv-mbd", M).innerHTML = '<div class="ap-privtxt' + (isP ? "" : " plain") + '">' + (isP ? PRIV : SIGNTXT)[lang()].map(function (t) { return "<p>" + t + "</p>"; }).join("") + "</div>"; $(".rv-mbd", M).scrollTop = 0;
      $(".rv-mft p", M).innerHTML = '<button type="button" class="btn navy ap-privclose">' + xx("Cerrar", "Close") + "</button>";
      $("#rv-acc", M).textContent = isP ? xx("He leído el aviso", "I have read this notice") : xx("Entendido", "I understand");
      $(".ap-privclose", M).onclick = closeDoc;
      M.classList.add("on"); document.body.style.overflow = "hidden"; return;
    }
    $("h3", M).textContent = k === "fe" ? xx("Declaración de Fe", "Statement of Faith") : x(SC.DOCS[k].t);
    $(".rv-mbd", M).innerHTML = docHTML(k); $(".rv-mbd", M).scrollTop = 0;
    $(".rv-mft p", M).textContent = xx("Lea el documento completo antes de aceptar.", "Please read the full document before accepting.");
    $("#rv-acc", M).textContent = xx("He leído y acepto", "I have read and accept");
    M.classList.add("on"); document.body.style.overflow = "hidden";
  }
  function closeDoc() { var M = $("#rv-modal"); if (M) M.classList.remove("on"); document.body.style.overflow = ""; }

  /* ---------- signature ---------- */
  function sigInit() {
    $$(".rv-canvas", CUR).forEach(function (wrap) {
      var cv = $("canvas", wrap), st = cv.id === "rv-sig2" ? SIG2 : SIG, er = $('[data-errfor="' + (cv.id === "rv-sig2" ? "sig2" : "sig") + '"]', CUR);
      var ctx = cv.getContext("2d"), d = false;
      function fit() { var r = cv.getBoundingClientRect(); if (r.width < 10) return; cv.width = r.width * 2; cv.height = r.height * 2; ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0b1f4b"; st.drawn = false; $(".sp", wrap).style.opacity = 1; }
      function pt(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
      setTimeout(fit, 60);
      cv.addEventListener("pointerdown", function (e) { d = true; cv.setPointerCapture(e.pointerId); var p = pt(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]); $(".sp", wrap).style.opacity = 0; });
      cv.addEventListener("pointermove", function (e) { if (!d) return; var p = pt(e); ctx.lineTo(p[0], p[1]); ctx.stroke(); st.drawn = true; if (er) er.textContent = ""; });
      cv.addEventListener("pointerup", function () { d = false; });
      $(".rv-clear", wrap).addEventListener("click", fit);
      st.canvas = cv;
    });
  }


  /* ---------- PDF copy (pdfmake, loaded only at submit) ---------- */
  var PDFLIB = ["https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js", "https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/vfs_fonts.js"];
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function loadPdf() { if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve(); return loadScript(PDFLIB[0]).then(function () { return loadScript(PDFLIB[1]); }); }
  function toDataURL(blob) { return new Promise(function (res) { if (!blob) return res(null); var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { res(null); }; r.readAsDataURL(blob); }); }
  function txt(f) {
    var v = S[f.k], t = f.type || "text";
    if (f.future && v) return longDate(v);
    if (t === "radio" || t === "select" || t === "morphe") return optLabel(f, v);
    if (t === "checks") return (v || []).filter(function (z) { return z !== "other"; }).map(function (z) { return optLabel(f, z); }).concat((v || []).indexOf("other") >= 0 && S[f.k + "_other"] ? [S[f.k + "_other"]] : []).join(", ");
    if (t === "scale") return v + " / 5  (" + x(f.sc[0]) + " a " + x(f.sc[1]) + ")";
    if (t === "svc") return [v, S[f.k + "_2"]].filter(Boolean).join(" · ");
    if (t === "who") return v === "pair" ? xx("Matrimonio · dos credenciales", "Couple · two credentials") : xx("Individual", "Individual");
    if (t === "tier") return v === "ministro" ? xx("Ministro", "Minister") + " · $75 / " + xx("año", "year") : "Pastor · $100 / " + xx("año", "year");
    if (t === "consent") return v ? xx("Autorizado", "Authorized") : "";
    if (t === "faith") return v ? xx("Afirma la Declaración de Fe", "Affirms the Statement of Faith") : "";
    if (f.in === "date" && v) { try { var p = v.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(lang() === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return v; } }
    return String(v == null ? "" : v);
  }
  var NAVY = "#0b1f4b", GOLD = "#b8892e", GOLD2 = "#e3bf63", MUT = "#5b6577", LINE = "#e2e8f1";
  function pdfSection(sec) {
    var cells = [], wide = [], files = [], out = [];
    sec.f.forEach(function (f) {
      if (!f.k || !active(f) || f.type === "pick" || f.nr) return;
      if (f.type === "file") { files.push(x(f.l) + ": " + (FILES[f.k] ? xx("adjunto", "attached") : xx("no adjunto", "not attached"))); return; }
      if (!filled(f)) return;
      var label = f.tag ? x(f.tag) : f.type === "who" ? xx("Solicitud", "Application") : f.type === "tier" ? xx("Membresía", "Membership") : f.type === "faith" ? xx("Declaración de Fe", "Statement of Faith") : f.type === "consent" ? xx("Autorización", "Authorization") : f.type === "morphe" ? "Instituto Morphe" : x(f.l);
      if (f.sp) label = xx("Cónyuge · ", "Spouse · ") + label;
      if (f.type === "svc") label = xx("Servicio · ", "Service · ") + label;
      var cell = { stack: [{ text: label.toUpperCase(), style: "lab" }, { text: txt(f), style: "val" }], margin: [0, 2, 0, 2] };
      if (f.type === "area" || label.length > 60) wide.push(cell); else cells.push(cell);
    });
    if (sec.f.some(function (f) { return f.type === "cred"; })) {
      var cc = [{ stack: [{ text: xx("TÍTULO EN CREDENCIAL", "TITLE ON CREDENTIAL"), style: "lab" }, { text: titleLabel(), style: "val" }] }, { stack: [{ text: xx("NOMBRE EN CREDENCIAL", "NAME ON CREDENTIAL"), style: "lab" }, { text: S.cred_name || "—", style: "val" }] }];
      if (S.who === "pair") cc.push({ stack: [{ text: xx("CÓNYUGE · TÍTULO EN CREDENCIAL", "SPOUSE · TITLE ON CREDENTIAL"), style: "lab" }, { text: titleLabel("sp_"), style: "val" }] }, { stack: [{ text: xx("CÓNYUGE · NOMBRE EN CREDENCIAL", "SPOUSE · NAME ON CREDENTIAL"), style: "lab" }, { text: S.sp_cred_name || "—", style: "val" }] });
      cells = cc.concat(cells);
    }
    out.push({ columns: [{ canvas: [{ type: "rect", x: 0, y: 3, w: 6, h: 6, color: GOLD }], width: 12 }, { text: x(sec.t).toUpperCase(), style: "grp" }], margin: [0, 10, 0, 5], headlineLevel: 1 });
    if (sec.f.some(function (f) { return f.type === "pick"; }) && (S.priorities || []).length) {
      out.push({ table: { widths: ["*", "*", "*"], body: [[0, 1, 2].map(function (i) { var c = (S.priorities || [])[i]; var b = needDef(c); return c ? { text: (i + 1) + ".  " + (lang() === "es" ? b[1] : b[2]), color: "#fff", bold: true, fillColor: NAVY, margin: [8, 7, 8, 7] } : { text: "" }; })] }, layout: { hLineWidth: function () { return 0; }, vLineWidth: function () { return 3; }, vLineColor: function () { return "#fff"; } }, margin: [0, 0, 0, 6] });
    }
    var rows = [];
    for (var i = 0; i < cells.length; i += 3) rows.push([cells[i], cells[i + 1] || "", cells[i + 2] || ""]);
    wide.forEach(function (w) { rows.push([{ stack: w.stack, colSpan: 3 }, "", ""]); });
    if (rows.length) out.push({ table: { widths: ["*", "*", "*"], body: rows }, layout: { hLineColor: function () { return LINE; }, vLineColor: function () { return LINE; }, hLineWidth: function () { return 0.6; }, vLineWidth: function () { return 0.6; }, paddingLeft: function () { return 7; }, paddingRight: function () { return 7; }, paddingTop: function () { return 4; }, paddingBottom: function () { return 4; } } });
    if (files.length) out.push({ text: files.join("     "), style: "small", margin: [0, 5, 0, 0] });
    if (!rows.length && !files.length && !(sec.f.some(function (f) { return f.type === "pick"; }) && (S.priorities || []).length)) return [];
    return out;
  }
  function partHead(letter, title, sub) {
    return { table: { widths: [26, "*"], body: [[{ text: letter, color: GOLD2, bold: true, fontSize: 14, alignment: "center", fillColor: NAVY, margin: [0, 5, 0, 5] }, { stack: [{ text: title, fontSize: 15, bold: true, color: NAVY }, { text: sub, fontSize: 8.5, color: MUT }], margin: [8, 1, 0, 0] }]] }, layout: "noBorders", margin: [0, 16, 0, 2] };
  }
  function docBlock(k) {
    var out = [];
    if (k === "fe") {
      out.push({ text: xx("Declaración de Fe", "Statement of Faith"), style: "h2", pageBreak: "before" });
      var src = lang() === "es" ? window.FES : window.F;
      (src || []).forEach(function (a, i) {
        var tt = (window.D && window.D[lang()] && window.D[lang()]["ft" + (i + 1)]) || "";
        out.push({ text: (i + 1) + ". " + tt, bold: true, color: NAVY, margin: [0, 8, 0, 2] });
        a[0].forEach(function (p) { out.push({ text: p, style: "doc" }); });
        out.push({ text: a[1], italics: true, color: MUT, fontSize: 8.5, margin: [0, 0, 0, 2] });
      });
      return out;
    }
    var d = SC.DOCS[k], es = lang() === "es";
    out.push({ text: x(d.t), style: "h2", pageBreak: "before" });
    out.push({ text: x(d.i), style: "doc", margin: [0, 0, 0, 6] });
    out.push({ ol: d.x.map(function (it) { var z = es ? it[0] : it[1]; return { text: [{ text: z[0] + ". ", bold: true, color: NAVY }, z[1]], style: "doc" }; }), markerColor: GOLD });
    if (d.c) out.push({ text: x(d.c), italics: true, style: "doc", margin: [0, 8, 0, 0] });
    return out;
  }
  function buildPdf(appNo, withC, img) {
    var tier = S.tier || "pastor", P = S.who === "pair", tier2 = S.sp_tier || "pastor";
    var dateS = new Date().toLocaleString(lang() === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
    function heroOf(pre, photo) {
      var name = S[pre + "cred_name"] || ((S[pre + "first_name"] || "") + " " + (S[pre + "last_name"] || "")).trim();
      return { table: { widths: [photo ? 64 : 0, "*"], body: [[photo ? { image: photo, width: 56, height: 70, margin: [4, 4, 0, 4] } : "", { stack: [{ text: titleLabel(pre).toUpperCase(), color: GOLD2, fontSize: 8, bold: true, characterSpacing: 1.2 }, { text: name, color: "#fff", fontSize: P ? 14 : 17, bold: true, margin: [0, 2, 0, 3] }, { text: [S.church, [S.city, S.state].filter(Boolean).join(", ")].filter(Boolean).join(" · "), color: "#d6e0f7", fontSize: 9 }], margin: [8, 10, 6, 6] }]] }, layout: { fillColor: function () { return "#0b2c6e"; }, hLineWidth: function () { return 0; }, vLineWidth: function () { return 0; } }, margin: [0, 0, 0, P ? 6 : 0] };
    }
    var heroLeft = P ? { stack: [heroOf("", img.photo), heroOf("sp_", img.photo2)] } : heroOf("", img.photo);
    var feeTxt = function (tr) { return (tr === "pastor" ? "Pastor" : xx("Ministro", "Minister")) + " · $" + FEES[tr] + " / " + xx("año", "year"); };
    var heroRight = { table: { widths: ["*"], body: [
      [{ stack: [{ text: P ? xx("NÚMEROS DE APLICACIÓN", "APPLICATION NUMBERS") : xx("NÚMERO DE APLICACIÓN", "APPLICATION NUMBER"), style: "lab" }, { text: appNo, fontSize: P ? 13 : 18, bold: true, color: NAVY }] }],
      [{ stack: [{ text: xx("MEMBRESÍA", "MEMBERSHIP"), style: "lab" }, { text: P ? feeTxt(tier) + "\n" + feeTxt(tier2) : feeTxt(tier), style: "val" }] }],
      [{ stack: [{ text: xx("ENVIADA", "SUBMITTED"), style: "lab" }, { text: dateS, style: "val" }] }]
    ] }, layout: { hLineColor: function () { return LINE; }, vLineColor: function () { return LINE; }, hLineWidth: function () { return 0.6; }, vLineWidth: function () { return 0.6; }, paddingLeft: function () { return 8; }, paddingTop: function () { return 4; }, paddingBottom: function () { return 4; } } };
    var content = [
      { text: withC ? xx("Copia del solicitante", "Applicant's copy") : xx("Copia de archivo de KAI", "KAI archive copy"), fontSize: 8, color: GOLD, bold: true, characterSpacing: 1.4, margin: [0, 0, 0, 6] },
      { columns: [{ width: "60%", stack: [heroLeft] }, { width: "*", stack: [heroRight] }], columnGap: 12 },
      partHead("A", xx("Solicitud de membresía", "Membership application"), xx("La revisa el Comité de Membresía", "Reviewed by the Membership Committee"))
    ];
    PARTS.a.forEach(function (s) { content = content.concat(pdfSection(s)); });
    content.push(partHead("B", xx("¿En qué podemos servirle? · Necesidades", "How can we serve you? · Needs"), xx("La revisa el liderazgo de KAI", "Reviewed by KAI's leadership")));
    PARTS.b.forEach(function (s) { content = content.concat(pdfSection(s)); });
    content.push(partHead("§", xx("Acuerdos y firma", "Agreements and signature"), xx("Aceptados y firmados electrónicamente en kaie44.org", "Accepted and signed electronically at kaie44.org")));
    var agl = [xx("Declaración de Fe de KAI", "KAI Statement of Faith"), xx("Pacto de Membresía", "Membership Covenant"), xx("Código de Ética Ministerial", "Ministerial Code of Ethics"), xx("Uso y Protección de Datos", "Data Use and Protection")];
    content.push({ ul: agl.map(function (a) { return { text: [a + "  ", { text: "— " + xx("aceptado", "accepted"), color: MUT }], fontSize: 9.5 }; }), markerColor: GOLD, margin: [0, 8, 0, 10] });
    function sigBlock(pre, sigImg) {
      return { columns: [
        { width: 240, stack: [{ text: (P ? (pre ? xx("FIRMA · CÓNYUGE", "SIGNATURE · SPOUSE") : xx("FIRMA", "SIGNATURE")) : xx("FIRMA", "SIGNATURE")), style: "lab" }, { table: { widths: [230], body: [[sigImg ? { image: sigImg, width: 220, height: 70, margin: [4, 2, 4, 2] } : { text: " ", margin: [0, 30] }]] }, layout: { hLineColor: function () { return "#c3ccdc"; }, vLineColor: function () { return "#c3ccdc"; } } }] },
        { width: "*", stack: [{ text: xx("NOMBRE COMPLETO", "FULL NAME"), style: "lab" }, { text: S[pre + "signed_name"] || "", style: "val", margin: [0, 0, 0, 8] }, { text: xx("FECHA Y HORA", "DATE AND TIME"), style: "lab" }, { text: dateS, style: "val", margin: [0, 0, 0, 8] }, { text: xx("CUOTA ANUAL", "ANNUAL FEE"), style: "lab" }, { text: "$" + FEES[S[pre + "tier"] || "pastor"] + " · " + xx("se paga una vez aprobada la aplicación", "paid once the application is approved"), style: "val" }] }
      ], columnGap: 18, margin: [0, 0, 0, P ? 12 : 0] };
    }
    content.push(sigBlock("", img.sig));
    if (P) content.push(sigBlock("sp_", img.sig2));
    content.push({ text: xx("ANEXOS · DOCUMENTOS ACEPTADOS", "APPENDIX · ACCEPTED DOCUMENTS"), style: "lab", pageBreak: "before" });
    content.push({ text: xx("Copia de los documentos que el solicitante leyó y aceptó al firmar esta aplicación.", "Copy of the documents the applicant read and accepted when signing this application."), style: "doc" });
    ["pacto", "etica", "datos", "fe"].forEach(function (k, i) { var b = docBlock(k); if (i === 0) delete b[0].pageBreak; content = content.concat(b); });
    return {
      pageSize: "LETTER", pageMargins: [42, 78, 42, 52],
      info: { title: xx("Aplicación de Membresía KAI ", "KAI Membership Application ") + appNo, author: "Kingdom Alliance International" },
      header: function () { return { margin: [42, 22, 42, 0], stack: [{ columns: [img.logo ? { image: img.logo, width: 118 } : { text: "Kingdom Alliance International", bold: true, color: NAVY }, { stack: [{ text: xx("Aplicación de Membresía", "Membership Application"), fontSize: 13, bold: true, color: NAVY, alignment: "right" }, { text: "No. " + appNo, fontSize: 9, color: GOLD, bold: true, alignment: "right" }] }] }, { canvas: [{ type: "line", x1: 0, y1: 6, x2: 528, y2: 6, lineWidth: 1.6, lineColor: GOLD2 }] }] }; },
      footer: function (cp, pc) { return { text: "Kingdom Alliance International · kaie44.org · " + xx("Aplicación", "Application") + " " + appNo + " · " + xx("Página", "Page") + " " + cp + " " + xx("de", "of") + " " + pc, alignment: "center", fontSize: 7.5, color: MUT, margin: [0, 18, 0, 0] }; },
      content: content,
      pageBreakBefore: function (n, next) { return n.headlineLevel === 1 && next.filter(function (z) { return z.startPosition && z.startPosition.top > n.startPosition.top + 30; }).length === 0; },
      styles: { lab: { fontSize: 7, bold: true, color: GOLD, characterSpacing: 0.8, margin: [0, 0, 0, 1] }, val: { fontSize: 9.5, color: "#101828" }, grp: { fontSize: 8.5, bold: true, color: NAVY, characterSpacing: 1.1 }, small: { fontSize: 8.5, color: MUT }, h2: { fontSize: 15, bold: true, color: NAVY, margin: [0, 0, 0, 8] }, doc: { fontSize: 9.5, lineHeight: 1.25, margin: [0, 0, 0, 4] } },
      defaultStyle: { fontSize: 9.5, color: "#101828" }
    };
  }
  function makePdfs(appNo) {
    var sigURL = null, sigURL2 = null; try { sigURL = SIG.canvas.toDataURL("image/png"); } catch (e) {} try { if (S.who === "pair") sigURL2 = SIG2.canvas.toDataURL("image/png"); } catch (e) {}
    function okPh(b) { return b && /jpe?g|png/.test(b.type || "") ? b : null; }
    return Promise.all([loadPdf(), toDataURL(okPh(FILES.photo)), fetch("images/logo.png").then(function (r) { return r.ok ? r.blob() : null; }).then(toDataURL).catch(function () { return null; }), toDataURL(S.who === "pair" ? okPh(FILES.sp_photo) : null)]).then(function (r) {
      var img = { photo: r[1], logo: r[2], sig: sigURL, sig2: sigURL2, photo2: r[3] };
      function blob(dd) { return new Promise(function (res) { window.pdfMake.createPdf(dd).getBlob(res); }); }
      return Promise.all([blob(buildPdf(appNo, true, img)), blob(buildPdf(appNo, false, img))]);
    });
  }

  /* ---------- submit ---------- */
  function pick(keys) { var o = {}; keys.forEach(function (k) { if (S[k] != null && S[k] !== "") o[k] = S[k]; }); return o; }
  function partData(p) {
    var o = {};
    PARTS[p].forEach(function (sec) { sec.f.forEach(function (f) { if (!f.k || f.type === "file" || f.sp || !active(f) || !filled(f)) return; o[f.k] = S[f.k]; if (f.type === "svc" && S[f.k + "_2"]) o[f.k + "_2"] = S[f.k + "_2"]; if (f.other && (S[f.k] || []).indexOf("other") >= 0) o[f.k + "_other"] = S[f.k + "_other"] || ""; }); });
    return o;
  }
  function send() {
    if (BUSY) return;
    var msg = $("#rv-msg", CUR); msg.textContent = ""; msg.className = "ap-sendmsg";
    if ($('[name="hp_field"]', CUR).value) return;
    var okA = ["fe", "pacto", "etica", "datos"].every(function (k) { return S.agree[k]; });
    var bad = false;
    $('[data-errfor="agree"]', CUR).textContent = okA ? "" : xx("Acepte los cinco acuerdos para continuar.", "Please accept all five agreements to continue.");
    if (!okA) bad = true;
    var P = S.who === "pair";
    if (!SIG.drawn) { $('[data-errfor="sig"]', CUR).textContent = xx("Firme en el recuadro.", "Please sign in the box."); bad = true; }
    var nm = $('[data-k="signed_name"]', CUR);
    if (!(S.signed_name || "").trim()) { nm.classList.add("err"); bad = true; }
    if (P) {
      if (!SIG2.drawn) { $('[data-errfor="sig2"]', CUR).textContent = xx("Su cónyuge debe firmar en el recuadro.", "Your spouse must sign in the box."); bad = true; }
      var nm2 = $('[data-k="sp_signed_name"]', CUR);
      if (!(S.sp_signed_name || "").trim()) { nm2.classList.add("err"); bad = true; }
    }
    var missA = [];
    ["a", "b"].forEach(function (pp) { PARTS[pp].forEach(function (sec) { sec.f.forEach(function (f) {
      if (f.type === "cred") { var pre = f.sp ? "sp_" : ""; if (f.sp && !P) return; if (!(S[pre + "cred_name"] || "").trim()) missA.push(pre + "cred_name"); if (!FILES[pre + "photo"]) missA.push(pre + "photo"); return; }
      if (f.req && active(f) && !filled(f)) missA.push(f.k);
    }); }); });
    var here = [];
    if (!okA) here.push(xx("Aceptar los cinco acuerdos (abra cada uno con “Leer”)", "Accept all five agreements (open each one with “Read”)"));
    if (!SIG.drawn) here.push(P ? xx("Su firma en el recuadro", "Your signature in the box") : xx("Su firma en el recuadro", "Your signature in the box"));
    if (!(S.signed_name || "").trim()) here.push(xx("Su nombre completo debajo de la firma", "Your full name below the signature"));
    if (P && !SIG2.drawn) here.push(xx("Firma de su cónyuge en el recuadro", "Your spouse's signature in the box"));
    if (P && !(S.sp_signed_name || "").trim()) here.push(xx("Nombre completo de su cónyuge debajo de su firma", "Your spouse's full name below their signature"));
    if (missA.length || here.length) {
      var n = missA.length + here.length;
      msg.innerHTML = '<p><b>' + (n === 1 ? xx("Falta 1 dato para poder enviar:", "1 item is missing before you can submit:") : xx("Faltan " + n + " datos para poder enviar:", n + " items are missing before you can submit:")) + "</b></p>" +
        (here.length ? "<ul>" + here.map(function (t) { return '<li><a href="#" data-sign="1"><b>' + esc(t) + "</b><span>" + xx("En esta página", "On this page") + "</span></a></li>"; }).join("") + "</ul>" : "") +
        (missA.length ? missList(missA, true) : "");
      msg.classList.add("err", "ap-miss", "on");
      if (missA.length) { try { sessionStorage.setItem("kai-apply-miss", JSON.stringify(missA)); } catch (e) {} }
      return;
    }
    var cl = window.supabase && window.supabase.createClient ? window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "kai-apply-auth" } }) : null;
    if (!cl) { msg.textContent = xx("No pudimos conectar. Intente de nuevo en unos minutos.", "We could not connect. Please try again in a few minutes."); msg.classList.add("err"); return; }
    BUSY = true; var btn = $("#rv-send", CUR); btn.disabled = true; btn.textContent = xx("Enviando…", "Submitting…");
    function newId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }); }
    var id = newId(), id2 = P ? newId() : null;
    var uploads = [], files = {}, files2 = {};
    function ext(b) { var n = (b.name || "").toLowerCase(); var m = n.match(/\.(jpe?g|png|webp|heic|heif|pdf)$/); if (m) return m[1]; return b.type === "application/pdf" ? "pdf" : b.type === "image/png" ? "png" : "jpg"; }
    // Cada persona sube sus archivos a su propia carpeta (su aplicación). La foto del cónyuge se guarda como "photo" en la carpeta de él o ella.
    Object.keys(FILES).forEach(function (k) {
      var b = FILES[k], isSp = k === "sp_photo"; if (isSp && !P) return;
      var own = isSp ? id2 : id, nm = isSp ? "photo" : k, path = own + "/" + nm + "." + ext(b);
      (isSp ? files2 : files)[nm] = path; uploads.push(cl.storage.from(BUCKET).upload(path, b, { contentType: b.type || "application/octet-stream", upsert: false }));
    });
    function sigUp(st, own, into) { return new Promise(function (res) { st.canvas.toBlob(function (b) { res(b); }, "image/png"); }).then(function (b) { into.signature = own + "/signature.png"; return cl.storage.from(BUCKET).upload(into.signature, b, { contentType: "image/png", upsert: false }); }); }
    uploads.push(sigUp(SIG, id, files));
    if (P) uploads.push(sigUp(SIG2, id2, files2));
    Promise.all(uploads).then(function (rs) {
      var err = rs.filter(function (r) { return r && r.error; })[0]; if (err) throw err.error;
      var a = partData("a"); a.title = S.title || "Pastor"; a.cred_name = S.cred_name;
      var b = partData("b"); b.priorities = S.priorities || [];
      var c = {};   // la Parte C (cuidado pastoral) ahora se pregunta en la entrevista
      var agr = { fe: true, pacto: true, etica: true, datos: true, privacy_notice_read: (S.agree && S.agree.priv_read) || null, signature_notice_read: (S.agree && S.agree.sign_read) || null, at: new Date().toISOString() };
      var meta = { lang: lang(), signed_name: S.signed_name, files: files, ua: navigator.userAgent, agreements: agr };
      var args = { p_id: id, p_a: a, p_b: b, p_c: c, p_meta: meta };
      if (P) {
        // Solicitud del cónyuge: los datos compartidos (iglesia, dirección, necesidades...) se copian; lo personal viene de sus propios campos.
        var a2 = JSON.parse(JSON.stringify(a));
        ["first_name", "last_name", "birth", "phone", "email", "title", "cred_name", "tier", "faith_ok", "ordained_by", "ordained_year"].forEach(function (k) { delete a2[k]; if (S["sp_" + k] != null && S["sp_" + k] !== "") a2[k] = S["sp_" + k]; });
        a2.title = S.sp_title || "Pastor";
        a.marital = a2.marital = "c"; a.couple = a2.couple = true;
        a.spouse_name = ((S.sp_first_name || "") + " " + (S.sp_last_name || "")).trim(); a.spouse_email = (S.sp_email || "").trim();
        a2.spouse_name = ((S.first_name || "") + " " + (S.last_name || "")).trim(); a2.spouse_email = (S.email || "").trim();
        ["spouse_serves", "ordained_by_primary"].forEach(function (k) { delete a[k]; delete a2[k]; });
        args.p_sp_id = id2; args.p_sp_a = a2; args.p_sp_meta = { lang: lang(), signed_name: S.sp_signed_name, files: files2, ua: navigator.userAgent, agreements: agr };
      }
      return cl.rpc("submit_application", args);
    }).then(function (r) {
      if (r.error) throw r.error;
      DONE = String(r.data || "").split("|").join(" · ");   // pareja: "2026-0011|2026-0012"
      try { var fd = new URLSearchParams({ "form-name": "application", app_no: DONE, name: ((S.first_name || "") + " " + (S.last_name || "")).trim() + (P ? " + " + ((S.sp_first_name || "") + " " + (S.sp_last_name || "")).trim() : ""), church: S.church || "", city: [S.city, S.state].filter(Boolean).join(", "), email: (S.email || "") + (P ? ", " + (S.sp_email || "") : ""), tier: (S.tier || "") + (P ? " + " + (S.sp_tier || "") : ""), language: lang() }); fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: fd.toString() }); } catch (e) {}
      btn.textContent = xx("Preparando su copia…", "Preparing your copy…");
      var pdfP = makePdfs(DONE).then(function (pd) {
        if (PDFURL) try { URL.revokeObjectURL(PDFURL); } catch (e) {}
        PDFURL = URL.createObjectURL(pd[0]);
        var ups = [cl.storage.from(BUCKET).upload(id + "/application.pdf", pd[1], { contentType: "application/pdf", upsert: false })];
        if (P) ups.push(cl.storage.from(BUCKET).upload(id2 + "/application.pdf", pd[1], { contentType: "application/pdf", upsert: false }));   // misma copia firmada en la carpeta de cada solicitud
        return Promise.all(ups);
      }).catch(function (e) { if (window.console) console.warn("KAI apply pdf:", e); });
      return Promise.race([pdfP, new Promise(function (res) { setTimeout(res, 25000); })]);
    }).then(function () {
      try { localStorage.removeItem(DRAFT); } catch (e) {}
      S = { agree: {} }; FILES = {}; PREV = {}; resetOrig(); BUSY = false; fclear();
      KGO("/apply/done");
    }).catch(function (e) {
      BUSY = false; btn.disabled = false; btn.textContent = xx("Enviar aplicación", "Submit application");
      var m = (e && (e.message || e.error_description)) || "";
      msg.textContent = /too_many/.test(m) ? xx("Ya recibimos varias aplicaciones con este correo hoy. Escríbanos a info@kaie44.org.", "We already received several applications with this email today. Please write to info@kaie44.org.") : xx("No se pudo enviar. Revise su conexión e intente de nuevo. Si el problema sigue, llame a Ismael al " + HELP_NUM + " o escríbanos a info@kaie44.org.", "Your application could not be submitted. Check your connection and try again. If the problem continues, call Ismael at " + HELP_NUM + " or write to info@kaie44.org.");
      msg.classList.add("err");
      if (window.console) console.error("KAI apply:", e);
    });
  }

  /* ---------- router ---------- */
  function screenFromHash() {
    var h = (KR() || "").replace(/^#\/?/, "");
    var m = h.match(/^apply(?:\/(a|b|c|review|done))?$/);
    if (!m) return null;
    return m[1] === "review" ? "r" : m[1] || "intro";
  }
  function render() {
    var root = $("#apx"); if (!root) return;
    var scr = screenFromHash() || "intro";
    if (scr === "c") { KGO("/apply/r", true); return; }   // la Parte C ahora se pregunta en la entrevista
    if (scr === "done" && !DONE) scr = "intro";
    var key = scr + "|" + lang();
    if (CUR && CUR.getAttribute("data-key") === key) return;
    var html = scr === "intro" ? intro() : scr === "r" ? review() : scr === "done" ? doneScreen() : partScreen(scr);
    root.innerHTML = '<div class="apx-scr" data-scr="' + scr + '" data-key="' + key + '">' + html + "</div>";
    CUR = root.firstChild; LASTLANG = lang();
    restore(CUR);
    if (scr === "r") sigInit();
    if (GOTO && (scr === "a" || scr === "b")) { var gk = GOTO; GOTO = null; setTimeout(function () { validate(scr); var w = $('[data-k="' + gk + '"]', CUR); if (w) w.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60); }
    if (!CUR.__phBound) { CUR.__phBound = true; CUR.addEventListener("click", function (e) {
      var pd = e.target.closest("[data-phdel]"); if (pd) { var kd = pd.getAttribute("data-phdel"); ORIG[kd].photo = null; setPhoto(kd, null); return; }
      var pa = e.target.closest("[data-phadj]"); if (pa) { openCrop(pa.getAttribute("data-phadj")); return; }
      if (e.target.tagName === "IMG" && (e.target.id === "ap-ph" || e.target.id === "ap-ph-sp")) openCrop(e.target.id === "ap-ph-sp" ? "sp_photo" : "photo");
    }); }
    ["priv", "sign"].forEach(function (k) { var pv = $("#ap-" + k, CUR); if (pv) { if (S.agree && S.agree[k + "_read"]) pv.classList.add("done"); pv.addEventListener("click", function () { openDoc(k); }); } });
    var rs = $("#ap-reset", CUR); if (rs) rs.addEventListener("click", function () { if (confirm(xx("¿Borrar sus respuestas guardadas y empezar de nuevo?", "Delete your saved answers and start over?"))) { S = { agree: {} }; FILES = {}; PREV = {}; resetOrig(); fclear(); try { localStorage.removeItem(DRAFT); } catch (e) {} CUR = null; render(); } });
  }
  document.addEventListener("input", function (e) { if (CUR && CUR.contains(e.target)) onInput(e); });
  document.addEventListener("change", function (e) { if (!CUR || !CUR.contains(e.target)) return; if (e.target.hasAttribute("data-file")) onFile(e); else onInput(e); });
  document.addEventListener("click", function (e) {
    if (!CUR || !CUR.contains(e.target)) return;
    var sa = e.target.closest("[data-svc-add]"); if (sa) { var wa = sa.closest(".ap-svc"); wa.classList.add("has2"); var s2 = $("select", $(".svc2", wa)); if (s2) s2.focus(); return; }
    var sr = e.target.closest("[data-svc-rm]"); if (sr) { var kr = sr.getAttribute("data-svc-rm"), wr = sr.closest(".ap-svc"); wr.classList.remove("has2"); S[kr + "_2"] = ""; var s3 = $("select", $(".svc2", wr)); if (s3) s3.value = ""; save(); return; }
    var gt = e.target.closest("[data-goto]"); if (gt) GOTO = gt.getAttribute("data-goto");
    var j = e.target.closest("[data-jump]"); if (j) { e.preventDefault(); var t = $("#" + j.getAttribute("data-jump"), CUR); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    var ml = e.target.closest("[data-miss],[data-sign]");
    if (ml && ml.getAttribute("href") === "#") {
      e.preventDefault();
      var tg = ml.hasAttribute("data-sign") ? $(".rv-sign", CUR) : $('[data-k="' + ml.getAttribute("data-miss") + '"]', CUR);
      if (tg) tg.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    var n = e.target.closest("[data-next]"); if (n && !validate(n.getAttribute("data-next"))) { e.preventDefault(); return; }
    var b = e.target.closest(".ap-pick button"); if (b) { var ord = S.priorities = S.priorities || [], i = ord.indexOf(b.dataset.b); if (i >= 0) ord.splice(i, 1); else if (ord.length < 3) ord.push(b.dataset.b); pickDraw(CUR); progress(CUR); save(); return; }
    var rd = e.target.closest(".rv-read"); if (rd) { e.preventDefault(); openDoc(rd.getAttribute("data-doc")); return; }
    if (e.target.closest("#rv-send")) { send(); return; }
  }, true);   // fase de captura: valida antes de que el enrutador del sitio cambie de página
  window.addEventListener("scroll", function () {
    if (!CUR) return; var links = $$(".ap-side a", CUR); if (!links.length) return;
    var cur = null; links.forEach(function (l) { var t = $("#" + l.getAttribute("data-jump"), CUR); if (t && t.getBoundingClientRect().top < 260) cur = l; });
    links.forEach(function (l) { l.classList.toggle("on", l === (cur || links[0])); });
  }, { passive: true });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDoc(); });

  var FREADY = fload().then(function () { if (CUR) { CUR = null; render(); } });
  window.KAIAPP = { view: function (v) { if (v === "apply") { if (LASTLANG !== lang()) CUR = null; render(); } else { closeDoc(); } } };
})();
