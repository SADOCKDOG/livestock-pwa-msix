/**
 * Vacunaciones — Livestock Manager
 * Modelo jerárquico de vacunación exigido por ADSG (ver
 * docs/AUDITAR/ADSGVacunacionesRumiantes.pdf y docs/PLAN-MEJORA-SIGGAN.md
 * punto 3), separado del libro de tratamientos genérico (js/sanitarios.js):
 *
 *   Vacunación (cabecera)
 *     └── tipos_vacuna[] (hasta 4: tipo, lote, dosis, nombre comercial)
 *     └── animales_vacunados[] (por categoría agregada o individual)
 *
 * Una vez `cerrada: true`, la vacunación (y sus tipos/animales) no se puede
 * modificar — mismo patrón de anulación trazable que movimientos_ganado
 * (js/movimientos.js), nunca borrado físico de una vacunación cerrada.
 */

const Vacunaciones = {
  MAX_TIPOS_VACUNA: 4,

  async list(filtros = {}) {
    return await ErrorHandler.tryAsync(async () => {
      let regs;
      if (filtros.rebanoId != null) {
        regs = await window.db.getAllFromIndex('vacunaciones', 'rebanoId', Number(filtros.rebanoId));
      } else {
        const fincaActivaId = await ErrorHandler.validateActiveFinca();
        const fincaId = filtros.fincaId != null ? Number(filtros.fincaId) : fincaActivaId;
        regs = await window.db.getAllFromIndex('vacunaciones', 'fincaId', fincaId);
      }
      return regs.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    }, { entity: 'Vacunaciones', action: 'list' });
  },

  async get(id) {
    return await window.db.get('vacunaciones', Number(id));
  },

  /**
   * Guarda una vacunación (alta o edición). Bloquea la edición si la
   * vacunación existente ya está cerrada.
   * @param {Object} data - { fincaId, rebanoId, fecha, veterinario, veterinario_colegiado,
   *   observaciones, tipos_vacuna: [{ tipo, lote, dosis, nombre_comercial }],
   *   animales_vacunados: [{ animalId?, categoria?, cantidad }], animales_totales, completa, cerrada }
   */
  async save(data) {
    return await ErrorHandler.tryAsync(async () => {
      const esEdicion = data.id !== undefined && data.id !== null && data.id !== '';

      if (esEdicion) {
        const existente = await this.get(data.id);
        if (existente && existente.cerrada) {
          throw new Error('Esta vacunación está cerrada y no se puede modificar. Anúlala y crea una nueva si necesitas corregirla.');
        }
        if (existente && window.PremiumManager && window.PremiumManager.isFree() && existente.demo) {
          throw new Error('No puedes modificar vacunaciones de demostración en la versión gratuita');
        }
      }

      const fincaActivaId = data.fincaId != null ? Number(data.fincaId) : await ErrorHandler.validateActiveFinca();
      ErrorHandler.validateRequired('rebanoId', data.rebanoId, 'El rebaño es obligatorio');
      ErrorHandler.validateDate(data.fecha);

      const tiposVacuna = Array.isArray(data.tipos_vacuna) ? data.tipos_vacuna.slice(0, this.MAX_TIPOS_VACUNA) : [];
      if (tiposVacuna.length === 0) {
        throw new Error('Debes indicar al menos un tipo de vacuna.');
      }
      for (const t of tiposVacuna) {
        if (!t.tipo || !String(t.tipo).trim()) {
          throw new Error('Cada tipo de vacuna debe indicar el tipo/nombre.');
        }
      }

      const animalesVacunados = Array.isArray(data.animales_vacunados) ? data.animales_vacunados : [];
      const totalVacunados = animalesVacunados.reduce((sum, a) => sum + (Number(a.cantidad) || 1), 0);

      const vacData = {
        fincaId: fincaActivaId,
        rebanoId: Number(data.rebanoId),
        fecha: data.fecha || new Date().toISOString().split('T')[0],
        veterinario: (data.veterinario || '').trim(),
        veterinario_colegiado: (data.veterinario_colegiado || '').trim(),
        observaciones: (data.observaciones || '').trim(),
        tipos_vacuna: tiposVacuna.map((t) => ({
          tipo: String(t.tipo).trim(),
          lote: (t.lote || '').trim(),
          dosis: (t.dosis || '').trim(),
          nombre_comercial: (t.nombre_comercial || '').trim(),
          // Producto de botiquín vinculado para el consumo de stock (opcional,
          // gestión interna — ver js/botiquin.js). El consumo real ya se
          // ejecutó al guardar desde el wizard; aquí solo queda la referencia
          // para trazabilidad en la ficha de la vacunación.
          botiquinProductoId: t.botiquinProductoId != null ? Number(t.botiquinProductoId) : null,
          botiquinCantidad: t.botiquinCantidad != null ? Number(t.botiquinCantidad) : null,
        })),
        animales_vacunados: animalesVacunados,
        animales_totales: data.animales_totales != null ? Number(data.animales_totales) : null,
        animales_vacunados_total: totalVacunados,
        completa: data.completa === true,
        cerrada: data.cerrada === true,
        actualizadoEn: new Date().toISOString(),
      };

      let vacId;
      if (esEdicion) {
        vacData.id = Number(data.id);
        const previo = await this.get(vacData.id);
        vacData.creadoEn = previo?.creadoEn || new Date().toISOString();
        await window.db.put('vacunaciones', vacData);
        vacId = vacData.id;
      } else {
        vacData.creadoEn = new Date().toISOString();
        vacId = await window.db.add('vacunaciones', vacData);
        vacData.id = vacId;
      }

      if (window.EventBus) {
        window.EventBus.emit('vacunacion:saved', { vacunacion: vacData });
      }
      return vacId;
    }, { entity: 'Vacunaciones', action: 'save' });
  },

  /** Cierra una vacunación (bloquea edición futura, salvo anulación). No es reversible desde aquí. */
  async cerrar(id) {
    return await ErrorHandler.tryAsync(async () => {
      const vac = await this.get(id);
      if (!vac) throw new Error('Vacunación no encontrada.');
      if (vac.cerrada) return vac.id;
      vac.cerrada = true;
      vac.actualizadoEn = new Date().toISOString();
      await window.db.put('vacunaciones', vac);
      if (window.EventBus) window.EventBus.emit('vacunacion:cerrada', { id: vac.id });
      return vac.id;
    }, { entity: 'Vacunaciones', action: 'cerrar', id });
  },

  /**
   * Anulación trazable: no borra el registro, lo marca como anulado (igual que
   * movimientos_ganado). Una vacunación cerrada solo puede anularse, no editarse.
   */
  async anular(id, motivo = '') {
    return await ErrorHandler.tryAsync(async () => {
      const vac = await this.get(id);
      if (!vac) throw new Error('Vacunación no encontrada.');
      vac.anulada = true;
      vac.motivo_anulacion = (motivo || '').trim();
      vac.fecha_anulacion = new Date().toISOString();
      await window.db.put('vacunaciones', vac);
      if (window.EventBus) window.EventBus.emit('vacunacion:anulada', { id: vac.id });
      return vac.id;
    }, { entity: 'Vacunaciones', action: 'anular', id });
  },

  async delete(id) {
    return await ErrorHandler.tryAsync(async () => {
      const vac = await this.get(id);
      if (vac && vac.cerrada) {
        throw new Error('No se puede eliminar una vacunación cerrada. Anúlala en su lugar.');
      }
      if (vac && window.PremiumManager && window.PremiumManager.isFree() && vac.demo) {
        throw new Error('No puedes eliminar vacunaciones de demostración en la versión gratuita');
      }
      await window.db.delete('vacunaciones', Number(id));
      if (window.EventBus) window.EventBus.emit('vacunacion:deleted', { id: Number(id) });
    }, { entity: 'Vacunaciones', action: 'delete', id });
  },
};

window.Vacunaciones = Vacunaciones;
