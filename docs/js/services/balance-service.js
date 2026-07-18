/**
 * Livestock Manager - BalanceService v1.0.0
 * Servicio que vincula ingresos (ventas/leche) con gastos asociados
 * para mostrar margen real por operación.
 */

const BalanceService = {
  /**
   * Obtener margen real de una venta específica (ingreso - gastos asociados)
   * @param {number} ventaId - ID de la venta en comercializacion_carne
   */
  async getMargenVenta(ventaId) {
    try {
      const venta = await window.db.get('comercializacion_carne', Number(ventaId));
      if (!venta) return null;

      const ingreso = venta.precio_total || (venta.pesoCanal || 0) * 5.5;

      // Buscar gastos relacionados (mismo animal, misma fecha)
      const gastos = await window.db.getAll('gastos_ganaderia') || [];
      const gastosRelacionados = gastos.filter(g => {
        if (venta.animalId && g.rebanoId) {
          // Podría asociarse por animal o rebaño
          return g.fecha === venta.fechaSacrificio ||
                 (venta.snap_zona && g.snap_zona === venta.snap_zona);
        }
        return false;
      });

      const totalGastosAsociados = gastosRelacionados.reduce((s, g) => s + (g.monto || 0), 0);

      return {
        ventaId,
        ingreso,
        gastosAsociados: totalGastosAsociados,
        margen: ingreso - totalGastosAsociados,
        rentabilidad: ingreso > 0 ? ((ingreso - totalGastosAsociados) / ingreso * 100).toFixed(1) : 0,
      };
    } catch (e) {
      console.error('[BalanceService] Error margen venta:', e);
      return null;
    }
  },

  /**
   * Rentabilidad por lote (grupo de animales vendidos juntos)
   */
  async getRentabilidadLote(animalIds) {
    try {
      const ventas = await window.db.getAll('comercializacion_carne') || [];
      const ventasLote = ventas.filter(v => animalIds.includes(v.animalId));

      let totalIngresos = 0;
      let totalGastosDirectos = 0;
      let totalKg = 0;

      for (const v of ventasLote) {
        totalIngresos += v.precio_total || (v.pesoCanal || 0) * 5.5;
        totalGastosDirectos += (v.gastosComercializacion?.transporte || 0) + (v.gastosComercializacion?.matadero || 0);
        totalKg += v.pesoCanal || 0;
      }

      const beneficio = totalIngresos - totalGastosDirectos;
      const precioMedioKg = totalKg > 0 ? (totalIngresos / totalKg) : 0;

      return {
        animales: animalIds.length,
        ventas: ventasLote.length,
        totalKg,
        precioMedioKg: precioMedioKg.toFixed(2),
        ingresos: totalIngresos,
        gastosDirectos: totalGastosDirectos,
        beneficio,
        rentabilidadPct: totalIngresos > 0 ? ((beneficio / totalIngresos) * 100).toFixed(1) : 0,
      };
    } catch (e) {
      console.error('[BalanceService] Error rentabilidad lote:', e);
      return null;
    }
  }
};

window.BalanceService = BalanceService;
console.log('[BalanceService] Servicio de balance económico listo v1.0.0');
