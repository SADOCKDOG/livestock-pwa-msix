/**
 * Tanques de Leche — CRUD con validación Letra Q
 * Módulo Lácteo Integral (v24)
 */
window.TanquesLeche = (() => {
  'use strict';

  async function getAll(fincaId) {
    const all = await window.db.getAll('tanques_leche');
    return all.filter(t => Number(t.fincaId) === Number(fincaId));
  }

  async function getById(id) {
    return await window.db.get('tanques_leche', id);
  }

  async function getByCodigoLetraQ(codigo) {
    if (!codigo) return null;
    try {
      return await window.db.getFromIndex('tanques_leche', 'codigo_letra_q', codigo);
    } catch (e) {
      return null;
    }
  }

  async function create(data) {
    if (!data.fincaId) throw new Error('fincaId requerido');
    if (!data.codigo_letra_q) throw new Error('Código Letra Q requerido');
    if (!data.nombre) throw new Error('Nombre requerido');

    const existente = await getByCodigoLetraQ(data.codigo_letra_q);
    if (existente) throw new Error(`Ya existe un tanque con código Letra Q: ${data.codigo_letra_q}`);

    const now = new Date().toISOString();
    const tanque = {
      fincaId: data.fincaId,
      codigo_letra_q: data.codigo_letra_q.trim().toUpperCase(),
      nombre: data.nombre.trim(),
      capacidad_litros: parseFloat(data.capacidad_litros) || 0,
      temperatura_objetivo: parseFloat(data.temperatura_objetivo) || 4,
      temperatura_actual: parseFloat(data.temperatura_actual) || null,
      tipo: data.tipo || 'tanque_frio',
      estado: data.estado || 'activo',
      ultima_limpieza: data.ultima_limpieza || null,
      proxima_limpieza: data.proxima_limpieza || null,
      matricula_vehiculo: (data.matricula_vehiculo || '').trim().toUpperCase() || null,
      nif_transportista: (data.nif_transportista || '').trim().toUpperCase() || null,
      nif_operador_asociado: (data.nif_operador_asociado || '').trim().toUpperCase() || null,
      observaciones: data.observaciones || null,
      creadoEn: now,
      actualizadoEn: now,
    };

    const id = await window.db.add('tanques_leche', tanque);
    
    // Emitir evento para actualizar alertas
    if (window.EventBus) {
      window.EventBus.emit('tanque:created', { id, fincaId: tanque.fincaId });
    }
    
    return { ...tanque, id };
  }

  async function update(id, data) {
    const existing = await getById(id);
    if (!existing) throw new Error('Tanque no encontrado');

    if (data.codigo_letra_q && data.codigo_letra_q !== existing.codigo_letra_q) {
      const otro = await getByCodigoLetraQ(data.codigo_letra_q);
      if (otro && otro.id !== id) throw new Error(`Código Letra Q ya en uso por otro tanque`);
    }

    const updated = {
      ...existing,
      ...data,
      codigo_letra_q: (data.codigo_letra_q || existing.codigo_letra_q).trim().toUpperCase(),
      actualizadoEn: new Date().toISOString(),
    };

    await window.db.put('tanques_leche', updated);
    
    // Emitir evento para actualizar alertas
    if (window.EventBus) {
      window.EventBus.emit('tanque:updated', { id, fincaId: updated.fincaId });
    }
    
    return updated;
  }

  async function remove(id) {
    const tanque = await getById(id);
    if (!tanque) throw new Error('Tanque no encontrado');
    tanque.estado = 'baja';
    tanque.actualizadoEn = new Date().toISOString();
    await window.db.put('tanques_leche', tanque);
  }

  async function getActivos(fincaId) {
    const all = await getAll(fincaId);
    return all.filter(t => t.estado === 'activo');
  }

  async function registrarLimpieza(id, fecha) {
    const tanque = await getById(id);
    if (!tanque) throw new Error('Tanque no encontrado');

    const fechaLimp = fecha || new Date().toISOString().split('T')[0];
    tanque.ultima_limpieza = fechaLimp;

    const proxima = new Date(fechaLimp);
    proxima.setMonth(proxima.getMonth() + 6);
    tanque.proxima_limpieza = proxima.toISOString().split('T')[0];
    tanque.actualizadoEn = new Date().toISOString();

    await window.db.put('tanques_leche', tanque);
    return tanque;
  }

  async function actualizarTemperatura(id, temp) {
    const tanque = await getById(id);
    if (!tanque) throw new Error('Tanque no encontrado');
    tanque.temperatura_actual = parseFloat(temp);
    tanque.actualizadoEn = new Date().toISOString();
    await window.db.put('tanques_leche', tanque);
    return tanque;
  }

  function validarCodigoLetraQ(codigo) {
    if (!codigo || !codigo.trim()) return { valido: false, mensaje: 'Código vacío' };
    const limpio = codigo.trim().toUpperCase();
    if (limpio.length < 3) return { valido: false, mensaje: 'Código demasiado corto' };
    return { valido: true, mensaje: 'Código válido', codigo: limpio };
  }

  return {
    getAll,
    getById,
    getByCodigoLetraQ,
    create,
    update,
    remove,
    getActivos,
    registrarLimpieza,
    actualizarTemperatura,
    validarCodigoLetraQ,
  };
})();
