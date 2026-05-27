// === Configuración ===
// v118: version visible al final de la app (mantener sincronizada con sw.js CACHE).
const APP_VERSION = "v0.211";
// v165: feature flag para el override personal de criterios (🛠). Desactivado
// por defecto: el codigo se mantiene intacto para poder reactivarlo poniendo
// esta constante a true en el futuro. Mientras esta a false: el boton del
// menu de acciones no se muestra, getCurrentOverride() siempre devuelve null
// y applyCurrentOverride() es no-op, asi que los criterios visibles son
// siempre los del doc comunitario (sin shadowing). Los overrides ya
// guardados en localStorage no se borran.
const FEATURE_PERSONAL_OVERRIDE = false;
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
  // v150: codetabs requiere la barra antes de `?quest=` (sin ella devuelve 301
  // que el fetch desde el navegador no sigue contra el host correcto).
  (u) => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u),
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://corsproxy.io/?" + encodeURIComponent(u),
];

// === Tema (claro / oscuro) ===
const THEME_VALUES = ["dark", "light"];
const THEME_ICON = { dark: "🌙", light: "☀️" };
let currentTheme = (function() {
  const saved = localStorage.getItem("theme");
  // v0.199: eliminado tema "auto" / sistema. Solo dark|light. Default = "dark".
  if (saved === "light") return "light";
  return "dark";
})();
function applyTheme(theme) {
  if (!THEME_VALUES.includes(theme)) theme = "dark";
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
// v168: persistimos tambien el id del despegue (doc en `takeoffs`) seleccionado.
// El despegue es la entidad unica; la estacion solo es una fuente de datos
// asociada. Asi en recargas restauramos exactamente el mismo doc, sin depender
// de resoluciones por nombre/proximidad que pueden enganchar duplicados.
function loadSavedTakeoffId() {
  try { return localStorage.getItem("selectedTakeoffId") || null; } catch { return null; }
}
function saveSelectedStation(s) {
  try { localStorage.setItem("selectedStation", JSON.stringify(s)); } catch {}
  window.PCAuth?.savePref?.("selectedStation", JSON.stringify(s));
  // v168: guarda el id del despegue actual (si lo hay) en paralelo.
  try {
    if (currentTakeoff?.id) localStorage.setItem("selectedTakeoffId", currentTakeoff.id);
    else localStorage.removeItem("selectedTakeoffId");
  } catch {}
}

const REFRESH_MS = 60_000;
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000; // no avisar más de 1 vez cada 30 min

// === i18n ===
const I18N = {
  es: {
    "app.title": "Hoy se vuela",
    "app.brand": "¿Hoy se vuela?",
    "header.h1": "🪂 Viento en Cenes de la Vega",
    "header.subtitle": "Despegue de parapente · Estación",
    "btn.install": "📲 Instalar app",
    "btn.notify_off": "🔔 Avisarme si hay condiciones ideales",
    "btn.notify_on": "🔕 Avisos activados",
    "status.title": "Estado actual",
    "card.n": "N", "card.e": "E", "card.s": "S", "card.w": "O",
    "read.avg": "Velocidad media",
    "cw.speed": "Vel. media",
    "cw.direction": "Dirección",
    "cw.gust": "Racha máx.",
    "read.max": "Racha máx.",
    "read.min": "Mínima",
    "read.last": "Última lectura",
    "read.dir": "Dirección",
    "verdict.loading": "Cargando…",
    "verdict.unavailable.title": "Datos de viento no disponibles",
    "verdict.unavailable.detail": "La estación no reporta lecturas ahora mismo. La previsión sí está disponible más abajo.",
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
    "chart.ideal_band": "Velocidad ideal",
    "chart.gust_band": "Racha aceptable",
    "chart.gust_warn": "Racha supera el máximo recomendado",
    "forecast.mini_compass_label": "Direcciones de viento adecuadas para {name}",
    "chart.gust": "Racha máx (km/h)",
    "chart.dir": "Dirección",
    "chart.dir_tooltip": "Dir: {name} ({deg}°)",
    "fc.title": "Pronóstico (Open-Meteo)",
    "fc.title_for": "Pronóstico para {name}",

    "fc.today": "Hoy",
    "fc.night": "Noche",
    "fc.show": "Mostrar en el gráfico:",
    "fc.dirs_apt": "Direcciones apropiadas:",
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
    "to.name_label": "Nombre del despegue",
    "to.alt_label": "Altitud (m)",
    "to.alt_fetch_title": "Calcular altitud desde el mapa",
    "to.alt_auto_hint": "Se calcula automáticamente desde el mapa (Open‑Meteo). Puedes ajustarla a mano.",
    "to.lat_label": "Latitud",
    "to.lon_label": "Longitud",
    "to.notes_label": "Notas (acceso, peligros…)",
    "to.windy_label": "URL de Windy (opcional)",
    "to.windy_ph": "https://www.windy.com/?…",
    "to.volandoo_label": "URL de la estación en Volandoo (opcional)",
    "to.volandoo_ph": "https://volandoo.com/weather/…",
    "menu.add_takeoff": "Añadir despegue",
    "menu.add_takeoff_tip": "Crear un despegue nuevo a partir de un lugar buscado en el mapa",
    "to.guest_add_tip": "Regístrate para poder añadir y sugerir cambios en despegues",
    "to.geocode_label": "Buscar un lugar en el mapa",
    "to.geocode_ph": "Ej: Pegalajar, Jaén",
    "to.geocode_search": "🔎 Buscar",
    "to.geocode_empty": "Sin resultados",
    "to.ref_station_label": "Estación integrada cercana",
    "to.ref_hint": "Estaciones integradas (Pioupiou, Holfuy, AEMET) a menos de 30 km del punto elegido.",
    "to.ref_moved_warn": "Has movido la ubicación del despegue. Revisa si la estación de referencia sigue siendo adecuada.",
    "to.ref_none": "— Ninguna —",
    "to.ref_legend": "Estación de referencia (opcional)",
    "to.ref_block_hint": "Elige una opción o déjalas todas en blanco para usar la previsión de Windy del punto del mapa.",
    "to.coords_legend": "Coordenadas del despegue",
    "to.coords_open_map": "🗺️ Elegir en el mapa",
    "to.coords_manual_hint": "Si lo prefieres, puedes editar las coordenadas a mano.",
    "to.find_stations": "📡 Buscar",
    "to.ref_need_coords": "Primero rellena la latitud y la longitud.",
    "to.ref_empty": "No hay estaciones integradas a menos de 30 km.",
    "to.pick_map": "�️ Elegir en el mapa",
    "to.pick_map_title": "Elige las coordenadas en el mapa",
    "to.pick_map_hint": "Toca el mapa para situar el despegue, o arrastra el marcador. Usa la capa Satélite o Topo para identificar mejor la ladera.",
    "to.pick_map_confirm": "Usar estas coordenadas",
    "to.pick_map_layer_sat": "Satélite",
    "to.pick_map_layer_topo": "Topo",
    "to.pick_map_layer_street": "Calles",
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
    "co.btn": "Mis criterios",
    "snd.title": "Sondeo atmosférico",
    "snd.btn": "Sondeo",
    "act.menu": "Acciones",
    "snd.btn_tip": "Ver perfil vertical (viento, temperatura y nubes por altitud)",
    "snd.btn_short": "📈",
    "snd.loading": "Cargando sondeo…",
    "snd.error": "No se pudo cargar el sondeo en esta ubicación.",
    "snd.open_windy": "Abrir en Windy",
    "snd.model": "Modelo",
    "snd.hour": "Hora",
    "snd.wind_chart": "Viento por altitud",
    "snd.temp_chart": "Temperatura y rocío por altitud",
    "snd.col_alt": "Altitud (m)",
    "snd.col_lvl": "Nivel",
    "snd.col_t": "T (°C)",
    "snd.col_td": "Td (°C)",
    "snd.col_ws": "Viento (km/h)",
    "snd.col_wd": "Dir",
    "snd.col_cld": "Nubes (%)",
    "snd.show_raw": "Datos en bruto por nivel",
    "snd.wind_axis": "Viento (km/h)",
    "snd.skew_t": "Skew-T",
    "to.propose_tip": "Esta estación no tiene datos de despegue registrados aún. Pulsa para proponer su alta (nombre, orientaciones y criterios). Lo revisará un administrador.",
    "to.suggest_tip": "Este despegue ya está en la comunidad. Pulsa para sugerir cambios (nombre, coords, orientaciones o criterios).",
    "co.title": "Mis criterios para este despegue",
    "co.hint": "Estos criterios se guardan solo en tu dispositivo y sustituyen al veredicto por defecto del despegue.",
    "co.save": "Guardar",
    "co.reset": "Restablecer al original",
    "co.active": "Veredicto según tus criterios personales",
    "to.suggest_title": "Sugerir cambios al despegue",
    "to.suggest_submit": "Enviar sugerencia",
    "to.delete": "Eliminar",
    "to.delete_confirm": "¿Eliminar definitivamente el despegue «{name}»? Esta acción no se puede deshacer.",
    "to.delete_ok": "Despegue eliminado.",
    "to.delete_err": "No se pudo eliminar.",
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
    // v0.197: alerta al amanecer (resumen del dia).
    "sunrise.notif_title": "🌅 Hoy hay vuelo en {name}",
    "sunrise.notif_body": "Mejor ventana hoy: {win}",
    "sunrise.banner_text": "Hoy hay vuelo en {name} · ventana ideal {win}",
    "sunrise.banner_close": "Cerrar aviso",
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
    "near.radius": "Radio: 50 km.",
    "near.none": "No hay otras estaciones Pioupiou activas dentro de 50 km.",
    "near.error": "Error al cargar estaciones cercanas.",
    "near.network_prefix": "Red",
    "near.legend_suffix": "Solo dirección e intensidad media de las últimas horas; cada estación tiene sus propios criterios de volabilidad.",
    "near.avg_unit": "km/h · media {h} h",
    "near.popup_last": "última",
    "near.popup_view": "Ver estación",
    "map.title": "Ubicación del despegue",
    "guide.title": "Guía rápida",
    "guide.title_this": "Guía rápida para este despegue",
    "fc.source_prefix": "Datos:",
    "guide.for": "Criterios para",
    "guide.for_prefix": "para",
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
    "help.quick": "<p><strong>Guía rápida:</strong></p><ul><li>🧭 La <strong>brújula principal</strong> dibuja un anillo con todas las direcciones de viento coloreadas según los criterios del despegue: <span style=\"color:#2ecc71\">verde</span> = direcciones ideales, <span style=\"color:#f1c40f\">amarillo</span> = aceptables y <span style=\"color:#e74c3c\">rojo</span> = no recomendadas. La <strong>flecha</strong> apunta a la dirección de la que viene el viento en vivo y el número del centro es la velocidad media en km/h.</li><li>📊 A los lados de la brújula hay dos <strong>anemómetros verticales</strong> con el mismo estilo visual: a la izquierda \"<em>Velocidad</em>\" muestra el viento medio actual y a la derecha \"<em>Racha</em>\" la racha máxima. Las franjas verde/amarillo/rojo del fondo marcan los rangos definidos para <em>ese</em> despegue y el número en la base es el valor en km/h.</li><li>✎ <strong>Cualquiera puede añadir o editar</strong> la información de un despegue: sectores de dirección, rangos de viento, altitud, notas… Usa ✎ junto al título para sugerir cambios sobre el despegue actual, o + en el buscador para proponer uno nuevo. Las propuestas se revisan y se publican para toda la comunidad.</li><li>📍 Pulsa el botón de ubicación para que las distancias se midan desde tu posición real.</li><li>🔍 Escribe en el buscador para filtrar despegues; los favoritos aparecen primero.</li><li>★ marca favoritos · 👑 fija tu \"hogar\" (despegue habitual) · 🔔 activa alertas cuando las condiciones sean ideales.</li><li>📲 Instala la app como PWA para usarla offline desde el móvil o el ordenador.</li><li>⚠️ Los datos son orientativos. Valora siempre las condiciones in situ.</li></ul>",
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
    "best.warn_yellow": "⚠️ Solo condiciones volables, sin franja óptima",
    "near.airport_label": "Aeropuerto de Granada (LEGR)",
    "near.airport_prefix": "Aeropuerto",
    "near.airport_src": "Open-Meteo (METAR aprox.)",
    "banner.title": "Despegue de parapente de Cenes de la Vega",
    "ts.placeholder": "Buscar despegues",
    "ts.current": "Despegue:",
    "ts.radius": "Radio",
    "ts.no_radius": "Sin límite",
    "ts.close": "Cerrar buscador",
    "ts.show_favs": "Favoritos",
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
    "menu.firebase_console": "Firebase (admin)",
    "menu.firebase_console_tip": "Abrir consola de Firebase: usuarios, tráfico, Firestore…",
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
    "ts.coming_soon": "No añadido",
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
    "app.title": "Hoy se vuela",
    "app.brand": "Flying today?",
    "header.h1": "🪂 Wind at Cenes de la Vega",
    "header.subtitle": "Paragliding takeoff · Station",
    "btn.install": "📲 Install app",
    "btn.notify_off": "🔔 Notify me when ideal",
    "btn.notify_on": "🔕 Alerts on",
    "status.title": "Current status",
    "card.n": "N", "card.e": "E", "card.s": "S", "card.w": "W",
    "read.avg": "Average speed",
    "cw.speed": "Avg speed",
    "cw.direction": "Direction",
    "cw.gust": "Max gust",
    "read.max": "Max gust",
    "read.min": "Min",
    "read.last": "Last reading",
    "read.dir": "Direction",
    "verdict.loading": "Loading…",
    "verdict.unavailable.title": "Wind data unavailable",
    "verdict.unavailable.detail": "The station has no current readings. Forecast is still available below.",
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
    "chart.ideal_band": "Ideal speed",
    "chart.gust_band": "Acceptable gust",
    "chart.gust_warn": "Gust exceeds the recommended max",
    "forecast.mini_compass_label": "Suitable wind directions for {name}",
    "chart.gust": "Max gust (km/h)",
    "chart.dir": "Direction",
    "chart.dir_tooltip": "Dir: {name} ({deg}°)",
    "fc.title": "Forecast (Open-Meteo)",
    "fc.title_for": "Forecast for {name}",

    "fc.today": "Today",
    "fc.night": "Night",
    "fc.show": "Show on chart:",
    "fc.dirs_apt": "Suitable directions:",
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
    "to.name_label": "Takeoff name",
    "to.alt_label": "Altitude (m)",
    "to.alt_fetch_title": "Compute altitude from the map",
    "to.alt_auto_hint": "Automatically computed from the map (Open‑Meteo). You can adjust it manually.",
    "to.lat_label": "Latitude",
    "to.lon_label": "Longitude",
    "to.notes_label": "Notes (access, hazards…)",
    "to.windy_label": "Windy URL (optional)",
    "to.windy_ph": "https://www.windy.com/?…",
    "to.volandoo_label": "Volandoo station URL (optional)",
    "to.volandoo_ph": "https://volandoo.com/weather/…",
    "menu.add_takeoff": "Add takeoff",
    "menu.add_takeoff_tip": "Create a new takeoff from a place searched on the map",
    "to.guest_add_tip": "Sign up to add takeoffs or suggest changes",
    "to.geocode_label": "Search a place on the map",
    "to.geocode_ph": "e.g. Pegalajar, Jaén",
    "to.geocode_search": "🔎 Search",
    "to.geocode_empty": "No results",
    "to.ref_station_label": "Nearby integrated station",
    "to.ref_hint": "Integrated stations (Pioupiou, Holfuy, AEMET) within 30 km of the chosen point.",
    "to.ref_moved_warn": "You have moved the takeoff location. Check whether the reference station is still appropriate.",
    "to.ref_none": "— None —",
    "to.ref_legend": "Reference station (optional)",
    "to.ref_block_hint": "Pick one option or leave all blank to use the Windy forecast for the chosen point.",
    "to.coords_legend": "Takeoff coordinates",
    "to.coords_open_map": "🗺️ Pick on the map",
    "to.coords_manual_hint": "If you prefer, you can edit the coordinates manually.",
    "to.find_stations": "📡 Find",
    "to.ref_need_coords": "Fill latitude and longitude first.",
    "to.ref_empty": "No integrated stations within 30 km.",
    "to.pick_map": "�️ Pick on the map",
    "to.pick_map_title": "Pick the coordinates on the map",
    "to.pick_map_hint": "Tap the map to place the takeoff, or drag the marker. Use the Satellite or Topo layer to identify the slope more easily.",
    "to.pick_map_confirm": "Use these coordinates",
    "to.pick_map_layer_sat": "Satellite",
    "to.pick_map_layer_topo": "Topo",
    "to.pick_map_layer_street": "Streets",
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
    "co.btn": "My criteria",
    "snd.title": "Atmospheric sounding",
    "snd.btn": "Sounding",
    "act.menu": "Actions",
    "snd.btn_tip": "View vertical profile (wind, temperature and clouds by altitude)",
    "snd.btn_short": "📈",
    "snd.loading": "Loading sounding…",
    "snd.error": "Could not load sounding at this location.",
    "snd.open_windy": "Open in Windy",
    "snd.model": "Model",
    "snd.hour": "Hour",
    "snd.wind_chart": "Wind by altitude",
    "snd.temp_chart": "Temperature and dew point by altitude",
    "snd.col_alt": "Altitude (m)",
    "snd.col_lvl": "Level",
    "snd.col_t": "T (°C)",
    "snd.col_td": "Td (°C)",
    "snd.col_ws": "Wind (km/h)",
    "snd.col_wd": "Dir",
    "snd.col_cld": "Clouds (%)",
    "snd.show_raw": "Raw data per level",
    "snd.wind_axis": "Wind (km/h)",
    "snd.skew_t": "Skew-T",
    "to.propose_tip": "This station has no takeoff data yet. Click to propose adding it (name, orientations and criteria). An admin will review it.",
    "to.suggest_tip": "This takeoff is already in the community. Click to suggest changes (name, coords, orientations or criteria).",
    "co.title": "My criteria for this takeoff",
    "co.hint": "These criteria are stored only on your device and override the takeoff default verdict.",
    "co.save": "Save",
    "co.reset": "Reset to original",
    "co.active": "Verdict using your personal criteria",
    "to.suggest_title": "Suggest changes to takeoff",
    "to.suggest_submit": "Send suggestion",
    "to.delete": "Delete",
    "to.delete_confirm": "Permanently delete takeoff “{name}”? This cannot be undone.",
    "to.delete_ok": "Takeoff deleted.",
    "to.delete_err": "Could not delete.",
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
    "sunrise.notif_title": "🌅 Flyable today at {name}",
    "sunrise.notif_body": "Best window today: {win}",
    "sunrise.banner_text": "Flyable today at {name} · ideal window {win}",
    "sunrise.banner_close": "Dismiss alert",
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
    "near.radius": "Radius: 50 km.",
    "near.none": "No other active Pioupiou stations within 50 km.",
    "near.error": "Failed to load nearby stations.",
    "near.network_prefix": "Network",
    "near.legend_suffix": "Only direction and average intensity from the last few hours; each station has its own flyability criteria.",
    "near.avg_unit": "km/h · {h} h avg",
    "near.popup_last": "last",
    "near.popup_view": "View station",
    "map.title": "Takeoff location",
    "guide.title": "Quick guide",
    "guide.title_this": "Quick guide for this takeoff",
    "fc.source_prefix": "Data:",
    "guide.for": "Criteria for",
    "guide.for_prefix": "for",
    "guide.ideal": "<strong>Ideal:</strong> West (W) or Northwest (NW), 5–15 km/h (gusts ≤ 25).",
    "guide.ok": "<strong>Flyable:</strong> North (N) or Southwest (SW), or winds outside the ideal range but below the limit.",
    "guide.bad": "<strong>Bad:</strong> Easterly components (NE, E, SE) — worse the further east.",
    "guide.warn": "<strong>Too strong:</strong> avg ≥ 20 km/h or gusts ≥ 30 km/h.",
    "help.title": "Help",
    "help.quick": "<p><strong>Quick guide:</strong></p><ul><li>🧭 The <strong>main compass</strong> draws a ring with every wind direction colored by this takeoff's criteria: <span style=\"color:#2ecc71\">green</span> = ideal, <span style=\"color:#f1c40f\">yellow</span> = acceptable, <span style=\"color:#e74c3c\">red</span> = not recommended. The <strong>arrow</strong> points to where the live wind is coming from, and the number in the center is the average speed in km/h.</li><li>📊 On each side of the compass there are two <strong>vertical anemometers</strong> sharing the same visual style: \"<em>Speed</em>\" on the left shows the current average wind and \"<em>Gust</em>\" on the right shows the max gust. The green/yellow/red background bands are the ranges defined for <em>that</em> takeoff and the number at the base is the value in km/h.</li><li>✎ <strong>Anyone can add or edit</strong> takeoff information: direction sectors, wind ranges, altitude, notes… Use ✎ next to the title to suggest changes for the current takeoff, or + in the search box to propose a new one. Submissions are reviewed and published for the whole community.</li><li>📍 Tap the location button so distances are measured from your real position.</li><li>🔍 Type in the search to filter takeoffs; favorites appear first.</li><li>★ marks favorites · 👑 sets your \"home\" (usual takeoff) · 🔔 enables alerts for ideal conditions.</li><li>📲 Install the app as a PWA to use it offline from phone or desktop.</li><li>⚠️ Data is indicative. Always assess conditions on site.</li></ul>",
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
    "best.warn_yellow": "⚠️ Only flyable conditions, no optimal window",
    "near.airport_label": "Granada Airport (LEGR)",
    "near.airport_prefix": "Airport",
    "near.airport_src": "Open-Meteo (approx. METAR)",
    "banner.title": "Paragliding takeoff of Cenes de la Vega",
    "ts.placeholder": "Search takeoffs",
    "ts.current": "Takeoff:",
    "ts.radius": "Radius",
    "ts.no_radius": "No limit",
    "ts.close": "Close search",
    "ts.show_favs": "Favorites",
    "theme.title": "Theme (auto/dark/light)",
    "menu.lang": "Language",
    "menu.theme": "Theme",
    "menu.notify": "Alerts",
    "menu.install": "Install app",
    "menu.help": "Help",
    "menu.admin_review": "Review takeoffs",
    "menu.firebase_console": "Firebase (admin)",
    "menu.firebase_console_tip": "Open Firebase console: users, traffic, Firestore…",
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
    "ts.coming_soon": "Not added",
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
    "app.title": "Hoy se vuela",
    "app.brand": "Fliegen wir heute?",
    "header.h1": "🪂 Wind in Cenes de la Vega",
    "header.subtitle": "Gleitschirm-Startplatz · Station",
    "btn.install": "📲 App installieren",
    "btn.notify_off": "🔔 Benachrichtigen bei idealen Bedingungen",
    "btn.notify_on": "🔕 Benachrichtigungen an",
    "status.title": "Aktueller Zustand",
    "card.n": "N", "card.e": "O", "card.s": "S", "card.w": "W",
    "read.avg": "Durchschnittsgeschwindigkeit",
    "cw.speed": "Ø Wind",
    "cw.direction": "Richtung",
    "cw.gust": "Max. Böe",
    "read.max": "Max. Böe",
    "read.min": "Minimum",
    "read.last": "Letzte Messung",
    "read.dir": "Richtung",
    "verdict.loading": "Lädt…",
    "verdict.unavailable.title": "Winddaten nicht verfügbar",
    "verdict.unavailable.detail": "Die Station meldet derzeit keine Werte. Die Vorhersage ist weiter unten verfügbar.",
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
    "chart.ideal_band": "Ideale Geschwindigkeit",
    "chart.gust_band": "Vertretbare Böe",
    "chart.gust_warn": "Böe überschreitet empfohlenes Maximum",
    "forecast.mini_compass_label": "Geeignete Windrichtungen für {name}",
    "chart.gust": "Max. Böe (km/h)",
    "chart.dir": "Richtung",
    "chart.dir_tooltip": "Richt.: {name} ({deg}°)",
    "fc.title": "Vorhersage (Open-Meteo)",
    "fc.title_for": "Vorhersage für {name}",

    "fc.today": "Heute",
    "fc.night": "Nacht",
    "fc.show": "Im Diagramm anzeigen:",
    "fc.dirs_apt": "Geeignete Richtungen:",
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
    "to.name_label": "Name des Startplatzes",
    "to.alt_label": "Höhe (m)",
    "to.alt_fetch_title": "Höhe aus der Karte berechnen",
    "to.alt_auto_hint": "Wird automatisch aus der Karte berechnet (Open‑Meteo). Du kannst sie manuell anpassen.",
    "to.lat_label": "Breitengrad",
    "to.lon_label": "Längengrad",
    "to.notes_label": "Notizen (Zugang, Gefahren…)",
    "to.windy_label": "Windy-URL (optional)",
    "to.windy_ph": "https://www.windy.com/?…",
    "to.volandoo_label": "Volandoo-Station URL (optional)",
    "to.volandoo_ph": "https://volandoo.com/weather/…",
    "menu.add_takeoff": "Startplatz hinzufügen",
    "menu.add_takeoff_tip": "Neuen Startplatz aus einem auf der Karte gesuchten Ort anlegen",
    "to.guest_add_tip": "Registriere dich, um Startplätze hinzuzufügen oder Änderungen vorzuschlagen",
    "to.geocode_label": "Ort auf der Karte suchen",
    "to.geocode_ph": "z. B. Pegalajar, Jaén",
    "to.geocode_search": "🔎 Suchen",
    "to.geocode_empty": "Keine Ergebnisse",
    "to.ref_station_label": "Integrierte Station in der Nähe",
    "to.ref_hint": "Integrierte Stationen (Pioupiou, Holfuy, AEMET) im Umkreis von 30 km um den gewählten Punkt.",
    "to.ref_moved_warn": "Du hast den Startplatz verschoben. Prüfe, ob die Referenzstation noch passend ist.",
    "to.ref_none": "— Keine —",
    "to.ref_legend": "Referenzstation (optional)",
    "to.ref_block_hint": "Wähle eine Option oder lass alle leer, um die Windy-Vorhersage für den Punkt zu nutzen.",
    "to.coords_legend": "Koordinaten des Startplatzes",
    "to.coords_open_map": "🗺️ Auf der Karte auswählen",
    "to.coords_manual_hint": "Du kannst die Koordinaten auch manuell bearbeiten.",
    "to.find_stations": "📡 Suchen",
    "to.ref_need_coords": "Bitte zuerst Breiten- und Längengrad ausfüllen.",
    "to.ref_empty": "Keine integrierten Stationen innerhalb von 30 km.",
    "to.pick_map": "�️ Auf der Karte auswählen",
    "to.pick_map_title": "Wähle die Koordinaten auf der Karte",
    "to.pick_map_hint": "Tippe auf die Karte, um den Startplatz zu platzieren, oder ziehe den Marker. Nutze Satellit oder Topo, um den Hang besser zu erkennen.",
    "to.pick_map_confirm": "Diese Koordinaten verwenden",
    "to.pick_map_layer_sat": "Satellit",
    "to.pick_map_layer_topo": "Topo",
    "to.pick_map_layer_street": "Straßen",
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
    "co.btn": "Meine Kriterien",
    "snd.title": "Atmosphärisches Sondieren",
    "snd.btn": "Sondierung",
    "act.menu": "Aktionen",
    "snd.btn_tip": "Vertikales Profil ansehen (Wind, Temperatur und Wolken nach Höhe)",
    "snd.btn_short": "📈",
    "snd.loading": "Sondierung wird geladen…",
    "snd.error": "Sondierung an diesem Ort konnte nicht geladen werden.",
    "snd.open_windy": "In Windy öffnen",
    "snd.model": "Modell",
    "snd.hour": "Stunde",
    "snd.wind_chart": "Wind nach Höhe",
    "snd.temp_chart": "Temperatur und Taupunkt nach Höhe",
    "snd.col_alt": "Höhe (m)",
    "snd.col_lvl": "Niveau",
    "snd.col_t": "T (°C)",
    "snd.col_td": "Td (°C)",
    "snd.col_ws": "Wind (km/h)",
    "snd.col_wd": "Richt.",
    "snd.col_cld": "Wolken (%)",
    "snd.show_raw": "Rohdaten pro Niveau",
    "snd.wind_axis": "Wind (km/h)",
    "snd.skew_t": "Skew-T",
    "to.propose_tip": "Diese Station hat noch keine Startplatzdaten. Klicke, um sie vorzuschlagen (Name, Ausrichtungen, Kriterien). Ein Admin prüft.",
    "to.suggest_tip": "Dieser Startplatz ist bereits in der Community. Klicke, um Änderungen vorzuschlagen.",
    "co.title": "Meine Kriterien für diesen Startplatz",
    "co.hint": "Diese Kriterien werden nur auf deinem Gerät gespeichert und ersetzen das Standardurteil.",
    "co.save": "Speichern",
    "co.reset": "Auf Original zurücksetzen",
    "co.active": "Urteil nach deinen persönlichen Kriterien",
    "to.suggest_title": "Änderungen am Startplatz vorschlagen",
    "to.suggest_submit": "Vorschlag senden",
    "to.delete": "Löschen",
    "to.delete_confirm": "Startplatz „{name}“ endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
    "to.delete_ok": "Startplatz gelöscht.",
    "to.delete_err": "Löschen fehlgeschlagen.",
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
    "near.radius": "Radius: 50 km.",
    "near.none": "Keine weiteren aktiven Pioupiou-Stationen innerhalb von 50 km.",
    "near.error": "Fehler beim Laden der nahegelegenen Stationen.",
    "near.network_prefix": "Netz",
    "near.legend_suffix": "Nur Richtung und mittlere Stärke der letzten Stunden; jede Station hat eigene Flugkriterien.",
    "near.avg_unit": "km/h · Ø {h} h",
    "near.popup_last": "letzte",
    "near.popup_view": "Station ansehen",
    "map.title": "Standort des Startplatzes",
    "guide.title": "Kurzanleitung",
    "guide.title_this": "Kurzanleitung für diesen Startplatz",
    "fc.source_prefix": "Daten:",
    "guide.for": "Kriterien für",
    "guide.for_prefix": "für",
    "guide.ideal": "<strong>Ideal:</strong> West (W) oder Nordwest (NW), 5–15 km/h (Böen ≤ 25).",
    "guide.ok": "<strong>Fliegbar:</strong> Nord (N) oder Südwest (SW), oder Wind außerhalb des Idealbereichs aber unter dem Limit.",
    "guide.bad": "<strong>Schlecht:</strong> Ostkomponenten (NO, O, SO) — schlechter je östlicher.",
    "guide.warn": "<strong>Zu stark:</strong> Mittel ≥ 20 km/h oder Böen ≥ 30 km/h.",
    "help.title": "Hilfe",
    "help.quick": "<p><strong>Kurzanleitung:</strong></p><ul><li>🧭 Der <strong>Hauptkompass</strong> zeichnet einen Ring mit allen Windrichtungen, eingefärbt nach den Kriterien des Startplatzes: <span style=\"color:#2ecc71\">grün</span> = ideal, <span style=\"color:#f1c40f\">gelb</span> = akzeptabel, <span style=\"color:#e74c3c\">rot</span> = nicht empfohlen. Der <strong>Pfeil</strong> zeigt, woher der Live-Wind kommt; die Zahl in der Mitte ist die Durchschnittsgeschwindigkeit in km/h.</li><li>📊 An den Seiten des Kompasses gibt es zwei <strong>vertikale Anemometer</strong> mit dem gleichen Stil: links \"<em>Geschwindigkeit</em>\" zeigt den aktuellen Durchschnittswind, rechts \"<em>Böe</em>\" die maximale Böe. Die grün/gelb/roten Hintergrundzonen sind die für <em>diesen</em> Startplatz definierten Bereiche und die Zahl unten ist der Wert in km/h.</li><li>✎ <strong>Jeder kann Startplatzdaten ergänzen oder bearbeiten</strong>: Richtungssektoren, Windbereiche, Höhe, Notizen… ✎ neben dem Titel schlägt Änderungen zum aktuellen Startplatz vor, + im Suchfeld schlägt einen neuen vor. Vorschläge werden geprüft und für die gesamte Community veröffentlicht.</li><li>📍 Tippe auf den Standort-Button, damit Distanzen ab deiner echten Position gemessen werden.</li><li>🔍 Tippe im Suchfeld, um Startplätze zu filtern; Favoriten zuerst.</li><li>★ markiert Favoriten · 👑 setzt \"Zuhause\" (Stamm-Startplatz) · 🔔 aktiviert Benachrichtigungen bei idealen Bedingungen.</li><li>📲 App als PWA installieren für Offline-Nutzung am Handy oder Desktop.</li><li>⚠️ Daten sind Richtwerte. Bedingungen immer vor Ort prüfen.</li></ul>",
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
    "best.warn_yellow": "⚠️ Nur fliegbar, kein optimales Fenster",
    "near.airport_label": "Flughafen Granada (LEGR)",
    "near.airport_prefix": "Flughafen",
    "near.airport_src": "Open-Meteo (ca. METAR)",
    "banner.title": "Gleitschirm-Startplatz von Cenes de la Vega",
    "ts.placeholder": "Startplätze suchen",
    "ts.current": "Startplatz:",
    "ts.radius": "Radius",
    "ts.no_radius": "Kein Limit",
    "ts.close": "Suche schließen",
    "ts.show_favs": "Favoriten",
    "theme.title": "Design (auto/dunkel/hell)",
    "menu.lang": "Sprache",
    "menu.theme": "Design",
    "menu.notify": "Hinweise",
    "menu.install": "App installieren",
    "menu.help": "Hilfe",
    "menu.admin_review": "Startplätze prüfen",
    "menu.firebase_console": "Firebase (Admin)",
    "menu.firebase_console_tip": "Firebase-Konsole öffnen: Nutzer, Traffic, Firestore…",
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
    "ts.coming_soon": "Nicht hinzugefügt",
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
    "app.title": "Hoy se vuela",
    "app.brand": "On vole aujourd’hui ?",
    "header.h1": "🪂 Vent à Cenes de la Vega",
    "header.subtitle": "Décollage parapente · Station",
    "btn.install": "📲 Installer l'app",
    "btn.notify_off": "🔔 Me prévenir si conditions idéales",
    "btn.notify_on": "🔕 Alertes activées",
    "status.title": "État actuel",
    "card.n": "N", "card.e": "E", "card.s": "S", "card.w": "O",
    "read.avg": "Vitesse moyenne",
    "cw.speed": "Vit. moy.",
    "cw.direction": "Direction",
    "cw.gust": "Rafale max",
    "read.max": "Rafale max.",
    "read.min": "Minimum",
    "read.last": "Dernière mesure",
    "read.dir": "Direction",
    "verdict.loading": "Chargement…",
    "verdict.unavailable.title": "Données de vent indisponibles",
    "verdict.unavailable.detail": "La station ne renvoie aucune mesure. La prévision reste disponible ci-dessous.",
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
    "chart.ideal_band": "Vitesse idéale",
    "chart.gust_band": "Rafale acceptable",
    "chart.gust_warn": "La rafale dépasse le maximum recommandé",
    "forecast.mini_compass_label": "Directions de vent adaptées pour {name}",
    "chart.gust": "Rafale max (km/h)",
    "chart.dir": "Direction",
    "chart.dir_tooltip": "Dir : {name} ({deg}°)",
    "fc.title": "Prévision (Open-Meteo)",
    "fc.title_for": "Prévision pour {name}",

    "fc.today": "Aujourd'hui",
    "fc.night": "Nuit",
    "fc.show": "Afficher sur le graphique :",
    "fc.dirs_apt": "Directions adaptées :",
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
    "to.name_label": "Nom du décollage",
    "to.alt_label": "Altitude (m)",
    "to.alt_fetch_title": "Calculer l'altitude depuis la carte",
    "to.alt_auto_hint": "Calculée automatiquement depuis la carte (Open‑Meteo). Tu peux l'ajuster à la main.",
    "to.lat_label": "Latitude",
    "to.lon_label": "Longitude",
    "to.notes_label": "Notes (accès, dangers…)",
    "to.windy_label": "URL Windy (optionnelle)",
    "to.windy_ph": "https://www.windy.com/?…",
    "to.volandoo_label": "URL station Volandoo (optionnelle)",
    "to.volandoo_ph": "https://volandoo.com/weather/…",
    "menu.add_takeoff": "Ajouter un décollage",
    "menu.add_takeoff_tip": "Créer un nouveau décollage à partir d'un lieu recherché sur la carte",
    "to.guest_add_tip": "Inscris-toi pour ajouter ou suggérer des modifications de décollages",
    "to.geocode_label": "Rechercher un lieu sur la carte",
    "to.geocode_ph": "Ex : Pegalajar, Jaén",
    "to.geocode_search": "🔎 Rechercher",
    "to.geocode_empty": "Aucun résultat",
    "to.ref_station_label": "Station intégrée à proximité",
    "to.ref_hint": "Stations intégrées (Pioupiou, Holfuy, AEMET) à moins de 30 km du point choisi.",
    "to.ref_moved_warn": "Tu as déplacé l'emplacement du déco. Vérifie si la station de référence est toujours appropriée.",
    "to.ref_none": "— Aucune —",
    "to.ref_legend": "Station de référence (optionnelle)",
    "to.ref_block_hint": "Choisis une option ou laisse tout vide pour utiliser la prévision Windy du point.",
    "to.coords_legend": "Coordonnées du déco",
    "to.coords_open_map": "🗺️ Choisir sur la carte",
    "to.coords_manual_hint": "Tu peux aussi modifier les coordonnées à la main.",
    "to.find_stations": "📡 Rechercher",
    "to.ref_need_coords": "Remplis d'abord la latitude et la longitude.",
    "to.ref_empty": "Aucune station intégrée à moins de 30 km.",
    "to.pick_map": "�️ Choisir sur la carte",
    "to.pick_map_title": "Choisis les coordonnées sur la carte",
    "to.pick_map_hint": "Touche la carte pour placer le déco, ou déplace le marqueur. Utilise la couche Satellite ou Topo pour mieux repérer le versant.",
    "to.pick_map_confirm": "Utiliser ces coordonnées",
    "to.pick_map_layer_sat": "Satellite",
    "to.pick_map_layer_topo": "Topo",
    "to.pick_map_layer_street": "Rues",
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
    "co.btn": "Mes critères",
    "snd.title": "Sondage atmosphérique",
    "snd.btn": "Sondage",
    "act.menu": "Actions",
    "snd.btn_tip": "Voir le profil vertical (vent, température et nuages par altitude)",
    "snd.btn_short": "📈",
    "snd.loading": "Chargement du sondage…",
    "snd.error": "Impossible de charger le sondage à cet endroit.",
    "snd.open_windy": "Ouvrir dans Windy",
    "snd.model": "Modèle",
    "snd.hour": "Heure",
    "snd.wind_chart": "Vent par altitude",
    "snd.temp_chart": "Température et point de rosée par altitude",
    "snd.col_alt": "Altitude (m)",
    "snd.col_lvl": "Niveau",
    "snd.col_t": "T (°C)",
    "snd.col_td": "Td (°C)",
    "snd.col_ws": "Vent (km/h)",
    "snd.col_wd": "Dir",
    "snd.col_cld": "Nuages (%)",
    "snd.show_raw": "Données brutes par niveau",
    "snd.wind_axis": "Vent (km/h)",
    "snd.skew_t": "Skew-T",
    "to.propose_tip": "Cette station n'a pas encore de données de déco. Cliquez pour proposer son ajout. Un admin l'examinera.",
    "to.suggest_tip": "Ce déco est déjà dans la communauté. Cliquez pour suggérer des modifications.",
    "co.title": "Mes critères pour ce déco",
    "co.hint": "Ces critères sont stockés uniquement sur votre appareil et remplacent le verdict par défaut.",
    "co.save": "Enregistrer",
    "co.reset": "Rétablir l'original",
    "co.active": "Verdict selon vos critères personnels",
    "to.suggest_title": "Suggérer des modifications au déco",
    "to.suggest_submit": "Envoyer la suggestion",
    "to.delete": "Supprimer",
    "to.delete_confirm": "Supprimer définitivement le décollage « {name} » ? Cette action est irréversible.",
    "to.delete_ok": "Décollage supprimé.",
    "to.delete_err": "Suppression impossible.",
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
    "near.radius": "Rayon: 50 km.",
    "near.none": "Aucune autre station Pioupiou active dans un rayon de 50 km.",
    "near.error": "Échec du chargement des stations proches.",
    "near.network_prefix": "Réseau",
    "near.legend_suffix": "Seulement direction et intensité moyenne des dernières heures ; chaque station a ses propres critères de volabilité.",
    "near.avg_unit": "km/h · moy. {h} h",
    "near.popup_last": "dernière",
    "near.popup_view": "Voir la station",
    "map.title": "Emplacement du décollage",
    "guide.title": "Guide rapide",
    "guide.title_this": "Guide rapide pour ce décollage",
    "fc.source_prefix": "Données :",
    "guide.for": "Critères pour",
    "guide.for_prefix": "pour",
    "guide.ideal": "<strong>Idéal :</strong> Ouest (O) ou Nord-Ouest (NO), 5–15 km/h (rafales ≤ 25).",
    "guide.ok": "<strong>Volable :</strong> Nord (N) ou Sud-Ouest (SO), ou vents hors plage idéale mais sous la limite.",
    "guide.bad": "<strong>Mauvais :</strong> composantes Est (NE, E, SE) — pire vers l'est.",
    "guide.warn": "<strong>Trop fort :</strong> moy. ≥ 20 km/h ou rafales ≥ 30 km/h.",
    "help.title": "Aide",
    "help.quick": "<p><strong>Guide rapide :</strong></p><ul><li>🧭 La <strong>boussole principale</strong> dessine un anneau avec toutes les directions de vent colorées selon les critères du déco : <span style=\"color:#2ecc71\">vert</span> = idéal, <span style=\"color:#f1c40f\">jaune</span> = acceptable, <span style=\"color:#e74c3c\">rouge</span> = déconseillé. La <strong>flèche</strong> pointe vers la direction d'où vient le vent en direct ; le chiffre au centre est la vitesse moyenne en km/h.</li><li>📊 De chaque côté de la boussole, deux <strong>anémomètres verticaux</strong> au même style visuel : \"<em>Vitesse</em>\" à gauche affiche le vent moyen actuel et \"<em>Rafale</em>\" à droite la rafale max. Les bandes vert/jaune/rouge du fond sont les plages définies pour <em>ce</em> déco et le chiffre en bas est la valeur en km/h.</li><li>✎ <strong>Chacun peut ajouter ou modifier</strong> les infos d'un déco : secteurs de direction, plages de vent, altitude, notes… Utilise ✎ à côté du titre pour proposer des changements sur le déco actuel, ou + dans la recherche pour proposer un nouveau déco. Les propositions sont relues puis publiées pour toute la communauté.</li><li>📍 Appuie sur le bouton de localisation pour que les distances soient mesurées depuis ta position réelle.</li><li>🔍 Tape dans la recherche pour filtrer ; les favoris apparaissent en premier.</li><li>★ marque les favoris · 👑 définit ton \"déco habituel\" · 🔔 active les alertes en conditions idéales.</li><li>📲 Installe l'app en PWA pour l'utiliser hors ligne depuis mobile ou ordinateur.</li><li>⚠️ Données indicatives. Évalue toujours les conditions sur place.</li></ul>",
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
    "best.warn_yellow": "⚠️ Seulement conditions volables, pas de créneau optimal",
    "near.airport_label": "Aéroport de Grenade (LEGR)",
    "near.airport_prefix": "Aéroport",
    "near.airport_src": "Open-Meteo (METAR approx.)",
    "banner.title": "Décollage parapente de Cenes de la Vega",
    "ts.placeholder": "Rechercher décollages",
    "ts.current": "Décollage :",
    "ts.radius": "Rayon",
    "ts.no_radius": "Sans limite",
    "ts.close": "Fermer la recherche",
    "ts.show_favs": "Favoris",
    "theme.title": "Thème (auto/sombre/clair)",
    "menu.lang": "Langue",
    "menu.theme": "Thème",
    "menu.notify": "Alertes",
    "menu.install": "Installer l'app",
    "menu.help": "Aide",
    "menu.admin_review": "Examiner décos",
    "menu.firebase_console": "Firebase (admin)",
    "menu.firebase_console_tip": "Ouvrir la console Firebase : utilisateurs, trafic, Firestore…",
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
    "ts.coming_soon": "Non ajouté",
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
    "app.title": "Hoy se vuela",
    "app.brand": "Gaur hegan egingo dugu?",
    "header.h1": "🪂 Haizea Cenes de la Vegan",
    "header.subtitle": "Parapente irteguia · Estazioa",
    "btn.install": "📲 Aplikazioa instalatu",
    "btn.notify_off": "🔔 Abisatu baldintzak ezin hobeak badira",
    "btn.notify_on": "🔕 Abisuak aktibatuta",
    "status.title": "Egungo egoera",
    "card.n": "I", "card.e": "E", "card.s": "H", "card.w": "M",
    "read.avg": "Batez besteko abiadura",
    "cw.speed": "Bat. abiad.",
    "cw.direction": "Norabidea",
    "cw.gust": "Gehi. bol.",
    "read.max": "Bolada max.",
    "read.min": "Minimoa",
    "read.last": "Azken neurketa",
    "read.dir": "Norabidea",
    "verdict.loading": "Kargatzen…",
    "verdict.unavailable.title": "Haize datuak ez daude eskuragarri",
    "verdict.unavailable.detail": "Estazioak ez du irakurketarik orain. Iragarpena eskuragarri dago behean.",
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
    "chart.ideal_band": "Abiadura ezin hobea",
    "chart.gust_band": "Bolada onargarria",
    "chart.gust_warn": "Boladak gomendatutako gehienezkoa gainditzen du",
    "forecast.mini_compass_label": "{name}rako haize norabide egokiak",
    "chart.gust": "Bolada max (km/h)",
    "chart.dir": "Norabidea",
    "chart.dir_tooltip": "Norab.: {name} ({deg}°)",
    "fc.title": "Iragarpena (Open-Meteo)",
    "fc.title_for": "{name} iragarpena",

    "fc.today": "Gaur",
    "fc.night": "Gaua",
    "fc.show": "Erakutsi grafikoan:",
    "fc.dirs_apt": "Norabide egokiak:",
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
    "to.name_label": "Aireratze-lekuaren izena",
    "to.alt_label": "Altitudea (m)",
    "to.alt_fetch_title": "Kalkulatu altitudea mapatik",
    "to.alt_auto_hint": "Mapatik automatikoki kalkulatzen da (Open‑Meteo). Eskuz egokitu dezakezu.",
    "to.lat_label": "Latitudea",
    "to.lon_label": "Longitudea",
    "to.notes_label": "Oharrak (sarbidea, arriskuak…)",
    "to.windy_label": "Windy URLa (aukerakoa)",
    "to.windy_ph": "https://www.windy.com/?…",
    "to.volandoo_label": "Volandoo estazioaren URLa (aukerakoa)",
    "to.volandoo_ph": "https://volandoo.com/weather/…",
    "menu.add_takeoff": "Aireratzea gehitu",
    "menu.add_takeoff_tip": "Mapan bilatutako leku batetik aireratze berri bat sortu",
    "to.guest_add_tip": "Izena eman aireratzeak gehitzeko edo aldaketak iradokitzeko",
    "to.geocode_label": "Mapan leku bat bilatu",
    "to.geocode_ph": "Adib: Pegalajar, Jaén",
    "to.geocode_search": "🔎 Bilatu",
    "to.geocode_empty": "Emaitzarik ez",
    "to.ref_station_label": "Inguruko estazio integratua",
    "to.ref_hint": "Estazio integratuak (Pioupiou, Holfuy, AEMET) aukeratutako puntutik 30 km-ra.",
    "to.ref_moved_warn": "Irteguiaren kokapena aldatu duzu. Egiaztatu erreferentziazko estazioa egokia ote den oraindik.",
    "to.ref_none": "— Bat ere ez —",
    "to.ref_legend": "Erreferentziazko estazioa (aukerakoa)",
    "to.ref_block_hint": "Aukeratu aukera bat edo utzi denak hutsik, mapako puntuaren Windy iragarpena erabiltzeko.",
    "to.coords_legend": "Irteguiaren koordenatuak",
    "to.coords_open_map": "🗺️ Aukeratu mapan",
    "to.coords_manual_hint": "Nahi izanez gero, koordenatuak eskuz aldatu ditzakezu.",
    "to.find_stations": "📡 Bilatu",
    "to.ref_need_coords": "Lehenik latitudea eta longitudea bete.",
    "to.ref_empty": "Ez dago estazio integraturik 30 km-ra.",
    "to.pick_map": "�️ Aukeratu mapan",
    "to.pick_map_title": "Aukeratu koordenatuak mapan",
    "to.pick_map_hint": "Sakatu mapan irteguia kokatzeko edo arrastatu markatzailea. Erabili Satelite edo Topo geruza malda hobeto identifikatzeko.",
    "to.pick_map_confirm": "Erabili koordenatu hauek",
    "to.pick_map_layer_sat": "Satelite",
    "to.pick_map_layer_topo": "Topo",
    "to.pick_map_layer_street": "Kaleak",
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
    "co.btn": "Nire irizpideak",
    "snd.title": "Atmosfera-sondaketa",
    "snd.btn": "Sondaketa",
    "act.menu": "Ekintzak",
    "snd.btn_tip": "Profil bertikala ikusi (haizea, tenperatura eta hodeiak altueraka)",
    "snd.btn_short": "📈",
    "snd.loading": "Sondaketa kargatzen…",
    "snd.error": "Ezin izan da kokapen honetako sondaketa kargatu.",
    "snd.open_windy": "Windy-n ireki",
    "snd.model": "Eredua",
    "snd.hour": "Ordua",
    "snd.wind_chart": "Haizea altueraka",
    "snd.temp_chart": "Tenperatura eta ihintza altueraka",
    "snd.col_alt": "Altuera (m)",
    "snd.col_lvl": "Maila",
    "snd.col_t": "T (°C)",
    "snd.col_td": "Td (°C)",
    "snd.col_ws": "Haizea (km/h)",
    "snd.col_wd": "Norabidea",
    "snd.col_cld": "Hodeiak (%)",
    "snd.show_raw": "Datu gordinak mailaka",
    "snd.wind_axis": "Haizea (km/h)",
    "snd.skew_t": "Skew-T",
    "to.propose_tip": "Estazio honek ez du oraindik irteguia daturik. Sakatu proposatzeko (izena, orientazioak, irizpideak). Administratzaileak berrikusiko du.",
    "to.suggest_tip": "Irteguia hau jada komunitatean dago. Sakatu aldaketak proposatzeko.",
    "co.title": "Nire irizpideak irteguia honetarako",
    "co.hint": "Irizpide hauek zure gailuan bakarrik gordeko dira eta lehenetsitako epaia ordezkatzen dute.",
    "co.save": "Gorde",
    "co.reset": "Jatorrizkora itzuli",
    "co.active": "Zure irizpide pertsonalen araberako epaia",
    "to.suggest_title": "Irteguiari aldaketak proposatu",
    "to.suggest_submit": "Bidali iradokizuna",
    "to.delete": "Ezabatu",
    "to.delete_confirm": "«kenduko duzu «{name}» aireratzea betiko? Ekintza hau ezin da desegin.",
    "to.delete_ok": "Aireratzea ezabatuta.",
    "to.delete_err": "Ezin izan da ezabatu.",
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
    "near.radius": "Erradioa: 50 km.",
    "near.none": "Ez dago beste Pioupiou estaziorik aktibo 50 km-an.",
    "near.error": "Errorea inguruko estazioak kargatzean.",
    "near.network_prefix": "Sarea",
    "near.legend_suffix": "Azken orduen norabidea eta batez besteko intentsitatea soilik; estazio bakoitzak bere irizpideak ditu.",
    "near.avg_unit": "km/h · batez beste {h} h",
    "near.popup_last": "azkena",
    "near.popup_view": "Ikusi estazioa",
    "map.title": "Irteguiaren kokapena",
    "guide.title": "Gida azkarra",
    "guide.title_this": "Aireratze honetarako gida azkarra",
    "fc.source_prefix": "Datuak:",
    "guide.for": "Irizpideak honentzat",
    "guide.for_prefix": "honentzat:",
    "guide.ideal": "<strong>Aproposa:</strong> Mendebal (M) edo Ipar-Mendebal (IM), 5–15 km/h (boladak ≤ 25).",
    "guide.ok": "<strong>Hegagarria:</strong> Ipar (I) edo Hego-Mendebal (HM), edo tarte aproposetik kanpoko haizeak baina mugaren azpitik.",
    "guide.bad": "<strong>Txarra:</strong> Ekialdeko osagaiak (IE, E, HE) — okerragoa ekialderago.",
    "guide.warn": "<strong>Indartsuegia:</strong> batez beste ≥ 20 km/h edo boladak ≥ 30 km/h.",
    "help.title": "Laguntza",
    "help.quick": "<p><strong>Gida azkarra:</strong></p><ul><li>🧭 <strong>Iparrorratz nagusiak</strong> haize norabide guztiak biltzen dituen eraztun bat marrazten du, irteguiaren irizpideen arabera koloreztatuta: <span style=\"color:#2ecc71\">berdea</span> = aproposa, <span style=\"color:#f1c40f\">horia</span> = onargarria, <span style=\"color:#e74c3c\">gorria</span> = ez gomendatua. <strong>Geziak</strong> haizea nondik datorren erakusten du eta erdiko zenbakia batez besteko abiadura da (km/h).</li><li>📊 Iparrorratzaren alde bakoitzean <strong>anemometro bertikal</strong> bana dago, itxura berarekin: ezkerrekoak \"<em>Abiadura</em>\" uneko batez besteko haizea erakusten du eta eskuinekoak \"<em>Bolada</em>\" gehienezko bolada. Hondoko berde/hori/gorri zerrendak irtegui horretarako definitutako tarteak dira eta beheko zenbakia balioa da (km/h).</li><li>✎ <strong>Edonork gehitu edo aldatu</strong> dezake irtegui baten informazioa: norabide sektoreak, haize tarteak, altuera, oharrak… Erabili ✎ izenburuaren ondoan uneko irteguian aldaketak proposatzeko, edo + bilaketan irtegui berria proposatzeko. Proposamenak berrikusi eta komunitate osoarentzat argitaratzen dira.</li><li>📍 Sakatu kokapen botoia distantziak zure benetako kokapenetik neur daitezen.</li><li>🔍 Bilaketa kutxan idatzi irteguiak iragazteko; gogokoak lehenengo agertzen dira.</li><li>★ gogokoak markatu · 👑 zure \"etxea\" (ohiko irteguia) finkatu · 🔔 abisuak aktibatu baldintza ezin hobeetan.</li><li>📲 PWA gisa instalatu konexiorik gabe erabiltzeko mugikorrean edo ordenagailuan.</li><li>⚠️ Datuak orientagarriak dira. Beti ebaluatu baldintzak lekuan bertan.</li></ul>",
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
    "best.warn_yellow": "⚠️ Hegagarria soilik, ez dago tarte optimorik",
    "near.airport_label": "Granadako aireportua (LEGR)",
    "near.airport_prefix": "Aireportua",
    "near.airport_src": "Open-Meteo (METAR gutxi gorabehera)",
    "banner.title": "Cenes de la Vegako parapente irteguia",
    "ts.placeholder": "Bilatu irteguiak",
    "ts.current": "Irteguia:",
    "ts.radius": "Erradioa",
    "ts.no_radius": "Mugarik gabe",
    "ts.close": "Itxi bilaketa",
    "ts.show_favs": "Gogokoak",
    "theme.title": "Gaia (auto/iluna/argia)",
    "menu.lang": "Hizkuntza",
    "menu.theme": "Gaia",
    "menu.notify": "Abisuak",
    "menu.install": "App-a instalatu",
    "menu.help": "Laguntza",
    "menu.admin_review": "Berrikusi proposamenak",
    "menu.firebase_console": "Firebase (admin)",
    "menu.firebase_console_tip": "Ireki Firebase kontsola: erabiltzaileak, trafikoa, Firestore…",
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
    "ts.coming_soon": "Gehitu gabe",
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
    "app.title": "Hoy se vuela",
    "app.brand": "Avui es vola?",
    "header.h1": "🪂 Vent a Cenes de la Vega",
    "header.subtitle": "Enlairament de parapent · Estació",
    "btn.install": "📲 Instal·lar l'app",
    "btn.notify_off": "🔔 Avisa'm si hi ha condicions ideals",
    "btn.notify_on": "🔕 Avisos activats",
    "status.title": "Estat actual",
    "card.n": "N", "card.e": "E", "card.s": "S", "card.w": "O",
    "read.avg": "Velocitat mitjana",
    "cw.speed": "Vel. mitj.",
    "cw.direction": "Direcció",
    "cw.gust": "Ratxa màx.",
    "read.max": "Ratxa màx.",
    "read.min": "Mínima",
    "read.last": "Última lectura",
    "read.dir": "Direcció",
    "verdict.loading": "Carregant…",
    "verdict.unavailable.title": "Dades de vent no disponibles",
    "verdict.unavailable.detail": "L'estació no té lectures ara mateix. La previsió segueix disponible més avall.",
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
    "chart.ideal_band": "Velocitat ideal",
    "chart.gust_band": "Ratxa acceptable",
    "chart.gust_warn": "La ratxa supera el màxim recomanat",
    "forecast.mini_compass_label": "Direccions de vent adequades per a {name}",
    "chart.gust": "Ratxa màx (km/h)",
    "chart.dir": "Direcció",
    "chart.dir_tooltip": "Dir: {name} ({deg}°)",
    "fc.title": "Pronòstic (Open-Meteo)",
    "fc.title_for": "Pronòstic per a {name}",

    "fc.today": "Avui",
    "fc.night": "Nit",
    "fc.show": "Mostra al gràfic:",
    "fc.dirs_apt": "Direccions adequades:",
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
    "to.name_label": "Nom de l'enlairament",
    "to.alt_label": "Altitud (m)",
    "to.alt_fetch_title": "Calcula l'altitud des del mapa",
    "to.alt_auto_hint": "Es calcula automàticament des del mapa (Open‑Meteo). Pots ajustar-la a mà.",
    "to.lat_label": "Latitud",
    "to.lon_label": "Longitud",
    "to.notes_label": "Notes (accés, perills…)",
    "to.windy_label": "URL de Windy (opcional)",
    "to.windy_ph": "https://www.windy.com/?…",
    "to.volandoo_label": "URL de l’estació a Volandoo (opcional)",
    "to.volandoo_ph": "https://volandoo.com/weather/…",
    "menu.add_takeoff": "Afegir enlairament",
    "menu.add_takeoff_tip": "Crear un enlairament nou a partir d'un lloc cercat al mapa",
    "to.guest_add_tip": "Registra't per afegir enlairaments o suggerir canvis",
    "to.geocode_label": "Cerca un lloc al mapa",
    "to.geocode_ph": "Ex: Pegalajar, Jaén",
    "to.geocode_search": "🔎 Cercar",
    "to.geocode_empty": "Sense resultats",
    "to.ref_station_label": "Estació integrada propera",
    "to.ref_hint": "Estacions integrades (Pioupiou, Holfuy, AEMET) a menys de 30 km del punt escollit.",
    "to.ref_moved_warn": "Has mogut la ubicació de l'enlairament. Revisa si l'estació de referència continua sent adequada.",
    "to.ref_none": "— Cap —",
    "to.ref_legend": "Estació de referència (opcional)",
    "to.ref_block_hint": "Tria una opció o deixa-les totes en blanc per usar la previsió de Windy del punt del mapa.",
    "to.coords_legend": "Coordenades de l'enlairament",
    "to.coords_open_map": "🗺️ Tria al mapa",
    "to.coords_manual_hint": "Si ho prefereixes, pots editar les coordenades a mà.",
    "to.find_stations": "📡 Cercar",
    "to.ref_need_coords": "Omple primer la latitud i la longitud.",
    "to.ref_empty": "No hi ha estacions integrades a menys de 30 km.",
    "to.pick_map": "�️ Tria al mapa",
    "to.pick_map_title": "Tria les coordenades al mapa",
    "to.pick_map_hint": "Toca el mapa per situar l'enlairament, o arrossega el marcador. Fes servir la capa Satèl·lit o Topo per identificar millor el vessant.",
    "to.pick_map_confirm": "Usa aquestes coordenades",
    "to.pick_map_layer_sat": "Satèl·lit",
    "to.pick_map_layer_topo": "Topo",
    "to.pick_map_layer_street": "Carrers",
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
    "co.btn": "Els meus criteris",
    "snd.title": "Sondatge atmosfèric",
    "snd.btn": "Sondatge",
    "act.menu": "Accions",
    "snd.btn_tip": "Veure el perfil vertical (vent, temperatura i núvols per altitud)",
    "snd.btn_short": "📈",
    "snd.loading": "Carregant sondatge…",
    "snd.error": "No s'ha pogut carregar el sondatge en aquesta ubicació.",
    "snd.open_windy": "Obrir a Windy",
    "snd.model": "Model",
    "snd.hour": "Hora",
    "snd.wind_chart": "Vent per altitud",
    "snd.temp_chart": "Temperatura i punt de rosada per altitud",
    "snd.col_alt": "Altitud (m)",
    "snd.col_lvl": "Nivell",
    "snd.col_t": "T (°C)",
    "snd.col_td": "Td (°C)",
    "snd.col_ws": "Vent (km/h)",
    "snd.col_wd": "Dir",
    "snd.col_cld": "Núvols (%)",
    "snd.show_raw": "Dades en brut per nivell",
    "snd.wind_axis": "Vent (km/h)",
    "snd.skew_t": "Skew-T",
    "to.propose_tip": "Aquesta estació encara no té dades d'enlairament. Prem per proposar-ne l'alta. Un administrador ho revisarà.",
    "to.suggest_tip": "Aquest enlairament ja està a la comunitat. Prem per suggerir canvis.",
    "co.title": "Els meus criteris per a aquest enlairament",
    "co.hint": "Aquests criteris es desen només al teu dispositiu i substitueixen el veredicte per defecte.",
    "co.save": "Desa",
    "co.reset": "Restableix l'original",
    "co.active": "Veredicte segons els teus criteris personals",
    "to.suggest_title": "Suggereix canvis a l'enlairament",
    "to.suggest_submit": "Envia el suggeriment",
    "to.delete": "Eliminar",
    "to.delete_confirm": "Eliminar definitivament l’enlairament «{name}»? Aquesta acció no es pot desfer.",
    "to.delete_ok": "Enlairament eliminat.",
    "to.delete_err": "No s’ha pogut eliminar.",
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
    "near.radius": "Radi: 50 km.",
    "near.none": "No hi ha altres estacions Pioupiou actives dins 50 km.",
    "near.error": "Error en carregar estacions properes.",
    "near.network_prefix": "Xarxa",
    "near.legend_suffix": "Només direcció i intensitat mitjana de les últimes hores; cada estació té els seus criteris.",
    "near.avg_unit": "km/h · mitjana {h} h",
    "near.popup_last": "última",
    "near.popup_view": "Veure estació",
    "map.title": "Ubicació de l'enlairament",
    "guide.title": "Guia ràpida",
    "guide.title_this": "Guia ràpida per a aquest enlairament",
    "fc.source_prefix": "Dades:",
    "guide.for": "Criteris per a",
    "guide.for_prefix": "per a",
    "guide.ideal": "<strong>Ideal:</strong> Oest (O) o Nord-oest (NO), 5–15 km/h (ratxes ≤ 25).",
    "guide.ok": "<strong>Volable:</strong> Nord (N) o Sud-oest (SO), o vents fora del rang ideal però sota el límit.",
    "guide.bad": "<strong>Dolent:</strong> components Est (NE, E, SE) — pitjor com més a l'est.",
    "guide.warn": "<strong>Massa fort:</strong> mitjana ≥ 20 km/h o ratxes ≥ 30 km/h.",
    "help.title": "Ajuda",
    "help.quick": "<p><strong>Guia ràpida:</strong></p><ul><li>🧭 La <strong>brúixola principal</strong> dibuixa un anell amb totes les direccions de vent acolorides segons els criteris de l'enlairament: <span style=\"color:#2ecc71\">verd</span> = ideal, <span style=\"color:#f1c40f\">groc</span> = acceptable, <span style=\"color:#e74c3c\">vermell</span> = no recomanat. La <strong>fletxa</strong> apunta a la direcció d'on ve el vent en directe i el número del centre és la velocitat mitjana en km/h.</li><li>📊 A banda i banda de la brúixola hi ha dos <strong>anemòmetres verticals</strong> amb el mateix estil: \"<em>Velocitat</em>\" a l'esquerra mostra el vent mitjà actual i \"<em>Ratxa</em>\" a la dreta la ratxa màxima. Les franges verd/groc/vermell del fons són els rangs definits per a <em>aquest</em> enlairament i el número a la base és el valor en km/h.</li><li>✎ <strong>Qualsevol pot afegir o editar</strong> la informació d'un enlairament: sectors de direcció, rangs de vent, altitud, notes… Fes servir ✎ al costat del títol per suggerir canvis a l'enlairament actual, o + al cercador per proposar-ne un de nou. Les propostes es revisen i es publiquen per a tota la comunitat.</li><li>📍 Prem el botó d'ubicació perquè les distàncies es mesurin des de la teva posició real.</li><li>🔍 Escriu al cercador per filtrar; els preferits surten primer.</li><li>★ marca preferits · 👑 fixa la \"llar\" (enlairament habitual) · 🔔 activa alertes en condicions ideals.</li><li>📲 Instal·la l'app com a PWA per usar-la sense connexió des del mòbil o l'ordinador.</li><li>⚠️ Dades orientatives. Avalua sempre les condicions in situ.</li></ul>",
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
    "best.warn_yellow": "⚠️ Només condicions volables, sense franja òptima",
    "near.airport_label": "Aeroport de Granada (LEGR)",
    "near.airport_prefix": "Aeroport",
    "near.airport_src": "Open-Meteo (METAR aprox.)",
    "banner.title": "Enlairament de parapent de Cenes de la Vega",
    "ts.placeholder": "Cerca enlairaments",
    "ts.current": "Enlairament:",
    "ts.radius": "Radi",
    "ts.no_radius": "Sense límit",
    "ts.close": "Tancar cercador",
    "ts.show_favs": "Preferits",
    "theme.title": "Tema (auto/fosc/clar)",
    "menu.lang": "Idioma",
    "menu.theme": "Tema",
    "menu.notify": "Avisos",
    "menu.install": "Instal·la l'app",
    "menu.help": "Ajuda",
    "menu.admin_review": "Revisar enlairaments",
    "menu.firebase_console": "Firebase (admin)",
    "menu.firebase_console_tip": "Obrir consola de Firebase: usuaris, trànsit, Firestore…",
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
    "ts.coming_soon": "No afegit",
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

// v125: variantes parametrizadas para clasificar segun los criterios de OTRO
// despegue (no el actual). Se usan en el buscador para colorear el borde de
// los favoritos segun si se puede volar AHI ahora mismo.
function classifyDirectionWith(criteria, deg) {
  if (deg == null || isNaN(deg)) return "unknown";
  const d = ((deg % 360) + 360) % 360;
  const idx = Math.round(d / 22.5) % 16;
  const arr = (criteria?.qualityByIndex && criteria.qualityByIndex.some(Boolean))
    ? criteria.qualityByIndex.map(q => q || "ok")
    : NEUTRAL_QUALITY_BY_INDEX;
  return arr[idx] || "unknown";
}
function classifySpeedWith(criteria, avg, max) {
  if (avg == null) return "unknown";
  const c = criteria || {};
  const wmin = Number.isFinite(c.windMin) ? c.windMin : 5;
  const wmax = Number.isFinite(c.windMax) ? c.windMax : 15;
  const gmax = Number.isFinite(c.gustMax) ? c.gustMax : 30;
  if (avg >= gmax * 0.66 || (max != null && max >= gmax)) return "warn";
  if (avg >= wmin && avg <= wmax && (max == null || max <= gmax * 0.83)) return "ideal";
  return "ok";
}
function takeoffVerdictFromSnapshot(criteria, snapshot) {
  if (!snapshot) return "unknown";
  const { avg, max, dir } = snapshot;
  const dirQ = classifyDirectionWith(criteria, dir);
  const spdQ = classifySpeedWith(criteria, avg, max);
  return combineVerdict(dirQ, spdQ);
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

// v129: AEMET sirve los ficheros 'datos' en ISO-8859-15 sin charset en el
// header; r.json() los decodifica como UTF-8 y rompe acentos/ñ ("?").
// Bajamos bytes y los decodificamos como latin1 antes de JSON.parse.
async function fetchJsonLatin1(url) {
  const decode = (buf) => new TextDecoder("iso-8859-15").decode(buf);
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return JSON.parse(decode(await r.arrayBuffer()));
  } catch (e) {
    let lastErr = e;
    for (const wrap of CORS_PROXIES) {
      try {
        const r = await fetch(wrap(url));
        if (!r.ok) { lastErr = new Error("HTTP " + r.status + " (proxy)"); continue; }
        return JSON.parse(decode(await r.arrayBuffer()));
      } catch (err) { lastErr = err; }
    }
    throw lastErr;
  }
}

async function getLive() {
  // v151: traza para depurar la cadena de fuentes (Volandoo / Windy / estacion).
  console.info("[live] takeoff=", currentTakeoff?.name, "id=", currentTakeoff?.id,
    "volandooUrl=", currentTakeoff?.volandooUrl || "(vacio)",
    "windyUrl=", currentTakeoff?.windyUrl || "(vacio)",
    "station=", currentStation?.provider, currentStationId);
  // v149: prioridad de fuentes de datos en tiempo real:
  //   1) URL de la estacion en Volandoo asociada al despegue.
  //   2) URL de Windy asociada (coords -> Open-Meteo, mostrando Windy como fuente).
  //   3) Estacion integrada seleccionada (Pioupiou/AEMET/Holfuy).
  // Cada rama anota `source: {name, url}` para que la UI lo muestre junto a la ultima lectura.
  const voSlug = parseVolandooSlug(currentTakeoff?.volandooUrl);
  if (voSlug) {
    try {
      const r = await fetchVolandooStationLive(voSlug, currentTakeoff?.volandooUrl);
      if (r && r.measurements && r.measurements.wind_speed_avg != null) {
        console.info("[live] fuente: Volandoo (" + voSlug + ")");
        return r;
      }
      console.warn("[live] Volandoo respondio sin datos utiles, paso a siguiente fuente");
    } catch (e) { console.warn("[live] volandoo fallo:", e); }
  }
  if (currentTakeoff?.windyUrl) {
    const c = parseWindyCoords(currentTakeoff.windyUrl)
      || (Number.isFinite(currentTakeoff?.lat) && Number.isFinite(currentTakeoff?.lon)
            ? { lat: currentTakeoff.lat, lon: currentTakeoff.lon } : null);
    if (c) {
      // 2a) Windy Point Forecast (si hay API key configurada en window.WINDY_API_KEY)
      try {
        const r = await fetchWindyPointAsLive(c.lat, c.lon, currentTakeoff.windyUrl, currentTakeoff.name);
        if (r && r.measurements && r.measurements.wind_speed_avg != null) return r;
      } catch (e) { console.warn("windy point-forecast live:", e); }
      // 2b) Fallback Open-Meteo en las mismas coordenadas
      try {
        const r = await fetchOpenMeteoCurrent(c.lat, c.lon);
        if (r && r.measurements && r.measurements.wind_speed_avg != null) {
          r.source = { name: "Windy" + (currentTakeoff.name ? " · " + currentTakeoff.name : ""), url: currentTakeoff.windyUrl };
          return r;
        }
      } catch (e) { console.warn("windy/open-meteo live:", e); }
    }
  }
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
      source: stationSourceInfo(),
    };
  }
  const data = await fetchJson(`${API_BASE}/live/${currentStationId}`);
  if (data?.data) data.data.source = stationSourceInfo();
  return data?.data;
}

// v149: helpers para fuentes externas (Volandoo / Windy / Open-Meteo)
function parseVolandooSlug(url) {
  if (!url) return null;
  const m = String(url).match(/volandoo\.com\/weather\/([^\/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

// v157: cache para snapshots de viento de Volandoo, usado por la lista de
// despegues para calcular el verdict (borde de color) cuando la estación
// integrada vinculada no tiene datos recientes. Devuelve la snap cacheada
// (puede ser null) y, si está obsoleta o no existe, dispara un fetch en
// segundo plano que rerenderiza la búsqueda al terminar.
const _volandooSnapCache = new Map(); // slug -> { ts, snap }
const _volandooInflight = new Set();
const VOLANDOO_CACHE_MS = 5 * 60 * 1000;
function _volandooSnapCached(url) {
  const slug = parseVolandooSlug(url);
  if (!slug) return null;
  const c = _volandooSnapCache.get(slug);
  const fresh = c && (Date.now() - c.ts) < VOLANDOO_CACHE_MS;
  if (!fresh && !_volandooInflight.has(slug)) {
    _volandooInflight.add(slug);
    fetchVolandooStationLive(slug, url).then(live => {
      const m = live?.measurements || null;
      const snap = m ? { avg: m.wind_speed_avg ?? null, max: m.wind_speed_max ?? null, dir: m.wind_heading ?? null } : null;
      _volandooSnapCache.set(slug, { ts: Date.now(), snap });
      if (typeof tsRunSearch === "function") {
        try { tsRunSearch(); } catch {}
      }
    }).catch(e => {
      _volandooSnapCache.set(slug, { ts: Date.now(), snap: null });
      console.warn("[volandoo] cache fetch", slug, e?.message || e);
    }).finally(() => {
      _volandooInflight.delete(slug);
    });
  }
  return c?.snap || null;
}

// v158: fallback final para el verdict de despegues comunitarios que no
// tienen volandooUrl ni estacion vinculada con datos: usamos el viento
// actual de Open-Meteo (current_weather) cacheado por coordenada redondeada.
const _omNowCache = new Map(); // key "lat,lon" -> { ts, snap }
const _omNowInflight = new Set();
const OM_NOW_CACHE_MS = 10 * 60 * 1000;
function _omNowSnapCached(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const c = _omNowCache.get(key);
  const fresh = c && (Date.now() - c.ts) < OM_NOW_CACHE_MS;
  if (!fresh && !_omNowInflight.has(key)) {
    _omNowInflight.add(key);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=auto`;
    fetchJson(url).then(j => {
      const cw = j?.current;
      const snap = cw ? {
        avg: cw.wind_speed_10m ?? null,
        max: cw.wind_gusts_10m ?? null,
        dir: cw.wind_direction_10m ?? null,
      } : null;
      _omNowCache.set(key, { ts: Date.now(), snap });
      if (typeof tsRunSearch === "function") { try { tsRunSearch(); } catch {} }
    }).catch(e => {
      _omNowCache.set(key, { ts: Date.now(), snap: null });
      console.warn("[om-now] cache fetch", key, e?.message || e);
    }).finally(() => {
      _omNowInflight.delete(key);
    });
  }
  return c?.snap || null;
}

function parseWindyCoords(url) {
  if (!url) return null;
  const s = String(url);
  // ?lat=..&lon=.. o &lat,..,lon
  const q = s.match(/[?&]lat=(-?\d+(?:\.\d+)?)[^&]*&lon=(-?\d+(?:\.\d+)?)/i);
  if (q) return { lat: parseFloat(q[1]), lon: parseFloat(q[2]) };
  // Windy URLs tipo .../?40.123,-3.456,10 o #40.123,-3.456,10
  const m = s.match(/[?#,/](-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (m) {
    const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }
  return null;
}
async function fetchVolandooStationLive(slug, fallbackUrl) {
  const data = await fetchJson(`https://api.volandoo.com/v1/weather/${encodeURIComponent(slug)}`);
  const st = data?.data?.station;
  const d = st?.data;
  if (!d) return null;  const iso = d.time ? new Date(d.time * 1000).toISOString() : null;
  return {
    measurements: {
      wind_heading:   d.dir  ?? null,
      wind_speed_min: d.min  ?? null,
      wind_speed_avg: d.wind ?? null,
      wind_speed_max: d.max  ?? null,
      date: iso,
    },
    status: { date: iso },
    source: {
      name: "Volandoo" + (st.name ? " · " + st.name : ""),
      url: fallbackUrl || `https://volandoo.com/weather/${encodeURIComponent(slug)}`,
    },
  };
}
async function fetchOpenMeteoCurrent(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
              `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&windspeed_unit=kmh&timezone=auto`;
  const data = await fetchJson(url);
  const c = data?.current;
  if (!c) return null;
  const iso = c.time ? new Date(c.time).toISOString() : null;
  return {
    measurements: {
      wind_heading:   c.wind_direction_10m ?? null,
      wind_speed_min: null,
      wind_speed_avg: c.wind_speed_10m ?? null,
      wind_speed_max: c.wind_gusts_10m ?? c.wind_speed_10m ?? null,
      date: iso,
    },
    status: { date: iso },
    source: { name: "Open-Meteo", url: null },
  };
}
// v150: adapta el Point Forecast de Windy (timeline) al shape `{measurements, status, source}`
// usado por renderLive(). Escoge el punto temporal mas cercano al "ahora".
async function fetchWindyPointAsLive(lat, lon, srcUrl, takeoffName) {
  const pf = await fetchWindyPointForecast(lat, lon);
  if (!pf || !pf.points || !pf.points.length) return null;
  const now = Date.now();
  let best = pf.points[0], bestDt = Math.abs(best.date.getTime() - now);
  for (const p of pf.points) {
    const dt = Math.abs(p.date.getTime() - now);
    if (dt < bestDt) { bestDt = dt; best = p; }
  }
  const iso = best.date.toISOString();
  return {
    measurements: {
      wind_heading:   best.wind_dir ?? null,
      wind_speed_min: null,
      wind_speed_avg: best.wind_speed ?? null,
      wind_speed_max: best.wind_gust ?? best.wind_speed ?? null,
      date: iso,
    },
    status: { date: iso },
    source: { name: "Windy" + (takeoffName ? " · " + takeoffName : ""), url: srcUrl || null },
  };
}
function stationSourceInfo() {
  const prov = currentStation?.provider;
  const name = currentStation?.shortName || currentStation?.name || "";
  if (prov === "pioupiou") {
    return { name: "Pioupiou" + (name ? " · " + name : ""), url: `https://pioupiou.fr/en/observations/live/${currentStationId}` };
  }
  if (prov === "holfuy") {
    const raw = String(currentStationId || "").replace(/^holfuy[_-]?/, "");
    return { name: "Holfuy" + (name ? " · " + name : ""), url: raw ? `https://holfuy.com/en/data/?s=${raw}` : null };
  }
  if (prov === "aemet") {
    return { name: "AEMET" + (name ? " · " + name : ""), url: null };
  }
  return { name: name || "—", url: null };
}

async function getArchive(startDate, stopDate) {
  // v151: solo Pioupiou expone el endpoint /archive; estaciones AEMET/Holfuy
  // tienen id no numerico y el call falla con 400 + ruido en consola.
  if (currentStation?.provider && currentStation.provider !== "pioupiou") {
    return normalizeArchive(null);
  }
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

// === Windy Point Forecast API (v146, opcional) ===
// Para activarlo, obtener una clave gratuita en https://api.windy.com/keys
// y exponerla como window.WINDY_API_KEY (p. ej. en un script inline antes
// de app.js, o cargada desde Firebase Remote Config). Sin clave, devuelve null
// y el resto de la app sigue usando Open-Meteo como hasta ahora.
// Modelos utiles para parapente: "iconEu" (Europa, 7 km), "arome" (Francia,
// 1.3 km, alta resolucion), "gfs" (global, 22 km). El viento llega como
// componentes u/v en m/s y se convierte a km/h y grados.
async function fetchWindyPointForecast(lat, lon, model = "iconEu", levels = ["surface"]) {
  const key = (typeof window !== "undefined" && window.WINDY_API_KEY) || null;
  if (!key) return null;
  try {
    const res = await fetch("https://api.windy.com/api/point-forecast/v2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lat: Number(lat), lon: Number(lon),
        model,
        parameters: ["wind", "windGust", "temp", "rh", "pressure"],
        levels,
        key,
      }),
    });
    if (!res.ok) { console.warn("[windy] http", res.status); return null; }
    const data = await res.json();
    const ts = Array.isArray(data?.ts) ? data.ts : [];
    const u = data["wind_u-surface"] || [];
    const v = data["wind_v-surface"] || [];
    const g = data["gust-surface"] || [];
    const out = ts.map((tms, i) => {
      const uu = u[i], vv = v[i];
      const spd = (uu != null && vv != null) ? Math.hypot(uu, vv) * 3.6 : null;
      let dir = null;
      if (uu != null && vv != null) {
        // viento "de donde sopla" = atan2(-u, -v) en grados meteorologicos
        dir = (Math.atan2(-uu, -vv) * 180 / Math.PI + 360) % 360;
      }
      return {
        date: new Date(tms),
        wind_speed: spd,
        wind_gust: g[i] != null ? g[i] * 3.6 : null,
        wind_dir: dir,
      };
    });
    return { model, points: out, units: data.units || {} };
  } catch (e) {
    console.warn("[windy] fetch:", e);
    return null;
  }
}

async function getAllStations() {
  const data = await fetchJson(`${API_BASE}/live-with-meta/all`);
  return data?.data || [];
}

// === Sondeo atmosférico (v155, Open-Meteo) ===
// Devuelve un perfil vertical para un único punto (lat,lon) con varios
// modelos en orden de preferencia. AROME (1.3 km, Francia y norte de la
// península) > ICON-D2 (2.2 km, Europa Central/Alpes) > ICON-EU (7 km,
// Europa) > GFS (22 km, mundial). El primero que devuelva datos no nulos
// para temperature_2m se considera válido.
const SOUNDING_PRESSURE_LEVELS = [950, 925, 900, 850, 800, 700, 600, 500, 400, 300];
const SOUNDING_AGL_HEIGHTS = [10, 80, 120, 180];
const SOUNDING_MODELS = [
  { id: "meteofrance_arome_france_hd", label: "AROME-HD (1.3 km)" },
  { id: "meteofrance_arome_france",    label: "AROME (2.5 km)" },
  { id: "icon_d2",                     label: "ICON-D2 (2.2 km)" },
  { id: "icon_eu",                     label: "ICON-EU (7 km)" },
  { id: "gfs_seamless",                label: "GFS (22 km)" },
];

function _buildSoundingHourlyParams() {
  const parts = ["temperature_2m", "dew_point_2m", "surface_pressure"];
  for (const h of SOUNDING_AGL_HEIGHTS) {
    parts.push(`wind_speed_${h}m`, `wind_direction_${h}m`);
  }
  for (const p of SOUNDING_PRESSURE_LEVELS) {
    parts.push(
      `temperature_${p}hPa`,
      `dew_point_${p}hPa`,
      `wind_speed_${p}hPa`,
      `wind_direction_${p}hPa`,
      `geopotential_height_${p}hPa`,
      `cloud_cover_${p}hPa`,
    );
  }
  return parts.join(",");
}

async function fetchSoundingOpenMeteo(lat, lon) {
  const hourly = _buildSoundingHourlyParams();
  const lastErrors = [];
  for (const m of SOUNDING_MODELS) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                  `&hourly=${hourly}&models=${m.id}` +
                  `&wind_speed_unit=kmh&timezone=auto&forecast_days=3`;
      const data = await fetchJson(url);
      const arr = data?.hourly?.temperature_2m;
      if (Array.isArray(arr) && arr.some(v => v != null)) {
        return { data, model: m };
      }
      lastErrors.push(`${m.id}: sin datos`);
    } catch (e) {
      lastErrors.push(`${m.id}: ${e?.message || e}`);
    }
  }
  console.warn("[sounding] ningun modelo devolvió datos", lastErrors);
  return null;
}

function _soundingPickHourIndex(times, targetTs) {
  if (!Array.isArray(times) || !times.length) return -1;
  let bestI = 0, bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const ts = new Date(times[i]).getTime();
    if (!Number.isFinite(ts)) continue;
    const d = Math.abs(ts - targetTs);
    if (d < bestDiff) { bestDiff = d; bestI = i; }
  }
  return bestI;
}

function _soundingBuildProfile(data, i, takeoffAlt) {
  const h = data.hourly;
  // Punto superficie a partir de los 2 m / 10 m y altitud del despegue.
  const baseAlt = (Number.isFinite(takeoffAlt) ? takeoffAlt : (data.elevation || 0));
  const profile = [];
  // Punto de superficie con T/Td reales.
  profile.push({
    label: "Sup",
    alt: baseAlt,
    t: h.temperature_2m?.[i] ?? null,
    td: h.dew_point_2m?.[i] ?? null,
    ws: h[`wind_speed_${SOUNDING_AGL_HEIGHTS[0]}m`]?.[i] ?? null,
    wd: h[`wind_direction_${SOUNDING_AGL_HEIGHTS[0]}m`]?.[i] ?? null,
    cld: null,
  });
  // Niveles AGL adicionales (80/120/180 m sobre el suelo).
  for (let k = 1; k < SOUNDING_AGL_HEIGHTS.length; k++) {
    const m = SOUNDING_AGL_HEIGHTS[k];
    profile.push({
      label: `${m} m`,
      alt: baseAlt + m,
      t: null, td: null,
      ws: h[`wind_speed_${m}m`]?.[i] ?? null,
      wd: h[`wind_direction_${m}m`]?.[i] ?? null,
      cld: null,
    });
  }
  // Niveles de presión: ordenados de bajo a alto en altitud.
  for (const p of SOUNDING_PRESSURE_LEVELS) {
    const gh = h[`geopotential_height_${p}hPa`]?.[i];
    if (gh == null) continue;
    profile.push({
      label: `${p} hPa`,
      alt: gh,
      t: h[`temperature_${p}hPa`]?.[i] ?? null,
      td: h[`dew_point_${p}hPa`]?.[i] ?? null,
      ws: h[`wind_speed_${p}hPa`]?.[i] ?? null,
      wd: h[`wind_direction_${p}hPa`]?.[i] ?? null,
      cld: h[`cloud_cover_${p}hPa`]?.[i] ?? null,
    });
  }
  // Ordenar por altitud ascendente (sup primero).
  profile.sort((a, b) => (a.alt ?? 0) - (b.alt ?? 0));
  return profile;
}

let _sndTempChart = null;
let _sndState = { lat: null, lon: null, takeoff: null, data: null, model: null, targetTs: null };

// v156: color de la flecha de viento en el sondeo según velocidad
// comparada con los criterios del despegue (windMin/windMax). Poco viento
// en altura siempre se considera bueno → verde si spd ≤ windMax.
function _soundingWindColor(spd) {
  if (spd == null || !Number.isFinite(spd)) return "#888";
  const c = currentTakeoffCriteria || {};
  const wmax = Number.isFinite(c.windMax) ? c.windMax : 25;
  const gmax = Number.isFinite(c.gustMax) ? c.gustMax : Math.max(wmax * 1.6, 35);
  if (spd <= wmax) return "#2ecc71";          // ideal: por debajo del máximo medio
  if (spd <= gmax) return "#f1c40f";          // aceptable hasta la racha máx tolerada
  return "#e74c3c";                            // demasiado viento
}

// v156: punto canvas con flecha de viento + valor numérico en km/h al lado,
// para usarlo como pointStyle de Chart.js en el sondeo.
function _makeWindArrowWithLabel(deg, color, spdLabel, size = 22) {
  const dpr = window.devicePixelRatio || 1;
  const arrow = size;
  const padText = 3;
  const ctx0 = document.createElement("canvas").getContext("2d");
  ctx0.font = "bold 11px system-ui, sans-serif";
  const textW = Math.ceil(ctx0.measureText(spdLabel).width);
  const w = arrow + padText + textW + 4;
  const h = arrow;
  const cv = document.createElement("canvas");
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.width = w + "px"; cv.style.height = h + "px";
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  // Flecha centrada en la mitad izquierda.
  ctx.save();
  ctx.translate(arrow / 2, h / 2);
  const rot = ((deg || 0) + 180) * Math.PI / 180;
  ctx.rotate(rot);
  ctx.fillStyle = color || "#888";
  const s = arrow / 2;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.7, s * 0.6);
  ctx.lineTo(0, s * 0.25);
  ctx.lineTo(-s * 0.7, s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Texto km/h junto a la flecha.
  ctx.fillStyle = color || "#888";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(spdLabel, arrow + padText, h / 2);
  return cv;
}

function openSounding(targetTs) {
  const lat = Number(currentTakeoff?.lat);
  const lon = Number(currentTakeoff?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const modal = document.getElementById("soundingModal");
  if (!modal) return;
  const ts = Number.isFinite(targetTs) ? Number(targetTs) : Date.now();
  _sndState = { lat, lon, takeoff: { ...currentTakeoff }, data: null, model: null, targetTs: ts };
  // Subtítulo y enlace a Windy.
  const sub = document.getElementById("sndSubtitle");
  if (sub) {
    const name = currentTakeoff.name || currentStation?.name || "";
    const when = new Date(ts).toLocaleString(t("locale"), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    sub.textContent = `${name} · ${when}`;
  }
  const windyLink = document.getElementById("sndOpenWindy");
  if (windyLink) {
    const url = `https://www.windy.com/sounding/${lat.toFixed(3)}/${lon.toFixed(3)}?iconEu,900h,${lat.toFixed(3)},${lon.toFixed(3)},11,p:wind`;
    // v0.192: ahora es un <button>; guardamos la URL en dataset y abrimos con
    // window.open en el click handler (registrado una unica vez mas abajo).
    windyLink.dataset.url = url;
  }
  // Reset UI.
  document.getElementById("sndStatus").hidden = false;
  document.getElementById("sndStatus").textContent = t("snd.loading");
  modal.querySelector(".sounding-charts").hidden = true;
  const details = document.getElementById("sndTableDetails");
  if (details) { details.hidden = true; details.open = false; }
  document.getElementById("sndMeta").innerHTML = "";
  modal.hidden = false;
  // Cargar y renderizar.
  fetchSoundingOpenMeteo(lat, lon).then(res => {
    if (!res) {
      document.getElementById("sndStatus").textContent = t("snd.error");
      return;
    }
    _sndState.data = res.data;
    _sndState.model = res.model;
    _renderSoundingMeta();
    _renderSoundingFor(ts);
  });
}

function closeSounding() {
  const m = document.getElementById("soundingModal");
  if (m) m.hidden = true;
  if (_sndTempChart) { try { _sndTempChart.destroy(); } catch {} _sndTempChart = null; }
}

function _renderSoundingMeta() {
  const meta = document.getElementById("sndMeta");
  if (!meta || !_sndState.data) return;
  const times = _sndState.data.hourly.time || [];
  const idx = _soundingPickHourIndex(times, _sndState.targetTs);
  const opts = times.map((tt, i) => {
    const d = new Date(tt);
    const lbl = d.toLocaleString(t("locale"), { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return `<option value="${i}" ${i === idx ? "selected" : ""}>${lbl}</option>`;
  }).join("");
  meta.innerHTML = `
    <span><strong>${t("snd.model")}:</strong> ${_sndState.model.label}</span>
    <label><span>${t("snd.hour")}:</span> <select id="sndHourSel">${opts}</select></label>
  `;
  document.getElementById("sndHourSel")?.addEventListener("change", (e) => {
    const i = Number(e.target.value);
    const ts = new Date(_sndState.data.hourly.time[i]).getTime();
    _sndState.targetTs = ts;
    _renderSoundingFor(ts);
  });
}

function _renderSoundingFor(ts) {
  const data = _sndState.data;
  if (!data) return;
  const i = _soundingPickHourIndex(data.hourly.time, ts);
  if (i < 0) return;
  const profile = _soundingBuildProfile(data, i, _sndState.takeoff?.alt);
  if (!profile.length) {
    document.getElementById("sndStatus").textContent = t("snd.error");
    return;
  }
  document.getElementById("sndStatus").hidden = true;
  const modal = document.getElementById("soundingModal");
  modal.querySelector(".sounding-charts").hidden = false;
  const details = document.getElementById("sndTableDetails");
  if (details) details.hidden = false;

  // --- Gráfico: temperatura/rocío (eje X inferior, °C) con eje Y de altitud.
  // Las flechas de viento se dibujan FUERA del chart en la banda derecha
  // (espacio reservado con layout.padding.right) mediante un plugin custom.
  // v160: opcion Skew-T. Inclinamos las series T/Td ~45deg respecto a la
  // vertical aplicando un desplazamiento horizontal proporcional a la
  // altitud (skewSlope °C/m). El perfil real se mantiene en $profile para
  // que el tooltip siga funcionando contra altitudes reales.
  const skewToggle = document.getElementById("sndSkewToggle");
  const skewOn = skewToggle ? !!skewToggle.checked : true;
  // Pendiente del skew: que el rango total de altitud se desplace ~30 °C.
  const altsAll = profile.map(p => p.alt).filter(a => Number.isFinite(a));
  const altMin = altsAll.length ? Math.min(...altsAll) : 0;
  const altMax = altsAll.length ? Math.max(...altsAll) : 1000;
  const altSpan = Math.max(1, altMax - altMin);
  const skewSlope = skewOn ? (30 / altSpan) : 0; // °C por metro
  const skewX = (t, alt) => t + skewSlope * (alt - altMin);
  const tPts  = profile.filter(p => p.t  != null).map(p => ({ x: skewX(p.t,  p.alt), y: p.alt }));
  const tdPts = profile.filter(p => p.td != null).map(p => ({ x: skewX(p.td, p.alt), y: p.alt }));
  const windPts = profile.filter(p => p.ws != null && p.wd != null)
    .map(p => ({ alt: p.alt, dir: p.wd, spd: p.ws, color: _soundingWindColor(p.ws) }));

  // Plugin: isotermas guia muy sutiles cuando el skew esta activado.
  // Se dibujan como diagonales (T constante => x = T + skewSlope*(alt-altMin))
  // cada 10 °C, desde altMin hasta altMax.
  // v0.192: colores adaptados al tema (claro/oscuro) para que la rejilla,
  // isotermas y texto del titulo del grafico se aprecien tambien en claro.
  function _sndChartColors() {
    const root = document.documentElement;
    const theme = root.dataset.theme;
    const isLight = theme === "light"
      || (theme === "auto" && window.matchMedia?.("(prefers-color-scheme: light)")?.matches);
    return isLight ? {
      text:     "#1a2940",
      muted:    "#3a4a66",
      grid:     "rgba(20,40,80,0.18)",
      iso:      "rgba(20,40,80,0.28)",
      isoLabel: "rgba(20,40,80,0.65)",
      xTitle:   "#a3372f",
    } : {
      text:     "#e8eef7",
      muted:    "#8aa0bb",
      grid:     "rgba(255,255,255,0.05)",
      iso:      "rgba(255,255,255,0.06)",
      isoLabel: "rgba(255,255,255,0.18)",
      xTitle:   "#e57777",
    };
  }
  const isothermsPlugin = {
    id: "sndIsotherms",
    beforeDatasetsDraw(chart) {
      if (!skewOn) return;
      const { ctx, chartArea, scales } = chart;
      const xScale = scales.x, yScale = scales.y;
      if (!xScale || !yScale) return;
      const tMin = Math.floor((xScale.min - skewSlope * altSpan) / 10) * 10;
      const tMax = Math.ceil(xScale.max / 10) * 10;
      ctx.save();
      ctx.beginPath();
      ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
      ctx.clip();
      const _c = _sndChartColors();
      ctx.strokeStyle = _c.iso;
      ctx.lineWidth = 1;
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = _c.isoLabel;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      for (let t = tMin; t <= tMax; t += 10) {
        const x1 = xScale.getPixelForValue(skewX(t, altMin));
        const y1 = yScale.getPixelForValue(altMin);
        const x2 = xScale.getPixelForValue(skewX(t, altMax));
        const y2 = yScale.getPixelForValue(altMax);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // Rotulo discreto cerca del borde inferior
        if (x1 >= chartArea.left && x1 <= chartArea.right) {
          ctx.fillText(`${t}°`, x1 + 2, chartArea.bottom - 2);
        }
      }
      ctx.restore();
    },
  };

  const windRightPlugin = {
    id: "sndWindRight",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const yScale = scales.y;
      if (!yScale || !chart.$windPts) return;
      const xBase = chartArea.right + 6;
      const arrowSize = 14;
      const minAltGap = 500; // metros minimos entre flechas consecutivas
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      // Renderizamos la flecha mas baja y, a partir de ahi, solo las que
      // esten al menos 500 m por encima de la ultima dibujada.
      const sorted = chart.$windPts.slice().sort((a, b) => a.alt - b.alt);
      let lastAlt = -Infinity;
      for (const p of sorted) {
        if (p.alt - lastAlt < minAltGap) continue;
        const yPx = yScale.getPixelForValue(p.alt);
        if (yPx < chartArea.top || yPx > chartArea.bottom) continue;
        lastAlt = p.alt;
        // Flecha
        ctx.save();
        ctx.translate(xBase + arrowSize / 2, yPx);
        ctx.rotate(((p.dir || 0) + 180) * Math.PI / 180);
        ctx.fillStyle = p.color;
        const s = arrowSize / 2;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, s * 0.6);
        ctx.lineTo(0, s * 0.25);
        ctx.lineTo(-s * 0.7, s * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // Valor km/h al lado
        ctx.fillStyle = p.color;
        ctx.fillText(String(Math.round(p.spd)), xBase + arrowSize + 3, yPx);
      }
    },
  };

  const tempCtx = document.getElementById("sndTempChart").getContext("2d");
  if (_sndTempChart) { try { _sndTempChart.destroy(); } catch {} }
  const _C = _sndChartColors();
  _sndTempChart = new Chart(tempCtx, {
    type: "scatter",
    data: {
      datasets: [
        { label: "T",  data: tPts,  showLine: true, borderColor: "rgba(231,76,60,0.9)",  backgroundColor: "rgba(231,76,60,0.2)",  pointRadius: 3, tension: 0.2 },
        { label: "Td", data: tdPts, showLine: true, borderColor: "rgba(78,161,255,0.9)", backgroundColor: "rgba(78,161,255,0.2)", pointRadius: 3, tension: 0.2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 56 } },
      interaction: { mode: "nearest", axis: "y", intersect: false },
      plugins: {
        legend: { labels: { color: _C.text } },
        title: { display: true, text: t("snd.temp_chart") + " · → " + t("snd.wind_axis"), color: _C.text },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: (items) => {
              const y = items[0]?.parsed?.y;
              if (y == null) return "";
              // Buscar el nivel del perfil más cercano al Y del cursor.
              const prof = _sndTempChart?.$profile || [];
              let best = null, bestD = Infinity;
              for (const p of prof) {
                const d = Math.abs((p.alt ?? 0) - y);
                if (d < bestD) { bestD = d; best = p; }
              }
              const lbl = best ? `${best.label} · ${Math.round(best.alt)} m` : `${Math.round(y)} m`;
              return lbl;
            },
            label: () => "",
            afterBody: (items) => {
              const y = items[0]?.parsed?.y;
              if (y == null) return [];
              const prof = _sndTempChart?.$profile || [];
              let best = null, bestD = Infinity;
              for (const p of prof) {
                const d = Math.abs((p.alt ?? 0) - y);
                if (d < bestD) { bestD = d; best = p; }
              }
              if (!best) return [];
              const lines = [];
              if (best.t  != null) lines.push(`T:  ${fmtNum(best.t)}  °C`);
              if (best.td != null) lines.push(`Td: ${fmtNum(best.td)} °C`);
              if (best.ws != null) {
                const dirInfo = (best.wd != null) ? classifyDirection(best.wd) : null;
                const dirStr = dirInfo ? ` · ${dirInfo.name} (${Math.round(best.wd)}°)` : "";
                lines.push(`💨 ${fmtNum(best.ws)} km/h${dirStr}`);
              }
              if (best.cld != null) lines.push(`☁ ${Math.round(best.cld)} %`);
              return lines;
            },
          },
        },
      },
      scales: {
        x: { type: "linear", position: "bottom",
             title: { display: true, text: skewOn ? "°C (skew-T)" : "°C", color: _C.xTitle },
             ticks: { color: _C.muted, display: !skewOn },
             grid: { color: _C.grid, display: !skewOn } },
        y: { title: { display: false },
             ticks: { color: _C.muted, callback: (v) => Math.round(v) },
             grid: { color: _C.grid } },
      },
    },
    plugins: [isothermsPlugin, windRightPlugin],
  });
  _sndTempChart.$windPts = windPts;
  _sndTempChart.$profile = profile;
  _sndTempChart.update();

  // --- Tabla colapsable de niveles. ---
  const tbl = document.getElementById("sndTable");
  const rows = profile.slice().reverse().map(p => {
    const info = (p.wd != null) ? classifyDirection(p.wd) : null;
    const dirCell = info ? `${info.name} (${Math.round(p.wd)}°)` : "—";
    return `<tr>
      <td>${p.label}</td>
      <td>${p.alt != null ? Math.round(p.alt) : "—"}</td>
      <td>${p.t  != null ? fmtNum(p.t)  : "—"}</td>
      <td>${p.td != null ? fmtNum(p.td) : "—"}</td>
      <td>${p.ws != null ? fmtNum(p.ws) : "—"}</td>
      <td>${dirCell}</td>
      <td>${p.cld != null ? Math.round(p.cld) : "—"}</td>
    </tr>`;
  }).join("");
  tbl.innerHTML = `<table>
    <thead><tr>
      <th>${t("snd.col_lvl")}</th><th>${t("snd.col_alt")}</th><th>${t("snd.col_t")}</th><th>${t("snd.col_td")}</th>
      <th>${t("snd.col_ws")}</th><th>${t("snd.col_wd")}</th><th>${t("snd.col_cld")}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

document.getElementById("sndClose")?.addEventListener("click", closeSounding);
// v0.192: el enlace Abrir-en-Windy paso a ser un <button>; abrimos manualmente.
document.getElementById("sndOpenWindy")?.addEventListener("click", () => {
  const u = document.getElementById("sndOpenWindy")?.dataset.url;
  if (u) window.open(u, "_blank", "noopener");
});
document.getElementById("soundingModal")?.addEventListener("click", (e) => {
  if (e.target.id === "soundingModal") closeSounding();
});

// v160: Skew-T toggle. Estado persistido en localStorage; al cambiar,
// re-renderiza el sondeo del timestamp actual.
(function initSkewToggle() {
  const tg = document.getElementById("sndSkewToggle");
  if (!tg) return;
  try {
    const saved = localStorage.getItem("snd.skewT");
    if (saved != null) tg.checked = saved === "1";
  } catch {}
  tg.addEventListener("change", () => {
    try { localStorage.setItem("snd.skewT", tg.checked ? "1" : "0"); } catch {}
    if (_sndState?.targetTs != null) _renderSoundingFor(_sndState.targetTs);
  });
})();

// v155: delegación para los botones "Sondeo" de cada slot de pronóstico.
document.getElementById("forecastSummary")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".snd-btn");
  if (!btn) return;
  const ts = Number(btn.getAttribute("data-ts"));
  if (Number.isFinite(ts)) openSounding(ts);
});

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
const AEMET_LS_KEY = "aemetStationsCache_v2";
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
  // v108: trata cache vacia como ausente (antes una respuesta puntual fallida
  // dejaba [] en _aemetCache y en LS y se servia 15 min / 24 h sin reintentar).
  if (_aemetCache && _aemetCache.length && (Date.now() - _aemetCacheTs) < AEMET_CACHE_MS) return _aemetCache;
  if (!_aemetCache || !_aemetCache.length) {
    const ls = _aemetLoadLs();
    if (ls && Array.isArray(ls.data) && ls.data.length && (Date.now() - ls.ts) < AEMET_LS_TTL) {
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
    const records = await fetchJsonLatin1(meta.datos);
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
    const parsed = Array.from(byId.values()).map(r => ({
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
    // v108: nunca persistas una lista vacia (proteccion contra poison cache).
    if (parsed.length === 0 && _aemetCache && _aemetCache.length) {
      console.warn("AEMET: parse vacio, conservando cache previa");
      return _aemetCache;
    }
    if (parsed.length === 0) {
      console.warn("AEMET: parse vacio");
      return _aemetCache || [];
    }
    _aemetCache = parsed;
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
// v149: muestra la fuente del dato en tiempo real junto a "Ultima lectura"
function renderLiveSource(src) {
  const el = document.getElementById("lastUpdateSource");
  if (!el) return;
  if (!src || !src.name) { el.textContent = ""; return; }
  const label = String(src.name);
  if (src.url) {
    el.innerHTML = ' · <a href="' + src.url.replace(/"/g, "&quot;") + '" target="_blank" rel="noopener">' +
                   label.replace(/</g, "&lt;") + '</a>';
  } else {
    el.textContent = " · " + label;
  }
}

// === Estado actual ===
let previousAvg = null;
function renderLive(live) {
  // v106: si no hay datos disponibles (p.ej. estación AEMET caída o sin reporte
  // reciente), limpiamos toda la UI de viento y mostramos "datos no disponibles".
  // La previsión sigue funcionando aparte (usa coords del despegue).
  const hasAnyWind = !!(live && live.measurements && (
    live.measurements.wind_heading != null ||
    live.measurements.wind_speed_avg != null ||
    live.measurements.wind_speed_max != null ||
    live.measurements.wind_speed_min != null
  ));
  if (!live || !hasAnyWind) {
    latestLive = null;
    previousAvg = null;
    setText("windAvg", "—"); setText("windMax", "—"); setText("windMin", "—");
    setText("lastUpdate", "—");
    renderLiveSource(null);
    renderWindBarVertical(null, null);
    const trendEl = document.getElementById("windAvgTrend");
    if (trendEl) trendEl.hidden = true;
    setText("dirLabel", t("dirLabel.dash"));
    const wedge = document.getElementById("windWedge");
    if (wedge) {
      wedge.dataset.dir = "";
      wedge.style.transform = "";
      wedge.dataset.quality = "unknown";
      wedge.dataset.speed = "unknown";
    }
    const centerEl = document.getElementById("compassAvg");
    if (centerEl) centerEl.textContent = "—";
    const light = document.getElementById("verdictLight");
    if (light) light.className = "verdict-light unknown";
    setText("verdictTitle", t("verdict.unavailable.title"));
    setText("verdictDetail", t("verdict.unavailable.detail"));
    return;
  }
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
  renderLiveSource(live.source || null);
  renderWindBarVertical(avg, max);

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
  const card = document.getElementById("cloudCard");
  if (!box) return;
  const cl = classifyClouds(cw);
  if (!cl) { box.hidden = true; if (card) card.hidden = true; return; }
  box.hidden = false;
  if (card) card.hidden = false;

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
  // v133: clasificamos cada hora con el mismo veredicto que usan las flechas
  // del pronóstico (ideal = verde, ok = amarillo, bad = rojo). Después
  // construimos rachas separadas por calidad y mostramos hasta 2 intervalos
  // priorizando los más largos. Si no hay verdes, caemos a amarillas con aviso.
  const hours = [];
  for (let i = 0; i < h.time.length; i++) {
    const ts = new Date(h.time[i]).getTime();
    if (ts < dayStart) continue;
    if (ts > dayEnd) break;
    if (ref.dayOffset === 0 && ts < now - 30 * 60 * 1000) continue;
    const dirInfo = classifyDirection(h.wind_direction_10m[i]);
    const spdQ = classifySpeed(h.wind_speed_10m[i], h.wind_gusts_10m[i]);
    let v = combineVerdict(dirInfo.quality, spdQ);
    const slot = { code: h.weather_code?.[i], cloud: h.cloud_cover?.[i], precip: h.precipitation_probability?.[i], cape: h.cape?.[i] };
    const risk = weatherRisk(slot);
    if (risk === "storm") v = "bad";
    else if (risk === "rain" && v !== "bad") v = "warn";
    hours.push({ ts, v });
  }
  // Agrupa rachas consecutivas que cumplan `pass(v)`.
  const buildRuns = (pass) => {
    const out = [];
    let cur = null;
    for (const { ts, v } of hours) {
      if (pass(v)) {
        if (!cur) cur = { start: ts, end: ts + 3600 * 1000 };
        else cur.end = ts + 3600 * 1000;
      } else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out;
  };
  let runs = buildRuns(v => v === "ideal");
  let usedFallback = false;
  if (runs.length === 0) {
    // Sin franjas verdes → probamos amarillas (volables) con aviso.
    runs = buildRuns(v => v === "ideal" || v === "ok");
    usedFallback = runs.length > 0;
  }
  const labelKey = ref.dayOffset === 1 ? "best.label_tomorrow" : "best.label";
  box.querySelector(".bw-label").textContent = t(labelKey);
  if (runs.length === 0) {
    box.hidden = false;
    box.className = "best-window none";
    box.querySelector("#bestWindowText").textContent = t("best.none");
    return;
  }
  // Hasta 2 intervalos, los más largos primero; al pintar respetar orden cronológico.
  const top = runs
    .slice()
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))
    .slice(0, 2)
    .sort((a, b) => a.start - b.start);
  const fmtHM = (ms) => new Date(ms).toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit" });
  const parts = top.map(r => `${fmtHM(r.start)}–${fmtHM(r.end)}`);
  const tag = usedFallback ? t("best.warn_yellow") : t("best.ideal");
  box.hidden = false;
  box.className = "best-window " + (usedFallback ? "ok" : "");
  box.querySelector("#bestWindowText").textContent = `${parts.join(" · ")} · ${tag}`;
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

// v0.193: colores de Chart.js sensibles al tema (claro/oscuro/auto).
// En el tema claro la rejilla y los ticks deben ser visibles sobre fondo claro.
function _chartThemeColors() {
  const root = document.documentElement;
  const theme = root.dataset.theme;
  const isLight = theme === "light"
    || (theme === "auto" && window.matchMedia?.("(prefers-color-scheme: light)")?.matches);
  return isLight
    ? { text: "#1a2940", tick: "#3a4a66", grid: "rgba(20,40,80,0.18)" }
    : { text: "#e8eef7", tick: "#8aa0bb", grid: "rgba(255,255,255,0.05)" };
}
function chartCommonOptions() {
  const _C = _chartThemeColors();
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: { labels: { color: _C.text } },
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
           ticks: { color: _C.tick }, grid: { color: _C.grid } },
      y: { beginAtZero: true,
           title: { display: false },
           ticks: { color: _C.tick }, grid: { color: _C.grid } },
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

// v134: Plugin para pintar una franja horizontal con el rango de velocidad
// media de viento ideal para despegar (segun los criterios del despegue
// actual). Se dibuja DETRAS de las lineas para no taparlas.
const forecastIdealBandPlugin = {
  id: "forecastIdealBand",
  beforeDatasetsDraw(chart) {
    const band = chart.$idealBand;
    if (!band || !Number.isFinite(band.min) || !Number.isFinite(band.max)) return;
    const yScale = chart.scales?.y;
    if (!yScale) return;
    const { ctx, chartArea } = chart;
    const clip = (px) => Math.max(chartArea.top, Math.min(chartArea.bottom, px));
    const yTop    = clip(yScale.getPixelForValue(band.max));
    const yBottom = clip(yScale.getPixelForValue(band.min));
    // Franja verde (velocidad media ideal).
    if (yBottom > yTop) {
      ctx.save();
      ctx.fillStyle = "rgba(46,204,113,0.14)";
      ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBottom - yTop);
      ctx.strokeStyle = "rgba(46,204,113,0.55)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, yTop);    ctx.lineTo(chartArea.right, yTop);
      ctx.moveTo(chartArea.left, yBottom); ctx.lineTo(chartArea.right, yBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = "rgba(46,204,113,0.95)";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${t("chart.ideal_band")}: ${band.min}–${band.max} km/h`, chartArea.left + 6, yTop + 3);
      ctx.restore();
    }
    // v0.201: franja amarilla (racha aceptable) desde windMax hasta gustMax.
    if (Number.isFinite(band.gustMax) && band.gustMax > band.max) {
      const yGust = clip(yScale.getPixelForValue(band.gustMax));
      if (yTop > yGust) {
        ctx.save();
        ctx.fillStyle = "rgba(241,196,15,0.14)";
        ctx.fillRect(chartArea.left, yGust, chartArea.right - chartArea.left, yTop - yGust);
        ctx.strokeStyle = "rgba(241,196,15,0.55)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(chartArea.left, yGust); ctx.lineTo(chartArea.right, yGust);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "bold 10px sans-serif";
        ctx.fillStyle = "rgba(200,150,10,0.95)";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`${t("chart.gust_band")}: ${band.max}–${band.gustMax} km/h`, chartArea.left + 6, yGust + 3);
        ctx.restore();
      }
    }
  },
};

// v0.201: icono de aviso (triangulo amarillo con !) para marcar horas en las
// que la racha maxima supera el limite recomendado del despegue.
function makeWarnIcon(size = 16) {
  const dpr = window.devicePixelRatio || 1;
  const cv = document.createElement("canvas");
  const px = Math.max(10, size);
  cv.width = px * dpr; cv.height = px * dpr;
  cv.style.width = px + "px"; cv.style.height = px + "px";
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  const pad = 1;
  // Triangulo
  ctx.beginPath();
  ctx.moveTo(px / 2, pad);
  ctx.lineTo(px - pad, px - pad);
  ctx.lineTo(pad, px - pad);
  ctx.closePath();
  ctx.fillStyle = "#f1c40f";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#7a5d00";
  ctx.stroke();
  // Signo de exclamacion
  ctx.fillStyle = "#3a2c00";
  ctx.font = `bold ${Math.round(px * 0.62)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", px / 2, px * 0.62);
  return cv;
}
if (typeof Chart !== "undefined") Chart.register(forecastIdealBandPlugin);

// v135: pinta la mini-brujula (esquina sup-izda del grafico) con los 16
// sectores de calidad de direccion del despegue actual. Sin flecha de viento
// (solo el "anillo" de aptitud), tamano pequeno.
function renderForecastMiniCompass() {
  const host = document.getElementById("forecastMiniCompass");
  if (!host) return;
  const crit = currentTakeoffCriteria || getCurrentTakeoffDoc()?.criteria || null;
  const q16 = (crit && Array.isArray(crit.qualityByIndex) && crit.qualityByIndex.some(Boolean))
    ? crit.qualityByIndex.map(q => q || "bad")
    : NEUTRAL_QUALITY_BY_INDEX.slice();
  const COLORS = { ideal: "#2ecc71", ok: "#f1c40f", bad: "#e74c3c" };
  const cx = 36, cy = 36;
  const rOut = 30, rIn = 18;
  const polar = (deg, r) => {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const sectorPath = (startDeg, endDeg) => {
    const [x1, y1] = polar(startDeg, rOut);
    const [x2, y2] = polar(endDeg,   rOut);
    const [x3, y3] = polar(endDeg,   rIn);
    const [x4, y4] = polar(startDeg, rIn);
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${rOut} ${rOut} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4} Z`;
  };
  const sectors = q16.map((q, i) => {
    const start = i * 22.5 - 11.25;
    const end = start + 22.5;
    const color = COLORS[q] || COLORS.bad;
    // v137: colores mas vivos para que se vean bien sobre el grafico
    const opacity = q === "bad" ? 0.9 : 1.0;
    return `<path d="${sectorPath(start, end)}" fill="${color}" opacity="${opacity}" />`;
  }).join("");
  // v138: mini-brujula inline en la cabecera del pronostico, sin etiqueta
  // ni puntos cardinales (la cabecera ya muestra el nombre del despegue).
  // v0.193: sin fondos solidos - solo los arcos de calidad; el centro
  // hereda el color del panel (transparente).
  host.innerHTML = `
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      ${sectors}
    </svg>`;
}

// v135/v141: actualiza los dos anemometros verticales junto a la brujula.
//  - Izquierda (avg): zonas amarillo[0,wmin] verde[wmin,wmax] amarillo[wmax,
//    gmax*0.66] rojo[gmax*0.66, gmax]. Top = gmax.
//  - Derecha (gust): zonas verde[0,gmax*0.66] amarillo[gmax*0.66, gmax]
//    rojo[gmax, top]. Top = gmax * 1.3 (margen para visualizar el rojo).
function renderWindBarVertical(avgKmh, gustKmh) {
  const c = currentTakeoffCriteria || {};
  const wmin = Number.isFinite(c.windMin) ? c.windMin : 5;
  const wmax = Number.isFinite(c.windMax) ? c.windMax : 15;
  const gmax = Number.isFinite(c.gustMax) ? c.gustMax : 30;
  const cYellow = "rgba(241,196,15,0.18)";
  const cGreen  = "rgba(46,204,113,0.22)";
  const cRed    = "rgba(231,76,60,0.22)";

  function paint(ids, value, opts) {
    const zones = document.getElementById(ids.zones);
    const fill  = document.getElementById(ids.fill);
    const ticks = document.getElementById(ids.ticks);
    const valEl = document.getElementById(ids.value);
    if (!zones || !fill || !ticks) return;
    const top = opts.top;
    const pct = (v) => Math.max(0, Math.min(100, (v / top) * 100));
    zones.style.background = opts.gradient(pct);
    ticks.innerHTML = "";
    opts.tickAt.forEach(v => {
      const p = pct(v);
      const t = document.createElement("div");
      t.className = "wbv-tick";
      t.style.bottom = `${p}%`;
      // v161: etiqueta numerica (sin unidades) para cada marca del rango,
      // asi el usuario ve de un vistazo los umbrales que estan aplicandose.
      const lab = document.createElement("span");
      lab.className = "wbv-tick-label";
      lab.textContent = String(Math.round(v));
      t.appendChild(lab);
      ticks.appendChild(t);
    });
    if (value == null || !Number.isFinite(value)) {
      fill.style.height = "0%";
      fill.className = "wbv-fill";
      if (valEl) valEl.textContent = "—";
      return;
    }
    fill.style.height = `${pct(value)}%`;
    fill.className = "wbv-fill " + opts.classify(value);
    if (valEl) valEl.textContent = String(Math.round(value));
  }

  // --- Avg (izquierda) ---
  paint(
    { zones: "wbvZones", fill: "wbvFill", ticks: "wbvTicks", value: "wbvValue" },
    avgKmh,
    {
      top: gmax,
      // v0.195: solo etiquetamos los valores extremos (minimo aceptable y
      // umbral rojo superior) para evitar solapamientos.
      tickAt: [wmin, gmax * 0.66],
      gradient: (pct) => {
        const p1 = pct(wmin), p2 = pct(wmax), p3 = pct(gmax * 0.66);
        return `linear-gradient(to top,
          ${cYellow} 0%, ${cYellow} ${p1}%,
          ${cGreen}  ${p1}%, ${cGreen}  ${p2}%,
          ${cYellow} ${p2}%, ${cYellow} ${p3}%,
          ${cRed}    ${p3}%, ${cRed}    100%)`;
      },
      classify: (v) => {
        if (v >= gmax * 0.66) return "warn";
        if (v >= wmin && v <= wmax) return "ideal";
        return "ok";
      },
    }
  );

  // --- Gust (derecha) ---
  const gTop = gmax * 1.3;
  paint(
    { zones: "wbvZonesGust", fill: "wbvFillGust", ticks: "wbvTicksGust", value: "wbvValueGust" },
    gustKmh,
    {
      top: gTop,
      tickAt: [gmax * 0.66, gmax],
      gradient: (pct) => {
        const p1 = pct(gmax * 0.66), p2 = pct(gmax);
        return `linear-gradient(to top,
          ${cGreen}  0%, ${cGreen}  ${p1}%,
          ${cYellow} ${p1}%, ${cYellow} ${p2}%,
          ${cRed}    ${p2}%, ${cRed}    100%)`;
      },
      classify: (v) => {
        if (v >= gmax) return "warn";
        if (v >= gmax * 0.66) return "ok";
        return "ideal";
      },
    }
  );
}

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

  // v0.201: marcadores de aviso en horas con racha > gustMax del despegue.
  const _crit201 = currentTakeoffCriteria || {};
  const _gmax201 = Number.isFinite(_crit201.gustMax) ? _crit201.gustMax : 30;
  const warnSize = Math.max(12, Math.round(forecastArrowSize() * 0.9));
  const warnIcon = makeWarnIcon(warnSize);
  const gustWarnData = dayKept.map(p => (Number.isFinite(p.gust) && p.gust > _gmax201) ? p.gust : null);

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
      // v0.201: aviso sobre la linea de racha cuando supera gustMax.
      { label: t("chart.gust_warn"), data: gustWarnData, type: "line", showLine: false,
        pointStyle: warnIcon, pointRadius: warnSize / 2,
        spanGaps: false },
    ],
  };
  const options = chartCommonOptions();
  // Para el pronóstico usamos eje categórico (sin huecos por horas nocturnas).
  options.scales = options.scales || {};
  const _Cfc = _chartThemeColors();
  options.scales.x = {
    type: "category",
    ticks: { color: _Cfc.tick, maxRotation: 0, autoSkipPadding: 12 },
    grid: { color: _Cfc.grid },
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
        if (ctx.dataset.label === t("chart.gust_warn")) {
          if (ctx.parsed.y == null) return null;
          return `⚠️ ${t("chart.gust_warn")}: ${fmtNum(ctx.parsed.y)} km/h (> ${_gmax201})`;
        }
        return `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)} km/h`;
      },
    },
  };

  if (forecastChart) { forecastChart.data = data; forecastChart.options = options; }
  else forecastChart = new Chart(ctx, { type: "line", data, options });
  forecastChart.$daySep = daySeparators;
  // v134: rango ideal de velocidad media segun criterios del despegue actual.
  {
    const c = currentTakeoffCriteria || {};
    const wmin = Number.isFinite(c.windMin) ? c.windMin : 5;
    const wmax = Number.isFinite(c.windMax) ? c.windMax : 15;
    const gmax = Number.isFinite(c.gustMax) ? c.gustMax : 30;
    forecastChart.$idealBand = { min: wmin, max: wmax, gustMax: gmax };
  }
  forecastChart.update();
  renderForecastLegend();
  renderForecastMiniCompass();

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
      <button type="button" class="snd-btn" data-ts="${times[i].getTime()}" title="${t("snd.btn_tip")}">📈 ${t("snd.btn")}</button>
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
    // v0.186: sin popup ("bocadillo"); solo la etiqueta permanente.
    .bindTooltip(String(currentTakeoff.name || "").replace(/^Despegue\s+/i, ""), {
      permanent: true, direction: "top", offset: [0, -8], className: "station-label takeoff"
    });
  const circle = L.circle([lat, lon], {
    radius: 50000, color: "#4ea1ff", weight: 1, fillOpacity: 0.05, dashArray: "4,4",
  }).addTo(map);
  takeoffMapLayers.push(marker, circle);
  // Asegura el reflow por si el contenedor cambió de tamaño y centra/panea suavemente.
  try { map.invalidateSize(); } catch {}
  // v145: ya no centramos en el despegue con un zoom fijo. Cuando renderNearby
  // termine llamara a fitMapToNearby() y el mapa quedara ajustado a las
  // estaciones mostradas. Mientras tanto, encuadre provisional al circulo de 50 km.
  map.fitBounds(circle.getBounds(), { padding: [30, 30], maxZoom: 11, animate: false });
}

// === Estaciones cercanas ===
// Cada estación tiene sus propios criterios de volabilidad (no los conocemos),
// así que mostramos solo la dirección y la intensidad media de las últimas horas.
const NEARBY_AVG_HOURS = 3;
let nearbyLatLngs = [];

function fitMapToNearby() {
  if (!map) return;
  const pts = [[currentTakeoff.lat, currentTakeoff.lon], ...nearbyLatLngs];
  if (pts.length < 2) return;
  const bounds = L.latLngBounds(pts);
  // Padding generoso para que las etiquetas (tooltips permanentes) no queden
  // recortadas. maxZoom alto permite acercarse cuando todas las estaciones
  // estan agrupadas; el minZoom lo gestiona Leaflet.
  map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true });
}

async function renderNearby() {
  const grid = document.getElementById("nearbyGrid");
  if (!grid) return;
  // v123: token de render para evitar duplicados cuando se disparan varios
  // renderNearby() en paralelo (selectStation + refresh + geolocate, etc.).
  // Si por el momento de pintar la version ha avanzado, abortamos.
  const myToken = (++_nearbyRenderToken);
  nearbyLatLngs = [];
  try {
    if (!currentTakeoff || !Number.isFinite(currentTakeoff.lat) || !Number.isFinite(currentTakeoff.lon)) {
      // Sin despegue seleccionado todavía: no mostramos error, solo placeholder.
      grid.innerHTML = `<div class="compare-loading">${t("near.none")}</div>`;
      return;
    }
    // v126: incluimos TODOS los feeds disponibles (Pioupiou + AEMET + Holfuy)
    // y descartamos cualquiera que no devuelva datos, pasando a la siguiente.
    const [allP, allA, allH] = await Promise.all([
      getAllStations().catch(() => []),
      getAllAemetStations().catch(() => []),
      getAllHolfuyStations().catch(() => []),
    ]);
    if (myToken !== _nearbyRenderToken) return;
    const now = Date.now();
    const c = { lat: currentTakeoff.lat, lon: currentTakeoff.lon };

    // Normaliza Pioupiou al mismo shape que AEMET/Holfuy.
    const pioupiouNorm = (allP || []).map(s => {
      const lat = s.location?.latitude, lon = s.location?.longitude;
      if (lat == null || lon == null) return null;
      return {
        provider: "pioupiou",
        id: "pioupiou_" + s.id,
        rawId: String(s.id),
        name: s.meta?.name || ("Pioupiou " + s.id),
        lat, lon,
        lastDate: s.measurements?.date || null,
        wind_speed_avg: s.measurements?.wind_speed_avg ?? null,
        wind_speed_max: s.measurements?.wind_speed_max ?? null,
        wind_heading: s.measurements?.wind_heading ?? null,
      };
    }).filter(Boolean);

    const pool = [...pioupiouNorm, ...(allA || []), ...(allH || [])];

    // Filtra: descarta estacion actual, descarta sin datos validos (sin viento
    // ni direccion) y descarta no recientes (>24h).
    const isCurrent = (n) => {
      if (currentStation?.provider === "pioupiou" && n.provider === "pioupiou") {
        return String(n.rawId) === String(currentStation.id);
      }
      if (n.provider === currentStation?.provider) {
        return String(n.rawId) === String(currentStation.id)
            || String(n.id)    === String(currentStation.id);
      }
      return false;
    };
    const candidates = pool
      .filter(n => Number.isFinite(n.lat) && Number.isFinite(n.lon))
      .filter(n => !isCurrent(n))
      .filter(n => n.wind_speed_avg != null || n.wind_heading != null)
      .filter(n => {
        if (!n.lastDate) return false;
        return (now - new Date(n.lastDate).getTime()) < 24 * 3600 * 1000;
      })
      .map(n => ({ ...n, dist: haversineKm(c.lat, c.lon, n.lat, n.lon) }))
      .sort((a, b) => a.dist - b.dist);

    // Radio adaptativo: buscamos minimo 4 entre todas las fuentes (incluyendo
    // METAR de aeropuertos) y maximo 8 visibles.
    const NEARBY_MIN = 4;
    const NEARBY_MAX = 8;
    const NEARBY_RADII = [50, 100, 200, 400, 800];
    const airportDists = METAR_AIRPORTS
      .map(a => haversineKm(c.lat, c.lon, a.lat, a.lon))
      .sort((a, b) => a - b);
    let nearbyRadius = NEARBY_RADII[0];
    for (const r of NEARBY_RADII) {
      const stCount = candidates.filter(x => x.dist <= r).length;
      const apCount = airportDists.filter(d => d <= r).length;
      nearbyRadius = r;
      if (stCount + apCount >= NEARBY_MIN) break;
    }
    _nearbyResolvedRadius = nearbyRadius;
    // v135: cribado AEMET — priorizamos no-AEMET (Pioupiou, Holfuy) por
    // cercanía y completamos con AEMET dispersas geograficamente (greedy
    // farthest-first respecto a las ya elegidas) para evitar clusters AEMET.
    const inRadius = candidates.filter(x => x.dist <= nearbyRadius);
    const nonAemet = inRadius.filter(x => x.provider !== "aemet");
    const aemet    = inRadius.filter(x => x.provider === "aemet");
    const picked = nonAemet.slice(0, NEARBY_MAX);
    const remaining = NEARBY_MAX - picked.length;
    if (remaining > 0 && aemet.length) {
      const pool = aemet.slice();
      // Distancia minima de cada candidata al conjunto ya escogido.
      const minDistTo = (cand, set) => {
        if (!set.length) return cand.dist; // si no hay seed, usa distancia al despegue
        let best = Infinity;
        for (const s of set) {
          const d = haversineKm(cand.lat, cand.lon, s.lat, s.lon);
          if (d < best) best = d;
        }
        return best;
      };
      for (let k = 0; k < remaining && pool.length; k++) {
        // Elige la que MAXIMIZA su distancia al conjunto ya escogido (dispersion).
        let bestIdx = 0, bestScore = -Infinity;
        for (let i = 0; i < pool.length; i++) {
          const s = minDistTo(pool[i], picked);
          if (s > bestScore) { bestScore = s; bestIdx = i; }
        }
        picked.push(pool.splice(bestIdx, 1)[0]);
      }
    }
    // Ordena el resultado final por distancia al despegue para presentarlas.
    const within = picked.sort((a, b) => a.dist - b.dist);
    _nearbyPioupiouCount = within.length;

    grid.innerHTML = "";
    if (!within.length) {
      grid.innerHTML = `<div class="compare-loading">${t("near.none")}</div>`;
      // No hacemos return: dejamos que METAR (aeropuertos) se anada despues.
    } else {

    // Pintar primero placeholders y marcadores en el mapa
    const cards = within.map((n) => {
      const card = document.createElement("div");
      card.className = "nearby-card";
      const linkOpen = n.provider === "pioupiou"
        ? `<a href="https://www.openwindmap.org/windbird-${n.rawId}" target="_blank" rel="noopener">`
        : `<span>`;
      const linkClose = n.provider === "pioupiou" ? `</a>` : `</span>`;
      const providerBadge = n.provider === "pioupiou" ? ""
        : ` <small class="nearby-provider">· ${n.provider.toUpperCase()}</small>`;
      card.innerHTML = `
        <h3>
          ${linkOpen}${escapeHtml(n.name)}${linkClose}
          <small>${n.dist.toFixed(1)} km</small>${providerBadge}
        </h3>
        <div class="mini-compass" data-station="${escapeHtml(n.id)}">
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
          <div class="nearby-ext"><a class="pc-action-btn" href="https://www.windy.com/-?${n.lat},${n.lon},11" target="_blank" rel="noopener"><span class="pc-action-btn-icon">🌬️</span><span class="pc-action-btn-label">Windy</span></a></div>
        </div>
      `;
      grid.appendChild(card);
      return { n, card };
    });

    // Marcadores en el mapa
    if (map) {
      for (const n of within) {
        nearbyLatLngs.push([n.lat, n.lon]);
        const popupBody = n.provider === "pioupiou"
          ? `<a href="https://www.openwindmap.org/windbird-${n.rawId}" target="_blank">${t("near.popup_view")}</a>`
          : `<small>${n.provider.toUpperCase()}</small>`;
        L.circleMarker([n.lat, n.lon], {
          radius: 6, color: "#fff", weight: 1, fillColor: "#4ea1ff", fillOpacity: 0.85,
        }).addTo(map)
          .bindPopup(
            `<b>${escapeHtml(n.name)}</b><br/>` +
            `${n.dist.toFixed(1)} km · ${t("near.popup_last")}: ${fmtTime(n.lastDate)}<br/>` +
            popupBody
          )
          .bindTooltip(n.name, {
            permanent: true, direction: "right", offset: [8, 0], className: "station-label"
          });
      }
    }

    // Carga datos por tarjeta: Pioupiou usa archive 3h; AEMET/Holfuy usan
    // snapshot. Si Pioupiou falla, cae al snapshot. Si tras todo no hay
    // datos, ocultamos la tarjeta (ya filtramos arriba pero por si acaso).
    const stop = new Date();
    const start = new Date(stop.getTime() - NEARBY_AVG_HOURS * 3600 * 1000);
    const fmt = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

    await Promise.all(cards.map(async ({ n, card }) => {
      let avgSpd = n.wind_speed_avg ?? null;
      let meanDir = n.wind_heading ?? null;
      if (n.provider === "pioupiou") {
        try {
          const url = `${API_BASE}/archive/${n.rawId}?start=${fmt(start)}&stop=${fmt(stop)}`;
          const data = await fetchJson(url);
          const arch = normalizeArchive(data?.data);
          if (arch?.date?.length) {
            const a = avgOf(arch.wind_speed_avg);
            const d = meanAngle(arch.wind_heading);
            if (a != null) avgSpd = a;
            if (d != null) meanDir = d;
          }
        } catch (e) {
          console.warn("nearby archive:", n.id, e);
        }
      }
      if (avgSpd == null && meanDir == null) {
        // sin datos: ocultar tarjeta
        card.remove();
        return;
      }
      const dirInfo = classifyDirection(meanDir);
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
    }));
    } // fin del else (habia estaciones cercanas con datos)
  } catch (e) {
    console.error("nearby:", e);
    grid.innerHTML = `<div class="compare-loading">${t("near.error")}</div>`;
  }

  // Anadir las estaciones METAR (aeropuertos) hasta completar 8.
  await renderMetarStations();
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
  const myToken = _nearbyRenderToken;
  // v125: usa el radio adaptativo de renderNearby (igual que Pioupiou).
  const c = { lat: currentTakeoff.lat, lon: currentTakeoff.lon };
  const NEARBY_MAX = 8;
  const remainingSlots = Math.max(0, NEARBY_MAX - (_nearbyPioupiouCount || 0));
  if (remainingSlots <= 0) return;
  const within = METAR_AIRPORTS
    .map(a => ({ ...a, dist: haversineKm(c.lat, c.lon, a.lat, a.lon) }))
    .filter(a => a.dist <= (_nearbyResolvedRadius || 50))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, remainingSlots);
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
  // v123: si entretanto se disparo otro renderNearby, abortamos para no duplicar.
  if (myToken !== _nearbyRenderToken) return;
  // v123: defensa extra: si ya hay tarjetas de aeropuerto en el grid (otra ronda
  // las pinto antes), no las volvemos a anadir.
  const existingIcaos = new Set(
    [...grid.querySelectorAll(".nearby-card.airport")]
      .map(el => el.dataset.icao)
      .filter(Boolean)
  );
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
    // v123: salta si ya hay una tarjeta para este aeropuerto.
    if (existingIcaos.has(ap.icao)) continue;
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
    card.dataset.icao = ap.icao;
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
      nearbyLatLngs.push([ap.lat, ap.lon]);
    }
  }
  // v145: una vez pintadas todas las estaciones cercanas (Pioupiou/AEMET/Holfuy
  // + aeropuertos METAR), ajustamos el zoom del mapa para que entren todas las
  // que se muestran en el panel "Estaciones cercanas".
  fitMapToNearby();
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

function maybeNotify(_verdict, _dirInfo, _avg, _max) {
  // v0.197: las alertas en vivo se han retirado a favor del aviso al amanecer
  // (ver checkSunriseAlerts). Mantenemos la funcion como no-op para no romper
  // la llamada desde refreshObservations.
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
    // v106: si el fetch falla, tratamos como "datos no disponibles" para no dejar
    // valores viejos en pantalla. El detalle del error queda en consola.
    renderLive(null);
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
// v0.189: delegacion para garantizar que el boton de refresh siempre
// responda, incluso si el listener directo no se enlaza por cualquier
// motivo (errores anteriores en el script, reordenacion del DOM, etc.).
// Tambien damos feedback visual girando el icono mientras refresca.
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#refreshBtn");
  if (!btn) return;
  if (btn.classList.contains("is-spinning")) return;
  btn.classList.add("is-spinning");
  const done = () => setTimeout(() => btn.classList.remove("is-spinning"), 500);
  try {
    const tasks = [
      Promise.resolve().then(() => refreshObservations()),
      Promise.resolve().then(() => refreshForecast()),
      Promise.resolve().then(() => renderCompare()),
      Promise.resolve().then(() => renderNearby()),
    ];
    Promise.allSettled(tasks).finally(done);
  } catch (err) {
    console.error("refresh failed", err);
    done();
  }
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
  es: "https://github.com/rcuevasuskar/hoy-se-vuela/blob/main/docs/es.md",
  en: "https://github.com/rcuevasuskar/hoy-se-vuela/blob/main/docs/en.md",
  de: "https://github.com/rcuevasuskar/hoy-se-vuela/blob/main/docs/en.md",
  fr: "https://github.com/rcuevasuskar/hoy-se-vuela/blob/main/docs/en.md",
  ca: "https://github.com/rcuevasuskar/hoy-se-vuela/blob/main/docs/es.md",
  eu: "https://github.com/rcuevasuskar/hoy-se-vuela/blob/main/docs/es.md",
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

// v147: "Anadir despegue" abre el formulario en blanco (sin prefill desde el
// despegue actual). Requiere usuario autenticado no anonimo.
// v179: el boton vive ahora en la topbar (junto al input del buscador) con id
// tsAddTakeoffBtn. Antes estaba dentro del menu de usuario como addTakeoffBtn.
document.getElementById("tsAddTakeoffBtn")?.addEventListener("click", () => {
  const u = window.PCAuth?.user;
  if (!u || u.isAnonymous) { alert(t("to.submit_login")); return; }
  openTakeoffSubmit({});
});

// v147: geocodificador (OSM Nominatim) que rellena lat/lon en el formulario
// de alta de despegue. Sin clave; respetamos el User-Agent recomendado.
async function geocodeAddress(query) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { "Accept-Language": currentLang || "es" } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { console.warn("[geocode]", e); return []; }
}

document.getElementById("toGeocodeBtn")?.addEventListener("click", async () => {
  const inp = document.getElementById("toGeocodeInput");
  const out = document.getElementById("toGeocodeResults");
  if (!inp || !out) return;
  out.hidden = false;
  out.innerHTML = `<div class="to-geocode-loading">${t("loading")}</div>`;
  const items = await geocodeAddress(inp.value);
  if (!items.length) {
    out.innerHTML = `<div class="to-geocode-empty">${t("to.geocode_empty")}</div>`;
    return;
  }
  out.innerHTML = "";
  for (const it of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-geocode-item";
    btn.innerHTML = `<b>${escapeHtml(it.display_name || "")}</b><br/><small>${Number(it.lat).toFixed(5)}, ${Number(it.lon).toFixed(5)}</small>`;
    btn.addEventListener("click", () => {
      document.getElementById("toLat").value = Number(it.lat).toFixed(5);
      document.getElementById("toLon").value = Number(it.lon).toFixed(5);
      const nameEl = document.getElementById("toName");
      if (nameEl && !nameEl.value) {
        // Toma la primera parte del display_name (la mas especifica) como sugerencia.
        nameEl.value = String(it.display_name || "").split(",")[0].trim();
      }
      out.hidden = true;
      // Resetea la seleccion de estacion y recarga el desplegable con las
      // estaciones cercanas a las nuevas coordenadas.
      _toClearStationRef();
      _toLoadStationsForCoords();
    });
    out.appendChild(btn);
  }
});
document.getElementById("toGeocodeInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("toGeocodeBtn")?.click(); }
});

// v180: estacion de referencia opcional. La elegimos de un <select> que
// se rellena automaticamente con todas las estaciones (cualquier proveedor)
// dentro de 30 km de las coordenadas del formulario, ordenadas por distancia.
// Si el usuario deja la opcion vacia "Sin estacion", se respeta y el despegue
// caera a las URLs de Windy/Volandoo o a la estimacion de Windy para la
// ubicacion.
function _toClearStationRef() {
  const sel = document.getElementById("toStationId");
  if (sel && sel.tagName === "SELECT") { sel.value = ""; delete sel.dataset.pendingValue; }
}
async function _toLoadStationsForCoords({ keepValue = false } = {}) {
  const sel = document.getElementById("toStationId");
  if (!sel || sel.tagName !== "SELECT") return;
  const lat = parseFloat(document.getElementById("toLat")?.value);
  const lon = parseFloat(document.getElementById("toLon")?.value);
  // v182: "prev" puede venir de tres sitios: la seleccion actual del usuario,
  // o un dataset.pendingValue depositado por openTakeoffSubmit al editar
  // (porque al asignar <select>.value cuando el option aun no existia, no se
  // queda "pegado"). Tomamos el primero que tenga contenido.
  const pending = sel.dataset.pendingValue || "";
  const prev = keepValue ? (sel.value || pending) : "";
  // Recrea opciones, conservando siempre "Sin estacion" como primera.
  while (sel.options.length > 1) sel.remove(1);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  try {
    const all = await ensureAllStations();
    const flat = [];
    for (const s of (all.pioupiou || [])) {
      const ss = stationFromPioupiou(s); if (!ss) continue;
      flat.push({ id: ss.id, provider: "pioupiou", name: ss.name, lat: ss.lat, lon: ss.lon,
                  dist: haversineKm(lat, lon, ss.lat, ss.lon) });
    }
    for (const s of (all.aemet || [])) {
      if (s?.lat == null || s?.lon == null) continue;
      flat.push({ id: s.id || ("aemet_" + s.idema), provider: "aemet",
                  name: s.name || s.ubi || s.idema, lat: s.lat, lon: s.lon,
                  dist: haversineKm(lat, lon, s.lat, s.lon) });
    }
    for (const s of (all.holfuy || [])) {
      if (s?.lat == null || s?.lon == null) continue;
      flat.push({ id: s.id || ("holfuy_" + s.rawId), provider: "holfuy",
                  name: s.name || ("Holfuy " + s.id), lat: s.lat, lon: s.lon,
                  dist: haversineKm(lat, lon, s.lat, s.lon) });
    }
    const within = flat.filter(s => s.dist <= 30).sort((a, b) => a.dist - b.dist).slice(0, 50);
    for (const s of within) {
      const opt = document.createElement("option");
      opt.value = String(s.id);
      opt.textContent = `${s.name} · ${s.provider} · ${s.dist.toFixed(1)} km`;
      sel.appendChild(opt);
    }
    // Si la seleccion previa sigue siendo valida la conservamos; si no, "Sin estacion".
    if (keepValue && prev && Array.from(sel.options).some(o => o.value === prev)) {
      sel.value = prev;
    } else if (keepValue && prev) {
      // El prev no aparece en el rango. Lo anadimos como opcion sintetica
      // (estacion guardada previamente que ya no esta en el listado, para no
      // perder el dato al editar).
      const opt = document.createElement("option");
      opt.value = prev;
      opt.textContent = `${prev} (fuera de 30 km)`;
      sel.appendChild(opt);
      sel.value = prev;
    }
    // Pending consumido: limpia el dataset para que un cambio posterior de
    // coordenadas no vuelva a reaplicar el id viejo.
    delete sel.dataset.pendingValue;
  } catch (e) {
    console.warn("[to] load stations", e);
  }
}

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
  // v125: recomputa el titulo "Pronostico para <nombre>" tras cambiar idioma.
  if (typeof applyCurrentTakeoffLabel === "function") applyCurrentTakeoffLabel();
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
// v123: token global para abortar renders concurrentes de "estaciones cercanas".
let _nearbyRenderToken = 0;
// v125: radio adaptativo resuelto en renderNearby y cuantas Pioupiou se pintaron,
// para que renderMetarStations complete hasta 8 totales con aeropuertos.
let _nearbyResolvedRadius = 50;
let _nearbyPioupiouCount = 0;
let tsRadius = parseInt(localStorage.getItem("tsRadius") || "50", 10);
let tsNoRadius = localStorage.getItem("tsNoRadius") === "1";

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
  renderLiveSource(null);
  renderWindBarVertical(null, null);
  refreshObservations();
  refreshForecast();
  renderCompare();
  renderNearby();
}

function applyCurrentTakeoffLabel() {
  const baseName = currentStation.shortName || currentStation.name || "";
  // v120: incluye la altura del despegue cuando esta disponible.
  const doc = (typeof getCurrentTakeoffDoc === "function") ? getCurrentTakeoffDoc() : null;
  const altSrc = doc?.alt ?? currentTakeoff.alt ?? null;
  const altLabel = Number.isFinite(+altSrc) ? ` · ${Math.round(+altSrc)} m` : "";
  const el = document.getElementById("tsCurrentName");
  if (el) el.textContent = baseName + altLabel;
  const guideEl = document.getElementById("guideTakeoffName");
  if (guideEl) guideEl.textContent = baseName + altLabel;
  // v125: el titulo del pronostico incluye el nombre del despegue.
  const fcTitleEl = document.getElementById("forecastTitleText");
  if (fcTitleEl && baseName) fcTitleEl.textContent = t("fc.title_for", { name: baseName });
  renderCurrentTakeoffActions();
  renderTakeoffPanel();
  updatePanelForLabels();
  // v0.211: si el panel de Live XC esta visible, actualizalo al nuevo despegue.
  try {
    const xp = document.getElementById("liveXcPanel");
    if (xp && !xp.hidden) renderLiveXcPanel();
  } catch {}
}

// v102: muestra en cada panel qué despegue / estación se está usando
function updatePanelForLabels() {
  // getCurrentTakeoffDoc llama a resolveCurrentTakeoffOrigin internamente.
  const doc = (typeof getCurrentTakeoffDoc === "function") ? getCurrentTakeoffDoc() : null;
  const stName = currentStation?.shortName || currentStation?.name || "";
  // v118: anade " · 81 m" al nombre del despegue cuando hay altitud disponible.
  const altSrc = doc?.alt ?? currentTakeoff.alt ?? null;
  const altLabel = Number.isFinite(+altSrc) ? ` · ${Math.round(+altSrc)} m` : "";
  const toName = doc?.name ? (doc.name + altLabel) : null;
  const text = toName && toName !== stName
    ? t("panel.for_to_st", { to: toName, st: stName })
    : t("panel.for_st", { st: stName });
  const suffix = getCurrentOverride() ? " · " + t("co.active") : "";
  ["panelFor", "panelForBlock"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text + suffix;
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
  // v135: recalcula barra vertical y mini-brujula del grafico con los criterios actuales
  renderWindBarVertical(latestLive?.measurements?.wind_speed_avg ?? null, latestLive?.measurements?.wind_speed_max ?? null);
  renderForecastMiniCompass();
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
  let fav = null;
  if (currentTakeoffOriginId) {
    fav = favs.find(f => f.source === "community" && f.refId === currentTakeoffOriginId);
  } else if (currentStation?.provider === "pioupiou") {
    fav = favs.find(f => f.source === "pioupiou" && String(f.refId) === String(currentStationId));
  } else if (currentStation?.provider === "ffvl") {
    fav = favs.find(f => f.source === "ffvl" && String(f.refId) === String(currentStation.rawId || currentStationId));
  }
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

  // v184: la corona "despegue habitual" (homeFavId) se elimina; los
  // favoritos del usuario se ordenan por distancia a su posicion actual y el
  // despegue por defecto al abrir la app es el favorito mas cercano.
  // 🔔 alertas (solo si ya es favorito)
  if (fav) {
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

  // v162: los iconos que disparan acciones (abren un dialogo o navegan a una
  // pagina externa) se agrupan en un menu desplegable "⋮" con etiqueta corta
  // (1-3 palabras) para liberar espacio en la cabecera. Los toggles (★ ♛ 🔔)
  // se mantienen inline como botones rapidos.
  const actions = []; // { icon, label, run, isActive }

  // ✎ sugerir cambios / proponer alta.
  actions.push({
    icon: "✎",
    label: currentTakeoffOriginId ? t("to.suggest") : t("to.propose"),
    run: () => {
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
    },
  });

  // 🛠 mis criterios (override personal). v165: oculto tras feature flag.
  if (FEATURE_PERSONAL_OVERRIDE && _overrideKeyForCurrent()) {
    const hasOv = !!getCurrentOverride();
    actions.push({
      icon: "🛠",
      label: t("co.btn"),
      run: openCriteriaOverride,
      isActive: hasOv,
    });
  }

  const doc2 = (typeof getCurrentTakeoffDoc === "function") ? getCurrentTakeoffDoc() : null;
  const lat = Number(currentTakeoff.lat), lon = Number(currentTakeoff.lon);
  // v153: por defecto el botón de Windy abre el panel de "sounding".
  const soundingHref = (Number.isFinite(lat) && Number.isFinite(lon))
    ? `https://www.windy.com/sounding/${lat.toFixed(3)}/${lon.toFixed(3)}?iconEu,900h,${lat.toFixed(3)},${lon.toFixed(3)},11,p:wind`
    : null;
  const windyHref = (doc2?.windyUrl && /^https?:/i.test(doc2.windyUrl))
    ? doc2.windyUrl
    : soundingHref;
  // v168: orden solicitado: ✎ Editar, 📈 Sondeo, 🌬️ Abrir Windy, 🪶 Volandoo.
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    actions.push({
      icon: "📈",
      label: "Sondeo",
      run: () => openSounding(Date.now()),
    });
  }
  if (windyHref) {
    actions.push({ icon: "🌬️", label: "Abrir Windy", href: windyHref });
  }
  if (doc2?.volandooUrl && /^https?:/i.test(doc2.volandooUrl)) {
    actions.push({ icon: "🪶", label: "Volandoo", href: doc2.volandooUrl });
  }
  // v0.211: panel con el mapa en vivo de XContest (lazy-loaded en iframe).
  actions.push({
    icon: "🪂",
    label: "Live XC",
    run: () => toggleLiveXcPanel(),
    isActive: !!(document.getElementById("liveXcPanel") && !document.getElementById("liveXcPanel").hidden),
  });
  // v0.188: la brujula ya no es un chip; se renderiza como toggle (interruptor)
  // a la izquierda del todo de la barra de acciones, dentro del footer.

  // v167: las acciones (✎ Editar, 🌬️ Windy, 📈 Sondeo, 🪶 Volandoo) ya no van
  // en un menu desplegable de la cabecera; se renderizan inline en el footer
  // junto a "Ultima lectura". El contenedor #tsActionsInline existe en
  // index.html. Si por alguna razon no esta, no renderizamos nada.
  // v0.186: sin etiqueta "Acciones:"; los chips hablan por si mismos.
  const inlineHost = document.getElementById("tsActionsInline");
  if (inlineHost) {
    inlineHost.innerHTML = "";
    // v0.188: toggle de brujula leftmost, estilo "Sin limite".
    const compassLabel = document.createElement("label");
    compassLabel.className = "ts-no-radius ts-compass-toggle";
    compassLabel.title = t("act.orient_toggle") || "Modo Brújula";
    compassLabel.innerHTML = `
      <span class="ts-compass-ico" aria-hidden="true">🧭</span>
      <input type="checkbox" id="tsCompassToggle" ${orientationEnabled ? "checked" : ""} />
      <span class="ts-switch" aria-hidden="true"></span>
    `;
    inlineHost.appendChild(compassLabel);
    const compassInput = compassLabel.querySelector("#tsCompassToggle");
    compassInput?.addEventListener("change", async () => {
      if (compassInput.checked) {
        const ok = await enableDeviceOrientation();
        if (!ok) compassInput.checked = false;
      } else {
        disableDeviceOrientation();
      }
    });

    if (actions.length) {
      actions.forEach((a) => {
        const it = (a.href) ? document.createElement("a") : document.createElement("button");
        it.className = "ts-action-chip pc-action-btn" + (a.isActive ? " is-active" : "");
        if (a.href) { it.href = a.href; it.target = "_blank"; it.rel = "noopener"; }
        else { it.type = "button"; }
        it.title = a.label;
        it.innerHTML = `<span class="pc-action-btn-icon">${a.icon}</span><span class="pc-action-btn-label">${escapeHtml(a.label)}</span>`;
        if (a.run) it.addEventListener("click", a.run);
        inlineHost.appendChild(it);
      });
      inlineHost.hidden = false;
    } else {
      // v0.188: aunque no haya chips, mantenemos visible la barra para el
      // toggle de brujula que siempre se inyecta al principio.
      inlineHost.hidden = false;
    }
  }
}

// v0.211: panel desplegable con el mapa en vivo de XContest.
// El iframe se inyecta perezosamente (solo al abrir el panel por primera
// vez) para no penalizar la carga inicial. Al cambiar de despegue se
// actualiza el texto del titulo y se recarga el iframe si esta visible.
function toggleLiveXcPanel(forceState) {
  const panel = document.getElementById("liveXcPanel");
  if (!panel) return;
  const willOpen = (typeof forceState === "boolean") ? forceState : panel.hidden;
  panel.hidden = !willOpen;
  if (willOpen) {
    renderLiveXcPanel();
    // Scroll suave hacia el panel para que se vea tras abrirlo.
    try { panel.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch {}
  }
  // Refresca el estado activo del chip.
  try { renderCurrentTakeoffActions(); } catch {}
}

function renderLiveXcPanel() {
  const panel = document.getElementById("liveXcPanel");
  if (!panel || panel.hidden) return;
  const frameHost = document.getElementById("liveXcFrame");
  const titleEl = document.getElementById("liveXcTitle");
  const openA = document.getElementById("liveXcOpen");
  const noteEl = document.getElementById("liveXcNote");
  const lat = Number(currentTakeoff?.lat);
  const lon = Number(currentTakeoff?.lon);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
  const toName = currentStation?.shortName || currentStation?.name || currentTakeoff?.name || "";
  if (titleEl) titleEl.textContent = toName
    ? `Vuelos en directo · ${toName}`
    : "Vuelos en directo · XContest";
  // El enlace externo siempre apunta a live.xcontest.org (con hash informativo
  // del despegue para que XContest lo respete si en algun momento soporta esos
  // parametros; hoy se ignoran sin romper nada).
  const ext = hasCoords
    ? `https://live.xcontest.org/#lat=${lat.toFixed(4)}@lon=${lon.toFixed(4)}@zoom=11`
    : "https://live.xcontest.org/";
  if (openA) openA.href = ext;
  if (noteEl) {
    noteEl.innerHTML = hasCoords
      ? `Centra el mapa en <strong>${escapeHtml(toName || "el despegue")}</strong> (${lat.toFixed(3)}, ${lon.toFixed(3)}). Si XContest pide tu ubicación, acéptala para ver pilotos cercanos; si no, usa el zoom del mapa.`
      : `Mapa global de XContest. Selecciona un despegue para ver una posición de referencia.`;
  }
  if (frameHost) {
    // Inyecta el iframe la primera vez o si cambio el despegue.
    const currentSrc = frameHost.firstElementChild?.src || "";
    if (currentSrc !== ext) {
      frameHost.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.src = ext;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.allow = "geolocation; fullscreen";
      iframe.title = "XContest Live";
      frameHost.appendChild(iframe);
    }
  }
}

// v0.211: cableado del boton de cierre del panel Live XC (una sola vez).
(function initLiveXcPanel() {
  const wire = () => {
    const btn = document.getElementById("liveXcClose");
    if (btn && !btn.dataset.wired) {
      btn.dataset.wired = "1";
      btn.addEventListener("click", () => toggleLiveXcPanel(false));
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire, { once: true });
  } else {
    wire();
  }
})();

function openTakeoffSuggest(originId) {
  const to = (window.PCAuth?.approvedTakeoffs || []).find(x => x.id === originId);
  if (!to) { alert(t("to.suggest_notfound")); return; }
  _suggestTargetId = originId;
  openTakeoffSubmit({
    _suggesting: true,
    name: to.name, lat: to.lat, lon: to.lon, alt: to.alt,
    orientations: to.orientations || "",
    notes: to.notes || "",
    windyUrl: to.windyUrl || "",
    volandooUrl: to.volandooUrl || "",
    // v166: pasamos tambien el stationId para que el form lo preserve. Antes
    // se enviaba null al hacer submit, lo que orfanaba el doc de su estacion
    // y al recargar el resolver no podia encontrarlo por stationId (caia a
    // resolucion por nombre/proximidad y podia enganchar un doc distinto con
    // los valores viejos).
    stationId: to.stationId ?? null,
    criteria: to.criteria || null,
  });
  const title = document.getElementById("toTitle"); if (title) title.textContent = t("to.suggest_title");
  const sb = document.getElementById("toSubmitBtn"); if (sb) sb.textContent = t("to.suggest_submit");
  // v110: solo admins pueden borrar un despegue existente; se muestra en modo "Sugerir cambios".
  const delBtn = document.getElementById("toDeleteBtn");
  if (delBtn) delBtn.hidden = !window.PCAuth?.isAdmin;
}
let _suggestTargetId = null;

function resolveCurrentTakeoffOrigin() {
  // v168: el id del documento de despegue es la clave unica. Si ya esta fijado
  // (porque el usuario eligio el despegue en busqueda/favoritos), respetamos esa
  // identidad y NO intentamos resolver por estacion/nombre/proximidad, que podria
  // enganchar un doc distinto (p.ej. duplicado) y romper el ciclo de edicion.
  if (currentTakeoff.id) return;
  const list = window.PCAuth?.approvedTakeoffs || [];
  if (!list.length) return;
  // 1) Coincidencia por stationId (solo si es 1:1, sin ambiguedad).
  if (currentStationId != null) {
    const byStation = list.filter(t => t.stationId != null && Number(t.stationId) === Number(currentStationId));
    if (byStation.length === 1) { _attachTakeoffDoc(byStation[0]); return; }
  }
  // 2) Coincidencia por nombre (case-insensitive, trim). Solo si es unica.
  const curName = (currentStation?.name || currentTakeoff?.name || "").trim().toLowerCase();
  if (curName) {
    const byName = list.filter(t => (t.name || "").trim().toLowerCase() === curName);
    if (byName.length === 1) { _attachTakeoffDoc(byName[0]); return; }
  }
  // 3) Coincidencia por coordenadas: despegue comunitario mas cercano dentro de
  // 3 km (v101). v168: requerimos que sea claramente el mas cercano (margen 1km
  // sobre el segundo) para evitar enganchar el doc equivocado.
  const lat = currentTakeoff?.lat, lon = currentTakeoff?.lon;
  if (lat == null || lon == null) return;
  let bestT = null, bestKm = Infinity, secondKm = Infinity;
  for (const t of list) {
    if (!Number.isFinite(t.lat) || !Number.isFinite(t.lon)) continue;
    const km = haversineKm(lat, lon, t.lat, t.lon);
    if (km < bestKm) { secondKm = bestKm; bestKm = km; bestT = t; }
    else if (km < secondKm) { secondKm = km; }
  }
  if (bestT && bestKm <= 3 && (secondKm - bestKm) >= 1) _attachTakeoffDoc(bestT);
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
  // v149: URLs externas que getLive() usa para sacar la lectura en tiempo real.
  currentTakeoff.windyUrl = doc.windyUrl || "";
  currentTakeoff.volandooUrl = doc.volandooUrl || "";
  // Aliases compat
  currentTakeoffOriginId = doc.id;
  currentTakeoffCriteria = doc.criteria || null;
  applyCurrentOverride();
}

// v104: override personal de criterios por despegue. Se guarda en localStorage
// + prefs del usuario (PCAuth). Se aplica automáticamente al cargar/cambiar takeoff.
const USER_OVERRIDES_KEY = "takeoffOverrides";
let userTakeoffOverrides = (function loadUserOverrides() {
  try {
    const raw = localStorage.getItem(USER_OVERRIDES_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch {}
  return {};
})();
function _saveUserOverrides() {
  try { localStorage.setItem(USER_OVERRIDES_KEY, JSON.stringify(userTakeoffOverrides)); } catch {}
  window.PCAuth?.savePref?.(USER_OVERRIDES_KEY, JSON.stringify(userTakeoffOverrides));
}
function _overrideKeyForCurrent() {
  if (currentTakeoff?.id) return "to:" + currentTakeoff.id;
  if (currentStation?.provider && currentStationId != null) return currentStation.provider + ":" + currentStationId;
  return null;
}
// v106: devuelve TODAS las claves posibles bajo las que puede haberse guardado
// un override para el contexto actual. Necesario porque resolveCurrentTakeoffOrigin
// puede enganchar un doc comunitario (≤3 km) DESPUÉS de guardar un override por estación,
// haciendo que la clave cambie de "aemet:1234" a "to:<docId>".
function _overrideKeysForCurrent() {
  const keys = [];
  if (currentTakeoff?.id) keys.push("to:" + currentTakeoff.id);
  if (currentStation?.provider && currentStationId != null) keys.push(currentStation.provider + ":" + currentStationId);
  return keys;
}
function getCurrentOverride() {
  if (!FEATURE_PERSONAL_OVERRIDE) return null; // v165: feature desactivada.
  for (const k of _overrideKeysForCurrent()) {
    if (userTakeoffOverrides[k]) return userTakeoffOverrides[k];
  }
  return null;
}
function applyCurrentOverride() {
  const ov = getCurrentOverride();
  if (!ov) return false;
  currentTakeoff.criteria = ov;
  currentTakeoffCriteria = ov;
  return true;
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
      windyUrl: takeoff.windyUrl || "",
      volandooUrl: takeoff.volandooUrl || "",
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
      windyUrl: "",
      volandooUrl: "",
    };
  }
  currentTakeoffOriginId = currentTakeoff.id;
  currentTakeoffCriteria = currentTakeoff.criteria;
  applyCurrentOverride();
}

function selectStation(station, opts) {
  if (opts && opts.userPicked) _userPickedStation = true;
  // Si llega un opts.takeoff explícito (click en despegue comunitario),
  // lo usamos como lugar; si no, sintetizamos uno a partir de la estación.
  let takeoff = (opts && opts.takeoff) ? opts.takeoff
                 : (opts && (opts.originId || opts.criteria))
                   ? {
                       id: opts.originId || null,
                       name: station.name,
                       shortName: station.shortName || station.name,
                       lat: station.lat, lon: station.lon,
                       criteria: opts.criteria || null,
                     }
                   : null;
  // v152: cuando solo tenemos el originId, completamos con el doc comunitario
  // aprobado para no perder URLs externas (volandooUrl/windyUrl), notas, etc.
  // v174: PRIORIZAMOS el doc fresco de approvedTakeoffs sobre los valores que
  // nos llegan en `takeoff` (que pueden venir cacheados de un render anterior
  // del buscador). Antes hacia `takeoff.criteria || doc.criteria`, lo que
  // dejaba la criteria vieja si el callsite la pasaba.
  if (takeoff && takeoff.id) {
    const doc = (window.PCAuth?.approvedTakeoffs || []).find(t => t.id === takeoff.id);
    if (doc) {
      takeoff = {
        ...takeoff,
        name: doc.name || takeoff.name,
        shortName: doc.shortName || doc.name || takeoff.shortName,
        lat: doc.lat ?? takeoff.lat,
        lon: doc.lon ?? takeoff.lon,
        alt: doc.alt ?? takeoff.alt ?? null,
        orientations: doc.orientations || takeoff.orientations || "",
        notes: doc.notes || takeoff.notes || "",
        windyUrl: doc.windyUrl || takeoff.windyUrl || "",
        volandooUrl: doc.volandooUrl || takeoff.volandooUrl || "",
        criteria: doc.criteria || takeoff.criteria || null,
      };
    }
  }
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
    // v125: snapshot meteorologico actual (si la estacion lo expone) para
    // poder calcular el verdict del despegue en el buscador.
    wind_speed_avg: s.measurements?.wind_speed_avg ?? null,
    wind_speed_max: s.measurements?.wind_speed_max ?? null,
    wind_heading: s.measurements?.wind_heading ?? null,
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

  // v179: el buscador solo lista despegues registrados en Comunidad.
  // Los chips de proveedores (Pioupiou/AEMET/Holfuy) y el switch Favoritos
  // han desaparecido. Los favoritos del usuario salen siempre arriba.
  // Las estaciones no asociadas a un despegue de la comunidad no se muestran.

  // findLinkedStation sigue siendo necesario para autovincular el despegue a
  // la estacion de viento mas cercana (cualquier proveedor) al hacer click.
  const LINK_KM = 30;
  const pools = [
    (all.pioupiou || []).map(stationFromPioupiou).filter(Boolean),
    (all.aemet || []),
    (all.holfuy || []),
  ];
  // v181: si el despegue tiene un stationId explicito (cualquier proveedor),
  // intentamos resolverlo en los pools antes de caer al "mas cercano".
  const findStationById = (id) => {
    if (id == null || id === "") return null;
    const key = String(id);
    for (const pool of pools) {
      for (const st of pool) {
        if (String(st.id) === key) return st;
      }
    }
    return null;
  };
  const findLinkedStation = (lat, lon, explicitId) => {
    const explicit = findStationById(explicitId);
    if (explicit) return explicit;
    let best = null, bestKm = LINK_KM + 1;
    let bestRecent = null, bestRecentKm = LINK_KM + 1;
    for (const pool of pools) {
      for (const st of pool) {
        if (!Number.isFinite(st.lat) || !Number.isFinite(st.lon)) continue;
        const km = haversineKm(lat, lon, st.lat, st.lon);
        if (km < bestKm) { bestKm = km; best = st; }
        if (isStationRecent(st, 24) && km < bestRecentKm) { bestRecentKm = km; bestRecent = st; }
      }
    }
    return bestRecent || best;
  };

  // Lista comunitaria: todos los despegues aprobados dentro del radio,
  // filtrados por la query y ordenados por distancia.
  const community = (window.PCAuth?.approvedTakeoffs || []).map(to => {
    const link = findLinkedStation(to.lat, to.lon, to.stationId);
    return {
      id: "to_" + to.id,
      provider: "community",
      name: to.name,
      lat: to.lat, lon: to.lon,
      alt: Number.isFinite(+to.alt) ? +to.alt : null,
      community: true,
      stationId: link?.id ?? to.stationId ?? null,
      _linkedStation: link,
      raw: to,
      dist: haversineKm(center.lat, center.lon, to.lat, to.lon),
    };
  })
    .filter(s => s.dist <= maxDist)
    .filter(s => !query || s.name.toLowerCase().includes(query))
    .sort((a, b) => a.dist - b.dist);

  // Identifica favoritos (solo comunitarios; el resto ya no se usa).
  const favs = window.PCAuth?.favorites || [];
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

  // Favoritos: siempre arriba, sin filtro de radio. Solo se muestran los
  // comunitarios (las estaciones sueltas ya no aparecen en el buscador).
  // v111: limpia favoritos huerfanos (despegue eliminado por admin).
  const approvedCommunityIds = new Set((window.PCAuth?.approvedTakeoffs || []).map(t => t.id));
  const approvedCommunityById = (id) => (window.PCAuth?.approvedTakeoffs || []).find(t => t.id === id) || null;
  const staleCommunityFavs = favs.filter(f => f.source === "community" && !approvedCommunityIds.has(f.refId));
  if (staleCommunityFavs.length && window.PCAuth?.removeFavorite) {
    staleCommunityFavs.forEach(f => {
      window.PCAuth.removeFavorite(f.id).catch(e => console.warn("[fav] cleanup stale", e));
    });
  }
  const favItems = favs
    .filter(f => f.source === "community" && approvedCommunityIds.has(f.refId))
    .map(f => {
      const doc = approvedCommunityById(f.refId);
      const fakeItem = {
        id: "to_" + f.refId,
        provider: "community",
        name: f.name,
        lat: f.lat, lon: f.lon,
        community: true,
        stationId: f.stationId,
        alt: Number.isFinite(+doc?.alt) ? +doc.alt : null,
        raw: { id: f.refId, criteria: f.criteria, stationId: f.stationId, alt: doc?.alt ?? null },
        dist: haversineKm(center.lat, center.lon, f.lat, f.lon),
        _fav: f,
      };
      fakeItem._linkedStation = findLinkedStation(f.lat, f.lon);
      return fakeItem;
    })
    .filter(f => !query || f.name.toLowerCase().includes(query));
  // v181: favoritos ordenados por distancia a la posicion actual del usuario
  // (igual criterio que la lista comunitaria de abajo).
  favItems.sort((a, b) => a.dist - b.dist);

  // Quita de la lista comunitaria los que ya estan en favoritos para no duplicar.
  const favKeys = new Set(favItems.map(f => favKey(f)));
  const others = community.filter(s => !favKeys.has(favKey(s))).slice(0, 50);

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
    for (const s of favItems) resultsEl.appendChild(renderSearchRow(s, { loggedIn, favByKey, favKey }));
  }
  if (others.length) {
    if (favItems.length) {
      const h2 = document.createElement("div");
      h2.className = "ts-section-header";
      h2.textContent = t("fav.others");
      resultsEl.appendChild(h2);
    }
    for (const s of others) resultsEl.appendChild(renderSearchRow(s, { loggedIn, favByKey, favKey }));
  }
}

function renderSearchRow(s, ctx) {
  const isCommunity = !!s.community;
  const isFfvl = s.provider === "ffvl";
  const isAemet = s.provider === "aemet";
  const isHolfuy = s.provider === "holfuy";
  const enabled = isCommunity ? !!s._linkedStation
                  : isFfvl ? false
                  // v112: AEMET/Holfuy aparecen "proximamente" igual que Pioupiou hasta
                  // que un admin cree/edite un despegue comunitario que las referencie.
                  : (isAemet || isHolfuy) ? false
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
    // v112: AEMET deshabilitado por defecto -> "proximamente" + badge proveedor.
    tail = `<span class="ts-result-provider aemet">AEMET</span><span class="ts-result-soon">${t("ts.coming_soon")}</span>`;
  } else if (isHolfuy) {
    tail = `<span class="ts-result-provider holfuy">Holfuy</span><span class="ts-result-soon">${t("ts.coming_soon")}</span>`;
  } else if (enabled) {
    tail = `<span class="ts-result-provider">${s.provider}</span>`;
  } else {
    tail = `<span class="ts-result-soon">${t("ts.coming_soon")}</span>`;
  }
  btn.innerHTML = `
    <span class="ts-result-name">${escapeHtml(s.name)}${Number.isFinite(+s.alt) ? ` <span class="ts-result-alt">· ${Math.round(+s.alt)} m</span>` : ""}</span>
    <span class="ts-result-dist">${s.dist.toFixed(1)} km</span>
    ${tail}
  `;
  // v125: borde izquierdo coloreado segun verdict actual.
  // Aplica a TODOS los items selectables cuando hay criterios y datos meteo.
  try {
    let verdict = "unknown";
    // 1) Despegue comunitario: usa sus propios criterios si existen; si no,
    //    cae a los del despegue actual o a los valores neutros por defecto.
    //    La fuente de viento prioriza Volandoo (si el doc tiene volandooUrl)
    //    y, en su defecto, la estación integrada vinculada (AEMET/Holfuy).
    if (isCommunity) {
      let snap = null;
      const vUrl = s.raw?.volandooUrl;
      if (vUrl) {
        const vsnap = _volandooSnapCached(vUrl);
        if (vsnap && (vsnap.avg != null || vsnap.dir != null)) snap = vsnap;
      }
      if (!snap && s._linkedStation) {
        const link = s._linkedStation;
        const ls = {
          avg: link.wind_speed_avg ?? null,
          max: link.wind_speed_max ?? null,
          dir: link.wind_heading ?? null,
        };
        if (ls.avg != null || ls.dir != null) snap = ls;
      }
      // v158: ultimo recurso para que despegues como Pegalajar (sin volandooUrl
      // y sin estacion vinculada con datos) tambien muestren borde de color.
      if (!snap && Number.isFinite(s.lat) && Number.isFinite(s.lon)) {
        const om = _omNowSnapCached(s.lat, s.lon);
        if (om && (om.avg != null || om.dir != null)) snap = om;
      }
      if (snap) {
        const crit = s.raw?.criteria || currentTakeoffCriteria || null;
        verdict = takeoffVerdictFromSnapshot(crit, snap);
      }
    }
    // 2) Pioupiou habilitada: sin criterios propios, usamos los del despegue
    //    actual para dar una referencia (mismo que hace la comparativa).
    else if (s.provider === "pioupiou" && enabled) {
      const snap = {
        avg: (s.wind_speed_avg ?? null),
        max: (s.wind_speed_max ?? null),
        dir: (s.wind_heading ?? null),
      };
      if (snap.avg != null || snap.dir != null) {
        verdict = takeoffVerdictFromSnapshot(currentTakeoffCriteria, snap);
      }
    }
    btn.dataset.verdict = verdict;
    const isFav = !!(ctx?.favByKey && ctx.favKey && ctx.favByKey.get(ctx.favKey(s)));
    if (isFav) btn.classList.add("ts-fav");
  } catch {}
  if (enabled) {
    btn.addEventListener("click", () => {
      if (isCommunity) {
        // v113: usa la estacion mas cercana autovinculada (cualquier proveedor)
        // en lugar del stationId guardado en el doc.
        // v168: si el despegue NO tiene estacion live vinculada, igualmente lo
        // seleccionamos: el despegue es la entidad principal (su doc id es la
        // clave unica). Sintetizamos un "pseudo-station" a partir del propio
        // takeoff para que el resto de la UI funcione (sin datos live, pero
        // con pronostico/edicion del despegue).
        // v174: el objeto `s.raw` se capturo cuando se renderizo el panel; si
        // mientras tanto el snapshot de Firestore actualizo el doc (p.ej. tras
        // una edicion), `s.raw` esta OBSOLETO. Releemos el doc fresco de
        // approvedTakeoffs por id antes de seleccionarlo, para que la criteria
        // y las URLs externas reflejen el estado actual del servidor.
        const docId = s.raw?.id || null;
        const fresh = docId
          ? (window.PCAuth?.approvedTakeoffs || []).find(t => t.id === docId)
          : null;
        const useRaw = fresh || s.raw || null;
        const link = s._linkedStation;
        if (link) {
          selectStation({
            id: link.id, provider: link.provider,
            name: useRaw?.name || s.name, shortName: useRaw?.shortName || s.name,
            lat: useRaw?.lat ?? s.lat, lon: useRaw?.lon ?? s.lon,
          }, { criteria: useRaw?.criteria || null, originId: docId, userPicked: true });
        } else if (docId) {
          selectStation({
            id: "to_" + docId, provider: "community",
            name: useRaw?.name || s.name, shortName: useRaw?.shortName || s.name,
            lat: useRaw?.lat ?? s.lat, lon: useRaw?.lon ?? s.lon,
          }, { criteria: useRaw?.criteria || null, originId: docId, userPicked: true });
        }
      } else {
        selectStation({ id: s.id, provider: s.provider, name: s.name, shortName: s.name, lat: s.lat, lon: s.lon }, { userPicked: true });
      }
      // v119: limpia el input y cierra el panel al seleccionar un resultado.
      if (typeof window.closeTsPanel === "function") {
        window.closeTsPanel({ clearInput: true });
      } else {
        document.getElementById("tsPanel").hidden = true;
      }
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

    // Estrella (favorito)
    const star = document.createElement("button");
    star.type = "button"; star.className = "ts-icon-btn" + (fav ? " is-active" : "");
    star.title = fav ? t("fav.remove") : t("fav.add");
    star.textContent = fav ? "★" : "☆";
    star.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      try {
        if (fav) {
          await window.PCAuth.removeFavorite(fav.id);
        } else {
          await window.PCAuth.addFavorite({
            source: isCommunity ? "community" : (isFfvl ? "ffvl" : "pioupiou"),
            refId: isCommunity ? (s.raw?.id || "") : (isFfvl ? s.rawId : s.id),
            // v113: solo guardamos stationId si es numerico (pioupiou). Comunitarios
            // se auto-vinculan por proximidad al cargar el favorito.
            stationId: isCommunity ? null : (isFfvl ? null : s.id),
            name: s.name,
            lat: s.lat, lon: s.lon,
            criteria: isCommunity ? (s.raw?.criteria || null) : null,
            alertsEnabled: false,
          });
        }
      } catch (e) { console.warn("[fav]", e); }
    });
    icons.appendChild(star);

    // v184: corona "habitual" eliminada. Los favoritos se ordenan por
    // distancia a la posicion del usuario; ya no hay un favorito destacado.
    if (fav) {
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
      edit.title = t("to.suggest_tip");
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
      prop.title = t("to.propose_tip");
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

  let searchTimer = null;
  // v119: helper para cerrar el panel y limpiar el input. Usado al seleccionar
  // un resultado y por los listeners de Esc / click fuera / boton atras (popstate).
  const closeTsPanel = ({ clearInput = false } = {}) => {
    if (panel && !panel.hidden) panel.hidden = true;
    if (clearInput && searchEl) searchEl.value = "";
    // Si abrimos el panel con pushState, hacemos pop para limpiar el historial.
    if (window.history.state && window.history.state.tsPanel) {
      window.history.back();
    }
  };
  window.closeTsPanel = closeTsPanel;

  // v0.187: boton X dentro del panel del buscador.
  document.getElementById("tsPanelClose")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeTsPanel({ clearInput: true });
  });
  if (searchEl) {
    const openPanel = () => {
      if (panel?.hidden) {
        panel.hidden = false;
        tsRunSearch();
        // v119: empuja un estado en la pila para que el boton "atras" del movil cierre el panel.
        try { window.history.pushState({ tsPanel: true }, ""); } catch (_e) {}
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

  // v119: cierra el panel con Esc.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel && !panel.hidden) {
      closeTsPanel({ clearInput: true });
      searchEl?.blur();
    }
  });
  // v119: cierra al hacer click fuera del panel y del input.
  document.addEventListener("pointerdown", (e) => {
    if (!panel || panel.hidden) return;
    if (panel.contains(e.target)) return;
    if (searchEl && searchEl.contains(e.target)) return;
    closeTsPanel();
  });
  // v119: boton atras del movil cierra el panel (sin navegar).
  window.addEventListener("popstate", () => {
    if (panel && !panel.hidden) {
      panel.hidden = true;
    }
  });

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
          // v184: reevalua el despegue por defecto (favorito mas cercano).
          if (!_userPickedStation) resolveDefaultTakeoff();
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

// === Paneles colapsables (v0.186) ===
// Cada section.card.collapsible recibe un boton-flecha en su h2 que pliega
// el contenido (todo lo que no sea el h2). El estado se persiste en
// localStorage para que sobreviva recargas.
// v0.189: la clave se namespacea por uid del usuario para que cada cuenta
// (incluido "anon") tenga su propia configuracion de paneles plegados.
function _cardCollapseScope() {
  try {
    const u = window.PCAuth?.user;
    return (u && !u.isAnonymous && u.uid) ? u.uid : "anon";
  } catch { return "anon"; }
}
const _collapsibleReloaders = [];
function initCollapsibleCards() {
  const cards = document.querySelectorAll("section.card.collapsible");
  cards.forEach((card, idx) => {
    const h = card.querySelector("h2");
    if (!h || h.querySelector(".card-toggle")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-toggle";
    btn.setAttribute("aria-label", "Plegar / Desplegar");
    btn.title = "Plegar / Desplegar";
    // v0.187: icono via CSS (::before con » rotado).
    h.appendChild(btn);
    const apply = (collapsed) => {
      card.classList.toggle("collapsed", collapsed);
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    };
    const keyFor = () => "cardCollapsed:" + _cardCollapseScope() + ":"
      + (card.id || `idx${idx}:${h.textContent.trim().slice(0, 24)}`);
    const reload = () => {
      try { apply(localStorage.getItem(keyFor()) === "1"); }
      catch { apply(false); }
    };
    reload();
    _collapsibleReloaders.push(reload);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const collapsed = !card.classList.contains("collapsed");
      apply(collapsed);
      try { localStorage.setItem(keyFor(), collapsed ? "1" : "0"); } catch {}
    });
  });
}
function reapplyCardCollapseStates() {
  _collapsibleReloaders.forEach(fn => { try { fn(); } catch {} });
}

// Inicialización
applyStaticI18n();
syncNotifyButtonInitial();
initTakeoffSelector();
initOrientationToggle();
initCollapsibleCards();
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
  const fbConsoleBtn = document.getElementById("firebaseConsoleBtn");
  if (fbConsoleBtn) fbConsoleBtn.hidden = !isAdmin;
  // v147: "Anadir despegue" se muestra siempre, pero queda deshabilitado para
  // usuarios anonimos o sin sesion. El click handler tambien lo bloquea por
  // si acaso. v0.186: tooltip explicativo.
  const addTakeoffBtn = document.getElementById("tsAddTakeoffBtn");
  if (addTakeoffBtn) {
    addTakeoffBtn.hidden = false;
    const guest = !user || user.isAnonymous;
    addTakeoffBtn.disabled = guest;
    addTakeoffBtn.title = guest
      ? (t("to.guest_add_tip") || "Regístrate para poder añadir y sugerir cambios en despegues")
      : t("menu.add_takeoff_tip");
  }
  updateAdminPendingBadge();
  // v0.189: re-evalua estado plegado/desplegado de paneles segun el nuevo uid.
  if (typeof reapplyCardCollapseStates === "function") reapplyCardCollapseStates();
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
  if (prefs.theme && prefs.theme !== currentTheme) {
    // v0.199: solo dark/light. Migra "auto" remoto -> "dark".
    const themeToApply = (prefs.theme === "light") ? "light" : "dark";
    if (themeToApply !== currentTheme) applyTheme(themeToApply);
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

function renderDirRose(currentQualities, hostId) {
  const host = document.getElementById(hostId || "toDirRose");
  if (!host) return;
  host.innerHTML = "";
  host.classList.add("compass-rose-picker");
  const labels = DIR_16_BY_LANG[currentLang] || DIR_16_BY_LANG.es;
  // v109: editor de 16 sectores (antes 8). currentQualities ya viene en 16-bucket.
  const q16 = Array.isArray(currentQualities) && currentQualities.length === 16
    ? currentQualities.slice()
    : new Array(16).fill(null);
  const CARDINAL_K = new Set([0, 4, 8, 12]); // N, E, S, O

  // Geometría del SVG: ring de 240×240, sectores de 22.5°
  const SIZE = 240, CX = SIZE / 2, CY = SIZE / 2;
  const R_OUT = 112, R_IN = 50;
  const HALF = 11.25; // medio sector
  const SVG_NS = "http://www.w3.org/2000/svg";
  const arcPath = (angDeg) => {
    const a1 = ((angDeg - HALF) - 90) * Math.PI / 180;
    const a2 = ((angDeg + HALF) - 90) * Math.PI / 180;
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

  for (let k = 0; k < 16; k++) {
    const ang = k * 22.5;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", arcPath(ang));
    path.setAttribute("class", "rose-sector" + (CARDINAL_K.has(k) ? " is-cardinal" : ""));
    path.dataset.idx = String(k);
    path.dataset.i16 = String(k);
    path.dataset.q = q16[k] || "bad";
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
    txt.textContent = labels[k];
    svg.appendChild(txt);
  }
  host.appendChild(svg);
}

function collectDirRose(hostId) {
  const q16 = new Array(16).fill("bad");
  document.querySelectorAll("#" + (hostId || "toDirRose") + " .rose-sector").forEach(b => {
    const k = parseInt(b.dataset.idx, 10);
    if (Number.isFinite(k) && k >= 0 && k < 16) q16[k] = b.dataset.q || "bad";
  });
  return q16;
}

function openTakeoffSubmit(prefill) {
  const u = window.PCAuth?.user;
  if (!u || u.isAnonymous) { alert(t("to.submit_login")); return; }
  document.getElementById("toSubmitMsg").textContent = "";
  ["toName","toLat","toLon","toAlt","toOrient","toNotes","toWindMin","toWindMax","toGustMax","toWindyUrl","toVolandooUrl"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  _toClearStationRef?.();
  // v206: oculta el aviso "revisa la estacion" al abrir un dialogo nuevo.
  const __warn = document.getElementById("toStationMoveWarn");
  if (__warn) __warn.hidden = true;
  _toManualLatPrev = null; _toManualLonPrev = null;
  // Restaura título y botón por si veníamos de modo sugerencia (será sobreescrito por openTakeoffSuggest si aplica)
  if (!prefill || !prefill._suggesting) {
    _suggestTargetId = null;
    const title = document.getElementById("toTitle"); if (title) title.textContent = t("to.submit_title");
    const sb = document.getElementById("toSubmitBtn"); if (sb) sb.textContent = t("to.submit");
    const delBtn = document.getElementById("toDeleteBtn"); if (delBtn) delBtn.hidden = true;
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
    if (prefill.alt != null && prefill.alt !== "") document.getElementById("toAlt").value = String(prefill.alt);
    if (prefill.orientations) document.getElementById("toOrient").value = String(prefill.orientations);
    if (prefill.notes) document.getElementById("toNotes").value = String(prefill.notes);
    if (prefill.windyUrl) document.getElementById("toWindyUrl").value = String(prefill.windyUrl);
    if (prefill.volandooUrl) document.getElementById("toVolandooUrl").value = String(prefill.volandooUrl);
    if (prefill.stationId != null && prefill.stationId !== "") {
      const idEl = document.getElementById("toStationId");
      if (idEl) {
        // v182: el <select> aun no tiene opciones (se rellenan via async
        // _toLoadStationsForCoords). Asignar .value aqui no "engancha" porque
        // el option no existe, asi que guardamos el id pendiente en un
        // dataset y lo aplicamos despues de poblar las opciones.
        idEl.dataset.pendingValue = String(prefill.stationId);
      }
    }
    setTimeout(() => { document.getElementById("toName")?.focus(); document.getElementById("toName")?.select(); }, 50);
  } else {
    const c = userLocation || { lat: currentTakeoff.lat, lon: currentTakeoff.lon };
    const lat = document.getElementById("toLat");
    const lon = document.getElementById("toLon");
    if (lat) lat.value = c.lat.toFixed(5);
    if (lon) lon.value = c.lon.toFixed(5);
  }
  document.getElementById("takeoffSubmitModal").hidden = false;
  // v180: carga las estaciones cercanas en el desplegable, preservando la
  // seleccion si veniamos de un prefill con stationId.
  _toLoadStationsForCoords({ keepValue: true });
}
function closeTakeoffSubmit() {
  document.getElementById("takeoffSubmitModal").hidden = true;
  _suggestTargetId = null;
  const title = document.getElementById("toTitle"); if (title) title.textContent = t("to.submit_title");
  const sb = document.getElementById("toSubmitBtn"); if (sb) sb.textContent = t("to.submit");
  const delBtn = document.getElementById("toDeleteBtn"); if (delBtn) delBtn.hidden = true;
}

document.getElementById("toSubmitClose")?.addEventListener("click", closeTakeoffSubmit);
document.getElementById("toCancelBtn")?.addEventListener("click", closeTakeoffSubmit);
// v203: el boton 🗺️ abre un sub-modal con un mapa Leaflet donde el usuario
// puede tocar/arrastrar para situar el despegue (mejor que escribir lat/lon
// a mano para sitios en ladera o montana).
// v204: el boton se renombro a toOpenMapBtn y vive ahora dentro del bloque
// "Coordenadas del despegue". Mantenemos toPickOnMapBtn por compatibilidad.
document.getElementById("toPickOnMapBtn")?.addEventListener("click", () => {
  openTakeoffMapPicker();
});
document.getElementById("toOpenMapBtn")?.addEventListener("click", () => {
  openTakeoffMapPicker();
});

// ---------------------------------------------------------------------------
// v203: selector de coordenadas en mapa (sub-modal del dialogo de despegue)
// ---------------------------------------------------------------------------
let _toPickMap = null;
let _toPickMarker = null;
let _toPickLayers = null; // { sat, topo, street }
let _toPickCurrentLayerKey = "topo";
let _toPickLastAlt = null;       // ultima elevacion conocida del marcador
let _toPickElevSeq = 0;          // anti-race de fetch de elevacion
const _toElevCache = new Map();  // "lat5,lon5" -> metros

async function _toFetchElevation(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (_toElevCache.has(key)) return _toElevCache.get(key);
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const m = Array.isArray(data?.elevation) ? data.elevation[0] : null;
    if (m == null) return null;
    const rounded = Math.round(m);
    _toElevCache.set(key, rounded);
    return rounded;
  } catch (e) {
    console.warn("[elevation]", e);
    return null;
  }
}

// Pide la elevacion del punto actual del marcador y actualiza la etiqueta del
// sub-modal. Usa un contador (_toPickElevSeq) para descartar respuestas
// obsoletas si el marcador se ha movido mientras la peticion estaba en vuelo.
async function _toPickRefreshElevation(lat, lon) {
  const seq = ++_toPickElevSeq;
  _toPickLastAlt = null;
  const lbl = document.getElementById("toPickAltLbl");
  if (lbl) lbl.textContent = "…";
  const m = await _toFetchElevation(lat, lon);
  if (seq !== _toPickElevSeq) return; // movido entre tanto
  _toPickLastAlt = m;
  if (lbl) lbl.textContent = (m == null ? "—" : String(m));
}

function _toPickBuildLayers() {
  // Capa satelite: Esri World Imagery (sin token, uso permitido con atribucion).
  // Capa topo: OpenTopoMap. Capa calles: OSM.
  const sat = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics" }
  );
  const topo = L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    { maxZoom: 17, attribution: "© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)" }
  );
  const street = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "© OpenStreetMap" }
  );
  return { sat, topo, street };
}

function _toPickSetLayer(key) {
  if (!_toPickMap || !_toPickLayers) return;
  const next = _toPickLayers[key];
  if (!next) return;
  Object.keys(_toPickLayers).forEach(k => {
    if (k !== key && _toPickMap.hasLayer(_toPickLayers[k])) _toPickMap.removeLayer(_toPickLayers[k]);
  });
  if (!_toPickMap.hasLayer(next)) next.addTo(_toPickMap);
  _toPickCurrentLayerKey = key;
}

function _toPickUpdateLabels(latlng) {
  const lat = document.getElementById("toPickLatLbl");
  const lon = document.getElementById("toPickLonLbl");
  if (lat) lat.textContent = latlng.lat.toFixed(5);
  if (lon) lon.textContent = latlng.lng.toFixed(5);
}

function openTakeoffMapPicker() {
  const modal = document.getElementById("toMapPickerModal");
  if (!modal) return;
  const lat0p = parseFloat(document.getElementById("toLat")?.value);
  const lon0p = parseFloat(document.getElementById("toLon")?.value);
  let lat0, lon0, zoom0;
  if (Number.isFinite(lat0p) && Number.isFinite(lon0p)) {
    lat0 = lat0p; lon0 = lon0p; zoom0 = 14;
  } else if (userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lon)) {
    lat0 = userLocation.lat; lon0 = userLocation.lon; zoom0 = 13;
  } else {
    lat0 = currentTakeoff.lat; lon0 = currentTakeoff.lon; zoom0 = 12;
  }
  modal.hidden = false;
  if (!_toPickMap) {
    _toPickLayers = _toPickBuildLayers();
    _toPickMap = L.map("toPickMap", { zoomControl: true }).setView([lat0, lon0], zoom0);
    _toPickSetLayer(_toPickCurrentLayerKey);
    _toPickMarker = L.marker([lat0, lon0], { draggable: true }).addTo(_toPickMap);
    _toPickUpdateLabels(_toPickMarker.getLatLng());
    _toPickRefreshElevation(lat0, lon0);
    _toPickMap.on("click", (e) => {
      _toPickMarker.setLatLng(e.latlng);
      _toPickUpdateLabels(e.latlng);
      _toPickRefreshElevation(e.latlng.lat, e.latlng.lng);
    });
    _toPickMarker.on("drag", () => _toPickUpdateLabels(_toPickMarker.getLatLng()));
    _toPickMarker.on("dragend", () => {
      const ll = _toPickMarker.getLatLng();
      _toPickUpdateLabels(ll);
      _toPickRefreshElevation(ll.lat, ll.lng);
    });
    document.querySelectorAll('input[name="toMapLayer"]').forEach(r => {
      r.addEventListener("change", () => { if (r.checked) _toPickSetLayer(r.value); });
    });
  } else {
    _toPickMap.setView([lat0, lon0], zoom0);
    if (_toPickMarker) _toPickMarker.setLatLng([lat0, lon0]);
    _toPickUpdateLabels({ lat: lat0, lng: lon0 });
    _toPickRefreshElevation(lat0, lon0);
  }
  document.querySelectorAll('input[name="toMapLayer"]').forEach(r => {
    r.checked = (r.value === _toPickCurrentLayerKey);
  });
  // Leaflet necesita recalcular tamano al pasar el contenedor de hidden a visible.
  setTimeout(() => { try { _toPickMap.invalidateSize(); } catch (_) {} }, 60);
  // Limpia el geocoder integrado.
  const gIn = document.getElementById("toPickGeocodeInput");
  const gOut = document.getElementById("toPickGeocodeResults");
  if (gIn) gIn.value = "";
  if (gOut) { gOut.hidden = true; gOut.innerHTML = ""; }
}

function closeTakeoffMapPicker() {
  const modal = document.getElementById("toMapPickerModal");
  if (modal) modal.hidden = true;
}

document.getElementById("toMapPickerClose")?.addEventListener("click", closeTakeoffMapPicker);
document.getElementById("toMapPickerCancel")?.addEventListener("click", closeTakeoffMapPicker);
document.getElementById("toMapPickerConfirm")?.addEventListener("click", () => {
  if (!_toPickMarker) { closeTakeoffMapPicker(); return; }
  const ll = _toPickMarker.getLatLng();
  const latEl = document.getElementById("toLat");
  const lonEl = document.getElementById("toLon");
  // v206: capturamos las coords previas para detectar si el usuario ha
  // movido la posicion del despegue de forma significativa. Si la habia una
  // estacion seleccionada, la mantenemos pero avisamos para que la revise.
  const prevLat = parseFloat(latEl?.value);
  const prevLon = parseFloat(lonEl?.value);
  // v206.1: capturar el id de la estacion ANTES de recargar (la recarga
  // limpia el <select> sincronamente y solo lo repuebla tras un fetch async).
  const prevStationId = document.getElementById("toStationId")?.value || "";
  if (latEl) latEl.value = ll.lat.toFixed(5);
  if (lonEl) lonEl.value = ll.lng.toFixed(5);
  // v205: si tenemos elevacion calculada, la escribimos en el campo altitud
  // (sobreescribiendo el valor anterior — el usuario eligio un punto nuevo).
  const altEl = document.getElementById("toAlt");
  if (altEl && _toPickLastAlt != null) altEl.value = String(_toPickLastAlt);
  // v206: ya NO limpiamos la estacion; la mantenemos y recargamos el
  // desplegable conservando la seleccion (si sigue en rango, se mantiene; si
  // queda fuera, _toLoadStationsForCoords la anade como "fuera de 30 km").
  try { _toLoadStationsForCoords?.({ keepValue: true }); } catch (_) {}
  _toMaybeWarnStationMove(prevLat, prevLon, ll.lat, ll.lng, prevStationId);
  closeTakeoffMapPicker();
});

// v204: geocodificador integrado en el sub-modal del mapa. Al elegir un
// resultado movemos el marcador y centramos el mapa (no escribimos en
// toLat/toLon hasta que el usuario confirma con "Usar estas coordenadas").
async function _toPickRunGeocode() {
  const inp = document.getElementById("toPickGeocodeInput");
  const out = document.getElementById("toPickGeocodeResults");
  if (!inp || !out) return;
  out.hidden = false;
  out.innerHTML = `<div class="to-geocode-loading">${t("loading")}</div>`;
  const items = await geocodeAddress(inp.value);
  if (!items.length) {
    out.innerHTML = `<div class="to-geocode-empty">${t("to.geocode_empty")}</div>`;
    return;
  }
  out.innerHTML = "";
  for (const it of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-geocode-item";
    btn.innerHTML = `<b>${escapeHtml(it.display_name || "")}</b><br/><small>${Number(it.lat).toFixed(5)}, ${Number(it.lon).toFixed(5)}</small>`;
    btn.addEventListener("click", () => {
      const lat = Number(it.lat), lon = Number(it.lon);
      if (_toPickMap && _toPickMarker) {
        _toPickMarker.setLatLng([lat, lon]);
        _toPickMap.setView([lat, lon], Math.max(_toPickMap.getZoom(), 14));
        _toPickUpdateLabels({ lat, lng: lon });
        _toPickRefreshElevation(lat, lon);
      }
      // Sugerimos el nombre del despegue si aun esta vacio.
      const nameEl = document.getElementById("toName");
      if (nameEl && !nameEl.value) {
        nameEl.value = String(it.display_name || "").split(",")[0].trim();
      }
      out.hidden = true;
    });
    out.appendChild(btn);
  }
}
document.getElementById("toPickGeocodeBtn")?.addEventListener("click", _toPickRunGeocode);
document.getElementById("toPickGeocodeInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); _toPickRunGeocode(); }
});

// v205: boton "📏" en el campo Altitud — pide la elevacion a Open-Meteo para
// las lat/lon actuales del formulario y la escribe en toAlt.
document.getElementById("toAltFetchBtn")?.addEventListener("click", async () => {
  const lat = parseFloat(document.getElementById("toLat")?.value);
  const lon = parseFloat(document.getElementById("toLon")?.value);
  const altEl = document.getElementById("toAlt");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !altEl) return;
  const prev = altEl.value;
  altEl.value = "…";
  const m = await _toFetchElevation(lat, lon);
  altEl.value = (m == null ? prev : String(m));
});

// v206: aviso "revisa la estacion" cuando el usuario mueve las coordenadas
// del despegue (en el mapa o a mano) y habia una estacion seleccionada. Se
// considera "movimiento significativo" cualquier cambio > 50 m. Se oculta
// automaticamente cuando el usuario toca el desplegable de estacion.
// v206.1: el id de estacion se pasa como parametro porque
// _toLoadStationsForCoords vacia el <select> sincronamente y, si leemos
// sel.value despues, ya esta vacio. Hay que capturarlo ANTES.
function _toMaybeWarnStationMove(prevLat, prevLon, newLat, newLon, prevStationId) {
  const warn = document.getElementById("toStationMoveWarn");
  if (!warn) return;
  if (!prevStationId) { warn.hidden = true; return; }
  if (!Number.isFinite(prevLat) || !Number.isFinite(prevLon)
      || !Number.isFinite(newLat) || !Number.isFinite(newLon)) {
    warn.hidden = true; return;
  }
  const movedKm = haversineKm(prevLat, prevLon, newLat, newLon);
  warn.hidden = !(movedKm > 0.05);
}
document.getElementById("toStationId")?.addEventListener("change", () => {
  const warn = document.getElementById("toStationMoveWarn");
  if (warn) warn.hidden = true;
});
// Cuando el usuario edita lat/lon a mano, tambien recargamos el desplegable
// (manteniendo la seleccion) y disparamos el aviso si toca.
let _toManualLatPrev = null, _toManualLonPrev = null;
function _toBindManualCoordChange(id, isLat) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("focus", () => {
    const v = parseFloat(el.value);
    if (isLat) _toManualLatPrev = v; else _toManualLonPrev = v;
  });
  el.addEventListener("change", () => {
    const lat = parseFloat(document.getElementById("toLat")?.value);
    const lon = parseFloat(document.getElementById("toLon")?.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const prevLat = Number.isFinite(_toManualLatPrev) ? _toManualLatPrev : lat;
    const prevLon = Number.isFinite(_toManualLonPrev) ? _toManualLonPrev : lon;
    const prevStationId = document.getElementById("toStationId")?.value || "";
    try { _toLoadStationsForCoords?.({ keepValue: true }); } catch (_) {}
    _toMaybeWarnStationMove(prevLat, prevLon, lat, lon, prevStationId);
    if (isLat) _toManualLatPrev = lat; else _toManualLonPrev = lon;
  });
}
_toBindManualCoordChange("toLat", true);
_toBindManualCoordChange("toLon", false);
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
    // v183: si el usuario deja un campo vacio, asumimos el valor que ve como
    // placeholder (5 / 15 / 30 por defecto). Antes se guardaba null y el
    // usuario veia "racha max" en blanco en Firestore aunque el form mostraba
    // "30" como pista visual.
    const _readNumOrPlaceholder = (id) => {
      const el = document.getElementById(id);
      if (!el) return NaN;
      const v = parseFloat(el.value);
      if (Number.isFinite(v)) return v;
      const ph = parseFloat(el.placeholder);
      return Number.isFinite(ph) ? ph : NaN;
    };
    const windMinV = _readNumOrPlaceholder("toWindMin");
    const windMaxV = _readNumOrPlaceholder("toWindMax");
    const gustMaxV = _readNumOrPlaceholder("toGustMax");
    const criteria = (qualityByIndex.some(Boolean) || Number.isFinite(windMinV) || Number.isFinite(windMaxV) || Number.isFinite(gustMaxV))
      ? {
          qualityByIndex,
          windMin: Number.isFinite(windMinV) ? windMinV : null,
          windMax: Number.isFinite(windMaxV) ? windMaxV : null,
          gustMax: Number.isFinite(gustMaxV) ? gustMaxV : null,
        }
      : null;
    const submittedPayload = {
      name: document.getElementById("toName").value,
      lat: document.getElementById("toLat").value,
      lon: document.getElementById("toLon").value,
      alt: document.getElementById("toAlt").value,
      orientations: orientationsText,
      notes: document.getElementById("toNotes").value,
      windyUrl: document.getElementById("toWindyUrl")?.value || null,
      volandooUrl: document.getElementById("toVolandooUrl")?.value || null,
      stationId: document.getElementById("toStationId")?.value || null,
      criteria,
      targetId: _suggestTargetId || null,
    };
    // v164: capturamos el criterio "viejo" del doc ANTES de enviar la
    // actualizacion para poder limpiar overrides personales que coincidan
    // exactamente con el (ver bloque de limpieza mas abajo).
    const _preEditOldCriteriaJson = (() => {
      if (!_suggestTargetId) return null;
      const d = (window.PCAuth?.approvedTakeoffs || []).find(t => t.id === _suggestTargetId);
      return d ? JSON.stringify(d.criteria ?? null) : null;
    })();
    const submitResult = await window.PCAuth.submitTakeoff(submittedPayload);
    // v171: log explicito para diagnosticar por que un edit no persiste.
    console.info("[to] submit result", {
      targetId: _suggestTargetId,
      isAdmin: !!window.PCAuth?.isAdmin,
      autoApplied: !!submitResult?.autoApplied,
      submitId: submitResult?.id,
      payload: submittedPayload,
    });
    // v161/v162: al editar/sugerir cambios sobre un despegue comunitario
    // existente, limpiamos cualquier override personal (🛠) guardado para ese
    // mismo despegue. v161 solo borraba la clave "to:<targetId>", pero el
    // override puede estar guardado bajo "<provider>:<stationId>" si el
    // usuario lo creo cuando aun no se habia resuelto el origen comunitario.
    // En v162 borramos ambas variantes ademas de cualquier clave que coincida
    // con el stationId del doc para todos los proveedores conocidos.
    if (_suggestTargetId) {
      const targetDoc = (window.PCAuth?.approvedTakeoffs || []).find(t => t.id === _suggestTargetId);
      const toRemove = new Set();
      toRemove.add("to:" + _suggestTargetId);
      // Claves que aplican al contexto actual (incluye station-based si esta resuelto).
      if (currentTakeoff.id === _suggestTargetId) {
        for (const k of _overrideKeysForCurrent()) toRemove.add(k);
      }
      // Cualquier clave de proveedor que apunte al mismo stationId del doc.
      const sid = targetDoc?.stationId ?? null;
      if (sid != null) {
        for (const prov of ["pioupiou", "aemet", "holfuy", "ffvl"]) {
          toRemove.add(prov + ":" + sid);
        }
      }
      let changed = false;
      for (const k of toRemove) {
        if (userTakeoffOverrides && userTakeoffOverrides[k]) {
          delete userTakeoffOverrides[k];
          changed = true;
        }
      }
      // v164: tambien purgamos cualquier override personal cuyo contenido
      // coincida EXACTAMENTE con el criterio antiguo del doc. Esto cubre el
      // caso reportado donde el override estaba guardado bajo una clave de
      // estacion historica (p.ej. "pioupiou:X") que ya no coincide ni con la
      // clave actual del contexto ni con el stationId del doc, pero seguia
      // aplicandose al volver al despegue (mostrando los valores viejos).
      if (_preEditOldCriteriaJson && _preEditOldCriteriaJson !== "null" && userTakeoffOverrides) {
        for (const k of Object.keys(userTakeoffOverrides)) {
          try {
            if (JSON.stringify(userTakeoffOverrides[k] ?? null) === _preEditOldCriteriaJson) {
              delete userTakeoffOverrides[k];
              changed = true;
            }
          } catch {}
        }
      }
      if (changed) _saveUserOverrides();

      // v163: en lugar de esperar al snapshot de Firestore (que puede tardar
      // varios segundos incluso para admin auto-aprobado), aplicamos
      // localmente los datos que el usuario acaba de enviar. Esto garantiza
      // que la UI refleje los cambios instantaneamente. El snapshot
      // posterior los confirmara/sobrescribira con los del servidor.
      const list = window.PCAuth?.approvedTakeoffs;
      if (Array.isArray(list) && submitResult?.autoApplied) {
        const idx = list.findIndex(t => t.id === _suggestTargetId);
        const merged = {
          ...(idx >= 0 ? list[idx] : { id: _suggestTargetId }),
          name: String(submittedPayload.name || "").trim(),
          lat: Number(submittedPayload.lat),
          lon: Number(submittedPayload.lon),
          alt: (submittedPayload.alt !== "" && submittedPayload.alt != null) ? Number(submittedPayload.alt) : null,
          orientations: String(submittedPayload.orientations || "").trim(),
          stationId: (submittedPayload.stationId !== "" && submittedPayload.stationId != null) ? String(submittedPayload.stationId) : null,
          notes: String(submittedPayload.notes || "").trim() || null,
          windyUrl: submittedPayload.windyUrl || null,
          volandooUrl: submittedPayload.volandooUrl || null,
          criteria: submittedPayload.criteria || null,
        };
        if (idx >= 0) list[idx] = merged; else list.push(merged);
      }

      // Si el doc afectado es el activo, forzamos un repaso completo (cubre
      // el camino admin auto-aprobado donde el snapshot puede tardar).
      if (currentTakeoff.id === _suggestTargetId) {
        const fresh = (window.PCAuth?.approvedTakeoffs || []).find(t => t.id === _suggestTargetId);
        if (fresh) { try { _attachTakeoffDoc(fresh); } catch {} }
        // Programamos una segunda pasada cuando llegue el snapshot fresco
        // (admin auto-approve actualiza el doc y dispara onSnapshot).
        setTimeout(() => {
          try {
            const f2 = (window.PCAuth?.approvedTakeoffs || []).find(t => t.id === _suggestTargetId);
            if (f2) _attachTakeoffDoc(f2);
            renderTakeoffPanel();
            renderCurrentTakeoffActions();
            if (typeof refreshObservations === "function") refreshObservations();
          } catch {}
        }, 800);
        try { renderTakeoffPanel(); } catch {}
        try { renderCurrentTakeoffActions(); } catch {}
        try { if (typeof refreshObservations === "function") refreshObservations(); } catch {}
      }
    }
    msg.style.color = "#2ecc71";
    // v171: deja claro si la edicion se aplico directamente (admin) o si quedo
    // pendiente de revision. Antes mostraba siempre "ok" y el usuario pensaba
    // que se habia guardado.
    if (_suggestTargetId) {
      if (submitResult?.autoApplied) {
        const sd = submitResult.serverDoc;
        // v171: leemos el doc desde Firestore tras escribir para confirmar.
        // Comparamos campos clave; si difieren mostramos un aviso.
        let verify = "";
        if (sd) {
          const expectedName = String(submittedPayload.name || "").trim();
          const expectedWindMin = submittedPayload.criteria?.windMin ?? null;
          const expectedWindMax = submittedPayload.criteria?.windMax ?? null;
          const expectedGustMax = submittedPayload.criteria?.gustMax ?? null;
          const serverName = sd.name || "";
          const serverWindMin = sd.criteria?.windMin ?? null;
          const serverWindMax = sd.criteria?.windMax ?? null;
          const serverGustMax = sd.criteria?.gustMax ?? null;
          const matches = serverName === expectedName
            && Number(serverWindMin) === Number(expectedWindMin)
            && Number(serverWindMax) === Number(expectedWindMax)
            && Number(serverGustMax) === Number(expectedGustMax);
          verify = matches
            ? " · servidor OK"
            : ` · servidor DIFIERE [nombre:${serverName} v${serverWindMin}-${serverWindMax} r${serverGustMax}]`;
          if (!matches) msg.style.color = "#e67e22";
        } else {
          verify = " · sin lectura post-write";
        }
        msg.textContent = "Aplicado (admin) · doc " + (submitResult.id || _suggestTargetId) + verify;
      } else {
        msg.textContent = "Pendiente de revision · NO aplicado todavia";
      }
    } else {
      msg.textContent = t("to.submit_ok");
    }
    // v171: si hubo verificacion correcta, cerrar en 1.4s; si difiere o fue
    // pendiente, dejar el mensaje 8s para que el usuario lo lea.
    const autoCloseMs = (submitResult?.autoApplied && submitResult.serverDoc) ? 1400 : 8000;
    setTimeout(closeTakeoffSubmit, autoCloseMs);
  } catch (e) {
    console.error("[to] submit", e);
    msg.textContent = t("to.submit_err") + " [" + (e?.code || e?.message || "?") + "]";
  }
});

// v110: borrar despegue (solo admin, requiere confirmacion).
document.getElementById("toDeleteBtn")?.addEventListener("click", async () => {
  if (!window.PCAuth?.isAdmin) return;
  if (!_suggestTargetId) return;
  const list = window.PCAuth?.approvedTakeoffs || [];
  const to = list.find(x => x.id === _suggestTargetId);
  const label = to?.name || _suggestTargetId;
  if (!confirm(t("to.delete_confirm", { name: label }))) return;
  const msg = document.getElementById("toSubmitMsg");
  msg.style.color = "";
  msg.textContent = "";
  const delBtn = document.getElementById("toDeleteBtn");
  const submitBtn = document.getElementById("toSubmitBtn");
  if (delBtn) delBtn.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
  try {
    await window.PCAuth.deleteTakeoff(_suggestTargetId);
    msg.style.color = "#2ecc71";
    msg.textContent = t("to.delete_ok");
    setTimeout(closeTakeoffSubmit, 1200);
  } catch (e) {
    console.error("[to] delete", e);
    msg.textContent = t("to.delete_err") + " [" + (e?.code || e?.message || "?") + "]";
  } finally {
    if (delBtn) delBtn.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
  }
});

// v104: modal de criterios personales (override)
function openCriteriaOverride() {
  const u = window.PCAuth?.user;
  if (!u || u.isAnonymous) { alert(t("to.submit_login")); return; }
  const key = _overrideKeyForCurrent();
  if (!key) return;
  const modal = document.getElementById("criteriaOverrideModal");
  if (!modal) return;
  document.getElementById("coMsg").textContent = "";
  // Pre-rellena con el override si existe; si no, con la criteria actual (doc); si no, vacío.
  const base = getCurrentOverride() || currentTakeoff.criteria || null;
  const initialQ = (base?.qualityByIndex && base.qualityByIndex.some(Boolean))
    ? base.qualityByIndex.slice(0, 16)
    : new Array(16).fill(null);
  while (initialQ.length < 16) initialQ.push(null);
  renderDirRose(initialQ, "coDirRose");
  document.getElementById("coWindMin").value = Number.isFinite(base?.windMin) ? String(base.windMin) : "";
  document.getElementById("coWindMax").value = Number.isFinite(base?.windMax) ? String(base.windMax) : "";
  document.getElementById("coGustMax").value = Number.isFinite(base?.gustMax) ? String(base.gustMax) : "";
  const sub = document.getElementById("coSubtitle");
  if (sub) sub.textContent = t("co.hint") + " · " + (currentTakeoff.name || currentStation?.name || "");
  modal.hidden = false;
}
function closeCriteriaOverride() {
  const m = document.getElementById("criteriaOverrideModal");
  if (m) m.hidden = true;
}
document.getElementById("coClose")?.addEventListener("click", closeCriteriaOverride);
document.getElementById("coCancelBtn")?.addEventListener("click", closeCriteriaOverride);
document.getElementById("criteriaOverrideModal")?.addEventListener("click", (e) => {
  if (e.target.id === "criteriaOverrideModal") closeCriteriaOverride();
});
document.getElementById("coResetBtn")?.addEventListener("click", () => {
  const keys = _overrideKeysForCurrent();
  if (!keys.length) return;
  for (const k of keys) delete userTakeoffOverrides[k];
  _saveUserOverrides();
  // Reaplicar: como el override está borrado, recargamos criteria desde el doc si existe.
  const doc = getCurrentTakeoffDoc();
  currentTakeoff.criteria = doc?.criteria || null;
  currentTakeoffCriteria = currentTakeoff.criteria;
  closeCriteriaOverride();
  applyCurrentTakeoffLabel();
  refreshAllForCurrentTakeoff();
});
document.getElementById("coSaveBtn")?.addEventListener("click", () => {
  const keys = _overrideKeysForCurrent();
  if (!keys.length) return;
  const qualityByIndex = collectDirRose("coDirRose");
  const wmin = parseFloat(document.getElementById("coWindMin").value);
  const wmax = parseFloat(document.getElementById("coWindMax").value);
  const gmax = parseFloat(document.getElementById("coGustMax").value);
  const criteria = {
    qualityByIndex,
    windMin: Number.isFinite(wmin) ? wmin : null,
    windMax: Number.isFinite(wmax) ? wmax : null,
    gustMax: Number.isFinite(gmax) ? gmax : null,
  };
  // Guardar bajo TODAS las claves posibles para que el override se encuentre
  // independientemente de si el resolver (≤3 km) engancha o no un doc comunitario.
  for (const k of keys) userTakeoffOverrides[k] = criteria;
  _saveUserOverrides();
  currentTakeoff.criteria = criteria;
  currentTakeoffCriteria = criteria;
  closeCriteriaOverride();
  applyCurrentTakeoffLabel();
  refreshAllForCurrentTakeoff();
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
document.getElementById("firebaseConsoleBtn")?.addEventListener("click", () => {
  if (!window.PCAuth?.isAdmin) return;
  // Project ID importado de firebase-config.js → URL fija del proyecto.
  window.open("https://console.firebase.google.com/project/parapente-cenes/overview", "_blank", "noopener,noreferrer");
  document.getElementById("userMenuPanel")?.setAttribute("hidden", "");
  document.getElementById("userMenuBtn")?.setAttribute("aria-expanded", "false");
});
function updateAdminPendingBadge() {
  const isAdmin = !!(window.PCAuth && window.PCAuth.isAdmin);
  const count = (window.PCAuth?.pendingTakeoffs || []).length;
  const dot = document.getElementById("userMenuDot");
  const badge = document.getElementById("adminReviewBadge");
  // v116: el indicador del boton de menu ahora muestra el numero de pendientes
  // (no solo un punto) para que se vea desde la pagina principal.
  // v0.193: defensivo - el badge solo debe existir para administradores; para
  // usuarios registrados o invitados forzamos hidden y vaciamos texto/aria.
  if (dot) {
    if (!isAdmin) {
      dot.hidden = true;
      dot.textContent = "";
      dot.removeAttribute("aria-label");
    } else {
      dot.hidden = count === 0;
      dot.textContent = count > 99 ? "99+" : String(count);
      dot.setAttribute("aria-label", `${count} pendientes de revisar`);
    }
  }
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
    // v184: si aun no se ha seleccionado un despegue manualmente, reintenta
    // ahora que tenemos la lista comunitaria fresca (favoritos o no).
    if (!_userPickedStation) resolveDefaultTakeoff();
    // v107: re-engancha el doc del despegue actual con datos frescos del snapshot.
    // El bug previo era: limpiar aliases sin re-aplicar el doc dejaba la criteria
    // vieja en currentTakeoff y los alias en null → classifyDirection caía a neutro.
    const list = window.PCAuth?.approvedTakeoffs || [];
    if (currentTakeoff.id) {
      const fresh = list.find(t => t.id === currentTakeoff.id);
      if (fresh) {
        _attachTakeoffDoc(fresh);
      } else {
        // El doc desapareció (rechazado/borrado): limpia el lugar comunitario.
        currentTakeoff.id = null;
        currentTakeoff.criteria = null;
        currentTakeoff.notes = "";
        currentTakeoff.orientations = "";
        currentTakeoff.windyUrl = "";
        currentTakeoff.volandooUrl = "";
        currentTakeoffOriginId = null;
        currentTakeoffCriteria = null;
      }
    } else {
      // Sin id: intenta resolver de nuevo por stationId/nombre/proximidad.
      resolveCurrentTakeoffOrigin();
    }
    // Override personal siempre tiene prioridad sobre la criteria del doc.
    applyCurrentOverride();
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

// v147: al abrir la app, pedimos permiso de geolocalizacion siempre. Si el
// usuario ya lo concedio antes el navegador no muestra prompt y devuelve la
// posicion al instante; si lo denego antes lo seguira denegando sin molestar.
// Asi el pin de ubicacion queda activo por defecto y el despegue por defecto
// puede ser el favorito mas cercano a la posicion actual.
function requestInitialGeolocation() {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const locateBtn = document.getElementById("tsLocateBtn");
      if (locateBtn) locateBtn.classList.add("active");
      // Recalcula el despegue por defecto incluso si ya hay favoritos:
      // ahora que conocemos la posicion del usuario podemos elegir el
      // favorito mas cercano.
      if (!_userPickedStation) resolveDefaultTakeoff();
      if (typeof renderNearby === "function") renderNearby();
      if (typeof tsRunSearch === "function") {
        const panel = document.getElementById("tsPanel");
        if (panel && !panel.hidden) tsRunSearch();
      }
    },
    (err) => { console.warn("initial geolocation:", err); },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}
// Lanzamos un poco mas tarde para no competir con el primer render
setTimeout(requestInitialGeolocation, 800);

// === Despegue por defecto ===
// v184: las reglas se simplifican (sin "habitual"):
//   1) Despegue guardado (la sesion anterior tenia uno seleccionado).
//   2) Favorito mas cercano a la geolocalizacion del usuario.
//   3) Despegue comunitario aprobado mas cercano a la geolocalizacion.
//   4) Cualquier favorito (si no hay geolocalizacion).
//   5) Cenes (DEFAULT_STATION).
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

// v184: dada una estacion-candidata (lat/lon), elige la estacion meteo
// integrada mas cercana con datos recientes dentro de LINK_KM.
async function _findRecentNearbyStation(lat, lon, LINK_KM = 30) {
  try {
    const all = await ensureAllStations();
    const pools = [
      (all.pioupiou || []).map(stationFromPioupiou).filter(Boolean),
      (all.aemet || []),
      (all.holfuy || []),
    ];
    let best = null, bestKm = LINK_KM + 1;
    for (const pool of pools) for (const st of pool) {
      if (!Number.isFinite(st.lat) || !Number.isFinite(st.lon)) continue;
      if (!isStationRecent(st, 24)) continue;
      const km = haversineKm(lat, lon, st.lat, st.lon);
      if (km < bestKm) { bestKm = km; best = st; }
    }
    return best;
  } catch (e) {
    console.warn("_findRecentNearbyStation:", e);
    return null;
  }
}

async function _selectCommunityTakeoff(to) {
  const best = await _findRecentNearbyStation(to.lat, to.lon);
  if (best) {
    selectStation(
      { id: best.id, provider: best.provider, name: to.name, shortName: to.shortName || to.name, lat: to.lat, lon: to.lon },
      { criteria: to.criteria || null, originId: to.id }
    );
  } else {
    // Sin estacion live: el propio despegue es el lugar (pseudo-station).
    selectStation(
      { id: "to_" + to.id, provider: "community", name: to.name, shortName: to.shortName || to.name, lat: to.lat, lon: to.lon },
      { criteria: to.criteria || null, originId: to.id }
    );
  }
}

async function resolveDefaultTakeoff() {
  if (_userPickedStation) return;
  // (1) Sesion anterior: restauramos el despegue concreto.
  const savedTakeoffId = loadSavedTakeoffId();
  if (savedTakeoffId) {
    const list = window.PCAuth?.approvedTakeoffs || [];
    const to = list.find(t => t.id === savedTakeoffId);
    if (to) {
      try {
        await _selectCommunityTakeoff(to);
        _defaultResolvedOnce = true;
        return;
      } catch (e) { console.warn("resolveDefaultTakeoff saved takeoff:", e); }
    }
  }
  const favs = window.PCAuth?.favorites || [];
  // (2) Favorito mas cercano a la posicion del usuario.
  if (userLocation && favs.length) {
    let bestFav = null, bestFavD = Infinity;
    for (const f of favs) {
      if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon)) continue;
      const d = haversineKm(userLocation.lat, userLocation.lon, f.lat, f.lon);
      if (d < bestFavD) { bestFavD = d; bestFav = f; }
    }
    if (bestFav) {
      // Si es comunitario y carece de stationId valido, autovincula con la
      // estacion meteo mas cercana al despegue (igual que v113).
      if (bestFav.source === "community") {
        const list = window.PCAuth?.approvedTakeoffs || [];
        const to = list.find(t => t.id === bestFav.refId) || {
          id: bestFav.refId, name: bestFav.name, lat: bestFav.lat, lon: bestFav.lon,
          criteria: bestFav.criteria || null,
        };
        await _selectCommunityTakeoff(to);
        _defaultResolvedOnce = true;
        return;
      }
      const conv = _favToStation(bestFav);
      if (conv) { selectStation(conv.station, conv.opts); _defaultResolvedOnce = true; return; }
    }
  }
  // (3) Despegue comunitario mas cercano a la geolocalizacion.
  if (userLocation) {
    const tlist = window.PCAuth?.approvedTakeoffs || [];
    let bestT = null, bestD = Infinity;
    for (const to of tlist) {
      if (!Number.isFinite(to.lat) || !Number.isFinite(to.lon)) continue;
      const d = haversineKm(userLocation.lat, userLocation.lon, to.lat, to.lon);
      if (d < bestD) { bestD = d; bestT = to; }
    }
    if (bestT) {
      try {
        await _selectCommunityTakeoff(bestT);
        _defaultResolvedOnce = true;
        return;
      } catch (e) { console.warn("resolveDefaultTakeoff nearest takeoff:", e); }
    }
  }
  // (4) Sin geolocalizacion pero con favoritos: cualquiera (el primero).
  if (!userLocation && favs.length) {
    const chosen = favs[0];
    if (chosen.source === "community") {
      const list = window.PCAuth?.approvedTakeoffs || [];
      const to = list.find(t => t.id === chosen.refId) || {
        id: chosen.refId, name: chosen.name, lat: chosen.lat, lon: chosen.lon,
        criteria: chosen.criteria || null,
      };
      await _selectCommunityTakeoff(to);
      _defaultResolvedOnce = true;
      return;
    }
    const conv = _favToStation(chosen);
    if (conv) { selectStation(conv.station, conv.opts); _defaultResolvedOnce = true; return; }
  }
  // (5) Cenes (solo si aun no se resolvio en esta sesion)
  if (!_defaultResolvedOnce) {
    selectStation({ ...DEFAULT_STATION });
    _defaultResolvedOnce = true;
  }
}

// === Alertas al amanecer por despegue favorito (v0.197) ===
// Sustituye el polling cada 5 min: una unica comprobacion al cargar la app
// (y al cambiar la lista de favoritos). Para cada favorito con alertsEnabled:
//   1) Pide pronostico horario + sunrise/sunset (Open-Meteo) para su lat/lon.
//   2) Si ya paso el sunrise de HOY, no se notifico hoy y hay al menos una
//      hora 'ideal' en horario diurno con sus criterios, dispara:
//        - Notification API local (si el usuario tiene permiso y avisos ON).
//        - Banner persistente in-app encima del header.
const SUNRISE_FETCH_CONCURRENCY = 2;

function _sunriseAlertKey(favId, date) {
  const uid = (window.PCAuth && window.PCAuth.user && window.PCAuth.user.uid) || "anon";
  const ymd = date.toISOString().slice(0, 10);
  return `sunriseAlertSent:${uid}:${favId}:${ymd}`;
}

async function _fetchForecastFor(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
              `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation_probability,weather_code,cape` +
              `&daily=sunrise,sunset` +
              `&wind_speed_unit=kmh&timezone=auto&forecast_days=1`;
  return fetchJson(url);
}

function _findIdealRunsToday(fc, criteria, sunriseTs, sunsetTs) {
  const h = fc && fc.hourly;
  if (!h || !h.time) return [];
  const runs = [];
  let cur = null;
  for (let i = 0; i < h.time.length; i++) {
    const ts = new Date(h.time[i]).getTime();
    if (ts < sunriseTs) continue;
    if (ts > sunsetTs) break;
    const dirQ = classifyDirectionWith(criteria, h.wind_direction_10m[i]);
    const spdQ = classifySpeedWith(criteria, h.wind_speed_10m[i], h.wind_gusts_10m[i]);
    let v = combineVerdict(dirQ, spdQ);
    const slot = {
      code: h.weather_code && h.weather_code[i],
      cloud: h.cloud_cover && h.cloud_cover[i],
      precip: h.precipitation_probability && h.precipitation_probability[i],
      cape: h.cape && h.cape[i],
    };
    const risk = weatherRisk(slot);
    if (risk === "storm") v = "bad";
    else if (risk === "rain" && v !== "bad") v = "warn";
    if (v === "ideal") {
      if (!cur) cur = { start: ts, end: ts + 3600 * 1000 };
      else cur.end = ts + 3600 * 1000;
    } else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  return runs;
}

async function _evalSunriseAlertFor(fav) {
  if (!fav || !fav.alertsEnabled) return;
  if (fav.lat == null || fav.lon == null) return;
  const key = _sunriseAlertKey(fav.id, new Date());
  try { if (localStorage.getItem(key)) return; } catch {}
  let fc;
  try { fc = await _fetchForecastFor(fav.lat, fav.lon); } catch { return; }
  const dailySunrise = fc && fc.daily && fc.daily.sunrise && fc.daily.sunrise[0];
  const dailySunset  = fc && fc.daily && fc.daily.sunset  && fc.daily.sunset[0];
  if (!dailySunrise || !dailySunset) return;
  const sunriseTs = new Date(dailySunrise).getTime();
  const sunsetTs  = new Date(dailySunset).getTime();
  if (Date.now() < sunriseTs) return; // aun no amanece en ese despegue
  const runs = _findIdealRunsToday(fc, fav.criteria, sunriseTs, sunsetTs);
  if (!runs.length) return;
  const best = runs.slice().sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
  const fmtHM = (ms) => new Date(ms).toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit" });
  const win = `${fmtHM(best.start)}–${fmtHM(best.end)}`;
  const titleTpl = t("sunrise.notif_title") || t("fav.notify_title");
  const title = titleTpl.replace("{name}", fav.name);
  const bodyTpl = t("sunrise.notif_body") || "{win}";
  const body = bodyTpl.replace("{win}", win);
  // Notification local (solo si el usuario activo avisos desde el menu).
  if (notificationsEnabled()) {
    try {
      new Notification(title, { body, icon: "icon.svg", tag: "sunrise-" + fav.id });
    } catch {}
  }
  // Banner in-app (siempre que la pestana este abierta).
  showSunriseBanner({ name: fav.name, win });
  try { localStorage.setItem(key, String(Date.now())); } catch {}
}

function showSunriseBanner({ name, win }) {
  const host = document.getElementById("sunriseAlertHost");
  if (!host) return;
  const tpl = t("sunrise.banner_text") || "{name} · {win}";
  const text = tpl.replace("{name}", name).replace("{win}", win);
  const card = document.createElement("div");
  card.className = "sunrise-alert";
  const closeLabel = t("sunrise.banner_close") || "close";
  card.innerHTML = `<span class="sa-icon" aria-hidden="true">🌅</span>` +
                   `<span class="sa-text">${escapeHtml(text)}</span>` +
                   `<button type="button" class="sa-close" aria-label="${escapeHtml(closeLabel)}">×</button>`;
  card.querySelector(".sa-close").addEventListener("click", () => card.remove());
  host.appendChild(card);
}

let _sunriseCheckInFlight = false;
async function checkSunriseAlerts() {
  if (_sunriseCheckInFlight) return;
  _sunriseCheckInFlight = true;
  try {
    const favs = ((window.PCAuth && window.PCAuth.favorites) || []).filter(f => f.alertsEnabled);
    if (!favs.length) return;
    for (let i = 0; i < favs.length; i += SUNRISE_FETCH_CONCURRENCY) {
      await Promise.all(
        favs.slice(i, i + SUNRISE_FETCH_CONCURRENCY).map(_evalSunriseAlertFor)
      );
    }
  } finally {
    _sunriseCheckInFlight = false;
  }
}

// Compat: el resto del codigo (onFavoritesChange) llama a esta funcion.
function startFavoriteAlertsPolling() {
  // v0.197: ya no hay polling cada 5 min. Hacemos una unica comprobacion ahora.
  checkSunriseAlerts();
}

// v118: pinta la version actual en el footer al cargar la app.
(function _renderAppVersion() {
  const el = document.getElementById("appVersion");
  if (el) el.textContent = APP_VERSION;
})();
