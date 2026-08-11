/**
 * Livestock Manager - InformesView: métodos de obtención de datos
 * Extraído de informes-view.js para modularización (P1-5).
 * Debe cargar DESPUÉS de informes-view.js (extiende window.InformesView).
 */
Object.assign(window.InformesView, {
  // ===================== MÉTODOS DE DATOS =====================

  async _obtenerMetricasLeche(fincaId) {
    try {
      // 1. Intentar con comercializacion_leche (datos sin cifrar, campo 'cantidad')
      let registros = await window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId));
      if (!registros || registros.length === 0) {
        // 2. Fallback: produccion_leche cifrada (campo 'cantidad_litros')
        const cifrados = await Produccion.listLeche(fincaId);
        if (cifrados && cifrados.length > 0) {
          registros = cifrados.map(r => ({
            fecha: r.fecha,
            cantidad: r.cantidad_litros || r.cantidad || 0,
            precioBase: r.precioBase || 0.45
          }));
        }
      }
      if (!registros || registros.length === 0)
        return { totalLitros: 0, promedioDiario: 0, precioMedio: 0, totalRegistros: 0, timeline: [] };
      const totalLitros = registros.reduce((s, r) => s + (r.cantidad || 0), 0);
      const precioMedio = registros.reduce((s, r) => s + (r.precioBase || 0.45), 0) / registros.length;
      const timeline = registros.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(-30)
        .map(r => ({ fecha: r.fecha, litros: r.cantidad || 0 }));
      const diasDiff = Math.max(1, Math.ceil((new Date(timeline[timeline.length - 1]?.fecha || Date.now()) - new Date(timeline[0]?.fecha || Date.now())) / (1000 * 60 * 60 * 24)));
      return { totalLitros, promedioDiario: totalLitros / diasDiff, precioMedio, totalRegistros: registros.length, timeline };
    } catch (e) { return { totalLitros: 0, promedioDiario: 0, precioMedio: 0, totalRegistros: 0, timeline: [] }; }
  },

  async _obtenerGastosPorCategoria(fincaId) {
    try {
      const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fincaId));
      if (!gastos?.length) return [];
      const porCat = {};
      gastos.forEach(g => { const c = g.categoria || 'Otros'; porCat[c] = (porCat[c] || 0) + (g.monto || 0); });
      return Object.entries(porCat).map(([c, t]) => ({ categoria: c, total: t })).sort((a, b) => b.total - a.total);
    } catch (e) { return []; }
  },

  async _obtenerGananciaDiaria(fincaId) {
    try {
      const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', Number(fincaId));
      const resultados = [];
      for (const r of rebanos) {
        const animales = await window.db.getAllFromIndex('animales', 'rebanoId', r.id);
        for (const a of animales.slice(0, 10)) {
          try {
            const gmd = await Produccion.calcularGananciaDiaria(a.id);
            if (gmd?.gananciaDiaria != null) resultados.push({ label: `${a.numero_identificacion} (${r.nombre})`, gananciaDiaria: gmd.gananciaDiaria });
          } catch (e) { }
        }
      }
      return resultados;
    } catch (e) { return []; }
  },

  async _obtenerHistorialVentas(fincaId) {
    try {
      let ventas = await Produccion.listVentas(fincaId);
      if (ventas?.length) {
        return ventas.sort((a, b) => new Date(b.fechaSacrificio || b.fecha_venta || b.fecha || 0) - new Date(a.fechaSacrificio || a.fecha_venta || a.fecha || 0))
          .map(v => ({ fecha: v.fechaSacrificio || v.fecha_venta || v.fecha || '-', animales: v.animal_id_list?.length || v.cantidad || 1, kg: v.pesoCanal || v.pesoTotal || 0, total: v.precio_total || 0 }));
      }
      // Fallback: comercializacion_carne (sin cifrar)
      const cc = await window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId));
      if (cc?.length) {
        return cc.map(c => ({
          fecha: c.fechaSacrificio || c.fecha_emision || '-',
          animales: c.animal_id_list?.length || c.cantidad || 1,
          kg: c.pesoCanal || c.pesoVivo || 0,
          total: c.precio_total || 0
        })).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
      }
      return [];
    } catch (e) { return []; }
  },

  // ===================== NUEVOS DATA LOADERS =====================

  /** Agrupa ventas de carne y leche por comprador */
  async _obtenerMetricasCompradores(fId) {
    try {
      const [ventasCarne, ventasLeche, compradores] = await Promise.all([
        window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fId)).catch(() => []),
        window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fId)).catch(() => []),
        window.db.getAll('compradores').catch(() => []),
      ]);
      // Mapa de compradores por id
      const mapaCompradores = {};
      compradores.forEach(c => { mapaCompradores[c.id] = c; });

      const agrupado = {};

      // Procesar ventas de carne
      ventasCarne.forEach(v => {
        const id = v.compradorId || `nuevo_${v.nifComprador || v.razonSocial || 'unknown'}`;
        if (!agrupado[id]) agrupado[id] = { id, nombre: v.razonSocial || 'N/D', nif: v.nifComprador || '', tipo: '', total: 0, kg: 0, numVentas: 0, ultimaVenta: '', ventasCarne: 0, ventasLeche: 0 };
        const comp = mapaCompradores[v.compradorId];
        if (comp) { agrupado[id].nombre = comp.nombre; agrupado[id].nif = comp.nif_cif || ''; agrupado[id].tipo = comp.tipo_comprador || ''; }
        agrupado[id].total += v.precio_total || 0;
        agrupado[id].kg += v.pesoCanal || v.pesoVivo || 0;
        agrupado[id].numVentas++;
        agrupado[id].ventasCarne += v.precio_total || 0;
        const fecha = v.fechaSacrificio || v.fecha_emision || '';
        if (fecha > (agrupado[id].ultimaVenta || '')) agrupado[id].ultimaVenta = fecha;
      });

      // Procesar ventas de leche
      ventasLeche.forEach(v => {
        const id = v.compradorId || `nuevo_l_${v.nombreComprador || 'unknown'}`;
        if (!agrupado[id]) {
          const comp = mapaCompradores[v.compradorId];
          agrupado[id] = { id, nombre: comp?.nombre || v.nombreComprador || 'N/D', nif: comp?.nif_cif || v.nifComprador || '', tipo: comp?.tipo_comprador || '', total: 0, kg: 0, numVentas: 0, ultimaVenta: '', ventasCarne: 0, ventasLeche: 0 };
        }
        const importe = (v.cantidad || 0) * (v.precioBase || 0.45);
        agrupado[id].total += importe;
        agrupado[id].kg += v.cantidad || 0;
        agrupado[id].numVentas++;
        agrupado[id].ventasLeche += importe;
        const fecha = v.fechaRecogida || v.fecha || '';
        if (fecha > (agrupado[id].ultimaVenta || '')) agrupado[id].ultimaVenta = fecha;
      });

      return Object.values(agrupado).sort((a, b) => b.total - a.total);
    } catch (e) { console.error('[Compradores]', e); return []; }
  },

  /** Agrupa gastos por proveedor */
  async _obtenerMetricasProveedores(fId) {
    try {
      const [gastos, proveedores] = await Promise.all([
        window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fId)).catch(() => []),
        window.db.getAll('proveedores').catch(() => []),
      ]);
      const mapaProv = {};
      proveedores.forEach(p => { mapaProv[p.id] = p; });

      const agrupado = {};
      gastos.forEach(g => {
        const id = g.proveedorId || `nuevo_${g.proveedor || 'sin_proveedor'}`;
        if (!agrupado[id]) {
          const prov = mapaProv[g.proveedorId];
          agrupado[id] = { id, nombre: prov?.nombre || g.proveedor || 'Sin proveedor', nif: prov?.nif_cif || '', categorias: {}, total: 0, numFacturas: 0, ultimaCompra: '' };
        }
        agrupado[id].categorias[g.categoria || 'Otros'] = (agrupado[id].categorias[g.categoria || 'Otros'] || 0) + (g.monto || 0);
        agrupado[id].total += g.monto || 0;
        agrupado[id].numFacturas++;
        const fecha = g.fecha || '';
        if (fecha > (agrupado[id].ultimaCompra || '')) agrupado[id].ultimaCompra = fecha;
      });

      return Object.values(agrupado).sort((a, b) => b.total - a.total);
    } catch (e) { console.error('[Proveedores]', e); return []; }
  },

  /** Gastos fitosanitarios + tratamientos relacionados */
  async _obtenerDatosFitosanitarios(fId) {
    try {
      const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fId)).catch(() => []);
      const fitosanitarios = gastos.filter(g => (g.categoria || '').toLowerCase() === 'fitosanitarios');
      const total = fitosanitarios.reduce((s, g) => s + (g.monto || 0), 0);
      const zonas = new Set(fitosanitarios.map(g => g.snap_zona).filter(Boolean));
      return {
        registros: fitosanitarios.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)),
        total,
        numRegistros: fitosanitarios.length,
        numZonas: zonas.size,
        zonas: [...zonas],
        mediaPorOperacion: fitosanitarios.length > 0 ? (total / fitosanitarios.length) : 0,
      };
    } catch (e) { console.error('[Fitosanitario]', e); return { registros: [], total: 0, numRegistros: 0, numZonas: 0, zonas: [], mediaPorOperacion: 0 }; }
  },

  /** Obtener alertas desde AlertasService */
  async _obtenerAlertas() {
    try {
      if (!window.AlertasService) return { sanitarias: [], trazabilidad: [], administrativas: [], calendario: { titulo: '', sugerencias: [] } };
      return await AlertasService.getAll();
    } catch (e) { console.error('[Alertas]', e); return { sanitarias: [], trazabilidad: [], administrativas: [], calendario: { titulo: '', sugerencias: [] } }; }
  },

  /** Datos de la finca activa */
  async _obtenerDatosPorFinca(fId) {
    try {
      return await Fincas.getActive();
    } catch (e) { return null; }
  },

  /** Ventas de carne agrupadas por rebaño */
  async _obtenerVentasPorRebano(fId) {
    try {
      const ventas = await window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fId)).catch(() => []);
      const rebanos = await Rebanos.list().catch(() => []);
      const mapaReb = {};
      rebanos.forEach(r => { mapaReb[r.id] = r; });

      const porReb = {};
      ventas.forEach(v => {
        const rebId = v.snap_rebano || v.rebanoId || 'sin_rebano';
        if (!porReb[rebId]) porReb[rebId] = { rebano: mapaReb[rebId]?.nombre || 'Sin rebaño', total: 0, kg: 0, numVentas: 0 };
        porReb[rebId].total += v.precio_total || 0;
        porReb[rebId].kg += v.pesoCanal || v.pesoVivo || 0;
        porReb[rebId].numVentas++;
      });

      return Object.values(porReb).sort((a, b) => b.total - a.total);
    } catch (e) { console.error('[VentasPorRebano]', e); return []; }
  },

  /** Producción de leche agrupada por rebaño */
  async _obtenerLechePorRebano(fId) {
    try {
      const registros = await window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fId)).catch(() => []);
      const rebanos = await Rebanos.list().catch(() => []);
      const mapaReb = {};
      rebanos.forEach(r => { mapaReb[r.id] = r; });

      const porReb = {};
      registros.forEach(r => {
        const rebId = r.snap_rebano || r.rebanoId || 'sin_rebano';
        if (!porReb[rebId]) porReb[rebId] = { rebano: mapaReb[rebId]?.nombre || 'Sin rebaño', litros: 0, numRegistros: 0, importe: 0 };
        porReb[rebId].litros += r.cantidad || 0;
        porReb[rebId].numRegistros++;
        porReb[rebId].importe += (r.cantidad || 0) * (r.precioBase || 0.45);
      });

      return Object.values(porReb).sort((a, b) => b.litros - a.litros);
    } catch (e) { console.error('[LechePorRebano]', e); return []; }
  },

  /** Datos de Subvenciones PAC desde documentos_legales */
  async _obtenerDatosPAC(fId) {
    try {
      const docs = await window.db.getAll('documentos_legales').catch(() => []);
      const pac = docs.filter(d => d.tipo === 'pac');
      const totalSolicitado = pac.reduce((s, p) => s + (p.importe_solicitado || 0), 0);
      const totalCobrado = pac.reduce((s, p) => s + (p.importe_cobrado || 0), 0);
      const totalPendiente = totalSolicitado - totalCobrado;
      const porAnio = {};
      pac.forEach(p => {
        const a = p.anio || '—';
        if (!porAnio[a]) porAnio[a] = { anio: a, solicitado: 0, cobrado: 0, num: 0 };
        porAnio[a].solicitado += p.importe_solicitado || 0;
        porAnio[a].cobrado += p.importe_cobrado || 0;
        porAnio[a].num++;
      });
      return {
        registros: pac.sort((a, b) => (b.anio || '0') - (a.anio || '0')),
        totalSolicitado, totalCobrado, totalPendiente,
        numRegistros: pac.length,
        porAnio: Object.values(porAnio).sort((a, b) => b.anio - a.anio)
      };
    } catch (e) { console.error('[PAC]', e); return { registros: [], totalSolicitado: 0, totalCobrado: 0, totalPendiente: 0, numRegistros: 0, porAnio: [] }; }
  },

  /** Stock actual de tanques de leche */
  async _obtenerStockTanques(fId) {
    try {
      return await window.BalanceLacteo.getTanqueConStock(fId);
    } catch (e) {
      console.error('[StockTanques]', e);
      return [];
    }
  },

  /** Último control lechero registrado */
  async _obtenerControlLechero(fId) {
    try {
      const registros = await window.db.getAllFromIndex('control_lechero', 'fincaId', Number(fId));
      if (!registros || registros.length === 0) return {};
      const sorted = registros.sort((a, b) => new Date(b.fecha_control) - new Date(a.fecha_control));
      return sorted[0];
    } catch (e) {
      console.error('[ControlLechero]', e);
      return {};
    }
  },

  /** Margen animal medio por animal en la finca */
  async _obtenerMargenAnimalMedio(fId) {
    try {
      const margenes = await window.MargenAnimal.calcularParaFinca(fId);
      if (!margenes || margenes.length === 0) return { promedio: 0, total: 0, count: 0 };
      const total = margenes.reduce((sum, m) => sum + (m.margenNeto || 0), 0);
      const promedio = total / margenes.length;
      return { promedio, total, count: margenes.length };
    } catch (e) {
      console.error('[MargenAnimalMedio]', e);
      return { promedio: 0, total: 0, count: 0 };
    }
  },

  /** Rendimiento de leche por animal (litros por animal-día) */
  async _obtenerRendimientoLechePorAnimal(fId) {
    try {
      const controles = await window.db.getAllFromIndex('control_lechero', 'fincaId', Number(fId));
      return window.InformesAnalytics.calcularRendimientoLecheDesdeRegistros(controles);
    } catch (e) {
      console.error('[RendimientoLechePorAnimal]', e);
      return { promedio: 0, totalLitros: 0, totalAnimalesDias: 0 };
    }
  },

  /** Índice de renovación del ganado (porcentaje) */
  async _obtenerIndiceRenuevo(fId) {
    try {
      // Get all animals for the finca
      // We need to get animals by fincaId. Since we don't have a direct index, we can get by rebano?
      // Alternative: get all rebanos for the finca, then get animals by rebanoId.
      const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', Number(fId));
      if (!rebanos || rebanos.length === 0) {
        return { promedio: 0, totalAnimales: 0, nuevasEntradas: 0 };
      }

      let animales = [];
      for (const rebano of rebanos) {
        const animalesRebano = await window.db.getAllFromIndex('animales', 'rebanoId', rebano.id);
        animales = animales.concat(animalesRebano);
      }

      if (!animales || animales.length === 0) {
        return { promedio: 0, totalAnimales: 0, nuevasEntradas: 0 };
      }

      const unoJa = new Date();
      unoJa.setFullYear(unoJa.getFullYear() - 1);
      const fechaUnYearAgo = unoJa.toISOString().split('T')[0];

      let totalAnimales = animales.length;
      let nuevasEntradas = 0;
      let sumaDiasEnEstablo = 0;

      for (const animal of animales) {
        const fechaAlta = animal.fecha_alta;
        if (fechaAlta && fechaAlta >= fechaUnYearAgo) {
          nuevasEntradas++;
        }
        // For simplicity, we assume each animal has been in the herd for the entire year if fecha_alta is within the year,
        // or for the time since fecha_alta if it's older than a year?
        // We don't have fecha_baja, so we assume the animal is still in the herd.
        // We'll calculate the days since fecha_alta until today, but capped at 365 days.
        if (fechaAlta) {
          const fechaAltaDate = new Date(fechaAlta);
          const hoy = new Date();
          let dias = Math.floor((hoy - fechaAltaDate) / (1000 * 60 * 60 * 24));
          // Cap at 365 days for the year calculation
          dias = Math.min(dias, 365);
          sumaDiasEnEstablo += dias;
        }
      }

      const promedioAnimales = sumaDiasEnEstablo / 365;
      const indiceRenuevo = promedioAnimales > 0 ? (nuevasEntradas / promedioAnimales) * 100 : 0;

      return {
        promedio: parseFloat(indiceRenuevo.toFixed(2)),
        totalAnimales,
        nuevasEntradas
      };
    } catch (e) {
      console.error('[IndiceRenuevo]', e);
      return { promedio: 0, totalAnimales: 0, nuevasEntradas: 0 };
    }
  },

  /** Costo de producción de leche (€/L) */
  async _obtenerCostoProduccionLeche(fId) {
    try {
      const margenAnimalData = await window.MargenAnimal.calcularParaFinca(fId);
      return window.InformesAnalytics.sumarCostosSanidadSobreLitros(margenAnimalData);
    } catch (e) {
      console.error('[CostoProduccionLeche]', e);
      return { costoPorLitro: 0, totalCostosSanidad: 0, totalLitrosLeche: 0 };
    }
  },

  /** Silos de la finca: stock actual vs. capacidad, % ocupación, alertas de stock bajo (<20%) */
  async _obtenerSilos(fId) {
    try {
      const silos = await window.db.getAllFromIndex('config_silos', 'fincaId', Number(fId));
      if (!silos || silos.length === 0) return { silos: [], totalCapacidad: 0, totalStock: 0, alertasStockBajo: 0 };

      const conPct = silos.map(s => {
        const capacidad = Number(s.capacidad) || 0;
        const stock = Number(s.cantidadActual) || 0;
        const pct = capacidad > 0 ? Math.round((stock / capacidad) * 100) : 0;
        return { id: s.id, nombre: s.nombre || 'Silo', alimento: s.alimento || '', capacidad, stock, pct };
      });

      return {
        silos: conPct,
        totalCapacidad: conPct.reduce((s, x) => s + x.capacidad, 0),
        totalStock: conPct.reduce((s, x) => s + x.stock, 0),
        alertasStockBajo: conPct.filter(x => x.pct < 20).length
      };
    } catch (e) {
      console.error('[Silos]', e);
      return { silos: [], totalCapacidad: 0, totalStock: 0, alertasStockBajo: 0 };
    }
  },

  /** Trámites y estado sanitario: último saneamiento por campaña + restricciones de movimiento activas */
  async _obtenerTramites(fId) {
    try {
      const saneamientos = await window.Saneamientos.list({ fincaId: Number(fId) });
      if (!saneamientos || saneamientos.length === 0) {
        return { porCampana: [], restriccionesActivas: 0, totalSaneamientos: 0 };
      }

      // Último saneamiento (por fecha) de cada campaña
      const porCampanaMap = new Map();
      for (const s of saneamientos) {
        const actual = porCampanaMap.get(s.campana);
        if (!actual || new Date(s.fecha) > new Date(actual.fecha)) {
          porCampanaMap.set(s.campana, s);
        }
      }
      const porCampana = Array.from(porCampanaMap.values());

      return {
        porCampana,
        restriccionesActivas: saneamientos.filter(s => s.restriccion_movimientos).length,
        totalSaneamientos: saneamientos.length
      };
    } catch (e) {
      console.error('[Tramites]', e);
      return { porCampana: [], restriccionesActivas: 0, totalSaneamientos: 0 };
    }
  },

  /** Contratos de compra/venta próximos a vencer (dentro de 60 días) o ya vencidos */
  async _obtenerContratosVencimiento(fId) {
    try {
      if (!window.Contratos) return { contratos: [], proximosAVencer: 0, vencidos: 0 };
      const todos = await window.Contratos.list();
      // Ni contratos_compra ni compradores tienen fincaId propio en este modelo de
      // datos (son globales a la instalación, igual que MargenAnimal._precioLecheVigente()
      // los trata) — no se filtra por finca, se listan todos los contratos existentes.
      const compradores = window.Compradores ? await window.Compradores.list() : [];

      const hoy = new Date();
      const en60dias = new Date(hoy.getTime() + 60 * 24 * 60 * 60 * 1000);

      const contratos = (todos || [])
        .map(c => {
          const comprador = compradores.find(cp => cp.id === c.compradorId);
          const fechaFin = c.fecha_fin ? new Date(c.fecha_fin) : null;
          const vencido = fechaFin && fechaFin < hoy;
          const proximoAVencer = fechaFin && !vencido && fechaFin <= en60dias;
          const diasRestantes = fechaFin ? Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24)) : null;
          return {
            id: c.id, numero_contrato: c.numero_contrato, tipo: c.tipo,
            comprador: comprador?.nombre || 'Desconocido',
            fecha_fin: c.fecha_fin, diasRestantes, vencido, proximoAVencer
          };
        })
        .sort((a, b) => (a.diasRestantes ?? Infinity) - (b.diasRestantes ?? Infinity));

      return {
        contratos,
        proximosAVencer: contratos.filter(c => c.proximoAVencer).length,
        vencidos: contratos.filter(c => c.vencido).length
      };
    } catch (e) {
      console.error('[ContratosVencimiento]', e);
      return { contratos: [], proximosAVencer: 0, vencidos: 0 };
    }
  },

  // ===================== LOADERS NUEVOS (Fase B) =====================

  async _obtenerProduccion(fincaId) {
    try {
      const eventos = await window.db.getAllFromIndex('registro_eventos', 'fincaId', Number(fincaId)).catch(() => []);
      if (!eventos?.length) return { porTipo: [], total: 0, timeline: [] };
      const hoy = new Date();
      const hace90d = new Date(hoy.getTime() - 90 * 24 * 60 * 60 * 1000);
      const recientes = eventos.filter(e => new Date(e.fecha) >= hace90d);
      const porTipo = {};
      recientes.forEach(e => {
        const tipo = e.motivo_tarea || 'otro';
        if (!porTipo[tipo]) porTipo[tipo] = { tipo, count: 0, totalKg: 0, totalLitros: 0 };
        porTipo[tipo].count++;
        // registro_eventos usa un único campo valor_neto + unidad ('kg'/'L'/'€'...), no
        // peso_kg/cantidad_litros separados (ver js/pesajes.js, js/produccion.js).
        if (e.unidad === 'kg') porTipo[tipo].totalKg += (e.valor_neto || 0);
        if (e.unidad === 'L') porTipo[tipo].totalLitros += (e.valor_neto || 0);
      });
      return {
        porTipo: Object.values(porTipo).sort((a, b) => b.count - a.count),
        total: recientes.length,
        timeline: recientes
          .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
          .map(e => ({ fecha: e.fecha, tipo: e.motivo_tarea || 'otro', cantidad: e.valor_neto || 0 }))
      };
    } catch (e) {
      console.error('[Produccion]', e);
      return { porTipo: [], total: 0, timeline: [] };
    }
  },

  async _obtenerGastosOperativos(fincaId) {
    try {
      const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fincaId)).catch(() => []);
      if (!gastos?.length) return { porCategoria: [], porProveedor: [], porMes: [] };
      const cats = ['Alimentacion', 'Sanidad', 'Fitosanitarios', 'Electricidad', 'Personal', 'Amortizacion'];
      const porCat = {};
      const porProv = {};
      const porMes = {};
      gastos.forEach(g => {
        const cat = g.categoria || 'Otros';
        const proveedor = g.proveedorId || 'N/D';
        const mes = (g.fecha || '').slice(0, 7);
        porCat[cat] = (porCat[cat] || 0) + (g.monto || 0);
        porProv[proveedor] = (porProv[proveedor] || 0) + (g.monto || 0);
        if (mes) porMes[mes] = (porMes[mes] || 0) + (g.monto || 0);
      });
      return {
        porCategoria: Object.entries(porCat).map(([c, t]) => ({ categoria: c, total: t })).sort((a, b) => b.total - a.total),
        porProveedor: Object.entries(porProv).map(([p, t]) => ({ proveedor: p, total: t })).sort((a, b) => b.total - a.total),
        porMes: Object.entries(porMes).map(([m, t]) => ({ mes: m, total: t })).sort((a, b) => a.mes.localeCompare(b.mes))
      };
    } catch (e) {
      console.error('[GastosOperativos]', e);
      return { porCategoria: [], porProveedor: [], porMes: [] };
    }
  },

  async _obtenerMargenes(fincaId) {
    try {
      const [ventas, entregas] = await Promise.all([
        window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId)).catch(() => []),
        window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId)).catch(() => [])
      ]);
      const ingresoCarne = ventas.reduce((s, v) => s + (v.precio_total || 0), 0);
      const gastoTransporte = ventas.reduce((s, v) => s + (parseFloat(v.Gasto_Transporte) || 0), 0);
      const gastoMatanza = ventas.reduce((s, v) => s + (parseFloat(v.Gasto_Matanza) || 0), 0);
      const margenCarneNeto = ingresoCarne - gastoTransporte - gastoMatanza;
      const ingresosLeche = entregas.reduce((s, e) => s + (e.importe_total || 0), 0);
      const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []);
      const gastosAlim = gastos.filter(g => {
        const cat = (g.categoria || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        return cat.includes('aliment') && !g.anulado;
      });
      const fechasRecogida = entregas.map(e => new Date(e.fechaRecogida || e.fecha)).filter(d => !isNaN(d));
      let mofaLeche = 0;
      if (fechasRecogida.length > 0) {
        const fechaMin = new Date(Math.min(...fechasRecogida));
        const fechaMax = new Date(Math.max(...fechasRecogida));
        const totalGastosAlim = gastosAlim.reduce((s, g) => {
          const fGasto = new Date(g.fecha);
          return (fGasto >= fechaMin && fGasto <= fechaMax) ? s + (parseFloat(g.monto) || 0) : s;
        }, 0);
        mofaLeche = ingresosLeche - totalGastosAlim;
      }
      return { margenCarneNeto, mofaLeche, margenTotal: margenCarneNeto + mofaLeche };
    } catch (e) {
      console.error('[Margenes]', e);
      return { margenCarneNeto: 0, mofaLeche: 0, margenTotal: 0 };
    }
  },

  async _obtenerAlbaranes(fincaId) {
    try {
      const [leche, carne] = await Promise.all([
        window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId)).catch(() => []),
        window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId)).catch(() => [])
      ]);
      const albaranes = [];
      leche.forEach(e => {
        albaranes.push({
          fecha: e.fechaRecogida || e.fecha,
          tipo: 'Leche',
          importe: e.importe_total || 0,
          cantidad: e.cantidad || 0,
          estado: e.estado || 'entregado',
          id: e.id
        });
      });
      carne.forEach(v => {
        albaranes.push({
          fecha: v.fechaSacrificio || v.fecha,
          tipo: 'Carne',
          importe: v.precio_total || 0,
          cantidad: v.pesoCanal || v.pesoVivo || 0,
          estado: v.estado || 'entregado',
          id: v.id
        });
      });
      return albaranes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } catch (e) {
      console.error('[Albaranes]', e);
      return [];
    }
  },

  async _obtenerBotiquinStock(fincaId) {
    try {
      const productos = await window.db.getAllFromIndex('config_botiquin', 'fincaId', Number(fincaId)).catch(() => []);
      const lotes = await window.db.getAll('botiquin_lotes').catch(() => []);
      const hoy = new Date();
      const proximos30d = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
      const stockBajo = productos.filter(p => (p.cantidadActual || 0) < (p.cantidadMinima || 0));
      const proxCaducar = productos.filter(p => {
        if (!p.caducidad) return false;
        const cad = new Date(p.caducidad);
        return cad >= hoy && cad <= proximos30d;
      });
      return {
        productos,
        lotes,
        stockBajo: stockBajo.map(p => ({ ...p, alerta: 'stock_bajo' })),
        proxCaducar: proxCaducar.map(p => ({ ...p, alerta: 'caducidad_proxima' })),
        totalProductos: productos.length,
        totalLotes: lotes.length
      };
    } catch (e) {
      console.error('[BotiquinStock]', e);
      return { productos: [], lotes: [], stockBajo: [], proxCaducar: [], totalProductos: 0, totalLotes: 0 };
    }
  }

});
