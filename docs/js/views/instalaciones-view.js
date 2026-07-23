/**
 * Livestock Manager - InstalacionesView v1.0.0
 * Vista de Instalaciones/Edificaciones de la finca. Ver js/fincas.js
 * (finca.instalaciones[], mismo patrón que finca.zonas[]) y
 * docs/PLAN-MEJORA-SIGGAN.md punto 5.
 */
const InstalacionesView = {
  async render() {
    if (window.App) App.updateHeaderColor('instalaciones');
    const main = document.getElementById("ganaderia-tab-content") || document.getElementById("app-content");
    const finca = await Fincas.getActive();
    const tiposInstalacion = await window.db.getAll('instalaciones_tipo').catch(() => []);
    const tipoPorId = new Map(tiposInstalacion.map((t) => [t.id, t]));

    const instalacionesConIndice = (finca?.instalaciones || [])
      .map((inst, realIndex) => ({ inst, realIndex }))
      .filter(({ inst }) => !inst?.anulada);

    let html = '';
    if (!finca) {
      html = `<div class="empty-state"><p class="empty-state-text">Selecciona una finca activa primero.</p></div>`;
    } else if (instalacionesConIndice.length === 0) {
      html = `<div class="empty-state"><div class="empty-state-icon">${Icons.edificio()}</div><p class="empty-state-text">Sin instalaciones registradas.</p><div class="text-center mt-20"><button class="btn btn-create btn-lg" onclick="InstalacionesView._crearInstalacion()">${Icons.agregar()} Registrar primera instalación</button></div></div>`;
    } else {
      const moduleColor = (window.getModuleColor && window.getModuleColor('/instalaciones')) || 'var(--c-info)';
      let fichasHtml = '';
      for (const item of instalacionesConIndice) {
        const inst = item.inst;
        const tipo = tipoPorId.get(Number(inst.tipoId));
        const detalles = [];
        if (inst.superficie_m2) detalles.push(`${inst.superficie_m2} m²`);
        if (inst.plazas_alojamiento) detalles.push(`${inst.plazas_alojamiento} plazas`);
        if (inst.volumen_m3) detalles.push(`${inst.volumen_m3} m³`);

        fichasHtml += App._cardRegistro({
          icon: Icons.edificio(),
          title: tipo ? tipo.nombre : 'Tipo desconocido',
          subtitle: detalles.length ? detalles.join(' · ') : 'Sin detalles adicionales',
          metadata: inst.codigo_siex ? `<span>Código SIEX: ${tipo?.codigo_siex || '-'}</span>` : '',
          color: moduleColor,
          onClick: `location.hash='/instalacion?index=${item.realIndex}'`
        });
      }

      html = `
        <div class="flex items-center gap-12 mb-14">
          <span class="text-2xl" style="color:${moduleColor}; display:inline-flex; align-items:center;">${Icons.edificio()}</span>
          <div>
            <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin:0; line-height:1.2;">
              <span style="color:${moduleColor}; margin-right:4px;">|</span> INSTALACIONES
            </h1>
            <div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
              ${instalacionesConIndice.length} ${instalacionesConIndice.length === 1 ? 'registro' : 'registros'}
            </div>
          </div>
        </div>
        <div class="grid gap-12">${fichasHtml}</div>`;
    }

    main.innerHTML = html + `
      <div class="fab-container" onclick="InstalacionesView._crearInstalacion()">
        <span class="fab-label">Nueva Instalación</span>
        <button class="fab-btn">${Icons.fabPlus()}</button>
      </div>`;
  },

  async renderDetalle(params) {
    const index = params.get("index");
    const finca = await Fincas.getActive();
    const inst = finca?.instalaciones?.[parseInt(index)];
    if (!inst || inst.anulada) {
      App.toastError("Instalación no disponible");
      location.hash = "#/instalaciones";
      return;
    }
    const tiposInstalacion = await window.db.getAll('instalaciones_tipo').catch(() => []);

    InstalacionesView._instalacionGuardada = false;
    App.setExitGuard(() => InstalacionesView._confirmSalirEdicion());

    document.getElementById("app-content").innerHTML = `
      <div class="mb-20"><a href="#" onclick="InstalacionesView._salirEdicion(); return false;" class="link-back">← Volver</a><h2 class="mt-10 font-900 uppercase tracking-wider"><span style="color: var(--neon);">|</span> ${Icons.edificio()} DETALLE INSTALACIÓN</h2></div>
      <div class="card-registro" style="--registro-color: var(--c-info);">
        <div class="flex flex-col gap-15">
          <div><label class="form-label" for="i-edit-tipo">Tipo (catálogo oficial)</label>
          <select id="i-edit-tipo" class="premium-input">
            ${tiposInstalacion.map((t) => `<option value="${t.id}" ${Number(inst.tipoId) === t.id ? 'selected' : ''}>${t.nombre.toUpperCase()}</option>`).join('')}
          </select></div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label" for="i-edit-superficie">Superficie (m²)</label>
            <input type="number" id="i-edit-superficie" value="${inst.superficie_m2 || ''}" class="premium-input"></div>
            <div><label class="form-label" for="i-edit-plazas">Plazas de alojamiento</label>
            <input type="number" id="i-edit-plazas" value="${inst.plazas_alojamiento || ''}" class="premium-input"></div>
          </div>
          <div><label class="form-label" for="i-edit-volumen">Volumen (m³, silos/depósitos)</label>
          <input type="number" id="i-edit-volumen" value="${inst.volumen_m3 || ''}" class="premium-input"></div>
          <div><label class="form-label" for="i-edit-notas">Notas</label>
          <textarea id="i-edit-notas" class="premium-input min-h-60 resize-none">${inst.notas || ''}</textarea></div>
        </div>
        <div class="flex justify-between items-center mt-20">
          <button class="btn btn-danger" onclick="InstalacionesView._eliminarInstalacion(${index})">${Icons.eliminar()} Eliminar</button>
          <div class="flex gap-10">
            <button class="btn btn-secondary" onclick="InstalacionesView._salirEdicion()">${Icons.cerrar()} Cancelar</button>
            <button class="btn btn-success" onclick="InstalacionesView._guardarInstalacion(${index})">${Icons.guardar()} Guardar</button>
          </div>
        </div>
      </div>`;
  },

  async _guardarInstalacion(index) {
    try {
      const finca = await Fincas.getActive();
      const inst = finca.instalaciones[index];
      inst.tipoId = Number(document.getElementById('i-edit-tipo').value);
      const superficie = parseFloat(document.getElementById('i-edit-superficie').value);
      inst.superficie_m2 = isNaN(superficie) ? null : superficie;
      const plazas = parseInt(document.getElementById('i-edit-plazas').value);
      inst.plazas_alojamiento = isNaN(plazas) ? null : plazas;
      const volumen = parseFloat(document.getElementById('i-edit-volumen').value);
      inst.volumen_m3 = isNaN(volumen) ? null : volumen;
      inst.notas = document.getElementById('i-edit-notas').value.trim();

      await Fincas.save(finca);
      InstalacionesView._instalacionGuardada = true;
      App.toast("Instalación actualizada", "success");
      location.hash = "#/instalaciones";
    } catch (e) {
      App.toastError(e.message);
    }
  },

  /** Guarda de salida compartida con el header-back y el botón físico Android (ver App.setExitGuard). */
  async _confirmSalirEdicion() {
    if (this._instalacionGuardada) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _salirEdicion() {
    if (!(await this._confirmSalirEdicion())) return;
    App.clearExitGuard();
    location.hash = "#/instalaciones";
  },

  async _crearInstalacion() {
    const tiposInstalacion = await window.db.getAll('instalaciones_tipo').catch(() => []);
    if (tiposInstalacion.length === 0) {
      App.toastError('Catálogo de tipos de instalación no disponible.');
      return;
    }

    const wizardSteps = [
      {
        content: (data) => `
          <div class="mt-10">
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-inst-tipo">TIPO (CATÁLOGO OFICIAL)</label>
              <select id="w-inst-tipo" class="wizard-input font-800">
                ${tiposInstalacion.map((t) => `<option value="${t.id}" ${data.tipoId == t.id ? 'selected' : ''}>${t.nombre.toUpperCase()}</option>`).join('')}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-10">
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-inst-superficie">SUPERFICIE (m²)</label>
                <input type="number" id="w-inst-superficie" value="${data.superficie_m2 || ''}" class="wizard-input" placeholder="Opcional">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-inst-plazas">PLAZAS ALOJAMIENTO</label>
                <input type="number" id="w-inst-plazas" value="${data.plazas_alojamiento || ''}" class="wizard-input" placeholder="Opcional">
              </div>
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-inst-volumen">VOLUMEN (m³, silos/depósitos)</label>
              <input type="number" id="w-inst-volumen" value="${data.volumen_m3 || ''}" class="wizard-input" placeholder="Opcional">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-inst-notas">NOTAS</label>
              <input type="text" id="w-inst-notas" value="${data.notas || ''}" class="wizard-input">
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.tipoId = Number(document.getElementById('w-inst-tipo')?.value) || null;
          const superficie = parseFloat(document.getElementById('w-inst-superficie')?.value);
          data.superficie_m2 = isNaN(superficie) ? null : superficie;
          const plazas = parseInt(document.getElementById('w-inst-plazas')?.value);
          data.plazas_alojamiento = isNaN(plazas) ? null : plazas;
          const volumen = parseFloat(document.getElementById('w-inst-volumen')?.value);
          data.volumen_m3 = isNaN(volumen) ? null : volumen;
          data.notas = document.getElementById('w-inst-notas')?.value.trim() || '';
        },
        validate: async (data) => {
          if (!data.tipoId) {
            App.toastError('Selecciona un tipo de instalación.');
            return false;
          }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-nueva-instalacion',
      title: 'NUEVA INSTALACIÓN',
      initialData: { tipoId: tiposInstalacion[0]?.id || null, superficie_m2: null, plazas_alojamiento: null, volumen_m3: null, notas: '' },
      steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          const finca = await Fincas.getActive();
          finca.instalaciones = finca.instalaciones || [];
          finca.instalaciones.push({
            tipoId: finalData.tipoId,
            superficie_m2: finalData.superficie_m2,
            plazas_alojamiento: finalData.plazas_alojamiento,
            volumen_m3: finalData.volumen_m3,
            notas: finalData.notas,
            creadoEn: Date.now(),
          });
          await Fincas.save(finca);
          App.toast("Instalación registrada", "success");
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  },

  async _eliminarInstalacion(index) {
    if (!await Confirm.confirm("Anular instalación", "¿Anular esta instalación? Se conservará histórico para auditoría.", true)) return;
    try {
      const finca = await Fincas.getActive();
      const inst = finca?.instalaciones?.[index];
      if (!inst) {
        App.toastError("Instalación no encontrada.");
        return;
      }
      inst.anulada = true;
      inst.anuladaEn = new Date().toISOString();
      await Fincas.save(finca);
      App.toast("Instalación anulada", "success");
      location.hash = "#/instalaciones";
    } catch (e) {
      App.toastError(e.message);
    }
  }
};

window.InstalacionesView = InstalacionesView;
