/**
 * Livestock Manager - BitacoraAnimalView v1.0.0
 * Vistas filtradas por animal: Comentarios, Condición Corporal, Reubicaciones
 * (gaps "Histórico/Bitácora Comentarios/Cond. Corporal/Reubicaciones" de
 * docs/AUDITAR/AUDITORIA-BASEDEDATOS-LEGACY.md). Los datos ya se capturaban
 * (registro_eventos, Pesajes) pero solo se veían mezclados en la línea de
 * tiempo general de Trazabilidad 360°. No toca el modelo SIGGAN.
 */
const BitacoraAnimalView = {
  async render(params) {
    const id = Number(params.get("id"));
    const animal = await Animales.get(id);
    if (!animal) {
      App.toastError("Animal no encontrado");
      location.hash = "#/animales";
      return;
    }

    const eventos = await window.db.getAllFromIndex('registro_eventos', 'entidad_id', id).catch(() => []);
    const animalEventos = eventos.filter(e => e.tipo_entidad === 'animal');

    const comentarios = animalEventos
      .filter(e => e.motivo_tarea === 'comentario_animal')
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const pesajesConBcs = animalEventos
      .filter(e => e.condicion_corporal != null)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const reubicaciones = animalEventos
      .filter(e => e.motivo_tarea === 'traslado_interno')
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    document.getElementById("app-content").innerHTML = `
      <div class="mb-20"><a href="#" onclick="location.hash='/animal?id=${id}'; return false;" class="link-back">← Volver a la ficha</a><h2 class="mt-10 font-900 uppercase tracking-wider"><span style="color: var(--neon);">|</span> ${Icons.documento()} BITÁCORA: ${animal.numero_identificacion}</h2></div>

      <div class="card p-16 mb-20" style="border: 1px solid var(--c-gold); background: rgba(255,255,255,0.02);">
        <div class="section-header-theme mb-12" style="--theme-color: var(--c-orange);"><span style="color: var(--c-gold); margin-right: 4px;">|</span> ${Icons.documento()} COMENTARIOS (${comentarios.length})</div>
        <div class="wizard-input-group mb-10">
          <textarea id="bit-nuevo-comentario" class="wizard-input min-h-60 resize-none" placeholder="Escribe una nota sobre este animal..."></textarea>
        </div>
        <button class="btn btn-secondary w-full mb-15" onclick="BitacoraAnimalView._agregarComentario(${id})">${Icons.agregar()} Añadir comentario</button>
        <div class="flex flex-col gap-8" style="max-height: 260px; overflow-y: auto;">
          ${comentarios.length === 0 ? '<div class="text-center py-15 text-gray-500 font-bold uppercase text-[0.6rem]">Sin comentarios registrados</div>' :
            comentarios.map(c => `
              <div class="p-10 rounded-sm border border-222" style="background:#141414;">
                <div class="text-[0.55rem] font-bold text-gray-500 uppercase mb-4">${c.fecha}</div>
                <div class="text-xs text-white">${(c.descripcion || '').replace(/</g, '&lt;')}</div>
              </div>`).join('')}
        </div>
      </div>

      <div class="card p-16 mb-20" style="border: 1px solid var(--c-info); background: rgba(255,255,255,0.02);">
        <div class="section-header-theme mb-12" style="--theme-color: var(--c-info);"><span style="color: var(--c-info); margin-right: 4px;">|</span> ${Icons.balanza()} EVOLUCIÓN CONDICIÓN CORPORAL (${pesajesConBcs.length})</div>
        <div class="flex flex-col gap-8" style="max-height: 260px; overflow-y: auto;">
          ${pesajesConBcs.length === 0 ? '<div class="text-center py-15 text-gray-500 font-bold uppercase text-[0.6rem]">Sin registros de condición corporal</div>' :
            pesajesConBcs.map(p => `
              <div class="flex justify-between items-center p-10 rounded-sm border border-222" style="background:#141414;">
                <div>
                  <div class="text-[0.55rem] font-bold text-gray-500 uppercase">${p.fecha}</div>
                  ${p.valor_neto ? `<div class="text-[0.6rem] text-aaa uppercase mt-2">Peso: ${p.valor_neto} ${p.unidad || 'kg'}</div>` : ''}
                </div>
                <strong class="text-lg font-black" style="color: var(--c-info);">${p.condicion_corporal}<span class="text-xs text-gray-500">/9</span></strong>
              </div>`).join('')}
        </div>
      </div>

      <div class="card p-16 mb-20" style="border: 1px solid var(--c-amber); background: rgba(255,255,255,0.02);">
        <div class="section-header-theme mb-12" style="--theme-color: var(--c-orange);"><span style="color: var(--c-amber); margin-right: 4px;">|</span> ${Icons.zonas()} HISTÓRICO DE REUBICACIONES (${reubicaciones.length})</div>
        <div class="flex flex-col gap-8" style="max-height: 260px; overflow-y: auto;">
          ${reubicaciones.length === 0 ? '<div class="text-center py-15 text-gray-500 font-bold uppercase text-[0.6rem]">Sin reubicaciones registradas</div>' :
            reubicaciones.map(r => `
              <div class="p-10 rounded-sm border border-222" style="background:#141414;">
                <div class="text-[0.55rem] font-bold text-gray-500 uppercase mb-4">${r.fecha}</div>
                <div class="text-xs text-white">${(r.descripcion || 'Traslado interno').replace(/</g, '&lt;')}</div>
              </div>`).join('')}
        </div>
      </div>
    `;
  },

  async _agregarComentario(animalId) {
    const textarea = document.getElementById('bit-nuevo-comentario');
    const texto = textarea?.value || '';
    try {
      await Animales.agregarComentario(animalId, texto);
      App.toast("Comentario añadido", "success");
      const params = new URLSearchParams(`id=${animalId}`);
      await BitacoraAnimalView.render(params);
    } catch (e) {
      App.toastError(e.message);
    }
  }
};

window.BitacoraAnimalView = BitacoraAnimalView;
