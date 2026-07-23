/**
 * Livestock Manager - SaneamientosView v1.0.0
 * Vista de campañas oficiales de saneamiento ganadero (js/saneamientos.js),
 * hasta ahora sin UI propia pese a tener modelo de datos completo desde su
 * implementación original. Ver docs/PLAN-MEJORA-SIGGAN.md.
 */
const SaneamientosView = {
  async render() {
    if (window.App) App.updateHeaderColor('saneamientos');
    const main = document.getElementById("app-content");
    const finca = await Fincas.getActive();
    const CS = window.ComunidadesService;
    const calificaciones = CS ? CS.getCalificacionesSanitarias() : [];
    const califPorValor = new Map(calificaciones.map((c) => [c.value, c]));

    if (!finca) {
      main.innerHTML = `<div class="empty-state"><p class="empty-state-text">Selecciona una finca activa primero.</p></div>`;
      return;
    }

    const registros = await window.Saneamientos.list({ fincaId: finca.id });

    let html = '';
    if (registros.length === 0) {
      html = `<div class="empty-state"><div class="empty-state-icon">${Icons.sanidad()}</div><p class="empty-state-text">Sin campañas de saneamiento registradas.</p><div class="text-center mt-20"><button class="btn btn-create btn-lg" onclick="SaneamientosView._crearSaneamiento()">${Icons.agregar()} Registrar primer saneamiento</button></div></div>`;
    } else {
      const moduleColor = (window.getModuleColor && window.getModuleColor('/saneamientos')) || 'var(--c-info)';
      let fichasHtml = '';
      for (const s of registros) {
        const calif = califPorValor.get(s.calificacion) || { label: s.calificacion || 'Sin calificar', color: '#888888' };
        const metadata = [];
        metadata.push(`<span>${s.fecha ? new Date(s.fecha).toLocaleDateString() : '—'}</span>`);
        metadata.push(`<span>Examinados: ${s.num_examinados || 0} · Positivos: ${s.num_positivos || 0}</span>`);
        if (s.restriccion_movimientos) metadata.push(`<span style="color: var(--c-danger);">RESTRICCIÓN DE MOVIMIENTOS ACTIVA</span>`);

        fichasHtml += App._cardRegistro({
          icon: Icons.sanidad(),
          title: window.Saneamientos.labelCampana(s.campana),
          subtitle: `<span class="badge badge-sm uppercase" style="background:${calif.color}20; color:${calif.color}; border:1px solid ${calif.color}60;">${calif.label}</span>`,
          metadata: metadata.join(''),
          color: moduleColor,
          onClick: `location.hash='/saneamiento?id=${s.id}'`
        });
      }

      html = `
        <div class="flex items-center gap-12 mb-14">
          <span class="text-2xl" style="color:${moduleColor}; display:inline-flex; align-items:center;">${Icons.sanidad()}</span>
          <div>
            <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin:0; line-height:1.2;">
              <span style="color:${moduleColor}; margin-right:4px;">|</span> SANEAMIENTOS
            </h1>
            <div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
              ${registros.length} ${registros.length === 1 ? 'campaña' : 'campañas'}
            </div>
          </div>
        </div>
        <div class="grid gap-12">${fichasHtml}</div>`;
    }

    main.innerHTML = html + `
      <div class="fab-container" onclick="SaneamientosView._crearSaneamiento()">
        <span class="fab-label">Nuevo Saneamiento</span>
        <button class="fab-btn">${Icons.fabPlus()}</button>
      </div>`;
  },

  async renderDetalle(params) {
    const id = params.get("id");
    const san = await window.Saneamientos.get(id);
    if (!san || san.anulada) {
      App.toastError("Saneamiento no disponible");
      location.hash = "#/saneamientos";
      return;
    }
    const CS = window.ComunidadesService;
    const campanas = CS ? CS.getCampanasSaneamiento() : [];
    const calificaciones = CS ? CS.getCalificacionesSanitarias() : [];

    SaneamientosView._guardado = false;
    App.setExitGuard(() => SaneamientosView._confirmSalirEdicion());

    document.getElementById("app-content").innerHTML = `
      <div class="mb-20"><a href="#" onclick="SaneamientosView._salirEdicion(); return false;" class="link-back">← Volver</a><h2 class="mt-10 font-900 uppercase tracking-wider"><span style="color: var(--neon);">|</span> ${Icons.sanidad()} DETALLE SANEAMIENTO</h2></div>
      <div class="card-registro" style="--registro-color: var(--c-info);">
        <div class="flex flex-col gap-15">
          <div><label class="form-label" for="s-edit-campana">Campaña</label>
          <select id="s-edit-campana" class="premium-input">
            ${campanas.map((c) => `<option value="${c.value}" ${san.campana === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select></div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label" for="s-edit-fecha">Fecha</label>
            <input type="date" id="s-edit-fecha" value="${san.fecha || ''}" class="premium-input"></div>
            <div><label class="form-label" for="s-edit-proxima">Próxima actuación</label>
            <input type="date" id="s-edit-proxima" value="${san.proxima_actuacion || ''}" class="premium-input"></div>
          </div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label" for="s-edit-vet">Veterinario</label>
            <input type="text" id="s-edit-vet" value="${san.veterinario || ''}" class="premium-input"></div>
            <div><label class="form-label" for="s-edit-vet-col">Nº Colegiado</label>
            <input type="text" id="s-edit-vet-col" value="${san.veterinario_colegiado || ''}" class="premium-input"></div>
          </div>
          <div><label class="form-label" for="s-edit-adsg">ADSG</label>
          <input type="text" id="s-edit-adsg" value="${san.adsg_nombre || ''}" class="premium-input"></div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label" for="s-edit-examinados">Nº examinados</label>
            <input type="number" id="s-edit-examinados" value="${san.num_examinados || 0}" min="0" class="premium-input"></div>
            <div><label class="form-label" for="s-edit-positivos">Nº positivos</label>
            <input type="number" id="s-edit-positivos" value="${san.num_positivos || 0}" min="0" class="premium-input"></div>
          </div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label" for="s-edit-tubo">NÚMERO DE TUBO</label>
            <input type="text" id="s-edit-tubo" value="${san.tubo || ''}" class="premium-input"></div>
            <div><label class="form-label" for="s-edit-sexo">SEXO</label>
            <select id="s-edit-sexo" class="premium-input">
              <option value="">— SIN ESPECIFICAR —</option>
              <option value="M" ${san.sexo === 'M' ? 'selected' : ''}>MACHO</option>
              <option value="F" ${san.sexo === 'F' ? 'selected' : ''}>HEMBRA</option>
            </select></div>
          </div>
          <div><label class="form-label" for="s-edit-calif">Calificación sanitaria</label>
          <select id="s-edit-calif" class="premium-input">
            ${calificaciones.map((c) => `<option value="${c.value}" ${san.calificacion === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select></div>
          <label class="flex items-center gap-8 text-xs text-aaa cursor-pointer">
            <input type="checkbox" id="s-edit-restriccion" ${san.restriccion_movimientos ? 'checked' : ''} style="accent-color:var(--p-gold);">
            <span class="uppercase font-900">RESTRICCIÓN DE MOVIMIENTOS ACTIVA</span>
          </label>
          <div><label class="form-label" for="s-edit-motivo-restriccion">Motivo de la restricción</label>
          <input type="text" id="s-edit-motivo-restriccion" value="${san.motivo_restriccion || ''}" class="premium-input"></div>
          <div><label class="form-label" for="s-edit-notas">Notas</label>
          <textarea id="s-edit-notas" class="premium-input min-h-60 resize-none">${san.notas || ''}</textarea></div>
        </div>
        <div class="flex justify-between items-center mt-20">
          <button class="btn btn-danger" onclick="SaneamientosView._anularSaneamiento(${san.id})">${Icons.eliminar()} Anular</button>
          <div class="flex gap-10">
            <button class="btn btn-secondary" onclick="SaneamientosView._salirEdicion()">${Icons.cerrar()} Cancelar</button>
            <button class="btn btn-success" onclick="SaneamientosView._guardarSaneamiento(${san.id})">${Icons.guardar()} Guardar</button>
          </div>
        </div>
      </div>`;
  },

  async _guardarSaneamiento(id) {
    try {
      const san = await window.Saneamientos.get(id);
      await window.Saneamientos.save({
        id,
        fincaId: san.fincaId,
        campana: document.getElementById('s-edit-campana').value,
        fecha: document.getElementById('s-edit-fecha').value,
        proxima_actuacion: document.getElementById('s-edit-proxima').value,
        veterinario: document.getElementById('s-edit-vet').value,
        veterinario_colegiado: document.getElementById('s-edit-vet-col').value,
        adsg_nombre: document.getElementById('s-edit-adsg').value,
        especie: san.especie,
        num_examinados: document.getElementById('s-edit-examinados').value,
        num_positivos: document.getElementById('s-edit-positivos').value,
        tubo: document.getElementById('s-edit-tubo').value,
        sexo: document.getElementById('s-edit-sexo').value,
        calificacion: document.getElementById('s-edit-calif').value,
        restriccion_movimientos: document.getElementById('s-edit-restriccion').checked,
        motivo_restriccion: document.getElementById('s-edit-motivo-restriccion').value,
        notas: document.getElementById('s-edit-notas').value,
      });
      SaneamientosView._guardado = true;
      App.toast("Saneamiento actualizado", "success");
      location.hash = "#/saneamientos";
    } catch (e) {
      App.toastError(e.message);
    }
  },

  async _confirmSalirEdicion() {
    if (this._guardado) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _salirEdicion() {
    if (!(await this._confirmSalirEdicion())) return;
    App.clearExitGuard();
    location.hash = "#/saneamientos";
  },

  async _crearSaneamiento() {
    const finca = await Fincas.getActive();
    if (!finca) { App.toastError("No hay finca activa"); return; }
    const CS = window.ComunidadesService;
    const campanas = CS ? CS.getCampanasSaneamiento() : [];
    const calificaciones = CS ? CS.getCalificacionesSanitarias() : [];
    const especiesAutorizables = CS ? CS.getEspeciesAutorizables() : [];

    const wizardSteps = [
      {
        content: (data) => `
          <div class="mt-10">
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-san-campana">CAMPAÑA</label>
              <select id="w-san-campana" class="wizard-input font-800">
                ${campanas.map((c) => `<option value="${c.value}" ${data.campana === c.value ? 'selected' : ''}>${c.label.toUpperCase()}</option>`).join('')}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-10">
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-san-fecha">FECHA</label>
                <input type="date" id="w-san-fecha" value="${data.fecha || ''}" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-san-especie">ESPECIE</label>
                <select id="w-san-especie" class="wizard-input font-800">
                  <option value="">— SIN ESPECIFICAR —</option>
                  ${especiesAutorizables.map((e) => `<option value="${e}" ${data.especie === e ? 'selected' : ''}>${e.toUpperCase()}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-10">
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-san-vet">VETERINARIO</label>
                <input type="text" id="w-san-vet" value="${data.veterinario || ''}" class="wizard-input">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-san-adsg">ADSG</label>
                <input type="text" id="w-san-adsg" value="${data.adsg_nombre || ''}" class="wizard-input">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-10">
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-san-examinados">Nº EXAMINADOS</label>
                <input type="number" id="w-san-examinados" value="${data.num_examinados || 0}" min="0" class="wizard-input">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-san-positivos">Nº POSITIVOS</label>
                <input type="number" id="w-san-positivos" value="${data.num_positivos || 0}" min="0" class="wizard-input">
              </div>
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-san-calif">CALIFICACIÓN SANITARIA</label>
              <select id="w-san-calif" class="wizard-input font-800">
                ${calificaciones.map((c) => `<option value="${c.value}" ${data.calificacion === c.value ? 'selected' : ''}>${c.label.toUpperCase()}</option>`).join('')}
              </select>
            </div>
            <label class="flex items-center gap-8 text-[0.6rem] text-aaa cursor-pointer mb-12">
              <input type="checkbox" id="w-san-restriccion" ${data.restriccion_movimientos ? 'checked' : ''} style="accent-color:var(--p-gold);">
              <span class="uppercase font-900 tracking-tight leading-tight">RESTRICCIÓN DE MOVIMIENTOS ACTIVA</span>
            </label>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-san-tubo">NÚMERO DE TUBO</label>
              <input type="text" id="w-san-tubo" value="${data.tubo || ''}" class="wizard-input">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-san-sexo">SEXO</label>
              <select id="w-san-sexo" class="wizard-input font-800">
                <option value="">— SELECCIONAR —</option>
                <option value="M" ${data.sexo === 'M' ? 'selected' : ''}>MACHO</option>
                <option value="F" ${data.sexo === 'F' ? 'selected' : ''}>HEMBRA</option>
              </select>
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-san-notas">NOTAS</label>
              <input type="text" id="w-san-notas" value="${data.notas || ''}" class="wizard-input">
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.campana = document.getElementById('w-san-campana')?.value || '';
          data.fecha = document.getElementById('w-san-fecha')?.value || '';
          data.especie = document.getElementById('w-san-especie')?.value || '';
          data.veterinario = document.getElementById('w-san-vet')?.value || '';
          data.adsg_nombre = document.getElementById('w-san-adsg')?.value || '';
          data.num_examinados = document.getElementById('w-san-examinados')?.value || 0;
          data.num_positivos = document.getElementById('w-san-positivos')?.value || 0;
          data.calificacion = document.getElementById('w-san-calif')?.value || 'sin_calificar';
          data.restriccion_movimientos = !!document.getElementById('w-san-restriccion')?.checked;
          data.tubo = document.getElementById('w-san-tubo')?.value || '';
          data.sexo = document.getElementById('w-san-sexo')?.value || '';
          data.notas = document.getElementById('w-san-notas')?.value || '';
        },
        validate: async (data) => {
          if (!data.campana) { App.toastError('Selecciona la campaña de saneamiento.'); return false; }
          if (!data.fecha) { App.toastError('Indica la fecha del saneamiento.'); return false; }
          if (Number(data.num_positivos) > Number(data.num_examinados)) {
            App.toastError('El nº de positivos no puede superar al nº de examinados.');
            return false;
          }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-nuevo-saneamiento',
      title: 'NUEVO SANEAMIENTO',
      initialData: { campana: campanas[0]?.value || '', fecha: new Date().toISOString().split('T')[0], especie: '', veterinario: '', adsg_nombre: '', num_examinados: 0, num_positivos: 0, calificacion: 'sin_calificar', restriccion_movimientos: false, tubo: '', sexo: '', notas: '' },
      steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          await window.Saneamientos.save({ ...finalData, fincaId: finca.id });
          App.toast("Saneamiento registrado", "success");
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  },

  async _anularSaneamiento(id) {
    if (!await Confirm.confirm("Anular saneamiento", "¿Anular este saneamiento? Se conservará histórico para auditoría.", true)) return;
    try {
      await window.Saneamientos.anular(id);
      App.toast("Saneamiento anulado", "success");
      SaneamientosView._guardado = true;
      location.hash = "#/saneamientos";
    } catch (e) {
      App.toastError(e.message);
    }
  }
};

window.SaneamientosView = SaneamientosView;
