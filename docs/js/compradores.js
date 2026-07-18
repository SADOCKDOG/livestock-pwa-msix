/**
 * Compradores - Livestock Manager Premium v4.0
 * Modelo de datos para registro de compradores con trazabilidad de ventas.
 */

const Compradores = {
    /**
     * Listar compradores con filtros opcionales
     * @param {Object} filtros - { tipo, activo, busqueda }
     */
    async list(filtros = {}) {
        return await ErrorHandler.tryAsync(async () => {
            let compradores = await window.db.getAll('compradores');

            if (filtros.tipo) {
                compradores = compradores.filter(c => c.tipo_comprador === filtros.tipo);
            }
            if (filtros.activo !== undefined) {
                compradores = compradores.filter(c => c.activo === filtros.activo);
            }
            if (filtros.busqueda) {
                const q = filtros.busqueda.toLowerCase();
                compradores = compradores.filter(c =>
                    (c.nombre || '').toLowerCase().includes(q) ||
                    (c.nif_cif || '').toLowerCase().includes(q) ||
                    (c.ciudad || '').toLowerCase().includes(q)
                );
            }

            return compradores.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        }, { entity: 'Compradores', action: 'list' });
    },

    async get(id) {
        return await window.db.get('compradores', Number(id));
    },

    async getByNif(nif) {
        try {
            return await window.db.getFromIndex('compradores', 'nif_cif', ErrorHandler.normalizeNifCif(nif));
        } catch (e) {
            return null;
        }
    },

    async save(data) {
        return await ErrorHandler.tryAsync(async () => {
            const esEdicion = data.id !== undefined && data.id !== null && data.id !== '';

            if (esEdicion && window.PremiumManager && window.PremiumManager.isFree()) {
                const existente = await this.get(data.id);
                if (existente && existente.demo) {
                    throw new Error('No puedes modificar compradores de demostración en la versión gratuita');
                }
            }

            ErrorHandler.validateRequired('nombre', data.nombre, 'Nombre o razón social es obligatorio');
            const nifVal = ErrorHandler.validateNifCif(data.nif_cif, { required: true });
            const tipoOperador = (data.tipo_operador || '').trim() || (
                data.tipo_comprador === 'cárnico'
                    ? 'matadero'
                    : data.tipo_comprador === 'láctico'
                        ? 'industria_lactea'
                        : 'operador_comercial'
            );
            const regaVal = ErrorHandler.validateREGA(data.rega || '', data.comunidad_autonoma || null, { required: false });

            // Validar NIF único (excepto para el mismo registro en edición)
            const existente = await this.getByNif(nifVal);
            if (existente && (!esEdicion || existente.id !== Number(data.id))) {
                throw new Error(`Ya existe un comprador con NIF/CIF "${nifVal}"`);
            }

            const compradorData = {
                nombre: data.nombre.trim(),
                nif_cif: nifVal,
                direccion: (data.direccion || '').trim(),
                codigo_postal: (data.codigo_postal || '').trim(),
                ciudad: (data.ciudad || '').trim(),
                provincia: (data.provincia || '').trim(),
                telefono: (data.telefono || '').trim(),
                email: (data.email || '').trim(),
                tipo_comprador: data.tipo_comprador || 'híbrido',
                tipo_operador: tipoOperador,
                rega: regaVal,
                comunidad_autonoma: (data.comunidad_autonoma || '').trim().toLowerCase(),
                condiciones_pago: (data.condiciones_pago || '').trim(),
                notas: (data.notas || '').trim(),
                activo: data.activo !== undefined ? data.activo : true,
                actualizadoEn: new Date().toISOString()
            };

            if (esEdicion) {
                compradorData.id = Number(data.id);
                await window.db.put('compradores', compradorData);
            } else {
                compradorData.creadoEn = new Date().toISOString();
                const newId = await window.db.add('compradores', compradorData);
                compradorData.id = newId;
            }

            if (window.EventBus) {
                window.EventBus.emit('comprador:created', { comprador: compradorData });
            }

            return compradorData.id;
        }, { entity: 'Compradores', action: 'save' });
    },

    async delete(id) {
        return await ErrorHandler.tryAsync(async () => {
            if (window.PremiumManager && window.PremiumManager.isFree()) {
                const record = await this.get(id);
                if (record && record.demo) {
                    throw new Error('No puedes eliminar compradores de demostración en la versión gratuita');
                }
            }

            // Verificar que no tenga ventas asociadas
            const [ventasCarne, entregasLeche] = await Promise.all([
                this.getVentasCarne(id),
                this.getEntregasLeche(id)
            ]);
            const totalVentas = ventasCarne.length + entregasLeche.length;
            if (totalVentas > 0) {
                throw new Error(`No se puede eliminar: el comprador tiene ${totalVentas} venta(s) registrada(s).`);
            }
            await window.db.delete('compradores', Number(id));
            if (window.EventBus) {
                window.EventBus.emit('comprador:deleted', { id: Number(id) });
            }
        }, { entity: 'Compradores', action: 'delete', id });
    },

    // ============================================
    // TRAZABILIDAD: Historial de ventas del comprador
    // ============================================

    /**
     * Obtener todas las ventas de carne de un comprador
     */
    async getVentasCarne(compradorId) {
        return await ErrorHandler.tryAsync(async () => {
            const todas = await window.db.getAll('comercializacion_carne');
            return todas
                .filter(v => Number(v.compradorId) === Number(compradorId))
                .sort((a, b) => new Date(b.fechaSacrificio || 0) - new Date(a.fechaSacrificio || 0));
        }, { entity: 'Compradores', action: 'getVentasCarne', compradorId });
    },

    /**
     * Obtener todas las entregas de leche de un comprador
     */
    async getEntregasLeche(compradorId) {
        return await ErrorHandler.tryAsync(async () => {
            const todas = await window.db.getAll('comercializacion_leche');
            return todas
                .filter(e => Number(e.compradorId) === Number(compradorId))
                .sort((a, b) => new Date(b.fechaRecogida || 0) - new Date(a.fechaRecogida || 0));
        }, { entity: 'Compradores', action: 'getEntregasLeche', compradorId });
    },

    /**
     * Resumen de actividad del comprador
     */
    async getResumen(compradorId) {
        const [ventasCarne, entregasLeche, contratos] = await Promise.all([
            this.getVentasCarne(compradorId),
            this.getEntregasLeche(compradorId),
            Contratos ? Contratos.list(compradorId) : Promise.resolve([])
        ]);

        const pesoTotal = ventasCarne.reduce((s, v) => s + (v.pesoCanal || 0), 0);
        const importeCarneEst = ventasCarne.reduce((s, v) => s + ((v.pesoCanal || 0) * 5.5), 0);
        const litrosTotal = entregasLeche.reduce((s, e) => s + (e.cantidad || 0), 0);
        const importeLecheEst = entregasLeche.reduce((s, e) => s + ((e.cantidad || 0) * (e.precioBase || 0.45)), 0);

        return {
            total_ventas_carne: ventasCarne.length,
            peso_canal_total: pesoTotal,
            importe_carne_estimado: importeCarneEst,
            total_entregas_leche: entregasLeche.length,
            litros_totales: litrosTotal,
            importe_leche_estimado: importeLecheEst,
            contratos_activos: contratos.filter(c => c.activo).length,
            ultima_venta: ventasCarne.length > 0 ? ventasCarne[0] : null,
            ultima_entrega: entregasLeche.length > 0 ? entregasLeche[0] : null
        };
    }
};

window.Compradores = Compradores;
