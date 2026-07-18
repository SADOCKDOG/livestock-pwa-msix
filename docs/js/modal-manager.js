const ModalManager = {
    _activeModals: [],

    /**
     * Muestra un modal en pantalla de forma segura.
     * @param {string} id - Identificador único del modal.
     * @param {string|HTMLElement} content - Contenido HTML o elemento DOM.
     * @param {Object} options - Opciones adicionales (width, closeOnOverlayClick).
     * @returns {HTMLElement} El contenedor (overlay) del modal.
     */
    show: function (id, content, options = {}) {
        this.close(id); // Prevenir duplicados

        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        if (options.title) overlay.setAttribute('aria-label', options.title);
        const zIndex = 10000 + (this._activeModals.length * 10);
        overlay.style = `position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); display:flex; align-items:center; justify-content:center; z-index:${zIndex}; padding:0; overflow-y:auto;`;

        if (options.closeOnOverlayClick) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close(id);
                }
            });
        }

        if (typeof content === 'string') {
            overlay.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            overlay.appendChild(content);
        }

        document.body.appendChild(overlay);
        this._activeModals.push({ id, element: overlay });
        this._setupKeyListener();

        return overlay;
    },

    /**
     * Cierra y destruye un modal específico.
     * @param {string} id - Identificador del modal a cerrar.
     */
    close: function (id) {
        const index = this._activeModals.findIndex(m => m.id === id);
        if (index > -1) {
            const modal = this._activeModals[index];
            if (modal.element && modal.element.parentNode) {
                modal.element.parentNode.removeChild(modal.element);
            }
            this._activeModals.splice(index, 1);
            this._setupKeyListener();
        } else {
            // Fallback por si acaso existe en el DOM pero no en el registro
            const el = document.getElementById(id);
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
    },

    /**
     * Cierra todos los modales activos.
     */
    closeAll: function () {
        while (this._activeModals.length > 0) {
            this.close(this._activeModals[this._activeModals.length - 1].id);
        }
    },

    _setupKeyListener: function () {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }

        if (this._activeModals.length > 0) {
            this._keyHandler = (e) => {
                if (e.key === 'Escape') {
                    const topModal = this._activeModals[this._activeModals.length - 1];
                    this.close(topModal.id);
                }
            };
            document.addEventListener('keydown', this._keyHandler);
        }
    }
};

window.ModalManager = ModalManager;

/**
 * Toast Utility - Livestock Manager
 * Soporte de colas, tipos semánticos y animaciones fluidas
 */
const Toast = {
    _queue: [],
    _active: null,

    show: function (msg, type = '', ms = 3000) {
        this._queue.push({ msg, type, ms });
        this._processQueue();
    },

    _escapeHtml: function (str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _processQueue: function () {
        if (this._active || this._queue.length === 0) return;

        const { msg, type, ms } = this._queue.shift();
        const container = document.getElementById("toast-container") || document.body;

        const t = document.createElement("div");
        t.className = "toast" + (type ? " " + type : "");

        let iconHtml = "";
        if (type === 'success') iconHtml = typeof Icons !== 'undefined' ? Icons.check() : '';
        else if (type === 'warning') iconHtml = typeof Icons !== 'undefined' ? Icons.alerta() : '';
        else if (type === 'error') iconHtml = typeof Icons !== 'undefined' ? Icons.cerrar() : '';
        else if (type === 'info') iconHtml = typeof Icons !== 'undefined' ? Icons.info() : '';

        t.innerHTML = (iconHtml ? `<span class="icon icon-sm" style="vertical-align:middle;margin-right:6px;">${iconHtml}</span>` : '') + this._escapeHtml(msg);
        
        // Animación de entrada fluida
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        t.style.transform = 'translate(-50%, 20px)';
        
        container.appendChild(t);
        this._active = t;

        // Forzar reflow
        t.offsetHeight;
        t.style.opacity = '1';
        t.style.transform = 'translate(-50%, 0)';

        setTimeout(() => {
            // Animación de salida fluida
            t.style.opacity = '0';
            t.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => {
                t.remove();
                this._active = null;
                this._processQueue();
            }, 250);
        }, ms);
    },

    success: function (msg, ms) { this.show(msg, 'success', ms); },
    warning: function (msg, ms) { this.show(msg, 'warning', ms); },
    error: function (msg, ms) { this.show(msg, 'error', ms); },
    info: function (msg, ms) { this.show(msg, 'info', ms); },

    clear: function () {
        this._queue = [];
        if (this._active) {
            this._active.remove();
            this._active = null;
        }
    }
};

window.Toast = Toast;

/**
 * Confirm Utility - Livestock Manager
 * Reemplazo estilizado y asíncrono para confirm() usando ModalManager
 */
const Confirm = {
    /**
     * Muestra un diálogo de confirmación personalizado.
     * @param {Object} options
     * @param {string} options.title - Título del diálogo.
     * @param {string} options.msg - Mensaje del diálogo.
     * @param {Function} options.onOk - Callback si el usuario hace clic en Aceptar.
     * @param {Function} [options.onCancel] - Callback si el usuario cancela.
     * @param {boolean} [options.danger=false] - Si es una acción destructiva/peligrosa.
     * @param {string} [options.okText='Aceptar'] - Texto del botón de confirmación.
     * @param {string} [options.cancelText='Cancelar'] - Texto del botón de cancelación.
     */
    show: function (options) {
        const {
            title,
            msg,
            onOk,
            onCancel,
            danger = false,
            okText = 'Aceptar',
            cancelText = 'Cancelar'
        } = options;

        const id = 'confirm-dialog-' + Date.now();
        
        const iconHtml = typeof Icons !== 'undefined' ? (danger ? Icons.alerta() : Icons.info()) : (danger ? Icons.alerta() : Icons.info());
        const variant = danger ? 'danger' : 'gold';

        const contentHtml = `
            <div class="error-dialog error-dialog--${variant}">
                <div class="error-dialog-icon error-dialog-icon--${variant}">${iconHtml}</div>
                <div class="error-dialog-title error-dialog-title--${variant}">${title}</div>
                <div class="error-dialog-msg">${msg}</div>
                <div class="error-dialog-actions">
                    <button class="error-dialog-btn secondary" id="${id}-cancel">${cancelText}</button>
                    <button class="error-dialog-btn primary error-dialog-btn--${variant}" id="${id}-ok">${okText}</button>
                </div>
            </div>
        `;

        const overlay = ModalManager.show(id, contentHtml, { closeOnOverlayClick: false });

        if (overlay) {
            overlay.classList.add('error-dialog-overlay');
        }

        let resolved = false;

        const cleanUpAndClose = () => {
            if (resolved) return;
            resolved = true;
            ModalManager.close(id);
        };

        const handleOk = () => {
            cleanUpAndClose();
            if (typeof onOk === 'function') onOk();
        };

        const handleCancel = () => {
            cleanUpAndClose();
            if (typeof onCancel === 'function') onCancel();
        };

        document.getElementById(`${id}-ok`).addEventListener('click', handleOk);
        document.getElementById(`${id}-cancel`).addEventListener('click', handleCancel);

        // Atajar tecla Escape para cancelar correctamente
        const escapeListener = (e) => {
            if (e.key === 'Escape' && !resolved) {
                document.removeEventListener('keydown', escapeListener);
                handleCancel();
            }
        };
        document.addEventListener('keydown', escapeListener);
    },

    /**
     * Helper Promise-based para un uso secuencial limpio
     */
    confirm: function (title, msg, danger = false, okText = 'Aceptar', cancelText = 'Cancelar') {
        return new Promise((resolve) => {
            this.show({
                title,
                msg,
                danger,
                okText,
                cancelText,
                onOk: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    },

    /**
     * Helper Promise-based para inputs de texto (reemplaza prompt() nativo).
     * Devuelve string con el valor introducido, o null si cancela.
     */
    prompt: function (title, msg, defaultValue = '', placeholder = '') {
        return new Promise((resolve) => {
            const id = 'prompt-dialog-' + Date.now();
            const inputId = id + '-input';
            const contentHtml = `
                <div class="error-dialog error-dialog--gold">
                    <div class="error-dialog-title error-dialog-title--gold">${title}</div>
                    <div class="error-dialog-msg">${msg}</div>
                    <input id="${inputId}" type="text" value="${defaultValue.replace(/"/g, '&quot;')}" placeholder="${placeholder}"
                           class="wizard-input mb-20 w-full">
                    <div class="error-dialog-actions">
                        <button class="error-dialog-btn secondary" id="${id}-cancel">Cancelar</button>
                        <button class="error-dialog-btn primary error-dialog-btn--gold" id="${id}-ok">Aceptar</button>
                    </div>
                </div>
            `;
            const overlay = ModalManager.show(id, contentHtml, { closeOnOverlayClick: false });
            if (overlay) {
                overlay.classList.add('error-dialog-overlay');
            }

            const input = document.getElementById(inputId);
            if (input) { input.focus(); input.select(); }

            let resolved = false;
            const cleanUp = () => { if (resolved) return; resolved = true; ModalManager.close(id); };

            const handleOk = () => {
                const value = document.getElementById(inputId)?.value ?? '';
                cleanUp();
                resolve(value.trim() || null);
            };
            const handleCancel = () => { cleanUp(); resolve(null); };

            document.getElementById(`${id}-ok`)?.addEventListener('click', handleOk);
            document.getElementById(`${id}-cancel`)?.addEventListener('click', handleCancel);
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') handleOk();
                    else if (e.key === 'Escape') handleCancel();
                });
            }
        });
    },

    /**
     * Helper Promise-based para alertas personalizadas sin usar alert() nativo
     */
    alert: function (title, msg) {
        return new Promise((resolve) => {
            const id = 'alert-dialog-' + Date.now();
            const alertIconHtml = typeof Icons !== 'undefined' ? Icons.info() : Icons.info();
            const contentHtml = `
                <div class="error-dialog error-dialog--gold">
                    <div class="error-dialog-icon error-dialog-icon--gold">${alertIconHtml}</div>
                    <div class="error-dialog-title error-dialog-title--gold">${title}</div>
                    <div class="error-dialog-msg">${msg}</div>
                    <div class="error-dialog-actions justify-center">
                        <button class="error-dialog-btn primary error-dialog-btn--gold" id="${id}-ok">Aceptar</button>
                    </div>
                </div>
            `;
            const overlay = ModalManager.show(id, contentHtml, { closeOnOverlayClick: false });
            if (overlay) {
                overlay.classList.add('error-dialog-overlay');
            }
            document.getElementById(`${id}-ok`).addEventListener('click', () => {
                ModalManager.close(id);
                resolve();
            });
        });
    }
};

window.Confirm = Confirm;