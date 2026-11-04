/* KAI · Panel del equipo → Eventos
   #/staff/events                 lista
   #/staff/event/new              crear
   #/staff/event/ID[/tab]         detalle: regs · team · report · eval · edit
   Usa las utilidades del panel (staff.js) que recibe en "K". */
(function () {
  "use strict";
  var TZ = "America/Los_Angeles", SITE = /(^|\.)kaie44\.org$/.test(location.hostname) ? "https://www.kaie44.org" : location.origin;
  var K = null;
  function lang() { try { return window.L === "en" ? "en" : "es"; } catch (e) { return "es"; } }
  function xx(es, en) { return lang() === "es" ? es : en; }
  function ttl(e) { return lang() === "en" ? (e.title_en || e.title || "") : (e.title || e.title_en || ""); }
  /* Textos fijos (al cargar) que cambian con el idioma: se convierten en texto al usarse. */
  var LZP = { toString: function () { return xx(this.es, this.en); }, valueOf: function () { return this.toString(); } };
  ["toUpperCase", "toLowerCase", "slice", "indexOf", "replace", "split", "trim", "charAt"].forEach(function (m) { LZP[m] = function () { var s = this.toString(); return s[m].apply(s, arguments); }; });
  function LZ(es, en) { var o = Object.create(LZP); o.es = es; o.en = en; return o; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(x) { return K.esc(x); }
  function money(n) { n = +n || 0; return "$" + (n % 1 ? n.toFixed(2) : n.toFixed(0)); }
  function la(iso, o) { try { return new Date(iso).toLocaleString(lang() === "en" ? "en-US" : "es-US", Object.assign({ timeZone: TZ }, o)).replace(/^([^\s,]+),/, "$1"); } catch (e) { return ""; } }
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
  var STATUS = { draft: ["s", LZ("Borrador", "Draft")], published: ["g", LZ("Publicado", "Published")], closed: ["y", LZ("Registro cerrado", "Registration closed")], cancelled: ["r", LZ("Cancelado", "Cancelled")] };
  function pill(e) { var past = new Date(e.starts_at) < Date.now() - 6 * 3600e3, s = e.status === "cancelled" ? STATUS.cancelled : past && e.status !== "draft" ? ["s", xx("Terminado", "Finished")] : STATUS[e.status] || ["s", e.status]; return '<span class="pe-pill ' + s[0] + '">' + s[1] + "</span>"; }
  function cal(iso) { return '<div class="pe-cal"><b>' + esc(la(iso, { month: "short" }).replace(".", "").toUpperCase()) + "</b><i>" + esc(la(iso, { day: "numeric" })) + "</i></div>"; }
  function initials(n) { return String(n || "").trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); }
  var EMSG = { has_regs: LZ("Este evento ya tiene registros; no se puede eliminar. Use “Cancelar evento”.", "This event already has registrations; it can't be deleted. Use “Cancel event”."), is_cancelled: LZ("Este evento ya está cancelado.", "This event is already cancelled."), use_cancel: LZ("Para cancelar un evento use el botón “Cancelar evento”.", "To cancel an event use the “Cancel event” button."), reason_required: LZ("Escriba el motivo de la cancelación.", "Write the reason for the cancellation.") };
  function err(e) { var m = String((e && e.message) || ""); for (var k in EMSG) if (m.indexOf(k) >= 0) return EMSG[k]; return K.errMsg(e); }
  function copy(t, b) { try { navigator.clipboard.writeText(t); if (b) { var o = b.textContent; b.textContent = xx("Copiado ✓", "Copied ✓"); setTimeout(function () { b.textContent = o; }, 1500); } } catch (e) { window.prompt(xx("Copie el enlace:", "Copy the link:"), t); } }

  /* ---------- LISTA ---------- */
  function list(f) {
    f = f || "next";
    K.loading("events", xx("Eventos", "Events"));
    K.rpc("ev_staff_list").then(function (L) {
      var now = Date.now(), up = L.filter(function (e) { return e.status !== "draft" && new Date(e.starts_at).getTime() > now - 6 * 3600e3; }).reverse(),
          past = L.filter(function (e) { return e.status !== "draft" && new Date(e.starts_at).getTime() <= now - 6 * 3600e3; }),
          drafts = L.filter(function (e) { return e.status === "draft"; });
      var nxt = up[0], reg = up.reduce(function (a, e) { return a + e.people; }, 0), gst = up.reduce(function (a, e) { return a + e.guests; }, 0);
      var pa = past.filter(function (e) { return e.people; }), avg = pa.length ? Math.round(pa.reduce(function (a, e) { return a + 100 * e.arrived / e.people; }, 0) / pa.length) : null;
      var kpi = xx("<div class=\"pe-k\"><div class=\"nv\"><small>Próximo evento</small><b>", "<div class=\"pe-k\"><div class=\"nv\"><small>Next event</small><b>") + (nxt ? (function (d) { return d <= 0 ? xx("Hoy", "Today") : d === 1 ? xx("Mañana", "Tomorrow") : d + xx(" días", " days"); })(Math.round((new Date(parts(nxt.starts_at).date + "T12:00:00") - new Date(parts(new Date().toISOString()).date + "T12:00:00")) / 864e5)) : "—") + "</b><span>" + (nxt ? esc(ttl(nxt)) : xx("No hay eventos próximos", "No upcoming events")) + "</span></div>" +
        xx("<div><small>Registrados</small><b>", "<div><small>Registered</small><b>") + reg + xx("</b><span>personas en ", "</b><span>people in ") + up.length + xx(" evento", " event") + (up.length === 1 ? "" : "s") + xx("</span></div><div><small>Invitados</small><b>", "</span></div><div><small>Guests</small><b>") + gst + xx("</b><span>no son miembros</span></div><div><small>Asistencia promedio</small><b>", "</b><span>not members</span></div><div><small>Average attendance</small><b>") + (avg == null ? "—" : avg + "%") + xx("</b><span>eventos pasados</span></div></div>", "</b><span>past events</span></div></div>");
      var show = f === "past" ? past : f === "draft" ? drafts : up, html = "", seen = {};
      function row(e) {
        var team = (e.team || []).slice(0, 5).map(function (n) { return "<span title=\"" + esc(n) + "\">" + esc(initials(n)) + "</span>"; }).join("");
        var isPast = new Date(e.starts_at).getTime() <= now - 6 * 3600e3;
        var pct = isPast ? (e.people ? 100 * e.arrived / e.people : 0) : (e.capacity ? Math.min(100, 100 * e.people / e.capacity) : Math.min(100, e.people));
        var capL = isPast ? "<span><b>" + e.arrived + "</b>" + xx(" de ", " of ") + e.people + xx(" llegaron", " arrived") + "</span><span>" + (e.people ? Math.round(pct) + "%" : "") + "</span>"
          : "<span><b>" + e.people + "</b>" + xx(" registrados", " registered") + "</span><span>" + (e.capacity ? e.capacity + xx(" lugares", " spots") : e.adults + xx(" adultos · ", " adults · ") + e.minors + xx(" menores", " minors")) + "</span>";
        return '<a class="pe-card' + (e.status === "draft" ? " draft" : "") + '" href="#/staff/event/' + e.id + '"><div class="pc-ph' + (e.photo_url ? "" : " none") + '"' + (e.photo_url ? ' style="background-image:url(\'' + esc(e.photo_url) + '\')"' : "") + '><div class="pc-dt"><small>' + esc(la(e.starts_at, { month: "short" }).replace(".", "").toUpperCase()) + "</small><b>" + esc(la(e.starts_at, { day: "numeric" })) + '</b></div><div class="pc-ps">' + pill(e) + "</div></div>" +
          '<div class="pc-bd">' + (e.status === "draft" ? '<span class="pc-dr">' + xx("Borrador · todavía no es público", "Draft · not public yet") + "</span>" : "") + '<h4>' + esc(ttl(e)) + "</h4><p>" + esc(ldate(e.starts_at)) + " · " + esc(ltime(e.starts_at)) + (e.venue ? " · " + esc(e.venue) : "") + '</p><div class="pc-cap">' + capL + '</div><div class="pe-pb"><i style="width:' + pct + '%"></i></div>' +
          '<div class="pc-ft"><div class="pe-team">' + (team || "<em>" + xx("Sin equipo asignado", "No team assigned") + "</em>") + "</div>" + (e.unpaid ? '<span class="pe-due">' + e.unpaid + xx(" pago(s) pendiente(s)", " pending payment(s)") + "</span>" : "") + '<span class="pc-lk">' + xx("Abrir", "Open") + " ›</span></div></div></a>";
      }
      show.forEach(function (e) {
        if (e.series && !seen[e.series]) {
          var ss = show.filter(function (x) { return x.series === e.series; });
          if (ss.length > 1) { seen[e.series] = 1; html += xx("<div class=\"pe-grp\"><span>Serie · ", "<div class=\"pe-grp\"><span>Series · ") + esc(e.series) + xx("</span><b>Total de la serie: ", "</span><b>Series total: ") + ss.reduce(function (a, x) { return a + x.people; }, 0) + xx(" registrados</b></div>", " registered</b></div>") + ss.map(row).join(""); return; }
        }
        if (!e.series || !seen[e.series]) html += row(e);
      });
      var can = K.has("admin", "president");
      K.put(K.hero("events", xx("Panel del equipo", "Team panel"), xx("Eventos", "Events")) + K.body(kpi +
        '<div class="pe-bar"><div class="pe-flt">' + [["next", xx("Próximos", "Upcoming"), up.length], ["past", xx("Pasados", "Past"), past.length], ["draft", xx("Borradores", "Drafts"), drafts.length]].map(function (x) { return '<a href="#/staff/events/' + x[0] + '"' + (f === x[0] ? ' class="on"' : "") + ">" + x[1] + " (" + x[2] + ")</a>"; }).join("") + "</div>" +
        (can ? xx("<a class=\"btn gold pe-btn\" href=\"#/staff/event/new\">+ Nuevo evento</a>", "<a class=\"btn gold pe-btn\" href=\"#/staff/event/new\">+ New event</a>") : "") + "</div>" +
        (html ? '<div class="pe-cards">' + html + "</div>" : '<div class="pe-empty">' + (f === "draft" ? xx("No hay borradores.", "No drafts.") : f === "past" ? xx("Todavía no hay eventos pasados.", "No past events yet.") : xx("No hay eventos próximos.", "No upcoming events.") + (can ? xx(" <a href=\"#/staff/event/new\">Crear un evento</a>", " <a href=\"#/staff/event/new\">Create an event</a>") : "")) + "</div>")));
    }).catch(function (e) { K.put(K.hero0(xx("No pudimos cargar los eventos", "We couldn't load the events"), esc(K.errMsg(e)))); });
  }

  /* ---------- DETALLE ---------- */
  var D = null;
  function detail(id, tab) {
    if (id === "new") return edit(null);
    K.loading("events", xx("Evento", "Event"));
    K.rpc("ev_staff_get", { p_id: id }).then(function (x) {
      D = x; tab = tab || "regs";
      if (tab === "edit") return edit(x);
      var e = x.event, tabs = [["regs", xx("Registrados", "Registered")], ["team", xx("Equipo y check-in", "Team and check-in")], ["report", xx("Reporte", "Report")], ["eval", xx("Evaluación", "Evaluation")]];
      if (x.can_edit) tabs.push(["edit", xx("Editar evento", "Edit event")]);
      var head = K.hero(null, ldate(e.starts_at) + " · " + ltime(e.starts_at), ttl(e), null, ["#/staff/events", xx("Eventos", "Events")]);
      var nav = '<div class="pe-bar"><div class="pe-tabs2">' + tabs.map(function (t) { return '<a href="#/staff/event/' + e.id + "/" + t[0] + '"' + (t[0] === tab ? ' class="on"' : "") + ">" + t[1] + "</a>"; }).join("") + "</div>" +
        '<div class="pe-acts">' + pill(e) + (x.can_edit ? (x.regs ? (e.status !== "cancelled" ? xx(" <button class=\"btn sm danger\" id=\"pe-cancel-ev\">Cancelar evento</button>", " <button class=\"btn sm danger\" id=\"pe-cancel-ev\">Cancel event</button>") : "") : xx(" <button class=\"btn sm danger\" id=\"pe-del-ev\">Eliminar</button>", " <button class=\"btn sm danger\" id=\"pe-del-ev\">Delete</button>")) : "") + ' <a class="btn sm ol" target="_blank" rel="noopener" href="' + SITE + "/#/ev/" + esc(e.slug) + (e.status === "published" ? "" : "?preview=1") + '">' + (e.status === "published" ? xx("Ver página ↗", "View page ↗") : xx("Vista previa ↗", "Preview ↗")) + "</a></div></div>";
      K.put(head + K.body(nav + xx("<div id=\"pe-tab\"><p class=\"st-wait\">Cargando…</p></div>", "<div id=\"pe-tab\"><p class=\"st-wait\">Loading…</p></div>")));
      if (e.status === "cancelled") $(".pe-bar").insertAdjacentHTML("afterend", xx("<div class=\"pe-cx\"><b>Evento cancelado</b>", "<div class=\"pe-cx\"><b>Event cancelled</b>") + (e.cancelled_at ? xx(" el ", " on ") + esc(la(e.cancelled_at, { day: "numeric", month: "long" })) : "") + (e.cancel_reason ? " · " + esc(e.cancel_reason) : "") + "</div>");
      if (e.status === "draft" && x.can_edit) draftBox(x);
      var dl = $("#pe-del-ev"); if (dl) dl.onclick = function () { delEvent(x); };
      var cx = $("#pe-cancel-ev"); if (cx) cx.onclick = function () { cancelEvent(x); };
      ({ regs: regs, team: team, report: report, "eval": evalTab })[tab](x);
    }).catch(function (e) { K.put(K.hero0(xx("No pudimos cargar el evento", "We couldn't load the event"), esc(K.errMsg(e)))); });
  }
  function tabPut(h) { var t = $("#pe-tab"); if (t) t.innerHTML = h; }

  var PAY = { free: "", pending: ["r", LZ("Pago pendiente", "Payment pending")], claimed: ["y", LZ("Dice que ya pagó", "Says they already paid")], paid: ["g", LZ("Pagado", "Paid")] };
  function regs(x) {
    K.rpc("ev_staff_regs", { p_id: x.event.id }).then(function (G) {
      var P = [], act = 0, ad = 0, mi = 0, mem = 0, ch = {};
      G.forEach(function (g) { (g.people || []).forEach(function (p) { if (p.status === "active" && !g.walkin) { act++; if (p.minor) mi++; else ad++; if (p.member || p.board) mem++; } }); if (g.church && !g.walkin) ch[g.church.toLowerCase().trim()] = 1; });
      var cities = {}; G.forEach(function (g) { if (g.city && !g.walkin) cities[(g.city + "," + g.state).toLowerCase()] = 1; });
      var due = G.filter(function (g) { return g.pay === "pending" || g.pay === "claimed"; });
      var k = xx("<div class=\"pe-k\"><div class=\"nv\"><small>Registrados</small><b>", "<div class=\"pe-k\"><div class=\"nv\"><small>Registered</small><b>") + act + "</b><span>" + ad + xx(" adultos · ", " adults · ") + mi + xx(" menores</span></div><div><small>Registros</small><b>", " minors</span></div><div><small>Registrations</small><b>") + G.filter(function (g) { return !g.walkin; }).length + xx("</b><span>quienes llenaron la forma</span></div>", "</b><span>people who filled out the form</span></div>") +
        xx("<div><small>Miembros KAI</small><b>", "<div><small>KAI members</small><b>") + mem + "</b><span>" + (act - mem) + xx(" invitados no miembros</span></div><div><small>Iglesias</small><b>", " non-member guests</span></div><div><small>Churches</small><b>") + Object.keys(ch).length + xx("</b><span>de ", "</b><span>from ") + Object.keys(cities).length + xx(" ciudades</span></div></div>", " cities</span></div></div>");
      var rows = G.map(function (g) {
        var pay = PAY[g.pay], payh = g.courtesy ? xx("<span class=\"pe-pill b\">Cortesía · ", "<span class=\"pe-pill b\">Courtesy · ") + esc(g.courtesy) + "</span>" : pay ? '<span class="pe-pill ' + pay[0] + '">' + pay[1] + (g.pay !== "paid" ? " · " + money(g.total) : g.pay_method ? " · " + ({ zelle: "Zelle", cash: xx("efectivo", "cash"), zelle_door: xx("Zelle (puerta)", "Zelle (door)"), check: xx("cheque", "check"), card: xx("tarjeta", "card") }[g.pay_method] || g.pay_method) : "") + "</span>" : "";
        if (g.refund === "due") payh += xx(" <span class=\"pe-pill r\">Reembolso pendiente · ", " <span class=\"pe-pill r\">Refund pending · ") + money(g.total) + "</span>" + (x.can_pay ? ' <button class="st-mini" data-refund="' + g.group + '" data-amt="' + g.total + '" data-nm="' + esc(g.by) + xx("\">Marcar reembolsado</button>", "\">Mark refunded</button>") : "");
        if (g.refund === "done") payh += xx(" <span class=\"pe-pill s\">Reembolsado</span>", " <span class=\"pe-pill s\">Refunded</span>");
        if ((g.pay === "pending" || g.pay === "claimed") && x.can_pay) payh += ' <button class="st-mini" data-pay="' + g.group + '" data-amt="' + g.total + '" data-nm="' + esc(g.by) + xx("\">Confirmar Zelle</button>", "\">Confirm Zelle</button>");
        return (g.people || []).map(function (p) {
          var tp = g.walkin ? xx("<span class=\"pe-pill w\">Sin registro</span>", "<span class=\"pe-pill w\">Walk-in</span>") : p.board ? '<span class="pe-pill y">Board</span>' : p.member ? xx("<span class=\"pe-pill y\">Miembro</span>", "<span class=\"pe-pill y\">Member</span>") : xx("<span class=\"pe-pill s\">Invitado</span>", "<span class=\"pe-pill s\">Guest</span>");
          var who = p.seq === 1 ? "<b>" + esc(p.name) + "</b><small>" + esc([g.church, g.reg_no].filter(Boolean).join(" · ")) + (g.comments ? ' · <span title="' + esc(g.comments) + '">💬 ' + esc(g.comments.slice(0, 40)) + (g.comments.length > 40 ? "…" : "") + "</span>" : "") + "</small>" : "<b>" + esc(p.name) + xx("</b><small>Invitado(a) de ", "</b><small>Guest of ") + esc(g.by) + (p.minor ? xx(" · menor", " · minor") : "") + "</small>";
          return '<tr class="' + (p.seq > 1 ? "gs" : "") + (p.status !== "active" ? " off" : "") + '"><td>' + who + "</td><td>" + (p.seq === 1 ? esc([g.city, g.state].filter(Boolean).join(", ")) : "") + "</td><td>" + tp + "</td><td>" +
            (p.status !== "active" ? xx("<span class=\"pe-pill s\">Canceló</span>", "<span class=\"pe-pill s\">Cancelled</span>") : p.email ? (p.mailed ? xx("✓ enviado", "✓ sent") : xx("en cola", "queued")) : p.minor ? "—" : xx("sin correo", "no email")) + "</td><td>" + (p.seq === 1 ? payh : "") + '</td><td class="' + (p.in ? "ck" : "nn") + '">' + (p.in ? "✓ " + esc(ltime(p.in)) : p.status === "active" && x.can_edit ? '<button class="pe-x" data-cancel="' + p.id + xx("\" title=\"Cancelar registro\">Cancelar</button>", "\" title=\"Cancel registration\">Cancel</button>") : "—") + "</td></tr>";
        }).join("");
      }).join("");
      var rd = G.filter(function (g) { return g.refund === "due"; });
      if (rd.length) k += '<div class="pe-due-box">↩️ <b>' + rd.length + xx("</b> reembolso(s) pendiente(s) por ", "</b> refund(s) pending for ") + money(rd.reduce(function (a, g) { return a + (+g.total); }, 0)) + xx(". Devuelva el dinero por Zelle a cada persona y márquelo aquí.</div>", ". Return the money by Zelle to each person and mark it here.</div>");
      tabPut(k + (due.length && x.can_pay ? '<div class="pe-due-box">💵 <b>' + due.length + xx("</b> registro(s) con pago pendiente por ", "</b> registration(s) with payment pending for ") + money(due.reduce(function (a, g) { return a + (+g.total); }, 0)) + xx(". Revise que el pago llegó a la cuenta de Zelle y confírmelo aquí; la persona recibe su confirmación con los QR.</div>", ". Check that the payment arrived in the Zelle account and confirm it here; the person receives their confirmation with the QR codes.</div>") : "") +
        '<div class="pe-bar"><div></div><div class="pe-acts"><a class="btn sm navy" href="#/checkin/' + esc(x.event.slug) + xx("\">Abrir check-in</a><button class=\"btn sm ol\" id=\"pe-xls\">Exportar Excel</button></div></div>", "\">Open check-in</a><button class=\"btn sm ol\" id=\"pe-xls\">Export to Excel</button></div></div>") +
        (G.length ? xx("<div class=\"pe-tw\"><table class=\"pe\"><tr><th>Nombre</th><th>Ciudad</th><th>Tipo</th><th>Correo</th><th>Pago</th><th>Llegó</th></tr>", "<div class=\"pe-tw\"><table class=\"pe\"><tr><th>Name</th><th>City</th><th>Type</th><th>Email</th><th>Payment</th><th>Arrived</th></tr>") + rows + "</table></div>" : xx("<div class=\"pe-empty\">Todavía no hay registros.</div>", "<div class=\"pe-empty\">No registrations yet.</div>")));
      $$("[data-pay]").forEach(function (b) {
        b.onclick = function () {
          var ov = K.modal(xx("<h3>Confirmar pago por Zelle</h3><div class=\"bd\"><p><b>", "<h3>Confirm Zelle payment</h3><div class=\"bd\"><p><b>") + esc(b.dataset.nm) + "</b> · " + money(b.dataset.amt) + xx("</p><div class=\"st-f\"><small>Número de confirmación de Zelle (opcional)</small><input class=\"st-in\" id=\"zp-ref\"></div><ul style=\"margin:14px 0\"><li>Confirme que el dinero ya está en la cuenta de KAI.</li><li>La persona y sus invitados reciben su confirmación con los códigos QR.</li></ul><p class=\"st-msg\" id=\"zp-m\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>Cancelar</button><button class=\"btn gold\" id=\"zp-go\">Sí, llegó ", "</p><div class=\"st-f\"><small>Zelle confirmation number (optional)</small><input class=\"st-in\" id=\"zp-ref\"></div><ul style=\"margin:14px 0\"><li>Confirm the money is already in KAI's account.</li><li>The person and their guests receive their confirmation with the QR codes.</li></ul><p class=\"st-msg\" id=\"zp-m\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>Cancel</button><button class=\"btn gold\" id=\"zp-go\">Yes, received ") + money(b.dataset.amt) + "</button></div></div>");
          $("#zp-go", ov).onclick = function () { this.disabled = true; K.rpc("ev_staff_pay_confirm", { p_group: b.dataset.pay, p_ref: $("#zp-ref", ov).value.trim() || null }).then(function () { if (window.KAIEV_KICK) KAIEV_KICK(); ov.remove(); K.toast(xx("Pago confirmado", "Payment confirmed")); regs(x); }).catch(function (e) { $("#zp-m", ov).textContent = K.errMsg(e); }); };
        };
      });
      $$("[data-refund]").forEach(function (b) {
        b.onclick = function () {
          if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = xx("¿Ya devolvió ", "Did you already return ") + money(b.dataset.amt) + xx("? Confirmar", "? Confirm"); return; }
          b.disabled = true; K.rpc("ev_staff_refund", { p_group: b.dataset.refund }).then(function () { K.toast(xx("Reembolso registrado", "Refund recorded")); regs(x); }).catch(function (e) { K.toast(err(e), true); });
        };
      });
      $$("[data-cancel]").forEach(function (b) { b.onclick = function () { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = xx("¿Seguro?", "Are you sure?"); return; } b.disabled = true; K.rpc("ev_staff_cancel", { p_reg: b.dataset.cancel }).then(function () { regs(x); }).catch(function (e) { K.toast(K.errMsg(e), true); }); }; });
      var xb = $("#pe-xls"); if (xb) xb.onclick = function () { exportCsv(x.event, G); };
    }).catch(function (e) { tabPut('<p class="st-msg">' + esc(K.errMsg(e)) + "</p>"); });
  }
  function exportCsv(e, G) {
    var rows = [[xx("Registro", "Registration"), xx("Nombre", "Name"), xx("Tipo", "Type"), xx("Menor", "Minor"), xx("Correo", "Email"), xx("Teléfono", "Phone"), xx("Iglesia", "Church"), xx("Ciudad", "City"), xx("Estado", "State"), xx("Registró", "Registered by"), xx("Pago", "Payment"), xx("Total del grupo", "Group total"), xx("Cortesía", "Courtesy"), xx("Estado", "State"), xx("Llegó", "Arrived"), xx("Comentarios", "Comments")]];
    G.forEach(function (g) { (g.people || []).forEach(function (p) {
      rows.push([g.reg_no, p.name, g.walkin ? xx("Sin registro", "Walk-in") : p.board ? "Board" : p.member ? xx("Miembro", "Member") : xx("Invitado", "Guest"), p.minor ? xx("Sí", "Yes") : "", p.email || (p.seq === 1 ? g.email : "") || "", p.seq === 1 ? g.phone || "" : "", g.church || "", g.city || "", g.state || "", g.by,
        g.pay === "paid" ? xx("Pagado (", "Paid (") + (g.pay_method || "") + ")" : g.pay === "free" ? xx("Sin costo", "No cost") : xx("Pendiente", "Pending"), p.seq === 1 ? g.total : "", g.courtesy || "", p.status === "active" ? xx("Activo", "Active") : xx("Canceló", "Cancelled"), p.in ? ltime(p.in) : "", p.seq === 1 ? g.comments || "" : ""]);
    }); });
    var csv = "﻿" + rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = (e.slug || "evento") + "-registrados.csv"; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 400);
  }

  function team(x) {
    var e = x.event, byTask = {};
    (x.staff || []).forEach(function (s) { (byTask[s.task] = byTask[s.task] || []).push(s.name); });
    var t = Object.keys(byTask).length ? Object.keys(byTask).map(function (k) { return '<div class="asg"><b>' + esc(k) + '</b><div class="chips">' + byTask[k].map(function (n) { return "<span>" + esc(n) + "</span>"; }).join("") + "</div></div>"; }).join("") : xx("<p class=\"st-muted\">Nadie asignado todavía.", "<p class=\"st-muted\">No one assigned yet.") + (x.can_edit ? ' <a href="#/staff/event/' + e.id + xx("/edit\">Asignar equipo</a>", "/edit\">Assign team</a>") : "") + "</p>";
    var link = SITE + "/#/checkin/" + e.slug;
    var ci = xx("<div class=\"pe-sec\"><h3>Check-in</h3><div class=\"in\"><p class=\"st-muted\" style=\"margin:0 0 10px\">El equipo entra con su login. Los voluntarios usan el enlace y el PIN; el PIN solo sirve el día del evento.</p>", "<div class=\"pe-sec\"><h3>Check-in</h3><div class=\"in\"><p class=\"st-muted\" style=\"margin:0 0 10px\">The team signs in with their login. Volunteers use the link and the PIN; the PIN only works on the day of the event.</p>") +
      (e.checkin_pin ? '<div class="pin"><code>' + esc(e.checkin_pin) + xx("</code><p>PIN para voluntarios · ", "</code><p>Volunteer PIN · ") + esc(ldate(e.starts_at)) + "</p></div>" : "") +
      xx("<div class=\"pe-f\"><small>Enlace del check-in</small><div class=\"i lk\"><span>", "<div class=\"pe-f\"><small>Check-in link</small><div class=\"i lk\"><span>") + esc(link.replace(/^https?:\/\//, "")) + '</span><button class="st-mini" data-copy="' + esc(link) + '">Copiar</button></div></div></div></div>';
    var paidEv = (+e.price_adult || 0) > 0 || (+e.price_child || 0) > 0;
    var cty = x.courtesy ? xx("<div class=\"pe-sec\"><h3>Enlaces de cortesía del Board</h3><div class=\"in\">", "<div class=\"pe-sec\"><h3>Board courtesy links</h3><div class=\"in\">") + (paidEv ? xx("<p class=\"st-muted\" style=\"margin:0 0 10px\">Cada miembro del Board tiene su enlace. Quien se registre con él no paga (hasta ", "<p class=\"st-muted\" style=\"margin:0 0 10px\">Each Board member has their own link. Whoever registers with it doesn't pay (up to ") + esc(e.courtesy_per_board) + xx(" personas por enlace). Al publicar el evento se envía por correo a cada uno.</p>", " people per link). When the event is published, it is emailed to each of them.</p>") : xx("<p class=\"st-muted\" style=\"margin:0 0 10px\">Este evento es gratis; los enlaces de cortesía no son necesarios.</p>", "<p class=\"st-muted\" style=\"margin:0 0 10px\">This event is free; courtesy links aren't needed.</p>")) +
      xx("<table class=\"pe sm\"><tr><th>Board</th><th>Usados</th><th></th></tr>", "<table class=\"pe sm\"><tr><th>Board</th><th>Used</th><th></th></tr>") + x.courtesy.map(function (c) {
        var url = SITE + "/#/ev/" + e.slug + "?c=" + c.code;
        return "<tr><td><b>" + esc(c.name) + "</b><small>" + esc(c.email || xx("sin correo registrado", "no email on file")) + "</small></td><td>" + (c.code ? c.used + xx(" de ", " of ") + c.max : "—") + "</td><td>" + (c.code ? '<button class="st-mini" data-copy="' + esc(url) + xx("\">Copiar enlace</button>", "\">Copy link</button>") : "") + "</td></tr>";
      }).join("") + "</table></div></div>" : "";
    tabPut(xx("<div class=\"pe-two\"><div><div class=\"pe-sec\"><h3>Equipo asignado</h3><div class=\"in\">", "<div class=\"pe-two\"><div><div class=\"pe-sec\"><h3>Assigned team</h3><div class=\"in\">") + t + "</div></div>" + ci + "</div><div>" + cty + "</div></div>");
    $$("[data-copy]").forEach(function (b) { b.onclick = function () { copy(b.dataset.copy, b); }; });
  }

  function bars(rows, max) { max = max || Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1])); return rows.map(function (r) { return '<div class="hb"><span>' + esc(r[0]) + '</span><i style="width:' + Math.max(2, 100 * r[1] / max) + '%"></i><em>' + esc(r[2] != null ? r[2] : r[1]) + "</em></div>"; }).join(""); }
  function report(x) {
    K.rpc("ev_report", { p_id: x.event.id }).then(function (r) {
      var exp = r.registered - r.cancelled, m = r.money || {};
      var k = xx("<div class=\"att\"><div class=\"nv\"><small>Asistencia</small><b>", "<div class=\"att\"><div class=\"nv\"><small>Attendance</small><b>") + (r.pct == null ? "—" : r.pct + "%") + xx("</b><span>llegaron de los que no cancelaron</span></div><div><small>Registrados</small><b>", "</b><span>arrived of those who didn't cancel</span></div><div><small>Registered</small><b>") + r.registered + xx("</b><span>personas</span></div><div><small>Cancelaciones</small><b>", "</b><span>people</span></div><div><small>Cancellations</small><b>") + r.cancelled + xx("</b><span>avisaron que no irían</span></div>", "</b><span>said they wouldn't come</span></div>") +
        xx("<div><small>Llegaron</small><b>", "<div><small>Arrived</small><b>") + r.arrived + xx("</b><span>de ", "</b><span>of ") + exp + xx(" esperados</span></div><div><small>No llegaron</small><b>", " expected</span></div><div><small>No-shows</small><b>") + r.no_show + xx("</b><span>sin avisar</span></div><div><small>Sin registro</small><b>", "</b><span>without notice</span></div><div><small>Walk-ins</small><b>") + r.walkin + xx("</b><span>llegaron sin forma</span></div></div>", "</b><span>arrived without the form</span></div></div>");
      var tot = Math.max(r.registered, 1), seg = '<div class="seg"><i style="width:' + 100 * r.arrived / tot + '%;background:#1a7f4b">' + (r.arrived ? xx("Llegaron ", "Arrived ") + r.arrived : "") + '</i><i style="width:' + 100 * r.no_show / tot + '%;background:#c9583c">' + (r.no_show || "") + '</i><i style="width:' + 100 * r.cancelled / tot + '%;background:#9aa6bd">' + (r.cancelled || "") + xx("</i></div><div class=\"scale\"><span>Llegaron</span><span>No llegaron · Cancelaron</span></div>", "</i></div><div class=\"scale\"><span>Arrived</span><span>No-shows · Cancelled</span></div>");
      var paidEv = (+x.event.price_adult || 0) > 0 || (+x.event.price_child || 0) > 0;
      var cities = (r.cities || []).slice(0, 5).map(function (c) { return [c.city, c.n]; }), rest = (r.cities || []).slice(5).reduce(function (a, c) { return a + c.n; }, 0);
      if (rest) cities.push([xx("Otras (", "Other (") + ((r.cities || []).length - 5) + ")", rest]);
      var fol = [];
      if (r.guests) fol.push("<b>" + r.guests + xx(" invitado(s)</b> que no son miembros llegaron → enviarles información de membresía", " guest(s)</b> who aren't members came → send them membership information"));
      if (r.no_show) fol.push("<b>" + r.no_show + xx(" registrado(s)</b> no llegaron sin avisar → mensaje de “te extrañamos”", " registered</b> didn't come without notice → “we missed you” message"));
      if (r.walkin) fol.push("<b>" + r.walkin + xx(" persona(s)</b> llegaron sin registro → pedir sus datos para la próxima", " person(s)</b> came without registering → ask for their details for next time"));
      if (m.pending) fol.push("<b>" + money(m.pending) + xx("</b> en pagos pendientes → revisar con Tesorería", "</b> in pending payments → review with Treasury"));
      var ser = r.series && r.series.length > 1 ? xx("<div class=\"bx\"><small>Serie · ", "<div class=\"bx\"><small>Series · ") + esc(x.event.series) + "</small>" + bars(r.series.map(function (s) { var e2 = s.registered - s.cancelled, p = e2 > 0 ? Math.round(100 * s.arrived / e2) : 0; return [s.title.replace(/^.*·\s*/, ""), p, p + "%"]; }), 100) +
        xx("<p class=\"st-muted\" style=\"margin:10px 0 0\">Total: ", "<p class=\"st-muted\" style=\"margin:10px 0 0\">Total: ") + r.series.reduce(function (a, s) { return a + s.arrived; }, 0) + xx(" de ", " of ") + r.series.reduce(function (a, s) { return a + s.registered - s.cancelled; }, 0) + xx(" esperados llegaron</p></div>", " expected arrived</p></div>") : "";
      tabPut(k + xx("<div class=\"rep\"><div class=\"bx\"><small>Asistencia total en el lugar</small><b class=\"big\">", "<div class=\"rep\"><div class=\"bx\"><small>Total attendance at the venue</small><b class=\"big\">") + r.total_on_site + xx(' personas</b><span class="st-muted">', ' people</b><span class="st-muted">') + r.arrived + xx(" registrados + ", " registered + ") + r.walkin + xx(" sin registro · ", " walk-ins · ") + r.adults_on_site + xx(" adultos · ", " adults · ") + r.minors_on_site + xx(" menores</span>", " minors</span>") + seg + "</div>" +
        xx("<div class=\"bx\"><small>Quiénes vinieron</small>", "<div class=\"bx\"><small>Who came</small>") + bars([[xx("Miembros KAI y Board", "KAI members and Board"), r.members], [xx("Invitados", "Guests"), r.guests], [xx("Sin registro", "Walk-in"), r.walkin]]) + "</div>" +
        (paidEv ? xx("<div class=\"bx\"><small>Pagos</small>", "<div class=\"bx\"><small>Payments</small>") + bars([["Zelle", +m.zelle, money(m.zelle)], [xx("Tarjeta", "Card"), +m.card, money(m.card)], [xx("En la puerta", "At the door"), +m.door, money(m.door)], [xx("Pendiente", "Pending"), +m.pending, money(m.pending)]]) + xx("<p class=\"st-muted\" style=\"margin:8px 0 0\">Board: ", "<p class=\"st-muted\" style=\"margin:8px 0 0\">Board: ") + m.board + xx(" sin costo · Cortesías: ", " at no cost · Courtesies: ") + m.courtesy + "</p></div>" : xx("<div class=\"bx\"><small>Costo</small><p style=\"margin:8px 0 0\">Evento gratis.</p></div>", "<div class=\"bx\"><small>Cost</small><p style=\"margin:8px 0 0\">Free event.</p></div>")) + "</div>" +
        xx("<div class=\"rep two\"><div class=\"bx\"><small>De dónde vinieron</small>", "<div class=\"rep two\"><div class=\"bx\"><small>Where they came from</small>") + (cities.length ? bars(cities) : xx("<p class=\"st-muted\">Sin datos todavía.</p>", "<p class=\"st-muted\">No data yet.</p>")) + "</div>" + (ser || xx("<div class=\"bx\"><small>Seguimiento</small>", "<div class=\"bx\"><small>Follow-up</small>") + (fol.length ? "<ul>" + fol.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>" : xx("<p class=\"st-muted\">Nada pendiente.</p>", "<p class=\"st-muted\">Nothing pending.</p>")) + "</div>") + "</div>" +
        (ser ? xx("<div class=\"rep two\"><div class=\"bx\"><small>Seguimiento</small>", "<div class=\"rep two\"><div class=\"bx\"><small>Follow-up</small>") + (fol.length ? "<ul>" + fol.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>" : xx("<p class=\"st-muted\">Nada pendiente.</p>", "<p class=\"st-muted\">Nothing pending.</p>")) + "</div>" + ((r.courtesy_by || []).length ? xx("<div class=\"bx\"><small>Cortesías por miembro del Board</small>", "<div class=\"bx\"><small>Courtesies per Board member</small>") + bars(r.courtesy_by.map(function (c) { return [c.name, c.n]; })) + "</div>" : "") + "</div>" : ""));
    }).catch(function (e) { tabPut('<p class="st-msg">' + esc(K.errMsg(e)) + "</p>"); });
  }

  var EQ = [["overall", LZ("El evento en general", "The event overall")], ["atmos", LZ("Atmósfera", "Atmosphere")], ["org", LZ("Organización", "Organization")], ["time", LZ("Manejo del tiempo", "Time management")], ["venue", LZ("Lugar", "Venue")], ["food", LZ("Comida", "Food")], ["program", LZ("Programa", "Program")], ["checkin", LZ("Registro y check-in", "Registration and check-in")], ["comms", LZ("Comunicación previa", "Prior communication")]];
  var MOOD = { alegre: LZ("Alegre", "Joyful"), interesada: LZ("Interesada", "Interested"), participativa: LZ("Participativa", "Engaged"), conectada: LZ("Conectada", "Connected"), cansada: LZ("Cansada", "Tired"), distraida: LZ("Distraída", "Distracted"), incomoda: LZ("Incómoda", "Uncomfortable") };
  function evalTab(x) {
    K.rpc("ev_eval_results", { p_id: x.event.id }).then(function (r) {
      if (r.hidden) {
        tabPut('<div class="pe-empty">🔒 <b>' + r.n + xx(" de ", " of ") + (r.sent || 10) + xx("</b> respuesta(s) hasta ahora.", "</b> response(s) so far.") + (r.sent ? xx(" Los resultados se muestran cuando haya al menos 3 respuestas o al cerrar la evaluación (7 días después del evento). Así nadie puede saber quién contestó qué.", " Results are shown once there are at least 3 responses or when the evaluation closes (7 days after the event). That way no one can tell who answered what.") : xx(" La evaluación se envía a los 10 del Board al día siguiente del evento, a las 10:00 a.m.", " The evaluation is sent to the 10 Board members the day after the event, at 10:00 a.m.")) + "</div>");
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
      tabPut(xx("<div class=\"att four\"><div class=\"nv\"><small>Calificación general</small><b>", "<div class=\"att four\"><div class=\"nv\"><small>Overall rating</small><b>") + (ov ? ov.toFixed(1) : "—") + xx("</b><span>de 5</span></div><div><small>Respondieron</small><b>", "</b><span>out of 5</span></div><div><small>Responded</small><b>") + n + xx(" de ", " of ") + Math.max(r.sent, n) + xx("</b><span>Board KAI", "</b><span>KAI Board") + (r.closed ? xx(" · cerrada", " · closed") : "") + "</span></div>" +
        xx("<div><small>¿Lo repetirían?</small><b>", "<div><small>Would they repeat it?</small><b>") + cnt("again", "yes") + xx(" Sí</b><span>", " Yes</b><span>") + cnt("again", "changes") + xx(" con cambios · ", " with changes · ") + cnt("again", "no") + xx(" no</span></div><div><small>Empezó a tiempo</small><b>", " no</span></div><div><small>Started on time</small><b>") + cnt("start", "ontime") + xx(" de ", " of ") + n + "</b><span>" + (cnt("start", "late15") + cnt("start", "late15plus")) + xx(" dicen que empezó tarde</span></div></div>", " say it started late</span></div></div>") +
        xx("<div class=\"ed\"><div class=\"bx\"><small>Calificaciones (promedio de 1 a 5)</small>", "<div class=\"ed\"><div class=\"bx\"><small>Ratings (average from 1 to 5)</small>") + rb + xx("<p class=\"st-muted\" style=\"margin:10px 0 0\">En rojo: lo que salió por debajo de 3.5.</p></div><div><div class=\"bx\"><small>¿Cómo vieron a la gente?</small><div class=\"tg\">", "<p class=\"st-muted\" style=\"margin:10px 0 0\">In red: anything below 3.5.</p></div><div><div class=\"bx\"><small>How did people seem?</small><div class=\"tg\">") +
        Object.keys(mood).sort(function (a, b) { return mood[b] - mood[a]; }).map(function (m) { return '<span class="' + (/cansada|distraida|incomoda/.test(m) ? "neg" : "") + '">' + MOOD[m] + "<b>" + mood[m] + "</b></span>"; }).join("") + "</div></div>" +
        xx("<div class=\"bx\"><small>Tiempo</small><p class=\"st-muted\" style=\"margin:6px 0 4px\">Inicio</p>", "<div class=\"bx\"><small>Time</small><p class=\"st-muted\" style=\"margin:6px 0 4px\">Start</p>") + segs("start", [["ontime", xx("A tiempo", "On time"), "#1a7f4b"], ["late15", xx("≤15 min tarde", "≤15 min late"), "#d6a23a"], ["late15plus", "+15 min", "#c9583c"]]) +
        xx("<p class=\"st-muted\" style=\"margin:14px 0 4px\">Duración</p>", "<p class=\"st-muted\" style=\"margin:14px 0 4px\">Length</p>") + segs("length", [["short", xx("Muy corta", "Too short"), "#9aa6bd"], ["ok", xx("Adecuada", "Just right"), "#1a7f4b"], ["long", xx("Muy larga", "Too long"), "#c9583c"]]) + "</div></div></div>" +
        xx("<div class=\"bx notes\"><small>Notas del equipo (sin nombre, en orden aleatorio)</small>", "<div class=\"bx notes\"><small>Team notes (no names, in random order)</small>") + (notes("good", xx("¿Qué salió bien?", "What went well?")) + notes("improve", xx("¿Qué debemos mejorar?", "What should we improve?")) + notes("time_note", xx("¿Qué parte se alargó o se quedó corta?", "Which part ran long or short?")) + notes("ideas", xx("Ideas o comentarios", "Ideas or comments")) || xx("<p class=\"st-muted\">Sin notas.</p>", "<p class=\"st-muted\">No notes.</p>")) + "</div>");
    }).catch(function (e) { tabPut('<p class="st-msg">' + esc(K.errMsg(e)) + "</p>"); });
  }

  /* ---------- CREAR / EDITAR ---------- */
  var TASKS = ["Coordinador(a)", "Mesa de registro", "Bienvenida", "Alabanza", "Comida"];
  var TASK_EN = { "Coordinador(a)": "Coordinator", "Mesa de registro": "Registration desk", "Bienvenida": "Welcome", "Alabanza": "Worship", "Comida": "Food" };
  function taskName(t) { return lang() === "en" ? (TASK_EN[t] || t) : t; }
  function edit(x) {
    if (!K.has("admin", "president")) { K.put(K.denied()); return; }
    var load = x ? Promise.resolve(x) : K.rpc("ev_staff_options").catch(function () { return null; });
    load.then(function (y) {
      var e = (x && x.event) || { status: "draft", audience: "open", max_guests: 10, pay_zelle: true, courtesy_per_board: 4, arrive_note: "Por favor llega 15 minutos antes.", arrive_note_en: "Please arrive 15 minutes early.", eval_enabled: true, price_adult: 0, price_child: 0 };
      var opts = (x && x.team_options) || (y && y.team_options) || [], series = (x && x.series_options) || (y && y.series_options) || [];
      var S = {}; TASKS.forEach(function (t) { S[t] = []; }); ((x && x.staff) || []).forEach(function (s) { (S[s.task] = S[s.task] || []).push(s.email); });
      var st = parts(e.starts_at), en = parts(e.ends_at), paidEv = (+e.price_adult || 0) > 0 || (+e.price_child || 0) > 0;
      function f(l, inner, cls) { return '<div class="pe-f' + (cls ? " " + cls : "") + '"><small>' + l + "</small>" + inner + "</div>"; }
      function inp(n, v, t, ph) { return '<input class="st-in" name="' + n + '" type="' + (t || "text") + '" value="' + esc(v == null ? "" : v) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + ">"; }
      function pair(l, a, b) { return '<div class="pe-pair"><div class="pe-pl">' + l + '</div><div class="g2">' + f(xx("<span class=\"pe-lg\">EN</span> Inglés", "<span class=\"pe-lg\">EN</span> English"), a) + f(xx("<span class=\"pe-lg\">ES</span> Español", "<span class=\"pe-lg\">ES</span> Spanish"), b) + '</div></div>'; }
      function ta(n, v) { return '<textarea class="st-in" name="' + n + '" rows="3">' + esc(v || "") + "</textarea>"; }
      function rad(n, v, o) { return '<div class="rad" data-r="' + n + '">' + o.map(function (q) { return '<button type="button" data-v="' + q[0] + '"' + (String(v) === String(q[0]) ? ' class="on"' : "") + ">" + q[1] + "</button>"; }).join("") + "</div>"; }
      var html = '<form id="pe-form" class="pe-form" novalidate><div>' +
        xx("<div class=\"pe-note-lang\">La página pública tiene el botón <b>English / Español</b>. Llene los dos idiomas para que todo cambie cuando los visitantes cambien de idioma. Si una caja en español o en inglés queda vacía, se muestra el otro idioma.</div>", "<div class=\"pe-note-lang\">The public page has an <b>English / Español</b> switch. Fill in both languages so everything changes when visitors switch. If a Spanish or English box is left empty, the other language is shown instead.</div>") +
        xx("<div class=\"pe-sec\"><h3>Datos del evento</h3><div class=\"in\">", "<div class=\"pe-sec\"><h3>Event details</h3><div class=\"in\">") +
        pair(xx("Título del evento *", "Event title *"), inp("title_en", e.title_en, "text", "KAI Christmas Gathering · San Diego"), inp("title", e.title, "text", "Convivio Navideño KAI · Zona San Diego")) +
        f(xx("Serie (opcional)", "Series (optional)"), '<input class="st-in" name="series" list="pe-series" value="' + esc(e.series || "") + xx("\" placeholder=\"Ej. Convivio Navideño 2026\"><datalist id=\"pe-series\">", "\" placeholder=\"e.g. Convivio Navideño 2026\"><datalist id=\"pe-series\">") + series.filter(Boolean).map(function (s) { return '<option value="' + esc(s) + '">'; }).join("") + "</datalist>" + xx("<span class=\"pe-hint\">Agrupa eventos relacionados (por ejemplo, el mismo evento en dos zonas) para comparar sus reportes. Solo la ve el equipo.</span>", "<span class=\"pe-hint\">Groups related events (for example, the same event in two locations) so their reports can be compared. Only the team sees it.</span>")) +
        '<div class="g3">' + f(xx("Fecha *", "Date *"), inp("date", st.date, "date")) + f(xx("Empieza *", "Starts *"), inp("time", st.time || "17:00", "time")) + f(xx("Termina", "Ends"), inp("end", en.time, "time")) + "</div>" +
        pair(xx("Descripción", "Description"), ta("description_en", e.description_en), ta("description", e.description)) +
        f(xx("Foto", "Photo"), '<div class="pe-photo" id="pe-ph" style="' + (e.photo_url ? "background-image:url(" + esc(e.photo_url) + ")" : "") + '"><div class="pe-phb"><button type="button" class="pe-phbtn" id="pe-adj"' + (e.photo_url ? "" : " hidden") + xx(">✥ Ajustar foto</button><label class=\"pe-phbtn\">", ">✥ Adjust photo</button><label class=\"pe-phbtn\">") + (e.photo_url ? xx("Cambiar foto", "Change photo") : xx("Subir foto", "Upload photo")) + '<input type="file" accept="image/*" id="pe-file" hidden></label></div></div><input type="hidden" name="photo_url" value="' + esc(e.photo_url || "") + '"><input type="hidden" name="photo_orig" value="' + esc(e.photo_orig || "") + '"><input type="hidden" name="photo_pos" value="' + esc(e.photo_pos ? JSON.stringify(e.photo_pos) : "") + '">') +
        "</div></div>" +
        xx("<div class=\"pe-sec\"><h3>Lugar</h3><div class=\"in\">", "<div class=\"pe-sec\"><h3>Location</h3><div class=\"in\">") + f(xx("Nombre del lugar", "Venue name"), inp("venue", e.venue, "text", xx("Iglesia o salón", "Church or hall"))) + f(xx("Dirección", "Address"), inp("address", e.address, "text", xx("Calle, ciudad, estado y código postal", "Street, city, state and ZIP code"))) +
        '<div class="pe-mapp" id="pe-map">' + (e.address ? '<iframe loading="lazy" src="https://maps.google.com/maps?q=' + encodeURIComponent(e.address) + '&output=embed"></iframe>' : xx("El mapa aparece cuando escriba la dirección", "The map appears when you type the address")) + "</div>" +
        pair(xx("Nota de llegada", "Arrival note"), inp("arrive_note_en", e.arrive_note_en, "text", "Please arrive 15 minutes early."), inp("arrive_note", e.arrive_note, "text", "Por favor llega 15 minutos antes.")) + "</div></div>" +
        xx("<div class=\"pe-sec\"><h3>Registro</h3><div class=\"in\">", "<div class=\"pe-sec\"><h3>Registration</h3><div class=\"in\">") + f(xx("¿Quién se puede registrar?", "Who can register?"), rad("audience", e.audience, [["open", xx("Abierto: miembros e invitados", "Open: members and guests")], ["members", xx("Solo miembros", "Members only")]])) +
        '<div class="g3">' + f(xx("Registro abierto hasta", "Registration open until"), inp("reg_until", e.reg_until, "date") + xx("<span class=\"pe-hint\">Incluye todo ese día. Si se deja vacío, el registro se cierra cuando empieza el evento.</span>", "<span class=\"pe-hint\">Includes that whole day. If left empty, registration closes when the event starts.</span>")) + f(xx("Cupo máximo", "Maximum capacity"), inp("capacity", e.capacity, "number", xx("Sin límite", "No limit"))) + f(xx("Invitados por persona", "Guests per person"), '<select class="st-in" name="max_guests">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return "<option" + (+e.max_guests === n ? " selected" : "") + ' value="' + n + '">' + (n ? xx("Hasta ", "Up to ") + n : xx("Sin invitados", "No guests")) + "</option>"; }).join("") + "</select>") + "</div>" +
        (e.status === "cancelled" ? xx("<div class=\"pe-cx\" style=\"margin-top:12px\"><b>Evento cancelado.</b> Ya no se puede volver a publicar; si se reprograma, cree un evento nuevo.</div>", "<div class=\"pe-cx\" style=\"margin-top:12px\"><b>Event cancelled.</b> It can no longer be published again; if it is rescheduled, create a new event.</div>") : f(xx("Estado", "Status"), rad("status", e.status, [["draft", xx("Borrador", "Draft")], ["published", xx("Publicado", "Published")], ["closed", xx("Registro cerrado", "Registration closed")]]) + xx("<span class=\"pe-hint\">Borrador: solo lo ve el equipo (use la vista previa). Publicado: aparece en la página de Eventos y se abre el registro.</span>", "<span class=\"pe-hint\">Draft: only the team can see it (use the preview). Published: it appears on the Events page and registration opens.</span>"))) + "</div></div>" +
        xx("<div class=\"pe-sec\"><h3>Costo</h3><div class=\"in\">", "<div class=\"pe-sec\"><h3>Cost</h3><div class=\"in\">") + f(xx("¿Tiene costo?", "Is there a cost?"), rad("paid", paidEv ? "1" : "0", [["0", xx("Gratis", "Free")], ["1", xx("Con costo", "Paid")]])) +
        '<div id="pe-cost"' + (paidEv ? "" : " hidden") + '><div class="g2">' + f(xx("Precio por adulto", "Price per adult"), inp("price_adult", paidEv ? e.price_adult : "", "number", "20")) + f(xx("Precio por menor", "Price per minor"), inp("price_child", paidEv ? e.price_child : "", "number", "10")) + "</div>" +
        f(xx("Formas de pago al registrarse", "Payment methods at registration"), '<label class="pe-chk"><input type="checkbox" name="pay_zelle"' + (e.pay_zelle !== false ? " checked" : "") + xx("> Zelle</label><label class=\"pe-chk off\"><input type=\"checkbox\" name=\"pay_card\" disabled> Tarjeta (Stripe) · próximamente</label>", "> Zelle</label><label class=\"pe-chk off\"><input type=\"checkbox\" name=\"pay_card\" disabled> Card (Stripe) · coming soon</label>")) +
        f(xx("Enlace de cortesía · personas por miembro del Board", "Courtesy link · people per Board member"), inp("courtesy_per_board", e.courtesy_per_board, "number")) +
        xx("<div class=\"note2\"><b>Board de KAI:</b> los 10 miembros del Board se registran sin costo automáticamente. <b>Pago en la puerta:</b> no se ofrece al registrarse; si alguien llega con un pago pendiente, el equipo lo cobra en el check-in.</div></div></div></div>", "<div class=\"note2\"><b>KAI Board:</b> the 10 Board members register at no cost automatically. <b>Pay at the door:</b> not offered at registration; if someone arrives with a pending payment, the team collects it at check-in.</div></div></div></div>") +
        "</div><div>" +
        xx("<div class=\"pe-sec\"><h3>Equipo asignado</h3><div class=\"in\" id=\"pe-team\"></div></div>", "<div class=\"pe-sec\"><h3>Assigned team</h3><div class=\"in\" id=\"pe-team\"></div></div>") +
        xx("<div class=\"pe-sec\"><h3>Después del evento</h3><div class=\"in\"><label class=\"pe-chk\"><input type=\"checkbox\" name=\"eval_enabled\"", "<div class=\"pe-sec\"><h3>After the event</h3><div class=\"in\"><label class=\"pe-chk\"><input type=\"checkbox\" name=\"eval_enabled\"") + (e.eval_enabled !== false ? " checked" : "") + xx("> Enviar la evaluación anónima a los 10 del Board al día siguiente (10:00 a.m.)</label></div></div>", "> Send the anonymous evaluation to the 10 Board members the next day (10:00 a.m.)</label></div></div>") +
        xx("<div class=\"pe-sec\"><h3>Correos automáticos</h3><div class=\"in\"><div class=\"rem\"><span>Confirmación al registrarse</span><span class=\"pe-pill g\">Activo</span></div><div class=\"rem\"><span>Recordatorio · 4 días antes</span><span class=\"pe-pill g\">Activo</span></div><div class=\"rem\"><span>Recordatorio · 2 días antes</span><span class=\"pe-pill g\">Activo</span></div><div class=\"rem\"><span>Recordatorio · el mismo día, 9:00 a.m.</span><span class=\"pe-pill g\">Activo</span></div><p class=\"st-muted\" style=\"margin:8px 0 0\">Cada persona recibe los correos en el idioma en que se registró.</p></div></div>", "<div class=\"pe-sec\"><h3>Automatic emails</h3><div class=\"in\"><div class=\"rem\"><span>Confirmation at registration</span><span class=\"pe-pill g\">Active</span></div><div class=\"rem\"><span>Reminder · 4 days before</span><span class=\"pe-pill g\">Active</span></div><div class=\"rem\"><span>Reminder · 2 days before</span><span class=\"pe-pill g\">Active</span></div><div class=\"rem\"><span>Reminder · same day, 9:00 a.m.</span><span class=\"pe-pill g\">Active</span></div><p class=\"st-muted\" style=\"margin:8px 0 0\">Each person receives the emails in the language they registered in.</p></div></div>") +
        '<p class="st-msg" id="pe-m"></p><div class="pe-save"><a class="btn navy" href="' + (x ? "#/staff/event/" + e.id : "#/staff/events") + xx("\">Cancelar</a><button class=\"btn ol\" type=\"button\" id=\"pe-prev\">Guardar y ver vista previa</button><button class=\"btn gold\" type=\"submit\">", "\">Cancel</a><button class=\"btn ol\" type=\"button\" id=\"pe-prev\">Save and preview</button><button class=\"btn gold\" type=\"submit\">") + (x ? xx("Guardar cambios", "Save changes") : xx("Crear evento", "Create event")) + "</button></div></div></form>";
      K.put(K.hero(null, x ? xx("Editar evento", "Edit event") : xx("Eventos", "Events"), x ? ttl(e) : xx("Nuevo evento", "New event"), null, [x ? "#/staff/event/" + e.id : "#/staff/events", x ? xx("Evento", "Event") : xx("Eventos", "Events")]) + K.body(html));
      var F = $("#pe-form"), R = { audience: e.audience, status: e.status, paid: paidEv ? "1" : "0" };
      $$("[data-r]", F).forEach(function (g) { $$("button", g).forEach(function (b) { b.onclick = function () { R[g.dataset.r] = b.dataset.v; $$("button", g).forEach(function (z) { z.classList.toggle("on", z === b); }); if (g.dataset.r === "paid") $("#pe-cost").hidden = b.dataset.v !== "1"; }; }); });
      function drawTeam() {
        $("#pe-team").innerHTML = Object.keys(S).map(function (t) {
          return '<div class="asg" data-t="' + esc(t) + '"><b>' + esc(taskName(t)) + '</b><div class="chips">' + S[t].map(function (em) { var o = opts.filter(function (z) { return z.email === em; })[0]; return '<span>' + esc(o ? o.name : em) + ' <button type="button" data-rm="' + esc(em) + xx("\" aria-label=\"Quitar\">×</button></span>", "\" aria-label=\"Remove\">×</button></span>"); }).join("") +
            xx("<select class=\"pe-add\"><option value=\"\">+ Agregar</option>", "<select class=\"pe-add\"><option value=\"\">+ Add</option>") + opts.filter(function (o) { return S[t].indexOf(o.email) < 0; }).map(function (o) { return '<option value="' + esc(o.email) + '">' + esc(o.name) + "</option>"; }).join("") + "</select></div></div>";
        }).join("") + xx("<div class=\"asg\"><input class=\"st-in\" id=\"pe-nt\" placeholder=\"+ Otra tarea (ej. Niños, Sonido) · presione Enter\"></div><p class=\"st-muted\" style=\"margin:10px 0 0\">Cuando se publique el evento, cada persona recibe un correo con su asignación.</p>", "<div class=\"asg\"><input class=\"st-in\" id=\"pe-nt\" placeholder=\"+ Another task (e.g. Kids, Sound) · press Enter\"></div><p class=\"st-muted\" style=\"margin:10px 0 0\">When the event is published, each person receives an email with their assignment.</p>");
        $$("#pe-team .pe-add").forEach(function (s) { s.onchange = function () { var t = s.closest(".asg").dataset.t; if (s.value) { S[t].push(s.value); drawTeam(); } }; });
        $$("#pe-team [data-rm]").forEach(function (b) { b.onclick = function () { var t = b.closest(".asg").dataset.t; S[t] = S[t].filter(function (z) { return z !== b.dataset.rm; }); drawTeam(); }; });
        var nt = $("#pe-nt"); nt.onkeydown = function (ev) { if (ev.key === "Enter") { ev.preventDefault(); var v = nt.value.trim(); if (v && !S[v]) { S[v] = []; drawTeam(); } } };
      }
      drawTeam();
      var adr = F.elements.address, mt = null; adr.oninput = function () { clearTimeout(mt); mt = setTimeout(function () { var v = adr.value.trim(); $("#pe-map").innerHTML = v.length > 8 ? '<iframe loading="lazy" src="https://maps.google.com/maps?q=' + encodeURIComponent(v) + '&output=embed"></iframe>' : xx("El mapa aparece cuando escriba la dirección", "The map appears when you type the address"); }, 700); };
      var PH = { orig: null };   // archivo original en memoria (para volver a ajustar sin perder calidad)
      $("#pe-file").onchange = function () {
        var file = this.files[0]; this.value = ""; if (!file) return;
        cropEvent(file, null, function (blob, pos) { PH.orig = file; uploadPhoto(blob, F, pos, file); });
      };
      $("#pe-adj").onclick = function () {
        var pos = null; try { pos = JSON.parse(F.elements.photo_pos.value || "null"); } catch (er) { pos = null; }
        var src = PH.orig ? Promise.resolve(PH.orig) : fetch(F.elements.photo_orig.value || F.elements.photo_url.value).then(function (r) { if (!r.ok) throw new Error("foto"); return r.blob(); });
        $("#pe-m").textContent = xx("Abriendo la foto…", "Opening the photo…");
        src.then(function (file) { $("#pe-m").textContent = ""; var hasOrig = !!(PH.orig || F.elements.photo_orig.value);
          cropEvent(file, hasOrig ? pos : null, function (blob, p2) { uploadPhoto(blob, F, p2, hasOrig ? null : file); }); })
          .catch(function () { $("#pe-m").textContent = xx("No se pudo abrir la foto. Use “Cambiar foto” para subirla de nuevo.", "Could not open the photo. Use “Change photo” to upload it again."); });
      };
      F.onsubmit = function (ev) {
        ev.preventDefault();
        var v = function (n) { return (F.elements[n] && F.elements[n].value || "").trim(); }, m = $("#pe-m");
        if (!v("title_en") || !v("title")) return (m.textContent = xx("Escriba el título del evento en inglés y en español.", "Enter the event title in English and in Spanish."));
        if (!v("date") || !v("time")) return (m.textContent = xx("Escriba la fecha y la hora de inicio.", "Enter the date and start time."));
        if (R.paid === "1" && !(+v("price_adult") > 0)) return (m.textContent = xx("Escriba el precio por adulto o elija Gratis.", "Enter the price per adult, or choose Free."));
        var staff = []; Object.keys(S).forEach(function (t) { S[t].forEach(function (em) { staff.push({ task: t, email: em }); }); });
        var p = { id: x ? e.id : "", title: v("title"), title_en: v("title_en"), series: v("series"), starts_at: toIso(v("date"), v("time")), ends_at: v("end") ? toIso(v("date"), v("end")) : "",
          venue: v("venue"), address: v("address"), description: v("description"), description_en: v("description_en"), photo_url: v("photo_url"), photo_orig: v("photo_orig"), photo_pos: v("photo_pos"), arrive_note: v("arrive_note"), arrive_note_en: v("arrive_note_en"),
          audience: R.audience, status: R.status, reg_until: v("reg_until"), capacity: v("capacity"), max_guests: v("max_guests"),
          price_adult: R.paid === "1" ? v("price_adult") : "0", price_child: R.paid === "1" ? (v("price_child") || "0") : "0",
          pay_zelle: F.elements.pay_zelle.checked, pay_card: false, courtesy_per_board: v("courtesy_per_board") || "4", eval_enabled: F.elements.eval_enabled.checked, staff: staff };
        var prev = F._prev; F._prev = false;
        var changed = x && (e.status === "published" || e.status === "closed") && (x.people_active || 0) > 0 &&
          (new Date(e.starts_at).getTime() !== new Date(p.starts_at).getTime() || String(e.ends_at ? new Date(e.ends_at).getTime() : "") !== String(p.ends_at ? new Date(p.ends_at).getTime() : "") ||
           (e.venue || "") !== p.venue || (e.address || "") !== p.address);
        if (changed && F._notify == null) {
          var ovn = K.modal(xx("<h3>¿Avisar a los registrados?</h3><div class=\"bd\"><p style=\"margin:0 0 12px\">Cambió la fecha, la hora o el lugar. Hay <b>", "<h3>Notify registered people?</h3><div class=\"bd\"><p style=\"margin:0 0 12px\">The date, time or place changed. There are <b>") + x.people_active + xx(" personas registradas</b>.</p><ul><li>Si les avisa, reciben un correo (en su idioma) con los datos nuevos y botones para actualizar su calendario.</li><li>Los recordatorios ya saldrán con los datos nuevos.</li></ul>", " registered people</b>.</p><ul><li>If you notify them, they receive an email (in their language) with the new details and buttons to update their calendar.</li><li>Reminders will already go out with the new details.</li></ul>") +
            xx("<div class=\"ft\"><button class=\"btn navy\" id=\"nt-no\">Guardar sin avisar</button><button class=\"btn gold\" id=\"nt-yes\">Guardar y avisar</button></div></div>", "<div class=\"ft\"><button class=\"btn navy\" id=\"nt-no\">Save without notifying</button><button class=\"btn gold\" id=\"nt-yes\">Save and notify</button></div></div>"));
          $("#nt-yes", ovn).onclick = function () { F._notify = true; ovn.remove(); F._prev = prev; F.onsubmit({ preventDefault: function () {} }); };
          $("#nt-no", ovn).onclick = function () { F._notify = false; ovn.remove(); F._prev = prev; F.onsubmit({ preventDefault: function () {} }); };
          return;
        }
        p.notify = !!F._notify; F._notify = null;
        var win = prev ? window.open("about:blank", "_blank") : null;
        var b = $("button[type=submit]", F); b.disabled = true; m.textContent = xx("Guardando…", "Saving…");
        K.rpc("ev_staff_save", { p: p }).then(function (id) {
          if (prev) {
            return K.rpc("ev_staff_get", { p_id: id }).then(function (y) {
              var u = SITE + "/#/ev/" + y.event.slug + "?preview=1";
              if (win && !win.closed) win.location.href = u; else window.open(u, "_blank");
              K.toast(xx("Guardado. La vista previa se abrió en otra pestaña.", "Saved. The preview opened in another tab."));
              if (!x) location.hash = "#/staff/event/" + id + "/edit"; else { b.disabled = false; m.textContent = ""; }
            });
          } if (window.KAIEV_KICK) KAIEV_KICK(); K.toast(R.status === "published" ? xx("Evento guardado y publicado", "Event saved and published") : xx("Evento guardado", "Event saved")); location.hash = "#/staff/event/" + id; })
          .catch(function (er) { b.disabled = false; m.textContent = err(er); if (win && !win.closed) win.close(); });
      };
      $("#pe-prev").onclick = function () { F._prev = true; setTimeout(function () { F._prev = false; }, 0); if (F.requestSubmit) F.requestSubmit(); else F.onsubmit({ preventDefault: function () {} }); };
    });
  }
  /* ---------- borrador: aviso grande con lista y botón Publicar ---------- */
  function checks(x) {
    var e = x.event, st = x.staff || [], paid = (+e.price_adult || 0) > 0 || (+e.price_child || 0) > 0;
    return [
      [!!(e.title && e.title_en), xx("Título en inglés y español", "Title in English and Spanish"), xx("Falta el título en un idioma", "Title missing in one language")],
      [!!(e.description && e.description_en), xx("Descripción en los dos idiomas", "Description in both languages"), xx("Falta la descripción en un idioma", "Description missing in one language")],
      [true, xx("Fecha y hora", "Date and time"), ""],
      [!!e.photo_url, xx("Foto", "Photo"), xx("Sin foto", "No photo")],
      [!!e.address, xx("Dirección", "Address"), xx("Sin dirección todavía", "No address yet")],
      [true, paid ? xx("Precio ", "Price ") + money(e.price_adult) : xx("Evento gratis", "Free event"), ""],
      [st.length > 0, xx("Equipo asignado", "Team assigned") + " (" + st.length + ")", xx("Sin equipo asignado", "No team assigned")]
    ];
  }
  function draftBox(x) {
    var e = x.event, c = checks(x);
    var h = '<div class="pe-draft"><div class="ic">✎</div><div><b>' + xx("Este evento es un borrador", "This event is a draft") + "</b><p>" +
      xx("Solo lo ve el equipo. Cuando lo publique, aparece en kaie44.org y se abre el registro.", "Only the team can see it. When you publish it, it appears on kaie44.org and registration opens.") + '</p><div class="ck">' +
      c.map(function (k) { return k[0] ? "<span>✓ " + esc(k[1]) + "</span>" : '<span class="w">⚠ ' + esc(k[2]) + "</span>"; }).join("") + "</div></div>" +
      '<div class="ac"><button class="pb" id="pe-pub">' + xx("Publicar evento", "Publish event") + '</button><a class="pv" target="_blank" rel="noopener" href="' + SITE + "/#/ev/" + esc(e.slug) + '?preview=1">' + xx("Vista previa ↗", "Preview ↗") + "</a></div></div>";
    var bar = $(".pe-bar"); if (!bar) return; bar.insertAdjacentHTML("beforebegin", h);
    $("#pe-pub").onclick = function () { publishModal(x); };
  }
  function publishModal(x) {
    var e = x.event, paid = (+e.price_adult || 0) > 0 || (+e.price_child || 0) > 0, st = x.staff || [];
    var miss = checks(x).filter(function (k) { return !k[0]; });
    var ov = K.modal("<h3>" + xx("¿Publicar este evento?", "Publish this event?") + '</h3><div class="bd"><p style="margin:0 0 12px"><b>' + esc(ttl(e)) + "</b> · " + esc(ldate(e.starts_at)) + "</p>" +
      '<ul style="margin:0 0 14px"><li>' + xx("Aparece en la página de Eventos de kaie44.org y se abre el registro.", "It appears on the kaie44.org Events page and registration opens.") + "</li>" +
      (paid ? "<li>" + xx("Cada miembro del Board recibe por correo su enlace de cortesía.", "Each Board member receives their courtesy link by email.") + "</li>" : "") +
      (st.length ? "<li>" + (st.length === 1 ? xx("La persona asignada del equipo recibe un correo con su tarea.", "The assigned team member receives an email with their task.") : xx("Las " + st.length + " personas del equipo reciben un correo con su tarea.", "The " + st.length + " team members receive an email with their task.")) + "</li>" : "") +
      "<li>" + xx("Puede seguir editándolo después; si cambia la fecha, hora o lugar, el panel le pregunta si quiere avisar a los registrados.", "You can keep editing it afterwards; if the date, time or place changes, the panel asks whether to notify registered people.") + "</li></ul>" +
      (miss.length ? '<div class="pe-due-box" style="margin:0 0 14px"><b>' + xx("Pendiente:", "Still missing:") + "</b> " + miss.map(function (k) { return esc(k[2]); }).join(" · ") + ". " + xx("Puede publicar de todos modos y completarlo después.", "You can publish anyway and complete it later.") + "</div>" : "") +
      '<p class="st-msg" id="pb-m"></p><div class="ft"><button class="btn navy" data-close>' + xx("Todavía no", "Not yet") + '</button><button class="btn gold" id="pb-go">' + xx("Sí, publicar", "Yes, publish") + "</button></div></div>");
    $("#pb-go", ov).onclick = function () {
      var b = this; b.disabled = true; b.textContent = xx("Publicando…", "Publishing…");
      var p = Object.assign({}, e, { status: "published" }); delete p.staff;
      if (p.photo_pos && typeof p.photo_pos === "object") p.photo_pos = JSON.stringify(p.photo_pos);
      K.rpc("ev_staff_save", { p: p }).then(function () {
        ov.remove(); K.toast(xx("¡Evento publicado! Ya está en kaie44.org.", "Event published! It's now live on kaie44.org."));
        detail(e.id, "regs");
      }).catch(function (er) { b.disabled = false; b.textContent = xx("Sí, publicar", "Yes, publish"); $("#pb-m", ov).textContent = err(er); });
    };
  }
  function delEvent(x) {
    var e = x.event, ov = K.modal(xx("<h3>Eliminar evento</h3><div class=\"bd\"><p style=\"margin:0 0 12px\">Se eliminará <b>", "<h3>Delete event</h3><div class=\"bd\"><p style=\"margin:0 0 12px\"><b>") + esc(ttl(e)) + xx("</b> por completo, con su equipo asignado y sus enlaces de cortesía. Nadie se ha registrado todavía.</p><p class=\"st-msg\" id=\"dl-m\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>No eliminar</button><button class=\"btn danger\" id=\"dl-go\">Sí, eliminar</button></div></div>", "</b> will be deleted completely, with its assigned team and its courtesy links. No one has registered yet.</p><p class=\"st-msg\" id=\"dl-m\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>Don't delete</button><button class=\"btn danger\" id=\"dl-go\">Yes, delete</button></div></div>"));
    var armed = false;
    $("#dl-go", ov).onclick = function () {
      var b = this; if (!armed) { armed = true; b.textContent = xx("Confirmar: eliminar para siempre", "Confirm: delete forever"); return; }
      b.disabled = true; K.rpc("ev_staff_delete", { p_id: e.id }).then(function () { ov.remove(); K.toast(xx("Evento eliminado", "Event deleted")); location.hash = "#/staff/events"; }).catch(function (er) { b.disabled = false; $("#dl-m", ov).textContent = err(er); });
    };
  }
  function cancelEvent(x) {
    var e = x.event, ov = K.modal(xx("<h3>Cancelar evento</h3><div class=\"bd\"><p style=\"margin:0 0 12px\"><b>", "<h3>Cancel event</h3><div class=\"bd\"><p style=\"margin:0 0 12px\"><b>") + esc(ttl(e)) + xx("</b> tiene <b>", "</b> has <b>") + (x.people_active || 0) + xx(" persona(s)</b> registradas.</p>", " person(s)</b> registered.</p>") +
      xx("<div class=\"st-f\"><small>Motivo (se incluye en el correo a los registrados)</small><textarea class=\"st-in\" id=\"cx-r\" rows=\"3\" placeholder=\"Ej. Por causas de fuerza mayor tuvimos que cancelar este convivio. Pronto anunciaremos la nueva fecha.\"></textarea></div>", "<div class=\"st-f\"><small>Reason (included in the email to registered people)</small><textarea class=\"st-in\" id=\"cx-r\" rows=\"3\" placeholder=\"e.g. Due to circumstances beyond our control we had to cancel this gathering. We will announce the new date soon.\"></textarea></div>") +
      xx("<ul style=\"margin:14px 0\"><li>A cada registrado e invitado con correo le llega un aviso de cancelación.</li><li>Se detienen los recordatorios y la evaluación.</li>", "<ul style=\"margin:14px 0\"><li>Every registered person and guest with an email receives a cancellation notice.</li><li>Reminders and the evaluation are stopped.</li>") + (x.paid_groups ? "<li><b>" + x.paid_groups + xx(" registro(s) ya pagaron:</b> quedarán como “Reembolso pendiente” para Tesorería.</li>", " registration(s) already paid:</b> they will be marked “Refund pending” for Treasury.</li>") : "") +
      xx("<li>El evento no se borra: queda en el panel con todos sus datos.</li></ul><p class=\"st-msg\" id=\"cx-m\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>No cancelar</button><button class=\"btn danger\" id=\"cx-go\">Cancelar evento</button></div></div>", "<li>The event is not deleted: it stays in the panel with all its data.</li></ul><p class=\"st-msg\" id=\"cx-m\"></p><div class=\"ft\"><button class=\"btn navy\" data-close>Don't cancel</button><button class=\"btn danger\" id=\"cx-go\">Cancel event</button></div></div>"));
    var armed = false;
    $("#cx-go", ov).onclick = function () {
      var b = this, r = $("#cx-r", ov).value.trim();
      if (!r) { $("#cx-m", ov).textContent = EMSG.reason_required; return; }
      if (!armed) { armed = true; b.textContent = xx("Sí, cancelar y avisar a todos", "Yes, cancel and notify everyone"); return; }
      b.disabled = true; K.rpc("ev_staff_cancel_event", { p_id: e.id, p_reason: r }).then(function (res) {
        if (window.KAIEV_KICK) KAIEV_KICK(); ov.remove(); K.toast(xx("Evento cancelado · ", "Event cancelled · ") + (res.emails || 0) + xx(" aviso(s) en camino", " notice(s) on the way")); detail(e.id, "regs");
      }).catch(function (er) { b.disabled = false; $("#cx-m", ov).textContent = err(er); });
    };
  }
  // Sube la foto recortada; si hay un original nuevo, lo guarda también (para volver a ajustar después)
  function uploadPhoto(blob, F, pos, orig) {
    var c = K.sb(); if (!c) return; var m = $("#pe-m");
    var stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 7), name = "ev-" + stamp + ".jpg";
    m.textContent = xx("Subiendo la foto…", "Uploading photo…");
    var up = function (n, b) { return c.storage.from("event-photos").upload(n, b, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" }).then(function (r) { if (r.error) throw r.error; return c.storage.from("event-photos").getPublicUrl(n).data.publicUrl; }); };
    (orig ? shrink(orig, 2400).then(function (b) { return up("orig-" + stamp + ".jpg", b); }) : Promise.resolve(null)).then(function (ou) {
      if (ou) F.elements.photo_orig.value = ou;
      return up(name, blob);
    }).then(function (url) {
      F.elements.photo_url.value = url; F.elements.photo_pos.value = pos ? JSON.stringify(pos) : "";
      $("#pe-ph").style.backgroundImage = "url(\"" + url + "\")"; $("#pe-adj").hidden = false;
      var lb = $("#pe-ph label"); if (lb && lb.firstChild) lb.firstChild.nodeValue = xx("Cambiar foto", "Change photo");
      m.textContent = xx("Foto lista. Recuerde guardar el evento.", "Photo ready. Remember to save the event.");
    }).catch(function (er) { m.textContent = xx("No se pudo subir la foto: ", "Could not upload the photo: ") + (er && er.message ? er.message : K.errMsg(er)); });
  }
  // Ajustar la foto: arrastrar para mover y deslizar para acercar/alejar (formato 16:10, como la tarjeta del evento)
  function cropEvent(file, start, done) {
    var W = 1600, H = 1000, pos = start && start.z ? { x: +start.x || 0, y: +start.y || 0, z: +start.z || 1 } : { x: 0, y: 0, z: 1 }, url = URL.createObjectURL(file), nat = { w: 1, h: 1 }, o = { ox: 0, oy: 0 };
    var ov = K.modal(xx("<h3>Ajustar la foto del evento</h3><div class=\"bd\"><p style=\"margin:0 0 12px\">Arrastre la foto para moverla y use la barra para acercar o alejar. Lo que ve en el marco es exactamente lo que se publica.</p>", "<h3>Adjust the event photo</h3><div class=\"bd\"><p style=\"margin:0 0 12px\">Drag the photo to move it and use the slider to zoom in or out. What you see in the frame is exactly what is published.</p>") +
      '<div class="pe-crop"><img alt=""><i class="g1"></i><i class="g2"></i></div>' +
      '<div class="pe-zoom"><span>−</span><input type="range" min="1" max="3" step="0.01" value="' + pos.z + xx("\" aria-label=\"Acercar\"><span>+</span></div>", "\" aria-label=\"Zoom\"><span>+</span></div>") +
      xx("<div class=\"ft\"><button class=\"btn navy\" data-close>Cancelar</button><button class=\"btn gold\" id=\"pc-ok\">Usar esta foto</button></div></div>", "<div class=\"ft\"><button class=\"btn navy\" data-close>Cancel</button><button class=\"btn gold\" id=\"pc-ok\">Use this photo</button></div></div>"));
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
      var b = this; b.disabled = true; b.textContent = xx("Preparando…", "Preparing…");
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
