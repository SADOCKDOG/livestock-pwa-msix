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

    // Color de pantalla fijo de GeGan (verde lima), igual para todos sus submódulos
    if (window.App && App.updateHeaderColor) {
      App.updateHeaderColor('var(--c-success)');
    }

    main.innerHTML = `
      <!-- Carrusel circular de secciones de Ganadería: marco centrado con la sección activa -->
      <div class="mb-14">
        ${App.renderCarruselPestanas(
          ['animales', 'rebanos', 'patrimonio', 'zonas', 'sanidad'].filter(tab => allowedSubModules.includes(tab)).map(tab => ({ key: tab, icon: moduloMeta[tab].icon, label: tab.toUpperCase(), color: moduloMeta[tab].color })),
          this._activeSubModule,
          'GanaderiaView'
        )}
      </div>

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

      <!-- Contenedor Dinámico para la pestaña activa -->
      <div id="ganaderia-agenda-widget"></div>
      <div id="ganaderia-tab-content" class="animate-fade-in"></div>`;

    // Inyectar widget de agenda si el módulo está disponible
    if (window.AgendaView) {
        window.AgendaView.renderWidget(document.getElementById('ganaderia-agenda-widget'), 'gegan');
    }

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
