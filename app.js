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

 

  setDoc,

 

  collection,

 

  query,

 

  where,

 

  getDocs,

 

  limit,

 

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

 

    /*

      Compatibilidad con cuentas antiguas:

      1. Busca una membresía ya vinculada por UID o correo.

      2. Recupera los datos capturados anteriormente.

      3. Crea automáticamente usuarios/{UID}.

      4. Si no existe información previa, crea un perfil básico

         sin cerrar ni bloquear la sesión.

    */

 

    const perfilRecuperado =

      await recuperarOCrearPerfilUsuario(user);

 

    perfilActual = perfilRecuperado;

 

    actualizarDatosPantalla(perfilActual);

 

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

 

 

 

/* =========================================

   RECUPERAR CUENTAS ANTIGUAS

========================================= */

 

async function recuperarOCrearPerfilUsuario(user) {

  let membresiaEncontrada = null;

  let numeroMembresia = "";

 

  try {

    const porUid = query(

      collection(db, "membresias"),

      where("uidUsuario", "==", user.uid),

      limit(1)

    );

 

    const resultadoUid = await getDocs(porUid);

 

    if (!resultadoUid.empty) {

      const documento = resultadoUid.docs[0];

      membresiaEncontrada = documento.data();

      numeroMembresia = documento.id;

    }

 

    if (!membresiaEncontrada && user.email) {

      const porCorreo = query(

        collection(db, "membresias"),

        where("correo", "==", user.email.toLowerCase()),

        limit(1)

      );

 

      const resultadoCorreo = await getDocs(porCorreo);

 

      if (!resultadoCorreo.empty) {

        const documento = resultadoCorreo.docs[0];

        membresiaEncontrada = documento.data();

        numeroMembresia = documento.id;

      }

    }

  } catch (error) {

    console.warn(

      "No fue posible buscar una membresía antigua:",

      error

    );

  }

 

  const estadoOriginal = normalizarEstado(

    membresiaEncontrada?.estadoMembresia ||

    membresiaEncontrada?.estado ||

    (membresiaEncontrada ? "activa" : "sin_membresia")

  );

 

  const estadoMembresia =

    ["asignada", "disponible"].includes(estadoOriginal)

      ? "activa"

      : estadoOriginal;

 

  const tieneMembresia = Boolean(membresiaEncontrada);

 

  const perfilRecuperado = {

    uid: user.uid,

 

    nombre:

      membresiaEncontrada?.nombreRegistro ||

      membresiaEncontrada?.nombre ||

      user.displayName ||

      obtenerNombreCorreo(user.email) ||

      "Usuario",

 

    telefono:

      membresiaEncontrada?.telefonoRegistro ||

      membresiaEncontrada?.telefono ||

      "",

 

    correo:

      membresiaEncontrada?.correo ||

      user.email ||

      "",

 

    rol: "cliente",

 

    tipoCliente:

      membresiaEncontrada?.tipoCliente ||

      "particular",

 

    tieneMembresia,

 

    numeroMiembro:

      membresiaEncontrada?.numeroMiembro ||

      membresiaEncontrada?.numeroMembresia ||

      numeroMembresia ||

      "",

 

    estadoMembresia,

 

    tipoMembresia:

      membresiaEncontrada?.tipoMembresia ||

      membresiaEncontrada?.plan ||

      "",

 

    vigencia:

      membresiaEncontrada?.vigencia ||

      membresiaEncontrada?.finVigencia ||

      "",

 

    tarifa:

      tieneMembresia

        ? "preferencial"

        : "publico_general",

 

    puedeUsarAlertas:

      tieneMembresia &&

      !["vencida", "cancelada"].includes(estadoMembresia),

 

    marca:

      membresiaEncontrada?.marcaRegistro ||

      membresiaEncontrada?.marca ||

      "",

 

    subMarca:

      membresiaEncontrada?.subMarcaRegistro ||

      membresiaEncontrada?.subMarca ||

      membresiaEncontrada?.submarca ||

      "",

 

    color:

      membresiaEncontrada?.colorRegistro ||

      membresiaEncontrada?.color ||

      "",

 

    placas:

      membresiaEncontrada?.placasRegistro ||

      membresiaEncontrada?.placas ||

      "",

 

    serie:

      membresiaEncontrada?.serieRegistro ||

      membresiaEncontrada?.serie ||

      "",

 

    activo: true,

    recuperadoAutomaticamente: true,

    fechaRegistro: serverTimestamp(),

    actualizadoEn: serverTimestamp()

  };

 

  perfilRecuperado.vehiculoPrincipal = {

    marca: perfilRecuperado.marca,

    subMarca: perfilRecuperado.subMarca,

    color: perfilRecuperado.color,

    placas: perfilRecuperado.placas,

    serie: perfilRecuperado.serie

  };

 

  await setDoc(

    doc(db, "usuarios", user.uid),

    perfilRecuperado,

    { merge: true }

  );

 

  return {

    ...perfilRecuperado,

    vigencia: formatearVigencia(perfilRecuperado.vigencia)

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

   PERFIL COMPLETO

========================================= */

 

function actualizarPerfilPantalla(perfil) {

  const valores = {

    perfilNombre: perfil.nombre || "Usuario",

    perfilCorreo: perfil.correo || "No registrado",

    perfilTelefono: perfil.telefono || "No registrado",

    perfilTipoCliente: obtenerTipoClienteTexto(perfil.tipoCliente),

    perfilMembresia: perfil.tieneMembresia

      ? (perfil.numeroMiembro || "Pendiente")

      : "No aplica",

    perfilEstadoMembresia: obtenerTextoEstado(perfil),

    perfilVigencia: perfil.tieneMembresia

      ? (perfil.vigencia || "Pendiente")

      : "No aplica",

    perfilPlan: perfil.tieneMembresia

      ? (perfil.tipoMembresia || "AS CLICK")

      : "Público general",

    perfilVehiculo: [perfil.marca, perfil.subMarca]

      .filter(Boolean)

      .join(" ") || "Sin registrar",

    perfilMarca: perfil.marca || "No registrada",

    perfilSubMarca: perfil.subMarca || "No registrada",

    perfilColor: perfil.color || "No registrado",

    perfilPlacas: perfil.placas || "No registradas",

    perfilSerie: perfil.serie || "No registrada"

  };

 

  Object.entries(valores).forEach(([id, valor]) => {

    actualizarTexto(id, valor);

  });

 

  document

    .querySelectorAll("[data-profile-field]")

    .forEach(elemento => {

      const campo = elemento.dataset.profileField;

 

      const equivalencias = {

        nombre: perfil.nombre || "Usuario",

        correo: perfil.correo || "No registrado",

        telefono: perfil.telefono || "No registrado",

        tipoCliente: obtenerTipoClienteTexto(perfil.tipoCliente),

        membresia: perfil.tieneMembresia

          ? (perfil.numeroMiembro || "Pendiente")

          : "No aplica",

        estadoMembresia: obtenerTextoEstado(perfil),

        vigencia: perfil.tieneMembresia

          ? (perfil.vigencia || "Pendiente")

          : "No aplica",

        marca: perfil.marca || "No registrada",

        subMarca: perfil.subMarca || "No registrada",

        color: perfil.color || "No registrado",

        placas: perfil.placas || "No registradas",

        serie: perfil.serie || "No registrada"

      };

 

      if (Object.prototype.hasOwnProperty.call(equivalencias, campo)) {

        elemento.textContent = equivalencias[campo];

      }

    });

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
