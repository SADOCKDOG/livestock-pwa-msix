console.log("[DB] Cargando script db.js");
const DB_NAME = 'LivestockDB';
const DB_VERSION = 14;

// Clase para base de datos en memoria (Fallback para entornos sandboxed o sin permisos de IndexedDB, como Open Design Desktop)
class InMemoryMockDB {
    constructor() {
        console.log("[DB] Inicializando base de datos simulada en memoria (InMemoryMockDB)");
        this.objectStoreNames = {
            names: [
                'fincas', 'rebanos', 'animales', 'produccion_carne', 'produccion_leche', 
                'ventas_ganado', 'sanitarios_ganado', 'gastos_ganaderia', 'config_especies', 
                'config_tipos_produccion', 'comercializacion_carne', 'comercializacion_leche', 
                'meta', 'registro_eventos', 'reproduccion_eventos', 'compradores', 'proveedores', 
                'contratos_compra', 'transportistas', 'documentos_legales', 'notificaciones_rega', 
                'pedidos_crotales', 'movimientos_ganado', 'saneamientos', 'adsgs', 
                'config_costes_referencia', 'config_silos'
            ],
            contains(name) { return this.names.includes(name); }
        };
        this._stores = {};
        this.objectStoreNames.names.forEach(name => {
            this._stores[name] = [];
        });
        this._seedMockData();
    }

    _seedMockData() {
        // Datos por defecto para que la aplicación muestre información visual premium
        this._stores['fincas'] = [
            { id: 1, nombre: 'Finca El Encinar', REGA: 'ES3712345678', rega: 'ES3712345678', codigo_REGA: 'ES3712345678', superficie: 150, municipio: 'Salamanca', creadoEn: new Date().toISOString() }
        ];
        this._stores['rebanos'] = [
            { id: 1, fincaId: 1, codigo: 'REB-001', nombre: 'Lote Reproductoras Frisonas', especie: 'Vacas', zonaActual: 'Prado Alto', creadoEn: new Date().toISOString() },
            { id: 2, fincaId: 1, codigo: 'REB-002', nombre: 'Terneros Limusín Cebo', especie: 'Vacas', zonaActual: 'Cercado Bajo', creadoEn: new Date().toISOString() }
        ];
        this._stores['animales'] = [
            { id: 1, rebanoId: 1, numero_identificacion: 'ES0811122233', caravana: 'ES0811122233', especie: 'Vacas', raza: 'Frisona', sexo: 'Hembra', fecha_nacimiento: '2022-04-10', estado: 'activo', categoria: 'leche', creadoEn: new Date().toISOString() },
            { id: 2, rebanoId: 1, numero_identificacion: 'ES0811122234', caravana: 'ES0811122234', especie: 'Vacas', raza: 'Limusina', sexo: 'Hembra', fecha_nacimiento: '2021-11-15', estado: 'activo', categoria: 'carne', creadoEn: new Date().toISOString() },
            { id: 3, rebanoId: 2, numero_identificacion: 'ES0911122235', caravana: 'ES0911122235', especie: 'Ovejas', raza: 'Assaf', sexo: 'Hembra', fecha_nacimiento: '2023-01-20', estado: 'activo', categoria: 'leche', creadoEn: new Date().toISOString() }
        ];
        this._stores['config_especies'] = [
            { id: 1, nombre: 'Vacas', consumoAguaL: 60, creadoEn: Date.now() },
            { id: 2, nombre: 'Ovejas', consumoAguaL: 8, creadoEn: Date.now() },
            { id: 3, nombre: 'Cabras', consumoAguaL: 8, creadoEn: Date.now() },
            { id: 4, nombre: 'Cerdos', consumoAguaL: 12, creadoEn: Date.now() }
        ];
        this._stores['config_tipos_produccion'] = [
            { id: 1, nombre: 'Cárnica', creadoEn: Date.now() },
            { id: 2, nombre: 'Láctea', creadoEn: Date.now() },
            { id: 3, nombre: 'Mixto', creadoEn: Date.now() },
            { id: 4, nombre: 'Ibérico', creadoEn: Date.now() }
        ];
        this._stores['meta'] = [
            { key: 'migracion_v8', value: true, migradoEn: new Date().toISOString() },
            { key: 'migracion_v9', value: true, migradoEn: new Date().toISOString() },
            { key: 'contador_albaran', valor: 10, actualizadoEn: new Date().toISOString() },
            { key: 'contador_factura', valor: 5, actualizadoEn: new Date().toISOString() }
        ];
        this._stores['compradores'] = [
            { id: 1, nombre: 'Matadero Central de Salamanca', nif_cif: 'A37123456', tipo_comprador: 'carne', activo: true, creadoEn: new Date().toISOString() },
            { id: 2, nombre: 'Lácteas del Duero', nif_cif: 'B49123456', tipo_comprador: 'leche', activo: true, creadoEn: new Date().toISOString() }
        ];
        this._stores['proveedores'] = [
            { id: 1, nombre: 'Piensos Salamanca S.A.', nif_cif: 'A37987654', activo: true, creadoEn: new Date().toISOString() },
            { id: 2, nombre: 'Veterinaria VetCampo', nif_cif: 'B37111222', activo: true, creadoEn: new Date().toISOString() }
        ];
        this._stores['registro_eventos'] = [
            { id: 1, fincaId: 1, entidad_id: 1, tipo_entidad: 'animal', snap_tipo: 'alta', motivo_tarea: 'Compra externa', fecha: new Date().toISOString().split('T')[0], creadoEn: new Date().toISOString() }
        ];
    }

    async get(storeName, key) {
        const store = this._stores[storeName] || [];
        if (storeName === 'meta') {
            return store.find(item => item.key === key);
        }
        return store.find(item => item.id == key);
    }

    async getAll(storeName) {
        return [...(this._stores[storeName] || [])];
    }

    async add(storeName, item) {
        const store = this._stores[storeName] || [];
        let newId = 1;
        if (store.length > 0) {
            const ids = store.map(i => i.id).filter(id => typeof id === 'number');
            if (ids.length > 0) {
                newId = Math.max(...ids) + 1;
            }
        }
        const newItem = { ...item };
        if (storeName === 'meta') {
            // no numeric id for meta
        } else if (newItem.id === undefined) {
            newItem.id = newId;
        }
        store.push(newItem);
        return storeName === 'meta' ? newItem.key : newItem.id;
    }

    async put(storeName, item) {
        const store = this._stores[storeName] || [];
        if (storeName === 'meta') {
            const idx = store.findIndex(i => i.key === item.key);
            if (idx !== -1) {
                store[idx] = { ...item };
            } else {
                store.push({ ...item });
            }
            return item.key;
        }
        const idx = store.findIndex(i => i.id == item.id);
        if (idx !== -1) {
            store[idx] = { ...item };
        } else {
            store.push({ ...item });
        }
        return item.id;
    }

    async delete(storeName, key) {
        const store = this._stores[storeName] || [];
        if (storeName === 'meta') {
            this._stores[storeName] = store.filter(item => item.key !== key);
        } else {
            this._stores[storeName] = store.filter(item => item.id != key);
        }
    }

    async count(storeName) {
        const store = this._stores[storeName] || [];
        return store.length;
    }

    async getFromIndex(storeName, indexName, value) {
        const store = this._stores[storeName] || [];
        const matched = store.find(item => {
            if (indexName === 'caravana' || indexName === 'numero_identificacion') {
                return item.numero_identificacion === value || item.caravana === value;
            }
            let itemVal = item[indexName];
            if (typeof itemVal === 'string' && typeof value === 'string') {
                return itemVal.toLowerCase() === value.toLowerCase();
            }
            return itemVal == value;
        });
        if (!matched) throw new Error("Key not found in index: " + indexName + " = " + value);
        return matched;
    }

    async getAllFromIndex(storeName, indexName, value) {
        const store = this._stores[storeName] || [];
        return store.filter(item => {
            let itemVal = item[indexName];
            if (['fincaId', 'rebanoId', 'animalId'].includes(indexName)) {
                return Number(itemVal) === Number(value);
            }
            if (typeof itemVal === 'string' && typeof value === 'string') {
                return itemVal.toLowerCase() === value.toLowerCase();
            }
            return itemVal == value;
        });
    }

    transaction(storeNames, mode) {
        const self = this;
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        const tx = {
            done: Promise.resolve(),
            objectStore(name) {
                return {
                    indexNames: {
                        contains: (indexName) => {
                            const knownIndexes = ['fincaId', 'rebanoId', 'animalId', 'caravana', 'numero_identificacion', 'nif_cif', 'activo', 'especie', 'rega', 'dib', 'categoria', 'madre_id', 'numero_albaran', 'dimoe', 'transportistaId', 'autorizacion_veterinaria', 'tipo', 'fecha_emision', 'numero'];
                            return knownIndexes.includes(indexName);
                        }
                    },
                    createIndex: () => {},
                    get: async (key) => await self.get(name, key),
                    getAll: async () => await self.getAll(name),
                    add: async (item) => await self.add(name, item),
                    put: async (item) => await self.put(name, item),
                    delete: async (key) => await self.delete(name, key),
                    count: async () => await self.count(name)
                };
            }
        };
        if (names.length === 1) {
            tx.store = tx.objectStore(names[0]);
        }
        return tx;
    }
}

async function initDB() {
    console.log('[DB] Ejecutando initDB...');

    // Sandbox guard para IndexedDB: Verificar disponibilidad real antes de llamar a librerías
    try {
        if (typeof indexedDB === 'undefined' || !indexedDB) {
            console.warn("[DB] indexedDB no está definido o está bloqueado. Usando base de datos en memoria (InMemoryMockDB).");
            return new InMemoryMockDB();
        }
    } catch (e) {
        console.warn("[DB] Error de seguridad síncrono al consultar indexedDB. Usando base de datos en memoria (InMemoryMockDB). Detalle:", e.message);
        return new InMemoryMockDB();
    }

    if (!self.idb || !self.idb.openDB) {
        console.error("[DB] self.idb no detectado!");
        throw new Error('Librería de base de datos no encontrada (idb-local.js)');
    }

    const { openDB } = self.idb;
    console.log('[DB] Llamando a openDB...');

    try {
        return await openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            console.log(`[DB] Upgrade: v${oldVersion} -> v${newVersion}`);

            // ... (previous versions preserved)

            // v13: Multi-ADSG y Costes de Referencia por Especie
            if (oldVersion < 13) {
                // ADSGs independientes (una finca puede tener varias)
                if (!db.objectStoreNames.contains('adsgs')) {
                    const store = db.createObjectStore('adsgs', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('codigo', 'codigo', { unique: true });
                }

                // Costes de referencia (alimentación estimada)
                if (!db.objectStoreNames.contains('config_costes_referencia')) {
                    const store = db.createObjectStore('config_costes_referencia', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('especie', 'especie');
                }
            }

            // v14: Silos Persistentes (Configuración de Almacén)
            if (oldVersion < 14) {
                if (!db.objectStoreNames.contains('config_silos')) {
                    const store = db.createObjectStore('config_silos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('tipo', 'tipo'); // carne, leche, hibrido
                }
            }

            // v1: Estructura base
            if (oldVersion < 1) {
                if (!db.objectStoreNames.contains('fincas')) {
                    db.createObjectStore('fincas', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('rebanos')) {
                    const store = db.createObjectStore('rebanos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                }
                if (!db.objectStoreNames.contains('animales')) {
                    const store = db.createObjectStore('animales', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('rebanoId', 'rebanoId');
                    store.createIndex('caravana', 'numero_identificacion', { unique: true });
                }
                if (!db.objectStoreNames.contains('produccion_carne')) {
                    const store = db.createObjectStore('produccion_carne', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('animalId', 'animalId');
                }
                if (!db.objectStoreNames.contains('produccion_leche')) {
                    db.createObjectStore('produccion_leche', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('ventas_ganado')) {
                    const store = db.createObjectStore('ventas_ganado', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                }
                if (!db.objectStoreNames.contains('sanitarios_ganado')) {
                    const store = db.createObjectStore('sanitarios_ganado', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('rebanoId', 'rebanoId');
                }
                if (!db.objectStoreNames.contains('gastos_ganaderia')) {
                    const store = db.createObjectStore('gastos_ganaderia', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                }
            }

            // v2: Configuración
            if (oldVersion < 2) {
                if (!db.objectStoreNames.contains('config_especies')) db.createObjectStore('config_especies', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('config_tipos_produccion')) db.createObjectStore('config_tipos_produccion', { keyPath: 'id', autoIncrement: true });
            }

            // v3: Comercialización mejorada
            if (oldVersion < 3) {
                if (!db.objectStoreNames.contains('comercializacion_carne')) {
                    const store = db.createObjectStore('comercializacion_carne', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('animalId', 'animalId');
                }
                if (!db.objectStoreNames.contains('comercializacion_leche')) {
                    const store = db.createObjectStore('comercializacion_leche', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                }
            }

            // v4: Metadatos y Migración
            if (oldVersion < 4) {
                if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
            }

            // v5: Registro Maestro de Eventos (Trazabilidad 360)
            if (oldVersion < 5) {
                if (!db.objectStoreNames.contains('registro_eventos')) {
                    const store = db.createObjectStore('registro_eventos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('entidad_id', 'entidad_id');
                    store.createIndex('tipo_entidad', 'tipo_entidad');
                    store.createIndex('snap_zona', 'snap_zona');
                    store.createIndex('snap_tipo', 'snap_tipo');
                    store.createIndex('motivo_tarea', 'motivo_tarea');
                    store.createIndex('fecha', 'fecha');
                }
            }

            // v6: Módulo de Reproducción
            if (oldVersion < 6) {
                if (!db.objectStoreNames.contains('reproduccion_eventos')) {
                    const store = db.createObjectStore('reproduccion_eventos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('animalId', 'animalId');
                    store.createIndex('tipo_evento', 'tipo_evento'); // celo, inseminacion, diagnostico, parto, aborto
                    store.createIndex('fecha', 'fecha');
                }
            }

            // v7: Índices adicionales para Módulo Lácteo
            if (oldVersion < 7) {
                const lecheStore = transaction.objectStore('comercializacion_leche');
                if (!lecheStore.indexNames.contains('comunidad_autonoma')) {
                    lecheStore.createIndex('comunidad_autonoma', 'comunidad_autonoma');
                }
                if (!lecheStore.indexNames.contains('fechaRecogida')) {
                    lecheStore.createIndex('fechaRecogida', 'fechaRecogida');
                }
                if (!lecheStore.indexNames.contains('contrato_numero')) {
                    lecheStore.createIndex('contrato_numero', 'contrato_numero');
                }
            }

            // v8: Compradores, Proveedores y Contratos
            if (oldVersion < 8) {
                if (!db.objectStoreNames.contains('compradores')) {
                    const store = db.createObjectStore('compradores', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('nif_cif', 'nif_cif', { unique: true });
                    store.createIndex('tipo_comprador', 'tipo_comprador');
                    store.createIndex('activo', 'activo');
                }
                if (!db.objectStoreNames.contains('proveedores')) {
                    const store = db.createObjectStore('proveedores', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('nif_cif', 'nif_cif', { unique: true });
                    store.createIndex('activo', 'activo');
                }
                if (!db.objectStoreNames.contains('contratos_compra')) {
                    const store = db.createObjectStore('contratos_compra', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('compradorId', 'compradorId');
                    store.createIndex('activo', 'activo');
                    store.createIndex('tipo', 'tipo');
                }
                // Añadir índices a stores existentes
                const carneStore = transaction.objectStore('comercializacion_carne');
                if (!carneStore.indexNames.contains('compradorId')) {
                    carneStore.createIndex('compradorId', 'compradorId');
                }
                if (!carneStore.indexNames.contains('contratoId')) {
                    carneStore.createIndex('contratoId', 'contratoId');
                }
                const lecheStore = transaction.objectStore('comercializacion_leche');
                if (!lecheStore.indexNames.contains('compradorId')) {
                    lecheStore.createIndex('compradorId', 'compradorId');
                }
                if (!lecheStore.indexNames.contains('contratoId')) {
                    lecheStore.createIndex('contratoId', 'contratoId');
                }
                const gastosStore = transaction.objectStore('gastos_ganaderia');
                if (!gastosStore.indexNames.contains('proveedorId')) {
                    gastosStore.createIndex('proveedorId', 'proveedorId');
                }
            }

            // v9: Transportistas, Documentos Legales y nuevos índices de trazabilidad
            if (oldVersion < 9) {
                // TRANSPORTISTAS
                if (!db.objectStoreNames.contains('transportistas')) {
                    const store = db.createObjectStore('transportistas', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('nif_cif', 'nif_cif', { unique: true });
                    store.createIndex('activo', 'activo');
                    store.createIndex('matricula', 'matricula');
                }

                // DOCUMENTOS LEGALES (DIMOE, Facturas, Certificados)
                if (!db.objectStoreNames.contains('documentos_legales')) {
                    const store = db.createObjectStore('documentos_legales', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('tipo', 'tipo');          // dimoe, factura, certificado, dib
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('animalId', 'animalId');
                    store.createIndex('numero', 'numero', { unique: true });
                    store.createIndex('fecha_emision', 'fecha_emision');
                }

                // Nuevos índices en FINCAS
                const fincasStore = transaction.objectStore('fincas');
                if (!fincasStore.indexNames.contains('rega')) {
                    fincasStore.createIndex('rega', 'rega', { unique: true });
                }

                // Nuevos índices en ANIMALES
                const animalesStore = transaction.objectStore('animales');
                if (!animalesStore.indexNames.contains('dib')) {
                    animalesStore.createIndex('dib', 'dib', { unique: true });
                }
                if (!animalesStore.indexNames.contains('categoria')) {
                    animalesStore.createIndex('categoria', 'categoria');
                }
                if (!animalesStore.indexNames.contains('madre_id')) {
                    animalesStore.createIndex('madre_id', 'madre_id');
                }

                // Nuevos índices en COMERCIALIZACION_CARNE
                const carneStore = transaction.objectStore('comercializacion_carne');
                if (!carneStore.indexNames.contains('numero_albaran')) {
                    carneStore.createIndex('numero_albaran', 'numero_albaran', { unique: true });
                }
                if (!carneStore.indexNames.contains('dimoe')) {
                    carneStore.createIndex('dimoe', 'dimoe');
                }
                if (!carneStore.indexNames.contains('transportistaId')) {
                    carneStore.createIndex('transportistaId', 'transportistaId');
                }
                if (!carneStore.indexNames.contains('autorizacion_veterinaria')) {
                    carneStore.createIndex('autorizacion_veterinaria', 'autorizacion_veterinaria');
                }
            }

            // v11: SIGGAN — Notificaciones a REGA (migración desde localStorage)
            if (oldVersion < 11) {
                if (!db.objectStoreNames.contains('notificaciones_rega')) {
                    const store = db.createObjectStore('notificaciones_rega', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('animal_id', 'animal_id');
                    store.createIndex('finca_id', 'finca_id');
                    store.createIndex('fecha_notificacion', 'fecha_notificacion');
                    store.createIndex('estado_notificacion', 'estado_notificacion');
                }
            }

            // v12: SIGGAN — Pedidos de Crotales
            if (oldVersion < 12) {
                if (!db.objectStoreNames.contains('pedidos_crotales')) {
                    const store = db.createObjectStore('pedidos_crotales', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId', { unique: false });
                    store.createIndex('fecha_pedido', 'fecha_pedido', { unique: false });
                    store.createIndex('numero_seguimiento', 'numero_seguimiento', { unique: true });
                }
            }

            // v10: SIGGAN — Movimientos oficiales inter-explotación y Saneamientos
            if (oldVersion < 10) {
                // MOVIMIENTOS DE GANADO (guía de origen y sanidad pecuaria)
                if (!db.objectStoreNames.contains('movimientos_ganado')) {
                    const store = db.createObjectStore('movimientos_ganado', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('tipo', 'tipo');                 // entrada | salida
                    store.createIndex('numero_guia', 'numero_guia');
                    store.createIndex('rega_origen', 'rega_origen');
                    store.createIndex('rega_destino', 'rega_destino');
                    store.createIndex('fecha', 'fecha');
                    store.createIndex('animalId', 'animalId', { multiEntry: true });
                }

                // SANEAMIENTOS (campañas oficiales: TBC, brucelosis, etc.)
                if (!db.objectStoreNames.contains('saneamientos')) {
                    const store = db.createObjectStore('saneamientos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('campana', 'campana');
                    store.createIndex('fecha', 'fecha');
                    store.createIndex('calificacion', 'calificacion');
                }
            }
        },
    });
    } catch (e) {
        console.warn("[DB] Error de IndexedDB (normal en entornos de iframe restringidos o sandboxed como Open Design). Usando base de datos simulada en memoria. Detalle:", e);
        return new InMemoryMockDB();
    }
}

async function populateDefaults(db) {
    console.log("[DB] Verificando datos por defecto...");
    
    // Especies por defecto
    const especiesCount = await db.count('config_especies');
    if (especiesCount === 0) {
        const especies = [
            { nombre: 'Vacas', consumoAguaL: 60 },
            { nombre: 'Ovejas', consumoAguaL: 8 },
            { nombre: 'Cabras', consumoAguaL: 8 },
            { nombre: 'Cerdos', consumoAguaL: 12 }
        ];
        for (let e of especies) { await db.add('config_especies', { ...e, creadoEn: Date.now() }); }
    }

    // Tipos de producción por defecto
    const tiposCount = await db.count('config_tipos_produccion');
    if (tiposCount === 0) {
        const tipos = [
            { nombre: 'Cárnica' },
            { nombre: 'Láctea' },
            { nombre: 'Mixto' },
            { nombre: 'Ibérico' }
        ];
        for (let t of tipos) { await db.add('config_tipos_produccion', { ...t, creadoEn: Date.now() }); }
    }
}

/**
 * Migración v8: Extraer compradores y proveedores únicos de registros existentes
 * y crear entidades en los nuevos stores.
 */
async function migrarV8(windowDb) {
    try {
        console.log("[DB] Migración v8: compradores y proveedores...");

        // --- COMPRADORES desde comercializacion_carne ---
        const ventasCarne = await windowDb.getAll('comercializacion_carne');
        const paresUnicos = new Map();
        for (const v of ventasCarne) {
            const key = (v.nifComprador || '').trim().toUpperCase() || (v.razonSocial || '').trim().toLowerCase();
            if (!key) continue;
            if (!paresUnicos.has(key)) {
                paresUnicos.set(key, {
                    nif_cif: (v.nifComprador || '').trim(),
                    nombre: (v.razonSocial || '').trim(),
                    tipo_comprador: 'híbrido'
                });
            }
        }

        // Crear compradores si no existen por NIF
        for (const [_, datos] of paresUnicos) {
            if (!datos.nif_cif && !datos.nombre) continue;
            try {
                const existente = datos.nif_cif ? await windowDb.getFromIndex('compradores', 'nif_cif', datos.nif_cif.toUpperCase()).catch(() => null) : null;
                if (!existente) {
                    const newId = await windowDb.add('compradores', {
                        nombre: datos.nombre || datos.nif_cif || 'Comprador migrado',
                        nif_cif: (datos.nif_cif || '').toUpperCase(),
                        tipo_comprador: datos.tipo_comprador || 'híbrido',
                        activo: true,
                        creadoEn: new Date().toISOString(),
                        notas: 'Creado automáticamente desde registros de ventas existentes.'
                    });
                    // Asignar compradorId a las ventas de este comprador
                    for (const v of ventasCarne) {
                        const vKey = (v.nifComprador || '').trim().toUpperCase() || (v.razonSocial || '').trim().toLowerCase();
                        const dKey = (datos.nif_cif || '').toUpperCase() || (datos.nombre || '').trim().toLowerCase();
                        if (vKey === dKey) {
                            v.compradorId = newId;
                            await windowDb.put('comercializacion_carne', v);
                        }
                    }
                } else {
                    // Asignar compradorId a las ventas ya existentes
                    for (const v of ventasCarne) {
                        if (!v.compradorId) {
                            const vKey = (v.nifComprador || '').trim().toUpperCase() || (v.razonSocial || '').trim().toLowerCase();
                            const eKey = (existente.nif_cif || '').toUpperCase() || (existente.nombre || '').trim().toLowerCase();
                            if (vKey === eKey) {
                                v.compradorId = existente.id;
                                await windowDb.put('comercializacion_carne', v);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn("[DB] Error migrando comprador:", e.message);
            }
        }

        // --- PROVEEDORES desde gastos_ganaderia ---
        const gastos = await windowDb.getAll('gastos_ganaderia');
        const proveedoresUnicos = new Map();
        for (const g of gastos) {
            const prov = (g.proveedor || '').trim();
            if (!prov) continue;
            const key = prov.toLowerCase();
            if (!proveedoresUnicos.has(key)) {
                proveedoresUnicos.set(key, prov);
            }
        }

        for (const [_, nombre] of proveedoresUnicos) {
            try {
                const existente = await windowDb.getFromIndex('proveedores', 'nif_cif', nombre.toUpperCase()).catch(() => null);
                if (!existente) {
                    const newId = await windowDb.add('proveedores', {
                        nombre: nombre,
                        nif_cif: '',
                        categorias: [],
                        activo: true,
                        creadoEn: new Date().toISOString(),
                        notas: 'Creado automáticamente desde registros de gastos existentes.'
                    });
                    for (const g of gastos) {
                        if ((g.proveedor || '').trim().toLowerCase() === nombre.toLowerCase() && !g.proveedorId) {
                            g.proveedorId = newId;
                            await windowDb.put('gastos_ganaderia', g);
                        }
                    }
                } else {
                    for (const g of gastos) {
                        if ((g.proveedor || '').trim().toLowerCase() === nombre.toLowerCase() && !g.proveedorId) {
                            g.proveedorId = existente.id;
                            await windowDb.put('gastos_ganaderia', g);
                        }
                    }
                }
            } catch (e) {
                console.warn("[DB] Error migrando proveedor:", e.message);
            }
        }

        // Marcar migración completada
        await windowDb.put('meta', { key: 'migracion_v8', value: true, migradoEn: new Date().toISOString() });
        console.log("[DB] Migración v8 completada.");
    } catch (e) {
        console.warn("[DB] Error en migración v8:", e);
    }
}

/**
 * Migración v9: Asignar números de albarán secuenciales a registros existentes
 * y crear documentos_legales DIMOE para ventas sin ellos.
 */
async function migrarV9(windowDb) {
    try {
        console.log("[DB] Migración v9: albaranes y documentos legales...");

        const ventasCarne = await windowDb.getAll('comercializacion_carne');
        const metaSerie = await windowDb.get('meta', 'contador_albaran').catch(() => null);
        let contador = metaSerie ? (metaSerie.valor || 0) : 0;
        const year = new Date().getFullYear();

        for (const v of ventasCarne) {
            if (!v.numero_albaran) {
                contador++;
                v.numero_albaran = `${year}-${String(contador).padStart(4, '0')}`;
                await windowDb.put('comercializacion_carne', v);
            }
        }

        await windowDb.put('meta', { key: 'contador_albaran', valor: contador, actualizadoEn: new Date().toISOString() });

        // --- Crear documentos_legales (DIMOE) ---
        const docsExistentes = await windowDb.getAll('documentos_legales').catch(() => []);
        const dimoeExistentes = new Set(docsExistentes.filter(d => d.tipo === 'dimoe').map(d => d.ventaId));

        let dimoeContador = 0;
        for (const v of ventasCarne) {
            if (!v.numero_albaran) continue;
            if (dimoeExistentes.has(v.id)) continue;

            dimoeContador++;
            const finca = await windowDb.get('fincas', Number(v.fincaId)).catch(() => null);
            const dimoe = {
                tipo: 'dimoe',
                ventaId: v.id,
                animalId: v.animalId || null,
                fincaId: v.fincaId || null,
                numero: `DIMOE-${v.numero_albaran}`,
                fecha_emision: v.fechaSacrificio || new Date().toISOString().split('T')[0],
                origen_rega: finca?.codigo_REGA || finca?.rega || '',
                destino: v.codigoMatadero || '',
                motivo: 'sacrificio',
                created_at: new Date().toISOString()
            };
            await windowDb.add('documentos_legales', dimoe).catch(() => {});
        }

        await windowDb.put('meta', { key: 'migracion_v9', value: true, migradoEn: new Date().toISOString() });
        console.log("[DB] Migración v9 completada.");
    } catch (e) {
        console.warn("[DB] Error en migración v9:", e);
    }
}

console.log("[DB] Iniciando window.dbPromise...");
const dbTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT: IndexedDB no respondió en 15s')), 15000));
window.dbPromise = Promise.race([initDB(), dbTimeout]).then(async database => {
    window.db = database;
    await populateDefaults(database);
    // Ejecutar migración v8 si no se ha ejecutado antes
    try {
        const meta = await database.get('meta', 'migracion_v8');
        if (!meta) {
            await migrarV8(database);
        }
    } catch (e) {
        // La meta store puede no existir si es primera ejecución
        console.log("[DB] Primera ejecución o store meta no disponible aún.");
    }

    // Ejecutar migración v9 si no se ha ejecutado antes
    try {
        const metaV9 = await database.get('meta', 'migracion_v9');
        if (!metaV9) {
            await migrarV9(database);
        }
    } catch (e) {
        console.log("[DB] Primera ejecución o store meta no disponible aún.");
    }

    console.log("[DB] Inicialización completada con éxito.");
    return database;
}).catch(err => {
    console.error("[DB] ERROR CRÍTICO:", err);
    // Intentar mostrar el error en pantalla si el DOM está listo
    const msg = "Error Base de Datos: " + err.message;
    if (document.getElementById('app-content')) {
        document.getElementById('app-content').innerHTML = `<div style="color:red; padding:20px; background:black; border:1px solid red;">${msg}</div>`;
    }
    throw err;
});
