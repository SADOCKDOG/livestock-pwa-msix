/**
 * QA Diagnóstico rápido — Verificar qué falta antes de ejecutar tests
 * Uso: window.QADiagnostico.run()
 */

window.QADiagnostico = {
  async run() {
    console.clear();
    console.log('%c╔════════════════════════════════════════╗', 'color: #10b981; font-weight: bold;');
    console.log('%c║  QA DIAGNÓSTICO RÁPIDO                ║', 'color: #10b981; font-weight: bold;');
    console.log('%c╚════════════════════════════════════════╝', 'color: #10b981; font-weight: bold;');

    let allGood = true;

    // 1. Verificar módulos
    console.log('\n✓ Verificando módulos cargados...');
    const modules = [
      'Fincas', 'Rebanos', 'Animales', 'Compradores', 'Proveedores',
      'Transportistas', 'Contratos', 'Sanitarios', 'Reproduccion', 'Gastos'
    ];

    modules.forEach(mod => {
      if (window[mod]) {
        console.log(`  ✅ ${mod} cargado`);
      } else {
        console.log(`  ❌ ${mod} NO cargado`);
        allGood = false;
      }
    });

    // 2. Verificar IndexedDB / MockDB Fallback
    console.log('\n✓ Verificando Almacenamiento...');
    if (window.db && window.db.constructor.name === 'InMemoryMockDB') {
      console.log('  ✅ Usando Base de Datos en Memoria (InMemoryMockDB) como fallback activo');
    } else {
      try {
        if (typeof indexedDB === 'undefined' || !indexedDB.databases) {
          console.log('  ⚠️  La API indexedDB.databases no está disponible en este contexto. Usando almacenamiento limitado.');
        } else {
          const dbs = await indexedDB.databases();
          const livestockDB = dbs.find(db => db.name === 'Livestock-Manager' || db.name === 'LivestockDB');
          if (livestockDB) {
            console.log(`  ✅ IndexedDB "${livestockDB.name}" existe`);
          } else {
            console.log('  ⚠️  Base de datos no detectada por indexedDB.databases, se creará al inicializar.');
          }
        }
      } catch (e) {
        console.log(`  ⚠️  Nota de acceso IndexedDB: ${e.message} (Esperado en Sandbox/Open Design)`);
      }
    }

    // 3. Verificar finca activa
    console.log('\n✓ Verificando finca activa...');
    try {
      const fincaId = await Fincas.getActiveId();
      if (fincaId) {
        const finca = await Fincas.getActive();
        console.log(`  ✅ Finca activa: ${finca.nombre} (ID: ${fincaId})`);
      } else {
        console.log(`  ⚠️  No hay finca activa`);
        console.log(`      → Ve a Ajustes → Cargar Demo CHAMORRO`);
        allGood = false;
      }
    } catch (e) {
      console.log(`  ❌ Error al obtener finca: ${e.message}`);
      allGood = false;
    }

    // 4. Verificar datos en DB
    console.log('\n✓ Verificando datos en DB...');
    try {
      const [fincas, rebanos, animales, compradores] = await Promise.all([
        Fincas.list().catch(() => []),
        Rebanos.list().catch(() => []),
        Animales.list().catch(() => []),
        Compradores.list().catch(() => [])
      ]);

      console.log(`  • Fincas: ${fincas.length}`);
      console.log(`  • Rebaños: ${rebanos.length}`);
      console.log(`  • Animales: ${animales.length}`);
      console.log(`  • Compradores: ${compradores.length}`);

      if (fincas.length === 0 || rebanos.length === 0 || animales.length === 0) {
        console.log(`  ⚠️  Datos incompletos — carga la demo nuevamente`);
        allGood = false;
      } else {
        console.log(`  ✅ Datos cargados correctamente`);
      }
    } catch (e) {
      console.log(`  ❌ Error al leer datos: ${e.message}`);
      allGood = false;
    }

    // 5. Verificar QA Test Runner
    console.log('\n✓ Verificando QA Test Runner...');
    if (window.QATestRunner) {
      console.log(`  ✅ QATestRunner cargado`);
    } else {
      console.log(`  ❌ QATestRunner NO cargado`);
      allGood = false;
    }

    // Resumen
    console.log('\n╔════════════════════════════════════════╗');
    if (allGood) {
      console.log('%c║  ✅ TODO LISTO PARA TESTS              ║', 'color: #10b981; font-weight: bold;');
      console.log('║  Ejecuta: window.QATestRunner.runAll() ║');
    } else {
      console.log('%c║  ⚠️  PROBLEMAS DETECTADOS             ║', 'color: #f59e0b; font-weight: bold;');
      console.log('║  Sigue las indicaciones arriba         ║');
    }
    console.log('╚════════════════════════════════════════╝');

    return allGood;
  }
};

console.log('✅ QA Diagnóstico cargado. Usa: window.QADiagnostico.run()');
