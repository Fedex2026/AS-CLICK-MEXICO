let seccionActual = "inicio";

function cambiarSeccion(seccion, boton = null) {
  seccionActual = seccion;

  document.querySelectorAll(".pageSection").forEach(section => {
    section.classList.remove("active");
  });

  const seccionDestino =
    document.getElementById(`seccion-${seccion}`);

  if (seccionDestino) {
    seccionDestino.classList.add("active");
  }

  document.querySelectorAll(".navItem").forEach(item => {
    item.classList.remove("active");

    if (item.dataset.section === seccion) {
      item.classList.add("active");
    }
  });

  document
    .querySelectorAll(".mobileBottomNav button")
    .forEach(item => {
      item.classList.remove("active");
    });

  if (boton && boton.closest(".mobileBottomNav")) {
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
    .querySelectorAll(".topNavigation button")
    .forEach(item => {
      item.classList.remove("active");
    });

  if (seccion === "inicio") {
    document
      .querySelector(".topNavigation button")
      ?.classList.add("active");
  }

  cerrarMenuMovil();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function abrirMenuMovil() {
  document
    .getElementById("sidebar")
    .classList.add("mobileOpen");

  document
    .getElementById("menuOverlay")
    .classList.add("active");
}

function cerrarMenuMovil() {
  document
    .getElementById("sidebar")
    .classList.remove("mobileOpen");

  document
    .getElementById("menuOverlay")
    .classList.remove("active");
}

function solicitarServicio(servicio) {
  mostrarModal(
    iconoServicio(servicio),
    `Solicitar ${servicio}`,
    `Tu solicitud de ${servicio.toLowerCase()} está lista para ser enviada. En la siguiente etapa conectaremos este botón con WhatsApp o con el sistema de asignación.`
  );
}

function activarAlerta(tipo) {
  const confirmar = confirm(
    `¿Confirmas que deseas activar la alerta de ${tipo}? Esta función debe utilizarse únicamente en una emergencia real.`
  );

  if (!confirmar) return;

  mostrarModal(
    "⚠",
    `Alerta de ${tipo} activada`,
    "La alerta fue registrada. Próximamente enviaremos la ubicación a los miembros activos y al grupo de atención."
  );
}

function hablarAsesor() {
  const mensaje =
    "Hola, necesito hablar con un asesor de AS CLICK.";

  const url =
    "https://wa.me/?text=" +
    encodeURIComponent(mensaje);

  window.open(url, "_blank");
}

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
    "Después agregaremos aquí el formulario para registrar marca, modelo, placas, color, número de serie y fotografía."
  );
}

function mostrarTerminos() {
  mostrarModal(
    "⚠",
    "Términos de las alertas",
    "Las alertas de emergencia deben utilizarse únicamente en situaciones reales. El uso falso o irresponsable puede ocasionar sanciones y cancelación de la membresía."
  );
}

function abrirNotificaciones() {
  mostrarModal(
    "♧",
    "Notificaciones",
    "Tienes tres notificaciones pendientes. Después agregaremos aquí el centro de notificaciones completo."
  );
}

function abrirMenuUsuario() {
  cambiarSeccion("perfil");
}

function cerrarSesion() {
  const confirmar = confirm(
    "¿Deseas cerrar tu sesión?"
  );

  if (!confirmar) return;

  mostrarModal(
    "↪",
    "Sesión cerrada",
    "La sesión se cerró correctamente. Más adelante conectaremos este botón con el inicio de sesión real."
  );
}

function iconoServicio(servicio) {
  if (servicio === "Ajustador") return "👤";
  if (servicio === "Abogado") return "⚖";
  if (servicio === "Auxilio vial") return "🔧";
  if (servicio === "Grúa") return "🚛";

  return "✓";
}

function mostrarModal(icono, titulo, texto) {
  document.getElementById("modalIcon").textContent =
    icono;

  document.getElementById("modalTitle").textContent =
    titulo;

  document.getElementById("modalText").textContent =
    texto;

  document
    .getElementById("modalOverlay")
    .classList.add("active");
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
    .classList.remove("active");
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    cerrarMenuMovil();
    cerrarModal();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 760) {
    cerrarMenuMovil();
  }
});
