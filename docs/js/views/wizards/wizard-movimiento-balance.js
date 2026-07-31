/**
 * Wizard de Alta de Movimiento Manual de Balance Lácteo
 * Módulo Lácteo Integral (v24) — Fase 4 FAB
 */
window.MovimientoBalanceWizard = {
  async open() {
    const App = window.App;
    if (!App) return console.error("App no disponible");

    const fincaId = await window.Fincas.getActiveId();
    const tanques = window.TanquesLeche ? await window.TanquesLeche.getActivos(fincaId) : [];

    if (tanques.length === 0) {
      App.toastError('Registra un tanque antes de crear un movimiento de balance');
      return;
    }

    const wizardSteps = [
      {
        content: (data) => `
          <div class="card card-accent card-accent-gold p-16 mt-10 mb-16">
            <div class="section-header-theme mb-12" style="--theme-color: var(--p-gold)">NUEVO MOVIMIENTO DE BALANCE</div>

            <div class="wizard-input-group mb-12">
              <label class="wizard-label">TANQUE</label>
              <select id="w-mb-tanque" class="wizard-input font-800 text-xs">
                ${tanques.map(t => `<option value="${t.id}" ${data.tanqueId == t.id ? 'selected' : ''}>${t.nombre} (${t.codigo_letra_q})</option>`).join('')}
              </select>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">TIPO MOVIMIENTO</label>
                <select id="w-mb-tipo" class="wizard-input font-800 text-xs">
                  <option value="entrada" ${data.tipo_movimiento === 'entrada' ? 'selected' : ''}>ENTRADA</option>
                  <option value="salida" ${data.tipo_movimiento === 'salida' ? 'selected' : ''}>SALIDA</option>
                  <option value="merma" ${data.tipo_movimiento === 'merma' ? 'selected' : ''}>MERMA</option>
                  <option value="ajuste" ${data.tipo_movimiento === 'ajuste' ? 'selected' : ''}>AJUSTE (STOCK ABSOLUTO)</option>
                </select>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">${data.tipo_movimiento === 'ajuste' ? 'NUEVO STOCK (LITROS)' : 'CANTIDAD (LITROS)'}</label>
                <input type="number" id="w-mb-cant" value="${data.cantidad_litros}" min="0" step="0.1" class="wizard-input border-green font-950 text-xl text-green">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">FECHA</label>
                <input type="date" id="w-mb-fecha" value="${data.fecha}" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">TEMPERATURA (°C)</label>
                <input type="number" id="w-mb-temp" value="${data.temperatura}" step="0.1" class="wizard-input font-800">
              </div>
            </div>

            <div class="wizard-input-group mb-12">
              <label class="wizard-label">OBSERVACIONES</label>
              <textarea id="w-mb-obs" class="wizard-input font-700 text-xs" rows="2">${data.observaciones || ''}</textarea>
            </div>
          </div>`,
        onChange: (data) => {
          data.tanqueId = parseInt(document.getElementById('w-mb-tanque')?.value) || null;
          data.tipo_movimiento = document.getElementById('w-mb-tipo')?.value || 'entrada';
          data.cantidad_litros = document.getElementById('w-mb-cant')?.value || '';
          data.fecha = document.getElementById('w-mb-fecha')?.value || '';
          data.temperatura = document.getElementById('w-mb-temp')?.value || '';
          data.observaciones = document.getElementById('w-mb-obs')?.value.trim() || '';
        },
        validate: (data) => {
          if (!data.tanqueId) { App.toastError("Selecciona un tanque"); return false; }
          const cantidad = parseFloat(data.cantidad_litros);
          if (data.tipo_movimiento !== 'ajuste' && !(cantidad > 0)) {
            App.toastError("La cantidad debe ser mayor que 0");
            return false;
          }
          if (data.tipo_movimiento === 'ajuste' && !(cantidad >= 0)) {
            App.toastError("El nuevo stock no puede ser negativo");
            return false;
          }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-movimiento-balance-nuevo',
      title: 'NUEVO MOVIMIENTO',
      initialData: {
        tanqueId: tanques[0].id,
        tipo_movimiento: 'entrada',
        cantidad_litros: '',
        fecha: new Date().toISOString().split('T')[0],
        temperatura: '',
        observaciones: '',
      },
      steps: wizardSteps,
      onComplete: async (dataMov) => {
        try {
          await window.BalanceLacteo.registrar({
            ...dataMov,
            fincaId,
            referencia_tipo: 'manual',
          });
          App.toast('Movimiento registrado', 'success');
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  }
};
