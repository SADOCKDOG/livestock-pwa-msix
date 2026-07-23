/**
 * Livestock Manager - AgendaService v1.0.0
 * Servicio centralizado para la gestión de tareas, recordatorios y planificación futura.
 */

const AgendaService = {
    /**
     * Crea una nueva tarea en la agenda.
     * @param {Object} task - { fincaId, modulo_id, entidad_id, titulo, descripcion, fecha_planificada, prioridad, es_alerta }
     */
    async add(task) {
        try {
            const data = {
                ...task,
                estado: 'pendiente',
                creadoEn: new Date().toISOString(),
                actualizadoEn: new Date().toISOString()
            };
            const id = await window.db.add('agenda_tareas', data);

            if (window.NotificacionesService) {
                await window.NotificacionesService.programarTarea({ id, ...data });
            }

            if (window.EventBus) {
                window.EventBus.emit('agenda:task-added', { id, ...data });
            }

            return id;
        } catch (e) {
            console.error('[AgendaService] Error al añadir tarea:', e);
            throw e;
        }
    },

    /**
     * Obtiene una tarea por su ID.
     */
    async get(id) {
        return await window.db.get('agenda_tareas', Number(id));
    },

    /**
     * Actualiza una tarea existente.
     */
    async update(id, updates) {
        try {
            const existing = await this.get(id);
            if (!existing) throw new Error('Tarea no encontrada');

            const updated = {
                ...existing,
                ...updates,
                actualizadoEn: new Date().toISOString()
            };

            await window.db.put('agenda_tareas', updated);

            if (window.NotificacionesService) {
                if (updated.estado === 'completada') {
                    await window.NotificacionesService.cancelarTarea(id);
                } else {
                    await window.NotificacionesService.programarTarea(updated);
                }
            }

            if (window.EventBus) {
                window.EventBus.emit('agenda:task-updated', updated);
            }

            return updated;
        } catch (e) {
            console.error('[AgendaService] Error al actualizar tarea:', e);
            throw e;
        }
    },

    /**
     * Marca una tarea como completada.
     */
    async completar(id) {
        return await this.update(id, { estado: 'completada' });
    },

    /**
     * Elimina una tarea de forma permanente.
     */
    async delete(id) {
        try {
            await window.db.delete('agenda_tareas', Number(id));
            if (window.NotificacionesService) {
                await window.NotificacionesService.cancelarTarea(Number(id));
            }
            if (window.EventBus) {
                window.EventBus.emit('agenda:task-deleted', id);
            }
        } catch (e) {
            console.error('[AgendaService] Error al eliminar tarea:', e);
            throw e;
        }
    },

    /**
     * Lista las tareas de una finca, opcionalmente filtradas.
     * @param {number} fincaId
     * @param {Object} [filtros] - { modulo_id, estado, prioridad }
     */
    async list(fincaId, filtros = {}) {
        try {
            const allTasks = await window.db.getAllFromIndex('agenda_tareas', 'fincaId', Number(fincaId));

            let filtered = allTasks;
            if (filtros.modulo_id) filtered = filtered.filter(t => t.modulo_id === filtros.modulo_id);
            if (filtros.estado) filtered = filtered.filter(t => t.estado === filtros.estado);
            if (filtros.prioridad) filtered = filtered.filter(t => t.prioridad === filtros.prioridad);

            // Ordenar por fecha planificada (más próxima primero)
            return filtered.sort((a, b) => new Date(a.fecha_planificada) - new Date(b.fecha_planificada));
        } catch (e) {
            console.error('[AgendaService] Error al listar tareas:', e);
            return [];
        }
    },

    /**
     * Obtiene el conteo de tareas pendientes.
     */
    async getPendingCount(fincaId) {
        const tasks = await this.list(fincaId, { estado: 'pendiente' });
        return tasks.length;
    },

    /**
     * Obtiene las tareas que son alertas críticas.
     */
    async getAlertasActivas(fincaId) {
        const tasks = await this.list(fincaId, { estado: 'pendiente' });
        return tasks.filter(t => t.es_alerta === true);
    }
};

window.AgendaService = AgendaService;
console.log('[AgendaService] Servicio inicializado v1.0.0');
