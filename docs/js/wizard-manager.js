/**
 * Livestock Manager - Generic Wizard Manager v1.2.0
 * Proporciona un framework para crear asistentes multi-paso de forma declarativa.
 * v1.2.0: Persistencia de borradores en localStorage + barra de progreso visual.
 */

const WizardManager = {
    create(options) {
        const { id, title, steps, initialData, onComplete, onCancel } = options;

        let currentStepIndex = 0;
        const draftKey = `wizard-draft-${id}`;
        let wizardData = { ...initialData };

        try {
            const draft = localStorage.getItem(draftKey);
            if (draft) {
                const parsed = JSON.parse(draft);
                if (parsed && typeof parsed === 'object') {
                    wizardData = { ...initialData, ...parsed };
                }
            }
        } catch (e) { /* ignore corrupt drafts */ }

        const saveDraft = () => {
            try { localStorage.setItem(draftKey, JSON.stringify(wizardData)); } catch (e) { /* quota */ }
        };

        const clearDraft = () => {
            try { localStorage.removeItem(draftKey); } catch (e) { /* ignore */ }
        };

        const overlay = document.createElement("div");
        overlay.id = id;
        overlay.className = "wizard-full-screen";

        const renderStepDots = () => {
            return steps.map((_, i) => {
                const cls = i < currentStepIndex ? 'wizard-dot-done' : i === currentStepIndex ? 'wizard-dot-current' : 'wizard-dot-pending';
                return `<span class="wizard-dot ${cls}" data-step="${i}"></span>`;
            }).join('');
        };

        const render = async () => {
            const step = steps[currentStepIndex];
            const isLastStep = currentStepIndex === steps.length - 1;

            let contentHtml = typeof step.content === 'function' ? await step.content(wizardData) : step.content;

            overlay.innerHTML = `
        <div class="wizard-header-fixed">
          <h2>${title}</h2>
          <div class="wizard-step-indicator">PASO ${currentStepIndex + 1} DE ${steps.length}</div>
          <div class="wizard-step-dots">${renderStepDots()}</div>
        </div>

        <div id="wizard-content-area" class="wizard-content-scrollable animate-in">
          ${contentHtml}
        </div>

        <div id="wizard-nav-area" class="wizard-footer-fixed">
          ${currentStepIndex > 0 ? `<button id="wizard-btn-prev" class="wizard-btn-action wizard-btn-secondary">${Icons.atras()} Volver</button>` : '<div></div>'}
          <div class="wizard-footer-buttons">
            <button id="wizard-btn-cancel" class="wizard-btn-action wizard-btn-secondary">Cancelar</button>
            ${!isLastStep ? `<button id="wizard-btn-next" class="wizard-btn-action wizard-btn-primary">Siguiente ${Icons.siguiente()}</button>` : ''}
            ${isLastStep ? `<button id="wizard-btn-finish" class="wizard-btn-action wizard-btn-success">Finalizar ${Icons.check()}</button>` : ''}
          </div>
        </div>
      `;

            const contentArea = overlay.querySelector('#wizard-content-area');

            const prevBtn = overlay.querySelector('#wizard-btn-prev');
            const nextBtn = overlay.querySelector('#wizard-btn-next');
            const finishBtn = overlay.querySelector('#wizard-btn-finish');
            const cancelBtn = overlay.querySelector('#wizard-btn-cancel');

            if (prevBtn) {
                prevBtn.onclick = async () => {
                    await updateDataFromStep();
                    currentStepIndex--;
                    render();
                };
            }

            if (nextBtn) {
                nextBtn.onclick = async () => {
                    if (await updateDataFromStep() && await validateStep()) {
                        saveDraft();
                        currentStepIndex++;
                        render();
                    }
                };
            }

            if (finishBtn) {
                finishBtn.onclick = async () => {
                    if (await updateDataFromStep() && await validateStep()) {
                        clearDraft();
                        if (onComplete) await onComplete(wizardData);
                        overlay.remove();
                    }
                };
            }

            if (cancelBtn) {
                cancelBtn.onclick = async () => {
                    if (currentStepIndex > 0 || Object.keys(wizardData).some(k => initialData[k] !== wizardData[k])) {
                        const ok = await Confirm.confirm('Salir sin guardar', '¿Cerrar sin guardar datos?', false);
                        if (!ok) return;
                        clearDraft();
                    }
                    if (onCancel) onCancel();
                    overlay.remove();
                };
            }

            if (step.onRender) {
                step.onRender(wizardData, contentArea);
            }
        };

        const updateDataFromStep = async () => {
            const step = steps[currentStepIndex];
            if (step.onChange) {
                try {
                    await step.onChange(wizardData);
                } catch (e) {
                    App.toastError(e.message);
                    return false;
                }
            }
            return true;
        };

        const validateStep = async () => {
            const step = steps[currentStepIndex];
            if (step.validate) {
                try {
                    const isValid = await step.validate(wizardData);
                    if (!isValid) {
                        return false;
                    }
                } catch (e) {
                    App.toastError(e.message);
                    return false;
                }
            }
            return true;
        };

        document.body.appendChild(overlay);
        render();
    }
};

window.WizardManager = WizardManager;
