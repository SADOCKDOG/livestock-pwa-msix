/**
 * LIFESTOCK MANAGER - CATÁLOGO SANITARIO Y DOSIFICACIÓN (v4.0.0)
 * Base de datos maestra de medicamentos, tiempos de retiro y motor de cálculo.
 * Basado en la normativa de seguridad alimentaria y farmacología veterinaria.
 */

const CatalogoSanitario = {
    /**
     * Catálogo maestro de medicamentos pre-cargados para selección en UI.
     * Los tiempos de retiro usan el valor máximo del rango por seguridad.
     */
    medicamentos: [
        // ANTIPARASITARIOS
        {
            id: 'antip_ivermectina',
            categoria: 'Antiparasitarios',
            principioActivo: 'Ivermectina',
            via: 'Inyectable / Oral',
            indicacion: 'Sarna, piojos y lombrices intestinales',
            retiroCarneDias: 28,
            retiroLecheDias: null,
            prohibidoLeche: true
        },
        {
            id: 'antip_moxidectina',
            categoria: 'Antiparasitarios',
            principioActivo: 'Moxidectina',
            via: 'Inyectable / Oral',
            indicacion: 'Parásitos con mayor efecto residual',
            retiroCarneDias: 14,
            retiroLecheDias: 14,
            prohibidoLeche: false
        },
        {
            id: 'antip_albendazol',
            categoria: 'Antiparasitarios',
            principioActivo: 'Albendazol',
            via: 'Oral (Drenaje)',
            indicacion: 'Lombrices gastrointestinales y fasciola',
            retiroCarneDias: 9,
            retiroLecheDias: 7,
            prohibidoLeche: false
        },
        {
            id: 'antip_fenbendazol',
            categoria: 'Antiparasitarios',
            principioActivo: 'Fenbendazol',
            via: 'Oral',
            indicacion: 'Lombrices intestinales y tenias',
            retiroCarneDias: 6,
            retiroLecheDias: 4,
            prohibidoLeche: false
        },
        {
            id: 'antip_deltametrina',
            categoria: 'Antiparasitarios',
            principioActivo: 'Deltametrina',
            via: 'Aspersión / Baño',
            indicacion: 'Moscas, piojos y garrapatas',
            retiroCarneDias: 3,
            retiroLecheDias: 0,
            prohibidoLeche: false
        },

        // ANTIBIÓTICOS
        {
            id: 'anti_oxitetraciclina',
            categoria: 'Antibióticos',
            principioActivo: 'Oxitetraciclina LA',
            via: 'Inyectable (IM)',
            indicacion: 'Neumonías, pedero (cascos) y heridas',
            retiroCarneDias: 28,
            retiroLecheDias: 8,
            prohibidoLeche: false
        },
        {
            id: 'anti_penicilina',
            categoria: 'Antibióticos',
            principioActivo: 'Penicilina Benzatínica',
            via: 'Inyectable (IM)',
            indicacion: 'Infecciones bacterianas y heridas',
            retiroCarneDias: 14,
            retiroLecheDias: 6,
            prohibidoLeche: false
        },
        {
            id: 'anti_tulatromicina',
            categoria: 'Antibióticos',
            principioActivo: 'Tulatromicina',
            via: 'Inyectable (SC)',
            indicacion: 'Complejo respiratorio ovino',
            retiroCarneDias: 35,
            retiroLecheDias: null,
            prohibidoLeche: true
        },

        // ANTIINFLAMATORIOS
        { id: 'infla_meloxicam', categoria: 'Antiinflamatorios', principioActivo: 'Meloxicam', via: 'Inyectable / Oral', indicacion: 'Cojeras, mastitis y postcirugía', retiroCarneDias: 15, retiroLecheDias: 5, prohibidoLeche: false },
        { id: 'infla_flunixino', categoria: 'Antiinflamatorios', principioActivo: 'Flunixino Meglumina', via: 'Inyectable', indicacion: 'Inflamación aguda y fiebre', retiroCarneDias: 7, retiroLecheDias: 3, prohibidoLeche: false },

        // SUPLEMENTOS
        { id: 'suple_vitaminas', categoria: 'Suplementos', principioActivo: 'Vitamina A, D3, E', via: 'Inyectable', indicacion: 'Fertilidad y defensas', retiroCarneDias: 0, retiroLecheDias: 0, prohibidoLeche: false },
        { id: 'suple_complejob', categoria: 'Suplementos', principioActivo: 'Complejo B', via: 'Inyectable', indicacion: 'Recuperación de animales débiles', retiroCarneDias: 0, retiroLecheDias: 0, prohibidoLeche: false },
        { id: 'suple_propilenglicol', categoria: 'Suplementos', principioActivo: 'Propilenglicol', via: 'Oral', indicacion: 'Toxemia de la gestación (cetosis)', retiroCarneDias: 0, retiroLecheDias: 0, prohibidoLeche: false },

        // BIOLÓGICOS
        { id: 'bio_clostridial', categoria: 'Biológicos', principioActivo: 'Vacuna Clostridial', via: 'Inyectable (SC)', indicacion: 'Prevención de enterotoxemia y tétanos', retiroCarneDias: 21, retiroLecheDias: 0, prohibidoLeche: false }
    ],

    /**
     * Obtiene todo el catálogo, útil para poblar un <select> en el UI agrupado por <optgroup>
     */
    obtenerCatalogo() {
        return this.medicamentos;
    },

    /**
     * Obtiene la información completa de un principio activo para auto-rellenar formularios
     */
    obtenerMedicamento(id) {
        return this.medicamentos.find(m => m.id === id) || null;
    },

    /**
     * Motor de cálculo: Fórmula V = (P * D) / C
     * @param {number} pesoAnimalKg Peso vivo del animal (P)
     * @param {number} dosisMgKg Dosis recomendada del principio activo (D)
     * @param {number} concentracionMgMl Concentración del producto en el frasco (C)
     * @returns {number} Volumen exacto a inyectar/suministrar en mililitros (V)
     */
    calcularDosisVolumen(pesoAnimalKg, dosisMgKg, concentracionMgMl) {
        const peso = parseFloat(pesoAnimalKg);
        const dosis = parseFloat(dosisMgKg);
        const conc = parseFloat(concentracionMgMl);

        if (isNaN(peso) || isNaN(dosis) || isNaN(conc) || conc <= 0) {
            throw new Error("Parámetros de dosificación inválidos. La concentración debe ser mayor a cero.");
        }

        const volumen = (peso * dosis) / conc;
        return parseFloat(volumen.toFixed(2));
    }
};

window.CatalogoSanitario = CatalogoSanitario;