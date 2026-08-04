/**
 * Livestock Manager - Guía Proveedores (ExPro)
 * Tour guiado para la pestaña Proveedores: KPIs, búsqueda, lista, trazabilidad gastos.
 * Siempre disponible.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'expro.proveedores',
    pillar: 'expro',
    route: '/explotacion',
    tab: 'proveedores',
    applies: (flags) => true,
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const proveedores = await window.db.getAll('proveedores').catch(() => []);
        return proveedores.length > 0;
      } catch (e) {
        console.warn('[expro.proveedores] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Proveedores',
        body: 'Esta pestaña (**Proveedores**) gestiona el **catálogo de proveedores/servicios** y su **trazabilidad de compras**. Cada proveedor acumula: gasto total asignado, última compra, número de registros. Búsqueda por nombre/NIF/ciudad. FAB «Nuevo Proveedor». Color púrpura (--c-purple).',
        target: null,
        position: 'center'
      },
      {
        title: 'KPIs: Proveedores / Gasto Asignado / Registros',
        body: '3 tarjetas superiores (balance colapsable): **Proveedores** (total alta, dorado), **Gasto Asignado** (€ suma gastos vinculados, ámbar), **Registros** (líneas gasto con proveedor, azul). Click chevron para colapsar.',
        target: '#prov-kpis .card-resumen, #prov-kpis .card-total-3d',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Buscar proveedores',
        body: 'Campo `#search-proveedores` filtra al instante por **nombre, NIF/CIF o ciudad**. Escribe y la lista se reduce. Limpia para ver todos.',
        target: '#search-proveedores',
        waitFor: true,
        position: 'below'
      },
      {
        title: 'Lista de proveedores (click = detalle)',
        body: 'Cada tarjeta: nombre (dorado), NIF/ciudad, categorías habituales, badge «Ver detalle». Click abre ficha completa: datos fiscales, contactos, **historial de compras** (fecha, concepto, categoría, importe), totales por categoría, botones Editar / Eliminar.',
        target: '#prov-lista .card-registro',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'FAB Nuevo Proveedor',
        body: 'FAB «Nuevo Proveedor» abre formulario: nombre (obligatorio), NIF/CIF, dirección, ciudad, teléfono, email, categorías (multi-select: Alimentación, Sanidad, Fitosanitarios, Electricidad, Personal, Amortización, Otros), notas. Guarda en config_proveedores.',
        target: '.fab-container[onclick*="ProveedoresView.renderFormulario"]',
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
        body: 'Gestiona proveedores: da de alta, vincula gastos en Finanzas (selector proveedor), consulta historial de compras por proveedor, detecta concentración de gasto. La guía está en el FAB.',
        target: null,
        position: 'center'
      }
    ]
  });
})();