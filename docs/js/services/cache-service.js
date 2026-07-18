/**
 * Livestock Manager - CacheService v1.0.0
 * Capa de caché en memoria con invalidación automática vía EventBus.
 * Reduce lecturas a IndexedDB y mejora rendimiento en vistas.
 */

const CacheService = {
  _cache: new Map(),
  _ttl: 5 * 60 * 1000, // 5 minutos por defecto
  _cleanupInterval: null,

  // Mapa de eventos → claves de caché a invalidar
  _invalidationMap: {
    'animal:created': ['animales', 'dashboard'],
    'animal:updated': ['animales', 'dashboard'],
    'animal:deleted': ['animales', 'dashboard', 'ventas'],
    'animal:moved': ['animales', 'dashboard'],
    'tratamiento:added': ['sanitarios', 'dashboard'],
    'tratamiento:deleted': ['sanitarios', 'dashboard'],
    'venta:created': ['ventas', 'dashboard', 'analitica'],
    'venta:deleted': ['ventas', 'dashboard', 'analitica'],
    'gasto:created': ['gastos', 'dashboard', 'analitica'],
    'leche:entrega': ['leche', 'dashboard', 'analitica'],
    'reproduccion:evento': ['reproduccion', 'dashboard'],
    'pesaje:registrado': ['pesajes', 'dashboard'],
    'rebano:created': ['rebanos', 'dashboard'],
    'rebano:updated': ['rebanos', 'dashboard'],
    'zona:created': ['zonas', 'dashboard'],
    'zona:updated': ['zonas', 'dashboard'],
    'finca:changed': ['*'], // invalida todo
    'data:imported': ['*'],
  },

  init() {
    // Suscribirse a eventos del sistema para invalidar caché
    Object.entries(this._invalidationMap).forEach(([event, keys]) => {
      EventBus.on(event, () => {
        if (keys[0] === '*') {
          this.clearAll();
        } else {
          keys.forEach((key) => this.invalidate(key));
        }
      });
    });
    console.log('[CacheService] Inicializado con invalidación automática');
  },

  /**
   * Obtener valor de caché
   * @param {string} key
   * @returns {*|null} null si no está en caché o expiró
   */
  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }
    return entry.value;
  },

  /**
   * Guardar valor en caché
   * @param {string} key
   * @param {*} value
   * @param {number} [ttlMs] TTL personalizado en ms
   */
  set(key, value, ttlMs) {
    this._cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs || this._ttl),
    });
  },

  /**
   * Obtener y guardar si no existe (carga diferida)
   * @param {string} key
   * @param {Function} fetcher - async () => data
   * @param {number} [ttlMs]
   * @returns {*} data
   */
  async getOrFetch(key, fetcher, ttlMs) {
    const cached = this.get(key);
    if (cached !== null) return cached;
    const data = await fetcher();
    this.set(key, data, ttlMs);
    return data;
  },

  /**
   * Invalidar una clave específica
   */
  invalidate(key) {
    this._cache.delete(key);
  },

  /**
   * Invalidar múltiples claves
   */
  invalidateMany(keys) {
    keys.forEach((k) => this._cache.delete(k));
  },

  /**
   * Vaciar toda la caché
   */
  clearAll() {
    this._cache.clear();
  },

  /**
   * Obtener estadísticas
   */
  stats() {
    return {
      size: this._cache.size,
      keys: Array.from(this._cache.keys()),
    };
  },
};

window.CacheService = CacheService;
