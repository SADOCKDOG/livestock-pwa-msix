/**
 * Livestock Manager - InformesView v2.3.0 (núcleo)
 * Panel de Inteligencia Analítica — navegación, cabecera y renderizado de
 * cada pestaña. Los métodos de obtención de datos y de exportación
 * (Excel/PDF/compartir) están en informes-data.js e informes-export.js,
 * que deben cargar justo después de este archivo (extienden window.InformesView).
 */

const InformesView = {
  _currentTab: 'carne',
  _currentCategory: 'gegan',
  _cachedData: null,

  /** Formatea un número en es-ES con decimales fijos (auditoría F5: coherencia decimal). */
  _fmt(n, dec = 0) {
    return UI.formatNumber(n, dec);
  },

  _categories: {
    gegan: {
      label: "GeGan",
      icon: 'animales',
      tabs: {
        "general": "General",
        "por-finca": "Por Finca",
        "alertas": "Alertas",
        "carne": "Cárnico",
        "leche": "Lácteo",
        "reproductivo": "Repro",
        "sanidad": "Sanidad",
        "fitosanitario": "Fitosanitario",
        "curva-prod": "Curva",
        "censo": "Censo",
        "coste-prod": "Coste/Animal",
        "eficiencia": "Eficiencia",
        "rotacion": "Rotación",
        "rent-esp": "Rent. Especie"
      }
    },
    expro: {
      label: "Expro",
      icon: 'finca',
      tabs: {
        "general": "General",
        "por-finca": "Por Finca",
        "alertas": "Alertas",
        "cargas": "Aforos"
      }
    },
    comer: {
      label: "Comer",
      icon: 'compradores',
      tabs: {
        "ventas": "Ventas",
        "compradores": "Compradores",
        "proveedores": "Proveedores"
      }
    },
    libros: {
      label: "Libros",
      icon: 'documento',
      tabs: {
        "pyg": "P y G",
        "flujo-caja": "Flujo Caja",
        "breakeven": "Break-Even",
        "subvenciones": "PAC",
        "exportar": "Exportar",
        "rega": "REGA"
      }
    }
  },

  /** Las pestañas 'carne'/'leche' de GeGan solo se muestran si su tipo de explotación está activo. */
  _esTabPermitida(tabKey) {
    if (tabKey !== 'carne' && tabKey !== 'leche') return true;
    const flags = window.ModoContextoHelper?.getFlags() || { leche: true, carne: false };
    return tabKey === 'carne' ? !!flags.carne : !!flags.leche;
  },

  _obtenerCategoriaDeTab(tab) {
    for (const [catKey, cat] of Object.entries(this._categories)) {
      if (tab in cat.tabs) return catKey;
    }
    return 'gegan'; // Default to gegan instead of general
  },

  _obtenerIconoDeSubTab(tab) {
    switch (tab) {
      case 'general': return Icons.grafico();
      case 'por-finca': return Icons.finca();
      case 'alertas': return Icons.alerta();
      case 'carne': return Icons.carne();
      case 'leche': return Icons.leche();
      case 'reproductivo': return Icons.reproduccion();
      case 'sanidad': return Icons.sanidad();
      case 'fitosanitario': return Icons.fitosanitario();
      case 'curva-prod': return Icons.grafico();
      case 'censo': return Icons.animales();
      case 'coste-prod': return Icons.animales();
      case 'eficiencia': return Icons.grafico();
      case 'rotacion': return Icons.rotacion();
      case 'ventas': return Icons.libroVentas();
      case 'compradores': return Icons.compradores();
      case 'proveedores': return Icons.proveedores();
      case 'rega': return Icons.informeRega();
      case 'cargas': return Icons.balanza();
      case 'pyg': return Icons.dinero();
      case 'flujo-caja': return Icons.tendencia();
      case 'breakeven': return Icons.balanza();
      case 'subvenciones': return Icons.pac();
      case 'exportar': return Icons.exportar();
      case 'rent-esp': return Icons.reproduccion(); // Using reproduction icon for species profitability
      default: return '';
    }
  },

  _renderTabsHeader() {
    const activeCatKey = this._currentCategory;
    // Colores por categoría
    const catColors = {
      gegan: 'var(--c-success)',      // Green for GeGan (livestock/production)
      expro: 'var(--c-info)',         // Blue for Expro (farm operations)
      comer: 'var(--c-warning)',      // Orange/Yellow for Comer (commerce/trade)
      libros: 'var(--c-purple)'       // Purple for Libros (record books/ledgers)
    };
    const activeColor = catColors[activeCatKey] || 'var(--c-success)';

    // 1. Nivel 1: Categorías
    let catsHtml = `
      <div class="scroll-shadow-container scroll-tabs-row mb-6">
        <div class="informes-categories py-4" id="inf-cat-row">
    `;
    for (const [catKey, cat] of Object.entries(this._categories)) {
      const isActive = catKey === activeCatKey;
      const col = catColors[catKey] || 'var(--c-success)';
      catsHtml += `
        <button class="inf-cat-tab ${isActive ? 'active' : ''}"
                id="inf-cat-${catKey}"
                style="${isActive ? '--tab-color:' + col + '; background:' + col + '15; border-color:' + col + '; color:' + col + ' !important; box-shadow: 0 0 12px ' + col + '50;' : '--tab-color:' + col + ';'}"
                onclick="InformesView._cambiarCategoria('${catKey}')">
          ${Icons[cat.icon]()} ${cat.label.toUpperCase()}
        </button>
      `;
    }
    catsHtml += `
        </div>
      </div>
    `;

    // 2. Nivel 2: Sub-tabs de la categoría activa
    const activeCat = this._categories[activeCatKey];
    let subTabsHtml = `
      <div class="scroll-shadow-container scroll-tabs-row mb-12">
        <div class="informes-tabs py-2" id="inf-tab-row">
    `;
    for (const [tabKey, tabLabel] of Object.entries(activeCat.tabs)) {
      if (!this._esTabPermitida(tabKey)) continue;
      const isActive = tabKey === this._currentTab;
      const subTabIcon = this._obtenerIconoDeSubTab(tabKey);
      subTabsHtml += `
        <button class="inf-tab ${isActive ? 'active' : ''}"
                id="inf-tab-${tabKey}"
                data-tab="${tabKey}"
                style="${isActive ? '--tab-color:' + activeColor + '; background:' + activeColor + '18; border-color:' + activeColor + '; color:' + activeColor + ' !important; box-shadow: 0 0 8px ' + activeColor + '40;' : ''}"
                onclick="InformesView._cambiarTab('${tabKey}')">
          ${subTabIcon} ${tabLabel.toUpperCase()}
        </button>
      `;
    }
    subTabsHtml += `
        </div>
      </div>
    `;

    return catsHtml + subTabsHtml;
  },

  _cambiarCategoria(catKey) {
    this._currentCategory = catKey;
    const firstTab = Object.keys(this._categories[catKey].tabs).find(t => this._esTabPermitida(t));
    this._currentTab = firstTab;
    this._actualizarHeader();
    // Scroll automático al tab activo de categoría
    requestAnimationFrame(() => {
      const el = document.getElementById(`inf-cat-${catKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      const tel = document.getElementById(`inf-tab-${firstTab}`);
      if (tel) tel.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
    this._renderTabActual();
  },

  _cambiarTab(tab) {
    this._currentTab = tab;
    this._actualizarHeader();
    // Scroll automático al sub-tab activo
    requestAnimationFrame(() => {
      const el = document.getElementById(`inf-tab-${tab}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
    this._renderTabActual();
  },

  _actualizarHeader() {
    const headerContainer = document.getElementById("informes-header-navigation");
    if (headerContainer) {
      headerContainer.innerHTML = this._renderTabsHeader();
    }
  },

  async render() {
    const main = document.getElementById("app-content");

    // Si la pestaña activa dejó de estar permitida (p.ej. tras desactivar Carne o Leche), volver a una válida
    if (!this._esTabPermitida(this._currentTab)) {
      const firstTab = Object.keys(this._categories[this._currentCategory].tabs).find(t => this._esTabPermitida(t));
      this._currentTab = firstTab || 'general';
    }

    const chartLoadPromise = App._ensureChartJs();

    main.innerHTML = `
      <div id="informes-header-navigation" class="mb-14">
        ${this._renderTabsHeader()}
      </div>
      <div id="informes-content"><div class="loader">Cargando indicadores...</div></div>`;

    // Cargar datos
    const fId = await Fincas.getActiveId();
    try {
      const [
        rent, margenA, rentZ, censo, kpisRepro,
        estadisticasSanidad, lecheStats, gastosCat,
        gmdData, ventasHist, animales, rebanos,
        finca, ventasCompleto, docsLegales, transportistas, eventos, rawLeche,
        compradoresData, proveedoresData,         fitosanitarioData, alertasData, porFincaData,
        ventasPorRebano, lechePorRebano,
        pygData, costeProdData, rotacionData, cargasData, eficienciaData, flujoCajaData,
        rentEspData, curvaProdData, breakEvenData, pacData, sanitariosRaw
      ] = await Promise.all([
        Analitica.obtenerRentabilidadFinca(fId).catch(() => null),
        Analitica.obtenerMargenPorAnimal(fId).catch(() => []),
        Analitica.obtenerRentabilidadZonas(fId).catch(() => []),
        Analitica.obtenerCensoRebanos(fId).catch(() => []),
        Reproduccion.getKPIs(fId).catch(() => ({})),
        Analitica.obtenerEstadisticasSanitarias(fId).catch(() => ({})),
        this._obtenerMetricasLeche(fId),
        this._obtenerGastosPorCategoria(fId),
        this._obtenerGananciaDiaria(fId),
        this._obtenerHistorialVentas(fId),
        window.db.getAll('animales').catch(() => []),
        Rebanos.list().catch(() => []),
        Fincas.getActive().catch(() => null),
        window.db.getAll('comercializacion_carne').catch(() => []),
        window.db.getAll('documentos_legales').catch(() => []),
        window.db.getAll('transportistas').catch(() => []),
        window.db.getAll('registro_eventos').catch(() => []),
        window.db.getAll('comercializacion_leche').catch(() => []),
        this._obtenerMetricasCompradores(fId),
        this._obtenerMetricasProveedores(fId),
        this._obtenerDatosFitosanitarios(fId),
        this._obtenerAlertas(),
        this._obtenerDatosPorFinca(fId),
        this._obtenerVentasPorRebano(fId),
        this._obtenerLechePorRebano(fId),
        Analitica.obtenerCuentaResultados(fId).catch(() => ({ porMes: [], totalIngresos: 0, totalGastos: 0, totalBalance: 0, gastosPorCategoria: [], numMeses: 0, rentabilidad: '0,0' })),
        Analitica.obtenerCosteProduccionDiario(fId).catch(() => ({ porRebano: [], totalGasto: 0, totalAnimales: 0, costeMedioCabeza: 0, costeMedioDia: 0 })),
        Analitica.obtenerRotacionCenso(fId).catch(() => ({ ultimos90: {}, ultimos30: {}, totalAnimales: 0, activos: 0, tasaReposicion: '0%', tasaBajas: '0%', periodo: '90 días' })),
        Analitica.obtenerCargasAforos(fId).catch(() => ({ porZona: [], totalAforo: 0, totalOcupacion: 0, pctGlobal: '0', alertas: [], numAlertas: 0, numZonas: 0 })),
        Analitica.obtenerEficienciaTecnica(fId).catch(() => ({ kpis: [], activos: 0, totalLecheros: 0, numRebanos: 0, totalAnimales: 0 })),
        Analitica.obtenerFlujoCaja(fId).catch(() => ({ porMes: [], totalEntradas: 0, totalSalidas: 0, totalNeto: 0, saldoFinal: 0 })),
        Analitica.obtenerRentabilidadEspecie(fId).catch(() => ({ porEspecie: [], totalIngresos: 0, totalGastos: 0, totalBalance: 0 })),
        Analitica.obtenerCurvaProduccion(fId).catch(() => ({ porMes: [], totalKg: 0, totalLitros: 0, totalIngresos: 0, metaKg: 0, metaLitros: 0, pctCumplimientoKg: '0', pctCumplimientoLitros: '0' })),
        Analitica.obtenerBreakEven(fId).catch(() => ({ costesFijos: 0, costesVariables: 0, ingresosTotal: 0, breakEvenKg: 0, breakEvenLitros: 0, margenSeguridadKg: '0%', margenSeguridadLitros: '0%', cubiertoCarne: false, cubiertoLeche: false, numRebanos: 0, numMeses: 0 })),
        this._obtenerDatosPAC(fId),
        window.db.getAll('sanitarios_ganado').catch(() => []),
      ]);

      // Cachear data para los tabs
      this._cachedData = {
        _cachedLeche: rawLeche || [],
        rent, margenA, rentZ, censo, kpisRepro,
        estadisticasSanidad, lecheStats, gastosCat,
        gmdData, ventasHist, animales, rebanos, fId,
        finca, ventasCompleto, docsLegales, transportistas, eventos,
        compradoresData, proveedoresData, fitosanitarioData, alertasData, porFincaData,
        ventasPorRebano, lechePorRebano,
        pygData, costeProdData, rotacionData, cargasData, eficienciaData, flujoCajaData,
        rentEspData, curvaProdData, breakEvenData, pacData, sanitariosRaw
      };

      await chartLoadPromise;
      this._renderTabActual();
    } catch (e) {
      document.getElementById("informes-content").innerHTML =
        `<div class="card empty-state><p class="text-red">Error al cargar datos: ${e.message}</p></div>`;
    }
  },

  _renderTabActual() {
    const d = this._cachedData;
    if (!d) return;
    const content = document.getElementById("informes-content");
    if (!content) return;

    // Animación de salida
    content.style.opacity = '0';
    content.style.transform = 'translateY(6px)';

    try {
      switch (this._currentTab) {
        case 'general': this._renderGeneral(content, d); break;
        case 'por-finca': this._renderPorFinca(content, d); break;
        case 'alertas': this._renderAlertas(content, d); break;
        case 'carne': this._renderCarne(content, d); break;
        case 'leche': this._renderLeche(content, d); break;
        case 'reproductivo': this._renderReproductivo(content, d); break;
        case 'sanidad': this._renderSanidad(content, d); break;
        case 'fitosanitario': this._renderFitosanitario(content, d); break;
        case 'curva-prod': this._renderCurvaProduccion(content, d); break;
        case 'censo': this._renderCenso(content, d); break;
        case 'coste-prod': this._renderCosteProd(content, d); break;
        case 'eficiencia': this._renderEficiencia(content, d); break;
        case 'rotacion': this._renderRotacion(content, d); break;
        case 'ventas': this._renderVentas(content, d); break;
        case 'compradores': this._renderCompradores(content, d); break;
        case 'proveedores': this._renderProveedores(content, d); break;
        case 'rega': this._renderRega(content, d); break;
        case 'cargas': this._renderCargas(content, d); break;
        case 'pyg': this._renderPyG(content, d); break;
        case 'flujo-caja': this._renderFlujoCaja(content, d); break;
        case 'breakeven': this._renderBreakEven(content, d); break;
        case 'subvenciones': this._renderSubvenciones(content, d); break;
        case 'exportar': this._renderExportar(content, d); break;
        case 'rent-esp': this._renderRentabilidadEspecie(content, d); break;
        default: this._renderGeneral(content, d);
      }
    } catch (e) {
      console.error('[InformesView] Error en render:', e);
      content.innerHTML = `<div class="card empty-state"><p class="text-red text-base">${Icons.cerrar()} Error al mostrar: ${e.message}</p><p class="text-gray text-xs mt-6">Comprueba la consola para más detalles.</p></div>`;
    }

    // Animación de entrada suave
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        content.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
      });
    });

    // Scroll up after tab switch
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ===================== RENDER POR TABS =====================

  /** Genera barra de acciones PDF+Excel compacta e inline */
  _sectionActionsHTML(seccion, label) {
    return `
      <div class="inf-export-bar mb-14">
        <span class="inf-export-label">${label}</span>
        <div class="inf-export-btns">
          <button class="inf-export-btn inf-export-btn--pdf" onclick="InformesView._exportPDFSeccion('${seccion}')" title="Exportar ${label} a PDF">
            ${Icons.documento()} PDF
          </button>
          <button class="inf-export-btn inf-export-btn--excel" onclick="InformesView._exportExcel()" title="Exportar a Excel">
            ${Icons.exportar()} Excel
          </button>
          <button class="inf-export-btn inf-export-btn--full" onclick="InformesView._exportPDF()" title="Exportar informe completo">
            ${Icons.documento()} Completo
          </button>
        </div>
      </div>
    `;
  },

  _renderGeneral(content, d) {
    const { rent, censo, kpisRepro, estadisticasSanidad, lecheStats, margenA } = d;
    const balanceTotal = rent?.balance || 0;
    const pctRent = rent?.ingresos > 0 ? InformesView._fmt(((balanceTotal / rent.ingresos) * 100), 1) : '0,0';
    const totalAnimales = censo.reduce((s, r) => s + r.total, 0);
    const alertas = estadisticasSanidad?.retencionesActivas > 0;

    content.innerHTML = this._sectionActionsHTML('general', 'General') + `
      <!-- KPIs compactos -->
      <div class="inf-report">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-15">
        <div class="summary-cell"><div class="s-lbl">BALANCE</div><div class="s-val inf-val-lg ${balanceTotal >= 0 ? 'text-green' : 'text-red'}" style="word-break:break-all;">${UI.formatCurrency(balanceTotal)}</div></div>
        <div class="summary-cell"><div class="s-lbl">RENTAB.</div><div class="s-val inf-val-lg ${parseFloat(pctRent) > 0 ? 'text-green' : 'text-red'}">${pctRent}%</div></div>
        <div class="summary-cell"><div class="s-lbl">CENSO</div><div class="s-val inf-val-lg text-blue">${totalAnimales}</div></div>
        <div class="summary-cell"><div class="s-lbl">CARNE</div><div class="s-val inf-val-lg text-amber" style="word-break:break-all;">${UI.formatCurrency(rent?.detalles?.carne || 0)}</div></div>
        <div class="summary-cell"><div class="s-lbl">LECHE</div><div class="s-val inf-val-lg text-gold" style="word-break:break-all;">${UI.formatCurrency(rent?.detalles?.leche || 0)}</div></div>
        <div class="summary-cell"><div class="s-lbl">GASTOS</div><div class="s-val inf-val-lg text-red" style="word-break:break-all;">${UI.formatCurrency(rent?.gastos || 0)}</div></div>
      </div>

      ${alertas ? `<div class="card inf-alert-red>
          <div class="flex items-center gap-12">
            <span class="text-3xl text-red">${Icons.alerta()}</span>
            <div><strong class="text-red text-md uppercase font-950">${estadisticasSanidad.retencionesActivas} ${estadisticasSanidad.retencionesActivas === 1 ? "lote" : "lotes"}</strong><span class="text-aaa text-xs uppercase font-800 tracking-wider block">con supresión de venta activa</span></div>
          </div>
        </div>` : ''}

      <!-- Rentabilidad -->
      <div class="card report-section   report-card>
        <div class="inf-card-title pb-8 flex items-center gap-6">${Icons.dinero()} Rentabilidad General</div>
        <div class="card p-14 mb-2 border-222 style="">
          <div class="flex flex-col">
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Ingresos Cárnica</span>
              <strong class="text-xl font-950 text-amber">${UI.formatCurrency(rent?.detalles?.carne || 0)}</strong>
            </div>
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Ingresos Láctea</span>
              <strong class="text-xl font-950 text-gold">${UI.formatCurrency(rent?.detalles?.leche || 0)}</strong>
            </div>
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Alimentación Estimada</span>
              <strong class="text-base font-900 text-red">−${UI.formatCurrency(rent?.detalles?.alimentacion_estimada || 0)}</strong>
            </div>
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Otros Gastos</span>
              <strong class="text-base font-900 text-red">−${UI.formatCurrency(rent?.detalles?.otros_gastos || 0)}</strong>
            </div>
            <div class="py-12 flex justify-between items-center">
              <span class="text-xs text-white uppercase font-950">Balance Neto</span>
              <span class="text-2xl font-950 ${balanceTotal >= 0 ? 'text-green' : 'text-red'}">${UI.formatCurrency(balanceTotal)}  <span class="text-base font-800">(${pctRent}%)</span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Margen Neto -->
      <div class="card report-section   report-card>
        <div class="inf-card-title flex items-center gap-6">${Icons.grafico()} Margen Neto por Animal</div>
        ${margenA && margenA.length > 0
        ? '<div class="chart-wrap"><canvas id="chart-margen-animal" class="chart-canvas"></canvas></div>'
        : `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.alerta()}</div><p class="empty-state-text uppercase font-900 text-xs">No hay datos de ventas para calcular márgenes individuales. Registra ventas de carne para ver esta gráfica.</p></div>`}
      </div>

        <div class="grid grid-cols-2 gap-12 mb-14">
          <div class="card   p-14 bg-black-opacity-50>
            <div class="inf-card-title mb-10 flex items-center gap-6 justify-center">${Icons.reproduccion()} REPRODUCTIVO</div>
            <div class="grid grid-cols-2 gap-6">
              <div class="info-box-center py-6">
                <small class="s-lbl">FERTILIDAD</small>
                <strong class="text-white text-md font-900">${kpisRepro.tasaFertilidadPct}%</strong>
              </div>
              <div class="info-box-center py-6">
                <small class="s-lbl">IEP (DÍAS)</small>
                <strong class="text-white text-md font-900">${kpisRepro.intervaloEntrePartosDias}</strong>
              </div>
            </div>
            <div class="text-center mt-8">
              <span class="text-violet font-900 text-[0.6rem] tracking-widest uppercase">Prolificidad: ${kpisRepro.indiceProlificidad}</span>
            </div>
          </div>
          <div class="card   p-14 bg-black-opacity-50>
            <div class="inf-card-title mb-10 flex items-center gap-6 justify-center">${Icons.sanidad()} SANIDAD</div>
            <div class="grid grid-cols-2 gap-6">
              <div class="info-box-center py-6">
                <small class="s-lbl">TRATAM.</small>
                <strong class="text-white text-md font-900">${estadisticasSanidad.totalTratamientos || 0}</strong>
              </div>
              <div class="info-box-center py-6">
                <small class="s-lbl">SUPRESIÓN</small>
                <strong class="text-red text-md font-900">${estadisticasSanidad.retencionesActivas || 0}</strong>
              </div>
            </div>
          </div>
        </div>

      <!-- Leche mini -->
      <!-- Comparativa mensual PyG -->
      ${d.pygData?.porMes?.length > 0 ? (() => {
        const meses = d.pygData.porMes.filter(m => m.ingresos > 0 || m.gastos > 0);
        const actual = meses[meses.length - 1];
        const anterior = meses[meses.length - 2];
        if (!actual) return '';
        const diffBalance = actual.balance - (anterior?.balance || 0);
        const diffIngresos = actual.ingresos - (anterior?.ingresos || 0);
        return `<div class="card report-section   report-card>
          <div class="inf-card-title flex items-center gap-6 mb-12">${Icons.calendar()} Comparativa Mensual</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-10">
            <div class="info-box-center border-left-blue py-10">
              <small class="s-lbl uppercase mb-4">MES ACTUAL</small>
              <div class="inf-val-md text-white font-900 mb-6">${actual.mes}</div>
              <div class="text-xs">Ingresos: <strong class="text-green">${UI.formatCurrency(actual.ingresos)}</strong></div>
              <div class="text-xs">Gastos: <strong class="text-red">${UI.formatCurrency(actual.gastos)}</strong></div>
              <div class="text-sm mt-4 font-900">Balance: <strong class="${actual.balance >= 0 ? 'text-green' : 'text-red'}">${UI.formatCurrency(actual.balance)}</strong></div>
            </div>
            <div class="info-box-center border-left-amber py-10">
              <small class="s-lbl uppercase mb-4">VS MES ANTERIOR</small>
              <div class="inf-val-md text-white font-900 mb-6">${anterior?.mes || '—'}</div>
              <div class="text-xs">Ingresos: <strong class="${diffIngresos >= 0 ? 'text-green' : 'text-red'}">${diffIngresos >= 0 ? '+' : ''}${UI.formatCurrency(diffIngresos)}</strong></div>
              <div class="text-sm mt-4 font-900">Balance: <strong class="${diffBalance >= 0 ? 'text-green' : 'text-red'}">${diffBalance >= 0 ? '+' : ''}${UI.formatCurrency(diffBalance)}</strong></div>
            </div>
          </div>
        </div>`;
      })() : ''}

      ${lecheStats.totalLitros > 0 ? `<div class="card report-section   report-card>
        <div class="inf-card-title flex items-center gap-6 mb-12">${Icons.leche()} Producción Lechera</div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
          <div class="info-box-center py-10"><small class="s-lbl">TOTAL</small><div class="inf-val-lg text-gold font-950">${this._fmt(lecheStats.totalLitros, 1)} L</div></div>
          <div class="info-box-center py-10"><small class="s-lbl">PROM/DÍA</small><div class="inf-val-lg text-amber font-950">${this._fmt(lecheStats.promedioDiario, 1)} L</div></div>
          <div class="info-box-center py-10"><small class="s-lbl">PRECIO</small><div class="inf-val-lg text-dark-gold font-950">${this._fmt(lecheStats.precioMedio, 3)}€</div></div>
        </div>
        ${lecheStats.timeline?.length > 1 ? '<div class="chart-wrap"><canvas id="chart-leche-timeline" class="chart-canvas-sm"></canvas></div>' : ''}
      </div>` : ''}
      </div>`;

    // Renderizar gráficos del tab general
    this._renderGraficosGeneral(d);
  },

  _renderCarne(content, d) {
    const { rent, margenA, ventasHist, gastosCat, rentZ, ventasPorRebano, eventos } = d;
    const totalIngresos = rent?.detalles?.carne || 0;
    const totalVentas = ventasHist.length;
    const kgTotal = ventasHist.reduce((s, v) => s + (v.kg || 0), 0);
    const precioMedioKg = kgTotal > 0 ? (totalIngresos / kgTotal) : 0;
    // GMD media simple desde eventos de control
    const eventosCarne = (eventos || []).filter(e => e.motivo_tarea === 'control' && e.unidad === 'kg');
    const gmdMedia = eventosCarne.length > 1 ? (() => {
      const sorted = eventosCarne.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      const primero = sorted[0], ultimo = sorted[sorted.length - 1];
      const dias = Math.max(1, (new Date(ultimo.fecha) - new Date(primero.fecha)) / (1000 * 60 * 60 * 24));
      return InformesView._fmt((ultimo.valor_neto - primero.valor_neto) / dias, 3);
    })() : null;

    content.innerHTML = this._sectionActionsHTML('carne', 'Cárnico') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.carne()} Resumen Cárnico</div>
        <div class="card p-12 mb-14 border-222 style="background: rgba(255, 255, 255, 0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-8 text-center">
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Ingresos Totales</small>
              <span class="text-xl text-amber font-950 truncate w-full px-4" title="${UI.formatCurrency(totalIngresos)}">${UI.formatCurrency(totalIngresos)}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Ventas Realizadas</small>
              <span class="text-xl text-blue font-950">${totalVentas}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">kg Totales</small>
              <span class="text-xl text-green font-950">${InformesView._fmt(kgTotal, 1)} kg</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Precio Medio kg</small>
              <span class="text-xl text-violet font-950">${InformesView._fmt(precioMedioKg, 2)}€/kg</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Peso Medio Sacrif.</small>
              <span class="text-xl text-gold font-950">${ventasHist.length > 0 ? InformesView._fmt((kgTotal / ventasHist.reduce((s, v) => s + (v.animales || 1), 0)), 1) + ' kg' : '—'}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">GMD Media Global</small>
              <span class="text-xl font-950 ${gmdMedia !== null && parseFloat(gmdMedia) > 0 ? 'text-green' : 'text-neutral'}">${gmdMedia !== null ? gmdMedia + ' kg/d' : '—'}</span>
            </div>
          </div>
        </div>

        ${margenA && margenA.length > 0
        ? `<div class="chart-wrap mb-12"><canvas id="chart-margen-animal-carne" class="chart-canvas"></canvas></div>`
        : `<div class="empty-state mb-12 border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.alerta()}</div><p class="empty-state-text uppercase font-900 text-xs">No hay datos de márgenes individuales</p></div>`}

        ${rentZ && rentZ.length > 0
        ? `<div class="chart-wrap mb-12"><canvas id="chart-rentabilidad-zonas-carne" class="chart-canvas"></canvas></div>`
        : ''}

        ${ventasHist.length > 0 ? `
        <div class="inf-section-title uppercase font-900">Últimas ventas</div>
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table tbl-accent-amber">
            <thead><tr><th>Fecha</th><th>Animales</th><th>kg</th><th>Total</th></tr></thead>
            <tbody>${ventasHist.slice(0, 10).map(v => `
              <tr><td>${v.fecha || '-'}</td><td class="font-900">${v.animales || 1}</td><td class="font-900">${v.kg || '-'}</td><td class="text-green font-950">${UI.formatCurrency(v.total || 0)}</td></tr>`).join('')}</tbody>
          </table>
        </div>` : `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.buscar()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin ventas registradas</p></div>`}

        ${ventasPorRebano?.length > 0 ? `
        <div class="inf-section-title">Rentabilidad por rebaño</div>
        <div class="grid grid-cols-1 gap-6 mb-10">
          ${ventasPorRebano.map(r => `
            <div class="info-box-sm flex justify-between items-center">
              <span class="text-aaa text-sm">${Icons.rebanos()} ${r.rebano}</span>
              <div class="text-right">
                <span class="text-amber font-800">${UI.formatCurrency(r.total)}</span>
                <span class="text-gray text-xs ml-6">${InformesView._fmt(r.kg, 1)} kg</span>
                <span class="text-blue text-xs ml-6">${r.numVentas} ${r.numVentas === 1 ? 'venta' : 'ventas'}</span>
              </div>
            </div>`).join('')}
        </div>` : ''}
      </div>
    `;

    // Render gráficos si hay datos
    setTimeout(() => {
      try {
        if (margenA?.length > 0) this._renderScatter('chart-margen-animal-carne', margenA, 'var(--c-warning)');
        if (rentZ?.length > 0) this._renderBarrasZonas('chart-rentabilidad-zonas-carne', rentZ);
      } catch (e) { console.error('[Carne charts]', e); }
    }, 50);
  },

  _renderLeche(content, d) {
    const { lecheStats, lechePorRebano, _cachedLeche } = d;
    const rawLeche = _cachedLeche || [];
    if (!lecheStats || lecheStats.totalLitros === 0) {
      content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${Icons.leche()}</div><p class="empty-state-text">No hay datos de producción lechera registrados.</p></div>`;
      return;
    }
    // Calcular métricas de calidad desde los datos crudos
    const conLab = rawLeche.filter(e => e.laboratorio?.grasa != null);
    const grasaMedia = conLab.length > 0 ? conLab.reduce((s, e) => s + (e.laboratorio.grasa || 0), 0) / conLab.length : 0;
    const protMedia = conLab.length > 0 ? conLab.reduce((s, e) => s + (e.laboratorio.proteina || 0), 0) / conLab.length : 0;
    const esMedia = conLab.length > 0 ? conLab.reduce((s, e) => s + (e.laboratorio.extracto_seco || (e.laboratorio.grasa + e.laboratorio.proteina) || 0), 0) / conLab.length : 0;
    const somaticasMedia = conLab.length > 0 ? conLab.reduce((s, e) => s + (e.laboratorio.somaticas || 0), 0) / conLab.length : 0;
    // MOFA
    const mofaTotal = rawLeche.reduce((s, e) => s + (e.mofa || 0), 0);
    const importeTotal = rawLeche.reduce((s, e) => s + (e.importe_total || e.cantidad * e.precioBase || 0), 0);
    const mofaRatio = importeTotal > 0 ? InformesView._fmt(((mofaTotal / importeTotal) * 100), 1) : 0;
    // Umbrales de calidad
    const umbrales = window.ComunidadesService?.CALIDAD_LECHE_OVINO_UMBRALES || null;
    const semaforo = (valor, min, max) => {
      if (valor == null) return '#555';
      if (min != null && valor < min) return 'var(--c-danger)';
      if (max != null && valor > max) return 'var(--c-danger)';
      return 'var(--c-success)';
    };

    content.innerHTML = this._sectionActionsHTML('leche', 'Lácteo') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.leche()} Producción Láctea</div>
        <div class="card p-12 mb-14 border-222 style="background: rgba(255, 255, 255, 0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-8 text-center">
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Total Litros</small>
              <span class="text-xl text-gold font-950 truncate w-full px-4" title="${this._fmt(lecheStats.totalLitros, 1)} L">${this._fmt(lecheStats.totalLitros, 1)} L</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Promedio/Día</small>
              <span class="text-xl text-amber font-950">${this._fmt(lecheStats.promedioDiario, 1)} L</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Precio Medio</small>
              <span class="text-xl text-dark-gold font-950">${this._fmt(lecheStats.precioMedio, 3)}€/L</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Rendimiento Medio</small>
              <span class="text-xl text-blue font-950">${(() => {
                const censoActivo = (d.animales || []).filter(a => a.estado === 'activo' || a.estado === 'Activo').length;
                return censoActivo > 0 ? InformesView._fmt(lecheStats.promedioDiario / censoActivo, 2) : '0,00';
              })()} L/cab</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Registros</small>
              <span class="text-xl text-white font-950">${lecheStats.totalRegistros} ent.</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">MOFA Total</small>
              <span class="text-xl font-950 ${mofaTotal >= 0 ? 'text-green' : 'text-red'} truncate w-full px-4" title="${(mofaTotal >= 0 ? '+' : '')}${UI.formatCurrency(Math.round(mofaTotal))}">${(mofaTotal >= 0 ? '+' : '')}${UI.formatCurrency(Math.round(mofaTotal))}</span>
            </div>
          </div>
        </div>

        ${conLab.length > 0 ? `
        <div class="card mb-14 p-12 card-tint-amber>
          <div class="inf-section-title mb-10 text-center uppercase font-950">${Icons.fitosanitario()} Calidad de la Leche (${conLab.length} analíticas)</div>
          <div class="grid grid-cols-2 gap-8">
            <div class="info-box-center py-10" style="border-left:3px solid ${semaforo(grasaMedia, umbrales?.grasa?.min, null)};">
              <small class="s-lbl uppercase font-900">GRASA</small>
              <div class="inf-val-md font-950" style="color:${semaforo(grasaMedia, umbrales?.grasa?.min, null)}">${InformesView._fmt(grasaMedia, 2)}%</div>
              ${umbrales ? `<small class="text-gray text-[0.55rem] uppercase font-800 mt-4">Obj: ≥${umbrales.grasa.min}%</small>` : ''}
            </div>
            <div class="info-box-center py-10" style="border-left:3px solid ${semaforo(protMedia, umbrales?.proteina?.min, null)};">
              <small class="s-lbl uppercase font-900">PROTEÍNA</small>
              <div class="inf-val-md font-950" style="color:${semaforo(protMedia, umbrales?.proteina?.min, null)}">${InformesView._fmt(protMedia, 2)}%</div>
              ${umbrales ? `<small class="text-gray text-[0.55rem] uppercase font-800 mt-4">Obj: ≥${umbrales.proteina.min}%</small>` : ''}
            </div>
            <div class="info-box-center py-10" style="border-left:3px solid ${semaforo(esMedia, umbrales?.extracto_seco?.min, null)};">
              <small class="s-lbl uppercase font-900">EXTRACTO SECO</small>
              <div class="inf-val-md font-950" style="color:${semaforo(esMedia, umbrales?.extracto_seco?.min, null)}">${InformesView._fmt(esMedia, 2)}%</div>
              ${umbrales ? `<small class="text-gray text-[0.55rem] uppercase font-800 mt-4">Obj: ≥${umbrales.extracto_seco.min}%</small>` : ''}
            </div>
            <div class="info-box-center py-10" style="border-left:3px solid ${semaforo(somaticasMedia, null, umbrales?.somaticas?.max)};">
              <small class="s-lbl uppercase font-900">CÉL. SOMÁTICAS</small>
              <div class="inf-val-md font-950" style="color:${semaforo(somaticasMedia, null, umbrales?.somaticas?.max)}">${UI.formatNumber(Math.round(somaticasMedia))}</div>
              ${umbrales ? `<small class="text-gray text-[0.55rem] uppercase font-800 mt-4">Obj: ≤${InformesView._fmt((umbrales.somaticas.max / 1000), 0)}k</small>` : ''}
            </div>
          </div>
        </div>` : ''}

        ${lechePorRebano?.length > 0 ? `
        <div class="inf-section-title">Producción por rebaño</div>
        <div class="grid grid-cols-1 gap-6 mb-10">
          ${lechePorRebano.map(r => `
            <div class="info-box-sm flex justify-between items-center bg-black border border-222">
              <span class="text-ccc text-sm uppercase font-900 flex items-center gap-6">${Icons.rebanos()} ${r.rebano}</span>
              <div class="text-right">
                <span class="text-gold font-950 text-md">${InformesView._fmt(r.litros, 1)} L</span>
                <span class="text-green text-xs font-900 ml-8">${UI.formatCurrency(r.importe)}</span>
              </div>
            </div>`).join('')}
        </div>` : ''}

        ${lecheStats.timeline?.length > 1
        ? '<div class="chart-wrap"><canvas id="chart-leche-timeline" class="chart-canvas"></canvas></div>'
        : '<div class="inf-small p-16 text-center text-555">Se necesitan al menos 2 registros para mostrar la evolución.</div>'}
      </div>
    `;
    setTimeout(() => {
      if (lecheStats.timeline?.length > 1) this._renderLecheTimeline('chart-leche-timeline', lecheStats.timeline);
    }, 50);
  },

  _renderReproductivo(content, d) {
    const { kpisRepro, eventos } = d;
    // Calcular distribución estacional de partos desde eventos
    const partos = (eventos || []).filter(e => e.motivo_tarea === 'parto' || e.motivo_tarea === 'nacimiento');
    const porTrimestre = { 'Q1 (Ene-Mar)': 0, 'Q2 (Abr-Jun)': 0, 'Q3 (Jul-Sep)': 0, 'Q4 (Oct-Dic)': 0 };
    partos.forEach(e => {
      const m = new Date(e.fecha).getMonth();
      if (m < 3) porTrimestre['Q1 (Ene-Mar)']++;
      else if (m < 6) porTrimestre['Q2 (Abr-Jun)']++;
      else if (m < 9) porTrimestre['Q3 (Jul-Sep)']++;
      else porTrimestre['Q4 (Oct-Dic)']++;
    });
    const abortos = (eventos || []).filter(e => e.motivo_tarea === 'aborto').length;
    const totalEventos = partos.length + abortos;
    const tasaAbortos = totalEventos > 0 ? InformesView._fmt(((abortos / totalEventos) * 100), 1) : 0;

    content.innerHTML = this._sectionActionsHTML('reproductivo', 'Reproductivo') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.reproduccion()} KPIs Reproductivos</div>
        <div class="card p-14 mb-14 border-222 style="">
          <div class="flex flex-col">
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Fertilidad</span>
              <strong class="text-xl font-950 text-purple">${kpisRepro.tasaFertilidadPct}%</strong>
            </div>
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Intervalo Entre Partos (IEP)</span>
              <strong class="text-xl font-950 text-purple">${kpisRepro.intervaloEntrePartosDias} ${Number(kpisRepro.intervaloEntrePartosDias) === 1 ? 'día' : 'días'}</strong>
            </div>
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Prolificidad</span>
              <strong class="text-xl font-950 text-purple">${kpisRepro.indiceProlificidad}</strong>
            </div>
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Total Partos</span>
              <strong class="text-xl font-950 text-blue">${kpisRepro.totalPartosAnalizados}</strong>
            </div>
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Ratio de Abortos</span>
              <strong class="text-xl font-950 ${parseFloat(tasaAbortos) > 10 ? 'text-red' : 'text-green'}">${tasaAbortos}% <span class="text-xs text-gray font-700">(${abortos} de ${totalEventos})</span></strong>
            </div>
            <div class="py-10 flex justify-between items-center">
              <span class="text-xs text-gray uppercase font-900">Distribución de Partos</span>
              <strong class="text-xl font-950 text-blue">${partos.length}</strong>
            </div>
          </div>
        </div>
        ${partos.length > 0 ? `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          ${Object.entries(porTrimestre).filter(([_, v]) => v > 0).map(([trim, count]) => `
            <div class="info-box-center py-8">
              <small class="s-lbl">${trim}</small>
              <div class="flex items-center gap-6">
                <strong class="text-white text-md font-900">${count}</strong>
                <span class="text-gray text-[0.6rem] font-800">(${InformesView._fmt(((count / partos.length) * 100), 0)}%)</span>
              </div>
            </div>`).join('')}
        </div>` : ''}
        <div class="mt-12"><canvas id="chart-repro-kpis" class="chart-canvas"></canvas></div>
      </div>
    `;
    setTimeout(() => {
      const ctxR = document.getElementById("chart-repro-kpis");
      if (ctxR && kpisRepro.tasaFertilidadPct !== undefined) {
        new Chart(ctxR.getContext("2d"), {
          type: 'doughnut',
          data: { labels: ['Éxito', 'Fallo'], datasets: [{ data: [kpisRepro.tasaFertilidadPct, 100 - kpisRepro.tasaFertilidadPct], backgroundColor: ['#4FADF5', '#3730a3'], borderColor: '#111', borderWidth: 4 }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
        });
      }
    }, 50);
  },

  _renderSanidad(content, d) {
    const { estadisticasSanidad, gastosCat, rebanos, animales, eventos, sanitariosRaw } = d;
    // Calcular coste sanitario por animal
    const gastosSanitarios = (gastosCat || []).filter(g => (g.categoria || '').toLowerCase() === 'sanidad');
    const totalGastoSanidad = gastosSanitarios.reduce((s, g) => s + g.total, 0);
    const totalAnimalesActivos = (animales || []).filter(a => a.estado === 'activo').length;
    const costeSanitarioAnimal = totalAnimalesActivos > 0 ? (totalGastoSanidad / totalAnimalesActivos) : 0;
    // Tratamientos por rebaño
    const sanitariosTotal = sanitariosRaw || [];
    const tratPorRebano = {};
    const mapaReb = {};
    (rebanos || []).forEach(r => { mapaReb[r.id] = r; });
    sanitariosTotal.forEach(s => {
      const nom = mapaReb[s.rebanoId]?.nombre || 'Sin rebaño';
      tratPorRebano[nom] = (tratPorRebano[nom] || 0) + 1;
    });

    content.innerHTML = this._sectionActionsHTML('sanidad', 'Sanidad') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.sanidad()} Sanidad y Tratamientos</div>
        <div class="card p-14 mb-14 border-222 style="background:rgba(239,68,68,0.02);">
          <div class="flex flex-col">
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Total Tratamientos</span>
              <strong class="text-xl font-950 text-red">${estadisticasSanidad.totalTratamientos || 0}</strong>
            </div>
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-xs text-gray uppercase font-900">Supresión de Venta Activa</span>
              <strong class="text-xl font-950 ${(estadisticasSanidad.retencionesActivas || 0) > 0 ? 'text-red' : 'text-green'}">${estadisticasSanidad.retencionesActivas || 0} lotes</strong>
            </div>
            <div class="py-10 flex justify-between items-center">
              <span class="text-xs text-gray uppercase font-900">Coste Sanitario / Animal</span>
              <strong class="text-xl font-950 ${costeSanitarioAnimal > 0 ? 'text-amber' : 'text-gray'}">${costeSanitarioAnimal > 0 ? InformesView._fmt(costeSanitarioAnimal, 2) + ' €' : '—'}</strong>
            </div>
          </div>
        </div>
        ${Object.keys(tratPorRebano).length > 0 ? `
        <div class="mb-12">
          <div class="inf-section-title text-center uppercase font-900 mb-8">Tratamientos por rebaño</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            ${Object.entries(tratPorRebano).sort((a, b) => b[1] - a[1]).map(([nom, cnt]) => `
              <div class="info-box-center py-8">
                <small class="s-lbl">${nom}</small>
                <strong class="text-md font-900 text-red">${cnt}</strong>
              </div>`).join('')}
          </div>
        </div>` : ''}
        ${estadisticasSanidad.porCategoria?.length > 0
        ? '<div class="chart-wrap"><canvas id="chart-sanidad-kpis" class="chart-canvas"></canvas></div>'
        : `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.sanidad()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin tratamientos registrados.</p></div>`}
      </div>
      ${gastosCat.length > 0 ? `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.gastos()} Gastos por Categoría</div>
        <div class="grid grid-cols-2 gap-10 mb-10">
          ${gastosCat.slice(0, 6).map(g => `
            <div class="info-box-sm">
              <div class="s-lbl">${g.categoria}</div>
              <div class="inf-val-md text-red">${UI.formatCurrency(g.total)}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}
    `;
    setTimeout(() => {
      const ctxS = document.getElementById("chart-sanidad-kpis");
      if (ctxS && estadisticasSanidad.porCategoria?.length > 0) {
        new Chart(ctxS.getContext("2d"), {
          type: 'pie',
          data: {
            labels: estadisticasSanidad.porCategoria.map(c => c.categoria),
            datasets: [{ data: estadisticasSanidad.porCategoria.map(c => c.cantidad), backgroundColor: ['#E8555F', '#E8555F', '#FFFC55', '#C5FA50', '#4FADF5', '#4FADF5'], borderColor: '#111', borderWidth: 2 }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
      }
    }, 50);
  },

  _renderCenso(content, d) {
    const { censo, rebanos, animales } = d;
    const totalAnimales = censo.reduce((s, r) => s + r.total, 0);
    const totalActivos = censo.reduce((s, r) => s + r.activos, 0);
    const totalVendidos = censo.reduce((s, r) => s + r.vendidos, 0);

    // Agrupar por especie
    const porEspecie = {};
    censo.forEach(r => {
      const esp = r.tipo || 'Sin tipo';
      porEspecie[esp] = (porEspecie[esp] || 0) + r.total;
    });

    content.innerHTML = this._sectionActionsHTML('censo', 'Censo') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.animales()} Censo General</div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Total Censo</small>
              <span class="text-xl text-blue font-950">${totalAnimales}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Activos</small>
              <span class="text-xl text-green font-950">${totalActivos}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Vendidos</small>
              <span class="text-xl text-red font-950">${totalVendidos}</span>
            </div>
          </div>
        </div>

        ${Object.keys(porEspecie).length > 0 ? `
        <div class="inf-section-title text-center uppercase font-900 mb-8">Por especie/tipo</div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
          ${Object.entries(porEspecie).map(([esp, count]) => `
            <div class="info-box-center py-8">
              <small class="s-lbl">${esp}</small>
              <strong class="text-xl text-white font-950">${count}</strong>
            </div>`).join('')}
        </div>` : ''}

        ${animales?.length > 0 ? (() => {
          const porCategoria = {};
          animales.forEach(a => { const cat = a.categoria || 'Sin categoría'; porCategoria[cat] = (porCategoria[cat] || 0) + 1; });
          const totalCats = Object.keys(porCategoria).length;
          return totalCats > 0 ? `
        <div class="inf-section-title text-center uppercase font-900 mb-8">Por categoría productiva</div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
          ${Object.entries(porCategoria).map(([cat, cnt]) => `
            <div class="info-box-center py-8">
              <small class="s-lbl">${cat}</small>
              <div class="flex flex-col items-center">
                <strong class="text-xl text-white font-950">${cnt}</strong>
                <span class="text-gray text-[0.6rem] font-800 uppercase tracking-wider">${InformesView._fmt(((cnt / animales.length) * 100), 1)}%</span>
              </div>
            </div>`).join('')}
        </div>` : '';
        })() : ''}

        <div class="inf-section-title">Detalle por rebaño</div>
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table tbl-accent-green">
            <thead><tr><th>Rebaño</th><th>Tipo</th><th>Total</th><th>Activos</th><th class="text-red">Vendidos</th></tr></thead>
            <tbody>${censo.map(r => `
              <tr><td><strong>${r.nombre}</strong></td><td class="text-gray">${r.tipo}</td><td class="font-800">${r.total}</td><td class="text-green">${r.activos}</td><td class="text-red">${r.vendidos}</td></tr>`).join('') || '<tr><td colspan="5" class="text-gray text-center">Sin datos de censo</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ===================== LIBRO DE VENTAS =====================

  _renderVentas(content, d) {
    const { ventasCompleto, docsLegales, finca, fId } = d;
    const ventas = (ventasCompleto || [])
      .filter(v => Number(v.fincaId) === Number(fId))
      .sort((a, b) => new Date(b.fechaSacrificio || b.fecha_emision || 0) - new Date(a.fechaSacrificio || a.fecha_emision || 0));

    const totalKg = ventas.reduce((s, v) => s + (v.pesoCanal || v.pesoVivo || 0), 0);
    const totalImporte = ventas.reduce((s, v) => s + (v.precio_total || 0), 0);
    const totalIVA = ventas.reduce((s, v) => s + (v.importe_iva || 0), 0);
    const totalRetencion = ventas.reduce((s, v) => s + (v.importe_retencion || 0), 0);

    content.innerHTML = this._sectionActionsHTML('ventas', 'Ventas') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.libroVentas()} Libro de Ventas</div>
        <div class="card p-12 mb-14 border-222 style="background: rgba(255, 255, 255, 0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-8 text-center">
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Total Ventas</small>
              <span class="text-xl text-blue font-950">${ventas.length}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Peso Total (kg)</small>
              <span class="text-xl text-green font-950">${InformesView._fmt(totalKg, 1)}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Importe Total</small>
              <span class="text-xl text-amber font-950 truncate w-full px-4" title="${UI.formatCurrency(totalImporte)}">${UI.formatCurrency(totalImporte)}</span>
            </div>
          </div>
        </div>

        ${ventas.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">${Icons.exportacion()}</div><p class="empty-state-text">No hay ventas registradas</p></div>' : `
        <div class="table-scroll scroll-shadow-container mt-10">
          <table class="inf-table tbl-accent-blue">
            <thead>
              <tr>
                <th>FECHA</th>
                <th>ALBARÁN</th>
                <th>COMPRADOR</th>
                <th>NIF</th>
                <th class="text-right">kg</th>
                <th class="text-right">€/kg MEDIO</th>
                <th class="text-right">BASE</th>
                <th class="text-right">IVA</th>
                <th class="text-right">RET. IRPF</th>
                <th class="text-right">TOTAL NETO</th>
                <th class="text-center">DIMOE / SIGGAN</th>
              </tr>
            </thead>
            <tbody>
              ${ventas.map(v => {
                const tieneDimoe = (docsLegales || []).some(d => d.tipo === 'dimoe' && Number(d.ventaId) === Number(v.id));
                const kg = v.pesoCanal || v.pesoVivo || 0;
                const base = (v.precio_total || 0) - (v.importe_iva || 0);
                const precioKg = kg > 0 ? InformesView._fmt((base / kg), 2) : '0,00';
                const irpf = v.importe_retencion || 0;
                const neto = (v.precio_total || 0) - irpf;
                return `<tr>
                  <td class="nowrap">${v.fechaSacrificio || v.fecha_emision || '-'}</td>
                  <td><strong>${v.numero_albaran || '-'}</strong></td>
                  <td>${v.razonSocial || v.nombreComprador || '-'}</td>
                  <td>${v.nifComprador || v.nif || '-'}</td>
                  <td class="text-right">${InformesView._fmt(kg, 1)}</td>
                  <td class="text-right font-bold text-gray">${precioKg} €/kg</td>
                  <td class="text-right">${InformesView._fmt(base, 2)}€</td>
                  <td class="text-right text-blue">${InformesView._fmt((v.importe_iva || 0), 2)}€</td>
                  <td class="text-right text-red">${InformesView._fmt(irpf, 2)}€</td>
                  <td class="text-right font-bold text-green">${InformesView._fmt(neto, 2)}€</td>
                  <td class="text-center">${tieneDimoe ? '${Icons.check()} DIMOE' : '${Icons.check()} SIGGAN'}</td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="text-right text-gray">TOTALES</td>
                <td class="text-right font-bold">${InformesView._fmt(totalKg, 1)}</td>
                <td class="text-right font-bold text-gray">—</td>
                <td class="text-right font-bold">${InformesView._fmt((totalImporte - totalIVA), 2)}€</td>
                <td class="text-right font-bold text-blue">${InformesView._fmt(totalIVA, 2)}€</td>
                <td class="text-right font-bold text-red">${InformesView._fmt(totalRetencion, 2)}€</td>
                <td class="text-right font-bold text-green">${InformesView._fmt((totalImporte - totalRetencion), 2)}€</td>
                <td class="text-center">—</td>
              </tr>
            </tfoot>
          </table>
        </div>`}

        ${ventas.length > 1 ? (() => {
          const porComp = {};
          ventas.forEach(v => {
            const nom = v.razonSocial || v.nombreComprador || 'Sin comprador';
            if (!porComp[nom]) porComp[nom] = { kg: 0, total: 0, num: 0 };
            porComp[nom].kg += v.pesoCanal || v.pesoVivo || 0;
            porComp[nom].total += v.precio_total || 0;
            porComp[nom].num++;
          });
          const comps = Object.entries(porComp).map(([nom, d]) => ({
            nombre: nom, kg: d.kg, total: d.total, num: d.num,
            precioMedio: d.kg > 0 ? (d.total / d.kg) : 0
          })).sort((a, b) => b.total - a.total);
          if (comps.length < 2) return '';
          return `
        <div class="card report-section   report-card mt-14>
          <div class="inf-card-title">${Icons.grafico()} Precio Medio por Comprador</div>
          <div class="table-scroll scroll-shadow-container">
            <table class="inf-table inf-table-sm tbl-accent-green">
              <thead><tr><th>Comprador</th><th class="text-center">Ventas</th><th class="text-right">kg</th><th class="text-right">Total</th><th class="text-right">€/kg</th></tr></thead>
              <tbody>${comps.map(c => `
                <tr>
                  <td><strong>${c.nombre}</strong></td>
                  <td class="text-center">${c.num}</td>
                  <td class="text-right">${InformesView._fmt(c.kg, 1)}</td>
                <td class="text-right font-bold text-amber">${UI.formatCurrency(c.total)}</td>
                  <td class="text-right font-bold text-green">${InformesView._fmt(c.precioMedio, 2)}€</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
        })() : ''}
      </div>
    `;
  },

  // ===================== INFORME COMPRADORES =====================

  _renderCompradores(content, d) {
    const { compradoresData } = d;
    const data = compradoresData || [];
    const totalIngresos = data.reduce((s, c) => s + c.total, 0);
    const totalKg = data.reduce((s, c) => s + c.kg, 0);
    const totalVentas = data.reduce((s, c) => s + c.numVentas, 0);
    const topComprador = data.length > 0 ? data[0] : null;

    content.innerHTML = this._sectionActionsHTML('compradores', 'Compradores') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.compradores()} Informe por Comprador</div>
        <div class="card p-12 mb-14 border-222 style="background: rgba(255, 255, 255, 0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Compradores</small>
              <span class="text-xl text-blue font-950">${data.length}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Ingresos Totales</small>
              <span class="text-xl text-green font-950 truncate w-full px-4" title="${UI.formatCurrency(totalIngresos)}">${UI.formatCurrency(totalIngresos)}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Ventas</small>
              <span class="text-xl text-amber font-950">${totalVentas}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">kg Totales</small>
              <span class="text-xl text-purple font-950">${InformesView._fmt(totalKg, 1)}</span>
            </div>
          </div>
        </div>
        ${topComprador ? `
        <div class="card mb-14 card-tint-blue>
          <div class="flex justify-between items-center px-14 py-10">
            <div><span class="text-gray text-xs">COMPRADOR PRINCIPAL</span><div class="text-white font-800 text-md mt-4">${topComprador.nombre}</div></div>
            <div class="text-right"><span class="text-gray text-xs">TOTAL</span><div class="text-amber font-900 text-md">${UI.formatCurrency(topComprador.total)}</div></div>
          </div>
        </div>` : ''}

        ${data.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">${Icons.edificio()}</div><p class="empty-state-text">No hay ventas registradas con compradores.</p></div>' : `
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table tbl-accent-blue">
            <thead><tr>
              <th>Comprador</th>
              <th>NIF</th>
              <th>Tipo</th>
              <th class="text-right">Ventas</th>
              <th class="text-right">kg</th>
              <th class="text-right">Precio Medio</th>
              <th class="text-right">Total €</th>
              <th class="text-center">% Ingresos</th>
              <th>Contrato</th>
              <th>Última Venta</th>
            </tr></thead>
            <tbody>${data.map(c => {
              const precioMedio = c.kg > 0 ? InformesView._fmt((c.total / c.kg), 2) : '0,00';
              const pctIngresos = totalIngresos > 0 ? InformesView._fmt(((c.total / totalIngresos) * 100), 1) : '0,0';
              const tieneContrato = c.total > 0;
              return `<tr>
                <td><strong>${c.nombre}</strong></td>
                <td class="text-gray text-xs">${c.nif || '-'}</td>
                <td><span class="badge badge-sm ${c.tipo === 'cárnico' ? 'badge-amber' : (c.tipo === 'lácteo' || c.tipo === 'láctico') ? 'badge-gold' : 'badge-blue'}">${c.tipo || 'mixto'}</span></td>
                <td class="text-right">${c.numVentas}</td>
                <td class="text-right">${InformesView._fmt(c.kg, 1)}</td>
                <td class="text-right font-bold text-gray">${precioMedio} €/kg</td>
                  <td class="text-right font-bold text-amber">${UI.formatCurrency(c.total)}</td>
                <td class="text-center font-bold text-green">${pctIngresos}%</td>
                <td><span class="badge badge-sm badge-green">ACTIVO</span></td>
                <td class="text-gray text-xs">${c.ultimaVenta || '-'}</td>
              </tr>`;
            }).join('')}</tbody>
            <tfoot><tr>
              <td colspan="3" class="text-right text-gray">TOTALES</td>
              <td class="text-right font-bold">${totalVentas}</td>
              <td class="text-right font-bold">${InformesView._fmt(totalKg, 1)}</td>
              <td class="text-right font-bold text-gray">—</td>
              <td class="text-right font-bold text-amber">${UI.formatCurrency(totalIngresos)}</td>
              <td class="text-center font-bold text-green">100%</td>
              <td colspan="2"></td>
            </tr></tfoot>
          </table>
        </div>`}
      </div>
    `;
    // Gráfico si hay datos
    setTimeout(() => {
      if (data.length > 1) {
        const ctx = document.getElementById('chart-compradores');
        // Insertar canvas después del primer render
        const card = content.querySelector('.inf-report');
        if (card && !document.getElementById('chart-compradores')) {
          const canvasWrap = document.createElement('div');
          canvasWrap.className = 'chart-wrap mt-14';
          canvasWrap.innerHTML = '<canvas id="chart-compradores" class="chart-canvas"></canvas>';
          card.appendChild(canvasWrap);
          const c = document.getElementById('chart-compradores');
          if (c) {
            new Chart(c.getContext("2d"), {
              type: 'bar',
              data: {
                labels: data.slice(0, 8).map(c => c.nombre.length > 15 ? c.nombre.substring(0,15)+'…' : c.nombre),
                datasets: [{
                  label: 'Ingresos (€)',
                  data: data.slice(0, 8).map(c => c.total),
                  backgroundColor: ['#4FADF5','#C5FA50','#FFFC55','#4FADF5','#E8555F','#4FADF5','#14b8a6','#E8555F'],
                  borderRadius: 4
                }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
          }
        }
      }
    }, 100);
  },

  // ===================== INFORME PROVEEDORES =====================

  _renderProveedores(content, d) {
    const { proveedoresData } = d;
    const data = proveedoresData || [];
    const totalGasto = data.reduce((s, p) => s + p.total, 0);
    const totalFacturas = data.reduce((s, p) => s + p.numFacturas, 0);
    const topProv = data.length > 0 ? data[0] : null;

    content.innerHTML = this._sectionActionsHTML('proveedores', 'Proveedores') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.proveedores()} Informe por Proveedor</div>
        <div class="card p-12 mb-14 border-222 style="background: rgba(255, 255, 255, 0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Proveedores</small>
              <span class="text-xl text-amber font-950">${data.length}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Gasto Total</small>
              <span class="text-xl text-red font-950 truncate w-full px-4" title="${UI.formatCurrency(totalGasto)}">${UI.formatCurrency(totalGasto)}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Facturas</small>
              <span class="text-xl text-blue font-950">${totalFacturas}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Media/Prov</small>
              <span class="text-xl text-green font-950 truncate w-full px-4" title="${data.length > 0 ? UI.formatCurrency(totalGasto / data.length) : 0}">${data.length > 0 ? UI.formatCurrency(totalGasto / data.length) : 0}</span>
            </div>
          </div>
        </div>
        ${topProv ? `
        <div class="card mb-14 card-tint-orange>
          <div class="flex justify-between items-center px-14 py-10">
            <div><span class="text-gray text-xs">PRINCIPAL PROVEEDOR</span><div class="text-white font-800 text-md mt-4">${topProv.nombre}</div></div>
            <div class="text-right"><span class="text-gray text-xs">TOTAL</span><div class="text-red font-900 text-md">${UI.formatCurrency(topProv.total)}</div></div>
          </div>
        </div>` : ''}

        ${data.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">${Icons.paquete()}</div><p class="empty-state-text">No hay gastos registrados con proveedores.</p></div>' : `
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table tbl-accent-amber">
            <thead><tr>
              <th>Proveedor</th>
              <th>NIF</th>
              <th class="text-right">Facturas</th>
              <th class="text-right">Media/Fac</th>
              <th class="text-right">Total €</th>
              <th class="text-center">% Gasto</th>
              <th>Categorías Principales</th>
              <th>Último Registro</th>
            </tr></thead>
            <tbody>${data.map(p => {
              const cats = Object.entries(p.categorias).sort((a, b) => b[1] - a[1]).slice(0, 3);
              const pct = totalGasto > 0 ? InformesView._fmt(((p.total / totalGasto) * 100), 1) : '0,0';
              const mediaFac = p.numFacturas > 0 ? InformesView._fmt((p.total / p.numFacturas), 2) : '0,00';
              return `<tr>
                <td><strong>${p.nombre}</strong></td>
                <td class="text-gray text-xs">${p.nif || '-'}</td>
                <td class="text-right">${p.numFacturas}</td>
                <td class="text-right font-bold text-gray">${UI.formatCurrency(parseFloat(mediaFac))}</td>
                <td class="text-right font-bold text-red">${UI.formatCurrency(p.total)}</td>
                <td class="text-center font-bold text-amber">${pct}%</td>
                <td class="text-xs text-gray-400">${cats.map(([c, t]) => `${c}: ${UI.formatCurrency(t)}`).join(', ')}</td>
                <td class="text-gray text-xs">${p.ultimaCompra || '-'}</td>
              </tr>`;
            }).join('')}</tbody>
            <tfoot><tr>
              <td colspan="2" class="text-right text-gray">TOTALES</td>
              <td class="text-right font-bold">${totalFacturas}</td>
              <td class="text-right font-bold text-gray">—</td>
              <td class="text-right font-bold text-red">${UI.formatCurrency(totalGasto)}</td>
              <td class="text-center font-bold text-amber">100%</td>
              <td colspan="2"></td>
            </tr></tfoot>
          </table>
        </div>`}
      </div>
    `;
    // Gráfico
    setTimeout(() => {
      if (data.length > 1) {
        const card = content.querySelector('.inf-report');
        if (card && !document.getElementById('chart-proveedores')) {
          const canvasWrap = document.createElement('div');
          canvasWrap.className = 'chart-wrap mt-14';
          canvasWrap.innerHTML = '<canvas id="chart-proveedores" class="chart-canvas"></canvas>';
          card.appendChild(canvasWrap);
          const ctx = document.getElementById('chart-proveedores');
          if (ctx) {
            // Doughnut: categorías agregadas
            const cats = {};
            data.forEach(p => { Object.entries(p.categorias).forEach(([c, t]) => { cats[c] = (cats[c] || 0) + t; }); });
            const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
            new Chart(ctx.getContext("2d"), {
              type: 'doughnut',
              data: {
                labels: entries.map(e => e[0]),
                datasets: [{ data: entries.map(e => e[1]), backgroundColor: ['#FFFC55','#E8555F','#C5FA50','#4FADF5','#4FADF5','#4FADF5'], borderColor: '#111', borderWidth: 3 }]
              },
              options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#888', boxWidth: 12, font: { size: 9 } } } } }
            });
          }
        }
      }
    }, 100);
  },

  // ===================== INFORME FITOSANITARIO =====================

  _renderFitosanitario(content, d) {
    const { fitosanitarioData } = d;
    const data = fitosanitarioData || { registros: [], total: 0, numRegistros: 0, numZonas: 0, zonas: [], mediaPorOperacion: 0 };

    content.innerHTML = this._sectionActionsHTML('fitosanitario', 'Fitosanitario') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.fitosanitario()} Informe Fitosanitario</div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Gasto Total</small>
              <span class="font-950 text-green truncate w-full px-4" style="font-size:var(--fs-h2);" title="${UI.formatCurrency(data.total)}">${UI.formatCurrency(data.total)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Operaciones</small>
              <span class="font-950 text-blue" style="font-size:var(--fs-h2);">${data.numRegistros}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Zonas</small>
              <span class="font-950 text-amber" style="font-size:var(--fs-h2);">${data.numZonas}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Media/Op</small>
              <span class="font-950 text-purple" style="font-size:var(--fs-h2);">${InformesView._fmt(data.mediaPorOperacion, 2)}€</span>
            </div>
          </div>
        </div>

        ${data.zonas.length > 0 ? `
        <div class="flex flex-wrap gap-6 mb-14">
          ${data.zonas.map(z => `<span class="badge badge-green text-2xs">${Icons.fitosanitario()} ${z}</span>`).join('')}
        </div>` : ''}

        ${data.registros.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">${Icons.fitosanitario()}</div><p class="empty-state-text">No hay gastos fitosanitarios registrados.</p></div>' : `
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table tbl-accent-green">
            <thead><tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Producto</th>
              <th>Zona</th>
              <th class="text-right">Monto</th>
            </tr></thead>
            <tbody>${data.registros.map(r => `
              <tr>
                <td class="nowrap">${r.fecha || '-'}</td>
                <td>${r.proveedor || r.proveedorNombre || '-'}</td>
                <td>${r.descripcion || r.producto || '-'}</td>
                <td>${r.snap_zona || '-'}</td>
                <td class="text-right font-bold text-red">${UI.formatCurrency(r.monto || 0)}</td>
              </tr>`).join('')}</tbody>
            <tfoot><tr>
              <td colspan="4" class="text-right text-gray">TOTAL</td>
              <td class="text-right font-bold text-red">${UI.formatCurrency(data.total)}</td>
            </tr></tfoot>
          </table>
        </div>`}
      </div>
    `;
  },

  // ===================== INFORME ALERTAS =====================

  _renderAlertas(content, d) {
    const { alertasData } = d;
    const alertas = alertasData || { sanitarias: [], trazabilidad: [], administrativas: [], calendario: { titulo: '', sugerencias: [] } };
    const totalAlertas = (alertas.sanitarias?.length || 0) + (alertas.trazabilidad?.length || 0) + (alertas.administrativas?.length || 0);
    const rojas = (alertas.sanitarias?.filter(a => a.urgencia === 'rojo').length || 0) +
                  (alertas.trazabilidad?.filter(a => a.urgencia === 'rojo').length || 0) +
                  (alertas.administrativas?.filter(a => a.urgencia === 'rojo').length || 0);

    content.innerHTML = this._sectionActionsHTML('alertas', 'Alertas') + `
      <div class="inf-report mb-14">
        <div class="card report-section   report-card>
          <div class="inf-card-title flex items-center gap-6">${Icons.alerta()} Panel de Alertas</div>
          <div class="card p-12 mb-14 border-222 style="background:rgba(239,68,68,0.02);">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-8 text-center">
              <div class="info-box-center py-6">
                <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Total Alertas</small>
                <span class="font-950 text-red" style="font-size:var(--fs-h1);">${totalAlertas}</span>
              </div>
              <div class="info-box-center py-6">
                <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">${Icons.alerta()} Críticas</small>
                <span class="font-950 text-red" style="font-size:var(--fs-h1);">${rojas}</span>
              </div>
              <div class="info-box-center py-6">
                <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">${Icons.alerta()} Avisos</small>
                <span class="font-950 text-amber" style="font-size:var(--fs-h1);">${totalAlertas - rojas}</span>
              </div>
            </div>
          </div>

          ${alertas.sanitarias?.length > 0 ? `
          <div class="inf-section-title text-red uppercase font-900 flex items-center gap-6">${Icons.sanidad()} Alertas Sanitarias (${alertas.sanitarias.length})</div>
          <div class="table-scroll scroll-shadow-container mb-14">
            <table class="inf-table inf-table-sm tbl-accent-red">
              <thead><tr><th>Medicamento</th><th>Rebaño</th><th>Fecha</th><th class="text-right">Días rest.</th><th class="text-center">Estado</th></tr></thead>
              <tbody>${alertas.sanitarias.map(a => `
                <tr>
                  <td class="font-800 uppercase">${a.medicamento || '-'}</td>
                  <td class="text-xs uppercase">${a.rebanoNombre || '-'}</td>
                  <td>${a.fecha || '-'}</td>
                  <td class="text-right font-black ${a.diasRestantes <= 7 ? 'text-red' : a.diasRestantes <= 15 ? 'text-amber' : 'text-green'}">${a.diasRestantes}D</td>
                  <td class="text-center">
                    <span style="color:${a.urgencia === 'rojo' ? 'var(--c-danger)' : a.urgencia === 'amarillo' ? 'var(--c-warning)' : 'var(--c-success)'};">
                      ${a.urgencia === 'rojo' ? Icons.alerta() : (a.urgencia === 'amarillo' ? Icons.alerta() : Icons.check())}
                    </span>
                  </td>
                </tr>`).join('')}</tbody>
            </table>
          </div>` : ''}

          ${alertas.trazabilidad?.length > 0 ? `
          <div class="inf-section-title text-amber uppercase font-900 flex items-center gap-6">${Icons.trazabilidad()} Alertas de Trazabilidad (${alertas.trazabilidad.length})</div>
          <div class="table-scroll scroll-shadow-container mb-14">
            <table class="inf-table inf-table-sm tbl-accent-amber">
              <thead><tr><th>Animal/Venta</th><th>Mensaje</th><th>Urgencia</th></tr></thead>
              <tbody>${alertas.trazabilidad.map(a => `
                <tr>
                  <td class="font-900 uppercase">${a.crotal || '-'}</td>
                  <td class="text-xs uppercase font-700">${a.mensaje || '-'}</td>
                  <td class="text-center">
                    <span style="color:${a.urgencia === 'rojo' ? 'var(--c-danger)' : 'var(--c-warning)'};">
                      ${a.urgencia === 'rojo' ? Icons.alerta() : Icons.alerta()}
                    </span>
                  </td>
                </tr>`).join('')}</tbody>
            </table>
          </div>` : ''}

          ${alertas.administrativas?.length > 0 ? `
          <div class="inf-section-title text-violet uppercase font-900 flex items-center gap-6">${Icons.documento()} Alertas Administrativas (${alertas.administrativas.length})</div>
          <div class="table-scroll scroll-shadow-container mb-14">
            <table class="inf-table inf-table-sm tbl-accent-purple">
              <thead><tr><th>Sección</th><th>Mensaje</th><th>Urgencia</th></tr></thead>
              <tbody>${alertas.administrativas.map(a => `
                <tr>
                  <td class="font-900 uppercase">${a.seccion || '-'}</td>
                  <td class="text-xs uppercase font-700">${a.mensaje || '-'}</td>
                  <td class="text-center">
                    <span style="color:${a.urgencia === 'rojo' ? 'var(--c-danger)' : a.urgencia === 'amarillo' ? 'var(--c-warning)' : 'var(--c-success)'};">
                      ${a.urgencia === 'rojo' ? Icons.alerta() : (a.urgencia === 'amarillo' ? Icons.alerta() : Icons.check())}
                    </span>
                  </td>
                </tr>`).join('')}</tbody>
            </table>
          </div>` : ''}

          ${alertas.calendario?.sugerencias?.length > 0 ? `
          <div class="card   p-14>
            <div class="inf-card-title mb-8">${Icons.calendar()} ${alertas.calendario.titulo || 'Calendario Preventivo'}</div>
            <ul class="m-0 pl-18">
              ${alertas.calendario.sugerencias.map(s => `<li class="text-sm text-gray mb-4">${s}</li>`).join('')}
            </ul>
          </div>` : ''}

          ${totalAlertas === 0 ? `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:var(--c-success);">${Icons.check()}</div><p class="empty-state-text uppercase font-900 text-xs">No hay alertas activas. Todo correcto.</p></div>` : ''}
        </div>
      </div>
    `;
  },

  // ===================== INFORME POR FINCA =====================

  _renderPorFinca(content, d) {
    const { finca, rent, censo, animales, rebanos } = d;
    if (!finca) {
      content.innerHTML = `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.finca()}</div><p class="empty-state-text uppercase font-900 text-xs">No hay datos de explotación. Configura una finca primero.</p></div>`;
      return;
    }
    const balanceTotal = rent?.balance || 0;
    const totalAnimales = (animales || []).length;
    const activos = (animales || []).filter(a => a.estado === 'activo' || a.estado === 'Activo').length;
    const numRebanos = (rebanos || []).length;

    content.innerHTML = this._sectionActionsHTML('por-finca', 'Por Finca') + `
      <div class="inf-report mb-14">
        <!-- Ficha Explotación -->
        <div class="card report-section   report-card>
          <div class="inf-card-title flex items-center gap-6">${Icons.finca()} ${finca.nombre || 'Explotación'}</div>
          <div class="grid grid-cols-2 gap-10 mb-14">
            <div class="info-box border-left-green">
              <small class="s-lbl">REGA</small>
              <div class="inf-val-md text-gold">${finca.codigo_REGA || finca.rega || 'N/D'}</div>
            </div>
            <div class="info-box border-left-blue">
              <small class="s-lbl">PROPIETARIO</small>
              <div class="inf-val-md text-white">${finca.propietario || 'N/D'}</div>
            </div>
            <div class="info-box border-left-amber">
              <small class="s-lbl">CENSO TOTAL</small>
              <div class="inf-val-md text-amber">${totalAnimales}</div>
            </div>
            <div class="info-box border-left-green">
              <small class="s-lbl">ACTIVOS</small>
              <div class="inf-val-md text-green">${activos}</div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-8 text-sm mb-14 border-bottom-222 pb-10">
            <div><span class="text-gray">Municipio:</span> <strong>${finca.municipio || 'N/D'}</strong></div>
            <div><span class="text-gray">Provincia:</span> <strong>${finca.provincia || 'N/D'}</strong></div>
            <div><span class="text-gray">CCAA:</span> <strong class="uppercase">${finca.comunidad_autonoma || finca.comunidad || 'N/D'}</strong></div>
            <div><span class="text-gray">NIF/CIF:</span> <strong>${finca.nif_cif || 'N/D'}</strong></div>
            <div><span class="text-gray">Clasificación:</span> <strong>${finca.tipo_explotacion || 'N/D'} (${finca.sistema_explotacion || 'N/D'})</strong></div>
            <div><span class="text-gray">Rebaños Activos:</span> <strong>${numRebanos}</strong></div>
          </div>
          <div class="grid grid-cols-2 gap-8 text-sm mb-14 border-bottom-222 pb-10">
            <div><span class="text-gray">ADSG Asociada:</span> <strong class="text-amber">${finca.adsg_nombre || finca.adsg || 'N/D'}</strong></div>
            <div><span class="text-gray">Cód. ADSG:</span> <strong>${finca.adsg_codigo || 'N/D'}</strong></div>
            <div><span class="text-gray">Veterinario:</span> <strong>${finca.adsg_veterinario || 'N/D'}</strong></div>
            <div><span class="text-gray">Nº Colegiado:</span> <strong>${finca.adsg_vet_colegiado || 'N/D'}</strong></div>
          </div>
          <!-- Datos del Paquete Lácteo Regulador -->
          <div class="card p-10 bg-black border-272 text-sm mt-5 style="">
            <div class="text-white font-900 text-xs mb-6 uppercase flex items-center gap-4">${Icons.leche()} Regulaciones Paquete Lácteo (INFOLAC)</div>
            <div class="grid grid-cols-2 gap-6 text-[0.72rem]">
              <div><span class="text-gray">Nº Contrato Lácteo:</span> <strong class="text-white">${finca.contrato_lacteo_numero || 'N/D'}</strong></div>
              <div><span class="text-gray">Vencimiento Contrato:</span> <strong class="text-white">${finca.contrato_lacteo_fecha_fin || 'N/D'}</strong></div>
              <div><span class="text-gray">Comprador Lácteo:</span> <strong class="text-white">${finca.contrato_lacteo_comprador || 'N/D'}</strong></div>
              <div><span class="text-gray">Nº INFOLAC:</span> <strong class="text-white">${finca.numero_infolac || 'N/D'}</strong></div>
            </div>
          </div>
        </div>

        <!-- Resumen Económico -->
        ${rent ? `
        <div class="card report-section   report-card>
          <div class="inf-card-title flex items-center gap-6">${Icons.dinero()} Resumen Económico</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-10">
            <div class="info-box-center border-left-amber py-12">
              <small class="s-lbl uppercase mb-4">INGRESOS</small>
              <div class="inf-val-lg text-amber font-950">${UI.formatCurrency(rent.ingresos || 0)}</div>
            </div>
            <div class="info-box-center border-left-red py-12">
              <small class="s-lbl uppercase mb-4">GASTOS</small>
              <div class="inf-val-lg text-red font-950">${UI.formatCurrency(rent.gastos || 0)}</div>
            </div>
            <div class="info-box-center border-left-green py-12">
              <small class="s-lbl uppercase mb-4">BALANCE</small>
              <div class="inf-val-lg font-950 ${balanceTotal >= 0 ? 'text-green' : 'text-red'}">${UI.formatCurrency(balanceTotal)}</div>
            </div>
          </div>
        </div>` : ''}

        <!-- Rebaños -->
        ${rebanos?.length > 0 ? `
        <div class="card report-section   report-card>
          <div class="inf-card-title flex items-center gap-6">${Icons.rebanos()} Rebaños</div>
          <div class="table-scroll scroll-shadow-container">
            <table class="inf-table inf-table-sm tbl-accent-purple">
              <thead><tr><th>Rebaño</th><th>Tipo</th><th class="text-center">Animales</th><th class="text-center">Activos</th></tr></thead>
              <tbody>${rebanos.map(r => {
                const cnt = (animales || []).filter(a => Number(a.rebanoId) === Number(r.id)).length;
                const act = (animales || []).filter(a => Number(a.rebanoId) === Number(r.id) && (a.estado === 'activo' || a.estado === 'Activo')).length;
                return `<tr><td>${r.nombre}</td><td class="text-gray">${r.tipo || '-'}</td><td class="text-center font-bold">${cnt}</td><td class="text-center text-green">${act}</td></tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>` : ''}
      </div>
    `;
  },

  // ===================== INFORME REGA =====================

  _renderRega(content, d) {
    const { finca, censo, rebanos, animales, eventos, ventasCompleto } = d;
    if (!finca) {
      content.innerHTML = `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.documento()}</div><p class="empty-state-text uppercase font-900 text-xs">No hay datos de explotación registrados. Configura la finca primero.</p></div>`;
      return;
    }

    const totalAnimales = (animales || []).length;
    const activos = (animales || []).filter(a => a.estado === 'activo' || a.estado === 'Activo').length;
    const totalVentas = (ventasCompleto || []).length;
    const eventosRecientes = (eventos || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 15);

    // Agrupar censo por especie
    const porEspecie = {};
    (animales || []).forEach(a => {
      const esp = a.especie || 'Sin especie';
      if (!porEspecie[esp]) porEspecie[esp] = { total: 0, activos: 0 };
      porEspecie[esp].total++;
      if (a.estado === 'activo' || a.estado === 'Activo') porEspecie[esp].activos++;
    });

    const numRebanos = (rebanos || []).length;
    const especies = Object.keys(porEspecie);
    content.innerHTML = this._sectionActionsHTML('rega', 'REGA') + `
      <div class="inf-report mb-14">
        <!-- KPIs Unificados -->
        <div class="card p-12 mb-14 border-222 style="--registro-color: var(--c-gray);"--registro-color: var(--c-gray);"" style="background: rgba(255, 255, 255, 0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Censo Total</small>
              <span class="text-xl text-green font-950">${totalAnimales}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Activos</small>
              <span class="text-xl text-blue font-950">${activos}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Rebaños</small>
              <span class="text-xl text-amber font-950">${numRebanos}</span>
            </div>
            <div class="info-box-center py-10">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Especies</small>
              <span class="text-xl text-purple font-950">${especies.length}</span>
            </div>
          </div>
        </div>
        <!-- Datos Explotación -->
        <div class="card report-section   report-card style="--registro-color: var(--c-gold);"--registro-color: var(--c-gold);"">
          <div class="inf-card-title">${Icons.finca()} Datos de la Explotación</div>
          <div class="grid grid-cols-2 gap-8 text-sm">
            <div><span class="text-gray">Nombre:</span> <strong>${finca.nombre || 'N/D'}</strong></div>
            <div><span class="text-gray">REGA:</span> <strong class="text-gold">${finca.codigo_REGA || finca.rega || 'N/D'}</strong></div>
            <div><span class="text-gray">CEA:</span> <strong>${finca.codigo_CEA || finca.cea || 'N/D'}</strong></div>
            <div><span class="text-gray">Propietario:</span> <strong>${finca.propietario || 'N/D'}</strong></div>
            <div><span class="text-gray">NIF/CIF:</span> <strong>${finca.nif_cif || 'N/D'}</strong></div>
            <div><span class="text-gray">Dirección:</span> <strong>${finca.direccion || 'N/D'}</strong></div>
            <div><span class="text-gray">Clasif. Zootécnica:</span> <strong>${finca.tipo_explotacion || 'N/D'} (${finca.sistema_explotacion || 'N/D'})</strong></div>
            <div><span class="text-gray">Comunidad Autónoma:</span> <strong class="uppercase">${finca.comunidad_autonoma || finca.comunidad || 'N/D'}</strong></div>
            <div><span class="text-gray">Municipio:</span> <strong>${finca.municipio || 'N/D'}</strong></div>
            <div><span class="text-gray">Provincia:</span> <strong>${finca.provincia || 'N/D'}</strong></div>
            <div><span class="text-gray">Teléfono:</span> <strong>${finca.telefono || 'N/D'}</strong></div>
            <div><span class="text-gray">Email:</span> <strong>${finca.email || 'N/D'}</strong></div>
          </div>
          <div class="border-top-222 mt-10 pt-10 grid grid-cols-2 gap-8 text-sm">
            <div><span class="text-gray">ADSG Asociada:</span> <strong class="text-amber">${finca.adsg_nombre || finca.adsg || 'N/D'}</strong></div>
            <div><span class="text-gray">Cód. ADSG:</span> <strong>${finca.adsg_codigo || 'N/D'}</strong></div>
            <div><span class="text-gray">Vet. Responsable:</span> <strong>${finca.adsg_veterinario || 'N/D'}</strong></div>
            <div><span class="text-gray">Col. Veterinario:</span> <strong>${finca.adsg_vet_colegiado || 'N/D'}</strong></div>
            <div><span class="text-gray">NIF Veterinario:</span> <strong>${finca.adsg_vet_nif || 'N/D'}</strong></div>
          </div>
        </div>

        <!-- Resumen Censo -->
        <div class="card report-section   report-card style="--registro-color: var(--c-success);"--registro-color: var(--c-success);"">
          <div class="inf-card-title">${Icons.animales()} Censo Actual</div>
          <div class="card p-12 mb-12 border-222 style="--registro-color: var(--c-gray);"--registro-color: var(--c-gray);"" style="background:rgba(255,255,255,0.02);">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-8 text-center">
              <div class="info-box-center py-6">
                <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Total Animales</small>
                <span class="font-950 text-blue" style="font-size:var(--fs-h2);">${totalAnimales}</span>
              </div>
              <div class="info-box-center py-6">
                <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Activos</small>
                <span class="font-950 text-green" style="font-size:var(--fs-h2);">${activos}</span>
              </div>
              <div class="info-box-center py-6">
                <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Ventas</small>
                <span class="font-950 text-amber" style="font-size:var(--fs-h2);">${totalVentas}</span>
              </div>
            </div>
          </div>

          ${Object.keys(porEspecie).length > 0 ? `
          <div class="inf-section-title mt-8 mb-8">Por especie</div>
          <div class="grid grid-cols-2 gap-6">
            ${Object.entries(porEspecie).map(([esp, data]) => `
              <div class="info-box-sm flex justify-between items-center">
                <span class="text-aaa text-sm">${esp}</span>
                <span><strong class="text-white">${data.total}</strong> <span class="text-green text-xs">(${data.activos} activos)</span></span>
              </div>`).join('')}
          </div>` : ''}

          <!-- Desglose por pirámide de edad regulatorio -->
          <div class="inf-section-title mt-12 mb-8">Pirámide de Edad (Activos)</div>
          <div class="grid grid-cols-3 gap-6">
            <div class="info-box-sm text-center">
              <span class="text-gray text-[0.62rem] uppercase font-800 block">Crías (<12 meses)</span>
              <strong class="text-white text-md mt-4 block">${(() => {
                let count = 0;
                const hoyAge = new Date();
                (animales || []).forEach(a => {
                  if ((a.estado === 'activo' || a.estado === 'Activo') && a.fechaNacimiento) {
                    const edadMeses = (hoyAge - new Date(a.fechaNacimiento)) / (1000 * 60 * 60 * 24 * 30.4);
                    if (edadMeses < 12) count++;
                  }
                });
                return count;
              })()} cabezas</strong>
            </div>
            <div class="info-box-sm text-center">
              <span class="text-gray text-[0.62rem] uppercase font-800 block">Jóvenes (12-24 meses)</span>
              <strong class="text-white text-md mt-4 block">${(() => {
                let count = 0;
                const hoyAge = new Date();
                (animales || []).forEach(a => {
                  if ((a.estado === 'activo' || a.estado === 'Activo') && a.fechaNacimiento) {
                    const edadMeses = (hoyAge - new Date(a.fechaNacimiento)) / (1000 * 60 * 60 * 24 * 30.4);
                    if (edadMeses >= 12 && edadMeses < 24) count++;
                  }
                });
                return count;
              })()} cabezas</strong>
            </div>
            <div class="info-box-sm text-center">
              <span class="text-gray text-[0.62rem] uppercase font-800 block">Adultos (>24 meses)</span>
              <strong class="text-white text-md mt-4 block">${(() => {
                let count = 0;
                const hoyAge = new Date();
                (animales || []).forEach(a => {
                  if (a.estado === 'activo' || a.estado === 'Activo') {
                    if (!a.fechaNacimiento) count++;
                    else {
                      const edadMeses = (hoyAge - new Date(a.fechaNacimiento)) / (1000 * 60 * 60 * 24 * 30.4);
                      if (edadMeses >= 24) count++;
                    }
                  }
                });
                return count;
              })()} cabezas</strong>
            </div>
          </div>

          ${rebanos?.length > 0 ? `
          <div class="inf-section-title mt-10 mb-6">Por rebaño</div>
          <div class="table-scroll scroll-shadow-container">
            <table class="inf-table inf-table-sm tbl-accent-green">
              <thead><tr>
                <th>REBAÑO</th>
                <th class="text-center">TOTAL</th>
                <th class="text-center">ACTIVOS</th>
              </tr></thead>
              <tbody>${rebanos.map(r => {
                const cnt = (animales || []).filter(a => Number(a.rebanoId) === Number(r.id)).length;
                const act = (animales || []).filter(a => Number(a.rebanoId) === Number(r.id) && (a.estado === 'activo' || a.estado === 'Activo')).length;
                return `<tr>
                  <td>${r.nombre}</td>
                  <td class="text-center font-bold">${cnt}</td>
                  <td class="text-center text-green">${act}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>` : ''}
        </div>

        <!-- Movimientos recientes -->
        <div class="card report-section   report-card style="--registro-color: var(--c-purple);"--registro-color: var(--c-purple);"">
          <div class="inf-card-title">${Icons.paquete()} Últimos Movimientos</div>
          ${eventosRecientes.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">${Icons.paquete()}</div><p class="empty-state-text">Sin movimientos registrados</p></div>' : `
          <div class="table-scroll scroll-shadow-container">
            <table class="inf-table inf-table-sm tbl-accent-purple">
              <thead><tr>
                <th>FECHA</th>
                <th>TIPO</th>
                <th>MOTIVO</th>
                <th>ENTIDAD</th>
              </tr></thead>
              <tbody>${eventosRecientes.map(e => {
                const tipos = {
                  'expedicion': `<span class="text-amber">${Icons.paquete()} EXPEDICIÓN</span>`,
                  'ALTA_IMPORTACION': `<span class="text-blue">${Icons.importar()} IMPORTACIÓN</span>`,
                  'baja': `<span class="text-red">${Icons.cerrar()} BAJA</span>`,
                  'control': `<span class="text-green">${Icons.check()} CONTROL</span>`,
                  'alta': `<span class="text-gold">${Icons.agregar()} ALTA</span>`
                };
                return `<tr>
                  <td class="nowrap">${e.fecha || '-'}</td>
                  <td class="font-900 uppercase text-[0.6rem]">${tipos[e.motivo_tarea] || e.motivo_tarea || 'Otro'}</td>
                  <td class="uppercase font-700">${e.motivo_tarea || '-'}</td>
                  <td class="font-800">${e.entidad_id || '-'}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>`}
        </div>
      </div>
    `;
  },

  // ===================== NUEVOS INFORMES =====================

  /** PyG: Cuenta de Resultados mensual */
  _renderPyG(content, d) {
    const { pygData, rent, todosGastos, entregasLeche, ventasCarne } = d;
    const data = pygData || { porMes: [], totalIngresos: 0, totalGastos: 0, totalBalance: 0, gastosPorCategoria: [], numMeses: 0, rentabilidad: '0,0' };
    
    // Cálculos financieros precisos
    const ingLeche = (entregasLeche || []).reduce((s, e) => s + (e.importe_total || (e.cantidad || 0) * (e.precioBase || 0)), 0);
    const ingCarne = (ventasCarne || []).reduce((s, v) => s + (v.precio_total || v.valor_neto || 0), 0);
    const totalIngresosCalculado = ingLeche + ingCarne || data.totalIngresos;
    
    const gastosAlim = (todosGastos || []).filter(g => (g.categoria || '').toLowerCase().includes('alim')).reduce((s, g) => s + (g.monto || 0), 0);
    const gastosSanidad = (todosGastos || []).filter(g => (g.categoria || '').toLowerCase().includes('sanid')).reduce((s, g) => s + (g.monto || 0), 0);
    const gastosFito = (todosGastos || []).filter(g => (g.categoria || '').toLowerCase().includes('fito')).reduce((s, g) => s + (g.monto || 0), 0);
    const gastosElectricidad = (todosGastos || []).filter(g => (g.categoria || '').toLowerCase().includes('elec') || (g.categoria || '').toLowerCase().includes('energ')).reduce((s, g) => s + (g.monto || 0), 0);
    const gastosPersonal = (todosGastos || []).filter(g => (g.categoria || '').toLowerCase().includes('pers')).reduce((s, g) => s + (g.monto || 0), 0);
    const gastosAmort = (todosGastos || []).filter(g => (g.categoria || '').toLowerCase().includes('amort')).reduce((s, g) => s + (g.monto || 0), 0);
    const totalGastosCalculado = (todosGastos || []).reduce((s, g) => s + (g.monto || 0), 0) || data.totalGastos;
    const balanceTotal = totalIngresosCalculado - totalGastosCalculado;
    const rentabilidadCalculada = totalIngresosCalculado > 0 ? InformesView._fmt(((balanceTotal / totalIngresosCalculado) * 100), 1) : '0,0';

    content.innerHTML = this._sectionActionsHTML('pyg', 'PyG') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.dinero()} Cuenta de Resultados PyG (Estructurada)</div>
        <div class="card p-12 mb-14 border-222 style="background: rgba(255, 255, 255, 0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Ingresos</small>
              <span class="text-xl text-green font-950 truncate w-full px-4" style="word-break:break-all;" title="${UI.formatCurrency(totalIngresosCalculado)}">${UI.formatCurrency(totalIngresosCalculado)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Gastos</small>
              <span class="text-xl text-red font-950 truncate w-full px-4" style="word-break:break-all;" title="${UI.formatCurrency(totalGastosCalculado)}">${UI.formatCurrency(totalGastosCalculado)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">Margen Oper.</small>
              <span class="text-xl font-950 ${balanceTotal >= 0 ? 'text-green' : 'text-red'} truncate w-full px-4" style="word-break:break-all;" title="${UI.formatCurrency(balanceTotal)}">${UI.formatCurrency(balanceTotal)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.62rem] mb-4 uppercase font-800">EBITDA %</small>
              <span class="text-xl text-blue font-950">${rentabilidadCalculada}%</span>
            </div>
          </div>
        </div>

        <!-- Tabla de Pérdidas y Ganancias Contable -->
        <div class="table-scroll scroll-shadow-container mb-14">
          <table class="inf-table tbl-accent-green text-sm">
            <thead>
              <tr class="bg-black-opacity-50">
                <th colspan="2">PARTIDAS DE INGRESOS</th>
                <th class="text-right">IMPORTE</th>
                <th class="text-right">% CUOTA</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="width:24px;">${Icons.leche()}</td>
                <td style="white-space:normal; line-height:1.2; padding-right:10px;"><strong>Ingresos por Venta de Leche (Entregas Lácteas)</strong></td>
                <td class="text-right text-green" style="white-space:nowrap;">${UI.formatCurrency(ingLeche)}</td>
                <td class="text-right font-bold text-gray">${totalIngresosCalculado > 0 ? InformesView._fmt(((ingLeche / totalIngresosCalculado) * 100), 1) : 0}%</td>
              </tr>
              <tr>
                <td>${Icons.carne()}</td>
                <td style="white-space:normal; line-height:1.2; padding-right:10px;"><strong>Ingresos por Venta de Ganado (Canal / Vivo)</strong></td>
                <td class="text-right text-green" style="white-space:nowrap;">${UI.formatCurrency(ingCarne)}</td>
                <td class="text-right font-bold text-gray">${totalIngresosCalculado > 0 ? InformesView._fmt(((ingCarne / totalIngresosCalculado) * 100), 1) : 0}%</td>
              </tr>
              <tr class="font-bold border-top-222 text-white bg-black-opacity-30">
                <td colspan="2">TOTAL INGRESOS BRUTOS</td>
                <td class="text-right text-green">${UI.formatCurrency(totalIngresosCalculado)}</td>
                <td class="text-right text-green">100%</td>
              </tr>
            </tbody>
            
            <thead>
              <tr class="bg-black-opacity-50">
                <th colspan="2">PARTIDAS DE GASTOS OPERATIVOS</th>
                <th class="text-right text-red">IMPORTE</th>
                <th class="text-right">% GASTO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${Icons.pac()}</td>
                <td style="white-space:normal; line-height:1.2; padding-right:10px;">Gastos en Alimentación (Piensos, Forrajes, Ración)</td>
                <td class="text-right text-red" style="white-space:nowrap;">${UI.formatCurrency(gastosAlim)}</td>
                <td class="text-right font-bold text-gray">${totalGastosCalculado > 0 ? InformesView._fmt(((gastosAlim / totalGastosCalculado) * 100), 1) : 0}%</td>
              </tr>
              <tr>
                <td>${Icons.fitosanitario()}</td>
                <td style="white-space:normal; line-height:1.2; padding-right:10px;">Gastos Fitosanitarios (Tratamientos parcelas, herbicidas)</td>
                <td class="text-right text-red" style="white-space:nowrap;">${UI.formatCurrency(gastosFito)}</td>
                <td class="text-right font-bold text-gray">${totalGastosCalculado > 0 ? InformesView._fmt(((gastosFito / totalGastosCalculado) * 100), 1) : 0}%</td>
              </tr>
              <tr>
                <td>${Icons.sanidad()}</td>
                <td style="white-space:normal; line-height:1.2; padding-right:10px;">Gastos de Sanidad Ganadera (Medicamentos, ADSG, vacunas)</td>
                <td class="text-right text-red" style="white-space:nowrap;">${UI.formatCurrency(gastosSanidad)}</td>
                <td class="text-right font-bold text-gray">${totalGastosCalculado > 0 ? InformesView._fmt(((gastosSanidad / totalGastosCalculado) * 100), 1) : 0}%</td>
              </tr>
              <tr>
                <td>${Icons.rayo()}</td>
                <td style="white-space:normal; line-height:1.2; padding-right:10px;">Gastos en Electricidad y Suministros (Energía, Gasoil)</td>
                <td class="text-right text-red" style="white-space:nowrap;">${UI.formatCurrency(gastosElectricidad)}</td>
                <td class="text-right font-bold text-gray">${totalGastosCalculado > 0 ? InformesView._fmt(((gastosElectricidad / totalGastosCalculado) * 100), 1) : 0}%</td>
              </tr>
              <tr>
                <td>${Icons.finca()}</td>
                <td style="white-space:normal; line-height:1.2; padding-right:10px;">Gastos de Personal (Mano de obra, seguridad social)</td>
                <td class="text-right text-red" style="white-space:nowrap;">${UI.formatCurrency(gastosPersonal)}</td>
                <td class="text-right font-bold text-gray">${totalGastosCalculado > 0 ? InformesView._fmt(((gastosPersonal / totalGastosCalculado) * 100), 1) : 0}%</td>
              </tr>
              <tr>
                <td>${Icons.edificio()}</td>
                <td style="white-space:normal; line-height:1.2; padding-right:10px;">Amortizaciones (Instalaciones, maquinaria, cercados)</td>
                <td class="text-right text-red" style="white-space:nowrap;">${UI.formatCurrency(gastosAmort)}</td>
                <td class="text-right font-bold text-gray">${totalGastosCalculado > 0 ? InformesView._fmt(((gastosAmort / totalGastosCalculado) * 100), 1) : 0}%</td>
              </tr>
              <tr class="font-bold border-top-222 text-white bg-black-opacity-30">
                <td colspan="2">TOTAL GASTOS OPERATIVOS</td>
                <td class="text-right text-red">${UI.formatCurrency(totalGastosCalculado)}</td>
                <td class="text-right text-red">100%</td>
              </tr>
            </tbody>
            
            <tfoot>
              <tr class="font-bold text-white bg-black-opacity-50 text-base">
                <td colspan="2" class="text-left">MARGEN NETO DE EXPLOTACIÓN (EBITDA)</td>
                <td class="text-right ${balanceTotal >= 0 ? 'text-green' : 'text-red'}">${UI.formatCurrency(balanceTotal)}</td>
                <td class="text-right ${balanceTotal >= 0 ? 'text-green' : 'text-red'}">${rentabilidadCalculada}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`;
  },

  /** Coste de Producción por Animal/Día */
  _renderCosteProd(content, d) {
    const { costeProdData } = d;
    const data = costeProdData || { porRebano: [], totalGasto: 0, totalAnimales: 0, costeMedioCabeza: 0, costeMedioDia: 0 };
    content.innerHTML = this._sectionActionsHTML('coste-prod', 'Coste Producción') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title">${Icons.carne()} Coste de Producción por Animal</div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div class="py-6">
              <small class="text-neutral block text-[0.6rem] mb-2 uppercase font-800">Coste Medio/Cabeza</small>
              <span class="font-950 text-purple" style="font-size:var(--fs-h2); word-break:break-all;">${UI.formatCurrency(data.costeMedioCabeza)}</span>
            </div>
            <div class="hidden sm:block" style="width:1px;height:22px;background:#2a2a2a; align-self:center;"></div>
            <div class="py-6">
              <small class="text-neutral block text-[0.6rem] mb-2 uppercase font-800">Coste/Día</small>
              <span class="font-950 text-blue" style="font-size:var(--fs-h2);">${data.costeMedioDia}€</span>
            </div>
            <div class="hidden sm:block" style="width:1px;height:22px;background:#2a2a2a; align-self:center;"></div>
            <div class="py-6">
              <small class="text-neutral block text-[0.6rem] mb-2 uppercase font-800">Animales</small>
              <span class="font-950 text-green" style="font-size:var(--fs-h2);">${data.totalAnimales}</span>
            </div>
            <div class="hidden sm:block" style="width:1px;height:22px;background:#2a2a2a; align-self:center;"></div>
            <div class="py-6">
              <small class="text-neutral block text-[0.6rem] mb-2 uppercase font-800">Gasto Total</small>
              <span class="font-950 text-red" style="font-size:var(--fs-h2); word-break:break-all;">${UI.formatCurrency(data.totalGasto)}</span>
            </div>
          </div>
        </div>
        ${data.porRebano.length > 0 ? `
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table inf-table-sm tbl-accent-purple">
            <thead><tr><th>Rebaño</th><th class="text-center">Animales</th><th class="text-right">Gasto Total</th><th class="text-right">€/Cabeza</th><th class="text-right">€/Día</th><th class="text-right">%Alim</th><th class="text-right">%Sanidad</th></tr></thead>
            <tbody>${data.porRebano.map(r => `
              <tr>
                <td><strong>${r.nombre}</strong> <span class="text-gray text-xs">${r.especie}</span></td>
                <td class="text-center">${r.numAnimales}</td>
                <td class="text-right font-bold text-red">${UI.formatCurrency(r.totalGasto)}</td>
                <td class="text-right">${UI.formatCurrency(r.costePorCabeza)}</td>
                <td class="text-right text-blue">${r.costePorDia}€</td>
                <td class="text-right">${r.pctAlimentacion}%</td>
                <td class="text-right">${r.pctSanidad}%</td>
              </tr>`).join('')}</tbody>
          </table>
        </div>` : `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.animales()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin datos de gastos asociados a rebaños.</p></div>`}
      </div>`;
  },

  /** Panel de Eficiencia Técnica */
  _renderEficiencia(content, d) {
    const { eficienciaData } = d;
    const data = eficienciaData || { kpis: [], activos: 0, totalLecheros: 0, numRebanos: 0, totalAnimales: 0 };
    const semaforo = (s) => s === 'verde' ? 'var(--c-success)' : s === 'amarillo' ? 'var(--c-warning)' : 'var(--c-danger)';
    content.innerHTML = this._sectionActionsHTML('eficiencia', 'Eficiencia Técnica') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title">${Icons.grafico()} Panel de Eficiencia Técnica</div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Rebaños</small>
              <span class="font-950 text-blue" style="font-size:var(--fs-h2);">${data.numRebanos}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Activos</small>
              <span class="font-950 text-green" style="font-size:var(--fs-h2);">${data.activos}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">H. Lecheras</small>
              <span class="font-950 text-amber" style="font-size:var(--fs-h2);">${data.totalLecheros}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Total</small>
              <span class="font-950 text-purple" style="font-size:var(--fs-h2);">${data.totalAnimales}</span>
            </div>
          </div>
        </div>
        ${data.kpis.length > 0 ? `
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-10">
          ${data.kpis.map(k => `
            <div class="info-box-sm" style="border-left:3px solid ${semaforo(k.status)};">
              <div class="flex justify-between items-center">
                <small class="s-lbl">${k.label}</small>
                <span class="inf-led" style="background:${semaforo(k.status)};"></span>
              </div>
              <div class="inf-val-md text-white">${k.value}</div>
              <small class="text-gray text-xs">Objetivo: ${k.objetivo}${k.unidad}</small>
            </div>`).join('')}
        </div>` : `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.grafico()}</div><p class="empty-state-text uppercase font-900 text-xs">No hay suficientes datos para calcular KPIs de eficiencia.</p></div>`}
      </div>`;
  },

  _renderCargas(content, d) {
    const { cargasData } = d;
    const data = cargasData || { porZona: [], totalAforo: 0, totalOcupacion: 0, pctGlobal: '0', alertas: [], numAlertas: 0, numZonas: 0 };
    const colorPct = (p) => p > 100 ? 'var(--c-danger)' : p >= 80 ? 'var(--c-success)' : p >= 50 ? 'var(--c-warning)' : '#6b7280';
    
    // Calcular superficie total pastable y UGM globales
    const superficieTotal = data.porZona.reduce((sum, z) => sum + (Number(z.superficie) || 0), 0);
    const ugmGlobal = data.totalOcupacion; // simplificado: 1 vaca = 1 UGM
    const cargaGlobal = superficieTotal > 0 ? InformesView._fmt((ugmGlobal / superficieTotal), 2) : '0,00';

    content.innerHTML = this._sectionActionsHTML('cargas', 'Aforos') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.balanza()} Cargas y Aforos</div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Sup. Pastos</small>
              <span class="text-xl text-blue font-950">${InformesView._fmt(superficieTotal, 1)} ha</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Aforo Máx.</small>
              <span class="text-xl text-green font-950">${data.totalAforo}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">UGM Totales</small>
              <span class="text-xl text-amber font-950">${ugmGlobal} UGM</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Carga Global</small>
              <span class="text-xl font-950" style="color:${colorPct(parseFloat(data.pctGlobal))}">${cargaGlobal} UGM/ha</span>
            </div>
          </div>
        </div>
        ${data.numAlertas > 0 ? `<div class="card card-tint-red mb-14 p-12>
          <div class="flex items-center gap-8"><span class="text-xl">${Icons.alerta()}</span><div><strong class="text-red">${data.numAlertas} ${data.numAlertas === 1 ? 'alerta' : 'alertas'}</strong><span class="text-gray text-sm block">Zonas con sobrecarga o infrautilización</span></div></div>
        </div>` : ''}
        ${data.porZona.length > 0 ? `
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table inf-table-sm tbl-accent-amber">
            <thead><tr><th>Zona</th><th class="text-center">Superficie</th><th class="text-center">Aforo Máx.</th><th class="text-center">Ocupación</th><th class="text-center">Carga UGM/ha</th><th class="text-center">%</th><th>Estado</th></tr></thead>
            <tbody>${data.porZona.map(z => {
              const capUgm = Number(z.superficie) > 0 ? InformesView._fmt((z.ocupacion / z.superficie), 2) : '0,00';
              return `
              <tr>
                <td><strong>${z.nombre}</strong>${z.especie ? `<br><span class="text-gray text-xs">${z.especie}</span>` : ''}</td>
                <td class="text-center">${z.superficie} ha</td>
                <td class="text-center">${z.aforo}</td>
                <td class="text-center">${z.ocupacion}</td>
                <td class="text-center font-bold text-white">${capUgm} UGM/ha</td>
                <td class="text-center font-bold" style="color:${colorPct(z.pctOcupacion)}">${z.pctOcupacion}%</td>
                <td class="text-center"><span class="badge badge-sm ${z.estado === 'sobrecarga' ? 'badge-red' : z.estado === 'optimo' ? 'badge-green' : z.estado === 'aceptable' ? 'badge-amber' : 'badge-gray'}">${z.estado}</span></td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>` : `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.balanza()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin zonas configuradas o sin datos de ocupación.</p></div>`}
      </div>`;
  },

  /** Rotación de Censo */
  _renderRotacion(content, d) {
    const { rotacionData } = d;
    const data = rotacionData || { ultimos90: {}, ultimos30: {}, totalAnimales: 0, activos: 0, tasaReposicion: '0%', tasaBajas: '0%', periodo: '90 días' };
    const u90 = data.ultimos90 || {};
    const u30 = data.ultimos30 || {};
    content.innerHTML = this._sectionActionsHTML('rotacion', 'Rotación Censo') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title">${Icons.rotacion()} Rotación de Censo (${data.periodo})</div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-8 text-center">
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Censo Total</small>
              <span class="font-950 text-green" style="font-size:var(--fs-h2);">${data.totalAnimales}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Activos</small>
              <span class="font-950 text-blue" style="font-size:var(--fs-h2);">${data.activos}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Entrada Neta</small>
              <span class="font-950 ${(u90.entradaNeta||0)>=0?'text-green':'text-red'}" style="font-size:var(--fs-h2);">${(u90.entradaNeta||0)>=0?'+':''}${u90.entradaNeta||0}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Reposición</small>
              <span class="font-950 text-green" style="font-size:var(--fs-h2);">${data.tasaReposicion}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Bajas</small>
              <span class="font-950 text-red" style="font-size:var(--fs-h2);">${data.tasaBajas}</span>
            </div>
          </div>
        </div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Nacimientos</small>
              <span class="font-950 text-green" style="font-size:var(--fs-body);">${u90.nacimientos || 0}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Compras</small>
              <span class="font-950 text-blue" style="font-size:var(--fs-body);">${u90.compras || 0}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Ventas</small>
              <span class="font-950 text-red" style="font-size:var(--fs-body);">${u90.ventas || 0}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Bajas</small>
              <span class="font-950 text-gray" style="font-size:var(--fs-body);">${u90.bajas || 0}</span>
            </div>
          </div>
        </div>
        ${data.totalAnimales === 0 ? `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.rotacion()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin datos de censo registrados.</p></div>` : ''}
      </div>`;
  },

  /** Flujo de Caja mensual */
  _renderFlujoCaja(content, d) {
    const { flujoCajaData } = d;
    const data = flujoCajaData || { porMes: [], totalEntradas: 0, totalSalidas: 0, totalNeto: 0, saldoFinal: 0 };
    content.innerHTML = this._sectionActionsHTML('flujo-caja', 'Flujo Caja') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title">${Icons.tendencia()} Flujo de Caja</div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Entradas</small>
              <span class="font-950 text-green truncate w-full px-4" style="font-size:var(--fs-h2); word-break:break-all;" title="${UI.formatCurrency(data.totalEntradas)}">${UI.formatCurrency(data.totalEntradas)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Salidas</small>
              <span class="font-950 text-red truncate w-full px-4" style="font-size:var(--fs-h2); word-break:break-all;" title="${UI.formatCurrency(data.totalSalidas)}">${UI.formatCurrency(data.totalSalidas)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Neto</small>
              <span class="font-950 ${data.totalNeto>=0?'text-green':'text-red'} truncate w-full px-4" style="font-size:var(--fs-h2); word-break:break-all;" title="${UI.formatCurrency(data.totalNeto)}">${UI.formatCurrency(data.totalNeto)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Saldo Final</small>
              <span class="font-950 text-blue truncate w-full px-4" style="font-size:var(--fs-h2); word-break:break-all;" title="${UI.formatCurrency(data.saldoFinal)}">${UI.formatCurrency(data.saldoFinal)}</span>
            </div>
          </div>
        </div>
        ${data.porMes.length > 0 ? `
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table inf-table-sm tbl-accent-teal">
            <thead><tr><th>Mes</th><th class="text-right text-green">Entradas</th><th class="text-right text-red">Salidas</th><th class="text-right">Neto</th><th class="text-right">Acumulado</th></tr></thead>
            <tbody>${data.porMes.filter(m => m.entradas > 0 || m.salidas > 0).map(m => `
              <tr>
                <td><strong>${m.mes}</strong></td>
                <td class="text-right text-green">${UI.formatCurrency(m.entradas)}</td>
                <td class="text-right text-red">${UI.formatCurrency(m.salidas)}</td>
                <td class="text-right font-bold ${m.neto >= 0 ? 'text-green' : 'text-red'}">${UI.formatCurrency(m.neto)}</td>
                <td class="text-right text-blue font-bold">${UI.formatCurrency(m.acumulado)}</td>
              </tr>`).join('')}</tbody>
          </table>
        </div>` : `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.tendencia()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin datos de ingresos o gastos para calcular flujo de caja.</p></div>`}
      </div>`;
  },

  /** Rentabilidad por Especie */
  _renderRentabilidadEspecie(content, d) {
    const { rentEspData } = d;
    const data = rentEspData || { porEspecie: [], totalIngresos: 0, totalGastos: 0, totalBalance: 0 };
    content.innerHTML = this._sectionActionsHTML('rent-esp', 'Rent. Especie') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.reproduccion()} Rentabilidad por Especie</div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-8 text-center">
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Ingresos</small>
              <span class="font-950 text-green truncate w-full px-4" style="font-size:var(--fs-h2); word-break:break-all;" title="${UI.formatCurrency(data.totalIngresos)}">${UI.formatCurrency(data.totalIngresos)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Gastos</small>
              <span class="font-950 text-red truncate w-full px-4" style="font-size:var(--fs-h2); word-break:break-all;" title="${UI.formatCurrency(data.totalGastos)}">${UI.formatCurrency(data.totalGastos)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Balance</small>
              <span class="font-950 ${data.totalBalance>=0?'text-green':'text-red'} truncate w-full px-4" style="font-size:var(--fs-h2); word-break:break-all;" title="${UI.formatCurrency(data.totalBalance)}">${UI.formatCurrency(data.totalBalance)}</span>
            </div>
          </div>
        </div>
        ${data.porEspecie.length > 0 ? `
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table tbl-accent-purple">
            <thead><tr><th>Especie</th><th class="text-center">Rebaños</th><th class="text-center">Animales</th><th class="text-right text-green">Ingresos</th><th class="text-right text-red">Gastos</th><th class="text-right">Balance</th><th class="text-center">Vtas Carne</th><th class="text-center">Vtas Leche</th></tr></thead>
            <tbody>${data.porEspecie.map(e => `
              <tr>
                <td><strong>${e.especie}</strong></td>
                <td class="text-center">${e.numRebanos}</td>
                <td class="text-center font-bold">${e.numAnimales}</td>
                <td class="text-right text-green font-bold">${UI.formatCurrency(e.ingresos)}</td>
                <td class="text-right text-red">${UI.formatCurrency(e.gastos)}</td>
                <td class="text-right font-bold ${e.balance >= 0 ? 'text-green' : 'text-red'}">${UI.formatCurrency(e.balance)}</td>
                <td class="text-center">${e.numVentasCarne}</td>
                <td class="text-center">${e.numVentasLeche}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.reproduccion()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin datos de especies o ventas. Registra rebaños con especie asignada.</p></div>`}
      </div>`;
  },

  /** Curva de Producción */
  _renderCurvaProduccion(content, d) {
    const { curvaProdData } = d;
    const data = curvaProdData || { porMes: [], totalKg: 0, totalLitros: 0, totalIngresos: 0, metaKg: 0, metaLitros: 0, pctCumplimientoKg: '0', pctCumplimientoLitros: '0' };
    content.innerHTML = this._sectionActionsHTML('curva-prod', 'Curva Producción') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.grafico()} Curva de Producción</div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">kg Total</small>
              <span class="font-950 text-amber" style="font-size:var(--fs-h2);">${InformesView._fmt(data.totalKg, 1)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Litros Total</small>
              <span class="font-950 text-gold" style="font-size:var(--fs-h2);">${InformesView._fmt(data.totalLitros, 1)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Meta kg</small>
              <span class="font-950 text-green" style="font-size:var(--fs-h2);">${Math.round(data.metaKg)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Meta L</small>
              <span class="font-950 text-blue" style="font-size:var(--fs-h2);">${Math.round(data.metaLitros)}</span>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-8 mb-14">
          <div class="info-box-center border-left-${parseFloat(data.pctCumplimientoKg) >= 100 ? 'green' : 'amber'} py-10">
            <small class="s-lbl">CUMPLIMIENTO CARNE</small>
            <div class="inf-val-lg ${parseFloat(data.pctCumplimientoKg) >= 100 ? 'text-green' : 'text-amber'}">${data.pctCumplimientoKg}%</div>
          </div>
          <div class="info-box-center border-left-${parseFloat(data.pctCumplimientoLitros) >= 100 ? 'green' : 'amber'} py-10">
            <small class="s-lbl">CUMPLIMIENTO LECHE</small>
            <div class="inf-val-lg ${parseFloat(data.pctCumplimientoLitros) >= 100 ? 'text-green' : 'text-amber'}">${data.pctCumplimientoLitros}%</div>
          </div>
        </div>
        ${data.porMes.length > 0 ? `
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table inf-table-sm tbl-accent-blue">
            <thead><tr><th>Mes</th><th class="text-right text-amber">kg</th><th class="text-right text-gold">Litros</th><th class="text-right text-amber">kg Acum</th><th class="text-right text-gold">L Acum</th><th class="text-right text-green">Ingresos</th></tr></thead>
            <tbody>${data.porMes.map(m => `
              <tr>
                <td><strong>${m.mes}</strong></td>
                <td class="text-right text-amber">${InformesView._fmt(m.kg, 1)}</td>
                <td class="text-right text-gold">${InformesView._fmt(m.litros, 1)}</td>
                <td class="text-right font-bold">${InformesView._fmt(m.kgAcum, 1)}</td>
                <td class="text-right font-bold">${InformesView._fmt(m.litrosAcum, 1)}</td>
                <td class="text-right text-green">${UI.formatCurrency(m.ingresos)}</td>
              </tr>`).join('')}</tbody>
          </table>
        </div>` : `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.grafico()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin datos de producción registrados.</p></div>`}
      </div>`;
  },

  /** Break-Even: Punto Muerto */
  _renderBreakEven(content, d) {
    const { breakEvenData } = d;
    const data = breakEvenData || { costesFijos: 0, costesVariables: 0, ingresosTotal: 0, breakEvenKg: 0, breakEvenLitros: 0, margenSeguridadKg: '0%', margenSeguridadLitros: '0%', cubiertoCarne: false, cubiertoLeche: false, numRebanos: 0, numMeses: 0 };
    content.innerHTML = this._sectionActionsHTML('breakeven', 'Break-Even') + `
      <div class="inf-report card report-section   report-card">
        <div class="inf-card-title flex items-center gap-6">${Icons.balanza()} Análisis de Punto Muerto (Break-Even)</div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(239,68,68,0.02);">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Costes Fijos</small>
              <span class="font-950 text-red" style="font-size:var(--fs-h2); word-break:break-all;">${UI.formatCurrency(data.costesFijos)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Costes Variables</small>
              <span class="font-950 text-amber" style="font-size:var(--fs-h2); word-break:break-all;">${UI.formatCurrency(data.costesVariables)}</span>
            </div>
            <div class="info-box-center py-6">
              <small class="text-neutral block text-[0.6rem] mb-4 uppercase font-800">Ingresos</small>
              <span class="font-950 text-green" style="font-size:var(--fs-h2); word-break:break-all;">${UI.formatCurrency(data.ingresosTotal)}</span>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-10 mb-14">
          <div class="card p-14 card-tint-green>
            <div class="inf-card-title mb-10 text-base flex items-center gap-6">${Icons.carne()} Carne</div>
            <div class="grid grid-cols-2 gap-x-10 gap-y-12">
              <div class="min-w-0"><small class="s-lbl">Precio Medio kg</small><div class="inf-val-md text-amber truncate" title="${this._fmt(data.precioMedioKg, 2)}€">${this._fmt(data.precioMedioKg, 2)}€</div></div>
              <div class="min-w-0"><small class="s-lbl">Coste Var. kg</small><div class="inf-val-md text-red truncate" title="${this._fmt(data.costeVarKg, 2)}€">${this._fmt(data.costeVarKg, 2)}€</div></div>
              <div class="min-w-0"><small class="s-lbl">Break-Even</small><div class="inf-val-md ${data.cubiertoCarne ? 'text-green' : 'text-red'} truncate" title="${data.breakEvenKg} kg">${data.breakEvenKg} kg</div></div>
              <div class="min-w-0"><small class="s-lbl">Margen Seguridad</small><div class="inf-val-md text-blue truncate" title="${data.margenSeguridadKg}">${data.margenSeguridadKg}</div></div>
            </div>
          </div>
          <div class="card p-14 card-tint-amber>
            <div class="inf-card-title mb-10 text-base flex items-center gap-6">${Icons.leche()} Leche</div>
            <div class="grid grid-cols-2 gap-x-10 gap-y-12">
              <div class="min-w-0"><small class="s-lbl">Precio Medio L</small><div class="inf-val-md text-gold truncate" title="${this._fmt(data.precioMedioLitro, 3)}€">${this._fmt(data.precioMedioLitro, 3)}€</div></div>
              <div class="min-w-0"><small class="s-lbl">Coste Var. L</small><div class="inf-val-md text-red truncate" title="${this._fmt(data.costeVarLitro, 3)}€">${this._fmt(data.costeVarLitro, 3)}€</div></div>
              <div class="min-w-0"><small class="s-lbl">Break-Even</small><div class="inf-val-md ${data.cubiertoLeche ? 'text-green' : 'text-red'} truncate" title="${data.breakEvenLitros} L">${data.breakEvenLitros} L</div></div>
              <div class="min-w-0"><small class="s-lbl">Margen Seguridad</small><div class="inf-val-md text-blue truncate" title="${data.margenSeguridadLitros}">${data.margenSeguridadLitros}</div></div>
            </div>
          </div>
        </div>
        <div class="info-box mb-10">
          <small class="s-lbl uppercase font-900 text-gray">PERÍODO ANALIZADO</small>
          <div class="inf-val-md text-white">${data.numMeses} MESES · ${data.numRebanos} REBAÑOS</div>
        </div>
        ${data.ingresosTotal === 0 ? `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.balanza()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin datos económicos. Añade ventas y gastos para calcular el punto muerto.</p></div>` : ''}
      </div>`;
  },

  /** Subvenciones PAC */
  _renderSubvenciones(content, d) {
    const { pacData } = d;
    const data = pacData || { registros: [], totalSolicitado: 0, totalCobrado: 0, totalPendiente: 0, numRegistros: 0, porAnio: [] };
    content.innerHTML = this._sectionActionsHTML('subvenciones', 'PAC') + `
      <div class="inf-report card report-section   report-card">
        <div class="flex justify-between items-center mb-14">
          <div class="inf-card-title m-0">${Icons.pac()} Subvenciones PAC</div>
          <button class="btn btn-primary btn-sm btn--green-dk" onclick="InformesView._agregarPAC()">${Icons.agregar()} Añadir</button>
        </div>
        <div class="card p-12 mb-14 border-222 style="background:rgba(255,255,255,0.02);">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div class="py-6">
              <small class="text-neutral block text-[0.6rem] mb-2 uppercase font-800">Solicitado</small>
              <span class="font-950 text-green" style="font-size:var(--fs-h2); word-break:break-all;">${UI.formatCurrency(data.totalSolicitado)}</span>
            </div>
            <div class="hidden sm:block" style="width:1px;height:22px;background:#2a2a2a; align-self:center;"></div>
            <div class="py-6">
              <small class="text-neutral block text-[0.6rem] mb-2 uppercase font-800">Cobrado</small>
              <span class="font-950 text-blue" style="font-size:var(--fs-h2); word-break:break-all;">${UI.formatCurrency(data.totalCobrado)}</span>
            </div>
            <div class="hidden sm:block" style="width:1px;height:22px;background:#2a2a2a; align-self:center;"></div>
            <div class="py-6">
              <small class="text-neutral block text-[0.6rem] mb-2 uppercase font-800">Pendiente</small>
              <span class="font-950 ${data.totalPendiente>0?'text-amber':'text-green'}" style="font-size:var(--fs-h2); word-break:break-all;">${UI.formatCurrency(data.totalPendiente)}</span>
            </div>
            <div class="hidden sm:block" style="width:1px;height:22px;background:#2a2a2a; align-self:center;"></div>
            <div class="py-6">
              <small class="text-neutral block text-[0.6rem] mb-2 uppercase font-800">Registros</small>
              <span class="font-950 text-purple" style="font-size:var(--fs-h2);">${data.numRegistros}</span>
            </div>
          </div>
        </div>
        ${data.porAnio.length > 0 ? `
        <div class="inf-section-title text-center uppercase font-900 mb-8">Resumen por año</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-10 mb-14">
          ${data.porAnio.map(a => `
            <div class="info-box-center py-10 bg-black border border-222">
              <small class="s-lbl text-amber">${a.anio}</small>
              <div class="flex flex-col items-center gap-4">
                <div class="text-xl font-950 text-green">${UI.formatCurrency(a.cobrado)} <span class="text-gray-700 text-xs mx-4">/</span> <span class="text-amber font-900 text-lg">${UI.formatCurrency(a.solicitado)}</span></div>
                <span class="text-gray-500 text-[0.6rem] uppercase font-900 tracking-widest">${a.num} AYUDAS REGISTRADAS</span>
              </div>
            </div>`).join('')}
        </div>` : ''}
        ${data.registros.length > 0 ? `
        <div class="table-scroll scroll-shadow-container">
          <table class="inf-table inf-table-sm tbl-accent-green">
            <thead><tr><th>Año</th><th>Concepto</th><th>Régimen</th><th class="text-right">Solicitado</th><th class="text-right">Cobrado</th><th class="text-center">Estado</th></tr></thead>
            <tbody>${data.registros.map(r => {
              const pct = r.importe_solicitado > 0 ? InformesView._fmt(((r.importe_cobrado || 0) / r.importe_solicitado * 100), 0) : 0;
              const est = pct >= 100 ? `${Icons.check()} COBRADO` : pct > 0 ? `${Icons.rotacion()} PARCIAL` : `${Icons.calendar()} PENDIENTE`;
              return `<tr>
                <td class="font-900">${r.anio || '-'}</td>
                <td class="uppercase font-700">${r.concepto || r.descripcion || 'PAC'}</td>
                <td class="text-gray-500 text-[0.6rem] uppercase font-800">${r.regimen || '—'}</td>
                <td class="text-right font-800">${UI.formatCurrency(r.importe_solicitado || 0)}</td>
                <td class="text-right text-green font-950">${UI.formatCurrency(r.importe_cobrado || 0)}</td>
                <td class="text-center text-[0.6rem] font-900 uppercase">${est}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>` : `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.pac()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin subvenciones PAC registradas. Usa "Añadir" para registrar ayudas de la PAC, PDR, incorporación jóvenes u otras subvenciones.</p></div>`}
      </div>
    `;
  },

  /** Agrega un registro de subvención PAC vía overlay simple */
  async _agregarPAC() {
    const overlay = document.createElement('div');
    overlay.className = 'wizard-full-screen';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
    overlay.innerHTML = `
      <div class="card p-25 max-w-380 border-top-5-success>
        <h3 class="mt-0 text-green">${Icons.pac()} Nueva Subvención PAC</h3>
        <div class="wizard-input-group">
          <label class="wizard-label">Año</label>
          <input type="number" id="pac-anio" value="${new Date().getFullYear()}" class="wizard-input">
        </div>
        <div class="wizard-input-group">
          <label class="wizard-label">Concepto</label>
          <input type="text" id="pac-concepto" placeholder="PAC, PDR, Incorporación Jóvenes..." class="wizard-input">
        </div>
        <div class="wizard-input-group">
          <label class="wizard-label">RÉGIMEN</label>
          <select id="pac-regimen" class="wizard-input wizard-select font-900">
            <option value="PAC Base">PAC Base</option>
            <option value="PAC Verde">PAC Verde</option>
            <option value="PDR">PDR</option>
            <option value="Incorporación Jóvenes">Incorporación Jóvenes</option>
            <option value="Bienestar Animal">Bienestar Animal</option>
            <option value="Producción Ecológica">Producción Ecológica</option>
            <option value="Otra">Otra</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-10">
          <div class="wizard-input-group">
            <label class="wizard-label">Importe Solicitado (€)</label>
            <input type="number" id="pac-solicitado" step="0.01" class="wizard-input">
          </div>
          <div class="wizard-input-group">
            <label class="wizard-label">Importe Cobrado (€)</label>
            <input type="number" id="pac-cobrado" step="0.01" value="0" class="wizard-input">
          </div>
        </div>
        <div class="flex gap-10 mt-20">
          <button class="wizard-btn-action wizard-btn-primary flex-1" id="btn-pac-guardar">${Icons.guardar()} Guardar</button>
          <button class="wizard-btn-action wizard-btn-secondary" onclick="InformesView._cerrarOverlayPAC(this)">${Icons.cerrar()} Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    InformesView._pacGuardado = false;
    App.setExitGuard(() => InformesView._confirmSalirOverlayPAC());

    overlay.querySelector('#btn-pac-guardar').onclick = async () => {
      const anio = parseInt(document.getElementById('pac-anio').value);
      const concepto = document.getElementById('pac-concepto').value.trim();
      const regimen = document.getElementById('pac-regimen').value;
      const solicitado = parseFloat(document.getElementById('pac-solicitado').value) || 0;
      const cobrado = parseFloat(document.getElementById('pac-cobrado').value) || 0;
      if (!concepto || solicitado <= 0) { App.toastError("Concepto e importe solicitado obligatorios"); return; }
      try {
        await window.db.add('documentos_legales', {
          tipo: 'pac', anio, concepto, regimen,
          importe_solicitado: solicitado, importe_cobrado: cobrado,
          fecha_emision: new Date().toISOString().split('T')[0],
          fincaId: await Fincas.getActiveId(),
          creadoEn: new Date().toISOString()
        });
        InformesView._pacGuardado = true;
        App.clearExitGuard();
        App.toast('Subvención registrada', 'success');
        overlay.remove();
        if (window.InformesView) { InformesView._cachedData = null; await InformesView.render(); }
      } catch (e) { App.toastError("Error: " + e.message); }
    };
  },

  /** Guarda de salida compartida con el botón físico Android (ver App.setExitGuard). */
  async _confirmSalirOverlayPAC() {
    if (this._pacGuardado) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _cerrarOverlayPAC(btn) {
    if (!(await this._confirmSalirOverlayPAC())) return;
    App.clearExitGuard();
    const overlay = btn.closest('.wizard-full-screen');
    if (overlay) overlay.remove();
  },

  // ===================== GRÁFICOS =====================

  _renderGraficosGeneral(d) {
    const { margenA, lecheStats, kpisRepro, estadisticasSanidad } = d;
    setTimeout(() => {
      if (margenA?.length > 0) this._renderScatter('chart-margen-animal', margenA, 'var(--c-success)');
      if (lecheStats?.timeline?.length > 1) this._renderLecheTimeline('chart-leche-timeline', lecheStats.timeline);
    }, 50);
  },

  _renderScatter(canvasId, data, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    new Chart(ctx.getContext("2d"), {
      type: "scatter",
      data: { datasets: [{ label: "Animales", data, backgroundColor: color, pointRadius: 5 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { grid: { color: "#222" }, title: { display: true, text: 'Peso Vivo (kg)', color: '#888' } }, y: { grid: { color: "#222" }, title: { display: true, text: 'Margen (€)', color: '#888' } } },
        plugins: { legend: { display: false } }
      }
    });
  },

  _renderBarrasZonas(canvasId, rentZ) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    new Chart(ctx.getContext("2d"), {
      type: "bar",
      data: {
        labels: rentZ.map(z => z.zona), datasets: [
          { label: "Ingresos", data: rentZ.map(z => z.ingresos), backgroundColor: "#C5FA50" },
          { label: "Gastos", data: rentZ.map(z => z.gastos), backgroundColor: "#E8555F" }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#888", boxWidth: 12 } } } }
    });
  },

  _renderLecheTimeline(canvasId, timeline) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    new Chart(ctx.getContext("2d"), {
      type: 'line',
      data: {
        labels: timeline.map(r => { const d = r.fecha.split('-'); return d[1] + '/' + d[2]; }),
        datasets: [{ label: 'Litros', data: timeline.map(r => r.litros), borderColor: '#FFFC55', backgroundColor: 'rgba(255,214,0,0.1)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#FFFC55' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { grid: { color: '#222' }, ticks: { color: '#888', font: { size: 9 } } }, y: { grid: { color: '#222' }, beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });
  },

};

window.InformesView = InformesView;
