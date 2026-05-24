// === Autenticación y sincronización de preferencias con Firebase ===
// Módulo ESM cargado desde index.html con <script type="module" src="auth.js"></script>.
import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInAnonymously, signOut,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  linkWithCredential, EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, deleteDoc, onSnapshot, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Exponemos un objeto global para que app.js (clásico) pueda interactuar.
window.PCAuth = {
  ready: false,
  user: null,
  prefs: null,
  favorites: [],
  onUserChange: null,   // callback(user|null, prefs)
  onPrefsChange: null,  // callback(prefs)
  onFavoritesChange: null, // callback([fav,…])
};

if (!isConfigured()) {
  console.warn("[auth] firebase-config.js sin valores reales; login deshabilitado.");
  // Ocultamos el botón si existe.
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("userBtn");
    if (btn) btn.hidden = true;
  });
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  window.PCAuth.ready = true;
  window.PCAuth._auth = auth;
  window.PCAuth._db = db;

  // === Estado UI ===
  const $ = (id) => document.getElementById(id);
  const t = (key) => (window.t ? window.t(key) : key);

  function setUserLabel(user) {
    const label = $("userBtnLabel");
    if (!label) return;
    if (!user) { label.textContent = t("auth.guest"); return; }
    if (user.isAnonymous) { label.textContent = t("auth.anon"); return; }
    label.textContent = user.displayName || user.email || t("auth.user");
  }

  function openModal()  { $("authModal")?.removeAttribute("hidden"); }
  function closeModal() { $("authModal")?.setAttribute("hidden", ""); $("authError").textContent = ""; }
  function setError(msg) { $("authError").textContent = msg || ""; }
  function showSection(name) {
    document.querySelectorAll(".auth-section").forEach(s => {
      s.hidden = s.dataset.section !== name;
    });
  }

  // === Firestore: preferencias y favoritos ===
  async function loadUserPrefs(uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // Inicializa con localStorage actual
      const init = {
        lang: localStorage.getItem("lang") || "es",
        whHours: parseInt(localStorage.getItem("whHours") || "6", 10),
        tsRadius: parseInt(localStorage.getItem("tsRadius") || "50", 10),
        selectedStation: localStorage.getItem("selectedStation") || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, init);
      return init;
    }
    return snap.data();
  }

  function listenFavorites(uid) {
    const col = collection(db, "users", uid, "favorites");
    onSnapshot(query(col, orderBy("addedAt", "desc")), (qs) => {
      const favs = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      window.PCAuth.favorites = favs;
      window.PCAuth.onFavoritesChange?.(favs);
    });
  }

  // API pública para que app.js empuje cambios.
  window.PCAuth.savePref = async (key, value) => {
    const u = auth.currentUser;
    if (!u || u.isAnonymous) return; // anónimos solo en localStorage
    try {
      await updateDoc(doc(db, "users", u.uid), { [key]: value, updatedAt: serverTimestamp() });
    } catch (e) { console.warn("[auth] savePref", e); }
  };
  window.PCAuth.addFavorite = async (station) => {
    const u = auth.currentUser;
    if (!u || u.isAnonymous) return;
    await addDoc(collection(db, "users", u.uid, "favorites"), {
      stationId: station.id, name: station.name, lat: station.lat, lon: station.lon,
      addedAt: serverTimestamp(),
    });
  };
  window.PCAuth.removeFavorite = async (favId) => {
    const u = auth.currentUser;
    if (!u || u.isAnonymous) return;
    await deleteDoc(doc(db, "users", u.uid, "favorites", favId));
  };

  // === onAuthStateChanged ===
  onAuthStateChanged(auth, async (user) => {
    window.PCAuth.user = user;
    setUserLabel(user);
    if (user && !user.isAnonymous) {
      try {
        const prefs = await loadUserPrefs(user.uid);
        window.PCAuth.prefs = prefs;
        // Aplica prefs remotas a localStorage (la app las leerá al refrescar UI)
        if (prefs.lang) localStorage.setItem("lang", prefs.lang);
        if (prefs.whHours) localStorage.setItem("whHours", String(prefs.whHours));
        if (prefs.tsRadius) localStorage.setItem("tsRadius", String(prefs.tsRadius));
        if (prefs.selectedStation) localStorage.setItem("selectedStation", prefs.selectedStation);
        listenFavorites(user.uid);
        window.PCAuth.onUserChange?.(user, prefs);
      } catch (e) { console.warn("[auth] loadUserPrefs", e); }
    } else {
      window.PCAuth.prefs = null;
      window.PCAuth.favorites = [];
      window.PCAuth.onUserChange?.(user, null);
    }
  });

  // === Magic link: completar inicio si llegamos por enlace ===
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem("pcEmailForSignIn");
    if (!email) email = window.prompt(t("auth.confirm_email"));
    if (email) {
      signInWithEmailLink(auth, email, window.location.href)
        .then(() => {
          window.localStorage.removeItem("pcEmailForSignIn");
          // Limpia el querystring del magic link
          history.replaceState({}, "", window.location.pathname);
        })
        .catch(e => console.warn("[auth] magic link", e));
    }
  }

  // Resultado de signInWithRedirect (mobile fallback)
  getRedirectResult(auth).catch(e => console.warn("[auth] redirect result", e));

  // === Handlers UI (esperan a DOMContentLoaded) ===
  document.addEventListener("DOMContentLoaded", () => {
    $("userBtn")?.addEventListener("click", () => {
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        const nameEl = $("authAccountName");
        if (nameEl) nameEl.textContent = auth.currentUser.displayName || auth.currentUser.email || auth.currentUser.uid;
        showSection("account"); openModal();
      } else {
        showSection("login"); openModal();
      }
    });
    $("authClose")?.addEventListener("click", closeModal);
    $("authModal")?.addEventListener("click", (e) => {
      if (e.target.id === "authModal") closeModal();
    });

    // Tabs login/register
    document.querySelectorAll("[data-auth-tab]").forEach(b => {
      b.addEventListener("click", () => showSection(b.dataset.authTab));
    });

    $("authEmailLoginBtn")?.addEventListener("click", async () => {
      setError("");
      const email = $("authEmail").value.trim();
      const pwd = $("authPassword").value;
      if (!email || !pwd) return setError(t("auth.err_fields"));
      console.log("[auth] login attempt", email);
      try { await signInWithEmailAndPassword(auth, email, pwd); console.log("[auth] login ok"); closeModal(); }
      catch (e) { console.error("[auth] login error", e); setError(humanError(e) + " [" + (e?.code||"?") + "]"); }
    });

    $("authRegisterBtn")?.addEventListener("click", async () => {
      setError("");
      const email = $("authRegEmail").value.trim();
      const pwd = $("authRegPassword").value;
      if (!email || pwd.length < 6) return setError(t("auth.err_pwd_short"));
      console.log("[auth] register attempt", email);
      try { await createUserWithEmailAndPassword(auth, email, pwd); console.log("[auth] register ok"); closeModal(); }
      catch (e) { console.error("[auth] register error", e); setError(humanError(e) + " [" + (e?.code||"?") + "]"); }
    });

    $("authGoogleBtn")?.addEventListener("click", async () => {
      setError("");
      const provider = new GoogleAuthProvider();
      try {
        // Popup en desktop; redirect fallback en móviles donde el popup suele bloquearse
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        if (isMobile) await signInWithRedirect(auth, provider);
        else { await signInWithPopup(auth, provider); closeModal(); }
      } catch (e) { setError(humanError(e)); }
    });

    $("authAnonBtn")?.addEventListener("click", async () => {
      setError("");
      try { await signInAnonymously(auth); closeModal(); }
      catch (e) { setError(humanError(e)); }
    });

    $("authMagicBtn")?.addEventListener("click", async () => {
      setError("");
      const email = $("authEmail").value.trim();
      if (!email) return setError(t("auth.err_email_required"));
      const actionCodeSettings = {
        url: window.location.origin + window.location.pathname,
        handleCodeInApp: true,
      };
      try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem("pcEmailForSignIn", email);
        setError(t("auth.magic_sent"));
      } catch (e) { setError(humanError(e)); }
    });

    $("authLogoutBtn")?.addEventListener("click", async () => {
      try { await signOut(auth); closeModal(); }
      catch (e) { setError(humanError(e)); }
    });
  });

  function humanError(e) {
    const code = e?.code || "";
    if (code.includes("invalid-email")) return t("auth.err_invalid_email");
    if (code.includes("user-not-found")) return t("auth.err_user_not_found");
    if (code.includes("wrong-password") || code.includes("invalid-credential")) return t("auth.err_wrong_password");
    if (code.includes("email-already-in-use")) return t("auth.err_email_in_use");
    if (code.includes("weak-password")) return t("auth.err_pwd_short");
    if (code.includes("popup-blocked")) return t("auth.err_popup_blocked");
    return e?.message || String(e);
  }
}
