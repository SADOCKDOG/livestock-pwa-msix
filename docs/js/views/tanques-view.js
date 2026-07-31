/**
 * Vista de Gestión de Tanques de Leche
 * Módulo Lácteo Integral (v24)
 */
window.TanquesView = {
  async render(container) {
    const App = window.App;
    const fincaId = await window.Fincas.getActiveId();

    const tanques = window.TanquesLeche ? await window.BalanceLacteo.getTanqueConStock(fincaId) : [];

    let html = `
    <div class="p-16">
      <div class="flex items-center justify-between mb-16">
        <h2 class="text-lg font-900 uppercase tracking-tight" style="color:var(--c-info);">Tanques de Leche</h2>
        <button onclick="window.TanqueWizard.open()" class="text-xs px-12 py-6 font-900 uppercase" style="background:var(--c-info); color:#000; border:none; border-radius:6px;">+ Nuevo Tanque</button>
      </div>`;

    if (tanques.length === 0) {
      html += `
      <div class="card p-30 text-center">
        <div class="text-aaa text-sm mb-12">No hay tanques registrados</div>
        <div class="text-[0.6rem] text-666 mb-16">Registra los tanques de frío de tu explotación con su código oficial Letra Q para poder comercializar leche.</div>
        <button onclick="window.TanqueWizard.open()" class="px-20 py-10 font-900" style="background:var(--c-info); color:#000; border:none; border-radius:6px;">Registrar primer tanque</button>
      </div>`;
    }

    for (const t of tanques) {
      const pct = t.porcentaje_llenado || 0;
      const tempColor = t.temperatura_actual != null ? (t.temperatura_actual <= 4 ? 'var(--c-success)' : (t.temperatura_actual <= 6 ? 'var(--c-warning)' : 'var(--c-danger)')) : 'var(--c-aaa)';
      const estadoColor = t.estado === 'activo' ? 'var(--c-success)' : (t.estado === 'mantenimiento' ? 'var(--c-warning)' : 'var(--c-danger)');

      let historialHtml = '';
      if (window.BalanceLacteo) {
        const historial = await window.BalanceLacteo.getHistorialTanque(t.id);
        const ultimos5 = historial.slice(0, 5);
        if (ultimos5.length > 0) {
          historialHtml = `
          <div class="mt-10 pt-10" style="border-top:1px solid var(--c-222);">
            <div class="text-[0.5rem] text-aaa uppercase font-800 mb-6">Últimos movimientos</div>
            ${ultimos5.map(m => {
              const icon = m.tipo_movimiento === 'entrada' ? '↓' : (m.tipo_movimiento === 'salida' ? '↑' : '•');
              const color = m.tipo_movimiento === 'entrada' ? 'var(--c-success)' : 'var(--c-danger)';
              return `<div class="flex justify-between text-[0.55rem] font-700 mb-2">
                <span style="color:${color};">${icon} ${m.tipo_movimiento.toUpperCase()}</span>
                <span>${m.cantidad_litros.toLocaleString('es-ES')}L</span>
                <span class="text-aaa">${m.fecha?.split('T')[0] || ''}</span>
              </div>`;
            }).join('')}
          </div>`;
        }
      }

      html += `
      <div class="card p-14 mb-12" style="border-left:3px solid var(--c-info);">
        <div class="flex items-center justify-between mb-10">
          <div>
            <div class="text-sm font-900 uppercase">${t.nombre}</div>
            <div class="text-[0.55rem] font-700" style="color:var(--c-info);">Letra Q: ${t.codigo_letra_q}</div>
          </div>
          <div class="flex items-center gap-6">
            <span class="text-[0.5rem] font-900 uppercase px-6 py-2 rounded-sm" style="background:${estadoColor}20; color:${estadoColor}; border:1px solid ${estadoColor}40;">${t.estado}</span>
            <span class="text-[0.5rem] font-800 px-6 py-2 rounded-sm" style="background:var(--c-222); color:var(--c-aaa);">${t.tipo === 'tanque_frio' ? 'Tanque' : (t.tipo === 'cantara' ? 'Cántara' : 'Cisterna')}</span>
          </div>
        </div>

        <div class="mb-10">
          <div class="flex justify-between text-[0.6rem] font-800 mb-4">
            <span>Stock: ${t.stock_actual.toLocaleString('es-ES')}L / ${t.capacidad_litros.toLocaleString('es-ES')}L</span>
            <span style="color:${pct > 90 ? 'var(--c-danger)' : (pct > 70 ? 'var(--c-warning)' : 'var(--c-success)')};">${pct}%</span>
          </div>
          <div style="background:var(--c-222); border-radius:4px; height:14px; overflow:hidden;">
            <div style="width:${Math.min(pct, 100)}%; height:100%; background:${pct > 90 ? 'var(--c-danger)' : (pct > 70 ? 'var(--c-warning)' : 'var(--c-info)')}; transition:width 0.3s;"></div>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-8 text-center">
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">Temp. Actual</div>
            <div class="text-xs font-900" style="color:${tempColor};">${t.temperatura_actual != null ? t.temperatura_actual + '°C' : '—'}</div>
          </div>
          <div>
            <div class="text-[0.5rem] text-aaa uppercase">Temp. Objetivo</div>
            <div class="text-xs font-900">${t.temperatura_objetivo}°C</div>
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

        ${historialHtml}

        <div class="flex gap-6 mt-10">
          <button onclick='window.TanqueWizard.open(${JSON.stringify(t)})' class="text-[0.55rem] font-800 px-8 py-4 rounded-sm" style="background:var(--c-222); color:var(--c-aaa);">Editar</button>
          ${t.estado === 'activo' ? `<button onclick="window.TanquesLeche.registrarLimpieza(${t.id})" class="text-[0.55rem] font-800 px-8 py-4 rounded-sm" style="background:var(--c-success)20; color:var(--c-success);">Registrar Limpieza</button>` : ''}
        </div>
      </div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
  }
};
