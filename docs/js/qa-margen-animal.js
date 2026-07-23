/**
 * Livestock Manager - MargenAnimal QA Test Suite v1.0.0
 *
 * Pruebas del cálculo de margen económico por animal (coste de sanidad
 * prorrateado, ingreso de leche estimado, margen neto). Ver
 * docs/superpowers/specs/2026-07-23-margen-economico-animal-design.md.
 *
 * EJECUCIÓN: Pegar en la consola del navegador (DevTools) con la app abierta.
 * Uso: await MargenAnimalQA.runAll();
 */
const MargenAnimalQA = {
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

  async _crearFincaRebano() {
    const fincaId = await window.db.add('fincas', { nombre: 'QA-MARGEN-FINCA', creadoEn: new Date().toISOString() });
    const rebanoId = await window.db.add('rebanos', { fincaId, nombre: 'QA-MARGEN-REBANO', especie: 'Bovino', creadoEn: new Date().toISOString() });
    return { fincaId, rebanoId };
  },

  async testCosteSanidadIndividual() {
    const M = 'COSTE SANIDAD INDIVIDUAL';
    const { fincaId, rebanoId } = await this._crearFincaRebano();
    const animalId = await window.Animales.save({ rebanoId, numero_identificacion: 'QA-IND-' + Date.now(), tipoAlta: 'Nacimiento' });
    const productoId = await window.db.add('config_botiquin', { fincaId, nombre: 'QA-PRODUCTO', unidad: 'ml', cantidadActual: 0, anulado: false, creadoEn: new Date().toISOString() });
    await window.db.add('botiquin_lotes', { productoId, lote: 'QA-L1', cantidad: 100, precioUnitario: 3, creadoEn: new Date().toISOString() });
    await window.db.put('config_botiquin', { ...(await window.db.get('config_botiquin', productoId)), cantidadActual: 100 });
    const tratamientoId = await window.Sanitarios.save({ rebanoId, animalId, tipo_tratamiento: 'Antibiótico', fecha: new Date().toISOString().split('T')[0] });
    await window.Botiquin.consumir(productoId, 10, { origenTipo: 'tratamiento', origenId: tratamientoId });

    const coste = await window.MargenAnimal.calcularCosteSanidad(animalId);
    this._assert(coste === 30, M, `coste individual = 30€ (10 unidades × 3€) — obtenido: ${coste}`);
  },

  async testCosteSanidadMasivoProrrateado() {
    const M = 'COSTE SANIDAD MASIVO PRORRATEADO';
    const { fincaId, rebanoId } = await this._crearFincaRebano();
    const a1 = await window.Animales.save({ rebanoId, numero_identificacion: 'QA-MAS1-' + Date.now(), tipoAlta: 'Nacimiento' });
    const a2 = await window.Animales.save({ rebanoId, numero_identificacion: 'QA-MAS2-' + Date.now(), tipoAlta: 'Nacimiento' });
    const productoId = await window.db.add('config_botiquin', { fincaId, nombre: 'QA-PRODUCTO-MASIVO', unidad: 'ml', cantidadActual: 0, anulado: false, creadoEn: new Date().toISOString() });
    await window.db.add('botiquin_lotes', { productoId, lote: 'QA-L2', cantidad: 100, precioUnitario: 2, creadoEn: new Date().toISOString() });
    await window.db.put('config_botiquin', { ...(await window.db.get('config_botiquin', productoId)), cantidadActual: 100 });
    const tratamientoId = await window.Sanitarios.save({ rebanoId, tipo_tratamiento: 'Desparasitación', fecha: new Date().toISOString().split('T')[0] });
    await window.Botiquin.consumir(productoId, 20, { origenTipo: 'tratamiento', origenId: tratamientoId });

    const coste1 = await window.MargenAnimal.calcularCosteSanidad(a1);
    const coste2 = await window.MargenAnimal.calcularCosteSanidad(a2);
    this._assert(coste1 === 20, M, `coste prorrateado animal 1 = 20€ (40€/2 animales) — obtenido: ${coste1}`);
    this._assert(coste2 === 20, M, `coste prorrateado animal 2 = 20€ (40€/2 animales) — obtenido: ${coste2}`);
  },

  async testIngresoLeche() {
    const M = 'INGRESO LECHE';
    const { fincaId, rebanoId } = await this._crearFincaRebano();
    const animalId = await window.Animales.save({ rebanoId, numero_identificacion: 'QA-LECHE-' + Date.now(), tipoAlta: 'Nacimiento' });
    const compradorId = await window.Compradores.save({ nombre: 'QA-COMPRADOR-LECHE', nif_cif: 'B76540848', tipo_comprador: 'leche' });
    const contratoId = await window.Contratos.save({ compradorId, numero_contrato: 'QA-C-' + Date.now(), fecha_inicio: '2020-01-01', tipo: 'leche', activo: true });
    await window.Contratos.addPrecio(contratoId, { producto: 'Leche', precio_unitario: 0.5, unidad: 'litro' });
    await window.Produccion.saveLeche({ vacaId: animalId, fecha: new Date().toISOString().split('T')[0], cantidad_litros: 40 }, fincaId);

    const { litros, ingreso, sinPrecioLeche } = await window.MargenAnimal.calcularIngresoLeche(animalId, fincaId);
    this._assert(litros === 40, M, `litros = 40 — obtenido: ${litros}`);
    this._assert(ingreso === 20, M, `ingreso = 20€ (40L × 0.5€/L) — obtenido: ${ingreso}`);
    this._assert(sinPrecioLeche === false, M, `sinPrecioLeche = false — obtenido: ${sinPrecioLeche}`);
  },

  async testMargenCompleto() {
    const M = 'MARGEN COMPLETO';
    const { fincaId, rebanoId } = await this._crearFincaRebano();
    const animalId = await window.Animales.save({ rebanoId, numero_identificacion: 'QA-COMPLETO-' + Date.now(), tipoAlta: 'Compra', precio_compra: 200, proveedor_id: null, factura_compra: 'QA-FAC' });
    const compradorId = await window.Compradores.save({ nombre: 'QA-COMPRADOR-COMPLETO', nif_cif: 'A58818501', tipo_comprador: 'leche' });
    const contratoId = await window.Contratos.save({ compradorId, numero_contrato: 'QA-C2-' + Date.now(), fecha_inicio: '2020-01-01', tipo: 'leche', activo: true });
    await window.Contratos.addPrecio(contratoId, { producto: 'Leche', precio_unitario: 0.3, unidad: 'litro' });
    await window.Produccion.saveLeche({ vacaId: animalId, fecha: new Date().toISOString().split('T')[0], cantidad_litros: 100 }, fincaId);

    const margen = await window.MargenAnimal.calcular(animalId);
    this._assert(margen.costeCompra === 200, M, `costeCompra = 200 — obtenido: ${margen.costeCompra}`);
    this._assert(margen.ingresoLeche === 30, M, `ingresoLeche = 30 (100L × 0.3€) — obtenido: ${margen.ingresoLeche}`);
    this._assert(margen.margenNeto === -170, M, `margenNeto = -170 (30 ingreso - 200 coste) — obtenido: ${margen.margenNeto}`);
  },

  async runAll() {
    this._results = [];
    console.log('=== MargenAnimal QA Suite ===');
    await this.testCosteSanidadIndividual();
    await this.testCosteSanidadMasivoProrrateado();
    await this.testIngresoLeche();
    await this.testMargenCompleto();
    const fails = this._results.filter((r) => r.status === 'FAIL').length;
    console.log(`=== ${this._results.length - fails}/${this._results.length} PASS ===`);
    return this._results;
  },
};

window.MargenAnimalQA = MargenAnimalQA;