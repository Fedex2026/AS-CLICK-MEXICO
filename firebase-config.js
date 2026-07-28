import {
  db,
  storage
} from "./firebase-config.js";

import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  increment,
  limit
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

// ============================================================
// CONFIGURACIÓN GENERAL
// ============================================================

const COLLECTION_ALERTS = "alertasEmergencia";
const SUBCOLLECTION_UPDATES = "actualizaciones";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ACTIONS = {
  voy_para_alla: {
    label: "Voy para allá",
    icon: "🚗",
    status: "apoyo_en_camino",
    statusLabel: "APOYO EN CAMINO"
  },
  llego_policia: {
    label: "Llegó la policía",
    icon: "👮",
    status: "policia_en_sitio",
    statusLabel: "POLICÍA EN SITIO"
  },
  cliente_esta_bien: {
    label: "Cliente está bien",
    icon: "✅",
    status: "cliente_seguro",
    statusLabel: "CLIENTE ESTÁ BIEN"
  },
  vehiculo_localizado: {
    label: "Vehículo localizado",
    icon: "🔎",
    status: "vehiculo_localizado",
    statusLabel: "VEHÍCULO LOCALIZADO"
  },
  vehiculo_recuperado: {
    label: "Vehículo recuperado",
    icon: "🏁",
    status: "vehiculo_recuperado",
    statusLabel: "VEHÍCULO RECUPERADO"
  }
};

// ============================================================
// REFERENCIAS DEL DOM
// ============================================================

const ui = {
  loadingPanel: document.getElementById("loadingPanel"),
  errorPanel: document.getElementById("errorPanel"),
  errorTitle: document.getElementById("errorTitle"),
  errorMessage: document.getElementById("errorMessage"),
  trackingContent: document.getElementById("trackingContent"),
  connectionStatus: document.getElementById("connectionStatus"),

  caseFolio: document.getElementById("caseFolio"),
  caseStatus: document.getElementById("caseStatus"),
  alertType: document.getElementById("alertType"),
  createdAt: document.getElementById("createdAt"),
  updatedAt: document.getElementById("updatedAt"),

  vehicleName: document.getElementById("vehicleName"),
  vehiclePlates: document.getElementById("vehiclePlates"),
  vehicleColor: document.getElementById("vehicleColor"),
  vehicleVin: document.getElementById("vehicleVin"),

  memberName: document.getElementById("memberName"),
  membershipNumber: document.getElementById("membershipNumber"),
  memberPhone: document.getElementById("memberPhone"),

  locationPlaceholder: document.getElementById("locationPlaceholder"),
  openLocationButton: document.getElementById("openLocationButton"),

  actionButtons: [...document.querySelectorAll(".caseActionButton")],
  actionFeedback: document.getElementById("actionFeedback"),

  evidenceForm: document.getElementById("evidenceForm"),
  evidenceFile: document.getElementById("evidenceFile"),
  evidenceComment: document.getElementById("evidenceComment"),
  evidenceSubmitButton: document.querySelector(".submitEvidenceButton"),

  updatesTimeline: document.getElementById("updatesTimeline"),

  confirmationOverlay: document.getElementById("confirmationOverlay"),
  confirmationIcon: document.getElementById("confirmationIcon"),
  confirmationTitle: document.getElementById("confirmationTitle"),
  confirmationMessage: document.getElementById("confirmationMessage"),
  cancelConfirmationButton: document.getElementById("cancelConfirmationButton"),
  confirmActionButton: document.getElementById("confirmActionButton")
};

// ============================================================
// ESTADO DE LA PÁGINA
// ============================================================

let alertId = "";
let alertRef = null;
let alertData = null;
let pendingAction = null;
let unsubscribeAlert = null;
let unsubscribeUpdates = null;
let actionInProgress = false;
let evidenceInProgress = false;

// Identificador local para distinguir actualizaciones del mismo dispositivo.
const visitorId = getOrCreateVisitorId();

// ============================================================
// INICIO
// ============================================================

console.log("seguimiento.js cargado correctamente");

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => initializeTrackingPage().catch(handleInitializationError),
    { once: true }
  );
} else {
  initializeTrackingPage().catch(handleInitializationError);
}

function handleInitializationError(error) {
  console.error("Error general al iniciar seguimiento:", error);
  showFatalError(
    "No fue posible cargar el caso",
    error?.message || "Ocurrió un error al iniciar el seguimiento."
  );
}

async function initializeTrackingPage() {
  console.log("Iniciando página de seguimiento");

  bindEvents();

  alertId = new URLSearchParams(window.location.search).get("id")?.trim() || "";

  if (!alertId) {
    showFatalError(
      "Enlace incompleto",
      "El enlace no contiene el identificador del caso. Solicita nuevamente el enlace de seguimiento."
    );
    return;
  }

  alertRef = doc(db, COLLECTION_ALERTS, alertId);

  try {
    const initialSnapshot = await getDoc(alertRef);

    if (!initialSnapshot.exists()) {
      showFatalError(
        "Caso no encontrado",
        "La alerta no existe, fue eliminada o el enlace ya no es válido."
      );
      return;
    }

    alertData = {
      id: initialSnapshot.id,
      ...initialSnapshot.data()
    };

    renderAlert(alertData);
    showTrackingContent();
    startRealtimeListeners();
  } catch (error) {
    console.error("Error al abrir la alerta:", error);

    if (error?.code === "permission-denied") {
      showFatalError(
        "Acceso no autorizado",
        "Firestore no permitió consultar este caso. Será necesario habilitar las reglas de lectura para el enlace de seguimiento."
      );
      return;
    }

    showFatalError(
      "No fue posible abrir el seguimiento",
      "Verifica tu conexión a internet e inténtalo nuevamente."
    );
  }
}

function bindEvents() {
  ui.actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const actionKey = button.dataset.action;
      openActionConfirmation(actionKey);
    });
  });

  ui.cancelConfirmationButton?.addEventListener("click", closeActionConfirmation);
  ui.confirmActionButton?.addEventListener("click", confirmPendingAction);
  ui.evidenceForm?.addEventListener("submit", submitEvidence);

  ui.confirmationOverlay?.addEventListener("click", (event) => {
    if (event.target === ui.confirmationOverlay) {
      closeActionConfirmation();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeActionConfirmation();
    }
  });

  window.addEventListener("online", () => setConnectionStatus(true));
  window.addEventListener("offline", () => setConnectionStatus(false));
  window.addEventListener("beforeunload", stopRealtimeListeners);
}

// ============================================================
// ESCUCHAS EN TIEMPO REAL
// ============================================================

function startRealtimeListeners() {
  stopRealtimeListeners();

  unsubscribeAlert = onSnapshot(
    alertRef,
    (snapshot) => {
      setConnectionStatus(true);

      if (!snapshot.exists()) {
        showFatalError(
          "Caso no disponible",
          "Esta alerta ya no se encuentra disponible."
        );
        return;
      }

      alertData = {
        id: snapshot.id,
        ...snapshot.data()
      };

      renderAlert(alertData);
    },
    (error) => {
      console.error("Error en tiempo real de la alerta:", error);
      setConnectionStatus(false);
    }
  );

  const updatesRef = collection(alertRef, SUBCOLLECTION_UPDATES);
  const updatesQuery = query(
    updatesRef,
    orderBy("fecha", "desc"),
    limit(100)
  );

  unsubscribeUpdates = onSnapshot(
    updatesQuery,
    (snapshot) => {
      const updates = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderUpdates(updates);
    },
    (error) => {
      console.error("Error al leer actualizaciones:", error);

      if (error?.code === "permission-denied") {
        renderTimelineMessage(
          "Las reglas de Firestore todavía no permiten consultar las actualizaciones."
        );
      } else {
        renderTimelineMessage(
          "No fue posible cargar el historial en este momento."
        );
      }
    }
  );
}

function stopRealtimeListeners() {
  if (typeof unsubscribeAlert === "function") {
    unsubscribeAlert();
  }

  if (typeof unsubscribeUpdates === "function") {
    unsubscribeUpdates();
  }

  unsubscribeAlert = null;
  unsubscribeUpdates = null;
}

// ============================================================
// RENDER DE LA ALERTA
// ============================================================

function renderAlert(data) {
  const member = data.miembro || data.usuario || {};
  const vehicle = data.vehiculo || {};

  setText(ui.caseFolio, firstValue(data.folio, data.numeroFolio, alertId));
  setText(ui.alertType, formatAlertType(firstValue(data.tipo, data.tipoAlerta)));

  const status = normalizeStatus(firstValue(data.estado, data.estadoActual, "activa"));
  setText(ui.caseStatus, status.label);
  ui.caseStatus.dataset.status = status.key;

  setText(ui.createdAt, formatTimestamp(firstValue(data.fechaCreacion, data.createdAt)));
  setText(ui.updatedAt, formatTimestamp(firstValue(data.ultimaActualizacion, data.updatedAt, data.fechaCreacion)));

  const brand = firstValue(vehicle.marca, data.marca, data.marcaRegistro);
  const model = firstValue(
    vehicle.subMarca,
    vehicle.submarca,
    vehicle.modelo,
    data.subMarca,
    data.submarca,
    data.modelo,
    data.subMarcaRegistro
  );

  setText(
    ui.vehicleName,
    [brand, model].filter(Boolean).join(" ") || "Vehículo no registrado"
  );

  setText(
    ui.vehiclePlates,
    firstValue(vehicle.placas, data.placas, data.placasRegistro, "Sin registrar")
  );

  setText(
    ui.vehicleColor,
    firstValue(vehicle.color, data.color, data.colorRegistro, "Sin registrar")
  );

  setText(
    ui.vehicleVin,
    firstValue(vehicle.serie, vehicle.vin, data.serie, data.vin, data.serieRegistro, "Sin registrar")
  );

  setText(
    ui.memberName,
    firstValue(
      member.nombre,
      member.nombreCompleto,
      data.nombre,
      data.nombreUsuario,
      data.nombreRegistro,
      "Miembro AS CLICK"
    )
  );

  setText(
    ui.membershipNumber,
    firstValue(
      member.numeroMembresia,
      data.numeroMembresia,
      data.membresia,
      "No registrada"
    )
  );

  setText(
    ui.memberPhone,
    firstValue(
      member.telefono,
      data.telefono,
      data.telefonoRegistro,
      "No disponible"
    )
  );

  renderLocation(data);
  updateActionAvailability(status.key);
}

function renderLocation(data) {
  const location = data.ubicacion || data.location || {};

  const latitude = toNumber(
    firstValue(
      location.latitud,
      location.latitude,
      location.lat,
      data.latitud,
      data.latitude,
      data.lat
    )
  );

  const longitude = toNumber(
    firstValue(
      location.longitud,
      location.longitude,
      location.lng,
      data.longitud,
      data.longitude,
      data.lng
    )
  );

  const directUrl = firstValue(
    location.url,
    location.enlace,
    data.ubicacionActual,
    data.ubicacionInicial,
    data.enlaceUbicacion,
    data.urlUbicacion,
    data.googleMapsUrl
  );

  let mapsUrl = "";

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

    ui.locationPlaceholder.innerHTML = `
      <span aria-hidden="true">📍</span>
      <p><strong>Coordenadas registradas</strong></p>
      <p>${escapeHtml(latitude.toFixed(6))}, ${escapeHtml(longitude.toFixed(6))}</p>
    `;
  } else if (directUrl) {
    mapsUrl = directUrl;

    ui.locationPlaceholder.innerHTML = `
      <span aria-hidden="true">🗺️</span>
      <p><strong>Ubicación disponible</strong></p>
      <p>Abre el mapa para consultar el punto reportado.</p>
    `;
  } else {
    ui.locationPlaceholder.innerHTML = `
      <span aria-hidden="true">📍</span>
      <p>La alerta todavía no contiene coordenadas válidas.</p>
    `;
  }

  if (mapsUrl && isSafeHttpUrl(mapsUrl)) {
    ui.openLocationButton.href = mapsUrl;
    ui.openLocationButton.hidden = false;
  } else {
    ui.openLocationButton.removeAttribute("href");
    ui.openLocationButton.hidden = true;
  }
}

// ============================================================
// REGISTRO DE ACCIONES
// ============================================================

function openActionConfirmation(actionKey) {
  if (actionInProgress) {
    return;
  }

  const action = ACTIONS[actionKey];

  if (!action) {
    showFeedback("Acción no válida.", "error");
    return;
  }

  pendingAction = actionKey;
  setText(ui.confirmationIcon, action.icon);
  setText(ui.confirmationTitle, "Confirmar actualización");
  setText(
    ui.confirmationMessage,
    `¿Confirmas que deseas registrar: “${action.label}”?`
  );

  ui.confirmationOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  ui.confirmActionButton?.focus();
}

function closeActionConfirmation() {
  if (actionInProgress) {
    return;
  }

  pendingAction = null;
  ui.confirmationOverlay.hidden = true;
  document.body.style.overflow = "";
}

async function confirmPendingAction() {
  if (!pendingAction || actionInProgress || !alertRef) {
    return;
  }

  const actionKey = pendingAction;
  const action = ACTIONS[actionKey];

  actionInProgress = true;
  setActionButtonsDisabled(true);
  setConfirmationBusy(true);

  try {
    await addDoc(collection(alertRef, SUBCOLLECTION_UPDATES), {
      tipo: "accion",
      accion: actionKey,
      titulo: action.label,
      mensaje: action.label,
      estadoResultante: action.status,
      fecha: serverTimestamp(),
      visitanteId: visitorId,
      origen: "seguimiento_web",
      userAgent: navigator.userAgent.slice(0, 300)
    });

    await updateDoc(alertRef, {
      estado: action.status,
      estadoTexto: action.statusLabel,
      ultimaActualizacion: serverTimestamp(),
      totalActualizaciones: increment(1),
      ultimaAccion: actionKey,
      ultimaAccionTexto: action.label
    });

    closeActionConfirmationForce();
    showFeedback(`Actualización registrada: ${action.label}.`, "success");
  } catch (error) {
    console.error("Error al registrar la acción:", error);

    if (error?.code === "permission-denied") {
      showFeedback(
        "Firestore no permitió guardar la actualización. Deben habilitarse las reglas de escritura para participantes.",
        "error"
      );
    } else {
      showFeedback(
        "No fue posible registrar la actualización. Revisa tu conexión e inténtalo nuevamente.",
        "error"
      );
    }
  } finally {
    actionInProgress = false;
    setActionButtonsDisabled(false);
    setConfirmationBusy(false);
  }
}

function closeActionConfirmationForce() {
  pendingAction = null;
  ui.confirmationOverlay.hidden = true;
  document.body.style.overflow = "";
}

function setConfirmationBusy(isBusy) {
  if (!ui.confirmActionButton || !ui.cancelConfirmationButton) {
    return;
  }

  ui.confirmActionButton.disabled = isBusy;
  ui.cancelConfirmationButton.disabled = isBusy;
  ui.confirmActionButton.textContent = isBusy ? "Guardando..." : "Confirmar";
}

function setActionButtonsDisabled(disabled) {
  ui.actionButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function updateActionAvailability(statusKey) {
  const isClosed = [
    "vehiculo_recuperado",
    "cerrada",
    "finalizada",
    "cancelada"
  ].includes(statusKey);

  ui.actionButtons.forEach((button) => {
    button.disabled = isClosed || actionInProgress;
  });

  if (isClosed) {
    showFeedback(
      "El caso se encuentra cerrado. Ya no se aceptan nuevas acciones.",
      "info"
    );
  }
}

// ============================================================
// EVIDENCIA: ARCHIVO Y/O COMENTARIO
// ============================================================

async function submitEvidence(event) {
  event.preventDefault();

  if (evidenceInProgress || !alertRef) {
    return;
  }

  const file = ui.evidenceFile?.files?.[0] || null;
  const comment = ui.evidenceComment?.value?.trim() || "";

  if (!file && !comment) {
    showFeedback(
      "Selecciona una foto o video, o escribe un comentario.",
      "error"
    );
    return;
  }

  if (file && file.size > MAX_FILE_SIZE) {
    showFeedback(
      "El archivo supera el límite de 25 MB.",
      "error"
    );
    return;
  }

  if (file && !isAllowedEvidenceType(file.type)) {
    showFeedback(
      "Solo se permiten imágenes o videos.",
      "error"
    );
    return;
  }

  evidenceInProgress = true;
  setEvidenceBusy(true);

  try {
    let evidenceUrl = "";
    let storagePath = "";

    if (file) {
      const extension = getSafeFileExtension(file.name);
      const generatedName = `${Date.now()}_${cryptoSafeId()}${extension}`;
      storagePath = `alertasEmergencia/${alertId}/evidencias/${generatedName}`;

      const storageReference = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageReference, file, {
        contentType: file.type,
        customMetadata: {
          alertaId: alertId,
          visitanteId: visitorId,
          origen: "seguimiento_web"
        }
      });

      evidenceUrl = await waitForUpload(uploadTask, (progress) => {
        updateEvidenceProgress(progress);
      });
    }

    await addDoc(collection(alertRef, SUBCOLLECTION_UPDATES), {
      tipo: "evidencia",
      titulo: file ? "Evidencia recibida" : "Comentario recibido",
      mensaje: comment || "Se agregó un archivo como evidencia.",
      comentario: comment,
      archivoUrl: evidenceUrl,
      archivoRuta: storagePath,
      archivoNombre: file?.name || "",
      archivoTipo: file?.type || "",
      archivoTamano: file?.size || 0,
      fecha: serverTimestamp(),
      visitanteId: visitorId,
      origen: "seguimiento_web"
    });

    await updateDoc(alertRef, {
      ultimaActualizacion: serverTimestamp(),
      totalActualizaciones: increment(1),
      ultimaAccion: "evidencia",
      ultimaAccionTexto: file ? "Evidencia recibida" : "Comentario recibido"
    });

    ui.evidenceForm.reset();
    showFeedback("La actualización fue enviada correctamente.", "success");
  } catch (error) {
    console.error("Error al enviar evidencia:", error);

    if (error?.code === "storage/unauthorized" || error?.code === "permission-denied") {
      showFeedback(
        "Firebase no permitió guardar la evidencia. Será necesario actualizar las reglas de Firestore o Storage.",
        "error"
      );
    } else {
      showFeedback(
        "No fue posible enviar la evidencia. Revisa tu conexión e inténtalo nuevamente.",
        "error"
      );
    }
  } finally {
    evidenceInProgress = false;
    setEvidenceBusy(false);
  }
}

function waitForUpload(uploadTask, onProgress) {
  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;

        onProgress(progress);
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

function setEvidenceBusy(isBusy) {
  if (!ui.evidenceSubmitButton) {
    return;
  }

  ui.evidenceSubmitButton.disabled = isBusy;
  ui.evidenceFile.disabled = isBusy;
  ui.evidenceComment.disabled = isBusy;
  ui.evidenceSubmitButton.textContent = isBusy
    ? "Enviando... 0%"
    : "Enviar actualización";
}

function updateEvidenceProgress(progress) {
  if (ui.evidenceSubmitButton && evidenceInProgress) {
    ui.evidenceSubmitButton.textContent = `Enviando... ${progress}%`;
  }
}

// ============================================================
// HISTORIAL
// ============================================================

function renderUpdates(updates) {
  if (!ui.updatesTimeline) {
    return;
  }

  if (!updates.length) {
    renderTimelineMessage("Todavía no hay actualizaciones registradas.");
    return;
  }

  ui.updatesTimeline.innerHTML = updates
    .map((update) => {
      const action = ACTIONS[update.accion];
      const icon = action?.icon || (update.tipo === "evidencia" ? "📷" : "🕒");
      const title = firstValue(update.titulo, action?.label, "Actualización");
      const message = firstValue(update.mensaje, update.comentario, "");
      const date = formatTimestamp(update.fecha);

      const evidenceLink = update.archivoUrl && isSafeHttpUrl(update.archivoUrl)
        ? `<a href="${escapeAttribute(update.archivoUrl)}" target="_blank" rel="noopener noreferrer">Ver evidencia</a>`
        : "";

      return `
        <article class="timelineItem">
          <div class="timelineItemHeader">
            <span class="timelineItemIcon" aria-hidden="true">${escapeHtml(icon)}</span>
            <div>
              <strong>${escapeHtml(title)}</strong>
              <small>${escapeHtml(date)}</small>
            </div>
          </div>
          ${message ? `<p>${escapeHtml(message)}</p>` : ""}
          ${evidenceLink}
        </article>
      `;
    })
    .join("");
}

function renderTimelineMessage(message) {
  if (!ui.updatesTimeline) {
    return;
  }

  ui.updatesTimeline.innerHTML = `
    <div class="timelineEmpty">${escapeHtml(message)}</div>
  `;
}

// ============================================================
// MENSAJES Y ESTADOS VISUALES
// ============================================================

function showTrackingContent() {
  ui.loadingPanel.hidden = true;
  ui.errorPanel.hidden = true;
  ui.trackingContent.hidden = false;
  setConnectionStatus(navigator.onLine);
}

function showFatalError(title, message) {
  stopRealtimeListeners();
  ui.loadingPanel.hidden = true;
  ui.trackingContent.hidden = true;
  ui.errorPanel.hidden = false;
  setText(ui.errorTitle, title);
  setText(ui.errorMessage, message);
  setConnectionStatus(false);
}

function showFeedback(message, type = "info") {
  if (!ui.actionFeedback) {
    return;
  }

  ui.actionFeedback.hidden = false;
  ui.actionFeedback.className = `actionFeedback ${type}`;
  ui.actionFeedback.textContent = message;

  window.clearTimeout(showFeedback.timeoutId);
  showFeedback.timeoutId = window.setTimeout(() => {
    ui.actionFeedback.hidden = true;
  }, 6500);
}

function setConnectionStatus(isOnline) {
  if (!ui.connectionStatus) {
    return;
  }

  ui.connectionStatus.textContent = isOnline ? "Conectado en tiempo real" : "Sin conexión";
  ui.connectionStatus.dataset.online = String(Boolean(isOnline));
}

// ============================================================
// UTILIDADES DE DATOS
// ============================================================

function firstValue(...values) {
  return values.find((value) => {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === "string") {
      return value.trim() !== "";
    }

    return true;
  });
}

function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
  }
}

function toNumber(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number(value.replace(",", "."));
  }

  return Number.NaN;
}

function formatAlertType(value) {
  const normalized = String(value || "Alerta")
    .trim()
    .toLowerCase();

  if (normalized.includes("robo")) {
    return "Robo de vehículo";
  }

  if (normalized.includes("monta")) {
    return "Montachoques";
  }

  return capitalizeWords(normalized || "alerta");
}

function normalizeStatus(value) {
  const key = String(value || "activa")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const labels = {
    activa: "ALERTA ACTIVA",
    pendiente: "PENDIENTE DE VERIFICACIÓN",
    verificada: "ALERTA VERIFICADA",
    publicada: "ALERTA PUBLICADA",
    apoyo_en_camino: "APOYO EN CAMINO",
    policia_en_sitio: "POLICÍA EN SITIO",
    cliente_seguro: "CLIENTE ESTÁ BIEN",
    vehiculo_localizado: "VEHÍCULO LOCALIZADO",
    vehiculo_recuperado: "VEHÍCULO RECUPERADO",
    cerrada: "CASO CERRADO",
    finalizada: "CASO FINALIZADO",
    cancelada: "ALERTA CANCELADA"
  };

  return {
    key,
    label: labels[key] || capitalizeWords(key.replace(/_/g, " ")).toUpperCase()
  };
}

function formatTimestamp(value) {
  if (!value) {
    return "Pendiente";
  }

  let date;

  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number" || typeof value === "string") {
    date = new Date(value);
  } else if (typeof value?.seconds === "number") {
    date = new Date(value.seconds * 1000);
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function capitalizeWords(value) {
  return String(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getOrCreateVisitorId() {
  const storageKey = "asClickEmergencyVisitorId";
  let id = localStorage.getItem(storageKey);

  if (!id) {
    id = cryptoSafeId();
    localStorage.setItem(storageKey, id);
  }

  return id;
}

function cryptoSafeId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function getSafeFileExtension(fileName) {
  const match = String(fileName || "").match(/\.[a-zA-Z0-9]{1,8}$/);
  return match ? match[0].toLowerCase() : "";
}

function isAllowedEvidenceType(mimeType) {
  return /^image\//i.test(mimeType) || /^video\//i.test(mimeType);
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
