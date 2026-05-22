// === Configuración ===
const STATION_ID = 1638; // Los Majojos - Cenes de la Vega
const API_BASE = "https://api.pioupiou.fr/v1";
const CORS_PROXY = "https://corsproxy.io/?";

// Coordenadas del despegue: Cerro de los Majojos (pico, IGN). 1359 m
const TAKEOFF = { lat: 37.1406, lon: -3.5124, name: "Despegue Cerro de los Majojos" };

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
    "read.max": "Ráfaga máx.",
    "read.min": "Mínima",
    "read.last": "Última lectura",
    "verdict.loading": "Cargando…",
    "verdict.ideal.title": "Condiciones ideales ✅",
    "verdict.ideal.detail": "Buena dirección y velocidad en el rango óptimo.",
    "verdict.ok.title": "Volable ⚠️",
    "verdict.ok.detail": "Aceptable pero no óptimo. Valora con criterio.",
    "verdict.bad.title": "Dirección desfavorable ❌",
    "verdict.bad.detail": "Componente este: viento entrando por detrás o cruzado.",
    "verdict.warn.title": "Viento demasiado fuerte 🚫",
    "verdict.warn.detail": "Velocidad o ráfagas por encima del límite seguro.",
    "verdict.unknown.title": "Sin datos",
    "verdict.unknown.detail": "No se pueden valorar las condiciones.",
    "verdict.suffix": "Dirección: {name}. Media {avg} km/h, ráfaga {max} km/h.",
    "dirLabel.from": "Viene del {name} ({deg}°)",
    "dirLabel.dash": "—",
    "hist.title": "Evolución observada",
    "hist.legend": "Línea azul: velocidad media · Línea roja: ráfaga máx · Puntos: dirección (color = aptitud)",
    "chart.avg": "Velocidad media (km/h)",
    "chart.gust": "Ráfaga máx (km/h)",
    "chart.dir": "Dirección",
    "chart.dir_tooltip": "Dir: {name} ({deg}°)",
    "fc.title": "Pronóstico (Open-Meteo)",
    "fc.today": "Hoy",
    "cmp.title": "Comparativa últimos días",
    "cmp.window": "({h1}:00–{h2}:00 local)",
    "cmp.yesterday": "Ayer",
    "cmp.days_ago": "Hace {n} días",
    "cmp.no_data": "Sin datos",
    "cmp.row.avg": "Media",
    "cmp.row.max": "Ráfaga máx",
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
    "guide.ideal": "<strong>Ideal:</strong> Oeste (O) o Noroeste (NO), 5–15 km/h (ráfagas ≤ 25).",
    "guide.ok": "<strong>Volable:</strong> Norte (N) o Suroeste (SO), o vientos fuera del rango ideal pero por debajo del límite.",
    "guide.bad": "<strong>Malo:</strong> componentes Este (NE, E, SE) — empeora cuanto más al Este.",
    "guide.warn": "<strong>Demasiado fuerte:</strong> media ≥ 20 km/h o ráfagas ≥ 30 km/h.",
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
    "best.none": "Sin ventanas óptimas en las próximas 12 h.",
    "best.ideal": "✅ Ideal",
    "best.ok": "⚠️ Volable",
    "near.airport_label": "Aeropuerto de Granada (LEGR)",
    "near.airport_src": "Open-Meteo (METAR aprox.)",
    "banner.title": "Despegue de parapente de Cenes de la Vega",
    "verdict.rain_suffix": "Probabilidad de precipitación significativa.",
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
    "dirLabel.from": "Coming from {name} ({deg}°)",
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
    "best.none": "No optimal windows in the next 12 h.",
    "best.ideal": "✅ Ideal",
    "best.ok": "⚠️ Flyable",
    "near.airport_label": "Granada Airport (LEGR)",
    "near.airport_src": "Open-Meteo (approx. METAR)",
    "banner.title": "Paragliding takeoff of Cenes de la Vega",
    "verdict.rain_suffix": "Significant precipitation probability.",
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
    "locale": "en-GB"
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
    "dirLabel.from": "Aus {name} ({deg}°)",
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
    "best.none": "Keine optimalen Fenster in den nächsten 12 h.",
    "best.ideal": "✅ Ideal",
    "best.ok": "⚠️ Fliegbar",
    "near.airport_label": "Flughafen Granada (LEGR)",
    "near.airport_src": "Open-Meteo (ca. METAR)",
    "banner.title": "Gleitschirm-Startplatz von Cenes de la Vega",
    "verdict.rain_suffix": "Erhebliche Niederschlagswahrscheinlichkeit.",
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
    "locale": "de-DE"
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
    "dirLabel.from": "Vient du {name} ({deg}°)",
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
    "best.none": "Pas de créneau optimal dans les 12 h.",
    "best.ideal": "✅ Idéal",
    "best.ok": "⚠️ Volable",
    "near.airport_label": "Aéroport de Grenade (LEGR)",
    "near.airport_src": "Open-Meteo (METAR approx.)",
    "banner.title": "Décollage parapente de Cenes de la Vega",
    "verdict.rain_suffix": "Probabilité significative de précipitations.",
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
    "locale": "fr-FR"
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
  // Demasiado fuerte: media ≥ 20 km/h o ráfagas ≥ 30 km/h.
  if (avg >= 20 || (max != null && max >= 30)) return "warn";
  // Ideal: media entre 5 y 15 km/h con ráfagas hasta 25 km/h.
  if (avg >= 5 && avg <= 15 && (max == null || max <= 25)) return "ideal";
  // Resto: volable.
  return "ok";
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
  const data = await fetchJson(`${API_BASE}/live/${STATION_ID}`);
  return data?.data;
}

async function getArchive(startDate, stopDate) {
  const fmt = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const url = `${API_BASE}/archive/${STATION_ID}?start=${fmt(startDate)}&stop=${fmt(stopDate)}`;
  const data = await fetchJson(url);
  return data?.data;
}

async function getArchiveLastHours(hours) {
  const stop = new Date();
  const start = new Date(stop.getTime() - hours * 3600 * 1000);
  return getArchive(start, stop);
}

async function getForecast(days = 2) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${TAKEOFF.lat}&longitude=${TAKEOFF.lon}` +
              `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation_probability,weather_code,cape,temperature_2m,apparent_temperature` +
              `&daily=sunrise,sunset` +
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
    code: h.weather_code?.[i],
    precip: h.precipitation_probability?.[i],
    cape: h.cape?.[i],
    temp: h.temperature_2m?.[i],
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
    ? t("dirLabel.from", { name: dirInfo.name, deg: Math.round(dir) })
    : t("dirLabel.dash"));

  // El wedge en el borde apunta hacia el centro desde la posición de origen del viento.
  const wedge = document.getElementById("windWedge");
  if (wedge && dir != null) {
    wedge.style.transform = `rotate(${dir}deg)`;
    wedge.dataset.quality = dirInfo.quality;
  }

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
  }
  if (risk === "storm") detail += " " + t("verdict.storm_suffix");
  else if (risk === "rain") detail += " " + t("verdict.rain_suffix");
  setText("verdictDetail", detail);

  renderWeatherStrip(cw, risk);

  maybeNotify(verdict, dirInfo, avg, max);
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
function renderBestWindow(fc) {
  const box = document.getElementById("bestWindow");
  if (!box || !fc?.hourly) return;
  const h = fc.hourly;
  const now = Date.now();
  const horizonMs = now + 12 * 3600 * 1000;
  const runs = []; // {start,end,quality}
  let cur = null;
  for (let i = 0; i < h.time.length; i++) {
    const ts = new Date(h.time[i]).getTime();
    if (ts < now - 30 * 60 * 1000) continue;
    if (ts > horizonMs) break;
    const hour = new Date(h.time[i]).getHours();
    if (hour < 8 || hour > 20) { if (cur) { runs.push(cur); cur = null; } continue; }
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
  const best = runs[0];
  if (!best) {
    box.hidden = false;
    box.className = "best-window none";
    box.querySelector(".bw-label").textContent = t("best.label");
    box.querySelector("#bestWindowText").textContent = t("best.none");
    return;
  }
  box.hidden = false;
  box.className = "best-window " + (best.quality === "ideal" ? "" : "ok");
  const fmtHM = (ms) => new Date(ms).toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit" });
  const tag = best.quality === "ideal" ? t("best.ideal") : t("best.ok");
  box.querySelector(".bw-label").textContent = t("best.label");
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

  // Filtrar a partir de la hora actual
  const now = Date.now();
  const idxStart = times.findIndex(t => t.getTime() >= now - 3600 * 1000);
  const i0 = Math.max(0, idxStart);

  const spdPts = times.slice(i0).map((t, i) => ({ x: t, y: spd[i + i0] }));
  const gustPts = times.slice(i0).map((t, i) => ({ x: t, y: gust[i + i0] }));
  const dirPts = times.slice(i0).map((t, i) => ({ x: t, y: spd[i + i0], dir: dir[i + i0] }));
  const dirColors = dirPts.map(p => dirColor(p.dir));

  const data = {
    datasets: [
      { label: t("chart.gust"), data: gustPts,
        borderColor: "rgba(231,76,60,0.9)", backgroundColor: "rgba(231,76,60,0.15)",
        borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
      { label: t("chart.avg"), data: spdPts,
        borderColor: "rgba(78,161,255,1)", backgroundColor: "rgba(78,161,255,0.2)",
        borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true },
      { label: t("chart.dir"), data: dirPts, type: "scatter",
        pointBackgroundColor: dirColors, pointBorderColor: dirColors,
        pointRadius: 3, showLine: false, parsing: false },
    ],
  };
  const options = chartCommonOptions();

  if (forecastChart) { forecastChart.data = data; forecastChart.options = options; forecastChart.update(); }
  else forecastChart = new Chart(ctx, { type: "line", data, options });

  // Resumen: próximas horas en franja diurna
  const summary = document.getElementById("forecastSummary");
  summary.innerHTML = "";
  const maxSlots = currentForecastDays === 1 ? 12 : 16;
  let added = 0;
  for (let i = i0; i < times.length && added < maxSlots; i++) {
    const h = times[i].getHours();
    // Sólo horas diurnas razonables para volar
    if (h < 8 || h > 20) continue;
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
  const now = new Date();
  const hour = now.getHours();
  const winLabel = t("cmp.window", {
    h1: String(Math.max(0, hour - 2)).padStart(2,"0"),
    h2: String(Math.min(23, hour + 2)).padStart(2,"0"),
  });
  setText("compareWindowLabel", winLabel);

  grid.innerHTML = "";
  const days = [1, 2, 3];
  const results = await Promise.all(days.map(async (offset) => {
    const center = new Date(now.getTime() - offset * 24 * 3600 * 1000);
    const start = new Date(center); start.setHours(hour - 2, 0, 0, 0);
    const stop  = new Date(center); stop.setHours(hour + 2, 0, 0, 0);
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
    card.className = "compare-card " + verdict;
    card.innerHTML = `
      <h3>${dayLabel} <small style="color:var(--muted);font-weight:400">${r.start.toLocaleDateString(t("locale"),{day:"2-digit",month:"short"})}</small></h3>
      <div class="row"><span>${t("cmp.row.avg")}</span><b>${fmtNum(avg)} km/h</b></div>
      <div class="row"><span>${t("cmp.row.max")}</span><b>${fmtNum(max)} km/h</b></div>
      <div class="row"><span>${t("cmp.row.dir")}</span><b>${dirInfo.name} (${Math.round(dirAvg)}°)</b></div>
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
  map = L.map("map").setView([TAKEOFF.lat, TAKEOFF.lon], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap", maxZoom: 18,
  }).addTo(map);
  L.marker([TAKEOFF.lat, TAKEOFF.lon]).addTo(map)
    .bindPopup(`<b>${TAKEOFF.name}</b><br/>${t("popup.takeoff_sub")}`)
    .bindTooltip(TAKEOFF.name.replace(/^Despegue\s+/i, ""), {
      permanent: true, direction: "top", offset: [0, -8], className: "station-label takeoff"
    })
    .openPopup();
  // Radio 50 km
  L.circle([TAKEOFF.lat, TAKEOFF.lon], {
    radius: 50000, color: "#4ea1ff", weight: 1, fillOpacity: 0.05, dashArray: "4,4",
  }).addTo(map);
}

// === Estaciones cercanas ===
// Cada estación tiene sus propios criterios de volabilidad (no los conocemos),
// así que mostramos solo la dirección y la intensidad media de las últimas horas.
const NEARBY_AVG_HOURS = 3;
let nearbyLatLngs = [];

function fitMapToNearby() {
  if (!map || !nearbyLatLngs.length) return;
  const pts = [[TAKEOFF.lat, TAKEOFF.lon], ...nearbyLatLngs];
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
        const dist = haversineKm(TAKEOFF.lat, TAKEOFF.lon, lat, lon);
        return { s, dist, lat, lon };
      })
      .filter(x => x && x.dist <= 50 && x.s.id !== STATION_ID)
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
        nearbyLatLngs.push([s.location.latitude, s.location.longitude]);
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
        const arch = data?.data;
        let avgSpd = null, meanDir = null;
        if (arch?.date?.length) {
          avgSpd = avgOf(arch.wind_speed_avg);
          meanDir = meanAngle(arch.wind_heading);
        }
        // Fallback al snapshot live si no hay archive
        if (avgSpd == null) avgSpd = s.measurements?.wind_speed_avg;
        if (meanDir == null) meanDir = s.measurements?.wind_heading;

        const dirInfo = classifyDirection(meanDir);
        const arrowG = card.querySelector(".mc-arrow-g");
        const arrowPoly = card.querySelector(".mc-arrow");
        if (arrowG && meanDir != null) {
          arrowG.setAttribute("transform", `rotate(${meanDir} 50 50)`);
        }
        if (arrowPoly && dirInfo.quality !== "unknown") {
          arrowPoly.classList.remove("quality-ideal", "quality-ok", "quality-bad");
          arrowPoly.classList.add("quality-" + dirInfo.quality);
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
  await renderAirportStation();
  fitMapToNearby();
}

async function renderAirportStation() {
  const grid = document.getElementById("nearbyGrid");
  if (!grid) return;
  const lat = 37.1887, lon = -3.7775; // LEGR
  const dist = haversineKm(TAKEOFF.lat, TAKEOFF.lon, lat, lon);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=auto`;
    const data = await fetchJson(url);
    const cur = data?.current;
    if (!cur) return;
    const spd = cur.wind_speed_10m;
    const dir = cur.wind_direction_10m;
    const dirInfo = classifyDirection(dir);
    const card = document.createElement("div");
    card.className = "nearby-card airport";
    const label = t("near.airport_label");
    card.innerHTML = `
      <h3>
        <a href="https://www.windy.com/-?37.1887,-3.7775,11" target="_blank" rel="noopener">${escapeHtml(label)}</a>
        <small>${dist.toFixed(1)} km</small>
      </h3>
      <div class="mini-compass">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <text x="50" y="14" text-anchor="middle" class="mc-card">N</text>
          <text x="50" y="92" text-anchor="middle" class="mc-card">S</text>
          <text x="91" y="54" text-anchor="middle" class="mc-card">E</text>
          <text x="9"  y="54" text-anchor="middle" class="mc-card">O</text>
          <g class="mc-arrow-g" transform="rotate(${dir ?? 0} 50 50)">
            <polygon class="mc-arrow ${dirInfo.quality !== 'unknown' ? 'quality-' + dirInfo.quality : ''}" points="50,32 42,12 58,12" />
          </g>
          <circle cx="50" cy="50" r="3" fill="#4ea1ff"/>
        </svg>
      </div>
      <div class="nearby-meta">
        <div class="nearby-dir">${dir != null ? dirInfo.name + ' · ' + Math.round(dir) + '°' : '—'}</div>
        <div class="nearby-avg"><b>${fmtNum(spd)}</b> <span>km/h</span></div>
        <div class="badge-src">${t("near.airport_src")}</div>
      </div>
    `;
    grid.appendChild(card);
    if (map) {
      L.circleMarker([lat, lon], {
        radius: 7, color: "#fff", weight: 1, fillColor: "#f1c40f", fillOpacity: 0.9,
      }).addTo(map)
        .bindPopup(`<b>${escapeHtml(label)}</b><br/>${dist.toFixed(1)} km`)
        .bindTooltip(label, {
          permanent: true, direction: "right", offset: [8, 0], className: "station-label airport"
        });
      nearbyLatLngs.push([lat, lon]);
    }
  } catch (e) { console.warn("airport station:", e); }
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
    btn.textContent = t("btn.notify_off");
    return;
  }
  let perm = Notification.permission;
  if (perm !== "granted") perm = await Notification.requestPermission();
  if (perm === "granted") {
    localStorage.setItem("notifyEnabled", "1");
    btn.classList.add("active");
    btn.textContent = t("btn.notify_on");
  } else {
    alert(t("notify.denied"));
  }
}

function syncNotifyButtonInitial() {
  const btn = document.getElementById("notifyBtn");
  if (notificationsEnabled()) {
    btn.classList.add("active");
    btn.textContent = t("btn.notify_on");
  } else {
    btn.textContent = t("btn.notify_off");
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
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("SW:", err));
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
}

async function refreshForecast() {
  try {
    const fc = await getForecast(currentForecastDays);
    renderForecast(fc);
  } catch (e) {
    console.error("forecast:", e);
  }
}

async function refreshLiveOnly() {
  try { renderLive(await getLive()); } catch (e) { console.error(e); }
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

// Idioma
const langSel = document.getElementById("langSel");
if (langSel) {
  langSel.value = currentLang;
  langSel.addEventListener("change", () => {
    currentLang = langSel.value;
    localStorage.setItem("lang", currentLang);
    applyStaticI18n();
    syncNotifyButtonInitial();
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

// Inicialización
applyStaticI18n();
syncNotifyButtonInitial();
renderMap();
refreshObservations();
refreshForecast();
renderCompare();
renderNearby();
setInterval(refreshLiveOnly, REFRESH_MS);
