/**
 * Wizard Finca — formulario de nueva finca
 * Extraído de app.js para modularización
 */
window.WizardFinca = {
  showForm(options = {}) {
    const opcionesCCAA = window.ComunidadesService
      ? window.ComunidadesService.getOpcionesComunidad()
      : [{ value: 'andalucia', label: 'Andalucía' }, { value: 'extremadura', label: 'Extremadura' }];
    const especiesAutorizables = window.ComunidadesService
      ? window.ComunidadesService.getEspeciesAutorizables()
      : ['Bovino', 'Ovino', 'Caprino', 'Porcino', 'Equino', 'Avícola', 'Apícola'];

    const wizardSteps = [
      {
        content: (data) => `
            <div class="mt-10">
              <div class="wizard-input-group">
                <label class="wizard-label">NOMBRE DE LA FINCA</label>
                <input type="text" id="w-fn-nombre" value="${data.nombre || ''}" placeholder="Ej: El Chamorro" class="wizard-input">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">PROPIETARIO / TITULAR DE LA EXPLOTACIÓN</label>
                <input type="text" id="w-fn-propietario" value="${data.propietario || ''}" placeholder="Ej: Juan Antonio Pérez" class="wizard-input">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">CÓDIGO REGA</label>
                 <input type="text" id="w-fn-rega" value="${data.codigo_REGA || ''}" placeholder="ES210050001234" class="wizard-input input-rega-std" maxlength="14">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">COMUNIDAD AUTÓNOMA</label>
                <select id="w-fn-ccaa" class="wizard-input wizard-select">
                  <option value="">— Seleccionar —</option>
                  ${opcionesCCAA.map(o =>
                    `<option value="${o.value}" ${data.comunidad_autonoma === o.value ? 'selected' : ''}>${o.label}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="grid grid-cols-2 gap-8">
                <div class="wizard-input-group">
                  <label class="wizard-label">SUPERFICIE TOTAL (HA)</label>
                  <input type="number" step="0.01" id="w-fn-superficie" value="${data.superficie_total || ''}" placeholder="Ej: 120.5" class="wizard-input font-800">
                </div>
                <div class="wizard-input-group">
                  <label class="wizard-label">COORDENADAS / SIGPAC</label>
                  <input type="text" id="w-fn-coordenadas" value="${data.coordenadas || ''}" placeholder="Ej: 37.8882, -4.7794" class="wizard-input">
                </div>
              </div>

              <div class="wizard-input-group mt-10">
                <label class="wizard-label">ESPECIES AUTORIZADAS</label>
                <div class="flex flex-wrap gap-8 p-10 bg-darker rounded border-333 mt-6">
                  ${especiesAutorizables.map(e => {
                    const checked = (data.especies_autorizadas || []).includes(e) ? 'checked' : '';
                    return `
                      <label class="flex items-center gap-6 text-xs text-gray-300 cursor-pointer">
                        <input type="checkbox" name="w-fn-especies-chk" value="${e}" ${checked} class="w-auto accent-neon">
                        ${e}
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>

              <div class="wizard-input-group mt-10">
                <label class="wizard-label">TIPO DE EXPLOTACIÓN DE ESTA FINCA</label>
                <div class="flex flex-col gap-6 mt-6">
                  <label class="flex items-center gap-3 text-sm text-white cursor-pointer bg-black border border-222 p-10 rounded-sm">
                    <input type="checkbox" id="w-fn-flag-leche" ${data.flag_leche ? 'checked' : ''} class="w-auto accent-neon">
                    <span>${Icons.leche()} Lácteo</span>
                  </label>
                  <label class="flex items-center gap-3 text-sm text-white cursor-pointer bg-black border border-222 p-10 rounded-sm">
                    <input type="checkbox" id="w-fn-flag-carne" ${data.flag_carne ? 'checked' : ''} class="w-auto accent-neon">
                    <span>${Icons.carne()} Cárnico</span>
                  </label>
                </div>
                <p class="text-xs text-aaa mt-4">Cada finca tiene su propio tipo de explotación. Puedes cambiarlo luego en Ajustes. Debe permanecer al menos uno activo.</p>
              </div>

              <div class="text-xs text-gray-500 mt-8 p-10 rounded-sm bg-darker flex items-center gap-6">
                ${Icons.info()} Puedes completar los datos de ADSG, contrato lácteo y normativa desde Ajustes &gt; Editar Finca.
              </div>
            </div>
          `,
        onChange: async (data) => {
          data.nombre = document.getElementById('w-fn-nombre')?.value.trim() || data.nombre;
          data.propietario = document.getElementById('w-fn-propietario')?.value.trim() || data.propietario;
          data.codigo_REGA = document.getElementById('w-fn-rega')?.value.trim() || data.codigo_REGA;
          data.comunidad_autonoma = document.getElementById('w-fn-ccaa')?.value || data.comunidad_autonoma;
          const supVal = document.getElementById('w-fn-superficie')?.value;
          data.superficie_total = supVal !== undefined && supVal !== '' ? Number(supVal) : data.superficie_total;
          data.coordenadas = document.getElementById('w-fn-coordenadas')?.value.trim() ?? data.coordenadas;

          const chks = document.querySelectorAll('input[name="w-fn-especies-chk"]:checked');
          data.especies_autorizadas = Array.from(chks).map(el => el.value);

          data.flag_leche = document.getElementById('w-fn-flag-leche')?.checked ?? data.flag_leche;
          data.flag_carne = document.getElementById('w-fn-flag-carne')?.checked ?? data.flag_carne;
        },
        validate: async (data) => {
          if (!data.nombre) {
            App.toastError("El nombre de la finca es obligatorio");
            return false;
          }
          if (!data.propietario) {
            App.toastError("El nombre del propietario/titular es obligatorio");
            return false;
          }
          if (!data.flag_leche && !data.flag_carne) {
            App.toastError("Selecciona al menos un tipo de explotación (Lácteo y/o Cárnico)");
            return false;
          }
          return true;
        }
      }
    ];

    const { onComplete, onCancel } = options;
    window.WizardManager.create({
      id: 'wizard-nueva-finca',
      title: 'NUEVA FINCA',
      initialData: { nombre: '', propietario: '', codigo_REGA: '', comunidad_autonoma: '', especies_autorizadas: [], superficie_total: '', coordenadas: '', flag_leche: true, flag_carne: false },
      steps: wizardSteps,
      onComplete: onComplete || (async (finalData) => {
        try {
          await Fincas.save(finalData);
          App.toast("Finca creada");
          if (typeof App.updateNavigationMenu === 'function') await App.updateNavigationMenu();
          App.renderAjustes();
        } catch (e) {
          App.toastError(e.message);
        }
      }),
      onCancel
    });
  },

  async editar() {
    const App = window.App;
    if (!App) return console.error("App no disponible");

    const finca = await window.Fincas.getActive();
    if (!finca) return;

    // Obtener flags actuales de modo (Leche/Carne)
    const currentFlags = window.ModoContextoHelper ? window.ModoContextoHelper.getFlags(finca.id) : null;
    const initialData = {
      ...finca,
      flag_leche: currentFlags ? !!currentFlags.leche : true,
      flag_carne: currentFlags ? !!currentFlags.carne : false
    };

    const opcionesCCAA = window.ComunidadesService
      ? window.ComunidadesService.getOpcionesComunidad()
      : [{ value: 'andalucia', label: 'Andalucía' }, { value: 'extremadura', label: 'Extremadura' }];
    const tiposExpl = window.ComunidadesService ? window.ComunidadesService.TIPOS_EXPLOTACION : ['carne', 'leche', 'mixto', 'ibérico'];
    const sistemasExpl = window.ComunidadesService ? window.ComunidadesService.SISTEMAS_EXPLOTACION : ['intensivo', 'extensivo', 'semiextensivo'];
    const especiesAutorizables = window.ComunidadesService
      ? window.ComunidadesService.getEspeciesAutorizables()
      : ['Bovino', 'Ovino', 'Caprino', 'Porcino', 'Equino', 'Avícola', 'Apícola'];

    const wizardSteps = [
      // PASO 1: Datos generales + ADSG
      {
        content: (data) => `
            <div class="mt-10">
              <div class="wizard-input-group"><label class="wizard-label">NOMBRE DE LA FINCA</label><input type="text" id="w-f-nombre" value="${data.nombre || ''}" class="wizard-input"></div>
              <div class="wizard-input-group"><label class="wizard-label">PROPIETARIO / TITULAR DE LA EXPLOTACIÓN</label><input type="text" id="w-f-propietario" value="${data.propietario || ''}" class="wizard-input"></div>
              <div class="grid grid-cols-2 gap-8">
                <div class="wizard-input-group"><label class="wizard-label">CÓDIGO REGA</label><input type="text" id="w-f-rega" value="${data.codigo_REGA || ''}" placeholder="ES210050001234" class="wizard-input input-rega-std" maxlength="14"></div>
                <div class="wizard-input-group"><label class="wizard-label">CÓDIGO CEA</label><input type="text" id="w-f-cea" value="${data.cea || ''}" placeholder="ES21005000" class="wizard-input uppercase"></div>
              </div>
              <div class="grid grid-cols-2 gap-8">
                <div class="wizard-input-group"><label class="wizard-label">NIF / CIF</label><input type="text" id="w-f-nif" value="${data.nif_cif || ''}" class="wizard-input"></div>
                <div class="wizard-input-group"><label class="wizard-label">TELÉFONO CONTACTO</label><input type="tel" id="w-f-telefono" value="${data.telefonoContacto || ''}" class="wizard-input"></div>
              </div>
              <div class="grid grid-cols-2 gap-8">
                <div class="wizard-input-group"><label class="wizard-label">DIRECCIÓN POSTAL</label><input type="text" id="w-f-dir" value="${data.direccion || ''}" class="wizard-input"></div>
                <div class="wizard-input-group"><label class="wizard-label">CAPACIDAD MÁXIMA (CAB.)</label><input type="number" id="w-f-capacidad" value="${data.capacidad_maxima || ''}" placeholder="Ej: 500" class="wizard-input font-800"></div>
              </div>

              <hr class="border-333 my-16">
              <h4 class="text-gold text-sm mt-0 mb-12 flex items-center gap-6">${Icons.zonas()} Configuración Autonómica</h4>

              <div class="wizard-input-group"><label class="wizard-label">COMUNIDAD AUTÓNOMA</label>
                <select id="w-f-ccaa" class="wizard-input wizard-select">
                  <option value="">— Seleccionar —</option>
                  ${opcionesCCAA.map(o =>
                    `<option value="${o.value}" ${data.comunidad_autonoma === o.value ? 'selected' : ''}>${o.label}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="grid grid-cols-2 gap-8">
                <div class="wizard-input-group"><label class="wizard-label">TIPO EXPLOTACIÓN (SIGGAN)</label>
                  <select id="w-f-tipo" class="wizard-input wizard-select">
                    ${tiposExpl.map(t =>
                      `<option value="${t}" ${data.tipo_explotacion === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="wizard-input-group"><label class="wizard-label">SISTEMA</label>
                  <select id="w-f-sist" class="wizard-input wizard-select">
                    ${sistemasExpl.map(s =>
                      `<option value="${s}" ${data.sistema_explotacion === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
                    ).join('')}
                  </select>
                </div>
              </div>

              <div class="wizard-input-group mt-10">
                <label class="wizard-label">MODO DE EXPLOTACIÓN (VISIBILIDAD MÓDULOS)</label>
                <div class="flex flex-col gap-6 mt-6">
                  <label class="flex items-center gap-3 text-sm text-white cursor-pointer bg-black border border-222 p-10 rounded-sm">
                    <input type="checkbox" id="w-f-flag-leche" ${data.flag_leche ? 'checked' : ''} class="w-auto accent-neon">
                    <span>${Icons.leche()} Lácteo</span>
                  </label>
                  <label class="flex items-center gap-3 text-sm text-white cursor-pointer bg-black border border-222 p-10 rounded-sm">
                    <input type="checkbox" id="w-f-flag-carne" ${data.flag_carne ? 'checked' : ''} class="w-auto accent-neon">
                    <span>${Icons.carne()} Cárnico</span>
                  </label>
                </div>
                <p class="text-xs text-aaa mt-4">Active uno o ambos tipos según la producción. Los módulos ocultarán todo lo relativo al tipo desactivado. Debe permanecer al menos uno activo.</p>
              </div>

              <div class="grid grid-cols-2 gap-8">
                <div class="wizard-input-group"><label class="wizard-label">CALIFICACIÓN SANITARIA</label>
                  <select id="w-f-calif" class="wizard-input wizard-select">
                    <option value="sin_calificar" ${data.calificacion_sanitaria === 'sin_calificar' ? 'selected' : ''}>Sin calificar</option>
                    <option value="indemne" ${data.calificacion_sanitaria === 'indemne' ? 'selected' : ''}>Oficialmente indemne (T3/M3/B4)</option>
                    <option value="calificada" ${data.calificacion_sanitaria === 'calificada' ? 'selected' : ''}>Calificada</option>
                    <option value="en_proceso" ${data.calificacion_sanitaria === 'en_proceso' ? 'selected' : ''}>En proceso</option>
                    <option value="positiva" ${data.calificacion_sanitaria === 'positiva' ? 'selected' : ''}>Con positivos</option>
                  </select>
                </div>
                <div class="wizard-input-group"><label class="wizard-label">GUÍA 365 DÍAS (SANEADA)</label>
                  <select id="w-f-guia365" class="wizard-input wizard-select">
                    <option value="false" ${data.guia_365_habilitada !== true ? 'selected' : ''}>Inactiva / No autorizada</option>
                    <option value="true" ${data.guia_365_habilitada === true ? 'selected' : ''}>Activa / Autorizada</option>
                  </select>
                </div>
              </div>

              <div class="wizard-input-group mt-10">
                <label class="wizard-label">ESPECIES AUTORIZADAS</label>
                <div class="flex flex-wrap gap-8 p-10 bg-darker rounded border-333 mt-6">
                  ${especiesAutorizables.map(e => {
                    const checked = (data.especies_autorizadas || []).includes(e) ? 'checked' : '';
                    return `
                      <label class="flex items-center gap-6 text-xs text-gray-300 cursor-pointer">
                        <input type="checkbox" name="w-f-especies-chk" value="${e}" ${checked} class="w-auto accent-neon">
                        ${e}
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>

              <div class="wizard-input-group mt-10">
                <label class="flex items-center gap-8 text-sm text-white cursor-pointer bg-black border border-222 p-10 rounded-sm">
                  <input type="checkbox" id="w-f-lidia" ${data.explotacion_lidia ? 'checked' : ''} class="w-auto accent-neon">
                  <span>Explotación de Lidia (ganado de toro bravo)</span>
                </label>
                <p class="text-xs text-aaa mt-4">Clasificación SIGGAN (Bovino &gt; Filiaciones). Solo etiqueta esta finca; no cambia censos, movimientos ni sanidad.</p>
              </div>

              <hr class="border-333 my-16">
              <h4 class="text-red text-sm mt-0 mb-12 flex items-center gap-6">${Icons.sanidad()} ADSG (Agrupación Defensa Sanitaria)</h4>

              <div class="wizard-input-group"><label class="wizard-label">NOMBRE ADSG</label><input type="text" id="w-f-adsg" value="${data.adsg_nombre || ''}" placeholder="Agrupación Defensa..." class="wizard-input"></div>
              <div class="wizard-input-group"><label class="wizard-label">CÓDIGO ADSG</label><input type="text" id="w-f-adsg-cod" value="${data.adsg_codigo || ''}" class="wizard-input"></div>
              <div class="grid grid-cols-2 gap-8">
                <div class="wizard-input-group"><label class="wizard-label">VETERINARIO ADSG</label><input type="text" id="w-f-adsg-vet" value="${data.adsg_veterinario || ''}" class="wizard-input"></div>
                <div class="wizard-input-group"><label class="wizard-label">Nº COLEGIADO</label><input type="text" id="w-f-adsg-col" value="${data.adsg_vet_colegiado || ''}" class="wizard-input"></div>
              </div>
              <div class="wizard-input-group"><label class="wizard-label">TELÉFONO VETERINARIO</label><input type="tel" id="w-f-adsg-tel" value="${data.adsg_vet_telefono || ''}" class="wizard-input"></div>
              <div class="wizard-input-group"><label class="wizard-label">NIF VETERINARIO</label><input type="text" id="w-f-adsg-nif" value="${data.adsg_vet_nif || ''}" class="wizard-input"></div>
              <div class="wizard-input-group"><label class="wizard-label">FECHA VENCIMIENTO ADSG</label><input type="date" id="w-f-adsg-fin" value="${data.adsg_fecha_vencimiento || ''}" class="wizard-input"></div>
              <div class="wizard-input-group"><label class="wizard-label">EMAIL ADSG / GESTOR</label><input type="email" id="w-f-email" value="${data.email || ''}" class="wizard-input"></div>
            </div>
          `,
        onChange: async (data) => {
          data.nombre = document.getElementById('w-f-nombre')?.value.trim() || data.nombre;
          data.propietario = document.getElementById('w-f-propietario')?.value.trim() || data.propietario;
          data.codigo_REGA = document.getElementById('w-f-rega')?.value.trim() || data.codigo_REGA;
          data.cea = document.getElementById('w-f-cea')?.value.trim() || data.cea || '';
          data.nif_cif = document.getElementById('w-f-nif')?.value.trim() || data.nif_cif;
          data.telefonoContacto = document.getElementById('w-f-telefono')?.value.trim() || data.telefonoContacto || '';
          data.direccion = document.getElementById('w-f-dir')?.value.trim() || data.direccion;
          const capVal = document.getElementById('w-f-capacidad')?.value;
          data.capacidad_maxima = capVal ? parseInt(capVal, 10) : '';
          data.comunidad_autonoma = document.getElementById('w-f-ccaa')?.value || data.comunidad_autonoma;
          data.tipo_explotacion = document.getElementById('w-f-tipo')?.value || data.tipo_explotacion;
          data.sistema_explotacion = document.getElementById('w-f-sist')?.value || data.sistema_explotacion;
          data.calificacion_sanitaria = document.getElementById('w-f-calif')?.value || data.calificacion_sanitaria || 'sin_calificar';
          data.guia_365_habilitada = document.getElementById('w-f-guia365')?.value === 'true';

          const chks = document.querySelectorAll('input[name="w-f-especies-chk"]:checked');
          data.especies_autorizadas = Array.from(chks).map(el => el.value);

          data.explotacion_lidia = document.getElementById('w-f-lidia')?.checked ?? data.explotacion_lidia ?? false;
          data.flag_leche = document.getElementById('w-f-flag-leche')?.checked ?? data.flag_leche;
          data.flag_carne = document.getElementById('w-f-flag-carne')?.checked ?? data.flag_carne;

          data.adsg_nombre = document.getElementById('w-f-adsg')?.value.trim() || data.adsg_nombre;
          data.adsg_codigo = document.getElementById('w-f-adsg-cod')?.value.trim() || data.adsg_codigo;
          data.adsg_veterinario = document.getElementById('w-f-adsg-vet')?.value.trim() || data.adsg_veterinario;
          data.adsg_vet_colegiado = document.getElementById('w-f-adsg-col')?.value.trim() || data.adsg_vet_colegiado;
          data.adsg_vet_telefono = document.getElementById('w-f-adsg-tel')?.value.trim() || data.adsg_vet_telefono;
          data.adsg_vet_nif = document.getElementById('w-f-adsg-nif')?.value.trim() || data.adsg_vet_nif;
          data.adsg_fecha_vencimiento = document.getElementById('w-f-adsg-fin')?.value || data.adsg_fecha_vencimiento;
          data.email = document.getElementById('w-f-email')?.value.trim() || data.email;
        },
        validate: async (data) => {
          if (!data.nombre) { App.toastError("El nombre es obligatorio"); return false; }
          if (!data.propietario) { App.toastError("El propietario/titular es obligatorio"); return false; }
          if (!data.flag_leche && !data.flag_carne) {
            App.toastError("Selecciona al menos un tipo de explotación (Lácteo y/o Cárnico)");
            return false;
          }
          return true;
        }
      },
      // PASO 2: Contrato lácteo y Paquete Lácteo
      {
        content: (data) => `
            <div class="mt-10">
              <h4 class="text-yellow text-sm mt-0 mb-12 flex items-center gap-6">${Icons.leche()} Paquete Lácteo — Contrato Obligatorio</h4>
              <p class="text-gray text-xs mb-14">
                El Paquete Lácteo exige un contrato escrito con el comprador por un período mínimo de 1 año.
              </p>
              <div class="wizard-input-group"><label class="wizard-label">Nº CONTRATO LÁCTEO</label><input type="text" id="w-f-cl-num" value="${data.contrato_lacteo_numero || ''}" class="wizard-input"></div>
              <div class="grid grid-cols-2 gap-8">
                <div class="wizard-input-group"><label class="wizard-label">FECHA FIN CONTRATO</label><input type="date" id="w-f-cl-fin" value="${data.contrato_lacteo_fecha_fin || ''}" class="wizard-input"></div>
                <div class="wizard-input-group"><label class="wizard-label">COMPRADOR</label><input type="text" id="w-f-cl-comp" value="${data.contrato_lacteo_comprador || ''}" placeholder="Industria/Cooperativa" class="wizard-input"></div>
              </div>

              <hr class="border-333 my-16">
              <h4 class="text-blue text-sm mt-0 mb-12">${Icons.grafico()} INFOLAC — Declaraciones Mensuales</h4>
              <div class="wizard-input-group"><label class="wizard-label">Nº INFOLAC (si aplica)</label><input type="text" id="w-f-infolac" value="${data.numero_infolac || ''}" placeholder="INFOLAC-AAAA-MM-NNN" class="wizard-input"></div>

              <hr class="border-333 my-16">
              <div class="bg-darker border-muted rounded p-14">
                <p class="text-2xs text-gray-500 flex items-center gap-6 m-0">
                  ${Icons.info()} <strong>¿No tienes contrato lácteo?</strong> Si produces leche pero no has formalizado contrato,
                  el Paquete Lácteo te obliga a hacerlo. Consulta la guía en Ajustes &gt; Paquete Lácteo.
                </p>
              </div>
            </div>
          `,
        onChange: async (data) => {
          data.contrato_lacteo_numero = document.getElementById('w-f-cl-num')?.value.trim() || data.contrato_lacteo_numero;
          data.contrato_lacteo_fecha_fin = document.getElementById('w-f-cl-fin')?.value || data.contrato_lacteo_fecha_fin;
          data.contrato_lacteo_comprador = document.getElementById('w-f-cl-comp')?.value.trim() || data.contrato_lacteo_comprador;
          data.numero_infolac = document.getElementById('w-f-infolac')?.value.trim() || data.numero_infolac;
        },
        validate: async (data) => {
          if ((data.tipo_explotacion === 'leche' || data.tipo_explotacion === 'mixto') && !data.contrato_lacteo_numero) {
            App.toast('INFO: Recuerda formalizar el contrato lácteo obligatorio.');
          }
          return true;
        }
      },
      // PASO 3: Instalaciones Lácteas y Normativa (v24) — Solo si flag_leche === true
      {
        content: (data) => {
          const clasificaciones = window.ComunidadesService ? window.ComunidadesService.getClasificacionZootecnicaLetraQ() : [];
          const clasifOptions = clasificaciones.map(c => `<option value="${c.value}" ${data.clasificacion_zootecnica_leche === c.value ? 'selected' : ''}>${c.label}</option>`).join('');
          
          return `
            <div class="mt-10">
              <h4 class="text-blue text-sm mt-0 mb-12 flex items-center gap-6">${Icons.leche()} Instalaciones Lácteas y Normativa (Letra Q)</h4>
              <p class="text-gray text-xs mb-14">
                Configura los datos de tu explotación láctea para cumplir con la normativa de trazabilidad Letra Q y bienestar animal.
              </p>

              <div class="bg-darker border-blue rounded p-14 mb-16">
                <h5 class="text-blue text-xs font-900 mb-10">TRAZABILIDAD LETRA Q</h5>
                <div class="wizard-input-group mb-12">
                  <label class="wizard-label">CÓDIGO LETRA Q DE LA FINCA *</label>
                  <input type="text" id="w-f-letraq" value="${data.codigo_letra_q || ''}" placeholder="T-21-00123" class="wizard-input uppercase font-900" style="border:1px solid var(--c-info);">
                  <div class="text-2xs text-gray-500 mt-4">Código oficial del titular en el Registro General de Agentes del Sector Lácteo (MAPA)</div>
                </div>
                <div class="wizard-input-group">
                  <label class="wizard-label">CLASIFICACIÓN ZOOTÉCNICA LÁCTEA *</label>
                  <select id="w-f-clasif" class="wizard-input font-800">
                    <option value="">— SELECCIONAR —</option>
                    ${clasifOptions}
                  </select>
                  <div class="text-2xs text-gray-500 mt-4">Solo las compatibles con Letra Q permiten comercializar leche</div>
                </div>
              </div>

              <div class="bg-darker border-muted rounded p-14 mb-16">
                <h5 class="text-yellow text-xs font-900 mb-10">INSTALACIONES Y BIENESTAR ANIMAL</h5>
                <div class="grid grid-cols-2 gap-10 mb-12">
                  <div class="wizard-input-group">
                    <label class="wizard-label">PLAZAS VACUNO LECHE</label>
                    <input type="number" id="w-f-plazas" value="${data.plazas_vacuno_leche || ''}" min="0" max="10000" class="wizard-input font-800">
                    <div class="text-2xs text-gray-500 mt-4">Plazas autorizadas en sala de ordeño</div>
                  </div>
                  <div class="wizard-input-group">
                    <label class="wizard-label">NÚMERO DE CUBÍCULOS</label>
                    <input type="number" id="w-f-cubiculos" value="${data.num_cubiculos || ''}" min="0" class="wizard-input font-800">
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-10">
                  <div class="wizard-input-group">
                    <label class="wizard-label">SUPERFICIE DESCANSO (m²)</label>
                    <input type="number" id="w-f-superficie" value="${data.superficie_descanso_m2 || ''}" min="0" class="wizard-input font-800">
                    <div class="text-2xs text-gray-500 mt-4">Referencia: 5-6 m²/vaca</div>
                  </div>
                  <div class="wizard-input-group">
                    <label class="wizard-label">METROS LINEALES COMEDERO (cm)</label>
                    <input type="number" id="w-f-comedero" value="${data.metros_lineales_comedero || ''}" min="0" class="wizard-input font-800">
                    <div class="text-2xs text-gray-500 mt-4">Referencia: 60-70 cm/vaca</div>
                  </div>
                </div>
              </div>

              <div class="bg-darker border-red rounded p-14 mb-16" id="w-f-ambiental-section" style="display:none;">
                <h5 class="text-red text-xs font-900 mb-10">MEDIO AMBIENTE (>300 plazas)</h5>
                <div class="wizard-input-group mb-12">
                  <label class="wizard-label">CAPACIDAD BALSA PURINES (m³)</label>
                  <input type="number" id="w-f-balsa" value="${data.capacidad_balsa_purines_m3 || ''}" min="0" class="wizard-input font-800">
                  <div class="text-2xs text-gray-500 mt-4">Obligatoria para explotaciones >300 plazas</div>
                </div>
                <label class="flex items-center gap-10 text-xs text-white cursor-pointer">
                  <input type="checkbox" id="w-f-evalamb" ${data.tiene_evaluacion_ambiental ? 'checked' : ''} style="accent-color:var(--c-danger);">
                  <span class="uppercase font-900 text-2xs">DISPONE DE EVALUACIÓN AMBIENTAL</span>
                </label>
              </div>

              <div class="bg-darker border-muted rounded p-14">
                <p class="text-2xs text-gray-500 flex items-center gap-6 m-0">
                  ${Icons.info()} <strong>Referencia normativa:</strong> RD 1728/2007, Reg. CE 853/2004, Manual Sector Lácteo Andalucía (MAPA).
                </p>
              </div>
            </div>
          `;
        },
        onChange: async (data) => {
          data.codigo_letra_q = document.getElementById('w-f-letraq')?.value.trim().toUpperCase() || data.codigo_letra_q;
          data.clasificacion_zootecnica_leche = document.getElementById('w-f-clasif')?.value || data.clasificacion_zootecnica_leche;
          data.plazas_vacuno_leche = parseInt(document.getElementById('w-f-plazas')?.value) || data.plazas_vacuno_leche;
          data.num_cubiculos = parseInt(document.getElementById('w-f-cubiculos')?.value) || data.num_cubiculos;
          data.superficie_descanso_m2 = parseFloat(document.getElementById('w-f-superficie')?.value) || data.superficie_descanso_m2;
          data.metros_lineales_comedero = parseFloat(document.getElementById('w-f-comedero')?.value) || data.metros_lineales_comedero;
          data.capacidad_balsa_purines_m3 = parseFloat(document.getElementById('w-f-balsa')?.value) || data.capacidad_balsa_purines_m3;
          data.tiene_evaluacion_ambiental = document.getElementById('w-f-evalamb')?.checked || false;

          // Mostrar/ocultar sección ambiental según plazas
          const plazas = parseInt(document.getElementById('w-f-plazas')?.value) || 0;
          const ambientalSection = document.getElementById('w-f-ambiental-section');
          if (ambientalSection) {
            ambientalSection.style.display = plazas > 300 ? 'block' : 'none';
          }
        },
        validate: async (data) => {
          // Solo validar si es explotación láctea
          if (data.flag_leche || data.tipo_explotacion === 'leche' || data.tipo_explotacion === 'mixto') {
            if (data.codigo_letra_q && !/^[A-Z0-9\-]{3,20}$/.test(data.codigo_letra_q)) {
              App.toast('Código Letra Q inválido. Formato: T-PP-NNNNN (3-20 caracteres alfanuméricos)');
              return false;
            }
            if (data.plazas_vacuno_leche > 300 && !data.capacidad_balsa_purines_m3) {
              App.toast('Explotación >300 plazas: registre capacidad de balsa de purines', 'warning');
            }
            if (data.plazas_vacuno_leche > 300 && !data.tiene_evaluacion_ambiental) {
              App.toast('Explotación >300 plazas: confirme evaluación ambiental', 'warning');
            }
          }
          return true;
        }
      }
    ];
    window.WizardManager.create({
      id: 'wizard-editar-finca', title: 'EDITAR FINCA', initialData: initialData, steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          await window.Fincas.save(finalData);
          App.toast("Finca actualizada");
          if (typeof App.updateNavigationMenu === 'function') await App.updateNavigationMenu();
          App.updateHeader();
          App.renderAjustes();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  }
};
