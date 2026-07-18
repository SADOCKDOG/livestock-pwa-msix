/**
 * Error Handler Utility - Livestock Manager
 * Proporciona manejo estandarizado de errores en toda la aplicación
 */

const ErrorHandler = {
  // Tipos de errores
  ERROR_TYPES: {
    VALIDATION: "VALIDATION_ERROR",
    DATABASE: "DATABASE_ERROR",
    NOT_FOUND: "NOT_FOUND",
    UNAUTHORIZED: "UNAUTHORIZED",
    CONSTRAINT: "CONSTRAINT_ERROR",
    UNKNOWN: "UNKNOWN_ERROR",
  },

  /**
   * Clase de error personalizado
   */
  AppError: class AppError extends Error {
    constructor(message, type = "UNKNOWN_ERROR", details = {}) {
      super(message);
      this.name = "AppError";
      this.type = type;
      this.details = details;
      this.timestamp = new Date().toISOString();
    }

    toJSON() {
      return {
        name: this.name,
        message: this.message,
        type: this.type,
        details: this.details,
        timestamp: this.timestamp,
      };
    }
  },

  /**
   * Valida que una finca esté activa
   * @throws AppError si no hay finca activa
   */
  async validateActiveFinca() {
    const fincaId = await Fincas.getActiveId();
    if (!fincaId) {
      throw new this.AppError(
        "No hay finca activa seleccionada",
        this.ERROR_TYPES.UNAUTHORIZED,
        { action: "validateActiveFinca", required: "activeFincaId" }
      );
    }
    return fincaId;
  },

  /**
   * Valida que un objeto exista en BD
   * @throws AppError si no existe
   */
  async validateEntityExists(entityName, id, getFunction) {
    if (!id) {
      throw new this.AppError(
        `${entityName} ID es requerido`,
        this.ERROR_TYPES.VALIDATION,
        { entity: entityName, field: "id" }
      );
    }

    const entity = await getFunction(id);
    if (!entity) {
      throw new this.AppError(
        `${entityName} con ID ${id} no encontrado`,
        this.ERROR_TYPES.NOT_FOUND,
        { entity: entityName, id }
      );
    }
    return entity;
  },

  /**
   * Maneja errores de dependencias FK
   */
  handleConstraintError(error, context = {}) {
    let message = error.message || "Error de restricción de base de datos";
    let type = this.ERROR_TYPES.CONSTRAINT;

    // Detectar patrones comunes de violación de restricciones
    if (message.includes("rebaño") || message.includes("rebanos")) {
      message = `No se puede eliminar porque existen rebaños asociados`;
    } else if (message.includes("animal") || message.includes("animales")) {
      message = `No se puede eliminar porque existen animales asociados`;
    } else if (message.includes("producción")) {
      message = `No se puede eliminar porque existen registros de producción asociados`;
    } else if (
      message.includes("único") ||
      message.includes("unique") ||
      message.includes("duplicate")
    ) {
      type = this.ERROR_TYPES.CONSTRAINT;
      message = `Registro duplicado: ${context.field || "un campo"} ya existe`;
    }

    return new this.AppError(message, type, {
      originalError: error.message,
      context,
    });
  },

  /**
   * Maneja errores de validación de entrada
   */
  validateRequired(field, value, customMessage = null) {
    if (value === undefined || value === null || value === "") {
      const message = customMessage || `Campo requerido: ${field}`;
      throw new this.AppError(message, this.ERROR_TYPES.VALIDATION, {
        field,
        value,
        required: true,
      });
    }
    return value;
  },

  /**
   * Valida formato de email
   */
  validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) {
      throw new this.AppError(
        `Email inválido: ${email}`,
        this.ERROR_TYPES.VALIDATION,
        { field: "email", format: "invalid" }
      );
    }
    return email;
  },

  /**
   * Normaliza NIF/CIF/NIE eliminando separadores y pasando a mayúsculas.
   */
  normalizeNifCif(value) {
    return (value || "")
      .toString()
      .trim()
      .toUpperCase()
      .replace(/[\s-]/g, "");
  },

  /**
   * Valida NIF/NIE/CIF español con dígito/letra de control.
   */
  validateNifCif(nifCif, { required = true } = {}) {
    const valor = this.normalizeNifCif(nifCif);
    if (!valor) {
      if (required) {
        throw new this.AppError(
          "El NIF/CIF es obligatorio",
          this.ERROR_TYPES.VALIDATION,
          { field: "nif_cif", required: true }
        );
      }
      return "";
    }

    const letrasDni = "TRWAGMYFPDXBNJZSQVHLCKE";
    const esDni = /^\d{8}[A-Z]$/.test(valor);
    const esNie = /^[XYZ]\d{7}[A-Z]$/.test(valor);
    const esCif = /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(valor);

    if (esDni) {
      const numero = parseInt(valor.slice(0, 8), 10);
      const letra = valor.slice(-1);
      if (letrasDni[numero % 23] !== letra) {
        throw new this.AppError("NIF inválido", this.ERROR_TYPES.VALIDATION, {
          field: "nif_cif",
          value: valor,
        });
      }
      return valor;
    }

    if (esNie) {
      const prefijo = valor[0] === "X" ? "0" : valor[0] === "Y" ? "1" : "2";
      const numero = parseInt(prefijo + valor.slice(1, 8), 10);
      const letra = valor.slice(-1);
      if (letrasDni[numero % 23] !== letra) {
        throw new this.AppError("NIE inválido", this.ERROR_TYPES.VALIDATION, {
          field: "nif_cif",
          value: valor,
        });
      }
      return valor;
    }

    if (esCif) {
      const letraInicial = valor[0];
      const digitos = valor.slice(1, 8);
      const control = valor[8];
      let sumaPar = 0;
      let sumaImpar = 0;
      for (let i = 0; i < digitos.length; i++) {
        const n = parseInt(digitos[i], 10);
        if (i % 2 === 0) {
          const doblado = n * 2;
          sumaImpar += Math.floor(doblado / 10) + (doblado % 10);
        } else {
          sumaPar += n;
        }
      }
      const total = sumaPar + sumaImpar;
      const controlNum = (10 - (total % 10)) % 10;
      const controlLetra = "JABCDEFGHI"[controlNum];

      const soloNumero = "ABEH";
      const soloLetra = "KPQS";
      const esValido = soloNumero.includes(letraInicial)
        ? control === String(controlNum)
        : soloLetra.includes(letraInicial)
          ? control === controlLetra
          : control === String(controlNum) || control === controlLetra;

      if (!esValido) {
        throw new this.AppError("CIF inválido", this.ERROR_TYPES.VALIDATION, {
          field: "nif_cif",
          value: valor,
        });
      }
      return valor;
    }

    throw new this.AppError(
      "Formato de NIF/CIF inválido",
      this.ERROR_TYPES.VALIDATION,
      { field: "nif_cif", value: valor }
    );
  },

  /**
   * Valida REGA (opcional por defecto) usando ComunidadesService.
   */
  validateREGA(rega, ccaa = null, { required = false } = {}) {
    const normalizado = window.ComunidadesService?.normalizarREGA
      ? window.ComunidadesService.normalizarREGA(rega || "")
      : (rega || "").toString().trim().toUpperCase().replace(/[\s-]/g, "");
    if (!normalizado) {
      if (required) {
        throw new this.AppError("El REGA es obligatorio", this.ERROR_TYPES.VALIDATION, {
          field: "rega",
          required: true,
        });
      }
      return "";
    }
    if (window.ComunidadesService?.validarFormatoREGA) {
      const res = window.ComunidadesService.validarFormatoREGA(normalizado, ccaa || null);
      if (!res?.valido) {
        throw new this.AppError(res?.mensaje || "REGA inválido", this.ERROR_TYPES.VALIDATION, {
          field: "rega",
          value: normalizado,
          ccaa: ccaa || null,
        });
      }
    }
    return normalizado;
  },

  /**
   * Valida patrón de caravana (Flexibilizado para permitir diferentes formatos)
   */
  validateCaravana(numero_identificacion) {
    // Normativa española SITRAN: código de país (2 letras) + 12 dígitos
    // Ejemplo válido: ES123456789012
    if (!numero_identificacion) {
      throw new this.AppError(
        "El número de identificación (crotal) es obligatorio",
        this.ERROR_TYPES.VALIDATION,
        { field: "numero_identificacion", required: true }
      );
    }

    const CROTAL_REGEX = /^[A-Z]{2}\d{12}$/;
    const valorLimpio = String(numero_identificacion)
      .trim()
      .toUpperCase()
      .replace(/[\s-]/g, "");

    if (!CROTAL_REGEX.test(valorLimpio)) {
      throw new this.AppError(
        "El número de identificación (crotal) debe seguir la normativa: 2 letras de código de país seguidas de 12 dígitos (ej. ES123456789012)",
        this.ERROR_TYPES.VALIDATION,
        {
          field: "numero_identificacion",
          format: "XX000000000000 (2 letras + 12 dígitos)",
          value: valorLimpio,
        }
      );
    }
    return valorLimpio;
  },

  /**
   * Comprueba si una cadena tiene formato de crotal válido (2 letras + 12 dígitos).
   * No lanza excepción — útil para validaciones de snapshot.
   */
  isCrotalValido(valor) {
    if (!valor) return false;
    return /^[A-Z]{2}\d{12}$/.test(valor.toString().trim().toUpperCase());
  },

  /**
   * Valida número numérico
   */
  validateNumeric(value, fieldName, minValue = null, maxValue = null) {
    const num = Number(value);
    if (isNaN(num)) {
      throw new this.AppError(
        `${fieldName} debe ser un número`,
        this.ERROR_TYPES.VALIDATION,
        { field: fieldName, type: "numeric" }
      );
    }

    if (minValue !== null && num < minValue) {
      throw new this.AppError(
        `${fieldName} debe ser mayor o igual a ${minValue}`,
        this.ERROR_TYPES.VALIDATION,
        { field: fieldName, minValue, actual: num }
      );
    }

    if (maxValue !== null && num > maxValue) {
      throw new this.AppError(
        `${fieldName} debe ser menor o igual a ${maxValue}`,
        this.ERROR_TYPES.VALIDATION,
        { field: fieldName, maxValue, actual: num }
      );
    }

    return num;
  },

  /**
   * Valida fecha ISO
   */
  validateDate(dateString, fieldName = "fecha") {
    if (!dateString) {
      throw new this.AppError(
        `${fieldName} es requerida`,
        this.ERROR_TYPES.VALIDATION,
        { field: fieldName }
      );
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new this.AppError(
        `${fieldName} tiene formato inválido (debe ser ISO 8601)`,
        this.ERROR_TYPES.VALIDATION,
        { field: fieldName, format: "ISO8601", value: dateString }
      );
    }

    return dateString;
  },

  /**
   * Envuelve una función asíncrona con manejo de errores
   */
  async tryAsync(fn, context = {}) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof this.AppError) {
        // Log con warn en lugar de error para validaciones esperadas
        const logLevel = error.type === this.ERROR_TYPES.VALIDATION ? console.warn : console.error;
        logLevel(`[${error.type}] ${error.message}`, error.details);
        throw error;
      }

      // Intentar detectar tipo de error
      const message = error.message || "Error desconocido";
      let type = this.ERROR_TYPES.UNKNOWN;

      if (message.includes("unique") || message.includes("duplicate")) {
        type = this.ERROR_TYPES.CONSTRAINT;
      } else if (message.includes("not found")) {
        type = this.ERROR_TYPES.NOT_FOUND;
      } else if (message.includes("validation")) {
        type = this.ERROR_TYPES.VALIDATION;
      }

      const appError = new this.AppError(message, type, {
        originalError: error,
        context,
      });
      // Log con warn en lugar de error para validaciones esperadas
      const logLevel = type === this.ERROR_TYPES.VALIDATION ? console.warn : console.error;
      logLevel(`[${type}] ${message}`, appError.details);
      throw appError;
    }
  },

  /**
   * Log de error con contexto
   */
  log(error, context = {}) {
    const errorInfo = {
      message: error.message || String(error),
      type: error.type || this.ERROR_TYPES.UNKNOWN,
      timestamp: new Date().toISOString(),
      context,
      stack: error.stack,
    };

    console.error("[LivestockError]", errorInfo);
    return errorInfo;
  },

  /**
   * Formatea error para mostrar al usuario
   */
  formatForUI(error) {
    if (error instanceof this.AppError) {
      return {
        title: this._getTitleForType(error.type),
        message: error.message,
        icon: this._getIconForType(error.type),
        severity: this._getSeverityForType(error.type),
      };
    }

    return {
      title: "Error",
      message: error.message || "Ocurrió un error inesperado",
      icon: typeof Icons !== 'undefined' ? Icons.alerta() : "",
      severity: "error",
    };
  },

  _getTitleForType(type) {
    const titles = {
      VALIDATION_ERROR: "Datos Inválidos",
      DATABASE_ERROR: "Error de Base de Datos",
      NOT_FOUND: "No Encontrado",
      UNAUTHORIZED: "No Autorizado",
      CONSTRAINT_ERROR: "Restricción de Datos",
      UNKNOWN_ERROR: "Error",
    };
    return titles[type] || "Error";
  },

  _getIconForType(type) {
    if (typeof Icons === 'undefined') return '';
    const icons = {
      VALIDATION_ERROR: Icons.cerrar,
      DATABASE_ERROR: Icons.info,
      NOT_FOUND: Icons.buscar,
      UNAUTHORIZED: Icons.cerrar,
      CONSTRAINT_ERROR: Icons.alerta,
      UNKNOWN_ERROR: Icons.alerta,
    };
    return (icons[type] || Icons.alerta)();
  },

  _getSeverityForType(type) {
    const severities = {
      VALIDATION_ERROR: "warning",
      DATABASE_ERROR: "error",
      NOT_FOUND: "info",
      UNAUTHORIZED: "warning",
      CONSTRAINT_ERROR: "warning",
      UNKNOWN_ERROR: "error",
    };
    return severities[type] || "error";
  },
};

window.ErrorHandler = ErrorHandler;
