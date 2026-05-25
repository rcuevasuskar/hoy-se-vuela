# Hoy se vuela — Documentation

Web app (PWA) for live wind, forecasts and flight criteria for paragliding. Designed for Cenes de la Vega but extensible to any community takeoff.

URL: https://rcuevasuskar.github.io/hoy-se-vuela/

---

## 1. Main dashboard

At a glance you see the state of the currently selected takeoff:

- **Main compass**: a ring split into 16 sectors (one per wind-rose direction) colored according to the takeoff criteria — <span style="color:#2ecc71">**green**</span> = ideal directions, <span style="color:#f1c40f">**yellow**</span> = flyable and <span style="color:#e74c3c">**red**</span> = not recommended. An **arrow** on top points to where the live wind is coming from, and the number in the center is the current average speed (km/h). If the device supports it, the 🧭 button rotates the whole compass with the phone's real heading.
- **Vertical speed bar** (next to the compass): a wind "anemometer" of the current average. The background is split into green / yellow / red zones matching the average-speed ranges defined for that takeoff, and the filled bar rises to the live value. At a glance you tell if intensity is optimal, marginal or too strong.
- **Average / gust / minimum** speed and last update time.
- **Wind history** for the last 2/4/6 h (configurable): each bar is one hour, with direction arrow and color by speed.
- **Open‑Meteo forecast** (today / +24 h). The chart includes:
  - a **horizontal green band** showing the ideal average-speed range,
  - a **mini wind-rose overlay** at the top-left with the same green/yellow/red sectors as the takeoff (no arrow), to cross-check forecast direction vs. criterion,
  - **day separators** and skipping of night hours (🌙).
- **Best window**: detects up to two daytime intervals where direction, average wind and gusts all fall in the ideal (green) zone. If no green slot exists, falls back to the best merely-flyable interval.
- **Nearby stations**: mini-compass cards with other stations (Pioupiou, FFVL, Holfuy, AEMET) and METAR airports within the adaptive radius. To avoid clustering many close AEMET stations, the app **prioritizes non-AEMET stations first** by proximity and then fills up to 8 slots with AEMET using a *farthest-first* algorithm (most spread out from those already picked).
- **Past-days comparison** (1, 7, 30 days) at the same hour.
- **Quick guide**: list of ideal / flyable / bad directions, wind range and max gusts, plus the takeoff's **notes** if any.
- **Map** with the takeoff position.
- **↻ Refresh button** (header): manually reloads live observations, forecast, past-days comparison and nearby stations, without touching the session or the current takeoff.

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

The app is **collaborative**: any signed-in user can contribute and improve the information of any takeoff. This covers both basic data and the technical criteria that feed the compass and the wind bar.

- **Propose a new takeoff** with the **+** button in the search box (useful when a station isn't yet registered in the community).
- **Suggest changes** for an existing takeoff with the **✎** button next to the current takeoff title.
- Editable fields: **name, coordinates, altitude, linked station (Pioupiou/Holfuy/AEMET), flyable orientations, wind ranges (min, max, gusts), club, web and free-form notes**.
- Define **directional criteria** by tagging each of the 16 directions as *ideal / flyable / bad* on a wind rose. These criteria drive the colored sectors of the main compass, the mini wind-rose on the forecast chart and the nearby-station cards.
- An admin reviews and approves/rejects.
- Once approved everyone sees it in the search list (with the Community badge) and can use it as the active takeoff with its own criteria.

## 7. Orientation button 🧭

If the device supports it, rotates the compass with the phone's heading (useful on the field).

## 8. PWA install

Tap 📲 (when available) to install the app and use it offline. The service worker caches HTML/CSS/JS; live data always hits the network.

## 9. Data sources

- **Pioupiou** (`api.pioupiou.fr`): community wind stations, live and archive.
- **FFVL** (`data.ffvl.fr`): French balises.
- **Holfuy** (`api.holfuy.com`): European Holfuy stations.
- **AEMET** (`opendata.aemet.es`): Spain's official weather stations. Decoded as `iso-8859-15` to preserve accented station names.
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

Repository: https://github.com/rcuevasuskar/hoy-se-vuela
