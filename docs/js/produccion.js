const Produccion = {
    // ---- PRODUCCIÓN CARNE (Sin Cifrar) ----
    async listCarne(animalId = null) {
        if (animalId) {
            return window.db.getAllFromIndex('produccion_carne', 'animalId', Number(animalId));
        } else {
            return window.db.getAll('produccion_carne');
        }
    },

    async saveCarne(data) {
        return await ErrorHandler.tryAsync(async () => {
            ErrorHandler.validateRequired('animalId', data.animalId, 'Animal ID requerido');
            ErrorHandler.validateDate(data.fecha);
            ErrorHandler.validateNumeric(data.peso, 'Peso', 0, 5000);

            const esEdicion = data.id !== undefined && data.id !== null && data.id !== '';

            // Obtener el animal para snapshot de contexto
            const animal = await window.db.get('animales', Number(data.animalId));

            // Capturar Snapshot de contexto
            const rebanoId = animal && animal.rebanoId ? animal.rebanoId : null;
            const snapMetadata = await window.SnapshotService.buildSnapMetadata(rebanoId);
            // Add snap_rebano if we have the animal and rebano
            if (rebanoId) {
                const rebano = await window.db.get('rebanos', Number(rebanoId));
                if (rebano) {
                    snapMetadata.snap_rebano = rebano.nombre;
                }
            }

            const prodData = {
                ...data,
                ...snapMetadata,
                animalId: Number(data.animalId),
                peso: Number(data.peso) || 0,
                kg_ganados: data.kg_ganados ? Number(data.kg_ganados) : null,
                actualizadoEn: new Date().toISOString()
            };

            if (esEdicion) {
                prodData.id = Number(data.id);
                await window.db.put('produccion_carne', prodData);
                if (window.EventBus) {
                    window.EventBus.emit('pesaje:registrado', { tipo: 'carne', entidadId: prodData.animalId, peso: prodData.peso });
                }
                return prodData.id;
            } else {
                delete prodData.id;
                prodData.creadoEn = new Date().toISOString();
                const newId = await window.db.add('produccion_carne', prodData);
                if (window.EventBus) {
                    window.EventBus.emit('pesaje:registrado', { tipo: 'carne', entidadId: prodData.animalId, peso: prodData.peso });
                }
                return newId;
            }
        }, { entity: 'Produccion', action: 'saveCarne' });
    },

    /**
     * Calcula ganancia diaria de peso para un animal
     */
    async calcularGananciaDiaria(animalId) {
        return await ErrorHandler.tryAsync(async () => {
            const produccion = await this.listCarne(animalId);
            if (produccion.length < 2) return null;
            
            produccion.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
            const primero = produccion[0];
            const ultimo = produccion[produccion.length - 1];
            
            const diasDiferencia = (new Date(ultimo.fecha) - new Date(primero.fecha)) / (24 * 60 * 60 * 1000);
            const kgGanados = ultimo.peso - primero.peso;
            const gananciadiaria = diasDiferencia > 0 ? kgGanados / diasDiferencia : 0;
            
            return {
                gananciaDiaria: gananciadiaria.toFixed(2),
                kgGanados,
                diasPeriodo: Math.round(diasDiferencia),
                pesoInicial: primero.peso,
                pesoFinal: ultimo.peso,
                proyeccionMes: (gananciadiaria * 30).toFixed(2)
            };
        }, { action: 'calcularGananciaDiaria', animalId });
    },

    /**
     * Proyecta peso final basado en ganancia diaria
     */
    async proyectarPesoFinal(animalId, diasHasta = 30) {
        return await ErrorHandler.tryAsync(async () => {
            const ganancia = await this.calcularGananciaDiaria(animalId);
            if (!ganancia) return null;
            
            const produccion = await this.listCarne(animalId);
            const ultimoRegistro = produccion[produccion.length - 1];
            
            return {
                pesoActual: ultimoRegistro.peso,
                proyeccionDias: diasHasta,
                pesoProyectado: (ultimoRegistro.peso + (parseFloat(ganancia.gananciaDiaria) * diasHasta)).toFixed(2)
            };
        }, { action: 'proyectarPesoFinal', animalId });
    },

    // ---- PRODUCCIÓN LECHE (Cifrada con AES-GCM) ----
    async listLeche(fincaId) {
        return await ErrorHandler.tryAsync(async () => {
            ErrorHandler.validateRequired('fincaId', fincaId, 'FincaId requerido para descifrar producción de leche');
            
            const records = await window.db.getAll('produccion_leche');
            const decryptedRecords = [];

            for (const record of records) {
                if (record.fincaId === fincaId) {
                    try {
                        const decryptedData = await window.CryptoUtils.decryptData(record.encrypted, record.iv, fincaId);
                        decryptedRecords.push({ id: record.id, ...decryptedData });
                    } catch (e) {
                        console.error(`Error descifrando produccion_leche ID ${record.id}:`, e);
                    }
                }
            }
            return decryptedRecords;
        }, { entity: 'Produccion', action: 'listLeche' });
    },

    /**
     * Calcula promedio de litros/vaca/día
     */
    async calcularPromedioLitrosPorVaca(fincaId) {
        return await ErrorHandler.tryAsync(async () => {
            const produccion = await this.listLeche(fincaId);
            if (produccion.length === 0) return 0;
            
            const totalLitros = produccion.reduce((sum, p) => sum + (p.cantidad_litros || 0), 0);
            const vacasUnicas = new Set(produccion.map(p => p.vacaId)).size;
            
            return (totalLitros / vacasUnicas).toFixed(2);
        }, { action: 'calcularPromedioLitrosPorVaca' });
    },

    /**
     * Identifica vacas de bajo rendimiento
     */
    async identificarBajoRendimiento(fincaId, umbralMinimoDiario = 15) {
        return await ErrorHandler.tryAsync(async () => {
            const produccion = await this.listLeche(fincaId);
            if (produccion.length === 0) return [];
            
            const porVaca = {};
            produccion.forEach(p => {
                if (!porVaca[p.vacaId]) {
                    porVaca[p.vacaId] = { registros: [], totalLitros: 0 };
                }
                porVaca[p.vacaId].registros.push(p);
                porVaca[p.vacaId].totalLitros += p.cantidad_litros || 0;
            });
            
            const bajoRendimiento = [];
            for (const [vacaId, datos] of Object.entries(porVaca)) {
                const promedioLitros = datos.totalLitros / datos.registros.length;
                if (promedioLitros < umbralMinimoDiario) {
                    bajoRendimiento.push({
                        vacaId: Number(vacaId),
                        promedioLitros: promedioLitros.toFixed(2),
                        registros: datos.registros.length,
                        urgencia: promedioLitros < 10 ? 'urgente' : 'atención'
                    });
                }
            }
            
            return bajoRendimiento.sort((a, b) => parseFloat(a.promedioLitros) - parseFloat(b.promedioLitros));
        }, { action: 'identificarBajoRendimiento' });
    },

    /**
     * Proyecta producción mensual
     */
    async proyectarProduccionMensual(fincaId) {
        return await ErrorHandler.tryAsync(async () => {
            const produccion = await this.listLeche(fincaId);
            if (produccion.length === 0) return null;
            
            const ultimos7Dias = produccion.filter(p => {
                const dias = (Date.now() - new Date(p.fecha)) / (24 * 60 * 60 * 1000);
                return dias <= 7;
            });
            
            const promedioUltimos7 = ultimos7Dias.length > 0
                ? ultimos7Dias.reduce((sum, p) => sum + (p.cantidad_litros || 0), 0)
                : 0;
            
            return {
                litrosUltimos7Dias: promedioUltimos7.toFixed(2),
                proyeccionMensual: (promedioUltimos7 * 4.3).toFixed(2),
                registrosUltimos7Dias: ultimos7Dias.length
            };
        }, { action: 'proyectarProduccionMensual' });
    },

    async saveLeche(data, fincaId) {
        return await ErrorHandler.tryAsync(async () => {
            ErrorHandler.validateRequired('fincaId', fincaId, 'FincaId requerido para cifrar producción de leche');

            const esEdicion = data.id !== undefined && data.id !== null && data.id !== '';

            // Obtener el animal para snapshot de contexto
            const animal = await window.db.get('animales', Number(data.vacaId));

            // Capturar Snapshot de contexto
            const rebanoId = animal && animal.rebanoId ? animal.rebanoId : null;
            const snapMetadata = await window.SnapshotService.buildSnapMetadata(rebanoId);
            // Add snap_rebano if we have the animal and rebano
            if (rebanoId) {
                const rebano = await window.db.get('rebanos', Number(rebanoId));
                if (rebano) {
                    snapMetadata.snap_rebano = rebano.nombre;
                }
            }

            const payload = {
                vacaId: Number(data.vacaId),
                fecha: data.fecha,
                cantidad_litros: Number(data.cantidad_litros) || 0,
                analisis_grasa_proteina: data.analisis_grasa_proteina || {},
                ...snapMetadata,
                creadoEn: data.creadoEn || new Date().toISOString(),
                actualizadoEn: new Date().toISOString()
            };

            const { encrypted, iv } = await window.CryptoUtils.encryptData(payload, fincaId);
            
            const dbRecord = {
                fincaId: fincaId,
                vacaId: payload.vacaId,
                fecha: payload.fecha,
                encrypted,
                iv
            };

            if (esEdicion) {
                dbRecord.id = Number(data.id);
                await window.db.put('produccion_leche', dbRecord);
                if (window.EventBus) {
                    window.EventBus.emit('leche:entrega', { entregaId: dbRecord.id, vacaId: payload.vacaId, cantidad: payload.cantidad_litros });
                }
                return dbRecord.id;
            } else {
                const newId = await window.db.add('produccion_leche', dbRecord);
                if (window.EventBus) {
                    window.EventBus.emit('leche:entrega', { entregaId: newId, vacaId: payload.vacaId, cantidad: payload.cantidad_litros });
                }
                return newId;
            }
        }, { entity: 'Produccion', action: 'saveLeche' });
    },

    // ---- VENTAS GANADO (Cifradas con AES-GCM) ----
    async listVentas(fincaId) {
        return await ErrorHandler.tryAsync(async () => {
            ErrorHandler.validateRequired('fincaId', fincaId, 'FincaId requerido para descifrar ventas');
            
            const records = await window.db.getAllFromIndex('ventas_ganado', 'fincaId', fincaId);
            const decryptedRecords = [];

            for (const record of records) {
                try {
                    const decryptedData = await window.CryptoUtils.decryptData(record.encrypted, record.iv, fincaId);
                    decryptedRecords.push({ id: record.id, ...decryptedData, fecha: record.fecha });
                } catch (e) {
                    console.error(`Error descifrando ventas_ganado ID ${record.id}:`, e);
                }
            }
            return decryptedRecords.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        }, { entity: 'Produccion', action: 'listVentas' });
    },

    /**
     * Análisis de rentabilidad: Ingresos vs Gastos
     */
    async analizarRentabilidad(fincaId) {
        return await ErrorHandler.tryAsync(async () => {
            // Ingresos por ventas
            const ventas = await this.listVentas(fincaId);
            const totalIngresos = ventas.reduce((sum, v) => sum + (v.precio_total || 0), 0);
            
            // Gastos
            const gastos = await Gastos.list(fincaId);
            const totalGastos = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);
            
            // Margen
            const margenNeto = totalIngresos - totalGastos;
            const porcentajeMargen = totalIngresos > 0 ? ((margenNeto / totalIngresos) * 100).toFixed(2) : 0;
            
            return {
                totalIngresos: totalIngresos.toFixed(2),
                totalGastos: totalGastos.toFixed(2),
                margenNeto: margenNeto.toFixed(2),
                porcentajeMargen,
                ventasRegistradas: ventas.length,
                gastosRegistrados: gastos.length,
                rentable: margenNeto > 0
            };
        }, { action: 'analizarRentabilidad' });
    },

    /**
     * Promedio de precio por kg de venta
     */
    async calcularPrecioPromedioKg(fincaId) {
        return await ErrorHandler.tryAsync(async () => {
            const ventas = await this.listVentas(fincaId);
            if (ventas.length === 0) return 0;
            
            let totalAnimales = 0;
            let totalIngresos = 0;
            
            ventas.forEach(v => {
                totalAnimales += v.animal_id_list?.length || 1;
                totalIngresos += v.precio_total || 0;
            });
            
            // Asumir peso promedio de 300kg por animal (simplificación)
            const totalKg = totalAnimales * 300;
            
            return (totalIngresos / totalKg).toFixed(2);
        }, { action: 'calcularPrecioPromedioKg' });
    },

    /**
     * Historial de precios para trending
     */
    async historialPrecios(fincaId, diasAtras = 90) {
        return await ErrorHandler.tryAsync(async () => {
            const ventas = await this.listVentas(fincaId);
            const fechaLimite = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);
            
            return ventas
                .filter(v => new Date(v.fecha) >= fechaLimite)
                .map(v => ({
                    fecha: v.fecha,
                    precioTotal: v.precio_total,
                    animales: v.animal_id_list?.length || 1,
                    precioPromedio: (v.precio_total / (v.animal_id_list?.length || 1)).toFixed(2)
                }))
                .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        }, { action: 'historialPrecios' });
    },

    async saveVentas(data, fincaId) {
        return await ErrorHandler.tryAsync(async () => {
            ErrorHandler.validateRequired('fincaId', fincaId, 'FincaId requerido para cifrar ventas');
            
            const esEdicion = data.id !== undefined && data.id !== null && data.id !== '';
            
            const payload = {
                animal_id_list: data.animal_id_list || [],
                precio_total: Number(data.precio_total) || 0,
                comprador: data.comprador || "",
                documentacion: data.documentacion || "",
                creadoEn: data.creadoEn || new Date().toISOString(),
                actualizadoEn: new Date().toISOString()
            };

            const { encrypted, iv } = await window.CryptoUtils.encryptData(payload, fincaId);
            
            const dbRecord = {
                fincaId: fincaId,
                fecha: data.fecha || new Date().toISOString().split('T')[0],
                encrypted,
                iv
            };

            if (esEdicion) {
                dbRecord.id = Number(data.id);
                await window.db.put('ventas_ganado', dbRecord);
                if (window.EventBus) {
                    window.EventBus.emit('venta:created', { ventaId: dbRecord.id, total: payload.precio_total });
                }
                return dbRecord.id;
            } else {
                const newId = await window.db.add('ventas_ganado', dbRecord);
                if (window.EventBus) {
                    window.EventBus.emit('venta:created', { ventaId: newId, total: payload.precio_total });
                }
                return newId;
            }
        }, { entity: 'Produccion', action: 'saveVentas' });
    }
};

window.Produccion = Produccion;
