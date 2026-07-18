/**
 * ProveedoresView - Livestock Manager Premium v4.0
 * Vista de proveedores: lista, detalle con trazabilidad de gastos, formulario.
 */

const ProveedoresView = {
    _cachedData: null,

    _labelCat(cat) {
        const labels = { 'Alimentacion': 'Alimentación', 'Amortizacion': 'Amortización' };
        return labels[cat] || cat;
    },

    async render() {
        const main = document.getElementById("expro-tab-content") || document.getElementById("app-content");
        const moduleColor = window.getModuleColor ? getModuleColor('/proveedores') : 'var(--c-purple)';
        main.innerHTML = `
          <!-- Cabecera de Sección Estandarizada -->
          <div class="flex items-center gap-12 mb-14">
            <span class="text-2xl" style="color:${moduleColor}; display:inline-flex; align-items:center;">${Icons.proveedores()}</span>
            <div>
              <h1 class="text-white font-900 text-lg uppercase tracking-wider" style="margin:0; line-height:1.2;">
                <span style="color:${moduleColor}; margin-right:4px;">|</span> PROVEEDORES
              </h1>
              <div class="text-gray" style="font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                Gestión de Proveedores y Servicios
              </div>
            </div>
          </div>

          <div class="mb-16">
            <div id="prov-kpis"></div>
            <div class="flex gap-8 mb-14">
              <input type="search" id="search-proveedores" placeholder="Buscar por nombre, NIF o ciudad..."
                oninput="ProveedoresView._filtrar(this.value)"
                class="form-input search-input flex-1" style="margin-top:0;">
            </div>
          </div>
          <div id="prov-lista"><div class="loader">Cargando proveedores...</div></div>

          <!-- Botón Flotante de Acción con viñeta -->
          <div class="fab-container" onclick="ProveedoresView.renderFormulario()">
            <span class="fab-label">Nuevo Proveedor</span>
            <button class="fab-btn" aria-label="Añadir"><span aria-hidden="true">${Icons.fabPlus()}</span></button>
          </div>
          `;

        await this._cargarDatos();
    },

    async _cargarDatos() {
        const proveedores = await Proveedores.list();
        const fincaId = await Fincas.getActiveId();
        const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId).catch(() => []);
        const gastosConProveedor = gastos.filter(g => g.proveedorId != null);
        const totalGasto = gastosConProveedor.reduce((s, g) => s + (g.monto || 0), 0);
        const kpisEl = document.getElementById('prov-kpis');
        if (kpisEl) {
            kpisEl.innerHTML = `
              <div class="card p-12 mb-14 border-222 card-total-3d card-resumen" style="background: rgba(168,85,247,0.015); width:100%;">
                <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center gap-6" style="border-bottom:none; padding-bottom:0; margin-bottom:12px;"><span style="color: var(--c-purple); margin-right:4px;">|</span> ${Icons.proveedores()} BALANCE PROVEEDORES</div>
                <div class="flex flex-col">
                  <div class="py-8 flex justify-between items-center border-bottom-222">
                    <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.proveedores()} Proveedores</span>
                    <strong class="text-xl font-950" style="color:var(--c-accent);">${proveedores.length}</strong>
                  </div>
                  <div class="py-8 flex justify-between items-center border-bottom-222">
                    <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.dinero()} Gasto Asignado</span>
                    <strong class="text-xl font-950" style="color:var(--c-warning);">${totalGasto.toLocaleString()}€</strong>
                  </div>
                  <div class="py-8 flex justify-between items-center">
                    <span class="text-xs text-gray uppercase font-900 flex items-center gap-4">${Icons.paquete()} Registros</span>
                    <strong class="text-xl font-950" style="color:var(--c-info);">${gastosConProveedor.length}</strong>
                  </div>
                </div>
              </div>`;
        }
        this._cachedMetricasProveedor = {};
        gastosConProveedor.forEach(g => {
            const m = this._cachedMetricasProveedor[g.proveedorId] || (this._cachedMetricasProveedor[g.proveedorId] = { ultimaCompra: null });
            const f = g.fecha ? new Date(g.fecha) : null;
            if (f && (!m.ultimaCompra || f > m.ultimaCompra)) m.ultimaCompra = f;
        });
        this._cachedData = proveedores;
        this._renderLista(proveedores);
    },

    _filtrar(texto) {
        if (!this._cachedData) return;
        if (!texto) return this._renderLista(this._cachedData);
        const q = texto.toLowerCase();
        const filtrados = this._cachedData.filter(p =>
            (p.nombre || '').toLowerCase().includes(q) ||
            (p.nif_cif || '').toLowerCase().includes(q) ||
            (p.ciudad || '').toLowerCase().includes(q)
        );
        this._renderLista(filtrados);
    },

    _renderLista(lista) {
        const contenedor = document.getElementById('prov-lista');
        if (!contenedor) return;

        if (lista.length === 0) {
            contenedor.innerHTML = `
              <div class="empty-state border border-222">
                <div class="empty-state-icon" style="color:#555;">${Icons.proveedores()}</div>
                <p class="empty-state-text uppercase font-900 text-xs">${this._cachedData?.length === 0 ? 'Aún no hay proveedores registrados.' : 'No hay proveedores con ese filtro.'}</p>
                <button onclick="ProveedoresView.renderFormulario()"
                  class="widget-link-btn widget-link-btn--neon neon-success px-16 mt-10">
                  ${Icons.agregar()} <span class="widget-link-label">REGISTRAR PRIMERO</span>
                </button>
              </div>`;
            return;
        }

        contenedor.innerHTML = `<div class="grid gap-6">${lista.map(p => { const m = (this._cachedMetricasProveedor || {})[p.id]; return App._cardRegistro({
          title: p.nombre,
          subtitle: [p.nif_cif ? Icons.documento() + ' ' + p.nif_cif : '', p.ciudad ? Icons.zonas() + ' ' + p.ciudad.toUpperCase() : ''].filter(Boolean).join(' · '),
          metadata: m?.ultimaCompra ? `<span style="color:var(--c-info);">${Icons.calendar()} Última compra: ${m.ultimaCompra.toLocaleDateString('es-ES')}</span>` : `<span style="color:var(--text-d);">Sin compras registradas</span>`,
          rightSide: `
            <div class="text-right">
              <span style="font-size: 1.1rem; font-weight: 800; border: 1px solid ${p.activo === false ? 'var(--c-danger)' : 'var(--c-success)'}; color: ${p.activo === false ? 'var(--c-danger)' : 'var(--c-success)'};
                  background: ${p.activo === false ? 'rgba(255,68,68,0.1)' : 'rgba(204,255,0,0.1)'};
                  padding: 6px 12px; border-radius: 8px; display: inline-block;">
                ${p.activo === false ? 'INACTIVO' : 'ACTIVO'}
              </span>
            </div>
          `,
          content: `
            ${Array.isArray(p.categorias) && p.categorias.length > 0 ? `
            <div class="flex flex-wrap gap-2 mt-2">
              ${p.categorias.map(cat => `<span class="text-[0.5rem] text-gray font-800 uppercase bg-black px-6 py-2 rounded-sm border border-222">${this._labelCat(cat).toUpperCase()}</span>`).join('')}
            </div>` : ''}
            <div class="flex flex-wrap gap-x-6 gap-y-1 text-[0.6rem] text-gray font-700 uppercase mt-4">
              ${p.telefono ? `<span class="flex items-center gap-2">${Icons.info()} ${p.telefono}</span>` : ''}
              ${p.email ? `<span class="flex items-center gap-2">${Icons.enlace()} ${p.email}</span>` : ''}
            </div>
          `,
          footerRight: `<span style="display: inline-block; font-size: 0.75rem; font-weight: 600; border: 1px solid var(--c-warning); color: var(--c-warning); background: rgba(255, 215, 0, 0.1); padding: 2px 6px; border-radius: 4px;">Ficha -></span>`,
          color: 'var(--c-purple)',
          onClick: `location.hash='#/proveedor?id=${p.id}'`
        }); }).join('')}</div>`;
    },

    // ============================================
    // DETALLE PROVEEDOR
    // ============================================

    async renderDetalle(id) {
        const proveedor = await Proveedores.get(id);
        if (!proveedor) return App.toastError('Proveedor no encontrado');

        const [gastos, resumen] = await Promise.all([
            Proveedores.getGastos(id),
            Proveedores.getResumen(id)
        ]);

        const main = document.getElementById("app-content");
        main.innerHTML = `
          <div class="mb-14">
            <button onclick="location.hash='#/proveedores'" class="widget-link-btn widget-link-btn--neon neon-danger px-16 py-8 min-h-0 h-auto">
              <span class="text-[0.7rem] font-950 uppercase tracking-widest">${Icons.atras()} Volver</span>
            </button>
          </div>

          <!-- Cabecera -->
          <div class="card p-24 mb-14" style="background: var(--surface);">
            <div class="flex justify-between items-start mb-16">
              <div>
                <h2 class="text-white mt-0 mb-4 text-2xl font-black uppercase tracking-tight">${proveedor.nombre}</h2>
                <div class="mt-4">
                  ${proveedor.activo === false
                    ? '<span class="badge badge-sm font-950 uppercase" style="background:color-mix(in srgb, var(--c-danger) 12%, transparent); color:var(--c-danger); border:1px solid color-mix(in srgb, var(--c-danger) 25%, transparent);">INACTIVO</span>'
                    : '<span class="badge badge-sm font-950 uppercase" style="background:color-mix(in srgb, var(--c-success) 12%, transparent); color:var(--c-success); border:1px solid color-mix(in srgb, var(--c-success) 25%, transparent);">ACTIVO</span>'}
                </div>
              </div>
              <div class="flex gap-8">
                <button class="widget-link-btn widget-link-btn--neon neon-danger px-12 py-8 min-h-0 h-auto" onclick="ProveedoresView._eliminar(${id})" aria-label="Eliminar">
                  <span aria-hidden="true">${Icons.eliminar()}</span>
                </button>
                <button class="widget-link-btn widget-link-btn--neon neon-info px-12 py-8 min-h-0 h-auto" onclick="ProveedoresView.renderFormulario(${id})" aria-label="Editar">
                  <span aria-hidden="true">${Icons.editar()}</span>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-15 text-xs text-gray-500 uppercase font-800 tracking-wider bg-dark p-14 rounded-sm border border-222">
              ${proveedor.nif_cif ? `<div class="flex items-center gap-6">${Icons.documento()} <span class="text-aaa">NIF:</span> <strong class="text-white">${proveedor.nif_cif}</strong></div>` : ''}
              ${proveedor.telefono ? `<div class="flex items-center gap-6">${Icons.info()} <span class="text-aaa">TEL:</span> <strong class="text-white">${proveedor.telefono}</strong></div>` : ''}
              ${proveedor.email ? `<div class="flex items-center gap-6 lowercase">${Icons.enlace()} <span class="text-aaa uppercase">EMAIL:</span> <strong class="text-white">${proveedor.email}</strong></div>` : ''}
              ${proveedor.ciudad ? `<div class="flex items-center gap-6">${Icons.zonas()} <span class="text-aaa">UBICACIÓN:</span> <strong class="text-white">${proveedor.ciudad.toUpperCase()}${proveedor.provincia ? ' ('+proveedor.provincia.toUpperCase()+')' : ''}</strong></div>` : ''}
              ${proveedor.condiciones_pago ? `<div class="col-span-full flex items-center gap-6 mt-4 border-top-222 pt-8">${Icons.dinero()} <span class="text-aaa">PAGO:</span> <strong class="text-white">${proveedor.condiciones_pago.toUpperCase()}</strong></div>` : ''}
            </div>
          </div>

          <!-- KPIs -->
          <div class="grid grid-cols-3 gap-8 mb-16">
            <div class="summary-cell summary-cell-kpi">
              <small class="s-lbl uppercase font-900">TOTAL GASTADO</small>
              <div class="s-val inf-val-lg text-green font-950">${resumen.total_gastado.toLocaleString()}€</div>
            </div>
            <div class="summary-cell summary-cell-kpi">
              <small class="s-lbl uppercase font-900">REGISTROS</small>
              <div class="s-val inf-val-lg text-blue font-950">${resumen.total_gastos}</div>
              <small class="text-gray-600 text-[0.5rem] font-800 block mt-2">MEDIA: ${resumen.gasto_promedio.toLocaleString('es-ES', { maximumFractionDigits: 1 })}€</small>
            </div>
            <div class="summary-cell summary-cell-kpi">
              <small class="s-lbl uppercase font-900">GASTO ANUAL</small>
              <div class="s-val inf-val-lg text-red font-950">${resumen.gasto_anual.toLocaleString()}€</div>
              <small class="text-gray-600 text-[0.5rem] font-800 block mt-2">ÚLTIMOS 12M</small>
            </div>
          </div>

          <!-- Desglose por categoría -->
          <div class="card p-16 mb-16 border-222 bg-black">
            <div class="text-xs text-gray-500 uppercase font-950 tracking-widest border-bottom-222 pb-8 mb-12 flex items-center gap-8">
                <span style="color: var(--c-info); margin-right: 4px;">|</span> ${Icons.grafico()} GASTOS POR CATEGORÍA
            </div>
            ${Object.keys(resumen.por_categoria).length === 0 ? '<div class="empty-state border-none mt-0 mb-0"><p class="empty-state-text font-800 text-xs">Sin gastos registrados.</p></div>' :
              Object.entries(resumen.por_categoria).map(([cat, info]) => `
                <div class="history-row border-bottom-222 py-10">
                  <div class="flex items-center gap-8">
                    <span class="text-white font-900 uppercase text-xs">${Icons.paquete()} ${this._labelCat(cat)}</span>
                    <span class="text-gray-600 font-800 text-[0.6rem] uppercase tracking-tighter">(${info.count} REGISTROS)</span>
                  </div>
                  <div class="text-green font-950 text-md">${info.total.toLocaleString()} €</div>
                </div>
              `).join('')}
          </div>

          <!-- Historial de Gastos -->
          <div class="card p-16 mb-20 border-222 bg-black">
            <div class="text-xs text-gray-500 uppercase font-950 tracking-widest border-bottom-222 pb-8 mb-12 flex items-center gap-8">
                <span style="color: var(--c-warning); margin-right: 4px;">|</span> ${Icons.dinero()} ÚLTIMOS REGISTROS
            </div>
            ${gastos.length === 0 ? '<div class="empty-state border-none mt-0 mb-0"><p class="empty-state-text font-800 text-xs">Sin gastos registrados.</p></div>' :
              gastos.slice(0, 30).map(g => `
                <div class="history-row border-bottom-222 py-12">
                  <div>
                    <div class="text-gold font-950 uppercase text-[0.7rem] flex items-center gap-6">${Icons.calendar()} ${g.fecha ? new Date(g.fecha).toLocaleDateString() : '-'}</div>
                    <div class="text-aaa font-800 text-[0.62rem] uppercase mt-2 tracking-wide">${g.categoria || 'Otros'}${g.descripcion ? ' · '+g.descripcion : ''}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-red font-950 text-md">${(g.monto || 0).toLocaleString()} €</div>
                    ${g.iva ? `<div class="text-gray-600 uppercase font-900 text-[0.55rem] tracking-widest mt-2">IVA: ${g.iva}%</div>` : ''}
                  </div>
                </div>
              `).join('')}
            ${gastos.length > 30 ? `<div class="text-center text-gray-700 font-900 text-[0.55rem] uppercase tracking-widest mt-15">Mostrando 30 de ${gastos.length} registros</div>` : ''}
          </div>

          ${proveedor.notas ? `
          <div class="card card-accent card-accent-gold p-16 mb-40">
            <div class="text-gold font-950 text-[0.65rem] uppercase tracking-widest mb-10"><span style="color: var(--p-gold); margin-right: 4px;">|</span> ${Icons.documento()} OBSERVACIONES</div>
            <p class="text-aaa text-xs uppercase font-700 leading-relaxed m-0">${proveedor.notas}</p>
          </div>` : '<div class="pb-40"></div>'}
        `;
    },

    // ============================================
    // FORMULARIO PROVEEDOR
    // ============================================

    async renderFormulario(id) {
        const esEdicion = !!id;
        const p = esEdicion ? await Proveedores.get(id) : {
            nombre: '', nif_cif: '', direccion: '', codigo_postal: '', ciudad: '', provincia: '',
            telefono: '', email: '', categorias: [], condiciones_pago: '', notas: '', activo: true
        };

        const CATEGORIAS_DISPONIBLES = [
            'Alimentacion', 'Sanidad', 'Fitosanitarios', 'Electricidad', 'Personal', 'Amortizacion'
        ];

        const destinoCancelar = esEdicion ? '#/proveedor?id=' + id : '#/proveedores';
        ProveedoresView._proveedorGuardado = false;
        App.setExitGuard(() => ProveedoresView._confirmSalirFormulario());

        const main = document.getElementById("app-content");
        main.innerHTML = `
          <div class="mb-14">
            <button onclick="ProveedoresView._salirFormulario('${destinoCancelar}')" class="widget-link-btn widget-link-btn--neon neon-danger px-16 py-8 min-h-0 h-auto">
              <span class="text-[0.7rem] font-950 uppercase tracking-widest">${Icons.atras()} Cancelar</span>
            </button>
          </div>
          <div class="card card-accent card-accent-green p-20 bg-black">
            <div class="section-header-theme mb-20" style="--theme-color: var(--c-success)"><span style="color: var(--c-success); margin-right: 4px;">|</span> ${esEdicion ? Icons.editar() : Icons.agregar()} ${esEdicion ? 'EDITAR PROVEEDOR' : 'NUEVO PROVEEDOR'}</div>

            <div class="wizard-input-group mb-15">
                <label class="wizard-label" for="p-nombre">NOMBRE / RAZÓN SOCIAL *</label>
                <input type="text" id="p-nombre" value="${p.nombre || ''}" required class="wizard-input uppercase font-900" placeholder="EJ: SUMINISTROS AGRÍCOLAS S.L.">
            </div>

            <div class="grid grid-cols-2 gap-12 mb-15">
              <div class="wizard-input-group">
                <label class="wizard-label" for="p-nif">NIF / CIF</label>
                <input type="text" id="p-nif" value="${p.nif_cif || ''}" class="wizard-input uppercase font-800" placeholder="B12345678">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="p-tel">TELÉFONO</label>
                <input type="tel" id="p-tel" value="${p.telefono || ''}" class="wizard-input font-800" placeholder="600000000">
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-12 mb-15">
              <div class="wizard-input-group">
                <label class="wizard-label" for="p-tipo-operador">TIPO OPERADOR SIGGAN</label>
                <select id="p-tipo-operador" class="wizard-input wizard-select font-800">
                  <option value="proveedor_servicios" ${!p.tipo_operador || p.tipo_operador === 'proveedor_servicios' ? 'selected' : ''}>PROVEEDOR SERVICIOS</option>
                  <option value="piensos" ${p.tipo_operador === 'piensos' ? 'selected' : ''}>PIENSOS</option>
                  <option value="sanitario" ${p.tipo_operador === 'sanitario' ? 'selected' : ''}>SANITARIO</option>
                  <option value="maquinaria" ${p.tipo_operador === 'maquinaria' ? 'selected' : ''}>MAQUINARIA</option>
                </select>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="p-rega">REGA</label>
                <input type="text" id="p-rega" value="${p.rega || ''}" class="wizard-input uppercase font-800 input-rega-std" placeholder="ES041230000123" maxlength="14">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="p-ccaa">CCAA</label>
                <select id="p-ccaa" class="wizard-input wizard-select font-800">
                  <option value="">— SIN DEFINIR —</option>
                  <option value="andalucia" ${p.comunidad_autonoma === 'andalucia' ? 'selected' : ''}>ANDALUCÍA</option>
                  <option value="extremadura" ${p.comunidad_autonoma === 'extremadura' ? 'selected' : ''}>EXTREMADURA</option>
                </select>
              </div>
            </div>

            <div class="wizard-input-group mb-15">
                <label class="wizard-label" for="p-dir">DIRECCIÓN POSTAL</label>
                <input type="text" id="p-dir" value="${p.direccion || ''}" class="wizard-input uppercase font-800">
            </div>

            <div class="grid grid-cols-3 gap-12 mb-15">
              <div class="wizard-input-group">
                <label class="wizard-label" for="p-cp">C.P.</label>
                <input type="text" id="p-cp" value="${p.codigo_postal || ''}" class="wizard-input font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="p-ciudad">CIUDAD</label>
                <input type="text" id="p-ciudad" value="${p.ciudad || ''}" class="wizard-input uppercase font-800">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label" for="p-prov">PROVINCIA</label>
                <input type="text" id="p-prov" value="${p.provincia || ''}" class="wizard-input uppercase font-800">
              </div>
            </div>

            <div class="mb-20 bg-dark p-14 rounded-sm border border-222">
              <label class="wizard-label text-gold font-950 uppercase tracking-widest mb-10 d-block">${Icons.paquete()} CATEGORÍAS DE SUMINISTRO</label>
              <div class="flex flex-wrap gap-8">
                ${CATEGORIAS_DISPONIBLES.map(cat => {
                   const isChecked = Array.isArray(p.categorias) && p.categorias.includes(cat);
                   return `
                  <label class="category-chip ${isChecked ? 'active' : ''}" style="display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:30px;
                    background:${isChecked ? 'rgba(204,255,0,0.15)' : '#111'};
                    border:1px solid ${isChecked ? 'var(--c-success)' : '#333'};
                    cursor:pointer; font-size:0.65rem; font-weight:900; color:${isChecked ? 'var(--c-success)' : '#aaa'}; text-transform:uppercase; letter-spacing:0.5px;">
                    <input type="checkbox" value="${cat}" ${isChecked ? 'checked' : ''} class="d-none"
                      onchange="this.parentElement.style.background=this.checked ? 'rgba(204,255,0,0.15)' : '#111';
                               this.parentElement.style.borderColor=this.checked ? 'var(--c-success)' : '#333';
                               this.parentElement.style.color=this.checked ? 'var(--c-success)' : '#aaa';">
                    ${this._labelCat(cat)}
                  </label>`;
                }).join('')}
              </div>
            </div>

            <div class="wizard-input-group mb-15">
                <label class="wizard-label" for="p-email">EMAIL CONTACTO</label>
                <input type="email" id="p-email" value="${p.email || ''}" class="wizard-input font-800 lowercase">
            </div>

            <div class="wizard-input-group mb-15">
                <label class="wizard-label" for="p-pago">CONDICIONES DE PAGO</label>
                <input type="text" id="p-pago" value="${p.condiciones_pago || ''}" class="wizard-input uppercase font-800" placeholder="EJ: TRANSFERENCIA 30 DÍAS">
            </div>

            <div class="wizard-input-group mb-15">
                <label class="wizard-label" for="p-notas">NOTAS / OBSERVACIONES</label>
                <textarea id="p-notas" class="wizard-input uppercase font-700" style="min-height:80px; resize:none;">${p.notas || ''}</textarea>
            </div>

            <label class="flex items-center gap-10 text-xs text-white cursor-pointer bg-black border border-222 p-12 rounded-sm mb-25">
              <input type="checkbox" id="p-activo" ${p.activo !== false ? 'checked' : ''} style="accent-color:var(--c-success);">
              <span class="uppercase font-950 tracking-widest text-[0.65rem]">Proveedor activo en el sistema</span>
            </label>

            <div class="grid grid-cols-2 gap-10 mt-20">
                <button onclick="ProveedoresView._guardar(${id || ''})" class="widget-link-btn widget-link-btn--neon neon-success">
                  ${Icons.guardar()} <span class="widget-link-label">GUARDAR</span>
                </button>
                <button onclick="ProveedoresView._salirFormulario('${destinoCancelar}')" class="widget-link-btn widget-link-btn--neon neon-danger">
                  ${Icons.cerrar()} <span class="widget-link-label">CANCELAR</span>
                </button>
            </div>
            ${esEdicion ? `<div class="mt-15 text-center"><button onclick="ProveedoresView._eliminar(${id})" class="text-red font-900 text-[0.6rem] uppercase tracking-widest p-10 opacity-60 hover:opacity-100 transition-all">${Icons.eliminar()} Eliminar definitivamente</button></div>` : ''}
          </div>
          <div class="pb-40"></div>
        `;
    },

    async _guardar(id) {
        try {
            const categorias = [...document.querySelectorAll('#app-content input[type=checkbox][value]')]
                .filter(cb => cb.checked)
                .map(cb => cb.value);

            const data = {
                id: id || undefined,
                nombre: document.getElementById('p-nombre').value.trim(),
                nif_cif: document.getElementById('p-nif').value.trim(),
                tipo_operador: document.getElementById('p-tipo-operador').value,
                rega: document.getElementById('p-rega').value.trim(),
                comunidad_autonoma: document.getElementById('p-ccaa').value,
                direccion: document.getElementById('p-dir').value.trim(),
                codigo_postal: document.getElementById('p-cp').value.trim(),
                ciudad: document.getElementById('p-ciudad').value.trim(),
                provincia: document.getElementById('p-prov').value.trim(),
                telefono: document.getElementById('p-tel').value.trim(),
                email: document.getElementById('p-email').value.trim(),
                categorias: categorias,
                condiciones_pago: document.getElementById('p-pago').value.trim(),
                notas: document.getElementById('p-notas').value.trim(),
                activo: document.getElementById('p-activo').checked
            };

            if (!data.nombre) return App.toastError('El nombre es obligatorio');

            const nuevoId = await Proveedores.save(data);
            ProveedoresView._proveedorGuardado = true;
            App.toast(id ? 'Proveedor actualizado' : 'Proveedor creado', 'success');
            location.hash = '#/proveedor?id=' + nuevoId;
        } catch (e) {
            App.toastError(e.message);
        }
    },

    /** Guarda de salida compartida con el header-back y el botón físico Android (ver App.setExitGuard). */
    async _confirmSalirFormulario() {
        if (this._proveedorGuardado) return true;
        return await Confirm.confirm("Salir sin guardar", "¿Cerrar sin guardar datos?", false);
    },

    async _salirFormulario(destino) {
        if (!(await this._confirmSalirFormulario())) return;
        App.clearExitGuard();
        location.hash = destino;
    },

    async _eliminar(id) {
        if (!await Confirm.confirm("Eliminar Proveedor", "¿Eliminar este proveedor permanentemente?", true)) return;
        try {
            await Proveedores.delete(id);
            App.toast('Proveedor eliminado');
            location.hash = '#/proveedores';
        } catch (e) {
            App.toastError(e.message);
        }
    }
};

window.ProveedoresView = ProveedoresView;




