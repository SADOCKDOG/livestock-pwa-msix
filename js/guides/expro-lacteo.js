/**
 * Livestock Manager - Guía Láctea (ExPro)
 * Tour guiado para la pestaña Láctea: producción diaria, tanques, control, balance, gráficos.
 * SOLO disponible si flags.leche === true.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'expro.lacteo',
    pillar: 'expro',
    route: '/explotacion',
    tab: 'lacteo',
    applies: (flags) => flags.leche === true, // SOLO si Leche=ON
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        // registro_eventos no tiene campo `tipo`; los ordeños usan motivo_tarea
        // produccion_leche/control_lechero (mismo filtro que ExplotacionView).
        const ordeños = await window.db.getAllFromIndex('registro_eventos', 'fincaId', fincaId).catch(() => []);
        return (ordeños || []).some(e =>
          !e.anulado && (e.motivo_tarea === 'produccion_leche' || e.motivo_tarea === 'control_lechero')
        );
      } catch (e) {
        console.warn('[expro.lacteo] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Gestión Láctea',
        body: 'Esta pestaña (**Láctea**) solo aparece con **Leche=ON** en Ajustes → Explotación. Centraliza producción diaria, analíticas de laboratorio, tanques de enfriamiento y rendimiento MOFA (margen sobre coste alimentación). Color azul (--c-info) identifica láctea.',
        target: null,
        position: 'center'
      },
      {
        title: 'Resumen Lácteo (KPIs)',
        body: 'Tarjeta superior con 2 KPIs: **Litros Control** = producción en controles oficiales; **Margen MOFA** = ingresos leche - coste pienso (€). Indicadores clave de rentabilidad lechera.',
        target: '.leche-kpi-item',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Sub-tabs de navegación interna',
        body: 'Barra de 5 sub-tabs bajo el resumen: **Dashboard** (visión general), **Tanques** (enfriadores, capacidades, temperaturas), **Control** (registros oficiales laboratorio), **Balance** (economía láctea: ingresos, costes, MOFA), **Gráficos** (evolución producción, componentes, comparativas). Click para cambiar sin recargar.',
        target: '.leche-sub-tabs button, .tabs-scroll.leche-sub-tabs',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Dashboard — Visión general (sub-tab activo)',
        body: 'Sub-tab por defecto. Resumen visual: producción última semana, tanques con nivel/temperatura, próximos controles, alertas (ej. temperatura alta). Acceso rápido a registrar ordeño y ver control.',
        target: '#expro-lacteo-subtab-content .card-registro, #expro-lacteo-subtab-content .dashboard-kpi, [onclick*="_cambiarLacteoSubTab(\'dashboard\')"]',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Tanques — Enfriadores (click sub-tab Tanques)',
        body: 'Sub-tab **Tanques** (delega a TanquesView si existe). Cada tanque: capacidad, litros actuales, temperatura, estado (enfriando/ok/alarma). FAB «Nuevo Tanque». Click en tarjeta abre ficha con histórico temperaturas y calibración.',
        target: '[onclick*="_cambiarLacteoSubTab(\'tanques\')"]',
        waitFor: 1500,
        position: 'below',
        optional: true,
        optionalReason: 'Requiere window.TanquesView cargado (módulo opcional)'
      },
      {
        title: 'Control — Analíticas laboratorio (click sub-tab Control)',
        body: 'Sub-tab **Control**: listado de controles oficiales (fecha, litros, grasa, proteína, extracto seco, urea, recuento celular). Cada control abre ficha con componentes, comparación con anterior y tendencia. FAB para registrar nuevo control (wizard).',
        target: '[onclick*="_cambiarLacteoSubTab(\'control\')"]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Balance — Economía láctea MOFA (click sub-tab Balance)',
        body: 'Sub-tab **Balance**: ingresos por leche (litros × precio), costes alimentación (pienso, forraje), **MOFA** = Ingresos - Coste Alimentación. Desglose por periodo, comparativa con campañas anteriores. KPIs: €/litro, €/vaca/día, % coste alimentación.',
        target: '[onclick*="_cambiarLacteoSubTab(\'balance\')"]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Gráficos — Evolución y componentes (click sub-tab Gráficos)',
        body: 'Sub-tab **Gráficos**: series temporales de producción (L/día), grasa/proteína (%), recuento celular, urea, MOFA. Selector de rango (semana/mes/año/campaña). Exportable a imagen/PDF para informes.',
        target: '[onclick*="_cambiarLacteoSubTab(\'graficos\')"]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'FAB Guía contextual',
        body: 'Cada sub-tab tiene su **FAB «Guía»** específico. En Ajustes → Guías: toggle global, guías vistas, «Reiniciar todas».',
        target: '.guide-fab',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: '¡Listo!',
        body: 'Domina la láctea: registra controles oficiales, vigila tanques, analiza MOFA, usa gráficos para decisiones. La guía de cada sub-tab está en su FAB.',
        target: null,
        position: 'center'
      }
    ]
  });
})();