/* =========================================================
   ESSENCE · Cuentas de usuario + opiniones con estrellas
   ---------------------------------------------------------
   Cómo funciona hoy:
   - Las cuentas y las opiniones se guardan en el navegador
     (localStorage). Cada persona ve las opiniones que se
     guardaron en SU navegador.
   - Las contraseñas no se guardan en texto plano (se guardan
     "hasheadas" con una sal), pero al no haber servidor esto
     es una versión de demostración, no seguridad real.

   Para que las opiniones las vea TODO el mundo, hay que
   conectar un servidor (por ejemplo Firebase). Las funciones
   leer() y guardar() de acá abajo son los únicos lugares que
   tocan los datos: se cambian ahí y el resto sigue igual.
   ========================================================= */
(function () {
  'use strict';

  const KEY_USUARIOS = 'essence_usuarios';
  const KEY_OPINIONES = 'essence_opiniones';
  const KEY_SESION = 'essence_sesion';
  const POR_PAGINA = 5;
  const TEXTOS_PUNTAJE = ['', 'Mala', 'Regular', 'Buena', 'Muy buena', '¡Excelente!'];
  const COLORES_AVATAR = ['#8c7265', '#b08d7a', '#6f7f73', '#9a8aa0', '#c0946a', '#7d8a99'];

  /* ---------- Almacenamiento ---------- */
  const respaldo = {}; // por si el navegador bloquea localStorage

  function leer(clave, defecto) {
    try {
      const raw = localStorage.getItem(clave);
      return raw ? JSON.parse(raw) : defecto;
    } catch (e) {
      return clave in respaldo ? respaldo[clave] : defecto;
    }
  }

  function guardar(clave, valor) {
    respaldo[clave] = valor;
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin persistencia */ }
  }

  /* ---------- Estado ---------- */
  let usuarios = leer(KEY_USUARIOS, []);
  let opiniones = leer(KEY_OPINIONES, []);
  let sesionId = leer(KEY_SESION, null);
  let orden = 'recientes';
  let filtro = 0;
  let visibles = POR_PAGINA;
  let editando = false;
  let intentosFallidos = 0;
  let bloqueadoHasta = 0;
  let ultimoFoco = null;

  /* ---------- Utilidades ---------- */
  const $ = (id) => document.getElementById(id);

  // Crea elementos sin usar innerHTML: el texto de los usuarios nunca se interpreta como HTML.
  function el(tag, props = {}, ...hijos) {
    const nodo = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') nodo.className = v;
      else if (k === 'text') nodo.textContent = v;
      else if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
      else nodo.setAttribute(k, v === true ? '' : v);
    }
    hijos.flat().forEach((h) => { if (h != null) nodo.append(h); });
    return nodo;
  }

  const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

  function estrellas(valor, grande) {
    const s = el('span', {
      class: 'estrellas' + (grande ? ' grande' : ''),
      role: 'img',
      'aria-label': fmt(valor) + ' de 5 estrellas',
      text: '★★★★★'
    });
    s.style.setProperty('--rating', String(valor));
    return s;
  }

  function fechaTexto(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function colorAvatar(texto) {
    let h = 0;
    for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return COLORES_AVATAR[h % COLORES_AVATAR.length];
  }

  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function aHex(bytes) {
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function nuevaSal() {
    const a = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return aHex(a);
  }

  async function hashClave(clave, sal) {
    if (window.crypto && crypto.subtle) {
      const enc = new TextEncoder();
      const base = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(sal), iterations: 100000, hash: 'SHA-256' }, base, 256);
      return aHex(bits);
    }
    // Respaldo muy simple para navegadores sin crypto.subtle
    let h = 5381;
    const s = sal + clave;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return 'f' + (h >>> 0).toString(16);
  }

  let toastTimer;
  function toast(mensaje) {
    let t = $('toast');
    if (!t) {
      t = el('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
      document.body.append(t);
    }
    t.textContent = mensaje;
    // forzar reflow para que la animación se repita
    void t.offsetWidth;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 3200);
  }

  /* ---------- Sesión ---------- */
  function usuarioActual() {
    return usuarios.find((u) => u.id === sesionId) || null;
  }

  function opinionDe(usuario) {
    return usuario ? opiniones.find((o) => o.userId === usuario.id) || null : null;
  }

  function iniciarSesion(usuario, mensaje) {
    sesionId = usuario.id;
    guardar(KEY_SESION, sesionId);
    editando = false;
    cerrarAuth();
    renderTodo();
    if (mensaje) toast(mensaje);
  }

  function cerrarSesion() {
    sesionId = null;
    guardar(KEY_SESION, null);
    editando = false;
    cerrarMenu();
    renderTodo();
    toast('Cerraste sesión. ¡Hasta pronto!');
  }

  /* ---------- Menú de cuenta (barra superior) ---------- */
  function cerrarMenu() {
    $('cuenta-menu').hidden = true;
    $('btn-cuenta').setAttribute('aria-expanded', 'false');
  }

  function renderCuenta() {
    const u = usuarioActual();
    $('cuenta-nombre').textContent = u ? u.nombre : 'Ingresar';
    $('cuenta-menu-nombre').textContent = u ? u.nombre : '';
    if (!u) cerrarMenu();
  }

  /* ---------- Modal de login / registro ---------- */
  function abrirAuth(pestania, motivo) {
    ultimoFoco = document.activeElement;
    elegirPestania(pestania || 'login');
    $('auth-sub').textContent = motivo || 'Ingresá a tu cuenta o creá una para dejar tu opinión.';
    $('modal-auth').style.display = 'block';
    setTimeout(() => {
      const primero = pestania === 'registro' ? $('reg-usuario') : $('login-ident');
      primero.focus();
    }, 30);
  }

  function cerrarAuth() {
    $('modal-auth').style.display = 'none';
    ['form-login', 'form-registro'].forEach((id) => $(id).reset());
    ['error-login', 'error-registro'].forEach((id) => { $(id).textContent = ''; });
    document.querySelectorAll('.btn-ver-clave').forEach((b) => {
      b.textContent = 'Mostrar';
      $(b.dataset.target).type = 'password';
    });
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function elegirPestania(cual) {
    const login = cual === 'login';
    $('form-login').hidden = !login;
    $('form-registro').hidden = login;
    $('tab-login').setAttribute('aria-selected', String(login));
    $('tab-registro').setAttribute('aria-selected', String(!login));
    $('auth-titulo').textContent = login ? 'Bienvenida' : 'Creá tu cuenta';
  }

  async function onLogin(e) {
    e.preventDefault();
    const err = $('error-login');
    err.textContent = '';
    const ident = $('login-ident').value.trim().toLowerCase();
    const clave = $('login-clave').value;

    if (!ident || !clave) { err.textContent = 'Completá tu usuario o email y tu contraseña.'; return; }
    if (Date.now() < bloqueadoHasta) { err.textContent = 'Demasiados intentos. Probá de nuevo en unos segundos.'; return; }

    const u = usuarios.find((x) => x.email === ident || x.nombre.toLowerCase() === ident);
    const ok = u && (await hashClave(clave, u.salt)) === u.hash;
    if (!ok) {
      intentosFallidos++;
      if (intentosFallidos >= 5) { bloqueadoHasta = Date.now() + 30000; intentosFallidos = 0; }
      err.textContent = 'Usuario o contraseña incorrectos.';
      return;
    }
    intentosFallidos = 0;
    iniciarSesion(u, '¡Hola de nuevo, ' + u.nombre + '!');
  }

  async function onRegistro(e) {
    e.preventDefault();
    const err = $('error-registro');
    err.textContent = '';
    const nombre = $('reg-usuario').value.trim();
    const email = $('reg-email').value.trim().toLowerCase();
    const clave = $('reg-clave').value;
    const clave2 = $('reg-clave2').value;

    if (!/^[A-Za-z0-9._]{3,20}$/.test(nombre)) { err.textContent = 'El usuario debe tener entre 3 y 20 caracteres (letras, números, punto o guion bajo).'; return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Ingresá un email válido.'; return; }
    if (clave.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
    if (clave !== clave2) { err.textContent = 'Las contraseñas no coinciden.'; return; }
    if (usuarios.some((u) => u.nombre.toLowerCase() === nombre.toLowerCase())) { err.textContent = 'Ese nombre de usuario ya está en uso.'; return; }
    if (usuarios.some((u) => u.email === email)) { err.textContent = 'Ya existe una cuenta con ese email.'; return; }

    const sal = nuevaSal();
    const usuario = { id: nuevoId(), nombre, email, salt: sal, hash: await hashClave(clave, sal), creado: new Date().toISOString() };
    usuarios.push(usuario);
    guardar(KEY_USUARIOS, usuarios);
    iniciarSesion(usuario, '¡Bienvenida a ESSENCE, ' + nombre + '!');
  }

  /* ---------- Resumen de puntuaciones ---------- */
  function renderResumen() {
    const total = opiniones.length;
    const cuenta = [0, 0, 0, 0, 0, 0];
    let suma = 0;
    opiniones.forEach((o) => { cuenta[o.estrellas]++; suma += o.estrellas; });
    const promedio = total ? suma / total : 0;

    const filas = [5, 4, 3, 2, 1].map((n) => {
      const pct = total ? (cuenta[n] / total) * 100 : 0;
      const barra = el('span', { class: 'dist-barra' }, el('span'));
      barra.firstChild.style.width = pct + '%';
      return el('button', {
        type: 'button', class: 'dist-fila', 'aria-pressed': String(filtro === n),
        'aria-label': 'Filtrar opiniones de ' + n + ' estrellas (' + cuenta[n] + ')',
        onclick: () => { filtro = filtro === n ? 0 : n; visibles = POR_PAGINA; renderResumen(); renderLista(); }
      }, el('span', { class: 'dist-n', text: n + ' ★' }), barra, el('span', { class: 'dist-c', text: String(cuenta[n]) }));
    });

    $('resumen-opiniones').replaceChildren(
      el('div', { class: 'resumen-promedio' },
        el('div', { class: 'resumen-numero', text: total ? promedio.toFixed(1).replace('.', ',') : '–' }),
        estrellas(promedio, true),
        el('div', { class: 'resumen-total', text: total ? total + (total === 1 ? ' opinión' : ' opiniones') : 'Todavía no hay opiniones' })),
      el('div', { class: 'dist' }, filas)
    );
  }

  /* ---------- Formulario ---------- */
  function renderForm() {
    const u = usuarioActual();
    const propia = opinionDe(u);
    $('form-invitada').hidden = !!u;
    $('opinion-hecha').hidden = !(u && propia && !editando);
    $('form-opinion').hidden = !(u && (!propia || editando));
    $('op-nombre-preview').textContent = u ? '(' + u.nombre + ')' : '';
    $('form-titulo').textContent = editando ? 'Editá tu opinión' : 'Dejá tu opinión';
    $('btn-publicar').textContent = editando ? 'Guardar cambios' : 'Publicar opinión';
    $('btn-cancelar-edicion').hidden = !editando;
  }

  function limpiarForm() {
    $('form-opinion').reset();
    $('op-contador').textContent = '0';
    $('puntaje-texto').textContent = '';
    $('error-opinion').textContent = '';
  }

  function entrarEdicion() {
    const propia = opinionDe(usuarioActual());
    if (!propia) return;
    editando = true;
    renderForm();
    limpiarForm();
    document.querySelector('input[name="puntaje"][value="' + propia.estrellas + '"]').checked = true;
    $('puntaje-texto').textContent = TEXTOS_PUNTAJE[propia.estrellas];
    $('op-comentario').value = propia.comentario;
    $('op-contador').textContent = String(propia.comentario.length);
    document.querySelector('input[name="visibilidad"][value="' + (propia.anonimo ? 'anonimo' : 'usuario') + '"]').checked = true;
    irAlFormulario();
    $('op-comentario').focus();
  }

  function irAlFormulario() {
    $('bloque-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function onPublicar(e) {
    e.preventDefault();
    const err = $('error-opinion');
    err.textContent = '';
    const u = usuarioActual();
    if (!u) { abrirAuth('login', 'Iniciá sesión para publicar tu opinión.'); return; }

    const marcada = document.querySelector('input[name="puntaje"]:checked');
    const puntaje = marcada ? Number(marcada.value) : 0;
    const texto = $('op-comentario').value.trim();
    const anonimo = document.querySelector('input[name="visibilidad"]:checked').value === 'anonimo';

    if (!puntaje) { err.textContent = 'Elegí cuántas estrellas le das a ESSENCE.'; return; }
    if (texto.length < 10) { err.textContent = 'Contanos un poco más: el comentario debe tener al menos 10 caracteres.'; return; }

    const existente = opinionDe(u);
    const datos = { estrellas: puntaje, comentario: texto, anonimo, nombre: anonimo ? null : u.nombre };
    if (existente) {
      Object.assign(existente, datos, { editada: new Date().toISOString() });
    } else {
      opiniones.push({ id: nuevoId(), userId: u.id, fecha: new Date().toISOString(), ...datos });
    }
    guardar(KEY_OPINIONES, opiniones);

    const fueEdicion = editando;
    editando = false;
    limpiarForm();
    visibles = Math.max(visibles, POR_PAGINA);
    renderTodo();
    toast(fueEdicion ? 'Tu opinión se actualizó ✨' : '¡Gracias por tu opinión! 🤍');
    $('conteo-opiniones').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function eliminarOpinion(id) {
    opiniones = opiniones.filter((o) => o.id !== id);
    guardar(KEY_OPINIONES, opiniones);
    editando = false;
    renderTodo();
    toast('Eliminaste tu opinión.');
  }

  /* ---------- Lista de opiniones ---------- */
  function tarjetaOpinion(o) {
    const u = usuarioActual();
    const propia = !!u && o.userId === u.id;
    const autor = usuarios.find((x) => x.id === o.userId);
    const nombre = o.anonimo ? 'Anónimo' : (autor ? autor.nombre : (o.nombre || 'Usuario'));

    const avatar = el('div', { class: 'opinion-avatar', 'aria-hidden': 'true', text: o.anonimo ? '?' : nombre.charAt(0).toUpperCase() });
    avatar.style.background = o.anonimo ? '#c9bfb7' : colorAvatar(nombre);

    const acciones = propia ? el('div', { class: 'opinion-acciones' }, accionesPropias(o)) : null;
    const editada = o.editada ? el('span', { class: 'opinion-editada', text: '· editada' }) : null;

    return el('article', { class: 'opinion' + (propia ? ' propia' : '') },
      avatar,
      el('div', { class: 'opinion-cuerpo' },
        el('div', { class: 'opinion-cabecera' },
          el('span', { class: 'opinion-nombre' + (o.anonimo ? ' anonimo' : ''), text: nombre }),
          propia ? el('span', { class: 'chip-propia', text: 'Tu opinión' }) : null,
          el('time', { datetime: o.fecha, text: fechaTexto(o.fecha) }, editada ? ' ' : null, editada)),
        estrellas(o.estrellas),
        el('p', { class: 'opinion-texto', text: o.comentario }),
        acciones));
  }

  function accionesPropias(o) {
    const bEditar = el('button', { type: 'button', class: 'link-btn', text: 'Editar', onclick: entrarEdicion });
    const bEliminar = el('button', { type: 'button', class: 'link-btn peligro', text: 'Eliminar' });
    let armado = false;
    let t;
    bEliminar.addEventListener('click', () => {
      if (!armado) {
        armado = true;
        bEliminar.textContent = '¿Seguro? Tocá de nuevo para eliminar';
        t = setTimeout(() => { armado = false; bEliminar.textContent = 'Eliminar'; }, 4000);
        return;
      }
      clearTimeout(t);
      eliminarOpinion(o.id);
    });
    return [bEditar, bEliminar];
  }

  function renderLista() {
    let lista = opiniones.slice();
    if (filtro) lista = lista.filter((o) => o.estrellas === filtro);
    const porFecha = (a, b) => new Date(b.fecha) - new Date(a.fecha);
    if (orden === 'mejores') lista.sort((a, b) => b.estrellas - a.estrellas || porFecha(a, b));
    else if (orden === 'peores') lista.sort((a, b) => a.estrellas - b.estrellas || porFecha(a, b));
    else lista.sort(porFecha);

    $('conteo-opiniones').textContent = opiniones.length
      ? lista.length + (lista.length === 1 ? ' opinión' : ' opiniones')
      : '';
    $('orden-opiniones').closest('label').hidden = opiniones.length < 2;
    $('btn-quitar-filtro').hidden = !filtro;
    if (filtro) $('btn-quitar-filtro').textContent = filtro + ' ★  ✕  Quitar filtro';

    const cont = $('lista-opiniones');
    if (!opiniones.length) {
      cont.replaceChildren(el('div', { class: 'vacio' },
        el('div', { class: 'icono', 'aria-hidden': 'true', text: '💬' }),
        el('p', { text: 'Todavía no hay opiniones. ¡Sé la primera en dejar la tuya!' })));
    } else if (!lista.length) {
      cont.replaceChildren(el('div', { class: 'vacio' },
        el('p', { text: 'No hay opiniones de ' + filtro + (filtro === 1 ? ' estrella.' : ' estrellas.') })));
    } else {
      cont.replaceChildren(...lista.slice(0, visibles).map(tarjetaOpinion));
    }
    $('btn-ver-mas').hidden = lista.length <= visibles;
  }

  function renderTodo() {
    renderCuenta();
    renderResumen();
    renderForm();
    renderLista();
  }

  /* ---------- Eventos ---------- */
  function atraparTab(e) {
    if (e.key !== 'Tab') return;
    const modal = $('modal-auth');
    if (modal.style.display !== 'block') return;
    const foco = Array.from(modal.querySelectorAll('button, input, select, textarea, [href]'))
      .filter((n) => !n.disabled && n.offsetParent !== null);
    if (!foco.length) return;
    const primero = foco[0];
    const ultimo = foco[foco.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  function iniciar() {
    // Cuenta
    $('btn-cuenta').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!usuarioActual()) { abrirAuth('login'); return; }
      const abrir = $('cuenta-menu').hidden;
      $('cuenta-menu').hidden = !abrir;
      $('btn-cuenta').setAttribute('aria-expanded', String(abrir));
    });
    $('menu-salir').addEventListener('click', cerrarSesion);
    $('menu-opinion').addEventListener('click', () => {
      cerrarMenu();
      if (opinionDe(usuarioActual())) entrarEdicion(); else irAlFormulario();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.cuenta-wrap')) cerrarMenu();
    });

    // Modal
    $('auth-cerrar').addEventListener('click', cerrarAuth);
    $('tab-login').addEventListener('click', () => elegirPestania('login'));
    $('tab-registro').addEventListener('click', () => elegirPestania('registro'));
    document.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => elegirPestania(b.dataset.ir)));
    $('form-login').addEventListener('submit', onLogin);
    $('form-registro').addEventListener('submit', onRegistro);
    document.querySelectorAll('.btn-ver-clave').forEach((b) => b.addEventListener('click', () => {
      const campo = $(b.dataset.target);
      const mostrar = campo.type === 'password';
      campo.type = mostrar ? 'text' : 'password';
      b.textContent = mostrar ? 'Ocultar' : 'Mostrar';
    }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { cerrarMenu(); if ($('modal-auth').style.display === 'block') cerrarAuth(); }
      atraparTab(e);
    });

    // Formulario de opinión
    $('btn-invitada-login').addEventListener('click', () => abrirAuth('login', 'Iniciá sesión para dejar tu opinión.'));
    $('btn-invitada-registro').addEventListener('click', () => abrirAuth('registro', 'Creá tu cuenta en un minuto y dejá tu opinión.'));
    $('btn-editar-mia').addEventListener('click', entrarEdicion);
    $('btn-cancelar-edicion').addEventListener('click', () => { editando = false; limpiarForm(); renderForm(); });
    $('form-opinion').addEventListener('submit', onPublicar);
    $('op-comentario').addEventListener('input', (e) => { $('op-contador').textContent = String(e.target.value.length); });
    document.querySelectorAll('input[name="puntaje"]').forEach((r) => r.addEventListener('change', () => {
      $('puntaje-texto').textContent = TEXTOS_PUNTAJE[Number(r.value)];
      $('error-opinion').textContent = '';
    }));

    // Lista
    $('orden-opiniones').addEventListener('change', (e) => { orden = e.target.value; renderLista(); });
    $('btn-quitar-filtro').addEventListener('click', () => { filtro = 0; visibles = POR_PAGINA; renderResumen(); renderLista(); });
    $('btn-ver-mas').addEventListener('click', () => { visibles += POR_PAGINA; renderLista(); });

    // Si se cambian datos en otra pestaña, se actualiza esta
    window.addEventListener('storage', () => {
      usuarios = leer(KEY_USUARIOS, []);
      opiniones = leer(KEY_OPINIONES, []);
      sesionId = leer(KEY_SESION, null);
      renderTodo();
    });

    renderTodo();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
