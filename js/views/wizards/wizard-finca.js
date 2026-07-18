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
                <div class="wizard-input-group"><label class="wizard-label">TIPO EXPLOTACIÓN</label>
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
      }
    ];
    window.WizardManager.create({
      id: 'wizard-editar-finca', title: 'EDITAR FINCA', initialData: finca, steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          await window.Fincas.save(finalData);
          App.toast("Finca actualizada");
          App.updateHeader();
          App.renderAjustes();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  }
};
