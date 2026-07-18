/**
 * Export & Reports Module - Livestock Manager
 * Exportación a Excel, PDF y generación de gráficos
 */

const Export = {
    /**
     * Exporta datos a Excel (.xlsx)
     */
    async toExcel(sheetData) {
        try {
            ErrorHandler.validateRequired('sheetData', sheetData, 'Data required for Excel export');

            if (typeof XLSX === 'undefined') await App._ensureXLSX();
            const workbook = XLSX.utils.book_new();
            
            if (Array.isArray(sheetData)) {
                sheetData.forEach((sheet, idx) => {
                    const worksheet = XLSX.utils.json_to_sheet(sheet.data);
                    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name || `Sheet${idx + 1}`);
                });
            } else {
                const worksheet = XLSX.utils.json_to_sheet(sheetData);
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
            }
            
            const fileName = `export_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            
            return { success: true, file: fileName };
        } catch (error) {
            return ErrorHandler.log(error, { action: 'toExcel' });
        }
    },

    /**
     * Exporta rebaños a Excel
     */
    async exportRebanos(fincaId) {
        return await ErrorHandler.tryAsync(async () => {
            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const actualFincaId = fincaId || fincaActivaId;
            
            const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', actualFincaId);
            
            const data = rebanos.map(r => ({
                ID: r.id,
                Nombre: r.nombre,
                Tipo: r.tipo,
                CapacidadTotal: r.capacidad_total,
                Creado: new Date(r.creadoEn).toLocaleDateString('es-ES'),
                Actualizado: new Date(r.actualizadoEn).toLocaleDateString('es-ES')
            }));
            
            return this.toExcel({ name: 'Rebaños', data });
        }, { action: 'exportRebanos' });
    },

    /**
     * Exporta animales con producción a Excel
     */
    async exportAnimales(rebanoId = null, fincaId = null) {
        return await ErrorHandler.tryAsync(async () => {
            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const actualFincaId = fincaId || fincaActivaId;
            
            let animales;
            if (rebanoId) {
                animales = await window.db.getAllFromIndex('animales', 'rebanoId', rebanoId);
            } else {
                const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', actualFincaId);
                let allAnimales = [];
                for (const r of rebanos) {
                    const rAnimales = await window.db.getAllFromIndex('animales', 'rebanoId', r.id);
                    allAnimales = allAnimales.concat(rAnimales);
                }
                animales = allAnimales;
            }
            
            const data = await Promise.all(animales.map(async (a) => {
                const produccion = await Produccion.listCarne(a.id);
                const ultimoRegistro = produccion.length > 0 ? produccion[produccion.length - 1] : {};
                
                return {
                    ID: a.id,
                    Caravana: a.numero_identificacion,
                    Raza: a.raza,
                    Edad: a.edad,
                    Sexo: a.sexo,
                    UltimoPeso: ultimoRegistro.peso || '-',
                    FechaUltimoPeso: ultimoRegistro.fecha ? new Date(ultimoRegistro.fecha).toLocaleDateString('es-ES') : '-',
                    Estado: a.estado || 'Activo'
                };
            }));
            
            return this.toExcel({ name: 'Animales', data });
        }, { action: 'exportAnimales' });
    },

    /**
     * Exporta producción de carne
     */
    async exportProduccionCarne(fincaId = null) {
        return await ErrorHandler.tryAsync(async () => {
            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const actualFincaId = fincaId || fincaActivaId;
            
            const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', actualFincaId);
            let allProduccion = [];
            
            for (const rebano of rebanos) {
                const animales = await window.db.getAllFromIndex('animales', 'rebanoId', rebano.id);
                for (const animal of animales) {
                    const prod = await Produccion.listCarne(animal.id);
                    allProduccion = allProduccion.concat(prod.map(p => ({
                        ...p,
                        animalCaravana: animal.numero_identificacion,
                        rebanonombre: rebano.nombre
                    })));
                }
            }
            
            const data = allProduccion.map(p => ({
                Fecha: new Date(p.fecha).toLocaleDateString('es-ES'),
                Animal: p.animalCaravana,
                Rebano: p.rebanonombre,
                Peso: p.peso,
                KgGanados: p.kg_ganados || '-'
            }));
            
            return this.toExcel({ name: 'Producción Carne', data });
        }, { action: 'exportProduccionCarne' });
    },

    /**
     * Exporta ventas de ganado
     */
    async exportVentas(fincaId = null) {
        return await ErrorHandler.tryAsync(async () => {
            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const actualFincaId = fincaId || fincaActivaId;
            
            const ventas = await Produccion.listVentas(actualFincaId);
            
            const data = ventas.map(v => ({
                Fecha: new Date(v.fecha).toLocaleDateString('es-ES'),
                Comprador: v.comprador,
                Animales: v.animal_id_list?.length || 0,
                PrecioTotal: `$${v.precio_total}`,
                Documentación: v.documentacion || '-'
            }));
            
            return this.toExcel({ name: 'Ventas', data });
        }, { action: 'exportVentas' });
    },

    /**
     * Exporta gastos
     */
    async exportGastos(fincaId = null) {
        return await ErrorHandler.tryAsync(async () => {
            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const actualFincaId = fincaId || fincaActivaId;
            
            const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', actualFincaId);
            
            const data = gastos.map(g => ({
                Fecha: new Date(g.fecha).toLocaleDateString('es-ES'),
                Concepto: g.concepto,
                Monto: `$${g.monto}`,
                Descripción: g.descripcion || '-'
            }));
            
            return this.toExcel({ name: 'Gastos', data });
        }, { action: 'exportGastos' });
    },

    /**
     * Exporta completo: múltiples sheets
     */
    async exportCompleto(fincaId = null) {
        return await ErrorHandler.tryAsync(async () => {
            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const actualFincaId = fincaId || fincaActivaId;
            
            // Rebaños
            const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', actualFincaId);
            const rebanosData = rebanos.map(r => ({
                Nombre: r.nombre,
                Tipo: r.tipo,
                Capacidad: r.capacidad_total
            }));
            
            // Animales
            let allAnimales = [];
            for (const r of rebanos) {
                const animales = await window.db.getAllFromIndex('animales', 'rebanoId', r.id);
                allAnimales = allAnimales.concat(animales);
            }
            const animalesData = allAnimales.map(a => ({
                Caravana: a.numero_identificacion,
                Raza: a.raza,
                Rebano: rebanos.find(r => r.id === a.rebanoId)?.nombre || '-'
            }));
            
            // Producción
            let produccionTotal = [];
            for (const animal of allAnimales) {
                const prod = await Produccion.listCarne(animal.id);
                produccionTotal = produccionTotal.concat(prod);
            }
            const produccionData = produccionTotal.map(p => ({
                Fecha: new Date(p.fecha).toLocaleDateString('es-ES'),
                Peso: p.peso,
                Ganancia: p.kg_ganados || '-'
            }));
            
            return this.toExcel([
                { name: 'Rebaños', data: rebanosData },
                { name: 'Animales', data: animalesData },
                { name: 'Producción', data: produccionData }
            ]);
        }, { action: 'exportCompleto' });
    }
};

/**
 * Charts & Dashboard Module
 */
const Charts = {
    chartInstances: {},

    /**
     * Crear gráfica de producción de carne (peso vs tiempo)
     */
    async charProduccionCarne(containerId, animalId) {
        try {
            await App._ensureChartJs();
            if (this.chartInstances[containerId]) {
                this.chartInstances[containerId].destroy();
            }

            const produccion = await Produccion.listCarne(animalId);
            if (produccion.length === 0) {
                document.getElementById(containerId).innerHTML = '<p>Sin datos de producción</p>';
                return;
            }

            produccion.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            const ctx = document.getElementById(containerId);
            this.chartInstances[containerId] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: produccion.map(p => new Date(p.fecha).toLocaleDateString('es-ES')),
                    datasets: [{
                        label: 'Peso (kg)',
                        data: produccion.map(p => p.peso),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 5,
                        pointBackgroundColor: '#d97706'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true, position: 'top' },
                        title: { display: true, text: 'Evolución de Peso' }
                    },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Peso (kg)' } },
                        x: { title: { display: true, text: 'Fecha' } }
                    }
                }
            });
        } catch (error) {
            ErrorHandler.log(error, { action: 'chartProduccionCarne', animalId });
        }
    },

    /**
     * Gráfica de producción de leche por vaca
     */
    async chartProduccionLeche(containerId, fincaId = null) {
        try {
            await App._ensureChartJs();
            if (this.chartInstances[containerId]) {
                this.chartInstances[containerId].destroy();
            }

            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const actualFincaId = fincaId || fincaActivaId;

            const produccion = await Produccion.listLeche(actualFincaId);
            if (produccion.length === 0) {
                document.getElementById(containerId).innerHTML = '<p>Sin datos de leche</p>';
                return;
            }

            produccion.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            const ctx = document.getElementById(containerId);
            this.chartInstances[containerId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: produccion.map(p => new Date(p.fecha).toLocaleDateString('es-ES')),
                    datasets: [{
                        label: 'Litros Producidos',
                        data: produccion.map(p => p.cantidad_litros),
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: 'Producción de Leche' }
                    },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Litros' } }
                    }
                }
            });
        } catch (error) {
            ErrorHandler.log(error, { action: 'chartProduccionLeche', fincaId });
        }
    },

    /**
     * Gráfica de ventas por mes
     */
    async chartVentas(containerId, fincaId = null) {
        try {
            await App._ensureChartJs();
            if (this.chartInstances[containerId]) {
                this.chartInstances[containerId].destroy();
            }

            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const actualFincaId = fincaId || fincaActivaId;

            const ventas = await Produccion.listVentas(actualFincaId);
            if (ventas.length === 0) {
                document.getElementById(containerId).innerHTML = '<p>Sin datos de ventas</p>';
                return;
            }

            // Agrupar por mes
            const ventasPorMes = {};
            ventas.forEach(v => {
                const mes = new Date(v.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
                ventasPorMes[mes] = (ventasPorMes[mes] || 0) + v.precio_total;
            });

            const ctx = document.getElementById(containerId);
            this.chartInstances[containerId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(ventasPorMes),
                    datasets: [{
                        label: 'Ingresos ($)',
                        data: Object.values(ventasPorMes),
                        backgroundColor: '#4FADF5',
                        borderColor: '#1d4ed8',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: 'Ingresos por Ventas' }
                    },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'USD ($)' } }
                    }
                }
            });
        } catch (error) {
            ErrorHandler.log(error, { action: 'chartVentas', fincaId });
        }
    },

    /**
     * Gráfica de gastos por categoría
     */
    async chartGastos(containerId, fincaId = null) {
        try {
            await App._ensureChartJs();
            if (this.chartInstances[containerId]) {
                this.chartInstances[containerId].destroy();
            }

            const fincaActivaId = await ErrorHandler.validateActiveFinca();
            const actualFincaId = fincaId || fincaActivaId;

            const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', actualFincaId);
            if (gastos.length === 0) {
                document.getElementById(containerId).innerHTML = '<p>Sin datos de gastos</p>';
                return;
            }

            // Agrupar por concepto
            const gastosPorConcepto = {};
            gastos.forEach(g => {
                gastosPorConcepto[g.concepto] = (gastosPorConcepto[g.concepto] || 0) + g.monto;
            });

            const ctx = document.getElementById(containerId);
            this.chartInstances[containerId] = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(gastosPorConcepto),
                    datasets: [{
                        data: Object.values(gastosPorConcepto),
                        backgroundColor: [
                            '#ef4444', '#E8555F', '#f59e0b', '#10b981',
                            '#4FADF5', '#8b5cf6', '#4FADF5'
                        ],
                        borderWidth: 2,
                        borderColor: '#121212'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true, position: 'bottom' },
                        title: { display: true, text: 'Gastos por Categoría' }
                    }
                }
            });
        } catch (error) {
            ErrorHandler.log(error, { action: 'chartGastos', fincaId });
        }
    }
};

window.Export = Export;
window.Charts = Charts;

