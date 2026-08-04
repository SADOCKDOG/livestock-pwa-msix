/**
 * Livestock Manager - Guía Animales (GeGan)
 * Tour guiado para la pestaña Animales: censo, alta, búsqueda, ficha.
 * Lanza wizard real: AnimalesView.renderDetalle (vía hash #/animal).
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'gegan.animales',
    pillar: 'gegan',
    route: '/ganaderia',
    tab: 'animales',
    applies: (flags) => true, // Siempre disponible
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        // Animales se consultan vía rebanos de esta finca (animales tiene índice rebanoId, no fincaId directo)
        const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', fincaId).catch(() => []);
        const rebanoIds = new Set(rebanos.map(r => r.id));
        if (rebanoIds.size === 0) return false;
        for (const rid of rebanoIds) {
          const a = await window.db.getAllFromIndex('animales', 'rebanoId', rid).catch(() => []);
          if (a.length > 0) return true;
        }
        return false;
      } catch (e) {
        console.warn('[gegan.animales] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido al Censo de Animales',
        body: 'Esta pestaña muestra el **censo completo** de la finca. Cada tarjeta es un animal con su crotal, raza, rebaño, estado y badges de supresión (carne/leche) con cuenta regresiva en días. El color naranja identifica esta sub-vista.',
        target: null,
        position: 'center'
      },
      {
        title: 'Resumen del censo (colapsable)',
        body: 'El panel superior resume **totales por especie** (Vacas, Ovejas, Cabras, Cerdos), **activos** y **vendidos**. Click en el chevron para ocultar/mostrar. Útil para vista rápida del inventario.',
        target: '.card-resumen, .card-total-3d',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Buscar y filtrar',
        body: 'Usa la **búsqueda instantánea** (crotal, raza, rebaño) y el **filtro por especie** (Vacas/Ovejas/Cabras/Cerdos). Escribe o selecciona y la lista se filtra en tiempo real sin recargar.',
        target: '#search-animales, #animales-filtro-especie',
        waitFor: true,
        position: 'below'
      },
      {
        title: 'Registrar un nuevo animal',
        body: 'El botón **«Nuevo Animal»** abre el wizard de alta completa (hash #/animal). Cubre: crotal REGA (ES+12 dígitos), especie/sexo/raza (catálogo oficial FEGA), rebaño, fecha, tipo de alta (nacimiento/compra), identificación técnica, Libro de Registro SIGGAN, genealógia (madre), DIB bovino, estado y observaciones.',
        target: '.module-header-primary-action button, [onclick*="location.hash=\'/animal\'"]',
        waitFor: true,
        position: 'below',
        launch: () => { location.hash = '#/animal'; }
      },
      {
        title: 'Ficha del animal (click en cualquier tarjeta)',
        body: 'Click en una tarjeta abre la **ficha completa** (wizard full-screen). Verás: datos generales, identificación técnica (chip, fecha, tipo), Libro de Registro (país, fecha alta, REGA origen, madre, DIB), margen económico (si existe), compañeros de lote e historial reproductivo. Botones: 360°, Bitácora, Reproducción, Guardar, Salir.',
        target: '#animales-lista .card-registro, [id^="animales-lista"] .card-registro',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Badges de supresión (carne / leche)',
        body: 'En cada tarjeta y en la ficha verás **badges retroiluminados** de supresión: <span style="color:var(--c-danger);">🥩 Carne</span> y <span style="color:var(--c-info);">🥛 Leche</span> con días restantes. Rojo = supresión activa (no apto para consumo); verde = libre. Calculados automáticamente desde tratamientos.',
        target: '#animales-lista .card-registro .badge, .card-registro [style*="supresion"]',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Enlace «Ficha →» en tarjetas',
        body: 'Cada tarjeta tiene un enlace discreto **«Ficha →»** (amarillo, viñeta retroiluminada) en la esquina inferior derecha. Click para ir directo a la ficha sin abrir el menú contextual. Patrón consistente con Dashboard y otras vistas.',
        target: '#animales-lista .card-registro span[style*="var(--c-warning)"]',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: '¡Listo!',
        body: 'Domina el censo: registra animales (wizard completo), busca/filtrar al instante, vigila supresiones y abre fichas para ver margen económico y genealógica. La guía está en el FAB «Guía» cuando la necesites.',
        target: null,
        position: 'center'
      }
    ]
  });
})();