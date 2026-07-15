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
  getDoc
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

function solicitarServicio(servicio) {
  mostrarModal(
    iconoServicio(servicio),
    `Solicitar ${servicio}`,
    `Tu solicitud de ${servicio.toLowerCase()} está lista para ser enviada. En la siguiente etapa conectaremos este botón con Firestore y el panel de cabina.`
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
