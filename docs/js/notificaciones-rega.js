/**
 * Módulo Notificaciones REGA — Registro de Notificaciones (Gap 11 SIGGAN)
 * Permite marcar animales como notificados a REGA cuando cambian de estado
 * Referencia: Decreto 14/2006 (Andalucía), SIGGAN/BADIGEX, RD 787/2023
 */

window.NotificacionesREGA = (() => {
  'use strict';

  const STORE_NAME = 'notificaciones_rega';
  const LS_KEY = 'notificaciones_rega';

  // Migra entradas antiguas de localStorage a IndexedDB (ejecuta una sola vez)
  async function _migrarDesdeLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const entradas = JSON.parse(raw);
      if (!Array.isArray(entradas) || entradas.length === 0) { localStorage.removeItem(LS_KEY); return; }
      const db = await window.dbPromise;
      for (const entrada of entradas) {
        const sinId = Object.assign({}, entrada);
        delete sinId.id;
        await db.add(STORE_NAME, sinId).catch(() => {});
      }
      localStorage.removeItem(LS_KEY);
      console.log(`[NotificacionesREGA] ${entradas.length} notificaciones migradas desde localStorage`);
    } catch (e) {
      console.warn('[NotificacionesREGA] Migración localStorage omitida:', e.message);
    }
  }

  /**
   * Valida si un animal puede notificarse a REGA
   */
  function validarNotificacionPosible(animal, finca) {
    if (!finca) return { valido: false, mensaje: 'No hay finca activa' };
    if (!finca.rega && !finca.codigo_REGA) {
      return { valido: false, mensaje: 'La finca debe tener un código REGA válido' };
    }
    if (!animal) return { valido: false, mensaje: 'Animal no encontrado' };
    if (!animal.numero_identificacion && !animal.crotal) {
      return { valido: false, mensaje: 'Animal debe tener crotal o DIB/número de identificación' };
    }
    if (animal.estado === 'Baja' && !animal.motivo_baja) {
      return { valido: false, mensaje: 'Si el animal está de baja, requiere motivo de baja' };
    }
    return { valido: true, mensaje: 'Notificación permitida' };
  }

  /**
   * Registra una notificación a REGA para un animal
   */
  async function registrar(data) {
    const fincaId = data.finca_id || (await window.Fincas?.getActiveId());
    if (!fincaId) throw new Error('No hay finca activa');

    const hoy = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const numeroSeguimiento = `${hoy}-${fincaId}-${random}`;

    const notificacionData = {
      animal_id: data.animal_id,
      finca_id: fincaId,
      animal_numero: data.animal_numero,
      finca_rega: data.finca_rega,
      tipo_evento: data.tipo_evento || 'cambio_estado',
      estado_notificacion: 'pendiente',
      fecha_notificacion: new Date().toISOString(),
      numero_seguimiento: numeroSeguimiento,
      observaciones: data.observaciones || ''
    };

    const db = await window.dbPromise;
    const id = await db.add(STORE_NAME, notificacionData);
    console.log(`[NotificacionesREGA] Notificación registrada: animal=${data.animal_numero}, número=${numeroSeguimiento}`);
    return {
      exito: true,
      numero_seguimiento: numeroSeguimiento,
      mensaje: `Notificación registrada: ${numeroSeguimiento}`,
      id
    };
  }

  /**
   * Obtiene historial de notificaciones de un animal
   */
  async function obtenerHistorial(animal_id) {
    try {
      const db = await window.dbPromise;
      const todas = await db.getAllFromIndex(STORE_NAME, 'animal_id', animal_id);
      return todas.sort((a, b) => new Date(b.fecha_notificacion) - new Date(a.fecha_notificacion));
    } catch (e) {
      console.error('[NotificacionesREGA] Error obteniendo historial:', e.message);
      return [];
    }
  }

  /**
   * Verifica si un animal ya fue notificado
   */
  async function yaFueNotificado(animal_id) {
    const historial = await obtenerHistorial(animal_id);
    return historial.length > 0;
  }

  /**
   * Actualiza estado de una notificación
   */
  async function actualizarEstado(notificacion_id, nuevoEstado, error = '') {
    const db = await window.dbPromise;
    const notificacion = await db.get(STORE_NAME, notificacion_id);
    if (!notificacion) {
      console.error('[NotificacionesREGA] Notificación no encontrada:', notificacion_id);
      return;
    }
    notificacion.estado_notificacion = nuevoEstado;
    if (error) notificacion.error_mensaje = error;
    notificacion.fecha_actualizacion = new Date().toISOString();
    await db.put(STORE_NAME, notificacion);
    console.log(`[NotificacionesREGA] Estado actualizado: ${notificacion_id} → ${nuevoEstado}`);
  }

  /**
   * Simula envío de notificación a SIGGAN/BADIGEX (para QA)
   */
  async function enviarAREGA(notificacion) {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`[NotificacionesREGA] SIMULADO: Notificación enviada a REGA:`, {
        animal: notificacion.animal_numero,
        finca: notificacion.finca_rega,
        tipo: notificacion.tipo_evento,
        fecha: notificacion.fecha_notificacion
      });
      await actualizarEstado(notificacion.id, 'enviado');
      return { exito: true, mensaje: `Notificación REGA enviada para ${notificacion.animal_numero}` };
    } catch (e) {
      console.error('[NotificacionesREGA] Error enviando a REGA:', e.message);
      await actualizarEstado(notificacion.id, 'error', e.message);
      return { exito: false, mensaje: `Error enviando a REGA: ${e.message}` };
    }
  }

  // Migración automática al cargar
  if (window.dbPromise) {
    _migrarDesdeLocalStorage();
  } else {
    window.addEventListener('db-ready', _migrarDesdeLocalStorage, { once: true });
  }

  return Object.freeze({
    validarNotificacionPosible,
    registrar,
    obtenerHistorial,
    yaFueNotificado,
    actualizarEstado,
    enviarAREGA,
    STORE_NAME
  });
})();

console.log('[NotificacionesREGA] Módulo cargado — Notificaciones a REGA activadas (Gap 11 SIGGAN)');
