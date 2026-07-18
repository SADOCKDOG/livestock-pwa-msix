/**
 * LIFESTOCK MANAGER - MOTOR DE REGLAS DE NEGOCIO Y TRAZABILIDAD (v3.3.5 Premium)
 * Módulo centralizado para la ejecución de validaciones sanitarias, comerciales, analíticas e importación de backups.
 */

const MotorTrazabilidad = {
  // =========================================================================
  // REGLA SANITARIA: CONTROL DE PERIODOS DE SUPRESIÓN (checkSupresion)
  // =========================================================================
  async checkSupresion(db, animalId, fechaEvaluar, tipoDestino) {
    try {
      const fechaTarget = new Date(fechaEvaluar);
      if (isNaN(fechaTarget)) {
        throw new Error(
          "La fecha proporcionada para la evaluación de seguridad alimentaria no es válida."
        );
      }

      // Use promise-based transaction API
      const transaction = db.transaction(["sanitarios_ganado", "animales"], "readonly");
      const sanitariosStore = transaction.objectStore("sanitarios_ganado");
      const animalesStore = transaction.objectStore("animales");

      // Get the animal
      const animal = await animalesStore.get(animalId);
      if (!animal) {
        return {
          apto: false,
          motivo:
            "Error de consistencia: El animal no existe en la base de datos activa.",
        };
      }

      const rebanoId = animal.rebanoId;
      let fechaMaximaBloqueo = new Date(0);
      let medicamentoCausal = null;

      // Get all sanitarios records - primero por animal, luego por rebaño si existe
      let allRecords = [];

      // Buscar por animalId directamente
      try {
        const animalIndex = sanitariosStore.index("animalId");
        const animalCursor = await animalIndex.openCursor(IDBKeyRange.only(Number(animalId)));
        let c = animalCursor;
        while (c) {
          allRecords.push(c.value);
          c = await c.continue();
        }
      } catch(e) { /* índice animalId puede no existir */ }

      // Buscar por rebaño si existe
      if (rebanoId) {
        try {
          const sanitariosIndex = sanitariosStore.index("rebanoId");
          const sanitariosCursor = await sanitariosIndex.openCursor(IDBKeyRange.only(Number(rebanoId)));
          let c = sanitariosCursor;
          while (c) {
            if (!allRecords.some(r => r.id === c.value.id)) {
              allRecords.push(c.value);
            }
            c = await c.continue();
          }
        } catch(e) { /* sin índice rebanoId */ }
      }

      // Process all collected records
      for (const registro of allRecords) {
          if (tipoDestino === "leche" && (registro.prohibidoLeche === true || parseInt(registro.tiempo_espera_leche_dias) === 999)) {
            fechaMaximaBloqueo = new Date(8640000000000000); // Fecha máxima permitida en JS
            medicamentoCausal = registro.medicamento;
            break; // Bloqueo permanente para leche, salir del bucle
          }

          const diasEspera =
            tipoDestino === "leche"
              ? parseInt(registro.tiempo_espera_leche_dias || 0)
              : parseInt(registro.tiempo_espera_carne_dias || 0);
          const fechaAplicacion = new Date(registro.fecha);
          const fechaAltaConsumo = new Date(fechaAplicacion);
          fechaAltaConsumo.setDate(fechaAltaConsumo.getDate() + diasEspera);
          if (fechaAltaConsumo > fechaMaximaBloqueo) {
            fechaMaximaBloqueo = new Date(fechaAltaConsumo);
            medicamentoCausal = registro.medicamento;
          }
        }

      // Determine result
      if (fechaMaximaBloqueo.getTime() === 8640000000000000) {
        return {
          apto: false,
          motivo: `BLOQUEO SANITARIO PERMANENTE: El animal fue tratado con [${medicamentoCausal}], el cual está estrictamente prohibido para producción láctea.`,
          fechaLiberacion: 'Nunca',
          diasRestantes: '∞',
        };
      } else if (fechaTarget < fechaMaximaBloqueo) {
        const diffTime = Math.abs(fechaMaximaBloqueo - fechaTarget);
        const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          apto: false,
          motivo: `BLOQUEO SANITARIO ACTIVO: El ganado se encuentra bajo periodo de supresión alimentaria debido al medicamento [${medicamentoCausal}].`,
          fechaLiberacion: fechaMaximaBloqueo.toISOString().split("T")[0],
          diasRestantes: diasRestantes,
        };
      } else {
        return {
          apto: true,
          motivo:
            "Validación Correcta: El animal se encuentra libre de compromisos sanitarios.",
          fechaLiberacion: null,
          diasRestantes: 0,
        };
      }
    } catch (error) {
      // Reject with wrapped error to maintain compatibility
      return Promise.reject(error);
    }
  },

  /**
   * Version sincrona de checkSupresion para listados (tarjetas): recibe los
   * registros de sanitarios_ganado ya cargados en memoria (una sola consulta
   * para toda la lista) en vez de golpear IndexedDB por cada animal.
   * Devuelve el peor caso entre carne y leche para mostrar de un vistazo.
   */
  calcularSupresionRapida(animalId, rebanoId, sanitariosAll, fechaEvaluar = new Date()) {
    const registros = (sanitariosAll || []).filter(s =>
      Number(s.animalId) === Number(animalId) || (rebanoId && Number(s.rebanoId) === Number(rebanoId))
    );
    if (!registros.length) return { activo: false, diasRestantes: 0, tipo: null, permanente: false };

    let permanenteLeche = false;
    let peorFecha = new Date(0);
    let peorTipo = null;
    let peorMedicamento = null;

    for (const r of registros) {
      if (r.prohibidoLeche === true || parseInt(r.tiempo_espera_leche_dias) === 999) {
        permanenteLeche = true;
        peorMedicamento = r.medicamento;
      }
      for (const [tipo, campo] of [['carne', 'tiempo_espera_carne_dias'], ['leche', 'tiempo_espera_leche_dias']]) {
        const dias = parseInt(r[campo] || 0);
        if (!dias) continue;
        const fechaFin = new Date(r.fecha);
        fechaFin.setDate(fechaFin.getDate() + dias);
        if (fechaFin > peorFecha) {
          peorFecha = fechaFin;
          peorTipo = tipo;
          peorMedicamento = r.medicamento;
        }
      }
    }

    if (permanenteLeche) {
      return { activo: true, diasRestantes: Infinity, tipo: 'leche', permanente: true, medicamento: peorMedicamento };
    }
    if (peorFecha > fechaEvaluar) {
      const diasRestantes = Math.ceil((peorFecha - fechaEvaluar) / (1000 * 60 * 60 * 24));
      return { activo: true, diasRestantes, tipo: peorTipo, permanente: false, medicamento: peorMedicamento };
    }
    return { activo: false, diasRestantes: 0, tipo: null, permanente: false };
  },

  // =========================================================================
  // MÓDULO 1: RENDIMIENTO INDUSTRIAL DE LA CANAL (calcularRendimiento)
  // =========================================================================
  calcularRendimiento(pesoVivo, pesoCanal) {
    const vivo = parseFloat(pesoVivo);
    const canal = parseFloat(pesoCanal);
    if (isNaN(vivo) || isNaN(canal) || vivo <= 0) return 0.0;
    if (canal >= vivo) {
      throw new Error(
        "Violación de Regla Lógica (Rule 3): El peso de la canal limpia no puede igualar ni superar al peso del animal medido en vivo."
      );
    }
    return parseFloat(((canal / vivo) * 100).toFixed(2));
  },

  // =========================================================================
  // MÓDULO 1: CLASIFICACIÓN COMERCIAL AUTOMATIZADA PORCINA
  // =========================================================================
  clasificarSEUROPPorcino(porcentajeMagro) {
    const magro = parseFloat(porcentajeMagro);
    if (isNaN(magro) || magro < 0 || magro > 100) {
      throw new Error(
        "El porcentaje de tejido magro ingresado debe ser un valor decimal válido acotado entre 0 y 100."
      );
    }
    if (magro >= 60) return "S";
    if (magro >= 55) return "E";
    if (magro >= 50) return "U";
    if (magro >= 45) return "R";
    if (magro >= 40) return "O";
    return "P";
  },

  // =========================================================================
  // MÓDULO 2: CONTROL CALIDAD HIGIÉNICO-SANITARIA LÁCTEA
  // =========================================================================
  evaluarLaboratorioLacteo(laboratorioJson) {
    if (!laboratorioJson) return "Pendiente";
    const presenciaAntibioticos =
      laboratorioJson.antibioticos || laboratorioJson.Antibioticos;
    if (
      presenciaAntibioticos === true ||
      String(presenciaAntibioticos).toLowerCase() === "positivo"
    ) {
      return "Alerta";
    }
    return "Completado";
  },

  // =========================================================================
  // INFRAESTRUCTURA: CONTROLADOR DE CAPACIDAD TÉCNICA (validarAforoZona)
  // =========================================================================
  async validarAforoZona(db, zonaNombre, censoAAñadir) {
    const transaction = db.transaction(
      ["fincas", "rebanos", "animales"],
      "readonly"
    );
    const fincasStore = transaction.objectStore("fincas");
    const rebanosStore = transaction.objectStore("rebanos");
    const animalesStore = transaction.objectStore("animales");

    const allFincas = await fincasStore.getAll();

    let zona = null;
    for (let f of allFincas) {
      zona = f.zonas?.find((z) => z.nombre === zonaNombre);
      if (zona) break;
    }

    if (!zona || !zona.aforoMax) return true;

    let censoActual = 0;
    const allRebanos = await rebanosStore.getAll();
    const rebanosEnZona = allRebanos.filter(r => r.zonaActual === zonaNombre);

    for (let r of rebanosEnZona) {
      const count = await animalesStore.index("rebanoId").count(Number(r.id));
      censoActual += count;
    }

    if (censoActual + censoAAñadir > zona.aforoMax) {
      throw new Error(
        `Validación de Aforo Denegada (Rule 1): La zona física [${zonaNombre}] superaría su capacidad técnica autorizada de ${zona.aforoMax} animales.`
      );
    }
    return true;
  },

  // =========================================================================
  // ONBOARDING: PROCESADOR E IMPORTADOR DE BACKUPS JSON (importarBackupData)
  // =========================================================================
  async importarBackupData(db, jsonString, sobreescribir = false) {
    return new Promise((resolve, reject) => {
      let data;
      try {
        data = JSON.parse(jsonString);
      } catch (err) {
        return reject(
          new Error(
            "El archivo seleccionado no posee un formato JSON válido de copia de seguridad."
          )
        );
      }
      const storesDisponibles = [
        "fincas",
        "config_especies",
        "config_tipos_produccion",
        "rebanos",
        "animales",
        "produccion_carne",
        "produccion_leche",
        "ventas_ganado",
        "sanitarios_ganado",
        "comercializacion_carne",
        "comercializacion_leche",
        "gastos_ganaderia",
        "registro_eventos",
        "reproduccion_eventos",
        "compradores",
        "proveedores",
        "contratos_compra",
        "transportistas",
        "documentos_legales",
        "meta",
      ];
      const storesAInyectar = storesDisponibles.filter(
        (store) => data[store] && Array.isArray(data[store])
      );

      if (
        storesAInyectar.length === 0 ||
        !data.fincas ||
        data.fincas.length === 0
      ) {
        return reject(
          new Error(
            "El backup está vacío o no contiene una estructura compatible con Livestock Manager."
          )
        );
      }

      // Si no hay registro_eventos en el backup, nos aseguramos de que esté en la lista de stores para poder inicializarla
      const incluirEventos = !storesAInyectar.includes("registro_eventos");
      const storesTransaccion = incluirEventos
        ? [...storesAInyectar, "registro_eventos"]
        : storesAInyectar;

      const transaction = db.transaction(storesTransaccion, "readwrite");
      transaction.onerror = (e) =>
        reject(
          new Error(
            "Error crítico durante la transacción de restauración: " +
              e.target.error
          )
        );
      transaction.oncomplete = async () => {
        // Post-proceso: Generar eventos de trazabilidad para animales si no existen
        if (incluirEventos && data.animales) {
          try {
            const tx = db.transaction("registro_eventos", "readwrite");
            const storeEventos = tx.objectStore("registro_eventos");

            for (const animal of data.animales) {
              await storeEventos.put({
                tipo_entidad: "animal",
                entidad_id: animal.id,
                fecha: new Date().toISOString().split("T")[0],
                motivo_tarea: "ALTA_IMPORTACION",
                observaciones:
                  "Generado automáticamente durante restauración de backup legatario.",
                creadoEn: new Date().toISOString(),
              });
            }
            await tx.done;
          } catch (e) {
            console.warn(
              "[Trazabilidad] No se pudieron generar eventos automáticos:",
              e
            );
          }
        }
        const listaFincas = data.fincas;
        resolve({
          multiplesFincas: listaFincas.length > 1,
          fincas: listaFincas,
        });
      };

      storesAInyectar.forEach((storeName) => {
        // IMPORTANTE: desenvuelve el store idb-wrapped para usar la API nativa
        // de IDB con callbacks (.onsuccess). La librería idb convierte clear()/put()
        // en Promises, lo que hace que .onsuccess sea un no-op y los datos nunca
        // se repueblen tras el borrado en modo sobreescribir.
        const objectStore = window.idb.unwrap(
          transaction.objectStore(storeName)
        );
        if (sobreescribir) {
          objectStore.clear().onsuccess = () => {
            data[storeName].forEach((record) => objectStore.put(record));
          };
        } else {
          data[storeName].forEach((record) => objectStore.put(record));
        }
      });
    });
  },

  async existeCrotal(caravana) {
    const idBuscado = caravana.trim().toUpperCase();
    const animal = await window.db.getFromIndex(
      "animales",
      "caravana",
      idBuscado
    );
    return animal ? true : false;
  },

  // =========================================================================
  // MÓDULO DE EXPEDICIÓN: GENERACIÓN DE ALBARANES Y FACTURAS PARA IMPRESIÓN
  // =========================================================================
  /**
   * Procesa los datos NoSQL planos y genera la estructura jerárquica limpia para el renderizado del PDF.
   */
  async generarEstructuraAlbaran(db, data, tipo) {
    const finca = await db.get("fincas", Number(data.fincaId));

    // Estructura de cabecera fiscal y comercial requerida por la ley de facturación
    const albaran = {
      cabecera: {
        numero_albaran: data.id || `EXP-${Date.now()}`,
        fecha_emision: new Date().toISOString().split("T")[0],
        vendedor: {
          nombre: finca.nombre || finca.Nombre || "Explotación Ganadera",
          rega: finca.codigo_REGA || finca.rega || finca.codigoREGA || "Sin Registro REGA",
          direccion:
            finca.direccion || finca.Dirección || "Dirección no registrada",
        },
        comprador: {
          nombre:
            data.razonSocial ||
            data.destinoComercial ||
            data.razonSocialComprador ||
            "N/D",
          nif: data.nifComprador || data.idComprador || "N/D",
          direccion:
            data.direccionFacturacion || data.Direccion_Facturacion || "N/D",
        },
      },
      trazabilidad: {},
      economico: {},
    };

    if (tipo === "carne") {
      // Mapeo específico de la Información de la Cadena Alimentaria (ICA) y rendimiento de la canal
      albaran.trazabilidad = {
        tipo: "CARNE / MATADERO",
        codigo_ica:
          data.codigoICA || data.codigoDocumento_ICA || "ICA-No Declarado",
        numero_guia:
          data.numeroGuia || data.numero_Guia_Sanitaria || "Sin Guía",
        matadero: data.codigoMatadero || "Matadero Asignado",
        animales: data.animalId || "Lote Pecuario",
        // Nuevos campos v9
        numero_albaran: data.numero_albaran || '',
        dimoe: data.dimoe || `DIMOE-${data.numero_albaran || 'N/A'}`,
        transportista: {
          nombre: data.nombreTransportista || data.transportista_nombre || '',
          nif: data.nifTransportista || data.transportista_nif || '',
          matricula: data.matriculaTransportista || data.transportista_matricula || ''
        }
      };

      // Simulación y desglose económico agregando el tipo impositivo e IVA agrario
      const baseCalc =
        parseFloat(data.pesoCanal || 0) * parseFloat(data.precioBase || 5.5);
      const ivaPorc = parseFloat(data.ivaPct || data.IVA || 10);
      const retPorc = parseFloat(data.retencionPct || data.retencionREAGP || 0);

      albaran.economico = {
        peso_vivo: data.pesoVivo || 0,
        peso_canal: data.pesoCanal || 0,
        rendimiento: data.rendimientoCanal || 0,
        iva: ivaPorc,
        retencion: retPorc,
        total_bruto:
          data.monto ||
          parseFloat(
            (
              baseCalc +
              baseCalc * (ivaPorc / 100) -
              baseCalc * (retPorc / 100)
            ).toFixed(2)
          ),
      };
    } else {
      // Mapeo específico de los controles higiénico-sanitarios lácteos y trazabilidad Letra Q
      albaran.trazabilidad = {
        tipo: "LECHE / INDUSTRIA",
        matricula: data.matriculaCisterna || "Sin Matrícula",
        muestra_letra_q:
          data.numero_Muestra_Letra_Q || data.numeroMuestraQ || "Sin Muestra",
        temp_carga: data.temperatura || data.temperaturaCarga || 0,
        ausencia_inhibidores:
          data.certificadoInhibidores || data.certificadoAusenciaInhibidores
            ? "DECLARADA (APTO)"
            : "PENDIENTE BIOCIDA",
      };

      const precioBaseLitre = parseFloat(data.precioBase || 0.45);
      const totalVolumen = parseFloat(data.cantidad || 0);
      const extras = parseFloat(data.primasPenalizaciones || 0);
      const inlac = data.laboratorio?.tasa_INLAC || data.tasaINLAC || 0.003;

      albaran.economico = {
        volumen: totalVolumen,
        precio_base: precioBaseLitre,
        tasa_inlac: inlac,
        estado: data.estadoAnalitica || "Pendiente",
        total_bruto:
          data.estadoAnalitica === "Alerta"
            ? 0
            : parseFloat(
                (
                  totalVolumen * precioBaseLitre +
                  extras -
                  totalVolumen * inlac
                ).toFixed(2)
              ),
      };
    }

    console.log(
      `[TRAZABILIDAD v3.3.5] Albarán unificado generado con éxito:`,
      albaran
    );
    return albaran;
  },
};

// Vinculación explícita para compatibilidad de rutas legadas
window.Trazabilidad = MotorTrazabilidad;
window.MotorTrazabilidad = MotorTrazabilidad;
