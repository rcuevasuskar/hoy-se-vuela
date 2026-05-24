# Hoy se vuela

Web/PWA estática colaborativa para consultar el viento en directo, pronóstico y veredicto de vuelo en despegues de parapente. Multi-fuente (Pioupiou, AEMET, Holfuy, METAR) y multi-idioma.

🌐 **Demo**: https://rcuevasuskar.github.io/hoy-se-vuela/

## Datos

- **Viento en vivo**: estación Pioupiou 1638 (api.pioupiou.fr)
- **Pronóstico**: Open-Meteo (viento, nubes, precipitación, CAPE, temperatura)
- **Estaciones cercanas**: Pioupiou en 50 km + Aeropuerto de Granada (LEGR) vía Open-Meteo
- **Mapa**: OpenStreetMap

## Criterios de volabilidad

- **Ideal**: dirección W–NNW, media 5–15 km/h, rachas ≤ 25 km/h
- **Volable**: N o SW, o viento fuera del rango ideal pero bajo el límite
- **Demasiado fuerte**: media ≥ 20 km/h o rachas ≥ 30 km/h
- **Malo**: componentes Este (NE, E, SE)
- Degradado si hay lluvia o riesgo de tormenta

## Stack

HTML + CSS + JS puro, sin build. Chart.js, Leaflet. PWA con Service Worker. i18n ES/EN/DE/FR.

## Uso local

```sh
npx http-server -p 8080 -c-1
```

No oficial. Valora siempre las condiciones in situ.
