/**
 * Livestock Manager - Guía Contratos (CoMer)
 * Tour guiado para la pestaña Contratos: acuerdos de suministro, precios, vencimientos.
 * Siempre disponible.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'comer.contratos',
    pillar: 'comer',
    route: '/comercializacion',
    tab: 'contratos',
    applies: (flags) => true,
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        // contratos_compra es store global (sin fincaId), pero solo tiene sentido con finca activa
        const contratos = await window.db.getAll('contratos_compra').catch(() => []);
        return contratos.length > 0;
      } catch (e) {
        console.warn('[comer.contratos] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Contratos',
        body: 'Esta pestaña (**Contratos**) gestiona **acuerdos de suministro** vinculados a compradores. Cada contrato: nº, tipo (leche/carne), vigencia, precios por producto/unidad, estado (ACTIVO/INACTIVO). FAB «Nuevo Contrato» abre formulario. Color púrpura (--c-purple). Alertas de vencimiento (≤30 días) aparecen en cabecera global CoMer.',
        target: null,
        position: 'center'
      },
      {
        title: 'Resumen de Contratos',
        body: 'Tarjeta cabecera adaptada a Contratos: **Total Contratos** (púrpura) y **Activos** (verde). Balance expandido: **Total Contratos**, **Contratos Activos**, **Valor Total** (€, azul) suma de valores de contratos activos.',
        target: '.module-header .card[style*="border-left: 4px solid var(--c-purple)"]',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Evolución Mensual (últimos 6 meses)',
        body: 'Barras de **contratos iniciados por mes** (fecha_inicio). Verde/ámbar/rojo según intensidad. Permite ver estacionalidad de firma de acuerdos.',
        target: '.card-resumen .flex.gap-6',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Buscar y Filtrar Contratos',
        body: 'Campo `#search-contratos`: filtra por **número de contrato o condiciones**. Select `#contratos-filtro-tipo`: **Activo / Inactivo**. Ambos reducen la lista en tiempo real.',
        target: '#search-contratos',
        waitFor: true,
        position: 'below'
      },
      {
        title: 'Lista de Contratos (click = ficha)',
        body: 'Grid de tarjetas: **número de contrato** (título), **vigencia** (inicio → fin o INDEFINIDO), **badge estado** (verde=ACTIVO, gris=INACTIVO). Contenido: comprador asignado (link dorado a ficha) o marca roja "NO ASIGNADO / HUÉRFANO", condiciones, precios (chips: producto, €/unidad). Footer: botón EDITAR (azul) + FICHA CLIENTE (ámbar) si hay comprador. Badge «Ficha ->» amarillo en footer.',
        target: '#contratos-content .card-registro',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'FAB Nuevo Contrato (libre)',
        body: 'FAB «Nuevo Contrato» abre **wizard modal**: comprador (selector obligatorio), nº contrato, tipo (leche/carne), fechas inicio/fin, condiciones, precios (array: producto, precio_unitario, unidad), activo. Guarda en `config_contratos`. También se puede crear desde ficha comprador («Nuevo Contrato» pre-rellena el comprador).',
        target: '.fab-container',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Cambio a pestaña Compradores',
        body: 'Los botones "Compradores / Contratos" en la UI (si están visibles) cambian el módulo interno sin recargar. La guía se reinicia para Compradores.',
        target: '[onclick*="_cambiarModulo(\'compradores\')"], [onclick*="CompradoresView._cambiarModulo"]',
        waitFor: 1500,
        optional: true,
        optionalReason: 'Botones de cambio entre Contratos/Compradores - dependen de implementación UI',
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
        body: 'Gestiona contratos: crea acuerdos con precios desglosados, vincula a compradores, controla vencimientos (alerta en cabecera CoMer), edita o da de baja. La guía está en el FAB.',
        target: null,
        position: 'center'
      }
    ]
  });
})();