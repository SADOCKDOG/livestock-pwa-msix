/**
 * Livestock Manager - Guía Compradores (CoMer)
 * Tour guiado para la pestaña Compradores: cartera de clientes, historial, contratos.
 * Siempre disponible.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'comer.compradores',
    pillar: 'comer',
    route: '/comercializacion',
    tab: 'compradores',
    applies: (flags) => true,
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const compradores = await window.db.getAll('compradores').catch(() => []);
        return compradores.length > 0;
      } catch (e) {
        console.warn('[comer.compradores] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Compradores',
        body: 'Esta pestaña (**Compradores**) gestiona la **cartera de clientes**: mataderos, cooperativas y centrales lecheras. Cada ficha acumula historial de ventas (carne/leche), contratos vinculados y métricas de valor. Color púrpura (--c-purple). FAB «Nuevo Comprador» abre formulario completo.',
        target: null,
        position: 'center'
      },
      {
        title: 'Resumen de Cartera',
        body: 'Tarjeta cabecera: **Total Clientes** (dorado) y **Activos** (verde). Gradiente púrpura, borde izquierdo púrpura neón. Click chevron → balance expandido con 3 KPIs: **Total Compradores**, **Compradores Activos**, **Valor Estimado** (€, azul) basado en historial de transacciones.',
        target: '.module-header .card[style*="border-left: 4px solid var(--c-purple)"]',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Evolución Mensual (últimos 6 meses)',
        body: 'Barras de **compradores registrados por mes** (verde/ámbar/rojo según intensidad). Detecta picos de incorporación de nuevos clientes. Se actualiza al dar de alta un comprador.',
        target: '.card-resumen .flex.gap-6',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Buscar y Filtrar',
        body: 'Campo `#search-compradores`: filtra instantáneo por **nombre, NIF/CIF o ciudad**. Select `#compradores-filtro-tipo`: **Carne / Leche / Híbrido** (tipo comprador). Ambos controles reducen la lista en tiempo real.',
        target: '#search-compradores',
        waitFor: true,
        position: 'below'
      },
      {
        title: 'Lista de Compradores (click = ficha)',
        body: 'Grid de tarjetas: **nombre** (dorado), **NIF/ciudad**, **tipo** (badge: rojo=carne, azul=leche, verde=híbrido), **última operación** y **volumen año actual** (si hay ventas carne), **badge INACTIVO** (rojo) si desactivado. Click abre ficha completa con KPIs carne/leche/contratos, historiales y contratos vinculados. Badge «Ficha ->» amarillo en footer.',
        target: '#compradores-content .card-registro',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'FAB Nuevo Comprador',
        body: 'FAB púrpura «Nuevo Comprador» abre **wizard modal** (card-registro centrado, z-index 6000): nombre, NIF/CIF, tipo (cárnico/láctico/híbrido), operador SIGGAN (matadero/industria/operador/tratante), operador lácteo (letra Q), REGA destino, CCAA, dirección, contacto, condiciones pago, notas, checkbox activo. Guarda en `config_compradores`.',
        target: '.fab-container',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Cambio a pestaña Contratos',
        body: 'Los botones "Compradores / Contratos" en la UI (si están visibles) cambian el módulo interno sin recargar. La guía se reinicia para Contratos.',
        target: '[onclick*="_cambiarModulo(\'contratos\')"], [onclick*="CompradoresView._cambiarModulo"]',
        waitFor: 1500,
        optional: true,
        optionalReason: 'Botones de cambio entre Compradores/Contratos - dependen de implementación UI',
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
        body: 'Domina tu cartera: da de alta compradores completos, filtra por tipo, consulta historial y valor por cliente, vincula contratos. La guía está en el FAB.',
        target: null,
        position: 'center'
      }
    ]
  });
})();