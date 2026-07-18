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

 

  collection,

 

  addDoc,

 

  getDocs,

 

  query,

 

  where,

 

  serverTimestamp

 

} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

 

 

 

/* =========================================

 

   CONFIGURACIÓN

 

========================================= */

 

 

 

/*

 

  Cambia estos dos números por los reales.

 

 

 

  Formato:

 

  52 + lada + número

 

  Sin espacios, guiones ni signo +

 

*/

 

 

 

const TELEFONO_CABINA = "525563577842";

 

const TELEFONO_EMERGENCIAS = "525585373051";

 

const TELEFONO_ASESOR = TELEFONO_CABINA;

 

 

 

/* =========================================

 

   VARIABLES

 

========================================= */

 

 

 

let seccionActual = "inicio";

 

let usuarioActual = null;

 

let historialServicios = [];

 

 

 

let perfilActual = {

 

  nombre: "Usuario",

 

  telefono: "",

 

  correo: "",

 

  tipoCliente: "particular",

 

 

 

  tieneMembresia: false,

 

  numeroMiembro: "",

 

  estadoMembresia: "sin_membresia",

 

  tipoMembresia: "",

 

  vigencia: "",

 

 

 

  tarifa: "publico_general",

 

  puedeUsarAlertas: false,

 

 

 

  marca: "",

 

  subMarca: "",

 

  color: "",

 

  placas: "",

 

  serie: ""

 

};

 

 

 

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

 

    await cargarHistorialServicios();

 

  } catch (error) {

 

    console.error(

 

      "Error al cargar los datos del usuario:",

 

      error

 

    );

 

 

 

    cargarDatosBasicos(user);

 

 

 

    mostrarModal(

 

      "⚠",

 

      "No fue posible cargar tu perfil",

 

      "Tu sesión está activa, pero no pudimos cargar todos tus datos. Revisa tu conexión e inténtalo nuevamente."

 

    );

 

  }

 

});

 

 

 

/* =========================================

 

   CARGAR PERFIL DESDE FIRESTORE

 

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

 

 

 

  const datos = documentoUsuario.data();

 

  const vehiculo = datos.vehiculoPrincipal || {};

 

 

 

  perfilActual = {

 

    nombre:

 

      datos.nombre ||

 

      user.displayName ||

 

      obtenerNombreCorreo(user.email) ||

 

      "Usuario",

 

 

 

    telefono:

 

      datos.telefono || "",

 

 

 

    correo:

 

      datos.correo ||

 

      user.email ||

 

      "",

 

 

 

    tipoCliente:

 

      datos.tipoCliente ||

 

      "particular",

 

 

 

    tieneMembresia:

 

      datos.tieneMembresia === true,

 

 

 

    numeroMiembro:

 

      datos.numeroMiembro ||

 

      datos.numeroSocio ||

 

      datos.numeroMembresia ||

 

      "",

 

 

 

    estadoMembresia:

 

      normalizarEstado(

 

        datos.estadoMembresia ||

 

        datos.estatus ||

 

        datos.estado ||

 

        (

 

          datos.tieneMembresia

 

            ? "activa"

 

            : "sin_membresia"

 

        )

 

      ),

 

 

 

    tipoMembresia:

 

      datos.tipoMembresia ||

 

      datos.plan ||

 

      "",

 

 

 

    vigencia:

 

      formatearVigencia(

 

        datos.vigencia ||

 

        datos.finVigencia ||

 

        ""

 

      ),

 

 

 

    tarifa:

 

      datos.tarifa ||

 

      (

 

        datos.tieneMembresia

 

          ? "preferencial"

 

          : "publico_general"

 

      ),

 

 

 

    puedeUsarAlertas:

 

      datos.puedeUsarAlertas === true,

 

 

 

    marca:

 

      datos.marca ||

 

      vehiculo.marca ||

 

      "",

 

 

 

    subMarca:

 

      datos.subMarca ||

 

      datos.submarca ||

 

      vehiculo.subMarca ||

 

      vehiculo.submarca ||

 

      "",

 

 

 

    color:

 

      datos.color ||

 

      vehiculo.color ||

 

      "",

 

 

 

    placas:

 

      datos.placas ||

 

      vehiculo.placas ||

 

      "",

 

 

 

    serie:

 

      datos.serie ||

 

      vehiculo.serie ||

 

      ""

 

  };

 

 

 

  perfilActual.puedeUsarAlertas =

 

    perfilActual.tieneMembresia === true &&

 

    perfilActual.estadoMembresia === "activa" &&

 

    datos.puedeUsarAlertas !== false;

 

 

 

  actualizarDatosPantalla(perfilActual);

 

}

 

 

 

function cargarDatosBasicos(user) {

 

  perfilActual = {

 

    nombre:

 

      user.displayName ||

 

      obtenerNombreCorreo(user.email) ||

 

      "Usuario",

 

 

 

    telefono: "",

 

    correo: user.email || "",

 

    tipoCliente: "particular",

 

 

 

    tieneMembresia: false,

 

    numeroMiembro: "",

 

    estadoMembresia: "sin_membresia",

 

    tipoMembresia: "",

 

    vigencia: "",

 

 

 

    tarifa: "publico_general",

 

    puedeUsarAlertas: false,

 

 

 

    marca: "",

 

    subMarca: "",

 

    color: "",

 

    placas: "",

 

    serie: ""

 

  };

 

 

 

  actualizarDatosPantalla(perfilActual);

 

}

 

 

 

function obtenerNombreCorreo(correo) {

 

  if (!correo) return "";

 

 

 

  const nombre = correo.split("@")[0] || "";

 

 

 

  return nombre

 

    .replace(/[._-]/g, " ")

 

    .replace(/\b\w/g, letra =>

 

      letra.toUpperCase()

 

    );

 

}

 

 

 

function normalizarEstado(estado) {

 

  return String(estado || "")

 

    .trim()

 

    .toLowerCase()

 

    .replace(/\s+/g, "_");

 

}

 

 

 

function formatearVigencia(valor) {

 

  if (!valor) return "";

 

 

 

  if (

 

    typeof valor === "object" &&

 

    typeof valor.toDate === "function"

 

  ) {

 

    return valor

 

      .toDate()

 

      .toLocaleDateString(

 

        "es-MX",

 

        {

 

          day: "2-digit",

 

          month: "long",

 

          year: "numeric"

 

        }

 

      );

 

  }

 

 

 

  const texto = String(valor).trim();

 

 

 

  if (!texto) return "";

 

 

 

  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {

 

    const fecha = new Date(texto);

 

 

 

    if (!Number.isNaN(fecha.getTime())) {

 

      return fecha.toLocaleDateString(

 

        "es-MX",

 

        {

 

          day: "2-digit",

 

          month: "long",

 

          year: "numeric"

 

        }

 

      );

 

    }

 

  }

 

 

 

  return texto;

 

}

 

 

 

/* =========================================

 

   ACTUALIZAR PANTALLA

 

========================================= */

 

 

 

function actualizarDatosPantalla(perfil) {

 

  const esMiembroActivo =

 

    perfil.tieneMembresia === true &&

 

    perfil.estadoMembresia === "activa";

 

 

 

  actualizarTexto(

 

    "nombreBienvenida",

 

    `Hola, ${perfil.nombre}`

 

  );

 

 

 

  actualizarTexto(

 

    "nombreUsuarioTop",

 

    perfil.nombre

 

  );

 

 

 

  actualizarTexto(

 

    "avatarUsuario",

 

    perfil.nombre

 

      .trim()

 

      .charAt(0)

 

      .toUpperCase() || "U"

 

  );

 

 

 

  actualizarTexto(

 

    "numeroMembresiaPrincipal",

 

    perfil.tieneMembresia

 

      ? (

 

          perfil.numeroMiembro ||

 

          "PENDIENTE"

 

        )

 

      : "SIN MEMBRESÍA"

 

  );

 

 

 

  actualizarTexto(

 

    "estadoMembresiaPrincipal",

 

    obtenerTextoEstado(perfil)

 

  );

 

 

 

  actualizarTexto(

 

    "vigenciaPrincipal",

 

    perfil.tieneMembresia

 

      ? (

 

          perfil.vigencia ||

 

          "Pendiente de asignar"

 

        )

 

      : "No aplica"

 

  );

 

 

 

  actualizarTexto(

 

    "planPrincipal",

 

    perfil.tieneMembresia

 

      ? (

 

          perfil.tipoMembresia ||

 

          obtenerTipoClienteTexto(

 

            perfil.tipoCliente

 

          )

 

        )

 

      : "Público general"

 

  );

 

 

 

  actualizarTexto(

 

    "membresiaInformacion",

 

    perfil.tieneMembresia

 

      ? (

 

          perfil.tipoMembresia ||

 

          "AS CLICK"

 

        )

 

      : "Sin membresía"

 

  );

 

 

 

  actualizarTexto(

 

    "numeroMembresiaInformacion",

 

    perfil.tieneMembresia

 

      ? (

 

          perfil.numeroMiembro ||

 

          "PENDIENTE"

 

        )

 

      : "No aplica"

 

  );

 

 

 

  actualizarTexto(

 

    "vigenciaInformacion",

 

    perfil.tieneMembresia

 

      ? (

 

          perfil.vigencia ||

 

          "Pendiente"

 

        )

 

      : "No aplica"

 

  );

 

 

 

  const badge =

 

    document.getElementById(

 

      "badgeMembresia"

 

    );

 

 

 

  if (badge) {

 

    if (esMiembroActivo) {

 

      badge.textContent =

 

        "✓ Membresía activa";

 

    } else if (perfil.tieneMembresia) {

 

      badge.textContent =

 

        "⚠ Membresía inactiva";

 

    } else {

 

      badge.textContent =

 

        "Cliente sin membresía";

 

    }

 

  }

 

 

 

  const estadoPrincipal =

 

    document.getElementById(

 

      "estadoMembresiaPrincipal"

 

    );

 

 

 

  if (estadoPrincipal) {

 

    estadoPrincipal.classList.toggle(

 

      "inactive",

 

      !esMiembroActivo

 

    );

 

  }

 

 

 

  actualizarVehiculoPantalla(perfil);

 

  configurarAlertas(

 

    perfil.puedeUsarAlertas

 

  );

 

 

 

  const tituloMembresia =

 

    document.querySelector(

 

      ".membershipInfo h2"

 

    );

 

 

 

  if (tituloMembresia) {

 

    tituloMembresia.textContent =

 

      perfil.tieneMembresia

 

        ? "Información de tu membresía"

 

        : "Información de tu cuenta";

 

  }

 

 

 

  const beneficiosTexto =

 

    document.querySelector(

 

      "#seccion-beneficios .placeholderPage p"

 

    );

 

 

 

  if (beneficiosTexto) {

 

    beneficiosTexto.textContent =

 

      esMiembroActivo

 

        ? "Consulta los beneficios incluidos en tu membresía activa."

 

        : "Puedes solicitar servicios con tarifa de público general. Las alertas de robo y montachoques son exclusivas para miembros activos.";

 

  }

 

}

 

 

 

function actualizarTexto(id, texto) {

 

  const elemento =

 

    document.getElementById(id);

 

 

 

  if (elemento) {

 

    elemento.textContent = texto;

 

  }

 

}

 

 

 

function obtenerTextoEstado(perfil) {

 

  if (!perfil.tieneMembresia) {

 

    return "PÚBLICO GENERAL";

 

  }

 

 

 

  const textos = {

 

    activa: "ACTIVA",

 

    asignada: "ACTIVA",

 

    disponible: "ACTIVA",

 

    pendiente: "PENDIENTE",

 

    pendiente_activacion: "PENDIENTE",

 

    vencida: "VENCIDA",

 

    cancelada: "CANCELADA"

 

  };

 

 

 

  return (

 

    textos[perfil.estadoMembresia] ||

 

    perfil.estadoMembresia

 

      .replace(/_/g, " ")

 

      .toUpperCase()

 

  );

 

}

 

 

 

function obtenerTipoClienteTexto(tipo) {

 

  return tipo === "servicio_publico"

 

    ? "Servicio público"

 

    : "Particular";

 

}

 

 

 

/* =========================================

 

   PERFIL

 

========================================= */

 

function actualizarPerfilPantalla(perfil) {

  const inicial =

    perfil.nombre?.trim().charAt(0).toUpperCase() || "U";

 

  const nombreVehiculo =

    [perfil.marca, perfil.subMarca]

      .filter(Boolean)

      .join(" ") || "Vehículo sin registrar";

 

  actualizarTexto("perfilAvatar", inicial);

  actualizarTexto("perfilNombreResumen", perfil.nombre || "Usuario");

  actualizarTexto("perfilCorreoResumen", perfil.correo || "Correo no registrado");

  actualizarTexto(

    "perfilEstadoMembresia",

    perfil.tieneMembresia

      ? `Membresía ${obtenerTextoEstado(perfil).toLowerCase()}`

      : "Cliente registrado"

  );

  actualizarTexto(

    "perfilNumeroMembresia",

    perfil.tieneMembresia

      ? perfil.numeroMiembro || "Pendiente"

      : "No aplica"

  );

  actualizarTexto(

    "perfilVigencia",

    perfil.tieneMembresia

      ? perfil.vigencia || "Pendiente"

      : "No aplica"

  );

  actualizarTexto(

    "perfilTarifa",

    perfil.tieneMembresia && perfil.estadoMembresia === "activa"

      ? "Preferencial"

      : "Público general"

  );

  actualizarTexto("perfilNombre", perfil.nombre || "No registrado");

  actualizarTexto("perfilTelefono", perfil.telefono || "No registrado");

  actualizarTexto("perfilCorreo", perfil.correo || "No registrado");

  actualizarTexto(

    "perfilTipoCliente",

    obtenerTipoClienteTexto(perfil.tipoCliente)

  );

  actualizarTexto("perfilVehiculoNombre", nombreVehiculo);

  actualizarTexto(

    "perfilVehiculoPlacas",

    `Placas: ${perfil.placas || "Sin registrar"}`

  );

  actualizarTexto(

    "perfilVehiculoColor",

    `Color: ${perfil.color || "Sin registrar"}`

  );

  actualizarTexto(

    "perfilVehiculoSerie",

    `Serie: ${perfil.serie || "Sin registrar"}`

  );

}

 

/* =========================================

 

   VEHÍCULO

 

========================================= */

 

 

 

function actualizarVehiculoPantalla(perfil) {

 

  const nombreVehiculo =

 

    [

 

      perfil.marca,

 

      perfil.subMarca

 

    ]

 

      .filter(Boolean)

 

      .join(" ");

 

 

 

  const tituloVehiculo =

 

    nombreVehiculo ||

 

    "Vehículo sin registrar";

 

 

 

  const vehicleBody =

 

    document.querySelector(

 

      ".vehicleBody"

 

    );

 

 

 

  if (vehicleBody) {

 

    const titulo =

 

      vehicleBody.querySelector("b");

 

 

 

    const textos =

 

      vehicleBody.querySelectorAll(

 

        "span"

 

      );

 

 

 

    if (titulo) {

 

      titulo.textContent =

 

        tituloVehiculo;

 

    }

 

 

 

    if (textos[0]) {

 

      textos[0].textContent =

 

        `Placas: ${

 

          perfil.placas ||

 

          "Sin registrar"

 

        }`;

 

    }

 

 

 

    if (textos[1]) {

 

      textos[1].textContent =

 

        `Color: ${

 

          perfil.color ||

 

          "Sin registrar"

 

        }`;

 

    }

 

  }

 

 

 

  const vehicleFullCard =

 

    document.querySelector(

 

      ".vehicleFullCard"

 

    );

 

 

 

  if (vehicleFullCard) {

 

    const titulo =

 

      vehicleFullCard.querySelector(

 

        "h3"

 

      );

 

 

 

    const parrafos =

 

      vehicleFullCard.querySelectorAll(

 

        "p"

 

      );

 

 

 

    const etiqueta =

 

      vehicleFullCard.querySelector(

 

        "span"

 

      );

 

 

 

    if (titulo) {

 

      titulo.textContent =

 

        tituloVehiculo;

 

    }

 

 

 

    if (parrafos[0]) {

 

      parrafos[0].textContent =

 

        `Placas: ${

 

          perfil.placas ||

 

          "Sin registrar"

 

        }`;

 

    }

 

 

 

    if (parrafos[1]) {

 

      parrafos[1].textContent =

 

        `Color: ${

 

          perfil.color ||

 

          "Sin registrar"

 

        }`;

 

    }

 

 

 

    if (etiqueta) {

 

      etiqueta.textContent =

 

        perfil.serie

 

          ? `Serie: ${perfil.serie}`

 

          : "Vehículo principal";

 

    }

 

  }

 

}

 

 

 

/* =========================================

 

   ALERTAS

 

========================================= */

 

 

 

function configurarAlertas(

 

  puedeUsarlas

 

) {

 

  const seccionAlertas =

 

    document.querySelector(

 

      ".emergencySection"

 

    );

 

 

 

  if (!seccionAlertas) return;

 

 

 

  seccionAlertas.style.display =

 

    puedeUsarlas

 

      ? ""

 

      : "none";

 

}

 

 

 

/* =========================================

 

   CAMBIAR SECCIÓN

 

========================================= */

 

 

 

function cambiarSeccion(

 

  seccion,

 

  boton = null

 

) {

 

  seccionActual = seccion;

 

  if (seccion === "historial") {

    cargarHistorialServicios();

  }

 

 

 

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

 

    const mobileButton =

 

      Array.from(

 

        document.querySelectorAll(

 

          ".mobileBottomNav button"

 

        )

 

      ).find(item =>

 

        item

 

          .getAttribute("onclick")

 

          ?.includes(`'${seccion}'`)

 

      );

 

 

 

    mobileButton?.classList.add("active");

 

  }

 

 

 

  document

 

    .querySelectorAll(

 

      ".topNavigation button"

 

    )

 

    .forEach(item => {

 

      item.classList.remove("active");

 

    });

 

 

 

  const topButton =

 

    Array.from(

 

      document.querySelectorAll(

 

        ".topNavigation button"

 

      )

 

    ).find(item =>

 

      item

 

        .getAttribute("onclick")

 

        ?.includes(`'${seccion}'`)

 

    );

 

 

 

  topButton?.classList.add("active");

 

 

 

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

 

   SOLICITAR SERVICIO

 

========================================= */

 

 

 

async function solicitarServicio(servicio) {

 

  if (!usuarioActual) {

 

    mostrarModal(

 

      "⚠",

 

      "Sesión no disponible",

 

      "Inicia sesión nuevamente para solicitar el servicio."

 

    );

 

    return;

 

  }

 

 

 

  const tipoTarifa =

 

    perfilActual.tieneMembresia &&

 

    perfilActual.estadoMembresia === "activa"

 

      ? "Tarifa preferencial de miembro"

 

      : "Tarifa de público general";

 

 

 

  const ubicacion =

 

    await obtenerUbicacion();

 

 

 

  await guardarSolicitudServicio(

    servicio,

    tipoTarifa,

    ubicacion

  );

 

  const mensaje =

 

    construirMensajeServicio(

 

      servicio,

 

      tipoTarifa,

 

      ubicacion

 

    );

 

 

 

  const url =

 

    `https://wa.me/${TELEFONO_CABINA}` +

 

    `?text=${encodeURIComponent(mensaje)}`;

 

 

 

  window.open(

 

    url,

 

    "_blank",

 

    "noopener,noreferrer"

 

  );

 

}

 

 

 

function construirMensajeServicio(

 

  servicio,

 

  tipoTarifa,

 

  ubicacion

 

) {

 

  const numeroMembresia =

 

    perfilActual.tieneMembresia

 

      ? (

 

          perfilActual.numeroMiembro ||

 

          "Pendiente"

 

        )

 

      : "Sin membresía";

 

 

 

  return [

 

    `*SOLICITUD AS CLICK - ${servicio.toUpperCase()}*`,

 

    "",

 

    `Tipo de tarifa: ${tipoTarifa}`,

 

    `Tipo de cliente: ${obtenerTipoClienteTexto(perfilActual.tipoCliente)}`,

 

    `Membresía: ${numeroMembresia}`,

 

    `Estado: ${obtenerTextoEstado(perfilActual)}`,

 

    "",

 

    "*DATOS DEL CLIENTE*",

 

    `Nombre: ${perfilActual.nombre || "No registrado"}`,

 

    `Teléfono: ${perfilActual.telefono || "No registrado"}`,

 

    `Correo: ${perfilActual.correo || "No registrado"}`,

 

    "",

 

    "*DATOS DEL VEHÍCULO*",

 

    `Marca: ${perfilActual.marca || "No registrada"}`,

 

    `Submarca: ${perfilActual.subMarca || "No registrada"}`,

 

    `Color: ${perfilActual.color || "No registrado"}`,

 

    `Placas: ${perfilActual.placas || "No registradas"}`,

 

    `Serie / VIN: ${perfilActual.serie || "No registrada"}`,

 

    "",

 

    "*SERVICIO SOLICITADO*",

 

    `Servicio: ${servicio}`,

 

    `Ubicación: ${ubicacion}`,

 

    "",

 

    "Comentarios:"

 

  ].join("\n");

 

}

 

 

 

/* =========================================

 

   HISTORIAL DE SERVICIOS

 

========================================= */

 

async function guardarSolicitudServicio(servicio, tipoTarifa, ubicacion) {

  if (!usuarioActual) return;

 

  try {

    await addDoc(collection(db, "servicios"), {

      usuarioId: usuarioActual.uid,

      uid: usuarioActual.uid,

      folio: generarFolioServicio(),

      servicio,

      estado: "solicitado",

      tipoTarifa,

      ubicacion,

      cliente: {

        nombre: perfilActual.nombre || "",

        telefono: perfilActual.telefono || "",

        correo: perfilActual.correo || ""

      },

      vehiculo: {

        marca: perfilActual.marca || "",

        subMarca: perfilActual.subMarca || "",

        color: perfilActual.color || "",

        placas: perfilActual.placas || "",

        serie: perfilActual.serie || ""

      },

      creadoEn: serverTimestamp(),

      fechaCreacion: new Date().toISOString()

    });

 

    await cargarHistorialServicios();

  } catch (error) {

    console.error("No fue posible guardar la solicitud:", error);

  }

}

 

function generarFolioServicio() {

  const fecha = new Date();

  const anio = fecha.getFullYear().toString().slice(-2);

  const mes = String(fecha.getMonth() + 1).padStart(2, "0");

  const dia = String(fecha.getDate()).padStart(2, "0");

  const aleatorio = Math.floor(1000 + Math.random() * 9000);

  return `ASC-${anio}${mes}${dia}-${aleatorio}`;

}

 

async function cargarHistorialServicios() {

  if (!usuarioActual) return;

 

  try {

    const consulta = query(

      collection(db, "servicios"),

      where("usuarioId", "==", usuarioActual.uid)

    );

 

    const resultado = await getDocs(consulta);

 

    historialServicios = resultado.docs

      .map(documento => ({

        id: documento.id,

        ...documento.data()

      }))

      .sort((a, b) => obtenerMilisegundos(b) - obtenerMilisegundos(a));

 

    actualizarResumenHistorial();

    renderizarHistorial(historialServicios);

  } catch (error) {

    console.error("Error al cargar el historial:", error);

    renderizarHistorial([]);

  }

}

 

function obtenerMilisegundos(servicio) {

  const fecha = servicio.creadoEn || servicio.fechaCreacion || servicio.fecha || "";

 

  if (fecha && typeof fecha.toDate === "function") {

    return fecha.toDate().getTime();

  }

 

  const valor = new Date(fecha).getTime();

  return Number.isNaN(valor) ? 0 : valor;

}

 

function actualizarResumenHistorial() {

  const estadosProceso = [

    "solicitado",

    "asignado",

    "en_camino",

    "en_proceso",

    "aceptado",

    "arribo"

  ];

 

  actualizarTexto("historialTotal", String(historialServicios.length));

  actualizarTexto(

    "historialProceso",

    String(historialServicios.filter(item =>

      estadosProceso.includes(normalizarEstado(item.estado))

    ).length)

  );

  actualizarTexto(

    "historialTerminados",

    String(historialServicios.filter(item =>

      ["finalizado", "terminado", "completado"].includes(

        normalizarEstado(item.estado)

      )

    ).length)

  );

  actualizarTexto(

    "historialCancelados",

    String(historialServicios.filter(item =>

      ["cancelado", "cancelada"].includes(normalizarEstado(item.estado))

    ).length)

  );

}

 

function filtrarHistorial() {

  const busqueda =

    document.getElementById("buscadorHistorial")

      ?.value.trim().toLowerCase() || "";

 

  const estado =

    document.getElementById("filtroEstadoHistorial")?.value || "todos";

 

  const tipo =

    document.getElementById("filtroTipoHistorial")?.value || "todos";

 

  const filtrados = historialServicios.filter(item => {

    const vehiculo = item.vehiculo || {};

    const texto = [

      item.folio,

      item.servicio,

      item.tipoServicio,

      vehiculo.marca,

      vehiculo.subMarca,

      vehiculo.placas,

      item.marca,

      item.subMarca,

      item.placas

    ]

      .filter(Boolean)

      .join(" ")

      .toLowerCase();

 

    const estadoItem = normalizarEstado(item.estado || "solicitado");

    const tipoItem = String(item.servicio || item.tipoServicio || "")

      .trim()

      .toLowerCase();

 

    return (

      (!busqueda || texto.includes(busqueda)) &&

      (estado === "todos" || estadoItem === estado) &&

      (tipo === "todos" || tipoItem === tipo)

    );

  });

 

  renderizarHistorial(filtrados);

}

 

function renderizarHistorial(servicios) {

  const cuerpo = document.getElementById("historialServiciosBody");

  if (!cuerpo) return;

 

  if (!servicios.length) {

    cuerpo.innerHTML = `

      <tr class="emptyHistoryRow">

        <td colspan="6">

          <div class="emptyHistory">

            <span>◷</span>

            <b>No hay servicios para mostrar</b>

            <p>Las solicitudes que coincidan con tus filtros aparecerán aquí.</p>

          </div>

        </td>

      </tr>

    `;

    return;

  }

 

  cuerpo.innerHTML = servicios.map(item => {

    const vehiculo = item.vehiculo || {};

    const servicio = item.servicio || item.tipoServicio || "Servicio";

    const estado = normalizarEstado(item.estado || "solicitado");

    const nombreVehiculo = [

      vehiculo.marca || item.marca,

      vehiculo.subMarca || item.subMarca

    ].filter(Boolean).join(" ") || "Vehículo no registrado";

    const placas = vehiculo.placas || item.placas || "Sin placas";

 

    return `

      <tr>

        <td><b>${escaparHtml(item.folio || item.id.slice(0, 8).toUpperCase())}</b></td>

        <td>${escaparHtml(servicio)}</td>

        <td>${escaparHtml(nombreVehiculo)}<br><small>${escaparHtml(placas)}</small></td>

        <td>${escaparHtml(formatearFechaServicio(item))}</td>

        <td><span class="status ${obtenerClaseEstado(estado)}">${escaparHtml(obtenerEtiquetaEstado(estado))}</span></td>

        <td><button type="button" class="detailButton" onclick="verDetalle('${escaparAtributo(item.folio || item.id)}')">Ver detalle</button></td>

      </tr>

    `;

  }).join("");

}

 

function formatearFechaServicio(item) {

  const valor = item.creadoEn || item.fechaCreacion || item.fecha || "";

  let fecha;

 

  if (valor && typeof valor.toDate === "function") {

    fecha = valor.toDate();

  } else {

    fecha = new Date(valor);

  }

 

  if (!fecha || Number.isNaN(fecha.getTime())) return "Sin fecha";

 

  return fecha.toLocaleDateString("es-MX", {

    day: "2-digit",

    month: "short",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit"

  });

}

 

function obtenerEtiquetaEstado(estado) {

  const etiquetas = {

    solicitado: "Solicitado",

    asignado: "Asignado",

    aceptado: "Aceptado",

    en_camino: "En camino",

    arribo: "En sitio",

    en_proceso: "En proceso",

    finalizado: "Finalizado",

    terminado: "Finalizado",

    completado: "Finalizado",

    cancelado: "Cancelado",

    cancelada: "Cancelado"

  };

 

  return etiquetas[estado] || estado.replace(/_/g, " ");

}

 

function obtenerClaseEstado(estado) {

  if (["finalizado", "terminado", "completado"].includes(estado)) {

    return "finished";

  }

 

  if (["cancelado", "cancelada"].includes(estado)) {

    return "cancelled";

  }

 

  return "process";

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

  return String(valor ?? "")

    .replaceAll("\", "\\")

    .replaceAll("'", "\'")

    .replaceAll("

", " ")

    .replaceAll("

", " ");

}

 

/* =========================================

 

   UBICACIÓN

 

========================================= */

 

 

 

function obtenerUbicacion() {

 

  return new Promise(resolve => {

 

    if (!navigator.geolocation) {

 

      resolve(

 

        "El cliente la compartirá por WhatsApp"

 

      );

 

      return;

 

    }

 

 

 

    navigator.geolocation.getCurrentPosition(

 

      posicion => {

 

        const latitud =

 

          posicion.coords.latitude;

 

 

 

        const longitud =

 

          posicion.coords.longitude;

 

 

 

        resolve(

 

          `https://maps.google.com/?q=${latitud},${longitud}`

 

        );

 

      },

 

 

 

      () => {

 

        resolve(

 

          "El cliente la compartirá por WhatsApp"

 

        );

 

      },

 

 

 

      {

 

        enableHighAccuracy: true,

 

        timeout: 8000,

 

        maximumAge: 60000

 

      }

 

    );

 

  });

 

}

 

 

 

/* =========================================

 

   ALERTAS DE EMERGENCIA

 

========================================= */

 

 

 

async function activarAlerta(tipo) {

 

  if (!perfilActual.puedeUsarAlertas) {

 

    mostrarModal(

 

      "🔒",

 

      "Función exclusiva para miembros",

 

      "Las alertas de robo y montachoques están disponibles únicamente para miembros AS CLICK activos."

 

    );

 

    return;

 

  }

 

 

 

  const confirmar = confirm(

 

    `¿Confirmas que deseas activar la alerta de ${tipo}? Esta función debe utilizarse únicamente en una emergencia real.`

 

  );

 

 

 

  if (!confirmar) return;

 

 

 

  const ubicacion =

 

    await obtenerUbicacion();

 

 

 

  const mensaje = [

 

    `*🚨 ALERTA AS CLICK - ${tipo.toUpperCase()}*`,

 

    "",

 

    "*MIEMBRO ACTIVO*",

 

    `Membresía: ${perfilActual.numeroMiembro || "No registrada"}`,

 

    `Nombre: ${perfilActual.nombre || "No registrado"}`,

 

    `Teléfono: ${perfilActual.telefono || "No registrado"}`,

 

    "",

 

    "*VEHÍCULO*",

 

    `Marca: ${perfilActual.marca || "No registrada"}`,

 

    `Submarca: ${perfilActual.subMarca || "No registrada"}`,

 

    `Color: ${perfilActual.color || "No registrado"}`,

 

    `Placas: ${perfilActual.placas || "No registradas"}`,

 

    `Serie: ${perfilActual.serie || "No registrada"}`,

 

    "",

 

    `Ubicación actual: ${ubicacion}`,

 

    "",

 

    "⚠ Esta alerta fue enviada desde el botón de emergencia de AS CLICK."

 

  ].join("\n");

 

 

 

  const url =

 

    `https://wa.me/${TELEFONO_EMERGENCIAS}` +

 

    `?text=${encodeURIComponent(mensaje)}`;

 

 

 

  window.open(

 

    url,

 

    "_blank",

 

    "noopener,noreferrer"

 

  );

 

}

 

 

 

/* =========================================

 

   WHATSAPP ASESOR

 

========================================= */

 

 

 

function hablarAsesor() {

 

  const mensaje = [

 

    "Hola, necesito hablar con un asesor de AS CLICK.",

 

    "",

 

    `Nombre: ${perfilActual.nombre || ""}`,

 

    `Teléfono: ${perfilActual.telefono || ""}`,

 

    `Membresía: ${

 

      perfilActual.tieneMembresia

 

        ? (

 

            perfilActual.numeroMiembro ||

 

            "Pendiente"

 

          )

 

        : "Sin membresía"

 

    }`

 

  ].join("\n");

 

 

 

  const url =

 

    `https://wa.me/${TELEFONO_ASESOR}` +

 

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

 

    "Vehículo principal",

 

    "Por ahora los datos del vehículo se registran al crear la cuenta. Para cambiar un vehículo, comunícate con un asesor de AS CLICK."

 

  );

 

}

 

 

 

function mostrarTerminos() {

 

  mostrarModal(

 

    "⚠",

 

    "Términos de las alertas",

 

    "Las alertas de robo y montachoques son exclusivas para miembros activos. Deben utilizarse únicamente en situaciones reales. El uso falso o irresponsable puede ocasionar sanciones o cancelación de la membresía."

 

  );

 

}

 

 

 

function abrirNotificaciones() {

 

  mostrarModal(

 

    "🔔",

 

    "Notificaciones",

 

    "Aquí aparecerán las notificaciones relacionadas con tus solicitudes y servicios."

 

  );

 

}

 

 

 

function abrirMenuUsuario() {

 

  cambiarSeccion("perfil");

 

}

 

 

 

/* =========================================

 

   CERRAR SESIÓN

 

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

 

 

 

  modalOverlay?.classList.add("active");

 

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

 

window.filtrarHistorial =

 

  filtrarHistorial;
