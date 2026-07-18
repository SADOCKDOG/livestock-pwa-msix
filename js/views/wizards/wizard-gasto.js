/**
 * Wizard Gasto Analítico — Livestock Manager Premium
 * Proporciona una interfaz unificada para imputación de costes.
 * v2.0.0: Diseño modular por pasos (Basic -> Imputación/Normativo)
 */
window.GastoWizard = {
  async open(options = {}) {
    const App = window.App;
    if (!App) return console.error("App no disponible");

    const fincaId = await window.Fincas.getActiveId();
    const rebanos = await window.Rebanos.list();
    const finca = await window.Fincas.getActive();
    const zonas = finca.zonas || [];
    const proveedores = window.Proveedores ? await window.Proveedores.list({ activo: true }).catch(() => []) : [];

    const wizardSteps = [
      {
        // PASO 1: DATOS ECONÓMICOS
        content: (data) => `
          <div class="card card-accent card-accent-amber p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--p-gold)">${Icons.dinero()} DATOS ECONÓMICOS</div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">PROVEEDOR / EMISOR</label>
              <select id="w-g-prov" class="wizard-input wizard-select font-800">
                <option value="">— SIN PROVEEDOR ASIGNADO —</option>
                ${(data._proveedores || []).map(p =>
                  `<option value="${p.id}" ${data.proveedorId === p.id ? 'selected' : ''}>${p.nombre.toUpperCase()}${p.nif_cif ? ' ('+p.nif_cif+')' : ''}</option>`
                ).join('')}
              </select>
            </div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">CONCEPTO / FACTURA</label>
              <input type="text" id="w-g-con" value="${data.concepto}" placeholder="EJ: PIENSO TERNEROS..." class="wizard-input uppercase font-800">
            </div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">MONTO TOTAL (€)</label>
              <input type="number" id="w-g-mon" value="${data.monto}" step="0.01" class="wizard-input font-950 text-2xl text-amber">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label">CATEGORÍA CONTABLE</label>
              <select id="w-g-cat" class="wizard-input wizard-select font-900">
                  <option value="Alimentacion" ${data.categoria === 'Alimentacion' ? 'selected' : ''}>ALIMENTACIÓN</option>
                  <option value="Sanidad" ${data.categoria === 'Sanidad' ? 'selected' : ''}>SANIDAD</option>
                  <option value="Fitosanitarios" ${data.categoria === 'Fitosanitarios' ? 'selected' : ''}>FITOSANITARIOS</option>
                  <option value="Electricidad" ${data.categoria === 'Electricidad' ? 'selected' : ''}>ELECTRICIDAD</option>
                  <option value="Personal" ${data.categoria === 'Personal' ? 'selected' : ''}>PERSONAL</option>
                  <option value="Amortizacion" ${data.categoria === 'Amortizacion' ? 'selected' : ''}>AMORTIZACIÓN</option>
              </select>
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.proveedorId = parseInt(document.getElementById('w-g-prov')?.value) || null;
          data.concepto = document.getElementById('w-g-con')?.value.trim() || data.concepto;
          data.monto = parseFloat(document.getElementById('w-g-mon')?.value) || 0;
          data.categoria = document.getElementById('w-g-cat')?.value || data.categoria;
        },
        validate: async (data) => {
          if (!data.concepto) { App.toastError("El concepto del gasto es obligatorio"); return false; }
          if (data.monto <= 0) { App.toastError("El monto debe ser mayor a 0"); return false; }
          return true;
        }
      },
      {
        // PASO 2: IMPUTACIÓN Y NORMATIVA
        content: (data) => {
           const esAnimal = data.categoria === "Alimentacion" || data.categoria === "Sanidad";
           const esZona = data.categoria === "Fitosanitarios" || data.categoria === "Electricidad";
           const esFito = data.categoria === "Fitosanitarios";

           return `
          <div class="card card-accent card-accent-blue p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-info)">${Icons.paquete()} IMPUTACIÓN DE COSTES</div>

            ${esAnimal ? `
            <div class="wizard-input-group mb-12">
                <label class="wizard-label text-gold font-950 uppercase tracking-widest">${Icons.rebanos()} ASOCIAR REBAÑO (OBLIGATORIO)</label>
                <select id="w-g-reb" class="wizard-input wizard-select font-800" style="border-color: var(--p-gold) !important;">
                  <option value="">— SELECCIONAR LOTE —</option>
                  ${rebanos.map((r) => `<option value="${r.id}" ${data.rebanoId == r.id ? 'selected' : ''}>${r.nombre.toUpperCase()} (${r.especie.toUpperCase()})</option>`).join("")}
                </select>
            </div>` : ''}

            ${esZona ? `
            <div class="wizard-input-group mb-12">
                <label class="wizard-label text-green font-950 uppercase tracking-widest">${Icons.zonas()} ASOCIAR ZONA (OBLIGATORIO)</label>
                <select id="w-g-zon" class="wizard-input wizard-select font-800" style="border-color: var(--c-success) !important;">
                  <option value="">— SELECCIONAR ZONA —</option>
                  ${zonas.map((z) => `<option value="${z.nombre}" ${data.snap_zona === z.nombre ? 'selected' : ''}>${z.nombre.toUpperCase()}</option>`).join("")}
                </select>
            </div>` : ''}

            ${!esAnimal && !esZona ? `<p class="text-[0.65rem] text-aaa m-20 text-center font-900 uppercase tracking-widest leading-relaxed">Este gasto se imputará como Gasto General de Finca y no afectará a los márgenes por lote.</p>` : ''}
          </div>

          ${esFito ? `
          <div id="w-g-cumplimiento-area" class="card card-accent card-accent-purple p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-purple)">${Icons.fitosanitario()} CONTROL NORMATIVO</div>
            <div class="grid grid-cols-2 gap-10 mb-12">
              <div class="wizard-input-group">
                <label class="wizard-label">REGISTRO PRODUCTO</label>
                <input type="text" id="w-g-fit-reg" value="${(data.controlNormativo && data.controlNormativo.registroProducto) || ''}" class="wizard-input font-800" placeholder="Nº REGISTRO">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">DOSIS APLICADA</label>
                <input type="text" id="w-g-fit-dosis" value="${(data.controlNormativo && data.controlNormativo.dosisAplicada) || ''}" class="wizard-input font-800" placeholder="EJ: 1.5 L/HA">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-10">
              <div class="wizard-input-group">
                <label class="wizard-label">SEGURIDAD (DÍAS)</label>
                <input type="number" min="0" id="w-g-fit-plazo" value="${(data.controlNormativo && Number.isFinite(data.controlNormativo.plazoSeguridadDias)) ? data.controlNormativo.plazoSeguridadDias : 0}" class="wizard-input font-900 text-lg">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">APTO COMERC.</label>
                <select id="w-g-fit-apto" class="wizard-input wizard-select font-900">
                  <option value="true" ${(data.controlNormativo?.aptoComercializacion !== false) ? 'selected' : ''}>SÍ (APTO)</option>
                  <option value="false" ${(data.controlNormativo?.aptoComercializacion === false) ? 'selected' : ''}>NO (BLOQUEADO)</option>
                </select>
              </div>
            </div>
          </div>` : ''}
        `;
        },
        onChange: async (data) => {
          if (data.categoria === "Alimentacion" || data.categoria === "Sanidad") {
            data.rebanoId = parseInt(document.getElementById('w-g-reb')?.value) || null;
          } else if (data.categoria === "Fitosanitarios" || data.categoria === "Electricidad") {
            data.snap_zona = document.getElementById('w-g-zon')?.value || null;
          }
          if (data.categoria === "Fitosanitarios") {
            data.controlNormativo = {
              ...(data.controlNormativo || {}),
              registroProducto: document.getElementById('w-g-fit-reg')?.value?.trim() || '',
              dosisAplicada: document.getElementById('w-g-fit-dosis')?.value?.trim() || '',
              plazoSeguridadDias: parseInt(document.getElementById('w-g-fit-plazo')?.value, 10) || 0,
              aptoComercializacion: (document.getElementById('w-g-fit-apto')?.value || 'true') === 'true'
            };
          }
        },
        validate: async (data) => {
           if ((data.categoria === "Alimentacion" || data.categoria === "Sanidad") && !data.rebanoId) {
             App.toastError("Debes seleccionar un rebaño para esta categoría."); return false;
           }
           if ((data.categoria === "Fitosanitarios" || data.categoria === "Electricidad") && !data.snap_zona) {
             App.toastError("Debes seleccionar una zona para esta categoría."); return false;
           }
           return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-nuevo-gasto',
      title: options.id ? 'EDITAR GASTO ANALÍTICO' : 'GASTO ANALÍTICO',
      initialData: {
        id: options.id || null,
        fecha: options.fecha || new Date().toISOString().split("T")[0],
        concepto: options.concepto || "",
        monto: options.monto || 0,
        categoria: options.category || options.categoria || "Alimentacion",
        rebanoId: options.rebanoId || null,
        snap_zona: options.snap_zona || null,
        proveedorId: options.proveedorId || null,
        origenModulo: options.origenModulo || 'general',
        modoExplotacion: options.modoExplotacion || null,
        controlNormativo: options.controlNormativo || {},
        _proveedores: proveedores
      },
      steps: wizardSteps,
      onComplete: async (data) => {
        try {
          const gasto = {
            concepto: data.concepto,
            monto: data.monto,
            categoria: data.categoria,
            fecha: data.fecha || new Date().toISOString().split("T")[0],
            fincaId: fincaId,
            proveedorId: data.proveedorId || null,
            origen_modulo: data.origenModulo || 'general',
            modo_explotacion: data.modoExplotacion || null
          };
          if (data.id) {
            gasto.id = data.id;
          }
          if (data.categoria === "Alimentacion" || data.categoria === "Sanidad") {
            const r = rebanos.find((x) => x.id === data.rebanoId);
            if (r) {
              gasto.rebanoId = r.id;
              gasto.snap_zona = r.zonaActual;
              gasto.snap_especie = r.especie;
              gasto.snap_tipo = r.tipo;
            }
          } else if (data.categoria === "Fitosanitarios" || data.categoria === "Electricidad") {
            gasto.snap_zona = data.snap_zona;
          }
          if (data.categoria === "Fitosanitarios") {
            gasto.control_normativo = {
              registroProducto: data.controlNormativo?.registroProducto || '',
              dosisAplicada: data.controlNormativo?.dosisAplicada || '',
              plazoSeguridadDias: data.controlNormativo?.plazoSeguridadDias || 0,
              aptoComercializacion: data.controlNormativo?.aptoComercializacion !== false,
              verificadoEn: new Date().toISOString()
            };
          }
          await Gastos.save(gasto);
          App.toast("Gasto imputado analíticamente.");
          if (options.onComplete) {
              options.onComplete();
          } else {
              App.renderGastos();
          }
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  }
};
