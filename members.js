/* KAI · Members Area
   Sign in (Supabase), member portal, credential with QR, change requests,
   and the public QR verification page (#/verify/CODE).
   The publishable key below is public by design; data access is enforced
   by row level security in Supabase. */
(function () {
  "use strict";

  var SB_URL = "https://mejypcqqpejsxackkngb.supabase.co";
  var SB_KEY = "sb_publishable_l8led4zWMBxUVnCY06WJzQ_GPPMcBke";
  var SITE = /(^|\.)kaie44\.org$/.test(location.hostname) ? "https://www.kaie44.org" : location.origin;

  /* 1. Links in invite / password emails arrive as #access_token=...&type=invite.
        Capture them before the page router reads the hash. */
  var AUTH = { type: null, at: null, rt: null, err: null };
  (function () {
    var h = location.hash || "";
    if (h.indexOf("access_token=") < 0 && h.indexOf("error=") < 0 && h.indexOf("error_code=") < 0) return;
    var q = new URLSearchParams(h.replace(/^#\/?/, ""));
    if (q.get("access_token")) {
      AUTH.at = q.get("access_token"); AUTH.rt = q.get("refresh_token"); AUTH.type = q.get("type");
    } else {
      AUTH.err = q.get("error_code") || q.get("error") || "error";
    }
    var dest = (AUTH.type === "invite" || AUTH.type === "recovery" || AUTH.err) ? "#/password" : "#/membership";
    history.replaceState(null, "", dest.slice(1) + location.search);
  })();

  var sb = null;
  try {
    if (window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(SB_URL, SB_KEY, {
        auth: { flowType: "implicit", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true }
      });
    }
  } catch (e) { sb = null; }

  var S = {
    state: "load", user: null, member: null, hasSession: false,
    pwMode: AUTH.type === "invite" ? "inv" : "new",
    view: null, ver: { code: null, state: null, data: null, at: null }
  };

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function T(k) { return typeof window.t === "function" ? window.t(k) : (typeof t === "function" ? t(k) : k); }
  function lang() { try { return L === "es" ? "es" : "en"; } catch (e) { return "en"; } }
  function esc(x) {
    return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function d8(s) { if (!s) return null; var d = new Date(String(s).slice(0, 10) + "T00:00:00Z"); return isNaN(d) ? null : d; }
  function fdate(s, lg, opt) {
    var d = d8(s); if (!d) return "";
    return d.toLocaleDateString(lg === "es" ? "es-MX" : "en-US",
      Object.assign({ timeZone: "UTC" }, opt || { year: "numeric", month: "long", day: "numeric" }));
  }
  function today() {
    var n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  }
  function eff(m) {
    if (!m || m.status !== "active") return "inactive";
    if (!m.valid_through || String(m.valid_through).slice(0, 10) >= today()) return "active";
    return "expired";
  }
  function stCls(st) { return st === "active" ? "" : st === "expired" ? "exp" : "ina"; }
  function ini(name) {
    var w = String(name || "").trim().split(/\s+/).filter(Boolean);
    return ((w[0] || "").charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : "")).toUpperCase() || "KAI";
  }
  function photoHtml(m, cls) {
    var fb = '<div class="' + (cls || "ini") + '" aria-hidden="true"' + (m.photo_url ? " hidden" : "") + ">" + esc(ini(m.full_name)) + "</div>";
    if (!m.photo_url) return fb;
    // if the photo can't load, show the initials instead of a broken image
    return '<img src="' + esc(m.photo_url) + '" alt="' + esc(m.full_name) + '" onerror="this.nextElementSibling.hidden=false;this.remove()">' + fb;
  }
  function vurl(m) { return SITE + "/verify/" + encodeURIComponent(m.verify_code || ""); }
  function say(el, key, cls) {
    if (!el) return;
    el.dataset.mk = key || "";
    el.textContent = key ? T(key) : "";
    el.className = "msg" + (cls ? " " + cls : "");
  }
  function show(id, on) { var e = $(id); if (e) e.hidden = !on; }

  function qrSvg(text) {
    if (typeof window.qrcode !== "function") return "";
    var q = window.qrcode(0, "M"); q.addData(text); q.make();
    var n = q.getModuleCount(), p = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) p += "M" + c + " " + r + "h1v1h-1z";
    return '<svg viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges" aria-hidden="true"><path d="' + p + '" fill="#0b1f4b"/></svg>';
  }

  var GLOBE = '<svg class="gl" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" aria-hidden="true">' +
    '<circle cx="50" cy="50" r="44"/><ellipse cx="50" cy="50" rx="20" ry="44"/><path d="M6 50h88M12 28h76M12 72h76"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  /* ---------- credential (always in English, like the printed card) ---------- */
  function credFront(m) {
    var w = String(m.title || "Member").trim().split(/\s+/);
    var l1 = w.length > 1 ? w.slice(0, -1).join(" ") : w[0];
    var l2 = w.length > 1 ? w[w.length - 1] : "";
    var fs = Math.min(7, 56 / (Math.max(l1.length, 1) * 0.74));
    var exp = m.valid_through ? fdate(m.valid_through, "en", { year: "numeric", month: "short", day: "numeric" }).toUpperCase() : "—";
    var since = m.member_since ? fdate(m.member_since, "en", { year: "numeric", month: "short", day: "numeric" }).toUpperCase() : "—";
    return '<div class="kx" role="img" aria-label="' + esc("Ministerial credential, front: " + (m.full_name || "") + ", " + (m.title || "")) + '">' +
      GLOBE + '<div class="gc"></div><div class="nvg"></div><div class="nv"></div>' +
      '<img class="lg" src="images/logo.png" alt="">' +
      '<div class="kp">' + photoHtml(m, "kin") + "</div>" +
      '<div class="ti"><p class="t1" style="font-size:' + fs.toFixed(2) + 'cqw">' + esc(l1) + "</p>" +
      (l2 ? '<p class="t2">' + esc(l2) + "</p>" : "") +
      '<div class="rl"></div><p class="nm">' + esc(m.full_name) + "</p></div>" +
      '<div class="bt"><div><p class="lb">Credential No.</p><p class="vl">' + esc(m.credential_no || "—") + "</p></div>" +
      '<div><p class="lb">Expires</p><p class="vl">' + esc(exp) + '</p><p class="lb ms">Member since</p><p class="vl">' + esc(since) + "</p></div></div>" +
      '<p class="mt">One body<br>one spirit</p></div>';
  }

  function credBack(m) {
    var st = eff(m), stTxt = { active: "Active", expired: "Expired", inactive: "Inactive" }[st];
    var loc = [m.city, m.state].filter(Boolean).join(", ");
    return '<div class="kx" role="img" aria-label="Ministerial credential, back, with verification QR code">' +
      GLOBE + '<div class="gc"></div>' +
      '<img class="lg lg2" src="images/logo.png" alt="">' +
      '<div class="bk"><p class="h">Ministerial Credential</p><div class="rl2"></div>' +
      '<p class="cx">This credential certifies that the individual named on the front is recognized by Kingdom Alliance International in the ministry capacity indicated.</p>' +
      '<dl class="kd"><dt>Credential Status:</dt><dd>' + stTxt + "</dd>" +
      "<dt>Valid Through:</dt><dd>" + esc(fdate(m.valid_through, "en") || "—") + "</dd>" +
      "<dt>Affiliated Local Church:</dt><dd>" + esc(m.church || "—") + "</dd>" +
      "<dt>Location:</dt><dd>" + esc(loc || "—") + "</dd></dl>" +
      '<div class="sc"><i>One body, one Spirit</i><small>Ephesians 4:4</small></div></div>' +
      '<div class="qb"><div class="qq">' + qrSvg(vurl(m)) + "</div><b>VERIFICATION</b><span>Scan the QR code or visit</span><strong>www.kaie44.org</strong></div>" +
      '<div class="ft">This credential remains the property of Kingdom Alliance International.</div></div>';
  }

  /* ---------- painting ---------- */
  function paint() {
    ["load", "down", "out", "none", "in"].forEach(function (k) { show("m-" + k, S.state === k); });
    if (S.state === "in" && S.member) paintMember();
    if (S.view === "password") paintPw();
    if (S.view === "verify") paintVerify();
  }

  function paintMember() {
    var m = S.member, lg = lang(), st = eff(m), cls = stCls(st);
    var first = String(m.full_name || "").trim().split(/\s+/)[0] || "";
    $("m-hello").textContent = T("m_hello") + first;
    $("m-photo").innerHTML = photoHtml(m);
    $("m-name").textContent = m.full_name || "";
    $("m-title").textContent = m.title || "";
    var p = $("m-pill"); p.className = "pill" + (cls ? " " + cls : ""); p.textContent = T("st_" + st);
    $("kc-f").innerHTML = credFront(m);
    $("kc-b").innerHTML = credBack(m);
    var loc = [m.city, m.state].filter(Boolean).join(", ");
    var web = String(m.website || "").trim();
    var webHref = web && !/^https?:\/\//i.test(web) ? "https://" + web : web;
    var rows = [
      ["l_status", '<span class="pill' + (cls ? " " + cls : "") + '">' + esc(T("st_" + st)) + "</span>"],
      ["l_title", esc(m.title)],
      ["l_joined", esc(fdate(m.member_since, lg))],
      ["l_valid", esc(fdate(m.valid_through, lg))],
      ["l_cred", esc(m.credential_no)],
      ["l_church", esc(m.church)],
      ["l_city", esc(loc)],
      ["l_phone", m.phone ? '<a href="tel:' + esc(String(m.phone).replace(/[^\d+]/g, "")) + '">' + esc(KPH(m.phone)) + "</a>" : ""],
      ["l_email", m.email ? '<a href="mailto:' + esc(m.email) + '">' + esc(m.email) + "</a>" : ""],
      ["l_web", web ? '<a href="' + esc(webHref) + '" target="_blank" rel="noopener">' + esc(web.replace(/^https?:\/\//i, "")) + "</a>" : ""]
    ];
    $("m-info").innerHTML = rows.map(function (r) {
      return "<div><dt>" + esc(T(r[0])) + "</dt><dd>" + (r[1] || "—") + "</dd></div>";
    }).join("");
    $("m-asof").textContent = m.data_as_of ? T("m_asof") + fdate(m.data_as_of, lg) + "." : "";
    var vl = $("m-vlink"); if (vl) vl.href = vurl(m);
  }

  function paintPw() {
    $("pw-h").textContent = T(S.pwMode === "inv" ? "pw_t_inv" : "pw_t");
    var ok = S.hasSession && !AUTH.err;
    show("pw-form", ok);
    show("pw-exp", !ok && S.state !== "load");
  }

  function paintVerify() {
    var v = S.ver, box = $("vr"), lg = lang();
    if (!box) return;
    if (!v.state || v.state === "load") { box.innerHTML = '<p class="sub">' + esc(T("m_loading")) + "</p>"; return; }
    if (v.state === "down") { box.innerHTML = '<div class="vcard"><p class="sub" style="margin:0">' + esc(T("vr_down")) + "</p></div>"; return; }
    if (v.state === "nf") {
      box.innerHTML = '<div class="vcard"><div class="vtop"><img src="images/logo.png" alt="Kingdom Alliance International">' +
        '<span class="vst ina">' + ICON_X + esc(T("vr_nf_t")) + "</span></div>" +
        '<p class="sub" style="margin:22px 0 0">' + esc(T("vr_nf_p")) + "</p></div>";
      return;
    }
    var d = v.data, st = d.status || "inactive", cls = stCls(st);
    var when = v.at.toLocaleString(lg === "es" ? "es-MX" : "en-US", { dateStyle: "long", timeStyle: "short" });
    box.innerHTML = '<div class="vcard"><div class="vtop"><img src="images/logo.png" alt="Kingdom Alliance International">' +
      '<span class="vst ' + cls + '">' + (st === "active" ? ICON_OK : ICON_X) + esc(T("st_" + st)) + "</span></div>" +
      '<div class="vmain"><div class="frame">' + photoHtml(d) + "</div><div><h2>" + esc(d.full_name) + '</h2><p class="role">' + esc(d.title || "") + "</p></div></div>" +
      '<dl class="vdl"><div><dt>' + esc(T("vr_cred")) + "</dt><dd>" + esc(d.credential_no || "—") + "</dd></div>" +
      "<div><dt>" + esc(T("vr_valid")) + "</dt><dd>" + esc(fdate(d.valid_through, lg) || "—") + "</dd></div></dl>" +
      '<p class="note">' + esc(T("vr_checked") + when) + (d.data_as_of ? " · " + esc(T("vr_asof") + fdate(d.data_as_of, lg)) : "") + "</p>" +
      '<p class="note" style="margin-top:6px">' + esc(T("vr_note")) + "</p></div>";
  }

  /* ---------- data ---------- */
  async function load(session) {
    S.hasSession = !!session;
    S.user = session ? session.user : null;
    if (!session) { S.member = null; S.state = "out"; paint(); return; }
    S.state = "load"; paint();
    try {
      var em = String((session.user && session.user.email) || "").toLowerCase().replace(/[\\%_]/g, "\\$&");
      // Solo el registro propio (el equipo puede leer todos los miembros por sus permisos)
      var r = await sb.from("members").select("*").ilike("email", em).limit(1).maybeSingle();
      if (r.error) throw r.error;
      S.member = r.data; S.state = r.data ? "in" : "none";
    } catch (e) { S.state = "down"; }
    paint();
  }

  async function verifyLoad(code) {
    S.ver = { code: code, state: "load", data: null, at: null }; paintVerify();
    if (!sb || !code) { S.ver.state = sb ? "nf" : "down"; S.ver.at = new Date(); paintVerify(); return; }
    try {
      var r = await sb.rpc("verify_credential", { code: code });
      if (r.error) throw r.error;
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      S.ver.data = row || null; S.ver.state = row ? "ok" : "nf";
    } catch (e) { S.ver.state = "down"; }
    S.ver.at = new Date();
    if (S.ver.code === code) paintVerify();
  }

  async function boot() {
    if (!sb) { S.state = "down"; paint(); return; }
    if (AUTH.at) {
      try {
        var r = await sb.auth.setSession({ access_token: AUTH.at, refresh_token: AUTH.rt });
        if (r.error) AUTH.err = r.error.message || "expired";
      } catch (e) { AUTH.err = "expired"; }
    }
    var s = null;
    try { s = (await sb.auth.getSession()).data.session; } catch (e) { s = null; }
    sb.auth.onAuthStateChange(function (ev) {
      if (ev === "SIGNED_OUT") {
        S.user = null; S.member = null; S.hasSession = false; S.state = "out";
        setTimeout(paint, 0);
      }
    });
    await load(s);
  }

  /* ---------- change requests ---------- */
  var FIELDS = [["full_name", "m_name"], ["church", "l_church"], ["city", "m_city2"], ["state", "m_state"], ["phone", "l_phone"], ["website", "l_web"]];

  function chgOpen() {
    var f = $("m-chg"), m = S.member;
    FIELDS.forEach(function (x) { f.elements[x[0]].value = m[x[0]] || ""; });
    f.elements.comments.value = "";
    say($("mc-msg"), ""); say($("m-sent"), "");
    f.hidden = false; $("m-rev").hidden = true; $("m-chg-open").hidden = true;
    f.scrollIntoView({ behavior: "smooth", block: "start" });
    f.elements.full_name.focus({ preventScroll: true });
  }
  function chgClose() {
    $("m-chg").hidden = true; $("m-rev").hidden = true; $("m-chg-open").hidden = false;
  }
  function diff() {
    var f = $("m-chg"), m = S.member, out = [];
    FIELDS.forEach(function (x) {
      var a = String(m[x[0]] || "").trim(), b = String(f.elements[x[0]].value || "").trim();
      if (a !== b) out.push({ k: x[0], l: x[1], a: a, b: b });
    });
    return out;
  }

  /* ---------- wiring ---------- */
  function wire() {
    var login = $("m-login"), reset = $("m-reset");

    $("ml-forgot").onclick = function () {
      login.hidden = true; reset.hidden = false; say($("mr-msg"), "");
      reset.elements.email.value = login.elements.email.value; reset.elements.email.focus();
    };
    $("mr-back").onclick = function () { reset.hidden = true; login.hidden = false; login.elements.email.focus(); };

    login.addEventListener("submit", async function (e) {
      e.preventDefault();
      var em = login.elements.email.value.trim(), pw = login.elements.password.value, msg = $("ml-msg"), b = login.querySelector("[type=submit]");
      if (!em || !pw) { say(msg, "m_need", "err"); return; }
      if (!sb) { say(msg, "m_down", "err"); return; }
      b.disabled = true; say(msg, "m_loading");
      try {
        var r = await sb.auth.signInWithPassword({ email: em, password: pw });
        if (r.error) {
          var code = (r.error.code || "") + " " + (r.error.message || "");
          say(msg, /not.?confirmed/i.test(code) ? "m_unconf" : /invalid/i.test(code) ? "m_bad" : "m_err", "err");
        } else {
          login.reset(); say(msg, "");
          await load(r.data.session);
        }
      } catch (x) { say(msg, "m_err", "err"); }
      b.disabled = false;
    });

    reset.addEventListener("submit", async function (e) {
      e.preventDefault();
      var em = reset.elements.email.value.trim(), msg = $("mr-msg"), b = reset.querySelector("[type=submit]");
      if (!em) { say(msg, "m_need_e", "err"); return; }
      if (!sb) { say(msg, "m_down", "err"); return; }
      b.disabled = true; say(msg, "m_loading");
      try {
        var r = await sb.auth.resetPasswordForEmail(em, { redirectTo: SITE + "/" });
        if (r.error && r.error.status === 429) say(msg, "m_err", "err");
        else say(msg, "m_reset_ok", "ok");
      } catch (x) { say(msg, "m_err", "err"); }
      b.disabled = false;
    });

    document.querySelectorAll(".m-out").forEach(function (btn) {
      btn.onclick = async function () {
        btn.disabled = true;
        try { if (sb) await sb.auth.signOut(); } catch (e) {}
        btn.disabled = false;
        S.user = null; S.member = null; S.hasSession = false; S.state = "out";
        chgClose(); say($("m-sent"), ""); paint(); window.scrollTo(0, 0);
      };
    });

    $("m-chg-open").onclick = chgOpen;
    $("m-chg-cancel").onclick = function () { chgClose(); $("m-chg-open").focus(); };

    $("m-chg").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = this, d = diff(), c = f.elements.comments.value.trim();
      if (!d.length && !c) { say($("mc-msg"), "m_nochg", "err"); return; }
      say($("mc-msg"), "");
      var items = d.map(function (x) {
        return "<li><b>" + esc(T(x.l)) + "</b><s>" + esc(x.a || T("m_empty")) + "</s> → <ins>" + esc(x.b || T("m_empty")) + "</ins></li>";
      });
      if (c) items.push("<li><b>" + esc(T("m_comments")) + "</b>" + esc(c) + "</li>");
      $("m-rev-list").innerHTML = items.join("");
      f.hidden = true; $("m-rev").hidden = false; say($("mv-msg"), "");
      $("m-rev").scrollIntoView({ behavior: "smooth", block: "start" });
      $("m-send").focus({ preventScroll: true });
    });

    $("m-edit").onclick = function () { $("m-rev").hidden = true; $("m-chg").hidden = false; $("m-chg").elements.full_name.focus(); };

    $("m-send").onclick = function () {
      var f = $("m-chg"), m = S.member, d = diff(), b = this;
      f.elements.email.value = m.email || "";
      f.elements.credential_no.value = m.credential_no || "";
      f.elements.language.value = lang();
      f.elements.changes.value = d.map(function (x) { return T(x.l) + ": " + (x.a || "—") + " → " + (x.b || "—"); }).join("\n") || "—";
      b.disabled = true; say($("mv-msg"), "m_loading");
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(f)).toString()
      }).then(function (r) {
        if (!r.ok) throw new Error("send");
        chgClose(); f.reset(); say($("mv-msg"), "");
        say($("m-sent"), "m_sent", "ok");
      }).catch(function () {
        say($("mv-msg"), "m_err", "err");
      }).then(function () { b.disabled = false; });
    };

    // Pide el código de 6 dígitos de la app de autenticación y sube la sesión a dos pasos
    function mfaStep(msg) {
      return new Promise(function (done) {
        var f = $("pw-form"), box = document.getElementById("pw-mfa");
        if (!box) {
          box = document.createElement("div"); box.id = "pw-mfa"; box.className = "pw-mfa";
          box.innerHTML = '<p><b>' + (lang() === "es" ? "Verificación en dos pasos" : "Two-step verification") + '</b><br>' +
            (lang() === "es" ? "Tu cuenta tiene verificación en dos pasos. Escribe el código de 6 dígitos de tu app de autenticación para guardar la nueva contraseña." : "Your account uses two-step verification. Enter the 6-digit code from your authenticator app to save the new password.") +
            '</p><input id="pw-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"><button type="button" class="btn gold" id="pw-code-go">' + (lang() === "es" ? "Verificar y guardar" : "Verify and save") + "</button>";
          f.appendChild(box);
        }
        box.hidden = false; say(msg, ""); var inp = $("pw-code"); inp.value = ""; inp.focus();
        $("pw-code-go").onclick = async function () {
          var code = inp.value.replace(/\D/g, "");
          if (code.length !== 6) { say(msg, lang() === "es" ? "Escribe los 6 dígitos." : "Enter the 6 digits.", "err"); return; }
          try {
            var fl = await sb.auth.mfa.listFactors();
            var fac = fl.data && ((fl.data.totp || [])[0] || (fl.data.all || []).filter(function (x) { return x.status === "verified"; })[0]);
            if (!fac) { say(msg, "m_err", "err"); return done(false); }
            var v = await sb.auth.mfa.challengeAndVerify({ factorId: fac.id, code: code });
            if (v.error) { say(msg, lang() === "es" ? "Código incorrecto. Revisa la app e inténtalo otra vez." : "Wrong code. Check the app and try again.", "err"); return; }
            box.hidden = true; done(true);
          } catch (x) { say(msg, "m_err", "err"); done(false); }
        };
      });
    }

    $("pw-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var a = $("pw-1").value, b2 = $("pw-2").value, msg = $("pw-msg"), b = this.querySelector("[type=submit]");
      if (a.length < 8) { say(msg, "pw_short", "err"); return; }
      if (a !== b2) { say(msg, "pw_mis", "err"); return; }
      b.disabled = true; say(msg, "m_loading");
      try {
        var r = await sb.auth.updateUser({ password: a });
        // Cuentas con verificación en dos pasos: Supabase pide el código antes de cambiar la contraseña
        if (r.error && /aal|mfa|factor/i.test((r.error.code || "") + " " + (r.error.message || ""))) {
          var ok2 = await mfaStep(msg);
          if (!ok2) { b.disabled = false; return; }
          r = await sb.auth.updateUser({ password: a });
        }
        if (r.error) {
          var code = (r.error.code || "") + " " + (r.error.message || "");
          say(msg, /same/i.test(code) ? "pw_same" : /weak|short|characters/i.test(code) ? "pw_short" : "m_err", "err");
          b.disabled = false; return;
        }
        this.reset(); say(msg, "pw_ok", "ok");
        AUTH.type = null; AUTH.err = null; S.pwMode = "new";
        setTimeout(function () { b.disabled = false; say(msg, ""); KGO("/membership"); }, 1600);
        var s = (await sb.auth.getSession()).data.session;
        load(s);
      } catch (x) { say(msg, "m_err", "err"); b.disabled = false; }
    });
  }

  /* ---------- public hook, called by the site's render() ---------- */
  window.KAI = {
    sb: sb,
    cred: function (x) { return { front: credFront(x), back: credBack(x) }; },
    view: function (v) {
      S.view = v;
      document.querySelectorAll(".msg[data-mk]").forEach(function (el) { if (el.dataset.mk) el.textContent = T(el.dataset.mk); });
      if (v === "verify") {
        var code = "";
        try { code = decodeURIComponent((KR() || "").replace(/^#\/verify\//, "").split("?")[0]).trim(); } catch (e) { code = ""; }
        if (code !== S.ver.code) verifyLoad(code);
      }
      paint();
    }
  };

  document.addEventListener("DOMContentLoaded", function () { wire(); boot(); });
})();
