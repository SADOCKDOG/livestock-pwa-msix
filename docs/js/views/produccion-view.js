/**
 * Livestock Manager - ProduccionView v3.2.0
 * Vista de Producción con tabs — Cárnica y Láctea.
 * Módulo Lácteo v24: Dashboard, Tanques, Control Lechero, Balance.
 * Copia espejo de www/js/views/produccion-view.js
 */

const ProduccionView = {
  _currentTab: 'carne',
  _currentLecheSubTab: 'dashboard',
  _cachedData: null,

  async render() {
    const main = document.getElementById("app-content");
    // Cabecera compacta + tabs
    main.innerHTML = `
      <div class="mb-14">
        <div class="tabs-scroll prod-tabs scroll-shadow-container">
          <button class="prod-tab active" data-tab="carne" onclick="ProduccionView._cambiarTab('carne')">${Icons.carne()} Cárnica</button>
          <button class="prod-tab" data-tab="leche" onclick="ProduccionView._cambiarTab('leche')">${Icons.leche()} Láctea</button>
        </div>
      </div>
      <div id="prod-content"><div class="loader">Cargando registros...</div></div>`;

    // Cargar datos
    const fincaId = await Fincas.getActiveId();
    const [eventos, gastosRecords, lecheEntregas, tanques, balanceMovs, analiticas, controlLechero] = await Promise.all([
      window.db.getAllFromIndex('registro_eventos', 'fincaId', fincaId).catch(() => []),
      window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []),
      window.db.getAllFromIndex('comercializacion_leche', 'fincaId', fincaId).catch(() => []),
      window.TanquesLeche ? window.TanquesLeche.getAll(fincaId).catch(() => []) : [],
      window.BalanceLacteo ? window.db.getAllFromIndex('balance_lacteo', 'fincaId', fincaId).catch(() => []) : [],
      window.AnaliticasLeche ? window.AnaliticasLeche.getAll(fincaId).catch(() => []) : [],
      window.db.getAllFromIndex('control_lechero', 'fincaId', fincaId).catch(() => [])
    ]);

    eventos.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    gastosRecords.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    const carneEvents = eventos.filter(e =>
      (e.unidad === 'kg' && e.motivo_tarea !== 'control_lechero' && e.motivo_tarea !== 'control_peso') ||
      (e.motivo_tarea === 'expedicion' && e.unidad !== 'L' && e.unidad !== 'Litros')
    );
    const lecheEvents = eventos.filter(e =>
      (e.unidad === 'L' || e.unidad === 'Litros') &&
      (e.motivo_tarea === 'produccion_leche' || e.motivo_tarea === 'control_lechero' || e.motivo_tarea === 'expedicion')
    );
    const ventaEvents = eventos.filter(e => e.motivo_tarea === 'expedicion' || e.rol_contable === 'VENTA');

    // Extracto seco medio desde comercializacion_leche
    const conLab = lecheEntregas.filter(e => e.laboratorio?.grasa != null);
    const esTotal = conLab.reduce((s, e) => {
      const es = e.laboratorio.extracto_seco || (e.laboratorio.grasa || 0) + (e.laboratorio.proteina || 0);
      return s + es;
    }, 0);
    const esMedia = conLab.length > 0 ? esTotal / conLab.length : 0;

    // Calcular stock de tanques
    const tanquesConStock = [];
    if (window.BalanceLacteo && tanques.length > 0) {
      for (const t of tanques) {
        const stock = await window.BalanceLacteo.getStockTanque(t.id);
        tanquesConStock.push({
          ...t,
          stock_actual: stock,
          porcentaje_llenado: t.capacidad_litros > 0 ? Math.round((stock / t.capacidad_litros) * 100) : 0
        });
      }
    }

    // Producción del día
    const hoy = new Date().toISOString().split('T')[0];
    const produccionHoy = lecheEvents.filter(e => e.fecha === hoy).reduce((s, e) => s + (e.valor_neto || 0), 0);

    this._cachedData = {
      carneEvents, lecheEvents, ventaEvents, gastosRecords, lecheEntregas,
      tanques: tanquesConStock, balanceMovs, analiticas, controlLechero,
      kgTotal: carneEvents.reduce((s, e) => s + (e.valor_neto || 0), 0),
      kgCount: carneEvents.length,
      litrosTotal: lecheEvents.reduce((s, e) => s + (e.valor_neto || 0), 0),
      litrosCount: lecheEvents.length,
      ventasTotal: ventaEvents.reduce((s, e) => s + (e.importe_total || e.valor_neto || 0), 0),
      gastosTotal: gastosRecords.reduce((s, g) => s + (g.monto || 0), 0),
      extractoSecoMedio: esMedia,
      numAnaliticas: conLab.length,
      produccionHoy: produccionHoy
    };

    this._renderTabActual();
  },

  _cambiarTab(tab) {
    this._currentTab = tab;
    if (tab === 'leche') {
      this._currentLecheSubTab = 'dashboard';
    }
    document.querySelectorAll('.prod-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    this._renderTabActual();
    window.scrollTo(0, 0);
  },

  _cambiarLecheSubTab(subTab) {
    this._currentLecheSubTab = subTab;
    document.querySelectorAll('.leche-sub-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.subtab === subTab);
    });
    this._renderLecheSubTab();
    window.scrollTo(0, 0);
  },

  _renderTabActual() {
    const d = this._cachedData;
    if (!d) return;
    const content = document.getElementById('prod-content');
    if (!content) return;

    switch (this._currentTab) {
      case 'carne': this._renderCarne(content, d); break;
      case 'leche': this._renderLeche(content, d); break;
      default: this._renderCarne(content, d);
    }
  },

  // ===================== SECCIONES POR TAB =====================

  _renderSeccion(content, opts) {
    const { icon, title, subtitle, color, colorDark, kpis, registrarLabel, listName, records, emptyMsg, registrarHandler } = opts;
    const recordsHtml = records.length > 0
      ? records.map(r => {
        const borderCls = r.typeColor || color;
        return App._cardRegistro({
          color: borderCls,
          onClick: r.onclick,
          icon: icon,
          title: r.title,
          metadata: `
            <span class="flex items-center gap-4">${Icons.calendar()} ${r.date}</span>
            ${r.zone ? `<span class="flex items-center gap-4">${Icons.zonas()} ${r.zone}</span>` : ''}
            ${r.meta ? `<span class="flex items-center gap-4">${Icons.documento()} ${r.meta}</span>` : ''}
          `,
          badge: r.value,
          footerRight: `
            <span style="color:var(--c-warning); font-weight:800; font-size:0.7rem; text-transform:uppercase; white-space:nowrap;">
              FICHA ${Icons.flechaDerecha()}
            </span>
          `
        });
      }).join('')
      : `<div class="p-14 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-xs uppercase font-900 tracking-widest">${Icons.buscar()} ${emptyMsg}</span></div>`;

    content.innerHTML = `
      <!-- Cabecera de Sección Estandarizada -->
      <div class="flex items-center gap-12 mb-14">
        <span class="text-2xl" style="color:${color}; display:inline-flex; align-items:center;">${icon}</span>
        <div>
          <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin:0; line-height:1.2;">
            <span style="color:${color}; margin-right:4px;">|</span> ${title}
          </h1>
          ${subtitle ? `<div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">${subtitle}</div>` : ''}
        </div>
      </div>

      <!-- Resumen de datos registrados (colapsable/estático) -->
      <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(255,255,255,0.015);">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center justify-between gap-6">
          <span class="flex items-center gap-6">${icon} Resumen de Métricas</span>
        </div>
        <div class="resumen-body flex flex-wrap gap-4 mt-6">
          ${kpis ? kpis.map((k, idx) => {
            const badgesCls = ['badge-gold', 'badge-blue', 'badge-green', 'badge-purple', 'badge-red'];
            const cls = badgesCls[idx % badgesCls.length];
            return `<span class="badge badge-sm ${cls}" style="font-size:0.7rem; padding:4px 10px; border-radius:8px; font-weight:900;">${k.label}: ${k.value}</span>`;
          }).join('') : ''}
        </div>
      </div>

      <!-- Listado de registros -->
      <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-5" style="display: flex; align-items: center; gap: 4px; margin-top: 15px;">
        ${Icons.documento()} ${listName}
      </div>
      <div class="grid gap-10 mb-20">
        ${recordsHtml}
      </div>

      <!-- Botón Flotante de Acción con viñeta -->
      <div class="fab-container" onclick="${registrarHandler}">
        <span class="fab-label">Nuevo Registro ${registrarLabel}</span>
        <button class="fab-btn" style="--fab-color: ${color};">${Icons.fabPlus()}</button>
      </div>`;
  },

  _renderCarne(content, d) {
    this._renderSeccion(content, {
      icon: Icons.carne(), title: 'Producción Cárnica (kg)', subtitle: 'Pesajes individuales y por lote',
      color: 'var(--c-danger)', colorDark: '#b91c1c',
      kpis: [
        { label: 'Total kg', value: this._fmt(d.kgTotal) + ' kg' },
        { label: 'Pesadas', value: d.kgCount }
      ],
      registrarLabel: 'Cárnica', listName: 'Lista PRO Cárnica',
      registrarHandler: "App._abrirAsistenteProduccion('carne')",
      records: d.carneEvents.slice(0, 30).map(e => {
        const isInd = e.tipo_entidad === 'animal';
        const label = isInd ? 'INDIVIDUAL' : 'LOTE';
        const idDisplay = e.snap_identificacion || (e.lote_crotales ? `LOTE ${e.lote_animales_count || '?'} ${e.lote_animales_count === 1 ? 'animal' : 'animales'}` : (e.snap_tipo || 'S/N'));
        return {
          title: `${label}: ${idDisplay}`,
          date: e.fecha ? UI.formatDate(e.fecha) : '-',
          zone: e.snap_zona || '',
          value: UI.formatNumber(e.valor_neto || 0) + ' kg',
          typeColor: isInd ? 'var(--c-danger)' : 'var(--c-warning)',
          onclick: "ProduccionView._abrirOpcionesRegistro(" + e.id + ")"
        };
      }),
      emptyMsg: 'Sin registros cárnicos. Usa el botón "Nuevo" para añadir.'
    });
  },

  _renderLeche(content, d) {
    // Renderizar sub-pestañas de Láctea
    content.innerHTML = `
      <div class="mb-10">
        <div class="tabs-scroll leche-sub-tabs scroll-shadow-container" style="padding-left: 8px;">
          <button class="prod-tab leche-sub-tab active" data-subtab="dashboard" onclick="ProduccionView._cambiarLecheSubTab('dashboard')">${Icons.grafico()} Dashboard</button>
          <button class="prod-tab leche-sub-tab" data-subtab="tanques" onclick="ProduccionView._cambiarLecheSubTab('tanques')">${Icons.silos()} Tanques</button>
          <button class="prod-tab leche-sub-tab" data-subtab="control" onclick="ProduccionView._cambiarLecheSubTab('control')">${Icons.analitica()} Control</button>
          <button class="prod-tab leche-sub-tab" data-subtab="balance" onclick="ProduccionView._cambiarLecheSubTab('balance')">${Icons.documento()} Balance</button>
        </div>
      </div>
      <div id="leche-sub-content"></div>
    `;
    this._renderLecheSubTab();
  },

  _renderLecheSubTab() {
    const d = this._cachedData;
    if (!d) return;
    const subContent = document.getElementById('leche-sub-content');
    if (!subContent) return;

    switch (this._currentLecheSubTab) {
      case 'dashboard': this._renderLecheDashboard(subContent, d); break;
      case 'tanques': this._renderLecheTanques(subContent, d); break;
      case 'control': this._renderLecheControl(subContent, d); break;
      case 'balance': this._renderLecheBalance(subContent, d); break;
      default: this._renderLecheDashboard(subContent, d);
    }
  },

  _renderLecheDashboard(content, d) {
    // Dashboard Lácteo con KPIs y botones de acción
    const fincaId = window.Fincas.getActiveId();
    const tanquesHtml = d.tanques.slice(0, 3).map(t => {
      const tempColor = t.temperatura_actual <= 4 ? 'var(--c-success)' : (t.temperatura_actual <= 6 ? 'var(--c-warning)' : 'var(--c-danger)');
      const stockColor = t.porcentaje_llenado > 90 ? 'var(--c-danger)' : (t.porcentaje_llenado > 70 ? 'var(--c-warning)' : 'var(--c-success)');
      return `
        <div class="card p-12 mb-10" style="border-left: 3px solid var(--c-info);">
          <div class="flex items-center justify-between mb-6">
            <div class="text-sm font-900 uppercase">${t.nombre}</div>
            <div class="text-xs font-800" style="color: var(--c-info);">Letra Q: ${t.codigo_letra_q}</div>
          </div>
          <div class="mb-6">
            <div class="flex justify-between text-xs font-800 mb-2">
              <span>${t.stock_actual.toLocaleString('es-ES')}L / ${t.capacidad_litros.toLocaleString('es-ES')}L</span>
              <span style="color: ${stockColor};">${t.porcentaje_llenado}%</span>
            </div>
            <div style="background: var(--c-222); border-radius: 4px; height: 10px; overflow: hidden;">
              <div style="width: ${Math.min(t.porcentaje_llenado, 100)}%; height: 100%; background: ${stockColor}; transition: width 0.3s;"></div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-6 text-center">
            <div>
              <div class="text-xs text-aaa uppercase">Temp</div>
              <div class="text-sm font-900" style="color: ${tempColor};">${t.temperatura_actual != null ? t.temperatura_actual + '°C' : '—'}</div>
            </div>
            <div>
              <div class="text-xs text-aaa uppercase">Próx. Limpieza</div>
              <div class="text-xs font-800">${t.proxima_limpieza || '—'}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const ultimaAnalitica = d.analiticas.length > 0 ? d.analiticas.sort((a, b) => new Date(b.fecha_muestreo) - new Date(a.fecha_muestreo))[0] : null;
    const analiticaHtml = ultimaAnalitica ? `
      <div class="card p-12 mb-10" style="border-left: 3px solid var(--c-accent);">
        <div class="text-xs text-aaa uppercase font-800 mb-6">Última Analítica — ${UI.formatDate(ultimaAnalitica.fecha_muestreo)}</div>
        <div class="grid grid-cols-3 gap-6 text-center">
          <div>
            <div class="text-xs text-aaa uppercase">Grasa</div>
            <div class="text-sm font-900 text-green">${ultimaAnalitica.grasa || '—'}%</div>
          </div>
          <div>
            <div class="text-xs text-aaa uppercase">Proteína</div>
            <div class="text-sm font-900 text-green">${ultimaAnalitica.proteina || '—'}%</div>
          </div>
          <div>
            <div class="text-xs text-aaa uppercase">E. Seco</div>
            <div class="text-sm font-900 text-green">${((ultimaAnalitica.grasa || 0) + (ultimaAnalitica.proteina || 0)).toFixed(2)}%</div>
          </div>
          <div>
            <div class="text-xs text-aaa uppercase">Gérmenes</div>
            <div class="text-sm font-900">${ultimaAnalitica.germenes_30C ? (ultimaAnalitica.germenes_30C / 1000).toFixed(0) + 'k' : '—'}</div>
          </div>
          <div>
            <div class="text-xs text-aaa uppercase">Somáticas</div>
            <div class="text-sm font-900">${ultimaAnalitica.celulas_somaticas ? (ultimaAnalitica.celulas_somaticas / 1000).toFixed(0) + 'k' : '—'}</div>
          </div>
          <div>
            <div class="text-xs text-aaa uppercase">Inhibidores</div>
            <div class="text-sm font-900 ${ultimaAnalitica.inhibidores ? 'text-red' : 'text-green'};">${ultimaAnalitica.inhibidores ? '✗' : '✓'}</div>
          </div>
        </div>
      </div>
    ` : '<div class="card p-12 text-center text-aaa text-xs">Sin analíticas registradas</div>';

    content.innerHTML = `
      <!-- Cabecera -->
      <div class="flex items-center gap-12 mb-14">
        <span class="text-2xl" style="color: var(--c-info); display: inline-flex; align-items: center;">${Icons.leche()}</span>
        <div>
          <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin: 0; line-height: 1.2;">
            <span style="color: var(--c-info); margin-right: 4px;">|</span> Producción Láctea
          </h1>
          <div class="text-gray" style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Dashboard de explotación lechera</div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(255,255,255,0.015);">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center justify-between gap-6">
          <span class="flex items-center gap-6">${Icons.grafico()} Resumen de Métricas</span>
        </div>
        <div class="resumen-body flex flex-wrap gap-4 mt-6">
          <span class="badge badge-sm badge-blue" style="font-size: 0.7rem; padding: 4px 10px; border-radius: 8px; font-weight: 900;">Producción Hoy: ${d.produccionHoy.toLocaleString('es-ES')} L</span>
          <span class="badge badge-sm badge-green" style="font-size: 0.7rem; padding: 4px 10px; border-radius: 8px; font-weight: 900;">Total Litros: ${d.litrosTotal.toLocaleString('es-ES')} L</span>
          <span class="badge badge-sm badge-gold" style="font-size: 0.7rem; padding: 4px 10px; border-radius: 8px; font-weight: 900;">Extracto Seco Medio: ${d.extractoSecoMedio > 0 ? d.extractoSecoMedio.toFixed(2) + '%' : 'N/D'}</span>
          <span class="badge badge-sm badge-purple" style="font-size: 0.7rem; padding: 4px 10px; border-radius: 8px; font-weight: 900;">Analíticas: ${d.numAnaliticas}</span>
        </div>
      </div>

      <!-- Botones de Acción Hub -->
      <div class="grid grid-cols-2 gap-10 mb-14">
        <div class="widget-link-btn--neon neon-info" onclick="window.OrdeñoWizard.open()">
          ${Icons.leche()}
          <span class="widget-label">Registrar Ordeño</span>
        </div>
        <div class="widget-link-btn--neon neon-success" onclick="window.TanqueWizard.open()">
          ${Icons.silos()}
          <span class="widget-label">Nuevo Tanque</span>
        </div>
      </div>

      <!-- Tanques -->
      <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-5" style="display: flex; align-items: center; gap: 4px; margin-top: 15px;">
        ${Icons.silos()} Tanques de Leche
      </div>
      ${tanquesHtml || '<div class="p-14 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-xs uppercase font-900 tracking-widest">Sin tanques registrados</span></div>'}

      <!-- Última Analítica -->
      <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-5" style="display: flex; align-items: center; gap: 4px; margin-top: 15px;">
        ${Icons.analitica()} Última Analítica
      </div>
      ${analiticaHtml}
    `;
  },

  _renderLecheTanques(content, d) {
    const tanquesHtml = d.tanques.map(t => {
      const tempColor = t.temperatura_actual != null ? (t.temperatura_actual <= 4 ? 'var(--c-success)' : (t.temperatura_actual <= 6 ? 'var(--c-warning)' : 'var(--c-danger)')) : 'var(--c-aaa)';
      const estadoColor = t.estado === 'activo' ? 'var(--c-success)' : (t.estado === 'mantenimiento' ? 'var(--c-warning)' : 'var(--c-danger)');
      const stockColor = t.porcentaje_llenado > 90 ? 'var(--c-danger)' : (t.porcentaje_llenado > 70 ? 'var(--c-warning)' : 'var(--c-success)');

      return `
        <div class="card p-14 mb-12" style="border-left: 3px solid var(--c-info);">
          <div class="flex items-center justify-between mb-10">
            <div>
              <div class="text-sm font-900 uppercase">${t.nombre}</div>
              <div class="text-xs font-700" style="color: var(--c-info);">Letra Q: ${t.codigo_letra_q}</div>
            </div>
            <div class="flex items-center gap-6">
              <span class="badge badge-sm" style="background: ${estadoColor}15; color: ${estadoColor}; border: 1px solid ${estadoColor}40; font-size: 0.6rem; font-weight: 900; text-transform: uppercase; padding: 2px 8px; border-radius: 6px;">${t.estado}</span>
              <span class="badge badge-sm" style="background: var(--c-222); color: var(--c-aaa); font-size: 0.6rem; font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 6px;">${t.tipo === 'tanque_frio' ? 'Tanque' : (t.tipo === 'cantara' ? 'Cántara' : 'Cisterna')}</span>
            </div>
          </div>

          <div class="mb-10">
            <div class="flex justify-between text-xs font-800 mb-4">
              <span>Stock: ${t.stock_actual.toLocaleString('es-ES')}L / ${t.capacidad_litros.toLocaleString('es-ES')}L</span>
              <span style="color: ${stockColor};">${t.porcentaje_llenado}%</span>
            </div>
            <div style="background: var(--c-222); border-radius: 4px; height: 12px; overflow: hidden;">
              <div style="width: ${Math.min(t.porcentaje_llenado, 100)}%; height: 100%; background: ${stockColor}; transition: width 0.3s;"></div>
            </div>
          </div>

          <div class="grid grid-cols-4 gap-8 text-center">
            <div>
              <div class="text-xs text-aaa uppercase">Temp. Actual</div>
              <div class="text-sm font-900" style="color: ${tempColor};">${t.temperatura_actual != null ? t.temperatura_actual + '°C' : '—'}</div>
            </div>
            <div>
              <div class="text-xs text-aaa uppercase">Temp. Objetivo</div>
              <div class="text-sm font-900">${t.temperatura_objetivo}°C</div>
            </div>
            <div>
              <div class="text-xs text-aaa uppercase">Últ. Limpieza</div>
              <div class="text-xs font-800">${t.ultima_limpieza || '—'}</div>
            </div>
            <div>
              <div class="text-xs text-aaa uppercase">Próx. Limpieza</div>
              <div class="text-xs font-800">${t.proxima_limpieza || '—'}</div>
            </div>
          </div>

          <div class="flex gap-6 mt-10">
            <button onclick='window.TanqueWizard.open(${JSON.stringify(t).replace(/"/g, '&quot;')})' class="text-xs font-800 px-8 py-4 rounded-sm" style="background: var(--c-222); color: var(--c-aaa);">Editar</button>
            ${t.estado === 'activo' ? `<button onclick="window.TanquesLeche.registrarLimpieza(${t.id})" class="text-xs font-800 px-8 py-4 rounded-sm" style="background: var(--c-success)20; color: var(--c-success);">Registrar Limpieza</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    content.innerHTML = `
      <!-- Cabecera -->
      <div class="flex items-center gap-12 mb-14">
        <span class="text-2xl" style="color: var(--c-info); display: inline-flex; align-items: center;">${Icons.silos()}</span>
        <div>
          <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin: 0; line-height: 1.2;">
            <span style="color: var(--c-info); margin-right: 4px;">|</span> Tanques de Leche
          </h1>
          <div class="text-gray" style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Gestión de tanques de frío</div>
        </div>
      </div>

      <!-- Botón FAB -->
      <div class="fab-container" onclick="window.TanqueWizard.open()">
        <span class="fab-label">Nuevo Tanque</span>
        <button class="fab-btn" style="--fab-color: var(--c-info);">${Icons.fabPlus()}</button>
      </div>

      <!-- Listado -->
      ${tanquesHtml || '<div class="p-20 text-center"><div class="text-aaa text-sm mb-12">No hay tanques registrados</div><button onclick="window.TanqueWizard.open()" class="px-20 py-10 font-900" style="background: var(--c-info); color:#000; border:none; border-radius:6px;">Registrar primer tanque</button></div>'}
    `;
  },

  _renderLecheControl(content, d) {
    const analiticasHtml = d.analiticas.slice(0, 20).map(a => {
      const estadoColor = a.estado === 'validado' ? 'var(--c-success)' : (a.estado === 'alerta' ? 'var(--c-warning)' : 'var(--c-danger)');
      return `
        <div class="card p-12 mb-10" style="border-left: 3px solid var(--c-accent);">
          <div class="flex items-center justify-between mb-6">
            <div class="text-sm font-900 uppercase">${a.tipo_muestreo || 'Autocontrol'} — ${UI.formatDate(a.fecha_muestreo)}</div>
            <span class="badge badge-sm" style="background: ${estadoColor}15; color: ${estadoColor}; border: 1px solid ${estadoColor}40; font-size: 0.6rem; font-weight: 900; text-transform: uppercase; padding: 2px 8px; border-radius: 6px;">${a.estado}</span>
          </div>
          <div class="grid grid-cols-3 gap-6 text-center">
            <div>
              <div class="text-xs text-aaa uppercase">Grasa</div>
              <div class="text-sm font-900">${a.grasa || '—'}%</div>
            </div>
            <div>
              <div class="text-xs text-aaa uppercase">Proteína</div>
              <div class="text-sm font-900">${a.proteina || '—'}%</div>
            </div>
            <div>
              <div class="text-xs text-aaa uppercase">E. Seco</div>
              <div class="text-sm font-900">${a.extracto_seco ? a.extracto_seco.toFixed(2) + '%' : '—'}</div>
            </div>
            <div>
              <div class="text-xs text-aaa uppercase">Gérmenes</div>
              <div class="text-sm font-900">${a.germenes_30C ? (a.germenes_30C / 1000).toFixed(0) + 'k' : '—'}</div>
            </div>
            <div>
              <div class="text-xs text-aaa uppercase">Somáticas</div>
              <div class="text-sm font-900">${a.celulas_somaticas ? (a.celulas_somaticas / 1000).toFixed(0) + 'k' : '—'}</div>
            </div>
            <div>
              <div class="text-xs text-aaa uppercase">Lab</div>
              <div class="text-xs font-800">${a.laboratorio_nombre || '—'}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const controlLecheroHtml = d.controlLechero.slice(0, 10).map(c => `
      <div class="card p-12 mb-10" style="border-left: 3px solid var(--c-purple);">
        <div class="flex items-center justify-between mb-6">
          <div class="text-sm font-900 uppercase">Control Lechero — ${UI.formatDate(c.fecha_control)}</div>
          <span class="badge badge-sm badge-purple" style="font-size: 0.6rem; font-weight: 900; text-transform: uppercase; padding: 2px 8px; border-radius: 6px;">${c.organismo_control || 'DHI'}</span>
        </div>
        <div class="grid grid-cols-3 gap-6 text-center">
          <div>
            <div class="text-xs text-aaa uppercase">Media Litros</div>
            <div class="text-sm font-900">${c.media_rebano_litros || '—'} L</div>
          </div>
          <div>
            <div class="text-xs text-aaa uppercase">Media Grasa</div>
            <div class="text-sm font-900">${c.media_rebano_grasa || '—'}%</div>
          </div>
          <div>
            <div class="text-xs text-aaa uppercase">Media Proteína</div>
            <div class="text-sm font-900">${c.media_rebano_proteina || '—'}%</div>
          </div>
        </div>
      </div>
    `).join('');

    content.innerHTML = `
      <!-- Cabecera -->
      <div class="flex items-center gap-12 mb-14">
        <span class="text-2xl" style="color: var(--c-accent); display: inline-flex; align-items: center;">${Icons.analitica()}</span>
        <div>
          <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin: 0; line-height: 1.2;">
            <span style="color: var(--c-accent); margin-right: 4px;">|</span> Control Lechero
          </h1>
          <div class="text-gray" style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Analíticas y controles oficiales</div>
        </div>
      </div>

      <!-- Analíticas -->
      <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-5" style="display: flex; align-items: center; gap: 4px; margin-top: 15px;">
        ${Icons.analitica()} Analíticas de Leche
      </div>
      ${analiticasHtml || '<div class="p-14 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-xs uppercase font-900 tracking-widest">Sin analíticas registradas</span></div>'}

      <!-- Control Lechero Oficial -->
      <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-5" style="display: flex; align-items: center; gap: 4px; margin-top: 15px;">
        ${Icons.documento()} Controles Oficiales (DHI)
      </div>
      ${controlLecheroHtml || '<div class="p-14 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-xs uppercase font-900 tracking-widest">Sin controles lecheros registrados</span></div>'}
    `;
  },

  _renderLecheBalance(content, d) {
    const movimientosHtml = d.balanceMovs.slice(0, 30).map(m => {
      const icon = m.tipo_movimiento === 'entrada' ? '↓' : (m.tipo_movimiento === 'salida' ? '↑' : '•');
      const color = m.tipo_movimiento === 'entrada' ? 'var(--c-success)' : 'var(--c-danger)';
      return `
        <div class="card p-10 mb-8" style="border-left: 3px solid ${color};">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-900" style="color: ${color};">${icon} ${m.tipo_movimiento.toUpperCase()}</div>
              <div class="text-xs text-aaa">${m.referencia_tipo || 'Manual'} ${m.referencia_id ? '#' + m.referencia_id : ''}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-900">${m.cantidad_litros.toLocaleString('es-ES')} L</div>
              <div class="text-xs text-aaa">${UI.formatDate(m.fecha)} ${m.turno ? '(' + m.turno + ')' : ''}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    content.innerHTML = `
      <!-- Cabecera -->
      <div class="flex items-center gap-12 mb-14">
        <span class="text-2xl" style="color: var(--c-info); display: inline-flex; align-items: center;">${Icons.documento()}</span>
        <div>
          <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin: 0; line-height: 1.2;">
            <span style="color: var(--c-info); margin-right: 4px;">|</span> Balance Lácteo
          </h1>
          <div class="text-gray" style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Movimientos de tanque</div>
        </div>
      </div>

      <!-- Listado -->
      ${movimientosHtml || '<div class="p-14 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-xs uppercase font-900 tracking-widest">Sin movimientos registrados</span></div>'}
    `;
  },

  _renderVentas(content, d) {
    this._renderSeccion(content, {
      icon: Icons.comercial(), title: 'Venta Masiva / Matadero', subtitle: 'Expediciones y ventas de ganado',
      color: 'var(--c-warning)', colorDark: 'var(--c-warning)',
      kpis: [
        { label: 'Total ventas', value: this._fmt(d.ventasTotal) + ' €' },
        { label: 'Expediciones', value: d.ventaEvents.length }
      ],
      registrarLabel: 'Venta', listName: 'Lista Ventas',
      registrarHandler: "App._abrirAsistenteProduccion('venta_masiva')",
      records: d.ventaEvents.slice(0, 20).map(e => ({
        title: 'Expedición: ' + (e.snap_especie || 'Ganado'),
        date: e.fecha ? UI.formatDate(e.fecha) : '-',
        zone: e.snap_zona || '',
        value: UI.formatCurrency(e.importe_total || e.valor_neto || 0),
        onclick: "ProduccionView._abrirOpcionesRegistro(" + e.id + ")"
      })),
      emptyMsg: 'Sin ventas registradas. Usa "Registrar Venta" para añadir.'
    });
  },

  _renderGastos(content, d) {
    this._renderSeccion(content, {
      icon: Icons.gastos(), title: 'Gastos Analíticos', subtitle: 'Costes operativos y de explotación',
      color: 'var(--c-purple)', colorDark: '#6d28d9',
      kpis: [
        { label: 'Total gastos', value: this._fmt(d.gastosTotal) + ' €' },
        { label: 'Registros', value: d.gastosRecords.length }
      ],
      registrarLabel: 'Gasto', listName: 'Lista Gastos',
      registrarHandler: "App._abrirAsistenteProduccion('gasto')",
      records: d.gastosRecords.slice(0, 20).map(g => ({
        title: (g.concepto || g.categoria || 'Gasto'),
        date: g.fecha ? UI.formatDate(g.fecha) : '-',
        zone: g.snap_zona || '',
        value: UI.formatCurrency(g.monto || 0),
        onclick: "ProduccionView._abrirOpcionesGasto(" + g.id + ")"
      })),
      emptyMsg: 'Sin gastos registrados. Usa "Registrar Gasto" para añadir.'
    });
  },

  async _abrirOpcionesRegistro(id) {
    try {
      const evento = await window.db.get('registro_eventos', id);
      if (!evento) return;

      const [rebanos, finca] = await Promise.all([
        window.db.getAll('rebanos'),
        Fincas.getActive()
      ]);
      const zonas = finca?.zonas || [];

      const overlay = document.createElement("div");
      overlay.className = "wizard-full-screen";
      overlay.style.justifyContent = "center";
      overlay.style.alignItems = "center";
      overlay.style.backgroundColor = "rgba(0,0,0,0.8)";
      overlay.innerHTML = `
          <div class="card p-25" style="max-width:420px; overflow-y:auto; max-height:90vh; border: 1px solid var(--c-orange);">
              <h3 class="mt-0 uppercase font-900 text-white"><span style="color: var(--c-orange);">|</span> EDITAR REGISTRO</h3>
              <p class="text-xs text-gray mb-15">ID Interno: ${evento.id}</p>

              <div class="grid grid-cols-2 gap-10">
                <div class="wizard-input-group">
                    <label class="wizard-label">Valor (${evento.unidad})</label>
                    <input type="number" id="edit-reg-valor" value="${evento.valor_neto}" step="0.1" class="wizard-input">
                </div>
                <div class="wizard-input-group">
                    <label class="wizard-label">Fecha</label>
                    <input type="date" id="edit-reg-fecha" value="${evento.fecha}" class="wizard-input">
                </div>
              </div>

              <div class="wizard-input-group">
                  <label class="wizard-label">Identificación (Crotal/Lote)</label>
                  <input type="text" id="edit-reg-ident" value="${evento.snap_identificacion || ''}" class="wizard-input">
              </div>

              <div class="grid grid-cols-2 gap-10">
                <div class="wizard-input-group">
                    <label class="wizard-label">Zona</label>
                    <select id="edit-reg-zona" class="wizard-input wizard-select">
                      <option value="">Sin zona</option>
                      ${zonas.map(z => `<option value="${z.nombre}" ${evento.snap_zona === z.nombre ? 'selected' : ''}>${z.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="wizard-input-group">
                    <label class="wizard-label">Tipo Animal</label>
                    <input type="text" id="edit-reg-tipo" value="${evento.snap_tipo || ''}" class="wizard-input">
                </div>
              </div>

              <div class="wizard-input-group">
                  <label class="wizard-label">Especie</label>
                  <select id="edit-reg-especie" class="wizard-input wizard-select">
                    <option value="Vacas" ${evento.snap_especie === 'Vacas' ? 'selected' : ''}>Vacas</option>
                    <option value="Ovejas" ${evento.snap_especie === 'Ovejas' ? 'selected' : ''}>Ovejas</option>
                    <option value="Cabras" ${evento.snap_especie === 'Cabras' ? 'selected' : ''}>Cabras</option>
                  </select>
              </div>

              <div class="flex gap-10 mt-20">
                  <button class="wizard-btn-action wizard-btn-primary flex-2" id="btn-save-reg">${Icons.guardar()} Guardar</button>
                  <button class="wizard-btn-action wizard-btn-danger flex-1" id="btn-del-reg">${Icons.eliminar()} Borrar</button>
              </div>
              <button class="wizard-btn-action wizard-btn-secondary mt-10 w-full" onclick="ProduccionView._cerrarOverlayRegistro(this)">${Icons.cerrar()} Cancelar</button>
          </div>`;
      document.body.appendChild(overlay);

      ProduccionView._registroGuardado = false;
      App.setExitGuard(() => ProduccionView._confirmSalirOverlayRegistro());

      overlay.querySelector('#btn-save-reg').onclick = async () => {
        const val = parseFloat(overlay.querySelector('#edit-reg-valor').value);
        const fecha = overlay.querySelector('#edit-reg-fecha').value;
        const ident = overlay.querySelector('#edit-reg-ident').value.trim();
        const zona = overlay.querySelector('#edit-reg-zona').value;
        const tipo = overlay.querySelector('#edit-reg-tipo').value.trim();
        const especie = overlay.querySelector('#edit-reg-especie').value;

        if (isNaN(val) || val <= 0) return App.toastError("Valor inválido");

        evento.valor_neto = val;
        evento.fecha = fecha;
        evento.snap_identificacion = ident;
        evento.snap_zona = zona;
        evento.snap_tipo = tipo;
        evento.snap_especie = especie;
        evento.actualizadoEn = new Date().toISOString();

        await window.db.put('registro_eventos', evento);
        ProduccionView._registroGuardado = true;
        App.clearExitGuard();
        App.toast("Registro actualizado correctamente");
        overlay.remove();
        ProduccionView.render();
      };

      overlay.querySelector('#btn-del-reg').onclick = async () => {
        if (!await Confirm.confirm("Eliminar Registro", "¿Eliminar este registro de forma permanente?", true)) return;
        await window.db.delete('registro_eventos', id);
        ProduccionView._registroGuardado = true;
        App.clearExitGuard();
        App.toast("Registro eliminado");
        overlay.remove();
        ProduccionView.render();
      };
    } catch (e) {
      App.toastError(e.message);
    }
  },

  /** Guarda de salida compartida con el botón físico Android (ver App.setExitGuard). */
  async _confirmSalirOverlayRegistro() {
    if (this._registroGuardado) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _cerrarOverlayRegistro(btn) {
    if (!(await this._confirmSalirOverlayRegistro())) return;
    App.clearExitGuard();
    const overlay = btn.closest('.wizard-full-screen');
    if (overlay) overlay.remove();
  },

  async _abrirOpcionesGasto(id) {
    try {
      const numId = Number(id);
      const gasto = await window.db.get('gastos_ganaderia', numId);
      if (!gasto) return;

      const [rebanos, proveedores] = await Promise.all([
        window.db.getAll('rebanos'),
        window.db.getAll('proveedores')
      ]);

      const overlay = document.createElement("div");
      overlay.className = "wizard-full-screen";
      overlay.style.justifyContent = "center";
      overlay.style.alignItems = "center";
      overlay.style.backgroundColor = "rgba(0,0,0,0.8)";
      overlay.innerHTML = `
        <div class="card p-25" style="max-width:400px; border: 1px solid var(--c-orange);">
          <h3 class="mt-0 uppercase font-900 text-white text-md"><span style="color: var(--c-orange);">|</span> EDITAR GASTO</h3>

          <div class="wizard-input-group mt-15">
            <label class="wizard-label">Concepto</label>
            <input type="text" id="edit-gasto-concepto" value="${gasto.concepto || ''}" class="wizard-input">
          </div>

          <div class="grid grid-cols-2 gap-10">
            <div class="wizard-input-group">
              <label class="wizard-label">Monto (€)</label>
              <input type="number" id="edit-gasto-monto" value="${gasto.monto}" step="0.01" class="wizard-input">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label">Fecha</label>
              <input type="date" id="edit-gasto-fecha" value="${gasto.fecha}" class="wizard-input">
            </div>
          </div>

          <div class="wizard-input-group">
            <label class="wizard-label">Proveedor</label>
            <select id="edit-gasto-prov" class="wizard-input wizard-select">
              <option value="">Sin proveedor</option>
              ${proveedores.map(p => `<option value="${p.id}" ${gasto.proveedorId === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('')}
            </select>
          </div>

          <div class="wizard-input-group">
            <label class="wizard-label">Rebaño / Lote</label>
            <select id="edit-gasto-reb" class="wizard-input wizard-select">
              <option value="">Sin rebaño</option>
              ${rebanos.map(r => `<option value="${r.id}" ${gasto.rebanoId === r.id ? 'selected' : ''}>${r.nombre}</option>`).join('')}
            </select>
          </div>

          <div class="flex gap-10 mt-20">
            <button class="wizard-btn-action wizard-btn-primary flex-1" id="btn-save-gasto">${Icons.guardar()} Guardar</button>
            <button class="wizard-btn-action wizard-btn-danger flex-1" id="btn-del-gasto">${Icons.eliminar()} Borrar</button>
          </div>
          <button class="wizard-btn-action wizard-btn-secondary mt-10 w-full" onclick="ProduccionView._cerrarOverlayRegistro(this)">${Icons.cerrar()} Cancelar</button>
        </div>`;
      document.body.appendChild(overlay);

      ProduccionView._registroGuardado = false;
      App.setExitGuard(() => ProduccionView._confirmSalirOverlayRegistro());

      overlay.querySelector('#btn-save-gasto').onclick = async () => {
        const concepto = document.getElementById('edit-gasto-concepto').value.trim();
        const monto = parseFloat(document.getElementById('edit-gasto-monto').value);
        const fecha = document.getElementById('edit-gasto-fecha').value;
        const proveedorId = document.getElementById('edit-gasto-prov').value;
        const rebanoId = document.getElementById('edit-gasto-reb').value;

        if (!concepto || isNaN(monto)) return App.toastError("Concepto y monto obligatorios");

        gasto.concepto = concepto;
        gasto.monto = monto;
        gasto.fecha = fecha;
        gasto.proveedorId = proveedorId ? Number(proveedorId) : null;
        gasto.rebanoId = rebanoId ? Number(rebanoId) : null;
        gasto.actualizadoEn = new Date().toISOString();

        await window.db.put('gastos_ganaderia', gasto);
        ProduccionView._registroGuardado = true;
        App.clearExitGuard();
        App.toast("Gasto actualizado");
        overlay.remove();
        if (window.GastosView && GastosView._cachedData) GastosView.render();
        else ProduccionView.render();
      };

      overlay.querySelector('#btn-del-gasto').onclick = async () => {
        if (!await Confirm.confirm("Eliminar Gasto", "¿Eliminar este gasto de forma permanente?", true)) return;
        await window.db.delete('gastos_ganaderia', numId);
        ProduccionView._registroGuardado = true;
        App.clearExitGuard();
        App.toast("Gasto eliminado");
        overlay.remove();
        if (window.GastosView && GastosView._cachedData) GastosView.render();
        else ProduccionView.render();
      };

    } catch (e) { App.toastError(e.message); }
  },

  _fmt(n) {
    return UI.formatNumber(n);
  }
};

window.ProduccionView = ProduccionView;
