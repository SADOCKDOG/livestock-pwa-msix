/**
 * TransportistasView - Livestock Manager Premium v4.0
 * Vista de gestión de transportistas con listado, detalle y formulario.
 */

const TransportistasView = {
  _filtroActivo: {
    texto: '',
    tipo: '' // activo, inactivo, todos
  },
  _TIPO_VEHICULO_LABELS: {
    camion: 'Camión ganadero',
    furgoneta: 'Furgoneta',
    remolque: 'Remolque/Bañera',
    cisterna: 'Cisterna lechera'
  },

  _labelTipoVehiculo(valor) {
    return this._TIPO_VEHICULO_LABELS[valor] || valor || '-';
  },

  /** Días restantes hasta una fecha de vencimiento (negativo si ya caducó). */
  _diasHastaVencimiento(fechaStr) {
    if (!fechaStr) return null;
    const hoy = new Date(new Date().toISOString().split('T')[0]);
    const fin = new Date(fechaStr);
    return Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24));
  },

  /** Color según urgencia: sin certificado o caducado = rojo, próximo (<=30d) = ámbar, vigente = verde. */
  _colorVencimiento(fechaStr, sinCertificado = false) {
    if (sinCertificado) return `color:var(--c-danger);`;
    const dias = this._diasHastaVencimiento(fechaStr);
    if (dias === null) return `color:var(--text-d);`;
    if (dias < 0) return `color:var(--c-danger);`;
    if (dias <= 30) return `color:var(--c-warning);`;
    return `color:var(--c-success);`;
  },

  _labelVencimiento(prefijo, fechaStr, sinCertificado = false) {
    if (sinCertificado) return `Sin certificado`;
    const dias = this._diasHastaVencimiento(fechaStr);
    if (dias === null) return `${prefijo}: sin vencimiento`;
    if (dias < 0) return `${prefijo} CADUCADO (${Math.abs(dias)}d)`;
    return `${prefijo}: ${dias}d`;
  },

  async render() {
    // Color de pantalla: lo fija ComercializacionView (color fijo de CoMer), esta vista siempre va embebida en su carrusel.
    const main = document.getElementById("comercializacion-tab-content") || document.getElementById("app-content");
    const moduleColor = window.getModuleColor ? getModuleColor('/transportistas') : 'var(--c-pink)';

    // Cargar datos
    const transportistas = await Transportistas.list().catch(() => []);
    const activoCount = transportistas.filter(t => t.activo !== false).length;
    const inactivoCount = transportistas.length - activoCount;

    // Guardar datos brutos para filtrado
    this._cachedDataRaw = { transportistas };

    // Aplicar filtros iniciales
    const filteredTransportistas = this._filtrar(transportistas);

    // Resumen mensual (últimos 6 meses) - basado en fecha de registro
    const hoy = new Date();
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const porMes = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      porMes[key] = { label: meses[d.getMonth()] + ' ' + d.getFullYear(), total: 0 };
    }
    // Contar transportistas por mes de registro
    const rawData = this._cachedDataRaw ? this._cachedDataRaw.transportistas : [];
    rawData.forEach(t => {
      if (t.fecha_registro || t.fechaRegistro) {
        const fechaStr = t.fecha_registro || t.fechaRegistro;
        if (fechaStr) {
          const key = fechaStr.substring(0, 7); // YYYY-MM
          if (porMes[key]) porMes[key].total++;
        }
      }
    });
    const mesesHtml = Object.values(porMes).reverse().map(m => {
      const max = Math.max(1, ...Object.values(porMes).map(m => m.total));
      const pct = Math.max(0, Math.min(100, (m.total / max) * 100));
      const color = pct > 70 ? 'var(--c-danger)' : pct > 40 ? 'var(--c-warning)' : 'var(--c-success)';
      return `<div class="flex-1 text-center min-w-0">
        <div class="text-xs text-gray mb-2" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.label}</div>
        <div class="transporte-bar-wrap">
          <div style="position:absolute;bottom:0;width:100%;height:${pct}%;background:${color};border-radius:6px;opacity:0.8;transition:height 0.3s;"></div>
        </div>
        <div class="text-xs font-bold mt-2" style="color:${color};">${m.total}</div>
      </div>`;
    }).join('');

    main.innerHTML = `
      <!-- Cabecera de Módulo: Resumen y acción principal -->
      <div class="module-header">
        <div class="card p-16 mb-16 border-222 animate-fade-in" style="background: linear-gradient(135deg, rgba(236,72,153,0.05) 0%, rgba(0,0,0,0.2) 100%); border-left: 4px solid var(--c-pink);">
          <div class="flex items-center gap-12 mb-10">
            <span class="text-3xl" style="color:var(--c-pink);">${Icons.transportistas()}</span>
            <div>
              <h2 class="text-white font-950 text-base uppercase tracking-wider mb-2">LOGÍSTICA Y TRANSPORTISTAS</h2>
              <p class="text-[0.65rem] text-gray font-700 uppercase leading-relaxed">Flota de transporte ganadero calificado y control de certificados.</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-8 mt-12 py-8 border-top-222">
            <div class="text-[0.6rem] text-gray uppercase font-900">Total Flota: <strong class="text-white">${transportistas.length}</strong></div>
            <div class="text-[0.6rem] text-gray uppercase font-900">Activos: <strong class="text-success">${activoCount}</strong></div>
          </div>
        </div>
        <fieldset class="erp-action-group">
          <legend>Registro de Transportistas</legend>
          <div class="erp-action-group-body">
            <button class="widget-link-btn widget-link-btn--neon neon-success" onclick="TransportistasView._abrirFormulario()">${Icons.agregar()}<span class="widget-link-label">Nuevo Transportista</span></button>
          </div>
        </fieldset>
      </div>

      <!-- Evolución Mensual -->
      <div class="card mb-14 p-12 card-resumen" style="background:rgba(255,255,255,0.01); width:100%;">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-8 flex justify-between items-center">
          <span><span style="color: var(--c-pink); margin-right:4px;">|</span> ACTIVIDAD LOGÍSTICA</span>
        </div>
        <div class="flex gap-6">${mesesHtml}</div>
      </div>

      <!-- Balance Consolidado (Estandarizado en Card de Fondo OLED sin bordes de color) -->
      <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(236,72,153,0.015); width:100%;">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center gap-6" style="border-bottom:none; padding-bottom:0; margin-bottom:12px;">
          <span style="color: ${moduleColor}; margin-right:4px;">|</span> ${Icons.transportistas()} RESUMEN DE TRANSPORTISTAS
        </div>
        <div class="flex flex-col">
          <div class="py-8 flex justify-between items-center border-bottom-222">
            <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.transportistas()} Total Transportistas</span>
            <strong class="text-xl font-950" style="color: ${moduleColor};">${transportistas.length}</strong>
          </div>
          <div class="py-8 flex justify-between items-center border-bottom-222">
            <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.check()} Transportistas Activos</span>
            <strong class="text-xl font-950 text-green">${activoCount}</strong>
          </div>
          <div class="py-8 flex justify-between items-center">
            <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.xmark()} Inactivos</span>
            <strong class="text-xl font-950 text-red">${inactivoCount}</strong>
          </div>
        </div>
      </div>

      <!-- Filtro de búsqueda integrado (controla el listado) + interruptor de vista (Tarjetas / Tabla ERP) -->
      <div class="text-xs text-white uppercase font-black tracking-wider mb-10 flex items-center gap-4" style="justify-content: space-between;">
        <span class="flex items-center gap-4"><span style="color: ${moduleColor};">|</span> ${Icons.transportistas()} LISTA DE TRANSPORTISTAS</span>
        <div class="flex gap-4">
          <button class="btn-erp-secondary btn-sm" id="btn-transp-vista-cards" onclick="TransportistasView._setVistaModo('cards')">Tarjetas</button>
          <button class="btn-erp-secondary btn-sm" id="btn-transp-vista-tabla" onclick="TransportistasView._setVistaModo('tabla')">Tabla ERP</button>
        </div>
      </div>
      <div class="flex gap-8 items-center mb-12">
        <div class="relative flex-1 min-w-0">
          <input type="search" id="search-transportistas" placeholder="Buscar por nombre, NIF o matrícula..."
                 oninput="TransportistasView._setFiltro('texto', this.value)"
                 class="form-input search-input w-full" style="margin-top:0;">
        </div>
        <select id="transportistas-filtro-estado" class="form-select"
                onchange="TransportistasView._setFiltro('tipo', this.value)"
                style="width:110px; min-width:100px; flex-shrink:0;">
          <option value="todos" ${this._filtroActivo.tipo === 'todos' ? 'selected' : ''}>Todos</option>
          <option value="activo" ${this._filtroActivo.tipo === 'activo' ? 'selected' : ''}>Activos</option>
          <option value="inactivo" ${this._filtroActivo.tipo === 'inactivo' ? 'selected' : ''}>Inactivos</option>
        </select>
      </div>
      <div id="transportistas-content"><div class="loader">Cargando transportistas...</div></div>
      <div id="transportistas-erp-table-container" class="mt-12" style="display:none;"></div>`;

    // Actualizar datos filtrados para el contenido
    this._cachedData = { transportistas: filteredTransportistas };
    this._renderLista();

    // Restaurar modo de vista (por defecto "tabla" en escritorio ≥ 1024px)
    const modoGuardado = localStorage.getItem('transportistas_view_mode') || 'tabla';
    this._setVistaModo(modoGuardado, false);
  },

  _setFiltro(type, value) {
    this._filtroActivo[type] = value;
    this._aplicarFiltros();
  },

  _aplicarFiltros() {
    if (!this._cachedDataRaw) return;
    const filtrados = this._filtrar(this._cachedDataRaw.transportistas);
    this._cachedData = { transportistas: filtrados };
    if (this._vistaModo === 'tabla') return this._renderErpTable();
    this._renderLista();
  },

  _filtrar(transportistas) {
    if (!transportistas) return [];
    let filtrados = transportistas;

    // Filtro por tipo (activo/inactivo/todos)
    if (this._filtroActivo.tipo === 'activo') {
      filtrados = filtrados.filter(t => t.activo !== false);
    } else if (this._filtroActivo.tipo === 'inactivo') {
      filtrados = filtrados.filter(t => t.activo === false);
    }
    // Si es 'todos', no aplicar filtro de tipo

    // Filtro por texto de búsqueda
    if (this._filtroActivo.texto.trim()) {
      const q = this._filtroActivo.texto.toLowerCase();
      filtrados = filtrados.filter(t =>
        (t.nombre || '').toLowerCase().includes(q) ||
        (t.nif_cif || '').toLowerCase().includes(q) ||
        (t.matricula || '').toLowerCase().includes(q) ||
        (t.telefono || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q)
      );
    }

    return filtrados;
  },

  async _renderLista() {
    const container = document.getElementById('transportistas-content');
    if (!container) return;

    const transportistas = this._cachedData ? this._cachedData.transportistas : [];

    if (transportistas.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${Icons.transportistas()}</div><p class="empty-state-text">${this._cachedDataRaw ? this._cachedDataRaw.transportistas.length === 0 ? 'No hay transportistas registrados.' : 'No hay transportistas con ese filtro.' : 'Cargando...'}</p><button class="widget-link-btn widget-link-btn--neon neon-success" onclick="TransportistasView._abrirFormulario()" data-guide="btn-vacio-transportistas">${Icons.agregar()}<span class="widget-link-label">Nuevo Transportista</span></button></div>`;
      return;
    }

    container.innerHTML = transportistas.map(t => App._cardRegistro({
      title: t.nombre,
      subtitle: [t.nif_cif ? Icons.documento() + ' ' + `<span class="text-gold font-mono font-950">${t.nif_cif}</span>` : '', t.matricula ? Icons.transportistas() + ' ' + `<span class="text-gold font-mono font-950">${t.matricula}</span>` : ''].filter(Boolean).join(' · '),
      rightSide: `
        <div class="text-right">
          <span class="badge badge-sm uppercase" style="background:${t.activo ? 'color-mix(in srgb, var(--c-success) 8%, transparent)' : '#6b728015'}; color:${t.activo ? 'var(--c-success)' : '#9ca3af'}; border:1px solid ${t.activo ? 'color-mix(in srgb, var(--c-success) 21%, transparent)' : '#6b728035'};">
            ${t.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      `,
      content: `
        <div class="flex flex-wrap gap-x-12 gap-y-3 text-[0.62rem] text-aaa font-800 uppercase mt-4">
          <div class="flex items-center gap-4" style="${this._colorVencimiento(t.certificado_bienestar_vencimiento, !t.certificado_bienestar)}">${t.certificado_bienestar ? Icons.check() : Icons.alerta()} ${this._labelVencimiento('Bienestar', t.certificado_bienestar_vencimiento, !t.certificado_bienestar)}</div>
          ${t.desinsectacion_vencimiento ? `<div class="flex items-center gap-4" style="${this._colorVencimiento(t.desinsectacion_vencimiento)}">${Icons.calendar()} ${this._labelVencimiento('Desinsect.', t.desinsectacion_vencimiento)}</div>` : ''}
          ${t.condiciones_termoneutrales ? `<div class="flex items-center gap-4">${Icons.info()} Termoneutral</div>` : ''}
        </div>
      `,
      footerRight: `<div style="display: inline-block; font-size: 0.75rem; font-weight: 600; border: 1px solid var(--c-warning); color: var(--c-warning); background: rgba(255, 215, 0, 0.1); padding: 2px 6px; border-radius: 4px;">Ficha -></div>`,
      color: t.activo ? 'var(--c-success)' : '#6b7280',
      onClick: `TransportistasView._verDetalle(${t.id})`
    })).join('');

  },

  // ============================================
  // VISTA TABLA ERP (desktop)
  // ============================================

  _setVistaModo(modo, guardar = true) {
    this._vistaModo = modo;
    if (guardar) {
      try { localStorage.setItem('transportistas_view_mode', modo); } catch (_) {}
    }

    const btnCards = document.getElementById('btn-transp-vista-cards');
    const btnTabla = document.getElementById('btn-transp-vista-tabla');
    const contenedorCards = document.getElementById('transportistas-content');
    const contenedorTabla = document.getElementById('transportistas-erp-table-container');

    if (btnCards && btnTabla) {
      btnCards.style.background = modo === 'cards' ? 'var(--brand, #1F5FA8)' : 'transparent';
      btnTabla.style.background = modo === 'tabla' ? 'var(--brand, #1F5FA8)' : 'transparent';
    }

    if (modo === 'tabla') {
      if (contenedorCards) contenedorCards.style.display = 'none';
      if (contenedorTabla) {
        contenedorTabla.style.display = 'block';
        this._renderErpTable();
      }
    } else {
      if (contenedorTabla) contenedorTabla.style.display = 'none';
      if (contenedorCards) contenedorCards.style.display = 'block';
    }
  },

  _renderErpTable() {
    if (!window.ErpDataTable || !this._cachedData) return;

    const lista = this._cachedData.transportistas || [];
    const tableData = lista.map(t => ({
      id: t.id,
      nombre: t.nombre || '—',
      nif_cif: t.nif_cif || '—',
      matricula: t.matricula || '—',
      telefono: t.telefono || '—',
      vehiculo: this._labelTipoVehiculo(t.tipo_vehiculo),
      bienestar: this._labelVencimiento('Bienestar', t.certificado_bienestar_vencimiento, !t.certificado_bienestar),
      _bienestarColor: this._colorVencimiento(t.certificado_bienestar_vencimiento, !t.certificado_bienestar),
      estado: t.activo ? 'ACTIVO' : 'INACTIVO'
    }));

    new window.ErpDataTable({
      containerId: 'transportistas-erp-table-container',
      title: 'Transportistas',
      pageSize: 15,
      columns: [
        { key: 'nombre', label: 'Nombre', sortable: true, cellClass: 'erp-cell-id' },
        { key: 'nif_cif', label: 'NIF/CIF', sortable: true },
        { key: 'matricula', label: 'Matrícula', sortable: true },
        { key: 'telefono', label: 'Teléfono', sortable: false },
        { key: 'vehiculo', label: 'Vehículo', sortable: true },
        {
          key: 'bienestar',
          label: 'Cert. Bienestar',
          sortable: true,
          render: (val, row) => `<span style="${row._bienestarColor} font-weight:700;">${val}</span>`
        },
        {
          key: 'estado',
          label: 'Estado',
          sortable: true,
          render: (val) => `<span class="badge ${val === 'ACTIVO' ? 'badge-success' : 'badge-gray'}">${val}</span>`
        },
        {
          key: 'id',
          label: 'Ficha',
          sortable: false,
          align: 'center',
          render: (id) => `<button class="btn-erp-secondary btn-sm" onclick="TransportistasView._verDetalle(${id})">Ver Ficha</button>`
        }
      ],
      data: tableData
    }).render();
  },

  // Mantener todos los métodos existentes
  async _verDetalle(id) {
    const t = await Transportistas.get(id);
    if (!t) return;

    const resumen = await Transportistas.getResumen(id);
    const main = document.getElementById("app-content");

    main.innerHTML = `
      <div class="wizard-full-screen">
      <div class="wizard-header-fixed border-top-5-gold">
        <h1 class="wizard-header-title uppercase font-950 tracking-widest text-lg"><span style="color: var(--c-info); margin-right: 6px;">|</span> ${Icons.transportistas()} ${t.nombre}</h1>
      </div>
      <div class="wizard-content-scrollable p-20">
        <div class="card p-16 mb-14">
          <div class="flex justify-between items-start mb-16">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-8 mb-4">
                <span style="width:4px; height:20px; border-radius:2px; background:linear-gradient(135deg,var(--c-info),var(--c-info));"></span>
                <h2 class="m-0 font-900 text-white uppercase text-xl">${t.nombre}</h2>
              </div>
              <div class="flex gap-8 flex-wrap">
                <span class="badge badge-sm uppercase" style="background:${t.activo ? 'color-mix(in srgb, var(--c-success) 8%, transparent)' : 'color-mix(in srgb, var(--c-danger) 8%, transparent)'}; color:${t.activo ? 'var(--c-success)' : 'var(--c-danger)'}; border:1px solid ${t.activo ? 'color-mix(in srgb, var(--c-success) 21%, transparent)' : 'color-mix(in srgb, var(--c-danger) 21%, transparent)'};">
                  ${t.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-12 text-sm text-aaa">
            <div><small class="text-gray uppercase font-800 text-[0.65rem]">${Icons.documento()} NIF/CIF</small><div class="text-gold font-mono font-950 mt-2">${t.nif_cif || '-'}</div></div>
            <div><small class="text-gray uppercase font-800 text-[0.65rem]">${Icons.transportistas()} Matrícula</small><div class="text-gold font-mono font-950 mt-2">${t.matricula || '-'}</div></div>
            <div><small class="text-gray uppercase font-800 text-[0.65rem]">${Icons.info()} Teléfono</small><div class="text-white mt-2">${t.telefono || '-'}</div></div>
            <div><small class="text-gray uppercase font-800 text-[0.65rem]">${Icons.enlace()} Email</small><div class="text-white mt-2">${t.email || '-'}</div></div>
            <div><small class="text-gray uppercase font-800 text-[0.65rem]">${Icons.documento()} Registro Transporte</small><div class="text-white mt-2">${t.registro_transporte || '-'}</div></div>
            <div><small class="text-gray uppercase font-800 text-[0.65rem]">${Icons.transportistas()} Tipo Vehículo</small><div class="text-white mt-2">${this._labelTipoVehiculo(t.tipo_vehiculo)}</div></div>
            <div><small class="text-gray uppercase font-800 text-[0.65rem]">${Icons.animales()} Capacidad</small><div class="text-white mt-2">${t.capacidad_animales || 0} ${Number(t.capacidad_animales) === 1 ? 'animal' : 'animales'}</div></div>
          </div>
          <div class="mt-12 flex gap-8 flex-wrap">
            <span class="badge" style="padding:4px 10px; font-size:0.7rem; background:color-mix(in srgb, ${this._colorVencimiento(t.certificado_bienestar_vencimiento, !t.certificado_bienestar).replace('color:','').replace(';','')} 15%, transparent); ${this._colorVencimiento(t.certificado_bienestar_vencimiento, !t.certificado_bienestar)}">
              ${this._labelVencimiento('Cert. Bienestar', t.certificado_bienestar_vencimiento, !t.certificado_bienestar)}
            </span>
            <span class="badge" style="padding:4px 10px; font-size:0.7rem; background:${t.condiciones_termoneutrales ? 'rgba(204,255,0,0.15)' : 'rgba(107,114,128,0.15)'}; color:${t.condiciones_termoneutrales ? 'var(--c-success)' : '#9ca3af'};">
              ${t.condiciones_termoneutrales ? 'Termoneutral' : 'Sin control térmico'}
            </span>
          </div>
          ${t.notas ? `<div class="mt-10 p-10 text-gray text-sm rounded-sm bg-card">${t.notas}</div>` : ''}
          <div class="mt-10 p-10 rounded-sm bg-card">
            <div class="grid grid-cols-2 gap-8 text-sm">
              <div><span class="text-gray">Expediciones:</span> <span class="text-white font-bold">${resumen.total_expediciones}</span></div>
              <div><span class="text-gray">Peso vivo total:</span> <span class="text-white font-bold">${resumen.peso_vivo_total.toLocaleString()} kg</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="wizard-footer-fixed border-top-222">
        <button type="button" onclick="TransportistasView._eliminar(${t.id})" class="wizard-btn-action wizard-btn-danger">${Icons.eliminar()} Eliminar</button>
        <div class="wizard-footer-buttons">
          <button type="button" onclick="TransportistasView.render()" class="wizard-btn-action wizard-btn-secondary">${Icons.atras()} Volver</button>
          <button type="button" onclick="TransportistasView._abrirFormulario(${t.id})" class="wizard-btn-action wizard-btn-success">${Icons.editar()} Editar</button>
        </div>
      </div>
      </div>`;
  },

  async _abrirFormulario(id) {
    const t = id ? await Transportistas.get(id) : null;
    const isEdit = !!t;

    const overlay = document.createElement("div");
    overlay.className = "wizard-full-screen";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.backgroundColor = "rgba(0,0,0,0.85)";
    overlay.style.zIndex = "6000";

    overlay.innerHTML = `
      <div class="card-registro" style="width:100%; max-width:500px; max-height:90vh; overflow-y:auto; padding:20px; margin:16px; --registro-color: var(--c-pink);">
        <h3 class="mt-0 text-sm text-blue-400">${isEdit ? `${Icons.editar()} EDITAR TRANSPORTISTA` : `${Icons.agregar()} NUEVO TRANSPORTISTA`}</h3>

        <div class="wizard-input-group">
          <label class="wizard-label" for="tf-nombre">NOMBRE / RAZÓN SOCIAL <span class="text-red">*</span></label>
          <input type="text" id="tf-nombre" value="${t?.nombre || ''}" required class="wizard-input" placeholder="Ej: Transportes García S.L.">
        </div>
        <div class="wizard-input-group">
          <label class="wizard-label" for="tf-nif">NIF / CIF <span class="text-red">*</span></label>
          <input type="text" id="tf-nif" value="${t?.nif_cif || ''}" required class="wizard-input" placeholder="Ej: B12345678">
        </div>
        <div class="wizard-input-group">
          <label class="wizard-label" for="tf-matricula">MATRÍCULA VEHÍCULO</label>
          <input type="text" id="tf-matricula" value="${t?.matricula || ''}" class="wizard-input" placeholder="Ej: 1234ABC">
        </div>
        <div class="wizard-input-group">
          <label class="wizard-label" for="tf-registro">REGISTRO DE TRANSPORTE</label>
          <input type="text" id="tf-registro" value="${t?.registro_transporte || ''}" class="wizard-input" placeholder="Nº registro oficial...">
        </div>
        <div class="wizard-input-group">
          <label class="wizard-label" for="tf-atg">AUTORIZACIÓN TRANSPORTE GANADO (ATG) <span class="text-red">*</span></label>
          <input type="text" id="tf-atg" value="${t?.autorizacion_transporte_ganado || ''}" required class="wizard-input" placeholder="ATG-...">
        </div>
        <div class="grid grid-cols-2 gap-12">
          <div class="wizard-input-group">
            <label class="wizard-label" for="tf-desinsectacion">ÚLTIMA DESINSECTACIÓN</label>
            <input type="date" id="tf-desinsectacion" value="${t?.desinsectacion_ultima_fecha || ''}" class="wizard-input">
          </div>
          <div class="wizard-input-group">
            <label class="wizard-label" for="tf-desinsectacion-venc">VENCIMIENTO DESINSECTACIÓN</label>
            <input type="date" id="tf-desinsectacion-venc" value="${t?.desinsectacion_vencimiento || ''}" class="wizard-input">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-12">
          <div class="wizard-input-group">
            <label class="wizard-label" for="tf-telefono">TELÉFONO</label>
            <input type="tel" id="tf-telefono" value="${t?.telefono || ''}" class="wizard-input" placeholder="Teléfono...">
          </div>
          <div class="wizard-input-group">
            <label class="wizard-label" for="tf-email">EMAIL</label>
            <input type="email" id="tf-email" value="${t?.email || ''}" class="wizard-input" placeholder="Email...">
          </div>
        </div>
        <div class="wizard-input-group">
          <label class="wizard-label" for="tf-direccion">DIRECCIÓN</label>
          <input type="text" id="tf-direccion" value="${t?.direccion || ''}" class="wizard-input" placeholder="Dirección...">
        </div>
        <div class="grid" style="grid-template-columns:2fr 1fr 1fr; gap:12px;">
          <div class="wizard-input-group">
            <label class="wizard-label" for="tf-ciudad">CIUDAD</label>
            <input type="text" id="tf-ciudad" value="${t?.ciudad || ''}" class="wizard-input" placeholder="Ciudad...">
          </div>
          <div class="wizard-input-group">
            <label class="wizard-label" for="tf-cp">C.POSTAL</label>
            <input type="text" id="tf-cp" value="${t?.codigo_postal || ''}" class="wizard-input" placeholder="CP...">
          </div>
          <div class="wizard-input-group">
            <label class="wizard-label" for="tf-provincia">PROVINCIA</label>
            <input type="text" id="tf-provincia" value="${t?.provincia || ''}" class="wizard-input" placeholder="Prov...">
          </div>
        </div>
        <div class="wizard-input-group">
          <label class="wizard-label" for="tf-tipo-vehiculo">TIPO VEHÍCULO</label>
          <select id="tf-tipo-vehiculo" class="wizard-input">
            <option value="">Seleccionar...</option>
            <option value="camion" ${t?.tipo_vehiculo === 'camion' ? 'selected' : ''}>Camión</option>
            <option value="furgoneta" ${t?.tipo_vehiculo === 'furgoneta' ? 'selected' : ''}>Furgoneta</option>
            <option value="remolque" ${t?.tipo_vehiculo === 'remolque' ? 'selected' : ''}>Remolque</option>
            <option value="cisterna" ${t?.tipo_vehiculo === 'cisterna' ? 'selected' : ''}>Cisterna</option>
          </select>
        </div>
        <div class="wizard-input-group">
          <label class="wizard-label" for="tf-capacidad">CAPACIDAD (animales)</label>
          <input type="number" id="tf-capacidad" value="${t?.capacidad_animales || 0}" class="wizard-input" min="0">
        </div>
        <label class="wizard-checkbox-container mb-6">
          <input type="checkbox" id="tf-bienestar" ${t?.certificado_bienestar ? 'checked' : ''}>
          <span>Certificado de bienestar animal en transporte</span>
        </label>
        <div class="wizard-input-group">
          <label class="wizard-label" for="tf-bienestar-venc">VENCIMIENTO CERTIFICADO BIENESTAR</label>
          <input type="date" id="tf-bienestar-venc" value="${t?.certificado_bienestar_vencimiento || ''}" class="wizard-input">
        </div>
        <label class="wizard-checkbox-container mb-6">
          <input type="checkbox" id="tf-termoneutral" ${t?.condiciones_termoneutrales ? 'checked' : ''}>
          <span>Vehículo con condiciones termoneutrales</span>
        </label>
        <label class="wizard-checkbox-container mb-12">
          <input type="checkbox" id="tf-activo" ${t?.activo !== false ? 'checked' : ''}>
          <span>Activo</span>
        </label>
        <div class="wizard-input-group">
          <label class="wizard-label" for="tf-notas">NOTAS</label>
          <textarea id="tf-notas" class="wizard-input" style="min-height:50px; resize:none;" placeholder="Observaciones...">${t?.notas || ''}</textarea>
        </div>

        <div class="flex justify-between items-center mt-20">
          ${isEdit ? `<button type="button" onclick="TransportistasView._eliminar(${t.id}); App.clearExitGuard(); this.closest('.wizard-full-screen').remove();" class="wizard-btn-action wizard-btn-danger">${Icons.eliminar()} Eliminar</button>` : '<div></div>'}
          <div class="wizard-footer-buttons">
            <button type="button" class="wizard-btn-action wizard-btn-secondary" onclick="TransportistasView._cerrarFormulario(this)">${Icons.cerrar()} Cancelar</button>
            <button type="button" class="wizard-btn-action wizard-btn-success" id="btn-save-trans">${Icons.guardar()} Guardar</button>
          </div>
        </div>
        <div id="trans-form-error" class="text-red text-xs mt-8 d-none"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    TransportistasView._transportistaGuardado = false;
    App.setExitGuard(() => TransportistasView._confirmSalirFormulario());

    overlay.querySelector('#btn-save-trans').onclick = async () => {
      const errorDiv = overlay.querySelector('#trans-form-error');
      errorDiv.style.display = 'none';

      const data = {
        nombre: overlay.querySelector('#tf-nombre').value.trim(),
        nif_cif: overlay.querySelector('#tf-nif').value.trim(),
        matricula: overlay.querySelector('#tf-matricula').value.trim(),
        registro_transporte: overlay.querySelector('#tf-registro').value.trim(),
        autorizacion_transporte_ganado: overlay.querySelector('#tf-atg').value.trim(),
        desinsectacion_ultima_fecha: overlay.querySelector('#tf-desinsectacion').value,
        desinsectacion_vencimiento: overlay.querySelector('#tf-desinsectacion-venc').value,
        telefono: overlay.querySelector('#tf-telefono').value.trim(),
        email: overlay.querySelector('#tf-email').value.trim(),
        direccion: overlay.querySelector('#tf-direccion').value.trim(),
        ciudad: overlay.querySelector('#tf-ciudad').value.trim(),
        codigo_postal: overlay.querySelector('#tf-cp').value.trim(),
        provincia: overlay.querySelector('#tf-provincia').value.trim(),
        tipo_vehiculo: overlay.querySelector('#tf-tipo-vehiculo').value,
        capacidad_animales: parseInt(overlay.querySelector('#tf-capacidad').value) || 0,
        certificado_bienestar: overlay.querySelector('#tf-bienestar').checked,
        certificado_bienestar_vencimiento: overlay.querySelector('#tf-bienestar-venc').value,
        condiciones_termoneutrales: overlay.querySelector('#tf-termoneutral').checked,
        activo: overlay.querySelector('#tf-activo').checked,
        notas: overlay.querySelector('#tf-notas').value.trim(),
      };

      if (t) data.id = t.id;

      try {
        await Transportistas.save(data);
        TransportistasView._transportistaGuardado = true;
        App.clearExitGuard();
        App.toast(isEdit ? 'Transportista actualizado' : 'Transportista creado', 'success');
        overlay.remove();
        TransportistasView.render();
      } catch (e) {
        errorDiv.textContent = '' + e.message;
        errorDiv.style.display = 'block';
      }
    };
  },

  /** Guarda de salida compartida con el botón físico Android (ver App.setExitGuard). */
  async _confirmSalirFormulario() {
    if (this._transportistaGuardado) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _cerrarFormulario(btn) {
    if (!(await this._confirmSalirFormulario())) return;
    App.clearExitGuard();
    const overlay = btn.closest('.wizard-full-screen');
    if (overlay) overlay.remove();
  },

  async _eliminar(id) {
    if (!await Confirm.confirm("Eliminar Transportista", "¿Eliminar este transportista de forma permanente?", true)) return;
    try {
      await Transportistas.delete(id);
      App.toast('Transportista eliminado');
      this.render();
    } catch (e) {
      App.toastError(e.message);
    }
  }
};

window.TransportistasView = TransportistasView;