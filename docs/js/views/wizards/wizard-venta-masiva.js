/**
 * Wizard Venta Masiva de Animales
 * Extraído de app.js para modularización (Fase 3)
 */
window.VentaMasivaWizard = {
  async open(borrador = null) {
    const App = window.App;
    if (!App) return console.error("App no disponible");

    // Cargar compradores para el selector (con fallback)
    const compradoresList = await window.Compradores.list({ activo: true }).catch(async () => {
      console.warn("[WizardVenta] Fallback: cargando compradores sin filtro activo");
      return await window.Compradores.list().catch(() => []);
    });

    const initialData = {
      id: borrador ? borrador.id : undefined,
      fechaSacrificio: borrador ? borrador.fechaSacrificio : new Date().toISOString().split("T")[0],
      codigoMatadero: borrador ? (borrador.codigoMatadero || 'Matadero Central') : "Matadero Central",
      codigoICA: borrador ? borrador.codigoICA : "",
      numeroGuia: borrador ? borrador.numeroGuia : "",
      confirmacionFitosanitarios: borrador ? !!borrador.confirmacionFitosanitarios : false,
      compradorId: borrador ? borrador.compradorId : null,
      nifComprador: borrador ? borrador.nifComprador : "",
      razonSocial: borrador ? borrador.razonSocial : "",
      ivaPct: borrador ? borrador.ivaPct : 10,
      retencionPct: borrador ? borrador.retencionPct : 0,
      pVivo: borrador ? borrador.pVivo : 0,
      pCanal: borrador ? borrador.pCanal : 0,
      gTrans: borrador ? borrador.gTrans : 0,
      gMata: borrador ? borrador.gMata : 0,
      precioUnitario: borrador ? (borrador.precioUnitario || 0) : 0,
      seleccionados: borrador ? (borrador.animalId || []) : [],
      _compradores: compradoresList,
      _compradoresLoaded: true,
      // Transportista
      transportistaId: borrador ? borrador.transportistaId : null,
      nombreTransportista: borrador ? borrador.nombreTransportista : "",
      nifTransportista: borrador ? borrador.nifTransportista : "",
      matriculaTransportista: borrador ? borrador.matriculaTransportista : "",
      // Autorización veterinaria
      vet_nombre: borrador ? borrador.autorizacion_veterinaria?.vet_nombre : "",
      vet_colegiado: borrador ? borrador.autorizacion_veterinaria?.vet_colegiado : "",
      vet_fecha_autorizacion: borrador ? (borrador.autorizacion_veterinaria?.fecha_autorizacion || new Date().toISOString().split("T")[0]) : new Date().toISOString().split("T")[0],
      dimoe_generado: borrador ? !!borrador.movimientoId : false,
    };

    App.toast("Analizando censo y estado sanitario...");

    const wizardSteps = [
      {
        content: async (data) => {
          const animales = await window.Animales.list();
          const rebanos = await window.Rebanos.list();
          const animalesActivos = animales.filter(
            (a) => a.estado === "activo" || a.estado === "Activo"
          );

          // Cargar eventos de reproducción para gestación
          let eventosRepro = [];
          try {
            eventosRepro = await window.db.getAll('reproduccion_eventos') || [];
          } catch(e) { /* store puede no existir */ }

          let tablaFilasHtml = "";
          let totalBloqueados = 0;

          const checkPromises = animalesActivos.map((animal) =>
            (async () => {
              const rebano = rebanos.find((r) => r.id === animal.rebanoId) || { nombre: "S/R" };
              try {
                const controlSanitario = await Promise.race([
                  window.Trazabilidad.checkSupresion(window.db, animal.id, data.fechaSacrificio, "carne"),
                  new Promise((resolve) => setTimeout(() => resolve({ apto: true, motivo: "timeout" }), 3000)),
                ]);
                // Gate: Edad mínima
                const hoy = new Date();
                const nac = animal.fecha_nacimiento ? new Date(animal.fecha_nacimiento) : null;
                let edadTexto = 'N/D', gateEdad = true, edadMeses = 0;
                if (nac && !isNaN(nac)) {
                  edadMeses = Math.floor((hoy - nac) / (1000 * 60 * 60 * 24 * 30.44));
                  const edadAnios = Math.floor(edadMeses / 12);
                  const edadMesesResto = edadMeses % 12;
                  edadTexto = edadAnios > 0 ? `${edadAnios}a ${edadMesesResto}m` : `${edadMeses}m`;
                  // Edad mínima por especie
                  const especie = (animal.especie || '').toLowerCase();
                  const minMeses = especie.includes('vaca') || especie.includes('bovino') ? 12
                    : especie.includes('ovej') || especie.includes('cabra') || especie.includes('caprino') || especie.includes('ovino') ? 6
                    : especie.includes('cerdo') || especie.includes('porcino') ? 3
                    : 0;
                  if (minMeses > 0 && edadMeses < minMeses) gateEdad = false;
                }
                // Gate: DIB obligatorio para bovinos
                const especie = (animal.especie || '').toLowerCase();
                const requiereDib = especie.includes('vaca') || especie.includes('bovino');
                const gateDib = !(requiereDib && !animal.dib);
                // Gate: Gestación (hembras con diagnóstico positivo)
                let gateGestacion = true, gestacionTexto = '';
                if ((animal.sexo || '').toLowerCase() === 'hembra') {
                  const gestEventos = eventosRepro.filter(e =>
                    Number(e.animalId) === Number(animal.id) && e.tipo_evento === 'gestacion'
                  );
                  const ultimaGestacion = gestEventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
                  if (ultimaGestacion && (ultimaGestacion.resultado || '').toLowerCase() === 'positivo') {
                    const fechaGest = new Date(ultimaGestacion.fecha);
                    const partosPosteriores = eventosRepro.filter(e =>
                      Number(e.animalId) === Number(animal.id) &&
                      (e.tipo_evento === 'parto' || e.tipo_evento === 'aborto') &&
                      new Date(e.fecha) > fechaGest
                    );
                    if (partosPosteriores.length === 0) {
                      const diasGestacion = Math.floor((hoy - fechaGest) / (1000 * 60 * 60 * 24));
                      gestacionTexto = `${diasGestacion}d`;
                      if (diasGestacion > 90) gateGestacion = false;
                    }
                  }
                }
                const gateKeep = { edadTexto, gateEdad, requiereDib, gateDib, gateGestacion, gestacionTexto };
                const bloqueado = !controlSanitario.apto || !gateEdad || !gateDib || !gateGestacion;
                return { animal, rebano, controlSanitario, gateKeep, bloqueado };
              } catch (err) {
                return { animal, rebano, controlSanitario: { apto: true, motivo: "error" }, gateKeep: { gateEdad: true, gateDib: true, gateGestacion: true }, bloqueado: false };
              }
            })()
          );

          const results = await Promise.all(checkPromises);

          for (let { animal, rebano, controlSanitario, gateKeep, bloqueado } of results) {
            if (bloqueado) {
                totalBloqueados++;
                const motivos = [];
                if (!controlSanitario.apto) motivos.push(`${controlSanitario?.diasRestantes ?? "X"}D`);
                if (!gateKeep.gateEdad) motivos.push('JOVEN');
                if (!gateKeep.gateDib) motivos.push('SIN DIB');
                if (!gateKeep.gateGestacion) motivos.push('GEST.');
                tablaFilasHtml += `
                <tr class="tr-blocked border-bottom-222">
                    <td class="text-center p-14"><input type="checkbox" disabled class="checkbox-lg opacity-20"></td>
                    <td class="font-900 p-14 uppercase text-white">${animal.numero_identificacion}</td>
                    <td class="p-14 text-aaa uppercase font-800">${animal.raza || '—'}</td>
                    <td class="text-red font-950 p-14 uppercase text-[0.6rem] tracking-tight">${motivos.join(' | ')}</td>
                </tr>`;
              } else {
                tablaFilasHtml += `
                <tr class="tr-active border-bottom-222">
                    <td class="text-center p-14"><input type="checkbox" name="animal-select" value="${animal.id}" ${data.seleccionados?.includes(animal.id) ? "checked" : ""} class="batch-animal-chk checkbox-lg cursor-pointer"></td>
                    <td class="text-gold font-950 p-14 uppercase">${animal.numero_identificacion}</td>
                    <td class="p-14 text-white uppercase font-800">${animal.raza || '—'}</td>
                    <td class="text-green font-950 p-14 uppercase text-[0.6rem] tracking-tight">APTO</td>
                </tr>`;
              }
          }

          return `
              <div class="card card-accent card-accent-green p-16 mt-10">
                <div class="section-header-theme mb-12" style="--theme-color: var(--c-success)">ANÁLISIS DE APTITUD</div>
                <div class="flex gap-15 mb-15">
                    <div class="text-center bg-black border border-222 p-12 rounded-sm flex-1"><small class="text-gray uppercase font-900 text-[0.6rem]">APTOS</small><div class="text-green font-950 text-2xl mt-4">${animalesActivos.length - totalBloqueados}</div></div>
                    <div class="text-center bg-black border border-222 p-12 rounded-sm flex-1"><small class="text-red uppercase font-900 text-[0.6rem]">BLOQUEADOS</small><div class="text-red font-950 text-2xl mt-4">${totalBloqueados}</div></div>
                </div>
                <div class="text-center text-[0.6rem] text-aaa uppercase font-800 tracking-widest mb-10 opacity-70">
                  <span class="mr-10">JOVEN</span>
                  <span class="mr-10">DIB (BOVINOS)</span>
                  <span class="mr-10">GESTACIÓN</span>
                  <span>SUPRESIÓN</span>
                </div>
                <div class="venta-tabla-wrapper border border-222 rounded-sm">
                    <table class="w-full text-xs table-collapse">
                        <thead class="thead-sticky bg-black border-bottom-222">
                            <tr>
                                <th class="text-center p-12"><input type="checkbox" id="select-all-lote" class="checkbox-lg"></th>
                                <th class="text-gray p-12 uppercase font-900">ID OFICIAL</th>
                                <th class="text-gray p-12 uppercase font-900">RAZA</th>
                                <th class="text-gray p-12 uppercase font-900">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tablaFilasHtml || '<tr><td colspan="4" class="text-center text-gray-500 uppercase font-900 p-20">Sin animales activos</td></tr>'}
                        </tbody>
                    </table>
                </div>
              </div>
          `;
        },
        onRender: (data, stepEl) => {
          const selAll = stepEl.querySelector("#select-all-lote");
          if (selAll) {
            selAll.addEventListener('change', (e) => {
              stepEl.querySelectorAll('.batch-animal-chk').forEach(cb => cb.checked = e.target.checked);
            });
          }
        },
        onChange: async (data) => {
          const checks = document.querySelectorAll('.batch-animal-chk:checked');
          data.seleccionados = Array.from(checks).map(c => parseInt(c.value));
        },
        validate: async (data) => {
          if (!data.seleccionados || data.seleccionados.length === 0) {
            App.toastError("Selecciona al menos un animal apto");
            return false;
          }
          return true;
        }
      },
      {
        content: (data) => `
          <div class="card card-accent card-accent-amber p-16 mt-10">
              <div class="section-header-theme mb-12" style="--theme-color: var(--p-gold)">TRAZABILIDAD LOGÍSTICA</div>
              <div class="wizard-input-group mb-12">
                <label class="wizard-label">FECHA SACRIFICIO</label>
                <input type="date" id="w-v-fecha" value="${data.fechaSacrificio}" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group mb-12">
                <label class="wizard-label">MATADERO DESTINO</label>
                <input type="text" id="w-v-mata" value="${data.codigoMatadero}" class="wizard-input uppercase font-800" placeholder="NOMBRE DEL MATADERO">
              </div>
              <div class="wizard-input-group mb-12">
                <label class="wizard-label">DOCUMENTO ICA</label>
                <input type="text" id="w-v-ica" value="${data.codigoICA}" placeholder="CÓDIGO ICA..." class="wizard-input uppercase font-800">
              </div>
              <div class="wizard-input-group mb-16">
                <label class="wizard-label">GUÍA SANITARIA</label>
                <input type="text" id="w-v-guia" value="${data.numeroGuia}" placeholder="Nº GUÍA OFICIAL..." class="wizard-input uppercase font-800">
              </div>
              <label class="flex items-center gap-10 text-xs text-white cursor-pointer bg-black border border-222 p-12 rounded-sm">
                  <input type="checkbox" id="w-v-fitos" ${data.confirmacionFitosanitarios ? 'checked' : ''} style="accent-color:var(--p-gold);">
                  <span class="uppercase font-900 text-[0.6rem] tracking-tight leading-tight">DECLARACIÓN FITOSANITARIA COLECTIVA (AUSENCIA RESIDUOS 180 DÍAS)</span>
              </label>
          </div>
        `,
        onChange: async (data) => {
          data.fechaSacrificio = document.getElementById('w-v-fecha')?.value || data.fechaSacrificio;
          data.codigoMatadero = document.getElementById('w-v-mata')?.value || data.codigoMatadero;
          data.codigoICA = document.getElementById('w-v-ica')?.value || data.codigoICA;
          data.numeroGuia = document.getElementById('w-v-guia')?.value || data.numeroGuia;
          data.confirmacionFitosanitarios = document.getElementById('w-v-fitos')?.checked || false;
        },
        validate: async (data) => {
          if (!data.codigoICA || !data.numeroGuia || !data.confirmacionFitosanitarios) {
            App.toastError("Todos los campos de trazabilidad son obligatorios.");
            return false;
          }
          return true;
        }
      },
      {
        content: (data) => `
          <div class="card card-accent card-accent-green p-16 mt-10">
              <div class="section-header-theme mb-12" style="--theme-color: var(--c-success)">DATOS ECONÓMICOS</div>
              <div class="grid grid-cols-2 gap-15 mb-12">
                  <div class="wizard-input-group">
                    <label class="wizard-label">PESO VIVO (kg)</label>
                    <input type="number" id="w-v-pv" value="${data.pVivo}" class="wizard-input font-900 text-lg">
                  </div>
                  <div class="wizard-input-group">
                    <label class="wizard-label">PESO CANAL (kg)</label>
                    <input type="number" id="w-v-pc" value="${data.pCanal}" class="wizard-input font-900 text-lg text-green">
                  </div>
              </div>
              <div class="grid grid-cols-3 gap-10">
                  <div class="wizard-input-group">
                    <label class="wizard-label">PRECIO (€/kg canal)</label>
                    <input type="number" step="0.01" id="w-v-preciounitario" value="${data.precioUnitario || ''}" placeholder="EJ: 2.80" class="wizard-input font-950 text-gold bg-black">
                  </div>
                  <div class="wizard-input-group">
                    <label class="wizard-label">TRANSPORTE (€)</label>
                    <input type="number" id="w-v-gt" value="${data.gTrans}" class="wizard-input font-800">
                  </div>
                  <div class="wizard-input-group">
                    <label class="wizard-label">MATANZA (€)</label>
                    <input type="number" id="w-v-gm" value="${data.gMata}" class="wizard-input font-800">
                  </div>
              </div>
          </div>
        `,
        onChange: async (data) => {
          data.pVivo = parseFloat(document.getElementById('w-v-pv')?.value) || 0;
          data.pCanal = parseFloat(document.getElementById('w-v-pc')?.value) || 0;
          data.precioUnitario = parseFloat(document.getElementById('w-v-preciounitario')?.value) || 0;
          data.gTrans = parseFloat(document.getElementById('w-v-gt')?.value) || 0;
          data.gMata = parseFloat(document.getElementById('w-v-gm')?.value) || 0;
        },
        validate: async (data) => {
          if (data.pCanal >= data.pVivo && data.pVivo > 0) {
            App.toastError("El peso canal no puede ser mayor o igual que el peso vivo.");
            return false;
          }
          if (data.pCanal > 0 && data.precioUnitario <= 0) {
            App.toast("Has dejado el Precio Unitario en 0€. Se emitirá la factura como pendiente de fijar.", 'warning');
          }
          return true;
        }
      },
      {
        content: (data) => {
          const compradores = data._compradores || [];
          return `
          <div class="card card-accent card-accent-blue p-16 mt-10">
              <div class="section-header-theme mb-12" style="--theme-color: var(--c-info)">LIQUIDACIÓN Y CLIENTE</div>
              <div class="wizard-input-group mb-12">
                <label class="wizard-label">COMPRADOR REGISTRADO</label>
                <div class="flex gap-8 items-center">
                  <select id="w-v-comprador" class="flex-1 wizard-input font-800" style="padding:11px;"
                    onchange="App._onCompradorChangeWizard(this)">
                    <option value="">${compradores.length === 0 ? 'SIN COMPRADORES ACTIVOS' : 'SELECCIONAR CLIENTE...'}</option>
                    ${compradores.map(c =>
                      `<option value="${c.id}" ${data.compradorId === c.id ? 'selected' : ''}>${c.nombre.toUpperCase()}</option>`
                    ).join('')}
                  </select>
                  <button type="button" onclick="App._abrirAltaCompradorRapida()" class="widget-link-btn widget-link-btn--neon neon-success px-12 py-6 min-h-0 h-auto">
                    <span class="text-[0.6rem] font-950 uppercase">NUEVO</span>
                  </button>
                </div>
              </div>
              <div id="w-v-comprador-info" class="p-12 mb-12 bg-black border border-222 rounded-sm" style="display:${data.compradorId ? 'block' : 'none'};">
                <div class="text-white text-xs font-950 uppercase" id="w-v-comprador-nombre"><strong>${data.razonSocial || ''}</strong></div>
                <div class="text-aaa text-[0.65rem] mt-4 font-800 uppercase" id="w-v-comprador-nif">NIF: ${data.nifComprador || ''}</div>
                <div class="text-info text-[0.62rem] font-900 uppercase mt-2" id="w-v-comprador-contrato"></div>
              </div>
              <div class="grid grid-cols-2 gap-15 mb-12">
                  <div class="wizard-input-group">
                    <label class="wizard-label">IVA (%)</label>
                    <input type="number" id="w-v-iva" value="${data.ivaPct}" class="wizard-input font-900">
                  </div>
                  <div class="wizard-input-group">
                    <label class="wizard-label">RETENCIÓN (%)</label>
                    <input type="number" id="w-v-ret" value="${data.retencionPct}" class="wizard-input font-900">
                  </div>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">CLASIFICACIÓN SEUROP LOTE</label>
                <input type="text" id="w-v-seurop" value="${data.seurop || ''}" placeholder="EJ: U-2, R, O..." class="wizard-input uppercase font-800">
              </div>
          </div>
        `;
        },
        onRender: async (data, area) => {
          // Refrescar lista de compradores desde la BD (por si se creó uno rápido)
          try {
            const refreshed = await window.Compradores.list({ activo: true }).catch(() => []);
            if (refreshed.length > 0) {
              data._compradores = refreshed;
              const sel = document.getElementById('w-v-comprador');
              if (sel) {
                const currentVal = sel.value;
                sel.innerHTML = `
                  <option value="">Seleccionar comprador...</option>
                  ${refreshed.map(c =>
                    `<option value="${c.id}" ${data.compradorId === c.id ? 'selected' : ''}>${c.nombre} ${c.nif_cif ? '('+c.nif_cif+')' : ''} — ${c.tipo_comprador}</option>`
                  ).join('')}
                `;
                if (currentVal) sel.value = currentVal;
              }
            }
          } catch(e) { console.warn('[WizardVenta] Error refrescando compradores:', e); }

          if (data.compradorId) {
            try {
              const c = await window.Compradores.get(data.compradorId);
              if (c) {
                const contrato = await window.Contratos.getActivo(data.compradorId, 'carne');
                const infoDiv = document.getElementById('w-v-comprador-info');
                if (infoDiv) {
                  infoDiv.style.display = 'block';
                  const estadoBadge = c.activo !== false
                    ? `<span class="text-green">${Icons.check()} Activo</span>`
                    : `<span class="text-red">${Icons.cerrar()} Inactivo</span>`;
                  document.getElementById('w-v-comprador-nombre').innerHTML = '<strong>' + c.nombre + '</strong> ' + estadoBadge;
                  document.getElementById('w-v-comprador-nif').textContent = 'NIF: ' + (c.nif_cif || '');
                  if (contrato) {
                    let contratoHtml = `${Icons.documento()} Contrato: ` + contrato.numero_contrato + ' (IVA: ' + contrato.iva_pct + '%, Ret.: ' + contrato.retencion_pct + '%)';
                    if (contrato.fecha_fin) {
                      const diasRestantes = Math.ceil((new Date(contrato.fecha_fin) - new Date()) / (1000 * 60 * 60 * 24));
                      if (diasRestantes > 0 && diasRestantes <= 30) {
                        contratoHtml += ` <span class="text-gold">${Icons.alerta()} Vence en ` + diasRestantes + 'd</span>';
                      } else if (diasRestantes <= 0) {
                        contratoHtml += ` <span class="text-red">${Icons.cerrar()} VENCIDO</span>`;
                      }
                    }
                    document.getElementById('w-v-comprador-contrato').innerHTML = contratoHtml;
                    document.getElementById('w-v-iva').value = contrato.iva_pct;
                    document.getElementById('w-v-ret').value = contrato.retencion_pct;
                  } else {
                    document.getElementById('w-v-comprador-contrato').innerHTML = `${Icons.alerta()} <span class="text-red">Sin contrato activo. Crea uno en Compradores.</span>`;
                  }
                }
              }
            } catch(e) { console.warn(e); }
          }
        },
        onChange: async (data) => {
          const sel = document.getElementById('w-v-comprador');
          if (sel) {
            data.compradorId = parseInt(sel.value) || null;
            if (data.compradorId) {
              const c = await window.Compradores.get(data.compradorId);
              if (c) {
                data.nifComprador = c.nif_cif || '';
                data.razonSocial = c.nombre || '';
                data.regaDestino = c.rega || '';
                const contrato = await window.Contratos.getActivo(data.compradorId, 'carne');
                if (contrato) {
                  data.ivaPct = contrato.iva_pct;
                  data.retencionPct = contrato.retencion_pct;
                }
              }
            } else {
              data.nifComprador = document.getElementById('w-v-nif')?.value || '';
              data.razonSocial = document.getElementById('w-v-rs')?.value || '';
            }
          } else {
            data.nifComprador = document.getElementById('w-v-nif')?.value || data.nifComprador;
            data.razonSocial = document.getElementById('w-v-rs')?.value || data.razonSocial;
          }
          data.ivaPct = parseFloat(document.getElementById('w-v-iva')?.value) || 0;
          data.retencionPct = parseFloat(document.getElementById('w-v-ret')?.value) || 0;
          data.seurop = document.getElementById('w-v-seurop')?.value || data.seurop;
        },
        validate: async (data) => {
          if (!data.compradorId) {
            App.toastError("Selecciona un comprador registrado para la venta.");
            return false;
          }
          const c = await window.Compradores.get(data.compradorId).catch(() => null);
          if (!c || c.activo === false) {
            App.toastError("El comprador seleccionado no está activo.");
            return false;
          }
          if (!c.rega) {
            App.toastError("El comprador debe tener REGA destino configurado.");
            return false;
          }
          if (!c.tipo_operador) {
            App.toastError("El comprador debe tener tipo de operador SIGGAN.");
            return false;
          }
          const tiposDestinoPermitidos = new Set(['matadero', 'operador_comercial', 'tratante', 'cebadero']);
          if (!tiposDestinoPermitidos.has((c.tipo_operador || '').toLowerCase())) {
            App.toastError("El tipo de operador del comprador no es válido para salida de animales.");
            return false;
          }
          const contrato = await window.Contratos.getActivo(data.compradorId, 'carne').catch(() => null);
          if (!contrato) {
            App.toastError("El comprador seleccionado no tiene un contrato activo para carne.");
            return false;
          }
          return true;
        }
      },
      {
        content: async (data) => {
          const transportistas = await window.Transportistas.list({ activo: true }).catch(() => []);
          data._transportistas = transportistas;
          return `
          <div class="card card-accent card-accent-purple p-16 mt-10">
              <div class="section-header-theme mb-12" style="--theme-color: var(--c-purple)">LOGÍSTICA Y AUTORIZACIÓN</div>

              <div class="wizard-input-group mb-12">
                <label class="wizard-label">TRANSPORTISTA</label>
                <div class="flex gap-8 items-center">
                  <select id="w-v-transportista" class="flex-1 wizard-input font-800" style="padding:11px;"
                    onchange="App._onTransportistaChangeWizard(this)">
                    <option value="">${transportistas.length === 0 ? 'SIN TRANSPORTISTAS ACTIVOS' : 'SELECCIONAR EMPRESA...'}</option>
                    ${transportistas.map(t =>
                      `<option value="${t.id}" ${data.transportistaId === t.id ? 'selected' : ''}>${t.nombre.toUpperCase()}</option>`
                    ).join('')}
                  </select>
                  <a href="#/transportistas" target="_blank" class="widget-link-btn widget-link-btn--neon neon-info px-12 py-6 min-h-0 h-auto">
                    <span class="text-[0.6rem] font-950 uppercase">NUEVO</span>
                  </a>
                </div>
              </div>
              <div id="w-v-transportista-info" class="p-12 mb-16 bg-black border border-222 rounded-sm" style="display:${data.transportistaId ? 'block' : 'none'};">
                <div class="text-white text-xs font-950 uppercase" id="w-v-transportista-nombre"><strong>${data.nombreTransportista || ''}</strong></div>
                <div class="text-aaa text-[0.65rem] mt-4 font-800 uppercase" id="w-v-transportista-nif">NIF: ${data.nifTransportista || ''}</div>
                <div class="text-aaa text-[0.65rem] font-800 uppercase" id="w-v-transportista-matricula">${Icons.transportistas()} ${data.matriculaTransportista || ''}</div>
              </div>

              <div class="section-header-theme mb-12" style="--theme-color: var(--c-purple)">${Icons.veterinario()} AUTORIZACIÓN VETERINARIA</div>
              <div class="grid grid-cols-2 gap-12 mb-12">
                <div class="wizard-input-group">
                  <label class="wizard-label">VETERINARIO</label>
                  <input type="text" id="w-v-vet-nombre" value="${data.vet_nombre}" class="wizard-input uppercase font-800" placeholder="NOMBRE">
                </div>
                <div class="wizard-input-group">
                  <label class="wizard-label">Nº COLEGIADO</label>
                  <input type="text" id="w-v-vet-colegiado" value="${data.vet_colegiado}" class="wizard-input font-800" placeholder="0000">
                </div>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">FECHA AUTORIZACIÓN</label>
                <input type="date" id="w-v-vet-fecha" value="${data.vet_fecha_autorizacion}" class="wizard-input font-800">
              </div>
          </div>
        `;
        },
        onRender: async (data, area) => {
          try {
            const refreshed = await window.Transportistas.list({ activo: true }).catch(() => []);
            if (refreshed.length > 0) {
              data._transportistas = refreshed;
              const sel = document.getElementById('w-v-transportista');
              if (sel) {
                const currentVal = sel.value;
                sel.innerHTML = `
                  <option value="">Seleccionar transportista...</option>
                  ${refreshed.map(t =>
                    `<option value="${t.id}" ${data.transportistaId === t.id ? 'selected' : ''}>${t.nombre} ${t.nif_cif ? '('+t.nif_cif+')' : ''} — ${t.matricula || 'sin matrícula'}</option>`
                  ).join('')}
                `;
                if (currentVal) sel.value = currentVal;
              }
            }
          } catch(e) { console.warn('[WizardVenta] Error refrescando transportistas:', e); }

          if (data.transportistaId) {
            App._showTransportistaInfo(data);
          }
        },
        onChange: async (data) => {
          const sel = document.getElementById('w-v-transportista');
          if (sel) {
            data.transportistaId = parseInt(sel.value) || null;
            if (data.transportistaId) {
              const t = await window.Transportistas.get(data.transportistaId);
              if (t) {
                data.nombreTransportista = t.nombre || '';
                data.nifTransportista = t.nif_cif || '';
                data.matriculaTransportista = t.matricula || '';
                data.atgTransportista = t.autorizacion_transporte_ganado || '';
                data.desinsectacionVencimiento = t.desinsectacion_vencimiento || '';
              }
            } else {
              data.nombreTransportista = '';
              data.nifTransportista = '';
              data.matriculaTransportista = '';
              data.atgTransportista = '';
              data.desinsectacionVencimiento = '';
            }
          }
          data.vet_nombre = document.getElementById('w-v-vet-nombre')?.value || data.vet_nombre;
          data.vet_colegiado = document.getElementById('w-v-vet-colegiado')?.value || data.vet_colegiado;
          data.vet_fecha_autorizacion = document.getElementById('w-v-vet-fecha')?.value || data.vet_fecha_autorizacion;
        },
        validate: async (data) => {
          if (!data.vet_nombre || !data.vet_colegiado) {
            App.toastError("La autorización veterinaria es obligatoria. Indica nombre y nº colegiado.");
            return false;
          }
          if (!data.transportistaId) {
            App.toastError("Selecciona un transportista para la expedición.");
            return false;
          }
          const t = await window.Transportistas.get(data.transportistaId).catch(() => null);
          if (!t?.autorizacion_transporte_ganado) {
            App.toastError("El transportista debe tener ATG (autorización de transporte ganado) para continuar.");
            return false;
          }
          if (!t?.desinsectacion_ultima_fecha) {
            App.toastError("El transportista debe registrar fecha de última desinsectación.");
            return false;
          }
          if (t?.desinsectacion_vencimiento && new Date(t.desinsectacion_vencimiento) < new Date(new Date().toISOString().split('T')[0])) {
            App.toastError("La desinsectación del transportista está vencida.");
            return false;
          }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-venta-masiva',
      title: 'VENTA MASIVA DE ANIMALES',
      steps: wizardSteps,
      initialData,
      onComplete: async (finalData) => {
        try {
          const fId = await window.Fincas.getActiveId();
          const fincaActiva = await window.Fincas.getActive().catch(() => null);
          const regaOrigenFinca = (fincaActiva?.rega || fincaActiva?.codigo_REGA || '').toString();
          const ccaaFinca = (fincaActiva?.comunidad_autonoma || '').toString();
          let contratoActivo = null;
          const compradorActual = finalData.compradorId
            ? await window.Compradores.get(finalData.compradorId).catch(() => null)
            : null;
          if (finalData.compradorId) {
            contratoActivo = await window.Contratos.getActivo(finalData.compradorId, 'carne').catch(() => null);
            if (contratoActivo) {
              finalData.ivaPct = contratoActivo.iva_pct;
              finalData.retencionPct = contratoActivo.retencion_pct;
            }
          }
          let primerAlbaran = null;
          const N = finalData.seleccionados.length;
          const year = new Date().getFullYear();

          // Obtener contador de albarán
          let contador = 0;
          try {
            const metaContador = await window.db.get('meta', 'contador_albaran');
            contador = metaContador ? (metaContador.valor || 0) : 0;
          } catch(e) { /* primera vez */ }

          for (let aId of finalData.seleccionados) {
            contador++;
            const animal = await window.Animales.get(aId);
            if (!animal) continue;
            let rebano = animal.rebanoId ? await window.Rebanos.get(animal.rebanoId) : null;
            if (!rebano) rebano = { zonaActual:'Finca', especie:'General', tipo:'Sin clasificar' };
            const pVind = N > 0 ? finalData.pVivo / N : 0;
            const pCind = N > 0 ? finalData.pCanal / N : 0;
            let rendInd = 0;
            try { rendInd = window.Trazabilidad.calcularRendimiento(pVind, pCind); } catch(e) { rendInd = 0; }

            const numeroAlbaran = `${year}-${String(contador).padStart(4, '0')}`;

            const reg = {
              animalId: aId,
              rebanoId: animal.rebanoId || null, // Vínculo al lote para el cierre de lote (ICA)
              compradorId: finalData.compradorId || null,
              contratoId: null,
              fechaSacrificio: finalData.fechaSacrificio,
              codigoMatadero: finalData.codigoMatadero,
              pesoVivo: pVind,
              pesoCanal: pCind,
              rendimientoCanal: rendInd,
              fincaId: fId,
              snap_zona: rebano.zonaActual || 'Finca',
              snap_especie: rebano.especie || 'General',
              snap_tipo: rebano.tipo || 'Sin clasificar',
              nifComprador: finalData.nifComprador,
              razonSocial: finalData.razonSocial,
              codigoDocumento_ICA: finalData.codigoICA,
              numero_Guia_Sanitaria: finalData.numeroGuia,
              estado_tramite: 'presentado',
              fecha_presentacion: finalData.fechaSacrificio || new Date().toISOString().split('T')[0],
              acuse_recibo: finalData.codigoICA || '',
              IVA: finalData.ivaPct,
              retencionREAGP: finalData.retencionPct,
              Gasto_Transporte: N > 0 ? finalData.gTrans / N : 0,
              Gasto_Matanza: N > 0 ? finalData.gMata / N : 0,
              clasificacion: { seurop: finalData.seurop },
              precioUnitario: finalData.precioUnitario || 0,
              transportistaId: finalData.transportistaId || null,
              nombreTransportista: finalData.nombreTransportista || '',
              nifTransportista: finalData.nifTransportista || '',
              matriculaTransportista: finalData.matriculaTransportista || '',
              numero_albaran: numeroAlbaran,
              autorizacion_veterinaria: {
                vet_nombre: finalData.vet_nombre || '',
                vet_colegiado: finalData.vet_colegiado || '',
                fecha_autorizacion: finalData.vet_fecha_autorizacion || ''
              }
            };
            // Asignar contrato activo si existe
            if (contratoActivo) reg.contratoId = contratoActivo.id;
            let idV;
            if (finalData.id) {
              reg.id = Number(finalData.id);
              await window.db.put("comercializacion_carne", reg);
              idV = reg.id;
            } else {
              idV = await window.db.add("comercializacion_carne", reg);
            }

            // PRIORIDAD NORMATIVA 1: cada venta debe generar su movimiento oficial
            // inter-explotación para trazabilidad legal (SIGGAN/BADIGEX).
            if (!window.Movimientos || typeof window.Movimientos.save !== 'function') {
              await window.db.delete("comercializacion_carne", idV).catch(() => {});
              throw new Error("No se pudo registrar el movimiento oficial: módulo Movimientos no disponible.");
            }
            try {
              const normalizarREGA = (v) => {
                if (!v) return '';
                if (window.ComunidadesService?.normalizarREGA) return window.ComunidadesService.normalizarREGA(v);
                return v.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
              };
              const regaDestinoNorm = normalizarREGA(finalData.regaDestino || '');
              const regaDestinoValido = /^[A-Z]{2}\d{12}$/.test(regaDestinoNorm) ? regaDestinoNorm : '';
              if (!regaDestinoValido) {
                throw new Error("El comprador seleccionado no tiene REGA destino válido.");
              }
              const fechaOperacion = finalData.fechaSacrificio || new Date().toISOString().split('T')[0];
              const desinsectacionValida = !finalData.desinsectacionVencimiento || new Date(finalData.desinsectacionVencimiento) >= new Date(fechaOperacion);

              const movimientoId = await window.Movimientos.save({
                fincaId: fId,
                tipo: 'salida',
                numero_guia: finalData.numeroGuia || '',
                rega_origen: normalizarREGA(regaOrigenFinca),
                rega_destino: regaDestinoValido,
                tipo_operador_destino: compradorActual?.tipo_operador || '',
                explotacion_contraparte: finalData.razonSocial || finalData.codigoMatadero || 'Destino matadero',
                motivo: 'matadero',
                especie: animal.especie || rebano.especie || '',
                num_animales: 1,
                animalId: [aId],
                crotales: animal.numero_identificacion ? [animal.numero_identificacion] : [],
                transportistaId: finalData.transportistaId || null,
                transportista_nombre: finalData.nombreTransportista || '',
                matricula: finalData.matriculaTransportista || '',
                fecha: fechaOperacion,
                desinsectacion_certificada: desinsectacionValida,
                comunidad_autonoma: ccaaFinca,
                estado_tramite: 'presentado',
                fecha_presentacion: fechaOperacion,
                numero_registro_oficial: finalData.numeroGuia || '',
                acuse_recibo: finalData.codigoICA || '',
                notas: `Venta comercial ${numeroAlbaran} · DIMOE DIMOE-${numeroAlbaran}`
              });

              reg.movimientoId = movimientoId;
              await window.db.put("comercializacion_carne", { ...reg, id: idV, actualizadoEn: new Date().toISOString() });
            } catch (movErr) {
              await window.db.delete("comercializacion_carne", idV).catch(() => {});
              throw new Error("No se pudo registrar el movimiento oficial de salida: " + (movErr?.message || movErr));
            }

            const est = await window.Trazabilidad.generarEstructuraAlbaran(
              window.db,
              { ...reg, id: idV },
              "carne"
            );
            if (!primerAlbaran) primerAlbaran = est;

            // POST-VENTA: Cambiar estado a "vendido"
            animal.estado = "vendido";
            await window.Animales.save(animal);

            // POST-VENTA: Registrar evento de expedición en registro_eventos
            try {
              if (window.EventBus) {
                window.EventBus.emit('animal:updated', { id: animal.id, estado: 'vendido' });
              }
              await window.db.add('registro_eventos', {
                fincaId: fId,
                entidad_id: aId,
                tipo_entidad: 'animal',
                motivo_tarea: 'expedicion',
                fecha: finalData.fechaSacrificio || new Date().toISOString().split('T')[0],
                valor_neto: pCind,
                unidad: 'kg',
                snap_zona: rebano.zonaActual || 'Finca',
                snap_especie: rebano.especie || 'General',
                snap_tipo: rebano.tipo || 'Sin clasificar',
                observaciones: `Venta a ${finalData.razonSocial || 'comprador'} | Albarán: ${numeroAlbaran} | Transportista: ${finalData.nombreTransportista || 'N/D'}`,
                creadoEn: new Date().toISOString()
              });
            } catch(e) { console.warn('[Venta] Error registro evento:', e); }

            // POST-VENTA: Generar DIMOE como documento legal
            try {
              const finca = await window.db.get('fincas', Number(fId));
              const dimoe = {
                tipo: 'dimoe',
                ventaId: idV,
                animalId: aId,
                fincaId: fId,
                numero: `DIMOE-${numeroAlbaran}`,
                fecha_emision: finalData.fechaSacrificio || new Date().toISOString().split('T')[0],
                origen_rega: finca?.codigo_REGA || finca?.rega || '',
                origen_nombre: finca?.nombre || '',
                destino: finalData.codigoMatadero || '',
                destino_nombre: finalData.razonSocial || '',
                motivo: 'sacrificio',
                transportista_nombre: finalData.nombreTransportista || '',
                transportista_nif: finalData.nifTransportista || '',
                transportista_matricula: finalData.matriculaTransportista || '',
                created_at: new Date().toISOString()
              };
              await window.db.add('documentos_legales', dimoe).catch(() => {});
            } catch(e) { console.warn('[Venta] Error generando DIMOE:', e); }
          }

          // Guardar contador de albarán actualizado
          try {
            await window.db.put('meta', { key: 'contador_albaran', valor: contador, actualizadoEn: new Date().toISOString() });
          } catch(e) { /* ignore */ }

          App.toast(`Lote de ${N} ${N === 1 ? 'animal procesado' : 'animales procesados'} con éxito.`);

          // Mostrar albarán
          let facturaGenerada = false;
          if (primerAlbaran) {
            await App.imprimirAlbaran(primerAlbaran, "carne");
          }

          // Generar Factura si hay datos económicos
          try {
            if (primerAlbaran && window.Liquidacion && window.PdfService) {
              // El wizard no recoge precio unitario en ningún paso: no inventar precio.
              // Si no hay precio real, se factura a 0 con nota "(precio pendiente de fijar)".
              const precioEstimado = finalData.precioUnitario || 0;
              const gastosTotal = (finalData.gTrans || 0) + (finalData.gMata || 0);
              const liq = window.Liquidacion.calcular({
                pesoCanal: finalData.pCanal || 0,
                precioUnitario: precioEstimado,
                gastos: gastosTotal,
                ivaPct: finalData.ivaPct || 10,
                retencionPct: finalData.retencionPct || 0
              });
              if (!finalData.precioUnitario && liq && Array.isArray(liq.desglose)) {
                liq.desglose.unshift({ concepto: 'Precio unitario (precio pendiente de fijar)', cantidad: 0 });
              }
              let facturaContador = 0;
              try {
                const metaFact = await window.db.get('meta', 'contador_factura');
                facturaContador = metaFact ? (metaFact.valor || 0) : 0;
              } catch(e) {}
              facturaContador++;
              const year = new Date().getFullYear();
              const numeroFactura = `F-${year}-${String(facturaContador).padStart(4, '0')}`;
              await window.db.put('meta', { key: 'contador_factura', valor: facturaContador, actualizadoEn: new Date().toISOString() }).catch(() => {});
              await App.imprimirFactura(primerAlbaran, liq, numeroFactura);
              facturaGenerada = true;
            }
          } catch(e) { console.warn('[Venta] Error generando factura:', e); }

          App.renderComercializacion(new URLSearchParams("tab=carne"));
        } catch (e) {
          App.toastError(e.message);
        }
      },
    });
  }
};
