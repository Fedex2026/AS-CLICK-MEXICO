import { auth } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

/* =========================================
   ELEMENTOS DEL LOGIN
========================================= */

const loginForm =
  document.getElementById("loginForm");

const emailInput =
  document.getElementById("email");

const passwordInput =
  document.getElementById("password");

const rememberSession =
  document.getElementById("rememberSession");

const loginButton =
  document.getElementById("loginButton");

const loginButtonText =
  document.getElementById("loginButtonText");

const loginSpinner =
  document.getElementById("loginSpinner");

const loginMessage =
  document.getElementById("loginMessage");

const emailError =
  document.getElementById("emailError");

const passwordError =
  document.getElementById("passwordError");

const passwordToggle =
  document.getElementById("passwordToggle");

const forgotPasswordBtn =
  document.getElementById("forgotPasswordBtn");

const supportButton =
  document.getElementById("supportButton");

const termsButton =
  document.getElementById("termsButton");

const privacyButton =
  document.getElementById("privacyButton");

/* =========================================
   ELEMENTOS DEL MODAL DE RECUPERACIÓN
========================================= */

const recoveryModal =
  document.getElementById("recoveryModal");

const recoveryForm =
  document.getElementById("recoveryForm");

const recoveryEmail =
  document.getElementById("recoveryEmail");

const recoveryError =
  document.getElementById("recoveryError");

const recoveryButton =
  document.getElementById("recoveryButton");

const closeRecoveryModal =
  document.getElementById("closeRecoveryModal");

/* =========================================
   ELEMENTOS DEL MODAL INFORMATIVO
========================================= */

const infoModal =
  document.getElementById("infoModal");

const infoModalIcon =
  document.getElementById("infoModalIcon");

const infoModalTitle =
  document.getElementById("infoModalTitle");

const infoModalText =
  document.getElementById("infoModalText");

const closeInfoModal =
  document.getElementById("closeInfoModal");

const acceptInfoModal =
  document.getElementById("acceptInfoModal");

/* =========================================
   CONFIGURACIÓN
========================================= */

/*
  Coloca aquí el número de WhatsApp de AS CLICK.

  Ejemplo México:
  525512345678

  Debe llevar:
  52 + lada + número
  Sin espacios, guiones ni signo +
*/

const TELEFONO_ASESOR = "525519750497";

/* =========================================
   INICIAR SESIÓN
========================================= */

loginForm?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    limpiarErrores();

    const email =
      emailInput.value.trim().toLowerCase();

    const password =
      passwordInput.value;

    const formularioValido =
      validarFormulario(email, password);

    if (!formularioValido) return;

    activarCarga(true);

    try {
      /*
        Si el usuario marca "Mantener mi sesión",
        Firebase conservará la sesión en el navegador.

        Si lo desmarca, la sesión durará solamente
        durante la pestaña o sesión actual.
      */

      const persistencia =
        rememberSession.checked
          ? browserLocalPersistence
          : browserSessionPersistence;

      await setPersistence(
        auth,
        persistencia
      );

      const credencial =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      if (!credencial.user) {
        throw new Error(
          "No fue posible iniciar sesión."
        );
      }

      mostrarMensaje(
        "Sesión iniciada correctamente. Entrando al panel...",
        "success"
      );

      /*
        Pequeña pausa para que el usuario
        alcance a ver el mensaje.
      */

      setTimeout(() => {
        window.location.href = "index.html";
      }, 700);
    } catch (error) {
      console.error(
        "Error al iniciar sesión:",
        error
      );

      mostrarMensaje(
        obtenerMensajeError(error.code),
        "error"
      );
    } finally {
      activarCarga(false);
    }
  }
);

/* =========================================
   VALIDACIONES
========================================= */

function validarFormulario(email, password) {
  let valido = true;

  if (!email) {
    emailError.textContent =
      "Escribe tu correo electrónico.";

    emailInput.classList.add("error");
    valido = false;
  } else if (!correoValido(email)) {
    emailError.textContent =
      "Escribe un correo electrónico válido.";

    emailInput.classList.add("error");
    valido = false;
  }

  if (!password) {
    passwordError.textContent =
      "Escribe tu contraseña.";

    passwordInput.classList.add("error");
    valido = false;
  } else if (password.length < 6) {
    passwordError.textContent =
      "La contraseña debe tener al menos 6 caracteres.";

    passwordInput.classList.add("error");
    valido = false;
  }

  return valido;
}

function correoValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function limpiarErrores() {
  emailError.textContent = "";
  passwordError.textContent = "";

  emailInput.classList.remove("error");
  passwordInput.classList.remove("error");

  ocultarMensaje();
}

/* =========================================
   MENSAJE DEL LOGIN
========================================= */

function mostrarMensaje(texto, tipo = "info") {
  loginMessage.textContent = texto;

  loginMessage.className =
    `loginMessage visible ${tipo}`;
}

function ocultarMensaje() {
  loginMessage.textContent = "";
  loginMessage.className = "loginMessage";
}

/* =========================================
   ESTADO DE CARGA
========================================= */

function activarCarga(activo) {
  loginButton.disabled = activo;

  loginButton.classList.toggle(
    "loading",
    activo
  );

  loginButton.setAttribute(
    "aria-busy",
    String(activo)
  );

  if (loginButtonText) {
    loginButtonText.textContent =
      activo
        ? "INICIANDO..."
        : "INICIAR SESIÓN";
  }

  if (loginSpinner) {
    loginSpinner.setAttribute(
      "aria-hidden",
      String(!activo)
    );
  }
}

/* =========================================
   MOSTRAR Y OCULTAR CONTRASEÑA
========================================= */

passwordToggle?.addEventListener(
  "click",
  () => {
    const ocultando =
      passwordInput.type === "password";

    passwordInput.type =
      ocultando ? "text" : "password";

    passwordToggle.textContent =
      ocultando ? "🙈" : "👁";

    passwordToggle.setAttribute(
      "aria-label",
      ocultando
        ? "Ocultar contraseña"
        : "Mostrar contraseña"
    );

    passwordToggle.setAttribute(
      "aria-pressed",
      String(ocultando)
    );

    passwordInput.focus();
  }
);

/* =========================================
   RECUPERAR CONTRASEÑA
========================================= */

forgotPasswordBtn?.addEventListener(
  "click",
  () => {
    const correoActual =
      emailInput.value.trim();

    recoveryEmail.value = correoActual;

    recoveryError.textContent = "";
    recoveryEmail.classList.remove("error");

    abrirModal(recoveryModal);

    setTimeout(() => {
      recoveryEmail.focus();
    }, 100);
  }
);

recoveryForm?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const email =
      recoveryEmail.value
        .trim()
        .toLowerCase();

    recoveryError.textContent = "";
    recoveryEmail.classList.remove("error");

    if (!email) {
      recoveryError.textContent =
        "Escribe tu correo electrónico.";

      recoveryEmail.classList.add("error");
      return;
    }

    if (!correoValido(email)) {
      recoveryError.textContent =
        "Escribe un correo electrónico válido.";

      recoveryEmail.classList.add("error");
      return;
    }

    recoveryButton.disabled = true;
    recoveryButton.textContent =
      "ENVIANDO...";

    try {
      await sendPasswordResetEmail(
        auth,
        email
      );

      cerrarModal(recoveryModal);

      mostrarModalInformativo(
        "✉",
        "Correo enviado",
        "Si el correo está asociado a una cuenta de AS CLICK, recibirás un enlace para crear una nueva contraseña. Revisa también la carpeta de correo no deseado."
      );
    } catch (error) {
      console.error(
        "Error al recuperar contraseña:",
        error
      );

      recoveryError.textContent =
        obtenerMensajeRecuperacion(
          error.code
        );

      recoveryEmail.classList.add("error");
    } finally {
      recoveryButton.disabled = false;
      recoveryButton.textContent =
        "ENVIAR ENLACE";
    }
  }
);

closeRecoveryModal?.addEventListener(
  "click",
  () => cerrarModal(recoveryModal)
);

/* =========================================
   SOPORTE POR WHATSAPP
========================================= */

supportButton?.addEventListener(
  "click",
  () => {
    const mensaje = [
      "Hola, necesito ayuda para acceder a mi cuenta de AS CLICK.",
      "",
      "Mi nombre es:",
      "Mi número de miembro es:"
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
);

/* =========================================
   TÉRMINOS Y PRIVACIDAD
========================================= */

termsButton?.addEventListener(
  "click",
  () => {
    mostrarModalInformativo(
      "📄",
      "Términos y condiciones",
      "El acceso a AS CLICK está reservado para miembros activos. Los servicios y alertas deben utilizarse de manera responsable. El uso falso de las alertas de emergencia puede ocasionar sanciones o cancelación de la membresía."
    );
  }
);

privacyButton?.addEventListener(
  "click",
  () => {
    mostrarModalInformativo(
      "🛡️",
      "Aviso de privacidad",
      "AS CLICK utilizará tus datos únicamente para administrar tu membresía, identificar tus vehículos, atender solicitudes de servicio, contactarte durante una emergencia y mejorar la atención brindada."
    );
  }
);

closeInfoModal?.addEventListener(
  "click",
  () => cerrarModal(infoModal)
);

acceptInfoModal?.addEventListener(
  "click",
  () => cerrarModal(infoModal)
);

/* =========================================
   FUNCIONES DE MODALES
========================================= */

function abrirModal(modal) {
  if (!modal) return;

  modal.classList.add("active");
  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.style.overflow =
    "hidden";
}

function cerrarModal(modal) {
  if (!modal) return;

  modal.classList.remove("active");
  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.style.overflow = "";
}

function mostrarModalInformativo(
  icono,
  titulo,
  texto
) {
  infoModalIcon.textContent = icono;
  infoModalTitle.textContent = titulo;
  infoModalText.textContent = texto;

  abrirModal(infoModal);
}

/*
  Cierra el modal cuando se toca el fondo oscuro,
  pero no cuando se toca la tarjeta blanca.
*/

[
  recoveryModal,
  infoModal
].forEach(modal => {
  modal?.addEventListener(
    "click",
    event => {
      if (event.target === modal) {
        cerrarModal(modal);
      }
    }
  );
});

/* =========================================
   LIMPIAR ERRORES AL ESCRIBIR
========================================= */

emailInput?.addEventListener(
  "input",
  () => {
    emailError.textContent = "";
    emailInput.classList.remove("error");
    ocultarMensaje();
  }
);

passwordInput?.addEventListener(
  "input",
  () => {
    passwordError.textContent = "";
    passwordInput.classList.remove("error");
    ocultarMensaje();
  }
);

recoveryEmail?.addEventListener(
  "input",
  () => {
    recoveryError.textContent = "";
    recoveryEmail.classList.remove("error");
  }
);

/* =========================================
   ERRORES DE FIREBASE
========================================= */

function obtenerMensajeError(codigo) {
  const mensajes = {
    "auth/invalid-email":
      "El correo electrónico no es válido.",

    "auth/missing-password":
      "Escribe tu contraseña.",

    "auth/invalid-credential":
      "El correo o la contraseña son incorrectos.",

    "auth/user-not-found":
      "El correo o la contraseña son incorrectos.",

    "auth/wrong-password":
      "El correo o la contraseña son incorrectos.",

    "auth/user-disabled":
      "Esta cuenta fue desactivada. Comunícate con un asesor.",

    "auth/too-many-requests":
      "Se realizaron demasiados intentos. Espera unos minutos antes de volver a intentarlo.",

    "auth/network-request-failed":
      "No fue posible conectarse. Revisa tu conexión a internet.",

    "auth/operation-not-allowed":
      "El inicio de sesión por correo no está habilitado en Firebase.",

    "auth/unauthorized-domain":
      "Este dominio no está autorizado en Firebase Authentication.",

    "auth/internal-error":
      "Firebase presentó un problema interno. Inténtalo nuevamente."
  };

  return (
    mensajes[codigo] ||
    "No fue posible iniciar sesión. Revisa tus datos e inténtalo nuevamente."
  );
}

function obtenerMensajeRecuperacion(codigo) {
  const mensajes = {
    "auth/invalid-email":
      "El correo electrónico no es válido.",

    "auth/missing-email":
      "Escribe tu correo electrónico.",

    "auth/too-many-requests":
      "Se realizaron demasiadas solicitudes. Espera unos minutos.",

    "auth/network-request-failed":
      "No fue posible conectarse. Revisa tu conexión a internet.",

    "auth/unauthorized-domain":
      "Este dominio no está autorizado en Firebase Authentication."
  };

  return (
    mensajes[codigo] ||
    "No fue posible enviar el correo. Inténtalo nuevamente."
  );
}

/* =========================================
   SESIÓN YA INICIADA
========================================= */

/*
  Si el usuario ya tiene una sesión activa y abre
  login.html, se enviará automáticamente al dashboard.
*/

let primeraRevisionSesion = true;

onAuthStateChanged(
  auth,
  user => {
    if (!primeraRevisionSesion) return;

    primeraRevisionSesion = false;

    if (user) {
      mostrarMensaje(
        "Ya tienes una sesión activa. Entrando al panel...",
        "info"
      );

      setTimeout(() => {
        window.location.href =
          "index.html";
      }, 500);
    }
  }
);

/* =========================================
   TECLA ESCAPE
========================================= */

document.addEventListener(
  "keydown",
  event => {
    if (event.key !== "Escape") return;

    cerrarModal(recoveryModal);
    cerrarModal(infoModal);
  }
);

/* =========================================
   CARGA INICIAL
========================================= */

window.addEventListener(
  "DOMContentLoaded",
  () => {
    emailInput?.focus();
  }
);
