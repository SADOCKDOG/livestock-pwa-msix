/**
 * Livestock Manager - ImportarZonasView v1.0.0
 * Vista para importar zonas/parcelas desde PDF del Catastro (SIGPAC).
 * Flujo: selector PDFs → progreso → revisión tarjetas → guardado en finca.zonas[]
 */

const ImportarZonasView = {
  _archivosSeleccionados: [],
  _resultadosParseo: [],

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

    this._renderPasoRevision();
  },

  _renderPasoRevision() {
    const main = document.getElementById("app-content");
    const validos = this._resultadosParseo.filter(r => r.incluir && r.datos).length;
    const conError = this._resultadosParseo.filter(r => r.error).length;

    // Detectar duplicados por refCatastral
    const refsVistas = new Set();
    const duplicados = new Set();
    this._resultadosParseo.forEach((r, i) => {
      if (r.datos && r.datos.refCatastral) {
        if (refsVistas.has(r.datos.refCatastral)) {
          duplicados.add(i);
        } else {
          refsVistas.add(r.datos.refCatastral);
        }
      }
    });

    main.innerHTML = `
      <div class="wizard-full-screen">
        <div class="wizard-header-fixed border-top-5-gold">
          <h1 class="wizard-header-title uppercase font-950 tracking-widest text-lg"><span style="color: var(--p-gold); margin-right: 6px;">|</span> ${Icons.buscar()} REVISAR PARCELAS (${validos} válidas${conError ? `, ${conError} con error` : ''}${duplicados.size ? `, ${duplicados.size} duplicadas` : ''})</h1>
        </div>
        <div class="wizard-content-scrollable p-20">
          ${duplicados.size > 0 ? `
            <div class="card p-4 mb-10 border-warning" style="background:rgba(255,193,7,0.08);">
              <div class="flex items-center gap-3 text-warning font-800 text-sm mb-4">
                ${Icons.alerta()} ${duplicados.size} parcela${duplicados.size !== 1 ? 's' : ''} con referencia catastral duplicada
              </div>
              <div class="text-xs text-gray">
                Se detectaron parcelas con la misma referencia catastral. Marca "Actualizar" para reemplazar la zona existente, o "Omitir" para no importarla.
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
          <button class="btn btn-create btn-lg" onclick="ImportarZonasView._guardarParcelas()" ${validos === 0 ? 'disabled' : ''}>${Icons.guardar()} Guardar ${validos} parcela${validos !== 1 ? 's' : ''}</button>
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
      if (duplicados.has(i)) {
        const radios = document.querySelectorAll(`input[name="dup-action-${i}"]`);
        radios.forEach(radio => {
          radio.addEventListener('change', (e) => {
            this._resultadosParseo[i].duplicadoAccion = e.target.value; // 'actualizar' | 'omitir'
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
    const superficieHa = (d.superficieGrafica / 10000).toFixed(4);
    const cultivosResumen = d.cultivos?.length ? d.cultivos.map(c => `${c.letra} ${c.aprovechamiento} ${Number(c.superficie).toLocaleString('es-ES')} m²`).join('; ') : 'Sin cultivos SIGPAC';

    let duplicadoHtml = '';
    if (esDuplicado) {
      duplicadoHtml = `
        <div class="mt-6 p-4 rounded-xs" style="background:rgba(255,193,7,0.08);border:1px solid var(--c-warning);">
          <div class="text-xs text-warning font-800 mb-3 flex items-center gap-2">${Icons.alerta()} Referencia catastral duplicada: ${d.refCatastral}</div>
          <div class="flex gap-6">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="dup-action-${i}" value="actualizar" checked>
              <span class="text-sm">Actualizar zona existente</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="dup-action-${i}" value="omitir">
              <span class="text-sm">Omitir (no importar)</span>
            </label>
          </div>
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
            <div><span class="text-gray">Superficie</span><br><strong class="text-white">${superficieHa} ha (${Number(d.superficieGrafica).toLocaleString('es-ES')} m²)</strong></div>
            <div><span class="text-gray">Uso principal</span><br><strong class="text-white">${d.usoPrincipal || '—'}</strong></div>
            <div><span class="text-gray">Clase</span><br><strong class="text-white">${d.clase || '—'}</strong></div>
            <div><span class="text-gray">Municipio</span><br><strong class="text-white">${d.municipio || '—'}</strong></div>
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
                  <span>${c.letra} · ${c.aprovechamiento} · ${c.intensidad || ''}</span>
                  <span class="font-800">${Number(c.superficie).toLocaleString('es-ES')} m²</span>
                </div>
              `).join('') || '<div class="p-3 text-center">Sin datos de cultivos</div>'}
            </div>
          </details>
        </div>
      </div>
    `;
  },

  _actualizarBotonGuardar() {
    const validos = this._resultadosParseo.filter(r => r.incluir && r.datos).length;
    const btn = document.querySelector('.wizard-footer-fixed .btn-create');
    if (btn) {
      btn.disabled = validos === 0;
      btn.textContent = `${Icons.guardar()} Guardar ${validos} parcela${validos !== 1 ? 's' : ''}`;
    }
  },

  async _guardarParcelas() {
    const aGuardar = this._resultadosParseo.filter(r => r.incluir && r.datos);
    if (aGuardar.length === 0) return;

    const finca = await Fincas.getActive();
    if (!finca) {
      App.toastError("No hay finca activa");
      return;
    }

    // Mostrar progreso de guardado
    const footer = document.querySelector('.wizard-footer-fixed');
    footer.innerHTML = `
      <div class="w-full text-center py-10">
        <div class="progress-track progress-track--lg mb-4 mx-auto" style="max-width:300px;">
          <div id="save-progress" style="width:0%;height:100%;background:var(--c-success);border-radius:5px;"></div>
        </div>
        <p class="text-sm text-gray">Guardando parcelas y croquis...</p>
      </div>
    `;

    const saveProgress = document.getElementById('save-progress');
    const db = await window.dbPromise;

    let guardadas = 0;
    let actualizadas = 0;
    let omitidas = 0;

    for (let i = 0; i < aGuardar.length; i++) {
      const r = aGuardar[i];
      const d = r.datos;

      saveProgress.style.width = `${((i) / aGuardar.length) * 100}%`;

      // Manejar duplicados
      if (r.duplicadoAccion === 'omitir') {
        omitidas++;
        continue;
      }

      // Buscar zona existente por refCatastral si es acción "actualizar"
      let zonaIndex = -1;
      if (r.duplicadoAccion === 'actualizar' && d.refCatastral) {
        zonaIndex = finca.zonas.findIndex(z => z.refCatastral === d.refCatastral);
      }

      // 1. Guardar croquis en store aparte
      let croquisId = null;
      if (r.croquisBlob) {
        const croquisRecord = {
          fincaId: finca.id,
          // zonaId se asignará después
          blob: r.croquisBlob,
          creadoEn: new Date().toISOString()
        };
        croquisId = await db.add('croquis_parcelas', croquisRecord);
      }

      // 2. Crear zona
      const zona = {
        nombre: r.nombreEditado || `Polígono ${d.poligono} Parcela ${d.parcela}`,
        refCatastral: d.refCatastral,
        poligono: d.poligono,
        parcela: d.parcela,
        paraje: d.paraje,
        municipio: d.municipio,
        provincia: d.provincia,
        clase: d.clase,
        usoPrincipal: d.usoPrincipal,
        superficieGrafica: d.superficieGrafica, // m² literal
        superficie: d.superficieGrafica / 10000, // hectáreas
        cultivos: d.cultivos,
        croquisId: croquisId,
        creadaEn: new Date().toISOString(),
        actualizadaEn: new Date().toISOString()
      };

      // Añadir o actualizar en finca.zonas[]
      finca.zonas = finca.zonas || [];
      if (zonaIndex >= 0) {
        // Actualizar zona existente
        finca.zonas[zonaIndex] = { ...finca.zonas[zonaIndex], ...zona, actualizadaEn: new Date().toISOString() };
        actualizadas++;
      } else {
        // Nueva zona
        finca.zonas.push(zona);
        zonaIndex = finca.zonas.length - 1;
        guardadas++;
      }

      // Actualizar zonaId en croquis_parcelas
      if (croquisId) {
        const croquis = await db.get('croquis_parcelas', croquisId);
        if (croquis) {
          croquis.zonaId = zonaIndex;
          await db.put('croquis_parcelas', croquis);
        }
      }
    }

    // Guardar finca
    await Fincas.save(finca);

    saveProgress.style.width = '100%';
    await new Promise(r => setTimeout(r, 300));

    let msg = [];
    if (guardadas) msg.push(`${guardadas} nueva${guardadas !== 1 ? 's' : ''}`);
    if (actualizadas) msg.push(`${actualizadas} actualizada${actualizadas !== 1 ? 's' : ''}`);
    if (omitidas) msg.push(`${omitidas} omitida${omitidas !== 1 ? 's' : ''}`);

    App.toast(`${msg.join(', ')} correctamente`, 'success');
    location.hash = '#/zonas';
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