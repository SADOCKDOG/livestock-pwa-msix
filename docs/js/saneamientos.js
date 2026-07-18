/**
 * Saneamientos — Livestock Manager Premium
 * Registro de campañas oficiales de saneamiento ganadero (tuberculosis,
 * brucelosis, leucosis, lengua azul, etc.) vinculadas a la ADSG, conforme a
 * SIGGAN (Junta de Andalucía).
 *
 * Cada saneamiento guarda la campaña, fecha, veterinario actuante, nº de
 * animales examinados/positivos y la calificación sanitaria resultante de la
 * explotación.
 */

const Saneamientos = {
  /**
   * Listar saneamientos, opcionalmente filtrados por finca o campaña.
   * @param {Object} filtros - { fincaId, campana }
   */
  async list(filtros = {}) {
    return await ErrorHandler.tryAsync(async () => {
      let regs = await window.db.getAll('saneamientos').catch(() => []);
      if (filtros.fincaId != null) {
        regs = regs.filter(s => Number(s.fincaId) === Number(filtros.fincaId));
      }
      if (filtros.campana) {
        regs = regs.filter(s => s.campana === filtros.campana);
      }
      return regs.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    }, { entity: 'Saneamientos', action: 'list' });
  },

  async get(id) {
    return await window.db.get('saneamientos', Number(id));
  },

  /**
   * Guarda un registro de saneamiento.
   * @param {Object} data
   */
  async save(data) {
    return await ErrorHandler.tryAsync(async () => {
      const esEdicion = data.id !== undefined && data.id !== null && data.id !== '';

      ErrorHandler.validateRequired('campana', data.campana, 'Indica la campaña de saneamiento');

      const examinados = Number(data.num_examinados) || 0;
      const positivos = Number(data.num_positivos) || 0;
      if (positivos > examinados) {
        throw new Error('El nº de positivos no puede superar al nº de animales examinados.');
      }

      const sanData = {
        fincaId: data.fincaId != null ? Number(data.fincaId) : null,
        campana: data.campana,                 // tuberculosis, brucelosis_b, ...
        fecha: data.fecha || new Date().toISOString().split('T')[0],
        veterinario: (data.veterinario || '').trim(),
        veterinario_colegiado: (data.veterinario_colegiado || '').trim(),
        adsg_nombre: (data.adsg_nombre || '').trim(),
        especie: data.especie || '',
        num_examinados: examinados,
        num_positivos: positivos,
        calificacion: data.calificacion || 'sin_calificar',
        proxima_actuacion: data.proxima_actuacion || '',
        notas: (data.notas || '').trim(),
        actualizadoEn: new Date().toISOString(),
      };

      let sanId;
      if (esEdicion) {
        sanData.id = Number(data.id);
        const previo = await this.get(sanData.id);
        sanData.creadoEn = previo?.creadoEn || new Date().toISOString();
        await window.db.put('saneamientos', sanData);
        sanId = sanData.id;
      } else {
        sanData.creadoEn = new Date().toISOString();
        sanId = await window.db.add('saneamientos', sanData);
        sanData.id = sanId;
      }

      if (window.EventBus) {
        window.EventBus.emit('saneamiento:saved', { saneamiento: sanData });
      }
      return sanId;
    }, { entity: 'Saneamientos', action: 'save' });
  },

  async delete(id) {
    return await ErrorHandler.tryAsync(async () => {
      await window.db.delete('saneamientos', Number(id));
      if (window.EventBus) window.EventBus.emit('saneamiento:deleted', { id: Number(id) });
    }, { entity: 'Saneamientos', action: 'delete', id });
  },

  /** Etiqueta legible de una campaña a partir de su clave */
  labelCampana(clave) {
    const CS = window.ComunidadesService;
    if (!CS) return clave;
    const c = CS.getCampanasSaneamiento().find(x => x.value === clave);
    return c ? c.label : clave;
  },

  /** Calificación sanitaria más reciente de la finca */
  async calificacionActual(fincaId) {
    const regs = await this.list({ fincaId });
    return regs.length > 0 ? regs[0].calificacion : 'sin_calificar';
  },
};

window.Saneamientos = Saneamientos;
