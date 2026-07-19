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

 

let notificacionesUsuario = [];

let vehiculosUsuario = [];

 

 

 

 

 

 

 

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

 

    authModule.onAuthStateChanged(auth, async user => {

      if (!user) {

        window.location.replace("./login.html");

        return;

      }

 

      usuarioActual = user;

 

      try {

        await cargarDatosUsuario(user);

        await cargarHistorialServicios();

        await cargarNotificaciones();

        await cargarVehiculos();

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

 

  if (normalizarEstado(servicio) === "auxilio_vial") {

    abrirSelectorAuxilioVial();

    return;

  }

 

  await procesarSolicitudServicio(servicio, "");

}

 

 

 

 

 

 

 

function construirMensajeServicio(

  servicio,

  tipoTarifa,

  ubicacion,

  detalleAuxilio = ""

) {

  const numeroMembresia = perfilActual.tieneMembresia

    ? (perfilActual.numeroMiembro || "Pendiente")

    : "Sin membresía";

 

  const lineas = [

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

    `Servicio: ${servicio}`

  ];

 

  if (detalleAuxilio) {

    lineas.push(`Tipo de auxilio: ${detalleAuxilio}`);

  }

 

  if (detalleAuxilio === "Surtir gasolina") {

    lineas.push("Aviso aceptado: el costo del combustible corre por cuenta del cliente.");

  }

 

  lineas.push(

    `Ubicación: ${ubicacion}`,

    "",

    "Comentarios:"

  );

 

  return lineas.join("\n");

}

 

 

 

 

 

 

 

/* =========================================

 

 

 

   HISTORIAL DE SERVICIOS

 

 

 

========================================= */

 

 

 

async function guardarSolicitudServicio(

  servicio,

  tipoTarifa,

  ubicacion,

  detalleAuxilio = ""

) {

  if (!usuarioActual) return null;

 

  try {

    const folio = generarFolioServicio();

 

    await firestoreAddDoc(firestoreCollection(db, "servicios"), {

      usuarioId: usuarioActual.uid,

      uid: usuarioActual.uid,

      folio,

      servicio,

      tipoAuxilio: detalleAuxilio,

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

 

    await crearNotificacion({

      titulo: "Solicitud recibida",

      mensaje: detalleAuxilio

        ? `${servicio}: ${detalleAuxilio}. Folio ${folio}.`

        : `${servicio}. Folio ${folio}.`,

      tipo: "servicio"

    });

 

    await cargarHistorialServicios();

    return folio;

  } catch (error) {

    console.error("No fue posible guardar la solicitud:", error);

    return null;

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

   NOTIFICACIONES, VEHÍCULOS Y AUXILIO VIAL

========================================= */

 

async function procesarSolicitudServicio(servicio, detalleAuxilio = "") {

  const tipoTarifa =

    perfilActual.tieneMembresia && perfilActual.estadoMembresia === "activa"

      ? "Tarifa preferencial de miembro"

      : "Tarifa de público general";

 

  const ubicacion = await obtenerUbicacion();

 

  await guardarSolicitudServicio(

    servicio,

    tipoTarifa,

    ubicacion,

    detalleAuxilio

  );

 

  const mensaje = construirMensajeServicio(

    servicio,

    tipoTarifa,

    ubicacion,

    detalleAuxilio

  );

 

  const url = `https://wa.me/${TELEFONO_CABINA}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank", "noopener,noreferrer");

}

 

function abrirSelectorAuxilioVial() {

  abrirModalPersonalizado({

    titulo: "Auxilio vial",

    icono: "🔧",

    contenido: `

      <p class="asClickIntro">Selecciona el tipo de auxilio que necesitas:</p>

      <div class="asClickOptionGrid">

        <button type="button" onclick="seleccionarTipoAuxilio('Paso de corriente')">🔋<b>Paso de corriente</b></button>

        <button type="button" onclick="seleccionarTipoAuxilio('Cambio de llanta')">🛞<b>Cambio de llanta</b></button>

        <button type="button" onclick="seleccionarTipoAuxilio('Surtir gasolina')">⛽<b>Surtir gasolina</b></button>

      </div>

      <div id="avisoGasolina" class="asClickFuelNotice" hidden>

        <b>⚠ Aviso importante</b>

        <p>El costo del combustible corre por cuenta del cliente. AS CLICK únicamente proporciona el servicio para llevar el combustible hasta tu ubicación.</p>

        <label class="asClickCheck"><input type="checkbox" id="aceptaCostoCombustible" onchange="actualizarBotonAuxilio()"> He leído y acepto que el costo del combustible será cubierto por mí.</label>

      </div>

      <input type="hidden" id="tipoAuxilioSeleccionado">

      <div class="asClickActions">

        <button type="button" class="asClickSecondary" onclick="cerrarModalPersonalizado()">Cancelar</button>

        <button type="button" class="asClickPrimary" id="confirmarAuxilioButton" disabled onclick="confirmarSolicitudAuxilio()">Solicitar servicio</button>

      </div>

    `

  });

}

 

function seleccionarTipoAuxilio(tipo) {

  const campo = document.getElementById("tipoAuxilioSeleccionado");

  if (campo) campo.value = tipo;

 

  document.querySelectorAll(".asClickOptionGrid button").forEach(boton => {

    boton.classList.toggle("selected", boton.textContent.includes(tipo));

  });

 

  const aviso = document.getElementById("avisoGasolina");

  if (aviso) aviso.hidden = tipo !== "Surtir gasolina";

 

  const acepta = document.getElementById("aceptaCostoCombustible");

  if (acepta && tipo !== "Surtir gasolina") acepta.checked = false;

 

  actualizarBotonAuxilio();

}

 

function actualizarBotonAuxilio() {

  const tipo = document.getElementById("tipoAuxilioSeleccionado")?.value || "";

  const acepta = document.getElementById("aceptaCostoCombustible")?.checked === true;

  const boton = document.getElementById("confirmarAuxilioButton");

 

  if (boton) {

    boton.disabled = !tipo || (tipo === "Surtir gasolina" && !acepta);

  }

}

 

async function confirmarSolicitudAuxilio() {

  const tipo = document.getElementById("tipoAuxilioSeleccionado")?.value || "";

  if (!tipo) return;

 

  if (tipo === "Surtir gasolina" && !document.getElementById("aceptaCostoCombustible")?.checked) {

    return;

  }

 

  cerrarModalPersonalizado();

  await procesarSolicitudServicio("Auxilio vial", tipo);

}

 

async function crearNotificacion({ titulo, mensaje, tipo = "general" }) {

  if (!usuarioActual || !firestoreAddDoc || !firestoreCollection) return;

 

  try {

    await firestoreAddDoc(firestoreCollection(db, "notificaciones"), {

      uidUsuario: usuarioActual.uid,

      titulo,

      mensaje,

      tipo,

      leida: false,

      fechaCreacion: firestoreServerTimestamp(),

      fechaIso: new Date().toISOString()

    });

    await cargarNotificaciones();

  } catch (error) {

    console.error("No fue posible crear la notificación:", error);

  }

}

 

async function cargarNotificaciones() {

  if (!usuarioActual || !firestoreQuery || !firestoreCollection) return;

 

  try {

    const consulta = firestoreQuery(

      firestoreCollection(db, "notificaciones"),

      firestoreWhere("uidUsuario", "==", usuarioActual.uid)

    );

    const resultado = await firestoreGetDocs(consulta);

 

    notificacionesUsuario = resultado.docs

      .map(documento => ({ id: documento.id, ...documento.data() }))

      .sort((a, b) => obtenerFechaNotificacion(b) - obtenerFechaNotificacion(a));

 

    actualizarContadorNotificaciones();

  } catch (error) {

    console.error("No fue posible cargar las notificaciones:", error);

    notificacionesUsuario = [];

    actualizarContadorNotificaciones();

  }

}

 

function obtenerFechaNotificacion(item) {

  const valor = item.fechaCreacion || item.fechaIso || "";

  if (valor && typeof valor.toDate === "function") return valor.toDate().getTime();

  const fecha = new Date(valor).getTime();

  return Number.isNaN(fecha) ? 0 : fecha;

}

 

function formatearFechaNotificacion(item) {

  const valor = item.fechaCreacion || item.fechaIso || "";

  const fecha = valor && typeof valor.toDate === "function" ? valor.toDate() : new Date(valor);

  if (!fecha || Number.isNaN(fecha.getTime())) return "";

  return fecha.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

}

 

function actualizarContadorNotificaciones() {

  const contador = document.querySelector(".notificationCounter");

  if (!contador) return;

  const noLeidas = notificacionesUsuario.filter(item => item.leida !== true).length;

  contador.textContent = String(noLeidas);

  contador.style.display = noLeidas > 0 ? "" : "none";

}

 

function obtenerIconoNotificacion(tipo) {

  const iconos = {

    servicio: "🚙",

    membresia: "⭐",

    alerta: "🚨",

    promocion: "🎁"

  };

  return iconos[tipo] || "🔔";

}

 

async function marcarNotificacionLeida(id) {

  const item = notificacionesUsuario.find(n => n.id === id);

  if (!item || item.leida === true) return;

 

  try {

    await firestoreSetDoc(

      firestoreDoc(db, "notificaciones", id),

      { leida: true, leidaEn: firestoreServerTimestamp() },

      { merge: true }

    );

    item.leida = true;

    actualizarContadorNotificaciones();

    await abrirNotificaciones();

  } catch (error) {

    console.error("No fue posible marcar la notificación:", error);

  }

}

 

async function marcarTodasNotificacionesLeidas() {

  const pendientes = notificacionesUsuario.filter(item => item.leida !== true);

  try {

    await Promise.all(pendientes.map(item =>

      firestoreSetDoc(

        firestoreDoc(db, "notificaciones", item.id),

        { leida: true, leidaEn: firestoreServerTimestamp() },

        { merge: true }

      )

    ));

    await cargarNotificaciones();

    await abrirNotificaciones();

  } catch (error) {

    console.error("No fue posible actualizar las notificaciones:", error);

  }

}

 

async function guardarNuevoVehiculo(event) {

  event.preventDefault();

  if (!usuarioActual) return;

 

  const marca = document.getElementById("nuevoVehiculoMarca")?.value.trim() || "";

  const subMarca = document.getElementById("nuevoVehiculoSubMarca")?.value.trim() || "";

  const color = document.getElementById("nuevoVehiculoColor")?.value.trim() || "";

  const placas = (document.getElementById("nuevoVehiculoPlacas")?.value || "").trim().toUpperCase();

  const serie = (document.getElementById("nuevoVehiculoSerie")?.value || "").trim().toUpperCase().replace(/\s/g, "");

  const esPrincipal = document.getElementById("nuevoVehiculoPrincipal")?.checked === true;

 

  if (!marca || !subMarca || !color || !placas || !serie) return;

 

  try {

    const referencia = await firestoreAddDoc(

      firestoreCollection(db, "usuarios", usuarioActual.uid, "vehiculos"),

      {

        marca,

        subMarca,

        color,

        placas,

        serie,

        esPrincipal,

        activo: true,

        fechaRegistro: firestoreServerTimestamp()

      }

    );

 

    if (esPrincipal) {

      await establecerVehiculoPrincipal(referencia.id, { marca, subMarca, color, placas, serie });

    }

 

    await crearNotificacion({

      titulo: "Vehículo agregado",

      mensaje: `${marca} ${subMarca}, placas ${placas}.`,

      tipo: "general"

    });

 

    cerrarModalPersonalizado();

    await cargarVehiculos();

  } catch (error) {

    console.error("No fue posible guardar el vehículo:", error);

    mostrarModal("⚠", "No fue posible guardar", "Revisa las reglas de Firestore e inténtalo nuevamente.");

  }

}

 

async function cargarVehiculos() {

  if (!usuarioActual || !firestoreCollection) return;

 

  try {

    const resultado = await firestoreGetDocs(

      firestoreCollection(db, "usuarios", usuarioActual.uid, "vehiculos")

    );

    vehiculosUsuario = resultado.docs.map(documento => ({ id: documento.id, ...documento.data() }));

    renderizarVehiculos();

  } catch (error) {

    console.error("No fue posible cargar los vehículos:", error);

  }

}

 

function renderizarVehiculos() {

  const pagina = document.querySelector("#seccion-vehiculos .placeholderPage");

  if (!pagina) return;

 

  let contenedor = document.getElementById("vehiculosAdicionales");

  if (!contenedor) {

    contenedor = document.createElement("div");

    contenedor.id = "vehiculosAdicionales";

    contenedor.className = "asClickVehiclesGrid";

    const botonAgregar = pagina.querySelector('button[onclick="agregarVehiculo()"]');

    pagina.insertBefore(contenedor, botonAgregar || null);

  }

 

  contenedor.innerHTML = vehiculosUsuario.map(vehiculo => `

    <article class="asClickVehicleCard">

      <span>🚙</span>

      <div>

        <b>${escaparHtml([vehiculo.marca, vehiculo.subMarca].filter(Boolean).join(" "))}</b>

        <small>Placas: ${escaparHtml(vehiculo.placas || "Sin registrar")}</small>

        <small>Color: ${escaparHtml(vehiculo.color || "Sin registrar")}</small>

      </div>

      ${vehiculo.esPrincipal

        ? '<em>Principal</em>'

        : `<button type="button" onclick="usarVehiculoPrincipal('${escaparAtributo(vehiculo.id)}')">Usar como principal</button>`}

    </article>

  `).join("");

}

 

async function usarVehiculoPrincipal(id) {

  const vehiculo = vehiculosUsuario.find(item => item.id === id);

  if (!vehiculo) return;

  await establecerVehiculoPrincipal(id, vehiculo);

  await cargarVehiculos();

}

 

async function establecerVehiculoPrincipal(id, vehiculo) {

  await Promise.all(vehiculosUsuario.map(item =>

    firestoreSetDoc(

      firestoreDoc(db, "usuarios", usuarioActual.uid, "vehiculos", item.id),

      { esPrincipal: item.id === id },

      { merge: true }

    )

  ));

 

  await firestoreSetDoc(

    firestoreDoc(db, "usuarios", usuarioActual.uid),

    {

      marca: vehiculo.marca || "",

      subMarca: vehiculo.subMarca || "",

      color: vehiculo.color || "",

      placas: vehiculo.placas || "",

      serie: vehiculo.serie || "",

      vehiculoPrincipal: {

        marca: vehiculo.marca || "",

        subMarca: vehiculo.subMarca || "",

        color: vehiculo.color || "",

        placas: vehiculo.placas || "",

        serie: vehiculo.serie || ""

      },

      actualizadoEn: firestoreServerTimestamp()

    },

    { merge: true }

  );

 

  Object.assign(perfilActual, {

    marca: vehiculo.marca || "",

    subMarca: vehiculo.subMarca || "",

    color: vehiculo.color || "",

    placas: vehiculo.placas || "",

    serie: vehiculo.serie || ""

  });

  actualizarDatosPantalla(perfilActual);

}

 

function asegurarInterfazModulos() {

  if (!document.getElementById("asClickModuleStyles")) {

    const style = document.createElement("style");

    style.id = "asClickModuleStyles";

    style.textContent = `

      .asClickOverlay{position:fixed;inset:0;background:rgba(7,27,50,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}

      .asClickModal{width:min(620px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:16px;padding:26px;box-shadow:0 24px 70px rgba(0,0,0,.3);font-family:inherit;color:#102b4e}

      .asClickModalTop{display:flex;align-items:center;gap:12px;margin-bottom:18px}.asClickModalTop>span{font-size:28px}.asClickModalTop h2{margin:0;flex:1}.asClickClose{border:0;background:transparent;font-size:25px;cursor:pointer}

      .asClickActions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.asClickPrimary,.asClickSecondary{border:0;border-radius:7px;padding:12px 18px;font-weight:700;cursor:pointer}.asClickPrimary{background:#1769dc;color:#fff}.asClickPrimary:disabled{opacity:.45;cursor:not-allowed}.asClickSecondary{background:#eef3f8;color:#17395f}

      .asClickForm{display:grid;grid-template-columns:1fr 1fr;gap:14px}.asClickForm label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700}.asClickForm input{padding:11px;border:1px solid #ccd8e5;border-radius:7px}.asClickForm .asClickCheck,.asClickCheck{grid-column:1/-1;display:flex;flex-direction:row;align-items:flex-start;font-weight:500}.asClickCheck input{margin-top:3px}

      .asClickIntro{margin-top:0}.asClickOptionGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.asClickOptionGrid button{border:1px solid #d5e0ea;background:#f8fafc;border-radius:10px;padding:18px 8px;font-size:24px;cursor:pointer}.asClickOptionGrid b{display:block;margin-top:8px;font-size:13px}.asClickOptionGrid button.selected{border-color:#1769dc;background:#eaf3ff}

      .asClickFuelNotice{margin-top:16px;padding:14px;border:1px solid #f0c36d;background:#fff8e8;border-radius:9px;color:#6d4a00}.asClickFuelNotice p{margin:8px 0 12px}

      .asClickNotificationHeader{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.asClickNotificationHeader button{border:0;background:transparent;color:#1769dc;font-weight:700;cursor:pointer}.asClickNotificationList{display:grid;gap:8px}.asClickNotification{display:flex;text-align:left;gap:12px;width:100%;border:1px solid #dde6ef;background:#fff;border-radius:9px;padding:13px;cursor:pointer}.asClickNotification.noLeida{background:#edf5ff;border-color:#a7c9f4}.asClickNotification>span{font-size:22px}.asClickNotification div{flex:1}.asClickNotification p{margin:4px 0;color:#536b84}.asClickNotification small{color:#8294a7}.asClickEmpty{text-align:center;padding:30px}.asClickEmpty span{font-size:34px}.asClickEmpty b,.asClickEmpty p{display:block;margin-top:8px}

      .asClickVehiclesGrid{width:100%;display:grid;gap:12px;margin:16px 0}.asClickVehicleCard{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #d9e3ec;border-radius:10px;background:#fff;text-align:left}.asClickVehicleCard>span{font-size:28px}.asClickVehicleCard div{display:grid;flex:1}.asClickVehicleCard small{color:#657b91}.asClickVehicleCard em{font-style:normal;color:#168348;font-weight:700}.asClickVehicleCard button{border:1px solid #1769dc;background:#fff;color:#1769dc;border-radius:6px;padding:8px;cursor:pointer}

      @media(max-width:600px){.asClickForm{grid-template-columns:1fr}.asClickOptionGrid{grid-template-columns:1fr}.asClickActions{flex-direction:column-reverse}.asClickActions button{width:100%}}

    `;

    document.head.appendChild(style);

  }

}

 

function abrirModalPersonalizado({ titulo, icono, contenido }) {

  asegurarInterfazModulos();

  cerrarModalPersonalizado();

  const overlay = document.createElement("div");

  overlay.id = "asClickCustomOverlay";

  overlay.className = "asClickOverlay";

  overlay.innerHTML = `

    <section class="asClickModal" role="dialog" aria-modal="true" aria-label="${escaparHtml(titulo)}">

      <div class="asClickModalTop">

        <span>${icono}</span><h2>${escaparHtml(titulo)}</h2>

        <button type="button" class="asClickClose" onclick="cerrarModalPersonalizado()" aria-label="Cerrar">×</button>

      </div>

      ${contenido}

    </section>

  `;

  overlay.addEventListener("click", event => {

    if (event.target === overlay) cerrarModalPersonalizado();

  });

  document.body.appendChild(overlay);

  document.body.style.overflow = "hidden";

}

 

function cerrarModalPersonalizado() {

  document.getElementById("asClickCustomOverlay")?.remove();

  document.body.style.overflow = "";

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

  if (!usuarioActual) {

    mostrarModal(

      "⚠",

      "Sesión no disponible",

      "Inicia sesión nuevamente para agregar un vehículo."

    );

    return;

  }

 

  abrirModalPersonalizado({

    titulo: "Agregar vehículo",

    icono: "🚙",

    contenido: `

      <form id="nuevoVehiculoForm" class="asClickForm">

        <label>Marca<input id="nuevoVehiculoMarca" required maxlength="40"></label>

        <label>Submarca<input id="nuevoVehiculoSubMarca" required maxlength="50"></label>

        <label>Color<input id="nuevoVehiculoColor" required maxlength="30"></label>

        <label>Placas<input id="nuevoVehiculoPlacas" required maxlength="12"></label>

        <label>Serie / VIN<input id="nuevoVehiculoSerie" required maxlength="17"></label>

        <label class="asClickCheck"><input type="checkbox" id="nuevoVehiculoPrincipal"> Usar como vehículo principal</label>

        <div class="asClickActions">

          <button type="button" class="asClickSecondary" onclick="cerrarModalPersonalizado()">Cancelar</button>

          <button type="submit" class="asClickPrimary">Guardar vehículo</button>

        </div>

      </form>

    `

  });

 

  document.getElementById("nuevoVehiculoForm")?.addEventListener("submit", guardarNuevoVehiculo);

}

 

 

 

 

 

 

 

function mostrarTerminos() {

 

 

 

  mostrarModal(

 

 

 

    "⚠",

 

 

 

    "Términos de las alertas",

 

 

 

    "Las alertas de robo y montachoques son exclusivas para miembros activos. Deben utilizarse únicamente en situaciones reales. El uso falso o irresponsable puede ocasionar sanciones o cancelación de la membresía."

 

 

 

  );

 

 

 

}

 

 

 

 

 

 

 

async function abrirNotificaciones() {

  if (!usuarioActual) {

    mostrarModal(

      "⚠",

      "Sesión no disponible",

      "Inicia sesión nuevamente para consultar tus notificaciones."

    );

    return;

  }

 

  await cargarNotificaciones();

 

  const contenido = notificacionesUsuario.length

    ? notificacionesUsuario.map(item => {

        const clase = item.leida ? "" : " noLeida";

        return `

          <button type="button" class="asClickNotification${clase}" onclick="marcarNotificacionLeida('${escaparAtributo(item.id)}')">

            <span>${obtenerIconoNotificacion(item.tipo)}</span>

            <div>

              <b>${escaparHtml(item.titulo || "Notificación")}</b>

              <p>${escaparHtml(item.mensaje || "")}</p>

              <small>${escaparHtml(formatearFechaNotificacion(item))}</small>

            </div>

          </button>

        `;

      }).join("")

    : `<div class="asClickEmpty"><span>🔔</span><b>No tienes notificaciones</b><p>Los avisos de tus solicitudes y servicios aparecerán aquí.</p></div>`;

 

  abrirModalPersonalizado({

    titulo: "Notificaciones",

    icono: "🔔",

    contenido: `

      <div class="asClickNotificationHeader">

        <span>${notificacionesUsuario.length} notificación(es)</span>

        ${notificacionesUsuario.some(item => !item.leida)

          ? '<button type="button" onclick="marcarTodasNotificacionesLeidas()">Marcar todas como leídas</button>'

          : ''}

      </div>

      <div class="asClickNotificationList">${contenido}</div>

    `

  });

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

 

 

 

window.mostrarModal = mostrarModal;

 

 

 

 

 

window.cerrarModalPersonalizado = cerrarModalPersonalizado;

window.seleccionarTipoAuxilio = seleccionarTipoAuxilio;

window.actualizarBotonAuxilio = actualizarBotonAuxilio;

window.confirmarSolicitudAuxilio = confirmarSolicitudAuxilio;

window.marcarNotificacionLeida = marcarNotificacionLeida;

window.marcarTodasNotificacionesLeidas = marcarTodasNotificacionesLeidas;

window.usarVehiculoPrincipal = usarVehiculoPrincipal;

 

iniciarFirebase()
