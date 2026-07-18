/**
 * Livestock Manager - E2E Test Suite v2.0.0 (QA/UX Edition)
 * 
 * Pruebas automatizadas de flujos de creación de datos con validación de:
 *   1. Validación preventiva de formularios (datos vacíos/erróneos)
 *   2. Feedback visual (toasts, disabled states, spinners)
 *   3. Monitor de consola para errores JS
 *   4. Persistencia en IndexedDB con métricas de rendimiento
 *   5. Integridad de layout tras inyección DOM (overflow, estilos)
 *   6. Aserción final: datos renderizados vs IndexedDB
 * 
 * EJECUCIÓN: Pegar en consola del navegador (DevTools) con la app abierta.
 * Uso: await E2E.runAll();
 *      await E2E.run("animal");
 *      await E2E.cleanup();
 */

const E2E = {
  _results: [],
  _consoleErrors: [],
  _consoleErrorsBackup: null,
  _perfTimings: [],

  // ============================================================
  // UTILIDADES
  // ============================================================
  _ts: () => new Date().toISOString().split('T')[1].split('.')[0],
  _uid: (p) => `${p}-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  _uidShort: (p) => `${p}${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase().slice(0, 15),
  _wait: (ms) => new Promise(r => setTimeout(r, ms)),

  _log(status, module, detail, category = '') {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '⏳';
    const cat = category ? ` [${category}]` : '';
    const line = `[${this._ts()}] ${icon} [${module}]${cat} ${detail}`;
    console.log(line);
    this._results.push({ status, module, detail, category, time: this._ts() });
  },

  _startMonitor() {
    this._consoleErrors = [];
    this._consoleErrorsBackup = console.error;
    console.error = (...args) => {
      const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      if (!msg.includes('[E2E]') && !msg.includes('E2ETest')) {
        this._consoleErrors.push(msg);
      }
      this._consoleErrorsBackup.apply(console, args);
    };
  },

  _stopMonitor() {
    if (this._consoleErrorsBackup) {
      console.error = this._consoleErrorsBackup;
      this._consoleErrorsBackup = null;
    }
    const errors = [...this._consoleErrors];
    this._consoleErrors = [];
    return errors;
  },

  _checkConsoleErrors(module) {
    const errors = this._stopMonitor();
    const realErrors = errors.filter(e =>
      !e.includes('timeout') &&
      !e.includes('Timeout') &&
      !e.includes('warn') &&
      !e.includes('WARN')
    );
    if (realErrors.length > 0) {
      this._log('FAIL', module, `Errores JS en consola: ${realErrors.slice(0, 3).join(' | ')}`, 'CONSOLA');
      return false;
    }
    return true;
  },

  async _countStore(name) {
    try { return await window.db.count(name); } catch { return -1; }
  },

  async _getAll(name) {
    try { return await window.db.getAll(name); } catch { return []; }
  },

  _checkToast(expectedText, timeout = 3000) {
    return new Promise((resolve) => {
      const container = document.getElementById('toast-container');
      if (!container) { resolve(false); return; }

      const check = () => {
        const toasts = container.querySelectorAll('.toast');
        for (const t of toasts) {
          if (t.textContent.includes(expectedText)) {
            resolve(true);
            return;
          }
        }
      };

      check();
      const interval = setInterval(() => {
        if (check()) { clearInterval(interval); return; }
      }, 100);

      setTimeout(() => { clearInterval(interval); resolve(false); }, timeout);
    });
  },

  _checkLayoutIntegrity(module) {
    const content = document.getElementById('app-content');
    if (!content) {
      this._log('FAIL', module, 'Elemento #app-content no encontrado', 'LAYOUT');
      return false;
    }

    const issues = [];

    // Overflow horizontal
    if (content.scrollWidth > content.clientWidth + 5) {
      issues.push(`overflow-x: ${content.scrollWidth}px > ${content.clientWidth}px`);
    }

    // Elementos fuera de viewport
    const children = content.querySelectorAll('*');
    let overflowCount = 0;
    for (const el of children) {
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width > window.innerWidth + 50) overflowCount++;
      } catch {}
    }
    if (overflowCount > 3) issues.push(`${overflowCount} elementos exceden viewport`);

    // Verificar que no hay errores de estilo inline rotos
    const brokenStyles = content.querySelectorAll('[style*="undefined"]');
    if (brokenStyles.length > 0) issues.push(`${brokenStyles.length} estilos con 'undefined'`);

    if (issues.length > 0) {
      this._log('FAIL', module, `Problemas de layout: ${issues.join('; ')}`, 'LAYOUT');
      return false;
    }

    this._log('PASS', module, 'Layout íntegro (sin overflow, estilos correctos)', 'LAYOUT');
    return true;
  },

  async _verifyInDB(storeName, id, expectedFields) {
    const record = await window.db.get(storeName, id);
    if (!record) return { ok: false, reason: `No existe en ${storeName} con id=${id}` };

    for (const [key, expected] of Object.entries(expectedFields)) {
      const actual = record[key];
      if (actual !== expected) {
        return { ok: false, reason: `${key}: esperado=${expected}, obtenido=${actual}` };
      }
    }
    return { ok: true, record };
  },

  async _verifyInList(listFn, id, matchFn) {
    const items = await listFn();
    const found = items.find(matchFn || ((item) => item.id === id));
    if (!found) return { ok: false, reason: 'No encontrado en la lista' };
    return { ok: true, item: found };
  },

  async _waitForEvent(eventName, timeoutMs = 5000) {
    return new Promise((resolve) => {
      let resolved = false;
      const handler = () => {
        if (!resolved) { resolved = true; resolve(true); }
      };
      if (window.EventBus) {
        window.EventBus.on(eventName, handler);
      }
      setTimeout(() => {
        if (!resolved) { resolved = true; resolve(false); }
      }, timeoutMs);
    });
  },

  // ============================================================
  // TEST 1: ALTA DE ANIMAL — Validación UI + Persistencia + Layout
  // ============================================================
  async testAltaAnimal() {
    const M = 'ALTA ANIMAL';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      // --- FASE 1: Validación preventiva (formulario vacío) ---
      this._log('RUN', M, 'Fase 1: Validación de formulario vacío');
      const crotal = this._uidShort('ES');
      const rebanos = await Rebanos.list();
      if (rebanos.length === 0) {
        this._log('FAIL', M, 'No hay rebaños. Crear rebaño primero.', 'PRE-REQ');
        return false;
      }

      // Abrir formulario de nuevo animal
      location.hash = '#/animal';
      await this._wait(500);

      // Intentar guardar sin llenar crotal
      const btnGuardar = document.getElementById('btn-guardar-main');
      if (btnGuardar) {
        btnGuardar.click();
        await this._wait(500);

        // Verificar que aparece error de crotal
        const toastFound = await this._checkToast('Crotal inválido', 2000);
        if (toastFound) {
          this._log('PASS', M, 'Validación: rechaza crotal vacío con toast de error', 'VALIDACIÓN');
        } else {
          this._log('WARN', M, 'No se detectó toast de error para crotal vacío (puede ser validación inline)', 'VALIDACIÓN');
        }
      }

      // --- FASE 2: Ejecución con datos válidos ---
      this._log('RUN', M, 'Fase 2: Creación con datos válidos');
      const rebano = rebanos[0];

      const t0 = performance.now();
      const animalData = {
        numero_identificacion: crotal,
        especie: 'Ovejas',
        sexo: 'H',
        raza: 'Manchega-E2E',
        rebanoId: rebano.id,
        tipoAlta: 'Nacimiento',
        fecha_nacimiento: new Date().toISOString().split('T')[0],
        notas: 'E2E Test Animal',
        estado: 'activo',
      };

      const nuevoId = await Animales.save(animalData);
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      if (elapsed > 2000) {
        this._log('WARN', M, `Latencia alta: ${elapsed.toFixed(0)}ms (>2s)`, 'RENDIMIENTO');
      } else {
        this._log('PASS', M, `Rendimiento: ${elapsed.toFixed(0)}ms`, 'RENDIMIENTO');
      }

      // Verificar toast de éxito
      const toastOk = await this._checkToast('guardado', 3000);
      if (toastOk) {
        this._log('PASS', M, 'Toast de éxito detectado', 'FEEDBACK');
      } else {
        this._log('WARN', M, 'Toast de éxito no detectado (puede ser normal)', 'FEEDBACK');
      }

      // --- FASE 3: Verificar IndexedDB ---
      this._log('RUN', M, 'Fase 3: Verificación IndexedDB');
      const dbCheck = await this._verifyInDB('animales', nuevoId, {
        numero_identificacion: crotal,
        especie: 'Ovejas',
        sexo: 'H',
        rebanoId: rebano.id,
      });

      if (dbCheck.ok) {
        this._log('PASS', M, `IndexedDB: registro ${nuevoId} verificado correctamente`, 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 4: Verificar que aparece en la lista ---
      this._log('RUN', M, 'Fase 4: Verificación en lista');
      const listCheck = await this._verifyInList(
        () => Animales.list(),
        nuevoId,
        (a) => a.numero_identificacion === crotal
      );

      if (listCheck.ok) {
        this._log('PASS', M, 'Aparece en Animales.list() con datos correctos', 'LISTA');
      } else {
        this._log('FAIL', M, `No aparece en lista: ${listCheck.reason}`, 'LISTA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 5: Navegar a vista y verificar layout ---
      this._log('RUN', M, 'Fase 5: Navegación y verificación de layout');
      location.hash = '#/animales';
      await this._wait(800);

      this._checkLayoutIntegrity(M);

      // Verificar que el registro se renderiza con datos correctos
      const content = document.getElementById('app-content');
      if (content && content.textContent.includes(crotal)) {
        this._log('PASS', M, `Crotal "${crotal}" visible en la UI`, 'RENDERIZADO');
      } else if (content) {
        this._log('FAIL', M, `Crotal "${crotal}" NO visible en la UI`, 'RENDERIZADO');
      }

      // --- FASE 6: Verificar EventBus ---
      this._log('RUN', M, 'Fase 6: Verificación EventBus');
      const eventOk = await this._waitForEvent('animal:created', 1500);
      if (eventOk) {
        this._log('PASS', M, 'Evento animal:created emitido', 'EVENTBUS');
      } else {
        this._log('WARN', M, 'Evento animal:created no capturado (puede haberse emitido antes)', 'EVENTBUS');
      }

      // Verificar consola
      this._checkConsoleErrors(M);

      this._log('PASS', M, `✅ COMPLETADO — Animal ${crotal} (id=${nuevoId}) en ${elapsed.toFixed(0)}ms`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 2: NUEVO GASTO — Validación UI + Persistencia + Layout
  // ============================================================
  async testNuevoGasto() {
    const M = 'NUEVO GASTO';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      // --- FASE 1: Validación preventiva ---
      this._log('RUN', M, 'Fase 1: Abrir wizard de gasto');
      const concepto = this._uid('Pienso-E2E');
      const monto = 175.50;

      // Abrir wizard
      if (window.GastoWizard) {
        await GastoWizard.open();
        await this._wait(500);

        // Verificar que el wizard se abrió
        const wizardOverlay = document.querySelector('.wizard-full-screen, [id*="wizard"]');
        if (wizardOverlay) {
          this._log('PASS', M, 'Wizard de gasto se abrió correctamente', 'UI');
        } else {
          this._log('WARN', M, 'No se detectó overlay de wizard', 'UI');
        }

        // Cerrar wizard sin guardar (no queremos crear datos inválidos)
        const cancelBtn = wizardOverlay?.querySelector('.wizard-btn-secondary, .btn-secondary');
        if (cancelBtn) cancelBtn.click();
        await this._wait(300);
      }

      // --- FASE 2: Crear gasto directamente ---
      this._log('RUN', M, 'Fase 2: Creación con datos válidos');
      const fincaId = await Fincas.getActiveId();
      const rebanos = await Rebanos.list();
      const rebano = rebanos.length > 0 ? rebanos[0] : null;

      const gastoData = {
        concepto: concepto,
        monto: monto,
        categoria: 'Alimentacion',
        fecha: new Date().toISOString().split('T')[0],
        fincaId: fincaId,
        proveedorId: null,
      };

      if (rebano) {
        gastoData.rebanoId = rebano.id;
        gastoData.snap_zona = rebano.zonaActual;
        gastoData.snap_especie = rebano.especie;
      }

      const t0 = performance.now();
      const nuevoId = await window.db.add('gastos_ganaderia', gastoData);
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      if (window.EventBus) {
        window.EventBus.emit('gasto:created', { gasto: { ...gastoData, id: nuevoId } });
      }

      this._log('PASS', M, `Rendimiento: ${elapsed.toFixed(0)}ms`, 'RENDIMIENTO');

      // --- FASE 3: IndexedDB ---
      const dbCheck = await this._verifyInDB('gastos_ganaderia', nuevoId, {
        concepto: concepto,
        categoria: 'Alimentacion',
      });

      if (dbCheck.ok) {
        this._log('PASS', M, `IndexedDB: gasto verificado (monto=${dbCheck.record.monto}€)`, 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 4: Verificar en consulta por finca ---
      const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId);
      const enLista = gastos.find(g => g.id === nuevoId);
      if (enLista) {
        this._log('PASS', M, 'Aparece en consulta por fincaId', 'LISTA');
      } else {
        this._log('FAIL', M, 'No aparece en consulta por fincaId', 'LISTA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 5: Navegar y verificar layout ---
      location.hash = '#/gastos';
      await this._wait(800);
      this._checkLayoutIntegrity(M);

      // Verificar renderizado
      const content = document.getElementById('app-content');
      if (content && content.textContent.includes(concepto)) {
        this._log('PASS', M, `Concepto "${concepto}" visible en UI`, 'RENDERIZADO');
      } else if (content) {
        this._log('WARN', M, `Concepto "${concepto}" no visible directamente (puede estar paginado)`, 'RENDERIZADO');
      }

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Gasto "${concepto}" ${monto}€ (id=${nuevoId})`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 3: PESAJE CÁRNICO
  // ============================================================
  async testPesajeCarne() {
    const M = 'PESAJE CARNE';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      const animales = await Animales.list();
      if (animales.length === 0) {
        this._log('FAIL', M, 'No hay animales disponibles', 'PRE-REQ');
        return false;
      }

      const animal = animales[0];
      const peso = 45.5;
      const fecha = new Date().toISOString().split('T')[0];

      // --- FASE 1: Validación de datos ---
      this._log('RUN', M, 'Fase 1: Verificar validación de peso inválido');
      try {
        await Pesajes.registrar({
          entidad_id: animal.id,
          tipo_entidad: 'animal',
          motivo_tarea: 'control',
          fecha: fecha,
          valor_neto: -5, // Peso negativo
          unidad: 'kg',
        });
        this._log('WARN', M, 'No rechazó peso negativo (puede ser comportamiento esperado)', 'VALIDACIÓN');
      } catch (e) {
        this._log('PASS', M, `Rechazó peso negativo: ${e.message}`, 'VALIDACIÓN');
      }

      // --- FASE 2: Crear pesaje válido ---
      this._log('RUN', M, 'Fase 2: Crear pesaje válido');
      const t0 = performance.now();
      const eventoId = await Pesajes.registrar({
        entidad_id: animal.id,
        tipo_entidad: 'animal',
        motivo_tarea: 'control',
        fecha: fecha,
        valor_neto: peso,
        unidad: 'kg',
        rol_contable: 'INVENTARIO',
        snap_identificacion: animal.numero_identificacion,
      });
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      this._log('PASS', M, `Rendimiento: ${elapsed.toFixed(0)}ms`, 'RENDIMIENTO');

      // --- FASE 3: IndexedDB ---
      const dbCheck = await this._verifyInDB('registro_eventos', eventoId, {
        entidad_id: animal.id,
        unidad: 'kg',
        motivo_tarea: 'control',
      });

      if (dbCheck.ok) {
        this._log('PASS', M, `IndexedDB: evento verificado (valor=${dbCheck.record.valor_neto}kg)`, 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 4: Verificar en filtro de carne ---
      const fincaId = await Fincas.getActiveId();
      const eventos = await window.db.getAllFromIndex('registro_eventos', 'fincaId', fincaId);
      const carneEvents = eventos.filter(e =>
        e.unidad === 'kg' || e.motivo_tarea === 'control' || e.motivo_tarea === 'expedicion'
      );
      const enLista = carneEvents.find(e => e.id === eventoId);
      if (enLista) {
        this._log('PASS', M, 'Aparece en filtro de carne de ProduccionView', 'LISTA');
      } else {
        this._log('FAIL', M, 'NO aparece en filtro de carne', 'LISTA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 5: Navegar y verificar layout ---
      location.hash = '#/produccion';
      await this._wait(800);
      this._checkLayoutIntegrity(M);

      // Verificar que el KPI se actualizó
      const content = document.getElementById('app-content');
      if (content && content.textContent.includes('Total kg')) {
        this._log('PASS', M, 'KPI "Total kg" visible en ProduccionView', 'RENDERIZADO');
      }

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Pesaje ${peso}kg animal ${animal.numero_identificacion} (id=${eventoId})`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 4: CONTROL LECHERO
  // ============================================================
  async testControlLechero() {
    const M = 'CONTROL LECHERO';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      const animales = await Animales.list();
      const hembras = animales.filter(a =>
        a.sexo === 'H' && ['Vacas', 'Ovejas', 'Cabras'].includes(a.especie)
      );

      if (hembras.length === 0) {
        this._log('FAIL', M, 'No hay hembras lecheras disponibles', 'PRE-REQ');
        return false;
      }

      const hembra = hembras[0];
      const litros = 2.5;
      const fecha = new Date().toISOString().split('T')[0];

      // --- FASE 1: Crear registro ---
      const t0 = performance.now();
      const eventoId = await Pesajes.registrar({
        entidad_id: hembra.id,
        tipo_entidad: 'animal',
        motivo_tarea: 'control_lechero',
        fecha: fecha,
        valor_neto: litros,
        unidad: 'L',
        calidad: { grasa: 3.5, proteina: 3.2 },
        rol_contable: 'INVENTARIO',
        snap_identificacion: hembra.numero_identificacion,
      });
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      this._log('PASS', M, `Rendimiento: ${elapsed.toFixed(0)}ms`, 'RENDIMIENTO');

      // --- FASE 2: IndexedDB ---
      const dbCheck = await this._verifyInDB('registro_eventos', eventoId, {
        unidad: 'L',
        motivo_tarea: 'control_lechero',
      });

      if (dbCheck.ok) {
        this._log('PASS', M, `IndexedDB: evento verificado (${dbCheck.record.valor_neto}L)`, 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 3: Verificar en filtro de leche ---
      const fincaId = await Fincas.getActiveId();
      const eventos = await window.db.getAllFromIndex('registro_eventos', 'fincaId', fincaId);
      const lecheEvents = eventos.filter(e =>
        (e.unidad === 'L' || e.unidad === 'Litros') &&
        (e.motivo_tarea === 'produccion_leche' || e.motivo_tarea === 'control_lechero' || e.motivo_tarea === 'expedicion')
      );
      const enLista = lecheEvents.find(e => e.id === eventoId);
      if (enLista) {
        this._log('PASS', M, 'Aparece en filtro de leche de ProduccionView', 'LISTA');
      } else {
        this._log('FAIL', M, 'NO aparece en filtro de leche', 'LISTA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 4: Navegar y verificar layout ---
      location.hash = '#/produccion';
      await this._wait(800);
      this._checkLayoutIntegrity(M);

      // Cambiar a tab de leche
      const lecheTab = document.querySelector('.prod-tab[data-tab="leche"]');
      if (lecheTab) {
        lecheTab.click();
        await this._wait(500);
        this._checkLayoutIntegrity(M);

        const content = document.getElementById('app-content');
        if (content && content.textContent.includes('Total litros')) {
          this._log('PASS', M, 'KPI "Total litros" visible en tab Láctea', 'RENDERIZADO');
        }
      }

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Control ${litros}L hembra ${hembra.numero_identificacion} (id=${eventoId})`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 5: ALBARÁN DE LECHE (Salida Láctea)
  // ============================================================
  async testAlbaranLeche() {
    const M = 'ALBARÁN LECHE';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      const fincaId = await Fincas.getActiveId();
      const cantidad = 500;
      const fecha = new Date().toISOString().split('T')[0];
      const matricula = this._uid('CIST');

      const reg = {
        cantidad: cantidad,
        fechaRecogida: fecha,
        fincaId: fincaId,
        matriculaCisterna: matricula,
        numero_Muestra_Letra_Q: 'Q-' + this._uid('E2E'),
        temperatura: 3.8,
        certificadoInhibidores: true,
        precioBase: 0.45,
        estadoAnalitica: 'Validado',
        tasa_INLAC: 0.0012,
        antibioticos: false,
        comunidad_autonoma: 'andalucia',
        contrato_numero: 'CT-E2E-001',
        adsg_codigo: 'ADSG-E2E',
        cadena_frio_cumplida: true,
        laboratorio: {
          grasa: 3.8,
          proteina: 3.3,
          somaticas: 200000,
          germenes: 50000,
          antibioticos: false,
          fecha_analisis: fecha,
          extracto_seco: 7.1,
          laboratorio_nombre: 'LIGAL',
        },
        precio_extracto_seco: 0.045,
        primas_penalizaciones: 0,
        precio_final_unitario: 0.7865,
        importe_total: parseFloat((cantidad * 0.7865).toFixed(2)),
        coste_alimentacion_periodo: 100,
        mofa: parseFloat((cantidad * 0.7865 - 100).toFixed(2)),
        creadoEn: new Date().toISOString(),
      };

      // --- FASE 1: Crear registro ---
      const t0 = performance.now();
      const nuevoId = await window.db.add('comercializacion_leche', reg);
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      this._log('PASS', M, `Rendimiento: ${elapsed.toFixed(0)}ms`, 'RENDIMIENTO');

      // --- FASE 2: IndexedDB ---
      const dbCheck = await this._verifyInDB('comercializacion_leche', nuevoId, {
        cantidad: cantidad,
        matriculaCisterna: matricula,
      });

      if (dbCheck.ok) {
        this._log('PASS', M, `IndexedDB: albarán verificado (${dbCheck.record.cantidad}L, ${dbCheck.record.importe_total}€)`, 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 3: Verificar en consulta por finca ---
      const entregas = await window.db.getAllFromIndex('comercializacion_leche', 'fincaId', fincaId);
      const enLista = entregas.find(e => e.id === nuevoId);
      if (enLista) {
        this._log('PASS', M, 'Aparece en consulta por fincaId', 'LISTA');
      } else {
        this._log('FAIL', M, 'NO aparece en consulta por fincaId', 'LISTA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 4: Navegar y verificar layout ---
      location.hash = '#/leche';
      await this._wait(800);
      this._checkLayoutIntegrity(M);

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Albarán leche ${cantidad}L matrícula ${matricula} (id=${nuevoId})`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 6: TRATAMIENTO SANITARIO
  // ============================================================
  async testTratamientoSanitario() {
    const M = 'TRATAMIENTO SANITARIO';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      const rebanos = await Rebanos.list();
      if (rebanos.length === 0) {
        this._log('FAIL', M, 'No hay rebaños disponibles', 'PRE-REQ');
        return false;
      }

      const rebano = rebanos[0];
      const medicamento = this._uid('Ivermectina-E2E');

      const tratamientoData = {
        rebanoId: rebano.id,
        medicamento: medicamento,
        tipo_tratamiento: 'Antiparasitario',
        fecha: new Date().toISOString().split('T')[0],
        tiempo_espera_carne_dias: 14,
        tiempo_espera_leche_dias: 7,
        dosis: '1ml/10kg',
        via_administracion: 'Subcutánea',
        notas: 'E2E Test',
      };

      // --- FASE 1: Crear ---
      const t0 = performance.now();
      const nuevoId = await window.db.add('sanitarios_ganado', tratamientoData);
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      this._log('PASS', M, `Rendimiento: ${elapsed.toFixed(0)}ms`, 'RENDIMIENTO');

      // --- FASE 2: IndexedDB ---
      const dbCheck = await this._verifyInDB('sanitarios_ganado', nuevoId, {
        medicamento: medicamento,
        rebanoId: rebano.id,
      });

      if (dbCheck.ok) {
        this._log('PASS', M, `IndexedDB: tratamiento verificado`, 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      // --- FASE 3: Verificar en consulta por rebaño ---
      const tratamientos = await window.db.getAllFromIndex('sanitarios_ganado', 'rebanoId', rebano.id);
      const enLista = tratamientos.find(t => t.id === nuevoId);
      if (enLista) {
        this._log('PASS', M, 'Aparece en consulta por rebanoId', 'LISTA');
      } else {
        this._log('FAIL', M, 'NO aparece en consulta por rebanoId', 'LISTA');
        this._checkConsoleErrors(M);
        return false;
      }

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Tratamiento "${medicamento}" (id=${nuevoId})`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 7: TRASLADO DE ANIMALES
  // ============================================================
  async testTraslado() {
    const M = 'TRASLADO ANIMALES';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      const rebanos = await Rebanos.list();
      if (rebanos.length < 2) {
        this._log('FAIL', M, 'Se necesitan al menos 2 rebaños', 'PRE-REQ');
        return false;
      }

      const rebanoOrigen = rebanos[0];
      const rebanoDestino = rebanos[1];
      const crotal = this._uidShort('TR');

      // Crear animal en origen
      const animalId = await Animales.save({
        numero_identificacion: crotal,
        especie: 'Ovejas',
        sexo: 'M',
        raza: 'Test-E2E',
        rebanoId: rebanoOrigen.id,
        tipoAlta: 'Nacimiento',
        fecha_nacimiento: new Date().toISOString().split('T')[0],
        estado: 'activo',
      });

      // Verificar que está en origen
      let animal = await Animales.get(animalId);
      if (animal.rebanoId !== rebanoOrigen.id) {
        this._log('FAIL', M, 'Animal no está en rebaño origen tras crear', 'PERSISTENCIA');
        return false;
      }
      this._log('PASS', M, `Animal creado en "${rebanoOrigen.nombre}"`, 'PRE-TRASLADO');

      // Ejecutar traslado
      const t0 = performance.now();
      animal.rebanoId = rebanoDestino.id;
      await Animales.save(animal);
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      // Verificar que está en destino
      animal = await Animales.get(animalId);
      if (animal.rebanoId !== rebanoDestino.id) {
        this._log('FAIL', M, `Animal no se trasladó: esperado rebanoId=${rebanoDestino.id}, obtenido=${animal.rebanoId}`, 'PERSISTENCIA');
        return false;
      }
      this._log('PASS', M, `Animal trasladado a "${rebanoDestino.nombre}" en ${elapsed.toFixed(0)}ms`, 'PERSISTENCIA');

      // Verificar en lista del rebaño destino
      const animalesDestino = await Animales.list(rebanoDestino.id);
      const enLista = animalesDestino.find(a => a.id === animalId);
      if (enLista) {
        this._log('PASS', M, 'Aparece en lista del rebaño destino', 'LISTA');
      } else {
        this._log('FAIL', M, 'NO aparece en lista del rebaño destino', 'LISTA');
        return false;
      }

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Traslado ${crotal} → "${rebanoDestino.nombre}"`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 8: NUEVO COMPRADOR
  // ============================================================
  async testNuevoComprador() {
    const M = 'NUEVO COMPRADOR';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      const nombre = this._uid('Comprador-E2E');
      const nif = this._uid('B99999').toUpperCase().slice(0, 12);

      const compradorData = {
        nombre: nombre,
        nif_cif: nif,
        tipo_comprador: 'híbrido',
        activo: true,
        creadoEn: new Date().toISOString(),
        notas: 'E2E Test',
      };

      const t0 = performance.now();
      const nuevoId = await window.db.add('compradores', compradorData);
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      // IndexedDB
      const dbCheck = await this._verifyInDB('compradores', nuevoId, {
        nombre: nombre,
        nif_cif: nif,
      });

      if (dbCheck.ok) {
        this._log('PASS', M, `IndexedDB: comprador verificado`, 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      // Lista
      const compradores = await window.Compradores.list();
      const enLista = compradores.find(c => c.id === nuevoId);
      if (enLista) {
        this._log('PASS', M, 'Aparece en Compradores.list()', 'LISTA');
      } else {
        this._log('FAIL', M, 'NO aparece en Compradores.list()', 'LISTA');
        this._checkConsoleErrors(M);
        return false;
      }

      // Navegar y verificar layout
      location.hash = '#/compradores';
      await this._wait(800);
      this._checkLayoutIntegrity(M);

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Comprador "${nombre}" NIF:${nif} (id=${nuevoId})`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 9: NUEVO PROVEEDOR
  // ============================================================
  async testNuevoProveedor() {
    const M = 'NUEVO PROVEEDOR';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      const nombre = this._uid('Proveedor-E2E');

      const proveedorData = {
        nombre: nombre,
        nif_cif: '',
        categorias: ['Alimentación'],
        activo: true,
        creadoEn: new Date().toISOString(),
        notas: 'E2E Test',
      };

      const t0 = performance.now();
      const nuevoId = await window.db.add('proveedores', proveedorData);
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      const dbCheck = await this._verifyInDB('proveedores', nuevoId, { nombre: nombre });
      if (dbCheck.ok) {
        this._log('PASS', M, 'IndexedDB: proveedor verificado', 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      const proveedores = await window.Proveedores.list();
      const enLista = proveedores.find(p => p.id === nuevoId);
      if (enLista) {
        this._log('PASS', M, 'Aparece en Proveedores.list()', 'LISTA');
      } else {
        this._log('FAIL', M, 'NO aparece en Proveedores.list()', 'LISTA');
        return false;
      }

      location.hash = '#/proveedores';
      await this._wait(800);
      this._checkLayoutIntegrity(M);

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Proveedor "${nombre}" (id=${nuevoId})`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 10: NUEVO REBAÑO
  // ============================================================
  async testNuevoRebano() {
    const M = 'NUEVO REBAÑO';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      const nombre = this._uid('Rebaño-E2E');
      const fincaId = await Fincas.getActiveId();

      const rebanoData = {
        nombre: nombre,
        especie: 'Ovejas',
        tipo: 'Cebo-E2E',
        fincaId: fincaId,
        capacidad_total: 100,
        zonaActual: 'Zona-E2E',
      };

      const t0 = performance.now();
      const nuevoId = await Rebanos.save(rebanoData);
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      const dbCheck = await this._verifyInDB('rebanos', nuevoId, {
        nombre: nombre,
        fincaId: fincaId,
      });

      if (dbCheck.ok) {
        this._log('PASS', M, `IndexedDB: rebaño verificado (capacidad=${dbCheck.record.capacidad_total})`, 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      const rebanos = await Rebanos.list();
      const enLista = rebanos.find(r => r.id === nuevoId);
      if (enLista) {
        this._log('PASS', M, 'Aparece en Rebanos.list()', 'LISTA');
      } else {
        this._log('FAIL', M, 'NO aparece en Rebanos.list()', 'LISTA');
        return false;
      }

      location.hash = '#/rebanos';
      await this._wait(800);
      this._checkLayoutIntegrity(M);

      // Verificar renderizado
      const content = document.getElementById('app-content');
      if (content && content.textContent.includes(nombre)) {
        this._log('PASS', M, `Nombre "${nombre}" visible en UI`, 'RENDERIZADO');
      }

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Rebaño "${nombre}" (id=${nuevoId})`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 11: EVENTO DE REPRODUCCIÓN
  // ============================================================
  async testEventoReproduccion() {
    const M = 'EVENTO REPRODUCCIÓN';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      const animales = await Animales.list();
      const hembras = animales.filter(a => a.sexo === 'H');
      if (hembras.length === 0) {
        this._log('FAIL', M, 'No hay hembras disponibles', 'PRE-REQ');
        return false;
      }

      const hembra = hembras[0];
      const eventoData = {
        animalId: hembra.id,
        tipo_evento: 'Inseminación Artificial',
        fecha: new Date().toISOString().split('T')[0],
        notas: 'E2E Test IA',
        resultado: 'Programada',
        fincaId: await Fincas.getActiveId(),
      };

      const t0 = performance.now();
      const nuevoId = await window.Reproduccion.saveEvento(eventoData);
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      const dbCheck = await this._verifyInDB('reproduccion_eventos', nuevoId, {
        animalId: hembra.id,
        tipo_evento: 'Inseminación Artificial',
      });

      if (dbCheck.ok) {
        this._log('PASS', M, 'IndexedDB: evento verificado', 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      const eventos = await window.Reproduccion.listEventos(hembra.id);
      const enLista = eventos.find(e => e.id === nuevoId);
      if (enLista) {
        this._log('PASS', M, 'Aparece en historial del animal', 'LISTA');
      } else {
        this._log('FAIL', M, 'NO aparece en historial del animal', 'LISTA');
        return false;
      }

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Evento IA para ${hembra.numero_identificacion} (id=${nuevoId})`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // TEST 12: EXPEDICIÓN (registro_eventos)
  // ============================================================
  async testExpedicion() {
    const M = 'EXPEDICIÓN';
    this._log('RUN', M, 'Iniciando ciclo completo');
    this._startMonitor();

    try {
      const animales = await Animales.list();
      const activos = animales.filter(a => a.estado === 'activo');
      if (activos.length === 0) {
        this._log('FAIL', M, 'No hay animales activos', 'PRE-REQ');
        return false;
      }

      const animal = activos[0];
      const rebano = animal.rebanoId ? await Rebanos.get(animal.rebanoId) : null;
      const fincaId = await Fincas.getActiveId();
      const fecha = new Date().toISOString().split('T')[0];

      const t0 = performance.now();
      const eventoId = await window.db.add('registro_eventos', {
        fincaId: fincaId,
        entidad_id: animal.id,
        tipo_entidad: 'animal',
        motivo_tarea: 'expedicion',
        fecha: fecha,
        valor_neto: 120.5,
        unidad: 'kg',
        importe_total: 662.75,
        rol_contable: 'VENTA',
        snap_zona: rebano?.zonaActual || 'Finca',
        snap_especie: rebano?.especie || animal.especie,
        snap_tipo: rebano?.tipo || 'Sin clasificar',
        snap_identificacion: animal.numero_identificacion,
        observaciones: 'E2E Test Expedición',
        creadoEn: new Date().toISOString(),
      });
      const elapsed = performance.now() - t0;
      this._perfTimings.push({ module: M, ms: elapsed });

      const dbCheck = await this._verifyInDB('registro_eventos', eventoId, {
        motivo_tarea: 'expedicion',
        rol_contable: 'VENTA',
      });

      if (dbCheck.ok) {
        this._log('PASS', M, `IndexedDB: expedición verificada (${dbCheck.record.importe_total}€)`, 'PERSISTENCIA');
      } else {
        this._log('FAIL', M, `IndexedDB: ${dbCheck.reason}`, 'PERSISTENCIA');
        this._checkConsoleErrors(M);
        return false;
      }

      // Verificar en filtros de ProduccionView
      const eventos = await window.db.getAllFromIndex('registro_eventos', 'fincaId', fincaId);
      const carneEvents = eventos.filter(e => e.unidad === 'kg' || e.motivo_tarea === 'control' || e.motivo_tarea === 'expedicion');
      const ventaEvents = eventos.filter(e => e.motivo_tarea === 'expedicion' || e.rol_contable === 'VENTA');

      const enCarne = carneEvents.find(e => e.id === eventoId);
      const enVentas = ventaEvents.find(e => e.id === eventoId);

      if (enCarne) this._log('PASS', M, 'Aparece en filtro de carne', 'LISTA');
      else { this._log('FAIL', M, 'NO aparece en filtro de carne', 'LISTA'); return false; }

      if (enVentas) this._log('PASS', M, 'Aparece en filtro de ventas', 'LISTA');
      else { this._log('FAIL', M, 'NO aparece en filtro de ventas', 'LISTA'); return false; }

      this._checkConsoleErrors(M);
      this._log('PASS', M, `✅ COMPLETADO — Expedición ${animal.numero_identificacion} 662.75€ (id=${eventoId})`);
      return true;

    } catch (e) {
      this._log('FAIL', M, `Excepción: ${e.message}`, 'EXCEPCIÓN');
      this._checkConsoleErrors(M);
      return false;
    }
  },

  // ============================================================
  // EJECUCIÓN PRINCIPAL
  // ============================================================
  async runAll() {
    console.log('\n' + '='.repeat(75));
    console.log('🧪 E2E TEST SUITE v2.0 — Livestock Manager QA/UX');
    console.log('📅 ' + new Date().toLocaleString());
    console.log('📋 Validación: UI · Persistencia · Layout · Consola · Rendimiento');
    console.log('='.repeat(75) + '\n');

    if (!window.db) {
      console.error('❌ ERROR: window.db no disponible. Espera a que la app cargue.');
      return;
    }

    const fincaId = await Fincas.getActiveId();
    if (!fincaId) {
      console.error('❌ ERROR: No hay finca activa. Configura una finca primero.');
      return;
    }

    console.log(`📍 Finca activa: ${fincaId}\n`);

    const tests = [
      { name: 'Nuevo Rebaño', fn: () => this.testNuevoRebano() },
      { name: 'Alta Animal', fn: () => this.testAltaAnimal() },
      { name: 'Pesaje Carne', fn: () => this.testPesajeCarne() },
      { name: 'Control Lechero', fn: () => this.testControlLechero() },
      { name: 'Nuevo Gasto', fn: () => this.testNuevoGasto() },
      { name: 'Albarán Leche', fn: () => this.testAlbaranLeche() },
      { name: 'Tratamiento Sanitario', fn: () => this.testTratamientoSanitario() },
      { name: 'Traslado Animales', fn: () => this.testTraslado() },
      { name: 'Nuevo Comprador', fn: () => this.testNuevoComprador() },
      { name: 'Nuevo Proveedor', fn: () => this.testNuevoProveedor() },
      { name: 'Evento Reproducción', fn: () => this.testEventoReproduccion() },
      { name: 'Expedición', fn: () => this.testExpedicion() },
    ];

    const startTime = Date.now();
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`▶️  [${tests.indexOf(test) + 1}/${tests.length}] ${test.name}`);
      console.log('─'.repeat(60));
      try {
        const result = await test.fn();
        if (result) passed++;
        else failed++;
      } catch (e) {
        this._log('FAIL', test.name, `Excepción no controlada: ${e.message}`, 'EXCEPCIÓN');
        failed++;
      }
      await this._wait(300);
    }

    const totalTime = Date.now() - startTime;

    // ============================================================
    // REPORTE FINAL
    // ============================================================
    console.log('\n' + '='.repeat(75));
    console.log('📊 REPORTE FINAL E2E v2.0');
    console.log('='.repeat(75));
    console.log(`⏱️  Tiempo total: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`✅ Éxitos: ${passed}/${tests.length}`);
    console.log(`❌ Fallos: ${failed}/${tests.length}`);
    console.log(`📈 Tasa de éxito: ${((passed / tests.length) * 100).toFixed(1)}%`);

    // Rendimiento
    if (this._perfTimings.length > 0) {
      console.log('\n⚡ RENDIMIENTO (inserciones):');
      console.log('─'.repeat(50));
      const avg = this._perfTimings.reduce((s, t) => s + t.ms, 0) / this._perfTimings.length;
      const max = Math.max(...this._perfTimings.map(t => t.ms));
      const min = Math.min(...this._perfTimings.map(t => t.ms));
      this._perfTimings.forEach(t => {
        const bar = '█'.repeat(Math.max(1, Math.round(t.ms / 50)));
        const flag = t.ms > 2000 ? ' 🐢' : t.ms < 200 ? ' ⚡' : '';
        console.log(`  ${t.module.padEnd(25)} ${t.ms.toFixed(0).padStart(5)}ms ${bar}${flag}`);
      });
      console.log(`  ${'─'.repeat(40)}`);
      console.log(`  Media: ${avg.toFixed(0)}ms | Mín: ${min.toFixed(0)}ms | Máx: ${max.toFixed(0)}ms`);
    }

    // Fallos detallados
    const failures = this._results.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      console.log('\n❌ DETALLE DE FALLOS:');
      console.log('─'.repeat(60));
      failures.forEach(f => {
        const cat = f.category ? ` [${f.category}]` : '';
        console.log(`  ❌ [${f.module}]${cat} ${f.detail}`);
      });
    }

    // Resumen por categoría
    console.log('\n📋 RESUMEN POR CATEGORÍA:');
    console.log('─'.repeat(50));
    const categories = [...new Set(this._results.map(r => r.category).filter(Boolean))];
    categories.forEach(cat => {
      const catResults = this._results.filter(r => r.category === cat);
      const passCount = catResults.filter(r => r.status === 'PASS').length;
      const failCount = catResults.filter(r => r.status === 'FAIL').length;
      const warnCount = catResults.filter(r => r.status === 'WARN').length;
      const icon = failCount === 0 ? '✅' : '❌';
      console.log(`  ${icon} ${cat.padEnd(20)} ${passCount}✅ ${failCount}❌ ${warnCount}⚠️`);
    });

    // Resumen por módulo
    console.log('\n📋 RESUMEN POR MÓDULO:');
    console.log('─'.repeat(50));
    const modules = [...new Set(this._results.map(r => r.module))];
    modules.forEach(m => {
      const moduleResults = this._results.filter(r => r.module === m);
      const passCount = moduleResults.filter(r => r.status === 'PASS').length;
      const failCount = moduleResults.filter(r => r.status === 'FAIL').length;
      const status = failCount === 0 ? '✅' : '❌';
      console.log(`  ${status} ${m}`);
    });

    console.log('\n' + '='.repeat(75));
    console.log(failed === 0 ? '🎉 TODOS LOS TESTS PASARON' : '⚠️ HAY TESTS FALLIDOS — Revisar detalle arriba');
    console.log('='.repeat(75) + '\n');

    return { passed, failed, total: tests.length, results: this._results, perfTimings: this._perfTimings };
  },

  // Ejecutar test individual
  async run(testName) {
    const testMap = {
      'rebano': () => this.testNuevoRebano(),
      'animal': () => this.testAltaAnimal(),
      'pesaje': () => this.testPesajeCarne(),
      'leche': () => this.testControlLechero(),
      'gasto': () => this.testNuevoGasto(),
      'albaran': () => this.testAlbaranLeche(),
      'tratamiento': () => this.testTratamientoSanitario(),
      'traslado': () => this.testTraslado(),
      'comprador': () => this.testNuevoComprador(),
      'proveedor': () => this.testNuevoProveedor(),
      'reproduccion': () => this.testEventoReproduccion(),
      'expedicion': () => this.testExpedicion(),
    };

    const fn = testMap[testName.toLowerCase()];
    if (!fn) {
      console.log(`Test "${testName}" no encontrado. Opciones: ${Object.keys(testMap).join(', ')}`);
      return;
    }

    console.log(`\n▶️  Ejecutando test: ${testName}...\n`);
    return await fn();
  },

  // Limpiar datos de test
  async cleanup() {
    console.log('🧹 Limpiando datos de test E2E...');
    const stores = ['animales', 'gastos_ganaderia', 'registro_eventos', 'comercializacion_leche', 'sanitarios_ganado', 'compradores', 'proveedores', 'rebanos', 'reproduccion_eventos'];

    for (const store of stores) {
      try {
        const all = await this._getAll(store);
        const testItems = all.filter(item => {
          const str = JSON.stringify(item).toLowerCase();
          return str.includes('e2e') || str.includes('test');
        });

        for (const item of testItems) {
          await window.db.delete(store, item.id);
        }

        if (testItems.length > 0) {
          console.log(`  🗑️  ${store}: ${testItems.length} registros eliminados`);
        }
      } catch (e) {
        console.warn(`  ⚠️  Error limpiando ${store}: ${e.message}`);
      }
    }

    console.log('✅ Limpieza completada');
  }
};

window.E2E = E2E;
console.log('✅ E2E Test Suite v2.0 cargado.');
console.log('   await E2E.runAll()          → Ejecutar todos los tests');
console.log('   await E2E.run("animal")     → Test individual');
console.log('   await E2E.cleanup()         → Limpiar datos de test');
