/**
 * Módulo Importador - Parsea y transforma datos desde CORK_BACKUP.json
 * Extrae solo: Finca (nombre, propietario, dirección, teléfono), Zonas con parcelas
 */

const Importador = {
    /**
     * Importar desde archivo backup JSON
     * @param {File} archivo - Archivo JSON a procesar
     * @returns {Object} {fincas: [], errores: []}
     */
    async importarDesdeBackup(archivo) {
        try {
            const contenido = await this._leerArchivo(archivo);
            const datos = JSON.parse(contenido);
            
            // Detección de Backup Completo v3.0 (Estructura de tablas directas)
            const esBackupCompleto = datos.hasOwnProperty('config_especies') || datos.hasOwnProperty('animales') || datos.hasOwnProperty('rebanos');

            if (esBackupCompleto) {
                // Lógica de Restauración Total (Igual que en Ajustes)
                const stores = Object.keys(datos);
                for (let storeName of stores) {
                    if (window.db.objectStoreNames.contains(storeName)) {
                        await window.db.clear(storeName); // Limpiar datos actuales
                        for (let item of datos[storeName]) {
                            await window.db.put(storeName, item); // Insertar datos del backup
                        }
                    }
                }
                return { fincas: [], errores: [], isBackupCompleto: true }; // Indicador de éxito total
            }

            // Lógica Legada (Solo extraer fincas de CORK_BACKUP original)
            if (!datos.fincas || !Array.isArray(datos.fincas)) {
                throw new Error('Formato de backup inválido: falta array "fincas"');
            }

            const fincas = [];
            const errores = [];

            for (let i = 0; i < datos.fincas.length; i++) {
                try {
                    const fincaTransformada = this.extraerDatosFinca(datos.fincas[i]);
                    fincas.push(fincaTransformada);
                } catch (e) {
                    errores.push(`Finca ${i + 1}: ${e.message}`);
                }
            }

            if (fincas.length === 0 && errores.length > 0) {
                throw new Error(`No se pudieron procesar fincas: ${errores.join('; ')}`);
            }

            return { fincas, errores, isBackupCompleto: false };
        } catch (error) {
            throw new Error(`Error al importar backup: ${error.message}`);
        }
    },

    /**
     * Extraer datos específicos de una finca del backup
     * @param {Object} objFinca - Objeto finca del backup
     * @returns {Object} Finca transformada para BD
     */
    extraerDatosFinca(objFinca) {
        try {
            // Intentar extraer de 'info' o directamente del objeto raíz (flexibilidad de formato)
            const info = objFinca.info || objFinca;
            
            const nombre = info.nombre || '';
            const propietario = info.propietario || '';
            const direccion = info.direccion || '';
            const telefonoContacto = info.telefono || info.telefonoContacto || '';

            // Validar campos requeridos
            this.validarEsquemaFinca({ nombre, propietario, direccion });

            // Extraer zonas
            const zonas = this._extraerZonas(objFinca.zonas || []);

            return {
                nombre: nombre.toString().trim(),
                propietario: propietario.toString().trim(),
                direccion: direccion.toString().trim(),
                telefonoContacto: telefonoContacto.toString().trim(),
                zonas: zonas,
                creadoEn: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Error extrayendo finca: ${error.message}`);
        }
    },

    /**
     * Validar esquema de finca
     * @param {Object} datos - Datos a validar
     * @throws {Error} Si validación falla
     */
    validarEsquemaFinca(datos) {
        if (!datos.nombre || datos.nombre.toString().trim() === '') {
            throw new Error('Nombre de finca es requerido');
        }
        if (!datos.propietario || datos.propietario.toString().trim() === '') {
            throw new Error('Propietario es requerido');
        }

        if (datos.nombre.toString().length > 100) {
            throw new Error('Nombre no puede exceder 100 caracteres');
        }
        if (datos.propietario.toString().length > 100) {
            throw new Error('Propietario no puede exceder 100 caracteres');
        }
    },

    /**
     * Extraer y transformar zonas del backup
     * @param {Array} zonasBackup - Array de zonas del backup
     * @returns {Array} Zonas transformadas
     */
    _extraerZonas(zonasBackup) {
        if (!Array.isArray(zonasBackup)) return [];

        return zonasBackup.map(zona => ({
            nombre: (zona.nombre || '').trim(),
            refCatastral: (zona.refCatastral || '').trim(),
            localizacion: (zona.localizacion || '').trim(),
            municipio: (zona.municipio || '').trim(),
            provincia: (zona.provincia || '').trim(),
            poligono: zona.poligono || null,
            parcela: zona.parcela || null,
            cultivos: Array.isArray(zona.cultivos) ? zona.cultivos : [],
            notas: (zona.notas || '').trim()
        }));
    },

    /**
     * Leer contenido de archivo
     * @param {File} archivo - Archivo a leer
     * @returns {Promise<string>} Contenido del archivo
     */
    _leerArchivo(archivo) {
        return new Promise((resolve, reject) => {
            if (!archivo) {
                reject(new Error('No se seleccionó archivo'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Error leyendo archivo'));
            reader.readAsText(archivo);
        });
    },

    /**
     * Validar formato de teléfono (opcional)
     * @param {string} telefono - Teléfono a validar
     * @returns {boolean} True si es válido o está vacío
     */
    validarTelefono(telefono) {
        if (!telefono || telefono.trim() === '') return true;
        // Simple validation: solo números, espacios, guiones, +
        return /^[\d\s\-\+()]*$/.test(telefono);
    }
};

window.Importador = Importador;
