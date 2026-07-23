/**
 * Wizard Vacunación (modelo jerárquico ADSG)
 * Alta de una Vacunación con hasta 4 Tipos de Vacuna (lote/dosis/nombre
 * comercial) y selección de animales vacunados (por categoría agregada o
 * animal individual). Ver js/vacunaciones.js y docs/PLAN-MEJORA-SIGGAN.md
 * punto 3.
 */
window.WizardVacunacion = {
  async registrar(rebanoId, options = {}) {
    if (!window.Vacunaciones) {
      App.toastError('Módulo de vacunaciones no disponible.');
      return;
    }

    const rebanos = await window.Rebanos.list().catch(() => []);
    const rebanoInicial = rebanoId || rebanos[0]?.id || null;
    const animales = rebanoInicial ? await window.Animales.list(Number(rebanoInicial)).catch(() => []) : [];
    const CS = window.ComunidadesService;
    const categorias = CS && rebanoInicial
      ? CS.getCategoriasAnimal(rebanos.find((r) => r.id == rebanoInicial)?.especie)
      : [];

    // Productos del botiquín de la finca activa, para vincular opcionalmente
    // el consumo de stock de vacunas a este registro (js/botiquin.js) —
    // gestión interna, no exigida por SIGGAN, no condiciona el guardado.
    let productosBotiquin = [];
    try {
      const fincaActiva = window.Fincas ? await window.Fincas.getActive() : null;
      if (fincaActiva && window.Botiquin) {
        productosBotiquin = await window.Botiquin.listActivos(fincaActiva.id);
      }
    } catch (e) { /* sin finca activa o módulo no disponible */ }

    const wizardSteps = [
      {
        // PASO 1: Cabecera + tipos de vacuna
        content: (data) => `
          <div class="card card-accent card-accent-green p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-success)">DATOS DE LA VACUNACIÓN</div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">REBAÑO</label>
              <select id="w-vac-rebano" class="wizard-input font-800">
                ${rebanos.map((r) => `<option value="${r.id}" ${data.rebanoId == r.id ? 'selected' : ''}>${r.nombre.toUpperCase()}</option>`).join('')}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-12 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">FECHA</label>
                <input type="date" id="w-vac-fecha" class="wizard-input font-800" value="${data.fecha}">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">VETERINARIO</label>
                <input type="text" id="w-vac-vet" class="wizard-input uppercase font-800" value="${data.veterinario || ''}" placeholder="NOMBRE">
              </div>
            </div>

            <div class="border-top-222 pt-12 mt-4">
              <div class="text-[0.6rem] text-gold font-950 uppercase tracking-widest mb-10">TIPOS DE VACUNA (MÁX. 4)</div>
              <div id="w-vac-tipos-list"></div>
              <button type="button" id="btn-add-tipo-vacuna" class="widget-link-btn widget-link-btn--neon neon-info w-full px-12 py-8 min-h-0 h-auto mt-8">
                <span class="text-[0.65rem] font-950 uppercase">${Icons.fabPlus ? Icons.fabPlus() : '+'} Añadir tipo de vacuna</span>
              </button>
            </div>

            <div class="wizard-input-group mt-16">
              <label class="wizard-label">OBSERVACIONES</label>
              <input type="text" id="w-vac-obs" class="wizard-input" value="${data.observaciones || ''}">
            </div>
          </div>
        `,
        onRender: (data, stepEl) => {
          const listEl = stepEl.querySelector('#w-vac-tipos-list');
          const renderTipos = () => {
            const tipos = data.tipos_vacuna && data.tipos_vacuna.length ? data.tipos_vacuna : [{ tipo: '', lote: '', dosis: '', nombre_comercial: '' }];
            listEl.innerHTML = tipos.map((t, i) => `
              <div class="p-10 mb-8 bg-black border border-222 rounded-sm" data-tipo-row="${i}">
                <div class="flex justify-between items-center mb-6">
                  <span class="text-[0.55rem] text-gray uppercase font-900">TIPO ${i + 1}</span>
                  ${tipos.length > 1 ? `<button type="button" class="btn-remove-tipo text-danger" data-idx="${i}" style="background:none;border:none;cursor:pointer;">${Icons.eliminar ? Icons.eliminar() : '✕'}</button>` : ''}
                </div>
                <div class="wizard-input-group mb-6">
                  <label class="text-[0.55rem] text-gray uppercase font-800">TIPO / NOMBRE</label>
                  <input type="text" class="wizard-input h-35 text-xs font-800 tipo-vacuna-tipo" data-idx="${i}" value="${t.tipo || ''}" placeholder="Ej: Clostridiosis">
                </div>
                <div class="grid grid-cols-2 gap-8">
                  <div class="wizard-input-group">
                    <label class="text-[0.55rem] text-gray uppercase font-800">LOTE</label>
                    <input type="text" class="wizard-input h-35 text-xs font-800 tipo-vacuna-lote uppercase" data-idx="${i}" value="${t.lote || ''}">
                  </div>
                  <div class="wizard-input-group">
                    <label class="text-[0.55rem] text-gray uppercase font-800">DOSIS</label>
                    <input type="text" class="wizard-input h-35 text-xs font-800 tipo-vacuna-dosis" data-idx="${i}" value="${t.dosis || ''}" placeholder="Ej: 2ml">
                  </div>
                </div>
                <div class="wizard-input-group mt-6">
                  <label class="text-[0.55rem] text-gray uppercase font-800">NOMBRE COMERCIAL</label>
                  <input type="text" class="wizard-input h-35 text-xs font-800 tipo-vacuna-comercial" data-idx="${i}" value="${t.nombre_comercial || ''}">
                </div>
                ${productosBotiquin.length > 0 ? `
                <div class="grid grid-cols-2 gap-8 mt-6 pt-6 border-top-222">
                  <div class="wizard-input-group">
                    <label class="text-[0.55rem] text-gray uppercase font-800">DESCONTAR DE BOTIQUÍN (OPC.)</label>
                    <select class="wizard-input h-35 text-xs font-800 tipo-vacuna-botiquin-producto" data-idx="${i}">
                      <option value="">— NO VINCULAR —</option>
                      ${productosBotiquin.map(p => `<option value="${p.id}" ${t.botiquinProductoId == p.id ? 'selected' : ''}>${p.nombre.toUpperCase()} (${p.cantidadActual || 0} ${p.unidad || ''})</option>`).join('')}
                    </select>
                  </div>
                  <div class="wizard-input-group">
                    <label class="text-[0.55rem] text-gray uppercase font-800">CANTIDAD</label>
                    <input type="number" min="0.01" step="0.01" class="wizard-input h-35 text-xs font-800 tipo-vacuna-botiquin-cantidad" data-idx="${i}" value="${t.botiquinCantidad || ''}" placeholder="Ej: 5">
                  </div>
                </div>` : ''}
              </div>
            `).join('');

            listEl.querySelectorAll('.btn-remove-tipo').forEach((btn) => {
              btn.onclick = () => {
                const idx = Number(btn.dataset.idx);
                data.tipos_vacuna.splice(idx, 1);
                renderTipos();
              };
            });
          };

          if (!data.tipos_vacuna || data.tipos_vacuna.length === 0) {
            data.tipos_vacuna = [{ tipo: '', lote: '', dosis: '', nombre_comercial: '' }];
          }
          renderTipos();

          const btnAdd = stepEl.querySelector('#btn-add-tipo-vacuna');
          btnAdd.onclick = () => {
            if (data.tipos_vacuna.length >= window.Vacunaciones.MAX_TIPOS_VACUNA) {
              App.toastError(`Máximo ${window.Vacunaciones.MAX_TIPOS_VACUNA} tipos de vacuna por vacunación.`);
              return;
            }
            // Capturar lo ya escrito antes de añadir una fila nueva
            listEl.querySelectorAll('[data-tipo-row]').forEach((row) => {
              const idx = Number(row.dataset.tipoRow);
              const botiquinProductoVal = row.querySelector('.tipo-vacuna-botiquin-producto')?.value;
              data.tipos_vacuna[idx] = {
                tipo: row.querySelector('.tipo-vacuna-tipo').value.trim(),
                lote: row.querySelector('.tipo-vacuna-lote').value.trim(),
                dosis: row.querySelector('.tipo-vacuna-dosis').value.trim(),
                nombre_comercial: row.querySelector('.tipo-vacuna-comercial').value.trim(),
                botiquinProductoId: botiquinProductoVal ? Number(botiquinProductoVal) : null,
                botiquinCantidad: row.querySelector('.tipo-vacuna-botiquin-cantidad')?.value
                  ? Number(row.querySelector('.tipo-vacuna-botiquin-cantidad').value) : null,
              };
            });
            data.tipos_vacuna.push({ tipo: '', lote: '', dosis: '', nombre_comercial: '' });
            renderTipos();
          };
        },
        onChange: async (data) => {
          data.rebanoId = document.getElementById('w-vac-rebano')?.value ? Number(document.getElementById('w-vac-rebano').value) : data.rebanoId;
          data.fecha = document.getElementById('w-vac-fecha')?.value || data.fecha;
          data.veterinario = document.getElementById('w-vac-vet')?.value.trim() || '';
          data.observaciones = document.getElementById('w-vac-obs')?.value.trim() || '';

          const listEl = document.getElementById('w-vac-tipos-list');
          const tipos = [];
          listEl.querySelectorAll('[data-tipo-row]').forEach((row) => {
            const botiquinProductoVal = row.querySelector('.tipo-vacuna-botiquin-producto')?.value;
            tipos.push({
              tipo: row.querySelector('.tipo-vacuna-tipo').value.trim(),
              lote: row.querySelector('.tipo-vacuna-lote').value.trim(),
              dosis: row.querySelector('.tipo-vacuna-dosis').value.trim(),
              nombre_comercial: row.querySelector('.tipo-vacuna-comercial').value.trim(),
              botiquinProductoId: botiquinProductoVal ? Number(botiquinProductoVal) : null,
              botiquinCantidad: row.querySelector('.tipo-vacuna-botiquin-cantidad')?.value
                ? Number(row.querySelector('.tipo-vacuna-botiquin-cantidad').value) : null,
            });
          });
          data.tipos_vacuna = tipos;
        },
        validate: async (data) => {
          if (!data.rebanoId) {
            App.toastError('Selecciona un rebaño.');
            return false;
          }
          const tiposValidos = (data.tipos_vacuna || []).filter((t) => t.tipo);
          if (tiposValidos.length === 0) {
            App.toastError('Indica al menos un tipo de vacuna.');
            return false;
          }
          const tipoConBotiquinSinCantidad = tiposValidos.find((t) => t.botiquinProductoId && (!t.botiquinCantidad || t.botiquinCantidad <= 0));
          if (tipoConBotiquinSinCantidad) {
            App.toastError('Indica la cantidad a descontar del botiquín para el tipo de vacuna vinculado.');
            return false;
          }
          data.tipos_vacuna = tiposValidos;
          return true;
        }
      },
      {
        // PASO 2: Animales vacunados
        content: (data) => `
          <div class="card card-accent card-accent-blue p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-info)">ANIMALES VACUNADOS</div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">MODO DE SELECCIÓN</label>
              <select id="w-vac-modo" class="wizard-input font-800">
                <option value="categoria" ${(data.modo_seleccion || 'categoria') === 'categoria' ? 'selected' : ''}>POR CATEGORÍA (AGREGADO)</option>
                <option value="individual" ${data.modo_seleccion === 'individual' ? 'selected' : ''}>ANIMALES INDIVIDUALES</option>
              </select>
            </div>

            <div id="w-vac-categoria-wrap" class="${(data.modo_seleccion || 'categoria') === 'categoria' ? '' : 'd-none'}">
              <div class="wizard-input-group mb-12">
                <label class="wizard-label">CATEGORÍA</label>
                <select id="w-vac-categoria" class="wizard-input font-800">
                  <option value="">— SIN CATEGORIZAR —</option>
                  ${categorias.map((c) => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
              <div class="wizard-input-group mb-12">
                <label class="wizard-label">CANTIDAD VACUNADA</label>
                <input type="number" id="w-vac-cantidad" min="1" class="wizard-input font-900 text-lg" value="${data.animales_vacunados?.[0]?.cantidad || 1}">
              </div>
            </div>

            <div id="w-vac-individual-wrap" class="${data.modo_seleccion === 'individual' ? '' : 'd-none'}">
              <div class="wizard-input-group mb-12">
                <label class="wizard-label">SELECCIONA ANIMALES</label>
                <select id="w-vac-animales" multiple class="wizard-input font-800" style="min-height: 140px;">
                  ${animales.map((a) => `<option value="${a.id}">${(a.numero_identificacion || ('#' + a.id)).toUpperCase()}</option>`).join('')}
                </select>
                <div class="text-[0.55rem] text-gray uppercase font-700 mt-4">Mantén Ctrl/Cmd para seleccionar varios.</div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-12 mt-12">
              <div class="wizard-input-group">
                <label class="wizard-label">ANIMALES TOTALES (CENSO)</label>
                <input type="number" id="w-vac-totales" min="0" class="wizard-input font-800" value="${data.animales_totales || ''}" placeholder="Opcional">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">% CENSO VACUNADO</label>
                <select id="w-vac-completa" class="wizard-input font-800">
                  <option value="false" ${!data.completa ? 'selected' : ''}>PARCIAL</option>
                  <option value="true" ${data.completa ? 'selected' : ''}>100% (COMPLETA)</option>
                </select>
              </div>
            </div>
          </div>
        `,
        onRender: (data, stepEl) => {
          const modoSel = stepEl.querySelector('#w-vac-modo');
          const catWrap = stepEl.querySelector('#w-vac-categoria-wrap');
          const indWrap = stepEl.querySelector('#w-vac-individual-wrap');
          modoSel.addEventListener('change', (e) => {
            const esCategoria = e.target.value === 'categoria';
            catWrap.classList.toggle('d-none', !esCategoria);
            indWrap.classList.toggle('d-none', esCategoria);
          });
        },
        onChange: async (data) => {
          const modo = document.getElementById('w-vac-modo')?.value || 'categoria';
          data.modo_seleccion = modo;
          data.animales_totales = document.getElementById('w-vac-totales')?.value
            ? Number(document.getElementById('w-vac-totales').value) : null;
          data.completa = document.getElementById('w-vac-completa')?.value === 'true';

          if (modo === 'categoria') {
            const categoria = document.getElementById('w-vac-categoria')?.value || '';
            const cantidad = Number(document.getElementById('w-vac-cantidad')?.value) || 1;
            data.animales_vacunados = [{ categoria: categoria || 'Sin categorizar', cantidad }];
          } else {
            const select = document.getElementById('w-vac-animales');
            const seleccionados = select ? Array.from(select.selectedOptions).map((o) => Number(o.value)) : [];
            data.animales_vacunados = seleccionados.map((animalId) => ({ animalId, cantidad: 1 }));
          }
        },
        validate: async (data) => {
          if (!data.animales_vacunados || data.animales_vacunados.length === 0) {
            App.toastError('Indica al menos un animal o categoría vacunada.');
            return false;
          }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-vacunacion',
      title: 'VACUNACIÓN',
      initialData: {
        rebanoId: rebanoInicial,
        fecha: new Date().toISOString().split('T')[0],
        veterinario: '',
        observaciones: '',
        tipos_vacuna: [],
        modo_seleccion: 'categoria',
        animales_vacunados: [],
        animales_totales: null,
        completa: false,
      },
      steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          const vacunacionId = await window.Vacunaciones.save(finalData);

          if (window.Botiquin) {
            const tiposConStock = (finalData.tipos_vacuna || []).filter((t) => t.botiquinProductoId && t.botiquinCantidad > 0);
            for (const t of tiposConStock) {
              try {
                await window.Botiquin.consumir(t.botiquinProductoId, t.botiquinCantidad, {
                  fecha: finalData.fecha,
                  origenTipo: 'vacunacion',
                  origenId: vacunacionId
                });
              } catch (stockErr) {
                App.toastError(`Vacunación guardada, pero no se pudo descontar stock de "${t.tipo}": ${stockErr.message}`);
              }
            }
          }

          App.toast('Vacunación registrada correctamente.', 'success');
          if (options.onSaved) options.onSaved();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  }
};
