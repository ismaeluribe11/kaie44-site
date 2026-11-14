// Tarjetas para compartir (WhatsApp, iMessage, Facebook…): cada página y cada evento
// con su propio título, descripción e imagen. Solo actúa cuando quien pide la página
// es un "lector de enlaces" (bot); a las personas se les entrega la página tal cual.
// Idioma: ?lang=en o ?lang=es (sin parámetro = español).

const SITE = "https://www.kaie44.org";
const SB = "https://mejypcqqpejsxackkngb.supabase.co";
const KEY = "sb_publishable_l8led4zWMBxUVnCY06WJzQ_GPPMcBke"; // llave pública
const BOT = /facebookexternalhit|facebot|twitterbot|whatsapp|slackbot|linkedinbot|discordbot|telegrambot|applebot|skypeuripreview|pinterest|redditbot|embedly|googlebot|bingbot|google-inspectiontool|iframely|vkshare|snapchat|viber|signal|line\//i;

const PAGES = {
  home:       { es: ["Kingdom Alliance International", "Conectar · Capacitar · Comisionar. Una alianza de pastores autónomos que se respaldan mutuamente."],
                en: ["Kingdom Alliance International", "Connect · Empower · Commission. An alliance of autonomous pastors who stand together."] },
  vision:     { es: ["Visión y Misión · KAI", "Conectar, capacitar y comisionar a pastores para el Reino."],
                en: ["Vision & Mission · KAI", "Connecting, empowering and commissioning pastors for the Kingdom."] },
  leadership: { es: ["Nuestro Liderazgo · KAI", "Conozca a los fundadores y al Board de Kingdom Alliance International."],
                en: ["Our Leadership · KAI", "Meet the founders and Board of Kingdom Alliance International."] },
  faith:      { es: ["Declaración de Fe · KAI", "Las verdades bíblicas que nos unen como alianza."],
                en: ["Statement of Faith · KAI", "The biblical truths that unite us as an alliance."] },
  join:       { es: ["Hazte Miembro · KAI", "Respaldo, formación y comunión para pastores. Credencial ministerial con QR."],
                en: ["Become a Member · KAI", "Support, training and fellowship for pastors. Ministerial credential with QR."] },
  apply:      { es: ["Solicitud de Membresía · KAI", "Llene su aplicación para ser miembro de KAI en unos minutos."],
                en: ["Membership Application · KAI", "Fill out your application to become a KAI member in a few minutes."] },
  membership: { es: ["Área de Miembros · KAI", "Su credencial, sus datos y su renovación en un solo lugar."],
                en: ["Members Area · KAI", "Your credential, your info and your renewal in one place."] },
  events:     { es: ["Eventos · KAI", "Cenas, talleres y encuentros para pastores y sus cónyuges."],
                en: ["Events · KAI", "Dinners, workshops and gatherings for pastors and their spouses."] },
  contact:    { es: ["Contacto · KAI", "Escríbanos o llámenos. Con gusto le atendemos."],
                en: ["Contact · KAI", "Write or call us. We are glad to help."] },
};
const ALIAS = { sd: /san\s*diego/i, ie: /inland\s*empire/i };

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function rpc(fn, body) {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(2500),
  });
  if (!r.ok) throw new Error(fn + " " + r.status);
  return r.json();
}

function when(e, L) {
  const d = new Date(e.starts_at), tz = "America/Los_Angeles";
  const day = new Intl.DateTimeFormat(L === "es" ? "es-MX" : "en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz }).format(d);
  const hr = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(d);
  const h = L === "es" ? hr.replace("AM", "a.m.").replace("PM", "p.m.") : hr;
  return (L === "es" ? (day.charAt(0).toUpperCase() + day.slice(1)).replace(",", "") : day) + " · " + h;
}

async function eventMeta(key, L) {
  const list = await rpc("ev_public_list");
  let e = null;
  if (ALIAS[key]) {
    const l = (list || []).filter((x) => ALIAS[key].test(`${x.title || ""} ${x.title_en || ""} ${x.slug || ""}`));
    e = l.find((x) => x.status !== "cancelled") || l[0];
  } else e = (list || []).find((x) => x.slug === key);
  if (!e) return null;
  const title = (L === "en" ? e.title_en || e.title : e.title || e.title_en) || "KAI";
  const city = (e.address || "").split(",").slice(-2, -1)[0]?.trim();
  const free = Number(e.price_adult || 0) === 0;
  const dinner = /cena|dinner/i.test(`${e.title} ${e.title_en}`);
  const bits = [when(e, L), [e.venue, city].filter(Boolean).join(", ")];
  if (free) bits.push(dinner ? (L === "es" ? "¡La cena va por nuestra cuenta!" : "Dinner is on us!") : (L === "es" ? "Gratis" : "Free"));
  bits.push(L === "es" ? "Regístrese aquí." : "Register here.");
  if (e.status === "cancelled") bits.unshift(L === "es" ? "CANCELADO" : "CANCELLED");
  const img = e.photo_url ? (/^https?:/.test(e.photo_url) ? e.photo_url : `${SITE}/${e.photo_url.replace(/^\//, "")}`) : `${SITE}/images/og/events-${L}.jpg`;
  return { title, desc: bits.filter(Boolean).join(" · "), img, dims: !e.photo_url };
}

export default async (request, context) => {
  const res = await context.next();
  if (!BOT.test(request.headers.get("user-agent") || "")) return res;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;

  const url = new URL(request.url);
  const L = url.searchParams.get("lang") === "en" ? "en" : "es";
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  let meta = null;
  try {
    if ((parts[0] === "events" || parts[0] === "ev") && parts[1]) meta = await eventMeta(decodeURIComponent(parts[1]), L);
  } catch (_) { /* si Supabase no responde, se usa la tarjeta de Eventos */ }
  if (!meta) {
    const k = parts[0] === "ev" ? "events" : (PAGES[parts[0]] ? parts[0] : (parts[0] ? null : "home"));
    if (!k) return res;
    const [t, d] = PAGES[k][L];
    meta = { title: t, desc: d, img: `${SITE}/images/og/${k}-${L}.jpg`, dims: true };
  }
  const canon = SITE + url.pathname + (L === "en" ? "?lang=en" : "");
  let html = await res.text();
  html = html
    .replace(/<html lang="[a-z]+"/, `<html lang="${L}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(meta.desc)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${esc(canon)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(meta.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(meta.desc)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(canon)}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(meta.img)}">${meta.dims ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : ""}<meta property="og:locale" content="${L === "es" ? "es_MX" : "en_US"}"><meta name="twitter:title" content="${esc(meta.title)}"><meta name="twitter:description" content="${esc(meta.desc)}"><meta name="twitter:image" content="${esc(meta.img)}">`);
  const h = new Headers(res.headers); h.delete("content-length");
  return new Response(html, { status: res.status, headers: h });
};

export const config = {
  path: ["/", "/home", "/vision", "/leadership", "/faith", "/join", "/apply", "/membership", "/events", "/events/*", "/ev/*", "/contact"],
};
