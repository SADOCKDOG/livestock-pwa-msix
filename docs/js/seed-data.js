/**
 * Datos demo "CHAMORRO" — Livestock Manager
 * Se carga BAJO DEMANDA desde el asistente de configuración
 * (botón "Cargar Demo CHAMORRO"). No se auto-ejecuta.
 *
 * NOTA: en este proyecto los módulos *.save() devuelven el ID (número),
 * no el objeto. Por eso aquí reconstruimos el objeto con
 * Object.assign({ id: idDevuelto }, definicion) para poder encadenar.
 */
(function () {
  'use strict';

  var DEMO_FINCA = {
    demo: true,
    nombre: 'Ganadería CHAMORRO (DEMO)',
    propietario: 'Familia Chamorro',
    direccion: 'Ctra. Almonte-El Rocío, Km 12',
    telefonoContacto: '+34 654 123 456',
    nif_cif: 'B12345678',
    email: 'demo.chamorro@example.com',
    rega: 'ES210050001234',
    cea: 'AN-21005-01',
    adsg_nombre: 'ADSG El Condado',
    adsg_codigo: 'ADSG-AN-21005',
    adsg_veterinario: 'Dr. Manuel Castillo',
    adsg_vet_colegiado: '21/1045',
    adsg_vet_nif: '44123456D',
    provincia: 'Huelva',
    municipio: 'Almonte',
    comunidad_autonoma: 'andalucia',
    tipo_explotacion: 'Mixto',
    sistema_explotacion: 'Semiextensivo',
    contrato_lacteo_numero: 'CT-2026-002',
    contrato_lacteo_fecha_fin: '2027-12-31',
    contrato_lacteo_comprador: 'Lácteos La Serena SA',
    numero_infolac: 'INF-21005-901',
    zonas: [
      { nombre: 'Parcela Norte 42ha', superficieGrafica: 42, superficie: 42, aforoMax: 200, aforo_maximo: 200, usoPrincipal: 'Pasto', uso: 'Pasto', localizacion: 'Pasto principal de vacuno', descripcion: 'Pasto principal de vacuno', codigo_pac: 'ES-AN-21005-001', distancia_agua_m: 150 },
      { nombre: 'Parcela Sur 28ha', superficieGrafica: 28, superficie: 28, aforoMax: 150, aforo_maximo: 150, usoPrincipal: 'Barbecho', uso: 'Barbecho', localizacion: 'Rotación y barbecho', descripcion: 'Rotación y barbecho', codigo_pac: 'ES-AN-21005-002', distancia_agua_m: 300 },
      { nombre: 'Pastos Este 15ha', superficieGrafica: 15, superficie: 15, aforoMax: 250, aforo_maximo: 250, usoPrincipal: 'Pasto', uso: 'Pasto', localizacion: 'Pastos de ovino', descripcion: 'Pastos de ovino', codigo_pac: 'ES-AN-21005-003', distancia_agua_m: 80 },
      { nombre: 'Cercado de Cebo 1ha', superficieGrafica: 1, superficie: 1, aforoMax: 10, aforo_maximo: 10, usoPrincipal: 'Pasto', uso: 'Pasto', localizacion: 'Cercado intensivo temporal', descripcion: 'Pruebas de sobrepastoreo', codigo_pac: 'ES-AN-21005-004', distancia_agua_m: 10 }
    ]
  };

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function showToast(msg, bg) {
    // G9: pasar por el sistema unificado de toasts (cola, escape, icono SVG)
    if (window.Toast && typeof window.Toast.show === 'function') {
      window.Toast.show(msg, bg ? 'success' : '');
    } else {
      var toast = document.getElementById('toast-container');
      if (toast) {
        var el = document.createElement('div');
        el.style.cssText = 'background:' + (bg || '#d97706') + ';color:#fff;padding:12px;border-radius:12px;margin-bottom:8px;font-weight:700;';
        el.textContent = msg;
        toast.appendChild(el);
      }
    }
    console.log('[SEED]', msg);
  }

  async function seedDatabase(force) {
    try {
      var isFree = window.PremiumManager && window.PremiumManager.isFree();
      if (isFree && localStorage.getItem('seed_data_completed') === 'true') {
        console.log('[SEED] Ya seedeado (FREE)');
        return;
      }
      if (!force && localStorage.getItem('seed_data_completed') === 'true') {
        console.log('[SEED] Ya seedeado');
        return;
      }

      var existing = await Fincas.list();
      if (existing && existing.length > 0) {
        if (isFree) {
          console.log('[SEED] Ya hay datos (FREE)');
          return;
        }
        showToast('Ya hay datos en la app; la demo no se carga para no sobrescribir.', '#ef4444');
        return;
      }

      showToast('Cargando datos demo CHAMORRO...');

      // 1. Finca (crearNueva devuelve el id y la deja activa)
      var fincaId = await Fincas.crearNueva(DEMO_FINCA);
      await sleep(400);
      console.log('[SEED] Finca creada:', fincaId);

      // Registrar ADSG demo en el almacén de ADSGs
      try {
        await ADSGs.save({
          nombre: DEMO_FINCA.adsg_nombre,
          codigo: DEMO_FINCA.adsg_codigo,
          veterinario: DEMO_FINCA.adsg_veterinario,
          colegiado: DEMO_FINCA.adsg_vet_colegiado,
          telefono: '654789012'
        });
        console.log('[SEED] ADSG demo registrada');
      } catch (e) {
        console.log('[SEED] Error registrando ADSG:', e.message);
      }

      // 2. Rebaños
      var rebDefs = [
        { demo: true, nombre: 'Vacas Frisonas', tipo: 'Láctea', especie: 'Vacas', zonaActual: 'Parcela Norte 42ha', capacidad_total: 50, fincaId: fincaId, tipo_explotacion_rega: 'Producción y reproducción' },
        { demo: true, nombre: 'Terneros Cebo', tipo: 'Cárnica', especie: 'Vacas', zonaActual: 'Cercado de Cebo 1ha', capacidad_total: 30, fincaId: fincaId, tipo_explotacion_rega: 'Cebo o engorde (Cebadero)' },
        { demo: true, nombre: 'Ovejas Merinas', tipo: 'Cárnica', especie: 'Ovejas', zonaActual: 'Pastos Este 15ha', capacidad_total: 200, fincaId: fincaId, tipo_explotacion_rega: 'Cebo o engorde (Cebadero)' }
      ];
      var rebs = [];
      for (var i = 0; i < rebDefs.length; i++) {
        var rid = await Rebanos.save(rebDefs[i]);
        rebs.push(Object.assign({ id: rid }, rebDefs[i]));
        await sleep(120);
      }
      var rebVacas = rebs[0], rebTerneros = rebs[1], rebOvejas = rebs[2];

      // 3. Animales (rebanoId asignado directamente en la definición)
      var animDefs = [
        { demo: true, numero_identificacion: 'ES123456789012', especie: 'Vacas', tipo: 'Vaca Frisona', estado: 'activo', fecha_nacimiento: '2021-03-15', sexo: 'H', raza: 'Frisona', peso_inicial: 580, rebanoId: rebVacas.id, categoria: 'Producción', dib: 'DIB-V1-2021' },
        { demo: true, numero_identificacion: 'ES123456789013', especie: 'Vacas', tipo: 'Vaca Frisona', estado: 'activo', fecha_nacimiento: '2020-07-22', sexo: 'H', raza: 'Frisona', peso_inicial: 620, rebanoId: rebVacas.id, categoria: 'Producción', dib: 'DIB-V2-2020' },
        { demo: true, numero_identificacion: 'ES123456789014', especie: 'Vacas', tipo: 'Vaca Frisona', estado: 'activo', fecha_nacimiento: '2022-01-10', sexo: 'H', raza: 'Frisona', peso_inicial: 510, rebanoId: rebVacas.id, categoria: 'Producción', dib: 'DIB-V3-2022' },
        { demo: true, numero_identificacion: 'ES123456789015', especie: 'Vacas', tipo: 'Ternero', estado: 'activo', fecha_nacimiento: '2024-11-05', sexo: 'M', raza: 'Frisona', peso_inicial: 180, rebanoId: rebTerneros.id, categoria: 'Recría', dib: 'DIB-T1-2024', madre_id: null },
        { demo: true, numero_identificacion: 'ES123456789016', especie: 'Vacas', tipo: 'Ternero', estado: 'activo', fecha_nacimiento: '2024-10-20', sexo: 'M', raza: 'Frisona', peso_inicial: 195, rebanoId: rebTerneros.id, categoria: 'Recría', dib: 'DIB-T2-2024', madre_id: null },
        { demo: true, numero_identificacion: 'ES654321098765', especie: 'Ovejas', tipo: 'Oveja Merina', estado: 'activo', fecha_nacimiento: '2022-06-01', sexo: 'H', raza: 'Merina', peso_inicial: 55, rebanoId: rebOvejas.id, categoria: 'Madres' },
        { demo: true, numero_identificacion: 'ES654321098766', especie: 'Ovejas', tipo: 'Oveja Merina', estado: 'activo', fecha_nacimiento: '2023-02-14', sexo: 'H', raza: 'Merina', peso_inicial: 52, rebanoId: rebOvejas.id, categoria: 'Madres' },
        { demo: true, numero_identificacion: 'ES654321098767', especie: 'Ovejas', tipo: 'Oveja Merina', estado: 'activo', fecha_nacimiento: '2021-11-30', sexo: 'H', raza: 'Merina', peso_inicial: 58, rebanoId: rebOvejas.id, categoria: 'Madres' },
        { demo: true, numero_identificacion: 'ES654321098768', especie: 'Ovejas', tipo: 'Cordero', estado: 'activo', fecha_nacimiento: '2024-05-18', sexo: 'M', raza: 'Merina', peso_inicial: 60, rebanoId: rebOvejas.id, categoria: 'Cebo' }
      ];
      var anims = [];
      for (var a = 0; a < animDefs.length; a++) {
        try {
          var aid = await Animales.save(animDefs[a]);
          anims.push(Object.assign({ id: aid }, animDefs[a]));
        } catch (e) { console.log('[SEED] Error animal:', e.message); }
        await sleep(120);
      }
      var vaca1 = anims[0], vaca2 = anims[1], vaca3 = anims[2];
      var terner1 = anims[3], terner2 = anims[4];
      var oveja4 = anims[8];

      // Vincular descendencia
      if (vaca1 && terner1) { terner1.madre_id = vaca1.id; await Animales.save(terner1); }
      if (vaca1 && terner2) { terner2.madre_id = vaca1.id; await Animales.save(terner2); }

      // 4. Pesajes de seguimiento de peso para vaca1 (vaca lechera — motivo control_peso para no contaminar cárnica)
      if (vaca1) {
        var pesajes = [
          { fecha: '2025-01-15', valor_neto: 585 },
          { fecha: '2025-02-15', valor_neto: 590 },
          { fecha: '2025-03-15', valor_neto: 588 },
          { fecha: '2025-04-15', valor_neto: 592 },
          { fecha: '2025-05-15', valor_neto: 595 }
        ];
        for (var p = 0; p < pesajes.length; p++) {
          try {
            await Pesajes.registrar({
              entidad_id: vaca1.id,
              tipo_entidad: 'animal',
              valor_neto: pesajes[p].valor_neto,
              fecha: pesajes[p].fecha,
              motivo_tarea: 'control_peso',
              snap_zona: rebVacas.zonaActual,
              snap_tipo: rebVacas.tipo,
              snap_especie: rebVacas.especie,
              unidad: 'kg',
              rol_contable: 'INVENTARIO'
            });
          } catch (e) { console.log('[SEED] Error pesaje:', e.message); }
          await sleep(80);
        }
      }

      // 5. Compradores
      var compDefs = [
        { demo: true, nombre: 'Cárnicas Extremeñas SL', nif_cif: 'B98765431', tipo_comprador: 'cárnico', tipo_operador: 'matadero', rega: 'ES061234000456', comunidad_autonoma: 'extremadura', telefono: '+34 924 111 222', ciudad: 'Mérida', provincia: 'Badajoz', activo: true },
        { demo: true, nombre: 'Lácteos La Serena SA', nif_cif: 'A87654323', tipo_comprador: 'láctico', tipo_operador: 'quesería', rega: 'ES061234000789', comunidad_autonoma: 'extremadura', telefono: '+34 924 333 444', ciudad: 'Don Benito', provincia: 'Badajoz', activo: true },
        { demo: true, nombre: 'Ganados del Oeste SL', nif_cif: 'B76543214', tipo_comprador: 'híbrido', tipo_operador: 'intermediario', rega: 'ES061234001012', comunidad_autonoma: 'extremadura', telefono: '+34 927 555 666', ciudad: 'Cáceres', provincia: 'Cáceres', activo: true }
      ];
      var comps = [];
      for (var c = 0; c < compDefs.length; c++) {
        try {
          var cid = await Compradores.save(compDefs[c]);
          comps.push(Object.assign({ id: cid }, compDefs[c]));
        } catch (e) { console.log('[SEED] Error comprador:', e.message); }
        await sleep(100);
      }
      var compCarne = comps[0], compLeche = comps[1];

      // 6. Proveedores
      var provDefs = [
        { demo: true, nombre: 'Piensos El Trébol SA', nif_cif: 'A65432106', tipo_operador: 'fabricante_pienso', rega: 'ES061234001345', comunidad_autonoma: 'extremadura', ciudad: 'Zafra', provincia: 'Badajoz', categorias: ['Alimentacion'], activo: true },
        { demo: true, nombre: 'Farmacia Veterinaria VetPlus', nif_cif: 'B54321096', tipo_operador: 'veterinario', rega: 'ES061234001678', comunidad_autonoma: 'extremadura', ciudad: 'Badajoz', provincia: 'Badajoz', categorias: ['Sanidad'], activo: true },
        { demo: true, nombre: 'Maquinaria Agrícola La Vega', nif_cif: 'B43210988', tipo_operador: 'proveedor_equipos', rega: 'ES061234002011', comunidad_autonoma: 'extremadura', ciudad: 'Plasencia', provincia: 'Cáceres', categorias: ['Amortizacion'], activo: true }
      ];
      var provs = [];
      for (var pv = 0; pv < provDefs.length; pv++) {
        try {
          var pvid = await Proveedores.save(provDefs[pv]);
          provs.push(Object.assign({ id: pvid }, provDefs[pv]));
        } catch (e) { console.log('[SEED] Error proveedor:', e.message); }
        await sleep(100);
      }
      var provPienso = provs[0], provVet = provs[1], provMaq = provs[2];

      // 7. Transportistas
      var transDefs = [
        { demo: true, nombre: 'Transportes Ganaderos del Sur SL', nif_cif: 'B32109878', matricula: '1234BCD', autorizacion_transporte_ganado: 'ATG-BA-2024-001', desinsectacion_ultima_fecha: '2026-06-10', desinsectacion_vencimiento: '2026-09-10', ciudad: 'Almendralejo', provincia: 'Badajoz', tipo_vehiculo: 'camion', capacidad_animales: 40, certificado_bienestar: true, activo: true },
        { demo: true, nombre: 'Logística Láctea Extremeña', nif_cif: 'B21098769', matricula: '5678EFG', autorizacion_transporte_ganado: 'ATG-BA-2024-002', desinsectacion_ultima_fecha: '2026-06-05', desinsectacion_vencimiento: '2026-09-05', ciudad: 'Villanueva de la Serena', provincia: 'Badajoz', tipo_vehiculo: 'cisterna', capacidad_animales: 0, condiciones_termoneutrales: true, activo: true }
      ];
      var transIds = [];
      for (var t = 0; t < transDefs.length; t++) {
        try {
          var tid = await Transportistas.save(transDefs[t]);
          transIds.push(tid);
        } catch (e) { console.log('[SEED] Error transportista:', e.message); }
        await sleep(100);
      }
      var transCarneId = transIds[0] || null;
      var transLecheId = transIds[1] || null;

      // 8. Contratos (alineados con ejemplos de manual)
      var contCarneId = null;
      var contLecheId = null;

      if (compCarne) {
        try {
          contCarneId = await Contratos.save({
            demo: true,
            compradorId: compCarne.id,
            numero_contrato: 'CT-2026-001',
            tipo: 'carne',
            fecha_inicio: '2026-01-01',
            fecha_fin: '2026-12-31',
            iva_pct: 21,
            retencion_pct: 0,
            condiciones: 'Mínimo 500 kg/entrega. Transporte a cargo del comprador.',
            precios: [
              { producto: 'Cordero 18-24 kg', precio_unitario: 3.20, unidad: 'kg' },
              { producto: 'Cordero 24-28 kg', precio_unitario: 3.05, unidad: 'kg' },
              { producto: 'Vaca adulta', precio_unitario: 2.80, unidad: 'kg' }
            ]
          });
        } catch (e) { console.log('[SEED] Error contrato carne:', e.message); }
      }
      if (compLeche) {
        try {
          contLecheId = await Contratos.save({
            demo: true,
            compradorId: compLeche.id,
            numero_contrato: 'CT-2026-002',
            tipo: 'leche',
            fecha_inicio: '2026-01-01',
            fecha_fin: '2027-12-31',
            iva_pct: 10,
            retencion_pct: 0,
            condiciones: 'Recogida cada 2 días. Bonificación +0,02€ si grasa >3,8%. Almacenamiento 4°C.',
            precios: [
              { producto: 'Leche estándar', precio_unitario: 0.38, unidad: 'L' },
              { producto: 'Leche ecológica', precio_unitario: 0.48, unidad: 'L' }
            ]
          });
        } catch (e) { console.log('[SEED] Error contrato leche:', e.message); }
      }
      await sleep(150);

      // 9. Gastos
      var hoyStr = new Date().toISOString().split('T')[0];
      var hace10d = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      var hace20d = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      var gastosDefs = [
        { demo: true, concepto: 'Pienso concentrado vacuno', fecha: hace10d, monto: 2340.50, categoria: 'Alimentacion', rebanoId: rebVacas.id, proveedorId: provPienso ? provPienso.id : null },
        { demo: true, concepto: 'Paja para cama y lecho', fecha: hace20d, monto: 680.00, categoria: 'Alimentacion', rebanoId: rebVacas.id, proveedorId: provPienso ? provPienso.id : null },
        { demo: true, concepto: 'Vacunación trimestral', fecha: '2025-03-10', monto: 425.00, categoria: 'Sanidad', rebanoId: rebVacas.id, proveedorId: provVet ? provVet.id : null },
        { demo: true, concepto: 'Gasoil tractor', fecha: '2025-03-15', monto: 320.75, categoria: 'Amortizacion', proveedorId: provMaq ? provMaq.id : null },
        { demo: true, concepto: 'Mantenimiento valla parcela norte', fecha: '2025-03-20', monto: 890.00, categoria: 'Amortizacion', proveedorId: provMaq ? provMaq.id : null },
        { demo: true, concepto: 'Pienso lactancia corderos', fecha: hace10d, monto: 540.00, categoria: 'Alimentacion', rebanoId: rebOvejas.id, proveedorId: provPienso ? provPienso.id : null },
        { demo: true, concepto: 'Veterinario revisión rebaño', fecha: hoyStr, monto: 260.00, categoria: 'Sanidad', rebanoId: rebVacas.id, proveedorId: provVet ? provVet.id : null }
      ];
      for (var g = 0; g < gastosDefs.length; g++) {
        try { await Gastos.save(gastosDefs[g]); } catch (e) { console.log('[SEED] Error gasto:', e.message); }
        await sleep(80);
      }

      // 10. Sanitarios (alineados con ejemplos de manual)
      var sanDefs = [
        {
          demo: true,
          tipo_tratamiento: 'Vacunación',
          motivo_tratamiento: 'profilaxis',
          via_administracion: 'subcutanea',
          medicamento: 'Nobivac IP',
          fecha: '2026-06-10',
          dosis: '2 ml inyectable',
          tiempo_espera_carne_dias: 0,
          tiempo_espera_leche_dias: 0,
          prohibidoLeche: false,
          rebanoId: rebVacas.id,
          veterinario_prescriptor: 'Dra. Elena Ruiz',
          veterinario_colegiado: 'COL-2108',
          numero_receta: 'REC-2026-00891',
          num_animales_tratados: 12
        },
        {
          demo: true,
          tipo_tratamiento: 'Desparasitación',
          motivo_tratamiento: 'profilaxis',
          via_administracion: 'oral',
          medicamento: 'Ivermectina 1%',
          fecha: '2026-06-01',
          dosis: '1 ml/50kg',
          tiempo_espera_carne_dias: 21,
          tiempo_espera_leche_dias: 28,
          prohibidoLeche: false,
          rebanoId: rebVacas.id,
          veterinario_prescriptor: 'Dra. Elena Ruiz',
          veterinario_colegiado: 'COL-2108',
          numero_receta: 'REC-2026-00892',
          num_animales_tratados: 12
        },
        {
          demo: true,
          tipo_tratamiento: 'Antibiótico',
          motivo_tratamiento: 'patologia_infecciosa',
          via_administracion: 'intramuscular',
          medicamento: 'Penicilina G inyectable (500.000 UI)',
          fecha: '2026-06-05',
          dosis: '2 inyecciones cada 12h (4 dosis total)',
          veterinario: 'Dr. García',
          veterinario_prescriptor: 'Dr. Carlos García',
          veterinario_colegiado: 'COL-2105',
          numero_receta: 'REC-2026-00912',
          num_animales_tratados: 1,
          tiempo_espera_carne_dias: 28,
          tiempo_espera_leche_dias: 7,
          prohibidoLeche: false,
          rebanoId: rebVacas.id,
          notas: 'Mastitis clínica tratada. Seguimiento el 15/06.',
          enfermedad: 'Mamitis'
        }
      ];
      for (var s = 0; s < sanDefs.length; s++) {
        try { await Sanitarios.save(sanDefs[s]); } catch (e) { console.log('[SEED] Error sanitario:', e.message); }
        await sleep(80);
      }

      // 11. Eventos reproductivos (vaca1, alineados con ejemplos de manual)
      if (vaca1) {
        var repDefs = [
          { demo: true, tipo_evento: 'Celo', fecha: '2025-08-20', animalId: vaca1.id },
          { demo: true, tipo_evento: 'Inseminación Artificial', fecha: '2025-08-21', animalId: vaca1.id, semenalId: 'Reproductor-5' },
          { demo: true, tipo_evento: 'Diagnóstico Gestación', fecha: '2025-09-20', animalId: vaca1.id, resultado: 'Positivo', dias_gestacion: 30 },
          { demo: true, tipo_evento: 'Parto', fecha: '2026-05-30', animalId: vaca1.id, crias_vivas: 1, crias_muertas: 0, observaciones: 'Parto sin complicaciones' }
        ];
        for (var r2 = 0; r2 < repDefs.length; r2++) {
          try { await Reproduccion.saveEvento(repDefs[r2]); } catch (e) { console.log('[SEED] Error reproducción:', e.message); }
          await sleep(80);
        }
      }

      // 12. Producción de carne (Individual, Lote y Ventas)
      var currentYear = new Date().getFullYear();
      var prodCarneData = [
        { animal: terner1, pesos: [{ f: `${currentYear}-01-10`, p: 175 }, { f: `${currentYear}-02-10`, p: 210 }, { f: `${currentYear}-03-10`, p: 248 }, { f: `${currentYear}-04-10`, p: 285 }] },
        { animal: terner2, pesos: [{ f: `${currentYear}-01-10`, p: 190 }, { f: `${currentYear}-02-10`, p: 228 }, { f: `${currentYear}-03-10`, p: 265 }, { f: `${currentYear}-04-10`, p: 300 }] },
        { animal: oveja4, pesos: [{ f: `${currentYear}-02-01`, p: 60 }, { f: `${currentYear}-03-01`, p: 68 }, { f: `${currentYear}-04-01`, p: 75 }] }
      ];
      for (var pc = 0; pc < prodCarneData.length; pc++) {
        var pcItem = prodCarneData[pc];
        if (!pcItem.animal) continue;
        for (var pp = 0; pp < pcItem.pesos.length; pp++) {
          try {
            await window.db.add('registro_eventos', {
              demo: true,
              fincaId: fincaId,
              fecha: pcItem.pesos[pp].f,
              entidad_id: pcItem.animal.id,
              rebanoId: pcItem.animal.rebanoId, // vincula el pesaje al lote (control cárnico / ICA)
              tipo_entidad: 'animal',
              valor_neto: pcItem.pesos[pp].p,
              unidad: 'kg',
              motivo_tarea: 'control',
              rol_contable: 'INVENTARIO',
              snap_identificacion: pcItem.animal.numero_identificacion,
              snap_zona: 'Parcela Norte 42ha',
              snap_especie: pcItem.animal.especie,
              snap_tipo: pcItem.animal.categoria || 'Cebo',
              creadoEn: new Date().toISOString()
            });
          } catch (e) { console.log('[SEED] Error prod carne ind:', e.message); }
          await sleep(50);
        }
      }


      // 12b. Tanda de cebo (SIGGAN): movimiento de ENTRADA + silo/consumos para el ICA
      // Define la tanda de los terneros por su movimiento de entrada documentado y siembra
      // el pienso consumido por el lote, para poder validar el ICA de cierre y control mensual.
      if (terner1 && terner2) {
        try {
          await window.db.put('movimientos_ganado', {
            id: 9900,
            demo: true,
            fincaId: fincaId,
            tipo: 'entrada',
            numero_guia: 'ENT-' + currentYear + '-0018',
            rega_origen: 'ES060140000123',
            rega_destino: DEMO_FINCA.rega,
            explotacion_contraparte: 'Ganadería de Origen SL (Badajoz)',
            motivo: 'cebo',
            especie: 'Vacas',
            num_animales: 2,
            animalId: [terner1.id, terner2.id],
            crotales: [terner1.numero_identificacion, terner2.numero_identificacion],
            tipo_operador_destino: 'explotacion',
            transportista_nombre: 'Transportes Ganaderos del Sur SL',
            matricula: '1234BCD',
            fecha: currentYear + '-01-05',
            desinsectacion_certificada: true,
            desinfeccion_fecha: currentYear + '-01-05',
            veterinario_autorizante: 'Dr. Manuel Castillo',
            estado_tramite: 'presentado',
            fecha_presentacion: currentYear + '-01-05',
            numero_registro_oficial: 'REG-ENT-1180',
            acuse_recibo: 'OK-ENT-2261',
            creadoEn: new Date().toISOString()
          });

          await window.db.put('config_silos', {
            id: 8801,
            demo: true,
            fincaId: fincaId,
            nombre: 'Silo Cebo 1',
            alimento: 'Pienso engorde vacuno',
            capacidad: 8000,
            cantidadActual: 1500,
            precioUltimaCargaKg: 0.30,
            creadoEn: new Date().toISOString()
          });

          var consumosCebo = [
            { fecha: currentYear + '-02-01', kg: 350 },
            { fecha: currentYear + '-03-01', kg: 380 },
            { fecha: currentYear + '-04-01', kg: 400 }
          ];
          for (var cc = 0; cc < consumosCebo.length; cc++) {
            await window.db.add('registro_eventos', {
              demo: true,
              fincaId: fincaId,
              tipo: 'silo_consumo',
              tipo_entidad: 'silo_pienso',
              entidad_id: 8801,
              rebanoId: rebTerneros.id,
              fecha: consumosCebo[cc].fecha,
              motivo_tarea: 'alimentacion',
              valor_neto: consumosCebo[cc].kg,
              unidad: 'kg',
              precioKgConsumo: 0.30,
              costeConsumo: +(consumosCebo[cc].kg * 0.30).toFixed(2),
              observaciones: 'Consumo de pienso de cebo (lote Terneros Cebo)',
              creadoEn: new Date().toISOString()
            });
            await sleep(50);
          }
        } catch (e) { console.log('[SEED] Error tanda cebo:', e.message); }
      }

      // 13. Producción de leche (Individual, Lote y Expedición Tanque)
      var prodLecheVacas = [vaca1, vaca2, vaca3];
      var lecheFechas = [`${currentYear}-03-01`, `${currentYear}-03-15`, `${currentYear}-04-01`, `${currentYear}-04-15`, `${currentYear}-05-01`];
      for (var plv = 0; plv < prodLecheVacas.length; plv++) {
        if (!prodLecheVacas[plv]) continue;
        for (var lf = 0; lf < lecheFechas.length; lf++) {
          try {
            var litros = 22 + Math.round(Math.random() * 8);
            // 1. Guardar en tabla cifrada (para el historial de leche)
            await Produccion.saveLeche({
              demo: true,
              vacaId: prodLecheVacas[plv].id,
              fecha: lecheFechas[lf],
              cantidad_litros: litros,
              analisis_grasa_proteina: { grasa: 3.7, proteina: 3.3 }
            }, fincaId);

            // 2. Registrar en Libro Maestro (registro_eventos) para visibilidad en Producción
            await window.db.add('registro_eventos', {
              demo: true,
              fincaId: fincaId,
              fecha: lecheFechas[lf],
              entidad_id: prodLecheVacas[plv].id,
              tipo_entidad: 'animal',
              valor_neto: litros,
              unidad: 'L',
              motivo_tarea: 'control_lechero',
              rol_contable: 'INVENTARIO',
              snap_identificacion: prodLecheVacas[plv].numero_identificacion,
              snap_zona: 'Parcela Norte 42ha',
              snap_especie: 'Vacas',
              snap_tipo: 'Madres',
              creadoEn: new Date().toISOString()
            });
          } catch (e) { console.log('[SEED] Error prod leche ind:', e.message); }
          await sleep(50);
        }
      }


      // Registro de EXPEDICIÓN DE TANQUE (ejemplo lácteo)
      try {
        await window.db.add('registro_eventos', {
          demo: true,
          fincaId: fincaId,
          fecha: hoyStr,
          entidad_id: fincaId,
          tipo_entidad: 'finca',
          valor_neto: 1850,
          unidad: 'L',
          motivo_tarea: 'expedicion',
          rol_contable: 'VENTA',
          snap_identificacion: 'TANQUE PRINCIPAL',
          snap_zona: 'Finca',
          snap_especie: 'Vacas',
          creadoEn: new Date().toISOString()
        });
      } catch (e) { console.log('[SEED] Error expedicion tanque:', e.message); }

      // 14. Comercialización de leche (entregas a tanque con laboratorio + MOFA)
      var hace5d = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      var hace15d = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      var hace25d = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      var entregasLeche = [
        { fecha: hace25d, cantidad: 1850, precioBase: 0.58, grasa: 6.2, proteina: 5.1, somaticas: 320000, germenes: 35000 },
        { fecha: hace15d, cantidad: 2010, precioBase: 0.60, grasa: 6.4, proteina: 5.3, somaticas: 280000, germenes: 28000 },
        { fecha: hace5d, cantidad: 1940, precioBase: 0.59, grasa: 6.1, proteina: 5.0, somaticas: 410000, germenes: 60000 }
      ];
      for (var elx = 0; elx < entregasLeche.length; elx++) {
        var en = entregasLeche[elx];
        var extractoSeco = +(en.grasa + en.proteina).toFixed(2);
        var precioExtracto = 0.012;
        var precioFinal = +(en.precioBase + extractoSeco * precioExtracto).toFixed(4);
        var importeTotal = +(en.cantidad * precioFinal).toFixed(2);
        var costeAlim = 420;
        try {
          await window.db.add('comercializacion_leche', {
            demo: true,
            fincaId: fincaId,
            compradorId: compLeche ? compLeche.id : null,
            contratoId: contLecheId || null,
            transportistaId: transLecheId || null,
            fecha: en.fecha,
            fechaRecogida: en.fecha,
            matriculaCisterna: '5678EFG',
            cantidad: en.cantidad,
            precioBase: en.precioBase,
            hora_ordeno: '06:30',
            hora_carga: '08:00',
            temperatura: 3.5,
            laboratorio: {
              grasa: en.grasa, proteina: en.proteina, somaticas: en.somaticas, germenes: en.germenes,
              antibioticos: false, extracto_seco: extractoSeco, recuento_bacterias: en.germenes,
              antibioticos_positivos: false, laboratorio_nombre: 'LIGAL', nro_boletin: 'B-' + en.fecha.replace(/-/g, '')
            },
            antibioticos: false,
            estadoAnalitica: 'Validado',
            precio_extracto_seco: precioExtracto,
            primas_penalizaciones: 0,
            precio_final_unitario: precioFinal,
            importe_total: importeTotal,
            coste_alimentacion_diario: 14,
            coste_alimentacion_periodo: costeAlim,
            mofa: +(importeTotal - costeAlim).toFixed(2),
            creadoEn: new Date().toISOString()
          });
        } catch (e) { console.log('[SEED] Error com. leche:', e.message); }
        await sleep(80);
      }

      // 15. Comercialización de carne (venta de un ternero) + DIMOE
      if (terner2 && compCarne) {
        try {
          var pesoVivoV = 300, pesoCanalV = 168;
          var fechaSacrificio = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          var regVentaCarne = {
            demo: true,
            animalId: terner2.id,
            compradorId: compCarne.id,
            contratoId: contCarneId || null,
            fechaSacrificio: fechaSacrificio,
            codigoMatadero: 'ES10.05/M',
            pesoVivo: pesoVivoV,
            pesoCanal: pesoCanalV,
            rendimientoCanal: +((pesoCanalV / pesoVivoV) * 100).toFixed(2),
            fincaId: fincaId,
            snap_zona: rebTerneros.zonaActual,
            snap_especie: rebTerneros.especie,
            snap_tipo: rebTerneros.tipo,
            nifComprador: compCarne.nif_cif,
            razonSocial: compCarne.nombre,
            codigoDocumento_ICA: 'ICA-2025-0012',
            numero_Guia_Sanitaria: 'GS-2025-0451',
            IVA: 10,
            retencionREAGP: 0,
            Gasto_Transporte: 35,
            Gasto_Matanza: 28,
            clasificacion: { seurop: 'U' },
            transportistaId: transCarneId || null,
            nombreTransportista: 'Transportes Ganaderos del Sur SL',
            nifTransportista: 'B32109876',
            matriculaTransportista: '1234BCD',
            numero_albaran: 'ALB-2025-0007',
            precio_total: +(pesoCanalV * 5.1).toFixed(2),
            autorizacion_veterinaria: { vet_nombre: '', vet_colegiado: '', fecha_autorizacion: '' },
            creadoEn: new Date().toISOString()
          };
          var idVentaCarne = await window.db.add('comercializacion_carne', regVentaCarne);
          // También registrar en ventas_ganado cifrado (para analítica y reportes)
          try {
            await Produccion.saveVentas({
              demo: true,
              animal_id_list: [terner2.id],
              precio_total: regVentaCarne.precio_total,
              comprador: compCarne.nombre,
              documentacion: 'ALB-2025-0007',
              fecha: regVentaCarne.fechaSacrificio,
              creadoEn: regVentaCarne.creadoEn
            }, fincaId);
          } catch (e) { console.log('[SEED] Error saveVentas:', e.message); }
          // Marcar animal como vendido
          var aVendido = await Animales.get(terner2.id);
          if (aVendido) { aVendido.estado = 'vendido'; await Animales.save(aVendido); }
          // DIMOE como documento legal
          await window.db.add('documentos_legales', {
            demo: true,
            tipo: 'dimoe',
            fincaId: fincaId,
            numero: 'DIMOE-ALB-2025-0007',
            fecha_emision: fechaSacrificio,
            origen_rega: DEMO_FINCA.rega,
            origen_nombre: DEMO_FINCA.nombre,
            destino: 'ES10.05/M',
            destino_nombre: 'Cárnicas Extremeñas SL',
            motivo: 'sacrificio',
            transportista_nombre: 'Transportes Ganaderos del Sur SL',
            transportista_nif: 'B32109876',
            transportista_matricula: '1234BCD',
            created_at: new Date().toISOString()
          });

          // Registrar también en movimientos_ganado para que aparezcan en el listado de Guías DIMOE unificado de documentos-view.js
          await window.db.put('movimientos_ganado', {
            id: 9901,
            demo: true,
            fincaId: fincaId,
            tipo: 'salida',
            numero_guia: 'GS-2025-0451',
            rega_origen: DEMO_FINCA.rega,
            rega_destino: 'ES10.05/M',
            explotacion_contraparte: 'Cárnicas Extremeñas SL',
            motivo: 'sacrificio',
            especie: 'Vacas',
            num_animales: 1,
            crotales: ['ES123456789016'],
            tipo_operador_destino: 'matadero',
            transportista_nombre: 'Transportes Ganaderos del Sur SL',
            matricula: '1234BCD',
            fecha: fechaSacrificio,
            desinsectacion_certificada: true,
            desinfeccion_numero_talon: 'DES-89012',
            desinfeccion_fecha: fechaSacrificio,
            veterinario_autorizante: 'Dr. Manuel Castillo',
            estado_tramite: 'presentado',
            fecha_presentacion: fechaSacrificio,
            numero_registro_oficial: 'REG-OFF-8472',
            acuse_recibo: 'OK-RECEP-3921',
            creadoEn: new Date().toISOString()
          });

          await window.db.put('movimientos_ganado', {
            id: 9902,
            demo: true,
            fincaId: fincaId,
            tipo: 'salida',
            numero_guia: 'GS-2026-0922',
            rega_origen: DEMO_FINCA.rega,
            rega_destino: 'ES410020004921',
            explotacion_contraparte: 'Finca Los Helechos (Sevilla)',
            motivo: 'pastoreo',
            especie: 'Ovejas',
            num_animales: 3,
            crotales: ['ES654321098765', 'ES654321098766', 'ES654321098767'],
            tipo_operador_destino: 'explotacion',
            transportista_nombre: 'Transportes Ganaderos del Sur SL',
            matricula: '1234BCD',
            fecha: new Date().toISOString().split('T')[0],
            desinsectacion_certificada: true,
            desinfeccion_numero_talon: 'DES-90211',
            desinfeccion_fecha: new Date().toISOString().split('T')[0],
            veterinario_autorizante: 'Dr. Manuel Castillo',
            estado_tramite: 'borrador',
            creadoEn: new Date().toISOString()
          });
        } catch (e) { console.log('[SEED] Error com. carne:', e.message); }
      }

      // Seed completado
      localStorage.setItem('seed_data_completed', 'true');
      showToast('Datos demo CHAMORRO cargados correctamente', '#22c55e');
      console.log('[SEED] Completado exitosamente');

    } catch (e) {
      console.error('[SEED] Error:', e.message, e.stack);
      showToast('Error cargando datos: ' + e.message, '#ef4444');
      throw e;
    }
  }

  // Sin auto-siembra: la demo se carga bajo demanda desde el asistente
  // de configuración (botón "Cargar Demo CHAMORRO").
  window.SeedData = { run: seedDatabase };

})();
