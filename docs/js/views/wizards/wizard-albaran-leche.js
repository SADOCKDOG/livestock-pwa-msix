/**
 * Wizard Albarán de Leche (Salida Láctea)
 * Extraído de app.js para modularización (Fase 3)
 */
window.AlbaranLecheWizard = {
  async open(borrador = null) {
    const App = window.App;
    if (!App) return console.error("App no disponible");

    const finca = await window.Fincas.getActive();
    const fincaId = await window.Fincas.getActiveId();
    const opcionesCCAA = window.ComunidadesService
      ? window.ComunidadesService.getOpcionesComunidad()
      : [{ value: 'andalucia', label: 'Andalucía' }, { value: 'extremadura', label: 'Extremadura' }];
    const refPrecios = window.ComunidadesService
      ? window.ComunidadesService.PRECIO_EXTRACTO_SECO_REF
      : { precio_base_referencia: 0.45, precio_por_punto_extracto: 0.045, tasa_INLAC_defecto: 0.0012 };

    const tanquesActivos = window.TanquesLeche ? await window.TanquesLeche.getActivos(fincaId) : [];
    const compradoresLacteos = window.Compradores ? (await window.Compradores.list({ tipo: 'láctico' })).filter(c => c.activo !== false) : [];
    const laboratorios = window.ComunidadesService ? window.ComunidadesService.getLaboratoriosLeche() : [];

    // Definición de funciones de cálculo en el ámbito global del App para los onchange/oninput
    App._recalcularPrecioLeche = function() {
      const pbInput = document.getElementById('w-l-pb');
      const pexInput = document.getElementById('w-l-pex');
      const primInput = document.getElementById('w-l-prim');
      const cantInput = document.getElementById('w-l-cant') || document.getElementById('w-l-cant-oculto');
      
      const grasaInput = document.getElementById('w-l-grasa');
      const protInput = document.getElementById('w-l-prot');
      const es = (parseFloat(grasaInput?.value) || 0) + (parseFloat(protInput?.value) || 0);

      const precioDisplay = document.getElementById('w-l-precio-final-display');
      const importeDisplay = document.getElementById('w-l-importe-display');

      if (!pbInput || !precioDisplay || !importeDisplay) return;

      const pb = parseFloat(pbInput.value) || 0;
      const pex = pexInput ? parseFloat(pexInput.value) || 0 : refPrecios.precio_por_punto_extracto;
      const prim = primInput ? parseFloat(primInput.value) || 0 : 0;
      const cant = cantInput ? parseFloat(cantInput.value) || 0 : 0;
      const tasa = refPrecios.tasa_INLAC_defecto;

      const precioFinal = parseFloat((pb + (es * pex) - tasa + prim).toFixed(4));
      const importeTotal = parseFloat((cant * precioFinal).toFixed(2));

      precioDisplay.textContent = precioFinal.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' €/L';
      importeDisplay.textContent = importeTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    };

    App._recalcularMOFA = function() {
      // Simplificado, ya no se usa MOFA en el UI del wizard, pero lo dejamos vacio para no romper si algo llama
    };

    const wizardSteps = [
      {
        content: async (data) => {
          const contratos = await window.db.getAll('contratos_compra').catch(() => []);
          const contratosLeche = contratos.filter(c => c.tipo === 'leche' && !c.anulado);

          return `
          <div class="card card-accent card-accent-gold p-16 mt-10 mb-16">
            <div class="section-header-theme mb-12" style="--theme-color: var(--p-gold)">1. DATOS DE RECOGIDA EN TANQUE</div>
            
            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">FECHA</label>
                <input type="date" id="w-l-fecha" value="${data.fecha}" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">VOLUMEN (LITROS)</label>
                <input type="number" id="w-l-cant" value="${data.l}" class="wizard-input border-green font-950 text-xl text-green">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">ESPECIE</label>
                <select id="w-l-especie" class="wizard-input font-800 text-xs">
                  <option value="vacuno" ${data.especie_leche === 'vacuno' ? 'selected' : ''}>VACUNO</option>
                  <option value="ovino" ${data.especie_leche === 'ovino' ? 'selected' : ''}>OVINO</option>
                  <option value="caprino" ${data.especie_leche === 'caprino' ? 'selected' : ''}>CAPRINO</option>
                </select>
              </div>
              ${tanquesActivos.length > 0 ? `
              <div class="wizard-input-group">
                <label class="wizard-label">TANQUE ORIGEN</label>
                <select id="w-l-tanque" class="wizard-input font-800 text-xs">
                  <option value="">— SELECCIONAR —</option>
                  ${tanquesActivos.map(t => `<option value="${t.id}" ${data.tanqueId == t.id ? 'selected' : ''}>${t.nombre} (${t.codigo_letra_q})</option>`).join('')}
                </select>
              </div>
              ` : `
              <div class="wizard-input-group">
                <label class="wizard-label">TANQUE</label>
                <div class="text-[0.6rem] font-800 text-red p-8">Sin tanques registrados</div>
              </div>
              `}
            </div>
            <div id="w-l-tanque-stock" class="text-[0.6rem] font-800 mb-8" style="color:var(--c-info);"></div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">MATRÍCULA CISTERNA</label>
                <input type="text" id="w-l-mat" value="${data.matricula}" placeholder="ABC-000" class="wizard-input uppercase font-900 text-lg">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">TEMPERATURA (°C)</label>
                <input type="number" id="w-l-temp" value="${data.temp}" step="0.1" class="wizard-input font-950 text-xl" style="color:${data.temp <= 4 ? 'var(--c-success)' : 'var(--c-danger)'};">
              </div>
            </div>

            <div class="wizard-input-group mb-12">
              <label class="wizard-label">NÚMERO MUESTRA LETRA Q</label>
              <input type="text" id="w-l-q" value="${data.q}" placeholder="CÓDIGO MUESTRA..." class="wizard-input uppercase font-800">
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">NIF TOMADOR MUESTRA</label>
                <input type="text" id="w-l-nif-tomador" value="${data.nif_tomador_muestra || ''}" placeholder="NIF..." class="wizard-input uppercase font-800 text-xs">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">INHIBIDORES IN SITU</label>
                <select id="w-l-inh-situ" class="wizard-input font-800 text-xs">
                  <option value="no_realizada" ${(!data.resultado_inhibidores_in_situ || data.resultado_inhibidores_in_situ === 'no_realizada') ? 'selected' : ''}>NO REALIZADA</option>
                  <option value="conforme" ${data.resultado_inhibidores_in_situ === 'conforme' ? 'selected' : ''}>CONFORME</option>
                  <option value="no_conforme" ${data.resultado_inhibidores_in_situ === 'no_conforme' ? 'selected' : ''}>NO CONFORME</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">AGENTE RECOGIDA</label>
                <select id="w-l-agente-recogida" class="wizard-input font-800 text-xs">
                  <option value="">— 1er COMPRADOR (DEFECTO) —</option>
                  ${compradoresLacteos.map(c => `<option value="${c.nif_cif}" ${data.agente_recogida_nif === c.nif_cif ? 'selected' : ''}>${c.nombre} (${c.nif_cif})</option>`).join('')}
                </select>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">AGENTE DESTINO</label>
                <select id="w-l-agente-destino" class="wizard-input font-800 text-xs">
                  <option value="">— 1er COMPRADOR (DEFECTO) —</option>
                  ${compradoresLacteos.map(c => `<option value="${c.nif_cif}" ${data.agente_destino_nif === c.nif_cif ? 'selected' : ''}>${c.nombre} (${c.nif_cif})</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">TIPO MOVIMIENTO LETRA Q</label>
                <select id="w-l-tipo-mov" class="wizard-input font-800 text-xs">
                  <option value="explotacion_a_cisterna" ${(data.tipo_movimiento_letra_q || 'explotacion_a_cisterna') === 'explotacion_a_cisterna' ? 'selected' : ''}>EXPLOTACIÓN → CISTERNA</option>
                  <option value="explotacion_a_rechazo" ${data.tipo_movimiento_letra_q === 'explotacion_a_rechazo' ? 'selected' : ''}>EXPLOTACIÓN → RECHAZO</option>
                  <option value="explotacion_a_establecimiento" ${data.tipo_movimiento_letra_q === 'explotacion_a_establecimiento' ? 'selected' : ''}>EXPLOTACIÓN → ESTABLECIMIENTO</option>
                  <option value="cisterna_a_cisterna" ${data.tipo_movimiento_letra_q === 'cisterna_a_cisterna' ? 'selected' : ''}>CISTERNA → CISTERNA</option>
                  <option value="cisterna_a_rechazo" ${data.tipo_movimiento_letra_q === 'cisterna_a_rechazo' ? 'selected' : ''}>CISTERNA → RECHAZO</option>
                  <option value="cisterna_a_establecimiento" ${data.tipo_movimiento_letra_q === 'cisterna_a_establecimiento' ? 'selected' : ''}>CISTERNA → ESTABLECIMIENTO</option>
                </select>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">ESTADO LETRA Q</label>
                <select id="w-l-estado-q" class="wizard-input font-800 text-xs">
                  <option value="pendiente" ${(data.estado_letra_q || 'pendiente') === 'pendiente' ? 'selected' : ''}>PENDIENTE</option>
                  <option value="comunicado" ${data.estado_letra_q === 'comunicado' ? 'selected' : ''}>COMUNICADO</option>
                  <option value="rechazado" ${data.estado_letra_q === 'rechazado' ? 'selected' : ''}>RECHAZADO</option>
                  <option value="exento" ${data.estado_letra_q === 'exento' ? 'selected' : ''}>EXENTO</option>
                </select>
              </div>
            </div>

            <div id="w-l-cisterna-fields" class="grid grid-cols-2 gap-10 mb-12" style="display:${data.tipo_movimiento_letra_q === 'cisterna_a_cisterna' ? 'grid' : 'none'};">
              <div class="wizard-input-group">
                <label class="wizard-label">CÓD. CISTERNA ORIGEN (LETRA Q)</label>
                <input type="text" id="w-l-cist-origen" value="${data.codigo_cisterna_origen_letra_q || ''}" placeholder="CÓDIGO..." class="wizard-input uppercase font-800 text-xs">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">CÓD. CISTERNA DESTINO (LETRA Q)</label>
                <input type="text" id="w-l-cist-destino" value="${data.codigo_cisterna_destino_letra_q || ''}" placeholder="CÓDIGO..." class="wizard-input uppercase font-800 text-xs">
              </div>
            </div>

            <div class="grid grid-cols-3 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">Nº MUESTREO OFICIAL</label>
                <input type="text" id="w-l-muestreo" value="${data.numero_muestreo_oficial || ''}" placeholder="OPCIONAL..." class="wizard-input uppercase font-800 text-xs">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">HORA ORDEÑO</label>
                <input type="time" id="w-l-hora-ordeno" value="${data.hora_ordeno || ''}" class="wizard-input font-800 text-xs">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">HORA CARGA</label>
                <input type="time" id="w-l-hora-carga" value="${data.hora_carga || ''}" class="wizard-input font-800 text-xs">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">Nº CONTRATO</label>
                <select id="w-l-ctr" class="wizard-input font-800 uppercase text-xs">
                   <option value="${finca.contrato_lacteo_numero || ''}">${finca.contrato_lacteo_numero || '— DEF. FINCA —'}</option>
                   ${contratosLeche.map(c => `<option value="${c.numero_contrato}" ${data.contrato_numero === c.numero_contrato ? 'selected' : ''}>${c.numero_contrato}</option>`).join('')}
                </select>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">COMUNIDAD AUTÓNOMA</label>
                <select id="w-l-ccaa" class="wizard-input font-800 text-xs">
                   <option value="">— SELECCIONAR —</option>
                   ${opcionesCCAA.map(o => `<option value="${o.value}" ${data.comunidad_autonoma === o.value ? 'selected' : ''}>${o.label.toUpperCase()}</option>`).join('')}
                </select>
              </div>
            </div>
            
            <div class="p-10 bg-black border border-222 rounded-sm mb-12">
              <label class="flex items-center gap-10 text-xs text-white cursor-pointer mb-8">
                <input type="checkbox" id="w-l-frio" ${data.cadena_frio_cumplida ? 'checked' : ''} style="accent-color:var(--c-info);">
                <span class="uppercase font-900 text-[0.6rem] tracking-tight">CADENA DE FRÍO CUMPLIDA (< 4°C)</span>
              </label>
              <label class="flex items-center gap-10 text-xs text-white cursor-pointer">
                <input type="checkbox" id="w-l-inh" ${data.inh ? 'checked' : ''} style="accent-color:var(--c-info);">
                <span class="uppercase font-950 text-[0.6rem] tracking-tight text-green">AUSENCIA ABSOLUTA DE INHIBIDORES</span>
              </label>
            </div>
          </div>`;
        },
        onChange: async (data) => {
          data.fecha = document.getElementById('w-l-fecha')?.value || data.fecha;
          data.l = parseFloat(document.getElementById('w-l-cant')?.value) || 0;
          data.matricula = document.getElementById('w-l-mat')?.value.trim() || data.matricula;
          data.temp = parseFloat(document.getElementById('w-l-temp')?.value) || 0;
          data.q = document.getElementById('w-l-q')?.value.trim() || data.q;
          data.nif_tomador_muestra = document.getElementById('w-l-nif-tomador')?.value.trim().toUpperCase() || '';
          data.resultado_inhibidores_in_situ = document.getElementById('w-l-inh-situ')?.value || 'no_realizada';
          data.agente_recogida_nif = document.getElementById('w-l-agente-recogida')?.value || null;
          data.agente_destino_nif = document.getElementById('w-l-agente-destino')?.value || null;
          data.tipo_movimiento_letra_q = document.getElementById('w-l-tipo-mov')?.value || 'explotacion_a_cisterna';
          data.estado_letra_q = document.getElementById('w-l-estado-q')?.value || 'pendiente';
          data.codigo_cisterna_origen_letra_q = document.getElementById('w-l-cist-origen')?.value.trim().toUpperCase() || '';
          data.codigo_cisterna_destino_letra_q = document.getElementById('w-l-cist-destino')?.value.trim().toUpperCase() || '';
          data.numero_muestreo_oficial = document.getElementById('w-l-muestreo')?.value.trim() || '';
          data.hora_ordeno = document.getElementById('w-l-hora-ordeno')?.value || '';
          data.hora_carga = document.getElementById('w-l-hora-carga')?.value || '';
          data.contrato_numero = document.getElementById('w-l-ctr')?.value.trim() || data.contrato_numero;
          data.comunidad_autonoma = document.getElementById('w-l-ccaa')?.value || data.comunidad_autonoma;
          data.cadena_frio_cumplida = document.getElementById('w-l-frio')?.checked || false;
          data.inh = document.getElementById('w-l-inh')?.checked || false;
          data.especie_leche = document.getElementById('w-l-especie')?.value || 'vacuno';
          data.tanqueId = parseInt(document.getElementById('w-l-tanque')?.value) || null;

          // Mostrar/ocultar campos de cisterna según tipo de movimiento
          const cisternaFields = document.getElementById('w-l-cisterna-fields');
          if (cisternaFields) {
            cisternaFields.style.display = data.tipo_movimiento_letra_q === 'cisterna_a_cisterna' ? 'grid' : 'none';
          }
          
          data.estado_tramite_infolac = data.estado_tramite_infolac || 'borrador';
          data.adsg_codigo = data.adsg_codigo || finca.adsg_codigo || '';

          if (data.tanqueId && window.BalanceLacteo) {
            const stock = await window.BalanceLacteo.getStockTanque(data.tanqueId);
            const tanque = tanquesActivos.find(t => t.id === data.tanqueId);
            const stockEl = document.getElementById('w-l-tanque-stock');
            if (stockEl) {
              const pct = tanque && tanque.capacidad_litros > 0 ? Math.round((stock / tanque.capacidad_litros) * 100) : 0;
              stockEl.textContent = `Stock tanque: ${stock.toLocaleString('es-ES')}L (${pct}% capacidad)`;
              stockEl.style.color = data.l > stock ? 'var(--c-danger)' : 'var(--c-info)';
            }
          }
        },
        validate: async (data) => {
          if (!data.fecha) { App.toastError("La fecha de recogida es obligatoria"); return false; }
          if (data.l <= 0) { App.toastError("El volumen debe ser mayor a 0 Litros"); return false; }
          if (!data.comunidad_autonoma) { App.toastError("Selecciona la comunidad autónoma"); return false; }
          if (data.temp > 6) { App.toast("ALERTA SANITARIA: Temperatura > 6°C detectada.", 'warning'); }
          if (!data.inh) { App.toastError("Debes certificar la ausencia de inhibidores."); return false; }

          // Regla de intermediarios (Nota Aclaratoria MAPA)
          if (data.tipo_movimiento_letra_q && !data.tipo_movimiento_letra_q.startsWith('cisterna_a') && data.agente_recogida_nif) {
            const agente = compradoresLacteos.find(c => c.nif_cif === data.agente_recogida_nif);
            if (agente && agente.tipo_operador_lacteo === 'intermediario') {
              App.toastError('Los movimientos de solo cambio de propiedad (Intermediario 1) no se registran en Letra Q 2.0. Si hay cambio de cisterna, seleccione tipo "Cisterna → Cisterna".');
              return false;
            }
          }

          // Validación movimiento Letra Q
          if (window.MotorLacteo) {
            const movVal = await window.MotorLacteo.validarMovimientoLetraQ({
              tipo_movimiento_letra_q: data.tipo_movimiento_letra_q,
              agente_recogida_nif: data.agente_recogida_nif,
              agente_destino_nif: data.agente_destino_nif,
              resultado_inhibidores_in_situ: data.resultado_inhibidores_in_situ,
              muestra_tomada: !!data.q,
              nif_tomador_muestra: data.nif_tomador_muestra,
              codigo_cisterna_origen_letra_q: data.codigo_cisterna_origen_letra_q,
              codigo_cisterna_destino_letra_q: data.codigo_cisterna_destino_letra_q,
            });
            for (const err of movVal.errores) {
              App.toastError(err);
            }
            if (!movVal.valido) return false;
            for (const w of movVal.warnings) {
              App.toast(w, 'warning');
            }
          }

          if (data.tanqueId && window.BalanceLacteo) {
            const validacion = await window.BalanceLacteo.validarStockSuficiente(data.tanqueId, data.l);
            if (!validacion.valido) {
              App.toastError(`Litros (${data.l}L) superan stock del tanque (${validacion.stockActual}L)`);
              return false;
            }
          }

          if (window.MotorLacteo) {
            const validacionCom = await window.MotorLacteo.validarComercializacion({
              fincaId,
              tanqueId: data.tanqueId,
              cantidad: data.l,
              especie_leche: data.especie_leche,
              temperatura: data.temp,
            });
            for (const err of validacionCom.errores) {
              App.toastError(err);
            }
            if (!validacionCom.valido) return false;
            for (const w of validacionCom.warnings) {
              App.toast(w, 'warning');
            }
          }

          return true;
        }
      },
      {
        content: (data) => {
          const es = (parseFloat(data.grasa || 0) + parseFloat(data.proteina || 0)).toFixed(2);
          const pBase = parseFloat(data.pb) || refPrecios.precio_base_referencia;
          const pExt = parseFloat(data.precio_extracto_seco) || refPrecios.precio_por_punto_extracto;
          const tasa = refPrecios.tasa_INLAC_defecto;
          const primas = parseFloat(data.primas_penalizaciones) || 0;
          const precioFinal = parseFloat((pBase + (parseFloat(es) * pExt) - tasa + primas).toFixed(4));
          const vol = parseFloat(data.l) || 0;
          const importeTotal = parseFloat((vol * precioFinal).toFixed(2));

          return `
          <div class="card card-accent card-accent-purple p-16 mt-10 mb-16">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-purple)">2. ANALÍTICA Y LIQUIDACIÓN (OPCIONAL)</div>
            <p class="text-[0.6rem] text-aaa uppercase font-800 text-center mb-12">Puedes dejar esto en blanco y rellenarlo más adelante cuando recibas los resultados del laboratorio.</p>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">MATERIA GRASA (%)</label>
                <input type="number" id="w-l-grasa" value="${data.grasa || ''}" step="0.01" class="wizard-input font-900" onchange="App._recalcularPrecioLeche()" oninput="App._recalcularPrecioLeche()">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">PROTEÍNA (%)</label>
                <input type="number" id="w-l-prot" value="${data.proteina || ''}" step="0.01" class="wizard-input font-900" onchange="App._recalcularPrecioLeche()" oninput="App._recalcularPrecioLeche()">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">GÉRMENES (UFC/ML)</label>
                <input type="number" id="w-l-ger" value="${data.germenes || ''}" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">SOMÁTICAS (CEL/ML)</label>
                <input type="number" id="w-l-som" value="${data.somaticas || ''}" class="wizard-input font-800">
              </div>
            </div>

            <div class="border-top-222 pt-12 mt-4 mb-12">
              <div class="section-header-theme mb-10" style="--theme-color: var(--c-danger); font-size: var(--fs-tiny);">AFLATOXINA M1 (PLAN PIVCA)</div>
              <div class="grid grid-cols-2 gap-10 mb-10">
                <div class="wizard-input-group">
                  <label class="wizard-label">AFLATOXINA M1 (ng/kg)</label>
                  <input type="number" id="w-l-afm1" value="${data.aflatoxina_m1 || ''}" step="0.1" class="wizard-input font-800">
                </div>
                <div class="wizard-input-group">
                  <label class="wizard-label">MÉTODO</label>
                  <select id="w-l-afm1-metodo" class="wizard-input font-800 text-xs">
                    <option value="">— NINGUNO —</option>
                    <option value="kit_rapido" ${data.aflatoxina_m1_metodo === 'kit_rapido' ? 'selected' : ''}>KIT RÁPIDO</option>
                    <option value="ELISA" ${data.aflatoxina_m1_metodo === 'ELISA' ? 'selected' : ''}>ELISA</option>
                    <option value="HPLC" ${data.aflatoxina_m1_metodo === 'HPLC' ? 'selected' : ''}>HPLC</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">FECHA ANÁLISIS</label>
              <input type="date" id="w-l-fec-an" value="${data.fecha_analisis || ''}" class="wizard-input font-800">
            </div>

            ${laboratorios.length > 0 ? `
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">LABORATORIO</label>
              <select id="w-l-lab" class="wizard-input font-800 text-xs">
                ${laboratorios.map(l => `<option value="${l.codigo}" ${data.laboratorio_nombre === l.codigo || data.laboratorio_nombre === l.nombre ? 'selected' : ''}>${l.nombre}</option>`).join('')}
              </select>
            </div>
            ` : ''}

            <div class="p-10 bg-black border border-222 rounded-sm mb-12">
              <label class="flex items-center gap-10 text-xs text-white cursor-pointer">
                <input type="checkbox" id="w-l-antb" ${data.antibioticos ? 'checked' : ''} style="accent-color:var(--c-danger);">
                <span class="uppercase font-950 text-[0.6rem] tracking-tight text-red flex items-center gap-4">
                  <span style="color:var(--c-danger);">|</span> RESIDUOS DE ANTIBIÓTICOS DETECTADOS (ALERTA CRÍTICA)
                </span>
              </label>
            </div>

            <div class="border-top-222 pt-12 mt-12 mb-12">
              <div class="section-header-theme mb-12" style="--theme-color: var(--c-warning); font-size: var(--fs-tiny);">MÁRGENES Y COSTES DE ALIMENTACIÓN</div>
              <div class="grid grid-cols-2 gap-10">
                <div class="wizard-input-group">
                  <label class="wizard-label">COSTE DIARIO RACIÓN (€)</label>
                  <input type="number" id="w-l-coste-diario" value="${data.coste_alimentacion_diario || ''}" placeholder="Ej: 45.20" step="0.01" class="wizard-input font-800">
                </div>
                <div class="wizard-input-group">
                  <label class="wizard-label">COSTE TOTAL PERÍODO (€)</label>
                  <input type="number" id="w-l-coste-periodo" value="${data.coste_alimentacion_periodo || ''}" placeholder="Ej: 350.00" step="0.01" class="wizard-input font-800">
                </div>
              </div>
            </div>

            <div class="border-top-222 pt-12 mt-12">
              <div class="grid grid-cols-2 gap-10 mb-12">
                <div class="wizard-input-group">
                  <label class="wizard-label">PRECIO BASE (€/L)</label>
                  <input type="number" id="w-l-pb" value="${data.pb || refPrecios.precio_base_referencia}" step="0.001" class="wizard-input font-800"
                    onchange="App._recalcularPrecioLeche()" oninput="App._recalcularPrecioLeche()">
                </div>
                <div class="wizard-input-group">
                  <label class="wizard-label">PRIMAS/PEN. (€)</label>
                  <input type="number" id="w-l-prim" value="${data.primas_penalizaciones || 0}" step="0.01" class="wizard-input font-800"
                    onchange="App._recalcularPrecioLeche()" oninput="App._recalcularPrecioLeche()">
                </div>
              </div>
              
              <input type="hidden" id="w-l-pex" value="${data.precio_extracto_seco || refPrecios.precio_por_punto_extracto}">
              <input type="hidden" id="w-l-cant-oculto" value="${data.l}">

              <div class="bg-black border border-222 rounded-sm p-14">
                <div class="grid grid-cols-2 gap-8 text-[0.65rem] uppercase font-900 tracking-tight">
                  <div class="mt-4 border-top-222 pt-4">PRECIO FINAL:</div><div class="mt-4 border-top-222 pt-4 text-right"><strong id="w-l-precio-final-display" class="text-green text-sm">${precioFinal.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} €/L</strong></div>
                  <div class="mt-2">IMPORTE TOTAL:</div><div class="mt-2 text-right"><strong id="w-l-importe-display" class="text-green text-lg">${importeTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong></div>
                </div>
              </div>
            </div>
          </div>`;
        },
        onChange: async (data) => {
          data.grasa = parseFloat(document.getElementById('w-l-grasa')?.value) || 0;
          data.proteina = parseFloat(document.getElementById('w-l-prot')?.value) || 0;
          data.germenes = parseFloat(document.getElementById('w-l-ger')?.value) || 0;
          data.somaticas = parseFloat(document.getElementById('w-l-som')?.value) || 0;
          data.fecha_analisis = document.getElementById('w-l-fec-an')?.value || data.fecha_analisis;
          data.pb = parseFloat(document.getElementById('w-l-pb')?.value) || 0;
          data.primas_penalizaciones = parseFloat(document.getElementById('w-l-prim')?.value) || 0;
          data.antibioticos = document.getElementById('w-l-antb')?.checked || false;
          data.coste_alimentacion_diario = parseFloat(document.getElementById('w-l-coste-diario')?.value) || 0;
          data.coste_alimentacion_periodo = parseFloat(document.getElementById('w-l-coste-periodo')?.value) || 0;
          data.aflatoxina_m1 = parseFloat(document.getElementById('w-l-afm1')?.value) || null;
          data.aflatoxina_m1_metodo = document.getElementById('w-l-afm1-metodo')?.value || null;
          data.laboratorio_nombre = document.getElementById('w-l-lab')?.value || data.laboratorio_nombre;
        },
        validate: async (data) => {
          if (window.ComunidadesService) {
            const especie = data.especie_leche || 'vacuno';
            const evalResult = window.ComunidadesService.evaluarCalidadLecheEspecie({
              grasa: data.grasa,
              proteina: data.proteina,
              germenes_30C: data.germenes,
              celulas_somaticas: data.somaticas,
              inhibidores: data.antibioticos,
              aflatoxina_m1: data.aflatoxina_m1,
            }, especie);

            if (evalResult.bloqueante) {
              evalResult.alertas.forEach(a => App.toastError(a));
              return false;
            }
            evalResult.alertas.forEach(a => App.toast(a, 'warning'));
          }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: `wizard-leche-colectivo-container-${borrador ? borrador.id : 'nuevo'}`,
      title: 'SALIDA LÁCTEA',
      initialData: {
        id: borrador ? borrador.id : undefined,
        fecha: borrador ? borrador.fechaRecogida : new Date().toISOString().split("T")[0],
        comunidad_autonoma: borrador ? borrador.comunidad_autonoma : (finca.comunidad_autonoma || ''),
        contrato_numero: borrador ? borrador.contrato_numero : (finca.contrato_lacteo_numero || ''),
        adsg_codigo: borrador ? borrador.adsg_codigo : (finca.adsg_codigo || ''),
        matricula: borrador ? borrador.matriculaCisterna : "",
        q: borrador ? borrador.numero_Muestra_Letra_Q : "",
        numero_infolac: borrador ? borrador.numero_infolac : (finca.numero_infolac || ''),
        numero_muestreo_oficial: borrador ? borrador.numero_muestreo_oficial : '',
        hora_ordeno: borrador ? borrador.hora_ordeno : '',
        hora_carga: borrador ? borrador.hora_carga : '',
        temp: borrador ? borrador.temperatura : 4.5,
        cadena_frio_cumplida: borrador ? !!borrador.cadena_frio_cumplida : true,
        inh: borrador ? !!borrador.certificadoInhibidores : true,
        especie_leche: borrador ? (borrador.especie_leche || 'vacuno') : 'vacuno',
        tanqueId: borrador ? (borrador.tanqueId || null) : null,
        grasa: borrador ? (borrador.laboratorio?.grasa || borrador.analitica?.grasa) : '',
        proteina: borrador ? (borrador.laboratorio?.proteina || borrador.analitica?.proteina) : '',
        germenes: borrador ? (borrador.laboratorio?.germenes || borrador.laboratorio?.gemenes || borrador.analitica?.germenes_30C) : '',
        somaticas: borrador ? (borrador.laboratorio?.somaticas || borrador.analitica?.celulas_somaticas) : '',
        antibioticos: borrador ? !!borrador.laboratorio?.antibioticos : false,
        fecha_analisis: borrador ? (borrador.laboratorio?.fecha_analisis || borrador.analitica?.fecha_muestreo) : new Date().toISOString().split("T")[0],
        nro_boletin: borrador ? (borrador.laboratorio?.nro_boletin || borrador.analitica?.nro_boletin) : '',
        laboratorio_nombre: borrador ? (borrador.laboratorio?.laboratorio_nombre || borrador.analitica?.laboratorio_nombre) : 'CICAP',
        aflatoxina_m1: borrador ? (borrador.analitica?.aflatoxina_m1 || '') : '',
        aflatoxina_m1_metodo: borrador ? (borrador.analitica?.aflatoxina_m1_metodo || '') : '',
        estado_tramite_infolac: borrador ? borrador.estado_tramite_infolac : 'borrador',
        fecha_presentacion_infolac: borrador ? borrador.fecha_presentacion_infolac : '',
        numero_registro_infolac: borrador ? borrador.numero_registro_infolac : '',
        acuse_infolac: borrador ? borrador.acuse_infolac : '',
        l: borrador ? borrador.cantidad : 0,
        pb: borrador ? borrador.precioBase : refPrecios.precio_base_referencia,
        precio_extracto_seco: borrador ? borrador.precio_extracto_seco : refPrecios.precio_por_punto_extracto,
        primas_penalizaciones: borrador ? borrador.primas_penalizaciones : 0,
        coste_alimentacion_diario: borrador ? borrador.coste_alimentacion_diario : 0,
        coste_alimentacion_periodo: borrador ? borrador.coste_alimentacion_periodo : 0,
        nif_tomador_muestra: borrador ? borrador.nif_tomador_muestra : '',
        resultado_inhibidores_in_situ: borrador ? borrador.resultado_inhibidores_in_situ : 'no_realizada',
        tipo_movimiento_letra_q: borrador ? borrador.tipo_movimiento_letra_q : 'explotacion_a_cisterna',
        agente_recogida_nif: borrador ? borrador.agente_recogida_nif : null,
        agente_destino_nif: borrador ? borrador.agente_destino_nif : null,
        codigo_cisterna_origen_letra_q: borrador ? borrador.codigo_cisterna_origen_letra_q : '',
        codigo_cisterna_destino_letra_q: borrador ? borrador.codigo_cisterna_destino_letra_q : '',
        estado_letra_q: borrador ? borrador.estado_letra_q : 'pendiente',
        fecha_limite_comunicacion_letra_q: borrador ? borrador.fecha_limite_comunicacion_letra_q : '',
        fecha_comunicado_letra_q: borrador ? borrador.fecha_comunicado_letra_q : '',
      },
      steps: wizardSteps,
      onComplete: async (dataLeche) => {
        try {
          // Validación GAP 5: Bloquear venta de leche si prohibidoLeche está activo
          const sanitarios = await window.Sanitarios.list(null, fincaId);
          const prohibidoLecheActivo = sanitarios && sanitarios.some(s => s.prohibidoLeche === true);
          if (prohibidoLecheActivo) {
            const motivo = sanitarios.find(s => s.prohibidoLeche === true);
            App.toastError(`VENTA DE LECHE PROHIBIDA: Se ha detectado un tratamiento con restricción. Consulta con Inspección (${motivo.tipo_tratamiento || 'medicamento'}). Revisa SANEAMIENTOS.`);
            return;
          }

          // Calcular campos derivados
          const extractoSeco = parseFloat((parseFloat(dataLeche.grasa || 0) + parseFloat(dataLeche.proteina || 0)).toFixed(2));
          const pBase = parseFloat(dataLeche.pb) || 0;
          const pExt = parseFloat(dataLeche.precio_extracto_seco) || 0;
          const tasa = refPrecios.tasa_INLAC_defecto;
          const primas = parseFloat(dataLeche.primas_penalizaciones) || 0;
          const precioFinal = parseFloat((pBase + (extractoSeco * pExt) - tasa + primas).toFixed(4));
          const cantidad = parseFloat(dataLeche.l) || 0;
          const importeTotal = parseFloat((cantidad * precioFinal).toFixed(2));
          const costeAlim = parseFloat(dataLeche.coste_alimentacion_periodo) || 0;
          const mofa = parseFloat((importeTotal - costeAlim).toFixed(2));

          // Estado analítico basado en antibióticos
          const estadoAnalitica = dataLeche.antibioticos ? "Alerta Crítica" : (dataLeche.grasa ? "Validado" : "Pendiente");

          // Vincular el comprador del contrato seleccionado (bug detectado en la
          // auditoría de Producción/Compras/Ventas/Almacén: esta entrega nunca
          // guardaba compradorId, así que Compradores.getEntregasLeche() siempre
          // devolvía vacío aunque hubiera entregas reales).
          let compradorId = borrador ? borrador.compradorId || null : null;
          if (dataLeche.contrato_numero) {
            const contratosTodos = await window.db.getAll('contratos_compra').catch(() => []);
            const contratoSeleccionado = contratosTodos.find(c => c.numero_contrato === dataLeche.contrato_numero && !c.anulado);
            if (contratoSeleccionado) compradorId = contratoSeleccionado.compradorId;
          }

          // Construir el registro completo
          const reg = {
            cantidad: cantidad,
            fechaRecogida: dataLeche.fecha,
            fincaId: fincaId,
            compradorId: compradorId,
            matriculaCisterna: dataLeche.matricula,
            numero_Muestra_Letra_Q: dataLeche.q,
            temperatura: dataLeche.temp,
            certificadoInhibidores: dataLeche.inh,
            precioBase: pBase,
            estadoAnalitica: estadoAnalitica,
            tasa_INLAC: tasa,
            antibioticos: dataLeche.antibioticos || false,
            comunidad_autonoma: dataLeche.comunidad_autonoma || null,
            contrato_numero: dataLeche.contrato_numero || '',
            adsg_codigo: dataLeche.adsg_codigo || '',
            estado_tramite_infolac: dataLeche.estado_tramite_infolac || 'borrador',
            fecha_presentacion_infolac: dataLeche.fecha_presentacion_infolac || null,
            numero_registro_infolac: dataLeche.numero_registro_infolac || '',
            acuse_infolac: dataLeche.acuse_infolac || '',
            rega_origen: finca.codigo_REGA || finca.rega || '',
            numero_infolac: dataLeche.numero_infolac || '',
            numero_muestreo_oficial: dataLeche.numero_muestreo_oficial || '',
            cadena_frio_cumplida: dataLeche.cadena_frio_cumplida || false,
            hora_ordeno: dataLeche.hora_ordeno || '',
            hora_carga: dataLeche.hora_carga || '',
            tanqueId: dataLeche.tanqueId || null,
            especie_leche: dataLeche.especie_leche || 'vacuno',
            codigo_letra_q_tanque: null,
            recibo_letra_q: {
              identificacion_productor: finca.nombre_titular || finca.nombre || '',
              codigo_explotacion: finca.codigo_REGA || finca.rega || '',
              fecha_hora_recogida: `${dataLeche.fecha}T${dataLeche.hora_carga || '00:00'}`,
              cantidad_litros: cantidad,
              operador_cisterna: dataLeche.matricula,
              muestra_tomada: !!dataLeche.q,
            },
            laboratorio: {
              grasa: dataLeche.grasa || 0,
              proteina: dataLeche.proteina || 0,
              somaticas: dataLeche.somaticas || 0,
              germenes: dataLeche.germenes || 0,
              antibioticos: dataLeche.antibioticos || false,
              fecha_analisis: dataLeche.fecha_analisis || '',
              extracto_seco: extractoSeco,
              recuento_bacterias: dataLeche.germenes || 0,
              antibioticos_positivos: dataLeche.antibioticos || false,
              laboratorio_nombre: dataLeche.laboratorio_nombre || 'CICAP',
              nro_boletin: dataLeche.nro_boletin || '',
            },
            precio_extracto_seco: pExt,
            primas_penalizaciones: primas,
            precio_final_unitario: precioFinal,
            importe_total: importeTotal,
            coste_alimentacion_diario: dataLeche.coste_alimentacion_diario || 0,
            coste_alimentacion_periodo: costeAlim,
            mofa: mofa,
            // Nuevos campos RD 989/2022
            nif_tomador_muestra: dataLeche.nif_tomador_muestra || '',
            resultado_inhibidores_in_situ: dataLeche.resultado_inhibidores_in_situ || 'no_realizada',
            tipo_movimiento_letra_q: dataLeche.tipo_movimiento_letra_q || 'explotacion_a_cisterna',
            agente_recogida_nif: dataLeche.agente_recogida_nif || null,
            agente_destino_nif: dataLeche.agente_destino_nif || null,
            codigo_cisterna_origen_letra_q: dataLeche.codigo_cisterna_origen_letra_q || null,
            codigo_cisterna_destino_letra_q: dataLeche.codigo_cisterna_destino_letra_q || null,
            estado_letra_q: dataLeche.estado_letra_q || 'pendiente',
            fecha_limite_comunicacion_letra_q: null,
            fecha_comunicado_letra_q: dataLeche.fecha_comunicado_letra_q || null,
            creadoEn: borrador ? borrador.creadoEn : new Date().toISOString(),
          };

          // Calcular fecha límite de comunicación a Letra Q
          if (window.MotorLacteo && dataLeche.fecha) {
            const nifDestino = dataLeche.agente_destino_nif || null;
            let tipoAgenteDestino = 'primer_comprador';
            if (nifDestino) {
              const agenteDest = compradoresLacteos.find(c => c.nif_cif === nifDestino);
              if (agenteDest && agenteDest.tipo_operador_lacteo) {
                tipoAgenteDestino = agenteDest.tipo_operador_lacteo;
              }
            }
            reg.fecha_limite_comunicacion_letra_q = window.MotorLacteo.calcularPlazoComunicacion(tipoAgenteDestino, dataLeche.fecha);
          }

          if (dataLeche.tanqueId) {
            const tanque = await window.TanquesLeche.getById(dataLeche.tanqueId);
            if (tanque) reg.codigo_letra_q_tanque = tanque.codigo_letra_q;
          }

          // ═══════════════════════════════════════════════════════════════════
          // FASE 1 — P1: BLOQUEO SANITARIO AUTOMÁTICO EN VENTA DE LECHE
          // Verifica que ningún animal del rebaño tenga supresión activa
          // ═══════════════════════════════════════════════════════════════════
          if (window.MotorTrazabilidad && window.MotorTrazabilidad.checkSupresion) {
            try {
              // Obtener animales del rebaño lechero activo
              const rebanos = await window.db.getAll('rebanos').catch(() => []);
              const rebanosLecheros = rebanos.filter(r => 
                (r.tipo || '').toLowerCase().includes('lech') || 
                (r.tipo || '').toLowerCase().includes('láct') ||
                (r.tipo || '').toLowerCase().includes('mixt')
              );
              
              let animalesARiesgo = [];
              for (const reb of rebanosLecheros) {
                const animales = await window.db.getAll('animales').catch(() => []);
                const animalesDelRebano = animales.filter(a => a.rebanoId === reb.id && a.estado === 'activo');
                animalesARiesgo.push(...animalesDelRebano);
              }

              // Fecha de referencia para toda la validación sanitaria (retiro + supresión)
              const fechaEntrega = dataLeche.fecha || new Date().toISOString().split('T')[0];

              // Validación de bioseguridad unificada cruzada por rebaño completo
              if (window.Sanitarios && window.Sanitarios.verificarRetiroLeche) {
                for (const reb of rebanosLecheros) {
                  const checkReb = await window.Sanitarios.verificarRetiroLeche(reb.id, fechaEntrega);
                  if (checkReb && checkReb.bloqueado) {
                    const mensaje = `⚠️ ALERTA CRÍTICA DE RETIRO LÁCTEO\n\n` +
                      `Rebaño: ${reb.nombre.toUpperCase()}\n` +
                      `${checkReb.motivos.join('\n')}\n\n` +
                      `Se bloquea la expedición de leche para evitar contaminación química del tanque de frío.`;
                    App.toastError(mensaje);
                    return; // Abortar el guardado
                  }
                }
              }

              // Verificar supresión para cada animal
              let bloqueoDetectado = null;

              for (const animal of animalesARiesgo) {
                const resultado = await window.MotorTrazabilidad.checkSupresion(
                  window.db,
                  animal.id,
                  fechaEntrega,
                  'leche'
                );

                if (!resultado.apto) {
                  bloqueoDetectado = {
                    animal: animal.numero_identificacion || animal.crotal || `ID ${animal.id}`,
                    rebaño: animalesARiesgo.find(a => a.id === animal.id)?.rebanoId,
                    motivo: resultado.motivo,
                    diasRestantes: resultado.diasRestantes,
                    fechaLiberacion: resultado.fechaLiberacion
                  };
                  break; // Primer bloqueo detectado, abortar
                }
              }

              // Si hay bloqueo, abortar el guardado
              if (bloqueoDetectado) {
                const mensaje = `⚠️ BLOQUEO SANITARIO DETECTADO\n\n` +
                  `Animal: ${bloqueoDetectado.animal}\n` +
                  `${bloqueoDetectado.motivo}\n\n` +
                  `Días restantes: ${bloqueoDetectado.diasRestantes}\n` +
                  `Fecha liberación: ${bloqueoDetectado.fechaLiberacion}\n\n` +
                  `No es posible registrar esta entrega de leche hasta que expire el periodo de supresión.`;
                
                App.toastError(mensaje);
                return; // Abortar el guardado
              }
            } catch (error) {
              console.warn('[Leche] Error verificando supresión:', error);
              // Si hay error en la verificación, continuar con advertencia
              App.toast('Advertencia: No se pudo verificar el estado sanitario', 'warning');
            }
          }

          let idL;
          const idNumerico = Number(dataLeche.id);
          if (dataLeche.id && Number.isFinite(idNumerico)) {
            reg.id = idNumerico;
            await window.db.put("comercializacion_leche", reg);
            idL = reg.id;
          } else {
            idL = await window.db.add("comercializacion_leche", reg);
          }

          if (dataLeche.grasa || dataLeche.germenes || dataLeche.somaticas || dataLeche.aflatoxina_m1) {
            try {
              const analiticaData = {
                fincaId,
                comercializacionId: idL,
                tanqueId: dataLeche.tanqueId || null,
                fecha_muestreo: dataLeche.fecha_analisis || dataLeche.fecha,
                tipo_muestreo: 'autocontrol',
                laboratorio_nombre: dataLeche.laboratorio_nombre || 'CICAP',
                nro_boletin: dataLeche.nro_boletin || null,
                grasa: dataLeche.grasa || null,
                proteina: dataLeche.proteina || null,
                germenes_30C: dataLeche.germenes || null,
                celulas_somaticas: dataLeche.somaticas || null,
                inhibidores: !dataLeche.inh,
                antibioticos_detectados: dataLeche.antibioticos || false,
                aflatoxina_m1: dataLeche.aflatoxina_m1 || null,
                aflatoxina_m1_metodo: dataLeche.aflatoxina_m1_metodo || null,
                numero_muestra_letra_q: dataLeche.q || null,
                especie: dataLeche.especie_leche || 'vacuno',
              };
              const analiticaId = await window.db.add('analiticas_leche', analiticaData);
              reg.analiticaId = analiticaId;
              await window.db.put("comercializacion_leche", reg);
            } catch (analErr) {
              console.warn('[Leche] Error guardando analítica:', analErr);
            }
          }

          if (dataLeche.tanqueId && window.BalanceLacteo) {
            try {
              await window.BalanceLacteo.registrar({
                fincaId,
                tanqueId: dataLeche.tanqueId,
                tipo_movimiento: 'salida',
                fecha: dataLeche.fecha,
                cantidad_litros: cantidad,
                referencia_tipo: 'comercializacion_leche',
                referencia_id: idL,
                temperatura: dataLeche.temp,
              });
            } catch (balErr) {
              console.warn('[Leche] Error registrando salida en balance:', balErr);
            }
          }

          const numeroDocInfolac = `INFOLAC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${idL}`;
          
          const docsLegales = await window.db.getAll('documentos_legales').catch(() => []);
          const docPrevio = docsLegales.find(d => d.tipo === 'infolac_declaracion' && d.referencia_operacion_id === idL);
          const docData = {
            id: docPrevio ? docPrevio.id : undefined,
            tipo: 'infolac_declaracion',
            fincaId,
            numero: numeroDocInfolac,
            fecha_emision: dataLeche.fecha,
            estado_tramite: reg.estado_tramite_infolac,
            fecha_presentacion: reg.fecha_presentacion_infolac,
            numero_registro_oficial: reg.numero_registro_infolac,
            acuse_recibo: reg.acuse_infolac,
            referencia_operacion_id: idL,
            plataforma: window.ComunidadesService?.getConfiguracionCCAA?.(dataLeche.comunidad_autonoma || '')?.sistema_movimiento || '',
            created_at: docPrevio ? docPrevio.created_at : new Date().toISOString(),
            actualizadoEn: new Date().toISOString()
          };
          if (docData.id) {
            await window.db.put('documentos_legales', docData);
          } else {
            await window.db.add('documentos_legales', docData);
          }
          const est = await window.Trazabilidad.generarEstructuraAlbaran(
            window.db,
            { ...reg, id: idL },
            "leche"
          );

          // Registrar en el Libro Maestro de Eventos
          try {
            await window.Pesajes.registrar({
              entidad_id: Number(idL),
              tipo_entidad: 'tanque_leche',
              motivo_tarea: 'produccion_leche',
              fecha: dataLeche.fecha,
              valor_neto: cantidad,
              unidad: 'L',
              precio_unitario: pBase,
              matricula: dataLeche.matricula,
              calidad: {
                temperatura: dataLeche.temp,
                inhibidores: dataLeche.inh,
                extracto_seco: extractoSeco,
                antibioticos: dataLeche.antibioticos,
              },
              rol_contable: 'VENTA',
              snap_comunidad: dataLeche.comunidad_autonoma || null,
              snap_mofa: mofa,
              snap_contrato: dataLeche.contrato_numero || '',
            });
          } catch (regErr) {
            console.warn("[Leche] No se pudo registrar en evento maestro:", regErr);
          }

          App.toast("Salida láctea registrada.", 'success');
          // Refrescar vista actual
          App.route();
          await App.imprimirAlbaran(est, "leche");
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  }
};
