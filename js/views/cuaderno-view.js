/**
 * Livestock Manager - CuadernoDigitalView v1.0.0
 * Cuaderno Digital de Explotación Ganadera (RD 787/2023)
 *
 * Agrega todos los registros obligatorios en un informe único
 * con validez oficial, exportable a PDF.
 *
 * Secciones:
 *   1. Explotación  2. Censo  3. Movimientos  4. Sanidad
 *   5. Reproducción  6. Producción  7. Alimentación  8. Incidencias
 */

const CuadernoDigitalView = {

  async render() {
    const main = document.getElementById('app-content');
    main.innerHTML = `<div class="text-center p-40"><div class="loader">Generando Cuaderno Digital...</div></div>`;

    try {
      const data = await this._recopilarDatos();
      this._renderContenido(main, data);
    } catch (e) {
      console.error('[CuadernoDigital] Error:', e);
      main.innerHTML = `<div class="card text-center p-40 text-red">Error al generar Cuaderno Digital: ${e.message}</div>`;
    }
  },

  async _recopilarDatos() {
    const finca = await Fincas.getActive();
    const activeId = await Fincas.getActiveId();
    const [animales, rebanos, sanitarios, eventos, reproduccion,
           ventasCarne, ventasLeche, pesajes, transportistas, docs,
           movimientos, saneamientos] = await Promise.all([
      window.db.getAll('animales').catch(() => []),
      window.db.getAll('rebanos').catch(() => []),
      window.db.getAll('sanitarios_ganado').catch(() => []),
      window.db.getAll('registro_eventos').catch(() => []),
      window.db.getAll('reproduccion_eventos').catch(() => []),
      window.db.getAll('comercializacion_carne').catch(() => []),
      window.db.getAll('comercializacion_leche').catch(() => []),
      window.db.getAll('produccion_carne').catch(() => []),
      window.db.getAll('transportistas').catch(() => []),
      window.db.getAll('documentos_legales').catch(() => []),
      window.db.getAll('movimientos_ganado').catch(() => []),
      window.db.getAll('saneamientos').catch(() => []),
    ]);

    const activos = animales.filter(a => a.estado === 'activo' || a.estado === 'Activo');
    const rebanosIdx = {};
    rebanos.forEach(r => { rebanosIdx[r.id] = r; });

    // Especies y categorías
    const censoPorEspecie = {};
    activos.forEach(a => {
      const esp = a.especie || 'Sin especie';
      if (!censoPorEspecie[esp]) censoPorEspecie[esp] = { total: 0, hembras: 0, machos: 0, categorias: {} };
      censoPorEspecie[esp].total++;
      if (a.sexo === 'H' || (a.sexo || '').toLowerCase() === 'hembra') censoPorEspecie[esp].hembras++;
      if (a.sexo === 'M' || (a.sexo || '').toLowerCase() === 'macho') censoPorEspecie[esp].machos++;
      const cat = a.categoria || 'Sin categoría';
      if (!censoPorEspecie[esp].categorias[cat]) censoPorEspecie[esp].categorias[cat] = 0;
      censoPorEspecie[esp].categorias[cat]++;
    });

    // Métricas de sanidad
    const tratamientosActivos = sanitarios.filter(t => {
      if (!t.fecha || !t.tiempo_espera_carne_dias) return false;
      const fechaTrat = new Date(t.fecha);
      const diasPasados = Math.floor((new Date() - fechaTrat) / (1000 * 60 * 60 * 24));
      return diasPasados < t.tiempo_espera_carne_dias;
    });

    // KPIs reproductivos
    const partos = reproduccion.filter(e => (e.tipo || '').toLowerCase().includes('parto'));
    const cubriciones = reproduccion.filter(e => (e.tipo || '').toLowerCase().includes('cubricion') || e.tipo?.toLowerCase().includes('celo'));
    const gestaciones = reproduccion.filter(e => (e.resultado || '').toLowerCase().includes('gestante') || e.resultado?.toLowerCase().includes('positivo'));

    // Incidencias / mortalidad
    const bajas = animales.filter(a => a.estado === 'baja' || a.estado === 'Baja' || a.estado === 'muerto' || a.estado === 'Muerto');
    const incidenciasEventos = eventos.filter(e =>
      (e.motivo_tarea || '').toLowerCase().includes('baja') ||
      (e.motivo_tarea || '').toLowerCase().includes('muerte') ||
      (e.tipo || '').toLowerCase().includes('incidencia')
    );

    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const bajasAnio = bajas.filter(a => a.fecha_baja && new Date(a.fecha_baja) >= yearStart).length;

    // Secciones SIGGAN: entradas, salidas, nacimientos, muertes (del año en curso)
    const movsAnio = movimientos.filter(m => m.fecha && new Date(m.fecha) >= yearStart);
    const entradas = movsAnio.filter(m => m.tipo === 'entrada');
    const salidas = movsAnio.filter(m => m.tipo === 'salida');
    const nacimientos = animales.filter(a =>
      (a.tipoAlta === 'Nacimiento' || !a.tipoAlta) &&
      (a.fecha_alta || a.fecha_nacimiento) &&
      new Date(a.fecha_alta || a.fecha_nacimiento) >= yearStart
    );
    const muertes = bajas.filter(a =>
      ['muerte', 'sacrificio', 'sacrificio_obligatorio', 'autoconsumo'].includes(a.motivo_baja) &&
      a.fecha_baja && new Date(a.fecha_baja) >= yearStart
    );

    return {
      finca,
      censo: censoPorEspecie,
      totalActivos: activos.length,
      rebanos,
      animales: activos,
      todosAnimales: animales,
      sanitarios: sanitarios.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)),
      tratamientosActivos,
      eventos: eventos.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)),
      reproduccion: reproduccion.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)),
      partos: partos.length,
      cubriciones: cubriciones.length,
      gestaciones: gestaciones.length,
      ventasCarne: ventasCarne.sort((a, b) => new Date(b.fechaSacrificio || 0) - new Date(a.fechaSacrificio || 0)),
      ventasLeche: ventasLeche.sort((a, b) => new Date(b.fechaRecogida || 0) - new Date(a.fechaRecogida || 0)),
      pesajes,
      transportistas,
      docs,
      movimientos: movimientos.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)),
      saneamientos: saneamientos.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)),
      entradas,
      salidas,
      nacimientos,
      muertes,
      bajasAnio,
      totalBajas: bajas.length,
      totalIncidencias: incidenciasEventos.length,
      year,
    };
  },

  _renderContenido(main, d) {
    const f = d.finca || {};

    main.innerHTML = `
    <div style="max-width:900px; margin:0 auto;">
      <!-- KPIs -->
      <div class="grid grid-cols-4 gap-6 mb-14">
        <div class="info-box-center" style="background:#1e1e1e;"><small class="s-lbl">${Icons.rebanos()} CENSO</small><div class="inf-val-lg text-green">${d.totalActivos}</div></div>
        <div class="info-box-center" style="background:#1e1e1e;"><small class="s-lbl">${Icons.reproduccion()} REPROD.</small><div class="inf-val-lg text-blue">${d.partos} ${d.partos === 1 ? 'parto' : 'partos'}</div></div>
        <div class="info-box-center" style="background:#1e1e1e;"><small class="s-lbl">${Icons.sanidad()} SANIDAD</small><div class="inf-val-lg text-red">${d.tratamientosActivos.length} ${d.tratamientosActivos.length === 1 ? "activo" : "activos"}</div></div>
        <div class="info-box-center" style="background:#1e1e1e;"><small class="s-lbl">${Icons.comercial()} VENTAS</small><div class="inf-val-lg text-amber">${d.ventasCarne.length + d.ventasLeche.length}</div></div>
      </div>

      <!-- Navegación rápida -->
      <div class="flex flex-wrap gap-4 mb-14 hscroll-wrap">
        ${[['seccion-censo',`${Icons.rebanos()} Censo`],['seccion-movimientos',`${Icons.rotacion()} Movimientos`],['seccion-sanidad',`${Icons.sanidad()} Sanidad`],['seccion-repro',`${Icons.reproduccion()} Repro`],['seccion-produccion',`${Icons.grafico()} Producción`],['seccion-economico',`${Icons.dinero()} Económico`]].map(([id, label]) => {
          return `<a href="#${id}" class="btn btn-secondary btn-xs" style="padding:4px 10px;font-size:0.7rem;border-radius:10px;text-decoration:none;" onclick="document.getElementById('${id}')?.scrollIntoView({behavior:'smooth'});return false;">${label}</a>`;
        }).join('')}
      </div>

      <!-- Cabecera -->
      <div class="text-center mb-25">
        <div class="text-gold text-82">RD 787/2023 — Explotación Ganadera</div>
        <div class="mt-8 flex justify-center gap-10 flex-wrap">
          <button class="btn btn-primary" onclick="CuadernoDigitalView._exportarPDF()">${Icons.exportar()} Exportar PDF Completo</button>
          <button class="btn btn-secondary" onclick="CuadernoDigitalView._exportarCSV()">${Icons.grafico()} Exportar CSV (SIGGAN)</button>
          <button class="btn btn-secondary" onclick="CuadernoDigitalView._imprimir()">${Icons.documento()} Imprimir</button>
        </div>
      </div>

      <!-- 1. EXPLOTACIÓN -->
      <div class="card" style="margin-bottom: 20px;">
        <h3 class="section-h3 text-gold" style="border-bottom: none; padding-bottom: 0; margin-bottom: 18px;"><span style="color: var(--c-warning); margin-right: 4px;">|</span> 1. ${Icons.home()} DATOS DE LA EXPLOTACIÓN</h3>
        <div class="grid grid-cols-2 gap-6 text-85">
          <div><span class="text-gray">Nombre:</span> <strong class="text-white">${f.nombre || '—'}</strong></div>
          <div><span class="text-gray">Código REGA:</span> <strong class="text-gold">${f.codigo_REGA || f.rega || '—'}</strong></div>
          <div><span class="text-gray">CEA:</span> <strong class="text-white">${f.cea || '—'}</strong></div>
          <div><span class="text-gray">NIF:</span> <strong class="text-white">${f.nif || '—'}</strong></div>
          <div><span class="text-gray">Provincia:</span> <strong class="text-white">${f.provincia || '—'}</strong></div>
          <div><span class="text-gray">Municipio:</span> <strong class="text-white">${f.municipio || '—'}</strong></div>
          <div><span class="text-gray">CC.AA.:</span> <strong class="text-white">${(window.ComunidadesService && ComunidadesService.getConfiguracionCCAA(f.comunidad_autonoma)?.label) || f.comunidad_autonoma || '—'}</strong></div>
          <div><span class="text-gray">Tipo Explotación:</span> <strong class="text-white">${f.tipo_explotacion || '—'}</strong></div>
          <div><span class="text-gray">Sistema:</span> <strong class="text-white">${f.sistema_explotacion ? f.sistema_explotacion.charAt(0).toUpperCase() + f.sistema_explotacion.slice(1) : '—'}</strong></div>
          <div><span class="text-gray">ADSG:</span> <strong class="text-white">${f.adsg_nombre || '—'}</strong></div>
          <div><span class="text-gray">Veterinario:</span> <strong class="text-white">${f.adsg_veterinario || '—'}</strong></div>
          <div><span class="text-gray">Nº Colegiado:</span> <strong class="text-white">${f.adsg_vet_colegiado || '—'}</strong></div>
          <div><span class="text-gray">Contrato Lácteo:</span> <strong class="text-white">${f.contrato_lacteo_numero || '—'}</strong></div>
          <div><span class="text-gray">INFOLAC:</span> <strong class="text-white">${f.numero_infolac || '—'}</strong></div>
        </div>
      </div>

      <!-- 2. CENSO -->
      <div class="card" style="margin-bottom: 20px;">
        <h3 class="section-h3 text-blue-400" id="seccion-censo" style="border-bottom: none; padding-bottom: 0; margin-bottom: 18px;"><span style="color: var(--c-info); margin-right: 4px;">|</span> 2. ${Icons.rebanos()} CENSO ACTUAL <span class="text-gray font-normal text-2xs">(${d.year})</span></h3>
        <div class="text-3xl font-black text-white mb-10">${d.totalActivos} ${d.totalActivos === 1 ? 'animal activo' : 'animales activos'}</div>
        ${Object.entries(d.censo).length === 0 ? '<p class="empty-state-text mb-0">Sin animales registrados.</p>' : ''}
        ${Object.entries(d.censo).map(([especie, info]) => `
        <div class="rounded-sm p-10 mb-8 bg-dark">
          <div class="flex justify-between font-bold text-gold mb-6">
            <span>${especie}</span>
            <span>Total: ${info.total}</span>
          </div>
          <div class="text-gray text-82">
            ♀ ${info.hembras} ${info.hembras === 1 ? "hembra" : "hembras"} · ♂ ${info.machos} ${info.machos === 1 ? "macho" : "machos"}
          </div>
          <div class="mt-4 text-gray-500 text-75">
            ${Object.entries(info.categorias).map(([cat, cnt]) =>
              `<span class="rounded-sm tag-222">${cat}: ${cnt}</span>`
            ).join('')}
          </div>
        </div>
        `).join('')}
      </div>

      <!-- 3.b ENTRADAS / SALIDAS / NACIMIENTOS / MUERTES (SIGGAN) -->
      <div class="card" style="margin-bottom: 20px;">
        <h3 class="section-h3 text-purple-400" id="seccion-siggan-movs" style="border-bottom: none; padding-bottom: 0; margin-bottom: 18px;"><span style="color: var(--c-purple); margin-right: 4px;">|</span> 3.b ${Icons.documento()} LIBRO DE REGISTRO SIGGAN (${d.year})</h3>
        <div class="grid grid-cols-4 gap-10 mb-12">
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-green font-black text-2xl">${d.entradas.length}</div>
            <div class="text-gray text-2xs">Entradas</div>
          </div>
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-amber font-black text-2xl">${d.salidas.length}</div>
            <div class="text-gray text-2xs">Salidas</div>
          </div>
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-blue-400 font-black text-2xl">${d.nacimientos.length}</div>
            <div class="text-gray text-2xs">Nacimientos</div>
          </div>
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-red font-black text-2xl">${d.muertes.length}</div>
            <div class="text-gray text-2xs">Muertes</div>
          </div>
        </div>
        <div class="text-sm mh-220">
          ${d.movimientos.slice(0, 30).map(m =>
            `<div class="flex justify-between cuaderno-row">
              <span class="text-gray">${m.fecha || '—'}</span>
              <span class="${m.tipo === 'entrada' ? 'text-green' : 'text-amber'}">${(m.tipo || '').toUpperCase()}</span>
              <span class="text-ccc">Guía: ${m.numero_guia || '—'}</span>
              <span class="text-gold font-800">${m.rega_origen || '—'} → ${m.rega_destino || '—'}</span>
            </div>`
          ).join('') || '<p class="empty-state-text mb-0">Sin movimientos inter-explotación registrados.</p>'}
        </div>
      </div>

      <!-- 3. MOVIMIENTOS -->
      <div class="card" style="margin-bottom: 20px;">
        <h3 class="section-h3 text-purple-400" id="seccion-movimientos" style="border-bottom: none; padding-bottom: 0; margin-bottom: 18px;"><span style="color: var(--c-purple); margin-right: 4px;">|</span> 3. ${Icons.rotacion()} MOVIMIENTOS Y EVENTOS</h3>
        <div class="grid grid-cols-3 gap-10 mb-12">
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-green font-black text-2xl">${d.eventos.length}</div>
            <div class="text-gray text-2xs">Eventos totales</div>
          </div>
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-red font-black text-2xl">${d.bajasAnio}</div>
            <div class="text-gray text-2xs">Bajas este año</div>
          </div>
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-amber font-black text-2xl">${d.ventasCarne.length}</div>
            <div class="text-gray text-2xs">Expediciones</div>
          </div>
        </div>
        <div class="text-sm mh-200">
          ${d.eventos.slice(0, 30).map(e =>
            `<div class="flex justify-between cuaderno-row">
              <span class="text-gray">${e.fecha || '—'}</span>
              <span class="text-ccc">${(e.motivo_tarea || e.tipo || 'Evento').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())}</span>
              <span class="text-gray-500">${e.descripcion || e.notas || ''}</span>
            </div>`
          ).join('') || '<p class="empty-state-text mb-0">Sin eventos registrados.</p>'}
        </div>
      </div>

      <!-- 4. SANIDAD -->
      <div class="card" style="margin-bottom: 20px;">
        <h3 class="section-h3 text-red" id="seccion-sanidad" style="border-bottom: none; padding-bottom: 0; margin-bottom: 18px;"><span style="color: var(--c-danger); margin-right: 4px;">|</span> 4. ${Icons.sanidad()} Registro Sanitario</h3>
        <div class="grid grid-cols-2 gap-10 mb-12">
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-white font-black text-2xl">${d.sanitarios.length}</div>
            <div class="text-gray text-2xs">Tratamientos totales</div>
          </div>
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-amber font-black text-2xl">${d.tratamientosActivos.length}</div>
            <div class="text-gray text-2xs">En periodo supresión</div>
          </div>
        </div>
        <div class="text-sm mh-200">
          ${d.sanitarios.slice(0, 20).map(t => {
            const rb = d.rebanos.find(r => r.id === t.rebanoId);
            const CS = window.ComunidadesService;
            const motivo = t.motivo_tratamiento ? ` · ${CS ? CS.getMotivoTratamientoLabel(t.motivo_tratamiento) : t.motivo_tratamiento}` : '';
            const via = t.via_administracion ? ` · ${CS ? CS.getViaAdministracionLabel(t.via_administracion) : t.via_administracion}` : '';
            const vet = t.veterinario_prescriptor ? ` · Vet: ${t.veterinario_prescriptor}${t.veterinario_colegiado ? ' (' + t.veterinario_colegiado + ')' : ''}` : '';
            const receta = t.numero_receta ? ` · Receta ${t.numero_receta}` : '';
            return `<div class="cuaderno-row">
              <span class="text-gray">${t.fecha || '—'}</span>
              <span class="text-gold font-semibold">${t.medicamento || t.producto || '—'}</span>
              <span class="text-gray"> · ${rb?.nombre || ''}${motivo}${via}${vet}${receta}</span>
              <span class="text-gray-500 float-right">Espera: ${t.tiempo_espera_carne_dias ? t.tiempo_espera_carne_dias + 'd' : '—'}</span>
            </div>`;
          }).join('') || '<p class="empty-state-text mb-0">Sin tratamientos registrados.</p>'}
        </div>
      </div>

      <!-- 4.b SANEAMIENTOS / CAMPAÑAS OFICIALES (SIGGAN) -->
      <div class="card" style="margin-bottom: 20px;">
        <h3 class="section-h3 text-red" id="seccion-saneamientos" style="border-bottom: none; padding-bottom: 0; margin-bottom: 18px;"><span style="color: var(--c-danger); margin-right: 4px;">|</span> 4.b ${Icons.veterinario()} Campañas de Saneamiento (ADSG)</h3>
        <div class="text-sm mh-200">
          ${d.saneamientos.slice(0, 20).map(s =>
            `<div class="cuaderno-row">
              <span class="text-gray">${s.fecha || '—'}</span>
              <span class="text-gold font-semibold"> · ${(window.ComunidadesService && ComunidadesService.getCampanasSaneamiento ? (ComunidadesService.getCampanasSaneamiento().find(c => c.value === s.campana)?.label) : null) || s.campana || '—'}</span>
              <span class="text-gray"> · Examinados: ${s.num_examinados ?? s.examinados ?? '—'} / Positivos: ${s.num_positivos ?? s.positivos ?? '—'}</span>
              <span class="text-gray-500 float-right">${s.calificacion || ''}</span>
            </div>`
          ).join('') || '<p class="empty-state-text mb-0">Sin campañas de saneamiento registradas.</p>'}
        </div>
      </div>

      <!-- 5. REPRODUCCIÓN -->
      <div class="card" style="margin-bottom: 20px;">
        <h3 class="section-h3 text-pink" id="seccion-repro" style="border-bottom: none; padding-bottom: 0; margin-bottom: 18px;"><span style="color: var(--c-pink); margin-right: 4px;">|</span> 5. ${Icons.reproduccion()} Registro Reproductivo</h3>
        <div class="grid grid-cols-3 gap-10 mb-12">
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-violet font-black text-2xl">${d.cubriciones}</div>
            <div class="text-gray text-2xs">Cubriciones/Celos</div>
          </div>
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-amber font-black text-2xl">${d.gestaciones}</div>
            <div class="text-gray text-2xs">Gestaciones</div>
          </div>
          <div class="rounded-sm p-10 text-center bg-dark">
            <div class="text-green font-black text-2xl">${d.partos}</div>
            <div class="text-gray text-2xs">Partos</div>
          </div>
        </div>
        <div class="text-sm mh-150">
          ${d.reproduccion.slice(0, 15).map(e =>
            `<div class="flex justify-between cuaderno-row">
              <span class="text-gray">${e.fecha || '—'}</span>
              <span class="text-ccc">${(e.tipo || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())}</span>
              <span class="text-gray-500">${e.resultado || e.notas || ''}</span>
            </div>`
          ).join('') || '<p class="empty-state-text mb-0">Sin eventos reproductivos.</p>'}
        </div>
      </div>

      <!-- 6. PRODUCCIÓN -->
      <div class="card" style="margin-bottom: 20px;">
        <h3 class="section-h3 text-green" id="seccion-produccion" style="border-bottom: none; padding-bottom: 0; margin-bottom: 18px;"><span style="color: var(--c-success); margin-right: 4px;">|</span> 6. ${Icons.paquete()} Producción</h3>
        <div class="grid grid-cols-2 gap-10">
          <div class="rounded-sm p-12 bg-dark">
            <h4 class="text-gold mb-8 text-85 m-0">${Icons.leche()} Leche</h4>
            ${d.ventasLeche.length > 0 ? `
              <div class="text-white font-black text-lg">${Math.round(d.ventasLeche.reduce((s, v) => s + (v.litros || v.cantidad || 0), 0)).toLocaleString('es-ES')} L</div>
              <div class="text-gray text-2xs">${d.ventasLeche.length} ${d.ventasLeche.length === 1 ? "entrega" : "entregas"}</div>
            ` : '<div class="empty-state mb-0"><p class="empty-state-text">Sin datos de producción láctea.</p></div>'}
          </div>
          <div class="rounded-sm p-12 bg-dark">
            <h4 class="text-gold mb-8 text-85 m-0">${Icons.carne()} Carne</h4>
            ${d.ventasCarne.length > 0 ? `
              <div class="text-white font-black text-lg">${Math.round(d.ventasCarne.reduce((s, v) => s + (v.peso_canal || 0), 0)).toLocaleString('es-ES')} kg</div>
              <div class="text-gray text-2xs">${d.ventasCarne.length} ${d.ventasCarne.length === 1 ? "expedición" : "expediciones"}</div>
            ` : '<div class="empty-state mb-0"><p class="empty-state-text">Sin datos de producción cárnica.</p></div>'}
          </div>
        </div>
      </div>

      <!-- 7. RESUMEN ECONÓMICO -->
      <div class="card" style="margin-bottom: 20px;">
        <h3 class="section-h3 text-gold" id="seccion-economico" style="border-bottom: none; padding-bottom: 0; margin-bottom: 18px;"><span style="color: var(--c-warning); margin-right: 4px;">|</span> 7. ${Icons.dinero()} Resumen Económico</h3>
        <div class="grid grid-cols-2 gap-10">
          <div class="rounded-sm p-12 bg-dark">
            <div class="text-gray text-2xs">Ingresos Carne</div>
            <div class="text-xl font-black text-green">
              ${d.ventasCarne.reduce((s, v) => s + (v.precio_total || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
          </div>
          <div class="rounded-sm p-12 bg-dark">
            <div class="text-gray text-2xs">Ingresos Leche</div>
            <div class="text-xl font-black text-green">
              ${d.ventasLeche.reduce((s, v) => s + (v.precio_total || v.importe || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
          </div>
        </div>
      </div>

      <!-- 8. TRANSPORTISTAS -->
      <div class="card" style="margin-bottom: 20px;">
        <h3 class="section-h3 text-blue-400" style="border-bottom: none; padding-bottom: 0; margin-bottom: 18px;"><span style="color: var(--c-info); margin-right: 4px;">|</span> 8. ${Icons.transportistas()} Transportistas</h3>
        ${d.transportistas.length > 0 ? d.transportistas.map(t => `
        <div class="flex justify-between rounded-sm mb-6 bg-dark text-82 px-12 py-8">
          <span class="text-white">${t.nombre} (${t.nif_cif || t.nif || '—'})</span>
          <span class="text-gray">Matrícula: ${t.matricula || '—'}</span>
<span class="${t.certificado_bienestar_fin ? 'text-amber' : 'text-gray-500'}">Cert: ${t.certificado_bienestar_fin || 'No registrado'}</span>
        </div>`).join('') : '<p class="empty-state-text mb-0">Sin transportistas registrados.</p>'}
      </div>

      <!-- Pie -->
      <div class="text-center p-20 text-555 mt-25 text-2xs border-top-222">
        Documento generado el ${new Date().toLocaleString('es-ES')} · Cuaderno Digital RD 787/2023<br>
        Livestock Manager Premium — v${window.APP_INFO.version}
      </div>
    </div>`;
  },

  /**
   * Exportar PDF completo del Cuaderno Digital
   * Usa html2pdf + Capacitor Share / navigator.share
   */
  async _exportarPDF() {
    const finca = await Fincas.getActive().catch(() => null);
    const fechaHoy = new Date().toISOString().split('T')[0];
    const nombreFinca = (finca?.nombre || 'explotacion').replace(/\s+/g, '_').toLowerCase();
    const titulo = `Cuaderno_Digital_${nombreFinca}_${fechaHoy}`;
    const fileName = `${titulo}.pdf`;

    let loader;
    try {
      // Crear overlay de carga con barra de proceso
      loader = document.createElement('div');
      loader.id = 'pdf-loader-overlay';
      loader.style.cssText = `
        position:fixed; top:0; left:0; right:0; bottom:0; z-index:100000;
        background:rgba(0,0,0,0.85); display:flex; flex-direction:column;
        align-items:center; justify-content:center; color:#fff; font-family:sans-serif;
      `;
      loader.innerHTML = `
        <div class="pdf-loader">
          <div class="pdf-loader-icon" style="color:var(--p-gold); margin-bottom:15px; transform:scale(2);">${Icons.documento()}</div>
          <div class="pdf-loader-title">Generando PDF</div>
          <div class="pdf-loader-desc">Cuaderno Digital</div>
          <div class="pdf-loader-bar">
            <div id="pdf-progress-bar" class="pdf-loader-fill"></div>
          </div>
          <div id="pdf-progress-text" class="pdf-loader-status">PROCESANDO...</div>
        </div>
        
      `;
      document.body.appendChild(loader);

      const updateProgress = (pct, text) => {
        const bar = loader.querySelector('#pdf-progress-bar');
        const txt = loader.querySelector('#pdf-progress-text');
        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = text.toUpperCase();
      };

      if (typeof html2pdf === 'undefined' && !(await App._ensureHtml2Pdf())) {
        App.toastError('html2pdf no disponible');
        loader.remove();
        return;
      }

      updateProgress(20, 'Recopilando datos...');
      let data;
      try {
        data = await this._recopilarDatos();
      } catch (e) {
        console.warn("[Cuaderno] Error recopilando datos:", e);
        App.toastError("Error al obtener datos: " + e.message);
        loader.remove();
        return;
      }

      updateProgress(50, 'Generando contenido...');
      const contenidoHTML = this._generarHTMLImprimible(data);
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const pdfEl = document.createElement('div');
      pdfEl.style.cssText = `position:absolute; left:0; top:${currentScroll}px; z-index:9990; width:800px; background:#fff; color:#000; overflow:visible;`;
      pdfEl.innerHTML = `<div style="padding:30px; font-family:'Courier New',monospace; color:#000; background:#fff;">${contenidoHTML}</div>`;
      document.body.appendChild(pdfEl);

      updateProgress(80, 'Rasterizando PDF...');
      try {
        const pdfBlob = await html2pdf().set({
          margin: [12, 10, 12, 10],
          filename: fileName,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: 800,
            scrollX: 0,
            scrollY: currentScroll,
            height: pdfEl.scrollHeight,
            windowHeight: pdfEl.scrollHeight
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        }).from(pdfEl).toPdf().output('blob');

        document.body.removeChild(pdfEl);
        updateProgress(100, '¡Listo!');
        await new Promise(r => setTimeout(r, 400));
        loader.remove();

        // Compartir usando el mismo patrón que informes-view
        await this._ejecutarShare({
          blob: pdfBlob,
          fileName,
          mimeType: 'application/pdf',
          titulo: 'PDF',
          shareTitle: 'Cuaderno Digital de Explotación',
          shareText: `Cuaderno Digital — ${finca?.nombre || 'Explotación'}`,
        });
      } catch (e) {
        if (pdfEl.parentNode) document.body.removeChild(pdfEl);
        console.warn("[Cuaderno] html2pdf falló:", e);
        App.toastError("Error al generar PDF: " + e.message);
        loader.remove();
      }
    } catch (e) {
      console.error("[Cuaderno] Error inesperado:", e);
      if (loader) loader.remove();
    }
  },

  /**
   * Intenta compartir el PDF por todos los medios disponibles.
   * Idéntico al patrón usado en informes-view.js que funciona.
   */
  async _ejecutarShare(fileObj) {
    const { blob, fileName, mimeType, titulo, shareTitle, shareText } = fileObj;

    // 1️⃣ Capacitor Native Share (no necesita gesto)
    try {
      const cap = window.Capacitor;
      const fsPlugin = cap?.Plugins?.Filesystem;
      const sharePlugin = cap?.Plugins?.Share;
      if (fsPlugin && sharePlugin) {
        const dataUri = await this._blobToBase64(blob);
        const result = await fsPlugin.writeFile({
          path: fileName,
          data: dataUri.split(',')[1],
          directory: 'CACHE'
        });
        await sharePlugin.share({
          title: shareTitle,
          text: shareText,
          url: result.uri,
          files: [result.uri],
          dialogTitle: `Compartir ${titulo} con…`
        });
        App.toast(`${titulo} compartido`, 'success');
        return true;
      }
    } catch (e) {
      console.warn(`[Capacitor Share ${titulo}] falló:`, e?.message || e);
    }

    // 2️⃣ navigator.share con File (requiere gesto)
    try {
      if (navigator.share) {
        const file = new File([blob], fileName, { type: mimeType });
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file]
        });
        App.toast(`${titulo} compartido`, 'success');
        return true;
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn(`[navigator.share ${titulo}] falló:`, e?.message || e);
      } else {
        return true;
      }
    }

    // 3️⃣ Fallback: descarga directa con blob URL
    App.toast(`Descargando ${titulo}...`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    App.toast(`${titulo} descargado`, 'success');
    return false;
  },

  /** Convierte un Blob a base64 */
  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  /**
   * Renderiza el cuaderno en un modal de pantalla completa para imprimir
   * (en lugar de window.open que falla en Android/Capacitor)
   * El botón "Imprimir" genera PDF y usa Capacitor Share (que ofrece imprimir en Android)
   */
  _abrirVistaImprimible() {
    App.toast("Preparando impresión...");

    const contentHtml = `
      <div style="width:100%; height:100%; display:flex; flex-direction:column; background:#fff; overflow-y:auto;">
        <div style="position:sticky; top:0; z-index:10; background:#f5f5f5; padding:calc(12px + var(--safe-top, 0px)) 20px 12px; display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #d97706; -webkit-print-color-adjust:exact;">
          <span style="font-weight:bold; font-size:14px; color:#333;">Vista de Impresión — Cuaderno Digital</span>
          <div style="display:flex; gap:10px;">
            <button id="cuaderno-btn-print" style="padding:10px 24px; font-size:14px; cursor:pointer; background:#d97706; color:#fff; border:none; border-radius:6px; font-weight:bold;">Compartir / Imprimir PDF</button>
            <button id="cuaderno-btn-cerrar" style="padding:10px 20px; font-size:14px; cursor:pointer; background:#666; color:#fff; border:none; border-radius:6px;">${Icons.cerrar()} Cerrar</button>
          </div>
        </div>
        <div id="cuaderno-print-content" style="flex:1; padding:20px calc(20px) calc(20px + var(--safe-bottom, 0px)); font-family:'Courier New',monospace; color:#000; font-size:10px; line-height:1.4;"></div>
      </div>
    `;
    const overlay = ModalManager.show('cuaderno-print-overlay', contentHtml, { closeOnOverlayClick: false });
    overlay.style.alignItems = 'stretch';
    overlay.style.justifyContent = 'stretch';
    overlay.style.padding = '0';
    overlay.style.background = '#000';
    overlay.style.backdropFilter = 'none';
    overlay.style.webkitBackdropFilter = 'none';

    // Cargar datos y renderizar
    this._recopilarDatos().then(data => {
      const contenidoHTML = this._generarHTMLImprimible(data);
      document.getElementById('cuaderno-print-content').innerHTML = `
        <div style="max-width:180mm; margin:0 auto;">${contenidoHTML}</div>
      `;
      // Guardar datos para el botón de imprimir
      overlay._printData = data;
    }).catch(e => {
      console.error('[Cuaderno] Error al preparar impresión:', e);
      App.toastError('Error al preparar la impresión');
    });

    // Evento imprimir: generar PDF y compartir vía Capacitor/navigator
    document.getElementById('cuaderno-btn-print').onclick = async () => {
      if (!overlay._printData) {
        App.toastError('Datos aún cargando...');
        return;
      }

      let loader;
      try {
        // Crear overlay de carga con barra de proceso
        loader = document.createElement('div');
        loader.id = 'pdf-loader-overlay';
        loader.style.cssText = `
          position:fixed; top:0; left:0; right:0; bottom:0; z-index:100000;
          background:rgba(0,0,0,0.85); display:flex; flex-direction:column;
          align-items:center; justify-content:center; color:#fff; font-family:sans-serif;
        `;
        loader.innerHTML = `
          <div class="pdf-loader">
            <div class="pdf-loader-icon" style="color:var(--p-gold); margin-bottom:15px; transform:scale(2);">${Icons.documento()}</div>
            <div class="pdf-loader-title">Generando PDF</div>
            <div class="pdf-loader-desc">Cuaderno Digital</div>
            <div class="pdf-loader-bar">
              <div id="pdf-progress-bar" class="pdf-loader-fill"></div>
            </div>
            <div id="pdf-progress-text" class="pdf-loader-status">PROCESANDO...</div>
          </div>
          
        `;
        document.body.appendChild(loader);

        const updateProgress = (pct, text) => {
          const bar = loader.querySelector('#pdf-progress-bar');
          const txt = loader.querySelector('#pdf-progress-text');
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = text.toUpperCase();
        };

        if (typeof html2pdf === 'undefined' && !(await App._ensureHtml2Pdf())) {
          App.toastError('html2pdf no disponible');
          loader.remove();
          return;
        }

        const finca = overlay._printData.finca || {};
        const fechaHoy = new Date().toISOString().split('T')[0];
        const nombreFinca = (finca.nombre || 'explotacion').replace(/\s+/g, '_').toLowerCase();
        const fileName = `Cuaderno_Digital_${nombreFinca}_${fechaHoy}.pdf`;

        updateProgress(30, 'Generando contenido...');
        const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        const pdfEl = document.createElement('div');
        pdfEl.style.cssText = `position:absolute; left:0; top:${currentScroll}px; z-index:9990; width:800px; background:#fff; color:#000; overflow:visible;`;
        pdfEl.innerHTML = `<div style="padding:30px; font-family:'Courier New',monospace; color:#000; background:#fff;">${CuadernoDigitalView._generarHTMLImprimible(overlay._printData)}</div>`;
        document.body.appendChild(pdfEl);

        updateProgress(70, 'Rasterizando PDF...');
        const pdfBlob = await html2pdf().set({
          margin: [12, 10, 12, 10],
          filename: fileName,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: 800,
            scrollX: 0,
            scrollY: currentScroll,
            height: pdfEl.scrollHeight,
            windowHeight: pdfEl.scrollHeight
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        }).from(pdfEl).toPdf().output('blob');

        document.body.removeChild(pdfEl);
        updateProgress(100, '¡Listo!');
        await new Promise(r => setTimeout(r, 400));
        loader.remove();

        await this._ejecutarShare({
          blob: pdfBlob,
          fileName,
          mimeType: 'application/pdf',
          titulo: 'PDF',
          shareTitle: 'Cuaderno Digital de Explotación',
          shareText: `Cuaderno Digital — ${finca.nombre || 'Explotación'}`,
        });
      } catch (e) {
        console.error('[Cuaderno] Error al generar PDF:', e);
        App.toastError('Error al generar PDF');
        if (loader) loader.remove();
      }
    };

    // Cerrar
    document.getElementById('cuaderno-btn-cerrar').onclick = () => ModalManager.close('cuaderno-print-overlay');
  },

  _generarHTMLImprimible(d) {
    const f = d.finca || {};
    const crotalPorId = {};
    (d.todosAnimales || []).forEach(a => { crotalPorId[a.id] = a.numero_identificacion || a.crotal || a.identificacion || ''; });
    const totalLeche = d.ventasLeche.reduce((s, v) => s + (v.litros || v.cantidad || 0), 0);
    const totalCarneKg = d.ventasCarne.reduce((s, v) => s + (v.peso_canal || 0), 0);
    const ingresosCarne = d.ventasCarne.reduce((s, v) => s + (v.precio_total || 0), 0);
    const ingresosLeche = d.ventasLeche.reduce((s, v) => s + (v.precio_total || v.importe || 0), 0);

    return `
    <h1>CUADERNO DIGITAL DE EXPLOTACIÓN</h1>
    <p style="text-align:center; font-size:9px; color:#666;">Real Decreto 787/2023 · Generado: ${new Date().toLocaleString('es-ES')}</p>

    <h2>1. Datos de la Explotación</h2>
    <table>
      <tr><td width="30%"><b>Nombre</b></td><td>${f.nombre || '—'}</td><td width="30%"><b>REGA</b></td><td style="color:var(--p-gold); font-weight:bold;">${f.codigo_REGA || f.rega || '—'}</td></tr>
      <tr><td><b>CEA</b></td><td>${f.cea || '—'}</td><td><b>NIF</b></td><td>${f.nif || '—'}</td></tr>
      <tr><td><b>Provincia</b></td><td>${f.provincia || '—'}</td><td><b>Municipio</b></td><td>${f.municipio || '—'}</td></tr>
      <tr><td><b>CC.AA.</b></td><td>${(window.ComunidadesService && ComunidadesService.getConfiguracionCCAA(f.comunidad_autonoma)?.label) || f.comunidad_autonoma || '—'}</td><td><b>Tipo/Sistema</b></td><td>${f.tipo_explotacion || '—'} / ${f.sistema_explotacion ? f.sistema_explotacion.charAt(0).toUpperCase() + f.sistema_explotacion.slice(1) : '—'}</td></tr>
      <tr><td><b>ADSG</b></td><td>${f.adsg_nombre || '—'}</td><td><b>Veterinario</b></td><td>${f.adsg_veterinario || '—'} (${f.adsg_vet_colegiado || '—'})</td></tr>
    </table>

    <h2>2. Censo Actual (${d.year})</h2>
    <p><b>Total animales activos: ${d.totalActivos}</b></p>
    <table>
      <tr><th>Especie</th><th>Total</th><th>Hembras</th><th>Machos</th><th>Categorías</th></tr>
      ${Object.entries(d.censo).map(([esp, info]) => `
        <tr>
          <td>${esp}</td>
          <td>${info.total}</td>
          <td>${info.hembras}</td>
          <td>${info.machos}</td>
          <td>${Object.entries(info.categorias).map(([c, n]) => `${c}: ${n}`).join(', ')}</td>
        </tr>
      `).join('')}
    </table>

    <h2>3. Movimientos Inter-explotación (SIGGAN)</h2>
    <div class="grid3">
      <div class="stat-box"><div class="stat-num">${d.entradas.length}</div><div class="stat-label">Entradas (año)</div></div>
      <div class="stat-box"><div class="stat-num">${d.salidas.length}</div><div class="stat-label">Salidas (año)</div></div>
      <div class="stat-box"><div class="stat-num">${d.bajasAnio}</div><div class="stat-label">Bajas este año</div></div>
    </div>
    <h3 style="font-size:11px; margin:8px 0 4px;">3.1 Entradas</h3>
    ${d.entradas.length > 0 ? `
    <table>
      <tr><th>Fecha</th><th>Guía</th><th>REGA origen</th><th>REGA destino</th><th>Motivo</th><th>Transportista</th><th>Nº anim.</th></tr>
      ${d.entradas.map(m => `<tr><td>${m.fecha || '—'}</td><td>${m.numero_guia || '—'}</td><td>${m.rega_origen || '—'}</td><td>${m.rega_destino || '—'}</td><td>${m.motivo || '—'}</td><td>${m.transportista_nombre || m.transportista || '—'}</td><td>${[].concat(m.animalId || []).length || '—'}</td></tr>`).join('')}
    </table>` : '<p>Sin entradas registradas.</p>'}
    <h3 style="font-size:11px; margin:8px 0 4px;">3.2 Salidas</h3>
    ${d.salidas.length > 0 ? `
    <table>
      <tr><th>Fecha</th><th>Guía</th><th>REGA origen</th><th>REGA destino</th><th>Motivo</th><th>Transportista</th><th>Nº anim.</th></tr>
      ${d.salidas.map(m => `<tr><td>${m.fecha || '—'}</td><td>${m.numero_guia || '—'}</td><td>${m.rega_origen || '—'}</td><td>${m.rega_destino || '—'}</td><td>${m.motivo || '—'}</td><td>${m.transportista_nombre || m.transportista || '—'}</td><td>${[].concat(m.animalId || []).length || '—'}</td></tr>`).join('')}
    </table>` : '<p>Sin salidas registradas.</p>'}

    <h2>4. Nacimientos y Bajas (${d.year})</h2>
    <h3 style="font-size:11px; margin:8px 0 4px;">4.1 Nacimientos</h3>
    ${d.nacimientos.length > 0 ? `
    <table>
      <tr><th>Crotal</th><th>Especie</th><th>Sexo</th><th>Fecha nac.</th><th>Madre</th></tr>
      ${d.nacimientos.map(a => `<tr><td style="color:var(--p-gold); font-weight:bold;">${a.numero_identificacion || a.crotal || a.identificacion || '—'}</td><td>${a.especie || '—'}</td><td>${a.sexo || '—'}</td><td>${a.fecha_nacimiento || a.fecha_alta || '—'}</td><td>${crotalPorId[a.madre_id] || a.madre_id || '—'}</td></tr>`).join('')}
    </table>` : '<p>Sin nacimientos registrados.</p>'}
    <h3 style="font-size:11px; margin:8px 0 4px;">4.2 Muertes y Bajas</h3>
    ${d.muertes.length > 0 ? `
    <table>
      <tr><th>Crotal</th><th>Especie</th><th>Fecha baja</th><th>Motivo</th></tr>
      ${d.muertes.map(a => `<tr><td style="color:var(--p-gold); font-weight:bold;">${a.numero_identificacion || a.crotal || a.identificacion || '—'}</td><td>${a.especie || '—'}</td><td>${a.fecha_baja || '—'}</td><td>${a.motivo_baja || '—'}</td></tr>`).join('')}
    </table>` : '<p>Sin bajas registradas.</p>'}

    <h2>5. Eventos Generales</h2>
    ${d.eventos.length > 0 ? `
    <table>
      <tr><th>Fecha</th><th>Tipo</th><th>Descripción</th></tr>
      ${d.eventos.slice(0, 20).map(e => `<tr><td>${e.fecha || '—'}</td><td>${e.motivo_tarea || e.tipo || '—'}</td><td>${(e.descripcion || e.notas || '').substring(0, 50)}</td></tr>`).join('')}
    </table>` : '<p>Sin eventos registrados.</p>'}

    <h2>6. Registro Sanitario</h2>
    <div class="grid2">
      <div class="stat-box"><div class="stat-num">${d.sanitarios.length}</div><div class="stat-label">Tratamientos totales</div></div>
      <div class="stat-box"><div class="stat-num">${d.tratamientosActivos.length}</div><div class="stat-label">En periodo de supresión</div></div>
    </div>
    ${d.sanitarios.length > 0 ? `
    <table>
      <tr><th>Fecha</th><th>Medicamento</th><th>Motivo</th><th>Vía</th><th>Nº anim.</th><th>Lote</th><th>Esp. carne (d)</th><th>Esp. leche (d)</th><th>Veterinario (colegiado)</th><th>Nº receta</th><th>Rebaño</th></tr>
      ${d.sanitarios.slice(0, 15).map(t => `<tr><td>${t.fecha || '—'}</td><td>${t.medicamento || t.producto || '—'}</td><td>${t.motivo_tratamiento ? (window.ComunidadesService ? window.ComunidadesService.getMotivoTratamientoLabel(t.motivo_tratamiento) : t.motivo_tratamiento) : '—'}</td><td>${t.via_administracion ? (window.ComunidadesService ? window.ComunidadesService.getViaAdministracionLabel(t.via_administracion) : t.via_administracion) : '—'}</td><td>${t.num_animales_tratados || '—'}</td><td>${t.lote_medicamento || '—'}</td><td>${t.tiempo_espera_carne_dias || '—'}</td><td>${t.tiempo_espera_leche_dias || '—'}</td><td>${t.veterinario_prescriptor || '—'}${t.veterinario_colegiado ? ' (' + t.veterinario_colegiado + ')' : ''}</td><td>${t.numero_receta || '—'}</td><td>${d.rebanos.find(r => r.id === t.rebanoId)?.nombre || '—'}</td></tr>`).join('')}
    </table>` : '<p>Sin tratamientos registrados.</p>'}

    <h2>7. Saneamientos Oficiales</h2>
    ${d.saneamientos.length > 0 ? `
    <table>
      <tr><th>Fecha</th><th>Campaña</th><th>Examinados</th><th>Positivos</th><th>Calificación</th></tr>
      ${d.saneamientos.map(s => `<tr><td>${s.fecha || '—'}</td><td>${s.campana || '—'}</td><td>${s.num_examinados ?? s.examinados ?? '—'}</td><td>${s.num_positivos ?? s.positivos ?? '—'}</td><td>${s.calificacion || '—'}</td></tr>`).join('')}
    </table>` : '<p>Sin campañas de saneamiento registradas.</p>'}

    <h2>8. Registro Reproductivo</h2>
    <div class="grid3">
      <div class="stat-box"><div class="stat-num">${d.cubriciones}</div><div class="stat-label">Cubriciones/Celos</div></div>
      <div class="stat-box"><div class="stat-num">${d.gestaciones}</div><div class="stat-label">Gestaciones</div></div>
      <div class="stat-box"><div class="stat-num">${d.partos}</div><div class="stat-label">Partos</div></div>
    </div>

    <h2>9. Producción</h2>
    <div class="grid2">
      <div class="stat-box"><div class="stat-num">${Math.round(totalLeche).toLocaleString('es-ES')} L</div><div class="stat-label">Leche total</div></div>
      <div class="stat-box"><div class="stat-num">${Math.round(totalCarneKg).toLocaleString('es-ES')} kg</div><div class="stat-label">Carne (peso canal)</div></div>
    </div>

    <h2>10. Resumen Económico</h2>
    <div class="grid2">
      <div class="stat-box"><div class="stat-num">${ingresosCarne.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div><div class="stat-label">Ingresos Carne</div></div>
      <div class="stat-box"><div class="stat-num">${ingresosLeche.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div><div class="stat-label">Ingresos Leche</div></div>
    </div>

    <h2>11. Transportistas</h2>
    ${d.transportistas.length > 0 ? `
    <table>
      <tr><th>Nombre</th><th>NIF</th><th>Matrícula</th><th>Cert. Bienestar</th></tr>
      ${d.transportistas.map(t => `<tr><td>${t.nombre}</td><td>${t.nif_cif || t.nif || '—'}</td><td>${t.matricula || '—'}</td><td>${t.certificado_bienestar_fin || '—'}</td></tr>`).join('')}
    </table>` : '<p>Sin transportistas registrados.</p>'}

    <div class="footer">
      <p>Documento generado electrónicamente con Livestock Manager Premium</p>
      <p>Cuaderno Digital según RD 787/2023 — Fecha: ${new Date().toLocaleString('es-ES')}</p>
    </div>`;
  },

  _imprimir() {
    this._abrirVistaImprimible();
  },

  /**
   * Exportar CSV compatible con la tramitación SIGGAN.
   * Genera un fichero con las secciones del libro de registro
   * (identificación, censo, entradas, salidas, nacimientos, muertes,
   * tratamientos y saneamientos) en formato importable.
   */
  async _exportarCSV() {
    try {
      const d = await this._recopilarDatos();
      const SEP = ';';
      const esc = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v).replace(/"/g, '""');
        return /[";\n]/.test(s) ? `"${s}"` : s;
      };
      const fila = (arr) => arr.map(esc).join(SEP);
      const lineas = [];

      const finca = d.finca || {};
      lineas.push(fila(['SECCION', 'IDENTIFICACION']));
      lineas.push(fila(['REGA', finca.codigo_REGA || finca.rega || '']));
      lineas.push(fila(['Explotacion', finca.nombre || '']));
      lineas.push(fila(['Comunidad', finca.comunidad_autonoma || '']));
      lineas.push(fila(['Provincia', finca.provincia || '']));
      lineas.push(fila(['Municipio', finca.municipio || '']));
      lineas.push(fila(['Tipo explotacion', finca.tipo_explotacion || '']));
      lineas.push(fila(['Fecha censo', new Date().toISOString().split('T')[0]]));
      lineas.push('');

      lineas.push(fila(['SECCION', 'CENSO A FECHA']));
      lineas.push(fila(['Especie', 'Cabezas']));
      Object.entries(d.censo || {}).forEach(([esp, n]) => lineas.push(fila([esp, (n && typeof n === 'object') ? n.total : n])));
      lineas.push(fila(['TOTAL', d.totalActivos]));
      lineas.push('');

      lineas.push(fila(['SECCION', 'ENTRADAS']));
      lineas.push(fila(['Fecha', 'Guia', 'REGA origen', 'REGA destino', 'Motivo', 'Transportista', 'Animales']));
      d.entradas.forEach(m => lineas.push(fila([m.fecha, m.numero_guia, m.rega_origen, m.rega_destino, m.motivo, m.transportista_nombre || m.transportista, [].concat(m.animalId || []).join('|')])));
      lineas.push('');

      lineas.push(fila(['SECCION', 'SALIDAS']));
      lineas.push(fila(['Fecha', 'Guia', 'REGA origen', 'REGA destino', 'Motivo', 'Transportista', 'Animales']));
      d.salidas.forEach(m => lineas.push(fila([m.fecha, m.numero_guia, m.rega_origen, m.rega_destino, m.motivo, m.transportista_nombre || m.transportista, [].concat(m.animalId || []).join('|')])));
      lineas.push('');

      // Mapa id -> crotal para resolver la madre por su identificación oficial
      const crotalPorId = {};
      (d.todosAnimales || []).forEach(a => { crotalPorId[a.id] = a.numero_identificacion || a.crotal || a.identificacion || ''; });

      lineas.push(fila(['SECCION', 'NACIMIENTOS']));
      lineas.push(fila(['Crotal', 'Especie', 'Sexo', 'Fecha nacimiento', 'Madre']));
      d.nacimientos.forEach(a => lineas.push(fila([a.numero_identificacion || a.crotal || a.identificacion, a.especie, a.sexo, a.fecha_nacimiento || a.fecha_alta, crotalPorId[a.madre_id] || a.madre_id || ''])));
      lineas.push('');

      lineas.push(fila(['SECCION', 'MUERTES']));
      lineas.push(fila(['Crotal', 'Especie', 'Fecha baja', 'Motivo']));
      d.muertes.forEach(a => lineas.push(fila([a.numero_identificacion || a.crotal || a.identificacion, a.especie, a.fecha_baja, a.motivo_baja])));
      lineas.push('');

      lineas.push(fila(['SECCION', 'TRATAMIENTOS']));
      lineas.push(fila(['Fecha', 'Medicamento', 'Motivo', 'Via administracion', 'Animales tratados', 'Lote', 'Caducidad', 'Espera carne (d)', 'Espera leche (d)', 'Veterinario', 'Nº colegiado', 'Nº receta']));
      d.sanitarios.forEach(t => lineas.push(fila([t.fecha, t.medicamento || t.producto, window.ComunidadesService ? window.ComunidadesService.getMotivoTratamientoLabel(t.motivo_tratamiento) : t.motivo_tratamiento, window.ComunidadesService ? window.ComunidadesService.getViaAdministracionLabel(t.via_administracion) : t.via_administracion, t.num_animales_tratados, t.lote_medicamento, t.caducidad_medicamento, t.tiempo_espera_carne_dias, t.tiempo_espera_leche_dias, t.veterinario_prescriptor, t.veterinario_colegiado, t.numero_receta])));
      lineas.push('');

      lineas.push(fila(['SECCION', 'SANEAMIENTOS']));
      lineas.push(fila(['Fecha', 'Campana', 'Examinados', 'Positivos', 'Calificacion']));
      d.saneamientos.forEach(s => lineas.push(fila([s.fecha, s.campana, s.num_examinados ?? s.examinados, s.num_positivos ?? s.positivos, s.calificacion])));

      const csv = '\uFEFF' + lineas.join('\r\n');
      const fechaHoy = new Date().toISOString().split('T')[0];
      const nombreFinca = (finca.nombre || 'explotacion').replace(/\s+/g, '_').toLowerCase();
      const fileName = `Libro_Registro_SIGGAN_${nombreFinca}_${fechaHoy}.csv`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (window.App && App.toast) App.toast('CSV SIGGAN generado correctamente');
    } catch (e) {
      console.error('Error exportando CSV SIGGAN:', e);
      if (window.App && App.toastError) App.toastError('Error al generar el CSV');
    }
  },
};

window.CuadernoDigitalView = CuadernoDigitalView;
