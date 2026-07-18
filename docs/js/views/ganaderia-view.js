/**
 * Livestock Manager - GanaderiaView v3.1.0
 * Consola Unificada de Ganadería (GeGan) con barra multipestaña horizontal scrollable
 * Integra: Animales, Rebaños, Patrimonio y Ganadería (ICA), Sanidad/Veterinaria
 */
const GanaderiaView = {
  _activeSubModule: 'animales', // 'animales', 'rebanos', 'patrimonio', 'zonas', 'sanidad'
  _cache: null,

  async render() {
    const main = document.getElementById('app-content');
    const fincaId = await Fincas.getActiveId();
    if (!fincaId) {
      main.innerHTML = `
        <div class="p-20 text-center animate-fade-in">
          <p class="text-gray uppercase font-900 tracking-wider">No hay ninguna finca seleccionada.</p>
        </div>`;
      return;
    }

    // Mapeo de colores y metadatos por sub-módulo para sincronizar el header
    const moduloMeta = {
      animales: { color: 'var(--c-orange)', icon: Icons.animales(), title: 'Censo de Animales', desc: 'Control de crotales, altas, bajas e inventario' },
      rebanos: { color: 'var(--c-info)', icon: Icons.rebanos(), title: 'Lotes y Rebaños', desc: 'Agrupamiento de ganado y asignación de lotes' },
      patrimonio: { color: 'var(--c-warning)', icon: Icons.edificio(), title: 'Patrimonio y Ganadería', desc: 'Censo, lotes y conversión alimenticia de toda la finca' },
      zonas: { color: 'var(--c-success)', icon: Icons.zonas(), title: 'Zonas y Parcelas', desc: 'Ubicación de rebaños, UGM, carga ganadera y PAC' },
      sanidad: { color: 'var(--c-purple)', icon: Icons.sanidad(), title: 'Legislación Sanitaria y Sanidad', desc: 'Libro de tratamientos, vacunas y periodos de supresión' }
    };

    // Definir submódulos permitidos según los tipos de explotación activos (Patrimonio es exclusivo de Carne)
    const flags = ModoContextoHelper.getFlags() || { leche: true, carne: false };
    const allowedSubModules = ['animales', 'rebanos', 'zonas', 'sanidad'];
    if (flags.carne) allowedSubModules.push('patrimonio');

    // Si el sub-módulo activo dejó de estar permitido (p.ej. tras desactivar Carne), volver a uno válido
    if (!allowedSubModules.includes(this._activeSubModule)) {
      this._activeSubModule = allowedSubModules[0];
    }

    const currentMeta = moduloMeta[this._activeSubModule] || moduloMeta.animales;

    // Sincronizar color de cabecera con el sub-módulo activo
    if (window.App && App.updateHeaderColor) {
      App.updateHeaderColor(this._activeSubModule === 'animales' ? 'animales' : (this._activeSubModule === 'rebanos' ? 'rebanos' : this._activeSubModule));
    }

    main.innerHTML = `
      <!-- Cabecera Maestra de Ganadería Consolidada -->
      <div class="flex items-center gap-12 mb-14 px-4 animate-fade-in">
        <span class="text-2xl" style="color:${currentMeta.color}; display:inline-flex; align-items:center;">${currentMeta.icon}</span>
        <div>
          <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin:0; line-height:1.2;">
            <span style="color:${currentMeta.color}; margin-right:4px;">|</span> ${currentMeta.title}
          </h1>
          <div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
            ${currentMeta.desc}
          </div>
        </div>
      </div>

      <!-- Barra de Navegación Multipestaña Horizontal Ganadería (Scrollable) Premium con Indicadores Animados -->
      <div class="pestanas-premium-wrapper mb-14" style="--mode-color: ${currentMeta.color};">
        <div class="pestana-indicador-flecha pestana-flecha-izq" style="opacity: 0; pointer-events: none;" onclick="this.parentElement.querySelector('.pestanas-premium-container').scrollBy({ left: -100, behavior: 'smooth' })">
          ${Icons.atras()}
        </div>
        <div class="pestanas-premium-container" onscroll="App.evaluarScrollPestanas(this)">
          <div class="pestanas-premium-switch" role="tablist" aria-label="Secciones de Ganadería">
            ${['animales', 'rebanos', 'patrimonio', 'zonas', 'sanidad'].map(tab => {
            if (!allowedSubModules.includes(tab)) return '';
            const isActive = this._activeSubModule === tab;
            const meta = moduloMeta[tab];
            return `<button class="pestanas-premium-btn ${isActive ? 'active' : ''}" role="tab" aria-selected="${isActive}" style="--mode-color:${meta.color};" onclick="GanaderiaView._cambiarSubModulo('${tab}')">${meta.icon} ${tab.toUpperCase()}</button>`;
          }).join('')}
          </div>
        </div>
        <div class="pestana-indicador-flecha pestana-flecha-der" style="opacity: 0; pointer-events: none;" onclick="this.parentElement.querySelector('.pestanas-premium-container').scrollBy({ left: 100, behavior: 'smooth' })">
          ${Icons.siguiente()}
        </div>
      </div>

      <!-- Contenedor Dinámico para la pestaña activa -->
      <div id="ganaderia-tab-content" class="animate-fade-in"></div>`;

    // Delegación dinámica de renderizado
    switch (this._activeSubModule) {
      case 'animales':
        if (window.AnimalesView) await AnimalesView.render();
        break;
      case 'rebanos':
        if (window.RebanosView) await RebanosView.render();
        break;
      case 'patrimonio':
        if (window.PatrimonioView) await PatrimonioView.render(document.getElementById('ganaderia-tab-content'));
        break;
      case 'zonas':
        if (window.ZonasView) await ZonasView.render();
        break;
      case 'sanidad':
        if (window.SanidadView) await SanidadView.render(document.getElementById('ganaderia-tab-content'));
        break;
    }

    // Inicializar scroll dinámico para la barra de pestañas
    const containerPestanas = document.querySelector('.pestanas-premium-container');
    if (containerPestanas && window.App?.inicializarScrollPestanas) {
      window.App.inicializarScrollPestanas(containerPestanas);
    }
  },

  _cambiarSubModulo(subModulo) {
    const flags = ModoContextoHelper.getFlags() || { leche: true, carne: false };
    const allowed = ['animales', 'rebanos', 'zonas', 'sanidad'];
    if (flags.carne) allowed.push('patrimonio');
    if (!allowed.includes(subModulo)) {
      // Sub-módulo no permitido con los tipos de explotación activos actuales: se ignora el cambio
      return;
    }
    this._activeSubModule = subModulo;
    this.render();
  },

};

window.GanaderiaView = GanaderiaView;
