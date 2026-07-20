/*
 Cambia estos dos números por los reales.
  Formato:
 52 + lada + número
  Sin espacios, guiones ni signo +
 */
const TELEFONO_CABINA = "525519750497";
const TELEFONO_EMERGENCIAS = "525585373051";
const TELEFONO_ASESOR = "525519750497";
 /* =========================================
  VARIABLES
========================================= */
let seccionActual = "inicio";
let usuarioActual = null;
let historialServicios = [];
let vehiculosUsuario = [];
let notificacionesActuales = [];
let cancelarEscuchaNotificaciones = null;
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
let auth = null;
let db = null;
let firebaseSignOut = null;
let firestoreDoc = null;
let firestoreGetDoc = null;
let firestoreSetDoc = null;
let firestoreCollection = null;
let firestoreQuery = null;
let firestoreWhere = null;
let firestoreGetDocs = null;
let firestoreAddDoc = null;
let firestoreServerTimestamp = null;
let firestoreOnSnapshot = null;
let firestoreUpdateDoc = null;
let firestoreDeleteDoc = null;
async function iniciarFirebase() {
  try {
    const firebaseConfigModule = await import("./firebase-config.js");
    const authModule = await import(
      "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js"
    );
    const firestoreModule = await import(
      "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js"
    );
    auth = firebaseConfigModule.auth;
    db = firebaseConfigModule.db;
    firebaseSignOut = authModule.signOut;
    firestoreDoc = firestoreModule.doc;
    firestoreGetDoc = firestoreModule.getDoc;
    firestoreSetDoc = firestoreModule.setDoc;
    firestoreCollection = firestoreModule.collection;
    firestoreQuery = firestoreModule.query;
    firestoreWhere = firestoreModule.where;
    firestoreGetDocs = firestoreModule.getDocs;
    firestoreAddDoc = firestoreModule.addDoc;
    firestoreServerTimestamp = firestoreModule.serverTimestamp;
    firestoreOnSnapshot = firestoreModule.onSnapshot;
    firestoreUpdateDoc = firestoreModule.updateDoc;
    firestoreDeleteDoc = firestoreModule.deleteDoc;
    authModule.onAuthStateChanged(auth, async user => {
      if (!user) {
        window.location.replace("./login.html");
        return;
      }
      usuarioActual = user;
      try {
        await cargarDatosUsuario(user);
        await cargarHistorialServicios();
        await cargarVehiculos();
        iniciarEscuchaNotificaciones(user.uid);
      } catch (error) {
        console.error("Error al cargar los datos del usuario:", error);
        cargarDatosBasicos(user);
        mostrarModal(
          "⚠",
          "No fue posible cargar tu perfil",
          "Tu sesión está activa, pero no pudimos cargar todos tus datos. Revisa tu conexión e inténtalo nuevamente."
        );
      }
    });
  } catch (error) {
    console.error("No fue posible iniciar Firebase:", error);
    mostrarModal(
      "⚠",
      "Problema de conexión",
      "La interfaz está disponible, pero Firebase no pudo iniciar. Revisa la conexión o la configuración."
    );
  }
}
/* =========================================
   CARGAR PERFIL DESDE FIRESTORE
========================================= */
async function cargarDatosUsuario(user) {
  const referenciaUsuario = firestoreDoc(db, "usuarios", user.uid);
  const documentoUsuario = await firestoreGetDoc(referenciaUsuario);
  const datosUsuario = documentoUsuario.exists()
    ? documentoUsuario.data()
    : {};
  const membresia = await buscarMembresiaVinculada(user, datosUsuario);
  const datosCombinados = combinarUsuarioYMembresia(
    user,
    datosUsuario,
    membresia
  );
  perfilActual = construirPerfilDashboard(user, datosCombinados);
  // Mantiene usuarios/{uid} como fuente principal del Dashboard.
  // Esto también convierte automáticamente a miembro a un cliente que
  // adquirió una membresía después de haber creado su cuenta.
  await firestoreSetDoc(
    referenciaUsuario,
    {
      ...datosCombinados,
      uid: user.uid,
      correo: datosCombinados.correo || user.email || "",
      nombre:
        datosCombinados.nombre ||
        user.displayName ||
        obtenerNombreCorreo(user.email) ||
        "Usuario",
      actualizadoEn: firestoreServerTimestamp()
    },
    { merge: true }
  );
  actualizarDatosPantalla(perfilActual);
}
async function buscarMembresiaVinculada(user, datosUsuario) {
  const numero =
    datosUsuario.numeroMiembro ||
    datosUsuario.numeroMembresia ||
    datosUsuario.numeroSocio ||
    "";
  if (numero) {
    const directa = await firestoreGetDoc(
      firestoreDoc(db, "membresias", numero)
    );
    if (directa.exists()) {
      return {
        id: directa.id,
        ...directa.data()
      };
    }
  }
  const criterios = [
    ["uidUsuario", user.uid],
    ["correo", String(user.email || "").trim().toLowerCase()]
  ];
  for (const [campo, valor] of criterios) {
    if (!valor) continue;
    const consulta = firestoreQuery(
      firestoreCollection(db, "membresias"),
      firestoreWhere(campo, "==", valor)
    );
    const resultado = await firestoreGetDocs(consulta);
    if (!resultado.empty) {
      const documento = resultado.docs[0];
      return {
        id: documento.id,
        ...documento.data()
      };
    }
  }
  return null;
}
function combinarUsuarioYMembresia(user, usuario = {}, membresia = null) {
  const datosMembresia = membresia || {};
  const numeroMiembro =
    usuario.numeroMiembro ||
    usuario.numeroMembresia ||
    usuario.numeroSocio ||
    datosMembresia.numeroMembresia ||
    datosMembresia.numeroMiembro ||
    datosMembresia.id ||
    "";
  const estadoMembresia = normalizarEstado(
    datosMembresia.estadoMembresia ||
    usuario.estadoMembresia ||
    datosMembresia.estado ||
    usuario.estado ||
    (numeroMiembro ? "activa" : "sin_membresia")
  );
  const tieneMembresia = Boolean(numeroMiembro) &&
    !["cancelada", "vencida", "sin_membresia"].includes(estadoMembresia);
  const vehiculoUsuario = usuario.vehiculoPrincipal || {};
  return {
    ...usuario,
    nombre:
      usuario.nombre ||
      datosMembresia.nombreRegistro ||
      user.displayName ||
      obtenerNombreCorreo(user.email) ||
      "Usuario",
    telefono:
      usuario.telefono ||
      datosMembresia.telefonoRegistro ||
      "",
    correo:
      usuario.correo ||
      datosMembresia.correo ||
      user.email ||
      "",
    tipoCliente:

      usuario.tipoCliente ||
      datosMembresia.tipoCliente ||
      "particular",
    tieneMembresia,
    numeroMiembro: tieneMembresia ? numeroMiembro : "",
    estadoMembresia: tieneMembresia ? estadoMembresia : "sin_membresia",
    tipoMembresia:
      datosMembresia.tipoMembresia ||
      datosMembresia.plan ||
      usuario.tipoMembresia ||
      (tieneMembresia ? usuario.tipoCliente || "particular" : ""),
    vigencia:
      datosMembresia.vigencia ||
      datosMembresia.finVigencia ||
      usuario.vigencia ||
      usuario.finVigencia ||
      "",
    tarifa: tieneMembresia ? "preferencial" : "publico_general",
    puedeUsarAlertas: tieneMembresia,
    marca:
      usuario.marca ||
      vehiculoUsuario.marca ||
      datosMembresia.marcaRegistro ||
      "",
    subMarca:
      usuario.subMarca ||
      usuario.submarca ||
      vehiculoUsuario.subMarca ||
      vehiculoUsuario.submarca ||
      datosMembresia.subMarcaRegistro ||
      "",
    color:
      usuario.color ||
      vehiculoUsuario.color ||
      datosMembresia.colorRegistro ||
      "",
    placas:
      usuario.placas ||
      vehiculoUsuario.placas ||
      datosMembresia.placasRegistro ||
      "",
    serie:
      usuario.serie ||
      vehiculoUsuario.serie ||
      datosMembresia.serieRegistro ||
      "",
    vehiculoPrincipal: {
      marca:
        usuario.marca ||
        vehiculoUsuario.marca ||
        datosMembresia.marcaRegistro ||
        "",
      subMarca:
        usuario.subMarca ||
        usuario.submarca ||
        vehiculoUsuario.subMarca ||
        vehiculoUsuario.submarca ||
        datosMembresia.subMarcaRegistro ||
        "",
      color:
        usuario.color ||
        vehiculoUsuario.color ||
        datosMembresia.colorRegistro ||
        "",
      placas:
        usuario.placas ||
        vehiculoUsuario.placas ||
        datosMembresia.placasRegistro ||
        "",
      serie:
        usuario.serie ||
        vehiculoUsuario.serie ||
        datosMembresia.serieRegistro ||
        ""
    }
  };
}
function construirPerfilDashboard(user, datos) {
  const vehiculo = datos.vehiculoPrincipal || {};
  return {
    nombre:
      datos.nombre ||
      user.displayName ||
      obtenerNombreCorreo(user.email) ||
      "Usuario",
    telefono: datos.telefono || "",
    correo: datos.correo || user.email || "",
    tipoCliente: datos.tipoCliente || "particular",
    tieneMembresia: datos.tieneMembresia === true,
    numeroMiembro:
      datos.numeroMiembro ||
      datos.numeroSocio ||
      datos.numeroMembresia ||
      "",
    estadoMembresia: normalizarEstado(
      datos.estadoMembresia ||
      (datos.tieneMembresia ? "activa" : "sin_membresia")
    ),
    tipoMembresia: datos.tipoMembresia || datos.plan || "",
    vigencia: formatearVigencia(
      datos.vigencia || datos.finVigencia || ""
    ),
    tarifa:
      datos.tarifa ||
      (datos.tieneMembresia ? "preferencial" : "publico_general"),
    puedeUsarAlertas:
      datos.tieneMembresia === true &&
      normalizarEstado(datos.estadoMembresia || "activa") === "activa",
    marca: datos.marca || vehiculo.marca || "",
    subMarca:
      datos.subMarca ||
      datos.submarca ||
      vehiculo.subMarca ||
      vehiculo.submarca ||
      "",
    color: datos.color || vehiculo.color || "",
    placas: datos.placas || vehiculo.placas || "",
    serie: datos.serie || vehiculo.serie || ""
  };
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
  const valor = String(estado || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const equivalencias = {
    activo: "activa",
    active: "activa",
    asignada: "activa",
    asignado: "activa",
    disponible: "activa",
    vigente: "activa",
    cancelado: "cancelada",
    vencido: "vencida"
  };
  return equivalencias[valor] || valor;
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
  actualizarPerfilPantalla(perfil);
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
  if (seccion === "historial" || seccion === "servicios") {
    cargarHistorialServicios();
  }
  if (seccion === "vehiculos") {
    cargarVehiculos();
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
async function solicitarServicio(servicio, detalleServicio = "") {
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
  const ubicacion = await obtenerUbicacion();
  const folio = await guardarSolicitudServicio(
    servicio,
    tipoTarifa,
    ubicacion,
    detalleServicio
  );
  const mensaje = construirMensajeServicio(

    servicio,
    tipoTarifa,
    ubicacion,
    detalleServicio,
    folio
  );
  const url =
    `https://wa.me/${TELEFONO_CABINA}` +
    `?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
function abrirAuxilioVial() {
  crearInterfazAuxilioVial();
  const overlay = document.getElementById("auxilioVialOverlay");
  if (!overlay) return;
  document.querySelectorAll('input[name="tipoAuxilioVial"]').forEach(input => {
    input.checked = false;
  });
  const aviso = document.getElementById("avisoGasolina");
  const aceptar = document.getElementById("aceptarCostoGasolina");
  const confirmar = document.getElementById("confirmarAuxilioVial");
  if (aviso) aviso.hidden = true;
  if (aceptar) aceptar.checked = false;
  if (confirmar) confirmar.disabled = true;
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}
function seleccionarTipoAuxilioVial() {
  const seleccionado = document.querySelector(
    'input[name="tipoAuxilioVial"]:checked'
  );
  const aviso = document.getElementById("avisoGasolina");
  const aceptar = document.getElementById("aceptarCostoGasolina");
  const confirmar = document.getElementById("confirmarAuxilioVial");
  const esGasolina = seleccionado?.value === "Surtir gasolina";
  if (aviso) aviso.hidden = !esGasolina;
  if (aceptar && !esGasolina) aceptar.checked = false;
  if (confirmar) {
    confirmar.disabled = !seleccionado || (esGasolina && !aceptar?.checked);
  }
}
async function confirmarAuxilioVial() {
  const seleccionado = document.querySelector(
    'input[name="tipoAuxilioVial"]:checked'
  );
  if (!seleccionado) return;
  if (
    seleccionado.value === "Surtir gasolina" &&
    !document.getElementById("aceptarCostoGasolina")?.checked
  ) {
    return;
  }
  cerrarAuxilioVial();
  await solicitarServicio("Auxilio vial", seleccionado.value);
}
function cerrarAuxilioVial(event = null) {
  if (event && event.target.id !== "auxilioVialOverlay") return;
  document
    .getElementById("auxilioVialOverlay")
    ?.classList.remove("active");
  document.body.style.overflow = "";
}
function crearInterfazAuxilioVial() {
  if (document.getElementById("auxilioVialOverlay")) return;
  agregarEstilosFuncionesNuevas();
  const overlay = document.createElement("div");
  overlay.id = "auxilioVialOverlay";
  overlay.className = "asClickCustomOverlay";
  overlay.addEventListener("click", cerrarAuxilioVial);
  overlay.innerHTML = `
    <section class="asClickCustomModal" role="dialog" aria-modal="true" aria-labelledby="auxilioVialTitulo">
      <button type="button" class="asClickCustomClose" onclick="cerrarAuxilioVial()" aria-label="Cerrar">✕</button>
      <div class="asClickCustomIcon">🔧</div>
      <h2 id="auxilioVialTitulo">Auxilio Vial</h2>
      <p class="asClickCustomIntro">Selecciona el tipo de auxilio que necesitas.</p>
      <div class="asClickOptionList">
        <label class="asClickOption">
          <input type="radio" name="tipoAuxilioVial" value="Paso de corriente" onchange="seleccionarTipoAuxilioVial()">
          <span>🔋</span><b>Paso de corriente</b>
        </label>
        <label class="asClickOption">
          <input type="radio" name="tipoAuxilioVial" value="Cambio de llanta" onchange="seleccionarTipoAuxilioVial()">
          <span>🛞</span><b>Cambio de llanta</b>
        </label>
        <label class="asClickOption">
          <input type="radio" name="tipoAuxilioVial" value="Surtir gasolina" onchange="seleccionarTipoAuxilioVial()">
          <span>⛽</span><b>Surtir gasolina</b>
        </label>
      </div>
      <div id="avisoGasolina" class="asClickFuelNotice" hidden>
        <b>⚠ Aviso importante</b>
        <p>El costo del combustible corre por cuenta del cliente. AS CLICK únicamente proporciona el servicio para llevar el combustible hasta tu ubicación.</p>
        <label>
          <input id="aceptarCostoGasolina" type="checkbox" onchange="seleccionarTipoAuxilioVial()">
          He leído y acepto que el costo del combustible será cubierto por mí.
        </label>
      </div>
      <div class="asClickCustomActions">
        <button type="button" class="asClickSecondaryButton" onclick="cerrarAuxilioVial()">Cancelar</button>
        <button type="button" id="confirmarAuxilioVial" class="asClickPrimaryButton" onclick="confirmarAuxilioVial()" disabled>Solicitar servicio</button>
      </div>
    </section>
  `;
  document.body.appendChild(overlay);
}
function construirMensajeServicio(
  servicio,
  tipoTarifa,
  ubicacion,
  detalleServicio = "",
  folio = ""
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
    `Folio: ${folio || "Pendiente"}`,
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
    ...(detalleServicio ? [`Tipo de auxilio: ${detalleServicio}`] : []),
    `Ubicación: ${ubicacion}`,
    "",
    "Comentarios:"
  ].join("\n");
}
/* =========================================
   HISTORIAL DE SERVICIOS
========================================= */
async function guardarSolicitudServicio(servicio, tipoTarifa, ubicacion, detalleServicio = "") {
  if (!usuarioActual) return "";
  const folio = generarFolioServicio();
  try {
    await firestoreAddDoc(firestoreCollection(db, "servicios"), {
      usuarioId: usuarioActual.uid,
      uid: usuarioActual.uid,
      folio,
      servicio,
      tipoAuxilio: detalleServicio || "",
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
      creadoEn: firestoreServerTimestamp(),
      fechaCreacion: new Date().toISOString()
    });
    await cargarHistorialServicios();
    return folio;
  } catch (error) {
    console.error("No fue posible guardar la solicitud:", error);
    return "";
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
    const consulta = firestoreQuery(
      firestoreCollection(db, "servicios"),
      firestoreWhere("usuarioId", "==", usuarioActual.uid)
    );
    const resultado = await firestoreGetDocs(consulta);
    historialServicios = resultado.docs
      .map(documento => ({
        id: documento.id,
        ...documento.data()
      }))
      .sort((a, b) => obtenerMilisegundos(b) - obtenerMilisegundos(a));
    actualizarResumenHistorial();
    renderizarHistorial(historialServicios);
    renderizarMisServicios(historialServicios);
    renderizarServiciosRecientes(historialServicios);
  } catch (error) {
    console.error("Error al cargar el historial:", error);
    renderizarHistorial([]);
    renderizarMisServicios([]);
    renderizarServiciosRecientes([]);
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
        <td>
          <button type="button" class="detailButton" onclick="verDetalle('${escaparAtributo(item.folio || item.id)}')">Ver detalle</button>
          ${esEstadoServicioActivo(estado) ? `<button type="button" class="detailButton" style="margin-left:6px;color:#c62828;border-color:#c62828" onclick="cancelarServicioWhatsApp('${escaparAtributo(item.folio || item.id)}')">Cancelar servicio</button>` : ""}
        </td>
      </tr>
    `;
  }).join("");
}
function normalizarEstadoServicio(estado) {
  return String(estado || "solicitado")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}
function renderizarMisServicios(servicios) {
  const cuerpo = document.getElementById("misServiciosBody");
  if (!cuerpo) return;
  const estadosActivos = [
    "solicitado",
    "asignado",
    "aceptado",
    "en_camino",
    "arribo",
    "en_sitio",
    "en_proceso",
    "corralon"
  ];
  const activos = servicios.filter(item =>
    estadosActivos.includes(normalizarEstadoServicio(item.estado))
  );
  if (!activos.length) {
    cuerpo.innerHTML = `
      <tr class="emptyHistoryRow">
        <td colspan="6">
          <div class="emptyHistory">
            <span>⚒</span>
            <b>No tienes servicios activos</b>
            <p>Los servicios solicitados o en proceso aparecerán aquí.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  cuerpo.innerHTML = activos.map(item => {
    const vehiculo = item.vehiculo || {};
    const servicio = item.servicio || item.tipoServicio || "Servicio";
    const estado = normalizarEstadoServicio(item.estado);
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
        <td>
          <button type="button" class="detailButton" onclick="verDetalle('${escaparAtributo(item.folio || item.id)}')">Ver detalle</button>
          ${esEstadoServicioActivo(estado) ? `<button type="button" class="detailButton" style="margin-left:6px;color:#c62828;border-color:#c62828" onclick="cancelarServicioWhatsApp('${escaparAtributo(item.folio || item.id)}')">Cancelar servicio</button>` : ""}
        </td>
      </tr>
    `;
  }).join("");
}
function renderizarServiciosRecientes(servicios) {
  const cuerpo = document.getElementById("recentServicesBody");
  if (!cuerpo) return;
  const recientes = servicios.slice(0, 5);
  if (!recientes.length) {
    cuerpo.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;">No hay servicios recientes.</td>
      </tr>
    `;
    return;
  }
  cuerpo.innerHTML = recientes.map(item => {
    const servicio = item.servicio || item.tipoServicio || "Servicio";
    const estado = normalizarEstadoServicio(item.estado);
    return `
      <tr>
        <td><b>${escaparHtml(item.folio || item.id.slice(0, 8).toUpperCase())}</b></td>
        <td>${escaparHtml(servicio)}</td>
        <td>${escaparHtml(formatearFechaServicio(item))}</td>
        <td><span class="status ${obtenerClaseEstado(estado)}">${escaparHtml(obtenerEtiquetaEstado(estado))}</span></td>
        <td>
          <button type="button" class="detailButton" onclick="verDetalle('${escaparAtributo(item.folio || item.id)}')">Ver detalle</button>
          ${esEstadoServicioActivo(estado) ? `<button type="button" class="detailButton" style="margin-left:6px;color:#c62828;border-color:#c62828" onclick="cancelarServicioWhatsApp('${escaparAtributo(item.folio || item.id)}')">Cancelar servicio</button>` : ""}
        </td>
      </tr>
    `;
  }).join("");
}
function esEstadoServicioActivo(estado) {
  return [
    "solicitado",
    "asignado",
    "aceptado",
    "en_camino",
    "arribo",
    "en_sitio",
    "en_proceso",
    "corralon"
  ].includes(normalizarEstadoServicio(estado));
}
function cancelarServicioWhatsApp(folioOId) {
  const servicioEncontrado = historialServicios.find(item =>
    String(item.folio || item.id) === String(folioOId)
  );
  if (!servicioEncontrado) {
    mostrarModal(
      "⚠",
      "Servicio no encontrado",
      "No fue posible localizar los datos del servicio. Actualiza la página e inténtalo nuevamente."
    );
    return;
  }
  const estado = normalizarEstadoServicio(servicioEncontrado.estado);
  if (!esEstadoServicioActivo(estado)) {
    mostrarModal(
      "⚠",
      "El servicio ya no puede cancelarse",
      "Este servicio ya está finalizado o cancelado."
    );
    return;
  }
  const confirmarCancelacion = confirm(
    "¿Deseas solicitar la cancelación de este servicio?\n\nIMPORTANTE: Después de 15 minutos de haber solicitado el servicio se cobrará el 50% del costo."
  );
  if (!confirmarCancelacion) return;
  const vehiculo = servicioEncontrado.vehiculo || {};
  const cliente = servicioEncontrado.cliente || {};
  const mensaje = [
    "*SOLICITUD DE CANCELACIÓN AS CLICK*",
    "",
    "⚠ Después de 15 minutos de haber solicitado el servicio se cobrará el 50% del costo.",
    "",
    "*DATOS DEL SERVICIO*",
    `Folio: ${servicioEncontrado.folio || servicioEncontrado.id}`,
    `Servicio: ${servicioEncontrado.servicio || servicioEncontrado.tipoServicio || "Servicio"}`,
    `Tipo de auxilio: ${servicioEncontrado.tipoAuxilio || "No aplica"}`,
    `Estado actual: ${obtenerEtiquetaEstado(estado)}`,
    `Fecha de solicitud: ${formatearFechaServicio(servicioEncontrado)}`,
    "",
    "*DATOS DEL CLIENTE*",
    `Nombre: ${cliente.nombre || perfilActual.nombre || "No registrado"}`,
    `Teléfono: ${cliente.telefono || perfilActual.telefono || "No registrado"}`,
    `Correo: ${cliente.correo || perfilActual.correo || "No registrado"}`,
    `Membresía: ${perfilActual.tieneMembresia ? (perfilActual.numeroMiembro || "Pendiente") : "Sin membresía"}`,
    "",
    "*DATOS DEL VEHÍCULO*",
    `Marca: ${vehiculo.marca || servicioEncontrado.marca || perfilActual.marca || "No registrada"}`,
    `Submarca: ${vehiculo.subMarca || vehiculo.submarca || servicioEncontrado.subMarca || servicioEncontrado.submarca || perfilActual.subMarca || "No registrada"}`,
    `Color: ${vehiculo.color || servicioEncontrado.color || perfilActual.color || "No registrado"}`,
    `Placas: ${vehiculo.placas || servicioEncontrado.placas || perfilActual.placas || "No registradas"}`,
    `Serie / VIN: ${vehiculo.serie || servicioEncontrado.serie || perfilActual.serie || "No registrada"}`,
    "",
    "Solicito la cancelación de este servicio."
  ].join("\n");
  const url =
    `https://wa.me/${TELEFONO_CABINA}` +
    `?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank", "noopener,noreferrer");
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
    en_sitio: "En sitio",
    en_proceso: "En proceso",
    corralon: "Corralón",
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
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ");
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
  const overlay = document.getElementById("vehicleModalOverlay");
  const formulario = document.getElementById("vehicleForm");
  const error = document.getElementById("vehicleFormError");
  formulario?.reset();
  if (error) error.textContent = "";
  const principal = document.getElementById("nuevoVehiculoPrincipal");
  if (principal) principal.checked = vehiculosUsuario.length === 0;
  overlay?.classList.add("active");
  overlay?.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function cerrarModalVehiculo(event = null) {
  if (event && event.target.id !== "vehicleModalOverlay") return;
  const overlay = document.getElementById("vehicleModalOverlay");
  overlay?.classList.remove("active");
  overlay?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
async function cargarVehiculos() {
  const lista = document.getElementById("vehiclesList");
  if (!lista || !usuarioActual || !db || !firestoreGetDocs) return;
  lista.innerHTML = `
    <div class="vehiclesEmptyState">
      <span>🚙</span>
      <b>Cargando vehículos...</b>
    </div>
  `;
  try {
    const referenciaVehiculos = firestoreCollection(
      db,
      "usuarios",
      usuarioActual.uid,
      "vehiculos"
    );
    let resultado = await firestoreGetDocs(referenciaVehiculos);
    if (resultado.empty && (perfilActual.marca || perfilActual.placas || perfilActual.serie)) {
      const referenciaInicial = firestoreDoc(
        db,
        "usuarios",
        usuarioActual.uid,
        "vehiculos",
        "vehiculo-principal"
      );
      await firestoreSetDoc(referenciaInicial, {
        marca: perfilActual.marca || "",
        subMarca: perfilActual.subMarca || "",
        color: perfilActual.color || "",
        placas: String(perfilActual.placas || "").toUpperCase(),
        serie: String(perfilActual.serie || "").toUpperCase(),
        principal: true,
        creadoEn: firestoreServerTimestamp()
      }, { merge: true });
      resultado = await firestoreGetDocs(referenciaVehiculos);
    }
    vehiculosUsuario = resultado.docs.map(documento => ({
      id: documento.id,
      ...documento.data()
    }));
    if (vehiculosUsuario.length && !vehiculosUsuario.some(item => item.principal === true)) {
      await establecerVehiculoPrincipal(vehiculosUsuario[0].id, false);
      return;
    }
    vehiculosUsuario.sort((a, b) => Number(b.principal === true) - Number(a.principal === true));
    renderizarVehiculos();
  } catch (error) {
    console.error("Error al cargar los vehículos:", error);
    vehiculosUsuario = [];
    lista.innerHTML = `
      <div class="vehiclesEmptyState">

        <span>⚠</span>
        <b>No fue posible cargar los vehículos</b>
        <p>Revisa tu conexión e inténtalo nuevamente.</p>
      </div>
    `;
  }
}
function renderizarVehiculos() {
  const lista = document.getElementById("vehiclesList");
  if (!lista) return;
  if (!vehiculosUsuario.length) {
    lista.innerHTML = `
      <div class="vehiclesEmptyState">
        <span>🚙</span>
        <b>No tienes vehículos registrados</b>
        <p>Presiona “Agregar vehículo” para registrar el primero.</p>
      </div>
    `;
    return;
  }
  lista.innerHTML = vehiculosUsuario.map(vehiculo => {
    const nombre = [vehiculo.marca, vehiculo.subMarca].filter(Boolean).join(" ") || "Vehículo";
    return `
      <article class="savedVehicleCard ${vehiculo.principal ? "principal" : ""}">
        <div class="savedVehicleIcon">🚙</div>
        <div class="savedVehicleData">
          <h3>${escaparHtml(nombre)}</h3>
          <p>Placas: ${escaparHtml(vehiculo.placas || "Sin registrar")}</p>
          <p>Color: ${escaparHtml(vehiculo.color || "Sin registrar")}</p>
          <small>Serie: ${escaparHtml(vehiculo.serie || "Sin registrar")}</small>
        </div>
        <div class="savedVehicleActions">
          ${vehiculo.principal
            ? '<span class="principalVehicleBadge">Vehículo principal</span>'
            : `<button type="button" onclick="establecerVehiculoPrincipal('${escaparAtributo(vehiculo.id)}')">Usar como principal</button>`}
          <button type="button" class="deleteVehicleButton" onclick="eliminarVehiculo('${escaparAtributo(vehiculo.id)}')">Eliminar</button>
        </div>
      </article>
    `;
  }).join("");
}
async function guardarNuevoVehiculo(event) {
  event?.preventDefault();
  if (!usuarioActual || !db || !firestoreAddDoc) return;
  const boton = document.getElementById("guardarVehiculoButton");
  const error = document.getElementById("vehicleFormError");
  const marca = document.getElementById("nuevoVehiculoMarca")?.value.trim() || "";
  const subMarca = document.getElementById("nuevoVehiculoSubMarca")?.value.trim() || "";
  const color = document.getElementById("nuevoVehiculoColor")?.value.trim() || "";
  const placas = document.getElementById("nuevoVehiculoPlacas")?.value.trim().toUpperCase() || "";
  const serie = document.getElementById("nuevoVehiculoSerie")?.value.trim().toUpperCase() || "";
  const principalSolicitado = document.getElementById("nuevoVehiculoPrincipal")?.checked === true;
  if (!marca || !subMarca || !color || !placas || !serie) {
    if (error) error.textContent = "Completa todos los datos del vehículo.";
    return;
  }
  if (vehiculosUsuario.some(item => String(item.placas || "").toUpperCase() === placas)) {
    if (error) error.textContent = "Ya tienes un vehículo registrado con esas placas.";
    return;
  }
  if (boton) {
    boton.disabled = true;
    boton.textContent = "Guardando...";
  }
  if (error) error.textContent = "";
  try {
    const debeSerPrincipal = principalSolicitado || vehiculosUsuario.length === 0;
    if (debeSerPrincipal) {
      await Promise.all(vehiculosUsuario.map(item =>
        firestoreUpdateDoc(
          firestoreDoc(db, "usuarios", usuarioActual.uid, "vehiculos", item.id),
          { principal: false }
        )
      ));
    }
    const referencia = await firestoreAddDoc(
      firestoreCollection(db, "usuarios", usuarioActual.uid, "vehiculos"),
      {
        marca,
        subMarca,
        color,
        placas,
        serie,
        principal: debeSerPrincipal,
        creadoEn: firestoreServerTimestamp()
      }
    );
    if (debeSerPrincipal) {
      await actualizarVehiculoPrincipalUsuario({
        id: referencia.id,
        marca,
        subMarca,
        color,
        placas,
        serie,
        principal: true
      });
    }
    cerrarModalVehiculo();
    await cargarVehiculos();
  } catch (errorGuardar) {
    console.error("Error al guardar el vehículo:", errorGuardar);
    if (error) error.textContent = "No fue posible guardar el vehículo.";
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = "Guardar vehículo";
    }
  }
}
async function establecerVehiculoPrincipal(idVehiculo, recargar = true) {
  if (!usuarioActual || !idVehiculo) return;
  try {
    await Promise.all(vehiculosUsuario.map(item =>
      firestoreUpdateDoc(
        firestoreDoc(db, "usuarios", usuarioActual.uid, "vehiculos", item.id),
        { principal: item.id === idVehiculo }
      )
    ));
    const seleccionado = vehiculosUsuario.find(item => item.id === idVehiculo);
    if (seleccionado) {
      await actualizarVehiculoPrincipalUsuario({ ...seleccionado, principal: true });
    }
    if (recargar) await cargarVehiculos();
  } catch (error) {
    console.error("Error al cambiar el vehículo principal:", error);
    mostrarModal("⚠", "No fue posible actualizar", "Inténtalo nuevamente en unos momentos.");
  }
}
async function actualizarVehiculoPrincipalUsuario(vehiculo) {
  if (!usuarioActual || !vehiculo) return;
  const datos = {
    marca: vehiculo.marca || "",
    subMarca: vehiculo.subMarca || "",
    color: vehiculo.color || "",
    placas: vehiculo.placas || "",
    serie: vehiculo.serie || "",
    vehiculoPrincipal: {
      id: vehiculo.id || "",
      marca: vehiculo.marca || "",
      subMarca: vehiculo.subMarca || "",
      color: vehiculo.color || "",
      placas: vehiculo.placas || "",
      serie: vehiculo.serie || ""
    },
    actualizadoEn: firestoreServerTimestamp()
  };
  await firestoreSetDoc(
    firestoreDoc(db, "usuarios", usuarioActual.uid),
    datos,
    { merge: true }
  );
  perfilActual = { ...perfilActual, ...datos, vehiculoPrincipal: datos.vehiculoPrincipal };
  actualizarVehiculoPantalla(perfilActual);
  actualizarPerfilPantalla(perfilActual);
}
async function eliminarVehiculo(idVehiculo) {
  if (!usuarioActual || !idVehiculo || !firestoreDeleteDoc) return;
  const vehiculo = vehiculosUsuario.find(item => item.id === idVehiculo);
  if (!vehiculo) return;
  if (!confirm(`¿Deseas eliminar ${[vehiculo.marca, vehiculo.subMarca].filter(Boolean).join(" ") || "este vehículo"}?`)) return;
  try {
    await firestoreDeleteDoc(
      firestoreDoc(db, "usuarios", usuarioActual.uid, "vehiculos", idVehiculo)
    );
    vehiculosUsuario = vehiculosUsuario.filter(item => item.id !== idVehiculo);
    if (vehiculo.principal && vehiculosUsuario.length) {
      await establecerVehiculoPrincipal(vehiculosUsuario[0].id, false);
    } else if (vehiculo.principal) {
      await actualizarVehiculoPrincipalUsuario({
        id: "", marca: "", subMarca: "", color: "", placas: "", serie: ""
      });
    }
    await cargarVehiculos();
  } catch (error) {
    console.error("Error al eliminar el vehículo:", error);
    mostrarModal("⚠", "No fue posible eliminar", "Inténtalo nuevamente en unos momentos.");
  }
}
function mostrarTerminos() {
  mostrarModal(
    "⚠",
    "Términos de las alertas",
    "Las alertas de robo y montachoques son exclusivas para miembros activos. Deben utilizarse únicamente en situaciones reales. El uso falso o irresponsable puede ocasionar sanciones o cancelación de la membresía."
  );
}
function iniciarEscuchaNotificaciones(uidUsuario) {
  if (!firestoreOnSnapshot || !uidUsuario) return;
  if (typeof cancelarEscuchaNotificaciones === "function") {
    cancelarEscuchaNotificaciones();
  }
  const consulta = firestoreQuery(
    firestoreCollection(db, "notificaciones"),
    firestoreWhere("uidUsuario", "==", uidUsuario)
  );
  cancelarEscuchaNotificaciones = firestoreOnSnapshot(
    consulta,
    resultado => {
      notificacionesActuales = resultado.docs
        .map(documento => ({ id: documento.id, ...documento.data() }))
        .sort((a, b) => obtenerFechaNotificacion(b) - obtenerFechaNotificacion(a));
      actualizarContadorNotificaciones();
      if (document.getElementById("notificacionesOverlay")?.classList.contains("active")) {
        renderizarNotificaciones();
      }
    },
    error => {
      console.error("No fue posible cargar las notificaciones:", error);
      notificacionesActuales = [];
      actualizarContadorNotificaciones();
    }
  );
}
function obtenerFechaNotificacion(notificacion) {
  const valor =
    notificacion.fechaCreacion ||
    notificacion.creadoEn ||
    notificacion.fecha ||
    "";
  if (valor && typeof valor.toDate === "function") {

    return valor.toDate().getTime();
  }
  const fecha = new Date(valor).getTime();
  return Number.isNaN(fecha) ? 0 : fecha;
}
function actualizarContadorNotificaciones() {
  const contador = document.getElementById("notificationCounter") ||
    document.querySelector(".notificationCounter");
  if (!contador) return;
  const noLeidas = notificacionesActuales.filter(item => item.leida !== true).length;
  contador.textContent = String(noLeidas);
  contador.style.display = noLeidas > 0 ? "inline-flex" : "none";
}
function abrirNotificaciones() {
  crearInterfazNotificaciones();
  renderizarNotificaciones();
  document.getElementById("notificacionesOverlay")?.classList.add("active");
  document.body.style.overflow = "hidden";
}
function cerrarNotificaciones(event = null) {
  if (event && event.target.id !== "notificacionesOverlay") return;
  document.getElementById("notificacionesOverlay")?.classList.remove("active");
  document.body.style.overflow = "";
}
function crearInterfazNotificaciones() {
  if (document.getElementById("notificacionesOverlay")) return;
  agregarEstilosFuncionesNuevas();
  const overlay = document.createElement("div");
  overlay.id = "notificacionesOverlay";
  overlay.className = "asClickCustomOverlay";
  overlay.addEventListener("click", cerrarNotificaciones);
  overlay.innerHTML = `
    <section class="asClickCustomModal asClickNotificationModal" role="dialog" aria-modal="true" aria-labelledby="notificacionesTitulo">
      <button type="button" class="asClickCustomClose" onclick="cerrarNotificaciones()" aria-label="Cerrar">✕</button>
      <div class="asClickNotificationHeader">
        <div>
          <span class="asClickNotificationBell">🔔</span>
          <div><h2 id="notificacionesTitulo">Notificaciones</h2><p>Avisos de tu cuenta y servicios.</p></div>
        </div>
        <button type="button" class="asClickTextButton" onclick="marcarTodasNotificacionesLeidas()">Marcar todas como leídas</button>
      </div>
      <div id="listaNotificaciones" class="asClickNotificationList"></div>
    </section>
  `;
  document.body.appendChild(overlay);
}
function renderizarNotificaciones() {
  const lista = document.getElementById("listaNotificaciones");
  if (!lista) return;
  if (!notificacionesActuales.length) {
    lista.innerHTML = `
      <div class="asClickEmptyNotifications">
        <span>🔔</span>
        <b>No tienes notificaciones</b>
        <p>Cuando exista una actualización de tu cuenta o servicio aparecerá aquí.</p>
      </div>
    `;
    return;
  }
  lista.innerHTML = notificacionesActuales.map(item => {
    const noLeida = item.leida !== true;
    return `
      <article class="asClickNotificationItem ${noLeida ? "unread" : ""}">
        <div class="asClickNotificationType">${escaparHtml(obtenerIconoNotificacion(item.tipo))}</div>
        <div class="asClickNotificationContent">
          <b>${escaparHtml(item.titulo || "Notificación AS CLICK")}</b>
          <p>${escaparHtml(item.mensaje || item.texto || "")}</p>
          <small>${escaparHtml(formatearFechaNotificacion(item))}</small>
        </div>
        ${noLeida ? `<button type="button" class="asClickReadButton" onclick="marcarNotificacionLeida('${escaparAtributo(item.id)}')">Marcar leída</button>` : ""}
      </article>
    `;
  }).join("");
}
function obtenerIconoNotificacion(tipo) {
  const iconos = {
    servicio: "🚙",
    membresia: "⭐",
    emergencia: "🚨",
    promocion: "🎁",
    cuenta: "👤"
  };
  return iconos[normalizarEstado(tipo)] || "🔔";
}
function formatearFechaNotificacion(item) {
  const milisegundos = obtenerFechaNotificacion(item);
  if (!milisegundos) return "";
  return new Date(milisegundos).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
async function marcarNotificacionLeida(idNotificacion) {
  if (!idNotificacion || !firestoreUpdateDoc) return;
  try {
    await firestoreUpdateDoc(
      firestoreDoc(db, "notificaciones", idNotificacion),
      { leida: true }
    );
  } catch (error) {
    console.error("No fue posible marcar la notificación como leída:", error);
  }
}
async function marcarTodasNotificacionesLeidas() {
  const pendientes = notificacionesActuales.filter(item => item.leida !== true);
  if (!pendientes.length || !firestoreUpdateDoc) return;
  try {
    await Promise.all(
      pendientes.map(item =>
        firestoreUpdateDoc(
          firestoreDoc(db, "notificaciones", item.id),
          { leida: true }
        )
      )
    );
  } catch (error) {
    console.error("No fue posible marcar todas las notificaciones:", error);
  }
}
function agregarEstilosFuncionesNuevas() {
  if (document.getElementById("asClickFuncionesNuevasStyles")) return;
  const estilos = document.createElement("style");
  estilos.id = "asClickFuncionesNuevasStyles";
  estilos.textContent = `
    .asClickCustomOverlay{position:fixed;inset:0;background:rgba(3,24,48,.64);display:none;align-items:center;justify-content:center;padding:20px;z-index:9999}
    .asClickCustomOverlay.active{display:flex}
    .asClickCustomModal{position:relative;width:min(520px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.28);font-family:inherit;color:#102f52}
    .asClickCustomClose{position:absolute;top:14px;right:14px;border:0;background:transparent;font-size:20px;color:#6b7f96;cursor:pointer}
    .asClickCustomIcon{width:58px;height:58px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:#e9f8f0;font-size:28px}
    .asClickCustomModal>h2{text-align:center;margin:0 0 8px;font-size:25px}
    .asClickCustomIntro{text-align:center;color:#687d94;margin:0 0 20px}
    .asClickOptionList{display:grid;gap:10px}
    .asClickOption{display:flex;align-items:center;gap:12px;border:1px solid #d9e3ee;border-radius:10px;padding:14px;cursor:pointer}
    .asClickOption:hover{border-color:#1f6fdd;background:#f5f9ff}
    .asClickOption input{width:18px;height:18px}
    .asClickOption span{font-size:23px}
    .asClickFuelNotice{margin-top:16px;padding:14px;border:1px solid #f0c56a;border-radius:10px;background:#fff8e8;color:#684b0c}
    .asClickFuelNotice p{margin:8px 0 12px;line-height:1.45}
    .asClickFuelNotice label{display:flex;gap:9px;align-items:flex-start;font-size:13px;font-weight:600}
    .asClickCustomActions{display:flex;gap:10px;margin-top:22px}
    .asClickCustomActions button{flex:1;border-radius:8px;padding:12px 14px;font-weight:700;cursor:pointer}
    .asClickPrimaryButton{border:0;background:#176ddc;color:#fff}.asClickPrimaryButton:disabled{opacity:.45;cursor:not-allowed}
    .asClickSecondaryButton{border:1px solid #cad7e5;background:#fff;color:#173b63}
    .asClickNotificationModal{width:min(650px,100%);padding:22px}
    .asClickNotificationHeader{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-right:30px;margin-bottom:16px}
    .asClickNotificationHeader>div{display:flex;gap:12px;align-items:center}.asClickNotificationHeader h2{margin:0;font-size:23px}.asClickNotificationHeader p{margin:3px 0 0;color:#71849a;font-size:13px}
    .asClickNotificationBell{width:44px;height:44px;border-radius:12px;background:#eef5ff;display:grid;place-items:center;font-size:22px}
    .asClickTextButton,.asClickReadButton{border:0;background:transparent;color:#176ddc;font-weight:700;cursor:pointer}
    .asClickNotificationList{display:grid;gap:9px;max-height:60vh;overflow:auto}
    .asClickNotificationItem{display:flex;gap:12px;align-items:flex-start;border:1px solid #e0e7ef;border-radius:11px;padding:14px;background:#fff}
    .asClickNotificationItem.unread{border-left:4px solid #176ddc;background:#f5f9ff}
    .asClickNotificationType{font-size:22px}.asClickNotificationContent{flex:1}.asClickNotificationContent b{display:block;margin-bottom:4px}.asClickNotificationContent p{margin:0 0 7px;color:#526a82;line-height:1.4}.asClickNotificationContent small{color:#8192a5}
    .asClickEmptyNotifications{text-align:center;padding:42px 18px;color:#71849a}.asClickEmptyNotifications span{display:block;font-size:38px;margin-bottom:10px}.asClickEmptyNotifications b{display:block;color:#173b63;margin-bottom:6px}
    @media(max-width:600px){.asClickNotificationHeader{align-items:flex-start;flex-direction:column}.asClickCustomActions{flex-direction:column}.asClickNotificationItem{flex-wrap:wrap}.asClickReadButton{margin-left:38px}}
  `;
  document.head.appendChild(estilos);
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
    if (!firebaseSignOut || !auth) {
      throw new Error("Firebase Authentication no está disponible.");
    }
    await firebaseSignOut(auth);
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
window.cancelarServicioWhatsApp =
  cancelarServicioWhatsApp;
window.verMembresia =
  verMembresia;
window.agregarVehiculo =
  agregarVehiculo;
window.cerrarModalVehiculo = cerrarModalVehiculo;
window.guardarNuevoVehiculo = guardarNuevoVehiculo;
window.establecerVehiculoPrincipal = establecerVehiculoPrincipal;
window.eliminarVehiculo = eliminarVehiculo;
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
window.abrirAuxilioVial = abrirAuxilioVial;
window.seleccionarTipoAuxilioVial = seleccionarTipoAuxilioVial;
window.confirmarAuxilioVial = confirmarAuxilioVial;
window.cerrarAuxilioVial = cerrarAuxilioVial;
window.cerrarNotificaciones = cerrarNotificaciones;
window.marcarNotificacionLeida = marcarNotificacionLeida;
window.marcarTodasNotificacionesLeidas = marcarTodasNotificacionesLeidas;
window.mostrarModal = mostrarModal;
iniciarFirebase();
