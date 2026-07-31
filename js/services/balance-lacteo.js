/**
 * Balance Lácteo — Movimientos de tanque y stock en tiempo real
 * Módulo Lácteo Integral (v24)
 */
window.BalanceLacteo = (() => {
  'use strict';

  async function registrar(data) {
    if (!data.fincaId) throw new Error('fincaId requerido');
    if (!data.tanqueId) throw new Error('tanqueId requerido');
    if (!data.tipo_movimiento) throw new Error('tipo_movimiento requerido');

    const tanque = await window.db.get('tanques_leche', data.tanqueId);
    if (!tanque) throw new Error(`Tanque ${data.tanqueId} no existe`);

    const cantidad = parseFloat(data.cantidad_litros) || 0;
    if (data.tipo_movimiento !== 'ajuste' && cantidad <= 0) {
      throw new Error('cantidad_litros debe ser mayor que 0');
    }

    const stockAnterior = await getStockTanque(data.tanqueId);
    let litrosAcumulados;

    switch (data.tipo_movimiento) {
      case 'entrada':
        litrosAcumulados = stockAnterior + cantidad;
        break;
      case 'salida':
        litrosAcumulados = stockAnterior - cantidad;
        break;
      case 'merma':
        litrosAcumulados = stockAnterior - cantidad;
        break;
      case 'ajuste':
        litrosAcumulados = cantidad;
        break;
      default:
        throw new Error(`tipo_movimiento inválido: ${data.tipo_movimiento}`);
    }

    const movimiento = {
      fincaId: data.fincaId,
      tanqueId: data.tanqueId,
      tipo_movimiento: data.tipo_movimiento,
      fecha: data.fecha || new Date().toISOString(),
      cantidad_litros: cantidad,
      referencia_tipo: data.referencia_tipo || null,
      referencia_id: data.referencia_id || null,
      litros_acumulados: litrosAcumulados,
      temperatura: data.temperatura || null,
      turno: data.turno || null,
      observaciones: data.observaciones || null,
      creadoEn: new Date().toISOString(),
    };

    const id = await window.db.add('balance_lacteo', movimiento);
    
    // Emitir evento para actualizar alertas
    if (window.EventBus) {
      window.EventBus.emit('balance:registered', { 
        id, 
        tanqueId: movimiento.tanqueId, 
        tipo: movimiento.tipo_movimiento 
      });
    }
    
    return { ...movimiento, id };
  }

  async function getStockTanque(tanqueId) {
    const movimientos = await window.db.getAllFromIndex('balance_lacteo', 'tanqueId', tanqueId);
    if (!movimientos || movimientos.length === 0) return 0;

    movimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    return movimientos.reduce((stock, mov) => {
      switch (mov.tipo_movimiento) {
        case 'entrada': return stock + (mov.cantidad_litros || 0);
        case 'salida': return stock - (mov.cantidad_litros || 0);
        case 'merma': return stock - (mov.cantidad_litros || 0);
        case 'ajuste': return mov.cantidad_litros || 0;
        default: return stock;
      }
    }, 0);
  }

  async function getHistorialTanque(tanqueId, desde, hasta) {
    const movimientos = await window.db.getAllFromIndex('balance_lacteo', 'tanqueId', tanqueId);

    return movimientos
      .filter(m => {
        if (!desde && !hasta) return true;
        const fecha = new Date(m.fecha);
        if (desde && fecha < new Date(desde)) return false;
        if (hasta && fecha > new Date(hasta)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  async function getProduccionDiaria(fincaId, fecha) {
    const fechaStr = fecha || new Date().toISOString().split('T')[0];
    const tanques = await window.TanquesLeche.getAll(fincaId);
    let total = 0;

    for (const tanque of tanques) {
      const movs = await window.db.getAllFromIndex('balance_lacteo', 'tanqueId', tanque.id);
      const entradasDia = movs
        .filter(m => m.tipo_movimiento === 'entrada' && m.fecha.startsWith(fechaStr))
        .reduce((sum, m) => sum + (m.cantidad_litros || 0), 0);
      total += entradasDia;
    }

    return total;
  }

  async function getResumenPeriodo(fincaId, desde, hasta) {
    const tanques = await window.TanquesLeche.getAll(fincaId);
    let totalEntradas = 0;
    let totalSalidas = 0;
    let totalMermas = 0;

    for (const tanque of tanques) {
      const movs = await window.db.getAllFromIndex('balance_lacteo', 'tanqueId', tanque.id);
      const filtrados = movs.filter(m => {
        const fecha = new Date(m.fecha);
        if (desde && fecha < new Date(desde)) return false;
        if (hasta && fecha > new Date(hasta)) return false;
        return true;
      });

      for (const m of filtrados) {
        switch (m.tipo_movimiento) {
          case 'entrada': totalEntradas += m.cantidad_litros || 0; break;
          case 'salida': totalSalidas += m.cantidad_litros || 0; break;
          case 'merma': totalMermas += m.cantidad_litros || 0; break;
        }
      }
    }

    return {
      totalEntradas,
      totalSalidas,
      totalMermas,
      stockDisponible: totalEntradas - totalSalidas - totalMermas,
    };
  }

  async function validarStockSuficiente(tanqueId, litros) {
    const stock = await getStockTanque(tanqueId);
    return {
      valido: litros <= stock,
      stockActual: stock,
      litrosSolicitados: litros,
      diferencia: stock - litros,
    };
  }

  async function getTanqueConStock(fincaId) {
    const tanques = await window.TanquesLeche.getActivos(fincaId);
    const result = [];

    for (const t of tanques) {
      const stock = await getStockTanque(t.id);
      result.push({
        ...t,
        stock_actual: stock,
        porcentaje_llenado: t.capacidad_litros > 0 ? Math.round((stock / t.capacidad_litros) * 100) : 0,
      });
    }

    return result;
  }

  return {
    registrar,
    getStockTanque,
    getHistorialTanque,
    getProduccionDiaria,
    getResumenPeriodo,
    validarStockSuficiente,
    getTanqueConStock,
  };
})();
