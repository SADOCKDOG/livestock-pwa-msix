/**
 * Livestock Manager - ImportadorRFID QA Test Suite v1.0.0
 *
 * Pruebas de detección de tipo, mapeo de columnas y procesamiento de filas
 * del importador de Excel RFID/LiveStock (js/importador-rfid.js). No cubre
 * la lectura real del .xlsx (XLSX.read) — se prueba directamente contra
 * headers/filas ya parseados, que es donde vive la lógica de negocio.
 *
 * EJECUCIÓN: Pegar en la consola del navegador (DevTools) con la app abierta.
 * Uso: await ImportadorRFIDQA.runAll();
 */
const ImportadorRFIDQA = {
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

  // Genera un crotal que cumple la normativa (ES + 12 dígitos) — validateCaravana
  // rechaza cualquier otro formato (guiones, letras extra, etc.).
  _crotalValido() {
    const digitos = String(Date.now()).slice(-10) + String(Math.floor(Math.random() * 100)).padStart(2, '0');
    return 'ES' + digitos.slice(0, 12);
  },

  async _crearFincaRebanoAnimal() {
    const crotal = this._crotalValido();
    const fincaId = await window.db.add('fincas', { nombre: 'QA-RFID-FINCA', creadoEn: new Date().toISOString() });
    // Animales.list() (usado por ImportadorRFID para resolver crotales) itera
    // por Rebanos.list(), que depende de la finca activa — hay que activarla.
    await window.Fincas.setActiveId(fincaId);
    const rebanoId = await window.db.add('rebanos', { fincaId, nombre: 'QA-RFID-REBANO', especie: 'Bovino', creadoEn: new Date().toISOString() });
    const animalId = await window.Animales.save({ rebanoId, numero_identificacion: crotal, tipoAlta: 'Nacimiento' });
    return { fincaId, rebanoId, animalId, crotal };
  },

  testDeteccionTipoPeso() {
    const M = 'DETECCION TIPO — PESO';
    const headers = ['EIC', 'FECHA DE ALTA', 'PESO', 'OBSERVACIONES'].map((h) => window.ImportadorRFID._normHeader(h));
    const det = window.ImportadorRFID.detectarTipo(headers);
    this._assert(det.tipo === 'peso', M, `tipo detectado = peso — obtenido: ${det.tipo}`);
    this._assert(det.ambiguo === false, M, `ambiguo = false — obtenido: ${det.ambiguo}`);
  },

  testDeteccionTipoLeche() {
    const M = 'DETECCION TIPO — LECHE';
    const headers = ['EIC', 'FECHA', 'LITROS LECHE', 'OBSERVACIONES'].map((h) => window.ImportadorRFID._normHeader(h));
    const det = window.ImportadorRFID.detectarTipo(headers);
    this._assert(det.tipo === 'leche', M, `tipo detectado = leche — obtenido: ${det.tipo}`);
  },

  testDeteccionTipoLecheAMPM() {
    const M = 'DETECCION TIPO — LECHE AM/PM';
    const headers = ['CODSEMPD', 'FECPROD', 'AM', 'PM', 'NROCDRA'].map((h) => window.ImportadorRFID._normHeader(h));
    const det = window.ImportadorRFID.detectarTipo(headers);
    this._assert(det.tipo === 'leche', M, `tipo detectado = leche (PRDCCION.DAT) — obtenido: ${det.tipo}`);
  },

  testDeteccionAmbigua() {
    const M = 'DETECCION TIPO — AMBIGUA';
    const headers = ['EIC', 'FECHA'].map((h) => window.ImportadorRFID._normHeader(h));
    const det = window.ImportadorRFID.detectarTipo(headers);
    this._assert(det.ambiguo === true, M, `ambiguo = true sin columnas distintivas — obtenido: ${det.ambiguo}`);
  },

  async testProcesarFilaPeso() {
    const M = 'PROCESAR FILA — PESO';
    const { animalId, crotal } = await this._crearFincaRebanoAnimal();
    const headers = ['EIC', 'FECHA', 'PESO'].map((h) => window.ImportadorRFID._normHeader(h));
    const filas = [[crotal, '2026-01-15', 250.5]];
    const resultado = await window.ImportadorRFID.procesarImportacion('peso', headers, filas);
    this._assert(resultado.ok === 1, M, `1 fila importada — obtenido: ${resultado.ok}`);
    this._assert(resultado.errores.length === 0, M, `sin errores — obtenido: ${resultado.errores.length}`);

    // obtenerHistorial también incluye el evento "alta_nacimiento" que
    // Animales.save() escribe automáticamente — filtrar por motivo_tarea.
    const historial = await window.Pesajes.obtenerHistorial(animalId, 'animal');
    const pesadas = historial.filter((h) => h.motivo_tarea === 'control');
    this._assert(pesadas.length === 1 && pesadas[0].valor_neto === 250.5, M, `peso registrado en registro_eventos = 250.5 — obtenido: ${pesadas[0]?.valor_neto}`);
  },

  async testProcesarFilaLecheAMPM() {
    const M = 'PROCESAR FILA — LECHE AM/PM';
    const { fincaId, animalId, crotal } = await this._crearFincaRebanoAnimal();
    const headers = ['EIC', 'FECHA', 'AM', 'PM'].map((h) => window.ImportadorRFID._normHeader(h));
    const filas = [[crotal, '2026-01-15', 12, 10]];
    const resultado = await window.ImportadorRFID.procesarImportacion('leche', headers, filas);
    this._assert(resultado.ok === 1, M, `1 fila importada — obtenido: ${resultado.ok}`);

    const produccion = await window.Produccion.listLeche(fincaId);
    const delAnimal = produccion.filter((p) => p.vacaId === animalId);
    this._assert(delAnimal.length === 2, M, `2 registros (AM+PM) creados — obtenido: ${delAnimal.length}`);
    const totalLitros = delAnimal.reduce((s, p) => s + p.cantidad_litros, 0);
    this._assert(totalLitros === 22, M, `total litros = 22 (12+10) — obtenido: ${totalLitros}`);
  },

  async testProcesarFilaTratamiento() {
    const M = 'PROCESAR FILA — TRATAMIENTO';
    const { animalId, rebanoId, crotal } = await this._crearFincaRebanoAnimal();
    const headers = ['EIC', 'FECHA', 'TIPO_TRATAMIENTO', 'MEDICAMENTO'].map((h) => window.ImportadorRFID._normHeader(h));
    const filas = [[crotal, '2026-01-15', 'Antibiótico', 'Penicilina']];
    const resultado = await window.ImportadorRFID.procesarImportacion('tratamiento', headers, filas);
    this._assert(resultado.ok === 1, M, `1 fila importada — obtenido: ${resultado.ok}`);

    // sanitarios_ganado solo tiene índice por rebanoId, no por animalId.
    const delRebano = await window.Sanitarios.list(rebanoId).catch(() => []);
    const delAnimal = delRebano.filter((s) => s.animalId === animalId);
    this._assert(delAnimal.length === 1 && delAnimal[0].medicamento === 'Penicilina', M, `tratamiento registrado con medicamento Penicilina — obtenido: ${delAnimal[0]?.medicamento}`);
  },

  async testProcesarFilaAnimalNoEncontrado() {
    const M = 'PROCESAR FILA — ANIMAL NO ENCONTRADO';
    await this._crearFincaRebanoAnimal();
    const headers = ['EIC', 'FECHA', 'PESO'].map((h) => window.ImportadorRFID._normHeader(h));
    const filas = [['NO-EXISTE-CROTAL-XYZ', '2026-01-15', 100]];
    const resultado = await window.ImportadorRFID.procesarImportacion('peso', headers, filas);
    this._assert(resultado.ok === 0, M, `0 filas importadas — obtenido: ${resultado.ok}`);
    this._assert(resultado.errores.length === 1 && /no encontrado/i.test(resultado.errores[0].mensaje), M, `error "animal no encontrado" — obtenido: ${resultado.errores[0]?.mensaje}`);
  },

  async runAll() {
    this._results = [];
    console.log('=== ImportadorRFID QA Suite ===');
    this.testDeteccionTipoPeso();
    this.testDeteccionTipoLeche();
    this.testDeteccionTipoLecheAMPM();
    this.testDeteccionAmbigua();
    await this.testProcesarFilaPeso();
    await this.testProcesarFilaLecheAMPM();
    await this.testProcesarFilaTratamiento();
    await this.testProcesarFilaAnimalNoEncontrado();
    const fails = this._results.filter((r) => r.status === 'FAIL').length;
    console.log(`=== ${this._results.length - fails}/${this._results.length} PASS ===`);
    return this._results;
  },
};

window.ImportadorRFIDQA = ImportadorRFIDQA;
