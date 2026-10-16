import { createDeskThing } from "@deskthing/client";

type CityInfo = { name: string; country: string; offset: number };
type Weather = { temp: number; code: number; isDay: boolean } | null;
type Clock = { now: number; cities: CityInfo[]; weather: Weather[]; weatherAt: number };

const DeskThing = createDeskThing();

// Never take keyboard focus away from the DeskThing page: if this iframe gets
// focus (a tap does that), the Car Thing buttons and knob stop driving
// DeskThing's own UI (app wheel, app switching). Taps and clicks still work.
document.addEventListener("mousedown", (e) => e.preventDefault(), true);
const $ = (id: string) => document.getElementById(id) as HTMLElement;

let data: Clock | null = null;
let skew = 0; // PC time minus Car Thing time (the device clock is not synced)

// ---------------------------------------------------------------- neon icons

const svg = (body: string, warm = false) =>
  '<svg class="neon' + (warm ? " warm" : "") + '" width="62" height="62" viewBox="0 0 64 64" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>";
const CLOUD = (dy = 0, color = "#6fe3ff") => '<path stroke="' + color + '" d="M18 ' + (48 + dy) + "h28a9 9 0 0 0 1-18 13 13 0 0 0-25-3 10 10 0 0 0-4 21z" + '" transform="translate(0 ' + 0 + ')"/>';
const rays = (cx: number, cy: number, r1: number, r2: number) =>
  [0, 45, 90, 135, 180, 225, 270, 315]
    .map((a) => '<line stroke="#F1BE58" x1="' + cx + '" y1="' + (cy - r2) + '" x2="' + cx + '" y2="' + (cy - r1) + '" transform="rotate(' + a + " " + cx + " " + cy + ')"/>')
    .join("");

const ICONS: Record<string, string> = {
  sun: svg('<g class="rays">' + rays(32, 32, 17, 23) + '</g><circle class="core" stroke="#F1BE58" cx="32" cy="32" r="10"/>', true),
  moon: svg('<path class="glow" stroke="#e9e2c4" d="M40 12a20 20 0 1 0 13 30 16 16 0 1 1-13-30z"/>', true),
  pcd: svg('<g class="glow"><circle stroke="#F1BE58" cx="24" cy="22" r="7"/><line stroke="#F1BE58" x1="24" y1="8" x2="24" y2="11"/><line stroke="#F1BE58" x1="11" y1="22" x2="14" y2="22"/><line stroke="#F1BE58" x1="14" y1="12" x2="16" y2="14"/></g><g class="float">' + CLOUD(4) + "</g>"),
  pcn: svg('<path class="glow" stroke="#e9e2c4" d="M26 10a11 11 0 1 0 8 17 9 9 0 1 1-8-17z"/><g class="float">' + CLOUD(4) + "</g>"),
  cloud: svg('<g class="float">' + CLOUD() + "</g>"),
  rain: svg('<g class="float">' + CLOUD(-6) + '</g><line class="drop" stroke="#6fb6ff" x1="22" y1="48" x2="19" y2="56"/><line class="drop d2" stroke="#6fb6ff" x1="32" y1="48" x2="29" y2="56"/><line class="drop d3" stroke="#6fb6ff" x1="42" y1="48" x2="39" y2="56"/>'),
  storm: svg('<g class="float">' + CLOUD(-6, "#9aa6b2") + '</g><path class="bolt" stroke="#F1BE58" d="M33 44l-6 9h8l-5 9"/>'),
  snow: svg('<g class="float">' + CLOUD(-6) + "</g>" + [22, 32, 42].map((x, i) => '<g class="flake' + (i ? " d" + (i + 1) : "") + '" stroke="#ffffff"><line x1="' + x + '" y1="48" x2="' + x + '" y2="56"/><line x1="' + (x - 4) + '" y1="52" x2="' + (x + 4) + '" y2="52"/></g>').join("")),
  fog: svg('<line class="fog1" stroke="#9aa6b2" x1="12" y1="24" x2="52" y2="24"/><line class="fog2" stroke="#9aa6b2" x1="8" y1="32" x2="48" y2="32"/><line class="fog1" stroke="#9aa6b2" x1="16" y1="40" x2="56" y2="40"/>'),
};

/** WMO weather code -> icon + Italian description. */
function describe(w: Weather): { icon: string; text: string } {
  if (!w) return { icon: "", text: "" };
  const c = w.code;
  if (c === 0) return { icon: w.isDay ? "sun" : "moon", text: "sereno" };
  if (c === 1 || c === 2) return { icon: w.isDay ? "pcd" : "pcn", text: c === 1 ? "quasi sereno" : "poco nuvoloso" };
  if (c === 3) return { icon: "cloud", text: "coperto" };
  if (c === 45 || c === 48) return { icon: "fog", text: "nebbia" };
  if ((c >= 51 && c <= 57) || (c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { icon: "rain", text: c < 60 ? "pioviggine" : c >= 80 ? "rovesci" : "pioggia" };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { icon: "snow", text: "neve" };
  if (c >= 95) return { icon: "storm", text: "temporale" };
  return { icon: "cloud", text: "" };
}

// ---------------------------------------------------------------- clock

const two = (n: number) => (n < 10 ? "0" : "") + n;

function localParts(utcMs: number, offsetMin: number) {
  const d = new Date(utcMs + offsetMin * 60000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), day: Math.floor((utcMs + offsetMin * 60000) / 86400000) };
}

function diffLabel(i: number, now: number): string {
  if (!data || i === 0) return "oggi";
  const base = data.cities[0];
  const c = data.cities[i];
  const hours = (c.offset - base.offset) / 60;
  const dayDiff = localParts(now, c.offset).day - localParts(now, base.offset).day;
  const day = dayDiff > 0 ? "domani " : dayDiff < 0 ? "ieri " : "";
  const h = (hours > 0 ? "+" : hours < 0 ? "−" : "±") + (Math.abs(hours) % 1 ? Math.abs(hours).toFixed(1) : Math.abs(hours)) + " h";
  return day + h;
}

let renderedIcons: string[] = [];

function render() {
  if (!data) return;
  const now = Date.now() + skew;
  const rows = $("rows");
  if (rows.children.length !== data.cities.length || !rows.querySelector(".time")) {
    rows.innerHTML = data.cities
      .map(
        (_, i) =>
          '<div class="row" id="row' + i + '"><span class="city"><span id="name' + i + '"></span><small id="sub' + i + '"></small></span>' +
          '<span class="time" id="time' + i + '"></span><span class="ic" id="ic' + i + '"></span>' +
          '<span class="temp"><span id="temp' + i + '"></span><span class="desc" id="desc' + i + '"></span></span></div>',
      )
      .join("");
    renderedIcons = [];
  }
  data.cities.forEach((c, i) => {
    const t = localParts(now, c.offset);
    const w = data!.weather[i];
    const isNight = w ? !w.isDay : t.h < 7 || t.h >= 19;
    $("row" + i).className = "row " + (isNight ? "night" : "day");
    $("name" + i).textContent = c.name;
    $("sub" + i).innerHTML = (c.country ? c.country + " · " : "") + '<span class="dn">' + diffLabel(i, now) + "</span>";
    $("time" + i).innerHTML = two(t.h) + '<span class="colon">:</span>' + two(t.m);
    const d = describe(w);
    if (renderedIcons[i] !== d.icon) {
      $("ic" + i).innerHTML = d.icon ? ICONS[d.icon] : "";
      renderedIcons[i] = d.icon;
    }
    $("temp" + i).textContent = w ? w.temp + "°C" : "–";
    $("desc" + i).textContent = d.text;
  });
  if (data.weatherAt) {
    const u = localParts(data.weatherAt, data.cities[0].offset);
    $("upd").textContent = "meteo open-meteo · agg. " + two(u.h) + ":" + two(u.m);
  }
}

DeskThing.on("clock", (msg: any) => {
  data = msg.payload as Clock;
  skew = data.now - Date.now();
  render();
});

// Something happened elsewhere: glitchy banner, then open the app that shows it.
DeskThing.on("switch", (msg: any) => {
  const p = msg.payload || {};
  $("alert-text").textContent = p.text || "";
  $("alert").className = "alert show";
  setTimeout(() => {
    try {
      (DeskThing as any).triggerAction({ id: "open", value: p.app, source: "server" });
    } catch (e) {
      console.warn("could not switch app", e);
    }
  }, 1400);
  setTimeout(() => ($("alert").className = "alert"), 5000);
});

setInterval(render, 1000);
DeskThing.send({ type: "get", request: "clock" } as any);
