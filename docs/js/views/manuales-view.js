/**
 * Livestock Manager - ManualesView v1.1.0
 * Lista todos los manuales de usuario, los visualiza dentro de la app
 * y permite exportarlos a PDF.
 */
const ManualesView = {
  _MANUALES: [
    {
      id: 'index',
      titulo: 'Manual de Usuario General',
      descripcion: 'Guía completa de la aplicación: configuración, animales, producción, comercialización, informes y documentos.',
      icono: 'libro',
      archivo: 'manual/index.html',
      color: '#c9851f',
    },
    {
      id: 'carne',
      titulo: 'Ejemplo Práctico: Ovino de Carne',
      descripcion: 'Creación de explotación de ovino de carne desde cero. Cortijo San Pedro, raza Merina, Cádiz. 12 pasos detallados.',
      icono: 'carne',
      archivo: 'manual/ejemplo-ovino-carne.html',
      color: '#8b5e3c',
    },
    {
      id: 'leche',
      titulo: 'Ejemplo Práctico: Ovino de Leche',
      descripcion: 'Creación de explotación de ovino de leche. Quesería Los Llanos, raza Manchega, Granada. Control lechero y MOFA.',
      icono: 'leche',
      archivo: 'manual/ejemplo-ovino-leche.html',
      color: '#2563eb',
    },
    {
      id: 'produccion',
      titulo: 'Registros de Producción',
      descripcion: 'Todos los flujos de producción cárnica y láctea: pesajes, GMD, control lechero, analíticas, liquidaciones y MOFA.',
      icono: 'grafico',
      archivo: 'manual/registros-produccion.html',
      color: 'var(--c-purple)',
    },
    {
      id: 'comercializacion',
      titulo: 'Comercialización',
      descripcion: 'Venta Masiva de animales (5 pasos) y Albarán de Leche (6 pasos): trazabilidad, pesajes, compradores, SEUROP, transportista, analíticas, precio y MOFA.',
      icono: 'comercial',
      archivo: 'manual/manual-comercializacion.html',
      color: '#8b5e3c',
    },
    {
      id: 'pesadas',
      titulo: 'Pesadas Individual y por Lote',
      descripcion: 'Pesada individual de animal y pesaje por lote de rebaño en producción cárnica: asistente, búsqueda, registro de peso y GMD.',
      icono: 'balanza',
      archivo: 'manual/manual-pesadas.html',
      color: '#8b5e3c',
    },
    {
      id: 'control-lechero',
      titulo: 'Control Lechero',
      descripcion: 'Control lechero individual, control por lote y expedición de tanque (albarán de leche 6 pasos): calidad, analíticas, precio y MOFA.',
      icono: 'leche',
      archivo: 'manual/manual-control-lechero.html',
      color: '#2563eb',
    },
    {
      id: 'gastos',
      titulo: 'Gastos',
      descripcion: 'Control de costes analítico: categorías contables (alimentación, sanidad, electricidad, personal), imputación a rebaño/zona y rentabilidad.',
      icono: 'gastos',
      archivo: 'manual/manual-gastos.html',
      color: 'var(--c-warning)',
    },
    {
      id: 'compradores',
      titulo: 'Compradores — Gestión de Clientes',
      descripcion: 'Alta y gestión de compradores (cárnico, lácteo, híbrido), contratos, historial de ventas y entregas de leche. Cómo aparece en Venta Masiva y Albarán de Leche.',
      icono: 'compradores',
      archivo: 'manual/manual-compradores.html',
      color: 'var(--c-danger)',
    },
    {
      id: 'proveedores',
      titulo: 'Proveedores — Trazabilidad de Costes',
      descripcion: 'Alta y gestión de proveedores, categorías de suministro, asociación a gastos analíticos e historial de gasto por proveedor.',
      icono: 'proveedores',
      archivo: 'manual/manual-proveedores.html',
      color: 'var(--c-success)',
    },
    {
      id: 'transportistas',
      titulo: 'Transportistas — Bienestar en Transporte',
      descripcion: 'Alta de transportistas, tipos de vehículo, certificado de bienestar animal, uso en DIMOE de Venta Masiva e historial de expediciones.',
      icono: 'transportistas',
      archivo: 'manual/manual-transportistas.html',
      color: 'var(--c-info)',
    },
    {
      id: 'animales-rebanos',
      titulo: 'Animales y Rebaños — Gestión del Censo',
      descripcion: 'Estructura Finca→Zonas→Rebaños→Animales, alta de rebaño y animal, formato normativo del crotal (ES+12 dígitos), escáner, vinculación madre-cría y estados.',
      icono: 'animales',
      archivo: 'manual/manual-animales-rebanos.html',
      color: '#c9851f',
    },
    {
      id: 'contratos',
      titulo: 'Contratos — Acuerdos Comerciales',
      descripcion: 'Registro de contratos con compradores: tipos (carne/leche/mixto), vigencia, IVA, tabla de precios pactados y su integración en liquidaciones.',
      icono: 'contratos',
      archivo: 'manual/manual-contratos.html',
      color: 'var(--c-purple)',
    },
    {
      id: 'sanitarios',
      titulo: 'Sanitarios — Control de Tratamientos',
      descripcion: 'Registro de tratamientos veterinarios, tipos de medicamento, tiempos de espera para carne y leche, alertas de restricción y catálogo sanitario.',
      icono: 'sanidad',
      archivo: 'manual/manual-sanitarios.html',
      color: 'var(--c-danger)',
    },
    {
      id: 'reproduccion',
      titulo: 'Reproducción — Ciclo Reproductivo',
      descripcion: 'Ciclo reproductivo completo (celo→IA→diagnóstico→parto), genealogía, trazabilidad madre-cría, historial por animal e indicadores de fertilidad.',
      icono: 'reproduccion',
      archivo: 'manual/manual-reproduccion.html',
      color: 'var(--c-pink)',
    },
    {
      id: 'cuaderno-digital',
      titulo: 'Cuaderno Digital Ganadero (RD 787/2023)',
      descripcion: 'Generación del Cuaderno Digital de Explotación Ganadera: censo, movimientos, libro de tratamientos sanitarios y exportación oficial.',
      icono: 'contratos',
      archivo: 'manual/manual-cuaderno-digital.html',
      color: 'var(--c-success)',
    },
    {
      id: 'trazabilidad',
      titulo: 'Trazabilidad 360° de Animales',
      descripcion: 'Línea de tiempo cronológica con la vida completa del animal: nacimiento, pesajes, tratamientos, reproducción y venta final.',
      icono: 'trazabilidad',
      archivo: 'manual/manual-trazabilidad.html',
      color: 'var(--c-purple)',
    },
    {
      id: 'informes-analitica',
      titulo: 'Informes Premium e Inteligencia Analítica',
      descripcion: 'Inteligencia analítica para balances financieros (P y G, punto de equilibrio, PAC), rendimiento reproductivo, curvas de producción y exportaciones.',
      icono: 'grafico',
      archivo: 'manual/manual-informes-analitica.html',
      color: '#e0a83a',
    },
    {
      id: 'gestion-documental',
      titulo: 'Documentos de Transporte y Guías DIMOE',
      descripcion: 'Gestión y archivo oficial de documentos de movimiento de ganado, guías DIMOE y cadena alimentaria (ICA).',
      icono: 'documento',
      archivo: 'manual/manual-gestion-documental.html',
      color: 'var(--c-info)',
    },
  ],

  async render() {
    const main = document.getElementById('app-content');
    main.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <h2 class="page-title"><span style="color:var(--c-purple); margin-right:6px;">|</span> ${Icons.libro()} MANUALES</h2>
          <p class="page-subtitle">Guías de usuario y ejemplos prácticos</p>
        </div>
        <div id="manuales-list" class="flex flex-col gap-14 pb-20">
          ${this._renderLista()}
        </div>
        <div class="text-center text-gray text-xs mt-20" style="padding-bottom:30px;">
          Pulsa sobre un manual para leerlo.<br>
          Usa el botón PDF para generar una copia imprimible.
        </div>
      </div>`;
  },

  _renderLista() {
    return this._MANUALES.map(m => `
      <div class="card-registro manual-card" style="--registro-color: ${m.color}; padding:16px; cursor:pointer;"
           onclick="ManualesView._abrirManual('${m.archivo}', '${m.titulo.replace(/'/g, "\\'")}')">
        <div class="flex items-center gap-14">
          <span class="flex-shrink-0" style="width:32px; height:32px; color:${m.color}; display:flex; align-items:center; justify-content:center;">
            ${Icons[m.icono] ? Icons[m.icono]({ style: 'width:32px; height:32px;' }) : ''}
          </span>
          <div class="flex-1 min-w-0">
            <div style="font-weight:800; font-size:0.95rem; color:#fff; margin-bottom:4px;">${m.titulo}</div>
            <div style="font-size:0.78rem; color:#999; line-height:1.3;">${m.descripcion}</div>
          </div>
          <button class="btn btn-sm" style="flex-shrink:0; background:${m.color}; color:#fff; border:none; border-radius:8px; padding:8px 12px; font-size:0.7rem; font-weight:700;"
                  onclick="event.stopPropagation(); ManualesView._exportarPDF('${m.archivo}', '${m.titulo}')">
            ${Icons.exportar()} PDF
          </button>
        </div>
      </div>
    `).join('');
  },

  async _abrirManual(archivo, titulo) {
    // Cargar el manual dentro de un overlay con iframe y botón de salir
    const overlay = document.createElement('div');
    overlay.id = 'manual-viewer-overlay';
    overlay.className = 'wizard-full-screen';
    overlay.style.cssText = `
      position:fixed; top:0; left:0; right:0; bottom:0; z-index:9999;
      background:#fff; display:flex; flex-direction:column;
    `;

    overlay.innerHTML = `
      <iframe id="manual-frame" src="${archivo}"
              style="flex:1; width:100%; border:none;"
              onerror="this.parentElement.innerHTML='<div style=\\'padding:40px;text-align:center;color:#999;\\'>Error al cargar el manual.</div>'">
      </iframe>
      <div style="display:flex; align-items:center; justify-content:space-between;
                  background:#1a1a2e; padding:8px 14px; padding-bottom:calc(8px + env(safe-area-inset-bottom)); flex-shrink:0; min-height:48px;
                  ">
        <span style="color:#fff; font-weight:800; font-size:0.85rem; display:flex; align-items:center; gap:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">
          <span style="color:#e0a83a; display:flex; align-items:center;">${Icons.libro()}</span>
          ${titulo || 'Manual'}
        </span>
        <button id="btn-cerrar-manual"
                style="background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:0.85rem;
                       padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:700;
                       display:flex; align-items:center; gap:6px; flex-shrink:0;">
          Volver ${Icons.siguiente()}
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-cerrar-manual').onclick = () => {
      overlay.remove();
    };
  },

  async _exportarPDF(archivo, titulo) {
    let loader, container;
    try {
      loader = document.createElement('div');
      loader.id = 'pdf-loader-overlay';
      loader.style.cssText = `
        position:fixed; top:0; left:0; right:0; bottom:0; z-index:100000;
        background:rgba(0,0,0,0.85); display:flex; flex-direction:column;
        align-items:center; justify-content:center; color:#fff; font-family:sans-serif;
      `;
      loader.innerHTML = `
        <div class="pdf-loader">
          <div class="pdf-loader-icon" style="color:var(--p-gold); margin-bottom:15px; transform:scale(2);">${Icons.documento()}</div>
          <div class="pdf-loader-title">Generando PDF</div>
          <div class="pdf-loader-desc">${titulo}</div>
          <div class="pdf-loader-bar">
            <div id="pdf-progress-bar" class="pdf-loader-fill"></div>
          </div>
          <div id="pdf-progress-text" class="pdf-loader-status">PROCESANDO...</div>
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
        App.toastError('La librería de PDF no está disponible.');
        loader.remove();
        return;
      }

      updateProgress(20, 'Cargando manual...');

      // Try fetch first, fallback to Capacitor Filesystem for Android
      let html;
      try {
        const resp = await fetch(archivo);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        html = await resp.text();
      } catch (fetchErr) {
        console.warn('[PDF] fetch failed, trying Capacitor Filesystem:', fetchErr.message);
        const cap = window.Capacitor;
        const fsPlugin = cap?.Plugins?.Filesystem;
        if (fsPlugin) {
          const result = await fsPlugin.readFile({ path: archivo, directory: 'ASSETS' });
          html = result.data;
        } else {
          throw new Error('No se pudo cargar el manual: ' + fetchErr.message);
        }
      }

      updateProgress(40, 'Procesando contenido...');

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const styles = Array.from(doc.querySelectorAll('style')).map(s => s.outerHTML).join('\n');
      // Reemplazar <header> por <div> para evitar conflictos con el selector global "header" de styles.css
      const bodyContent = doc.body.innerHTML
        .replace(/<header\b/gi, '<div')
        .replace(/<\/header>/gi, '</div>');

      if (!bodyContent || bodyContent.trim().length < 50) {
        throw new Error('El contenido del manual está vacío');
      }

      // Create container - use z-index positioning under the loader overlay to prevent offscreen rendering bugs
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      container = document.createElement('div');
      container.id = 'pdf-render-container';
      container.style.cssText = `position:absolute; left:0; top:${currentScroll}px; width:800px; background:#fff; color:#000; z-index:9990; overflow:visible;`;
      container.innerHTML = styles + bodyContent;
      document.body.appendChild(container);

      // Fix image paths - use relative paths for Android WebView compatibility
      const imgs = container.querySelectorAll('img');
      imgs.forEach(img => {
        let src = img.getAttribute('src');
        if (src && !src.startsWith('http') && !src.startsWith('data:')) {
          // Normalize path: ensure manual/img/ prefix for images
          if (src.startsWith('img/')) {
            src = 'manual/' + src;
          }
          // Use relative path instead of absolute URL for Android compatibility
          img.setAttribute('src', src);
        }
      });

      // Wait for images to load
      await Promise.all(Array.from(imgs).map(img =>
        img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = () => res(); })
      ));

      // Wait for render
      await new Promise(r => setTimeout(r, 1500));

      updateProgress(80, 'Generando PDF...');
      const opt = {
        margin:       [10, 8, 10, 8],
        filename:     titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim() + '.pdf',
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          backgroundColor: '#ffffff',
          width: 800,
          scrollX: 0,
          scrollY: currentScroll,
          height: container.scrollHeight,
          windowHeight: container.scrollHeight
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
      };

      const pdfBlob = await html2pdf().set(opt).from(container).output('blob');

      // Verify PDF has content
      if (!pdfBlob || pdfBlob.size < 1000) {
        throw new Error('El PDF generado está vacío o corrupto');
      }

      updateProgress(100, '¡Listo!');
      await new Promise(r => setTimeout(r, 400));
      await ManualesView._compartirPDF(pdfBlob, opt.filename, titulo);
    } catch (e) {
      console.error('[PDF] Error:', e);
      App.toastError('Error al generar PDF: ' + e.message);
    } finally {
      if (container) container.remove();
      if (loader) loader.remove();
    }
  },

  /** Comparte/guarda el PDF generado. En Capacitor usa Filesystem(CACHE)+Share (las descargas de navegador no funcionan en el WebView). */
  async _compartirPDF(blob, fileName, titulo) {
    // 1) Capacitor nativo: escribir en CACHE y compartir (no requiere permisos)
    try {
      const cap = window.Capacitor;
      const fsPlugin = cap?.Plugins?.Filesystem;
      const sharePlugin = cap?.Plugins?.Share;
      if (fsPlugin && sharePlugin) {
        const dataUri = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
        const result = await fsPlugin.writeFile({ path: fileName, data: dataUri.split(',')[1], directory: 'CACHE' });
        await sharePlugin.share({ title: titulo, text: titulo, url: result.uri, files: [result.uri], dialogTitle: 'Compartir ' + titulo });
        App.toast('PDF listo para compartir', 'success');
        return;
      }
    } catch (e) { console.warn('[Manual Share] falló:', e?.message || e); }
    // 2) navigator.share con File (web/PWA)
    try {
      if (navigator.share) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        await navigator.share({ title: titulo, files: [file] });
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
    // 3) Fallback: descarga directa (navegador de escritorio)
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    App.toast('PDF descargado', 'success');
  },
};

window.ManualesView = ManualesView;
