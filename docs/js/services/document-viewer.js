/**
 * Livestock Manager - DocumentViewer
 * Visor común para documentos generados desde wizards (Crotales, Movimientos,
 * Albarán, Documentos, Informes, Cuaderno...). Sustituye a los overlays sueltos
 * que cada vista construía por su cuenta.
 *
 * Se apoya en piezas que ya funcionan en la app en vez de reinventar nada:
 * - ModalManager: registro/cierre robusto (tecla Escape, botón físico "atrás"
 *   de Android vía AppPlugin.addListener('backButton') en app.js).
 * - html2pdf + InformesView._ejecutarShare (Capacitor Share / navigator.share /
 *   descarga de blob): generación y envío del PDF, sin usar window.open/print()
 *   (roto en el WebView de Capacitor Android).
 */
const DocumentViewer = {
  /**
   * @param {Object} opts
   * @param {string} [opts.id] - Id único del visor (para ModalManager). Se autogenera si se omite.
   * @param {string} opts.title - Título mostrado en la cabecera.
   * @param {string} opts.html - HTML del documento (fondo blanco, tipo hoja imprimible).
   * @param {string} opts.filename - Nombre base del PDF a generar (sin extensión).
   * @param {string} [opts.shareTitle] - Título usado en la hoja de compartir del sistema.
   * @param {string} [opts.shareText] - Texto usado en la hoja de compartir del sistema.
   * @param {Function} [opts.onClose] - Callback al cerrarse, por cualquier vía (X, Cerrar, Escape, atrás).
   * @returns {HTMLElement} El overlay creado.
   */
  show(opts) {
    const { title = '', html = '', filename = 'documento' } = opts;
    const shareTitle = opts.shareTitle || title || 'Documento';
    const shareText = opts.shareText || '';
    const id = opts.id || `doc-viewer-${Date.now()}`;
    const contentId = `${id}-content`;

    const contentHtml = `
      <div class="doc-viewer">
        <div class="doc-viewer-header">
          <span class="doc-viewer-title">${title}</span>
          <button type="button" class="doc-viewer-close-x" id="${id}-close-x" aria-label="Cerrar">${Icons.cerrar()}</button>
        </div>
        <div class="doc-viewer-body" id="${contentId}">${html}</div>
        <div class="doc-viewer-footer">
          <button type="button" class="btn btn-primary" id="${id}-share" style="flex:1; font-weight:900;">${Icons.exportar()} EXPORTAR / COMPARTIR</button>
          <button type="button" class="btn btn-secondary" id="${id}-close" style="flex:0 0 auto; padding:0 24px;">CERRAR</button>
        </div>
      </div>
    `;

    const overlay = ModalManager.show(id, contentHtml, { closeOnOverlayClick: false });
    // ModalManager centra tarjetas pequeñas por defecto; el visor de documento
    // necesita ocupar toda la pantalla, así que se ajusta tras la creación.
    overlay.classList.add('doc-viewer-overlay');
    overlay.style.alignItems = 'stretch';
    overlay.style.justifyContent = 'stretch';
    overlay.style.padding = '0';
    overlay.style.background = '#000';
    overlay.style.backdropFilter = 'none';
    overlay.style.webkitBackdropFilter = 'none';

    const close = () => ModalManager.close(id);
    overlay.querySelector(`#${id}-close`).addEventListener('click', close);
    overlay.querySelector(`#${id}-close-x`).addEventListener('click', close);
    overlay.querySelector(`#${id}-share`).addEventListener('click', () => {
      DocumentViewer._exportarYCompartir({
        sourceEl: overlay.querySelector(`#${contentId}`),
        filename,
        shareTitle,
        shareText,
        titulo: title || 'Documento'
      });
    });

    if (typeof opts.onClose === 'function') {
      // El overlay puede cerrarse por varias vías (X, Cerrar, Escape, botón
      // atrás de Android vía ModalManager.close). Observar su desaparición
      // real del DOM es más robusto que enganchar cada vía por separado.
      const parent = overlay.parentNode;
      const observer = new MutationObserver(() => {
        if (!overlay.isConnected) {
          observer.disconnect();
          opts.onClose();
        }
      });
      if (parent) observer.observe(parent, { childList: true });
    }

    return overlay;
  },

  /** Genera el PDF del contenido y lo comparte, con loader de progreso propio. */
  async _exportarYCompartir({ sourceEl, filename, shareTitle, shareText, titulo }) {
    if (!sourceEl) { App.toastError('Contenido no disponible'); return; }

    const loader = document.createElement('div');
    loader.className = 'pdf-loader-overlay';
    loader.innerHTML = `
      <div class="pdf-loader">
        <div class="pdf-loader-icon" style="color:var(--p-gold); margin-bottom:15px; transform:scale(2);">${Icons.documento()}</div>
        <div class="pdf-loader-title">Generando PDF</div>
        <div class="pdf-loader-desc">${titulo}</div>
        <div class="pdf-loader-bar"><div id="doc-viewer-progress-bar" class="pdf-loader-fill"></div></div>
        <div id="doc-viewer-progress-text" class="pdf-loader-status">PROCESANDO...</div>
      </div>
    `;
    document.body.appendChild(loader);
    const updateProgress = (pct, text) => {
      const bar = loader.querySelector('#doc-viewer-progress-bar');
      const txt = loader.querySelector('#doc-viewer-progress-text');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = text.toUpperCase();
    };

    let tempContainer;
    try {
      updateProgress(20, 'Preparando documento...');

      // Renderizar en un contenedor A4 dentro del viewport (necesario para que
      // html2canvas lo capture; posicionarlo fuera de pantalla produce un PDF en
      // blanco). Queda oculto visualmente detrás del loader (z-index superior).
      tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position:fixed; left:0; top:0; width:800px; background:#fff; color:#000; padding:30px; box-sizing:border-box; z-index:1;';
      tempContainer.innerHTML = sourceEl.innerHTML;
      tempContainer.querySelectorAll('*').forEach(el => { el.style.color = '#000'; });
      document.body.appendChild(tempContainer);

      if (typeof html2pdf === 'undefined' && !(await App._ensureHtml2Pdf())) {
        App.toastError('Librería PDF no disponible');
        return;
      }

      updateProgress(60, 'Generando PDF...');
      const pdfFilename = `${filename}.pdf`;
      const opt = {
        margin: [12, 10, 12, 10],
        filename: pdfFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: 800,
          windowWidth: 800,
          scrollX: 0,
          scrollY: 0,
          height: tempContainer.scrollHeight,
          windowHeight: tempContainer.scrollHeight
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      const pdfBlob = await html2pdf().set(opt).from(tempContainer).toPdf().output('blob');

      updateProgress(90, 'Compartiendo...');
      const fileObj = { blob: pdfBlob, fileName: pdfFilename, mimeType: 'application/pdf', titulo, shareTitle, shareText };

      if (window.InformesView && typeof InformesView._ejecutarShare === 'function') {
        await InformesView._ejecutarShare(fileObj);
      } else {
        await DocumentViewer._compartirFallback(fileObj);
      }

      updateProgress(100, '¡Listo!');
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.error('[DocumentViewer] Error al generar/compartir PDF:', e);
      App.toastError('Error al generar PDF: ' + e.message);
    } finally {
      if (tempContainer && tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer);
      loader.remove();
    }
  },

  /** Fallback de compartición si InformesView no está cargado (Capacitor Share → navigator.share → descarga). */
  async _compartirFallback({ blob, fileName, shareTitle, shareText }) {
    const cap = window.Capacitor;
    if (cap?.Plugins?.Share && cap?.Plugins?.Filesystem) {
      const reader = new FileReader();
      const dataUri = await new Promise((res, rej) => { reader.onload = () => res(reader.result); reader.onerror = rej; reader.readAsDataURL(blob); });
      const result = await cap.Plugins.Filesystem.writeFile({ path: fileName, data: dataUri.split(',')[1], directory: 'CACHE' });
      await cap.Plugins.Share.share({ title: shareTitle, text: shareText, url: result.uri, files: [result.uri], dialogTitle: 'Compartir con…' });
      App.toast('Documento compartido', 'success');
      return;
    }
    if (navigator.share) {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      await navigator.share({ title: shareTitle, text: shareText, files: [file] });
      App.toast('Documento compartido', 'success');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
    App.toast('Documento descargado', 'success');
  }
};

window.DocumentViewer = DocumentViewer;
