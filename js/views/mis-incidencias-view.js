/**
 * Livestock Manager - MisIncidenciasView v1.2.0
 *
 * Listado de las incidencias propias, con su estado y con las respuestas del
 * equipo. El usuario nunca ve GitHub: aqui solo hay incidencias con estado en
 * espanol y mensajes, no issues ni comentarios.
 *
 * No exige licencia activa: quien la deja caducar sigue viendo lo que reporto
 * y lo que le han contestado, aunque no pueda abrir nada nuevo.
 *
 * El estado de «leido» y los textos de estado viven en SupportAPI, no aqui:
 * los comparte con el aviso de arranque.
 */

const MisIncidenciasView = {
  _cargando: false,

  async render() {
    const main = document.getElementById('app-content');

    if (!window.SupportAPI || !window.SupportAPI.tieneSesion()) {
      main.innerHTML = `
        ${this._cabecera()}
        <div class="card p-20 mt-10">
          <p class="text-gray mt-10">Entra en Soporte para ver tus incidencias.</p>
          <fieldset class="erp-action-group erp-action-group--centro mt-20">
            <legend>Soporte</legend>
            <div class="erp-action-group-body">
              <button class="btn btn-primary btn--inline" onclick="location.hash='#/soporte'">Ir a Soporte</button>
            </div>
          </fieldset>
        </div>`;
      return;
    }

    main.innerHTML = `
      ${this._cabecera()}
      <div class="card p-20 mt-10">
        <div id="incidencias-lista" class="mt-10">
          <p class="text-gray">Cargando…</p>
        </div>
        <fieldset class="erp-action-group erp-action-group--centro mt-20">
          <legend>Acciones</legend>
          <div class="erp-action-group-body">
            <button class="btn btn-primary btn--inline" onclick="location.hash='#/soporte'">
              Contar una incidencia
            </button>
            <button class="btn btn-secondary btn--inline" onclick="MisIncidenciasView.recargar()">
              Actualizar
            </button>
          </div>
        </fieldset>
      </div>
      ${this._ayuda()}`;

    await this._cargar();
  },

  /**
   * Volver a Ajustes, que es de donde se llega. Es un destino fijo y no
   * history.back() a proposito: tras confirmar una incidencia se aterriza aqui
   * desde Soporte, y retroceder devolveria al formulario recien enviado.
   */
  _cabecera() {
    return `
      <div class="p-16 mb-20">
        <a href="#/ajustes" class="link-back">← Volver a Ajustes</a>
        <h2 class="mt-10 font-900 uppercase tracking-wider text-white">
          <span style="color: var(--neon);">|</span> MIS INCIDENCIAS
        </h2>
      </div>`;
  },

  /**
   * Que significa cada estado y que se espera del usuario. Va al pie y
   * plegado: estorba a quien ya lo sabe, pero sin ello la primera vez no hay
   * forma de saber si «Enviada» durante dos dias es normal o es un fallo.
   */
  _ayuda() {
    const estados = window.SupportAPI.ESTADOS;
    const expl = window.SupportAPI.EXPLICACION_ESTADOS;
    const filas = Object.keys(estados)
      .map(
        (clave) => `
        <div class="flex gap-10 items-start mb-10">
          <span class="badge ${this._claseEstado(clave)}" style="flex:0 0 auto">${estados[clave]}</span>
          <span class="text-sm text-gray">${expl[clave] || ''}</span>
        </div>`,
      )
      .join('');

    return `
      <details class="card p-20 mt-10">
        <summary class="font-bold" style="cursor:pointer">Cómo funciona el soporte</summary>
        <div class="mt-15">
          ${filas}
          <div class="text-sm text-gray mt-15" style="border-top:1px solid rgba(255,255,255,0.10); padding-top:10px">
            <p class="mb-5">
              · Toca una incidencia para ver los detalles y las respuestas del equipo.
            </p>
            <p class="mb-5">
              · Cuando haya respuesta verás el aviso <b>Respuesta nueva</b> en la fila.
            </p>
            <p class="mb-5">
              · Si te piden más datos, cuéntalos abriendo una incidencia nueva y menciona
              la referencia de esta; así no se pierde el hilo.
            </p>
            <p class="mb-5">
              · Las respuestas llegan a este listado, no por correo. Consulta cada pocos días.
            </p>
            <p>
              · Lo enviado incluye la versión de la app y el modelo del móvil. Nunca se
              envían tus datos de animales ni de la explotación.
            </p>
          </div>
        </div>
      </details>`;
  },

  async recargar() {
    const contenedor = document.getElementById('incidencias-lista');
    if (contenedor) contenedor.innerHTML = '<p class="text-gray">Cargando…</p>';
    await this._cargar();
  },

  async _cargar() {
    if (this._cargando) return;
    this._cargando = true;
    const contenedor = document.getElementById('incidencias-lista');

    try {
      const incidencias = await window.SupportAPI.listarIncidencias();
      if (!contenedor) return;

      if (!incidencias.length) {
        contenedor.innerHTML = `
          <p class="text-gray">
            Todavía no has reportado nada. Cuando lo hagas, aparecerá aquí con su estado.
          </p>`;
        return;
      }

      contenedor.innerHTML = incidencias.map((i) => this._fila(i)).join('');
    } catch (e) {
      if (contenedor) {
        contenedor.innerHTML = `<p class="text-gray">${this._escapar(
          (e && e.message) || 'No se pudieron cargar las incidencias',
        )}</p>`;
      }
    } finally {
      this._cargando = false;
    }
  },

  _fila(incidencia) {
    const estado = window.SupportAPI.textoEstado(incidencia.estado);
    const clase = this._claseEstado(incidencia.estado);
    const id = this._escapar(incidencia.ticket_id);
    const nuevas = window.SupportAPI.tieneRespuestaNueva(incidencia);
    const cuantas = incidencia.respuestas || 0;

    // El aviso va en la fila, no dentro del detalle: si hubiera que desplegar
    // para enterarse de que hay respuesta, no serviria de aviso.
    const marca = nuevas
      ? '<span class="badge badge-success">Respuesta nueva</span>'
      : cuantas
        ? `<span class="text-gray text-sm">${cuantas} ${cuantas === 1 ? 'respuesta' : 'respuestas'}</span>`
        : '';

    return `
      <div class="card-registro mb-10" data-ticket="${id}">
        <div class="flex items-center justify-between gap-10"
             style="cursor:pointer"
             onclick="MisIncidenciasView.alternarDetalle('${id}')">
          <div>
            <div class="font-bold">${this._escapar(incidencia.titulo)}</div>
            <div class="text-gray text-sm">${this._fecha(incidencia.created_at)}</div>
          </div>
          <div class="flex items-center gap-10">
            ${marca}
            <span class="badge ${clase}">${estado}</span>
          </div>
        </div>
        <div class="mt-10" id="detalle-${id}" hidden></div>
      </div>`;
  },

  /**
   * Abre o cierra el detalle. Muestra los metadatos y el hilo de respuestas
   * del equipo; la descripcion original no se guarda en el backend, vive en el
   * issue, y el usuario ya sabe lo que escribio.
   *
   * Se pide al servidor cada vez que se abre: antes se cacheaba porque los
   * metadatos no cambiaban, pero ahora puede haber llegado una respuesta y
   * ensenar una copia vieja seria justo el fallo que esta pantalla existe para
   * evitar.
   */
  async alternarDetalle(ticketId) {
    const caja = document.getElementById('detalle-' + ticketId);
    if (!caja) return;

    if (!caja.hidden) {
      caja.hidden = true;
      return;
    }

    caja.hidden = false;
    caja.innerHTML = '<p class="text-gray text-sm">Cargando…</p>';

    try {
      const d = await window.SupportAPI.detalleIncidencia(ticketId);
      caja.innerHTML = this._detalle(d);

      // Abrir el detalle es leerlo: se marca la ultima respuesta como vista y
      // se quita el aviso de la fila.
      const respuestas = (d && d.respuestas) || [];
      if (respuestas.length) {
        window.SupportAPI.marcarLeida(ticketId, respuestas[respuestas.length - 1].fecha);
        const fila = document.querySelector(`[data-ticket="${ticketId}"] .badge-success`);
        if (fila && fila.textContent === 'Respuesta nueva') fila.remove();
      }
    } catch (e) {
      caja.innerHTML = `<p class="text-gray text-sm">${this._escapar(
        (e && e.message) || 'No se pudo cargar la incidencia',
      )}</p>`;
    }
  },

  /**
   * Envia un mensaje del usuario a la incidencia.
   *
   * Al terminar se recarga el detalle en vez de pintar el mensaje a mano: el
   * servidor puede haber recortado el texto al limpiarlo, y ensenar aqui algo
   * distinto de lo que ha quedado guardado confundiria mas que ayudar.
   */
  async enviarMensaje(ticketId) {
    const campo = document.getElementById('mensaje-' + ticketId);
    const aviso = document.getElementById('aviso-' + ticketId);
    const boton = document.querySelector(
      '[data-responder="' + ticketId + '"] button'
    );
    if (!campo) return;

    const texto = (campo.value || '').trim();
    if (!texto) {
      if (aviso) aviso.textContent = 'Escribe algo antes de enviar.';
      return;
    }

    if (boton) {
      boton.disabled = true;
      boton.textContent = 'Enviando…';
    }
    if (aviso) aviso.textContent = '';

    try {
      await window.SupportAPI.responderIncidencia(ticketId, texto);
      const d = await window.SupportAPI.detalleIncidencia(ticketId);
      const caja = document.getElementById('detalle-' + ticketId);
      if (caja) caja.innerHTML = this._detalle(d);
      const respuestas = (d && d.respuestas) || [];
      if (respuestas.length) {
        window.SupportAPI.marcarLeida(ticketId, respuestas[respuestas.length - 1].fecha);
      }
    } catch (e) {
      // El texto se deja en el campo: si el envio ha fallado, lo ultimo que
      // debe pasar es que el usuario pierda lo que habia escrito.
      if (aviso) {
        aviso.textContent = (e && e.message) || 'No se pudo enviar el mensaje.';
      }
      if (boton) {
        boton.disabled = false;
        boton.textContent = 'Enviar';
      }
    }
  },

  _detalle(d) {
    if (!d) return '<p class="text-gray text-sm">Sin datos.</p>';
    const filas = [
      ['Referencia', d.ticket_id],
      ['Estado', window.SupportAPI.textoEstado(d.estado)],
      ['Severidad', this._textoSeveridad(d.severidad)],
      ['Reportada', this._fecha(d.created_at)],
      ['Actualizada', this._fecha(d.updated_at)],
    ];
    if (d.cerrada_at) filas.push(['Resuelta', this._fecha(d.cerrada_at)]);
    if (d.confirmada_at) filas.push(['Confirmada por ti', this._fecha(d.confirmada_at)]);

    const explicacion = window.SupportAPI.EXPLICACION_ESTADOS[d.estado];

    return `
      <div class="detalle-incidencia"
           style="border-top:1px solid rgba(255,255,255,0.10); padding-top:10px">
        ${filas
          .filter(([, v]) => v)
          .map(
            ([k, v]) => `
          <div class="flex justify-between gap-10 text-sm mb-5">
            <span class="text-gray">${k}</span>
            <span>${this._escapar(v)}</span>
          </div>`,
          )
          .join('')}
        ${explicacion ? `<p class="text-gray text-sm mt-10">${explicacion}</p>` : ''}
        ${this._hilo(d)}
      </div>`;
  },

  /** Respuestas a la incidencia, de la mas antigua a la mas reciente. */
  _hilo(d) {
    const respuestas = (d && d.respuestas) || [];

    if (!respuestas.length) {
      return `
        <p class="text-gray text-sm mt-10">
          ${
            d.estado === 'resuelta'
              ? 'El equipo ha dado esta incidencia por resuelta.'
              : 'Cuando el equipo responda, lo verás aquí.'
          }
        </p>
        ${this._formulario(d)}`;
    }

    return `
      <div class="mt-15">
        <div class="text-gray text-sm mb-10">Respuestas</div>
        ${respuestas.map((r) => this._mensaje(r)).join('')}
      </div>
      ${this._formulario(d)}`;
  },

  /**
   * Campo para escribir en la incidencia.
   *
   * Existe porque el asistente automático pide datos («cuéntanos también…») y
   * hasta ahora no había forma de dárselos: el usuario leía una pregunta que
   * no podía contestar. Se ofrece también en las resueltas: si el arreglo no
   * funcionó, decirlo en la misma incidencia es mejor que abrir otra.
   */
  _formulario(d) {
    const id = this._escapar(d.ticket_id);

    // Una incidencia que el usuario ya ha dado por buena está cerrada por
    // acuerdo de las dos partes, así que no se ofrece seguir escribiendo:
    // dejar el campo ahí invita a reabrir una conversación terminada. Si el
    // fallo reaparece, lo suyo es una incidencia nueva, que llega al equipo
    // con su propio análisis en vez de colgando de un hilo ya resuelto.
    if (d.confirmada_at) {
      return `
        <p class="text-gray text-sm mt-15">
          Confirmaste que quedó resuelta. Si vuelve a pasarte, cuéntanoslo en
          una incidencia nueva.
        </p>`;
    }

    // Una incidencia que el equipo ha marcado como resuelta pero que el
    // usuario todavía no ha dado por buena es una propuesta, no un cierre:
    // aquí se le pregunta. El «sí» cierra la incidencia de verdad; el «no» es
    // un mensaje normal, y el servidor la devuelve a «en revisión» al
    // recibirlo. Sin esta pregunta, decir que algo está arreglado cuando no lo
    // está no le costaba nada a nadie y el usuario se quedaba sin salida.
    const pendienteDeConfirmar = d.estado === 'resuelta' && !d.confirmada_at;

    const pregunta = pendienteDeConfirmar
      ? `
        <div class="mt-15">
          <div class="text-sm mb-5">¿Se ha resuelto tu problema?</div>
          <button class="btn btn-primary btn--inline" data-confirmar="${id}"
                  onclick="MisIncidenciasView.confirmarResolucion('${id}')">Sí, ya funciona</button>
          <div class="text-gray text-sm mt-10">
            Si sigue fallando, cuéntanoslo aquí abajo y la volveremos a mirar.
          </div>
        </div>`
      : '';

    return `
      ${pregunta}
      <div class="mt-15" data-responder="${id}">
        <textarea id="mensaje-${id}" rows="3" maxlength="2000"
                  class="form-input" style="resize:vertical"
                  placeholder="${
                    pendienteDeConfirmar
                      ? 'Cuéntanos qué sigue fallando…'
                      : 'Escribe aquí si quieres añadir algo…'
                  }"></textarea>
        <div class="text-gray text-sm mt-5" id="aviso-${id}"></div>
        <button class="btn btn-secondary btn--inline mt-5"
                onclick="MisIncidenciasView.enviarMensaje('${id}')">${
                  pendienteDeConfirmar ? 'No, sigue fallando' : 'Enviar'
                }</button>
      </div>`;
  },

  /**
   * El usuario da por buena la solución.
   *
   * Recarga el detalle en vez de repintar a mano porque la confirmación cierra
   * la incidencia en el servidor y conviene enseñar exactamente lo que ha
   * quedado guardado.
   */
  async confirmarResolucion(ticketId) {
    const boton = document.querySelector('[data-confirmar="' + ticketId + '"]');
    const aviso = document.getElementById('aviso-' + ticketId);
    if (boton) {
      boton.disabled = true;
      boton.textContent = 'Confirmando…';
    }
    if (aviso) aviso.textContent = '';

    try {
      await window.SupportAPI.confirmarResolucion(ticketId);
      const d = await window.SupportAPI.detalleIncidencia(ticketId);
      const caja = document.getElementById('detalle-' + ticketId);
      if (caja) caja.innerHTML = this._detalle(d);
    } catch (e) {
      if (aviso) {
        aviso.textContent = (e && e.message) || 'No se pudo confirmar.';
      }
      if (boton) {
        boton.disabled = false;
        boton.textContent = 'Sí, ya funciona';
      }
    }
  },

  _mensaje(r) {
    // El texto llega de GitHub en Markdown. No se interpreta: se escapa y se
    // respetan los saltos de linea. Renderizar Markdown aqui significaria
    // meter HTML de terceros en la pantalla del usuario a cambio de casi nada.
    const texto = this._escapar(r.texto).replace(/\n/g, '<br>');

    // Quien responde se dice siempre. Un primer analisis automatico y la
    // respuesta de una persona no valen lo mismo, y confundirlos deja al
    // usuario esperando a alguien que todavia no ha entrado. Las respuestas
    // anteriores al asistente no traen `autor`: eran todas del equipo.
    const deIA = r.autor === 'ia';
    const mio = r.autor === 'usuario';
    const quien = mio ? 'Tú' : deIA ? 'Asistente automático' : 'Equipo';
    const borde = r.cierre
      ? 'var(--color-success, #7cc00b)'
      : mio
        ? 'var(--color-primary, #a3e635)'
        : deIA
          ? 'rgba(255,255,255,0.10)'
          : 'rgba(255,255,255,0.15)';

    return `
      <div class="mb-10 p-10"
           style="background:rgba(255,255,255,0.04); border-radius:8px;
                  border-left:3px solid ${borde}">
        <div class="text-gray text-sm mb-5">
          ${r.cierre ? 'Cierre · ' : ''}${quien} · ${this._fechaHora(r.fecha)}
        </div>
        <div class="text-sm">${texto}</div>
      </div>`;
  },

  _fechaHora(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  },

  _textoSeveridad(sev) {
    if (sev === 'alta') return 'Alta';
    if (sev === 'media') return 'Media';
    if (sev === 'baja') return 'Baja';
    return sev || '';
  },

  _claseEstado(estado) {
    // Los cinco estados con color propio. Antes `enviada` y `analizada`
    // devolvian cadena vacia: la incidencia recien enviada y la que ya esta en
    // manos del equipo se veian igual que cualquier otra.
    if (estado === 'resuelta') return 'badge-success';
    if (estado === 'curso') return 'badge-purple';
    if (estado === 'revision') return 'badge-warning';
    if (estado === 'analizada') return 'badge-info';
    if (estado === 'enviada') return 'badge-gray';
    return '';
  },

  _fecha(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return '';
    }
  },

  _escapar(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

window.MisIncidenciasView = MisIncidenciasView;
