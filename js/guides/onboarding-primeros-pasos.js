/**
 * Livestock Manager - Guía Onboarding: Primeros Pasos (Finca Vacía)
 * Secuencia transversal de puesta en marcha: Zonas → Rebaños → Animales → Producción → Comercialización.
 * SOLO disponible en finca sin datos (evalúa stores reales).
 */
(function () {
  'use strict';

  // ============================================
  // PREDICADO DISPONIBLE — solo finca vacía
  // ============================================
  async function _hayDatos() {
    if (!window.db) return false;
    try {
      const finca = window.Fincas ? await Fincas.getActive() : null;
      if (!finca) return false; // sin finca activa → no hay datos de esa finca
      const fincaId = finca.id;

      // 1. Rebaños de esta finca (tiene índice fincaId)
      const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', fincaId).catch(() => []);
      const rebanoIds = new Set(rebanos.map(r => r.id));

      // 2. Animales de los rebaños de esta finca (usa índice rebanoId)
      let animales = [];
      if (rebanoIds.size > 0) {
        for (const rid of rebanoIds) {
          const a = await window.db.getAllFromIndex('animales', 'rebanoId', rid).catch(() => []);
          animales.push(...a);
        }
      }

      // 3. Zonas de la finca (viven en el documento finca)
      const zonas = (finca?.zonas || []).filter(z => !z.anulada);

      // 4. Comercialización específica de esta finca (tienen índice fincaId)
      const [ventasCarne, ventasLeche] = await Promise.all([
        window.db.getAllFromIndex('comercializacion_carne', 'fincaId', fincaId).catch(() => []),
        window.db.getAllFromIndex('comercializacion_leche', 'fincaId', fincaId).catch(() => [])
      ]);

      // 5. Silos de esta finca (tiene índice fincaId)
      const silos = await window.db.getAllFromIndex('config_silos', 'fincaId', fincaId).catch(() => []);

      // 6. Gastos/Fitosanitarios de esta finca (tiene índice fincaId)
      const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []);
      const fitosFiltrados = gastos.filter(g => (g.categoria || '').toLowerCase() === 'fitosanitarios');

      // Si HAY datos en ALGUNO de estos stores de ESTA finca, NO es finca vacía
      return (
        animales.length > 0 ||
        rebanos.length > 0 ||
        zonas.length > 0 ||
        ventasCarne.length > 0 ||
        ventasLeche.length > 0 ||
        silos.length > 0 ||
        fitosFiltrados.length > 0
      );
    } catch (e) {
      console.warn('[onboarding] _hayDatos error:', e);
      return false;
    }
  }

  async function disponible() {
    const hay = await _hayDatos();
    return !hay; // solo si NO hay datos
  }

  // ============================================
  // REGISTRO DE LA GUÍA
  // ============================================
  GuideRegistry.register({
    id: 'onboarding.primeros-pasos',
    pillar: 'gegan', // arranca en GeGan > Zonas
    route: '/ganaderia',
    tab: 'zonas',
    applies: (flags) => true, // siempre aplicable (el gate real es disponible())
    disponible,
    steps: [
      {
        title: 'Bienvenido a tu Finca',
        body: 'Esta guía te acompaña en la **puesta en marcha inicial** de tu explotación. Recorreremos el orden real de trabajo: **Zonas → Rebaños → Animales → Producción → Comercialización**. Cada paso abre el wizard real para que avances creando tus datos.',
        target: null,
        position: 'center'
      },
      {
        title: '1. Zonas — Parcelas y PAC',
        body: 'Empieza dando de alta tus **parcelas**: nombre, superficie (ha), aforo máximo y **código PAC** (requisito SIGGAN). Esto define dónde pasta o aloja tu ganado y habilita la rotación de pastos. Botón "Crear primera zona" abre el wizard de alta.',
        target: '[data-guide="btn-vacio-zonas"]',
        waitFor: 1500,
        position: 'below',
        launch: async () => {
          // Navegar a Zonas y abrir wizard
          if (window.App) App.route('/ganaderia?tab=zonas');
          await new Promise(r => setTimeout(r, 300));
          if (window.ZonasView && typeof ZonasView._crearZona === 'function') ZonasView._crearZona();
        }
      },
      {
        title: '2. Rebaños — Agrupa tu ganado',
        body: 'Crea **lotes/rebaños** (terneros, vacas nodrizas, corderos, etc.) con especie, tipo (leche/carne) y asigna la **zona** del paso anterior. El rebaño es contenedor obligatorio antes de dar de alta animales individuales. Botón "Nuevo Rebaño" abre su wizard.',
        target: '[data-guide="btn-nuevo-rebano"]',
        waitFor: 1500,
        position: 'below',
        launch: async () => {
          if (window.App) App.route('/ganaderia?tab=rebanos');
          await new Promise(r => setTimeout(r, 300));
          if (window.RebanosView && typeof RebanosView._crearRebano === 'function') RebanosView._crearRebano();
        }
      },
      {
        title: '3. Animales — Alta individual con crotal',
        body: 'Registra cada animal con su **crotal oficial (12-14 dígitos)**, sexo, fecha de nacimiento, madre/padre, rebaño (del paso anterior) y estado (activo/vendido/baja). El botón "Registrar primer animal" abre el wizard de ficha completa.',
        target: '[data-guide="btn-vacio-animales"]',
        waitFor: 1500,
        position: 'below',
        launch: async () => {
          if (window.App) App.route('/ganaderia?tab=animales');
          await new Promise(r => setTimeout(r, 300));
          if (window.location) location.hash = '#/animal';
        }
      },
      {
        title: '4. Producción — Según tu modo (Leche / Carne)',
        body: 'Ve a **Explotación (ExPro)**. Si **Leche=ON**: registra **retiradas de leche** (albaranes, analíticas, MOFA). Si **Carne=ON**: registra **pesajes** y **ventas a matadero** (EUROP, rendimientos, margen neto). El botón principal de la cabecera adapta su acción al modo activo.',
        target: '.module-header-primary-action button',
        waitFor: 2000,
        position: 'below',
        launch: async () => {
          if (window.App) App.route('/explotacion');
          await new Promise(r => setTimeout(r, 300));
          // La acción principal (Retirada/Pesaje) depende de la pestaña activa y flags
        }
      },
      {
        title: '5. Comercialización — Clientes y primera venta',
        body: 'En **Comercialización (CoMer)**: da de alta **compradores** (mataderos, cooperativas, centrales lecheras) y **contratos de suministro**. Registra tu primera **venta de carne** o **entrega de leche**. Botones FAB "Nuevo Comprador" / "Nuevo Contrato" y cabecera "Registrar Venta/Retirada".',
        target: '[data-guide="btn-vacio-compradores"], [data-guide="btn-vacio-contratos"]',
        waitFor: 2000,
        position: 'below',
        launch: async () => {
          if (window.App) App.route('/comercializacion');
          await new Promise(r => setTimeout(r, 300));
          // El usuario elige qué pestaña abrir según su operativa
        }
      },
      {
        title: '¡Finca operativa!',
        body: 'Ya tienes tu base: parcelas, lotes, animales, producción y clientes. Desde aquí las guías panorámicas de cada módulo (GeGan, ExPro, CoMer) y las específicas por pestaña te siguen guiando. En Ajustes → Guías puedes reiniciar cualquier tour.',
        target: null,
        position: 'center'
      }
    ]
  });
})();