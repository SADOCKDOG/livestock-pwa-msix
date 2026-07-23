/**
 * Livestock Manager - ImportadorRFID v1.0.0
 * Importación masiva desde Excel exportado por lectores RFID de campo
 * (UniTransfer/Felixcan, Rumisoft/Datamars) o por el software legacy
 * "LiveStock" (FoxPro), para animales YA dados de alta en la app.
 *
 * Alcance: Pesadas, Producción de leche (AM/PM), Tratamientos sanitarios,
 * Partos. No cubre alta de animales nuevos ni compra/venta/movimientos
 * SIGGAN — esos flujos exigen campos normativos (REGA, comprador,
 * transportista) que un Excel genérico no garantiza; forzarlos generaría
 * registros oficiales incompletos o inválidos. Ver docs/NORMATIVA-CROTAL-ESPECIE.md
 * y docs/AUDITAR/LECTOR/ para el origen de los formatos soportados.
 */
const ImportadorRFID = {
  TIPOS: {
    peso: {
      label: 'Pesadas',
      distintivos: ['peso'],
      requeridos: ['identificador', 'fecha', 'peso'],
    },
    leche: {
      label: 'Producción de leche',
      distintivos: ['litrosAM', 'litrosPM', 'litrosTotal'],
      requeridos: ['identificador', 'fecha'],
    },
    tratamiento: {
      label: 'Tratamientos sanitarios',
      distintivos: ['tipoTratamiento', 'medicamento'],
      requeridos: ['identificador', 'fecha', 'tipoTratamiento'],
    },
    parto: {
      label: 'Partos',
      distintivos: ['criasVivas', 'criasMuertas'],
      requeridos: ['identificador', 'fecha'],
    },
  },

  // Alias de cabecera normalizados (sin acentos/espacios, mayúsculas) por campo lógico.
  ALIAS_CAMPOS: {
    identificador: ['EIC', 'CODIGO', 'CODANIMAL', 'CODIGOANIMAL', 'CROTAL', 'NUMEROIDENTIFICACION', 'NUMIDENTIFICACION', 'ANIMAL', 'ANIMALID', 'ID', 'CODPESO', 'CODSEMPD', 'CODSEMVTE', 'CODIGOSEM'],
    fecha: ['FECHA', 'FECHADEALTA', 'FECPESO', 'FECPROD', 'FECHAPESAJE', 'FECHAPESO', 'FECHATRATAMIENTO', 'FECHAPARTO', 'FECPTO', 'FECHAORDENO', 'FECHAAPLICACION'],
    peso: ['PESO', 'PESOKG'],
    tipoPeso: ['TIPOPESO', 'TIPODEPESO'],
    litrosAM: ['AM', 'LITROSAM', 'MANANA', 'LITROSMANANA'],
    litrosPM: ['PM', 'LITROSPM', 'TARDE', 'LITROSTARDE'],
    litrosTotal: ['LITROSLECHE', 'LITROS', 'CANTIDADLITROS', 'LITROSTOTAL'],
    tipoTratamiento: ['TIPOTRATAMIENTO', 'TRATAMIENTO', 'TIPODETRATAMIENTO'],
    medicamento: ['MEDICAMENTO', 'PRODUCTO', 'PRINCIPIOACTIVO'],
    dosis: ['DOSIS'],
    criasVivas: ['CRIASVIVAS', 'NACIDOSVIVOS'],
    criasMuertas: ['CRIASMUERTAS', 'MUERTOS'],
    machos: ['MACHO', 'MACHOS'],
    hembras: ['HEMBRA', 'HEMBRAS'],
    observaciones: ['OBSERVACIONES', 'COMENTARIOS', 'NOTAS', 'COMPESO', 'COMPART'],
  },

  _normHeader(h) {
    return (h ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  },

  _normIdentificador(v) {
    return (v ?? '').toString().trim().toUpperCase().replace(/[\s-]/g, '');
  },

  /**
   * Lee un archivo Excel y devuelve { headers, filas } de la primera hoja.
   * filas es un array de arrays alineado con headers (sheet_to_json header:1).
   */
  async leerExcel(archivo) {
    if (!archivo) throw new Error('No se seleccionó archivo');
    const ok = await App._ensureXLSX();
    if (!ok || typeof XLSX === 'undefined') {
      throw new Error('No se pudo cargar el motor de lectura de Excel (sin conexión)');
    }
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Error leyendo el archivo'));
      reader.readAsArrayBuffer(archivo);
    });
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('El Excel no contiene hojas');
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    if (rows.length < 2) throw new Error('El Excel no tiene filas de datos (solo cabecera o vacío)');

    const headers = rows[0].map((h) => this._normHeader(h));
    const filas = rows.slice(1).filter((r) => r.some((c) => c !== '' && c !== null && c !== undefined));
    return { headers, filas, sheetName };
  },

  /**
   * Construye un mapa campoLogico -> índice de columna, según los headers detectados.
   */
  _mapearColumnas(headers) {
    const mapa = {};
    for (const [campo, alias] of Object.entries(this.ALIAS_CAMPOS)) {
      const idx = headers.findIndex((h) => alias.includes(h));
      if (idx !== -1) mapa[campo] = idx;
    }
    return mapa;
  },

  /**
   * Detecta el tipo de importación según las columnas presentes.
   * Devuelve { tipo, mapa, ambiguo, candidatos } — si ambiguo=true, el
   * llamante debe pedir confirmación manual del tipo.
   */
  detectarTipo(headers) {
    const mapa = this._mapearColumnas(headers);
    const puntuaciones = Object.entries(this.TIPOS).map(([id, def]) => {
      const tieneRequeridos = def.requeridos.every((c) => c !== 'peso' && c !== 'tipoTratamiento' ? mapa[c] !== undefined || c === 'identificador' || c === 'fecha' : mapa[c] !== undefined);
      const score = def.distintivos.filter((c) => mapa[c] !== undefined).length;
      return { id, score, tieneRequeridos, label: def.label };
    }).filter((p) => p.tieneRequeridos && p.score > 0);

    puntuaciones.sort((a, b) => b.score - a.score);

    if (puntuaciones.length === 0) {
      return { tipo: null, mapa, ambiguo: true, candidatos: [] };
    }
    const empatados = puntuaciones.filter((p) => p.score === puntuaciones[0].score);
    if (empatados.length > 1) {
      return { tipo: null, mapa, ambiguo: true, candidatos: empatados.map((p) => p.id) };
    }
    return { tipo: puntuaciones[0].id, mapa, ambiguo: false, candidatos: [puntuaciones[0].id] };
  },

  /**
   * Construye un índice normalizado(identificador) -> animal, para resolver
   * cada fila del Excel contra animales YA dados de alta en la app.
   */
  async _construirIndiceAnimales() {
    const animales = await window.Animales.list();
    const indice = new Map();
    for (const a of animales) {
      const key = this._normIdentificador(a.numero_identificacion);
      if (key) indice.set(key, a);
    }
    return indice;
  },

  _valorCelda(fila, mapa, campo) {
    const idx = mapa[campo];
    if (idx === undefined) return null;
    const v = fila[idx];
    return v === '' || v === undefined ? null : v;
  },

  _fechaISO(valor) {
    if (!valor) return null;
    if (valor instanceof Date) {
      if (isNaN(valor.getTime())) return null;
      return valor.toISOString().split('T')[0];
    }
    const d = new Date(valor);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  },

  /**
   * Procesa todas las filas de un tipo dado, escribiendo en el store
   * correspondiente vía las funciones de guardado ya existentes.
   * @returns {{total:number, ok:number, errores:Array<{fila:number, mensaje:string}>}}
   */
  async procesarImportacion(tipo, headers, filas, { onProgreso } = {}) {
    if (!this.TIPOS[tipo]) throw new Error('Tipo de importación desconocido: ' + tipo);
    const fincaId = await ErrorHandler.validateActiveFinca();
    const mapa = this._mapearColumnas(headers);
    const indiceAnimales = await this._construirIndiceAnimales();

    const resultado = { total: filas.length, ok: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numFila = i + 2; // +1 por cabecera, +1 por índice base-1 para el usuario
      const fila = filas[i];
      try {
        await this._procesarFila(tipo, fila, mapa, indiceAnimales, fincaId);
        resultado.ok++;
      } catch (e) {
        resultado.errores.push({ fila: numFila, mensaje: e?.message || String(e) });
      }
      if (onProgreso) onProgreso(i + 1, filas.length);
    }
    return resultado;
  },

  async _procesarFila(tipo, fila, mapa, indiceAnimales, fincaId) {
    const idCelda = this._valorCelda(fila, mapa, 'identificador');
    if (!idCelda) throw new Error('Falta el identificador del animal');
    const key = this._normIdentificador(idCelda);
    const animal = indiceAnimales.get(key);
    if (!animal) throw new Error(`Animal no encontrado en la app: "${idCelda}"`);

    const fechaCelda = this._valorCelda(fila, mapa, 'fecha');
    const fecha = this._fechaISO(fechaCelda);
    if (!fecha) throw new Error('Fecha inválida o ausente');

    if (tipo === 'peso') {
      const peso = Number(this._valorCelda(fila, mapa, 'peso'));
      if (!peso || isNaN(peso) || peso <= 0) throw new Error('Peso inválido o ausente');
      await window.Pesajes.registrar({
        tipo_entidad: 'animal',
        entidad_id: animal.id,
        fecha,
        valor_neto: peso,
        unidad: 'kg',
        motivo_tarea: 'control',
        rol_contable: 'INVENTARIO',
        origen_modulo: 'importador_rfid',
      });
      return;
    }

    if (tipo === 'leche') {
      const am = Number(this._valorCelda(fila, mapa, 'litrosAM'));
      const pm = Number(this._valorCelda(fila, mapa, 'litrosPM'));
      const total = Number(this._valorCelda(fila, mapa, 'litrosTotal'));
      let escrito = false;
      if (am && !isNaN(am) && am > 0) {
        await window.Produccion.saveLeche({ vacaId: animal.id, fecha, cantidad_litros: am, turno: 'AM' }, fincaId);
        escrito = true;
      }
      if (pm && !isNaN(pm) && pm > 0) {
        await window.Produccion.saveLeche({ vacaId: animal.id, fecha, cantidad_litros: pm, turno: 'PM' }, fincaId);
        escrito = true;
      }
      if (!escrito && total && !isNaN(total) && total > 0) {
        await window.Produccion.saveLeche({ vacaId: animal.id, fecha, cantidad_litros: total }, fincaId);
        escrito = true;
      }
      if (!escrito) throw new Error('Sin litros de leche válidos (AM/PM/total)');
      return;
    }

    if (tipo === 'tratamiento') {
      const tipoTratamiento = this._valorCelda(fila, mapa, 'tipoTratamiento');
      if (!tipoTratamiento) throw new Error('Falta el tipo de tratamiento');
      if (!animal.rebanoId) throw new Error('El animal no tiene rebaño asignado (requerido para el tratamiento)');
      await window.Sanitarios.save({
        rebanoId: animal.rebanoId,
        animalId: animal.id,
        tipo_tratamiento: tipoTratamiento,
        medicamento: this._valorCelda(fila, mapa, 'medicamento') || undefined,
        dosis: this._valorCelda(fila, mapa, 'dosis') || undefined,
        fecha,
      });
      return;
    }

    if (tipo === 'parto') {
      const criasVivasCol = this._valorCelda(fila, mapa, 'criasVivas');
      const machos = Number(this._valorCelda(fila, mapa, 'machos')) || 0;
      const hembras = Number(this._valorCelda(fila, mapa, 'hembras')) || 0;
      const criasVivas = criasVivasCol !== null ? Number(criasVivasCol) : machos + hembras;
      const criasMuertas = Number(this._valorCelda(fila, mapa, 'criasMuertas')) || 0;
      await window.Reproduccion.saveEvento({
        animalId: animal.id,
        tipo_evento: 'Parto',
        fecha,
        crias_vivas: isNaN(criasVivas) ? 0 : criasVivas,
        crias_muertas: isNaN(criasMuertas) ? 0 : criasMuertas,
      });
      return;
    }

    throw new Error('Tipo de importación no soportado: ' + tipo);
  },
};

window.ImportadorRFID = ImportadorRFID;
