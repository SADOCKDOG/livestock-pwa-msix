/**
 * Livestock Manager - PatrimonioView v1.0.0
 * Patrimonio y Ganadería unificados de GeGan: censo/lotes de toda la finca
 * (sin distinguir carne/leche/híbrido) y el panel de Índice de Conversión
 * Alimenticia (ICA) por Tanda de Cebo, migrado de CarneView.
 */
const PatrimonioView = {
  async render(container) {
    if (!container) return;
    const fincaId = await Fincas.getActiveId();

    const [rebanos, animales, eventos, ventasCarne, movimientos] = await Promise.all([
      window.db.getAllFromIndex('rebanos', 'fincaId', fincaId).catch(() => []),
      window.db.getAll('animales').catch(() => []),
      window.db.getAllFromIndex('registro_eventos', 'fincaId', fincaId).catch(() => []),
      window.db.getAllFromIndex('comercializacion_carne', 'fincaId', fincaId).catch(() => []),
      window.db.getAll('movimientos_ganado').catch(() => [])
    ]);

    const rebanoIds = rebanos.map(r => r.id);
    const animalesFinca = animales.filter(a => rebanoIds.includes(a.rebanoId));

    const pesajes = eventos.filter(e =>
      e.unidad === 'kg' && (e.tipo_entidad === 'animal' || e.tipo_entidad === 'rebano')
    );
    pesajes.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    // Patrimonio estimado (referencia de valor en vivo, agregada a toda la finca)
    const pesoMedioFinca = animalesFinca.length > 0
      ? (animalesFinca.reduce((s, a) => s + (a.peso_actual || 0), 0) / animalesFinca.length) : 350;
    const valorEstimadoCabeza = pesoMedioFinca * 3.20; // 3.20 €/kg vivo de referencia
    const valorPatrimonioTotal = animalesFinca.length * valorEstimadoCabeza;

    const icaData = this._calcularICA({ rebanos, animalesFinca, pesajes, ventasCarne, eventos, movimientos });

    container.innerHTML = `
      <div class="module-header">
        <div class="module-header-kpis">
          <span class="module-mode-chip" style="--mode-color: var(--c-success);">${Icons.carne()} Cárnico</span>
          <div class="module-header-kpi">
            <span class="module-header-kpi-label">Censo</span>
            <span class="module-header-kpi-value">${animalesFinca.length}</span>
          </div>
          <div class="module-header-kpi">
            <span class="module-header-kpi-label">Lotes</span>
            <span class="module-header-kpi-value">${rebanos.length}</span>
          </div>
        </div>
        <div class="module-header-primary-action">
          <button class="btn btn-create btn-lg" onclick="App._abrirAsistenteProduccion('carne', { origen_modulo: 'patrimonio' })">${Icons.peso()} Registrar Pesaje</button>
        </div>
      </div>

      <div class="card p-16 mb-14" style="border: 1px solid #27272a; background: #1E1E1E;">
        ${this._kpiGrid([
          { label: 'Censo Total', value: animalesFinca.length + ' cabezas' },
          { label: 'Lotes/Rebaños', value: rebanos.length },
          { label: 'Valor Estimado', value: Math.round(valorPatrimonioTotal).toLocaleString() + ' €', color: 'var(--c-warning)' },
          { label: 'ICA (Conversión)', value: icaData.ica > 0 ? icaData.ica.toFixed(2) + ' : 1' : 'N/D', color: icaData.ica > 0 && icaData.ica <= 8 ? 'var(--c-success)' : (icaData.ica > 0 ? 'var(--c-danger)' : undefined) },
          { label: 'Coste/kg Ganancia', value: icaData.costePorKgGanancia > 0 ? icaData.costePorKgGanancia.toFixed(2) + ' €/kg' : 'N/D', color: 'var(--c-warning)' }
        ], 'var(--c-warning)')}

        ${this._renderPanelICA(icaData)}

        <!-- Accesos directos táctiles -->
        <div class="grid grid-cols-3 gap-8 mb-16">
          <a href="#/animales" class="widget-link-btn widget-link-btn--neon neon-info"><span class="widget-link-label">${Icons.animales()} Animales</span></a>
          <a href="#/rebanos" class="widget-link-btn widget-link-btn--neon neon-info"><span class="widget-link-label">${Icons.rebanos()} Rebaños</span></a>
          <a href="#/zonas" class="widget-link-btn widget-link-btn--neon neon-info"><span class="widget-link-label">${Icons.zonas()} Zonas</span></a>
        </div>

        <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-6 pb-5">
          ${Icons.documento()} Lotes Activos (${rebanos.length})
        </div>
        <div class="grid gap-10">
          ${rebanos.length > 0
            ? rebanos.map(r => `
                <div class="card-registro" onclick="location.hash='/rebano?id=${r.id}'" style="--registro-color: var(--p-gold-dark);">
                  <div class="flex justify-between items-start">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-8">
                        <span class="text-xl text-gold">${Icons.rebanos()}</span>
                        <h3 class="section-h3 m-0 text-ellipsis">${r.nombre}</h3>
                      </div>
                      <div class="flex flex-wrap gap-4 mt-4 text-xs text-gray font-800 uppercase">
                        <span>Especie: <span class="text-ccc">${r.especie}</span></span>
                        <span>·</span>
                        <span>Tipo: <span class="text-ccc">${r.tipo || 'N/D'}</span></span>
                        <span>·</span>
                        <span>Ubicación: <span class="text-ccc">${r.zonaActual || 'Sin zona'}</span></span>
                      </div>
                    </div>
                    <div class="text-right flex-shrink-0 ml-8">
                      <span class="badge badge-sm badge-gold block mb-4 font-950">${(c => c + " " + (c === 1 ? "cabeza" : "cabezas"))(animalesFinca.filter(a => a.rebanoId === r.id && (a.estado || "").toLowerCase() === "activo").length)}</span>
                      <span class="text-[0.5rem] text-gray-700 font-900 uppercase">Ver ficha ➔</span>
                    </div>
                  </div>
                </div>`).join('')
            : `<div class="p-14 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-xs uppercase font-900 tracking-widest">${Icons.buscar()} Sin lotes registrados.</span></div>`
          }
        </div>
      </div>
    `;
  },

  _kpiGrid(kpis, color) {
    if (!kpis || !kpis.length) return '';
    return `<div class="grid grid-cols-3 gap-6 mb-12">
      ${kpis.map(k => `
        <div class="leche-kpi-item" style="--kpi-color:${k.color || color}; --kpi-value-color:${k.color || '#fff'}">
          <small class="leche-kpi-label">${k.label}</small>
          <div class="leche-kpi-value">${k.value}</div>
        </div>`).join('')}
    </div>`;
  },

  _fmtFecha(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) ? d.toLocaleDateString() : '-';
    } catch (e) { return '-'; }
  },

  /**
   * Índice de Conversión Alimenticia (ICA) de toda la finca, estructurado en dos
   * niveles temporales para que las altas/bajas de animales no distorsionen el ratio:
   *
   *  1) CIERRE DE LOTE (periodo principal, dato definitivo): desde la entrada del
   *     lote (rebano.fecha_constitucion; fallback: primer pesaje / creadoEn) hasta su
   *     salida a matadero (última venta con ese rebanoId). Si no hay ventas, sigue
   *     "en curso" y se calcula hasta hoy.
   *  2) CONTROL MENSUAL (alerta temprana): ICA de cada mes natural para detectar
   *     desviaciones (mucho pienso, poca ganancia) antes del cierre.
   *
   * Fórmula en ambos: kg de pienso consumido (eventos silo_consumo del/los lote/s en
   * el rango) / kg de ganancia de peso vivo (último - primer pesaje dentro del rango).
   */
  _calcularICA(data) {
    const rebanos = data.rebanos || [];
    const rebanoIds = rebanos.map(r => Number(r.id));
    const consumos = (data.eventos || []).filter(e => e.tipo === 'silo_consumo' && !e.anulado);

    // Todas las comparaciones se hacen sobre strings de fecha ISO 'YYYY-MM-DD' (orden
    // lexicográfico = orden cronológico) para evitar desfases de zona horaria.
    const dia = (f) => String(f || '').slice(0, 10);
    const mes = (f) => String(f || '').slice(0, 7);

    // Pesajes por animal (ordenados por fecha ISO)
    const pesajesAnimal = {};
    (data.pesajes || []).forEach(p => {
      if (p.tipo_entidad === 'animal' && p.entidad_id) {
        (pesajesAnimal[p.entidad_id] ||= []).push(p);
      }
    });
    Object.values(pesajesAnimal).forEach(arr => arr.sort((a, b) => dia(a.fecha).localeCompare(dia(b.fecha))));

    // Ganancia de peso vivo (kg) de un conjunto de animales dentro de [iniDia, finDia]
    const gananciaEnRango = (animalIds, iniDia, finDia) => animalIds.reduce((g, aid) => {
      const pts = (pesajesAnimal[aid] || []).filter(p => { const f = dia(p.fecha); return f >= iniDia && f <= finDia; });
      return pts.length >= 2 ? g + Math.max(0, (pts[pts.length - 1].valor_neto || 0) - (pts[0].valor_neto || 0)) : g;
    }, 0);

    // Pienso consumido (kg y coste) por los lotes indicados dentro de [iniDia, finDia]
    const piensoEnRango = (loteIds, iniDia, finDia) => consumos.reduce((acc, e) => {
      const f = dia(e.fecha);
      if (e.rebanoId && loteIds.includes(Number(e.rebanoId)) && f >= iniDia && f <= finDia) {
        acc.kg += (e.valor_neto || 0); acc.coste += (e.costeConsumo || 0);
      }
      return acc;
    }, { kg: 0, coste: 0 });

    // Mapa animal -> lote
    const animalesPorLote = {};
    (data.animalesFinca || []).forEach(a => {
      const rid = Number(a.rebanoId);
      (animalesPorLote[rid] ||= []).push(a.id);
    });

    const hoyDia = new Date().toISOString().slice(0, 10);

    // Índices para resolver los animales de un movimiento de entrada (por id o crotal)
    const animalById = {};
    const idPorCrotal = {};
    (data.animalesFinca || []).forEach(a => {
      animalById[a.id] = a;
      if (a.numero_identificacion) idPorCrotal[String(a.numero_identificacion)] = a.id;
    });

    // Cierre de una tanda/lote: ventana [entrada, salida] + sus animales y lotes físicos
    const construirCierre = (meta, animalIds, entrada) => {
      const loteIds = [...new Set(animalIds.map(aid => animalById[aid] && Number(animalById[aid].rebanoId)).filter(v => v != null))];
      const ventasDe = (data.ventasCarne || []).filter(v => animalIds.includes(Number(v.animalId)));
      const cerrado = ventasDe.length > 0;
      const salida = cerrado ? ventasDe.map(v => dia(v.fechaSacrificio || v.fecha)).sort().slice(-1)[0] : hoyDia;
      const ganancia = gananciaEnRango(animalIds, entrada, salida);
      const { kg, coste } = loteIds.length ? piensoEnRango(loteIds, entrada, salida) : { kg: 0, coste: 0 };
      return {
        ...meta, entrada, salida: cerrado ? salida : null, cerrado,
        nAnimales: animalIds.length, kgPienso: kg, ganancia,
        ica: ganancia > 0 && kg > 0 ? kg / ganancia : 0,
        costePorKg: ganancia > 0 && coste > 0 ? coste / ganancia : 0
      };
    };

    // NIVEL 1 — Cierre de lote (periodo principal, dato definitivo).
    // Referencia SIGGAN: una tanda de cebo son los animales de un mismo movimiento de
    // ENTRADA documentado (RD 787/2023). La entrada es la fecha del movimiento; la
    // salida, la venta a matadero de esos animales. Si aún no hay movimientos de
    // entrada registrados, se cae a un cierre por lote usando fecha_constitucion.
    const movsEntrada = (data.movimientos || []).filter(m => m.tipo === 'entrada' && !m.anulado);
    let lotesICA = [];
    for (const m of movsEntrada) {
      const idsPorId = (Array.isArray(m.animalId) ? m.animalId : []).map(Number);
      const idsPorCrotal = (Array.isArray(m.crotales) ? m.crotales : []).map(c => idPorCrotal[String(c)]).filter(v => v != null);
      const animalIds = [...new Set([...idsPorId, ...idsPorCrotal])].filter(aid => animalById[aid] !== undefined);
      if (animalIds.length === 0) continue;
      lotesICA.push(construirCierre(
        { rebanoId: null, nombre: 'Tanda ' + (m.numero_guia || dia(m.fecha)), origen: 'tanda', guiaEntrada: m.numero_guia || null },
        animalIds, dia(m.fecha)
      ));
    }
    if (lotesICA.length === 0) {
      lotesICA = rebanos.map(r => {
        const rid = Number(r.id);
        const animalIds = animalesPorLote[rid] || [];
        const primerPesajeDia = animalIds.map(aid => (pesajesAnimal[aid] || [])[0]).filter(Boolean).map(p => dia(p.fecha)).sort()[0];
        const entrada = r.fecha_constitucion ? dia(r.fecha_constitucion) : (primerPesajeDia || (r.creadoEn ? dia(r.creadoEn) : null));
        if (!entrada) return null;
        return construirCierre({ rebanoId: rid, nombre: r.nombre || ('Lote ' + rid), origen: 'lote', guiaEntrada: null }, animalIds, entrada);
      }).filter(Boolean);
    }
    lotesICA = lotesICA.filter(l => l.kgPienso > 0 || l.ganancia > 0);

    // NIVEL 2 — Control mensual (últimos 6 meses naturales)
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hoy = new Date();
    const todosAnimalIds = Object.keys(pesajesAnimal).map(Number);
    // Ganancia atribuida a un mes: incrementos entre pesajes consecutivos cuyo pesaje
    // posterior cae en el mes (evita perder engorde de animales con 1 pesaje/mes).
    const gananciaMes = (mesKey) => todosAnimalIds.reduce((g, aid) => {
      const pts = pesajesAnimal[aid] || [];
      let sum = 0;
      for (let k = 1; k < pts.length; k++) {
        if (mes(pts[k].fecha) === mesKey) sum += Math.max(0, (pts[k].valor_neto || 0) - (pts[k - 1].valor_neto || 0));
      }
      return g + sum;
    }, 0);
    const mensualICA = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mesKey = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
      const kg = consumos.reduce((s, e) => (e.rebanoId && rebanoIds.includes(Number(e.rebanoId)) && mes(e.fecha) === mesKey) ? s + (e.valor_neto || 0) : s, 0);
      const ganancia = gananciaMes(mesKey);
      mensualICA.push({
        mesKey, label: meses[dt.getMonth()] + ' ' + dt.getFullYear(),
        kgPienso: kg, ganancia, ica: ganancia > 0 && kg > 0 ? kg / ganancia : 0
      });
    }

    // Agregado ponderado por ganancia (para el KPI resumen, sin distorsión por censo)
    const kgPienso = lotesICA.reduce((s, l) => s + l.kgPienso, 0);
    const gananciaPeso = lotesICA.reduce((s, l) => s + l.ganancia, 0);
    const costeTotal = lotesICA.reduce((s, l) => s + (l.costePorKg * l.ganancia), 0);
    const ica = gananciaPeso > 0 && kgPienso > 0 ? kgPienso / gananciaPeso : 0;
    const costePorKgGanancia = gananciaPeso > 0 && costeTotal > 0 ? costeTotal / gananciaPeso : 0;

    return { ica, kgPienso, gananciaPeso, costePorKgGanancia, lotesICA, mensualICA };
  },

  /**
   * Panel de análisis del ICA en dos niveles: cierre de lote (definitivo) y control
   * mensual (detección de desviaciones). Colorea el ICA según eficiencia y resalta
   * los meses cuyo consumo se dispara respecto a la media de la serie.
   */
  _renderPanelICA(d) {
    const lotes = d.lotesICA || [];
    const mensual = d.mensualICA || [];
    const conDatos = lotes.length > 0 || mensual.some(m => m.ica > 0);
    if (!conDatos) {
      return `
        <div class="card p-12 mb-14 border-222" style="background: rgba(255,255,255,0.02);">
          <div class="text-xs text-white font-black uppercase tracking-wider mb-4" style="color:var(--c-warning);">${Icons.documento()} Conversión Alimenticia (ICA)</div>
          <div class="text-[0.62rem] text-gray-500 font-bold uppercase">Sin datos suficientes. Requiere pesajes seriados y consumos de silo imputados por lote.</div>
        </div>`;
    }

    // Color por eficiencia del ICA (kg pienso : kg ganancia)
    const colorICA = (v) => v <= 0 ? 'var(--c-gray)' : v <= 6 ? 'var(--c-success)' : v <= 8 ? 'var(--c-warning)' : 'var(--c-danger)';

    // Cierre de lote
    const lotesHtml = lotes.length > 0 ? lotes.map(l => `
      <div class="flex items-center justify-between p-8 rounded-sm mb-6" style="background:#080808; border:1px solid #1a1a1a;">
        <div class="min-w-0">
          <div class="text-[0.68rem] font-black text-white uppercase text-ellipsis">${l.nombre}${l.origen === 'tanda' ? ' <span style="color:var(--c-info);font-size:0.85em;">· SIGGAN</span>' : ''}</div>
          <div class="text-[0.55rem] text-gray-500 font-bold uppercase">${l.nAnimales ? l.nAnimales + ' cab · ' : ''}${this._fmtFecha(l.entrada)} → ${l.cerrado ? this._fmtFecha(l.salida) : 'EN CURSO'} · ${Math.round(l.ganancia).toLocaleString()} kg ganados</div>
        </div>
        <div class="text-right flex-shrink-0 ml-8">
          <div class="text-sm font-950" style="color:${colorICA(l.ica)};">${l.ica > 0 ? l.ica.toFixed(2) + ' : 1' : 'N/D'}</div>
          <div class="text-[0.5rem] font-900 uppercase" style="color:${l.cerrado ? 'var(--c-success)' : 'var(--c-info)'};">${l.cerrado ? 'CERRADO' : 'ABIERTO'}${l.costePorKg > 0 ? ' · ' + l.costePorKg.toFixed(2) + ' €/kg' : ''}</div>
        </div>
      </div>`).join('') : `<div class="text-[0.58rem] text-gray-600 font-bold uppercase mb-6">Sin tandas con datos de cierre todavía.</div>`;

    // Control mensual: media de meses con datos para detectar desviaciones
    const mesesData = mensual.filter(m => m.ica > 0);
    const mediaICA = mesesData.length > 0 ? mesesData.reduce((s, m) => s + m.ica, 0) / mesesData.length : 0;
    const maxICA = Math.max(1, ...mensual.map(m => m.ica));
    const mensualHtml = mensual.map(m => {
      const desviado = m.ica > 0 && mediaICA > 0 && m.ica > mediaICA * 1.2;
      const pct = Math.max(4, Math.min(100, (m.ica / maxICA) * 100));
      const col = m.ica <= 0 ? '#333' : (desviado ? 'var(--c-danger)' : colorICA(m.ica));
      return `
        <div class="flex-1 text-center min-w-0">
          <div class="text-[0.5rem] text-gray-500 font-bold uppercase" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.label.split(' ')[0]}</div>
          <div style="height:44px; display:flex; align-items:flex-end; justify-content:center;">
            <div style="width:60%; height:${pct}%; background:${col}; border-radius:4px 4px 0 0; min-height:3px;" title="${m.ica > 0 ? m.ica.toFixed(2) + ':1' : 'sin datos'}"></div>
          </div>
          <div class="text-[0.5rem] font-950 mt-2" style="color:${col};">${m.ica > 0 ? m.ica.toFixed(1) : '—'}</div>
        </div>`;
    }).join('');

    return `
      <div class="card p-12 mb-14 border-222" style="background: rgba(255,255,255,0.02);">
        <div class="text-xs text-white font-black uppercase tracking-wider mb-8" style="color:var(--c-warning);">${Icons.documento()} Conversión Alimenticia (ICA)</div>

        <div class="text-[0.58rem] text-gray uppercase font-900 tracking-wide mb-6" style="border-left:2px solid var(--c-warning); padding-left:6px;">Cierre de Tanda de Cebo (entrada → matadero)</div>
        ${lotesHtml}

        <div class="text-[0.58rem] text-gray uppercase font-900 tracking-wide mt-10 mb-6" style="border-left:2px solid var(--c-info); padding-left:6px;">Control Mensual (desviaciones)</div>
        <div class="flex items-end gap-4 p-8 rounded-sm" style="background:#080808; border:1px solid #1a1a1a;">
          ${mensualHtml}
        </div>
        ${mesesData.length > 0 ? `<div class="text-[0.52rem] text-gray-500 font-bold uppercase mt-4">Media del periodo: ${mediaICA.toFixed(2)}:1 · en rojo, meses con consumo desviado (&gt;20% sobre la media)</div>` : ''}
      </div>`;
  }
};

window.PatrimonioView = PatrimonioView;
