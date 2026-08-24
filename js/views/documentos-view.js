/**
 * Livestock Manager - DocumentosView v1.1.0
 * Vista de documentos legales: DIMOE, facturas, certificados, DIB y Pedidos de Crotales.
 * Soporta re-impresión de PDFs y edición de borradores.
 */

const DocumentosView = {
  _currentTab: 'todos',

  async render() {
    const main = document.getElementById("app-content");
    main.innerHTML = `<div class="loader">Cargando documentos...</div>`;

    try {
      const finca = await window.Fincas.getActive();
      let docs = await window.db.getAll('documentos_legales').catch(() => []);
      let pedidos = await window.db.getAll('pedidos_crotales').catch(() => []);
      let movimientos = await window.db.getAll('movimientos_ganado').catch(() => []);
      let ventas = await window.db.getAll('comercializacion_carne').catch(() => []);

      // Auto-siembra inteligente de traslados/DIMOEs para la demo CHAMORRO si faltan las guías de prueba
      const tieneGuia1 = movimientos.some(m => m.numero_guia === 'GS-2025-0451');
      const tieneGuia2 = movimientos.some(m => m.numero_guia === 'GS-2026-0922');

      if (finca && (finca.demo || (finca.nombre && finca.nombre.includes('CHAMORRO'))) && (!tieneGuia1 || !tieneGuia2)) {
        const fechaSacrificio = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        if (!tieneGuia1) {
          // Guía DIMOE Oficial Autorizada (GS-2025-0451)
          await window.db.put('movimientos_ganado', {
            id: 9901,
            demo: true,
            fincaId: finca.id,
            tipo: 'salida',
            numero_guia: 'GS-2025-0451',
            rega_origen: finca.rega || 'ES210050001234',
            rega_destino: 'ES10.05/M',
            explotacion_contraparte: 'Cárnicas Extremeñas SL',
            motivo: 'sacrificio',
            especie: 'Vacas',
            num_animales: 1,
            crotales: ['ES123456789016'],
            tipo_operador_destino: 'matadero',
            transportista_nombre: 'Transportes Ganaderos del Sur SL',
            matricula: '1234BCD',
            fecha: fechaSacrificio,
            desinsectacion_certificada: true,
            desinfeccion_numero_talon: 'DES-89012',
            desinfeccion_fecha: fechaSacrificio,
            veterinario_autorizante: 'Dr. Manuel Castillo',
            estado_tramite: 'presentado',
            fecha_presentacion: fechaSacrificio,
            numero_registro_oficial: 'REG-OFF-8472',
            acuse_recibo: 'OK-RECEP-3921',
            creadoEn: new Date().toISOString()
          }).catch(err => console.error("Error al auto-sembrar GS-2025-0451:", err));
        }

        if (!tieneGuia2) {
          // Guía DIMOE Oficial Borrador (GS-2026-0922)
          await window.db.put('movimientos_ganado', {
            id: 9902,
            demo: true,
            fincaId: finca.id,
            tipo: 'salida',
            numero_guia: 'GS-2026-0922',
            rega_origen: finca.rega || 'ES210050001234',
            rega_destino: 'ES410020004921',
            explotacion_contraparte: 'Finca Los Helechos (Sevilla)',
            motivo: 'pastoreo',
            especie: 'Ovejas',
            num_animales: 3,
            crotales: ['ES654321098765', 'ES654321098766', 'ES654321098767'],
            tipo_operador_destino: 'explotacion',
            transportista_nombre: 'Transportes Ganaderos del Sur SL',
            matricula: '1234BCD',
            fecha: new Date().toISOString().split('T')[0],
            desinsectacion_certificada: true,
            desinfeccion_numero_talon: 'DES-90211',
            desinfeccion_fecha: new Date().toISOString().split('T')[0],
            veterinario_autorizante: 'Dr. Manuel Castillo',
            estado_tramite: 'borrador',
            creadoEn: new Date().toISOString()
          }).catch(err => console.error("Error al auto-sembrar GS-2026-0922:", err));
        }

        // Refrescar lista de movimientos tras la inyección exitosa
        movimientos = await window.db.getAll('movimientos_ganado').catch(() => []);
      }

      const ventaMap = {};
      ventas.forEach(v => { ventaMap[v.id] = v; });

      let ventasLeche = await window.db.getAll('comercializacion_leche').catch(() => []);
      let contratos = await window.db.getAll('contratos_compra').catch(() => []);

      // Normalizar pedidos de crotales
      const pedidosNormalizados = pedidos.map(p => ({
        id: p.id,
        tipo: 'crotales',
        numero: p.numero_seguimiento || `PED-${p.id}`,
        fecha: p.fecha_pedido || p.createdAt,
        createdAt: p.fecha_pedido || p.createdAt,
        estado: p.estado || 'borrador',
        acuseManual: p.acuse_manual || p.acuseManual || '',
        isPedidoCrotales: true,
        dataRaw: p
      }));

      // Normalizar movimientos de ganado a DIMOE
      const movimientosNormalizados = movimientos.map(m => ({
        id: m.id,
        tipo: 'dimoe',
        numero: m.numero_guia || 'Borrador',
        fecha: m.fecha || m.creadoEn,
        createdAt: m.creadoEn || m.fecha,
        estado: m.estado_tramite || 'borrador',
        acuseManual: m.acuse_manual || m.acuseManual || '',
        isMovimiento: true,
        dataRaw: m
      }));

      // Normalizar Albaranes de Carne
      const ventasCarneNormalizadas = ventas.map(v => ({
        id: v.id,
        tipo: 'albaran_carne',
        numero: v.numero_albaran || `ALB-C-${v.id}`,
        fecha: v.fecha || v.fechaSacrificio || v.creadoEn,
        createdAt: v.creadoEn || v.fecha || v.fechaSacrificio,
        estado: v.estado_tramite || 'presentado',
        acuseManual: v.acuse_manual || '',
        isAlbaranCarne: true,
        dataRaw: v
      }));

      // Normalizar Albaranes de Leche
      const ventasLecheNormalizadas = ventasLeche.map(v => ({
        id: v.id,
        tipo: 'albaran_leche',
        numero: v.numero_infolac || `ALB-L-${v.id}`,
        fecha: v.fechaRecogida || v.creadoEn,
        createdAt: v.creadoEn || v.fechaRecogida,
        estado: v.estado_tramite_infolac || 'borrador',
        acuseManual: v.acuse_manual || '',
        isAlbaranLeche: true,
        dataRaw: v
      }));

      // Normalizar Contratos
      const contratosNormalizados = contratos.map(c => ({
        id: c.id,
        tipo: 'contrato',
        numero: c.numero_contrato || `CT-${c.id}`,
        fecha: c.fecha_inicio || c.creadoEn,
        createdAt: c.creadoEn || c.fecha_inicio,
        estado: c.activo !== false ? 'activo' : 'inactivo',
        acuseManual: c.acuse_manual || '',
        isContrato: true,
        dataRaw: c
      }));

      // Unificar todos los documentos
      const docsNormalizados = docs
        .filter(d => d.tipo !== 'guia_movimiento' && d.tipo !== 'infolac_declaracion')
        .map(d => ({
          id: d.id,
          tipo: d.tipo || 'documento',
          numero: d.numero || d.referencia || 'S/N',
          fecha: d.fecha_emision || d.fecha || d.created_at,
          createdAt: d.created_at || d.fecha_emision || d.fecha,
          estado: d.estado_tramite || d.estado || 'presentado',
          acuseManual: d.acuse_manual || d.acuseManual || '',
          dataRaw: d
        }));

      const docsUnificados = [
        ...docsNormalizados,
        ...pedidosNormalizados,
        ...movimientosNormalizados,
        ...ventasCarneNormalizadas,
        ...ventasLecheNormalizadas,
        ...contratosNormalizados
      ];

      // Ordenar por fecha descendente
      docsUnificados.sort((a, b) => {
        const fa = a.createdAt || a.fecha || '';
        const fb = b.createdAt || b.fecha || '';
        return fb.localeCompare(fa);
      });

      this._cachedDocs = docsUnificados;
      this._ventaMap = ventaMap;

      main.innerHTML = this._renderHTML(docsUnificados, ventaMap);
      this._setupFilters();

      // Restaurar modo de vista (por defecto "tabla" en escritorio ≥ 1024px)
      const modoGuardado = localStorage.getItem('documentos_view_mode') || 'tabla';
      this._setVistaModo(modoGuardado, false);
    } catch (e) {
      console.error('[Documentos] Error:', e);
      main.innerHTML = `<div class="card text-center p-40 text-red" style="border: 1px solid var(--c-danger); background: rgba(255, 68, 68, 0.05);">Error: ${e.message}</div>`;
    }
  },

  _renderHTML(docs, ventaMap) {
    const tiposDoc = ['todos', 'dimoe', 'factura', 'certificado', 'dib', 'crotales'];
    const labels = { 
      todos: `${Icons.documento()} Todos`, 
      dimoe: `${Icons.exportar()} DIMOE`, 
      factura: `${Icons.libroVentas()} Facturas`, 
      certificado: `${Icons.contratos()} Certificados`, 
      dib: `${Icons.informeRega()} DIB`,
      crotales: `${Icons.animales()} Crotales`
    };
    
    const porTipo = {};
    docs.forEach(d => { porTipo[d.tipo] = (porTipo[d.tipo] || 0) + 1; });

    const totalComercial = (porTipo.albaran_carne || 0) + (porTipo.albaran_leche || 0);

    const docsRecientes = docs.slice(0, 5);

    const bannerInterno = `
      <div class="card p-12 mb-14 card-resumen" style="background: rgba(255, 214, 0, 0.015); border-left: none;"> 
        <div class="section-header-theme" style="--theme-color: var(--c-warning);"><span style="color: var(--c-warning); margin-right:4px;">|</span> ${Icons.alerta()} MODO INTERNO SIGGAN</div>
        <p class="text-xs text-aaa mt-6">
          Genera la documentación desde Livestock Manager y sube los ficheros a SIGGAN/BADIGEX de forma manual. Registra aquí el número de acuse o el justificante recibido para mantener la trazabilidad interna.
        </p>
      </div>`;

    return `
      ${bannerInterno}
      <div class="card p-12 mb-14 border-222 card-resumen" style="background: rgba(168,85,247,0.015); width:100%;">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center gap-6"><span style="color: var(--c-info); margin-right:4px;">|</span> ${Icons.documento()} DOCUMENTOS</div>
        <div class="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
          <div class="bg-dark rounded-lg p-6 text-center border border-222">
            <div class="text-[0.5rem] text-gray uppercase font-800 tracking-wider">TOTAL</div>
            <div class="text-base font-black text-blue">${docs.length}</div>
          </div>
          <div class="bg-dark rounded-lg p-6 text-center border border-222">
            <div class="text-[0.5rem] text-gray uppercase font-800 tracking-wider">GUÍAS</div>
            <div class="text-base font-black text-green">${porTipo.dimoe || 0}</div>
          </div>
          <div class="bg-dark rounded-lg p-6 text-center border border-222">
            <div class="text-[0.5rem] text-gray uppercase font-800 tracking-wider">COMERCIAL</div>
            <div class="text-base font-black text-amber">${totalComercial}</div>
          </div>
          <div class="bg-dark rounded-lg p-6 text-center border border-222">
            <div class="text-[0.5rem] text-gray uppercase font-800 tracking-wider">DIB/REGA</div>
            <div class="text-base font-black text-purple">${porTipo.dib || 0}</div>
          </div>
          <div class="bg-dark rounded-lg p-6 text-center border border-222">
            <div class="text-[0.5rem] text-gray uppercase font-800 tracking-wider">CROTALES</div>
            <div class="text-base font-black text-gold">${porTipo.crotales || 0}</div>
          </div>
          <div class="bg-dark rounded-lg p-6 text-center border border-222">
            <div class="text-[0.5rem] text-gray uppercase font-800 tracking-wider">CONTRATOS</div>
            <div class="text-base font-black text-info" style="color:var(--c-info);">${porTipo.contrato || 0}</div>
          </div>
        </div>
      </div>

      <div class="card p-16" style="border: 1px solid #27272a; background: #1E1E1E; width:100%;">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-12 flex items-center gap-6" style="justify-content: space-between;">
          <span class="flex items-center gap-6"><span style="color: var(--c-info); margin-right: 4px;">|</span> ${Icons.documento()} REGISTRO DOCUMENTAL</span>
          <div class="flex gap-4">
            <button class="btn-erp-secondary btn-sm" id="btn-docs-vista-cards" onclick="DocumentosView._setVistaModo('cards')">Tarjetas</button>
            <button class="btn-erp-secondary btn-sm" id="btn-docs-vista-tabla" onclick="DocumentosView._setVistaModo('tabla')">Tabla ERP</button>
          </div>
        </div>
        <fieldset class="erp-action-group">
          <legend>Acciones de Registro</legend>
          <div class="erp-action-group-body">
            <button class="widget-link-btn widget-link-btn--neon neon-warning" onclick="DocumentosView._abrirAsistenteConsulta()">
              ${Icons.buscar()}
              <span class="widget-link-label">Consultar / Imprimir</span>
            </button>
            <button class="widget-link-btn widget-link-btn--neon neon-success" onclick="DocumentosView._exportDocs()">
              ${Icons.exportar()}
              <span class="widget-link-label">Exportar Todo</span>
            </button>
          </div>
        </fieldset>
        <div class="erp-filtros" data-filtros-para="docs-lista">
          <input type="search" class="form-input search-input" placeholder="Buscar documento por tipo, número o fecha...">
          <select class="form-select" data-etiqueta-todos="Todos los tipos"></select>
        </div>
        <div id="docs-lista" data-ver-mas="10">${this._renderLista(docsRecientes, ventaMap)}</div>
        <div id="docs-erp-table-container" class="mt-12" style="display:none;"></div>
        ${docs.length > 5 ? `<div id="docs-mas-nota" class="text-center mt-6 pt-6 border-top-222"><span class="text-[0.6rem] text-gray font-900 uppercase tracking-wider">${docs.length - 5} documentos más · usa "Consultar / Imprimir" para ver todos</span></div>` : ''}
      </div>
    `;
  },

  async _exportDocs() {
    try {
      const docs = this._cachedDocs || [];
      if (!docs.length) return App.toastError('No hay documentos para exportar');
      const data = docs.map(d => ({
        Tipo: d.tipo || '', Número: d.numero || '', Fecha: d.fecha || '',
        Estado: d.estado || '', Detalle: d.isPedidoCrotales ? `Pedido Crotales: ${d.dataRaw.cantidad} uds` : (d.isMovimiento ? `Guía Movimiento (${d.dataRaw.tipo})` : '')
      }));
      if (typeof XLSX === 'undefined') await App._ensureXLSX();
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Documentos');
      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Documentos_${new Date().toISOString().split('T')[0]}.xlsx`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      App.toast('Documentos exportados', 'success');
    } catch (e) { App.toastError('Error al exportar: ' + e.message); }
  },

  _renderLista(docs, ventaMap) {
    const filtrados = this._currentTab === 'todos'
      ? docs
      : docs.filter(d => (d.tipo || '').toLowerCase() === this._currentTab);

    if (!filtrados.length) {
      return `<div class="empty-state"><div class="empty-state-icon">${Icons.documento()}</div><p class="empty-state-text">No hay documentos${this._currentTab !== 'todos' ? ' de este tipo' : ''}.</p></div>`;
    }

    const colors = {
      dimoe: 'var(--c-success)',
      factura: 'var(--c-info)',
      certificado: 'var(--c-warning)',
      dib: 'var(--c-purple)',
      crotales: 'var(--c-orange)',
      albaran_carne: 'var(--c-danger)',
      albaran_leche: 'var(--c-info)',
      contrato: 'var(--c-purple)'
    };
    const labels = {
      dimoe: 'DIMOE (Guía)',
      factura: 'Factura',
      certificado: 'Certificado',
      dib: 'DIB (Identificación)',
      crotales: 'Pedido Crotales',
      albaran_carne: 'Albarán Carne',
      albaran_leche: 'Albarán Leche',
      contrato: 'Contrato'
    };

    return `<div class="grid gap-10">
      ${filtrados.map(doc => {
        const color = colors[doc.tipo] || 'var(--text-d)';
        const label = labels[doc.tipo] || doc.tipo;
        const fecha = this._fmtFecha(doc.createdAt || doc.fecha);
        const esBorrador = (doc.estado === 'borrador');
        
        let descHtml = '';
        if (doc.isPedidoCrotales) {
          descHtml = `Especie: <strong>${doc.dataRaw.especie ?? '—'}</strong> &middot; Cantidad: <strong>${doc.dataRaw.cantidad ?? '—'}${typeof doc.dataRaw.cantidad === 'number' ? (doc.dataRaw.cantidad === 1 ? ' par' : ' pares') : ''}</strong>`;
        } else if (doc.isMovimiento) {
          descHtml = `Movimiento de <strong>${doc.dataRaw.tipo === 'salida' ? 'Salida' : 'Entrada'}</strong> &middot; Animales: <strong>${doc.dataRaw.num_animales ?? '—'}</strong>`;
        } else if (doc.isAlbaranCarne) {
          descHtml = `Venta de <strong>${doc.dataRaw.num_animales || 1}</strong> animales &middot; Comprador: <strong>${doc.dataRaw.razonSocial || '—'}</strong>`;
        } else if (doc.isAlbaranLeche) {
          descHtml = `Entrega de <strong>${(doc.dataRaw.cantidad || 0).toLocaleString()} L</strong> &middot; Comprador: <strong>${doc.dataRaw.comprador_nombre || '—'}</strong>`;
        } else if (doc.isContrato) {
          descHtml = `Comprador: <strong>${ventaMap[doc.dataRaw.compradorId]?.razonSocial || '—'}</strong> &middot; Tipo: <strong>${(doc.dataRaw.tipo || '').toUpperCase()}</strong>`;
        } else {
          descHtml = doc.numero || 'Sin número registrado';
        }

        const badgeText = doc.isContrato ? (doc.dataRaw.activo !== false ? 'Activo' : 'Inactivo') : (esBorrador ? 'Borrador' : 'Presentado');
        const badgeColorKey = doc.isContrato ? (doc.dataRaw.activo !== false ? 'success' : 'danger') : (esBorrador ? 'warning' : 'success');

        const fechaEmision = doc.createdAt || doc.fecha;
        const diasPendiente = fechaEmision ? Math.floor((new Date() - new Date(fechaEmision)) / (1000 * 60 * 60 * 24)) : null;
        const acuseHtml = doc.acuseManual
          ? `<div class="text-xs text-green mt-6">${Icons.adjuntar()} Acuse manual: <span class="font-900">${doc.acuseManual}</span></div>`
          : `<div class="text-xs mt-6" style="color:${diasPendiente >= 15 ? 'var(--c-danger)' : diasPendiente >= 7 ? 'var(--c-warning)' : 'var(--text-d)'};">${Icons.adjuntar()} Acuse manual pendiente${diasPendiente !== null ? ` <span class="font-900">(${diasPendiente}d)</span>` : ''}</div>`;

        return `
          <div class="card-registro" style="--registro-color: ${color};">
            <div class="flex justify-between items-start">
              <div class="flex-1 min-w-0">
                <div class="font-800 text-sm" style="color:${color}; display:flex; align-items:center; gap:6px;">
                  ${(doc.tipo === 'crotales' || doc.isAlbaranCarne) ? Icons.animales() : (doc.isAlbaranLeche ? Icons.leche() : Icons.documento())}
                  ${label}
                </div>
                <div class="font-900 text-white mt-2">${doc.numero || 'S/N'}</div>
              </div>
              <div class="text-right">
                <span style="font-size: 1.1rem; font-weight: 800; border: 1px solid var(--c-${badgeColorKey}); color: var(--c-${badgeColorKey}); background: color-mix(in srgb, var(--c-${badgeColorKey}) 10%, transparent); padding: 6px 12px; border-radius: 8px; display: inline-block;">
                  ${badgeText}
                </span>
              </div>
            </div>
            <div class="flex justify-between items-end w-full">
              <div class="flex-1 min-w-0">
                <div class="mt-6 text-xs text-ccc">
                  ${descHtml}
                </div>
                ${acuseHtml}
                <div class="mt-6 flex gap-6 flex-wrap">
                  ${esBorrador ? `
                    <button type="button" class="widget-link-btn widget-link-btn--neon neon-warning px-10 py-6 min-h-0 h-auto" onclick="DocumentosView._editarBorrador('${doc.tipo}', ${doc.id})">${Icons.editar()}<span class="widget-link-label">Editar Borrador</span></button>
                  ` : `
                    <button type="button" class="widget-link-btn widget-link-btn--neon neon-info px-10 py-6 min-h-0 h-auto" onclick="DocumentosView._imprimirDoc('${doc.tipo}', ${doc.id})">${Icons.imprimir()}<span class="widget-link-label">Imprimir PDF</span></button>
                  `}
                  <button type="button" class="widget-link-btn widget-link-btn--neon px-10 py-6 min-h-0 h-auto" onclick="DocumentosView._registrarAcuse(${doc.id}, '${doc.tipo}', ${doc.isMovimiento ? 'true' : 'false'}, ${doc.isPedidoCrotales ? 'true' : 'false'})">${Icons.adjuntar()}<span class="widget-link-label">Guardar acuse</span></button>
                </div>
              </div>
              <div class="text-right">
                <span style="display: inline-block; font-size: 0.75rem; font-weight: 600; border: 1px solid var(--c-warning); color: var(--c-warning); background: rgba(255, 215, 0, 0.1); padding: 2px 6px; border-radius: 4px;" onclick="DocumentosView._verDetalle(${doc.id}, '${doc.tipo}')">${Icons.documento()} Detalle</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;
  },

  _fmtFecha(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-ES');
    } catch { return dateStr; }
  },

  async _abrirAsistenteConsulta() {
    const overlay = document.createElement('div');
    overlay.className = 'wizard-full-screen';
    overlay.style.zIndex = '7000';
    overlay.innerHTML = `
      <div class="wizard-header-fixed text-center">
        <button onclick="this.closest('.wizard-full-screen').remove()" class="btn-pesaje-close" aria-label="Cerrar"><span aria-hidden="true">${Icons.cerrar()}</span></button>
        <h2 class="pesaje-titulo-h2">${Icons.buscar()} CONSULTAR / IMPRIMIR</h2>
      </div>
      <div class="wizard-content-scrollable">
        <div class="card p-16 mb-16 border-222 card-dark-gradient" style="border: 1px solid var(--c-info); background: #1e1e1e;">
          <div class="text-xs text-white font-black uppercase tracking-wider mb-8 text-center"><span style="color: var(--c-info); margin-right: 4px;">|</span> SELECCIONA TIPO DE DOCUMENTO</div>
          <div class="grid grid-cols-2 gap-8">
            ${[
              { id: 'dimoe', label: 'Guías DIMOE', icon: Icons.exportar(), color: 'var(--c-success)' },
              { id: 'albaran_carne', label: 'Albaranes Carne', icon: Icons.carne(), color: 'var(--c-danger)' },
              { id: 'albaran_leche', label: 'Albaranes Leche', icon: Icons.leche(), color: 'var(--c-info)' },
              { id: 'factura', label: 'Facturas Venta', icon: Icons.libroVentas(), color: 'var(--c-info)' },
              { id: 'certificado', label: 'Certificados', icon: Icons.contratos(), color: 'var(--c-warning)' },
              { id: 'dib', label: 'DIB / Identificación', icon: Icons.informeRega(), color: 'var(--c-purple)' },
              { id: 'crotales', label: 'Pedidos Crotales', icon: Icons.animales(), color: 'var(--c-orange)' },
              { id: 'contrato', label: 'Contratos', icon: Icons.contratos(), color: 'var(--c-purple)' },
              { id: 'informes', label: 'Informes Oficiales', icon: Icons.informeRega(), color: 'var(--c-success)' },
              { id: 'cierres', label: 'Borradores / Pendientes', icon: Icons.documento(), color: 'var(--c-warning)' },
              { id: 'todos', label: 'Todos los documentos', icon: Icons.documento(), color: '#888' },
            ].map(t => `
              <button class="widget-link-btn widget-link-btn--neon" style="--neon-color:${t.color};--neon-glow:${t.color}B0;--neon-inner:${t.color}40;"
                onclick="DocumentosView._filtrarYMostrar('${t.id}');this.closest('.wizard-full-screen').remove()">
                ${t.icon}
                <span class="widget-link-label">${t.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  /** Filtro por tipo compartido entre tarjetas y tabla ERP (incluye los casos especiales dimoe/cierres). */
  _docsFiltradosPorTipo(tipo) {
    const docs = this._cachedDocs || [];
    if (!tipo || tipo === 'todos') return docs;
    return docs.filter(d => {
      if (tipo === 'dimoe') return d.tipo === 'dimoe' || d.isMovimiento;
      if (tipo === 'cierres') return d.estado === 'borrador';
      return (d.tipo || '') === tipo;
    });
  },

  _filtrarYMostrar(tipo) {
    if (tipo === 'informes') {
      location.hash = '#/informes?tab=exportar';
      return;
    }
    this._filtroTipo = tipo;
    if (this._vistaModo === 'tabla') return this._renderErpTable();
    const lista = document.getElementById('docs-lista');
    if (lista) {
      lista.innerHTML = this._renderLista(this._docsFiltradosPorTipo(tipo), this._ventaMap || {});
    }
  },

  _setupFilters() {
  },

  _cambiarTab(tab) {
    this._currentTab = tab;
    const lista = document.getElementById('docs-lista');
    if (lista) {
      lista.innerHTML = this._renderLista(this._cachedDocs || [], this._ventaMap || {});
    }
  },

  // ============================================
  // VISTA TABLA ERP (desktop)
  // ============================================

  _setVistaModo(modo, guardar = true) {
    this._vistaModo = modo;
    if (guardar) {
      try { localStorage.setItem('documentos_view_mode', modo); } catch (_) {}
    }

    const btnCards = document.getElementById('btn-docs-vista-cards');
    const btnTabla = document.getElementById('btn-docs-vista-tabla');
    const contenedorCards = document.getElementById('docs-lista');
    const contenedorTabla = document.getElementById('docs-erp-table-container');
    const notaMas = document.getElementById('docs-mas-nota');

    if (btnCards && btnTabla) {
      btnCards.style.background = modo === 'cards' ? 'var(--brand, #1F5FA8)' : 'transparent';
      btnTabla.style.background = modo === 'tabla' ? 'var(--brand, #1F5FA8)' : 'transparent';
    }

    if (modo === 'tabla') {
      if (contenedorCards) contenedorCards.style.display = 'none';
      if (notaMas) notaMas.style.display = 'none';
      if (contenedorTabla) {
        contenedorTabla.style.display = 'block';
        this._renderErpTable();
      }
    } else {
      if (contenedorTabla) contenedorTabla.style.display = 'none';
      if (notaMas) notaMas.style.display = 'block';
      if (contenedorCards) contenedorCards.style.display = 'block';
    }
  },

  _renderErpTable() {
    if (!window.ErpDataTable || !this._cachedDocs) return;

    // Mismos mapas de color/etiqueta que _renderLista
    const colors = {
      dimoe: 'var(--c-success)',
      factura: 'var(--c-info)',
      certificado: 'var(--c-warning)',
      dib: 'var(--c-purple)',
      crotales: 'var(--c-orange)',
      albaran_carne: 'var(--c-danger)',
      albaran_leche: 'var(--c-info)',
      contrato: 'var(--c-purple)'
    };
    const labels = {
      dimoe: 'DIMOE (Guía)',
      factura: 'Factura',
      certificado: 'Certificado',
      dib: 'DIB (Identificación)',
      crotales: 'Pedido Crotales',
      albaran_carne: 'Albarán Carne',
      albaran_leche: 'Albarán Leche',
      contrato: 'Contrato'
    };

    // La tabla muestra TODOS los documentos del filtro activo (las tarjetas
    // de portada cortan a los 5 más recientes) con búsqueda y paginación propias.
    const docs = this._docsFiltradosPorTipo(this._filtroTipo || 'todos');

    const tableData = docs.map(doc => {
      const esBorrador = (doc.estado === 'borrador');
      const fechaEmision = doc.createdAt || doc.fecha;
      const diasPendiente = fechaEmision ? Math.floor((new Date() - new Date(fechaEmision)) / (1000 * 60 * 60 * 24)) : null;

      let detalle;
      if (doc.isPedidoCrotales) {
        detalle = `Especie: ${doc.dataRaw.especie ?? '—'} · Cantidad: ${doc.dataRaw.cantidad ?? '—'}`;
      } else if (doc.isMovimiento) {
        detalle = `Movimiento ${doc.dataRaw.tipo === 'salida' ? 'salida' : 'entrada'} · ${doc.dataRaw.num_animales ?? '—'} animales`;
      } else if (doc.isAlbaranCarne) {
        detalle = `Venta ${doc.dataRaw.num_animales || 1} animales · ${doc.dataRaw.razonSocial || '—'}`;
      } else if (doc.isAlbaranLeche) {
        detalle = `${(doc.dataRaw.cantidad || 0).toLocaleString()} L · ${doc.dataRaw.comprador_nombre || '—'}`;
      } else if (doc.isContrato) {
        detalle = `${(this._ventaMap || {})[doc.dataRaw.compradorId]?.razonSocial || '—'} · ${(doc.dataRaw.tipo || '').toUpperCase()}`;
      } else {
        detalle = doc.numero || 'Sin número registrado';
      }

      return {
        id: doc.id,
        tipoKey: doc.tipo,
        tipo: labels[doc.tipo] || doc.tipo,
        _tipoColor: colors[doc.tipo] || 'var(--text-d)',
        numero: doc.numero || 'S/N',
        fecha: fechaEmision || '',
        detalle: detalle,
        acuse: doc.acuseManual ? 'Registrado' : (diasPendiente !== null ? `Pendiente (${diasPendiente}d)` : 'Pendiente'),
        _acuseColor: doc.acuseManual ? 'var(--c-success)' : (diasPendiente >= 15 ? 'var(--c-danger)' : diasPendiente >= 7 ? 'var(--c-warning)' : 'var(--text-d)'),
        estado: doc.isContrato ? (doc.dataRaw.activo !== false ? 'ACTIVO' : 'INACTIVO') : (esBorrador ? 'BORRADOR' : 'PRESENTADO'),
        _estadoColor: doc.isContrato ? (doc.dataRaw.activo !== false ? 'var(--c-success)' : 'var(--c-danger)') : (esBorrador ? 'var(--c-warning)' : 'var(--c-success)')
      };
    });

    new window.ErpDataTable({
      containerId: 'docs-erp-table-container',
      title: 'Documentos',
      pageSize: 15,
      columns: [
        {
          key: 'tipo',
          label: 'Tipo',
          sortable: true,
          render: (val, row) => `<span class="badge badge-sm font-900 uppercase" style="background:color-mix(in srgb, ${row._tipoColor} 12%, transparent); color:${row._tipoColor}; border:1px solid color-mix(in srgb, ${row._tipoColor} 25%, transparent);">${val}</span>`
        },
        { key: 'numero', label: 'Número', sortable: true },
        {
          key: 'fecha',
          label: 'Fecha',
          sortable: true,
          render: (val) => val ? this._fmtFecha(val) : '—'
        },
        { key: 'detalle', label: 'Detalle', sortable: false },
        {
          key: 'acuse',
          label: 'Acuse',
          sortable: true,
          render: (val, row) => `<span style="color:${row._acuseColor}; font-weight:700;">${val}</span>`
        },
        {
          key: 'estado',
          label: 'Estado',
          sortable: true,
          render: (val, row) => `<span class="badge badge-sm font-900 uppercase" style="background:color-mix(in srgb, ${row._estadoColor} 10%, transparent); color:${row._estadoColor}; border:1px solid ${row._estadoColor};">${val}</span>`
        },
        {
          key: 'id',
          label: 'Ficha',
          sortable: false,
          align: 'center',
          render: (id, row) => `<button class="btn-erp-secondary btn-sm" onclick="DocumentosView._verDetalle(${id}, '${row.tipoKey}')">Detalle</button>`
        }
      ],
      data: tableData
    }).render();
  },

  async _editarBorrador(tipo, id) {
    try {
      if (tipo === 'crotales') {
        const p = await window.db.get('pedidos_crotales', Number(id));
        if (p) await window.WizardCrotales.abrirPedido(p);
        else throw new Error("Borrador no encontrado");
      } else if (tipo === 'dimoe') {
        const m = await window.db.get('movimientos_ganado', Number(id));
        if (m) await window.WizardGuiaMovimiento.abrir(m);
        else throw new Error("Borrador no encontrado");
      } else if (tipo === 'albaran_carne') {
        const v = await window.db.get('comercializacion_carne', Number(id));
        if (v) await window.VentaMasivaWizard.open(v);
        else throw new Error("Borrador no encontrado");
      } else if (tipo === 'albaran_leche') {
        const l = await window.db.get('comercializacion_leche', Number(id));
        if (l) await window.AlbaranLecheWizard.open(l);
        else throw new Error("Borrador no encontrado");
      } else if (tipo === 'contrato') {
        location.hash = `#/contrato?id=${id}`;
      } else {
        App.toast("Este tipo de documento no se puede editar como borrador aquí", "info");
      }
    } catch (e) {
      App.toastError("Error al abrir borrador: " + e.message);
    }
  },

  async _imprimirDoc(tipo, id) {
    try {
      const finca = await window.Fincas.getActive();
      if (!finca) return App.toastError("No hay finca activa");
      
      if (tipo === 'crotales') {
        const p = await window.db.get('pedidos_crotales', Number(id));
        if (p) await window.WizardCrotales.generarPDF(finca, p, p.id);
        else throw new Error("Pedido no encontrado");
        return;
      }
      if (tipo === 'dimoe') {
        const m = await window.db.get('movimientos_ganado', Number(id));
        if (m) window.WizardGuiaMovimiento.generarDocumento(finca, m);
        else throw new Error("Movimiento no encontrado");
        return;
      }
      if (tipo === 'albaran_carne' || tipo === 'albaran_leche') {
        if (window.AlbaranesVentasView) {
          await AlbaranesVentasView._imprimirDoc(tipo === 'albaran_carne' ? 'carne' : 'leche', id);
        } else {
          throw new Error("Módulo de ventas no disponible");
        }
        return;
      }
      if (tipo === 'contrato') {
         // Generar PDF básico de contrato
         const c = await window.db.get('contratos_compra', Number(id));
         if (!c) throw new Error("Contrato no encontrado");
         this._imprimirContratoPDF(finca, c);
         return;
      }

      // Para el resto de tipos (factura, certificado, dib), generar PDF genérico
      const doc = (this._cachedDocs || []).find(d => d.id === id && d.tipo === tipo);
      if (!doc) throw new Error("Documento no encontrado");

      const label = {
        dimoe: 'DIMOE (Guía)',
        factura: 'Factura',
        certificado: 'Certificado',
        dib: 'DIB (Identificación)',
        crotales: 'Pedido Crotales',
        albaran_carne: 'Albarán Carne',
        albaran_leche: 'Albarán Leche',
        contrato: 'Contrato'
      }[tipo] || tipo;

      const html = `
        <div style="padding:40px; box-sizing:border-box; font-family:serif; color:#000;">
          <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:20px;margin-bottom:30px;">
            <h1 style="margin:0;font-size:1.4rem;text-transform:uppercase;">${label}</h1>
            <p style="color:#555;margin:5px 0 0 0;">${finca.nombre} · <span class="text-gold" style="color:var(--p-gold); font-weight:bold;">${finca.codigo_REGA || finca.rega || ''}</span></p>
          </div>
          <div style="margin-bottom:20px;font-size:0.9rem;">
            <p><strong>Número:</strong> ${doc.numero || 'S/N'}</p>
            <p><strong>Fecha:</strong> ${this._fmtFecha(doc.createdAt || doc.fecha)}</p>
            <p><strong>Estado:</strong> ${(doc.estado || '').toUpperCase()}</p>
            ${doc.isPedidoCrotales ? `<p><strong>Especie:</strong> ${doc.dataRaw.especie ?? '—'} · <strong>Cantidad:</strong> ${doc.dataRaw.cantidad ?? '—'}${typeof doc.dataRaw.cantidad === 'number' ? (doc.dataRaw.cantidad === 1 ? ' par' : ' pares') : ''} · <strong>Material:</strong> ${doc.dataRaw.tipo ?? '—'}</p>` : ''}
            ${doc.isMovimiento ? `<p><strong>Tipo:</strong> ${doc.dataRaw.tipo ?? '—'} · <strong>Animales:</strong> ${doc.dataRaw.num_animales ?? '—'}</p>` : ''}
          </div>
          <div style="padding:20px;border:1px solid #ccc;background:#f9f9f9;font-size:0.85rem;margin-top:40px;">
            <p style="margin:0;"><strong>Documento generado por Livestock Manager Premium</strong></p>
            <p style="margin:5px 0 0 0;color:#555;">Plataforma profesional de gestión ganadera y trazabilidad industrial.</p>
          </div>
        </div>`;

      DocumentViewer.show({
        id: 'doc-viewer-documentos',
        title: label,
        html,
        filename: `${label.replace(/\s+/g, '_')}_${doc.numero || doc.id}`,
        shareTitle: label
      });
    } catch (e) {
      App.toastError("Error al imprimir: " + e.message);
    }
  },

  async _imprimirContratoPDF(finca, contrato) {
    const html = `
      <div style="padding:40px; font-family:serif; color:#000;">
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:20px; margin-bottom:30px;">
          <h1 style="margin:0; font-size:1.4rem; text-transform:uppercase;">CONTRATO DE SUMINISTRO/VENTA</h1>
          <p style="margin:5px 0 0 0;">${finca.nombre} · ${finca.codigo_REGA || ''}</p>
        </div>
        <div style="margin-bottom:20px;">
          <p><strong>Nº Contrato:</strong> ${contrato.numero_contrato || 'S/N'}</p>
          <p><strong>Fecha Inicio:</strong> ${this._fmtFecha(contrato.fecha_inicio)}</p>
          <p><strong>Tipo:</strong> ${(contrato.tipo || '').toUpperCase()}</p>
        </div>
        <div style="margin-top:30px;">
          <h3 style="border-bottom:1px solid #eee; padding-bottom:5px;">PRECIOS PACTADOS</h3>
          <table style="width:100%; border-collapse:collapse; margin-top:10px;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="border:1px solid #ddd; padding:8px; text-align:left;">Producto</th>
                <th style="border:1px solid #ddd; padding:8px; text-align:right;">Precio (€)</th>
                <th style="border:1px solid #ddd; padding:8px; text-align:center;">Unidad</th>
              </tr>
            </thead>
            <tbody>
              ${(contrato.precios || []).map(p => `
                <tr>
                  <td style="border:1px solid #ddd; padding:8px;">${p.producto}</td>
                  <td style="border:1px solid #ddd; padding:8px; text-align:right;">${p.precio_unitario.toLocaleString()} €</td>
                  <td style="border:1px solid #ddd; padding:8px; text-align:center;">${p.unidad}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:40px; padding:20px; border:1px solid #ccc; background:#f9f9f9;">
          <p><strong>Condiciones:</strong> ${contrato.condiciones || 'Generales de mercado'}</p>
        </div>
      </div>`;

    DocumentViewer.show({
      id: 'doc-viewer-contrato',
      title: 'Contrato ' + (contrato.numero_contrato || ''),
      html,
      filename: `Contrato_${contrato.numero_contrato || contrato.id}`
    });
  },

  async _verDetalle(docId, tipo) {
    const doc = (this._cachedDocs || []).find(d => d.id === docId && d.tipo === tipo);
    if (!doc) { App.toastError('Documento no encontrado'); return; }
    
    const colors = { dimoe: 'var(--c-success)', factura: 'var(--c-info)', certificado: 'var(--c-warning)', dib: 'var(--c-purple)', crotales: 'var(--p-gold)', albaran_carne: 'var(--c-danger)', albaran_leche: 'var(--c-info)', contrato: 'var(--c-purple)' };
    const labels = { dimoe: 'DIMOE (Guía)', factura: 'Factura', certificado: 'Certificado', dib: 'DIB (Identificación)', crotales: 'Pedido Crotales', albaran_carne: 'Albarán Carne', albaran_leche: 'Albarán Leche', contrato: 'Contrato' };
    const color = colors[doc.tipo] || 'var(--text-d)';
    const label = labels[doc.tipo] || doc.tipo;
    const overlay = document.createElement('div');
    overlay.className = 'wizard-full-screen';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.id = `doc-detail-overlay-${docId}`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    let infoExtra = '';
    if (doc.isPedidoCrotales) {
      infoExtra = `
        <div><span class="text-gray">Cantidad:</span> <span class="text-white">${doc.dataRaw.cantidad ?? '—'}${typeof doc.dataRaw.cantidad === 'number' ? (doc.dataRaw.cantidad === 1 ? ' par' : ' pares') : ''}</span></div>
        <div><span class="text-gray">Especie:</span> <span class="text-white">${doc.dataRaw.especie ?? '—'}</span></div>
        <div><span class="text-gray">Material:</span> <span class="text-white">${doc.dataRaw.tipo ?? '—'}</span></div>
        <div class="col-span-2"><span class="text-gray">ADSG / Destinatario:</span> <span class="text-white">${doc.dataRaw.adsg_nombre || '—'}</span></div>
      `;
    } else if (doc.isMovimiento) {
      infoExtra = `
        <div><span class="text-gray">Tipo Mov.:</span> <span class="text-white">${(doc.dataRaw.tipo || '').toUpperCase()}</span></div>
        <div><span class="text-gray">Nº Animales:</span> <span class="text-white">${doc.dataRaw.num_animales ?? '—'}</span></div>
        <div class="col-span-2"><span class="text-gray">REGA Origen:</span> <span class="text-white">${doc.dataRaw.rega_origen || '—'}</span></div>
        <div class="col-span-2"><span class="text-gray">REGA Destino:</span> <span class="text-white">${doc.dataRaw.rega_destino || '—'}</span></div>
      `;
    } else if (doc.isAlbaranCarne) {
      infoExtra = `
        <div><span class="text-gray">Nº Animales:</span> <span class="text-white">${doc.dataRaw.num_animales || 1}</span></div>
        <div><span class="text-gray">Importe:</span> <span class="text-white">${(doc.dataRaw.importe_total || 0).toLocaleString()} €</span></div>
        <div class="col-span-2"><span class="text-gray">Comprador:</span> <span class="text-white">${doc.dataRaw.razonSocial || '—'}</span></div>
      `;
    } else if (doc.isAlbaranLeche) {
      infoExtra = `
        <div><span class="text-gray">Litros:</span> <span class="text-white">${(doc.dataRaw.cantidad || 0).toLocaleString()} L</span></div>
        <div><span class="text-gray">Importe:</span> <span class="text-white">${(doc.dataRaw.importe_total || 0).toLocaleString()} €</span></div>
        <div class="col-span-2"><span class="text-gray">Comprador:</span> <span class="text-white">${doc.dataRaw.comprador_nombre || '—'}</span></div>
      `;
    } else if (doc.isContrato) {
       infoExtra = `
        <div><span class="text-gray">Tipo:</span> <span class="text-white">${(doc.dataRaw.tipo || '').toUpperCase()}</span></div>
        <div><span class="text-gray">IVA:</span> <span class="text-white">${doc.dataRaw.iva_pct}%</span></div>
        <div class="col-span-2"><span class="text-gray">Condiciones:</span> <span class="text-white truncate">${doc.dataRaw.condiciones || '—'}</span></div>
      `;
    } else {
      infoExtra = `<div class="col-span-2"><span class="text-gray-500">Documento general cargado</span></div>`;
    }

    const acuseTexto = doc.acuseManual
      ? `<span class="text-green">${Icons.adjuntar()} Acuse manual: ${doc.acuseManual}</span>`
      : `<span class="text-red">${Icons.adjuntar()} Acuse manual pendiente</span>`;

    overlay.innerHTML = `
      <div class="card" style="max-width:520px;width:100%;padding:24px; border: 1px solid var(--c-gray); background: #1e1e1e;">
        <div class="flex justify-between items-start mb-10">
          <div>
            <div class="font-800 text-sm" style="color:${color};"><span style="color: var(--c-gray); margin-right: 4px;">|</span> ${label}</div>
            <div class="font-900 text-white text-lg">${doc.numero || 'S/N'}</div>
            <div class="text-xs text-ccc mt-2">${this._fmtFecha(doc.createdAt || doc.fecha)}</div>
          </div>
          <button onclick="document.getElementById('doc-detail-overlay-${docId}').remove()" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer;" aria-label="Cerrar"><span aria-hidden="true">${Icons.cerrar()}</span></button>
        </div>
        <div class="grid grid-cols-2 gap-8 text-xs text-ccc mb-8">
          <div><span class="text-gray">Estado:</span> <span class="text-white">${(doc.estado || 'desconocido').toUpperCase()}</span></div>
          <div><span class="text-gray">Tipo:</span> <span class="text-white">${doc.tipo}</span></div>
          ${infoExtra}
        </div>
        <div class="text-xs mb-8">${acuseTexto}</div>
        <div class="flex flex-wrap gap-8 justify-end">
          <button type="button" class="wizard-btn-action wizard-btn-secondary" onclick="document.getElementById('doc-detail-overlay-${docId}').remove()">${Icons.cerrar()} Cerrar</button>
          <button type="button" class="wizard-btn-action wizard-btn-secondary" onclick="DocumentosView._registrarAcuse(${doc.id}, '${doc.tipo}', ${doc.isMovimiento ? 'true' : 'false'}, ${doc.isPedidoCrotales ? 'true' : 'false'})">${Icons.adjuntar()} Registrar acuse</button>
          ${doc.estado === 'borrador' ? `
            <button type="button" class="wizard-btn-action wizard-btn-primary" onclick="DocumentosView._editarBorrador('${doc.tipo}', ${doc.id}); document.getElementById('doc-detail-overlay-${docId}').remove();">${Icons.editar()} Editar</button>
          ` : `
            <button type="button" class="wizard-btn-action wizard-btn-primary" onclick="DocumentosView._imprimirDoc('${doc.tipo}', ${doc.id}); document.getElementById('doc-detail-overlay-${docId}').remove();">${Icons.imprimir()} Imprimir</button>
          `}
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  async _registrarAcuse(docId, tipo, esMovimiento, esPedidoCrotales) {
    try {
      const detailOverlay = document.getElementById(`doc-detail-overlay-${docId}`);
      if (detailOverlay) detailOverlay.remove();

      let registro = null;
      if (esMovimiento) {
        registro = await window.db.get('movimientos_ganado', Number(docId));
      } else if (esPedidoCrotales) {
        registro = await window.db.get('pedidos_crotales', Number(docId));
      } else if (tipo === 'albaran_carne') {
        registro = await window.db.get('comercializacion_carne', Number(docId));
      } else if (tipo === 'albaran_leche') {
        registro = await window.db.get('comercializacion_leche', Number(docId));
      } else if (tipo === 'contrato') {
        registro = await window.db.get('contratos_compra', Number(docId));
      } else {
        registro = await window.db.get('documentos_legales', Number(docId));
      }
      if (!registro) throw new Error('Documento no encontrado');

      const valorActual = registro.acuse_manual || '';
      this._mostrarAcuseModal({
        docId,
        tipo,
        esMovimiento,
        esPedidoCrotales,
        valorActual
      });
    } catch (e) {
      App.toastError('Error al abrir acuse: ' + e.message);
    }
  },

  _mostrarAcuseModal({ docId, tipo, esMovimiento, esPedidoCrotales, valorActual }) {
    const existing = document.getElementById('acuse-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'acuse-overlay';
    overlay.className = 'wizard-full-screen';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) DocumentosView._cerrarAcuseModal(overlay); });

    const docLabels = { dimoe: 'Guía DIMOE', factura: 'Factura', certificado: 'Certificado', dib: 'DIB (Identificación)', crotales: 'Pedido de Crotales' };
    const docLabel = esPedidoCrotales ? 'Pedido de Crotales' : (docLabels[tipo] || 'Documento');
    overlay.innerHTML = `
      <div class="card" style="max-width:520px;width:100%;padding:24px; border: 1px solid var(--c-gray); background: #1e1e1e;">
        <div class="flex justify-between items-center mb-8">
          <div>
            <div class="font-900 text-sm" style="color:var(--c-warning);"><span style="color: var(--c-warning); margin-right: 4px;">|</span> ${docLabel}</div>
            <div class="text-xs text-aaa">Introduce el número de acuse o referencia oficial</div>
          </div>
          <button id="acuse-close" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer;" aria-label="Cerrar"><span aria-hidden="true">${Icons.cerrar()}</span></button>
        </div>
        <label class="text-xs text-gray mb-2" for="acuse-input">Referencia / justificante</label>
        <input id="acuse-input" type="text" class="wizard-input font-800" placeholder="Ej: SIGGAN-2026-000123" value="${valorActual.replace(/"/g, '&quot;')}">
        <div class="text-[0.65rem] text-aaa mt-2">Puedes pegar el código del acuse, URL o anotación breve.</div>
        <div class="flex gap-8 justify-end mt-10">
          <button type="button" class="wizard-btn-action wizard-btn-secondary" id="acuse-cancel">${Icons.cerrar()} Cancelar</button>
          <button type="button" class="wizard-btn-action wizard-btn-success" id="acuse-save">${Icons.guardar()} Guardar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('#acuse-input');
    setTimeout(() => { input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); }, 120);

    DocumentosView._acuseGuardado = false;
    App.setExitGuard(() => DocumentosView._confirmSalirAcuseModal());

    overlay.querySelector('#acuse-cancel').addEventListener('click', () => DocumentosView._cerrarAcuseModal(overlay));
    overlay.querySelector('#acuse-close').addEventListener('click', () => DocumentosView._cerrarAcuseModal(overlay));
    overlay.querySelector('#acuse-save').addEventListener('click', async () => {
      const valor = input.value;
      const ok = await this._guardarAcuseValor({ docId, tipo, esMovimiento, esPedidoCrotales, valor });
      if (ok) {
        DocumentosView._acuseGuardado = true;
        App.clearExitGuard();
        overlay.remove();
      }
    });
  },

  /** Guarda de salida compartida con el botón físico Android (ver App.setExitGuard). */
  async _confirmSalirAcuseModal() {
    if (this._acuseGuardado) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _cerrarAcuseModal(overlay) {
    if (!(await this._confirmSalirAcuseModal())) return;
    App.clearExitGuard();
    overlay.remove();
  },

  async _guardarAcuseValor({ docId, tipo, esMovimiento, esPedidoCrotales, valor }) {
    const referencia = (valor || '').trim();
    if (!referencia) {
      App.toastError('Referencia vacía. No se registró ningún acuse.');
      return false;
    }

    try {
      if (esMovimiento) {
        const movimiento = await window.db.get('movimientos_ganado', Number(docId));
        if (!movimiento) throw new Error('Movimiento no encontrado');
        movimiento.acuse_manual = referencia;
        movimiento.actualizadoEn = new Date().toISOString();
        await window.db.put('movimientos_ganado', movimiento);
      } else if (esPedidoCrotales) {
        const pedido = await window.db.get('pedidos_crotales', Number(docId));
        if (!pedido) throw new Error('Pedido no encontrado');
        pedido.acuse_manual = referencia;
        pedido.actualizadoEn = new Date().toISOString();
        await window.db.put('pedidos_crotales', pedido);
      } else if (tipo === 'albaran_carne') {
        const v = await window.db.get('comercializacion_carne', Number(docId));
        if (!v) throw new Error('Venta no encontrada');
        v.acuse_manual = referencia;
        v.actualizadoEn = new Date().toISOString();
        await window.db.put('comercializacion_carne', v);
      } else if (tipo === 'albaran_leche') {
        const l = await window.db.get('comercializacion_leche', Number(docId));
        if (!l) throw new Error('Entrega no encontrada');
        l.acuse_manual = referencia;
        l.actualizadoEn = new Date().toISOString();
        await window.db.put('comercializacion_leche', l);
      } else if (tipo === 'contrato') {
        const c = await window.db.get('contratos_compra', Number(docId));
        if (!c) throw new Error('Contrato no encontrado');
        c.acuse_manual = referencia;
        c.actualizadoEn = new Date().toISOString();
        await window.db.put('contratos_compra', c);
      } else {
        const registro = await window.db.get('documentos_legales', Number(docId));
        if (!registro) throw new Error('Documento no encontrado');
        registro.acuse_manual = referencia;
        registro.actualizadoEn = new Date().toISOString();
        await window.db.put('documentos_legales', registro);
      }

      App.toast('Acuse manual registrado', 'success');
      this.render();
      return true;
    } catch (e) {
      App.toastError('Error al registrar acuse: ' + e.message);
      return false;
    }
  },
};

window.DocumentosView = DocumentosView;
