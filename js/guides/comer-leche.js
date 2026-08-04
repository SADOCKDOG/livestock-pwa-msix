/**
 * Livestock Manager - Guía Leche (CoMer)
 * Tour guiado para la pestaña Leche: entregas, analíticas, MOFA, gráficos.
 * SOLO disponible si flags.leche === true.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'comer.leche',
    pillar: 'comer',
    route: '/comercializacion',
    tab: 'leche',
    applies: (flags) => flags.leche === true,
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const leche = await window.db.getAllFromIndex('comercializacion_leche', 'fincaId', fincaId).catch(() => []);
        return leche.length > 0;
      } catch (e) {
        console.warn('[comer.leche] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Contratos y Entregas Lácteas',
        body: 'Esta pestaña (**Leche**) solo aparece con **Leche=ON** en Ajustes → Explotación. Centraliza **albaranes de entrega a industrias**, control de calidad (analíticas), liquidaciones y **MOFA real** (margen sobre coste alimentación). Color azul (--c-info) identifica Lácteo.',
        target: null,
        position: 'center'
      },
      {
        title: 'Resumen Comercial Lácteo',
        body: 'Tarjeta superior con 2 KPIs: **Entregas** (nº de cisternas/albaranes) y **Litros** totales del período. Gradiente azul, borde izquierdo azul neón. Click en chevron → despliega balance completo (4 KPIs: Total Litros, Cisternas, Alimentación Período, MOFA Real).',
        target: '.card[style*="border-left: 4px solid var(--c-info)"]',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Balance Lácteo (colapsable)',
        body: 'Panel expandible con 4 métricas clave: **Total Litros** (entregados), **Cisternas Cargadas** (número de albaranes), **Alimentación Período** (€ coste pienso en fechas de entregas, rojo), **MOFA Real (Neto)** = Ingresos Leche - Coste Alimentación (verde neón). Indicador real de rentabilidad lechera por campaña.',
        target: '.card-total-3d.card-resumen',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Lista de Entregas (albaranes)',
        body: 'Grid de tarjetas (máx 50, más recientes primero): **Cisterna** (matrícula/S/N), **Fecha**, **Litros**, **Analítica** (grasa % amarillo, proteína % azul), **Antibióticos** (rojo neón si positivo), **Estado Analítica** (badge color: verde=APTO/CONFORME, ámbar=PENDIENTE/ESPERA, rojo=ALERTA/RECHAZADO/INCORRECTO/ANTIBIÓTICOS). Click abre ficha completa (wizard/albaran-leche).',
        target: '#comer-sub-content .card-registro',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'FAB Registrar Retirada',
        body: 'Botón flotante azul (--c-info) «Registrar Retirada» abre **WizardAlbaranLeche**: industria (selector de compradores tipo láctico/híbrido), matrícula cisterna, fecha/hora recogida, litros, temperatura, datos laboratorio (grasa, proteína, extracto seco, urea, recuento celular), antibióticos (sí/no), observaciones. Genera comercializacion_leche + evento registro_eventos.',
        target: '.module-header-primary-action button[onclick*="App._abrirWizardAlbaranLeche"]',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Gráfico Producción Mensual (últimos 6 meses)',
        body: 'Barras de **litros mes a mes** (verde=producción, rojo si cae vs media). Permite detectar estacionalidad y caídas de producción. Eje X: meses (Ene Dic); Eje Y: litros. Se actualiza tras cada nueva entrega.',
        target: '#leche-rendimiento-chart',
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
        body: 'Controla la láctea: registra cada retirada, vigila analíticas y antibióticos, analiza MOFA real, usa gráfico para decisiones. La guía está en el FAB cuando la necesites.',
        target: null,
        position: 'center'
      }
    ]
  });
})();