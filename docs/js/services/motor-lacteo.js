/**
 * Motor Lácteo — Validaciones de bienestar animal, ambiental y trazabilidad Letra Q
 * Módulo Lácteo Integral (v24)
 */
window.MotorLacteo = (() => {
  'use strict';

  async function validarBienestarAnimal(finca) {
    const alertas = [];
    if (!finca) return alertas;

    // Capacidad autorizada, igual que validarAmbiental: el bienestar se dimensiona
    // sobre las plazas declaradas, no sobre el censo real del día.
    const vacasLeche = finca.plazas_vacuno_leche || finca.plazas_autorizadas_rega || 0;

    if (vacasLeche === 0) return alertas;

    if (finca.superficie_descanso_m2) {
      const espacioRequerido = vacasLeche * 5;
      if (finca.superficie_descanso_m2 < espacioRequerido) {
        alertas.push({
          tipo: 'BIENESTAR',
          nivel: 'WARNING',
          codigo: 'ESPACIO_INSUFICIENTE',
          mensaje: `Superficie descanso insuficiente: ${finca.superficie_descanso_m2}m² < ${espacioRequerido}m² (${vacasLeche} vacas × 5m²)`,
        });
      }
    }

    if (finca.metros_lineales_comedero) {
      const comederoRequerido = vacasLeche * 60;
      if (finca.metros_lineales_comedero < comederoRequerido) {
        alertas.push({
          tipo: 'BIENESTAR',
          nivel: 'DANGER',
          codigo: 'COMEDERO_INSUFICIENTE',
          mensaje: `Comedero insuficiente: ${finca.metros_lineales_comedero}cm < ${comederoRequerido}cm (${vacasLeche} vacas × 60cm)`,
        });
      }
    }

    if (finca.num_cubiculos != null && finca.num_cubiculos < vacasLeche) {
      alertas.push({
        tipo: 'BIENESTAR',
        nivel: 'WARNING',
        codigo: 'CUBICULOS_INSUFICIENTES',
        mensaje: `Cubículos insuficientes: ${finca.num_cubiculos} < ${vacasLeche} vacas`,
      });
    }

    return alertas;
  }

  function validarAmbiental(finca) {
    if (!finca) return null;

    const plazas = finca.plazas_vacuno_leche || finca.plazas_autorizadas_rega || 0;

    if (plazas > 300 && !finca.tiene_evaluacion_ambiental) {
      return {
        tipo: 'AMBIENTAL',
        nivel: 'DANGER',
        codigo: 'EVALUACION_AMBIENTAL_REQUERIDA',
        mensaje: `Explotación con ${plazas} plazas (>300) requiere evaluación ambiental y datos de balsa de purines`,
      };
    }

    if (plazas > 300 && !finca.capacidad_balsa_purines_m3) {
      return {
        tipo: 'AMBIENTAL',
        nivel: 'WARNING',
        codigo: 'BALSA_PURINES_SIN_DATOS',
        mensaje: 'Explotación >300 plazas: registrar capacidad de balsa de purines',
      };
    }

    return null;
  }

  async function validarTrazabilidadLetraQ(fincaId) {
    const alertas = [];
    const finca = await window.db.get('fincas', fincaId);
    if (!finca) {
      alertas.push({ nivel: 'DANGER', codigo: 'FINCA_NO_ENCONTRADA', mensaje: 'Finca no encontrada' });
      return alertas;
    }

    if (!finca.codigo_letra_q) {
      alertas.push({
        tipo: 'TRAZABILIDAD',
        nivel: 'DANGER',
        codigo: 'SIN_LETRA_Q_FINCA',
        mensaje: 'Finca sin código Letra Q asignado',
      });
    }

    const clasif = finca.clasificacion_zootecnica_leche;
    if (!clasif) {
      alertas.push({
        tipo: 'TRAZABILIDAD',
        nivel: 'DANGER',
        codigo: 'SIN_CLASIFICACION_LECHE',
        mensaje: 'Clasificación zootécnica láctea no configurada',
      });
    } else if (window.ComunidadesService && !window.ComunidadesService.esCompatibleLetraQ(clasif)) {
      alertas.push({
        tipo: 'TRAZABILIDAD',
        nivel: 'DANGER',
        codigo: 'CLASIFICACION_INCOMPATIBLE',
        mensaje: 'Clasificación zootécnica incompatible con Letra Q',
      });
    }

    const tanques = await window.TanquesLeche.getActivos(fincaId);
    for (const t of tanques) {
      if (!t.codigo_letra_q) {
        alertas.push({
          tipo: 'TRAZABILIDAD',
          nivel: 'DANGER',
          codigo: 'TANQUE_SIN_LETRA_Q',
          mensaje: `Tanque "${t.nombre}" sin código Letra Q`,
        });
      }
    }

    return alertas;
  }

  async function validarComercializacion(data) {
    const errores = [];
    const warnings = [];

    const finca = await window.db.get('fincas', data.fincaId);
    if (!finca) {
      errores.push('Finca no encontrada');
      return { valido: false, errores, warnings };
    }

    if (!finca.codigo_letra_q) {
      errores.push('Finca sin código Letra Q — imposible comercializar');
    }

    const clasif = finca.clasificacion_zootecnica_leche;
    if (window.ComunidadesService && clasif && !window.ComunidadesService.esCompatibleLetraQ(clasif)) {
      errores.push('Clasificación zootécnica incompatible con Letra Q');
    }

    if (data.tanqueId) {
      const tanque = await window.TanquesLeche.getById(data.tanqueId);
      if (!tanque) {
        errores.push('Tanque no encontrado');
      } else if (!tanque.codigo_letra_q) {
        errores.push('Tanque sin código Letra Q');
      }

      const validacion = await window.BalanceLacteo.validarStockSuficiente(data.tanqueId, data.cantidad);
      if (!validacion.valido) {
        errores.push(`Litros declarados (${data.cantidad}L) superan stock del tanque (${validacion.stockActual}L)`);
      }
    }

    const especie = data.especie_leche || 'vacuno';
    if (data.analitica) {
      const CS = window.ComunidadesService;
      if (CS) {
        const evalResult = CS.evaluarCalidadLecheEspecie(data.analitica, especie);
        if (evalResult.bloqueante) {
          errores.push(...evalResult.alertas);
        }
        for (const alerta of evalResult.alertas) {
          if (!evalResult.bloqueante) {
            warnings.push(alerta);
          }
        }
      }
    }

    if (data.temperatura != null && data.temperatura > 6) {
      warnings.push(`Temperatura elevada (${data.temperatura}°C > 6°C) — infracción leve`);
    }

    return {
      valido: errores.length === 0,
      errores,
      warnings,
    };
  }

  async function getAllAlertas(fincaId) {
    const finca = await window.db.get('fincas', fincaId);
    const alertas = [];

    const bienestar = await validarBienestarAnimal(finca);
    alertas.push(...bienestar);

    const ambiental = validarAmbiental(finca);
    if (ambiental) alertas.push(ambiental);

    const trazabilidad = await validarTrazabilidadLetraQ(fincaId);
    alertas.push(...trazabilidad);

    const tanquesStock = await window.BalanceLacteo.getTanqueConStock(fincaId);
    for (const t of tanquesStock) {
      if (t.porcentaje_llenado > 90) {
        alertas.push({
          tipo: 'STOCK',
          nivel: 'WARNING',
          codigo: 'TANQUE_CASI_LLENO',
          mensaje: `Tanque "${t.nombre}" al ${t.porcentaje_llenado}% de capacidad`,
        });
      }
      if (t.temperatura_actual != null && t.temperatura_actual > 6) {
        alertas.push({
          tipo: 'TEMPERATURA',
          nivel: 'WARNING',
          codigo: 'TEMPERATURA_ELEVADA',
          mensaje: `Tanque "${t.nombre}" a ${t.temperatura_actual}°C`,
        });
      }
      if (t.proxima_limpieza) {
        const dias = Math.ceil((new Date(t.proxima_limpieza) - new Date()) / (1000 * 60 * 60 * 24));
        if (dias <= 0) {
          alertas.push({
            tipo: 'LIMPIEZA',
            nivel: 'DANGER',
            codigo: 'LIMPIEZA_VENCIDA',
            mensaje: `Limpieza del tanque "${t.nombre}" vencida`,
          });
        } else if (dias <= 30) {
          alertas.push({
            tipo: 'LIMPIEZA',
            nivel: 'WARNING',
            codigo: 'LIMPIEZA_PROXIMA',
            mensaje: `Limpieza del tanque "${t.nombre}" en ${dias} días`,
          });
        }
      }
    }

    return alertas;
  }

  function validarMovimientoLetraQ(data) {
    const errores = [];
    const warnings = [];
    const CS = window.ComunidadesService;
    if (!CS) return { valido: true, errores, warnings };

    const tipos = CS.getTiposMovimientoLetraQ();
    const tipo = data.tipo_movimiento_letra_q;
    if (tipo && !tipos.find(t => t.value === tipo)) {
      errores.push(`Tipo de movimiento "${tipo}" no válido en Letra Q 2.0`);
      return { valido: false, errores, warnings };
    }

    if (data.agente_recogida_nif && !data.agente_destino_nif) {
      warnings.push('Agente de destino no informado — puede afectar al plazo de comunicación');
    }

    if (data.resultado_inhibidores_in_situ === 'no_conforme') {
      warnings.push('Resultado inhibidores NO CONFORME en explotación — requiere comunicación a Letra Q en 2 días hábiles');
    }

    if (data.muestra_tomada && !data.nif_tomador_muestra) {
      errores.push('NIF del tomador de muestra obligatorio cuando se ha realizado toma de muestras');
    }

    if (tipo === 'cisterna_a_cisterna') {
      if (!data.codigo_cisterna_origen_letra_q) {
        errores.push('Código Letra Q de cisterna origen obligatorio para movimiento cisterna→cisterna');
      }
      if (!data.codigo_cisterna_destino_letra_q) {
        errores.push('Código Letra Q de cisterna destino obligatorio para movimiento cisterna→cisterna');
      }
    }

    return { valido: errores.length === 0, errores, warnings };
  }

  function calcularPlazoComunicacion(tipoAgenteDestino, fechaRecogida) {
    const CS = window.ComunidadesService;
    if (!CS || !fechaRecogida) return '';
    const plazos = CS.getPlazosComunicacionLetraQ();
    const dias = plazos[tipoAgenteDestino] || 3;
    return CS.diasHabiles(fechaRecogida, dias);
  }

  return {
    validarBienestarAnimal,
    validarAmbiental,
    validarTrazabilidadLetraQ,
    validarComercializacion,
    validarMovimientoLetraQ,
    calcularPlazoComunicacion,
    getAllAlertas,
  };
})();
