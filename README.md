# World Clock for DeskThing

🇮🇹 [Leggi in italiano](README.it.md)

A [DeskThing](https://deskthing.app) app for the Spotify **Car Thing**: the time in **three places**,
each with its temperature and an **animated neon weather icon**, in a terminal-style layout.

- Time and time zone of each city, with the difference from the first one ("−6 h", "tomorrow +5 h").
  Daylight saving time is handled automatically.
- Weather from [Open-Meteo](https://open-meteo.com) (free, no API key), refreshed every 15 minutes.
- Animated neon icons: clear (day/night), partly cloudy (day/night), overcast, rain, storm, snow, fog.
- While the clock is on screen, important events **switch the Car Thing** to the app that shows them:
  Pi asks a question or finishes a job → [Pi Status](https://github.com/franzo-ux/deskthing-pi-status);
  a service goes down → [Stack Status](https://github.com/franzo-ux/deskthing-stack-status).

## Requirements

- A Car Thing flashed for DeskThing, connected to a PC running **DeskThing ≥ 0.11**.
- **Node.js ≥ 20** on the PC (only to build the app). Internet access on the PC for the weather.

## Build and install

```bash
npm install
npm run build          # → dist/worldclock
# close DeskThing (tray icon → Quit), then:
npm run deploy         # copies the app into DeskThing and registers it
```

Start DeskThing and open **Orologio** on the Car Thing. To update later: `npm run build`,
`npm run deploy -- --files`, restart DeskThing.

## Settings (DeskThing → Apps → Orologio)

For each of the 3 cities: **name**, **subtitle** (country/region), **latitude**, **longitude** and
**time zone** (IANA name, e.g. `Europe/Rome`, `America/New_York`, `Asia/Tokyo`).

Find coordinates and time zone of a place with Open-Meteo's geocoding:

```bash
curl "https://geocoding-api.open-meteo.com/v1/search?name=Tokyo&count=1"
```

Switching to other apps (optional, needs those apps installed):

| Setting | Meaning |
|---|---|
| Passa a Pi Status | jump to Pi Status when Pi asks something or finishes |
| Passa a Homelab | jump to Stack Status when a service goes down |
| Indirizzo stato Pi | URL of the Pi status service, e.g. `http://pi-host.local:8765/status` |

## How it works

- The Car Thing clock is not synced, so the PC sends its own time every 5 s together with each city's
  UTC offset (computed with the PC's time-zone database); the display only counts the seconds.
- One Open-Meteo request returns the current temperature, WMO weather code and day/night for all
  three cities.
- App switching uses DeskThing's built-in "Open App" action from the app on screen.
