/**
 * Livestock Manager - ComunidadesService v1.0.0
 * Constantes autonómicas y funciones de configuración para
 * normativa de Andalucía y Extremadura en ovino de leche.
 *
 * Referencia normativa:
 *   - Decreto 14/2006 (Andalucía) — distancias mínimas 500m
 *   - Decreto 163/2022 (Extremadura) — distancias mínimas 1000m
 *   - Paquete Lácteo UE — contratos obligatorios, INFOLAC, Letra Q
 *   - LIGAL — umbrales de calidad para ovino de leche
 */

window.ComunidadesService = (() => {
  'use strict';

  // ============================================================
  // 1. CONFIGURACIÓN POR COMUNIDAD AUTÓNOMA
  // ============================================================
  const COMUNIDADES = Object.freeze({
    andalucia: Object.freeze({
      label: 'Andalucía',
      provincias: Object.freeze(['Huelva', 'Sevilla', 'Cádiz', 'Córdoba', 'Jaén', 'Málaga', 'Granada', 'Almería']),
      codigo_provincia_prefijo: '21',           // Huelva
      // Códigos INE de provincia (2 dígitos) usados en el código REGA oficial
      codigos_provincia_INE: Object.freeze({
        'Almería': '04', 'Cádiz': '11', 'Córdoba': '14', 'Granada': '18',
        'Huelva': '21', 'Jaén': '23', 'Málaga': '29', 'Sevilla': '41',
      }),
      distancia_minima_REGA_m: 500,             // Decreto 14/2006
      umbral_PAC_corderos_oveja: 0.6,           // 0.6 corderos/oveja/año
      sistema_movimiento: 'SIGGAN',             // Sistema Integrado de Gestión Ganadera
      plataforma_tramitacion: 'PIMA',
      url_tramitacion: 'https://www.juntadeandalucia.es/servicios/sede/tramites/procedimientos/detalle/146.html',
      guia_automatica_si_saneada: true,         // Emisión guía 365 días si explotación saneada
      compensacion_vacunacion: 'directa',       // Ayudas directas Junta para vacunas
      adsg_subvencion: 'alta',                  // ADSG subvenciona vacunas
      formulario_crotales: 'SIGGAN',            // Sistema de pedido de crotales
      requiere_desinsectacion_movimiento: true, // Certificar desinsectación 48h previas
      rega_obligatorio: true,                   // SIGGAN exige REGA para operar
      requiere_guia_movimiento: true,           // Guía de origen y sanidad pecuaria obligatoria
    }),

    extremadura: Object.freeze({
      label: 'Extremadura',
      provincias: Object.freeze(['Badajoz', 'Cáceres']),
      codigo_provincia_prefijo: '06',           // Badajoz
      codigos_provincia_INE: Object.freeze({ 'Badajoz': '06', 'Cáceres': '10' }),
      distancia_minima_REGA_m: 1000,            // Decreto 163/2022
      umbral_PAC_corderos_oveja: 0.4,           // 0.4 corderos/oveja/año
      sistema_movimiento: 'BADIGEX',            // Base de Datos Identificación Ganadera Extremadura
      plataforma_tramitacion: 'Arado/Laboreo',
      url_tramitacion: 'https://doe.juntaex.es/pdfs/doe/2023/60o/23040002.pdf',
      guia_automatica_si_saneada: false,        // Requiere confirmación previa
      compensacion_vacunacion: 'fuerza_mayor',  // Cláusulas de fuerza mayor PAC
      adsg_subvencion: 'media',                 // Control estricto ADSG
      formulario_crotales: 'BADIGEX',           // Sistema de pedido de crotales
      requiere_desinsectacion_movimiento: true, // + restricción movimientos nocturnos
      rega_obligatorio: false,
      requiere_guia_movimiento: true,
    }),
  });

  // ============================================================
  // 1.b. CATÁLOGOS SIGGAN (Junta de Andalucía)
  // ============================================================

  // Tipos/clasificación de explotación según REGA (RD 479/2004 y normativa SIGGAN)
  const TIPOS_EXPLOTACION_REGA = Object.freeze([
    'Producción y reproducción',
    'Reproducción para abasto',
    'Reproducción para selección',
    'Recría de novillas',
    'Cebo o engorde (Cebadero)',
    'Tratante u operador comercial',
    'Centro de tipificación',
    'Pasto / aprovechamiento estacional',
    'Autoconsumo',
    'Especial (mixta)',
  ]);

  // Clasificación zootécnica
  const CLASIFICACION_ZOOTECNICA = Object.freeze([
    'Intensivo',
    'Extensivo',
    'Semiextensivo',
    'Trashumante / trasterminante',
  ]);

  // Especies autorizables en la explotación (para REGA)
  const ESPECIES_AUTORIZABLES = Object.freeze([
    'Bovino', 'Ovino', 'Caprino', 'Porcino', 'Equino', 'Avícola', 'Apícola',
  ]);

  // Especies que requieren documento de identificación individual tipo pasaporte/DIB
  const ESPECIES_CON_DIB = Object.freeze(['Bovino', 'Equino']);

  // Países de nacimiento más habituales (código ISO + etiqueta) para el libro de registro
  const PAISES_NACIMIENTO = Object.freeze([
    { value: 'ES', label: 'España (ES)' },
    { value: 'PT', label: 'Portugal (PT)' },
    { value: 'FR', label: 'Francia (FR)' },
    { value: 'DE', label: 'Alemania (DE)' },
    { value: 'NL', label: 'Países Bajos (NL)' },
    { value: 'IE', label: 'Irlanda (IE)' },
    { value: 'IT', label: 'Italia (IT)' },
    { value: 'OTRO', label: 'Otro' },
  ]);

  // Motivos de baja en el libro de registro (SIGGAN)
  const MOTIVOS_BAJA = Object.freeze([
    { value: 'muerte', label: 'Muerte en la explotación', sandach_categoria: 1 },
    { value: 'sacrificio', label: 'Sacrificio en matadero', sandach_categoria: null },
    { value: 'sacrificio_obligatorio', label: 'Sacrificio obligatorio (saneamiento)', sandach_categoria: 2 },
    { value: 'venta', label: 'Venta / salida a otra explotación', sandach_categoria: null },
    { value: 'desaparicion', label: 'Desaparición / robo', sandach_categoria: 1 },
    { value: 'autoconsumo', label: 'Sacrificio domiciliario (autoconsumo)', sandach_categoria: 3 },
    { value: 'otro', label: 'Otro', sandach_categoria: 1 },
  ]);

  // Formas de alta en el censo (libro de registro SIGGAN / RD 787/2023)
  const TIPOS_ALTA = Object.freeze([
    { value: 'Nacimiento', label: 'Nacimiento en la explotación' },
    { value: 'Compra', label: 'Compra / entrada nacional' },
    { value: 'Importación', label: 'Importación (intracomunitaria / país tercero)' },
    { value: 'Traslado', label: 'Traslado desde otra explotación propia' },
  ]);

  // Categorías zootécnicas del animal por especie (clasificación del libro de registro)
  const CATEGORIAS_ANIMAL = Object.freeze({
    bovino: Object.freeze(['Ternero/a (<8 meses)', 'Añojo/a (8-12 meses)', 'Novillo/a (12-24 meses)', 'Vaca', 'Toro semental', 'Buey']),
    ovino: Object.freeze(['Cordero/a (<4 meses)', 'Ternasco / Recental', 'Borrego/a (4-12 meses)', 'Oveja', 'Carnero semental']),
    caprino: Object.freeze(['Cabrito/a (<4 meses)', 'Chivo/a (4-12 meses)', 'Cabra', 'Macho cabrío semental']),
    porcino: Object.freeze(['Lechón', 'Cerdo de cebo', 'Cerda reproductora', 'Verraco semental']),
    equino: Object.freeze(['Potro/a (<12 meses)', 'Yegua', 'Caballo / Semental', 'Castrado']),
    otro: Object.freeze(['Cría', 'Reproductor/a', 'Cebo / engorde', 'Otro']),
  });

  // Motivos de movimiento inter-explotación (guía de origen y sanidad pecuaria)
  const MOTIVOS_MOVIMIENTO = Object.freeze([
    { value: 'vida', label: 'Vida / reproducción' },
    { value: 'cebo', label: 'Cebo / engorde' },
    { value: 'matadero', label: 'Sacrificio (matadero)' },
    { value: 'pasto', label: 'Pasto / aprovechamiento' },
    { value: 'concentracion', label: 'Concentración / certamen' },
    { value: 'tratante', label: 'Operador comercial / tratante' },
    { value: 'otro', label: 'Otro' },
  ]);

  // Campañas oficiales de saneamiento ganadero (ADSG / Junta de Andalucía)
  const CAMPANAS_SANEAMIENTO = Object.freeze([
    { value: 'tuberculosis', label: 'Tuberculosis bovina (TBC)', especies: ['Bovino', 'Caprino'] },
    { value: 'brucelosis_b', label: 'Brucelosis bovina (B. abortus)', especies: ['Bovino'] },
    { value: 'brucelosis_om', label: 'Brucelosis ovina y caprina (B. melitensis)', especies: ['Ovino', 'Caprino'] },
    { value: 'leucosis', label: 'Leucosis enzoótica bovina (LEB)', especies: ['Bovino'] },
    { value: 'perineumonia', label: 'Perineumonía contagiosa bovina (PPCB)', especies: ['Bovino'] },
    { value: 'lengua_azul', label: 'Lengua azul (vacunación obligatoria)', especies: ['Bovino', 'Ovino', 'Caprino'] },
    { value: 'otra', label: 'Otra campaña', especies: ESPECIES_AUTORIZABLES },
  ]);

  // Vías de administración del medicamento (Libro de Tratamientos Veterinarios SIGGAN)
  const VIAS_ADMINISTRACION = Object.freeze([
    { value: 'intramuscular', label: 'Intramuscular (IM)' },
    { value: 'subcutanea', label: 'Subcutánea (SC)' },
    { value: 'intravenosa', label: 'Intravenosa (IV)' },
    { value: 'oral', label: 'Oral / en pienso o agua' },
    { value: 'topica', label: 'Tópica / pour-on' },
    { value: 'intramamaria', label: 'Intramamaria' },
    { value: 'intrauterina', label: 'Intrauterina' },
    { value: 'ocular', label: 'Ocular' },
    { value: 'otra', label: 'Otra' },
  ]);

  // Motivos / diagnóstico del tratamiento (Libro de Tratamientos Veterinarios SIGGAN)
  const MOTIVOS_TRATAMIENTO = Object.freeze([
    { value: 'profilaxis', label: 'Profilaxis / prevención' },
    { value: 'vacunacion', label: 'Vacunación programada' },
    { value: 'desparasitacion', label: 'Desparasitación' },
    { value: 'infeccion', label: 'Proceso infeccioso' },
    { value: 'mamitis', label: 'Mamitis' },
    { value: 'podal', label: 'Proceso podal / cojeras' },
    { value: 'reproductivo', label: 'Trastorno reproductivo' },
    { value: 'metabolico', label: 'Trastorno metabólico / nutricional' },
    { value: 'lesion', label: 'Lesión / traumatismo' },
    { value: 'otro', label: 'Otro' },
  ]);

  // Calificaciones sanitarias de la explotación (resultado de saneamiento)
  const CALIFICACIONES_SANITARIAS = Object.freeze([
    { value: 'indemne', label: 'Oficialmente indemne (T3/M3/B4)', color: 'var(--c-success)' },
    { value: 'calificada', label: 'Calificada', color: 'var(--c-info)' },
    { value: 'en_proceso', label: 'En proceso de calificación', color: 'var(--c-warning)' },
    { value: 'positiva', label: 'Con positivos / inmovilizada', color: 'var(--c-danger)' },
    { value: 'sin_calificar', label: 'Sin calificar', color: '#888888' },
  ]);

  // ============================================================
  // 2. ESTRUCTURA DE COSTES LÁCTEOS (Referencia sectorial)
  // ============================================================
  const COSTES_LECHE_REF = Object.freeze({
    alimentacion:     Object.freeze({ pct: 55,  '€_por_litro': 0.66, indicador: 'g pienso / L producido', objetivo: '<450g/L', categoria_gasto: 'Alimentacion' }),
    mano_obra:        Object.freeze({ pct: 18,  '€_por_litro': 0.21, indicador: 'L / hora trabajo',        objetivo: '-' }),
    sanidad:          Object.freeze({ pct: 12,  '€_por_litro': 0.14, indicador: 'tasa reposición %',       objetivo: '20-25%', categoria_gasto: 'Sanidad' }),
    energeticos:      Object.freeze({ pct: 8,   '€_por_litro': 0.10, indicador: 'kW / L enfriado',         objetivo: '<4°C', categoria_gasto: 'Electricidad' }),
    amortizacion:     Object.freeze({ pct: 7,   '€_por_litro': 0.09, indicador: 'coste estructura fijo/L', objetivo: '-', categoria_gasto: 'Amortizacion' }),
    total:            Object.freeze({ pct: 100, '€_por_litro': 1.20 }),
  });

  // ============================================================
  // 3. ESTADOS DE ANALÍTICA DE LECHE
  // ============================================================
  const ESTADOS_ANALITICA_LECHE = Object.freeze({
    PENDIENTE:      Object.freeze({ label: 'Pendiente',      color: 'var(--c-warning)', icon: null }),
    EN_ANALISIS:    Object.freeze({ label: 'En Análisis',    color: 'var(--c-info)', icon: null }),
    VALIDADO:       Object.freeze({ label: 'Validado',       color: 'var(--c-success)', icon: null }),
    ALERTA_CRITICA: Object.freeze({ label: 'Alerta Crítica', color: 'var(--c-danger)', icon: null }),
    RECHAZADO:      Object.freeze({ label: 'Rechazado',      color: '#dc2626', icon: null }),
  });

  // ============================================================
  // 4. UMBRALES DE CALIDAD — Ovino de Leche (Referencia LIGAL)
  // ============================================================
  const CALIDAD_LECHE_OVINO_UMBRALES = Object.freeze({
    grasa:         Object.freeze({ min: 6.0,  max: 8.5,  optimo: 7.2, unidad: '%' }),
    proteina:      Object.freeze({ min: 5.0,  max: 6.5,  optimo: 5.8, unidad: '%' }),
    extracto_seco: Object.freeze({ min: 11.0, max: 15.0, optimo: 13.0, unidad: '%' }),
    somaticas:     Object.freeze({ max: 400000,           optimo: '<200000', unidad: 'cel/mL' }),
    bacterias:     Object.freeze({ max: 1500000,          optimo: '<500000', unidad: 'UFC/mL' }),
    temperatura:   Object.freeze({ max: 4,                optimo: '<2',      unidad: '°C' }),
    antibioticos:  Object.freeze({ permitido: false }),
  });

  // ============================================================
  // 5. MOTIVOS DE RECHAZO DE LECHE
  // ============================================================
  const MOTIVOS_RECHAZO_LECHE = Object.freeze([
    'antibioticos',
    'temperatura_superior',
    'celulas_somaticas_elevadas',
    'carga_bacteriana_elevada',
    'inhibidores',
    'mastitis',
    'calostro',
    'otro',
  ]);

  // ============================================================
  // 6. TIPOS DE EXPLOTACIÓN / SISTEMAS
  // ============================================================
  const TIPOS_EXPLOTACION = Object.freeze(['carne', 'leche', 'mixto', 'ibérico']);
  const SISTEMAS_EXPLOTACION = Object.freeze(['intensivo', 'extensivo', 'semiextensivo']);

  // ============================================================
  // 7. PRECIOS DE REFERENCIA — Liquidación por Extracto Seco
  // ============================================================
  const PRECIO_EXTRACTO_SECO_REF = Object.freeze({
    precio_base_referencia: 0.45,            // €/L base contractual
    precio_por_punto_extracto: 0.045,        // €/punto sobre el precio base
    prima_calidad_extra: 0.02,               // €/L extra si cumple TODOS los umbrales
    penalizacion_somaticas: -0.03,           // €/L si >400.000 cél/mL
    penalizacion_bacterias: -0.02,           // €/L si >1.500.000 UFC/mL
    tasa_INLAC_defecto: 0.0012,              // Tasa mensual estándar INFOLAC
  });

  // ============================================================
  // FUNCIONES PÚBLICAS
  // ============================================================

  /**
   * Obtiene la configuración completa de una comunidad autónoma
   * @param {'andalucia'|'extremadura'} ccaa
   * @returns {object|undefined}
   */
  function getConfiguracionCCAA(ccaa) {
    return COMUNIDADES[ccaa] || undefined;
  }

  /**
   * Obtiene las dos comunidades disponibles
   * @returns {object}
   */
  function getComunidades() {
    return { ...COMUNIDADES };
  }

  /**
   * Obtiene las opciones para un select de comunidad autónoma
   * @returns {Array<{value:string, label:string}>}
   */
  function getOpcionesComunidad() {
    return [
      { value: 'andalucia', label: 'Andalucía' },
      { value: 'extremadura', label: 'Extremadura' },
    ];
  }

  /**
   * Retorna la plataforma de movimiento de ganado (SIGGAN / BADIGEX)
   * @param {'andalucia'|'extremadura'} ccaa
   * @returns {string}
   */
  function getPlataformaMovimiento(ccaa) {
    const conf = COMUNIDADES[ccaa];
    return conf ? conf.sistema_movimiento : 'No configurado';
  }

  // ============================================================
  // FUNCIONES SIGGAN — REGA, EXPLOTACIÓN, MOVIMIENTOS, SANEAMIENTO
  // ============================================================

  /** Indica si el REGA es obligatorio para la comunidad indicada */
  function esREGAObligatorio(ccaa) {
    const conf = COMUNIDADES[ccaa];
    return conf ? !!conf.rega_obligatorio : false;
  }

  /** Indica si los movimientos inter-explotación requieren guía oficial */
  function requiereGuiaMovimiento(ccaa) {
    const conf = COMUNIDADES[ccaa];
    return conf ? !!conf.requiere_guia_movimiento : true;
  }

  /**
   * Normaliza un código REGA quitando separadores y pasando a mayúsculas.
   * @param {string} rega
   * @returns {string}
   */
  function normalizarREGA(rega) {
    return (rega || '').toString().trim().toUpperCase().replace(/[\s./_]+/g, '');
  }

  /**
   * Valida el formato oficial del código REGA (RD 479/2004).
   * Estructura: ES + provincia(2 dígitos INE) + municipio(3 dígitos) +
   * secuencial(7 dígitos). Total 14 dígitos tras el prefijo "ES".
   * Para Andalucía además comprueba que la provincia INE sea de la comunidad.
   * @param {string} rega
   * @param {'andalucia'|'extremadura'|null} ccaa
   * @returns {{valido:boolean, mensaje:string, provinciaINE?:string}}
   */
  function validarFormatoREGA(rega, ccaa = null) {
    const limpio = normalizarREGA(rega);
    if (!limpio) return { valido: false, mensaje: 'El código REGA está vacío.' };

    const re = /^ES(\d{2})(\d{3})(\d{7})$/;
    const m = limpio.match(re);
    if (!m) {
      return {
        valido: false,
        mensaje: 'Formato REGA inválido. Debe ser ES + 2 díg. provincia + 3 díg. municipio + 7 díg. secuencial (ej: ES041230000123).',
      };
    }

    const provinciaINE = m[1];
    const conf = ccaa ? COMUNIDADES[ccaa] : null;
    if (conf && conf.codigos_provincia_INE) {
      const validas = Object.values(conf.codigos_provincia_INE);
      if (!validas.includes(provinciaINE)) {
        return {
          valido: false,
          mensaje: `La provincia (${provinciaINE}) del REGA no pertenece a ${conf.label}.`,
          provinciaINE,
        };
      }
    }
    return { valido: true, mensaje: 'Código REGA válido.', provinciaINE };
  }

  /** Devuelve el código INE de una provincia (busca en todas las comunidades) */
  function getCodigoProvinciaINE(provincia) {
    for (const conf of Object.values(COMUNIDADES)) {
      if (conf.codigos_provincia_INE && conf.codigos_provincia_INE[provincia]) {
        return conf.codigos_provincia_INE[provincia];
      }
    }
    return null;
  }

  /** Lista de provincias de una comunidad */
  function getProvincias(ccaa) {
    const conf = COMUNIDADES[ccaa];
    return conf ? [...conf.provincias] : [];
  }

  /** Catálogo de tipos de explotación REGA */
  function getTiposExplotacionREGA() { return [...TIPOS_EXPLOTACION_REGA]; }

  /** Catálogo de clasificación zootécnica */
  function getClasificacionZootecnica() { return [...CLASIFICACION_ZOOTECNICA]; }

  /** Catálogo de especies autorizables */
  function getEspeciesAutorizables() { return [...ESPECIES_AUTORIZABLES]; }

  /** Indica si una especie requiere DIB/pasaporte individual */
  function especieRequiereDIB(especie) {
    if (!especie) return false;
    const norm = especie.toString().trim().toLowerCase();
    // Sinónimos habituales en la app (config_especies usa "Vacas", etc.)
    const bovino = ['bovino', 'vacuno', 'vaca', 'toro', 'buey', 'ternero', 'novillo', 'añojo'];
    const equino = ['equino', 'caballo', 'yegua', 'potro', 'equido', 'équido'];
    return [...bovino, ...equino].some(k => norm.includes(k));
  }

  /** Catálogo de países de nacimiento */
  function getPaisesNacimiento() { return PAISES_NACIMIENTO.map(p => ({ ...p })); }

  /** Catálogo de motivos de baja */
  function getMotivosBaja() { return MOTIVOS_BAJA.map(m => ({ ...m })); }

  /** Obtener categoría SANDACH (Reg. UE 1069/2009) a partir de motivo de baja */
  function getSANDACHCategoria(motivoBaja) {
    if (!motivoBaja) return null;
    const motivo = MOTIVOS_BAJA.find(m => m.value === motivoBaja);
    return motivo ? motivo.sandach_categoria : null;
  }

  /** Descripción de categoría SANDACH */
  function getSANDACHDescripcion(categoria) {
    const descs = {
      1: 'Categoría I (Subproductos SPA de mayor riesgo: muerte, desaparición)',
      2: 'Categoría II (Subproductos SPA de riesgo medio: sacrificio por saneamiento)',
      3: 'Categoría III (Subproductos SPA de menor riesgo: autoconsumo)',
    };
    return descs[categoria] || null;
  }

  /** Catálogo de formas de alta en el censo (libro de registro) */
  function getTiposAlta() { return TIPOS_ALTA.map(t => ({ ...t })); }

  /** Normaliza una especie (con sinónimos) a su grupo zootécnico */
  function getGrupoEspecie(especie) {
    const n = (especie || '').toString().trim().toLowerCase();
    if (/(bovin|vacun|vaca|toro|buey|ternero|ternera|novill|añojo|anojo|becerr)/.test(n)) return 'bovino';
    if (/(ovin|oveja|cordero|borrego|carnero|ternasco|recental)/.test(n)) return 'ovino';
    if (/(caprin|cabra|cabrito|chivo|macho cabr)/.test(n)) return 'caprino';
    if (/(porcin|cerd|lech[oó]n|verraco|cochin|guarro|marran)/.test(n)) return 'porcino';
    if (/(equin|équid|equid|caballo|yegua|potro|mula|asno|burro)/.test(n)) return 'equino';
    return 'otro';
  }

  /** Catálogo de categorías zootécnicas válidas para una especie */
  function getCategoriasAnimal(especie) {
    const grupo = getGrupoEspecie(especie);
    return [...(CATEGORIAS_ANIMAL[grupo] || CATEGORIAS_ANIMAL.otro)];
  }

  /** Catálogo de motivos de movimiento */
  function getMotivosMovimiento() { return MOTIVOS_MOVIMIENTO.map(m => ({ ...m })); }

  /** Catálogo de campañas de saneamiento */
  function getCampanasSaneamiento() { return CAMPANAS_SANEAMIENTO.map(c => ({ ...c })); }
  /** Catálogo de calificaciones sanitarias */
  function getCalificacionesSanitarias() { return CALIFICACIONES_SANITARIAS.map(c => ({ ...c })); }
  /** Catálogo de vías de administración (libro de tratamientos) */
  function getViasAdministracion() { return VIAS_ADMINISTRACION.map(v => ({ ...v })); }
  /** Catálogo de motivos/diagnóstico de tratamiento (libro de tratamientos) */
  function getMotivosTratamiento() { return MOTIVOS_TRATAMIENTO.map(m => ({ ...m })); }
  /** Etiqueta legible de una vía de administración a partir de su valor */
  function getViaAdministracionLabel(value) {
    if (!value) return '';
    const v = VIAS_ADMINISTRACION.find(x => x.value === value);
    return v ? v.label : value;
  }
  /** Etiqueta legible de un motivo/diagnóstico de tratamiento a partir de su valor */
  function getMotivoTratamientoLabel(value) {
    if (!value) return '';
    const m = MOTIVOS_TRATAMIENTO.find(x => x.value === value);
    return m ? m.label : value;
  }

  /**
   * Retorna el umbral PAC de corderos/oveja/año
   * @param {'andalucia'|'extremadura'} ccaa
   * @returns {number}
   */
  function getUmbralPAC(ccaa) {
    const conf = COMUNIDADES[ccaa];
    return conf ? conf.umbral_PAC_corderos_oveja : 0;
  }

  /**
   * Retorna la distancia mínima REGA entre explotaciones
   * @param {'andalucia'|'extremadura'} ccaa
   * @returns {number} metros
   */
  function getDistanciaMinimaREGA(ccaa) {
    const conf = COMUNIDADES[ccaa];
    return conf ? conf.distancia_minima_REGA_m : 0;
  }

  /**
   * Obtiene los costes de referencia para ovino de leche
   * @returns {object}
   */
  function getCostesLecheReferencia() {
    return { ...COSTES_LECHE_REF };
  }

  /**
   * Obtiene tabla de costes formateada para visualización
   * @returns {Array<{categoria:string, pct:number, €_por_litro:number, indicador:string, objetivo:string}>}
   */
  function getTablaCostesLeche() {
    const keys = Object.keys(COSTES_LECHE_REF).filter(k => k !== 'total');
    return keys.map(k => ({
      categoria: k,
      pct: COSTES_LECHE_REF[k].pct,
      '€_por_litro': COSTES_LECHE_REF[k]['€_por_litro'],
      indicador: COSTES_LECHE_REF[k].indicador,
      objetivo: COSTES_LECHE_REF[k].objetivo,
    }));
  }

  /**
   * Obtiene la configuración de estados analíticos
   * @returns {object}
   */
  function getEstadosAnalitica() {
    return { ...ESTADOS_ANALITICA_LECHE };
  }

  /**
   * Obtiene un estado analítico por su clave
   * @param {string} key — PENDIENTE|EN_ANALISIS|VALIDADO|ALERTA_CRITICA|RECHAZADO
   * @returns {object|undefined}
   */
  function getEstadoAnalitica(key) {
    return ESTADOS_ANALITICA_LECHE[key] || undefined;
  }

  /**
   * Obtiene todos los umbrales de calidad para ovino de leche
   * @returns {object}
   */
  function getUmbralesCalidad() {
    return { ...CALIDAD_LECHE_OVINO_UMBRALES };
  }

  /**
   * Evalúa la calidad de un análisis de leche contra los umbrales
   * @param {object} lab — { grasa, proteina, somaticas, germenes, antibioticos, temperatura }
   * @returns {{ apto: boolean, alertas: string[], badges: object[] }}
   */
  function evaluarCalidadLeche(lab) {
    const alertas = [];
    const badges = [];

    if (!lab) return { apto: false, alertas: ['Sin datos de laboratorio'], badges: [] };

    if (lab.antibioticos) {
      alertas.push('ANTIBIÓTICOS DETECTADOS — LECHE NO APTA');
      badges.push({ label: 'Antibióticos', color: '#dc2626', tipo: 'critico' });
    }

    if (lab.grasa != null) {
      if (lab.grasa < CALIDAD_LECHE_OVINO_UMBRALES.grasa.min) {
        alertas.push(`Grasa baja (${lab.grasa}% < ${CALIDAD_LECHE_OVINO_UMBRALES.grasa.min}%)`);
        badges.push({ label: `Grasa ${lab.grasa}%`, color: 'var(--c-warning)', tipo: 'alerta' });
      } else {
        badges.push({ label: `Grasa ${lab.grasa}%`, color: 'var(--c-success)', tipo: 'ok' });
      }
    }

    if (lab.proteina != null) {
      if (lab.proteina < CALIDAD_LECHE_OVINO_UMBRALES.proteina.min) {
        alertas.push(`Proteína baja (${lab.proteina}% < ${CALIDAD_LECHE_OVINO_UMBRALES.proteina.min}%)`);
        badges.push({ label: `Proteína ${lab.proteina}%`, color: 'var(--c-warning)', tipo: 'alerta' });
      } else {
        badges.push({ label: `Proteína ${lab.proteina}%`, color: 'var(--c-success)', tipo: 'ok' });
      }
    }

    if (lab.somaticas != null && lab.somaticas > CALIDAD_LECHE_OVINO_UMBRALES.somaticas.max) {
      alertas.push(`Células somáticas elevadas (${lab.somaticas.toLocaleString()} > ${CALIDAD_LECHE_OVINO_UMBRALES.somaticas.max.toLocaleString()})`);
      badges.push({ label: `CS ${(lab.somaticas / 1000).toFixed(0)}k`, color: 'var(--c-danger)', tipo: 'alerta' });
    }

    if (lab.germenes != null && lab.germenes > CALIDAD_LECHE_OVINO_UMBRALES.bacterias.max) {
      alertas.push(`Carga bacteriana elevada (${lab.germenes.toLocaleString()} UFC)`);
      badges.push({ label: `UFC ${(lab.germenes / 1000).toFixed(0)}k`, color: 'var(--c-danger)', tipo: 'alerta' });
    }

    const apto = alertas.length === 0 || !lab.antibioticos;
    return { apto, alertas, badges };
  }

  /**
   * Calcula el extracto seco (grasa + proteína)
   * @param {number} grasa
   * @param {number} proteina
   * @returns {number}
   */
  function calcularExtractoSeco(grasa, proteina) {
    if (grasa == null || proteina == null) return 0;
    return parseFloat((grasa + proteina).toFixed(2));
  }

  /**
   * Calcula el precio final unitario de la leche según extracto seco
   * @param {object} params
   * @param {number} params.precioBase — €/L base
   * @param {number} params.extractoSeco — grasa% + proteina%
   * @param {number} params.precioExtracto — €/punto extracto
   * @param {number} params.tasaINLAC — tasa mensual
   * @param {number} params.primasPenalizaciones — +/- ajuste calidad
   * @returns {number}
   */
  function calcularPrecioFinalUnitario({ precioBase, extractoSeco, precioExtracto, tasaINLAC, primasPenalizaciones }) {
    const base = parseFloat(precioBase) || 0;
    const extracto = parseFloat(extractoSeco) || 0;
    const pExtracto = parseFloat(precioExtracto) || 0;
    const tasa = parseFloat(tasaINLAC) || 0;
    const primas = parseFloat(primasPenalizaciones) || 0;

    return parseFloat((base + (extracto * pExtracto) - tasa + primas).toFixed(4));
  }

  /**
   * Calcula el MOFA (Margen sobre Coste de Alimentación)
   * MOFA = Ingresos totales - Coste alimentación del período
   * @param {number} importeTotal — ingresos del período
   * @param {number} costeAlimentacion — coste alimentación del período
   * @returns {number}
   */
  function calcularMOFA(importeTotal, costeAlimentacion) {
    return parseFloat(((importeTotal || 0) - (costeAlimentacion || 0)).toFixed(2));
  }

  /**
   * Genera un badge HTML para estado analítico
   * @param {string} estado — clave del estado
   * @returns {string}
   */
  function badgeEstadoAnalitica(estado) {
    const cfg = ESTADOS_ANALITICA_LECHE[estado] || ESTADOS_ANALITICA_LECHE.PENDIENTE;
    let iconSVG = '';
    if (window.Icons) {
      if (estado === 'PENDIENTE') iconSVG = Icons.calendar();
      else if (estado === 'VALIDADO') iconSVG = Icons.check();
      else if (estado === 'ALERTA_CRITICA') iconSVG = Icons.alerta();
      else if (estado === 'RECHAZADO') iconSVG = Icons.cerrar();
      else iconSVG = Icons.info();
    }
    return `<span style="font-size:0.68rem; font-weight:900; padding:4px 10px; border-radius:6px;
             background:${cfg.color}20; color:#ffffff !important; border:1px solid ${cfg.color}60;
             display:inline-flex; align-items:center; justify-content:center; gap:6px;
             text-transform:uppercase; letter-spacing:0.4px; width:100%; box-sizing:border-box; text-align:center;">
             <span style="color:${cfg.color}; display:flex;">${iconSVG}</span> ${cfg.label}</span>`;
  }

  /**
   * Genera badges HTML para los resultados de calidad
   * @param {object} lab — datos de laboratorio
   * @returns {string}
   */
  function badgesCalidadLeche(lab) {
    if (!lab) return '';
    const { badges } = evaluarCalidadLeche(lab);
    return badges.map(b =>
      `<span style="font-size:0.65rem; font-weight:800; padding:4px 10px; border-radius:6px;
               background:${b.color}20; color:#ffffff !important; border:1px solid ${b.color}60;
               text-transform:uppercase; letter-spacing:0.4px; display:inline-flex; align-items:center; justify-content:center; width:100%; box-sizing:border-box; text-align:center;">${b.label}</span>`
    ).join('');
  }

  // API pública
  return {
    COMUNIDADES,
    COSTES_LECHE_REF,
    ESTADOS_ANALITICA_LECHE,
    CALIDAD_LECHE_OVINO_UMBRALES,
    MOTIVOS_RECHAZO_LECHE,
    TIPOS_EXPLOTACION,
    SISTEMAS_EXPLOTACION,
    PRECIO_EXTRACTO_SECO_REF,
    TIPOS_EXPLOTACION_REGA,
    CLASIFICACION_ZOOTECNICA,
    ESPECIES_AUTORIZABLES,
    ESPECIES_CON_DIB,
    PAISES_NACIMIENTO,
    MOTIVOS_BAJA,
    TIPOS_ALTA,
    CATEGORIAS_ANIMAL,
    MOTIVOS_MOVIMIENTO,
    CAMPANAS_SANEAMIENTO,
    CALIFICACIONES_SANITARIAS,
    VIAS_ADMINISTRACION,
    MOTIVOS_TRATAMIENTO,
    getConfiguracionCCAA,
    getComunidades,
    getOpcionesComunidad,
    getPlataformaMovimiento,
    esREGAObligatorio,
    requiereGuiaMovimiento,
    normalizarREGA,
    validarFormatoREGA,
    getCodigoProvinciaINE,
    getProvincias,
    getTiposExplotacionREGA,
    getClasificacionZootecnica,
    getEspeciesAutorizables,
    especieRequiereDIB,
    getPaisesNacimiento,
    getMotivosBaja,
    getTiposAlta,
    getGrupoEspecie,
    getCategoriasAnimal,
    getMotivosMovimiento,
    getCampanasSaneamiento,
    getCalificacionesSanitarias,
    getViasAdministracion,
    getMotivosTratamiento,
    getViaAdministracionLabel,
    getMotivoTratamientoLabel,
    getSANDACHCategoria,
    getSANDACHDescripcion,
    getUmbralPAC,
    getDistanciaMinimaREGA,
    getCostesLecheReferencia,
    getTablaCostesLeche,
    getEstadosAnalitica,
    getEstadoAnalitica,
    getUmbralesCalidad,
    evaluarCalidadLeche,
    calcularExtractoSeco,
    calcularPrecioFinalUnitario,
    calcularMOFA,
    badgeEstadoAnalitica,
    badgesCalidadLeche,
  };
})();
