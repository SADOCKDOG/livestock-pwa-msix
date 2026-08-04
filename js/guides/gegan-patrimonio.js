/**
 * Livestock Manager - Guía Patrimonio (GeGan)
 * Tour guiado para la pestaña Patrimonio: censo consolidado, KPIs, ICA por Tanda de Cebo (solo Carne).
 * Lanza wizard real: App._abrirAsistenteProduccion('carne') para pesajes.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'gegan.patrimonio',
    pillar: 'gegan',
    route: '/ganaderia',
    tab: 'patrimonio',
    applies: (flags) => flags && flags.carne === true, // Solo si Carne está activo
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        // Patrimonio necesita animales/rebaños de ESTA finca para mostrar ICA
        const [rebanos, zonas] = await Promise.all([
          window.db.getAllFromIndex('rebanos', 'fincaId', fincaId).catch(() => []),
          window.Fincas ? Fincas.getActive() : Promise.resolve(null)
        ]);
        const zonasFinca = (zonas?.zonas || []).filter(z => !z.anulada);
        if (rebanos.length > 0 || zonasFinca.length > 0) return true;
        // Verificar si hay animales en los rebanos de esta finca
        const rebanoIds = new Set(rebanos.map(r => r.id));
        for (const rid of rebanoIds) {
          const a = await window.db.getAllFromIndex('animales', 'rebanoId', rid).catch(() => []);
          if (a.length > 0) return true;
        }
        return false;
      } catch (e) {
        console.warn('[gegan.patrimonio] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Patrimonio y Ganadería',
        body: 'Esta pestaña (solo visible si **Carne=ON** en Ajustes → Explotación) muestra la **visión consolidada de toda la finca**: censo total, valor estimado del patrimonio y **Índice de Conversión Alimenticia (ICA)** por **Tanda de Cebo**. El color ámbar identifica esta sub-vista.',
        target: null,
        position: 'center'
      },
      {
        title: 'KPIs principales',
        body: 'Cuatro indicadores clave: **Censo Total** (cabezas), **Lotes/Rebaños**, **Valor Estimado** (€, referencia 3.20 €/kg vivo), **ICA** (ratio kg pienso : kg ganancia) y **Coste/kg Ganancia** (€). El ICA se colorea: verde ≤6 (eficiente), ámbar 6-8, rojo >8 (ineficiente).',
        target: '.leche-kpi-item, [style*="--kpi-color"]',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Registrar pesaje (asistente de producción)',
        body: 'Botón **«Registrar Pesaje»** abre el **Asistente de Producción (carne)** para introducir pesos de animales/lotes. Los pesajes seriados son la base del cálculo de ganancia de peso vivo → ICA. Sin pesajes, no hay ICA.',
        target: '.module-header-primary-action button, [onclick*="_abrirAsistenteProduccion"]',
        waitFor: true,
        position: 'below',
        launch: () => { if (window.App && App._abrirAsistenteProduccion) App._abrirAsistenteProduccion('carne', { origen_modulo: 'patrimonio' }); }
      },
      {
        title: 'Panel ICA — Nivel 1: Cierre de Tanda de Cebo',
        body: 'Una **Tanda de Cebo** = animales de un **mismo movimiento de entrada SIGGAN** (guía de entrada). Entrada = fecha movimiento; salida = venta a matadero de esos animales. Fórmula: **kg pienso consumido (silo_consumo del lote) / kg ganancia (último - primer pesaje en rango)**. Cada fila: nombre (· SIGGAN si viene de movimiento), nº animales, entrada→salida (o EN CURSO), ganancia kg, ICA, estado CERRADO/ABIERTO, coste €/kg.',
        target: '.card-registro, [style*="border-left:2px solid var(--c-warning)"]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Panel ICA — Nivel 2: Control Mensual (alertas)',
        body: 'Gráfico de barras de los **últimos 6 meses**. Cada mes: kg pienso / ganancia atribuida (incrementos entre pesajes consecutivos cuyo pesaje posterior cae en el mes). **Media del periodo** y meses **desviados (>20% sobre media) en rojo** = alerta temprana de consumos anómalos antes del cierre del lote.',
        target: '[style*="border-left:2px solid var(--c-info)"] ~ .flex, .flex.items-end.gap-4',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Accesos directos a sub-vistas',
        body: 'Botones rápidos: **Animales** (censo individual), **Rebaños** (lotes), **Zonas** (parcelas). Navegan a las pestañas correspondientes del carrusel GeGan.',
        target: '.grid.grid-cols-3 a[href="#/animales"], .grid.grid-cols-3 a[href="#/rebanos"], .grid.grid-cols-3 a[href="#/zonas"]',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Lotes activos (lista)',
        body: 'Lista de rebaños con: especie, tipo, ubicación (zona), cabezas activas y enlace **«Ficha →»**. Click abre ficha de rebaño (sanidad, gastos, animales, rotación).',
        target: '.grid.gap-10 .card-registro',
        waitFor: 1000,
        position: 'above'
      },
      {
        title: '¡Listo!',
        body: 'Patrimonio = visión de finca completa. Registra pesajes seriados, imputa consumos de silo por lote, y el ICA se calcula solo. Nivel 1 = dato definitivo al cierre; Nivel 2 = alerta mensual. Guía en FAB «Guía».',
        target: null,
        position: 'center'
      }
    ]
  });
})();