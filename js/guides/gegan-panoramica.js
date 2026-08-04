/**
 * Livestock Manager - Guía Panorámica GeGan
 * Tour guiado para la consola principal de Ganadería (pilar GeGan).
 * Muestra la visión de conjunto: 5 pestañas, modo leche/carne, carrusel de navegación.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'gegan.panoramica',
    pillar: 'gegan',
    route: '/ganaderia',
    tab: null, // panorámica: recorre pestañas por diseño y sobrevive al cambio de tab
    applies: (flags) => true, // Siempre disponible
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const finca = await window.Fincas.getActive().catch(() => null);
        const zonas = (finca?.zonas || []).filter(z => !z.anulada);
        const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', fincaId).catch(() => []);
        if (rebanos.length > 0 || zonas.length > 0) return true;
        // Verificar animales en rebanos de esta finca
        const rebanoIds = new Set(rebanos.map(r => r.id));
        for (const rid of rebanoIds) {
          const a = await window.db.getAllFromIndex('animales', 'rebanoId', rid).catch(() => []);
          if (a.length > 0) return true;
        }
        return false;
      } catch (e) {
        console.warn('[gegan.panoramica] disponible error:', e);
        return true; // fallback seguro
      }
    },
    steps: [
      {
        title: 'Bienvenido a Ganadería (GeGan)',
        body: 'Esta es la **consola unificada de Ganadería**. Agrupa 5 pestañas: <strong>Animales</strong>, <strong>Rebaños</strong>, <strong>Patrimonio</strong>, <strong>Zonas</strong> y <strong>Sanidad</strong>. El color verde lima identifica siempre a GeGan.',
        target: null,
        position: 'center'
      },
      {
        title: 'Modo de explotación (Leche / Carne)',
        body: 'En Ajustes → Explotación activas los flags **Leche** y **Carne** por finca. Si Carne está ON, aparece la pestaña <strong>Patrimonio</strong> (ICA de cebo). Si Leche está ON, verás producción láctea en otras vistas. Cambia según tu sistema productivo real.',
        target: '.module-header .btn-create',
        waitFor: true,
        position: 'below',
        launch: () => { if (window.App && App.route) App.route('/ajustes?tab=explotacion'); }
      },
      {
        title: 'Carrusel de pestañas (navegación principal)',
        body: 'El **carrusel horizontal** en la parte superior permite cambiar entre pestañas sin recargar la app. Cada pestaña tiene su icono y color. Desliza o click para navegar. La guía se reinicia al cambiar de pestaña.',
        target: '.mb-14 .carrusel-pestanas, .mb-14 [data-carrusel]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Animales — Censo individual',
        body: 'Pestaña **Animales**: control de crotales (nº REGA), altas (nacimiento/compra), bajas y ficha completa con genealógica, Libro de Registro SIGGAN y margen económico por animal. Botón «Nuevo Animal» abre el wizard de alta.',
        target: '.carrusel-dot[data-tab="animales"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.GanaderiaView && GanaderiaView._cambiarSubModulo) GanaderiaView._cambiarSubModulo('animales'); }
      },
      {
        title: 'Rebaños — Lotes productivos',
        body: 'Pestaña **Rebaños**: agrupamiento de ganado por especie/tipo, capacidad (aforo), zona asignada, tipo REGA obligatorio (RD 787/2023). Incluye balance mensual,Wizard de «Nuevo Rebaño» y ficha con sanidad, gastos y animales.',
        target: '.carrusel-dot[data-tab="rebanos"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.GanaderiaView && GanaderiaView._cambiarSubModulo) GanaderiaView._cambiarSubModulo('rebanos'); }
      },
      {
        title: 'Patrimonio — ICA de cebo (solo Carne)',
        body: 'Pestaña **Patrimonio** (solo si Carne=ON): visión consolidada de toda la finca. Calcula **Índice de Conversión Alimenticia (ICA)** por **Tanda de Cebo** (animales de un mismo movimiento de entrada SIGGAN). Nivel 1 = cierre lote (entrada→matadero), Nivel 2 = control mensual (alertas de desviación).',
        target: '.carrusel-dot[data-tab="patrimonio"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.GanaderiaView && GanaderiaView._cambiarSubModulo) GanaderiaView._cambiarSubModulo('patrimonio'); }
      },
      {
        title: 'Zonas — Parcelas, PAC, UGM, rotación',
        body: 'Pestaña **Zonas**: define parcelas con superficie (ha), aforo, código PAC, distancia a agua. Calcula **UGM/ha** (carga ganadera) y alerta **sobrepastoreo** (>1.0 UGM/ha). Incluye **cuarentena fitosanitaria** en tiempo real y botón «Rotar Lote» con chequeo de bloqueos.',
        target: '.carrusel-dot[data-tab="zonas"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.GanaderiaView && GanaderiaView._cambiarSubModulo) GanaderiaView._cambiarSubModulo('zonas'); }
      },
      {
        title: 'Sanidad — Libro tratamientos y vacunas',
        body: 'Pestaña **Sanidad**: libro de tratamientos (supresión carne/leche automática), vacunaciones (Libro ADSG), buscador global y alertas de supresión **siempre visibles** (rojo=activa, verde=libre). Tiene su propia guía detallada (FAB «Guía» en la pestaña).',
        target: '.carrusel-dot[data-tab="sanidad"]',
        waitFor: 1000,
        position: 'below',
        launch: () => { if (window.GanaderiaView && GanaderiaView._cambiarSubModulo) GanaderiaView._cambiarSubModulo('sanidad'); }
      },
      {
        title: 'FAB Guía y reinicio',
        body: 'Cada pestaña tiene su **FAB «Guía»** (abajo a la derecha) para relanzar la guía de esa sub-vista. En Ajustes → Guías puedes activar/desactivar globalmente, ver cuáles has visto y «Reiniciar todas» para verlas de nuevo.',
        target: '.guide-fab',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: '¡Listo para empezar!',
        body: 'Explora las 5 pestañas, crea tu primer rebaño o animal, registra pesajes y consumos para ver el ICA, y define tus zonas con código PAC. La guía de cada pestaña te acompañará paso a paso.',
        target: null,
        position: 'center'
      }
    ]
  });
})();