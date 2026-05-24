// === Holfuy ===
// Holfuy NO ofrece API publica. Para usuarios externos al duenio de la estacion,
// dan acceso por email (info@holfuy.hu) con un maximo de 3 estaciones.
//
// 1) Solicita la clave por email indicando: tu proyecto, IDs que quieres consultar,
//    y como usaras los datos.
// 2) Cuando te respondan, pega aqui la "API password" y las estaciones autorizadas.
// 3) Los IDs los encuentras en https://holfuy.com/en/weather/list o el mapa:
//    https://holfuy.com/en/weather/map
//
// Mientras no haya clave o estaciones configuradas, el chip Holfuy del buscador
// simplemente no anade resultados (no rompe la app).

window.HOLFUY_API_PASSWORD = "";

// Cada entrada: { id: <int>, lat: <float>, lon: <float>, name: "<opcional>" }
// Necesitamos lat/lon porque la API live no las devuelve.
window.HOLFUY_STATIONS = [
  // Ejemplos (sustituye por los tuyos cuando tengas la clave):
  // { id: 101,  lat: 42.910, lon:  0.140, name: "Soulan (Pirineos)" },
  // { id: 1234, lat: 45.500, lon:  6.500, name: "Col du Glandon (Alpes)" },
];
