/**
 * Livestock Manager - SubexplotacionesView v1.0.0
 * Gap "Subexplotación" de docs/PLAN-MEJORA-SIGGAN.md punto 7: SIEX no
 * relaciona los animales directamente con la finca, sino con una subdivisión
 * por especie (REGA + especie + clasificación zootécnica). Capa ADITIVA y
 * OPCIONAL en finca.subexplotaciones[] — una explotación de una sola especie
 * puede ignorar este módulo por completo y seguir usando los campos
 * tipo_explotacion/sistema_explotacion de finca como hasta ahora.
 */
const SubexplotacionesView = {
  async render() {
    if (window.App) App.updateHeaderColor('subexplotaciones');
    const main = document.getElementById("app-content");
    const finca = await Fincas.getActive();
    if (!finca) {
      main.innerHTML = `<div class="empty-state"><p class="empty-state-text">Selecciona una finca activa primero.</p></div>`;
      return;
    }

    const especies = await window.db.getAll('especies').catch(() => []);
    const especiePorId = new Map(especies.map((e) => [e.id, e]));
    const censoPorEspecie = await this._censoPorEspecie(finca.id);

    const subsConIndice = (finca.subexplotaciones || [])
      .map((sub, realIndex) => ({ sub, realIndex }))
      .filter(({ sub }) => !sub?.anulada);

    let html = '';
    if (subsConIndice.length === 0) {
      html = `<div class="empty-state"><div class="empty-state-icon">${Icons.rebanos()}</div><p class="empty-state-text">Sin subexplotaciones registradas.</p><p class="text-aaa text-[0.65rem] uppercase font-800 mt-4 px-20 text-center">Solo es necesario si gestionas varias especies en esta finca y necesitas declarar censo/clasificación zootécnica por separado ante SIEX/SIGGAN.</p><div class="text-center mt-20"><button class="btn btn-create btn-lg" onclick="SubexplotacionesView._crearSubexplotacion()">${Icons.agregar()} Registrar primera subexplotación</button></div></div>`;
    } else {
      const moduleColor = (window.getModuleColor && window.getModuleColor('/subexplotaciones')) || 'var(--c-info)';
      let fichasHtml = '';
      for (const item of subsConIndice) {
        const sub = item.sub;
        const especie = especiePorId.get(Number(sub.especieId));
        const censo = censoPorEspecie.get(Number(sub.especieId)) || 0;
        const metadata = [];
        if (sub.tipo_explotacion) metadata.push(`<span>${sub.tipo_explotacion}</span>`);
        if (sub.sistema_explotacion) metadata.push(`<span>${sub.sistema_explotacion.charAt(0).toUpperCase() + sub.sistema_explotacion.slice(1)}</span>`);
        metadata.push(`<span>Censo actual: ${censo}${sub.capacidad_maxima ? ' / ' + sub.capacidad_maxima : ''}</span>`);

        fichasHtml += App._cardRegistro({
          icon: Icons.rebanos(),
          title: especie ? especie.nombre_display.toUpperCase() : 'ESPECIE DESCONOCIDA',
          subtitle: 'Subexplotación SIEX',
          metadata: metadata.join(''),
          color: moduleColor,
          onClick: `location.hash='/subexplotacion?index=${item.realIndex}'`
        });
      }

      html = `
        <div class="flex items-center gap-12 mb-14">
          <span class="text-2xl" style="color:${moduleColor}; display:inline-flex; align-items:center;">${Icons.rebanos()}</span>
          <div>
            <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin:0; line-height:1.2;">
              <span style="color:${moduleColor}; margin-right:4px;">|</span> SUBEXPLOTACIONES
            </h1>
            <div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
              ${subsConIndice.length} ${subsConIndice.length === 1 ? 'especie' : 'especies'} declaradas por separado
            </div>
          </div>
        </div>
        <div class="grid gap-12">${fichasHtml}</div>`;
    }

    main.innerHTML = html + `
      <div class="fab-container" onclick="SubexplotacionesView._crearSubexplotacion()">
        <span class="fab-label">Nueva Subexplotación</span>
        <button class="fab-btn">${Icons.fabPlus()}</button>
      </div>`;
  },

  /** Censo activo por especieId dentro de la finca (a partir de rebaños propios). */
  async _censoPorEspecie(fincaId) {
    const rebanos = await Rebanos.list();
    const rebanoIds = new Set(rebanos.map((r) => Number(r.id)));
    const animales = await Animales.list().catch(() => []);
    const mapa = new Map();
    for (const a of animales) {
      if ((a.estado || 'activo') !== 'activo') continue;
      if (!rebanoIds.has(Number(a.rebanoId))) continue;
      if (a.especieId == null) continue;
      const id = Number(a.especieId);
      mapa.set(id, (mapa.get(id) || 0) + 1);
    }
    return mapa;
  },

  async renderDetalle(params) {
    const index = params.get("index");
    const finca = await Fincas.getActive();
    const sub = finca?.subexplotaciones?.[parseInt(index)];
    if (!sub || sub.anulada) {
      App.toastError("Subexplotación no disponible");
      location.hash = "#/subexplotaciones";
      return;
    }
    const especies = await window.db.getAll('especies').catch(() => []);
    const especie = especies.find((e) => e.id === Number(sub.especieId));
    const CS = window.ComunidadesService;
    const tiposExpl = CS ? CS.TIPOS_EXPLOTACION_REGA : [];
    const sistemasExpl = CS ? CS.SISTEMAS_EXPLOTACION : [];

    SubexplotacionesView._guardado = false;
    App.setExitGuard(() => SubexplotacionesView._confirmSalirEdicion());

    document.getElementById("app-content").innerHTML = `
      <div class="mb-20"><a href="#" onclick="SubexplotacionesView._salirEdicion(); return false;" class="link-back">← Volver</a><h2 class="mt-10 font-900 uppercase tracking-wider"><span style="color: var(--neon);">|</span> ${Icons.rebanos()} SUBEXPLOTACIÓN: ${especie ? especie.nombre_display.toUpperCase() : '—'}</h2></div>
      <div class="card-registro" style="--registro-color: var(--c-info);">
        <div class="flex flex-col gap-15">
          <div><label class="form-label" for="sub-edit-tipo">Tipo de explotación (REGA)</label>
          <select id="sub-edit-tipo" class="premium-input">
            <option value="">— SIN ESPECIFICAR —</option>
            ${tiposExpl.map((t) => `<option value="${t}" ${sub.tipo_explotacion === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select></div>
          <div><label class="form-label" for="sub-edit-sistema">Sistema productivo</label>
          <select id="sub-edit-sistema" class="premium-input">
            <option value="">— SIN ESPECIFICAR —</option>
            ${sistemasExpl.map((s) => `<option value="${s}" ${sub.sistema_explotacion === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
          </select></div>
          <div><label class="form-label" for="sub-edit-capacidad">Capacidad máxima autorizada (cab.)</label>
          <input type="number" id="sub-edit-capacidad" value="${sub.capacidad_maxima || ''}" min="0" class="premium-input"></div>
          <div><label class="form-label" for="sub-edit-notas">Notas</label>
          <textarea id="sub-edit-notas" class="premium-input min-h-60 resize-none">${sub.notas || ''}</textarea></div>
        </div>
        <div class="flex justify-between items-center mt-20">
          <button class="btn btn-danger" onclick="SubexplotacionesView._eliminarSubexplotacion(${index})">${Icons.eliminar()} Eliminar</button>
          <div class="flex gap-10">
            <button class="btn btn-secondary" onclick="SubexplotacionesView._salirEdicion()">${Icons.cerrar()} Cancelar</button>
            <button class="btn btn-success" onclick="SubexplotacionesView._guardarSubexplotacion(${index})">${Icons.guardar()} Guardar</button>
          </div>
        </div>
      </div>`;
  },

  async _guardarSubexplotacion(index) {
    try {
      const finca = await Fincas.getActive();
      const sub = finca.subexplotaciones[index];
      sub.tipo_explotacion = document.getElementById('sub-edit-tipo').value;
      sub.sistema_explotacion = document.getElementById('sub-edit-sistema').value;
      const capacidad = parseInt(document.getElementById('sub-edit-capacidad').value);
      sub.capacidad_maxima = isNaN(capacidad) ? null : capacidad;
      sub.notas = document.getElementById('sub-edit-notas').value.trim();

      await Fincas.save(finca);
      SubexplotacionesView._guardado = true;
      App.toast("Subexplotación actualizada", "success");
      location.hash = "#/subexplotaciones";
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
    location.hash = "#/subexplotaciones";
  },

  async _crearSubexplotacion() {
    const finca = await Fincas.getActive();
    if (!finca) { App.toastError("No hay finca activa"); return; }
    const especies = await window.db.getAll('especies').catch(() => []);
    const especiesUsadas = new Set((finca.subexplotaciones || []).filter((s) => !s.anulada).map((s) => Number(s.especieId)));
    const especiesDisponibles = especies.filter((e) => !especiesUsadas.has(e.id));
    if (especiesDisponibles.length === 0) {
      App.toastError('Ya existe una subexplotación para todas las especies del catálogo, o no hay especies disponibles.');
      return;
    }
    const CS = window.ComunidadesService;
    const tiposExpl = CS ? CS.TIPOS_EXPLOTACION_REGA : [];
    const sistemasExpl = CS ? CS.SISTEMAS_EXPLOTACION : [];

    const wizardSteps = [
      {
        content: (data) => `
          <div class="mt-10">
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-sub-especie">ESPECIE</label>
              <select id="w-sub-especie" class="wizard-input font-800">
                ${especiesDisponibles.map((e) => `<option value="${e.id}" ${data.especieId == e.id ? 'selected' : ''}>${e.nombre_display.toUpperCase()}</option>`).join('')}
              </select>
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-sub-tipo">TIPO DE EXPLOTACIÓN (REGA)</label>
              <select id="w-sub-tipo" class="wizard-input font-800">
                <option value="">— SIN ESPECIFICAR —</option>
                ${tiposExpl.map((t) => `<option value="${t}" ${data.tipo_explotacion === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-sub-sistema">SISTEMA PRODUCTIVO</label>
              <select id="w-sub-sistema" class="wizard-input font-800">
                <option value="">— SIN ESPECIFICAR —</option>
                ${sistemasExpl.map((s) => `<option value="${s}" ${data.sistema_explotacion === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
              </select>
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-sub-capacidad">CAPACIDAD MÁXIMA (CAB.)</label>
              <input type="number" id="w-sub-capacidad" value="${data.capacidad_maxima || ''}" min="0" class="wizard-input" placeholder="Opcional">
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.especieId = Number(document.getElementById('w-sub-especie')?.value) || null;
          data.tipo_explotacion = document.getElementById('w-sub-tipo')?.value || '';
          data.sistema_explotacion = document.getElementById('w-sub-sistema')?.value || '';
          const capacidad = parseInt(document.getElementById('w-sub-capacidad')?.value);
          data.capacidad_maxima = isNaN(capacidad) ? null : capacidad;
        },
        validate: async (data) => {
          if (!data.especieId) {
            App.toastError('Selecciona una especie.');
            return false;
          }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-nueva-subexplotacion',
      title: 'NUEVA SUBEXPLOTACIÓN',
      initialData: { especieId: especiesDisponibles[0]?.id || null, tipo_explotacion: '', sistema_explotacion: '', capacidad_maxima: null },
      steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          const finca2 = await Fincas.getActive();
          finca2.subexplotaciones = finca2.subexplotaciones || [];
          finca2.subexplotaciones.push({
            especieId: finalData.especieId,
            tipo_explotacion: finalData.tipo_explotacion,
            sistema_explotacion: finalData.sistema_explotacion,
            capacidad_maxima: finalData.capacidad_maxima,
            notas: '',
            creadoEn: Date.now(),
          });
          await Fincas.save(finca2);
          App.toast("Subexplotación registrada", "success");
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  },

  async _eliminarSubexplotacion(index) {
    if (!await Confirm.confirm("Anular subexplotación", "¿Anular esta subexplotación? Se conservará histórico para auditoría.", true)) return;
    try {
      const finca = await Fincas.getActive();
      const sub = finca?.subexplotaciones?.[index];
      if (!sub) {
        App.toastError("Subexplotación no encontrada.");
        return;
      }
      sub.anulada = true;
      sub.anuladaEn = new Date().toISOString();
      await Fincas.save(finca);
      App.toast("Subexplotación anulada", "success");
      location.hash = "#/subexplotaciones";
    } catch (e) {
      App.toastError(e.message);
    }
  }
};

window.SubexplotacionesView = SubexplotacionesView;
