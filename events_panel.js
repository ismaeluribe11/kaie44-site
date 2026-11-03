/* KAI · Panel del equipo → Eventos
   #/staff/events                 lista
   #/staff/event/new              crear
   #/staff/event/ID[/tab]         detalle: regs · team · report · eval · edit
   Usa las utilidades del panel (staff.js) que recibe en "K". */
(function () {
  "use strict";
  var TZ = "America/Los_Angeles", SITE = /(^|\.)kaie44\.org$/.test(location.hostname) ? "https://www.kaie44.org" : location.origin;
  var K = null;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(x) { return K.esc(x); }
  function money(n) { n = +n || 0; return "$" + (n % 1 ? n.toFixed(2) : n.toFixed(0)); }
  function la(iso, o) { try { return new Date(iso).toLocaleString("es-US", Object.assign({ timeZone: TZ }, o)).replace(/^([^\s,]+),/, "$1"); } catch (e) { return ""; } }
  function ldate(iso) { return la(iso, { weekday: "long", day: "numeric", month: "long" }); }
  function ltime(iso) { return la(iso, { hour: "numeric", minute: "2-digit" }).replace(/\s?a\.\s?m\./, " a.m.").replace(/\s?p\.\s?m\./, " p.m."); }
  function parts(iso) { // → {date:"2026-12-06", time:"17:00"} en hora de California
    if (!iso) return { date: "", time: "" };
    var p = {}; new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + "-" + p.month + "-" + p.day, time: (p.hour === "24" ? "00" : p.hour) + ":" + p.minute };
  }
  function toIso(date, time) { // fecha y hora de California → ISO
    if (!date || !time) return "";
    var g = new Date(date + "T" + time + ":00Z");
    var off = (new Date(g.toLocaleString("en-US", { timeZone: TZ })) - new Date(g.toLocaleString("en-US", { timeZone: "UTC" }))) / 60000;
    return new Date(g.getTime() - off * 60000).toISOString();
  }
  var STATUS = { draft: ["s", "Borrador"], published: ["g", "Publicado"], closed: ["y", "Registro cerrado"], cancelled: ["r", "Cancelado"] };
  function pill(e) { var past = new Date(e.starts_at) < Date.now() - 6 * 3600e3, s = e.status === "cancelled" ? STATUS.cancelled : past && e.status !== "draft" ? ["s", "Terminado"] : STATUS[e.status] || ["s", e.status]; return '<span class="pe-pill ' + s[0] + '">' + s[1] + "</span>"; }
  function cal(iso) { return '<div class="pe-cal"><b>' + esc(la(iso, { month: "short" }).replace(".", "").toUpperCase()) + "</b><i>" + esc(la(iso, { day: "numeric" })) + "</i></div>"; }
  function initials(n) { return String(n || "").trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); }
  var EMSG = { has_regs: "Este evento ya tiene registros; no se puede eliminar. Use “Cancelar evento”.", is_cancelled: "Este evento ya está cancelado.", use_cancel: "Para cancelar un evento use el botón “Cancelar evento”.", reason_required: "Escriba el motivo de la cancelación." };
  function err(e) { var m = String((e && e.message) || ""); for (var k in EMSG) if (m.indexOf(k) >= 0) return EMSG[k]; return K.errMsg(e); }
  function copy(t, b) { try { navigator.clipboard.writeText(t); if (b) { var o = b.textContent; b.textContent = "Copiado ✓"; setTimeout(function () { b.textContent = o; }, 1500); } } catch (e) { window.prompt("Copie el enlace:", t); } }

  /* ---------- LISTA ---------- */
  function list(f) {
    f = f || "next";
    K.loading("events", "Eventos");
    K.rpc("ev_staff_list").then(function (L) {
      var now = Date.now(), up = L.filter(function (e) { return e.status !== "draft" && new Date(e.starts_at).getTime() > now - 6 * 3600e3; }).reverse(),
          past = L.filter(function (e) { return e.status !== "draft" && new Date(e.starts_at).getTime() <= now - 6 * 3600e3; }),
          drafts = L.filter(function (e) { return e.status === "draft"; });
      var nxt = up[0], reg = up.reduce(function (a, e) { return a + e.people; }, 0), gst = up.reduce(function (a, e) { return a + e.guests; }, 0);
      var pa = past.filter(function (e) { return e.people; }), avg = pa.length ? Math.round(pa.reduce(function (a, e) { return a + 100 * e.arrived / e.people; }, 0) / pa.length) : null;
      var kpi = '<div class="pe-k"><div class="nv"><small>Próximo evento</small><b>' + (nxt ? (function (d) { return d <= 0 ? "Hoy" : d === 1 ? "Mañana" : d + " días"; })(Math.round((new Date(parts(nxt.starts_at).date + "T12:00:00") - new Date(parts(new Date().toISOString()).date + "T12:00:00")) / 864e5)) : "—") + "</b><span>" + (nxt ? esc(nxt.title) : "No hay eventos próximos") + "</span></div>" +
        "<div><small>Registrados</small><b>" + reg + "</b><span>personas en " + up.length + " evento" + (up.length === 1 ? "" : "s") + "</span></div><div><small>Invitados</small><b>" + gst + "</b><span>no son miembros</span></div><div><small>Asistencia promedio</small><b>" + (avg == null ? "—" : avg + "%") + "</b><span>eventos pasados</span></div></div>";
      var show = f === "past" ? past : f === "draft" ? drafts : up, html = "", seen = {};
      function row(e) {
        var team = (e.team || []).slice(0, 5).map(function (n) { return "<span title=\"" + esc(n) + "\">" + esc(initials(n)) + "</span>"; }).join("");
        var isPast = new Date(e.starts_at).getTime() <= now - 6 * 3600e3;
        return '<a class="pe-ev" href="#/staff/event/' + e.id + '">' + cal(e.starts_at) + "<div><h4>" + esc(e.title) + "</h4><p>" + esc(ldate(e.starts_at)) + " · " + esc(ltime(e.starts_at)) + (e.venue ? " · " + esc(e.venue) : "") + "</p></div>" +
          '<div class="pe-m"><small>' + (isPast ? "Asistencia" : "Registrados") + "</small><b>" + (isPast ? e.arrived + " de " + e.people : e.people) + "</b> <span>" + (isPast ? (e.people ? "· " + Math.round(100 * e.arrived / e.people) + "%" : "") : "personas · " + e.adults + " adultos · " + e.minors + " menores") + '</span><div class="pe-pb"><i style="width:' + (isPast ? (e.people ? 100 * e.arrived / e.people : 0) : (e.capacity ? Math.min(100, 100 * e.people / e.capacity) : Math.min(100, e.people))) + '%"></i></div></div>' +
          '<div class="pe-m"><small>Equipo</small><div class="pe-team">' + (team || '<em>Sin asignar</em>') + "</div></div><div>" + pill(e) + (e.unpaid ? '<div class="pe-due">' + e.unpaid + " pago(s) pendiente(s)</div>" : "") + '</div><div class="pe-go">›</div></a>';
      }
      show.forEach(function (e) {
        if (e.series && !seen[e.series]) {
          var ss = show.filter(function (x) { return x.series === e.series; });
          if (ss.length > 1) { seen[e.series] = 1; html += '<div class="pe-grp"><span>Serie · ' + esc(e.series) + "</span><b>Total de la serie: " + ss.reduce(function (a, x) { return a + x.people; }, 0) + " registrados</b></div>" + ss.map(row).join(""); return; }
        }
        if (!e.series || !seen[e.series]) html += row(e);
      });
      var can = K.has("admin", "president");
      K.put(K.hero("events", "Panel del equipo", "Eventos") + K.body(kpi +
        '<div class="pe-bar"><div class="pe-flt">' + [["next", "Próximos", up.length], ["past", "Pasados", past.length], ["draft", "Borradores", drafts.length]].map(function (x) { return '<a href="#/staff/events/' + x[0] + '"' + (f === x[0] ? ' class="on"' : "") + ">" + x[1] + " (" + x[2] + ")</a>"; }).join("") + "</div>" +
        (can ? '<a class="btn gold pe-btn" href="#/staff/event/new">+ Nuevo evento</a>' : "") + "</div>" +
        (html || '<div class="pe-empty">' + (f === "draft" ? "No hay borradores." : f === "past" ? "Todavía no hay eventos pasados." : "No hay eventos próximos." + (can ? ' <a href="#/staff/event/new">Crear un evento</a>' : "")) + "</div>")));
    }).catch(function (e) { K.put(K.hero0("No pudimos cargar los eventos", esc(K.errMsg(e)))); });
  }

  /* ---------- DETALLE ---------- */
  var D = null;
  function detail(id, tab) {
    if (id === "new") return edit(null);
    K.loading("events", "Evento");
    K.rpc("ev_staff_get", { p_id: id }).then(function (x) {
      D = x; tab = tab || "regs";
      if (tab === "edit") return edit(x);
      var e = x.event, tabs = [["regs", "Registrados"], ["team", "Equipo y check-in"], ["report", "Reporte"], ["eval", "Evaluación"]];
      if (x.can_edit) tabs.push(["edit", "Editar evento"]);
      var head = K.hero(null, ldate(e.starts_at) + " · " + ltime(e.starts_at), e.title, null, ["#/staff/events", "Eventos"]);
      var nav = '<div class="pe-bar"><div class="pe-tabs2">' + tabs.map(function (t) { return '<a href="#/staff/event/' + e.id + "/" + t[0] + '"' + (t[0] === tab ? ' class="on"' : "") + ">" + t[1] + "</a>"; }).join("") + "</div>" +
        '<div class="pe-acts">' + pill(e) + (x.can_edit ? (x.regs ? (e.status !== "cancelled" ? ' <button class="btn sm danger" id="pe-cancel-ev">Cancelar evento</button>' : "") : ' <button class="btn sm danger" id="pe-del-ev">Eliminar</button>') : "") + ' <a class="btn sm ol" target="_blank" rel="noopener" href="' + SITE + "/#/ev/" + esc(e.slug) + (e.status === "published" ? "" : "?preview=1") + '">' + (e.status === "published" ? "Ver página ↗" : "Vista previa ↗") + "</a></div></div>";
      K.put(head + K.body(nav + '<div id="pe-tab"><p class="st-wait">Cargando…</p></div>'));
      if (e.status === "cancelled") $(".pe-bar").insertAdjacentHTML("afterend", '<div class="pe-cx"><b>Evento cancelado</b>' + (e.cancelled_at ? " el " + esc(la(e.cancelled_at, { day: "numeric", month: "long" })) : "") + (e.cancel_reason ? " · " + esc(e.cancel_reason) : "") + "</div>");
      var dl = $("#pe-del-ev"); if (dl) dl.onclick = function () { delEvent(x); };
      var cx = $("#pe-cancel-ev"); if (cx) cx.onclick = function () { cancelEvent(x); };
      ({ regs: regs, team: team, report: report, "eval": evalTab })[tab](x);
    }).catch(function (e) { K.put(K.hero0("No pudimos cargar el evento", esc(K.errMsg(e)))); });
  }
  function tabPut(h) { var t = $("#pe-tab"); if (t) t.innerHTML = h; }

  var PAY = { free: "", pending: ["r", "Pago pendiente"], claimed: ["y", "Dice que ya pagó"], paid: ["g", "Pagado"] };
  function regs(x) {
    K.rpc("ev_staff_regs", { p_id: x.event.id }).then(function (G) {
      var P = [], act = 0, ad = 0, mi = 0, mem = 0, ch = {};
      G.forEach(function (g) { (g.people || []).forEach(function (p) { if (p.status === "active" && !g.walkin) { act++; if (p.minor) mi++; else ad++; if (p.member || p.board) mem++; } }); if (g.church && !g.walkin) ch[g.church.toLowerCase().trim()] = 1; });
      var cities = {}; G.forEach(function (g) { if (g.city && !g.walkin) cities[(g.city + "," + g.state).toLowerCase()] = 1; });
      var due = G.filter(function (g) { return g.pay === "pending" || g.pay === "claimed"; });
      var k = '<div class="pe-k"><div class="nv"><small>Registrados</small><b>' + act + "</b><span>" + ad + " adultos · " + mi + " menores</span></div><div><small>Registros</small><b>" + G.filter(function (g) { return !g.walkin; }).length + "</b><span>quienes llenaron la forma</span></div>" +
        "<div><small>Miembros KAI</small><b>" + mem + "</b><span>" + (act - mem) + " invitados no miembros</span></div><div><small>Iglesias</small><b>" + Object.keys(ch).length + "</b><span>de " + Object.keys(cities).length + " ciudades</span></div></div>";
      var rows = G.map(function (g) {
        var pay = PAY[g.pay], payh = g.courtesy ? '<span class="pe-pill b">Cortesía · ' + esc(g.courtesy) + "</span>" : pay ? '<span class="pe-pill ' + pay[0] + '">' + pay[1] + (g.pay !== "paid" ? " · " + money(g.total) : g.pay_method ? " · " + ({ zelle: "Zelle", cash: "efectivo", zelle_door: "Zelle (puerta)", check: "cheque", card: "tarjeta" }[g.pay_method] || g.pay_method) : "") + "</span>" : "";
        if (g.refund === "due") payh += ' <span class="pe-pill r">Reembolso pendiente · ' + money(g.total) + "</span>" + (x.can_pay ? ' <button class="st-mini" data-refund="' + g.group + '" data-amt="' + g.total + '" data-nm="' + esc(g.by) + '">Marcar reembolsado</button>' : "");
        if (g.refund === "done") payh += ' <span class="pe-pill s">Reembolsado</span>';
        if ((g.pay === "pending" || g.pay === "claimed") && x.can_pay) payh += ' <button class="st-mini" data-pay="' + g.group + '" data-amt="' + g.total + '" data-nm="' + esc(g.by) + '">Confirmar Zelle</button>';
        return (g.people || []).map(function (p) {
          var tp = g.walkin ? '<span class="pe-pill w">Sin registro</span>' : p.board ? '<span class="pe-pill y">Board</span>' : p.member ? '<span class="pe-pill y">Miembro</span>' : '<span class="pe-pill s">Invitado</span>';
          var who = p.seq === 1 ? "<b>" + esc(p.name) + "</b><small>" + esc([g.church, g.reg_no].filter(Boolean).join(" · ")) + (g.comments ? ' · <span title="' + esc(g.comments) + '">💬 ' + esc(g.comments.slice(0, 40)) + (g.comments.length > 40 ? "…" : "") + "</span>" : "") + "</small>" : "<b>" + esc(p.name) + "</b><small>Invitado(a) de " + esc(g.by) + (p.minor ? " · menor" : "") + "</small>";
          return '<tr class="' + (p.seq > 1 ? "gs" : "") + (p.status !== "active" ? " off" : "") + '"><td>' + who + "</td><td>" + (p.seq === 1 ? esc([g.city, g.state].filter(Boolean).join(", ")) : "") + "</td><td>" + tp + "</td><td>" +
            (p.status !== "active" ? '<span class="pe-pill s">Canceló</span>' : p.email ? (p.mailed ? "✓ enviado" : "en cola") : p.minor ? "—" : "sin correo") + "</td><td>" + (p.seq === 1 ? payh : "") + '</td><td class="' + (p.in ? "ck" : "nn") + '">' + (p.in ? "✓ " + esc(ltime(p.in)) : p.status === "active" && x.can_edit ? '<button class="pe-x" data-cancel="' + p.id + '" title="Cancelar registro">Cancelar</button>' : "—") + "</td></tr>";
        }).join("");
      }).join("");
      var rd = G.filter(function (g) { return g.refund === "due"; });
      if (rd.length) k += '<div class="pe-due-box">↩️ <b>' + rd.length + "</b> reembolso(s) pendiente(s) por " + money(rd.reduce(function (a, g) { return a + (+g.total); }, 0)) + ". Devuelva el dinero por Zelle a cada persona y márquelo aquí.</div>";
      tabPut(k + (due.length && x.can_pay ? '<div class="pe-due-box">💵 <b>' + due.length + "</b> registro(s) con pago pendiente por " + money(due.reduce(function (a, g) { return a + (+g.total); }, 0)) + ". Revise que el pago llegó a la cuenta de Zelle y confírmelo aquí; la persona recibe su confirmación con los QR.</div>" : "") +
        '<div class="pe-bar"><div></div><div class="pe-acts"><a class="btn sm navy" href="#/checkin/' + esc(x.event.slug) + '">Abrir check-in</a><button class="btn sm ol" id="pe-xls">Exportar Excel</button></div></div>' +
        (G.length ? '<div class="pe-tw"><table class="pe"><tr><th>Nombre</th><th>Ciudad</th><th>Tipo</th><th>Correo</th><th>Pago</th><th>Llegó</th></tr>' + rows + "</table></div>" : '<div class="pe-empty">Todavía no hay registros.</div>'));
      $$("[data-pay]").forEach(function (b) {
        b.onclick = function () {
          var ov = K.modal("<h3>Confirmar pago por Zelle</h3><div class=\"bd\"><p><b>" + esc(b.dataset.nm) + "</b> · " + money(b.dataset.amt) + '</p><div class="st-f"><small>Número de confirmación de Zelle (opcional)</small><input class="st-in" id="zp-ref"></div><ul style="margin:14px 0"><li>Confirme que el dinero ya está en la cuenta de KAI.</li><li>La persona y sus invitados reciben su confirmación con los códigos QR.</li></ul><p class="st-msg" id="zp-m"></p><div class="ft"><button class="btn navy" data-close>Cancelar</button><button class="btn gold" id="zp-go">Sí, llegó ' + money(b.dataset.amt) + "</button></div></div>");
          $("#zp-go", ov).onclick = function () { this.disabled = true; K.rpc("ev_staff_pay_confirm", { p_group: b.dataset.pay, p_ref: $("#zp-ref", ov).value.trim() || null }).then(function () { if (window.KAIEV_KICK) KAIEV_KICK(); ov.remove(); K.toast("Pago confirmado"); regs(x); }).catch(function (e) { $("#zp-m", ov).textContent = K.errMsg(e); }); };
        };
      });
      $$("[data-refund]").forEach(function (b) {
        b.onclick = function () {
          if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = "¿Ya devolvió " + money(b.dataset.amt) + "? Confirmar"; return; }
          b.disabled = true; K.rpc("ev_staff_refund", { p_group: b.dataset.refund }).then(function () { K.toast("Reembolso registrado"); regs(x); }).catch(function (e) { K.toast(err(e), true); });
        };
      });
      $$("[data-cancel]").forEach(function (b) { b.onclick = function () { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = "¿Seguro?"; return; } b.disabled = true; K.rpc("ev_staff_cancel", { p_reg: b.dataset.cancel }).then(function () { regs(x); }).catch(function (e) { K.toast(K.errMsg(e), true); }); }; });
      var xb = $("#pe-xls"); if (xb) xb.onclick = function () { exportCsv(x.event, G); };
    }).catch(function (e) { tabPut('<p class="st-msg">' + esc(K.errMsg(e)) + "</p>"); });
  }
  function exportCsv(e, G) {
    var rows = [["Registro", "Nombre", "Tipo", "Menor", "Correo", "Teléfono", "Iglesia", "Ciudad", "Estado", "Registró", "Pago", "Total del grupo", "Cortesía", "Estado", "Llegó", "Comentarios"]];
    G.forEach(function (g) { (g.people || []).forEach(function (p) {
      rows.push([g.reg_no, p.name, g.walkin ? "Sin registro" : p.board ? "Board" : p.member ? "Miembro" : "Invitado", p.minor ? "Sí" : "", p.email || (p.seq === 1 ? g.email : "") || "", p.seq === 1 ? g.phone || "" : "", g.church || "", g.city || "", g.state || "", g.by,
        g.pay === "paid" ? "Pagado (" + (g.pay_method || "") + ")" : g.pay === "free" ? "Sin costo" : "Pendiente", p.seq === 1 ? g.total : "", g.courtesy || "", p.status === "active" ? "Activo" : "Canceló", p.in ? ltime(p.in) : "", p.seq === 1 ? g.comments || "" : ""]);
    }); });
    var csv = "﻿" + rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = (e.slug || "evento") + "-registrados.csv"; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 400);
  }

  function team(x) {
    var e = x.event, byTask = {};
    (x.staff || []).forEach(function (s) { (byTask[s.task] = byTask[s.task] || []).push(s.name); });
    var t = Object.keys(byTask).length ? Object.keys(byTask).map(function (k) { return '<div class="asg"><b>' + esc(k) + '</b><div class="chips">' + byTask[k].map(function (n) { return "<span>" + esc(n) + "</span>"; }).join("") + "</div></div>"; }).join("") : '<p class="st-muted">Nadie asignado todavía.' + (x.can_edit ? ' <a href="#/staff/event/' + e.id + '/edit">Asignar equipo</a>' : "") + "</p>";
    var link = SITE + "/#/checkin/" + e.slug;
    var ci = '<div class="pe-sec"><h3>Check-in</h3><div class="in"><p class="st-muted" style="margin:0 0 10px">El equipo entra con su login. Los voluntarios usan el enlace y el PIN; el PIN solo sirve el día del evento.</p>' +
      (e.checkin_pin ? '<div class="pin"><code>' + esc(e.checkin_pin) + "</code><p>PIN para voluntarios · " + esc(ldate(e.starts_at)) + "</p></div>" : "") +
      '<div class="pe-f"><small>Enlace del check-in</small><div class="i lk"><span>' + esc(link.replace(/^https?:\/\//, "")) + '</span><button class="st-mini" data-copy="' + esc(link) + '">Copiar</button></div></div></div></div>';
    var paidEv = (+e.price_adult || 0) > 0 || (+e.price_child || 0) > 0;
    var cty = x.courtesy ? '<div class="pe-sec"><h3>Enlaces de cortesía del Board</h3><div class="in">' + (paidEv ? '<p class="st-muted" style="margin:0 0 10px">Cada miembro del Board tiene su enlace. Quien se registre con él no paga (hasta ' + esc(e.courtesy_per_board) + " personas por enlace). Al publicar el evento se envía por correo a cada uno.</p>" : '<p class="st-muted" style="margin:0 0 10px">Este evento es gratis; los enlaces de cortesía no son necesarios.</p>') +
      '<table class="pe sm"><tr><th>Board</th><th>Usados</th><th></th></tr>' + x.courtesy.map(function (c) {
        var url = SITE + "/#/ev/" + e.slug + "?c=" + c.code;
        return "<tr><td><b>" + esc(c.name) + "</b><small>" + esc(c.email || "sin correo registrado") + "</small></td><td>" + (c.code ? c.used + " de " + c.max : "—") + "</td><td>" + (c.code ? '<button class="st-mini" data-copy="' + esc(url) + '">Copiar enlace</button>' : "") + "</td></tr>";
      }).join("") + "</table></div></div>" : "";
    tabPut('<div class="pe-two"><div><div class="pe-sec"><h3>Equipo asignado</h3><div class="in">' + t + "</div></div>" + ci + "</div><div>" + cty + "</div></div>");
    $$("[data-copy]").forEach(function (b) { b.onclick = function () { copy(b.dataset.copy, b); }; });
  }

  function bars(rows, max) { max = max || Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1])); return rows.map(function (r) { return '<div class="hb"><span>' + esc(r[0]) + '</span><i style="width:' + Math.max(2, 100 * r[1] / max) + '%"></i><em>' + esc(r[2] != null ? r[2] : r[1]) + "</em></div>"; }).join(""); }
  function report(x) {
    K.rpc("ev_report", { p_id: x.event.id }).then(function (r) {
      var exp = r.registered - r.cancelled, m = r.money || {};
      var k = '<div class="att"><div class="nv"><small>Asistencia</small><b>' + (r.pct == null ? "—" : r.pct + "%") + "</b><span>llegaron de los que no cancelaron</span></div><div><small>Registrados</small><b>" + r.registered + "</b><span>personas</span></div><div><small>Cancelaciones</small><b>" + r.cancelled + "</b><span>avisaron que no irían</span></div>" +
        "<div><small>Llegaron</small><b>" + r.arrived + "</b><span>de " + exp + " esperados</span></div><div><small>No llegaron</small><b>" + r.no_show + "</b><span>sin avisar</span></div><div><small>Sin registro</small><b>" + r.walkin + "</b><span>llegaron sin forma</span></div></div>";
      var tot = Math.max(r.registered, 1), seg = '<div class="seg"><i style="width:' + 100 * r.arrived / tot + '%;background:#1a7f4b">' + (r.arrived ? "Llegaron " + r.arrived : "") + '</i><i style="width:' + 100 * r.no_show / tot + '%;background:#c9583c">' + (r.no_show || "") + '</i><i style="width:' + 100 * r.cancelled / tot + '%;background:#9aa6bd">' + (r.cancelled || "") + '</i></div><div class="scale"><span>Llegaron</span><span>No llegaron · Cancelaron</span></div>';
      var paidEv = (+x.event.price_adult || 0) > 0 || (+x.event.price_child || 0) > 0;
      var cities = (r.cities || []).slice(0, 5).map(function (c) { return [c.city, c.n]; }), rest = (r.cities || []).slice(5).reduce(function (a, c) { return a + c.n; }, 0);
      if (rest) cities.push(["Otras (" + ((r.cities || []).length - 5) + ")", rest]);
      var fol = [];
      if (r.guests) fol.push("<b>" + r.guests + " invitado(s)</b> que no son miembros llegaron → enviarles información de membresía");
      if (r.no_show) fol.push("<b>" + r.no_show + " registrado(s)</b> no llegaron sin avisar → mensaje de “te extrañamos”");
      if (r.walkin) fol.push("<b>" + r.walkin + " persona(s)</b> llegaron sin registro → pedir sus datos para la próxima");
      if (m.pending) fol.push("<b>" + money(m.pending) + "</b> en pagos pendientes → revisar con Tesorería");
      var ser = r.series && r.series.length > 1 ? '<div class="bx"><small>Serie · ' + esc(x.event.series) + "</small>" + bars(r.series.map(function (s) { var e2 = s.registered - s.cancelled, p = e2 > 0 ? Math.round(100 * s.arrived / e2) : 0; return [s.title.replace(/^.*·\s*/, ""), p, p + "%"]; }), 100) +
        '<p class="st-muted" style="margin:10px 0 0">Total: ' + r.series.reduce(function (a, s) { return a + s.arrived; }, 0) + " de " + r.series.reduce(function (a, s) { return a + s.registered - s.cancelled; }, 0) + " esperados llegaron</p></div>" : "";
      tabPut(k + '<div class="rep"><div class="bx"><small>Asistencia total en el lugar</small><b class="big">' + r.total_on_site + ' personas</b><span class="st-muted">' + r.arrived + " registrados + " + r.walkin + " sin registro · " + r.adults_on_site + " adultos · " + r.minors_on_site + " menores</span>" + seg + "</div>" +
        '<div class="bx"><small>Quiénes vinieron</small>' + bars([["Miembros KAI y Board", r.members], ["Invitados", r.guests], ["Sin registro", r.walkin]]) + "</div>" +
        (paidEv ? '<div class="bx"><small>Pagos</small>' + bars([["Zelle", +m.zelle, money(m.zelle)], ["Tarjeta", +m.card, money(m.card)], ["En la puerta", +m.door, money(m.door)], ["Pendiente", +m.pending, money(m.pending)]]) + '<p class="st-muted" style="margin:8px 0 0">Board: ' + m.board + " sin costo · Cortesías: " + m.courtesy + "</p></div>" : '<div class="bx"><small>Costo</small><p style="margin:8px 0 0">Evento gratis.</p></div>') + "</div>" +
        '<div class="rep two"><div class="bx"><small>De dónde vinieron</small>' + (cities.length ? bars(cities) : '<p class="st-muted">Sin datos todavía.</p>') + "</div>" + (ser || '<div class="bx"><small>Seguimiento</small>' + (fol.length ? "<ul>" + fol.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>" : '<p class="st-muted">Nada pendiente.</p>') + "</div>") + "</div>" +
        (ser ? '<div class="rep two"><div class="bx"><small>Seguimiento</small>' + (fol.length ? "<ul>" + fol.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>" : '<p class="st-muted">Nada pendiente.</p>') + "</div>" + ((r.courtesy_by || []).length ? '<div class="bx"><small>Cortesías por miembro del Board</small>' + bars(r.courtesy_by.map(function (c) { return [c.name, c.n]; })) + "</div>" : "") + "</div>" : ""));
    }).catch(function (e) { tabPut('<p class="st-msg">' + esc(K.errMsg(e)) + "</p>"); });
  }

  var EQ = [["overall", "El evento en general"], ["atmos", "Atmósfera"], ["org", "Organización"], ["time", "Manejo del tiempo"], ["venue", "Lugar"], ["food", "Comida"], ["program", "Programa"], ["checkin", "Registro y check-in"], ["comms", "Comunicación previa"]];
  var MOOD = { alegre: "Alegre", interesada: "Interesada", participativa: "Participativa", conectada: "Conectada", cansada: "Cansada", distraida: "Distraída", incomoda: "Incómoda" };
  function evalTab(x) {
    K.rpc("ev_eval_results", { p_id: x.event.id }).then(function (r) {
      if (r.hidden) {
        tabPut('<div class="pe-empty">🔒 <b>' + r.n + " de " + (r.sent || 10) + "</b> respuesta(s) hasta ahora." + (r.sent ? " Los resultados se muestran cuando haya al menos 3 respuestas o al cerrar la evaluación (7 días después del evento). Así nadie puede saber quién contestó qué." : " La evaluación se envía a los 10 del Board al día siguiente del evento, a las 10:00 a.m.") + "</div>");
        return;
      }
      var A = r.answers || [], n = A.length;
      function avg(k) { var v = A.map(function (a) { return +a[k]; }).filter(Boolean); return v.length ? v.reduce(function (s, y) { return s + y; }, 0) / v.length : null; }
      function cnt(k, v) { return A.filter(function (a) { return a[k] === v; }).length; }
      var mood = {}; A.forEach(function (a) { (a.mood || []).forEach(function (m) { mood[m] = (mood[m] || 0) + 1; }); });
      var rb = EQ.map(function (q) { var v = avg(q[0]); return v == null ? "" : '<div class="rb' + (v < 3.5 ? " lo" : "") + '"><span>' + q[1] + '</span><div class="tr"><i style="width:' + (v / 5 * 100) + '%"></i></div><em>' + v.toFixed(1) + "</em></div>"; }).join("");
      function segs(k, opts) { var t = Math.max(1, opts.reduce(function (s, o) { return s + cnt(k, o[0]); }, 0)); return '<div class="seg">' + opts.map(function (o) { var c = cnt(k, o[0]); return c ? '<i style="width:' + 100 * c / t + "%;background:" + o[2] + '">' + c + "</i>" : ""; }).join("") + '</div><div class="scale">' + opts.map(function (o) { return "<span>" + o[1] + "</span>"; }).join("") + "</div>"; }
      function notes(k, l) { var v = A.map(function (a) { return a[k]; }).filter(Boolean); return v.length ? "<h6>" + l + "</h6>" + v.map(function (t) { return "<p>“" + esc(t) + "”</p>"; }).join("") : ""; }
      var ov = avg("overall");
      tabPut('<div class="att four"><div class="nv"><small>Calificación general</small><b>' + (ov ? ov.toFixed(1) : "—") + "</b><span>de 5</span></div><div><small>Respondieron</small><b>" + n + " de " + Math.max(r.sent, n) + "</b><span>Board KAI" + (r.closed ? " · cerrada" : "") + "</span></div>" +
        "<div><small>¿Lo repetirían?</small><b>" + cnt("again", "yes") + " Sí</b><span>" + cnt("again", "changes") + " con cambios · " + cnt("again", "no") + " no</span></div><div><small>Empezó a tiempo</small><b>" + cnt("start", "ontime") + " de " + n + "</b><span>" + (cnt("start", "late15") + cnt("start", "late15plus")) + " dicen que empezó tarde</span></div></div>" +
        '<div class="ed"><div class="bx"><small>Calificaciones (promedio de 1 a 5)</small>' + rb + '<p class="st-muted" style="margin:10px 0 0">En rojo: lo que salió por debajo de 3.5.</p></div><div><div class="bx"><small>¿Cómo vieron a la gente?</small><div class="tg">' +
        Object.keys(mood).sort(function (a, b) { return mood[b] - mood[a]; }).map(function (m) { return '<span class="' + (/cansada|distraida|incomoda/.test(m) ? "neg" : "") + '">' + MOOD[m] + "<b>" + mood[m] + "</b></span>"; }).join("") + "</div></div>" +
        '<div class="bx"><small>Tiempo</small><p class="st-muted" style="margin:6px 0 4px">Inicio</p>' + segs("start", [["ontime", "A tiempo", "#1a7f4b"], ["late15", "≤15 min tarde", "#d6a23a"], ["late15plus", "+15 min", "#c9583c"]]) +
        '<p class="st-muted" style="margin:14px 0 4px">Duración</p>' + segs("length", [["short", "Muy corta", "#9aa6bd"], ["ok", "Adecuada", "#1a7f4b"], ["long", "Muy larga", "#c9583c"]]) + "</div></div></div>" +
        '<div class="bx notes"><small>Notas del equipo (sin nombre, en orden aleatorio)</small>' + (notes("good", "¿Qué salió bien?") + notes("improve", "¿Qué debemos mejorar?") + notes("time_note", "¿Qué parte se alargó o se quedó corta?") + notes("ideas", "Ideas o comentarios") || '<p class="st-muted">Sin notas.</p>') + "</div>");
    }).catch(function (e) { tabPut('<p class="st-msg">' + esc(K.errMsg(e)) + "</p>"); });
  }

  /* ---------- CREAR / EDITAR ---------- */
  var TASKS = ["Coordinador(a)", "Mesa de registro", "Bienvenida", "Alabanza", "Comida"];
  function edit(x) {
    if (!K.has("admin", "president")) { K.put(K.denied()); return; }
    var load = x ? Promise.resolve(x) : K.rpc("ev_staff_options").catch(function () { return null; });
    load.then(function (y) {
      var e = (x && x.event) || { status: "draft", audience: "open", max_guests: 10, pay_zelle: true, courtesy_per_board: 4, arrive_note: "Por favor llega 15 minutos antes.", eval_enabled: true, price_adult: 0, price_child: 0 };
      var opts = (x && x.team_options) || (y && y.team_options) || [], series = (x && x.series_options) || (y && y.series_options) || [];
      var S = {}; TASKS.forEach(function (t) { S[t] = []; }); ((x && x.staff) || []).forEach(function (s) { (S[s.task] = S[s.task] || []).push(s.email); });
      var st = parts(e.starts_at), en = parts(e.ends_at), paidEv = (+e.price_adult || 0) > 0 || (+e.price_child || 0) > 0;
      function f(l, inner, cls) { return '<div class="pe-f' + (cls ? " " + cls : "") + '"><small>' + l + "</small>" + inner + "</div>"; }
      function inp(n, v, t, ph) { return '<input class="st-in" name="' + n + '" type="' + (t || "text") + '" value="' + esc(v == null ? "" : v) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + ">"; }
      function rad(n, v, o) { return '<div class="rad" data-r="' + n + '">' + o.map(function (q) { return '<button type="button" data-v="' + q[0] + '"' + (String(v) === String(q[0]) ? ' class="on"' : "") + ">" + q[1] + "</button>"; }).join("") + "</div>"; }
      var html = '<form id="pe-form" class="pe-form" novalidate><div>' +
        '<div class="pe-sec"><h3>Información del evento</h3><div class="in">' + f("Nombre del evento", inp("title", e.title, "text", "Convivio Navideño KAI · Zona San Diego")) +
        f("Serie (opcional)", '<input class="st-in" name="series" list="pe-series" value="' + esc(e.series || "") + '" placeholder="Ej. Convivio Navideño 2026"><datalist id="pe-series">' + series.filter(Boolean).map(function (s) { return '<option value="' + esc(s) + '">'; }).join("") + "</datalist>") +
        '<div class="g3">' + f("Fecha", inp("date", st.date, "date")) + f("Empieza", inp("time", st.time || "17:00", "time")) + f("Termina", inp("end", en.time, "time")) + "</div>" +
        f("Descripción", '<textarea class="st-in" name="description" rows="3">' + esc(e.description || "") + "</textarea>") +
        '<details class="pe-en"><summary>Versión en inglés (opcional)</summary>' + f("Nombre en inglés", inp("title_en", e.title_en)) + f("Descripción en inglés", '<textarea class="st-in" name="description_en" rows="3">' + esc(e.description_en || "") + "</textarea>") + "</details>" +
        f("Foto", '<div class="pe-photo" id="pe-ph" style="' + (e.photo_url ? "background-image:url(" + esc(e.photo_url) + ")" : "") + '"><div class="pe-phb"><button type="button" class="pe-phbtn" id="pe-adj"' + (e.photo_url ? "" : " hidden") + '>✥ Ajustar foto</button><label class="pe-phbtn">' + (e.photo_url ? "Cambiar foto" : "Subir foto") + '<input type="file" accept="image/*" id="pe-file" hidden></label></div></div><input type="hidden" name="photo_url" value="' + esc(e.photo_url || "") + '"><input type="hidden" name="photo_orig" value="' + esc(e.photo_orig || "") + '"><input type="hidden" name="photo_pos" value="' + esc(e.photo_pos ? JSON.stringify(e.photo_pos) : "") + '">') +
        "</div></div>" +
        '<div class="pe-sec"><h3>Lugar</h3><div class="in">' + f("Nombre del lugar", inp("venue", e.venue, "text", "Iglesia o salón")) + f("Dirección", inp("address", e.address, "text", "Calle, ciudad, estado y código postal")) +
        '<div class="pe-mapp" id="pe-map">' + (e.address ? '<iframe loading="lazy" src="https://maps.google.com/maps?q=' + encodeURIComponent(e.address) + '&output=embed"></iframe>' : "El mapa aparece al escribir la dirección") + "</div>" + f("Nota de llegada", inp("arrive_note", e.arrive_note)) + "</div></div>" +
        '<div class="pe-sec"><h3>Registro</h3><div class="in">' + f("¿Quién puede registrarse?", rad("audience", e.audience, [["open", "Abierto: miembros e invitados"], ["members", "Solo miembros"]])) +
        '<div class="g3">' + f("Registro abierto hasta", inp("reg_until", e.reg_until, "date") + '<span class="pe-hint">Incluye todo ese día. Si lo deja vacío, se cierra a la hora en que empieza el evento.</span>') + f("Cupo máximo", inp("capacity", e.capacity, "number", "Sin límite")) + f("Invitados por persona", '<select class="st-in" name="max_guests">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return "<option" + (+e.max_guests === n ? " selected" : "") + ' value="' + n + '">' + (n ? "Hasta " + n : "Sin invitados") + "</option>"; }).join("") + "</select>") + "</div>" +
        (e.status === "cancelled" ? '<div class="pe-cx" style="margin-top:12px"><b>Evento cancelado.</b> Ya no se puede volver a publicar; si se reprograma, cree un evento nuevo.</div>' : f("Estado", rad("status", e.status, [["draft", "Borrador"], ["published", "Publicado"], ["closed", "Registro cerrado"]]))) + "</div></div>" +
        '<div class="pe-sec"><h3>Costo</h3><div class="in">' + f("¿Tiene costo?", rad("paid", paidEv ? "1" : "0", [["0", "Gratis"], ["1", "Con costo"]])) +
        '<div id="pe-cost"' + (paidEv ? "" : " hidden") + '><div class="g2">' + f("Precio por adulto", inp("price_adult", paidEv ? e.price_adult : "", "number", "20")) + f("Precio por menor", inp("price_child", paidEv ? e.price_child : "", "number", "10")) + "</div>" +
        f("Formas de pago al registrarse", '<label class="pe-chk"><input type="checkbox" name="pay_zelle"' + (e.pay_zelle !== false ? " checked" : "") + "> Zelle</label><label class=\"pe-chk off\"><input type=\"checkbox\" name=\"pay_card\" disabled> Tarjeta (Stripe) · pronto</label>") +
        f("Enlace de cortesía · personas por miembro del Board", inp("courtesy_per_board", e.courtesy_per_board, "number")) +
        '<div class="note2"><b>Board KAI:</b> los 10 se registran sin costo automáticamente. <b>Pago en la puerta:</b> no se ofrece al registrarse; si alguien llega con pago pendiente, el equipo lo cobra en el check-in.</div></div></div></div>' +
        "</div><div>" +
        '<div class="pe-sec"><h3>Equipo asignado</h3><div class="in" id="pe-team"></div></div>' +
        '<div class="pe-sec"><h3>Después del evento</h3><div class="in"><label class="pe-chk"><input type="checkbox" name="eval_enabled"' + (e.eval_enabled !== false ? " checked" : "") + "> Enviar la evaluación anónima a los 10 del Board al día siguiente (10:00 a.m.)</label></div></div>" +
        '<div class="pe-sec"><h3>Correos automáticos</h3><div class="in"><div class="rem"><span>Confirmación al registrarse</span><span class="pe-pill g">Activo</span></div><div class="rem"><span>Recordatorio · 4 días antes</span><span class="pe-pill g">Activo</span></div><div class="rem"><span>Recordatorio · 2 días antes</span><span class="pe-pill g">Activo</span></div><div class="rem"><span>Recordatorio · el mismo día, 9:00 a.m.</span><span class="pe-pill g">Activo</span></div></div></div>' +
        '<p class="st-msg" id="pe-m"></p><div class="pe-save"><a class="btn navy" href="' + (x ? "#/staff/event/" + e.id : "#/staff/events") + '">Cancelar</a><button class="btn ol" type="button" id="pe-prev">Guardar y ver vista previa</button><button class="btn gold" type="submit">' + (x ? "Guardar cambios" : "Crear evento") + "</button></div></div></form>";
      K.put(K.hero(null, x ? "Editar evento" : "Eventos", x ? e.title : "Nuevo evento", null, [x ? "#/staff/event/" + e.id : "#/staff/events", x ? "Evento" : "Eventos"]) + K.body(html));
      var F = $("#pe-form"), R = { audience: e.audience, status: e.status, paid: paidEv ? "1" : "0" };
      $$("[data-r]", F).forEach(function (g) { $$("button", g).forEach(function (b) { b.onclick = function () { R[g.dataset.r] = b.dataset.v; $$("button", g).forEach(function (z) { z.classList.toggle("on", z === b); }); if (g.dataset.r === "paid") $("#pe-cost").hidden = b.dataset.v !== "1"; }; }); });
      function drawTeam() {
        $("#pe-team").innerHTML = Object.keys(S).map(function (t) {
          return '<div class="asg" data-t="' + esc(t) + '"><b>' + esc(t) + '</b><div class="chips">' + S[t].map(function (em) { var o = opts.filter(function (z) { return z.email === em; })[0]; return '<span>' + esc(o ? o.name : em) + ' <button type="button" data-rm="' + esc(em) + '" aria-label="Quitar">×</button></span>'; }).join("") +
            '<select class="pe-add"><option value="">+ Agregar</option>' + opts.filter(function (o) { return S[t].indexOf(o.email) < 0; }).map(function (o) { return '<option value="' + esc(o.email) + '">' + esc(o.name) + "</option>"; }).join("") + "</select></div></div>";
        }).join("") + '<div class="asg"><input class="st-in" id="pe-nt" placeholder="+ Otra tarea (ej. Niños, Sonido)"></div><p class="st-muted" style="margin:10px 0 0">Al publicar, cada persona recibe un correo con su asignación.</p>';
        $$("#pe-team .pe-add").forEach(function (s) { s.onchange = function () { var t = s.closest(".asg").dataset.t; if (s.value) { S[t].push(s.value); drawTeam(); } }; });
        $$("#pe-team [data-rm]").forEach(function (b) { b.onclick = function () { var t = b.closest(".asg").dataset.t; S[t] = S[t].filter(function (z) { return z !== b.dataset.rm; }); drawTeam(); }; });
        var nt = $("#pe-nt"); nt.onkeydown = function (ev) { if (ev.key === "Enter") { ev.preventDefault(); var v = nt.value.trim(); if (v && !S[v]) { S[v] = []; drawTeam(); } } };
      }
      drawTeam();
      var adr = F.elements.address, mt = null; adr.oninput = function () { clearTimeout(mt); mt = setTimeout(function () { var v = adr.value.trim(); $("#pe-map").innerHTML = v.length > 8 ? '<iframe loading="lazy" src="https://maps.google.com/maps?q=' + encodeURIComponent(v) + '&output=embed"></iframe>' : "El mapa aparece al escribir la dirección"; }, 700); };
      var PH = { orig: null };   // archivo original en memoria (para volver a ajustar sin perder calidad)
      $("#pe-file").onchange = function () {
        var file = this.files[0]; this.value = ""; if (!file) return;
        cropEvent(file, null, function (blob, pos) { PH.orig = file; uploadPhoto(blob, F, pos, file); });
      };
      $("#pe-adj").onclick = function () {
        var pos = null; try { pos = JSON.parse(F.elements.photo_pos.value || "null"); } catch (er) { pos = null; }
        var src = PH.orig ? Promise.resolve(PH.orig) : fetch(F.elements.photo_orig.value || F.elements.photo_url.value).then(function (r) { if (!r.ok) throw new Error("foto"); return r.blob(); });
        $("#pe-m").textContent = "Abriendo la foto…";
        src.then(function (file) { $("#pe-m").textContent = ""; var hasOrig = !!(PH.orig || F.elements.photo_orig.value);
          cropEvent(file, hasOrig ? pos : null, function (blob, p2) { uploadPhoto(blob, F, p2, hasOrig ? null : file); }); })
          .catch(function () { $("#pe-m").textContent = "No se pudo abrir la foto. Use “Cambiar foto” para subirla de nuevo."; });
      };
      F.onsubmit = function (ev) {
        ev.preventDefault();
        var v = function (n) { return (F.elements[n] && F.elements[n].value || "").trim(); }, m = $("#pe-m");
        if (!v("title")) return (m.textContent = "Escriba el nombre del evento.");
        if (!v("date") || !v("time")) return (m.textContent = "Escriba la fecha y la hora de inicio.");
        if (R.paid === "1" && !(+v("price_adult") > 0)) return (m.textContent = "Escriba el precio por adulto, o elija Gratis.");
        var staff = []; Object.keys(S).forEach(function (t) { S[t].forEach(function (em) { staff.push({ task: t, email: em }); }); });
        var p = { id: x ? e.id : "", title: v("title"), title_en: v("title_en"), series: v("series"), starts_at: toIso(v("date"), v("time")), ends_at: v("end") ? toIso(v("date"), v("end")) : "",
          venue: v("venue"), address: v("address"), description: v("description"), description_en: v("description_en"), photo_url: v("photo_url"), photo_orig: v("photo_orig"), photo_pos: v("photo_pos"), arrive_note: v("arrive_note"),
          audience: R.audience, status: R.status, reg_until: v("reg_until"), capacity: v("capacity"), max_guests: v("max_guests"),
          price_adult: R.paid === "1" ? v("price_adult") : "0", price_child: R.paid === "1" ? (v("price_child") || "0") : "0",
          pay_zelle: F.elements.pay_zelle.checked, pay_card: false, courtesy_per_board: v("courtesy_per_board") || "4", eval_enabled: F.elements.eval_enabled.checked, staff: staff };
        var prev = F._prev; F._prev = false;
        var changed = x && (e.status === "published" || e.status === "closed") && (x.people_active || 0) > 0 &&
          (new Date(e.starts_at).getTime() !== new Date(p.starts_at).getTime() || String(e.ends_at ? new Date(e.ends_at).getTime() : "") !== String(p.ends_at ? new Date(p.ends_at).getTime() : "") ||
           (e.venue || "") !== p.venue || (e.address || "") !== p.address);
        if (changed && F._notify == null) {
          var ovn = K.modal('<h3>¿Avisar a los registrados?</h3><div class="bd"><p style="margin:0 0 12px">Cambió la fecha, la hora o el lugar. Hay <b>' + x.people_active + " persona(s)</b> registradas.</p><ul><li>Si avisa, les llega un correo con los datos nuevos y un botón para actualizar su calendario.</li><li>Los recordatorios ya saldrán con los datos nuevos.</li></ul>" +
            '<div class="ft"><button class="btn navy" id="nt-no">Guardar sin avisar</button><button class="btn gold" id="nt-yes">Guardar y avisar</button></div></div>');
          $("#nt-yes", ovn).onclick = function () { F._notify = true; ovn.remove(); F._prev = prev; F.onsubmit({ preventDefault: function () {} }); };
          $("#nt-no", ovn).onclick = function () { F._notify = false; ovn.remove(); F._prev = prev; F.onsubmit({ preventDefault: function () {} }); };
          return;
        }
        p.notify = !!F._notify; F._notify = null;
        var win = prev ? window.open("about:blank", "_blank") : null;
        var b = $("button[type=submit]", F); b.disabled = true; m.textContent = "Guardando…";
        K.rpc("ev_staff_save", { p: p }).then(function (id) {
          if (prev) {
            return K.rpc("ev_staff_get", { p_id: id }).then(function (y) {
              var u = SITE + "/#/ev/" + y.event.slug + "?preview=1";
              if (win && !win.closed) win.location.href = u; else window.open(u, "_blank");
              K.toast("Guardado. La vista previa se abrió en otra pestaña.");
              if (!x) location.hash = "#/staff/event/" + id + "/edit"; else { b.disabled = false; m.textContent = ""; }
            });
          } if (window.KAIEV_KICK) KAIEV_KICK(); K.toast(R.status === "published" ? "Evento guardado y publicado" : "Evento guardado"); location.hash = "#/staff/event/" + id; })
          .catch(function (er) { b.disabled = false; m.textContent = err(er); if (win && !win.closed) win.close(); });
      };
      $("#pe-prev").onclick = function () { F._prev = true; setTimeout(function () { F._prev = false; }, 0); if (F.requestSubmit) F.requestSubmit(); else F.onsubmit({ preventDefault: function () {} }); };
    });
  }
  function delEvent(x) {
    var e = x.event, ov = K.modal('<h3>Eliminar evento</h3><div class="bd"><p style="margin:0 0 12px">Se eliminará <b>' + esc(e.title) + "</b> por completo, con su equipo asignado y sus enlaces de cortesía. Nadie se ha registrado todavía.</p><p class=\"st-msg\" id=\"dl-m\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>No eliminar</button><button class=\"btn danger\" id=\"dl-go\">Sí, eliminar</button></div></div>");
    var armed = false;
    $("#dl-go", ov).onclick = function () {
      var b = this; if (!armed) { armed = true; b.textContent = "Confirmar: eliminar para siempre"; return; }
      b.disabled = true; K.rpc("ev_staff_delete", { p_id: e.id }).then(function () { ov.remove(); K.toast("Evento eliminado"); location.hash = "#/staff/events"; }).catch(function (er) { b.disabled = false; $("#dl-m", ov).textContent = err(er); });
    };
  }
  function cancelEvent(x) {
    var e = x.event, ov = K.modal('<h3>Cancelar evento</h3><div class="bd"><p style="margin:0 0 12px"><b>' + esc(e.title) + "</b> tiene <b>" + (x.people_active || 0) + " persona(s)</b> registradas.</p>" +
      '<div class="st-f"><small>Motivo (se incluye en el correo a los registrados)</small><textarea class="st-in" id="cx-r" rows="3" placeholder="Ej. Por causas de fuerza mayor tuvimos que cancelar este convivio. Pronto anunciaremos la nueva fecha."></textarea></div>' +
      "<ul style=\"margin:14px 0\"><li>A cada registrado e invitado con correo le llega un aviso de cancelación.</li><li>Se detienen los recordatorios y la evaluación.</li>" + (x.paid_groups ? "<li><b>" + x.paid_groups + " registro(s) ya pagaron:</b> quedarán como “Reembolso pendiente” para Tesorería.</li>" : "") +
      "<li>El evento no se borra: queda en el panel con todos sus datos.</li></ul><p class=\"st-msg\" id=\"cx-m\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>No cancelar</button><button class=\"btn danger\" id=\"cx-go\">Cancelar evento</button></div></div>");
    var armed = false;
    $("#cx-go", ov).onclick = function () {
      var b = this, r = $("#cx-r", ov).value.trim();
      if (!r) { $("#cx-m", ov).textContent = EMSG.reason_required; return; }
      if (!armed) { armed = true; b.textContent = "Sí, cancelar y avisar a todos"; return; }
      b.disabled = true; K.rpc("ev_staff_cancel_event", { p_id: e.id, p_reason: r }).then(function (res) {
        if (window.KAIEV_KICK) KAIEV_KICK(); ov.remove(); K.toast("Evento cancelado · " + (res.emails || 0) + " aviso(s) en camino"); detail(e.id, "regs");
      }).catch(function (er) { b.disabled = false; $("#cx-m", ov).textContent = err(er); });
    };
  }
  // Sube la foto recortada; si hay un original nuevo, lo guarda también (para volver a ajustar después)
  function uploadPhoto(blob, F, pos, orig) {
    var c = K.sb(); if (!c) return; var m = $("#pe-m");
    var stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 7), name = "ev-" + stamp + ".jpg";
    m.textContent = "Subiendo foto…";
    var up = function (n, b) { return c.storage.from("event-photos").upload(n, b, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" }).then(function (r) { if (r.error) throw r.error; return c.storage.from("event-photos").getPublicUrl(n).data.publicUrl; }); };
    (orig ? shrink(orig, 2400).then(function (b) { return up("orig-" + stamp + ".jpg", b); }) : Promise.resolve(null)).then(function (ou) {
      if (ou) F.elements.photo_orig.value = ou;
      return up(name, blob);
    }).then(function (url) {
      F.elements.photo_url.value = url; F.elements.photo_pos.value = pos ? JSON.stringify(pos) : "";
      $("#pe-ph").style.backgroundImage = "url(\"" + url + "\")"; $("#pe-adj").hidden = false;
      var lb = $("#pe-ph label"); if (lb && lb.firstChild) lb.firstChild.nodeValue = "Cambiar foto";
      m.textContent = "Foto lista. Recuerde guardar el evento.";
    }).catch(function (er) { m.textContent = "No se pudo subir la foto: " + (er && er.message ? er.message : K.errMsg(er)); });
  }
  // Ajustar la foto: arrastrar para mover y deslizar para acercar/alejar (formato 16:10, como la tarjeta del evento)
  function cropEvent(file, start, done) {
    var W = 1600, H = 1000, pos = start && start.z ? { x: +start.x || 0, y: +start.y || 0, z: +start.z || 1 } : { x: 0, y: 0, z: 1 }, url = URL.createObjectURL(file), nat = { w: 1, h: 1 }, o = { ox: 0, oy: 0 };
    var ov = K.modal('<h3>Ajuste la foto del evento</h3><div class="bd"><p style="margin:0 0 12px">Arrastre la foto para moverla y use la barra para acercar o alejar.</p>' +
      '<div class="pe-crop"><img alt=""><i class="g1"></i><i class="g2"></i></div>' +
      '<div class="pe-zoom"><span>−</span><input type="range" min="1" max="3" step="0.01" value="' + pos.z + '" aria-label="Acercar o alejar"><span>+</span></div>' +
      '<div class="ft"><button class="btn navy" data-close>Cancelar</button><button class="btn gold" id="pc-ok">Usar esta foto</button></div></div>');
    var box = $(".pe-crop", ov), im = $("img", box), rg = $("input", ov);
    function draw() {
      var bw = box.clientWidth, bh = box.clientHeight, base = Math.max(bw / nat.w, bh / nat.h), sc = base * pos.z, dw = nat.w * sc, dh = nat.h * sc;
      o = { ox: (dw - bw) / 2, oy: (dh - bh) / 2 };
      im.style.width = dw + "px"; im.style.height = dh + "px"; im.style.left = (-o.ox - pos.x * o.ox) + "px"; im.style.top = (-o.oy - pos.y * o.oy) + "px";
    }
    im.onload = function () { nat = { w: im.naturalWidth, h: im.naturalHeight }; draw(); };
    im.src = url;
    var drag = null;
    box.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; try { box.setPointerCapture(e.pointerId); } catch (er) {} box.classList.add("dg"); });
    box.addEventListener("pointermove", function (e) {
      if (!drag) return;
      pos.x = o.ox > 0 ? Math.max(-1, Math.min(1, drag.px - (e.clientX - drag.x) / o.ox)) : 0;
      pos.y = o.oy > 0 ? Math.max(-1, Math.min(1, drag.py - (e.clientY - drag.y) / o.oy)) : 0; draw();
    });
    function up() { drag = null; box.classList.remove("dg"); }
    box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
    rg.addEventListener("input", function () { pos.z = +rg.value; draw(); });
    window.addEventListener("resize", draw);
    $("#pc-ok", ov).onclick = function () {
      var b = this; b.disabled = true; b.textContent = "Preparando…";
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      var base = Math.max(W / nat.w, H / nat.h), sc = base * pos.z, dw = nat.w * sc, dh = nat.h * sc, ox = (dw - W) / 2, oy = (dh - H) / 2;
      c.getContext("2d").drawImage(im, -ox - pos.x * ox, -oy - pos.y * oy, dw, dh);
      c.toBlob(function (blob) { URL.revokeObjectURL(url); window.removeEventListener("resize", draw); ov.remove(); done(blob, pos); }, "image/jpeg", 0.85);
    };
  }
  function shrink(file, max) {
    return new Promise(function (ok) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () { var s = Math.min(1, (max || 1600) / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); c.toBlob(function (b) { URL.revokeObjectURL(u); ok(b || file); }, "image/jpeg", 0.82); };
      img.onerror = function () { ok(file); }; img.src = u;
    });
  }

  window.KAIEVP = { init: function (k) { K = k; }, list: list, detail: detail };
})();
