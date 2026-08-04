/**
 * Livestock Manager - GuideRegistry
 * Registro declarativo de guías interactivas por (ruta, tab) con filtrado por flags.
 */
(function () {
  'use strict';

  const _registry = [];

  /**
   * Registra una guía. Se auto-invoca desde js/guides/*.js al cargar.
   * @param {Object} guide
   * @param {string} guide.id - Identificador único (p.ej. 'gegan.animales')
   * @param {'gegan'|'expro'|'comer'} guide.pillar - Pilar para color neón
   * @param {string} guide.route - Ruta hash base ('/ganaderia'|'/explotacion'|'/comercializacion')
   * @param {string|null} guide.tab - Tab del carrusel o null para panorámica de pilar
   * @param {Function} guide.applies - (flags:{leche:boolean,carne:boolean}) => boolean
   * @param {Array<Object>} guide.steps - Pasos de la guía
   */
  function register(guide) {
    if (!guide || !guide.id || !guide.route) {
      console.warn('[GuideRegistry] Guía inválida, se ignora:', guide);
      return;
    }
    // Evitar duplicados por id
    const idx = _registry.findIndex(g => g.id === guide.id);
    if (idx >= 0) {
      _registry[idx] = guide;
    } else {
      _registry.push(guide);
    }
  }

  /**
   * Busca guía por (route, tab). Devuelve la primera que coincide y pasa applies(flags).
   * @param {string} route
   * @param {string|null} tab
   * @param {Object} [flags] - {leche, carne} desde ModoContextoHelper.getFlags()
   * @returns {Object|null}
   */
  function getByRouteTab(route, tab, flags = { leche: true, carne: false }) {
    return _registry.find(g =>
      g.route === route &&
      g.tab === tab &&
      typeof g.applies === 'function' &&
      g.applies(flags)
    ) || null;
  }

  /**
   * Busca guía panorámica del pilar (tab === null) para una route.
   * @param {string} route
   * @param {Object} [flags]
   * @returns {Object|null}
   */
  function getPanoramica(route, flags = { leche: true, carne: false }) {
    return _registry.find(g =>
      g.route === route &&
      g.tab === null &&
      typeof g.applies === 'function' &&
      g.applies(flags)
    ) || null;
  }

  /**
   * Lista todas las guías registradas (para debug/QA).
   * @returns {Array<Object>}
   */
  function getAll() {
    return _registry.slice();
  }

  /**
   * Limpia el registro (útil para tests).
   */
  function clear() {
    _registry.length = 0;
  }

  // API pública
  window.GuideRegistry = {
    register,
    getByRouteTab,
    getPanoramica,
    getAll,
    clear
  };
})();