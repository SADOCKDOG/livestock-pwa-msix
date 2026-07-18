/**
 * Livestock Manager - SanidadView v1.0.0
 * Módulo único de Sanidad/Veterinaria: cálculo de periodos de supresión SIGGAN,
 * historial de tratamientos y edición/borrado. Extraído de GanaderiaView para
 * eliminar la triplicación de esta lógica en Ganadería, Carne e Híbrido.
 */
const SanidadView = {
  _filtro: '',
  _renderOpts: null,

  _fmtFecha(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) ? d.toLocaleDateString() : '-';
    } catch (e) { return '-'; }
  },

  /**
   * Enriquece un tratamiento con su estado de supresión de carne y leche a fecha dada.
   * Única fuente de verdad para este cálculo (antes duplicado en Ganadería/Carne/Híbrido).
   */
  calcularSupresion(t, hoy = new Date()) {
    const fechaApli = new Date(t.fecha);
    const diasCarne = parseInt(t.tiempo_espera_carne_dias) || 0;
    const diasLeche = parseInt(t.tiempo_espera_leche_dias) || 0;
    const permanente = t.prohibidoLeche === true;

    let fechaFinCarne = null, diasRestantesCarne = 0, enSupresionCarne = false;
    if (diasCarne > 0) {
      fechaFinCarne = new Date(fechaApli.getTime() + diasCarne * 24 * 60 * 60 * 1000);
      enSupresionCarne = fechaFinCarne > hoy;
      if (enSupresionCarne) diasRestantesCarne = Math.ceil((fechaFinCarne - hoy) / (24 * 60 * 60 * 1000));
    }

    let fechaFinLeche = null, diasRestantesLeche = 0, enSupresionLeche = false;
    if (diasLeche > 0 || permanente) {
      fechaFinLeche = permanente ? null : new Date(fechaApli.getTime() + diasLeche * 24 * 60 * 60 * 1000);
      enSupresionLeche = permanente || fechaFinLeche > hoy;
      if (enSupresionLeche) diasRestantesLeche = permanente ? 'INDEFINIDO' : Math.ceil((fechaFinLeche - hoy) / (24 * 60 * 60 * 1000));
    }

    return {
      ...t,
      enSupresionCarne, diasRestantesCarne, fechaFinCarne,
      enSupresionLeche, diasRestantesLeche, fechaFinLeche, indefinidoLeche: permanente,
      enSupresion: enSupresionCarne || enSupresionLeche
    };
  },

  /** Enriquece una lista completa de tratamientos con su estado de supresión. */
  enriquecer(tratamientos, hoy = new Date()) {
    return (tratamientos || []).map(t => this.calcularSupresion(t, hoy));
  },

  /**
   * Bloque HTML de alertas de supresión activas (carne y/o leche). Recibe tratamientos
   * ya enriquecidos por calcularSupresion/enriquecer.
   */
  renderAlertasSupresion(enriquecidos, opts = {}) {
    const activos = [];
    (enriquecidos || []).forEach(t => {
      if (t.enSupresionCarne && opts.tipo !== 'leche') activos.push({ ...t, tipoSupresion: 'carne', diasRestantes: t.diasRestantesCarne, fechaFin: t.fechaFinCarne, indefinido: false });
      if (t.enSupresionLeche && opts.tipo !== 'carne') activos.push({ ...t, tipoSupresion: 'leche', diasRestantes: t.diasRestantesLeche, fechaFin: t.fechaFinLeche, indefinido: t.indefinidoLeche });
    });
    if (activos.length === 0) return '';

    return `
      <div class="mb-14 px-4">
        <div class="inf-section-title mb-8 flex items-center gap-8 uppercase font-900 tracking-wider text-[0.7rem] text-danger">
          <span style="color: var(--c-danger); margin-right: 4px;">|</span> ALERTA: PERIODOS DE SUPRESIÓN DE SEGURIDAD (SIGGAN)
        </div>
        <div class="grid gap-10">
          ${activos.map(s => {
            const isCarne = s.tipoSupresion === 'carne';
            return `
              <div class="card p-12 border-222 animate-pulse" style="background: linear-gradient(135deg, rgba(30,10,10,0.8), rgba(15,5,5,0.9)); border-left: 4px solid var(--c-danger); box-shadow: 0 4px 20px rgba(255,68,68,0.15);">
                <div class="flex justify-between items-start gap-10">
                  <div>
                    <div class="text-[0.62rem] text-gray uppercase font-900 tracking-wider">Tratamiento Veterinario Activo</div>
                    <div class="text-sm font-black text-white uppercase tracking-wide mt-2">${s.medicamento || s.tipo_tratamiento}</div>
                    <div class="text-[0.68rem] text-gray-400 mt-4 flex items-center gap-6 font-bold uppercase">
                      <span>Animal: <strong style="color: var(--p-gold); font-weight: 950;">${s.snap_identificacion || s.animalId || 'Lote/Rebaño'}</strong></span>
                      <span>·</span>
                      <span>Aplicado: ${this._fmtFecha(s.fecha)}</span>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div class="badge badge-sm uppercase" style="background: rgba(255, 68, 68, 0.15); color: var(--c-danger); font-weight: 900; letter-spacing: 0.5px; border: 1px solid rgba(255, 68, 68, 0.3); box-shadow: 0 0 10px rgba(255, 68, 68, 0.2);">
                      SUPRESIÓN ${isCarne ? 'CARNE' : 'LECHE'}
                    </div>
                    <div class="text-md font-950 text-danger mt-4" style="text-shadow: 0 0 8px rgba(255,68,68,0.5);">${s.indefinido ? 'PROHIBIDO' : `${s.diasRestantes} <span class="text-[0.6rem] text-gray-500 font-bold uppercase">DÍAS REST.</span>`}</div>
                  </div>
                </div>
                <div class="text-[0.55rem] text-gray-500 font-extrabold uppercase mt-8 border-top-222 pt-8">
                  ADVERTENCIA: Prohibido el envío al matadero o comercialización de leche de este animal ${s.indefinido ? 'de forma permanente (medicamento prohibido en producción lechera).' : `hasta el vencimiento del periodo de espera (${this._fmtFecha(s.fechaFin)}).`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Listado histórico (cards clicables) a partir de tratamientos ya enriquecidos.
   * opts.limit (default 30), opts.emptyText, opts.tipo ('carne'|'leche'|null → badge de espera relevante).
   */
  renderHistorial(enriquecidos, opts = {}) {
    const limit = opts.limit || 30;
    const lista = (enriquecidos || []).slice(0, limit);
    if (lista.length === 0) {
      return `<div class="p-20 text-center rounded border border-222" style="background: rgba(255,255,255,0.015);">
        <span class="text-555 text-xs uppercase font-800 tracking-wider">${opts.emptyText || 'No se encontraron tratamientos'}</span>
      </div>`;
    }
    return `<div class="grid gap-10">${lista.map(t => {
      const soloCarne = opts.tipo === 'carne';
      const soloLeche = opts.tipo === 'leche';
      const hasSupresion = soloCarne ? t.enSupresionCarne : soloLeche ? t.enSupresionLeche : t.enSupresion;
      const diasRestantes = soloCarne ? t.diasRestantesCarne : soloLeche ? t.diasRestantesLeche : (t.enSupresionCarne ? t.diasRestantesCarne : t.diasRestantesLeche);
      const tipoSupresionLabel = t.enSupresionCarne && t.enSupresionLeche ? 'CARNE/LECHE' : t.enSupresionLeche ? 'LECHE' : 'CARNE';
      const permanente = t.indefinidoLeche && !soloCarne;
      return App._cardRegistro({
        icon: Icons.sanidad(),
        title: t.medicamento || t.tipo_tratamiento,
        subtitle: `Crotal: <strong style="color: var(--p-gold); font-weight: 950;">${t.snap_identificacion || t.animalId || 'Rebaño'}</strong>`,
        metadata: `<span>${this._fmtFecha(t.fecha)}</span><span>·</span><span>${t.tipo_tratamiento}</span>`,
        badge: permanente ? 'SUPRESIÓN PERMANENTE' : hasSupresion ? `ESPERA ${diasRestantes}D (${tipoSupresionLabel})` : 'Sin supresión',
        color: hasSupresion ? 'var(--c-danger)' : 'var(--c-purple)',
        onClick: `SanidadView._abrirOpcionesTratamiento(${t.id})`
      });
    }).join('')}</div>`;
  },

  /**
   * Fragmento completo (alertas + historial) listo para inyectar en el contenedor de
   * cualquier vista huésped (Ganadería, Carne, Híbrido). No gestiona filtro de texto.
   */
  renderFragmentHTML(tratamientos, opts = {}) {
    const enriquecidos = this.enriquecer(tratamientos);
    return this.renderAlertasSupresion(enriquecidos, opts) + `<div class="px-4">` +
      (opts.tituloHistorial !== false ? `
        <div class="inf-section-title mb-10 flex items-center gap-8 uppercase font-900 tracking-wider text-[0.7rem] text-gray">
          <span style="color: var(--c-purple); margin-right: 4px;">|</span> ${Icons.documento()} ${opts.tituloHistorial || 'HISTORIAL CLÍNICO VETERINARIO'}
        </div>` : '') +
      this.renderHistorial(enriquecidos, opts) +
      `</div>`;
  },

  /**
   * Vista de página completa (uso de GanaderiaView): carga todos los tratamientos de la
   * finca activa, con buscador propio y FAB de alta.
   */
  async render(container, opts = {}) {
    if (!container) return;
    this._renderOpts = opts;

    const tratamientos = await Sanitarios.list().catch(() => []);
    const filtro = this._filtro.trim().toLowerCase();
    const tratamientosFiltrados = filtro ? tratamientos.filter(t => {
      const medicamento = (t.medicamento || '').toLowerCase();
      const tipo = (t.tipo_tratamiento || '').toLowerCase();
      const crotal = (t.snap_identificacion || t.animalId || '').toString().toLowerCase();
      const veterinario = (t.veterinario_prescriptor || '').toLowerCase();
      return medicamento.includes(filtro) || tipo.includes(filtro) || crotal.includes(filtro) || veterinario.includes(filtro);
    }) : tratamientos;

    const enriquecidos = this.enriquecer(tratamientos);
    const supresionesActivas = enriquecidos.filter(t => t.enSupresion);

    container.innerHTML = `
      ${this.renderAlertasSupresion(enriquecidos)}

      <div class="px-4">
        <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(255,255,255,0.02);">
          <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center justify-between gap-6">
            <span class="flex items-center gap-6" style="color: var(--c-purple)">${Icons.sanidad()} BALANCE SANITARIO</span>
            <button class="resumen-toggle" onclick="App.toggleResumen(this)">${Icons.chevronAbajo()}</button>
          </div>
          <div class="resumen-body flex flex-col">
            <div class="py-10 flex justify-between items-center border-bottom-222">
              <span class="text-[0.65rem] text-gray uppercase font-900">Total Tratamientos</span>
              <strong class="text-lg font-950">${tratamientos.length}</strong>
            </div>
            <div class="py-10 flex justify-between items-center">
              <span class="text-[0.65rem] text-gray uppercase font-900">Tratamientos en Supresión</span>
              <strong class="text-lg font-950" style="color:${supresionesActivas.length > 0 ? 'var(--c-danger)' : 'var(--c-success)'};">${supresionesActivas.length}</strong>
            </div>
          </div>
        </div>

        <!-- Accesos directos a trámites oficiales -->
        <div class="grid grid-cols-2 gap-8 mb-14">
          <button class="widget-link-btn" style="border:none; cursor:pointer;" onclick="App._abrirWizardCrotales()">${Icons.documento()} Pedido de Crotales</button>
          <button class="widget-link-btn" style="border:none; cursor:pointer;" onclick="App._abrirWizardGuiaMovimiento()">${Icons.documento()} Guía de Movimiento</button>
        </div>

        <div class="flex items-center gap-8 mb-14">
          <div class="search-input-wrapper flex-1" style="position: relative;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #555;">${Icons.buscar()}</span>
            <input type="text" id="sanidad-filtro-buscar" value="${this._filtro}" oninput="SanidadView._buscar(this.value)" placeholder="Buscar medicamento, tipo, crotal o veterinario..." class="w-100" style="padding-left: 36px; background: rgba(255,255,255,0.03); border: 1px solid #27272a; border-radius: 8px; color: white; min-height: 40px; box-sizing: border-box;">
          </div>
        </div>

        <div class="inf-section-title mb-10 flex items-center gap-8 uppercase font-900 tracking-wider text-[0.7rem] text-gray">
          <span style="color: var(--c-purple); margin-right: 4px;">|</span> ${Icons.documento()} HISTORIAL CLÍNICO VETERINARIO
        </div>

        ${this.renderHistorial(this.enriquecer(tratamientosFiltrados))}
      </div>

      <div class="fab-container" style="--fab-neon-color: var(--c-purple);" onclick="window.WizardTratamiento ? window.WizardTratamiento.registrar(null) : App.toastError('Módulo de tratamiento no disponible')">
        <span class="fab-label">Aplicar Tratamiento</span>
        <button class="fab-btn">${Icons.fabPlus()}</button>
      </div>`;
  },

  _buscar(value) {
    this._filtro = value;
    if (this._renderOpts) {
      const container = document.getElementById('ganaderia-tab-content');
      if (container) this.render(container, this._renderOpts);
    }
  },

    async _abrirOpcionesTratamiento(id) {
    try {
      const t = await Sanitarios.get(id);
      if (!t) return;

      const overlay = document.createElement("div");
      overlay.className = "wizard-full-screen";
      overlay.style.justifyContent = "center";
      overlay.style.alignItems = "center";
      overlay.style.backgroundColor = "rgba(0,0,0,0.8)";
      overlay.innerHTML = `
          <div class="card p-25" style="max-width:420px; overflow-y:auto; max-height:90vh; border: 1px solid var(--c-purple); background: #1e1e1e; width: 100%;">
              <h3 class="mt-0 text-white font-900 uppercase tracking-wider"><span style="color: var(--c-purple); margin-right: 4px;">|</span> EDITAR TRATAMIENTO</h3>
              <p class="text-xs text-gray mb-15">ID Interno: ${t.id}</p>

              <div class="wizard-input-group">
                <label class="wizard-label">Medicamento / Tipo</label>
                <input type="text" id="edit-san-medicamento" value="${(t.medicamento || t.tipo_tratamiento || '').replace(/"/g, '&quot;')}" class="wizard-input uppercase">
              </div>

              <div class="grid grid-cols-2 gap-10">
                <div class="wizard-input-group">
                  <label class="wizard-label">Fecha</label>
                  <input type="date" id="edit-san-fecha" value="${t.fecha || ''}" class="wizard-input">
                </div>
                <div class="wizard-input-group">
                  <label class="wizard-label">Identificación (Crotal/Lote)</label>
                  <input type="text" id="edit-san-ident" value="${(t.snap_identificacion || '').replace(/"/g, '&quot;')}" class="wizard-input text-gold">
                </div>
              </div>

              <div class="grid grid-cols-2 gap-10">
                <div class="wizard-input-group">
                  <label class="wizard-label">Espera Carne (días)</label>
                  <input type="number" id="edit-san-carne" value="${t.tiempo_espera_carne_dias || 0}" min="0" class="wizard-input">
                </div>
                <div class="wizard-input-group">
                  <label class="wizard-label">Espera Leche (días)</label>
                  <input type="number" id="edit-san-leche" value="${t.tiempo_espera_leche_dias || 0}" min="0" class="wizard-input">
                </div>
              </div>

              <div class="flex gap-10 mt-20">
                  <button class="wizard-btn-action wizard-btn-primary flex-2" id="btn-save-san">${Icons.guardar()} Guardar</button>
                  <button class="wizard-btn-action wizard-btn-danger flex-1" id="btn-del-san">${Icons.eliminar()} Borrar</button>
                </div>
                <button class="wizard-btn-action wizard-btn-secondary mt-10 w-full" onclick="SanidadView._cerrarOverlayRegistro(this)">${Icons.cerrar()} Cancelar</button>
            </div>
          </div>`;
      document.body.appendChild(overlay);

      SanidadView._registroGuardado = false;
      App.setExitGuard(() => SanidadView._confirmSalirOverlayRegistro());

      overlay.querySelector('#btn-save-san').onclick = async () => {
        const medicamento = overlay.querySelector('#edit-san-medicamento').value.trim();
        const fecha = overlay.querySelector('#edit-san-fecha').value;
        const ident = overlay.querySelector('#edit-san-ident').value.trim();
        const diasCarne = parseInt(overlay.querySelector('#edit-san-carne').value) || 0;
        const diasLeche = parseInt(overlay.querySelector('#edit-san-leche').value) || 0;

        if (!medicamento) return App.toastError("Debes especificar el medicamento.");
        if (!fecha) return App.toastError("Fecha inválida.");

        await Sanitarios.save({
          ...t,
          id: t.id,
          medicamento,
          fecha,
          snap_identificacion: ident,
          tiempo_espera_carne_dias: diasCarne,
          tiempo_espera_leche_dias: diasLeche
        });
        SanidadView._registroGuardado = true;
        App.clearExitGuard();
        App.toast("Tratamiento actualizado", "success");
        overlay.remove();
        App.route();
      };

      overlay.querySelector('#btn-del-san').onclick = async () => {
        if (!await Confirm.confirm("Eliminar Tratamiento", "¿Eliminar este tratamiento de forma permanente?", true)) return;
        await Sanitarios.delete(id);
        SanidadView._registroGuardado = true;
        App.clearExitGuard();
        App.toast("Tratamiento eliminado", "success");
        overlay.remove();
        App.route();
      };
    } catch (e) {
      App.toastError(e.message);
    }
  },

  /** Guarda de salida compartida con el botón físico Android (ver App.setExitGuard). */
  async _confirmSalirOverlayRegistro() {
    if (this._registroGuardado) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _cerrarOverlayRegistro(btn) {
    if (!(await this._confirmSalirOverlayRegistro())) return;
    App.clearExitGuard();
    const overlay = btn.closest('.wizard-full-screen');
    if (overlay) overlay.remove();
  }
};

window.SanidadView = SanidadView;
