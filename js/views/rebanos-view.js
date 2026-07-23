/**
 * Livestock Manager - RebanosView v1.0.0
 * Vista de Rebaños extraída de App.js para modularización.
 * Copia espejo de js/views/rebanos-view.js
 */

const RebanosView = {
  _filtroActivo: {
    texto: ''
  },
  async render() {
    // Color de pantalla: lo fija GanaderiaView (color fijo de GeGan), esta vista siempre va embebida en su carrusel.
    const main = document.getElementById("ganaderia-tab-content") || document.getElementById("app-content");
    const rebanos = await Rebanos.list();
    const eventos = await window.db.getAll('registro_eventos').catch(() => []);
    const totalRebanos = rebanos.length;
    const rebanosActivos = rebanos.filter(r => r.estado !== 'inactivo').length;

    // Guardar datos brutos para filtrado posterior
    this._cachedDataRaw = { rebanos, eventos };

    // Aplicar filtros iniciales
    const filteredRebanos = this._filtrar(rebanos);
    const flagsModo = window.ModoContextoHelper.getFlags() || { leche: true, carne: false };
    const ocultosPorModo = rebanos.length - rebanos.filter(r => window.ModoContextoHelper._matchTipoByMode(r.tipo, flagsModo)).length;

    // Resumen mensual (últimos 6 meses)
    const hoy = new Date();
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const porMes = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      porMes[key] = { label: meses[d.getMonth()] + ' ' + d.getFullYear(), total: 0 };
    }
    // Contar rebaños por mes de creación
    const rawData = this._cachedDataRaw ? this._cachedDataRaw.rebanos : [];
    rawData.forEach(r => {
      if (r.fecha_constitucion) {
        const key = r.fecha_constitucion.substring(0, 7); // YYYY-MM
        if (porMes[key]) porMes[key].total++;
      }
    });
    const mesesHtml = Object.values(porMes).reverse().map(m => {
      const max = Math.max(1, ...Object.values(porMes).map(m => m.total));
      const pct = Math.max(0, Math.min(100, (m.total / max) * 100));
      const color = pct > 70 ? 'var(--c-danger)' : pct > 40 ? 'var(--c-warning)' : 'var(--c-success)';
      return `<div class="flex-1 text-center min-w-0">
        <div class="text-xs text-gray mb-2" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.label}</div>
        <div class="rebaño-bar-wrap">
          <div style="position:absolute;bottom:0;width:100%;height:${pct}%;background:${color};border-radius:6px;opacity:0.8;transition:height 0.3s;"></div>
        </div>
        <div class="text-xs font-bold mt-2" style="color:${color};">${m.total}</div>
      </div>`;
    }).join('');

    const modoMetaReb = window.ModoContextoHelper.getModeMetaEffective(flagsModo);
    main.innerHTML = `
      <!-- Cabecera de Módulo: chip de modo + KPI + acción principal -->
      <div class="module-header">
        <div class="module-header-kpis">
          <span class="module-mode-chip" style="--mode-color: ${modoMetaReb.color};">${modoMetaReb.icon} ${modoMetaReb.label}</span>
          <div class="module-header-kpi">
            <span class="module-header-kpi-label">Rebaños</span>
            <span class="module-header-kpi-value">${rebanos.length}</span>
          </div>
          <div class="module-header-kpi">
            <span class="module-header-kpi-label">Activos</span>
            <span class="module-header-kpi-value" style="color: var(--c-success);">${rebanosActivos}</span>
          </div>
        </div>
        <div class="module-header-primary-action">
          <button class="btn btn-create btn-lg" onclick="RebanosView._crearRebano()">${Icons.agregar()} Nuevo Rebaño</button>
        </div>
      </div>

      ${window.ModoContextoHelper.bannerOcultosPorModo(ocultosPorModo, 'rebaño', 'rebaños')}

      <div class="card mb-14 p-12" style="background:rgba(59,130,246,0.015); border:1px solid rgba(255,255,255,0.03);">
        <div class="flex justify-between items-center mb-6">
          <span class="text-xs text-gray font-bold uppercase">EVOLUCIÓN MENSUAL (últimos 6 meses)</span>
          <span class="text-xs text-gray">${totalRebanos} total</span>
        </div>
        <div class="flex gap-6">${mesesHtml}</div>
      </div>

      <!-- Balance Consolidado de Rebanos (colapsable) -->
      <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(59,130,246, 0.01);">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center justify-between gap-6">
          <span class="flex items-center gap-6">${Icons.rebanos()} BALANCE DE REBAÑOS</span>
          <button class="resumen-toggle" onclick="App.toggleResumen(this)" aria-label="Ocultar resumen">${Icons.chevronAbajo()}</button>
        </div>
        <div class="resumen-body flex flex-col">
          ${this._CATEGORIAS.filter(c => c.key !== 'todos' && (c.key !== 'carne' || flagsModo.carne) && (c.key !== 'leche' || flagsModo.leche)).map(c => {
            const count = filteredRebanos.filter(r =>
              c.key === 'todos' ||
              (c.key === 'carne' && ((r.tipo || '').toLowerCase().includes('carne') || (r.tipo || '').toLowerCase().includes('cárn'))) ||
              (c.key === 'leche' && ((r.tipo || '').toLowerCase().includes('leche') || (r.tipo || '').toLowerCase().includes('láct'))) ||
              (c.key === 'activo' && r.estado !== 'inactivo')
            ).length;
            return `
              <div class="py-10 flex justify-between items-center border-bottom-222">
                <span class="text-xs text-gray uppercase font-800 flex items-center gap-6">${c.icon} ${c.label}</span>
                <strong class="text-base font-900" style="color:${c.color};">${count}</strong>
              </div>
            `;
          }).join('')}
          <div class="py-12 mt-4 flex justify-between items-center text-white">
            <span class="text-xs uppercase font-950 tracking-wider">TOTAL DE REBAÑOS</span>
            <strong class="text-2xl text-blue font-950">${filteredRebanos.length}</strong>
          </div>
        </div>
      </div>

      <div class="mb-14">
        <!-- Filtro de búsqueda integrado (controla el listado) -->
        <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-5" style="display: flex; align-items: center; gap: 4px;">
          ${Icons.rebanos()} LISTA DE REBAÑOS
        </div>
        <div class="flex gap-8 items-center mb-12">
          <div class="relative flex-1 min-w-0">
            <input type="search" id="search-rebanos" placeholder="Buscar por nombre, raza o código de lote..."
                   oninput="RebanosView._setFiltro('texto', this.value)"
                   class="form-input search-input w-full" style="margin-top:0;">
          </div>
        </div>
      </div>
      <div id="rebanos-content"><div class="loader">Cargando rebaños...</div></div>`;

    // Actualizar datos filtrados para la lista
    this._cachedData = { rebanos: filteredRebanos, eventos };
    this._renderLista();
  },

  _CATEGORIAS: [
    { key: 'todos',        icon: Icons.rebanos(), label: 'Todos',          color: 'var(--c-purple)', colorDark: '#6d28d9' },
    { key: 'carne',        icon: Icons.carne(),   label: 'Carne',          color: 'var(--c-success)', colorDark: '#059669' },
    { key: 'leche',        icon: Icons.leche(),   label: 'Leche',          color: 'var(--c-info)', colorDark: '#0284c7' },
    { key: 'activo',       icon: Icons.check(),   label: 'Activos',        color: 'var(--c-success)', colorDark: '#059669' }
  ],

  _renderLista() {
    const d = this._cachedData;
    if (!d) return;
    const content = document.getElementById('rebanos-content');
    if (!content) return;

    const data = d.rebanos;
    if (!data) { content.innerHTML = '<div class="loader">Sin datos</div>'; return; }

    const rawData = this._cachedDataRaw ? this._cachedDataRaw.rebanos : [];
    const tieneFiltro = this._filtroActivo.texto !== '';

    this._renderSeccion(content, {
      icon: Icons.rebanos(),
      title: 'Rebaños',
      subtitle: data.length > 0 ? `${data.length} ${data.length === 1 ? "rebaño" : "rebaños"} total` : 'Sin registros',
      color: 'var(--c-purple)',
      colorDark: '#6d28d9',
      kpis: [
        { label: 'Total', value: this._fmt(data.length) },
        { label: 'Filtrados', value: this._fmt(tieneFiltro ? data.length : 0) }
      ],
      registrarLabel: 'Rebaño',
      listName: 'Lista de Rebaños',
      registrarHandler: "RebanosView._crearRebano()",
      records: data.slice(0, 50).map(r => ({
        title: r.nombre || 'Rebaño sin nombre',
        date: r.fecha_constitucion ? UI.formatDate(r.fecha_constitucion) : '-',
        zona: r.zonaActual || '',
        tipo: r.tipo || '',
        value: `${r.estado === 'activo' ? 'Activo' : r.estado === 'inactivo' ? 'Inactivo' : 'Vendido'}`,
        onclick: "location.hash='/rebano?id=" + r.id + "'"
      })),
      emptyMsg: `No hay rebaños registrados. Usa "Nuevo Rebaño" para añadir.`
    });
  },

  _renderSeccion(content, opts) {
    const { icon, title, subtitle, color, colorDark, kpis, registrarLabel, listName, records, emptyMsg, registrarHandler } = opts;

    const recordsHtml = records.length > 0
      ? records.map(r => App._cardRegistro({
          title: `${Icons.rebanos()} ${r.title}`,
          subtitle: `<span class="flex items-center gap-4">${Icons.calendar()} ${r.date} ${r.zona ? ' | ' + Icons.zonas() + ' ' + r.zona : ''} ${r.tipo ? ' | ' + Icons.paquete() + ' ' + r.tipo.toUpperCase() : ''}</span>`,
          rightSide: `<div class="font-950" style="font-size:1.1rem; color:${color};">${r.value}</div>`,
          footerRight: `<span style="display:block; font-size:0.7rem; font-weight:700; color:var(--c-warning); margin-top:4px; white-space:nowrap;">Ficha -></span>`,
          color: color,
          onClick: r.onclick
        })).join('')
      : `<div class="p-14 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-xs uppercase font-900 tracking-widest">${Icons.buscar()} ${emptyMsg}</span></div>`;

    content.innerHTML = `
      <div class="card" style="border: 1px solid #27272a; background: #1E1E1E;">
        <div class="flex items-center gap-12 mb-12">
          <span class="text-3xl" style="color: ${color};">${icon}</span>
          <div>
            <div class="text-white font-900 text-lg uppercase tracking-wider"><span style="color: ${color};">|</span> ${title}</div>
            ${subtitle ? `<div class="text-gray mt-2" style="font-size:0.68rem;">${subtitle}</div>` : ''}
          </div>
        </div>
        ${kpis ? `
        <!-- KPIs Rebaños Unificados en Filas (colapsable) -->
        <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style=" background: rgba(255, 255, 255, 0.02);">
          <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center justify-between gap-6">
            <span class="flex items-center gap-6">${Icons.rebanos()} BALANCE DE REBAÑOS</span>
            <button class="resumen-toggle" onclick="App.toggleResumen(this)" aria-label="Ocultar resumen">${Icons.chevronAbajo()}</button>
          </div>
          <div class="resumen-body flex flex-col">
            ${kpis.map((k, index) => `
              <div class="py-12 flex justify-between items-center ${index < kpis.length - 1 ? 'border-bottom-222' : ''}">
                <span class="text-xs text-gray uppercase font-900">${k.label}</span>
                <strong class="text-xl font-950" style="color: ${k.label.includes('Total') ? 'var(--c-danger)' : 'var(--c-info)'};">${k.value}</strong>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-6 pb-5">
          ${Icons.documento()} ${listName}
        </div>
        <div class="grid gap-10">
          ${recordsHtml}
        </div>
      </div>`;
  },

  _fmt(n) {
    return UI.formatNumber(n);
  },

  _aplicarFiltros() {
    // Re-filtrar los datos basándose en el filtro de texto actual
    const rawData = this._cachedDataRaw ? this._cachedDataRaw.rebanos : [];
    const eventos = this._cachedDataRaw ? this._cachedDataRaw.eventos : [];
    const filteredRebanos = this._filtrar(rawData);

    // Actualizar los datos en caché con los resultados filtrados
    this._cachedData = { rebanos: filteredRebanos, eventos };

    // Volver a renderizar la lista
    this._renderLista();
  },

  _setFiltro(type, value) {
    this._filtroActivo[type] = value;
    this._aplicarFiltros();
  },

  _filtrar(rebanos) {
    if (!rebanos) return [];
    let filtrados = rebanos;

    // Filtro por tipo de explotación activo (leche/carne)
    const flags = window.ModoContextoHelper.getFlags() || { leche: true, carne: false };
    filtrados = filtrados.filter(r => {
      return window.ModoContextoHelper._matchTipoByMode(r.tipo, flags);
    });

    if (this._filtroActivo.texto.trim()) {
      const q = this._filtroActivo.texto.toLowerCase();
      filtrados = filtrados.filter(r =>
        (r.nombre || '').toLowerCase().includes(q) ||
        (r.razonSocial || '').toLowerCase().includes(q) ||
        (r.codigo_lote || '').toLowerCase().includes(q)
      );
    }

    return filtrados;
  },

  // Mantener todos los métodos existentes
  async renderDetalle(params) {
    const id = params.get("id");
    const rebano = await Rebanos.get(id);
    const animales = await Animales.list(id);
    const finca = await Fincas.getActive();
    const zonas = finca ? (finca.zonas || []).filter(z => !z?.anulada) : [];
    const especies = await window.db.getAll("config_especies");
    const tipos = await window.db.getAll("config_tipos_produccion");
    const tiposExplotacionREGA = window.ComunidadesService ? window.ComunidadesService.getTiposExplotacionREGA() : [];
    const eventos = await window.db.getAll('registro_eventos').catch(() => []);
    const eventosReb = eventos.filter(e => e.entidad_id === Number(id) || (e.tipo_entidad === 'rebano' && e.snap_identificacion === rebano.nombre));
    const totalKg = eventosReb.filter(e => e.unidad === 'kg').reduce((s, e) => s + (e.valor_neto || 0), 0);
    const totalLeche = eventosReb.filter(e => e.unidad === 'L').reduce((s, e) => s + (e.valor_neto || 0), 0);
    const activos = animales.filter(a => a.estado === 'activo').length;
    const vendidos = animales.filter(a => a.estado === 'vendido').length;
    const porCategoria = {};
    animales.forEach(a => { const c = a.categoria || 'Sin categoría'; porCategoria[c] = (porCategoria[c] || 0) + 1; });

    RebanosView._rebanoGuardado = false;
    App.setExitGuard(() => RebanosView._confirmSalirEdicion());

    document.getElementById("app-content").innerHTML = `
      <div class="wizard-full-screen">
        <div class="wizard-header-fixed border-top-5-gold">
          <h1 class="wizard-header-title uppercase font-950 tracking-widest text-lg"><span style="color: var(--p-gold); margin-right: 6px;">|</span> ${Icons.rebanos()} ${rebano.nombre}</h1>
        </div>
        <div class="wizard-content-scrollable p-20">

      <!-- KPIs -->
      <div class="grid grid-cols-3 gap-8 mb-20">
        <div class="info-box-center py-10" style="background: #1e1e1e; border: 1px solid #27272a;"><small class="s-lbl text-gray uppercase font-800" style="font-size: 0.65rem; letter-spacing: 0.5px;">TOTAL</small><div class="inf-val-lg font-950 text-xl" style="color: var(--c-warning);">${animales.length}</div></div>
        <div class="info-box-center py-10" style="background: #1e1e1e; border: 1px solid #27272a;"><small class="s-lbl text-gray uppercase font-800" style="font-size: 0.65rem; letter-spacing: 0.5px;">ACTIVOS</small><div class="inf-val-lg font-950 text-xl" style="color: var(--c-success);">${activos}</div></div>
        <div class="info-box-center py-10" style="background: #1e1e1e; border: 1px solid #27272a;"><small class="s-lbl text-gray uppercase font-800" style="font-size: 0.65rem; letter-spacing: 0.5px;">VENDIDOS</small><div class="inf-val-lg font-950 text-xl" style="color: var(--c-danger);">${vendidos}</div></div>
        <div class="info-box-center py-10" style="background: #1e1e1e; border: 1px solid #27272a;"><small class="s-lbl flex items-center gap-4 justify-center text-gray uppercase font-800" style="font-size: 0.65rem; letter-spacing: 0.5px;">${Icons.carne()} kg</small>        <div class="inf-val-lg font-950 text-xl" style="color: var(--c-info);">${UI.formatNumber(Math.round(totalKg))}</div></div>
        <div class="info-box-center py-10" style="background: #1e1e1e; border: 1px solid #27272a;"><small class="s-lbl flex items-center gap-4 justify-center text-gray uppercase font-800" style="font-size: 0.65rem; letter-spacing: 0.5px;">${Icons.leche()} LITROS</small><div class="inf-val-lg font-950 text-xl" style="color: var(--c-warning);">${UI.formatNumber(Math.round(totalLeche))}</div></div>
        <div class="info-box-center py-10" style="background: #1e1e1e; border: 1px solid #27272a;"><small class="s-lbl flex items-center gap-4 justify-center text-gray uppercase font-800" style="font-size: 0.65rem; letter-spacing: 0.5px;">${Icons.registros()} EVENTOS</small><div class="inf-val-lg font-950 text-xl" style="color: var(--c-purple);">${eventosReb.length}</div></div>
      </div>

      <!-- Categorías -->
      ${Object.keys(porCategoria).length > 0 ? `
      <div class="card mb-20 p-12" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="inf-section-title mb-6 flex items-center gap-8 font-900 uppercase tracking-wider text-[0.7rem] text-gray">
          <span style="color: var(--c-purple); margin-right: 4px;">|</span> ${Icons.documento()} POR CATEGORÍA
        </div>
        <div class="flex flex-wrap gap-4">${Object.entries(porCategoria).map(([c, n]) => `<span class="badge badge-sm badge-purple font-900">${c.toUpperCase()}: ${n}</span>`).join('')}</div>
      </div>` : ''}

      <!-- Edición -->
      <div class="card mb-25 p-16" style="background: rgba(255,255,255,0.02); border: 1px solid #27272a;">
        <div class="inf-card-title flex items-center gap-8 mb-16 font-900 uppercase tracking-wider text-[0.7rem] text-gray">
          <span style="color: var(--c-warning); margin-right: 4px;">|</span> ${Icons.editar()} DATOS DEL REBAÑO</div>
        <div class="flex flex-col gap-15">
          <div><label class="form-label uppercase font-900 text-[0.65rem] text-gray">Nombre</label>
          <input type="text" id="r-edit-nombre" value="${rebano.nombre}" class="premium-input font-800"></div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label uppercase font-900 text-[0.65rem] text-gray">Especie</label>
            <select id="r-edit-especie" class="premium-input font-800">
              ${especies.map((e) => `<option value="${e.nombre}" ${rebano.especie === e.nombre ? "selected" : ""}>${e.nombre.toUpperCase()}</option>`).join("")}
            </select></div>
            <div><label class="form-label uppercase font-900 text-[0.65rem] text-gray">Tipo</label>
            <select id="r-edit-tipo" class="premium-input font-800">
              ${tipos.map((t) => `<option value="${t.nombre}" ${rebano.tipo === t.nombre ? "selected" : ""}>${t.nombre.toUpperCase()}</option>`).join("")}
            </select></div>
          </div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label uppercase font-900 text-[0.65rem] text-gray">Capacidad Máxima</label>
            <input type="number" id="r-edit-capacidad" value="${rebano.capacidad_total || ''}" class="premium-input font-800"></div>
            <div><label class="form-label uppercase font-900 text-[0.65rem] text-gray">Código de Lote</label>
            <input type="text" id="r-edit-lote" value="${rebano.codigo_lote || ''}" class="premium-input font-800"></div>
          </div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label uppercase font-900 text-[0.65rem] text-gray">Fecha Constitución</label>
            <input type="date" id="r-edit-fecha" value="${rebano.fecha_constitucion || ''}" class="premium-input font-800"></div>
            <div><label class="form-label uppercase font-900 text-[0.65rem] text-gray">Ubicación (Zona)</label>
            <select id="r-edit-zona" class="premium-input border-gold font-800">
              <option value="">SIN ASIGNAR</option>
              ${zonas.map((z) => `<option value="${z.nombre}" ${rebano.zonaActual === z.nombre ? "selected" : ""}>${z.nombre.toUpperCase()}</option>`).join("")}
            </select></div>
          </div>
          <div><label class="form-label uppercase font-900 text-[0.65rem] text-gray">TIPO DE EXPLOTACIÓN REGA (RD 787/2023)</label>
          <select id="r-edit-tipo-explotacion-rega" class="premium-input border-green font-800">
            <option value="">— SELECCIONAR —</option>
            ${tiposExplotacionREGA.map((t) => `<option value="${t}" ${rebano.tipo_explotacion_rega === t ? "selected" : ""}>${t.toUpperCase()}</option>`).join("")}
          </select></div>
          <div><label class="form-label uppercase font-900 text-[0.65rem] text-gray">Notas / Observaciones</label>
          <textarea id="r-edit-notas" class="premium-input font-700 uppercase" style="height:80px; resize:none;">${rebano.notas || ''}</textarea></div>
        </div>
      </div>

      <!-- Sanidad -->
      <div class="card mb-20 card-dark-gradient p-12 pb-24" style="border: 1px solid #27272a; background: #1E1E1E;">
        <div class="section-header-theme" style="--theme-color: var(--c-success); font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;"><span style="color: var(--c-success); margin-right: 4px;">|</span> SANIDAD</div>
        <div class="grid grid-cols-1 gap-10 max-w-220 mx-auto mt-12 mb-16">
          <button class="widget-link-btn widget-link-btn--neon neon-success" onclick="App._registrarTratamiento(${id})">
            ${Icons.agregar()}
            <span class="widget-link-label">Añadir Trat.</span>
          </button>
        </div>
        <div id="lista-sanitarios-rebano" class="mt-10"></div>
      </div>

      <!-- Gastos y consumos -->
      <div class="card mb-20 card-dark-gradient p-12 pb-24" style="border: 1px solid #27272a; background: #1E1E1E;">
        <div class="section-header-theme" style="--theme-color: var(--p-gold); font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;"><span style="color: var(--p-gold); margin-right: 4px;">|</span> GASTOS Y CONSUMOS</div>
        <div id="total-gastos-rebano" class="text-center mt-10 mb-4">
          <span class="text-[0.6rem] text-gray uppercase font-800">Total imputado</span>
          <div class="text-xl font-950" style="color: var(--p-gold);">—</div>
        </div>
        <div class="grid grid-cols-2 gap-10 max-w-320 mx-auto mt-8 mb-16">
          <button class="widget-link-btn widget-link-btn--neon neon-info" onclick="RebanosView._abrirConsumoPienso(${id})">
            ${Icons.paquete()}
            <span class="widget-link-label">Consumo Pienso</span>
          </button>
          <button class="widget-link-btn widget-link-btn--neon neon-warning" onclick="App._abrirFormularioGasto({ rebanoId: ${id}, categoria: 'Alimentacion', origenModulo: 'rebano', onComplete: () => RebanosView._cargarGastosRebano(${id}) })">
            ${Icons.agregar()}
            <span class="widget-link-label">Otro Gasto</span>
          </button>
        </div>
        <div id="lista-gastos-rebano" class="mt-10"></div>
      </div>

      <!-- Animales -->
      <div class="card p-12 mb-16 card-dark-gradient pb-24" style="border: 1px solid #27272a; background: #1E1E1E;">
        <div class="section-header-theme" style="--theme-color: var(--c-info); font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;"><span style="color: var(--c-info); margin-right: 4px;">|</span> ANIMALES (${animales.length})</div>
        <div class="grid grid-cols-1 gap-10 max-w-220 mx-auto mt-12">
          <button class="widget-link-btn widget-link-btn--neon neon-info" onclick="App._abrirSelectorAnimales(${id})">
            ${Icons.rotacion()}
            <span class="widget-link-label">Mover Lote</span>
          </button>
        </div>
        <div class="gap-10">
          ${animales.map((a) => {
            const colorEsp = window.ModoContextoHelper ? window.ModoContextoHelper.getEspecieColor(a.especie) : '#888';
            const colorEst = a.estado === 'activo' ? 'var(--c-success)' : a.estado === 'vendido' ? 'var(--c-warning)' : 'var(--c-danger)';
            return `<div class="card-registro" style="--registro-color: ${colorEsp}; display:flex; gap:10px; align-items:stretch;" onclick="location.hash='/animal?id=${a.id}'">
              <div class="flex-1 min-w-0 flex items-center gap-10">
                <span style="color:${colorEsp}">${Icons.animales()}</span>
                <div class="text-xs min-w-0">
                  <div class="text-gold font-900 uppercase" style="color:var(--p-gold) !important;">${a.numero_identificacion || a.nombre || '#' + a.id}</div>
                  <div class="text-gray-500 font-800 text-[0.6rem] uppercase mt-2">${a.raza || 'S/R'} · <span style="color:${colorEsp}; opacity:0.7;">${a.categoria || ''}</span></div>
                </div>
              </div>
              <div class="flex flex-col items-end justify-between flex-shrink-0" style="gap:8px;">
                <span class="badge badge-sm uppercase" style="background:${colorEst}15; color:${colorEst}; border:1px solid ${colorEst}35; font-size:0.55rem;">${a.estado}</span>
                <span style="font-size:0.7rem; font-weight:700; color:var(--c-warning); white-space:nowrap;">Ficha -></span>
              </div>
            </div>`;
          }).join("") || '<div class="text-gray text-center p-20">Sin animales en este rebaño</div>'}
        </div>
      </div>

        </div>
        <div class="wizard-footer-fixed border-top-222">
          <button type="button" onclick="RebanosView._eliminarRebano(${id})" class="wizard-btn-action wizard-btn-danger">${Icons.eliminar()} Eliminar</button>
          <div class="wizard-footer-buttons">
            <button type="button" onclick="RebanosView._salirDetalle()" class="wizard-btn-action wizard-btn-secondary">${Icons.cerrar()} Cancelar</button>
            <button type="button" onclick="RebanosView._guardarRebano(${id})" class="wizard-btn-action wizard-btn-success">${Icons.guardar()} Guardar</button>
          </div>
        </div>
      </div>`;
    this._cargarHistorialSanitario(id);
    this._cargarGastosRebano(Number(id));
  },

  /**
   * Abre el registro de consumo de pienso (Silos) con este rebaño preseleccionado.
   * Descuenta stock del silo elegido, imputa kilos al rebaño y genera el gasto
   * analítico correspondiente (ver SilosView._guardarConsumoSilo).
   */
  async _abrirConsumoPienso(rebanoId) {
    if (window.App && App._ensureViewGroup) {
      await App._ensureViewGroup('expro');
    }
    if (!window.SilosView) {
      App.toastError('Módulo de Silos no disponible');
      return;
    }
    const silos = await window.db.getAll('config_silos').catch(() => []);
    if (silos.length === 0) {
      App.toastError('No hay silos configurados. Crea uno primero en Explotación → Silos.');
      return;
    }
    SilosView._cachedSilos = silos;
    const onSaved = () => RebanosView._cargarGastosRebano(rebanoId);
    if (silos.length === 1) {
      await SilosView._abrirConsumirSilo(silos[0].id, rebanoId, onSaved);
      return;
    }

    const modalId = 'modal-consumo-pienso';
    const html = `
      <div class="card p-25" style="max-width:380px; width: 100%; border: 1px solid var(--c-gray); background: #1e1e1e;">
        <h3 class="mt-0 text-white font-900 flex items-center gap-8"><span style="color: var(--c-gray); margin-right: 4px;">|</span> ${Icons.paquete()} CONSUMO DE PIENSO</h3>
        <label class="wizard-label mb-10">Selecciona el silo de origen:</label>
        <select id="w-consumo-silo" class="wizard-input wizard-select mb-15">
          ${silos.map(s => `<option value="${s.id}">${s.nombre.toUpperCase()} (${UI.formatNumber(s.cantidadActual || 0)} kg)</option>`).join('')}
        </select>
        <div class="flex gap-10">
          <button class="wizard-btn-action wizard-btn-primary flex-1" id="btn-consumo-next">Proceder ${Icons.siguiente()}</button>
          <button class="wizard-btn-action wizard-btn-secondary" id="${modalId}-cancel">Cancelar</button>
        </div>
      </div>
    `;
    const overlay = ModalManager.show(modalId, html, { closeOnOverlayClick: false });

    overlay.querySelector('#' + modalId + '-cancel').onclick = () => ModalManager.close(modalId);

    overlay.querySelector('#btn-consumo-next').onclick = async () => {
      const siloId = parseInt(overlay.querySelector('#w-consumo-silo').value);
      ModalManager.close(modalId);
      await SilosView._abrirConsumirSilo(siloId, rebanoId, onSaved);
    };
  },

  /**
   * Carga los gastos imputados manualmente (gastos_ganaderia) más el consumo de
   * pienso registrado desde Silos (registro_eventos tipo silo_consumo) para este
   * rebaño, como listado combinado de "control de consumos" ordenado por fecha.
   */
  async _cargarGastosRebano(rebanoId) {
    const container = document.getElementById("lista-gastos-rebano");
    const totalEl = document.querySelector("#total-gastos-rebano > div");
    if (!container) return;
    try {
      const fincaId = await Fincas.getActiveId();
      const [gastos, eventos] = await Promise.all([
        window.Gastos ? Gastos.list(fincaId, rebanoId) : window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []),
        window.db.getAll('registro_eventos').catch(() => [])
      ]);
      const gastosReb = (gastos || []).filter(g => g.rebanoId == rebanoId);
      // Los consumos de silo ya imputados como gasto (gastoId presente) se excluyen aquí para no
      // contar el mismo importe dos veces: aparecen representados por su gasto correspondiente.
      const consumosSilo = (eventos || []).filter(e => e.tipo === 'silo_consumo' && e.rebanoId == rebanoId && !e.gastoId);

      const combinado = [
        ...gastosReb.map(g => ({ tipo: 'gasto', fecha: g.fecha, concepto: g.concepto || g.categoria, categoria: g.categoria, monto: g.monto || 0, kg: g.kilos_totales || null })),
        ...consumosSilo.map(e => ({ tipo: 'consumo', fecha: e.fecha, concepto: `Consumo de pienso (${UI.formatNumber(e.valor_neto || 0)} kg)`, categoria: 'Alimentación', monto: e.costeConsumo || 0, kg: e.valor_neto || null }))
      ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      const total = combinado.reduce((s, x) => s + (x.monto || 0), 0);
      if (totalEl) totalEl.textContent = UI.formatCurrency(total);

      if (combinado.length === 0) {
        container.innerHTML = `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.buscar()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin gastos ni consumos registrados</p></div>`;
        return;
      }
      container.innerHTML = combinado.map(x => `
        <div class="info-box-sm ${x.tipo === 'consumo' ? 'border-left-gold' : 'border-left-green'} mt-8 bg-black">
          <div class="flex justify-between items-center"><span class="text-white font-black uppercase text-sm">${x.tipo === 'consumo' ? Icons.paquete() : Icons.dinero()} ${x.concepto}</span><span class="text-gray-500 font-900 text-[0.6rem]">${UI.formatDate(x.fecha)}</span></div>
          <div class="text-gray text-[0.65rem] mt-6 uppercase font-800 tracking-wider">Categoría: <strong class="text-white">${x.categoria || 'N/D'}</strong> · Importe: <strong class="text-gold">${UI.formatCurrency(x.monto || 0)}</strong>${x.kg ? ` · Kilos: <strong class="text-white">${UI.formatNumber(x.kg)} kg</strong>` : ''}</div>
        </div>`).join('');
    } catch (e) {
      container.innerHTML = '<p class="text-red text-sm font-900 uppercase">Error cargando gastos</p>';
    }
  },

  async _cargarHistorialSanitario(rebanoId) {
    const container = document.getElementById("lista-sanitarios-rebano");
    if (!container) return;
    try {
      const tratamientos = await window.db.getAll("sanitarios_ganado") || [];
      const filtrados = tratamientos.filter(t => t.rebanoId == rebanoId);
      if (filtrados.length === 0) {
        container.innerHTML = `<div class="empty-state border border-222"><div class="empty-state-icon" style="color:#555;">${Icons.buscar()}</div><p class="empty-state-text uppercase font-900 text-xs">Sin tratamientos registrados</p></div>`;
        return;
      }
      let html = '';
      filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      filtrados.forEach(t => {
        const dosisStr = t.dosis ? ` · Dosis: <strong class="text-white">${t.dosis}</strong>` : '';
        const duracionStr = t.duracion_dias ? ` · Duración: <strong class="text-white">${t.duracion_dias} D</strong>` : '';
        const aplicadorStr = t.aplicadoPor ? ` · Aplicado por: <strong class="text-white">${t.aplicadoPor.toUpperCase()}</strong>` : '';
        const vetStr = t.veterinario_prescriptor ? ` · Vet: <strong class="text-gold">${t.veterinario_prescriptor}</strong>` : '';
        html += `<div class="info-box-sm border-left-green mt-8 bg-black">
          <div class="flex justify-between items-center"><span class="text-white font-black uppercase text-sm">${Icons.sanidad()} ${t.medicamento}</span><span class="text-gray-500 font-900 text-[0.6rem]">${UI.formatDate(t.fecha)}</span></div>
          <div class="text-gray text-[0.65rem] mt-6 uppercase font-800 tracking-wider">Retiro carne: <strong class="text-red">${t.tiempo_espera_carne_dias || 0} D</strong> ${t.prohibidoLeche ? ' | <strong class="text-red">PROHIBIDO LECHE</strong>' : ''}${dosisStr}${duracionStr}${aplicadorStr}${vetStr}</div>
        </div>`;
      });
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<p class="text-red text-sm font-900 uppercase">Error cargando historial</p>';
    }
  },

  async _guardarRebano(id) {
    try {
      const r = await Rebanos.get(id);
      r.nombre = document.getElementById("r-edit-nombre").value.trim();
      r.especie = document.getElementById("r-edit-especie").value;
      r.tipo = document.getElementById("r-edit-tipo").value;
      r.zonaId = document.getElementById("r-edit-zona").value;
      r.capacidad_total = Number(document.getElementById("r-edit-capacidad").value) || 0;
      r.codigo_lote = document.getElementById("r-edit-lote").value.trim();
      r.fecha_constitucion = document.getElementById("r-edit-fecha").value;
      r.tipo_explotacion_rega = document.getElementById("r-edit-tipo-explotacion-rega").value;
      r.notas = document.getElementById("r-edit-notas").value.trim();
      if (!r.nombre) return App.toastError("Nombre requerido");
      await Rebanos.save(r);
      RebanosView._rebanoGuardado = true;
      App.clearExitGuard();
      App.toast("Rebaño actualizado", "success");
      App.renderRebanos();
    } catch (e) {
      App.toastError(e.message);
    }
  },

  /** Guarda de salida compartida con el header-back y el botón físico Android (ver App.setExitGuard). */
  async _confirmSalirEdicion() {
    if (this._rebanoGuardado) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _salirDetalle() {
    if (!(await this._confirmSalirEdicion())) return;
    App.clearExitGuard();
    location.hash = "#/rebanos";
  },

  async _crearRebano() {
    const especies = await window.db.getAll("config_especies");
    const tiposAll = await window.db.getAll("config_tipos_produccion");
    // Restringir el catálogo a los tipos compatibles con los flags de explotación activos,
    // para no crear rebaños que luego queden ocultos por el filtro de modo.
    const flagsModo = window.ModoContextoHelper.getFlags() || { leche: true, carne: false };
    const tiposFiltrados = tiposAll.filter(t => window.ModoContextoHelper._matchTipoByMode(t.nombre, flagsModo));
    const tipos = tiposFiltrados.length > 0 ? tiposFiltrados : tiposAll;
    const tiposExplotacionREGA = window.ComunidadesService ? window.ComunidadesService.getTiposExplotacionREGA() : [];
    const finca = await Fincas.getActive();
    const zonas = finca ? finca.zonas || [] : [];

    if (especies.length === 0 || tipos.length === 0) {
      App.toastError("Configura Especies/Tipos en Ajustes");
      return;
    }

    const wizardSteps = [
      {
        content: (data) => `
          <div class="card card-accent card-accent-amber p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-info)">IDENTIFICACIÓN</div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">NOMBRE DEL REBAÑO / LOTE</label>
              <input type="text" id="w-reb-nombre" value="${data.nombre}" placeholder="EJ: LOTE ENGORDE A..." class="wizard-input uppercase font-800">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label">ESPECIE PRINCIPAL</label>
              <select id="w-reb-especie" class="wizard-input font-800">
                ${especies.map((e) => `<option value="${e.nombre}" ${data.especie === e.nombre ? "selected" : ""}>${e.nombre.toUpperCase()}</option>`).join("")}
              </select>
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.nombre = document.getElementById('w-reb-nombre')?.value.trim() || data.nombre;
          data.especie = document.getElementById('w-reb-especie')?.value || data.especie;
        },
        validate: async (data) => {
          if (!data.nombre) {
            App.toastError("El nombre del rebaño es obligatorio");
            return false;
          }
          return true;
        }
      },
      {
        content: (data) => `
          <div class="card card-accent card-accent-green p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-success)">UBICACIÓN Y TIPO</div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">TIPO DE PRODUCCIÓN</label>
              <select id="w-reb-tipo" class="wizard-input font-800">
                ${tipos.map((t) => `<option value="${t.nombre}" ${data.tipo === t.nombre ? "selected" : ""}>${t.nombre.toUpperCase()}</option>`).join("")}
              </select>
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label">ZONA / PARCELA INICIAL</label>
              <select id="w-reb-zona" class="wizard-input font-800" style="border-color: var(--c-warning);">
                <option value="">SIN ASIGNAR (FINCA GENERAL)</option>
                ${zonas.map((z) => `<option value="${z.id}" ${data.zonaId == z.id ? "selected" : ""}>${z.nombre.toUpperCase()}</option>`).join("")}
              </select>
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.tipo = document.getElementById('w-reb-tipo')?.value || data.tipo;
          data.zonaId = document.getElementById('w-reb-zona')?.value || data.zonaId;
        }
      },
      {
        content: (data) => `
          <div class="card card-accent card-accent-blue p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-info)">REQUISITOS REGA</div>
            <div class="wizard-input-group">
              <label class="wizard-label">TIPO DE EXPLOTACIÓN REGA (RD 787/2023)</label>
              <select id="w-reb-tipo-explotacion" class="wizard-input font-800" style="border-color: var(--c-success);">
                <option value="">— SELECCIONAR —</option>
                ${tiposExplotacionREGA.map((t) => `<option value="${t}" ${data.tipo_explotacion_rega === t ? "selected" : ""}\>${t.toUpperCase()}</option>`).join("")}
              </select>
              <small class="text-aaa uppercase font-700 text-[0.55rem] mt-4 block">Dato normativo obligatorio para SIGGAN/BADIGEX</small>
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.tipo_explotacion_rega = document.getElementById('w-reb-tipo-explotacion')?.value || data.tipo_explotacion_rega;
        }
      },
      {
        content: (data) => `
          <div class="card card-accent card-accent-gold p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-info)">CAPACIDAD Y TRAZABILIDAD</div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">CAPACIDAD / AFORO MÁXIMO</label>
              <input type="number" id="w-reb-capacidad" value="${data.capacidad_total || ''}" placeholder="EJ: 100" class="wizard-input font-800">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label">CÓDIGO DE LOTE / LOTE IDENT.</label>
              <input type="text" id="w-reb-lote" value="${data.codigo_lote || ''}" placeholder="EJ: LOTE-2026-A" class="wizard-input uppercase font-800">
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.capacidad_total = Number(document.getElementById('w-reb-capacidad')?.value) || 0;
          data.codigo_lote = document.getElementById('w-reb-lote')?.value.trim() || '';
        }
      },
      {
        content: (data) => `
          <div class="card card-accent card-accent-amber p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-info)">FECHA Y NOTAS</div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">FECHA DE CONSTITUCIÓN</label>
              <input type="date" id="w-reb-fecha" value="${data.fecha_constitucion}" class="wizard-input font-800">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label">OBSERVACIONES</label>
              <textarea id="w-reb-notas" placeholder="DETALLES ADICIONALES..." class="wizard-input font-700 uppercase" style="height:80px; resize:none; font-size:0.8rem;">${data.notas || ''}</textarea>
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.fecha_constitucion = document.getElementById('w-reb-fecha')?.value || data.fecha_constitucion;
          data.notas = document.getElementById('w-reb-notas')?.value.trim() || '';
        }
      }
    ];
 
    window.WizardManager.create({
      id: 'wizard-nuevo-rebano',
      title: 'NUEVO REBAÑO',
      initialData: {
        nombre: "",
        especie: especies[0].nombre,
        tipo: tipos[0].nombre,
        zonaId: "",
        tipo_explotacion_rega: "",
        capacidad_total: "",
        codigo_lote: "",
        fecha_constitucion: new Date().toISOString().split("T")[0],
        notas: ""
      },
      steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          await Rebanos.save({
            nombre: finalData.nombre,
            especie: finalData.especie,
            tipo: finalData.tipo,
            zonaId: finalData.zonaId,
            tipo_explotacion_rega: finalData.tipo_explotacion_rega,
            capacidad_total: Number(finalData.capacidad_total) || 0,
            codigo_lote: finalData.codigo_lote,
            fecha_constitucion: finalData.fecha_constitucion,
            notas: finalData.notas,
            estado: "activo",
          });
          App.toast("Rebaño creado exitosamente", "success");
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  },

  async _eliminarRebano(id) {
    const ans = await Animales.list(id);
    if (ans.filter(a => (a.estado || 'activo') === 'activo').length > 0)
      return App.toastError("No se puede eliminar un rebaño con animales.");
    if (!await Confirm.confirm("Anular Rebaño", "¿Anular este rebaño? Se conservará histórico de auditoría.", true)) return;
    try {
      await Rebanos.delete(id);
      App.toast("Rebaño anulado", "success");
      location.hash = "#/rebanos";
    } catch (e) {
      App.toastError(e.message);
    }
  }
};

window.RebanosView = RebanosView;