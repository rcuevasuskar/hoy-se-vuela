// ⚠️ Reemplaza estos valores con los del objeto firebaseConfig que te dio
// la consola de Firebase (Project settings → Your apps → Web app).
// Estas claves son PÚBLICAS por diseño en Firebase; las reglas de Firestore
// y Authorized domains son lo que protege el acceso.
export const firebaseConfig = {
  apiKey: "AIzaSyDhHadCNICkVuTCmtlu-LoYSQwY4ACAPxE",
  authDomain: "parapente-cenes.firebaseapp.com",
  projectId: "parapente-cenes",
  storageBucket: "parapente-cenes.firebasestorage.app",
  messagingSenderId: "990200783989",
  appId: "1:990200783989:web:595870131ab14a187fc43c"
};

// Si todos los campos siguen siendo placeholders, auth.js deshabilita la UI de login.
export function isConfigured() {
  return !firebaseConfig.apiKey.startsWith("TU_") &&
         !firebaseConfig.projectId.startsWith("tu-");
}
