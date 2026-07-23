/**
 * CompradoresView - Livestock Manager Premium v4.2.0
 * Vista modular de compradores y contratos.
 * Ofrece dos gestiones unificadas en la parte superior: Compradores y Contratos, con trazabilidad completa.
 */

const CompradoresView = {
  _activeModule: 'compradores', // 'compradores' o 'contratos'
  _currentTab: 'todos',
  _filtroActivo: {
    texto: '',
    tipo: ''
  },
  async render() {
    // Color de pantalla: lo fija ComercializacionView (color fijo de CoMer), esta vista siempre va embebida en su carrusel.
    const main = document.getElementById("comercializacion-tab-content") || document.getElementById("app-content");

    // Cargar datos necesarios según el módulo activo
    await this._cargarDatos();

    // Obtener datos para el resumen según el módulo activo
    const resumenData = this._activeModule === 'compradores'
      ? this._getResumenCompradores()
      : this._getResumenContratos();

    // Resumen mensual (últimos 6 meses) - específico para cada módulo
    const hoy = new Date();
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const porMes = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      porMes[key] = { label: meses[d.getMonth()] + ' ' + d.getFullYear(), total: 0 };
    }

    // Llenar datos mensuales según el módulo
    const monthlyData = this._activeModule === 'compradores'
      ? this._getDatosMensualesCompradores(porMes, hoy)
      : this._getDatosMensualesContratos(porMes, hoy);

    const mesesHtml = Object.values(monthlyData).reverse().map(m => {
      const max = Math.max(1, ...Object.values(monthlyData).map(m => m.total));
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

    this._activeModule = 'compradores';
    const colorCompradores = window.getModuleColor ? getModuleColor('/compradores') : '#4FADF5';
    const activeColor = colorCompradores;

    main.innerHTML = `
      <!-- Cabecera de Sección Estandarizada -->
      <div class="flex items-center gap-12 mb-14">
        <span class="text-2xl" style="color:${activeColor}; display:inline-flex; align-items:center;">
          ${Icons.compradores()}
        </span>
        <div>
          <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin:0; line-height:1.2;">
            <span style="color:${activeColor}; margin-right:4px;">|</span> GESTIÓN COMERCIAL
          </h1>
          <div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
            Gestión de Clientes y Compradores
          </div>
        </div>
      </div>

      <!-- Evolución Mensual (Estandarizada como Card de Fondo OLED sin bordes de color) -->
      <div class="card mb-14 p-12 card-resumen" style="background:rgba(59,130,246,0.015); width:100%;">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex justify-between items-center" style="border-bottom:none; padding-bottom:0; margin-bottom:12px;">
          <span><span style="color: ${activeColor}; margin-right:4px;">|</span> EVOLUCIÓN MENSUAL (ÚLTIMOS 6 MESES)</span>
          <span class="text-xs text-gray font-bold lowercase" style="font-variant: normal;">(${this._activeModule === 'compradores' ? this._cachedCompradores?.length || 0 : this._cachedContratos?.length || 0} total)</span>
        </div>
        <div class="flex gap-6">${mesesHtml}</div>
      </div>

      <!-- Balance Consolidado (Estandarizado en Card de Fondo OLED sin bordes de color) -->
      <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(59,130,246,0.015); width:100%;">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center gap-6" style="border-bottom:none; padding-bottom:0; margin-bottom:12px;">
          <span style="color: ${activeColor}; margin-right:4px;">|</span> ${this._activeModule === 'compradores' ? Icons.compradores() : Icons.contratos()} RESUMEN DE ${this._activeModule === 'compradores' ? 'COMPRADORES' : 'CONTRATOS'}
        </div>
        <div class="flex flex-col">
          ${this._activeModule === 'compradores'
            ? `
              <div class="py-8 flex justify-between items-center border-bottom-222">
                <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.compradores()} Total Compradores</span>
                <strong class="text-xl font-950" style="color: ${activeColor};">${this._cachedCompradores?.length || 0} ${this._cachedCompradores?.length === 1 ? "comprador" : "compradores"}</strong>
              </div>
              <div class="py-8 flex justify-between items-center border-bottom-222">
                <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.documento()} Compradores Activos</span>
                <strong class="text-xl font-950 text-green">${this._cachedCompradores?.filter(c => c.activo !== false).length || 0} ${this._cachedCompradores?.filter(c => c.activo !== false).length === 1 ? "comprador" : "compradores"}</strong>
              </div>
              <div class="py-8 flex justify-between items-center">
                <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.dinero()} Valor Estimado</span>
                <strong class="text-xl font-950 text-blue">€${resumenData.valorEstimado?.toLocaleString() || '0'}</strong>
              </div>
            `
            : `
              <div class="py-8 flex justify-between items-center border-bottom-222">
                <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.contratos()} Total Contratos</span>
                <strong class="text-xl font-950" style="color: ${activeColor};">${this._cachedContratos?.length || 0} ${this._cachedContratos?.length === 1 ? "contrato" : "contratos"}</strong>
              </div>
              <div class="py-8 flex justify-between items-center border-bottom-222">
                <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.check()} Contratos Activos</span>
                <strong class="text-xl font-950 text-green">${this._cachedContratos?.filter(c => c.activo !== false).length || 0} ${this._cachedContratos?.filter(c => c.activo !== false).length === 1 ? "contrato" : "contratos"}</strong>
              </div>
              <div class="py-8 flex justify-between items-center">
                <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.dinero()} Valor Total</span>
                <strong class="text-xl font-950 text-blue">€${resumenData.valorTotal?.toLocaleString() || '0'}</strong>
              </div>
            `}
        </div>
      </div>

      <!-- Filtro de búsqueda integrado (controla el listado) -->
      <div class="text-xs text-white uppercase font-black tracking-wider mb-10 flex items-center gap-4">
        <span style="color: ${activeColor};">|</span> ${this._activeModule === 'compradores' ? Icons.compradores() : Icons.contratos()} LISTA DE ${this._activeModule === 'compradores' ? 'COMPRADORES' : 'CONTRATOS'}
      </div>
      <div class="flex gap-8 items-center mb-12">
        <div class="relative flex-1 min-w-0">
          <input type="search" id="search-${this._activeModule}" placeholder="Buscar por nombre, NIF o ciudad..."
                 oninput="CompradoresView._setFiltro('texto', this.value)"
                 class="form-input search-input w-full" style="margin-top:0;">
        </div>
        <select id="${this._activeModule}-filtro-tipo" class="form-select"
                onchange="CompradoresView._setFiltro('tipo', this.value)"
                style="width:110px; min-width:100px; flex-shrink:0;">
          <option value="">Todos</option>
          ${this._activeModule === 'compradores'
            ? `
              <option value="cárnico" ${this._filtroActivo.tipo === 'cárnico' ? 'selected' : ''}>Carne</option>
              <option value="láctico" ${this._filtroActivo.tipo === 'láctico' ? 'selected' : ''}>Leche</option>
              <option value="híbrido" ${this._filtroActivo.tipo === 'híbrido' ? 'selected' : ''}>Híbrido</option>
            `
            : `
              <option value="activo" ${this._filtroActivo.tipo === 'activo' ? 'selected' : ''}>Activo</option>
              <option value="inactivo" ${this._filtroActivo.tipo === 'inactivo' ? 'selected' : ''}>Inactivo</option>
            `}
        </select>
      </div>
      <div id="${this._activeModule}-content"><div class="loader">Cargando ${this._activeModule === 'compradores' ? 'compradores' : 'contratos'}...</div></div>`;

    // Actualizar datos filtrados para el módulo activo
    if (this._activeModule === 'compradores') {
      this._cachedData = { compradores: this._filtrarCompradores(this._cachedCompradores || []) };
      this._renderListaCompradores(this._cachedData.compradores);
    } else {
      this._cachedData = { contratos: this._filtrarContratos(this._cachedContratos || []) };
      this._renderListaContratos(this._cachedData.contratos);
    }
  },

  _cambiarModulo(modulo) {
    this._activeModule = modulo;
    this._filtroActivo = { texto: '', tipo: '' }; // Reset filters when switching modules
    const s1 = document.getElementById('search-compradores'); if (s1) s1.value = '';
    const s2 = document.getElementById('search-contratos'); if (s2) s2.value = '';
    const f1 = document.getElementById('compradores-filtro-tipo'); if (f1) f1.value = '';
    const f2 = document.getElementById('contratos-filtro-tipo'); if (f2) f2.value = '';
    this.render();
  },

  _setFiltro(type, value) {
    this._filtroActivo[type] = value;
    this._aplicarFiltros();
  },

  _aplicarFiltros() {
    if (this._activeModule === 'compradores') {
      const filtrados = this._filtrarCompradores(this._cachedCompradores || []);
      this._cachedData = { compradores: filtrados };
      this._renderListaCompradores(filtrados);
    } else {
      const filtrados = this._filtrarContratos(this._cachedContratos || []);
      this._cachedData = { contratos: filtrados };
      this._renderListaContratos(filtrados);
    }
  },

  _filtrarCompradores(compradores) {
    if (!compradores) return [];
    let filtrados = compradores;

    if (this._filtroActivo.tipo) {
      filtrados = filtrados.filter(c => c.tipo_comprador === this._filtroActivo.tipo);
    }

    if (this._filtroActivo.texto.trim()) {
      const q = this._filtroActivo.texto.toLowerCase();
      filtrados = filtrados.filter(c =>
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.nif_cif || '').toLowerCase().includes(q) ||
        (c.ciudad || '').toLowerCase().includes(q)
      );
    }

    return filtrados;
  },

  _filtrarContratos(contratos) {
    if (!contratos) return [];
    let filtrados = contratos;

    if (this._filtroActivo.tipo) {
      filtrados = filtrados.filter(c =>
        this._filtroActivo.tipo === 'activo' ? c.activo !== false : c.activo === false
      );
    }

    if (this._filtroActivo.texto.trim()) {
      const q = this._filtroActivo.texto.toLowerCase();
      filtrados = filtrados.filter(c =>
        (c.numero_contrato || '').toLowerCase().includes(q) ||
        (c.condiciones || '').toLowerCase().includes(q)
      );
    }

    return filtrados;
  },

  async _cargarDatos() {
    try {
      // Cargar ambos conjuntos de datos siempre (se usan en resúmenes y filtrados)
      const fincaId = await Fincas.getActiveId().catch(() => null);
      const [compradores, contratos, ventasCarne] = await Promise.all([
        Compradores.list().catch(() => []),
        Contratos.list().catch(() => []),
        window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId)).catch(() => [])
      ]);

      this._cachedCompradores = compradores;
      this._cachedContratos = contratos;
      this._cachedMetricasComprador = this._calcularMetricasComprador(ventasCarne);
    } catch (e) {
      console.error('[CompradoresView] Error:', e);
      // Los datos se manejarán como arrays vacíos en los métodos de renderizado
    }
  },

  /** Última operación y volumen del año actual por comprador, a partir de ventas de carne (las entregas de leche no llevan compradorId: van a una única industria por contrato). */
  _calcularMetricasComprador(ventasCarne) {
    const anioActual = new Date().getFullYear();
    const metricas = {};
    (ventasCarne || []).forEach(v => {
      if (!v.compradorId) return;
      if (!metricas[v.compradorId]) metricas[v.compradorId] = { ultimaOperacion: null, volumenAnual: 0 };
      const fecha = v.fechaSacrificio || v.fecha_emision;
      const f = fecha ? new Date(fecha) : null;
      if (f && (!metricas[v.compradorId].ultimaOperacion || f > metricas[v.compradorId].ultimaOperacion)) {
        metricas[v.compradorId].ultimaOperacion = f;
      }
      if (f && f.getFullYear() === anioActual) metricas[v.compradorId].volumenAnual += (v.precio_total || 0);
    });
    return metricas;
  },

  _getResumenCompradores() {
    const compradores = this._cachedCompradores || [];
    const activos = compradores.filter(c => c.activo !== false).length;
    const valorEstimado = compradores.reduce((sum, c) => {
      // Valor estimado basado en historial de transacciones
      // Esta sería una simplificación - en realidad vendría de un método dedicado
      return sum + (c.historialCompra?.totalAnual || 0);
    }, 0);

    return {
      totalCompradores: compradores.length,
      compradoresActivos: activos,
      valorEstimado: valorEstimado
    };
  },

  _getResumenContratos() {
    const contratos = this._cachedContratos || [];
    const activos = contratos.filter(c => c.activo !== false).length;
    const valorTotal = contratos.reduce((sum, c) => {
      // Valor total del contrato
      return sum + (c.valorTotal || 0);
    }, 0);

    return {
      totalContratos: contratos.length,
      contratosActivos: activos,
      valorTotal: valorTotal
    };
  },

  _getDatosMensualesCompradores(porMes, hoy) {
    // Simular datos mensuales para compradores nuevos por mes
    const compradores = this._cachedCompradores || [];
    compradores.forEach(c => {
      if (c.fechaRegistro) {
        const fecha = new Date(c.fechaRegistro);
        const key = fecha.getFullYear() + '-' + String(fecha.getMonth()+1).padStart(2,'0');
        if (porMes[key]) porMes[key].total++;
      }
    });
    return porMes;
  },

  _getDatosMensualesContratos(porMes, hoy) {
    // Simular datos mensuales para contratos nuevos por mes
    const contratos = this._cachedContratos || [];
    contratos.forEach(c => {
      if (c.fechaInicio) {
        const fecha = new Date(c.fechaInicio);
        const key = fecha.getFullYear() + '-' + String(fecha.getMonth()+1).padStart(2,'0');
        if (porMes[key]) porMes[key].total++;
      }
    });
    return porMes;
  },

  // Mantener todos los métodos existentes pero adaptarlos para usar los datos filtrados
  _renderListaCompradores(lista) {
    const contenedor = document.getElementById('compradores-content');
    if (!contenedor) return;

    if (lista.length === 0) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${Icons.edificio()}</div>
          <p class="empty-state-text">${this._cachedCompradores?.length === 0 ? 'Aún no hay compradores registrados.' : 'No hay compradores con ese filtro.'}</p>
          <button class="btn btn-create btn-sm" onclick="CompradoresView.renderFormulario()">${Icons.agregar()} Registrar primer comprador</button>
        </div>`;
      return;
    }

    // Crear mapa de contratos por comprador para renderizar en la lista
    const contratosPorComprador = {};
    (this._cachedContratos || []).forEach(ct => {
      if (!contratosPorComprador[ct.compradorId]) {
        contratosPorComprador[ct.compradorId] = [];
      }
      contratosPorComprador[ct.compradorId].push(ct);
    });

    contenedor.innerHTML = `<div class="grid gap-12">${lista.map(c => {
      const color = this._colorTipo(c.tipo_comprador);
      const cContratos = contratosPorComprador[c.id] || [];
      const metricas = (this._cachedMetricasComprador || {})[c.id];

      return App._cardRegistro({
        title: c.nombre,
        subtitle: [c.nif_cif ? Icons.documento() + ' ' + c.nif_cif : '', c.ciudad ? Icons.zonas() + ' ' + c.ciudad.toUpperCase() : ''].filter(Boolean).join(' · '),
        metadata: metricas ? `<span style="color:var(--c-info);">${Icons.calendar()} Última op.: ${metricas.ultimaOperacion.toLocaleDateString('es-ES')}</span><span>·</span><span style="color:var(--c-success);">${Icons.dinero()} ${metricas.volumenAnual.toLocaleString('es-ES')} € (año actual)</span>` : `<span style="color:var(--text-d);">Sin operaciones registradas</span>`,
        rightSide: `
          <div class="text-right">
            <span class="badge badge-sm font-900 uppercase" style="background:color-mix(in srgb, ${color} 12%, transparent); color:${color}; border:1px solid color-mix(in srgb, ${color} 25%, transparent);">
              ${(c.tipo_comprador === 'láctico' ? 'lácteo' : c.tipo_comprador) || 'híbrido'}
            </span>
            ${c.activo === false ? '<div class="text-red text-[0.55rem] font-950 mt-4 uppercase tracking-widest">INACTIVO</div>' : ''}
          </div>
        `,
        content: `
          <!-- Contratos asociados al comprador -->
          <div class="mt-6 text-[0.62rem] text-aaa font-800 uppercase tracking-tighter style-border-top" style=" padding-top:10px;">
            <span class="text-gray-600 font-900 mr-6">CONTRATOS VINCULADOS:</span>
            ${cContratos.length === 0 ? '<span class="text-gray-700 italic">SIN CONTRATOS ASIGNADOS</span>' :
              cContratos.map(ct => `
                <span class="badge" style="margin-left:4px; font-size:0.6rem; background:${ct.activo ? 'color-mix(in srgb, var(--c-success) 12%, transparent)' : '#222'}; color:${ct.activo ? 'var(--c-success)' : '#555'}; border:1px solid ${ct.activo ? 'color-mix(in srgb, var(--c-success) 25%, transparent)' : '#333'}; padding:2px 8px; border-radius:30px; font-weight:900;">
                  ${ct.numero_contrato}
                </span>
              `).join('')
            }
          </div>
        `,
        footerRight: `<span style="display: inline-block; font-size: 0.75rem; font-weight: 600; border: 1px solid var(--c-warning); color: var(--c-warning); background: rgba(255, 215, 0, 0.1); padding: 2px 6px; border-radius: 4px;">Ficha -></span>`,
        color: color,
        onClick: `location.hash='#/comprador?id=${c.id}'`
      });
    }).join('')}</div>`;

    // Botón Flotante de Acción con viñeta (se agrega después de la lista)
    const fabContainer = document.createElement('div');
    fabContainer.className = 'fab-container';
    fabContainer.innerHTML = `
      <span class="fab-label">Nuevo Comprador</span>
      <button class="fab-btn" aria-label="Añadir"><span aria-hidden="true">${Icons.fabPlus()}</span></button>
    `;
    fabContainer.onclick = () => CompradoresView.renderFormulario();
    contenedor.appendChild(fabContainer);
  },

  _renderListaContratos(lista) {
    const contenedor = document.getElementById('contratos-content');
    if (!contenedor) return;

    if (lista.length === 0) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${Icons.contratos()}</div>
          <p class="empty-state-text">Aún no hay contratos registrados.</p>
          <button class="btn btn-create btn-sm" style="background:var(--c-success);" onclick="CompradoresView._nuevoContratoLibre()">${Icons.agregar()} Crear primer contrato</button>
        </div>`;
      return;
    }

    // Crear mapa para resolver el nombre del comprador
    const compradorMap = {};
    (this._cachedCompradores || []).forEach(c => { compradorMap[c.id] = c; });

    contenedor.innerHTML = `<div class="grid gap-12">${lista.map(ct => {
      const comp = compradorMap[ct.compradorId];
      const color = ct.tipo === 'leche' ? 'var(--c-info)' : 'var(--c-success)';

      return App._cardRegistro({
        title: ct.numero_contrato,
        subtitle: `Vigencia: ${ct.fecha_inicio ? new Date(ct.fecha_inicio).toLocaleDateString() : '?'} ${ct.fecha_fin ? 'AL ' + new Date(ct.fecha_fin).toLocaleDateString() : '(INDEFINIDO)'}`,
        rightSide: `
          <div class="font-950 text-[0.65rem] tracking-widest uppercase mb-4" style="color:${color}; display:flex; align-items:center; gap:8px;">
            <span class="badge" style="background:${ct.activo ? 'color-mix(in srgb, var(--c-success) 12%, transparent)' : '#222'}; color:${ct.activo ? 'var(--c-success)' : '#555'}; border:1px solid ${ct.activo ? 'color-mix(in srgb, var(--c-success) 25%, transparent)' : '#333'}; font-size:0.55rem; padding:2px 8px; border-radius:30px; font-weight:950; text-transform:uppercase; letter-spacing:0.5px;">
              ${ct.activo ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
        `,
        content: `
          <div class="mt-12 text-xs text-ccc bg-black p-10 rounded-sm border border-222">
            <div class="uppercase font-800 text-[0.65rem] text-gray-500 mb-4 tracking-wider">COMPRADOR ASIGNADO:</div>
            <div class="flex items-center gap-6">
              ${comp ? `
                <a href="#/comprador?id=${comp.id}" class="text-gold font-950 uppercase hover-underline text-sm flex items-center gap-4">${Icons.compradores()} ${comp.nombre}</a>
              ` : `
                <span class="text-red font-950 uppercase text-xs flex items-center gap-4">${Icons.alerta()} NO ASIGNADO / HUÉRFANO</span>
              `}
            </div>
            ${ct.condiciones ? `<div class="mt-8 italic text-aaa border-top-222 pt-8 uppercase text-[0.6rem] leading-relaxed">Condiciones: ${ct.condiciones}</div>` : ''}
            ${ct.precios && ct.precios.length > 0 ? `
              <div class="mt-10 flex flex-wrap gap-4 border-top-222 pt-10">
                ${ct.precios.map(pr => `
                  <span style="background:#111; border:1px solid #333; padding:4px 10px; border-radius:30px; font-size:0.6rem; font-weight:900; color:#aaa; text-transform:uppercase;">
                    ${pr.producto}: <strong class="text-white ml-2">${pr.precio_unitario.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/${pr.unidad.toUpperCase()}</strong>
                  </span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `,
        footerRight: `
          <div class="mt-16 flex gap-8">
            <button class="widget-link-btn widget-link-btn--neon neon-info flex-1 px-12 py-8 min-h-0 h-auto" onclick="CompradoresView._verContrato(${ct.id})">
              ${Icons.editar()} <span class="widget-link-label text-[0.65rem]">EDITAR</span>
            </button>
            ${comp ? `<button class="widget-link-btn widget-link-btn--neon neon-warning flex-1 px-12 py-8 min-h-0 h-auto" onclick="location.hash='#/comprador?id=${comp.id}'">
              ${Icons.compradores()} <span class="widget-link-label text-[0.65rem]">FICHA CLIENTE</span>
            </button>` : ''}
          </div>
        `,
        color: color
      });
    }).join('')}</div>`;

    // Botón Flotante de Acción con viñeta (se agrega después de la lista)
    const fabContainer = document.createElement('div');
    fabContainer.className = 'fab-container';
    fabContainer.innerHTML = `
      <span class="fab-label">Nuevo Contrato</span>
      <button class="fab-btn" aria-label="Añadir"><span aria-hidden="true">${Icons.fabPlus()}</span></button>
    `;
    fabContainer.onclick = () => CompradoresView._nuevoContratoLibre();
    contenedor.appendChild(fabContainer);
  },

  _colorTipo(tipo, bg = false, border = false) {
    const colores = {
      'cárnico': { text: 'var(--c-danger)', bg: 'rgba(255,68,68,0.1)', border: 'rgba(255,68,68,0.3)' },
      'láctico': { text: 'var(--c-info)', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
      'híbrido': { text: 'var(--c-success)', bg: 'rgba(204,255,0,0.1)', border: 'rgba(204,255,0,0.3)' }
    };
    const c = colores[tipo] || colores['híbrido'];
    if (bg) return c.bg;
    if (border) return c.border;
    return c.text;
  },

  // Mantener todos los métodos existentes de detalle, formulario, etc.
  async renderDetail(id) {
    // Método wrapper para mantener compatibilidad con cualquier llamada
    await this.renderDetalle(id);
  },

  async renderDetalle(id) {
    const comprador = await Compradores.get(id);
    if (!comprador) return App.toastError('Comprador no encontrado');

    const [ventasCarne, entregasLeche, contratos, resumen] = await Promise.all([
      Compradores.getVentasCarne(id),
      Compradores.getEntregasLeche(id),
      Contratos.list(id),
      Compradores.getResumen(id)
    ]);

    const main = document.getElementById("app-content");
    const colorComp = this._colorTipo(comprador.tipo_comprador);

    main.innerHTML = `
      <div class="mb-14">
        <button onclick="location.hash='#/compradores'" class="widget-link-btn widget-link-btn--neon neon-danger px-16 py-8 min-h-0 h-auto">
          <span class="text-[0.7rem] font-950 uppercase tracking-widest">${Icons.atras()} Volver</span>
        </button>
      </div>

      <!-- Cabecera -->
      <div class="card p-20 bg-black" style="border: 1px solid #27272a;">
        <div class="flex justify-between items-start mb-16">
          <div>
            <h2 class="text-white mt-0 mb-4 text-2xl font-black uppercase tracking-tight" style="color:${colorComp} !important;"><span style="color:${colorComp}; margin-right: 6px;">|</span> ${comprador.nombre}</h2>
            <div class="flex gap-8 flex-wrap">
              <span class="badge badge-sm font-950 uppercase" style="background:color-mix(in srgb, ${colorComp} 12%, transparent); color:${colorComp}; border:1px solid color-mix(in srgb, ${colorComp} 25%, transparent);">
                ${(comprador.tipo_comprador === 'láctico' ? 'lácteo' : comprador.tipo_comprador) || 'híbrido'}
              </span>
              ${comprador.activo === false ? '<span class="badge badge-sm font-950 uppercase bg-red-900 border-red-500 text-white">INACTIVO</span>' : '<span class="badge badge-sm font-950 uppercase bg-green-900 border-green-500 text-white">ACTIVO</span>'}
            </div>
          </div>
          <div class="flex gap-8">
            <button class="widget-link-btn widget-link-btn--neon neon-danger px-12 py-8 min-h-0 h-auto" onclick="CompradoresView._eliminar(${id})" aria-label="Eliminar">
              <span aria-hidden="true">${Icons.eliminar()}</span>
            </button>
            <button class="widget-link-btn widget-link-btn--neon neon-info px-12 py-8 min-h-0 h-auto" onclick="CompradoresView.renderFormulario(${id})" aria-label="Editar">
              <span aria-hidden="true">${Icons.editar()}</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-15 text-xs text-gray-500 uppercase font-800 tracking-wider bg-dark p-14 rounded-sm border border-222">
          ${comprador.nif_cif ? `<div class="flex items-center gap-6">${Icons.documento()} <span class="text-aaa">NIF:</span> <strong class="text-gold font-950 font-mono">${comprador.nif_cif}</strong></div>` : ''}
          ${comprador.telefono ? `<div class="flex items-center gap-6">${Icons.info()} <span class="text-aaa">TEL:</span> <strong class="text-white">${comprador.telefono}</strong></div>` : ''}
          ${comprador.email ? `<div class="flex items-center gap-6 lowercase">${Icons.enlace()} <span class="text-aaa uppercase">EMAIL:</span> <strong class="text-white">${comprador.email}</strong></div>` : ''}
          ${comprador.ciudad ? `<div class="flex items-center gap-6">${Icons.zonas()} <span class="text-aaa">UBICACIÓN:</span> <strong class="text-white">${comprador.ciudad.toUpperCase()}${comprador.provincia ? ' ('+comprador.provincia.toUpperCase()+')' : ''}</strong></div>` : ''}
          ${comprador.condiciones_pago ? `<div class="col-span-full flex items-center gap-6 mt-4 border-top-222 pt-8">${Icons.dinero()} <span class="text-aaa">PAGO:</span> <strong class="text-white">${comprador.condiciones_pago.toUpperCase()}</strong></div>` : ''}
          ${comprador.rega ? `<div class="col-span-full flex items-center gap-6 text-gold font-950 font-mono">${Icons.informeRega()} <span class="text-aaa">REGA DESTINO:</span> <span class="text-gold font-mono font-950">${comprador.rega}</span></div>` : ''}
        </div>

        <!-- KPIS -->
        <div class="grid grid-cols-3 gap-8 mb-16 mt-16">
          <div class="info-box-center py-10" style="background: #1E1E1E; border: 1px solid #27272a; border-radius: 8px;">
            <small class="s-lbl uppercase font-900" style="color: var(--c-success);">CARNE</small>
            <div class="s-val inf-val-lg text-green font-950">${resumen.total_ventas_carne}</div>
            <small class="text-gray-600 text-[0.5rem] font-800 block mt-2">${resumen.peso_canal_total.toLocaleString()} kg · ${resumen.importe_carne_real.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2})} €</small>
            ${resumen.ventas_carne_sin_precio > 0 ? `<small class="text-[0.5rem] font-800 block mt-2" style="color: var(--c-warning);">${resumen.ventas_carne_sin_precio} sin precio</small>` : ''}
          </div>
          <div class="info-box-center py-10" style="background: #1E1E1E; border: 1px solid #27272a; border-radius: 8px;">
            <small class="s-lbl uppercase font-900" style="color: var(--c-warning);">LECHE</small>
            <div class="s-val inf-val-lg text-amber font-950">${resumen.total_entregas_leche}</div>
            <small class="text-gray-600 text-[0.5rem] font-800 block mt-2">${resumen.litros_totales.toLocaleString()} L · ${resumen.importe_leche_real.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2})} €</small>
            ${resumen.entregas_leche_sin_precio > 0 ? `<small class="text-[0.5rem] font-800 block mt-2" style="color: var(--c-warning);">${resumen.entregas_leche_sin_precio} sin precio</small>` : ''}
          </div>
          <div class="info-box-center py-10" style="background: #1E1E1E; border: 1px solid #27272a; border-radius: 8px;">
            <small class="s-lbl uppercase font-900" style="color: var(--c-purple);">CONTRATOS</small>
            <div class="s-val inf-val-lg text-purple font-950">${contratos.length}</div>
            <small class="text-gray-600 text-[0.5rem] font-800 block mt-2">${resumen.contratos_activos} ACTIVOS</small>
          </div>
        </div>

        <!-- Contratos activos -->
        <div class="card p-16 mb-16 border-222 bg-black">
          <div class="text-xs text-gray-500 uppercase font-950 tracking-widest border-bottom-222 pb-8 mb-16 flex items-center gap-8">
              <span style="color: var(--c-success);">|</span> ${Icons.contratos()} CONTRATOS VIGENTES
          </div>
          <div class="grid grid-cols-1 gap-10 max-w-240 mx-auto mb-20">
            <button class="widget-link-btn widget-link-btn--neon neon-info" onclick="CompradoresView._nuevoContrato(${id})">
              ${Icons.agregar()}
              <span class="widget-link-label">NUEVO CONTRATO</span>
            </button>
          </div>
          <div class="grid gap-8">
          ${contratos.length === 0 ? '<div class="empty-state border-none mt-0 mb-0"><p class="empty-state-text uppercase font-900 text-xs">Sin contratos registrados.</p></div>' :
            contratos.map(c => `
              <div class="info-box-sm mb-4 bg-dark border border-222" onclick="CompradoresView._verContrato(${c.id})" style="cursor:pointer; border-left:4px solid ${c.activo ? 'var(--c-success)' : '#444'};">
                <div class="flex justify-between items-center">
                  <span class="text-white font-950 text-md uppercase tracking-tight">${c.numero_contrato}</span>
                  <span class="badge" style="font-size:0.55rem; background:${c.activo ? 'color-mix(in srgb, var(--c-success) 12%, transparent)' : '#222'}; color:${c.activo ? 'var(--c-success)' : '#666'}; border:1px solid ${c.activo ? 'color-mix(in srgb, var(--c-success) 25%, transparent)' : '#333'}; border-radius:30px; padding:2px 8px; font-weight:950; text-transform:uppercase;">${c.activo ? 'ACTIVO' : 'INACTIVO'}</span>
                </div>
                <div class="text-aaa font-800 text-[0.62rem] uppercase mt-4 tracking-wide flex flex-wrap gap-x-10 gap-y-2">
                  <span class="flex items-center gap-4 text-blue">${c.tipo === 'leche' ? Icons.leche() : Icons.carne()} ${c.tipo}</span>
                  <span class="flex items-center gap-4">${Icons.calendar()} ${c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString() : '?'} ${c.fecha_fin ? '→ '+new Date(c.fecha_fin).toLocaleDateString() : ''}</span>
                  ${c.precios?.length ? `<span class="flex items-center gap-4 text-gold">${Icons.dinero()} ${c.precios.length} PRECIOS</span>` : ''}
                </div>
              `).join('')}
          </div>
        </div>

        <!-- Historial de Ventas Carne -->
        <div class="card p-16 mb-16 border-222 bg-black">
          <div class="text-xs text-gray-500 uppercase font-950 tracking-widest border-bottom-222 pb-8 mb-12 flex items-center gap-8">
              <span style="color: var(--c-success);">|</span> ${Icons.carne()} HISTORIAL CARNE
          </div>
          ${ventasCarne.length === 0 ? '<div class="empty-state border-none mt-0 mb-0"><p class="empty-state-text uppercase font-900 text-xs">Sin ventas registradas.</p></div>' :
            ventasCarne.slice(0, 30).map(v => `
              <div class="history-row border-bottom-222 py-12">
                <div>
                  <div class="text-gold font-950 uppercase text-[0.7rem] flex items-center gap-6">${Icons.calendar()} ${v.fechaSacrificio ? new Date(v.fechaSacrificio).toLocaleDateString() : '-'}</div>
                  <div class="text-aaa font-800 text-[0.62rem] uppercase mt-2 tracking-wide">${v.pesoCanal || 0} kg CANAL · REND: <strong class="text-white">${v.rendimientoCanal || 0}%</strong></div>
                </div>
                <div class="text-right">
                  <div class="text-red font-950 text-md">${v.precio_total ? v.precio_total.toLocaleString('es-ES') + ' €' : '—'}</div>
                  <div class="badge badge-sm mt-2 uppercase font-950 text-[0.55rem] border-red-900 bg-red-900-opacity-20">${v.clasificacion?.seurop || 'S/C'}</div>
                </div>
              </div>
            `).join('')}
          ${ventasCarne.length > 30 ? `<div class="text-center text-gray-700 font-900 text-[0.55rem] uppercase tracking-widest mt-15">Mostrando 30 de ${ventasCarne.length} registros</div>` : ''}
        </div>

        <!-- Historial de Leche -->
        <div class="card p-16 mb-20 border-222 bg-black">
          <div class="text-xs text-gray-500 uppercase font-950 tracking-widest border-bottom-222 pb-8 mb-12 flex items-center gap-8">
              <span style="color: var(--c-warning);">|</span> ${Icons.leche()} HISTORIAL LECHE
          </div>
          ${entregasLeche.length === 0 ? '<div class="empty-state border-none mt-0 mb-0"><p class="empty-state-text uppercase font-900 text-xs">Sin entregas registradas.</p></div>' :
            entregasLeche.slice(0, 20).map(e => `
              <div class="history-row border-bottom-222 py-12">
                <div>
                  <div class="text-gold font-950 uppercase text-[0.7rem] flex items-center gap-6">${Icons.calendar()} ${e.fechaRecogida ? new Date(e.fechaRecogida).toLocaleDateString() : '-'}</div>
                  <div class="text-aaa font-800 text-[0.62rem] uppercase mt-2 tracking-wide">${Icons.transportistas()} CISTERNA: <strong class="text-white">${e.matriculaCisterna || 'S/N'}</strong></div>
                </div>
                <div class="text-right">
                  <div class="text-amber font-950 text-md">${(e.cantidad || 0).toLocaleString()} L</div>
                  ${e.precio_final_unitario ? `<div class="text-gray-600 uppercase font-900 text-[0.55rem] tracking-widest mt-2">${e.precio_final_unitario.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/L</div>` : ''}
                </div>
              </div>
            `).join('')}
          ${entregasLeche.length > 20 ? `<div class="text-center text-gray-700 font-900 text-[0.55rem] uppercase tracking-widest mt-15">Mostrando 20 de ${entregasLeche.length} registros</div>` : ''}
        </div>

        ${comprador.notas ? `
          <div class="card p-16 mb-40" style="border: 1px solid #27272a;">
            <div class="text-gold font-950 text-[0.65rem] uppercase tracking-widest mb-10"><span style="color: var(--c-gold);">|</span> OBSERVACIONES</div>
            <p class="text-aaa text-xs uppercase font-700 leading-relaxed m-0">${comprador.notas}</p>
          </div>` : '<div class="pb-40"></div>'}
        `;
    },

    // ============================================
    // FORMULARIO COMPRADOR
    // ============================================

    async renderFormulario(id) {
      const esEdicion = !!id;
      const c = esEdicion ? await Compradores.get(id) : {
          nombre: '', nif_cif: '', direccion: '', codigo_postal: '', ciudad: '', provincia: '',
          telefono: '', email: '', tipo_comprador: 'híbrido', tipo_operador: 'operador_comercial',
          rega: '', comunidad_autonoma: '', condiciones_pago: '', notas: '', activo: true
      };

      const destinoCancelar = esEdicion ? '#/comprador?id=' + id : '#/compradores';
      CompradoresView._compradorGuardado = false;
      App.setExitGuard(() => CompradoresView._confirmSalirFormulario());

      const main = document.getElementById("app-content");
      main.innerHTML = `
        <div class="wizard-full-screen">
        <div class="wizard-header-fixed border-top-5-gold">
          <h1 class="wizard-header-title uppercase font-950 tracking-widest text-lg"><span style="color: var(--c-warning); margin-right: 6px;">|</span> ${esEdicion ? Icons.editar() : Icons.agregar()} ${esEdicion ? 'EDITAR COMPRADOR' : 'NUEVO COMPRADOR'}</h1>
        </div>
        <div class="wizard-content-scrollable p-20">
        <div class="card p-20 bg-black" style="border: 1px solid #27272a;">

          <div class="wizard-input-group mb-15">
              <label class="wizard-label uppercase font-900" for="c-nombre">Nombre / Razón Social *</label>
              <input type="text" id="c-nombre" value="${c.nombre || ''}" required class="wizard-input uppercase font-900" placeholder="EJ: GANADERÍAS DEL SUR S.L.">
          </div>

          <div class="grid grid-cols-2 gap-12 mb-15">
            <div class="wizard-input-group">
              <label class="wizard-label uppercase font-900" for="c-nif">NIF / CIF *</label>
              <input type="text" id="c-nif" value="${c.nif_cif || ''}" required class="wizard-input uppercase font-800" placeholder="B12345678">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label uppercase font-900" for="c-tipo">Tipo Comprador *</label>
              <select id="c-tipo" required class="wizard-input wizard-select font-900 uppercase">
                <option value="cárnico" ${c.tipo_comprador === 'cárnico' ? 'selected' : ''}>CÁRNICO</option>
                <option value="láctico" ${c.tipo_comprador === 'láctico' ? 'selected' : ''}>LÁCTEO</option>
                <option value="híbrido" ${c.tipo_comprador === 'híbrido' || !c.tipo_comprador ? 'selected' : ''}>HÍBRIDO / MIXTO</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-12 mb-15">
            <div class="wizard-input-group">
              <label class="wizard-label uppercase font-900" for="c-tipo-operador">Operador SIGGAN</label>
              <select id="c-tipo-operador" class="wizard-input wizard-select font-800 uppercase">
                <option value="matadero" ${c.tipo_operador === 'matadero' ? 'selected' : ''}>MATADERO</option>
                <option value="industria_lactea" ${c.tipo_operador === 'industria_lactea' ? 'selected' : ''}>INDUSTRIA LÁCTEA</option>
                <option value="operador_comercial" ${!c.tipo_operador || c.tipo_operador === 'operador_comercial' ? 'selected' : ''}>OPERADOR COMERCIAL</option>
                <option value="tratante" ${c.tipo_operador === 'tratante' ? 'selected' : ''}>TRATANTE</option>
              </select>
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label uppercase font-900" for="c-rega">REGA Destino</label>
              <input type="text" id="c-rega" value="${c.rega || ''}" class="wizard-input uppercase font-800 input-rega-std" placeholder="ES000000000000" maxlength="14">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label uppercase font-900" for="c-ccaa">CCAA</label>
              <select id="c-ccaa" class="wizard-input wizard-select font-800 uppercase">
                <option value="">— SIN DEFINIR —</option>
                <option value="andalucia" ${c.comunidad_autonoma === 'andalucia' ? 'selected' : ''}>ANDALUCÍA</option>
                <option value="extremadura" ${c.comunidad_autonoma === 'extremadura' ? 'selected' : ''}>EXTREMADURA</option>
              </select>
            </div>
          </div>

          <div class="wizard-input-group mb-15">
              <label class="wizard-label uppercase font-900" for="c-dir">Dirección Postal</label>
              <input type="text" id="c-dir" value="${c.direccion || ''}" class="wizard-input uppercase font-800">
          </div>

          <div class="grid grid-cols-3 gap-12 mb-15">
            <div class="wizard-input-group">
              <label class="wizard-label uppercase font-900" for="c-cp">C.P.</label>
              <input type="text" id="c-cp" value="${c.codigo_postal || ''}" class="wizard-input font-800">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label uppercase font-900" for="c-ciudad">Ciudad</label>
              <input type="text" id="c-ciudad" value="${c.ciudad || ''}" class="wizard-input uppercase font-800">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label uppercase font-900" for="c-prov">Provincia</label>
              <input type="text" id="c-prov" value="${c.provincia || ''}" class="wizard-input uppercase font-800">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-12 mb-15">
            <div class="wizard-input-group">
              <label class="wizard-label uppercase font-900" for="c-tel">Teléfono</label>
              <input type="tel" id="c-tel" value="${c.telefono || ''}" class="wizard-input font-800">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label uppercase font-900" for="c-email">Email</label>
              <input type="email" id="c-email" value="${c.email || ''}" class="wizard-input font-800 lowercase">
            </div>
          </div>

          <div class="wizard-input-group mb-15">
              <label class="wizard-label uppercase font-900" for="c-pago">Condiciones de Pago</label>
              <input type="text" id="c-pago" value="${c.condiciones_pago || ''}" class="wizard-input uppercase font-800" placeholder="EJ: TRANSFERENCIA 30 DÍAS">
          </div>

          <div class="wizard-input-group mb-15">
              <label class="wizard-label uppercase font-900" for="c-notas">Notas / Observaciones</label>
              <textarea id="c-notas" class="wizard-input uppercase font-700" style="min-height:80px; resize:none;">${c.notas || ''}</textarea>
          </div>

          <label class="flex items-center gap-10 text-xs text-white cursor-pointer bg-black border border-222 p-12 rounded-sm mb-25">
            <input type="checkbox" id="c-activo" ${c.activo !== false ? 'checked' : ''} style="accent-color:var(--c-warning);">
            <span class="uppercase font-950 tracking-widest text-[0.65rem]">Comprador activo en el sistema</span>
          </label>
        </div>
        </div>
        <div class="wizard-footer-fixed border-top-222">
          ${esEdicion ? `<button type="button" onclick="CompradoresView._eliminar(${id})" class="wizard-btn-action wizard-btn-danger">${Icons.eliminar()} Eliminar</button>` : '<div></div>'}
          <div class="wizard-footer-buttons">
            <button type="button" onclick="CompradoresView._salirFormulario('${destinoCancelar}')" class="wizard-btn-action wizard-btn-secondary">${Icons.cerrar()} Cancelar</button>
            <button type="button" onclick="CompradoresView._guardar(${id || ''})" class="wizard-btn-action wizard-btn-success">${Icons.guardar()} Guardar</button>
          </div>
        </div>
        </div>
        `;
    },

    async _guardar(id) {
        try {
            const data = {
                id: id || undefined,
                nombre: document.getElementById('c-nombre').value.trim(),
                nif_cif: document.getElementById('c-nif').value.trim(),
                tipo_comprador: document.getElementById('c-tipo').value,
                tipo_operador: document.getElementById('c-tipo-operador').value,
                rega: document.getElementById('c-rega').value.trim(),
                comunidad_autonoma: document.getElementById('c-ccaa').value,
                direccion: document.getElementById('c-dir').value.trim(),
                codigo_postal: document.getElementById('c-cp').value.trim(),
                ciudad: document.getElementById('c-ciudad').value.trim(),
                provincia: document.getElementById('c-prov').value.trim(),
                telefono: document.getElementById('c-tel').value.trim(),
                email: document.getElementById('c-email').value.trim(),
                condiciones_pago: document.getElementById('c-pago').value.trim(),
                notas: document.getElementById('c-notas').value.trim(),
                activo: document.getElementById('c-activo').checked
            };

            if (!data.nombre) return App.toastError('El nombre es obligatorio');
            if (!data.nif_cif) return App.toastError('El NIF/CIF es obligatorio');

            const nuevoId = await Compradores.save(data);
            CompradoresView._compradorGuardado = true;
            App.clearExitGuard();
            App.toast(id ? 'Comprador actualizado' : 'Comprador creado', 'success');

            // Si venimos del wizard de venta, volver
            if (window._volverAWizardVenta) {
              window._volverAWizardVenta = false;
              const wizardOverlay = document.getElementById('wizard-venta-masiva');
              if (wizardOverlay) wizardOverlay.remove();
              location.hash = '#/comercializacion';
              return;
            }

            location.hash = '#/comprador?id=' + nuevoId;
        } catch (e) {
            App.toastError(e.message);
        }
    },

    /** Guarda de salida compartida con el header-back y el botón físico Android (ver App.setExitGuard). */
    async _confirmSalirFormulario() {
        if (this._compradorGuardado) return true;
        return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
    },

    async _salirFormulario(destino) {
        if (!(await this._confirmSalirFormulario())) return;
        App.clearExitGuard();
        location.hash = destino;
    },

    async _eliminar(id) {
        if (!await Confirm.confirm("Eliminar Comprador", "¿Eliminar este comprador permanentemente?", true)) return;
        try {
            await Compradores.delete(id);
            App.toast('Comprador eliminado', "success");
            location.hash = '#/compradores';
        } catch (e) {
            App.toastError(e.message);
        }
    },

    _nuevoContrato(compradorId) {
        location.hash = '#/contrato?compradorId=' + compradorId;
    },

    _nuevoContratoLibre() {
        location.hash = '#/contrato';
    },

    _verContrato(id) {
        location.hash = '#/contrato?id=' + id;
    }
};

window.CompradoresView = CompradoresView;