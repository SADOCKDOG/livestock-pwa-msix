/**
 * Livestock Manager - BotiquinView v1.0.0
 * Inventario de medicamentos/vacunas de la finca (gap "Ingreso Almacén" de
 * docs/AUDITAR/AUDITORIA-BASEDEDATOS-LEGACY.md). Es gestión interna de stock,
 * no un dato exigido por SIGGAN/BADIGEX — no sustituye ni condiciona el
 * cumplimiento SIGGAN, complementa el libro de tratamientos/vacunaciones ya
 * existente (js/sanitarios.js, js/vacunaciones.js).
 */
const BotiquinView = {
  _cache: [],

  async render() {
    if (window.App) App.updateHeaderColor('botiquin');
    const main = document.getElementById("app-content");
    const finca = await Fincas.getActive();
    if (!finca) {
      main.innerHTML = `<div class="empty-state"><p class="empty-state-text">Selecciona una finca activa primero.</p></div>`;
      return;
    }

    // Obtener productos activos
    const productos = await window.db.getAllFromIndex('config_botiquin', 'fincaId', finca.id).catch(() => []);
    const productosActivos = productos.filter(p => !p.anulado).sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Para cada producto, obtener sus lotes y calcular totales
    this._cache = await Promise.all(productosActivos.map(async (producto) => {
      const lotes = await window.db.getAllFromIndex('botiquin_lotes', 'productoId', producto.id).catch(() => []);

      // Calcular cantidad total sumando todos los lotes
      const cantidadTotal = lotes.reduce((sum, lote) => sum + (lote.cantidad || 0), 0);

      // Encontrar la fecha de caducidad más temprana (para alertas)
      const fechasCaducidad = lotes
        .filter(lote => lote.caducidad)
        .map(lote => new Date(lote.caducidad));
      const proximaCaducidad = fechasCaducidad.length > 0
        ? new Date(Math.min(...fechasCaducidad.map(d => d.getTime())))
        : null;

      return {
        ...producto,
        cantidadActual: cantidadTotal, // Para mantener compatibilidad con vistas existentes
        lotes: lotes, // Guardar lotes para uso en vistas detalladas
        proximaCaducidad: proximaCaducidad ? proximaCaducidad.toISOString().split('T')[0] : null
      };
    }));

    let html = '';
    if (this._cache.length === 0) {
      html = `<div class="empty-state"><div class="empty-state-icon">${Icons.sanidad()}</div><p class="empty-state-text">Sin productos registrados en el botiquín.</p><div class="text-center mt-20"><button class="btn btn-create btn-lg" onclick="BotiquinView._crearProducto()">${Icons.agregar()} Registrar primer producto</button></div></div>`;
    } else {
      const moduleColor = (window.getModuleColor && window.getModuleColor('/botiquin')) || 'var(--c-info)';
      const hoy = new Date().toISOString().split('T')[0];
      let fichasHtml = '';
      for (const p of this._cache) {
        const stockBajo = p.cantidadMinima != null && Number(p.cantidadActual) <= Number(p.cantidadMinima);
        // Usar la fecha de caducidad más próxima de los lotes para alertas
        const diasCaducidad = p.proximaCaducidad ? Math.ceil((new Date(p.proximaCaducidad) - new Date(hoy)) / (24 * 3600 * 1000)) : null;
        const caducado = diasCaducidad != null && diasCaducidad < 0;
        const caducidadProxima = diasCaducidad != null && diasCaducidad >= 0 && diasCaducidad <= 30;

        const metadata = [];
        metadata.push(`<span>${Number(p.cantidadActual || 0).toLocaleString()} ${p.unidad || ''}</span>`);
        // Mostrar información de lotes resumida
        if (p.lotes && p.lotes.length > 0) {
          const lotesConDatos = p.lotes.filter(l => l.lote && l.lote.trim() !== '');
          if (lotesConDatos.length > 0) {
            if (lotesConDatos.length === 1) {
              metadata.push(`<span>Lote: ${lotesConDatos[0].lote}</span>`);
            } else {
              metadata.push(`<span>Lotes: ${lotesConDatos.length}</span>`);
            }
          }
        }
        if (p.proximaCaducidad) metadata.push(`<span>Caduca: ${p.proximaCaducidad}</span>`);
        if (stockBajo) metadata.push(`<span style="color: var(--c-danger);">STOCK BAJO</span>`);
        if (caducado) metadata.push(`<span style="color: var(--c-danger);">CADUCADO</span>`);
        else if (caducidadProxima) metadata.push(`<span style="color: var(--c-warning);">CADUCA EN ${diasCaducidad}D</span>`);

        fichasHtml += App._cardRegistro({
          icon: Icons.sanidad(),
          title: p.nombre,
          subtitle: `<span class="badge badge-sm uppercase">${p.tipo || 'otro'}</span>`,
          metadata: metadata.join(''),
          color: (stockBajo || caducado) ? 'var(--c-danger)' : moduleColor,
          onClick: `location.hash='/botiquin-producto?id=${p.id}'`
        });
      }

      html = `
        <div class="flex items-center gap-12 mb-14">
          <span class="text-2xl" style="color:${moduleColor}; display:inline-flex; align-items:center;">${Icons.sanidad()}</span>
          <div>
            <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin:0; line-height:1.2;">
              <span style="color:${moduleColor}; margin-right:4px;">|</span> BOTIQUÍN / ALMACÉN
            </h1>
            <div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
              ${this._cache.length} ${this._cache.length === 1 ? 'producto' : 'productos'}
            </div>
          </div>
        </div>
        <div class="grid gap-12">${fichasHtml}</div>`;
    }

    main.innerHTML = html + `
      <div class="fab-container" onclick="BotiquinView._crearProducto()">
        <span class="fab-label">Nuevo Producto</span>
        <button class="fab-btn">${Icons.fabPlus()}</button>
      </div>`;
  },

  async renderDetalle(params) {
    const id = Number(params.get("id"));
    const p = await window.db.get('config_botiquin', id);
    if (!p || p.anulado) {
      App.toastError("Producto no disponible");
      location.hash = "#/botiquin";
      return;
    }
    const eventos = await window.db.getAllFromIndex('registro_eventos', 'fincaId', p.fincaId).catch(() => []);
    const movimientos = eventos
      .filter(e => e.tipo_entidad === 'botiquin' && Number(e.entidad_id) === id)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // Obtener lotes del producto
    const lotes = await window.db.getAllFromIndex('botiquin_lotes', 'productoId', id).catch(() => []);

    // Proveedores para resolver el nombre en los movimientos de entrada con compra
    const proveedoresMap = {};
    if (window.Proveedores) {
      const proveedores = await window.Proveedores.list().catch(() => []);
      proveedores.forEach(pr => { proveedoresMap[pr.id] = pr.nombre; });
    }

    BotiquinView._guardado = false;
    App.setExitGuard(() => BotiquinView._confirmSalirEdicion());

    document.getElementById("app-content").innerHTML = `
      <div class="mb-20"><a href="#" onclick="BotiquinView._salirEdicion(); return false;" class="link-back">← Volver</a><h2 class="mt-10 font-900 uppercase tracking-wider"><span style="color: var(--neon);">|</span> ${Icons.sanidad()} ${p.nombre.toUpperCase()}</h2></div>
      <div class="card-registro" style="--registro-color: var(--c-info);">
        <div class="grid grid-cols-2 gap-10 mb-15">
          <div class="card p-10 text-center" style="background:#111; border:1px solid #222;">
            <span class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-2 d-block">STOCK ACTUAL</span>
            <span class="text-white font-black text-sm block">${Number(p.cantidadActual || 0).toLocaleString()} ${p.unidad || ''}</span>
          </div>
          <div class="card p-10 text-center" style="background:#111; border:1px solid #222;">
            <span class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-2 d-block">STOCK MÍNIMO</span>
            <span class="text-white font-black text-sm block">${p.cantidadMinima != null ? Number(p.cantidadMinima).toLocaleString() : '—'} ${p.unidad || ''}</span>
          </div>
        </div>

        <div class="flex flex-col gap-15">
          <div><label class="form-label" for="b-edit-nombre">Nombre</label>
          <input type="text" id="b-edit-nombre" value="${p.nombre}" class="premium-input"></div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label" for="b-edit-tipo">Tipo</label>
            <select id="b-edit-tipo" class="premium-input">
              ${['vacuna', 'medicamento', 'desparasitante', 'antibiotico', 'otro'].map(t => `<option value="${t}" ${p.tipo === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
            </select></div>
            <div><label class="form-label" for="b-edit-unidad">Unidad</label>
            <select id="b-edit-unidad" class="premium-input">
              ${['dosis', 'ml', 'comprimidos', 'kg', 'unidades'].map(u => `<option value="${u}" ${p.unidad === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select></div>
          </div>
          <div class="grid grid-cols-2 gap-10">
            <div><label class="form-label" for="b-edit-lote">Lote</label>
            <input type="text" id="b-edit-lote" value="${p.lote || ''}" class="premium-input"></div>
            <div><label class="form-label" for="b-edit-caducidad">Caducidad</label>
            <input type="date" id="b-edit-caducidad" value="${p.caducidad || ''}" class="premium-input"></div>
          </div>
          <div><label class="form-label" for="b-edit-minima">Stock mínimo (alerta)</label>
          <input type="number" id="b-edit-minima" value="${p.cantidadMinima != null ? p.cantidadMinima : ''}" min="0" class="premium-input"></div>
          <div><label class="form-label" for="b-edit-notas">Notas</label>
          <textarea id="b-edit-notas" class="premium-input min-h-60 resize-none">${p.notas || ''}</textarea></div>
        </div>

        <!-- Lotes del producto -->
        <div class="mt-15">
          <div class="text-[0.65rem] text-gray uppercase font-900 tracking-wide mb-8">LOTES</div>
          ${lotes.length === 0 ? '<div class="text-center py-10 text-gray-500 font-bold uppercase text-[0.6rem]">No hay lotes registrados</div>' : `
            <div class="space-y-4">
              ${lotes.map(lote => `
                <div class="flex justify-between items-center p-6 rounded-sm border border-222" style="background:#1a1a1a;">
                  <div>
                    <span class="text-[0.6rem] font-black text-white uppercase block">LOTE: ${lote.lote || 'SIN LOTE'}</span>
                    ${lote.caducidad ? `<span class="text-[0.55rem] font-bold text-gray-500 block mt-1">Caduca: ${lote.caducidad}</span>` : ''}
                    ${lote.creadoEn ? `<span class="text-[0.5rem] font-medium text-gray-400 block mt-1">Creado: ${new Date(lote.creadoEn).toLocaleDateString()}</span>` : ''}
                  </div>
                  <strong class="text-xs font-black" style="color:${lote.caducidad && new Date(lote.caducidad) < new Date() ? 'var(--c-danger)' : (lote.caducidad && new Date(lote.caducidad) - new Date() <= 30*24*3600*1000 ? 'var(--c-warning)' : 'var(--c-success)')}">
                    ${lote.cantidad || 0} ${p.unidad || ''}
                  </strong>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="grid grid-cols-2 gap-10 mt-15">
          <button class="btn btn-secondary" onclick="BotiquinView._abrirMovimiento(${id}, 'entrada')">${Icons.agregar()} Entrada de stock</button>
          <button class="btn btn-secondary" onclick="BotiquinView._abrirMovimiento(${id}, 'consumo')">${Icons.balanza()} Registrar consumo</button>
        </div>

        <div class="mt-20">
          <div class="text-[0.65rem] text-gray uppercase font-900 tracking-wide mb-8">Historial de movimientos</div>
          <div class="flex flex-col gap-6" style="max-height: 220px; overflow-y: auto;">
            ${movimientos.length === 0 ? '<div class="text-center py-15 text-gray-500 font-bold uppercase text-[0.6rem]">Sin movimientos registrados</div>' :
              movimientos.map(m => `
                <div class="flex justify-between items-center p-8 rounded-sm border border-222" style="background:#141414;">
                  <div>
                    <span class="text-[0.6rem] font-black text-white uppercase block">${m.motivo_tarea === 'entrada_botiquin' ? 'ENTRADA' : 'CONSUMO'}</span>
                    <span class="text-[0.55rem] font-bold text-gray-500 block mt-2">${m.fecha}</span>
                    ${m.origen_tipo ? `<span class="text-[0.5rem] font-bold text-info block mt-1 uppercase">Vinculado a ${m.origen_tipo === 'tratamiento' ? 'tratamiento' : 'vacunación'} #${m.origen_id}</span>` : ''}
                    ${m.precioTotal != null ? `<span class="text-[0.5rem] font-bold text-gold block mt-1 uppercase">Coste: ${m.precioTotal.toFixed(2)} €${m.proveedorId && proveedoresMap[m.proveedorId] ? ` · ${proveedoresMap[m.proveedorId]}` : ''}${m.factura ? ` · Fact. ${m.factura}` : ''}</span>` : ''}
                  </div>
                  <strong class="text-xs font-black" style="color:${m.motivo_tarea === 'entrada_botiquin' ? 'var(--c-success)' : 'var(--c-danger)'};">
                    ${m.motivo_tarea === 'entrada_botiquin' ? '+' : '-'}${m.valor_neto || 0} ${p.unidad || ''}
                  </strong>
                </div>`).join('')}
          </div>
        </div>

        <div class="flex justify-between items-center mt-20">
          <button class="btn btn-danger" onclick="BotiquinView._eliminarProducto(${id})">${Icons.eliminar()} Eliminar</button>
          <div class="flex gap-10">
            <button class="btn btn-secondary" onclick="BotiquinView._salirEdicion()">${Icons.cerrar()} Cancelar</button>
            <button class="btn btn-success" onclick="BotiquinView._guardarProducto(${id})">${Icons.guardar()} Guardar</button>
          </div>
        </div>
      </div>`;
  },

  async _guardarProducto(id) {
    try {
      const p = await window.db.get('config_botiquin', id);
      p.nombre = document.getElementById('b-edit-nombre').value.trim();
      p.tipo = document.getElementById('b-edit-tipo').value;
      p.unidad = document.getElementById('b-edit-unidad').value;
      const loteInput = document.getElementById('b-edit-lote').value.trim();
      p.lote = loteInput;
      const caducidadInput = document.getElementById('b-edit-caducidad').value;
      p.caducidad = caducidadInput || null;
      const minima = parseFloat(document.getElementById('b-edit-minima').value);
      p.cantidadMinima = isNaN(minima) ? null : minima;
      p.notas = document.getElementById('b-edit-notas').value.trim();
      if (!p.nombre) { App.toastError('El nombre es obligatorio.'); return; }

      // Guardar información básica del producto
      await window.db.put('config_botiquin', p);

      // Manejar lotes: crear o actualizar lote si se especifica
      if (loteInput) {
        // Buscar si ya existe un lote con este número para este producto
        const lotesExistentes = await window.db.getAllFromIndex('botiquin_lotes', 'productoId', id);
        const loteExistente = lotesExistentes.find(l => l.lote === loteInput);

        if (loteExistente) {
          // Actualizar lote existente
          loteExistente.caducidad = p.caducidad;
          loteExistente.cantidad = p.cantidadActual; // Asumimos que la cantidad actual es la del lote
          await window.db.put('botiquin_lotes', loteExistente);
        } else {
          // Crear nuevo lote
          await window.db.add('botiquin_lotes', {
            productoId: id,
            lote: loteInput,
            caducidad: p.caducidad,
            cantidad: p.cantidadActual,
            creadoEn: new Date().toISOString()
          });
        }
      }

      BotiquinView._guardado = true;
      App.toast("Producto actualizado", "success");
      location.hash = "#/botiquin";
    } catch (e) {
      App.toastError(e.message);
    }
  },

  async _confirmSalirEdicion() {
    if (this._guardado) return true;
    return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
  },

  async _salirEdicion() {
    if (!(await this._confirmSalirEdicion())) return;
    App.clearExitGuard();
    location.hash = "#/botiquin";
  },

  async _crearProducto() {
    const finca = await Fincas.getActive();
    if (!finca) { App.toastError("No hay finca activa"); return; }

    const wizardSteps = [
      {
        content: (data) => `
          <div class="mt-10">
            <div class="wizard-input-group">
              <label class="wizard-label" for="w-bot-nombre">NOMBRE DEL PRODUCTO</label>
              <input type="text" id="w-bot-nombre" value="${data.nombre || ''}" class="wizard-input font-800" placeholder="Ej: Ivermectina 1%">
            </div>
            <div class="grid grid-cols-2 gap-10">
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-bot-tipo">TIPO</label>
                <select id="w-bot-tipo" class="wizard-input font-800">
                  ${['vacuna', 'medicamento', 'desparasitante', 'antibiotico', 'otro'].map(t => `<option value="${t}" ${data.tipo === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
                </select>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-bot-unidad">UNIDAD</label>
                <select id="w-bot-unidad" class="wizard-input font-800">
                  ${['dosis', 'ml', 'comprimidos', 'kg', 'unidades'].map(u => `<option value="${u}" ${data.unidad === u ? 'selected' : ''}>${u}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-10">
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-bot-cantidad">STOCK INICIAL</label>
                <input type="number" id="w-bot-cantidad" value="${data.cantidadActual || 0}" min="0" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-bot-minima">STOCK MÍNIMO (ALERTA)</label>
                <input type="number" id="w-bot-minima" value="${data.cantidadMinima || ''}" min="0" class="wizard-input font-800" placeholder="Opcional">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-10">
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-bot-lote">LOTE</label>
                <input type="text" id="w-bot-lote" value="${data.lote || ''}" class="wizard-input" placeholder="Opcional">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-bot-caducidad">CADUCIDAD</label>
                <input type="date" id="w-bot-caducidad" value="${data.caducidad || ''}" class="wizard-input">
              </div>
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.nombre = document.getElementById('w-bot-nombre')?.value.trim() || '';
          data.tipo = document.getElementById('w-bot-tipo')?.value || 'otro';
          data.unidad = document.getElementById('w-bot-unidad')?.value || 'dosis';
          const cant = parseFloat(document.getElementById('w-bot-cantidad')?.value);
          data.cantidadActual = isNaN(cant) ? 0 : cant;
          const minima = parseFloat(document.getElementById('w-bot-minima')?.value);
          data.cantidadMinima = isNaN(minima) ? null : minima;
          data.lote = document.getElementById('w-bot-lote')?.value.trim() || '';
          data.caducidad = document.getElementById('w-bot-caducidad')?.value || null;
        },
        validate: async (data) => {
          if (!data.nombre) { App.toastError('Indica el nombre del producto.'); return false; }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-nuevo-botiquin',
      title: 'NUEVO PRODUCTO',
      initialData: { nombre: '', tipo: 'vacuna', unidad: 'dosis', cantidadActual: 0, cantidadMinima: null, lote: '', caducidad: null },
      steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          const productoId = await window.db.add('config_botiquin', {
            fincaId: finca.id,
            nombre: finalData.nombre,
            tipo: finalData.tipo,
            unidad: finalData.unidad,
            cantidadActual: finalData.cantidadActual,
            cantidadMinima: finalData.cantidadMinima,
            lote: finalData.lote,
            caducidad: finalData.caducidad,
            notas: '',
            creadoEn: new Date().toISOString(),
          });

          // Crear registro de lote si se proporcionó información de lote
          if (finalData.lote && finalData.lote.trim() !== '') {
            await window.db.add('botiquin_lotes', {
              productoId: productoId,
              lote: finalData.lote.trim(),
              caducidad: finalData.caducidad || null,
              cantidad: finalData.cantidadActual || 0,
              creadoEn: new Date().toISOString()
            });
          }

          App.toast("Producto registrado", "success");
          App.route();
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  },

  async _abrirMovimiento(id, tipo) {
    const p = await window.db.get('config_botiquin', id);
    if (!p) return;

    // Obtener lotes existentes del producto
    const lotesExistentes = await window.db.getAllFromIndex('botiquin_lotes', 'productoId', id).catch(() => []);

    // Proveedores activos, solo relevantes para entradas (equivalente a
    // INGVAC.DAT de la BD legacy: entrada de stock con precio por dosis).
    const proveedores = tipo === 'entrada' && window.Proveedores
      ? await window.Proveedores.list({ activo: true }).catch(() => [])
      : [];

    const wizardSteps = [
      {
        content: (data) => {
          let loteOptions = '';
          if (tipo === 'entrada') {
            // Para entrada, permitir especificar lote y caducidad
            loteOptions = `
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-mov-lote">LOTE</label>
                <input type="text" id="w-mov-lote" value="${data.lote || ''}" class="wizard-input" placeholder="Opcional">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-mov-caducidad">CADUCIDAD</label>
                <input type="date" id="w-mov-caducidad" value="${data.caducidad || ''}" class="wizard-input">
              </div>
              <div class="border-top-222 pt-12 mt-8">
                <div class="text-[0.6rem] text-gold uppercase font-950 tracking-wider mb-8">DATOS DE COMPRA (OPC.)</div>
                <div class="grid grid-cols-2 gap-10">
                  <div class="wizard-input-group">
                    <label class="wizard-label" for="w-mov-precio">PRECIO UNITARIO (€)</label>
                    <input type="number" id="w-mov-precio" value="${data.precioUnitario || ''}" min="0" step="0.01" class="wizard-input" placeholder="Ej: 1.25">
                  </div>
                  <div class="wizard-input-group">
                    <label class="wizard-label" for="w-mov-proveedor">PROVEEDOR</label>
                    <select id="w-mov-proveedor" class="wizard-input">
                      <option value="">— SIN ESPECIFICAR —</option>
                      ${proveedores.map(pr => `<option value="${pr.id}" ${data.proveedorId == pr.id ? 'selected' : ''}>${pr.nombre.toUpperCase()}</option>`).join('')}
                    </select>
                  </div>
                </div>
                <div class="wizard-input-group mt-8">
                  <label class="wizard-label" for="w-mov-factura">Nº FACTURA</label>
                  <input type="text" id="w-mov-factura" value="${data.factura || ''}" class="wizard-input uppercase" placeholder="Opcional">
                </div>
              </div>
            `;
          } else {
            // Para consumo, mostrar lotes disponibles ordenados por FEFO (primero en vencer, primero en salir)
            const lotesValidos = lotesExistentes
              .filter(lote => lote.cantidad > 0) // Solo lotes con stock disponible
              .sort((a, b) => {
                // Ordenar por fecha de caducidad (los que vencen primero primero)
                const fechaA = a.caducidad ? new Date(a.caducidad) : new Date(8640000000000000); // Fecha muy lejana si no tiene caducidad
                const fechaB = b.caducidad ? new Date(b.caducidad) : new Date(8640000000000000);
                return fechaA - fechaB;
              });

            let loteSeleccionado = data.loteSeleccionado || '';
            if (!loteSeleccionado && lotesValidos.length > 0) {
              // Por defecto, seleccionar el primero en vencer (FEFO)
              loteSeleccionado = lotesValidos[0].lote || '';
            }

            loteOptions = `
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-mov-lote">LOTE (FEFO - Primero en Vencer, Primero en Salir)</label>
                <select id="w-mov-lote" class="wizard-input">
                  <option value="">-- Seleccionar lote --</option>
                  ${lotesValidos.map(lote => {
                    const vencido = lote.caducidad && new Date(lote.caducidad) < new Date();
                    const diasParaVencer = lote.caducidad ? Math.ceil((new Date(lote.caducidad) - new Date()) / (24 * 3600 * 1000)) : null;
                    const estadoTexto = vencido ? 'VENCIDO' :
                      diasParaVencer !== null && diasParaVencer <= 30 ? `PRONTO VENCER (${diasParaVencer}d)` :
                      diasParaVencer !== null ? `Vence en ${diasParaVencer}d` : 'Sin caducidad';
                    const estadoClass = vencido ? 'text-red-500' :
                      diasParaVencer !== null && diasParaVencer <= 30 ? 'text-orange-500' :
                      diasParaVencer !== null ? 'text-green-500' : 'text-gray-500';
                    return `<option value="${lote.lote}" ${lote.lote === loteSeleccionado ? 'selected' : ''}>${lote.lote || 'SIN LOTE'} - ${estadoTexto}</option>`;
                  }).join('')}
                </select>
              </div>
              <div class="space-y-2 mt-4">
                ${lotesValidos.map(lote => `
                  <div class="text-sm flex justify-between">
                    <span>Lote: ${lote.lote || 'SIN LOTE'}</span>
                    <span class="font-medium">${lote.cantidad} ${p.unidad || ''}</span>
                  </div>
                  ${lote.caducidad ? `
                  <div class="text-xs flex justify-between">
                    <span>Caduca:</span>
                    <span class="${lote.caducidad && new Date(lote.caducidad) < new Date() ? 'text-red-500' :
                      lote.caducidad && new Date(lote.caducidad) - new Date() <= 30*24*3600*1000 ? 'text-orange-500' :
                      'text-green-500'}">
                      ${lote.caducidad} ${lote.caducidad && new Date(lote.caducidad) < new Date() ? '(VENCIDO)' : ''}
                    </span>
                  </div>
                  ` : ''}
                `).join('')}
              </div>
            `;
          }

          return `
            <div class="mt-10">
              <div class="text-center mb-15">
                <div class="text-xs text-gray uppercase font-800">${tipo === 'entrada' ? 'ENTRADA DE STOCK' : 'CONSUMO'}</div>
                <div class="text-white font-900 uppercase">${p.nombre}</div>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-mov-cantidad">CANTIDAD (${(p.unidad || '').toUpperCase()})</label>
                <input type="number" id="w-mov-cantidad" value="${data.cantidad || ''}" min="0.01" step="0.01" class="wizard-input font-900 text-lg">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="w-mov-fecha">FECHA</label>
                <input type="date" id="w-mov-fecha" value="${data.fecha}" class="wizard-input font-800">
              </div>
              ${loteOptions}
            </div>
          `;
        },
        onChange: async (data) => {
          const c = parseFloat(document.getElementById('w-mov-cantidad')?.value);
          data.cantidad = isNaN(c) ? 0 : c;
          data.fecha = document.getElementById('w-mov-fecha')?.value || data.fecha;
          if (tipo === 'entrada') {
            data.lote = document.getElementById('w-mov-lote')?.value.trim() || '';
            data.caducidad = document.getElementById('w-mov-caducidad')?.value || null;
            const precioVal = document.getElementById('w-mov-precio')?.value;
            data.precioUnitario = precioVal ? Number(precioVal) : null;
            const proveedorVal = document.getElementById('w-mov-proveedor')?.value;
            data.proveedorId = proveedorVal ? Number(proveedorVal) : null;
            data.factura = document.getElementById('w-mov-factura')?.value.trim() || '';
          } else {
            data.loteSeleccionado = document.getElementById('w-mov-lote')?.value || '';
          }
        },
        validate: async (data) => {
          if (!data.cantidad || data.cantidad <= 0) { App.toastError('Indica una cantidad válida.'); return false; }
          if (tipo === 'consumo' && data.cantidad > Number(p.cantidadActual || 0)) {
            App.toastError('No puedes consumir más stock del disponible.');
            return false;
          }
          // Para consumo, validar que se haya seleccionado un lote si hay lotes disponibles
          if (tipo === 'consumo' && lotesExistentes.length > 0) {
            const lotesConStock = lotesExistentes.filter(l => l.cantidad > 0);
            if (lotesConStock.length > 0 && (!data.loteSeleccionado || data.loteSeleccionado === '')) {
              App.toastError('Debe seleccionar un lote para el consumo.');
              return false;
            }
          }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-movimiento-botiquin',
      title: tipo === 'entrada' ? 'ENTRADA DE STOCK' : 'REGISTRAR CONSUMO',
      initialData: { cantidad: null, fecha: new Date().toISOString().split('T')[0] },
      steps: wizardSteps,
      onComplete: async (finalData) => {
        try {
          if (tipo === 'entrada') {
            // ENTRADA DE STOCK: Actualizar cantidad total y crear/actualizar lote
            p.cantidadActual = Number(p.cantidadActual || 0) + finalData.cantidad;
            await window.db.put('config_botiquin', p);

            // Manejar lote para entrada
            if (finalData.lote && finalData.lote.trim() !== '') {
              const loteExistente = lotesExistentes.find(l => l.lote === finalData.lote);
              if (loteExistente) {
                // Actualizar lote existente (sumar cantidad)
                loteExistente.cantidad = Number(loteExistente.cantidad || 0) + finalData.cantidad;
                loteExistente.caducidad = finalData.caducidad || loteExistente.caducidad; // Mantener la caducidad más antigua si se proporciona
                if (finalData.precioUnitario != null) loteExistente.precioUnitario = finalData.precioUnitario;
                if (finalData.proveedorId != null) loteExistente.proveedorId = finalData.proveedorId;
                if (finalData.factura) loteExistente.factura = finalData.factura;
                await window.db.put('botiquin_lotes', loteExistente);
              } else {
                // Crear nuevo lote
                await window.db.add('botiquin_lotes', {
                  productoId: id,
                  lote: finalData.lote.trim(),
                  caducidad: finalData.caducidad || null,
                  cantidad: finalData.cantidad,
                  precioUnitario: finalData.precioUnitario ?? null,
                  proveedorId: finalData.proveedorId ?? null,
                  factura: finalData.factura || '',
                  creadoEn: new Date().toISOString()
                });
              }
            }
          } else {
            // CONSUMO: Implementar FEFO (Primero en Vencer, Primero en Salir)
            let cantidadRestante = finalData.cantidad;
            const lotesParaConsumir = lotesExistentes
              .filter(lote => lote.cantidad > 0) // Solo lotes con stock disponible
              .sort((a, b) => {
                // Ordenar por fecha de caducidad (los que vencen primero primero)
                const fechaA = a.caducidad ? new Date(a.caducidad) : new Date(8640000000000000); // Fecha muy lejana si no tiene caducidad
                const fechaB = b.caducidad ? new Date(b.caducidad) : new Date(8640000000000000);
                return fechaA - fechaB;
              });

            // Consumir de los lotes en orden FEFO
            for (const lote of lotesParaConsumir) {
              if (cantidadRestante <= 0) break;

              const cantidadADeductir = Math.min(cantidadRestante, lote.cantidad);
              lote.cantidad -= cantidadADeductir;
              await window.db.put('botiquin_lotes', lote);
              cantidadRestante -= cantidadADeductir;
            }

            // Actualizar cantidad total del producto
            p.cantidadActual = Number(p.cantidadActual || 0) - finalData.cantidad;
            await window.db.put('config_botiquin', p);

            // Si se consumió todo de un lote específico (selección manual), actualizar específicamente ese lote
            if (finalData.loteSeleccionado && finalData.loteSeleccionado !== '') {
              const loteSeleccionado = lotesExistentes.find(l => l.lote === finalData.loteSeleccionado);
              if (loteSeleccionado) {
                // El lote ya fue actualizado en el bucle anterior si estaba en la lista FEFO y tenía stock
                // Pero si no estaba (porque estaba fuera de orden por fecha), lo actualizamos aquí
                if (!lotesParaConsumir.includes(loteSeleccionado)) {
                  // Este caso no debería ocurrir con el ordenamiento correcto, pero por seguridad
                  loteSeleccionado.cantidad = Math.max(0, loteSeleccionado.cantidad - finalData.cantidad);
                  await window.db.put('botiquin_lotes', loteSeleccionado);
                }
              }
            }
          }

          // Registrar el movimiento en el historial
          await window.db.add('registro_eventos', {
            fincaId: p.fincaId,
            entidad_id: p.id,
            tipo_entidad: 'botiquin',
            tipo: 'movimiento',
            motivo_tarea: tipo === 'entrada' ? 'entrada_botiquin' : 'consumo_botiquin',
            fecha: finalData.fecha,
            valor_neto: finalData.cantidad,
            unidad: p.unidad,
            descripcion: `${tipo === 'entrada' ? 'Entrada' : 'Consumo'} de ${finalData.cantidad} ${p.unidad} de ${p.nombre}${
              tipo === 'entrada' && finalData.lote ? ` (Lote: ${finalData.lote})` : ''
            }${
              tipo === 'consumo' && finalData.loteSeleccionado ? ` (Lote: ${finalData.loteSeleccionado})` : ''
            }`,
            precioUnitario: tipo === 'entrada' ? (finalData.precioUnitario ?? null) : null,
            precioTotal: tipo === 'entrada' && finalData.precioUnitario != null ? Number((finalData.precioUnitario * finalData.cantidad).toFixed(2)) : null,
            proveedorId: tipo === 'entrada' ? (finalData.proveedorId ?? null) : null,
            factura: tipo === 'entrada' ? (finalData.factura || null) : null,
            creadoEn: new Date().toISOString(),
          });

          App.toast(tipo === 'entrada' ? "Entrada registrada" : "Consumo registrado", "success");
          location.hash = `#/botiquin-producto?id=${p.id}`;
        } catch (e) {
          App.toastError(e.message);
        }
      }
    });
  },

  async _eliminarProducto(id) {
    if (!await Confirm.confirm("Eliminar producto", "¿Eliminar este producto del botiquín? Se conservará el historial de movimientos para auditoría.", true)) return;
    try {
      const p = await window.db.get('config_botiquin', id);
      if (!p) { App.toastError("Producto no encontrado."); return; }
      p.anulado = true;
      p.anuladoEn = new Date().toISOString();
      await window.db.put('config_botiquin', p);
      App.toast("Producto eliminado", "success");
      location.hash = "#/botiquin";
    } catch (e) {
      App.toastError(e.message);
    }
  }
};

window.BotiquinView = BotiquinView;
