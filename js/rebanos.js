const Rebanos = {
    // Normaliza la coherencia zonaId <-> zonaActual en lectura (compat v5).
    // zonaId es la fuente de verdad; si existe, zonaActual se deriva de él.
    // Si sólo hay zonaActual (dato legacy), se resuelve el zonaId por nombre.
    _normalizarZona(rebano, zonas) {
        if (!rebano || !Array.isArray(zonas) || zonas.length === 0) return rebano;
        const tieneId = rebano.zonaId !== undefined && rebano.zonaId !== null && rebano.zonaId !== '';
        if (tieneId) {
            const z = zonas.find(z => Number(z.id) === Number(rebano.zonaId));
            if (z && z.nombre !== rebano.zonaActual) {
                return { ...rebano, zonaId: Number(rebano.zonaId), zonaActual: z.nombre };
            }
            return { ...rebano, zonaId: Number(rebano.zonaId) };
        }
        if (rebano.zonaActual && typeof rebano.zonaActual === 'string' && rebano.zonaActual.trim() !== '') {
            const z = zonas.find(z => z.nombre === rebano.zonaActual.trim());
            if (z && z.id) return { ...rebano, zonaId: Number(z.id) };
        }
        return rebano;
    },

    async list() {
        const fincaId = await Fincas.getActiveId();
        if (!fincaId) return [];
        const all = await window.db.getAll('rebanos');
        const propios = all.filter(r => Number(r.fincaId) === Number(fincaId) && !r?.anulado);
        const finca = await Fincas.get(fincaId);
        const zonas = (finca && Array.isArray(finca.zonas)) ? finca.zonas : [];
        return propios.map(r => Rebanos._normalizarZona(r, zonas));
    },

    async get(id) {
        const rebano = await window.db.get('rebanos', Number(id));
        if (!rebano) return rebano;
        const finca = await Fincas.get(rebano.fincaId).catch(() => null);
        const zonas = (finca && Array.isArray(finca.zonas)) ? finca.zonas : [];
        return Rebanos._normalizarZona(rebano, zonas);
    },

    async save(data) {
        return await ErrorHandler.tryAsync(async () => {
            const fincaId = await ErrorHandler.validateActiveFinca();

            // Handle backward compatibility: convert zonaActual (string) to zonaId (number) if needed
            let zonaId = data.zonaId;
            if (zonaId === undefined || zonaId === null || zonaId === '') {
                // Check if we have zonaActual (old format) to convert
                if (data.zonaActual && typeof data.zonaActual === 'string' && data.zonaActual.trim() !== '') {
                    // Try to find the zona by name to get its ID
                    const finca = await Fincas.get(fincaId);
                    if (finca && finca.zonas && Array.isArray(finca.zonas)) {
                        const zona = finca.zonas.find(z => z.nombre === data.zonaActual.trim());
                        if (zona && zona.id) {
                            zonaId = zona.id;
                        }
                    }
                }
            }

            // Ensure zonaId is a number or null
            if (zonaId !== null && zonaId !== undefined) {
                zonaId = Number(zonaId);
                if (isNaN(zonaId)) {
                    zonaId = null;
                }
            } else {
                zonaId = null;
            }

            const rebanoData = {
                ...data,
                fincaId: fincaId,
                zonaId: zonaId, // Use zonaId instead of zonaActual
                capacidad_total: Number(data.capacidad_total) || 0,
                actualizadoEn: new Date().toISOString()
            };

            const esEdicion = data.id !== undefined && data.id !== null && data.id !== '';

            if (esEdicion) {
                rebanoData.id = Number(data.id);
                await window.db.put('rebanos', rebanoData);
                return rebanoData.id;
            } else {
                delete rebanoData.id;
                rebanoData.creadoEn = new Date().toISOString();
                return await window.db.add('rebanos', rebanoData);
            }
        }, { entity: 'Rebanos', action: 'save' });
    },

    async delete(id) {
        const numId = Number(id);
        const rebano = await this.get(numId);
        if (!rebano) return null;

        if (rebano && window.PremiumManager && window.PremiumManager.isFree() && rebano.demo) {
            throw new Error('No puedes eliminar rebaños de demostración en la versión gratuita');
        }
        const animales = await window.db.getAllFromIndex('animales', 'rebanoId', numId);
        const activos = (animales || []).filter(a => !a?.anulado && (a.estado || 'activo') === 'activo');
        if (activos.length > 0) {
            throw new Error('No se puede eliminar el rebaño porque tiene animales asociados.');
        }
        rebano.estado = 'inactivo';
        rebano.anulado = true;
        rebano.anuladoEn = new Date().toISOString();
        rebano.actualizadoEn = new Date().toISOString();
        await window.db.put('rebanos', rebano);
        await window.db.add('registro_eventos', {
            fincaId: rebano.fincaId || await Fincas.getActiveId().catch(() => null),
            entidad_id: numId,
            tipo_entidad: 'rebano',
            tipo: 'auditoria',
            motivo_tarea: 'anulacion_rebano',
            fecha: new Date().toISOString().split('T')[0],
            descripcion: `Anulación de rebaño "${rebano.nombre || numId}"`,
            creadoEn: new Date().toISOString()
        }).catch(() => {});
        return numId;
    }
};

window.Rebanos = Rebanos;