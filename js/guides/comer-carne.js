/**
 * Livestock Manager - Guía Carne (CoMer)
 * Tour guiado para la pestaña Carne: ventas, rendimientos, márgenes, gráficos.
 * SOLO disponible si flags.carne === true.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'comer.carne',
    pillar: 'comer',
    route: '/comercializacion',
    tab: 'carne',
    applies: (flags) => flags.carne === true,
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const carne = await window.db.getAllFromIndex('comercializacion_carne', 'fincaId', fincaId).catch(() => []);
        return carne.length > 0;
      } catch (e) {
        console.warn('[comer.carne] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Comercialización Cárnica',
        body: 'Esta pestaña (**Carne**) solo aparece con **Carne=ON** en Ajustes → Explotación. Centraliza **ventas de ganado a mataderos**, rendimientos de canal (EUROP/S), facturación y **margen neto real** (ingresos - transporte - matanza). Color verde lima (--c-success) identifica Carne.',
        target: null,
        position: 'center'
      },
      {
        title: 'Resumen Comercial Cárnico',
        body: 'Tarjeta superior con 2 KPIs: **Ventas** (nº de animales/lotes vendidos) e **Ingreso** bruto total (verde neón). Gradiente verde lima, borde izquierdo verde lima neón. Click en chevron → despliega balance completo (5 KPIs: Peso Canal kg, Animales Vendidos, Rend. Promedio %, Ingreso Bruto, Margen Neto Real).',
        target: '.card[style*="border-left: 4px solid var(--c-success)"]',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Balance Cárnico (colapsable)',
        body: 'Panel expandible con 5 métricas clave: **Peso Canal (kg)** total, **Animales Vendidos** (conteo), **Rend. Promedio** (%), **Ingreso Bruto** (€, gris), **Margen Neto Real** (€, verde neón) = Ingreso Bruto - Gasto Transporte - Gasto Matanza. El margen neto es el indicador real de rentabilidad de la venta cárnica.',
        target: '.card-total-3d.card-resumen',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Lista de Ventas (mataderos)',
        body: 'Grid de tarjetas (máx 50, más recientes primero): **Comprador/Matadero** (razón social), **Fecha Sacrificio**, **Peso Canal** (kg), **Rendimiento %** (verde si ≥50%, ámbar si <50%), **Clasificación EUROP/S** (si hay), **Importe Total** (€). Click abre detalle venta (editar/borrar/ver PDF). Orden: más reciente primero.',
        target: '#comer-sub-content .card-registro',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'FAB Registrar Venta',
        body: 'Botón flotante verde lima (--c-success) «Registrar Venta» abre **WizardVentaMasiva**: selección múltiple de animales/lotes (checkbox), comprador (selector mataderos/cooperativas), fecha sacrificio, peso canal unitario o por lote, rendimiento %, clasificación EUROP/S, precio €/kg o importe total, gastos transporte y matanza (opcionales, descuentan del margen). Guarda en comercializacion_carne + eventos + actualiza animal a "Vendido".',
        target: '.module-header-primary-action button[onclick*="App._abrirWizardVentaMasiva"]',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Gráfico Peso Mensual (últimos 6 meses)',
        body: 'Barras de **peso canal kg mes a mes** (verde=venta, ámbar si bajo). Eje X: meses; Eje Y: kg canal. Detecta concentración de ventas y planifica cargas. Se actualiza tras cada venta registrada.',
        target: '#carne-rendimiento-chart',
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
        body: 'Domina la carne: registra ventas completas, vigila rendimientos y clasificación, controla márgenes netos reales (descontando transporte y matanza), usa gráfico para planificar. La guía está en el FAB.',
        target: null,
        position: 'center'
      }
    ]
  });
})();