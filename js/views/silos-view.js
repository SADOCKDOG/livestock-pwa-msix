/**
 * Livestock Manager - SilosView v1.0.0
 * Vista para la gestión y calibración de silos de pienso y almacenamiento de alimento.
 */

const SilosView = {
    _cachedSilos: [],

    async render() {
        const main = document.getElementById('expro-tab-content') || document.getElementById('app-content');
        main.innerHTML = `<div class="text-center p-40"><div class="loader">Cargando silos...</div></div>`;

        try {
            await this._cargarSilos();
            this._renderContenido(main);
        } catch (e) {
            console.error('[SilosView] Error:', e);
            main.innerHTML = `<div class="card text-center p-40 text-red">Error al cargar la gestión de silos: ${e.message}</div>`;
        }
    },

    async _cargarSilos() {
        try {
            const activeFincaId = await Fincas.getActiveId().catch(() => null);
            this._cachedSilos = activeFincaId
                ? await window.db.getAllFromIndex('config_silos', 'fincaId', activeFincaId)
                : await window.db.getAll('config_silos');
        } catch (err) {
            console.warn('[SilosView] No se pudo acceder a config_silos:', err);
            this._cachedSilos = [];
        }
        await this._calcularAutonomia();
    },

    /** Calcula días de autonomía por silo a partir del consumo real de los últimos 30 días (registro_eventos tipo silo_consumo). */
    async _calcularAutonomia() {
        try {
            const eventos = await window.db.getAll('registro_eventos').catch(() => []);
            const hace30dias = new Date();
            hace30dias.setDate(hace30dias.getDate() - 30);
            const consumos = eventos.filter(e => e.tipo === 'silo_consumo' && new Date(e.fecha) >= hace30dias);
            this._cachedSilos.forEach(s => {
                const delSilo = consumos.filter(e => Number(e.entidad_id) === Number(s.id));
                if (!delSilo.length) { s.diasAutonomia = null; return; }
                const totalConsumido = delSilo.reduce((acc, e) => acc + (Number(e.valor_neto) || 0), 0);
                const fechas = delSilo.map(e => new Date(e.fecha).getTime());
                const diasTranscurridos = Math.max(1, Math.ceil((Date.now() - Math.min(...fechas)) / (1000 * 60 * 60 * 24)));
                const consumoDiario = totalConsumido / diasTranscurridos;
                s.diasAutonomia = consumoDiario > 0 ? Math.round((Number(s.cantidadActual) || 0) / consumoDiario) : null;
            });
        } catch (e) {
            console.warn('[SilosView] No se pudo calcular autonomía:', e);
        }
    },

    /**
     * Obtiene la lista de silos, cargándola si es necesario
     * @returns {Promise<Array>} Lista de silos
     */
    async _getSilos() {
        // Si no tenemos silos en caché, los cargamos
        if (this._cachedSilos.length === 0) {
            await this._cargarSilos();
        }
        return this._cachedSilos;
    },

    _renderContenido(container) {
        const totalCapacidad = this._cachedSilos.reduce((acc, s) => acc + (Number(s.capacidad) || 0), 0);
        const totalActual = this._cachedSilos.reduce((acc, s) => acc + (Number(s.cantidadActual) || 0), 0);
        const pctMedio = totalCapacidad > 0 ? Math.round((totalActual / totalCapacidad) * 100) : 0;

        // Calcular silos críticos con stock < 15%
        const silosCriticos = this._cachedSilos.filter(s => {
            const pct = s.capacidad > 0 ? Math.round((s.cantidadActual / s.capacidad) * 100) : 0;
            return pct < 15;
        });

        let alertaSiloHtml = '';
        if (silosCriticos.length > 0) {
            alertaSiloHtml = `
            <!-- Alerta Bento de Stock Crítico -->
            <div class="card p-14 mb-20 border-222 card-resumen" style="background: rgba(255, 68, 68, 0.03); border-left: 4px solid var(--c-danger);">
                <div class="text-xs text-white font-black uppercase tracking-wider mb-6 flex items-center justify-between gap-6">
                    <span class="flex items-center gap-6 text-red" style="color:var(--c-danger);">
                        ${Icons.alerta()} ALERTA TELEMÉTRICA DE ALIMENTACIÓN: STOCK BAJO (<15%)
                    </span>
                </div>
                <p class="text-[0.65rem] text-gray font-bold uppercase tracking-wide m-0 mb-10">
                    Los siguientes silos requieren reabastecimiento inmediato para evitar interrupciones nutricionales en el ganado:
                </p>
                <div class="flex flex-col gap-6">
                    ${silosCriticos.map(s => {
                        const pct = s.capacidad > 0 ? Math.round((s.cantidadActual / s.capacidad) * 100) : 0;
                        return `
                        <div class="flex items-center justify-between gap-8 p-8 rounded-sm bg-[#080808] border border-[#1a1a1a]">
                            <span class="text-[0.65rem] font-black text-white uppercase truncate min-w-0">${s.nombre} (${s.alimento})</span>
                            <span class="text-xs font-mono font-950 text-red flex-shrink-0 truncate min-w-0" style="color:var(--c-danger); max-width:150px;">${s.cantidadActual.toLocaleString()} kg / ${s.capacidad.toLocaleString()} kg (${pct}%)</span>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            `;
        }

        container.innerHTML = `
        <div class="p-16 max-w-[900px] mx-auto animate-fade-in" style="min-height: calc(100vh - 120px); padding-bottom: 80px;">
            <!-- Encabezado con estilo premium -->
            <div class="flex items-center justify-between mb-20 gap-10">
                <div>
                    <h1 class="text-xl font-black uppercase tracking-wider mb-2" style="font-family:'Archivo Expanded', sans-serif;">
                        <span style="color:var(--p-gold); margin-right:4px;">|</span> ${Icons.explotacion()} CONTROL DE SILOS
                    </h1>
                    <p class="text-xs font-bold uppercase tracking-tight text-gray-400 m-0">Telemetría de alimentación y almacenamiento</p>
                </div>
            </div>

            <!-- KPIs superiores (OLED dark design) -->
            <div class="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-3 sm:gap-6 sm:mb-20">
                <div class="card p-6 text-center flex flex-col justify-between" style="background:#111; border:1px solid #222; min-height: 100px;">
                    <span class="text-gray-500 font-950 uppercase text-[0.5rem] tracking-wider mb-2 leading-tight min-w-0 break-words">CAPACIDAD TOTAL</span>
                    <span class="text-white font-black text-sm block" style="font-family:'IBM Plex Mono', monospace;">${totalCapacidad.toLocaleString()} kg</span>
                </div>
                <div class="card p-6 text-center flex flex-col justify-between" style="background:#111; border:1px solid #222; min-height: 100px;">
                    <span class="text-gray-500 font-950 uppercase text-[0.5rem] tracking-wider mb-2 leading-tight min-w-0 break-words">ALMACENADO</span>
                    <span class="text-white font-black text-sm block" style="font-family:'IBM Plex Mono', monospace; color:var(--p-gold);">${totalActual.toLocaleString()} kg</span>
                </div>
                <div class="card p-6 text-center flex flex-col justify-between" style="background:#111; border:1px solid #222; min-height: 100px;">
                    <span class="text-gray-500 font-950 uppercase text-[0.5rem] tracking-wider mb-2 leading-tight min-w-0 break-words">OCUPACIÓN MEDIA</span>
                    <span class="text-white font-black text-sm block" style="font-family:'IBM Plex Mono', monospace; color:var(--c-success);">${pctMedio}%</span>
                </div>
            </div>

            ${alertaSiloHtml}

            <!-- Listado de Silos -->
            <div class="flex flex-col gap-15 font-sans">
                ${this._cachedSilos.length === 0
                    ? `<div class="empty-state"><div class="empty-state-icon">${Icons.explotacion()}</div><p class="empty-state-text">Sin silos registrados.</p><div class="text-center mt-20"><button class="btn btn-create btn-lg" onclick="SilosView._abrirFormularioSilo()">${Icons.agregar()} Registrar primer silo</button></div></div>`
                    : this._cachedSilos.map(s => this._renderSiloCard(s)).join('')}
            </div>

            <!-- FAB (Botón de Acción Flotante) Premium -->
            <div class="fab-container" style="--fab-neon-color: var(--c-success);" onclick="SilosView._abrirFormularioSilo()">
                <span class="fab-label">Nuevo Silo</span>
                <button class="fab-btn">${Icons.fabPlus()}</button>
            </div>
        </div>
        `;
    },

    _renderSiloCard(s) {
        const pct = s.capacidad > 0 ? Math.round((s.cantidadActual / s.capacidad) * 100) : 0;
        // Calcular dashoffset para un círculo de radio 54 (perímetro = 2 * PI * 54 = 339.3)
        // 100% ocupado es dashoffset 0. 0% ocupado es dashoffset 339.3
        const r = 54;
        const circ = 2 * Math.PI * r; // ~339.29
        const offset = circ - (pct / 100) * circ;

        let colorAlerta = 'var(--c-success)'; // verde
        if (pct < 15) colorAlerta = 'var(--c-danger)'; // rojo coral
        else if (pct < 35) colorAlerta = 'var(--p-gold)'; // amarillo oro

        return `
        <div class="card card-dark-gradient p-16 relative overflow-hidden flex flex-col md:flex-row gap-15 items-center justify-between animate-fade-in" id="silo-card-${s.id}" style="border:1px solid #222; background:#181818;">
            <div class="flex flex-col md:flex-row items-center gap-15 w-full md:w-auto">
                <!-- Telemetría circular táctil -->
                <div class="silo-gauge-container relative" onclick="SilosView._recalibrarSilo(${s.id})" style="cursor: pointer; width: 120px; height: 120px;" title="Presiona para calibrar sensores">
                    <svg width="120" height="120" viewBox="0 0 120 120" class="transform -rotate-90">
                        <circle cx="60" cy="60" r="${r}" fill="none" stroke="#222" stroke-width="10"></circle>
                        <circle class="fill-circle" id="silo-circle-${s.id}" cx="60" cy="60" r="${r}" fill="none" 
                                stroke="${colorAlerta}" stroke-width="10" stroke-linecap="round"
                                stroke-dasharray="${circ}" stroke-dashoffset="${offset}" style="transition: stroke-dashoffset 0.8s ease, stroke 0.8s ease;"></circle>
                    </svg>
                    <div class="gauge-overlay" style="position:absolute; inset:0; display:flex; flex-col; items-center; justify-content:center; flex-direction:column; text-align:center;">
                        <span class="gauge-overlay-text text-white font-black text-lg block m-0" style="font-family:'IBM Plex Mono', monospace; line-height:1;" id="silo-pct-text-${s.id}">${pct}%</span>
                        <small class="text-[0.5rem] text-gray-500 font-950 uppercase tracking-widest block mt-2">NIVEL</small>
                    </div>
                </div>

                <!-- Detalles del silo -->
                <div class="text-center md:text-left w-full md:w-auto" onclick="SilosView._abrirFichaSilo(${s.id})" style="cursor: pointer; flex: 1; min-width:0;" title="Ver ficha del silo">
                    <div class="flex items-center justify-center md:justify-start gap-8 mb-6" style="min-width:0;">
                        <h2 class="text-sm font-black uppercase tracking-wider text-white m-0 truncate min-w-0" style="font-family:'Archivo Expanded', sans-serif;">${s.nombre.toUpperCase()}</h2>
                        ${pct < 15 ? `<span class="badge badge-red text-[0.55rem] font-950 uppercase tracking-wider animate-pulse flex-shrink-0">BAJO STOCK</span>` : ''}
                        <span class="flex-shrink-0" style="font-size: 0.6rem; font-weight: 800; border: 1px solid var(--c-warning); color: var(--c-warning); background: rgba(255, 215, 0, 0.1); padding: 2px 6px; border-radius: 4px; margin-left: auto; display: inline-block;">Ficha →</span>
                    </div>
                    <p class="text-xs font-900 uppercase tracking-widest text-gray-400 mb-8 truncate">${s.alimento.toUpperCase()}</p>
                    <div class="grid grid-cols-2 gap-x-15 gap-y-4" style="font-family:'IBM Plex Mono', monospace;">
                        <div>
                            <span class="text-gray-500 font-900 text-[0.55rem] tracking-wider uppercase block">CANTIDAD</span>
                            <span class="text-white font-black text-xs block" id="silo-cant-text-${s.id}">${s.cantidadActual.toLocaleString()} / ${s.capacidad.toLocaleString()} kg</span>
                        </div>
                        <div>
                            <span class="text-gray-500 font-900 text-[0.55rem] tracking-wider uppercase block">ÚLTIMA CARGA</span>
                            <span class="text-white font-bold text-xs block">${s.fechaUltimaCarga || 'S/D'}</span>
                        </div>
                        <div>
                            <span class="text-gray-500 font-900 text-[0.55rem] tracking-wider uppercase block">AUTONOMÍA</span>
                            <span class="font-black text-xs block" style="color:${s.diasAutonomia == null ? '#666' : s.diasAutonomia <= 7 ? 'var(--c-danger)' : s.diasAutonomia <= 15 ? 'var(--c-warning)' : 'var(--c-success)'};">${s.diasAutonomia == null ? 'Sin datos' : s.diasAutonomia + ' días'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Acciones móviles grandes -->
            <div class="flex gap-10 w-full md:w-auto justify-end mt-10 md:mt-0 flex-wrap">
                <button class="btn btn-sm btn-dark flex items-center gap-6 justify-center" onclick="SilosView._abrirLlenarSilo(${s.id})" style="min-height:50px; flex:1; min-width:90px; border:1px solid #333;">
                    ${Icons.sanidad()} <span class="font-950 uppercase tracking-wider text-[0.65rem]">CARGAR</span>
                </button>
                <button class="btn btn-sm btn-dark flex items-center gap-6 justify-center" onclick="SilosView._abrirConsumirSilo(${s.id})" style="min-height:50px; flex:1; min-width:90px; border:1px solid #333;">
                    ${Icons.balanza()} <span class="font-950 uppercase tracking-wider text-[0.65rem]">CONSUMO</span>
                </button>
                <button class="btn btn-sm btn-dark flex items-center justify-center p-0" onclick="SilosView._abrirFormularioSilo(${s.id})" style="min-height:50px; width:50px; border:1px solid #333;" title="Editar Silo">
                    ${Icons.editar()}
                </button>
                <button class="btn btn-sm btn-dark flex items-center justify-center p-0 text-red" onclick="SilosView._eliminarSilo(${s.id})" style="min-height:50px; width:50px; border:1px solid #333;" title="Eliminar Silo">
                    ${Icons.eliminar()}
                </button>
            </div>
        </div>
        `;
    },

    async _abrirFichaSilo(id) {
        const silo = this._cachedSilos.find(s => s.id === Number(id));
        if (!silo) return;

        // Cargar eventos del silo
        const todosEventos = await window.db.getAllFromIndex('registro_eventos', 'fincaId', silo.fincaId).catch(() => []);
        const eventosSilo = todosEventos.filter(e => Number(e.unidad_destino) === silo.id).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

        const pct = silo.capacidad > 0 ? Math.round((silo.cantidadActual / silo.capacidad) * 100) : 0;
        let colorAlerta = 'var(--c-success)';
        if (pct < 15) colorAlerta = 'var(--c-danger)';
        else if (pct < 35) colorAlerta = 'var(--p-gold)';

        const r = 54;
        const circ = 2 * Math.PI * r;
        const offset = circ - (pct / 100) * circ;

        const html = `
        <div class="card card-accent card-accent-success p-20 max-w-[500px] w-full mx-10 overflow-y-auto max-h-[90vh]" style="background:#0C0C0C; border:1px solid #222;">
            <div class="flex justify-between items-center mb-15">
                <h3 class="text-md font-black uppercase tracking-wider text-white m-0" style="font-family:'Archivo Expanded', sans-serif;">
                    <span style="color:var(--p-gold); margin-right:4px;">|</span> ${Icons.finca()} FICHA TÉCNICA DE SILO
                </h3>
                <button onclick="ModalManager.close('ficha-silo-modal')" class="widget-link-btn widget-link-btn--neon neon-danger p-6 min-h-0 h-auto">
                    ${Icons.cerrar()}
                </button>
            </div>

            <!-- Cabecera Telemetría -->
            <div class="flex items-center gap-15 mb-20 bg-[#141414] p-12 rounded-sm border border-222">
                <div class="silo-gauge-container relative" style="width: 80px; height: 80px;">
                    <svg width="80" height="80" viewBox="0 0 120 120" class="transform -rotate-90">
                        <circle cx="60" cy="60" r="${r}" fill="none" stroke="#222" stroke-width="12"></circle>
                        <circle cx="60" cy="60" r="${r}" fill="none" 
                                stroke="${colorAlerta}" stroke-width="12" stroke-linecap="round"
                                stroke-dasharray="${circ}" stroke-dashoffset="${offset}"></circle>
                    </svg>
                    <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
                        <span class="text-white font-black text-xs block m-0" style="font-family:'IBM Plex Mono', monospace;">${pct}%</span>
                    </div>
                </div>
                <div>
                    <h2 class="text-sm font-black uppercase tracking-wider text-white m-0 truncate min-w-0" style="font-family:'Archivo Expanded', sans-serif;">${silo.nombre.toUpperCase()}</h2>
                    <p class="text-[0.65rem] font-black uppercase tracking-widest text-gray-400 mt-2 mb-4 truncate min-w-0">${silo.alimento.toUpperCase()}</p>
                    <span class="badge badge-sm font-950 uppercase" style="background:${pct < 15 ? 'rgba(255,68,68,0.1)' : 'rgba(204,255,0,0.1)'}; color:${pct < 15 ? 'var(--c-danger)' : 'var(--c-success)'}; border:1px solid ${pct < 15 ? 'rgba(255,68,68,0.25)' : 'rgba(204,255,0,0.25)'};">
                        ${pct < 15 ? 'STOCK BAJO' : 'STOCK ESTABLE'}
                    </span>
                </div>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-2 gap-10 mb-20">
                <div class="card p-10 text-center" style="background:#111; border:1px solid #222;">
                    <span class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-2 d-block">CAPACIDAD MÁXIMA</span>
                    <span class="text-white font-black text-xs block" style="font-family:'IBM Plex Mono', monospace;">${silo.capacidad.toLocaleString()} kg</span>
                </div>
                <div class="card p-10 text-center" style="background:#111; border:1px solid #222;">
                    <span class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-2 d-block">STOCK ACTUAL</span>
                    <span class="text-white font-black text-xs block" style="font-family:'IBM Plex Mono', monospace; color:${colorAlerta};">${silo.cantidadActual.toLocaleString()} kg</span>
                </div>
            </div>

            <!-- Historial de operaciones -->
            <div class="mb-20">
                <h4 class="text-xs font-black uppercase tracking-widest text-gray-400 mb-10 flex items-center gap-6">
                    <span style="color:var(--p-gold);">|</span> ${Icons.historial()} HISTORIAL DE MOVIMIENTOS
                </h4>
                <div class="flex flex-col gap-6" style="max-height: 200px; overflow-y: auto; padding-right: 4px;">
                    ${eventosSilo.length === 0 ? `
                        <div class="text-center py-15 text-gray-500 font-bold uppercase text-[0.6rem]">Sin movimientos registrados</div>
                    ` : eventosSilo.map(e => {
                        const isCarga = e.tipo_evento === 'carga_silo';
                        return `
                        <div class="flex justify-between items-center p-8 rounded-sm border border-222" style="background:#141414; border: 1px solid #1c1c1c;">
                            <div>
                                <span class="text-[0.6rem] font-black text-white uppercase block">${isCarga ? 'CARGA ALIMENTO' : 'CONSUMO RACIÓN'}</span>
                                <span class="text-[0.55rem] font-bold text-gray-500 block mt-2">${e.fecha}</span>
                            </div>
                            <strong class="text-xs font-black" style="font-family:'IBM Plex Mono', monospace; color:${isCarga ? 'var(--c-success)' : 'var(--c-danger)'};">
                                ${isCarga ? '+' : '-'}${e.detalles.match(/\d+(\.\d+)?/)?.[0] || '0'} kg
                            </strong>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Botones Rápidos -->
            <div class="grid grid-cols-3 gap-8 border-top-222 pt-15">
                <button class="btn btn-sm btn-dark flex items-center gap-6 justify-center" onclick="ModalManager.close('ficha-silo-modal'); SilosView._abrirLlenarSilo(${silo.id});" style="min-height:44px; padding:0 6px;">
                    <span class="font-950 uppercase tracking-wider text-[0.6rem]">CARGAR</span>
                </button>
                <button class="btn btn-sm btn-dark flex items-center gap-6 justify-center" onclick="ModalManager.close('ficha-silo-modal'); SilosView._abrirConsumirSilo(${silo.id});" style="min-height:44px; padding:0 6px;">
                    <span class="font-950 uppercase tracking-wider text-[0.6rem]">CONSUMO</span>
                </button>
                <button class="btn btn-sm btn-dark flex items-center gap-6 justify-center" onclick="ModalManager.close('ficha-silo-modal'); SilosView._abrirFormularioSilo(${silo.id});" style="min-height:44px; padding:0 6px;">
                    <span class="font-950 uppercase tracking-wider text-[0.6rem]">EDITAR</span>
                </button>
            </div>
        </div>
        `;
        ModalManager.show('ficha-silo-modal', html, { closeOnOverlayClick: true });
    },

    async _recalibrarSilo(id) {
        const silo = this._cachedSilos.find(s => s.id === Number(id));
        if (!silo) return;

        Toast.show(`Iniciando calibración telemétrica de sensores de ${silo.nombre}...`, 'warning');

        const circle = document.getElementById(`silo-circle-${id}`);
        const pctText = document.getElementById(`silo-pct-text-${id}`);
        const cantText = document.getElementById(`silo-cant-text-${id}`);

        if (!circle || !pctText) return;

        // Fase 1: Simular calibración de sensores (movimiento rápido de la aguja)
        circle.style.strokeDashoffset = '339.29'; // 0%
        pctText.textContent = '0%';
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        circle.style.strokeDashoffset = '0'; // 100%
        pctText.textContent = 'CAL';
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fase 2: Regresar al valor real guardado
        const realPct = silo.capacidad > 0 ? Math.round((silo.cantidadActual / silo.capacidad) * 100) : 0;
        const r = 54;
        const circ = 2 * Math.PI * r;
        const offset = circ - (realPct / 100) * circ;

        circle.style.strokeDashoffset = offset;
        pctText.textContent = `${realPct}%`;

        Toast.show(`Calibración de ${silo.nombre} completada con éxito. Sensores ópticos estables.`, 'success');
    },

    async _abrirLlenarSilo(id) {
        const silo = this._cachedSilos.find(s => s.id === Number(id));
        if (!silo) return;

        const maxCarga = silo.capacidad - silo.cantidadActual;

        let proveedores = [];
        try {
            proveedores = await window.db.getAll('proveedores').catch(() => []);
        } catch (err) {
            console.error('[SilosView] Error al listar proveedores para carga:', err);
        }

        const html = `
        <div class="card card-accent card-accent-gold p-16 max-w-[400px] w-full mx-10" style="background:#0C0C0C; border:1px solid #222;">
            <h3 class="text-md font-black uppercase tracking-wider mb-10 text-white" style="font-family:'Archivo Expanded', sans-serif;">
                <span style="color:var(--p-gold); margin-right:4px;">|</span> ${Icons.explotacion()} REGISTRAR RECARGA EN SILO
            </h3>
            <p class="text-xs text-gray-400 mb-15 font-medium uppercase tracking-tight">Silo: ${silo.nombre.toUpperCase()}<br>Espacio disponible: <b>${maxCarga.toLocaleString()} kg</b></p>
            
            <div class="flex flex-col gap-12 mb-20">
                <div>
                    <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">PROVEEDOR DE PIENSO / ALIMENTO</label>
                    <select id="load-proveedor-id" class="wizard-input font-bold uppercase" style="color:#fff; background:rgba(255,255,255,0.03); border:1px solid #27272a; height:38px; border-radius:4px; padding:0 10px; width:100%; display:block;">
                        <option value="">-- Selecciona Proveedor --</option>
                        ${proveedores.map(p => `<option value="${p.id}">${p.nombre.toUpperCase()} (${p.nif_cif || 'SIN NIF'})</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-10">
                    <div>
                        <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">CANTIDAD A CARGAR (kg)</label>
                        <input type="number" id="load-amount" class="wizard-input font-bold text-white bg-transparent" min="1" max="${maxCarga}" value="${Math.max(0, maxCarga)}" style="font-family:'IBM Plex Mono', monospace; height:38px; border:1px solid #27272a; padding:0 10px; border-radius:4px; width:100%;">
                    </div>
                    <div>
                        <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">COSTE DE FACTURA (€)</label>
                        <input type="number" id="load-cost" class="wizard-input font-bold text-white bg-transparent" min="0" value="0" step="0.01" style="font-family:'IBM Plex Mono', monospace; height:38px; border:1px solid #27272a; padding:0 10px; border-radius:4px; width:100%;">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-10">
                    <div>
                        <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">FECHA DE CARGA</label>
                        <input type="date" id="load-date" class="wizard-input font-bold text-white bg-transparent" value="${new Date().toISOString().split('T')[0]}" style="height:38px; border:1px solid #27272a; padding:0 10px; border-radius:4px; width:100%;">
                    </div>
                    <div>
                        <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">FAC. VINCULADA</label>
                        <input type="text" id="load-invoice" placeholder="FAC-2026-X" class="wizard-input font-bold text-white bg-transparent uppercase" style="height:38px; border:1px solid #27272a; padding:0 10px; border-radius:4px; width:100%;">
                    </div>
                </div>
            </div>

            <div class="flex gap-10 justify-end">
                <button class="btn btn-dark" onclick="ModalManager.close('load-silo-modal')">CANCELAR</button>
                <button class="btn btn-primary" onclick="SilosView._guardarCargaSilo(${id})">REGISTRAR</button>
            </div>
        </div>
        `;
        ModalManager.show('load-silo-modal', html, { closeOnOverlayClick: true });
    },

    async _guardarCargaSilo(id) {
        const silo = this._cachedSilos.find(s => s.id === Number(id));
        if (!silo) return;

        const amountInput = document.getElementById('load-amount');
        const dateInput = document.getElementById('load-date');
        const proveedorSelect = document.getElementById('load-proveedor-id');
        const costInput = document.getElementById('load-cost');
        const invoiceInput = document.getElementById('load-invoice');

        const amount = Number(amountInput?.value) || 0;
        const date = dateInput?.value || new Date().toISOString().split('T')[0];
        const proveedorId = proveedorSelect?.value ? Number(proveedorSelect.value) : null;
        const costeTotal = Number(costInput?.value) || 0;
        const factura = invoiceInput?.value ? invoiceInput.value.trim().toUpperCase() : '';

        if (amount <= 0) {
            Toast.show('Ingresa una cantidad válida a cargar', 'warning');
            return;
        }

        let proveedorNombre = '';
        if (proveedorId) {
            try {
                const provObj = await window.db.get('proveedores', proveedorId).catch(() => null);
                if (provObj) proveedorNombre = provObj.nombre;
            } catch (err) {
                console.error('[SilosView] Error al obtener proveedor:', err);
            }
        }

        const precioKg = amount > 0 ? (costeTotal / amount) : 0;

        const nuevaCantidad = Math.min(silo.capacidad, silo.cantidadActual + amount);
        silo.cantidadActual = nuevaCantidad;
        silo.fechaUltimaCarga = date;
        silo.precioUltimaCargaKg = precioKg; // Guardar precio unitario de referencia

        await window.db.put('config_silos', silo);
        ModalManager.close('load-silo-modal');

        // Registrar evento de carga en la finca para balance alimenticio y trazabilidad
        try {
            const activeFincaId = await Fincas.getActiveId();
            const nuevoGasto = {
                fincaId: activeFincaId,
                categoria: 'Alimentacion',
                concepto: `Recarga Silo: ${silo.nombre} (+${amount.toLocaleString()} kg de ${silo.alimento})`,
                monto: costeTotal, // Guardar coste real de factura
                fecha: date,
                siloId: id,
                proveedorId: proveedorId,
                proveedor: proveedorNombre,
                factura: factura,
                creadoEn: new Date().toISOString()
            };
            await window.db.add('gastos_ganaderia', nuevoGasto);
            
            // También registrar evento telemétrico de silo_pienso
            const observaciones = `Carga registrada en ${silo.nombre}. Nivel final: ${nuevaCantidad.toLocaleString()} kg.` + 
                (proveedorNombre ? ` Proveedor: ${proveedorNombre.toUpperCase()}.` : '') + 
                (costeTotal > 0 ? ` Coste: ${costeTotal.toLocaleString()} € (${precioKg.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} €/kg).` : '') +
                (factura ? ` Factura: ${factura}.` : '');

            const eventoSilo = {
                fincaId: activeFincaId,
                tipo: 'silo_carga',
                tipo_entidad: 'silo_pienso',
                entidad_id: id,
                fecha: date,
                motivo_tarea: 'alimentacion',
                valor_neto: amount,
                unidad: 'kg',
                observaciones: observaciones,
                creadoEn: new Date().toISOString()
            };
            await window.db.add('registro_eventos', eventoSilo);
        } catch (e) {
            console.error('[SilosView] No se pudo guardar el evento de carga:', e);
        }

        Toast.show(`Silo cargado correctamente. Iniciando sincronización de telemetría...`, 'success');
        this.render();
    },

    async _abrirConsumirSilo(id, rebanoPreseleccionado = null, onSaved = null) {
        const silo = this._cachedSilos.find(s => s.id === Number(id));
        if (!silo) return;
        this._consumoOnSaved = onSaved;

        let rebanos = [];
        try {
            rebanos = await window.Rebanos.list();
        } catch (err) {
            console.error('[SilosView] Error al listar rebaños:', err);
        }

        const html = `
        <div class="card card-accent card-accent-red p-16 max-w-[400px] w-full mx-10">
            <h3 class="text-md font-black uppercase tracking-wider mb-10 text-white" style="font-family:'Archivo Expanded', sans-serif;">
                <span style="color:var(--p-gold); margin-right:4px;">|</span> ${Icons.balanza()} REGISTRAR CONSUMO DE PIENSO
            </h3>
            <p class="text-xs text-gray-400 mb-15 font-medium uppercase tracking-tight">Silo: ${silo.nombre.toUpperCase()}<br>Nivel actual: <b>${silo.cantidadActual.toLocaleString()} kg</b></p>

            <div class="flex flex-col gap-12 mb-20">
                <div>
                    <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">REBAÑO / LOTE DESTINATARIO (OPCIONAL)</label>
                    <select id="consume-rebano-id" class="wizard-input font-bold uppercase" style="color:#fff; background:rgba(255,255,255,0.03); border:1px solid #27272a; height:38px; border-radius:4px; padding:0 10px; width:100%; display:block;">
                        <option value="">-- Consumo General --</option>
                        ${rebanos.map(r => `<option value="${r.id}" ${rebanoPreseleccionado && Number(rebanoPreseleccionado) === r.id ? 'selected' : ''}>${r.nombre.toUpperCase()} (${r.especie.toUpperCase()})</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-10">
                    <div>
                        <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">Nº DE SACOS</label>
                        <input type="number" id="consume-sacos" class="wizard-input font-bold" min="0" step="1" value="0" style="font-family:'IBM Plex Mono', monospace;" oninput="SilosView._recalcularConsumoTotal(${silo.cantidadActual})">
                    </div>
                    <div>
                        <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">KG POR SACO</label>
                        <input type="number" id="consume-kg-saco" class="wizard-input font-bold" min="0" step="0.5" value="0" style="font-family:'IBM Plex Mono', monospace;" oninput="SilosView._recalcularConsumoTotal(${silo.cantidadActual})">
                    </div>
                </div>
                <div class="text-center p-8 rounded-sm" style="background:rgba(255,255,255,0.03); border:1px solid #27272a;">
                    <span class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider">TOTAL A CONSUMIR</span>
                    <div id="consume-total-kg" class="text-white font-black text-lg">0 kg</div>
                    <input type="hidden" id="consume-amount" value="0">
                </div>
                <div>
                    <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">VALOR TOTAL (€, OPCIONAL)</label>
                    <input type="number" id="consume-valor" class="wizard-input font-bold" min="0" step="0.01" placeholder="Si se deja vacío, se calcula al precio de la última carga" style="font-family:'IBM Plex Mono', monospace;">
                </div>
                <div>
                    <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">FECHA DE CONSUMO</label>
                    <input type="date" id="consume-date" class="wizard-input font-bold" value="${new Date().toISOString().split('T')[0]}">
                </div>
            </div>

            <div class="flex gap-10 justify-end">
                <button class="btn btn-dark" onclick="ModalManager.close('consume-silo-modal')">CANCELAR</button>
                <button class="btn btn-primary" onclick="SilosView._guardarConsumoSilo(${id})" style="background-color:var(--c-danger); border-color:var(--c-danger);">REGISTRAR CONSUMO</button>
            </div>
        </div>
        `;
        ModalManager.show('consume-silo-modal', html, { closeOnOverlayClick: true });
    },

    /** Recalcula el total en kg (sacos × kg/saco) y lo refleja en el input oculto usado al guardar. */
    _recalcularConsumoTotal(maxStock) {
        const sacos = Number(document.getElementById('consume-sacos')?.value) || 0;
        const kgSaco = Number(document.getElementById('consume-kg-saco')?.value) || 0;
        const total = Math.round(sacos * kgSaco * 100) / 100;
        const totalEl = document.getElementById('consume-total-kg');
        const hiddenEl = document.getElementById('consume-amount');
        if (hiddenEl) hiddenEl.value = total;
        if (totalEl) {
            totalEl.textContent = `${total.toLocaleString('es-ES')} kg`;
            totalEl.style.color = total > maxStock ? 'var(--c-danger)' : '#fff';
        }
    },

    async _guardarConsumoSilo(id) {
        const silo = this._cachedSilos.find(s => s.id === Number(id));
        if (!silo) return;

        const amountInput = document.getElementById('consume-amount');
        const dateInput = document.getElementById('consume-date');
        const rebanoSelect = document.getElementById('consume-rebano-id');
        const sacos = Number(document.getElementById('consume-sacos')?.value) || 0;
        const kgPorSaco = Number(document.getElementById('consume-kg-saco')?.value) || 0;
        const valorInput = document.getElementById('consume-valor');

        const amount = Number(amountInput?.value) || 0;
        const date = dateInput?.value || new Date().toISOString().split('T')[0];
        const rebanoId = rebanoSelect?.value ? Number(rebanoSelect.value) : null;

        if (amount <= 0 || amount > silo.cantidadActual) {
            Toast.show('Ingresa nº de sacos y kg/saco válidos (el total no puede superar el stock)', 'warning');
            return;
        }

        let rebano = null;
        if (rebanoId) {
            try {
                rebano = await window.Rebanos.get(rebanoId);
            } catch (err) {
                console.error('[SilosView] Error al cargar rebaño para consumo:', err);
            }
        }

        const nuevaCantidad = silo.cantidadActual - amount;
        silo.cantidadActual = nuevaCantidad;

        // Coste real del consumo (base para el Índice de Conversión Alimenticia por lote):
        // se usa el valor introducido manualmente si lo hay; si no, se deriva del precio de la última carga.
        const valorManual = Number(valorInput?.value) || 0;
        const precioKg = Number(silo.precioUltimaCargaKg) || 0;
        const costeConsumo = valorManual > 0 ? valorManual : Math.round(precioKg * amount * 100) / 100;

        await window.db.put('config_silos', silo);
        ModalManager.close('consume-silo-modal');

        // Registrar evento de consumo de telemetría de silo_pienso (base del ICA por lote)
        try {
            const activeFincaId = await Fincas.getActiveId();
            const observaciones = rebano
                ? `Consumo de ${amount.toLocaleString()} kg (${sacos} sacos × ${kgPorSaco} kg) para Rebaño: "${rebano.nombre.toUpperCase()}" (${rebano.especie.toUpperCase()}). Silo: ${silo.nombre.toUpperCase()}. Restante: ${nuevaCantidad.toLocaleString()} kg.`
                : `Consumo general de ${amount.toLocaleString()} kg (${sacos} sacos × ${kgPorSaco} kg) registrado en ${silo.nombre.toUpperCase()}. Restante: ${nuevaCantidad.toLocaleString()} kg.`;

            const eventoSilo = {
                fincaId: activeFincaId,
                tipo: 'silo_consumo',
                tipo_entidad: 'silo_pienso',
                entidad_id: id,
                rebanoId: rebanoId, // VINCULACIÓN AL LOTE GANADERO
                fecha: date,
                motivo_tarea: 'alimentacion',
                valor_neto: amount,
                unidad: 'kg',
                num_sacos: sacos,
                kilos_por_saco: kgPorSaco,
                precioKgConsumo: precioKg,
                costeConsumo: costeConsumo,
                observaciones: observaciones,
                creadoEn: new Date().toISOString()
            };
            const eventoId = await window.db.add('registro_eventos', eventoSilo);

            // Si el consumo se imputa a un rebaño, generar también el gasto analítico correspondiente
            // (categoría Alimentación), para que aparezca en Gastos/Informes y en la ficha del rebaño.
            // Se enlaza al evento vía eventoConsumoId para no duplicar el importe entre ambas fuentes.
            if (rebanoId && window.Gastos) {
                try {
                    const gastoId = await Gastos.save({
                        fincaId: activeFincaId,
                        categoria: 'Alimentacion',
                        concepto: `Consumo de pienso: ${silo.alimento || silo.nombre} (${sacos} sacos × ${kgPorSaco} kg)`,
                        monto: costeConsumo,
                        fecha: date,
                        rebanoId: rebanoId,
                        siloId: id,
                        num_sacos: sacos,
                        kilos_por_saco: kgPorSaco,
                        kilos_totales: amount,
                        evento_consumo_id: eventoId,
                        origen_modulo: 'silos'
                    });
                    eventoSilo.id = eventoId;
                    eventoSilo.gastoId = gastoId;
                    await window.db.put('registro_eventos', eventoSilo);
                } catch (err) {
                    console.error('[SilosView] No se pudo generar el gasto analítico del consumo:', err);
                }
            }
        } catch (e) {
            console.error('[SilosView] No se pudo guardar el evento de consumo:', e);
        }

        Toast.show(`Consumo de pienso registrado y gasto imputado correctamente.`, 'success');
        const onSaved = this._consumoOnSaved;
        this._consumoOnSaved = null;
        if (onSaved) onSaved(); else this.render();
    },

    _abrirFormularioSilo(id = null) {
        const esEdicion = id !== null;
        const silo = esEdicion ? this._cachedSilos.find(s => s.id === Number(id)) : {
            nombre: '',
            capacidad: 10000,
            cantidadActual: 5000,
            alimento: 'Pienso Lactancia',
            fechaUltimaCarga: new Date().toISOString().split('T')[0]
        };

        if (!silo) return;

        const html = `
        <div class="card card-dark-gradient p-16 max-w-[450px] w-full mx-10" style="border:1px solid #333; background:#181818;">
            <h3 class="text-md font-black uppercase tracking-wider mb-15 text-white" style="font-family:'Archivo Expanded', sans-serif;">
                <span style="color:var(--p-gold); margin-right:4px;">|</span> ${esEdicion ? Icons.editar() + ' EDITAR SILO' : Icons.agregar() + ' NUEVO SILO'}
            </h3>
            
            <div class="flex flex-col gap-15 mb-20">
                <div>
                    <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">NOMBRE DEL SILO</label>
                    <input type="text" id="silo-form-nombre" class="wizard-input font-bold uppercase" placeholder="Ej: Silo Norte 1" value="${silo.nombre}">
                </div>
                <div>
                    <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">TIPO DE ALIMENTO ALOJADO</label>
                    <input type="text" id="silo-form-alimento" class="wizard-input font-bold uppercase" placeholder="Ej: Pienso Vacas Lactancia" value="${silo.alimento}">
                </div>
                <div class="grid grid-cols-2 gap-10">
                    <div>
                        <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">CAPACIDAD MAX (kg)</label>
                        <input type="number" id="silo-form-capacidad" class="wizard-input font-bold" value="${silo.capacidad}">
                    </div>
                    <div>
                        <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">CANTIDAD ACTUAL (kg)</label>
                        <input type="number" id="silo-form-actual" class="wizard-input font-bold" value="${silo.cantidadActual}">
                    </div>
                </div>
                <div>
                    <label class="text-gray-500 font-950 uppercase text-[0.55rem] tracking-wider mb-4 d-block">FECHA ÚLTIMA CARGA</label>
                    <input type="date" id="silo-form-fecha" class="wizard-input font-bold" value="${silo.fechaUltimaCarga}">
                </div>
            </div>

            <div class="flex gap-10 justify-end">
                <button type="button" class="wizard-btn-action wizard-btn-secondary" onclick="ModalManager.close('silo-form-modal')">${Icons.cerrar()} Cancelar</button>
                <button type="button" class="wizard-btn-action wizard-btn-success" onclick="SilosView._guardarFormularioSilo(${id})">${Icons.guardar()} Guardar Silo</button>
            </div>
        </div>
        `;
        ModalManager.show('silo-form-modal', html, { closeOnOverlayClick: true });
    },

    async _guardarFormularioSilo(id = null) {
        const nombreInput = document.getElementById('silo-form-nombre');
        const alimentoInput = document.getElementById('silo-form-alimento');
        const capacidadInput = document.getElementById('silo-form-capacidad');
        const actualInput = document.getElementById('silo-form-actual');
        const fechaInput = document.getElementById('silo-form-fecha');

        const nombre = (nombreInput?.value || '').trim();
        const alimento = (alimentoInput?.value || '').trim();
        const capacidad = Number(capacidadInput?.value) || 0;
        const cantidadActual = Number(actualInput?.value) || 0;
        const fechaUltimaCarga = fechaInput?.value || new Date().toISOString().split('T')[0];

        if (!nombre) {
            Toast.show('El nombre del silo es obligatorio', 'warning');
            return;
        }
        if (!alimento) {
            Toast.show('El tipo de alimento es obligatorio', 'warning');
            return;
        }
        if (capacidad <= 0) {
            Toast.show('La capacidad debe ser mayor que 0', 'warning');
            return;
        }
        if (cantidadActual < 0 || cantidadActual > capacidad) {
            Toast.show('La cantidad actual debe estar entre 0 y la capacidad máxima', 'warning');
            return;
        }

        const data = {
            nombre,
            alimento,
            capacidad,
            cantidadActual,
            fechaUltimaCarga,
            creadoEn: new Date().toISOString()
        };

        try {
            if (id !== null) {
                const previo = this._cachedSilos.find(s => s.id === Number(id));
                data.id = Number(id);
                data.fincaId = previo?.fincaId ?? await Fincas.getActiveId().catch(() => null);
                await window.db.put('config_silos', data);
                Toast.show('Silo actualizado con éxito', 'success');
            } else {
                data.fincaId = await Fincas.getActiveId().catch(() => null);
                await window.db.add('config_silos', data);
                Toast.show('Silo creado con éxito', 'success');
            }
            ModalManager.close('silo-form-modal');
            this.render();
        } catch (e) {
            console.error('[SilosView] Error al guardar silo:', e);
            Toast.show('Error al guardar silo: ' + e.message, 'error');
        }
    },

    async _eliminarSilo(id) {
        const confirmado = await Confirm.confirm(
            'ELIMINAR SILO',
            '¿Está seguro de que desea eliminar este silo? Se perderán todas sus calibraciones de sensores.',
            true
        );

        if (confirmado) {
            try {
                await window.db.delete('config_silos', Number(id));
                Toast.show('Silo eliminado con éxito', 'success');
                this.render();
            } catch (e) {
                console.error('[SilosView] Error al eliminar silo:', e);
                Toast.show('Error al eliminar silo', 'error');
            }
        }
    }
};

window.SilosView = SilosView;
