/**
 * Livestock Manager - SoporteView v1.0.0
 *
 * Formulario de nueva incidencia en dos pasos:
 *   1. El usuario describe el problema con sus palabras.
 *   2. La IA lo estructura y el usuario REVISA Y CONFIRMA su propio reporte.
 *
 * Ese segundo paso no es un tramite: nada se registra hasta que la persona que
 * reporta da el visto bueno. El mantenedor no aprueba nada.
 *
 * El soporte requiere licencia activa e internet. La app sigue siendo gratuita
 * y offline-first; esto es un modulo aparte.
 */

const SoporteView = {
  _paso: 'formulario', // formulario | borrador | enviado
  _borrador: null,
  _enviando: false,

  async render() {
    const main = document.getElementById('app-content');

    if (!window.SupportAPI) {
      main.innerHTML = this._aviso('El módulo de soporte no está disponible.');
      return;
    }

    // Sin licencia no se entra al formulario: el reporte cuesta dinero (IA).
    if (!window.SupportAPI.tieneSesion() || !window.SupportAPI.licenciaActiva()) {
      main.innerHTML = this._pantallaLicencia();
      return;
    }

    if (this._paso === 'borrador' && this._borrador) {
      main.innerHTML = this._pantallaBorrador();
      return;
    }
    if (this._paso === 'enviado') {
      main.innerHTML = this._pantallaEnviado();
      return;
    }
    main.innerHTML = this._pantallaFormulario();
  },

  // --- Pantallas ------------------------------------------------------------

  _pantallaLicencia() {
    return `
      <div class="card p-20 mt-10">
        <h2 class="section-title">Soporte técnico</h2>
        <p class="text-gray mt-10">
          El soporte con asistencia por IA es un servicio aparte de la aplicación.
          Con una licencia activa puedes reportar incidencias desde aquí y seguir
          su estado sin salir de la app.
        </p>
        <p class="text-gray mt-10">
          La aplicación seguirá siendo gratuita: solo el soporte requiere licencia.
        </p>
        <div class="erp-action-group mt-20">
          <button class="btn btn-primary" onclick="SoporteView._comprarLicencia()">
            Activar soporte
          </button>
          <button class="btn" onclick="SoporteView._restaurarLicencia()">
            Ya la tengo
          </button>
        </div>
      </div>`;
  },

  _pantallaFormulario() {
    return `
      <div class="card p-20 mt-10">
        <h2 class="section-title">Contar una incidencia</h2>
        <p class="text-gray mt-10">
          Explica qué ha pasado con tus palabras. No hace falta que uses términos
          técnicos: se ordenará automáticamente y podrás revisarlo antes de enviarlo.
        </p>
        <div class="form-group mt-20">
          <label class="form-label" for="soporte-descripcion">¿Qué ha ocurrido?</label>
          <textarea id="soporte-descripcion" class="form-input" rows="7"
            placeholder="Por ejemplo: al guardar un pesaje de un lote, la app se queda cargando y el peso no aparece luego en la ficha del animal."></textarea>
        </div>
        <div class="erp-action-group mt-10">
          <button class="btn btn-primary" id="soporte-btn-continuar"
            onclick="SoporteView._pedirBorrador()">Continuar</button>
          <button class="btn" onclick="location.hash='#/mis-incidencias'">
            Mis incidencias
          </button>
        </div>
      </div>`;
  },

  _pantallaBorrador() {
    const b = this._borrador;
    const pasos = (b.pasos_reproduccion || [])
      .map(
        (p, i) => `
        <div class="form-group">
          <label class="form-label">Paso ${i + 1}</label>
          <input class="form-input" data-paso="${i}" value="${this._escapar(p)}">
        </div>`,
      )
      .join('');

    return `
      <div class="card p-20 mt-10">
        <h2 class="section-title">Revisa tu incidencia</h2>
        <p class="text-gray mt-10">
          Esto es lo que se va a registrar. <strong>Corrige lo que no encaje</strong>
          antes de enviarlo: nada se envía hasta que lo confirmes.
        </p>

        <div class="form-group mt-20">
          <label class="form-label" for="borrador-titulo">Título</label>
          <input id="borrador-titulo" class="form-input" value="${this._escapar(b.titulo)}">
        </div>

        <div class="form-group">
          <label class="form-label" for="borrador-descripcion">Descripción</label>
          <textarea id="borrador-descripcion" class="form-input" rows="5">${this._escapar(b.descripcion)}</textarea>
        </div>

        ${pasos ? `<div class="mt-10">${pasos}</div>` : ''}

        <p class="text-gray text-sm mt-10">
          Se enviará también la versión de la app y el modelo del dispositivo,
          para poder reproducir el problema.
        </p>

        <div class="erp-action-group mt-20">
          <button class="btn btn-primary" id="soporte-btn-enviar"
            onclick="SoporteView._confirmar()">Enviar incidencia</button>
          <button class="btn" onclick="SoporteView._volverAlFormulario()">Volver</button>
        </div>
      </div>`;
  },

  _pantallaEnviado() {
    return `
      <div class="card p-20 mt-10 text-center">
        <h2 class="section-title">Incidencia enviada</h2>
        <p class="text-gray mt-10">
          Ya está registrada. Puedes seguir su estado en «Mis incidencias».
        </p>
        <div class="erp-action-group mt-20">
          <button class="btn btn-primary" onclick="location.hash='#/mis-incidencias'">
            Ver mis incidencias
          </button>
          <button class="btn" onclick="SoporteView._volverAlFormulario()">
            Contar otra
          </button>
        </div>
      </div>`;
  },

  _aviso(texto) {
    return `<div class="card p-20 mt-10"><p class="text-gray">${texto}</p></div>`;
  },

  // --- Acciones -------------------------------------------------------------

  async _pedirBorrador() {
    const campo = document.getElementById('soporte-descripcion');
    const texto = (campo && campo.value ? campo.value : '').trim();

    if (texto.length < 10) {
      App.toastError('Cuenta un poco más para poder ayudarte');
      return;
    }
    if (this._enviando) return;
    this._enviando = true;
    this._deshabilitar('soporte-btn-continuar', 'Preparando…');

    try {
      const datos = await window.SupportAPI.pedirBorrador(
        texto,
        window.SupportAPI.contextoActual(),
      );
      this._borrador = datos.borrador;
      this._paso = 'borrador';
      await this.render();
    } catch (e) {
      this._manejarError(e);
      this._deshabilitar('soporte-btn-continuar', 'Continuar', false);
    } finally {
      this._enviando = false;
    }
  },

  async _confirmar() {
    if (this._enviando || !this._borrador) return;

    // Se recogen las ediciones del usuario: manda lo que el ha revisado.
    const titulo = document.getElementById('borrador-titulo');
    const descripcion = document.getElementById('borrador-descripcion');
    if (titulo) this._borrador.titulo = titulo.value;
    if (descripcion) this._borrador.descripcion = descripcion.value;

    const pasos = Array.from(document.querySelectorAll('[data-paso]'))
      .map((i) => i.value.trim())
      .filter((p) => p.length);
    this._borrador.pasos_reproduccion = pasos;

    this._enviando = true;
    this._deshabilitar('soporte-btn-enviar', 'Enviando…');

    try {
      await window.SupportAPI.confirmarIncidencia(
        this._borrador,
        window.SupportAPI.contextoActual(),
      );
      this._paso = 'enviado';
      this._borrador = null;
      await this.render();
    } catch (e) {
      this._manejarError(e);
      this._deshabilitar('soporte-btn-enviar', 'Enviar incidencia', false);
    } finally {
      this._enviando = false;
    }
  },

  _volverAlFormulario() {
    this._paso = 'formulario';
    this._borrador = null;
    this.render();
  },

  /** Compra de la licencia de soporte. Android via Play; PWA pendiente. */
  async _comprarLicencia() {
    if (!window.PurchaseManager || !window.PurchaseManager.comprarSoporte) {
      App.toastError('La compra de soporte no está disponible en esta versión');
      return;
    }
    await window.PurchaseManager.comprarSoporte();
  },

  /** Revalida una compra existente (cambio de móvil, reinstalación). */
  async _restaurarLicencia() {
    if (!window.PurchaseManager || !window.PurchaseManager.restaurarSoporte) {
      App.toastError('No se puede restaurar la licencia en esta versión');
      return;
    }
    await window.PurchaseManager.restaurarSoporte();
    await this.render();
  },

  // --- Auxiliares -----------------------------------------------------------

  _manejarError(e) {
    if (e && e.codigo === 'LIMITE_DIARIO') {
      App.toastError('Has alcanzado el límite de incidencias por hoy');
      return;
    }
    if (e && (e.codigo === 'LICENCIA_INACTIVA' || e.codigo === 'LICENCIA_CADUCADA')) {
      this._paso = 'formulario';
      this.render();
      App.toastError('Tu licencia de soporte no está activa');
      return;
    }
    App.toastError((e && e.message) || 'No se pudo completar la operación');
  },

  _deshabilitar(id, texto, deshabilitar = true) {
    const b = document.getElementById(id);
    if (!b) return;
    b.disabled = deshabilitar;
    b.textContent = texto;
  },

  _escapar(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

window.SoporteView = SoporteView;
