# Hoy se vuela

Web/PWA estática colaborativa para consultar el viento en directo, pronóstico y veredicto de vuelo en despegues de parapente. Multi-fuente (Pioupiou, AEMET, Holfuy, METAR) y multi-idioma.

🌐 **Demo**: https://rcuevasuskar.github.io/hoy-se-vuela/

## Datos

- **Viento en vivo**: estación Pioupiou 1638 (api.pioupiou.fr)
- **Pronóstico**: Open-Meteo (viento, nubes, precipitación, CAPE, temperatura, sondeos)
- **Estaciones cercanas**: Pioupiou en 50 km + Aeropuerto de Granada (LEGR) vía Open-Meteo
- **Mapa**: OpenStreetMap

## Criterios de volabilidad

- Cada despegue tiene sus propios criterios editables (16 sectores de dirección + `windMin` / `windMax` / `gustMax`).
- Veredicto por hora combina dirección, media de viento, rachas y riesgo meteo (lluvia, tormenta, CAPE).
- Degradado si hay lluvia o riesgo de tormenta.

## Funciones principales

- **Viento ahora**: lectura en vivo + mini-brújula con sectores de aptitud del despegue.
- **Pronóstico horario** (Open-Meteo): líneas de media y racha, flechas de dirección coloreadas, franjas verde (ideal) y amarilla (racha aceptable) e icono ⚠️ por hora cuando la racha supera el límite.
- **Mejor ventana del día**: detecta franjas ideales o, si no hay, volables con aviso.
- **Sondeos termodinámicos** y mapa de despegues cercanos.
- **Alertas al amanecer**: banner descartable con resumen del día (verde, ancho del contenedor principal).
- **Usuarios** (Firebase Auth + Firestore): despegues favoritos, criterios personalizados, sincronización entre dispositivos.
- **6 idiomas**: ES / EN / DE / FR / EU / CA.
- **Tema**: claro u oscuro (oscuro por defecto).

## Stack

HTML + CSS + JS puro, sin build. Chart.js, Leaflet. PWA con Service Worker. Firebase 10 (Auth + Firestore). i18n inline en `app.js`.

## Instalación como PWA

Desde el navegador móvil: abrir la web → menú → "Añadir a pantalla de inicio". Funciona offline (cache-first del shell, network-first de datos).

## Uso local

```sh
npx http-server -p 8080 -c-1
```

## Versionado

`APP_VERSION` (en `app.js`) y `CACHE` (en `sw.js`) se mantienen sincronizados en cada release para forzar la invalidación del cache de la PWA.

No oficial. Valora siempre las condiciones in situ.
