/**
 * Livestock Manager - AlertasService v1.1.0
 * Servicio centralizado de alertas: sanitarias, trazabilidad y calendario.
 * Reemplaza la lógica dispersa en App.renderDashboard y otros módulos.
 * v1.1.0: respeta las preferencias de Ajustes → Gestión de Alertas (F6).
 */

const AlertasService = {
  _listeners: new Set(),

  /**
   * Preferencias de Ajustes → Gestión de Alertas (meta/appConfig).
   * Defaults alineados con AjustesView._loadConfig.
   */
  async _getPrefs() {
    const defaults = {
      alertSanidad: true, alertTrazabilidad: true, alertPAC: true,
      alertADSG: true, alertINCOLAC: true, alertContratos: false,
    };
    try {
      const cfg = await window.db.get('meta', 'appConfig');
      return { ...defaults, ...(cfg?.value || {}) };
    } catch (e) { return defaults; }
  },

  /**
   * Suscribirse a cambios en las alertas
   * @param {Function} cb - callback({ sanitarias, trazabilidad, calendario })
   * @returns {Function} unsubscribe
   */
  onChange(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  },

  _notify(alertas) {
    this._listeners.forEach(cb => {
      try { cb(alertas); } catch (e) { console.error('[AlertasService] listener error', e); }
    });
  },

  /**
   * Obtener todas las alertas agrupadas
   */
  async getAll() {
    const [sanitarias, trazabilidad, administrativas, calendario] = await Promise.all([
      this.obtenerAlertasSanitarias(),
      this.obtenerAlertasTrazabilidad(),
      this.obtenerAlertasAdministrativas(),
      this.obtenerCalendarioPreventivo(),
    ]);
    const alertas = { sanitarias, trazabilidad, administrativas, calendario };
    this._notify(alertas);
    return alertas;
  },

  /**
   * Alertas sanitarias: periodos de supresión activos
   */
  async obtenerAlertasSanitarias() {
    try {
      const prefs = await this._getPrefs();
      if (prefs.alertSanidad === false) return [];
      const rebanos = await window.db.getAll('rebanos');
      const rebanosIds = rebanos.map(r => r.id);
      const todosTratamientos = await window.db.getAll('sanitarios_ganado') || [];
      const hoy = new Date();

      const activas = todosTratamientos
        .filter(t => rebanosIds.includes(t.rebanoId))
        .map(t => {
          const fechaTrat = new Date(t.fecha);
          const diasPasados = Math.floor((hoy - fechaTrat) / (1000 * 60 * 60 * 24));
          const diasRestantes = t.tiempo_espera_carne_dias - diasPasados;
          const rebano = rebanos.find(r => r.id === t.rebanoId);
          return {
            id: t.id,
            tipo: 'sanitaria',
            medicamento: t.medicamento,
            rebanoId: t.rebanoId,
            rebanoNombre: rebano?.nombre || 'Desconocido',
            fecha: t.fecha,
            diasRestantes,
            urgencia: diasRestantes <= 7 ? 'rojo' : diasRestantes <= 15 ? 'amarillo' : 'verde',
            prohibidoLeche: t.prohibidoLeche,
          };
        })
        .filter(a => a.diasRestantes > 0)
        .sort((a, b) => a.diasRestantes - b.diasRestantes);

      return activas;
    } catch (e) {
      console.error('[AlertasService] Error sanitarias:', e);
      return [];
    }
  },

  /**
   * Alertas de trazabilidad: notificaciones pendientes, identificaciones
   */
  async obtenerAlertasTrazabilidad() {
    try {
      const prefs = await this._getPrefs();
      if (prefs.alertTrazabilidad === false) return [];
      const animales = await window.db.getAll('animales');
      const hoy = new Date();
      const alertas = [];

      animales.forEach(a => {
        if (a.estado !== 'activo' && a.estado !== 'Activo') return;
        const nac = new Date(a.fecha_nacimiento);
        const edadDias = Math.floor((hoy - nac) / (1000 * 60 * 60 * 24));

        // Identificación pendiente (> 6 meses / 180 días)
        if (!a.fecha_identificacion && edadDias > 150) {
          alertas.push({
            tipo: 'trazabilidad',
            crotal: a.numero_identificacion,
            animalId: a.id,
            mensaje: `Identificación obligatoria pendiente. Edad: ${Math.floor(edadDias / 30)} meses`,
            urgencia: edadDias >= 180 ? 'rojo' : 'amarillo',
          });
        }

        // Notificación REGA pendiente
        if (a.fecha_identificacion && !a.notificado_rega) {
          const ident = new Date(a.fecha_identificacion);
          const diasIdent = Math.floor((hoy - ident) / (1000 * 60 * 60 * 24));
          if (diasIdent >= 5 && diasIdent <= 30) {
            alertas.push({
              tipo: 'trazabilidad',
              crotal: a.numero_identificacion,
              animalId: a.id,
              mensaje: `Notificación PIGGAN/SIA pendiente. Crotalado hace ${diasIdent} días`,
              urgencia: diasIdent >= 7 ? 'rojo' : 'amarillo',
            });
          }
        }
        // DIB pendiente para bovinos
        const especie = (a.especie || '').toLowerCase();
        if ((especie.includes('vaca') || especie.includes('bovino')) && !a.dib) {
          alertas.push({
            tipo: 'trazabilidad',
            crotal: a.numero_identificacion,
            animalId: a.id,
            mensaje: `DIB/Pasaporte bovino pendiente. Crotal: ${a.numero_identificacion}`,
            urgencia: 'amarillo',
          });
        }
      });

      // Documentación post-venta pendiente (ventas sin DIMOE o sin evento)
      try {
        const ventas = await window.db.getAll('comercializacion_carne') || [];
        const eventos = await window.db.getAll('registro_eventos') || [];
        const docs = await window.db.getAll('documentos_legales') || [];
        ventas.forEach(v => {
          const tieneEvento = eventos.some(e =>
            Number(e.entidad_id) === Number(v.animalId) && e.motivo_tarea === 'expedicion'
          );
          const tieneDimoe = docs.some(d =>
            d.tipo === 'dimoe' && Number(d.ventaId) === Number(v.id)
          );
          if (!tieneEvento || !tieneDimoe) {
            alertas.push({
              tipo: 'trazabilidad',
              crotal: `Venta #${v.id}`,
              animalId: v.animalId,
              mensaje: `Documentación post-venta incompleta. Albarán: ${v.numero_albaran || 'N/A'}. ${!tieneDimoe ? 'Falta DIMOE. ' : ''}${!tieneEvento ? 'Falta evento.' : ''}`,
              urgencia: 'rojo',
            });
          }
        });
      } catch(e) { /* ignore */ }

      alertas.sort((a, b) => (a.urgencia === 'rojo' ? -1 : 1));
      return alertas;
    } catch (e) {
      console.error('[AlertasService] Error trazabilidad:', e);
      return [];
    }
  },

  /**
   * Alertas administrativas: contratos, PAC, INFOLAC, ADSG
   */
  async obtenerAlertasAdministrativas() {
    try {
      const alertas = [];
      const hoy = new Date();
      const prefs = await this._getPrefs();

      // 1. Contrato lácteo — vencimiento próximo
      const fincas = await window.db.getAll('fincas');
      const finca = fincas?.[0];
      if (prefs.alertContratos !== false && finca?.contrato_lacteo_fecha_fin) {
        const fechaFin = new Date(finca.contrato_lacteo_fecha_fin);
        const diasRestantes = Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24));
        if (diasRestantes > 0 && diasRestantes <= 60) {
          alertas.push({
            tipo: 'administrativa',
            seccion: 'contrato_lacteo',
            mensaje: `Contrato lácteo vence el ${fechaFin.toLocaleDateString('es-ES')} (${diasRestantes} días)`,
            urgencia: diasRestantes <= 15 ? 'rojo' : diasRestantes <= 30 ? 'amarillo' : 'verde',
            accion: 'Renovar contrato con la industria antes del vencimiento.',
            diasRestantes,
          });
        }
      }

      // 2. INFOLAC — declaración mensual pendiente
      if (prefs.alertINCOLAC !== false) {
        const registrosLeche = await window.db.getAllFromIndex('comercializacion_leche', 'fincaId', finca?.id || 0);
        const ultimoRegistro = registrosLeche.sort((a, b) => new Date(b.fechaRecogida) - new Date(a.fechaRecogida))[0];
        if (ultimoRegistro) {
          const ultimaFecha = new Date(ultimoRegistro.fechaRecogida);
          const diasDesdeUltimo = Math.ceil((hoy - ultimaFecha) / (1000 * 60 * 60 * 24));
          if (diasDesdeUltimo >= 25) {
            alertas.push({
              tipo: 'administrativa',
              seccion: 'infolac',
              mensaje: `Declaración INFOLAC pendiente. Última recogida hace ${diasDesdeUltimo} días`,
              urgencia: diasDesdeUltimo >= 35 ? 'rojo' : 'amarillo',
              accion: 'Declarar producción mensual en la plataforma INFOLAC de la comunidad autónoma.',
              diasRestantes: 40 - diasDesdeUltimo,
            });
          }
        } else if (finca) {
          // Sin registros de leche — recordatorio de alta inicial
          alertas.push({
            tipo: 'administrativa',
            seccion: 'infolac',
            mensaje: 'Sin registros de comercialización láctea. Dar de alta en INFOLAC.',
            urgencia: 'amarillo',
            accion: 'Registrar primera venta de leche y darse de alta en INFOLAC.',
            diasRestantes: null,
          });
        }
      }

      // 3. PAC — plazos según comunidad autónoma
      const cc = finca?.comunidad_autonoma || finca?.comunidad || '';
      const mes = hoy.getMonth() + 1;
      let pacAlerta = null;
      if (mes >= 1 && mes <= 3) {
        pacAlerta = {
          mensaje: 'Solicitud Única PAC — plazo del 1 de febrero al 30 de abril',
          urgencia: mes === 3 ? 'amarillo' : 'verde',
          accion: 'Presentar solicitud única PAC (SIGPAC, DUN, cuaderno digital).',
        };
      } else if (mes === 4) {
        pacAlerta = {
          mensaje: 'Solicitud Única PAC — finaliza el 30 de abril',
          urgencia: 'rojo',
          accion: 'Último mes para presentar la solicitud única PAC sin penalización.',
        };
      }
      // Umbrales PAC específicos por comunidad
      if (cc.toLowerCase().includes('extremadura') && mes >= 6 && mes <= 7) {
        pacAlerta = {
          mensaje: 'Declaración de ayudas asociadas (Extremadura) — plazo abierto',
          urgencia: 'amarillo',
          accion: 'Presentar documentación de ayudas asociadas a la PAC en Extremadura.',
        };
      }
      if (pacAlerta && prefs.alertPAC !== false) {
        alertas.push({
          tipo: 'administrativa',
          seccion: 'pac',
          mensaje: pacAlerta.mensaje,
          urgencia: pacAlerta.urgencia,
          accion: pacAlerta.accion,
          diasRestantes: null,
        });
      }

      // 4. ADSG / REGA — renovación anual
      if (prefs.alertADSG !== false && finca?.adsg && finca?.adsg_fecha_vencimiento) {
        const fechaAdsg = new Date(finca.adsg_fecha_vencimiento);
        const diasRestantesAdsg = Math.ceil((fechaAdsg - hoy) / (1000 * 60 * 60 * 24));
        if (diasRestantesAdsg > 0 && diasRestantesAdsg <= 45) {
          alertas.push({
            tipo: 'administrativa',
            seccion: 'adsg',
            mensaje: `Renovación ADSG/REGA vence el ${fechaAdsg.toLocaleDateString('es-ES')} (${diasRestantesAdsg} días)`,
            urgencia: diasRestantesAdsg <= 15 ? 'rojo' : 'amarillo',
            accion: 'Renovar el seguro/reaseguro ganadero antes del vencimiento.',
            diasRestantes: diasRestantesAdsg,
          });
        }
      }

      // 5. Contratos de compra próximos a vencer
      if (prefs.alertContratos !== false) {
        try {
          const contratosCompra = await window.db.getAll('contratos_compra') || [];
          contratosCompra.forEach(ct => {
            if (!ct.activo || !ct.fecha_fin) return;
            const fechaFin = new Date(ct.fecha_fin);
            const diasRestantes = Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24));
            if (diasRestantes > 0 && diasRestantes <= 60) {
              alertas.push({
                tipo: 'administrativa',
                seccion: 'contrato_compra',
                mensaje: `Contrato ${ct.numero_contrato || ''} vence el ${fechaFin.toLocaleDateString('es-ES')} (${diasRestantes} días)`,
                urgencia: diasRestantes <= 15 ? 'rojo' : diasRestantes <= 30 ? 'amarillo' : 'verde',
                accion: 'Renovar contrato de compra con el comprador.',
                diasRestantes,
              });
            }
          });
        } catch(e) { /* contratos_compra store puede no existir */ }
      }

      // 6. Certificado transportista próximo a vencer
      try {
        const transportistas = await window.db.getAll('transportistas') || [];
        transportistas.forEach(t => {
          if (!t.certificado_bienestar_fin) return;
          const fechaFin = new Date(t.certificado_bienestar_fin);
          const diasRestantes = Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24));
          if (diasRestantes > 0 && diasRestantes <= 45) {
            alertas.push({
              tipo: 'administrativa',
              seccion: 'transportista',
              mensaje: `Certificado bienestar de ${t.nombre} vence el ${fechaFin.toLocaleDateString('es-ES')} (${diasRestantes} días)`,
              urgencia: diasRestantes <= 15 ? 'rojo' : 'amarillo',
              accion: 'Renovar certificado de aptitud al transporte del transportista.',
              diasRestantes,
            });
          }
        });
      } catch(e) { /* transportistas store puede no existir */ }

      return alertas;
    } catch (e) {
      console.error('[AlertasService] Error administrativas:', e);
      return [];
    }
  },

  /**
   * Calendario preventivo según época del año
   */
  async obtenerCalendarioPreventivo() {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;

    if (mes >= 9 && mes <= 11) {
      return {
        titulo: 'Otoño: Pre-Cubrición',
        sugerencias: [
          'Vacuna contra Abortos (Clamidia/Toxoplasmosis)',
          'Suplementar Vitamina A, D3, E para fertilidad',
          'Revisar condición corporal (Flushing)',
        ],
      };
    }
    if (mes >= 3 && mes <= 5) {
      return {
        titulo: 'Primavera: Pre-Parto y Destete',
        sugerencias: [
          'Vacuna Clostridial (4 sem antes del parto)',
          'Vigilar Cetosis (Propilenglicol si gestación múltiple)',
          'Desparasitar corderos al destete (Fenbendazol)',
        ],
      };
    }
    if (mes >= 6 && mes <= 8) {
      return {
        titulo: 'Verano',
        sugerencias: [
          'Asegurar sombra y agua limpia abundante',
          'Control de parásitos externos (Moscas, garrapatas)',
          'Evitar traslados en horas de máximo calor',
        ],
      };
    }
    return {
      titulo: 'Invierno',
      sugerencias: [
        'Asegurar forraje y resguardo contra frío',
        'Vigilar problemas respiratorios (Neumonías)',
        'Revisión de pezuñas en camas húmedas',
      ],
    };
  },

  /**
   * Número total de alertas activas (para badges en la UI)
   */
  async getActiveCount() {
    const [sanitarias, trazabilidad, administrativas] = await Promise.all([
      this.obtenerAlertasSanitarias(),
      this.obtenerAlertasTrazabilidad(),
      this.obtenerAlertasAdministrativas(),
    ]);
    return sanitarias.length + trazabilidad.length + administrativas.length;
  },
};

window.AlertasService = AlertasService;

// Inicializar: escuchar eventos que pueden cambiar las alertas
if (window.EventBus) {
  const eventosRecalculo = [
    'tratamiento:added', 'tratamiento:deleted',
    'animal:created', 'animal:updated',
  ];
  eventosRecalculo.forEach(event => {
    window.EventBus.on(event, () => {
      AlertasService.getAll().then(alertas => {
        window.EventBus.emit('alertas:updated', alertas);
      });
    });
  });
}

console.log('[AlertasService] Servicio de alertas unificado listo v1.0.0');
