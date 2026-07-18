/**
 * Livestock Manager - InformesView: exportación Excel/PDF y compartición
 * Extraído de informes-view.js para modularización (P1-5).
 * Debe cargar DESPUÉS de informes-view.js (extiende window.InformesView).
 */
Object.assign(window.InformesView, {
  // ===================== EXPORTACIÓN EXCEL =====================

  async _exportExcel() {
    try {
      if (typeof XLSX === 'undefined' && !(await App._ensureXLSX())) return App.toastError("Librería Excel no disponible");
      App.toast("Generando Excel...");

      const fId = await Fincas.getActiveId();
      const finca = await Fincas.getActive();
      const [animales, ventas, leche, gastos, sanitarios, rebanos, censo, ccVentas, clEntregas] = await Promise.all([
        window.db.getAll('animales').catch(() => []),
        Produccion.listVentas(fId).catch(() => []),
        Produccion.listLeche(fId).catch(() => []),
        window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fId).catch(() => []),
        window.db.getAll('sanitarios_ganado').catch(() => []),
        Rebanos.list().catch(() => []),
        Analitica.obtenerCensoRebanos(fId).catch(() => []),
        window.db.getAllFromIndex('comercializacion_carne', 'fincaId', fId).catch(() => []),
        window.db.getAllFromIndex('comercializacion_leche', 'fincaId', fId).catch(() => []),
      ]);
      const cd = this._cachedData || {};

      const wb = XLSX.utils.book_new();

      // Hoja 1: Animales
      if (animales.length > 0) {
        const data = animales.map(a => ({
          ID: a.numero_identificacion, Especie: a.especie, Sexo: a.sexo,
          Raza: a.raza, 'F. Nacimiento': a.fecha_nacimiento, Estado: a.estado,
          'Código RFID': a.rfid_codigo, Notas: a.notas
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Animales');
      }

      // Hoja 2: Ventas Carne
      const totalVentasCarne = [];
      if (ventas.length > 0) {
        ventas.forEach(v => {
          totalVentasCarne.push({
            Fecha: v.fechaSacrificio || v.fecha_venta || v.fecha || '-',
            Albarán: v.numero_albaran || '-',
            Comprador: v.comprador || v.razonSocial || v.nombreComprador || '-',
            Animales: v.animal_id_list?.length || v.cantidad || 1,
            'Peso Canal (kg)': v.pesoCanal || v.pesoVivo || 0,
            'Base Imponible': ((v.precio_total || 0) - (v.importe_iva || 0)),
            IVA: v.importe_iva || 0,
            'Precio Total': v.precio_total || 0,
            Origen: 'Ganado'
          });
        });
      }
      if (ccVentas.length > 0) {
        ccVentas.forEach(v => {
          totalVentasCarne.push({
            Fecha: v.fechaSacrificio || v.fecha_emision || v.fecha || '-',
            Albarán: v.numero_albaran || '-',
            Comprador: v.razonSocial || v.nombreComprador || v.comprador || '-',
            Animales: v.animal_id_list?.length || v.cantidad || 1,
            'Peso Canal (kg)': v.pesoCanal || v.pesoVivo || 0,
            'Base Imponible': ((v.precio_total || 0) - (v.importe_iva || 0)),
            IVA: v.importe_iva || 0,
            'Precio Total': v.precio_total || 0,
            Origen: 'Comercialización'
          });
        });
      }
      if (totalVentasCarne.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(totalVentasCarne), 'Ventas Carne');
      }

      // Hoja 3: Leche
      const totalLeche = [];
      if (leche.length > 0) {
        leche.forEach(l => {
          totalLeche.push({
            Fecha: l.fecha || l.fechaRecogida || '-',
            Litros: l.cantidad || l.litros || 0,
            'Precio Base': l.precioBase || 0.45,
            'Total €': (l.cantidad || 0) * (l.precioBase || 0.45),
            Calidad: l.estadoAnalitica || '-',
            Origen: 'Producción'
          });
        });
      }
      if (clEntregas.length > 0) {
        clEntregas.forEach(l => {
          totalLeche.push({
            Fecha: l.fechaRecogida || l.fecha || '-',
            Litros: l.litros || l.cantidad || 0,
            'Precio Base': l.precioBase || l.precio || 0,
            'Total €': l.importe_total || l.importe || ((l.litros || l.cantidad || 0) * (l.precioBase || l.precio || 0)),
            Calidad: l.estadoAnalitica || l.calidad || '-',
            Origen: 'Comercialización'
          });
        });
      }
      if (totalLeche.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(totalLeche), 'Producción Leche');
      }

      // Hoja 4: Gastos
      if (gastos.length > 0) {
        const data = gastos.map(g => ({
          Fecha: g.fecha, Categoría: g.categoria, Monto: g.monto,
          Descripción: g.descripcion, Rebaño: g.rebanoId
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Gastos');
      }

      // Hoja 5: Sanitarios
      if (sanitarios.length > 0) {
        const data = sanitarios.map(s => ({
          Fecha: s.fecha, Animal: s.animalId, 'Tipo Tratamiento': s.tipo_tratamiento,
          Medicamento: s.medicamento, 'Dias Supresión Carne': s.tiempo_espera_carne_dias,
          'Dias Supresión Leche': s.tiempo_espera_leche_dias
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Sanitarios');
      }

      // Hoja 6: Censo
      if (censo.length > 0) {
        const data = censo.map(r => ({
          Rebaño: r.nombre, Tipo: r.tipo, Total: r.total,
          Activos: r.activos, Vendidos: r.vendidos
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Censo');
      }

      // Hoja 7: Compradores
      const compradoresData = cd.compradoresData || [];
      if (compradoresData.length > 0) {
        const data = compradoresData.map(c => ({
          Comprador: c.nombre, NIF: c.nif, Tipo: c.tipo,
          Ventas: c.numVentas, kg: c.kg,
          'Total €': c.total, 'Última Venta': c.ultimaVenta
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Compradores');
      }

      // Hoja 8: Proveedores
      const proveedoresData = cd.proveedoresData || [];
      if (proveedoresData.length > 0) {
        const data = proveedoresData.map(p => ({
          Proveedor: p.nombre, NIF: p.nif,
          Facturas: p.numFacturas, 'Total €': p.total,
          'Última Compra': p.ultimaCompra,
          Categorias: Object.keys(p.categorias || {}).join(', ')
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Proveedores');
      }

      // Generar blob y compartir
      const nombre = `Livestock_${finca?.codigo_REGA || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      await this._exportarConCompartir(
        () => excelBlob,
        'Excel', nombre,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        null
      );
    } catch (e) {
      console.error('[Excel Export]', e);
      App.toastError("Error al exportar Excel");
    }
  },

  // ===================== EXPORTACIÓN PDF CON LOGO =====================

  async _exportPDFSeccion(seccion) {
    await this._exportPDF(seccion);
  },

  async _exportPDF(seccion) {
    let loader;
    try {
      // Crear overlay de carga con barra de proceso
      loader = document.createElement('div');
      loader.id = 'pdf-loader-overlay';
      loader.className = 'pdf-loader-overlay';
      loader.innerHTML = `
        <div class="pdf-gen-modal">
          <div class="pdf-loader-icon" style="color:var(--p-gold); margin-bottom:15px; transform:scale(2);">${Icons.documento()}</div>
          <div class="pdf-gen-title">Generando PDF</div>
          <div class="pdf-gen-sub">Informe: ${seccion || 'Completo'}</div>
          <div class="pdf-gen-bar-wrap">
            <div id="pdf-progress-bar" class="pdf-gen-bar"></div>
          </div>
          <div id="pdf-progress-text" class="pdf-gen-label">PROCESANDO...</div>
        </div>
      `;
      document.body.appendChild(loader);

      const updateProgress = (pct, text) => {
        const bar = loader.querySelector('#pdf-progress-bar');
        const txt = loader.querySelector('#pdf-progress-text');
        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = text.toUpperCase();
      };

      if (typeof html2pdf === 'undefined' && !(await App._ensureHtml2Pdf())) {
        App.toastError("Librería PDF no disponible");
        loader.remove();
        this._exportFallback();
        return;
      }

      updateProgress(20, 'Cargando recursos...');
      const logoBase64 = await this._getLogoBase64();
      const finca = await Fincas.getActive();
      const d = this._cachedData;
      const fecha = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

      updateProgress(40, 'Generando contenido...');
      // Crear contenedor del PDF
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const pdfEl = document.createElement('div');
      pdfEl.style.cssText = `position:absolute; left:0; top:${currentScroll}px; z-index:9990; width:800px; background:#fff; color:#000; overflow:visible; padding:30px; font-family:"Inter",system-ui,sans-serif;`;
      const uid = `pdf-${Date.now()}`;

      // Generar secciones según el tipo
      let seccionesHtml = '';
      if (!seccion || seccion === 'general') {
        seccionesHtml += this._pdfSeccionEconomico(d, finca) + this._pdfSeccionCenso(d);
      }
      if (!seccion || seccion === 'carne') {
        seccionesHtml += this._pdfSeccionCarne(d);
      }
      if (!seccion || seccion === 'leche') {
        seccionesHtml += this._pdfSeccionLeche(d);
      }
      if (!seccion || seccion === 'reproductivo') {
        seccionesHtml += this._pdfSeccionReproductivo(d);
      }
      if (!seccion || seccion === 'sanidad') {
        seccionesHtml += this._pdfSeccionSanidad(d);
      }
      if (!seccion || seccion === 'censo') {
        seccionesHtml += this._pdfSeccionCenso(d);
      }
      if (!seccion || seccion === 'ventas') {
        seccionesHtml += this._pdfSeccionVentas(d);
      }
      if (!seccion || seccion === 'compradores') {
        seccionesHtml += this._pdfSeccionCompradores(d);
      }
      if (!seccion || seccion === 'proveedores') {
        seccionesHtml += this._pdfSeccionProveedores(d);
      }
      if (!seccion || seccion === 'fitosanitario') {
        seccionesHtml += this._pdfSeccionFitosanitario(d);
      }
      if (!seccion || seccion === 'alertas') {
        seccionesHtml += this._pdfSeccionAlertas(d);
      }
      if (!seccion || seccion === 'por-finca') {
        seccionesHtml += this._pdfSeccionPorFinca(d);
      }
      if (!seccion || seccion === 'rega') {
        seccionesHtml += this._pdfSeccionRega(d);
      }
      if (!seccion || seccion === 'pyg') {
        seccionesHtml += this._pdfSeccionPyG(d);
      }
      if (!seccion || seccion === 'coste-prod') {
        seccionesHtml += this._pdfSeccionCosteProd(d);
      }
      if (!seccion || seccion === 'eficiencia') {
        seccionesHtml += this._pdfSeccionEficiencia(d);
      }
      if (!seccion || seccion === 'cargas') {
        seccionesHtml += this._pdfSeccionCargas(d);
      }
      if (!seccion || seccion === 'rotacion') {
        seccionesHtml += this._pdfSeccionRotacion(d);
      }
      if (!seccion || seccion === 'flujo-caja') {
        seccionesHtml += this._pdfSeccionFlujoCaja(d);
      }
      if (!seccion || seccion === 'rent-esp') {
        seccionesHtml += this._pdfSeccionRentabilidadEspecie(d);
      }
      if (!seccion || seccion === 'curva-prod') {
        seccionesHtml += this._pdfSeccionCurvaProduccion(d);
      }
      if (!seccion || seccion === 'breakeven') {
        seccionesHtml += this._pdfSeccionBreakEven(d);
      }

      pdfEl.innerHTML = `
        <style>
  .pdf-sec {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    font-size: 1.15rem !important;
    font-weight: 800 !important;
    border-bottom: 2px solid #e2e8f0 !important;
    padding-bottom: 6px !important;
    margin-top: 24px !important;
    margin-bottom: 12px !important;
    text-transform: uppercase !important;
    letter-spacing: -0.01em !important;
  }
  .pdf-sec4 {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    font-size: 0.95rem !important;
    font-weight: 700 !important;
    border-bottom: 1px solid #e2e8f0 !important;
    padding-bottom: 4px !important;
    margin-top: 18px !important;
    margin-bottom: 8px !important;
  }
  .pdf-tbl {
    width: 100% !important;
    border-collapse: collapse !important;
    margin-bottom: 14px !important;
    font-size: 0.82rem !important;
  }
  .pdf-th, .pdf-th-sm {
    background: #f8fafc !important;
    color: #475569 !important;
    font-weight: 700 !important;
    text-align: left !important;
    padding: 6px 8px !important;
    border-bottom: 2px solid #cbd5e1 !important;
  }
  .pdf-td, .pdf-td4 {
    padding: 5px 8px !important;
    border-bottom: 1px solid #f1f5f9 !important;
    color: #334155 !important;
  }
  .pdf-bg1 {
    background: #f8fafc !important;
  }
  .pdf-kv, .pdf-kv6 {
    padding: 5px 8px !important;
    border-bottom: 1px solid #f1f5f9 !important;
  }
  .icon {
    width: 18px !important;
    height: 18px !important;
    stroke-width: 2.5 !important;
    display: inline-block !important;
    vertical-align: middle !important;
  }
</style>

        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #d97706; padding-bottom:18px; margin-bottom:20px; width:100%;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${logoBase64 ? `<img src="${logoBase64}" style="height:50px; width:auto;" alt="Logo">` : ''}
            <div>
              <h1 style="margin:0; font-size:1.3rem; font-weight:900; color:#d97706; text-transform:uppercase;">Livestock Manager</h1>
              <p style="margin:2px 0 0 0; font-size:0.7rem; color:#666;">${seccion ? seccion.charAt(0).toUpperCase() + seccion.slice(1) : 'Informe completo'}</p>
            </div>
          </div>
          <div style="text-align:right; font-size:0.7rem; color:#888;">
            <div><strong>${finca?.nombre || 'Explotación'}</strong></div>
            <div>REGA: ${finca?.codigo_REGA || 'N/D'}</div>
            <div>${fecha}</div>
          </div>
        </div>
        <div style="width:100%;">${seccionesHtml}</div>
        <div style="margin-top:30px; padding-top:12px;  text-align:center; font-size:0.65rem; color:#999; width:100%;">
          Informe generado por Livestock Manager Premium — ${fecha}
        </div>
      `;

      document.body.appendChild(pdfEl);

      // Añadir estilos anti-corte a todos los elementos del PDF
      pdfEl.querySelectorAll('.card, table, h3, h4, .report-section, [class*="border-top"]').forEach(el => {
        if (el) el.style.cssText += ';page-break-inside:avoid;';
      });

      updateProgress(70, 'Rasterizando PDF...');
      const opt = {
        margin: [12, 10, 12, 10],
        filename: `Livestock_${finca?.codigo_REGA || 'export'}_${seccion || 'completo'}_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 800,
          scrollX: 0,
          scrollY: currentScroll,
          height: pdfEl.scrollHeight,
          windowHeight: pdfEl.scrollHeight
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      const fileName = opt.filename;
      const seccionLabel = seccion || 'completo';

      // Usar el nuevo sistema de compartir
      await this._exportarConCompartir(
        async () => {
          const pdfBlob = await html2pdf().set(opt).from(pdfEl).toPdf().output('blob');
          document.body.removeChild(pdfEl);
          updateProgress(100, '¡Listo!');
          await new Promise(r => setTimeout(r, 400));
          loader.remove();
          return pdfBlob;
        },
        'PDF', fileName, 'application/pdf', seccionLabel
      );
    } catch (e) {
      console.error('[PDF Export]', e);
      App.toastError("Error al exportar PDF: " + e.message);
      if (loader) loader.remove();
      this._exportFallback();
    }
  },

  // ========= SECCIONES PDF =========

  _pdfSeccionEconomico(d) {
    const { rent } = d;
    if (!rent) return '';
    const balanceTotal = rent.balance || 0;
    return `
      <h3 class="pdf-sec" style="color:#d97706;">${Icons.dinero({ class: 'icon' })} Resumen Económico</h3>
      <table class="pdf-tbl pdf-tbl-md mb-15">
        <tr><td class="pdf-kv6">Ingresos Cárnicos</td><td class="pdf-kv6 pdf-r pdf-b">${(rent.detalles?.carne || 0).toLocaleString()} €</td></tr>
        <tr><td class="pdf-kv6">Ingresos Lácteos</td><td class="pdf-kv6 pdf-r pdf-b">${(rent.detalles?.leche || 0).toLocaleString()} €</td></tr>
        <tr><td class="pdf-kv6">Total Gastos</td><td class="pdf-kv6 pdf-r pdf-b pdf-red">${(rent.gastos || 0).toLocaleString()} €</td></tr>
        <tr class="pdf-bg1"><td class="pdf-big pdf-b">BALANCE NETO</td><td class="pdf-big pdf-r pdf-b" style="color:${balanceTotal >= 0 ? '#10b981' : '#cc0000'};">${balanceTotal.toLocaleString()} €</td></tr>
      </table>
    `;
  },

  _pdfSeccionCarne(d) {
    const { rent, ventasHist } = d;
    const total = rent?.detalles?.carne || 0;
    const kgTotal = ventasHist.reduce((s, v) => s + (v.kg || 0), 0);
    return `
      <h3 class="pdf-sec" style="color:#f59e0b;">${Icons.carne({ class: 'icon' })} Informe Cárnico</h3>
      <table class="pdf-tbl pdf-tbl-md mb-12">
        <tr><td class="pdf-kv6">Ingresos Totales Carne</td><td class="pdf-kv6 pdf-r pdf-b">${total.toLocaleString()} €</td></tr>
        <tr><td class="pdf-kv6">Ventas Registradas</td><td class="pdf-kv6 pdf-r">${ventasHist.length}</td></tr>
        <tr><td class="pdf-kv6">Kilos Totales</td><td class="pdf-kv6 pdf-r pdf-b">${this._fmt(kgTotal, 1)} kg</td></tr>
        <tr><td class="pdf-kv6">Precio Medio por kg</td><td class="pdf-kv6 pdf-r pdf-b">${kgTotal > 0 ? this._fmt(total / kgTotal, 2) : '0,00'} €</td></tr>
      </table>
      ${ventasHist.length > 0 ? `
      <table class="pdf-tbl pdf-tbl-xs mt-10">
        <thead><tr class="pdf-bg0"><th class="pdf-th" style="border-bottom-color:#ddd;">Fecha</th><th class="pdf-th pdf-c" style="border-bottom-color:#ddd;">kg</th><th class="pdf-th pdf-r" style="border-bottom-color:#ddd;">Total</th></tr></thead>
        <tbody>${ventasHist.slice(0, 20).map(v => `<tr><td class="pdf-td4">${v.fecha}</td><td class="pdf-td4 pdf-c">${v.kg || '-'}</td><td class="pdf-td4 pdf-r">${(v.total || 0).toLocaleString()}€</td></tr>`).join('')}</tbody>
      </table>` : ''}
    `;
  },

  _pdfSeccionLeche(d) {
    const { lecheStats } = d;
    if (!lecheStats || lecheStats.totalLitros === 0) return '';
    return `
      <h3 class="pdf-sec" style="color:#FFFC55;">${Icons.leche({ class: 'icon' })} Informe Lácteo</h3>
      <table class="pdf-tbl pdf-tbl-md mb-12">
        <tr><td class="pdf-kv6">Total Litros Producidos</td><td class="pdf-kv6 pdf-r pdf-b">${this._fmt(lecheStats.totalLitros, 1)} L</td></tr>
        <tr><td class="pdf-kv6">Promedio Diario</td><td class="pdf-kv6 pdf-r">${this._fmt(lecheStats.promedioDiario, 1)} L/día</td></tr>
        <tr><td class="pdf-kv6">Precio Medio</td><td class="pdf-kv6 pdf-r pdf-b">${this._fmt(lecheStats.precioMedio, 3)} €/L</td></tr>
        <tr><td class="pdf-kv6">Registros</td><td class="pdf-kv6 pdf-r">${lecheStats.totalRegistros}</td></tr>
      </table>
    `;
  },

  _pdfSeccionReproductivo(d) {
    const { kpisRepro } = d;
    return `
      <h3 class="pdf-sec" style="color:#8b5cf6;">${Icons.reproduccion({ class: 'icon' })} Informe Reproductivo</h3>
      <table class="pdf-tbl pdf-tbl-md">
        <tr><td class="pdf-kv6">Tasa de Fertilidad</td><td class="pdf-kv6 pdf-r pdf-b">${kpisRepro.tasaFertilidadPct || 0}%</td></tr>
        <tr><td class="pdf-kv6">Intervalo Entre Partos</td><td class="pdf-kv6 pdf-r">${kpisRepro.intervaloEntrePartosDias || 0} días</td></tr>
        <tr><td class="pdf-kv6">Índice de Prolificidad</td><td class="pdf-kv6 pdf-r pdf-b">${kpisRepro.indiceProlificidad || 0}</td></tr>
        <tr><td class="pdf-kv6">Partos Analizados</td><td class="pdf-kv6 pdf-r">${kpisRepro.totalPartosAnalizados || 0}</td></tr>
      </table>
    `;
  },

  _pdfSeccionSanidad(d) {
    const { estadisticasSanidad } = d;
    return `
      <h3 class="pdf-sec" style="color:#ef4444;">${Icons.sanidad({ class: 'icon' })} Informe Sanitario</h3>
      <table class="pdf-tbl pdf-tbl-md">
        <tr><td class="pdf-kv6">Total Tratamientos</td><td class="pdf-kv6 pdf-r pdf-b">${estadisticasSanidad.totalTratamientos || 0}</td></tr>
        <tr><td class="pdf-kv6">Supresiones Activas</td><td class="pdf-kv6 pdf-r pdf-b pdf-red">${estadisticasSanidad.retencionesActivas || 0}</td></tr>
      </table>
      ${estadisticasSanidad.porCategoria?.length > 0 ? `
      <table class="pdf-tbl pdf-tbl-xs mt-10">
        <thead><tr class="pdf-bg0"><th class="pdf-th" style="border-bottom-color:#ddd;">Categoría</th><th class="pdf-th pdf-r" style="border-bottom-color:#ddd;">Cantidad</th></tr></thead>
        <tbody>${estadisticasSanidad.porCategoria.map(c => `<tr><td class="pdf-td4">${c.categoria}</td><td class="pdf-td4 pdf-r">${c.cantidad}</td></tr>`).join('')}</tbody>
      </table>` : ''}
    `;
  },

  _pdfSeccionCenso(d) {
    const { censo } = d;
    if (!censo?.length) return '';
    const totalAnimales = censo.reduce((s, r) => s + r.total, 0);
    return `
      <h3 class="pdf-sec" style="color:#000;">${Icons.animales({ class: 'icon' })} Censo de Animales</h3>
      <table class="pdf-tbl pdf-tbl-md">
        <thead><tr class="pdf-bg0"><th class="pdf-th8" style="border-bottom-color:#d97706;">Rebaño</th><th class="pdf-th8 pdf-c" style="border-bottom-color:#d97706;">Total</th><th class="pdf-th8 pdf-c" style="border-bottom-color:#d97706;">Activos</th><th class="pdf-th8 pdf-c" style="border-bottom-color:#d97706;">Vendidos</th></tr></thead>
        <tbody>${censo.map(r => `<tr><td class="pdf-td4">${r.nombre}</td><td class="pdf-td4 pdf-c pdf-b">${r.total}</td><td class="pdf-td4 pdf-c">${r.activos}</td><td class="pdf-td4 pdf-c">${r.vendidos}</td></tr>`).join('')}</tbody>
        <tfoot><tr class="pdf-bg2"><td class="pdf-kv6 pdf-b">TOTAL</td><td class="pdf-kv6 pdf-c pdf-b">${totalAnimales}</td><td class="pdf-kv6 pdf-c">${censo.reduce((s, r) => s + r.activos, 0)}</td><td class="pdf-kv6 pdf-c">${censo.reduce((s, r) => s + r.vendidos, 0)}</td></tr></tfoot>
      </table>
    `;
  },

  _pdfSeccionVentas(d) {
    const { ventasCompleto, docsLegales, fId } = d;
    if (!ventasCompleto?.length) return '';
    const ventas = ventasCompleto
      .filter(v => Number(v.fincaId) === Number(fId))
      .sort((a, b) => new Date(b.fechaSacrificio || b.fecha_emision || 0) - new Date(a.fechaSacrificio || a.fecha_emision || 0));
    const totalKg = ventas.reduce((s, v) => s + (v.pesoCanal || v.pesoVivo || 0), 0);
    const totalImporte = ventas.reduce((s, v) => s + (v.precio_total || 0), 0);
    const totalIVA = ventas.reduce((s, v) => s + (v.importe_iva || 0), 0);
    return `
      <h3 class="pdf-sec" style="color:#4FADF5;">${Icons.libroVentas({ class: 'icon' })} Libro de Ventas</h3>
      <table class="pdf-tbl pdf-tbl-xs mb-10">
        <thead><tr class="pdf-bg0">
          <th class="pdf-th" style="border-bottom-color:#4FADF5;">Fecha</th>
          <th class="pdf-th" style="border-bottom-color:#4FADF5;">Albarán</th>
          <th class="pdf-th" style="border-bottom-color:#4FADF5;">Comprador</th>
          <th class="pdf-th pdf-r" style="border-bottom-color:#4FADF5;">kg</th>
          <th class="pdf-th pdf-r" style="border-bottom-color:#4FADF5;">Base</th>
          <th class="pdf-th pdf-r" style="border-bottom-color:#4FADF5;">IVA</th>
          <th class="pdf-th pdf-r" style="border-bottom-color:#4FADF5;">Total</th>
        </tr></thead>
        <tbody>${ventas.slice(0, 50).map(v => `
          <tr><td class="pdf-td4">${v.fechaSacrificio || v.fecha_emision || '-'}</td>
          <td class="pdf-td4">${v.numero_albaran || '-'}</td>
          <td class="pdf-td4">${v.razonSocial || v.nombreComprador || '-'}</td>
          <td class="pdf-td4 pdf-r">${InformesView._fmt((v.pesoCanal || v.pesoVivo || 0), 1)}</td>
          <td class="pdf-td4 pdf-r">${InformesView._fmt(((v.precio_total || 0) - (v.importe_iva || 0)), 2)}€</td>
          <td class="pdf-td4 pdf-r">${InformesView._fmt((v.importe_iva || 0), 2)}€</td>
          <td class="pdf-td4 pdf-r pdf-b">${InformesView._fmt((v.precio_total || 0), 2)}€</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr class="pdf-bg1">
          <td colspan="3" class="pdf-big pdf-r pdf-b">TOTALES</td>
          <td class="pdf-big pdf-r pdf-b">${InformesView._fmt(totalKg, 1)}</td>
          <td class="pdf-big pdf-r pdf-b">${InformesView._fmt((totalImporte - totalIVA), 2)}€</td>
          <td class="pdf-big pdf-r pdf-b">${InformesView._fmt(totalIVA, 2)}€</td>
          <td class="pdf-big pdf-r pdf-b pdf-base">${InformesView._fmt(totalImporte, 2)}€</td>
        </tr></tfoot>
      </table>
    `;
  },

  _pdfSeccionRega(d) {
    const { finca, animales, rebanos, eventos, censo } = d;
    if (!finca) return '';
    const totalAnimales = (animales || []).length;
    const activos = (animales || []).filter(a => a.estado === 'activo' || a.estado === 'Activo').length;
    const movimientos = (eventos || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 20);
    const porEspecie = {};
    (animales || []).forEach(a => {
      const esp = a.especie || 'Sin especie';
      porEspecie[esp] = (porEspecie[esp] || 0) + 1;
    });
    return `
      <h3 class="pdf-sec" style="color:#d97706;">${Icons.informeRega({ class: 'icon' })} Informe REGA</h3>
      <table class="pdf-tbl pdf-tbl-md mb-10">
        <tr><td class="pdf-kv pdf-b">Nombre Explotación</td><td class="pdf-kv">${finca.nombre || 'N/D'}</td></tr>
        <tr><td class="pdf-kv pdf-b">REGA</td><td class="pdf-kv" style="color:var(--p-gold); font-weight:bold;">${finca.codigo_REGA || finca.rega || 'N/D'}</td></tr>
        <tr><td class="pdf-kv pdf-b">CEA</td><td class="pdf-kv">${finca.codigo_CEA || finca.cea || 'N/D'}</td></tr>
        <tr><td class="pdf-kv pdf-b">Propietario</td><td class="pdf-kv">${finca.propietario || 'N/D'}</td></tr>
        <tr><td class="pdf-kv pdf-b">NIF/CIF</td><td class="pdf-kv">${finca.nif_cif || 'N/D'}</td></tr>
        <tr><td class="pdf-kv pdf-b">Dirección</td><td class="pdf-kv">${finca.direccion || 'N/D'}</td></tr>
        <tr><td class="pdf-kv pdf-b">Municipio / Provincia</td><td class="pdf-kv">${finca.municipio || ''} / ${finca.provincia || ''}</td></tr>
        <tr><td class="pdf-kv pdf-b">Comunidad Autónoma</td><td class="pdf-kv">${finca.comunidad_autonoma || finca.comunidad || 'N/D'}</td></tr>
      </table>

      <h4 class="pdf-sec4" style="color:#10b981;">${Icons.animales({ class: 'icon' })} Resumen Censo</h4>
      <table class="pdf-tbl pdf-tbl-md mb-10">
        <tr><td class="pdf-kv pdf-b">Total Animales</td><td class="pdf-kv pdf-r">${totalAnimales}</td></tr>
        <tr><td class="pdf-kv pdf-b">Animales Activos</td><td class="pdf-kv pdf-r pdf-grn">${activos}</td></tr>
        ${Object.entries(porEspecie).map(([esp, cnt]) => `
        <tr><td class="pdf-kv">&nbsp;&nbsp;— ${esp}</td><td class="pdf-kv pdf-r">${cnt}</td></tr>
        `).join('')}
      </table>

      ${rebanos?.length > 0 ? `
      <h4 class="pdf-sec4" style="color:#f59e0b;">${Icons.rebanos({ class: 'icon' })} Detalle por Rebaño</h4>
      <table class="pdf-tbl pdf-tbl-sm mb-10">
        <thead><tr class="pdf-bg0">
          <th class="pdf-th-sm" style="border-bottom:2px solid #f59e0b;">Rebaño</th>
          <th class="pdf-th-sm pdf-c" style="border-bottom:2px solid #f59e0b;">Total</th>
          <th class="pdf-th-sm pdf-c" style="border-bottom:2px solid #f59e0b;">Activos</th>
        </tr></thead>
        <tbody>${rebanos.map(r => {
          const cnt = (animales || []).filter(a => Number(a.rebanoId) === Number(r.id)).length;
          const act = (animales || []).filter(a => Number(a.rebanoId) === Number(r.id) && (a.estado === 'activo' || a.estado === 'Activo')).length;
          return `<tr><td class="pdf-td">${r.nombre}</td>
            <td class="pdf-td pdf-c pdf-b">${cnt}</td>
            <td class="pdf-td pdf-c">${act}</td></tr>`;
        }).join('')}</tbody>
      </table>` : ''}

      ${movimientos.length > 0 ? `
      <h4 class="pdf-sec4" style="color:#8b5cf6;">${Icons.trazabilidad({ class: 'icon' })} Últimos Movimientos</h4>
      <table class="pdf-tbl pdf-tbl-xs mb-10">
        <thead><tr class="pdf-bg0">
          <th class="pdf-th-sm" style="border-bottom:2px solid #8b5cf6;">Fecha</th>
          <th class="pdf-th-sm" style="border-bottom:2px solid #8b5cf6;">Tipo</th>
          <th class="pdf-th-sm" style="border-bottom:2px solid #8b5cf6;">Motivo</th>
        </tr></thead>
        <tbody>${movimientos.map(e => `
          <tr><td class="pdf-td">${e.fecha || '-'}</td>
          <td class="pdf-td">${e.motivo_tarea || '-'}</td>
          <td class="pdf-td">${e.observaciones?.substring(0, 40) || '-'}</td></tr>
        `).join('')}</tbody>
      </table>` : ''}
    `;
  },

  // ========= SECCIONES PDF NUEVAS =========

  _pdfSeccionCompradores(d) {
    const { compradoresData } = d;
    const data = compradoresData || [];
    if (!data.length) return '';
    const totalIngresos = data.reduce((s, c) => s + c.total, 0);
    const totalKg = data.reduce((s, c) => s + c.kg, 0);
    return `
      <h3 class="pdf-sec" style="color:#4FADF5;">${Icons.compradores({ class: 'icon' })} Informe por Comprador</h3>
      <table class="pdf-tbl pdf-tbl-md mb-10">
        <thead><tr class="pdf-bg0">
          <th class="pdf-th" style="border-bottom-color:#4FADF5;">Comprador</th>
          <th class="pdf-th" style="border-bottom-color:#4FADF5;">NIF</th>
          <th class="pdf-th pdf-c" style="border-bottom-color:#4FADF5;">Ventas</th>
          <th class="pdf-th pdf-r" style="border-bottom-color:#4FADF5;">kg</th>
          <th class="pdf-th pdf-r" style="border-bottom-color:#4FADF5;">Total</th>
        </tr></thead>
        <tbody>${data.map(c => `
          <tr><td class="pdf-td4"><strong>${c.nombre}</strong></td>
          <td class="pdf-td4">${c.nif || '-'}</td>
          <td class="pdf-td4 pdf-c">${c.numVentas}</td>
          <td class="pdf-td4 pdf-r">${InformesView._fmt(c.kg, 1)}</td>
          <td class="pdf-td4 pdf-r pdf-b">${c.total.toLocaleString()}€</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr class="pdf-bg1">
          <td colspan="2" class="pdf-big pdf-r pdf-b">TOTALES</td>
          <td class="pdf-big pdf-c pdf-b">${data.reduce((s, c) => s + c.numVentas, 0)}</td>
          <td class="pdf-big pdf-r pdf-b">${InformesView._fmt(totalKg, 1)}</td>
          <td class="pdf-big pdf-r pdf-b pdf-base">${totalIngresos.toLocaleString()}€</td>
        </tr></tfoot>
      </table>
    `;
  },

  _pdfSeccionProveedores(d) {
    const { proveedoresData } = d;
    const data = proveedoresData || [];
    if (!data.length) return '';
    const totalGasto = data.reduce((s, p) => s + p.total, 0);
    return `
      <h3 class="pdf-sec" style="color:#f59e0b;">${Icons.proveedores({ class: 'icon' })} Informe por Proveedor</h3>
      <table class="pdf-tbl pdf-tbl-md mb-10">
        <thead><tr class="pdf-bg0">
          <th class="pdf-th" style="border-bottom-color:#f59e0b;">Proveedor</th>
          <th class="pdf-th pdf-c" style="border-bottom-color:#f59e0b;">Facturas</th>
          <th class="pdf-th pdf-r" style="border-bottom-color:#f59e0b;">Total</th>
        </tr></thead>
        <tbody>${data.map(p => `
          <tr><td class="pdf-td4"><strong>${p.nombre}</strong></td>
          <td class="pdf-td4 pdf-c">${p.numFacturas}</td>
          <td class="pdf-td4 pdf-r pdf-b">${p.total.toLocaleString()}€</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr class="pdf-bg1">
          <td class="pdf-big pdf-r pdf-b">TOTALES</td>
          <td class="pdf-big pdf-c pdf-b">${data.reduce((s, p) => s + p.numFacturas, 0)}</td>
          <td class="pdf-big pdf-r pdf-b pdf-base">${totalGasto.toLocaleString()}€</td>
        </tr></tfoot>
      </table>
    `;
  },

  _pdfSeccionFitosanitario(d) {
    const { fitosanitarioData } = d;
    const data = fitosanitarioData || { registros: [], total: 0 };
    if (!data.registros.length) return '';
    return `
      <h3 class="pdf-sec" style="color:#10b981;">${Icons.fitosanitario({ class: 'icon' })} Informe Fitosanitario</h3>
      <table class="pdf-tbl pdf-tbl-sm mb-10">
        <thead><tr class="pdf-bg0">
          <th class="pdf-th" style="border-bottom-color:#10b981;">Fecha</th>
          <th class="pdf-th" style="border-bottom-color:#10b981;">Proveedor</th>
          <th class="pdf-th" style="border-bottom-color:#10b981;">Producto</th>
          <th class="pdf-th pdf-r" style="border-bottom-color:#10b981;">Monto</th>
        </tr></thead>
        <tbody>${data.registros.slice(0, 30).map(r => `
          <tr><td class="pdf-td">${r.fecha || '-'}</td>
          <td class="pdf-td">${r.proveedor || '-'}</td>
          <td class="pdf-td">${r.descripcion || '-'}</td>
          <td class="pdf-td pdf-r">${(r.monto || 0).toLocaleString()}€</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr class="pdf-bg1">
          <td colspan="3" class="pdf-tot pdf-r pdf-b">TOTAL</td>
          <td class="pdf-tot pdf-r pdf-b">${data.total.toLocaleString()}€</td>
        </tr></tfoot>
      </table>
    `;
  },

  _pdfSeccionAlertas(d) {
    const { alertasData } = d;
    const alertas = alertasData || { sanitarias: [], trazabilidad: [], administrativas: [], calendario: { titulo: '', sugerencias: [] } };
    const totalAlertas = (alertas.sanitarias?.length || 0) + (alertas.trazabilidad?.length || 0) + (alertas.administrativas?.length || 0);
    if (!totalAlertas) return '';
    const rojas = (alertas.sanitarias?.filter(a => a.urgencia === 'rojo').length || 0) +
                  (alertas.trazabilidad?.filter(a => a.urgencia === 'rojo').length || 0) +
                  (alertas.administrativas?.filter(a => a.urgencia === 'rojo').length || 0);
    let html = `
      <h3 class="pdf-sec" style="color:#ef4444;">${Icons.alerta({ class: 'icon' })} Informe de Alertas</h3>
      <table class="pdf-tbl pdf-tbl-md mb-10">
        <tr><td class="pdf-kv pdf-b">Total Alertas Activas</td><td class="pdf-kv pdf-r pdf-b pdf-red">${totalAlertas}</td></tr>
        <tr><td class="pdf-kv">Estado Crítico</td><td class="pdf-kv pdf-r pdf-red">${rojas}</td></tr>
        <tr><td class="pdf-kv">Avisos y Seguimiento</td><td class="pdf-kv pdf-r">${totalAlertas - rojas}</td></tr>
      </table>`;
    if (alertas.sanitarias?.length > 0) {
      html += `<h4 style="color:#ef4444; display:flex; align-items:center; gap:6px;">${Icons.sanidad({ class: 'icon', style: 'width:14px;height:14px' })} Sanitarias</h4>
      <table class="pdf-tbl pdf-tbl-xs mb-10">
        <thead><tr class="pdf-bg0"><th class="pdf-th-sm">Medicamento</th><th class="pdf-th-sm">Rebaño</th><th class="pdf-th-sm pdf-r">Días</th></tr></thead>
        <tbody>${alertas.sanitarias.slice(0, 10).map(a => `<tr><td class="pdf-td">${a.medicamento || '-'}</td><td class="pdf-td">${a.rebanoNombre || '-'}</td><td class="pdf-td pdf-r">${a.diasRestantes}</td></tr>`).join('')}</tbody>
      </table>`;
    }
    if (alertas.trazabilidad?.length > 0) {
      html += `<h4 style="color:#f59e0b; display:flex; align-items:center; gap:6px;">${Icons.trazabilidad({ class: 'icon', style: 'width:14px;height:14px' })} Trazabilidad</h4>
      <p class="pdf-tbl-xs pdf-muted">${alertas.trazabilidad.length} alertas activas. Revisar identificaciones y documentación.</p>`;
    }
    if (alertas.administrativas?.length > 0) {
      html += `<h4 style="color:#8b5cf6; display:flex; align-items:center; gap:6px;">${Icons.documento({ class: 'icon', style: 'width:14px;height:14px' })} Administrativas</h4>
      <p class="pdf-tbl-xs pdf-muted">${alertas.administrativas.length} alertas activas. Revisar contratos, PAC y vencimientos.</p>`;
    }
    return html;
  },

  _pdfSeccionPorFinca(d) {
    const { finca, rent, animales, rebanos } = d;
    if (!finca) return '';
    const balanceTotal = rent?.balance || 0;
    const totalAnimales = (animales || []).length;
    const activos = (animales || []).filter(a => a.estado === 'activo' || a.estado === 'Activo').length;
    return `
      <h3 class="pdf-sec" style="color:#d97706;">${Icons.finca({ class: 'icon' })} Ficha de Explotación</h3>
      <table class="pdf-tbl pdf-tbl-md mb-10">
        <tr><td class="pdf-kv pdf-b">Nombre</td><td class="pdf-kv">${finca.nombre || 'N/D'}</td></tr>
        <tr><td class="pdf-kv pdf-b">REGA</td><td class="pdf-kv" style="color:var(--p-gold); font-weight:bold;">${finca.codigo_REGA || finca.rega || 'N/D'}</td></tr>
        <tr><td class="pdf-kv pdf-b">Propietario</td><td class="pdf-kv">${finca.propietario || 'N/D'}</td></tr>
        <tr><td class="pdf-kv pdf-b">Municipio</td><td class="pdf-kv">${finca.municipio || ''}, ${finca.provincia || ''}</td></tr>
        <tr><td class="pdf-kv pdf-b">CCAA</td><td class="pdf-kv">${finca.comunidad_autonoma || finca.comunidad || 'N/D'}</td></tr>
        <tr><td class="pdf-kv pdf-b">Censo Total</td><td class="pdf-kv pdf-r pdf-b">${totalAnimales}</td></tr>
        <tr><td class="pdf-kv pdf-b">Animales Activos</td><td class="pdf-kv pdf-r pdf-grn">${activos}</td></tr>
        <tr><td class="pdf-kv pdf-b">Rebaños</td><td class="pdf-kv pdf-r">${(rebanos || []).length}</td></tr>
      </table>
      ${rent ? `
      <h4 class="pdf-sec4" style="color:#10b981;">${Icons.dinero({ class: 'icon' })} Resumen Económico</h4>
      <table class="pdf-tbl pdf-tbl-md">
        <tr><td class="pdf-kv">Ingresos Totales</td><td class="pdf-kv pdf-r pdf-b">${(rent.ingresos || 0).toLocaleString()}€</td></tr>
        <tr><td class="pdf-kv">Gastos Totales</td><td class="pdf-kv pdf-r pdf-b pdf-red">${(rent.gastos || 0).toLocaleString()}€</td></tr>
        <tr class="pdf-bg1"><td class="pdf-big pdf-b">BALANCE NETO</td><td class="pdf-big pdf-r pdf-b pdf-base" style="color:${balanceTotal >= 0 ? '#10b981' : '#cc0000'};">${balanceTotal.toLocaleString()}€</td></tr>
      </table>` : ''}
    `;
  },

  // ========= SECCIONES PDF NUEVOS INFORMES =========

  _pdfSeccionPyG(d) {
    const { pygData } = d;
    if (!pygData || pygData.totalIngresos === 0) return '';
    return `
      <h3 class="pdf-sec" style="color:#10b981;">${Icons.dinero({ class: 'icon' })} Cuenta de Resultados</h3>
      <table class="pdf-tbl pdf-tbl-md mb-10">
        <tr><td class="pdf-kv pdf-b">Total Ingresos</td><td class="pdf-kv pdf-r">${pygData.totalIngresos.toLocaleString()}€</td></tr>
        <tr><td class="pdf-kv pdf-b">Total Gastos</td><td class="pdf-kv pdf-r pdf-red">${pygData.totalGastos.toLocaleString()}€</td></tr>
        <tr class="pdf-bg1"><td class="pdf-big pdf-b">BALANCE NETO</td><td class="pdf-big pdf-r pdf-b pdf-base" style="color:${pygData.totalBalance >= 0 ? '#10b981' : '#cc0000'};">${pygData.totalBalance.toLocaleString()}€</td></tr>
        <tr><td class="pdf-kv">Rentabilidad</td><td class="pdf-kv pdf-r">${pygData.rentabilidad}%</td></tr>
      </table>
      ${pygData.gastosPorCategoria?.length > 0 ? `
      <h4 class="pdf-sec4" style="color:#ef4444;">Gastos por Categoría</h4>
      <table class="pdf-tbl pdf-tbl-sm">
        <thead><tr class="pdf-bg0"><th class="pdf-th-sm">Categoría</th><th class="pdf-th-sm pdf-r">Total</th><th class="pdf-th-sm pdf-r">%</th></tr></thead>
        <tbody>${pygData.gastosPorCategoria.map(g => `<tr><td class="pdf-td">${g.categoria}</td><td class="pdf-td pdf-r">${g.total.toLocaleString()}€</td><td class="pdf-td pdf-r">${pygData.totalGastos > 0 ? InformesView._fmt(((g.total / pygData.totalGastos) * 100), 1) : 0}%</td></tr>`).join('')}</tbody>
      </table>` : ''}
    `;
  },

  _pdfSeccionCosteProd(d) {
    const { costeProdData } = d;
    if (!costeProdData?.porRebano?.length) return '';
    return `
      <h3 class="pdf-sec" style="color:#8b5cf6;">${Icons.gastos({ class: 'icon' })} Coste de Producción por Animal</h3>
      <table class="pdf-tbl pdf-tbl-sm">
        <thead><tr class="pdf-bg0"><th class="pdf-th-sm">Rebaño</th><th class="pdf-th-sm pdf-c">Animales</th><th class="pdf-th-sm pdf-r">Gasto Total</th><th class="pdf-th-sm pdf-r">€/Cabeza</th><th class="pdf-th-sm pdf-r">€/Día</th></tr></thead>
        <tbody>${costeProdData.porRebano.map(r => `<tr><td class="pdf-td"><strong>${r.nombre}</strong> (${r.especie})</td><td class="pdf-td pdf-c">${r.numAnimales}</td><td class="pdf-td pdf-r">${r.totalGasto.toLocaleString()}€</td><td class="pdf-td pdf-r">${r.costePorCabeza.toLocaleString()}€</td><td class="pdf-td pdf-r">${r.costePorDia}€</td></tr>`).join('')}</tbody>
        <tfoot><tr class="pdf-bg2"><td class="pdf-tot pdf-b">MEDIA GLOBAL</td><td class="pdf-tot pdf-c pdf-b">${costeProdData.totalAnimales}</td><td class="pdf-tot pdf-r pdf-b">${costeProdData.totalGasto.toLocaleString()}€</td><td class="pdf-tot pdf-r pdf-b">${costeProdData.costeMedioCabeza.toLocaleString()}€</td><td class="pdf-tot pdf-r pdf-b">${costeProdData.costeMedioDia}€</td></tr></tfoot>
      </table>
    `;
  },

  _pdfSeccionEficiencia(d) {
    const { eficienciaData } = d;
    if (!eficienciaData?.kpis?.length) return '';
    const semaforoPdf = (s) => s === 'verde' ? '#10b981' : s === 'amarillo' ? '#f59e0b' : '#cc0000';
    return `
      <h3 class="pdf-sec" style="color:#4FADF5;">${Icons.grafico({ class: 'icon' })} Panel de Eficiencia Técnica</h3>
      <table class="pdf-tbl pdf-tbl-md mb-10">
        ${eficienciaData.kpis.map(k => `<tr><td class="pdf-kv pdf-b">${k.label}</td><td class="pdf-kv pdf-r pdf-b" style="color:${semaforoPdf(k.status)};">${k.value}</td><td class="pdf-kv pdf-r pdf-muted">Obj: ${k.objetivo}${k.unidad}</td></tr>`).join('')}
      </table>
      <p class="pdf-tbl-xs pdf-muted">Óptimo · Alerta · Crítico</p>
    `;
  },

  _pdfSeccionCargas(d) {
    const { cargasData } = d;
    if (!cargasData?.porZona?.length) return '';
    return `
      <h3 class="pdf-sec" style="color:#f59e0b;">${Icons.peso({ class: 'icon' })} Cargas y Aforos</h3>
      <table class="pdf-tbl pdf-tbl-sm">
        <thead><tr class="pdf-bg0"><th class="pdf-th-sm">Zona</th><th class="pdf-th-sm pdf-c">Aforo</th><th class="pdf-th-sm pdf-c">Ocupación</th><th class="pdf-th-sm pdf-c">%</th><th class="pdf-th-sm pdf-c">Estado</th></tr></thead>
        <tbody>${cargasData.porZona.map(z => `<tr><td class="pdf-td"><strong>${z.nombre}</strong></td><td class="pdf-td pdf-c">${z.aforo}</td><td class="pdf-td pdf-c">${z.ocupacion}</td><td class="pdf-td pdf-c">${z.pctOcupacion}%</td><td class="pdf-td pdf-c">${z.estado}</td></tr>`).join('')}</tbody>
        <tfoot><tr class="pdf-bg2"><td class="pdf-tot pdf-b">TOTAL</td><td class="pdf-tot pdf-c pdf-b">${cargasData.totalAforo}</td><td class="pdf-tot pdf-c pdf-b">${cargasData.totalOcupacion}</td><td class="pdf-tot pdf-c pdf-b">${cargasData.pctGlobal}%</td><td class="pdf-tot pdf-c">${cargasData.numAlertas > 0 ? cargasData.numAlertas + ' alertas' : 'OK'}</td></tr></tfoot>
      </table>
    `;
  },

  _pdfSeccionRotacion(d) {
    const { rotacionData } = d;
    if (!rotacionData || rotacionData.totalAnimales === 0) return '';
    const u90 = rotacionData.ultimos90 || {};
    return `
      <h3 class="pdf-sec" style="color:#4FADF5;">${Icons.rotacion({ class: 'icon' })} Rotación de Censo (${rotacionData.periodo})</h3>
      <table class="pdf-tbl pdf-tbl-md mb-8">
        <tr><td class="pdf-kv pdf-b">Censo Total</td><td class="pdf-kv pdf-r">${rotacionData.totalAnimales}</td></tr>
        <tr><td class="pdf-kv pdf-b">Animales Activos</td><td class="pdf-kv pdf-r">${rotacionData.activos}</td></tr>
        <tr><td class="pdf-kv">Nacimientos</td><td class="pdf-kv pdf-r pdf-grn">${u90.nacimientos || 0}</td></tr>
        <tr><td class="pdf-kv">Compras</td><td class="pdf-kv pdf-r" style="color:#4FADF5;">${u90.compras || 0}</td></tr>
        <tr><td class="pdf-kv">Ventas</td><td class="pdf-kv pdf-r pdf-red">${u90.ventas || 0}</td></tr>
        <tr><td class="pdf-kv">Bajas</td><td class="pdf-kv pdf-r pdf-muted">${u90.bajas || 0}</td></tr>
        <tr class="pdf-bg1"><td class="pdf-big pdf-b">Entrada Neta</td><td class="pdf-big pdf-r pdf-b pdf-base" style="color:${(u90.entradaNeta || 0) >= 0 ? '#10b981' : '#cc0000'};">${(u90.entradaNeta >= 0 ? '+' : '')}${u90.entradaNeta || 0}</td></tr>
      </table>
      <p class="pdf-tbl-xs pdf-muted">Tasa reposición: ${rotacionData.tasaReposicion} · Tasa bajas: ${rotacionData.tasaBajas}</p>
    `;
  },

  _pdfSeccionFlujoCaja(d) {
    const { flujoCajaData } = d;
    if (!flujoCajaData?.porMes?.length) return '';
    const meses = flujoCajaData.porMes.filter(m => m.entradas > 0 || m.salidas > 0);
    if (!meses.length) return '';
    return `
      <h3 class="pdf-sec" style="color:#14b8a6;">${Icons.grafico({ class: 'icon' })} Flujo de Caja</h3>
      <table class="pdf-tbl pdf-tbl-sm">
        <thead><tr class="pdf-bg0"><th class="pdf-th-sm">Mes</th><th class="pdf-th-sm pdf-r">Entradas</th><th class="pdf-th-sm pdf-r">Salidas</th><th class="pdf-th-sm pdf-r">Neto</th><th class="pdf-th-sm pdf-r">Acumulado</th></tr></thead>
        <tbody>${meses.map(m => `<tr><td class="pdf-td"><strong>${m.mes}</strong></td><td class="pdf-td pdf-r">${m.entradas.toLocaleString()}€</td><td class="pdf-td pdf-r">${m.salidas.toLocaleString()}€</td><td class="pdf-td pdf-r" style="color:${m.neto >= 0 ? '#10b981' : '#cc0000'};">${m.neto.toLocaleString()}€</td><td class="pdf-td pdf-r pdf-b">${m.acumulado.toLocaleString()}€</td></tr>`).join('')}</tbody>
        <tfoot><tr class="pdf-bg2"><td class="pdf-tot pdf-b">TOTAL</td><td class="pdf-tot pdf-r pdf-b">${flujoCajaData.totalEntradas.toLocaleString()}€</td><td class="pdf-tot pdf-r pdf-b">${flujoCajaData.totalSalidas.toLocaleString()}€</td><td class="pdf-tot pdf-r pdf-b" style="color:${flujoCajaData.totalNeto >= 0 ? '#10b981' : '#cc0000'};">${flujoCajaData.totalNeto.toLocaleString()}€</td><td class="pdf-tot pdf-r pdf-b">${flujoCajaData.saldoFinal.toLocaleString()}€</td></tr></tfoot>
      </table>
    `;
  },

  // ========= SECCIONES PDF RENTABILIDAD ESPECIE, CURVA PRODUCCIÓN, BREAK-EVEN =========

  _pdfSeccionRentabilidadEspecie(d) {
    const { rentEspData } = d;
    if (!rentEspData?.porEspecie?.length) return '';
    return `
      <h3 class="pdf-sec" style="color:#8b5cf6;">${Icons.reproduccion({ class: 'icon' })} Rentabilidad por Especie</h3>
      <table class="pdf-tbl pdf-tbl-sm">
        <thead><tr class="pdf-bg0"><th class="pdf-th-sm">Especie</th><th class="pdf-th-sm pdf-c">Animales</th><th class="pdf-th-sm pdf-r">Ingresos</th><th class="pdf-th-sm pdf-r">Gastos</th><th class="pdf-th-sm pdf-r">Balance</th></tr></thead>
        <tbody>${rentEspData.porEspecie.map(e => `<tr><td class="pdf-td"><strong>${e.especie}</strong></td><td class="pdf-td pdf-c">${e.numAnimales}</td><td class="pdf-td pdf-r">${e.ingresos.toLocaleString()}€</td><td class="pdf-td pdf-r">${e.gastos.toLocaleString()}€</td><td class="pdf-td pdf-r pdf-b" style="color:${e.balance >= 0 ? '#10b981' : '#cc0000'};">${e.balance.toLocaleString()}€</td></tr>`).join('')}</tbody>
        <tfoot><tr class="pdf-bg2"><td class="pdf-tot pdf-b">TOTAL</td><td class="pdf-tot pdf-c pdf-b">${rentEspData.porEspecie.reduce((s, e) => s + e.numAnimales, 0)}</td><td class="pdf-tot pdf-r pdf-b">${rentEspData.totalIngresos.toLocaleString()}€</td><td class="pdf-tot pdf-r pdf-b">${rentEspData.totalGastos.toLocaleString()}€</td><td class="pdf-tot pdf-r pdf-b" style="color:${rentEspData.totalBalance >= 0 ? '#10b981' : '#cc0000'};">${rentEspData.totalBalance.toLocaleString()}€</td></tr></tfoot>
      </table>
    `;
  },

  _pdfSeccionCurvaProduccion(d) {
    const { curvaProdData } = d;
    if (!curvaProdData?.porMes?.length) return '';
    return `
      <h3 class="pdf-sec" style="color:#4FADF5;">${Icons.leche({ class: 'icon' })} Curva de Producción</h3>
      <table class="pdf-tbl pdf-tbl-xs">
        <thead><tr class="pdf-bg0"><th class="pdf-th-sm">Mes</th><th class="pdf-th-sm pdf-r">kg</th><th class="pdf-th-sm pdf-r">Litros</th><th class="pdf-th-sm pdf-r">kg Acum</th><th class="pdf-th-sm pdf-r">L Acum</th><th class="pdf-th-sm pdf-r">Ingresos</th></tr></thead>
        <tbody>${curvaProdData.porMes.map(m => `<tr><td class="pdf-td"><strong>${m.mes}</strong></td><td class="pdf-td pdf-r">${InformesView._fmt(m.kg, 1)}</td><td class="pdf-td pdf-r">${InformesView._fmt(m.litros, 1)}</td><td class="pdf-td pdf-r">${InformesView._fmt(m.kgAcum, 1)}</td><td class="pdf-td pdf-r">${InformesView._fmt(m.litrosAcum, 1)}</td><td class="pdf-td pdf-r">${m.ingresos.toLocaleString()}€</td></tr>`).join('')}</tbody>
        <tfoot><tr class="pdf-bg2"><td class="pdf-tot pdf-b">TOTAL</td><td class="pdf-tot pdf-r pdf-b">${this._fmt(curvaProdData.totalKg, 1)}</td><td class="pdf-tot pdf-r pdf-b">${this._fmt(curvaProdData.totalLitros, 1)}</td><td class="pdf-tot pdf-r pdf-b">—</td><td class="pdf-tot pdf-r pdf-b">—</td><td class="pdf-tot pdf-r pdf-b">${curvaProdData.totalIngresos.toLocaleString()}€</td></tr></tfoot>
      </table>
      <p class="pdf-tbl-xs pdf-muted">Meta kg: ${Math.round(curvaProdData.metaKg)} · Meta litros: ${Math.round(curvaProdData.metaLitros)} · Cumplimiento: ${curvaProdData.pctCumplimientoKg}% kg / ${curvaProdData.pctCumplimientoLitros}% L</p>
    `;
  },

  _pdfSeccionBreakEven(d) {
    const { breakEvenData } = d;
    if (!breakEvenData || breakEvenData.ingresosTotal === 0) return '';
    return `
      <h3 class="pdf-sec" style="color:#ef4444;">${Icons.dinero({ class: 'icon' })} Análisis de Punto Muerto (Break-Even)</h3>
      <table class="pdf-tbl pdf-tbl-md mb-10">
        <tr><td class="pdf-kv pdf-b">Costes Fijos</td><td class="pdf-kv pdf-r">${breakEvenData.costesFijos.toLocaleString()}€</td></tr>
        <tr><td class="pdf-kv pdf-b">Costes Variables</td><td class="pdf-kv pdf-r">${breakEvenData.costesVariables.toLocaleString()}€</td></tr>
        <tr><td class="pdf-kv pdf-b">Break-Even Carne</td><td class="pdf-kv pdf-r pdf-b">${breakEvenData.breakEvenKg} kg <span style="color:${breakEvenData.cubiertoCarne ? '#10b981' : '#cc0000'};">(${breakEvenData.cubiertoCarne ? 'Cubierto' : 'No cubierto'})</span></td></tr>
        <tr><td class="pdf-kv pdf-b">Break-Even Leche</td><td class="pdf-kv pdf-r pdf-b">${breakEvenData.breakEvenLitros} L <span style="color:${breakEvenData.cubiertoLeche ? '#10b981' : '#cc0000'};">(${breakEvenData.cubiertoLeche ? 'Cubierto' : 'No cubierto'})</span></td></tr>
        <tr><td class="pdf-kv">Margen Seguridad Carne</td><td class="pdf-kv pdf-r">${breakEvenData.margenSeguridadKg}</td></tr>
        <tr><td class="pdf-kv">Margen Seguridad Leche</td><td class="pdf-kv pdf-r">${breakEvenData.margenSeguridadLitros}</td></tr>
      </table>
    `;
  },

  // ========= LOGO Y FALLBACK =========

  // ===================== HERRAMIENTA COMPARTIR CON BOTÓN FLOTANTE =====================

  _btnFlotanteEl: null,
  _btnFlotanteTimeout: null,

  /** Muestra un botón flotante "Compartir" que preserva el gesto del usuario */
  _mostrarBotonFlotante(fileObj) {
    this._ocultarBotonFlotante();
    // Guardar en global para que el botón lo use
    window.__shareFile = fileObj;

    const el = document.createElement('div');
    el.id = 'floating-share-btn';
    el.style.cssText = `
      position:fixed; bottom:140px; left:50%; transform:translateX(-50%);
      z-index:9999; background:linear-gradient(135deg,#d97706,#b45309);
      color:#fff; border:none; border-radius:50px;
      padding:16px 28px; font-size:1rem; font-weight:900;
      box-shadow:0 8px 32px rgba(217,119,6,0.5);
      cursor:pointer; display:flex; align-items:center; gap:10px;
      animation:fadeInUp 0.3s ease-out;
      letter-spacing:0.3px;
    `;
    el.innerHTML = `Compartir ${fileObj.titulo}`;
    el.onclick = async () => {
      el.innerHTML = 'Compartiendo...';
      el.style.pointerEvents = 'none';
      await this._ejecutarShare(fileObj);
      this._ocultarBotonFlotante();
    };
    document.body.appendChild(el);
    this._btnFlotanteEl = el;

    // Auto-ocultar tras 30s
    this._btnFlotanteTimeout = setTimeout(() => this._ocultarBotonFlotante(), 30000);
  },

  _ocultarBotonFlotante() {
    if (this._btnFlotanteTimeout) {
      clearTimeout(this._btnFlotanteTimeout);
      this._btnFlotanteTimeout = null;
    }
    if (this._btnFlotanteEl) {
      this._btnFlotanteEl.remove();
      this._btnFlotanteEl = null;
    }
    window.__shareFile = null;
  },

  /** Intenta compartir por todos los medios disponibles */
  async _ejecutarShare(fileObj) {
    const { blob, fileName, mimeType, titulo, shareTitle, shareText } = fileObj;

    // 1️⃣ Capacitor Native Share (Android nativo)
    try {
      const cap = window.Capacitor;
      const fsPlugin = cap?.Plugins?.Filesystem;
      const sharePlugin = cap?.Plugins?.Share;
      if (fsPlugin && sharePlugin) {
        const dataUri = await this._blobToBase64(blob);
        const result = await fsPlugin.writeFile({
          path: fileName,
          data: dataUri.split(',')[1],
          directory: 'CACHE'
        });
        await sharePlugin.share({
          title: shareTitle || 'Livestock Manager',
          text: shareText || '',
          url: result.uri,
          dialogTitle: `Compartir ${titulo} con…`
        });
        App.toast(`${titulo} compartido`, 'success');
        return true;
      }
    } catch (e) {
      console.warn(`[Capacitor Share ${titulo}]`, e?.message || e);
    }

    // 2️⃣ navigator.share (Web/PWA)
    try {
      if (navigator.share) {
        const file = new File([blob], fileName, { type: mimeType });
        await navigator.share({
          title: shareTitle || 'Livestock Manager',
          text: shareText || '',
          files: [file]
        });
        App.toast(`${titulo} compartido`, 'success');
        return true;
      }
    } catch (e) {
      if (e.name === 'AbortError') return true; // usuario canceló
      console.warn(`[navigator.share ${titulo}]`, e?.message || e);
    }

    // 3️⃣ Fallback: descarga directa
    App.toast(`Descargando ${titulo}...`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    App.toast(`${titulo} descargado`, 'success');
    return false;
  },

  /** Simplifica la exportación: genera blob y muestra botón flotante */
  async _exportarConCompartir(generador, titulo, fileName, mimeType, seccion) {
    App.toast(`Generando ${titulo}...`);
    try {
      const blob = await generador();
      App.toast(`${titulo} listo`, 'success');

      const finca = await window.Fincas?.getActive().catch(() => null) || null;
      const shareTitle = 'Informe Livestock Manager';
      const shareText = `Informe ${seccion || 'completo'} — ${finca?.nombre || 'Explotación'}`;
      const fileObj = { blob, fileName, mimeType, titulo, seccion, shareTitle, shareText };

      // Intentar compartir directamente con Capacitor (no necesita gesto)
      const exito = await this._ejecutarShare(fileObj);
      if (!exito) {
        // Mostrar botón flotante para reintentar con gesto fresco
        this._mostrarBotonFlotante(fileObj);
        App.toast(`Toca "Compartir ${titulo}" para enviar`);
      }
    } catch (e) {
      console.error(`[Exportar ${titulo}]`, e);
      App.toastError(`Error al generar ${titulo}`);
    }
  },

  async _getLogoBase64() {
    try {
      const resp = await fetch('icons/Logo SDOGFARMCORE.png');
      if (!resp.ok) {
        const resp2 = await fetch('icons/Logo aplicación.png');
        if (!resp2.ok) return null;
        return await this._blobToBase64(await resp2.blob());
      }
      return await this._blobToBase64(await resp.blob());
    } catch (e) { return null; }
  },

  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  },

  // ==========================================
  // TAB: EXPORTACIÓN OFICIAL (REGA / SIA / PIGGAN)
  // ==========================================
  _renderExportar(content, d) {
    if (!window.ExportService) {
      content.innerHTML = `<div class="card empty-state>ExportService no disponible. Recarga la aplicación.</div>`;
      return;
    }

    content.innerHTML = `
    <div class="mb-20">
      <h3 class="text-gold mb-6">${Icons.exportar()} Exportación Oficial</h3>
      <p class="text-gray text-sm">Genera ficheros compatibles con REGA, SIA/PIGGAN y plataformas autonómicas.</p>
    </div>
    <div class="grid gap-15">
      <div class="card" style="--registro-color: var(--c-warning);">
        <div class="flex justify-between items-center">
          <div>
            <h4 class="text-white mb-4">${Icons.informeRega()} REGA — Censo y Explotación</h4>
            <p class="text-gray text-xs m-0">CSV del censo actual + XML estructurado con datos de la explotación. Compatible con SIGGAN/BADIGEX.</p>
          </div>
          <button class="btn btn-primary btn-download btn--amber" onclick="InformesView._exportREGA()">${Icons.exportar()} Descargar</button>
        </div>
      </div>
      <div class="card" style="--registro-color: var(--c-info);">
        <div class="flex justify-between items-center">
          <div>
            <h4 class="text-white mb-4">${Icons.rotacion()} SIA/PIGGAN — Movimientos</h4>
            <p class="text-gray text-xs m-0">CSV de altas, bajas y expediciones. Incluye crotal, especie, motivo y destino/origen.</p>
          </div>
          <button class="btn btn-primary btn-download btn--blue" onclick="InformesView._exportMovimientos()">${Icons.exportar()} Descargar</button>
        </div>
      </div>
      <div class="card" style="--registro-color: var(--c-success);">
        <div class="flex justify-between items-center">
          <div>
            <h4 class="text-white mb-4">${Icons.grafico()} PIGGAN — Producción</h4>
            <p class="text-gray text-xs m-0">CSV de producción láctea (litros, calidad) y cárnica (peso canal, precio).</p>
          </div>
          <button class="btn btn-primary btn-download btn--green-dk" onclick="InformesView._exportProduccion()">${Icons.exportar()} Descargar</button>
        </div>
      </div>
      <div class="card" style="--registro-color: var(--c-purple);">
        <div class="flex justify-between items-center">
          <div>
            <h4 class="text-white mb-4">${Icons.paquete()} Exportación Completa</h4>
            <p class="text-gray text-xs m-0">Descarga todos los ficheros: REGA (CSV+XML), movimientos SIA y producción PIGGAN.</p>
          </div>
          <button class="btn btn-primary btn-download btn--purple" onclick="InformesView._exportCompleto()">${Icons.exportar()} Todo</button>
        </div>
      </div>
    </div>
    <div class="inf-export-note">
      <strong class="text-gold">${Icons.info()} Formatos:</strong> CSV (Excel/LibreOffice, UTF-8 BOM) y XML (SIGGAN/BADIGEX). Los nombres incluyen REGA + fecha.
    </div>`;
  },

  // =========== EXPORT HANDLERS ===========
  async _exportREGA() {
    const d = InformesView._cachedData;
    if (!d || !window.ExportService) return App.toastError('Datos no disponibles');
    InformesView._preflight('Exportación REGA (Censo)', d.finca, d.animales, null, async () => {
      App.toast('Generando exportación REGA...');
      await ExportService.exportarREGA(d.finca, d.animales, d.rebanos, { skipPreflight: true });
    });
  },
  async _exportMovimientos() {
    const d = InformesView._cachedData;
    if (!d || !window.ExportService) return App.toastError('Datos no disponibles');
    InformesView._preflight('Exportación Movimientos SIA', d.finca, d.animales, d.eventos, async () => {
      App.toast('Generando exportación movimientos...');
      await ExportService.exportarMovimientos(d.eventos, d.animales, d.finca, { skipPreflight: true });
    });
  },
  async _exportProduccion() {
    const d = InformesView._cachedData;
    if (!d || !window.ExportService) return App.toastError('Datos no disponibles');
    const prodLeche = InformesView._cachedLeche || [];
    App.toast('Generando exportación producción...');
    await ExportService.exportarProduccion(prodLeche, d.ventasCompleto || []);
  },
  async _exportCompleto() {
    const d = InformesView._cachedData;
    if (!d || !window.ExportService) return App.toastError('Datos no disponibles');
    const prodLeche = InformesView._cachedLeche || [];
    InformesView._preflight('Exportación Completa (REGA + SIA + PIGGAN)', d.finca, d.animales, d.eventos, async () => {
      App.toast('Generando exportación completa...');
      await ExportService.exportarCompleto(d.finca, d.animales, d.rebanos, d.eventos, prodLeche, d.ventasCompleto || [], { skipPreflight: true });
    });
  },

  // =========== PRE-FLIGHT CHECK (validación previa con modal) ===========
  /**
   * Ejecuta la validación semántica y decide el flujo:
   *  - errores bloqueantes  → modal de error (sin descarga)
   *  - solo avisos          → modal de confirmación (tabla + "Descargar igualmente")
   *  - censo limpio         → descarga directa
   * @param {string} titulo
   * @param {object} finca
   * @param {object[]} animales
   * @param {object[]|null} eventos
   * @param {Function} onConfirm - callback que lanza la descarga real
   */
  _preflight(titulo, finca, animales, eventos, onConfirm) {
    const reporte = ExportService.validarPreExportacion(finca, animales, eventos || []);
    if (!reporte.valido) {
      InformesView._renderValidacionModal({ titulo, reporte, onConfirm: null });
      return;
    }
    if (!reporte.avisos.length) {
      onConfirm(); // todo correcto → directo
      return;
    }
    InformesView._renderValidacionModal({ titulo, reporte, onConfirm });
  },

  _renderValidacionModal({ titulo, reporte, onConfirm }) {
    const bloqueante = !reporte.valido;
    const accent = bloqueante ? '#ef4444' : '#f59e0b';
    const icon = bloqueante ? Icons.cerrar() : Icons.alerta();

    const erroresHtml = reporte.errores.length ? `
      <div class="mb-16">
        <h4 class="modal-val-err-title">Errores que impiden la exportación</h4>
        <ul class="modal-val-err-list">
          ${reporte.errores.map(e => `<li class="mb-4">${InformesView._esc(e)}</li>`).join('')}
        </ul>
      </div>` : '';

    const avisosHtml = reporte.avisos.length ? `
      <div>
        <h4 class="modal-val-warn-title">Avisos (${reporte.avisos.length}) — no impiden la exportación</h4>
        <div class="modal-val-scroll-box">
          <table class="modal-val-table">
            <thead>
              <tr class="modal-val-thead">
                <th class="modal-val-th modal-val-th--idx">#</th>
                <th class="modal-val-th">Incidencia</th>
              </tr>
            </thead>
            <tbody>
              ${reporte.avisos.map((a, i) => `
                <tr class="modal-val-tr">
                  <td class="modal-val-td-idx">${i + 1}</td>
                  <td class="modal-val-td">${InformesView._esc(a)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="modal-val-note">
          La plataforma autonómica (SIGGAN/BADIGEX) procesará el resto del censo y rechazará o advertirá únicamente las líneas afectadas.
        </p>
      </div>` : '';

    const botones = bloqueante ? `
      <button class="modal-val-btn" onclick="ModalManager.close('modal-validacion-export')">Entendido</button>
    ` : `
      <button class="modal-val-btn" onclick="ModalManager.close('modal-validacion-export')">Cancelar</button>
      <button class="modal-val-btn modal-val-btn--accent" style="--val-accent:${accent}" onclick="InformesView._confirmExport()">${Icons.exportar()} Descargar igualmente</button>
    `;

    InformesView._pendingExport = onConfirm || null;

    const content = `
      <div class="modal-val-wrap" style="--val-accent:${accent}">
        <div class="modal-val-header">
          <span class="text-2rem">${icon}</span>
          <div>
            <h3 class="modal-val-title">${InformesView._esc(titulo)}</h3>
            <p class="modal-val-subtitle">Verificación previa antes de generar el fichero</p>
          </div>
        </div>
        <div class="modal-val-body">
          ${erroresHtml}
          ${avisosHtml}
        </div>
        <div class="modal-val-footer">
          ${botones}
        </div>
      </div>`;

    ModalManager.show('modal-validacion-export', content, { closeOnOverlayClick: !bloqueante });
  },

  _confirmExport() {
    const fn = InformesView._pendingExport;
    InformesView._pendingExport = null;
    ModalManager.close('modal-validacion-export');
    if (typeof fn === 'function') fn();
  },

  _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  _exportFallback() {
    App.toastError("No se pudo generar el PDF (librería no disponible sin conexión)");
    const html = `
      <div style="padding:30px; box-sizing:border-box; font-family:'Inter',system-ui,sans-serif; color:#000;">
        <h1 style="color:#d97706;">Livestock Manager</h1>
        <p>Informe generado el ${new Date().toLocaleDateString()}.</p>
        <p><em>La librería de exportación PDF no pudo cargarse (sin conexión). Vuelve a intentarlo con conexión a internet.</em></p>
        <hr><p style="color:#999;font-size:0.7rem;">Livestock Manager Premium</p>
      </div>`;
    DocumentViewer.show({
      id: 'doc-viewer-informes-fallback',
      title: 'Informe Livestock Manager',
      html,
      filename: `Informe_${Date.now()}`
    });
  }
});
