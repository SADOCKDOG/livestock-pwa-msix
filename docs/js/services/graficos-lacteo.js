/**
 * Livestock Manager - GráficosLacteoService v1.0.0
 * Servicio de visualización para módulo lácteo usando Chart.js
 */

const GraficosLacteoService = {
  _charts: new Map(),

  /**
   * Destruir todos los gráficos activos
   */
  destroyAll() {
    this._charts.forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this._charts.clear();
  },

  /**
   * Destruir un gráfico específico
   */
  destroy(chartId) {
    if (this._charts.has(chartId)) {
      const chart = this._charts.get(chartId);
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
      this._charts.delete(chartId);
    }
  },

  /**
   * Configurar Chart.js con tema oscuro de Livestock Manager
   */
  _getDefaultConfig() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { size: 11, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 10 } },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        y: {
          ticks: { color: '#94a3b8', font: { size: 10 } },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        }
      }
    };
  },

  /**
   * Gráfico de producción mensual de leche
   */
  async renderProduccionMensual(containerId, fincaId) {
    if (!(await App._ensureChartJs())) return;

    this.destroy(containerId);
    const ctx = document.getElementById(containerId)?.getContext('2d');
    if (!ctx) return;

    // Obtener datos de producción del último año
    const hace12meses = new Date();
    hace12meses.setMonth(hace12meses.getMonth() - 12);

    const comercializaciones = await window.db.getAllFromIndex('comercializacion_leche', 'fincaId', fincaId).catch(() => []);
    
    // Agrupar por mes
    const datosPorMes = {};
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() - i);
      const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      datosPorMes[key] = { litros: 0, entregas: 0 };
    }

    comercializaciones.forEach(c => {
      const fecha = new Date(c.fechaRecogida);
      if (fecha >= hace12meses) {
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        if (datosPorMes[key]) {
          datosPorMes[key].litros += (c.cantidad || 0);
          datosPorMes[key].entregas += 1;
        }
      }
    });

    const labels = Object.keys(datosPorMes).map(k => {
      const [year, month] = k.split('-');
      return `${month}/${year.slice(2)}`;
    });
    const litros = Object.values(datosPorMes).map(d => Math.round(d.litros));

    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Litros',
          data: litros,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        ...this._getDefaultConfig(),
        plugins: {
          ...this._getDefaultConfig().plugins,
          title: {
            display: true,
            text: 'Producción Mensual (L)',
            color: '#f8fafc',
            font: { size: 14, weight: '900' }
          }
        },
        scales: {
          ...this._getDefaultConfig().scales,
          y: {
            ...this._getDefaultConfig().scales.y,
            beginAtZero: true
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this._charts.set(containerId, chart);
    return chart;
  },

  /**
   * Gráfico de calidad de leche (gérmenes y somáticas)
   */
  async renderCalidadLeche(containerId, fincaId) {
    if (!(await App._ensureChartJs())) return;

    this.destroy(containerId);
    const ctx = document.getElementById(containerId)?.getContext('2d');
    if (!ctx) return;

    const analiticas = await window.AnaliticasLeche.getAll(fincaId).catch(() => []);
    
    // Ordenar por fecha
    analiticas.sort((a, b) => new Date(a.fecha_muestreo) - new Date(b.fecha_muestreo));

    const labels = analiticas.map(a => {
      const fecha = new Date(a.fecha_muestreo);
      return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
    });

    const germenes = analiticas.map(a => a.germenes_30C || 0);
    const somaticas = analiticas.map(a => a.celulas_somaticas || 0);

    const config = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Gérmenes (UFC/mL)',
            data: germenes,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.4,
            fill: false,
            pointRadius: 4
          },
          {
            label: 'Somáticas (cel/mL)',
            data: somaticas,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            fill: false,
            pointRadius: 4
          }
        ]
      },
      options: {
        ...this._getDefaultConfig(),
        plugins: {
          ...this._getDefaultConfig().plugins,
          title: {
            display: true,
            text: 'Evolución de Calidad',
            color: '#f8fafc',
            font: { size: 14, weight: '900' }
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this._charts.set(containerId, chart);
    return chart;
  },

  /**
   * Gráfico de composición (grasa y proteína)
   */
  async renderComposicion(containerId, fincaId) {
    if (!(await App._ensureChartJs())) return;

    this.destroy(containerId);
    const ctx = document.getElementById(containerId)?.getContext('2d');
    if (!ctx) return;

    const analiticas = await window.AnaliticasLeche.getAll(fincaId).catch(() => []);
    analiticas.sort((a, b) => new Date(a.fecha_muestreo) - new Date(b.fecha_muestreo));

    const labels = analiticas.map(a => {
      const fecha = new Date(a.fecha_muestreo);
      return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
    });

    const grasa = analiticas.map(a => a.grasa || 0);
    const proteina = analiticas.map(a => a.proteina || 0);

    const config = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Grasa (%)',
            data: grasa,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4
          },
          {
            label: 'Proteína (%)',
            data: proteina,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4
          }
        ]
      },
      options: {
        ...this._getDefaultConfig(),
        plugins: {
          ...this._getDefaultConfig().plugins,
          title: {
            display: true,
            text: 'Composición de la Leche',
            color: '#f8fafc',
            font: { size: 14, weight: '900' }
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this._charts.set(containerId, chart);
    return chart;
  },

  /**
   * Gráfico comparativo de tanques
   */
  async renderComparativaTanques(containerId, fincaId) {
    if (!(await App._ensureChartJs())) return;

    this.destroy(containerId);
    const ctx = document.getElementById(containerId)?.getContext('2d');
    if (!ctx) return;

    const tanques = window.TanquesLeche ? await window.TanquesLeche.getAll(fincaId).catch(() => []) : [];
    
    const labels = tanques.map(t => t.nombre);
    const capacidad = tanques.map(t => t.capacidad_litros || 0);
    const stock = tanques.map(t => t.stock_actual || 0);

    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Capacidad (L)',
            data: capacidad,
            backgroundColor: 'rgba(148, 163, 184, 0.3)',
            borderColor: '#94a3b8',
            borderWidth: 1
          },
          {
            label: 'Stock Actual (L)',
            data: stock,
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: '#3b82f6',
            borderWidth: 1
          }
        ]
      },
      options: {
        ...this._getDefaultConfig(),
        plugins: {
          ...this._getDefaultConfig().plugins,
          title: {
            display: true,
            text: 'Estado de Tanques',
            color: '#f8fafc',
            font: { size: 14, weight: '900' }
          }
        },
        scales: {
          ...this._getDefaultConfig().scales,
          y: {
            ...this._getDefaultConfig().scales.y,
            beginAtZero: true
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this._charts.set(containerId, chart);
    return chart;
  },

  /**
   * Curva de lactación por animal
   * @param {string} containerId - ID del canvas
   * @param {number} fincaId - ID de la finca
   * @param {number} animalId - ID del animal
   */
  async renderCurvaLactacion(containerId, fincaId, animalId) {
    if (!(await App._ensureChartJs())) return;

    this.destroy(containerId);
    const ctx = document.getElementById(containerId)?.getContext('2d');
    if (!ctx) return;

    // Obtener datos del animal
    const animal = await window.db.get('animales', animalId).catch(() => null);
    if (!animal) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Animal no encontrado', ctx.canvas.width / 2, ctx.canvas.height / 2);
      return;
    }

    // Obtener producción individual del animal
    const produccion = await window.db.getAllFromIndex('produccion_leche', 'animalId', animalId).catch(() => []);
    
    // Ordenar por fecha
    produccion.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Calcular días en lactación (DEL) desde la primera fecha
    const fechaInicio = produccion.length > 0 ? new Date(produccion[0].fecha) : new Date();
    
    const labels = produccion.map(p => {
      const fecha = new Date(p.fecha);
      const dias = Math.floor((fecha - fechaInicio) / (1000 * 60 * 60 * 24));
      return `Día ${dias}`;
    });

    const litros = produccion.map(p => p.cantidad_litros || 0);

    const config = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Producción (${animal.numero_identificacion || animal.nombre || 'Animal'})`,
          data: litros,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        ...this._getDefaultConfig(),
        plugins: {
          ...this._getDefaultConfig().plugins,
          title: {
            display: true,
            text: 'Curva de Lactación',
            color: '#f8fafc',
            font: { size: 14, weight: '900' }
          }
        },
        scales: {
          ...this._getDefaultConfig().scales,
          x: {
            ...this._getDefaultConfig().scales.x,
            title: {
              display: true,
              text: 'Días en Lactación',
              color: '#94a3b8'
            }
          },
          y: {
            ...this._getDefaultConfig().scales.y,
            beginAtZero: true,
            title: {
              display: true,
              text: 'Litros',
              color: '#94a3b8'
            }
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this._charts.set(containerId, chart);
    return chart;
  }
};

window.GraficosLacteoService = GraficosLacteoService;
console.log('[GraficosLacteoService] Servicio de gráficos lácteos listo v1.0.0');
