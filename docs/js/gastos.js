/**
 * Gastos Ganadería - Livestock Manager
 * Módulo para control de costos y gastos operativos
 */

const Gastos = {
    async list(fincaId = null, rebanoId = null) {
        return await ErrorHandler.tryAsync(async () => {
            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const actualFincaId = fincaId || fincaActivaId;
            
            let gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', actualFincaId);
            
            if (rebanoId) {
                gastos = gastos.filter(g => g.rebanoId === rebanoId);
            }
            
            return gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        }, { entity: 'Gastos', action: 'list', fincaId, rebanoId });
    },

    async get(id) {
        return await window.db.get('gastos_ganaderia', Number(id));
    },

    async save(data) {
        return await ErrorHandler.tryAsync(async () => {
            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const fincaActiva = await window.Fincas.get(fincaActivaId).catch(() => null);

            ErrorHandler.validateRequired('concepto', data.concepto, 'Concepto de gasto es obligatorio');
            ErrorHandler.validateRequired('fecha', data.fecha, 'Fecha es obligatoria');
            ErrorHandler.validateNumeric(data.monto, 'Monto', 0, null);

            const esEdicion = data.id !== undefined && data.id !== null && data.id !== '';

            if (!esEdicion && window.PremiumManager && window.PremiumManager.isFree()) {
              const todos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaActivaId);
              const noDemo = todos.filter(g => !g.demo);
              if (noDemo.length >= window.PremiumManager.maxGastos()) {
                throw new Error('Has alcanzado el límite de gastos en la versión gratuita (máx. ' + window.PremiumManager.maxGastos() + '). Actualiza a Premium para añadir más.');
              }
            }

            if (esEdicion) {
              const existente = await window.db.get('gastos_ganaderia', Number(data.id));
              if (existente && window.PremiumManager && window.PremiumManager.isFree() && existente.demo) {
                throw new Error('No puedes modificar gastos de demostración en la versión gratuita');
              }
            }

            // Capturar Snapshot de contexto
            const snapMetadata = window.SnapshotService
                ? await window.SnapshotService.buildSnapMetadata(data.rebanoId)
                : { snap_zona: "Sin zona", snap_especie: "No definida", snap_tipo: "No definido" };

            const gastoData = {
                ...data,
                ...snapMetadata,
                fincaId: fincaActivaId,
                comunidad_autonoma: fincaActiva?.comunidad_autonoma || null,
                monto: Number(data.monto),
                rebanoId: data.rebanoId ? Number(data.rebanoId) : null,
                actualizadoEn: new Date().toISOString()
            };

            const esSanidad = (gastoData.categoria || '').toLowerCase().includes('sanidad')
                || (gastoData.concepto || '').toLowerCase().includes('sanidad');
            if (esSanidad && !gastoData.sanitarioId) {
                try {
                    const sanitarios = await window.db.getAllFromIndex('sanitarios_ganado', 'fincaId', fincaActivaId);
                    const fechaGasto = new Date(gastoData.fecha);
                    const candidatos = sanitarios
                        .filter(s => !gastoData.rebanoId || Number(s.rebanoId) === Number(gastoData.rebanoId))
                        .filter(s => !!s.fecha)
                        .map(s => ({ ...s, _diasDiff: Math.abs((fechaGasto - new Date(s.fecha)) / 86400000) }))
                        .filter(s => s._diasDiff <= 30)
                        .sort((a, b) => a._diasDiff - b._diasDiff);
                    if (candidatos.length > 0) gastoData.sanitarioId = candidatos[0].id;
                } catch (e) {
                    console.warn('[Gastos.save] No se pudo vincular sanitario:', e.message);
                }
            }

            let savedId;

            if (esEdicion) {
                gastoData.id = Number(data.id);
                await window.db.put('gastos_ganaderia', gastoData);
                savedId = gastoData.id;
            } else {
                delete gastoData.id;
                gastoData.creadoEn = new Date().toISOString();
                try {
                    const newId = await window.db.add('gastos_ganaderia', gastoData);
                    if (!newId || newId === 0 || newId === null) {
                        throw new Error('window.db.add() retornó ID inválido: ' + JSON.stringify(newId));
                    }
                    gastoData.id = newId;
                    savedId = gastoData.id;
                } catch (dbError) {
                    console.error('[Gastos.save] Error en window.db.add():', dbError);
                    // Fallback: generar un ID local
                    const fallbackId = Math.floor(Math.random() * 1000000) + 1;
                    gastoData.id = fallbackId;
                    savedId = fallbackId;
                }
            }

            if (window.EventBus) {
                window.EventBus.emit('gasto:created', { gasto: gastoData });
            }

            try {
                await window.db.add('registro_eventos', {
                    fincaId: fincaActivaId,
                    entidad_id: savedId,
                    tipo_entidad: 'gasto',
                    motivo_tarea: 'gasto_registrado',
                    fecha: gastoData.fecha,
                    valor_neto: gastoData.monto,
                    unidad: 'EUR',
                    snap_zona: gastoData.snap_zona || 'Sin zona',
                    snap_especie: gastoData.snap_especie || 'No definida',
                    snap_tipo: gastoData.snap_tipo || 'No definido',
                    comunidad_autonoma: gastoData.comunidad_autonoma || null,
                    observaciones: esSanidad
                        ? `Gasto sanitario registrado${gastoData.sanitarioId ? ` · Vinculado a tratamiento #${gastoData.sanitarioId}` : ''}`
                        : `Gasto registrado: ${gastoData.concepto || 'sin concepto'}`,
                    creadoEn: new Date().toISOString()
                });
            } catch (eventErr) {
                console.warn('[Gastos.save] No se pudo registrar evento de gasto:', eventErr.message);
            }

            return savedId;
        }, { entity: 'Gastos', action: 'save' });
    },

    async delete(id) {
        const gasto = await window.db.get('gastos_ganaderia', Number(id));
        if (gasto && window.PremiumManager && window.PremiumManager.isFree() && gasto.demo) {
          throw new Error('No puedes eliminar gastos de demostración en la versión gratuita');
        }
        await window.db.delete('gastos_ganaderia', Number(id));
        if (window.EventBus) {
            window.EventBus.emit('gasto:deleted', { id: Number(id) });
        }
    },

    /**
     * Calcula total de gastos en un período
     */
    async getTotalByPeriod(fincaId, dateFrom, dateTo) {
        return await ErrorHandler.tryAsync(async () => {
            const gastos = await this.list(fincaId);
            
            return gastos
                .filter(g => {
                    const fecha = new Date(g.fecha);
                    return fecha >= new Date(dateFrom) && fecha <= new Date(dateTo);
                })
                .reduce((sum, g) => sum + (g.monto || 0), 0);
        }, { action: 'getTotalByPeriod' });
    },

    /**
     * Calcula gastos promedio por animal
     */
    async getCostoPromedioPorAnimal(fincaId, rebanoId = null) {
        return await ErrorHandler.tryAsync(async () => {
            let animales = await Animales.list();
            if (rebanoId) {
                animales = animales.filter(a => a.rebanoId === rebanoId);
            }
            
            if (animales.length === 0) return 0;
            
            const gastos = await this.list(fincaId, rebanoId);
            const totalGastos = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);
            
            return totalGastos / animales.length;
        }, { action: 'getCostoPromedioPorAnimal' });
    },

    /**
     * Desglose de gastos por concepto
     */
    async desglosePorConcepto(fincaId) {
        return await ErrorHandler.tryAsync(async () => {
            const gastos = await this.list(fincaId);
            const desglose = {};
            
            gastos.forEach(g => {
                const concepto = g.concepto || 'Otros';
                desglose[concepto] = (desglose[concepto] || 0) + (g.monto || 0);
            });
            
            return Object.entries(desglose)
                .map(([concepto, monto]) => ({ concepto, monto }))
                .sort((a, b) => b.monto - a.monto);
        }, { action: 'desglosePorConcepto' });
    }
};

window.Gastos = Gastos;
