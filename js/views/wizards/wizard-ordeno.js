/**
 * Wizard de Registro de Ordeño (AM/PM)
 * Módulo Lácteo Integral (v24)
 */
window.OrdeñoWizard = {
  async open() {
    const App = window.App;
    if (!App) return console.error("App no disponible");

    const finca = await window.Fincas.getActive();
    const fincaId = await window.Fincas.getActiveId();
    const tanques = window.TanquesLeche ? await window.TanquesLeche.getActivos(fincaId) : [];

    const rebanos = await window.db.getAll('rebanos').catch(() => []);
    const rebanosLeche = rebanos.filter(r => {
      const tipo = (r.tipo || '').toLowerCase();
      return tipo.includes('lech') || tipo.includes('láct') || tipo.includes('mixt');
    });

    const animales = await window.db.getAll('animales').catch(() => []);
    const animalesLeche = [];
    for (const reb of rebanosLeche) {
      const anims = animales.filter(a => Number(a.rebanoId) === Number(reb.id) && a.estado === 'activo');
      const hembras = anims.filter(a => {
        const sexo = (a.sexo || '').toString().toLowerCase();
        return sexo === 'h' || sexo === 'hembra' || sexo === 'female';
      });
      animalesLeche.push(...hembras);
    }

    const wizardSteps = [
      {
        content: async (data) => {
          return `
          <div class="card card-accent card-accent-gold p-16 mt-10 mb-16">
            <div class="section-header-theme mb-12" style="--theme-color: var(--p-gold)">1. DATOS DEL ORDEÑO</div>
            
            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">FECHA</label>
                <input type="date" id="w-o-fecha" value="${data.fecha}" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">TURNO</label>
                <select id="w-o-turno" class="wizard-input font-900 text-lg">
                  <option value="AM" ${data.turno === 'AM' ? 'selected' : ''}>MAÑANA (AM)</option>
                  <option value="PM" ${data.turno === 'PM' ? 'selected' : ''}>TARDE (PM)</option>
                </select>
              </div>
            </div>

            ${tanques.length > 0 ? `
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">TANQUE DESTINO</label>
              <select id="w-o-tanque" class="wizard-input font-800 text-xs">
                ${tanques.map(t => `<option value="${t.id}" ${data.tanqueId == t.id ? 'selected' : ''}>${t.nombre} (${t.codigo_letra_q}) — ${t.capacidad_litros}L</option>`).join('')}
              </select>
            </div>
            ` : `
            <div class="p-10 bg-black border border-red rounded-sm mb-12">
              <span class="text-red text-[0.65rem] font-900 uppercase">No hay tanques registrados. Configure al menos un tanque.</span>
            </div>
            `}

            <div class="wizard-input-group mb-12">
              <label class="wizard-label">TEMPERATURA TANQUE (°C)</label>
              <input type="number" id="w-o-temp" value="${data.temperatura || 4}" step="0.1" class="wizard-input font-800" style="color:${(data.temperatura || 4) <= 4 ? 'var(--c-success)' : 'var(--c-warning)'};">
            </div>
          </div>`;
        },
        onChange: async (data) => {
          data.fecha = document.getElementById('w-o-fecha')?.value || data.fecha;
          data.turno = document.getElementById('w-o-turno')?.value || 'AM';
          data.tanqueId = parseInt(document.getElementById('w-o-tanque')?.value) || null;
          data.temperatura = parseFloat(document.getElementById('w-o-temp')?.value) || 4;
        },
        validate: async (data) => {
          if (!data.fecha) { App.toastError("La fecha es obligatoria"); return false; }
          if (!data.tanqueId) { App.toastError("Selecciona un tanque destino"); return false; }
          return true;
        }
      },
      {
        content: async (data) => {
          const rows = animalesLeche.map(a => {
            const crotal = a.numero_identificacion || a.caravana || `ID ${a.id}`;
            const nombre = a.nombre || '';
            return `
            <tr class="border-bottom-222">
              <td class="p-6 text-[0.65rem] font-900">${crotal}</td>
              <td class="p-6 text-[0.6rem] font-700">${nombre}</td>
              <td class="p-6"><input type="number" class="wizard-input text-center font-900 text-sm" style="width:70px;" data-animal-id="${a.id}" data-crotal="${crotal}" value="${data.animalesProduccion?.[a.id] || ''}" placeholder="L"></td>
            </tr>`;
          }).join('');

          return `
          <div class="card card-accent card-accent-purple p-16 mt-10 mb-16">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-purple)">2. PRODUCCIÓN POR ANIMAL</div>
            <p class="text-[0.6rem] text-aaa uppercase font-800 text-center mb-10">${animalesLeche.length} animales en rebaño lechero</p>
            
            <div style="max-height:300px; overflow-y:auto;">
              <table class="w-full">
                <thead>
                  <tr class="border-bottom-222">
                    <th class="p-6 text-left text-[0.55rem] font-900 text-aaa uppercase">Crotal</th>
                    <th class="p-6 text-left text-[0.55rem] font-900 text-aaa uppercase">Nombre</th>
                    <th class="p-6 text-center text-[0.55rem] font-900 text-aaa uppercase">Litros</th>
                  </tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="3" class="p-10 text-center text-aaa text-xs">Sin animales en rebaño lechero</td></tr>'}</tbody>
              </table>
            </div>

            <div class="bg-black border border-222 rounded-sm p-14 mt-12">
              <div class="grid grid-cols-2 gap-8 text-[0.65rem] uppercase font-900 tracking-tight">
                <div>TOTAL ORDEÑO:</div>
                <div class="text-right"><strong id="w-o-total" class="text-green text-lg">0 L</strong></div>
              </div>
            </div>
          </div>`;
        },
        onChange: async (data) => {
          data.animalesProduccion = data.animalesProduccion || {};
          const inputs = document.querySelectorAll('[data-animal-id]');
          let total = 0;
          inputs.forEach(inp => {
            const val = parseFloat(inp.value) || 0;
            data.animalesProduccion[inp.dataset.animalId] = val;
            total += val;
          });
          const totalEl = document.getElementById('w-o-total');
          if (totalEl) totalEl.textContent = `${total.toLocaleString('es-ES')} L`;
        },
        validate: async (data) => {
          const total = Object.values(data.animalesProduccion || {}).reduce((s, v) => s + (v || 0), 0);
          if (total <= 0) { App.toastError("Registra al menos un animal con producción"); return false; }
          return true;
        }
      },
      {
        content: async (data) => {
          const total = Object.values(data.animalesProduccion || {}).reduce((s, v) => s + (v || 0), 0);
          const animalesConProduccion = Object.entries(data.animalesProduccion || {}).filter(([_, v]) => v > 0).length;

          let stockInfo = '';
          if (data.tanqueId && window.BalanceLacteo) {
            const stockActual = await window.BalanceLacteo.getStockTanque(data.tanqueId);
            const tanque = tanques.find(t => t.id === data.tanqueId);
            const nuevoStock = stockActual + total;
            const pct = tanque && tanque.capacidad_litros > 0 ? Math.round((nuevoStock / tanque.capacidad_litros) * 100) : 0;
            stockInfo = `
            <div class="bg-black border border-222 rounded-sm p-10 mb-12">
              <div class="text-[0.6rem] font-800 text-aaa uppercase mb-6">BALANCE TANQUE</div>
              <div class="grid grid-cols-3 gap-8 text-center">
                <div><div class="text-[0.55rem] text-aaa">ACTUAL</div><div class="text-green font-900">${stockActual.toLocaleString('es-ES')}L</div></div>
                <div><div class="text-[0.55rem] text-aaa">+ ORDEÑO</div><div class="text-green font-900">+${total.toLocaleString('es-ES')}L</div></div>
                <div><div class="text-[0.55rem] text-aaa">NUEVO</div><div class="text-green font-900">${nuevoStock.toLocaleString('es-ES')}L (${pct}%)</div></div>
              </div>
            </div>`;
          }

          return `
          <div class="card card-accent card-accent-gold p-16 mt-10 mb-16">
            <div class="section-header-theme mb-12" style="--theme-color: var(--p-gold)">3. CONFIRMACIÓN</div>
            
            <div class="grid grid-cols-2 gap-10 mb-12 text-xs">
              <div class="text-aaa uppercase font-800">Fecha:</div><div class="font-900">${data.fecha}</div>
              <div class="text-aaa uppercase font-800">Turno:</div><div class="font-900">${data.turno === 'AM' ? 'Mañana' : 'Tarde'}</div>
              <div class="text-aaa uppercase font-800">Tanque:</div><div class="font-900">${tanques.find(t => t.id === data.tanqueId)?.nombre || '-'}</div>
              <div class="text-aaa uppercase font-800">Animales ordeñados:</div><div class="font-900">${animalesConProduccion}</div>
              <div class="text-aaa uppercase font-800">Total litros:</div><div class="font-900 text-green text-lg">${total.toLocaleString('es-ES')} L</div>
            </div>

            ${stockInfo}
          </div>`;
        },
        onChange: async () => {},
        validate: async () => true,
      }
    ];

    window.WizardManager.create({
      id: `wizard-ordeno-${Date.now()}`,
      title: 'REGISTRO DE ORDEÑO',
      initialData: {
        fecha: new Date().toISOString().split("T")[0],
        turno: new Date().getHours() < 14 ? 'AM' : 'PM',
        tanqueId: tanques.length > 0 ? tanques[0].id : null,
        temperatura: 4,
        animalesProduccion: {},
      },
      steps: wizardSteps,
      onComplete: async (dataOrdeño) => {
        try {
          const total = Object.entries(dataOrdeño.animalesProduccion || {})
            .filter(([_, v]) => v > 0)
            .reduce((s, [id, v]) => s + v, 0);

          for (const [animalId, litros] of Object.entries(dataOrdeño.animalesProduccion || {})) {
            if (litros <= 0) continue;
            try {
              await window.Produccion.saveLeche({
                vacaId: parseInt(animalId),
                fecha: dataOrdeño.fecha,
                cantidad_litros: litros,
                turno: dataOrdeño.turno,
              }, fincaId);
            } catch (e) {
              console.warn(`[Ordeño] Error guardando producción animal ${animalId}:`, e);
            }
          }

          if (window.BalanceLacteo && dataOrdeño.tanqueId) {
            await window.BalanceLacteo.registrar({
              fincaId,
              tanqueId: dataOrdeño.tanqueId,
              tipo_movimiento: 'entrada',
              fecha: dataOrdeño.fecha,
              cantidad_litros: total,
              referencia_tipo: 'produccion_leche',
              temperatura: dataOrdeño.temperatura,
              turno: dataOrdeño.turno,
            });
          }

          if (window.TanquesLeche && dataOrdeño.tanqueId) {
            await window.TanquesLeche.actualizarTemperatura(dataOrdeño.tanqueId, dataOrdeño.temperatura);
          }

          App.toast(`Ordeño registrado: ${total.toLocaleString('es-ES')}L (${dataOrdeño.turno})`, 'success');
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  }
};
