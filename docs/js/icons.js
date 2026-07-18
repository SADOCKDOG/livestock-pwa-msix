/**
 * Livestock Manager - Icon Library v1.0.0
 * Sistema centralizado de iconos SVG. Todas las vistas deben usar estos iconos.
 * Uso: Icons.home(), Icons.animales(), etc.
 */

const Icons = {
  _svg(tag, attrs) {
    attrs = attrs || {};
    // La clase base `.icon` permite dimensionar/alinear el SVG con el texto.
    const cls = ('icon ' + (attrs.class || '')).trim();
    const rest = Object.entries(attrs)
      .filter(([k]) => k !== 'class')
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${rest}>${tag}</svg>`;
  },

  // ── Navegación principal ──
  home() {
    return this._svg(
      '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
      '<polyline points="9 22 9 12 15 12 15 22"/>'
    );
  },
  animales() {
    return this._svg(
      '<circle cx="12" cy="12" r="10"/>' +
      '<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>' +
      '<path d="M2 12h20"/>'
    );
  },
  rebanos() {
    return this._svg(
      '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>' +
      '<line x1="9" y1="3" x2="9" y2="21"/>'
    );
  },
  registros() {
    return this._svg(
      '<path d="M3 3h18v18H3zM9 9h6v6H9zM3 15h6m6 0h6M15 3v6m0 6v6M3 9h6m6 0h6M9 3v6m0 6v6"/>'
    );
  },
  mas() {
    return this._svg(
      '<circle cx="12" cy="5" r="1.5" fill="currentColor"/>' +
      '<circle cx="12" cy="12" r="1.5" fill="currentColor"/>' +
      '<circle cx="12" cy="19" r="1.5" fill="currentColor"/>'
    );
  },

  // ── Bottom Sheet ──
  zonas() {
    return this._svg(
      '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>' +
      '<circle cx="12" cy="10" r="3"/>'
    );
  },
  leche() {
    return this._svg(
      '<path d="M12 2a7 7 0 0 1 7 7c0 4.97-7 13-7 13S5 13.97 5 9a7 7 0 0 1 7-7z"/>' +
      '<circle cx="12" cy="9" r="2.5"/>'
    );
  },
  comercial() {
    return this._svg(
      '<rect x="1" y="3" width="15" height="13" rx="2"/>' +
      '<path d="M16 8h4l3 5v3h-7V8z"/>' +
      '<circle cx="5.5" cy="18.5" r="2.5"/>' +
      '<circle cx="18.5" cy="18.5" r="2.5"/>'
    );
  },
  compradores() {
    return this._svg(
      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="9" cy="7" r="4"/>' +
      '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
    );
  },
  proveedores() {
    return this._svg(
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
      '<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>' +
      '<line x1="12" y1="22.08" x2="12" y2="12"/>'
    );
  },
  transportistas() {
    return this._svg(
      '<rect x="1" y="3" width="15" height="13" rx="2"/>' +
      '<path d="M16 8h3l3 5v3h-6V8z"/>' +
      '<circle cx="5.5" cy="18.5" r="2.5"/>' +
      '<circle cx="16.5" cy="18.5" r="2.5"/>'
    );
  },
  gastos() {
    return this._svg(
      '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>' +
      '<line x1="1" y1="10" x2="23" y2="10"/>'
    );
  },
  informes() {
    return this._svg(
      '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>' +
      '<path d="M22 12A10 10 0 0 0 12 2v10z"/>'
    );
  },
  libroVentas() {
    return this._svg(
      '<rect x="2" y="3" width="20" height="18" rx="2" ry="2"/>' +
      '<line x1="8" y1="9" x2="16" y2="9"/>' +
      '<line x1="8" y1="13" x2="12" y2="13"/>'
    );
  },
  informeRega() {
    return this._svg(
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
      '<polyline points="14 2 14 8 20 8"/>' +
      '<line x1="16" y1="13" x2="8" y2="13"/>' +
      '<line x1="16" y1="17" x2="8" y2="17"/>'
    );
  },
  exportacion() {
    return this._svg(
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="7 10 12 15 17 10"/>' +
      '<line x1="12" y1="15" x2="12" y2="3"/>'
    );
  },
  cuaderno() {
    return this._svg(
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
      '<polyline points="14 2 14 8 20 8"/>'
    );
  },
  trazabilidad() {
    return this._svg(
      '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'
    );
  },
  contratos() {
    return this._svg(
      '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>' +
      '<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>'
    );
  },
  ajustes() {
    return this._svg(
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
    );
  },

  // ── Acciones ──
  agregar() {
    return this._svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>');
  },
  fabPlus() {
    return this._svg('<path d="M12 4v16m8-8H4" />', { 'stroke-width': '3.8' });
  },
  editar() {
    return this._svg(
      '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>' +
      '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'
    );
  },
  eliminar() {
    return this._svg(
      '<polyline points="3 6 5 6 21 6"/>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
    );
  },
  exportar() {
    return this._svg(
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="7 10 12 15 17 10"/>' +
      '<line x1="12" y1="15" x2="12" y2="3"/>'
    );
  },
  buscar() {
    return this._svg(
      '<circle cx="11" cy="11" r="8"/>' +
      '<line x1="21" y1="21" x2="16.65" y2="16.65"/>'
    );
  },
  cerrar() {
    return this._svg(
      '<line x1="18" y1="6" x2="6" y2="18"/>' +
      '<line x1="6" y1="6" x2="18" y2="18"/>'
    );
  },
  atras() {
    return this._svg(
      '<polyline points="15 18 9 12 15 6"/>'
    );
  },
  siguiente() {
    return this._svg(
      '<polyline points="9 18 15 12 9 6"/>'
    );
  },
  flechaDerecha() {
    return this._svg(
      '<polyline points="9 18 15 12 9 6"/>'
    );
  },
  chevronAbajo() {
    return this._svg('<polyline points="6 9 12 15 18 9"/>');
  },
  check() {
    return this._svg('<polyline points="20 6 9 17 4 12"/>');
  },
  calculo() {
    return this.grafico();
  },
  xmark() {
    return this.cerrar();
  },
  calculo() {
    return this.grafico();
  },
  xmark() {
    return this.cerrar();
  },

  // ── Estados / Decorativos ──
  alerta() {
    return this._svg(
      '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
      '<line x1="12" y1="9" x2="12" y2="13"/>' +
      '<line x1="12" y1="17" x2="12.01" y2="17"/>'
    );
  },
  calendar() {
    return this._svg(
      '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>' +
      '<line x1="16" y1="2" x2="16" y2="6"/>' +
      '<line x1="8" y1="2" x2="8" y2="6"/>' +
      '<line x1="3" y1="10" x2="21" y2="10"/>'
    );
  },
  documento() {
    return this._svg(
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
      '<polyline points="14 2 14 8 20 8"/>' +
      '<line x1="16" y1="13" x2="8" y2="13"/>' +
      '<line x1="16" y1="17" x2="8" y2="17"/>'
    );
  },
  imprimir() {
    return this._svg(
      '<polyline points="6 9 6 2 18 2 18 9"/>' +
      '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>' +
      '<rect x="6" y="14" width="12" height="8"/>'
    );
  },
  adjuntar() {
    return this._svg(
      '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'
    );
  },
  foto() {
    return this._svg(
      '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>' +
      '<circle cx="8.5" cy="8.5" r="1.5"/>' +
      '<polyline points="21 15 16 10 5 21"/>'
    );
  },
  veterinario() {
    return this._svg(
      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="9" cy="7" r="4"/>' +
      '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
    );
  },
  peso() {
    return this._svg(
      '<rect x="5" y="3" width="14" height="18" rx="2"/>' +
      '<line x1="9" y1="3" x2="9" y2="21"/>' +
      '<line x1="15" y1="3" x2="15" y2="21"/>'
    );
  },
  dashboard() {
    return this._svg(
      '<rect x="3" y="3" width="7" height="7"/>' +
      '<rect x="14" y="3" width="7" height="7"/>' +
      '<rect x="14" y="14" width="7" height="7"/>' +
      '<rect x="3" y="14" width="7" height="7"/>'
    );
  },
  finca() {
    return this._svg(
      '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
      '<polyline points="9 22 9 12 15 12 15 22"/>'
    );
  },
  explotacion() {
    return this.finca();
  },
  carne() {
    return this._svg(
      '<path d="M12 2a10 10 0 1 0 10 10H12V2z"/>' +
      '<circle cx="12" cy="12" r="3"/>'
    );
  },
  termometro() {
    return this._svg(
      '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 2.5 0 1 0 5 0z"/>'
    );
  },

  // ── Dominios / Informes (sustituyen emojis funcionales) ──
  dinero() {
    return this._svg(
      '<line x1="12" y1="1" x2="12" y2="23"/>' +
      '<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
    );
  },
  reproduccion() {
    return this._svg(
      '<circle cx="12" cy="9" r="5"/>' +
      '<line x1="12" y1="14" x2="12" y2="22"/>' +
      '<line x1="9" y1="19" x2="15" y2="19"/>'
    );
  },
  sanidad() {
    return this._svg(
      '<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/>'
    );
  },
  fitosanitario() {
    return this._svg(
      '<path d="M9 2h6"/>' +
      '<path d="M10 2v6.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9.5V2"/>' +
      '<line x1="7" y1="14" x2="17" y2="14"/>'
    );
  },
  grafico() {
    return this._svg(
      '<line x1="18" y1="20" x2="18" y2="10"/>' +
      '<line x1="12" y1="20" x2="12" y2="4"/>' +
      '<line x1="6" y1="20" x2="6" y2="14"/>'
    );
  },
  tendencia() {
    return this._svg(
      '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>' +
      '<polyline points="17 6 23 6 23 12"/>'
    );
  },
  balanza() {
    return this._svg(
      '<line x1="12" y1="3" x2="12" y2="21"/>' +
      '<path d="M5 7h14"/>' +
      '<path d="M5 7l-3 6a3 3 0 0 0 6 0z"/>' +
      '<path d="M19 7l-3 6a3 3 0 0 0 6 0z"/>'
    );
  },
  pac() {
    return this._svg(
      '<path d="M12 22V8"/>' +
      '<path d="M12 8c0-3 2-5 5-5 0 3-2 5-5 5z"/>' +
      '<path d="M12 11c0-3-2-5-5-5 0 3 2 5 5 5z"/>'
    );
  },
  rotacion() {
    return this._svg(
      '<polyline points="23 4 23 10 17 10"/>' +
      '<polyline points="1 20 1 14 7 14"/>' +
      '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'
    );
  },
  hibrido() {
    return this.rotacion();
  },
  edificio() {
    return this._svg(
      '<rect x="4" y="2" width="16" height="20" rx="2"/>' +
      '<line x1="9" y1="6" x2="9" y2="6"/>' +
      '<line x1="15" y1="6" x2="15" y2="6"/>' +
      '<line x1="9" y1="10" x2="9" y2="10"/>' +
      '<line x1="15" y1="10" x2="15" y2="10"/>' +
      '<path d="M9 22v-4h6v4"/>'
    );
  },
  paquete() {
    return this._svg(
      '<path d="M16.5 9.4 7.5 4.21"/>' +
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
      '<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>' +
      '<line x1="12" y1="22.08" x2="12" y2="12"/>'
    );
  },
  rayo() {
    return this._svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>');
  },
  guardar() {
    return this._svg(
      '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>' +
      '<polyline points="17 21 17 13 7 13 7 21"/>' +
      '<polyline points="7 3 7 8 15 8"/>'
    );
  },
  globo() {
    return this._svg(
      '<circle cx="12" cy="12" r="10"/>' +
      '<line x1="2" y1="12" x2="22" y2="12"/>' +
      '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'
    );
  },
  objetivo() {
    return this._svg(
      '<circle cx="12" cy="12" r="10"/>' +
      '<circle cx="12" cy="12" r="6"/>' +
      '<circle cx="12" cy="12" r="2"/>'
    );
  },
  campana() {
    return this._svg(
      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>' +
      '<path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
    );
  },
  libro() {
    return this._svg(
      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>' +
      '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'
    );
  },
  info() {
    return this._svg(
      '<circle cx="12" cy="12" r="10"/>' +
      '<line x1="12" y1="16" x2="12" y2="12"/>' +
      '<line x1="12" y1="8" x2="12.01" y2="8"/>'
    );
  },
  importar() {
    return this._svg(
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="17 8 12 3 7 8"/>' +
      '<line x1="12" y1="3" x2="12" y2="15"/>'
    );
  },
   corona() {
     return this._svg(
       '<path d="M12 2l2.4 4.8 5.3.7-3.9 3.8.9 5.4L12 14.5 7.3 16.7l.9-5.4L4.3 7.5l5.3-.7z"/>'
     );
   },
   estrella() {
     return this._svg(
       '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
     );
   },
   /* Desbloqueado / Premium */
   premium() {
     return this._svg(
       '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
       '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
       '<circle cx="12" cy="16" r="1" fill="currentColor"/>'
     );
   },
   enlace() {
    return this._svg(
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
      '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
    );
  },

  // ── Sexo ──
  hembra() {
    return this._svg(
      '<circle cx="12" cy="8" r="5.5"/>' +
      '<line x1="12" y1="13.5" x2="12" y2="22"/>' +
      '<line x1="8" y1="18" x2="16" y2="18"/>'
    );
  },
  macho() {
    return this._svg(
      '<circle cx="11" cy="13" r="5.5"/>' +
      '<polyline points="15 3 21 3 21 9"/>' +
      '<line x1="21" y1="3" x2="15.5" y2="8.5"/>'
    );
  },
  neutro() {
    return this._svg(
      '<line x1="10" y1="12" x2="14" y2="12"/>' +
      '<line x1="12" y1="10" x2="12" y2="14"/>'
    );
  },

  historial() {
    return this._svg(
      '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>' +
      '<polyline points="3 3 3 8 8 8"/>' +
      '<line x1="12" y1="7" x2="12" y2="12"/>' +
      '<polyline points="12 12 16 14"/>'
    );
  },

  wizards() {
    return this._svg(
      '<path d="m15 4-2 2L15 8l2-2L15 4z"/>' +
      '<path d="m11.5 7.5-9 9a2.12 2.12 0 0 0 3 3l9-9-3-3z"/>' +
      '<path d="M18 10h1M21 14h1M14 18h1"/>' +
      '<path d="M19 6V5M17 14v-1M20 19v-1"/>'
    );
  },

  statusCritico() {
    return this._svg('<circle cx="12" cy="12" r="6" fill="#ef4444" stroke="none"/>');
  },
  statusAdvertencia() {
    return this._svg('<circle cx="12" cy="12" r="6" fill="#f59e0b" stroke="none"/>');
  },
  statusOk() {
    return this._svg('<circle cx="12" cy="12" r="6" fill="#10b981" stroke="none"/>');
  },
  statusInactivo() {
    return this._svg('<circle cx="12" cy="12" r="6" fill="#6b7280" stroke="none"/>');
  },

  // Iconos adicionales para bottom sheets y navegación unificada
  silos() {
    return this._svg(
      '<ellipse cx="12" cy="5" rx="9" ry="3"/>' +
      '<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>' +
      '<path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>'
    );
  },
  pesadas() {
    return this._svg(
      '<line x1="12" y1="3" x2="12" y2="21"/>' +
      '<path d="M5 7h14"/>' +
      '<path d="M5 7l-3 6a3 3 0 0 0 6 0z"/>' +
      '<path d="M19 7l-3 6a3 3 0 0 0 6 0z"/>'
    );
  },
  fitosanitario() {
    return this._svg(
      '<path d="M9 2h6"/>' +
      '<path d="M10 2v6.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9.5V2"/>' +
      '<line x1="7" y1="14" x2="17" y2="14"/>'
    );
  }
};

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Icons;
}
