import {
  auth,
  db
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

/* =========================================
   VARIABLES
========================================= */

let seccionActual = "inicio";
let usuarioActual = null;

/* =========================================
   PROTEGER EL DASHBOARD
========================================= */

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("./login.html");
    return;
  }

  usuarioActual = user;

  try {
    await cargarDatosUsuario(user);
  } catch (error) {
    console.error(
      "Error al cargar los datos del usuario:",
      error
    );

    cargarDatosBasicos(user);
  }
});

/* =========================================
   DATOS DEL USUARIO
========================================= */

async function cargarDatosUsuario(user) {
  const referenciaUsuario = doc(
    db,
    "usuarios",
    user.uid
  );

  const documentoUsuario =
    await getDoc(referenciaUsuario);

  if (!documentoUsuario.exists()) {
    cargarDatosBasicos(user);
    return;
  }

  const perfil = documentoUsuario.data();

  const nombre =
    perfil.nombre ||
    user.displayName ||
    obtenerNombreCorreo(user.email) ||
    "Usuario";

  const numeroMiembro =
    perfil.numeroMiembro ||
    perfil.numeroSocio ||
    "SIN ASIGNAR";

  const plan =
    perfil.tipoMembresia ||
    perfil.plan ||
    "AS CLICK Particular";

  const vigencia =
    perfil.vigencia ||
    "Pendiente de asignar";

  const estado =
    perfil.estadoMembresia ||
    perfil.estatus ||
    "activa";

  actualizarDatosPantalla({
    nombre,
    numeroMiembro,
    plan,
    vigencia,
    estado
  });
}

function cargarDatosBasicos(user) {
  const nombre =
    user.displayName ||
    obtenerNombreCorreo(user.email) ||
    "Usuario";

  actualizarDatosPantalla({
    nombre,
    numeroMiembro: "SIN ASIGNAR",
    plan: "AS CLICK Particular",
    vigencia: "Pendiente de asignar",
    estado: "activa"
  });
}

function obtenerNombreCorreo(correo) {
  if (!correo) return "";

  const nombre = correo.split("@")[0];

  return nombre
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, letra =>
      letra.toUpperCase()
    );
}

function actualizarDatosPantalla(datos) {
  const {
    nombre,
    numeroMiembro,
    plan,
    vigencia,
    estado
  } = datos;

  const nombreBienvenida =
    document.getElementById(
      "nombreBienvenida"
    );

  if (nombreBienvenida) {
    nombreBienvenida.textContent =
      `Hola, ${nombre}`;
  }

  const nombreUsuarioTop =
    document.getElementById(
      "nombreUsuarioTop"
    );

  if (nombreUsuarioTop) {
    nombreUsuarioTop.textContent =
      nombre;
  }

  const avatarUsuario =
    document.getElementById(
      "avatarUsuario"
    );

  if (avatarUsuario) {
    avatarUsuario.textContent =
      nombre.charAt(0).toUpperCase();
  }

  const numeroPrincipal =
    document.getElementById(
      "numeroMembresiaPrincipal"
    );

  if (numeroPrincipal) {
    numeroPrincipal.textContent =
      numeroMiembro;
  }

  const estadoPrincipal =
    document.getElementById(
      "estadoMembresiaPrincipal"
    );

  if (estadoPrincipal) {
    estadoPrincipal.textContent =
      String(estado).toUpperCase();
  }

  const vigenciaPrincipal =
    document.getElementById(
      "vigenciaPrincipal"
    );

  if (vigenciaPrincipal) {
    vigenciaPrincipal.textContent =
      vigencia;
  }

  const planPrincipal =
    document.getElementById(
      "planPrincipal"
    );

  if (planPrincipal) {
    planPrincipal.textContent =
      plan;
  }

  const membresiaInformacion =
    document.getElementById(
      "membresiaInformacion"
    );

  if (membresiaInformacion) {
    membresiaInformacion.textContent =
      plan;
  }

  const numeroInformacion =
    document.getElementById(
      "numeroMembresiaInformacion"
    );

  if (numeroInformacion) {
    numeroInformacion.textContent =
      numeroMiembro;
  }

  const vigenciaInformacion =
    document.getElementById(
      "vigenciaInformacion"
    );

  if (vigenciaInformacion) {
    vigenciaInformacion.textContent =
      vigencia;
  }

  const badgeMembresia =
    document.getElementById(
      "badgeMembresia"
    );

  if (badgeMembresia) {
    const activa =
      String(estado).toLowerCase() ===
      "activa";

    badgeMembresia.textContent =
      activa
        ? "✓ Membresía activa"
        : "⚠ Membresía inactiva";
  }
}

/* =========================================
   CAMBIAR SECCIÓN
========================================= */

function cambiarSeccion(
  seccion,
  boton = null
) {
  seccionActual = seccion;

  document
    .querySelectorAll(".pageSection")
    .forEach(section => {
      section.classList.remove("active");
    });

  const seccionDestino =
    document.getElementById(
      `seccion-${seccion}`
    );

  if (seccionDestino) {
    seccionDestino.classList.add("active");
  }

  document
    .querySelectorAll(".navItem")
    .forEach(item => {
      item.classList.remove("active");

      if (
        item.dataset.section === seccion
      ) {
        item.classList.add("active");
      }
    });

  document
    .querySelectorAll(
      ".mobileBottomNav button"
    )
    .forEach(item => {
      item.classList.remove("active");
    });

  if (
    boton &&
    boton.closest(".mobileBottomNav")
  ) {
    boton.classList.add("active");
  } else {
    const mobileButton = Array
      .from(
        document.querySelectorAll(
          ".mobileBottomNav button"
        )
      )
      .find(item =>
        item
          .getAttribute("onclick")
          ?.includes(`'${seccion}'`)
      );

    if (mobileButton) {
      mobileButton.classList.add("active");
    }
  }

  document
    .querySelectorAll(
      ".topNavigation button"
    )
    .forEach(item => {
      item.classList.remove("active");
    });

  const topButton = Array
    .from(
      document.querySelectorAll(
        ".topNavigation button"
      )
    )
    .find(item =>
      item
        .getAttribute("onclick")
        ?.includes(`'${seccion}'`)
    );

  if (topButton) {
    topButton.classList.add("active");
  }

  cerrarMenuMovil();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================================
   MENÚ MÓVIL
========================================= */

function abrirMenuMovil() {
  document
    .getElementById("sidebar")
    ?.classList.add("mobileOpen");

  document
    .getElementById("menuOverlay")
    ?.classList.add("active");
}

function cerrarMenuMovil() {
  document
    .getElementById("sidebar")
    ?.classList.remove("mobileOpen");

  document
    .getElementById("menuOverlay")
    ?.classList.remove("active");
}

/* =========================================
   SERVICIOS
========================================= */

async function solicitarServicio(servicio) {
  if (!usuarioActual) {
    mostrarModal(
      "⚠",
      "Sesión no disponible",
      "Inicia sesión nuevamente para solicitar asistencia."
    );

    return;
  }

  const confirmar = confirm(
    `¿Deseas solicitar el servicio de ${servicio}? Se pedirá permiso para compartir tu ubicación con cabina.`
  );

  if (!confirmar) return;

  mostrarModal(
    iconoServicio(servicio),
    "Obteniendo ubicación",
    "Permite el acceso a tu ubicación para enviar la solicitud a cabina."
  );

  try {
    const ubicacion =
      await obtenerUbicacionActual();

    const perfilRef = doc(
      db,
      "usuarios",
      usuarioActual.uid
    );

    const perfilSnap =
      await getDoc(perfilRef);

    if (!perfilSnap.exists()) {
      throw new Error(
        "No encontramos tu perfil de usuario."
      );
    }

    const perfil =
      perfilSnap.data();

    const tipoServicio =
      normalizarTipoServicio(servicio);

    const solicitud = {
      uidCliente:
        usuarioActual.uid,

      cliente: {
        nombre:
          perfil.nombre ||
          usuarioActual.displayName ||
          "Cliente",

        telefono:
          perfil.telefono || "",

        correo:
          perfil.correo ||
          usuarioActual.email ||
          "",

        tipoCliente:
          perfil.tipoCliente ||
          "particular"
      },

      membresia: {
        tieneMembresia:
          perfil.tieneMembresia === true,

        numeroMiembro:
          perfil.numeroMiembro || "",

        estadoMembresia:
          perfil.estadoMembresia ||
          "sin_membresia",

        tipoMembresia:
          perfil.tipoMembresia || "",

        tarifa:
          perfil.tarifa ||
          (
            perfil.tieneMembresia
              ? "preferencial"
              : "publico_general"
          )
      },

      vehiculo: {
        marca:
          perfil.marca ||
          perfil.vehiculoPrincipal?.marca ||
          "",

        subMarca:
          perfil.subMarca ||
          perfil.vehiculoPrincipal?.subMarca ||
          "",

        color:
          perfil.color ||
          perfil.vehiculoPrincipal?.color ||
          "",

        placas:
          perfil.placas ||
          perfil.vehiculoPrincipal?.placas ||
          "",

        serie:
          perfil.serie ||
          perfil.vehiculoPrincipal?.serie ||
          ""
      },

      servicio: {
        tipo:
          tipoServicio,

        nombre:
          servicio
      },

      ubicacion: {
        latitud:
          ubicacion.latitud,

        longitud:
          ubicacion.longitud,

        precision:
          ubicacion.precision,

        enlaceGoogleMaps:
          `https://www.google.com/maps?q=${ubicacion.latitud},${ubicacion.longitud}`
      },

      /*
        El folio queda vacío porque se generará
        desde la página de toma de reportes.
      */

      folioOficial: "",

      estado:
        "pendiente_cabina",

      asignacion: {
        uidProveedor: "",
        nombreProveedor: "",
        telefonoProveedor: "",
        fotoProveedor: "",
        tiempoEstimadoMinutos: null
      },

      creadoEn:
        serverTimestamp(),

      actualizadoEn:
        serverTimestamp()
    };

    const solicitudRef =
      await addDoc(
        collection(
          db,
          "solicitudes"
        ),
        solicitud
      );

    console.log(
      "Solicitud creada:",
      solicitudRef.id
    );

    mostrarModal(
      "✓",
      "Solicitud enviada a cabina",
      `Recibimos tu solicitud de ${servicio}. Cabina revisará la información y generará el folio oficial.`
    );
  } catch (error) {
    console.error(
      "Error al solicitar servicio:",
      error
    );

    mostrarModal(
      "⚠",
      "No fue posible enviar la solicitud",
      obtenerMensajeSolicitud(error)
    );
  }
}

/* =========================================
   TIPO DE SERVICIO
========================================= */

function normalizarTipoServicio(servicio) {
  const tipos = {
    Ajustador:
      "ajustador",

    Abogado:
      "abogado",

    "Auxilio vial":
      "auxilio_vial",

    Grúa:
      "grua"
  };

  return tipos[servicio] || "otro";
}

/* =========================================
   UBICACIÓN GPS
========================================= */

function obtenerUbicacionActual() {
  return new Promise(
    (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          crearErrorSolicitud(
            "gps/no-disponible",
            "Este dispositivo no permite obtener la ubicación."
          )
        );

        return;
      }

      navigator.geolocation.getCurrentPosition(
        posicion => {
          resolve({
            latitud:
              posicion.coords.latitude,

            longitud:
              posicion.coords.longitude,

            precision:
              posicion.coords.accuracy
          });
        },

        error => {
          if (
            error.code ===
            error.PERMISSION_DENIED
          ) {
            reject(
              crearErrorSolicitud(
                "gps/permiso-denegado",
                "Debes permitir el acceso a tu ubicación para solicitar el servicio."
              )
            );

            return;
          }

          if (
            error.code ===
            error.POSITION_UNAVAILABLE
          ) {
            reject(
              crearErrorSolicitud(
                "gps/no-disponible",
                "No fue posible determinar tu ubicación."
              )
            );

            return;
          }

          if (
            error.code ===
            error.TIMEOUT
          ) {
            reject(
              crearErrorSolicitud(
                "gps/tiempo-agotado",
                "La ubicación tardó demasiado. Inténtalo nuevamente."
              )
            );

            return;
          }

          reject(
            crearErrorSolicitud(
              "gps/error",
              "No fue posible obtener tu ubicación."
            )
          );
        },

        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        }
      );
    }
  );
}

function crearErrorSolicitud(
  codigo,
  mensaje
) {
  const error =
    new Error(mensaje);

  error.code =
    codigo;

  return error;
}

function obtenerMensajeSolicitud(error) {
  const mensajes = {
    "gps/permiso-denegado":
      "Debes permitir la ubicación para enviar la solicitud a cabina.",

    "gps/no-disponible":
      "No fue posible obtener tu ubicación. Activa el GPS e inténtalo nuevamente.",

    "gps/tiempo-agotado":
      "La ubicación tardó demasiado. Acércate a una ventana o activa la ubicación precisa.",

    "permission-denied":
      "Firestore bloqueó la solicitud. Revisa las reglas de seguridad.",

    "firestore/permission-denied":
      "Firestore bloqueó la solicitud. Revisa las reglas de seguridad.",

    "unavailable":
      "El servicio está temporalmente fuera de línea."
  };

  return (
    mensajes[error?.code] ||
    error?.message ||
    "Ocurrió un problema al enviar la solicitud."
  );
}

function iconoServicio(servicio) {
  if (servicio === "Ajustador") {
    return "👤";
  }

  if (servicio === "Abogado") {
    return "⚖";
  }

  if (servicio === "Auxilio vial") {
    return "🔧";
  }

  if (servicio === "Grúa") {
    return "🚛";
  }

  return "✓";
}

/* =========================================
   ALERTAS
========================================= */

function activarAlerta(tipo) {
  const confirmar = confirm(
    `¿Confirmas que deseas activar la alerta de ${tipo}? Esta función debe utilizarse únicamente en una emergencia real.`
  );

  if (!confirmar) return;

  mostrarModal(
    "⚠",
    `Alerta de ${tipo} activada`,
    "La alerta fue preparada. Después conectaremos ubicación GPS, Firestore y el panel de atención."
  );
}

/* =========================================
   WHATSAPP
========================================= */

function hablarAsesor() {
  const numeroWhatsApp =
    "525512345678";

  const mensaje =
    "Hola, necesito hablar con un asesor de AS CLICK.";

  const url =
    `https://wa.me/${numeroWhatsApp}` +
    `?text=${encodeURIComponent(mensaje)}`;

  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );
}

/* =========================================
   OTRAS FUNCIONES
========================================= */

function verDetalle(folio) {
  mostrarModal(
    "▣",
    `Servicio ${folio}`,
    "Aquí aparecerá el seguimiento completo, operador asignado, ubicación, estado y detalles del servicio."
  );
}

function verMembresia() {
  cambiarSeccion("beneficios");
}

function agregarVehiculo() {
  mostrarModal(
    "🚙",
    "Agregar vehículo",
    "Después agregaremos aquí el formulario para registrar marca, modelo, placas, color, serie y fotografía."
  );
}

function mostrarTerminos() {
  mostrarModal(
    "⚠",
    "Términos de las alertas",
    "Las alertas deben utilizarse únicamente en situaciones reales. El uso falso o irresponsable puede ocasionar sanciones o cancelación de la membresía."
  );
}

function abrirNotificaciones() {
  mostrarModal(
    "🔔",
    "Notificaciones",
    "Aquí aparecerán las notificaciones reales del usuario."
  );
}

function abrirMenuUsuario() {
  cambiarSeccion("perfil");
}

/* =========================================
   CERRAR SESIÓN REAL
========================================= */

async function cerrarSesion() {
  const confirmar = confirm(
    "¿Deseas cerrar tu sesión?"
  );

  if (!confirmar) return;

  try {
    await signOut(auth);

    window.location.replace(
      "./login.html"
    );
  } catch (error) {
    console.error(
      "Error al cerrar sesión:",
      error
    );

    alert(
      "No fue posible cerrar la sesión. Inténtalo nuevamente."
    );
  }
}

/* =========================================
   MODAL
========================================= */

function mostrarModal(
  icono,
  titulo,
  texto
) {
  const modalIcon =
    document.getElementById(
      "modalIcon"
    );

  const modalTitle =
    document.getElementById(
      "modalTitle"
    );

  const modalText =
    document.getElementById(
      "modalText"
    );

  const modalOverlay =
    document.getElementById(
      "modalOverlay"
    );

  if (modalIcon) {
    modalIcon.textContent = icono;
  }

  if (modalTitle) {
    modalTitle.textContent = titulo;
  }

  if (modalText) {
    modalText.textContent = texto;
  }

  modalOverlay?.classList.add(
    "active"
  );
}

function cerrarModal(event = null) {
  if (
    event &&
    event.target.id !== "modalOverlay"
  ) {
    return;
  }

  document
    .getElementById("modalOverlay")
    ?.classList.remove("active");
}

/* =========================================
   EVENTOS
========================================= */

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape") {
      cerrarMenuMovil();
      cerrarModal();
    }
  }
);

window.addEventListener(
  "resize",
  () => {
    if (window.innerWidth > 760) {
      cerrarMenuMovil();
    }
  }
);

/* =========================================
   EXPONER FUNCIONES AL HTML
========================================= */

window.cambiarSeccion =
  cambiarSeccion;

window.abrirMenuMovil =
  abrirMenuMovil;

window.cerrarMenuMovil =
  cerrarMenuMovil;

window.solicitarServicio =
  solicitarServicio;

window.activarAlerta =
  activarAlerta;

window.hablarAsesor =
  hablarAsesor;

window.verDetalle =
  verDetalle;

window.verMembresia =
  verMembresia;

window.agregarVehiculo =
  agregarVehiculo;

window.mostrarTerminos =
  mostrarTerminos;

window.abrirNotificaciones =
  abrirNotificaciones;

window.abrirMenuUsuario =
  abrirMenuUsuario;

window.cerrarSesion =
  cerrarSesion;

window.cerrarModal =
  cerrarModal;
