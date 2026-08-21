/**
 * Livestock Manager - FitosanitariosView v1.0.0
 * Vista especializada para el control del Cuaderno de Campo Fitosanitario y tratamientos de parcelas.
 */

const FitosanitariosView = {
    _cachedRegistros: [],

    async render() {
        const main = document.getElementById('expro-tab-content') || document.getElementById('app-content');
        main.innerHTML = `<div class="text-center p-40"><div class="loader">Generando Libro Fitosanitario...</div></div>`;

        try {
            await this._cargarDatos();
            this._renderContenido(main);
        } catch (e) {
            console.error('[FitosanitariosView] Error:', e);
            main.innerHTML = `<div class="card text-center p-40 text-red">Error al cargar el registro fitosanitario: ${e.message}</div>`;
        }
    },

    async _cargarDatos() {
        const fincaId = await Fincas.getActiveId();
        if (!fincaId) {
            this._cachedRegistros = [];
            return;
        }

        // Los registros de fitosanitarios se almacenan como gastos con categoría "Fitosanitarios"
        const gastos = await window.db.getAllFromIndex('gastos_ganaderia', 'fincaId', fincaId);
        this._cachedRegistros = gastos.filter(g => 
            (g.categoria || '').toLowerCase() === 'fitosanitarios'
        ).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    },

    _renderContenido(container) {
        const totalInversion = this._cachedRegistros.reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
        const zonasTratadas = new Set(this._cachedRegistros.map(r => r.snap_zona).filter(Boolean));
        const numRegistros = this._cachedRegistros.length;

        container.innerHTML = `
        <div class="p-16 max-w-[900px] mx-auto animate-fade-in" style="min-height: calc(100vh - 120px); padding-bottom: 80px;">
            <!-- Encabezado premium -->
            <div class="flex items-center justify-between mb-20 gap-10">
                <div>
                    <h1 class="text-xl font-black uppercase tracking-wider mb-2" style="font-family:'Archivo Expanded', sans-serif;">
                        <span style="color:var(--c-success); margin-right:4px;">|</span> ${Icons.fitosanitario()} LIBRO FITOSANITARIO
                    </h1>
                    <p class="text-xs font-bold uppercase tracking-tight text-gray-400 m-0">Cuaderno de campo y tratamientos de parcelas (RD 787/2023)</p>
                </div>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-3 sm:gap-6 sm:mb-20 font-sans">
                <div class="card p-6 text-center" style="background:var(--surface-card); border:1px solid var(--border-subtle); min-height: 100px;">
                    <span class="text-gray-500 font-950 uppercase text-[0.5rem] tracking-wider mb-2 leading-tight min-w-0 break-words">INVERSIÓN TOTAL</span>
                    <span class="text-white font-black text-sm block" style="font-family:'IBM Plex Mono', monospace; color:var(--c-success);">${totalInversion.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                </div>
                <div class="card p-6 text-center" style="background:var(--surface-card); border:1px solid var(--border-subtle); min-height: 100px;">
                    <span class="text-gray-500 font-950 uppercase text-[0.5rem] tracking-wider mb-2 leading-tight min-w-0 break-words">APLICACIONES</span>
                    <span class="text-white font-black text-sm block" style="font-family:'IBM Plex Mono', monospace;">${numRegistros}</span>
                </div>
                <div class="card p-6 text-center" style="background:var(--surface-card); border:1px solid var(--border-subtle); min-height: 100px;">
                    <span class="text-gray-500 font-950 uppercase text-[0.5rem] tracking-wider mb-2 leading-tight min-w-0 break-words">ZONAS TRATADAS</span>
                    <span class="text-white font-black text-sm block" style="font-family:'IBM Plex Mono', monospace;">${zonasTratadas.size}</span>
                </div>
            </div>

            <!-- Acciones Rápidas -->
            <div class="mb-20">
                <button class="widget-link-btn widget-link-btn--neon neon-success w-full flex items-center justify-center gap-8 py-14" 
                        onclick="FitosanitariosView._exportarPDF()" style="border-color:var(--c-success); color:var(--c-success);">
                    ${Icons.documento()} <span class="font-950 uppercase tracking-wider text-xs">EXPORTAR LIBRO FITOSANITARIO OFICIAL (PDF)</span>
                </button>
            </div>

            <!-- Historial de Aplicaciones -->
            <div class="card p-16 font-sans" style="background:var(--surface); border:1px solid var(--border-subtle);">
                <h3 class="text-xs font-black uppercase tracking-widest text-gray-400 mb-15 flex items-center gap-6" style="justify-content: space-between;">
                    <span class="flex items-center gap-6"><span style="color:var(--c-success);">|</span> ${Icons.historial()} TRATAMIENTOS Y COMPRAS REGISTRADAS</span>
                    <span class="flex gap-4">
                        <button class="btn-erp-secondary btn-sm" id="btn-fito-vista-cards" onclick="FitosanitariosView._setVistaModo('cards')">Tarjetas</button>
                        <button class="btn-erp-secondary btn-sm" id="btn-fito-vista-tabla" onclick="FitosanitariosView._setVistaModo('tabla')">Tabla ERP</button>
                    </span>
                </h3>
                <fieldset class="erp-action-group">
                  <legend>Registro de Tratamientos Fitosanitarios</legend>
                  <div class="erp-action-group-body">
                    <button class="widget-link-btn widget-link-btn--neon neon-success" data-guide="btn-nuevo-registro" onclick="FitosanitariosView._nuevoTratamiento()">${Icons.agregar()}<span class="widget-link-label">Registrar Tratamiento</span></button>
                  </div>
                </fieldset>

                <div class="erp-filtros" data-filtros-para="fito-lista">
                  <input type="search" class="form-input search-input" placeholder="Buscar tratamiento por producto, parcela o fecha...">
                  <select class="form-select" data-etiqueta-todos="Toda categoría"></select>
                </div>
                <div id="fito-lista" data-ver-mas="10">
                ${this._cachedRegistros.length === 0 ? `
                <div class="empty-state py-40 text-center">
                    <div class="empty-state-icon mb-10" style="color:var(--c-success);">${Icons.fitosanitario()}</div>
                    <p class="empty-state-text text-gray-500 font-bold uppercase text-xs">No hay registros fitosanitarios cargados en esta finca.</p>
                    <div class="text-center mt-20"><button class="widget-link-btn widget-link-btn--neon neon-success" onclick="FitosanitariosView._nuevoTratamiento()" data-guide="btn-vacio-fitosanitarios">${Icons.agregar()}<span class="widget-link-label">Registrar primer Tratamiento</span></button></div>
                </div>
                ` : `
                ${this._cachedRegistros.map(r => this._renderRegistroItem(r)).join('')}
                `}
                </div>
                <div id="fito-erp-table-container" class="mt-12" style="display:none;"></div>
            </div>

        </div>
        `;

        // Restaurar modo de vista (por defecto "tabla" en escritorio ≥ 1024px)
        const modoGuardado = localStorage.getItem('fitosanitarios_view_mode') || 'tabla';
        this._setVistaModo(modoGuardado, false);
    },

    _renderRegistroItem(r) {
        return `
        <div class="flex items-center justify-between gap-10 p-12 rounded-sm border border-222 hover:border-gray transition-all mb-10"
             data-tipo="${r.categoria || r.tipo || 'tratamiento'}"
             style="background:var(--bg); border:1px solid #1c1c1c; cursor:pointer;"
             onclick="FitosanitariosView._abrirFichaTratamiento(${r.id})"
             title="Ver Ficha Técnica de Tratamiento">
            <!-- flex-1: sin el, este bloque no reclama espacio dentro del
                 justify-between y se encoge hasta el ancho del icono, dejando
                 el titulo (truncate) con ancho 0, es decir invisible. -->
            <div class="flex items-center gap-10 min-w-0 flex-1">
                <div class="flex items-center justify-center rounded-sm flex-shrink-0" style="width:36px; height:36px; background:var(--surface); color:var(--c-success); border:1px solid var(--border-subtle);">
                    ${Icons.fitosanitario()}
                </div>
                <div class="min-w-0">
                    <div class="text-xs font-black text-white uppercase tracking-wider truncate">${r.concepto.toUpperCase()}</div>
                    <div class="flex items-center flex-wrap gap-x-6 gap-y-2 text-[0.6rem] font-bold text-gray-500 uppercase tracking-tight mt-2">
                        <span>${r.fecha}</span>
                        <span>•</span>
                        <span>ZONA: ${r.snap_zona || 'GENERAL'}</span>
                        ${r.factura ? `<span>•</span><span class="text-gray-400">FAC: ${r.factura.toUpperCase()}</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- Sin flex-shrink-0: este bloque reservaba su ancho maximo (240 de
                 300 px, por la etiqueta de categoria) y ahogaba al titulo de la
                 izquierda hasta dejarlo con ancho 0, es decir invisible. Solo el
                 importe se protege con .nowrap para que no se parta. -->
            <div class="text-right" style="font-family:'IBM Plex Mono', monospace; max-width:38%;">
                <div class="text-xs font-black text-white nowrap">${r.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
                <div class="text-[0.5rem] text-gray-500 font-950 uppercase mt-2">FITOSANITARIOS</div>
            </div>
        </div>
        `;
    },

    // ============================================
    // VISTA TABLA ERP (desktop)
    // ============================================

    _setVistaModo(modo, guardar = true) {
        this._vistaModo = modo;
        if (guardar) {
            try { localStorage.setItem('fitosanitarios_view_mode', modo); } catch (_) {}
        }

        const btnCards = document.getElementById('btn-fito-vista-cards');
        const btnTabla = document.getElementById('btn-fito-vista-tabla');
        const contenedorCards = document.getElementById('fito-lista');
        const contenedorTabla = document.getElementById('fito-erp-table-container');

        if (btnCards && btnTabla) {
            btnCards.style.background = modo === 'cards' ? 'var(--brand, #1F5FA8)' : 'transparent';
            btnTabla.style.background = modo === 'tabla' ? 'var(--brand, #1F5FA8)' : 'transparent';
        }

        if (modo === 'tabla') {
            if (contenedorCards) contenedorCards.style.display = 'none';
            if (contenedorTabla) {
                contenedorTabla.style.display = 'block';
                this._renderErpTable();
            }
        } else {
            if (contenedorTabla) contenedorTabla.style.display = 'none';
            if (contenedorCards) contenedorCards.style.display = 'block';
        }
    },

    _renderErpTable() {
        if (!window.ErpDataTable || !this._cachedRegistros) return;

        const tableData = this._cachedRegistros.map(r => {
            // Mismo cálculo de período de seguridad que la ficha
            const diasPlazo = Number(r.control_normativo?.plazoSeguridadDias) || 0;
            let apto = '—';
            let aptoColor = 'var(--text-d)';
            if (diasPlazo > 0) {
                const finPlazo = new Date(new Date(r.fecha).getTime() + (diasPlazo * 24 * 60 * 60 * 1000));
                const esSeguro = new Date() >= finPlazo;
                apto = esSeguro ? 'APTO' : `BLOQUEADO (${Math.max(0, Math.ceil((finPlazo - new Date()) / (24 * 60 * 60 * 1000)))}d)`;
                aptoColor = esSeguro ? 'var(--c-success)' : 'var(--c-danger)';
            }
            return {
                id: r.id,
                fecha: r.fecha || '—',
                concepto: r.concepto || '—',
                zona: (r.snap_zona || 'GENERAL').toUpperCase(),
                factura: r.factura ? r.factura.toUpperCase() : '—',
                plazo: diasPlazo > 0 ? diasPlazo : null,
                apto: apto,
                _aptoColor: aptoColor,
                monto: Number(r.monto) || 0
            };
        });

        new window.ErpDataTable({
            containerId: 'fito-erp-table-container',
            title: 'Registros fitosanitarios',
            pageSize: 15,
            columns: [
                {
                    key: 'fecha',
                    label: 'Fecha',
                    sortable: true,
                    render: (val) => val !== '—' ? new Date(val).toLocaleDateString('es-ES') : '—'
                },
                { key: 'concepto', label: 'Concepto', sortable: true },
                { key: 'zona', label: 'Zona', sortable: true },
                { key: 'factura', label: 'Factura', sortable: true },
                {
                    key: 'plazo',
                    label: 'Plazo seguridad',
                    sortable: true,
                    align: 'center',
                    render: (val) => val === null ? '—' : `${val} días`
                },
                {
                    key: 'apto',
                    label: 'Comercialización',
                    sortable: true,
                    render: (val, row) => `<span style="color:${row._aptoColor}; font-weight:700;">${val}</span>`
                },
                {
                    key: 'monto',
                    label: 'Inversión',
                    sortable: true,
                    align: 'right',
                    render: (val) => `<span style="font-weight:700;">${val.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>`
                },
                {
                    key: 'id',
                    label: 'Ficha',
                    sortable: false,
                    align: 'center',
                    render: (id) => `<button class="btn-erp-secondary btn-sm" onclick="FitosanitariosView._abrirFichaTratamiento(${id})">Ver Ficha</button>`
                }
            ],
            data: tableData
        }).render();
    },

    async _abrirFichaTratamiento(id) {
        const r = this._cachedRegistros.find(item => item.id === Number(id));
        if (!r) return;

        // Calcular período de seguridad
        const fechaTratamiento = new Date(r.fecha);
        const diasPlazo = Number(r.control_normativo?.plazoSeguridadDias) || 0;
        const fechaFinPlazo = new Date(fechaTratamiento.getTime() + (diasPlazo * 24 * 60 * 60 * 1000));
        const esSeguro = new Date() >= fechaFinPlazo;

        let badgeSeguridad = '';
        if (diasPlazo > 0) {
            badgeSeguridad = esSeguro 
                ? `<span class="badge badge-sm font-950 uppercase" style="background:rgba(204,255,0,0.1); color:var(--c-success); border:1px solid rgba(204,255,0,0.25);">PERÍODO DE SEGURIDAD COMPLETADO (APTO)</span>`
                : `<span class="badge badge-sm font-950 uppercase animate-pulse" style="background:rgba(255,68,68,0.1); color:var(--c-danger); border:1px solid rgba(255,68,68,0.25);">EN PERÍODO DE SEGURIDAD (BLOQUEADO HASTA ${fechaFinPlazo.toLocaleDateString('es-ES')})</span>`;
        } else {
            badgeSeguridad = `<span class="badge badge-sm font-950 uppercase text-gray-500" style="background:var(--surface-card); border:1px solid var(--border-subtle);">SIN PLAZO DE SEGURIDAD REQUERIDO</span>`;
        }

        const html = `
        <div class="card card-accent card-accent-purple p-20 max-w-[500px] w-full mx-10 overflow-y-auto max-h-[90vh]" style="background:var(--bg); border:1px solid var(--border-subtle);">
            <div class="flex justify-between items-center mb-15">
                <h3 class="text-md font-black uppercase tracking-wider text-white m-0" style="font-family:'Archivo Expanded', sans-serif;">
                    <span style="color:var(--c-success); margin-right:4px;">|</span> ${Icons.fitosanitario()} FICHA DE TRATAMIENTO
                </h3>
                <button onclick="ModalManager.close('ficha-tratamiento-modal')" class="widget-link-btn widget-link-btn--neon neon-danger p-6 min-h-0 h-auto">
                    ${Icons.cerrar()}
                </button>
            </div>

            <!-- Cabecera de Ficha -->
            <div class="mb-20 bg-[#141414] p-12 rounded-sm border border-222">
                <h2 class="text-sm font-black uppercase tracking-wider text-white m-0" style="font-family:'Archivo Expanded', sans-serif;">${r.concepto.toUpperCase()}</h2>
                <div class="flex items-center gap-6 text-[0.6rem] font-bold text-gray-500 uppercase tracking-tight mt-4">
                    <span>APLICACIÓN: ${r.fecha}</span>
                    <span>•</span>
                    <span>ZONA: ${r.snap_zona || 'GENERAL'}</span>
                </div>
                <div class="mt-8">${badgeSeguridad}</div>
            </div>

            <!-- Datos de Control Normativo (RD 787/2023) -->
            <div class="card p-12 mb-20" style="background:var(--surface-card); border:1px solid var(--border-subtle);">
                <h4 class="text-xs font-black uppercase tracking-widest text-gray-400 mb-10 flex items-center gap-6">
                    <span style="color:var(--c-success);">|</span> ${Icons.cuaderno()} CONTROL NORMATIVO Y REGISTROS
                </h4>
                <div class="grid grid-cols-2 gap-10 text-[0.65rem] font-black uppercase">
                    <div style="background:#080808; padding:8px; border:1px solid #1c1c1c; border-radius:4px;">
                        <span class="text-gray-500 block mb-2 text-[0.55rem]">REGISTRO PRODUCTO</span>
                        <span class="text-white block font-black" style="font-family:'IBM Plex Mono', monospace;">${r.control_normativo?.registroProducto || '—'}</span>
                    </div>
                    <div style="background:#080808; padding:8px; border:1px solid #1c1c1c; border-radius:4px;">
                        <span class="text-gray-500 block mb-2 text-[0.55rem]">DOSIS APLICADA</span>
                        <span class="text-white block font-black" style="font-family:'IBM Plex Mono', monospace;">${r.control_normativo?.dosisAplicada || '—'}</span>
                    </div>
                    <div style="background:#080808; padding:8px; border:1px solid #1c1c1c; border-radius:4px;">
                        <span class="text-gray-500 block mb-2 text-[0.55rem]">PLAZO DE SEGURIDAD</span>
                        <span class="text-white block font-black" style="font-family:'IBM Plex Mono', monospace;">${diasPlazo} DÍAS</span>
                    </div>
                    <div style="background:#080808; padding:8px; border:1px solid #1c1c1c; border-radius:4px;">
                        <span class="text-gray-500 block mb-2 text-[0.55rem]">APTO COMERC.</span>
                        <span class="block font-black" style="color:${(r.control_normativo?.aptoComercializacion !== false) ? 'var(--c-success)' : 'var(--c-danger)'};">
                            ${(r.control_normativo?.aptoComercializacion !== false) ? 'APTO' : 'BLOQUEADO'}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Datos Económicos -->
            <div class="card p-12 mb-20" style="background:var(--surface-card); border:1px solid var(--border-subtle);">
                <h4 class="text-xs font-black uppercase tracking-widest text-gray-400 mb-10 flex items-center gap-6">
                    <span style="color:var(--c-success);">|</span> ${Icons.dinero()} DATOS ECONÓMICOS
                </h4>
                <div class="flex justify-between items-center text-xs font-black uppercase">
                    <div>
                        <span class="text-gray-500 text-[0.55rem] block mb-2">INVERSIÓN TOTAL</span>
                        <strong class="text-white font-black text-sm" style="font-family:'IBM Plex Mono', monospace; color:var(--c-success);">${r.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong>
                    </div>
                    ${r.factura ? `
                    <div class="text-right">
                        <span class="text-gray-500 text-[0.55rem] block mb-2">FACTURA VINCULADA</span>
                        <span class="text-gray-300 font-bold" style="font-family:'IBM Plex Mono', monospace;">${r.factura.toUpperCase()}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- Botones de Acción -->
            <div class="grid grid-cols-2 gap-8 border-top-222 pt-15">
                <button class="btn btn-sm btn-dark flex items-center gap-6 justify-center" 
                        onclick="ModalManager.close('ficha-tratamiento-modal'); FitosanitariosView._editarTratamiento(${r.id});" style="min-height:44px;">
                    ${Icons.editar()} <span class="font-950 uppercase tracking-wider text-[0.65rem]">EDITAR</span>
                </button>
                <button class="btn btn-sm btn-dark flex items-center gap-6 justify-center text-red" 
                        onclick="ModalManager.close('ficha-tratamiento-modal'); FitosanitariosView._eliminarTratamiento(${r.id});" style="min-height:44px; color:var(--c-danger);">
                    ${Icons.eliminar()} <span class="font-950 uppercase tracking-wider text-[0.65rem]">ELIMINAR</span>
                </button>
            </div>
        </div>
        `;

        ModalManager.show('ficha-tratamiento-modal', html, { closeOnOverlayClick: true });
    },

    async _editarTratamiento(id) {
        const r = this._cachedRegistros.find(item => item.id === Number(id));
        if (!r) return;

        if (window.GastoWizard) {
            window.GastoWizard.open({
                id: r.id,
                fecha: r.fecha,
                concepto: r.concepto,
                monto: r.monto,
                categoria: r.categoria,
                snap_zona: r.snap_zona,
                proveedorId: r.proveedorId,
                origenModulo: r.origen_modulo,
                modoExplotacion: r.modo_explotacion,
                controlNormativo: {
                    registroProducto: r.control_normativo?.registroProducto || '',
                    dosisAplicada: r.control_normativo?.dosisAplicada || '',
                    plazoSeguridadDias: r.control_normativo?.plazoSeguridadDias || 0,
                    aptoComercializacion: r.control_normativo?.aptoComercializacion !== false
                },
                onComplete: async () => {
                    await this._cargarDatos();
                    const main = document.getElementById('app-content');
                    if (main) this._renderContenido(main);
                }
            });
        }
    },

    async _eliminarTratamiento(id) {
        const ok = await Confirm.confirm('Eliminar registro', '¿Estás seguro de que deseas eliminar permanentemente este registro fitosanitario?', true, 'Eliminar', 'Cancelar');
        if (!ok) return;

        try {
            await Gastos.delete(id);
            Toast.show('Registro fitosanitario eliminado con éxito.', 'success');
            await this._cargarDatos();
            const main = document.getElementById('app-content');
            if (main) this._renderContenido(main);
        } catch (e) {
            Toast.show('Error al eliminar: ' + e.message, 'error');
        }
    },

    _nuevoTratamiento() {
        if (window.GastoWizard) {
            // Abrimos el GastoWizard con la categoría "Fitosanitarios" por defecto
            window.GastoWizard.open({
                categoria: 'Fitosanitarios',
                onComplete: async () => {
                    await this._cargarDatos();
                    const main = document.getElementById('app-content');
                    if (main) this._renderContenido(main);
                }
            });
        } else {
            Toast.show('Error: Wizard de gastos no cargado', 'error');
        }
    },

    async _exportarPDF() {
        if (window.InformesView && window.InformesView._ejecutarExportarPDFSeccion) {
            Toast.show('Generando Libro Fitosanitario Oficial PDF...', 'info');
            // InformesView tiene un método para generar sección individual a PDF
            window.InformesView._ejecutarExportarPDFSeccion('fitosanitario');
        } else {
            Toast.show('Error: Motor de informes PDF no disponible', 'error');
        }
    }
};

window.FitosanitariosView = FitosanitariosView;
