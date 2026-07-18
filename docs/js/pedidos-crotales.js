/**
 * Módulo Pedidos de Crotales — Persistencia en BD (Gap 10 SIGGAN)
 * Permite guardar y recuperar solicitudes de identificación animal (crotales)
 * Referencia: RD 787/2023, Real Decreto 1307/2024
 */

window.PedidosCrotales = (() => {
  'use strict';

  const STORE_NAME = 'pedidos_crotales';

  /**
   * Inicializa la tabla en IndexedDB (llamado desde db.js)
   * @param {IDBDatabase} db
   * @param {number} version
   */
  async function initStore(db, version) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      store.createIndex('fincaId', 'fincaId', { unique: false });
      store.createIndex('fecha_pedido', 'fecha_pedido', { unique: false });
      store.createIndex('numero_seguimiento', 'numero_seguimiento', { unique: true });
      console.log(`[PedidosCrotales] Tabla ${STORE_NAME} creada (v${version})`);
    }
  }

  /**
   * Guarda un pedido de crotales en BD
   * @param {Object} pedido - {fincaId, especie, tipo, cantidad, adsg_nombre, ...}
   * @returns {Promise<number>} ID del pedido guardado
   */
  async function save(pedido) {
    if (!pedido) throw new Error('Pedido vacío');
    
    const fincaId = await window.Fincas?.getActiveId() || pedido.fincaId;
    if (!fincaId) throw new Error('No hay finca activa');

    const pedidoData = {
      ...pedido,
      fincaId: fincaId,
      fecha_pedido: pedido.fecha_pedido || new Date().toISOString(),
      // Generar número de seguimiento: YYYYMMDD-{fincaId}-{random}
      numero_seguimiento: pedido.numero_seguimiento || 
        `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${fincaId}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      // Estado del trámite
      estado: pedido.estado || 'pendiente',  // pendiente, enviado, confirmado, entregado
      // Registro de eventos
      eventos: pedido.eventos || [],
      acuse_manual: pedido.acuse_manual || pedido.acuseManual || '',
      actualizadoEn: new Date().toISOString()
    };

    if (pedidoData.id === null || pedidoData.id === undefined) {
      delete pedidoData.id;
    }

    try {
      const tx = window.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const result = await new Promise((resolve, reject) => {
        const req = store.put(pedidoData);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      console.log(`[PedidosCrotales] Pedido guardado: id=${result}, nº=${pedidoData.numero_seguimiento}`);
      return result;
    } catch (e) {
      console.error('[PedidosCrotales] Error al guardar:', e.message);
      throw e;
    }
  }

  /**
   * Recupera un pedido por ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async function get(id) {
    try {
      const tx = window.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      return await new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('[PedidosCrotales] Error al recuperar:', e.message);
      return null;
    }
  }

  /**
   * Lista todos los pedidos de la finca activa (o especificada)
   * @param {number} fincaId - Opcional; si no se especifica, usa finca activa
   * @returns {Promise<Array>}
   */
  async function list(fincaId = null) {
    try {
      const activeFincaId = fincaId || (await window.Fincas?.getActiveId());
      if (!activeFincaId) return [];

      const tx = window.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('fincaId');
      
      return await new Promise((resolve, reject) => {
        const req = index.getAll(activeFincaId);
        req.onsuccess = () => {
          const pedidos = req.result || [];
          pedidos.sort((a, b) => new Date(b.fecha_pedido) - new Date(a.fecha_pedido));
          resolve(pedidos);
        };
        req.onerror = () => {
          console.warn('[PedidosCrotales] Error en list():', req.error);
          resolve([]);
        };
      });
    } catch (e) {
      console.error('[PedidosCrotales] Error al listar:', e.message);
      return [];
    }
  }

  /**
   * Actualiza el estado de un pedido
   * @param {number} id
   * @param {string} nuevoEstado - pendiente|enviado|confirmado|entregado
   * @param {string} evento - Descripción del cambio
   * @returns {Promise<void>}
   */
  async function actualizarEstado(id, nuevoEstado, evento = '') {
    try {
      const pedido = await get(id);
      if (!pedido) throw new Error(`Pedido ${id} no encontrado`);

      pedido.estado = nuevoEstado;
      pedido.eventos = pedido.eventos || [];
      pedido.eventos.push({
        fecha: new Date().toISOString(),
        estado_anterior: pedido.estado,
        estado_nuevo: nuevoEstado,
        descripcion: evento
      });
      pedido.actualizadoEn = new Date().toISOString();

      const tx = window.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await new Promise((resolve, reject) => {
        const req = store.put(pedido);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      console.log(`[PedidosCrotales] Estado actualizado: ${id} → ${nuevoEstado}`);
    } catch (e) {
      console.error('[PedidosCrotales] Error actualizando estado:', e.message);
      throw e;
    }
  }

  /**
   * Elimina un pedido de la BD
   * @param {number} id
   * @returns {Promise<void>}
   */
  async function remove(id) {
    try {
      const tx = window.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      console.log(`[PedidosCrotales] Pedido eliminado: ${id}`);
    } catch (e) {
      console.error('[PedidosCrotales] Error al eliminar:', e.message);
      throw e;
    }
  }

  /**
   * Exporta pedidos en formato CSV/JSON para enviar a SIGGAN/BADIGEX
   * @param {Array<number>} pedidoIds - IDs de pedidos a exportar
   * @returns {Promise<Object>} {csv, json, export_date, count}
   */
  async function exportarPedidos(pedidoIds) {
    try {
      const pedidos = [];
      for (const id of pedidoIds) {
        const p = await get(id);
        if (p) pedidos.push(p);
      }
      if (pedidos.length === 0) throw new Error('No hay pedidos para exportar');

      // Formato CSV simple
      const csv = [
        ['Número Seguimiento', 'Fecha', 'Especie', 'Tipo Crotal', 'Cantidad', 'ADSG', 'Estado'].join(','),
        ...pedidos.map(p => [
          p.numero_seguimiento,
          new Date(p.fecha_pedido).toLocaleDateString(),
          p.especie,
          p.tipo,
          p.cantidad,
          p.adsg_nombre || 'N/A',
          p.estado || 'pendiente'
        ].join(','))
      ].join('\n');

      return {
        csv,
        json: JSON.stringify(pedidos, null, 2),
        export_date: new Date().toISOString(),
        count: pedidos.length
      };
    } catch (e) {
      console.error('[PedidosCrotales] Error exportando:', e.message);
      throw e;
    }
  }

  // Eliminada inicialización automática redundante para evitar conflictos con db.js

  // API pública
  return Object.freeze({
    initStore,
    save,
    get,
    list,
    actualizarEstado,
    remove,
    exportarPedidos,
    STORE_NAME
  });
})();

console.log('[PedidosCrotales] Módulo cargado — Persistencia de pedidos de crotales activada');
