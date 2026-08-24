/**
 * Wizard de Alta de Analítica de Leche (Control Lechero)
 * Módulo Lácteo Integral (v24) — Fase 4 FAB
 */
window.AnaliticaLecheWizard = {
  /** @param {Object} [analitica] Analítica existente: si viene, el asistente
   *  abre en modo edición en vez de crear una nueva. */
  async open(analitica = null) {
    const App = window.App;
    if (!App) return console.error("App no disponible");

    const fincaId = await window.Fincas.getActiveId();
    const tanques = window.TanquesLeche ? await window.TanquesLeche.getActivos(fincaId) : [];

    const esEdicion = !!(analitica && analitica.id);

    const wizardSteps = [
      {
        content: (data) => `
          <div class="card card-accent card-accent-gold p-16 mt-10 mb-16">
            <div class="section-header-theme mb-12" style="--theme-color: var(--p-gold)">${esEdicion ? 'EDITAR' : 'NUEVA'} ANALÍTICA DE LECHE</div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">FECHA MUESTREO</label>
                <input type="date" id="w-al-fecha" value="${data.fecha_muestreo}" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">ESPECIE</label>
                <select id="w-al-especie" class="wizard-input font-800 text-xs">
                  <option value="vacuno" ${data.especie === 'vacuno' ? 'selected' : ''}>VACUNO</option>
                  <option value="ovino" ${data.especie === 'ovino' ? 'selected' : ''}>OVINO</option>
                  <option value="caprino" ${data.especie === 'caprino' ? 'selected' : ''}>CAPRINO</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">TIPO MUESTREO</label>
                <select id="w-al-tipo" class="wizard-input font-800 text-xs">
                  <option value="autocontrol" ${data.tipo_muestreo === 'autocontrol' ? 'selected' : ''}>AUTOCONTROL</option>
                  <option value="oficial" ${data.tipo_muestreo === 'oficial' ? 'selected' : ''}>OFICIAL</option>
                </select>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">TANQUE</label>
                <select id="w-al-tanque" class="wizard-input font-800 text-xs">
                  <option value="">— SIN ASOCIAR —</option>
                  ${tanques.map(t => `<option value="${t.id}" ${data.tanqueId == t.id ? 'selected' : ''}>${t.nombre} (${t.codigo_letra_q})</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">GRASA (%)</label>
                <input type="number" id="w-al-grasa" value="${data.grasa}" step="0.01" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">PROTEÍNA (%)</label>
                <input type="number" id="w-al-proteina" value="${data.proteina}" step="0.01" class="wizard-input font-800">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">GÉRMENES 30°C (ufc/ml)</label>
                <input type="number" id="w-al-germenes" value="${data.germenes_30C}" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">CÉLULAS SOMÁTICAS (cel/ml)</label>
                <input type="number" id="w-al-somaticas" value="${data.celulas_somaticas}" class="wizard-input font-800">
              </div>
            </div>

            <div class="wizard-input-group mb-12">
              <label class="wizard-label">LABORATORIO</label>
              <input type="text" id="w-al-lab" value="${data.laboratorio_nombre}" placeholder="CICAP..." class="wizard-input uppercase font-800">
            </div>

            <label class="flex items-center gap-8 text-xs text-aaa cursor-pointer mb-12">
              <input type="checkbox" id="w-al-inhibidores" ${data.inhibidores ? 'checked' : ''} style="accent-color:var(--c-danger);">
              <span class="uppercase font-800 tracking-tight">INHIBIDORES / ANTIBIÓTICOS DETECTADOS</span>
            </label>
          </div>`,
        onChange: (data) => {
          data.fecha_muestreo = document.getElementById('w-al-fecha')?.value || '';
          data.especie = document.getElementById('w-al-especie')?.value || 'vacuno';
          data.tipo_muestreo = document.getElementById('w-al-tipo')?.value || 'autocontrol';
          data.tanqueId = parseInt(document.getElementById('w-al-tanque')?.value) || null;
          data.grasa = document.getElementById('w-al-grasa')?.value || '';
          data.proteina = document.getElementById('w-al-proteina')?.value || '';
          data.germenes_30C = document.getElementById('w-al-germenes')?.value || '';
          data.celulas_somaticas = document.getElementById('w-al-somaticas')?.value || '';
          data.laboratorio_nombre = document.getElementById('w-al-lab')?.value.trim().toUpperCase() || '';
          data.inhibidores = !!document.getElementById('w-al-inhibidores')?.checked;
        },
        validate: (data) => {
          if (!data.fecha_muestreo) { App.toastError("La fecha de muestreo es obligatoria"); return false; }
          return true;
        }
      }
    ];


    window.WizardManager.create({
      id: esEdicion ? 'wizard-analitica-leche-editar' : 'wizard-analitica-leche-nueva',
      title: esEdicion ? 'EDITAR ANALÍTICA' : 'NUEVA ANALÍTICA',
      initialData: esEdicion ? {
        fecha_muestreo: (analitica.fecha_muestreo || '').split('T')[0],
        especie: analitica.especie || 'vacuno',
        tipo_muestreo: analitica.tipo_muestreo || 'autocontrol',
        tanqueId: analitica.tanqueId ?? null,
        grasa: analitica.grasa ?? '',
        proteina: analitica.proteina ?? '',
        germenes_30C: analitica.germenes_30C ?? '',
        celulas_somaticas: analitica.celulas_somaticas ?? '',
        laboratorio_nombre: analitica.laboratorio_nombre || 'CICAP',
        inhibidores: !!analitica.inhibidores,
      } : {
        fecha_muestreo: new Date().toISOString().split('T')[0],
        especie: 'vacuno',
        tipo_muestreo: 'autocontrol',
        tanqueId: null,
        grasa: '',
        proteina: '',
        germenes_30C: '',
        celulas_somaticas: '',
        laboratorio_nombre: 'CICAP',
        inhibidores: false,
      },
      steps: wizardSteps,
      onComplete: async (dataAnalitica) => {
        try {
          if (esEdicion) {
            await window.AnaliticasLeche.update(analitica.id, dataAnalitica);
            App.toast('Analítica actualizada', 'success');
          } else {
            await window.AnaliticasLeche.create({
              ...dataAnalitica,
              fincaId,
            });
            App.toast('Analítica registrada', 'success');
          }
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  }
};
