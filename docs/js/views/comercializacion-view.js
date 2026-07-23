/**
 * Livestock Manager - ComercializacionView v3.0.0
 * Consola unificada de Comercialización (CoMer) multipestaña con soporte premium.
 * Agrupa: Leche, Carne, Clientes, Contratos y Logística.
 */

const ComercializacionView = {
  _activeSubModule: 'leche', // 'leche', 'carne', 'compradores', 'contratos', 'transportistas'
  _cachedData: null,
  _cachedFincaId: null,
  _needsDataRefresh: false,
  _loadingPromise: null,

  async _ensureData(fincaId, force = false) {
    if (!fincaId) {
      this._cachedData = { ventas: [], entregas: [], kpis: { carne: [], leche: [] } };
      this._cachedFincaId = null;
      this._needsDataRefresh = false;
      return this._cachedData;
    }

    if (!force && !this._needsDataRefresh && this._cachedData && this._cachedFincaId === fincaId) {
      return this._cachedData;
    }

    if (this._loadingPromise) {
      await this._loadingPromise;
      return this._cachedData;
    }

    this._loadingPromise = (async () => {
      const [ventas, entregas] = await Promise.all([
        window.db.getAllFromIndex('comercializacion_carne', 'fincaId', fincaId).catch(() => []),
        window.db.getAllFromIndex('comercializacion_leche', 'fincaId', fincaId).catch(() => [])
      ]);

      ventas.sort((a, b) => new Date(b.fechaSacrificio || 0) - new Date(a.fechaSacrificio || 0));
      entregas.sort((a, b) => new Date(b.fechaRecogida || 0) - new Date(a.fechaRecogida || 0));

      const pesoTotal = ventas.reduce((s, v) => s + (v.pesoCanal || v.pesoVivo || 0), 0);
      const rendProm = ventas.length > 0 ? ventas.reduce((s, v) => s + (v.rendimientoCanal || 0), 0) / ventas.length : 0;
      const ingresoTotal = ventas.reduce((s, v) => s + (v.precio_total || 0), 0);
      const litrosTotal = entregas.reduce((s, e) => s + (e.cantidad || 0), 0);

      // FASE 4: Margen Comercial Neto Real de Carne
      const gastoTransporteTotal = ventas.reduce((s, v) => s + (parseFloat(v.Gasto_Transporte) || 0), 0);
      const gastoMatanzaTotal = ventas.reduce((s, v) => s + (parseFloat(v.Gasto_Matanza) || 0), 0);
      const margenNetoCarne = ingresoTotal - gastoTransporteTotal - gastoMatanzaTotal;

      // FASE 4: Margen sobre Coste Alimentación (MOFA) Real Dinámico
      const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []);
      const gastosAlim = gastos.filter(g => {
        const cat = (g.categoria || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return cat.includes('aliment') && !g.anulado;
      });

      let mofaTotalReal = 0;
      let totalGastosAlimPeriodo = 0;
      if (entregas.length > 0) {
        const ingresosLecheTotal = entregas.reduce((s, e) => s + (e.importe_total || 0), 0);
        const fechasRecogida = entregas.map(e => new Date(e.fechaRecogida || e.fecha)).filter(d => !isNaN(d));
        if (fechasRecogida.length > 0) {
          const fechaMin = new Date(Math.min(...fechasRecogida));
          const fechaMax = new Date(Math.max(...fechasRecogida));
          
          totalGastosAlimPeriodo = gastosAlim.reduce((s, g) => {
            const fGasto = new Date(g.fecha);
            if (fGasto >= fechaMin && fGasto <= fechaMax) {
              return s + (parseFloat(g.importe) || 0);
            }
            return s;
          }, 0);
          mofaTotalReal = ingresosLecheTotal - totalGastosAlimPeriodo;
        } else {
          mofaTotalReal = entregas.reduce((s, e) => s + (e.mofa || 0), 0);
        }
      }

      this._cachedData = {
        ventas,
        entregas,
        kpis: {
          carne: [
            { label: 'Peso Canal (kg)', value: this._fmt(pesoTotal) + ' kg' },
            { label: 'Animales Vendidos', value: ventas.length },
            { label: 'Rend. Promedio', value: UI.formatPercent(rendProm, 1) },
            { label: 'Ingreso Bruto', value: this._fmt(ingresoTotal) + ' €', color: '#94A3B8' },
            { label: 'Margen Neto Real', value: this._fmt(Math.round(margenNetoCarne)) + ' €', color: 'var(--c-success)' }
          ],
          leche: [
            { label: 'Total Litros', value: this._fmt(litrosTotal) + ' L' },
            { label: 'Cisternas Cargadas', value: entregas.length },
            { label: 'Alimentación Período', value: this._fmt(Math.round(totalGastosAlimPeriodo)) + ' €', color: 'var(--c-danger)' },
            { label: 'MOFA Real (Neto)', value: this._fmt(Math.round(mofaTotalReal)) + ' €', color: 'var(--c-success)' }
          ]
        },
        rendimientoMensual: [] // Para los gráficos de barra - FASE 4: Tarea 3
      };

      this._cachedFincaId = fincaId;
      this._needsDataRefresh = false;
      return this._cachedData;
    })();

    try {
      return await this._loadingPromise;
    } finally {
      this._loadingPromise = null;
    }
  },

  invalidateCache() {
    this._needsDataRefresh = true;
  },

  async render(params) {
    const main = document.getElementById('app-content');
    const fincaId = await Fincas.getActiveId();
    if (!fincaId) {
      main.innerHTML = `<div class="p-20 text-center"><p class="text-gray">No hay ninguna finca seleccionada.</p></div>`;
      return;
    }

    // Sub-módulos permitidos según los tipos de explotación activos (Leche/Carne)
    const flagsModo = window.ModoContextoHelper.getFlags() || { leche: true, carne: false };
    const allowedSubModules = ['compradores', 'contratos', 'transportistas']; // siempre permitidos
    if (flagsModo.leche) allowedSubModules.push('leche');
    if (flagsModo.carne) allowedSubModules.push('carne');

    // Obtener la pestaña solicitada por parámetro o por el estado actual
    const requestedTab = (params && params.get ? params.get("tab") : null) || this._activeSubModule;
    const priorityOrder = ['leche', 'carne', 'compradores', 'contratos', 'transportistas'];
    const firstAllowed = priorityOrder.find(tab => allowedSubModules.includes(tab)) || null;
    this._activeSubModule = allowedSubModules.includes(requestedTab) ? requestedTab : firstAllowed;

    const contratos = await window.db.getAll('contratos_compra').catch(() => []);
    const hoy = new Date();

    // Auto-ajuste de demostración: Asegurar que el contrato de carne expire pronto (en 15 días) para testear alertas de vencimiento
    const fincaActiva = await Fincas.getActive().catch(() => null);
    if (fincaActiva && (fincaActiva.demo || (fincaActiva.nombre && fincaActiva.nombre.includes('CHAMORRO')))) {
      const tieneVenciendoPronto = contratos.some(c => {
        if (c.anulado || c.activo === false) return false;
        if (!c.fecha_fin) return false;
        const difDias = Math.ceil((new Date(c.fecha_fin) - hoy) / (24 * 60 * 60 * 1000));
        return difDias >= 0 && difDias <= 30;
      });

      if (!tieneVenciendoPronto) {
        const cCarne = contratos.find(c => c.numero_contrato === 'CT-2026-001');
        if (cCarne) {
          const fVence = new Date(hoy.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          cCarne.fecha_fin = fVence;
          await window.db.put('contratos_compra', cCarne).catch(() => {});
          
          setTimeout(() => { location.hash = '#/comercializacion'; }, 100);
          return;
        }
      }
    }

    const contratosVenciendo = contratos.filter(c => {
      if (c.anulado || c.activo === false) return false;
      if (!c.fecha_fin) return false;
      const fFin = new Date(c.fecha_fin);
      const difMs = fFin - hoy;
      const difDias = Math.ceil(difMs / (24 * 60 * 60 * 1000));
      return difDias >= 0 && difDias <= 30;
    });

    let alertaContratosHtml = '';
    if (contratosVenciendo.length > 0) {
      alertaContratosHtml = `
        <div class="card p-12 mb-14 border-gold animate-pulse-slow" style="background: rgba(255, 215, 0, 0.03); border-left: 4px solid var(--p-gold); border-radius: 8px;">
          <div class="flex items-center gap-8 justify-between">
            <div class="flex items-center gap-6 text-gold font-950 text-xs uppercase tracking-wider">
              ${Icons.alerta()} ${contratosVenciendo.length === 1 ? 'CONTRATO EXPIRA PRONTO' : 'CONTRATOS EXPIRAN PRONTO'}
            </div>
            <button onclick="ComercializacionView._cambiarSubModulo('contratos')" class="text-[0.62rem] font-black text-gold border border-gold px-6 py-2 rounded-xs hover:bg-gold hover:text-black uppercase transition-all">GESTIONAR ➔</button>
          </div>
          <div class="text-[0.65rem] text-aaa font-700 uppercase mt-6 leading-relaxed">
            ${contratosVenciendo.map(c => `CONTRATO Nº <span class="text-gold font-mono font-950">${c.numero_contrato || c.id}</span> EXPIRA EL ${UI.formatDate(c.fecha_fin)} (${Math.ceil((new Date(c.fecha_fin) - hoy) / (24*60*60*1000))} DÍAS RESTANTES)`).join('<br>')}
          </div>
        </div>
      `;
    }

    const currentMeta = this._getSubModuleMeta(this._activeSubModule);

    // Color de pantalla fijo de CoMer (amarillo), igual para todos sus submódulos
    if (window.App && App.updateHeaderColor) {
      App.updateHeaderColor('var(--c-warning)');
    }

    // Cabecera de módulo: chip de modo + KPI de la métrica dominante (leche/carne) +
    // acción principal cuando la pestaña activa es una de las dos comerciales.
    const modoMetaComer = window.ModoContextoHelper.getModeMetaEffective(flagsModo);
    let headerKpisHtml = '';
    let headerPrimaryHtml = '';
    if (this._activeSubModule === 'leche' || this._activeSubModule === 'carne') {
      const dComer = await this._ensureData(fincaId, this._needsDataRefresh);
      if (this._activeSubModule === 'leche') {
        const litros = dComer.entregas.reduce((s, e) => s + (e.cantidad || 0), 0);
        headerKpisHtml = `
          <div class="module-header-kpi">
            <span class="module-header-kpi-label">Entregas</span>
            <span class="module-header-kpi-value">${dComer.entregas.length}</span>
          </div>
          <div class="module-header-kpi">
            <span class="module-header-kpi-label">Litros</span>
            <span class="module-header-kpi-value">${UI.formatNumber(litros)}</span>
          </div>`;
        headerPrimaryHtml = `<button class="btn btn-create btn-lg" onclick="App._abrirWizardAlbaranLeche()">${Icons.fabPlus()} Registrar Retirada</button>`;
      } else {
        const ingreso = dComer.ventas.reduce((s, v) => s + (v.precio_total || 0), 0);
        headerKpisHtml = `
          <div class="module-header-kpi">
            <span class="module-header-kpi-label">Ventas</span>
            <span class="module-header-kpi-value">${dComer.ventas.length}</span>
          </div>
          <div class="module-header-kpi">
            <span class="module-header-kpi-label">Ingreso</span>
            <span class="module-header-kpi-value" style="color: var(--c-success);">${UI.formatCurrency(Math.round(ingreso))}</span>
          </div>`;
        headerPrimaryHtml = `<button class="btn btn-create btn-lg" onclick="App._abrirWizardVentaMasiva()">${Icons.fabPlus()} Registrar Venta</button>`;
      }
    }

    main.innerHTML = `
      <!-- Carrusel circular de secciones de Comercialización: marco centrado con la sección activa -->
      <div class="mb-14">
        ${App.renderCarruselPestanas(
          ['leche', 'carne', 'compradores', 'contratos', 'transportistas'].filter(tab => allowedSubModules.includes(tab)).map(tab => {
            const meta = this._getSubModuleMeta(tab);
            return { key: tab, icon: meta.icon, label: tab.toUpperCase(), color: meta.color };
          }),
          this._activeSubModule,
          'ComercializacionView'
        )}
      </div>

      <div class="module-header">
        <div class="module-header-kpis">
          <span class="module-mode-chip" style="--mode-color: ${modoMetaComer.color};">${modoMetaComer.icon} ${modoMetaComer.label}</span>
          ${headerKpisHtml}
        </div>
        ${headerPrimaryHtml ? `<div class="module-header-primary-action">${headerPrimaryHtml}</div>` : ''}
        <div class="text-left mb-6 uppercase" style="letter-spacing: 0.5px;">
          <h1 style="font-size: 1.25rem; font-weight: 900; color: #fff; margin: 0; display: flex; items-center;">
            <span style="color:${currentMeta.color}; margin-right:4px;">|</span> ${currentMeta.title}
          </h1>
          <div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
            ${currentMeta.desc}
          </div>
        </div>
      </div>

      ${alertaContratosHtml}

      <!-- Contenedor Dinámico para la pestaña activa -->
      <div id="comer-agenda-widget"></div>
      <div id="comercializacion-tab-content" class="animate-fade-in"></div>`;

    // Inyectar widget de agenda si el módulo está disponible
    if (window.AgendaView) {
        window.AgendaView.renderWidget(document.getElementById('comer-agenda-widget'), 'contratos');
    }

    // Delegación dinámica de renderizado de pestañas
    switch (this._activeSubModule) {
      case 'leche':
        await this._renderLecheSubTab();
        break;
      case 'carne':
        await this._renderCarneSubTab();
        break;
      case 'compradores':
        if (window.CompradoresView) {
          CompradoresView._activeModule = 'compradores';
          await CompradoresView.render();
        }
        break;
      case 'contratos':
        if (window.ContratosView) {
          await ContratosView.render();
        }
        break;
      case 'transportistas':
        if (window.TransportistasView) {
          await TransportistasView.render();
        }
        break;
    }
  },

  _cambiarSubModulo(subModulo) {
    const flags = window.ModoContextoHelper.getFlags() || { leche: true, carne: false };
    const permitido =
      ['compradores', 'contratos', 'transportistas'].includes(subModulo) ||
      (subModulo === 'leche' && flags.leche) ||
      (subModulo === 'carne' && flags.carne);

    if (!permitido) {
      // Sub-módulo no permitido con los tipos de explotación activos actuales: se ignora el cambio
      return;
    }
    this._activeSubModule = subModulo;
    this.render();
  },

  _getSubModuleMeta(sub) {
    const map = {
      leche: { icon: Icons.leche(), color: 'var(--c-info)', title: 'CONTRATOS Y ENTREGAS LÁCTEAS', desc: 'Control de cisternas, analíticas y albaranes de leche' },
      carne: { icon: Icons.carne(), color: 'var(--c-success)', title: 'COMERCIALIZACIÓN CÁRNICA', desc: 'Ventas de ganado, rendimientos de canal y facturación' },
      compradores: { icon: Icons.compradores(), color: 'var(--c-purple)', title: 'CARTERA DE CLIENTES', desc: 'Registro de mataderos, cooperativas y centrales lecheras' },
      contratos: { icon: Icons.documento(), color: 'var(--c-purple)', title: 'CONTRATOS DE COMPRA', desc: 'Acuerdos comerciales de suministro y trazabilidad de precios' },
      transportistas: { icon: Icons.transportistas(), color: 'var(--c-pink)', title: 'LOGÍSTICA Y TRANSPORTISTAS', desc: 'Flota de transporte ganadero calificado y cisternas' }
    };
    return map[sub] || map.leche;
  },

  async _renderLecheSubTab() {
    const container = document.getElementById('comercializacion-tab-content');
    if (!container) return;
    const fincaId = await Fincas.getActiveId();
    const d = await this._ensureData(fincaId, this._needsDataRefresh);

    const kpisHtml = this._renderKPIsSubTab('leche', d.kpis.leche, 'var(--c-info)', Icons.leche());
    
    container.innerHTML = `
      <div class="explotacion-kpis mb-14">
        ${kpisHtml}
      </div>
      <div id="comer-sub-content"></div>`;

    const subContent = document.getElementById('comer-sub-content');
    this._renderSeccion(subContent, {
      icon: Icons.leche(),
      title: 'Entregas Leche',
      color: 'var(--c-info)',
      registrarLabel: 'REGISTRAR RETIRADA',
      listName: 'LISTA DE ENTREGAS',
      registrarHandler: "App._abrirWizardAlbaranLeche()",
      records: d.entregas.slice(0, 50).map(e => {
        const grasa = e.laboratorio?.grasa;
        const proteina = e.laboratorio?.proteina;
        return {
        title: `Cisterna: ${e.matriculaCisterna || 'S/N'}`,
        metadata: `<span>${UI.formatDate(e.fechaRecogida || e.fecha)}</span><span>·</span><span>${UI.formatNumber(e.cantidad || 0)} L</span>${grasa ? `<span>·</span><span style="color:var(--c-warning);">${Icons.grafico()} Grasa ${grasa}%</span>` : ''}${proteina ? `<span>·</span><span style="color:var(--c-info);">Prot. ${proteina}%</span>` : ''}${e.antibioticos ? `<span>·</span><span style="color:var(--c-danger); font-weight:900;">${Icons.alerta()} ANTIBIÓTICOS</span>` : ''}`,
        badge: (() => {
          const est = (e.estadoAnalitica || 'PENDIENTE').toUpperCase();
          let colorBadge = 'var(--c-warning)';
          if (e.antibioticos || est.includes('ALERTA') || est.includes('CRÍTIC') || est.includes('CRITIC') || est.includes('RECHAZ') || est.includes('DANGER') || est.includes('INCORRECT') || est.includes('FAIL')) {
            colorBadge = 'var(--c-danger)';
          } else if (est.includes('APT') || est.includes('CONFORME') || est.includes('CORRECT') || est.includes('EXIT') || est.includes('VALID')) {
            colorBadge = 'var(--c-success)';
          } else if (est.includes('PENDI') || est.includes('ESPERA')) {
            colorBadge = 'var(--c-orange)';
          } else {
            colorBadge = 'var(--c-info)';
          }
          return `<span class="badge badge-sm uppercase" style="background:color-mix(in srgb, ${colorBadge} 8%, transparent); color:${colorBadge}; border:1px solid color-mix(in srgb, ${colorBadge} 21%, transparent); padding:4px 8px; border-radius:4px; font-weight:900; letter-spacing:0.5px; font-size: 0.62rem;">${est}</span>`;
        })(),
        onclick: `location.hash='/albaran-leche?id=${e.id}'`
      };}),
      emptyMsg: 'Sin entregas de leche registradas.'
    });

    // FASE 4: Gráfico de rendimiento de leche (Tarea 3)
    const lecheChartContainer = document.createElement('div');
    lecheChartContainer.id = 'leche-rendimiento-chart';
    subContent.appendChild(lecheChartContainer);
    const rendimientoLeche = this._calcularRendimientoMensual(d.ventas, d.entregas);
    this._renderRendimientoBarChart(lecheChartContainer, rendimientoLeche, 'litros', 'Producción Mensual de Leche', 'var(--c-success)', 'var(--c-danger)');
  },

  async _renderCarneSubTab() {
    const container = document.getElementById('comercializacion-tab-content');
    if (!container) return;
    const fincaId = await Fincas.getActiveId();
    const d = await this._ensureData(fincaId, this._needsDataRefresh);

    const kpisHtml = this._renderKPIsSubTab('carne', d.kpis.carne, 'var(--c-success)', Icons.carne());
    
    container.innerHTML = `
      <div class="explotacion-kpis mb-14">
        ${kpisHtml}
      </div>
      <div id="comer-sub-content"></div>`;

    const subContent = document.getElementById('comer-sub-content');
    this._renderSeccion(subContent, {
      icon: Icons.carne(),
      title: 'Ventas Carne',
      color: 'var(--c-success)',
      registrarLabel: 'REGISTRAR VENTA',
      listName: 'LISTA DE VENTAS',
      registrarHandler: "App._abrirWizardVentaMasiva()",
      records: d.ventas.slice(0, 50).map(v => ({
        title: v.razonSocial || 'Matadero',
        metadata: `<span>${UI.formatDate(v.fechaSacrificio || v.fecha || 0)}</span><span>·</span><span>${v.pesoCanal || 0} kg canal</span>${v.rendimientoCanal ? `<span>·</span><span style="color:${v.rendimientoCanal >= 50 ? 'var(--c-success)' : 'var(--c-warning)'};">${Icons.grafico()} Rend. ${v.rendimientoCanal}%</span>` : ''}${v.clasificacionCanal ? `<span>·</span><span style="color:var(--p-gold);">Clasif. ${v.clasificacionCanal}</span>` : ''}`,
        badge: UI.formatCurrency(Math.round(v.importe_total || 0)),
        onclick: `App._abrirDetalleVentaCarne(${v.id})`
      })),
      emptyMsg: 'Sin ventas de carne registradas.'
    });

    // FASE 4: Gráfico de rendimiento de carne (Tarea 3)
    const carneChartContainer = document.createElement('div');
    carneChartContainer.id = 'carne-rendimiento-chart';
    subContent.appendChild(carneChartContainer);
    const rendimientoCarne = this._calcularRendimientoMensual(d.ventas, d.entregas);
    this._renderRendimientoBarChart(carneChartContainer, rendimientoCarne, 'peso', 'Peso Mensual de Carne Vendida', 'var(--c-success)', 'var(--c-warning)');
  },

  _renderKPIsSubTab(tabKey, kpis, color, icon) {
    const labelMap = { leche: 'LÁCTEO', carne: 'CÁRNICO' };
    return `
      <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(255,255,255,0.02); width:100%;">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center justify-between gap-6">
          <span class="flex items-center gap-6"><span style="color: ${color}; margin-right: 4px;">|</span> ${icon} BALANCE ${labelMap[tabKey]}</span>
          <button class="resumen-toggle" onclick="App.toggleResumen(this)">${Icons.chevronAbajo()}</button>
        </div>
        <div class="resumen-body flex flex-col">
          ${kpis.map(k => `
            <div class="py-12 flex justify-between items-center ${kpis.indexOf(k) < kpis.length - 1 ? 'border-bottom-222' : ''}">
              <span class="text-xs text-gray uppercase font-900">${k.label}</span>
              <strong class="text-xl font-950" style="color:${k.color || 'var(--text-p)'};">${k.value}</strong>
            </div>
          `).join('')}
        </div>
      </div>`;
  },

  _renderSeccion(content, opts) {
    const { icon, title, color, registrarLabel, listName, records, emptyMsg, registrarHandler } = opts;

    const recordsHtml = records.length > 0
      ? records.map(r => App._cardRegistro({
          icon: r.icon || icon,
          title: r.title,
          metadata: r.metadata,
          badge: r.badge,
          color: color,
          onClick: r.onclick
        })).join('')
      : `<div class="p-16 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-sm">${Icons.buscar()} ${emptyMsg}</span></div>`;

    content.innerHTML = `
      <div class="card p-14 border-222" style="background: rgba(255,255,255,0.02);">
        <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-6">
          <span style="color: ${color}; margin-right: 4px;">|</span> ${Icons.documento()} ${listName}
        </div>
        <div class="grid gap-10">
          ${recordsHtml}
        </div>
      </div>`;
  },

  _fmt(n) {
    return UI.formatNumber(n);
  },

  // FASE 4: Calcular datos de rendimiento mensual para gráficos de barra
  _calcularRendimientoMensual(ventas, entregas) {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hoy = new Date();
    const datosMensuales = [];

    // Últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mesKey = fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');

      // Filtrar ventas del mes
      const ventasMes = ventas.filter(v => {
        const fechaVenta = new Date(v.fechaSacrificio || v.fecha || 0);
        return fechaVenta.getFullYear() === fecha.getFullYear() &&
               fechaVenta.getMonth() === fecha.getMonth();
      });

      // Filtrar entregas del mes
      const entregasMes = entregas.filter(e => {
        const fechaEntrega = new Date(e.fechaRecogida || e.fecha || 0);
        return fechaEntrega.getFullYear() === fecha.getFullYear() &&
               fechaEntrega.getMonth() === fecha.getMonth();
      });

      // Calcular métricas del mes
      const pesoMensual = ventasMes.reduce((s, v) => s + (v.pesoCanal || v.pesoVivo || 0), 0);
      const ingresoMensual = ventasMes.reduce((s, v) => s + (v.precio_total || 0), 0);
      const litrosMensual = entregasMes.reduce((s, e) => s + (e.cantidad || 0), 0);
      const rendMensual = ventasMes.length > 0 ?
        ventasMes.reduce((s, v) => s + (v.rendimientoCanal || 0), 0) / ventasMes.length : 0;

      datosMensuales.push({
        mes: meses[fecha.getMonth()],
        mesCompleto: `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`,
        peso: pesoMensual,
        ingreso: ingresoMensual,
        litros: litrosMensual,
        rendimiento: rendMensual
      });
    }

    return datosMensuales;
  },

  // FASE 4: Renderizar gráficos de barra de rendimiento (Tarea 3)
  _renderRendimientoBarChart(container, datosMensuales, tipoMetrica, titulo, colorPositivo, colorNegativo) {
    if (!datosMensuales || datosMensuales.length === 0) {
      container.innerHTML = `<div class="p-16 text-center text-gray">No hay datos disponibles para mostrar gráficos de rendimiento.</div>`;
      return;
    }

    // Calcular el valor máximo para escalar las barras
    let maxValor = 0;
    if (tipoMetrica === 'peso') {
      maxValor = Math.max(...datosMensuales.map(d => d.peso));
    } else if (tipoMetrica === 'ingreso') {
      maxValor = Math.max(...datosMensuales.map(d => d.ingreso));
    } else if (tipoMetrica === 'litros') {
      maxValor = Math.max(...datosMensuales.map(d => d.litros));
    } else if (tipoMetrica === 'rendimiento') {
      maxValor = Math.max(...datosMensuales.map(d => d.rendimiento));
    }

    // Asegurar que el máximo sea al menos 1 para evitar división por cero
    maxValor = Math.max(1, maxValor);

    const mesesHtml = datosMensuales.map(dato => {
      let valor = 0;
      let color = 'var(--c-success)'; // Color por defecto (positivo)

      if (tipoMetrica === 'peso') {
        valor = dato.peso;
      } else if (tipoMetrica === 'ingreso') {
        valor = dato.ingreso;
      } else if (tipoMetrica === 'litros') {
        valor = dato.litros;
      } else if (tipoMetrica === 'rendimiento') {
        valor = dato.rendimiento;
        // Para el rendimiento, el color indica si es bueno (> promedio) o malo (< promedio)
        const promedio = datosMensuales.reduce((sum, d) => sum + d.rendimiento, 0) / datosMensuales.length;
        color = valor >= promedio ? colorPositivo : colorNegativo;
      }

      const porcentaje = (valor / maxValor) * 100;
      const altura = Math.max(4, porcentaje); // Altura mínima de 4px

      return `<div class="flex-1 text-center min-w-0">
        <div class="text-xs text-gray mb-2" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${dato.mes}</div>
        <div class="leche-bar-wrap" style="position:relative; height:30px;">
          <div style="position:absolute;bottom:0;width:80%;height:${altura}%;background:${color};border-radius:4px 4px 0 0;opacity:0.8;transition:height 0.3s;left:10%;"></div>
        </div>
        <div class="text-xs font-bold mt-1" style="color:${color};">${UI.formatNumber(valor)}${tipoMetrica === 'rendimiento' ? '%' : ''}</div>
      </div>`;
    }).join('');

    container.innerHTML = `
      <div class="mb-12">
        <div class="text-[0.65rem] text-gray uppercase font-900 tracking-wider mb-4">${titulo}</div>
        <div class="grid gap-4">
          ${mesesHtml}
        </div>
        <div class="text-xs text-gray mt-2">
          Últimos 6 meses: ${datosMensuales.map(d => d.mesCompleto).join(' • ')}
        </div>
      </div>`;
  }
};

window.ComercializacionView = ComercializacionView;
