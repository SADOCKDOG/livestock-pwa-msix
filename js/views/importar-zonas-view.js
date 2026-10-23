/**
 * Livestock Manager - ImportarZonasView v1.0.0
 * Vista para importar zonas/parcelas desde PDF del Catastro (SIGPAC).
 * Flujo: selector PDFs → progreso → revisión tarjetas → guardado en finca.zonas[]
 */

const ImportarZonasView = {
  _archivosSeleccionados: [],
  _resultadosParseo: [],
  _bloqueoGuardado: false,

  async render() {
    const main = document.getElementById("app-content");
    main.innerHTML = this._htmlPasoSelector();
    this._setupFileInput();
    this._renderBotonesNavegacion('selector');
  },

  _htmlPasoSelector() {
    return `
      <div class="wizard-full-screen">
        <div class="wizard-header-fixed border-top-5-gold">
          <h1 class="wizard-header-title uppercase font-950 tracking-widest text-lg"><span style="color: var(--p-gold); margin-right: 6px;">|</span> ${Icons.importar()} IMPORTAR ZONAS DESDE PDF</h1>
        </div>
        <div class="wizard-content-scrollable p-20">
          <div class="card-registro" style="--registro-color: var(--c-success);">
            <div class="flex flex-col gap-15">
              <div class="text-center py-10">
                <div class="text-4xl mb-8">${Icons.documento()}</div>
                <h3 class="text-xl font-900 text-white mb-4">Importar Parcelas del Catastro</h3>
                <p class="text-gray text-sm mb-6 leading-relaxed">
                  Selecciona uno o varios PDFs oficiales de <strong>"Consulta descriptiva y gráfica de datos catastrales"</strong> (sede.catastro.gob.es).
                  El flujo habitual: SIGPAC → Catastro → Imprimir datos → Guardar como PDF.
                </p>
                <div class="text-center" style="margin-top:1rem;">
                  <!-- En Tauri window.open no abre nada (no hay plugin opener): se usa el
                       visor de ManualesView (overlay en Android/PWA, embebido en escritorio). -->
                  <button class="btn btn-secondary" style="border-left:3px solid #c9851f;" onclick="App._ensureViewGroup('manuales').then(function () { if (window.ManualesView) ManualesView._abrirManual('manual/manual-zonas.html', 'Manual Exportación PDF SIGPAC'); })">
                    <span class="flex flex-col items-center gap-1">${Icons.libro()} Manual Exportación PDF SIGPAC</span>
                  </button>
                </div>
              </div>

              <div class="wizard-input-group">
                <label class="wizard-label" for="pdf-files">Archivos PDF</label>
                <input type="file" id="pdf-files" accept=".pdf" multiple class="wizard-input" style="padding: 8px;">
                <small class="text-gray">Se pueden seleccionar múltiples PDFs a la vez (típico: 5-15 parcelas)</small>
              </div>

              <div id="files-preview" class="hidden mb-10"></div>

              <div id="progress-container" class="hidden">
                <div class="progress-track progress-track--lg mb-4">
                  <div id="progress-bar" style="width:0%;height:100%;background:var(--c-success);border-radius:5px;box-shadow:0 0 12px var(--c-success)44;transition:width 0.3s;"></div>
                </div>
                <p id="progress-text" class="text-center text-sm text-gray">Iniciando...</p>
              </div>

              <div id="error-container" class="hidden mb-4 p-4 rounded-xs" style="background:rgba(239,68,68,0.1);border:1px solid var(--c-danger);"></div>
            </div>
          </div>
        </div>
        <div class="wizard-footer-fixed">
          <button class="btn btn-secondary btn-lg" onclick="ImportarZonasView._cancelar()">${Icons.cerrar()} Cancelar</button>
          <button id="btn-continuar" class="btn btn-create btn-lg" onclick="ImportarZonasView._procesarPDFs()" disabled>Continuar ${Icons.flechaDerecha()}</button>
        </div>
      </div>
    `;
  },

  _setupFileInput() {
    const input = document.getElementById('pdf-files');
    const preview = document.getElementById('files-preview');
    const btnContinuar = document.getElementById('btn-continuar');

    input.addEventListener('change', (e) => {
      this._archivosSeleccionados = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      if (this._archivosSeleccionados.length > 0) {
        preview.innerHTML = this._archivosSeleccionados.map(f => `
          <div class="flex items-center justify-between p-3 mb-2 rounded-xs" style="background:rgba(255,255,255,0.03);border:1px solid #222;">
            <span class="flex items-center gap-3 text-sm">
              ${Icons.documento()} ${f.name} (${(f.size/1024).toFixed(1)} KB)
            </span>
          </div>
        `).join('');
        preview.classList.remove('hidden');
        btnContinuar.disabled = false;
      } else {
        preview.innerHTML = '';
        preview.classList.add('hidden');
        btnContinuar.disabled = true;
      }
    });
  },

  async _procesarPDFs() {
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const errorContainer = document.getElementById('error-container');
    const btnContinuar = document.getElementById('btn-continuar');

    progressContainer.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    btnContinuar.disabled = true;

    // Cargar pdf.js
    const ok = await App._ensurePdfJs();
    if (!ok) {
      errorContainer.textContent = 'No se pudo cargar pdf.js (necesitas conexión la primera vez). Inténtalo de nuevo.';
      errorContainer.classList.remove('hidden');
      btnContinuar.disabled = false;
      return;
    }

    this._resultadosParseo = [];
    const total = this._archivosSeleccionados.length;

    for (let i = 0; i < total; i++) {
      const file = this._archivosSeleccionados[i];
      progressText.textContent = `Procesando ${i+1}/${total}: ${file.name}...`;
      progressBar.style.width = `${((i) / total) * 100}%`;

      try {
        const resultado = await PdfCatastro.importar(file);

        if (resultado.ok) {
          // Generar nombre por defecto
          const nombreDefecto = `Polígono ${resultado.datos.poligono} Parcela ${resultado.datos.parcela}`;

          this._resultadosParseo.push({
            archivo: file.name,
            datos: resultado.datos,
            // `importar()` devuelve el croquis como hermano de `datos`, no dentro.
            // Sin recogerlo aqui, el guardado buscaba `d.croquisBlob` (siendo
            // `d = r.datos`), siempre undefined: el PNG del croquis se generaba y
            // se tiraba, y el store croquis_parcelas de la v28 quedaba vacio.
            croquisBlob: resultado.croquisBlob || null,
            nombreEditado: nombreDefecto,
            incluir: true,
            error: null
          });
        } else {
          this._resultadosParseo.push({
            archivo: file.name,
            datos: null,
            nombreEditado: file.name.replace('.pdf', ''),
            incluir: false,
            error: resultado.motivo
          });
        }
      } catch (e) {
        this._resultadosParseo.push({
          archivo: file.name,
          datos: null,
          nombreEditado: file.name.replace('.pdf', ''),
          incluir: false,
          error: e.message
        });
      }
    }

    progressBar.style.width = '100%';
    progressText.textContent = 'Parseo completado. Revisa las parcelas detectadas.';

    // Pequeña pausa para que se vea el 100%
    await new Promise(r => setTimeout(r, 500));

    await this._renderPasoRevision();
  },

  async _renderPasoRevision() {
    const main = document.getElementById("app-content");
    const fincaActiva = await Fincas.getActive();
    if (!fincaActiva) {
      App.toastError('No hay finca activa');
      return;
    }
    const finca = {
      ...fincaActiva,
      zonas: Array.isArray(fincaActiva.zonas) ? fincaActiva.zonas.map((zona) => zona ? { ...zona } : zona) : []
    };
    await ZonasView._asegurarIdsZonasYRelaciones(finca, { persist: false });
    const resultadosValidos = this._resultadosParseo.filter((r) => r.datos);
    const decisionesGrupoAnteriores = new Map();
    for (const r of resultadosValidos) {
      if (r.grupoDuplicadoLote && r.loteFirma && r.loteDecisionTomada === true) {
        decisionesGrupoAnteriores.set(r.grupoDuplicadoLote, {
          firma: r.loteFirma,
          seleccionadoIndex: r.loteSeleccionadoIndex,
          omitir: r.loteSeleccionadoOmitir
        });
      }
      delete r.grupoDuplicadoLote;
      delete r.loteFirma;
    }
    const gruposUnion = resultadosValidos.map((_, i) => i);
    const raiz = (i) => {
      while (gruposUnion[i] !== i) {
        gruposUnion[i] = gruposUnion[gruposUnion[i]];
        i = gruposUnion[i];
      }
      return i;
    };
    const unir = (a, b) => {
      const raizA = raiz(a);
      const raizB = raiz(b);
      if (raizA !== raizB) gruposUnion[raizB] = raizA;
    };
    const propietarioPorClave = new Map();
    resultadosValidos.forEach((r, i) => {
      const claves = this._clavesIdentidadLote(r.datos);
      for (const clave of claves) {
        if (propietarioPorClave.has(clave)) unir(i, propietarioPorClave.get(clave));
        else propietarioPorClave.set(clave, i);
      }
    });
    const miembrosPorRaiz = new Map();
    resultadosValidos.forEach((r, i) => {
      const grupo = raiz(i);
      if (!miembrosPorRaiz.has(grupo)) miembrosPorRaiz.set(grupo, []);
      miembrosPorRaiz.get(grupo).push(r);
    });
    const gruposDuplicados = [...miembrosPorRaiz.values()].filter((grupo) => grupo.length > 1);
    gruposDuplicados.forEach((grupo, i) => {
      const grupoId = `lote-${i}`;
      const firma = JSON.stringify(grupo.map((r) => [r.archivo, ...this._clavesIdentidadLote(r.datos).sort()]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
      const decisionAnterior = decisionesGrupoAnteriores.get(grupoId);
      const mismaComposicion = decisionAnterior?.firma === firma;
      grupo.forEach((r) => {
        r.grupoDuplicadoLote = grupoId;
        r.loteFirma = firma;
        if (mismaComposicion) {
          r.loteDecisionTomada = true;
          r.loteSeleccionadoIndex = decisionAnterior.seleccionadoIndex;
          r.loteSeleccionadoOmitir = decisionAnterior.omitir;
        } else {
          delete r.loteDecisionTomada;
          delete r.loteSeleccionadoIndex;
          delete r.loteSeleccionadoOmitir;
        }
      });
    });
    for (const r of resultadosValidos) {
      if (!r.grupoDuplicadoLote) {
        delete r.loteDecisionTomada;
        delete r.loteSeleccionadoIndex;
        delete r.loteSeleccionadoOmitir;
        delete r.loteFirma;
      }
    }

    // Buscar conflictos contra la finca activa; se exige confirmación explícita.
    // Una zona reconocida como propia del PDF puede actualizar su superficie
    // catastral, pero jamás una superficie marcada como manual.
    for (const r of resultadosValidos) {
      const identidadNombre = r.datos.nombre || `Polígono ${r.datos.poligono} Parcela ${r.datos.parcela}`;
      r.coincidenciasZona = ZonasView._buscarCoincidenciasZona(finca.zonas, { ...r.datos, nombre: identidadNombre });
      if (r.duplicadoAccion === 'actualizar' &&
          !r.coincidenciasZona.some((m) => Number(m.zona.id) === Number(r.zonaObjetivoId))) {
        r.duplicadoAccion = '';
        r.zonaObjetivoId = null;
      }
      if (r.duplicadoAccion === 'crear' &&
          (!r.coincidenciasZona.length || r.coincidenciasZona.some((m) => m.coincidencia !== 'nombre (revisar)'))) {
        r.duplicadoAccion = '';
      }
      if (r.incluir === undefined) r.incluir = true;
    }

    // Un PDF marcado para omitir no se guarda: _guardarParcelas lo salta con
    // `continue`. Contarlo aqui hacia que el boton anunciara mas parcelas de las
    // que se acaban escribiendo.
    const validos = this._resultadosParseo.filter((r) =>
      r.incluir && r.datos && this._esPDFElegidoDelGrupo(r) && r.duplicadoAccion !== 'omitir'
    ).length;
    const conError = this._resultadosParseo.filter(r => r.error).length;
    const duplicados = new Set([
      ...this._resultadosParseo.map((r, i) => r.grupoDuplicadoLote || r.coincidenciasZona?.length ? i : -1).filter((i) => i >= 0)
    ]);
    const faltaDecision = () => {
      const faltaGrupoLote = gruposDuplicados.some((grupo) => {
        const decision = grupo[0];
        if (decision.loteDecisionTomada !== true) return true;
        if (decision.loteSeleccionadoOmitir) return false;
        const seleccionado = this._resultadosParseo[decision.loteSeleccionadoIndex];
        return !seleccionado?.incluir || !seleccionado?.datos;
      });
      const faltaZona = this._resultadosParseo.some((r) => r.incluir && r.datos && this._esPDFElegidoDelGrupo(r) &&
        r.coincidenciasZona?.length && !r.duplicadoAccion);
      return faltaGrupoLote || faltaZona;
    };

    main.innerHTML = `
      <div class="wizard-full-screen">
        <div class="wizard-header-fixed border-top-5-gold">
          <h1 class="wizard-header-title uppercase font-950 tracking-widest text-lg"><span style="color: var(--p-gold); margin-right: 6px;">|</span> ${Icons.buscar()} REVISAR PARCELAS (${validos} válidas${conError ? `, ${conError} con error` : ''}${duplicados.size ? `, ${duplicados.size} duplicadas` : ''})</h1>
        </div>
        <div class="wizard-content-scrollable p-20">
          ${duplicados.size > 0 ? `
            <div class="card p-4 mb-10 border-warning" style="background:rgba(255,193,7,0.08);">
              <div class="flex items-center gap-3 text-warning font-800 text-sm mb-4">
                ${Icons.alerta()} ${duplicados.size} posible(s) duplicado(s) detectado(s)
              </div>
              <div class="text-xs text-gray">
                No se reemplazarán datos hasta que selecciones una acción. Los identificadores, nombre operativo, superficie manual, aforo, PAC, asignaciones, eventos y croquis históricos se preservan.
              </div>
            </div>
          ` : ''}
          ${conError > 0 ? `
            <div class="card p-4 mb-10 border-warning" style="background:rgba(255,193,7,0.08);">
              <div class="flex items-center gap-3 text-warning font-800 text-sm">
                ${Icons.alerta()} ${conError} PDF(s) no se pudieron parsear
              </div>
              <div class="mt-2 text-xs text-gray max-h-20 overflow-auto">
                ${this._resultadosParseo.filter(r => r.error).map(r => `
                  <div class="flex justify-between py-1 border-bottom-222">
                    <span>${r.archivo}</span>
                    <span class="text-warning">${r.error}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="grid gap-10">
            ${this._resultadosParseo.map((r, i) => this._tarjetaParcela(r, i, duplicados.has(i))).join('')}
          </div>
        </div>
        <div class="wizard-footer-fixed">
          <button class="btn btn-secondary btn-lg" onclick="ImportarZonasView._volverSeleccion()">${Icons.atras()} Volver</button>
          <button class="btn btn-create btn-lg" onclick="ImportarZonasView._guardarParcelas()" ${validos === 0 || faltaDecision() ? 'disabled' : ''}>${Icons.guardar()} Guardar ${validos} parcela${validos !== 1 ? 's' : ''}</button>
        </div>
      </div>
    `;

    // Listeners para checkboxes, inputs nombre y radios de duplicados
    this._resultadosParseo.forEach((_, i) => {
      const chk = document.getElementById(`chk-${i}`);
      const inp = document.getElementById(`nombre-${i}`);
      if (chk) chk.addEventListener('change', (e) => {
        this._resultadosParseo[i].incluir = e.target.checked;
        this._actualizarBotonGuardar();
      });
      if (inp) inp.addEventListener('input', (e) => {
        this._resultadosParseo[i].nombreEditado = e.target.value.trim();
      });
      if (this._resultadosParseo[i].grupoDuplicadoLote &&
          this._resultadosParseo.findIndex((resultado) => resultado.grupoDuplicadoLote === this._resultadosParseo[i].grupoDuplicadoLote) === i) {
        const grupo = this._resultadosParseo[i].grupoDuplicadoLote;
        document.querySelectorAll(`input[name="dup-lote-${grupo}"]`).forEach((radio) => {
          radio.addEventListener('change', (e) => {
            const seleccion = e.target.value === 'omitir' ? null : Number(e.target.value);
            this._resultadosParseo
              .filter((resultado) => resultado.grupoDuplicadoLote === grupo)
              .forEach((resultado) => {
                resultado.loteDecisionTomada = true;
                resultado.loteSeleccionadoIndex = seleccion;
                resultado.loteSeleccionadoOmitir = seleccion == null;
              });
            this._actualizarBotonGuardar();
          });
        });
      }
      if (this._resultadosParseo[i].coincidenciasZona?.length) {
        document.querySelectorAll(`input[name="dup-action-${i}"]`).forEach((radio) => {
          radio.addEventListener('change', (e) => {
            this._resultadosParseo[i].duplicadoAccion = e.target.value;
            this._resultadosParseo[i].zonaObjetivoId = e.target.dataset.zonaId != null ? Number(e.target.dataset.zonaId) : null;
            this._actualizarBotonGuardar();
          });
        });
      }
    });
  },

  _tarjetaParcela(r, i, esDuplicado = false) {
    if (!r.datos) {
      return `
        <div class="card p-6" style="background:rgba(239,68,68,0.04);border:1px solid var(--c-danger);opacity:0.6;">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              ${Icons.documento()} <strong class="text-gray">${r.archivo}</strong>
            </div>
            <span class="badge badge-sm" style="background:rgba(239,68,68,0.2);color:var(--c-danger);">${r.error}</span>
          </div>
          <input type="hidden" id="chk-${i}"> <input type="hidden" id="nombre-${i}">
        </div>
      `;
    }

    const d = r.datos;
    const superficieHa = d.superficie != null && Number.isFinite(Number(d.superficie))
        ? Number(d.superficie).toFixed(4)
        : (Number.isFinite(Number(d.superficieGrafica)) ? (Number(d.superficieGrafica) / 10000).toFixed(4) : '—');
    let duplicadoHtml = '';
    if (r.grupoDuplicadoLote) {
      const nombreGrupo = r.grupoDuplicadoLote;
      const grupo = this._resultadosParseo.filter((resultado) => resultado.grupoDuplicadoLote === nombreGrupo);
      duplicadoHtml = `
        <div class="mt-6 p-4 rounded-xs" style="background:rgba(255,193,7,0.08);border:1px solid var(--c-warning);">
          <div class="text-xs text-warning font-800 mb-3 flex items-center gap-2">${Icons.alerta()} PDF duplicados dentro de esta importación</div>
          <div class="text-xs text-gray mb-3">Coincide con ${grupo.length} archivos del lote. Elige cuál importar; no se creará más de una zona para este grupo.</div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="dup-lote-${nombreGrupo}" value="${i}" ${r.loteDecisionTomada && !r.loteSeleccionadoOmitir && r.loteSeleccionadoIndex === i ? 'checked' : ''}>
            <span class="text-sm">Importar este PDF</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer mt-4">
            <input type="radio" name="dup-lote-${nombreGrupo}" value="omitir" ${r.loteDecisionTomada && r.loteSeleccionadoOmitir ? 'checked' : ''}>
            <span class="text-sm">Omitir todos los PDF de este grupo</span>
          </label>
        </div>
      `;
    }
    if (r.coincidenciasZona?.length) {
      const coincidencias = r.coincidenciasZona;
      const esCoincidenciaFuerte = coincidencias[0].coincidencia !== 'nombre (revisar)';
      const opciones = coincidencias.map(({ zona, index, coincidencia }) => `
        <label class="flex items-start gap-2 cursor-pointer mb-4">
          <input type="radio" name="dup-action-${i}" value="actualizar" data-zona-id="${zona.id}" ${r.duplicadoAccion === 'actualizar' && Number(r.zonaObjetivoId) === Number(zona.id) ? 'checked' : ''}>
          <span class="text-sm">Actualizar «${zona.nombre || 'Zona sin nombre'}» · ${coincidencia} · ID ${zona.id}</span>
        </label>
      `).join('');
      duplicadoHtml += `
        <div class="mt-6 p-4 rounded-xs" style="background:rgba(255,193,7,0.08);border:1px solid var(--c-warning);">
          <div class="text-xs text-warning font-800 mb-3 flex items-center gap-2">${Icons.alerta()} Parcela posiblemente ya registrada</div>
          <div class="text-xs text-gray mb-4">${d.refCatastral ? `Referencia catastral ${d.refCatastral}` : 'Coincidencia por nombre'} · ${coincidencias.length} zona(s) candidata(s). No se sobrescribirá ninguna relación ni dato operativo.</div>
          ${opciones}
          ${!esCoincidenciaFuerte ? `
            <label class="flex items-center gap-2 cursor-pointer mt-6">
              <input type="radio" name="dup-action-${i}" value="crear" ${r.duplicadoAccion === 'crear' ? 'checked' : ''}>
              <span class="text-sm">No es la misma parcela: crear una zona nueva</span>
            </label>
          ` : ''}
          <label class="flex items-center gap-2 cursor-pointer mt-6">
            <input type="radio" name="dup-action-${i}" value="omitir" ${r.duplicadoAccion === 'omitir' ? 'checked' : ''}>
            <span class="text-sm">Omitir este PDF</span>
          </label>
          <div class="text-xs text-gray mt-4">Actualizar sustituye únicamente los datos catastrales importados. Se conservan ID, nombre, superficie manual, aforo, código PAC, distancia al agua, asignaciones, trazabilidad y croquis anteriores.</div>
        </div>
      `;
    }

    return `
      <div class="card-registro" style="--registro-color: ${r.incluir ? 'var(--c-success)' : 'var(--c-warning)'};">
        <div class="flex flex-col gap-10">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-3 cursor-pointer flex-1">
              <input type="checkbox" id="chk-${i}" ${r.incluir ? 'checked' : ''} class="wizard-checkbox" style="width:20px;height:20px;">
              <div>
                <div class="font-900 text-white">${r.nombreEditado || `Polígono ${d.poligono} Parcela ${d.parcela}`}</div>
                <div class="text-gray text-xs uppercase">Ref. Catastral: ${d.refCatastral || '—'} · Pol: ${d.poligono} · Parc: ${d.parcela}</div>
              </div>
            </label>
          </div>

          <div class="grid grid-cols-2 gap-6 text-sm">
            <div><span class="text-gray">Superficie</span><br><strong class="text-white">${d.superficie != null || d.superficieGrafica != null ? `${superficieHa} ha (${Number(d.superficieGrafica || 0).toLocaleString('es-ES')} m²)` : '—'}</strong></div>
            <div><span class="text-gray">Uso principal</span><br><strong class="text-white">${d.usoPrincipal || '—'}</strong></div>
            <div><span class="text-gray">Clase</span><br><strong class="text-white">${d.clase || '—'}</strong></div>
            <div><span class="text-gray">Municipio</span><br><strong class="text-white">${d.municipio || '—'}</strong></div>
            <div><span class="text-gray">Cultivos SIGPAC</span><br><strong class="text-white">${d.cultivos?.length || 0}</strong></div>
          </div>

          <div class="wizard-input-group">
            <label class="wizard-label" for="nombre-${i}">Nombre a guardar</label>
            <input type="text" id="nombre-${i}" value="${r.nombreEditado}" class="wizard-input" placeholder="Ej: Parcela Norte, Cercado Cebo...">
          </div>

          ${duplicadoHtml}

          <details class="text-xs text-gray mt-6" style="border:1px solid #222;border-radius:4px;">
            <summary class="p-3 font-800 uppercase text-gray cursor-pointer flex items-center gap-2">
              ${Icons.chevronAbajo()} Cultivos SIGPAC (${d.cultivos?.length || 0})
            </summary>
            <div class="p-3 max-h-32 overflow-auto">
              ${d.cultivos?.map(c => `
                <div class="flex justify-between py-1 border-bottom-222">
                  <span>${c.letra} · ${c.aprovechamiento || c.cultivo || 'Cultivo'} · ${c.intensidad || ''}</span>
                  <span class="font-800">${Number(c.superficie).toLocaleString('es-ES')} m²</span>
                </div>
              `).join('') || '<div class="p-3 text-center">Sin datos de cultivos</div>'}
            </div>
          </details>
        </div>
      </div>
    `;
  },

  _clavesIdentidadLote(datos = {}) {
    const claves = [];
    const referencia = ZonasView._normalizarClaveZona(datos.refCatastral);
    const provincia = ZonasView._normalizarClaveZona(datos.provincia);
    const municipio = ZonasView._normalizarClaveZona(datos.municipio);
    if (referencia) claves.push(`ref:${referencia}`);
    if (provincia && municipio && datos.poligono != null && datos.parcela != null) {
      claves.push(`parcela:${JSON.stringify([provincia, municipio, ZonasView._normalizarClaveZona(datos.poligono), ZonasView._normalizarClaveZona(datos.parcela)])}`);
    }
    return claves;
  },

  _esPDFElegidoDelGrupo(r) {
    if (!r.grupoDuplicadoLote) return true;
    const decision = this._resultadosParseo.find((resultado) => resultado.grupoDuplicadoLote === r.grupoDuplicadoLote);
    return decision?.loteDecisionTomada === true && !decision.loteSeleccionadoOmitir &&
      decision.loteSeleccionadoIndex === this._resultadosParseo.indexOf(r);
  },

  _actualizarBotonGuardar() {
    // Un PDF marcado para omitir no se guarda: _guardarParcelas lo salta con
    // `continue`. Contarlo aqui hacia que el boton anunciara mas parcelas de las
    // que se acaban escribiendo.
    const validos = this._resultadosParseo.filter((r) =>
      r.incluir && r.datos && this._esPDFElegidoDelGrupo(r) && r.duplicadoAccion !== 'omitir'
    ).length;
    const gruposLote = new Set(this._resultadosParseo.map((r) => r.grupoDuplicadoLote).filter(Boolean));
    const faltaDecisionLote = [...gruposLote].some((grupo) => {
      const decision = this._resultadosParseo.find((r) => r.grupoDuplicadoLote === grupo);
      if (decision?.loteDecisionTomada !== true) return true;
      if (decision.loteSeleccionadoOmitir) return false;
      const seleccionado = this._resultadosParseo[decision.loteSeleccionadoIndex];
      return !seleccionado?.incluir || !seleccionado?.datos;
    });
    const faltaDecisionZona = this._resultadosParseo.some((r) => r.incluir && r.datos && this._esPDFElegidoDelGrupo(r) &&
      r.coincidenciasZona?.length && !r.duplicadoAccion
    );
    const faltaDecision = faltaDecisionLote || faltaDecisionZona;
    const btn = document.querySelector('.wizard-footer-fixed .btn-create');
    if (btn) {
      btn.disabled = validos === 0 || faltaDecision || this._bloqueoGuardado;
      // innerHTML, no textContent: el icono es un <svg> y textContent lo escapa
      // como texto, dejando el codigo SVG visible dentro del boton.
      btn.innerHTML = `${Icons.guardar()} Guardar ${validos} parcela${validos !== 1 ? 's' : ''}`;
    }
  },

  async _guardarParcelas() {
    if (this._bloqueoGuardado) return;
    const datosSeleccionados = this._resultadosParseo.filter((r) => r.incluir && r.datos);
    if (!datosSeleccionados.length) return;
    const gruposLote = new Set(this._resultadosParseo.map((r) => r.grupoDuplicadoLote).filter(Boolean));
    const faltaDecisionLote = [...gruposLote].some((grupo) => {
      const decision = this._resultadosParseo.find((r) => r.grupoDuplicadoLote === grupo);
      if (decision?.loteDecisionTomada !== true) return true;
      if (decision.loteSeleccionadoOmitir) return false;
      const seleccionado = this._resultadosParseo[decision.loteSeleccionadoIndex];
      return !seleccionado?.incluir || !seleccionado?.datos;
    });
    const faltaDecisionZona = datosSeleccionados.some((r) => this._esPDFElegidoDelGrupo(r) &&
      r.coincidenciasZona?.length && !r.duplicadoAccion);
    if (faltaDecisionLote || faltaDecisionZona) {
      App.toastError('Resuelve cada duplicado: selecciona la zona, crear cuando proceda, u omitir el PDF.');
      return;
    }

    this._bloqueoGuardado = true;
    let fincaGuardada = false;
    const croquisNuevos = [];
    const eventosNuevos = [];
    let transaccionFinca = null;
    let db = null;
    let fincaOriginal = null;
    let rebanosOriginales = [];
    let eventosPreviosIds = new Set();
    let rebanosActualizados = [];
    try {
      const fincaActiva = await Fincas.getActive();
      if (!fincaActiva) throw new Error('No hay finca activa');
      // InMemoryMockDB devuelve referencias mutables. Clonamos finca y zonas
      // antes de editar para que un fallo de save no altere datos por accidente.
      fincaOriginal = {
        ...fincaActiva,
        zonas: Array.isArray(fincaActiva.zonas) ? fincaActiva.zonas.map((zona) => zona ? { ...zona } : zona) : []
      };
      const finca = {
        ...fincaOriginal,
        zonas: fincaOriginal.zonas.map((zona) => zona ? { ...zona } : zona)
      };
      const migracionRelaciones = await ZonasView._asegurarIdsZonasYRelaciones(finca, { persist: false });
      rebanosActualizados = migracionRelaciones.rebanosActualizados;
      db = await window.dbPromise;
      rebanosOriginales = await db.getAllFromIndex('rebanos', 'fincaId', finca.id).catch(() => []);
      const eventosPrevios = await db.getAllFromIndex('registro_eventos', 'fincaId', finca.id).catch(() => []);
      eventosPreviosIds = new Set(eventosPrevios.map((evento) => evento.id));
      finca.zonas = Array.isArray(finca.zonas) ? finca.zonas : [];

      const footer = document.querySelector('.wizard-footer-fixed');
      if (!footer) throw new Error('No se encontró el panel de progreso de importación');
      footer.innerHTML = `
        <div class="w-full text-center py-10">
          <div class="progress-track progress-track--lg mb-4 mx-auto" style="max-width:300px;">
            <div id="save-progress" style="width:0%;height:100%;background:var(--c-success);border-radius:5px;"></div>
          </div>
          <p class="text-sm text-gray">Guardando parcelas y croquis...</p>
        </div>
      `;
      const saveProgress = document.getElementById('save-progress');
      let guardadas = 0;
      let actualizadas = 0;
      let omitidas = 0;
      const actualizacionesPreparadas = [];
      const idsZonaExistentes = finca.zonas.map((zona) => Number(zona?.id) || 0);
      const idsZonaReferenciados = rebanosOriginales.map((rebano) => Number(rebano?.zonaId) || 0);
      let siguienteIdZona = Math.max(0, ...idsZonaExistentes, ...idsZonaReferenciados) + 1;

      for (let i = 0; i < datosSeleccionados.length; i++) {
        const r = datosSeleccionados[i];
        const d = r.datos;
        if (saveProgress) saveProgress.style.width = `${(i / datosSeleccionados.length) * 100}%`;

        // Solo se importa el PDF elegido explícitamente; las otras copias
        // del mismo grupo se omiten sin aplicar sus datos.
        if (r.grupoDuplicadoLote) {
          const decision = this._resultadosParseo.find((resultado) => resultado.grupoDuplicadoLote === r.grupoDuplicadoLote);
          if (decision?.loteDecisionTomada !== true) throw new Error('Elige qué PDF duplicado conservar o si omitir todo el grupo.');
          if (decision.loteSeleccionadoOmitir) {
            if (r === decision) omitidas++;
            continue;
          }
          if (decision.loteSeleccionadoIndex !== this._resultadosParseo.indexOf(r)) {
            omitidas++;
            continue;
          }
          const seleccionado = this._resultadosParseo[decision.loteSeleccionadoIndex];
          if (!seleccionado?.incluir || !seleccionado?.datos) throw new Error('Vuelve a elegir un PDF duplicado que siga marcado para importar.');
        }
        if (r.duplicadoAccion === 'omitir') {
          omitidas++;
          continue;
        }

        let zonaIndex = -1;
        const identidadNombre = d.nombre || `Polígono ${d.poligono} Parcela ${d.parcela}`;
        const coincidenciasActuales = ZonasView._buscarCoincidenciasZona(finca.zonas, { ...d, nombre: identidadNombre });
        if (coincidenciasActuales.length && !r.duplicadoAccion) {
          throw new Error('Se ha detectado una posible zona duplicada desde la revisión. Revisa y confirma qué hacer.');
        }
        if (r.duplicadoAccion === 'actualizar') {
          zonaIndex = finca.zonas.findIndex((zona) => Number(zona?.id) === Number(r.zonaObjetivoId));
          const coincidenciaValida = coincidenciasActuales.some((m) => Number(m.zona.id) === Number(r.zonaObjetivoId));
          if (zonaIndex < 0 || finca.zonas[zonaIndex]?.anulada || !coincidenciaValida) {
            throw new Error('La zona elegida ya no está disponible. Vuelve a revisar los duplicados.');
          }
        }

        if (r.duplicadoAccion === 'crear' && (!r.coincidenciasZona?.length ||
            r.coincidenciasZona.some((m) => m.coincidencia !== 'nombre (revisar)') ||
            !coincidenciasActuales.length || coincidenciasActuales.some((m) => m.coincidencia !== 'nombre (revisar)'))) {
          throw new Error('Solo se puede crear una nueva zona cuando la única coincidencia es por nombre y sigue presente.');
        }
        if (zonaIndex < 0) {
          const coincidenciaCatastralVigente = ZonasView._buscarCoincidenciasZona(finca.zonas, d)
            .some((m) => m.coincidencia !== 'nombre (revisar)');
          if (coincidenciaCatastralVigente) {
            throw new Error('La parcela tiene una referencia, un código PAC o una clave catastral asociada a una zona. Actualiza esa zona u omite el PDF.');
          }
        }

        const zonaExistente = zonaIndex >= 0 ? finca.zonas[zonaIndex] : null;
        const zonaId = zonaExistente?.id ?? siguienteIdZona++;
        if (!Number.isInteger(Number(zonaId)) || Number(zonaId) < 1) {
          throw new Error('No se pudo garantizar un ID estable para la zona a importar.');
        }
        actualizacionesPreparadas.push({
          resultado: r,
          datos: d,
          zonaExistente,
          zonaIndex,
          zonaId,
          nombre: r.nombreEditado || `Polígono ${d.poligono} Parcela ${d.parcela}`
        });
        if (zonaIndex >= 0) actualizadas++;
        else guardadas++;
      }

      if (typeof db.transaction !== 'function') {
        throw new Error('La base de datos no admite una transacción segura; no se guardó ningún cambio.');
      }
      transaccionFinca = db.transaction(['fincas', 'rebanos', 'croquis_parcelas', 'registro_eventos'], 'readwrite');
      const storeCroquis = transaccionFinca.objectStore('croquis_parcelas');
      for (const actualizacion of actualizacionesPreparadas) {
        const { resultado, datos, zonaExistente, zonaIndex, zonaId, nombre } = actualizacion;
        let croquisId = zonaExistente?.croquisId ?? null;
        if (resultado.croquisBlob) {
          croquisId = await storeCroquis.add({
            fincaId: finca.id,
            zonaId,
            blob: resultado.croquisBlob,
            creadoEn: new Date().toISOString(),
            origen: 'importacion-catastro'
          });
          croquisNuevos.push(croquisId);
        }
        const zona = ZonasView._aplicarDatosCatastro(zonaExistente, datos, { id: zonaId, croquisId, nombre });
        if (zonaIndex >= 0) finca.zonas[zonaIndex] = zona;
        else finca.zonas.push(zona);
        eventosNuevos.push({
          zona,
          tipo: resultado.duplicadoAccion === 'actualizar' ? 'actualizacion_catastro_zona' : 'alta_importacion_catastro_zona',
          descripcion: `${resultado.duplicadoAccion === 'actualizar' ? 'Actualización catastral de' : 'Importación catastral de'} zona ${zona.nombre}`,
          observaciones: `PDF: ${resultado.archivo}. Ref. catastral: ${zona.refCatastral || 'sin referencia'}.${resultado.duplicadoAccion === 'actualizar' ? ' Se conservaron los datos operativos, relaciones y croquis histórico.' : ''}`
        });
      }
      const escrituras = [
        Fincas.save(finca, { transaction: transaccionFinca }),
        ZonasView._registrarEventosZonas(finca.id, eventosNuevos, transaccionFinca),
        ...rebanosActualizados.map((rebano) => transaccionFinca.objectStore('rebanos').put(rebano))
      ];
      await Promise.all(escrituras);
      await transaccionFinca.done;
      fincaGuardada = true;

      if (saveProgress) saveProgress.style.width = '100%';
      await new Promise((resolve) => setTimeout(resolve, 300));
      const mensajes = [];
      if (guardadas) mensajes.push(`${guardadas} nueva${guardadas !== 1 ? 's' : ''}`);
      if (actualizadas) mensajes.push(`${actualizadas} actualizada${actualizadas !== 1 ? 's' : ''}`);
      if (omitidas) mensajes.push(`${omitidas} omitida${omitidas !== 1 ? 's' : ''}`);
      this._bloqueoGuardado = false;
      App.toast(`${mensajes.join(', ')} correctamente`, 'success');
      location.hash = '#/zonas';
    } catch (e) {
      if (!fincaGuardada && transaccionFinca) {
        try { transaccionFinca.abort(); } catch (_) { /* el mock puede no implementar abort */ }
        try { await transaccionFinca.done; } catch (_) { /* esperar a que termine el rollback IndexedDB */ }
        // IndexedDB ofrece rollback atómico. Solo el fallback InMemoryMockDB
        // necesita escrituras compensatorias, porque aplica cada operación al instante.
        if (db?.constructor?.name === 'InMemoryMockDB' && fincaOriginal) {
          try {
            await db.put('fincas', fincaOriginal);
            for (const rebano of rebanosOriginales) await db.put('rebanos', rebano);
            for (const id of croquisNuevos) await db.delete('croquis_parcelas', id);
            const eventosTrasFallo = await db.getAllFromIndex('registro_eventos', 'fincaId', fincaOriginal.id).catch(() => []);
            for (const evento of eventosTrasFallo) {
              if (!eventosPreviosIds.has(evento.id)) await db.delete('registro_eventos', evento.id);
            }
          } catch (errorRollback) {
            console.error('[ImportarZonasView] Falló la compensación del guardado en memoria:', errorRollback);
          }
        }
      }
      console.error('[ImportarZonasView] No se pudieron guardar las parcelas:', e);
      this._bloqueoGuardado = false;
      await this._renderPasoRevision();
      App.toastError(`No se pudieron guardar las parcelas: ${e.message}`);
    }
  },

  _volverSeleccion() {
    this.render();
  },

  _cancelar() {
    location.hash = '#/zonas';
  },

  _renderBotonesNavegacion(paso) {
    // Los botones están en el HTML de cada paso
  }
};

window.ImportarZonasView = ImportarZonasView;
