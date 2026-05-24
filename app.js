// === Configuración ===
const DEFAULT_STATION = {
  id: 1638,
  provider: "pioupiou",
  name: "Despegue Cerro de los Majojos",
  shortName: "Cenes de la Vega",
  lat: 37.1406,
  lon: -3.5124,
};
// v103: modelo "takeoff-centric".
//   currentTakeoff = el LUGAR donde se vuela (lat/lon de la ladera, criterios, notas).
//   currentStation = la FUENTE DE DATOS de viento (estación AEMET/Holfuy/Pioupiou) asociada.
// Una estación elegida sin despegue comunitario produce un takeoff "ligero" sin criterios
// → el veredicto cae a NEUTRAL, no a los criterios de Cenes (evita falsos "ideal").
let currentStation = loadSavedStation() || { ...DEFAULT_STATION };
let currentStationId = currentStation.id;
let currentTakeoff = {
  id: null,                    // doc id en `takeoffs` (Firestore) si viene de la comunidad
  name: currentStation.name,
  shortName: currentStation.shortName || currentStation.name,
  lat: currentStation.lat,
  lon: currentStation.lon,
  alt: currentStation.alt ?? null,
  criteria: null,              // {qualityByIndex:[16], windMin, windMax, gustMax}
  orientations: "",
  notes: "",
};
// Aliases mantenidos por retro-compatibilidad con el resto del código. Se sincronizan
// con currentTakeoff a través de setCurrent(...). NO escribir directamente.
let currentTakeoffCriteria = null;
let currentTakeoffOriginId = null;

// Despegues con criterios de volabilidad ya definidos.
// Hasta definir el resto, sólo estos serán seleccionables en el buscador.
const ENABLED_STATION_IDS = new Set([1638]);

const API_BASE = "https://api.pioupiou.fr/v1";
const CORS_PROXY = "https://corsproxy.io/?";
// Proxies CORS alternativos para reintentar si el primario falla (AEMET y otras APIs
// sin CORS suelen dar 5xx o ERR_EMPTY_RESPONSE de forma intermitente).
const CORS_PROXIES = [
  (u) => "https://corsproxy.io/?" + encodeURIComponent(u),
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
];

// === Tema (claro / oscuro / auto) ===
const THEME_VALUES = ["auto", "dark", "light"];
const THEME_ICON = { auto: "💻", dark: "🌙", light: "☀️" };
let currentTheme = (function() {
  const saved = localStorage.getItem("theme");
  return THEME_VALUES.includes(saved) ? saved : "dark";
})();
function applyTheme(theme) {
  if (!THEME_VALUES.includes(theme)) theme = "auto";
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  const ico = document.getElementById("themeIcon");
  if (ico) ico.textContent = THEME_ICON[theme];
  const btn = document.getElementById("themeToggle");
  if (btn) btn.setAttribute("title", (typeof t === "function" ? t(`theme.${theme}`) : theme));
  localStorage.setItem("theme", theme);
  window.PCAuth?.savePref?.("theme", theme);
}
// Aplica inmediatamente para evitar parpadeo (antes incluso de DOMContentLoaded)
document.documentElement.setAttribute("data-theme", currentTheme);

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
  window.PCAuth?.savePref?.("selectedStation", JSON.stringify(s));
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
    "fc.night": "Noche",
    "fc.show": "Mostrar en el gráfico:",
    "auth.title": "Cuenta",
    "auth.guest": "Invitado",
    "auth.anon": "Anónimo",
    "auth.user": "Usuario",
    "auth.tab_login": "Entrar",
    "auth.tab_register": "Registrarse",
    "auth.email_ph": "email@dominio.com",
    "auth.pwd_ph": "contraseña",
    "auth.pwd_new_ph": "contraseña (mín. 6)",
    "auth.login": "Entrar",
    "auth.register": "Crear cuenta",
    "auth.logout": "Cerrar sesión",
    "auth.magic": "Enviarme enlace al email",
    "auth.magic_sent": "Enlace enviado. Revisa tu email.",
    "auth.google": "Continuar con Google",
    "auth.anon_btn": "Continuar sin cuenta",
    "auth.or": "o",
    "auth.signed_as": "Conectado como",
    "auth.confirm_email": "Confirma tu email para completar el inicio de sesión:",
    "auth.err_fields": "Rellena email y contraseña.",
    "auth.err_email_required": "Introduce tu email.",
    "auth.err_invalid_email": "Email no válido.",
    "auth.err_user_not_found": "No existe ese usuario.",
    "auth.err_wrong_password": "Email o contraseña incorrectos.",
    "auth.err_email_in_use": "Ese email ya está registrado.",
    "auth.err_pwd_short": "La contraseña debe tener al menos 6 caracteres.",
    "auth.err_popup_blocked": "El navegador bloqueó la ventana. Intenta de nuevo.",
    "to.propose": "Dar de alta datos de despegue",
    "to.submit_title": "Añadir datos de despegue",
    "to.submit_hint": "Tu propuesta será revisada por un administrador antes de publicarse.",
    "to.name_ph": "Nombre del despegue",
    "to.lat_ph": "Latitud",
    "to.lon_ph": "Longitud",
    "to.alt_ph": "Altitud (m)",
    "to.orient_ph": "Orientaciones (N, NO, O…)",
    "to.station_ph": "ID estación Pioupiou (opcional)",
    "to.notes_ph": "Notas (acceso, peligros…)",
    "to.pick_map": "📍 Usar coordenadas actuales del mapa",
    "to.submit": "Enviar para revisión",
    "to.cancel": "Cancelar",
    "to.submit_ok": "¡Enviado! Recibirás una respuesta tras la revisión.",
    "to.submit_err": "No se pudo enviar la propuesta.",
    "to.submit_login": "Debes iniciar sesión para proponer un despegue.",
    "to.admin_open": "🛡️ Revisar despegues pendientes",
    "to.admin_title": "Despegues pendientes de revisión",
    "to.admin_empty": "No hay despegues pendientes.",
    "to.approve": "Aprobar",
    "to.reject": "Rechazar",
    "to.reject_prompt": "Motivo del rechazo (opcional):",
    "to.delete": "Eliminar",
    "to.community_badge": "comunidad",
    "to.submitted_by": "Propuesto por",
    "to.criteria_title": "Criterios de vuelo",
    "to.dirs_hint": "Pulsa cada dirección para marcarla como Ideal (verde), Volable (amarillo) o Peligrosa (rojo).",
    "to.wind_min": "Viento mín. ideal (km/h)",
    "to.wind_max": "Viento máx. ideal (km/h)",
    "to.gust_max": "Racha máx. segura (km/h)",
    "to.suggest": "Sugerir cambios",
    "to.suggest_title": "Sugerir cambios al despegue",
    "to.suggest_submit": "Enviar sugerencia",
    "to.suggest_ok": "Sugerencia enviada. La revisará un administrador.",
    "to.suggest_notfound": "No se ha encontrado el despegue de origen.",
    "to.suggestion_badge": "sugerencia",
    "act.orient_toggle": "Orientación en tiempo real (brújula del dispositivo)",
    "fav.add": "Marcar como favorito",
    "fav.remove": "Quitar de favoritos",
    "fav.home_set": "Marcar como despegue habitual",
    "fav.home_unset": "Quitar como despegue habitual",
    "fav.alert_on": "Activar alertas para este despegue",
    "fav.alert_off": "Desactivar alertas",
    "fav.section": "Tus despegues",
    "fav.others": "Resultados cercanos",
    "fav.notify_title": "🦂 Condiciones ideales en {name}",
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
    "guide.label_ideal": "Ideal",
    "guide.label_ok": "Volable",
    "guide.label_bad": "Malo",
    "guide.label_warn": "Demasiado fuerte",
    "guide.no_dirs": "ninguna",
    "guide.rest": "resto",
    "guide.no_orient": "sin orientaciones definidas",
    "guide.fmt_ideal": "<strong>{label}:</strong> {dirs}{range}.",
    "guide.fmt_ok": "<strong>{label}:</strong> {dirs}.",
    "guide.fmt_bad": "<strong>{label}:</strong> {dirs}.",
    "guide.fmt_warn": "<strong>{label}:</strong> media ≥ {avg} km/h o rachas ≥ {gust} km/h.",
    "guide.range_fmt": ", {min}–{max} km/h",
    "guide.range_min": ", desde {min} km/h",
    "guide.range_max": ", hasta {max} km/h",
    "guide.notes_title": "Notas del despegue",
    "help.title": "Ayuda",
    "help.quick": "<p><strong>Guía rápida:</strong></p><ul><li>🧭 La <strong>brújula</strong> muestra los sectores verde/amarillo/rojo del despegue actual y una flecha con el viento en vivo.</li><li>📍 Pulsa el botón de ubicación para que las distancias se midan desde tu posición real.</li><li>🔍 Escribe en el buscador para filtrar despegues; los favoritos salen primero.</li><li>★ marca favoritos, 👑 fija tu \"hogar\", 🔔 activa alertas cuando las condiciones sean ideales.</li><li>+ propone un despegue nuevo · ✎ sugiere cambios en uno ya registrado.</li><li>📲 instala la app como PWA para usarla offline.</li><li>⚠️ Los datos son orientativos. Valora siempre las condiciones in situ.</li></ul>",
    "help.full_docs": "Ver documentación completa",
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
    "wx.storm_level.vlow": "muy bajo",
    "wx.storm_level.low":  "bajo",
    "wx.storm_level.med":  "medio",
    "wx.storm_level.high": "alto",
    "wx.storm_level.none": "ninguno",
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
    "ts.placeholder": "Buscar despegues cercanos o favoritos",
    "ts.current": "Despegue:",
    "ts.radius": "Radio",
    "ts.no_radius": "Sin límite",
    "theme.title": "Tema (auto/oscuro/claro)",
    "theme.auto": "Tema: automático",
    "theme.dark": "Tema: oscuro",
    "theme.light": "Tema: claro",
    "menu.lang": "Idioma",
    "menu.theme": "Tema",
    "menu.notify": "Avisos",
    "menu.install": "Instalar app",
    "menu.help": "Ayuda",
    "menu.admin_review": "Revisar despegues",
    "panel.for_to_st": "Mostrando: {to} · datos de la estación {st}",
    "panel.for_st": "Mostrando datos de la estación {st}",
    "menu.account": "Cuenta",
    "ts.locate": "Usar mi ubicación",
    "ts.hint": "Pulsa 📍 para usar tu ubicación o escribe para filtrar.",
    "ts.loading": "Cargando estaciones…",
    "ts.empty": "No hay estaciones activas en este radio.",
    "ts.empty_global": "No hay estaciones disponibles con los filtros actuales.",
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
    "fc.night": "Night",
    "fc.show": "Show on chart:",
    "auth.title": "Account",
    "auth.guest": "Guest",
    "auth.anon": "Anonymous",
    "auth.user": "User",
    "auth.tab_login": "Sign in",
    "auth.tab_register": "Sign up",
    "auth.email_ph": "email@domain.com",
    "auth.pwd_ph": "password",
    "auth.pwd_new_ph": "password (min. 6)",
    "auth.login": "Sign in",
    "auth.register": "Create account",
    "auth.logout": "Sign out",
    "auth.magic": "Email me a sign-in link",
    "auth.magic_sent": "Link sent. Check your inbox.",
    "auth.google": "Continue with Google",
    "auth.anon_btn": "Continue without account",
    "auth.or": "or",
    "auth.signed_as": "Signed in as",
    "auth.confirm_email": "Confirm your email to complete sign-in:",
    "auth.err_fields": "Fill in email and password.",
    "auth.err_email_required": "Enter your email.",
    "auth.err_invalid_email": "Invalid email.",
    "auth.err_user_not_found": "User not found.",
    "auth.err_wrong_password": "Wrong email or password.",
    "auth.err_email_in_use": "That email is already registered.",
    "auth.err_pwd_short": "Password must be at least 6 characters.",
    "auth.err_popup_blocked": "Popup blocked. Try again.",
    "to.propose": "Register takeoff details",
    "to.submit_title": "Add takeoff data",
    "to.submit_hint": "Your proposal will be reviewed by an admin before publishing.",
    "to.name_ph": "Takeoff name",
    "to.lat_ph": "Latitude",
    "to.lon_ph": "Longitude",
    "to.alt_ph": "Altitude (m)",
    "to.orient_ph": "Orientations (N, NW, W…)",
    "to.station_ph": "Pioupiou station ID (optional)",
    "to.notes_ph": "Notes (access, hazards…)",
    "to.pick_map": "📍 Use current map coordinates",
    "to.submit": "Submit for review",
    "to.cancel": "Cancel",
    "to.submit_ok": "Sent! You'll get a reply after review.",
    "to.submit_err": "Could not submit the proposal.",
    "to.submit_login": "You must sign in to propose a takeoff.",
    "to.admin_open": "🛡️ Review pending takeoffs",
    "to.admin_title": "Pending takeoffs to review",
    "to.admin_empty": "No pending takeoffs.",
    "to.approve": "Approve",
    "to.reject": "Reject",
    "to.reject_prompt": "Reason (optional):",
    "to.delete": "Delete",
    "to.community_badge": "community",
    "to.submitted_by": "Proposed by",
    "to.criteria_title": "Flight criteria",
    "to.dirs_hint": "Tap each direction to mark as Ideal (green), Flyable (yellow) or Dangerous (red).",
    "to.wind_min": "Ideal wind min (km/h)",
    "to.wind_max": "Ideal wind max (km/h)",
    "to.gust_max": "Max safe gust (km/h)",
    "to.suggest": "Suggest changes",
    "to.suggest_title": "Suggest changes to takeoff",
    "to.suggest_submit": "Send suggestion",
    "to.suggest_ok": "Suggestion sent. An admin will review it.",
    "to.suggest_notfound": "Origin takeoff not found.",
    "to.suggestion_badge": "suggestion",
    "act.orient_toggle": "Live orientation (device compass)",
    "fav.add": "Add to favorites",
    "fav.remove": "Remove from favorites",
    "fav.home_set": "Mark as default takeoff",
    "fav.home_unset": "Unset default takeoff",
    "fav.alert_on": "Enable alerts for this takeoff",
    "fav.alert_off": "Disable alerts",
    "fav.section": "Your takeoffs",
    "fav.others": "Nearby results",
    "fav.notify_title": "🦂 Ideal conditions at {name}",
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
    "help.title": "Help",
    "help.quick": "<p><strong>Quick guide:</strong></p><ul><li>🧭 The <strong>compass</strong> shows the current takeoff's green/yellow/red sectors and a live wind arrow.</li><li>📍 Tap the location button so distances are measured from your real position.</li><li>🔍 Type in the search to filter takeoffs; favorites appear first.</li><li>★ marks favorites, 👑 sets your \"home\", 🔔 enables alerts for ideal conditions.</li><li>+ proposes a new takeoff · ✎ suggests changes to an existing one.</li><li>📲 install the app as a PWA to use it offline.</li><li>⚠️ Data is indicative. Always assess conditions on site.</li></ul>",
    "help.full_docs": "View full documentation",
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
    "wx.storm_level.vlow": "very low",
    "wx.storm_level.low":  "low",
    "wx.storm_level.med":  "medium",
    "wx.storm_level.high": "high",
    "wx.storm_level.none": "none",
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
    "ts.placeholder": "Search nearby or favorite takeoffs",
    "ts.current": "Takeoff:",
    "ts.radius": "Radius",
    "ts.no_radius": "No limit",
    "theme.title": "Theme (auto/dark/light)",
    "menu.lang": "Language",
    "menu.theme": "Theme",
    "menu.notify": "Alerts",
    "menu.install": "Install app",
    "menu.help": "Help",
    "menu.admin_review": "Review takeoffs",
    "panel.for_to_st": "Showing: {to} · data from station {st}",
    "panel.for_st": "Showing data from station {st}",
    "menu.account": "Account",
    "theme.auto": "Theme: automatic",
    "theme.dark": "Theme: dark",
    "theme.light": "Theme: light",
    "ts.locate": "Use my location",
    "ts.hint": "Tap 📍 to use your location or type to filter.",
    "ts.loading": "Loading stations…",
    "ts.empty": "No active stations within this radius.",
    "ts.empty_global": "No stations available with the current filters.",
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
    "fc.night": "Nacht",
    "fc.show": "Im Diagramm anzeigen:",
    "auth.title": "Konto",
    "auth.guest": "Gast",
    "auth.anon": "Anonym",
    "auth.user": "Benutzer",
    "auth.tab_login": "Anmelden",
    "auth.tab_register": "Registrieren",
    "auth.email_ph": "email@domain.com",
    "auth.pwd_ph": "Passwort",
    "auth.pwd_new_ph": "Passwort (min. 6)",
    "auth.login": "Anmelden",
    "auth.register": "Konto erstellen",
    "auth.logout": "Abmelden",
    "auth.magic": "Link per E-Mail senden",
    "auth.magic_sent": "Link gesendet. Prüfe deine E-Mail.",
    "auth.google": "Mit Google fortfahren",
    "auth.anon_btn": "Ohne Konto fortfahren",
    "auth.or": "oder",
    "auth.signed_as": "Angemeldet als",
    "auth.confirm_email": "Bestätige deine E-Mail, um die Anmeldung abzuschließen:",
    "auth.err_fields": "E-Mail und Passwort eingeben.",
    "auth.err_email_required": "E-Mail eingeben.",
    "auth.err_invalid_email": "Ungültige E-Mail.",
    "auth.err_user_not_found": "Benutzer nicht gefunden.",
    "auth.err_wrong_password": "Falsche E-Mail oder Passwort.",
    "auth.err_email_in_use": "E-Mail ist bereits registriert.",
    "auth.err_pwd_short": "Passwort muss mind. 6 Zeichen haben.",
    "auth.err_popup_blocked": "Popup blockiert. Erneut versuchen.",
    "to.propose": "Startplatzdaten eintragen",
    "to.submit_title": "Startplatzdaten hinzufügen",
    "to.submit_hint": "Dein Vorschlag wird von einem Admin geprüft.",
    "to.name_ph": "Name des Startplatzes",
    "to.lat_ph": "Breitengrad",
    "to.lon_ph": "Längengrad",
    "to.alt_ph": "Höhe (m)",
    "to.orient_ph": "Ausrichtungen (N, NW, W…)",
    "to.station_ph": "Pioupiou-Stations-ID (optional)",
    "to.notes_ph": "Notizen (Zugang, Gefahren…)",
    "to.pick_map": "📍 Aktuelle Kartenkoordinaten verwenden",
    "to.submit": "Zur Prüfung senden",
    "to.cancel": "Abbrechen",
    "to.submit_ok": "Gesendet! Antwort nach Prüfung.",
    "to.submit_err": "Vorschlag konnte nicht gesendet werden.",
    "to.submit_login": "Bitte zum Vorschlagen anmelden.",
    "to.admin_open": "🛡️ Offene Startplätze prüfen",
    "to.admin_title": "Offene Startplätze",
    "to.admin_empty": "Keine offenen Startplätze.",
    "to.approve": "Annehmen",
    "to.reject": "Ablehnen",
    "to.reject_prompt": "Begründung (optional):",
    "to.delete": "Löschen",
    "to.community_badge": "Community",
    "to.submitted_by": "Vorgeschlagen von",
    "to.criteria_title": "Flugkriterien",
    "to.dirs_hint": "Tippe jede Richtung, um sie als Ideal (grün), Fliegbar (gelb) oder Gefährlich (rot) zu markieren.",
    "to.wind_min": "Ideal Wind min (km/h)",
    "to.wind_max": "Ideal Wind max (km/h)",
    "to.gust_max": "Max. sichere Böe (km/h)",
    "to.suggest": "Änderungen vorschlagen",
    "to.suggest_title": "Änderungen am Startplatz vorschlagen",
    "to.suggest_submit": "Vorschlag senden",
    "to.suggest_ok": "Vorschlag gesendet. Ein Admin prüft ihn.",
    "to.suggest_notfound": "Ursprungs-Startplatz nicht gefunden.",
    "to.suggestion_badge": "Vorschlag",
    "act.orient_toggle": "Live-Ausrichtung (Gerätekompass)",
    "fav.add": "Zu Favoriten hinzufügen",
    "fav.remove": "Aus Favoriten entfernen",
    "fav.home_set": "Als Stamm-Startplatz festlegen",
    "fav.home_unset": "Stamm-Startplatz aufheben",
    "fav.alert_on": "Alarme für diesen Startplatz aktivieren",
    "fav.alert_off": "Alarme deaktivieren",
    "fav.section": "Deine Startplätze",
    "fav.others": "Treffer in der Nähe",
    "fav.notify_title": "🦂 Ideale Bedingungen in {name}",
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
    "help.title": "Hilfe",
    "help.quick": "<p><strong>Kurzanleitung:</strong></p><ul><li>🧭 Der <strong>Kompass</strong> zeigt die grün/gelb/rot Sektoren des aktuellen Startplatzes und einen Live-Pfeil mit dem Wind.</li><li>📍 Tippe auf den Standort-Button, damit Distanzen ab deiner echten Position gemessen werden.</li><li>🔍 Tippe im Suchfeld, um Startplätze zu filtern; Favoriten zuerst.</li><li>★ markiert Favoriten, 👑 setzt \"Zuhause\", 🔔 aktiviert Benachrichtigungen bei idealen Bedingungen.</li><li>+ schlägt einen neuen Startplatz vor · ✎ schlägt Änderungen vor.</li><li>📲 App als PWA installieren für Offline-Nutzung.</li><li>⚠️ Daten sind Richtwerte. Bedingungen immer vor Ort prüfen.</li></ul>",
    "help.full_docs": "Vollständige Dokumentation anzeigen",
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
    "wx.storm_level.vlow": "sehr gering",
    "wx.storm_level.low":  "gering",
    "wx.storm_level.med":  "mittel",
    "wx.storm_level.high": "hoch",
    "wx.storm_level.none": "keine",
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
    "ts.placeholder": "Startplätze in der Nähe oder Favoriten suchen",
    "ts.current": "Startplatz:",
    "ts.radius": "Radius",
    "ts.no_radius": "Kein Limit",
    "theme.title": "Design (auto/dunkel/hell)",
    "menu.lang": "Sprache",
    "menu.theme": "Design",
    "menu.notify": "Hinweise",
    "menu.install": "App installieren",
    "menu.help": "Hilfe",
    "menu.admin_review": "Startplätze prüfen",
    "panel.for_to_st": "Anzeige: {to} · Daten von Station {st}",
    "panel.for_st": "Daten von Station {st}",
    "menu.account": "Konto",
    "theme.auto": "Design: automatisch",
    "theme.dark": "Design: dunkel",
    "theme.light": "Design: hell",
    "ts.locate": "Meinen Standort verwenden",
    "ts.hint": "📍 tippen, um deinen Standort zu nutzen, oder filtern.",
    "ts.loading": "Stationen werden geladen…",
    "ts.empty": "Keine aktiven Stationen in diesem Radius.",
    "ts.empty_global": "Keine Stationen mit den aktuellen Filtern.",
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
    "fc.night": "Nuit",
    "fc.show": "Afficher sur le graphique :",
    "auth.title": "Compte",
    "auth.guest": "Invité",
    "auth.anon": "Anonyme",
    "auth.user": "Utilisateur",
    "auth.tab_login": "Connexion",
    "auth.tab_register": "Inscription",
    "auth.email_ph": "email@domaine.com",
    "auth.pwd_ph": "mot de passe",
    "auth.pwd_new_ph": "mot de passe (min. 6)",
    "auth.login": "Se connecter",
    "auth.register": "Créer un compte",
    "auth.logout": "Se déconnecter",
    "auth.magic": "M'envoyer un lien par email",
    "auth.magic_sent": "Lien envoyé. Vérifie ton email.",
    "auth.google": "Continuer avec Google",
    "auth.anon_btn": "Continuer sans compte",
    "auth.or": "ou",
    "auth.signed_as": "Connecté en tant que",
    "auth.confirm_email": "Confirme ton email pour finaliser la connexion :",
    "auth.err_fields": "Remplis email et mot de passe.",
    "auth.err_email_required": "Saisis ton email.",
    "auth.err_invalid_email": "Email invalide.",
    "auth.err_user_not_found": "Utilisateur introuvable.",
    "auth.err_wrong_password": "Email ou mot de passe incorrect.",
    "auth.err_email_in_use": "Cet email est déjà enregistré.",
    "auth.err_pwd_short": "Le mot de passe doit avoir au moins 6 caractères.",
    "auth.err_popup_blocked": "Fenêtre bloquée. Réessaie.",
    "to.propose": "Enregistrer les données d'un déco",
    "to.submit_title": "Ajouter les données d’un déco",
    "to.submit_hint": "Ta proposition sera examinée par un administrateur.",
    "to.name_ph": "Nom du déco",
    "to.lat_ph": "Latitude",
    "to.lon_ph": "Longitude",
    "to.alt_ph": "Altitude (m)",
    "to.orient_ph": "Orientations (N, NO, O…)",
    "to.station_ph": "ID station Pioupiou (optionnel)",
    "to.notes_ph": "Notes (accès, dangers…)",
    "to.pick_map": "📍 Utiliser les coordonnées de la carte",
    "to.submit": "Envoyer pour validation",
    "to.cancel": "Annuler",
    "to.submit_ok": "Envoyé ! Tu auras une réponse après validation.",
    "to.submit_err": "Envoi impossible.",
    "to.submit_login": "Connecte-toi pour proposer un déco.",
    "to.admin_open": "🛡️ Examiner les décos en attente",
    "to.admin_title": "Décos en attente de validation",
    "to.admin_empty": "Aucun déco en attente.",
    "to.approve": "Approuver",
    "to.reject": "Rejeter",
    "to.reject_prompt": "Raison (optionnelle) :",
    "to.delete": "Supprimer",
    "to.community_badge": "communauté",
    "to.submitted_by": "Proposé par",
    "to.criteria_title": "Critères de vol",
    "to.dirs_hint": "Touche chaque direction pour la marquer Idéal (vert), Volable (jaune) ou Dangereux (rouge).",
    "to.wind_min": "Vent min idéal (km/h)",
    "to.wind_max": "Vent max idéal (km/h)",
    "to.gust_max": "Rafale max sûre (km/h)",
    "to.suggest": "Suggérer des modifications",
    "to.suggest_title": "Suggérer des modifications au déco",
    "to.suggest_submit": "Envoyer la suggestion",
    "to.suggest_ok": "Suggestion envoyée. Un admin la vérifiera.",
    "to.suggest_notfound": "Déco d’origine introuvable.",
    "to.suggestion_badge": "suggestion",
    "act.orient_toggle": "Orientation en temps réel (boussole de l’appareil)",
    "fav.add": "Ajouter aux favoris",
    "fav.remove": "Retirer des favoris",
    "fav.home_set": "Définir comme déco habituel",
    "fav.home_unset": "Retirer comme déco habituel",
    "fav.alert_on": "Activer les alertes pour ce déco",
    "fav.alert_off": "Désactiver les alertes",
    "fav.section": "Tes décos",
    "fav.others": "Résultats proches",
    "fav.notify_title": "🦂 Conditions idéales à {name}",
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
    "help.title": "Aide",
    "help.quick": "<p><strong>Guide rapide :</strong></p><ul><li>🧭 La <strong>boussole</strong> affiche les secteurs vert/jaune/rouge du déco actuel et une flèche du vent en direct.</li><li>📍 Appuie sur le bouton de localisation pour que les distances soient mesurées depuis ta position réelle.</li><li>🔍 Tape dans la recherche pour filtrer ; les favoris apparaissent en premier.</li><li>★ marque les favoris, 👑 définit ton \"déco habituel\", 🔔 active les alertes en conditions idéales.</li><li>+ propose un nouveau déco · ✎ suggère des modifications.</li><li>📲 installe l'app en PWA pour l'utiliser hors ligne.</li><li>⚠️ Données indicatives. Évalue toujours les conditions sur place.</li></ul>",
    "help.full_docs": "Voir la documentation complète",
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
    "wx.storm_level.vlow": "très faible",
    "wx.storm_level.low":  "faible",
    "wx.storm_level.med":  "moyen",
    "wx.storm_level.high": "élevé",
    "wx.storm_level.none": "aucun",
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
    "ts.placeholder": "Rechercher décollages proches ou favoris",
    "ts.current": "Décollage :",
    "ts.radius": "Rayon",
    "ts.no_radius": "Sans limite",
    "theme.title": "Thème (auto/sombre/clair)",
    "menu.lang": "Langue",
    "menu.theme": "Thème",
    "menu.notify": "Alertes",
    "menu.install": "Installer l'app",
    "menu.help": "Aide",
    "menu.admin_review": "Examiner décos",
    "panel.for_to_st": "Affichage : {to} · données de la station {st}",
    "panel.for_st": "Données de la station {st}",
    "menu.account": "Compte",
    "theme.auto": "Thème : automatique",
    "theme.dark": "Thème : sombre",
    "theme.light": "Thème : clair",
    "ts.locate": "Utiliser ma position",
    "ts.hint": "Appuyez sur 📍 pour utiliser votre position ou filtrez.",
    "ts.loading": "Chargement des stations…",
    "ts.empty": "Aucune station active dans ce rayon.",
    "ts.empty_global": "Aucune station disponible avec les filtres actuels.",
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
  },
  eu: {
    "app.title": "Haizea Cenes de la Vegan · Parapente",
    "header.h1": "🪂 Haizea Cenes de la Vegan",
    "header.subtitle": "Parapente irteguia · Estazioa",
    "btn.install": "📲 Aplikazioa instalatu",
    "btn.notify_off": "🔔 Abisatu baldintzak ezin hobeak badira",
    "btn.notify_on": "🔕 Abisuak aktibatuta",
    "status.title": "Egungo egoera",
    "card.n": "I", "card.e": "E", "card.s": "H", "card.w": "M",
    "read.avg": "Batez besteko abiadura",
    "read.max": "Bolada max.",
    "read.min": "Minimoa",
    "read.last": "Azken neurketa",
    "read.dir": "Norabidea",
    "verdict.loading": "Kargatzen…",
    "verdict.ideal.title": "Baldintza ezin hobeak ✅",
    "verdict.ideal.detail": "Norabide ona eta abiadura tarte optimoan.",
    "verdict.ok.title": "Hegagarria ⚠️",
    "verdict.ok.detail": "Onargarria baina ez optimoa. Erabaki zentzuz.",
    "verdict.bad.title": "Norabide desegokia ❌",
    "verdict.bad.detail": "Ekialdeko osagaia: haizea atzetik edo zeharka.",
    "verdict.warn.title": "Haize gehiegi 🚫",
    "verdict.warn.detail": "Abiadura edo boladak muga seguruaren gainetik.",
    "verdict.unknown.title": "Daturik gabe",
    "verdict.unknown.detail": "Ezin dira baldintzak ebaluatu.",
    "verdict.suffix": "Norabidea: {name}. Batez beste {avg} km/h, bolada {max} km/h.",
    "dirLabel.from": "Norabidea: {name} ({deg}°)",
    "dirLabel.dash": "—",
    "hist.title": "Bilakaera",
    "hist.legend": "Lerro urdina: batez besteko abiadura · Lerro gorria: bolada max · Geziak: norabidea (kolorea = aproposa)",
    "chart.avg": "Batez besteko abiadura (km/h)",
    "chart.gust": "Bolada max (km/h)",
    "chart.dir": "Norabidea",
    "chart.dir_tooltip": "Norab.: {name} ({deg}°)",
    "fc.title": "Iragarpena (Open-Meteo)",
    "fc.today": "Gaur",
    "fc.night": "Gaua",
    "fc.show": "Erakutsi grafikoan:",
    "auth.title": "Kontua",
    "auth.guest": "Gonbidatua",
    "auth.anon": "Anonimoa",
    "auth.user": "Erabiltzailea",
    "auth.tab_login": "Sartu",
    "auth.tab_register": "Erregistratu",
    "auth.email_ph": "email@domeinua.com",
    "auth.pwd_ph": "pasahitza",
    "auth.pwd_new_ph": "pasahitza (gutx. 6)",
    "auth.login": "Sartu",
    "auth.register": "Kontua sortu",
    "auth.logout": "Saioa amaitu",
    "auth.magic": "Bidali esteka emailera",
    "auth.magic_sent": "Esteka bidalita. Begiratu zure emaila.",
    "auth.google": "Jarraitu Google-rekin",
    "auth.anon_btn": "Jarraitu konturik gabe",
    "auth.or": "edo",
    "auth.signed_as": "Honela konektatuta",
    "auth.confirm_email": "Berretsi zure emaila saioa amaitzeko:",
    "auth.err_fields": "Bete emaila eta pasahitza.",
    "auth.err_email_required": "Sartu zure emaila.",
    "auth.err_invalid_email": "Email baliogabea.",
    "auth.err_user_not_found": "Erabiltzailea ez dago.",
    "auth.err_wrong_password": "Email edo pasahitz okerra.",
    "auth.err_email_in_use": "Email hori dagoeneko erregistratuta dago.",
    "auth.err_pwd_short": "Pasahitzak gutxienez 6 karaktere izan behar ditu.",
    "auth.err_popup_blocked": "Nabigatzaileak leihoa blokeatu du. Saiatu berriro.",
    "to.propose": "Irteguiaren datuak erregistratu",
    "to.submit_title": "Irteguiaren datuak gehitu",
    "to.submit_hint": "Zure proposamena administrari batek berrikusiko du argitaratu aurretik.",
    "to.name_ph": "Irteguiaren izena",
    "to.lat_ph": "Latitudea",
    "to.lon_ph": "Longitudea",
    "to.alt_ph": "Altitudea (m)",
    "to.orient_ph": "Norabideak (I, IM, M…)",
    "to.station_ph": "Pioupiou estazio ID (aukerakoa)",
    "to.notes_ph": "Oharrak (sarbidea, arriskuak…)",
    "to.pick_map": "📍 Erabili maparen koordenatuak",
    "to.submit": "Bidali berrikusteko",
    "to.cancel": "Utzi",
    "to.submit_ok": "Bidalita! Berrikusi ondoren erantzungo dizugu.",
    "to.submit_err": "Ezin izan da proposamena bidali.",
    "to.submit_login": "Saioa hasi behar duzu irteguia proposatzeko.",
    "to.admin_open": "🛡️ Berrikusi proposamenak",
    "to.admin_title": "Berrikusteko dauden irteguiak",
    "to.admin_empty": "Ez dago proposamenik zain.",
    "to.approve": "Onartu",
    "to.reject": "Ezetsi",
    "to.reject_prompt": "Ezesteko arrazoia (aukerakoa):",
    "to.delete": "Ezabatu",
    "to.community_badge": "komunitatea",
    "to.submitted_by": "Proposatzailea",
    "to.criteria_title": "Hegaldi irizpideak",
    "to.dirs_hint": "Sakatu norabide bakoitza Aproposa (berdea), Hegagarria (horia) edo Arriskutsua (gorria) markatzeko.",
    "to.wind_min": "Haize min. aproposa (km/h)",
    "to.wind_max": "Haize max. aproposa (km/h)",
    "to.gust_max": "Bolada max. segurua (km/h)",
    "to.suggest": "Aldaketak proposatu",
    "to.suggest_title": "Irteguiari aldaketak proposatu",
    "to.suggest_submit": "Bidali iradokizuna",
    "to.suggest_ok": "Iradokizuna bidalita. Administrari batek berrikusiko du.",
    "to.suggest_notfound": "Ez da jatorrizko irteguia aurkitu.",
    "to.suggestion_badge": "iradokizuna",
    "act.orient_toggle": "Norabidea denbora errealean (gailuaren iparrorratza)",
    "fav.add": "Gogokoetara gehitu",
    "fav.remove": "Gogokoetatik kendu",
    "fav.home_set": "Markatu ohiko irteguitzat",
    "fav.home_unset": "Ohiko irteguia kendu",
    "fav.alert_on": "Aktibatu abisuak irtegui honetarako",
    "fav.alert_off": "Desaktibatu abisuak",
    "fav.section": "Zure irteguiak",
    "fav.others": "Inguruko emaitzak",
    "fav.notify_title": "🦂 Baldintza ezin hobeak {name}-n",
    "cmp.title": "Azken egunen konparaketa",
    "cmp.window": "({h1}:00–{h2}:00 tokikoa)",
    "cmp.window_solar": "(egunsenti +3 h → ilunabar −1 h)",
    "cmp.yesterday": "Atzo",
    "cmp.days_ago": "Duela {n} egun",
    "cmp.no_data": "Daturik ez",
    "cmp.row.avg": "Batez beste",
    "cmp.row.max": "Bolada max",
    "cmp.row.dir": "Norabide nag.",
    "cmp.row.state": "Egoera",
    "cmp.legend": "Egungo ordu tarte berbera (±2 h) azken 3 egunetan.",
    "near.title": "Inguruko estazioak",
    "near.radius": "50 km erradioa",
    "near.none": "Ez dago beste Pioupiou estaziorik aktibo 50 km-an.",
    "near.error": "Errorea inguruko estazioak kargatzean.",
    "near.network_prefix": "Sarea",
    "near.legend_suffix": "Azken orduen norabidea eta batez besteko intentsitatea soilik; estazio bakoitzak bere irizpideak ditu.",
    "near.avg_unit": "km/h · batez beste {h} h",
    "near.popup_last": "azkena",
    "near.popup_view": "Ikusi estazioa",
    "map.title": "Irteguiaren kokapena",
    "guide.title": "Gida azkarra",
    "guide.for": "Irizpideak honentzat",
    "guide.ideal": "<strong>Aproposa:</strong> Mendebal (M) edo Ipar-Mendebal (IM), 5–15 km/h (boladak ≤ 25).",
    "guide.ok": "<strong>Hegagarria:</strong> Ipar (I) edo Hego-Mendebal (HM), edo tarte aproposetik kanpoko haizeak baina mugaren azpitik.",
    "guide.bad": "<strong>Txarra:</strong> Ekialdeko osagaiak (IE, E, HE) — okerragoa ekialderago.",
    "guide.warn": "<strong>Indartsuegia:</strong> batez beste ≥ 20 km/h edo boladak ≥ 30 km/h.",
    "help.title": "Laguntza",
    "help.quick": "<p><strong>Gida azkarra:</strong></p><ul><li>🧭 <strong>Iparrorratzak</strong> uneko irteguiaren sektore berde/hori/gorriak eta haizearen gezia zuzenean erakusten ditu.</li><li>📍 Sakatu kokapen botoia distantziak zure benetako kokapenetik neur daitezen.</li><li>🔍 Bilaketa kutxan idatzi irteguiak iragazteko; gogokoak lehenengo agertzen dira.</li><li>★ gogokoak markatu, 👑 zure \"etxea\" finkatu, 🔔 abisuak aktibatu baldintza ezin hobeetan.</li><li>+ irtegui berria proposatu · ✎ aldaketak iradoki.</li><li>📲 PWA gisa instalatu konexiorik gabe erabiltzeko.</li><li>⚠️ Datuak orientagarriak dira. Beti ebaluatu baldintzak lekuan bertan.</li></ul>",
    "help.full_docs": "Ikusi dokumentazio osoa",
    "loading": "Kargatzen…",
    "footer": 'Denbora errealeko datuak: <a href="https://developers.pioupiou.fr/" target="_blank" rel="noopener">api.pioupiou.fr</a> · Iragarpena: <a href="https://open-meteo.com/" target="_blank" rel="noopener">open-meteo.com</a> · Mapa: © OpenStreetMap. Ez ofiziala. Beti egiaztatu baldintzak in situ.',
    "notify.title": "🪂 Baldintza ezin hobeak Cenes-en!",
    "notify.unsupported": "Zure nabigatzaileak ez ditu jakinarazpenak onartzen.",
    "notify.denied": "Jakinarazpenak ukatuta.",
    "error.fetch": "Datuak eskuratzeko errorea",
    "popup.takeoff_sub": "Cenes de la Vega",
    "wx.clouds": "Hodeiak",
    "wx.precip": "Euri probab.",
    "wx.storm": "Ekaitza",
    "wx.storm_risk": "Ekaitz arriskua",
    "wx.storm_level.vlow": "oso baxua",
    "wx.storm_level.low":  "baxua",
    "wx.storm_level.med":  "ertaina",
    "wx.storm_level.high": "altua",
    "wx.storm_level.none": "bat ere ez",
    "wx.temp": "Tenp.",
    "wx.feels": "sent. {v}°",
    "best.label": "Gaurko tarte onena:",
    "best.label_tomorrow": "Biharko tarte onena:",
    "best.none": "Ez dago tarte optimoarik hurrengo 12 orduetan.",
    "best.ideal": "✅ Aproposa",
    "best.ok": "⚠️ Hegagarria",
    "near.airport_label": "Granadako aireportua (LEGR)",
    "near.airport_prefix": "Aireportua",
    "near.airport_src": "Open-Meteo (METAR gutxi gorabehera)",
    "banner.title": "Cenes de la Vegako parapente irteguia",
    "ts.placeholder": "Bilatu inguruko edo gogoko irteguiak",
    "ts.current": "Irteguia:",
    "ts.radius": "Erradioa",
    "ts.no_radius": "Mugarik gabe",
    "theme.title": "Gaia (auto/iluna/argia)",
    "menu.lang": "Hizkuntza",
    "menu.theme": "Gaia",
    "menu.notify": "Abisuak",
    "menu.install": "App-a instalatu",
    "menu.help": "Laguntza",
    "menu.admin_review": "Berrikusi proposamenak",
    "panel.for_to_st": "Erakusten: {to} · {st} estaziotik",
    "panel.for_st": "{st} estazioaren datuak",
    "menu.account": "Kontua",
    "theme.auto": "Gaia: automatikoa",
    "theme.dark": "Gaia: iluna",
    "theme.light": "Gaia: argia",
    "ts.locate": "Erabili nire kokapena",
    "ts.hint": "Sakatu 📍 zure kokapena erabiltzeko edo idatzi iragazteko.",
    "ts.loading": "Estazioak kargatzen…",
    "ts.empty": "Ez dago estazio aktiborik erradio honetan.",
    "ts.empty_global": "Ez dago estaziorik uneko iragazkiekin.",
    "ts.geo_denied": "Ezin izan da kokapena lortu. Baimena ukatuta.",
    "ts.geo_unavailable": "Geokokapena ez dago erabilgarri gailu honetan.",
    "wh.title": "Azken 2 h (km/h)",
    "wh.titleFmt": "Azken {h} h (km/h)",
    "wh.legend": "gezia = norantz dabilen haizea · altuera = abiadura",
    "ts.coming_soon": "laster",
    "verdict.rain_suffix": "Prezipitazio probabilitate esanguratsua.",
    "verdict.speed.calm": "Haize oso ahula, ia geldia.",
    "verdict.speed.low": "Haizea tarte aproposaren azpitik (<5 km/h).",
    "verdict.speed.high": "Haizea tarte aproposaren gainetik (>15 km/h).",
    "verdict.speed.too_high_avg": "Batez besteko abiadura altuegia (≥20 km/h).",
    "verdict.speed.too_high_gust": "Bolada indartsuegiak (≥30 km/h).",
    "verdict.storm_suffix": "Ekaitz arriskua: ez hegan egin.",
    "locale": "eu-ES"
  },
  ca: {
    "app.title": "Vent a Cenes de la Vega · Parapent",
    "header.h1": "🪂 Vent a Cenes de la Vega",
    "header.subtitle": "Enlairament de parapent · Estació",
    "btn.install": "📲 Instal·lar l'app",
    "btn.notify_off": "🔔 Avisa'm si hi ha condicions ideals",
    "btn.notify_on": "🔕 Avisos activats",
    "status.title": "Estat actual",
    "card.n": "N", "card.e": "E", "card.s": "S", "card.w": "O",
    "read.avg": "Velocitat mitjana",
    "read.max": "Ratxa màx.",
    "read.min": "Mínima",
    "read.last": "Última lectura",
    "read.dir": "Direcció",
    "verdict.loading": "Carregant…",
    "verdict.ideal.title": "Condicions ideals ✅",
    "verdict.ideal.detail": "Bona direcció i velocitat dins el rang òptim.",
    "verdict.ok.title": "Volable ⚠️",
    "verdict.ok.detail": "Acceptable però no òptim. Valora amb criteri.",
    "verdict.bad.title": "Direcció desfavorable ❌",
    "verdict.bad.detail": "Component est: vent per darrere o de través.",
    "verdict.warn.title": "Vent massa fort 🚫",
    "verdict.warn.detail": "Velocitat o ratxes per sobre del límit segur.",
    "verdict.unknown.title": "Sense dades",
    "verdict.unknown.detail": "No es poden valorar les condicions.",
    "verdict.suffix": "Direcció: {name}. Mitjana {avg} km/h, ratxa {max} km/h.",
    "dirLabel.from": "Direcció: {name} ({deg}°)",
    "dirLabel.dash": "—",
    "hist.title": "Evolució observada",
    "hist.legend": "Línia blava: velocitat mitjana · Línia vermella: ratxa màx · Fletxes: direcció (color = aptitud)",
    "chart.avg": "Velocitat mitjana (km/h)",
    "chart.gust": "Ratxa màx (km/h)",
    "chart.dir": "Direcció",
    "chart.dir_tooltip": "Dir: {name} ({deg}°)",
    "fc.title": "Pronòstic (Open-Meteo)",
    "fc.today": "Avui",
    "fc.night": "Nit",
    "fc.show": "Mostra al gràfic:",
    "auth.title": "Compte",
    "auth.guest": "Convidat",
    "auth.anon": "Anònim",
    "auth.user": "Usuari",
    "auth.tab_login": "Entra",
    "auth.tab_register": "Registra't",
    "auth.email_ph": "email@domini.com",
    "auth.pwd_ph": "contrasenya",
    "auth.pwd_new_ph": "contrasenya (mín. 6)",
    "auth.login": "Entra",
    "auth.register": "Crea compte",
    "auth.logout": "Tanca sessió",
    "auth.magic": "Envia'm un enllaç per email",
    "auth.magic_sent": "Enllaç enviat. Revisa el teu email.",
    "auth.google": "Continua amb Google",
    "auth.anon_btn": "Continua sense compte",
    "auth.or": "o",
    "auth.signed_as": "Connectat com a",
    "auth.confirm_email": "Confirma el teu email per completar l'inici de sessió:",
    "auth.err_fields": "Omple email i contrasenya.",
    "auth.err_email_required": "Introdueix el teu email.",
    "auth.err_invalid_email": "Email no vàlid.",
    "auth.err_user_not_found": "L'usuari no existeix.",
    "auth.err_wrong_password": "Email o contrasenya incorrectes.",
    "auth.err_email_in_use": "Aquest email ja està registrat.",
    "auth.err_pwd_short": "La contrasenya ha de tenir almenys 6 caràcters.",
    "auth.err_popup_blocked": "El navegador ha bloquejat la finestra. Torna-ho a provar.",
    "to.propose": "Donar d'alta dades d'enlairament",
    "to.submit_title": "Afegir dades d'enlairament",
    "to.submit_hint": "La teva proposta serà revisada per un administrador abans de publicar-se.",
    "to.name_ph": "Nom de l'enlairament",
    "to.lat_ph": "Latitud",
    "to.lon_ph": "Longitud",
    "to.alt_ph": "Altitud (m)",
    "to.orient_ph": "Orientacions (N, NO, O…)",
    "to.station_ph": "ID estació Pioupiou (opcional)",
    "to.notes_ph": "Notes (accés, perills…)",
    "to.pick_map": "📍 Utilitza les coordenades del mapa",
    "to.submit": "Envia per revisar",
    "to.cancel": "Cancel·la",
    "to.submit_ok": "Enviat! Rebràs resposta després de la revisió.",
    "to.submit_err": "No s'ha pogut enviar la proposta.",
    "to.submit_login": "Has d'iniciar sessió per proposar un enlairament.",
    "to.admin_open": "🛡️ Revisa enlairaments pendents",
    "to.admin_title": "Enlairaments pendents de revisió",
    "to.admin_empty": "No hi ha enlairaments pendents.",
    "to.approve": "Aprova",
    "to.reject": "Rebutja",
    "to.reject_prompt": "Motiu del rebuig (opcional):",
    "to.delete": "Elimina",
    "to.community_badge": "comunitat",
    "to.submitted_by": "Proposat per",
    "to.criteria_title": "Criteris de vol",
    "to.dirs_hint": "Toca cada direcció per marcar-la com a Ideal (verd), Volable (groc) o Perillosa (vermell).",
    "to.wind_min": "Vent mín. ideal (km/h)",
    "to.wind_max": "Vent màx. ideal (km/h)",
    "to.gust_max": "Ratxa màx. segura (km/h)",
    "to.suggest": "Suggereix canvis",
    "to.suggest_title": "Suggereix canvis a l'enlairament",
    "to.suggest_submit": "Envia el suggeriment",
    "to.suggest_ok": "Suggeriment enviat. Un administrador el revisarà.",
    "to.suggest_notfound": "No s'ha trobat l'enlairament d'origen.",
    "to.suggestion_badge": "suggeriment",
    "act.orient_toggle": "Orientació en temps real (brúixola del dispositiu)",
    "fav.add": "Afegeix als preferits",
    "fav.remove": "Treu dels preferits",
    "fav.home_set": "Marca com a enlairament habitual",
    "fav.home_unset": "Treu com a enlairament habitual",
    "fav.alert_on": "Activa alertes per a aquest enlairament",
    "fav.alert_off": "Desactiva alertes",
    "fav.section": "Els teus enlairaments",
    "fav.others": "Resultats propers",
    "fav.notify_title": "🦂 Condicions ideals a {name}",
    "cmp.title": "Comparativa últims dies",
    "cmp.window": "({h1}:00–{h2}:00 local)",
    "cmp.window_solar": "(albada +3 h → posta −1 h)",
    "cmp.yesterday": "Ahir",
    "cmp.days_ago": "Fa {n} dies",
    "cmp.no_data": "Sense dades",
    "cmp.row.avg": "Mitjana",
    "cmp.row.max": "Ratxa màx",
    "cmp.row.dir": "Direcció dom.",
    "cmp.row.state": "Estat",
    "cmp.legend": "Mateixa franja horària actual (±2 h) als últims 3 dies.",
    "near.title": "Estacions properes",
    "near.radius": "radi 50 km",
    "near.none": "No hi ha altres estacions Pioupiou actives dins 50 km.",
    "near.error": "Error en carregar estacions properes.",
    "near.network_prefix": "Xarxa",
    "near.legend_suffix": "Només direcció i intensitat mitjana de les últimes hores; cada estació té els seus criteris.",
    "near.avg_unit": "km/h · mitjana {h} h",
    "near.popup_last": "última",
    "near.popup_view": "Veure estació",
    "map.title": "Ubicació de l'enlairament",
    "guide.title": "Guia ràpida",
    "guide.for": "Criteris per a",
    "guide.ideal": "<strong>Ideal:</strong> Oest (O) o Nord-oest (NO), 5–15 km/h (ratxes ≤ 25).",
    "guide.ok": "<strong>Volable:</strong> Nord (N) o Sud-oest (SO), o vents fora del rang ideal però sota el límit.",
    "guide.bad": "<strong>Dolent:</strong> components Est (NE, E, SE) — pitjor com més a l'est.",
    "guide.warn": "<strong>Massa fort:</strong> mitjana ≥ 20 km/h o ratxes ≥ 30 km/h.",
    "help.title": "Ajuda",
    "help.quick": "<p><strong>Guia ràpida:</strong></p><ul><li>🧭 La <strong>brúuixola</strong> mostra els sectors verd/groc/vermell de l'enlairament actual i una fletxa amb el vent en directe.</li><li>📍 Prem el botó d'ubicació perquè les distàncies es mesurin des de la teva posició real.</li><li>🔍 Escriu al cercador per filtrar; els preferits surten primer.</li><li>★ marca preferits, 👑 fixa la \"llar\", 🔔 activa alertes en condicions ideals.</li><li>+ proposa un enlairament nou · ✎ suggereix canvis.</li><li>📲 instal·la l'app com a PWA per usar-la sense connexió.</li><li>⚠️ Dades orientatives. Avalua sempre les condicions in situ.</li></ul>",
    "help.full_docs": "Veure documentació completa",
    "loading": "Carregant…",
    "footer": 'Dades en temps real: <a href="https://developers.pioupiou.fr/" target="_blank" rel="noopener">api.pioupiou.fr</a> · Pronòstic: <a href="https://open-meteo.com/" target="_blank" rel="noopener">open-meteo.com</a> · Mapa: © OpenStreetMap. No oficial. Valora sempre les condicions in situ.',
    "notify.title": "🪂 Condicions ideals a Cenes!",
    "notify.unsupported": "El teu navegador no admet notificacions.",
    "notify.denied": "Permís de notificacions denegat.",
    "error.fetch": "Error en consultar les dades",
    "popup.takeoff_sub": "Cenes de la Vega",
    "wx.clouds": "Núvols",
    "wx.precip": "Prob. pluja",
    "wx.storm": "Tempesta",
    "wx.storm_risk": "Risc de tempesta",
    "wx.storm_level.vlow": "molt baix",
    "wx.storm_level.low":  "baix",
    "wx.storm_level.med":  "mitjà",
    "wx.storm_level.high": "alt",
    "wx.storm_level.none": "cap",
    "wx.temp": "Temp.",
    "wx.feels": "sens. {v}°",
    "best.label": "Millor franja avui:",
    "best.label_tomorrow": "Millor franja demà:",
    "best.none": "Sense franges òptimes en les pròximes 12 h.",
    "best.ideal": "✅ Ideal",
    "best.ok": "⚠️ Volable",
    "near.airport_label": "Aeroport de Granada (LEGR)",
    "near.airport_prefix": "Aeroport",
    "near.airport_src": "Open-Meteo (METAR aprox.)",
    "banner.title": "Enlairament de parapent de Cenes de la Vega",
    "ts.placeholder": "Cerca enlairaments propers o preferits",
    "ts.current": "Enlairament:",
    "ts.radius": "Radi",
    "ts.no_radius": "Sense límit",
    "theme.title": "Tema (auto/fosc/clar)",
    "menu.lang": "Idioma",
    "menu.theme": "Tema",
    "menu.notify": "Avisos",
    "menu.install": "Instal·la l'app",
    "menu.help": "Ajuda",
    "menu.admin_review": "Revisar enlairaments",
    "panel.for_to_st": "Mostrant: {to} · dades de l'estació {st}",
    "panel.for_st": "Mostrant dades de l'estació {st}",
    "menu.account": "Compte",
    "theme.auto": "Tema: automàtic",
    "theme.dark": "Tema: fosc",
    "theme.light": "Tema: clar",
    "ts.locate": "Utilitza la meva ubicació",
    "ts.hint": "Prem 📍 per usar la teva ubicació o escriu per filtrar.",
    "ts.loading": "Carregant estacions…",
    "ts.empty": "No hi ha estacions actives en aquest radi.",
    "ts.empty_global": "No hi ha estacions disponibles amb els filtres actuals.",
    "ts.geo_denied": "No s'ha pogut obtenir la teva ubicació. Permís denegat.",
    "ts.geo_unavailable": "Geolocalització no disponible en aquest dispositiu.",
    "wh.title": "Últimes 2 h (km/h)",
    "wh.titleFmt": "Últimes {h} h (km/h)",
    "wh.legend": "fletxa = cap a on bufa · altura = velocitat",
    "ts.coming_soon": "ben aviat",
    "verdict.rain_suffix": "Probabilitat significativa de precipitació.",
    "verdict.speed.calm": "Vent molt fluix, pràcticament en calma.",
    "verdict.speed.low": "Vent per sota del rang ideal (<5 km/h).",
    "verdict.speed.high": "Vent per sobre del rang ideal (>15 km/h).",
    "verdict.speed.too_high_avg": "Velocitat mitjana massa alta (≥20 km/h).",
    "verdict.speed.too_high_gust": "Ratxes massa fortes (≥30 km/h).",
    "verdict.storm_suffix": "Hi ha risc de tempesta: no volar.",
    "locale": "ca-ES"
  }
};

// Nomenclatura de 16 puntos por idioma (ES y FR usan O para Oeste, EN y DE usan W)
const DIR_16_BY_LANG = {
  es: ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"],
  en: ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"],
  de: ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"],
  fr: ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"],
  ca: ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"],
  eu: ["I","IIE","IE","EIE","E","EHE","HE","HHE","H","HHM","HM","MHM","M","MIM","IM","IIM"]
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
// Expone t() para módulos ES como auth.js
window.t = t;

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

// v103: cuando el despegue activo NO tiene criterios propios (estación cruda,
// p.ej. AEMET sin doc comunitario), devolvemos "ok" neutro en lugar de caer en
// los criterios hardcodeados de Cenes (que marcaban W/NW como ideal y producían
// falsos "ideal" en, p.ej., Sopelana). Sin criterios → veredicto neutro.
const NEUTRAL_QUALITY_BY_INDEX = Array(16).fill("ok");

function classifyDirection(deg) {
  if (deg == null || isNaN(deg)) return { name: "—", quality: "unknown", deg: null };
  const d = ((deg % 360) + 360) % 360;
  const idx = Math.round(d / 22.5) % 16;
  const arr = (currentTakeoffCriteria?.qualityByIndex && currentTakeoffCriteria.qualityByIndex.some(Boolean))
    ? currentTakeoffCriteria.qualityByIndex.map(q => q || "ok")
    : NEUTRAL_QUALITY_BY_INDEX;
  return { name: dirName(d), quality: arr[idx] || "unknown", deg: d };
}

function classifySpeed(avg, max) {
  if (avg == null) return "unknown";
  const c = currentTakeoffCriteria;
  const wmin = (c && Number.isFinite(c.windMin)) ? c.windMin : 5;
  const wmax = (c && Number.isFinite(c.windMax)) ? c.windMax : 15;
  const gmax = (c && Number.isFinite(c.gustMax)) ? c.gustMax : 30;
  // Demasiado fuerte: rachas ≥ gmax o media ≥ gmax*0.66 (aprox 20 si gmax=30).
  if (avg >= gmax * 0.66 || (max != null && max >= gmax)) return "warn";
  if (avg >= wmin && avg <= wmax && (max == null || max <= gmax * 0.83)) return "ideal";
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
    let lastErr = e;
    for (const wrap of CORS_PROXIES) {
      try {
        const r = await fetch(wrap(url));
        if (!r.ok) { lastErr = new Error("HTTP " + r.status + " (proxy)"); continue; }
        return await r.json();
      } catch (err) { lastErr = err; }
    }
    throw lastErr;
  }
}

async function getLive() {
  // v100: estaciones no-Pioupiou (AEMET / Holfuy) usan su propio fetch y
  // devolvemos un objeto con el mismo shape `{ measurements: {...} }`.
  const prov = currentStation?.provider;
  if (prov === "aemet" || prov === "holfuy") {
    const list = prov === "aemet"
      ? await getAllAemetStations()
      : await getAllHolfuyStations();
    const s = (list || []).find(x => x.id === currentStationId);
    if (!s) return null;
    return {
      measurements: {
        wind_heading:   s.wind_heading   ?? null,
        wind_speed_min: s.wind_speed_min ?? null,
        wind_speed_avg: s.wind_speed_avg ?? null,
        wind_speed_max: s.wind_speed_max ?? null,
        date:           s.lastDate       ?? null,
      },
      status: { date: s.lastDate ?? null },
    };
  }
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

// === Holfuy ===
// API live por estacion (necesita "API password" emitida por info@holfuy.hu).
// Las estaciones autorizadas se configuran en holfuy-config.js (id + lat/lon).
let _holfuyCache = null;
let _holfuyCacheTs = 0;
const HOLFUY_CACHE_MS = 5 * 60 * 1000;

async function getAllHolfuyStations() {
  if (_holfuyCache && (Date.now() - _holfuyCacheTs) < HOLFUY_CACHE_MS) return _holfuyCache;
  const pw = (typeof window !== "undefined" && window.HOLFUY_API_PASSWORD) || "";
  const list = (typeof window !== "undefined" && Array.isArray(window.HOLFUY_STATIONS))
    ? window.HOLFUY_STATIONS : [];
  if (!pw || !list.length) { _holfuyCache = []; _holfuyCacheTs = Date.now(); return _holfuyCache; }
  const results = await Promise.all(list.map(async (cfg) => {
    if (!cfg || cfg.id == null || !Number.isFinite(+cfg.lat) || !Number.isFinite(+cfg.lon)) return null;
    try {
      const url = `https://api.holfuy.com/live/?s=${encodeURIComponent(cfg.id)}&pw=${encodeURIComponent(pw)}&m=JSON&tu=C&su=km/h`;
      const j = await fetchJson(url);
      // dateTime suele venir como "YYYY-MM-DD HH:MM:SS" UTC.
      let lastDate = null;
      if (j?.dateTime) {
        const t = new Date(j.dateTime.replace(" ", "T") + "Z").getTime();
        if (Number.isFinite(t)) lastDate = new Date(t).toISOString();
      }
      return {
        id: "holfuy_" + cfg.id,
        rawId: String(cfg.id),
        provider: "holfuy",
        name: cfg.name || j?.stationName || ("Holfuy " + cfg.id),
        lat: +cfg.lat, lon: +cfg.lon,
        lastDate,
        wind_speed_min: j?.wind?.min ?? null,
        wind_speed_avg: j?.wind?.speed ?? null,
        wind_speed_max: j?.wind?.gust ?? null,
        wind_heading:   j?.wind?.direction ?? null,
        temperature:    j?.temperature ?? null,
      };
    } catch (e) {
      console.warn("getAllHolfuyStations(" + cfg.id + "):", e);
      return null;
    }
  }));
  _holfuyCache = results.filter(Boolean);
  _holfuyCacheTs = Date.now();
  return _holfuyCache;
}

// === AEMET (Agencia Estatal de Meteorología, España) — OpenData ===
// Requiere API key personal de https://opendata.aemet.es/centrodedescargas/altaUsuario
// Se lee de window.AEMET_API_KEY o de localStorage.getItem("aemetApiKey").
// La API no soporta CORS, así que se enruta por la cadena de proxies CORS_PROXIES.
let _aemetCache = null;
let _aemetCacheTs = 0;
const AEMET_CACHE_MS = 15 * 60 * 1000;
const AEMET_LS_KEY = "aemetStationsCache";
const AEMET_LS_TTL = 24 * 60 * 60 * 1000;

function _aemetLoadLs() {
  try {
    const raw = localStorage.getItem(AEMET_LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.data) || !obj.ts) return null;
    return obj;
  } catch { return null; }
}
function _aemetSaveLs(data) {
  try { localStorage.setItem(AEMET_LS_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function _aemetApiKey() {
  try {
    return (typeof window !== "undefined" && window.AEMET_API_KEY)
      || localStorage.getItem("aemetApiKey")
      || "";
  } catch { return ""; }
}

async function getAllAemetStations() {
  if (_aemetCache && (Date.now() - _aemetCacheTs) < AEMET_CACHE_MS) return _aemetCache;
  // Si tenemos un cache persistido reciente, úsalo de partida y refresca en segundo plano.
  if (!_aemetCache) {
    const ls = _aemetLoadLs();
    if (ls && (Date.now() - ls.ts) < AEMET_LS_TTL) {
      _aemetCache = ls.data;
      _aemetCacheTs = ls.ts;
    }
  }
  const key = _aemetApiKey();
  if (!key) return _aemetCache || [];
  try {
    const metaUrl = `https://opendata.aemet.es/opendata/api/observacion/convencional/todas?api_key=${encodeURIComponent(key)}`;
    const meta = await fetchJson(metaUrl);
    if (!meta?.datos) {
      console.warn("AEMET: respuesta sin 'datos'", meta);
      return [];
    }
    const records = await fetchJson(meta.datos);
    if (!Array.isArray(records)) {
      console.warn("AEMET: 'datos' no devolvio array", records);
      return _aemetCache || [];
    }
    // Conserva el registro más reciente por estación (idema).
    const byId = new Map();
    for (const r of records) {
      if (!r?.idema) continue;
      const prev = byId.get(r.idema);
      // fint puede venir como "YYYY-MM-DDTHH:MM:SS" (sin zona) o ya con offset
      // explicito tipo "+0000". Solo anadimos "Z" cuando no hay zona horaria.
      const f = String(r.fint || "");
      const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(f);
      const ts = new Date(hasTz ? f : f + "Z").getTime();
      if (!Number.isFinite(ts)) continue;
      if (!prev || ts > prev._ts) { r._ts = ts; byId.set(r.idema, r); }
    }
    _aemetCache = Array.from(byId.values()).map(r => ({
      id: "aemet_" + r.idema,
      rawId: r.idema,
      provider: "aemet",
      name: _aemetTitleCase(r.ubi || r.idema),
      lat: typeof r.lat === "number" ? r.lat : parseFloat(r.lat),
      lon: typeof r.lon === "number" ? r.lon : parseFloat(r.lon),
      alt: r.alt != null ? Number(r.alt) : null,
      lastDate: new Date(r._ts).toISOString(),
      // Datos crudos por si los necesitamos al mostrar:
      wind_speed_avg: r.vv  != null ? r.vv  * 3.6 : null,  // m/s -> km/h
      wind_speed_max: r.vmax!= null ? r.vmax* 3.6 : null,
      wind_heading:   r.dv  != null ? r.dv  : null,
      temperature:    r.ta  != null ? r.ta  : null,
      humidity:       r.hr  != null ? r.hr  : null,
    })).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon));
    _aemetCacheTs = Date.now();
    _aemetSaveLs(_aemetCache);
    return _aemetCache;
  } catch (e) {
    console.warn("getAllAemetStations:", e);
    return _aemetCache || [];
  }
}

function _aemetTitleCase(s) {
  return String(s || "").toLowerCase().replace(/(^|[\s\-\/\(\),'])([a-záéíóúñ])/gi,
    (_, sep, ch) => sep + ch.toUpperCase());
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
  if (pct >= 75) return "high";
  if (pct >= 50) return "med";
  if (pct >= 25) return "low";
  if (pct > 0) return "vlow";
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
  stormBox.hidden = false;
  stormBox.dataset.level = level;
  stormBar.style.width = `${pct}%`;
  stormPct.textContent = `${pct}%`;
  stormLbl.textContent = t(`wx.storm_level.${level}`);
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
const SUNSET_SHIFT_H = 1;
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

// Plugin: separadores verticales de día en el gráfico de pronóstico (eje categórico).
const forecastDaySepPlugin = {
  id: "forecastDaySep",
  afterDatasetsDraw(chart) {
    const seps = chart.$daySep;
    if (!seps || !seps.length) return;
    const { ctx, chartArea } = chart;
    // Usamos las posiciones de los elementos del dataset 0 para evitar colisiones
    // por etiquetas duplicadas (mismo "HH:00" en hoy y mañana) en el eje categórico.
    const meta = chart.getDatasetMeta(0);
    const pts = meta?.data || [];
    ctx.save();
    seps.forEach(({ index, label }) => {
      if (index <= 0 || index >= pts.length) return;
      const xPrev = pts[index - 1]?.x;
      const xCur = pts[index]?.x;
      if (xPrev == null || xCur == null) return;
      const x = Math.round((xPrev + xCur) / 2) + 0.5;
      // Línea vertical bien visible (sólida, gruesa, color cálido).
      ctx.strokeStyle = "rgba(255,170,60,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      // Etiqueta con fondo tipo "pill" arriba.
      const txt = String(label);
      ctx.font = "bold 11px sans-serif";
      const padX = 6;
      const m = ctx.measureText(txt);
      const w = Math.ceil(m.width) + padX * 2;
      const h = 16;
      const bx = Math.max(chartArea.left, Math.min(chartArea.right - w, x - w / 2));
      const by = chartArea.top + 2;
      ctx.fillStyle = "rgba(255,170,60,0.95)";
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + w - r, by);
      ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
      ctx.lineTo(bx + w, by + h - r);
      ctx.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);
      ctx.lineTo(bx + r, by + h);
      ctx.quadraticCurveTo(bx, by + h, bx, by + h - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1b1f27";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, bx + w / 2, by + h / 2 + 0.5);
    });
    ctx.restore();
  },
};
if (typeof Chart !== "undefined") Chart.register(forecastDaySepPlugin);

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
  // Si el usuario pide solo "Hoy", recortamos también el extremo superior del gráfico
  // al ocaso del día de referencia para no mostrar curvas que entran ya en mañana.
  const toTs = currentForecastDays === 1 ? ref.scanTo.getTime() : Infinity;
  const idxStart = times.findIndex(t => t.getTime() >= fromTs);
  const i0 = Math.max(0, idxStart);
  let iEnd = times.length;
  if (toTs !== Infinity) {
    const idxEnd = times.findIndex(t => t.getTime() > toTs);
    if (idxEnd !== -1) iEnd = idxEnd;
  }

  const slicedTimes = times.slice(i0, iEnd);
  // Helper: ¿es de noche este timestamp? (entre puesta y salida del día correspondiente).
  const daily = fc.daily || {};
  const dailyTimes = (daily.time || []).map(s => String(s));
  const sunrises = (daily.sunrise || []).map(s => s ? new Date(s).getTime() : null);
  const sunsets  = (daily.sunset  || []).map(s => s ? new Date(s).getTime() : null);
  const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const isNightAt = (date) => {
    const idx = dailyTimes.findIndex(s => s.startsWith(ymdOf(date)));
    if (idx < 0) return false;
    const sr = sunrises[idx], ss = sunsets[idx];
    if (sr == null || ss == null) return false;
    const ts = date.getTime();
    return ts < sr || ts > ss;
  };

  // Filtramos las horas nocturnas para que la gráfica use eje categórico compacto
  // (sin huecos vacíos en el eje X). El cambio de día se marca con un separador fino.
  const dayKept = []; // datos en orden cronológico, sólo diurnos
  for (let k = 0; k < slicedTimes.length; k++) {
    const tt = slicedTimes[k];
    if (isNightAt(tt)) continue;
    const gi = k + i0;
    dayKept.push({ t: tt, spd: spd[gi], gust: gust[gi], dir: dir[gi] });
  }
  const labels = dayKept.map(p => `${String(p.t.getHours()).padStart(2,"0")}:00`);
  const spdData = dayKept.map(p => p.spd);
  const gustData = dayKept.map(p => p.gust);
  const dirData = dayKept.map(p => ({ x: 0, y: p.spd, dir: p.dir })); // x se ignora con eje categórico
  const dirColors = dirData.map(p => dirColor(p.dir));
  const dirArrows = dirData.map(p => makeArrowPoint(p.dir, dirColor(p.dir), forecastArrowSize()));

  // Frontera de día: índices donde cambia el día respecto al anterior.
  const dayLocale = t("locale");
  const daySeparators = [];
  for (let k = 1; k < dayKept.length; k++) {
    if (ymdOf(dayKept[k].t) !== ymdOf(dayKept[k - 1].t)) {
      daySeparators.push({
        index: k,
        label: dayKept[k].t.toLocaleDateString(dayLocale, { weekday: "short", day: "numeric" }),
      });
    }
  }

  const data = {
    labels,
    datasets: [
      { label: t("chart.gust"), data: gustData,
        borderColor: "rgba(231,76,60,0.9)", backgroundColor: "rgba(231,76,60,0.15)",
        borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
      { label: t("chart.avg"), data: spdData,
        borderColor: "rgba(78,161,255,1)", backgroundColor: "rgba(78,161,255,0.2)",
        borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true },
      { label: t("chart.dir"), data: spdData, type: "line", showLine: false,
        pointStyle: dirArrows, pointRadius: forecastArrowSize() / 2 },
    ],
  };
  const options = chartCommonOptions();
  // Para el pronóstico usamos eje categórico (sin huecos por horas nocturnas).
  options.scales = options.scales || {};
  options.scales.x = {
    type: "category",
    ticks: { color: "#8aa0bb", maxRotation: 0, autoSkipPadding: 12 },
    grid: { color: "rgba(255,255,255,0.05)" },
  };
  options.plugins = options.plugins || {};
  options.plugins.legend = { display: false };
  options.plugins.tooltip = {
    callbacks: {
      title: (items) => {
        const i = items[0]?.dataIndex ?? 0;
        const dt = dayKept[i]?.t;
        return dt ? dt.toLocaleString(dayLocale, { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
      },
      label: (ctx) => {
        if (ctx.dataset.label === t("chart.dir")) {
          const d = dirData[ctx.dataIndex]?.dir;
          const info = classifyDirection(d);
          return t("chart.dir_tooltip", { name: info.name, deg: Math.round(d) });
        }
        return `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)} km/h`;
      },
    },
  };

  if (forecastChart) { forecastChart.data = data; forecastChart.options = options; }
  else forecastChart = new Chart(ctx, { type: "line", data, options });
  forecastChart.$daySep = daySeparators;
  forecastChart.update();
  renderForecastLegend();

  // Resumen: próximas horas en franja diurna del día de referencia.
  const summary = document.getElementById("forecastSummary");
  summary.innerHTML = "";
  const maxSlots = currentForecastDays === 1 ? 12 : 16;
  const scanFromTs = ref.scanFrom.getTime();
  const scanToTs   = ref.scanTo.getTime();
  let added = 0;
  let lastWasNight = false;
  let nightSeparatorAdded = false;
  for (let i = i0; i < times.length && added < maxSlots; i++) {
    const ts = times[i].getTime();
    // Omite siempre las horas nocturnas (entre puesta y salida del sol).
    if (isNightAt(times[i])) {
      if (!nightSeparatorAdded) {
        const sep = document.createElement("div");
        sep.className = "forecast-night-sep";
        sep.textContent = `🌙 ${t("fc.night")}`;
        summary.appendChild(sep);
        nightSeparatorAdded = true;
      }
      lastWasNight = true;
      if (currentForecastDays === 1 && ts > scanToTs) break;
      continue;
    }
    if (lastWasNight) { nightSeparatorAdded = false; lastWasNight = false; }
    // Sólo dentro de la ventana solar del día de referencia (sunrise → sunset) para "Hoy".
    if (currentForecastDays === 1 && (ts < scanFromTs || ts > scanToTs)) {
      if (ts > scanToTs) break;
      continue;
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

  // Re-evaluar veredicto en vivo ahora que tenemos meteo actualizada.
  // Si aún no hay live para la nueva estación, refrescamos al menos los paneles meteo
  // (clouds, temp, sun, cloud analysis) con las coordenadas nuevas (v99).
  if (latestLive) renderLive(latestLive);
  else {
    const cw = currentWeather();
    const risk = weatherRisk(cw);
    renderWeatherStrip(cw, risk);
    renderCloudPanel(cw, risk);
  }
  renderBestWindow(fc);
}

// Leyenda HTML personalizada del gráfico de pronóstico (checkboxes).
function renderForecastLegend() {
  const host = document.getElementById("forecastLegend");
  if (!host || !forecastChart) return;
  const datasets = forecastChart.data.datasets;
  host.innerHTML = `<div class="fc-legend-title">${t("fc.show")}</div>`;
  datasets.forEach((ds, i) => {
    const visible = forecastChart.isDatasetVisible(i);
    const color = ds.borderColor || ds.backgroundColor || "#888";
    const item = document.createElement("label");
    item.className = "fc-legend-item" + (visible ? "" : " off");
    item.innerHTML = `
      <input type="checkbox" ${visible ? "checked" : ""} />
      <span class="fc-legend-swatch" style="background:${color}"></span>
      <span class="fc-legend-text">${escapeHtml(ds.label)}</span>
    `;
    item.querySelector("input").addEventListener("change", (e) => {
      forecastChart.setDatasetVisibility(i, e.target.checked);
      forecastChart.update();
      item.classList.toggle("off", !e.target.checked);
    });
    host.appendChild(item);
  });
}

// === Comparativa últimos días ===
let compareRenderToken = 0;
async function renderCompare() {
  const grid = document.getElementById("compareGrid");
  setText("compareWindowLabel", t("cmp.window_solar"));

  const myToken = ++compareRenderToken;
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

  // Si entretanto se ha disparado otro render, abortamos para evitar duplicados.
  if (myToken !== compareRenderToken) return;
  grid.innerHTML = "";

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
  const lat = Number(currentTakeoff.lat);
  const lon = Number(currentTakeoff.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const marker = L.marker([lat, lon]).addTo(map)
    .bindPopup(`<b>${currentTakeoff.name}</b><br/>${currentStation?.shortName || currentStation?.name || ""}`)
    .bindTooltip(String(currentTakeoff.name || "").replace(/^Despegue\s+/i, ""), {
      permanent: true, direction: "top", offset: [0, -8], className: "station-label takeoff"
    })
    .openPopup();
  const circle = L.circle([lat, lon], {
    radius: 50000, color: "#4ea1ff", weight: 1, fillOpacity: 0.05, dashArray: "4,4",
  }).addTo(map);
  takeoffMapLayers.push(marker, circle);
  // Asegura el reflow por si el contenedor cambió de tamaño y centra/panea suavemente.
  try { map.invalidateSize(); } catch {}
  map.flyTo([lat, lon], 11, { duration: 0.6 });
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
    const c = distCenter();
    const within = all
      .map(s => {
        const lat = s.location?.latitude, lon = s.location?.longitude;
        if (lat == null || lon == null) return null;
        const dist = haversineKm(c.lat, c.lon, lat, lon);
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
      // No hacemos return: dejamos que las estaciones METAR (aeropuertos) se añadan a continuación.
    } else {

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
    } // fin del else (había estaciones Pioupiou cercanas)
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
  // Filtra aeropuertos dentro del radio (tsRadius) desde la posición del usuario (o despegue como fallback).
  const c = distCenter();
  const within = METAR_AIRPORTS
    .map(a => ({ ...a, dist: haversineKm(c.lat, c.lon, a.lat, a.lon) }))
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
  const ico = btn?.querySelector(".um-item-icon");
  if (!("Notification" in window)) {
    alert(t("notify.unsupported"));
    return;
  }
  if (notificationsEnabled()) {
    localStorage.setItem("notifyEnabled", "0");
    btn.classList.remove("active");
    if (ico) ico.textContent = "🔔";
    btn.title = t("btn.notify_off");
    return;
  }
  let perm = Notification.permission;
  if (perm !== "granted") perm = await Notification.requestPermission();
  if (perm === "granted") {
    localStorage.setItem("notifyEnabled", "1");
    btn.classList.add("active");
    if (ico) ico.textContent = "🔕";
    btn.title = t("btn.notify_on");
  } else {
    alert(t("notify.denied"));
  }
}

function syncNotifyButtonInitial() {
  const btn = document.getElementById("notifyBtn");
  const ico = btn?.querySelector(".um-item-icon");
  if (notificationsEnabled()) {
    btn.classList.add("active");
    if (ico) ico.textContent = "🔕";
    btn.title = t("btn.notify_on");
  } else {
    if (ico) ico.textContent = "🔔";
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
    // Si estamos a <=1h del ocaso o ya ha pasado, mañana es el día relevante:
    // forzamos el selector a +24 h para que el usuario vea hoy(resto)+mañana.
    const ref = referenceDayInfo(fc);
    if (ref.dayOffset === 1 && currentForecastDays === 1) {
      currentForecastDays = 2;
      document.querySelectorAll("#forecastButtons button").forEach(b => {
        b.classList.toggle("active", parseInt(b.dataset.days, 10) === 2);
      });
    }
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
  window.PCAuth?.savePref?.("whHours", h);
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

// === Menú de usuario (dropdown) ===
(function initUserMenu(){
  const btn = document.getElementById("userMenuBtn");
  const panel = document.getElementById("userMenuPanel");
  if (!btn || !panel) return;
  function close(){ panel.hidden = true; btn.setAttribute("aria-expanded","false"); }
  function open(){ panel.hidden = false; btn.setAttribute("aria-expanded","true"); }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (panel.hidden) open(); else close();
  });
  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) close();
  });
  // Cerrar al elegir una acción dentro del menú (excepto el sub-picker de idioma)
  panel.querySelectorAll(".um-item").forEach(item => {
    item.addEventListener("click", () => { close(); });
  });
})();

// === Ayuda ===
const HELP_DOCS_BY_LANG = {
  es: "https://github.com/rcuevasuskar/parapente-cenes/blob/main/docs/es.md",
  en: "https://github.com/rcuevasuskar/parapente-cenes/blob/main/docs/en.md",
  de: "https://github.com/rcuevasuskar/parapente-cenes/blob/main/docs/en.md",
  fr: "https://github.com/rcuevasuskar/parapente-cenes/blob/main/docs/en.md",
  ca: "https://github.com/rcuevasuskar/parapente-cenes/blob/main/docs/es.md",
  eu: "https://github.com/rcuevasuskar/parapente-cenes/blob/main/docs/es.md",
};
function openHelp() {
  const modal = document.getElementById("helpModal");
  const link = document.getElementById("helpDocsLink");
  if (link) link.href = HELP_DOCS_BY_LANG[currentLang] || HELP_DOCS_BY_LANG.es;
  if (modal) modal.hidden = false;
}
function closeHelp() {
  const modal = document.getElementById("helpModal");
  if (modal) modal.hidden = true;
}
document.getElementById("helpBtn")?.addEventListener("click", openHelp);
document.getElementById("helpClose")?.addEventListener("click", closeHelp);
document.getElementById("helpModal")?.addEventListener("click", (e) => {
  if (e.target.id === "helpModal") closeHelp();
});

document.querySelectorAll("#whRange button").forEach(btn => {
  btn.addEventListener("click", () => setWindHistoryHours(parseInt(btn.dataset.h, 10)));
});

// Idioma
const LANG_CODES = ["es", "en", "de", "fr", "ca", "eu"];
const FLAG_SVG = {
  es: '<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" fill="#aa151b"/><rect y="10" width="60" height="20" fill="#f1bf00"/></svg>',
  en: '<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" fill="#012169"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="3"/><path d="M30,0 V40 M0,20 H60" stroke="#fff" stroke-width="10"/><path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="6"/></svg>',
  de: '<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" fill="#000"/><rect y="13.33" width="60" height="13.33" fill="#DD0000"/><rect y="26.66" width="60" height="13.34" fill="#FFCE00"/></svg>',
  fr: '<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="40" fill="#0055A4"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#EF4135"/></svg>',
  ca: '<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" fill="#FCDD09"/><g fill="#DA121A"><rect y="4.44" width="60" height="4.44"/><rect y="13.33" width="60" height="4.44"/><rect y="22.22" width="60" height="4.44"/><rect y="31.11" width="60" height="4.44"/></g></svg>',
  eu: '<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" fill="#D52B1E"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#009B48" stroke-width="9"/><path d="M30,0 V40 M0,20 H60" stroke="#fff" stroke-width="9"/></svg>'
};

function applyLangChange(newLang) {
  if (!LANG_CODES.includes(newLang)) return;
  currentLang = newLang;
  localStorage.setItem("lang", currentLang);
  window.PCAuth?.savePref?.("lang", currentLang);
  renderLangPicker();
  applyStaticI18n();
  if (typeof renderTakeoffPanel === "function") renderTakeoffPanel();
  syncNotifyButtonInitial();
  const whTitleEl = document.getElementById("whTitle");
  if (whTitleEl) whTitleEl.textContent = t("wh.titleFmt").replace("{h}", WH_HOURS);
  if (map) {
    map.eachLayer(l => { if (l instanceof L.CircleMarker) map.removeLayer(l); });
  }
  refreshObservations();
  refreshForecast();
  renderCompare();
  renderNearby();
}

function renderLangPicker() {
  const curFlag = document.getElementById("langCurrentFlag");
  if (curFlag) curFlag.innerHTML = FLAG_SVG[currentLang] || FLAG_SVG.es;
  const menu = document.getElementById("langMenu");
  if (menu) {
    menu.innerHTML = "";
    LANG_CODES.forEach(code => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.lang = code;
      if (code === currentLang) li.classList.add("is-current");
      li.innerHTML = `<span class="lang-flag">${FLAG_SVG[code]}</span>`;
      li.addEventListener("click", () => {
        applyLangChange(code);
        closeLangMenu();
      });
      menu.appendChild(li);
    });
  }
}

function closeLangMenu() {
  const menu = document.getElementById("langMenu");
  const btn = document.getElementById("langCurrent");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

const langBtn = document.getElementById("langCurrent");
if (langBtn) {
  renderLangPicker();
  langBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = document.getElementById("langMenu");
    if (!menu) return;
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    langBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });
  document.addEventListener("click", (e) => {
    const picker = document.getElementById("langPicker");
    if (picker && !picker.contains(e.target)) closeLangMenu();
  });
}

// Botón de tema: cicla auto → dark → light
const themeBtn = document.getElementById("themeToggle");
if (themeBtn) {
  applyTheme(currentTheme);
  themeBtn.addEventListener("click", () => {
    const idx = THEME_VALUES.indexOf(currentTheme);
    const next = THEME_VALUES[(idx + 1) % THEME_VALUES.length];
    applyTheme(next);
  });
}

// === Takeoff selector ===
let allStationsCache = null;
let userLocation = null; // {lat, lon} si el usuario lo ha activado

// Centro de referencia para distancias mostradas al usuario (estaciones cercanas, METARs,
// buscador): preferimos su posición real si la ha compartido; en su defecto, el despegue actual.
function distCenter() {
  return userLocation || { lat: currentTakeoff.lat, lon: currentTakeoff.lon };
}
let tsRadius = parseInt(localStorage.getItem("tsRadius") || "50", 10);
let tsNoRadius = localStorage.getItem("tsNoRadius") === "1";
const TS_PROVIDERS_ALL = ["community", "pioupiou", "aemet", "holfuy"];
let tsProviders = (function() {
  try {
    const raw = localStorage.getItem("tsProviders");
    if (!raw) return new Set(TS_PROVIDERS_ALL);
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return new Set(TS_PROVIDERS_ALL);
    return new Set(arr.filter(p => TS_PROVIDERS_ALL.includes(p)));
  } catch { return new Set(TS_PROVIDERS_ALL); }
})();

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
  renderCurrentTakeoffActions();
  renderTakeoffPanel();
  updatePanelForLabels();
}

// v102: muestra en cada panel qué despegue / estación se está usando
function updatePanelForLabels() {
  // getCurrentTakeoffDoc llama a resolveCurrentTakeoffOrigin internamente.
  const doc = (typeof getCurrentTakeoffDoc === "function") ? getCurrentTakeoffDoc() : null;
  const stName = currentStation?.shortName || currentStation?.name || "";
  const toName = doc?.name || null;
  const text = toName && toName !== stName
    ? t("panel.for_to_st", { to: toName, st: stName })
    : t("panel.for_st", { st: stName });
  ["panelFor", "panelForBlock"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.hidden = !stName;
  });
}

// Devuelve el documento del despegue comunitario correspondiente al despegue actual, si existe.
function getCurrentTakeoffDoc() {
  resolveCurrentTakeoffOrigin();
  if (!currentTakeoffOriginId) return null;
  const list = window.PCAuth?.approvedTakeoffs || [];
  return list.find(t => t.id === currentTakeoffOriginId) || null;
}

// Renderiza la brújula principal (sectores), la guía rápida y las notas
// con la información del despegue actualmente seleccionado.
function renderTakeoffPanel() {
  const labels = DIR_16_BY_LANG[currentLang] || DIR_16_BY_LANG.es;
  const doc = getCurrentTakeoffDoc();
  const crit = currentTakeoffCriteria
    || (doc && doc.criteria)
    || null;
  // Calidades efectivas por índice (16). Si el despegue tiene criterios definidos, los usamos.
  // Sin criterios → neutro (todo "ok"); evita pintar la roseta con sesgo Cenes.
  const q16 = (crit && Array.isArray(crit.qualityByIndex) && crit.qualityByIndex.some(Boolean))
    ? crit.qualityByIndex.map(q => q || "bad")
    : NEUTRAL_QUALITY_BY_INDEX.slice();

  // --- 1) Sectores de la brújula principal ---
  const host = document.getElementById("sectorsHost");
  if (host) {
    host.innerHTML = "";
    for (let i = 0; i < 16; i++) {
      const q = q16[i] || "bad";
      const startDeg = i * 22.5 - 11.25;       // permite valores negativos para el sector N (wrap)
      const endDeg = startDeg + 22.5;
      const div = document.createElement("div");
      div.className = "sector " + q;
      // Para sectores que cruzan el 0 (N), iniciamos desde startDeg (negativo) y pintamos 22.5°
      div.style.background = `conic-gradient(from ${startDeg}deg, currentColor 0deg, currentColor 22.5deg, transparent 0)`;
      div.style.setProperty("--start", `${((startDeg % 360) + 360) % 360}deg`);
      div.style.setProperty("--end", `${((endDeg % 360) + 360) % 360}deg`);
      host.appendChild(div);
    }
  }

  // --- 2) Guía rápida ---
  const guideList = document.getElementById("guideList");
  if (guideList) {
    const dirsIdeal = [], dirsOk = [], dirsBad = [];
    for (let i = 0; i < 16; i++) {
      const q = q16[i];
      if (q === "ideal") dirsIdeal.push(labels[i]);
      else if (q === "ok") dirsOk.push(labels[i]);
      else if (q === "bad") dirsBad.push(labels[i]);
    }
    const fmtList = (arr, fallback) => arr.length ? arr.join(", ") : fallback;
    const wmin = (crit && Number.isFinite(crit.windMin)) ? crit.windMin : null;
    const wmax = (crit && Number.isFinite(crit.windMax)) ? crit.windMax : null;
    const gmax = (crit && Number.isFinite(crit.gustMax)) ? crit.gustMax : 30;
    let rangeStr = "";
    if (wmin != null && wmax != null) rangeStr = t("guide.range_fmt", { min: wmin, max: wmax });
    else if (wmin != null) rangeStr = t("guide.range_min", { min: wmin });
    else if (wmax != null) rangeStr = t("guide.range_max", { max: wmax });
    // Si no hay ningún sector marcado como "bad", mostramos "resto" para evitar lista vacía cuando hay ideales/ok.
    const badText = dirsBad.length
      ? dirsBad.join(", ")
      : (dirsIdeal.length || dirsOk.length ? t("guide.rest") : t("guide.no_orient"));
    const avgWarn = Math.round(gmax * 0.66);
    guideList.innerHTML = `
      <li><span class="dot ideal"></span> <span>${t("guide.fmt_ideal", {
        label: t("guide.label_ideal"),
        dirs: fmtList(dirsIdeal, t("guide.no_dirs")),
        range: rangeStr,
      })}</span></li>
      <li><span class="dot ok"></span> <span>${t("guide.fmt_ok", {
        label: t("guide.label_ok"),
        dirs: fmtList(dirsOk, t("guide.no_dirs")),
      })}</span></li>
      <li><span class="dot bad"></span> <span>${t("guide.fmt_bad", {
        label: t("guide.label_bad"),
        dirs: badText,
      })}</span></li>
      <li><span class="dot warn"></span> <span>${t("guide.fmt_warn", {
        label: t("guide.label_warn"),
        avg: avgWarn,
        gust: gmax,
      })}</span></li>
    `;
  }

  // --- 3) Notas del despegue ---
  const notesBlock = document.getElementById("guideNotes");
  const notesText = document.getElementById("guideNotesText");
  const notesStr = doc?.notes ? String(doc.notes).trim() : "";
  if (notesBlock && notesText) {
    if (notesStr) {
      notesText.textContent = notesStr;
      notesBlock.hidden = false;
    } else {
      notesText.textContent = "";
      notesBlock.hidden = true;
    }
  }
}

function renderCurrentTakeoffActions() {
  const host = document.getElementById("tsCurrentActions");
  if (!host) return;
  // Intenta resolver origen comunitario si aún no está fijado.
  resolveCurrentTakeoffOrigin();
  host.innerHTML = "";
  const u = window.PCAuth?.user;
  if (!u || u.isAnonymous) return;

  // Localiza el favorito que corresponde al despegue actual.
  const favs = window.PCAuth?.favorites || [];
  const homeId = window.PCAuth?.prefs?.homeFavId || null;
  let fav = null;
  if (currentTakeoffOriginId) {
    fav = favs.find(f => f.source === "community" && f.refId === currentTakeoffOriginId);
  } else if (currentStation?.provider === "pioupiou") {
    fav = favs.find(f => f.source === "pioupiou" && String(f.refId) === String(currentStationId));
  } else if (currentStation?.provider === "ffvl") {
    fav = favs.find(f => f.source === "ffvl" && String(f.refId) === String(currentStation.rawId || currentStationId));
  }
  const isHome = !!(fav && fav.id === homeId);
  const favoritable = !!(currentTakeoffOriginId || (currentStation?.provider === "pioupiou") || (currentStation?.provider === "ffvl"));

  // ⭐ favorito
  if (favoritable) {
    const star = document.createElement("button");
    star.type = "button"; star.className = "ts-icon-btn" + (fav ? " is-active" : "");
    star.title = fav ? t("fav.remove") : t("fav.add");
    star.textContent = fav ? "★" : "☆";
    star.addEventListener("click", async () => {
      try {
        if (fav) {
          if (fav.id === homeId) await window.PCAuth.setHomeFavorite(null);
          await window.PCAuth.removeFavorite(fav.id);
        } else {
          const source = currentTakeoffOriginId ? "community" : currentStation.provider;
          const refId = currentTakeoffOriginId
            ? currentTakeoffOriginId
            : (source === "ffvl" ? (currentStation.rawId || currentStationId) : currentStationId);
          await window.PCAuth.addFavorite({
            source, refId,
            stationId: source === "community" ? currentStationId : (source === "ffvl" ? null : currentStationId),
            name: currentStation.name,
            lat: currentTakeoff.lat, lon: currentTakeoff.lon,
            criteria: currentTakeoffCriteria || null,
            alertsEnabled: false,
          });
        }
      } catch (e) { console.warn("[fav cur]", e); }
    });
    host.appendChild(star);
  }

  // ♛ habitual (solo si ya es favorito)
  if (fav) {
    const crown = document.createElement("button");
    crown.type = "button"; crown.className = "ts-icon-btn" + (isHome ? " is-home" : "");
    crown.title = isHome ? t("fav.home_unset") : t("fav.home_set");
    crown.textContent = isHome ? "👑" : "♛";
    crown.addEventListener("click", async () => {
      try { await window.PCAuth.setHomeFavorite(isHome ? null : fav.id); renderCurrentTakeoffActions(); }
      catch (e) { console.warn("[home cur]", e); }
    });
    host.appendChild(crown);
    // 🔔 alertas
    const bell = document.createElement("button");
    bell.type = "button"; bell.className = "ts-icon-btn" + (fav.alertsEnabled ? " is-alert" : "");
    bell.title = fav.alertsEnabled ? t("fav.alert_off") : t("fav.alert_on");
    bell.textContent = fav.alertsEnabled ? "🔔" : "🔕";
    bell.addEventListener("click", async () => {
      try { await window.PCAuth.updateFavorite(fav.id, { alertsEnabled: !fav.alertsEnabled }); }
      catch (e) { console.warn("[bell cur]", e); }
    });
    host.appendChild(bell);
  }

  // ✎ sugerir cambios — siempre visible para usuarios registrados.
  // Si existe origen comunitario, edita ese doc; si no, propone alta del despegue actual.
  const sug = document.createElement("button");
  sug.type = "button"; sug.className = "ts-icon-btn";
  sug.title = currentTakeoffOriginId ? t("to.suggest") : t("to.propose");
  sug.textContent = "✎";
  sug.addEventListener("click", () => {
    if (currentTakeoffOriginId) {
      openTakeoffSuggest(currentTakeoffOriginId);
    } else {
      openTakeoffSubmit({
        name: currentStation.name,
        lat: currentTakeoff.lat,
        lon: currentTakeoff.lon,
        stationId: currentStation.provider === "pioupiou" ? currentStationId : null,
        criteria: currentTakeoffCriteria || null,
      });
    }
  });
  host.appendChild(sug);
}

function openTakeoffSuggest(originId) {
  const to = (window.PCAuth?.approvedTakeoffs || []).find(x => x.id === originId);
  if (!to) { alert(t("to.suggest_notfound")); return; }
  _suggestTargetId = originId;
  openTakeoffSubmit({
    _suggesting: true,
    name: to.name, lat: to.lat, lon: to.lon, alt: to.alt,
    stationId: to.stationId,
    orientations: to.orientations || "",
    notes: to.notes || "",
    criteria: to.criteria || null,
  });
  const title = document.getElementById("toTitle"); if (title) title.textContent = t("to.suggest_title");
  const sb = document.getElementById("toSubmitBtn"); if (sb) sb.textContent = t("to.suggest_submit");
}
let _suggestTargetId = null;

function resolveCurrentTakeoffOrigin() {
  if (currentTakeoff.id) return;
  const list = window.PCAuth?.approvedTakeoffs || [];
  if (!list.length) return;
  // 1) Coincidencia por stationId.
  if (currentStationId != null) {
    const byStation = list.find(t => t.stationId != null && Number(t.stationId) === Number(currentStationId));
    if (byStation) { _attachTakeoffDoc(byStation); return; }
  }
  // 2) Coincidencia por nombre (case-insensitive, trim).
  const curName = (currentStation?.name || currentTakeoff?.name || "").trim().toLowerCase();
  if (curName) {
    const byName = list.find(t => (t.name || "").trim().toLowerCase() === curName);
    if (byName) { _attachTakeoffDoc(byName); return; }
  }
  // 3) Coincidencia por coordenadas: despegue comunitario más cercano dentro de 3 km (v101).
  const lat = currentTakeoff?.lat, lon = currentTakeoff?.lon;
  if (lat == null || lon == null) return;
  let bestT = null, bestKm = Infinity;
  for (const t of list) {
    const km = haversineKm(lat, lon, t.lat, t.lon);
    if (km < bestKm && km <= 3) { bestKm = km; bestT = t; }
  }
  if (bestT) _attachTakeoffDoc(bestT);
}

// v103: aplica los datos de un documento `takeoffs` al currentTakeoff actual
// (sin tocar currentStation, que es la fuente de datos elegida por el usuario).
function _attachTakeoffDoc(doc) {
  currentTakeoff.id = doc.id;
  currentTakeoff.name = doc.name || currentTakeoff.name;
  currentTakeoff.shortName = doc.shortName || doc.name || currentTakeoff.shortName;
  if (doc.lat != null) currentTakeoff.lat = doc.lat;
  if (doc.lon != null) currentTakeoff.lon = doc.lon;
  if (doc.alt != null) currentTakeoff.alt = doc.alt;
  currentTakeoff.criteria = doc.criteria || null;
  currentTakeoff.orientations = doc.orientations || "";
  currentTakeoff.notes = doc.notes || "";
  // Aliases compat
  currentTakeoffOriginId = doc.id;
  currentTakeoffCriteria = doc.criteria || null;
}

// v103: API canónica para cambiar el lugar/fuente de datos. Asegura coherencia
// entre currentTakeoff (lugar), currentStation (fuente) y los aliases compat.
function setCurrent({ takeoff, station }) {
  if (station) {
    currentStation = station;
    currentStationId = station.id;
  }
  if (takeoff) {
    currentTakeoff = {
      id: takeoff.id || null,
      name: takeoff.name || station?.name || "",
      shortName: takeoff.shortName || takeoff.name || station?.shortName || station?.name || "",
      lat: takeoff.lat != null ? takeoff.lat : station?.lat,
      lon: takeoff.lon != null ? takeoff.lon : station?.lon,
      alt: takeoff.alt ?? station?.alt ?? null,
      criteria: takeoff.criteria || null,
      orientations: takeoff.orientations || "",
      notes: takeoff.notes || "",
    };
  } else if (station) {
    // Estación cruda sin doc comunitario: el "lugar" coincide con la estación,
    // pero sin criterios → veredicto neutro.
    currentTakeoff = {
      id: null,
      name: station.name,
      shortName: station.shortName || station.name,
      lat: station.lat,
      lon: station.lon,
      alt: station.alt ?? null,
      criteria: null,
      orientations: "",
      notes: "",
    };
  }
  currentTakeoffOriginId = currentTakeoff.id;
  currentTakeoffCriteria = currentTakeoff.criteria;
}

function selectStation(station, opts) {
  if (opts && opts.userPicked) _userPickedStation = true;
  // Si llega un opts.takeoff explícito (click en despegue comunitario),
  // lo usamos como lugar; si no, sintetizamos uno a partir de la estación.
  const takeoff = (opts && opts.takeoff) ? opts.takeoff
                 : (opts && (opts.originId || opts.criteria))
                   ? {
                       id: opts.originId || null,
                       name: station.name,
                       shortName: station.shortName || station.name,
                       lat: station.lat, lon: station.lon,
                       criteria: opts.criteria || null,
                     }
                   : null;
  setCurrent({ takeoff, station });
  saveSelectedStation(station);
  applyCurrentTakeoffLabel();
  refreshAllForCurrentTakeoff();
}

async function ensureAllStations() {
  if (allStationsCache) return allStationsCache;
  try {
    const [pioupiou, aemet, holfuy] = await Promise.all([
      getAllStations().catch(() => []),
      getAllAemetStations().catch(() => []),
      getAllHolfuyStations().catch(() => []),
    ]);
    allStationsCache = { pioupiou, aemet, holfuy };
  } catch (e) {
    console.warn("ensureAllStations:", e);
    allStationsCache = { pioupiou: [], aemet: [], holfuy: [] };
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
  const center = distCenter();

  resultsEl.innerHTML = `<div class="ts-loading">${t("ts.loading")}</div>`;
  const all = await ensureAllStations();
  const maxDist = tsNoRadius ? Infinity : tsRadius;
  const provOn = (p) => tsProviders.has(p);

  let items = !provOn("pioupiou") ? [] : (all.pioupiou || [])
    .map(stationFromPioupiou)
    .filter(Boolean)
    .filter(s => isStationRecent(s, 24))
    .map(s => ({ ...s, dist: haversineKm(center.lat, center.lon, s.lat, s.lon) }))
    .filter(s => s.dist <= maxDist);

  // AEMET: estaciones con datos en las últimas 24 h
  const aemetItems = !provOn("aemet") ? [] : (all.aemet || [])
    .filter(s => isStationRecent(s, 24))
    .map(s => ({ ...s, dist: haversineKm(center.lat, center.lon, s.lat, s.lon) }))
    .filter(s => s.dist <= maxDist);
  items = items.concat(aemetItems);

  // Holfuy: estaciones autorizadas (configuradas en holfuy-config.js)
  const holfuyItems = !provOn("holfuy") ? [] : (all.holfuy || [])
    .filter(s => isStationRecent(s, 24))
    .map(s => ({ ...s, dist: haversineKm(center.lat, center.lon, s.lat, s.lon) }))
    .filter(s => s.dist <= maxDist);
  items = items.concat(holfuyItems);

  // Mezcla despegues comunitarios aprobados
  const community = !provOn("community") ? [] : (window.PCAuth?.approvedTakeoffs || []).map(to => ({
    id: "to_" + to.id,
    provider: "community",
    name: to.name,
    lat: to.lat, lon: to.lon,
    community: true,
    stationId: to.stationId,
    raw: to,
    dist: haversineKm(center.lat, center.lon, to.lat, to.lon),
  })).filter(s => s.dist <= maxDist);
  items = items.concat(community);

  // Evita duplicados: si una estación Pioupiou/FFVL ya está registrada como despegue comunitario
  // (mismo stationId, mismo nombre normalizado o muy cerca geográficamente), sólo mostramos la tarjeta comunitaria.
  const communityStationIds = new Set(
    community.map(c => c.stationId).filter(id => id != null).map(Number)
  );
  const normalizeName = (n) => String(n || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(despegue|cerro|alto|loma|sierra|de|del|la|el|los|las)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const communityNames = new Set(community.map(c => normalizeName(c.name)).filter(Boolean));
  const PROX_KM = 2.0; // un despegue y su estación de viento suelen estar dentro de 2 km
  if (community.length) {
    const before = items.length;
    items = items.filter(s => {
      if (s.community) return true;
      if (communityStationIds.has(Number(s.id))) return false;
      const nm = normalizeName(s.name);
      if (nm && communityNames.has(nm)) return false;
      for (const c of community) {
        if (haversineKm(s.lat, s.lon, c.lat, c.lon) <= PROX_KM) return false;
      }
      return true;
    });
    if (window.PCAuth?.isAdmin) {
      console.debug("[ts] dedup", { before, after: items.length, communityStationIds: [...communityStationIds], communityNames: [...communityNames] });
    }
  }

  if (query) {
    items = items.filter(s => s.name.toLowerCase().includes(query));
  }
  items.sort((a, b) => a.dist - b.dist);

  // Identifica favoritos + home
  const favs = window.PCAuth?.favorites || [];
  const homeId = window.PCAuth?.prefs?.homeFavId || null;
  const favKey = (s) => {
    if (s.community) return "co_" + (s.raw?.id || "");
    if (s.provider === "ffvl") return "ffvl_" + (s.rawId || s.id);
    return "pp_" + s.id;
  };
  const favByKey = {};
  favs.forEach(f => {
    let key;
    if (f.source === "community") key = "co_" + f.refId;
    else if (f.source === "ffvl") key = "ffvl_" + f.refId;
    else key = "pp_" + f.refId;
    favByKey[key] = f;
  });

  // Construye lista de favoritos (siempre mostrar, no depende del radio)
  const favItems = favs.map(f => {
    const fakeItem = {
      id: f.source === "pioupiou" ? Number(f.refId) : (f.source === "community" ? "to_" + f.refId : "ffvl_" + f.refId),
      provider: f.source,
      name: f.name,
      lat: f.lat, lon: f.lon,
      community: f.source === "community",
      stationId: f.stationId,
      raw: f.source === "community" ? { id: f.refId, criteria: f.criteria, stationId: f.stationId } : null,
      rawId: f.source === "ffvl" ? f.refId : undefined,
      dist: haversineKm(center.lat, center.lon, f.lat, f.lon),
      _fav: f,
      _isHome: f.id === homeId,
    };
    return fakeItem;
  }).filter(f => !query || f.name.toLowerCase().includes(query));
  // Home siempre primero; resto alfabético.
  favItems.sort((a, b) => {
    if (a._isHome && !b._isHome) return -1;
    if (!a._isHome && b._isHome) return 1;
    return a.name.localeCompare(b.name);
  });

  // Filtra de items los que ya están en favoritos para no duplicar.
  const favKeys = new Set(favItems.map(f => favKey(f)));
  const others = items.filter(s => !favKeys.has(favKey(s))).slice(0, 50);

  if (!favItems.length && !others.length) {
    const emptyKey = tsNoRadius ? "ts.empty_global" : "ts.empty";
    resultsEl.innerHTML = `<div class="ts-empty">${t(emptyKey)}</div>`;
    return;
  }
  resultsEl.innerHTML = "";
  const u = window.PCAuth?.user;
  const loggedIn = u && !u.isAnonymous;

  if (favItems.length) {
    const h = document.createElement("div");
    h.className = "ts-section-header";
    h.textContent = t("fav.section");
    resultsEl.appendChild(h);
    for (const s of favItems) resultsEl.appendChild(renderSearchRow(s, { loggedIn, favByKey, homeId, favKey }));
  }
  if (others.length) {
    if (favItems.length) {
      const h2 = document.createElement("div");
      h2.className = "ts-section-header";
      h2.textContent = t("fav.others");
      resultsEl.appendChild(h2);
    }
    for (const s of others) resultsEl.appendChild(renderSearchRow(s, { loggedIn, favByKey, homeId, favKey }));
  }
}

function renderSearchRow(s, ctx) {
  const isCommunity = !!s.community;
  const isFfvl = s.provider === "ffvl";
  const isAemet = s.provider === "aemet";
  const isHolfuy = s.provider === "holfuy";
  const enabled = isCommunity ? (s.stationId != null)
                  : isFfvl ? false
                  : (isAemet || isHolfuy) ? true
                  : ENABLED_STATION_IDS.has(s.id);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ts-result"
    + (s.id === currentStationId ? " selected" : "")
    + (enabled ? "" : " disabled")
    + (isCommunity ? " community" : "")
    + (isFfvl ? " ffvl" : "")
    + (isAemet ? " aemet" : "")
    + (isHolfuy ? " holfuy" : "");
  if (!enabled) btn.disabled = true;
  let tail;
  if (isCommunity) {
    tail = `<span class="ts-result-badge">${t("to.community_badge")}</span>`;
  } else if (isFfvl) {
    tail = `<span class="ts-result-provider ffvl">FFVL</span>`;
  } else if (isAemet) {
    tail = `<span class="ts-result-provider aemet">AEMET</span>`;
  } else if (isHolfuy) {
    tail = `<span class="ts-result-provider holfuy">Holfuy</span>`;
  } else if (enabled) {
    tail = `<span class="ts-result-provider">${s.provider}</span>`;
  } else {
    tail = `<span class="ts-result-soon">${t("ts.coming_soon")}</span>`;
  }
  btn.innerHTML = `
    <span class="ts-result-name">${escapeHtml(s.name)}</span>
    <span class="ts-result-dist">${s.dist.toFixed(1)} km</span>
    ${tail}
  `;
  if (enabled) {
    btn.addEventListener("click", () => {
      if (isCommunity) {
        selectStation({
          id: s.stationId, provider: "pioupiou",
          name: s.name, shortName: s.name,
          lat: s.lat, lon: s.lon,
        }, { criteria: s.raw?.criteria || null, originId: s.raw?.id || null, userPicked: true });
      } else {
        selectStation({ id: s.id, provider: s.provider, name: s.name, shortName: s.name, lat: s.lat, lon: s.lon }, { userPicked: true });
      }
      document.getElementById("tsPanel").hidden = true;
    });
  }

  const row = document.createElement("div");
  row.className = "ts-result-row";
  row.appendChild(btn);

  // Icon area (solo usuarios logueados no-anónimos)
  if (ctx.loggedIn) {
    const icons = document.createElement("span");
    icons.className = "ts-result-icons";
    const key = ctx.favKey(s);
    const fav = ctx.favByKey[key];
    const isHome = fav && fav.id === ctx.homeId;

    // Estrella (favorito)
    const star = document.createElement("button");
    star.type = "button"; star.className = "ts-icon-btn" + (fav ? " is-active" : "");
    star.title = fav ? t("fav.remove") : t("fav.add");
    star.textContent = fav ? "★" : "☆";
    star.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      try {
        if (fav) {
          if (fav.id === ctx.homeId) await window.PCAuth.setHomeFavorite(null);
          await window.PCAuth.removeFavorite(fav.id);
        } else {
          await window.PCAuth.addFavorite({
            source: isCommunity ? "community" : (isFfvl ? "ffvl" : "pioupiou"),
            refId: isCommunity ? (s.raw?.id || "") : (isFfvl ? s.rawId : s.id),
            stationId: isCommunity ? s.stationId : (isFfvl ? null : s.id),
            name: s.name,
            lat: s.lat, lon: s.lon,
            criteria: isCommunity ? (s.raw?.criteria || null) : null,
            alertsEnabled: false,
          });
        }
      } catch (e) { console.warn("[fav]", e); }
    });
    icons.appendChild(star);

    // Corona (home) — solo si es favorito
    if (fav) {
      const crown = document.createElement("button");
      crown.type = "button"; crown.className = "ts-icon-btn" + (isHome ? " is-home" : "");
      crown.title = isHome ? t("fav.home_unset") : t("fav.home_set");
      crown.textContent = isHome ? "👑" : "♛";
      crown.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        try { await window.PCAuth.setHomeFavorite(isHome ? null : fav.id); tsRunSearch(); }
        catch (e) { console.warn("[home]", e); }
      });
      icons.appendChild(crown);

      // Campana (alertas) — solo en favoritos
      const bell = document.createElement("button");
      bell.type = "button"; bell.className = "ts-icon-btn" + (fav.alertsEnabled ? " is-alert" : "");
      bell.title = fav.alertsEnabled ? t("fav.alert_off") : t("fav.alert_on");
      bell.textContent = fav.alertsEnabled ? "🔔" : "🔕";
      bell.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        try { await window.PCAuth.updateFavorite(fav.id, { alertsEnabled: !fav.alertsEnabled }); }
        catch (e) { console.warn("[bell]", e); }
      });
      icons.appendChild(bell);
    }

    // Botón "+ Proponer" para resultados deshabilitados que no son comunidad.
    // Para resultados comunitarios (con datos de despegue ya registrados) ofrecemos en su lugar
    // un botón "✎ Sugerir cambios" que abre el formulario prellenado.
    if (isCommunity) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "ts-result-propose";
      edit.title = t("to.suggest");
      edit.textContent = "✎";
      edit.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = s.raw?.id;
        if (id) openTakeoffSuggest(id);
      });
      icons.appendChild(edit);
    } else if (!enabled) {
      const prop = document.createElement("button");
      prop.type = "button";
      prop.className = "ts-result-propose";
      prop.title = t("to.propose");
      prop.textContent = "+";
      prop.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openTakeoffSubmit({
          name: s.name, lat: s.lat, lon: s.lon,
          stationId: isFfvl ? null : s.id,
          alt: s.alt || null,
          orientations: s.orientations || "",
        });
      });
      icons.appendChild(prop);
    }
    row.appendChild(icons);
  }
  return row;
}

function initTakeoffSelector() {
  applyCurrentTakeoffLabel();
  const searchEl = document.getElementById("tsSearch");
  const radiusEl = document.getElementById("tsRadius");
  const radiusValEl = document.getElementById("tsRadiusValue");
  const noRadiusEl = document.getElementById("tsNoRadius");
  const panel = document.getElementById("tsPanel");
  const locateBtn = document.getElementById("tsLocateBtn");

  if (radiusEl) {
    radiusEl.value = String(tsRadius);
    if (radiusValEl) radiusValEl.textContent = String(tsRadius);
    radiusEl.disabled = tsNoRadius;
    radiusEl.addEventListener("input", () => {
      tsRadius = parseInt(radiusEl.value, 10);
      if (radiusValEl) radiusValEl.textContent = String(tsRadius);
      localStorage.setItem("tsRadius", String(tsRadius));
      window.PCAuth?.savePref?.("tsRadius", tsRadius);
      tsRunSearch();
    });
  }

  if (noRadiusEl) {
    noRadiusEl.checked = tsNoRadius;
    noRadiusEl.addEventListener("change", () => {
      tsNoRadius = noRadiusEl.checked;
      localStorage.setItem("tsNoRadius", tsNoRadius ? "1" : "0");
      window.PCAuth?.savePref?.("tsNoRadius", tsNoRadius);
      if (radiusEl) radiusEl.disabled = tsNoRadius;
      tsRunSearch();    });
  }

  // Filtro de proveedores (servicios meteorol\u00f3gicos)
  const provBox = document.getElementById("tsProviders");
  if (provBox) {
    provBox.querySelectorAll("input[type=checkbox][data-prov]").forEach(cb => {
      const p = cb.dataset.prov;
      cb.checked = tsProviders.has(p);
      cb.addEventListener("change", () => {
        if (cb.checked) tsProviders.add(p); else tsProviders.delete(p);
        // Evita dejar todos desmarcados: si lo intenta, vuelve a activar
        if (tsProviders.size === 0) { tsProviders.add(p); cb.checked = true; }
        localStorage.setItem("tsProviders", JSON.stringify([...tsProviders]));
        window.PCAuth?.savePref?.("tsProviders", [...tsProviders]);
        tsRunSearch();
      });
    });
  }

  let searchTimer = null;
  if (searchEl) {
    const openPanel = () => {
      if (panel?.hidden) {
        panel.hidden = false;
        tsRunSearch();
      }
    };
    searchEl.addEventListener("focus", openPanel);
    searchEl.addEventListener("click", openPanel);
    searchEl.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(tsRunSearch, 200);
      openPanel();
    });
  }

  // (Botón de toggle eliminado: el panel se abre al enfocar el buscador)

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
          // Si aún no había despegue resuelto por favoritos, intenta el más cercano.
          if (!_userPickedStation && !(window.PCAuth?.favorites || []).length) {
            resolveDefaultTakeoff();
          }
          if (panel) {
            panel.hidden = false;
          }
          tsRunSearch();
          // Refresca también las distancias mostradas en la tarjeta "Estaciones cercanas".
          if (typeof renderNearby === "function") renderNearby();
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

// Aplica prefs remotas cuando el usuario inicia sesión (Firestore → UI).
window.addEventListener("pcuserchange", (e) => {
  const prefs = e.detail?.prefs;
  const user = e.detail?.user;
  const isAdmin = !!e.detail?.isAdmin;
  // UI: muestra/oculta botones según estado.
  const adminBtn = document.getElementById("authAdminBtn");
  if (adminBtn) adminBtn.hidden = !isAdmin;
  const adminReviewBtn = document.getElementById("adminReviewBtn");
  if (adminReviewBtn) adminReviewBtn.hidden = !isAdmin;
  updateAdminPendingBadge();
  if (!prefs) return;
  let changed = false;
  if (prefs.lang && prefs.lang !== currentLang) {
    currentLang = prefs.lang;
    if (typeof renderLangPicker === "function") renderLangPicker();
    applyStaticI18n();
    if (typeof renderTakeoffPanel === "function") renderTakeoffPanel();
    changed = true;
  }
  if (prefs.whHours && prefs.whHours !== WH_HOURS) {
    setWindHistoryHours(prefs.whHours);
  }
  if (prefs.theme && THEME_VALUES.includes(prefs.theme) && prefs.theme !== currentTheme) {
    applyTheme(prefs.theme);
  }
  if (prefs.tsRadius && prefs.tsRadius !== tsRadius) {
    tsRadius = prefs.tsRadius;
    const r = document.getElementById("tsRadius");
    const rv = document.getElementById("tsRadiusValue");
    if (r) r.value = String(tsRadius);
    if (rv) rv.textContent = String(tsRadius);
    changed = true;
  }
  if (changed) {
    refreshObservations(); refreshForecast(); renderCompare(); renderNearby();
  }
  // Refresca panel de búsqueda para reflejar favoritos del usuario.
  const panel = document.getElementById("tsPanel");
  if (panel && !panel.hidden) tsRunSearch();
  renderCurrentTakeoffActions();
});
const _whTitleInit = document.getElementById("whTitle");
if (_whTitleInit) _whTitleInit.textContent = t("wh.titleFmt").replace("{h}", WH_HOURS);
refreshObservations();
refreshForecast();
renderCompare();
renderNearby();
setInterval(refreshLiveOnly, REFRESH_MS);

// === Despegues comunitarios: submit + admin ===
const DIR16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
// 8 sectores principales para el selector (N, NE, E, SE, S, SO, O, NO)
const DIR8_INDICES = [0, 2, 4, 6, 8, 10, 12, 14]; // posiciones equivalentes en el array de 16
const QPRIO = { ideal: 1, ok: 2, bad: 3 };
function _worseQ(a, b) {
  const pa = a ? QPRIO[a] : 0;
  const pb = b ? QPRIO[b] : 0;
  return pa >= pb ? a : b;
}
function _expand8To16(q8) {
  const out = new Array(16).fill(null);
  for (let k = 0; k < 8; k++) {
    out[k * 2] = q8[k] || null;
  }
  for (let k = 0; k < 8; k++) {
    out[k * 2 + 1] = _worseQ(q8[k] || null, q8[(k + 1) % 8] || null);
  }
  return out;
}
function _collapse16To8(q16) {
  const out = new Array(8).fill(null);
  for (let k = 0; k < 8; k++) out[k] = (q16 && q16[k * 2]) || null;
  return out;
}

function renderDirRose(currentQualities) {
  const host = document.getElementById("toDirRose");
  if (!host) return;
  host.innerHTML = "";
  host.classList.add("compass-rose-picker");
  const labels = DIR_16_BY_LANG[currentLang] || DIR_16_BY_LANG.es;
  const q8 = _collapse16To8(currentQualities);
  const CARDINAL_K = new Set([0, 2, 4, 6]); // N, E, S, O

  // Geometría del SVG: ring de 240×240, sectores de 45°
  const SIZE = 240, CX = SIZE / 2, CY = SIZE / 2;
  const R_OUT = 112, R_IN = 50;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const arcPath = (angDeg) => {
    const a1 = ((angDeg - 22.5) - 90) * Math.PI / 180;
    const a2 = ((angDeg + 22.5) - 90) * Math.PI / 180;
    const x1o = CX + R_OUT * Math.cos(a1), y1o = CY + R_OUT * Math.sin(a1);
    const x2o = CX + R_OUT * Math.cos(a2), y2o = CY + R_OUT * Math.sin(a2);
    const x1i = CX + R_IN  * Math.cos(a1), y1i = CY + R_IN  * Math.sin(a1);
    const x2i = CX + R_IN  * Math.cos(a2), y2i = CY + R_IN  * Math.sin(a2);
    return `M ${x1o.toFixed(2)} ${y1o.toFixed(2)} A ${R_OUT} ${R_OUT} 0 0 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)} L ${x2i.toFixed(2)} ${y2i.toFixed(2)} A ${R_IN} ${R_IN} 0 0 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)} Z`;
  };
  const labelPos = (angDeg) => {
    const a = (angDeg - 90) * Math.PI / 180;
    const r = (R_OUT + R_IN) / 2;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute("class", "rose-svg");

  for (let k = 0; k < 8; k++) {
    const i16 = DIR8_INDICES[k];
    const ang = k * 45;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", arcPath(ang));
    path.setAttribute("class", "rose-sector" + (CARDINAL_K.has(k) ? " is-cardinal" : ""));
    path.dataset.idx = String(k);
    path.dataset.i16 = String(i16);
    path.dataset.q = q8[k] || "bad";
    path.addEventListener("click", () => {
      const cur = path.dataset.q;
      path.dataset.q = cur === "bad" ? "ok" : cur === "ok" ? "ideal" : "bad";
    });
    svg.appendChild(path);

    const [tx, ty] = labelPos(ang);
    const txt = document.createElementNS(SVG_NS, "text");
    txt.setAttribute("x", tx.toFixed(2));
    txt.setAttribute("y", ty.toFixed(2));
    txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("dominant-baseline", "central");
    txt.setAttribute("class", "rose-label" + (CARDINAL_K.has(k) ? " is-cardinal" : ""));
    txt.textContent = labels[i16];
    svg.appendChild(txt);
  }
  host.appendChild(svg);
}

function collectDirRose() {
  const q8 = new Array(8).fill("bad");
  document.querySelectorAll("#toDirRose .rose-sector").forEach(b => {
    const k = parseInt(b.dataset.idx, 10);
    if (Number.isFinite(k) && k >= 0 && k < 8) q8[k] = b.dataset.q || "bad";
  });
  return _expand8To16(q8);
}

function openTakeoffSubmit(prefill) {
  const u = window.PCAuth?.user;
  if (!u || u.isAnonymous) { alert(t("to.submit_login")); return; }
  document.getElementById("toSubmitMsg").textContent = "";
  ["toName","toLat","toLon","toAlt","toOrient","toStation","toNotes","toWindMin","toWindMax","toGustMax"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  // Restaura título y botón por si veníamos de modo sugerencia (será sobreescrito por openTakeoffSuggest si aplica)
  if (!prefill || !prefill._suggesting) {
    _suggestTargetId = null;
    const title = document.getElementById("toTitle"); if (title) title.textContent = t("to.submit_title");
    const sb = document.getElementById("toSubmitBtn"); if (sb) sb.textContent = t("to.submit");
  }
  // Roseta inicial: si prefill.criteria.qualityByIndex existe, lo usamos; si no, derivamos de prefill.orientations.
  let initialQ = new Array(16).fill(null);
  if (prefill?.criteria?.qualityByIndex && prefill.criteria.qualityByIndex.some(Boolean)) {
    initialQ = prefill.criteria.qualityByIndex.slice(0, 16);
    while (initialQ.length < 16) initialQ.push(null);
  } else if (prefill?.orientations) {
    const norm = (x) => x.trim().toUpperCase()
      .replace("Ñ","N").replace("NORTE","N").replace("SUR","S").replace("ESTE","E").replace("OESTE","W")
      .replace("NO","NW").replace("SO","SW").replace("NE","NE").replace("SE","SE");
    String(prefill.orientations).split(/[,;\/\s]+/).map(norm).forEach(code => {
      const idx = DIR16.indexOf(code);
      if (idx >= 0) initialQ[idx] = "ideal";
    });
  }
  renderDirRose(initialQ);
  if (prefill?.criteria) {
    if (Number.isFinite(prefill.criteria.windMin)) document.getElementById("toWindMin").value = String(prefill.criteria.windMin);
    if (Number.isFinite(prefill.criteria.windMax)) document.getElementById("toWindMax").value = String(prefill.criteria.windMax);
    if (Number.isFinite(prefill.criteria.gustMax)) document.getElementById("toGustMax").value = String(prefill.criteria.gustMax);
  }

  // Pre-rellena: si nos pasan datos de una estación, los usamos; si no, centro actual.
  if (prefill && (prefill.lat != null || prefill.name)) {
    if (prefill.name) document.getElementById("toName").value = prefill.name;
    if (prefill.lat != null) document.getElementById("toLat").value = Number(prefill.lat).toFixed(5);
    if (prefill.lon != null) document.getElementById("toLon").value = Number(prefill.lon).toFixed(5);
    if (prefill.stationId != null) document.getElementById("toStation").value = String(prefill.stationId);
    if (prefill.alt != null && prefill.alt !== "") document.getElementById("toAlt").value = String(prefill.alt);
    if (prefill.orientations) document.getElementById("toOrient").value = String(prefill.orientations);
    if (prefill.notes) document.getElementById("toNotes").value = String(prefill.notes);
    setTimeout(() => { document.getElementById("toName")?.focus(); document.getElementById("toName")?.select(); }, 50);
  } else {
    const c = userLocation || { lat: currentTakeoff.lat, lon: currentTakeoff.lon };
    const lat = document.getElementById("toLat");
    const lon = document.getElementById("toLon");
    if (lat) lat.value = c.lat.toFixed(5);
    if (lon) lon.value = c.lon.toFixed(5);
  }
  document.getElementById("takeoffSubmitModal").hidden = false;
}
function closeTakeoffSubmit() {
  document.getElementById("takeoffSubmitModal").hidden = true;
  _suggestTargetId = null;
  const title = document.getElementById("toTitle"); if (title) title.textContent = t("to.submit_title");
  const sb = document.getElementById("toSubmitBtn"); if (sb) sb.textContent = t("to.submit");
}

document.getElementById("toSubmitClose")?.addEventListener("click", closeTakeoffSubmit);
document.getElementById("toCancelBtn")?.addEventListener("click", closeTakeoffSubmit);
document.getElementById("takeoffSubmitModal")?.addEventListener("click", (e) => {
  if (e.target.id === "takeoffSubmitModal") closeTakeoffSubmit();
});
document.getElementById("toPickOnMapBtn")?.addEventListener("click", () => {
  const c = userLocation || { lat: currentTakeoff.lat, lon: currentTakeoff.lon };
  document.getElementById("toLat").value = c.lat.toFixed(5);
  document.getElementById("toLon").value = c.lon.toFixed(5);
});
document.getElementById("toSubmitBtn")?.addEventListener("click", async () => {
  const msg = document.getElementById("toSubmitMsg");
  msg.style.color = "";
  msg.textContent = "";
  try {
    const qualityByIndex = collectDirRose();
    // Derivamos la lista textual "ideal: N, NNE…" desde la rosa (fuente única de verdad).
    const ideals = DIR16.filter((_, i) => qualityByIndex[i] === "ideal");
    const oks = DIR16.filter((_, i) => qualityByIndex[i] === "ok");
    const orientationsText = ideals.concat(oks).join(",");
    const windMinV = parseFloat(document.getElementById("toWindMin").value);
    const windMaxV = parseFloat(document.getElementById("toWindMax").value);
    const gustMaxV = parseFloat(document.getElementById("toGustMax").value);
    const criteria = (qualityByIndex.some(Boolean) || Number.isFinite(windMinV) || Number.isFinite(windMaxV) || Number.isFinite(gustMaxV))
      ? {
          qualityByIndex,
          windMin: Number.isFinite(windMinV) ? windMinV : null,
          windMax: Number.isFinite(windMaxV) ? windMaxV : null,
          gustMax: Number.isFinite(gustMaxV) ? gustMaxV : null,
        }
      : null;
    await window.PCAuth.submitTakeoff({
      name: document.getElementById("toName").value,
      lat: document.getElementById("toLat").value,
      lon: document.getElementById("toLon").value,
      alt: document.getElementById("toAlt").value,
      orientations: orientationsText,
      stationId: document.getElementById("toStation").value,
      notes: document.getElementById("toNotes").value,
      criteria,
      targetId: _suggestTargetId || null,
    });
    msg.style.color = "#2ecc71";
    msg.textContent = _suggestTargetId ? t("to.suggest_ok") : t("to.submit_ok");
    setTimeout(closeTakeoffSubmit, 1400);
  } catch (e) {
    console.error("[to] submit", e);
    msg.textContent = t("to.submit_err") + " [" + (e?.code || e?.message || "?") + "]";
  }
});

// Admin review modal
function renderAdminList() {
  const list = document.getElementById("toAdminList");
  if (!list) return;
  const items = window.PCAuth?.pendingTakeoffs || [];
  if (!items.length) {
    list.innerHTML = `<p class="auth-account-info">${t("to.admin_empty")}</p>`;
    return;
  }
  list.innerHTML = "";
  for (const it of items) {
    const card = document.createElement("div");
    card.className = "to-admin-item";
    const ori = it.orientations ? ` · ${escapeHtml(it.orientations)}` : "";
    const alt = it.alt != null ? ` · ${it.alt} m` : "";
    const sta = it.stationId != null ? ` · Pioupiou ${it.stationId}` : "";
    const targetName = it.targetId
      ? ((window.PCAuth?.approvedTakeoffs || []).find(x => x.id === it.targetId)?.name || it.targetId)
      : null;
    const badge = it.targetId
      ? `<span class="ts-result-badge" style="background:#a55">${t("to.suggestion_badge")} → ${escapeHtml(targetName)}</span> `
      : "";
    card.innerHTML = `
      <h3>${badge}${escapeHtml(it.name)}</h3>
      <div class="to-admin-meta">
        ${t("to.submitted_by")}: <strong>${escapeHtml(it.submittedByName || "?")}</strong><br>
        ${Number(it.lat).toFixed(5)}, ${Number(it.lon).toFixed(5)}${alt}${ori}${sta}
        ${it.notes ? `<br><em>${escapeHtml(it.notes)}</em>` : ""}
      </div>
      <div class="to-admin-actions">
        <button class="to-approve" data-id="${it.id}">${t("to.approve")}</button>
        <button class="to-reject"  data-id="${it.id}">${t("to.reject")}</button>
        <button class="to-delete"  data-id="${it.id}">${t("to.delete")}</button>
      </div>
    `;
    list.appendChild(card);
  }
  list.querySelectorAll(".to-approve").forEach(b => b.addEventListener("click", async () => {
    try { await window.PCAuth.approveTakeoff(b.dataset.id); }
    catch (e) { alert("Error: " + (e?.message || e)); }
  }));
  list.querySelectorAll(".to-reject").forEach(b => b.addEventListener("click", async () => {
    const reason = prompt(t("to.reject_prompt")) || "";
    try { await window.PCAuth.rejectTakeoff(b.dataset.id, reason); }
    catch (e) { alert("Error: " + (e?.message || e)); }
  }));
  list.querySelectorAll(".to-delete").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("¿Eliminar definitivamente?")) return;
    try { await window.PCAuth.deleteTakeoff(b.dataset.id); }
    catch (e) { alert("Error: " + (e?.message || e)); }
  }));
}

document.getElementById("authAdminBtn")?.addEventListener("click", () => {
  document.getElementById("authModal").setAttribute("hidden", "");
  document.getElementById("takeoffAdminModal").hidden = false;
  renderAdminList();
});
document.getElementById("adminReviewBtn")?.addEventListener("click", () => {
  document.getElementById("takeoffAdminModal").hidden = false;
  renderAdminList();
});
function updateAdminPendingBadge() {
  const isAdmin = !!(window.PCAuth && window.PCAuth.isAdmin);
  const count = (window.PCAuth?.pendingTakeoffs || []).length;
  const dot = document.getElementById("userMenuDot");
  const badge = document.getElementById("adminReviewBadge");
  if (dot) dot.hidden = !(isAdmin && count > 0);
  if (badge) {
    badge.hidden = !(isAdmin && count > 0);
    badge.textContent = String(count);
  }
}
document.getElementById("toAdminClose")?.addEventListener("click", () => {
  document.getElementById("takeoffAdminModal").hidden = true;
});
document.getElementById("takeoffAdminModal")?.addEventListener("click", (e) => {
  if (e.target.id === "takeoffAdminModal") document.getElementById("takeoffAdminModal").hidden = true;
});

// Cuando lleguen aprobados, refresca búsqueda y re-render admin si visible
function _hookTakeoffStreams() {
  if (!window.PCAuth) { setTimeout(_hookTakeoffStreams, 200); return; }
  window.PCAuth.onApprovedTakeoffsChange = () => {
    const panel = document.getElementById("tsPanel");
    if (panel && !panel.hidden) tsRunSearch();
    // Cuando lleguen los aprobados, reintenta resolver el origen del despegue actual
    // y descarta el criterio cacheado para que se recoja el actualizado (v97).
    currentTakeoffOriginId = null;
    currentTakeoffCriteria = null;
    renderCurrentTakeoffActions();
    renderTakeoffPanel();
    updatePanelForLabels();
    // Recalcula los indicadores con los nuevos criterios (sin recargar pronóstico/histórico).
    if (typeof refreshObservations === "function") refreshObservations();
  };
  window.PCAuth.onPendingTakeoffsChange = () => {
    const modal = document.getElementById("takeoffAdminModal");
    if (modal && !modal.hidden) renderAdminList();
    updateAdminPendingBadge();
  };
  window.PCAuth.onFavoritesChange = () => {
    const panel = document.getElementById("tsPanel");
    if (panel && !panel.hidden) tsRunSearch();
    renderCurrentTakeoffActions();
    startFavoriteAlertsPolling(); // re-arranca timer
    resolveDefaultTakeoff();      // reevalúa habitual/favorito al llegar lista
  };
  window.PCAuth.onUserChange = () => {
    _userPickedStation = false;   // nueva sesión → reaplica reglas
    resolveDefaultTakeoff();
  };
}
_hookTakeoffStreams();

// === Despegue por defecto ===
// Reglas:
//   1) Favorito "habitual" (homeFavId)
//   2) Favorito añadido primero (menor addedAt)
//   3) Estación habilitada más cercana a la geolocalización del usuario
//   4) Cenes (DEFAULT_STATION)
let _userPickedStation = false;
let _defaultResolvedOnce = false;

function _favToStation(f) {
  if (f.source === "pioupiou") {
    return {
      station: { id: Number(f.refId), provider: "pioupiou", name: f.name, shortName: f.name, lat: f.lat, lon: f.lon },
      opts: { criteria: f.criteria || null },
    };
  }
  if (f.source === "community") {
    return {
      station: { id: f.stationId, provider: "pioupiou", name: f.name, shortName: f.name, lat: f.lat, lon: f.lon },
      opts: { criteria: f.criteria || null, originId: f.refId },
    };
  }
  if (f.source === "ffvl") {
    return {
      station: { id: "ffvl_" + f.refId, provider: "ffvl", name: f.name, shortName: f.name, lat: f.lat, lon: f.lon, rawId: f.refId },
      opts: { criteria: f.criteria || null },
    };
  }
  return null;
}

function _addedAtMs(f) {
  const a = f.addedAt;
  if (!a) return Infinity;
  if (typeof a.toMillis === "function") return a.toMillis();
  if (typeof a.seconds === "number") return a.seconds * 1000;
  return Infinity;
}

async function resolveDefaultTakeoff() {
  if (_userPickedStation) return;
  // 1) Habitual
  const favs = window.PCAuth?.favorites || [];
  const homeId = window.PCAuth?.prefs?.homeFavId || null;
  let chosen = homeId ? favs.find(f => f.id === homeId) : null;
  // 2) Favorito más antiguo
  if (!chosen && favs.length) {
    chosen = [...favs].sort((a, b) => _addedAtMs(a) - _addedAtMs(b))[0];
  }
  if (chosen) {
    const conv = _favToStation(chosen);
    if (conv) { selectStation(conv.station, conv.opts); _defaultResolvedOnce = true; return; }
  }
  // 3) Más cercano a GPS (sin pedir geolocalización; solo si ya está disponible)
  if (userLocation) {
    try {
      const all = await ensureAllStations();
      let best = null, bestD = Infinity;
      for (const s of (all.pioupiou || [])) {
        const st = stationFromPioupiou(s);
        if (!st) continue;
        if (!ENABLED_STATION_IDS.has(st.id)) continue;
        const d = haversineKm(userLocation.lat, userLocation.lon, st.lat, st.lon);
        if (d < bestD) { bestD = d; best = st; }
      }
      if (best) { selectStation(best); _defaultResolvedOnce = true; return; }
    } catch (e) { console.warn("resolveDefaultTakeoff GPS:", e); }
  }
  // 4) Cenes (solo si aún no se resolvió en esta sesión)
  if (!_defaultResolvedOnce) {
    selectStation({ ...DEFAULT_STATION });
    _defaultResolvedOnce = true;
  }
}

// === Alertas por despegue favorito (polling) ===
let _favPollTimer = null;
const _favLastIdeal = {}; // favId → ts del último ideal notificado (anti-spam 1h)

async function pollFavoriteAlerts() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const favs = (window.PCAuth?.favorites || []).filter(f => f.alertsEnabled && f.stationId != null);
  for (const f of favs) {
    try {
      const url = `${API_BASE}/live/${f.stationId}`;
      const j = await fetchJson(url);
      const m = j?.data?.measurements;
      if (!m) continue;
      const avg = m.wind_speed_avg ?? m.wind_avg ?? null;
      const max = m.wind_speed_max ?? m.wind_max ?? null;
      const dir = m.wind_heading ?? null;
      if (avg == null || dir == null) continue;
      // Aplica criterios del favorito (si los tiene) — sin tocar el estado global.
      const c = f.criteria;
      const arr = (c?.qualityByIndex && c.qualityByIndex.some(Boolean))
        ? c.qualityByIndex.map(q => q || "ok")
        : NEUTRAL_QUALITY_BY_INDEX;
      const idx = Math.round((((dir % 360) + 360) % 360) / 22.5) % 16;
      const dirQ = arr[idx] || "unknown";
      const wmin = (c && Number.isFinite(c.windMin)) ? c.windMin : 5;
      const wmax = (c && Number.isFinite(c.windMax)) ? c.windMax : 15;
      const gmax = (c && Number.isFinite(c.gustMax)) ? c.gustMax : 30;
      const tooStrong = avg >= gmax * 0.66 || (max != null && max >= gmax);
      const ideal = !tooStrong && (avg >= wmin && avg <= wmax) && (max == null || max <= gmax * 0.83) && dirQ === "ideal";
      if (!ideal) continue;
      const last = _favLastIdeal[f.id] || 0;
      if (Date.now() - last < 3600 * 1000) continue;
      _favLastIdeal[f.id] = Date.now();
      try {
        new Notification(t("fav.notify_title").replace("{name}", f.name), {
          body: `${avg.toFixed(0)} km/h · ${dirName(dir)}`,
          icon: "icon.svg",
          tag: "fav-" + f.id,
        });
      } catch {}
    } catch (e) { /* silencioso */ }
  }
}

function startFavoriteAlertsPolling() {
  if (_favPollTimer) clearInterval(_favPollTimer);
  // Cada 5 minutos
  _favPollTimer = setInterval(pollFavoriteAlerts, 5 * 60 * 1000);
  // Primera comprobación tras 30s
  setTimeout(pollFavoriteAlerts, 30 * 1000);
}
