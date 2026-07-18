/**
 * PdfService - Livestock Manager Premium v4.0
 * Servicio unificado de generación de PDFs: albaranes, facturas, certificados.
 * Utiliza html2pdf (CDN) para la conversión a PDF.
 */

const PdfService = {
  /**
   * Crear overlay de previsualización PDF y descarga
   * @param {Object} opts
   * @param {string} opts.title - Título del documento
   * @param {string} opts.filename - Nombre del archivo PDF
   * @param {string} opts.contentHtml - HTML del contenido del documento
   * @param {Function} [opts.onClose] - Callback al cerrar
   * @returns {HTMLElement} overlay
   */
  mostrarPDF({ title = 'Documento', filename = 'documento.pdf', contentHtml, onClose } = {}) {
    return DocumentViewer.show({
      id: 'doc-viewer-pdfservice',
      title,
      html: `<div style="padding:30px; box-sizing:border-box; font-family:serif; color:black;">${contentHtml}</div>`,
      filename: filename.replace(/\.pdf$/i, ''),
      shareTitle: title,
      onClose
    });
  },

  /**
   * Generar cabecera común para documentos PDF
   */
  generarCabecera({ titulo, numero, fecha, logoUrl = 'icons/Logo aplicación.png' } = {}) {
    return `
      <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:10px;">
        <img src="${logoUrl}" style="height:50px; filter:grayscale(1);">
        <div style="text-align:right;">
          <h1 style="margin:0; font-size:1.5rem;">${titulo}</h1>
          <p class="m-0">Nº: ${numero || ''}</p>
          <p class="m-0">Fecha: ${fecha || ''}</p>
        </div>
      </div>
    `;
  },

  /**
   * Generar HTML de vendedor/comprador para documentos
   */
  generarBloqueVenta(vendedor, comprador) {
    return `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:40px; margin-top:30px;">
        <div>
          <h4 style="border-bottom:1px solid #ddd;">VENDEDOR (REGA)</h4>
          <p><strong>${vendedor.nombre}</strong><br>
            ${vendedor.nif ? 'NIF: ' + vendedor.nif + '<br>' : ''}
            REGA: ${vendedor.rega}<br>
            ${vendedor.direccion}</p>
        </div>
        <div>
          <h4 style="border-bottom:1px solid #ddd;">COMPRADOR</h4>
          <p><strong>${comprador.nombre}</strong><br>
            NIF: ${comprador.nif}<br>
            ${comprador.direccion}</p>
        </div>
      </div>
    `;
  },

  /**
   * Generar tabla estilizada
   */
  generarTabla(filas, columnas) {
    if (!filas || filas.length === 0) return '<p style="color:#888;">Sin datos</p>';
    return `
      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.9rem;">
        ${filas.map(f => {
          const key = Object.keys(f)[0];
          const val = f[key];
          const colspan = columnas ? '' : '';
          return `<tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold; width:${columnas || 'auto'};">${key}</td>
            <td class="td-val">${val}</td>
          </tr>`;
        }).join('')}
      </table>
    `;
  },

  /**
   * Generar Certificado Fitosanitario
   */
  generarCertificadoFitosanitario({ finca, animales, declaracion, veterinario, fecha, numeroSerie } = {}) {
    const crotales = (animales || []).map(a => a.numero_identificacion || a.crotal || '').filter(Boolean).join(', ');
    return `
      <div style="font-family:serif; color:black;">
        <div style="text-align:center; margin-bottom:30px; border-bottom:2px solid #000; padding-bottom:15px;">
          <h1 style="font-size:1.8rem; margin:0;">CERTIFICADO FITOSANITARIO</h1>
          <p style="font-size:0.9rem; margin:5px 0 0 0;">Declaración Jurada Colectiva de Garantía Sanitaria</p>
          <p style="margin:0; font-size:0.8rem; color:#555;">Nº: ${numeroSerie || 'CF-' + Date.now()}</p>
        </div>

        <div style="margin-bottom:20px;">
          <h4 style="border-bottom:1px solid #ddd; padding-bottom:5px;">DATOS DE LA EXPLOTACIÓN</h4>
          <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
            <tr><td style="padding:4px 8px; font-weight:bold;">Nombre</td><td style="padding:4px 8px;">${finca?.nombre || ''}</td></tr>
            <tr><td style="padding:4px 8px; font-weight:bold;">REGA</td><td style="padding:4px 8px;">${finca?.codigo_REGA || finca?.rega || ''}</td></tr>
            <tr><td style="padding:4px 8px; font-weight:bold;">Dirección</td><td style="padding:4px 8px;">${finca?.direccion || ''}</td></tr>
            <tr><td style="padding:4px 8px; font-weight:bold;">Propietario</td><td style="padding:4px 8px;">${finca?.propietario || ''}</td></tr>
            <tr><td style="padding:4px 8px; font-weight:bold;">NIF</td><td style="padding:4px 8px;">${finca?.nif_cif || ''}</td></tr>
          </table>
        </div>

        <div style="margin-bottom:20px;">
          <h4 style="border-bottom:1px solid #ddd; padding-bottom:5px;">DECLARACIÓN</h4>
          <p style="font-size:0.9rem; line-height:1.6; padding:10px; background:#f8f8f8; border-radius:4px;">
            D/Dña. <strong>${finca?.propietario || 'El titular de la explotación'}</strong>, como responsable de la explotación ganadera con REGA <strong>${finca?.codigo_REGA || finca?.rega || ''}</strong>,
            DECLARA BAJO SU RESPONSABILIDAD que los animales relacionados a continuación han permanecido en la explotación durante los últimos
            <strong>180 días</strong> y que no han sido tratados con sustancias prohibidas ni se encuentran en periodo de supresión,
            cumpliendo con lo dispuesto en el <strong>RD 1083/2001</strong> y normativa europea de seguridad alimentaria.
          </p>
        </div>

        <div style="margin-bottom:20px;">
          <h4 style="border-bottom:1px solid #ddd; padding-bottom:5px;">ANIMALES INCLUIDOS</h4>
          <p style="font-size:0.9rem;">${crotales || 'No se especifican animales individuales — Certificado colectivo del lote.'}</p>
        </div>

        <div style="margin-bottom:20px;">
          <h4 style="border-bottom:1px solid #ddd; padding-bottom:5px;">AUTORIZACIÓN VETERINARIA</h4>
          <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
            <tr><td style="padding:4px 8px; font-weight:bold;">Veterinario</td><td style="padding:4px 8px;">${veterinario?.nombre || 'Pendiente'}</td></tr>
            <tr><td style="padding:4px 8px; font-weight:bold;">Nº Colegiado</td><td style="padding:4px 8px;">${veterinario?.colegiado || 'Pendiente'}</td></tr>
            <tr><td style="padding:4px 8px; font-weight:bold;">Fecha</td><td style="padding:4px 8px;">${fecha || ''}</td></tr>
          </table>
        </div>

        <div style="margin-top:40px; display:grid; grid-template-columns:1fr 1fr; gap:20px;">
          <div style="text-align:center;">
            <div style="border-top:1px solid #000; padding-top:8px; margin-top:60px; font-size:0.85rem;">
              Firma del Veterinario<br>
              <small>${veterinario?.nombre || ''} — ${veterinario?.colegiado || ''}</small>
            </div>
          </div>
          <div style="text-align:center;">
            <div style="border-top:1px solid #000; padding-top:8px; margin-top:60px; font-size:0.85rem;">
              Sello de la Explotación<br>
              <small>${finca?.codigo_REGA || finca?.rega || ''}</small>
            </div>
          </div>
        </div>

        <div style="margin-top:30px; text-align:center; font-size:0.8rem; border-top:1px solid #eee; padding-top:20px;">
          <p>Documento generado electrónicamente por Livestock Manager Premium v4.0</p>
          <p>${numeroSerie || ''}</p>
        </div>
      </div>
    `;
  },

  /**
   * Generar Factura PDF completa
   */
  generarFactura({ albaran, liquidacion, numeroFactura, finca } = {}) {
    if (!albaran || !liquidacion) return '<p style="color:red;">Error: Faltan datos para generar la factura.</p>';
    const cab = albaran.cabecera;
    const traza = albaran.trazabilidad || {};
    const econ = albaran.economico || {};

    const lineasDesglose = liquidacion.desglose || [];

    return `
      <div style="font-family:serif; color:black;">
        ${PdfService.generarCabecera({
          titulo: 'FACTURA',
          numero: numeroFactura || cab.numero_albaran || '',
          fecha: cab.fecha_emision || ''
        })}
        ${PdfService.generarBloqueVenta(cab.vendedor, cab.comprador)}

        <div style="margin-top:30px;">
          <h3 style="background:#eee; padding:5px; font-size:1rem;">DATOS DE LA VENTA</h3>
          <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.9rem;">
            <tr><td class="td-lbl">Nº Albarán</td><td class="td-val">${traza.numero_albaran || 'N/A'}</td></tr>
            <tr><td class="td-lbl">DIMOE</td><td class="td-val">${traza.dimoe || 'N/A'}</td></tr>
            <tr><td class="td-lbl">Matadero Destino</td><td class="td-val">${traza.matadero || 'N/D'}</td></tr>
            <tr><td class="td-lbl">Peso Canal (kg)</td><td class="td-val">${econ.peso_canal || 0}</td></tr>
          </table>
        </div>

        <div style="margin-top:30px;">
          <h3 style="background:#eee; padding:5px; font-size:1rem;">DESGLOSE ECONÓMICO</h3>
          <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.9rem;">
            ${lineasDesglose.map(item => `
              <tr ${item.bold ? 'style="font-weight:bold; border-top:2px solid #000;"' : ''}>
                <td style="padding:8px; border-bottom:1px solid #ddd;">${item.concepto}</td>
                <td style="padding:8px; text-align:right; border-bottom:1px solid #ddd;">${item.cantidad >= 0 ? '' : '-'}${Liquidacion.formatEUR(Math.abs(item.cantidad))}</td>
              </tr>
            `).join('')}
          </table>
        </div>

        ${traza.transportista ? `
        <div style="margin-top:30px;">
          <h3 style="background:#eee; padding:5px; font-size:1rem;">TRANSPORTE</h3>
          <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.9rem;">
            <tr><td class="td-lbl">Transportista</td><td class="td-val">${traza.transportista.nombre}</td></tr>
            <tr><td class="td-lbl">NIF</td><td class="td-val">${traza.transportista.nif || 'N/D'}</td></tr>
            <tr><td class="td-lbl">Matrícula</td><td class="td-val">${traza.transportista.matricula || 'N/D'}</td></tr>
          </table>
        </div>` : ''}

        <div style="margin-top:40px; text-align:center; font-size:0.8rem; border-top:1px solid #eee; padding-top:20px;">
          <p>Documento generado electrónicamente por Livestock Manager Premium v4.0</p>
        </div>
      </div>
    `;
  }
};

window.PdfService = PdfService;
