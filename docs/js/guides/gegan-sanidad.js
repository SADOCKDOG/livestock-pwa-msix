/**
 * Livestock Manager - Guía Sanidad (GeGan)
 * Tour guiado para la pestaña Sanidad de Ganadería.
 * Lanza wizards reales: WizardTratamiento y WizardVacunacion.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'gegan.sanidad',
    pillar: 'gegan',
    route: '/ganaderia',
    tab: 'sanidad',
    applies: (flags) => true, // Sanidad siempre disponible
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        // sanitarios_ganado tiene índice rebanoId, debe consultarse vía rebanos de esta finca
        const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', fincaId).catch(() => []);
        const rebanoIds = new Set(rebanos.map(r => r.id));
        if (rebanoIds.size === 0) return false;
        for (const rid of rebanoIds) {
          const s = await window.db.getAllFromIndex('sanitarios_ganado', 'rebanoId', rid).catch(() => []);
          if (s.length > 0) return true;
        }
        return false;
      } catch (e) {
        console.warn('[gegan.sanidad] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Sanidad',
        body: 'Esta pestaña centraliza el **libro de tratamientos**, las **vacunaciones (libro ADSG)**, el **historial clínico** y los **períodos de supresión** calculados automáticamente según SIGGAN.',
        target: null,
        position: 'center'
      },
      {
        title: 'Aplicar Tratamiento',
        body: 'El botón principal abre el **Wizard de Tratamiento** para registrar una administración veterinaria. Cubre medicamento, dosis, vía, animal/lote, veterinario y calcula la supresión de carne/leche.',
        target: '[data-guide="btn-tratamiento"]',
        waitFor: true,
        position: 'below',
        launch: () => { if (window.WizardTratamiento) WizardTratamiento.registrar(null); }
      },
      {
        title: 'Vacunación (Libro ADSG)',
        body: 'Registra vacunaciones oficiales en el **Libro ADSG**. El wizard valida calendario, dosis y veterinario colegiado. Cada entrada queda ligada a los animales vacunados.',
        target: '[data-guide="btn-vacunacion"]',
        waitFor: true,
        position: 'below',
        launch: () => { if (window.WizardVacunacion) WizardVacunacion.registrar(null, { onSaved: () => App.route() }); }
      },
      {
        title: 'Alertas de supresión',
        body: 'Aquí aparecen **automáticamente** los tratamientos en período de supresión (carne/leche). Rojo = supresión activa; verde = libre. Nunca se ocultan: son obligatorias por normativa.',
        target: '[data-guide="alertas-supresion"]',
        waitFor: 1500,
        // El bloque solo se renderiza si hay supresiones activas (sanidad-view.js:65
        // devuelve '' cuando no las hay), por eso el paso es opcional.
        optional: true,
        position: 'below'
      },
      {
        title: 'Buscador global',
        body: 'Filtra tratamientos y vacunaciones por **medicamento, tipo, crotal o veterinario**. La búsqueda es instantánea al escribir.',
        target: '#sanidad-filtro-buscar',
        waitFor: true,
        position: 'below'
      },
      {
        title: 'Vacunaciones recientes',
        body: 'Lista de vacunaciones (más reciente primero). Cada tarjeta muestra tipo(s), animales vacunados, veterinario y estado (cerrada/abierta). Click para opciones.',
        target: '[data-guide="seccion-vacunaciones"]',
        waitFor: 1000,
        position: 'above'
      },
      {
        title: 'Historial clínico',
        body: 'Registro completo de tratamientos aplicados. Cada tarjeta muestra medicamento, dosis, animal, fecha, veterinario y **badges de supresión** (carne/leche) con cuenta regresiva en días.',
        target: '[data-guide="seccion-historial"]',
        waitFor: 1000,
        position: 'above'
      },
      {
        title: '¡Listo!',
        body: 'Domina la sanidad: registra tratamientos y vacunas, vigila las supresiones y usa el buscador para auditorías. La guía está disponible en el FAB «Guía» cuando la necesites.',
        target: null,
        position: 'center'
      }
    ]
  });
})();