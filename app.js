// === Configuración ===
const DEFAULT_STATION = {
  id: 1638,
  provider: "pioupiou",
  name: "Despegue Cerro de los Majojos",
  shortName: "Cenes de la Vega",
  lat: 37.1406,
  lon: -3.5124,
};
let currentStation = loadSavedStation() || { ...DEFAULT_STATION };
// Compat: alias mutables usados en el resto del código
let currentStationId = currentStation.id;
let currentTakeoff = { lat: currentStation.lat, lon: currentStation.lon, name: currentStation.name };

// Despegues con criterios de volabilidad ya definidos.
// Hasta definir el resto, sólo estos serán seleccionables en el buscador.
const ENABLED_STATION_IDS = new Set([1638]);

const API_BASE = "https://api.pioupiou.fr/v1";
const CORS_PROXY = "https://corsproxy.io/?";

function loadSavedStation() {
  try {
    const raw = localStorage.getItem("selectedStation");
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && s.id && s.lat != null && s.lon != null) return s;
  } catch {}
  return null;
}
function saveSelectedStation(s) {
  try { localStorage.setItem("selectedStation", JSON.stringify(s)); } catch {}
}

const REFRESH_MS = 60_000;
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000; // no avisar más de 1 vez cada 30 min

// === i18n ===
const I18N = {
  es: {
    "app.title": "Viento Cenes de la Vega · Parapente",
    "header.h1": "🪂 Viento en Cenes de la Vega",
    "header.subtitle": "Despegue de parapente · Estación",
    "btn.install": "📲 Instalar app",
    "btn.notify_off": "🔔 Avisarme si hay condiciones ideales",
    "btn.notify_on": "🔕 Avisos activados",
    "status.title": "Estado actual",
    "card.n": "N", "card.e": "E", "card.s": "S", "card.w": "O",
    "read.avg": "Velocidad media",
    "read.max": "Racha máx.",
    "read.min": "Mínima",
    "read.last": "Última lectura",
    "read.dir": "Dirección",
    "verdict.loading": "Cargando…",
    "verdict.ideal.title": "Condiciones ideales ✅",
    "verdict.ideal.detail": "Buena dirección y velocidad en el rango óptimo.",
    "verdict.ok.title": "Volable ⚠️",
    "verdict.ok.detail": "Aceptable pero no óptimo. Valora con criterio.",
    "verdict.bad.title": "Dirección desfavorable ❌",
    "verdict.bad.detail": "Componente este: viento entrando por detrás o cruzado.",
    "verdict.warn.title": "Viento demasiado fuerte 🚫",
    "verdict.warn.detail": "Velocidad o rachas por encima del límite seguro.",
    "verdict.unknown.title": "Sin datos",
    "verdict.unknown.detail": "No se pueden valorar las condiciones.",
    "verdict.suffix": "Dirección: {name}. Media {avg} km/h, racha {max} km/h.",
    "dirLabel.from": "Dirección: {name} ({deg}°)",
    "dirLabel.dash": "—",
    "hist.title": "Evolución observada",
    "hist.legend": "Línea azul: velocidad media · Línea roja: racha máx · Flechas: dirección (color = aptitud)",
    "chart.avg": "Velocidad media (km/h)",
    "chart.gust": "Racha máx (km/h)",
    "chart.dir": "Dirección",
    "chart.dir_tooltip": "Dir: {name} ({deg}°)",
    "fc.title": "Pronóstico (Open-Meteo)",
    "fc.today": "Hoy",
    "cmp.title": "Comparativa últimos días",
    "cmp.window": "({h1}:00–{h2}:00 local)",
    "cmp.window_solar": "(amanecer +3 h → ocaso −1 h)",
    "cmp.yesterday": "Ayer",
    "cmp.days_ago": "Hace {n} días",
    "cmp.no_data": "Sin datos",
    "cmp.row.avg": "Media",
    "cmp.row.max": "Racha máx",
    "cmp.row.dir": "Dirección dom.",
    "cmp.row.state": "Estado",
    "cmp.legend": "Misma franja horaria actual (±2 h) en los últimos 3 días.",
    "near.title": "Estaciones cercanas",
    "near.radius": "radio 50 km",
    "near.none": "No hay otras estaciones Pioupiou activas dentro de 50 km.",
    "near.error": "Error al cargar estaciones cercanas.",
    "near.network_prefix": "Red",
    "near.legend_suffix": "Solo dirección e intensidad media de las últimas horas; cada estación tiene sus propios criterios de volabilidad.",
    "near.avg_unit": "km/h · media {h} h",
    "near.popup_last": "última",
    "near.popup_view": "Ver estación",
    "map.title": "Ubicación del despegue",
    "guide.title": "Guía rápida",
    "guide.for": "Criterios para",
    "guide.ideal": "<strong>Ideal:</strong> Oeste (O) o Noroeste (NO), 5–15 km/h (rachas ≤ 25).",
    "guide.ok": "<strong>Volable:</strong> Norte (N) o Suroeste (SO), o vientos fuera del rango ideal pero por debajo del límite.",
    "guide.bad": "<strong>Malo:</strong> componentes Este (NE, E, SE) — empeora cuanto más al Este.",
    "guide.warn": "<strong>Demasiado fuerte:</strong> media ≥ 20 km/h o rachas ≥ 30 km/h.",
    "loading": "Cargando…",
    "footer": 'Datos en tiempo real: <a href="https://developers.pioupiou.fr/" target="_blank" rel="noopener">api.pioupiou.fr</a> · Pronóstico: <a href="https://open-meteo.com/" target="_blank" rel="noopener">open-meteo.com</a> · Mapa: © OpenStreetMap. No oficial. Valora siempre las condiciones in situ.',
    "notify.title": "🪂 ¡Condiciones ideales en Cenes!",
    "notify.unsupported": "Tu navegador no soporta notificaciones.",
    "notify.denied": "Permiso de notificaciones denegado.",
    "error.fetch": "Error al consultar datos",
    "popup.takeoff_sub": "Cenes de la Vega",
    "wx.clouds": "Nubes",
    "wx.precip": "Prob. lluvia",
    "wx.storm": "Tormenta",
    "wx.storm_risk": "Riesgo de tormenta",
    "wx.storm_level.low":  "bajo",
    "wx.storm_level.med":  "medio",
    "wx.storm_level.high": "alto",
    "wx.temp": "Temp.",
    "wx.feels": "sens. {v}°",
    "best.label": "Mejor ventana hoy:",
    "best.label_tomorrow": "Mejor ventana mañana:",
    "best.none": "Sin ventanas óptimas en las próximas 12 h.",
    "best.ideal": "✅ Ideal",
    "best.ok": "⚠️ Volable",
    "near.airport_label": "Aeropuerto de Granada (LEGR)",
    "near.airport_prefix": "Aeropuerto",
    "near.airport_src": "Open-Meteo (METAR aprox.)",
    "banner.title": "Despegue de parapente de Cenes de la Vega",
    "ts.placeholder": "Buscar despegue / estación…",
    "ts.current": "Despegue:",
    "ts.radius": "Radio",
    "ts.locate": "Usar mi ubicación",
    "ts.hint": "Pulsa 📍 para usar tu ubicación o escribe para filtrar.",
    "ts.loading": "Cargando estaciones…",
    "ts.empty": "No hay estaciones activas en este radio.",
    "ts.geo_denied": "No se pudo obtener tu ubicación. Permiso denegado.",
    "ts.geo_unavailable": "Geolocalización no disponible en este dispositivo.",
    "wh.title": "Últimas 2 h (km/h)",
    "wh.titleFmt": "Últimas {h} h (km/h)",
    "wh.legend": "flecha = hacia dónde sopla · altura = velocidad",
    "ts.coming_soon": "próximamente",
    "verdict.rain_suffix": "Probabilidad de precipitación significativa.",
    "verdict.speed.calm": "Viento muy flojo, prácticamente en calma.",
    "verdict.speed.low": "Viento por debajo del rango ideal (<5 km/h).",
    "verdict.speed.high": "Viento por encima del rango ideal (>15 km/h).",
    "verdict.speed.too_high_avg": "Velocidad media demasiado alta (≥20 km/h).",
    "verdict.speed.too_high_gust": "Rachas demasiado fuertes (≥30 km/h).",
    "verdict.storm_suffix": "Hay riesgo de tormenta: no volar.",
    "wx.code.clear": "Despejado",
    "wx.code.mostly_clear": "Casi despejado",
    "wx.code.partly": "Parcialmente nublado",
    "wx.code.overcast": "Cubierto",
    "wx.code.fog": "Niebla",
    "wx.code.drizzle": "Llovizna",
    "wx.code.rain": "Lluvia",
    "wx.code.rain_heavy": "Lluvia fuerte",
    "wx.code.snow": "Nieve",
    "wx.code.showers": "Chubascos",
    "wx.code.showers_heavy": "Chubascos fuertes",
    "wx.code.snow_showers": "Chubascos de nieve",
    "wx.code.storm": "Tormenta",
    "wx.code.storm_hail": "Tormenta con granizo",
    "cp.title": "Análisis de nubes",
    "cp.high": "Altas",
    "cp.mid":  "Medias",
    "cp.low":  "Bajas",
    "cp.base": "Base nube",
    "cp.stab": "Inestabilidad",
    "cp.none": "—",
    "cp.stab.stable": "Estable",
    "cp.stab.low":    "Débil",
    "cp.stab.mod":    "Moderada",
    "cp.stab.high":   "Alta",
    "cp.stab.extreme":"Extrema",
    "cp.type.high.cs": "Cirrostratos (velo, halo solar)",
    "cp.type.high.ci": "Cirros (filamentos, cristales de hielo)",
    "cp.type.high.cc": "Cirrocúmulos (aborregado fino)",
    "cp.type.mid.as":  "Altoestratos (capa gris, sol difuso)",
    "cp.type.mid.ac":  "Altocúmulos (cielo aborregado)",
    "cp.type.mid.acc": "Altocúmulos castellanus (inestabilidad en altura)",
    "cp.type.low.st":  "Estratos (capa baja gris, mal día)",
    "cp.type.low.cuh": "Cúmulos humilis (térmicas suaves)",
    "cp.type.low.cum": "Cúmulos mediocris (buenas térmicas)",
    "cp.type.low.sc":  "Estratocúmulos (capa con claros)",
    "cp.type.low.ns":  "Nimbostratos (lluvia continua)",
    "cp.type.low.tcu": "Towering Cúmulus (sobredesarrollo)",
    "cp.type.low.cb":  "Cumulonimbos (tormenta ⚠️)",
    "cp.sum.clear":   "Cielo limpio: térmicas azules posibles si hay sol.",
    "cp.sum.good":    "Cúmulos bien definidos: térmicas óptimas.",
    "cp.sum.weak":    "Nubes altas/medias filtran el sol: térmicas más débiles.",
    "cp.sum.stable":  "Atmósfera estable o cubierta baja: térmicas pobres.",
    "cp.sum.overdev": "Riesgo de sobredesarrollo: vigila evolución vertical.",
    "cp.sum.storm":   "⚠️ Peligro de tormenta/cumulonimbos: no volar.",
    "cp.sum.rain":    "Precipitación probable: vuelo descartado.",
    "locale": "es-ES"
  },
  en: {
    "app.title": "Wind at Cenes de la Vega · Paragliding",
    "header.h1": "🪂 Wind at Cenes de la Vega",
    "header.subtitle": "Paragliding takeoff · Station",
    "btn.install": "📲 Install app",
    "btn.notify_off": "🔔 Notify me when ideal",
    "btn.notify_on": "🔕 Alerts on",
    "status.title": "Current status",
    "card.n": "N", "card.e": "E", "card.s": "S", "card.w": "W",
    "read.avg": "Average speed",
    "read.max": "Max gust",
    "read.min": "Min",
    "read.last": "Last reading",
    "read.dir": "Direction",
    "verdict.loading": "Loading…",
    "verdict.ideal.title": "Ideal conditions ✅",
    "verdict.ideal.detail": "Good direction and speed within the optimal range.",
    "verdict.ok.title": "Flyable ⚠️",
    "verdict.ok.detail": "Acceptable but not optimal. Use your judgment.",
    "verdict.bad.title": "Unfavourable direction ❌",
    "verdict.bad.detail": "Easterly component: tail or cross wind on the takeoff.",
    "verdict.warn.title": "Wind too strong 🚫",
    "verdict.warn.detail": "Speed or gusts above the safe limit.",
    "verdict.unknown.title": "No data",
    "verdict.unknown.detail": "Conditions cannot be assessed.",
    "verdict.suffix": "Direction: {name}. Avg {avg} km/h, gust {max} km/h.",
    "dirLabel.from": "Direction: {name} ({deg}°)",
    "dirLabel.dash": "—",
    "hist.title": "Observed evolution",
    "hist.legend": "Blue line: average speed · Red line: max gust · Dots: direction (color = suitability)",
    "chart.avg": "Average speed (km/h)",
    "chart.gust": "Max gust (km/h)",
    "chart.dir": "Direction",
    "chart.dir_tooltip": "Dir: {name} ({deg}°)",
    "fc.title": "Forecast (Open-Meteo)",
    "fc.today": "Today",
    "cmp.title": "Last days comparison",
    "cmp.window": "({h1}:00–{h2}:00 local)",
    "cmp.window_solar": "(sunrise +3 h → sunset −1 h)",
    "cmp.yesterday": "Yesterday",
    "cmp.days_ago": "{n} days ago",
    "cmp.no_data": "No data",
    "cmp.row.avg": "Average",
    "cmp.row.max": "Max gust",
    "cmp.row.dir": "Dominant dir.",
    "cmp.row.state": "Status",
    "cmp.legend": "Same current time slot (±2 h) over the last 3 days.",
    "near.title": "Nearby stations",
    "near.radius": "50 km radius",
    "near.none": "No other active Pioupiou stations within 50 km.",
    "near.error": "Failed to load nearby stations.",
    "near.network_prefix": "Network",
    "near.legend_suffix": "Only direction and average intensity from the last few hours; each station has its own flyability criteria.",
    "near.avg_unit": "km/h · {h} h avg",
    "near.popup_last": "last",
    "near.popup_view": "View station",
    "map.title": "Takeoff location",
    "guide.title": "Quick guide",
    "guide.for": "Criteria for",
    "guide.ideal": "<strong>Ideal:</strong> West (W) or Northwest (NW), 5–15 km/h (gusts ≤ 25).",
    "guide.ok": "<strong>Flyable:</strong> North (N) or Southwest (SW), or winds outside the ideal range but below the limit.",
    "guide.bad": "<strong>Bad:</strong> Easterly components (NE, E, SE) — worse the further east.",
    "guide.warn": "<strong>Too strong:</strong> avg ≥ 20 km/h or gusts ≥ 30 km/h.",
    "loading": "Loading…",
    "footer": 'Real-time data: <a href="https://developers.pioupiou.fr/" target="_blank" rel="noopener">api.pioupiou.fr</a> · Forecast: <a href="https://open-meteo.com/" target="_blank" rel="noopener">open-meteo.com</a> · Map: © OpenStreetMap. Unofficial. Always assess conditions on site.',
    "notify.title": "🪂 Ideal conditions at Cenes!",
    "notify.unsupported": "Your browser does not support notifications.",
    "notify.denied": "Notification permission denied.",
    "error.fetch": "Failed to fetch data",
    "popup.takeoff_sub": "Cenes de la Vega",
    "wx.clouds": "Clouds",
    "wx.precip": "Rain prob.",
    "wx.storm": "Storm",
    "wx.storm_risk": "Storm risk",
    "wx.storm_level.low":  "low",
    "wx.storm_level.med":  "medium",
    "wx.storm_level.high": "high",
    "wx.temp": "Temp.",
    "wx.feels": "feels {v}°",
    "best.label": "Best window today:",
    "best.label_tomorrow": "Best window tomorrow:",
    "best.none": "No optimal windows in the next 12 h.",
    "best.ideal": "✅ Ideal",
    "best.ok": "⚠️ Flyable",
    "near.airport_label": "Granada Airport (LEGR)",
    "near.airport_prefix": "Airport",
    "near.airport_src": "Open-Meteo (approx. METAR)",
    "banner.title": "Paragliding takeoff of Cenes de la Vega",
    "ts.placeholder": "Search takeoff / station…",
    "ts.current": "Takeoff:",
    "ts.radius": "Radius",
    "ts.locate": "Use my location",
    "ts.hint": "Tap 📍 to use your location or type to filter.",
    "ts.loading": "Loading stations…",
    "ts.empty": "No active stations within this radius.",
    "ts.geo_denied": "Could not get your location. Permission denied.",
    "ts.geo_unavailable": "Geolocation not available on this device.",
    "wh.title": "Last 2 h (km/h)",
    "wh.titleFmt": "Last {h} h (km/h)",
    "wh.legend": "arrow = where the wind blows to · height = speed",
    "ts.coming_soon": "coming soon",
    "verdict.rain_suffix": "Significant precipitation probability.",
    "verdict.speed.calm": "Wind is very light, almost calm.",
    "verdict.speed.low": "Wind below the ideal range (<5 km/h).",
    "verdict.speed.high": "Wind above the ideal range (>15 km/h).",
    "verdict.speed.too_high_avg": "Average wind too high (≥20 km/h).",
    "verdict.speed.too_high_gust": "Gusts too strong (≥30 km/h).",
    "verdict.storm_suffix": "Thunderstorm risk: do not fly.",
    "wx.code.clear": "Clear",
    "wx.code.mostly_clear": "Mostly clear",
    "wx.code.partly": "Partly cloudy",
    "wx.code.overcast": "Overcast",
    "wx.code.fog": "Fog",
    "wx.code.drizzle": "Drizzle",
    "wx.code.rain": "Rain",
    "wx.code.rain_heavy": "Heavy rain",
    "wx.code.snow": "Snow",
    "wx.code.showers": "Showers",
    "wx.code.showers_heavy": "Heavy showers",
    "wx.code.snow_showers": "Snow showers",
    "wx.code.storm": "Thunderstorm",
    "wx.code.storm_hail": "Thunderstorm with hail",
    "locale": "en-GB",
    "cp.title": "Cloud analysis",
    "cp.high": "High",
    "cp.mid":  "Mid",
    "cp.low":  "Low",
    "cp.base": "Cloud base",
    "cp.stab": "Instability",
    "cp.none": "—",
    "cp.stab.stable": "Stable",
    "cp.stab.low":    "Weak",
    "cp.stab.mod":    "Moderate",
    "cp.stab.high":   "High",
    "cp.stab.extreme":"Extreme",
    "cp.type.high.cs": "Cirrostratus (veil, solar halo)",
    "cp.type.high.ci": "Cirrus (ice-crystal wisps)",
    "cp.type.high.cc": "Cirrocumulus (fine mackerel sky)",
    "cp.type.mid.as":  "Altostratus (grey sheet, diffuse sun)",
    "cp.type.mid.ac":  "Altocumulus (mackerel sky)",
    "cp.type.mid.acc": "Altocumulus castellanus (upper instability)",
    "cp.type.low.st":  "Stratus (low grey layer, poor day)",
    "cp.type.low.cuh": "Cumulus humilis (soft thermals)",
    "cp.type.low.cum": "Cumulus mediocris (good thermals)",
    "cp.type.low.sc":  "Stratocumulus (broken layer)",
    "cp.type.low.ns":  "Nimbostratus (steady rain)",
    "cp.type.low.tcu": "Towering Cumulus (overdevelopment)",
    "cp.type.low.cb":  "Cumulonimbus (thunderstorm ⚠️)",
    "cp.sum.clear":   "Clear sky: blue thermals possible if sun strong.",
    "cp.sum.good":    "Well-formed cumulus: optimal thermals.",
    "cp.sum.weak":    "High/mid clouds filter sun: weaker thermals.",
    "cp.sum.stable":  "Stable air or low overcast: poor thermals.",
    "cp.sum.overdev": "Overdevelopment risk: watch vertical growth.",
    "cp.sum.storm":   "⚠️ Thunderstorm / Cb risk: do not fly.",
    "cp.sum.rain":    "Rain likely: no-fly."
  },
  de: {
    "app.title": "Wind in Cenes de la Vega · Gleitschirm",
    "header.h1": "🪂 Wind in Cenes de la Vega",
    "header.subtitle": "Gleitschirm-Startplatz · Station",
    "btn.install": "📲 App installieren",
    "btn.notify_off": "🔔 Benachrichtigen bei idealen Bedingungen",
    "btn.notify_on": "🔕 Benachrichtigungen an",
    "status.title": "Aktueller Zustand",
    "card.n": "N", "card.e": "O", "card.s": "S", "card.w": "W",
    "read.avg": "Durchschnittsgeschwindigkeit",
    "read.max": "Max. Böe",
    "read.min": "Minimum",
    "read.last": "Letzte Messung",
    "read.dir": "Richtung",
    "verdict.loading": "Lädt…",
    "verdict.ideal.title": "Ideale Bedingungen ✅",
    "verdict.ideal.detail": "Gute Richtung und Geschwindigkeit im optimalen Bereich.",
    "verdict.ok.title": "Fliegbar ⚠️",
    "verdict.ok.detail": "Akzeptabel, aber nicht optimal. Mit Urteilsvermögen prüfen.",
    "verdict.bad.title": "Ungünstige Richtung ❌",
    "verdict.bad.detail": "Östliche Komponente: Rück- oder Seitenwind am Startplatz.",
    "verdict.warn.title": "Wind zu stark 🚫",
    "verdict.warn.detail": "Geschwindigkeit oder Böen über dem sicheren Grenzwert.",
    "verdict.unknown.title": "Keine Daten",
    "verdict.unknown.detail": "Bedingungen können nicht bewertet werden.",
    "verdict.suffix": "Richtung: {name}. Mittel {avg} km/h, Böe {max} km/h.",
    "dirLabel.from": "Richtung: {name} ({deg}°)",
    "dirLabel.dash": "—",
    "hist.title": "Beobachteter Verlauf",
    "hist.legend": "Blaue Linie: Mittelgeschwindigkeit · Rote Linie: max. Böe · Punkte: Richtung (Farbe = Eignung)",
    "chart.avg": "Mittelgeschwindigkeit (km/h)",
    "chart.gust": "Max. Böe (km/h)",
    "chart.dir": "Richtung",
    "chart.dir_tooltip": "Richt.: {name} ({deg}°)",
    "fc.title": "Vorhersage (Open-Meteo)",
    "fc.today": "Heute",
    "cmp.title": "Vergleich letzter Tage",
    "cmp.window": "({h1}:00–{h2}:00 Ortszeit)",
    "cmp.window_solar": "(Sonnenaufgang +3 h → Sonnenuntergang −1 h)",
    "cmp.yesterday": "Gestern",
    "cmp.days_ago": "Vor {n} Tagen",
    "cmp.no_data": "Keine Daten",
    "cmp.row.avg": "Mittel",
    "cmp.row.max": "Max. Böe",
    "cmp.row.dir": "Dom. Richtung",
    "cmp.row.state": "Status",
    "cmp.legend": "Gleiches Zeitfenster wie aktuell (±2 h) in den letzten 3 Tagen.",
    "near.title": "Stationen in der Nähe",
    "near.radius": "50 km Radius",
    "near.none": "Keine weiteren aktiven Pioupiou-Stationen innerhalb von 50 km.",
    "near.error": "Fehler beim Laden der nahegelegenen Stationen.",
    "near.network_prefix": "Netz",
    "near.legend_suffix": "Nur Richtung und mittlere Stärke der letzten Stunden; jede Station hat eigene Flugkriterien.",
    "near.avg_unit": "km/h · Ø {h} h",
    "near.popup_last": "letzte",
    "near.popup_view": "Station ansehen",
    "map.title": "Standort des Startplatzes",
    "guide.title": "Kurzanleitung",
    "guide.for": "Kriterien für",
    "guide.ideal": "<strong>Ideal:</strong> West (W) oder Nordwest (NW), 5–15 km/h (Böen ≤ 25).",
    "guide.ok": "<strong>Fliegbar:</strong> Nord (N) oder Südwest (SW), oder Wind außerhalb des Idealbereichs aber unter dem Limit.",
    "guide.bad": "<strong>Schlecht:</strong> Ostkomponenten (NO, O, SO) — schlechter je östlicher.",
    "guide.warn": "<strong>Zu stark:</strong> Mittel ≥ 20 km/h oder Böen ≥ 30 km/h.",
    "loading": "Lädt…",
    "footer": 'Echtzeitdaten: <a href="https://developers.pioupiou.fr/" target="_blank" rel="noopener">api.pioupiou.fr</a> · Vorhersage: <a href="https://open-meteo.com/" target="_blank" rel="noopener">open-meteo.com</a> · Karte: © OpenStreetMap. Inoffiziell. Bedingungen immer vor Ort bewerten.',
    "notify.title": "🪂 Ideale Bedingungen in Cenes!",
    "notify.unsupported": "Ihr Browser unterstützt keine Benachrichtigungen.",
    "notify.denied": "Benachrichtigungserlaubnis verweigert.",
    "error.fetch": "Datenabruf fehlgeschlagen",
    "popup.takeoff_sub": "Cenes de la Vega",
    "wx.clouds": "Wolken",
    "wx.precip": "Regenwahrsch.",
    "wx.storm": "Gewitter",
    "wx.storm_risk": "Gewittergefahr",
    "wx.storm_level.low":  "gering",
    "wx.storm_level.med":  "mittel",
    "wx.storm_level.high": "hoch",
    "wx.temp": "Temp.",
    "wx.feels": "gefühlt {v}°",
    "best.label": "Beste Zeit heute:",
    "best.label_tomorrow": "Beste Zeit morgen:",
    "best.none": "Keine optimalen Fenster in den nächsten 12 h.",
    "best.ideal": "✅ Ideal",
    "best.ok": "⚠️ Fliegbar",
    "near.airport_label": "Flughafen Granada (LEGR)",
    "near.airport_prefix": "Flughafen",
    "near.airport_src": "Open-Meteo (ca. METAR)",
    "banner.title": "Gleitschirm-Startplatz von Cenes de la Vega",
    "ts.placeholder": "Startplatz / Station suchen…",
    "ts.current": "Startplatz:",
    "ts.radius": "Radius",
    "ts.locate": "Meinen Standort verwenden",
    "ts.hint": "📍 tippen, um deinen Standort zu nutzen, oder filtern.",
    "ts.loading": "Stationen werden geladen…",
    "ts.empty": "Keine aktiven Stationen in diesem Radius.",
    "ts.geo_denied": "Standort nicht verfügbar. Berechtigung verweigert.",
    "ts.geo_unavailable": "Geolokalisierung auf diesem Gerät nicht verfügbar.",
    "wh.title": "Letzte 2 h (km/h)",
    "wh.titleFmt": "Letzte {h} h (km/h)",
    "wh.legend": "Pfeil = Windrichtung (wohin) · Höhe = Geschwindigkeit",
    "ts.coming_soon": "in Kürze",
    "verdict.rain_suffix": "Erhebliche Niederschlagswahrscheinlichkeit.",
    "verdict.speed.calm": "Wind sehr schwach, fast Windstille.",
    "verdict.speed.low": "Wind unter dem Idealbereich (<5 km/h).",
    "verdict.speed.high": "Wind über dem Idealbereich (>15 km/h).",
    "verdict.speed.too_high_avg": "Durchschnittswind zu hoch (≥20 km/h).",
    "verdict.speed.too_high_gust": "Böen zu stark (≥30 km/h).",
    "verdict.storm_suffix": "Gewittergefahr: nicht fliegen.",
    "wx.code.clear": "Klar",
    "wx.code.mostly_clear": "Überwiegend klar",
    "wx.code.partly": "Teilweise bewölkt",
    "wx.code.overcast": "Bedeckt",
    "wx.code.fog": "Nebel",
    "wx.code.drizzle": "Nieselregen",
    "wx.code.rain": "Regen",
    "wx.code.rain_heavy": "Starker Regen",
    "wx.code.snow": "Schnee",
    "wx.code.showers": "Schauer",
    "wx.code.showers_heavy": "Starke Schauer",
    "wx.code.snow_showers": "Schneeschauer",
    "wx.code.storm": "Gewitter",
    "wx.code.storm_hail": "Gewitter mit Hagel",
    "locale": "de-DE",
    "cp.title": "Wolkenanalyse",
    "cp.high": "Hoch",
    "cp.mid":  "Mittel",
    "cp.low":  "Tief",
    "cp.base": "Wolkenbasis",
    "cp.stab": "Instabilität",
    "cp.none": "—",
    "cp.stab.stable": "Stabil",
    "cp.stab.low":    "Schwach",
    "cp.stab.mod":    "Mäßig",
    "cp.stab.high":   "Hoch",
    "cp.stab.extreme":"Extrem",
    "cp.type.high.cs": "Cirrostratus (Schleier, Sonnenhalo)",
    "cp.type.high.ci": "Cirrus (Eiskristall-Fäden)",
    "cp.type.high.cc": "Cirrocumulus (feines Schafüben)",
    "cp.type.mid.as":  "Altostratus (graue Schicht, diffuse Sonne)",
    "cp.type.mid.ac":  "Altocumulus (Schafüben)",
    "cp.type.mid.acc": "Altocumulus castellanus (Höheninstabilität)",
    "cp.type.low.st":  "Stratus (tiefe graue Schicht, schlechter Tag)",
    "cp.type.low.cuh": "Cumulus humilis (weiche Thermik)",
    "cp.type.low.cum": "Cumulus mediocris (gute Thermik)",
    "cp.type.low.sc":  "Stratocumulus (aufgerissene Schicht)",
    "cp.type.low.ns":  "Nimbostratus (Dauerregen)",
    "cp.type.low.tcu": "Towering Cumulus (Überentwicklung)",
    "cp.type.low.cb":  "Cumulonimbus (Gewitter ⚠️)",
    "cp.sum.clear":   "Klarer Himmel: blaue Thermik möglich bei Sonne.",
    "cp.sum.good":    "Schön geformte Cumulus: optimale Thermik.",
    "cp.sum.weak":    "Hohe/mittlere Wolken filtern Sonne: schwächere Thermik.",
    "cp.sum.stable":  "Stabile Luft oder tiefe Bedeckung: schwache Thermik.",
    "cp.sum.overdev": "Überentwicklungsrisiko: Vertikalwachstum beobachten.",
    "cp.sum.storm":   "⚠️ Gewitter/Cb-Risiko: nicht fliegen.",
    "cp.sum.rain":    "Regen wahrscheinlich: Flug abgesagt."
  },
  fr: {
    "app.title": "Vent à Cenes de la Vega · Parapente",
    "header.h1": "🪂 Vent à Cenes de la Vega",
    "header.subtitle": "Décollage parapente · Station",
    "btn.install": "📲 Installer l'app",
    "btn.notify_off": "🔔 Me prévenir si conditions idéales",
    "btn.notify_on": "🔕 Alertes activées",
    "status.title": "État actuel",
    "card.n": "N", "card.e": "E", "card.s": "S", "card.w": "O",
    "read.avg": "Vitesse moyenne",
    "read.max": "Rafale max.",
    "read.min": "Minimum",
    "read.last": "Dernière mesure",
    "read.dir": "Direction",
    "verdict.loading": "Chargement…",
    "verdict.ideal.title": "Conditions idéales ✅",
    "verdict.ideal.detail": "Bonne direction et vitesse dans la plage optimale.",
    "verdict.ok.title": "Volable ⚠️",
    "verdict.ok.detail": "Acceptable mais non optimal. À évaluer avec discernement.",
    "verdict.bad.title": "Direction défavorable ❌",
    "verdict.bad.detail": "Composante est : vent arrière ou de travers au décollage.",
    "verdict.warn.title": "Vent trop fort 🚫",
    "verdict.warn.detail": "Vitesse ou rafales au-dessus de la limite sûre.",
    "verdict.unknown.title": "Pas de données",
    "verdict.unknown.detail": "Conditions impossibles à évaluer.",
    "verdict.suffix": "Direction : {name}. Moy. {avg} km/h, rafale {max} km/h.",
    "dirLabel.from": "Direction : {name} ({deg}°)",
    "dirLabel.dash": "—",
    "hist.title": "Évolution observée",
    "hist.legend": "Ligne bleue : vitesse moyenne · Ligne rouge : rafale max · Points : direction (couleur = aptitude)",
    "chart.avg": "Vitesse moyenne (km/h)",
    "chart.gust": "Rafale max (km/h)",
    "chart.dir": "Direction",
    "chart.dir_tooltip": "Dir : {name} ({deg}°)",
    "fc.title": "Prévision (Open-Meteo)",
    "fc.today": "Aujourd'hui",
    "cmp.title": "Comparatif derniers jours",
    "cmp.window": "({h1}:00–{h2}:00 local)",
    "cmp.window_solar": "(lever +3 h → coucher −1 h)",
    "cmp.yesterday": "Hier",
    "cmp.days_ago": "Il y a {n} jours",
    "cmp.no_data": "Pas de données",
    "cmp.row.avg": "Moyenne",
    "cmp.row.max": "Rafale max",
    "cmp.row.dir": "Dir. dom.",
    "cmp.row.state": "État",
    "cmp.legend": "Même créneau horaire actuel (±2 h) sur les 3 derniers jours.",
    "near.title": "Stations proches",
    "near.radius": "rayon 50 km",
    "near.none": "Aucune autre station Pioupiou active dans un rayon de 50 km.",
    "near.error": "Échec du chargement des stations proches.",
    "near.network_prefix": "Réseau",
    "near.legend_suffix": "Seulement direction et intensité moyenne des dernières heures ; chaque station a ses propres critères de volabilité.",
    "near.avg_unit": "km/h · moy. {h} h",
    "near.popup_last": "dernière",
    "near.popup_view": "Voir la station",
    "map.title": "Emplacement du décollage",
    "guide.title": "Guide rapide",
    "guide.for": "Critères pour",
    "guide.ideal": "<strong>Idéal :</strong> Ouest (O) ou Nord-Ouest (NO), 5–15 km/h (rafales ≤ 25).",
    "guide.ok": "<strong>Volable :</strong> Nord (N) ou Sud-Ouest (SO), ou vents hors plage idéale mais sous la limite.",
    "guide.bad": "<strong>Mauvais :</strong> composantes Est (NE, E, SE) — pire vers l'est.",
    "guide.warn": "<strong>Trop fort :</strong> moy. ≥ 20 km/h ou rafales ≥ 30 km/h.",
    "loading": "Chargement…",
    "footer": 'Données temps réel : <a href="https://developers.pioupiou.fr/" target="_blank" rel="noopener">api.pioupiou.fr</a> · Prévision : <a href="https://open-meteo.com/" target="_blank" rel="noopener">open-meteo.com</a> · Carte : © OpenStreetMap. Non officiel. Évaluez toujours les conditions sur site.',
    "notify.title": "🪂 Conditions idéales à Cenes !",
    "notify.unsupported": "Votre navigateur ne prend pas en charge les notifications.",
    "notify.denied": "Autorisation de notifications refusée.",
    "error.fetch": "Échec de récupération des données",
    "popup.takeoff_sub": "Cenes de la Vega",
    "wx.clouds": "Nuages",
    "wx.precip": "Prob. pluie",
    "wx.storm": "Orage",
    "wx.storm_risk": "Risque d'orage",
    "wx.storm_level.low":  "faible",
    "wx.storm_level.med":  "moyen",
    "wx.storm_level.high": "élevé",
    "wx.temp": "Temp.",
    "wx.feels": "ressenti {v}°",
    "best.label": "Meilleur créneau aujourd'hui :",
    "best.label_tomorrow": "Meilleur créneau demain :",
    "best.none": "Pas de créneau optimal dans les 12 h.",
    "best.ideal": "✅ Idéal",
    "best.ok": "⚠️ Volable",
    "near.airport_label": "Aéroport de Grenade (LEGR)",
    "near.airport_prefix": "Aéroport",
    "near.airport_src": "Open-Meteo (METAR approx.)",
    "banner.title": "Décollage parapente de Cenes de la Vega",
    "ts.placeholder": "Rechercher décollage / station…",
    "ts.current": "Décollage :",
    "ts.radius": "Rayon",
    "ts.locate": "Utiliser ma position",
    "ts.hint": "Appuyez sur 📍 pour utiliser votre position ou filtrez.",
    "ts.loading": "Chargement des stations…",
    "ts.empty": "Aucune station active dans ce rayon.",
    "ts.geo_denied": "Impossible d'obtenir votre position. Permission refusée.",
    "ts.geo_unavailable": "Géolocalisation non disponible sur cet appareil.",
    "wh.title": "2 dernières heures (km/h)",
    "wh.titleFmt": "{h} dernières heures (km/h)",
    "wh.legend": "flèche = vers où souffle le vent · hauteur = vitesse",
    "ts.coming_soon": "bientôt",
    "verdict.rain_suffix": "Probabilité significative de précipitations.",
    "verdict.speed.calm": "Vent très faible, presque calme.",
    "verdict.speed.low": "Vent en dessous de la plage idéale (<5 km/h).",
    "verdict.speed.high": "Vent au-dessus de la plage idéale (>15 km/h).",
    "verdict.speed.too_high_avg": "Vent moyen trop fort (≥20 km/h).",
    "verdict.speed.too_high_gust": "Rafales trop fortes (≥30 km/h).",
    "verdict.storm_suffix": "Risque d'orage : ne pas voler.",
    "wx.code.clear": "Dégagé",
    "wx.code.mostly_clear": "Plutôt dégagé",
    "wx.code.partly": "Partiellement nuageux",
    "wx.code.overcast": "Couvert",
    "wx.code.fog": "Brouillard",
    "wx.code.drizzle": "Bruine",
    "wx.code.rain": "Pluie",
    "wx.code.rain_heavy": "Pluie forte",
    "wx.code.snow": "Neige",
    "wx.code.showers": "Averses",
    "wx.code.showers_heavy": "Averses fortes",
    "wx.code.snow_showers": "Averses de neige",
    "wx.code.storm": "Orage",
    "wx.code.storm_hail": "Orage avec grêle",
    "locale": "fr-FR",
    "cp.title": "Analyse des nuages",
    "cp.high": "Hauts",
    "cp.mid":  "Moyens",
    "cp.low":  "Bas",
    "cp.base": "Base nuage",
    "cp.stab": "Instabilité",
    "cp.none": "—",
    "cp.stab.stable": "Stable",
    "cp.stab.low":    "Faible",
    "cp.stab.mod":    "Modérée",
    "cp.stab.high":   "Élevée",
    "cp.stab.extreme":"Extrême",
    "cp.type.high.cs": "Cirrostratus (voile, halo solaire)",
    "cp.type.high.ci": "Cirrus (filaments de glace)",
    "cp.type.high.cc": "Cirrocumulus (ciel moutonné fin)",
    "cp.type.mid.as":  "Altostratus (couche grise, soleil diffus)",
    "cp.type.mid.ac":  "Altocumulus (ciel moutonné)",
    "cp.type.mid.acc": "Altocumulus castellanus (instabilité en altitude)",
    "cp.type.low.st":  "Stratus (couche grise basse, mauvaise journée)",
    "cp.type.low.cuh": "Cumulus humilis (thermiques légères)",
    "cp.type.low.cum": "Cumulus mediocris (bonnes thermiques)",
    "cp.type.low.sc":  "Stratocumulus (couche fracturée)",
    "cp.type.low.ns":  "Nimbostratus (pluie continue)",
    "cp.type.low.tcu": "Towering Cumulus (surdéveloppement)",
    "cp.type.low.cb":  "Cumulonimbus (orage ⚠️)",
    "cp.sum.clear":   "Ciel dégagé : thermiques bleues possibles au soleil.",
    "cp.sum.good":    "Cumulus bien formés : thermiques optimales.",
    "cp.sum.weak":    "Nuages hauts/moyens filtrent le soleil : thermiques plus faibles.",
    "cp.sum.stable":  "Air stable ou couverture basse : thermiques pauvres.",
    "cp.sum.overdev": "Risque de surdéveloppement : surveiller la croissance verticale.",
    "cp.sum.storm":   "⚠️ Risque d’orage / Cb : ne pas voler.",
    "cp.sum.rain":    "Pluie probable : vol annulé."
  }
};

// Nomenclatura de 16 puntos por idioma (ES y FR usan O para Oeste, EN y DE usan W)
const DIR_16_BY_LANG = {
  es: ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"],
  en: ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"],
  de: ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"],
  fr: ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"]
};

let currentLang = (function() {
  const saved = localStorage.getItem("lang");
  if (saved && I18N[saved]) return saved;
  return "es";
})();

function t(key, vars) {
  const dict = I18N[currentLang] || I18N.es;
  let s = dict[key] != null ? dict[key] : (I18N.es[key] != null ? I18N.es[key] : key);
  if (vars) {
    for (const k in vars) s = s.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
  }
  return s;
}

function applyStaticI18n() {
  document.documentElement.lang = currentLang;
  document.title = t("app.title");
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.innerHTML = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });
}

// === Reglas de aptitud ===
// La nomenclatura de los puntos cardinales depende del idioma (ver DIR_16_BY_LANG).
// La aptitud se basa en la posición del sector (0=N, 4=E, 8=S, 12=W).
// Ideal: 12,13,14,15 (W..NNW). Ok: 0 (N), 10,11 (SW,WSW). Malo: resto.
const QUALITY_BY_INDEX = [
  "ok",   "bad", "bad", "bad",   // N, NNE, NE, ENE
  "bad",  "bad", "bad", "bad",   // E, ESE, SE, SSE
  "bad",  "ok",  "ok",  "ok",    // S, SSW, SW, WSW
  "ideal","ideal","ideal","ideal" // W, WNW, NW, NNW
];

function dirName(deg) {
  if (deg == null || isNaN(deg)) return "—";
  const arr = DIR_16_BY_LANG[currentLang] || DIR_16_BY_LANG.es;
  const d = ((deg % 360) + 360) % 360;
  return arr[Math.round(d / 22.5) % 16];
}

function classifyDirection(deg) {
  if (deg == null || isNaN(deg)) return { name: "—", quality: "unknown", deg: null };
  const d = ((deg % 360) + 360) % 360;
  const idx = Math.round(d / 22.5) % 16;
  return { name: dirName(d), quality: QUALITY_BY_INDEX[idx], deg: d };
}

function classifySpeed(avg, max) {
  if (avg == null) return "unknown";
  // Demasiado fuerte: media ≥ 20 km/h o rachas ≥ 30 km/h.
  if (avg >= 20 || (max != null && max >= 30)) return "warn";
  // Ideal: media entre 5 y 15 km/h con rachas hasta 25 km/h.
  if (avg >= 5 && avg <= 15 && (max == null || max <= 25)) return "ideal";
  // Resto: volable.
  return "ok";
}

// Devuelve una clave i18n explicando el motivo de velocidad, o null si no aplica.
function speedReasonKey(avg, max) {
  if (avg == null) return null;
  if (max != null && max >= 30) return "verdict.speed.too_high_gust";
  if (avg >= 20) return "verdict.speed.too_high_avg";
  if (avg < 3)   return "verdict.speed.calm";
  if (avg < 5)   return "verdict.speed.low";
  if (avg > 15)  return "verdict.speed.high";
  return null;
}

function combineVerdict(dirQ, spdQ) {
  if (dirQ === "unknown" || spdQ === "unknown") return "unknown";
  if (spdQ === "warn") return "warn";
  if (dirQ === "bad") return "bad";
  if (dirQ === "ideal" && spdQ === "ideal") return "ideal";
  if (dirQ === "ideal" && spdQ === "ok") return "ok";
  if (dirQ === "ok") return "ok";
  return "ok";
}

function verdictText(v) {
  return {
    title: t(`verdict.${v}.title`),
    detail: t(`verdict.${v}.detail`),
  };
}

// === Acceso a la API ===
async function fetchJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } catch (e) {
    const r = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!r.ok) throw new Error("HTTP " + r.status + " (proxy)");
    return await r.json();
  }
}

async function getLive() {
  const data = await fetchJson(`${API_BASE}/live/${currentStationId}`);
  return data?.data;
}

async function getArchive(startDate, stopDate) {
  const fmt = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const url = `${API_BASE}/archive/${currentStationId}?start=${fmt(startDate)}&stop=${fmt(stopDate)}`;
  const data = await fetchJson(url);
  return normalizeArchive(data?.data);
}

// La API de Pioupiou devuelve `data` como array de arrays:
// [time, latitude, longitude, wind_speed_min, wind_speed_avg, wind_speed_max, wind_heading, pressure]
// Lo convertimos a un objeto con columnas para que el resto del código pueda iterar fácilmente.
function normalizeArchive(raw) {
  const empty = { date: [], wind_speed_min: [], wind_speed_avg: [], wind_speed_max: [], wind_heading: [] };
  if (!raw) return empty;
  // Si ya viene en formato objeto (compatibilidad), úsalo tal cual
  if (!Array.isArray(raw) && raw.date) return raw;
  if (!Array.isArray(raw) || !raw.length) return empty;
  const out = { date: [], wind_speed_min: [], wind_speed_avg: [], wind_speed_max: [], wind_heading: [] };
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 7) continue;
    out.date.push(row[0]);
    out.wind_speed_min.push(row[3]);
    out.wind_speed_avg.push(row[4]);
    out.wind_speed_max.push(row[5]);
    out.wind_heading.push(row[6]);
  }
  return out;
}

async function getArchiveLastHours(hours) {
  const stop = new Date();
  const start = new Date(stop.getTime() - hours * 3600 * 1000);
  return getArchive(start, stop);
}

async function getForecast(days = 2) {
  // past_days=3 trae sunrise/sunset de los últimos 3 días (para la comparativa solar).
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentTakeoff.lat}&longitude=${currentTakeoff.lon}` +
              `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation_probability,weather_code,cape,lifted_index,temperature_2m,dew_point_2m,apparent_temperature` +
              `&daily=sunrise,sunset` +
              `&past_days=3` +
              `&wind_speed_unit=kmh&timezone=auto&forecast_days=${days}`;
  return fetchJson(url);
}

async function getAllStations() {
  const data = await fetchJson(`${API_BASE}/live-with-meta/all`);
  return data?.data || [];
}

// === Meteorología (WMO weather codes) ===
// https://open-meteo.com/en/docs WMO Weather interpretation codes
const WMO = {
  0:  { icon: "☀️", key: "wx.code.clear"        },
  1:  { icon: "🌤️", key: "wx.code.mostly_clear" },
  2:  { icon: "⛅",  key: "wx.code.partly"       },
  3:  { icon: "☁️",  key: "wx.code.overcast"     },
  45: { icon: "🌫️", key: "wx.code.fog"          },
  48: { icon: "🌫️", key: "wx.code.fog"          },
  51: { icon: "🌦️", key: "wx.code.drizzle"      },
  53: { icon: "🌦️", key: "wx.code.drizzle"      },
  55: { icon: "🌦️", key: "wx.code.drizzle"      },
  56: { icon: "🌦️", key: "wx.code.drizzle"      },
  57: { icon: "🌦️", key: "wx.code.drizzle"      },
  61: { icon: "🌧️", key: "wx.code.rain"         },
  63: { icon: "🌧️", key: "wx.code.rain"         },
  65: { icon: "🌧️", key: "wx.code.rain_heavy"   },
  66: { icon: "🌧️", key: "wx.code.rain"         },
  67: { icon: "🌧️", key: "wx.code.rain_heavy"   },
  71: { icon: "🌨️", key: "wx.code.snow"         },
  73: { icon: "🌨️", key: "wx.code.snow"         },
  75: { icon: "🌨️", key: "wx.code.snow"         },
  77: { icon: "🌨️", key: "wx.code.snow"         },
  80: { icon: "🌦️", key: "wx.code.showers"      },
  81: { icon: "🌧️", key: "wx.code.showers"      },
  82: { icon: "⛈️",  key: "wx.code.showers_heavy"},
  85: { icon: "🌨️", key: "wx.code.snow_showers" },
  86: { icon: "🌨️", key: "wx.code.snow_showers" },
  95: { icon: "⛈️",  key: "wx.code.storm"        },
  96: { icon: "⛈️",  key: "wx.code.storm_hail"   },
  99: { icon: "⛈️",  key: "wx.code.storm_hail"   },
};

const STORM_CODES = new Set([95, 96, 99]);
const RAIN_CODES  = new Set([51,53,55,56,57,61,63,65,66,67,80,81,82]);

let latestForecast = null;
let latestLive = null;

function wmoInfo(code) {
  return WMO[code] || { icon: "❔", key: null };
}

function pickForecastIndex(now = Date.now()) {
  if (!latestForecast?.hourly?.time) return -1;
  const times = latestForecast.hourly.time;
  let best = -1, bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const d = Math.abs(new Date(times[i]).getTime() - now);
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return best;
}

function currentWeather() {
  const i = pickForecastIndex();
  if (i < 0) return null;
  const h = latestForecast.hourly;
  return {
    idx: i,
    time: new Date(h.time[i]),
    cloud: h.cloud_cover?.[i],
    cloudLow: h.cloud_cover_low?.[i],
    cloudMid: h.cloud_cover_mid?.[i],
    cloudHigh: h.cloud_cover_high?.[i],
    code: h.weather_code?.[i],
    precip: h.precipitation_probability?.[i],
    cape: h.cape?.[i],
    li: h.lifted_index?.[i],
    temp: h.temperature_2m?.[i],
    dew: h.dew_point_2m?.[i],
    feels: h.apparent_temperature?.[i],
  };
}

// "storm" | "rain" | "clear"
function weatherRisk(cw) {
  if (!cw || cw.code == null) return "unknown";
  if (STORM_CODES.has(cw.code)) return "storm";
  if (cw.cape != null && cw.cape >= 1500 && (cw.precip ?? 0) >= 40) return "storm";
  if (RAIN_CODES.has(cw.code) || (cw.precip != null && cw.precip >= 60)) return "rain";
  return "clear";
}

// Probabilidad agregada de tormenta 0..100 a partir de código WMO, CAPE y prob. de precipitación.
function stormChance(cw) {
  if (!cw) return 0;
  if (cw.code != null && STORM_CODES.has(cw.code)) return 90;
  const cape = cw.cape ?? 0;
  const precip = cw.precip ?? 0;
  // CAPE: 0 a 2500 J/kg → 0..60. Precipitación: 0 a 100% → 0..40.
  const capeContrib = Math.min(60, (cape / 2500) * 60);
  const precipContrib = precip * 0.4;
  // Si no hay nada de precipitación y poca energía, la tormenta es muy improbable.
  if (precip < 10 && cape < 800) return Math.round(capeContrib * 0.3);
  return Math.round(Math.min(95, capeContrib + precipContrib));
}

function stormLevel(pct) {
  if (pct >= 50) return "high";
  if (pct >= 20) return "med";
  if (pct >= 5)  return "low";
  return "none";
}

// Haversine en km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// === Render utilitarios ===
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function fmtNum(n, digits = 1) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}
function fmtTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(t("locale"), { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  } catch { return iso; }
}

// === Estado actual ===
let previousAvg = null;
function renderLive(live) {
  if (!live) return;
  latestLive = live;
  const m = live.measurements || {};
  const dir = m.wind_heading;
  const avg = m.wind_speed_avg;
  const max = m.wind_speed_max;
  const min = m.wind_speed_min;
  const date = m.date || live.status?.date;

  setText("windAvg", fmtNum(avg));
  setText("windMax", fmtNum(max));
  setText("windMin", fmtNum(min));
  setText("lastUpdate", fmtTime(date));

  // Indicador de tendencia comparando con la lectura anterior
  const trendEl = document.getElementById("windAvgTrend");
  if (trendEl) {
    if (previousAvg != null && avg != null && !isNaN(avg)) {
      const delta = avg - previousAvg;
      trendEl.hidden = false;
      if (delta > 0.8)      { trendEl.className = "trend up";   trendEl.textContent = `↑ ${fmtNum(delta)}`; }
      else if (delta < -0.8){ trendEl.className = "trend down"; trendEl.textContent = `↓ ${fmtNum(Math.abs(delta))}`; }
      else                  { trendEl.className = "trend flat"; trendEl.textContent = "→"; }
    } else {
      trendEl.hidden = true;
    }
  }
  if (avg != null && !isNaN(avg)) previousAvg = avg;

  const dirInfo = classifyDirection(dir);
  setText("dirLabel", dir != null
    ? `${dirInfo.name} (${Math.round(dir)}°)`
    : t("dirLabel.dash"));

  // El wedge en el borde apunta hacia el centro desde la posición de origen del viento.
  const wedge = document.getElementById("windWedge");
  if (wedge && dir != null) {
    wedge.dataset.dir = String(dir);
    wedge.style.transform = `rotate(${dir - currentHeading}deg)`;
    wedge.dataset.quality = dirInfo.quality;
    wedge.dataset.speed = classifySpeed(avg, max);
  }

  // Viento medio numérico en el centro de la brújula.
  const centerEl = document.getElementById("compassAvg");
  if (centerEl) centerEl.textContent = (avg != null) ? Math.round(avg) : "—";

  const spdQ = classifySpeed(avg, max);
  let verdict = combineVerdict(dirInfo.quality, spdQ);

  // Ajustar veredicto según meteorología actual (lluvia / tormenta)
  const cw = currentWeather();
  const risk = weatherRisk(cw);
  if (risk === "storm") verdict = "bad";
  else if (risk === "rain" && verdict !== "bad") verdict = "warn";

  const light = document.getElementById("verdictLight");
  light.className = "verdict-light " + verdict;
  const vt = verdictText(verdict);
  setText("verdictTitle", vt.title);
  let detail = vt.detail;
  if (verdict !== "unknown") {
    detail += " " + t("verdict.suffix", { name: dirInfo.name, avg: fmtNum(avg), max: fmtNum(max) });
    const reasonKey = speedReasonKey(avg, max);
    if (reasonKey) detail += " " + t(reasonKey);
  }
  if (risk === "storm") detail += " " + t("verdict.storm_suffix");
  else if (risk === "rain") detail += " " + t("verdict.rain_suffix");
  setText("verdictDetail", detail);

  renderWeatherStrip(cw, risk);
  renderCloudPanel(cw, risk);

  maybeNotify(verdict, dirInfo, avg, max);
}

// === Panel de tipos de nubes ===
// Heurística basada en cobertura por capas (low/mid/high), CAPE, lifted index,
// temperatura y punto de rocío. Fuente: Open-Meteo + presentación "NUBES" (R. Cuevas).
function classifyClouds(cw) {
  if (!cw) return null;
  const low  = cw.cloudLow  ?? 0;
  const mid  = cw.cloudMid  ?? 0;
  const high = cw.cloudHigh ?? 0;
  const cape = cw.cape ?? 0;
  const li   = cw.li;   // lifted_index (negativo = inestable)
  const precip = cw.precip ?? 0;
  const code = cw.code;

  // Inestabilidad: prioriza LI, si no, CAPE
  let stab = "stable";
  if (li != null) {
    if (li <= -8) stab = "extreme";
    else if (li <= -5) stab = "high";
    else if (li <= -2) stab = "mod";
    else if (li < 0)  stab = "low";
    else stab = "stable";
  } else {
    if (cape >= 2500) stab = "extreme";
    else if (cape >= 1500) stab = "high";
    else if (cape >= 700)  stab = "mod";
    else if (cape >= 200)  stab = "low";
    else stab = "stable";
  }

  // Base de nube por Espy: h(m) ≈ 120 · (T − DP)
  let baseM = null;
  if (cw.temp != null && cw.dew != null) {
    baseM = Math.max(0, Math.round(120 * (cw.temp - cw.dew) / 10) * 10);
  }

  // Tipo capa baja
  let lowType = null;
  const stormCode = code != null && [95, 96, 99].includes(code);
  const rainHeavy = precip >= 60 || (code != null && [61,63,65,66,67,80,81,82].includes(code));
  if (stormCode || (cape >= 2500 && low >= 30)) lowType = "cb";
  else if ((cape >= 1500 || (li != null && li <= -5)) && low >= 30) lowType = "tcu";
  else if (rainHeavy && low >= 60) lowType = "ns";
  else if (low >= 60 && cape < 250) lowType = "st";
  else if (low >= 25 && cape >= 500) lowType = "cum";
  else if (low >= 60 && cape >= 250) lowType = "sc";
  else if (low >= 10) lowType = "cuh";

  // Tipo capa media
  let midType = null;
  if (mid >= 25) {
    if (mid >= 30 && cape >= 800) midType = "acc";
    else if (mid >= 60) midType = "as";
    else midType = "ac";
  }

  // Tipo capa alta
  let highType = null;
  if (high >= 10) {
    if (high >= 60) highType = "cs";
    else if (high >= 20) highType = "ci";
    else highType = "cc";
  }

  // Resumen / impacto en térmicas
  let sumKey = "cp.sum.clear";
  if (stormCode || lowType === "cb") sumKey = "cp.sum.storm";
  else if (rainHeavy || lowType === "ns") sumKey = "cp.sum.rain";
  else if (lowType === "tcu" || (cape >= 1800 && low >= 25)) sumKey = "cp.sum.overdev";
  else if (lowType === "st" || (low >= 70 && cape < 300)) sumKey = "cp.sum.stable";
  else if (["cum","cuh"].includes(lowType) && low >= 15 && low <= 55 && cape >= 400) sumKey = "cp.sum.good";
  else if (high >= 50 && low < 30) sumKey = "cp.sum.weak";
  else if (low < 15 && mid < 25 && high < 30) sumKey = "cp.sum.clear";
  else sumKey = "cp.sum.weak";

  return { low, mid, high, lowType, midType, highType, cape, stab, baseM, sumKey };
}

function renderCloudPanel(cw) {
  const box = document.getElementById("cloudPanel");
  if (!box) return;
  const cl = classifyClouds(cw);
  if (!cl) { box.hidden = true; return; }
  box.hidden = false;

  const setLayer = (layer, pct, typeKey) => {
    const p = Math.round(pct || 0);
    document.getElementById(`cp${layer}Pct`).textContent  = `${p}%`;
    document.getElementById(`cp${layer}Fill`).style.width = `${p}%`;
    const typeEl = document.getElementById(`cp${layer}Type`);
    typeEl.textContent = typeKey ? t(typeKey) : "";
    typeEl.dataset.kind = typeKey || "";
  };
  setLayer("High", cl.high, cl.highType ? `cp.type.high.${cl.highType}` : null);
  setLayer("Mid",  cl.mid,  cl.midType  ? `cp.type.mid.${cl.midType}`   : null);
  setLayer("Low",  cl.low,  cl.lowType  ? `cp.type.low.${cl.lowType}`   : null);

  document.getElementById("cpBase").textContent = cl.baseM != null ? `~${cl.baseM} m` : "—";
  document.getElementById("cpStab").textContent = t(`cp.stab.${cl.stab}`);
  document.getElementById("cpStab").dataset.level = cl.stab;
  document.getElementById("cpSummary").textContent = t(cl.sumKey);
  box.dataset.severity =
    cl.sumKey === "cp.sum.storm" ? "bad" :
    cl.sumKey === "cp.sum.rain"  ? "bad" :
    cl.sumKey === "cp.sum.overdev" ? "warn" :
    cl.sumKey === "cp.sum.good"  ? "good" :
    cl.sumKey === "cp.sum.clear" ? "good" : "ok";
}

function renderWeatherStrip(cw, risk) {
  const strip = document.getElementById("weatherStrip");
  if (!strip) return;
  if (!cw) { strip.hidden = true; return; }
  strip.hidden = false;
  const info = wmoInfo(cw.code);
  document.getElementById("wsIcon").textContent = info.icon;
  document.getElementById("wsDesc").textContent = info.key ? t(info.key) : "—";
  const cloud = cw.cloud != null ? Math.round(cw.cloud) : null;
  document.getElementById("wsCloudPct").textContent = cloud != null ? `${cloud}%` : "—";
  document.getElementById("wsCloudFill").style.width = cloud != null ? `${cloud}%` : "0%";
  document.getElementById("wsPrecip").textContent = cw.precip != null ? `${Math.round(cw.precip)}%` : "—";

  // Temperatura y sensación
  const tempBox = document.getElementById("wsTempBox");
  if (cw.temp != null) {
    tempBox.hidden = false;
    document.getElementById("wsTemp").textContent = `${Math.round(cw.temp)}°`;
    const feelsEl = document.getElementById("wsFeels");
    if (cw.feels != null && Math.abs(cw.feels - cw.temp) >= 1) {
      feelsEl.textContent = t("wx.feels", { v: Math.round(cw.feels) });
    } else { feelsEl.textContent = ""; }
  } else { tempBox.hidden = true; }

  // Salida/puesta de sol
  const sunBox = document.getElementById("wsSunBox");
  const daily = latestForecast?.daily;
  if (daily?.sunrise?.[0] && daily?.sunset?.[0]) {
    sunBox.hidden = false;
    const fmtH = (iso) => {
      try { return new Date(iso).toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit" }); }
      catch { return iso; }
    };
    document.getElementById("wsSunrise").textContent = fmtH(daily.sunrise[0]);
    document.getElementById("wsSunset").textContent  = fmtH(daily.sunset[0]);
  } else { sunBox.hidden = true; }

  const pct = stormChance(cw);
  const level = stormLevel(pct);
  const stormBox = document.getElementById("wsStormBox");
  const stormBar = document.getElementById("wsStormFill");
  const stormPct = document.getElementById("wsStormPct");
  const stormLbl = document.getElementById("wsStormLevel");
  if (level === "none") {
    stormBox.hidden = true;
  } else {
    stormBox.hidden = false;
    stormBox.dataset.level = level;
    stormBar.style.width = `${pct}%`;
    stormPct.textContent = `${pct}%`;
    stormLbl.textContent = t(`wx.storm_level.${level}`);
  }
}

// === Mejor ventana del día ===
// === Helpers solares (sunrise/sunset por desplazamiento de día) ===
// Devuelve el índice en daily.time correspondiente a `offsetFromToday`
// (0 = hoy, -1 = ayer, 1 = mañana). Requiere past_days en la petición para offsets negativos.
function dayIndexFromOffset(fc, offsetFromToday) {
  const d = fc?.daily;
  if (!d?.time?.length) return -1;
  const target = new Date();
  target.setDate(target.getDate() + offsetFromToday);
  const ymd = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}-${String(target.getDate()).padStart(2,"0")}`;
  return d.time.findIndex(s => String(s).startsWith(ymd));
}
function sunriseSunsetForOffset(fc, offsetFromToday) {
  const i = dayIndexFromOffset(fc, offsetFromToday);
  if (i < 0) return null;
  const sr = fc.daily.sunrise?.[i];
  const ss = fc.daily.sunset?.[i];
  if (!sr || !ss) return null;
  return { sunrise: new Date(sr), sunset: new Date(ss) };
}
// Determina si la previsión debe referirse a hoy o a mañana.
// A partir de SUNSET_SHIFT_H antes del ocaso (o tras él) → mañana.
const SUNSET_SHIFT_H = 2;
function referenceDayInfo(fc) {
  const today = sunriseSunsetForOffset(fc, 0);
  const tomorrow = sunriseSunsetForOffset(fc, 1);
  const now = Date.now();
  const useTomorrow = today && (now >= today.sunset.getTime() - SUNSET_SHIFT_H * 3600 * 1000);
  if (useTomorrow && tomorrow) {
    return { dayOffset: 1, sunrise: tomorrow.sunrise, sunset: tomorrow.sunset,
             scanFrom: tomorrow.sunrise, scanTo: tomorrow.sunset };
  }
  if (today) {
    return { dayOffset: 0, sunrise: today.sunrise, sunset: today.sunset,
             scanFrom: today.sunrise, scanTo: today.sunset };
  }
  // Fallback sin daily disponible: ventana 8–20 h del día actual.
  const a = new Date(); a.setHours(8,0,0,0);
  const b = new Date(); b.setHours(20,0,0,0);
  return { dayOffset: 0, sunrise: a, sunset: b, scanFrom: a, scanTo: b };
}

function renderBestWindow(fc) {
  const box = document.getElementById("bestWindow");
  if (!box || !fc?.hourly) return;
  const h = fc.hourly;
  const ref = referenceDayInfo(fc);
  const dayStart = ref.scanFrom.getTime();
  const dayEnd   = ref.scanTo.getTime();
  const now = Date.now();
  const runs = []; // {start,end,quality}
  let cur = null;
  for (let i = 0; i < h.time.length; i++) {
    const ts = new Date(h.time[i]).getTime();
    if (ts < dayStart) continue;
    if (ts > dayEnd) break;
    // En el día actual no consideramos horas pasadas.
    if (ref.dayOffset === 0 && ts < now - 30 * 60 * 1000) continue;
    const dirInfo = classifyDirection(h.wind_direction_10m[i]);
    const spdQ = classifySpeed(h.wind_speed_10m[i], h.wind_gusts_10m[i]);
    let v = combineVerdict(dirInfo.quality, spdQ);
    const slot = { code: h.weather_code?.[i], cloud: h.cloud_cover?.[i], precip: h.precipitation_probability?.[i], cape: h.cape?.[i] };
    const risk = weatherRisk(slot);
    if (risk === "storm") v = "bad";
    else if (risk === "rain" && v !== "bad") v = "warn";
    if (v === "ideal" || v === "ok") {
      if (!cur || cur.quality !== v) { if (cur) runs.push(cur); cur = { start: ts, end: ts + 3600 * 1000, quality: v }; }
      else { cur.end = ts + 3600 * 1000; }
    } else { if (cur) { runs.push(cur); cur = null; } }
  }
  if (cur) runs.push(cur);
  // Preferir ideal sobre ok; entre iguales, el más largo, y antes en el tiempo a igualdad.
  runs.sort((a, b) => {
    const rank = (q) => q === "ideal" ? 0 : 1;
    if (rank(a.quality) !== rank(b.quality)) return rank(a.quality) - rank(b.quality);
    const lenA = a.end - a.start, lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA;
    return a.start - b.start;
  });
  const labelKey = ref.dayOffset === 1 ? "best.label_tomorrow" : "best.label";
  const best = runs[0];
  if (!best) {
    box.hidden = false;
    box.className = "best-window none";
    box.querySelector(".bw-label").textContent = t(labelKey);
    box.querySelector("#bestWindowText").textContent = t("best.none");
    return;
  }
  box.hidden = false;
  box.className = "best-window " + (best.quality === "ideal" ? "" : "ok");
  const fmtHM = (ms) => new Date(ms).toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit" });
  const tag = best.quality === "ideal" ? t("best.ideal") : t("best.ok");
  box.querySelector(".bw-label").textContent = t(labelKey);
  box.querySelector("#bestWindowText").textContent = `${fmtHM(best.start)}–${fmtHM(best.end)} · ${tag}`;
}

// === Pronóstico (utilidades comunes) ===
function dirColor(deg) {
  const q = classifyDirection(deg).quality;
  if (q === "ideal") return "#2ecc71";
  if (q === "ok")    return "#f1c40f";
  if (q === "bad")   return "#e74c3c";
  return "#888";
}

// Tamaño de las flechas en el chart de pronóstico (más pequeñas en móvil).
function forecastArrowSize() {
  return (window.matchMedia && window.matchMedia("(max-width: 540px)").matches) ? 11 : 18;
}

// Re-renderizar el pronóstico al cruzar el breakpoint para ajustar tamaño de flechas.
if (window.matchMedia) {
  const mq = window.matchMedia("(max-width: 540px)");
  const handler = () => { if (latestForecast) renderForecast(latestForecast); };
  if (mq.addEventListener) mq.addEventListener("change", handler);
  else if (mq.addListener) mq.addListener(handler);
}

// Genera un canvas con una flecha rellena apuntando hacia donde va el viento,
// para usarlo como pointStyle de Chart.js. `deg` = dirección DE DONDE viene el viento.
function makeArrowPoint(deg, color, size = 12) {
  const dpr = window.devicePixelRatio || 1;
  const cv = document.createElement("canvas");
  const px = Math.max(8, size);
  cv.width = px * dpr;
  cv.height = px * dpr;
  cv.style.width = px + "px";
  cv.style.height = px + "px";
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.translate(px / 2, px / 2);
  // wind_direction = DE donde viene; flecha apunta HACIA donde va = +180
  const rot = ((deg || 0) + 180) * Math.PI / 180;
  ctx.rotate(rot);
  ctx.fillStyle = color || "#888";
  // Triángulo apuntando hacia arriba (norte) en la base, con cola en V
  const s = px / 2;
  ctx.beginPath();
  ctx.moveTo(0, -s);            // punta arriba
  ctx.lineTo(s * 0.7, s * 0.6); // esquina inferior derecha
  ctx.lineTo(0, s * 0.25);      // muesca interna
  ctx.lineTo(-s * 0.7, s * 0.6);// esquina inferior izquierda
  ctx.closePath();
  ctx.fill();
  return cv;
}

function chartCommonOptions() {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: { labels: { color: "#e8eef7" } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const ds = ctx.dataset.label;
            if (ds === t("chart.dir")) {
              const d = ctx.raw.dir;
              const info = classifyDirection(d);
              return t("chart.dir_tooltip", { name: info.name, deg: Math.round(d) });
            }
            return `${ds}: ${fmtNum(ctx.parsed.y)} km/h`;
          },
        },
      },
    },
    scales: {
      x: { type: "time", time: { tooltipFormat: "dd MMM HH:mm" },
           ticks: { color: "#8aa0bb" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { beginAtZero: true,
           title: { display: true, text: "km/h", color: "#8aa0bb" },
           ticks: { color: "#8aa0bb" }, grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };
}

// === Pronóstico ===
let forecastChart = null;
let currentForecastDays = 1;

function renderForecast(fc) {
  if (!fc?.hourly) return;
  latestForecast = fc;
  const ctx = document.getElementById("forecastChart");
  const times = fc.hourly.time.map(t => new Date(t));
  const spd = fc.hourly.wind_speed_10m;
  const gust = fc.hourly.wind_gusts_10m;
  const dir = fc.hourly.wind_direction_10m;
  const cloud = fc.hourly.cloud_cover || [];
  const wcode = fc.hourly.weather_code || [];
  const pprob = fc.hourly.precipitation_probability || [];
  const cape  = fc.hourly.cape || [];

  // Filtrar a partir de la hora actual (o desde el amanecer de mañana si estamos cerca del ocaso)
  const ref = referenceDayInfo(fc);
  const now = Date.now();
  const fromTs = ref.dayOffset === 1 ? ref.scanFrom.getTime() : (now - 3600 * 1000);
  const idxStart = times.findIndex(t => t.getTime() >= fromTs);
  const i0 = Math.max(0, idxStart);

  const spdPts = times.slice(i0).map((t, i) => ({ x: t, y: spd[i + i0] }));
  const gustPts = times.slice(i0).map((t, i) => ({ x: t, y: gust[i + i0] }));
  const dirPts = times.slice(i0).map((t, i) => ({ x: t, y: spd[i + i0], dir: dir[i + i0] }));
  const dirColors = dirPts.map(p => dirColor(p.dir));
  const dirArrows = dirPts.map(p => makeArrowPoint(p.dir, dirColor(p.dir), forecastArrowSize()));

  const data = {
    datasets: [
      { label: t("chart.gust"), data: gustPts,
        borderColor: "rgba(231,76,60,0.9)", backgroundColor: "rgba(231,76,60,0.15)",
        borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
      { label: t("chart.avg"), data: spdPts,
        borderColor: "rgba(78,161,255,1)", backgroundColor: "rgba(78,161,255,0.2)",
        borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true },
      { label: t("chart.dir"), data: dirPts, type: "scatter",
        pointStyle: dirArrows,
        pointRadius: forecastArrowSize() / 2, showLine: false, parsing: false },
    ],
  };
  const options = chartCommonOptions();

  if (forecastChart) { forecastChart.data = data; forecastChart.options = options; forecastChart.update(); }
  else forecastChart = new Chart(ctx, { type: "line", data, options });

  // Resumen: próximas horas en franja diurna del día de referencia.
  const summary = document.getElementById("forecastSummary");
  summary.innerHTML = "";
  const maxSlots = currentForecastDays === 1 ? 12 : 16;
  const scanFromTs = ref.scanFrom.getTime();
  const scanToTs   = ref.scanTo.getTime();
  let added = 0;
  for (let i = i0; i < times.length && added < maxSlots; i++) {
    const ts = times[i].getTime();
    // Sólo dentro de la ventana solar del día de referencia (sunrise → sunset).
    if (ts < scanFromTs || ts > scanToTs) {
      // Si ya pasamos del fin de día de referencia, seguimos para slots de días posteriores
      // sólo si el selector pide >1 día.
      if (currentForecastDays === 1 && ts > scanToTs) break;
      if (currentForecastDays === 1) continue;
      const hh = times[i].getHours();
      if (hh < 8 || hh > 20) continue;
    }
    const h = times[i].getHours();
    const s = spd[i], g = gust[i], d = dir[i];
    const dirInfo = classifyDirection(d);
    const spdQ = classifySpeed(s, g);
    let verdict = combineVerdict(dirInfo.quality, spdQ);

    // Riesgo meteo del slot
    const slotCw = { code: wcode[i], cloud: cloud[i], precip: pprob[i], cape: cape[i] };
    const risk = weatherRisk(slotCw);
    if (risk === "storm") verdict = "bad";
    else if (risk === "rain" && verdict !== "bad") verdict = "warn";

    const info = wmoInfo(slotCw.code);
    const cl = slotCw.cloud != null ? Math.round(slotCw.cloud) : null;
    const pp = slotCw.precip != null ? Math.round(slotCw.precip) : null;
    const spct = stormChance(slotCw);
    const slvl = stormLevel(spct);
    let wxLine = `<span title="${info.key ? t(info.key) : ''}">${info.icon}</span>`;
    if (cl != null) wxLine += ` <span>☁ ${cl}%</span>`;
    if (pp != null && pp > 0) wxLine += ` <span class="${pp >= 60 ? 'rain' : ''}">💧 ${pp}%</span>`;
    if (slvl !== "none") wxLine += ` <span class="storm storm-${slvl}">⛈ ${spct}%</span>`;

    const div = document.createElement("div");
    div.className = "forecast-slot " + verdict;
    div.innerHTML = `
      <div class="hour">${times[i].toLocaleDateString(t("locale"),{weekday:"short"})} ${String(h).padStart(2,"0")}:00</div>
      <div class="spd">${Math.round(s)}<span style="font-size:.7em">/${Math.round(g)}</span></div>
      <div class="dir">${dirInfo.name} (${Math.round(d)}°)</div>
      <div class="wx">${wxLine}</div>
      <div class="badge">${verdictText(verdict).title.split(" ")[0]}</div>
    `;
    summary.appendChild(div);
    added++;
  }

  // Re-evaluar veredicto en vivo ahora que tenemos meteo actualizada
  if (latestLive) renderLive(latestLive);
  renderBestWindow(fc);
}

// === Comparativa últimos días ===
async function renderCompare() {
  const grid = document.getElementById("compareGrid");
  setText("compareWindowLabel", t("cmp.window_solar"));

  grid.innerHTML = "";
  const days = [1, 2, 3];
  const fc = latestForecast;
  const results = await Promise.all(days.map(async (offset) => {
    // Ventana solar de ese día: amanecer+3h → ocaso-1h.
    const ss = fc ? sunriseSunsetForOffset(fc, -offset) : null;
    let start, stop;
    if (ss) {
      start = new Date(ss.sunrise.getTime() + 3 * 3600 * 1000);
      stop  = new Date(ss.sunset.getTime()  - 1 * 3600 * 1000);
    } else {
      // Fallback aproximado si no hay daily disponible
      const now = new Date();
      const center = new Date(now.getTime() - offset * 24 * 3600 * 1000);
      start = new Date(center); start.setHours(10, 0, 0, 0);
      stop  = new Date(center); stop.setHours(19, 0, 0, 0);
    }
    try {
      const arch = await getArchive(start, stop);
      return { offset, arch, start, stop };
    } catch (e) {
      return { offset, error: e.message };
    }
  }));

  for (const r of results) {
    const card = document.createElement("div");
    const dayLabel = r.offset === 1 ? t("cmp.yesterday") : t("cmp.days_ago", { n: r.offset });
    if (r.error || !r.arch?.date?.length) {
      card.className = "compare-card";
      card.innerHTML = `<h3>${dayLabel}</h3><div class="row">${t("cmp.no_data")}</div>`;
      grid.appendChild(card);
      continue;
    }
    const avg = avgOf(r.arch.wind_speed_avg);
    const max = Math.max(...(r.arch.wind_speed_max || [0]));
    const min = Math.min(...(r.arch.wind_speed_min || [0]));
    const dirAvg = meanAngle(r.arch.wind_heading);
    const dirInfo = classifyDirection(dirAvg);
    const spdQ = classifySpeed(avg, max);
    const verdict = combineVerdict(dirInfo.quality, spdQ);
    const arrowQ = verdict === "warn" ? "warn" : dirInfo.quality;
    const arrowRot = ((dirAvg || 0) + 180) % 360;
    const arrowSvg = `<span class="cmp-arrow q-${arrowQ}"><svg viewBox="0 0 10 10" style="transform: rotate(${arrowRot}deg);"><path d="M5 1 L8 7 L5 5.5 L2 7 Z" fill="currentColor"/></svg></span>`;
    card.className = "compare-card " + verdict;
    card.innerHTML = `
      <h3>${dayLabel} <small style="color:var(--muted);font-weight:400">${r.start.toLocaleDateString(t("locale"),{day:"2-digit",month:"short"})}</small></h3>
      <div class="row"><span>${t("cmp.row.avg")}</span><b>${fmtNum(avg)} km/h</b></div>
      <div class="row"><span>${t("cmp.row.max")}</span><b>${fmtNum(max)} km/h</b></div>
      <div class="row"><span>${t("cmp.row.dir")}</span><b>${arrowSvg} ${dirInfo.name} (${Math.round(dirAvg)}°)</b></div>
      <div class="row"><span>${t("cmp.row.state")}</span><b>${verdictText(verdict).title.split(" ")[0]}</b></div>
    `;
    grid.appendChild(card);
  }
}

function avgOf(arr) {
  if (!arr?.length) return null;
  const vals = arr.filter(v => v != null && !isNaN(v));
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function meanAngle(degArr) {
  if (!degArr?.length) return null;
  let sx = 0, sy = 0, n = 0;
  for (const d of degArr) {
    if (d == null || isNaN(d)) continue;
    const r = d * Math.PI / 180;
    sx += Math.cos(r); sy += Math.sin(r); n++;
  }
  if (!n) return null;
  let a = Math.atan2(sy / n, sx / n) * 180 / Math.PI;
  if (a < 0) a += 360;
  return a;
}

// === Mapa ===
let map = null;
function renderMap() {
  if (map) return;
  map = L.map("map").setView([currentTakeoff.lat, currentTakeoff.lon], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap", maxZoom: 18,
  }).addTo(map);
  drawTakeoffOnMap();
}

let takeoffMapLayers = [];
function clearTakeoffMapLayers() {
  if (!map) return;
  for (const l of takeoffMapLayers) map.removeLayer(l);
  takeoffMapLayers = [];
}
function drawTakeoffOnMap() {
  if (!map) return;
  clearTakeoffMapLayers();
  const marker = L.marker([currentTakeoff.lat, currentTakeoff.lon]).addTo(map)
    .bindPopup(`<b>${currentTakeoff.name}</b><br/>${t("popup.takeoff_sub")}`)
    .bindTooltip(currentTakeoff.name.replace(/^Despegue\s+/i, ""), {
      permanent: true, direction: "top", offset: [0, -8], className: "station-label takeoff"
    })
    .openPopup();
  const circle = L.circle([currentTakeoff.lat, currentTakeoff.lon], {
    radius: 50000, color: "#4ea1ff", weight: 1, fillOpacity: 0.05, dashArray: "4,4",
  }).addTo(map);
  takeoffMapLayers.push(marker, circle);
  map.setView([currentTakeoff.lat, currentTakeoff.lon], 10);
}

// === Estaciones cercanas ===
// Cada estación tiene sus propios criterios de volabilidad (no los conocemos),
// así que mostramos solo la dirección y la intensidad media de las últimas horas.
const NEARBY_AVG_HOURS = 3;
let nearbyLatLngs = [];

function fitMapToNearby() {
  if (!map || !nearbyLatLngs.length) return;
  const pts = [[currentTakeoff.lat, currentTakeoff.lon], ...nearbyLatLngs];
  const bounds = L.latLngBounds(pts);
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
}

async function renderNearby() {
  const grid = document.getElementById("nearbyGrid");
  if (!grid) return;
  nearbyLatLngs = [];
  try {
    const all = await getAllStations();
    const now = Date.now();
    const within = all
      .map(s => {
        const lat = s.location?.latitude, lon = s.location?.longitude;
        if (lat == null || lon == null) return null;
        const dist = haversineKm(currentTakeoff.lat, currentTakeoff.lon, lat, lon);
        return { s, dist, lat, lon };
      })
      .filter(x => x && x.dist <= 50 && x.s.id !== currentStationId)
      .filter(x => {
        const d = x.s.measurements?.date;
        if (!d) return false;
        return (now - new Date(d).getTime()) < 24 * 3600 * 1000;
      })
      .sort((a, b) => a.dist - b.dist);

    grid.innerHTML = "";
    if (!within.length) {
      grid.innerHTML = `<div class="compare-loading">${t("near.none")}</div>`;
      return;
    }

    // Pintar primero placeholders y marcadores en el mapa
    const cards = within.map(({ s, dist }) => {
      const card = document.createElement("div");
      card.className = "nearby-card";
      const stationUrl = `https://www.openwindmap.org/windbird-${s.id}`;
      card.innerHTML = `
        <h3>
          <a href="${stationUrl}" target="_blank" rel="noopener">${escapeHtml(s.meta?.name || ('Pioupiou ' + s.id))}</a>
          <small>${dist.toFixed(1)} km</small>
        </h3>
        <div class="mini-compass" data-station="${s.id}">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="46" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <text x="50" y="14" text-anchor="middle" class="mc-card">N</text>
            <text x="50" y="92" text-anchor="middle" class="mc-card">S</text>
            <text x="91" y="54" text-anchor="middle" class="mc-card">E</text>
            <text x="9"  y="54" text-anchor="middle" class="mc-card">O</text>
            <g class="mc-arrow-g" transform="rotate(0 50 50)">
              <polygon class="mc-arrow" points="50,32 42,12 58,12" />
            </g>
            <circle cx="50" cy="50" r="3" fill="#4ea1ff"/>
          </svg>
        </div>
        <div class="nearby-meta">
          <div class="nearby-dir">—</div>
          <div class="nearby-avg"><b>—</b> <span>${t("near.avg_unit", { h: NEARBY_AVG_HOURS })}</span></div>
        </div>
      `;
      grid.appendChild(card);
      return { s, dist, card };
    });

    // Marcadores en el mapa (un color neutral; sin veredicto)
    if (map) {
      for (const { s, dist } of within) {
        const stName = s.meta?.name || ('Pioupiou ' + s.id);
        L.circleMarker([s.location.latitude, s.location.longitude], {
          radius: 6, color: "#fff", weight: 1, fillColor: "#4ea1ff", fillOpacity: 0.85,
        }).addTo(map)
          .bindPopup(
            `<b>${escapeHtml(stName)}</b><br/>` +
            `${dist.toFixed(1)} km · ${t("near.popup_last")}: ${fmtTime(s.measurements?.date)}<br/>` +
            `<a href="https://www.openwindmap.org/windbird-${s.id}" target="_blank">${t("near.popup_view")}</a>`
          )
          .bindTooltip(stName, {
            permanent: true, direction: "right", offset: [8, 0], className: "station-label"
          });
      }
    }

    // Cargar archivo de últimas N horas en paralelo y rellenar cada tarjeta
    const stop = new Date();
    const start = new Date(stop.getTime() - NEARBY_AVG_HOURS * 3600 * 1000);
    const fmt = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

    await Promise.all(cards.map(async ({ s, card }) => {
      try {
        const url = `${API_BASE}/archive/${s.id}?start=${fmt(start)}&stop=${fmt(stop)}`;
        const data = await fetchJson(url);
        const arch = normalizeArchive(data?.data);
        let avgSpd = null, meanDir = null;
        if (arch?.date?.length) {
          avgSpd = avgOf(arch.wind_speed_avg);
          meanDir = meanAngle(arch.wind_heading);
        }
        // Fallback al snapshot live si no hay archive
        if (avgSpd == null) avgSpd = s.measurements?.wind_speed_avg;
        if (meanDir == null) meanDir = s.measurements?.wind_heading;

        const dirInfo = classifyDirection(meanDir);
        // Color de la flecha por velocidad media (verde ≤15, amarillo ≤22, rojo >22).
        const spdBand = avgSpd == null ? "unknown"
          : avgSpd <= 15 ? "ideal"
          : avgSpd <= 22 ? "ok"
          : "bad";
        const arrowG = card.querySelector(".mc-arrow-g");
        const arrowPoly = card.querySelector(".mc-arrow");
        if (arrowG && meanDir != null) {
          arrowG.setAttribute("transform", `rotate(${meanDir} 50 50)`);
        }
        if (arrowPoly && spdBand !== "unknown") {
          arrowPoly.classList.remove("quality-ideal", "quality-ok", "quality-bad");
          arrowPoly.classList.add("quality-" + spdBand);
        }
        card.querySelector(".nearby-dir").textContent =
          meanDir != null ? `${dirInfo.name} · ${Math.round(meanDir)}°` : "—";
        card.querySelector(".nearby-avg").innerHTML =
          `<b>${fmtNum(avgSpd)}</b> <span>${t("near.avg_unit", { h: NEARBY_AVG_HOURS })}</span>`;
      } catch (e) {
        console.warn("nearby station archive:", s.id, e);
      }
    }));
  } catch (e) {
    console.error("nearby:", e);
    grid.innerHTML = `<div class="compare-loading">${t("near.error")}</div>`;
  }

  // Añadir la estación del Aeropuerto de Granada (Open-Meteo en sus coordenadas)
  await renderMetarStations();
  // Mapa centrado en el despegue (sin estaciones).
}

// === Estaciones METAR de aeropuertos cercanos ===
// Fuente: NOAA / AviationWeather.gov  (sin clave, CORS habilitado).
// API: https://aviationweather.gov/api/data/metar?ids=...&format=json
const METAR_AIRPORTS = [
  // Andalucía
  { icao: "LEGR", name: "Granada",       lat: 37.1887, lon: -3.7775 },
  { icao: "LEMG", name: "Málaga",        lat: 36.6749, lon: -4.4991 },
  { icao: "LEAM", name: "Almería",       lat: 36.8439, lon: -2.3701 },
  { icao: "LEZL", name: "Sevilla",       lat: 37.4180, lon: -5.8931 },
  { icao: "LEJR", name: "Jerez",         lat: 36.7446, lon: -6.0601 },
  // Sur/Centro
  { icao: "LEMU", name: "Murcia",        lat: 37.8030, lon: -1.1248 },
  { icao: "LEAL", name: "Alicante",      lat: 38.2822, lon: -0.5582 },
  { icao: "LEVC", name: "Valencia",      lat: 39.4893, lon: -0.4815 },
  { icao: "LEMD", name: "Madrid",        lat: 40.4936, lon: -3.5668 },
  // Norte
  { icao: "LEBB", name: "Bilbao",        lat: 43.3011, lon: -2.9106 },
  { icao: "LESO", name: "San Sebastián", lat: 43.3565, lon: -1.7906 },
  { icao: "LEVT", name: "Vitoria",       lat: 42.8828, lon: -2.7244 },
  { icao: "LEZG", name: "Zaragoza",      lat: 41.6661, lon: -1.0411 },
  // Cataluña / Baleares
  { icao: "LEBL", name: "Barcelona",     lat: 41.2974, lon:  2.0833 },
  { icao: "LEPA", name: "Palma",         lat: 39.5517, lon:  2.7388 },
  // Pirineo (paracaidismo/parapente)
  { icao: "LEHC", name: "Huesca-Pirineos", lat: 42.0760, lon: -0.3163 },
  // Canarias
  { icao: "GCLP", name: "Las Palmas",    lat: 27.9319, lon: -15.3866 },
  { icao: "GCXO", name: "Tenerife Norte",lat: 28.4827, lon: -16.3414 },
];

function ktToKmh(kt) { return kt == null ? null : kt * 1.852; }

async function renderMetarStations() {
  const grid = document.getElementById("nearbyGrid");
  if (!grid) return;
  // Filtra aeropuertos dentro del radio (tsRadius).
  const within = METAR_AIRPORTS
    .map(a => ({ ...a, dist: haversineKm(currentTakeoff.lat, currentTakeoff.lon, a.lat, a.lon) }))
    .filter(a => a.dist <= tsRadius)
    .sort((a, b) => a.dist - b.dist);
  if (!within.length) return;

  const ids = within.map(a => a.icao).join(",");
  let metars = [];
  try {
    const url = `https://aviationweather.gov/api/data/metar?ids=${ids}&format=json&taf=false&hours=2`;
    const data = await fetchJson(url);
    if (Array.isArray(data)) metars = data;
  } catch (e) {
    console.warn("METAR fetch:", e);
    return;
  }
  // Quedarnos con el METAR más reciente por estación.
  const latestByIcao = {};
  for (const m of metars) {
    const icao = m.icaoId || m.icao || m.station_id;
    if (!icao) continue;
    const ts = m.obsTime || m.reportTime || 0;
    if (!latestByIcao[icao] || ts > (latestByIcao[icao]._ts || 0)) {
      latestByIcao[icao] = { ...m, _ts: ts };
    }
  }

  for (const ap of within) {
    const m = latestByIcao[ap.icao];
    if (!m) continue;
    // wdir/wspd/wgst en grados / nudos. wdir puede ser "VRB" (string).
    const dir = (typeof m.wdir === "number") ? m.wdir : null;
    const spd = ktToKmh(typeof m.wspd === "number" ? m.wspd : null);
    const gst = ktToKmh(typeof m.wgst === "number" ? m.wgst : null);
    const dirInfo = classifyDirection(dir);
    const spdBand = spd == null ? "unknown"
      : spd <= 15 ? "ideal" : spd <= 22 ? "ok" : "bad";
    const obsTs = m.obsTime ? new Date(m.obsTime * 1000) : null;
    const obsStr = obsTs ? obsTs.toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit" }) : "—";

    const card = document.createElement("div");
    card.className = "nearby-card airport";
    const label = `${t("near.airport_prefix")} ${ap.name} (${ap.icao})`;
    card.innerHTML = `
      <h3>
        <a href="https://www.windy.com/-?${ap.lat},${ap.lon},10" target="_blank" rel="noopener">${escapeHtml(label)}</a>
        <small>${ap.dist.toFixed(1)} km</small>
      </h3>
      <div class="mini-compass">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <text x="50" y="14" text-anchor="middle" class="mc-card">N</text>
          <text x="50" y="92" text-anchor="middle" class="mc-card">S</text>
          <text x="91" y="54" text-anchor="middle" class="mc-card">E</text>
          <text x="9"  y="54" text-anchor="middle" class="mc-card">O</text>
          <g class="mc-arrow-g" transform="rotate(${dir ?? 0} 50 50)">
            <polygon class="mc-arrow ${spdBand !== 'unknown' ? 'quality-' + spdBand : ''}" points="50,32 42,12 58,12" />
          </g>
          <circle cx="50" cy="50" r="3" fill="#f1c40f"/>
        </svg>
      </div>
      <div class="nearby-meta">
        <div class="nearby-dir">${dir != null ? dirInfo.name + ' · ' + Math.round(dir) + '°' : (m.wdir === "VRB" ? "VRB" : "—")}</div>
        <div class="nearby-avg">
          <b>${fmtNum(spd)}</b> <span>km/h</span>
          ${gst != null ? `· <span title="rachas">${fmtNum(gst)}</span>` : ""}
        </div>
        <div class="badge-src">METAR · ${obsStr}</div>
      </div>
    `;
    grid.appendChild(card);
    if (map) {
      L.circleMarker([ap.lat, ap.lon], {
        radius: 7, color: "#fff", weight: 1, fillColor: "#f1c40f", fillOpacity: 0.9,
      }).addTo(map)
        .bindPopup(`<b>${escapeHtml(label)}</b><br/>${ap.dist.toFixed(1)} km`)
        .bindTooltip(label, {
          permanent: true, direction: "right", offset: [8, 0], className: "station-label airport"
        });
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// === Notificaciones ===
let lastNotifyTs = 0;
function notificationsEnabled() {
  return localStorage.getItem("notifyEnabled") === "1" &&
         "Notification" in window && Notification.permission === "granted";
}

function maybeNotify(verdict, dirInfo, avg, max) {
  if (!notificationsEnabled()) return;
  if (verdict !== "ideal") return;
  const now = Date.now();
  if (now - lastNotifyTs < NOTIFY_COOLDOWN_MS) return;
  lastNotifyTs = now;
  try {
    new Notification(t("notify.title"), {
      body: `${dirInfo.name} · ${fmtNum(avg)} km/h (${t("chart.gust").toLowerCase()} ${fmtNum(max)} km/h)`,
      icon: "icon.svg",
      tag: "viento-cenes-ideal",
    });
  } catch (e) { console.warn(e); }
}

async function toggleNotifications() {
  const btn = document.getElementById("notifyBtn");
  if (!("Notification" in window)) {
    alert(t("notify.unsupported"));
    return;
  }
  if (notificationsEnabled()) {
    localStorage.setItem("notifyEnabled", "0");
    btn.classList.remove("active");
    btn.textContent = "🔔";
    btn.title = t("btn.notify_off");
    return;
  }
  let perm = Notification.permission;
  if (perm !== "granted") perm = await Notification.requestPermission();
  if (perm === "granted") {
    localStorage.setItem("notifyEnabled", "1");
    btn.classList.add("active");
    btn.textContent = "🔕";
    btn.title = t("btn.notify_on");
  } else {
    alert(t("notify.denied"));
  }
}

function syncNotifyButtonInitial() {
  const btn = document.getElementById("notifyBtn");
  if (notificationsEnabled()) {
    btn.classList.add("active");
    btn.textContent = "🔕";
    btn.title = t("btn.notify_on");
  } else {
    btn.textContent = "🔔";
    btn.title = t("btn.notify_off");
  }
}

// === PWA install ===
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById("installBtn");
  btn.hidden = false;
  btn.addEventListener("click", async () => {
    btn.hidden = true;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  }, { once: true });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then(reg => {
      // Comprueba si hay actualización al cargar
      reg.update().catch(() => {});
      // Si hay un SW esperando, pídele que tome el control ya
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            nw.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    }).catch(err => console.warn("SW:", err));
    // Cuando el nuevo SW toma el control, recarga una vez para servir los nuevos assets
    let _reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (_reloaded) return;
      _reloaded = true;
      location.reload();
    });
  });
}

// === Orquestación ===
async function refreshObservations() {
  try {
    renderLive(await getLive());
  } catch (e) {
    console.error(e);
    setText("verdictTitle", t("error.fetch"));
    setText("verdictDetail", e.message);
  }
  // Histórico 6h se refresca en paralelo (no bloquea el live)
  refreshWindHistory();
}

async function refreshForecast() {
  try {
    const fc = await getForecast(Math.max(2, currentForecastDays));
    renderForecast(fc);
    // La comparativa usa daily.sunrise/sunset de los últimos días (past_days=3).
    renderCompare();
  } catch (e) {
    console.error("forecast:", e);
  }
}

async function refreshLiveOnly() {
  try { renderLive(await getLive()); } catch (e) { console.error(e); }
}

// === Wind history bar ===
const WH_BUCKETS = 8;
let WH_HOURS = parseInt(localStorage.getItem("whHours"), 10);
if (![2, 4, 6].includes(WH_HOURS)) WH_HOURS = 2;
let WH_BUCKET_MIN = (WH_HOURS * 60) / WH_BUCKETS;

// === Orientación del dispositivo (brújula auto-rotación) ===
let currentHeading = 0;
let orientationEnabled = false;
function handleDeviceOrientation(e) {
  let h = null;
  // iOS Safari expone webkitCompassHeading (0=N, sentido horario).
  if (typeof e.webkitCompassHeading === "number") {
    h = e.webkitCompassHeading;
  } else if (e.absolute && typeof e.alpha === "number") {
    // alpha: rotación alrededor del eje Z, antihorario desde N.
    h = (360 - e.alpha) % 360;
  } else if (typeof e.alpha === "number") {
    h = (360 - e.alpha) % 360;
  }
  if (h == null || isNaN(h)) return;
  currentHeading = h;
  applyCompassHeading();
}
function applyCompassHeading() {
  const rose = document.getElementById("compassRose");
  if (rose) rose.style.setProperty("--heading", `${-currentHeading}deg`);
  const wedge = document.getElementById("windWedge");
  if (wedge && wedge.dataset.dir) {
    const d = parseFloat(wedge.dataset.dir);
    if (!isNaN(d)) wedge.style.transform = `rotate(${d - currentHeading}deg)`;
  }
}
async function enableDeviceOrientation() {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm !== "granted") return false;
    }
    const evt = ("ondeviceorientationabsolute" in window)
      ? "deviceorientationabsolute"
      : "deviceorientation";
    window.addEventListener(evt, handleDeviceOrientation, true);
    orientationEnabled = true;
    return true;
  } catch (err) {
    console.warn("Device orientation not available:", err);
    return false;
  }
}
function disableDeviceOrientation() {
  window.removeEventListener("deviceorientationabsolute", handleDeviceOrientation, true);
  window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
  orientationEnabled = false;
  currentHeading = 0;
  applyCompassHeading();
}
function initOrientationToggle() {
  const btn = document.getElementById("orientToggle");
  if (!btn) return;
  // Si el dispositivo claramente no soporta orientación (escritorio sin sensores),
  // dejamos el botón pero al pulsarlo simplemente no hará nada útil.
  btn.addEventListener("click", async () => {
    if (!orientationEnabled) {
      const ok = await enableDeviceOrientation();
      btn.classList.toggle("active", ok);
    } else {
      disableDeviceOrientation();
      btn.classList.remove("active");
    }
  });
}

function setWindHistoryHours(h) {
  if (![2, 4, 6].includes(h)) return;
  WH_HOURS = h;
  WH_BUCKET_MIN = (WH_HOURS * 60) / WH_BUCKETS;
  localStorage.setItem("whHours", String(h));
  document.querySelectorAll("#whRange button").forEach(b => {
    b.classList.toggle("active", parseInt(b.dataset.h, 10) === h);
  });
  const title = document.getElementById("whTitle");
  if (title) title.textContent = t("wh.titleFmt").replace("{h}", h);
  refreshWindHistory();
}

async function refreshWindHistory() {
  const wrap = document.getElementById("windHistory");
  if (!wrap) return;
  try {
    const arch = await getArchiveLastHours(WH_HOURS);
    renderWindHistory(arch);
  } catch (e) {
    console.warn("wind history:", e);
    wrap.hidden = true;
  }
}

function renderWindHistory(arch) {
  const wrap   = document.getElementById("windHistory");
  const arrows = document.getElementById("whArrows");
  const bar    = document.getElementById("whBar");
  const values = document.getElementById("whValues");
  const hours  = document.getElementById("whHours");
  if (!wrap || !bar || !arrows || !hours || !values) return;
  if (!arch?.date?.length) { wrap.hidden = true; return; }

  const now = Date.now();
  const startMs = now - WH_HOURS * 3600 * 1000;
  const bucketMs = WH_BUCKET_MIN * 60 * 1000;
  const nBuckets = Math.ceil((WH_HOURS * 60) / WH_BUCKET_MIN);

  // Inicializar buckets
  const buckets = Array.from({ length: nBuckets }, () => ({
    avgSum: 0, maxSum: 0, sx: 0, sy: 0, n: 0
  }));

  for (let i = 0; i < arch.date.length; i++) {
    const tMs = new Date(arch.date[i]).getTime();
    if (isNaN(tMs) || tMs < startMs || tMs > now) continue;
    const idx = Math.min(nBuckets - 1, Math.floor((tMs - startMs) / bucketMs));
    const a = arch.wind_speed_avg?.[i];
    const m = arch.wind_speed_max?.[i];
    const d = arch.wind_heading?.[i];
    const b = buckets[idx];
    if (a != null && !isNaN(a)) b.avgSum += a;
    if (m != null && !isNaN(m)) b.maxSum += m;
    if (d != null && !isNaN(d)) {
      const r = d * Math.PI / 180;
      b.sx += Math.cos(r); b.sy += Math.sin(r);
    }
    b.n++;
  }

  // Calcular max velocidad para escalar altura
  let maxAvg = 0;
  const computed = buckets.map(b => {
    if (!b.n) return null;
    const avg = b.avgSum / b.n;
    const max = b.maxSum / b.n;
    let dir = null;
    if (b.sx !== 0 || b.sy !== 0) {
      dir = Math.atan2(b.sy / b.n, b.sx / b.n) * 180 / Math.PI;
      if (dir < 0) dir += 360;
    }
    if (avg > maxAvg) maxAvg = avg;
    return { avg, max, dir };
  });
  if (maxAvg <= 0) { wrap.hidden = true; return; }

  // Pintar
  arrows.innerHTML = "";
  bar.innerHTML = "";
  values.innerHTML = "";
  hours.innerHTML = "";

  for (let i = 0; i < computed.length; i++) {
    const c = computed[i];
    const tBucket = new Date(startMs + i * bucketMs);
    const tLabel = tBucket.toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit" });

    // --- Flecha ---
    const arrowEl = document.createElement("div");
    arrowEl.className = "wh-arrow";
    if (!c || c.dir == null) {
      arrowEl.classList.add("q-unknown");
      arrowEl.innerHTML = "·";
    } else {
      const dirInfo = classifyDirection(c.dir);
      const spdQ = classifySpeed(c.avg, c.max);
      const quality = spdQ === "warn" ? "warn" : dirInfo.quality;
      arrowEl.classList.add("q-" + quality);
      // wind_heading = de DÓNDE viene el viento.
      // La flecha debe apuntar HACIA DÓNDE va = heading + 180.
      // SVG con flecha apuntando hacia arriba (norte) por defecto → rotamos.
      const rot = (c.dir + 180) % 360;
      arrowEl.innerHTML = `<svg viewBox="0 0 10 10" style="transform: rotate(${rot}deg);">
        <path d="M5 1 L8 7 L5 5.5 L2 7 Z" fill="currentColor"/>
      </svg>`;
    }
    arrows.appendChild(arrowEl);

    // --- Barra ---
    const seg = document.createElement("div");
    seg.className = "wh-seg";
    if (!c) {
      seg.classList.add("q-unknown");
      seg.style.height = "8%";
      seg.title = "—";
    } else {
      const dirInfo = classifyDirection(c.dir);
      const spdQ = classifySpeed(c.avg, c.max);
      const quality = spdQ === "warn" ? "warn" : dirInfo.quality;
      seg.classList.add("q-" + quality);
      const h = Math.max(8, Math.round((c.avg / Math.max(maxAvg, 10)) * 100));
      seg.style.height = h + "%";
      seg.title = `${tLabel} · ${dirInfo.name} · ${c.avg.toFixed(1)} km/h (rachas ${c.max.toFixed(1)})`;
    }
    bar.appendChild(seg);

    // --- Valor numérico de velocidad ---
    const valEl = document.createElement("div");
    valEl.className = "wh-value";
    valEl.textContent = c ? Math.round(c.avg) : "";
    values.appendChild(valEl);

    // --- Etiqueta de hora (solo cuando el bucket cruza una hora exacta) ---
    const hourEl = document.createElement("div");
    hourEl.className = "wh-hour";
    const bucketStart = tBucket;
    const bucketEnd = new Date(tBucket.getTime() + bucketMs);
    // Si entre el inicio y el fin del bucket cae una hora exacta, mostramos esa hora
    const hourBoundary = new Date(bucketEnd.getFullYear(), bucketEnd.getMonth(), bucketEnd.getDate(), bucketEnd.getHours(), 0, 0);
    if (hourBoundary.getTime() >= bucketStart.getTime() && hourBoundary.getTime() < bucketEnd.getTime()) {
      hourEl.textContent = String(hourBoundary.getHours()).padStart(2, "0") + "h";
    } else {
      hourEl.innerHTML = "&nbsp;";
    }
    hours.appendChild(hourEl);
  }

  wrap.hidden = false;
}

// Eventos
document.getElementById("refreshBtn").addEventListener("click", () => {
  refreshObservations(); refreshForecast(); renderCompare(); renderNearby();
});

document.querySelectorAll("#forecastButtons button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#forecastButtons button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentForecastDays = parseInt(btn.dataset.days, 10);
    refreshForecast();
  });
});

document.getElementById("notifyBtn").addEventListener("click", toggleNotifications);

document.querySelectorAll("#whRange button").forEach(btn => {
  btn.addEventListener("click", () => setWindHistoryHours(parseInt(btn.dataset.h, 10)));
});

// Idioma
const langSel = document.getElementById("langSel");
if (langSel) {
  langSel.value = currentLang;
  langSel.addEventListener("change", () => {
    currentLang = langSel.value;
    localStorage.setItem("lang", currentLang);
    applyStaticI18n();
    syncNotifyButtonInitial();
    const whTitleEl = document.getElementById("whTitle");
    if (whTitleEl) whTitleEl.textContent = t("wh.titleFmt").replace("{h}", WH_HOURS);
    // Re-renderiza todo para refrescar etiquetas dinámicas
    if (map) {
      map.eachLayer(l => { if (l instanceof L.CircleMarker) map.removeLayer(l); });
    }
    refreshObservations();
    refreshForecast();
    renderCompare();
    renderNearby();
  });
}

// === Takeoff selector ===
let allStationsCache = null;
let userLocation = null; // {lat, lon} si el usuario lo ha activado
let tsRadius = parseInt(localStorage.getItem("tsRadius") || "50", 10);

function refreshAllForCurrentTakeoff() {
  // Limpia el mapa de marcadores Pioupiou y vuelve a pintar el despegue
  if (map) {
    map.eachLayer(l => {
      if (l instanceof L.CircleMarker) map.removeLayer(l);
    });
    drawTakeoffOnMap();
  }
  // Reset estado en memoria
  previousAvg = null;
  latestLive = null;
  setText("windAvg", "—"); setText("windMax", "—"); setText("windMin", "—"); setText("lastUpdate", "—");
  refreshObservations();
  refreshForecast();
  renderCompare();
  renderNearby();
}

function applyCurrentTakeoffLabel() {
  const el = document.getElementById("tsCurrentName");
  if (el) el.textContent = currentStation.shortName || currentStation.name;
  const guideEl = document.getElementById("guideTakeoffName");
  if (guideEl) guideEl.textContent = currentStation.shortName || currentStation.name;
}

function selectStation(station) {
  currentStation = station;
  currentStationId = station.id;
  currentTakeoff = { lat: station.lat, lon: station.lon, name: station.name };
  saveSelectedStation(station);
  applyCurrentTakeoffLabel();
  refreshAllForCurrentTakeoff();
}

async function ensureAllStations() {
  if (allStationsCache) return allStationsCache;
  try {
    allStationsCache = await getAllStations();
  } catch (e) {
    console.warn("getAllStations:", e);
    allStationsCache = [];
  }
  return allStationsCache;
}

function stationFromPioupiou(s) {
  const lat = s.location?.latitude, lon = s.location?.longitude;
  if (lat == null || lon == null) return null;
  return {
    id: s.id,
    provider: "pioupiou",
    name: s.meta?.name || ("Pioupiou " + s.id),
    shortName: s.meta?.name || ("Pioupiou " + s.id),
    lat, lon,
    lastDate: s.measurements?.date || null,
  };
}

function isStationRecent(s, hours = 24) {
  if (!s.lastDate) return false;
  return (Date.now() - new Date(s.lastDate).getTime()) < hours * 3600 * 1000;
}

async function tsRunSearch() {
  const resultsEl = document.getElementById("tsResults");
  if (!resultsEl) return;
  const query = (document.getElementById("tsSearch")?.value || "").trim().toLowerCase();
  const center = userLocation || { lat: currentTakeoff.lat, lon: currentTakeoff.lon };

  resultsEl.innerHTML = `<div class="ts-loading">${t("ts.loading")}</div>`;
  const all = await ensureAllStations();

  let items = all
    .map(stationFromPioupiou)
    .filter(Boolean)
    .filter(s => isStationRecent(s, 24))
    .map(s => ({ ...s, dist: haversineKm(center.lat, center.lon, s.lat, s.lon) }))
    .filter(s => s.dist <= tsRadius);

  if (query) {
    items = items.filter(s => s.name.toLowerCase().includes(query));
  }
  items.sort((a, b) => a.dist - b.dist);
  items = items.slice(0, 50);

  if (!items.length) {
    resultsEl.innerHTML = `<div class="ts-empty">${t("ts.empty")}</div>`;
    return;
  }
  resultsEl.innerHTML = "";
  for (const s of items) {
    const enabled = ENABLED_STATION_IDS.has(s.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ts-result"
      + (s.id === currentStationId ? " selected" : "")
      + (enabled ? "" : " disabled");
    if (!enabled) btn.disabled = true;
    const tail = enabled
      ? `<span class="ts-result-provider">${s.provider}</span>`
      : `<span class="ts-result-soon">${t("ts.coming_soon")}</span>`;
    btn.innerHTML = `
      <span class="ts-result-name">${escapeHtml(s.name)}</span>
      <span class="ts-result-dist">${s.dist.toFixed(1)} km</span>
      ${tail}
    `;
    if (enabled) {
      btn.addEventListener("click", () => {
        selectStation({ id: s.id, provider: s.provider, name: s.name, shortName: s.name, lat: s.lat, lon: s.lon });
        document.getElementById("tsPanel").hidden = true;
        document.getElementById("tsToggleBtn").setAttribute("aria-expanded", "false");
      });
    }
    resultsEl.appendChild(btn);
  }
}

function initTakeoffSelector() {
  applyCurrentTakeoffLabel();
  const searchEl = document.getElementById("tsSearch");
  const radiusEl = document.getElementById("tsRadius");
  const radiusValEl = document.getElementById("tsRadiusValue");
  const panel = document.getElementById("tsPanel");
  const toggleBtn = document.getElementById("tsToggleBtn");
  const locateBtn = document.getElementById("tsLocateBtn");

  if (radiusEl) {
    radiusEl.value = String(tsRadius);
    if (radiusValEl) radiusValEl.textContent = String(tsRadius);
    radiusEl.addEventListener("input", () => {
      tsRadius = parseInt(radiusEl.value, 10);
      if (radiusValEl) radiusValEl.textContent = String(tsRadius);
      localStorage.setItem("tsRadius", String(tsRadius));
      tsRunSearch();
    });
  }

  let searchTimer = null;
  if (searchEl) {
    searchEl.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(tsRunSearch, 200);
      // Abrir panel automáticamente al escribir
      if (panel?.hidden) {
        panel.hidden = false;
        toggleBtn?.setAttribute("aria-expanded", "true");
        tsRunSearch();
      }
    });
  }

  if (toggleBtn && panel) {
    toggleBtn.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      toggleBtn.setAttribute("aria-expanded", panel.hidden ? "false" : "true");
      if (!panel.hidden) tsRunSearch();
    });
  }

  if (locateBtn) {
    locateBtn.addEventListener("click", () => {
      if (!("geolocation" in navigator)) {
        alert(t("ts.geo_unavailable"));
        return;
      }
      locateBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          locateBtn.classList.add("active");
          locateBtn.disabled = false;
          if (panel) {
            panel.hidden = false;
            toggleBtn?.setAttribute("aria-expanded", "true");
          }
          tsRunSearch();
        },
        (err) => {
          console.warn("geolocation:", err);
          alert(t("ts.geo_denied"));
          locateBtn.disabled = false;
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    });
  }
}

// Inicialización
applyStaticI18n();
syncNotifyButtonInitial();
initTakeoffSelector();
initOrientationToggle();
renderMap();
// Sincroniza UI del selector de horas con el valor cargado
document.querySelectorAll("#whRange button").forEach(b => {
  b.classList.toggle("active", parseInt(b.dataset.h, 10) === WH_HOURS);
});
const _whTitleInit = document.getElementById("whTitle");
if (_whTitleInit) _whTitleInit.textContent = t("wh.titleFmt").replace("{h}", WH_HOURS);
refreshObservations();
refreshForecast();
renderCompare();
renderNearby();
setInterval(refreshLiveOnly, REFRESH_MS);
