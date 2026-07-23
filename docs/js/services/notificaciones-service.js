/**
 * Livestock Manager - NotificacionesService v1.0.0
 * Gestor de notificaciones nativas de Android mediante Capacitor Local Notifications.
 */

const NotificacionesService = {
    _plugin: null,

    async init() {
        if (!window.Capacitor?.Plugins?.LocalNotifications) {
            console.warn('[NotificacionesService] Plugin LocalNotifications no detectado (entorno web o plugin no instalado).');
            return false;
        }
        this._plugin = window.Capacitor.Plugins.LocalNotifications;

        try {
            const perm = await this._plugin.requestPermissions();
            if (perm.display !== 'granted') {
                console.warn('[NotificacionesService] Permisos de notificación denegados por el usuario.');
                return false;
            }
            return true;
        } catch (e) {
            console.error('[NotificacionesService] Error al solicitar permisos:', e);
            return false;
        }
    },

    /**
     * Programa una notificación para una tarea de la agenda.
     * @param {Object} tarea - { id, titulo, fecha_planificada, es_alerta }
     */
    async programarTarea(tarea) {
        if (!this._plugin) await this.init();
        if (!this._plugin) return;

        try {
            // Cancelar notificación previa si existe (usando el ID de la tarea como ID de notificación)
            await this._plugin.cancel({ notifications: [{ id: tarea.id }] });

            if (tarea.estado === 'completada') return;

            const fechaPlanificada = new Date(tarea.fecha_planificada);
            const ahora = new Date();

            // Configurar fecha de aviso: 8:00 AM del día previsto
            const fechaAviso = new Date(fechaPlanificada);
            fechaAviso.setHours(8, 0, 0, 0);

            // Si la tarea es crítica (es_alerta), avisar 24h antes también
            const avisos = [];

            if (fechaAviso > ahora) {
                avisos.push({
                    title: `TAREA PENDIENTE: ${tarea.titulo}`,
                    body: `Tienes una acción programada para hoy en el módulo ${tarea.modulo_id.toUpperCase()}.`,
                    id: tarea.id,
                    schedule: { at: fechaAviso },
                    sound: 'default',
                    smallIcon: 'ic_stat_name', // Asegúrate de tener este icono en Android resources
                    actionTypeId: 'OPEN_TASK',
                    extra: { taskId: tarea.id }
                });
            }

            if (tarea.es_alerta) {
                const fechaAvisoPrevio = new Date(fechaAviso);
                fechaAvisoPrevio.setDate(fechaAvisoPrevio.getDate() - 1);

                if (fechaAvisoPrevio > ahora) {
                    avisos.push({
                        title: `AVISO CRÍTICO: ${tarea.titulo}`,
                        body: `Recordatorio: Mañana vence el plazo para esta tarea crítica.`,
                        id: tarea.id + 1000000, // Offset para no colisionar
                        schedule: { at: fechaAvisoPrevio },
                        sound: 'default',
                        extra: { taskId: tarea.id }
                    });
                }
            }

            if (avisos.length > 0) {
                await this._plugin.schedule({ notifications: avisos });
                console.log(`[NotificacionesService] ${avisos.length} aviso(s) programado(s) para tarea #${tarea.id}`);
            }

        } catch (e) {
            console.error('[NotificacionesService] Error al programar notificación:', e);
        }
    },

    /**
     * Cancela los avisos de una tarea (p.ej. al eliminarla o completarla).
     */
    async cancelarTarea(taskId) {
        if (!this._plugin) return;
        try {
            await this._plugin.cancel({
                notifications: [
                    { id: taskId },
                    { id: taskId + 1000000 }
                ]
            });
        } catch (e) {
            console.error('[NotificacionesService] Error al cancelar avisos:', e);
        }
    }
};

window.NotificacionesService = NotificacionesService;
console.log('[NotificacionesService] Servicio inicializado v1.0.0');
