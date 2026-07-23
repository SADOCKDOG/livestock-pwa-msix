/**
 * Livestock Manager - ImportadorRFIDView v1.0.0
 * UI de importación masiva de Excel (lectores RFID / LiveStock legacy).
 * Motor: js/importador-rfid.js
 */
const ImportadorRFIDView = {
  _headers: null,
  _filas: null,
  _tipoDetectado: null,
  _tipoSeleccionado: null,
  _resultado: null,

  async render() {
    if (window.App) App.updateHeaderColor('importar-rfid');
    this._headers = null;
    this._filas = null;
    this._tipoDetectado = null;
    this._tipoSeleccionado = null;
    this._resultado = null;
    this._renderMain();
  },

  _renderMain() {
    const main = document.getElementById('app-content');
    if (!main) return;

    let html = `<div class="mb-20"><h2 class="mt-10 font-900 uppercase tracking-wider"><span style="color: var(--neon);">|</span> ${Icons.importar()} IMPORTAR EXCEL (RFID)</h2></div>`;

    html += `
      <div class="card p-14 mb-16" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <p class="text-[0.65rem] text-aaa mb-15 uppercase font-800">
          Importa pesadas, producción de leche, tratamientos sanitarios o partos desde un Excel
          exportado por un lector RFID (UniTransfer/Rumisoft) o por el software LiveStock.
          Los animales deben estar dados de alta previamente con su crotal.
        </p>
        <input type="file" id="rfid-import-file" accept=".xlsx,.xls,.csv" class="d-none" onchange="ImportadorRFIDView._onArchivoSeleccionado(event)">
        <button class="widget-link-btn widget-link-btn--neon neon-info w-full" onclick="document.getElementById('rfid-import-file').click()">
          ${Icons.adjuntar()} <span class="widget-link-label">Seleccionar archivo Excel</span>
        </button>
      </div>
      <div id="rfid-import-detalle"></div>
    `;

    main.innerHTML = html;
  },

  async _onArchivoSeleccionado(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;
    const detalle = document.getElementById('rfid-import-detalle');
    detalle.innerHTML = `<div class="empty-state"><p class="empty-state-text">Analizando archivo…</p></div>`;

    try {
      const { headers, filas } = await window.ImportadorRFID.leerExcel(archivo);
      this._headers = headers;
      this._filas = filas;
      const deteccion = window.ImportadorRFID.detectarTipo(headers);
      this._tipoDetectado = deteccion;
      this._tipoSeleccionado = deteccion.ambiguo ? null : deteccion.tipo;
      this._renderDeteccion();
    } catch (e) {
      detalle.innerHTML = `<div class="empty-state"><p class="empty-state-text">${(e?.message || e).toString()}</p></div>`;
    }
  },

  _renderDeteccion() {
    const detalle = document.getElementById('rfid-import-detalle');
    if (!detalle) return;
    const tipos = window.ImportadorRFID.TIPOS;

    let html = `
      <div class="card p-14 mb-16" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="section-header-theme mb-12 font-900 uppercase tracking-wider text-[0.7rem] text-gray"><span style="color: var(--c-info); margin-right: 4px;">|</span> ${Icons.info()} ARCHIVO DETECTADO</div>
        <div class="text-[0.65rem] text-aaa uppercase font-800 mb-10">${this._filas.length} fila(s) de datos encontradas.</div>
    `;

    if (this._tipoDetectado.ambiguo) {
      html += `<p class="text-[0.65rem] text-aaa uppercase font-800 mb-10">No se pudo detectar automáticamente el tipo de importación. Selecciónalo manualmente:</p>`;
    } else {
      html += `<p class="text-[0.7rem] text-white uppercase font-900 mb-10">Tipo detectado: ${tipos[this._tipoDetectado.tipo].label}</p>`;
    }

    html += `<div class="wizard-input-group mb-12">
      <label class="wizard-label">TIPO DE IMPORTACIÓN</label>
      <select id="rfid-import-tipo" class="wizard-input font-800" onchange="ImportadorRFIDView._tipoSeleccionado = this.value">
        <option value="">— Selecciona —</option>
        ${Object.entries(tipos).map(([id, def]) => `<option value="${id}" ${this._tipoSeleccionado === id ? 'selected' : ''}>${def.label}</option>`).join('')}
      </select>
    </div>`;

    html += `<button class="widget-link-btn widget-link-btn--neon neon-success w-full" onclick="ImportadorRFIDView._iniciarImportacion()">
      ${Icons.check()} <span class="widget-link-label">Importar</span>
    </button>`;

    html += `<div id="rfid-import-progreso" class="mt-15"></div></div>`;

    detalle.innerHTML = html;
  },

  async _iniciarImportacion() {
    const select = document.getElementById('rfid-import-tipo');
    const tipo = select ? select.value : this._tipoSeleccionado;
    if (!tipo) {
      App.toastError('Selecciona el tipo de importación');
      return;
    }

    const progreso = document.getElementById('rfid-import-progreso');
    progreso.innerHTML = `<div class="text-[0.65rem] text-aaa uppercase font-800">Importando 0 / ${this._filas.length}…</div>`;

    try {
      const resultado = await window.ImportadorRFID.procesarImportacion(tipo, this._headers, this._filas, {
        onProgreso: (actual, total) => {
          progreso.innerHTML = `<div class="text-[0.65rem] text-aaa uppercase font-800">Importando ${actual} / ${total}…</div>`;
        },
      });
      this._resultado = resultado;
      this._renderResultado();
      if (window.EventBus) window.EventBus.emit('dashboard:refresh');
    } catch (e) {
      App.toastError(e?.message || 'Error al importar');
    }
  },

  _renderResultado() {
    const progreso = document.getElementById('rfid-import-progreso');
    if (!progreso || !this._resultado) return;
    const { total, ok, errores } = this._resultado;

    let html = `
      <div class="p-12 rounded-sm border border-222 bg-black mt-10">
        <div class="text-[0.7rem] font-900 uppercase mb-6" style="color: ${errores.length ? 'var(--c-warning)' : 'var(--c-success)'};">
          ${ok} / ${total} registros importados
        </div>
    `;

    if (errores.length > 0) {
      html += `<div class="text-[0.6rem] text-aaa uppercase font-800 mb-6">${errores.length} fila(s) con error:</div>`;
      html += `<div class="flex flex-col gap-4" style="max-height: 240px; overflow-y: auto;">`;
      errores.slice(0, 100).forEach((e) => {
        html += `<div class="text-[0.6rem] text-danger">Fila ${e.fila}: ${e.mensaje}</div>`;
      });
      if (errores.length > 100) {
        html += `<div class="text-[0.6rem] text-aaa">… y ${errores.length - 100} más.</div>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
    progreso.innerHTML = html;
  },
};

window.ImportadorRFIDView = ImportadorRFIDView;
