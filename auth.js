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
  collection, addDoc, deleteDoc, onSnapshot, query, orderBy, where,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Exponemos un objeto global para que app.js (clásico) pueda interactuar.
window.PCAuth = {
  ready: false,
  user: null,
  prefs: null,
  favorites: [],
  isAdmin: false,
  approvedTakeoffs: [],
  pendingTakeoffs: [],
  onUserChange: null,   // callback(user|null, prefs)
  onPrefsChange: null,  // callback(prefs)
  onFavoritesChange: null, // callback([fav,…])
  onApprovedTakeoffsChange: null, // callback([takeoff,…])
  onPendingTakeoffsChange: null,  // callback([takeoff,…])
  onAdminChange: null,  // callback(isAdmin)
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
    const btn = $("userBtn");
    // Avatares: cabecera del panel + bot\u00f3n principal del men\u00fa (+ legacy item).
    const avatars = [
      document.querySelector(".um-user-header .um-user-avatar"),
      document.querySelector("#userMenuBtn .um-avatar"),
      btn?.querySelector(".ts-user-avatar"),
    ].filter(Boolean);
    const setAvatar = (txt) => avatars.forEach(a => { a.textContent = txt; });
    if (!label) return;
    if (!user) {
      label.textContent = t("auth.guest");
      btn?.classList.remove("is-logged", "is-anon");
      setAvatar("\ud83d\udc64");
      return;
    }
    if (user.isAnonymous) {
      label.textContent = t("auth.anon");
      btn?.classList.remove("is-logged");
      btn?.classList.add("is-anon");
      setAvatar("\ud83d\udc64");
      return;
    }
    const name = user.displayName || user.email || t("auth.user");
    label.textContent = name;
    btn?.classList.add("is-logged");
    btn?.classList.remove("is-anon");
    setAvatar("\ud83d\udc64");
  }

  function openModal()  { $("authModal")?.removeAttribute("hidden"); }
  function closeModal() {
    $("authModal")?.setAttribute("hidden", "");
    $("authError").textContent = "";
    // v0.216: limpia el motivo contextual al cerrar para que no aparezca
    // en aperturas posteriores no relacionadas.
    const r = $("authReason"); if (r) { r.textContent = ""; r.hidden = true; }
  }
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
    const payload = {
      source: station.source || "pioupiou",  // "pioupiou" | "community"
      refId: String(station.refId ?? station.id ?? ""),
      stationId: station.stationId != null && station.stationId !== "" ? String(station.stationId) : null,
      name: station.name,
      lat: Number(station.lat), lon: Number(station.lon),
      criteria: station.criteria || null,
      alertsEnabled: !!station.alertsEnabled,
      addedAt: serverTimestamp(),
    };
    return await addDoc(collection(db, "users", u.uid, "favorites"), payload);
  };
  window.PCAuth.updateFavorite = async (favId, patch) => {
    const u = auth.currentUser;
    if (!u || u.isAnonymous) return;
    await updateDoc(doc(db, "users", u.uid, "favorites", favId), patch);
  };
  window.PCAuth.removeFavorite = async (favId) => {
    const u = auth.currentUser;
    if (!u || u.isAnonymous) return;
    await deleteDoc(doc(db, "users", u.uid, "favorites", favId));
  };
  window.PCAuth.setHomeFavorite = async (favId) => {
    const u = auth.currentUser;
    if (!u || u.isAnonymous) return;
    await updateDoc(doc(db, "users", u.uid), { homeFavId: favId || null, updatedAt: serverTimestamp() });
    if (window.PCAuth.prefs) window.PCAuth.prefs.homeFavId = favId || null;
  };

  // === Despegues comunitarios ===
  let unsubPending = null;
  async function checkAdmin(uid) {
    try {
      const snap = await getDoc(doc(db, "admins", uid));
      return snap.exists();
    } catch (e) { console.warn("[auth] checkAdmin", e); return false; }
  }

  // Escucha global de despegues aprobados (visibles para todos).
  function listenApprovedTakeoffs() {
    const qy = query(collection(db, "takeoffs"), where("status", "==", "approved"));
    onSnapshot(qy, (qs) => {
      const list = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      window.PCAuth.approvedTakeoffs = list;
      window.PCAuth.onApprovedTakeoffsChange?.(list);
    }, (e) => console.warn("[auth] approvedTakeoffs", e));
  }

  function listenPendingTakeoffs() {
    if (unsubPending) { try { unsubPending(); } catch {} unsubPending = null; }
    if (!window.PCAuth.isAdmin) {
      window.PCAuth.pendingTakeoffs = [];
      window.PCAuth.onPendingTakeoffsChange?.([]);
      return;
    }
    const qy = query(collection(db, "takeoffs"), where("status", "==", "pending"));
    unsubPending = onSnapshot(qy, (qs) => {
      const list = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      window.PCAuth.pendingTakeoffs = list;
      window.PCAuth.onPendingTakeoffsChange?.(list);
    }, (e) => console.warn("[auth] pendingTakeoffs", e));
  }

  window.PCAuth.submitTakeoff = async (data) => {
    const u = auth.currentUser;
    if (!u || u.isAnonymous) throw new Error("login_required");
    const isAdminUser = !!window.PCAuth.isAdmin;
    // Admin + sugerencia sobre despegue existente → aplica directo sin pasar por pendiente.
    if (isAdminUser && data.targetId) {
      await updateDoc(doc(db, "takeoffs", data.targetId), {
        name: String(data.name || "").trim(),
        lat: Number(data.lat),
        lon: Number(data.lon),
        alt: data.alt != null && data.alt !== "" ? Number(data.alt) : null,
        orientations: String(data.orientations || "").trim(),
        stationId: data.stationId != null && data.stationId !== "" ? String(data.stationId).trim() : null,
        notes: String(data.notes || "").trim() || null,
        windyUrl: (data.windyUrl ? String(data.windyUrl).trim() : null) || null,
        volandooUrl: (data.volandooUrl ? String(data.volandooUrl).trim() : null) || null,
        criteria: data.criteria || null,
        lastSuggestionBy: u.uid,
        lastSuggestionAt: serverTimestamp(),
        reviewedBy: u.uid,
        reviewedAt: serverTimestamp(),
      });
      // v171: releer el doc desde Firestore para confirmar que el write se
      // aplico realmente. Si los valores no coinciden con lo enviado, algo lo
      // sobrescribio o las reglas lo rechazaron silenciosamente.
      let serverDoc = null;
      try {
        const snap = await getDoc(doc(db, "takeoffs", data.targetId));
        if (snap.exists()) serverDoc = { id: snap.id, ...snap.data() };
      } catch (e) { console.warn("[auth] post-write readback failed:", e); }
      return { id: data.targetId, autoApplied: true, serverDoc };
    }
    const payload = {
      name: String(data.name || "").trim(),
      lat: Number(data.lat),
      lon: Number(data.lon),
      alt: data.alt != null && data.alt !== "" ? Number(data.alt) : null,
      orientations: String(data.orientations || "").trim(),
      stationId: data.stationId != null && data.stationId !== "" ? String(data.stationId).trim() : null,
      notes: String(data.notes || "").trim() || null,
      windyUrl: (data.windyUrl ? String(data.windyUrl).trim() : null) || null,
      volandooUrl: (data.volandooUrl ? String(data.volandooUrl).trim() : null) || null,
      criteria: data.criteria || null,
      targetId: data.targetId || null,
      status: "pending", // las reglas exigen 'pending' en creación; si admin, se aprueba justo después.
      submittedBy: u.uid,
      submittedByName: u.displayName || u.email || "anon",
      submittedAt: serverTimestamp(),
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
    };
    if (!payload.name || !Number.isFinite(payload.lat) || !Number.isFinite(payload.lon)) {
      throw new Error("invalid_fields");
    }
    const ref = await addDoc(collection(db, "takeoffs"), payload);
    // Admin: aprueba automáticamente tras crear (update sí permitido por reglas).
    if (isAdminUser) {
      try {
        await updateDoc(ref, {
          status: "approved",
          reviewedBy: u.uid,
          reviewedAt: serverTimestamp(),
        });
      } catch (e) { console.warn("[auth] auto-approve failed:", e); }
    }
    return ref;
  };

  window.PCAuth.approveTakeoff = async (id) => {
    const u = auth.currentUser;
    if (!u || !window.PCAuth.isAdmin) throw new Error("not_admin");
    // ¿Es una sugerencia de cambios sobre otro despegue? → fusionar y eliminar.
    const list = window.PCAuth.pendingTakeoffs || [];
    const it = list.find(x => x.id === id);
    if (it && it.targetId) {
      const patch = {
        name: it.name,
        lat: it.lat,
        lon: it.lon,
        alt: it.alt ?? null,
        orientations: it.orientations || "",
        stationId: it.stationId ?? null,
        notes: it.notes ?? null,
        windyUrl: it.windyUrl ?? null,
        volandooUrl: it.volandooUrl ?? null,
        criteria: it.criteria || null,
        lastSuggestionBy: it.submittedBy,
        lastSuggestionAt: serverTimestamp(),
        reviewedBy: u.uid,
        reviewedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "takeoffs", it.targetId), patch);
      await deleteDoc(doc(db, "takeoffs", id));
      return;
    }
    await updateDoc(doc(db, "takeoffs", id), {
      status: "approved", reviewedBy: u.uid, reviewedAt: serverTimestamp(), rejectionReason: null,
    });
  };
  window.PCAuth.rejectTakeoff = async (id, reason) => {
    const u = auth.currentUser;
    if (!u || !window.PCAuth.isAdmin) throw new Error("not_admin");
    await updateDoc(doc(db, "takeoffs", id), {
      status: "rejected", reviewedBy: u.uid, reviewedAt: serverTimestamp(),
      rejectionReason: String(reason || "").trim() || null,
    });
  };
  window.PCAuth.deleteTakeoff = async (id) => {
    const u = auth.currentUser;
    if (!u || !window.PCAuth.isAdmin) throw new Error("not_admin");
    await deleteDoc(doc(db, "takeoffs", id));
  };

  // Arranca el listener global de aprobados (lectura abierta por reglas).
  listenApprovedTakeoffs();

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
        const admin = await checkAdmin(user.uid);
        window.PCAuth.isAdmin = admin;
        window.PCAuth.onAdminChange?.(admin);
        listenPendingTakeoffs();
        window.dispatchEvent(new CustomEvent("pcuserchange", { detail: { user, prefs, isAdmin: admin } }));
        window.PCAuth.onUserChange?.(user, prefs);
      } catch (e) { console.warn("[auth] loadUserPrefs", e); }
    } else {
      window.PCAuth.prefs = null;
      window.PCAuth.favorites = [];
      window.PCAuth.isAdmin = false;
      window.PCAuth.onAdminChange?.(false);
      listenPendingTakeoffs();
      window.dispatchEvent(new CustomEvent("pcuserchange", { detail: { user, prefs: null, isAdmin: false } }));
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
  getRedirectResult(auth).then(res => {
    if (res && res.user) console.log("[auth] redirect ok", res.user.uid);
  }).catch(e => {
    console.warn("[auth] redirect result", e);
    try { alert("Login redirect error: " + (e?.code || e?.message || e)); } catch {}
  });

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
        // Intentamos siempre popup (funciona en Chrome Android y desktop).
        // Solo si el navegador bloquea el popup caemos a redirect.
        try {
          await signInWithPopup(auth, provider);
          closeModal();
        } catch (popupErr) {
          console.warn("[auth] popup failed, fallback to redirect", popupErr?.code);
          if (popupErr?.code === "auth/popup-blocked"
              || popupErr?.code === "auth/popup-closed-by-user"
              || popupErr?.code === "auth/operation-not-supported-in-this-environment") {
            await signInWithRedirect(auth, provider);
          } else {
            throw popupErr;
          }
        }
      } catch (e) { setError(humanError(e) + " [" + (e?.code||"?") + "]"); }
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
