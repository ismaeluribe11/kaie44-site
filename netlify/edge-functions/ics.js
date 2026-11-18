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
  // Hora del Pacífico (así el iPhone no muestra una segunda línea en "GMT")
  const TZ = "America/Los_Angeles";
  const loc = (d) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]));
    return p.year + p.month + p.day + "T" + p.hour + p.minute + p.second;
  };
  const VTZ = ["BEGIN:VTIMEZONE", "TZID:" + TZ,
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0800", "TZOFFSETTO:-0700", "TZNAME:PDT", "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:-0700", "TZOFFSETTO:-0800", "TZNAME:PST", "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
    "END:VTIMEZONE"];
  const notes = [q.get("d") ? cut(q.get("d"), 2000) : "", url && !(q.get("d") || "").includes(url) ? url : ""].filter(Boolean).join("\n\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kingdom Alliance International//KAI//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...VTZ,
    "BEGIN:VEVENT", "UID:kai-" + id + "@kaie44.org", "DTSTAMP:" + z(new Date()), "DTSTART;TZID=" + TZ + ":" + loc(s), "DTEND;TZID=" + TZ + ":" + loc(e),
    "SUMMARY:" + x(title), notes ? "DESCRIPTION:" + x(notes) : "", q.get("l") ? "LOCATION:" + x(cut(q.get("l"), 300)) : "",
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:" + x(title), "END:VALARM", "END:VEVENT", "END:VCALENDAR"].filter(Boolean);
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="KAI.ics"', "cache-control": "no-store" },
  });
};
export const config = { path: "/cal.ics" };
