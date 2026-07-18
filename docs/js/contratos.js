/**
 * Contratos de Compra - Livestock Manager Premium v4.0
 * Gestión de contratos con compradores: precios, condiciones y vigencia.
 */

const Contratos = {
    /**
     * Listar contratos, opcionalmente filtrados por comprador
     */
    async list(compradorId = null) {
        return await ErrorHandler.tryAsync(async () => {
            let contratos;
            if (compradorId) {
                contratos = await window.db.getAllFromIndex('contratos_compra', 'compradorId', Number(compradorId));
            } else {
                contratos = await window.db.getAll('contratos_compra');
            }
            return contratos.sort((a, b) => new Date(b.fecha_inicio || 0) - new Date(a.fecha_inicio || 0));
        }, { entity: 'Contratos', action: 'list' });
    },

    async get(id) {
        return await window.db.get('contratos_compra', Number(id));
    },

    /**
     * Obtener contrato activo para un comprador y tipo
     */
    async getActivo(compradorId, tipo = null) {
        const contratos = await this.list(compradorId);
        const ahora = new Date();
        return contratos.find(c => {
            if (!c.activo) return false;
            const inicio = new Date(c.fecha_inicio);
            if (inicio > ahora) return false;
            if (c.fecha_fin) {
                const fin = new Date(c.fecha_fin);
                if (fin < ahora) return false;
            }
            if (tipo && c.tipo !== tipo && c.tipo !== 'mixto') return false;
            return true;
        }) || null;
    },

    async save(data) {
        return await ErrorHandler.tryAsync(async () => {
            const esEdicion = data.id !== undefined && data.id !== null && data.id !== '';

            if (esEdicion && window.PremiumManager && window.PremiumManager.isFree()) {
                const existente = await this.get(data.id);
                if (existente && existente.demo) {
                    throw new Error('No puedes modificar contratos de demostración en la versión gratuita');
                }
            }

            ErrorHandler.validateRequired('compradorId', data.compradorId, 'Comprador es obligatorio');
            ErrorHandler.validateRequired('numero_contrato', data.numero_contrato, 'Número de contrato es obligatorio');
            ErrorHandler.validateRequired('fecha_inicio', data.fecha_inicio, 'Fecha de inicio es obligatoria');

            const contratoData = {
                compradorId: Number(data.compradorId),
                numero_contrato: data.numero_contrato.trim(),
                fecha_inicio: data.fecha_inicio,
                fecha_fin: data.fecha_fin || null,
                tipo: data.tipo || 'carne',
                precios: Array.isArray(data.precios) ? data.precios : [],
                iva_pct: Number(data.iva_pct) || 0,
                retencion_pct: Number(data.retencion_pct) || 0,
                condiciones: (data.condiciones || '').trim(),
                notas: (data.notas || '').trim(),
                activo: data.activo !== undefined ? data.activo : true,
                actualizadoEn: new Date().toISOString()
            };

            if (esEdicion) {
                contratoData.id = Number(data.id);
                await window.db.put('contratos_compra', contratoData);
            } else {
                contratoData.creadoEn = new Date().toISOString();
                const newId = await window.db.add('contratos_compra', contratoData);
                contratoData.id = newId;
            }

            if (window.EventBus) {
                window.EventBus.emit('contrato:created', { contrato: contratoData });
            }

            return contratoData.id;
        }, { entity: 'Contratos', action: 'save' });
    },

    async delete(id) {
        return await ErrorHandler.tryAsync(async () => {
            if (window.PremiumManager && window.PremiumManager.isFree()) {
                const record = await this.get(id);
                if (record && record.demo) {
                    throw new Error('No puedes eliminar contratos de demostración en la versión gratuita');
                }
            }

            await window.db.delete('contratos_compra', Number(id));
            if (window.EventBus) {
                window.EventBus.emit('contrato:deleted', { id: Number(id) });
            }
        }, { entity: 'Contratos', action: 'delete', id });
    },

    /**
     * Añadir una fila de precio al contrato
     */
    async addPrecio(contratoId, precioItem) {
        const contrato = await this.get(contratoId);
        if (!contrato) throw new Error('Contrato no encontrado');
        if (!Array.isArray(contrato.precios)) contrato.precios = [];
        contrato.precios.push({
            id: Date.now(),
            producto: precioItem.producto || '',
            precio_unitario: Number(precioItem.precio_unitario) || 0,
            moneda: precioItem.moneda || 'EUR',
            unidad: precioItem.unidad || 'kg',
            desde: precioItem.desde || null,
            hasta: precioItem.hasta || null,
            notas: precioItem.notas || ''
        });
        contrato.actualizadoEn = new Date().toISOString();
        await window.db.put('contratos_compra', contrato);
        return contrato;
    },

    /**
     * Eliminar una fila de precio
     */
    async removePrecio(contratoId, precioId) {
        const contrato = await this.get(contratoId);
        if (!contrato) throw new Error('Contrato no encontrado');
        contrato.precios = (contrato.precios || []).filter(p => p.id !== precioId);
        contrato.actualizadoEn = new Date().toISOString();
        await window.db.put('contratos_compra', contrato);
        return contrato;
    }
};

window.Contratos = Contratos;
