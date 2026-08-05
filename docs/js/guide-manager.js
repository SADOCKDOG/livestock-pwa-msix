/**
 * Livestock Manager - GuideManager v1.0.0
 * Motor de guías interactivas: overlay z-3500, spotlight SVG, popover narrativo,
 * navegación, MutationObserver perezoso para wizards, waitFor, re-anclaje, chip reanudar.
 */
(function () {
  'use strict';

  // ==================== ESTADO ====================
  const _state = {
    enabled: true,              // toggle global
    seen: [],                   // guías completadas (auto-arranque no repite)
    dismissed: [],              // "No mostrar de nuevo" por guía (FAB aún relanza)
    currentGuide: null,         // { guide, stepIndex, overlay, popover, spotlight, observer }
    _hydrated: false            // hidratado desde App._config
  };

  // ==================== HELPERS ====================

  /** Lee config caliente desde App._config (cache en memoria, respeta AjustesView._saveConfig) */
  function _readConfig() {
    const cfg = (window.App && App._config) || {};
    const guides = cfg.guides || {};
    return {
      enabled: guides.enabled ?? true,
      seen: Array.isArray(guides.seen) ? guides.seen : [],
      dismissed: Array.isArray(guides.dismissed) ? guides.dismissed : []
    };
  }

  /** Escribe config y actualiza App._config cache */
  function _writeConfig(patch) {
    const cfg = _readConfig();
    Object.assign(cfg, patch);

    // La cache en memoria se actualiza AQUÍ, de forma síncrona. _saveConfig es async y
    // sólo escribe App._config al resolverse: si el usuario pulsa "No mostrar de nuevo"
    // y la app navega en el mismo instante, maybeStart leía el `dismissed` anterior y
    // volvía a arrancar la guía recién descartada.
    if (window.App) {
      App._config = App._config || {};
      App._config.guides = { ...(App._config.guides || {}), ...cfg };
    }

    if (window.AjustesView && typeof AjustesView._saveConfig === 'function') {
      AjustesView._saveConfig({ guides: cfg });
    }
    Object.assign(_state, cfg);
  }

  /** Hidrata estado desde App._config al inicio (una sola vez) */
  function _hydrate() {
    if (_state._hydrated) return Promise.resolve();
    _state._hydrated = true;
    const cfg = _readConfig();
    Object.assign(_state, cfg);
    return Promise.resolve();
  }

  /** Comprueba si las guías están globalmente habilitadas.
   *  Lectura CALIENTE (spec §3.3): siempre desde App._config, nunca desde _state,
   *  porque AjustesView._saveConfig escribe la config sin pasar por _writeConfig. */
  function isEnabled() {
    return _readConfig().enabled;
  }

  /** querySelector tolerante: un selector mal formado en una guía degrada ese paso a
   *  narrativo (sin spotlight) en vez de lanzar y dejar el tour congelado. */
  function _qs(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch (e) {
      console.warn('[GuideManager] Selector inválido, el paso se muestra sin spotlight:', selector);
      return null;
    }
  }

  /**
   * ¿El elemento ocupa superficie real en pantalla? Un selector puede casar con un nodo
   * envoltorio de tamaño 0, oculto o colapsado; resaltarlo dibujaba un anillo diminuto en
   * una zona arbitraria (visto en las capturas de ExPro). En ese caso es mejor tratar el
   * paso como narrativo.
   */
  function _esResaltable(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0.05;
  }

  /** Genera ID único para elementos del overlay */
  function _uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Evalúa el predicado `disponible()` de una guía (si existe).
   * Permite que cada guía decida si debe auto-arrancarse según datos de la finca.
   * @param {Object} guide - Guía a evaluar
   * @returns {Promise<boolean>} true si la guía está disponible (o no tiene el predicado)
   */
  async function _checkDisponible(guide) {
    if (!guide) return false;
    if (typeof guide.disponible === 'function') {
      try {
        return await guide.disponible();
      } catch (e) {
        console.warn('[GuideManager] Error evaluando disponible():', e);
        return false;
      }
    }
    return true; // sin predicado → siempre disponible
  }

  /** Obtiene color neón del pilar (usa module-colors.js si existe) */
  function _getPillarColor(pillar) {
    // Fuente de verdad: el color que cada vista pasa a App.updateHeaderColor
    // (ganaderia-view.js:44, explotacion-view.js:209, comercializacion-view.js:192).
    // NO se usa getModuleColor: module-colors.js:24 mapea /ganaderia a #FF4444 (rojo),
    // que no es el lima con el que GeGan pinta realmente su header.
    const porPilar = { gegan: 'var(--c-success)', expro: 'var(--c-info)', comer: 'var(--c-warning)' };
    return porPilar[pillar] || 'var(--c-success)';
  }

  /** Escape HTML simple para títulos/cuerpos (markdown ligero: **negrita**) */
  function _renderBody(body) {
    if (!body) return '';
    // **texto** -> <strong>texto</strong>
    return body.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // ==================== OVERLAY + SPOTLIGHT (SVG MÁSCARA) ====================

  /**
   * Crea el overlay con máscara SVG (4 rectángulos sombreados + 1 hueco recortado).
   * @param {HTMLElement} target - Elemento a destacar
   * @param {string} color - Color neón del pilar
   * @returns {HTMLElement} overlay
   */
  function _createOverlay(target, color) {
    const overlay = document.createElement('div');
    overlay.className = 'guide-overlay';
    // SIN background ni backdrop-filter propios: el oscurecimiento lo aporta EXCLUSIVAMENTE
    // el rectángulo enmascarado del SVG. Si el div pinta su propio fondo, tapa el hueco de
    // la máscara y el spotlight no revela nada — la pantalla queda uniformemente negra.
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:3500; pointer-events:none;
    `;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.inset = '0';

    const defs = document.createElementNS(svgNS, 'defs');
    const mask = document.createElementNS(svgNS, 'mask');
    mask.id = _uid('guide-mask');

    // Rectángulo base (todo el viewport)
    const fullRect = document.createElementNS(svgNS, 'rect');
    fullRect.setAttribute('x', '0');
    fullRect.setAttribute('y', '0');
    fullRect.setAttribute('width', '100%');
    fullRect.setAttribute('height', '100%');
    fullRect.setAttribute('fill', 'white');
    mask.appendChild(fullRect);

    // Hueco recortado (target) — se actualiza en _updateSpotlight
    const holeRect = document.createElementNS(svgNS, 'rect');
    holeRect.id = _uid('guide-hole');
    holeRect.setAttribute('fill', 'black'); // negro = transparente en mask
    mask.appendChild(holeRect);

    defs.appendChild(mask);
    svg.appendChild(defs);

    // Rectángulo visible que usa la máscara
    const maskedRect = document.createElementNS(svgNS, 'rect');
    maskedRect.setAttribute('x', '0');
    maskedRect.setAttribute('y', '0');
    maskedRect.setAttribute('width', '100%');
    maskedRect.setAttribute('height', '100%');
    maskedRect.setAttribute('fill', 'rgba(0,0,0,0.82)');
    maskedRect.setAttribute('mask', `url(#${mask.id})`);
    svg.appendChild(maskedRect);

    // Anillo spotlight (neón del pilar) — se actualiza en _updateSpotlight
    const ring = document.createElementNS(svgNS, 'rect');
    ring.id = _uid('guide-ring');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', color);
    ring.setAttribute('stroke-width', '3');
    ring.setAttribute('filter', 'drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor)');
    ring.setAttribute('rx', '12');
    ring.setAttribute('ry', '12');
    svg.appendChild(ring);

    overlay.appendChild(svg);
    document.body.appendChild(overlay);

    // Guardar referencias para actualización
    overlay._svg = svg;
    overlay._hole = holeRect;
    overlay._ring = ring;
    overlay._target = target;
    overlay._color = color;

    return overlay;
  }

  /**
   * Actualiza posición/tamaño del spotlight (hueco + anillo) según target.getBoundingClientRect().
   * @param {HTMLElement} overlay
   * @param {HTMLElement} target
   */
  function _updateSpotlight(overlay, target) {
    if (!overlay || !target) return;
    const rect = target.getBoundingClientRect();
    const padding = 8;
    const x = rect.left - padding;
    const y = rect.top - padding;
    const w = rect.width + padding * 2;
    const h = rect.height + padding * 2;
    const r = 12;

    // Hueco en máscara (coordenadas absolutas viewport)
    overlay._hole.setAttribute('x', x);
    overlay._hole.setAttribute('y', y);
    overlay._hole.setAttribute('width', w);
    overlay._hole.setAttribute('height', h);
    overlay._hole.setAttribute('rx', r);
    overlay._hole.setAttribute('ry', r);

    // Anillo neón
    overlay._ring.setAttribute('x', x);
    overlay._ring.setAttribute('y', y);
    overlay._ring.setAttribute('width', w);
    overlay._ring.setAttribute('height', h);
    overlay._ring.setAttribute('rx', r);
    overlay._ring.setAttribute('ry', r);
  }

  // ==================== POPOVER NARRATIVO ====================

  /**
   * Crea el popover anclado al target (arriba si hay espacio, abajo si no).
   * @param {Object} step - Paso actual
   * @param {HTMLElement} target - Elemento ancla
   * @param {number} stepIndex - Índice 0-based
   * @param {number} totalSteps - Total de pasos
   * @param {string} color - Color neón del pilar
   * @returns {HTMLElement} popover
   */
  function _createPopover(step, target, stepIndex, totalSteps, color) {
    const popover = document.createElement('div');
    popover.className = 'guide-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'true');
    popover.style.cssText = `
      position:fixed; z-index:3501; pointer-events:auto;
      max-width:320px; min-width:260px;
      background:var(--surface, #1a1a1a); border-radius:var(--r-xl, 16px);
      box-shadow:0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
      font-family:inherit; font-size:0.8rem; line-height:1.4;
      color:var(--text, #fff); padding:16px;
    `;
    // Sin borde superior iluminado (regla estricta de cards)

    // Dots de progreso
    const dots = document.createElement('div');
    dots.className = 'guide-dots';
    dots.style.cssText = 'display:flex; gap:6px; justify-content:center; margin-bottom:12px;';
    for (let i = 0; i < totalSteps; i++) {
      const dot = document.createElement('span');
      dot.className = 'tour-dot' + (i === stepIndex ? ' active' : '');
      dot.style.cssText = `
        width:8px; height:8px; border-radius:50%; background:var(--c-555, #555);
        transition:background 0.2s, transform 0.2s;
        ${i === stepIndex ? 'background:' + color + '; transform:scale(1.2);' : ''}
      `;
      dots.appendChild(dot);
    }

    // Título
    const title = document.createElement('h4');
    title.className = 'guide-popover-title';
    title.textContent = step.title;
    title.style.cssText = 'margin:0 0 8px; font-size:0.85rem; font-weight:900; color:' + color + ';';

    // Cuerpo (markdown ligero)
    const body = document.createElement('div');
    body.className = 'guide-popover-body';
    body.innerHTML = _renderBody(step.body);
    body.style.cssText = 'margin-bottom:14px; font-size:0.75rem; line-height:1.5; color:var(--c-ccc, #ccc);';

    // Botones
    const btnBar = document.createElement('div');
    btnBar.style.cssText = 'display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;';

    const btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.textContent = 'Anterior';
    btnPrev.style.cssText = _btnStyle('secondary');
    btnPrev.addEventListener('click', () => GuideManager.prev());

    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.setAttribute('data-guide-action', 'next');
    btnNext.textContent = stepIndex === totalSteps - 1 ? 'Finalizar' : 'Siguiente';
    btnNext.style.cssText = _btnStyle('primary', color);
    btnNext.addEventListener('click', () => GuideManager.next());

    const btnSkip = document.createElement('button');
    btnSkip.type = 'button';
    btnSkip.textContent = 'Saltar';
    btnSkip.style.cssText = _btnStyle('ghost');
    btnSkip.addEventListener('click', () => GuideManager.skip());

    const btnDismiss = document.createElement('button');
    btnDismiss.type = 'button';
    btnDismiss.textContent = 'No mostrar de nuevo';
    btnDismiss.style.cssText = _btnStyle('ghost');
    btnDismiss.addEventListener('click', () => GuideManager.dismiss());

    // Focus trap: primero = btnPrev (o btnNext si no hay prev), último = btnDismiss
    btnPrev.setAttribute('data-guide-focus', 'first');
    btnDismiss.setAttribute('data-guide-focus', 'last');

    if (stepIndex > 0) btnBar.appendChild(btnPrev);
    btnBar.appendChild(btnNext);
    btnBar.appendChild(btnSkip);
    btnBar.appendChild(btnDismiss);

    popover.appendChild(dots);
    popover.appendChild(title);
    popover.appendChild(body);
    popover.appendChild(btnBar);
    document.body.appendChild(popover);

    // Posicionar
    _positionPopover(popover, target);

    popover._color = color;
    return popover;
  }

  function _btnStyle(variant, color) {
    const base = 'padding:10px 16px; border-radius:8px; font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; min-height:44px; min-width:44px; cursor:pointer; border:none; transition:transform 0.05s, opacity 0.1s;';
    const active = 'transform:scale(0.95);';
    switch (variant) {
      case 'primary': return base + 'background:' + color + '; color:#000;' + active;
      case 'secondary': return base + 'background:var(--c-333, #333); color:var(--c-fff, #fff); border:1px solid var(--c-555, #555);' + active;
      case 'ghost': return base + 'background:transparent; color:var(--c-aaa, #aaa);' + active;
      default: return base;
    }
  }

  /**
   * Posiciona popover arriba del target si cabe, sino abajo. Centrado horizontalmente.
   */
  /** Alto en px de una custom property de safe-area (env(safe-area-inset-*) vía CSS). */
  function _safeInset(nombre) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nombre);
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Lleva el target a la banda visible si está fuera. Sin esto el spotlight se dibuja
   * sobre una zona que el usuario no ve (en el móvil aparecía el anillo pegado al borde
   * o directamente fuera de pantalla) y el popover se ancla contra coordenadas inútiles.
   * Scroll instantáneo: hay que medir inmediatamente después.
   */
  function _ensureVisible(target) {
    const r = target.getBoundingClientRect();
    const sup = 62 + _safeInset('--safe-top');
    const inf = window.innerHeight - (65 + _safeInset('--safe-bottom'));
    if (r.top < sup || r.bottom > inf) {
      try {
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      } catch (e) { /* navegadores sin opciones: se ignora */ }
    }
  }

  function _positionPopover(popover, target) {
    const rect = target.getBoundingClientRect();
    // El popover se centra antes de medir para que la altura sea la real del contenido
    // del paso actual (el texto cambia de un paso a otro).
    popover.style.transform = 'none';
    const popoverRect = popover.getBoundingClientRect();
    const gap = 12;
    const margen = 12;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Banda utilizable: por debajo del header fijo y por encima de la bottom-nav,
    // respetando las safe-areas del dispositivo (edge-to-edge en Android).
    const limiteSup = 62 + _safeInset('--safe-top') + margen;
    const limiteInf = viewportH - (65 + _safeInset('--safe-bottom')) - margen;

    // Horizontal: centrado sobre el target y acotado al ANCHO (antes se acotaba con la
    // altura del viewport, que en móvil vertical es mucho mayor y no acotaba nada).
    let left = rect.left + rect.width / 2 - popoverRect.width / 2;
    left = Math.max(margen, Math.min(left, viewportW - popoverRect.width - margen));

    // Vertical: arriba del target si cabe, abajo si no.
    let top = rect.top - popoverRect.height - gap;
    if (top < limiteSup) {
      const abajo = rect.bottom + gap;
      top = (abajo + popoverRect.height <= limiteInf) ? abajo : limiteSup;
    }

    // Garantía final: el popover nunca sobresale de la banda utilizable, de modo que sus
    // botones (Siguiente / Saltar) queden siempre alcanzables. Si es más alto que la
    // banda, se ancla arriba y hace scroll interno en vez de desbordar fuera de pantalla.
    const alturaDisponible = limiteInf - limiteSup;
    if (popoverRect.height > alturaDisponible) {
      top = limiteSup;
      popover.style.maxHeight = alturaDisponible + 'px';
      popover.style.overflowY = 'auto';
    } else {
      popover.style.maxHeight = '';
      popover.style.overflowY = '';
      top = Math.max(limiteSup, Math.min(top, limiteInf - popoverRect.height));
    }

    popover.style.top = top + 'px';
    popover.style.left = left + 'px';
  }

  // ==================== CHIP "REAUDAR GUÍA" ====================

  let _chip = null;

  function _showResumeChip() {
    if (_chip) return;
    const chip = document.createElement('button');
    chip.id = 'guide-resume-chip';
    chip.className = 'guide-resume-chip';
    chip.innerHTML = Icons ? Icons.rotacion() : '↻';
    chip.setAttribute('aria-label', 'Reanudar guía');
    chip.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:4500;
      width:56px; height:56px; border-radius:50%;
      background:var(--c-success, #00cc00); color:#000;
      border:none; box-shadow:0 4px 20px rgba(0,204,0,0.4);
      display:flex; align-items:center; justify-content:center;
      font-size:1.5rem; cursor:pointer;
      animation:guide-chip-pulse 1.5s ease-in-out infinite;
      touch-action:manipulation;
    `;
    chip.addEventListener('click', () => GuideManager._resumeAfterWizard());
    document.body.appendChild(chip);
    _chip = chip;

    // Auto-ocultar si hay tour bienvenida o asistente activo
    _checkChipVisibility();
  }

  function _hideResumeChip() {
    if (_chip) {
      _chip.remove();
      _chip = null;
    }
  }

  function _checkChipVisibility() {
    if (!_chip) return;
    const hidden = document.getElementById('tour-flotante-overlay') ||
                   document.querySelector('.asistente-loading-overlay');
    _chip.style.display = hidden ? 'none' : 'flex';
  }

  // Observer para auto-ocultar chip cuando aparece/desaparece bienvenida/asistente
  let _chipObserver = null;
  function _startChipObserver() {
    if (_chipObserver) return;
    _chipObserver = new MutationObserver(_checkChipVisibility);
    _chipObserver.observe(document.body, { childList: true, subtree: true });
  }
  function _stopChipObserver() {
    if (_chipObserver) {
      _chipObserver.disconnect();
      _chipObserver = null;
    }
  }

  // ==================== MUTATION OBSERVER PARA WIZARDS ====================

  /**
   * Ejecuta un paso con launch: abre wizard real y pausa guía hasta que cierra.
   * Usa MutationObserver perezoso (childList sin subtree, por identidad de nodo).
   * Cubre 3 salidas: Finalizar, Cancelar confirmado, Android-back wizard.remove().
   */
  async function _runLaunchStep(step) {
    const state = _state.currentGuide;
    if (!state) return;

    state._nodoPausa = null; // aún no existe el wizard

    state._observer = new MutationObserver(muts => {
      for (const m of muts) {
        // Capturar nodo wizard cuando aparece (caso a: launch propio, caso b: usuario abre fuera del guion)
        if (!state._nodoPausa) {
          const nuevo = [...m.addedNodes].find(n =>
            n.nodeType === Node.ELEMENT_NODE && n.classList?.contains('wizard-full-screen')
          );
          if (nuevo) {
            state._nodoPausa = nuevo;
            _hidePopover();
            _showResumeChip();
            _startChipObserver();
            continue;
          }
        }
        // Cierre: el nodo capturado se elimina (3 salidas convergen aquí)
        if (state._nodoPausa && [...m.removedNodes].includes(state._nodoPausa)) {
          _teardownObserver();
          _resumeAfterWizard();
          return;
        }
      }
    });
    state._observer.observe(document.body, { childList: true }); // sin subtree

    // Ejecutar launch — abre el wizard real
    if (typeof step.launch === 'function') {
      try {
        step.launch();
      } catch (e) {
        console.error('[GuideManager] Error en launch:', e);
        _teardownObserver();
        _resumeAfterWizard();
      }
    }
  }

  function _teardownObserver() {
    const state = _state.currentGuide;
    if (state && state._observer) {
      state._observer.disconnect();
      state._observer = null;
      state._nodoPausa = null;
    }
    _hideResumeChip();
    _stopChipObserver();

    // Si no hay guía activa (p. ej. terminó mientras el wizard estaba abierto),
    // asegurar que no queden overlay/popover huérfanos en el DOM
    if (!_state.currentGuide) {
      document.querySelectorAll('.guide-overlay, .guide-popover').forEach(n => n.remove());
    }
  }

  function _resumeAfterWizard() {
    const state = _state.currentGuide;
    if (!state) return;
    // Recalcular spotlight/popover por si el DOM cambió
    setTimeout(() => {
      if (state.overlay && state.step.target) {
        const target = _qs(state.step.target);
        if (target) {
          _updateSpotlight(state.overlay, target);
          _positionPopover(state.popover, target);
        }
      }
      _showPopover();
    }, 0); // next tick
  }

  function _showPopover() {
    const state = _state.currentGuide;
    if (state && state.popover) state.popover.style.display = '';
  }

  function _hidePopover() {
    const state = _state.currentGuide;
    if (state && state.popover) state.popover.style.display = 'none';
  }

  // ==================== NAVEGACIÓN ====================

  /**
   * @param {number} index - paso destino
   * @param {number} [dir=1] - dirección del avance (1 adelante, -1 atrás), usada para
   *        saltar pasos `optional` cuyo target no está en el DOM sin quedarse atascado.
   */
  function _goToStep(index, dir = 1) {
    const state = _state.currentGuide;
    if (!state || !state.guide) return;
    const steps = state.guide.steps;
    if (index < 0 || index >= steps.length) return;

    // Paso opcional (spec §4): si su elemento no está presente —porque depende de datos
    // o de un formulario abierto— se omite en lugar de mostrar un paso sin contexto.
    const candidato = steps[index];
    if (candidato.optional && candidato.target && !_qs(candidato.target)) {
      const siguiente = index + dir;
      if (siguiente < 0 || siguiente >= steps.length) {
        if (dir > 0) return GuideManager._finish();
        return; // hacia atrás no hay nada más: se queda donde está
      }
      return _goToStep(siguiente, dir);
    }

    state.stepIndex = index;
    state.step = steps[index];

    const pop = state.popover;
    const color = pop?._color || _getPillarColor(state.guide.pillar);

    // Repintar el CONTENIDO del paso. Sin esto el popover conserva el texto del paso 0
    // durante toda la guía: solo se movía el spotlight.
    if (pop) {
      const title = pop.querySelector('.guide-popover-title');
      const body = pop.querySelector('.guide-popover-body');
      if (title) title.textContent = state.step.title || '';
      if (body) body.innerHTML = _renderBody(state.step.body);

      pop.querySelectorAll('.tour-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
        dot.style.background = i === index ? color : 'var(--c-555, #555)';
        dot.style.transform = i === index ? 'scale(1.2)' : 'scale(1)';
      });

      const btnNext = pop.querySelector('button[data-guide-action="next"]');
      if (btnNext) btnNext.textContent = index === steps.length - 1 ? 'Finalizar' : 'Siguiente';
    }

    // Si hay target visible, anclar overlay + popover sobre él
    const candidatoTarget = state.step.target ? _qs(state.step.target) : null;
    const target = _esResaltable(candidatoTarget) ? candidatoTarget : null;
    if (target) {
      _ensureVisible(target);
      _updateSpotlight(state.overlay, target);
      _positionPopover(state.popover, target);
    } else {
      // Paso narrativo (target: null o target ausente) — centrar popover en viewport
      state.overlay._hole.setAttribute('x', '-9999');
      state.overlay._hole.setAttribute('y', '-9999');
      state.overlay._hole.setAttribute('width', '0');
      state.overlay._hole.setAttribute('height', '0');
      state.overlay._ring.setAttribute('x', '-9999');
      state.popover.style.top = '50%';
      state.popover.style.left = '50%';
      state.popover.style.transform = 'translate(-50%, -50%)';
      // Limpiar el scroll interno que pudiera haber dejado un paso anclado más alto
      // que la banda utilizable.
      state.popover.style.maxHeight = '';
      state.popover.style.overflowY = '';
    }

    // Paso de captura: abrir el wizard real. Antes solo se hacía si el launch estaba en
    // el PRIMER paso (start), así que los launch intermedios no se ejecutaban nunca.
    if (typeof state.step.launch === 'function') _runLaunchStep(state.step);
  }

  // ==================== API PÚBLICA ====================

  const GuideManager = {
    // Hidratación
    _hydrate,

    // Estado
    isEnabled,

    // Auto-arranque: evalúa precondiciones y arranca si procede
    async maybeStart(route, tab) {
      await _hydrate();

      // Con un tour en curso no se auto-arranca nada. Las guías panorámicas cambian de
      // tab y de ruta por diseño (_cambiarSubModulo, App.route), y cada navegación vuelve
      // a pasar por el hook de route(): sin esta guarda, start() cerraba el tour vivo y lo
      // relanzaba en el paso 0 una y otra vez (bucle observado en Android).
      if (_state.currentGuide) return;

      const cfg = _readConfig();
      if (!cfg.enabled) return;
      if (!window.Fincas || !(await Fincas.getActiveId())) return; // sin finca activa
      if (document.getElementById('tour-flotante-overlay')) return; // bienvenida activa
      if (document.querySelector('.asistente-loading-overlay')) return; // asistente activo

      const flags = window.ModoContextoHelper ? ModoContextoHelper.getFlags() : { leche: true, carne: false };

      // Los ids son `<pillar>.<tab>` (gegan.animales), no `<route>.<tab>`: no se pueden
      // derivar de la ruta. Se resuelve la guía primero y se filtra por su id real.
      const visto = (g) => !g || cfg.seen.includes(g.id) || cfg.dismissed.includes(g.id);

      // ============================================
      // PRIMERO: Guía transversal "onboarding.primeros-pasos" en finca vacía
      // ============================================
      // Esta guía tiene prioridad absoluta sobre las de pilar/tab cuando la finca está vacía.
      // Solo arranca si: (a) no se ha visto/descartado, (b) disponible()=true (finca vacía),
      // (c) estamos en uno de los 3 pilares que recorre la guía (GeGan, ExPro, CoMer).
      const onboarding = GuideRegistry.getAll().find(g => g.id === 'onboarding.primeros-pasos');
      const PILARES_ONBOARDING = ['/ganaderia', '/explotacion', '/comercializacion'];
      if (onboarding && !visto(onboarding) && PILARES_ONBOARDING.includes(route) && await _checkDisponible(onboarding)) {
        return await this.start(onboarding.id);
      }

      // Prioridad (spec §6.1): la panorámica del pilar manda mientras no se haya visto;
      // una vez vista (o descartada), se ofrece la guía del tab actual.
      const panoramica = GuideRegistry.getPanoramica(route, flags);
      if (!visto(panoramica) && await _checkDisponible(panoramica)) return await this.start(panoramica.id);

      const guiaTab = tab ? GuideRegistry.getByRouteTab(route, tab, flags) : null;
      if (visto(guiaTab)) return;
      if (guiaTab && await _checkDisponible(guiaTab)) return await this.start(guiaTab.id);
    },

    // Arranque manual (FAB, test, etc.) — ignora seen/dismissed
    async start(guideId) {
      await _hydrate();
      if (!isEnabled()) return;

      const guide = GuideRegistry.getAll().find(g => g.id === guideId);
      if (!guide) {
        console.warn('[GuideManager] Guía no encontrada:', guideId);
        return;
      }

      // Cerrar el tour en curso antes de montar otro: sin esto _state.currentGuide se
      // pisa y su overlay queda huérfano en el DOM (se apilaban varios a z-3500,
      // oscureciendo la pantalla sin forma de cerrarlos).
      if (_state.currentGuide) this._cleanup(false);
      document.querySelectorAll('.guide-overlay, .guide-popover').forEach(n => n.remove());

      // `seen` se marca al COMPLETAR el último paso (_finish), nunca al arrancar:
      // de lo contrario Saltar equivaldría a "no volver a mostrar" (spec §6.1 y §6.3).

      const color = _getPillarColor(guide.pillar);
      const firstStep = guide.steps[0];

      // Esperar target si waitFor
      let target = null;
      if (firstStep.target) {
        target = await _waitForSelector(firstStep.target, firstStep.waitFor);
        if (!target) {
          console.warn('[GuideManager] Target no encontrado tras waitFor:', firstStep.target);
          // Seguir sin target (paso narrativo centrado)
        } else if (!_esResaltable(target)) {
          console.warn('[GuideManager] Target sin superficie visible, se omite el spotlight:', firstStep.target);
          target = null;
        } else {
          _ensureVisible(target);
        }
      }

      // Crear overlay
      const overlay = target ? _createOverlay(target, color) : _createOverlay(
        { getBoundingClientRect: () => ({ left: -9999, top: -9999, width: 0, height: 0 }) }, color
      );

      // Crear popover
      const popover = _createPopover(firstStep, target || document.body, 0, guide.steps.length, color);

      // Estado actual
      _state.currentGuide = {
        guide,
        stepIndex: 0,
        step: firstStep,
        overlay,
        popover,
        pillarColor: color,
        _resizeHandler: () => {
          if (target) _updateSpotlight(overlay, target);
          _positionPopover(popover, target || document.body);
        },
        _scrollHandler: () => {
          if (target) _positionPopover(popover, target);
        }
      };

      // Listeners recálculo
      window.addEventListener('resize', _state.currentGuide._resizeHandler, { passive: true });
      window.addEventListener('scroll', _state.currentGuide._scrollHandler, { passive: true });
      window.addEventListener('orientationchange', _state.currentGuide._resizeHandler, { passive: true });

      // Focus trap en popover
      _setupFocusTrap(popover);

      // Escape = Saltar
      _state.currentGuide._keydownHandler = (e) => {
        if (e.key === 'Escape') GuideManager.skip();
      };
      document.addEventListener('keydown', _state.currentGuide._keydownHandler);

      // Si el primer paso tiene launch, ejecutarlo
      if (firstStep.launch) {
        await _runLaunchStep(firstStep);
      }
    },

    // Re-lanzar (FAB) — ignora seen/dismissed
    async relaunch(guideId) {
      await this.start(guideId);
    },

    next() {
      const state = _state.currentGuide;
      if (!state) return;
      if (state.stepIndex < state.guide.steps.length - 1) {
        _goToStep(state.stepIndex + 1, 1);
      } else {
        this._finish();
      }
    },

    prev() {
      const state = _state.currentGuide;
      if (!state) return;
      if (state.stepIndex > 0) {
        _goToStep(state.stepIndex - 1, -1);
      }
    },

    skip() {
      this._cleanup(false); // no marca seen ni dismissed
    },

    dismiss() {
      const state = _state.currentGuide;
      if (!state) return;
      const id = state.guide.id;
      const { dismissed } = _readConfig();
      if (!dismissed.includes(id)) _writeConfig({ dismissed: [...dismissed, id] });
      this._cleanup(true);
    },

    _finish() {
      const state = _state.currentGuide;
      if (!state) return;
      const id = state.guide.id;
      // Marcar completada
      const { seen } = _readConfig();
      if (!seen.includes(id)) {
        _writeConfig({ seen: [...seen, id] });
      }
      this._cleanup(true);
    },

    _cleanup(markSeen) {
      const state = _state.currentGuide;
      if (!state) {
        // Sin guía activa puede quedar overlay huérfano en el DOM (el motor se recargó,
        // o algo destruyó el estado sin desmontar). Se retira igualmente: de lo contrario
        // la pantalla queda oscurecida y Saltar no tiene ningún efecto.
        document.querySelectorAll('.guide-overlay, .guide-popover, .guide-resume-chip')
          .forEach(n => n.remove());
        return;
      }

      try {
        // Limpiar listeners
        window.removeEventListener('resize', state._resizeHandler);
        window.removeEventListener('scroll', state._scrollHandler);
        window.removeEventListener('orientationchange', state._resizeHandler);
        document.removeEventListener('keydown', state._keydownHandler);

        // Limpiar observer si activo
        _teardownObserver();

        // Eliminar DOM (incluye cualquier resto huérfano de un tour anterior)
        state.overlay?.remove();
        state.popover?.remove();
        document.querySelectorAll('.guide-overlay, .guide-popover').forEach(n => n.remove());
      } finally {
        // Garantizar que el estado se limpia aunque falle cualquier remove()
        _state.currentGuide = null;
      }
    },

    // Re-anclaje tras cambio de tab (llamado desde EventBus 'view:tabChanged')
    reanchor() {
      const state = _state.currentGuide;
      if (!state || !state.step) return;
      if (!state.step.target) return; // paso narrativo, no hay target

      const target = _qs(state.step.target);
      if (target) {
        _updateSpotlight(state.overlay, target);
        _positionPopover(state.popover, target);
      }
    }
  };

  // ==================== WAITFOR SELECTOR ====================

  /**
   * Espera a que exista un selector en el DOM (hasta 2s, polling 50ms).
   * @param {string} selector
   * @param {boolean} waitFor - si false, devuelve inmediato
   * @returns {Promise<HTMLElement|null>}
   */
  function _waitForSelector(selector, waitFor) {
    if (!waitFor) return Promise.resolve(_qs(selector));
    // waitFor admite `true` (2s por defecto) o un número de milisegundos.
    const limite = typeof waitFor === 'number' ? waitFor : 2000;
    return new Promise(resolve => {
      const start = Date.now();
      const interval = setInterval(() => {
        const el = _qs(selector);
        if (el || Date.now() - start > limite) {
          clearInterval(interval);
          resolve(el || null);
        }
      }, 50);
    });
  }

  // ==================== FOCUS TRAP ====================

  function _setupFocusTrap(popover) {
    const focusable = popover.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    popover.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Focus inicial
    setTimeout(() => first?.focus(), 0);
  }

  // ==================== ICONOS FALLBACK ====================

  // Icons.ayuda() se añade en js/icons.js; este fallback es por si no existe
  const Icons = window.Icons || {
    rotacion: () => '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
    ayuda: () => '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm0-4h-2V7h2v8z"/></svg>'
  };

  // Exponer global
  window.GuideManager = GuideManager;

  // El evento view:tabChanged se emitía desde App._cambiarSubmoduloConGuia pero nadie lo
  // escuchaba, así que reanchor() no llegaba a ejecutarse nunca: al cambiar de pestaña el
  // fondo cambiaba y el popover seguía siendo el de la pestaña anterior (por ejemplo,
  // "Bienvenido a Zonas y Parcelas" sobre el censo de Animales).
  if (window.EventBus && typeof EventBus.on === 'function') {
    EventBus.on('view:tabChanged', ({ tabKey } = {}) => {
      const state = _state.currentGuide;
      if (!state) return;

      // Una guía de pestaña deja de tener sentido en otra pestaña: sus targets ya no
      // existen. Se cierra sin marcarla vista, igual que Saltar. Las panorámicas
      // (tab: null) recorren pestañas por diseño y sobreviven al cambio.
      const tabGuia = state.guide?.tab;
      if (tabGuia && tabKey && tabGuia !== tabKey) {
        GuideManager.skip();
        return;
      }
      // Mismo tab o panorámica: el DOM se ha vuelto a montar, hay que reanclar.
      requestAnimationFrame(() => requestAnimationFrame(() => GuideManager.reanchor()));
    });
  }

  // Estilos dinámicos para chip (animación pulse)
  const style = document.createElement('style');
  style.textContent = `
    @keyframes guide-chip-pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(0,204,0,0.4); transform: scale(1); }
      50% { box-shadow: 0 4px 30px rgba(0,204,0,0.7); transform: scale(1.05); }
    }
    .guide-resume-chip:active { transform: scale(0.95) !important; }
  `;
  document.head.appendChild(style);

})();