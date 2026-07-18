/**
 * Livestock Manager - ExportService v1.2.0
 * Exportación oficial CSV/XML para REGA, SIA y PIGGAN.
 * Genera ficheros compatibles con las plataformas autonómicas (SIGGAN/BADIGEX).
 *
 * Formatos:
 *   - REGA: CSV censo actual + XML explotación
 *   - SIA:  CSV movimientos (altas/bajas/expediciones)
 *   - PIGGAN: CSV producción y tratamiento
 *
 * v1.1.0 — Capa de validación semántica antes de exportar:
 *   1. Formato estricto del código REGA (^ES\d{12}$)
 *   2. Coherencia de fechas (no futuras; movimiento ≥ nacimiento)
 *   3. Normalización a códigos oficiales (Sexo M/H, Especie canónica)
 * v1.2.0 — Modal de pre-vuelo en la UI (InformesView._preflight):
 *   - opción { skipPreflight } para que la UI sea dueña del mensaje
 *   - tabla de avisos confirmable antes de descargar; REGA inválido bloquea
 */

// ── Constantes oficiales ────────────────────────────────────────────────────
const REGA_REGEX = /^ES\d{12}$/;

// Sexo: código oficial del Ministerio (M = macho, H = hembra)
const SEXO_MAP = {
  'm': 'M', 'macho': 'M', 'male': 'M',
  'h': 'H', 'hembra': 'H', 'female': 'H'
};

// Especies admitidas (nombre canónico en minúscula)
const ESPECIES_VALIDAS = new Set([
  'bovino', 'ovino', 'caprino', 'porcino', 'equino', 'avicola', 'cunicola', 'apicola'
]);
const ESPECIE_ALIAS = {
  'vacuno': 'bovino', 'vaca': 'bovino', 'bovina': 'bovino',
  'oveja': 'ovino', 'ovina': 'ovino',
  'cabra': 'caprino', 'caprina': 'caprino',
  'cerdo': 'porcino', 'porcina': 'porcino', 'cochino': 'porcino',
  'caballo': 'equino', 'equina': 'equino',
  'ave': 'avicola', 'aves': 'avicola', 'avícola': 'avicola',
  'conejo': 'cunicola', 'cunícola': 'cunicola',
  'abeja': 'apicola', 'apícola': 'apicola'
};

// ── Helpers de formato ───────────────────────────────────────────────────────

/** Escapa un valor CSV: neutraliza saltos de línea y entrecomilla si lleva ';' o '"' */
function escCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/\r?\n|\r/g, ' ');
  return (str.includes(';') || str.includes('"')) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Normaliza una fecha a AAAA-MM-DD; devuelve '' si es inválida */
function formatFecha(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

/** Escapa caracteres especiales XML */
function escXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Helpers de normalización oficial ─────────────────────────────────────────

/** Normaliza el sexo a código oficial M/H. Devuelve '' si no se reconoce. */
function normalizarSexo(sexo) {
  if (!sexo) return '';
  return SEXO_MAP[String(sexo).trim().toLowerCase()] || '';
}

/** Normaliza el nombre de especie a su forma canónica. Devuelve '' si no es válida. */
function normalizarEspecie(especie) {
  if (!especie) return '';
  let e = String(especie).trim().toLowerCase();
  if (ESPECIE_ALIAS[e]) e = ESPECIE_ALIAS[e];
  return ESPECIES_VALIDAS.has(e) ? e : '';
}

const ExportService = {

  /**
   * CAPA DE VALIDACIÓN — comprueba reglas semánticas antes de exportar.
   * No depende de las claves de SIGGAN: aplica las reglas del sector.
   *
   * @param {object} finca
   * @param {object[]} animales
   * @param {object[]} [eventos] - movimientos opcionales para validar coherencia de fechas
   * @returns {{valido:boolean, errores:string[], avisos:string[]}}
   *   - errores: bloquean la exportación (REGA inválido)
   *   - avisos: no bloquean, pero SIGGAN podría rechazar registros concretos
   */
  validarPreExportacion(finca, animales = [], eventos = []) {
    const errores = [];
    const avisos = [];
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999); // tolerancia hasta el final del día actual

    // 1) Código REGA de la explotación
    const rega = finca?.codigo_REGA || finca?.rega || '';
    if (!rega) {
      errores.push('La finca no tiene código REGA. Es obligatorio para exportar.');
    } else if (!REGA_REGEX.test(rega)) {
      errores.push(`Código REGA inválido: "${rega}". Debe cumplir el formato ES + 12 dígitos (ej. ES041234000001).`);
    }

    // Índice de animales por id para validar movimientos
    const porId = new Map();
    (animales || []).forEach(a => porId.set(String(a.id), a));

    // 2) y 3) Validación por animal (fechas y códigos)
    (animales || []).forEach(a => {
      const ref = a.numero_identificacion || a.crotal || `#${a.id}`;
      const activo = String(a.estado).toLowerCase() === 'activo';
      if (!activo) return; // el censo solo exporta activos

      if (!a.numero_identificacion && !a.crotal) {
        avisos.push(`Animal ${ref}: sin crotal / número de identificación.`);
      }

      // 2) fecha de nacimiento no futura
      if (a.fecha_nacimiento) {
        const nac = new Date(a.fecha_nacimiento);
        if (isNaN(nac.getTime())) {
          avisos.push(`Animal ${ref}: fecha de nacimiento inválida ("${a.fecha_nacimiento}").`);
        } else if (nac > hoy) {
          avisos.push(`Animal ${ref}: fecha de nacimiento futura (${formatFecha(a.fecha_nacimiento)}).`);
        }
      } else {
        avisos.push(`Animal ${ref}: sin fecha de nacimiento.`);
      }

      // 3) códigos oficiales
      if (!normalizarSexo(a.sexo)) {
        avisos.push(`Animal ${ref}: sexo no reconocido ("${a.sexo || ''}"); debe ser macho/hembra.`);
      }
      if (a.especie && !normalizarEspecie(a.especie)) {
        avisos.push(`Animal ${ref}: especie no reconocida ("${a.especie}").`);
      }
    });

    // 2) coherencia de fechas de movimiento
    (eventos || []).forEach(e => {
      if (!e.fecha) return;
      const fmov = new Date(e.fecha);
      if (isNaN(fmov.getTime())) {
        avisos.push(`Movimiento (${e.id || '?'}): fecha inválida ("${e.fecha}").`);
        return;
      }
      if (fmov > hoy) {
        avisos.push(`Movimiento (${e.id || '?'}): fecha futura (${formatFecha(e.fecha)}).`);
      }
      const a = porId.get(String(e.animal_id || e.entidad_id || e.animalId));
      if (a?.fecha_nacimiento) {
        const nac = new Date(a.fecha_nacimiento);
        if (!isNaN(nac.getTime()) && fmov < nac) {
          const ref = a.numero_identificacion || a.crotal || `#${a.id}`;
          avisos.push(`Movimiento de ${ref}: fecha (${formatFecha(e.fecha)}) anterior al nacimiento (${formatFecha(a.fecha_nacimiento)}).`);
        }
      }
    });

    return { valido: errores.length === 0, errores, avisos };
  },

  /**
   * Genera un informe REGA (censo actual) en CSV
   * @param {object} finca - datos de la finca activa
   * @param {object[]} animales - todos los animales
   * @param {object[]} rebanos - todos los rebaños
   * @returns {string} contenido CSV
   */
  generarCSV_CensoREGA(finca, animales, rebanos) {
    const activos = animales.filter(a => String(a.estado).toLowerCase() === 'activo');

    // Cabecera del fichero con datos de explotación
    const lines = [];
    lines.push(';;;EXPORTACION REGA - CENSO GANADERO;;;');
    lines.push(`EXPLOTACION;;${escCsv(finca?.nombre)};;`);
    lines.push(`REGA;;${escCsv(finca?.codigo_REGA || finca?.rega)};;`);
    lines.push(`CEA;;${escCsv(finca?.cea)};;`);
    lines.push(`PROPIETARIO;;${escCsv(finca?.propietario_nombre || finca?.nombre)};;`);
    lines.push(`NIF;;${escCsv(finca?.nif)};;`);
    lines.push(`MUNICIPIO;;${escCsv(finca?.municipio)};;`);
    lines.push(`PROVINCIA;;${escCsv(finca?.provincia)};;`);
    lines.push(`COMUNIDAD;;${escCsv(finca?.comunidad_autonoma)};;`);
    lines.push(`ADSG;;${escCsv(finca?.adsg_nombre)};;`);
    lines.push(`VETERINARIO;;${escCsv(finca?.adsg_veterinario)};;`);
    lines.push(`FECHA_EXPORTACION;;${formatFecha(new Date())};;`);
    lines.push('');

    // Resumen por especie
    lines.push(';;RESUMEN POR ESPECIE;;');
    lines.push('ESPECIE;REBAÑO;ACTIVOS;HEMBRAS;MACHOS;BAJAS_ANIO');
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const especies = [...new Set(activos.map(a => a.especie || 'Sin especie'))];
    especies.forEach(esp => {
      const deEsp = activos.filter(a => (a.especie || 'Sin especie') === esp);
      const rebanosDeEsp = rebanos.filter(r => r.especie === esp || deEsp.some(a => a.rebanoId === r.id));
      (rebanosDeEsp.length ? rebanosDeEsp : [{ nombre: 'General' }]).forEach(rb => {
        const deRb = rb.id ? deEsp.filter(a => a.rebanoId === rb.id) : deEsp;
        const hembras = deRb.filter(a => normalizarSexo(a.sexo) === 'H').length;
        const machos = deRb.filter(a => normalizarSexo(a.sexo) === 'M').length;
        const bajas = animales.filter(a =>
          String(a.estado).toLowerCase() === 'baja' &&
          a.fecha_baja && new Date(a.fecha_baja) >= yearAgo
        ).length;
        lines.push([
          escCsv(normalizarEspecie(esp) || esp),
          escCsv(rb.nombre),
          deRb.length, hembras, machos, bajas
        ].join(';'));
      });
    });

    lines.push('');
    lines.push(`TOTAL_ACTIVOS;;${activos.length};;`);
    lines.push('');
    lines.push(';;DETALLE ANIMALES ACTIVOS;;');
    lines.push('ID;CROTAL;ESPECIE;RAZA;SEXO;FECHA_NAC;EDAD_MESES;REBAÑO;CATEGORIA;PESO_ACTUAL;DIB;NOTIFICADO_REGA');
    activos.forEach(a => {
      const nac = a.fecha_nacimiento ? new Date(a.fecha_nacimiento) : null;
      const edadMeses = (nac && !isNaN(nac.getTime())) ? Math.max(0, Math.floor((now - nac) / (1000 * 60 * 60 * 24 * 30.44))) : 0;
      const rb = rebanos.find(r => r.id === a.rebanoId);
      lines.push([
        escCsv(a.id),
        escCsv(a.numero_identificacion),
        escCsv(normalizarEspecie(a.especie) || a.especie || ''),
        escCsv(a.raza),
        normalizarSexo(a.sexo),
        formatFecha(a.fecha_nacimiento),
        edadMeses,
        escCsv(rb?.nombre),
        escCsv(a.categoria),
        escCsv(a.peso_actual),
        escCsv(a.dib),
        a.notificado_rega ? 'SI' : 'NO'
      ].join(';'));
    });

    return '﻿' + lines.join('\r\n'); // BOM UTF-8 para Excel
  },

  /**
   * Genera XML de explotación para REGA (formato compatible con SIGGAN/BADIGEX)
   * @param {object} finca
   * @param {object[]} animales
   * @param {object[]} rebanos
   * @returns {string} XML
   */
  generarXML_REGA(finca, animales, rebanos) {
    const activos = animales.filter(a => String(a.estado).toLowerCase() === 'activo');
    const now = formatFecha(new Date());
    const especiesAgrupadas = {};
    activos.forEach(a => {
      const esp = normalizarEspecie(a.especie) || a.especie || 'Sin especie';
      if (!especiesAgrupadas[esp]) especiesAgrupadas[esp] = [];
      especiesAgrupadas[esp].push(a);
    });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<REGA_Exportacion fecha="${now}" version="1.1">\n`;
    xml += `  <Explotacion>\n`;
    xml += `    <Nombre>${escXml(finca?.nombre || '')}</Nombre>\n`;
    xml += `    <REGA>${escXml(finca?.codigo_REGA || finca?.rega || '')}</REGA>\n`;
    xml += `    <CEA>${escXml(finca?.cea || '')}</CEA>\n`;
    xml += `    <NIF>${escXml(finca?.nif || '')}</NIF>\n`;
    xml += `    <Propietario>${escXml(finca?.propietario_nombre || finca?.nombre || '')}</Propietario>\n`;
    xml += `    <Municipio>${escXml(finca?.municipio || '')}</Municipio>\n`;
    xml += `    <Provincia>${escXml(finca?.provincia || '')}</Provincia>\n`;
    xml += `    <ComunidadAutonoma>${escXml(finca?.comunidad_autonoma || '')}</ComunidadAutonoma>\n`;
    xml += `    <TipoExplotacion>${escXml(finca?.tipo_explotacion || '')}</TipoExplotacion>\n`;
    xml += `    <SistemaExplotacion>${escXml(finca?.sistema_explotacion || '')}</SistemaExplotacion>\n`;
    if (finca?.adsg_nombre) {
      xml += `    <ADSG>\n`;
      xml += `      <Nombre>${escXml(finca.adsg_nombre)}</Nombre>\n`;
      xml += `      <Codigo>${escXml(finca.adsg_codigo || '')}</Codigo>\n`;
      xml += `      <Veterinario>${escXml(finca.adsg_veterinario || '')}</Veterinario>\n`;
      xml += `      <VetColegiado>${escXml(finca.adsg_vet_colegiado || '')}</VetColegiado>\n`;
      xml += `      <Vencimiento>${formatFecha(finca.adsg_fecha_vencimiento)}</Vencimiento>\n`;
      xml += `    </ADSG>\n`;
    }
    xml += `  </Explotacion>\n`;
    xml += `  <Censo>\n`;

    Object.entries(especiesAgrupadas).forEach(([especie, ejemplares]) => {
      xml += `    <Especie nombre="${escXml(especie)}">\n`;
      const porCategoria = {};
      ejemplares.forEach(a => {
        const cat = a.categoria || 'Sin categoría';
        if (!porCategoria[cat]) porCategoria[cat] = [];
        porCategoria[cat].push(a);
      });
      Object.entries(porCategoria).forEach(([categoria, animalesCat]) => {
        xml += `      <Categoria nombre="${escXml(categoria)}" total="${animalesCat.length}">\n`;
        animalesCat.forEach(a => {
          xml += `        <Animal>\n`;
          xml += `          <ID>${escXml(a.numero_identificacion || '#' + a.id)}</ID>\n`;
          xml += `          <Crotal>${escXml(a.numero_identificacion || '')}</Crotal>\n`;
          xml += `          <Raza>${escXml(a.raza || '')}</Raza>\n`;
          xml += `          <Sexo>${normalizarSexo(a.sexo)}</Sexo>\n`;
          xml += `          <FechaNacimiento>${formatFecha(a.fecha_nacimiento)}</FechaNacimiento>\n`;
          xml += `          <DIB>${escXml(a.dib || '')}</DIB>\n`;
          xml += `          <NotificadoREGA>${a.notificado_rega ? 'SI' : 'NO'}</NotificadoREGA>\n`;
          xml += `          <Estado>activo</Estado>\n`;
          xml += `        </Animal>\n`;
        });
        xml += `      </Categoria>\n`;
      });
      xml += `    </Especie>\n`;
    });

    xml += `    <Totales>\n`;
    xml += `      <TotalAnimales>${activos.length}</TotalAnimales>\n`;
    xml += `    </Totales>\n`;
    xml += `  </Censo>\n`;
    xml += `</REGA_Exportacion>\n`;
    return xml;
  },

  /**
   * Genera CSV de movimientos (altas/bajas/expediciones) para SIA/PIGGAN
   * @param {object[]} eventos - registro_eventos
   * @param {object[]} animales
   * @param {object} finca
   * @returns {string} CSV
   */
  generarCSV_Movimientos(eventos, animales, finca) {
    const lines = [];
    lines.push(';;;EXPORTACION MOVIMIENTOS SIA/PIGGAN;;;');
    lines.push(`EXPLOTACION;;${escCsv(finca?.nombre)};;`);
    lines.push(`REGA;;${escCsv(finca?.codigo_REGA || finca?.rega)};;`);
    lines.push('');

    lines.push('FECHA;TIPO_MOVIMIENTO;ANIMAL_ID;CROTAL;ESPECIE;MOTIVO;DESTINO_ORIGEN;OBSERVACIONES');
    const sorted = [...(eventos || [])]
      .filter(e => e.fecha)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    sorted.forEach(e => {
      const a = animales.find(an => an.id === e.animal_id || an.id === e.entidad_id);
      const tipo = e.motivo_tarea || e.tipo || 'no especificado';
      lines.push([
        formatFecha(e.fecha),
        escCsv(tipo),
        escCsv(e.animal_id || e.entidad_id),
        escCsv(a?.numero_identificacion || e.crotal),
        escCsv(normalizarEspecie(a?.especie) || a?.especie || ''),
        escCsv(e.motivo || tipo),
        escCsv(e.destino || e.origen),
        escCsv(e.descripcion || e.notas)
      ].join(';'));
    });

    return '﻿' + lines.join('\r\n');
  },

  /**
   * Genera CSV de producción (leche y carne) compatible con sistemas de calidad
   * @param {object[]} produccionesLeche
   * @param {object[]} produccionesCarne
   * @returns {string} CSV
   */
  generarCSV_Produccion(produccionesLeche, produccionesCarne) {
    const lines = [];
    lines.push(';;;EXPORTACION PRODUCCION PIGGAN;;;');
    lines.push('');

    if (produccionesLeche?.length) {
      lines.push(';;PRODUCCION LECHE;;');
      lines.push('FECHA;LITROS;GRASA%;PROTEINA%;CELULAS_SOMATICAS;EXTRACTO_SECO;DESTINO');
      produccionesLeche.forEach(p => {
        lines.push([
          formatFecha(p.fechaRecogida || p.fecha),
          escCsv(p.litros || 0),
          escCsv(p.grasa),
          escCsv(p.proteina),
          escCsv(p.celulas_somaticas),
          (parseFloat(p.grasa || 0) + parseFloat(p.proteina || 0)).toFixed(2),
          escCsv(p.destino || p.comprador)
        ].join(';'));
      });
      lines.push('');
    }

    if (produccionesCarne?.length) {
      lines.push(';;PRODUCCION CARNE;;');
      lines.push('FECHA;ANIMAL;PESO_CANAL(kg);CATEGORIA;PRECIO_UNITARIO;TOTAL;MATADERO');
      produccionesCarne.forEach(p => {
        lines.push([
          formatFecha(p.fechaSacrificio || p.fecha),
          escCsv(p.animalId),
          escCsv(p.peso_canal),
          escCsv(p.categoria || p.seurop),
          escCsv(p.precio_unitario),
          escCsv(p.precio_total),
          escCsv(p.codigoMatadero)
        ].join(';'));
      });
    }

    return '﻿' + lines.join('\r\n');
  },

  /**
   * Descarga/comparte un fichero — primero intenta Capacitor nativo, luego fallback blob
   * @param {string} content - contenido del fichero
   * @param {string} filename - nombre del fichero
   * @param {string} mime - tipo MIME
   */
   async descargar(content, filename, mime = 'text/csv;charset=utf-8') {
    if (window.PremiumManager && window.PremiumManager.isFree()) {
      if (window.App?.toast) App.toast('La exportación solo está disponible en Premium', 'error');
      return;
    }
    // 1️⃣ Capacitor Filesystem + Share (funciona en Android nativo)
    try {
      const cap = window.Capacitor;
      const fsPlugin = cap?.Plugins?.Filesystem;
      const sharePlugin = cap?.Plugins?.Share;
      if (fsPlugin && sharePlugin) {
        // Convertir string a base64
        const encoder = new TextEncoder();
        const bytes = encoder.encode(content);
        let binary = '';
        bytes.forEach(b => { binary += String.fromCharCode(b); });
        const base64 = btoa(binary);

        const result = await fsPlugin.writeFile({
          path: filename,
          data: base64,
          directory: 'CACHE'
        });
        await sharePlugin.share({
          title: filename,
          text: `Exportación: ${filename}`,
          url: result.uri,
          files: [result.uri],
          dialogTitle: `Compartir ${filename} con…`
        });
        App.toast(`${filename} compartido`, 'success');
        return;
      }
    } catch (e) {
      console.warn(`[ExportService] Capacitor falló:`, e?.message || e);
    }

    // 2️⃣ Fallback: blob download (funciona en navegador)
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    App.toast(`${filename} descargado`, 'success');
  },

  /**
   * Informa al usuario de errores/avisos de validación.
   * @returns {boolean} true si se puede continuar exportando
   */
  _reportarValidacion(reporte) {
    if (reporte.avisos.length) {
      console.warn(`[ExportService] ${reporte.avisos.length} aviso(s) de validación:`, reporte.avisos);
    }
    if (!reporte.valido) {
      const msg = reporte.errores[0];
      console.error('[ExportService] Exportación bloqueada:', reporte.errores);
      if (window.App?.toast) App.toast(`${msg}`, 'error');
      return false;
    }
    if (reporte.avisos.length && window.App?.toast) {
      App.toast(`Exportado con ${reporte.avisos.length} aviso(s). Revisa la consola.`, 'warning');
    }
    return true;
  },

  /**
   * Exportación completa REGA (CSV + XML) con descarga directa.
   * Bloquea si el código REGA no es válido.
   * @param {object} [opts] - { skipPreflight } omite la validación interna
   *   cuando la capa de UI ya la ha mostrado y confirmado.
   */
  async exportarREGA(finca, animales, rebanos, opts = {}) {
    if (!opts.skipPreflight) {
      const reporte = this.validarPreExportacion(finca, animales);
      if (!this._reportarValidacion(reporte)) {
        return { success: false, errores: reporte.errores, avisos: reporte.avisos };
      }
    }

    const csv = this.generarCSV_CensoREGA(finca, animales, rebanos);
    const xml = this.generarXML_REGA(finca, animales, rebanos);
    const rega = finca?.codigo_REGA || finca?.rega || 'unknown';
    const fecha = formatFecha(new Date());

    await this.descargar(csv, `REGA_Censo_${rega}_${fecha}.csv`, 'text/csv;charset=utf-8');
    await this.descargar(xml, `REGA_Explotacion_${rega}_${fecha}.xml`, 'application/xml;charset=utf-8');
    return { success: true, csv, xml };
  },

  /**
   * Exportación movimientos SIA/PIGGAN. Bloquea si el código REGA no es válido.
   * @param {object} [opts] - { skipPreflight } omite la validación interna.
   */
  async exportarMovimientos(eventos, animales, finca, opts = {}) {
    if (!opts.skipPreflight) {
      const reporte = this.validarPreExportacion(finca, animales, eventos);
      if (!this._reportarValidacion(reporte)) {
        return { success: false, errores: reporte.errores, avisos: reporte.avisos };
      }
    }

    const csv = this.generarCSV_Movimientos(eventos, animales, finca);
    const rega = finca?.codigo_REGA || finca?.rega || 'unknown';
    await this.descargar(csv, `Movimientos_SIA_${rega}_${formatFecha(new Date())}.csv`);
    return { success: true, csv };
  },

  /**
   * Exportación producción PIGGAN
   */
  async exportarProduccion(produccionesLeche, produccionesCarne) {
    const csv = this.generarCSV_Produccion(produccionesLeche, produccionesCarne);
    await this.descargar(csv, `Produccion_PIGGAN_${formatFecha(new Date())}.csv`);
    return { success: true, csv };
  },

  /**
   * Exportación completa (todo en uno)
   * @param {object} [opts] - { skipPreflight } omite la validación interna.
   */
  async exportarCompleto(finca, animales, rebanos, eventos, prodLeche, prodCarne, opts = {}) {
    const rega = await this.exportarREGA(finca, animales, rebanos, opts);
    if (!rega.success) return rega; // REGA inválido: abortar todo
    await this.exportarMovimientos(eventos, animales, finca, { skipPreflight: true });
    await this.exportarProduccion(prodLeche, prodCarne);
    return { success: true };
  }
};

window.ExportService = ExportService;
