/**
 * Dashboard de Explotación Láctea
 * Módulo Lácteo Integral (v24)
 */
window.ExplotacionLacteaView = {

  // ── Acciones sobre los registros de Láctea ────────────────────────────────
  // Hasta ahora las analíticas y los movimientos de balance se pintaban en
  // modo consulta: no había forma de abrirlos ni corregirlos desde la interfaz.

  /** Abre una analítica existente en el asistente, en modo edición. */
  async _editarAnalitica(id) {
    try {
      const analitica = await window.AnaliticasLeche.getById(Number(id));
      if (!analitica) return App.toastError('La analítica ya no existe');
      await window.AnaliticaLecheWizard.open(analitica);
    } catch (e) {
      App.toastError(e.message);
    }
  },

  /** Elimina una analítica, previa confirmación. */
  async _eliminarAnalitica(id) {
    const ok = await Confirm.confirm('Eliminar analítica', '¿Eliminar esta analítica del control lechero? La acción no se puede deshacer.', true);
    if (!ok) return;
    try {
      await window.db.delete('analiticas_leche', Number(id));
      App.toast('Analítica eliminada', 'success');
      App.route();
    } catch (e) {
      App.toastError(e.message);
    }
  },

  /** Abre un movimiento de balance existente en el asistente, en modo edición. */
  async _editarMovimiento(id) {
    try {
      const mov = await window.BalanceLacteo.getById(Number(id));
      if (!mov) return App.toastError('El movimiento ya no existe');
      await window.MovimientoBalanceWizard.open(mov);
    } catch (e) {
      App.toastError(e.message);
    }
  },

  /** Elimina un movimiento de balance. El stock del tanque se recalcula solo,
   *  porque se deriva de la suma de movimientos. */
  async _eliminarMovimiento(id) {
    const ok = await Confirm.confirm('Eliminar movimiento', '¿Eliminar este movimiento de balance? El stock del tanque se recalculará automáticamente.', true);
    if (!ok) return;
    try {
      await window.BalanceLacteo.eliminar(Number(id));
      App.toast('Movimiento eliminado', 'success');
      App.route();
    } catch (e) {
      App.toastError(e.message);
    }
  },
  async render(container) {
    const App = window.App;
    const fincaId = await window.Fincas.getActiveId();
    const finca = await window.Fincas.getActive();

    const tanques = window.TanquesLeche ? await window.BalanceLacteo.getTanqueConStock(fincaId) : [];
    const comercializaciones = await window.db.getAll('comercializacion_leche').catch(() => []);
    const entregasFinca = comercializaciones.filter(c => Number(c.fincaId) === Number(fincaId));

    const hoy = new Date().toISOString().split('T')[0];
    const produccionHoy = window.BalanceLacteo ? await window.BalanceLacteo.getProduccionDiaria(fincaId, hoy) : 0;

    const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
    const resumen30 = window.BalanceLacteo ? await window.BalanceLacteo.getResumenPeriodo(fincaId, hace30.toISOString(), new Date().toISOString()) : { totalEntradas: 0, totalSalidas: 0 };

    const alertas = window.MotorLacteo ? await window.MotorLacteo.getAllAlertas(fincaId) : [];
    const alertasDanger = alertas.filter(a => a.nivel === 'DANGER');
    const alertasWarning = alertas.filter(a => a.nivel === 'WARNING');

    let ultimaAnalitica = null;
    if (entregasFinca.length > 0) {
      const conAnalitica = entregasFinca.filter(e => e.laboratorio && (e.laboratorio.grasa || e.laboratorio.germenes));
      if (conAnalitica.length > 0) {
        conAnalitica.sort((a, b) => new Date(b.fechaRecogida) - new Date(a.fechaRecogida));
        ultimaAnalitica = conAnalitica[0];
      }
    }

    const ingresos30 = entregasFinca
      .filter(e => { const f = new Date(e.fechaRecogida); return f >= hace30; })
      .reduce((s, e) => s + (e.importe_total || 0), 0);

    const gastosAlim30 = await (async () => {
      try {
        const gastos = await window.db.getAll('gastos_ganaderia').catch(() => []);
        return gastos
          .filter(g => Number(g.fincaId) === Number(fincaId) && g.categoria === 'Alimentacion' && new Date(g.fecha) >= hace30)
          .reduce((s, g) => s + (g.monto || 0), 0);
      } catch (e) { return 0; }
    })();

    const mofa30 = ingresos30 - gastosAlim30;

    let html = `
    <div class="p-16">
      <div class="flex items-center justify-between mb-16">
        <h2 class="text-lg font-900 uppercase tracking-tight" style="color:var(--c-info);">Explotación Láctea</h2>
        <div class="flex gap-8">
          <button onclick="window.OrdeñoWizard.open()" class="text-xs px-12 py-6 font-900 uppercase" style="background:var(--c-info); color:#000; border:none; border-radius:6px;">+ Ordeño</button>
          <button onclick="window.TanqueWizard.open()" class="btn-secondary text-xs px-12 py-6 font-900 uppercase">+ Tanque</button>
        </div>
      </div>`;

    if (alertasDanger.length > 0) {
      html += `
      <div class="card p-12 mb-12" style="border-left:3px solid var(--c-danger);">
        <div class="text-[0.6rem] font-900 text-red uppercase mb-6">Alertas Críticas</div>
        ${alertasDanger.map(a => `<div class="text-[0.65rem] font-800 text-white mb-4">⚠ ${a.mensaje}</div>`).join('')}
      </div>`;
    }

    html += `<div class="grid grid-cols-1 gap-12 mb-16">`;

    for (const t of tanques) {
      const pct = t.porcentaje_llenado || 0;
      const tempColor = t.temperatura_actual != null ? (t.temperatura_actual <= 4 ? 'var(--c-success)' : (t.temperatura_actual <= 6 ? 'var(--c-warning)' : 'var(--c-danger)')) : 'var(--c-info)';
      html += `
      <div class="card p-14" style="border-left:3px solid var(--c-info);">
        <div class="flex items-center justify-between mb-8">
          <div class="text-sm font-900 uppercase">${t.nombre}</div>
          <div class="text-[0.6rem] font-800" style="color:var(--c-info);">Letra Q: ${t.codigo_letra_q}</div>
        </div>
        <div class="mb-8">
          <div class="flex justify-between text-[0.6rem] font-800 mb-4">
            <span>${t.stock_actual.toLocaleString('es-ES')}L / ${t.capacidad_litros.toLocaleString('es-ES')}L</span>
            <span style="color:${pct > 90 ? 'var(--c-danger)' : 'var(--c-success)'};">${pct}%</span>
          </div>
          <div style="background:var(--c-222); border-radius:4px; height:12px; overflow:hidden;">
            <div style="width:${Math.min(pct, 100)}%; height:100%; background:${pct > 90 ? 'var(--c-danger)' : 'var(--c-info)'}; transition:width 0.3s;"></div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-8 text-center">
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">Temp</div>
            <div class="text-xs font-900" style="color:${tempColor};">${t.temperatura_actual != null ? t.temperatura_actual + '°C' : '—'}</div>
          </div>
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">Últ. Limpieza</div>
            <div class="text-[0.6rem] font-800">${t.ultima_limpieza || '—'}</div>
          </div>
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">Próx. Limpieza</div>
            <div class="text-[0.6rem] font-800">${t.proxima_limpieza || '—'}</div>
          </div>
        </div>
        <div class="flex gap-6 mt-8">
          <button onclick="window.TanqueWizard.open(${JSON.stringify(t).replace(/"/g, '&quot;')})" class="btn-erp-secondary btn-sm">Editar</button>
        </div>
      </div>`;
    }

    if (tanques.length === 0) {
      html += `
      <div class="card p-20 text-center">
        <div class="text-aaa text-xs mb-8">No hay tanques registrados</div>
        <button class="widget-link-btn widget-link-btn--neon neon-success" onclick="location.hash='/explotacion?tab=lacteo&sub=tanques'">${Icons.agregar()}<span class="widget-link-label">Nuevo primer Tanque</span></button>
      </div>`;
    }

    html += `</div>`;

    html += `
    <div class="grid grid-cols-2 gap-12 mb-16">
      <div class="card p-14" style="border-left:3px solid var(--c-success);">
        <div class="text-[0.55rem] text-aaa uppercase font-800 mb-4">Producción Hoy</div>
        <div class="text-xl font-900 text-green">${produccionHoy.toLocaleString('es-ES')} L</div>
        <div class="text-[0.55rem] text-aaa mt-4">Entradas 30d: ${resumen30.totalEntradas.toLocaleString('es-ES')}L</div>
      </div>
      <div class="card p-14" style="border-left:3px solid var(--c-warning);">
        <div class="text-[0.55rem] text-aaa uppercase font-800 mb-4">MOFA (30 días)</div>
        <div class="text-xl font-900" style="color:${mofa30 >= 0 ? 'var(--c-success)' : 'var(--c-danger)'};">${mofa30.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
        <div class="text-[0.55rem] text-aaa mt-4">Ingresos: ${ingresos30.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
      </div>
    </div>`;

    if (ultimaAnalitica) {
      const lab = ultimaAnalitica.laboratorio;
      const especie = ultimaAnalitica.especie_leche || 'vacuno';
      const umbrales = window.ComunidadesService ? window.ComunidadesService.getUmbralesCalidadEspecie(especie) : null;

      html += `
      <div class="card p-14 mb-16" style="border-left:3px solid var(--c-purple);">
        <div class="text-[0.55rem] text-aaa uppercase font-800 mb-8">Última Analítica — ${ultimaAnalitica.fechaRecogida}</div>
        <div class="grid grid-cols-3 gap-8 text-center">
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">Grasa</div>
            <div class="text-sm font-900 ${(lab.grasa || 0) >= (umbrales?.grasa?.min || 0) ? 'text-green' : 'text-red'};">${lab.grasa || '—'}%</div>
          </div>
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">Proteína</div>
            <div class="text-sm font-900 ${(lab.proteina || 0) >= (umbrales?.proteina?.min || 0) ? 'text-green' : 'text-red'};">${lab.proteina || '—'}%</div>
          </div>
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">E. Seco</div>
            <div class="text-sm font-900 text-green">${lab.extracto_seco || ((lab.grasa || 0) + (lab.proteina || 0)).toFixed(2)}%</div>
          </div>
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">Gérmenes</div>
            <div class="text-sm font-900 ${(lab.germenes || 0) <= (umbrales?.germenes_30C?.max || 1500000) ? 'text-green' : 'text-red'};">${lab.germenes ? (lab.germenes / 1000).toFixed(0) + 'k' : '—'}</div>
          </div>
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">Somáticas</div>
            <div class="text-sm font-900">${lab.somaticas ? (lab.somaticas / 1000).toFixed(0) + 'k' : '—'}</div>
          </div>
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">Inhibidores</div>
            <div class="text-sm font-900 ${lab.antibioticos ? 'text-red' : 'text-green'};">${lab.antibioticos ? '✗' : '✓'}</div>
          </div>
        </div>
      </div>`;
    }

    if (alertasWarning.length > 0) {
      html += `
      <div class="card p-14" style="border-left:3px solid var(--c-warning);">
        <div class="text-[0.6rem] font-900 uppercase mb-8" style="color:var(--c-warning);">Avisos</div>
        ${alertasWarning.map(a => `<div class="text-[0.65rem] font-800 text-white mb-4">⚠ ${a.mensaje}</div>`).join('')}
      </div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
  },

  async renderControl(container) {
    if (!container) return;
    const fincaId = await window.Fincas.getActiveId();
    const analiticas = window.AnaliticasLeche ? await window.AnaliticasLeche.getAll(fincaId).catch(() => []) : [];
    const controlLechero = await window.db.getAllFromIndex('control_lechero', 'fincaId', fincaId).catch(() => []);

    const analiticasHtml = analiticas.slice(0, 20).map(a => {
      const estadoColor = a.estado === 'validado' ? 'var(--c-success)' : (a.estado === 'alerta' ? 'var(--c-warning)' : 'var(--c-danger)');
      return `
        <div class="card p-12 mb-10" data-tipo="${a.tipo_muestreo || 'autocontrol'}" style="border-left: 3px solid var(--c-accent);">
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
          <div class="flex gap-6 mt-10 justify-end">
            <button class="btn-erp-secondary btn-sm" onclick="ExplotacionLacteaView._editarAnalitica(${a.id})">Editar</button>
            <button class="btn-erp-secondary btn-sm" onclick="ExplotacionLacteaView._eliminarAnalitica(${a.id})">Eliminar</button>
          </div>
        </div>
      `;
    }).join('');

    const controlLecheroHtml = controlLechero.slice(0, 10).map(c => `
      <div class="card p-12 mb-10" data-tipo="${c.organismo_control || 'DHI'}" style="border-left: 3px solid var(--c-purple);">
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

    container.innerHTML = `
      <div class="p-16">
        <div class="flex items-center justify-between mb-14">
          <div class="flex items-center gap-12">
            <span class="text-2xl" style="color: var(--c-accent); display: inline-flex; align-items: center;">${Icons.analitica()}</span>
            <div>
              <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin: 0; line-height: 1.2;">
                <span style="color: var(--c-accent); margin-right: 4px;">|</span> Control Lechero
              </h1>
              <div class="text-gray" style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Analíticas y controles oficiales</div>
            </div>
          </div>
        </div>

        <fieldset class="erp-action-group">
          <legend>Registro de Analíticas</legend>
          <div class="erp-action-group-body">
            <button class="widget-link-btn widget-link-btn--neon neon-accent" onclick="window.AnaliticaLecheWizard.open()">${Icons.analitica()}<span class="widget-link-label">Nueva Analítica</span></button>
          </div>
        </fieldset>

        <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-5" style="display: flex; align-items: center; gap: 4px; margin-top: 15px;">
          ${Icons.analitica()} Analíticas de Leche
        </div>
        <div class="erp-filtros" data-filtros-para="lacteo-analiticas-lista">
          <input type="search" class="form-input search-input" placeholder="Buscar analítica por fecha, laboratorio o estado...">
          <select class="form-select" data-etiqueta-todos="Todo muestreo"></select>
        </div>
        <div id="lacteo-analiticas-lista" data-ver-mas="10">
        ${analiticasHtml || '<div class="p-14 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-xs uppercase font-900 tracking-widest">Sin analíticas registradas</span></div>'}
        </div>

        <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-5" style="display: flex; align-items: center; gap: 4px; margin-top: 15px;">
          ${Icons.documento()} Controles Oficiales (DHI)
        </div>
        <div class="erp-filtros" data-filtros-para="lacteo-controles-lista">
          <input type="search" class="form-input search-input" placeholder="Buscar control por fecha u organismo...">
          <select class="form-select" data-etiqueta-todos="Todo organismo"></select>
        </div>
        <div id="lacteo-controles-lista" data-ver-mas="10">
        ${controlLecheroHtml || '<div class="p-14 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-xs uppercase font-900 tracking-widest">Sin controles lecheros registrados</span></div>'}
        </div>
      </div>
    `;
  },

  async renderBalance(container) {
    if (!container) return;
    const fincaId = await window.Fincas.getActiveId();
    const balanceMovs = await window.db.getAllFromIndex('balance_lacteo', 'fincaId', fincaId).catch(() => []);
    balanceMovs.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    const movimientosHtml = balanceMovs.slice(0, 30).map(m => {
      const icon = m.tipo_movimiento === 'entrada' ? '↓' : (m.tipo_movimiento === 'salida' ? '↑' : '•');
      const color = m.tipo_movimiento === 'entrada' ? 'var(--c-success)' : 'var(--c-danger)';
      return `
        <div class="card p-10 mb-8" data-tipo="${m.tipo_movimiento || 'otro'}" style="border-left: 3px solid ${color};">
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
          <div class="flex gap-6 mt-8 justify-end">
            <button class="btn-erp-secondary btn-sm" onclick="ExplotacionLacteaView._editarMovimiento(${m.id})">Editar</button>
            <button class="btn-erp-secondary btn-sm" onclick="ExplotacionLacteaView._eliminarMovimiento(${m.id})">Eliminar</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="p-16">
        <div class="flex items-center justify-between mb-14">
          <div class="flex items-center gap-12">
            <span class="text-2xl" style="color: var(--c-info); display: inline-flex; align-items: center;">${Icons.documento()}</span>
            <div>
              <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin: 0; line-height: 1.2;">
                <span style="color: var(--c-info); margin-right: 4px;">|</span> Balance Lácteo
              </h1>
              <div class="text-gray" style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Movimientos de tanque (más reciente primero)</div>
            </div>
          </div>
        </div>

        <fieldset class="erp-action-group">
          <legend>Registro de Movimientos</legend>
          <div class="erp-action-group-body">
            <button class="widget-link-btn widget-link-btn--neon neon-info" onclick="window.MovimientoBalanceWizard.open()">${Icons.agregar()}<span class="widget-link-label">Registrar Movimiento</span></button>
          </div>
        </fieldset>

        <div class="erp-filtros" data-filtros-para="lacteo-movimientos-lista">
          <input type="search" class="form-input search-input" placeholder="Buscar movimiento por fecha, litros o referencia...">
          <select class="form-select" data-etiqueta-todos="Todo movimiento"></select>
        </div>
        <div id="lacteo-movimientos-lista" data-ver-mas="10">
        ${movimientosHtml || '<div class="p-14 text-center bg-dark rounded-sm border border-222"><span class="text-555 text-xs uppercase font-900 tracking-widest">Sin movimientos registrados</span></div>'}
        </div>
      </div>
    `;
  },

  async renderGraficos(container) {
    if (!container) return;
    const fincaId = await window.Fincas.getActiveId();

    container.innerHTML = `
      <div class="p-16">
        <div class="flex items-center gap-12 mb-14">
          <span class="text-2xl" style="color: var(--c-info); display: inline-flex; align-items: center;">${Icons.grafico()}</span>
          <div>
            <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin: 0; line-height: 1.2;">
              <span style="color: var(--c-info); margin-right: 4px;">|</span> Gráficos y Análisis
            </h1>
            <div class="text-gray" style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Visualización de datos lácteos</div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-12">
          <div class="card p-12">
            <div class="chart-wrap"><canvas id="chart-produccion-mensual" class="chart-canvas"></canvas></div>
          </div>
          <div class="card p-12">
            <div class="chart-wrap"><canvas id="chart-calidad-leche" class="chart-canvas"></canvas></div>
          </div>
          <div class="card p-12">
            <div class="chart-wrap"><canvas id="chart-composicion" class="chart-canvas"></canvas></div>
          </div>
          <div class="card p-12">
            <div class="chart-wrap"><canvas id="chart-comparativa-tanques" class="chart-canvas"></canvas></div>
          </div>
          <div class="card p-12">
            <div class="chart-wrap"><canvas id="chart-curva-lactacion" class="chart-canvas"></canvas></div>
          </div>
        </div>
      </div>
    `;

    // Cargar Chart.js y renderizar gráficos
    if (window.GraficosLacteoService) {
      await Promise.all([
        window.GraficosLacteoService.renderProduccionMensual('chart-produccion-mensual', fincaId),
        window.GraficosLacteoService.renderCalidadLeche('chart-calidad-leche', fincaId),
        window.GraficosLacteoService.renderComposicion('chart-composicion', fincaId),
        window.GraficosLacteoService.renderComparativaTanques('chart-comparativa-tanques', fincaId)
      ]);
      
      // Curva de lactación - requiere selector de animal
      await this._renderCurvaLactacionSelector(fincaId);
    }
  },

  async _renderCurvaLactacionSelector(fincaId) {
    // Obtener animales del rebaño lechero
    const rebanos = await window.db.getAll('rebanos').catch(() => []);
    const rebanosLeche = rebanos.filter(r => {
      const tipo = (r.tipo || '').toLowerCase();
      return tipo.includes('láct') || tipo.includes('lact') || tipo.includes('mixt');
    });
    
    let animalesLeche = [];
    for (const reb of rebanosLeche) {
      const animales = await window.db.getAllFromIndex('animales', 'rebanoId', reb.id).catch(() => []);
      animalesLeche.push(...animales);
    }

    const opcionesAnimal = animalesLeche.map(a => 
      `<option value="${a.id}">${a.numero_identificacion || a.nombre || `Animal ${a.id}`}</option>`
    ).join('');

    // Insertar selector antes del canvas
    const canvas = document.getElementById('chart-curva-lactacion');
    if (!canvas) return;
    
    const selectorHtml = `
      <div class="flex items-center gap-10 mb-12">
        <label class="text-sm font-900 uppercase">Seleccionar Animal:</label>
        <select id="select-animal-lactacion" class="wizard-input font-800" style="flex: 1;">
          <option value="">— Seleccionar —</option>
          ${opcionesAnimal}
        </select>
      </div>
    `;
    
    canvas.insertAdjacentHTML('beforebegin', selectorHtml);

    // Event listener para cambiar de animal
    const select = document.getElementById('select-animal-lactacion');
    if (select) {
      select.addEventListener('change', async (e) => {
        const animalId = parseInt(e.target.value);
        if (animalId && window.GraficosLacteoService) {
          await window.GraficosLacteoService.renderCurvaLactacion('chart-curva-lactacion', fincaId, animalId);
        }
      });
    }
  },

  async renderCurvaLactacion(container) {
    if (!container) return;
    const fincaId = await window.Fincas.getActiveId();

    // Obtener animales del rebaño lechero
    const rebanos = await window.db.getAll('rebanos').catch(() => []);
    const rebanosLeche = rebanos.filter(r => {
      const tipo = (r.tipo || '').toLowerCase();
      return tipo.includes('láct') || tipo.includes('lact') || tipo.includes('mixt');
    });
    
    let animalesLeche = [];
    for (const reb of rebanosLeche) {
      const animales = await window.db.getAllFromIndex('animales', 'rebanoId', reb.id).catch(() => []);
      animalesLeche.push(...animales);
    }

    const opcionesAnimal = animalesLeche.map(a => 
      `<option value="${a.id}">${a.numero_identificacion || a.nombre || `Animal ${a.id}`}</option>`
    ).join('');

    container.innerHTML = `
      <div class="p-16">
        <div class="flex items-center gap-12 mb-14">
          <span class="text-2xl" style="color: var(--c-info); display: inline-flex; align-items: center;">${Icons.animales()}</span>
          <div>
            <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin: 0; line-height: 1.2;">
              <span style="color: var(--c-info); margin-right: 4px;">|</span> Curva de Lactación
            </h1>
            <div class="text-gray" style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Producción individual por animal</div>
          </div>
        </div>

        <div class="card p-12 mb-12">
          <div class="flex items-center gap-10">
            <label class="text-sm font-900 uppercase">Seleccionar Animal:</label>
            <select id="select-animal-lactacion" class="wizard-input font-800" style="flex: 1;">
              <option value="">— Seleccionar —</option>
              ${opcionesAnimal}
            </select>
          </div>
        </div>

        <div class="card p-12">
          <canvas id="chart-curva-lactacion" style="height: 300px;"></canvas>
        </div>
      </div>
    `;

    // Event listener para cambiar de animal
    const select = document.getElementById('select-animal-lactacion');
    if (select && window.GraficosLacteoService) {
      select.addEventListener('change', async (e) => {
        const animalId = parseInt(e.target.value);
        if (animalId) {
          await window.GraficosLacteoService.renderCurvaLactacion('chart-curva-lactacion', fincaId, animalId);
        }
      });
    }
  }
};
