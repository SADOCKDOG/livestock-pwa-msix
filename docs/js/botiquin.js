/**
 * Botiquin — Livestock Manager
 * Modelo de datos del inventario de medicamentos/vacunas (gap "Ingreso
 * Almacén" de docs/AUDITAR/AUDITORIA-BASEDEDATOS-LEGACY.md). Extraído de
 * js/views/botiquin-view.js para poder reutilizar la lógica de consumo FEFO
 * (First Expire, First Out) desde otros módulos — hoy Sanitarios (tratamientos)
 * y Vacunaciones, que pueden vincular opcionalmente su registro a un consumo
 * de stock del botiquín sin condicionar el cumplimiento SIGGAN/BADIGEX.
 */
const Botiquin = {
  async listActivos(fincaId) {
    const productos = await window.db.getAllFromIndex('config_botiquin', 'fincaId', Number(fincaId)).catch(() => []);
    return productos.filter((p) => !p.anulado).sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async get(id) {
    return window.db.get('config_botiquin', Number(id));
  },

  async getLotes(productoId) {
    return window.db.getAllFromIndex('botiquin_lotes', 'productoId', Number(productoId)).catch(() => []);
  },

  /**
   * Consume `cantidad` unidades de un producto siguiendo FEFO (primero en
   * vencer, primero en salir) y registra el movimiento en registro_eventos,
   * opcionalmente referenciando el origen (tratamiento/vacunación) que
   * disparó el consumo.
   * @param {number} productoId
   * @param {number} cantidad
   * @param {Object} [opts] - { fecha, origenTipo: 'tratamiento'|'vacunacion', origenId }
   * @returns {Promise<{productoId:number, consumido:number, restante:number}>}
   */
  async consumir(productoId, cantidad, opts = {}) {
    return await ErrorHandler.tryAsync(async () => {
      const cantidadNum = Number(cantidad);
      ErrorHandler.validateRequired('productoId', productoId, 'Producto de botiquín requerido');
      if (!cantidadNum || cantidadNum <= 0) {
        throw new Error('La cantidad a consumir debe ser mayor que cero');
      }

      const p = await this.get(productoId);
      if (!p) throw new Error('Producto de botiquín no encontrado');
      if (cantidadNum > Number(p.cantidadActual || 0)) {
        throw new Error(`Stock insuficiente de "${p.nombre}" (disponible: ${p.cantidadActual || 0} ${p.unidad || ''})`);
      }

      const lotes = await this.getLotes(productoId);
      const lotesFEFO = lotes
        .filter((lote) => Number(lote.cantidad) > 0)
        .sort((a, b) => {
          const fechaA = a.caducidad ? new Date(a.caducidad) : new Date(8640000000000000);
          const fechaB = b.caducidad ? new Date(b.caducidad) : new Date(8640000000000000);
          return fechaA - fechaB;
        });

      let restante = cantidadNum;
      let costeTotal = 0;
      for (const lote of lotesFEFO) {
        if (restante <= 0) break;
        const aDescontar = Math.min(restante, Number(lote.cantidad));
        costeTotal += aDescontar * Number(lote.precioUnitario || 0);
        lote.cantidad = Number(lote.cantidad) - aDescontar;
        await window.db.put('botiquin_lotes', lote);
        restante -= aDescontar;
      }
      costeTotal = Number(costeTotal.toFixed(2));

      p.cantidadActual = Number(p.cantidadActual || 0) - cantidadNum;
      await window.db.put('config_botiquin', p);

      const origenDesc = opts.origenTipo === 'tratamiento' ? 'Tratamiento sanitario'
        : opts.origenTipo === 'vacunacion' ? 'Vacunación'
        : null;

      await window.db.add('registro_eventos', {
        fincaId: p.fincaId,
        entidad_id: p.id,
        tipo_entidad: 'botiquin',
        tipo: 'movimiento',
        motivo_tarea: 'consumo_botiquin',
        fecha: opts.fecha || new Date().toISOString().split('T')[0],
        valor_neto: cantidadNum,
        unidad: p.unidad,
        costeTotal,
        descripcion: `Consumo de ${cantidadNum} ${p.unidad || ''} de ${p.nombre}${origenDesc ? ` (${origenDesc})` : ''}`,
        origen_tipo: opts.origenTipo || null,
        origen_id: opts.origenId != null ? Number(opts.origenId) : null,
        creadoEn: new Date().toISOString(),
      });

      if (window.EventBus) {
        window.EventBus.emit('botiquin:consumido', { productoId: p.id, cantidad: cantidadNum, origenTipo: opts.origenTipo || null, origenId: opts.origenId || null });
      }

      return { productoId: p.id, consumido: cantidadNum, restante: p.cantidadActual, costeTotal };
    }, { entity: 'Botiquin', action: 'consumir', productoId, cantidad });
  },

  /** Movimientos de registro_eventos vinculados a un origen (tratamiento/vacunación) concreto. */
  async listConsumosPorOrigen(origenTipo, origenId) {
    const eventos = await window.db.getAllFromIndex('registro_eventos', 'tipo_entidad', 'botiquin').catch(() => []);
    return eventos.filter((e) => e.origen_tipo === origenTipo && e.origen_id === Number(origenId));
  },
};

window.Botiquin = Botiquin;
