# Parapente Cenes — Documentación

App web (PWA) para consultar el viento en directo, pronósticos y criterios de vuelo en parapente. Pensada para Cenes de la Vega pero extensible a cualquier despegue de la comunidad.

URL: https://rcuevasuskar.github.io/parapente-cenes/

---

## 1. Panel principal

Al abrir la app verás de un vistazo el estado del despegue actualmente seleccionado:

- **Brújula principal**: muestra los rangos de dirección de vuelo definidos para ese despegue (sectores verde = ideal, amarillo = volable, rojo = malo). Una flecha gira con la dirección actual del viento.
- **Velocidad media / rachas / mínima** y hora de la última lectura.
- **Histórico** de las últimas 2/4/6 h (configurable): cada barra es una hora, con flecha de dirección y color por velocidad.
- **Pronóstico** Open‑Meteo (hoy / +24 h).
- **Estaciones cercanas**: tarjetas mini‑brújula con otras estaciones Pioupiou/FFVL y aeropuertos METAR dentro del radio elegido.
- **Mejor ventana**: cálculo aproximado del mejor tramo del día.
- **Guía rápida**: lista de direcciones ideal / volable / mala, rango de viento y rachas máximas, además de las **notas** del despegue (si las hay).
- **Mapa** de Leaflet con el despegue.

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

Cualquier usuario registrado puede:

- **Proponer un despegue** desde el buscador o desde el ✎ del despegue actual.
- Indicar **nombre, coordenadas, altitud, estación Pioupiou enlazada, orientaciones aptas y notas**.
- Definir **criterios**: dirección por dirección (ideal/volable/malo) usando la rosa de los vientos y los rangos numéricos (mín., máx., rachas).
- Un administrador revisa y aprueba/rechaza la propuesta.
- Una vez aprobado, todos los usuarios lo verán en el buscador (con el badge de Comunidad) y podrán usarlo como despegue actual con sus propios criterios.

## 7. Botón de orientación 🧭

Si el dispositivo lo soporta, rota la brújula con la orientación del móvil (útil sobre el terreno).

## 8. Instalación PWA

Pulsa 📲 (cuando esté disponible) para instalar la app en el dispositivo y usarla offline. El service worker cachea HTML/CSS/JS; las llamadas a datos en vivo siempre van a la red.

## 9. Fuentes de datos

- **Pioupiou** (`api.pioupiou.fr`): estaciones eólicas comunitarias en directo y archivo.
- **FFVL** (`data.ffvl.fr`): balises francesas.
- **Open‑Meteo**: pronóstico horario y diario.
- **AviationWeather.gov (NOAA)**: METAR de aeropuertos cercanos.
- **Firebase**: autenticación, favoritos, despegues comunitarios.

## 10. Limitaciones y avisos

- Los datos son orientativos. **Valora siempre las condiciones in situ** antes de volar.
- El pronóstico Open‑Meteo no tiene en cuenta la orografía local con detalle.
- Las notificaciones pueden retrasarse si la pestaña está cerrada (depende del navegador y del sistema).
- **Riesgo de tormenta**: se muestra un porcentaje (0–100 %) basado en CAPE, probabilidad de precipitación y código de tiempo WMO. Niveles: **bajo** ≥ 25 %, **medio** ≥ 50 %, **alto** ≥ 75 %. Por debajo del 25 % no se muestra. Es una estimación; consulta siempre boletines oficiales.

---

Repositorio: https://github.com/rcuevasuskar/parapente-cenes
