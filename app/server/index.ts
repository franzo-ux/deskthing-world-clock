import { createDeskThing } from "@deskthing/server";
import { DESKTHING_EVENTS, SETTING_TYPES } from "@deskthing/types";
import { isLang, LANGUAGE_OPTIONS, t, type Key, type Lang } from "../i18n";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type City = { name: string; country: string; lat: number; lon: number; tz: string };
type Weather = { temp: number; code: number; isDay: boolean } | null;

const DeskThing = createDeskThing();

const DEFAULTS: City[] = [
  // defaults: change them in the app settings
  { name: "Rome", country: "Italy", lat: 41.89193, lon: 12.51133, tz: "Europe/Rome" },
  { name: "New York", country: "USA", lat: 40.71427, lon: -74.00597, tz: "America/New_York" },
  { name: "Tokyo", country: "Japan", lat: 35.6895, lon: 139.69171, tz: "Asia/Tokyo" },
];
const WEATHER_MS = 15 * 60 * 1000;

let cities: City[] = DEFAULTS.map((c) => ({ ...c }));
let weather: Weather[] = [null, null, null];
let weatherAt = 0;
let lang: Lang = "en";
let weatherTimer: ReturnType<typeof setInterval> | null = null;
let sendTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------- jump to other apps
// While the clock is on screen, important events switch the Car Thing to the
// app that shows them: Pi questions / finished work -> Pi Status, a stack
// down -> Stack Status (app id "homelab").
declare const __dirname: string;
const HOMELAB_ALERT = join(__dirname, "..", "..", "homelab", "alert.json");
let piUrl = "http://pi-host.local:8765/status"; // example: set yours in the app settings
let switchPi = true;
let switchHomelab = true;
let piStates = new Map<number, string>();
let piFirst = true;
let lastAlertAt: number | null = null;
let watchTimer: ReturnType<typeof setInterval> | null = null;

function jump(app: string, text: string) {
  console.log("Switching to " + app + ": " + text);
  DeskThing.send({ type: "switch", payload: { app, text } });
}

async function watchPi() {
  try {
    const res = await fetch(piUrl, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return;
    const sessions = ((await res.json()) as any).sessions || [];
    const next = new Map<number, string>();
    for (const s of sessions) {
      next.set(s.pid, s.state);
      const prev = piStates.get(s.pid);
      if (piFirst || prev === undefined || !switchPi) continue;
      if (prev !== "asking" && s.state === "asking") jump("pistatus", t(lang, "piAsks", { label: s.label }));
      else if (prev === "busy" && s.state === "idle") jump("pistatus", t(lang, "piDone", { label: s.label }));
    }
    piStates = next;
    piFirst = false;
  } catch {
    // VM unreachable: Pi Status shows that on its own
  }
}

function watchHomelab() {
  let alert: { text?: string; at?: number } | null = null;
  try {
    alert = JSON.parse(readFileSync(HOMELAB_ALERT, "utf8"));
  } catch {
    alert = null;
  }
  const at = alert && typeof alert.at === "number" ? alert.at : 0;
  if (lastAlertAt === null) {
    lastAlertAt = at; // do not replay an old alert at startup
    return;
  }
  if (at > lastAlertAt) {
    lastAlertAt = at;
    if (switchHomelab) jump("homelab", "⚠ " + (alert?.text || t(lang, "stackAlert")));
  }
}

/** Minutes east of UTC for a time zone right now (handles daylight saving). */
function offsetMinutes(tz: string, at = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at);
    const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

async function fetchWeather() {
  const lat = cities.map((c) => c.lat).join(",");
  const lon = cities.map((c) => c.lon).join(",");
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
    "&current=temperature_2m,weather_code,is_day&timezone=auto";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = (await res.json()) as any;
    const list = Array.isArray(data) ? data : [data];
    weather = cities.map((_, i) => {
      const c = list[i]?.current;
      return c ? { temp: Math.round(c.temperature_2m), code: c.weather_code, isDay: c.is_day === 1 } : null;
    });
    weatherAt = Date.now();
  } catch (e) {
    console.warn("Weather: " + (e instanceof Error ? e.message : e));
  }
  send();
}

function send() {
  DeskThing.send({
    type: "clock",
    payload: {
      // the Car Thing clock is not synced: the client uses our time
      now: Date.now(),
      cities: cities.map((c) => ({ name: c.name, country: c.country, offset: offsetMinutes(c.tz) })),
      weather,
      weatherAt,
      lang,
    },
  });
}

function readSettings(s: any) {
  if (!s) return;
  if (isLang(s.language?.value) && s.language.value !== lang) {
    lang = s.language.value;
    send(); // the display follows at once; setting labels at next start
  }
  if (typeof s.switch_pi?.value === "boolean") switchPi = s.switch_pi.value;
  if (typeof s.switch_homelab?.value === "boolean") switchHomelab = s.switch_homelab.value;
  if (typeof s.pi_url?.value === "string" && s.pi_url.value) piUrl = s.pi_url.value;
  const next = cities.map((c, i) => {
    const n = i + 1;
    const lat = Number(s["city" + n + "_lat"]?.value);
    const lon = Number(s["city" + n + "_lon"]?.value);
    return {
      name: String(s["city" + n + "_name"]?.value || c.name),
      country: String(s["city" + n + "_country"]?.value ?? c.country),
      lat: Number.isFinite(lat) ? lat : c.lat,
      lon: Number.isFinite(lon) ? lon : c.lon,
      tz: String(s["city" + n + "_tz"]?.value || c.tz),
    };
  });
  const changed = JSON.stringify(next) !== JSON.stringify(cities);
  cities = next;
  if (changed) fetchWeather();
}

DeskThing.on(DESKTHING_EVENTS.START, async () => {
  const before = (await DeskThing.getSettings()) as any;
  if (isLang(before?.language?.value)) lang = before.language.value;
  const settings: any = {};
  settings.language = {
    id: "language",
    label: t(lang, "setLanguage"),
    description: t(lang, "setLanguageDesc"),
    type: SETTING_TYPES.SELECT,
    value: lang,
    options: LANGUAGE_OPTIONS,
  };
  DEFAULTS.forEach((c, i) => {
    const n = i + 1;
    const add = (key: string, value: any, type = SETTING_TYPES.STRING) =>
      (settings["city" + n + "_" + key] = {
        id: "city" + n + "_" + key,
        label: t(lang, "setCity", { n, field: t(lang, ("f_" + key) as Key) }),
        type,
        value,
      });
    add("name", c.name);
    add("country", c.country);
    add("lat", String(c.lat));
    add("lon", String(c.lon));
    add("tz", c.tz);
  });
  settings.switch_pi = { id: "switch_pi", label: t(lang, "setSwitchPi"), type: SETTING_TYPES.BOOLEAN, value: true };
  settings.switch_homelab = { id: "switch_homelab", label: t(lang, "setSwitchStack"), type: SETTING_TYPES.BOOLEAN, value: true };
  settings.pi_url = { id: "pi_url", label: t(lang, "setPiUrl"), type: SETTING_TYPES.STRING, value: piUrl };
  await DeskThing.initSettings(settings);
  readSettings(await DeskThing.getSettings());
  fetchWeather();
  if (weatherTimer) clearInterval(weatherTimer);
  weatherTimer = setInterval(fetchWeather, WEATHER_MS);
  // resend often: keeps the display's clock in sync and survives lost replies
  if (sendTimer) clearInterval(sendTimer);
  sendTimer = setInterval(send, 5000);
  if (watchTimer) clearInterval(watchTimer);
  watchHomelab();
  watchTimer = setInterval(() => {
    watchPi();
    watchHomelab();
  }, 2000);
});

DeskThing.on(DESKTHING_EVENTS.SETTINGS, (data) => readSettings(data.payload));
DeskThing.on(DESKTHING_EVENTS.GET, (data) => {
  if (data.request === "clock") send();
});
DeskThing.on(DESKTHING_EVENTS.STOP, () => {
  if (weatherTimer) clearInterval(weatherTimer);
  if (sendTimer) clearInterval(sendTimer);
  if (watchTimer) clearInterval(watchTimer);
  weatherTimer = sendTimer = watchTimer = null;
});
