/**
 * Livestock Manager - Plan Mejora SIGGAN QA Test Suite v1.0.0
 *
 * Pruebas de los gaps implementados en docs/PLAN-MEJORA-SIGGAN.md
 * (auditoría 2026-07-21/22): catálogo de razas, tabla de correspondencia
 * SIGGAN (Espe), validación de crotal equino, modelo jerárquico de
 * vacunaciones, instalaciones de finca y restricción de movimientos.
 *
 * EJECUCIÓN: Pegar en la consola del navegador (DevTools) con la app abierta.
 * Uso: await PlanSigganQA.runAll();
 * Al final llama a cleanup() para borrar los datos de prueba creados.
 */
const PlanSigganQA = {
  _results: [],
  _createdIds: { vacunaciones: [], fincaInstalacionIdx: null, animalId: null, rebanoId: null, fincaId: null },

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

  /** Asegura una finca/rebaño/animal mínimos de prueba, reutilizando lo que ya exista. */
  async _ensureDatosBase() {
    let fincas = await window.db.getAll('fincas').catch(() => []);
    let finca = fincas[0];
    if (!finca) {
      const id = await window.Fincas.save({ nombre: 'QA Plan SIGGAN', propietario: 'QA', rega: 'ES999990000001' });
      finca = await window.Fincas.get(id);
    }
    await window.Fincas.setActiveId(finca.id);
    this._createdIds.fincaId = finca.id;

    let rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', finca.id).catch(() => []);
    let rebano = rebanos[0];
    if (!rebano) {
      const rebanoId = await window.db.add('rebanos', { fincaId: finca.id, nombre: 'QA Rebaño', especie: 'Ovejas' });
      rebano = await window.db.get('rebanos', rebanoId);
    }
    this._createdIds.rebanoId = rebano.id;

    let animales = await window.db.getAllFromIndex('animales', 'rebanoId', rebano.id).catch(() => []);
    let animal = animales[0];
    if (!animal) {
      const animalId = await window.db.add('animales', { rebanoId: rebano.id, numero_identificacion: 'ES0999999999', especie: 'Ovejas', sexo: 'H' });
      animal = await window.db.get('animales', animalId);
    }
    this._createdIds.animalId = animal.id;

    return { finca, rebano, animal };
  },

  async testCatalogoRazas() {
    const M = 'CATÁLOGO DE RAZAS (163 razas oficiales)';
    let ok = true;
    const razas = await window.db.getAll('razas').catch(() => []);
    ok = this._assert(razas.length === 163, M, `razas tiene 163 filas — encontradas: ${razas.length}`) && ok;

    const porEspecie = {};
    razas.forEach((r) => { porEspecie[r.especieId] = (porEspecie[r.especieId] || 0) + 1; });
    ok = this._assert(porEspecie[1] === 47, M, `bovino (especieId 1) tiene 47 razas — encontradas: ${porEspecie[1]}`) && ok;
    ok = this._assert(porEspecie[5] === 27, M, `équido (especieId 5) tiene 27 razas — encontradas: ${porEspecie[5]}`) && ok;

    const frisona = razas.find((r) => r.nombre === 'FRISONA' && r.especieId === 1);
    ok = this._assert(!!frisona, M, 'FRISONA existe con especieId 1 (bovino)') && ok;
    ok = this._assert(frisona && frisona.clasificacion === 1003, M, `FRISONA tiene clasificacion 1003 (Integrada en España) — encontrada: ${frisona?.clasificacion}`) && ok;
    return ok;
  },

  async testEspeciesCorrespondenciaSiggan() {
    const M = 'CORRESPONDENCIA ESPECIE SIGGAN (campo Espe del fichero de incorporación)';
    let ok = true;
    const especies = await window.db.getAll('especies').catch(() => []);
    const bovino = especies.find((e) => e.id === 1);
    const ovino = especies.find((e) => e.id === 3);
    const caprino = especies.find((e) => e.id === 4);
    const equido = especies.find((e) => e.id === 5);

    ok = this._assert(bovino?.codigo_espe_siggan === '02', M, `Bovino codigo_espe_siggan = '02' — encontrado: ${bovino?.codigo_espe_siggan}`) && ok;
    ok = this._assert(equido?.codigo_espe_siggan === '01', M, `Équido codigo_espe_siggan = '01' — encontrado: ${equido?.codigo_espe_siggan}`) && ok;
    ok = this._assert(ovino?.codigo_espe_siggan === '04' && ovino?.espe_id_siggan === 3, M, `Ovino codigo_espe_siggan='04' espe_id_siggan=3 — encontrado: ${ovino?.codigo_espe_siggan}/${ovino?.espe_id_siggan}`) && ok;
    ok = this._assert(caprino?.codigo_espe_siggan === '04' && caprino?.espe_id_siggan === 2, M, `Caprino codigo_espe_siggan='04' espe_id_siggan=2 — encontrado: ${caprino?.codigo_espe_siggan}/${caprino?.espe_id_siggan}`) && ok;
    return ok;
  },

  async testValidacionEquino() {
    const M = 'CROTAL EQUINO (microchip UELN 15 dígitos)';
    let ok = true;
    ok = this._assert(await this._expectValid('724901000007790', 5, 3), M, '724901000007790 (15 dígitos, microchip) es válido') && ok;
    ok = this._assert(await this._expectThrow('12345', 5, 3), M, '12345 (5 dígitos, microchip) es RECHAZADO') && ok;
    ok = this._assert(await this._expectValid('41/053850', 5, 14), M, '41/053850 (DIE con formato heredado variable) es válido — sin regex estricta') && ok;
    ok = this._assert(await this._expectThrow('', 5, 14), M, 'DIE vacío es RECHAZADO (obligatorio)') && ok;
    return ok;
  },

  async testInstalacionesTipo() {
    const M = 'CATÁLOGO DE TIPOS DE INSTALACIÓN (36 tipos ganaderos curados)';
    let ok = true;
    const tipos = await window.db.getAll('instalaciones_tipo').catch(() => []);
    ok = this._assert(tipos.length === 36, M, `instalaciones_tipo tiene 36 filas — encontradas: ${tipos.length}`) && ok;
    const naveGanadera = tipos.find((t) => t.nombre === 'Nave ganadera');
    ok = this._assert(!!naveGanadera && naveGanadera.codigo_siex === '28', M, `"Nave ganadera" existe con codigo_siex '28' — encontrado: ${naveGanadera?.codigo_siex}`) && ok;
    return ok;
  },

  async testInstalacionesFinca() {
    const M = 'INSTALACIONES DE FINCA (finca.instalaciones[])';
    let ok = true;
    const { finca } = await this._ensureDatosBase();

    const tipos = await window.db.getAll('instalaciones_tipo').catch(() => []);
    const tipoId = tipos[0]?.id;

    try {
      const fincaObj = await window.Fincas.get(finca.id);
      fincaObj.instalaciones = fincaObj.instalaciones || [];
      await window.Fincas.save({ ...fincaObj, instalaciones: [...fincaObj.instalaciones, { tipoId: null }] });
      ok = this._assert(false, M, 'instalación sin tipoId debería lanzar error') && ok;
    } catch (e) {
      ok = this._assert(true, M, 'instalación sin tipoId es RECHAZADA') && ok;
    }

    const fincaAntes = await window.Fincas.get(finca.id);
    const countAntes = (fincaAntes.instalaciones || []).length;
    await window.Fincas.save({ ...fincaAntes, instalaciones: [...(fincaAntes.instalaciones || []), { tipoId, superficie_m2: 100 }] });
    const fincaDespues = await window.Fincas.get(finca.id);
    this._createdIds.fincaInstalacionIdx = (fincaDespues.instalaciones || []).length - 1;
    ok = this._assert((fincaDespues.instalaciones || []).length === countAntes + 1, M, 'instalación válida se añade correctamente') && ok;
    const nueva = fincaDespues.instalaciones[fincaDespues.instalaciones.length - 1];
    ok = this._assert(typeof nueva.id === 'number' && nueva.id > 0, M, `instalación recibe id secuencial numérico — encontrado: ${nueva.id}`) && ok;
    return ok;
  },

  async testGeolocalizacionFinca() {
    const M = 'GEOLOCALIZACIÓN DE FINCA (latitud/longitud)';
    let ok = true;
    const { finca } = await this._ensureDatosBase();
    const fincaObj = await window.Fincas.get(finca.id);

    try {
      await window.Fincas.save({ ...fincaObj, latitud: 90 });
      ok = this._assert(false, M, 'latitud fuera de rango (90) debería lanzar error') && ok;
    } catch (e) {
      ok = this._assert(true, M, 'latitud fuera de rango (90) es RECHAZADA') && ok;
    }

    await window.Fincas.save({ ...fincaObj, latitud: 38.5, longitud: -6.2 });
    const fincaActualizada = await window.Fincas.get(finca.id);
    ok = this._assert(fincaActualizada.latitud === 38.5 && fincaActualizada.longitud === -6.2, M, `latitud/longitud válidas guardadas correctamente — encontrado: ${fincaActualizada.latitud}/${fincaActualizada.longitud}`) && ok;
    return ok;
  },

  async testRestriccionMovimientosSaneamiento() {
    const M = 'RESTRICCIÓN DE MOVIMIENTOS EN SANEAMIENTO (distinto de calificación)';
    let ok = true;
    const { finca } = await this._ensureDatosBase();

    await window.Saneamientos.save({
      fincaId: finca.id, campana: 'tuberculosis', fecha: new Date().toISOString().split('T')[0],
      num_examinados: 10, num_positivos: 1, calificacion: 'B3',
      restriccion_movimientos: true, motivo_restriccion: 'QA test'
    });
    const estado = await window.Saneamientos.restriccionActiva(finca.id);
    ok = this._assert(estado.activa === true && estado.motivo === 'QA test', M, `restriccionActiva() devuelve activa=true con motivo — encontrado: ${JSON.stringify(estado)}`) && ok;
    return ok;
  },

  async testVacunacionesModeloJerarquico() {
    const M = 'VACUNACIONES (modelo jerárquico ADSG)';
    let ok = true;
    const { rebano } = await this._ensureDatosBase();

    try {
      await window.Vacunaciones.save({ rebanoId: rebano.id, fecha: '2026-01-01', tipos_vacuna: [] });
      ok = this._assert(false, M, 'vacunación sin tipos_vacuna debería lanzar error') && ok;
    } catch (e) {
      ok = this._assert(true, M, 'vacunación sin tipos_vacuna es RECHAZADA') && ok;
    }

    const cincoTypes = [1, 2, 3, 4, 5].map((n) => ({ tipo: `Tipo${n}` }));
    const vacId = await window.Vacunaciones.save({
      rebanoId: rebano.id, fecha: '2026-01-01', veterinario: 'QA Vet',
      tipos_vacuna: cincoTypes,
      animales_vacunados: [{ categoria: 'QA', cantidad: 7 }],
    });
    this._createdIds.vacunaciones.push(vacId);
    const vac = await window.Vacunaciones.get(vacId);
    ok = this._assert(vac.tipos_vacuna.length === window.Vacunaciones.MAX_TIPOS_VACUNA, M, `5 tipos de vacuna se truncan a MAX_TIPOS_VACUNA (${window.Vacunaciones.MAX_TIPOS_VACUNA}) — encontrados: ${vac.tipos_vacuna.length}`) && ok;
    ok = this._assert(vac.animales_vacunados_total === 7, M, `animales_vacunados_total calculado correctamente — encontrado: ${vac.animales_vacunados_total}`) && ok;
    ok = this._assert(vac.cerrada === false, M, 'vacunación nueva no está cerrada') && ok;

    await window.Vacunaciones.save({ ...vac, id: vacId, observaciones: 'Editado antes de cerrar' });
    ok = this._assert(true, M, 'edición permitida antes de cerrar') && ok;

    await window.Vacunaciones.cerrar(vacId);
    const vacCerrada = await window.Vacunaciones.get(vacId);
    ok = this._assert(vacCerrada.cerrada === true, M, 'cerrar() marca cerrada=true') && ok;

    try {
      await window.Vacunaciones.save({ ...vacCerrada, id: vacId, observaciones: 'Intento tras cerrar' });
      ok = this._assert(false, M, 'edición tras cerrar debería lanzar error') && ok;
    } catch (e) {
      ok = this._assert(true, M, 'edición tras cerrar es BLOQUEADA') && ok;
    }

    try {
      await window.Vacunaciones.delete(vacId);
      ok = this._assert(false, M, 'borrado tras cerrar debería lanzar error') && ok;
    } catch (e) {
      ok = this._assert(true, M, 'borrado tras cerrar es BLOQUEADO') && ok;
    }

    await window.Vacunaciones.anular(vacId, 'QA cleanup');
    const vacAnulada = await window.Vacunaciones.get(vacId);
    ok = this._assert(vacAnulada.anulada === true, M, 'anular() funciona incluso sobre vacunación cerrada (trazable, no borra)') && ok;
    return ok;
  },

  async testCamposCapturaRfid() {
    const M = 'CAMPOS DE CAPTURA RFID (hora/lote/número de macho)';
    let ok = true;
    const { animal } = await this._ensureDatosBase();

    const eventoId = await window.Reproduccion.saveEvento({
      animalId: animal.id, tipo_evento: 'Monta Natural', fecha: '2026-01-01',
      hora: '08:30', lote: 'QA-LOTE', numero_macho: 'ES0812345678'
    });
    const evento = await window.Reproduccion.getEvento(eventoId);
    ok = this._assert(evento.hora === '08:30', M, `hora persistida — encontrado: ${evento.hora}`) && ok;
    ok = this._assert(evento.lote === 'QA-LOTE', M, `lote persistido — encontrado: ${evento.lote}`) && ok;
    ok = this._assert(evento.numero_macho === 'ES0812345678', M, `numero_macho persistido — encontrado: ${evento.numero_macho}`) && ok;
    await window.Reproduccion.deleteEvento(eventoId);
    return ok;
  },

  /** Borra los datos de prueba creados por esta suite (vacunaciones y la última instalación añadida). No borra finca/rebaño/animal si ya existían antes de la suite. */
  async cleanup() {
    console.log('🧹 Limpiando datos de prueba de PlanSigganQA...');
    for (const id of this._createdIds.vacunaciones) {
      try { await window.db.delete('vacunaciones', id); } catch (e) { /* ignore */ }
    }
    if (this._createdIds.fincaId != null && this._createdIds.fincaInstalacionIdx != null) {
      try {
        const finca = await window.Fincas.get(this._createdIds.fincaId);
        if (finca.instalaciones && finca.instalaciones.length > this._createdIds.fincaInstalacionIdx) {
          finca.instalaciones.splice(this._createdIds.fincaInstalacionIdx, 1);
          await window.db.put('fincas', finca);
        }
      } catch (e) { /* ignore */ }
    }
    console.log('✅ Limpieza completada.');
  },

  async runAll() {
    console.log('\n' + '='.repeat(75));
    console.log('🧪 PLAN MEJORA SIGGAN QA SUITE v1.0');
    console.log('📅 ' + new Date().toLocaleString());
    console.log('='.repeat(75) + '\n');

    if (!window.db) {
      console.error('❌ ERROR: window.db no disponible. Espera a que la app cargue.');
      return;
    }

    this._results = [];
    this._createdIds = { vacunaciones: [], fincaInstalacionIdx: null, animalId: null, rebanoId: null, fincaId: null };
    let passed = 0, failed = 0;
    const tests = [
      ['testCatalogoRazas', this.testCatalogoRazas],
      ['testEspeciesCorrespondenciaSiggan', this.testEspeciesCorrespondenciaSiggan],
      ['testValidacionEquino', this.testValidacionEquino],
      ['testInstalacionesTipo', this.testInstalacionesTipo],
      ['testInstalacionesFinca', this.testInstalacionesFinca],
      ['testGeolocalizacionFinca', this.testGeolocalizacionFinca],
      ['testRestriccionMovimientosSaneamiento', this.testRestriccionMovimientosSaneamiento],
      ['testVacunacionesModeloJerarquico', this.testVacunacionesModeloJerarquico],
      ['testCamposCapturaRfid', this.testCamposCapturaRfid],
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
    console.log('📊 REPORTE FINAL — PLAN MEJORA SIGGAN QA v1.0');
    console.log(`✅ Aserciones OK: ${this._results.filter(r => r.status === 'PASS').length}`);
    console.log(`❌ Aserciones con fallo: ${this._results.filter(r => r.status === 'FAIL').length}`);
    const failures = this._results.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      console.log('\n❌ DETALLE DE FALLOS:');
      failures.forEach(f => console.log(`  ❌ [${f.module}] ${f.detail}`));
    }
    console.log('\n💡 Ejecuta await PlanSigganQA.cleanup() para borrar los datos de prueba creados.');
    console.log('='.repeat(75) + '\n');

    return { passed, failed, total: tests.length, results: this._results };
  }
};

window.PlanSigganQA = PlanSigganQA;
console.log('✅ Plan Mejora SIGGAN QA Suite v1.0 cargado. Ejecuta: await PlanSigganQA.runAll()');
