import {
  db
} from "./firebase-config.js";

import {
  doc,
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


/* ============================================================
   CONFIGURACIÓN
============================================================ */

const COLECCION_ALERTAS = "alertasEmergencia";
const SUBCOLECCION_ACTUALIZACIONES = "actualizaciones";
const LIMITE_ARCHIVO = 25 * 1024 * 1024; // 25 MB

// Cloudinary: carga pública mediante preset Unsigned.
const CLOUDINARY_CLOUD_NAME = "dxcyy6jyv";
const CLOUDINARY_UPLOAD_PRESET = "as_click_evidencias";
const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

const ACCIONES = {
  voy_para_alla: {
    etiqueta: "Voy para allá",
    icono: "🚗",
    estado: "apoyo_en_camino",
    estadoTexto: "APOYO EN CAMINO"
  },
  llego_policia: {
    etiqueta: "Llegó la policía",
    icono: "👮",
    estado: "policia_en_sitio",
    estadoTexto: "POLICÍA EN SITIO"
  },
  cliente_esta_bien: {
    etiqueta: "Cliente está bien",
    icono: "✅",
    estado: "cliente_seguro",
    estadoTexto: "CLIENTE ESTÁ BIEN"
  },
  vehiculo_localizado: {
    etiqueta: "Vehículo localizado",
    icono: "🔎",
    estado: "vehiculo_localizado",
    estadoTexto: "VEHÍCULO LOCALIZADO"
  },
  vehiculo_recuperado: {
    etiqueta: "Vehículo recuperado",
    icono: "🏁",
    estado: "vehiculo_recuperado",
    estadoTexto: "VEHÍCULO RECUPERADO"
  }
};

/* ============================================================
   ELEMENTOS DE LA PÁGINA
============================================================ */

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

  actionButtons: Array.from(
    document.querySelectorAll(".caseActionButton")
  ),
  actionFeedback: document.getElementById("actionFeedback"),

  evidenceForm: document.getElementById("evidenceForm"),
  evidenceFile: document.getElementById("evidenceFile"),
  evidenceComment: document.getElementById("evidenceComment"),
  evidenceSubmitButton: document.querySelector(
    ".submitEvidenceButton"
  ),

  updatesTimeline: document.getElementById("updatesTimeline"),

  confirmationOverlay: document.getElementById(
    "confirmationOverlay"
  ),
  confirmationIcon: document.getElementById("confirmationIcon"),
  confirmationTitle: document.getElementById(
    "confirmationTitle"
  ),
  confirmationMessage: document.getElementById(
    "confirmationMessage"
  ),
  cancelConfirmationButton: document.getElementById(
    "cancelConfirmationButton"
  ),
  confirmActionButton: document.getElementById(
    "confirmActionButton"
  )
};

/* ============================================================
   ESTADO
============================================================ */

let alertaId = "";
let referenciaAlerta = null;
let datosAlerta = null;
let accionPendiente = null;
let cancelarEscuchaAlerta = null;
let cancelarEscuchaActualizaciones = null;
let accionEnProceso = false;
let evidenciaEnProceso = false;
let temporizadorCarga = null;

const visitanteId = obtenerOCrearIdVisitante();

/* ============================================================
   INICIO
============================================================ */

iniciarSeguimiento();

function iniciarSeguimiento() {
  console.log("AS CLICK: seguimiento.js iniciado");

  enlazarEventos();

  alertaId =
    new URLSearchParams(window.location.search)
      .get("id")
      ?.trim() || "";

  if (!alertaId) {
    mostrarErrorFatal(
      "Enlace incompleto",
      "El enlace no contiene el identificador del caso."
    );
    return;
  }

  referenciaAlerta = doc(
    db,
    COLECCION_ALERTAS,
    alertaId
  );

  temporizadorCarga = window.setTimeout(() => {
    if (!datosAlerta) {
      mostrarErrorFatal(
        "La consulta está tardando demasiado",
        "Revisa tu conexión y vuelve a abrir el enlace."
      );
    }
  }, 15000);

  iniciarEscuchaAlerta();
  iniciarEscuchaActualizaciones();
}

function enlazarEventos() {
  ui.actionButtons.forEach(boton => {
    boton.addEventListener("click", () => {
      abrirConfirmacionAccion(
        boton.dataset.action || ""
      );
    });
  });

  ui.cancelConfirmationButton?.addEventListener(
    "click",
    cerrarConfirmacionAccion
  );

  ui.confirmActionButton?.addEventListener(
    "click",
    confirmarAccion
  );

  ui.evidenceForm?.addEventListener(
    "submit",
    enviarEvidencia
  );

  ui.confirmationOverlay?.addEventListener(
    "click",
    evento => {
      if (evento.target === ui.confirmationOverlay) {
        cerrarConfirmacionAccion();
      }
    }
  );

  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") {
      cerrarConfirmacionAccion();
    }
  });

  window.addEventListener("online", () => {
    actualizarEstadoConexion(true);
  });

  window.addEventListener("offline", () => {
    actualizarEstadoConexion(false);
  });

  window.addEventListener(
    "beforeunload",
    detenerEscuchas
  );
}

/* ============================================================
   FIRESTORE EN TIEMPO REAL
============================================================ */

function iniciarEscuchaAlerta() {
  cancelarEscuchaAlerta = onSnapshot(
    referenciaAlerta,
    documento => {
      window.clearTimeout(temporizadorCarga);
      actualizarEstadoConexion(true);

      if (!documento.exists()) {
        mostrarErrorFatal(
          "Caso no encontrado",
          "La alerta no existe o el enlace ya no es válido."
        );
        return;
      }

      datosAlerta = {
        id: documento.id,
        ...documento.data()
      };

      mostrarAlerta(datosAlerta);
      mostrarContenido();
    },
    error => {
      window.clearTimeout(temporizadorCarga);
      console.error(
        "Error al consultar la alerta:",
        error
      );

      const esPermiso =
        error?.code === "permission-denied";

      mostrarErrorFatal(
        esPermiso
          ? "Acceso no autorizado"
          : "No fue posible abrir el seguimiento",
        esPermiso
          ? "Las reglas de Firestore no permiten consultar este caso."
          : "Revisa tu conexión e inténtalo nuevamente."
      );
    }
  );
}

function iniciarEscuchaActualizaciones() {
  const referenciaActualizaciones = collection(
    referenciaAlerta,
    SUBCOLECCION_ACTUALIZACIONES
  );

  const consulta = query(
    referenciaActualizaciones,
    orderBy("fecha", "desc"),
    limit(100)
  );

  cancelarEscuchaActualizaciones = onSnapshot(
    consulta,
    resultado => {
      const actualizaciones = resultado.docs.map(
        documento => ({
          id: documento.id,
          ...documento.data()
        })
      );

      mostrarActualizaciones(actualizaciones);
    },
    error => {
      console.error(
        "Error al consultar actualizaciones:",
        error
      );

      mostrarMensajeHistorial(
        error?.code === "permission-denied"
          ? "Las reglas de Firestore no permiten consultar el historial."
          : "No fue posible cargar el historial."
      );
    }
  );
}

function detenerEscuchas() {
  if (typeof cancelarEscuchaAlerta === "function") {
    cancelarEscuchaAlerta();
  }

  if (
    typeof cancelarEscuchaActualizaciones ===
    "function"
  ) {
    cancelarEscuchaActualizaciones();
  }

  cancelarEscuchaAlerta = null;
  cancelarEscuchaActualizaciones = null;
}

/* ============================================================
   MOSTRAR DATOS REALES DE LA ALERTA
============================================================ */

function mostrarAlerta(data) {
  const cliente = data.cliente || {};
  const vehiculo = data.vehiculo || {};

  colocarTexto(
    ui.caseFolio,
    primerValor(
      data.folio,
      data.numeroFolio,
      data.idAlerta,
      alertaId
    )
  );

  colocarTexto(
    ui.alertType,
    formatearTipoAlerta(
      primerValor(
        data.tipo,
        data.tipoAlerta,
        "Alerta"
      )
    )
  );

  const estado = normalizarEstado(
    primerValor(
      data.estado,
      data.estadoActual,
      "en_seguimiento"
    )
  );

  colocarTexto(ui.caseStatus, estado.etiqueta);

  if (ui.caseStatus) {
    ui.caseStatus.dataset.status = estado.clave;
  }

  colocarTexto(
    ui.createdAt,
    formatearFecha(
      primerValor(
        data.creadoEn,
        data.fechaCreacion,
        data.createdAt
      )
    )
  );

  colocarTexto(
    ui.updatedAt,
    formatearFecha(
      primerValor(
        data.actualizadoEn,
        data.ultimaActualizacion,
        data.updatedAt,
        data.creadoEn,
        data.fechaCreacion
      )
    )
  );

  colocarTexto(
    ui.vehicleName,
    [
      primerValor(
        vehiculo.marca,
        data.marca,
        data.marcaRegistro
      ),
      primerValor(
        vehiculo.subMarca,
        vehiculo.submarca,
        vehiculo.modelo,
        data.subMarca,
        data.submarca,
        data.subMarcaRegistro
      )
    ]
      .filter(Boolean)
      .join(" ") || "Vehículo no registrado"
  );

  colocarTexto(
    ui.vehiclePlates,
    primerValor(
      vehiculo.placas,
      data.placas,
      data.placasRegistro,
      "Sin registrar"
    )
  );

  colocarTexto(
    ui.vehicleColor,
    primerValor(
      vehiculo.color,
      data.color,
      data.colorRegistro,
      "Sin registrar"
    )
  );

  colocarTexto(
    ui.vehicleVin,
    primerValor(
      vehiculo.serie,
      vehiculo.vin,
      data.serie,
      data.vin,
      data.serieRegistro,
      "Sin registrar"
    )
  );

  colocarTexto(
    ui.memberName,
    primerValor(
      cliente.nombre,
      cliente.nombreCompleto,
      data.nombre,
      data.nombreRegistro,
      "Miembro AS CLICK"
    )
  );

  colocarTexto(
    ui.membershipNumber,
    primerValor(
      data.numeroMembresia,
      data.numeroMiembro,
      cliente.numeroMembresia,
      "No registrada"
    )
  );

  colocarTexto(
    ui.memberPhone,
    primerValor(
      cliente.telefono,
      data.telefono,
      data.telefonoRegistro,
      "No disponible"
    )
  );

  mostrarUbicacion(data);
  actualizarDisponibilidadAcciones(estado.clave);
}

function mostrarUbicacion(data) {
  const ubicacionObjeto =
    data.ubicacion &&
    typeof data.ubicacion === "object"
      ? data.ubicacion
      : {};

  const latitud = convertirNumero(
    primerValor(
      ubicacionObjeto.latitud,
      ubicacionObjeto.latitude,
      ubicacionObjeto.lat,
      data.latitud,
      data.latitude,
      data.lat
    )
  );

  const longitud = convertirNumero(
    primerValor(
      ubicacionObjeto.longitud,
      ubicacionObjeto.longitude,
      ubicacionObjeto.lng,
      data.longitud,
      data.longitude,
      data.lng
    )
  );

  const enlaceDirecto = primerValor(
    data.ubicacionActual,
    data.ubicacionInicial,
    ubicacionObjeto.url,
    ubicacionObjeto.enlace,
    data.enlaceUbicacion,
    data.urlUbicacion,
    data.googleMapsUrl
  );

  let enlaceMapa = "";

  if (
    Number.isFinite(latitud) &&
    Number.isFinite(longitud)
  ) {
    enlaceMapa =
      `https://maps.google.com/?q=${latitud},${longitud}`;

    if (ui.locationPlaceholder) {
      ui.locationPlaceholder.innerHTML = `
        <span aria-hidden="true">📍</span>
        <p><strong>Coordenadas registradas</strong></p>
        <p>${escaparHtml(latitud.toFixed(6))}, ${escaparHtml(longitud.toFixed(6))}</p>
      `;
    }
  } else if (
    enlaceDirecto &&
    esUrlHttpSegura(enlaceDirecto)
  ) {
    enlaceMapa = enlaceDirecto;

    if (ui.locationPlaceholder) {
      ui.locationPlaceholder.innerHTML = `
        <span aria-hidden="true">🗺️</span>
        <p><strong>Ubicación disponible</strong></p>
        <p>Presiona el botón para abrir Google Maps.</p>
      `;
    }
  } else {
    if (ui.locationPlaceholder) {
      ui.locationPlaceholder.innerHTML = `
        <span aria-hidden="true">📍</span>
        <p>La alerta no contiene una ubicación válida.</p>
      `;
    }
  }

  if (
    ui.openLocationButton &&
    enlaceMapa
  ) {
    ui.openLocationButton.href = enlaceMapa;
    ui.openLocationButton.hidden = false;
  } else if (ui.openLocationButton) {
    ui.openLocationButton.removeAttribute("href");
    ui.openLocationButton.hidden = true;
  }
}

/* ============================================================
   ACCIONES DE SEGUIMIENTO
============================================================ */

function abrirConfirmacionAccion(claveAccion) {
  if (accionEnProceso) return;

  const accion = ACCIONES[claveAccion];

  if (!accion) {
    mostrarRetroalimentacion(
      "La acción seleccionada no es válida.",
      "error"
    );
    return;
  }

  accionPendiente = claveAccion;

  colocarTexto(
    ui.confirmationIcon,
    accion.icono
  );

  colocarTexto(
    ui.confirmationTitle,
    "Confirmar actualización"
  );

  colocarTexto(
    ui.confirmationMessage,
    `¿Confirmas que deseas registrar: “${accion.etiqueta}”?`
  );

  if (ui.confirmationOverlay) {
    ui.confirmationOverlay.hidden = false;
  }

  document.body.style.overflow = "hidden";
  ui.confirmActionButton?.focus();
}

function cerrarConfirmacionAccion() {
  if (accionEnProceso) return;

  accionPendiente = null;

  if (ui.confirmationOverlay) {
    ui.confirmationOverlay.hidden = true;
  }

  document.body.style.overflow = "";
}

async function confirmarAccion() {
  if (
    !accionPendiente ||
    accionEnProceso ||
    !referenciaAlerta
  ) {
    return;
  }

  const claveAccion = accionPendiente;
  const accion = ACCIONES[claveAccion];

  accionEnProceso = true;
  deshabilitarAcciones(true);
  marcarConfirmacionOcupada(true);

  try {
    await addDoc(
      collection(
        referenciaAlerta,
        SUBCOLECCION_ACTUALIZACIONES
      ),
      {
        tipo: "accion",
        accion: claveAccion,
        titulo: accion.etiqueta,
        mensaje: accion.etiqueta,
        estadoResultante: accion.estado,
        fecha: serverTimestamp(),
        visitanteId,
        origen: "seguimiento_web",
        userAgent:
          navigator.userAgent.slice(0, 300)
      }
    );

    await updateDoc(referenciaAlerta, {
      estado: accion.estado,
      estadoTexto: accion.estadoTexto,
      ultimaActualizacion: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
      totalActualizaciones: increment(1),
      ultimaAccion: claveAccion,
      ultimaAccionTexto: accion.etiqueta
    });

    cerrarConfirmacionForzada();

    mostrarRetroalimentacion(
      `Actualización registrada: ${accion.etiqueta}.`,
      "success"
    );
  } catch (error) {
    console.error(
      "Error al registrar la acción:",
      error
    );

    mostrarRetroalimentacion(
      error?.code === "permission-denied"
        ? "Firestore no permitió guardar la actualización."
        : "No fue posible registrar la actualización.",
      "error"
    );
  } finally {
    accionEnProceso = false;
    deshabilitarAcciones(false);
    marcarConfirmacionOcupada(false);

    if (datosAlerta) {
      const estadoActual = normalizarEstado(
        datosAlerta.estado
      );

      actualizarDisponibilidadAcciones(
        estadoActual.clave
      );
    }
  }
}

function cerrarConfirmacionForzada() {
  accionPendiente = null;

  if (ui.confirmationOverlay) {
    ui.confirmationOverlay.hidden = true;
  }

  document.body.style.overflow = "";
}

function marcarConfirmacionOcupada(ocupada) {
  if (
    !ui.confirmActionButton ||
    !ui.cancelConfirmationButton
  ) {
    return;
  }

  ui.confirmActionButton.disabled = ocupada;
  ui.cancelConfirmationButton.disabled = ocupada;

  ui.confirmActionButton.textContent =
    ocupada ? "Guardando..." : "Confirmar";
}

function deshabilitarAcciones(deshabilitadas) {
  ui.actionButtons.forEach(boton => {
    boton.disabled = deshabilitadas;
  });
}

function actualizarDisponibilidadAcciones(estado) {
  const casoCerrado = [
    "vehiculo_recuperado",
    "cerrada",
    "finalizada",
    "cancelada"
  ].includes(estado);

  ui.actionButtons.forEach(boton => {
    boton.disabled =
      casoCerrado || accionEnProceso;
  });

  if (casoCerrado) {
    mostrarRetroalimentacion(
      "El caso está cerrado y ya no acepta nuevas acciones.",
      "info"
    );
  }
}

/* ============================================================
   EVIDENCIA
============================================================ */

async function enviarEvidencia(evento) {
  evento.preventDefault();

  if (
    evidenciaEnProceso ||
    !referenciaAlerta
  ) {
    return;
  }

  const archivo =
    ui.evidenceFile?.files?.[0] || null;

  const comentario =
    ui.evidenceComment?.value?.trim() || "";

  if (!archivo && !comentario) {
    mostrarRetroalimentacion(
      "Selecciona una foto o video, o escribe un comentario.",
      "error"
    );
    return;
  }

  if (
    archivo &&
    archivo.size > LIMITE_ARCHIVO
  ) {
    mostrarRetroalimentacion(
      "El archivo supera el límite de 25 MB.",
      "error"
    );
    return;
  }

  if (
    archivo &&
    !esTipoEvidenciaPermitido(archivo.type)
  ) {
    mostrarRetroalimentacion(
      "Solo se permiten imágenes o videos.",
      "error"
    );
    return;
  }

  evidenciaEnProceso = true;
  marcarEvidenciaOcupada(true);

  try {
    let archivoUrl = "";
    let archivoRuta = "";
    let cloudinaryPublicId = "";
    let cloudinaryResourceType = "";
    let cloudinaryVersion = null;

    if (archivo) {
      const resultadoCloudinary =
        await subirArchivoACloudinary(
          archivo,
          progreso => {
            actualizarProgresoEvidencia(progreso);
          }
        );

      archivoUrl =
        resultadoCloudinary.secure_url ||
        resultadoCloudinary.url ||
        "";

      cloudinaryPublicId =
        resultadoCloudinary.public_id || "";

      cloudinaryResourceType =
        resultadoCloudinary.resource_type || "";

      cloudinaryVersion =
        resultadoCloudinary.version || null;

      // Se conserva este campo para no alterar la estructura
      // que ya utiliza el historial.
      archivoRuta = cloudinaryPublicId;

      if (!archivoUrl) {
        throw new Error(
          "Cloudinary no devolvió una URL válida."
        );
      }
    }

    await addDoc(
      collection(
        referenciaAlerta,
        SUBCOLECCION_ACTUALIZACIONES
      ),
      {
        tipo: "evidencia",
        titulo: archivo
          ? "Evidencia recibida"
          : "Comentario recibido",
        mensaje:
          comentario ||
          "Se agregó un archivo como evidencia.",
        comentario,
        archivoUrl,
        archivoRuta,
        archivoNombre: archivo?.name || "",
        archivoTipo: archivo?.type || "",
        archivoTamano: archivo?.size || 0,

        // Datos necesarios para identificar y eliminar
        // posteriormente el recurso desde un servidor seguro.
        cloudinaryPublicId,
        cloudinaryResourceType,
        cloudinaryVersion,
        proveedorArchivo: archivo
          ? "cloudinary"
          : "",
        fechaExpiracion: archivo
          ? new Date(
              Date.now() + 24 * 60 * 60 * 1000
            )
          : null,

        fecha: serverTimestamp(),
        visitanteId,
        origen: "seguimiento_web"
      }
    );

    await updateDoc(referenciaAlerta, {
      ultimaActualizacion: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
      totalActualizaciones: increment(1),
      ultimaAccion: "evidencia",
      ultimaAccionTexto: archivo
        ? "Evidencia recibida"
        : "Comentario recibido"
    });

    ui.evidenceForm?.reset();

    mostrarRetroalimentacion(
      "La actualización fue enviada correctamente.",
      "success"
    );
  } catch (error) {
    console.error(
      "Error al enviar evidencia:",
      error
    );

    mostrarRetroalimentacion(
      error?.code === "permission-denied"
        ? "Firestore no permitió guardar la evidencia."
        : error?.message ||
          "No fue posible enviar la evidencia.",
      "error"
    );
  } finally {
    evidenciaEnProceso = false;
    marcarEvidenciaOcupada(false);
  }
}

function subirArchivoACloudinary(
  archivo,
  alProgresar
) {
  return new Promise((resolve, reject) => {
    const formulario = new FormData();

    formulario.append("file", archivo);
    formulario.append(
      "upload_preset",
      CLOUDINARY_UPLOAD_PRESET
    );
    formulario.append(
      "context",
      `alerta_id=${alertaId}|visitante_id=${visitanteId}|origen=seguimiento_web`
    );
    formulario.append(
      "tags",
      `as_click_evidencia,alerta_${alertaId}`
    );

    const solicitud = new XMLHttpRequest();
    solicitud.open(
      "POST",
      CLOUDINARY_UPLOAD_URL,
      true
    );
    solicitud.responseType = "json";
    solicitud.timeout = 120000;

    solicitud.upload.addEventListener(
      "progress",
      evento => {
        if (!evento.lengthComputable) {
          return;
        }

        const progreso = Math.round(
          (evento.loaded / evento.total) * 100
        );

        alProgresar(progreso);
      }
    );

    solicitud.addEventListener("load", () => {
      const respuesta =
        solicitud.response || {};

      if (
        solicitud.status >= 200 &&
        solicitud.status < 300
      ) {
        alProgresar(100);
        resolve(respuesta);
        return;
      }

      const mensaje =
        respuesta?.error?.message ||
        `Cloudinary rechazó la carga (${solicitud.status}).`;

      reject(new Error(mensaje));
    });

    solicitud.addEventListener("error", () => {
      reject(
        new Error(
          "No fue posible conectar con Cloudinary."
        )
      );
    });

    solicitud.addEventListener("timeout", () => {
      reject(
        new Error(
          "La carga tardó demasiado y fue cancelada."
        )
      );
    });

    solicitud.addEventListener("abort", () => {
      reject(
        new Error("La carga fue cancelada.")
      );
    });

    solicitud.send(formulario);
  });
}

function marcarEvidenciaOcupada(ocupada) {
  if (!ui.evidenceSubmitButton) return;

  ui.evidenceSubmitButton.disabled = ocupada;

  if (ui.evidenceFile) {
    ui.evidenceFile.disabled = ocupada;
  }

  if (ui.evidenceComment) {
    ui.evidenceComment.disabled = ocupada;
  }

  ui.evidenceSubmitButton.textContent =
    ocupada
      ? "Enviando... 0%"
      : "Enviar actualización";
}

function actualizarProgresoEvidencia(progreso) {
  if (
    evidenciaEnProceso &&
    ui.evidenceSubmitButton
  ) {
    ui.evidenceSubmitButton.textContent =
      `Enviando... ${progreso}%`;
  }
}

/* ============================================================
   HISTORIAL
============================================================ */

function mostrarActualizaciones(actualizaciones) {
  if (!ui.updatesTimeline) return;

  if (!actualizaciones.length) {
    mostrarMensajeHistorial(
      "Todavía no hay actualizaciones registradas."
    );
    return;
  }

  ui.updatesTimeline.innerHTML =
    actualizaciones
      .map(actualizacion => {
        const accion =
          ACCIONES[actualizacion.accion];

        const icono =
          accion?.icono ||
          (
            actualizacion.tipo === "evidencia"
              ? "📷"
              : "🕒"
          );

        const titulo = primerValor(
          actualizacion.titulo,
          accion?.etiqueta,
          "Actualización"
        );

        const mensaje = primerValor(
          actualizacion.mensaje,
          actualizacion.comentario,
          ""
        );

        const fecha = formatearFecha(
          actualizacion.fecha
        );

        const enlaceEvidencia =
          actualizacion.archivoUrl &&
          esUrlHttpSegura(
            actualizacion.archivoUrl
          )
            ? `
              <a
                href="${escaparAtributo(actualizacion.archivoUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver evidencia
              </a>
            `
            : "";

        return `
          <article class="timelineItem">
            <div class="timelineItemHeader">
              <span
                class="timelineItemIcon"
                aria-hidden="true"
              >
                ${escaparHtml(icono)}
              </span>

              <div>
                <strong>
                  ${escaparHtml(titulo)}
                </strong>

                <small>
                  ${escaparHtml(fecha)}
                </small>
              </div>
            </div>

            ${
              mensaje
                ? `<p>${escaparHtml(mensaje)}</p>`
                : ""
            }

            ${enlaceEvidencia}
          </article>
        `;
      })
      .join("");
}

function mostrarMensajeHistorial(mensaje) {
  if (!ui.updatesTimeline) return;

  ui.updatesTimeline.innerHTML = `
    <div class="timelineEmpty">
      ${escaparHtml(mensaje)}
    </div>
  `;
}

/* ============================================================
   ESTADOS VISUALES
============================================================ */

function mostrarContenido() {
  if (ui.loadingPanel) {
    ui.loadingPanel.hidden = true;
  }

  if (ui.errorPanel) {
    ui.errorPanel.hidden = true;
  }

  if (ui.trackingContent) {
    ui.trackingContent.hidden = false;
  }

  actualizarEstadoConexion(
    navigator.onLine
  );
}

function mostrarErrorFatal(titulo, mensaje) {
  detenerEscuchas();

  if (ui.loadingPanel) {
    ui.loadingPanel.hidden = true;
  }

  if (ui.trackingContent) {
    ui.trackingContent.hidden = true;
  }

  if (ui.errorPanel) {
    ui.errorPanel.hidden = false;
  }

  colocarTexto(ui.errorTitle, titulo);
  colocarTexto(ui.errorMessage, mensaje);
  actualizarEstadoConexion(false);
}

function mostrarRetroalimentacion(
  mensaje,
  tipo = "info"
) {
  if (!ui.actionFeedback) return;

  ui.actionFeedback.hidden = false;
  ui.actionFeedback.className =
    `actionFeedback ${tipo}`;
  ui.actionFeedback.textContent = mensaje;

  window.clearTimeout(
    mostrarRetroalimentacion.temporizador
  );

  mostrarRetroalimentacion.temporizador =
    window.setTimeout(() => {
      ui.actionFeedback.hidden = true;
    }, 6500);
}

function actualizarEstadoConexion(conectado) {
  if (!ui.connectionStatus) return;

  ui.connectionStatus.textContent = conectado
    ? "Conectado en tiempo real"
    : "Sin conexión";

  ui.connectionStatus.dataset.online =
    String(Boolean(conectado));
}

/* ============================================================
   UTILIDADES
============================================================ */

function primerValor(...valores) {
  return valores.find(valor => {
    if (
      valor === null ||
      valor === undefined
    ) {
      return false;
    }

    if (typeof valor === "string") {
      return valor.trim() !== "";
    }

    return true;
  });
}

function colocarTexto(elemento, valor) {
  if (elemento) {
    elemento.textContent =
      String(valor ?? "");
  }
}

function convertirNumero(valor) {
  if (typeof valor === "number") {
    return valor;
  }

  if (
    typeof valor === "string" &&
    valor.trim() !== ""
  ) {
    return Number(
      valor.replace(",", ".")
    );
  }

  return Number.NaN;
}

function formatearTipoAlerta(valor) {
  const normalizado = String(
    valor || "Alerta"
  )
    .trim()
    .toLowerCase();

  if (normalizado.includes("robo")) {
    return "Robo de vehículo";
  }

  if (normalizado.includes("monta")) {
    return "Montachoques";
  }

  return capitalizarPalabras(
    normalizado || "alerta"
  );
}

function normalizarEstado(valor) {
  const clave = String(
    valor || "en_seguimiento"
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

  const etiquetas = {
    activa: "ALERTA ACTIVA",
    en_seguimiento: "EN SEGUIMIENTO",
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
    clave,
    etiqueta:
      etiquetas[clave] ||
      capitalizarPalabras(
        clave.replace(/_/g, " ")
      ).toUpperCase()
  };
}

function formatearFecha(valor) {
  if (!valor) return "Pendiente";

  let fecha;

  if (
    typeof valor?.toDate === "function"
  ) {
    fecha = valor.toDate();
  } else if (valor instanceof Date) {
    fecha = valor;
  } else if (
    typeof valor === "number" ||
    typeof valor === "string"
  ) {
    fecha = new Date(valor);
  } else if (
    typeof valor?.seconds === "number"
  ) {
    fecha = new Date(
      valor.seconds * 1000
    );
  }

  if (
    !(fecha instanceof Date) ||
    Number.isNaN(fecha.getTime())
  ) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(fecha);
}

function capitalizarPalabras(valor) {
  return String(valor)
    .split(" ")
    .filter(Boolean)
    .map(
      palabra =>
        palabra.charAt(0).toUpperCase() +
        palabra.slice(1)
    )
    .join(" ");
}

function obtenerOCrearIdVisitante() {
  const clave =
    "asClickEmergencyVisitorId";

  let id = localStorage.getItem(clave);

  if (!id) {
    id = crearIdSeguro();
    localStorage.setItem(clave, id);
  }

  return id;
}

function crearIdSeguro() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return (
    `${Date.now()}_` +
    Math.random()
      .toString(36)
      .slice(2, 12)
  );
}

function esTipoEvidenciaPermitido(tipoMime) {
  return (
    /^image\//i.test(tipoMime) ||
    /^video\//i.test(tipoMime)
  );
}

function esUrlHttpSegura(valor) {
  try {
    const url = new URL(
      valor,
      window.location.origin
    );

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escaparAtributo(valor) {
  return escaparHtml(valor)
    .replaceAll("`", "&#096;");
}
