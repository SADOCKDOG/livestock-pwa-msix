/**
 * Livestock Manager - GuiaQA
 * Suite de tests automatizados para guías interactivas.
 * Ejecutar en DevTools: GuiaQA.runAll()
 */
(function () {
  'use strict';

  const _results = [];
  let _passed = 0;
  let _failed = 0;

  function _log(label, ok, details = '') {
    const icon = ok ? '✅' : '❌';
    const msg = `${icon} [GuiaQA] ${label}${details ? ' — ' + details : ''}`;
    if (ok) _passed++; else _failed++;
    _results.push({ label, ok, details });
    console.log(msg);
    return ok;
  }

  function _assert(condition, label, details) {
    if (!condition) {
      _log(label, false, details || 'Assertion failed');
      return false;
    }
    _log(label, true);
    return true;
  }

  function _assertEquals(actual, expected, label) {
    const ok = actual === expected;
    _log(label, ok, `expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
    return ok;
  }

  function _assertIncludes(arr, item, label) {
    const ok = Array.isArray(arr) && arr.includes(item);
    _log(label, ok, `array=${JSON.stringify(arr)}, item=${JSON.stringify(item)}`);
    return ok;
  }

  // ==================== TESTS ====================

  async function testRegistryExists() {
    _assert(!!window.GuideRegistry, 'GuideRegistry expuesto en window', 'Debe estar registrado como window.GuideRegistry');
    _assert(typeof GuideRegistry.register === 'function', 'GuideRegistry.register es función');
    _assert(typeof GuideRegistry.getByRouteTab === 'function', 'GuideRegistry.getByRouteTab es función');
    _assert(typeof GuideRegistry.getPanoramica === 'function', 'GuideRegistry.getPanoramica es función');
    _assert(typeof GuideRegistry.getAll === 'function', 'GuideRegistry.getAll es función');
    _assert(typeof GuideRegistry.clear === 'function', 'GuideRegistry.clear es función');
  }

  async function testManagerExists() {
    _assert(!!window.GuideManager, 'GuideManager expuesto en window');
    _assert(typeof GuideManager.maybeStart === 'function', 'GuideManager.maybeStart es función');
    _assert(typeof GuideManager.start === 'function', 'GuideManager.start es función');
    _assert(typeof GuideManager.isEnabled === 'function', 'GuideManager.isEnabled es función');
    _assert(typeof GuideManager._hydrate === 'function', 'GuideManager._hydrate es función');
  }

  async function testGuideCatalog() {
    const all = GuideRegistry.getAll();
    _assert(Array.isArray(all), 'getAll devuelve array');
    _assert(all.length === 21, 'Catálogo tiene 21 guías', `actual=${all.length}`);

    // Verificar IDs esperados (pilar.tab)
    const expectedIds = [
      'gegan.panoramica', 'gegan.animales', 'gegan.rebanos', 'gegan.patrimonio', 'gegan.zonas', 'gegan.sanidad',
      'expro.panoramica', 'expro.explotacion', 'expro.lacteo', 'expro.silos', 'expro.fitosanitarios', 'expro.gastos', 'expro.proveedores', 'expro.tramites',
      'comer.panoramica', 'comer.leche', 'comer.carne', 'comer.compradores', 'comer.contratos', 'comer.transportistas'
    ];
    for (const id of expectedIds) {
      _assertIncludes(all.map(g => g.id), id, `Guía registrada: ${id}`);
    }
  }

  async function testGuideStructure() {
    const all = GuideRegistry.getAll();
    for (const g of all) {
      _assert(typeof g.id === 'string' && g.id.length > 0, `Estructura ${g.id}: id string`);
      _assert(['gegan', 'expro', 'comer'].includes(g.pillar), `Estructura ${g.id}: pillar válido`, `actual=${g.pillar}`);
      _assert(typeof g.route === 'string' && g.route.startsWith('/'), `Estructura ${g.id}: route válido`, `actual=${g.route}`);
      _assert(g.tab === null || typeof g.tab === 'string', `Estructura ${g.id}: tab string|null`, `actual=${g.tab}`);
      _assert(typeof g.applies === 'function', `Estructura ${g.id}: applies es función`);
      _assert(Array.isArray(g.steps) && g.steps.length > 0, `Estructura ${g.id}: steps array no vacío`, `len=${g.steps ? g.steps.length : 'N/A'}`);

      for (const step of g.steps) {
        _assert(typeof step.title === 'string', `Step ${g.id}: title string`);
        _assert(typeof step.body === 'string', `Step ${g.id}: body string`);
        _assert(step.target === undefined || typeof step.target === 'string', `Step ${g.id}: target string|undefined`);
        _assert(step.waitFor === undefined || typeof step.waitFor === 'number', `Step ${g.id}: waitFor number|undefined`);
        _assert(step.launch === undefined || typeof step.launch === 'function', `Step ${g.id}: launch function|undefined`);
        _assert(step.position === undefined || ['above', 'below', 'left', 'right', 'center'].includes(step.position), `Step ${g.id}: position válida`);
      }
    }
  }

  async function testAppliesFiltering() {
    const guides = GuideRegistry.getAll();
    const lecheOnly = guides.filter(g => g.applies({ leche: true, carne: false }));
    const carneOnly = guides.filter(g => g.applies({ leche: false, carne: true }));
    const both = guides.filter(g => g.applies({ leche: true, carne: true }));

    _assert(carneOnly.some(g => g.id === 'gegan.patrimonio'), 'gegan.patrimonio solo en carne');
    _assert(!lecheOnly.some(g => g.id === 'gegan.patrimonio'), 'gegan.patrimonio NO en leche');
    _assert(both.some(g => g.id.startsWith('comer.leche')), 'comer.leche disponible en both');
    _assert(both.some(g => g.id.startsWith('comer.carne')), 'comer.carne disponible en both');
  }

  async function testGetByRouteTab() {
    const guide = GuideRegistry.getByRouteTab('/ganaderia', 'animales', { leche: true, carne: false });
    _assert(guide && guide.id === 'gegan.animales', 'getByRouteTab encuentra gegan.animales', guide ? guide.id : 'null');

    const pan = GuideRegistry.getPanoramica('/ganaderia', { leche: true, carne: false });
    _assert(pan && pan.id === 'gegan.panoramica', 'getPanoramica encuentra gegan.panoramica', pan ? pan.id : 'null');
  }

  async function testIconsAyuda() {
    _assert(!!window.Icons, 'Icons namespace existe');
    _assert(typeof Icons.ayuda === 'function', 'Icons.ayuda es función');
    const svg = Icons.ayuda();
    _assert(typeof svg === 'string' && svg.includes('<svg'), 'Icons.ayuda devuelve SVG string');
  }

  async function testConfigDefaults() {
    // Simular carga de config por defecto
    const defaults = {
      objGmd: 0.8, objLitros: 25, objFert: 85, objOcup: 85, objRent: 20, objBajas: 5,
      autoBackup: false, temaOscuro: true, mostrarContextos: true,
      glowMarco: true, glowLaterales: false, glowBotones: true, glowTarjetas: true,
      glowMarcoFijo: false, glowMarcoFijoColor: '#FFFFFF', bannerOpacity: 0.77,
      hazLuzColor: '', hazLuzIntensidad: 50,
      fabColor: '#FFFFFF', fabIntensidad: 40,
      colorTema: 'gold', temaClaroColor: 'arena', formatoFecha: 'es-ES', moneda: '€', especies: [],
      alertSanidad: true, alertTrazabilidad: true, alertPAC: true,
      alertADSG: true, alertINCOLAC: true, alertContratos: false,
      // Guías interactivas
      guiasActivadas: true,
      guiasVistas: {}
    };

    _assert(defaults.guiasActivadas === true, 'Config por defecto: guiasActivadas=true');
    _assert(typeof defaults.guiasVistas === 'object', 'Config por defecto: guiasVistas es objeto');
  }

  async function testAppHelpers() {
    _assert(typeof App._viewForMethod === 'function', 'App._viewForMethod existe');
    _assert(App._viewForMethod('renderGanaderia') === 'GanaderiaView', '_viewForMethod mapea renderGanaderia');
    _assert(App._viewForMethod('renderExplotacion') === 'ExplotacionView', '_viewForMethod mapea renderExplotacion');
    _assert(App._viewForMethod('renderComercializacion') === 'ComercializacionView', '_viewForMethod mapea renderComercializacion');
    _assert(App._viewForMethod('renderAnimales') === 'GanaderiaView', '_viewForMethod mapea renderAnimales');
    _assert(App._viewForMethod('renderSilos') === 'ExplotacionView', '_viewForMethod mapea renderSilos');
    _assert(App._viewForMethod('renderContrato') === 'ComercializacionView', '_viewForMethod mapea renderContrato');

    _assert(typeof App._cambiarSubmoduloConGuia === 'function', 'App._cambiarSubmoduloConGuia existe');
    _assert(typeof App.renderGuideFab === 'function', 'App.renderGuideFab existe');
  }

  async function testSubviewsReturnRender() {
    // Verificar que las 3 vistas parcheadas devuelven this.render()
    // GanaderiaView
    if (window.GanaderiaView) {
      const src = GanaderiaView._cambiarSubModulo.toString();
      _assert(src.includes('return this.render'), 'GanaderiaView._cambiarSubModulo devuelve this.render()');
    }

    // ExplotacionView
    if (window.ExplotacionView) {
      const src = ExplotacionView._cambiarSubModulo.toString();
      _assert(src.includes('return this.render'), 'ExplotacionView._cambiarSubModulo devuelve this.render()');
    }

    // ComercializacionView
    if (window.ComercializacionView) {
      const src = ComercializacionView._cambiarSubModulo.toString();
      _assert(src.includes('return this.render'), 'ComercializacionView._cambiarSubModulo devuelve this.render()');
    }
  }

  async function testSettingsViewConfig() {
    const cfg = await AjustesView._loadConfig();
    _assert(cfg.guiasActivadas === true, 'AjustesView._loadConfig incluye guiasActivadas=true por defecto');
    _assert(typeof cfg.guiasVistas === 'object', 'AjustesView._loadConfig incluye guiasVistas={} por defecto');

    // Verificar métodos
    _assert(typeof AjustesView._toggleGuias === 'function', 'AjustesView._toggleGuias existe');
    _assert(typeof AjustesView._reiniciarGuias === 'function', 'AjustesView._reiniciarGuias existe');
  }

  async function testLazyLoadGroups() {
    const gegan = App._viewGroups?.gegan || [];
    const expro = App._viewGroups?.expro || [];
    const comer = App._viewGroups?.comer || [];

    const guidePatterns = [
      'js/guides/gegan-panoramica.js',
      'js/guides/gegan-animales.js',
      'js/guides/gegan-rebanos.js',
      'js/guides/gegan-patrimonio.js',
      'js/guides/gegan-zonas.js',
      'js/guides/gegan-sanidad.js',
      'js/guides/expro-panoramica.js',
      'js/guides/expro-explotacion.js',
      'js/guides/expro-lacteo.js',
      'js/guides/expro-silos.js',
      'js/guides/expro-fitosanitarios.js',
      'js/guides/expro-gastos.js',
      'js/guides/expro-proveedores.js',
      'js/guides/expro-tramites.js',
      'js/guides/comer-panoramica.js',
      'js/guides/comer-leche.js',
      'js/guides/comer-carne.js',
      'js/guides/comer-compradores.js',
      'js/guides/comer-contratos.js',
      'js/guides/comer-transportistas.js'
    ];

    for (const gp of guidePatterns) {
      const inGegan = gegan.includes(gp);
      const inExpro = expro.includes(gp);
      const inComer = comer.includes(gp);
      _assert(inGegan || inExpro || inComer, `Lazy-load: ${gp} incluido en algún _viewGroups`);
    }
  }

  async function testRouteGroupsMapping() {
    _assert(App._routeGroups?.['/ganaderia'] === 'gegan', 'routeGroups /ganaderia -> gegan');
    _assert(App._routeGroups?.['/explotacion'] === 'expro', 'routeGroups /explotacion -> expro');
    _assert(App._routeGroups?.['/comercializacion'] === 'comer', 'routeGroups /comercializacion -> comer');
  }

  // ==================== RUNNER ====================

  async function runAll() {
    console.log('%c[GuiaQA] ===== INICIANDO TESTS GUIAS INTERACTIVAS =====', 'color: var(--c-info); font-weight: 900; font-size: 1.2rem;');
    _results.length = 0;
    _passed = 0;
    _failed = 0;

    const tests = [
      testRegistryExists,
      testManagerExists,
      testGuideCatalog,
      testGuideStructure,
      testAppliesFiltering,
      testGetByRouteTab,
      testIconsAyuda,
      testConfigDefaults,
      testAppHelpers,
      testSubviewsReturnRender,
      testSettingsViewConfig,
      testLazyLoadGroups,
      testRouteGroupsMapping
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (e) {
        _log(test.name, false, `EXCEPTION: ${e.message}`);
      }
    }

    console.log('%c[GuiaQA] ===== RESUMEN =====', 'color: var(--c-info); font-weight: 900; font-size: 1.2rem;');
    console.log(`✅ Pasados: ${_passed}`);
    console.log(`❌ Fallidos: ${_failed}`);
    console.log(`Total: ${_passed + _failed}`);

    if (_failed > 0) {
      console.table(_results.filter(r => !r.ok).map(r => ({ Test: r.label, Detalle: r.details })));
    }

    return { passed: _passed, failed: _failed, total: _passed + _failed, results: _results };
  }

  /**
   * Valida los `target` de las guías registradas CONTRA EL DOM REAL, recorriendo
   * cada sub-módulo. Un selector puede ser CSS válido y aun así no encontrar nada:
   * `runAll` no lo detecta porque no navega. Ejecutar desde la vista del pilar:
   *
   *   await GuiaQA.validarTargets('GanaderiaView')
   *
   * Devuelve, por guía, los pasos cuyo target no resuelve. Un paso puede fallar
   * legítimamente si su elemento solo existe tras abrir un formulario o si no hay
   * datos; revisar caso por caso antes de dar la guía por buena.
   */
  async function validarTargets(viewName) {
    const view = window[viewName];
    if (!view || typeof view._cambiarSubModulo !== 'function') {
      console.error('[GuiaQA] Vista no encontrada o sin _cambiarSubModulo:', viewName);
      return null;
    }
    // Solo las guías del pilar que se está validando: el registro puede tener cargadas
    // guías de otras rutas, y medirlas aquí produciría 0/N falsos.
    const rutaActual = (location.hash.slice(1) || '/').split('?')[0];
    const todas = window.GuideRegistry ? GuideRegistry.getAll() : [];
    // Además de la ruta, se respeta applies(flags): una guía que no se muestra con los
    // flags activos (p. ej. comer.carne con Carne OFF) no debe contarse como fallo — sus
    // targets pertenecen a una pestaña que ni siquiera existe en ese modo.
    const flags = window.ModoContextoHelper
      ? (ModoContextoHelper.getFlags() || { leche: true, carne: false })
      : { leche: true, carne: false };
    const guias = todas.filter(g => g.route === rutaActual && (!g.applies || g.applies(flags)));
    if (!guias.length) {
      console.warn(`[GuiaQA] Ninguna guía registrada para la ruta ${rutaActual}. ¿Estás en la vista correcta?`);
      return { informe: {}, totales: { conTarget: 0, resuelven: 0, invalidos: 0, noEncuentran: 0 } };
    }
    const informe = {};

    // Espera inicial: las guías panorámicas (tab: null) no cambian de pestaña, así que
    // se medirían de inmediato. Si se llama justo tras navegar a la vista, el render aún
    // no ha terminado y todos sus targets salen como "sin coincidencia" (falso negativo).
    await new Promise(r => setTimeout(r, 1500));

    for (const g of guias) {
      if (g.tab) {
        await App._cambiarSubmoduloConGuia(viewName, g.tab);
        await new Promise(r => setTimeout(r, 1500)); // render + carga de datos
      }
      const fila = { tab: g.tab || '(panorámica)', conTarget: 0, resuelven: 0, invalidos: [], noEncuentran: [] };
      g.steps.forEach((step, i) => {
        if (!step.target) return;
        fila.conTarget++;
        try {
          document.querySelector(step.target) ? fila.resuelven++ : fila.noEncuentran.push({ paso: i, selector: step.target });
        } catch (e) {
          fila.invalidos.push({ paso: i, selector: step.target });
        }
      });
      informe[g.id] = fila;
    }

    const totales = Object.values(informe).reduce((a, f) => ({
      conTarget: a.conTarget + f.conTarget,
      resuelven: a.resuelven + f.resuelven,
      invalidos: a.invalidos + f.invalidos.length,
      noEncuentran: a.noEncuentran + f.noEncuentran.length
    }), { conTarget: 0, resuelven: 0, invalidos: 0, noEncuentran: 0 });

    console.log(`[GuiaQA] targets: ${totales.resuelven}/${totales.conTarget} resuelven · ` +
                `${totales.invalidos} selectores inválidos · ${totales.noEncuentran} sin coincidencia`);
    console.table(Object.entries(informe).map(([id, f]) => ({
      Guia: id, Tab: f.tab, OK: `${f.resuelven}/${f.conTarget}`,
      Invalidos: f.invalidos.length, SinCoincidencia: f.noEncuentran.length
    })));
    Object.entries(informe).forEach(([id, f]) => {
      [...f.invalidos, ...f.noEncuentran].forEach(x =>
        console.warn(`  ${id} paso ${x.paso}: ${x.selector}`));
    });

    return { informe, totales };
  }

  window.GuiaQA = { runAll, validarTargets };
})();