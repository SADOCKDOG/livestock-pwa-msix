/**
 * Liquidación Económica - Livestock Manager Premium v4.0
 * Cálculos automáticos de importes de venta: IVA, retenciones, totales.
 *
 * Uso:
 *   Liquidacion.calcular({ pesoCanal: 280, precioUnitario: 4.50, gastos: 85, ivaPct: 10, retencionPct: 1 })
 *   // => { importe_bruto, base_imponible, importe_iva, importe_retencion, total, desglose }
 */

const Liquidacion = {
  /**
   * Calcular desglose económico completo de una venta
   * @param {Object} params
   * @param {number} params.pesoCanal - Peso canal en kg
   * @param {number} params.precioUnitario - Precio por kg (€)
   * @param {number} [params.gastos=0] - Gastos totales (transporte + matanza)
   * @param {number} [params.ivaPct=10] - Porcentaje de IVA
   * @param {number} [params.retencionPct=0] - Porcentaje de retención (REAGP)
   * @param {number} [params.importeBruto] - Si se pasa, se usa directamente (pesoCanal x precioUnitario por defecto)
   * @returns {Object} { importe_bruto, base_imponible, importe_iva, importe_retencion, total, desglose }
   */
  calcular({ pesoCanal = 0, precioUnitario = 0, gastos = 0, ivaPct = 0, retencionPct = 0, importeBruto } = {}) {
    const pc = parseFloat(pesoCanal) || 0;
    const pu = parseFloat(precioUnitario) || 0;
    const gt = parseFloat(gastos) || 0;
    const iva = parseFloat(ivaPct) || 0;
    const ret = parseFloat(retencionPct) || 0;

    const importe_bruto = importeBruto !== undefined ? (parseFloat(importeBruto) || 0) : (pc * pu);
    const base_imponible = importe_bruto - gt;
    const importe_iva = parseFloat((base_imponible * (iva / 100)).toFixed(2));
    const importe_retencion = parseFloat((base_imponible * (ret / 100)).toFixed(2));
    const total = parseFloat((base_imponible + importe_iva - importe_retencion).toFixed(2));

    return {
      importe_bruto: parseFloat(importe_bruto.toFixed(2)),
      base_imponible: parseFloat(base_imponible.toFixed(2)),
      importe_iva,
      importe_retencion,
      total,
      desglose: [
        { concepto: 'Importe bruto (peso canal × precio/kg)', cantidad: importe_bruto },
        { concepto: 'Gastos (transporte + matanza)', cantidad: -gt },
        { concepto: `Base imponible`, cantidad: parseFloat(base_imponible.toFixed(2)) },
        { concepto: `IVA (${iva}%)`, cantidad: importe_iva },
        ...(ret > 0 ? [{ concepto: `Retención REAGP (${ret}%)`, cantidad: -importe_retencion }] : []),
        { concepto: 'TOTAL A LIQUIDAR', cantidad: total, bold: true },
      ]
    };
  },

  /**
   * Formatear número como moneda EUR
   */
  formatEUR(cantidad) {
    return (parseFloat(cantidad) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  },

  /**
   * Generar HTML para tabla de desglose económico
   */
  renderTabla(liquidacion) {
    if (!liquidacion || !liquidacion.desglose) return '<p class="text-gray">Sin datos económicos</p>';
    return `
      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.9rem;">
        ${liquidacion.desglose.map(item => `
          <tr ${item.bold ? 'style="font-weight:bold; border-top:2px solid #000;"' : ''}>
            <td style="padding:6px 8px; border-bottom:1px solid #ddd;">${item.concepto}</td>
            <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #ddd;">${item.cantidad >= 0 ? '' : '-'}${Liquidacion.formatEUR(Math.abs(item.cantidad))}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }
};

window.Liquidacion = Liquidacion;
