/**
 * module-colors.js — MAPA ÚNICO de colores de módulo (estándar Cork Manager).
 * Normativa: .agent/AGENTS.md §1 · Tokens CSS equivalentes: css/design-tokens.css.
 * PROHIBIDO duplicar mapas de color en menús/vistas: consumir siempre este objeto.
 */
window.MODULE_COLORS = Object.freeze({
  // Success / Zonas / Carne / Ventas
  '/': '#CCFF00',
  '/explotacion': '#CCFF00',
  '/zonas': '#CCFF00',
  '/instalaciones': '#CCFF00',
  '/instalacion': '#CCFF00',
  '/saneamientos': '#CCFF00',
  '/saneamiento': '#CCFF00',
  '/subexplotaciones': '#CCFF00',
  '/subexplotacion': '#CCFF00',
  '/botiquin': '#CCFF00',
  '/botiquin-producto': '#CCFF00',
  '/animal-bitacora': '#F97316',
  '/carne': '#CCFF00',
  '/comercializacion': '#3B82F6',
  '/trazabilidad': '#3B82F6',
  // Danger / Gastos
  '/ganaderia': '#FF4444',
  '/gastos': '#FF4444',
  // Info / Leche / Listas
  '/leche': '#3B82F6',
  '/rebanos': '#3B82F6',
  '/compradores': '#3B82F6',
  // Warning / Informes / Alertas
  '/informes': '#FFD600',
  '/alertas': '#FFD600',
  // Naranja de módulo: Animales / Cuaderno
  '/animales': '#F97316',
  '/cuaderno': '#F97316',
  // Violeta de módulo: Proveedores / Manuales / Documentos-Trámites
  '/proveedores': '#A855F7',
  '/manuales': '#A855F7',
  '/documentos': '#A855F7',
  // Rosa de módulo: Logística
  '/transportistas': '#EC4899',
  // Neutro
  '/ajustes': '#B1B1B1',
  '/importar-rfid': '#B1B1B1',
  // Alias de rutas de detalle (heredan el color de su módulo)
  '/animal': '#F97316',
  '/rebano': '#3B82F6',
  '/zona': '#CCFF00',
  '/comprador': '#3B82F6',
  '/proveedor': '#A855F7',
  '/gasto': '#FF4444',
  '/venta-carne': '#CCFF00',
  '/albaran-leche': '#3B82F6',
  '/contrato': '#3B82F6'
});

/** Color de un módulo por ruta (fallback: lima corporativo). */
window.getModuleColor = function (path) {
  return window.MODULE_COLORS[path] || '#C5FA50';
};
