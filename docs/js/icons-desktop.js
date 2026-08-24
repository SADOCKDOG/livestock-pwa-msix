/**
 * icons-desktop.js — Iconos propios del desktop (capa ERP).
 * icons.js se sincroniza desde el maestro (SOLO LECTURA): los iconos que el
 * desktop necesita y el maestro no tiene se añaden aquí. Las guardas de
 * existencia evitan pisar al maestro si en el futuro incorpora el mismo icono.
 *
 * Nota: `Icons` es una const global de icons.js (no cuelga de window);
 * se referencia por identificador desnudo, igual que hacen las vistas.
 */
(function () {
  if (typeof Icons === 'undefined') return;

  // Chevron ascendente (el maestro solo define chevronAbajo).
  if (!Icons.chevronArriba) {
    Icons.chevronArriba = function () {
      return this._svg('<polyline points="6 15 12 9 18 15"/>');
    };
  }

  // Indicador neutro de "columna ordenable" (doble chevron vertical).
  if (!Icons.sortNeutral) {
    Icons.sortNeutral = function () {
      return this._svg(
        '<polyline points="8 10 12 6 16 10"/>' +
        '<polyline points="8 14 12 18 16 14"/>'
      );
    };
  }
})();
