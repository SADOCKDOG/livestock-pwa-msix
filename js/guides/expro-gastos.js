/**
 * Livestock Manager - Guía Finanzas/Gastos (ExPro)
 * Tour guiado para la pestaña Finanzas: evolución mensual, balance por categoría, tabs, FAB.
 * Siempre disponible.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'expro.gastos',
    pillar: 'expro',
    route: '/explotacion',
    tab: 'gastos',
    applies: (flags) => true,
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []);
        return gastos.length > 0;
      } catch (e) {
        console.warn('[expro.gastos] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Finanzas / Gastos',
        body: 'Esta pestaña (**Finanzas**) controla **todos los gastos de la explotación** por 6 categorías contables: Alimentación, Sanidad, Fitosanitarios, Electricidad, Personal, Amortización. Evolución mensual, balance consolidado, tabs por categoría, FAB «Nuevo Gasto». Color púrpura (--c-purple).',
        target: null,
        position: 'center'
      },
      {
        title: 'Evolución Mensual (últimos 6 meses)',
        body: 'Gráfico de barras: gasto total por mes. Verde = bajo, ámbar = medio, rojo = alto. Total general en cabecera. Indicador visual de estacionalidad de costes.',
        // La tarjeta completa del gráfico: .gasto-bar-wrap casaba con UNA barra suelta
        // (a menudo la de un mes sin gasto), no con el gráfico que describe el texto.
        target: '[data-guide="grafico-evolucion"]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Balance Global de Gastos (colapsable)',
        body: 'Panel colapsable con total por cada una de las 6 categorías (icono + color propio) + **Total General Gastos** (rojo). Click en chevron para colapsar/expandir. Refleja solo gastos de la finca activa.',
        target: '.card-resumen.card-total-3d',
        waitFor: 1000,
        position: 'below',
        optional: true,
        optionalReason: 'Solo visible tras renderizar la pestaña Gastos (contenido dinámico)'
      },
      {
        title: 'Tabs por Categoría Contable',
        body: 'Barra de tabs horizontal (scrollable): **Todos, Alimentación, Sanidad, Fitosanitarios, Electricidad, Personal, Amortización**. Cada tab filtra el listado inferior. Tab activa resaltada con su color. Click para cambiar sin recargar.',
        target: '.gasto-tabs button, .tabs-scroll.gasto-tabs',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Listado de gastos (filtrado por tab)',
        body: 'Grid con tarjetas: concepto/categoría, fecha, categoría, badge importe (€). Click abre detalle (editar/borrar). Orden: más reciente primero. Límite 15 por tab. Vacío = sin gastos en esa categoría.',
        target: '#gasto-content .card-registro',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'FAB Nuevo Gasto',
        body: 'FAB flotante «Nuevo Gasto» (púrpura) abre wizard: categoría (selector 6 opciones), concepto, fecha, importe (€), proveedor (opcional, enlace a Proveedores), zona, notas. Valida importe >0. Genera gasto_ganaderia + evento registro_eventos.',
        target: '.fab-container[onclick*="App._abrirFormularioGasto"]',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'FAB Guía',
        body: 'Botón flotante «Guía» relanza esta guía. En Ajustes → Guías: toggle global, guías vistas, «Reiniciar todas».',
        target: '.guide-fab',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: '¡Listo!',
        body: 'Controla costes: registra gastos por categoría, vigila evolución mensual, usa balance para detectar desviaciones, vincula a proveedores. La guía está en el FAB.',
        target: null,
        position: 'center'
      }
    ]
  });
})();