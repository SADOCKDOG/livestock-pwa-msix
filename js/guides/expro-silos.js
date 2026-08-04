/**
 * Livestock Manager - Guía Silos (ExPro)
 * Tour guiado para la pestaña Silos: telemetría, gauge, autonomía, cargar/consumo.
 * Siempre disponible.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'expro.silos',
    pillar: 'expro',
    route: '/explotacion',
    tab: 'silos',
    applies: (flags) => true,
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        const silos = await window.db.getAllFromIndex('config_silos', 'fincaId', fincaId).catch(() => []);
        return silos.length > 0;
      } catch (e) {
        console.warn('[expro.silos] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Control de Silos',
        body: 'Esta pestaña (**Silos**) gestiona la **telemetría de alimentación**: capacidad total, almacenado, ocupación media. Cada silo tiene gauge circular (% nivel), autonomía estimada en días (basada en consumo real 30 días) y alerta roja si stock <15%. Color verde lima (--c-success).',
        target: null,
        position: 'center'
      },
      {
        title: 'KPIs globales (capacidad / almacenado / ocupación)',
        body: '3 tarjetas superiores: **Capacidad Total** (kg), **Almacenado** (kg, dorado), **Ocupación Media** (% verde/ámbar/rojo). Resumen instantáneo del estado de todos los silos.',
        target: '.grid .card',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Alerta Stock Crítico (<15%)',
        body: 'Si algún silo está <15% capacidad, aparece **tarjeta de alerta Bento roja** listando silos críticos con kg actual / capacidad (%). Click en silo → ficha → recargar. Requiere silos configurados.',
        target: '.card-resumen[style*="border-left: 4px solid var(--c-danger)"]',
        waitFor: 1500,
        position: 'below',
        optional: true,
        optionalReason: 'Solo aparece si hay silos con stock <15%'
      },
      {
        title: 'Tarjeta de silo: Gauge circular y autonomía',
        body: 'Cada silo muestra: **gauge SVG circular** (% nivel, color verde/ámbar/rojo), nombre + tipo alimento, badge "BAJO STOCK" si <15% (pulsante), **cantidad/capacidad kg**, **última carga**, **autonomía** (días, calculada por consumo real 30d). Click en gauge → recalibrar; click en cuerpo → ficha completa.',
        target: '.silo-gauge-container',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Acciones: Cargar / Consumo / Editar / Eliminar',
        body: '4 botones móviles por silo: **CARGAR** (llenar silo, registra entrada + gasto), **CONSUMO** (descuenta stock, imputa kg a rebaño + genera gasto analítico + evento), **EDITAR** (ficha técnica), **ELIMINAR** (con confirmación). FAB principal «Nuevo Silo» abajo a la derecha.',
        target: '.fab-container, [onclick*="SilosView._abrirLlenarSilo"], [onclick*="SilosView._abrirConsumirSilo"]',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Ficha de silo (click en tarjeta)',
        body: 'Modal full-screen: gauge grande, histórico de cargas/consumos (fecha, cantidad, tipo, origen/destino), autonomía actual, botones Cargar/Consumo/Editar/Eliminar. Trazabilidad completa del stock.',
        target: '[onclick*="SilosView._abrirFichaSilo"]',
        waitFor: 2000,
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
        body: 'Controla silos: crea silos, vigila gauge/autonomía, recarga antes de <15%, usa Consumo para imputar a rebaños y generar gastos automáticos. La guía está en el FAB.',
        target: null,
        position: 'center'
      }
    ]
  });
})();