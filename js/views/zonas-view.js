/**
 * Livestock Manager - ZonasView v1.0.0
 * Vista de Zonas/Parcelas extraída de App.js para modularización.
 * Copia espejo de js/views/zonas-view.js
 */

const ZonasView = {
  async render() {
    if (window.App) App.updateHeaderColor('zonas');
    const main = document.getElementById("ganaderia-tab-content") || document.getElementById("app-content");
    const finca = await Fincas.getActive();
    const rebanos = await Rebanos.list();

    // Auto-inicialización inteligente en caliente de la parcela intensiva para pruebas en la demo CHAMORRO
    if (finca && (finca.demo || (finca.nombre && finca.nombre.includes('CHAMORRO')))) {
      finca.zonas = finca.zonas || [];
      const tieneCercado = finca.zonas.some(z => z.nombre === 'Cercado de Cebo 1ha');
      if (!tieneCercado) {
        finca.zonas.push({
          nombre: 'Cercado de Cebo 1ha',
          superficieGrafica: 1,
          superficie: 1,
          aforoMax: 10,
          aforo_maximo: 10,
          usoPrincipal: 'Pasto',
          uso: 'Pasto',
          localizacion: 'Cercado intensivo temporal',
          descripcion: 'Pruebas de sobrepastoreo',
          codigo_pac: 'ES-AN-21005-004',
          distancia_agua_m: 10
        });

        // Guardar la finca para persistir la nueva zona
        await window.db.put('fincas', finca).catch(() => {});

        // Reasignar el rebaño de Terneros Cebo a la nueva parcela pequeña para disparar el sobrepastoreo (2.0 UGM/ha)
        const rCebo = rebanos.find(r => r.nombre === 'Terneros Cebo');
        if (rCebo && rCebo.zonaActual !== 'Cercado de Cebo 1ha') {
          rCebo.zonaActual = 'Cercado de Cebo 1ha';
          await Rebanos.save(rCebo).catch(() => {});
        }

        // Recargar la vista suavemente para que los cambios surtan efecto en caliente
        setTimeout(() => { location.hash = '#/zonas'; }, 100);
        return;
      }
    }

    const zonasConIndice = (finca.zonas || [])
          .map((zona, realIndex) => ({ zona, realIndex }))
          .filter(({ zona }) => !zona?.anulada);
    let html = '';
    if (zonasConIndice.length === 0)
      html += `<div class="empty-state"><div class="empty-state-icon">${Icons.zonas()}</div><p class="empty-state-text">Sin zonas definidas.</p><div class="text-center mt-20"><button class="btn btn-create btn-lg" onclick="ZonasView._crearZona()">${Icons.agregar()} Crear primera zona</button></div></div>`;
    else {
      let totalAforo = 0, totalOcupacion = 0;
      let fichasHtml = '';
      let zonasConSobrepastoreo = [];

      for (const item of zonasConIndice) {
        const z = item.zona;
        let censoTotal = 0;
        const rebsEnZona = rebanos.filter((r) => r.zonaId === z.id);
        const especiesEnZona = new Set();

        let rebanosHtml = "";
        for (let r of rebsEnZona) {
          const ans = await Animales.list(r.id);
          const n = ans.length;
          censoTotal += n;
          especiesEnZona.add(r.especie);
          if (n > 0) {
            const colorEspecie = r.especie === 'Vacas' ? 'var(--c-info)' : r.especie === 'Ovejas' ? 'var(--c-success)' : r.especie === 'Cabras' ? 'var(--c-warning)' : 'var(--c-pink)';
            rebanosHtml += App._cardRegistro({
              title: r.nombre,
              subtitle: r.tipo,
              rightSide: `<div class="font-900 text-sm">${n}</div>`,
              color: colorEspecie,
              onClick: `location.hash='/rebano?id=${r.id}'`,
              className: 'mb-4'
            });
          }
        }

        const aforo = z.aforoMax || z.aforo_maximo || 50;
        const superficie = z.superficie || z.superficieGrafica || 0;
        totalAforo += aforo;
        totalOcupacion += censoTotal;
        const pct = aforo > 0 ? Math.round((censoTotal / aforo) * 100) : 0;
        const colorCenso = pct > 100 ? 'var(--c-danger)' : pct >= 80 ? 'var(--c-warning)' : 'var(--c-success)';
        const estadoTexto = pct > 100 ? 'Sobrecarga' : pct >= 80 ? 'Óptimo' : pct >= 50 ? 'Aceptable' : 'Infrautilizada';

        const ugmFactor = { 'Vacas': 1.0, 'Ovejas': 0.15, 'Cabras': 0.15, 'Cerdos': 0.3, 'Caballos': 1.1, 'Equino': 1.1 };
        let ugmTotal = 0;
        for (let r of rebsEnZona) {
          const factor = ugmFactor[r.especie] || 0.2;
          const ans = await Animales.list(r.id);
          ugmTotal += ans.length * factor;
        }
        
        const cargaGanaderaNum = superficie > 0 ? ugmTotal / superficie : 0;
        const cargaGanadera = cargaGanaderaNum.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pacTexto = z.codigo_pac ? `PAC: ${z.codigo_pac}` : 'PAC: pendiente';
        const distAgua = z.distancia_agua_m ? `Agua: ${z.distancia_agua_m}m` : 'Agua: —';

        // Acumular zonas con sobrepastoreo activo si superan el aforo ecológico oficial (1.0 UGM/ha)
        if (cargaGanaderaNum > 1.0) {
          zonasConSobrepastoreo.push({
            nombre: z.nombre,
            carga: cargaGanadera,
            ugm: ugmTotal,
            superficie: superficie
          });
        }

        // Sincronización Fitosanitaria en tiempo real
        const bloqueoFito = await this.verificarBloqueoFitosanitario(finca.id, z.nombre);
        let fitoAlertaHtml = '';
        let botonRotacionHtml = '';
        
        if (bloqueoFito && bloqueoFito.bloqueado) {
          fitoAlertaHtml = `
            <div class="mt-8 p-6 flex items-center gap-6 rounded-xs" style="background: rgba(239, 68, 68, 0.04); border: 1px solid var(--c-danger); width: 100%;">
              <span class="animate-pulse text-[0.58rem] font-black text-danger uppercase flex items-center gap-4" style="letter-spacing:0.5px; line-height:1.2;">
                ✕ CUARENTENA ACTIVA (${bloqueoFito.concepto.toUpperCase()}) - BLOQUEADA HASTA EL ${bloqueoFito.fechaFinPlazo} (${bloqueoFito.diasRestantes}D RESTANTES)
              </span>
            </div>
          `;
          botonRotacionHtml = `
            <button onclick="event.stopPropagation(); App.toastError('Esta parcela está bajo cuarentena fitosanitaria activa. Rotación suspendida.');" class="px-10 py-5 min-h-0 h-auto font-900 uppercase tracking-wider text-[0.62rem] opacity-45 cursor-not-allowed" style="background:#222; border:1px solid #444; color:#999; border-radius:4px;">
              ✕ CUARENTENA ACTIVA (BLOQUEADO)
            </button>
          `;
        } else {
          botonRotacionHtml = `
            <button onclick="event.stopPropagation(); ZonasView._abrirRotacion('${z.nombre.replace(/'/g, "\\'")}')" class="widget-link-btn widget-link-btn--neon px-10 py-5 min-h-0 h-auto font-900 uppercase tracking-wider text-[0.62rem]" style="border-color:var(--c-success); color:var(--c-success);">
              ⇄ Rotar Lote / Rebaño
            </button>
          `;
        }

        fichasHtml += App._cardRegistro({
          title: z.nombre,
          subtitle: `${z.usoPrincipal || 'Sin uso Principal'}${superficie ? ` · ${Number(superficie).toLocaleString('es-ES')} ha` : ''}`,
          rightSide: `<span class="badge badge-sm uppercase font-800" style="color:${colorCenso}; border:1px solid ${colorCenso}40; background:${colorCenso}15;">${estadoTexto}</span>`,
          content: `
            <div class="p-10 rounded my-8" style="background:#000; border:1px solid #222;">
              <div class="flex justify-between font-900 text-[0.65rem] mb-4 uppercase">
                <span class="text-gray">Carga: ${ugmTotal.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} UGM</span>
                <span style="color:${colorCenso}">${censoTotal} / ${aforo} (${pct}%)</span>
              </div>
              <div class="progress-track">
                <div style="width:${Math.min(pct, 100)}%; height:100%; background:${colorCenso}; border-radius:4px; box-shadow:0 0 8px ${colorCenso}44; transition:width 0.3s;"></div>
              </div>
            </div>
            <div class="flex flex-wrap gap-x-12 gap-y-3 text-[0.62rem] text-aaa font-800 uppercase">
              <div class="flex items-center gap-4" style="${z.codigo_pac ? '' : 'color:var(--c-warning);'}">${Icons.documento()} ${pacTexto}</div>
              <div class="flex items-center gap-4" style="${z.distancia_agua_m ? '' : 'color:var(--text-d);'}">${Icons.zonas()} ${distAgua}</div>
              <div class="flex items-center gap-4">${Icons.grafico()} ${cargaGanadera} UGM/ha</div>
              ${especiesEnZona.size ? `<div class="flex items-center gap-4">${Icons.animales()} ${[...especiesEnZona].join(', ')}</div>` : ''}
            </div>
            ${fitoAlertaHtml}
            ${rebanosHtml ? `
              <div class="mt-4 border-top-222 pt-8">${rebanosHtml}</div>
              <div class="mt-8 flex justify-end">
                ${botonRotacionHtml}
              </div>
            ` : ''}
          `,
          footerRight: `<span style="display:block; font-size:0.7rem; font-weight:700; color:var(--c-warning); white-space:nowrap;">Ficha -></span>`,
          color: colorCenso,
          onClick: `location.hash='/zona?index=${item.realIndex}'`
        });
      }

      // Renderizar Alerta Bento de Sobrepastoreo si hay parcelas afectadas
      let sobrepastoreoHtml = '';
      if (zonasConSobrepastoreo.length > 0) {
        let parcelasAfectadasHtml = '';
        zonasConSobrepastoreo.forEach(p => {
          parcelasAfectadasHtml += `
            <div class="flex justify-between items-center py-6 border-bottom-222" style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase;">
              <span class="text-white">${p.nombre} (${p.superficie.toLocaleString('es-ES')} ha)</span>
              <span class="font-950" style="color: var(--c-danger); text-shadow: 0 0 6px rgba(255,68,68,0.4);">${p.carga} UGM/ha</span>
            </div>
          `;
        });

        sobrepastoreoHtml = `
          <!-- Alerta Bento de Sobrepastoreo Crítico -->
          <div class="card p-12 mb-14 border-danger" style="background: rgba(255, 68, 68, 0.03); border: 1px solid var(--c-danger); box-shadow: 0 0 15px rgba(255, 68, 68, 0.12), inset 0 0 10px rgba(255, 68, 68, 0.05);">
            <div class="flex items-center gap-6 mb-8 text-xs text-danger font-950 uppercase tracking-wider animate-pulse">
              ${Icons.alerta()} ✕ ALERTA DE SOBREPASTOREO ACTIVO (>1.0 UGM/ha)
            </div>
            <p class="text-[0.62rem] text-aaa uppercase font-700 tracking-wide mb-8" style="line-height:1.4;">
              El aforo ecológico máximo permitido para pastoreo extensivo ha sido superado en las siguientes parcelas. Se recomienda rotar los lotes o rebaños para evitar la degradación del pasto.
            </p>
            <div class="mb-10">
              ${parcelasAfectadasHtml}
            </div>
            <div class="flex justify-end">
              <button onclick="App.toast('Abriendo panel de asistente de rotación de pastos...', 'info'); location.hash='/sistema?tab=interfaz'" class="px-10 py-5 min-h-0 h-auto font-900 uppercase tracking-wider text-[0.62rem]" style="background: rgba(255,68,68,0.15); border: 1px solid var(--c-danger); color: var(--c-danger); border-radius: 4px; transition: all 0.2s; box-shadow: 0 0 8px rgba(255,68,68,0.15);" onmouseover="this.style.background='var(--c-danger)'; this.style.color='#000';" onmouseout="this.style.background='rgba(255,68,68,0.15)'; this.style.color='var(--c-danger)';">
                ⇄ Sugerir Rotación Preventiva
              </button>
            </div>
          </div>
        `;
      }

      // Cabecera de Sección Estandarizada + Resumen Colapsable sin anidación
      const moduleColor = window.getModuleColor('/zonas');
      const pctGlobal = totalAforo > 0 ? Math.round((totalOcupacion / totalAforo) * 100) : 0;
      const colorGlobal = pctGlobal > 100 ? 'var(--c-danger)' : pctGlobal >= 80 ? 'var(--c-warning)' : 'var(--c-success)';
      html += `
        <!-- Cabecera de Sección Estandarizada -->
        <div class="flex items-center gap-12 mb-14">
          <span class="text-2xl" style="color:${moduleColor}; display:inline-flex; align-items:center;">${Icons.zonas()}</span>
          <div>
            <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin:0; line-height:1.2;">
              <span style="color:${moduleColor}; margin-right:4px;">|</span> ZONAS / PARCELAS
            </h1>
            <div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
              ${zonasConIndice.length} ${zonasConIndice.length === 1 ? 'registro' : 'registros'} · ${totalOcupacion} cabezas
            </div>
          </div>
        </div>

        <!-- Resumen de ocupación (colapsable) -->
        <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(255,255,255,0.02);">
          <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center justify-between gap-6">
            <span class="flex items-center gap-6">${Icons.zonas()} Ocupación Global</span>
            <button class="resumen-toggle" onclick="App.toggleResumen(this)" aria-label="Ocultar resumen">${Icons.chevronAbajo()}</button>
          </div>
          <div class="resumen-body">
            <div class="flex justify-between items-center mb-6">
              <span class="text-xs text-gray uppercase font-900">Cabezas / Aforo</span>
              <strong class="text-xl font-950" style="color:${colorGlobal};">${totalOcupacion} / ${totalAforo} (${pctGlobal}%)</strong>
            </div>
            <div class="progress-track progress-track--lg">
              <div style="width:${Math.min(pctGlobal, 100)}%;height:100%;background:${colorGlobal};border-radius:5px;box-shadow:0 0 12px ${colorGlobal}44;"></div>
            </div>
          </div>
        </div>

        ${sobrepastoreoHtml}

        <!-- Histórico de registros -->
        <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-5" style="display: flex; align-items: center; gap: 4px;">
          ${Icons.documento()} LISTA DE ZONAS
        </div>
        <div class="grid gap-12">${fichasHtml}</div>`;
    }
    main.innerHTML = html + `
      <!-- Botón Flotante de Acción con viñeta -->
      <div class="fab-container" onclick="ZonasView._crearZona()">
        <span class="fab-label">Nueva Zona</span>
        <button class="fab-btn">${Icons.fabPlus()}</button>
      </div>`;
  },

  async renderDetalle(params) {
    const index = params.get("index");
    const finca = await Fincas.getActive();
    const zona = finca.zonas[parseInt(index)];
    if (!zona || zona.anulada) {
      App.toastError("Zona no disponible");
      location.hash = "#/zonas";
      return;
    }
    
    // Calcular UGM
    const ugmFactor = { 'Vacas': 1.0, 'Ovejas': 0.15, 'Cabras': 0.15, 'Cerdos': 0.3, 'Caballos': 1.1, 'Equino': 1.1 };
    const rebanos = await Rebanos.list();
    let ugmTotal = 0;
    const superficie = zona.superficie || zona.superficieGrafica || 0;
    for (let r of rebanos.filter(rb => rb.zonaActual === zona.nombre)) {
      const factor = ugmFactor[r.especie] || 0.2;
      const ans = await Animales.list(r.id);
      ugmTotal += ans.length * factor;
    }
    const cargaGanadera = (superficie > 0 ? ugmTotal / superficie : 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    ZonasView._zonaGuardada = false;
    App.setExitGuard(() => ZonasView._confirmSalirEdicion());

    document.getElementById("app-content").innerHTML = `
      <div class="mb-20"><a href="#" onclick="ZonasView._salirEdicionZona(); return false;" class="link-back">← Volver</a><h2 class="mt-10 font-900 uppercase tracking-wider"><span style="color: var(--neon);">|</span> ${Icons.zonas()} DETALLE ZONA</h2></div>
      <div class="card-registro" style="--registro-color: var(--c-success);">
        <div class="flex flex-col gap-15">
          <div><label class="form-label" for="z-edit-nombre">Nombre</label>
          <input type="text" id="z-edit-nombre" required value="${zona.nombre}" class="premium-input"></div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label" for="z-edit-aforo">Aforo Máximo</label>
            <input type="number" id="z-edit-aforo" value="${zona.aforoMax || ""}" class="premium-input"></div>
            <div><label class="form-label" for="z-edit-superficie">Superficie (ha)</label>
            <input type="number" id="z-edit-superficie" value="${zona.superficieGrafica || ""}" step="0.01" class="premium-input"></div>
          </div>
          <div><label class="form-label" for="z-edit-pac">Código PAC (Parcela Agraria)</label>
          <input type="text" id="z-edit-pac" value="${zona.codigo_pac || ""}" placeholder="Ej: ES01A123456789" class="premium-input"></div>
          <div><label class="form-label" for="z-edit-uso">Uso Principal de la Parcela</label>
          <input type="text" id="z-edit-uso" value="${zona.usoPrincipal || ""}" placeholder="Ej: Pasto libre, Engorde, Cultivo..." class="premium-input"></div>
          <div><label class="form-label" for="z-edit-agua">Distancia a Fuente de Agua (m)</label>
          <input type="number" id="z-edit-agua" value="${zona.distancia_agua_m || ""}" placeholder="Metros" class="premium-input"></div>
          <div class="text-gray text-xs mt-8">
            <strong>${Icons.grafico()} Métricas SIGGAN (solo lectura):</strong><br/>
            UGM Total: <strong>${ugmTotal.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong> · Carga: <strong>${cargaGanadera} UGM/ha</strong>
          </div>
          <div><label class="form-label" for="z-edit-localizacion">Localización</label>
          <textarea id="z-edit-localizacion" class="premium-input min-h-60 resize-none">${zona.localizacion || ""}</textarea></div>
        </div>
        <div class="flex justify-between items-center mt-20">
          <button class="btn btn-danger" onclick="ZonasView._eliminarZona(${index})">${Icons.eliminar()} Eliminar</button>
          <div class="flex gap-10">
            <button class="btn btn-secondary" onclick="ZonasView._salirEdicionZona()">${Icons.cerrar()} Cancelar</button>
            <button class="btn btn-success" onclick="ZonasView._guardarZona(${index})">${Icons.guardar()} Guardar</button>
          </div>
        </div>
      </div>`;
  },
  async _guardarZona(index) {
    try {
      const finca = await Fincas.getActive();
      const zona = finca.zonas[index];

      // Ensure zona has an ID (for backward compatibility with older zonas)
      if (!zona.id) {
        const maxId = finca.zonas.reduce((max, z) => Math.max(max, z.id || 0), 0);
        zona.id = maxId + 1;
      }

      zona.nombre = document.getElementById("z-edit-nombre").value.trim();

      const aforo = parseInt(document.getElementById("z-edit-aforo").value) || 0;
      zona.aforoMax = aforo;
      zona.aforo_maximo = aforo;

      const sup = parseFloat(document.getElementById("z-edit-superficie").value) || 0;
      zona.superficieGrafica = sup;
      zona.superficie = sup;

      zona.codigo_pac = document.getElementById("z-edit-pac").value.trim();

      const uso = document.getElementById("z-edit-uso").value.trim();
      zona.usoPrincipal = uso;
      zona.uso = uso;

      zona.distancia_agua_m = parseInt(document.getElementById("z-edit-agua").value) || 0;
      zona.localizacion = document.getElementById("z-edit-localizacion").value.trim();
      if (!zona.nombre) return App.toastError("Nombre requerido");
      await Fincas.save(finca);
      ZonasView._zonaGuardada = true;
      App.toast("Zona actualizada", "success");
      location.hash = "#/zonas";
    } catch (e) {
      App.toastError(e.message);
    }
  },

  /** Guarda de salida compartida con el header-back y el botón físico Android (ver App.setExitGuard). */
  async _confirmSalirEdicion() {
    if (this._zonaGuardada) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _salirEdicionZona() {
    if (!(await this._confirmSalirEdicion())) return;
    App.clearExitGuard();
    location.hash = "#/zonas";
  },

  async _crearZona() {
    const wizardSteps = [
      {
        content: (data) => `
          <div class="mt-10">
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-nombre">NOMBRE DE LA ZONA / PARCELA</label>
              <input type="text" id="w-zona-nombre" value="${data.nombre}" required placeholder="Ej: Parcela Norte..." class="wizard-input">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-aforo">AFORO MÁXIMO (Animales)</label>
              <input type="number" id="w-zona-aforo" value="${data.aforoMax}" class="wizard-input">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-superficie">SUPERFICIE (ha)</label>
              <input type="number" id="w-zona-superficie" value="${data.superficie}" step="0.01" placeholder="Ej: 42.5" class="wizard-input">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-uso">USO PRINCIPAL (Opcional)</label>
              <input type="text" id="w-zona-uso" value="${data.usoPrincipal}" placeholder="Ej: Engorde, Pasto libre..." class="wizard-input">
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.nombre = document.getElementById('w-zona-nombre')?.value.trim() || data.nombre;
          data.aforoMax = parseInt(document.getElementById('w-zona-aforo')?.value) || 50;
          data.superficie = parseFloat(document.getElementById('w-zona-superficie')?.value) || 0;
          data.usoPrincipal = document.getElementById('w-zona-uso')?.value.trim() || data.usoPrincipal;
        },
        validate: async (data) => {
          if (!data.nombre) {
            App.toastError("El nombre de la zona es obligatorio");
            return false;
          }
          return true;
        }
      },
      {
        content: (data) => `
          <div class="mt-10">
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-pac">CÓDIGO PAC (Parcela Agraria SIGGAN)</label>
              <input type="text" id="w-zona-pac" value="${data.codigo_pac}" placeholder="Ej: ES01A123456789" class="wizard-input">
              <small class="text-gray">Requisito para subvenciones CCAA</small>
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-agua">DISTANCIA A FUENTE DE AGUA (m)</label>
              <input type="number" id="w-zona-agua" value="${data.distancia_agua_m}" placeholder="Metros a abrevadero o agua" class="wizard-input">
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.codigo_pac = document.getElementById('w-zona-pac')?.value.trim() || data.codigo_pac;
          data.distancia_agua_m = parseInt(document.getElementById('w-zona-agua')?.value) || 0;
        },
        validate: async (data) => true
      }
    ];

    window.WizardManager.create({
      id: 'wizard-nueva-zona',
      title: 'NUEVA ZONA',
      initialData: { nombre: "", aforoMax: 50, superficie: 0, usoPrincipal: "", codigo_pac: "", distancia_agua_m: 0 },
      steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          const finca = await Fincas.getActive();
          // Generate unique ID for the new zona
          const maxId = finca.zonas.reduce((max, zona) => Math.max(max, zona.id || 0), 0);
          const newId = maxId + 1;

          finca.zonas.push({
            id: newId,
            nombre: finalData.nombre,
            aforoMax: finalData.aforoMax,
            aforo_maximo: finalData.aforoMax,
            superficieGrafica: finalData.superficie,
            superficie: finalData.superficie,
            usoPrincipal: finalData.usoPrincipal,
            uso: finalData.usoPrincipal,
            codigo_pac: finalData.codigo_pac,
            distancia_agua_m: finalData.distancia_agua_m,
            creadoEn: Date.now(),
          });
          await Fincas.save(finca);
          App.toast("Zona creada", "success");
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  },

  async _eliminarZona(index) {
    const motivo = await Confirm.prompt("Motivo de anulación", "Introduce el motivo (obligatorio):", "rectificacion_zonas");
    if (!motivo) {
      App.toastError("Debes indicar un motivo de anulación.");
      return;
    }
    if (!await Confirm.confirm("Anular Zona", "¿Anular zona? Se conservará histórico para auditoría.", true)) return;
    try {
      const finca = await Fincas.getActive();
      const zona = finca?.zonas?.[index];
      if (!zona) {
        App.toastError("Zona no encontrada.");
        return;
      }
      zona.anulada = true;
      zona.anuladaEn = new Date().toISOString();
      zona.anuladoMotivo = motivo.trim();
      zona.actualizadoEn = new Date().toISOString();
      await Fincas.save(finca);
      await window.db.add("registro_eventos", {
        fincaId: finca.id || await Fincas.getActiveId().catch(() => null),
        tipo: "auditoria",
        tipo_entidad: "zona",
        entidad_id: index,
        fecha: new Date().toISOString().split("T")[0],
        motivo_tarea: "anulacion_zona",
        descripcion: `Anulación de zona ${zona.nombre || "#" + index}`,
        observaciones: motivo.trim(),
        creadoEn: new Date().toISOString(),
      }).catch(() => {});
      App.toast("Zona anulada", "success");
      location.hash = "#/zonas";
    } catch (e) {
      App.toastError(e.message);
    }
  },

  async _abrirRotacion(zonaOrigenNombre) {
    try {
      const finca = await Fincas.getActive();
      const rebanos = await Rebanos.list();
      const rebanosEnZona = rebanos.filter(r => r.zonaActual === zonaOrigenNombre);
      
      if (rebanosEnZona.length === 0) {
        App.toast("No hay rebaños activos en esta zona para rotar.", "warning");
        return;
      }
      
      const otrasZonas = (finca.zonas || [])
        .filter(z => !z?.anulada && z.nombre !== zonaOrigenNombre);
        
      if (otrasZonas.length === 0) {
        App.toast("No hay otras zonas disponibles en la finca. Crea otra zona primero.", "warning");
        return;
      }

      // Evaluar estado fitosanitario de parcelas destino en tiempo real
      const otrasZonasConBloqueo = [];
      const fincaId = await Fincas.getActiveId();
      for (const z of otrasZonas) {
        const checkFito = await this.verificarBloqueoFitosanitario(fincaId, z.nombre);
        otrasZonasConBloqueo.push({
          zona: z,
          bloqueada: checkFito.bloqueado,
          concepto: checkFito.concepto,
          fechaFin: checkFito.fechaFinPlazo
        });
      }
      
      // Inyectar el modal HTML en el body
      const modalId = 'modal-rotacion-pastos';
      let modalDiv = document.getElementById(modalId);
      if (!modalDiv) {
        modalDiv = document.createElement('div');
        modalDiv.id = modalId;
        document.body.appendChild(modalDiv);
      }
      
      const moduleColor = 'var(--c-success)'; // Verde Lima de ExPro / Zonas
      
      modalDiv.innerHTML = `
        <div class="modal-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:9999; animation:fadeIn 0.2s ease-out;">
          <div class="card-registro p-20 border-222" style="--registro-color:${moduleColor}; width:90%; max-width:420px; background:#121212; box-shadow:0 0 30px rgba(204,255,0,0.15); border-radius:12px; margin:auto;">
            <div class="flex items-center gap-10 mb-15">
              <span class="text-2xl" style="color:${moduleColor}; display:inline-flex; align-items:center;">${Icons.zonas()}</span>
              <div>
                <h3 class="text-white font-900 text-sm uppercase tracking-wider" style="margin:0;">⇄ ROTACIÓN DE PASTOS (SIGGAN)</h3>
                <div class="text-gray text-[0.6rem] font-bold uppercase tracking-tight">Zona Origen: ${zonaOrigenNombre}</div>
              </div>
            </div>
            
            <div class="flex flex-col gap-15 mt-10">
              <div>
                <label class="form-label text-[0.65rem] font-bold uppercase text-gray mb-4" for="rot-rebano-select" style="display:block;">1. SELECCIONAR REBAÑO / LOTE</label>
                <select id="rot-rebano-select" class="premium-input w-full uppercase font-800" style="background:rgba(255,255,255,0.03); border:1px solid #27272a; height:38px; padding:0 10px; border-radius:6px; color:#fff; display:block;">
                  ${rebanosEnZona.map(r => `<option value="${r.id}">${r.nombre} (${r.especie})</option>`).join('')}
                </select>
              </div>
              
              <div>
                <label class="form-label text-[0.65rem] font-bold uppercase text-gray mb-4" for="rot-zona-select" style="display:block;">2. SELECCIONAR PARCELA DESTINO</label>
                <select id="rot-zona-select" class="premium-input w-full uppercase font-800" style="background:rgba(255,255,255,0.03); border:1px solid #27272a; height:38px; padding:0 10px; border-radius:6px; color:#fff; display:block;">
                  ${otrasZonasConBloqueo.map(item => `
                    <option value="${item.zona.nombre}" ${item.bloqueada ? 'style="color:#ff4444; font-weight:bold;"' : ''}>
                      ${item.zona.nombre} (${item.zona.usoPrincipal || 'Pasto'}${item.bloqueada ? ` · ✕ BLOQUEADA HASTA ${item.fechaFin}` : ` · ${item.zona.superficieGrafica || 0} ha`})
                    </option>
                  `).join('')}
                </select>
              </div>
              
              <div>
                <label class="form-label text-[0.65rem] font-bold uppercase text-gray mb-4" for="rot-observaciones" style="display:block;">3. MOTIVO DE TRASLADO (OPCIONAL)</label>
                <input type="text" id="rot-observaciones" placeholder="Ej: Rotación rutinaria de pastos, falta de agua..." class="premium-input w-full text-xs font-700" style="background:rgba(255,255,255,0.03); border:1px solid #27272a; height:38px; padding:0 10px; border-radius:6px; color:#fff; display:block;">
              </div>
            </div>
            
            <div class="flex justify-end gap-10 mt-20">
              <button class="btn btn-secondary text-xs uppercase font-800 px-14 py-8" style="background:#1e1e1e; border:1px solid #333; color:#aaa; border-radius:6px;" onclick="document.getElementById('modal-rotacion-pastos').remove();">${Icons.cerrar()} Cancelar</button>
              <button class="btn btn-success text-xs uppercase font-800 px-14 py-8" style="background:${moduleColor}; color:#000; border-radius:6px; font-weight:900;" onclick="ZonasView._confirmarRotacion()">${Icons.guardar()} Confirmar Traslado</button>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      App.toastError(e.message);
    }
  },

  async _confirmarRotacion() {
    try {
      const rebanoId = Number(document.getElementById('rot-rebano-select').value);
      const nuevaZonaNombre = document.getElementById('rot-zona-select').value;
      const observaciones = document.getElementById('rot-observaciones').value.trim();
      
      const rebano = await Rebanos.get(rebanoId);
      if (!rebano) {
        App.toastError("Rebaño no encontrado");
        return;
      }

      const fincaId = await Fincas.getActiveId();
      
      // Chequeo fitosanitario estricto antes de guardar el traslado
      const checkFito = await ZonasView.verificarBloqueoFitosanitario(fincaId, nuevaZonaNombre);
      if (checkFito && checkFito.bloqueado) {
        App.toastError(`✕ BLOQUEO FITOSANITARIO DE BIOSEGURIDAD:\n\nLa parcela destino "${nuevaZonaNombre.toUpperCase()}" está bajo CUARENTENA ACTIVA (${checkFito.concepto.toUpperCase()}).\n\nNo es apta para pastoreo hasta el ${checkFito.fechaFinPlazo} (${checkFito.diasRestantes}D restantes).`);
        return; // Abortar traslado
      }
      
      const zonaAnterior = rebano.zonaActual;
      // Resolver el ID de la parcela destino: el censo por zona filtra por zonaId,
      // así que debemos actualizar zonaId (fuente de verdad) además de zonaActual.
      const fincaObj = await Fincas.get(fincaId);
      const zonaDestino = (fincaObj?.zonas || []).find(z => z.nombre === nuevaZonaNombre);
      rebano.zonaActual = nuevaZonaNombre;
      rebano.zonaId = zonaDestino?.id ?? null;
      await Rebanos.save(rebano);
      
      // Registrar evento de traslado para auditoría
      await window.db.add('registro_eventos', {
        fincaId: fincaId,
        entidad_id: rebano.id,
        tipo_entidad: 'rebano',
        tipo: 'traslado',
        motivo_tarea: 'rotacion_pastos',
        fecha: new Date().toISOString().split('T')[0],
        descripcion: `Traslado de rebaño "${rebano.nombre}" por rotación de pastos`,
        observaciones: observaciones || `Rotación rutinaria de pastos desde ${zonaAnterior} hacia ${nuevaZonaNombre}`,
        creadoEn: new Date().toISOString()
      }).catch(() => {});
      
      document.getElementById('modal-rotacion-pastos').remove();
      App.toast("Rotación de rebaño registrada con éxito", "success");
      
      // Volver a renderizar en caliente
      await ZonasView.render();
    } catch (e) {
      App.toastError(e.message);
    }
  },

  async verificarBloqueoFitosanitario(fincaId, zonaNombre, fechaStr) {
    if (!zonaNombre) return { bloqueado: false };
    const hoy = fechaStr ? new Date(fechaStr) : new Date();
    
    // Obtener los tratamientos de fitosanitarios de la finca
    const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []);
    const fitos = gastos.filter(g => 
      (g.categoria || '').toLowerCase() === 'fitosanitarios' &&
      (g.snap_zona || '').toLowerCase() === zonaNombre.toLowerCase() &&
      !g.anulado
    );
    
    for (const f of fitos) {
      const fechaTratamiento = new Date(f.fecha);
      const diasPlazo = Number(f.control_normativo?.plazoSeguridadDias) || 0;
      if (diasPlazo > 0) {
        const fechaFinPlazo = new Date(fechaTratamiento.getTime() + (diasPlazo * 24 * 60 * 60 * 1000));
        if (hoy < fechaFinPlazo) {
          const diffMs = fechaFinPlazo - hoy;
          const diasRestantes = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
          return {
            bloqueado: true,
            concepto: f.concepto,
            fechaFinPlazo: fechaFinPlazo.toLocaleDateString('es-ES'),
            diasRestantes: diasRestantes
          };
        }
      }
    }
    return { bloqueado: false };
  }
};

window.ZonasView = ZonasView;




