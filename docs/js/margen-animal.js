/**
 * MargenAnimal — Livestock Manager
 * Cálculo de coste (compra + sanidad prorrateada) vs. ingreso (leche
 * estimada + venta) por animal, acumulado histórico. Ver
 * docs/superpowers/specs/2026-07-23-margen-economico-animal-design.md.
 * Módulo de solo cálculo, sin UI propia.
 */
const MargenAnimal = {
  /**
   * Mapa origen_tipo:origen_id -> suma de costeTotal de los eventos de
   * consumo de botiquín vinculados a ese origen (un tratamiento o
   * vacunación puede tener varios eventos, ej. varios tipos de vacuna).
   */
  async _costesPorOrigen(fincaId) {
    const eventos = await window.db.getAllFromIndex('registro_eventos', 'tipo_entidad', 'botiquin').catch(() => []);
    const mapa = new Map();
    for (const e of eventos) {
      if (e.fincaId !== fincaId) continue;
      if (!e.origen_tipo || e.origen_id == null) continue;
      const clave = `${e.origen_tipo}:${e.origen_id}`;
      mapa.set(clave, (mapa.get(clave) || 0) + Number(e.costeTotal || 0));
    }
    return mapa;
  },

  /** Precio unitario de leche vigente hoy, o null si no hay ninguno. */
  async _precioLecheVigente() {
    if (!window.Compradores || !window.Contratos) return null;
    const compradoresLeche = await window.Compradores.list({ tipo: 'leche' }).catch(() => []);
    const hoy = new Date();
    for (const comprador of compradoresLeche) {
      const contrato = await window.Contratos.getActivo(comprador.id, 'leche');
      if (!contrato || !Array.isArray(contrato.precios)) continue;
      const filaLeche = contrato.precios.find((p) => {
        if (!(p.producto || '').toLowerCase().includes('leche')) return false;
        const desdeOk = !p.desde || new Date(p.desde) <= hoy;
        const hastaOk = !p.hasta || new Date(p.hasta) >= hoy;
        return desdeOk && hastaOk;
      });
      if (filaLeche) return Number(filaLeche.precio_unitario) || 0;
    }
    return null;
  },

  /** Litros e ingreso estimado de leche de un animal, acumulado histórico. */
  async calcularIngresoLeche(animalId, fincaId) {
    return await ErrorHandler.tryAsync(async () => {
      if (!window.Produccion) return { litros: 0, ingreso: 0, sinPrecioLeche: true };
      const registros = await window.Produccion.listLeche(fincaId).catch(() => []);
      const litros = registros
        .filter((r) => Number(r.vacaId) === Number(animalId))
        .reduce((sum, r) => sum + (Number(r.cantidad_litros) || 0), 0);

      const precioLitro = await this._precioLecheVigente();
      if (precioLitro == null) {
        return { litros: Number(litros.toFixed(2)), ingreso: 0, sinPrecioLeche: true };
      }
      return { litros: Number(litros.toFixed(2)), ingreso: Number((litros * precioLitro).toFixed(2)), sinPrecioLeche: false };
    }, { entity: 'MargenAnimal', action: 'calcularIngresoLeche', animalId, fincaId });
  },

  /**
   * Coste total de sanidad (tratamientos + vacunaciones) imputado a un
   * animal, prorrateando los eventos masivos (sin animalId) entre los
   * animales del rebaño en el momento del evento.
   */
  async calcularCosteSanidad(animalId) {
    return await ErrorHandler.tryAsync(async () => {
      const animal = await window.Animales.get(Number(animalId));
      if (!animal || !animal.rebanoId) return 0;

      const rebanoId = animal.rebanoId;
      const costesPorOrigen = await this._costesPorOrigen(animal.fincaId ?? (await window.db.get('rebanos', rebanoId))?.fincaId);
      const animalesDelRebano = await window.Animales.list(rebanoId);
      const totalAnimalesRebano = animalesDelRebano.length || 1;

      let coste = 0;

      // Tratamientos
      const tratamientos = await window.Sanitarios.list(rebanoId);
      for (const t of tratamientos) {
        const costeEvento = costesPorOrigen.get(`tratamiento:${t.id}`) || 0;
        if (costeEvento === 0) continue;
        if (t.animalId != null) {
          if (Number(t.animalId) === Number(animalId)) coste += costeEvento;
        } else {
          coste += costeEvento / totalAnimalesRebano;
        }
      }

      // Vacunaciones
      const vacunaciones = await window.Vacunaciones.list({ rebanoId });
      for (const v of vacunaciones) {
        const costeEvento = costesPorOrigen.get(`vacunacion:${v.id}`) || 0;
        if (costeEvento === 0) continue;
        const animalesVacunados = Array.isArray(v.animales_vacunados) ? v.animales_vacunados : [];
        const esIndividual = animalesVacunados.some((av) => av.animalId != null);
        if (esIndividual) {
          const estaEsteAnimal = animalesVacunados.some((av) => Number(av.animalId) === Number(animalId));
          if (estaEsteAnimal) {
            // Coste repartido entre los animales individuales de esta vacunazione
            coste += costeEvento / animalesVacunados.length;
          }
        } else {
          // Modo categoría/agregado: prorratea entre todo el rebaño
          coste += costeEvento / totalAnimalesRebano;
        }
      }

      return Number(coste.toFixed(2));
    }, { entity: 'MargenAnimal', action: 'calcularCosteSanidad', animalId });
  },

  /** Margen económico completo de un animal, acumulado histórico. */
  async calcular(animalId) {
    return await ErrorHandler.tryAsync(async () => {
      const animal = await window.Animales.get(Number(animalId));
      if (!animal) throw new Error('Animal no encontrado');

      const rebano = animal.rebanoId ? await window.db.get('rebanos', Number(animal.rebanoId)) : null;
      const fincaId = rebano ? rebano.fincaId : null;

      const costeCompra = Number(animal.precio_compra || 0);
      const costeSanidad = await this.calcularCosteSanidad(animalId);
      const costeTotal = Number((costeCompra + costeSanidad).toFixed(2));

      const { litros: litrosLeche, ingreso: ingresoLeche, sinPrecioLeche } = fincaId
        ? await this.calcularIngresoLeche(animalId, fincaId)
        : { litros: 0, ingreso: 0, sinPrecioLeche: true };

      const ventas = await window.db.getAllFromIndex('comercializacion_carne', 'animalId', Number(animalId)).catch(() => []);
      const ingresoVenta = Number(ventas.reduce((sum, v) => sum + (Number(v.precio_total) || 0), 0).toFixed(2));

      const ingresoTotal = Number((ingresoLeche + ingresoVenta).toFixed(2));
      const margenNeto = Number((ingresoTotal - costeTotal).toFixed(2));

      return {
        animalId: Number(animalId),
        costeCompra, costeSanidad, costeTotal,
        litrosLeche, ingresoLeche, sinPrecioLeche,
        ingresoVenta, ingresoTotal, margenNeto,
      };
    }, { entity: 'MargenAnimal', action: 'calcular', animalId });
  },

  /** Margen de todos los animales de un rebaño. */
  async calcularParaRebano(rebanoId) {
    return await ErrorHandler.tryAsync(async () => {
      const animales = await window.Animales.list(Number(rebanoId));
      const resultados = [];
      for (const a of animales) {
        resultados.push(await this.calcular(a.id));
      }
      return resultados;
    }, { entity: 'MargenAnimal', action: 'calcularParaRebano', rebanoId });
  },

  /** Margen de todos los animales de todos los rebaños de una finca. */
  async calcularParaFinca(fincaId) {
    return await ErrorHandler.tryAsync(async () => {
      const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', Number(fincaId)).catch(() => []);
      let resultados = [];
      for (const r of rebanos) {
        resultados = resultados.concat(await this.calcularParaRebano(r.id));
      }
      return resultados;
    }, { entity: 'MargenAnimal', action: 'calcularParaFinca', fincaId });
  },
};

window.MargenAnimal = MargenAnimal;
