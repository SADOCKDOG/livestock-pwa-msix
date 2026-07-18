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

});
