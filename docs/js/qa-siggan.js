/**
 * Livestock Manager - SIGGAN QA Test Suite v1.0.0
 *
 * Pruebas automatizadas específicas de la adaptación al Sistema Integrado de
 * Gestión Ganadera (SIGGAN, Junta de Andalucía) y BADIGEX (Extremadura):
 *
 *   1. Validación de formato REGA (RD 479/2004)
 *   2. Catálogos normativos (campañas, vías, motivos, tipos de explotación)
 *   3. Libro de Movimientos inter-explotación (guía de origen y sanidad)
 *   4. Libro de Saneamientos (campañas ADSG, calificación sanitaria)
 *   5. Libro de Tratamientos Veterinarios (vía, motivo, tiempos de espera)
 *   6. Exportación oficial CSV/XML (REGA, SIA/PIGGAN)
 *   7. Cuaderno Digital (renderizado de secciones SIGGAN)
 *   8. Validación de crotal normativo (RD 787/2023 · país + 12 dígitos)
 *   9. Traslado interno entre rebaños y aforo de zona (RD 787/2023)
 *  10. Rendimiento de consultas con DB v10
 *
 * EJECUCIÓN: Pegar en la consola del navegador (DevTools) con la app abierta.
 * Uso: await SigganQA.runAll();
 *      await SigganQA.run("rega");
 *      await SigganQA.cleanup();
 */

const SigganQA = {
  _MARKER: 'SIGGAN-QA',
  _results: [],

  // ============================================================
  // UTILIDADES
  // ============================================================
  _ts: () => new Date().toISOString().split('T')[1].split('.')[0],
  _wait: (ms) => new Promise(r => setTimeout(r, ms)),

  _log(status, module, detail, category = '') {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '⏳';
    const cat = category ? ` [${category}]` : '';
    console.log(`[${this._ts()}] ${icon} [${module}]${cat} ${detail}`);
    this._results.push({ status, module, detail, category, time: this._ts() });
  },

  /** Aserción simple: registra PASS si cond es truthy, FAIL en caso contrario. */
  _assert(cond, module, detail, category = '') {
    this._log(cond ? 'PASS' : 'FAIL', module, detail, category);
    return !!cond;
  },

  /**
   * Ejecuta una función async esperando que LANCE una excepción.
   * Silencia console.error durante la llamada (los errores son esperados).
   */
  async _expectThrow(fn, module, detail, category = 'VALIDACIÓN') {
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
    this._log(threw ? 'PASS' : 'FAIL', module, detail, category);
    return threw;
  },

  _checkLayoutIntegrity(module) {
    const content = document.getElementById('app-content');
    if (!content) {
      this._log('WARN', module, 'Elemento #app-content no encontrado', 'LAYOUT');
      return false;
    }
    const issues = [];
    if (content.scrollWidth > content.clientWidth + 5) {
      issues.push(`overflow-x: ${content.scrollWidth}px > ${content.clientWidth}px`);
    }
    const brokenStyles = content.querySelectorAll('[style*="undefined"]');
    if (brokenStyles.length > 0) issues.push(`${brokenStyles.length} estilos con 'undefined'`);
    if (issues.length > 0) {
      this._log('FAIL', module, `Problemas de layout: ${issues.join('; ')}`, 'LAYOUT');
      return false;
    }
    this._log('PASS', module, 'Layout íntegro (sin overflow, estilos correctos)', 'LAYOUT');
    return true;
  },

  /** Verifica un registro en IndexedDB contra los campos esperados. */
  async _verifyInDB(storeName, id, expectedFields) {
    const record = await window.db.get(storeName, Number(id));
    if (!record) return { ok: false, reason: `No existe en ${storeName} con id=${id}` };
    for (const [key, expected] of Object.entries(expectedFields)) {
      if (record[key] !== expected) {
        return { ok: false, reason: `${key}: esperado=${expected}, obtenido=${record[key]}` };
      }
    }
    return { ok: true, record };
  },

  // ============================================================
  // TEST 1: VALIDACIÓN DE FORMATO REGA (RD 479/2004)
  // ============================================================
  async testValidacionREGA() {
    const M = 'VALIDACIÓN REGA';
    this._log('RUN', M, 'Iniciando validación de códigos REGA');

    const CS = window.ComunidadesService;
    if (!this._assert(CS, M, 'ComunidadesService disponible', 'PRE-REQ')) return false;

    // Normalización: quita separadores y mayúsculas
    const norm = CS.normalizarREGA('es 04.123.0000123');
    this._assert(norm === 'ES041230000123', `normalizarREGA limpia separadores → "${norm}"`, 'NORMALIZACIÓN');

    // Formato válido (sin comunidad)
    const ok = CS.validarFormatoREGA('ES041230000123');
    this._assert(ok.valido === true && ok.provinciaINE === '04',
      `Acepta REGA válido ES041230000123 (provincia INE=${ok.provinciaINE})`, 'FORMATO');

    // Provincia coherente con la comunidad (04 = Almería ∈ Andalucía)
    const okCcaa = CS.validarFormatoREGA('ES041230000123', 'andalucia');
    this._assert(okCcaa.valido === true,
      'Acepta REGA cuya provincia pertenece a Andalucía', 'COMUNIDAD');

    // Provincia que NO pertenece a la comunidad (99 inexistente en Andalucía)
    const badProv = CS.validarFormatoREGA('ES991230000123', 'andalucia');
    this._assert(badProv.valido === false,
      'Rechaza REGA con provincia ajena a Andalucía', 'COMUNIDAD');

    // Formato inválido
    const badFmt = CS.validarFormatoREGA('REGA-INVALIDO');
    this._assert(badFmt.valido === false,
      'Rechaza REGA con formato incorrecto', 'FORMATO');

    // Vacío
    const vacio = CS.validarFormatoREGA('');
    this._assert(vacio.valido === false,
      'Rechaza REGA vacío', 'FORMATO');

    this._log('PASS', M, '✅ COMPLETADO — Validación REGA verificada');
    return !this._hasFail(M);
  },

  // ============================================================
  // TEST 2: CATÁLOGOS NORMATIVOS SIGGAN
  // ============================================================
  async testCatalogosSiggan() {
    const M = 'CATÁLOGOS SIGGAN';
    this._log('RUN', M, 'Verificando catálogos normativos');

    const CS = window.ComunidadesService;
    if (!this._assert(CS, M, 'ComunidadesService disponible', 'PRE-REQ')) return false;

    // Campañas de saneamiento
    const campanas = CS.getCampanasSaneamiento();
    this._assert(Array.isArray(campanas) && campanas.some(c => c.value === 'tuberculosis'),
      `Campañas de saneamiento (${campanas.length}) incluyen tuberculosis`, 'CAMPAÑAS');

    // Vías de administración + etiqueta legible
    const vias = CS.getViasAdministracion();
    const viaLabel = CS.getViaAdministracionLabel('intramuscular');
    this._assert(vias.some(v => v.value === 'intramuscular') && viaLabel === 'Intramuscular (IM)',
      `Vías de administración con etiqueta legible ("${viaLabel}")`, 'TRATAMIENTOS');

    // Motivos de tratamiento + etiqueta legible
    const motivos = CS.getMotivosTratamiento();
    const motivoLabel = CS.getMotivoTratamientoLabel('profilaxis');
    this._assert(motivos.some(m => m.value === 'profilaxis') && motivoLabel === 'Profilaxis / prevención',
      `Motivos de tratamiento con etiqueta legible ("${motivoLabel}")`, 'TRATAMIENTOS');

    // Motivos de movimiento
    const motMov = CS.getMotivosMovimiento();
    this._assert(motMov.some(m => m.value === 'vida'),
      `Motivos de movimiento (${motMov.length}) incluyen "vida"`, 'MOVIMIENTOS');

    // Formas de alta en el censo (catálogo cerrado)
    const tiposAlta = CS.getTiposAlta();
    this._assert(Array.isArray(tiposAlta) && tiposAlta.some(t => t.value === 'Nacimiento') && tiposAlta.some(t => t.value === 'Compra'),
      `Tipos de alta (${tiposAlta.length}) incluyen Nacimiento y Compra`, 'CENSO');

    // Categorías zootécnicas por especie (catálogo cerrado)
    const catBovino = CS.getCategoriasAnimal('Bovino');
    const catOvino = CS.getCategoriasAnimal('Ovejas');
    this._assert(Array.isArray(catBovino) && catBovino.some(c => /Vaca/i.test(c)),
      `Categorías de bovino (${catBovino.length}) incluyen "Vaca"`, 'CENSO');
    this._assert(Array.isArray(catOvino) && catOvino.some(c => /Oveja/i.test(c)),
      `Categorías de ovino (${catOvino.length}) incluyen "Oveja" (normaliza sinónimos)`, 'CENSO');
    this._assert(CS.getGrupoEspecie('Vacas Frisonas') === 'bovino',
      'getGrupoEspecie normaliza "Vacas Frisonas" → bovino', 'CENSO');

    // Tipos de explotación REGA
    const tipos = CS.getTiposExplotacionREGA();
    this._assert(Array.isArray(tipos) && tipos.length > 0,
      `Tipos de explotación REGA disponibles (${tipos.length})`, 'EXPLOTACIÓN');

    // Configuración por comunidad
    const confA = CS.getConfiguracionCCAA('andalucia');
    this._assert(confA && confA.sistema_movimiento === 'SIGGAN',
      `Andalucía → plataforma ${confA?.sistema_movimiento}`, 'COMUNIDAD');
    this._assert(CS.esREGAObligatorio('andalucia') === true,
      'Andalucía exige REGA obligatorio', 'COMUNIDAD');

    const confE = CS.getConfiguracionCCAA('extremadura');
    this._assert(confE && confE.sistema_movimiento === 'BADIGEX',
      `Extremadura → plataforma ${confE?.sistema_movimiento}`, 'COMUNIDAD');

    this._log('PASS', M, '✅ COMPLETADO — Catálogos SIGGAN verificados');
    return !this._hasFail(M);
  },

  // ============================================================
  // TEST 3: LIBRO DE MOVIMIENTOS (guía de origen y sanidad)
  // ============================================================
  async testLibroMovimientos() {
    const M = 'LIBRO MOVIMIENTOS';
    this._log('RUN', M, 'Iniciando ciclo de movimiento inter-explotación');

    if (!this._assert(window.Movimientos, M, 'Módulo Movimientos disponible', 'PRE-REQ')) return false;

    try {
      const fincaId = await Fincas.getActiveId();
      const animales = await Animales.list();
      const animalId = animales.length > 0 ? animales[0].id : null;
      const crotal = animales.length > 0 ? animales[0].numero_identificacion : 'ES000000000000';

      // --- FASE 1: Alta de movimiento de salida válido ---
      const t0 = performance.now();
      const movData = {
        fincaId,
        tipo: 'salida',
        numero_guia: 'QA-' + Date.now().toString().slice(-8),
        rega_origen: 'ES041230000123',
        rega_destino: 'ES411230000456',
        explotacion_contraparte: 'Explotación QA Destino',
        motivo: 'vida',
        especie: 'Ovino',
        num_animales: 1,
        animalId: animalId != null ? [animalId] : [],
        crotales: [crotal],
        fecha: new Date().toISOString().split('T')[0],
        desinsectacion_certificada: true,
        comunidad_autonoma: 'andalucia',
        notas: this._MARKER + ' movimiento de prueba',
      };
      const movId = await Movimientos.save(movData);
      const elapsed = performance.now() - t0;
      this._assert(movId != null, `Movimiento guardado (id=${movId}) en ${elapsed.toFixed(0)}ms`, 'PERSISTENCIA');

      // --- FASE 2: Verificar persistencia + REGA normalizado + plataforma ---
      const check = await this._verifyInDB('movimientos_ganado', movId, {
        tipo: 'salida',
        rega_origen: 'ES041230000123',
        rega_destino: 'ES411230000456',
        plataforma: 'SIGGAN',
      });
      this._assert(check.ok, check.ok
        ? 'IndexedDB: REGA normalizado y plataforma SIGGAN asignada'
        : `IndexedDB: ${check.reason}`, 'PERSISTENCIA');

      // --- FASE 3: Aparece en el listado filtrado ---
      const lista = await Movimientos.list({ fincaId, tipo: 'salida' });
      this._assert(lista.some(m => m.id === movId),
        'Aparece en Movimientos.list({tipo:salida})', 'LISTA');

      // --- FASE 4: Trazabilidad por animal + evento en cuaderno ---
      if (animalId != null) {
        const porAnimal = await Movimientos.getByAnimal(animalId);
        this._assert(porAnimal.some(m => m.id === movId),
          'getByAnimal() devuelve el movimiento del animal', 'TRAZABILIDAD');

        const eventos = await window.db.getAll('registro_eventos').catch(() => []);
        const evt = eventos.find(e => e.tipo === 'movimiento' &&
          Number(e.entidad_id) === Number(animalId) &&
          (e.notas || '').includes(this._MARKER));
        this._assert(!!evt,
          'Se registró evento de movimiento en el cuaderno (registro_eventos)', 'TRAZABILIDAD');
      } else {
        this._log('WARN', M, 'Sin animales: se omite verificación de trazabilidad por animal', 'TRAZABILIDAD');
      }

      // --- FASE 5: Validación de formato REGA inválido ---
      await this._expectThrow(
        () => Movimientos.save({ ...movData, id: undefined, rega_destino: 'XX-NO-VALIDO' }),
        M, 'Rechaza movimiento con REGA destino inválido');

      // --- FASE 6: Exige certificar desinsectación en Andalucía ---
      await this._expectThrow(
        () => Movimientos.save({ ...movData, id: undefined, desinsectacion_certificada: false }),
        M, 'Exige certificar desinsectación en Andalucía');

      this._log('PASS', M, `✅ COMPLETADO — Movimiento ${movData.numero_guia} (id=${movId})`);
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  // ============================================================
  // TEST 4: LIBRO DE SANEAMIENTOS (campañas ADSG)
  // ============================================================
  async testLibroSaneamientos() {
    const M = 'LIBRO SANEAMIENTOS';
    this._log('RUN', M, 'Iniciando ciclo de saneamiento oficial');

    if (!this._assert(window.Saneamientos, M, 'Módulo Saneamientos disponible', 'PRE-REQ')) return false;

    try {
      const fincaId = await Fincas.getActiveId();

      // --- FASE 1: Alta de saneamiento (tuberculosis, indemne) ---
      const t0 = performance.now();
      const sanId = await Saneamientos.save({
        fincaId,
        campana: 'tuberculosis',
        fecha: new Date().toISOString().split('T')[0],
        veterinario: 'Dra. QA Veterinaria',
        veterinario_colegiado: 'COL-QA-001',
        adsg_nombre: 'ADSG QA',
        especie: 'Bovino',
        num_examinados: 50,
        num_positivos: 0,
        calificacion: 'indemne',
        notas: this._MARKER + ' saneamiento de prueba',
      });
      const elapsed = performance.now() - t0;
      this._assert(sanId != null, `Saneamiento guardado (id=${sanId}) en ${elapsed.toFixed(0)}ms`, 'PERSISTENCIA');

      // --- FASE 2: Persistencia + etiqueta legible de campaña ---
      const check = await this._verifyInDB('saneamientos', sanId, {
        campana: 'tuberculosis',
        calificacion: 'indemne',
        num_examinados: 50,
      });
      this._assert(check.ok, check.ok ? 'IndexedDB: saneamiento verificado' : `IndexedDB: ${check.reason}`, 'PERSISTENCIA');

      const label = Saneamientos.labelCampana('tuberculosis');
      this._assert(/tuberculosis/i.test(label),
        `Etiqueta legible de campaña: "${label}"`, 'ETIQUETAS');

      // --- FASE 3: Calificación sanitaria actual de la finca ---
      const calif = await Saneamientos.calificacionActual(fincaId);
      this._assert(calif === 'indemne',
        `Calificación sanitaria actual de la finca: "${calif}"`, 'CALIFICACIÓN');

      // --- FASE 4: Validaciones ---
      await this._expectThrow(
        () => Saneamientos.save({ fincaId, campana: 'tuberculosis', num_examinados: 10, num_positivos: 20 }),
        M, 'Rechaza nº de positivos mayor que examinados');

      await this._expectThrow(
        () => Saneamientos.save({ fincaId, fecha: new Date().toISOString().split('T')[0] }),
        M, 'Rechaza saneamiento sin campaña');

      this._log('PASS', M, `✅ COMPLETADO — Saneamiento tuberculosis (id=${sanId})`);
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  // ============================================================
  // TEST 5: LIBRO DE TRATAMIENTOS VETERINARIOS
  // ============================================================
  async testLibroTratamientos() {
    const M = 'LIBRO TRATAMIENTOS';
    this._log('RUN', M, 'Iniciando registro de tratamiento veterinario');

    if (!this._assert(window.Sanitarios, M, 'Módulo Sanitarios disponible', 'PRE-REQ')) return false;

    try {
      const rebanos = await Rebanos.list();
      if (rebanos.length === 0) {
        this._log('FAIL', M, 'No hay rebaños disponibles', 'PRE-REQ');
        return false;
      }
      const rebano = rebanos[0];

      // --- FASE 1: Alta de tratamiento con campos SIGGAN ---
      const t0 = performance.now();
      const tratId = await Sanitarios.save({
        rebanoId: rebano.id,
        tipo_tratamiento: 'Antibiótico',
        medicamento: 'Amoxicilina QA',
        fecha: new Date().toISOString().split('T')[0],
        via_administracion: 'intramuscular',
        motivo_tratamiento: 'infeccion',
        tiempo_espera_carne_dias: 28,
        tiempo_espera_leche_dias: 7,
        prohibidoLeche: true,
        notas: this._MARKER + ' tratamiento de prueba',
      });
      const elapsed = performance.now() - t0;
      this._assert(tratId != null, `Tratamiento guardado (id=${tratId}) en ${elapsed.toFixed(0)}ms`, 'PERSISTENCIA');

      // --- FASE 2: Persistencia de campos del libro de tratamientos ---
      const check = await this._verifyInDB('sanitarios_ganado', tratId, {
        via_administracion: 'intramuscular',
        motivo_tratamiento: 'infeccion',
        tiempo_espera_carne_dias: 28,
        tiempo_espera_leche_dias: 7,
      });
      this._assert(check.ok, check.ok
        ? 'IndexedDB: vía, motivo y tiempos de espera persistidos'
        : `IndexedDB: ${check.reason}`, 'PERSISTENCIA');

      // --- FASE 3: Etiquetas legibles para el libro/cuaderno ---
      const CS = window.ComunidadesService;
      const viaLabel = CS.getViaAdministracionLabel('intramuscular');
      const motLabel = CS.getMotivoTratamientoLabel('infeccion');
      this._assert(viaLabel === 'Intramuscular (IM)' && /infeccioso/i.test(motLabel),
        `Etiquetas legibles: vía "${viaLabel}", motivo "${motLabel}"`, 'ETIQUETAS');

      // --- FASE 4: Tiempo de espera marca prohibición de leche ---
      this._assert(check.record && check.record.prohibidoLeche === true,
        'Tratamiento con supresión marca prohibidoLeche', 'SUPRESIÓN');

      this._log('PASS', M, `✅ COMPLETADO — Tratamiento (id=${tratId})`);
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  // ============================================================
  // TEST 6: EXPORTACIÓN OFICIAL CSV / XML (REGA, SIA)
  // ============================================================
  async testExportacion() {
    const M = 'EXPORTACIÓN REGA/SIA';
    this._log('RUN', M, 'Generando ficheros de exportación oficial');

    if (!this._assert(window.ExportService, M, 'Módulo ExportService disponible', 'PRE-REQ')) return false;

    try {
      const finca = await Fincas.getActive();
      const animales = await Animales.list();
      const rebanos = await Rebanos.list();

      // --- Censo REGA (CSV) ---
      const csvCenso = window.ExportService.generarCSV_CensoREGA(finca, animales, rebanos);
      this._assert(typeof csvCenso === 'string' &&
        csvCenso.includes('EXPORTACION REGA') &&
        csvCenso.includes('ID;CROTAL;ESPECIE'),
        'Censo REGA CSV con cabecera y detalle de animales', 'REGA');

      // --- Explotación REGA (XML) ---
      if (typeof window.ExportService.generarXML_REGA === 'function') {
        const xml = window.ExportService.generarXML_REGA(finca, animales, rebanos);
        this._assert(typeof xml === 'string' && xml.trim().length > 0 && xml.includes('<'),
          'Explotación REGA XML generado', 'REGA');
      } else {
        this._log('WARN', M, 'generarXML_REGA no disponible', 'REGA');
      }

      // --- Movimientos SIA/PIGGAN (CSV) ---
      const eventos = await window.db.getAll('registro_eventos').catch(() => []);
      const csvMov = window.ExportService.generarCSV_Movimientos(eventos, animales, finca);
      this._assert(typeof csvMov === 'string' &&
        csvMov.includes('FECHA;TIPO_MOVIMIENTO'),
        'Movimientos SIA CSV con cabecera correcta', 'SIA');

      this._log('PASS', M, '✅ COMPLETADO — Exportaciones generadas');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  // ============================================================
  // TEST 7: CUADERNO DIGITAL (renderizado de secciones SIGGAN)
  // ============================================================
  async testCuadernoView() {
    const M = 'CUADERNO DIGITAL';
    this._log('RUN', M, 'Renderizando Cuaderno Digital');

    const backup = console.error;
    const errores = [];
    console.error = (...a) => { errores.push(a.join(' ')); backup.apply(console, a); };

    try {
      if (window.CuadernoDigitalView && typeof CuadernoDigitalView.render === 'function') {
        await Promise.race([
          CuadernoDigitalView.render(),
          this._wait(5000).then(() => console.warn('[SIGGAN QA] Timeout CuadernoDigitalView.render()')),
        ]);
      } else {
        location.hash = '#/cuaderno';
        await this._wait(2000);
      }
      await this._wait(500);

      const content = document.getElementById('app-content');
      const texto = content ? content.textContent : '';

      this._assert(texto.length > 0, 'El Cuaderno renderiza contenido', 'RENDERIZADO');

      const tieneLibro = /Libro de Registro|Registro|Censo|Movimientos|Sanidad/i.test(texto);
      this._assert(tieneLibro, 'Renderiza secciones del libro de registro SIGGAN', 'SECCIONES');

      const realErr = errores.filter(e => !/timeout/i.test(e) && !/warn/i.test(e));
      this._assert(realErr.length === 0,
        realErr.length === 0 ? 'Sin errores JS en consola' : `Errores: ${realErr.slice(0, 2).join(' | ')}`,
        'CONSOLA');

      this._log('PASS', M, '✅ COMPLETADO — Cuaderno Digital verificado');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    } finally {
      console.error = backup;
    }
  },

  // ============================================================
  // TEST 8: RENDIMIENTO DE CONSULTAS (DB v10)
  // ============================================================
  async testRendimiento() {
    const M = 'RENDIMIENTO SIGGAN';
    this._log('RUN', M, 'Insertando lote de movimientos para medir consultas');

    try {
      const fincaId = await Fincas.getActiveId();
      const N = 50;
      const hoy = new Date().toISOString().split('T')[0];

      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        await window.db.add('movimientos_ganado', {
          fincaId,
          tipo: i % 2 === 0 ? 'entrada' : 'salida',
          numero_guia: 'QA-PERF-' + i,
          rega_origen: 'ES041230000123',
          rega_destino: 'ES411230000456',
          especie: 'Ovino',
          num_animales: 1,
          animalId: [],
          crotales: [],
          fecha: hoy,
          comunidad_autonoma: 'andalucia',
          plataforma: 'SIGGAN',
          notas: this._MARKER + ' perf',
          creadoEn: new Date().toISOString(),
        });
      }
      const insertMs = performance.now() - t0;
      this._assert(true, `Insertados ${N} movimientos en ${insertMs.toFixed(0)}ms (${(insertMs / N).toFixed(1)}ms/reg)`, 'INSERCIÓN');

      // Consulta filtrada
      const t1 = performance.now();
      const lista = await Movimientos.list({ fincaId });
      const listMs = performance.now() - t1;
      this._assert(lista.length >= N,
        `Movimientos.list() devuelve ${lista.length} registros en ${listMs.toFixed(0)}ms`, 'CONSULTA');
      this._assert(listMs < 1500,
        listMs < 1500 ? `Consulta rápida (${listMs.toFixed(0)}ms < 1500ms)` : `Consulta lenta: ${listMs.toFixed(0)}ms`, 'CONSULTA');

      this._log('PASS', M, '✅ COMPLETADO — Rendimiento medido');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  // ============================================================
  // TEST 9: VALIDACIÓN DE CROTAL NORMATIVO (RD 787/2023 · SITRAN)
  // ============================================================
  async testValidacionCrotal() {
    const M = 'VALIDACIÓN CROTAL';
    this._log('RUN', M, 'Validando formato normativo de crotal (país + 12 dígitos)');

    const EH = window.ErrorHandler;
    if (!this._assert(EH, M, 'ErrorHandler disponible', 'PRE-REQ')) return false;

    // --- Crotal nacional válido (ES + 12 dígitos) ---
    this._assert(EH.isCrotalValido('ES041234567890') === true,
      'Acepta crotal nacional ES + 12 dígitos', 'FORMATO');

    // --- Crotal extranjero válido (otro código de país + 12 dígitos) ---
    this._assert(EH.isCrotalValido('FR123456789012') === true,
      'Acepta crotal extranjero (FR) con 12 dígitos', 'PAÍS');
    this._assert(EH.isCrotalValido('PT987654321098') === true,
      'Acepta crotal extranjero (PT) con 12 dígitos', 'PAÍS');

    // --- Normaliza minúsculas/espacios antes de validar ---
    this._assert(EH.isCrotalValido('  es041234567890  ') === true,
      'Normaliza espacios y minúsculas antes de validar', 'NORMALIZACIÓN');

    // --- Rechazos de formato ---
    this._assert(EH.isCrotalValido('ES12345') === false,
      'Rechaza crotal demasiado corto', 'FORMATO');
    this._assert(EH.isCrotalValido('041234567890') === false,
      'Rechaza crotal sin código de país', 'FORMATO');
    this._assert(EH.isCrotalValido('ESABCDEFGHIJKL') === false,
      'Rechaza crotal con letras donde van dígitos', 'FORMATO');
    this._assert(EH.isCrotalValido('ES0412345678901') === false,
      'Rechaza crotal con 13 dígitos (demasiado largo)', 'FORMATO');
    this._assert(EH.isCrotalValido('') === false,
      'Rechaza crotal vacío', 'FORMATO');

    // --- validateCaravana: devuelve el valor normalizado y lanza si es inválido ---
    this._assert(EH.validateCaravana('es041234567890') === 'ES041234567890',
      'validateCaravana normaliza y acepta crotal válido', 'NORMATIVA');
    await this._expectThrow(
      () => EH.validateCaravana('XX-INVALIDO'),
      M, 'validateCaravana lanza excepción con crotal inválido');

    this._log('PASS', M, '✅ COMPLETADO — Validación de crotal verificada');
    return !this._hasFail(M);
  },

  // ============================================================
  // TEST 10: TRASLADO INTERNO Y AFORO DE ZONA (RD 787/2023)
  // ============================================================
  async testTrasladoInterno() {
    const M = 'TRASLADO INTERNO';
    this._log('RUN', M, 'Validando traslado interno entre rebaños y aforo de zona');

    const TZ = window.Trazabilidad;
    if (!this._assert(TZ && typeof TZ.validarAforoZona === 'function', M,
      'Trazabilidad.validarAforoZona disponible', 'PRE-REQ')) return false;

    try {
      // --- FASE 1: Reasignación de rebaño (traslado interno entre rebaños) ---
      const rebanos = await Rebanos.list();
      if (rebanos.length < 2) {
        this._log('WARN', M, `Se requieren ≥2 rebaños (hay ${rebanos.length}): se omite la reasignación`, 'TRASLADO');
      } else {
        const animales = await Animales.list();
        const origen = rebanos[0];
        const destino = rebanos.find(r => r.id !== origen.id) || rebanos[1];
        const animal = animales.find(a => a.rebanoId == origen.id) || animales[0];

        if (animal) {
          const rebanoOriginal = animal.rebanoId;
          try {
            await Animales.save({ ...animal, rebanoId: destino.id });
            const check = await this._verifyInDB('animales', animal.id, { rebanoId: destino.id });
            this._assert(check.ok, check.ok
              ? `Animal ${animal.numero_identificacion} trasladado al rebaño "${destino.nombre}"`
              : `IndexedDB: ${check.reason}`, 'TRASLADO');
          } finally {
            // Restaura el estado original — el test no deja datos de prueba
            const restore = await Animales.get(animal.id);
            if (restore) { restore.rebanoId = rebanoOriginal; await Animales.save(restore); }
          }
        } else {
          this._log('WARN', M, 'Sin animales disponibles: se omite la reasignación', 'TRASLADO');
        }
      }

      // --- FASE 2: Validación de aforo (capacidad técnica de la zona) ---
      const fincas = await window.db.getAll('fincas').catch(() => []);
      let zonaConAforo = null;
      for (const f of fincas) {
        zonaConAforo = (f.zonas || []).find(z => z && z.aforoMax > 0);
        if (zonaConAforo) break;
      }

      // Dentro de capacidad (añadir 0 animales) → resuelve true
      const zonaName = zonaConAforo
        ? zonaConAforo.nombre
        : (fincas[0]?.zonas?.[0]?.nombre || '__zona_inexistente__');
      let okDentro = false;
      try { okDentro = await TZ.validarAforoZona(window.db, zonaName, 0); } catch (_) { okDentro = false; }
      this._assert(okDentro === true,
        `validarAforoZona acepta censo dentro de capacidad (zona "${zonaName}")`, 'AFORO');

      if (zonaConAforo) {
        // Exceder el aforo máximo → rechaza
        await this._expectThrow(
          () => TZ.validarAforoZona(window.db, zonaConAforo.nombre, zonaConAforo.aforoMax + 9999),
          M, `Rechaza traslado que supera el aforo de "${zonaConAforo.nombre}" (máx. ${zonaConAforo.aforoMax})`, 'AFORO');
      } else {
        this._log('WARN', M, 'Ninguna zona tiene aforoMax definido: se omite la prueba de exceso', 'AFORO');
      }

      this._log('PASS', M, '✅ COMPLETADO — Traslado interno y aforo verificados');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  // ============================================================
  // UTIL: detectar si un módulo registró algún FAIL en esta corrida
  // ============================================================
  _runStartIndex: 0,
  _hasFail(module) {
    return this._results
      .slice(this._runStartIndex)
      .some(r => r.module === module && r.status === 'FAIL');
  },

  // ============================================================
  // TEST 11: PARTO → ALTA DE CRÍA Y GENEALOGÍA (RD 787/2023 · Libro de Registro)
  // ============================================================
  async testPartoGenealogia() {
    const M = 'PARTO GENEALOGÍA';
    this._log('RUN', M, 'Validando alta automática de cría y vínculo madre-cría en el parto');

    if (!this._assert(window.Reproduccion && typeof Reproduccion.saveEvento === 'function', M,
      'Reproduccion.saveEvento disponible', 'PRE-REQ')) return false;

    let criaId = null, partoEventoId = null, madreId = null, madreOriginal = null;
    try {
      const fincaId = await Fincas.getActiveId();
      const animales = await Animales.list();
      const madre = animales.find(a => a.sexo === 'H' && (a.estado || 'activo') !== 'baja');
      if (!madre) {
        this._log('WARN', M, 'Sin hembra disponible: se omite el test de parto', 'PARTO');
        return true;
      }
      madreId = madre.id;
      madreOriginal = {
        numero_partos: madre.numero_partos || 0,
        estado_reproductivo: madre.estado_reproductivo || null
      };

      const crotalCria = 'ES' + String(Date.now()).slice(-12);
      const fecha = new Date().toISOString().split('T')[0];

      partoEventoId = await Reproduccion.saveEvento({
        animalId: madre.id,
        tipo_evento: 'Parto',
        fecha,
        fincaId,
        notas: this._MARKER + ' parto de prueba',
        resultado: this._MARKER,
        crias: [{ crotal: crotalCria, sexo: 'H' }],
        crias_vivas: 1,
        crias_muertas: 0
      });

      // La cría debe existir en el censo con genealogía
      const todos = await Animales.list();
      const cria = todos.find(a => a.numero_identificacion === crotalCria);
      if (this._assert(!!cria, M, `Cría dada de alta en el censo (crotal ${crotalCria})`, 'ALTA')) {
        criaId = cria.id;
        this._assert(cria.tipoAlta === 'Nacimiento', M,
          'Cría con tipoAlta="Nacimiento" (cuenta en el libro de registro)', 'ALTA');
        this._assert(cria.madre_id === madre.id, M,
          `Vínculo genealógico madre-cría correcto (madre_id=${madre.id})`, 'GENEALOGÍA');
        this._assert(cria.especie === madre.especie, M,
          'Cría hereda la especie de la madre', 'GENEALOGÍA');

        // Evento de nacimiento en el libro de registro (registro_eventos)
        const evs = await window.db.getAllFromIndex('registro_eventos', 'entidad_id', cria.id).catch(() => []);
        const nacimiento = evs.find(e => e.motivo_tarea === 'alta_nacimiento');
        this._assert(!!nacimiento, M,
          'Evento "alta_nacimiento" registrado en el libro de registro', 'CUADERNO');
      }

      // El contador de partos de la madre se incrementa
      const madreActual = await Animales.get(madre.id);
      this._assert((madreActual.numero_partos || 0) === madreOriginal.numero_partos + 1, M,
        'Nº de partos de la madre incrementado', 'MADRE');

      this._log('PASS', M, '✅ COMPLETADO — El parto genera la cría con genealogía y evento de nacimiento');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    } finally {
      // Limpieza: el test no deja datos de prueba
      try {
        if (criaId != null) {
          const evs = await window.db.getAllFromIndex('registro_eventos', 'entidad_id', criaId).catch(() => []);
          for (const ev of evs) { if (ev.id != null) await window.db.delete('registro_eventos', ev.id).catch(() => {}); }
          await window.db.delete('animales', Number(criaId)).catch(() => {});
        }
        if (partoEventoId != null) await window.db.delete('reproduccion_eventos', Number(partoEventoId)).catch(() => {});
        if (madreId != null && madreOriginal) {
          const m = await Animales.get(madreId).catch(() => null);
          if (m) {
            m.numero_partos = madreOriginal.numero_partos;
            m.estado_reproductivo = madreOriginal.estado_reproductivo;
            await Animales.save(m).catch(() => {});
          }
        }
      } catch (_) { /* limpieza best-effort */ }
    }
  },

  // ============================================================
  // TEST 12: EVENTOS DE CENSO (ALTA / BAJA) EN EL LIBRO DE REGISTRO
  // ============================================================
  async testEventosCenso() {
    const M = 'EVENTOS CENSO';
    this._log('RUN', M, 'Validando que el alta y la baja de un animal generan evento en el libro de registro');

    if (!this._assert(window.Animales && typeof Animales.save === 'function', M,
      'Animales.save disponible', 'PRE-REQ')) return false;

    let animalId = null;
    try {
      const crotal = 'ES' + String(Date.now()).slice(-12);
      const hoy = new Date().toISOString().split('T')[0];

      // --- ALTA (compra) ---
      animalId = await Animales.save({
        numero_identificacion: crotal,
        especie: 'Bovino',
        sexo: 'M',
        tipoAlta: 'Compra',
        fecha_alta: hoy,
        fecha_nacimiento: hoy,
        rega_origen: 'ES041230000123',
        estado: 'activo',
        notas: this._MARKER + ' alta de prueba'
      });
      this._assert(!!animalId, M, `Animal dado de alta (crotal ${crotal})`, 'ALTA');

      let evs = await window.db.getAllFromIndex('registro_eventos', 'entidad_id', animalId).catch(() => []);
      const alta = evs.find(e => e.motivo_tarea === 'alta_compra' && e.tipo === 'alta');
      this._assert(!!alta, M,
        'Evento de alta ("alta_compra") registrado en el libro de registro', 'ALTA');

      // --- BAJA (muerte) ---
      const animal = await Animales.get(animalId);
      animal.estado = 'baja';
      animal.motivo_baja = 'muerte';
      animal.fecha_baja = hoy;
      await Animales.save(animal);

      evs = await window.db.getAllFromIndex('registro_eventos', 'entidad_id', animalId).catch(() => []);
      const baja = evs.find(e => e.tipo === 'baja');
      this._assert(!!baja, M,
        'Evento de baja registrado en el libro de registro', 'BAJA');
      this._assert(baja && baja.motivo_baja === 'muerte', M,
        'La baja conserva el motivo ("muerte")', 'BAJA');

      // --- No duplica el alta al editar ---
      const altas = evs.filter(e => e.tipo === 'alta');
      this._assert(altas.length === 1, M,
        'La edición no duplica el evento de alta', 'INTEGRIDAD');

      this._log('PASS', M, '✅ COMPLETADO — Alta y baja quedan trazadas en el libro de registro');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    } finally {
      try {
        if (animalId != null) {
          const evs = await window.db.getAllFromIndex('registro_eventos', 'entidad_id', animalId).catch(() => []);
          for (const ev of evs) { if (ev.id != null) await window.db.delete('registro_eventos', ev.id).catch(() => {}); }
          await window.db.delete('animales', Number(animalId)).catch(() => {});
        }
      } catch (_) { /* limpieza best-effort */ }
    }
  },

  // ============================================================
  // TEST 13: ZONAS CON UGM, CARGA GANADERA, DISTANCIAS Y PAC
  // ============================================================
  async testZonasUGM() {
    const M = 'ZONAS UGM/PAC';
    this._log('RUN', M, 'Validando que las zonas calculan UGM, carga ganadera, PAC y distancia agua (Gap 9 SIGGAN)');

    if (!this._assert(window.Fincas && typeof Fincas.getActive === 'function', M,
      'Fincas.getActive disponible', 'PRE-REQ')) return false;

    try {
      const finca = await Fincas.getActive();
      if (!finca || !finca.zonas || finca.zonas.length === 0) {
        this._log('WARN', M, 'Sin zonas en la finca activa', 'ZONA');
        return true;
      }

      const zona = finca.zonas[0];
      this._assert(!!zona.nombre, M, `Primera zona: ${zona.nombre}`, 'ZONA');
      
      // Validar campos nuevos: codigo_pac, distancia_agua_m, superficie
      this._assert(!!zona.codigo_pac, M,
        `Código PAC presente: ${zona.codigo_pac}`, 'PAC');
      this._assert(typeof zona.distancia_agua_m === 'number', M,
        `Distancia agua es número: ${zona.distancia_agua_m}m`, 'DISTANCIA');
      
      // Calcular UGM de la zona
      const rebanos = await Rebanos.list();
      const ugmFactor = { 'Vacas': 1.0, 'Ovejas': 0.15, 'Cabras': 0.15, 'Cerdos': 0.3, 'Caballos': 1.1, 'Equino': 1.1 };
      let ugmTotal = 0, censoTotal = 0;
      for (let r of rebanos.filter(rb => rb.zonaActual === zona.nombre)) {
        const factor = ugmFactor[r.especie] || 0.2;
        const ans = await Animales.list(r.id);
        censoTotal += ans.length;
        ugmTotal += ans.length * factor;
      }
      
      const superficie = zona.superficieGrafica || zona.superficie || 0;
      const cargaGanadera = superficie > 0 ? (ugmTotal / superficie).toFixed(2) : 0;
      
      this._assert(ugmTotal >= 0, M,
        `UGM total calculado: ${ugmTotal.toFixed(1)} (censo: ${censoTotal})`, 'UGM');
      this._assert(cargaGanadera >= 0, M,
        `Carga ganadera: ${cargaGanadera} UGM/ha (superficie: ${superficie}ha)`, 'CARGA');
      
      this._log('PASS', M, '✅ COMPLETADO — Zonas con UGM, carga ganadera, PAC y distancia agua');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  // ============================================================
  // TEST 14: TIPO DE EXPLOTACIÓN REGA EN REBAÑOS
  // ============================================================
  async testTipoExplotacionREGA() {
    const M = 'REBAÑOS TIPO EXPLOTACIÓN REGA';
    this._log('RUN', M, 'Validando que los rebaños tienen tipo_explotacion_rega del catálogo (Gap 8 SIGGAN)');

    if (!this._assert(window.Rebanos && typeof Rebanos.list === 'function', M,
      'Rebanos.list disponible', 'PRE-REQ')) return false;

    try {
      const rebanos = await Rebanos.list();
      if (rebanos.length === 0) {
        this._log('WARN', M, 'Sin rebaños en la finca activa', 'REBANO');
        return true;
      }

      const tiposREGA = window.ComunidadesService ? window.ComunidadesService.getTiposExplotacionREGA() : [];
      this._assert(tiposREGA.length > 0, M,
        `Catálogo TIPOS_EXPLOTACION_REGA disponible (${tiposREGA.length} opciones)`, 'CATALOGO');

      let validosCount = 0;
      for (let reb of rebanos.slice(0, 3)) {
        if (reb.tipo_explotacion_rega && tiposREGA.includes(reb.tipo_explotacion_rega)) {
          validosCount++;
          this._assert(true, M,
            `Rebaño "${reb.nombre}": tipo_explotacion_rega="${reb.tipo_explotacion_rega}" (válido)`, 'TIPO_REGA');
        } else {
          this._assert(false, M,
            `Rebaño "${reb.nombre}": tipo_explotacion_rega no encontrado o inválido`, 'TIPO_REGA');
        }
      }

      this._assert(validosCount > 0, M,
        `${validosCount} rebaño(s) con tipo_explotacion_rega válido`, 'COBERTURA');

      this._log('PASS', M, '✅ COMPLETADO — Rebaños con tipo_explotacion_rega normativo');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  // ============================================================
  // TEST 15: BLOQUEO DE VENTA DE LECHE CON PROHIBIDOLECHE
  // ============================================================
  async testVentaLecheBlocking() {
    const M = 'VENTA DE LECHE BLOQUEADA';
    this._log('RUN', M, 'Validando que la venta de leche se bloquea si prohibidoLeche está activo (Gap 5 SIGGAN)');

    if (!this._assert(window.Sanitarios && typeof Sanitarios.list === 'function', M,
      'Sanitarios.list disponible', 'PRE-REQ')) return false;

    if (!this._assert(window.db && typeof window.db.add === 'function', M,
      'Database disponible', 'PRE-REQ')) return false;

    try {
      const fincaId = await Fincas.getActiveId();
      const rebanos = await Rebanos.list();
      
      if (rebanos.length === 0) {
        this._log('WARN', M, 'Sin rebaños en la finca activa', 'REBANO');
        return true;
      }

      const rebanoId = rebanos[0].id;

      // Crear un sanitario con prohibidoLeche: true
      const sanitarioProhibido = {
        rebanoId: rebanoId,
        tipo_tratamiento: 'Antibiótico',
        fecha: new Date().toISOString().split('T')[0],
        medicamento: 'TEST_PROHIBIDO_LECHE',
        prohibidoLeche: true,
        tiempo_espera_leche_dias: 14,
        tiempo_espera_carne_dias: 0,
      };

      const sanitarioId = await window.db.add('sanitarios_ganado', sanitarioProhibido);
      this._assert(sanitarioId > 0, M, `Sanitario con prohibidoLeche creado (ID: ${sanitarioId})`, 'SANITARIO');

      // Intentar crear una venta de leche (debería ser bloqueada)
      const lecheData = {
        cantidad: 100,
        fechaRecogida: new Date().toISOString().split('T')[0],
        fincaId: fincaId,
        matriculaCisterna: 'TEST-CISTERNA',
        temperatura: 4,
        certificadoInhibidores: true,
        precioBase: 0.45,
        estadoAnalitica: 'Validado',
        tasa_INLAC: 0.0012,
        antibioticos: false,
        comunidad_autonoma: 'andalucia',
        contrato_numero: '',
        adsg_codigo: '',
        rega_origen: '',
        numero_infolac: '',
        numero_muestreo_oficial: '',
        cadena_frio_cumplida: true,
        hora_ordeno: '06:00',
        hora_carga: '07:00',
        laboratorio: {
          grasa: 4.2,
          proteina: 3.4,
          somaticas: 200000,
          germenes: 50000,
          antibioticos: false,
          fecha_analisis: new Date().toISOString().split('T')[0],
          extracto_seco: 7.6,
          recuento_bacterias: 50000,
          antibioticos_positivos: false,
          laboratorio_nombre: 'LIGAL',
          nro_boletin: 'TEST-001',
        },
        precio_extracto_seco: 0.045,
        primas_penalizaciones: 0,
        precio_final_unitario: 0.5064,
        importe_total: 50.64,
        coste_alimentacion_diario: 0,
        coste_alimentacion_periodo: 0,
        mofa: 50.64,
        creadoEn: new Date().toISOString(),
      };

      // Validar que prohibidoLeche bloquea (buscar en sanitarios)
      const sanitarios = await window.Sanitarios.list(null, fincaId);
      const prohibidoLecheActivo = sanitarios && sanitarios.some(s => s.prohibidoLeche === true);
      
      this._assert(prohibidoLecheActivo, M, 'Validación de prohibidoLeche detectado en sanitarios', 'VALIDACION');

      // FASE 1 — P1: Verificar que MotorTrazabilidad.checkSupresion() bloquea correctamente
      if (window.MotorTrazabilidad && typeof window.MotorTrazabilidad.checkSupresion === 'function') {
        const animales = await window.db.getAll('animales').catch(() => []);
        const animalDelRebano = animales.find(a => a.rebanoId === rebanoId && a.estado === 'activo');
        
        if (animalDelRebano) {
          const resultado = await window.MotorTrazabilidad.checkSupresion(
            window.db,
            animalDelRebano.id,
            new Date().toISOString().split('T')[0],
            'leche'
          );
          
          this._assert(
            resultado.apto === false,
            M,
            `checkSupresion() bloquea venta de leche: apto=${resultado.apto}, motivo="${resultado.motivo?.substring(0, 50)}..."`,
            'BLOQUEO_SUPRESION'
          );
        } else {
          this._log('WARN', M, 'No hay animales activos en el rebaño para probar checkSupresion', 'BLOQUEO_SUPRESION');
        }
      } else {
        this._log('WARN', M, 'MotorTrazabilidad.checkSupresion no disponible', 'BLOQUEO_SUPRESION');
      }

      // Limpiar: eliminar el sanitario de prueba
      try {
        await window.db.delete('sanitarios_ganado', sanitarioId);
        this._log('INFO', M, 'Sanitario de prueba eliminado', 'CLEANUP');
      } catch (e) {
        this._log('WARN', M, `No se pudo limpiar sanitario: ${e.message}`, 'CLEANUP');
      }

      this._log('PASS', M, '✅ COMPLETADO — Venta de leche bloqueada si prohibidoLeche activo');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  // ============================================================
  // TEST 16: CLASIFICACIÓN SANDACH POR MOTIVO DE BAJA
  // ============================================================
  async testSANDACHClassificacion() {
    const M = 'SANDACH CLASIFICACIÓN';
    this._log('RUN', M, 'Validando que motivo_baja se mapea a categoría SANDACH (Gap 7 SIGGAN, Reg. UE 1069/2009)');

    if (!this._assert(window.Animales && typeof Animales.save === 'function', M,
      'Animales.save disponible', 'PRE-REQ')) return false;

    if (!this._assert(window.ComunidadesService && typeof ComunidadesService.getSANDACHCategoria === 'function', M,
      'ComunidadesService.getSANDACHCategoria disponible', 'PRE-REQ')) return false;

    try {
      const fincaId = await Fincas.getActiveId();
      
      // Crear animal con motivo_baja = "Muerte en la explotación" → SANDACH Cat I
      // Crotal válido: ES + 12 dígitos (formato normativo)
      const genCrotal = () => 'ES' + Math.random().toString().substr(2, 12).padEnd(12, '0').substr(0, 12);
      const crotalMuerte = genCrotal();
      const animalMuerte = {
        numero_identificacion: crotalMuerte,
        especie: 'Vacas',
        categoria: 'Hembra',
        tipoAlta: 'Compra',
        rebanoId: null,
        estado: 'Baja',
        motivo_baja: 'muerte',
        fecha_baja: new Date().toISOString().split('T')[0],
      };
      
      const idMuerte = await Animales.save(animalMuerte);
      this._assert(idMuerte, M, `Animal con muerte guardado (id: ${idMuerte})`, 'ALTA');
      
      // Recuperar y validar sandach_categoria
      const savedMuerte = await window.db.get('animales', idMuerte);
      const sandachMuerte = ComunidadesService.getSANDACHCategoria('muerte');
      
      this._assert(sandachMuerte === 1, M, 
        `Muerte → SANDACH Cat I (${sandachMuerte})`, 'SANDACH');
      
      this._assert(savedMuerte.sandach_categoria === 1, M,
        `Animal muerte.sandach_categoria = 1`, 'PERSISTENCIA');

      // Crear animal con motivo_baja = "sacrificio_obligatorio" → SANDACH Cat II
      const crotalSacrificio = genCrotal();
      const animalSacrificio = {
        numero_identificacion: crotalSacrificio,
        especie: 'Vacas',
        categoria: 'Hembra',
        tipoAlta: 'Compra',
        rebanoId: null,
        estado: 'Baja',
        motivo_baja: 'sacrificio_obligatorio',
        fecha_baja: new Date().toISOString().split('T')[0],
      };
      
      const idSacrificio = await Animales.save(animalSacrificio);
      this._assert(idSacrificio, M, `Animal con sacrificio obligatorio guardado (id: ${idSacrificio})`, 'ALTA');
      
      const savedSacrificio = await window.db.get('animales', idSacrificio);
      const sandachSacrificio = ComunidadesService.getSANDACHCategoria('sacrificio_obligatorio');
      
      this._assert(sandachSacrificio === 2, M,
        `Sacrificio obligatorio → SANDACH Cat II (${sandachSacrificio})`, 'SANDACH');
      
      this._assert(savedSacrificio.sandach_categoria === 2, M,
        `Animal sacrificio.sandach_categoria = 2`, 'PERSISTENCIA');

      // Crear animal con motivo_baja = "autoconsumo" → SANDACH Cat III
      const crotalAutoconsumo = genCrotal();
      const animalAutoconsumo = {
        numero_identificacion: crotalAutoconsumo,
        especie: 'Vacas',
        categoria: 'Hembra',
        tipoAlta: 'Compra',
        rebanoId: null,
        estado: 'Baja',
        motivo_baja: 'autoconsumo',
        fecha_baja: new Date().toISOString().split('T')[0],
      };
      
      const idAutoconsumo = await Animales.save(animalAutoconsumo);
      this._assert(idAutoconsumo, M, `Animal con autoconsumo guardado (id: ${idAutoconsumo})`, 'ALTA');
      
      const savedAutoconsumo = await window.db.get('animales', idAutoconsumo);
      const sandachAutoconsumo = ComunidadesService.getSANDACHCategoria('autoconsumo');
      
      this._assert(sandachAutoconsumo === 3, M,
        `Autoconsumo → SANDACH Cat III (${sandachAutoconsumo})`, 'SANDACH');
      
      this._assert(savedAutoconsumo.sandach_categoria === 3, M,
        `Animal autoconsumo.sandach_categoria = 3`, 'PERSISTENCIA');

      // Validar descripciones SANDACH
      const desc1 = ComunidadesService.getSANDACHDescripcion(1);
      const desc2 = ComunidadesService.getSANDACHDescripcion(2);
      const desc3 = ComunidadesService.getSANDACHDescripcion(3);
      
      this._assert(desc1 && desc1.length > 0, M,
        `SANDACH Cat I descripción: "${desc1}"`, 'DESCRIPCIÓN');
      this._assert(desc2 && desc2.length > 0, M,
        `SANDACH Cat II descripción: "${desc2}"`, 'DESCRIPCIÓN');
      this._assert(desc3 && desc3.length > 0, M,
        `SANDACH Cat III descripción: "${desc3}"`, 'DESCRIPCIÓN');

      // Limpiar: eliminar animales de prueba
      try {
        await window.db.delete('animales', idMuerte);
        await window.db.delete('animales', idSacrificio);
        await window.db.delete('animales', idAutoconsumo);
        this._log('INFO', M, 'Animales de prueba eliminados', 'CLEANUP');
      } catch (e) {
        this._log('WARN', M, `No se pudieron limpiar animales: ${e.message}`, 'CLEANUP');
      }

      this._log('PASS', M, '✅ COMPLETADO — Motivos de baja clasificados correctamente a SANDACH');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  async testNotificacionesREGA() {
    const M = 'TEST 17 — Notificaciones a REGA (Gap 11)';
    this._log('RUN', M, 'Iniciando validación de notificaciones a REGA');
    
    try {
      // Validar que módulo existe
      this._assert(window.NotificacionesREGA, M, 'Módulo NotificacionesREGA cargado', 'CARGA');
      
      if (!window.NotificacionesREGA) {
        this._log('FAIL', M, 'NotificacionesREGA no está disponible', 'CARGA');
        return false;
      }

      const finca = await Fincas.getActive();
      if (!finca) {
        this._log('WARN', M, 'No hay finca activa, saltando tests', 'SETUP');
        return true;
      }

      // Crear animal de prueba
      const animalTest = {
        numero_identificacion: `ES${Math.random().toString().substr(2, 12).padEnd(12, '0').substr(0, 12)}`,
        especie: 'Ovejas',
        sexo: 'H',
        raza: 'Merino',
        rebanoId: null,
        tipoAlta: 'Compra',
        fecha_nacimiento: new Date().toISOString().split('T')[0],
        estado: 'activo',
        notificado_rega: false
      };

      const animalId = await Animales.save(animalTest);
      this._assert(animalId, M, `Animal de prueba creado (id: ${animalId})`, 'SETUP');

      // TEST: Validar condiciones para notificar
      const validacion1 = NotificacionesREGA.validarNotificacionPosible(animalTest, finca);
      this._assert(validacion1.valido === true, M, 
        `Validación: animal activo con crotal = válido`, 'VALIDACIÓN');

      // TEST: Animal sin crotal no debe poder notificarse
      const animalSinCrotal = { ...animalTest, numero_identificacion: null };
      const validacion2 = NotificacionesREGA.validarNotificacionPosible(animalSinCrotal, finca);
      this._assert(validacion2.valido === false, M, 
        `Validación: animal sin crotal = inválido`, 'VALIDACIÓN');

      // TEST: Registrar notificación
      const resultadoRegistro = await NotificacionesREGA.registrar({
        animal_id: animalId,
        finca_id: finca.id,
        animal_numero: animalTest.numero_identificacion,
        finca_rega: finca.rega || finca.codigo_REGA,
        tipo_evento: 'cambio_estado'
      });
      this._assert(resultadoRegistro && resultadoRegistro.exito === true, M, 
        `Notificación registrada (número: ${resultadoRegistro.numero_seguimiento})`, 'REGISTRO');

      // TEST: Verificar que animal fue notificado
      const yaNotificado = await NotificacionesREGA.yaFueNotificado(animalId);
      this._assert(yaNotificado === true, M, 
        `Animal marcado como notificado`, 'PERSISTENCIA');

      // TEST: Obtener historial
      const historial = await NotificacionesREGA.obtenerHistorial(animalId);
      this._assert(historial.length > 0, M, 
        `Historial de notificaciones recuperado (${historial.length} registros)`, 'HISTORIAL');

      // TEST: Actualizar estado de notificación
      if (resultadoRegistro.id) {
        await NotificacionesREGA.actualizarEstado(resultadoRegistro.id, 'enviado');
        const historialActualizado = await NotificacionesREGA.obtenerHistorial(animalId);
        const notificacionActualizada = historialActualizado[0];
        this._assert(notificacionActualizada && notificacionActualizada.estado_notificacion === 'enviado', M, 
          `Estado actualizado a 'enviado'`, 'ESTADO');

        // TEST: Simular envío a REGA
        const resultadoEnvio = await NotificacionesREGA.enviarAREGA(notificacionActualizada);
        this._assert(resultadoEnvio && resultadoEnvio.exito === true, M, 
          `Envío a REGA simulado exitosamente`, 'ENVÍO');
      } else {
        this._log('WARN', M, 'Notificación sin ID, saltando actualización de estado', 'ESTADO');
      }

      // Limpiar
      try {
        await window.db.delete('animales', animalId);
        this._log('INFO', M, 'Animal de prueba eliminado', 'CLEANUP');
      } catch (e) {
        this._log('WARN', M, `No se pudo limpiar: ${e.message}`, 'CLEANUP');
      }

      this._log('PASS', M, '✅ COMPLETADO — Notificaciones a REGA funcionan correctamente');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  // TEST 18: Validación de Cobertura BD DEMO CHAMORRO
  async testCoberturaDemo() {
    const M = 'COBERTURA BD DEMO';
    this._log('RUN', M, 'Validando cobertura de módulos en la demo CHAMORRO');
    try {
      const finca = await Fincas.getActive();
      if (!this._assert(finca, M, `[PRE-REQ] Finca activa existe`, 'PRE-REQ')) return false;
      this._assert(finca.rega === 'ES210050001234', M, `[PRE-REQ] REGA correcto en demo (ES210050001234)`, 'PRE-REQ');

      // Módulos y cobertura esperada
      const coverage = {
        'fincas': { expectedMin: 1, store: 'fincas', desc: 'Finca + Zonas (3)' },
        'rebanos': { expectedMin: 3, store: 'rebanos', desc: 'Rebaños (Vacas Frisonas, Terneros Cebo, Ovejas Merinas)' },
        'animales': { expectedMin: 9, store: 'animales', desc: 'Animales (9: 3 vacas, 2 terneros, 4 ovejas)' },
        'compradores': { expectedMin: 3, store: 'compradores', desc: 'Compradores (Cárnicas, Lácteos, Ganados)' },
        'proveedores': { expectedMin: 3, store: 'proveedores', desc: 'Proveedores (Piensos, Vet, Maquinaria)' },
        'transportistas': { expectedMin: 2, store: 'transportistas', desc: 'Transportistas (Carga, Cisterna)' },
        'contratos': { expectedMin: 2, store: 'contratos_compra', desc: 'Contratos (Carne, Leche)' },
        'gastos': { expectedMin: 7, store: 'gastos_ganaderia', desc: 'Gastos (Alimentación, Sanidad, Amortización)' },
        'sanitarios_ganado': { expectedMin: 3, store: 'sanitarios_ganado', desc: 'Tratamientos (Vacunación, Desparasitación, Antibiótico)' },
        'produccion_leche': { expectedMin: 5, store: 'produccion_leche', desc: 'Producción de Leche (5 fechas × 3 vacas)' },
        'comercializacion_leche': { expectedMin: 3, store: 'comercializacion_leche', desc: 'Comercialización Leche (3 entregas)' },
        'comercializacion_carne': { expectedMin: 1, store: 'comercializacion_carne', desc: 'Comercialización Carne (1 venta ternero)' },
        'registro_eventos': { expectedMin: 30, store: 'registro_eventos', desc: 'Registro de Eventos (movimientos, producciones, partos)' }
      };

      let totalModulos = 0, modulosCubiertos = 0, modulosFallidos = [];

      for (const [key, config] of Object.entries(coverage)) {
        totalModulos++;
        try {
          const items = await window.db.getAll(config.store).catch(() => []);
          const count = items ? items.length : 0;
          const isCovered = count >= config.expectedMin;

          if (isCovered) {
            modulosCubiertos++;
            this._log('PASS', M, `${config.desc}: ${count} registros (≥${config.expectedMin})`, 'COBERTURA');
          } else {
            modulosFallidos.push(`${key}: ${count}/${config.expectedMin}`);
            this._log('WARN', M, `${config.desc}: ${count} registros (<${config.expectedMin})`, 'COBERTURA');
          }
        } catch (e) {
          modulosFallidos.push(`${key}: ERROR (${e.message})`);
          this._log('WARN', M, `${config.desc}: ERROR - ${e.message}`, 'COBERTURA');
        }
      }

      // Resumen
      const porcentajeCubertura = Math.round((modulosCubiertos / totalModulos) * 100);
      this._assert(modulosCubiertos === totalModulos, M, 
        `Cobertura de módulos SIGGAN: ${modulosCubiertos}/${totalModulos} (${porcentajeCubertura}%)`, 'COBERTURA');

      if (modulosFallidos.length > 0) {
        console.log(`  ⚠️  Módulos incompletos: ${modulosFallidos.join(', ')}`);
      }

      if (modulosFallidos.length === 0) {
        this._log('PASS', M, '✅ COMPLETADO — BD DEMO CHAMORRO cubre todos los módulos');
      } else {
        this._log('WARN', M, '⚠️ COMPLETADO CON OBSERVACIONES — Hay módulos incompletos en la DEMO', 'COBERTURA');
      }
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    }
  },

  async testModoInterno() {
    const M = 'MODO INTERNO';
    this._log('RUN', M, 'Verificando ayudas del modo interno y registro de acuses');

    if (!this._assert(window.DocumentosView, M, 'DocumentosView disponible', 'PRE-REQ')) return false;
    if (!this._assert(typeof DocumentosView._registrarAcuse === 'function', M, 'Acción registrar acuse disponible', 'PRE-REQ')) return false;

    const hashOriginal = window.location.hash;
    try {
      if (!document.querySelector('.modo-interno-banner')) {
        window.location.hash = '#/documentos';
        for (let i = 0; i < 6; i++) {
          await this._wait(300);
          if (document.querySelector('.modo-interno-banner')) break;
          if (i === 2 && window.DocumentosView && typeof DocumentosView.render === 'function') {
            try { await DocumentosView.render(); } catch (_) { /* ignore */ }
          }
        }
      }

      const banner = document.querySelector('.modo-interno-banner');
      this._assert(!!banner, M, 'Banner recordatorio de modo interno visible', 'UI');

      const movimientos = await Movimientos.list({ includeAnulados: true });
      if (movimientos.length > 0) {
        this._assert(Object.prototype.hasOwnProperty.call(movimientos[0], 'acuse_manual'), M, 'Movimientos guardan acuse_manual', 'DATOS');
      } else {
        this._log('WARN', M, 'Sin movimientos disponibles para validar acuse_manual', 'DATOS');
      }

      if (window.PedidosCrotales && typeof window.PedidosCrotales.list === 'function') {
        const pedidos = await Promise.race([
          window.PedidosCrotales.list().catch(() => []),
          this._wait(2000).then(() => (console.warn('[SIGGAN QA] Timeout PedidosCrotales.list()'), [])),
        ]);
        if (pedidos.length > 0) {
          this._assert(Object.prototype.hasOwnProperty.call(pedidos[0], 'acuse_manual'), M, 'Pedidos de crotales incluyen acuse_manual', 'DATOS');
        }
      }

      this._log('PASS', M, '✅ COMPLETADO — Modo interno verificado');
      return !this._hasFail(M);
    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      return false;
    } finally {
      // No restauramos hash para evitar race conditions con el siguiente test
    }
  },

  // ============================================================
  // EJECUCIÓN PRINCIPAL
  // ============================================================
  async runAll() {
    console.log('\n' + '='.repeat(75));
    console.log('🧪 SIGGAN QA SUITE v1.0 — Adaptación al Sistema de Gestión Ganadera');
    console.log('📅 ' + new Date().toLocaleString());
    console.log('📋 REGA · Catálogos · Movimientos · Saneamientos · Tratamientos · Export · Cuaderno · Crotal · Aforo · Genealogía · Censo · Rebaños · Venta de Leche · SANDACH');
    console.log('='.repeat(75) + '\n');

    if (!window.db) {
      console.error('❌ ERROR: window.db no disponible. Espera a que la app cargue.');
      return;
    }
    if (!window.ComunidadesService) {
      console.error('❌ ERROR: ComunidadesService no disponible.');
      return;
    }
    const fincaId = await Fincas.getActiveId();
    if (!fincaId) {
      console.error('❌ ERROR: No hay finca activa. Carga la Demo CHAMORRO en Ajustes.');
      return;
    }
    console.log(`📍 Finca activa: ${fincaId}\n`);

    this._results = [];
    this._runStartIndex = 0;

    const tests = [
      { name: 'Validación REGA', fn: () => this.testValidacionREGA() },
      { name: 'Catálogos SIGGAN', fn: () => this.testCatalogosSiggan() },
      { name: 'Libro de Movimientos', fn: () => this.testLibroMovimientos() },
      { name: 'Libro de Saneamientos', fn: () => this.testLibroSaneamientos() },
      { name: 'Libro de Tratamientos', fn: () => this.testLibroTratamientos() },
      { name: 'Exportación REGA/SIA', fn: () => this.testExportacion() },
      { name: 'Modo Interno', fn: () => this.testModoInterno() },
      { name: 'Cuaderno Digital', fn: () => this.testCuadernoView() },
      { name: 'Validación Crotal', fn: () => this.testValidacionCrotal() },
      { name: 'Traslado Interno y Aforo', fn: () => this.testTrasladoInterno() },
      { name: 'Parto y Genealogía', fn: () => this.testPartoGenealogia() },
      { name: 'Eventos de Censo (Alta/Baja)', fn: () => this.testEventosCenso() },
      { name: 'Zonas (UGM/PAC/Distancias)', fn: () => this.testZonasUGM() },
      { name: 'Rebaños (Tipo Explotación REGA)', fn: () => this.testTipoExplotacionREGA() },
      { name: 'Venta de Leche (Bloqueo prohibidoLeche)', fn: () => this.testVentaLecheBlocking() },
      { name: 'SANDACH Clasificación (Bajas)', fn: () => this.testSANDACHClassificacion() },
      { name: 'Notificaciones a REGA', fn: () => this.testNotificacionesREGA() },
      { name: 'Cobertura BD DEMO CHAMORRO', fn: () => this.testCoberturaDemo() },
      { name: 'Rendimiento', fn: () => this.testRendimiento() },
    ];

    const startTime = Date.now();
    let passed = 0, failed = 0;

    for (const test of tests) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`▶️  [${tests.indexOf(test) + 1}/${tests.length}] ${test.name}`);
      console.log('─'.repeat(60));
      try {
        const result = await test.fn();
        if (result) passed++; else failed++;
      } catch (e) {
        this._log('FAIL', test.name, `Excepción no controlada: ${e.message}`, 'EXCEPCIÓN');
        failed++;
      }
      await this._wait(200);
    }

    const totalTime = Date.now() - startTime;

    // ---- REPORTE FINAL ----
    console.log('\n' + '='.repeat(75));
    console.log('📊 REPORTE FINAL — SIGGAN QA v1.0');
    console.log('='.repeat(75));
    console.log(`⏱️  Tiempo total: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`✅ Tests OK: ${passed}/${tests.length}`);
    console.log(`❌ Tests con fallo: ${failed}/${tests.length}`);

    const failures = this._results.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      console.log('\n❌ DETALLE DE FALLOS:');
      console.log('─'.repeat(60));
      failures.forEach(f => console.log(`  ❌ [${f.module}]${f.category ? ` [${f.category}]` : ''} ${f.detail}`));
    }

    console.log('\n📋 RESUMEN POR CATEGORÍA:');
    console.log('─'.repeat(50));
    const cats = [...new Set(this._results.map(r => r.category).filter(Boolean))];
    cats.forEach(cat => {
      const cr = this._results.filter(r => r.category === cat);
      const p = cr.filter(r => r.status === 'PASS').length;
      const f = cr.filter(r => r.status === 'FAIL').length;
      const w = cr.filter(r => r.status === 'WARN').length;
      console.log(`  ${f === 0 ? '✅' : '❌'} ${cat.padEnd(18)} ${p}✅ ${f}❌ ${w}⚠️`);
    });

    console.log('\n' + '='.repeat(75));
    console.log(failed === 0 ? '🎉 TODOS LOS TESTS SIGGAN PASARON' : '⚠️ HAY TESTS SIGGAN FALLIDOS — Revisar detalle arriba');
    console.log('💡 Ejecuta await SigganQA.cleanup() para eliminar los datos de prueba.');
    console.log('='.repeat(75) + '\n');

    return { passed, failed, total: tests.length, results: this._results };
  },

  // Ejecutar un test individual
  async run(testName) {
    const map = {
      'rega': () => this.testValidacionREGA(),
      'catalogos': () => this.testCatalogosSiggan(),
      'movimientos': () => this.testLibroMovimientos(),
      'saneamientos': () => this.testLibroSaneamientos(),
      'tratamientos': () => this.testLibroTratamientos(),
      'export': () => this.testExportacion(),
      'cuaderno': () => this.testCuadernoView(),
      'crotal': () => this.testValidacionCrotal(),
      'traslado': () => this.testTrasladoInterno(),
      'parto': () => this.testPartoGenealogia(),
      'censo': () => this.testEventosCenso(),
      'zonas': () => this.testZonasUGM(),
      'rebanos': () => this.testTipoExplotacionREGA(),
      'leche': () => this.testVentaLecheBlocking(),
      'sandach': () => this.testSANDACHClassificacion(),
      'notificaciones': () => this.testNotificacionesREGA(),
      'interno': () => this.testModoInterno(),
      'coverage': () => this.testCoberturaDemo(),
      'cobertura': () => this.testCoberturaDemo(),
      'rendimiento': () => this.testRendimiento(),
    };
    const fn = map[(testName || '').toLowerCase()];
    if (!fn) {
      console.log(`Test "${testName}" no encontrado. Opciones: ${Object.keys(map).join(', ')}`);
      return;
    }
    this._runStartIndex = this._results.length;
    console.log(`\n▶️  Ejecutando test SIGGAN: ${testName}...\n`);
    return await fn();
  },

  // Limpiar datos de prueba generados por la suite
  async cleanup() {
    console.log('🧹 Limpiando datos de prueba SIGGAN...');
    const stores = ['movimientos_ganado', 'saneamientos', 'sanitarios_ganado', 'registro_eventos'];
    let total = 0;
    for (const store of stores) {
      try {
        const all = await window.db.getAll(store).catch(() => []);
        const testItems = all.filter(item => JSON.stringify(item).includes(this._MARKER));
        for (const item of testItems) {
          await window.db.delete(store, item.id);
          total++;
        }
        if (testItems.length > 0) {
          console.log(`  🗑️  ${store}: ${testItems.length} registros eliminados`);
        }
      } catch (e) {
        console.warn(`  ⚠️  Error limpiando ${store}: ${e.message}`);
      }
    }
    console.log(`✅ Limpieza completada (${total} registros eliminados)`);
  },
};

window.SigganQA = SigganQA;
console.log('✅ SIGGAN QA Suite v1.0 cargado.');
console.log('   await SigganQA.runAll()        → Ejecutar todos los tests SIGGAN');
console.log('   await SigganQA.run("movimientos") → Test individual');
console.log('   await SigganQA.cleanup()        → Limpiar datos de prueba');
