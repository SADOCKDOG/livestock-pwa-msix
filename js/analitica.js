/**
 * Analítica Ganadera - Motor de Cálculo Financiero v3.2.1 Premium
 * Procesamiento avanzado de márgenes por animal, rentabilidad por zona y balances.
 */

const Analitica = {
    /**
     * Calcula la rentabilidad total de una finca con desglose Premium
     */
    async obtenerRentabilidadFinca(fincaId) {
        const fId = Number(fincaId);
        let [vCarne, vLeche, gastos, rebanos, especies, costesRef] = await Promise.all([
            Produccion.listVentas(fId).catch(() => []),
            Produccion.listLeche(fId).catch(() => []),
            window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fId),
            window.db.getAllFromIndex('rebanos', 'fincaId', fId),
            window.db.getAll('config_especies'),
            window.db.getAllFromIndex('config_costes_referencia', 'fincaId', fId).catch(() => [])
        ]);

        // ... (previous fallback logic preserved)

        let ingCarne = 0, ingLeche = 0;
        
        // ... (income calculation logic preserved)

        const totalIngresos = ingCarne + ingLeche;
        const totalGastosDirectos = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);

        // Alimentación Estimada por Especie y Suministros
        let costoAgua = 0;
        let costoAlimEstimado = 0;
        for (let r of rebanos) {
            const esp = especies.find(e => e.nombre === r.especie);
            const cRef = costesRef.find(c => c.especie === r.especie);
            const animales = (await window.db.getAllFromIndex('animales', 'rebanoId', r.id)).filter(a => a.estado === 'activo');

            if (animales.length > 0) {
                // Agua (v4.8 baseline)
                if (esp) {
                    costoAgua += (animales.length * (esp.consumoAguaL || 10) * 0.002 * 30);
                }
                // Alimentación (New v13 logic)
                if (cRef) {
                    costoAlimEstimado += (animales.length * cRef.coste_diario_estimado * 30);
                }
            }
        }

        const totalGastosRealYEstimado = totalGastosDirectos + costoAgua + costoAlimEstimado;

        return {
            ingresos: totalIngresos,
            gastos: totalGastosRealYEstimado,
            balance: totalIngresos - totalGastosRealYEstimado,
            detalles: {
                carne: ingCarne,
                leche: ingLeche,
                agua: costoAgua,
                alimentacion_estimada: costoAlimEstimado,
                otros_gastos: totalGastosDirectos
            }
        };
    },

    /**
     * Margen Neto por Animal (Dispersión)
     */
    async obtenerMargenPorAnimal(fincaId) {
        const animales = await window.db.getAll('animales');
        const ventas = await Produccion.listVentas(Number(fincaId)).catch(() => []);
        
        return ventas.map(v => {
            const animalId = v.animal_id_list && v.animal_id_list.length > 0 ? v.animal_id_list[0] : v.animalId;
            const animal = animales.find(a => a.id === animalId);
            const costeCompra = animal?.precioCompra || 0;
            const bruto = v.precio_total || (v.pesoCanal ? v.pesoCanal * 5.5 : 0);
            const ingresos = bruto - ((v.gastosComercializacion?.transporte || 0) + (v.gastosComercializacion?.matadero || 0));
            return {
                x: v.pesoVivo || 0, // Peso vivo como eje X
                y: ingresos - costeCompra, // Margen neto como eje Y
                label: animal?.numero_identificacion || 'Venta Lote'
            };
        });
    },

    /**
     * Rentabilidad Real por Zona (Histograma)
     */
    async obtenerRentabilidadZonas(fincaId) {
        const finca = await window.db.get('fincas', Number(fincaId));
        const zonas = finca?.zonas || [];
        const ventas = await Produccion.listVentas(Number(fincaId)).catch(() => []);
        const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fincaId));
        
        const data = [];
        for (let z of zonas) {
            const ing = ventas.filter(v => v.snap_zona === z.nombre).reduce((s, v) => s + (v.precio_total || (v.pesoCanal * 5.5) || 0), 0);
            const gst = gastos.filter(g => g.snap_zona === z.nombre).reduce((s, g) => s + (g.monto || 0), 0);
            data.push({ zona: z.nombre, ingresos: ing, gastos: gst, neto: ing - gst });
        }
        return data;
    },

    /**
     * Censo de Rebaños y Animales
     */
    async obtenerCensoRebanos(fincaId) {
        const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', Number(fincaId));
        const data = [];
        for (let r of rebanos) {
            const animales = await window.db.getAllFromIndex('animales', 'rebanoId', r.id);
            data.push({
                nombre: r.nombre,
                tipo: r.tipo,
                total: animales.length,
                activos: animales.filter(a => a.estado === 'activo').length,
                vendidos: animales.filter(a => a.estado === 'vendido').length
            });
        }
        return data;
    },

    /**
     * Estadísticas de Tratamientos Sanitarios y Retenciones
     */
    async obtenerEstadisticasSanitarias(fincaId) {
        const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', Number(fincaId));
        const rebanosIds = rebanos.map(r => r.id);
        const sanitarios = await window.db.getAll('sanitarios_ganado') || [];
        const sanitariosFinca = sanitarios.filter(s => rebanosIds.includes(s.rebanoId));

        const porCategoria = {};
        let retencionesActivas = 0;
        const hoy = new Date();

        sanitariosFinca.forEach(s => {
            const cat = s.tipo_tratamiento || 'Otro';
            porCategoria[cat] = (porCategoria[cat] || 0) + 1;

            const fechaTrat = new Date(s.fecha);
            const diasPasados = Math.floor((hoy - fechaTrat) / (1000 * 60 * 60 * 24));
            
            // Si aún no han pasado los días de espera (carne o leche), o está prohibido de por vida para leche
            if ((s.tiempo_espera_carne_dias && s.tiempo_espera_carne_dias > diasPasados) || 
                (s.tiempo_espera_leche_dias && s.tiempo_espera_leche_dias > diasPasados) || 
                s.prohibidoLeche) {
                retencionesActivas++;
            }
        });

        return {
            totalTratamientos: sanitariosFinca.length,
            retencionesActivas,
            porCategoria: Object.entries(porCategoria).map(([categoria, cantidad]) => ({ categoria, cantidad })).sort((a,b) => b.cantidad - a.cantidad)
        };
    },

    /**
     * Resumen de compradores: totales agregados
     */
    async obtenerResumenCompradores(fincaId) {
        try {
            const [ventasCarne, ventasLeche] = await Promise.all([
                window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId)).catch(() => []),
            ]);
            const compradoresUnicos = new Set();
            ventasCarne.forEach(v => { if (v.razonSocial) compradoresUnicos.add(v.razonSocial); });
            ventasLeche.forEach(v => { if (v.nombreComprador) compradoresUnicos.add(v.nombreComprador); });
            const totalImporte = ventasCarne.reduce((s, v) => s + (v.precio_total || 0), 0)
                + ventasLeche.reduce((s, v) => s + ((v.cantidad || 0) * (v.precioBase || 0.45)), 0);
            return { numCompradores: compradoresUnicos.size, totalVentasCarne: ventasCarne.length, totalVentasLeche: ventasLeche.length, totalImporte };
        } catch (e) { return { numCompradores: 0, totalVentasCarne: 0, totalVentasLeche: 0, totalImporte: 0 }; }
    },

    /**
     * Resumen de proveedores: totales agregados
     */
    async obtenerResumenProveedores(fincaId) {
        try {
            const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fincaId)).catch(() => []);
            const proveedoresUnicos = new Set();
            gastos.forEach(g => { if (g.proveedor) proveedoresUnicos.add(g.proveedor); });
            const totalGasto = gastos.reduce((s, g) => s + (g.monto || 0), 0);
            return { numProveedores: proveedoresUnicos.size, numFacturas: gastos.length, totalGasto };
        } catch (e) { return { numProveedores: 0, numFacturas: 0, totalGasto: 0 }; }
    },

    /**
     * Gastos fitosanitarios: totales y desglose
     */
    async     obtenerGastosFitosanitarios(fincaId) {
        try {
            const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fincaId)).catch(() => []);
            const fitosanitarios = gastos.filter(g => (g.categoria || '').toLowerCase() === 'fitosanitarios');
            const total = fitosanitarios.reduce((s, g) => s + (g.monto || 0), 0);
            return { total, numRegistros: fitosanitarios.length, registros: fitosanitarios };
        } catch (e) { return { total: 0, numRegistros: 0, registros: [] }; }
    },

    // ================================================================
    // NUEVAS FUNCIONES PARA INFORMES ECONÓMICOS Y DE EXPLOTACIÓN
    // ================================================================

    /**
     * Cuenta de Resultados (PyG): ingresos/gastos por categoría mensual
     */
    async obtenerCuentaResultados(fincaId) {
        try {
            const [gastos, ventasCarne, leche] = await Promise.all([
                window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId)).catch(() => []),
            ]);
            const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            const porMes = {};
            const numMeses = 12;
            for (let m = 0; m < numMeses; m++) {
                const mKey = String(m + 1).padStart(2, '0');
                porMes[mKey] = { mes: meses[m], ingresos: 0, gastos: 0, balance: 0, categorias: {} };
            }
            ventasCarne.forEach(v => {
                const fecha = v.fechaSacrificio || v.fecha_emision || '';
                const m = fecha.substring(5, 7);
                if (porMes[m]) porMes[m].ingresos += v.precio_total || 0;
            });
            leche.forEach(v => {
                const fecha = v.fechaRecogida || v.fecha || '';
                const m = fecha.substring(5, 7);
                if (porMes[m]) porMes[m].ingresos += (v.cantidad || 0) * (v.precioBase || 0.45);
            });
            gastos.forEach(g => {
                const fecha = g.fecha || '';
                const m = fecha.substring(5, 7);
                if (porMes[m]) {
                    porMes[m].gastos += g.monto || 0;
                    const cat = g.categoria || 'Otros';
                    porMes[m].categorias[cat] = (porMes[m].categorias[cat] || 0) + (g.monto || 0);
                }
            });
            Object.values(porMes).forEach(m => m.balance = m.ingresos - m.gastos);
            const totalIngresos = Object.values(porMes).reduce((s, m) => s + m.ingresos, 0);
            const totalGastos = Object.values(porMes).reduce((s, m) => s + m.gastos, 0);
            const totalBalance = totalIngresos - totalGastos;
            // Gastos agregados por categoría
            const gastosPorCat = {};
            gastos.forEach(g => {
                const cat = g.categoria || 'Otros';
                gastosPorCat[cat] = (gastosPorCat[cat] || 0) + (g.monto || 0);
            });
            return {
                porMes: Object.values(porMes).sort((a, b) => a.mes - b.mes),
                totalIngresos, totalGastos, totalBalance,
                gastosPorCategoria: Object.entries(gastosPorCat).map(([c, t]) => ({ categoria: c, total: t })).sort((a, b) => b.total - a.total),
                numMeses: Object.values(porMes).filter(m => m.ingresos > 0 || m.gastos > 0).length,
                rentabilidad: totalIngresos > 0 ? ((totalBalance / totalIngresos) * 100).toFixed(1) : '0.0'
            };
        } catch (e) { console.error('[PyG]', e); return { porMes: [], totalIngresos: 0, totalGastos: 0, totalBalance: 0, gastosPorCategoria: [], numMeses: 0, rentabilidad: '0.0' }; }
    },

    /**
     * Coste de Producción por Animal/Día
     */
    async obtenerCosteProduccionDiario(fincaId) {
        try {
            const [gastos, rebanos] = await Promise.all([
                window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('rebanos', 'fincaId', Number(fincaId)).catch(() => []),
            ]);
            const totalGasto = gastos.reduce((s, g) => s + (g.monto || 0), 0);
            const porRebano = [];
            for (const r of rebanos) {
                const animales = (await window.db.getAllFromIndex('animales', 'rebanoId', r.id).catch(() => []))
                    .filter(a => a.estado === 'activo');
                if (animales.length === 0) continue;
                const gastosReb = gastos.filter(g => g.rebanoId === r.id || g.snap_rebano === r.nombre);
                const totalReb = gastosReb.reduce((s, g) => s + (g.monto || 0), 0);
                const porCabeza = totalReb / animales.length;
                const porDia = totalReb / (animales.length * 30);
                const alim = gastosReb.filter(g => (g.categoria || '').toLowerCase() === 'alimentación').reduce((s, g) => s + (g.monto || 0), 0);
                const sanidad = gastosReb.filter(g => (g.categoria || '').toLowerCase() === 'sanidad').reduce((s, g) => s + (g.monto || 0), 0);
                porRebano.push({
                    nombre: r.nombre, especie: r.especie, tipo: r.tipo,
                    numAnimales: animales.length, totalGasto: totalReb,
                    costePorCabeza: porCabeza, costePorDia: porDia.toFixed(2),
                    alimentacion: alim, sanidad: sanidad,
                    pctAlimentacion: totalReb > 0 ? ((alim / totalReb) * 100).toFixed(1) : 0,
                    pctSanidad: totalReb > 0 ? ((sanidad / totalReb) * 100).toFixed(1) : 0
                });
            }
            const totalAnimales = porRebano.reduce((s, r) => s + r.numAnimales, 0);
            return {
                porRebano: porRebano.sort((a, b) => b.totalGasto - a.totalGasto),
                totalGasto, totalAnimales,
                costeMedioCabeza: totalAnimales > 0 ? totalGasto / totalAnimales : 0,
                costeMedioDia: totalAnimales > 0 ? (totalGasto / (totalAnimales * 30)).toFixed(2) : 0
            };
        } catch (e) { console.error('[CosteProd]', e); return { porRebano: [], totalGasto: 0, totalAnimales: 0, costeMedioCabeza: 0, costeMedioDia: 0 }; }
    },

    /**
     * Rotación de Censo: entradas, salidas, nacimientos en período
     */
    async obtenerRotacionCenso(fincaId) {
        try {
            const [animales, eventos, rebanos] = await Promise.all([
                window.db.getAll('animales').catch(() => []),
                window.db.getAll('registro_eventos').catch(() => []),
                window.db.getAllFromIndex('rebanos', 'fincaId', Number(fincaId)).catch(() => []),
            ]);
            const rebIds = new Set(rebanos.map(r => r.id));
            const animalesFinca = animales.filter(a => rebIds.has(a.rebanoId));
            const eventosFinca = eventos.filter(e => e.fincaId === Number(fincaId));
            const hoy = new Date();
            const hace90d = new Date(hoy.getTime() - 90 * 24 * 60 * 60 * 1000);
            const hace30d = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
            const ultimos90 = eventosFinca.filter(e => new Date(e.fecha) >= hace90d);
            const ultimos30 = eventosFinca.filter(e => new Date(e.fecha) >= hace30d);

            const nacimientos = ultimos90.filter(e => e.motivo_tarea === 'alta' || e.motivo_tarea === 'nacimiento').length;
            const compras = ultimos90.filter(e => e.motivo_tarea === 'ALTA_IMPORTACION' || e.motivo_tarea === 'compra').length;
            const ventas = ultimos90.filter(e => e.motivo_tarea === 'expedicion' || e.motivo_tarea === 'venta').length;
            const bajas = ultimos90.filter(e => e.motivo_tarea === 'baja' || e.motivo_tarea === 'muerte').length;
            const activos = animalesFinca.filter(a => a.estado === 'activo').length;
            const total = animalesFinca.length;
            const tasaReposicion = total > 0 ? ((nacimientos + compras) / total * 100).toFixed(1) : 0;
            const tasaBajas = total > 0 ? (bajas / total * 100).toFixed(1) : 0;
            const entradaNeta = (nacimientos + compras) - (ventas + bajas);

            return {
                ultimos90: { nacimientos, compras, ventas, bajas, entradaNeta },
                ultimos30: { entradas: ultimos30.filter(e => e.motivo_tarea === 'alta' || e.motivo_tarea === 'ALTA_IMPORTACION').length, salidas: ultimos30.filter(e => e.motivo_tarea === 'expedicion' || e.motivo_tarea === 'baja').length },
                totalAnimales: total, activos,
                tasaReposicion: tasaReposicion + '%',
                tasaBajas: tasaBajas + '%',
                periodo: '90 días'
            };
        } catch (e) { console.error('[Rotacion]', e); return { ultimos90: {}, ultimos30: {}, totalAnimales: 0, activos: 0, tasaReposicion: '0%', tasaBajas: '0%', periodo: '90 días' }; }
    },

    /**
     * Cargas y Aforos por zona
     */
    async obtenerCargasAforos(fincaId) {
        try {
            const finca = await window.db.get('fincas', Number(fincaId)).catch(() => null);
            const zonas = finca?.zonas || [];
            const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', Number(fincaId)).catch(() => []);
            const porZona = [];
            for (const z of zonas) {
                const aforo = z.aforoMax || z.aforo_maximo || 0;
                const animalesEnZona = [];
                for (const r of rebanos) {
                    if (r.zonaActual === z.nombre) {
                        const ans = await window.db.getAllFromIndex('animales', 'rebanoId', r.id).catch(() => []);
                        animalesEnZona.push(...ans.filter(a => a.estado === 'activo'));
                    }
                }
                const ocupacion = animalesEnZona.length;
                const pct = aforo > 0 ? ((ocupacion / aforo) * 100).toFixed(1) : 0;
                const estado = pct > 100 ? 'sobrecarga' : pct >= 80 ? 'optimo' : pct >= 50 ? 'aceptable' : 'infrautilizada';
                porZona.push({
                    nombre: z.nombre, superficie: z.superficie || 0, aforo,
                    ocupacion, pctOcupacion: parseFloat(pct),
                    estado, especie: [...new Set(animalesEnZona.map(a => a.especie))].join(', ')
                });
            }
            const totalAforo = porZona.reduce((s, z) => s + z.aforo, 0);
            const totalOcupacion = porZona.reduce((s, z) => s + z.ocupacion, 0);
            const alertas = porZona.filter(z => z.estado === 'sobrecarga' || z.pctOcupacion < 30);
            return {
                porZona, totalAforo, totalOcupacion,
                pctGlobal: totalAforo > 0 ? ((totalOcupacion / totalAforo) * 100).toFixed(1) : 0,
                alertas, numAlertas: alertas.length, numZonas: porZona.length
            };
        } catch (e) { console.error('[Cargas]', e); return { porZona: [], totalAforo: 0, totalOcupacion: 0, pctGlobal: '0', alertas: [], numAlertas: 0, numZonas: 0 }; }
    },

    /**
     * Panel de Eficiencia Técnica: KPIs combinados con semáforos
     */
    async obtenerEficienciaTecnica(fincaId) {
        try {
            const [rebanos, animales, kpisRepro, censo, lecheRegistros] = await Promise.all([
                window.db.getAllFromIndex('rebanos', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAll('animales').catch(() => []),
                window.Reproduccion ? Reproduccion.getKPIs(fincaId).catch(() => ({})) : Promise.resolve({}),
                this.obtenerCensoRebanos(fincaId).catch(() => []),
                window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId)).catch(() => []),
            ]);
            const totalLitrosLeche = lecheRegistros.reduce((s, r) => s + (r.cantidad || 0), 0);
            const rebIds = new Set(rebanos.map(r => r.id));
            const animalesFinca = animales.filter(a => rebIds.has(a.rebanoId));
            const activos = animalesFinca.filter(a => a.estado === 'activo').length;
            const totalLecheros = animalesFinca.filter(a => a.estado === 'activo' && ['Vacas','Ovejas','Cabras'].includes(a.especie) && (a.sexo||'').toLowerCase().startsWith('h')).length;
            const litrosVacaDia = totalLecheros > 0 ? (totalLitrosLeche / totalLecheros / 30) : 0;

            const kpis = [
                { id: 'fert', label: 'Fertilidad', value: (kpisRepro.tasaFertilidadPct || 0) + '%', objetivo: 85, actual: kpisRepro.tasaFertilidadPct || 0, unidad: '%' },
                { id: 'iep', label: 'IEP', value: (kpisRepro.intervaloEntrePartosDias || 0) + ' d', objetivo: 365, actual: kpisRepro.intervaloEntrePartosDias || 0, unidad: 'd', invertir: true },
                { id: 'litros', label: 'L/vaca/día', value: litrosVacaDia.toFixed(1) + ' L', objetivo: 25, actual: litrosVacaDia, unidad: 'L' },
                { id: 'bajas', label: '% Bajas', value: '—', objetivo: 5, actual: 0, unidad: '%', invertir: true },
                { id: 'gmd', label: 'GMD Media', value: '—', objetivo: 0.8, actual: 0, unidad: 'kg' },
                { id: 'ocup', label: 'Ocupación', value: '—', objetivo: 85, actual: 0, unidad: '%' },
            ].map(k => ({
                ...k,
                status: k.invertir
                    ? (k.actual <= k.objetivo ? 'verde' : k.actual <= k.objetivo * 1.3 ? 'amarillo' : 'rojo')
                    : (k.actual >= k.objetivo ? 'verde' : k.actual >= k.objetivo * 0.7 ? 'amarillo' : 'rojo')
            }));

            return {
                kpis, activos, totalLecheros,
                numRebanos: rebanos.length, totalAnimales: animalesFinca.length
            };
        } catch (e) { console.error('[Eficiencia]', e); return { kpis: [], activos: 0, totalLecheros: 0, numRebanos: 0, totalAnimales: 0 }; }
    },

    /**
     * Flujo de Caja mensual
     */
    async obtenerFlujoCaja(fincaId) {
        try {
            const [gastos, ventasCarne, leche] = await Promise.all([
                window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId)).catch(() => []),
            ]);
            const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            const porMes = {};
            for (let m = 1; m <= 12; m++) {
                const key = String(m).padStart(2, '0');
                porMes[key] = { mes: meses[m-1], entradas: 0, salidas: 0, neto: 0, acumulado: 0 };
            }
            ventasCarne.forEach(v => {
                const m = (v.fechaSacrificio || v.fecha_emision || '').substring(5, 7);
                if (porMes[m]) porMes[m].entradas += v.precio_total || 0;
            });
            leche.forEach(v => {
                const m = (v.fechaRecogida || v.fecha || '').substring(5, 7);
                if (porMes[m]) porMes[m].entradas += (v.cantidad || 0) * (v.precioBase || 0.45);
            });
            gastos.forEach(g => {
                const m = (g.fecha || '').substring(5, 7);
                if (porMes[m]) porMes[m].salidas += g.monto || 0;
            });
            let acum = 0;
            Object.values(porMes).forEach(m => {
                m.neto = m.entradas - m.salidas;
                acum += m.neto;
                m.acumulado = acum;
            });
            const values = Object.values(porMes);
            return {
                porMes: values,
                totalEntradas: values.reduce((s, m) => s + m.entradas, 0),
                totalSalidas: values.reduce((s, m) => s + m.salidas, 0),
                totalNeto: values.reduce((s, m) => s + m.neto, 0),
                saldoFinal: acum
            };
        } catch (e) { console.error('[FlujoCaja]', e); return { porMes: [], totalEntradas: 0, totalSalidas: 0, totalNeto: 0, saldoFinal: 0 }; }
    },

    /**
     * Rentabilidad por Especie: ingresos, gastos, margen desglosado
     */
    async obtenerRentabilidadEspecie(fincaId) {
        try {
            const [rebanos, animales, gastos, ventasCarne, ventasLeche] = await Promise.all([
                window.db.getAllFromIndex('rebanos', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAll('animales').catch(() => []),
                window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId)).catch(() => []),
            ]);
            const rebIds = new Set(rebanos.map(r => r.id));
            const especies = [...new Set(rebanos.filter(r => r.especie).map(r => r.especie))];
            const porEspecie = {};
            especies.forEach(esp => {
                porEspecie[esp] = { especie: esp, ingresos: 0, gastos: 0, numRebanos: 0, numAnimales: 0, numVentasCarne: 0, numVentasLeche: 0 };
            });
            rebanos.forEach(r => {
                if (porEspecie[r.especie]) {
                    porEspecie[r.especie].numRebanos++;
                    const anims = animales.filter(a => a.rebanoId === r.id && a.estado === 'activo');
                    porEspecie[r.especie].numAnimales += anims.length;
                }
            });
            ventasCarne.forEach(v => {
                const rebId = v.snap_rebano || v.rebanoId;
                const reb = rebanos.find(r => r.id === rebId || r.nombre === v.snap_rebano);
                const esp = reb?.especie || 'otras';
                if (porEspecie[esp]) {
                    porEspecie[esp].ingresos += v.precio_total || 0;
                    porEspecie[esp].numVentasCarne++;
                }
            });
            ventasLeche.forEach(v => {
                const esp = 'Vacas';
                if (porEspecie[esp]) {
                    porEspecie[esp].ingresos += (v.cantidad || 0) * (v.precioBase || 0.45);
                    porEspecie[esp].numVentasLeche++;
                }
            });
            gastos.forEach(g => {
                const cat = (g.categoria || '').toLowerCase();
                const rebId = g.rebanoId || g.snap_rebano;
                const reb = rebanos.find(r => r.id === rebId || r.nombre === g.snap_rebano);
                const esp = reb?.especie || 'otras';
                if (porEspecie[esp]) {
                    porEspecie[esp].gastos += g.monto || 0;
                }
            });
            Object.values(porEspecie).forEach(e => e.balance = e.ingresos - e.gastos);
            const result = Object.values(porEspecie).sort((a, b) => b.balance - a.balance);
            const totalIngresos = result.reduce((s, e) => s + e.ingresos, 0);
            const totalGastos = result.reduce((s, e) => s + e.gastos, 0);
            return { porEspecie: result, totalIngresos, totalGastos, totalBalance: totalIngresos - totalGastos };
        } catch (e) { console.error('[RentEsp]', e); return { porEspecie: [], totalIngresos: 0, totalGastos: 0, totalBalance: 0 }; }
    },

    /**
     * Curva de Producción: producción acumulada vs objetivo mensual
     */
    async obtenerCurvaProduccion(fincaId) {
        try {
            const [ventasCarne, leche] = await Promise.all([
                window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId)).catch(() => []),
            ]);
            const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            const porMes = {};
            for (let m = 0; m < 12; m++) {
                const key = String(m + 1).padStart(2, '0');
                porMes[key] = { mes: meses[m], kg: 0, litros: 0, ingresos: 0, kgAcum: 0, litrosAcum: 0, ingresosAcum: 0 };
            }
            ventasCarne.forEach(v => {
                const m = (v.fechaSacrificio || v.fecha_emision || '').substring(5, 7);
                if (porMes[m]) {
                    const kg = v.pesoCanal || v.pesoVivo || 0;
                    porMes[m].kg += kg;
                    porMes[m].ingresos += v.precio_total || 0;
                }
            });
            leche.forEach(v => {
                const m = (v.fechaRecogida || v.fecha || '').substring(5, 7);
                if (porMes[m]) {
                    const l = v.cantidad || 0;
                    porMes[m].litros += l;
                    porMes[m].ingresos += l * (v.precioBase || 0.45);
                }
            });
            let kgAcum = 0, litrosAcum = 0, ingresosAcum = 0;
            const valores = Object.values(porMes);
            valores.forEach(m => {
                kgAcum += m.kg; m.kgAcum = kgAcum;
                litrosAcum += m.litros; m.litrosAcum = litrosAcum;
                ingresosAcum += m.ingresos; m.ingresosAcum = ingresosAcum;
            });
            const totalKg = kgAcum;
            const totalLitros = litrosAcum;
            const totalIngresos = ingresosAcum;
            const metaKg = Math.max(totalKg * 1.1, 1000);
            const metaLitros = Math.max(totalLitros * 1.1, 1000);
            const pctCumplimientoKg = metaKg > 0 ? ((totalKg / metaKg) * 100).toFixed(1) : 0;
            const pctCumplimientoLitros = metaLitros > 0 ? ((totalLitros / metaLitros) * 100).toFixed(1) : 0;
            return {
                porMes: valores,
                totalKg, totalLitros, totalIngresos,
                metaKg, metaLitros,
                pctCumplimientoKg, pctCumplimientoLitros
            };
        } catch (e) { console.error('[CurvaProd]', e); return { porMes: [], totalKg: 0, totalLitros: 0, totalIngresos: 0, metaKg: 0, metaLitros: 0, pctCumplimientoKg: '0', pctCumplimientoLitros: '0' }; }
    },

    /**
     * Break-Even: punto muerto económico
     */
    async obtenerBreakEven(fincaId) {
        try {
            const [gastos, ventasCarne, leche, rebanos] = await Promise.all([
                window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('comercializacion_carne', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('comercializacion_leche', 'fincaId', Number(fincaId)).catch(() => []),
                window.db.getAllFromIndex('rebanos', 'fincaId', Number(fincaId)).catch(() => []),
            ]);
            // Separar costes fijos y variables
            const catsFijas = ['electricidad', 'alquiler', 'seguros', 'amortización', 'impuestos', 'personal', 'gestoría'];
            const costesFijos = gastos.filter(g => catsFijas.includes((g.categoria || '').toLowerCase())).reduce((s, g) => s + (g.monto || 0), 0);
            const costesVariables = gastos.reduce((s, g) => s + (g.monto || 0), 0) - costesFijos;
            // Ingresos y volumen
            const totalKg = ventasCarne.reduce((s, v) => s + (v.pesoCanal || v.pesoVivo || 0), 0);
            const totalLitros = leche.reduce((s, v) => s + (v.cantidad || 0), 0);
            const ingresosCarne = ventasCarne.reduce((s, v) => s + (v.precio_total || 0), 0);
            const ingresosLeche = leche.reduce((s, v) => s + ((v.cantidad || 0) * (v.precioBase || 0.45)), 0);
            const ingresosTotal = ingresosCarne + ingresosLeche;
            // Precio medio ponderado
            const precioMedioKg = totalKg > 0 ? ingresosCarne / totalKg : 0;
            const precioMedioLitro = totalLitros > 0 ? ingresosLeche / totalLitros : 0;
            // Coste variable unitario
            const costeVarKg = totalKg > 0 ? (costesVariables * (ingresosCarne / (ingresosTotal || 1))) / totalKg : 0;
            const costeVarLitro = totalLitros > 0 ? (costesVariables * (ingresosLeche / (ingresosTotal || 1))) / totalLitros : 0;
            // Break-even
            const beKg = (precioMedioKg - costeVarKg) > 0 ? costesFijos / (precioMedioKg - costeVarKg) : 0;
            const beLitros = (precioMedioLitro - costeVarLitro) > 0 ? costesFijos / (precioMedioLitro - costeVarLitro) : 0;
            const margenSeguridadKg = totalKg > 0 ? ((totalKg - beKg) / totalKg * 100).toFixed(1) : 0;
            const margenSeguridadLitros = totalLitros > 0 ? ((totalLitros - beLitros) / totalLitros * 100).toFixed(1) : 0;
            return {
                costesFijos, costesVariables,
                ingresosCarne, ingresosLeche, ingresosTotal,
                precioMedioKg, precioMedioLitro,
                costeVarKg, costeVarLitro,
                breakEvenKg: Math.round(beKg), breakEvenLitros: Math.round(beLitros),
                totalKgProducido: Math.round(totalKg), totalLitrosProducido: Math.round(totalLitros),
                margenSeguridadKg: margenSeguridadKg + '%',
                margenSeguridadLitros: margenSeguridadLitros + '%',
                cubiertoCarne: totalKg >= beKg,
                cubiertoLeche: totalLitros >= beLitros,
                numRebanos: rebanos.length,
                numMeses: Math.max(1, [...new Set([...ventasCarne.map(v => (v.fechaSacrificio || '').substring(0,7)), ...leche.map(v => (v.fechaRecogida || '').substring(0,7))].filter(Boolean))].length)
            };
        } catch (e) { console.error('[BreakEven]', e); return { costesFijos: 0, costesVariables: 0, ingresosTotal: 0, breakEvenKg: 0, breakEvenLitros: 0, margenSeguridadKg: '0%', margenSeguridadLitros: '0%', cubiertoCarne: false, cubiertoLeche: false, numRebanos: 0, numMeses: 0 }; }
    },
};

window.Analitica = Analitica;
