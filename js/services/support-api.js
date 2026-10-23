/**
 * support-api.js — cliente del backend de soporte.
 *
 * Unico punto del frontend que habla con el Worker. Guarda la sesion, la
 * renueva revalidando la compra y expone las llamadas de tickets.
 *
 * El usuario nunca ve GitHub: aqui se manejan «incidencias» con su estado en
 * espanol, no issues.
 *
 * Compartido por Android y PWA: no duplicar esta logica en ningun otro sitio.
 */
(function () {
  'use strict';

  // Worker en produccion. window.SUPPORT_API_BASE permite apuntar a otro
  // entorno (pruebas) sin tocar este fichero.
  var BASE = ('SUPPORT_API_BASE' in window ? window.SUPPORT_API_BASE : 'https://livestock-manager-support-api-production.livestock-desktop.workers.dev');

  var CLAVE_SESION = 'livestock_support_session';

  // Fecha de la ultima respuesta ya vista de cada incidencia. Vive en el
  // dispositivo y no en el servidor: es una comodidad visual y no merece una
  // llamada mas ni un campo por usuario en KV. Al cambiar de movil todo vuelve
  // a verse como nuevo, que es el lado seguro del fallo.
  var CLAVE_LEIDAS = 'livestock_incidencias_leidas';

  // Ultimo estado que el usuario ha visto de cada incidencia, para poder avisar
  // cuando cambia («ahora se esta mirando tu incidencia») sin una llamada mas:
  // el listado que ya se descarga trae el estado actual. Misma decision que
  // CLAVE_LEIDAS: vive en el dispositivo y es una comodidad visual.
  var CLAVE_ESTADOS = 'livestock_incidencias_estados_vistos';

  var SupportAPI = {
    _sesion: (function () {
      try {
        return JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null');
      } catch (e) {
        return null;
      }
    })(),

    /** Hay sesion y no ha caducado. */
    tieneSesion: function () {
      if (!this._sesion || !this._sesion.token) return false;
      return !this._sesion.expira || Date.parse(this._sesion.expira) > Date.now();
    },

    /**
     * La licencia tiene su propia caducidad, distinta de la de la sesion: la
     * sesion dura 24 h y la suscripcion se renueva por su cuenta. Comprobar
     * solo el flag `activa` daba por buena una licencia vencida hace rato, asi
     * que el usuario escribia la incidencia entera y solo fallaba al enviarla.
     */
    licenciaActiva: function () {
      var lic = this._sesion && this._sesion.licencia;
      if (!lic || !lic.activa) return false;
      return !lic.expira || Date.parse(lic.expira) > Date.now();
    },

    _guardarSesion: function (sesion) {
      this._sesion = sesion;
      try {
        localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
      } catch (e) {}
    },

    cerrarSesion: function () {
      this._sesion = null;
      try {
        localStorage.removeItem(CLAVE_SESION);
      } catch (e) {}
    },

    async _peticion(ruta, opciones) {
      opciones = opciones || {};
      var cabeceras = { 'Content-Type': 'application/json' };
      if (this._sesion && this._sesion.token) {
        cabeceras.Authorization = 'Bearer ' + this._sesion.token;
      }

      var respuesta;
      try {
        respuesta = await fetch(BASE + ruta, {
          method: opciones.method || 'GET',
          headers: cabeceras,
          body: opciones.body ? JSON.stringify(opciones.body) : undefined,
        });
      } catch (e) {
        // Sin red: la app es offline-first, pero el soporte no puede serlo.
        throw new Error('Sin conexión. El soporte necesita internet.');
      }

      var datos = null;
      try {
        datos = await respuesta.json();
      } catch (e) {}

      if (respuesta.status === 401) {
        this.cerrarSesion();
        throw new Error('Tu sesión ha caducado. Vuelve a entrar en Soporte.');
      }

      // La licencia ha vencido mientras la sesion seguia viva. La suscripcion
      // puede haberse renovado ya en Google, asi que se revalida el token de
      // compra y se reintenta una sola vez. Sin esto el usuario se quedaba
      // bloqueado hasta que se le ocurriera pulsar «Ya lo tengo» a ciegas.
      var caducada =
        respuesta.status === 403 &&
        datos &&
        (datos.codigo === 'LICENCIA_CADUCADA' || datos.codigo === 'LICENCIA_INACTIVA');

      if (caducada && !opciones._reintento && window.PurchaseManager &&
          window.PurchaseManager.revalidarSoporte) {
        // El try es imprescindible: revalidar() lanza si no hay red o si el
        // servidor no contesta, y ese error taparia el LICENCIA_CADUCADA que
        // la vista necesita para mandar al usuario a la pantalla de licencia.
        var renovada = false;
        try {
          renovada = await window.PurchaseManager.revalidarSoporte();
        } catch (e) {
          console.warn('[SupportAPI] no se pudo revalidar la licencia:', e);
        }
        if (renovada) {
          opciones._reintento = true;
          return this._peticion(ruta, opciones);
        }
      }

      if (!respuesta.ok) {
        var error = new Error((datos && datos.error) || 'No se pudo completar la operación');
        error.codigo = datos && datos.codigo;
        throw error;
      }
      return datos;
    },

    /**
     * Identificador de esta instalacion, guardado en el almacen `meta` de la
     * base de datos de la app.
     *
     * Va ahi y no en localStorage por dos motivos: `meta` entra en la copia de
     * seguridad (exportBackup vuelca todos los almacenes), y no se pierde al
     * borrar los datos del navegador interno.
     *
     * Para que sirve: la identidad de soporte se deriva del token de compra de
     * Google, que cambia cuando la suscripcion caduca y se vuelve a comprar. Sin
     * este id, esa recompra dejaria al ganadero con el historial de incidencias
     * vacio y el anterior inaccesible.
     */
    async _idDeInstalacion() {
      if (!window.db || typeof window.db.get !== 'function') return '';
      try {
        var fila = await window.db.get('meta', 'instalacion_soporte');
        if (fila && fila.valor) return fila.valor;

        var id =
          (window.crypto && window.crypto.randomUUID)
            ? window.crypto.randomUUID()
            : 'inst-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

        await window.db.put('meta', {
          key: 'instalacion_soporte',
          valor: id,
          creadoEn: new Date().toISOString(),
        });
        return id;
      } catch (e) {
        // Sin id se sigue trabajando: es una red de seguridad, no un requisito.
        console.warn('[SupportAPI] no se pudo leer el id de instalacion:', e);
        return '';
      }
    },

    /**
     * Valida la compra contra el backend y abre sesion. Se llama al entrar en
     * Soporte y tras comprar la licencia.
     */
    async iniciarSesion(purchaseToken, plataforma, email, actualizarEmail) {
      var instalacion = await this._idDeInstalacion();
      var datos = await this._peticion('/auth/verify-purchase', {
        method: 'POST',
        // Esta es la llamada que revalida: no puede reintentarse a si misma.
        _reintento: true,
        body: {
          purchase_token: purchaseToken,
          plataforma: plataforma || 'android',
          email: email || '',
          // Solo cuando el usuario ha editado el campo a proposito. En los
          // arranques normales el correo va vacio y sin esta marca borraria el
          // que tuviera guardado.
          actualizar_email: actualizarEmail === true,
          instalacion: instalacion,
        },
      });
      if (datos && email !== undefined && actualizarEmail === true) {
        datos.email = email || '';
      }
      this._guardarSesion(datos);
      return datos;
    },

    /** Correo de contacto tal y como quedo en la ultima sesion. */
    correoGuardado: function () {
      return (this._sesion && this._sesion.email) || '';
    },

    /**
     * Estado de la licencia y correo segun el servidor, no segun el cliente.
     *
     * Refresca la copia guardada en la sesion: la revalidacion de la compra
     * puede reemplazarla por una respuesta que no incluye el correo, mientras
     * `/auth/me` devuelve ambos datos desde el registro del usuario en KV.
     */
    async estadoLicencia() {
      var datos = await this._peticion('/auth/me');
      if (datos && this._sesion) {
        var actualizada = false;
        if (datos.licencia) {
          this._sesion.licencia = datos.licencia;
          actualizada = true;
        }
        if (Object.prototype.hasOwnProperty.call(datos, 'email')) {
          this._sesion.email = datos.email || '';
          actualizada = true;
        }
        if (actualizada) this._guardarSesion(this._sesion);
      }
      return datos;
    },

    /** Lo ultimo que se sabe de la licencia, sin llamar al servidor. */
    licenciaGuardada: function () {
      return (this._sesion && this._sesion.licencia) || null;
    },

    /**
     * Paso 1: manda el texto libre y recibe el borrador estructurado. Todavia
     * no se ha creado nada; el usuario tiene que revisarlo.
     */
    async pedirBorrador(descripcion, contexto) {
      return this._peticion('/tickets', {
        method: 'POST',
        body: { descripcion: descripcion, contexto: contexto || {} },
      });
    },

    /**
     * Paso 2: el usuario ha revisado (y quiza editado) el borrador. Al
     * confirmar se registra la incidencia.
     */
    async confirmarIncidencia(borrador, contexto) {
      return this._peticion('/tickets/confirm', {
        method: 'POST',
        body: {
          ticket_id: borrador.ticket_id,
          titulo: borrador.titulo,
          descripcion: borrador.descripcion,
          pasos_reproduccion: borrador.pasos_reproduccion,
          contexto: contexto || {},
        },
      });
    },

    async listarIncidencias() {
      var datos = await this._peticion('/tickets');
      return (datos && datos.tickets) || [];
    },

    async detalleIncidencia(ticketId) {
      return this._peticion('/tickets/' + encodeURIComponent(ticketId));
    },

    /**
     * Escribe un mensaje en una incidencia ya abierta. Devuelve la respuesta
     * tal y como queda guardada, para pintarla sin recargar el hilo entero.
     */
    async responderIncidencia(ticketId, texto) {
      var datos = await this._peticion(
        '/tickets/' + encodeURIComponent(ticketId) + '/responder',
        { method: 'POST', body: { texto: texto } },
      );
      return (datos && datos.respuesta) || null;
    },

    /**
     * Confirma que la solucion propuesta funciona.
     *
     * «Resuelta» la decide el equipo, que no puede saber si al usuario le ha
     * servido; hasta esta confirmacion es una propuesta. El «no» no se manda
     * por aqui: es un mensaje normal, y el servidor reabre la incidencia al
     * recibirlo.
     */
    async confirmarResolucion(ticketId) {
      var datos = await this._peticion(
        '/tickets/' + encodeURIComponent(ticketId) + '/confirmar',
        { method: 'POST', body: {} },
      );
      return (datos && datos.confirmada_at) || null;
    },

    // --- Respuestas leidas ---------------------------------------------------
    //
    // Viven aqui y no en la vista porque hay dos consumidores: la lista de
    // incidencias, que marca las filas, y el aviso de arranque, que cuenta las
    // pendientes. Con una copia en cada sitio, abrir una respuesta la marcaba
    // leida en un sitio y seguia avisando desde el otro.

    _leidas: function () {
      try {
        return JSON.parse(localStorage.getItem(CLAVE_LEIDAS) || '{}') || {};
      } catch (e) {
        return {};
      }
    },

    marcarLeida: function (ticketId, fechaUltima) {
      if (!fechaUltima) return;
      try {
        var mapa = this._leidas();
        mapa[ticketId] = fechaUltima;
        localStorage.setItem(CLAVE_LEIDAS, JSON.stringify(mapa));
      } catch (e) {}
    },

    /** true si la incidencia tiene una respuesta posterior a la ultima vista. */
    tieneRespuestaNueva: function (incidencia) {
      if (!incidencia || !incidencia.ultima_respuesta_at) return false;
      var vista = this._leidas()[incidencia.ticket_id];
      if (!vista) return true;
      return Date.parse(incidencia.ultima_respuesta_at) > Date.parse(vista);
    },

    // --- Estados vistos ------------------------------------------------------
    //
    // A diferencia de las respuestas, aqui importa saber CUAL era el estado
    // anterior, porque el aviso dice «tu incidencia paso de A a B». Guardar solo
    // una marca de tiempo no alcanza.

    _estadosVistos: function () {
      try {
        return JSON.parse(localStorage.getItem(CLAVE_ESTADOS) || '{}') || {};
      } catch (e) {
        return {};
      }
    },

    /** Registra el estado que el usuario acaba de ver. */
    marcarEstadoVisto: function (ticketId, estado) {
      if (!ticketId || !estado) return;
      try {
        var mapa = this._estadosVistos();
        mapa[ticketId] = estado;
        localStorage.setItem(CLAVE_ESTADOS, JSON.stringify(mapa));
      } catch (e) {}
    },

    /**
     * true si el estado cambio desde la ultima vez que el usuario lo vio.
     * Una incidencia que nunca se ha visto NO se considera cambiada: si no,
     * saltarian todos los avisos la primera vez que se abre la app.
     */
    tieneEstadoNuevo: function (incidencia) {
      if (!incidencia || !incidencia.estado) return false;
      var visto = this._estadosVistos()[incidencia.ticket_id];
      if (!visto) return false;
      return visto !== incidencia.estado;
    },

    /** Estado registrado como visto para esa incidencia, o null si nunca se vio. */
    estadoVisto: function (ticketId) {
      return this._estadosVistos()[ticketId] || null;
    },

    /** Estados que merece la pena avisar al usuario cuando cambian. */
    ESTADOS_NOTIFICABLES: {
      revision: 'El equipo se está mirando tu incidencia',
      curso: 'Tu incidencia se está trabajando',
      resuelta: 'Tu incidencia se ha resuelto',
    },

    /** Contexto tecnico que acompana al reporte. */
    contextoActual: function () {
      var cap = window.Capacitor;
      return {
        version_app: (window.APP_INFO && window.APP_INFO.version) || '',
        dispositivo: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '',
        version_so: navigator.userAgent.slice(0, 120),
        plataforma: cap && cap.isNativePlatform && cap.isNativePlatform() ? 'android' : 'web',
      };
    },
  };

  /** Estados internos -> texto para el usuario. */
  SupportAPI.ESTADOS = {
    enviada: 'Enviada',
    analizada: 'Analizada',
    revision: 'En revisión',
    curso: 'En curso',
    resuelta: 'Resuelta',
  };

  SupportAPI.textoEstado = function (estado) {
    return SupportAPI.ESTADOS[estado] || 'Enviada';
  };

  /** Que significa cada estado, en la pantalla de incidencias. */
  SupportAPI.EXPLICACION_ESTADOS = {
    enviada: 'Registrada. Nadie la ha mirado todavía.',
    // 'analizada' la pone el asistente automático al responder, no una persona:
    // por eso no dice «el equipo la está mirando», que sería falso. Ese texto se
    // reserva para 'revision', que solo llega cuando comenta alguien de verdad.
    analizada: 'El asistente la ha analizado y te ha respondido. El equipo la revisará después.',
    revision: 'El equipo la está mirando y puede que te pregunte algo.',
    curso: 'Confirmada como fallo. Se está trabajando en ella.',
    // 'resuelta' la marca el equipo, no el usuario: mientras no la confirme es
    // una propuesta, y el texto no debe darla por cerrada a su espalda.
    resuelta: 'El equipo la da por resuelta. Suele llegar en la siguiente actualización de la app.',
  };

  /**
   * Frase de la licencia para Ajustes.
   *
   * Tres casos distintos que la misma fecha no distingue: renovacion prevista,
   * suscripcion cancelada que aun funciona, y compra unica sin caducidad. Sin
   * el dato de renovacion (licencias verificadas antes de que existiera el
   * campo) se dice solo hasta cuando vale, sin prometer nada.
   */
  SupportAPI.textoLicencia = function (lic) {
    if (!lic || !lic.activa) {
      return { activa: false, titulo: 'Sin licencia de soporte', detalle: 'Actívala para poder abrir incidencias.' };
    }

    if (!lic.expira) {
      return { activa: true, titulo: 'Licencia activa', detalle: 'Compra única, sin caducidad.' };
    }

    var fecha = SupportAPI.fechaLarga(lic.expira);
    var quedan = Math.ceil((Date.parse(lic.expira) - Date.now()) / 86400000);

    // Una licencia vencida llega aqui con `activa: true` porque el servidor no
    // revalida en cada respuesta: sin esta comprobacion el usuario veia
    // «Licencia activa» con una fecha ya pasada, mientras licenciaActiva() si
    // la daba por caducada y le negaba el envio.
    if (quedan < 0) {
      return {
        activa: false,
        titulo: 'Licencia caducada',
        detalle: 'Venció el ' + fecha + '. Reactívala para seguir abriendo incidencias.',
      };
    }

    var aviso = quedan <= 7;

    if (lic.renovacion_automatica === true) {
      return { activa: true, titulo: 'Licencia activa', detalle: 'Se renueva el ' + fecha + '.' };
    }
    if (lic.renovacion_automatica === false) {
      return {
        activa: true,
        aviso: true,
        titulo: 'Licencia activa (renovación cancelada)',
        detalle: 'Funcionará hasta el ' + fecha + '. Después no podrás abrir incidencias nuevas.',
      };
    }
    return { activa: true, aviso: aviso, titulo: 'Licencia activa', detalle: 'Válida hasta el ' + fecha + '.' };
  };

  SupportAPI.fechaLarga = function (iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  window.SupportAPI = SupportAPI;
})();
