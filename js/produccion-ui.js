const ProduccionUI = {
  iniciarAsistente(operacionPreseleccionada, options = {}) {
    window.__registroContext = {
      ...(window.__registroContext || {}),
      origen_modulo: options.origen_modulo || null,
      modo_explotacion: options.modo_explotacion || null
    };

    if (operacionPreseleccionada === 'venta_masiva') {
      if (window.App) window.App._abrirWizardVentaMasiva();
      return;
    }
    if (operacionPreseleccionada === 'gasto') {
      if (window.App) window.App._abrirFormularioGasto({
        origenModulo: options.origen_modulo || 'general',
        modoExplotacion: options.modo_explotacion || null
      });
      return;
    }

    const wizardSteps = [
      {
        content: () => `
          <div class="wizard-input-group">
            <label class="wizard-label">SELECCIONAR ÁREA</label>
            <select id="prod-select-area" class="prod-select">
              <option value="">-- ELIGE UNA OPCIÓN --</option>
              <option value="carne">PRODUCCIÓN CÁRNICA (kg)</option>
              <option value="leche">PRODUCCIÓN LÁCTEA (L)</option>
              <option value="venta_masiva">VENTA MASIVA / MATADERO</option>
              <option value="gasto">GASTO ANALÍTICO</option>
            </select>
          </div>
        `,
        onChange: async (data) => {
          const sel = document.getElementById('prod-select-area');
          if (sel) data.operacion = sel.value;
        },
        validate: async (data) => {
          if (!data.operacion) {
            App.toastError("Debes seleccionar una opción");
            return false;
          }
          if (data.operacion === 'venta_masiva') {
            App._abrirWizardVentaMasiva();
            const el = document.getElementById('wizard-produccion-maestro');
            if (el) el.remove();
            return false;
          }
          if (data.operacion === 'gasto') {
            App._abrirFormularioGasto({
              origenModulo: options.origen_modulo || 'general',
              modoExplotacion: options.modo_explotacion || null
            });
            const el = document.getElementById('wizard-produccion-maestro');
            if (el) el.remove();
            return false;
          }
          return true;
        },
      },
      {
        content: (data) => `
          <div class="wizard-input-group">
            <label class="wizard-label">MODALIDAD</label>
            <select id="prod-select-modalidad" class="prod-select">
              <option value="">-- ELIGE MODALIDAD --</option>
              ${data.operacion === 'carne'
                ? '<option value="individual">PESADA INDIVIDUAL</option><option value="lote">PESAJE POR LOTE</option>'
                : '<option value="individual">CONTROL INDIVIDUAL</option><option value="lote">CONTROL DE LOTE</option><option value="tanque">EXPEDICIÓN TANQUE</option>'
              }
            </select>
          </div>
        `,
        onChange: async (data) => {
          const sel = document.getElementById('prod-select-modalidad');
          if (sel) data.tipo_objetivo = sel.value;
        },
        validate: async (data) => {
          if (!data.tipo_objetivo) {
            App.toastError("Debes seleccionar una modalidad");
            return false;
          }
          if (data.tipo_objetivo === 'tanque') {
            window.PesajesUI.abrirWizard({ modo: 'leche_tanque' });
            const el = document.getElementById('wizard-produccion-maestro');
            if (el) el.remove();
            return false;
          }
          return true;
        }
      },
      {
        content: () => `
          <div class="flex flex-col h-full gap-15 mt-10">
            <input type="text" id="search-entity" placeholder="BUSCAR POR NOMBRE, RAZA O CROTAL..." class="wizard-input uppercase font-800">
            <div id="entity-list" class="prod-entity-list">
              <div class="text-gray text-center p-20">Cargando registros...</div>
            </div>
          </div>
        `,
        onRender: async (data, stepEl) => {
          const searchInput = stepEl.querySelector('#search-entity');
          const listEl = stepEl.querySelector('#entity-list');

          let items = [];
          if (data.tipo_objetivo === 'individual') {
            const animales = await window.Animales.list();
            if (data.operacion === 'leche') {
              items = animales.filter(a => (a.sexo === 'H' || (a.sexo || '').toUpperCase().startsWith('H')) && ['Vacas', 'Ovejas', 'Cabras'].includes(a.especie));
            } else {
              items = animales;
            }
          } else if (data.tipo_objetivo === 'lote') {
            const rebanos = await window.Rebanos.list();
            if (data.operacion === 'leche') {
              items = rebanos.filter(r => ['Vacas', 'Ovejas', 'Cabras'].includes(r.especie));
            } else {
              items = rebanos;
            }
          }

          const renderList = (filterText = '') => {
            const text = filterText.toLowerCase();
            const filtered = items.filter(i => {
              const searchStr = data.tipo_objetivo === 'individual' ? `${i.numero_identificacion} ${i.raza}` : `${i.nombre} ${i.especie} ${i.zonaActual}`;
              return searchStr.toLowerCase().includes(text);
            });

            if (filtered.length === 0) {
              listEl.innerHTML = `<div class="text-gray text-center p-20 uppercase font-900 text-xs">No se encontraron resultados</div>`;
              return;
            }

            listEl.innerHTML = filtered.map(i => {
              const id = i.id;
              const title = data.tipo_objetivo === 'individual' ? i.numero_identificacion : i.nombre;
              const subtitle = data.tipo_objetivo === 'individual' ? `${i.especie} - ${i.raza}` : `${i.especie} - ${i.tipo}`;
              const selected = data.selectedEntityId === id;

              return `
                <div class="entity-item ${selected ? 'entity-item--selected' : ''}" data-id="${id}">
                  <div>
                    <div class="text-white font-900 text-lg uppercase tracking-tight">${title}</div>
                    <div class="text-gray text-xs mt-4 uppercase font-800">${subtitle}</div>
                  </div>
                  <div class="entity-check ${selected ? 'entity-check--selected' : ''}">
                    ${selected ? Icons.check() : ''}
                  </div>
                </div>
              `;
            }).join('');

            listEl.querySelectorAll('.entity-item').forEach(el => {
              el.onclick = () => {
                data.selectedEntityId = parseInt(el.dataset.id);
                renderList(searchInput.value);
              };
            });
          };

          searchInput.oninput = (e) => renderList(e.target.value);
          renderList();
        },
        onChange: async () => {},
        validate: async (data) => {
          if (!data.selectedEntityId) {
            App.toastError("Debes seleccionar un registro de la lista");
            return false;
          }
          return true;
        }
      }
    ];

    const stepsToUse = operacionPreseleccionada
      ? wizardSteps.slice(1)
      : wizardSteps;
    const initialData = operacionPreseleccionada
      ? { selectedEntityId: null, operacion: operacionPreseleccionada }
      : { selectedEntityId: null };

    window.WizardManager.create({
      id: 'wizard-produccion-maestro',
      title: 'Asistente de Registro',
      steps: stepsToUse,
      initialData: initialData,
      onComplete: async (data) => {
        const modo = data.operacion + '_' + (data.tipo_objetivo === 'individual' ? 'ind' : 'lote');
        const config = { modo };
        if (data.tipo_objetivo === 'individual') config.animalId = data.selectedEntityId;
        if (data.tipo_objetivo === 'lote') config.rebanoId = data.selectedEntityId;
        window.PesajesUI.abrirWizard(config);
      },
    });
  },
};

window.ProduccionUI = ProduccionUI;
