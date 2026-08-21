/**
 * Livestock Manager - Parser de PDF del Catastro (SIGPAC) v1.0.0
 *
 * Extrae los datos de una parcela desde el PDF oficial "Consulta descriptiva y
 * gráfica de datos catastrales" (sede.catastro.gob.es), que es el que se obtiene
 * siguiendo el flujo del manual: SIGPAC → Catastro → Imprimir datos → Guardar PDF.
 *
 * Portado del módulo equivalente de Cork Manager, ya probado en producción allí.
 * Adaptado a Livestock: script clásico (no ES module), superficies convertidas a
 * hectáreas además de los m² literales, y sin los campos propios del corcho.
 *
 * DEPENDENCIA: pdf.js, que se carga bajo demanda desde CDN la primera vez que se
 * usa (mismo patrón que html2pdf/xlsx en app.js). La app es offline-first: si no
 * hay red, `asegurarPdfJs()` devuelve false y la vista debe avisar al usuario en
 * vez de fallar en silencio.
 *
 * El parseo está separado en dos capas a propósito:
 *   - `extraerLineas` + `parsearCatastro` son PURAS (solo texto), así que se
 *     pueden probar fuera del navegador contra PDFs reales.
 *   - `renderizarCroquis` necesita canvas y vive aparte.
 */
(function () {
  'use strict';

  const PDFJS_CDN = 'js/vendor/pdf.min.mjs';
  const PDFJS_WORKER = '/js/vendor/pdf.worker.min.mjs';

  let _cargaPdfJs = null;

  /**
   * Carga pdf.js bajo demanda. Devuelve false si no se pudo (típicamente, sin red).
   * Servido en local (js/vendor): la app es offline-first y la 3.11.174
   * del CDN arrastraba GHSA-wgrm-67xf-hhpq.
   */
  async function asegurarPdfJs() {
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return true;
    }
    if (!_cargaPdfJs) {
      // pdf.js 4.x es un modulo ES: no vale <script src>, hay que importarlo
      // y publicar el namespace como pdfjsLib para el resto del fichero.
      _cargaPdfJs = import('/js/vendor/pdf.min.mjs').then((mod) => { window.pdfjsLib = mod; return mod; });
    }
    try {
      await _cargaPdfJs;
    } catch (_) {
      _cargaPdfJs = null; // permitir reintento cuando vuelva la conexión
      return false;
    }
    if (typeof pdfjsLib === 'undefined') return false;
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return true;
  }

  /**
   * Reconstruye las líneas de texto del PDF agrupando los items por coordenada Y
   * y ordenándolos por X. Sin esto, el texto del Catastro llega desordenado por
   * su maquetación en columnas y ninguna expresión regular acierta.
   * @param {Object} pdf - documento pdf.js
   * @returns {Promise<string[]>}
   */
  async function extraerLineas(pdf) {
    const lineas = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const pagina = await pdf.getPage(p);
      const contenido = await pagina.getTextContent();
      const grupos = {};
      for (const item of contenido.items) {
        if (!item.str || !item.str.trim()) continue;
        // Se redondea la Y a múltiplos de 2 para tolerar diferencias de baseline
        // entre items de la misma línea visual.
        const y = Math.round(item.transform[5] / 2) * 2;
        const x = item.transform[4];
        (grupos[y] = grupos[y] || []).push({ x, str: item.str });
      }
      const ys = Object.keys(grupos).map(Number).sort((a, b) => b - a);
      for (const y of ys) {
        const linea = grupos[y]
          .sort((a, b) => a.x - b.x)
          .map(i => i.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (linea) lineas.push(linea);
      }
    }
    return lineas;
  }

  /**
   * Convierte una superficie del PDF a número. En el Catastro el punto es
   * separador de miles y la coma decimal ("55.460,25" -> 55460.25).
   */
  function parsearSuperficie(str) {
    if (!str) return null;
    const limpio = String(str).replace(/\./g, '').replace(',', '.');
    const n = parseFloat(limpio);
    return Number.isFinite(n) ? n : null;
  }

  /** m² -> hectáreas, redondeado a 4 decimales (1 ha = 10.000 m²). */
  function m2AHectareas(m2) {
    if (!Number.isFinite(m2)) return null;
    return Math.round((m2 / 10000) * 10000) / 10000;
  }

  /**
   * Parsea las líneas ya reconstruidas. Función PURA: sin DOM, sin pdf.js.
   * @param {string[]} lineas
   * @returns {Object} datos de la parcela
   */
  function parsearCatastro(lineas) {
    const d = {
      refCatastral: null,
      poligono: null, parcela: null,
      paraje: null, municipio: null, provincia: null,
      localizacion: null,
      clase: null, usoPrincipal: null,
      superficieGrafica: null, superficieConstruida: null,
      anoConstruccion: null,
      cultivos: [], construcciones: []
    };

    const texto = lineas.join('\n');

    // Referencia catastral: rústica (5 díg + letra + 12 díg + 2 letras) o urbana.
    const ref = texto.match(/[0-9]{5}[A-Z][0-9]{12}[A-Z]{2}/i) ||
                texto.match(/[0-9]{7}[A-Z]{2}[0-9]{4}[A-Z][0-9]{4}[A-Z]{2}/i);
    if (ref) d.refCatastral = ref[0].toUpperCase();

    const pol = texto.match(/Pol[íi]gono\s+(\d+)\s+Parcela\s+(\d+)/i);
    if (pol) {
      d.poligono = parseInt(pol[1], 10);
      d.parcela = parseInt(pol[2], 10);
    }

    // Localización, paraje, municipio y provincia: se buscan en las líneas
    // siguientes a la de "Polígono X Parcela Y".
    for (let i = 0; i < lineas.length; i++) {
      if (!/Pol[íi]gono\s+\d+\s+Parcela\s+\d+/i.test(lineas[i])) continue;

      d.localizacion = (i > 0 && /Localizaci[óo]n/i.test(lineas[i - 1]))
        ? lineas[i - 1].replace(/Localizaci[óo]n:?\s*/i, '').trim() + ' ' + lineas[i]
        : lineas[i];

      for (let j = i + 1; j < Math.min(i + 8, lineas.length); j++) {
        const m = lineas[j].match(
          /^([A-ZÁÉÍÓÚÑa-zñáéíóú\s\-,]+?)\.\s*([A-ZÁÉÍÓÚÑa-zñáéíóú\s\-,]+?)\s*\(([A-ZÁÉÍÓÚÑa-zñáéíóú\s]+)\)/
        );
        if (m) {
          d.paraje = m[1].trim();
          d.municipio = m[2].trim();
          d.provincia = m[3].trim();
          d.localizacion += ' ' + lineas[j];
          break;
        }
      }
      if (d.paraje) break;
    }

    const clase = texto.match(/Clase\s+(R[úu]stico|Urbano|BICE|Agrario|Industrial)/i);
    if (clase) d.clase = clase[1];

    // Espacio literal en la clase, NO \s: con \s la captura se comía el salto de
    // línea y arrastraba el encabezado siguiente ("Agrario\nPARC" en 9 de los 11
    // PDFs de prueba). Este defecto venía del parser original de Cork.
    const uso = texto.match(/Uso\s+principal\s+([A-ZÁÉÍÓÚÑa-zñáéíóú ]{3,20})/i);
    if (uso) d.usoPrincipal = uso[1].trim();

    const sup = texto.match(/Superficie\s+gr[áa]fica\s+([\d.,]+)/i);
    if (sup) d.superficieGrafica = parsearSuperficie(sup[1]);

    const supC = texto.match(/Superficie\s+construida\s+([\d.,]+)/i);
    if (supC) d.superficieConstruida = parsearSuperficie(supC[1]);

    const ano = texto.match(/A[ñn]o\s+construcci[óo]n\s+(\d{4})/i);
    if (ano) d.anoConstruccion = parseInt(ano[1], 10);

    // CULTIVOS SIGPAC: "a FE Encinar 02 55.460"
    const iCultivo = lineas.findIndex(l => /^CULTIVO/i.test(l.trim()));
    if (iCultivo >= 0) {
      for (let i = iCultivo + 1; i < lineas.length; i++) {
        const l = lineas[i].trim();
        if (/^(CONSTRUCCI|PARCELA)/i.test(l)) break;
        if (!l || /^Subparcela/i.test(l)) continue;
        const m = l.match(/^([a-z0-9])\s+(.+?)\s+(\d{2})\s+([\d.,]+)\s*$/i);
        if (m) {
          d.cultivos.push({
            letra: m[1].toLowerCase(),
            cultivo: m[2].trim(),
            intensidad: m[3],
            superficie: parsearSuperficie(m[4])
          });
        }
      }
    }

    // CONSTRUCCIONES: "USO ESCALERA PLANTA PUERTA SUPERFICIE"
    const iConst = lineas.findIndex(l => /^CONSTRUCCI[ÓO]N/i.test(l.trim()));
    if (iConst >= 0) {
      for (let i = iConst + 1; i < lineas.length; i++) {
        const l = lineas[i].trim();
        if (/^(CULTIVO|PARCELA)/i.test(l)) break;
        if (!l || /^(Subparcela|Uso)/i.test(l)) continue;
        const m = l.match(/^([A-ZÁÉÍÓÚÑ\s]+?)\s+(\d+)\s+(\w{1,3})\s+(\w{1,3})\s+([\d.,]+)\s*$/);
        if (m) {
          d.construcciones.push({
            uso: m[1].trim(),
            escalera: m[2],
            planta: m[3],
            puerta: m[4],
            superficie: parsearSuperficie(m[5])
          });
        }
      }
    }

    return d;
  }

  /**
   * Renderiza una página a PNG. Necesita canvas, por eso vive fuera del parseo.
   * @returns {Promise<Blob|null>}
   */
  async function renderizarCroquis(pdf, numPagina = 1) {
    try {
      const pagina = await pdf.getPage(numPagina);
      const viewport = pagina.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      return await new Promise(r => canvas.toBlob(r, 'image/png'));
    } catch (e) {
      console.warn('[PdfCatastro] No se pudo renderizar el croquis:', e);
      return null;
    }
  }

  /**
   * Punto de entrada: procesa un PDF del Catastro y devuelve los datos listos
   * para revisar antes de guardarlos en finca.zonas[].
   *
   * @param {File|Blob} archivo
   * @returns {Promise<Object>} { ok, motivo?, datos? }
   */
  async function importar(archivo) {
    if (!(await asegurarPdfJs())) {
      return { ok: false, motivo: 'sin-pdfjs' };
    }

    let pdf;
    try {
      const buffer = await archivo.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    } catch (e) {
      return { ok: false, motivo: 'pdf-ilegible', detalle: e.message };
    }

    const lineas = await extraerLineas(pdf);

    // Un PDF escaneado no tiene capa de texto: no hay nada que parsear y conviene
    // decirlo con claridad en vez de devolver una parcela vacía.
    if (lineas.length === 0) {
      return { ok: false, motivo: 'sin-texto' };
    }

    const d = parsearCatastro(lineas);

    if (!d.refCatastral && d.poligono == null) {
      return { ok: false, motivo: 'no-es-catastro', lineasLeidas: lineas.length };
    }

    const croquis = await renderizarCroquis(pdf, 1);

    return {
      ok: true,
      datos: {
        // Nombre lo decide el usuario en la pantalla de revisión.
        nombre: '',
        refCatastral: d.refCatastral,
        poligono: d.poligono,
        parcela: d.parcela,
        paraje: d.paraje,
        municipio: d.municipio,
        provincia: d.provincia,
        localizacion: d.localizacion,
        clase: d.clase,
        usoPrincipal: d.usoPrincipal,
        // La app trabaja en hectáreas; se conservan los m² literales del Catastro.
        superficieGrafica: d.superficieGrafica,
        superficie: m2AHectareas(d.superficieGrafica),
        superficieConstruida: d.superficieConstruida || 0,
        anoConstruccion: d.anoConstruccion,
        cultivos: d.cultivos,
        construcciones: d.construcciones
      },
      croquisBlob: croquis
    };
  }

  window.PdfCatastro = {
    importar,
    asegurarPdfJs,
    // Expuestas para las pruebas y para reutilizarlas desde otros módulos.
    extraerLineas,
    parsearCatastro,
    parsearSuperficie,
    m2AHectareas
  };
})();
