/**
 * Livestock Manager - Guía Transportistas (CoMer)
 * Tour guiado para la pestaña Transportistas: flota, certificados, bienestar, termoneutralidad.
 * Siempre disponible.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'comer.transportistas',
    pillar: 'comer',
    route: '/comercializacion',
    tab: 'transportistas',
    applies: (flags) => true,
    disponible: async () => {
      if (!window.db) return true;
      try {
        const fincaId = window.Fincas ? await Fincas.getActiveId() : null;
        if (!fincaId) return false;
        // transportistas es store global (sin fincaId), pero solo tiene sentido con finca activa
        const transportistas = await window.db.getAll('transportistas').catch(() => []);
        return transportistas.length > 0;
      } catch (e) {
        console.warn('[comer.transportistas] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Transportistas',
        body: 'Esta pestaña (**Transportistas**) gestiona la **flota de transporte ganadero calificado** y control de certificados obligatorios. Cada ficha: matrícula, ATG, tipo vehículo (camión/furgoneta/remolque/cisterna), capacidad, certificado bienestar (con vencimiento), desinsectación, termoneutralidad. Badges de urgencia: rojo=caducado/sin cert, ámbar=≤30d, verde=OK. Color rosa (--c-pink). FAB «Nuevo Transportista».',
        target: null,
        position: 'center'
      },
      {
        title: 'Resumen de Flota',
        body: 'Tarjeta cabecera: **Total Flota** (blanco) y **Activos** (verde). Gradiente rosa, borde izquierdo rosa neón. Balance expandido: **Total Transportistas**, **Activos**, **Inactivos** (rojo).',
        target: '.module-header .card[style*="border-left: 4px solid var(--c-pink)"]',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Actividad Logística Mensual (últimos 6 meses)',
        body: 'Barras de **transportistas registrados por mes** (fecha_registro). Verde/ámbar/rojo según intensidad. Visualiza cuándo se incorporaron vehículos a la flota.',
        target: '.card-resumen .flex.gap-6',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Buscar y Filtrar',
        body: 'Campo `#search-transportistas`: filtra por **nombre, NIF, matrícula, teléfono o email**. Select `#transportistas-filtro-estado`: **Todos / Activos / Inactivos**. Ambos reducen la lista en tiempo real.',
        target: '#search-transportistas',
        waitFor: true,
        position: 'below'
      },
      {
        title: 'Lista de Transportistas (click = detalle)',
        body: 'Grid de tarjetas: **nombre** (título), **NIF + matrícula** (dorado, monoespaciado), **badge Activo/Inactivo** (verde/gris). Contenido: 3 badges de certificación con color dinámico: **Cert. Bienestar** (check/alerta + días restantes o CADUCADO/SIN CERTIFICADO en rojo), **Desinsectación** (calendario + días), **Termoneutral** (info badge si aplica). Footer: badge «Ficha ->» amarillo. Click abre detalle completo con KPIs expediciones y peso vivo.',
        target: '#transportistas-content .card-registro',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'FAB Nuevo Transportista',
        body: 'FAB rosa «Nuevo Transportista» abre **wizard modal centrado** (card-registro, z-index 6000): nombre, NIF/CIF, matrícula, nº registro transporte, ATG (obligatorio), desinsectación (fecha + vencimiento), teléfono, email, dirección/CP/ciudad/provincia, tipo vehículo (camión/furgoneta/remolque/cisterna), capacidad (animales), certificado bienestar (check + vencimiento), termoneutral (check), activo (check), notas. Guarda en `config_transportistas`.',
        target: '.fab-container',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Detalle de Transportista',
        body: 'Click en tarjeta → **ficha completa** (wizard-full-screen, header dorado): cabecera con nombre, badge Activo/Inactivo, grid datos (NIF, matrícula, teléfono, email, registro transporte, tipo vehículo, capacidad), badges certificados (bienestar con color urgencia, desinsectación, termoneutral), notas, KPIs: **Expediciones** y **Peso vivo total** (kg). Footer: Eliminar (rojo), Volver, Editar.',
        target: '#transportistas-content .card-registro',
        waitFor: 1500,
        optional: true,
        optionalReason: 'Se ve al hacer click en una tarjeta de la lista',
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
        body: 'Controla la logística: registra flota completa con ATG, vigila vencimientos (bienestar, desinsectación), marca termoneutrales, consulta expediciones. Alertas de caducidad en badges de lista y detalle. La guía está en el FAB.',
        target: null,
        position: 'center'
      }
    ]
  });
})();