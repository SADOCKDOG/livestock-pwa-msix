/**
 * Livestock Manager - AlbaranesVentasView v3.0.0
 * Historial integrado de albaranes de leche y registros de ventas de carne para todos los tipos de explotación.
 * Soporta re-impresión de albaranes y edición de borradores.
 */

const AlbaranesVentasView = {
  _currentTab: 'todos',
  _filtroActivo: {
    texto: '',
    tipo: ''
  },
  async render() {
    if (window.App) App.updateHeaderColor('albaranes-ventas');
    const main = document.getElementById("app-content");
    main.innerHTML = `<div class="loader">Cargando albaranes y ventas...</div>`;

    try {
      const fincaId = await window.Fincas.getActiveId();
      if (!fincaId) return App.toastError("No hay finca activa");

      const ventasCarne = await window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId)).catch(() => []);
      const ventasLeche = await window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId)).catch(() => []);

      // Normalizar registros de carne
      const carneNormalizados = ventasCarne.map(v => ({
        id: v.id,
        tipo: 'carne',
        titulo: `Venta de Animales`,
        comprador: v.razonSocial || 'Comprador Desconocido',
        fecha: v.fecha || v.fechaSacrificio || v.creadoEn,
        cantidad: v.num_animales || (v.animalId ? v.animalId.length : 1),
        unidad: 'cabezas',
        importe: v.importe_total || (v.precio_total || 0),
        estado: v.estado_tramite || 'presentado',
        numero: v.numero_albaran || `ALB-C-${v.id}`,
        dataRaw: v,
        trazabilidad: 'Albarán'
      }));

      // Normalizar registros de leche
      const lecheNormalizados = ventasLeche.map(v => ({
        id: v.id,
        tipo: 'leche',
        titulo: `Entrega de Leche`,
        comprador: v.comprador_nombre || 'Compradora Láctea',
        fecha: v.fechaRecogida || v.creadoEn,
        cantidad: v.cantidad,
        unidad: 'litros',
        importe: v.importe_total || 0,
        estado: v.estado_tramite_infolac || 'borrador',
        numero: v.numero_infolac || `ALB-L-${v.id}`,
        dataRaw: v,
        trazabilidad: 'Albarán INFOLAC'
      }));

      // Unificar listado
      const todosRegistros = [...carneNormalizados, ...lecheNormalizados];

      // Ordenar por fecha descendente
      todosRegistros.sort((a, b) => {
        const fa = a.fecha || '';
        const fb = b.fecha || '';
        return fb.localeCompare(fa);
      });

      // Guardar datos brutos para filtrado
      this._cachedDataRaw = todosRegistros;

      // Aplicar filtros iniciales
      const filteredData = this._aplicarFiltrosToData(this._cachedDataRaw);
      this._cachedData = filteredData;

      main.innerHTML = this._renderHTML(filteredData);
    } catch (e) {
      console.error('[AlbaranesVentasView] Error:', e);
      main.innerHTML = `<div class="card text-center p-40 text-red" style="border: 1px solid var(--c-danger); background: rgba(255, 68, 68, 0.05);">Error: ${e.message}</div>`;
    }
  },

  _aplicarFiltrosToData(data) {
    // Aplicar filtros a los datos
    let filteredData = [...data];

    // Filtrar por tipo de registro
    if (this._filtroActivo.tipo) {
      filteredData = data.filter(r => r.tipo === this._filtroActivo.tipo);
    }

    // Filtrar por texto de búsqueda
    if (this._filtroActivo.texto.trim()) {
      const q = this._filtroActivo.texto.toLowerCase();
      filteredData = data.filter(r =>
        r.comprador.toLowerCase().includes(q) ||
        r.numero.toLowerCase().includes(q) ||
        r.titulo.toLowerCase().includes(q) ||
        (r.dataRaw.razonSocial || '').toLowerCase().includes(q) ||
        (r.dataRaw.comprador_nombre || '').toLowerCase().includes(q)
      );
    }

    return filteredData;
  },

  _setFiltro(type, value) {
    this._filtroActivo[type] = value;
    this._aplicarFiltros();
  },

  _aplicarFiltros() {
    if (!this._cachedDataRaw) return;
    const filteredData = this._aplicarFiltrosToData(this._cachedDataRaw);
    this._cachedData = filteredData;
    this._renderLista();
  },

  _renderHTML(registros) {
    const moduleColor = window.getModuleColor ? getModuleColor('/comercializacion') : '#C5FA50';
    const totalVentas = registros.length;
    const totalLeche = registros.filter(r => r.tipo === 'leche').reduce((acc, r) => acc + (r.importe || 0), 0);
    const totalCarne = registros.filter(r => r.tipo === 'carne').reduce((acc, r) => acc + (r.importe || 0), 0);
    const totalImporte = totalLeche + totalCarne;

    // Resumen mensual (últimos 6 meses) - basado en fechas de ventas
    const hoy = new Date();
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const porMes = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      porMes[key] = { label: meses[d.getMonth()] + ' ' + d.getFullYear(), total: 0 };
    }
    // Contar registros por mes
    registros.forEach(r => {
      const fechaStr = r.fecha;
      if (fechaStr) {
        const key = fechaStr.substring(0, 7); // YYYY-MM
        if (porMes[key]) porMes[key].total++;
      }
    });
    const mesesHtml = Object.values(porMes).reverse().map(m => {
      const max = Math.max(1, ...Object.values(porMes).map(m => m.total));
      const pct = Math.max(0, Math.min(100, (m.total / max) * 100));
      const color = pct > 70 ? 'var(--c-danger)' : pct > 40 ? 'var(--c-warning)' : 'var(--c-success)';
      return `<div class="flex-1 text-center min-w-0">
        <div class="text-xs text-gray mb-2" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.label}</div>
        <div class="albaran-bar-wrap">
          <div style="position:absolute;bottom:0;width:100%;height:${pct}%;background:${color};border-radius:6px;opacity:0.8;transition:height 0.3s;"></div>
        </div>
        <div class="text-xs font-bold mt-2" style="color:${color};">${m.total}</div>
      </div>`;
    }).join('');

    return `
      <!-- Cabecera de Sección Estandarizada -->
      <div class="flex items-center gap-12 mb-14">
        <span class="text-2xl" style="color:${moduleColor}; display:inline-flex; align-items:center;">${Icons.comercial()}</span>
        <div>
          <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin:0; line-height:1.2;">
            <span style="color:${moduleColor}; margin-right:4px;">|</span> COMERCIALIZACIÓN
          </h1>
          <div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
            Albaranes, Ventas y Entregas
          </div>
        </div>
      </div>

      <!-- Evolución Mensual (Estandarizada como Card de Fondo OLED sin bordes de color) -->
      <div class="card mb-14 p-12 card-resumen" style="background:rgba(204,255,0,0.015); width:100%;">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex justify-between items-center" style="border-bottom:none; padding-bottom:0; margin-bottom:12px;">
          <span><span style="color: ${moduleColor}; margin-right:4px;">|</span> EVOLUCIÓN MENSUAL (ÚLTIMOS 6 MESES)</span>
          <span class="text-xs text-gray font-bold lowercase" style="font-variant: normal;">(${registros.length} total)</span>
        </div>
        <div class="flex gap-6">${mesesHtml}</div>
      </div>

      <!-- Balance Consolidado (Estandarizado en Card de Fondo OLED sin bordes de color) -->
      <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(204,255,0,0.015); width:100%;">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center gap-6" style="border-bottom:none; padding-bottom:0; margin-bottom:12px;">
          <span style="color: ${moduleColor}; margin-right:4px;">|</span> ${Icons.comercial()} RESUMEN DE ALBARANES Y VENTAS
        </div>
        <div class="flex flex-col">
          <div class="py-8 flex justify-between items-center border-bottom-222">
            <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.documento()} Total Registros</span>
            <strong class="text-xl font-950" style="color: ${moduleColor};">${registros.length}</strong>
          </div>
          <div class="py-8 flex justify-between items-center border-bottom-222">
            <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.dinero()} Facturación Total</span>
            <strong class="text-xl font-950 text-green">${totalImporte.toLocaleString()} €</strong>
          </div>
          <div class="py-8 flex justify-between items-center border-bottom-222">
            <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.leche()} Ventas Leche</span>
            <strong class="text-xl font-950" style="color: #4FADF5;">${totalLeche.toLocaleString()} €</strong>
          </div>
          <div class="py-8 flex justify-between items-center">
            <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.carne()} Ventas Carne</span>
            <strong class="text-xl font-950 text-red">${totalCarne.toLocaleString()} €</strong>
          </div>
        </div>
      </div>

      <!-- Filtro de búsqueda integrado (controla el listado) -->
      <div class="text-xs text-white uppercase font-black tracking-wider mb-10 flex items-center gap-4">
        <span style="color: ${moduleColor};">|</span> ${Icons.documento()} HISTORIAL DE ALBARANES Y VENTAS
      </div>
      <div class="flex gap-8 items-center mb-12">
        <div class="relative flex-1 min-w-0">
          <input type="search" id="albaran-search" placeholder="Buscar por comprador, número de albarán, concepto..."
                 oninput="AlbaranesVentasView._setFiltro('texto', this.value)"
                 class="form-input search-input w-full" style="margin-top:0;">
        </div>
        <select id="albaran-filtro-tipo" class="form-select"
                onchange="AlbaranesVentasView._setFiltro('tipo', this.value)"
                style="width:130px; min-width:110px; flex-shrink:0;">
          <option value="">Todos los tipos</option>
          <option value="leche" ${this._filtroActivo.tipo === 'leche' ? 'selected' : ''}>Entregas Leche</option>
          <option value="carne" ${this._filtroActivo.tipo === 'carne' ? 'selected' : ''}>Ventas Carne</option>
        </select>
      </div>

      <!-- Tabs de comercialización estandarizados -->
      <div class="mb-14">
        <div class="scroll-shadow-container scroll-tabs-row mb-10">
          <div class="comer-tabs">
            <button class="comer-tab ${this._currentTab === 'todos' ? 'active' : ''}" data-tab="todos" onclick="AlbaranesVentasView._cambiarTab('todos')">${Icons.comercial()} Todo</button>
            <button class="comer-tab ${this._currentTab === 'leche' ? 'active' : ''}" data-tab="leche" onclick="AlbaranesVentasView._cambiarTab('leche')">${Icons.leche()} Leche</button>
            <button class="comer-tab ${this._currentTab === 'carne' ? 'active' : ''}" data-tab="carne" onclick="AlbaranesVentasView._cambiarTab('carne')">${Icons.carne()} Carne</button>
          </div>
        </div>
      </div>
      <div id="albaranes-lista"><div class="loader">Cargando albaranes y ventas...</div></div>;

      <!-- FAB -->
      <div class="fixed bottom-20 right-20 z-50">
        <button class="btn-fab-primary" onclick="AlbaranesVentasView._abrirMenuNuevo()">
          ${Icons.agregar()}
        </button>
      </div>
    `;
  },

  _renderLista() {
    const filtrados = this._currentTab === 'todos'
      ? this._cachedData
      : this._cachedData.filter(r => r.tipo === this._currentTab);

    if (!filtrados.length) {
      document.getElementById('albaranes-lista').innerHTML = `<div class="empty-state"><div class="empty-state-icon">${Icons.comercial()}</div><p class="empty-state-text">No hay registros de albaranes o ventas.</p></div>`;
      return;
    }

    const colors = { leche: 'var(--c-info)', carne: 'var(--c-success)' };
    const badgeColors = {
      borrador: 'var(--c-warning)',
      presentado: 'var(--c-success)',
      validado: 'var(--c-info)',
      rechazado: 'var(--c-danger)'
    };

    document.getElementById('albaranes-lista').innerHTML = `<div class="grid gap-10">
      ${filtrados.map(reg => {
        const color = colors[reg.tipo] || 'var(--c-info)';
        const badgeColor = badgeColors[reg.estado] || 'var(--c-info)';
        const fecha = this._fmtFecha(reg.fecha);
        const esBorrador = reg.estado === 'borrador';

        return App._cardRegistro({
          title: reg.numero,
          icon: reg.tipo === 'leche' ? Icons.leche() : Icons.carne(),
          subtitle: `${reg.titulo} · ${reg.comprador}`,
          color: color,
          rightSide: `
            <div class="text-right">
              <span class="badge badge-sm uppercase" style="background:color-mix(in srgb, ${badgeColor} 8%, transparent); color:${badgeColor}; border:1px solid color-mix(in srgb, ${badgeColor} 21%, transparent);">
                ${reg.estado}
              </span>
            </div>
          `,
          content: `
            <div class="flex flex-wrap gap-x-12 gap-y-3 text-[0.62rem] text-aaa font-800 uppercase mt-4">
              <div class="flex items-center gap-4">${Icons.calendar()} ${fecha}</div>
              <div class="flex items-center gap-4">${Icons.paquete()} ${reg.cantidad.toLocaleString()} ${reg.unidad}</div>
              <div class="flex items-center gap-4 text-green font-950">${reg.importe.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
            </div>
          `,
          footerLeft: esBorrador ? `
            <button class="btn btn-sm btn-success text-xs mt-6" onclick="AlbaranesVentasView._editarBorrador('${reg.tipo}', ${reg.id}); event.stopPropagation();">${Icons.editar()} Editar</button>
          ` : `
            <button class="btn btn-sm btn-outline text-xs mt-6" onclick="AlbaranesVentasView._imprimirDoc('${reg.tipo}', ${reg.id}); event.stopPropagation();">${Icons.exportar()} Imprimir</button>
          `,
          footerRight: `
            <span style="display: inline-block; font-size: 0.75rem; font-weight: 600; border: 1px solid var(--c-warning); color: var(--c-warning); background: rgba(255, 215, 0, 0.1); padding: 2px 6px; border-radius: 4px;">Ficha -></span>
          `,
          onClick: `AlbaranesVentasView._verDetalle(${reg.id}, '${reg.tipo}')`
        });
      }).join('')}
    </div>`;
  },

  _cambiarTab(tab) {
    this._currentTab = tab;
    document.querySelectorAll('.albaranes-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    this._renderLista();
    window.scrollTo(0, 0);
  },

  _fmtFecha(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-ES');
    } catch { return dateStr; }
  },

  // FAB Actions
  _abrirMenuNuevo() {
    const overlay = document.createElement("div");
    overlay.className = "wizard-full-screen";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.backgroundColor = "rgba(0,0,0,0.8)";
    overlay.innerHTML = `
      <div class="card p-25" style="max-width:380px; width:100%; border: 1px solid var(--c-info); background: #1e1e1e;">
        <h3 class="mt-0 text-white font-900 flex items-center gap-8"><span style="color: var(--c-info); margin-right: 4px;">|</span> ${Icons.agregar()} NUEVO ALBARÁN O VENTA</h3>
        <label class="wizard-label mb-10">Selecciona el tipo de documento a generar:</label>
        <div class="wizard-input-group">
          <select id="av-tipo-doc" class="wizard-input wizard-select mb-15">
            <option value="leche">Entrega de Leche (Albarán)</option>
            <option value="carne">Venta de Animales (Albarán)</option>
          </select>
        </div>
        <div class="flex gap-10">
          <button class="wizard-btn-action wizard-btn-primary flex-1" id="btn-av-next">Crear ${Icons.siguiente()}</button>
          <button class="wizard-btn-action wizard-btn-secondary" onclick="this.closest('.wizard-full-screen').remove()">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-av-next').onclick = async () => {
      const tipo = overlay.querySelector('#av-tipo-doc').value;
      overlay.remove();

      if (tipo === 'leche') {
        await window.AlbaranLecheWizard.abrir();
      } else {
        await window.VentaMasivaWizard.abrir();
      }

      setTimeout(() => AlbaranesVentasView.render(), 1000);
    };
  },

  async _editarBorrador(tipo, id) {
    try {
      const reg = await window.db.get(tipo === 'leche' ? 'comercializacion_leche' : 'comercializacion_carne', Number(id));
      if (!reg) return App.toastError("Registro no encontrado");

      if (tipo === 'leche') {
        await window.AlbaranLecheWizard.open(reg);
      } else {
        await window.VentaMasivaWizard.open(reg);
      }
    } catch (e) {
      App.toastError("Error al abrir borrador: " + e.message);
    }
  },

  async _imprimirDoc(tipo, id) {
    try {
      const reg = await window.db.get(tipo === 'leche' ? 'comercializacion_leche' : 'comercializacion_carne', Number(id));
      if (!reg) return App.toastError("Registro no encontrado");

      const est = await window.Trazabilidad.generarEstructuraAlbaran(window.db, reg, tipo);
      await App.imprimirAlbaran(est, tipo);
    } catch (e) {
      App.toastError("Error al imprimir: " + e.message);
    }
  },

  async _verDetalle(id, tipo) {
    try {
      const reg = await window.db.get(tipo === 'leche' ? 'comercializacion_leche' : 'comercializacion_carne', Number(id));
      if (!reg) return App.toastError("Registro no encontrado");

      const colors = { leche: 'var(--c-warning)', carne: 'var(--c-warning)' };
      const color = colors[tipo] || '#666';
      const overlay = document.createElement('div');
      overlay.className = 'wizard-full-screen';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

      let detalleHtml = '';
      if (tipo === 'leche') {
        detalleHtml = `
          <div><span class="text-gray">Litros:</span> <span class="text-white">${reg.cantidad.toLocaleString()} L</span></div>
          <div><span class="text-gray">Temperatura:</span> <span class="text-white">${reg.temperatura} °C</span></div>
          <div><span class="text-gray">Grasa:</span> <span class="text-white">${reg.laboratorio?.grasa || 0} %</span></div>
          <div><span class="text-gray">Proteína:</span> <span class="text-white">${reg.laboratorio?.proteina || 0} %</span></div>
          <div><span class="text-gray">Cél. Somáticas:</span> <span class="text-white">${((reg.laboratorio?.somaticas || 0) / 1000).toFixed(0)}k cél/mL</span></div>
          <div><span class="text-gray">Bacterias:</span> <span class="text-white">${((reg.laboratorio?.germenes || 0) / 1000).toFixed(0)}k UFC/mL</span></div>
          <div><span class="text-gray">Inhibidores/Antibi.:</span> <span class="text-white" style="color:${reg.antibioticos ? 'var(--c-danger)' : 'var(--c-success)'};">${reg.antibioticos ? 'POSITIVO' : 'NEGATIVO'}</span></div>
          <div><span class="text-gray">Cisterna:</span> <span class="text-white">${reg.matriculaCisterna || '—'}</span></div>
        `;
      } else {
        detalleHtml = `
          <div><span class="text-gray">Nº Animales:</span> <span class="text-white">${reg.num_animales || 1}</span></div>
          <div><span class="text-gray">Matadero:</span> <span class="text-white">${reg.codigoMatadero || '—'}</span></div>
          <div><span class="text-gray">ICA:</span> <span class="text-white">${reg.codigoDocumento_ICA || '—'}</span></div>
          <div><span class="text-gray">Guía:</span> <span class="text-white">${reg.numero_Guia_Sanitaria || '—'}</span></div>
          <div><span class="text-gray">IVA / Ret.:</span> <span class="text-white">${reg.IVA || 0}% / ${reg.retencionREAGP || 0}%</span></div>
          <div><span class="text-gray">Transportista:</span> <span class="text-white">${reg.nombreTransportista || '—'} (${reg.matriculaTransportista || '—'})</span></div>
        `;
      }

      overlay.innerHTML = `
        <div class="card" style="border: 1px solid var(--c-info); background: #1e1e1e; max-width:550px;width:100%;padding:24px;">
          <div class="flex justify-between items-center mb-14">
            <div>
              <div class="font-800 text-sm" style="color:${color};"><span style="color: var(--c-info); margin-right: 4px;">|</span> ${tipo === 'leche' ? 'ENTREGA DE LECHE' : 'VENTA DE ANIMALES'}</div>
              <div class="font-900 text-white text-lg">${reg.numero_albaran || reg.numero_infolac || `Registro #${reg.id}`}</div>
            </div>
            <button onclick="this.closest('[style]').remove()" style="background:none;border:none;color:#888;font-size:1.4rem;cursor:pointer;">${Icons.cerrar()}</button>
          </div>
          <div class="grid grid-cols-2 gap-8 text-sm mb-14">
            <div><span class="text-gray">Fecha:</span> <span class="text-white">${this._fmtFecha(reg.fechaRecogida || reg.fecha || reg.creadoEn)}</span></div>
            <div><span class="text-gray">Importe Total:</span> <span class="text-green font-900">${(reg.importe_total || reg.precio_total || 0).toFixed(2)} €</span></div>
            ${detalleHtml}
          </div>
          <div class="mt-10 text-center" style="display:flex; gap:10px; justify-content:center;">
            <button class="btn btn-secondary btn-sm" onclick="this.closest('[style]').remove()">Cerrar</button>
            ${reg.estado_tramite_infolac === 'borrador' || reg.estado === 'borrador' ? `
              <button class="btn btn-primary btn-sm" onclick="AlbaranesVentasView._editarBorrador('${tipo}', ${reg.id}); this.closest('[style]').remove();">${Icons.editar()} Editar</button>
            ` : `
              <button class="btn btn-primary btn-sm" onclick="AlbaranesVentasView._imprimirDoc('${tipo}', ${reg.id}); this.closest('[style]').remove();">${Icons.exportar()} Imprimir</button>
            `}
          </div>
        </div>`;
      document.body.appendChild(overlay);
    } catch (e) {
      App.toastError("Error al ver detalle: " + e.message);
    }
  }
};

window.AlbaranesVentasView = AlbaranesVentasView;