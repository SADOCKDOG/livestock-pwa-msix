/**
 * Livestock Manager - Guía Panorámica CoMer
 * Tour guiado panorámico de todo el módulo Comercialización.
 * Siempre disponible.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'comer.panoramica',
    pillar: 'comer',
    route: '/comercializacion',
    tab: null, // panorámica: recorre pestañas por diseño y sobrevive al cambio de tab
    applies: (flags) => true,
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const [leche, carne, compradores, contratos, transportistas] = await Promise.all([
          window.db.getAllFromIndex('comercializacion_leche', 'fincaId', fincaId).catch(() => []),
          window.db.getAllFromIndex('comercializacion_carne', 'fincaId', fincaId).catch(() => []),
          window.db.getAll('compradores').catch(() => []),
          window.db.getAll('contratos_compra').catch(() => []),
          window.db.getAll('transportistas').catch(() => [])
        ]);
        // Disponible si HAY datos en ALGUNO de estos stores (compradores/contratos/transportistas son globales)
        return leche.length > 0 || carne.length > 0 || compradores.length > 0 || contratos.length > 0 || transportistas.length > 0;
      } catch (e) {
        console.warn('[comer.panoramica] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Comercialización (CoMer)',
        body: 'Este módulo (**Comercialización**) centraliza toda la **venta y logística** de la explotación. 5 pestañas funcionan como un carrusel: **Leche**, **Carne**, **Compradores**, **Contratos**, **Transportistas**. Color ámbar/amarillo (--c-warning) identifica CoMer.',
        target: null,
        position: 'center'
      },
      {
        title: 'Carrusel de pestañas',
        body: 'El carrusel circular superior muestra **solo las pestañas permitidas** según tu modo de explotación (Ajustes → Explotación): Leche (azul) si flags.leche=ON; Carne (verde lima) si flags.carne=ON; Compradores, Contratos y Transportistas (púrpura/rosa) siempre. Click para cambiar sin recargar la vista completa.',
        target: '.carrusel-pestanas .carrusel-dot, .carrusel-pestanas .carrusel-marco',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Alerta de contratos por vencer',
        body: 'Si algún contrato de compra expira en ≤30 días, aparece **tarjeta pulse oro** listándolos con días restantes. Botón "GESTIONAR ➔" salta directo a pestaña Contratos para renovar. Solo visible si hay contratos próximos a vencer.',
        target: '[style*="border-left: 4px solid var(--p-gold)"]',
        waitFor: 1500,
        position: 'below',
        optional: true,
        optionalReason: 'Solo aparece si hay contratos venciendo en ≤30 días'
      },
      {
        title: 'Cabecera adaptativa por pestaña activa',
        body: 'La cabecera cambia según la pestaña: **Leche/Carne** → KPIs de entregas/ventas + botón principal "Registrar Retirada" / "Registrar Venta" (abren wizards reales). **Compradores/Contratos/Transportistas** → resumen + FAB "Nuevo". La acción principal siempre lanza el wizard correspondiente.',
        target: '.module-header-primary-action button',
        waitFor: true,
        position: 'below'
      },
      {
        title: 'Pestaña Leche — Entregas y analíticas (si Leche=ON)',
        body: 'Seguimiento de **cisternas**: matrícula, litros, fecha, analizadora (grasa/proteína/urea/Esc/Células), estado analítica (Pendiente/Conforme/Alerta/Rechazado/Incorrecto/Antibióticos), MOFA real. Gráfico de barras últimos 6 meses de producción láctea. FAB "Registrar Retirada" abre WizardAlbaranLeche.',
        target: '.carrusel-dot[data-tab="leche"]',
        waitFor: 1500,
        position: 'below',
        optional: true,
        optionalReason: 'Solo disponible si flags.leche === true'
      },
      {
        title: 'Pestaña Carne — Ventas y rendimientos (si Carne=ON)',
        body: 'Listado de **ventas a mataderos**: comprador, fecha sacrificio, peso canal, rendimiento %, clasificación EUROP/S, ingreso total, gastos transporte/matanza, margen neto real. Gráfico de barras último semestre peso canal. FAB "Registrar Venta" abre WizardVentaMasiva.',
        target: '.carrusel-dot[data-tab="carne"]',
        waitFor: 1500,
        position: 'below',
        optional: true,
        optionalReason: 'Solo disponible si flags.carne === true'
      },
      {
        title: 'Pestaña Compradores — Cartera de clientes',
        body: 'Gestión de **mataderos, cooperativas y centrales lecheras**. Fichas con NIF, REGA, tipo (cárnico/láctico/híbrido), contratos vinculados, historial carne/leche con volúmenes e importes. Filtros por texto (nombre/NIF/ciudad) y tipo. FAB "Nuevo Comprador".',
        target: '.carrusel-dot[data-tab="compradores"]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Pestaña Contratos — Acuerdos de suministro',
        body: 'Contratos de compra vinculados a compradores. Nº contrato, tipo (leche/carne), vigencia, precios por producto/unidad, estados (ACTIVO/INACTIVO). Accesos: editar contrato, ficha comprador. FAB "Nuevo Contrato". Alertas de vencimiento en cabecera global CoMer.',
        target: '.carrusel-dot[data-tab="contratos"]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Pestaña Transportistas — Flota y certificados',
        body: 'Registro de **transportistas calificados**: matrícula, ATG, tipo vehículo (camión/furgoneta/remolque/cisterna), capacidad, certificado bienestar (con vencimiento), desinsectación, termoneutralidad. Badges de urgencia (rojo=caducado/sin cert, ámbar=≤30d, verde=OK). FAB "Nuevo Transportista".',
        target: '.carrusel-dot[data-tab="transportistas"]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'FAB Guía contextual',
        body: 'Cada pestaña tiene su **FAB "Guía"** (abajo a la derecha) para relanzar esta guía o la específica de la pestaña. En Ajustes → Guías: toggle global, guías vistas, "Reiniciar todas".',
        target: '.guide-fab',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: '¡Listo!',
        body: 'Domina la comercialización: registra retiradas de leche y ventas de carne, gestiona clientes y contratos, controla certificados de flota. La guía de cada pestaña está en su FAB.',
        target: null,
        position: 'center'
      }
    ]
  });
})();