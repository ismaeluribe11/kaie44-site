// Archivo de calendario (.ics) para "Agregar al calendario" del iPhone / Apple Calendar / Outlook.
// Se arma con los datos que vienen en el enlace (no lee la base de datos):
// /cal.ics?t=Título&s=2026-12-06T01:00:00Z&e=...&l=Lugar&d=Detalles&u=https://...&id=algo
export default async (req) => {
  const q = new URL(req.url).searchParams;
  const s = new Date(q.get("s") || ""), e0 = new Date(q.get("e") || "");
  if (isNaN(s)) return new Response("Bad request", { status: 400 });
  const e = isNaN(e0) || e0 <= s ? new Date(s.getTime() + 3600e3) : e0;
  const cut = (v, n) => String(v || "").slice(0, n);
  const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const x = (t) => String(t || "").replace(/\r/g, "").replace(/[,;\\]/g, "\\$&").replace(/\n/g, "\\n");
  const title = cut(q.get("t"), 200) || "KAI";
  const id = cut(q.get("id"), 80).replace(/[^\w.-]/g, "") || z(s);
  const url = /^https:\/\//.test(q.get("u") || "") ? cut(q.get("u"), 500) : "";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kingdom Alliance International//KAI//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", "UID:kai-" + id + "@kaie44.org", "DTSTAMP:" + z(new Date()), "DTSTART:" + z(s), "DTEND:" + z(e),
    "SUMMARY:" + x(title), q.get("d") ? "DESCRIPTION:" + x(cut(q.get("d"), 2000)) : "", q.get("l") ? "LOCATION:" + x(cut(q.get("l"), 300)) : "", url ? "URL:" + url : "",
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:" + x(title), "END:VALARM", "END:VEVENT", "END:VCALENDAR"].filter(Boolean);
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="KAI.ics"', "cache-control": "no-store" },
  });
};
export const config = { path: "/cal.ics" };
