/**
 * TrazabilidadView - Livestock Manager Premium v4.0
 * Panel de Trazabilidad 360°: Timeline completo del ciclo de vida de un animal.
 */

const TrazabilidadView = {
  /**
   * Renderizar panel de trazabilidad para un animal
   * @param {number} animalId - ID del animal
   */
  async render(animalId) {
    const main = document.getElementById('app-content');
    if (!main) return;

    const animal = await Animales.get(animalId).catch(() => null);
    if (!animal) {
      main.innerHTML = `<div class="card-registro error-card" style="--registro-color: var(--c-danger);"><h2>Error</h2><p>Animal no encontrado (ID: ${animalId})</p></div>`;
      return;
    }

    const rebano = animal.rebanoId ? await Rebanos.get(animal.rebanoId).catch(() => null) : null;
    const finca = await Fincas.getActive().catch(() => null);

    // Cargar datos de todas las fuentes
    const [sanitarios, pesajes, eventos, reproduccion, ventas] = await Promise.all([
      this._getAllSanitarios(animal.id, animal.rebanoId),
      this._getAllPesajes(animal.id),
      this._getAllEventos(animal.id),
      this._getAllReproduccion(animal.id),
      this._getVentas(animal.id),
    ]);

    // Construir timeline
    const timeline = this._buildTimeline(animal, sanitarios, pesajes, eventos, reproduccion, ventas);

    // Cachear para PDF
    this._cachedTimeline = timeline;
    this._cachedAnimal = animal;
    this._cachedRebano = rebano;

    main.innerHTML = this._buildHTML(animal, rebano, finca, timeline);
  },

  async _getAllSanitarios(animalId, rebanoId) {
    try {
      let records = [];
      const store = window.db.transaction('sanitarios_ganado', 'readonly').objectStore('sanitarios_ganado');
      // First by animalId if the index exists
      if (store.indexNames.contains('animalId')) {
        records = await window.db.getAllFromIndex('sanitarios_ganado', 'animalId', Number(animalId));
      }
      // Also by rebanoId
      if (rebanoId && store.indexNames.contains('rebanoId')) {
        const rebanoRecords = await window.db.getAllFromIndex('sanitarios_ganado', 'rebanoId', Number(rebanoId));
        records = records.concat(rebanoRecords.filter(r => !records.some(x => x.id === r.id)));
      }
      return records.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } catch(e) { return []; }
  },

  async _getAllPesajes(animalId) {
    try {
      if (!window.db.getAllFromIndex) return [];
      const records = await window.db.getAllFromIndex('produccion_carne', 'animalId', Number(animalId)).catch(() => []);
      return records.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } catch(e) { return []; }
  },

  async _getAllEventos(animalId) {
    try {
      const records = await window.db.getAllFromIndex('registro_eventos', 'entidad_id', Number(animalId)).catch(() => []);
      return records.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } catch(e) { return []; }
  },

  async _getAllReproduccion(animalId) {
    try {
      const records = await window.db.getAll('reproduccion_eventos').catch(() => []);
      return records.filter(r => Number(r.animalId) === Number(animalId))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } catch(e) { return []; }
  },

  async _getVentas(animalId) {
    try {
      const records = await window.db.getAll('comercializacion_carne').catch(() => []);
      return records.filter(r => Number(r.animalId) === Number(animalId))
        .sort((a, b) => new Date(b.fechaSacrificio) - new Date(a.fechaSacrificio));
    } catch(e) { return []; }
  },

  _calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return 'N/D';
    const nac = new Date(fechaNacimiento);
    if (isNaN(nac)) return 'N/D';
    const hoy = new Date();
    const meses = Math.floor((hoy - nac) / (1000 * 60 * 60 * 24 * 30.44));
    const anios = Math.floor(meses / 12);
    const restoMeses = meses % 12;
    return anios > 0 ? `${anios}a ${restoMeses}m` : `${meses}m`;
  },

  _buildTimeline(animal, sanitarios, pesajes, eventos, reproduccion, ventas) {
    const timeline = [];

    // 1. NACIMIENTO / ALTA
    timeline.push({
      fecha: animal.fecha_nacimiento || animal.creadoEn?.split('T')[0] || 'N/D',
      tipo: 'nacimiento',
      icon: Icons.animales(),
      titulo: 'NACIMIENTO / ALTA',
      detalle: `
        <strong>Crotal:</strong> <span class="text-gold font-bold">${animal.numero_identificacion || '—'}</span><br>
        ${animal.dib ? `<strong>DIB:</strong> <span class="text-white font-bold">${animal.dib}</span><br>` : ''}
        <strong>Especie:</strong> ${animal.especie || 'N/D'}<br>
        <strong>Raza:</strong> ${animal.raza || 'N/D'}<br>
        ${animal.tipo ? `<strong>Variedad/Clase:</strong> ${animal.tipo}<br>` : ''}
        ${animal.peso_inicial ? `<strong>Peso Inicial:</strong> ${animal.peso_inicial} kg<br>` : ''}
        <strong>Sexo:</strong> ${animal.sexo || 'N/D'}<br>
        <strong>Categoría:</strong> ${animal.categoria || 'Sin categoría'}<br>
        ${animal.procedencia_tipo ? `<strong>Procedencia:</strong> ${animal.procedencia_tipo}${animal.explotacion_origen ? ' ('+animal.explotacion_origen+')' : ''}<br>` : ''}
      `
    });

    // 2. SANITARIOS (cada tratamiento es un evento)
    const CS = window.ComunidadesService;
    for (const s of sanitarios) {
      const supresion = s.tiempo_espera_carne_dias > 0 ? ` (supresión: <span class="text-red font-900">${s.tiempo_espera_carne_dias}d</span>)` : '';
      const motivo = s.motivo_tratamiento ? (CS ? CS.getMotivoTratamientoLabel(s.motivo_tratamiento) : s.motivo_tratamiento) : '';
      const via = s.via_administracion ? (CS ? CS.getViaAdministracionLabel(s.via_administracion) : s.via_administracion) : '';
      timeline.push({
        fecha: s.fecha || 'N/D',
        tipo: 'sanitario',
        icon: Icons.sanidad(),
        titulo: `TRATAMIENTO: ${s.medicamento || 'N/D'}`,
        detalle: `
          <strong>Tipo:</strong> ${s.tipo_tratamiento || 'N/D'}<br>
          <strong>Producto:</strong> ${s.medicamento || 'N/D'}<br>
          ${motivo ? `<strong>Motivo:</strong> ${motivo}<br>` : ''}
          ${via ? `<strong>Vía:</strong> ${via}<br>` : ''}
          ${s.num_animales_tratados ? `<strong>Nº animales tratados:</strong> <span class="text-white font-bold">${s.num_animales_tratados}</span><br>` : ''}
          ${s.lote_medicamento ? `<strong>Lote:</strong> ${s.lote_medicamento}<br>` : ''}
          ${s.caducidad_medicamento ? `<strong>Caducidad:</strong> ${s.caducidad_medicamento}<br>` : ''}
          <strong>Supresión carne:</strong> <span class="text-red font-bold">${s.tiempo_espera_carne_dias || 0}</span> ${(s.tiempo_espera_carne_dias || 0) === 1 ? 'día' : 'días'}${supresion}<br>
          ${s.prohibidoLeche ? `<strong class="text-red">${Icons.alerta()} PROHIBIDO para leche</strong><br>` : ''}
          ${s.veterinario_prescriptor ? `<strong>Veterinario:</strong> ${s.veterinario_prescriptor}${s.veterinario_colegiado ? ' (Nº ' + s.veterinario_colegiado + ')' : ''}<br>` : ''}
          ${s.numero_receta ? `<strong>Nº receta:</strong> ${s.numero_receta}<br>` : ''}
        `
      });
    }

    // 3. REPRODUCCIÓN
    for (const r of reproduccion) {
      const tipoLabels = {
        'celo': { icon: Icons.reproduccion(), label: 'CELO' },
        'inseminacion': { icon: Icons.sanidad(), label: 'INSEMINACIÓN' },
        'gestacion': { icon: Icons.reproduccion(), label: 'GESTACIÓN' },
        'parto': { icon: Icons.animales(), label: 'PARTO' },
        'aborto': { icon: Icons.alerta(), label: 'ABORTO' },
        'diagnostico_gestacion': { icon: Icons.buscar(), label: 'DIAG. GESTACIÓN' },
      };
      const info = tipoLabels[r.tipo_evento] || { icon: Icons.documento(), label: r.tipo_evento || 'OTRO' };
      timeline.push({
        fecha: r.fecha || 'N/D',
        tipo: 'reproduccion',
        icon: info.icon,
        titulo: info.label,
        detalle: `
          <strong>Fecha:</strong> ${r.fecha || 'N/D'}<br>
          ${r.resultado ? `<strong>Resultado:</strong> <span class="${r.resultado.toLowerCase()==='positivo'?'text-green':'text-red'} font-bold">${r.resultado.toUpperCase()}</span><br>` : ''}
          ${r.observaciones ? `<strong>Observaciones:</strong> ${r.observaciones}<br>` : ''}
        `
      });
    }

    // 4. PESAJES (cada pesaje)
    for (const p of pesajes) {
      timeline.push({
        fecha: p.fecha || 'N/D',
        tipo: 'pesaje',
        icon: Icons.balanza(),
        titulo: `PESAJE: ${p.valor_neto || 0} ${p.unidad || 'kg'}`,
        detalle: `
          <strong>Peso:</strong> <span class="text-green font-950" style="font-size:1.1rem;">${p.valor_neto || 0}</span> <small class="text-gray">${p.unidad || 'kg'}</small><br>
          ${p.motivo_tarea ? `<strong>Motivo:</strong> ${p.motivo_tarea.toUpperCase()}<br>` : ''}
        `
      });
    }

    // 5. EVENTOS (registro_eventos)
    for (const e of eventos) {
      const labels = {
        'ALTA_IMPORTACION': { icon: Icons.importar(), label: 'ALTA POR IMPORTACIÓN' },
        'expedicion': { icon: Icons.paquete(), label: 'EXPEDICIÓN' },
        'control': { icon: Icons.check(), label: 'CONTROL' },
        'baja': { icon: Icons.cerrar(), label: 'BAJA' },
      };
      const info = labels[e.motivo_tarea] || { icon: Icons.documento(), label: e.motivo_tarea || 'EVENTO' };
      timeline.push({
        fecha: e.fecha || 'N/D',
        tipo: 'evento',
        icon: info.icon,
        titulo: info.label,
        detalle: `
          <strong>Motivo:</strong> ${e.motivo_tarea || 'N/D'}<br>
          ${e.observaciones ? `<strong>Notas:</strong> ${e.observaciones}<br>` : ''}
          ${e.valor_neto ? `<strong>Valor:</strong> <span class="text-gold font-bold">${e.valor_neto}</span> <small class="text-aaa">${e.unidad || ''}</small><br>` : ''}
        `
      });
    }

    // 6. VENTA (si el animal fue vendido)
    for (const v of ventas) {
      timeline.push({
        fecha: v.fechaSacrificio || 'N/D',
        tipo: 'venta',
        icon: Icons.paquete(),
        titulo: `VENTA / SACRIFICIO`,
        detalle: `
          <strong>Comprador:</strong> <span class="text-white font-bold">${v.razonSocial || 'N/D'}</span><br>
          <strong>NIF:</strong> ${v.nifComprador || 'N/D'}<br>
          <strong>Fecha sacrificio:</strong> ${v.fechaSacrificio || 'N/D'}<br>
          <strong>Peso vivo:</strong> <span class="text-white font-bold">${v.pesoVivo || 0}</span> <small>kg</small><br>
          <strong>Peso canal:</strong> <span class="text-gold font-950">${v.pesoCanal || 0}</span> <small>kg</small><br>
          <strong>Rendimiento:</strong> <span class="text-green font-bold">${v.rendimientoCanal || 0}%</span><br>
          <strong>Matadero:</strong> ${v.codigoMatadero || 'N/D'}<br>
          <strong>Nº Albarán:</strong> ${v.numero_albaran || 'N/D'}<br>
          <strong>DIMOE:</strong> ${v.dimoe || 'N/D'}<br>
          <strong>Transportista:</strong> ${v.nombreTransportista || 'N/D'}<br>
          ${v.clasificacion?.seurop ? `<strong>SEUROP:</strong> <span class="badge badge-sm badge-gold">${v.clasificacion.seurop}</span><br>` : ''}
          <strong>IVA:</strong> <span class="text-aaa font-bold">${v.IVA || 0}%</span><br>
          ${v.autorizacion_veterinaria ? `<strong>Veterinario:</strong> ${v.autorizacion_veterinaria.vet_nombre || 'N/D'}<br>` : ''}
        `
      });
    }

    // Ordenar timeline por fecha ascendente (más antiguo primero)
    return timeline.sort((a, b) => {
      const fa = a.fecha === 'N/D' ? '0000-00-00' : a.fecha;
      const fb = b.fecha === 'N/D' ? '0000-00-00' : b.fecha;
      return fa.localeCompare(fb);
    });
  },

  _buildHTML(animal, rebano, finca, timeline) {
    const edad = this._calcularEdad(animal.fecha_nacimiento);
    const totalPesajes = timeline.filter(t => t.tipo === 'pesaje').length;
    const totalSanitarios = timeline.filter(t => t.tipo === 'sanitario').length;
    const totalReproduccion = timeline.filter(t => t.tipo === 'reproduccion').length;
    const totalEventos = timeline.filter(t => t.tipo === 'evento').length;

    return `
      <div class="p-12 w-full">
        <!-- Cabecera con acciones -->
        <div class="flex items-center gap-12 mb-20 flex-wrap">
          <button onclick="App._navigateBack()" class="widget-link-btn widget-link-btn--neon neon-danger px-16 py-10 min-h-0 h-auto">
            <span class="text-[0.75rem] font-950 uppercase tracking-widest">${Icons.atras()} Volver</span>
          </button>
          <div class="flex-1"></div>
          <button onclick="TrazabilidadView._exportarPDF()" class="widget-link-btn widget-link-btn--neon neon-warning px-16 py-10 min-h-0 h-auto">
            ${Icons.exportar()}
            <span class="text-[0.75rem] font-950 uppercase tracking-widest">Exportar PDF</span>
          </button>
        </div>

        <!-- Datos Básicos del Animal -->
        <div class="card-registro p-16 mb-16" style="--registro-color: var(--c-info);">
          <div class="flex justify-between items-center mb-10 flex-wrap gap-8">
            <strong class="text-gold text-lg">${animal.numero_identificacion || '—'}</strong>
            <span style="background:${animal.estado === 'activo' || animal.estado === 'Activo' ? '#065f46' : '#7f1d1d'}; color:white; padding:3px 12px; border-radius:20px; font-size:0.75rem;">${animal.estado || '—'}</span>
          </div>
          <div class="traz-meta-grid">
            <div><span class="text-gray">Especie:</span> ${animal.especie || 'N/D'}</div>
            <div><span class="text-gray">Raza:</span> ${animal.raza || 'N/D'}</div>
            ${animal.tipo ? `<div><span class="text-gray">Variedad:</span> ${animal.tipo}</div>` : ''}
            ${animal.peso_inicial ? `<div><span class="text-gray">Peso Inicial:</span> ${animal.peso_inicial} kg</div>` : ''}
            <div><span class="text-gray">Sexo:</span> ${animal.sexo || 'N/D'}</div>
            <div><span class="text-gray">Edad:</span> ${edad}</div>
            <div><span class="text-gray">Categoría:</span> ${animal.categoria || 'Sin categoría'}</div>
            <div><span class="text-gray">DIB:</span> ${animal.dib || '<span class="text-red">No registrado</span>'}</div>
            ${rebano ? `<div><span class="text-gray">Rebaño:</span> ${rebano.nombre || 'N/D'}</div>` : ''}
            ${animal.procedencia_tipo ? `<div><span class="text-gray">Procedencia:</span> ${animal.procedencia_tipo}${animal.explotacion_origen ? ` (<span class="text-gold font-900">${animal.explotacion_origen}</span>)` : ''}</div>` : ''}
          </div>
        </div>

        <!-- KPIs rápidos -->
        <div class="traz-stats-grid">
          <div class="info-box-center py-10" style="background: #1e1e1e; border: 1px solid #27272a;"><div class="kpi-value text-xl font-950" style="color: var(--c-success);">${totalPesajes}</div><div class="kpi-label text-60 uppercase text-gray" style="font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px;">PESAJES</div></div>
          <div class="info-box-center py-10" style="background: #1e1e1e; border: 1px solid #27272a;"><div class="kpi-value text-xl font-950" style="color: var(--c-info);">${totalSanitarios}</div><div class="kpi-label text-60 uppercase text-gray" style="font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px;">TRATAMIENTOS</div></div>
          <div class="info-box-center py-10" style="background: #1e1e1e; border: 1px solid #27272a;"><div class="kpi-value text-xl font-950" style="color: var(--c-purple);">${totalReproduccion}</div><div class="kpi-label text-60 uppercase text-gray" style="font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px;">REPRODUCCIÓN</div></div>
          <div class="info-box-center py-10" style="background: #1e1e1e; border: 1px solid #27272a;"><div class="kpi-value text-xl font-950" style="color: var(--c-warning);">${totalEventos}</div><div class="kpi-label text-60 uppercase text-gray" style="font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px;">EVENTOS</div></div>
        </div>

        <!-- Timeline -->
        <div class="mt-16">
          <h3 class="text-white mb-15 font-900 uppercase tracking-wider"><span style="color: var(--c-warning); margin-right: 4px;">|</span> ${Icons.calendar()} LÍNEA DE VIDA</h3>
          ${timeline.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">${Icons.buscar()}</div><p class="empty-state-text">No hay datos de trazabilidad para este animal.</p></div>` : ''}
          <div id="trazabilidad-timeline" class="relative">
            <div class="traz-timeline-line"></div>
            ${timeline.map(t => this._renderTimelineItem(t)).join('')}
          </div>
        </div>

        <div class="text-center mt-20 pb-40">
          <button onclick="App._navigateBack()" class="btn btn-secondary">← Volver al animal</button>
        </div>
      </div>
    `;
  },

  async _exportarPDF() {
    const animalData = document.getElementById('app-content');
    if (!animalData) return;

    // Overlay de progreso
    const loader = document.createElement('div');
    loader.id = 'pdf-loader-trazabilidad';
    loader.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;';
    loader.innerHTML = `
      <div class="pdf-loader">
        <div class="pdf-loader-icon" style="color:var(--p-gold); margin-bottom:15px; transform:scale(1.5);">${Icons.documento()}</div>
        <div class="pdf-loader-title">Generando PDF</div>
        <div class="pdf-loader-desc">Trazabilidad 360°</div>
        <div class="pdf-loader-bar">
          <div id="traz-pdf-bar" class="pdf-loader-fill"></div>
        </div>
        <div id="traz-pdf-text" class="pdf-loader-status">PROCESANDO...</div>
      </div>
      `;
    document.body.appendChild(loader);
    const updateProgress = (pct, text) => {
      const bar = document.getElementById('traz-pdf-bar');
      const txt = document.getElementById('traz-pdf-text');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = text.toUpperCase();
    };

    try {
      const finca = await Fincas.getActive().catch(() => null);
      const fecha = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
      const fileName = `Trazabilidad_${finca?.codigo_REGA || 'animal'}_${Date.now()}.pdf`;

      // Construir HTML directamente para el PDF (sin clonar DOM)
      const timeline = window.TrazabilidadView?._cachedTimeline || [];
      const animal = window.TrazabilidadView?._cachedAnimal || {};
      const rebano = window.TrazabilidadView?._cachedRebano || null;

      const edad = this._calcularEdad(animal.fecha_nacimiento);
      const renderItemHtml = (item) => {
        const colors = {
          nacimiento: { bg: '#065f46', border: '#10b981', dot: '#10b981' },
          sanitario: { bg: '#1e3a5f', border: '#4FADF5', dot: '#4FADF5' },
          reproduccion: { bg: '#3b1f6e', border: '#a78bfa', dot: '#a78bfa' },
          pesaje: { bg: '#5c3d0e', border: '#f59e0b', dot: '#f59e0b' },
          evento: { bg: '#4a1942', border: '#4FADF5', dot: '#4FADF5' },
          venta: { bg: '#4a0e0e', border: '#ef4444', dot: '#ef4444' },
        };
        const c = colors[item.tipo] || { bg: '#1a1a1a', border: '#555', dot: '#555' };
        return `
          <tr style="border-bottom:1px solid ${c.border}44;">
            <td style="padding:8px 10px;vertical-align:top;width:80px;white-space:nowrap;color:#888;font-size:0.7rem;">${item.fecha}</td>
            <td style="padding:8px 10px;vertical-align:top;width:30px;text-align:center;"><span style="font-size:1.1rem;">${item.icon}</span></td>
            <td style="padding:8px 10px;vertical-align:top;">
              <strong style="color:${c.border};font-size:0.8rem;">${item.titulo}</strong>
              <div style="color:#555;font-size:0.7rem;margin-top:3px;line-height:1.5;">${item.detalle.replace(/<br>/g, '<br>')}</div>
            </td>
          </tr>`;
      };

      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const pdfEl = document.createElement('div');
      pdfEl.style.cssText = `position:absolute; left:0; top:${currentScroll}px; z-index:9990; padding:30px; background:#fff; color:#333; font-family:Inter,system-ui,sans-serif; font-size:12px; width:800px; overflow:visible;`;
      pdfEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #d97706;padding-bottom:15px;margin-bottom:20px;">
          <div><h1 style="margin:0;font-size:18px;color:#d97706;">Trazabilidad 360°</h1><p style="margin:2px 0 0;font-size:10px;color:#888;">${fecha}</p></div>
          <div style="text-align:right;font-size:10px;color:#888;">${finca?.nombre || ''}<br><span style="color:var(--p-gold);font-weight:bold;">${finca?.codigo_REGA || ''}</span></div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
          <tr><td style="padding:4px 8px;font-weight:bold;color:var(--p-gold);font-size:14px;">${animal.numero_identificacion || '—'}</td><td style="text-align:right;padding:4px 8px;"><span style="background:${animal.estado === 'activo' ? '#065f46' : '#7f1d1d'};color:#fff;padding:2px 10px;border-radius:10px;font-size:10px;">${animal.estado || ''}</span></td></tr>
          <tr><td style="padding:3px 8px;color:#888;">Especie: <strong style="color:#333;">${animal.especie || 'N/D'}</strong></td><td style="padding:3px 8px;color:#888;">Raza: <strong style="color:#333;">${animal.raza || 'N/D'}</strong></td></tr>
          ${animal.tipo || animal.peso_inicial ? `<tr>
            <td style="padding:3px 8px;color:#888;">${animal.tipo ? `Variedad: <strong style="color:#333;">${animal.tipo}</strong>` : ''}</td>
            <td style="padding:3px 8px;color:#888;">${animal.peso_inicial ? `Peso Inicial: <strong style="color:#333;">${animal.peso_inicial} kg</strong>` : ''}</td>
          </tr>` : ''}
          <tr><td style="padding:3px 8px;color:#888;">Sexo: <strong style="color:#333;">${animal.sexo || 'N/D'}</strong></td><td style="padding:3px 8px;color:#888;">Edad: <strong style="color:#333;">${edad}</strong></td></tr>
          <tr><td style="padding:3px 8px;color:#888;">DIB: <strong style="color:#333;">${animal.dib || 'No registrado'}</strong></td><td style="padding:3px 8px;color:#888;">${rebano ? 'Rebaño: <strong style="color:#333;">'+rebano.nombre+'</strong>' : ''}</td></tr>
        </table>
        <h2 style="font-size:14px;color:#333;border-bottom:2px solid #d97706;padding-bottom:8px;margin-top:20px;display:flex;align-items:center;gap:8px;">${Icons.calendar({ class: 'icon', style: 'width:16px;height:16px' })} Línea de Vida</h2>
        ${timeline.length === 0 ? '<p style="color:#888;">No hay datos de trazabilidad para este animal.</p>' : `
        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <thead><tr style="background:#f5f5f5;"><th style="padding:8px 10px;text-align:left;font-size:10px;color:#888;text-transform:uppercase;">Fecha</th><th style="padding:8px 10px;width:30px;"></th><th style="padding:8px 10px;text-align:left;font-size:10px;color:#888;text-transform:uppercase;">Evento</th></tr></thead>
          <tbody>${timeline.map(item => renderItemHtml(item)).join('')}</tbody>
        </table>`}
        <div style="margin-top:30px;padding-top:10px;text-align:center;font-size:9px;color:#999;">Generado por Livestock Manager Premium — ${fecha}</div>
      `;
      document.body.appendChild(pdfEl);

      if (typeof html2pdf === 'undefined' && !(await App._ensureHtml2Pdf())) {
        App.toastError('Librería PDF no disponible');
        document.body.removeChild(pdfEl); return;
      }

      updateProgress(50, 'Preparando contenido...');
      await new Promise(r => setTimeout(r, 500));

      pdfEl.querySelectorAll('table, h2').forEach(el => el.style.cssText += ';page-break-inside:avoid;');

      updateProgress(70, 'Generando PDF...');
      const pdfBlob = await html2pdf().set({
        margin: [10, 8, 10, 8],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: 800,
          scrollX: 0,
          scrollY: currentScroll,
          height: pdfEl.scrollHeight,
          windowHeight: pdfEl.scrollHeight,
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(pdfEl).toPdf().output('blob');
      document.body.removeChild(pdfEl);

      updateProgress(100, '¡Listo!');
      await new Promise(r => setTimeout(r, 300));
      loader.remove();

      // Compartir o descargar
      const fileObj = {
        blob: pdfBlob, fileName, mimeType: 'application/pdf',
        titulo: 'Trazabilidad 360°',
        shareTitle: 'Trazabilidad 360° - Livestock Manager',
        shareText: `Trazabilidad del animal — ${finca?.nombre || ''}`
      };
      if (window.InformesView) {
        const exito = await InformesView._ejecutarShare(fileObj);
        if (!exito) InformesView._mostrarBotonFlotante(fileObj);
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
        App.toast('PDF descargado', 'success');
      }
    } catch (e) {
      console.error('[TrazabilidadPDF]', e);
      App.toastError('Error al exportar PDF: ' + e.message);
      if (document.getElementById('pdf-loader-trazabilidad')) document.getElementById('pdf-loader-trazabilidad').remove();
    }
  },

  _renderTimelineItem(item) {
    const colors = {
      nacimiento: { bg: 'rgba(204,255,0,0.1)', border: 'var(--c-success)', dot: 'var(--c-success)' },
      sanitario: { bg: 'rgba(59,130,246,0.1)', border: 'var(--c-info)', dot: 'var(--c-info)' },
      reproduccion: { bg: 'rgba(167,139,250,0.1)', border: '#a78bfa', dot: '#a78bfa' },
      pesaje: { bg: 'rgba(255,214,0,0.1)', border: 'var(--c-warning)', dot: 'var(--c-warning)' },
      evento: { bg: 'rgba(236,72,153,0.1)', border: 'var(--c-pink)', dot: 'var(--c-pink)' },
      venta: { bg: 'rgba(255,68,68,0.1)', border: 'var(--c-danger)', dot: 'var(--c-danger)' },
    };
    const c = colors[item.tipo] || { bg: '#1a1a1a', border: '#555', dot: '#555' };

    return `
      <div style="position:relative; margin-bottom:15px; padding-left:45px;">
        <div style="position:absolute; left:10px; top:18px; width:22px; height:22px; background:#000; border:2px solid ${c.border}; border-radius:50%; z-index:1; display:flex; align-items:center; justify-content:center; color:${c.border};">
            <div style="transform:scale(0.7);">${item.icon}</div>
        </div>
        <div class="p-12" style="background:${c.bg}; border:1px solid ${c.border}; border-radius:12px;">
          <div class="flex justify-between items-center">
            <strong class="text-white text-85 uppercase font-900">${item.titulo}</strong>
            <span class="text-gray text-2xs font-800">${item.fecha}</span>
          </div>
          <div class="mt-8 text-sm leading-normal text-ccc">
            ${item.detalle}
          </div>
        </div>
      </div>
    `;
  }
};

window.TrazabilidadView = TrazabilidadView;
