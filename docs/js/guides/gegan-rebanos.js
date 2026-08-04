/**
 * Livestock Manager - Guía Rebaños (GeGan)
 * Tour guiado para la pestaña Rebaños: lotes, balance, ficha, sanidad, gastos, rotación.
 * Lanza wizard real: RebanosView._crearRebano()
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'gegan.rebanos',
    pillar: 'gegan',
    route: '/ganaderia',
    tab: 'rebanos',
    applies: (flags) => true, // Siempre disponible
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', fincaId).catch(() => []);
        return rebanos.length > 0;
      } catch (e) {
        console.warn('[gegan.rebanos] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Lotes y Rebaños',
        body: 'Esta pestaña gestiona **lotes productivos** (rebaños). Cada rebaño agrupa animales por especie/tipo, tiene capacidad (aforo), zona asignada y **tipo de explotación REGA** obligatorio (RD 787/2023). El color azul identifica esta sub-vista.',
        target: null,
        position: 'center'
      },
      {
        title: 'Evolución mensual (últimos 6 meses)',
        body: 'El gráfico de barras muestra **rebaños creados por mes**. Verde = pocos, amarillo = medio, rojo = muchos. Indicador visual de actividad de constitución de lotes.',
        target: '.rebaño-bar-wrap, [style*="rebaño-bar"]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Balance de Rebaños (colapsable)',
        body: 'Panel colapsable con conteos por categoría: **Todos, Carne, Leche, Activos** (filtrados por modo de explotación activo). El total final refleja solo los rebaños visibles según tus flags Leche/Carne.',
        target: '.card-resumen.card-total-3d',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Buscar rebaños',
        body: 'Búsqueda instantánea por **nombre, raza o código de lote**. Escribe y la lista se filtra al momento.',
        target: '#search-rebanos',
        waitFor: true,
        position: 'below'
      },
      {
        title: 'Crear nuevo rebaño (wizard guiado)',
        body: 'Botón **«Nuevo Rebaño»** abre wizard de 5 pasos: (1) Identificación: nombre + especie; (2) Ubicación y tipo: tipo producción + zona; (3) REGA: tipo explotación obligatorio; (4) Capacidad y trazabilidad: aforo + código lote; (5) Fecha y notas. Valida cada paso antes de avanzar.',
        target: '.module-header-primary-action button, [onclick*="RebanosView._crearRebano"]',
        waitFor: true,
        position: 'below',
        launch: () => { if (window.RebanosView && RebanosView._crearRebano) RebanosView._crearRebano(); }
      },
      {
        title: 'Ficha de rebaño (click en tarjeta)',
        body: 'Click en una tarjeta abre **ficha full-screen** con: KPIs, categorías, edición de datos, **sanidad** (botón «Añadir Trat.»), **gastos/consumos**, **animales** del lote. Cada ficha tiene su propia guía contextual.',
        target: '#rebanos-content .card-registro',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: '¡Listo!',
        body: 'Gestiona tus lotes: crea rebaños con wizard validado, registra tratamientos y consumos, controla gastos, mueve animales entre zonas. La guía está en el FAB «Guía» cuando la necesites.',
        target: null,
        position: 'center'
      }
    ]
  });
})();