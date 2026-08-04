/**
 * Livestock Manager - Guía Fitosanitarios (ExPro)
 * Tour guiado para la pestaña Fitosanitarios: libro campo, KPIs, exportar PDF, historial.
 * Siempre disponible.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'expro.fitosanitarios',
    pillar: 'expro',
    route: '/explotacion',
    tab: 'fitosanitarios',
    applies: (flags) => true,
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []);
        return gastos.some(g => (g.categoria || '').toLowerCase() === 'fitosanitarios');
      } catch (e) {
        console.warn('[expro.fitosanitarios] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido al Libro Fitosanitario',
        body: 'Esta pestaña (**Fitosanitarios**) es el **Cuaderno de Campo oficial** (RD 787/2023). Registra tratamientos y compras de fitosanitarios por parcela: producto, dosis, hectáreas, plazo seguridad, operador. KPIs automáticos y exportación PDF oficial. Color verde lima neón (--c-success).',
        target: null,
        position: 'center'
      },
      {
        title: 'KPIs: Inversión / Aplicaciones / Zonas',
        body: '3 tarjetas superiores: **Inversión Total** (€, verde neón), **Aplicaciones** (número registros), **Zonas Tratadas** (parcelas únicas). Resumen económico y de cobertura fitosanitaria.',
        target: '.grid .card',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Exportar Libro Fitosanitario Oficial (PDF)',
        body: 'Botón principal verde neón: **«Exportar Libro Fitosanitario Oficial (PDF)»**. Genera documento oficial compatible con requisitos CCAA (Andalucía/Extremadura/etc.) para inspecciones. Incluye: finca, parcela, cultivo, producto, dosis, fecha, operador, plazo seguridad, LMR.',
        target: '[onclick*="FitosanitariosView._exportarPDF"]',
        waitFor: true,
        position: 'below'
      },
      {
        title: 'Historial de Tratamientos y Compras',
        body: 'Listado cronológico (más reciente primero) de cada registro: fecha, zona/parcela, producto, dosis, ha, plazo seguridad (días), operador, coste. Cada tarjeta clicable abre opciones: editar / eliminar / ver PDF individual. Vacío = sin registros fitosanitarios en esta finca.',
        // .card.p-16 es único en la vista y es el bloque "TRATAMIENTOS Y COMPRAS
        // REGISTRADAS" (verificado en dispositivo). El :has-text() anterior no era CSS.
        target: '.card.p-16',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'FAB Nuevo Registro',
        body: 'FAB flotante «Nuevo Registro» (abajo derecha, verde neón) abre formulario: producto, dosis, hectáreas, zona, plazo seguridad, operador, fecha, notas, coste. Valida campos obligatorios. Guarda en gastos_ganaderia con categoría "Fitosanitarios".',
        target: '.fab-container[onclick*="FitosanitariosView._nuevoTratamiento"]',
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
        body: 'Lleva el cuaderno fitosanitario: registra cada aplicación, exporta PDF oficial para inspecciones, controla plazos de seguridad y coste por zona. La guía está en el FAB.',
        target: null,
        position: 'center'
      }
    ]
  });
})();