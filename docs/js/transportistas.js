/**
 * Transportistas - Livestock Manager Premium v4.0
 * Modelo de datos para registro de transportistas con trazabilidad de expediciones.
 */

const Transportistas = {
    /**
     * Listar transportistas con filtros opcionales
     * @param {Object} filtros - { activo, busqueda }
     */
    async list(filtros = {}) {
        return await ErrorHandler.tryAsync(async () => {
            let transportistas = await window.db.getAll('transportistas');

            if (filtros.activo !== undefined) {
                transportistas = transportistas.filter(t => t.activo === filtros.activo);
            }
            if (filtros.busqueda) {
                const q = filtros.busqueda.toLowerCase();
                transportistas = transportistas.filter(t =>
                    (t.nombre || '').toLowerCase().includes(q) ||
                    (t.nif_cif || '').toLowerCase().includes(q) ||
                    (t.matricula || '').toLowerCase().includes(q)
                );
            }

            return transportistas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        }, { entity: 'Transportistas', action: 'list' });
    },

    async get(id) {
        return await window.db.get('transportistas', Number(id));
    },

    async getByNif(nif) {
        try {
            return await window.db.getFromIndex('transportistas', 'nif_cif', ErrorHandler.normalizeNifCif(nif));
        } catch (e) {
            return null;
        }
    },

    async getByMatricula(matricula) {
        try {
            return await window.db.getFromIndex('transportistas', 'matricula', matricula.trim().toUpperCase());
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
                    throw new Error('No puedes modificar transportistas de demostración en la versión gratuita');
                }
            }

            ErrorHandler.validateRequired('nombre', data.nombre, 'Nombre o razón social es obligatorio');
            const nifVal = ErrorHandler.validateNifCif(data.nif_cif, { required: true });
            ErrorHandler.validateRequired('autorizacion_transporte_ganado', data.autorizacion_transporte_ganado, 'La autorización ATG es obligatoria');
            const ultimaDesinsectacion = (data.desinsectacion_ultima_fecha || '').trim();
            const vencimientoDesinsectacion = (data.desinsectacion_vencimiento || '').trim();
            if (vencimientoDesinsectacion && ultimaDesinsectacion && new Date(vencimientoDesinsectacion) < new Date(ultimaDesinsectacion)) {
                throw new Error('La fecha de vencimiento de desinsectación no puede ser anterior a la última desinsectación');
            }

            // Validar NIF único (excepto para el mismo registro en edición)
            const existente = await this.getByNif(nifVal);
            if (existente && (!esEdicion || existente.id !== Number(data.id))) {
                throw new Error(`Ya existe un transportista con NIF/CIF "${nifVal}"`);
            }

            const transportistaData = {
                nombre: data.nombre.trim(),
                nif_cif: nifVal,
                direccion: (data.direccion || '').trim(),
                codigo_postal: (data.codigo_postal || '').trim(),
                ciudad: (data.ciudad || '').trim(),
                provincia: (data.provincia || '').trim(),
                telefono: (data.telefono || '').trim(),
                email: (data.email || '').trim(),
                matricula: (data.matricula || '').trim().toUpperCase(),
                registro_transporte: (data.registro_transporte || '').trim(),
                autorizacion_transporte_ganado: (data.autorizacion_transporte_ganado || '').trim().toUpperCase(),
                desinsectacion_ultima_fecha: ultimaDesinsectacion,
                desinsectacion_vencimiento: vencimientoDesinsectacion,
                desinsectacion_vigente: !vencimientoDesinsectacion || new Date(vencimientoDesinsectacion) >= new Date(new Date().toISOString().split('T')[0]),
                certificado_bienestar: data.certificado_bienestar || false,
                certificado_bienestar_vencimiento: (data.certificado_bienestar_vencimiento || '').trim(),
                condiciones_termoneutrales: data.condiciones_termoneutrales || false,
                capacidad_animales: parseInt(data.capacidad_animales) || 0,
                tipo_vehiculo: data.tipo_vehiculo || '',
                notas: (data.notas || '').trim(),
                activo: data.activo !== undefined ? data.activo : true,
                actualizadoEn: new Date().toISOString()
            };

            if (esEdicion) {
                transportistaData.id = Number(data.id);
                await window.db.put('transportistas', transportistaData);
            } else {
                transportistaData.creadoEn = new Date().toISOString();
                const newId = await window.db.add('transportistas', transportistaData);
                transportistaData.id = newId;
            }

            if (window.EventBus) {
                window.EventBus.emit('transportista:created', { transportista: transportistaData });
            }

            return transportistaData.id;
        }, { entity: 'Transportistas', action: 'save' });
    },

    async delete(id) {
        return await ErrorHandler.tryAsync(async () => {
            if (window.PremiumManager && window.PremiumManager.isFree()) {
                const record = await this.get(id);
                if (record && record.demo) {
                    throw new Error('No puedes eliminar transportistas de demostración en la versión gratuita');
                }
            }

            const expediciones = await Transportistas.getExpediciones(id);
            if (expediciones.length > 0) {
                throw new Error(`No se puede eliminar: el transportista tiene ${expediciones.length} expedición(es) registrada(s).`);
            }
            await window.db.delete('transportistas', Number(id));
            if (window.EventBus) {
                window.EventBus.emit('transportista:deleted', { id: Number(id) });
            }
        }, { entity: 'Transportistas', action: 'delete', id });
    },

    async getExpediciones(transportistaId) {
        return await ErrorHandler.tryAsync(async () => {
            const todas = await window.db.getAll('comercializacion_carne');
            return todas
                .filter(v => Number(v.transportistaId) === Number(transportistaId))
                .sort((a, b) => new Date(b.fechaSacrificio || 0) - new Date(a.fechaSacrificio || 0));
        }, { entity: 'Transportistas', action: 'getExpediciones', transportistaId });
    },

    async getResumen(id) {
        const expediciones = await this.getExpediciones(id);
        const pesoTotal = expediciones.reduce((s, v) => s + (v.pesoVivo || 0), 0);
        const numExpediciones = expediciones.length;
        const ultima = expediciones.length > 0 ? expediciones[0] : null;
        return {
            total_expediciones: numExpediciones,
            peso_vivo_total: pesoTotal,
            ultima_expedicion: ultima
        };
    }
};

window.Transportistas = Transportistas;
