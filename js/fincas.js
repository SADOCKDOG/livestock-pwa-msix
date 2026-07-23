const Fincas = {
    // Normalización única del código REGA: usa ComunidadesService (criterio SIGGAN:
    // mayúsculas + elimina separadores) con fallback simple si no está cargado.
    _normalizarREGA(value) {
        return window.ComunidadesService
            ? window.ComunidadesService.normalizarREGA(value || '')
            : (value || '').toString().trim().toUpperCase();
    },

    async list() {
        const list = await window.db.getAll('fincas');
        if (list) {
            list.forEach(f => {
                if (f) {
                    const regaVal = this._normalizarREGA(f.rega || f.codigo_REGA);
                    f.rega = regaVal;
                    f.codigo_REGA = regaVal;
                }
            });
        }
        return list;
    },

    async get(id) {
        const f = await window.db.get('fincas', Number(id));
        if (f) {
            const regaVal = this._normalizarREGA(f.rega || f.codigo_REGA);
            f.rega = regaVal;
            f.codigo_REGA = regaVal;
        }
        return f;
    },

    async getActiveId() {
        let id = localStorage.getItem('activeFincaIdLivestock');

        // 1. Recuperar de IndexedDB (tabla meta) si localStorage es volátil y se borró
        if (!id) {
            try {
                const meta = await window.db.get('meta', 'activeFincaId');
                if (meta && meta.value) {
                    id = meta.value;
                    localStorage.setItem('activeFincaIdLivestock', id);
                }
            } catch (e) { console.warn("[Fincas] Error leyendo meta", e); }
        }

        // 2. Autorecuperación de seguridad: Si se perdió el ID pero hay fincas, auto-seleccionar la primera
        if (!id) {
            const todasFincas = await this.list();
            if (todasFincas.length > 0) {
                id = todasFincas[0].id;
                await this.setActiveId(id);
            } else {
                return null;
            }
        }

        // Verificar que la finca realmente existe en la DB actual
        const finca = await this.get(id).catch(() => null);
        if (!finca) {
            localStorage.removeItem('activeFincaIdLivestock');
            try { await window.db.delete('meta', 'activeFincaId'); } catch (e) { }
            return null;
        }
        return Number(id);
    },

    async getActive() {
        const id = await this.getActiveId();
        if (!id) return null;
        const finca = await this.get(id);

        // Migración Gap 9: Ensure zonas tienen codigo_pac y distancia_agua_m
        if (finca && finca.zonas && Array.isArray(finca.zonas)) {
            let needsUpdate = false;
            finca.zonas.forEach((zona, idx) => {
                if (zona) {
                    if (!zona.hasOwnProperty('codigo_pac')) {
                        // Auto-generar código PAC basado en índice: ES-BA-{fincaId}-{zonaIdx}
                        // Formato: ES-BA-0001-001, ES-BA-0001-002, etc.
                        const fincaNum = String(finca.id || 1).padStart(4, '0');
                        const zonaNum = String(idx + 1).padStart(3, '0');
                        finca.zonas[idx].codigo_pac = `ES-BA-${fincaNum}-${zonaNum}`;
                        needsUpdate = true;
                    }
                    if (!zona.hasOwnProperty('distancia_agua_m')) {
                        finca.zonas[idx].distancia_agua_m = 100; // Default 100m
                        needsUpdate = true;
                    }
                }
            });
            if (needsUpdate) {
                finca.actualizadoEn = new Date().toISOString();
                try {
                    await window.db.put('fincas', finca);
                } catch (e) {
                    console.warn('[Fincas] Error guardando migración de zonas:', e.message);
                }
            }
        }

        return finca;
    },

    async setActiveId(id) {
        localStorage.setItem('activeFincaIdLivestock', id);
        try {
            await window.db.put('meta', { key: 'activeFincaId', value: id });
        } catch (e) { console.warn("[Fincas] Error guardando meta", e); }
        window.dispatchEvent(new CustomEvent('fincaChanged', { detail: { id } }));
    },

    /**
     * Límite Free: 1 finca. Punto único de verificación para TODA vía de alta
     * de finca (save() de una nueva, crearNueva(), importación futura...), para
     * que ningún wizard/vista tenga que acordarse de comprobarlo por su cuenta.
     * Lanza si no se cumple; no hace nada si se cumple.
     */
    async _assertPuedeCrearFinca(datos) {
        if (datos && datos.demo) return; // datos de demostración: siempre permitido
        if (!(window.PremiumManager && window.PremiumManager.isFree())) return; // Premium: sin límite
        const existentes = await this.list();
        if (existentes.length > 0) {
            throw new Error('La creación de varias fincas solo está disponible en la versión Premium');
        }
    },

    async save(data) {
        const esNueva = !(data && data.id !== undefined && data.id !== null && data.id !== '');
        if (esNueva) await this._assertPuedeCrearFinca(data);

        if (data) {
            const regaVal = this._normalizarREGA(data.rega || data.codigo_REGA);
            if (regaVal && window.ComunidadesService?.validarFormatoREGA) {
                const validacion = window.ComunidadesService.validarFormatoREGA(
                    regaVal,
                    data.comunidad_autonoma || null
                );
                if (!validacion?.valido) {
                    throw new Error(validacion?.mensaje || 'Código REGA inválido');
                }
            }
            data.rega = regaVal;
            data.codigo_REGA = regaVal;

            // Datos geográficos (gap "Estructura -> Datos Geográficos" del mapa ADSG
            // WEB, ver docs/PLAN-MEJORA-SIGGAN.md punto 5). Opcionales, pero si se
            // aportan deben ser coordenadas válidas dentro de España peninsular/
            // insular/Canarias (rango amplio, no exhaustivo por comunidad).
            if (data.latitud !== undefined && data.latitud !== null && data.latitud !== '') {
                const lat = Number(data.latitud);
                if (isNaN(lat) || lat < 27 || lat > 44) {
                    throw new Error('Latitud inválida: debe estar entre 27 y 44 (España, incluidas Canarias)');
                }
                data.latitud = lat;
            } else {
                data.latitud = null;
            }
            if (data.longitud !== undefined && data.longitud !== null && data.longitud !== '') {
                const lon = Number(data.longitud);
                if (isNaN(lon) || lon < -19 || lon > 5) {
                    throw new Error('Longitud inválida: debe estar entre -19 y 5 (España, incluidas Canarias)');
                }
                data.longitud = lon;
            } else {
                data.longitud = null;
            }
        }

        // Flags de tipo de explotación (Leche/Carne) recogidos en el wizard, si vienen.
        // Son por finca: se guardan vía ModoContextoHelper, no como campo del registro de finca.
        const flagsExplotacion = (data.flag_leche !== undefined || data.flag_carne !== undefined)
            ? { leche: !!data.flag_leche, carne: !!data.flag_carne }
            : null;
        delete data.flag_leche;
        delete data.flag_carne;

        const esEdicion = !esNueva;

        // Process zonas to ensure they have unique IDs (for both new and updated fincas)
        if (data.zonas && Array.isArray(data.zonas)) {
            // Find the maximum existing ID to avoid conflicts
            const maxExistingId = data.zonas.reduce((max, zona) => {
                return zona.id && typeof zona.id === 'number' ? Math.max(max, zona.id) : max;
            }, 0);
            let nextId = Math.max(maxExistingId + 1, 1); // Start at 1

            // Ensure all zonas have IDs
            data.zonas = data.zonas.map(zona => {
                // If zona already has a valid numeric ID, keep it
                if (zona.id && typeof zona.id === 'number' && zona.id > 0) {
                    return zona;
                }
                // Otherwise assign a new sequential ID
                return {...zona, id: nextId++};
            });
        }

        // Instalaciones de la finca (gap "Estructura" del mapa ADSG WEB, ver
        // docs/PLAN-MEJORA-SIGGAN.md punto 5) — mismo patrón de IDs que zonas.
        if (data.instalaciones && Array.isArray(data.instalaciones)) {
            const maxExistingId = data.instalaciones.reduce((max, inst) => {
                return inst.id && typeof inst.id === 'number' ? Math.max(max, inst.id) : max;
            }, 0);
            let nextId = Math.max(maxExistingId + 1, 1);

            data.instalaciones = data.instalaciones.map(inst => {
                if (!inst.tipoId) {
                    throw new Error('Cada instalación debe tener un tipo asignado del catálogo oficial.');
                }
                if (inst.id && typeof inst.id === 'number' && inst.id > 0) {
                    return inst;
                }
                return { ...inst, id: nextId++ };
            });
        }

        // Subexplotaciones (gap "Subexplotación" de docs/PLAN-MEJORA-SIGGAN.md
        // punto 7): SIEX no relaciona animales directamente con la finca, sino
        // con una subdivisión por especie (REGA + especie + clasificación
        // zootécnica). Capa aditiva y opcional — mismo patrón de IDs que
        // zonas/instalaciones; una explotación de una sola especie puede
        // ignorarla por completo y seguir usando tipo_explotacion/
        // sistema_explotacion a nivel de finca como hasta ahora.
        if (data.subexplotaciones && Array.isArray(data.subexplotaciones)) {
            const maxExistingId = data.subexplotaciones.reduce((max, sub) => {
                return sub.id && typeof sub.id === 'number' ? Math.max(max, sub.id) : max;
            }, 0);
            let nextId = Math.max(maxExistingId + 1, 1);

            const especiesVistas = new Set();
            data.subexplotaciones = data.subexplotaciones.map(sub => {
                if (!sub.especieId) {
                    throw new Error('Cada subexplotación debe tener una especie asignada.');
                }
                if (!sub.anulada) {
                    if (especiesVistas.has(Number(sub.especieId))) {
                        throw new Error('Ya existe una subexplotación activa para esa especie (una por especie, según SIEX).');
                    }
                    especiesVistas.add(Number(sub.especieId));
                }
                if (sub.id && typeof sub.id === 'number' && sub.id > 0) {
                    return sub;
                }
                return { ...sub, id: nextId++ };
            });
        }

        if (esEdicion) {
            data.id = Number(data.id);
            await window.db.put('fincas', data);
            if (flagsExplotacion && window.ModoContextoHelper) {
                window.ModoContextoHelper.setFlags(flagsExplotacion, data.id);
            }
            return data.id;
        } else {
            delete data.id;
            const newId = await window.db.add('fincas', {
                ...data,
                creadoEn: new Date().toISOString()
            });

            if (!(await this.getActiveId())) {
                await this.setActiveId(newId);
            }
            if (flagsExplotacion && window.ModoContextoHelper) {
                window.ModoContextoHelper.setFlags(flagsExplotacion, newId);
            }
            return newId;
        }
    },

    async delete(id) {
        const numId = Number(id);
        const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', numId);

        if (rebanos.length > 0) {
            throw new Error('No se puede eliminar la finca porque tiene rebaños asociados.');
        }
        return window.db.delete('fincas', numId);
    },

    /**
     * Importar múltiples fincas masivamente
     * Sobrescribe fincas existentes con mismo nombre
     * @param {Array} fincasData - Array de objetos finca a importar
     * @returns {Object} {importadas: [], errores: []}
     */
    async importarMasivo(fincasData) {
        return await ErrorHandler.tryAsync(async () => {
            if (!Array.isArray(fincasData) || fincasData.length === 0) {
                throw new Error('No hay fincas para importar');
            }

            const importadas = [];
            const errores = [];

            for (let i = 0; i < fincasData.length; i++) {
                try {
                    const finca = fincasData[i];

                    // Validar campos requeridos
                    ErrorHandler.validateRequired('nombre', finca.nombre, 'Nombre es requerido');
                    ErrorHandler.validateRequired('propietario', finca.propietario, 'Propietario es requerido');

                    const regaVal = this._normalizarREGA(finca.rega || finca.codigo_REGA);
                    finca.rega = regaVal;
                    finca.codigo_REGA = regaVal;

                    // Buscar si finca con mismo nombre ya existe
                    const existentes = await this.list();
                    const fincaExistente = existentes.find(f => f.nombre === finca.nombre);

                    let fincaId;
                    if (fincaExistente) {
                        // Actualizar finca existente manteniendo el ID
                        const fincaActualizada = {
                            ...finca,
                            id: fincaExistente.id,
                            actualizadoEn: new Date().toISOString()
                        };
                        await window.db.put('fincas', fincaActualizada);
                        fincaId = fincaExistente.id;
                    } else {
                        // Crear nueva finca
                        const nuevaFinca = {
                            ...finca,
                            creadoEn: new Date().toISOString()
                        };
                        delete nuevaFinca.id;
                        fincaId = await window.db.add('fincas', nuevaFinca);
                    }

                    // Si es la primera finca que se importa y no hay activa, ponerla como activa
                    if (!(await this.getActiveId())) {
                        await this.setActiveId(fincaId);
                    }

                    importadas.push({
                        id: fincaId,
                        nombre: finca.nombre,
                        accion: fincaExistente ? 'actualizada' : 'creada'
                    });
                } catch (error) {
                    errores.push(`Finca ${i + 1} (${fincasData[i].nombre}): ${error.message}`);
                }
            }

            return {
                importadas,
                errores,
                total: fincasData.length,
                exitosas: importadas.length,
                fallidas: errores.length
            };
        }, { action: 'importarMasivo' });
    },

    /**
     * Crear nueva finca manualmente
     * @param {Object} datos - {nombre, propietario, direccion, telefonoContacto, zonas}
     * @returns {number} ID de la finca creada
     */
    async crearNueva(datos) {
        return await ErrorHandler.tryAsync(async () => {
            await this._assertPuedeCrearFinca(datos);
            // Validar campos requeridos
            ErrorHandler.validateRequired('nombre', datos.nombre, 'Nombre es requerido');
            ErrorHandler.validateRequired('propietario', datos.propietario, 'Propietario es requerido');

            // Validar que no exista con mismo nombre
            const existentes = await this.list();
            if (existentes.some(f => f.nombre === datos.nombre)) {
                throw new Error(`Ya existe una finca con nombre "${datos.nombre}"`);
            }

            // Crear finca nueva
            const regaNorm = this._normalizarREGA(datos.rega || datos.codigo_REGA);

            // Process zonas to ensure they have unique IDs
            let zonasProcesadas = [];
            if (datos.zonas && Array.isArray(datos.zonas)) {
                // Find the maximum existing ID to avoid conflicts
                const maxExistingId = datos.zonas.reduce((max, zona) => {
                    return zona.id && typeof zona.id === 'number' ? Math.max(max, zona.id) : max;
                }, 0);
                let nextId = Math.max(maxExistingId + 1, 1); // Start at 1

                // Ensure all zonas have IDs
                zonasProcesadas = datos.zonas.map(zona => {
                    // If zona already has a valid numeric ID, keep it
                    if (zona.id && typeof zona.id === 'number' && zona.id > 0) {
                        return zona;
                    }
                    // Otherwise assign a new sequential ID
                    return {...zona, id: nextId++};
                });
            } else {
                zonasProcesadas = [];
            }

            const nuevaFinca = {
                nombre: datos.nombre.trim(),
                propietario: datos.propietario.trim(),
                direccion: datos.direccion.trim(),
                telefonoContacto: (datos.telefonoContacto || '').trim(),
                nif_cif: (datos.nif_cif || '').trim(),
                email: (datos.email || '').trim(),
                rega: regaNorm,
                // Espejo para compatibilidad con vistas que leen codigo_REGA
                codigo_REGA: regaNorm,
                cea: (datos.cea || '').toString().trim().toUpperCase(),
                adsg_nombre: (datos.adsg_nombre || '').trim(),
                comunidad_autonoma: datos.comunidad_autonoma || '',
                provincia: datos.provincia || '',
                municipio: (datos.municipio || '').trim(),
                tipo_explotacion: datos.tipo_explotacion || '',
                clasificacion_zootecnica: datos.clasificacion_zootecnica || '',
                capacidad_maxima: datos.capacidad_maxima != null ? Number(datos.capacidad_maxima) : null,
                especies_autorizadas: Array.isArray(datos.especies_autorizadas) ? datos.especies_autorizadas : [],
                zonas: zonasProcesadas,
                creadoEn: new Date().toISOString()
            };

            const fincaId = await window.db.add('fincas', nuevaFinca);

            if ((datos.flag_leche !== undefined || datos.flag_carne !== undefined) && window.ModoContextoHelper) {
                window.ModoContextoHelper.setFlags({ leche: !!datos.flag_leche, carne: !!datos.flag_carne }, fincaId);
            }

            // Si es la primera finca, establecerla como activa
            if (!(await this.getActiveId())) {
                await this.setActiveId(fincaId);
            }

            return fincaId;
        }, { action: 'crearNueva', entity: 'Fincas' });
    }
};

window.Fincas = Fincas;