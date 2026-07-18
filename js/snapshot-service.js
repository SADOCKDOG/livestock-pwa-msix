/**
 * Snapshot Context Service - Livestock Manager
 * Provides reusable functions for building contextual snapshots
 * used for immutable historical records in production events.
 */

const SnapshotService = {
    /**
     * Builds snapshot metadata from a rebano ID
     * @param {number|null} rebanoId - The rebano ID
     * @returns {Object} Snapshot metadata with snap_zona, snap_especie, snap_tipo
     */
    buildSnapMetadata: async function(rebanoId) {
        if (!rebanoId) {
            return {
                snap_zona: "Sin zona",
                snap_especie: "No definida",
                snap_tipo: "No definido"
            };
        }

        try {
            const rebano = await window.db.get('rebanos', Number(rebanoId));
            if (!rebano) {
                return {
                    snap_zona: "Sin zona",
                    snap_especie: "No definida",
                    snap_tipo: "No definido"
                };
            }

            return {
                snap_zona: rebano.zonaActual || "Sin zona",
                snap_especie: rebano.especie || "No definida",
                snap_tipo: rebano.tipo || "No definido"
            };
        } catch (error) {
            console.error("[SnapshotService] Error building snap metadata:", error);
            // Return fallback values on error
            return {
                snap_zona: "Sin zona",
                snap_especie: "No definida",
                snap_tipo: "No definido"
            };
        }
    },

    /**
     * Builds entity context similar to pesajes.js logic
     * @param {number|null} entityId - The entity ID (animal or rebano)
     * @param {string} entityType - The entity type ('animal' or 'rebano')
     * @returns {Object} Context with snap_zona, snap_especie, snap_tipo
     */
    buildEntityContext: async function(entityId, entityType) {
        // Default values
        let snap_zona = "Finca";
        let snap_tipo = "Sin Clasificar";
        let snap_especie = "General";

        if (!entityId) {
            return { snap_zona, snap_tipo, snap_especie };
        }

        try {
            if (entityType === "animal") {
                const animal = await window.db.get('animales', Number(entityId));
                if (animal) {
                    snap_especie = animal.especie || snap_especie;
                    if (animal.rebanoId) {
                        const rebano = await window.db.get('rebanos', Number(animal.rebanoId));
                        if (rebano) {
                            snap_zona = rebano.zonaActual || snap_zona;
                            snap_tipo = rebano.tipo || snap_tipo;
                        }
                    }
                }
            } else if (entityType === "rebano") {
                const rebano = await window.db.get('rebanos', Number(entityId));
                if (rebano) {
                    snap_zona = rebano.zonaActual || snap_zona;
                    snap_tipo = rebano.tipo || snap_tipo;
                    snap_especie = rebano.especie || snap_especie;
                }
            }
        } catch (error) {
            console.error("[SnapshotService] Error building entity context:", error);
            // Return defaults on error
        }

        return { snap_zona, snap_tipo, snap_especie };
    }
};

window.SnapshotService = SnapshotService;