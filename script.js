function abrirColeccion() {
  document.getElementById("modal-coleccion").style.display = "block";
}


function cerrarColeccion() {
  document.getElementById("modal-coleccion").style.display = "none";
}


window.onclick = function(event) {
  if (event.target.classList && event.target.classList.contains("modal")) {
    event.target.style.display = "none";
  }
};


let carrito = [];

function agregarAlCarrito(nombre, precio, selectId, colorId) {
  const talleSeleccionado = document.getElementById(selectId).value;
  const colorEl = colorId ? document.getElementById(colorId) : null;

  const item = {
    nombre: nombre,
    precio: precio,
    talle: talleSeleccionado,
    color: colorEl ? colorEl.value : ""
  };

  carrito.push(item);

 
  const contadorElemento = document.getElementById("cart-count");
  if (contadorElemento) {
    contadorElemento.textContent = carrito.length;
  }

  alert(`¡Agregado! "${nombre}" (Talle: ${talleSeleccionado}${item.color ? ", Color: " + item.color : ""}) se sumó al carrito.`);
}



function abrirCarrito() {
  document.getElementById("modal-carrito").style.display = "block";
  irAPaso(1);
}

function cerrarCarrito() {
  document.getElementById("modal-carrito").style.display = "none";
}


function mostrarCarrito() {
  const contenedor = document.getElementById("lista-carrito");
  contenedor.innerHTML = "";
  let total = 0;

  if (carrito.length === 0) {
    contenedor.innerHTML = "<p>El carrito está vacío.</p>";
    actualizarMontos(0);
    return;
  }

  carrito.forEach((item, index) => {
    total += item.precio;
    contenedor.innerHTML += `
      <div class="item-carrito" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
        <div>
          <strong>${item.nombre}</strong><br>
          <small>Talle: ${item.talle || 'Único'}${item.color ? ' · ' + item.color : ''}</small>
        </div>
        <div>
          <span>$${item.precio.toLocaleString("es-AR")}</span>
          <button onclick="eliminarDelCarrito(${index})" style="background: none; border: none; color: red; cursor: pointer; margin-left: 10px; font-weight: bold;">✕</button>
        </div>
      </div>
    `;
  });

  actualizarMontos(total);
}


function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  document.getElementById("cart-count").innerText = carrito.length;
  if (carrito.length === 0) envioActual = null;
  mostrarCarrito();
}


function buscarProductos(event) {
  const textoBuscado = document.getElementById("input-buscador").value.toLowerCase();
  const tarjetas = document.querySelectorAll(".producto-card");
  let primerProductoEncontrado = null;

  tarjetas.forEach(tarjeta => {
    const nombreProducto = tarjeta.querySelector("h3").textContent.toLowerCase();

    if (textoBuscado !== "" && nombreProducto.includes(textoBuscado)) {
      tarjeta.style.display = "";
      if (!primerProductoEncontrado) {
        primerProductoEncontrado = tarjeta;
      }
    } else if (textoBuscado === "") {
      tarjeta.style.display = "";
    } else {
      tarjeta.style.display = "none";
    }
  });

  if (event && event.key === "Enter" && primerProductoEncontrado) {
    primerProductoEncontrado.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}




let indexOferta = 0;

function moverCarruselOfertas() {
  const slider = document.querySelector('.ofertas-slider');
  const cards = document.querySelectorAll('.oferta-card');
  
  if (!slider || cards.length === 0) return;
  
  indexOferta++;
  if (indexOferta >= cards.length) {
    indexOferta = 0; 
  }
  
  slider.style.transform = `translateX(-${indexOferta * 100}%)`;
}

setInterval(moverCarruselOfertas, 3500);



function abrirColeccionPrimavera() {
  const modal = document.getElementById('modal-coleccion-primavera');
  if (modal) modal.style.display = 'block';
}

function cerrarColeccionPrimavera() {
  const modal = document.getElementById('modal-coleccion-primavera');
  if (modal) modal.style.display = 'none';
}

function abrirColeccionVerano() {
  const modal = document.getElementById('modal-coleccion-verano');
  if (modal) modal.style.display = 'block';
}

function cerrarColeccionVerano() {
  const modal = document.getElementById('modal-coleccion-verano');
  if (modal) modal.style.display = 'none';
}

// Cambia la foto de una prenda cuando elegís otro color (si ese color tiene su propia foto)
function cambiarFotoColor(select, imgId) {
  const opcion = select.options[select.selectedIndex];
  const img = document.getElementById(imgId);
  if (img && opcion && opcion.dataset.img) img.src = opcion.dataset.img;
}


// ===================== PROCESO DE COMPRA =====================

// Tarifas de envío ESTIMADAS por zona de código postal (editá los valores a gusto).
const ENVIO_GRATIS_DESDE = 100000;
const ZONAS_ENVIO = [
  { desde: 1000, hasta: 1999, zona: "CABA y GBA",              costo: 4000, dias: "2 a 4 días hábiles" },
  { desde: 2000, hasta: 5999, zona: "Interior del país",       costo: 6500, dias: "4 a 7 días hábiles" },
  { desde: 6000, hasta: 9999, zona: "Resto del país",          costo: 8000, dias: "5 a 9 días hábiles" }
];

let envioActual = null;      // { cp, zona, costo, dias, gratis }
let pasoActual = 1;

function subtotalCarrito() {
  return carrito.reduce((acc, it) => acc + it.precio, 0);
}

function formatoPesos(n) {
  return n.toLocaleString("es-AR");
}

function extraerCP(texto) {
  // Acepta "1646" o formato CPA "B1646ABC": se queda con los 4 dígitos
  const m = String(texto).toUpperCase().replace(/\s/g, "").match(/^[A-Z]?(\d{4})([A-Z]{3})?$/);
  return m ? parseInt(m[1], 10) : null;
}

function calcularEnvio() {
  const out = document.getElementById("resultado-envio");
  const cp = extraerCP(document.getElementById("input-cp").value);
  if (cp === null) {
    envioActual = null;
    out.style.color = "#b00020";
    out.textContent = "Ingresá un código postal válido de 4 dígitos.";
    actualizarMontos(subtotalCarrito());
    return;
  }
  const z = ZONAS_ENVIO.find(z => cp >= z.desde && cp <= z.hasta);
  if (!z) {
    envioActual = null;
    out.style.color = "#b00020";
    out.textContent = "No encontramos ese código postal.";
    actualizarMontos(subtotalCarrito());
    return;
  }
  const gratis = subtotalCarrito() >= ENVIO_GRATIS_DESDE;
  envioActual = { cp, zona: z.zona, costo: gratis ? 0 : z.costo, dias: z.dias, gratis };
  out.style.color = "#666";
  out.textContent = `${z.zona}: ${gratis ? "¡Envío gratis!" : "$" + formatoPesos(z.costo)} · ${z.dias} (estimado)`;
  actualizarMontos(subtotalCarrito());
}

function actualizarMontos(subtotal) {
  const sub = document.getElementById("subtotal-precio");
  const env = document.getElementById("envio-precio");
  const tot = document.getElementById("total-precio");
  if (!sub || !env || !tot) return;
  // si el carrito cambió, recalculamos el envío gratis
  if (envioActual && envioActual.gratis && subtotal < ENVIO_GRATIS_DESDE) {
    const z = ZONAS_ENVIO.find(z => envioActual.cp >= z.desde && envioActual.cp <= z.hasta);
    envioActual.costo = z.costo; envioActual.gratis = false;
  }
  const costoEnvio = envioActual ? envioActual.costo : 0;
  sub.textContent = formatoPesos(subtotal);
  env.textContent = envioActual ? (envioActual.gratis ? "Gratis" : "$" + formatoPesos(costoEnvio)) : "— (ingresá tu CP)";
  tot.textContent = formatoPesos(subtotal + costoEnvio);
}

function irAPaso(n) {
  if (n >= 2 && carrito.length === 0) {
    alert("Tu carrito está vacío.");
    return;
  }
  pasoActual = n;
  for (let i = 1; i <= 4; i++) {
    const p = document.getElementById("paso-" + i);
    if (p) p.style.display = i === n ? "block" : "none";
  }
  document.querySelectorAll("#pasos-compra li").forEach((li, idx) => {
    li.classList.toggle("activo", idx + 1 === n);
    li.classList.toggle("hecho", idx + 1 < n);
  });
  if (n === 1) mostrarCarrito();
  if (n === 2) {
    const cpInput = document.getElementById("cli-cp");
    if (!cpInput.value) cpInput.value = document.getElementById("input-cp").value;
    cambiarEntrega();
  }
  if (n === 3) actualizarResumenFinal();
}

function entregaElegida() {
  return document.querySelector('input[name="entrega"]:checked').value;
}

function cambiarEntrega() {
  document.getElementById("bloque-domicilio").style.display = entregaElegida() === "envio" ? "block" : "none";
}

function sincronizarCP() {
  document.getElementById("input-cp").value = document.getElementById("cli-cp").value;
  if (extraerCP(document.getElementById("cli-cp").value) !== null) calcularEnvio();
}

function validarDatos() {
  const err = document.getElementById("error-datos");
  const v = id => document.getElementById(id).value.trim();
  err.textContent = "";

  if (v("cli-nombre").length < 3) return err.textContent = "Ingresá tu nombre y apellido.";
  if (!/^\S+@\S+\.\S+$/.test(v("cli-email"))) return err.textContent = "Ingresá un email válido.";
  if (v("cli-tel").replace(/\D/g, "").length < 8) return err.textContent = "Ingresá un teléfono válido.";

  if (entregaElegida() === "envio") {
    if (v("cli-direccion").length < 4) return err.textContent = "Ingresá tu dirección.";
    if (v("cli-ciudad").length < 2) return err.textContent = "Ingresá tu ciudad.";
    if (extraerCP(v("cli-cp")) === null) return err.textContent = "Ingresá un código postal válido.";
    sincronizarCP();
    if (!envioActual) return err.textContent = "No pudimos calcular el envío para ese código postal.";
  }
  irAPaso(3);
}

function totalesFinales() {
  const subtotal = subtotalCarrito();
  const envio = entregaElegida() === "envio" && envioActual ? envioActual.costo : 0;
  const pago = document.querySelector('input[name="pago"]:checked').value;
  const descuento = pago === "transferencia" ? Math.round(subtotal * 0.10) : 0;
  return { subtotal, envio, descuento, pago, total: subtotal - descuento + envio };
}

function actualizarResumenFinal() {
  const t = totalesFinales();
  document.getElementById("resumen-final").innerHTML = `
    <p>Subtotal: $${formatoPesos(t.subtotal)}</p>
    ${t.descuento ? `<p>Descuento transferencia (10%): -$${formatoPesos(t.descuento)}</p>` : ""}
    <p>Envío: ${entregaElegida() === "retiro" ? "Retiro (gratis)" : (t.envio ? "$" + formatoPesos(t.envio) : "Gratis")}</p>
    <p class="total-carrito">Total: $${formatoPesos(t.total)}</p>`;
}

function confirmarCompra() {
  const t = totalesFinales();
  const nombre = document.getElementById("cli-nombre").value.trim();
  const email = document.getElementById("cli-email").value.trim();
  const nro = "ES-" + Date.now().toString().slice(-6);
  // Acá más adelante se puede enviar el pedido a un servidor / WhatsApp / email.
  document.getElementById("confirmacion-detalle").innerHTML =
    `Pedido <strong>${nro}</strong><br>${nombre}, te enviamos el detalle a ${email}.<br>` +
    `Total: <strong>$${formatoPesos(t.total)}</strong> (${t.pago === "transferencia" ? "transferencia bancaria" : "tarjeta"}).` +
    (t.pago === "transferencia" ? "<br><small>Te pasaremos los datos bancarios por email.</small>" : "");
  irAPaso(4);
}

function finalizarYCerrar() {
  carrito = [];
  envioActual = null;
  document.getElementById("cart-count").textContent = 0;
  document.getElementById("input-cp").value = "";
  document.getElementById("resultado-envio").textContent = "";
  cerrarCarrito();
}









function toggleChatbot() {
  const container = document.getElementById('chatbot-container');
  if (container) {
    container.classList.toggle('chatbot-oculto');
  }
}


function evaluarEnter(e) {
  if (e.key === 'Enter') {
    enviarMensajeChatbot();
  }
}


async function enviarMensajeChatbot() {
  const input = document.getElementById('chatbot-input');
  const messagesContainer = document.getElementById('chatbot-messages');
  const texto = input.value.trim();

  if (!texto) return;

  
  const userDiv = document.createElement('div');
  userDiv.className = 'mensaje usuario';
  userDiv.textContent = texto;
  messagesContainer.appendChild(userDiv);

  input.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  
  const botDiv = document.createElement('div');
  botDiv.className = 'mensaje bot';
  botDiv.textContent = 'Escribiendo...';
  messagesContainer.appendChild(botDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  
  try {
    const respuestaIA = await obtenerRespuestaIA(texto);
    botDiv.textContent = respuestaIA;
  } catch (error) {
    botDiv.textContent = 'Lo siento, ocurrió un error inesperado. Por favor intentá de nuevo.';
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


async function obtenerRespuestaIA(mensajeUsuario) {
  const API_KEY = "AQ.Ab8RN6JnXYT7IlT9n017XmUVM0Ac-jkcIMz732TVm6u93GzWyQ"; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  const promptConContexto = `
  Sos la asesora de moda virtual de ESSENCE. Responde en español de forma súper amigable, humana y en 2 oraciones máximo.
  Catálogo: vestidos de noche, blazers, camisas de satén/lino, tops, jeans, sweaters (Dana, Carla), pantalones palazzo. Colores: negro, blanco, beige, celeste, rosa.

  Consulta del cliente: "${mensajeUsuario}"
  `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptConContexto }] }]
      })
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      return responderRespaldoAvanzado(mensajeUsuario);
    }
  } catch (error) {
    return responderRespaldoAvanzado(mensajeUsuario);
  }
}


function responderRespaldoAvanzado(mensaje) {
  const msg = mensaje.toLowerCase().trim();

  // FIESTA / NOCHE / SALIR
  if (msg.includes("fiesta") || msg.includes("noche") || msg.includes("salir") || msg.includes("evento")) {
    return "Para una fiesta te súper recomiendo un vestido entallado o combinar nuestro blazer con una camisa de satén y pantalón de vestir. ¡Un look elegante e increíble!";
  }

  // TONOS / COLORES
  if (msg.includes("tono") || msg.includes("color") || msg.includes("colores")) {
    return "Trabajamos tonos clásicos y neutros como negro, blanco y beige, además de celeste, rosa y verde oliva en la colección de temporada.";
  }

  // NEGRO LIVIANO / FRESCO
  if (msg.includes("negro") && (msg.includes("no abrigad") || msg.includes("fresc") || msg.includes("livian"))) {
    return "En color negro y bien liviano tenemos remeras básicas de algodón, tops sin mangas y pantalones palazzo sueltos. Súper frescos y cómodos.";
  }

  // CORTAS / LARGAS
  if (msg.includes("corta") || msg.includes("corto") || msg.includes("short") || msg.includes("top")) {
    return "Si te gustan las prendas cortas, tenemos tops de algodón, shorts de vestir y faldas en tonos rosa, celeste, blanco y negro.";
  }

  // ELEGANTE
  if (msg.includes("elegante") || msg.includes("formal")) {
    return "Para algo elegante podés elegir un blazer entallado con pantalón de vestir o una camisa de satén en tono negro o beige.";
  }

  // CASUAL
  if (msg.includes("casual") || msg.includes("urbano") || msg.includes("dia a dia")) {
    return "Para un estilo casual te sugiero un jean clásico combinado con una remera básica de algodón o un sweater liviano de la colección.";
  }

  // CAMPO / CALOR
  if (msg.includes("campo") || msg.includes("fresca") || msg.includes("fresco") || msg.includes("calor")) {
    return "Para un día al aire libre o de campo te recomiendo un vestido suelto de lino o una camisa oversize. ¡Bien frescos y cómodos!";
  }

  // SALUDOS
  if (msg.includes("hola") || msg.includes("buenas") || msg.includes("buen dia")) {
    return "¡Hola! ¿Cómo estás? Contame qué estilo o prenda estás buscando y te asesoro.";
  }

  // Si no coincide con nada, da una respuesta coherente en vez de asumir "tonos"
  return "¡Buenísimo! Contame un poco más sobre la ocasión o el color que tenés en mente y te sugiero las mejores opciones de ESSENCE.";
}



document.addEventListener("DOMContentLoaded", () => {
  
  const tarjetas = document.querySelectorAll(".producto-card, .oferta-card");

  tarjetas.forEach((tarjeta) => {
    const img = tarjeta.querySelector("img");
    const tituloEl = tarjeta.querySelector("h3, .oferta-titulo");
    
    if (img && tituloEl && !tarjeta.querySelector(".btn-info")) {
      const nombreProducto = tituloEl.textContent.trim();
      
      
      const contenedor = document.createElement("div");
      contenedor.className = "imagen-contenedor";
      
      
      img.parentNode.insertBefore(contenedor, img);
      contenedor.appendChild(img);

      
      const btnInfo = document.createElement("button");
      btnInfo.className = "btn-info";
      btnInfo.type = "button";
      btnInfo.textContent = "!";
      btnInfo.onclick = function() { toggleDescripcion(this); };
      contenedor.appendChild(btnInfo);

      
      const popover = document.createElement("div");
      popover.className = "descripcion-popover";
      popover.textContent = `Prenda exclusiva de la colección ESSENCE: ${nombreProducto}. Diseñada con materiales de alta calidad para brindar comodidad y elegancia en cada ocasión.`;
      contenedor.appendChild(popover);
    }
  });
});

function toggleDescripcion(boton) {
  const contenedor = boton.parentElement;
  const descripcion = contenedor.querySelector('.descripcion-popover');
  
  if (descripcion) {
    descripcion.classList.toggle('activa');
  }
}