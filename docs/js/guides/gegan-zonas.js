/**
 * Livestock Manager - Guía Zonas (GeGan)
 * Tour guiado para la pestaña Zonas: parcelas, PAC, UGM, carga ganadera, rotación, cuarentena fitosanitaria.
 * Lanza wizard real: ZonasView._crearZona() y rotación de pastos.
 */
(function () {
  'use strict';

  GuideRegistry.register({
    id: 'gegan.zonas',
    pillar: 'gegan',
    route: '/ganaderia',
    tab: 'zonas',
    applies: (flags) => true, // Siempre disponible
    disponible: async () => {
      if (!window.db) return true;
      try {
        const finca = window.Fincas ? await Fincas.getActive() : null;
        const zonas = (finca?.zonas || []).filter(z => !z.anulada);
        return zonas.length > 0;
      } catch (e) {
        console.warn('[gegan.zonas] disponible error:', e);
        return true;
      }
    },
    steps: [
      {
        title: 'Bienvenido a Zonas y Parcelas',
        body: 'Esta pestaña gestiona las **parcelas/zonas** de la finca: superficie (ha), aforo máximo, **código PAC** (subvenciones CCAA), uso principal, distancia a agua. Calcula **UGM/ha** (carga ganadera) y alerta **sobrepastoreo** (>1.0 UGM/ha). El color verde lima identifica esta sub-vista.',
        target: null,
        position: 'center'
      },
      {
        title: 'Ocupación global (colapsable)',
        body: 'Panel superior: **Total Zonas** y **Ocupación** (cabezas / aforo total + %). Barra de progreso coloreada: verde <80%, ámbar 80-100%, rojo >100% (sobrecarga). Click en chevron para colapsar.',
        target: '.card-resumen.card-total-3d',
        waitFor: 1000,
        position: 'below'
      },
      {
        title: 'Alerta de sobrepastoreo (Bento rojo)',
        body: 'Si alguna parcela supera **1.0 UGM/ha** (aforo ecológico máximo pastoreo extensivo), aparece una **alerta Bento rojo pulsante** listando parcelas afectadas con su carga UGM/ha. Botón «Sugerir Rotación Preventiva» abre asistente de interfaz.',
        target: '.card.border-danger.animate-pulse, [data-guide="btn-sugerir-rotacion"]',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: 'Tarjetas de zona (click para ficha)',
        body: 'Cada zona muestra: nombre, uso principal, superficie (ha), **carga UGM** y **censo/aforo (%)** con barra de progreso. Métricas: PAC (código parcela), distancia a agua, carga UGM/ha, especies presentes. **Botón «Rotar Lote / Rebaño»** (verde) o **bloqueado (rojo)** si hay cuarentena fitosanitaria. Click en tarjeta abre ficha de edición.',
        target: '.grid.gap-12 .card-registro',
        waitFor: 1500,
        position: 'above'
      },
      {
        title: 'Crear nueva zona (wizard 2 pasos)',
        body: 'Botón **«Nueva Zona»** abre wizard: (1) Identificación: nombre, aforo, superficie (ha), uso principal; (2) Requisitos: **código PAC** (obligatorio para subvenciones), distancia a agua (m). Genera ID único y guarda en finca.',
        target: '.module-header-primary-action button, [onclick*="ZonasView._crearZona"]',
        waitFor: true,
        position: 'below',
        launch: () => { if (window.ZonasView && ZonasView._crearZona) ZonasView._crearZona(); }
      },
      {
        title: 'Rotación de pastos (SIGGAN)',
        body: 'Botón **«Rotar Lote / Rebaño»** en cada zona (o modal desde alerta) abre selector: (1) elige rebaño/lote en zona origen; (2) elige parcela destino (muestra **bloqueadas en rojo** con fecha fin cuarentena); (3) motivo opcional. **Chequeo fitosanitario estricto** al confirmar: aborta si destino tiene cuarentena activa. Registra evento de traslado en auditoría.',
        target: '[data-guide="btn-rotar-lote"], #btn-confirmar-rotacion',
        waitFor: 2000,
        position: 'above'
      },
      {
        title: 'Cuarentena fitosanitaria (tiempo real)',
        body: 'Si una parcela tiene gastos de **fitosanitarios** con plazo de seguridad >0, se muestra **banner rojo pulsante**: «CUARENTENA ACTIVA (concepto) - BLOQUEADA HASTA fecha (Días restantes)». Botón rotación se deshabilita (rojo, cursor not-allowed). Se evalúa en render y al abrir rotación.',
        target: '.animate-pulse.text-danger, [data-guide="btn-rotar-bloqueado"]',
        waitFor: 2000,
        position: 'above'
      },
      {
        title: 'Ficha de zona (click en tarjeta / hash #/zona)',
        body: 'Edición completa: nombre, aforo, superficie, código PAC, uso principal, distancia a agua, localización. Métricas SIGGAN solo lectura: **UGM Total** y **Carga UGM/ha**. Guardar / Cancelar / Eliminar (con motivo de anulación y auditoría).',
        target: '#z-edit-nombre, #z-edit-pac, #z-edit-superficie',
        waitFor: 1500,
        position: 'below'
      },
      {
        title: '¡Listo!',
        body: 'Define parcelas con PAC, controla UGM/ha, rota lotes respetando cuarentenas fitosanitarias, evita sobrepastoreo (>1.0 UGM/ha). La guía está en el FAB «Guía» cuando la necesites.',
        target: null,
        position: 'center'
      }
    ]
  });
})();