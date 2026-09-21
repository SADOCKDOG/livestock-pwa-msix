/**
 * Livestock Manager - VistaRegistros v1.0.0
 *
 * Preferencia unica de presentacion para los listados de registros: tarjetas
 * o tabla ERP. Antes cada vista llevaba su propio conmutador y su propia clave
 * en localStorage, lo que significaba 18 copias del mismo codigo y 18 barras
 * de botones robando alto de pantalla en movil.
 *
 * La preferencia se guarda por familia de ancho, no globalmente: quien elige
 * "tabla" desde el escritorio no quiere encontrarse la tabla en el movil,
 * donde no cabe comoda. Cada dispositivo recuerda lo suyo.
 */
window.VistaRegistros = {
  ANCHO_ESCRITORIO: 1024,

  esEscritorio() {
    return window.innerWidth >= this.ANCHO_ESCRITORIO;
  },

  _clave() {
    return this.esEscritorio() ? 'vista_registros_escritorio' : 'vista_registros_movil';
  },

  /** 'cards' | 'tabla'. Por defecto tarjetas en movil y tabla en escritorio. */
  get() {
    let guardado = null;
    try { guardado = localStorage.getItem(this._clave()); } catch (_) {}
    if (guardado === 'cards' || guardado === 'tabla') return guardado;
    return this.esEscritorio() ? 'tabla' : 'cards';
  },

  set(modo) {
    if (modo !== 'cards' && modo !== 'tabla') return;
    try { localStorage.setItem(this._clave(), modo); } catch (_) {}
  },
};
