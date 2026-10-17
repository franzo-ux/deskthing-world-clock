// User-facing strings, English (default) and Italian.
// Used by both the server (settings labels, switch banners) and the client.

export type Lang = "en" | "it";

const STRINGS = {
  en: {
    // weather
    w_clear: "clear",
    w_mainlyClear: "mainly clear",
    w_partlyCloudy: "partly cloudy",
    w_overcast: "overcast",
    w_fog: "fog",
    w_drizzle: "drizzle",
    w_showers: "showers",
    w_rain: "rain",
    w_snow: "snow",
    w_storm: "thunderstorm",
    // screen
    connecting: "connecting…",
    today: "today",
    tomorrow: "tomorrow",
    yesterday: "yesterday",
    updated: "weather open-meteo · upd. {time}",
    piAsks: "Pi is asking · {label}",
    piDone: "Pi is done · {label}",
    stackAlert: "Stack Status alert",
    // settings
    setLanguage: "Language",
    setLanguageDesc: "Language of the app (setting labels change after restarting DeskThing)",
    setCity: "City {n} · {field}",
    f_name: "name",
    f_country: "subtitle",
    f_lat: "latitude",
    f_lon: "longitude",
    f_tz: "time zone (e.g. Europe/Rome)",
    setSwitchPi: "Switch to Pi Status (questions and finished work)",
    setSwitchStack: "Switch to Stack Status (services down)",
    setPiUrl: "Pi status URL",
  },
  it: {
    w_clear: "sereno",
    w_mainlyClear: "quasi sereno",
    w_partlyCloudy: "poco nuvoloso",
    w_overcast: "coperto",
    w_fog: "nebbia",
    w_drizzle: "pioviggine",
    w_showers: "rovesci",
    w_rain: "pioggia",
    w_snow: "neve",
    w_storm: "temporale",
    connecting: "collegamento…",
    today: "oggi",
    tomorrow: "domani",
    yesterday: "ieri",
    updated: "meteo open-meteo · agg. {time}",
    piAsks: "Pi ti chiede · {label}",
    piDone: "Pi ha finito · {label}",
    stackAlert: "allarme Stack Status",
    setLanguage: "Lingua",
    setLanguageDesc: "Lingua dell'app (le voci delle impostazioni cambiano dopo il riavvio di DeskThing)",
    setCity: "Città {n} · {field}",
    f_name: "nome",
    f_country: "sottotitolo",
    f_lat: "latitudine",
    f_lon: "longitudine",
    f_tz: "fuso orario (es. Europe/Rome)",
    setSwitchPi: "Passa a Pi Status (domande e lavori finiti)",
    setSwitchStack: "Passa a Stack Status (servizi giù)",
    setPiUrl: "Indirizzo stato Pi",
  },
};

export type Key = keyof typeof STRINGS.en;

export const LANGUAGE_OPTIONS = [
  { label: "English", value: "en" },
  { label: "Italiano", value: "it" },
];

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "it";
}

/** Translate a key; {placeholders} are filled from vars. */
export function t(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  let s: string = (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key];
  for (const k in vars) s = s.split("{" + k + "}").join(String(vars[k]));
  return s;
}
