/**
 * Livestock Manager - EventBus v1.0.0
 * Sistema de comunicación pub/sub para desacoplar módulos.
 * Permite que los módulos emitan eventos y otros reaccionen sin acoplamiento directo.
 *
 * Eventos del sistema:
 *   finca:changed        - Cambió la finca activa
 *   animal:created       - Nuevo animal registrado   { animal }
 *   animal:updated       - Animal modificado          { animal }
 *   animal:deleted       - Animal eliminado           { id }
 *   animal:moved         - Animal cambiado de rebaño  { animal, rebanoOrigen, rebanoDestino }
 *   tratamiento:added    - Nuevo tratamiento sanitario { tratamiento }
 *   tratamiento:deleted  - Tratamiento eliminado      { id }
 *   venta:created        - Nueva venta registrada     { venta }
 *   venta:deleted        - Venta eliminada            { id }
 *   gasto:created        - Nuevo gasto registrado     { gasto }
 *   leche:entrega        - Nueva entrega de leche     { entrega }
 *   reproduccion:evento  - Nuevo evento reproductivo { evento }
 *   pesaje:registrado    - Nuevo pesaje registrado    { pesaje }
 *   rebano:created       - Nuevo rebaño creado        { rebano }
 *   rebano:updated       - Rebaño modificado          { rebano }
 *   zona:created         - Nueva zona creada          { zona }
 *   zona:updated         - Zona modificada            { zona }
 *   data:imported        - Backup importado           { stores }
 *   alertas:updated      - Las alertas han cambiado    { alertas }
 *   dashboard:refresh    - Solicitar refresco del dashboard
 */

const EventBus = {
  _listeners: {},
  _history: [],
  _maxHistory: 50,
  _debug: false,

  /**
   * Suscribirse a un evento
   * @param {string} event - Nombre del evento
   * @param {Function} callback - (data) => {}
   * @param {Object} [context] - Contexto this para el callback
   * @returns {Function} unsubscribe - llamar para cancelar suscripción
   */
  on(event, callback, context) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    const entry = { callback, context };
    this._listeners[event].push(entry);
    if (this._debug) console.log(`[EventBus] + listener: ${event}`);
    return () => this._off(event, callback);
  },

  /**
   * Suscripción de una sola vez
   */
  once(event, callback, context) {
    const wrapper = (data) => {
      this._off(event, wrapper);
      callback.call(context, data);
    };
    return this.on(event, wrapper, context);
  },

  /**
   * Eliminar una suscripción específica
   */
  _off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(
      (e) => e.callback !== callback
    );
    if (this._listeners[event].length === 0) {
      delete this._listeners[event];
    }
  },

  /**
   * Emitir un evento a todos los suscriptores
   * @param {string} event - Nombre del evento
   * @param {*} [data] - Datos asociados al evento
   */
  emit(event, data) {
    if (this._debug) console.log(`[EventBus] >> ${event}`, data);
    this._history.push({ event, data, at: Date.now() });
    if (this._history.length > this._maxHistory) this._history.shift();

    if (!this._listeners[event]) return;
    this._listeners[event].forEach((entry) => {
      try {
        entry.callback.call(entry.context, data);
      } catch (e) {
        console.error(`[EventBus] Error en handler de "${event}":`, e);
      }
    });
  },

  /**
   * Eliminar todos los listeners de un evento (o todos si no se especifica)
   */
  clear(event) {
    if (event) {
      delete this._listeners[event];
    } else {
      this._listeners = {};
    }
  },

  /**
   * Obtener historial reciente de eventos
   */
  getHistory(count = 10) {
    return this._history.slice(-count);
  },

  /**
   * Activar/desactivar logs de debug
   */
  setDebug(active) {
    this._debug = active;
  },

  /**
   * Obtener número de suscriptores por evento
   */
  getStats() {
    const stats = {};
    Object.keys(this._listeners).forEach((event) => {
      stats[event] = this._listeners[event].length;
    });
    return stats;
  }
};

// Preservar EventBus global
window.EventBus = EventBus;

// =====================================================
// Eventos de sistema precargados
// =====================================================
// Escuchar cambios de finca activa
window.addEventListener('fincaChanged', (e) => {
  EventBus.emit('finca:changed', { id: e.detail?.id });
});

console.log('[EventBus] Sistema de eventos listo v1.0.0');
