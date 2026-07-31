/**
 * Analíticas de Leche — CRUD con evaluación por especie
 * Módulo Lácteo Integral (v24)
 */
window.AnaliticasLeche = (() => {
  'use strict';

  async function getAll(fincaId) {
    const all = await window.db.getAll('analiticas_leche');
    return all.filter(a => Number(a.fincaId) === Number(fincaId));
  }

  async function getById(id) {
    return await window.db.get('analiticas_leche', id);
  }

  async function getByComercializacion(comercializacionId) {
    try {
      const results = await window.db.getAllFromIndex('analiticas_leche', 'comercializacionId', comercializacionId);
      return results;
    } catch (e) {
      return [];
    }
  }

  async function create(data) {
    if (!data.fincaId) throw new Error('fincaId requerido');

    const now = new Date().toISOString();
    const especie = data.especie || 'vacuno';
    const umbrales = window.ComunidadesService ? window.ComunidadesService.getUmbralesCalidadEspecie(especie) : null;

    const extractoSeco = (parseFloat(data.grasa) || 0) + (parseFloat(data.proteina) || 0);

    const analitica = {
      fincaId: data.fincaId,
      comercializacionId: data.comercializacionId || null,
      tanqueId: data.tanqueId || null,
      fecha_muestreo: data.fecha_muestreo || now.split('T')[0],
      tipo_muestreo: data.tipo_muestreo || 'autocontrol',
      laboratorio_nombre: data.laboratorio_nombre || 'CICAP',
      laboratorio_codigo: data.laboratorio_codigo || null,
      nro_boletin: data.nro_boletin || null,

      grasa: parseFloat(data.grasa) || null,
      proteina: parseFloat(data.proteina) || null,
      extracto_seco: extractoSeco > 0 ? extractoSeco : null,
      temperatura: parseFloat(data.temperatura) || null,

      germenes_30C: parseFloat(data.germenes_30C) || data.germenes || null,
      celulas_somaticas: parseFloat(data.celulas_somaticas) || data.somaticas || null,
      recuento_bacterias: parseFloat(data.recuento_bacterias) || null,

      inhibidores: data.inhibidores || false,
      antibioticos_detectados: data.antibioticos_detectados || data.antibioticos || false,

      aflatoxina_m1: parseFloat(data.aflatoxina_m1) || null,
      aflatoxina_m1_metodo: data.aflatoxina_m1_metodo || null,
      aflatoxina_m1_resultado: data.aflatoxina_m1_resultado || null,

      numero_muestra_letra_q: data.numero_muestra_letra_q || data.numero_Muestra_Letra_Q || null,
      resultado_letra_q: data.resultado_letra_q || null,
      codigo_letra_q_laboratorio: (data.codigo_letra_q_laboratorio || '').trim() || null,

      especie: especie,
      estado: data.estado || calcularEstado(data, especie),
      observaciones: data.observaciones || null,
      creadoEn: now,
    };

    const id = await window.db.add('analiticas_leche', analitica);
    
    // Emitir evento para actualizar alertas
    if (window.EventBus) {
      window.EventBus.emit('analitica:created', { id, fincaId: analitica.fincaId });
    }
    
    return { ...analitica, id };
  }

  async function update(id, data) {
    const existing = await getById(id);
    if (!existing) throw new Error('Analítica no encontrada');

    const updated = { ...existing, ...data };
    if (data.grasa != null || data.proteina != null) {
      updated.extracto_seco = (parseFloat(data.grasa || existing.grasa) || 0) + (parseFloat(data.proteina || existing.proteina) || 0);
    }

    updated.estado = data.estado || calcularEstado(updated, updated.especie || 'vacuno');
    await window.db.put('analiticas_leche', updated);
    return updated;
  }

  function calcularEstado(data, especie) {
    if (!data) return 'pendiente';

    if (data.inhibidores === true || data.antibioticos_detectados === true) return 'rechazado';

    const CS = window.ComunidadesService;
    if (!CS) return 'pendiente';

    const umbrales = CS.getUmbralesCalidadEspecie(especie);
    const evalResult = CS.evaluarCalidadLecheEspecie(data, especie);

    if (evalResult.bloqueante) return 'rechazado';
    if (evalResult.alertas.length > 0) return 'alerta';
    if (data.germenes_30C != null || data.celulas_somaticas != null) return 'validado';
    return 'pendiente';
  }

  async function getHistorico(fincaId, desde, hasta) {
    const all = await getAll(fincaId);
    return all
      .filter(a => {
        const fecha = new Date(a.fecha_muestreo);
        if (desde && fecha < new Date(desde)) return false;
        if (hasta && fecha > new Date(hasta)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.fecha_muestreo) - new Date(a.fecha_muestreo));
  }

  async function getMediaParametros(fincaId, desde, hasta, especie) {
    const historico = await getHistorico(fincaId, desde, hasta);
    const filtrados = especie ? historico.filter(a => a.especie === especie) : historico;

    if (filtrados.length === 0) return null;

    const sumas = { grasa: 0, proteina: 0, germenes: 0, somaticas: 0, aflatoxina: 0 };
    const contadores = { grasa: 0, proteina: 0, germenes: 0, somaticas: 0, aflatoxina: 0 };

    for (const a of filtrados) {
      if (a.grasa != null) { sumas.grasa += a.grasa; contadores.grasa++; }
      if (a.proteina != null) { sumas.proteina += a.proteina; contadores.proteina++; }
      if (a.germenes_30C != null) { sumas.germenes += a.germenes_30C; contadores.germenes++; }
      if (a.celulas_somaticas != null) { sumas.somaticas += a.celulas_somaticas; contadores.somaticas++; }
      if (a.aflatoxina_m1 != null) { sumas.aflatoxina += a.aflatoxina_m1; contadores.aflatoxina++; }
    }

    return {
      count: filtrados.length,
      grasa_media: contadores.grasa > 0 ? (sumas.grasa / contadores.grasa).toFixed(2) : null,
      proteina_media: contadores.proteina > 0 ? (sumas.proteina / contadores.proteina).toFixed(2) : null,
      extracto_seco_medio: contadores.grasa > 0 && contadores.proteina > 0
        ? ((sumas.grasa / contadores.grasa) + (sumas.proteina / contadores.proteina)).toFixed(2) : null,
      germenes_media: contadores.germenes > 0 ? Math.round(sumas.germenes / contadores.germenes) : null,
      somaticas_media: contadores.somaticas > 0 ? Math.round(sumas.somaticas / contadores.somaticas) : null,
      aflatoxina_media: contadores.aflatoxina > 0 ? (sumas.aflatoxina / contadores.aflatoxina).toFixed(1) : null,
    };
  }

  return {
    getAll,
    getById,
    getByComercializacion,
    create,
    update,
    calcularEstado,
    getHistorico,
    getMediaParametros,
  };
})();
