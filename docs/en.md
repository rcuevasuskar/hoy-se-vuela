# Parapente Cenes — Documentation

Web app (PWA) for live wind, forecasts and flight criteria for paragliding. Designed for Cenes de la Vega but extensible to any community takeoff.

URL: https://rcuevasuskar.github.io/parapente-cenes/

---

## 1. Main dashboard

At a glance you see the state of the currently selected takeoff:

- **Main compass**: shows the flying direction ranges defined for that takeoff (green = ideal, yellow = flyable, red = bad). An arrow turns with the current wind direction.
- **Average / gust / minimum** speed and last update time.
- **Wind history** for the last 2/4/6 h (configurable): each bar is one hour, with direction arrow and color by speed.
- **Open‑Meteo forecast** (today / +24 h).
- **Nearby stations**: mini-compass cards with other Pioupiou/FFVL stations and METAR airports within the chosen radius.
- **Best window**: rough computation of the day's best slot.
- **Quick guide**: list of ideal / flyable / bad directions, wind range and max gusts, plus the takeoff's **notes** if any.
- **Map** with the takeoff position.

## 2. Takeoff selector (header)

- **Current takeoff**: name and quick-action icons (favorite, home, alerts, suggest changes).
- **Search box**: type to filter; favorites first, then the rest sorted by distance.
- **📍 Locate button**: uses geolocation so distances are measured from your real position.
- **Radius**: search radius (10–300 km).
- Per result row:
  - **★ / ☆** add/remove favorite.
  - **👑 / ♛** set as "home" (appears first and loads by default).
  - **🔔 / 🔕** enable/disable ideal-condition alerts.
  - **+** propose a new takeoff (stations not yet registered in the community).
  - **✎** edit / suggest changes for a community takeoff.

## 3. Languages

SVG flag selector with six languages: Spanish, English, German, French, Catalan and Basque. Choice is saved and synced with your account.

## 4. Account and favorites

"👤" button. You can:

- Sign in with Google, email/password or magic link (passwordless).
- Create an account, or use guest (anonymous) mode.
- Favorites, home takeoff, language, radius and history-window preferences are stored in the cloud.

## 5. Ideal-condition alerts

Enable 🔔 on a favorite and the app periodically checks its conditions and notifies you when they match (direction + wind within criteria). Browser notification permission required.

## 6. Proposing / editing takeoffs (community)

Any signed-in user can:

- **Propose a takeoff** from the search panel or via ✎ on the current takeoff.
- Provide **name, coordinates, altitude, linked Pioupiou station, flyable orientations and notes**.
- Define **criteria**: per-direction (ideal/flyable/bad) using the compass rose, plus numeric ranges (min, max, gusts).
- An admin reviews and approves/rejects.
- Once approved everyone sees it in the search list (with the Community badge) and can use it as the active takeoff with its own criteria.

## 7. Orientation button 🧭

If the device supports it, rotates the compass with the phone's heading (useful on the field).

## 8. PWA install

Tap 📲 (when available) to install the app and use it offline. The service worker caches HTML/CSS/JS; live data always hits the network.

## 9. Data sources

- **Pioupiou** (`api.pioupiou.fr`): community wind stations, live and archive.
- **FFVL** (`data.ffvl.fr`): French balises.
- **Open‑Meteo**: hourly and daily forecast.
- **AviationWeather.gov (NOAA)**: nearby airport METAR.
- **Firebase**: auth, favorites, community takeoffs.

## 10. Limitations & disclaimer

- Data is indicative. **Always assess conditions on site** before flying.
- Open‑Meteo forecast doesn't model local orography in detail.
- Notifications can be delayed when the tab is closed (browser/OS dependent).
- **Storm risk**: shown as a 0–100 % score from CAPE, precipitation probability and WMO weather code. Levels: **none** < 25 %, **low** ≥ 25 %, **medium** ≥ 50 %, **high** ≥ 75 %. It's an estimate — always check official bulletins.
- **Night forecast**: hours between sunset and sunrise are skipped both in the summary and the chart (a 🌙 Night separator is shown).

---

Repository: https://github.com/rcuevasuskar/parapente-cenes
