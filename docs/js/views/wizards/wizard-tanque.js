/**
 * Wizard de Alta/Edición de Tanques de Leche
 * Módulo Lácteo Integral (v24)
 */
window.TanqueWizard = {
  async open(tanque = null) {
    const App = window.App;
    if (!App) return console.error("App no disponible");

    const fincaId = await window.Fincas.getActiveId();
    const esEdicion = !!tanque;

    const wizardSteps = [
      {
        content: async (data) => {
          return `
          <div class="card card-accent card-accent-gold p-16 mt-10 mb-16">
            <div class="section-header-theme mb-12" style="--theme-color: var(--p-gold)">${esEdicion ? 'EDITAR' : 'NUEVO'} TANQUE DE LECHE</div>
            
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">NOMBRE DEL TANQUE</label>
              <input type="text" id="w-t-nombre" value="${data.nombre}" placeholder="TANQUE PRINCIPAL..." class="wizard-input uppercase font-900 text-lg">
            </div>

            <div class="wizard-input-group mb-12">
              <label class="wizard-label">CÓDIGO LETRA Q *</label>
              <input type="text" id="w-t-letraq" value="${data.codigo_letra_q}" placeholder="EJ: T-14-00123" class="wizard-input uppercase font-900 text-lg" style="border:1px solid var(--c-info);">
              <div class="text-[0.55rem] text-aaa font-700 mt-4">Código oficial del contenedor en el Registro General de Agentes del Sector Lácteo (MAPA)</div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">CAPACIDAD (LITROS)</label>
                <input type="number" id="w-t-cap" value="${data.capacidad_litros || ''}" placeholder="6000" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">TIPO</label>
                <select id="w-t-tipo" class="wizard-input font-800 text-xs">
                  <option value="tanque_frio" ${data.tipo === 'tanque_frio' ? 'selected' : ''}>TANQUE DE FRÍO</option>
                  <option value="cantara" ${data.tipo === 'cantara' ? 'selected' : ''}>CÁNTARA</option>
                  <option value="cisterna" ${data.tipo === 'cisterna' ? 'selected' : ''}>CISTERNA</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">TEMP. OBJETIVO (°C)</label>
                <input type="number" id="w-t-temp-obj" value="${data.temperatura_objetivo || 4}" step="0.5" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">TEMP. ACTUAL (°C)</label>
                <input type="number" id="w-t-temp-act" value="${data.temperatura_actual || ''}" step="0.1" class="wizard-input font-800">
              </div>
            </div>

            <div class="wizard-input-group mb-12">
              <label class="wizard-label">OBSERVACIONES</label>
              <textarea id="w-t-obs" class="wizard-input font-700 text-xs" rows="2">${data.observaciones || ''}</textarea>
            </div>
          </div>`;
        },
        onChange: async (data) => {
          data.nombre = document.getElementById('w-t-nombre')?.value.trim() || '';
          data.codigo_letra_q = document.getElementById('w-t-letraq')?.value.trim() || '';
          data.capacidad_litros = parseFloat(document.getElementById('w-t-cap')?.value) || 0;
          data.tipo = document.getElementById('w-t-tipo')?.value || 'tanque_frio';
          data.temperatura_objetivo = parseFloat(document.getElementById('w-t-temp-obj')?.value) || 4;
          data.temperatura_actual = parseFloat(document.getElementById('w-t-temp-act')?.value) || null;
          data.observaciones = document.getElementById('w-t-obs')?.value.trim() || '';
        },
        validate: async (data) => {
          if (!data.nombre) { App.toastError("El nombre es obligatorio"); return false; }
          if (!data.codigo_letra_q) { App.toastError("El código Letra Q es obligatorio"); return false; }
          if (data.codigo_letra_q.length < 3) { App.toastError("Código Letra Q demasiado corto"); return false; }
          if (window.TanquesLeche) {
            const otro = await window.TanquesLeche.getByCodigoLetraQ(data.codigo_letra_q.trim().toUpperCase());
            if (otro && (!esEdicion || otro.id !== tanque.id)) {
              App.toastError(`Ya existe un tanque con código Letra Q: ${data.codigo_letra_q}`);
              return false;
            }
          }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: `wizard-tanque-${tanque ? tanque.id : 'nuevo'}`,
      title: esEdicion ? 'EDITAR TANQUE' : 'NUEVO TANQUE',
      initialData: {
        nombre: tanque ? tanque.nombre : '',
        codigo_letra_q: tanque ? tanque.codigo_letra_q : '',
        capacidad_litros: tanque ? tanque.capacidad_litros : '',
        tipo: tanque ? tanque.tipo : 'tanque_frio',
        temperatura_objetivo: tanque ? tanque.temperatura_objetivo : 4,
        temperatura_actual: tanque ? tanque.temperatura_actual : '',
        observaciones: tanque ? (tanque.observaciones || '') : '',
      },
      steps: wizardSteps,
      onComplete: async (dataTanque) => {
        try {
          if (esEdicion) {
            await window.TanquesLeche.update(tanque.id, {
              ...dataTanque,
              fincaId,
            });
            App.toast('Tanque actualizado', 'success');
          } else {
            await window.TanquesLeche.create({
              ...dataTanque,
              fincaId,
            });
            App.toast('Tanque registrado con código Letra Q', 'success');
          }
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  }
};
