/**
 * Livestock Manager - AvisosSoporteService v1.0.0
 *
 * Avisa cuando el equipo responde a una incidencia.
 *
 * No hay push: el backend no sabe a que dispositivo escribir. Se consulta el
 * listado al arrancar y cada vez que la app vuelve al primer plano, que es
 * cuando el usuario puede leer el aviso de todas formas. El listado ya trae
 * `ultima_respuesta_at` sin arrastrar el texto de las respuestas, asi que la
 * comprobacion es una sola llamada barata.
 *
 * Quien decide que es «nuevo» es SupportAPI, con las marcas de leido que
 * comparte con la pantalla de incidencias.
 */

const AvisosSoporteService = {
  /** Evita dos comprobaciones solapadas (arranque + primer plano seguidos). */
  _comprobando: false,
  /** Id fijo de la notificacion: se reemplaza, no se acumulan. */
  ID_NOTIFICACION: 90001,

  init() {
    // Sin sesion de soporte no hay nada que consultar y no conviene gastar una
    // llamada en cada arranque de quien no ha comprado el modulo.
    this.comprobar();
    this._alVolverAlPrimerPlano();
    this._alTocarNotificacion();
  },

  /** Tocar el aviso abre el listado; si no, el usuario tendria que buscarlo. */
  _alTocarNotificacion() {
    const plugin = window.Capacitor?.Plugins?.LocalNotifications;
    if (!plugin || !plugin.addListener) return;
    plugin.addListener('localNotificationActionPerformed', (evento) => {
      const id = evento?.notification?.id;
      if (id === this.ID_NOTIFICACION) window.location.hash = '#/mis-incidencias';
    });
  },

  _alVolverAlPrimerPlano() {
    const plugin = window.Capacitor?.Plugins?.App;
    if (plugin) {
      plugin.addListener('appStateChange', (estado) => {
        if (estado && estado.isActive) this.comprobar();
      });
      return;
    }
    // En web (PWA) el equivalente es volver a la pestana.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.comprobar();
    });
  },

  async comprobar() {
    if (this._comprobando) return 0;
    if (!window.SupportAPI || !window.SupportAPI.tieneSesion()) return 0;

    this._comprobando = true;
    try {
      const incidencias = await window.SupportAPI.listarIncidencias();
      const nuevas = incidencias.filter((i) => window.SupportAPI.tieneRespuestaNueva(i));
      if (nuevas.length) this._avisar(nuevas);
      return nuevas.length;
    } catch (e) {
      // Sin conexion no se avisa y no se molesta: se reintenta al volver.
      console.warn('[AvisosSoporte] No se pudo comprobar:', e);
      return 0;
    } finally {
      this._comprobando = false;
    }
  },

  _avisar(nuevas) {
    const varias = nuevas.length > 1;
    const titulo = varias ? 'Respuestas del soporte' : 'Respuesta del soporte';
    const cuerpo = varias
      ? `Tienes ${nuevas.length} incidencias con respuesta nueva.`
      : `«${nuevas[0].titulo}» tiene respuesta.`;

    this._notificar(titulo, cuerpo);

    // El toast es lo unico que ve quien tiene las notificaciones denegadas o
    // esta usando la app en ese momento (Android no muestra la notificacion
    // de forma llamativa con la app delante).
    if (window.Toast && window.Toast.info) {
      window.Toast.info(cuerpo + ' Míralo en Ajustes › Mis incidencias.');
    }
  },

  async _notificar(titulo, cuerpo) {
    const plugin = window.Capacitor?.Plugins?.LocalNotifications;
    if (!plugin) return;
    try {
      await plugin.schedule({
        notifications: [
          {
            id: this.ID_NOTIFICACION,
            title: titulo,
            body: cuerpo,
            smallIcon: 'ic_stat_name',
            // Sin `schedule`: se muestra ya. Programarla a futuro solo
            // retrasaria un aviso que el usuario puede atender ahora mismo.
            extra: { ruta: '#/mis-incidencias' },
          },
        ],
      });
    } catch (e) {
      console.warn('[AvisosSoporte] No se pudo notificar:', e);
    }
  },
};

window.AvisosSoporteService = AvisosSoporteService;
