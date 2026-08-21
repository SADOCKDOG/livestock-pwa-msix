/**
 * Wizard Tarea/Recordatorio — Livestock Manager Premium
 * Permite crear tareas planificadas y alertas personalizadas vinculadas a cualquier módulo.
 */
window.WizardTarea = {
    async open(options = {}) {
        const fincaId = await window.Fincas.getActiveId();
        const finca = await window.Fincas.getActive();

        // Cargar catálogos para vinculación
        const [animales, rebanos, contratos, silos, productos] = await Promise.all([
            window.Animales.list().catch(() => []),
            window.Rebanos.list().catch(() => []),
            window.db.getAll('contratos_compra').catch(() => []),
            window.db.getAll('config_silos').catch(() => []),
            window.db.getAll('config_botiquin').catch(() => [])
        ]);

        const modulos = [
            { id: 'gegan', label: 'ANIMALES', icon: Icons.animales() },
            { id: 'rebanos', label: 'REBAÑOS / LOTES', icon: Icons.rebanos() },
            { id: 'silos', label: 'SILOS / ALIMENTACIÓN', icon: Icons.silos() },
            { id: 'almacen', label: 'BOTIQUÍN / ALMACÉN', icon: Icons.sanidad() },
            { id: 'sanidad', label: 'VACUNAS / SANIDAD', icon: Icons.sanidad() },
            { id: 'carnico', label: 'PROD. CÁRNICA', icon: Icons.carne() },
            { id: 'lacteos', label: 'PROD. LÁCTEA', icon: Icons.leche() },
            { id: 'contratos', label: 'CONTRATOS / VENTAS', icon: Icons.contratos() },
            { id: 'general', label: 'GENERAL / FINCA', icon: Icons.finca() }
        ];

        const wizardSteps = [
            {
                title: 'Definición de Tarea',
                content: (data) => `
                    <div class="mt-10">
                        <div class="wizard-input-group mb-12">
                            <label class="wizard-label">TÍTULO DE LA ACCIÓN</label>
                            <input type="text" id="w-t-titulo" value="${data.titulo || ''}" placeholder="Ej: Vacunar lote terneros..." class="wizard-input uppercase font-900">
                        </div>

                        <div class="grid grid-cols-2 gap-10 mb-12">
                            <div class="wizard-input-group">
                                <label class="wizard-label">FECHA PREVISTA</label>
                                <input type="date" id="w-t-fecha" value="${data.fecha_planificada || ''}" class="wizard-input font-800">
                            </div>
                            <div class="wizard-input-group">
                                <label class="wizard-label">PRIORIDAD</label>
                                <select id="w-t-prioridad" class="wizard-input font-900">
                                    <option value="baja" ${data.prioridad === 'baja' ? 'selected' : ''}>BAJA (VERDE)</option>
                                    <option value="media" ${data.prioridad === 'media' || !data.prioridad ? 'selected' : ''}>MEDIA (AMARILLO)</option>
                                    <option value="alta" ${data.prioridad === 'alta' ? 'selected' : ''}>ALTA (ROJO)</option>
                                </select>
                            </div>
                        </div>

                        <div class="wizard-input-group mb-12">
                            <label class="wizard-label">MÓDULO ASOCIADO</label>
                            <select id="w-t-modulo" class="wizard-input font-800">
                                ${modulos.map(m => `<option value="${m.id}" ${data.modulo_id === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}
                            </select>
                        </div>

                        <label class="flex items-center gap-10 text-sm text-white cursor-pointer bg-black border border-222 p-12 rounded-sm mb-12">
                            <input type="checkbox" id="w-t-alerta" ${data.es_alerta ? 'checked' : ''} style="accent-color:var(--c-danger);">
                            <span class="uppercase font-900 text-[0.65rem] tracking-tight">MARCAR COMO ALERTA CRÍTICA (NOTIFICAR)</span>
                        </label>
                    </div>
                `,
                onChange: (data) => {
                    data.titulo = document.getElementById('w-t-titulo')?.value.trim();
                    data.fecha_planificada = document.getElementById('w-t-fecha')?.value;
                    data.prioridad = document.getElementById('w-t-prioridad')?.value;
                    data.modulo_id = document.getElementById('w-t-modulo')?.value;
                    data.es_alerta = document.getElementById('w-t-alerta')?.checked;
                },
                validate: (data) => {
                    if (!data.titulo) { App.toastError("Indica un título para la tarea"); return false; }
                    if (!data.fecha_planificada) { App.toastError("Indica la fecha prevista"); return false; }
                    return true;
                }
            },
            {
                title: 'Vinculación y Detalles',
                content: (data) => {
                    let entidadHtml = '';

                    if (data.modulo_id === 'gegan') {
                        entidadHtml = `
                            <div class="wizard-input-group mb-12">
                                <label class="wizard-label">VINCULAR A ANIMAL (OPCIONAL)</label>
                                <select id="w-t-entidad" class="wizard-input font-800">
                                    <option value="">— NO VINCULAR —</option>
                                    ${animales.map(a => `<option value="${a.id}" ${data.entidad_id == a.id ? 'selected' : ''}>${a.numero_identificacion} (${a.raza || 'S/R'})</option>`).join('')}
                                </select>
                            </div>`;
                    } else if (data.modulo_id === 'rebanos') {
                        entidadHtml = `
                            <div class="wizard-input-group mb-12">
                                <label class="wizard-label">VINCULAR A REBAÑO / LOTE</label>
                                <select id="w-t-entidad" class="wizard-input font-800">
                                    <option value="">— NO VINCULAR —</option>
                                    ${rebanos.map(r => `<option value="${r.id}" ${data.entidad_id == r.id ? 'selected' : ''}>${r.nombre.toUpperCase()}</option>`).join('')}
                                </select>
                            </div>`;
                    } else if (data.modulo_id === 'silos') {
                        entidadHtml = `
                            <div class="wizard-input-group mb-12">
                                <label class="wizard-label">VINCULAR A SILO</label>
                                <select id="w-t-entidad" class="wizard-input font-800">
                                    <option value="">— NO VINCULAR —</option>
                                    ${silos.map(s => `<option value="${s.id}" ${data.entidad_id == s.id ? 'selected' : ''}>${s.nombre.toUpperCase()}</option>`).join('')}
                                </select>
                            </div>`;
                    } else if (data.modulo_id === 'almacen') {
                        entidadHtml = `
                            <div class="wizard-input-group mb-12">
                                <label class="wizard-label">VINCULAR A PRODUCTO BOTIQUÍN</label>
                                <select id="w-t-entidad" class="wizard-input font-800">
                                    <option value="">— NO VINCULAR —</option>
                                    ${productos.map(p => `<option value="${p.id}" ${data.entidad_id == p.id ? 'selected' : ''}>${p.nombre.toUpperCase()}</option>`).join('')}
                                </select>
                            </div>`;
                    } else if (data.modulo_id === 'contratos') {
                        entidadHtml = `
                            <div class="wizard-input-group mb-12">
                                <label class="wizard-label">VINCULAR A CONTRATO</label>
                                <select id="w-t-entidad" class="wizard-input font-800">
                                    <option value="">— NO VINCULAR —</option>
                                    ${contratos.map(c => `<option value="${c.id}" ${data.entidad_id == c.id ? 'selected' : ''}>${c.numero_contrato || 'Contrato #'+c.id}</option>`).join('')}
                                </select>
                            </div>`;
                    }

                    return `
                        <div class="mt-10">
                            ${entidadHtml}
                            <div class="wizard-input-group">
                                <label class="wizard-label">DETALLES / NOTAS ADICIONALES</label>
                                <textarea id="w-t-desc" placeholder="Instrucciones para la ejecución..." class="wizard-input font-700 uppercase" style="height:120px; resize:none;">${data.descripcion || ''}</textarea>
                            </div>
                        </div>
                    `;
                },
                onChange: (data) => {
                    data.entidad_id = document.getElementById('w-t-entidad')?.value || null;
                    data.descripcion = document.getElementById('w-t-desc')?.value.trim();
                }
            }
        ];

        window.WizardManager.create({
            id: 'wizard-nueva-tarea',
            title: options.id ? 'EDITAR ACCIÓN' : 'NUEVA ACCIÓN / TAREA',
            initialData: {
                id: options.id || null,
                fincaId: fincaId,
                modulo_id: options.modulo_id || 'general',
                entidad_id: options.entidad_id || null,
                titulo: options.titulo || '',
                descripcion: options.descripcion || '',
                fecha_planificada: options.fecha_planificada || new Date().toISOString().split('T')[0],
                prioridad: options.prioridad || 'media',
                es_alerta: options.es_alerta || false
            },
            steps: wizardSteps,
            onComplete: async (finalData) => {
                try {
                    if (finalData.id) {
                        await window.AgendaService.update(finalData.id, finalData);
                        App.toast("Tarea actualizada");
                    } else {
                        await window.AgendaService.add(finalData);
                        App.toast("Tarea programada en la agenda");
                    }

                    if (options.onComplete) options.onComplete();
                    else App.route(); // Recargar vista actual o ir a inicio
                } catch (e) {
                    App.toastError(e.message);
                }
            }
        });
    }
};
