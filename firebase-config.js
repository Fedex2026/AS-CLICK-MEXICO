import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

/* =========================================
   CONFIGURACIÓN DE FIREBASE
========================================= */

const firebaseConfig = {
  apiKey: "AIzaSyDeuQxzRhfVB9rXKD1pnOrNMXbrZnDj4UU",
  authDomain: "as-clicl-mexico.firebaseapp.com",
  databaseURL: "https://as-clicl-mexico-default-rtdb.firebaseio.com",
  projectId: "as-clicl-mexico",
  storageBucket: "as-clicl-mexico.firebasestorage.app",
  messagingSenderId: "908429271001",
  appId: "1:908429271001:web:40149a91fb2eef3ab4c3c8"
};

/* =========================================
   INICIALIZAR FIREBASE
========================================= */

const app = initializeApp(firebaseConfig);

/* =========================================
   SERVICIOS DE FIREBASE
========================================= */

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/* =========================================
   EXPORTACIONES
========================================= */

export {
  app,
  auth,
  db,
  storage
};
