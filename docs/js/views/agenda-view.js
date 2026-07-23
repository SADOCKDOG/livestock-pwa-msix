/**
 * Livestock Manager - AgendaView v1.0.0
 * Vista central de planificación: tareas, recordatorios y alertas de usuario.
 */

const AgendaView = {
    _filtroModulo: 'todos',
    _filtroEstado: 'pendiente',

    async render(params) {
        const main = document.getElementById("app-content");
        const fincaId = await window.Fincas.getActiveId();
        if (!fincaId) {
            main.innerHTML = `<div class="p-20 text-center"><p class="text-gray">Sin finca activa.</p></div>`;
            return;
        }

        const tareas = await window.AgendaService.list(fincaId, {
            modulo_id: this._filtroModulo === 'todos' ? null : this._filtroModulo,
            estado: this._filtroEstado
        });

        const modulos = [
            { id: 'todos', label: 'TODOS', icon: Icons.buscar() },
            { id: 'gegan', label: 'ANIMALES', icon: Icons.animales() },
            { id: 'rebanos', label: 'REBAÑOS', icon: Icons.rebanos() },
            { id: 'silos', label: 'SILOS', icon: Icons.silos() },
            { id: 'sanidad', label: 'SANIDAD', icon: Icons.sanidad() },
            { id: 'carnico', label: 'CARNE', icon: Icons.carne() },
            { id: 'lacteos', label: 'LECHE', icon: Icons.leche() },
            { id: 'contratos', label: 'VENTAS', icon: Icons.contratos() }
        ];

        main.innerHTML = `
            <div class="px-4">
                <div class="module-header">
                    <div class="module-header-kpis">
                        <span class="module-mode-chip" style="--mode-color: var(--p-gold);">${Icons.objetivo()} AGENDA DE TRABAJO</span>
                        <div class="module-header-kpi">
                            <span class="module-header-kpi-label">Pendientes</span>
                            <span class="module-header-kpi-value">${tareas.length}</span>
                        </div>
                    </div>
                    <div class="module-header-primary-action">
                        <button class="btn btn-create btn-lg" onclick="window.WizardTarea.open({ onComplete: () => AgendaView.render() })">
                            ${Icons.fabPlus()} Nueva Tarea
                        </button>
                    </div>
                </div>

                <!-- Filtros de Agenda -->
                <div class="mb-14">
                    <div class="flex gap-8 overflow-x-auto pb-4 no-scrollbar" id="agenda-modulo-filters">
                        ${modulos.map(m => `
                            <button onclick="AgendaView._setFiltroModulo('${m.id}')"
                                    class="chip-filter ${this._filtroModulo === m.id ? 'active' : ''}"
                                    style="${this._filtroModulo === m.id ? 'border-color: var(--p-gold); color: var(--p-gold);' : ''}">
                                ${m.label}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="flex gap-10 mb-14">
                    <button onclick="AgendaView._setFiltroEstado('pendiente')" class="btn btn-sm flex-1 ${this._filtroEstado === 'pendiente' ? 'btn--gold' : 'btn-secondary'}">Pendientes</button>
                    <button onclick="AgendaView._setFiltroEstado('completada')" class="btn btn-sm flex-1 ${this._filtroEstado === 'completada' ? 'btn--success' : 'btn-secondary'}">Completadas</button>
                </div>

                <div class="grid gap-10">
                    ${this._renderTareasList(tareas)}
                </div>
            </div>

            <div class="fab-container" onclick="window.WizardTarea.open({ onComplete: () => AgendaView.render() })">
                <span class="fab-label">Programar</span>
                <button class="fab-btn">${Icons.fabPlus()}</button>
            </div>
        `;
    },

    _renderTareasList(tareas) {
        if (tareas.length === 0) {
            return `<div class="empty-state py-40 text-center border-222">
                <div class="empty-state-icon text-gray-700" style="font-size: 2.5rem; margin-bottom: 15px;">${Icons.objetivo()}</div>
                <p class="empty-state-text text-gray-500 font-bold uppercase text-xs">No hay tareas planificadas en este segmento.</p>
            </div>`;
        }

        return tareas.map(t => {
            const hoy = new Date().toISOString().split('T')[0];
            const esVencida = t.estado === 'pendiente' && t.fecha_planificada < hoy;
            const colorPrioridad = t.prioridad === 'alta' ? 'var(--c-danger)' : t.prioridad === 'media' ? 'var(--c-warning)' : 'var(--c-success)';

            return `
                <div class="card p-12 border-222 relative" style="border-left: 4px solid ${colorPrioridad}; background: ${t.es_alerta ? 'linear-gradient(135deg, rgba(255,0,0,0.05), transparent)' : ''}">
                    <div class="flex justify-between items-start gap-10">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-6 mb-2">
                                <span class="text-[0.6rem] font-950 uppercase tracking-tighter px-6 py-2 rounded-sm" style="background: color-mix(in srgb, ${colorPrioridad} 15%, transparent); color: ${colorPrioridad}; border: 1px solid color-mix(in srgb, ${colorPrioridad} 30%, transparent);">
                                    ${t.modulo_id.toUpperCase()}
                                </span>
                                ${t.es_alerta ? `<span class="text-red animate-pulse">${Icons.alerta()}</span>` : ''}
                                ${esVencida ? `<span class="text-[0.6rem] font-950 text-red uppercase tracking-widest">VENCIDA</span>` : ''}
                            </div>
                            <h4 class="text-sm font-950 text-white uppercase truncate">${t.titulo}</h4>
                            <p class="text-[0.7rem] text-gray-400 font-bold uppercase mt-2">
                                ${Icons.calendar()} ${UI.formatDate(t.fecha_planificada)}
                            </p>
                        </div>
                        <div class="flex flex-col gap-6 items-end">
                            ${t.estado === 'pendiente' ? `
                                <button onclick="AgendaView._completarTarea(${t.id})" class="btn btn-sm btn-success px-10 py-6 min-h-0 h-auto">
                                    ${Icons.check()} OK
                                </button>
                            ` : `
                                <span class="text-green text-xs font-black uppercase">${Icons.check()} Hecho</span>
                            `}
                        </div>
                    </div>
                    ${t.descripcion ? `<p class="text-xs text-gray-500 mt-8 border-top-222 pt-8 italic line-clamp-2">${t.descripcion}</p>` : ''}

                    <div class="flex justify-between mt-10">
                        <button onclick="window.WizardTarea.open({ id: ${t.id}, onComplete: () => AgendaView.render() })" class="text-[0.6rem] font-950 text-blue-400 uppercase no-underline">Editar</button>
                        <button onclick="AgendaView._eliminarTarea(${t.id})" class="text-[0.6rem] font-950 text-red-500 uppercase no-underline">Eliminar</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    async _setFiltroModulo(moduloId) {
        this._filtroModulo = moduloId;
        await this.render();
    },

    async _setFiltroEstado(estado) {
        this._filtroEstado = estado;
        await this.render();
    },

    async _completarTarea(id) {
        await window.AgendaService.completar(id);
        App.toast("Tarea marcada como completada", "success");
        await this.render();
    },

    async _eliminarTarea(id) {
        if (!await Confirm.confirm("Eliminar Tarea", "¿Eliminar esta tarea de la agenda de forma permanente?", true)) return;
        await window.AgendaService.delete(id);
        App.toast("Tarea eliminada", "info");
        await this.render();
    },

    /**
     * Renderiza un pequeño widget de tareas para ser embebido en otros dashboards.
     */
    async renderWidget(container, moduloId = null) {
        if (!container) return;
        const fincaId = await window.Fincas.getActiveId();
        if (!fincaId) return;

        const tareas = await window.AgendaService.list(fincaId, {
            modulo_id: moduloId,
            estado: 'pendiente'
        });

        if (tareas.length === 0) return;

        const hoy = new Date().toISOString().split('T')[0];
        const colorModulo = moduloId === 'silos' ? 'var(--c-success)' : moduloId === 'almacen' ? 'var(--c-purple)' : 'var(--p-gold)';

        container.innerHTML = `
            <div class="mt-14 mb-14">
                <div class="inf-section-title mb-10 flex items-center justify-between gap-8 uppercase font-900 tracking-wider text-[0.7rem] text-gray">
                    <span><span style="color: ${colorModulo}; margin-right: 4px;">|</span> ${Icons.objetivo()} TAREAS PENDIENTES</span>
                    <a href="#/agenda" class="text-blue-400 no-underline font-950" style="font-size: 0.6rem;">VER AGENDA -></a>
                </div>
                <div class="grid gap-8">
                    ${tareas.slice(0, 3).map(t => {
                        const esVencida = t.fecha_planificada < hoy;
                        const colorPrio = t.prioridad === 'alta' ? 'var(--c-danger)' : t.prioridad === 'media' ? 'var(--c-warning)' : 'var(--c-success)';
                        return `
                            <div class="card p-10 border-222 flex justify-between items-center bg-black" style="border-left: 3px solid ${colorPrio};">
                                <div class="min-w-0 flex-1">
                                    <div class="text-[0.75rem] font-900 text-white truncate uppercase">${t.titulo}</div>
                                    <div class="text-[0.55rem] font-800 uppercase mt-2 ${esVencida ? 'text-red' : 'text-gray-500'}">
                                        ${Icons.calendar()} ${UI.formatDate(t.fecha_planificada)} ${esVencida ? '· VENCIDA' : ''}
                                    </div>
                                </div>
                                <button onclick="AgendaView._completarTareaRapido(${t.id}, '${moduloId}')" class="btn btn-sm btn-secondary px-8 py-4 min-h-0 h-auto font-950 text-[0.6rem] ml-10">OK</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    async _completarTareaRapido(id, moduloId) {
        await window.AgendaService.completar(id);
        App.toast("Tarea completada", "success");
        // Recargar el dashboard que corresponda
        if (moduloId === 'silos' || moduloId === 'almacen') {
            if (window.ExplotacionView) await ExplotacionView.render();
        } else {
            App.route();
        }
    }
};

window.AgendaView = AgendaView;
