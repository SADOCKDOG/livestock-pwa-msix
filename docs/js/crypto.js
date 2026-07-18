/**
 * Módulo de Cifrado AES-GCM (Simulación de Keystore)
 * SDOG FARM CORE - Módulo Livestock Manager
 * v2.0 - Modificado para usar Filesystem en lugar de mock en memoria.
 */

const CryptoUtils = {
    // Almacén en memoria para simular el Keystore del dispositivo (Android/iOS)
    _keyCache: {}, // Caché para no leer de disco en cada operación

    /**
     * Obtiene o genera una clave de cifrado simétrica (AES-GCM) atada a la finca.
     * Usa Capacitor Filesystem para persistir la clave de forma segura en el dispositivo.
     * @param {number} fincaId - ID de la Finca para la que se solicita la clave.
     * @returns {Promise<CryptoKey>} - Clave WebCrypto importada.
     */
    async _getFincaKey(fincaId) {
        const keyId = `key_finca_${fincaId}`;
        if (this._keyCache[keyId]) {
            return this._keyCache[keyId];
        }

        const Filesystem = window.Capacitor?.Plugins?.Filesystem;
        // En Capacitor, el enum Directory suele estar en Plugins o se puede usar el string directamente
        const directory = 'DATA';
        const path = `keystore/${keyId}.json`;

        try {
            if (!Filesystem) throw new Error("Plugin Filesystem no disponible");

            // 1. Intentar leer la clave del filesystem
            const result = await Filesystem.readFile({ path, directory });
            const jwk = JSON.parse(atob(result.data));
            const key = await window.crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
            this._keyCache[keyId] = key;
            return key;
        } catch (e) {
            // 2. Si no existe o falla (ej: estamos en web/browser sin plugin), generar una temporal
            console.log(`[Crypto] No se pudo leer clave de disco para ${keyId}: ${e.message}. Generando clave temporal.`);

            const newKey = await window.crypto.subtle.generateKey(
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
            );

            // Intentar persistirla si el plugin existe
            if (Filesystem) {
                try {
                    const jwk = await window.crypto.subtle.exportKey("jwk", newKey);
                    await Filesystem.writeFile({
                        path,
                        data: btoa(JSON.stringify(jwk)),
                        directory,
                        recursive: true
                    });
                } catch (writeErr) {
                    console.warn("[Crypto] No se pudo persistir la clave en disco:", writeErr.message);
                }
            }

            this._keyCache[keyId] = newKey;
            return newKey;
        }
    },

    /**
     * Cifra un objeto JSON usando AES-GCM.
     * @param {Object} data - Objeto a cifrar.
     * @param {number} fincaId - ID de la Finca para usar su clave.
     * @returns {Promise<{encrypted: string, iv: string}>} - Datos cifrados en base64.
     */
    async encryptData(data, fincaId) {
        if (!data || !fincaId) throw new Error("Datos o FincaID faltantes para cifrar.");

        const key = await this._getFincaKey(fincaId);

        // El Vector de Inicialización (IV) debe ser único por cifrado, pero no es secreto.
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encodedData = new TextEncoder().encode(JSON.stringify(data));

        const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encodedData
        );

        // Convertir de ArrayBuffer a Base64 para almacenar fácilmente en IndexedDB
        const encryptedBase64 = this._arrayBufferToBase64(encryptedBuffer);
        const ivBase64 = this._arrayBufferToBase64(iv);

        return { encrypted: encryptedBase64, iv: ivBase64 };
    },

    /**
     * Descifra un string cifrado previamente con AES-GCM.
     * @param {string} encryptedBase64 - Datos cifrados en base64.
     * @param {string} ivBase64 - Vector de inicialización en base64.
     * @param {number} fincaId - ID de la Finca.
     * @returns {Promise<Object>} - El objeto original en texto plano.
     */
    async decryptData(encryptedBase64, ivBase64, fincaId) {
        if (!encryptedBase64 || !ivBase64 || !fincaId) {
            throw new Error("Parámetros insuficientes para descifrar.");
        }

        const key = await this._getFincaKey(fincaId);
        const encryptedBuffer = this._base64ToArrayBuffer(encryptedBase64);
        const iv = new Uint8Array(this._base64ToArrayBuffer(ivBase64));

        try {
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encryptedBuffer
            );

            const decodedString = new TextDecoder().decode(decryptedBuffer);
            return JSON.parse(decodedString);
        } catch (error) {
            console.error("[CryptoUtils] Error descifrando datos:", error);
            throw new Error("Fallo de descifrado. La clave puede ser incorrecta o los datos están corruptos.");
        }
    },

    // Utilidades de ArrayBuffer <-> Base64
    _arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    },

    _base64ToArrayBuffer(base64) {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }
};

window.CryptoUtils = CryptoUtils;
