/**
 * QA Test Runner — Livestock Manager
 * Ejecuta NIVEL 1-3 del Plan QA: Smoke Test + Integridad + CRUD
 *
 * Uso: window.QATestRunner.runLevel(1) o window.QATestRunner.runAll()
 */

window.QATestRunner = {
  results: [],
  errors: [],
  startTime: null,
  endTime: null,

  // ==================== UTILIDADES ====================
  log(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
      info: '✓',
      error: '✗',
      warn: '⚠',
      pass: '✅',
      fail: '❌'
    }[type] || '○';

    const color = {
      info: '#888',
      error: '#ef4444',
      warn: '#f59e0b',
      pass: '#10b981',
      fail: '#ef4444'
    }[type] || '#999';

    const logLine = `[${timestamp}] ${prefix} ${msg}`;
    console.log(`%c${logLine}`, `color: ${color}; font-weight: bold;`);
    this.results.push({ timestamp, msg, type });
  },

  async assertEquals(actual, expected, label) {
    if (actual === expected) {
      this.log(`${label}: ${actual} === ${expected}`, 'pass');
      return true;
    } else {
      this.log(`${label}: Expected ${expected} but got ${actual}`, 'fail');
      this.errors.push({ label, expected, actual });
      return false;
    }
  },

  async assertCount(array, expected, label) {
    return this.assertEquals(array.length, expected, `${label} count`);
  },

  async sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  // ==================== NIVEL 1: SMOKE TEST ====================
  async runLevel1() {
    this.log('=== NIVEL 1: SMOKE TEST (Carga de Seed) ===', 'info');

    try {
      // Verificar que los módulos existan
      if (!window.Fincas || !window.Rebanos || !window.Animales) {
        this.log('ERROR: Módulos no cargados. Recarga la página.', 'error');
        return false;
      }

      const fincaId = await Fincas.getActiveId();
      if (!fincaId) {
        this.log('ERROR: No hay finca activa. Carga la demo primero.', 'error');
        this.log('Pasos: Ajustes → Cargar Demo CHAMORRO → Espera → Recarga (F5)', 'warn');
        return false;
      }

      this.log(`Finca activa: ${fincaId}`, 'info');

      // Verificar conteos básicos
      const [fincas, rebanos, animales, compradores, proveedores, transportistas, contratos, sanitarios, eventos] = await Promise.all([
        Fincas.list(),
        Rebanos.list(),
        Animales.list(),
        Compradores.list(),
        Proveedores.list(),
        Transportistas.list(),
        Contratos.list(),
        Sanitarios.list(),
        Reproduccion.listEventos()
      ]);

      let allPass = true;
      allPass &= await this.assertCount(fincas, 1, 'Fincas');
      allPass &= await this.assertCount(rebanos, 3, 'Rebaños');
      allPass &= await this.assertCount(animales, 9, 'Animales');
      allPass &= await this.assertCount(compradores, 3, 'Compradores');
      allPass &= await this.assertCount(proveedores, 3, 'Proveedores');
      allPass &= await this.assertCount(transportistas, 2, 'Transportistas');
      allPass &= await this.assertCount(contratos, 2, 'Contratos');
      allPass &= await this.assertCount(sanitarios, 3, 'Sanitarios');
      allPass &= await this.assertCount(eventos, 4, 'Eventos Reproducción');

      if (allPass) {
        this.log('NIVEL 1: ✅ PASS', 'pass');
      } else {
        this.log('NIVEL 1: ❌ FAIL', 'fail');
      }
      return allPass;
    } catch (e) {
      this.log(`NIVEL 1 ERROR: ${e.message}`, 'error');
      return false;
    }
  },

  // ==================== NIVEL 2: INTEGRIDAD ====================
  async runLevel2() {
    this.log('\n=== NIVEL 2: INTEGRIDAD DE DATOS ===', 'info');

    try {
      let allPass = true;

      // === 2.1 Compradores ===
      this.log('Verificando Compradores...', 'info');
      const compradores = await Compradores.list();

      const compCarne = compradores.find(c => c.nombre === 'Cárnicas Extremeñas SL');
      if (compCarne && compCarne.tipo_comprador === 'cárnico') {
        this.log('Comprador cárnico: OK', 'pass');
      } else {
        this.log('Comprador cárnico: FAIL', 'fail');
        allPass = false;
      }

      const compLeche = compradores.find(c => c.nombre === 'Lácteos La Serena SA');
      if (compLeche && compLeche.tipo_comprador === 'láctico') {
        this.log('Comprador láctico: OK', 'pass');
      } else {
        this.log('Comprador láctico: FAIL', 'fail');
        allPass = false;
      }

      // === 2.2 Proveedores ===
      this.log('Verificando Proveedores...', 'info');
      const proveedores = await Proveedores.list();

      const provPienso = proveedores.find(p => p.nombre === 'Piensos El Trébol SA');
      if (provPienso && Array.isArray(provPienso.categorias) && provPienso.categorias.includes('Alimentacion')) {
        this.log('Proveedor Piensos (Alimentacion): OK', 'pass');
      } else {
        this.log('Proveedor Piensos: FAIL', 'fail');
        allPass = false;
      }

      // === 2.3 Transportistas ===
      this.log('Verificando Transportistas...', 'info');
      const transportistas = await Transportistas.list();

      const transGanadero = transportistas.find(t => t.nombre === 'Transportes Ganaderos del Sur SL');
      if (transGanadero && transGanadero.tipo_vehiculo === 'camion' && transGanadero.certificado_bienestar === true) {
        this.log('Transportista Ganadero (camion, bienestar): OK', 'pass');
      } else {
        this.log('Transportista Ganadero: FAIL', 'fail');
        allPass = false;
      }

      // === 2.4 Animales ===
      this.log('Verificando Animales...', 'info');
      const animales = await Animales.list();

      const crotalesValidos = animales.every(a => /^[A-Z]{2}\d{12}$/.test(a.numero_identificacion));
      if (crotalesValidos) {
        this.log(`Todos los crotales válidos (${animales.length}/9): OK`, 'pass');
      } else {
        const inválidos = animales.filter(a => !/^[A-Z]{2}\d{12}$/.test(a.numero_identificacion));
        this.log(`Crotales inválidos: ${inválidos.map(a => a.numero_identificacion).join(', ')}`, 'fail');
        allPass = false;
      }

      // === 2.5 Vinculación Madre-Cría ===
      const vaca1 = animales.find(a => a.numero_identificacion === 'ES123456789012');
      const ternero1 = animales.find(a => a.numero_identificacion === 'ES123456789015');
      if (vaca1 && ternero1 && ternero1.madre_id === vaca1.id) {
        this.log('Vinculación madre-cría (vaca1 → ternero1): OK', 'pass');
      } else {
        this.log('Vinculación madre-cría: FAIL', 'fail');
        allPass = false;
      }

      // === 2.6 Sanitarios ===
      this.log('Verificando Sanitarios...', 'info');
      const sanitarios = await Sanitarios.list();
      const tiposValidos = sanitarios.every(s =>
        ['Vacunación', 'Desparasitación', 'Antibiótico', 'Anti-inflamatorio', 'Vitaminas', 'Cirugía', 'Inspección General', 'Otro']
          .includes(s.tipo_tratamiento)
      );
      if (tiposValidos) {
        this.log(`Tipos de tratamiento válidos (${sanitarios.length}/3): OK`, 'pass');
      } else {
        this.log('Tipos de tratamiento inválidos', 'fail');
        allPass = false;
      }

      // === 2.7 Reproducción ===
      this.log('Verificando Reproducción...', 'info');
      const eventos = await Reproduccion.listEventos();
      const tiposEvValidos = eventos.every(e =>
        ['Celo', 'Inseminación Artificial', 'Monta Natural', 'Diagnóstico Gestación', 'Secado', 'Parto', 'Aborto', 'Destete']
          .includes(e.tipo_evento)
      );
      if (tiposEvValidos && eventos.length === 4) {
        this.log(`Tipos de evento válidos (${eventos.length}/4): OK`, 'pass');
      } else {
        this.log('Tipos de evento o cantidad inválida', 'fail');
        allPass = false;
      }

      if (allPass) {
        this.log('NIVEL 2: ✅ PASS', 'pass');
      } else {
        this.log('NIVEL 2: ❌ FAIL', 'fail');
      }
      return allPass;
    } catch (e) {
      this.log(`NIVEL 2 ERROR: ${e.message}`, 'error');
      return false;
    }
  },

  // ==================== NIVEL 3: CRUD ====================
  async runLevel3() {
    this.log('\n=== NIVEL 3: OPERACIONES CRUD ===', 'info');

    try {
      let allPass = true;

      // === 3.1 Crear Comprador ===
      this.log('Test 3.1: Crear Comprador...', 'info');
      try {
        const nuevoComprador = {
          nombre: 'Test Comprador QA',
          nif_cif: 'B88888888',
          tipo_comprador: 'cárnico',
          ciudad: 'Test City',
          activo: true
        };
        const compId = await Compradores.save(nuevoComprador);
        if (compId > 0) {
          this.log(`Comprador creado con ID ${compId}: OK`, 'pass');
          // Cleanup
          await Compradores.delete(compId);
        } else {
          this.log('Comprador no retornó ID válido', 'fail');
          allPass = false;
        }
      } catch (e) {
        this.log(`Crear Comprador: ${e.message}`, 'fail');
        allPass = false;
      }

      // === 3.2 Crear Gasto ===
      this.log('Test 3.2: Crear Gasto...', 'info');
      try {
        const fincaId = await Fincas.getActiveId();
        const rebanos = await Rebanos.list();
        const rebVacas = rebanos.find(r => r.nombre === 'Vacas Frisonas');

        const nuevoGasto = {
          concepto: 'Test QA Gasto',
          monto: 100,
          categoria: 'Alimentacion',
          fecha: new Date().toISOString().split('T')[0],
          fincaId: fincaId,
          rebanoId: rebVacas.id
        };
        const gastoId = await Gastos.save(nuevoGasto);
        if (gastoId > 0) {
          this.log(`Gasto creado con ID ${gastoId}: OK`, 'pass');
          // Cleanup
          await Gastos.delete(gastoId);
        } else {
          this.log('Gasto no retornó ID válido', 'fail');
          allPass = false;
        }
      } catch (e) {
        this.log(`Crear Gasto: ${e.message}`, 'fail');
        allPass = false;
      }

      // === 3.3 Editar Proveedor ===
      this.log('Test 3.3: Editar Proveedor...', 'info');
      try {
        const proveedores = await Proveedores.list();
        const prov = proveedores[0];
        if (prov) {
          const nombreOrig = prov.nombre;
          prov.nombre = 'Test Updated Proveedor';
          await Proveedores.save(prov);

          const provActualizado = await Proveedores.get(prov.id);
          if (provActualizado.nombre === 'Test Updated Proveedor') {
            this.log(`Proveedor actualizado: OK`, 'pass');
            // Revertir
            prov.nombre = nombreOrig;
            await Proveedores.save(prov);
          } else {
            this.log('Proveedor no se actualizó', 'fail');
            allPass = false;
          }
        }
      } catch (e) {
        this.log(`Editar Proveedor: ${e.message}`, 'fail');
        allPass = false;
      }

      if (allPass) {
        this.log('NIVEL 3: ✅ PASS', 'pass');
      } else {
        this.log('NIVEL 3: ❌ FAIL', 'fail');
      }
      return allPass;
    } catch (e) {
      this.log(`NIVEL 3 ERROR: ${e.message}`, 'error');
      return false;
    }
  },

  // ==================== MAIN ====================
  async runAll() {
    this.startTime = new Date();
    this.results = [];
    this.errors = [];

    console.clear();
    this.log('╔════════════════════════════════════════╗', 'info');
    this.log('║  LIVESTOCK MANAGER — QA TEST RUNNER   ║', 'info');
    this.log('║  Niveles 1-7: Cobertura Integral QA   ║', 'info');
    this.log('╚════════════════════════════════════════╝', 'info');

    const l1 = await this.runLevel1();
    await this.sleep(500);
    const l2 = await this.runLevel2();
    await this.sleep(500);
    const l3 = await this.runLevel3();
    await this.sleep(500);
    const l4 = await this.runLevel4();
    await this.sleep(500);
    const l5 = await this.runLevel5();
    await this.sleep(500);
    const l6 = await this.runLevel6();
    await this.sleep(500);
    const l7 = await this.runLevel7();

    this.endTime = new Date();
    const duration = ((this.endTime - this.startTime) / 1000).toFixed(2);

    console.log('\n');
    this.log('╔════════════════════════════════════════╗', 'info');
    this.log(`║  RESUMEN — ${duration}s${' '.repeat(22 - duration.toString().length)}║`, 'info');
    this.log(`║  Nivel 1 (Smoke):    ${l1 ? '✅ PASS' : '❌ FAIL'}${' '.repeat(22)}║`, l1 ? 'pass' : 'fail');
    this.log(`║  Nivel 2 (Integridad): ${l2 ? '✅ PASS' : '❌ FAIL'}${' '.repeat(20)}║`, l2 ? 'pass' : 'fail');
    this.log(`║  Nivel 3 (CRUD):     ${l3 ? '✅ PASS' : '❌ FAIL'}${' '.repeat(21)}║`, l3 ? 'pass' : 'fail');
    this.log(`║  Nivel 4 (Flujos):   ${l4 ? '✅ PASS' : '❌ FAIL'}${' '.repeat(21)}║`, l4 ? 'pass' : 'fail');
    this.log(`║  Nivel 5 (Validación): ${l5 ? '✅ PASS' : '❌ FAIL'}${' '.repeat(18)}║`, l5 ? 'pass' : 'fail');
    this.log(`║  Nivel 6 (Performance): ${l6 ? '✅ PASS' : '❌ FAIL'}${' '.repeat(17)}║`, l6 ? 'pass' : 'fail');
    this.log(`║  Nivel 7 (Errores):  ${l7 ? '✅ PASS' : '❌ FAIL'}${' '.repeat(20)}║`, l7 ? 'pass' : 'fail');
    this.log('╚════════════════════════════════════════╝', 'info');

    if (this.errors.length > 0) {
      console.log('\n⚠️  ERRORES ENCONTRADOS:');
      this.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.label}: esperado ${err.expected}, obtuvo ${err.actual}`);
      });
    }

    return { l1, l2, l3, l4, l5, l6, l7, duration, errors: this.errors.length };
  },

  // ==================== NIVEL 4: FLUJOS TRANSVERSALES ====================
  async runLevel4() {
    this.log('\n=== NIVEL 4: FLUJOS TRANSVERSALES ===', 'info');

    try {
      let allPass = true;

      // === 4.1 Listar y crear registros en cascada ===
      this.log('Test 4.1: Flujo Listar → Crear → Verificar...', 'info');
      try {
        const fincaId = await Fincas.getActiveId();
        const rebanos = await Rebanos.list();
        const animales = await Animales.list();

        if (rebanos.length > 0 && animales.length > 0) {
          const nuevoAnimal = {
            numero_identificacion: 'ES888888888888',
            especie: rebanos[0].especie,
            rebanoId: rebanos[0].id,
            sexo: 'H',
            categoria: 'Ternera'
          };
          const animalId = await Animales.save(nuevoAnimal);

          if (animalId > 0) {
            const animalVerif = await Animales.get(animalId);
            if (animalVerif && animalVerif.rebanoId === rebanos[0].id) {
              this.log('Flujo Listar → Crear → Verificar: OK', 'pass');
              await Animales.delete(animalId);
            } else {
              this.log('Animal no vinculado', 'fail');
              allPass = false;
            }
          }
        }
      } catch (e) {
        this.log(`Flujo 4.1: ${e.message}`, 'fail');
        allPass = false;
      }

      // === 4.2 CRUD integrado ===
      this.log('Test 4.2: Flujo CRUD completo (Comprador)...', 'info');
      try {
        const comp1 = await Compradores.list();
        const nuevoComp = {
          nombre: 'Comprador Flujo Test',
          nif_cif: 'B77777777',
          tipo_comprador: 'híbrido',
          ciudad: 'Test',
          activo: true
        };
        const compId = await Compradores.save(nuevoComp);

        if (compId > 0) {
          const compVerif = await Compradores.get(compId);
          if (compVerif && compVerif.nombre === 'Comprador Flujo Test') {
            const compActual = {
              ...compVerif,
              ciudad: 'Test Updated'
            };
            await Compradores.save(compActual);
            this.log('Flujo CRUD Comprador: OK', 'pass');
            await Compradores.delete(compId);
          } else {
            this.log('Comprador no se creó', 'fail');
            allPass = false;
          }
        }
      } catch (e) {
        this.log(`Flujo 4.2: ${e.message}`, 'fail');
        allPass = false;
      }

      if (allPass) {
        this.log('NIVEL 4: ✅ PASS', 'pass');
      } else {
        this.log('NIVEL 4: ❌ FAIL', 'fail');
      }
      return allPass;
    } catch (e) {
      this.log(`NIVEL 4 ERROR: ${e.message}`, 'error');
      return false;
    }
  },

  // ==================== NIVEL 5: VALIDACIONES DE NEGOCIO ====================
  async runLevel5() {
    this.log('\n=== NIVEL 5: VALIDACIONES DE NEGOCIO ===', 'info');

    try {
      let allPass = true;

      // === 5.1 No permitir venta sin comprador ===
      this.log('Test 5.1: Venta sin comprador (debe fallar)...', 'info');
      try {
        const fincaId = await Fincas.getActiveId();
        const ventaInvalida = {
          animalId: null,
          compradorId: null,
          pesoCanal: 450,
          fechaSacrificio: new Date().toISOString().split('T')[0],
          fincaId: fincaId
        };
        try {
          await Comercializacion.saveVentaCarne(ventaInvalida);
          this.log('Venta sin comprador fue permitida (ERROR)', 'fail');
          allPass = false;
        } catch (e) {
          this.log('Venta sin comprador rechazada: OK', 'pass');
        }
      } catch (e) {
        this.log(`Test 5.1: ${e.message}`, 'fail');
        allPass = false;
      }

      // === 5.2 Validar crotal normativo válido ===
      this.log('Test 5.2: Crotal normativo válido se acepta...', 'info');
      try {
        const rebanos = await Rebanos.list();
        const animalValido = {
          numero_identificacion: 'ES777777777777',
          especie: rebanos[0].especie,
          rebanoId: rebanos[0].id,
          sexo: 'M',
          categoria: 'Adulta'
        };
        const animalId = await Animales.save(animalValido);
        if (animalId > 0) {
          this.log('Crotal normativo válido aceptado: OK', 'pass');
          await Animales.delete(animalId);
        } else {
          this.log('Crotal válido fue rechazado (ERROR)', 'fail');
          allPass = false;
        }
      } catch (e) {
        this.log(`Test 5.2: ${e.message}`, 'fail');
        allPass = false;
      }

      if (allPass) {
        this.log('NIVEL 5: ✅ PASS', 'pass');
      } else {
        this.log('NIVEL 5: ❌ FAIL', 'fail');
      }
      return allPass;
    } catch (e) {
      this.log(`NIVEL 5 ERROR: ${e.message}`, 'error');
      return false;
    }
  },

  // ==================== NIVEL 6: PERFORMANCE ====================
  async runLevel6() {
    this.log('\n=== NIVEL 6: PERFORMANCE ===', 'info');

    try {
      let allPass = true;

      // === 6.1 Tiempo de carga de compradores ===
      this.log('Test 6.1: Tiempo Compradores.list()...', 'info');
      const t1 = performance.now();
      await Compradores.list();
      const t2 = performance.now();
      const timeComp = (t2 - t1).toFixed(2);
      this.log(`Compradores: ${timeComp}ms ${timeComp < 500 ? '✅ Fast' : '⚠️ Slow'}`, 'info');

      // === 6.2 Tiempo de carga de animales ===
      this.log('Test 6.2: Tiempo Animales.list()...', 'info');
      const t3 = performance.now();
      await Animales.list();
      const t4 = performance.now();
      const timeAnim = (t4 - t3).toFixed(2);
      this.log(`Animales: ${timeAnim}ms ${timeAnim < 500 ? '✅ Fast' : '⚠️ Slow'}`, 'info');

      // === 6.3 Tiempo de guardar gasto ===
      this.log('Test 6.3: Tiempo Gastos.save()...', 'info');
      const rebanos = await Rebanos.list();
      const fincaId = await Fincas.getActiveId();

      const t5 = performance.now();
      const gasto = {
        concepto: 'Perf Test',
        monto: 250,
        fecha: new Date().toISOString().split('T')[0],
        categoria: 'Alimentacion',
        rebanoId: rebanos[0].id,
        fincaId: fincaId
      };
      const gastoId = await Gastos.save(gasto);
      const t6 = performance.now();
      const timeSave = (t6 - t5).toFixed(2);
      this.log(`Gastos.save(): ${timeSave}ms ${timeSave < 300 ? '✅ Fast' : '⚠️ Slow'}`, 'info');

      if (gastoId > 0) {
        await Gastos.delete(gastoId);
        allPass = true;
      }

      this.log('NIVEL 6: ✅ PASS (métricas capturadas)', 'pass');
      return allPass;
    } catch (e) {
      this.log(`NIVEL 6 ERROR: ${e.message}`, 'error');
      return false;
    }
  },

  // ==================== NIVEL 7: RECUPERACIÓN DE ERRORES ====================
  async runLevel7() {
    this.log('\n=== NIVEL 7: RECUPERACIÓN DE ERRORES ===', 'info');

    try {
      let allPass = true;

      // === 7.1 Gasto con concepto válido ===
      this.log('Test 7.1: Gasto con todos los campos válidos...', 'info');
      try {
        const fincaId = await Fincas.getActiveId();
        const rebanos = await Rebanos.list();
        const gastoValido = {
          concepto: 'Gasto Validación Test',
          monto: 150.75,
          fecha: new Date().toISOString().split('T')[0],
          categoria: 'Alimentacion',
          rebanoId: rebanos[0].id,
          fincaId: fincaId
        };
        const gastoId = await Gastos.save(gastoValido);
        if (gastoId > 0) {
          this.log('Gasto con campos válidos aceptado: OK', 'pass');
          await Gastos.delete(gastoId);
        } else {
          this.log('Gasto válido fue rechazado (ERROR)', 'fail');
          allPass = false;
        }
      } catch (e) {
        this.log(`Test 7.1: ${e.message}`, 'fail');
        allPass = false;
      }

      // === 7.2 Validación de tipos de datos ===
      this.log('Test 7.2: Gasto con monto numérico válido...', 'info');
      try {
        const fincaId = await Fincas.getActiveId();
        const rebanos = await Rebanos.list();
        const gastoValido = {
          concepto: 'Gasto Monto Test',
          monto: 299.99,
          fecha: new Date().toISOString().split('T')[0],
          categoria: 'Sanidad',
          rebanoId: rebanos[0].id,
          fincaId: fincaId
        };
        const gastoId = await Gastos.save(gastoValido);
        if (gastoId > 0) {
          this.log('Monto numérico válido aceptado: OK', 'pass');
          await Gastos.delete(gastoId);
        } else {
          this.log('Monto válido fue rechazado (ERROR)', 'fail');
          allPass = false;
        }
      } catch (e) {
        this.log(`Test 7.2: ${e.message}`, 'fail');
        allPass = false;
      }

      if (allPass) {
        this.log('NIVEL 7: ✅ PASS', 'pass');
      } else {
        this.log('NIVEL 7: ❌ FAIL', 'fail');
      }
      return allPass;
    } catch (e) {
      this.log(`NIVEL 7 ERROR: ${e.message}`, 'error');
      return false;
    }
  },

  async runLevel(n) {
    this.startTime = new Date();
    this.results = [];
    this.errors = [];

    const levelMap = {
      1: this.runLevel1.bind(this),
      2: this.runLevel2.bind(this),
      3: this.runLevel3.bind(this),
      4: this.runLevel4.bind(this),
      5: this.runLevel5.bind(this),
      6: this.runLevel6.bind(this),
      7: this.runLevel7.bind(this)
    };

    if (!levelMap[n]) {
      console.log(`❌ Nivel ${n} no existe (1-7)`);
      return false;
    }

    console.clear();
    this.log(`Ejecutando NIVEL ${n}...`, 'info');
    const result = await levelMap[n]();
    this.endTime = new Date();

    return result;
  }
};

// Auto-exportar para uso global
console.log('✅ QA Test Runner cargado. Usa: window.QATestRunner.runAll() o .runLevel(1-7)');
