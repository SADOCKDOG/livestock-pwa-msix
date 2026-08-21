/**
 * Livestock Manager - Premium QA Test Suite v1.1.0
 *
 * 1) Límite Free/Premium (1 finca en Free, ilimitadas en Premium), verificado
 *    contra CADA vía de alta de finca conocida (Fincas.save() para una finca
 *    nueva, Fincas.crearNueva()), para detectar automáticamente si una futura
 *    vía nueva olvida comprobar el límite.
 * 2) Persistencia de las guías interactivas en appConfig.guides: toggle de
 *    Ajustes, seen[], dismissed[] y "Reiniciar todas". v1.1.
 *
 * EJECUCIÓN: Pegar en la consola del navegador (DevTools) con la app abierta.
 * Uso: await PremiumQA.runAll();
 */
const PremiumQA = {
  _MARKER: 'PREMIUM-QA',
  _results: [],

  _ts: () => new Date().toISOString().split('T')[1].split('.')[0],

  _log(status, module, detail, category = '') {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '⏳';
    const cat = category ? ` [${category}]` : '';
    console.log(`[${this._ts()}] ${icon} [${module}]${cat} ${detail}`);
    this._results.push({ status, module, detail, category, time: this._ts() });
  },

  _assert(cond, module, detail, category = '') {
    this._log(cond ? 'PASS' : 'FAIL', module, detail, category);
    return !!cond;
  },

  /** Ejecuta fn con PremiumManager.isFree() forzado a un valor fijo, y lo restaura siempre. */
  async _conIsFreeForzado(valor, fn) {
    const original = window.PremiumManager && window.PremiumManager.isFree;
    if (!original) throw new Error('PremiumManager no disponible');
    window.PremiumManager.isFree = () => valor;
    try {
      return await fn();
    } finally {
      window.PremiumManager.isFree = original;
    }
  },

  /** Ejecuta una función async esperando que LANCE. Silencia console.error (esperado). */
  async _expectThrow(fn) {
    const backup = console.error;
    console.error = () => {};
    let threw = false;
    try {
      await fn();
    } catch (e) {
      threw = true;
    } finally {
      console.error = backup;
    }
    return threw;
  },

  /**
   * Verifica que, con al menos una finca ya existente, el límite Free (1 finca)
   * bloquea toda alta nueva vía Fincas.save() y Fincas.crearNueva() — y que
   * Premium (o datos.demo) no se ve afectado.
   */
  async testLimiteFincaFree() {
    const M = 'LÍMITE FREE — 1 FINCA';
    this._log('RUN', M, 'Iniciando validación del límite Free/Premium de fincas');

    if (!this._assert(window.PremiumManager, M, 'PremiumManager disponible', 'PRE-REQ')) return false;
    if (!this._assert(window.Fincas, M, 'Fincas disponible', 'PRE-REQ')) return false;

    const existentes = await Fincas.list();
    if (!this._assert(existentes.length > 0, M, 'Hay al menos una finca existente (requisito del test)', 'PRE-REQ')) {
      this._log('WARN', M, 'Sin fincas previas: carga la Demo CHAMORRO en Ajustes antes de ejecutar este test', 'PRE-REQ');
      return false;
    }

    const datosNuevaFinca = {
      nombre: this._MARKER + '-' + Date.now(),
      propietario: 'Test QA',
      direccion: 'Test',
      zonas: []
    };

    let ok = true;

    // 1) Free + finca ya existente → Fincas.save() (alta nueva) debe LANZAR
    ok = await this._conIsFreeForzado(true, async () => {
      const threw = await this._expectThrow(() => Fincas.save({ ...datosNuevaFinca }));
      return this._assert(threw, M, 'Free bloquea Fincas.save() de una 2ª finca', 'SAVE');
    }) && ok;

    // 2) Free + finca ya existente → Fincas.crearNueva() debe LANZAR
    ok = await this._conIsFreeForzado(true, async () => {
      const threw = await this._expectThrow(() => Fincas.crearNueva({ ...datosNuevaFinca }));
      return this._assert(threw, M, 'Free bloquea Fincas.crearNueva() de una 2ª finca', 'CREAR-NUEVA');
    }) && ok;

    // 3) Free + datos.demo === true → NUNCA debe bloquear (la carga de demo debe seguir funcionando)
    ok = await this._conIsFreeForzado(true, async () => {
      let threw = false;
      try {
        await Fincas._assertPuedeCrearFinca({ ...datosNuevaFinca, demo: true });
      } catch (e) {
        threw = true;
      }
      return this._assert(!threw, M, 'Free NO bloquea altas marcadas como demo (datos.demo=true)', 'DEMO');
    }) && ok;

    // 4) Premium (isFree()=false) + finca ya existente → NO debe bloquear
    ok = await this._conIsFreeForzado(false, async () => {
      let threw = false;
      try {
        await Fincas._assertPuedeCrearFinca({ ...datosNuevaFinca });
      } catch (e) {
        threw = true;
      }
      return this._assert(!threw, M, 'Premium NO bloquea el alta de una 2ª finca', 'PREMIUM');
    }) && ok;

    // 5) Editar la finca activa (esEdicion=true) NUNCA debe pasar por el límite de altas, ni en Free
    const activa = await Fincas.getActive();
    if (activa) {
      ok = await this._conIsFreeForzado(true, async () => {
        let threw = false;
        try {
          await Fincas.save({ ...activa });
        } catch (e) {
          threw = true;
        }
        return this._assert(!threw, M, 'Free NO bloquea la edición de la finca ya existente', 'EDICIÓN');
      }) && ok;
    }

    return ok;
  },

  /**
   * Persistencia de las guías interactivas en appConfig.guides.
   *
   * El contrato es appConfig.guides = { enabled, seen[], dismissed[] } (spec §3.3):
   * GuideManager lee esas claves exactas y AjustesView escribe sobre ellas. Cuando se
   * desincronizaron, el interruptor de Ajustes dejó de apagar nada sin dar ningún error,
   * así que conviene comprobar el ciclo completo, no solo que la clave exista.
   *
   * Restaura siempre la configuración previa del usuario.
   */
  async testPersistenciaGuias() {
    const M = 'GUÍAS — PERSISTENCIA';
    this._log('INFO', M, 'Verificando appConfig.guides = { enabled, seen, dismissed }');

    if (!window.GuideManager || !window.AjustesView) {
      this._log('WARN', M, 'GuideManager o AjustesView no disponibles: prueba omitida', 'ENTORNO');
      return true;
    }

    const previo = JSON.parse(JSON.stringify((await AjustesView._loadConfig()).guides || {}));
    let ok = true;
    try {
      // Defaults: una config sin `guides` no debe romper la lectura.
      await AjustesView._saveConfig({ guides: { enabled: true, seen: [], dismissed: [] } });
      ok = this._assert(GuideManager.isEnabled() === true, M, 'isEnabled() true con guides.enabled = true', 'TOGGLE') && ok;

      // El interruptor de Ajustes tiene que verse desde el motor de inmediato.
      await AjustesView._toggleGuias(false);
      ok = this._assert(GuideManager.isEnabled() === false, M, 'Toggle OFF en Ajustes apaga isEnabled()', 'TOGGLE') && ok;

      await AjustesView._toggleGuias(true);
      ok = this._assert(GuideManager.isEnabled() === true, M, 'Toggle ON en Ajustes reactiva isEnabled()', 'TOGGLE') && ok;

      // Con el toggle apagado no debe auto-arrancar ninguna guía. Se cierra antes
      // cualquier tour en curso: si no, la aserción mediría el overlay que ya había.
      GuideManager.skip();
      await AjustesView._toggleGuias(false);
      await GuideManager.maybeStart('/ganaderia', 'animales');
      ok = this._assert(!document.querySelector('.guide-overlay'), M, 'Con toggle OFF, maybeStart no monta overlay', 'TOGGLE') && ok;
      await AjustesView._toggleGuias(true);

      // seen y dismissed sobreviven a la escritura y se leen de vuelta.
      await AjustesView._saveConfig({ guides: { enabled: true, seen: ['qa.seen'], dismissed: ['qa.dismissed'] } });
      const releido = (await AjustesView._loadConfig()).guides || {};
      ok = this._assert(Array.isArray(releido.seen) && releido.seen.includes('qa.seen'), M, 'seen[] persiste en IndexedDB', 'PERSISTENCIA') && ok;
      ok = this._assert(Array.isArray(releido.dismissed) && releido.dismissed.includes('qa.dismissed'), M, 'dismissed[] persiste en IndexedDB', 'PERSISTENCIA') && ok;
      ok = this._assert(App._config?.guides?.seen?.includes('qa.seen'), M, 'App._config refleja la escritura (lectura caliente)', 'PERSISTENCIA') && ok;

      // "Reiniciar todas" vacía ambas listas sin tocar el interruptor.
      const confirmBackup = window.Confirm && Confirm.confirm;
      if (confirmBackup) Confirm.confirm = async () => true;
      try {
        await AjustesView._reiniciarGuias();
      } finally {
        if (confirmBackup) Confirm.confirm = confirmBackup;
      }
      const traReset = (await AjustesView._loadConfig()).guides || {};
      ok = this._assert((traReset.seen || []).length === 0 && (traReset.dismissed || []).length === 0, M, 'Reiniciar todas vacía seen[] y dismissed[]', 'RESET') && ok;
      ok = this._assert(traReset.enabled === true, M, 'Reiniciar todas NO desactiva las guías', 'RESET') && ok;

      // El registro no debe contener ids duplicados (dos ficheros registrando lo mismo).
      if (window.GuideRegistry) {
        const ids = GuideRegistry.getAll().map(g => g.id);
        ok = this._assert(new Set(ids).size === ids.length, M, `Sin ids duplicados en el registro (${ids.length} guías cargadas)`, 'REGISTRO') && ok;
      }
    } catch (e) {
      this._log('FAIL', M, `Excepción no controlada: ${e.message}`, 'EXCEPCIÓN');
      ok = false;
    } finally {
      await AjustesView._saveConfig({ guides: previo });
      this._log('INFO', M, 'Configuración de guías del usuario restaurada');
    }

    return ok;
  },

  async runAll() {
    console.log('\n' + '='.repeat(75));
    console.log('🧪 PREMIUM QA SUITE v1.1 — Límite Free/Premium + Guías');
    console.log('📅 ' + new Date().toLocaleString());
    console.log('='.repeat(75) + '\n');

    if (!window.db) {
      console.error('❌ ERROR: window.db no disponible. Espera a que la app cargue.');
      return;
    }

    this._results = [];
    const startTime = Date.now();

    let passed = 0, failed = 0;
    const suites = [
      ['LÍMITE FREE — 1 FINCA', () => this.testLimiteFincaFree()],
      ['GUÍAS — PERSISTENCIA', () => this.testPersistenciaGuias()]
    ];
    for (const [nombre, fn] of suites) {
      try {
        if (await fn()) passed++; else failed++;
      } catch (e) {
        this._log('FAIL', nombre, `Excepción no controlada: ${e.message}`, 'EXCEPCIÓN');
        failed++;
      }
    }

    const totalTime = Date.now() - startTime;

    console.log('\n' + '='.repeat(75));
    console.log('📊 REPORTE FINAL — PREMIUM QA v1.1');
    console.log('='.repeat(75));
    console.log(`⏱️  Tiempo total: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`✅ Aserciones OK: ${this._results.filter(r => r.status === 'PASS').length}`);
    console.log(`❌ Aserciones con fallo: ${this._results.filter(r => r.status === 'FAIL').length}`);

    const failures = this._results.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      console.log('\n❌ DETALLE DE FALLOS:');
      failures.forEach(f => console.log(`  ❌ [${f.module}]${f.category ? ` [${f.category}]` : ''} ${f.detail}`));
    }

    console.log('\n' + '='.repeat(75));
    console.log(failed === 0 ? '🎉 LÍMITE FREE/PREMIUM Y PERSISTENCIA DE GUÍAS CORRECTOS' : '⚠️ HAY FALLOS — Revisar detalle arriba');
    console.log('='.repeat(75) + '\n');

    return { passed, failed, total: suites.length, results: this._results };
  }
};

window.PremiumQA = PremiumQA;
console.log('✅ Premium QA Suite v1.1 cargado. Ejecuta: await PremiumQA.runAll()');
