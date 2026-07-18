/**
 * Livestock Manager - ConfigSistemaView v1.0.0
 * Módulo integral de Configuración del Sistema, Seguridad y Auditoría.
 * Integra Interfaz, Backups, Información Técnica y Registros de Actividad.
 */

const ConfigSistemaView = {
  _currentTab: 'interfaz', // 'interfaz', 'seguridad', 'auditoria'

  async render(params) {
    if (window.App) App.updateHeaderColor('ajustes');
    const main = document.getElementById("app-content");
    const config = await AjustesView._loadConfig();
    const tab = params?.get?.('tab') || this._currentTab;
    this._currentTab = tab;

    main.innerHTML = `
      <div class="p-16">
        <div class="mb-20">
          <a href="#/ajustes" class="link-back">← Volver a Ajustes</a>
          <h2 class="mt-10 flex items-center gap-10 text-white font-900 uppercase">
            <span style="color: var(--p-gold); margin-right: 4px;">|</span> ${Icons.ajustes()} Sistema y Seguridad
          </h2>
          <p class="text-gray text-sm leading-relaxed">Gestión integral de la plataforma: apariencia, integridad de datos y registros de auditoría.</p>
        </div>
 
        <!-- TABS DE NAVEGACIÓN INTERNA -->
        <div class="mb-14">
          <div class="tabs-scroll prod-tabs scroll-shadow-container">
            <button class="prod-tab ${tab === 'interfaz' ? 'active' : ''}" onclick="ConfigSistemaView._cambiarTab('interfaz')">${Icons.foto()} INTERFAZ</button>
            <button class="prod-tab ${tab === 'seguridad' ? 'active' : ''}" onclick="ConfigSistemaView._cambiarTab('seguridad')">${Icons.premium()} SEGURIDAD</button>
            <button class="prod-tab ${tab === 'auditoria' ? 'active' : ''}" onclick="ConfigSistemaView._cambiarTab('auditoria')">${Icons.documento()} AUDITORÍA</button>
          </div>
        </div>

        <div id="sistema-content"></div>
      </div>
    `;

    const container = document.getElementById('sistema-content');
    switch (tab) {
      case 'interfaz': await this._renderInterfaz(container, config); break;
      case 'seguridad': await this._renderSeguridad(container, config); break;
      case 'auditoria': await this._renderAuditoria(container); break;
    }

    if (window.enableScrollShadows) {
      document.querySelectorAll('.scroll-shadow-container').forEach(el => window.enableScrollShadows(el));
    }
  },

  _cambiarTab(tab) {
    this._currentTab = tab;
    const url = new URL(window.location.href);
    url.hash = `#/sistema?tab=${tab}`;
    window.location.hash = `#/sistema?tab=${tab}`;
  },

  // ===================== SECCIÓN 1: INTERFAZ =====================

  async _renderInterfaz(container, config) {
    const palette = this._getStandardPalette();
    container.innerHTML = `
      <div class="card p-14 mb-16" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="section-header-theme mb-15 font-900 uppercase tracking-wider text-[0.7rem] text-gray"><span style="color: var(--c-purple); margin-right: 4px;">|</span> ${Icons.foto()} APARIENCIA BASE</div>
        <div class="grid gap-12">
          <label class="wizard-check-label">
            <input type="checkbox" ${config.temaOscuro !== false ? 'checked' : ''} onchange="ConfigSistemaView._action('toggleTema', this.checked)">
            <div class="flex flex-col">
              <span class="font-bold">MODO OSCURO (OLED)</span>
              <span class="text-[0.65rem] text-aaa">Optimizado para pantallas AMOLED.</span>
            </div>
          </label>
          <label class="wizard-check-label">
            <input type="checkbox" ${config.mostrarContextos !== false ? 'checked' : ''} onchange="ConfigSistemaView._action('toggleContextos', this.checked)">
            <div class="flex flex-col">
              <span class="font-bold">TEXTOS DE CONTEXTO</span>
              <span class="text-[0.65rem] text-aaa">Ayudas visuales en cabeceras.</span>
            </div>
          </label>
        </div>
      </div>

      <div class="card p-14 mb-16" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="section-header-theme mb-15 font-900 uppercase tracking-wider text-[0.7rem] text-gray"><span style="color: var(--p-cork); margin-right: 4px;">|</span> ${Icons.ajustes()} RETROILUMINACIÓN</div>
        <div class="grid gap-10">
          <label class="wizard-check-label">
            <input type="checkbox" ${config.glowMarco !== false ? 'checked' : ''} onchange="ConfigSistemaView._action('toggleGlowMarco', this.checked)">
            <span>Marco Principal</span>
          </label>
          <label class="wizard-check-label">
            <input type="checkbox" ${config.glowLaterales !== false ? 'checked' : ''} onchange="ConfigSistemaView._action('toggleGlowLaterales', this.checked)">
            <span>Haces Laterales</span>
          </label>
          <label class="wizard-check-label">
            <input type="checkbox" ${config.glowBotones !== false ? 'checked' : ''} onchange="ConfigSistemaView._action('toggleGlowBotones', this.checked)">
            <span>Resplandor en Botones</span>
          </label>
          <label class="wizard-check-label">
            <input type="checkbox" ${config.glowTarjetas !== false ? 'checked' : ''} onchange="ConfigSistemaView._action('toggleGlowTarjetas', this.checked)">
            <span>Haces de Luz de todas las tarjetas</span>
          </label>
          <button class="widget-link-btn widget-link-btn--neon neon-success w-full mt-10" onclick="AjustesView._abrirWizardRetroiluminacion()">
            ${Icons.ajustes()} Wizard de Iluminación Avanzado
          </button>
        </div>
      </div>

      <div class="card p-14 mb-16" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="section-header-theme mb-15 font-900 uppercase tracking-wider text-[0.7rem] text-gray"><span style="color: var(--c-info); margin-right: 4px;">|</span> ${Icons.calendar()} FORMATOS DE SISTEMA</div>
        <div class="grid grid-cols-1 gap-15">
          <div class="wizard-input-group">
            <label class="wizard-label" for="sys-formato-fecha">FORMATO DE FECHA</label>
            <select id="sys-formato-fecha" class="wizard-input" onchange="ConfigSistemaView._action('guardarPreferencia', 'formatoFecha', this.value)">
              <option value="es-ES" ${config.formatoFecha !== 'en-US' ? 'selected' : ''}>DD/MM/AAAA (Europa)</option>
              <option value="en-US" ${config.formatoFecha === 'en-US' ? 'selected' : ''}>MM/DD/AAAA (Internacional)</option>
            </select>
          </div>
          <div class="wizard-input-group">
            <label class="wizard-label" for="sys-moneda">MONEDA PRINCIPAL</label>
            <select id="sys-moneda" class="wizard-input" onchange="ConfigSistemaView._action('guardarPreferencia', 'moneda', this.value)">
              <option value="€" ${config.moneda !== '$' ? 'selected' : ''}>Euro (€)</option>
              <option value="$" ${config.moneda === '$' ? 'selected' : ''}>Dólar ($)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card p-14" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="section-header-theme mb-15 font-900 uppercase tracking-wider text-[0.7rem] text-gray"><span style="color: var(--p-gold); margin-right: 4px;">|</span> ${Icons.estrella()} COLOR DE ACENTO GLOBAL</div>
        <div class="flex flex-wrap gap-8 justify-center theme-dots-container">
          ${palette.map(c => `
            <button class="theme-dot ${config.colorTema === c.id ? 'active' : ''}"
              style="background:${c.hex};" onclick="ConfigSistemaView._action('cambiarColor', '${c.id}')">
              ${config.colorTema === c.id ? '✓' : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  },

  // ===================== SECCIÓN 2: SEGURIDAD Y DATOS =====================

  async _renderSeguridad(container, config) {
    const fincas = await Fincas.list();
    const animales = await Animales.list().catch(() => []);

    container.innerHTML = `
      <div class="card p-14 mb-16" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="section-header-theme mb-15 font-900 uppercase tracking-wider text-[0.7rem] text-gray"><span style="color: var(--c-info); margin-right: 4px;">|</span> ${Icons.info()} INFORMACIÓN DEL SISTEMA</div>
        <div class="info-box bg-black p-15">
          <div class="grid grid-cols-2 gap-y-10 text-[0.7rem] uppercase font-800">
            <div class="text-gray">Versión App:</div><div class="text-white text-right">v${window.APP_INFO.version}</div>
            <div class="text-gray">Motor DB:</div><div class="text-white text-right">IndexedDB v${typeof DB_VERSION !== 'undefined' ? DB_VERSION : '—'}</div>
            <div class="text-gray">Fincas:</div><div class="text-white text-right">${fincas.length}</div>
            <div class="text-gray">Animales:</div><div class="text-white text-right">${animales.length}</div>
          </div>
        </div>
      </div>

      <div class="card p-14 mb-16" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="section-header-theme mb-15 font-900 uppercase tracking-wider text-[0.7rem] text-gray"><span style="color: var(--c-warning); margin-right: 4px;">|</span> ${Icons.guardar()} COPIAS DE SEGURIDAD</div>
        <p class="text-[0.65rem] text-aaa mb-15 uppercase font-800">Protege tu información exportando un archivo JSON de seguridad.</p>
        <div class="grid grid-cols-2 gap-10">
          <button class="widget-link-btn widget-link-btn--neon neon-success" onclick="App.exportBackup()">
            ${Icons.exportar()} <span class="widget-link-label">Exportar</span>
          </button>
          <button class="widget-link-btn widget-link-btn--neon neon-info" onclick="document.getElementById('sys-import').click()">
            ${Icons.importar()} <span class="widget-link-label">Importar</span>
          </button>
        </div>
        <input type="file" id="sys-import" class="d-none" onchange="App.importBackup(event)">

        <label class="wizard-check-label mt-15">
          <input type="checkbox" ${config.autoBackup ? 'checked' : ''} onchange="ConfigSistemaView._action('toggleAutoBackup', this.checked)">
          <span>Backup automático al cerrar sesión</span>
        </label>
      </div>

      <div class="card p-14" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="section-header-theme mb-15 font-900 uppercase tracking-wider text-[0.7rem] text-gray"><span style="color: var(--c-danger); margin-right: 4px;">|</span> ${Icons.eliminar()} MANTENIMIENTO</div>
        <button class="widget-link-btn widget-link-btn--neon neon-danger w-full mb-10" onclick="AjustesView._limpiarCache()">
          ${Icons.eliminar()} Limpiar Caché del Sistema
        </button>
        <p class="text-[0.6rem] text-center text-gray-600 uppercase font-900">Esta acción recargará los datos desde la base de datos física.</p>
      </div>
    `;
  },

  // ===================== SECCIÓN 3: AUDITORÍA =====================

  async _renderAuditoria(container) {
    const fincaId = await Fincas.getActiveId();
    const eventos = await window.db.getAllFromIndex('registro_eventos', 'fincaId', fincaId).catch(() => []);

    // Filtrar eventos de auditoría (rectificaciones, anulaciones, borrados)
    const logs = eventos.filter(e =>
      e.tipo === 'auditoria' || e.rectificado || e.anulado || e.motivo_tarea?.includes('anulacion')
    ).sort((a, b) => new Date(b.creadoEn || b.fecha) - new Date(a.creadoEn || a.fecha));

    let logsHtml = logs.length > 0 ? logs.slice(0, 50).map(l => {
      const isAnulado = l.anulado || l.motivo_tarea?.includes('anulacion');
      const isRectificado = l.rectificado;
      const color = isAnulado ? 'var(--c-danger)' : (isRectificado ? 'var(--c-warning)' : 'var(--c-info)');

      return `
        <div class="p-10 mb-8 rounded bg-black border border-222 border-left-3px" style="border-left-color:${color};">
          <div class="flex justify-between items-start">
            <span class="text-[0.65rem] font-950 uppercase" style="color:${color};">${l.motivo_tarea?.replace(/_/g, ' ') || 'Evento de Sistema'}</span>
            <span class="text-[0.55rem] text-gray-600 font-900">${new Date(l.creadoEn || l.fecha).toLocaleString()}</span>
          </div>
          <div class="text-white text-xs mt-4 font-700">${l.descripcion || l.observaciones || 'Registro modificado'}</div>
          ${l.rectificadoMotivo || l.anuladoMotivo ? `<div class="text-[0.6rem] text-aaa italic mt-2">Motivo: ${l.rectificadoMotivo || l.anuladoMotivo}</div>` : ''}
        </div>
      `;
    }).join('') : '<div class="text-center p-20 text-gray-600 font-900 text-xs uppercase">Sin registros de auditoría recientes</div>';

    container.innerHTML = `
      <div class="card p-14" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="section-header-theme mb-15 font-900 uppercase tracking-wider text-[0.7rem] text-gray"><span style="color: var(--c-info); margin-right: 4px;">|</span> ${Icons.documento()} REGISTRO DE ACTIVIDAD</div>
        <p class="text-xs text-gray mb-15 leading-relaxed">Historial de cambios críticos, eliminaciones y rectificaciones realizadas en la explotación actual.</p>
        <div class="mh-400 overflow-y-auto pr-4">
          ${logsHtml}
        </div>
      </div>
    `;
  },

  // ===================== UTILIDADES =====================

  _getStandardPalette() {
    return [
      { id: 'gold',   hex: '#FFFC55' },
      { id: 'blue',   hex: '#4FADF5' },
      { id: 'green',  hex: '#10b981' },
      
      { id: 'red',    hex: '#ef4444' },
      
      
      { id: 'indigo', hex: '#8b5cf6' },
      { id: 'lime',   hex: '#C5FA50' },
      { id: 'steel',  hex: '#B1B1B1' }
    ];
  },

  async _action(fn, ...args) {
    if (typeof AjustesView['_' + fn] === 'function') {
      await AjustesView['_' + fn](...args);
      this.render();
    }
  }
};

window.ConfigSistemaView = ConfigSistemaView;
