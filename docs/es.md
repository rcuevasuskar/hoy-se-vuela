# Hoy se vuela — Documentación

App web (PWA) para consultar el viento en directo, pronósticos y criterios de vuelo en parapente. Pensada para Cenes de la Vega pero extensible a cualquier despegue de la comunidad.

URL: https://rcuevasuskar.github.io/hoy-se-vuela/

---

## 1. Panel principal

Al abrir la app verás de un vistazo el estado del despegue actualmente seleccionado:

- **Brújula principal**: un anillo dividido en 16 sectores (uno por cada dirección de la rosa de los vientos) coloreados según los criterios definidos para ese despegue — <span style="color:#2ecc71">**verde**</span> = direcciones ideales, <span style="color:#f1c40f">**amarillo**</span> = volables y <span style="color:#e74c3c">**rojo**</span> = no recomendadas. Sobre el anillo, una **flecha** apunta a la dirección de la que viene el viento en vivo y el número del centro muestra la velocidad media (km/h). Si el dispositivo lo soporta, el botón 🧭 rota toda la brújula con la orientación real del móvil.
- **Barra vertical de velocidad** (junto a la brújula): es un "anemómetro" del viento medio actual. El fondo se divide en franjas verde / amarillo / rojo correspondientes a los rangos de velocidad media definidos para ese despegue, y la barra rellena sube hasta el valor en directo. Con un golpe de vista compruebas si la intensidad es óptima, justa o excesiva.
- **Velocidad media / rachas / mínima** y hora de la última lectura.
- **Histórico** de las últimas 2/4/6 h (configurable): cada barra es una hora, con flecha de dirección y color por velocidad.
- **Pronóstico** Open‑Meteo (hoy / +24 h). El gráfico incluye:
  - una **banda verde horizontal** que marca el rango ideal de velocidad media,
  - un **mini‑mapa de direcciones** superpuesto en la esquina superior izquierda con los mismos sectores verde/amarillo/rojo del despegue (sin flecha), para cruzar de un vistazo dirección prevista vs. criterio,
  - **separadores de día** y omisión de las horas nocturnas (🌙).
- **Mejor ventana**: detecta hasta dos intervalos diurnos en los que dirección, viento medio y rachas caen todos en zona ideal (verde). Si no hay tramos verdes, ofrece como respaldo el mejor tramo simplemente volable.
- **Estaciones cercanas**: tarjetas mini‑brújula con otras estaciones (Pioupiou, FFVL, Holfuy, AEMET) y aeropuertos METAR dentro del radio adaptativo. Para evitar saturar el panel con estaciones AEMET muy próximas entre sí, la app **prioriza primero las estaciones no‑AEMET** por cercanía y completa hasta 8 huecos eligiendo AEMET con un algoritmo *farthest‑first* (las más dispersas geográficamente respecto a las ya elegidas).
- **Comparativa de días pasados** (1, 7, 30 días) en la misma hora.
- **Guía rápida**: lista de direcciones ideal / volable / mala, rango de viento y rachas máximas, además de las **notas** del despegue (si las hay).
- **Mapa** de Leaflet con el despegue.
- **Botón ↻ Refresh** (cabecera): recarga manualmente observaciones en vivo, pronóstico, comparativa de días y estaciones cercanas, sin tocar la sesión ni el despegue actual.

## 2. Selector de despegue (cabecera)

- **Despegue actual**: nombre del despegue cargado. Junto a él se muestran iconos de acción (favorito, hogar, alertas, sugerir cambios).
- **Buscador**: escribe parte del nombre para filtrar; muestra primero tus favoritos y luego el resto ordenados por distancia.
- **Botón 📍 Localizar**: usa la geolocalización del dispositivo para que las distancias se calculen desde tu posición actual.
- **Radio**: ajusta el radio de búsqueda (10–300 km).
- En cada fila:
  - **★ / ☆** marcar/desmarcar favorito.
  - **👑 / ♛** marcar como "hogar" (aparece primero y arranca por defecto).
  - **🔔 / 🔕** activar/desactivar alertas de condiciones ideales.
  - **+** proponer un despegue nuevo (estaciones sin registrar en la comunidad).
  - **✎** editar / sugerir cambios sobre un despegue ya registrado en la comunidad.

## 3. Idiomas

Selector de banderas SVG con seis idiomas: español, inglés, alemán, francés, catalán y euskera. La selección se guarda y se sincroniza con tu cuenta.

## 4. Cuenta y favoritos

Botón "👤". Puedes:

- Entrar con Google, email/contraseña o enlace mágico (sin contraseña).
- Crear cuenta y modo invitado (anónimo).
- Tus favoritos, despegue habitual ("hogar"), preferencias de idioma, radio y ventana horaria se guardan en la nube.

## 5. Alertas de condiciones ideales

Si activas la 🔔 en un favorito, la app revisa periódicamente las condiciones de ese despegue y te notifica cuando son ideales (dirección + viento dentro de criterios). Requiere permiso de notificaciones del navegador.

## 6. Proponer / editar despegues (comunidad)

La app es **colaborativa**: cualquier usuario registrado puede aportar y mejorar la información de cualquier despegue. Esto incluye datos básicos y los criterios técnicos que alimentan la brújula y la barra de viento.

- **Proponer un despegue nuevo** con el botón **+** del buscador (útil cuando una estación aún no está registrada en la comunidad).
- **Sugerir cambios** sobre un despegue ya existente con el botón **✎** junto al título del despegue actual.
- Información editable: **nombre, coordenadas, altitud, estación enlazada (Pioupiou/Holfuy/AEMET), orientaciones aptas, rangos de viento (mín., máx. y rachas), club, web y notas libres** del despegue.
- Para situar las **coordenadas** dispones de tres opciones: escribir lat/lon a mano, **buscar un lugar** por nombre (🔎) o **elegir el punto en un mapa** (🗺️). El selector en mapa abre un sub‑diálogo con capas **Satélite**, **Topo** y **Calles** — muy útil para identificar la ladera o cresta exacta del despegue. Toca el mapa o arrastra el marcador y pulsa *Usar estas coordenadas* para confirmar.
- Definir **criterios direccionales** marcando cada una de las 16 direcciones como *ideal / volable / mala* sobre una rosa de los vientos. Estos criterios son los que pintan los sectores de la brújula principal, del mini‑mapa del gráfico y de las tarjetas de estaciones cercanas.
- Un administrador revisa y aprueba/rechaza la propuesta.
- Una vez aprobado, todos los usuarios lo verán en el buscador (con el badge de Comunidad) y podrán usarlo como despegue actual con sus propios criterios.

## 7. Botón de orientación 🧭

Si el dispositivo lo soporta, rota la brújula con la orientación del móvil (útil sobre el terreno).

## 8. Instalación PWA

Pulsa 📲 (cuando esté disponible) para instalar la app en el dispositivo y usarla offline. El service worker cachea HTML/CSS/JS; las llamadas a datos en vivo siempre van a la red.

## 9. Fuentes de datos

- **Pioupiou** (`api.pioupiou.fr`): estaciones eólicas comunitarias en directo y archivo.
- **FFVL** (`data.ffvl.fr`): balises francesas.
- **Holfuy** (`api.holfuy.com`): estaciones Holfuy europeas.
- **AEMET** (`opendata.aemet.es`): estaciones meteorológicas oficiales de España. Se descodifican en `iso-8859-15` para preservar los acentos en los nombres.
- **Open‑Meteo**: pronóstico horario y diario.
- **AviationWeather.gov (NOAA)**: METAR de aeropuertos cercanos.
- **Firebase**: autenticación, favoritos, despegues comunitarios.

## 10. Limitaciones y avisos

- Los datos son orientativos. **Valora siempre las condiciones in situ** antes de volar.
- El pronóstico Open‑Meteo no tiene en cuenta la orografía local con detalle.
- Las notificaciones pueden retrasarse si la pestaña está cerrada (depende del navegador y del sistema).
- **Riesgo de tormenta**: se muestra un porcentaje (0–100 %) basado en CAPE, probabilidad de precipitación y código de tiempo WMO. Niveles: **ninguno** < 25 %, **bajo** ≥ 25 %, **medio** ≥ 50 %, **alto** ≥ 75 %. Es una estimación; consulta siempre boletines oficiales.
- **Pronóstico nocturno**: las horas entre la puesta y la salida del sol se omiten automáticamente en el resumen y en la gráfica (aparece un separador 🌙 Noche).

---

Repositorio: https://github.com/rcuevasuskar/hoy-se-vuela
