// Escala de Condición Corporal (BCS) 1-9, estándar veterinario internacional de
// nutrición bovina. No es un requisito SIGGAN, es un dato de manejo opcional —
// ver docs/AUDITAR/AUDITORIA-BASEDEDATOS-LEGACY.md.
const BCS_ESCALA = {
    1: 'Flaco', 2: 'Muy Delgado', 3: 'Delgado', 4: 'Regular', 5: 'Moderado',
    6: 'Bueno', 7: 'Muy Bueno', 8: 'Gordo', 9: 'Muy Gordo',
};

const PesajesUI = {
    async abrirWizard(config) {
        const modoStr = config.modo || config.motivo || '';
        const esModoLeche = modoStr.startsWith('leche_');

        if (modoStr === 'leche_tanque') {
            window._pesajesWizardActivo = false;
            const overlay = document.getElementById('wizard-pesaje-overlay');
            if (overlay) overlay.remove();
            if (window.App && window.App._abrirWizardAlbaranLeche) {
                window.App._abrirWizardAlbaranLeche();
            } else {
                window.App.toastError("Error: Wizard de leche no disponible");
            }
            return;
        }

        const { motivo, rebanoId, animalId, esAltaNueva } = config;

        let titulo = "Gestor de Pesajes";
        let subtitulo = "";
        let entidades = [];
        let rebano = null;
        let rebanosCompatibles = [];

        if (rebanoId) {
            rebano = await Rebanos.get(rebanoId);
            entidades = await Animales.list(rebanoId);
            if (esModoLeche) {
                entidades = entidades.filter(a => ['h','hembra'].includes((a.sexo||'').toLowerCase()) && ['Vacas','Ovejas','Cabras'].includes(a.especie));
                titulo = `CONTROL LECHERO LOTE`;
                subtitulo = `${rebano.nombre} | ${rebano.especie} (${rebano.tipo})`;
            } else {
                titulo = motivo === 'expedicion' ? `EXPEDICIÓN LOTE` : `PESAJE DE LOTE`;
                subtitulo = `${rebano.nombre} | ${rebano.especie} (${rebano.tipo})`;
            }
        } else if (animalId) {
            const animal = await Animales.get(animalId);
            entidades = [animal];
            if (esModoLeche) {
                titulo = `CONTROL LECHERO INDIVIDUAL`;
                subtitulo = animal.numero_identificacion;
                if (!['h','hembra'].includes((animal.sexo||'').toLowerCase()) || !['Vacas','Ovejas','Cabras'].includes(animal.especie)) {
                    window.App.toastError("El animal seleccionado no es una hembra lechera");
                    return;
                }
            } else {
                titulo = esAltaNueva ? `PESAJE INICIAL (ALTA)` : `PESAJE INDIVIDUAL`;
                subtitulo = animal.numero_identificacion;
            }

            if (esAltaNueva || !animal.rebanoId) {
                const todosRebanos = await Rebanos.list();
                rebanosCompatibles = todosRebanos.filter(r => r.especie === animal.especie);
            } else {
                rebano = await Rebanos.get(animal.rebanoId);
            }
        }

        if (esModoLeche && entidades.length === 0) {
            window.App.toastError("No hay hembras lecheras en este rebaño");
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = "wizard-pesaje-overlay";
        overlay.className = "wizard-full-screen " + (esModoLeche ? 'pesaje-mode-leche' : 'pesaje-mode-carne');

        const _pesajesLote = [];
        const esModoLote = entidades.length > 1;

        const unidadLabel = esModoLeche ? "VOLUMEN (L)" : "PESO (kg)";
        const unidadAbreviada = esModoLeche ? "L" : "kg";

        const renderWizard = async () => {
            window._pesajesWizardActivo = true;
            const isLogistico = (motivo === 'expedicion' || motivo === 'entrada') && !esModoLeche;
            let necesitaAsignacion = (esAltaNueva || (animalId && !rebano)) && !esModoLeche;

            const activeFincaId = await Fincas.getActiveId();
            const today = new Date().toISOString().split('T')[0];
            const histLecheCompleto = esModoLeche ? await Produccion.listLeche(activeFincaId) : [];

            for (let a of entidades) {
                a.pesoActual = '';
                a.pesajeId = undefined;

                if (esModoLeche) {
                    try {
                        const regs = histLecheCompleto.filter(h => Number(h.vacaId) === Number(a.id));
                        const regsAnteriores = regs.filter(h => h.fecha !== today);
                        a.pesoAnterior = regsAnteriores.length > 0 
                            ? regsAnteriores.sort((x,y) => new Date(y.fecha)-new Date(x.fecha))[0].cantidad_litros + 'L' 
                            : '--';

                        const regsHoy = regs.filter(h => h.fecha === today);
                        if (regsHoy.length > 0) {
                            const lReg = regsHoy.sort((x, y) => new Date(y.actualizadoEn || y.creadoEn) - new Date(x.actualizadoEn || x.creadoEn))[0];
                            a.pesoActual = lReg.cantidad_litros;
                            a.produccionLecheId = lReg.id;
                            a.grasaActual = lReg.analisis_grasa_proteina?.grasa;
                            a.proteinaActual = lReg.analisis_grasa_proteina?.proteina;
                            a.creadoEnLeche = lReg.creadoEn;
                        } else {
                            a.produccionLecheId = undefined;
                            a.grasaActual = undefined;
                            a.proteinaActual = undefined;
                            a.creadoEnLeche = undefined;
                        }

                        const histPesajes = await Pesajes.obtenerHistorial(a.id, 'animal');
                        const pRegsHoy = histPesajes.filter(h => h.fecha === today && h.motivo_tarea === 'control_lechero');
                        if (pRegsHoy.length > 0) {
                            a.pesajeId = pRegsHoy[0].id;
                        }
                    } catch(e) { 
                        console.error(e);
                        a.pesoAnterior = '--'; 
                    }
                } else {
                    try {
                        const hist = await Pesajes.obtenerHistorial(a.id, 'animal');
                        const kgHist = hist.filter(h => h.unidad === 'kg' && h.motivo_tarea === (motivo || 'control') && h.fecha !== today);
                        a.pesoAnterior = kgHist.length > 0 ? kgHist[0].valor_neto + 'kg' : '--';

                        const pRegsHoy = hist.filter(h => h.fecha === today && h.motivo_tarea === (motivo || 'control'));
                        if (pRegsHoy.length > 0) {
                            a.pesoActual = pRegsHoy[0].valor_neto;
                            a.pesajeId = pRegsHoy[0].id;
                        }
                    } catch(e) {
                        console.error(e);
                        a.pesoAnterior = '--';
                    }
                }
            }

            if (esModoLote && !esModoLeche) {
                for (let a of entidades) {
                    if (a.pesoActual) {
                        _pesajesLote.push({
                            id: a.pesajeId || undefined,
                            animalId: a.id,
                            crotal: a.numero_identificacion,
                            peso: a.pesoActual,
                            especie: a.especie,
                            raza: a.raza
                        });
                    }
                }
            }

            let currentAnimalIndex = 0;

            overlay.innerHTML = `
            <div class="wizard-header-fixed text-center pesaje-header-fixed">
                <button class="btn-pesaje-close">${Icons.cerrar()}</button>
                <h2 class="pesaje-titulo-h2 uppercase font-950 tracking-widest">${esModoLeche ? Icons.leche() : Icons.balanza()} ${titulo}</h2>
                <p class="text-gray-400 text-xs m-0 font-900 uppercase tracking-tight">${subtitulo}</p>
            </div>

            <div class="wizard-content-scrollable">
                <div class="flex flex-col gap-15">
                    ${necesitaAsignacion ? `
                    <div class="card card-accent card-accent-gold p-16" id="box-assign-rebano">
                        <label class="text-xs text-warning uppercase font-extrabold tracking-wider d-block mb-12">${Icons.rebanos()} ASIGNAR REBAÑO (OBLIGATORIO)</label>
                        <select id="w-assign-rebano" class="wizard-input text-lg font-900 uppercase">
                            <option value="">-- SELECCIONAR LOTE DESTINO --</option>
                            ${rebanosCompatibles.map(r => `<option value="${r.id}">${r.nombre.toUpperCase()} | ${r.zonaActual?.toUpperCase() || 'GENERAL'}</option>`).join('')}
                        </select>
                    </div>
                    ` : `
                    <div class="bg-black border border-222 p-12 rounded-sm grid grid-cols-2 gap-10">
                        <div><span class="text-xs text-gray uppercase font-extrabold tracking-wider">${Icons.zonas()} ZONA ACTUAL</span><br><span class="text-white font-950 text-xs uppercase">${rebano ? (rebano.zonaActual?.toUpperCase() || 'FINCA GENERAL') : 'FINCA GENERAL'}</span></div>
                        <div><span class="text-xs text-gray uppercase font-extrabold tracking-wider">${Icons.info()} TIPO LOTE</span><br><span class="text-white font-950 text-xs uppercase">${rebano ? rebano.tipo?.toUpperCase() : 'SIN CLASIFICAR'}</span></div>
                    </div>
                    `}

                    <div class="card card-accent p-16 pesaje-card-accent">
                         <div class="text-xs text-gray uppercase font-extrabold tracking-wider mb-15 opacity-80 text-center">${esModoLeche ? 'Vaca a Registrar' : 'Animal a Pesar'}</div>
                         <div id="w-current-crotal" class="pesaje-crotal font-black">--</div>
                         <div id="w-current-desc" class="text-xs text-aaa mt-4 leading-relaxed text-center">--</div>

                         <div class="mt-20 pesaje-input-wrapper">
                             <input type="number" id="w-peso-gigante" step="0.1" inputmode="decimal" placeholder="0.0"
                                    class="pesaje-peso-input font-black">
                             <div class="pesaje-unidad-label font-950 uppercase tracking-widest">${unidadLabel}</div>
                         </div>

                         ${esModoLeche ? `
                         <div class="pesaje-leche-grid">
                             <div>
                                 <label class="text-xs text-gray uppercase font-extrabold tracking-wider mb-6 d-block">TURNO</label>
                                 <div class="flex space-x-4">
                                     <label class="flex items-center">
                                         <input type="radio" name="turno" value="AM" class="form-radio" checked>
                                         <span class="ml-2">AM</span>
                                     </label>
                                     <label class="flex items-center">
                                         <input type="radio" name="turno" value="PM" class="form-radio">
                                         <span class="ml-2">PM</span>
                                     </label>
                                 </div>
                             </div>
                             <div>
                                 <label class="text-xs text-gray uppercase font-extrabold tracking-wider mb-6 d-block">GRASA (%)</label>
                                 <input type="number" id="w-leche-grasa" step="0.01" placeholder="0.00" class="wizard-input font-900 text-lg">
                             </div>
                             <div>
                                 <label class="text-xs text-gray uppercase font-extrabold tracking-wider mb-6 d-block">PROTEÍNA (%)</label>
                                 <input type="number" id="w-leche-proteina" step="0.01" placeholder="0.00" class="wizard-input font-900 text-lg">
                             </div>
                         </div>
                         ` : `
                         <div class="mt-15">
                             <label class="text-xs text-gray uppercase font-extrabold tracking-wider mb-6 d-block">CONDICIÓN CORPORAL (OPC.)</label>
                             <select id="w-bcs" class="wizard-input font-900">
                                 <option value="">— SIN VALORAR —</option>
                                 ${[1,2,3,4,5,6,7,8,9].map(n => `<option value="${n}">${n} — ${BCS_ESCALA[n]}</option>`).join('')}
                             </select>
                         </div>
                         `}

                         <div class="mt-20">
                             <button id="btn-guardar-peso" class="widget-link-btn widget-link-btn--neon ${esModoLeche ? 'neon-warning' : 'neon-success'} w-full">
                                ${Icons.guardar()}
                                <span class="widget-link-label font-950 uppercase">${esModoLeche ? 'GUARDAR REGISTRO' : 'GUARDAR PESADA'}</span>
                             </button>
                         </div>
                    </div>

                    ${isLogistico ? `
                    <div class="card card-accent card-accent-blue p-16 border-222 bg-black">
                        <div class="section-header-theme mb-12">${Icons.transportistas()} LOGÍSTICA / BÁSCULA</div>
                        <div class="pesaje-logis-grid mb-12">
                            <div><label class="text-xs text-gray uppercase font-extrabold tracking-wider mb-6 d-block">BRUTO (kg)</label>
                            <input type="number" id="w-bruto" class="wizard-input h-50 text-xl font-950 text-white"></div>
                            <div><label class="text-xs text-gray uppercase font-extrabold tracking-wider mb-6 d-block">TARA (kg)</label>
                            <input type="number" id="w-tara" class="wizard-input h-50 text-xl font-950 text-white"></div>
                        </div>
                        <div class="pesaje-logis-grid-2 items-end">
                            <div><label class="text-xs text-gray uppercase font-extrabold tracking-wider mb-6 d-block">MATRÍCULA</label>
                            <input type="text" id="w-matricula" class="wizard-input h-45 uppercase font-950"></div>
                            <div class="bg-black border border-222 p-10 rounded-sm text-right flex flex-col justify-center">
                                <span class="text-xs text-gray uppercase font-extrabold block mb-2 tracking-wider">NETO REAL:</span>
                                <span id="w-neto-display" class="text-success pesaje-neto-val tracking-tighter">0 kg</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <div class="pesaje-lista-box border-222 bg-black">
                        <div class="bg-black pesaje-lista-header border-bottom-222">
                            <span class="text-xs text-gray uppercase font-extrabold tracking-wider">ANIMAL / LOTE</span>
                            <span class="text-xs text-gray uppercase font-extrabold tracking-wider text-right">HISTÓRICO</span>
                            <span class="text-xs text-gray uppercase font-extrabold tracking-wider text-right">ACTUAL</span>
                        </div>
                        <div id="w-table-body" class="pesaje-table-body"></div>
                    </div>

                    ${motivo === 'expedicion' && !esModoLeche ? `
                    <div class="card card-accent card-accent-green p-16 border-222 bg-black">
                        <div class="section-header-theme mb-12" style="--theme-color: var(--c-success);">${Icons.dinero()} LIQUIDACIÓN MATADERO / VENTA</div>
                        <div class="grid grid-cols-2 gap-10 mb-12">
                            <div class="wizard-input-group">
                                <label class="text-xs text-gray uppercase font-extrabold tracking-wider mb-6 d-block">PRECIO (€/kg CANAL)</label>
                                <input type="number" id="w-precio" value="5.50" step="0.01" class="wizard-input h-50 text-xl font-950 text-white border-green">
                            </div>
                            <div class="wizard-input-group">
                                <label class="text-xs text-gray uppercase font-extrabold tracking-wider mb-6 d-block">PESO CANAL (kg)</label>
                                <input type="number" id="w-peso-canal" placeholder="OPCIONAL..." step="0.1" class="wizard-input h-50 text-xl font-950 text-white">
                            </div>
                        </div>
                        <div class="wizard-input-group">
                            <label class="text-xs text-gray uppercase font-extrabold tracking-wider mb-6 d-block">Nº ALBARÁN / REF. FACTURA</label>
                            <input type="text" id="w-documento-ref" placeholder="Ej: FAC-2026-004..." class="wizard-input h-45 uppercase font-900">
                        </div>
                    </div>
                    ` : ''}

                    <div class="pesaje-fecha-box">
                        <label class="text-xs text-gray uppercase font-extrabold tracking-wider d-block mb-8 ml-4">${esModoLeche ? 'FECHA DEL CONTROL' : 'FECHA DE LA PESADA'}</label>
                        <input type="date" id="w-fecha" value="${new Date().toISOString().split('T')[0]}" class="wizard-input h-45 font-900 uppercase">
                    </div>
                </div>
            </div>

            <div class="wizard-footer-fixed flex gap-10">
                <button class="widget-link-btn widget-link-btn--neon neon-success flex-1" id="btn-wizard-finish">
                    ${Icons.check()}
                    <span class="widget-link-label font-950 uppercase tracking-wider">${esModoLeche ? 'FINALIZAR CONTROL' : 'FINALIZAR PESADAS'}</span>
                </button>
            </div>
            `;

            const renderTable = () => {
                const tbody = overlay.querySelector('#w-table-body');
                if (!tbody) return;
                tbody.innerHTML = entidades.map((a, idx) => {
                    const isActive = idx === currentAnimalIndex;
                    return `
                    <div class="batch-item ${isActive ? 'batch-item--active' : ''}" data-index="${idx}">
                        <div>
                            <div class="batch-item-crotal ${isActive ? '' : 'text-white'}">${a.numero_identificacion}</div>
                            <div class="text-gray-500 uppercase font-800 batch-item-muted">${a.raza || a.especie}</div>
                        </div>
                        <div class="text-gray-600 uppercase font-900 batch-item-anterior">${a.pesoAnterior}</div>
                        <div class="batch-item-actual ${a.pesoActual ? 'batch-item-val--set' : 'batch-item-val--empty'}">${a.pesoActual ? a.pesoActual + unidadAbreviada : '--'}</div>
                    </div>
                    `;
                }).join('');
                tbody.querySelectorAll('.batch-item').forEach(item => {
                    item.onclick = () => selectAnimal(parseInt(item.dataset.index));
                });
            };

            const selectAnimal = (index) => {
                currentAnimalIndex = index;
                const a = entidades[index];
                const crotalDisplay = overlay.querySelector('#w-current-crotal');
                const descDisplay = overlay.querySelector('#w-current-desc');
                if (crotalDisplay) crotalDisplay.textContent = a.numero_identificacion;
                if (descDisplay) descDisplay.textContent = `${a.raza || ''} · ${a.especie || ''}`;
                
                const input = overlay.querySelector('#w-peso-gigante');
                if (input) { 
                    input.value = a.pesoActual || ''; 
                    input.focus(); 
                    if (typeof input.select === 'function') input.select();
                }

                // Recuperar o limpiar inputs de grasa y proteína para el animal seleccionado
                if (esModoLeche) {
                    const grasaIn = overlay.querySelector('#w-leche-grasa');
                    const proteinaIn = overlay.querySelector('#w-leche-proteina');
                    if (grasaIn) grasaIn.value = (a.grasaActual !== undefined && a.grasaActual !== null) ? a.grasaActual : '';
                    if (proteinaIn) proteinaIn.value = (a.proteinaActual !== undefined && a.proteinaActual !== null) ? a.proteinaActual : '';
                } else {
                    const bcsIn = overlay.querySelector('#w-bcs');
                    if (bcsIn) bcsIn.value = (a.condicionCorporalActual !== undefined && a.condicionCorporalActual !== null) ? a.condicionCorporalActual : '';
                }

                renderTable();
            };

            const closeWizard = () => {
                window._pesajesWizardActivo = false;
                overlay.remove();
                if (window.App) window.App.route();
            };

            const closeBtn = overlay.querySelector('.btn-pesaje-close');
            if (closeBtn) closeBtn.onclick = closeWizard;

            selectAnimal(0);
            setTimeout(() => { const i = overlay.querySelector('#w-peso-gigante'); if(i){ i.focus(); setTimeout(()=>i.focus(), 300); } }, 500);

            if (isLogistico) {
                const bIn = overlay.querySelector('#w-bruto');
                const tIn = overlay.querySelector('#w-tara');
                const nDisp = overlay.querySelector('#w-neto-display');
                const updateNeto = () => {
                    const neto = Math.max(0, (parseFloat(bIn.value) || 0) - (parseFloat(tIn.value) || 0));
                    nDisp.textContent = neto.toLocaleString() + " kg";
                };
                bIn.oninput = updateNeto; tIn.oninput = updateNeto;
            }

            overlay.querySelector('#btn-guardar-peso').onclick = async () => {
                const input = overlay.querySelector('#w-peso-gigante');
                const val = parseFloat(input.value);
                if (isNaN(val) || val <= 0) { App.toastError(esModoLeche ? "Introduce volumen válido" : "Introduce peso válido"); return; }
                
                // Validar bruto/tara de logística si están activos
                if (isLogistico) {
                    const brutoVal = parseFloat(overlay.querySelector('#w-bruto')?.value || 0);
                    const taraVal = parseFloat(overlay.querySelector('#w-tara')?.value || 0);
                    if (brutoVal > 0 && taraVal > 0 && brutoVal < taraVal) {
                        App.toastError("El peso bruto no puede ser menor que la tara");
                        return;
                    }
                }

                try {
                    const a = entidades[currentAnimalIndex];
                    const fecha = overlay.querySelector('#w-fecha')?.value || new Date().toISOString().split('T')[0];
                    const activeFincaId = await Fincas.getActiveId();

                    if (esModoLeche) {
                        // Validar porcentaje de grasa y proteína
                        const grasaInput = overlay.querySelector('#w-leche-grasa')?.value;
                        const proteinaInput = overlay.querySelector('#w-leche-proteina')?.value;
                        let grasa = null;
                        let proteina = null;
                        if (grasaInput !== undefined && grasaInput !== '') {
                            grasa = parseFloat(grasaInput);
                            if (isNaN(grasa) || grasa < 0 || grasa > 100) {
                                App.toastError("Introduce un porcentaje de grasa válido (0-100)");
                                return;
                            }
                        }
                        if (proteinaInput !== undefined && proteinaInput !== '') {
                            proteina = parseFloat(proteinaInput);
                            if (isNaN(proteina) || proteina < 0 || proteina > 100) {
                                App.toastError("Introduce un porcentaje de proteína válido (0-100)");
                                return;
                            }
                        }

                        // Get turno value
                        const turnoInput = overlay.querySelector('input[name="turno"]:checked');
                        const turno = turnoInput ? turnoInput.value : 'AM';

                        const pLecheId = await Produccion.saveLeche({
                            id: a.produccionLecheId || undefined,
                            vacaId: a.id,
                            fecha,
                            cantidad_litros: val,
                            analisis_grasa_proteina: { grasa, proteina },
                            creadoEn: a.creadoEnLeche || new Date().toISOString(),
                            turno: turno
                        }, activeFincaId);
                        a.produccionLecheId = pLecheId;
                        if (!a.creadoEnLeche) a.creadoEnLeche = new Date().toISOString();

                        const pesId = await Pesajes.registrar({
                            id: a.pesajeId || undefined,
                            entidad_id: a.id,
                            tipo_entidad: 'animal',
                            motivo_tarea: 'control_lechero',
                            fecha,
                            valor_neto: val,
                            unidad: 'L',
                            calidad: (grasa || proteina) ? { grasa, proteina } : null,
                            rol_contable: 'INVENTARIO',
                            snap_identificacion: a.numero_identificacion || 'S/N'
                        });
                        a.pesajeId = pesId;
                        a.grasaActual = grasa;
                        a.proteinaActual = proteina;
                    } else {
                        const bcsVal = overlay.querySelector('#w-bcs')?.value || '';
                        const payload = {
                            id: a.pesajeId || undefined,
                            entidad_id: a.id, tipo_entidad: 'animal', motivo_tarea: motivo || 'control', fecha, valor_neto: val,
                            precio_unitario: (motivo === 'expedicion') ? parseFloat(overlay.querySelector('#w-precio')?.value || 0) : 0,
                            valor_canal: (motivo === 'expedicion') ? parseFloat(overlay.querySelector('#w-peso-canal')?.value || 0) : 0,
                            documento_ref: (motivo === 'expedicion') ? (overlay.querySelector('#w-documento-ref')?.value.trim() || '') : '',
                            matricula: isLogistico ? overlay.querySelector('#w-matricula')?.value.toUpperCase() : '',
                            peso_bruto: isLogistico ? parseFloat(overlay.querySelector('#w-bruto')?.value || 0) : 0,
                            tara: isLogistico ? parseFloat(overlay.querySelector('#w-tara')?.value || 0) : 0,
                            rol_contable: motivo === 'expedicion' ? 'VENTA' : 'INVENTARIO',
                            condicion_corporal: bcsVal,
                            snap_identificacion: a.numero_identificacion || 'S/N'
                        };
                        if (esModoLote) {
                            const existingIdx = _pesajesLote.findIndex(p => p.animalId === a.id);
                            if (existingIdx !== -1) {
                                _pesajesLote[existingIdx].peso = val;
                                _pesajesLote[existingIdx].condicion_corporal = bcsVal;
                            } else {
                                _pesajesLote.push({
                                    id: a.pesajeId || undefined,
                                    animalId: a.id,
                                    crotal: a.numero_identificacion,
                                    peso: val,
                                    condicion_corporal: bcsVal,
                                    especie: a.especie,
                                    raza: a.raza
                                });
                            }
                        } else {
                            const pesId = await Pesajes.registrar(payload);
                            a.pesajeId = pesId;
                        }
                        a.condicionCorporalActual = bcsVal;
                    }
                    a.pesoActual = val;
                    App.toast(`REGISTRADO: ${a.numero_identificacion} -> ${val}${unidadAbreviada}`);
                    if (entidades.length > 1 && currentAnimalIndex < entidades.length - 1) selectAnimal(currentAnimalIndex + 1);
                    else { input.value = ''; renderTable(); }
                } catch (e) { App.toastError("Error: " + e.message); }
            };

            // Transición interactiva de focos con tecla Enter para agilidad continua
            const inputPeso = overlay.querySelector('#w-peso-gigante');
            if (inputPeso) {
                inputPeso.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (esModoLeche) {
                            const grasaInput = overlay.querySelector('#w-leche-grasa');
                            if (grasaInput) {
                                grasaInput.focus();
                                if (typeof grasaInput.select === 'function') grasaInput.select();
                            } else {
                                overlay.querySelector('#btn-guardar-peso').click();
                            }
                        } else {
                            overlay.querySelector('#btn-guardar-peso').click();
                        }
                    }
                });
            }

            if (esModoLeche) {
                const grasaIn = overlay.querySelector('#w-leche-grasa');
                const proteinaIn = overlay.querySelector('#w-leche-proteina');
                if (grasaIn) {
                    grasaIn.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (proteinaIn) {
                                proteinaIn.focus();
                                if (typeof proteinaIn.select === 'function') proteinaIn.select();
                            } else {
                                overlay.querySelector('#btn-guardar-peso').click();
                            }
                        }
                    });
                }
                if (proteinaIn) {
                    proteinaIn.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            overlay.querySelector('#btn-guardar-peso').click();
                        }
                    });
                }
            }

            overlay.querySelector('#btn-wizard-finish').onclick = async () => {
                window._pesajesWizardActivo = false;
                try {
                    if (esModoLote && !esModoLeche && _pesajesLote.length > 0) {
                        const fecha = overlay.querySelector('#w-fecha')?.value;
                        const precio = parseFloat(overlay.querySelector('#w-precio')?.value || 0);
                        const canal = (motivo === 'expedicion') ? parseFloat(overlay.querySelector('#w-peso-canal')?.value || 0) : 0;
                        const docRef = (motivo === 'expedicion') ? (overlay.querySelector('#w-documento-ref')?.value.trim() || '') : '';
                        const matricula = overlay.querySelector('#w-matricula')?.value || '';
                        const bruto = isLogistico ? parseFloat(overlay.querySelector('#w-bruto')?.value || 0) : 0;
                        const tara = isLogistico ? parseFloat(overlay.querySelector('#w-tara')?.value || 0) : 0;
                        const reb = await Rebanos.get(rebanoId);
                        for (const p of _pesajesLote) {
                            await Pesajes.registrar({
                                id: p.id || undefined,
                                entidad_id: p.animalId, tipo_entidad: 'animal', motivo_tarea: motivo || 'control', fecha, valor_neto: p.peso,
                                precio_unitario: precio, valor_canal: canal, documento_ref: docRef, matricula: matricula, peso_bruto: bruto, tara: tara, rol_contable: motivo === 'expedicion' ? 'VENTA' : 'INVENTARIO',
                                condicion_corporal: p.condicion_corporal,
                                snap_identificacion: p.crotal, snap_zona: reb?.zonaActual, snap_especie: reb?.especie, snap_tipo: reb?.tipo
                            });
                        }
                    }
                    overlay.remove();
                    await window.App.route();
                } catch (e) { App.toastError("Error al finalizar: " + e.message); }
            };
        };

        await renderWizard();
        document.body.appendChild(overlay);
    }
};

window.PesajesUI = PesajesUI;
