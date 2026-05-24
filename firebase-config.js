// ⚠️ Reemplaza estos valores con los del objeto firebaseConfig que te dio
// la consola de Firebase (Project settings → Your apps → Web app).
// Estas claves son PÚBLICAS por diseño en Firebase; las reglas de Firestore
// y Authorized domains son lo que protege el acceso.
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxx"
};

// Si todos los campos siguen siendo placeholders, auth.js deshabilita la UI de login.
export function isConfigured() {
  return !firebaseConfig.apiKey.startsWith("TU_") &&
         !firebaseConfig.projectId.startsWith("tu-");
}
