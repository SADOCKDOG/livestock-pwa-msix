/**
 * erp-shell.js — Capa de escritorio (piel ERP) del maestro.
 *
 * Contiene el sidebar acordeon (NAV_GROUPS), el pie de estado, y los helpers
 * de listado (filtros, «Ver mas», recolocacion del marco de acciones y del
 * conmutador Tarjetas/Tabla). Se extrajo de livestock-desktop para que los tres
 * consumidores (Android, PWA y escritorio) compartan una sola fuente.
 *
 * NO se toca app.js: el modulo se instala sobre App con Object.assign y se
 * auto-integra envolviendo App.route. Asi el maestro no diverge y la capa se
 * puede quitar borrando una linea del index.html.
 *
 * En movil es INERTE: sale por la primera guarda antes de definir nada, asi que
 * Android conserva su chrome (FAB, bottom-nav, sub-pestanas) y su paleta neon.
 */
(function () {
  'use strict';

  var ESCRITORIO = '(min-width: 1024px)';

  // Guarda: por debajo de 1024px la capa no existe. Se comprueba una sola vez
  // al cargar; un cambio de tamano no la activa (requiere recarga), igual que
  // ocurre con el <link media> de los CSS de la piel.
  if (!window.matchMedia || !window.matchMedia(ESCRITORIO).matches) return;

  var ErpShell = {
    NAV_GROUPS: [
      {
        // Colores originales del PWA (maestro module-colors.js), restaurados en los
        // iconos del menú de módulos. El acento de la entrada activa sigue siendo
        // --p-gold (fijo); solo se colorea el SVG del icono vía currentColor.
        key: 'gegan', label: 'GeGan', icon: () => Icons.rebanos(), color: '#FF4444',
        items: [
          { key: 'animales', label: 'Animales', icon: () => Icons.animales(), color: '#F97316', route: '/ganaderia?tab=animales' },
          { key: 'rebanos', label: 'Rebaños', icon: () => Icons.rebanos(), color: '#3B82F6', route: '/ganaderia?tab=rebanos' },
          { key: 'patrimonio', label: 'Patrimonio', icon: () => Icons.edificio(), color: '#FF4444', route: '/ganaderia?tab=patrimonio' },
          { key: 'zonas', label: 'Zonas', icon: () => Icons.zonas(), color: '#CCFF00', route: '/ganaderia?tab=zonas' },
          { key: 'sanidad', label: 'Sanidad', icon: () => Icons.sanidad(), color: '#FF4444', route: '/ganaderia?tab=sanidad' },
        ],
      },
      {
        key: 'expro', label: 'ExPro', icon: () => Icons.finca(), color: '#CCFF00',
        items: [
          { key: 'explotacion', label: 'Explotación', icon: () => Icons.finca(), color: '#CCFF00', route: '/explotacion?tab=explotacion' },
          { key: 'lacteo', label: 'Láctea', icon: () => Icons.leche(), color: '#3B82F6', items: [
            { key: 'dashboard', label: 'Dashboard', icon: () => Icons.dashboard(), color: '#3B82F6', route: '/explotacion?tab=lacteo&sub=dashboard' },
            { key: 'tanques', label: 'Tanques', icon: () => Icons.silos(), color: '#3B82F6', route: '/explotacion?tab=lacteo&sub=tanques' },
            { key: 'control', label: 'Control', icon: () => Icons.analitica(), color: '#3B82F6', route: '/explotacion?tab=lacteo&sub=control' },
            { key: 'balance', label: 'Balance', icon: () => Icons.documento(), color: '#3B82F6', route: '/explotacion?tab=lacteo&sub=balance' },
            { key: 'graficos', label: 'Gráficos', icon: () => Icons.grafico(), color: '#3B82F6', route: '/explotacion?tab=lacteo&sub=graficos' },
          ] },
          { key: 'silos', label: 'Silos', icon: () => Icons.silos(), color: '#CCFF00', route: '/explotacion?tab=silos' },
          { key: 'fitosanitarios', label: 'Fitosanitarios', icon: () => Icons.sanidad(), color: '#FF4444', route: '/explotacion?tab=fitosanitarios' },
          { key: 'gastos', label: 'Finanzas', icon: () => Icons.dinero(), color: '#FF4444', items: [
            { key: 'todos', label: 'Resumen', icon: () => Icons.documento(), color: '#FF4444', route: '/explotacion?tab=gastos&cat=todos' },
            { key: 'Alimentacion', label: 'Alimentación', icon: () => Icons.paquete(), color: '#F97316', route: '/explotacion?tab=gastos&cat=Alimentacion' },
            { key: 'Sanidad', label: 'Sanidad', icon: () => Icons.sanidad(), color: '#FF4444', route: '/explotacion?tab=gastos&cat=Sanidad' },
            { key: 'Fitosanitarios', label: 'Fitosanitarios', icon: () => Icons.sanidad(), color: '#22C55E', route: '/explotacion?tab=gastos&cat=Fitosanitarios' },
            { key: 'Electricidad', label: 'Electricidad', icon: () => Icons.info(), color: '#3B82F6', route: '/explotacion?tab=gastos&cat=Electricidad' },
            { key: 'Personal', label: 'Personal', icon: () => Icons.compradores(), color: '#FB923C', route: '/explotacion?tab=gastos&cat=Personal' },
            { key: 'Amortizacion', label: 'Amortización', icon: () => Icons.transportistas(), color: '#A855F7', route: '/explotacion?tab=gastos&cat=Amortizacion' },
          ] },
          { key: 'proveedores', label: 'Proveedores', icon: () => Icons.proveedores(), color: '#A855F7', route: '/explotacion?tab=proveedores' },
          { key: 'tramites', label: 'Trámites', icon: () => Icons.documento(), color: '#CCFF00', items: [
            { key: 'tram-guias', label: 'Guías DIMOE', icon: () => Icons.documento(), color: '#3B82F6', route: '/explotacion?tab=tramites&sub=guias' },
            { key: 'tram-censo', label: 'Censo Anual', icon: () => Icons.animales(), color: '#F59E0B', route: '/explotacion?tab=tramites&sub=censo' },
            { key: 'tram-crotales', label: 'Crotales', icon: () => Icons.paquete(), color: '#3FB950', route: '/explotacion?tab=tramites&sub=crotales' },
            { key: 'tram-traslado', label: 'Traslados', icon: () => Icons.trazabilidad(), color: '#A855F7', route: '/explotacion?tab=tramites&sub=traslado' },
            { key: 'tram-infolac', label: 'Infolac', icon: () => Icons.leche(), color: '#3B82F6', route: '/explotacion?tab=tramites&sub=infolac' },
            { key: 'tram-archivo', label: 'Archivo', icon: () => Icons.cuaderno(), color: '#FB923C', route: '/explotacion?tab=tramites&sub=archivo' },
          ] },
        ],
      },
      {
        key: 'comer', label: 'CoMer', icon: () => Icons.comercial(), color: '#3B82F6',
        items: [
          { key: 'leche', label: 'Leche', icon: () => Icons.leche(), color: '#3B82F6', route: '/comercializacion?tab=leche' },
          { key: 'carne', label: 'Carne', icon: () => Icons.carne(), color: '#CCFF00', route: '/comercializacion?tab=carne' },
          { key: 'compradores', label: 'Compradores', icon: () => Icons.compradores(), color: '#3B82F6', route: '/comercializacion?tab=compradores' },
          { key: 'contratos', label: 'Contratos', icon: () => Icons.documento(), color: '#3B82F6', route: '/comercializacion?tab=contratos' },
          { key: 'transportistas', label: 'Transportistas', icon: () => Icons.transportistas(), color: '#EC4899', route: '/comercializacion?tab=transportistas' },
          { key: 'libro-ventas', label: 'Libro de Ventas', icon: () => Icons.libroVentas(), color: '#3B82F6', route: '/albaranes-ventas' },
        ],
      },
      {
        key: 'informes', label: 'Informes y Doc', icon: () => Icons.informes(), color: '#FFD600',
        items: [
          { key: 'informes', label: 'Informes', icon: () => Icons.informes(), color: '#FFD600', items: [
            { key: 'inf-general', label: 'General', icon: () => Icons.grafico(), color: '#FFD600', items: [
              { key: 'inf-general-general', label: 'General', icon: () => Icons.grafico(), color: '#FFD600', route: '/informes?cat=general&tab=general' },
              { key: 'inf-por-finca', label: 'Por Finca', icon: () => Icons.finca(), color: '#FFD600', route: '/informes?cat=general&tab=por-finca' },
              { key: 'inf-eficiencia', label: 'Eficiencia', icon: () => Icons.tendencia(), color: '#FFD600', route: '/informes?cat=general&tab=eficiencia' },
              { key: 'inf-rent-esp', label: 'Rent. Especie', icon: () => Icons.reproduccion(), color: '#FFD600', route: '/informes?cat=general&tab=rent-esp' },
            ] },
            { key: 'inf-gegan', label: 'GeGan', icon: () => Icons.animales(), color: '#3FB950', items: [
              { key: 'inf-censo', label: 'Censo', icon: () => Icons.rebanos(), color: '#3FB950', route: '/informes?cat=gegan&tab=censo' },
              { key: 'inf-rotacion', label: 'Rotación', icon: () => Icons.tendencia(), color: '#3FB950', route: '/informes?cat=gegan&tab=rotacion' },
              { key: 'inf-reproductivo', label: 'Repro', icon: () => Icons.reproduccion(), color: '#3FB950', route: '/informes?cat=gegan&tab=reproductivo' },
              { key: 'inf-sanidad', label: 'Sanidad', icon: () => Icons.sanidad(), color: '#3FB950', route: '/informes?cat=gegan&tab=sanidad' },
              { key: 'inf-carne', label: 'Cárnico', icon: () => Icons.carne(), color: '#3FB950', route: '/informes?cat=gegan&tab=carne' },
              { key: 'inf-coste-prod', label: 'Coste/Animal', icon: () => Icons.balanza(), color: '#3FB950', route: '/informes?cat=gegan&tab=coste-prod' },
            ] },
            { key: 'inf-expro', label: 'ExPro', icon: () => Icons.finca(), color: '#3B82F6', items: [
              { key: 'inf-produccion', label: 'Producción', icon: () => Icons.grafico(), color: '#3B82F6', route: '/informes?cat=expro&tab=produccion' },
              { key: 'inf-leche', label: 'Lácteo', icon: () => Icons.leche(), color: '#3B82F6', route: '/informes?cat=expro&tab=leche' },
              { key: 'inf-curva-prod', label: 'Curva', icon: () => Icons.tendencia(), color: '#3B82F6', route: '/informes?cat=expro&tab=curva-prod' },
              { key: 'inf-cargas', label: 'Aforos', icon: () => Icons.balanza(), color: '#3B82F6', route: '/informes?cat=expro&tab=cargas' },
              { key: 'inf-fitosanitario', label: 'Fitosanitario', icon: () => Icons.sanidad(), color: '#3B82F6', route: '/informes?cat=expro&tab=fitosanitario' },
              { key: 'inf-silos', label: 'Silos', icon: () => Icons.silos(), color: '#3B82F6', route: '/informes?cat=expro&tab=silos' },
              { key: 'inf-tramites', label: 'Trámites', icon: () => Icons.documento(), color: '#3B82F6', route: '/informes?cat=expro&tab=tramites' },
              { key: 'inf-proveedores', label: 'Proveedores', icon: () => Icons.proveedores(), color: '#3B82F6', route: '/informes?cat=expro&tab=proveedores' },
              { key: 'inf-gastos', label: 'Gastos', icon: () => Icons.dinero(), color: '#3B82F6', route: '/informes?cat=expro&tab=gastos' },
            ] },
            { key: 'inf-comer', label: 'CoMer', icon: () => Icons.compradores(), color: '#F59E0B', items: [
              { key: 'inf-ventas', label: 'Ventas', icon: () => Icons.libroVentas(), color: '#F59E0B', route: '/informes?cat=comer&tab=ventas' },
              { key: 'inf-margenes', label: 'Márgenes', icon: () => Icons.dinero(), color: '#F59E0B', route: '/informes?cat=comer&tab=margenes' },
              { key: 'inf-compradores', label: 'Compradores', icon: () => Icons.compradores(), color: '#F59E0B', route: '/informes?cat=comer&tab=compradores' },
              { key: 'inf-contratos', label: 'Contratos', icon: () => Icons.contratos(), color: '#F59E0B', route: '/informes?cat=comer&tab=contratos-vencimiento' },
              { key: 'inf-transportistas', label: 'Transportistas', icon: () => Icons.transportistas(), color: '#F59E0B', route: '/informes?cat=comer&tab=transportistas-resumen' },
              { key: 'inf-albaranes', label: 'Albaranes', icon: () => Icons.libroVentas(), color: '#F59E0B', route: '/informes?cat=comer&tab=albaranes' },
            ] },
            { key: 'inf-libros', label: 'Libros', icon: () => Icons.documento(), color: '#A855F7', items: [
              { key: 'inf-pyg', label: 'P y G', icon: () => Icons.dinero(), color: '#A855F7', route: '/informes?cat=libros&tab=pyg' },
              { key: 'inf-flujo-caja', label: 'Flujo Caja', icon: () => Icons.tendencia(), color: '#A855F7', route: '/informes?cat=libros&tab=flujo-caja' },
              { key: 'inf-breakeven', label: 'Break-Even', icon: () => Icons.balanza(), color: '#A855F7', route: '/informes?cat=libros&tab=breakeven' },
              { key: 'inf-subvenciones', label: 'PAC', icon: () => Icons.pac(), color: '#A855F7', route: '/informes?cat=libros&tab=subvenciones' },
            ] },
          ] },
          { key: 'cuaderno', label: 'Cuaderno Digital', icon: () => Icons.cuaderno(), color: '#F97316', route: '/cuaderno' },
          { key: 'alertas', label: 'Alertas', icon: () => Icons.campana(), color: '#FFD600', route: '/alertas' },
          { key: 'informe-rega', label: 'Informe REga', icon: () => Icons.informeRega(), color: '#A855F7', route: '/informes?cat=libros&tab=rega' },
          { key: 'exportacion-oficial', label: 'Exportación Oficial', icon: () => Icons.exportar(), color: '#A855F7', route: '/informes?cat=libros&tab=exportar' },
          { key: 'documentos', label: 'Documentos DIMOE', icon: () => Icons.documento(), color: '#A855F7', route: '/documentos' },
          { key: 'manuales', label: 'Manuales', icon: () => Icons.libro(), color: '#A855F7', route: '/manuales' },
        ],
      },
      {
        key: 'herramientas', label: 'Herramientas', icon: () => Icons.ajustes(), color: '#B1B1B1',
        items: [
          { key: 'ajustes', label: 'Ajustes', icon: () => Icons.ajustes(), color: '#B1B1B1', route: '/ajustes' },
          { key: 'importar-rfid', label: 'Importar RFID', icon: () => Icons.importar(), color: '#B1B1B1', route: '/importar-rfid' },
          {
            key: 'agenda', label: 'Agenda', icon: () => Icons.calendar(), color: '#F97316',
            items: [
              { key: 'agenda-todos', label: 'Todos', icon: () => Icons.buscar(), color: '#F97316', route: '/agenda?filtro=todos' },
              { key: 'agenda-gegan', label: 'Animales', icon: () => Icons.animales(), color: '#F97316', route: '/agenda?filtro=gegan' },
              { key: 'agenda-rebanos', label: 'Rebaños', icon: () => Icons.rebanos(), color: '#3B82F6', route: '/agenda?filtro=rebanos' },
              { key: 'agenda-sanidad', label: 'Sanidad', icon: () => Icons.sanidad(), color: '#FF4444', route: '/agenda?filtro=sanidad' },
              { key: 'agenda-carnico', label: 'Carne', icon: () => Icons.carne(), color: '#CCFF00', route: '/agenda?filtro=carnico' },
              { key: 'agenda-lacteos', label: 'Leche', icon: () => Icons.leche(), color: '#3B82F6', route: '/agenda?filtro=lacteos' },
            ]
          },
        ],
      },
    ],

    /**
     * Genera el HTML del carrusel circular de pestañas de submódulo: un marco
     * centrado muestra solo la sección activa (ampliada, con desvanecimiento
     * de entrada); las flechas laterales navegan a la sección anterior/
     * siguiente (circular: de la última se vuelve a la primera) y llevan junto
     * al icono de flecha una vista previa en miniatura —con su propio color de
     * módulo— de a qué sección llevan. Como el carrusel no es deslizable, tocar
     * el marco activo despliega un menú con todos los submódulos disponibles
     * del módulo principal. Los puntos de abajo dan acceso directo a cualquier
     * sección y sirven de indicador de "hay N secciones en total". El cromo
     * (bordes, resplandores, puntos) usa el color fijo del módulo principal
     * (CARRUSEL_COLOR_MODULO); los iconos SVG conservan su color individual
     * de submódulo.
     * @param {Array<{key:string, icon:string, label:string, color:string}>} tabs
     * @param {string} activeKey
     * @param {string} viewName - nombre global de la vista (p.ej. 'GanaderiaView') para el onclick.
     */

    _setupSidebar() {
      const sidebar = document.getElementById('erpSidebar');
      const toggle = document.getElementById('sidebarToggle');
      if (!sidebar || !toggle) return;

      // Construir el acordeón de navegación antes de aplicar el estado colapsado
      this._renderSidebarNav();
      // Pie de estado (versión, plan, fecha, finca activa) y refresco al cambiar de finca
      this._renderSidebarStatus();
      if (!this._statusBound) {
        window.addEventListener('fincaChanged', () => this._renderSidebarStatus());
        window.addEventListener('premiumChanged', () => this._renderSidebarStatus());
        this._statusBound = true;
      }

      let collapsed = false;
      try {
        collapsed = localStorage.getItem('sidebar-collapsed') === 'true';
      } catch (_) {}
      this._setSidebarCollapsed(collapsed, false);

      // Atajos de teclado de escritorio sin interferir con campos editables.
      document.addEventListener('keydown', (event) => {
        const tag = event.target?.tagName;
        const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable;
        if (event.altKey && event.key.toLowerCase() === 's' && !isEditing) {
          event.preventDefault();
          this._toggleSidebar();
        }
      });
    },

    /** Alterna entre el sidebar ERP expandido y el compacto. */

    _renderSidebarNav() {
      const nav = document.getElementById('erpSidebarNav');
      if (!nav) return;
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

      // Renderiza un item: hoja (enlace) o subgrupo plegable (item con `items`).
      const renderItem = (item, groupKey) => {
        if (item.items && item.items.length) {
          const subKey = groupKey + '::' + item.key;
          let children = '';
          item.items.forEach((child) => { children += renderItem(child, subKey); });
          return '<div class="sidebar-group sidebar-subgroup" data-group="' + subKey + '">' +
            '<button type="button" class="sidebar-group-toggle" data-group-toggle="' + subKey + '" aria-expanded="true" title="' + esc(item.label) + '">' +
              '<span class="sidebar-group-icon" style="color:' + item.color + ';">' + item.icon() + '</span>' +
              '<span class="sidebar-group-label">' + esc(item.label) + '</span>' +
              '<span class="sidebar-group-chevron">' + Icons.chevronAbajo() + '</span>' +
            '</button>' +
            '<div class="sidebar-group-items" data-group-items="' + subKey + '">' + children + '</div>' +
          '</div>';
        }
        return '<a class="sidebar-link" href="#' + item.route + '" data-route="' + item.route + '" title="' + esc(item.label) + '">' +
          '<span class="sidebar-link-icon" style="color:' + item.color + ';">' + item.icon() + '</span>' +
          '<span class="sidebar-link-label">' + esc(item.label) + '</span>' +
        '</a>';
      };

      // Enlace fijo "Inicio" (Dashboard) en la parte superior del menú lateral. En
      // escritorio el bottom-nav está oculto, así que sin esto el Inicio solo sería
      // alcanzable vía el logo del header. Reutiliza .sidebar-link y su lógica de
      // estado activo (_updateSidebarNavigation marca data-route="/" cuando path='/').
      const homeLink = '<a class="sidebar-link" href="#/" data-route="/" title="Inicio" ' +
        'style="margin-bottom:8px; border-bottom:1px solid color-mix(in srgb, var(--sidebar-text) 10%, transparent); padding-bottom:8px;">' +
          '<span class="sidebar-link-icon" style="color:var(--header-neon-color, var(--c-success));">' + Icons.home() + '</span>' +
          '<span class="sidebar-link-label">Inicio</span>' +
        '</a>';

      let html = homeLink;
      this.NAV_GROUPS.forEach((group) => {
        let itemsHtml = '';
        group.items.forEach((item) => { itemsHtml += renderItem(item, group.key); });
        html +=
          '<div class="sidebar-group" data-group="' + group.key + '">' +
            '<button type="button" class="sidebar-group-toggle" data-group-toggle="' + group.key + '" aria-expanded="true" title="' + esc(group.label) + '">' +
              '<span class="sidebar-group-icon" style="color:' + (group.color || '') + ';">' + group.icon() + '</span>' +
              '<span class="sidebar-group-label">' + esc(group.label) + '</span>' +
              '<span class="sidebar-group-chevron">' + Icons.chevronAbajo() + '</span>' +
            '</button>' +
            '<div class="sidebar-group-items" data-group-items="' + group.key + '">' + itemsHtml + '</div>' +
          '</div>';
      });
      nav.innerHTML = html;

      // Restaurar estado de grupos/subgrupos colapsados (persistido en localStorage).
      // Por defecto colapsado en primera carga; se corrige también aria-expanded.
      nav.querySelectorAll('.sidebar-group[data-group]').forEach((wrap) => {
        const collapsed = this._getGroupCollapsed(wrap.dataset.group);
        wrap.classList.toggle('collapsed', collapsed);
        const btn = wrap.querySelector('[data-group-toggle]');
        if (btn) btn.setAttribute('aria-expanded', String(!collapsed));
      });

      // Delegación de clic en los toggles de grupo/subgrupo (evita listeners duplicados)
      if (!nav.dataset.bound) {
        nav.addEventListener('click', (e) => {
          const sidebar = document.getElementById('erpSidebar');
          const collapsedSidebar = sidebar && sidebar.dataset.collapsed === 'true';
          const btn = e.target.closest('[data-group-toggle]');
          if (collapsedSidebar) {
            // En modo compacto los submenús están ocultos (CSS display:none). Al
            // pulsar cualquier entrada desplegamos la barra completa para poder
            // usar el menú.
            this._setSidebarCollapsed(false);
            if (btn && nav.contains(btn)) {
              // Y abrimos el grupo concreto que se ha pinchado (con sus ancestros
              // en caso de subgrupos anidados).
              let g = btn.closest('.sidebar-group');
              while (g) { this._expandSidebarGroup(g); g = g.parentElement ? g.parentElement.closest('.sidebar-group') : null; }
              return;
            }
            // Si fue un enlace hoja (href), la navegación ocurre y la barra queda
            // desplegada; nada más que hacer aquí.
            return;
          }
          if (btn && nav.contains(btn)) this._toggleSidebarGroup(btn);
        });
        nav.dataset.bound = '1';
      }

      // Marcar ruta activa inicial
      const hash = (window.location.hash || '').slice(1) || '/';
      const [p, q] = hash.split('?');
      this._updateSidebarNavigation(p, q);
    },

    async _renderSidebarStatus() {
      const el = document.getElementById('sidebarStatus');
      if (!el) return;
      const version = (window.APP_INFO && window.APP_INFO.version) || '';
      const isFree = !window.PremiumManager || typeof window.PremiumManager.isFree !== 'function'
        ? true
        : window.PremiumManager.isFree();
      const plan = isFree ? 'Free' : 'Premium';
      const planClass = isFree ? 'ss-plan-free' : 'ss-plan-premium';
      let fincaNombre = 'Sin finca';
      try {
        const finca = (window.Fincas && typeof Fincas.getActive === 'function')
          ? await Fincas.getActive().catch(() => null) : null;
        if (finca && finca.nombre) fincaNombre = finca.nombre;
      } catch (_) { /* sin finca activa */ }
      const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      el.innerHTML = `
        <div class="ss-row"><span class="ss-label">Versión</span><span class="ss-value">${version}</span></div>
        <div class="ss-row"><span class="ss-label">Plan</span><span class="ss-value ${planClass}">${plan}</span></div>
        <div class="ss-row"><span class="ss-label">Fecha</span><span class="ss-value">${fecha}</span></div>
        <div class="ss-row"><span class="ss-label">Finca</span><span class="ss-value">${fincaNombre}</span></div>`;
    },

    _updateSidebarNavigation(path, query) {
      const full = query ? path + '?' + query : path;
      // Al entrar en Inicio (Dashboard) el acordeón se contrae por completo: ningún
      // módulo está activo, así que no hay grupo que dejar desplegado.
      if (!path || path === '/') {
        this._collapseAllSidebarGroups();
      }
      document.querySelectorAll('#erpSidebarNav .sidebar-link[data-route]').forEach((link) => {
        const route = link.dataset.route;
        const active = route === full || route === path;
        link.classList.toggle('active', active);
        if (active) {
          link.setAttribute('aria-current', 'page');
          // Desplegar el grupo y todos sus ancestros (subgrupos anidados)
          let g = link.closest('.sidebar-group');
          while (g) { this._expandSidebarGroup(g); g = g.parentElement ? g.parentElement.closest('.sidebar-group') : null; }
        } else {
          link.removeAttribute('aria-current');
        }
      });
    },

    /** Colapsa/expande la card de resumen (chevron esquina superior derecha). Reutilizable en todas las vistas. */

    _recolocarMarcoRegistro(raiz = document) {
      raiz.querySelectorAll('.erp-action-group:not(.erp-action-group--modulo)').forEach((marco) => {
        // Primer destino que aparezca DESPUÉS del marco: buscador del listado,
        // listado recortable o tabla ERP. Buscar solo hacia delante evita que en
        // vistas con varios listados (Sanidad) el marco suba al listado equivocado.
        const destino = Array.from(
          raiz.querySelectorAll('.erp-filtros, [data-ver-mas], [id$="-lista"], [id$="-erp-table-container"]')
        ).find((el) => marco.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
          && !marco.contains(el));
        if (!destino) return;                          // marco sin listado propio: se queda
        if (destino.previousElementSibling === marco) return;  // ya está en su sitio
        destino.parentElement.insertBefore(marco, destino);
      });
    },

    /** Recoloca el conmutador Tarjetas / Tabla ERP en su sitio canónico: justo
     *  encima del marco de acciones de registro (y por tanto debajo de la tarjeta
     *  de cabecera y de las alertas). Son controles de VISTA, no de registro, así
     *  que no deben mezclarse con los botones de alta ni quedar sueltos junto al
     *  título del listado, que es donde cada vista los colocaba por su cuenta. */

    _recolocarToggleVista(raiz = document) {
      const btn = raiz.querySelector('[id$="-vista-cards"]');
      if (!btn) return;
      const contenedor = btn.parentElement;
      const marco = raiz.querySelector('.erp-action-group');
      if (!contenedor || !marco || contenedor.contains(marco)) return;
      contenedor.classList.add('erp-vista-toggle');
      if (marco.previousElementSibling === contenedor) return;
      marco.parentElement.insertBefore(contenedor, marco);
    },

    /** Engancha una fila de filtros `.erp-filtros[data-filtros-para="idListado"]`
     *  al listado indicado: el buscador oculta las tarjetas cuyo texto no coincide
     *  y el desplegable filtra por su atributo `data-tipo`. El desplegable se
     *  puebla solo con los tipos presentes; si ninguna tarjeta declara `data-tipo`,
     *  se oculta. Filtra en el DOM, así que no hace falta re-renderizar la vista. */

    aplicarFiltrosListado(fila) {
      if (!fila || fila.dataset.filtrosAplicados === '1') return;
      const lista = document.getElementById(fila.dataset.filtrosPara);
      if (!lista) return;
      fila.dataset.filtrosAplicados = '1';

      const input = fila.querySelector('input');
      const select = fila.querySelector('select');
      const items = () => Array.from(lista.children).filter((el) => !el.classList.contains('erp-ver-mas'));

      // Poblar el desplegable con los tipos que realmente hay en los datos
      if (select) {
        const tipos = [...new Set(items().map((el) => el.dataset.tipo).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'es'));
        if (!tipos.length) {
          select.style.display = 'none';
        } else {
          select.innerHTML = '<option value="">' + (select.dataset.etiquetaTodos || 'Todos los tipos') + '</option>'
            + tipos.map((t) => '<option value="' + t + '">' + t.toUpperCase() + '</option>').join('');
        }
      }

      const filtrar = () => {
        const texto = (input && input.value || '').trim().toLowerCase();
        const tipo = (select && select.value) || '';
        let visibles = 0;
        items().forEach((el) => {
          const coincideTexto = !texto || (el.textContent || '').toLowerCase().includes(texto);
          const coincideTipo = !tipo || el.dataset.tipo === tipo;
          const ok = coincideTexto && coincideTipo;
          el.dataset.filtrado = ok ? '' : '1';
          if (ok) visibles++;
        });
        // Al filtrar se muestran todas las coincidencias: el recorte de 10 se
        // recalcula sobre el subconjunto resultante.
        lista.dataset.verMasAplicado = '';
        this.aplicarVerMas(lista);
        // ...y las descartadas por el filtro se ocultan pase lo que pase
        items().forEach((el) => { if (el.dataset.filtrado === '1') el.style.display = 'none'; });

        const vacio = fila.parentElement && fila.parentElement.querySelector('[data-filtros-vacio]');
        if (vacio) vacio.style.display = visibles === 0 ? '' : 'none';
      };

      if (input) input.addEventListener('input', filtrar);
      if (select) select.addEventListener('change', filtrar);
    },

    /** Engancha todas las filas de filtros de la vista recién pintada. */

    aplicarFiltrosListadoAuto(raiz = document) {
      raiz.querySelectorAll('.erp-filtros[data-filtros-para]').forEach((f) => {
        this.aplicarFiltrosListado(f);
        this._sincronizarVisibilidadFiltros(f, f.dataset.filtrosPara);
      });
      // Filas de filtros que la propia vista ya gestiona (tienen su handler): no
      // se les engancha nada, solo se ocultan cuando manda la tabla ERP.
      raiz.querySelectorAll('.erp-filtros[data-filtros-de]').forEach((f) => {
        this._sincronizarVisibilidadFiltros(f, f.dataset.filtrosDe);
      });
    },

    /** La tabla ERP trae su propio buscador: si el listado de tarjetas está
     *  oculto (toggle Tarjetas/Tabla), la fila de filtros sobra y se esconde. */

    _sincronizarVisibilidadFiltros(fila, idLista) {
      const lista = document.getElementById(idLista);
      fila.style.display = (lista && lista.style.display === 'none') ? 'none' : '';
    },

    /** Limita visualmente un listado a los `limite` primeros registros (los más
     *  recientes, porque los listados llegan ordenados de nuevo a antiguo) y
     *  añade debajo un botón «Ver más» que revela el resto.
     *  Se aplica solo a contenedores marcados con data-ver-mas="N". */

    aplicarVerMas(contenedor, limite) {
      const cont = typeof contenedor === 'string' ? document.getElementById(contenedor) : contenedor;
      if (!cont) return;
      const n = Number(limite || cont.dataset.verMas || 10);
      const previo = cont.nextElementSibling;
      if (previo && previo.classList && previo.classList.contains('erp-ver-mas')) previo.remove();

      const items = Array.from(cont.children);
      items.forEach((el, i) => { el.style.display = i < n ? '' : 'none'; });
      if (items.length <= n) return;

      const pie = document.createElement('div');
      pie.className = 'erp-ver-mas';
      const restantes = items.length - n;
      pie.innerHTML = '<button type="button" class="btn-erp-secondary btn-sm">'
        + 'Ver más <span class="erp-ver-mas-count">(' + restantes + ' ' + (restantes === 1 ? 'registro' : 'registros') + ' más)</span>'
        + '</button>';
      pie.querySelector('button').addEventListener('click', () => {
        items.forEach((el) => { el.style.display = ''; });
        pie.remove();
      });
      cont.insertAdjacentElement('afterend', pie);
    },

    /** Aplica «Ver más» a todos los listados marcados de la vista recién pintada. */

    aplicarVerMasAuto(raiz = document) {
      raiz.querySelectorAll('[data-ver-mas]').forEach((cont) => {
        if (cont.dataset.verMasAplicado === '1') return;
        cont.dataset.verMasAplicado = '1';
        this.aplicarVerMas(cont);
      });
    },

    /** Observa #app-content para recortar también los listados que repintan las
     *  propias vistas (buscadores, cambios de pestaña, toggle Tarjetas/Tabla),
     *  que no pasan por route(). Cada contenedor se procesa una sola vez. */

    _observarVerMas() {
      if (this._verMasObserver) return;
      const main = document.getElementById('app-content');
      if (!main || typeof MutationObserver === 'undefined') return;
      this._verMasObserver = new MutationObserver(() => {
        if (this._verMasPendiente) return;
        this._verMasPendiente = true;
        requestAnimationFrame(() => {
            this._verMasPendiente = false;
          try { this._recolocarMarcoRegistro(main); } catch (e) { console.warn('[Marco]', e); }
          try { this._recolocarToggleVista(main); } catch (e) { console.warn('[Toggle]', e); }
          try { this.aplicarFiltrosListadoAuto(main); } catch (e) { console.warn('[Filtros]', e); }
          try { this.aplicarVerMasAuto(main); } catch (e) { console.warn('[VerMas]', e); }
        });
      });
      this._verMasObserver.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    },

    _toggleSidebar() {
      const sidebar = document.getElementById('erpSidebar');
      if (!sidebar) return;
      this._setSidebarCollapsed(sidebar.dataset.collapsed !== 'true');
    },

    /** Aplica visualmente el estado del sidebar y opcionalmente lo persiste. */

    _setSidebarCollapsed(collapsed, persist = true) {
      const sidebar = document.getElementById('erpSidebar');
      const toggle = document.getElementById('sidebarToggle');
      if (!sidebar || !toggle) return;

      const value = String(Boolean(collapsed));
      sidebar.dataset.collapsed = value;
      document.body.dataset.sidebarCollapsed = value;
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Desplegar menú' : 'Plegar menú');
      toggle.title = collapsed ? 'Desplegar menú (Alt+S)' : 'Plegar menú (Alt+S)';

      sidebar.querySelectorAll('.sidebar-link').forEach((link) => {
        const label = link.querySelector('.sidebar-link-label')?.textContent?.trim() || 'Abrir módulo';
        link.title = label;
      });

      if (persist) {
        try {
          localStorage.setItem('sidebar-collapsed', value);
        } catch (_) {}
      }
    },

    /** Construye el acordeón del sidebar a partir de App.NAV_GROUPS.
     *  Soporta subgrupos anidados: un item con `items` se renderiza como un
     *  subgrupo plegable (p.ej. los filtros de Agenda cuelgan bajo "Agenda").
     *  Sus hijos siempre son enlaces hoja con `route`. */

    _getGroupCollapsed(key) {
      // Por defecto COLAPSADO (true) en la primera carga (sin estado persistido en
      // localStorage): el usuario despliega los grupos de módulos de forma explícita.
      // Al volver a Inicio el acordeón se contrae por completo (ver _updateSidebarNavigation).
      try { return localStorage.getItem('sidebar-group-' + key) !== '0'; } catch (_) { return true; }
    },

    /** Pareja de _getGroupCollapsed: persiste si un grupo del acordeon esta
     *  colapsado. Se llamaba desde _toggleSidebarGroup y _expandSidebarGroup
     *  sin existir -> «this._setGroupCollapsed is not a function» en cuanto
     *  el usuario tocaba el sidebar. */
    _setGroupCollapsed(key, collapsed) {
      try { localStorage.setItem('sidebar-group-' + key, collapsed ? '1' : '0'); } catch (_) {}
    },

    _toggleSidebarGroup(btn) {
      const group = btn.closest('.sidebar-group');
      if (!group) return;
      const collapsed = !group.classList.contains('collapsed');
      group.classList.toggle('collapsed', collapsed);
      this._setGroupCollapsed(group.dataset.group, collapsed);
      btn.setAttribute('aria-expanded', String(!collapsed));
    },
    /** Pinta el pie de estado del sidebar: versión de la app, plan Free/Premium,
     *  fecha actual y nombre de la finca activa. Se refresca al cambiar de finca
     *  (evento 'fincaChanged') y al iniciar. */

    _expandSidebarGroup(group) {
      if (!group.classList.contains('collapsed')) return;
      group.classList.remove('collapsed');
      this._setGroupCollapsed(group.dataset.group, false);
      const btn = group.querySelector('[data-group-toggle]');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    },
    /** Contrae todos los grupos/subgrupos del sidebar (sin persistir). Usado al entrar
     *  en Inicio, donde ningún módulo está activo y no hay grupo que desplegar. */

    _collapseAllSidebarGroups() {
      const nav = document.getElementById('erpSidebarNav');
      if (!nav) return;
      nav.querySelectorAll('.sidebar-group[data-group]').forEach((g) => {
        g.classList.add('collapsed');
        const btn = g.querySelector('[data-group-toggle]');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    },

    /** Sincroniza el enlace activo del sidebar con la ruta actual y despliega
     *  automáticamente el grupo padre del submódulo activo. */
  };

  /** Inyecta el <aside> del sidebar al principio del body.
   *  Se crea desde JS en vez de dejarlo en index.html para que en movil ni
   *  siquiera exista en el DOM: sin los CSS de la piel (que solo cargan en
   *  >=1024px) se veria como un bloque suelto sobre el contenido. */
  function crearSidebarDOM() {
    if (document.getElementById('erpSidebar')) return;
    var aside = document.createElement('aside');
    aside.className = 'erp-sidebar';
    aside.id = 'erpSidebar';
    aside.setAttribute('aria-label', 'Menú principal');
    aside.innerHTML = [
      '<button class="sidebar-toggle" id="sidebarToggle" type="button" onclick="App._toggleSidebar()"',
      '        aria-label="Plegar/Desplegar menú" aria-expanded="true" title="Plegar menú (Alt+S)">',
      '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
      '       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '    <line x1="3" y1="6" x2="21" y2="6"/>',
      '    <line x1="3" y1="12" x2="21" y2="12"/>',
      '    <line x1="3" y1="18" x2="21" y2="18"/>',
      '  </svg>',
      '</button>',
      '<nav class="erp-sidebar-nav" id="erpSidebarNav" aria-label="Navegación de módulos"></nav>',
      '<div class="sidebar-status" id="sidebarStatus" aria-label="Estado de la aplicación"></div>'
    ].join('');
    document.body.insertBefore(aside, document.body.firstChild);
  }

  /** Instala la capa sobre App y engancha su arranque. */
  function instalar() {
    if (!window.App) return false;
    Object.assign(window.App, ErpShell);
    crearSidebarDOM();

    // El sidebar y sus helpers se montan una vez; _updateSidebarNavigation y
    // los helpers de listado deben correr tras CADA render, asi que se envuelve
    // App.route en lugar de editarla.
    try { App._setupSidebar(); } catch (e) { console.warn('[erp-shell] setup:', e); }
    try { App._observarVerMas(); } catch (e) { console.warn('[erp-shell] observer:', e); }

    var routeOriginal = App.route.bind(App);
    App.route = function () {
      var r = routeOriginal.apply(null, arguments);
      var despues = function () {
        var main = document.getElementById('app-content');
        try { App._updateSidebarNavigation(); } catch (e) {}
        try { App._recolocarMarcoRegistro(main); } catch (e) {}
        try { App._recolocarToggleVista(main); } catch (e) {}
        try { App.aplicarFiltrosListadoAuto(main); } catch (e) {}
        try { App.aplicarVerMasAuto(main); } catch (e) {}
      };
      if (r && typeof r.then === 'function') r.then(despues, despues);
      else despues();
      return r;
    };
    return true;
  }

  // App se define en app.js, que puede cargar despues de este script.
  if (!instalar()) {
    document.addEventListener('DOMContentLoaded', function () {
      if (!instalar()) console.warn('[erp-shell] App no disponible: capa no instalada');
    });
  }
})();
