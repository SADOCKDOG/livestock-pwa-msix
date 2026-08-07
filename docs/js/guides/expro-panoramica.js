/**
 * Livestock Manager - Guía Panorámica ExPro
 * Tour guiado para la consola principal de Explotación y Producción (pilar ExPro).
 * 7 tabs principales: Explotación, Láctea, Silos, Fitosanitarios, Finanzas, Proveedores, Trámites.
 * Color azul (--c-info) identifica a ExPro.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'expro.panoramica',
    pillar: 'expro',
    route: '/explotacion',
    tab: null, // panorámica: recorre pestañas por diseño y sobrevive al cambio de tab
    applies: (flags) => true, // Siempre disponible
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const [silos, proveedores, gastos, fitos] = await Promise.all([
          window.db.getAllFromIndex('config_silos', 'fincaId', fincaId).catch(() => []),
          window.db.getAll('proveedores').catch(() => []), // global, no filtro finca
          window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []),
          window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => [])
        ]);
        const fitosFiltrados = fitos.filter(g => (g.categoria || '').toLowerCase() === 'fitosanitarios');
        // Disponible si HAY datos en ALGUNO de estos stores de ESTA finca (o proveedores globales)
        return silos.length > 0 || proveedores.length > 0 || gastos.length > 0 || fitosFiltrados.length > 0;
      } catch (e) {
        console.warn('[expro.panoramica] disponible error:', e);
        return true; // fallback seguro
      }
    },
    steps: [
      {
        title: 'Bienvenido a Explotación y Producción (ExPro)',
        body: 'Esta es la **consola unificada de ExPro**. Agrupa 7 pestañas: <strong>Explotación</strong> (control general), <strong>Láctea</strong> (solo si Leche=ON), <strong>Silos</strong> (telemetría alimentación), <strong>Fitosanitarios</strong> (cuaderno campo), <strong>Finanzas</strong> (gastos por categoría), <strong>Proveedores</strong> (trazabilidad compras), <strong>Trámites</strong> (guías DIMOE, censos, crotales, traslados, Infolac, archivo). El color azul identifica siempre a ExPro.',
        target: null,
        position: 'center'
      },
      {
        title: 'Modo de explotación (Leche / Carne)',
        body: 'En Ajustes → Explotación activas los flags **Leche** y **Carne** por finca. Si Leche=ON, aparece la pestaña **Láctea** con producción diaria, tanques, control y balance MOFA. Si Carne=ON, la pestaña Explotación muestra margen carne y GMD. Cambia según tu sistema productivo real.',
        target: '.module-header .btn-create',
        waitFor: true,
        position: 'below',
        launch: () => { if (window.App && App.route) App.route('/ajustes?tab=explotacion'); }
      },
      {
        title: 'Carrusel de pestañas (navegación principal)',
        body: 'El **carrusel horizontal** en la parte superior permite cambiar entre las 7 pestañas sin recargar la app. Cada pestaña tiene su icono y color. Desliza o click para navegar. La guía se reinicia al cambiar de pestaña.',
        target: '.carrusel-pestanas, [data-carrusel]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Explotación — Control general',
        body: 'Pestaña por defecto (**Explotación**). KPIs de producción (litros, margen carne), banner **Guía 365** (solo Andalucía + saneamiento), alerta **telemetría silos** (stock <15%), búsqueda de actividad por crotal/zona y listado cronológico de ordeños/pesajes. Botón principal adaptativo: "Registrar Producción" / "Registrar Pesaje" / "Registrar Ordeño" según flags.',
        target: '.carrusel-dot[data-tab="explotacion"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.ExplotacionView && ExplotacionView._cambiarSubModulo) ExplotacionView._cambiarSubModulo('explotacion'); }
      },
      {
        title: 'Láctea — Producción diaria (solo Leche)',
        body: 'Pestaña **Láctea** (solo si Leche=ON). Resumen KPIs (litros control, margen MOFA), 5 sub-tabs internas: Dashboard, Tanques, Control, Balance, Gráficos. Wizard real de ordeño/control desde sub-tabs.',
        target: '.carrusel-dot[data-tab="lacteo"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.ExplotacionView && ExplotacionView._cambiarSubModulo) ExplotacionView._cambiarSubModulo('lacteo'); }
      },
      {
        title: 'Silos — Telemetría alimentación',
        body: 'Pestaña **Silos**: capacidad total, almacenado, ocupación media. Cada silo tiene gauge circular (% nivel), autonomía estimada (días), alerta rojo si <15%. Acciones: Cargar, Consumo (descarga stock + imputa gasto + genera evento), Editar, Eliminar. FAB «Nuevo Silo».',
        target: '.carrusel-dot[data-tab="silos"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.ExplotacionView && ExplotacionView._cambiarSubModulo) ExplotacionView._cambiarSubModulo('silos'); }
      },
      {
        title: 'Fitosanitarios — Cuaderno de campo',
        body: 'Pestaña **Fitosanitarios**: libro oficial (RD 787/2023). KPIs: inversión total, aplicaciones, zonas tratadas. Botón «Exportar Libro Fitosanitario Oficial (PDF)». Historial de tratamientos/compras. FAB «Nuevo Registro».',
        target: '.carrusel-dot[data-tab="fitosanitarios"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.ExplotacionView && ExplotacionView._cambiarSubModulo) ExplotacionView._cambiarSubModulo('fitosanitarios'); }
      },
      {
        title: 'Finanzas — Gastos por categoría',
        body: 'Pestaña **Finanzas** (gastos): evolución mensual 6 meses, balance consolidado por 6 categorías (Alimentación, Sanidad, Fitosanitarios, Electricidad, Personal, Amortización). Tabs por categoría con listado y FAB «Nuevo Gasto».',
        target: '.carrusel-dot[data-tab="gastos"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.ExplotacionView && ExplotacionView._cambiarSubModulo) ExplotacionView._cambiarSubModulo('gastos'); }
      },
      {
        title: 'Proveedores — Trazabilidad compras',
        body: 'Pestaña **Proveedores**: KPIs (proveedores, gasto asignado, registros). Búsqueda por nombre/NIF/ciudad. Lista con detalle de compras por proveedor. FAB «Nuevo Proveedor».',
        target: '.carrusel-dot[data-tab="proveedores"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.ExplotacionView && ExplotacionView._cambiarSubModulo) ExplotacionView._cambiarSubModulo('proveedores'); }
      },
      {
        title: 'Trámites — Gestión documental SIGGAN',
        body: 'Pestaña **Trámites**: 6 sub-tabs (Guías DIMOE, Censo, Crotales, Traslado, Infolac, Archivo). Cada una con botón de alta (wizard real) + historial. Exportación SIGGAN/REGA, libro registro, memoria anual. FAB contextual por sub-tab.',
        target: '.carrusel-dot[data-tab="tramites"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.ExplotacionView && ExplotacionView._cambiarSubModulo) ExplotacionView._cambiarSubModulo('tramites'); }
      },
      {
        title: 'FAB Guía y reinicio',
        body: 'Cada pestaña (y sub-tab de Láctea/Trámites) tiene su **FAB «Guía»** (abajo a la derecha) para relanzar la guía de esa sub-vista. En Ajustes → Guías puedes activar/desactivar globalmente, ver cuáles has visto y «Reiniciar todas».',
        target: '.guide-fab',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: '¡Listo para empezar!',
        body: 'Explora las 7 pestañas, registra tu primer ordeño o pesaje, crea silos para telemetría, lleva el cuaderno fitosanitario, controla gastos por proveedor y emite guías DIMOE. La guía de cada pestaña te acompañará paso a paso.',
        target: null,
        position: 'center'
      }
    ]
  });
})();