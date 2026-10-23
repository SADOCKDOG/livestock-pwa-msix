/**
 * soporte-panel.js — Pie del sidebar + panel de soporte minimizable.
 *
 * El soporte vive en dos superficies del cromo ERP:
 *   · PIE (#sidebarStatus): bloque «Soporte» con la licencia (Con licencia /
 *     Sin licencia), el acceso al panel y el contador de respuestas nuevas.
 *   · PANEL: cajón acoplado a la derecha, con el flujo completo
 *     (licencia → formulario → borrador → enviado) y el listado + detalle de
 *     incidencias. Se puede maximizar a toda la ventana, minimizar a una
 *     barra flotante y recuerda el tamaño con el que se dejó.
 *
 * Reutiliza SupportAPI (tickets + sesión) y PurchaseManager (compra) igual
 * que las vistas por ruta (#/soporte, #/mis-incidencias), que se mantienen
 * intactas. Este módulo aporta el cajón persistente para poder navegar por la
 * app con el soporte abierto.
 */
(function () {
  'use strict';

  var CLAVE_PANEL = 'lm_soporte_panel'; // 'open' | 'max' | 'min'

  // Estilos auto-inyectados: no dependen de una hoja externa para poder vivir
  // en el maestro y llegar al escritorio por el sync sin tocar index.html.
  var ESTILOS = [
    '.sp-pie{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;',
    'margin:-3px -3px 6px -3px;border:1px solid var(--border-subtle,rgba(255,255,255,.08));',
    'border-radius:var(--r-sm,8px);background:var(--surface-light,rgba(255,255,255,.04));',
    'cursor:pointer;text-align:left;font:inherit;color:inherit}',
    '.sp-pie:hover{border-color:var(--border,rgba(255,255,255,.12))}',
    '.sp-pie-ico{flex:0 0 auto;display:flex;color:var(--c-info,#4FA)}',
    '.sp-pie-cuerpo{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px}',
    '.sp-pie-rotulo{font-size:.58rem;letter-spacing:.05em;text-transform:uppercase;color:var(--text-s,#B1B1B1);opacity:1}',
    '.sp-pie-estado{font-size:.7rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.sp-pie-estado.ok{color:var(--c-success)}',
    '.sp-pie-estado.no{color:var(--c-danger)}',
    '.sp-pie-cont{flex:0 0 auto;display:flex;align-items:center;gap:5px}',
    '.sp-contador{font-size:.62rem;font-weight:800;min-width:18px;height:18px;',
    'padding:0 5px;border-radius:999px;display:none;align-items:center;justify-content:center;',
    'background:var(--c-danger);color:var(--surface-card)}',
    '.sp-contador.on{display:inline-flex}',
    // Cajón acoplado
    // Ficha de licencia
    '.sp-ficha{border:1px solid var(--border-subtle,rgba(255,255,255,.08));',
    'border-radius:var(--r-sm,8px);padding:12px;margin-top:10px;',
    'background:var(--surface-light,rgba(255,255,255,.04))}',
    '.sp-ficha-fila{display:flex;justify-content:space-between;align-items:baseline;',
    'gap:10px;padding:6px 0;border-bottom:1px solid var(--border-subtle,rgba(255,255,255,.06))}',
    '.sp-ficha-fila:last-child{border-bottom:0}',
    '.sp-ficha-clave{flex:0 0 auto;font-size:.72rem;opacity:.65}',
    '.sp-ficha-valor{flex:1 1 auto;min-width:0;text-align:right;font-size:.78rem;font-weight:600;',
    'word-break:break-word}',
    '.sp-ficha-valor.ok{color:var(--c-success)}',
    '.sp-ficha-valor.no{color:var(--c-danger)}',
    '.sp-ficha-valor.aviso{color:var(--c-warning,#E8A33D)}',
    '.sp-panel{position:fixed;top:0;right:0;bottom:0;width:min(400px,96vw);',
    'z-index:9995;display:flex;flex-direction:column;background:var(--surface,#1E1E1E);',
    'color:var(--text-p,#fff);box-shadow:-10px 0 30px rgba(0,0,0,.35);',
    'border-left:1px solid var(--border,#27272A)}',
    // Maximizado: ocupa toda la ventana. El ancho acoplado pasa a `auto` para
    // que left+right definan el ancho, y se anula la sombra lateral porque ya
    // no hay borde de ventana. El `width:100vw` fuerza el ancho del viewport
    // (1265px utiles con la barra de scroll) en vez del disponible, que
    // dejaba una franja de 15px por la que se veia la pagina de debajo.
    '.sp-panel.max{left:0;width:100vw;box-shadow:none;border-left:0}',
    '.sp-cab{display:flex;align-items:center;justify-content:space-between;gap:8px;',
    'padding:12px 14px;border-bottom:1px solid var(--border,#27272A);flex:0 0 auto}',
    '.sp-cab-titulo{font-weight:800;display:flex;align-items:center;gap:8px}',
    '.sp-cab-acciones{display:flex;gap:4px}',
    '.sp-cab-acciones button{background:transparent;border:1px solid var(--border,#27272A);',
    'color:inherit;border-radius:var(--r-sm,6px);width:28px;height:28px;cursor:pointer;font-size:14px;line-height:1}',
    '.sp-cab-acciones button:hover{background:var(--surface-light,#2A2A2A)}',
    '.sp-tabs{display:flex;flex:0 0 auto;border-bottom:1px solid var(--border,#27272A)}',
    '.sp-tab{flex:1 1 0;background:transparent;border:none;border-bottom:2px solid transparent;',
    'color:var(--text-s,#B1B1B1);padding:10px 8px;font:inherit;font-size:.72rem;font-weight:700;',
    'cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}',
    '.sp-tab.on{color:var(--text-p,#fff);border-bottom-color:var(--c-info,#4FA)}',
    '.sp-cuerpo{flex:1 1 auto;overflow-y:auto;padding:14px}',
    '.sp-estado-fila{display:flex;align-items:center;justify-content:space-between;gap:8px;',
    'margin-bottom:12px;padding:8px 10px;border-radius:var(--r-sm,8px);',
    'background:var(--surface-light,#2A2A2A);font-size:.68rem}',
    '.sp-lic.ok{color:var(--c-success)}',
    '.sp-lic.no{color:var(--c-danger)}',
    // Barra minimizada
    '.sp-min{position:fixed;right:16px;bottom:16px;z-index:9996;display:none;',
    'align-items:center;gap:8px;padding:9px 14px;border-radius:999px;cursor:pointer;',
    'background:var(--surface,#1E1E1E);color:var(--text-p,#fff);font:inherit;font-size:.72rem;',
    'font-weight:700;border:1px solid var(--border,#27272A);box-shadow:0 6px 18px rgba(0,0,0,.3)}',
    '.sp-min.on{display:inline-flex}',
    '.sp-panel.oculto{display:none}',
    '.sp-contador--min{display:inline-flex}',
    '.sp-titulo{margin:0 0 10px 0;font-size:.95rem;font-weight:800}',
    '.sp-texto{line-height:1.5;font-size:.8rem}',
    '.sp-acciones{display:flex;flex-wrap:wrap;gap:8px}',
    '.sp-aviso{font-size:.72rem;margin-top:6px;color:var(--c-danger)}',
  ].join('\n');

  // Estado del módulo.
  var _noLeidas = 0;
  var _paso = 'formulario'; // formulario | borrador | enviado
  var _borrador = null;
  var _vista = 'nueva'; // 'nueva' | 'listado'
  var _abierto = false;
  var _minimizado = false;
  // Arranca con el tamaño guardado: sin esto, tras reiniciar la app el panel
  // volvía acoplado aunque se hubiera dejado maximizado.
  var _maximizado = leerEstadoPanel() === 'max';
  var _cargando = false;
  var _enviando = false;

  function escapar(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fecha(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function fechaHora(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function claseEstado(estado) {
    if (estado === 'resuelta') return 'badge-success';
    if (estado === 'curso') return 'badge-purple';
    if (estado === 'revision') return 'badge-warning';
    if (estado === 'analizada') return 'badge-info';
    if (estado === 'enviada') return 'badge-gray';
    return '';
  }

  function textoSeveridad(sev) {
    if (sev === 'alta') return 'Alta';
    if (sev === 'media') return 'Media';
    if (sev === 'baja') return 'Baja';
    return sev || '';
  }

  // Iconos SVG (headset y chevrones), inline para no depender de otra fuente.
  var ICO_SOPORTE =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 12a9 9 0 0 1 18 0"/><path d="M21 12v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h4z"/>' +
    '<path d="M3 12v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H3z"/></svg>';

  function iconoChevron(derecha) {
    var rotacion = derecha ? '' : ' style="transform:rotate(90deg)"';
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + rotacion + '>' +
      '<polyline points="9 18 15 12 9 6"/></svg>';
  }

  // Iconos de maximizar/restaurar. `maximizado` decide si se dibujan las
  // flechas hacia dentro (restaurar) o hacia fuera (maximizar).
  function iconoPantalla(maximizado) {
    var trazo = maximizado
      ? '<polyline points="4 9 4 4 9 4"/><polyline points="15 4 20 4 20 9"/>' +
        '<polyline points="20 15 20 20 15 20"/><polyline points="9 20 4 20 4 15"/>'
      : '<polyline points="9 4 4 4 4 9"/><polyline points="20 15 20 20 15 20"/>';
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      trazo + '</svg>';
  }

  function inyectarEstilos() {
    if (document.getElementById('sp-estilos')) return;
    var style = document.createElement('style');
    style.id = 'sp-estilos';
    style.textContent = ESTILOS;
    document.head.appendChild(style);
  }

  function licenciaActiva() {
    return !!(window.SupportAPI && window.SupportAPI.licenciaActiva());
  }

  function tieneSesion() {
    return !!(window.SupportAPI && window.SupportAPI.tieneSesion());
  }

  function textoLicencia() {
    if (!window.SupportAPI) return { activa: false, titulo: 'Sin licencia' };
    var info = window.SupportAPI.textoLicencia(window.SupportAPI.licenciaGuardada());
    return { activa: info.activa, titulo: info.activa ? 'Con licencia' : 'Sin licencia' };
  }

  function guardarEstadoPanel() {
    // 'max' solo describe el tamaño; abrir y cerrar no lo tocan, para que al
    // reabrir la ventana recupere el tamaño con el que se dejó.
    var estado = _minimizado ? 'min' : (_maximizado ? 'max' : 'open');
    try { localStorage.setItem(CLAVE_PANEL, estado); } catch (e) {}
  }

  function leerEstadoPanel() {
    try { return localStorage.getItem(CLAVE_PANEL); } catch (e) { return null; }
  }

  function $id(id) { return document.getElementById(id); }

  function refrescarNoLeidas() {
    if (!tieneSesion()) {
      _noLeidas = 0;
      pintarContadores();
      return;
    }
    window.SupportAPI.listarIncidencias()
      .then(function (lista) {
        lista = lista || [];
        avisarCambiosDeEstado(lista);
        _noLeidas = lista.filter(function (i) {
          return window.SupportAPI.tieneRespuestaNueva(i) ||
            window.SupportAPI.tieneEstadoNuevo(i);
        }).length;
        pintarContadores();
      })
      .catch(function () { /* sin red: se deja el contador como estaba */ });
  }

  /**
   * Compara los estados actuales con los que el usuario ya vio y avisa de los
   * que cambiaron. Se apoya en el listado que ya se ha descargado, asi que no
   * cuesta ninguna llamada extra.
   *
   * La primera vez que se ve una incidencia no se avisa de nada: se registra
   * como estado visto y a partir de ahi si se comparan. Sin eso, todos los
   * avisos saltarían en el primer arranque y el usuario dejaría de leerlos.
   */
  function avisarCambiosDeEstado(lista) {
    var avisables = window.SupportAPI.ESTADOS_NOTIFICABLES;
    lista.forEach(function (i) {
      var texto = avisables[i.estado];
      if (!texto) return;
      if (window.SupportAPI.tieneEstadoNuevo(i)) {
        if (window.App && window.App.toast) window.App.toast(texto, 'info');
      } else if (!window.SupportAPI.estadoVisto(i.ticket_id)) {
        window.SupportAPI.marcarEstadoVisto(i.ticket_id, i.estado);
      }
    });
  }

  function pintarContadores() {
    var enPie = $id('sp-contador');
    if (enPie) {
      enPie.textContent = _noLeidas > 9 ? '9+' : String(_noLeidas);
      enPie.classList.toggle('on', _noLeidas > 0);
    }
    var enPestania = $id('sp-contador-tab');
    if (enPestania) {
      enPestania.textContent = _noLeidas > 9 ? '9+' : String(_noLeidas);
      enPestania.classList.toggle('on', _noLeidas > 0);
    }
    var enMin = $id('sp-contador-min');
    if (enMin) {
      enMin.textContent = _noLeidas > 9 ? '9+' : String(_noLeidas);
      enMin.classList.toggle('on', _noLeidas > 0);
    }
  }

  var SoportePanel = {
    /** Inyecta (o refresca) el bloque «Soporte» al inicio del pie del sidebar. */
    montarPie: function () {
      inyectarEstilos();
      var pie = $id('sidebarStatus');
      if (!pie) return;
      var previo = pie.querySelector('.sp-pie');
      if (previo) previo.remove();
      var lic = textoLicencia();
      var contador = '<span class="sp-contador" id="sp-contador"></span>';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-pie';
      btn.setAttribute('aria-label', 'Abrir el panel de soporte');
      btn.innerHTML =
        '<span class="sp-pie-ico">' + ICO_SOPORTE + '</span>' +
        '<span class="sp-pie-cuerpo">' +
        '<span class="sp-pie-rotulo">Soporte</span>' +
        '<span class="sp-pie-estado ' + (lic.activa ? 'ok' : 'no') + '">' + escapar(lic.titulo) + '</span>' +
        '</span>' +
        '<span class="sp-pie-cont">' + contador + iconoChevron(true) + '</span>';
      btn.addEventListener('click', function () { SoportePanel.abrir(); });
      pie.appendChild(btn);
      pintarContadores();
      refrescarNoLeidas();
    },

    /** Sincroniza el estado del pie (licencia y contador) sin recargar la app. */
    actualizar: function () {
      pintarContadores();
      this.montarPie();
    },

    abrir: function () {
      inyectarEstilos();
      this._montarCajon();
      _minimizado = false;
      guardarEstadoPanel();
      _abierto = true;
      $id('sp-panel').classList.remove('oculto');
      $id('sp-min').classList.remove('on');
      this._aplicarTamano();
      this._renderCuerpo();
    },

    cerrar: function () {
      _abierto = false;
      if ($id('sp-panel')) $id('sp-panel').classList.add('oculto');
      if ($id('sp-min')) $id('sp-min').classList.remove('on');
      guardarEstadoPanel();
    },

    minimizar: function () {
      _minimizado = true;
      guardarEstadoPanel();
      if ($id('sp-panel')) $id('sp-panel').classList.add('oculto');
      if ($id('sp-min')) $id('sp-min').classList.add('on');
      pintarContadores();
    },

    /** Maximizar/restaurar la ventana. Es independiente de minimizar. */
    alternarMax: function () {
      _maximizado = !_maximizado;
      guardarEstadoPanel();
      this._aplicarTamano();
    },

    /**
     * Sincroniza el tamaño real del cajón con el estado. El botón cambia de
     * icono y de texto según el tamaño, para que el gesto siguiente sea
     * evidente sin pasar el ratón.
     */
    _aplicarTamano: function () {
      var panel = $id('sp-panel');
      var btn = $id('sp-btn-max');
      if (!panel || !btn) return;
      panel.classList.toggle('max', _maximizado);
      btn.innerHTML = iconoPantalla(_maximizado);
      btn.title = _maximizado ? 'Restaurar' : 'Maximizar';
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-pressed', _maximizado ? 'true' : 'false');
    },

    alternarVista: function (vista) {
      this._setVista(vista);
    },

    _setVista: function (vista) {
      _vista = vista;
      this._renderCuerpo();
    },

    /** Vuelve al formulario y limpia el borrador (botón «Contar otra»). */
    volverAlFormulario: function () {
      _paso = 'formulario';
      _borrador = null;
      this._renderCuerpo();
    },

    /** Construye el cajón y la barra minimizada la primera vez. */
    _montarCajon: function () {
      if ($id('sp-panel')) return;
      var contadorTab =
        '<span class="sp-contador" id="sp-contador-tab"></span>';
      var panel = document.createElement('aside');
      panel.className = 'sp-panel oculto';
      panel.id = 'sp-panel';
      panel.setAttribute('aria-label', 'Soporte técnico');
      panel.innerHTML =
        '<div class="sp-cab">' +
        '<div class="sp-cab-titulo">' + ICO_SOPORTE + ' Soporte</div>' +
        '<div class="sp-cab-acciones">' +
        '<button id="sp-btn-max" type="button" title="Maximizar" aria-label="Maximizar" aria-pressed="false">' + iconoPantalla(false) + '</button>' +
        '<button id="sp-btn-min" type="button" title="Minimizar" aria-label="Minimizar">–</button>' +
        '<button id="sp-btn-cerrar" type="button" title="Cerrar" aria-label="Cerrar">×</button>' +
        '</div></div>' +
        '<div class="sp-tabs">' +
        '<button class="sp-tab" id="sp-tab-nueva" data-vista="nueva" type="button">Nueva incidencia</button>' +
        '<button class="sp-tab" id="sp-tab-listado" data-vista="listado" type="button">' +
        'Mis incidencias ' + contadorTab + '</button>' +
        '<button class="sp-tab" id="sp-tab-licencia" data-vista="licencia" type="button">Licencia</button>' +
        '</div>' +
        '<div class="sp-cuerpo" id="sp-cuerpo"></div>';
      document.body.appendChild(panel);

      var min = document.createElement('button');
      min.className = 'sp-min';
      min.id = 'sp-min';
      min.type = 'button';
      min.setAttribute('aria-label', 'Abrir el panel de soporte');
      min.innerHTML =
        '<span class="sp-pie-ico" style="display:flex">' + ICO_SOPORTE + '</span>' +
        '<span>Ver soporte</span>' +
        '<span class="sp-contador sp-contador--min" id="sp-contador-min"></span>';
      document.body.appendChild(min);

      min.addEventListener('click', function () { SoportePanel.abrir(); });
      $id('sp-btn-max').addEventListener('click', function () { SoportePanel.alternarMax(); });
      $id('sp-btn-min').addEventListener('click', function () { SoportePanel.minimizar(); });
      $id('sp-btn-cerrar').addEventListener('click', function () { SoportePanel.cerrar(); });
      $id('sp-tab-nueva').addEventListener('click', function () { SoportePanel.alternarVista('nueva'); });
      $id('sp-tab-listado').addEventListener('click', function () { SoportePanel.alternarVista('listado'); });
      $id('sp-tab-licencia').addEventListener('click', function () { SoportePanel.alternarVista('licencia'); });
    },

    _renderCuerpo: function () {
      var cuerpo = $id('sp-cuerpo');
      if (!cuerpo) return;
      this._marcarTabActiva();

      // La ficha de licencia se consulta siempre, tenga o no sesión: sin ella
      // es justamente donde el usuario necesita ver por qué no tiene soporte.
      if (_vista === 'licencia') {
        cuerpo.innerHTML = this._pantallaGestionLicencia();
        this._cargarLicencia();
        return;
      }

      if (_vista === 'listado') {
        cuerpo.innerHTML = this._pantallaListado();
        this._cargarListado();
        return;
      }

      // Vista «nueva»: hay que tener sesión y licencia activa.
      if (!tieneSesion() || !licenciaActiva()) {
        cuerpo.innerHTML = this._pantallaLicencia();
        return;
      }
      if (_paso === 'borrador' && _borrador) {
        cuerpo.innerHTML = this._pantallaBorrador();
        return;
      }
      if (_paso === 'enviado') {
        cuerpo.innerHTML = this._pantallaEnviado();
        return;
      }
      cuerpo.innerHTML = this._pantallaFormulario();
    },

    _marcarTabActiva: function () {
      var nueva = $id('sp-tab-nueva');
      var listado = $id('sp-tab-listado');
      var licencia = $id('sp-tab-licencia');
      if (nueva) nueva.classList.toggle('on', _vista === 'nueva');
      if (listado) listado.classList.toggle('on', _vista === 'listado');
      if (licencia) licencia.classList.toggle('on', _vista === 'licencia');
    },

    _filaEstado: function () {
      var lic = textoLicencia();
      var clase = lic.activa ? 'ok' : 'no';
      var extra = lic.activa ? '' : ' · Actívala para reportar';
      return (
        '<div class="sp-estado-fila">' +
        '<span class="sp-lic ' + clase + '">' + escapar(lic.titulo) + '</span>' +
        '<span class="text-gray text-sm">' + escapar(extra) + '</span>' +
        '</div>');
    },

    _pantallaLicencia: function () {
      return (
        '<h3 class="sp-titulo">Soporte técnico</h3>' + this._filaEstado() +
        '<p class="text-gray mt-10 sp-texto">' +
        'El soporte con asistencia por IA es un servicio aparte. Con una ' +
        'licencia activa puedes reportar incidencias y seguir su estado sin ' +
        'salir de la app.</p>' +
        '<p class="text-gray mt-10 sp-texto">La aplicación seguirá siendo ' +
        'gratuita: solo el soporte requiere licencia.</p>' +
        '<div class="sp-acciones mt-15">' +
        '<button class="btn btn-primary btn--inline" type="button" onclick="SoportePanel.comprar()">Activar soporte</button> ' +
        '<button class="btn btn-secondary btn--inline" type="button" onclick="SoportePanel.restaurar()">Ya la tengo</button>' +
        '</div>');
    },

    /**
     * Ficha de la licencia: estado, tipo, vigencia y correo asociado.
     *
     * El tipo no viene del servidor: se deduce de la caducidad, igual que
     * hace SupportAPI.textoLicencia. Una licencia sin `expira` es compra
     * única; con `expira` es suscripción, y `renovacion_automatica` distingue
     * si se renueva sola o si el usuario la canceló y sigue funcionando.
     */
    _pantallaGestionLicencia: function () {
      var lic = window.SupportAPI ? window.SupportAPI.licenciaGuardada() : null;
      var info = window.SupportAPI
        ? window.SupportAPI.textoLicencia(lic)
        : { activa: false, titulo: 'Sin licencia' };
      var correo = window.SupportAPI ? window.SupportAPI.correoGuardado() : '';

      var filas = [];
      filas.push(['Estado', info.titulo, info.activa ? 'ok' : 'no']);
      if (info.detalle) filas.push(['Vigencia', info.detalle, info.aviso ? 'aviso' : '']);
      filas.push([
        'Tipo',
        lic && !lic.expira ? 'Compra única' : lic ? 'Suscripción mensual' : '—',
        '',
      ]);
      filas.push(['Correo', correo || 'Sin asociar', '']);

      var ficha = filas.map(function (f) {
        return (
          '<div class="sp-ficha-fila">' +
          '<span class="sp-ficha-clave">' + escapar(f[0]) + '</span>' +
          '<span class="sp-ficha-valor ' + f[2] + '">' + escapar(f[1]) + '</span>' +
          '</div>');
      }).join('');

      return (
        '<h3 class="sp-titulo">Tu licencia de soporte</h3>' +
        '<p class="text-gray mt-10 sp-texto">El soporte es un servicio aparte. ' +
        'La aplicación sigue siendo gratuita.</p>' +
        '<div class="sp-ficha">' + ficha + '</div>' +
        '<div class="sp-acciones mt-15">' +
        (info.activa
          ? '<button class="btn btn-secondary btn--inline" type="button" ' +
            'onclick="SoportePanel.revalidarLicencia()">Comprobar ahora</button> ' +
            '<button class="btn btn-secondary btn--inline" type="button" ' +
            'onclick="SoportePanel.cambiarCorreo()">Cambiar correo</button>'
          : '<button class="btn btn-primary btn--inline" type="button" ' +
            'onclick="SoportePanel.comprar()">Activar soporte</button> ' +
            '<button class="btn btn-secondary btn--inline" type="button" ' +
            'onclick="SoportePanel.restaurar()">Ya la tengo</button>') +
        '</div>' +
        (info.aviso
          ? '<p class="text-sm mt-10" style="color:var(--c-warning,#E8A33D)">' +
            escapar(info.detalle) + '</p>'
          : ''));
    },

    /**
     * Consulta al servidor el estado real de la licencia y repinta.
     *
     * Refresca el contador del pie también: si la licencia se cae, el pie
     * tiene que pasar a «Sin licencia» sin esperar a reiniciar la app.
     */
    _cargarLicencia: function () {
      var cuerpo = $id('sp-cuerpo');
      if (!cuerpo || !tieneSesion() || !window.SupportAPI) return;
      SupportAPI.estadoLicencia()
        .then(function () {
          // Solo se repinta la ficha, sin volver a pedir los datos: llamar a
          // _renderCuerpo() aqui reentraba en esta misma carga y el panel se
          // quedaba llamando a /auth/me sin parar.
          SoportePanel._repintarLicencia();
          SoportePanel.actualizar();
        })
        .catch(function (e) {
          // Un 401 ya cierra la sesion por su cuenta. Para el resto no se
          // sustituye la ficha entera: se conserva lo que ya se sabia y se
          // añade el aviso con su reintento, porque al borrar el cuerpo el
          // usuario se quedaba sin ningun boton desde el que salir.
          if (!cuerpo || _vista !== 'licencia') return;
          var aviso = document.getElementById('sp-lic-aviso');
          if (aviso) aviso.remove();
          var nota = document.createElement('p');
          nota.id = 'sp-lic-aviso';
          nota.className = 'text-sm mt-10';
          nota.style.color = 'var(--c-warning,#E8A33D)';
          nota.textContent =
            ((e && e.message) || 'No se pudo comprobar la licencia.') +
            ' Se muestra la última información conocida.';
          var cola = cuerpo.querySelector('.sp-ficha');
          if (cola && cola.nextSibling) cola.parentNode.insertBefore(nota, cola.nextSibling);
          else cuerpo.appendChild(nota);
        });
    },

    /**
     * Repinta la ficha de licencia sin volver a pedir datos al servidor.
     *
     * Existe para que las acciones que ya tra consigo la respuesta fresca
     * (revalidar, cambiar correo) no recreen en _cargarLicencia().
     */
    _repintarLicencia: function () {
      if (_vista !== 'licencia' || !_abierto) return;
      var cuerpo = $id('sp-cuerpo');
      if (cuerpo) cuerpo.innerHTML = this._pantallaGestionLicencia();
    },

    /** Revalida la licencia contra la Store y avisa del resultado. */
    revalidarLicencia: function () {
      if (!window.PurchaseManager || !PurchaseManager.revalidarSoporte) return;
      App.toast('Comprobando la licencia…', 'info');
      PurchaseManager.revalidarSoporte()
        .then(function (ok) {
          if (ok) App.toast('Licencia confirmada.', 'success');
          else App.toastError('No se ha podido confirmar la licencia.');
          SoportePanel.actualizar();
          SoportePanel._repintarLicencia();
        })
        .catch(function (e) {
          App.toastError((e && e.message) || 'No se pudo comprobar la licencia.');
        });
    },

    /** Pide el correo de contacto y lo registra contra la licencia. */
    cambiarCorreo: function () {
      var actual = window.SupportAPI ? SupportAPI.correoGuardado() : '';
      var escrito = window.prompt(
        'Correo para el soporte (se usará para avisarte de las respuestas):',
        actual || '',
      );
      if (escrito === null) return;
      var correo = String(escrito).trim();
      if (!correo) {
        App.toastError('El correo no puede quedar vacío.');
        return;
      }
      if (!window.PurchaseManager || !PurchaseManager.registrarCorreoSoporte) return;
      PurchaseManager.registrarCorreoSoporte(correo)
        .then(function () {
          App.toast('Correo actualizado.', 'success');
          SoportePanel._repintarLicencia();
        })
        .catch(function (e) {
          App.toastError((e && e.message) || 'No se pudo actualizar el correo.');
        });
    },

    _pantallaFormulario: function () {
      return (
        '<h3 class="sp-titulo">Contar una incidencia</h3>' + this._filaEstado() +
        '<p class="text-gray mt-10 sp-texto">Explica qué ha pasado con tus ' +
        'palabras. No hace falta lenguaje técnico: se ordenará solo y podrás ' +
        'revisarlo antes de enviarlo.</p>' +
        '<div class="form-group mt-15">' +
        '<label class="form-label" for="sp-descripcion">¿Qué ha ocurrido?</label>' +
        '<textarea id="sp-descripcion" class="form-input" rows="6" ' +
        'placeholder="Por ejemplo: al guardar un pesaje, la app se queda cargando y el peso no aparece luego."></textarea>' +
        '</div>' +
        '<div class="sp-acciones mt-15">' +
        '<button class="btn btn-primary btn--inline" id="sp-btn-continuar" type="button" onclick="SoportePanel.pedirBorrador()">Continuar</button> ' +
        '<button class="btn btn-secondary btn--inline" type="button" onclick="SoportePanel.verMisIncidencias()">Mis incidencias</button>' +
        '</div>');
    },

    _pantallaBorrador: function () {
      var b = _borrador || {};
      var pasos = (b.pasos_reproduccion || []).map(function (p, i) {
        return (
          '<div class="form-group">' +
          '<label class="form-label">Paso ' + (i + 1) + '</label>' +
          '<input class="form-input" data-paso="' + i + '" value="' + escapar(p) + '">' +
          '</div>');
      }).join('');
      return (
        '<h3 class="sp-titulo">Revisa tu incidencia</h3>' + this._filaEstado() +
        '<p class="text-gray mt-10 sp-texto">Esto es lo que se va a registrar. ' +
        '<strong>Corrige lo que no encaje</strong> antes de enviarlo: nada se ' +
        'envía hasta que lo confirmes.</p>' +
        '<div class="form-group mt-15">' +
        '<label class="form-label" for="sp-borrador-titulo">Título</label>' +
        '<input id="sp-borrador-titulo" class="form-input" value="' + escapar(b.titulo) + '">' +
        '</div>' +
        '<div class="form-group">' +
        '<label class="form-label" for="sp-borrador-descripcion">Descripción</label>' +
        '<textarea id="sp-borrador-descripcion" class="form-input" rows="5">' + escapar(b.descripcion) + '</textarea>' +
        '</div>' +
        (pasos ? '<div class="mt-10">' + pasos + '</div>' : '') +
        '<p class="text-gray text-sm mt-10">Se enviará también la versión de ' +
        'la app y el dispositivo, para poder reproducir el problema.</p>' +
        '<div class="sp-acciones mt-15">' +
        '<button class="btn btn-primary btn--inline" id="sp-btn-enviar" type="button" onclick="SoportePanel.confirmar()">Enviar incidencia</button> ' +
        '<button class="btn btn-secondary btn--inline" type="button" onclick="SoportePanel.volverAlFormulario()">Volver</button>' +
        '</div>');
    },

    _pantallaEnviado: function () {
      return (
        '<h3 class="sp-titulo text-center">Incidencia enviada</h3>' + this._filaEstado() +
        '<p class="text-gray mt-10 sp-texto text-center">Ya está registrada. ' +
        'Puedes seguir su estado en «Mis incidencias».</p>' +
        '<div class="sp-acciones mt-15" style="justify-content:center"> ' +
        '<button class="btn btn-primary btn--inline" type="button" onclick="SoportePanel.verMisIncidencias()">Ver mis incidencias</button> ' +
        '<button class="btn btn-secondary btn--inline" type="button" onclick="SoportePanel.volverAlFormulario()">Contar otra</button>' +
        '</div>');
    },

    _pantallaListado: function () {
      return (
        '<h3 class="sp-titulo">Mis incidencias</h3>' +
        '<div class="sp-acciones mt-10 mb-10">' +
        '<button class="btn btn-secondary btn--inline" type="button" onclick="SoportePanel.recargarListado()">Actualizar</button> ' +
        '<button class="btn btn-primary btn--inline" type="button" onclick="SoportePanel.verFormulario()">Contar una</button>' +
        '</div>' +
        '<div id="sp-lista"><p class="text-gray sp-texto">Cargando…</p></div>');
    },

    _cargarListado: function () {
      var contenedor = $id('sp-lista');
      if (!contenedor) return;
      if (this._cargando) return;
      this._cargando = true;
      contenedor.innerHTML = '<p class="text-gray sp-texto">Cargando…</p>';
      window.SupportAPI.listarIncidencias()
        .then(function (lista) {
          if (!$id('sp-lista')) return;
          if (!lista || !lista.length) {
            $id('sp-lista').innerHTML =
              '<p class="text-gray sp-texto">Todavía no has reportado nada. ' +
              'Cuando lo hagas, aparecerá aquí con su estado.</p>';
            return;
          }
          $id('sp-lista').innerHTML = lista.map(function (i) {
            return SoportePanel._fila(i);
          }).join('');
        })
        .catch(function (e) {
          if ($id('sp-lista')) {
            $id('sp-lista').innerHTML = '<p class="text-gray sp-texto">' +
              escapar((e && e.message) || 'No se pudieron cargar las incidencias') + '</p>';
          }
        })
        .then(function () { SoportePanel._cargando = false; });
    },

    _fila: function (i) {
      var estado = window.SupportAPI.textoEstado(i.estado);
      var clase = claseEstado(i.estado);
      var id = escapar(i.ticket_id);
      var nuevas = window.SupportAPI.tieneRespuestaNueva(i);
      var cuantas = i.respuestas || 0;
      var marca = nuevas
        ? '<span class="badge badge-success">Respuesta nueva</span>'
        : cuantas
          ? '<span class="text-gray text-sm">' + cuantas + (cuantas === 1 ? ' respuesta' : ' respuestas') + '</span>'
          : '';
      // El cambio de estado se marca junto al estado, que es donde el usuario
      // lo mira: es el dato que ha cambiado.
      if (window.SupportAPI.tieneEstadoNuevo(i)) {
        marca += '<span class="badge badge-info">Estado actualizado</span>';
      }
      return (
        '<div class="card-registro mb-10" data-sp-ticket="' + id + '">' +
        '<div class="flex items-center justify-between gap-10" style="cursor:pointer" ' +
        'onclick="SoportePanel.alternarDetalle(\'' + id + '\')">' +
        '<div><div class="font-bold">' + escapar(i.titulo) + '</div>' +
        '<div class="text-gray text-sm">' + fecha(i.created_at) + '</div></div>' +
        '<div class="flex items-center gap-10">' + marca +
        '<span class="badge ' + clase + '">' + escapar(estado) + '</span></div>' +
        '</div>' +
        '<div class="mt-10" id="sp-detalle-' + id + '" hidden></div>' +
        '</div>');
    },

    alternarDetalle: function (ticketId) {
      var caja = $id('sp-detalle-' + ticketId);
      if (!caja) return;
      if (!caja.hidden) { caja.hidden = true; return; }
      caja.hidden = false;
      caja.innerHTML = '<p class="text-gray text-sm sp-texto">Cargando…</p>';
      window.SupportAPI.detalleIncidencia(ticketId)
        .then(function (d) {
          if ($id('sp-detalle-' + ticketId)) $id('sp-detalle-' + ticketId).innerHTML = SoportePanel._detalle(d);
          var respuestas = (d && d.respuestas) || [];
          if (respuestas.length) {
            window.SupportAPI.marcarLeida(ticketId, respuestas[respuestas.length - 1].fecha);
          }
          // Abrir la incidencia es ver su estado: a partir de aqui «Estado
          // actualizado» dejaria de avisar hasta que cambie otra vez.
          if (d && d.estado) window.SupportAPI.marcarEstadoVisto(ticketId, d.estado);
        })
        .catch(function (e) {
          if ($id('sp-detalle-' + ticketId)) {
            $id('sp-detalle-' + ticketId).innerHTML = '<p class="text-gray text-sm sp-texto">' +
              escapar((e && e.message) || 'No se pudo cargar la incidencia') + '</p>';
          }
        })
        .then(function () { refrescarNoLeidas(); });
    },

    _detalle: function (d) {
      if (!d) return '<p class="text-gray text-sm sp-texto">Sin datos.</p>';
      var filas = [
        ['Referencia', d.ticket_id],
        ['Estado', window.SupportAPI.textoEstado(d.estado)],
        ['Severidad', textoSeveridad(d.severidad)],
        ['Reportada', fecha(d.created_at)],
        ['Actualizada', fecha(d.updated_at)],
      ];
      if (d.cerrada_at) filas.push(['Resuelta', fecha(d.cerrada_at)]);
      if (d.confirmada_at) filas.push(['Confirmada por ti', fecha(d.confirmada_at)]);
      var explicacion = window.SupportAPI.EXPLICACION_ESTADOS[d.estado];
      return (
        '<div class="sp-detalle" style="border-top:1px solid var(--border);padding-top:10px">' +
        filas.filter(function (f) { return f[1]; }).map(function (f) {
          return '<div class="flex justify-between gap-10 text-sm mb-5">' +
            '<span class="text-gray">' + escapar(f[0]) + '</span>' +
            '<span>' + escapar(String(f[1])) + '</span></div>';
        }).join('') +
        (explicacion ? '<p class="text-gray text-sm mt-10 sp-texto">' + escapar(explicacion) + '</p>' : '') +
        SoportePanel._hilo(d) +
        '</div>');
    },

    _hilo: function (d) {
      var respuestas = (d && d.respuestas) || [];
      if (!respuestas.length) {
        return (
          '<p class="text-gray text-sm mt-10 sp-texto">' +
          (d.estado === 'resuelta'
            ? 'El equipo ha dado esta incidencia por resuelta.'
            : 'Cuando el equipo responda, lo verás aquí.') +
          '</p>' + SoportePanel._formulario(d));
      }
      return (
        '<div class="mt-15"><div class="text-gray text-sm mb-10">Respuestas</div>' +
        respuestas.map(function (r) { return SoportePanel._mensaje(r); }).join('') +
        '</div>' + SoportePanel._formulario(d));
    },

    _mensaje: function (r) {
      var texto = escapar(r.texto).replace(/\n/g, '<br>');
      var deIA = r.autor === 'ia';
      var mio = r.autor === 'usuario';
      var quien = mio ? 'Tú' : deIA ? 'Asistente automático' : 'Equipo';
      var borde = r.cierre
        ? 'var(--c-success)'
        : mio
          ? 'var(--c-info)'
          : deIA
            ? 'var(--border)'
            : 'rgba(255,255,255,0.15)';
      return (
        '<div class="mb-10 p-10" style="background:var(--surface-light);border-radius:8px;' +
        'border-left:3px solid ' + borde + '">' +
        '<div class="text-gray text-sm mb-5">' + (r.cierre ? 'Cierre · ' : '') + escapar(quien) +
        ' · ' + escapar(fechaHora(r.fecha)) + '</div>' +
        '<div class="text-sm">' + texto + '</div></div>');
    },

    _formulario: function (d) {
      var id = escapar(d.ticket_id);
      if (d.confirmada_at) {
        return '<p class="text-gray text-sm mt-15 sp-texto">Confirmaste que quedó ' +
          'resuelta. Si vuelve a pasarte, cuéntanoslo en una incidencia nueva.</p>';
      }
      var pendiente = d.estado === 'resuelta' && !d.confirmada_at;
      var pregunta = pendiente
        ? '<div class="mt-15"><div class="text-sm mb-5">¿Se ha resuelto tu problema?</div>' +
          '<button class="btn btn-primary btn--inline" type="button" data-confirmar="' + id + '" ' +
          'onclick="SoportePanel.confirmarResolucion(\'' + id + '\')">Sí, ya funciona</button>' +
          '<div class="text-gray text-sm mt-10 sp-texto">Si sigue fallando, cuéntanoslo ' +
          'aquí abajo y la volveremos a mirar.</div></div>'
        : '';
      return (
        pregunta +
        '<div class="mt-15" data-responder="' + id + '">' +
        '<textarea id="sp-mensaje-' + id + '" rows="3" maxlength="2000" class="form-input" style="resize:vertical" ' +
        'placeholder="' + (pendiente ? 'Cuéntanos qué sigue fallando…' : 'Escribe aquí si quieres añadir algo…') + '"></textarea>' +
        '<div class="sp-aviso" id="sp-aviso-' + id + '"></div>' +
        '<button class="btn btn-secondary btn--inline mt-5" type="button" ' +
        'onclick="SoportePanel.enviarMensaje(\'' + id + '\')">' +
        (pendiente ? 'No, sigue fallando' : 'Enviar') + '</button></div>');
    },

    verMisIncidencias: function () {
      this._setVista('listado');
    },

    verFormulario: function () {
      this._setVista('nueva');
    },

    recargarListado: function () {
      this._cargarListado();
    },

    /** Paso 1: pide el borrador estructurado a la IA. */
    pedirBorrador: function () {
      var campo = $id('sp-descripcion');
      var texto = (campo && campo.value ? campo.value : '').trim();
      if (texto.length < 10) {
        App.toastError('Cuenta un poco más para poder ayudarte');
        return;
      }
      if (this._enviando) return;
      this._enviando = true;
      this._deshabilitar('sp-btn-continuar', 'Preparando…');
      window.SupportAPI.pedirBorrador(texto, window.SupportAPI.contextoActual())
        .then(function (datos) {
          _borrador = datos.borrador;
          _paso = 'borrador';
        })
        .catch(function (e) { SoportePanel._manejarError(e); })
        .then(function () {
          SoportePanel._enviando = false;
          SoportePanel._renderCuerpo();
        });
    },

    /** Paso 2: confirma y registra la incidencia. */
    confirmar: function () {
      if (this._enviando || !_borrador) return;
      var titulo = $id('sp-borrador-titulo');
      var descripcion = $id('sp-borrador-descripcion');
      if (titulo) _borrador.titulo = titulo.value;
      if (descripcion) _borrador.descripcion = descripcion.value;
      var pasos = Array.prototype.map.call(
        document.querySelectorAll('#sp-cuerpo [data-paso]'),
        function (i) { return i.value.trim(); }
      ).filter(function (p) { return p.length; });
      _borrador.pasos_reproduccion = pasos;
      this._enviando = true;
      this._deshabilitar('sp-btn-enviar', 'Enviando…');
      window.SupportAPI.confirmarIncidencia(_borrador, window.SupportAPI.contextoActual())
        .then(function () { _paso = 'enviado'; _borrador = null; })
        .catch(function (e) { SoportePanel._manejarError(e); })
        .then(function () {
          SoportePanel._enviando = false;
          SoportePanel._renderCuerpo();
          refrescarNoLeidas();
        });
    },

    enviarMensaje: function (ticketId) {
      var campo = $id('sp-mensaje-' + ticketId);
      var aviso = $id('sp-aviso-' + ticketId);
      var boton = document.querySelector('[data-responder="' + ticketId + '"] button');
      if (!campo) return;
      var texto = (campo.value || '').trim();
      if (!texto) { if (aviso) aviso.textContent = 'Escribe algo antes de enviar.'; return; }
      if (boton) { boton.disabled = true; boton.textContent = 'Enviando…'; }
      if (aviso) aviso.textContent = '';
      window.SupportAPI.responderIncidencia(ticketId, texto)
        .then(function () { return window.SupportAPI.detalleIncidencia(ticketId); })
        .then(function (d) {
          if ($id('sp-detalle-' + ticketId)) $id('sp-detalle-' + ticketId).innerHTML = SoportePanel._detalle(d);
          var respuestas = (d && d.respuestas) || [];
          if (respuestas.length) window.SupportAPI.marcarLeida(ticketId, respuestas[respuestas.length - 1].fecha);
          refrescarNoLeidas();
        })
        .catch(function (e) {
          if (aviso) aviso.textContent = (e && e.message) || 'No se pudo enviar el mensaje.';
          if (boton) { boton.disabled = false; boton.textContent = 'Enviar'; }
        });
    },

    confirmarResolucion: function (ticketId) {
      var boton = document.querySelector('[data-confirmar="' + ticketId + '"]');
      var aviso = $id('sp-aviso-' + ticketId);
      if (boton) { boton.disabled = true; boton.textContent = 'Confirmando…'; }
      if (aviso) aviso.textContent = '';
      window.SupportAPI.confirmarResolucion(ticketId)
        .then(function () { return window.SupportAPI.detalleIncidencia(ticketId); })
        .then(function (d) {
          if ($id('sp-detalle-' + ticketId)) $id('sp-detalle-' + ticketId).innerHTML = SoportePanel._detalle(d);
          refrescarNoLeidas();
        })
        .catch(function (e) {
          if (aviso) aviso.textContent = (e && e.message) || 'No se pudo confirmar.';
          if (boton) { boton.disabled = false; boton.textContent = 'Sí, ya funciona'; }
        });
    },

    comprar: function () {
      if (!window.PurchaseManager || !window.PurchaseManager.comprarSoporte) {
        App.toastError('La compra de soporte no está disponible en esta versión');
        return;
      }
      window.PurchaseManager.comprarSoporte()
        .then(function () { return SoportePanel._trasCompra(); })
        .catch(function () { App.toastError('La compra de soporte no se completó'); });
    },

    restaurar: function () {
      if (!window.PurchaseManager || !window.PurchaseManager.restaurarSoporte) {
        App.toastError('No se puede restaurar la licencia en esta versión');
        return;
      }
      window.PurchaseManager.restaurarSoporte()
        .then(function () { return SoportePanel._trasCompra(); })
        .catch(function () { App.toastError('No se pudo restaurar la licencia'); });
    },

    _trasCompra: function () {
      var estado = leerEstadoPanel();
      // Si la última vez se usó maximizada, se recupera ese tamaño en vez de
      // perderlo al reabrir tras la compra.
      if (estado === 'max') _maximizado = true;
      if (estado !== 'open') this.abrir();
      this._setVista('nueva');
    },

    _manejarError: function (e) {
      if (e && e.codigo === 'LIMITE_DIARIO') {
        App.toastError('Has alcanzado el límite de incidencias por hoy');
        return;
      }
      if (e && (e.codigo === 'LICENCIA_INACTIVA' || e.codigo === 'LICENCIA_CADUCADA')) {
        _paso = 'formulario';
        App.toastError('Tu licencia de soporte no está activa');
        return;
      }
      App.toastError((e && e.message) || 'No se pudo completar la operación');
    },

    _deshabilitar: function (id, texto) {
      var b = $id(id);
      if (!b) return;
      b.disabled = true;
      b.textContent = texto;
    },
  };

  window.SoportePanel = SoportePanel;

  // Montaje automático: cuando el pie ya existe (sidebar ERP creado), se pinta
  // el bloque «Soporte»; si llega más tarde (app.js lo genera bajo demanda) se
  // espera a que exista #sidebarStatus.
  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('sidebarStatus')) SoportePanel.montarPie();
  });

  // El estado de licencia y las respuestas cambian con la app o con la compra:
  // se refresca el pie y el contador cuando el shell anuncia cambios.
  window.addEventListener('fincaChanged', function () { SoportePanel.montarPie(); });
  window.addEventListener('premiumChanged', function () { SoportePanel.montarPie(); });
})();
