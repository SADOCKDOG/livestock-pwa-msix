/**
 * Livestock Manager - ZonasView v1.0.0
 * Vista de Zonas/Parcelas extraída de App.js para modularización.
 * Copia espejo de js/views/zonas-view.js
 */

const ZonasView = {
  _cache: [],
  _vistaModo: 'cards',

  _normalizarClaveZona(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  },

  _asegurarIdsZonas(finca, idsReservados = []) {
    if (!finca || !Array.isArray(finca.zonas)) return [];
    const idsExistentes = new Set();
    for (const zona of finca.zonas) {
      if (!zona || zona.id == null || zona.id === '') continue;
      const id = Number(zona.id);
      if (!Number.isInteger(id) || id < 1) {
        throw new Error(`El ID de la zona «${zona.nombre || 'sin nombre'}» no es válido; no se cambiará automáticamente.`);
      }
      if (idsExistentes.has(id)) {
        throw new Error(`Hay más de una zona con el ID ${id}; no se modificará ninguna relación automáticamente.`);
      }
      zona.id = id;
      idsExistentes.add(id);
    }
    const idsOcupados = new Set([...idsExistentes, ...idsReservados.map(Number).filter((id) => Number.isInteger(id) && id > 0)]);
    let siguienteId = Math.max(0, ...idsOcupados) + 1;
    for (const zona of finca.zonas) {
      if (!zona || (zona.id != null && zona.id !== '')) continue;
      while (idsOcupados.has(siguienteId)) siguienteId++;
      zona.id = siguienteId;
      idsExistentes.add(siguienteId);
      idsOcupados.add(siguienteId++);
    }
    return finca.zonas;
  },

  async _asegurarIdsZonasYRelaciones(finca, opciones = {}) {
    if (!finca || !Array.isArray(finca.zonas)) return { cambiosIds: false, rebanosActualizados: [] };
    // Evitar que el fallback en memoria aplique mutaciones previas a persistir.
    finca.zonas = finca.zonas.map((zona) => zona ? { ...zona } : zona);
    const db = await window.dbPromise;
    const rebanos = finca.id != null
      ? await db.getAllFromIndex('rebanos', 'fincaId', finca.id).catch(() => [])
      : [];
    const idsAntes = finca.zonas.map((zona) => zona?.id);
    const idsExistentes = new Set();
    for (const zona of finca.zonas) {
      if (!zona || zona.id == null || zona.id === '') continue;
      const id = Number(zona.id);
      if (!Number.isInteger(id) || id < 1) throw new Error(`El ID de la zona «${zona.nombre || 'sin nombre'}» no es válido.`);
      if (idsExistentes.has(id)) throw new Error(`Hay más de una zona con el ID ${id}; revisa las relaciones manualmente.`);
      idsExistentes.add(id);
      zona.id = id;
    }
    const normalizarNombre = (nombre) => this._normalizarClaveZona(nombre);
    const zonasPorNombre = new Map();
    for (const zona of finca.zonas) {
      const clave = normalizarNombre(zona?.nombre);
      if (!clave) continue;
      if (!zonasPorNombre.has(clave)) zonasPorNombre.set(clave, []);
      zonasPorNombre.get(clave).push(zona);
    }

    // Reutilizar un zonaId legado huérfano solo si nombre e ID apuntan a una
    // única zona. Los croquis no se usan para inferir propietario por índice.
    const idsPorNombre = new Map();
    const nombresPorId = new Map();
    for (const rebano of rebanos) {
      if (rebano?.zonaId == null || rebano.zonaId === '') continue;
      const id = Number(rebano.zonaId);
      const nombre = normalizarNombre(rebano.zonaActual);
      if (!Number.isInteger(id) || id < 1 || !nombre || idsExistentes.has(id)) continue;
      if (!idsPorNombre.has(nombre)) idsPorNombre.set(nombre, new Set());
      idsPorNombre.get(nombre).add(id);
      if (!nombresPorId.has(id)) nombresPorId.set(id, new Set());
      nombresPorId.get(id).add(nombre);
    }
    for (const [nombre, zonas] of zonasPorNombre) {
      const zona = zonas.find((item) => item.id == null || item.id === '');
      if (!zona) continue;
      const candidatos = [...(idsPorNombre.get(nombre) || [])];
      if (!candidatos.length) continue;
      if (zonas.length !== 1 || candidatos.length !== 1 || nombresPorId.get(candidatos[0])?.size !== 1) {
        throw new Error(`No se pueden resolver automáticamente las relaciones heredadas de «${zona.nombre}»; revisa la zona y los rebaños.`);
      }
      zona.id = candidatos[0];
      idsExistentes.add(candidatos[0]);
    }

    const zonaIdsReferenciados = rebanos.map((rebano) => Number(rebano?.zonaId)).filter((id) => Number.isInteger(id) && id > 0);
    this._asegurarIdsZonas(finca, zonaIdsReferenciados);
    const cambiosIds = finca.zonas.some((zona, i) => zona?.id !== idsAntes[i]);
    const rebanosActualizados = rebanos.filter((rebano) =>
      rebano && (rebano.zonaId == null || rebano.zonaId === '') && normalizarNombre(rebano.zonaActual)
    ).map((rebano) => {
      const matches = zonasPorNombre.get(normalizarNombre(rebano.zonaActual)) || [];
      return matches.length === 1 && !matches[0].anulada && matches[0].id != null
        ? { ...rebano, zonaId: Number(matches[0].id) }
        : null;
    }).filter(Boolean);

    if (opciones.persist !== false && (cambiosIds || rebanosActualizados.length)) {
      const fincaOriginal = cambiosIds ? await db.get('fincas', finca.id) : null;
      const rebanosOriginales = db.constructor?.name === 'InMemoryMockDB' ? rebanos.map((rebano) => ({ ...rebano })) : [];
      if (typeof db.transaction === 'function') {
        const tx = db.transaction(['fincas', 'rebanos'], 'readwrite');
        try {
          const escrituras = [];
          if (cambiosIds) escrituras.push(Fincas.save(finca, { transaction: tx }));
          escrituras.push(...rebanosActualizados.map((rebano) => tx.objectStore('rebanos').put(rebano)));
          await Promise.all(escrituras);
          await tx.done;
        } catch (error) {
          try { tx.abort(); } catch (_) { /* el mock puede no implementar abort */ }
          try { await tx.done; } catch (_) { /* esperar al rollback IndexedDB */ }
          if (db.constructor?.name === 'InMemoryMockDB') {
            if (fincaOriginal) await db.put('fincas', fincaOriginal);
            for (const rebano of rebanosOriginales) await db.put('rebanos', rebano);
          }
          throw error;
        }
      } else {
        if (cambiosIds) await Fincas.save(finca);
        for (const rebano of rebanosActualizados) await db.put('rebanos', rebano);
      }
    }
    return { cambiosIds, rebanosActualizados };
  },

  _resolverRelacionesLegacyZonas(finca, rebanos) {
    const zonas = Array.isArray(finca?.zonas) ? finca.zonas : [];
    const normalizarNombre = (nombre) => this._normalizarClaveZona(nombre);
    const zonasPorNombre = new Map();
    for (const zona of zonas) {
      const clave = normalizarNombre(zona?.nombre);
      if (!clave) continue;
      if (!zonasPorNombre.has(clave)) zonasPorNombre.set(clave, []);
      zonasPorNombre.get(clave).push(zona);
    }
    const idsPorNombre = new Map();
    const nombresPorId = new Map();
    const idsOcupados = new Set(zonas.map((zona) => Number(zona?.id)).filter((id) => Number.isInteger(id) && id > 0));
    for (const rebano of rebanos || []) {
      if (rebano?.zonaId == null || rebano.zonaId === '') continue;
      const id = Number(rebano.zonaId);
      const nombre = normalizarNombre(rebano.zonaActual);
      if (!Number.isInteger(id) || id < 1 || !nombre || idsOcupados.has(id)) continue;
      if (!idsPorNombre.has(nombre)) idsPorNombre.set(nombre, new Set());
      idsPorNombre.get(nombre).add(id);
      if (!nombresPorId.has(id)) nombresPorId.set(id, new Set());
      nombresPorId.get(id).add(nombre);
    }
    for (const [nombre, zonasConNombre] of zonasPorNombre) {
      const zona = zonasConNombre.find((item) => item.id == null || item.id === '');
      if (!zona) continue;
      const candidatos = [...(idsPorNombre.get(nombre) || [])];
      if (!candidatos.length) continue;
      if (zonasConNombre.length !== 1 || candidatos.length !== 1 || nombresPorId.get(candidatos[0])?.size !== 1) {
        throw new Error(`No se pueden resolver automáticamente las relaciones heredadas de «${zona.nombre}»; revisa la zona y los rebaños.`);
      }
      zona.id = candidatos[0];
      idsOcupados.add(candidatos[0]);
    }
    return zonas;
  },

  _buscarCoincidenciasZona(zonas, datos = {}) {
    const activas = (Array.isArray(zonas) ? zonas : [])
      .map((zona, index) => ({ zona, index }))
      .filter(({ zona }) => zona && !zona.anulada);
    const referencia = this._normalizarClaveZona(datos.refCatastral);
    const codigoPac = this._normalizarClaveZona(datos.codigo_pac || datos.codigoPAC);
    const nombre = this._normalizarClaveZona(datos.nombre);

    const coincidencias = [];
    if (referencia) {
      coincidencias.push(...activas
        .filter(({ zona }) => this._normalizarClaveZona(zona.refCatastral) === referencia)
        .map((item) => ({ ...item, coincidencia: 'referencia catastral' })));
    }
    if (codigoPac) {
      coincidencias.push(...activas
        .filter(({ zona }) => this._normalizarClaveZona(zona.codigo_pac) === codigoPac)
        .map((item) => ({ ...item, coincidencia: 'código PAC' })));
    }
    const clavesParcela = new Set();
    const municipio = this._normalizarClaveZona(datos.municipio);
    const provincia = this._normalizarClaveZona(datos.provincia);
    if (municipio && provincia && datos.poligono != null && datos.parcela != null) {
      clavesParcela.add(`${provincia}|${municipio}|${this._normalizarClaveZona(datos.poligono)}|${this._normalizarClaveZona(datos.parcela)}`);
    }
    for (const { zona, index } of activas) {
      const municipioZona = this._normalizarClaveZona(zona.municipio);
      const provinciaZona = this._normalizarClaveZona(zona.provincia);
      if (!municipioZona || !provinciaZona || zona.poligono == null || zona.parcela == null) continue;
      const claveZona = `${provinciaZona}|${municipioZona}|${this._normalizarClaveZona(zona.poligono)}|${this._normalizarClaveZona(zona.parcela)}`;
      if (clavesParcela.has(claveZona)) coincidencias.push({ zona, index, coincidencia: 'municipio, polígono y parcela' });
    }
    if (coincidencias.length) {
      return coincidencias.filter((item, index, lista) =>
        lista.findIndex((otro) => item.zona.id != null && otro.zona.id != null
          ? Number(otro.zona.id) === Number(item.zona.id)
          : otro.index === item.index) === index
      );
    }
    if (nombre) {
      return activas
        .filter(({ zona }) => this._normalizarClaveZona(zona.nombre) === nombre)
        .map((item) => ({ ...item, coincidencia: 'nombre (revisar)' }));
    }
    return [];
  },

  _aplicarDatosCatastro(zonaExistente, datos, opciones = {}) {
    const zona = zonaExistente ? { ...zonaExistente } : {};
    const ahora = new Date().toISOString();
    const superficieHa = datos.superficie != null && Number.isFinite(Number(datos.superficie))
      ? Number(datos.superficie)
      : (datos.superficieGrafica != null && Number.isFinite(Number(datos.superficieGrafica))
        ? Number(datos.superficieGrafica) / 10000
        : null);
    const idExistente = zona.id;
    if (zonaExistente && (idExistente === null || idExistente === undefined || idExistente === '')) {
      throw new Error('La zona existente no tiene ID estable; no se actualizará automáticamente.');
    }
    if (zonaExistente && (!Number.isInteger(Number(idExistente)) || Number(idExistente) < 1)) {
      throw new Error('La zona existente tiene un ID no válido; no se actualizará automáticamente.');
    }
    if (zonaExistente) zona.id = Number(idExistente);
    else if (opciones.id != null) zona.id = opciones.id;
    if (opciones.id != null && zona.id !== opciones.id) {
      throw new Error('La actualización intentó cambiar el ID estable de una zona existente.');
    }
    if (zonaExistente && zona.id == null) throw new Error('No se pudo asignar un ID estable a la zona existente.');

    // Solo se reemplazan campos que el parser obtuvo. Un dato ausente en un PDF
    // no debe borrar un dato catastral previamente comprobado.
    const camposCatastro = {
      refCatastral: datos.refCatastral,
      poligono: datos.poligono,
      parcela: datos.parcela,
      paraje: datos.paraje,
      municipio: datos.municipio,
      provincia: datos.provincia,
      clase: datos.clase,
      superficieGrafica: datos.superficieGrafica,
      superficieCatastroHa: superficieHa,
      superficieConstruida: datos.superficieConstruida,
      anoConstruccion: datos.anoConstruccion,
      localizacionCatastro: datos.localizacion,
      usoPrincipalCatastro: datos.usoPrincipal
    };
    for (const [campo, valor] of Object.entries(camposCatastro)) {
      if (valor !== undefined && valor !== null && valor !== '') zona[campo] = valor;
    }
    if (Array.isArray(datos.cultivos) && (datos.cultivos.length || !zonaExistente)) zona.cultivos = datos.cultivos;
    if (Array.isArray(datos.construcciones) && (datos.construcciones.length || !zonaExistente)) zona.construcciones = datos.construcciones;
    zona.actualizadaEn = ahora;

    if (!zonaExistente && opciones.nombre) zona.nombre = opciones.nombre;
    if (!zonaExistente || !zona.usoPrincipal || zona.usoPrincipalOrigen === 'catastro') {
      zona.usoPrincipal = datos.usoPrincipal || zona.usoPrincipal || '';
      zona.usoPrincipalOrigen = zona.usoPrincipal ? 'catastro' : (zona.usoPrincipalOrigen || 'manual');
    }
    if (superficieHa != null && (!zonaExistente || zona.superficieOrigen === 'catastro')) {
      zona.superficie = superficieHa;
      zona.superficieOrigen = 'catastro';
    } else if (superficieHa != null && zonaExistente && zona.superficieOrigen !== 'manual' && zona.superficie != null) {
      // Las zonas antiguas no guardaban el origen. Una superficie ya existente
      // se trata como manual y no se sobrescribe por una importación catastral.
      zona.superficieOrigen = 'manual';
    }
    if (opciones.croquisId != null) {
      const historial = Array.isArray(zona.croquisHistorialIds) ? [...zona.croquisHistorialIds] : [];
      if (zona.croquisId != null && zona.croquisId !== opciones.croquisId && !historial.includes(zona.croquisId)) {
        historial.push(zona.croquisId);
      }
      zona.croquisHistorialIds = historial;
      zona.croquisId = opciones.croquisId;
    }
    if (opciones.nombre && !zonaExistente) zona.nombre = opciones.nombre;
    if (!zonaExistente) zona.creadaEn = ahora;
    return zona;
  },

  _elegirCoincidenciaManual(coincidencias, permitirCrear) {
    return new Promise((resolve) => {
      const modalId = `elegir-zona-duplicada-${Date.now()}`;
      const opciones = coincidencias.map(({ zona, index, coincidencia }, i) => `
        <label class="flex items-center gap-3 p-3 border-bottom-222 cursor-pointer">
          <input type="radio" name="zona-duplicada-opcion" value="${i}">
          <span>${zona.nombre || 'Zona sin nombre'} · ${coincidencia} · ID ${zona.id}</span>
        </label>
      `).join('');
      const html = `
        <div class="error-dialog">
          <div class="error-dialog-title">Posible zona duplicada</div>
          <div class="error-dialog-msg">Se encontraron una o varias coincidencias. Si actualizas, se conservarán su ID, nombre operativo, relaciones e historial.</div>
          <div class="max-h-60 overflow-auto">${opciones}</div>
          <div class="error-dialog-actions mt-10">
            ${permitirCrear ? '<button type="button" class="error-dialog-btn secondary" data-accion="crear">Crear zona nueva</button>' : ''}
            <button type="button" id="${modalId}-cancel" class="error-dialog-btn secondary" data-accion="cancelar">Cancelar</button>
            <button type="button" class="error-dialog-btn primary" data-accion="actualizar" disabled>Actualizar elegida</button>
          </div>
        </div>
      `;
      const overlay = ModalManager.show(modalId, html, { closeOnOverlayClick: false });
      let resuelta = false;
      const escapeHandler = (event) => {
        if (event.key === 'Escape' && !resuelta) cerrar({ accion: 'cancelar' });
      };
      const cerrar = (resultado) => {
        if (resuelta) return;
        resuelta = true;
        document.removeEventListener('keydown', escapeHandler);
        ModalManager.close(modalId);
        resolve(resultado);
      };
      const botonActualizar = overlay?.querySelector('[data-accion="actualizar"]');
      overlay?.querySelectorAll('input[name="zona-duplicada-opcion"]').forEach((radio) => {
        radio.addEventListener('change', () => { if (botonActualizar) botonActualizar.disabled = false; });
      });
      overlay?.querySelector('[data-accion="crear"]')?.addEventListener('click', () => cerrar({ accion: 'crear' }));
      overlay?.querySelector('[data-accion="cancelar"]')?.addEventListener('click', () => cerrar({ accion: 'cancelar' }));
      botonActualizar?.addEventListener('click', () => {
        const seleccion = overlay.querySelector('input[name="zona-duplicada-opcion"]:checked');
        if (seleccion) cerrar({ accion: 'actualizar', index: Number(seleccion.value) });
      });
      document.addEventListener('keydown', escapeHandler);
      if (overlay) {
        const observer = new MutationObserver(() => {
          if (!overlay.isConnected) {
            observer.disconnect();
            cerrar({ accion: 'cancelar' });
          }
        });
        if (overlay.parentNode) observer.observe(overlay.parentNode, { childList: true });
      }
    });
  },

  async _registrarEventosZonas(fincaId, eventos, transaction = null) {
    if (!Array.isArray(eventos) || eventos.length === 0) return;
    const registros = eventos.map(({ zona, tipo, descripcion, observaciones = '' }) => ({
      fincaId,
      entidad_id: zona?.id ?? null,
      tipo_entidad: 'zona',
      tipo: 'auditoria',
      motivo_tarea: tipo,
      fecha: new Date().toISOString().split('T')[0],
      descripcion,
      observaciones,
      creadoEn: new Date().toISOString()
    }));
    if (transaction) {
      // Encolar las solicitudes mientras la transacción IndexedDB sigue activa.
      await Promise.all(registros.map((registro) => transaction.objectStore('registro_eventos').add(registro)));
      return;
    }
    const db = await window.dbPromise;
    if (typeof db.transaction !== 'function') throw new Error('La base de datos no permite guardar la trazabilidad de forma segura.');
    const tx = db.transaction('registro_eventos', 'readwrite');
    await Promise.all(registros.map((registro) => tx.store.add(registro)));
    await tx.done;
  },

  async _registrarEventoZona(zona, fincaId, motivo, descripcion, observaciones = '') {
    try {
      await this._registrarEventosZonas(fincaId, [{ zona, tipo: motivo, descripcion, observaciones }]);
    } catch (e) {
      console.error('[ZonasView] No se pudo registrar el evento de zona:', e);
      throw new Error(`No se pudo registrar la trazabilidad de la zona: ${e.message}`);
    }
  },

  async _guardarFincaYEventoZona(finca, zona, motivo, descripcion, observaciones = '', rebanosActualizados = []) {
    const db = await window.dbPromise;
    if (typeof db.transaction !== 'function') {
      throw new Error('No se puede guardar la zona sin una transacción de trazabilidad segura.');
    }
    const fincaOriginal = await db.get('fincas', finca.id);
    const rebanosOriginales = db.constructor?.name === 'InMemoryMockDB'
      ? await db.getAllFromIndex('rebanos', 'fincaId', finca.id)
      : [];
    const eventosOriginalesIds = db.constructor?.name === 'InMemoryMockDB'
      ? new Set((await db.getAllFromIndex('registro_eventos', 'fincaId', finca.id)).map((evento) => evento.id))
      : new Set();
    const tx = db.transaction(['fincas', 'rebanos', 'registro_eventos'], 'readwrite');
    try {
      const escrituras = [
        Fincas.save(finca, { transaction: tx }),
        this._registrarEventosZonas(finca.id, [{ zona, tipo: motivo, descripcion, observaciones }], tx),
        ...rebanosActualizados.map((rebano) => tx.objectStore('rebanos').put(rebano))
      ];
      await Promise.all(escrituras);
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch (_) { /* el mock puede no implementar abort */ }
      try { await tx.done; } catch (_) { /* esperar al rollback IndexedDB */ }
      if (db.constructor?.name === 'InMemoryMockDB') {
        if (fincaOriginal) await db.put('fincas', fincaOriginal);
        for (const rebano of rebanosOriginales) await db.put('rebanos', rebano);
        const eventosTrasFallo = await db.getAllFromIndex('registro_eventos', 'fincaId', finca.id);
        for (const evento of eventosTrasFallo) {
          if (!eventosOriginalesIds.has(evento.id)) await db.delete('registro_eventos', evento.id);
        }
      }
      throw error;
    }
  },

  /** Alterna entre las fichas de zona (con barra de carga) y la tabla densa ERP. */
  _setVistaModo(modo, guardar = true) {
    this._vistaModo = modo;

    const contenedorCards = document.getElementById('zonas-lista');
    const contenedorTabla = document.getElementById('zonas-erp-table-container');


    if (modo === 'tabla') {
      if (contenedorCards) contenedorCards.style.display = 'none';
      if (contenedorTabla) {
        contenedorTabla.style.display = 'block';
        this._renderErpTable();
      }
    } else {
      if (contenedorTabla) contenedorTabla.style.display = 'none';
      if (contenedorCards) contenedorCards.style.display = 'grid';
    }
  },

  _renderErpTable() {
    if (!window.ErpDataTable || !this._cache) return;

    const tableData = this._cache.map(z => ({
      index: z.index,
      nombre: z.nombre,
      uso: z.uso,
      superficie: z.superficie != null ? z.superficie.toLocaleString('es-ES') + ' ha' : '—',
      carga: z.ugm != null ? Number(z.ugm).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' UGM' : '—',
      ocupacion: `${z.censo} / ${z.aforo}`,
      pct: (z.pct || 0) + '%',
      pac: z.pac,
      _pct: z.pct || 0
    }));

    new window.ErpDataTable({
      containerId: 'zonas-erp-table-container',
      title: 'Zonas',
      pageSize: 15,
      columns: [
        { key: 'nombre', label: 'Zona', sortable: true, cellClass: 'erp-cell-id' },
        { key: 'uso', label: 'Uso principal', sortable: true },
        { key: 'superficie', label: 'Superficie', sortable: true, align: 'right' },
        { key: 'carga', label: 'Carga', sortable: true, align: 'right' },
        { key: 'ocupacion', label: 'Cabezas / Aforo', sortable: true, align: 'right' },
        {
          key: 'pct',
          label: '% Aforo',
          sortable: true,
          align: 'right',
          // mismo umbral de sobrepastoreo que la barra de la ficha
          cellClass: (v, row) => (row._pct > 100 ? 'erp-cell-alerta' : row._pct > 85 ? 'erp-cell-aviso' : 'erp-cell-ok')
        },
        { key: 'pac', label: 'Código PAC', sortable: true, cellClass: (v) => (v === '—' ? 'erp-cell-aviso' : '') },
        {
          key: 'index',
          label: 'Ficha',
          sortable: false,
          align: 'center',
          render: (index) => `<button class="btn-erp-secondary btn-sm" onclick="location.hash='/zona?index=${index}'">Ver Ficha</button>`
        }
      ],
      data: tableData
    }).render();
  },
  async render() {
    // Color de pantalla: lo fija GanaderiaView (color fijo de GeGan), esta vista siempre va embebida en su carrusel.
    const main = document.getElementById("ganaderia-tab-content") || document.getElementById("app-content");
    let finca = await Fincas.getActive();
    if (!finca) return App.toastError('No hay finca activa');
    const migracionRelaciones = await this._asegurarIdsZonasYRelaciones(finca);
    if (migracionRelaciones.cambiosIds || migracionRelaciones.rebanosActualizados.length) {
      finca = await Fincas.getActive();
    }
    const rebanos = await Rebanos.list();
    const db = await window.dbPromise;
    // Auto-inicialización inteligente en caliente de la parcela intensiva para pruebas en la demo CHAMORRO
    if (finca && (finca.demo || (finca.nombre && finca.nombre.includes('CHAMORRO')))) {
      finca.zonas = finca.zonas || [];
      const tieneCercado = finca.zonas.some(z => z.nombre === 'Cercado de Cebo 1ha');
      if (!tieneCercado) {
        finca.zonas.push({
          nombre: 'Cercado de Cebo 1ha',
          superficieGrafica: 1,
          superficie: 1,
          aforoMax: 10,
          aforo_maximo: 10,
          usoPrincipal: 'Pasto',
          uso: 'Pasto',
          localizacion: 'Cercado intensivo temporal',
          descripcion: 'Pruebas de sobrepastoreo',
          codigo_pac: 'ES-AN-21005-004',
          distancia_agua_m: 10
        });

        // Guardar la finca para persistir la nueva zona
        const idsOcupados = [...finca.zonas.map((zona) => Number(zona?.id) || 0), ...rebanos.map((rebano) => Number(rebano?.zonaId) || 0)];
        const idZonaNueva = Math.max(0, ...idsOcupados) + 1;
        const zonaDemo = finca.zonas[finca.zonas.length - 1];
        zonaDemo.id = idZonaNueva;
        await db.put('fincas', finca);

        // Reasignar el rebaño de Terneros Cebo a la nueva parcela pequeña para disparar el sobrepastoreo (2.0 UGM/ha)
        const rCebo = rebanos.find(r => r.nombre === 'Terneros Cebo');
        if (rCebo && rCebo.zonaActual !== 'Cercado de Cebo 1ha') {
          rCebo.zonaActual = 'Cercado de Cebo 1ha';
          rCebo.zonaId = idZonaNueva;
          await Rebanos.save(rCebo).catch(() => {});
        }

        // No se recarga la ruta: ya estamos en #/zonas y reasignar el hash al
        // mismo valor no dispara `hashchange`, así que el refresco no llegaba
        // nunca y la vista se quedaba en "Cargando..." (mismo fallo que había
        // en comercializacion-view.js). `finca.zonas` y `rebanos` son las
        // referencias que usa el render de abajo, y ya tienen los cambios.
      }
    }

    const zonasConIndice = (finca.zonas || [])
          .map((zona, realIndex) => ({ zona, realIndex }))
          .filter(({ zona }) => !zona?.anulada);
    let html = '';
    if (zonasConIndice.length === 0)
      html += `<div class="empty-state"><div class="empty-state-icon">${Icons.zonas()}</div><p class="empty-state-text">Sin zonas definidas.</p><div class="text-center mt-20 space-y-10"><button class="widget-link-btn widget-link-btn--neon neon-success" onclick="ZonasView._crearZona()" data-guide="btn-vacio-zonas">${Icons.agregar()}<span class="widget-link-label">Nueva primer Zona</span></button><button class="btn btn-secondary btn-lg" onclick="ZonasView._importarDesdePDF()" data-guide="btn-importar-pdf">${Icons.documento()} Importar desde PDF del Catastro</button></div></div>`;
    else {
      let totalAforo = 0, totalOcupacion = 0;
      let fichasHtml = '';
      this._cache = [];
      let zonasConSobrepastoreo = [];

      for (const item of zonasConIndice) {
        const z = item.zona;
        let censoTotal = 0;
        const rebsEnZona = rebanos.filter((r) => z.id != null
          ? Number(r.zonaId) === Number(z.id) || (r.zonaId == null && r.zonaActual === z.nombre)
          : r.zonaActual === z.nombre);
        const especiesEnZona = new Set();

        let rebanosHtml = "";
        for (let r of rebsEnZona) {
          const ans = await Animales.list(r.id);
          const n = ans.length;
          censoTotal += n;
          especiesEnZona.add(r.especie);
          if (n > 0) {
            const colorEspecie = r.especie === 'Vacas' ? 'var(--c-info)' : r.especie === 'Ovejas' ? 'var(--c-success)' : r.especie === 'Cabras' ? 'var(--c-warning)' : 'var(--c-pink)';
            rebanosHtml += App._cardRegistro({
              title: r.nombre,
              subtitle: r.tipo,
              rightSide: `<div class="font-900 text-sm">${n}</div>`,
              color: colorEspecie,
              onClick: `location.hash='/rebano?id=${r.id}'`,
              className: 'mb-4'
            });
          }
        }

        const aforo = z.aforoMax || z.aforo_maximo || 50;
        const superficieDeclarada = Number(z.superficie);
        const superficieGrafica = Number(z.superficieGrafica);
        const superficie = Number.isFinite(superficieDeclarada) && superficieDeclarada > 0
          ? superficieDeclarada
          : (z.refCatastral && Number.isFinite(superficieGrafica)
            ? (Number.isFinite(Number(z.superficieCatastroHa)) ? Number(z.superficieCatastroHa) : superficieGrafica / 10000)
            : (superficieGrafica || 0));
        totalAforo += aforo;
        totalOcupacion += censoTotal;
        const pct = aforo > 0 ? Math.round((censoTotal / aforo) * 100) : 0;
        const colorCenso = pct > 100 ? 'var(--c-danger)' : pct >= 80 ? 'var(--c-warning)' : 'var(--c-success)';
        const estadoTexto = pct > 100 ? 'Sobrecarga' : pct >= 80 ? 'Óptimo' : pct >= 50 ? 'Aceptable' : 'Infrautilizada';

        const ugmFactor = { 'Vacas': 1.0, 'Ovejas': 0.15, 'Cabras': 0.15, 'Cerdos': 0.3, 'Caballos': 1.1, 'Equino': 1.1 };
        let ugmTotal = 0;
        for (let r of rebsEnZona) {
          const factor = ugmFactor[r.especie] || 0.2;
          const ans = await Animales.list(r.id);
          ugmTotal += ans.length * factor;
        }
        
        const cargaGanaderaNum = superficie > 0 ? ugmTotal / superficie : 0;
        const cargaGanadera = cargaGanaderaNum.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pacTexto = z.codigo_pac ? `PAC: ${z.codigo_pac}` : 'PAC: pendiente';
        const distAgua = z.distancia_agua_m ? `Agua: ${z.distancia_agua_m}m` : 'Agua: —';

        // Acumular zonas con sobrepastoreo activo si superan el aforo ecológico oficial (1.0 UGM/ha)
        if (cargaGanaderaNum > 1.0) {
          zonasConSobrepastoreo.push({
            nombre: z.nombre,
            carga: cargaGanadera,
            ugm: ugmTotal,
            superficie: superficie
          });
        }

        // Sincronización Fitosanitaria en tiempo real
        const bloqueoFito = await this.verificarBloqueoFitosanitario(finca.id, z.nombre);
        let fitoAlertaHtml = '';
        let botonRotacionHtml = '';
        
        if (bloqueoFito && bloqueoFito.bloqueado) {
          fitoAlertaHtml = `
            <div class="mt-8 p-6 flex items-center gap-6 rounded-xs" style="background: rgba(239, 68, 68, 0.04); border: 1px solid var(--c-danger); width: 100%;">
              <span class="animate-pulse text-[0.58rem] font-black text-danger uppercase flex items-center gap-4" style="letter-spacing:0.5px; line-height:1.2;">
                ✕ CUARENTENA ACTIVA (${bloqueoFito.concepto.toUpperCase()}) - BLOQUEADA HASTA EL ${bloqueoFito.fechaFinPlazo} (${bloqueoFito.diasRestantes}D RESTANTES)
              </span>
            </div>
          `;
          botonRotacionHtml = `
            <button onclick="event.stopPropagation(); App.toastError('Esta parcela está bajo cuarentena fitosanitaria activa. Rotación suspendida.');" class="widget-link-btn widget-link-btn--neon neon-danger px-10 py-5 min-h-0 h-auto font-900 uppercase tracking-wider text-[0.62rem] opacity-45 cursor-not-allowed" data-guide="btn-rotar-bloqueado">
              ✕ CUARENTENA ACTIVA (BLOQUEADO)
            </button>
          `;
        } else {
          botonRotacionHtml = `
            <button onclick="event.stopPropagation(); ZonasView._abrirRotacion('${z.nombre.replace(/'/g, "\\'")}')" class="widget-link-btn widget-link-btn--neon neon-success px-10 py-5 min-h-0 h-auto font-900 uppercase tracking-wider text-[0.62rem]" data-guide="btn-rotar-lote">
              ⇄ Rotar Lote / Rebaño
            </button>
          `;
        }

        this._cache.push({
          index: item.realIndex,
          id: z.id,
          nombre: z.nombre,
          uso: z.usoPrincipal || 'Sin uso principal',
          superficie: superficie ? Number(superficie) : null,
          censo: censoTotal,
          aforo: aforo,
          pct: pct,
          ugm: ugmTotal,
          pac: z.codigo_pac || '—',
          estado: estadoTexto
        });

        fichasHtml += App._cardRegistro({
          tipo: z.usoPrincipal || 'Sin uso principal',
          title: z.nombre,
          subtitle: `${z.usoPrincipal || 'Sin uso Principal'}${superficie ? ` · ${Number(superficie).toLocaleString('es-ES')} ha` : ''}`,
          rightSide: `<span class="badge badge-sm uppercase font-800" style="color:${colorCenso}; border:1px solid ${colorCenso}40; background:${colorCenso}15;">${estadoTexto}</span>`,
          content: `
            <div class="p-10 rounded my-8" style="background:#000; border:1px solid #222;">
              <div class="flex justify-between font-900 text-[0.65rem] mb-4 uppercase">
                <span class="text-gray">Carga: ${ugmTotal.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} UGM</span>
                <span style="color:${colorCenso}">${censoTotal} / ${aforo} (${pct}%)</span>
              </div>
              <div class="progress-track">
                <div style="width:${Math.min(pct, 100)}%; height:100%; background:${colorCenso}; border-radius:4px; box-shadow:0 0 8px ${colorCenso}44; transition:width 0.3s;"></div>
              </div>
            </div>
            <div class="flex flex-wrap gap-x-12 gap-y-3 text-[0.62rem] text-aaa font-800 uppercase">
              <div class="flex items-center gap-4" style="${z.codigo_pac ? '' : 'color:var(--c-warning);'}">${Icons.documento()} ${pacTexto}</div>
              <div class="flex items-center gap-4" style="${z.distancia_agua_m ? '' : 'color:var(--text-d);'}">${Icons.zonas()} ${distAgua}</div>
              <div class="flex items-center gap-4">${Icons.grafico()} ${cargaGanadera} UGM/ha</div>
              ${especiesEnZona.size ? `<div class="flex items-center gap-4">${Icons.animales()} ${[...especiesEnZona].join(', ')}</div>` : ''}
            </div>
            ${fitoAlertaHtml}
            ${rebanosHtml ? `
              <div class="mt-4 border-top-222 pt-8">${rebanosHtml}</div>
              <div class="mt-8 flex justify-end">
                ${botonRotacionHtml}
              </div>
            ` : ''}
          `,
          footerRight: `<span style="display:block; font-size:0.7rem; font-weight:700; color:var(--c-warning); white-space:nowrap;">Ficha -></span>`,
          color: colorCenso,
          onClick: `location.hash='/zona?index=${item.realIndex}'`
        });
      }

      // Renderizar Alerta Bento de Sobrepastoreo si hay parcelas afectadas
      let sobrepastoreoHtml = '';
      if (zonasConSobrepastoreo.length > 0) {
        let parcelasAfectadasHtml = '';
        zonasConSobrepastoreo.forEach(p => {
          parcelasAfectadasHtml += `
            <div class="flex justify-between items-center py-6 border-bottom-222" style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase;">
              <span class="text-white">${p.nombre} (${p.superficie.toLocaleString('es-ES')} ha)</span>
              <span class="font-950" style="color: var(--c-danger); text-shadow: 0 0 6px rgba(255,68,68,0.4);">${p.carga} UGM/ha</span>
            </div>
          `;
        });

        sobrepastoreoHtml = `
          <!-- Alerta Bento de Sobrepastoreo Crítico -->
          <div class="card p-12 mb-14 border-danger" style="background: rgba(255, 68, 68, 0.03); border: 1px solid var(--c-danger); box-shadow: 0 0 15px rgba(255, 68, 68, 0.12), inset 0 0 10px rgba(255, 68, 68, 0.05);">
            <div class="flex items-center gap-6 mb-8 text-xs text-danger font-950 uppercase tracking-wider animate-pulse">
              ${Icons.alerta()} ✕ ALERTA DE SOBREPASTOREO ACTIVO (>1.0 UGM/ha)
            </div>
            <p class="text-[0.62rem] text-aaa uppercase font-700 tracking-wide mb-8" style="line-height:1.4;">
              El aforo ecológico máximo permitido para pastoreo extensivo ha sido superado en las siguientes parcelas. Se recomienda rotar los lotes o rebaños para evitar la degradación del pasto.
            </p>
            <div class="mb-10">
              ${parcelasAfectadasHtml}
            </div>
            <div class="flex justify-end">
              <button onclick="App.toast('Abriendo panel de asistente de rotación de pastos...', 'info'); location.hash='/sistema?tab=interfaz'" class="widget-link-btn widget-link-btn--neon neon-danger px-10 py-5 min-h-0 h-auto font-900 uppercase tracking-wider text-[0.62rem]" data-guide="btn-sugerir-rotacion">
                ⇄ Sugerir Rotación Preventiva
              </button>
            </div>
          </div>
        `;
      }

      // Cabecera de Módulo (chip de modo + KPI + acción principal) + Resumen Colapsable
      const pctGlobal = totalAforo > 0 ? Math.round((totalOcupacion / totalAforo) * 100) : 0;
      const colorGlobal = pctGlobal > 100 ? 'var(--c-danger)' : pctGlobal >= 80 ? 'var(--c-warning)' : 'var(--c-success)';
      const flagsModoZonas = window.ModoContextoHelper.getFlags() || { leche: true, carne: false };
      const modoMetaZonas = window.ModoContextoHelper.getModeMetaEffective(flagsModoZonas);
      html += `
        <!-- Cabecera de Módulo: Resumen y acción principal -->
        <div class="module-header">
          <div class="card p-16 mb-16 border-222 animate-fade-in" style="background: linear-gradient(135deg, rgba(34,197,94,0.05) 0%, rgba(0,0,0,0.2) 100%); border-left: 4px solid var(--c-success);">
            <div class="flex items-center gap-12 mb-10">
              <span class="text-3xl" style="color:var(--c-success);">${Icons.zonas()}</span>
              <div>
                <h2 class="text-white font-950 text-base uppercase tracking-wider mb-2">ZONAS Y PARCELAS</h2>
                <p class="text-[0.65rem] text-gray font-700 uppercase leading-relaxed">Gestión de ubicaciones, carga ganadera, UGM y rotación de pastos.</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-8 mt-12 py-8 border-top-222">
              <div class="text-[0.6rem] text-gray uppercase font-900">Total Zonas: <strong class="text-white">${zonasConIndice.length}</strong></div>
              <div class="text-[0.6rem] text-gray uppercase font-900">Ocupación: <strong class="text-success">${totalOcupacion} cab.</strong></div>
            </div>
          </div>
        </div>

        <!-- Resumen de ocupación (colapsable) -->
        <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(255,255,255,0.02);">
          <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center justify-between gap-6">
            <span class="flex items-center gap-6">${Icons.zonas()} Ocupación Global</span>
            <button class="resumen-toggle" onclick="App.toggleResumen(this)" aria-label="Ocultar resumen">${Icons.chevronAbajo()}</button>
          </div>
          <div class="resumen-body">
            <div class="flex justify-between items-center mb-6">
              <span class="text-xs text-gray uppercase font-900">Cabezas / Aforo</span>
              <strong class="text-xl font-950" style="color:${colorGlobal};">${totalOcupacion} / ${totalAforo} (${pctGlobal}%)</strong>
            </div>
            <div class="progress-track progress-track--lg">
              <div style="width:${Math.min(pctGlobal, 100)}%;height:100%;background:${colorGlobal};border-radius:5px;box-shadow:0 0 12px ${colorGlobal}44;"></div>
            </div>
          </div>
        </div>

        ${sobrepastoreoHtml}

        <!-- Histórico de registros -->
        <fieldset class="erp-action-group">
          <legend>Registro de Zonas</legend>
          <div class="erp-action-group-body">
            <button class="widget-link-btn widget-link-btn--neon neon-success" data-guide="btn-nueva-zona" onclick="ZonasView._crearZona()">${Icons.agregar()}<span class="widget-link-label">Nueva Zona</span></button>
            <button class="widget-link-btn widget-link-btn--neon neon-info" data-guide="btn-importar-pdf" onclick="ZonasView._importarDesdePDF()">${Icons.documento()}<span class="widget-link-label">Importar desde PDF del Catastro</span></button>
          </div>
        </fieldset>

        <div class="text-xs text-gray uppercase font-extrabold tracking-wider border-bottom-222 mb-10 pb-5" style="display: flex; align-items: center; gap: 4px;">
          ${Icons.documento()} LISTA DE ZONAS
        </div>
        <div class="erp-filtros" data-filtros-para="zonas-lista">
          <input type="search" class="form-input search-input" placeholder="Buscar zona, uso o código PAC...">
          <select class="form-select" data-etiqueta-todos="Todos los usos"></select>
        </div>
        <div class="grid gap-12" id="zonas-lista" data-ver-mas="10">${fichasHtml}</div>
        <div id="zonas-erp-table-container" class="mt-12" style="display:none;"></div>`;
    }
    main.innerHTML = html;

    if (this._cache.length > 0) {
      const modoGuardado = VistaRegistros.get();
      this._setVistaModo(modoGuardado, false);
    }
    // FAB Guía interactiva
    if (window.App && typeof App.renderGuideFab === 'function') {
      App.renderGuideFab('/ganaderia', 'zonas');
    }
  },

  async renderDetalle(params) {
    const index = params.get("index");
    const fincaActiva = await Fincas.getActive();
    if (!fincaActiva) {
      App.toastError('No hay finca activa');
      location.hash = '#/zonas';
      return;
    }
    const finca = { ...fincaActiva, zonas: (fincaActiva.zonas || []).map((zona) => zona ? { ...zona } : zona) };
    const db = await window.dbPromise;
    const rebanosFinca = finca.id != null ? await db.getAllFromIndex('rebanos', 'fincaId', finca.id).catch(() => []) : [];
    this._resolverRelacionesLegacyZonas(finca, rebanosFinca);
    this._asegurarIdsZonas(finca, rebanosFinca.map((rebano) => rebano.zonaId));
    const zona = finca.zonas[parseInt(index)];
    if (!zona || zona.anulada) {
      App.toastError("Zona no disponible");
      location.hash = "#/zonas";
      return;
    }
    
    // Calcular UGM
    const ugmFactor = { 'Vacas': 1.0, 'Ovejas': 0.15, 'Cabras': 0.15, 'Cerdos': 0.3, 'Caballos': 1.1, 'Equino': 1.1 };
    const rebanos = await Rebanos.list();
    let ugmTotal = 0;
    const superficie = zona.superficie ?? (zona.refCatastral
      ? (zona.superficieCatastroHa ?? Number(zona.superficieGrafica) / 10000)
      : zona.superficieGrafica) ?? 0;
    for (let r of rebanos.filter(rb => zona.id != null
      ? Number(rb.zonaId) === Number(zona.id)
      : rb.zonaActual === zona.nombre)) {
      const factor = ugmFactor[r.especie] || 0.2;
      const ans = await Animales.list(r.id);
      ugmTotal += ans.length * factor;
    }
    const cargaGanadera = (superficie > 0 ? ugmTotal / superficie : 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const superficieEditableHa = zona.superficie != null
      ? zona.superficie
      : (zona.refCatastral
        ? (zona.superficieCatastroHa ?? Number(zona.superficieGrafica) / 10000)
        : zona.superficieGrafica || 0);
    const croquisIds = [...new Set([zona.croquisId, ...(zona.croquisHistorialIds || [])].filter((id) => id != null))];
    const croquisRegistros = await Promise.all(croquisIds.map(async (id) => ({
      id,
      registro: await db.get('croquis_parcelas', id).catch(() => null)
    })));
    const croquisHtml = croquisRegistros.filter(({ registro }) => registro?.blob).map(({ id, registro }) => `
      <button type="button" class="btn btn-secondary btn-sm" onclick="ZonasView._verCroquis(${Number(id)}, ${parseInt(index)})">
        Ver croquis ${id === zona.croquisId ? '(vigente)' : '(histórico)'} · ${new Date(registro.creadoEn || '').toLocaleDateString('es-ES')}
      </button>
    `).join('');

    ZonasView._zonaGuardada = false;
    App.setExitGuard(() => ZonasView._confirmSalirEdicion());

    document.getElementById("app-content").innerHTML = `
      <div class="wizard-full-screen">
        <div class="wizard-header-fixed border-top-5-gold">
          <h1 class="wizard-header-title uppercase font-950 tracking-widest text-lg"><span style="color: var(--p-gold); margin-right: 6px;">|</span> ${Icons.zonas()} DETALLE ZONA</h1>
        </div>
        <div class="wizard-content-scrollable p-20">
      <div class="card-registro" style="--registro-color: var(--c-success);">
        <div class="flex flex-col gap-15">
          <div><label class="form-label" for="z-edit-nombre">Nombre</label>
          <input type="text" id="z-edit-nombre" required value="${zona.nombre}" class="premium-input"></div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label" for="z-edit-aforo">Aforo Máximo</label>
            <input type="number" id="z-edit-aforo" value="${zona.aforoMax || ""}" class="premium-input"></div>
            <div><label class="form-label" for="z-edit-superficie">Superficie (ha)</label>
            <input type="number" id="z-edit-superficie" value="${superficieEditableHa || ""}" step="0.0001" class="premium-input"></div>
          </div>
          <div><label class="form-label" for="z-edit-pac">Código PAC (Parcela Agraria)</label>
          <input type="text" id="z-edit-pac" value="${zona.codigo_pac || ""}" placeholder="Ej: ES01A123456789" class="premium-input"></div>
          <div><label class="form-label" for="z-edit-uso">Uso Principal de la Parcela</label>
          <input type="text" id="z-edit-uso" value="${zona.usoPrincipal || ""}" placeholder="Ej: Pasto libre, Engorde, Cultivo..." class="premium-input"></div>
          <div><label class="form-label" for="z-edit-agua">Distancia a Fuente de Agua (m)</label>
          <input type="number" id="z-edit-agua" value="${zona.distancia_agua_m || ""}" placeholder="Metros" class="premium-input"></div>
          <div class="text-gray text-xs mt-8">
            <strong>${Icons.grafico()} Métricas SIGGAN (solo lectura):</strong><br/>
            UGM Total: <strong>${ugmTotal.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong> · Carga: <strong>${cargaGanadera} UGM/ha</strong>
          </div>
          <div><label class="form-label" for="z-edit-localizacion">Localización</label>
          <textarea id="z-edit-localizacion" class="premium-input min-h-60 resize-none">${zona.localizacion || ""}</textarea></div>
          ${zona.refCatastral ? `
            <div class="card p-12 mt-10">
              <strong class="text-white">Datos importados del Catastro</strong>
              <div class="text-gray text-xs mt-6">Ref. ${zona.refCatastral} · Polígono ${zona.poligono ?? '—'} · Parcela ${zona.parcela ?? '—'}</div>
              <div class="text-gray text-xs mt-4">${zona.paraje || ''}${zona.municipio ? ` · ${zona.municipio}` : ''}${zona.provincia ? ` · ${zona.provincia}` : ''}</div>
              <div class="text-gray text-xs mt-4">${zona.clase || ''}${zona.usoPrincipalCatastro ? ` · ${zona.usoPrincipalCatastro}` : ''}${zona.superficieGrafica ? ` · ${Number(zona.superficieGrafica).toLocaleString('es-ES')} m² (${Number(zona.superficieCatastroHa ?? Number(zona.superficieGrafica) / 10000).toLocaleString('es-ES')} ha catastrales)` : ''}</div>
              ${zona.localizacionCatastro ? `<div class="text-gray text-xs mt-4">Localización catastral: ${zona.localizacionCatastro}</div>` : ''}
              ${zona.superficieConstruida ? `<div class="text-gray text-xs mt-4">Superficie construida: ${Number(zona.superficieConstruida).toLocaleString('es-ES')} m²${zona.anoConstruccion ? ` · Año ${zona.anoConstruccion}` : ''}</div>` : ''}
              ${zona.cultivos?.length ? `<div class="text-gray text-xs mt-4">Cultivos SIGPAC: ${zona.cultivos.map((c) => `${c.letra || ''} ${c.aprovechamiento || c.cultivo || ''}${c.intensidad ? ` (${c.intensidad})` : ''}${c.superficie != null ? ` · ${Number(c.superficie).toLocaleString('es-ES')} m²` : ''}`).join(' · ')}</div>` : ''}
              ${zona.construcciones?.length ? `<div class="text-gray text-xs mt-4">Construcciones: ${zona.construcciones.map((c) => `${c.uso || ''}${c.superficie != null ? ` (${Number(c.superficie).toLocaleString('es-ES')} m²)` : ''}`).join(' · ')}</div>` : ''}
              ${croquisHtml ? `<div class="flex flex-wrap gap-6 mt-8">${croquisHtml}</div>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
        <div class="wizard-footer-fixed border-top-222">
          <button type="button" onclick="ZonasView._eliminarZona(${index})" class="wizard-btn-action wizard-btn-danger">${Icons.eliminar()} Eliminar</button>
          <div class="wizard-footer-buttons">
            <button type="button" onclick="ZonasView._salirEdicionZona()" class="wizard-btn-action wizard-btn-secondary">${Icons.cerrar()} Cancelar</button>
            <button type="button" onclick="ZonasView._guardarZona(${index})" class="wizard-btn-action wizard-btn-success">${Icons.guardar()} Guardar</button>
          </div>
        </div>
      </div>`;
  },
  async _guardarZona(index) {
    try {
      const fincaActiva = await Fincas.getActive();
      if (!fincaActiva) return App.toastError('No hay finca activa');
      const finca = { ...fincaActiva, zonas: (fincaActiva.zonas || []).map((item) => item ? { ...item } : item) };
      const db = await window.dbPromise;
      const rebanosFinca = finca.id != null ? await db.getAllFromIndex('rebanos', 'fincaId', finca.id).catch(() => []) : [];
      this._resolverRelacionesLegacyZonas(finca, rebanosFinca);
      this._asegurarIdsZonas(finca, rebanosFinca.map((rebano) => rebano.zonaId));
      const migracionRelaciones = {
        rebanosActualizados: rebanosFinca.filter((rebano) => rebano && (rebano.zonaId == null || rebano.zonaId === ''))
          .map((rebano) => {
            const matches = finca.zonas.filter((item) => this._normalizarClaveZona(item?.nombre) === this._normalizarClaveZona(rebano.zonaActual));
            return matches.length === 1 && !matches[0].anulada ? { ...rebano, zonaId: Number(matches[0].id) } : null;
          }).filter(Boolean)
      };
      const zona = finca.zonas[index];
      if (!zona || zona.anulada) return App.toastError('Zona no disponible');

      zona.nombre = document.getElementById("z-edit-nombre").value.trim();

      const aforo = parseInt(document.getElementById("z-edit-aforo").value) || 0;
      zona.aforoMax = aforo;
      zona.aforo_maximo = aforo;

      const sup = parseFloat(document.getElementById("z-edit-superficie").value) || 0;
      zona.superficie = sup;
      zona.superficieOrigen = 'manual';
      if (!zona.refCatastral) {
        zona.superficieGrafica = sup;
      } else {
        zona.superficieGrafica = Number(zona.superficieGrafica) || Math.round(sup * 10000);
      }

      zona.codigo_pac = document.getElementById("z-edit-pac").value.trim();

      const uso = document.getElementById("z-edit-uso").value.trim();
      zona.usoPrincipal = uso;
      zona.usoPrincipalOrigen = 'manual';
      zona.uso = uso;

      zona.distancia_agua_m = parseInt(document.getElementById("z-edit-agua").value) || 0;
      zona.localizacion = document.getElementById("z-edit-localizacion").value.trim();
      if (!zona.nombre) return App.toastError("Nombre requerido");
      zona.actualizadaEn = new Date().toISOString();
      await ZonasView._guardarFincaYEventoZona(
        finca, zona, 'actualizacion_manual_zona',
        `Actualización manual de zona ${zona.nombre}`,
        'Datos operativos de la zona actualizados desde su ficha; se conservaron el ID y las relaciones existentes.',
        migracionRelaciones.rebanosActualizados
      );
      ZonasView._zonaGuardada = true;
      App.toast("Zona actualizada", "success");
      location.hash = "#/zonas";
    } catch (e) {
      App.toastError(e.message);
    }
  },

  /** Guarda de salida compartida con el header-back y el botón físico Android (ver App.setExitGuard). */
  async _confirmSalirEdicion() {
    if (this._zonaGuardada) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _salirEdicionZona() {
    if (!(await this._confirmSalirEdicion())) return;
    App.clearExitGuard();
    location.hash = "#/zonas";
  },

  async _crearZona() {
    const wizardSteps = [
      {
        content: (data) => `
          <div class="mt-10">
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-nombre">NOMBRE DE LA ZONA / PARCELA</label>
              <input type="text" id="w-zona-nombre" value="${data.nombre}" required placeholder="Ej: Parcela Norte..." class="wizard-input">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-aforo">AFORO MÁXIMO (Animales)</label>
              <input type="number" id="w-zona-aforo" value="${data.aforoMax}" class="wizard-input">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-superficie">SUPERFICIE (ha)</label>
              <input type="number" id="w-zona-superficie" value="${data.superficie}" step="0.01" placeholder="Ej: 42.5" class="wizard-input">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-uso">USO PRINCIPAL (Opcional)</label>
              <input type="text" id="w-zona-uso" value="${data.usoPrincipal}" placeholder="Ej: Engorde, Pasto libre..." class="wizard-input">
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.nombre = document.getElementById('w-zona-nombre')?.value.trim() || data.nombre;
          data.aforoMax = parseInt(document.getElementById('w-zona-aforo')?.value) || 50;
          data.superficie = parseFloat(document.getElementById('w-zona-superficie')?.value) || 0;
          data.usoPrincipal = document.getElementById('w-zona-uso')?.value.trim() || data.usoPrincipal;
        },
        validate: async (data) => {
          if (!data.nombre) {
            App.toastError("El nombre de la zona es obligatorio");
            return false;
          }
          return true;
        }
      },
      {
        content: (data) => `
          <div class="mt-10">
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-pac">CÓDIGO PAC (Parcela Agraria SIGGAN)</label>
              <input type="text" id="w-zona-pac" value="${data.codigo_pac}" placeholder="Ej: ES01A123456789" class="wizard-input">
              <small class="text-gray">Requisito para subvenciones CCAA</small>
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-zona-agua">DISTANCIA A FUENTE DE AGUA (m)</label>
              <input type="number" id="w-zona-agua" value="${data.distancia_agua_m}" placeholder="Metros a abrevadero o agua" class="wizard-input">
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.codigo_pac = document.getElementById('w-zona-pac')?.value.trim() || data.codigo_pac;
          data.distancia_agua_m = parseInt(document.getElementById('w-zona-agua')?.value) || 0;
        },
        validate: async (data) => true
      }
    ];

    window.WizardManager.create({
      id: 'wizard-nueva-zona',
      title: 'NUEVA ZONA',
      initialData: { nombre: "", aforoMax: 50, superficie: 0, usoPrincipal: "", codigo_pac: "", distancia_agua_m: 0 },
      steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          const fincaActiva = await Fincas.getActive();
          if (!fincaActiva) {
            App.toastError('No hay finca activa');
            return;
          }
          const finca = {
            ...fincaActiva,
            zonas: (fincaActiva.zonas || []).map((zona) => zona ? { ...zona } : zona)
          };
          if (!Array.isArray(finca.zonas)) finca.zonas = [];

          // La coincidencia por nombre es orientativa; las claves de parcela/PAC
          // son fuertes y no permiten crear un segundo registro duplicado.
          const db = await window.dbPromise;
          const rebanosFinca = finca.id != null
            ? await db.getAllFromIndex('rebanos', 'fincaId', finca.id).catch(() => [])
            : [];
          this._resolverRelacionesLegacyZonas(finca, rebanosFinca);
          this._asegurarIdsZonas(finca, rebanosFinca.map((rebano) => rebano.zonaId));
          const migracionRelaciones = {
            rebanosActualizados: rebanosFinca.filter((rebano) => rebano && (rebano.zonaId == null || rebano.zonaId === ''))
              .map((rebano) => {
                const matches = finca.zonas.filter((zona) => this._normalizarClaveZona(zona?.nombre) === this._normalizarClaveZona(rebano.zonaActual));
                return matches.length === 1 && !matches[0].anulada ? { ...rebano, zonaId: Number(matches[0].id) } : null;
              }).filter(Boolean)
          };
          const coincidencias = this._buscarCoincidenciasZona(finca.zonas, {
            nombre: finalData.nombre,
            codigo_pac: finalData.codigo_pac
          });
          const coincidenciaCatastralFuerte = this._buscarCoincidenciasZona(finca.zonas, {
            codigo_pac: finalData.codigo_pac
          }).some((item) => item.coincidencia !== 'nombre (revisar)');
          if (coincidencias.length) {
            const soloNombre = coincidencias.every((item) => item.coincidencia === 'nombre (revisar)') && !coincidenciaCatastralFuerte;
            const decision = await this._elegirCoincidenciaManual(coincidencias, soloNombre);
            if (!decision || decision.accion === 'cancelar') return;
            if (decision.accion === 'actualizar') {
              const coincidenciaElegida = coincidencias[decision.index];
              if (!coincidenciaElegida || coincidenciaCatastralFuerte && coincidenciaElegida.coincidencia === 'nombre (revisar)') {
                App.toastError('Debes elegir la zona que coincide por código PAC; no se permite crear ni actualizar otra zona por nombre.');
                return;
              }
              const zonaExistente = coincidenciaElegida?.zona?.id != null
                ? finca.zonas.find((zona) => Number(zona?.id) === Number(coincidenciaElegida.zona.id))
                : finca.zonas[coincidenciaElegida?.index];
              const coincidenciasActuales = this._buscarCoincidenciasZona(finca.zonas, {
                nombre: finalData.nombre,
                codigo_pac: finalData.codigo_pac
              });
              if (!zonaExistente || zonaExistente.anulada || !coincidenciasActuales.some((item) =>
                item.index === finca.zonas.indexOf(zonaExistente) && item.coincidencia === coincidenciaElegida.coincidencia)) {
                App.toastError('La zona elegida ya no está disponible.');
                return;
              }
              const superficieGrafica = Number(zonaExistente.superficieGrafica) || 0;
              const indiceExistente = finca.zonas.findIndex((zona) => Number(zona?.id) === Number(zonaExistente.id));
              const superficieManual = finca.zonas[indiceExistente].superficie;
              finca.zonas[indiceExistente] = {
                ...zonaExistente,
                aforoMax: finalData.aforoMax,
                aforo_maximo: finalData.aforoMax,
                superficie: zonaExistente.refCatastral ? superficieManual : finalData.superficie,
                superficieGrafica: zonaExistente.refCatastral ? superficieGrafica : finalData.superficie,
                superficieOrigen: zonaExistente.refCatastral ? (zonaExistente.superficieOrigen || 'manual') : 'manual',
                usoPrincipal: finalData.usoPrincipal,
                usoPrincipalOrigen: 'manual',
                uso: finalData.usoPrincipal,
                codigo_pac: zonaExistente.refCatastral ? (zonaExistente.codigo_pac || '') : (finalData.codigo_pac || zonaExistente.codigo_pac || ''),
                distancia_agua_m: finalData.distancia_agua_m,
                actualizadaEn: new Date().toISOString()
              };
              await this._guardarFincaYEventoZona(
                finca, finca.zonas[indiceExistente], 'actualizacion_manual_zona',
                `Actualización manual de zona ${zonaExistente.nombre}`,
                'Actualización confirmada desde el asistente de nueva zona; se conservaron el ID y las relaciones existentes.',
                migracionRelaciones.rebanosActualizados
              );
              App.toast('Zona existente actualizada; sus relaciones se conservaron', 'success');
              location.hash = '#/zonas';
              return;
            }
            if (decision.accion !== 'crear') return;
            if (coincidenciaCatastralFuerte) {
              App.toastError('El código PAC ya pertenece a una zona; no se puede crear otra con ese identificador.');
              return;
            }
          }

          const idsOcupados = [
            ...finca.zonas.map((zona) => Number(zona?.id) || 0),
            ...rebanosFinca.map((rebano) => Number(rebano?.zonaId) || 0)
          ];
          const newId = Math.max(0, ...idsOcupados) + 1;

          const zonaNueva = {
            id: newId,
            nombre: finalData.nombre,
            aforoMax: finalData.aforoMax,
            aforo_maximo: finalData.aforoMax,
            superficie: finalData.superficie,
            superficieOrigen: 'manual',
            usoPrincipal: finalData.usoPrincipal,
            usoPrincipalOrigen: 'manual',
            uso: finalData.usoPrincipal,
            codigo_pac: finalData.codigo_pac,
            distancia_agua_m: finalData.distancia_agua_m,
            creadoEn: Date.now(),
          };
          finca.zonas.push(zonaNueva);
          await this._guardarFincaYEventoZona(
            finca, zonaNueva, 'alta_manual_zona',
            `Alta manual de zona ${finalData.nombre}`,
            'Zona creada desde el asistente manual.',
            migracionRelaciones.rebanosActualizados
          );
          App.toast("Zona creada", "success");
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  },

  async _eliminarZona(index) {
    const motivo = await Confirm.prompt("Motivo de anulación", "Introduce el motivo (obligatorio):", "rectificacion_zonas");
    if (!motivo) {
      App.toastError("Debes indicar un motivo de anulación.");
      return;
    }
    if (!await Confirm.confirm("Anular Zona", "¿Anular zona? Se conservará histórico para auditoría.", true)) return;
    try {
      const fincaActiva = await Fincas.getActive();
      if (!fincaActiva) throw new Error('No hay finca activa');
      const finca = {
        ...fincaActiva,
        zonas: Array.isArray(fincaActiva.zonas) ? fincaActiva.zonas.map((item) => item ? { ...item } : item) : []
      };
      const db = await window.dbPromise;
      const rebanosFinca = finca.id != null ? await db.getAllFromIndex('rebanos', 'fincaId', finca.id).catch(() => []) : [];
      this._resolverRelacionesLegacyZonas(finca, rebanosFinca);
      this._asegurarIdsZonas(finca, rebanosFinca.map((rebano) => rebano.zonaId));
      const migracionRelaciones = {
        rebanosActualizados: rebanosFinca.filter((rebano) => rebano && (rebano.zonaId == null || rebano.zonaId === ''))
          .map((rebano) => {
            const matches = finca.zonas.filter((item) => this._normalizarClaveZona(item?.nombre) === this._normalizarClaveZona(rebano.zonaActual));
            return matches.length === 1 && !matches[0].anulada ? { ...rebano, zonaId: Number(matches[0].id) } : null;
          }).filter(Boolean)
      };
      const zona = finca.zonas[index];
      if (!zona) {
        App.toastError("Zona no encontrada.");
        return;
      }
      zona.anulada = true;
      zona.anuladaEn = new Date().toISOString();
      zona.anuladoMotivo = motivo.trim();
      zona.actualizadoEn = new Date().toISOString();
      await this._guardarFincaYEventoZona(
        finca, zona, 'anulacion_zona',
        `Anulación de zona ${zona.nombre || "#" + index}`,
        motivo.trim(),
        migracionRelaciones.rebanosActualizados
      );
      App.toast("Zona anulada", "success");
      location.hash = "#/zonas";
    } catch (e) {
      App.toastError(e.message);
    }
  },

  async _abrirRotacion(zonaOrigenNombre) {
    try {
      const finca = await Fincas.getActive();
      await this._asegurarIdsZonasYRelaciones(finca);
      const rebanos = await Rebanos.list();
      const zonaOrigen = (finca?.zonas || []).find((zona) => zona.nombre === zonaOrigenNombre);
      const rebanosEnZona = rebanos.filter((r) => zonaOrigen?.id != null
        ? Number(r.zonaId) === Number(zonaOrigen.id)
        : r.zonaActual === zonaOrigenNombre);
      
      if (rebanosEnZona.length === 0) {
        App.toast("No hay rebaños activos en esta zona para rotar.", "warning");
        return;
      }
      
      const otrasZonas = (finca.zonas || [])
        .filter(z => !z?.anulada && z.nombre !== zonaOrigenNombre);
        
      if (otrasZonas.length === 0) {
        App.toast("No hay otras zonas disponibles en la finca. Crea otra zona primero.", "warning");
        return;
      }

      // Evaluar estado fitosanitario de parcelas destino en tiempo real
      const otrasZonasConBloqueo = [];
      const fincaId = await Fincas.getActiveId();
      for (const z of otrasZonas) {
        const checkFito = await this.verificarBloqueoFitosanitario(fincaId, z.nombre);
        otrasZonasConBloqueo.push({
          zona: z,
          bloqueada: checkFito.bloqueado,
          concepto: checkFito.concepto,
          fechaFin: checkFito.fechaFinPlazo
        });
      }
      
      const modalId = 'modal-rotacion-pastos';
      const html = `
          <div class="card p-25" style="max-width:420px; overflow-y:auto; max-height:90vh; border: 1px solid var(--c-success); background: #1e1e1e; width: 100%;">
            <div class="flex items-center gap-10 mb-15">
              <span class="text-2xl" style="color:var(--c-success); display:inline-flex; align-items:center;">${Icons.zonas()}</span>
              <div>
                <h3 class="text-white font-900 text-sm uppercase tracking-wider" style="margin:0;">⇄ ROTACIÓN DE PASTOS (SIGGAN)</h3>
                <div class="text-gray text-[0.6rem] font-bold uppercase tracking-tight">Zona Origen: ${zonaOrigenNombre}</div>
              </div>
            </div>

            <div class="wizard-input-group">
              <label class="wizard-label" for="rot-rebano-select">1. SELECCIONAR REBAÑO / LOTE</label>
              <select id="rot-rebano-select" class="wizard-input">
                ${rebanosEnZona.map(r => `<option value="${r.id}">${r.nombre} (${r.especie})</option>`).join('')}
              </select>
            </div>

            <div class="wizard-input-group">
              <label class="wizard-label" for="rot-zona-select">2. SELECCIONAR PARCELA DESTINO</label>
              <select id="rot-zona-select" class="wizard-input">
                ${otrasZonasConBloqueo.map(item => `
                  <option value="${item.zona.nombre}" ${item.bloqueada ? 'style="color:#ff4444; font-weight:bold;"' : ''}>
                    ${item.zona.nombre} (${item.zona.usoPrincipal || 'Pasto'}${item.bloqueada ? ` · ✕ BLOQUEADA HASTA ${item.fechaFin}` : ` · ${item.zona.superficieGrafica || 0} ha`})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="wizard-input-group">
              <label class="wizard-label" for="rot-observaciones">3. MOTIVO DE TRASLADO (OPCIONAL)</label>
              <input type="text" id="rot-observaciones" placeholder="Ej: Rotación rutinaria de pastos, falta de agua..." class="wizard-input">
            </div>

            <div class="flex gap-10 mt-20">
              <button class="wizard-btn-action wizard-btn-secondary flex-1" id="${modalId}-cancel">${Icons.cerrar()} Cancelar</button>
              <button class="wizard-btn-action wizard-btn-primary flex-1" id="btn-confirmar-rotacion">${Icons.guardar()} Confirmar Traslado</button>
            </div>
          </div>`;
      const overlay = ModalManager.show(modalId, html, { closeOnOverlayClick: false });
      overlay.querySelector('#' + modalId + '-cancel').onclick = () => ModalManager.close(modalId);
      overlay.querySelector('#btn-confirmar-rotacion').onclick = () => ZonasView._confirmarRotacion();
    } catch (e) {
      App.toastError(e.message);
    }
  },

  async _confirmarRotacion() {
    try {
      const rebanoId = Number(document.getElementById('rot-rebano-select').value);
      const nuevaZonaNombre = document.getElementById('rot-zona-select').value;
      const observaciones = document.getElementById('rot-observaciones').value.trim();
      
      const rebano = await Rebanos.get(rebanoId);
      if (!rebano) {
        App.toastError("Rebaño no encontrado");
        return;
      }

      const fincaId = await Fincas.getActiveId();
      
      // Chequeo fitosanitario estricto antes de guardar el traslado
      const checkFito = await ZonasView.verificarBloqueoFitosanitario(fincaId, nuevaZonaNombre);
      if (checkFito && checkFito.bloqueado) {
        App.toastError(`✕ BLOQUEO FITOSANITARIO DE BIOSEGURIDAD:\n\nLa parcela destino "${nuevaZonaNombre.toUpperCase()}" está bajo CUARENTENA ACTIVA (${checkFito.concepto.toUpperCase()}).\n\nNo es apta para pastoreo hasta el ${checkFito.fechaFinPlazo} (${checkFito.diasRestantes}D restantes).`);
        return; // Abortar traslado
      }
      
      const zonaAnterior = rebano.zonaActual;
      // Resolver el ID de la parcela destino: el censo por zona filtra por zonaId,
      // así que debemos actualizar zonaId (fuente de verdad) además de zonaActual.
      const fincaObj = await Fincas.get(fincaId);
      const zonaDestino = (fincaObj?.zonas || []).find((z) => z.nombre === nuevaZonaNombre);
      if (!zonaDestino?.id) throw new Error('La zona destino no tiene un ID estable.');
      rebano.zonaActual = nuevaZonaNombre;
      rebano.zonaId = Number(zonaDestino.id);
      await Rebanos.save(rebano);
      
      // Registrar evento de traslado para auditoría
      await window.db.add('registro_eventos', {
        fincaId: fincaId,
        entidad_id: rebano.id,
        tipo_entidad: 'rebano',
        tipo: 'traslado',
        motivo_tarea: 'rotacion_pastos',
        fecha: new Date().toISOString().split('T')[0],
        descripcion: `Traslado de rebaño "${rebano.nombre}" por rotación de pastos`,
        observaciones: observaciones || `Rotación rutinaria de pastos desde ${zonaAnterior} hacia ${nuevaZonaNombre}`,
        creadoEn: new Date().toISOString()
      }).catch(() => {});
      
      ModalManager.close('modal-rotacion-pastos');
      App.toast("Rotación de rebaño registrada con éxito", "success");
      
      // Volver a renderizar en caliente
      await ZonasView.render();
    } catch (e) {
      App.toastError(e.message);
    }
  },

  async verificarBloqueoFitosanitario(fincaId, zonaNombre, fechaStr) {
    if (!zonaNombre) return { bloqueado: false };
    const hoy = fechaStr ? new Date(fechaStr) : new Date();
    
    // Obtener los tratamientos de fitosanitarios de la finca
    const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []);
    const fitos = gastos.filter(g => 
      (g.categoria || '').toLowerCase() === 'fitosanitarios' &&
      (g.snap_zona || '').toLowerCase() === zonaNombre.toLowerCase() &&
      !g.anulado
    );
    
    for (const f of fitos) {
      const fechaTratamiento = new Date(f.fecha);
      const diasPlazo = Number(f.control_normativo?.plazoSeguridadDias) || 0;
      if (diasPlazo > 0) {
        const fechaFinPlazo = new Date(fechaTratamiento.getTime() + (diasPlazo * 24 * 60 * 60 * 1000));
        if (hoy < fechaFinPlazo) {
          const diffMs = fechaFinPlazo - hoy;
          const diasRestantes = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
          return {
            bloqueado: true,
            concepto: f.concepto,
            fechaFinPlazo: fechaFinPlazo.toLocaleDateString('es-ES'),
            diasRestantes: diasRestantes
          };
        }
      }
    }
    return { bloqueado: false };
  },

  async _verCroquis(croquisId, zonaIndex) {
    try {
      const db = await window.dbPromise;
      const croquis = await db.get('croquis_parcelas', croquisId);
      if (!croquis?.blob) {
        App.toastError('El croquis ya no está disponible');
        return;
      }
      const url = URL.createObjectURL(croquis.blob);
      const id = `croquis-zona-${croquisId}-${Date.now()}`;
      const zona = (await Fincas.getActive())?.zonas?.[zonaIndex];
      DocumentViewer.show({
        id,
        title: `Croquis catastral · ${zona?.nombre || 'Zona'}`,
        filename: `croquis-zona-${zona?.id || zonaIndex}`,
        html: `<div style="display:flex;align-items:center;justify-content:center;min-height:70vh;background:#fff;"><img src="${url}" alt="Croquis catastral de ${zona?.nombre || 'la zona'}" style="max-width:100%;max-height:75vh;object-fit:contain;"></div>`,
        onClose: () => URL.revokeObjectURL(url)
      });
    } catch (e) {
      App.toastError(`No se pudo abrir el croquis: ${e.message}`);
    }
  },

  async _importarDesdePDF() {
    location.hash = '#/importar-zonas';
  }
};

window.ZonasView = ZonasView;




