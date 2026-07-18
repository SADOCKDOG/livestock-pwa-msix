/**
 * Livestock Manager - AjustesView v1.3.0
 * Vista central de configuración y gestión administrativa.
 */

const AjustesView = {
  async render() {
    if (window.App) App.updateHeaderColor('ajustes');
    const main = document.getElementById("app-content");
    const fincas = await Fincas.list();
    const activeId = await Fincas.getActiveId();
    const activeFinca = activeId ? await Fincas.get(activeId) : null;
    const animales = activeId ? await Animales.list().catch(() => []) : [];
    const rebanos = activeId ? await Rebanos.list().catch(() => []) : [];
    const eventos = activeId ? await window.db.getAllFromIndex('registro_eventos', 'fincaId', activeId).catch(() => []) : [];
    const docsLegales = await window.db.getAll('documentos_legales').catch(() => []);
    const tramitesFinca = activeId ? docsLegales.filter(d => Number(d.fincaId) === Number(activeId)) : [];
    let adsgs = activeId ? await window.ADSGs.list() : [];

    if (activeId && activeFinca && activeFinca.adsg_nombre && adsgs.length === 0) {
      try {
        await window.ADSGs.save({
          nombre: activeFinca.adsg_nombre,
          codigo: activeFinca.adsg_codigo || '',
          veterinario: activeFinca.adsg_veterinario || '',
          colegiado: activeFinca.adsg_vet_colegiado || '',
          telefono: activeFinca.adsg_vet_telefono || '',
          vet_nif: activeFinca.adsg_vet_nif || ''
        });
        adsgs = await window.ADSGs.list();
      } catch (e) { console.error("Error al registrar ADSG inicial:", e); }
    }

    const costesRef = activeId ? await window.db.getAllFromIndex('config_costes_referencia', 'fincaId', Number(activeId)) : [];
    const config = await this._loadConfig();
    const modoFlags = ModoContextoHelper.getFlags(activeId) || { leche: true, carne: false };
    const catalogoTiposREGA = window.ComunidadesService?.getTiposExplotacionREGA ? window.ComunidadesService.getTiposExplotacionREGA() : [];
    const catalogoEspeciesREGA = window.ComunidadesService?.getEspeciesAutorizables ? window.ComunidadesService.getEspeciesAutorizables() : [];
    const catalogoTiposResumen = catalogoTiposREGA.slice(0, 5);
    const catalogoTiposResto = catalogoTiposREGA.slice(5);

    var isFree = window.PremiumManager && window.PremiumManager.isFree();

    main.innerHTML = `
      ${isFree ? `
      <div class="card mb-25 p-20" style="background:linear-gradient(145deg,#0f0f1a 0%,#1a1a2e 50%,#0d0d1a 100%);border:1px solid rgba(217,119,6,0.3);border-radius:16px;overflow:hidden;position:relative;">
        <div class="flex items-center gap-15">
          <div style="flex-shrink:0;width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,var(--c-warning),#b45309);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(217,119,6,0.3);">
            ${Icons.premium()}
          </div>
          <div class="flex-1">
            <div class="text-white font-900 text-base uppercase tracking-wider">Livestock Manager FREE</div>
            <p class="text-gray text-xs mt-4">Actualiza a Premium para funciones profesionales.</p>
          </div>
        </div>
        <button class="btn w-full mt-15" style="background:linear-gradient(135deg,var(--c-warning),#b45309); color:#fff; font-weight:900;" onclick="window.PurchaseManager && window.PurchaseManager.purchase()">
          ACTUALIZAR A PREMIUM
        </button>
      </div>` : ''}

      <!-- ===================== CONFIGURACIÓN DEL SISTEMA Y SEGURIDAD ===================== -->
      <div class="card">
        <h3 class="flex items-center gap-10 mt-0 text-white font-900 uppercase text-lg tracking-wider">
          <span style="color: var(--c-purple);">|</span> ${Icons.ajustes()} SISTEMA Y SEGURIDAD
        </h3>
        <p class="text-gray mt-5 text-sm leading-relaxed">
          Centro de control técnico. Gestiona la apariencia OLED, integridad de datos (Backups) y registros de auditoría.
        </p>

        <div class="info-box mt-15 mb-20 bg-black p-15 border-222" style="background: linear-gradient(145deg, #000 0%, #111 100%);">
          <div class="grid grid-cols-2 gap-y-10 gap-x-15 text-[0.68rem] uppercase font-900">
            <div class="flex flex-col gap-2">
              <span class="text-gray-600 text-[0.55rem]">ESTADO SEGURIDAD</span>
              <strong class="${config.autoBackup ? 'text-green' : 'text-amber'}">${config.autoBackup ? Icons.check() + ' BACKUP AUTO' : Icons.alerta() + ' BACKUP MANUAL'}</strong>
            </div>
            <div class="flex flex-col gap-2">
              <span class="text-gray-600 text-[0.55rem]">TEMA VISUAL</span>
              <strong class="text-white">${config.temaOscuro !== false ? 'OLED DARK' : 'LIGHT MODE'}</strong>
            </div>
            <div class="flex flex-col gap-2">
              <span class="text-gray-600 text-[0.55rem]">ACENTO / LUZ</span>
              <strong class="text-gold">${config.colorTema?.toUpperCase() || 'ORO'} / ${config.fabIntensidad || 60}%</strong>
            </div>
            <div class="flex flex-col gap-2">
              <span class="text-gray-600 text-[0.55rem]">BANNERS</span>
              <strong class="text-blue">${Math.round((config.bannerOpacity || 0.4) * 100)}% OPACIDAD</strong>
            </div>
            <div class="col-span-2 mt-5 border-top-222 pt-10 flex justify-between items-center text-aaa">
              <span class="text-[0.6rem]">${Icons.info()} VER. v${window.APP_INFO.version}</span>
              <span class="text-[0.6rem] text-blue-400 font-black">${animales.length} ANIMALES EN IDB</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-10 max-w-280 mx-auto">
          <button class="widget-link-btn widget-link-btn--neon neon-purple w-full py-14" onclick="location.hash='#/sistema'">
            ${Icons.ajustes()}
            <span class="widget-link-label">Gestionar Sistema</span>
          </button>
        </div>
      </div>

      <!-- ===================== GESTOR DE FINCA ACTIVA ===================== -->
      ${activeFinca ? `
      <div class="card">
        <h3 class="flex items-center gap-10 mt-0 text-white font-900 uppercase text-lg tracking-wider">
          <span style="color: var(--c-success);">|</span> ${Icons.finca()} FINCA ACTIVA
        </h3>
        <div class="info-box mt-15 mb-20">
          <div class="grid grid-cols-2 gap-8 text-85">
            <div><span class="text-gray">Finca:</span> <strong class="text-white">${activeFinca.nombre}</strong></div>
            <div><span class="text-gray">REGA:</span> <strong class="text-gold">${activeFinca.codigo_REGA || activeFinca.rega || "N/D"}</strong></div>
            <div><span class="text-gray">CCAA:</span> <strong class="text-white">${activeFinca.comunidad_autonoma ? activeFinca.comunidad_autonoma.toUpperCase() : 'N/D'}</strong></div>
            <div><span class="text-gray">Animales:</span> <strong class="text-white">${animales.length}</strong></div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-10">
          <button class="widget-link-btn widget-link-btn--neon neon-info" onclick="AjustesView._editarFincaPrincipal()">
            ${Icons.editar()} <span class="widget-link-label">Editar Datos</span>
          </button>
          <button class="widget-link-btn widget-link-btn--neon neon-success" onclick="AjustesView._gestionarZonas()">
            ${Icons.zonas()} <span class="widget-link-label">Zonas / Parcelas</span>
          </button>
        </div>
      </div>` : ''}

      <!-- ===================== MIS FINCAS ===================== -->
      <div class="card">
        <h3 class="flex items-center gap-10 mt-0 text-white font-900 uppercase text-lg tracking-wider">
          <span style="color: var(--c-warning);">|</span> ${Icons.finca()} MIS FINCAS
        </h3>
        <p class="text-gray mt-5 text-sm">Cambia la explotación activa o añade nuevas.</p>
        <div class="grid gap-10 mt-15">${fincas.map((f) => `
          <div class="flex justify-between items-center rounded-sm bg-black border border-222 p-12">
            <div>
              <div class="font-bold text-white uppercase text-sm">${f.nombre}</div>
              <div class="text-gray text-xs mt-4">REGA: <span class="text-gold font-bold">${f.codigo_REGA || f.rega || "N/D"}</span></div>
            </div>
            <div>${f.id !== activeId ? `<button onclick="AjustesView._cambiarFincaActiva(${f.id})" class="btn btn-secondary btn-sm">Activar</button>` : `<span style="font-size: 1.1rem; font-weight: 800; border: 1px solid var(--c-success); color: var(--c-success); background: rgba(204,255,0,0.1); padding: 6px 12px; border-radius: 8px; display: inline-block;">ACTIVA</span>`}</div>
          </div>`).join("")}
        </div>
        ${!isFree ? `<button class="btn btn-create btn-full mt-15" onclick="App._showFincaForm()">${Icons.agregar()} Nueva Finca</button>` : ''}
      </div>

      <!-- ===================== ADSG Y SANIDAD ===================== -->
      <div class="card">
        <h3 class="flex items-center gap-10 mt-0 text-white font-900 uppercase text-lg tracking-wider">
          <span style="color: var(--c-info);">|</span> ${Icons.sanidad()} SANIDAD GANADERA (ADSG)
        </h3>
        <div class="grid gap-10 mt-15">
          ${adsgs.map(a => `
            <div class="flex justify-between items-center rounded-sm bg-black border border-222 p-12">
              <div><div class="font-bold text-white uppercase text-sm">${a.nombre}</div><div class="text-gray text-[0.6rem] uppercase font-800 tracking-wider">CÓDIGO: ${a.codigo || '—'}</div></div>
              <button class="btn btn-secondary btn-sm" onclick="AjustesView._editarADSG(${a.id})">${Icons.editar()}</button>
            </div>`).join('')}
        </div>
        <button class="btn btn-create btn-full mt-15" onclick="AjustesView._nuevoADSG()">${Icons.agregar()} Nueva ADSG</button>
      </div>

      <!-- ===================== OBJETIVOS DE EXPLOTACIÓN ===================== -->
      <div class="card">
        <h3 class="flex items-center gap-10 mt-0 text-white font-900 uppercase text-lg tracking-wider">
          <span style="color: var(--c-success);">|</span> ${Icons.objetivo()} OBJETIVOS DE EXPLOTACIÓN
        </h3>
        <p class="text-gray mt-5 text-sm">Metas de rendimiento para el Panel de Eficiencia Técnica.</p>
        <div class="grid grid-cols-2 gap-10 mt-15">
          <div class="wizard-input-group"><label class="wizard-label" for="obj-gmd">GMD (kg/día)</label><input type="number" id="obj-gmd" value="${config.objGmd || 0.8}" step="0.1" class="wizard-input" onchange="AjustesView._guardarObjetivo('objGmd', this.value)"></div>
          <div class="wizard-input-group"><label class="wizard-label" for="obj-fert">Fertilidad (%)</label><input type="number" id="obj-fert" value="${config.objFert || 85}" class="wizard-input" onchange="AjustesView._guardarObjetivo('objFert', this.value)"></div>
        </div>
      </div>

      <!-- ===================== TIPO DE EXPLOTACIÓN ===================== -->
      <div class="card">
        <h3 class="flex items-center gap-10 mt-0 text-white font-900 uppercase text-lg tracking-wider">
          <span style="color: var(--c-warning);">|</span> ${Icons.finca()} TIPO DE EXPLOTACIÓN${activeFinca ? ` — ${activeFinca.nombre}` : ''}
        </h3>
        <p class="text-gray mt-5 text-sm">Active uno o ambos tipos según la explotación de esta finca. Los módulos ocultarán todo lo relativo al tipo desactivado.</p>
        <div class="space-y-6 mt-15">
          <label class="flex items-center gap-3 text-sm text-white cursor-pointer bg-black border border-222 p-10 rounded-sm">
            <input type="checkbox" ${modoFlags.leche ? 'checked' : ''} onchange="AjustesView._toggleTipoExplotacion('leche', this.checked)">
            <span>${Icons.leche()} Lácteo</span>
          </label>
          <label class="flex items-center gap-3 text-sm text-white cursor-pointer bg-black border border-222 p-10 rounded-sm">
            <input type="checkbox" ${modoFlags.carne ? 'checked' : ''} onchange="AjustesView._toggleTipoExplotacion('carne', this.checked)">
            <span>${Icons.carne()} Cárnico</span>
          </label>
        </div>
        <p class="text-xs text-aaa mt-4">Esta configuración es específica de esta finca (cada finca puede tener su propio tipo). Con ambos activos, cada módulo muestra sus secciones de leche y de carne por separado. Debe permanecer al menos uno activo.</p>
      </div>

      <!-- ===================== ESPECIES Y RAZAS ===================== -->
      <div class="card">
        <h3 class="flex items-center gap-10 mt-0 text-white font-900 uppercase text-lg tracking-wider">
          <span style="color: var(--c-orange);">|</span> ${Icons.reproduccion()} ESPECIES Y RAZAS
        </h3>
        <div id="especies-container" class="mt-15">${this._renderEspecies(config)}</div>
        <button class="btn btn-create btn-full mt-15" onclick="AjustesView._agregarEspecie()">${Icons.agregar()} Añadir Especie</button>
      </div>

      <!-- ===================== GESTIÓN DE ALERTAS ===================== -->
      <div class="card">
        <h3 class="flex items-center gap-10 mt-0 text-white font-900 uppercase text-lg tracking-wider">
          <span style="color: var(--c-danger);">|</span> ${Icons.campana()} CONFIGURACIÓN DE ALERTAS
        </h3>
        <div class="grid gap-10 mt-15">
          ${[
            { id: 'alertSanidad', label: 'Alertas Sanitarias', def: true },
            { id: 'alertTrazabilidad', label: 'Alertas Trazabilidad', def: true },
            { id: 'alertPAC', label: 'Alertas PAC', def: true },
          ].map(a => `
            <label class="flex items-center gap-10 text-sm text-white cursor-pointer bg-black border border-222 p-10 rounded-sm">
              <input type="checkbox" ${config[a.id] !== false ? 'checked' : ''} onchange="AjustesView._toggleAlerta('${a.id}', this.checked)"> ${a.label}
            </label>`).join('')}
        </div>
      </div>

      <!-- ===================== AYUDA Y SOPORTE ===================== -->
      <div class="card">
        <h3 class="flex items-center gap-10 mt-0 text-white font-900 uppercase text-lg tracking-wider">
          <span style="color: var(--c-purple);">|</span> ${Icons.libro()} AYUDA Y SOPORTE
        </h3>
        <div class="grid grid-cols-1 gap-10 mt-15">
          <button class="widget-link-btn widget-link-btn--neon neon-warning" onclick="AjustesView._abrirManual()">
            ${Icons.libro()} <span class="widget-link-label">Manual de Usuario</span>
          </button>
        </div>
      </div>

      <!-- ===================== FOOTER ===================== -->
      <div class="text-center p-40 about-card">
        <img src="icons/Logo aplicación.png" alt="Livestock Manager Premium" class="about-logo" style="height:64px; margin-bottom:20px;">
        <div class="text-white font-900 text-xl uppercase mt-4">David Asuar Arteaga</div>
        <div class="mt-40 text-[0.65rem] text-444 uppercase font-900 tracking-widest about-footer">
          © 2026 Livestock Manager Premium · v${window.APP_INFO.version}<br>
          Todos los derechos reservados.
        </div>
      </div>`;
  },

  // ===================== HELPER: CONFIG =====================

  async _loadConfig() {
    const defaults = {
      objGmd: 0.8, objLitros: 25, objFert: 85, objOcup: 85, objRent: 20, objBajas: 5,
      autoBackup: false, temaOscuro: true, mostrarContextos: true,
      glowMarco: true, glowLaterales: false, glowBotones: true, glowTarjetas: true,
      glowMarcoFijo: false, glowMarcoFijoColor: '#FFFFFF', bannerOpacity: 0.77,
      hazLuzColor: '', hazLuzIntensidad: 50,
      fabColor: '#FFFFFF', fabIntensidad: 40,
      colorTema: 'gold', formatoFecha: 'es-ES', moneda: '€', especies: [],
      alertSanidad: true, alertTrazabilidad: true, alertPAC: true,
      alertADSG: true, alertINCOLAC: true, alertContratos: false
    };
    try {
      const stored = await window.db.get('meta', 'appConfig');
      return stored?.value ? { ...defaults, ...stored.value } : defaults;
    } catch (e) { return defaults; }
  },

  async _saveConfig(updates) {
    try {
      const current = await this._loadConfig();
      const merged = { ...current, ...updates };
      await window.db.put('meta', { key: 'appConfig', value: merged, actualizadoEn: new Date().toISOString() });
      if (window.App) window.App._config = merged;
    } catch (e) { console.warn('[Ajustes] Error guardando config:', e); }
  },

  async _guardarObjetivo(key, val) {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    await this._saveConfig({ [key]: num });
    App.toast(`Objetivo actualizado: ${num}`, "info");
  },

  async _toggleAlerta(id, checked) {
    await this._saveConfig({ [id]: checked });
    App.toast(checked ? 'Alerta activada' : 'Alerta desactivada', "info");
  },

  async _toggleAutoBackup(checked) {
    await this._saveConfig({ autoBackup: checked });
    App.toast(checked ? 'Backup automático activado' : 'Backup automático desactivado', "info");
  },

  async _toggleTema(checked) {
    await this._saveConfig({ temaOscuro: checked });
    document.documentElement.style.colorScheme = checked ? 'dark' : 'light';
    if (checked) document.body.removeAttribute('data-modo');
    else document.body.setAttribute('data-modo', 'claro');
    App.toast(checked ? 'Modo oscuro' : 'Modo claro', "info");
  },

  async _toggleGlowMarco(checked) {
    await this._saveConfig({ glowMarco: checked });
    document.body.classList.toggle('glow-marco-off', !checked);
  },

  async _toggleGlowLaterales(checked) {
    await this._saveConfig({ glowLaterales: checked });
    document.body.classList.toggle('glow-laterales-off', !checked);
  },

  async _toggleGlowBotones(checked) {
    await this._saveConfig({ glowBotones: checked });
    document.body.classList.toggle('glow-botones-off', !checked);
  },

  async _toggleGlowTarjetas(checked) {
    await this._saveConfig({ glowTarjetas: checked });
    document.body.classList.toggle('glow-tarjetas-off', !checked);
    App.toast(checked ? 'Haces de luz de tarjetas activados' : 'Haces de luz de tarjetas desactivados', "info");
  },

  async _toggleContextos(checked) {
    await this._saveConfig({ mostrarContextos: checked });
    document.body.classList.toggle('hide-context', !checked);
  },

  async _cambiarColor(tema) {
    await this._saveConfig({ colorTema: tema });
    document.body.setAttribute('data-tema', tema);
    App.toast(`Tema ${tema} aplicado`, "success");
  },

  async _guardarPreferencia(key, val) {
    await this._saveConfig({ [key]: val });
    App.toast('Preferencia guardada', 'success');
  },

  async _toggleTipoExplotacion(tipo, activo) {
    const activeId = await Fincas.getActiveId();
    const flags = ModoContextoHelper.getFlags(activeId) || { leche: true, carne: false };
    const nuevosFlags = { ...flags, [tipo]: activo };

    if (!nuevosFlags.leche && !nuevosFlags.carne) {
      App.toast('Debe permanecer al menos un tipo activo', 'error');
      this.render();
      return;
    }

    ModoContextoHelper.setFlags(nuevosFlags, activeId);
    const partes = [nuevosFlags.leche ? 'Lácteo' : '', nuevosFlags.carne ? 'Cárnico' : ''].filter(Boolean);
    App.toast(`Tipo de explotación: ${partes.join(' + ')}`, 'success');

    if (window.App && typeof App.updateNavigationMenu === 'function') {
      await App.updateNavigationMenu();
    }
    this.render();
  },

  _renderEspecies(config) {
    const especies = config.especies || [];
    if (!especies.length) return '<div class="text-gray text-sm">Sin especies configuradas.</div>';
    return especies.map((e, i) => `
      <div class="flex items-center justify-between mb-8 p-10 bg-black border border-222 rounded">
        <span class="text-white font-bold text-sm">${e.nombre}</span>
        <button class="btn btn-danger btn-sm" onclick="AjustesView._eliminarEspecie(${i})">${Icons.eliminar()}</button>
      </div>`).join('');
  },

  async _agregarEspecie() {
    const nombre = await Confirm.prompt('Nueva Especie', 'Nombre (Vacas, Ovejas...)');
    if (!nombre) return;
    const config = await this._loadConfig();
    const especies = config.especies || [];
    especies.push({ nombre: nombre.trim() });
    await this._saveConfig({ especies });
    App.renderAjustes();
  },

  async _eliminarEspecie(idx) {
    const config = await this._loadConfig();
    const especies = config.especies || [];
    especies.splice(idx, 1);
    await this._saveConfig({ especies });
    App.renderAjustes();
  },

  async _limpiarCache() {
    if (!await Confirm.confirm("Limpiar Caché", "¿Limpiar caché local? Se recargarán los datos.", true)) return;
    if (window.CacheService) CacheService.clearAll();
    localStorage.removeItem('seed_data_completed');
    App.toast('Caché limpiada', "success");
  },

  async _cambiarFincaActiva(id) {
    await Fincas.setActiveId(id);
    App.toast('Finca activa cambiada', "success");
    if (typeof App.updateNavigationMenu === 'function') await App.updateNavigationMenu();
    App.renderAjustes();
  },

  async _editarFincaPrincipal() {
    if (window.WizardFinca) {
      await window.WizardFinca.editar();
    } else {
      App.toastError("Wizard de Finca no disponible");
    }
  },

  async _gestionarZonas() { location.hash = '#/zonas'; },

  _abrirManual() {
    const overlay = document.createElement('div');
    overlay.className = 'wizard-full-screen';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:7000; background:#fff; display:flex; flex-direction:column;';
    overlay.innerHTML = `
      <div class="manual-header" style="background:#121212; padding:15px; display:flex; justify-content:between;">
        <strong style="color:var(--p-gold);">${Icons.libro()} Manual de Usuario</strong>
        <button onclick="this.closest('.wizard-full-screen').remove()" class="btn btn-secondary btn-sm">Cerrar</button>
      </div>
      <iframe src="manual/index.html" style="flex:1; border:none;"></iframe>`;
    document.body.appendChild(overlay);
  },

  async _nuevoADSG() {
    const nombre = await Confirm.prompt('Nueva ADSG', 'Nombre:');
    if (!nombre) return;
    await window.ADSGs.save({ nombre: nombre.trim(), codigo: '' });
    App.renderAjustes();
  },

  async _editarADSG(id) {
    const adsg = await window.ADSGs.get(id);
    const nombre = await Confirm.prompt('Editar ADSG', 'Nombre:', adsg.nombre);
    if (!nombre) return;
    adsg.nombre = nombre.trim();
    await window.ADSGs.save(adsg);
    App.renderAjustes();
  },

  async _abrirWizardRetroiluminacion() {
    const config = await this._loadConfig();
    const colors = [
      { name: 'Neon Lime', hex: '#C5FA50' },
      { name: 'Neon Red', hex: '#E8555F' },
      { name: 'Neon Blue', hex: '#4FADF5' },
      { name: 'Neon Gold', hex: '#FFFC55' },
      
      
      
      { name: 'Neon Green', hex: '#10b981' },
      { name: 'Neon Indigo', hex: '#8b5cf6' },
      { name: 'Steel Grey', hex: '#B1B1B1' },
      { name: 'White Backlit', hex: '#FFFFFF' }
    ];

    const steps = [
      {
        title: 'Componentes Activos',
        content: (data) => `
          <div class="grid gap-12">
            <p class="text-gray text-xs uppercase font-800">Selecciona qué elementos mostrarán iluminación neón:</p>
            <label class="wizard-check-label">
              <input type="checkbox" id="w-glow-marco" ${data.glowMarco !== false ? 'checked' : ''}>
              <span>MARCO PRINCIPAL (HEADER/BOTTOM)</span>
            </label>
            <label class="wizard-check-label">
              <input type="checkbox" id="w-glow-laterales" ${data.glowLaterales !== false ? 'checked' : ''}>
              <span>HAZ DE LUZ LATERAL</span>
            </label>
            <label class="wizard-check-label">
              <input type="checkbox" id="w-glow-botones" ${data.glowBotones !== false ? 'checked' : ''}>
              <span>BOTONES DINÁMICOS</span>
            </label>
            <label class="wizard-check-label">
              <input type="checkbox" id="w-glow-tarjetas" ${data.glowTarjetas !== false ? 'checked' : ''}>
              <span>HACES DE LUZ EN TARJETAS</span>
            </label>
          </div>
        `,
        onChange: (data) => {
          data.glowMarco = document.getElementById('w-glow-marco').checked;
          data.glowLaterales = document.getElementById('w-glow-laterales').checked;
          data.glowBotones = document.getElementById('w-glow-botones').checked;
          data.glowTarjetas = document.getElementById('w-glow-tarjetas').checked;
        }
      },
      {
        title: 'Color del Marco',
        content: (data) => `
          <div class="grid gap-15">
            <p class="text-gray text-xs uppercase font-800">¿Deseas que el marco cambie según el módulo o prefieres un color fijo?</p>
            <label class="wizard-check-label">
              <input type="checkbox" id="w-glow-fijo" ${data.glowMarcoFijo ? 'checked' : ''}>
              <span>USAR COLOR FIJO EN EL MARCO</span>
            </label>
            <div id="w-color-fijo-container" style="display:${data.glowMarcoFijo ? 'block' : 'none'};">
              <label class="wizard-label">COLOR DEL MARCO</label>
              <div class="flex flex-wrap gap-8 mt-8 theme-dots-container">
                ${colors.map(c => `
                  <button class="theme-dot ${data.glowMarcoFijoColor === c.hex ? 'active' : ''}"
                    style="background:${c.hex};" data-color="${c.hex}"></button>
                `).join('')}
              </div>
            </div>
            <div class="wizard-input-group mt-10">
              <label class="wizard-label" for="w-banner-opacity" id="lbl-banner-opacity">TRANSPARENCIA DE BANNERS (${Math.round((data.bannerOpacity || 0.4) * 100)}%)</label>
              <input type="range" id="w-banner-opacity" min="0" max="100" value="${(data.bannerOpacity || 0.4) * 100}" class="w-full">
            </div>
          </div>
        `,
        onRender: (data, area) => {
          const chk = area.querySelector('#w-glow-fijo');
          const cont = area.querySelector('#w-color-fijo-container');
          const range = area.querySelector('#w-banner-opacity');
          const lbl = area.querySelector('#lbl-banner-opacity');
          window._tempGlowColor = data.glowMarcoFijoColor || '#FFFFFF';
          chk.onchange = (e) => { cont.style.display = e.target.checked ? 'block' : 'none'; };
          area.querySelectorAll('.theme-dot').forEach(btn => {
            btn.onclick = () => {
              area.querySelectorAll('.theme-dot').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              window._tempGlowColor = btn.dataset.color;
            };
          });
          range.oninput = (e) => { lbl.textContent = `TRANSPARENCIA DE BANNERS (${e.target.value}%)`; };
        },
        onChange: (data) => {
          data.glowMarcoFijo = document.getElementById('w-glow-fijo').checked;
          data.glowMarcoFijoColor = window._tempGlowColor;
          data.bannerOpacity = parseInt(document.getElementById('w-banner-opacity').value) / 100;
        }
      },
      {
        title: 'Haz de Luz',
        content: (data) => `
          <div class="grid gap-15">
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-haz-int" id="lbl-haz-int">INTENSIDAD DEL HAZ DE LUZ (${data.hazLuzIntensidad || 45}%)</label>
              <input type="range" id="w-haz-int" min="10" max="90" value="${data.hazLuzIntensidad || 45}" class="w-full">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-haz-color-mode">COLOR DEL HAZ DE LUZ</label>
              <select id="w-haz-color-mode" class="wizard-input">
                <option value="" ${!data.hazLuzColor ? 'selected' : ''}>DINÁMICO (SIGUE AL MARCO)</option>
                <option value="fijo" ${data.hazLuzColor ? 'selected' : ''}>FIJO (PERSONALIZADO)</option>
              </select>
            </div>
            <div id="w-haz-color-fijo" style="display:${data.hazLuzColor ? 'block' : 'none'};">
              <div class="flex flex-wrap gap-8 mt-8 theme-dots-container">
                ${colors.map(c => `
                  <button class="theme-dot ${data.hazLuzColor === c.hex ? 'active' : ''}"
                    style="background:${c.hex};" data-color="${c.hex}"></button>
                `).join('')}
              </div>
            </div>
          </div>
        `,
        onRender: (data, area) => {
          const sel = area.querySelector('#w-haz-color-mode');
          const cont = area.querySelector('#w-haz-color-fijo');
          const range = area.querySelector('#w-haz-int');
          const lbl = area.querySelector('#lbl-haz-int');
          window._tempHazColor = data.hazLuzColor || '#FFFFFF';
          sel.onchange = (e) => { cont.style.display = e.target.value === 'fijo' ? 'block' : 'none'; if (e.target.value === '') window._tempHazColor = ''; };
          range.oninput = (e) => { lbl.textContent = `INTENSIDAD DEL HAZ DE LUZ (${e.target.value}%)`; };
          area.querySelectorAll('#w-haz-color-fijo .theme-dot').forEach(btn => {
            btn.onclick = () => {
              area.querySelectorAll('#w-haz-color-fijo .theme-dot').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              window._tempHazColor = btn.dataset.color;
            };
          });
        },
        onChange: (data) => {
          data.hazLuzIntensidad = parseInt(document.getElementById('w-haz-int').value);
          const mode = document.getElementById('w-haz-color-mode').value;
          data.hazLuzColor = mode === 'fijo' ? (window._tempHazColor || '#FFFFFF') : '';
        }
      },
      {
        title: 'Botón de Registro',
        content: (data) => `
          <div class="grid gap-15">
            <p class="text-gray text-xs uppercase font-800">Elige el color para el botón flotante:</p>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-fab-color-mode">MODO DE COLOR</label>
              <select id="w-fab-color-mode" class="wizard-input">
                <option value="" ${!data.fabColor ? 'selected' : ''}>DINÁMICO (SIGUE AL MARCO)</option>
                <option value="fijo" ${data.fabColor ? 'selected' : ''}>FIJO (PERSONALIZADO)</option>
              </select>
            </div>
            <div id="w-fab-color-fijo-container" style="display:${data.fabColor ? 'block' : 'none'};">
              <div class="flex flex-wrap gap-8 mt-8 theme-dots-container">
                ${colors.map(c => `<button class="theme-dot ${data.fabColor === c.hex ? 'active' : ''}" style="background:${c.hex};" data-color="${c.hex}"></button>`).join('')}
              </div>
            </div>
            <div class="wizard-input-group mt-10">
              <label class="wizard-label" for="w-fab-int" id="lbl-fab-int">INTENSIDAD DE BRILLO (${data.fabIntensidad || 60}%)</label>
              <input type="range" id="w-fab-int" min="10" max="100" value="${data.fabIntensidad || 60}" class="w-full">
            </div>
          </div>
        `,
        onRender: (data, area) => {
          const sel = area.querySelector('#w-fab-color-mode');
          const cont = area.querySelector('#w-fab-color-fijo-container');
          window._tempFabColor = data.fabColor || '#FFFFFF';
          sel.onchange = (e) => { cont.style.display = e.target.value === 'fijo' ? 'block' : 'none'; };
          area.querySelectorAll('#w-fab-color-fijo-container .theme-dot').forEach(btn => {
            btn.onclick = () => {
              area.querySelectorAll('#w-fab-color-fijo-container .theme-dot').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              window._tempFabColor = btn.dataset.color;
            };
          });
        },
        onChange: (data) => {
          const mode = document.getElementById('w-fab-color-mode').value;
          data.fabColor = mode === 'fijo' ? (window._tempFabColor || '#FFFFFF') : '';
          data.fabIntensidad = parseInt(document.getElementById('w-fab-int').value);
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-config-glow',
      title: 'RETROILUMINACIÓN',
      initialData: config,
      steps: steps,
      onComplete: async (finalData) => {
        await this._saveConfig(finalData);
        if (window.App && window.App.updateHeaderColor) window.App.updateHeaderColor();
        
        // Aplicar todas las combinaciones del wizard de forma inmediata
        document.body.classList.toggle('glow-marco-off', finalData.glowMarco === false);
        document.body.classList.toggle('glow-laterales-off', finalData.glowLaterales === false);
        document.body.classList.toggle('glow-botones-off', finalData.glowBotones === false);
        document.body.classList.toggle('glow-tarjetas-off', finalData.glowTarjetas === false);

        // Inyectar variables
        document.documentElement.style.setProperty('--haz-intensity', finalData.hazLuzIntensidad + '%');
        document.documentElement.style.setProperty('--haz-intensity-num', finalData.hazLuzIntensidad);
        if (finalData.hazLuzColor) document.documentElement.style.setProperty('--haz-luz-color', finalData.hazLuzColor);
        else document.documentElement.style.removeProperty('--haz-luz-color');
        if (finalData.fabColor) {
          document.documentElement.style.setProperty('--fab-user-color', finalData.fabColor);
          document.documentElement.style.setProperty('--fab-neon-color', finalData.fabColor);
        } else {
          document.documentElement.style.removeProperty('--fab-user-color');
          document.documentElement.style.removeProperty('--fab-neon-color');
        }
        if (finalData.bannerOpacity !== undefined) document.documentElement.style.setProperty('--banner-opacity', finalData.bannerOpacity);
        App.toast("Configuración guardada", 'success');
        this.render();
      }
    });
  }
};

window.AjustesView = AjustesView;
