/**
 * Livestock Manager - Especie/Crotal QA Test Suite v1.0.0
 *
 * Pruebas del modelo de datos maestros Especie / Tipo de Identificador y de
 * ErrorHandler.validateCrotal() contra las estructuras de código confirmadas
 * en docs/NORMATIVA-CROTAL-ESPECIE.md.
 *
 * EJECUCIÓN: Pegar en la consola del navegador (DevTools) con la app abierta.
 * Uso: await EspecieCrotalQA.runAll();
 */
const EspecieCrotalQA = {
  _results: [],

  _ts: () => new Date().toISOString().split('T')[1].split('.')[0],

  _log(status, module, detail) {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
    console.log(`[${this._ts()}] ${icon} [${module}] ${detail}`);
    this._results.push({ status, module, detail });
  },

  _assert(cond, module, detail) {
    this._log(cond ? 'PASS' : 'FAIL', module, detail);
    return !!cond;
  },

  async _expectValid(numero, especieId, tipoIdentificadorId) {
    try {
      await ErrorHandler.validateCrotal(numero, especieId, tipoIdentificadorId);
      return true;
    } catch (e) {
      return false;
    }
  },

  async _expectThrow(numero, especieId, tipoIdentificadorId) {
    return !(await this._expectValid(numero, especieId, tipoIdentificadorId));
  },

  async testCatalogosPoblados() {
    const M = 'CATÁLOGOS MAESTROS';
    let ok = true;
    const especies = await window.db.getAll('especies').catch(() => []);
    ok = this._assert(especies.length === 5, M, `especies tiene 5 filas (SIEX 01-05) — encontradas: ${especies.length}`) && ok;

    const tipos = await window.db.getAll('tipos_identificador').catch(() => []);
    ok = this._assert(tipos.length === 16, M, `tipos_identificador tiene 16 filas (RIIA) — encontradas: ${tipos.length}`) && ok;

    const asociaciones = await window.db.getAll('especie_tipo_identificador').catch(() => []);
    ok = this._assert(asociaciones.length >= 9, M, `especie_tipo_identificador tiene al menos 9 asociaciones — encontradas: ${asociaciones.length}`) && ok;
    return ok;
  },

  async testValidacionBovino() {
    const M = 'CROTAL BOVINO (12 dígitos, sin letras)';
    let ok = true;
    ok = this._assert(await this._expectValid('010112345678', 1, 16), M, '010112345678 (12 dígitos) es válido') && ok;
    ok = this._assert(await this._expectThrow('ES0112345678', 1, 16), M, 'ES0112345678 (con letras) es RECHAZADO') && ok;
    ok = this._assert(await this._expectThrow('0101123456', 1, 16), M, '0101123456 (10 dígitos, corto) es RECHAZADO') && ok;
    return ok;
  },

  async testValidacionOvinoCaprino() {
    const M = 'CROTAL OVINO/CAPRINO EID (ES + 12 dígitos)';
    let ok = true;
    ok = this._assert(await this._expectValid('ES010123456789', 3, 4), M, 'ES010123456789 (ovino, crotal electrónico) es válido') && ok;
    ok = this._assert(await this._expectValid('ES040123456789', 4, 2), M, 'ES040123456789 (caprino, bolo ruminal) es válido') && ok;
    ok = this._assert(await this._expectThrow('010123456789AB', 3, 4), M, '010123456789AB (sin ES al inicio) es RECHAZADO') && ok;
    return ok;
  },

  async testFallbackGenerico() {
    const M = 'FALLBACK SIN ESPECIE/TIPO (compatibilidad con callers existentes)';
    let ok = true;
    // Sin especieId/tipoIdentificadorId debe comportarse igual que validateCaravana (regex genérica)
    ok = this._assert(await this._expectValid('ES123456789012', null, null), M, 'ES123456789012 sin especie/tipo cae al formato genérico y es válido') && ok;
    ok = this._assert(await this._expectThrow('123456789012', null, null), M, '123456789012 (sin letras) sin especie/tipo es RECHAZADO por el formato genérico') && ok;
    return ok;
  },

  async runAll() {
    console.log('\n' + '='.repeat(75));
    console.log('🧪 ESPECIE/CROTAL QA SUITE v1.0');
    console.log('📅 ' + new Date().toLocaleString());
    console.log('='.repeat(75) + '\n');

    if (!window.db) {
      console.error('❌ ERROR: window.db no disponible. Espera a que la app cargue.');
      return;
    }

    this._results = [];
    let passed = 0, failed = 0;
    const tests = [
      ['testCatalogosPoblados', this.testCatalogosPoblados],
      ['testValidacionBovino', this.testValidacionBovino],
      ['testValidacionOvinoCaprino', this.testValidacionOvinoCaprino],
      ['testFallbackGenerico', this.testFallbackGenerico],
    ];

    for (const [name, fn] of tests) {
      try {
        const result = await fn.call(this);
        if (result) passed++; else failed++;
      } catch (e) {
        this._log('FAIL', name, `Excepción no controlada: ${e.message}`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(75));
    console.log('📊 REPORTE FINAL — ESPECIE/CROTAL QA v1.0');
    console.log(`✅ Aserciones OK: ${this._results.filter(r => r.status === 'PASS').length}`);
    console.log(`❌ Aserciones con fallo: ${this._results.filter(r => r.status === 'FAIL').length}`);
    const failures = this._results.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      console.log('\n❌ DETALLE DE FALLOS:');
      failures.forEach(f => console.log(`  ❌ [${f.module}] ${f.detail}`));
    }
    console.log('='.repeat(75) + '\n');

    return { passed, failed, total: tests.length, results: this._results };
  }
};

window.EspecieCrotalQA = EspecieCrotalQA;
console.log('✅ Especie/Crotal QA Suite v1.0 cargado. Ejecuta: await EspecieCrotalQA.runAll()');
