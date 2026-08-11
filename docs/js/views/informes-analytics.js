/**
 * Livestock Manager - InformesAnalytics: Funciones puras para cálculos de informes
 * Contiene funciones reutilizables y puras para cálculos comunes en los informes
 * Se adjunta a window para consistencia con el resto de la codebase
 */

(function () {
  'use strict';

  /**
   * Calcula el rendimiento de leche desde registros de control lechero
   * @param {Array} registrosArray - Array de objetos de control lechero con registros[]
   * @returns {Object} {promedio, totalLitros, totalAnimalesDias}
   */
  function calcularRendimientoLecheDesdeRegistros(registrosArray) {
    if (!registrosArray || registrosArray.length === 0) {
      return { promedio: 0, totalLitros: 0, totalAnimalesDias: 0 };
    }

    let totalLitros = 0;
    let totalAnimalesDias = 0;

    for (const control of registrosArray) {
      const registros = control.registros || [];
      for (const registro of registros) {
        const litros = registro.produccion_leche || registro.litros || 0;
        totalLitros += litros;
        // Cada registro representa un animal en un control = un día-animal
        totalAnimalesDias += 1;
      }
    }

    const promedio = totalAnimalesDias > 0 ? totalLitros / totalAnimalesDias : 0;

    return {
      promedio: Number(parseFloat(promedio).toFixed(2)),
      totalLitros: Number(parseFloat(totalLitros).toFixed(1)),
      totalAnimalesDias: totalAnimalesDias
    };
  }

  /**
   * Suma los costes de sanidad (costeSanidad, de MargenAnimal.calcularParaFinca) y
   * los divide por los litros de leche para obtener €/L.
   * @param {Array} animalArray - Array de objetos de animal ({costeSanidad, litrosLeche}), tal
   *   como los devuelve MargenAnimal.calcularParaFinca(). No incluye costeCompra: es un coste
   *   de adquisición puntual, no un coste variable de producción de leche.
   * @returns {Object} {costoPorLitro, totalCostosSanidad, totalLitrosLeche}
   */
  function sumarCostosSanidadSobreLitros(animalArray) {
    if (!animalArray || animalArray.length === 0) {
      return { costoPorLitro: 0, totalCostosSanidad: 0, totalLitrosLeche: 0 };
    }

    let totalCostosSanidad = 0;
    let totalLitrosLeche = 0;

    for (const animal of animalArray) {
      totalCostosSanidad += animal.costeSanidad || 0;
      totalLitrosLeche += animal.litrosLeche || 0;
    }

    const costoPorLitro = totalLitrosLeche > 0 ? totalCostosSanidad / totalLitrosLeche : 0;
    return {
      costoPorLitro: Number(parseFloat(costoPorLitro).toFixed(4)),
      totalCostosSanidad,
      totalLitrosLeche
    };
  }

  // Exportar al objeto global para consistencia con el resto de la codebase
  window.InformesAnalytics = {
    calcularRendimientoLecheDesdeRegistros,
    sumarCostosSanidadSobreLitros
  };
})();