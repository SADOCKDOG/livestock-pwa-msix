/**
 * erp-data-table.js — Componente de Tabla Densa ERP (SAP Fiori / MS Dynamics)
 * Proporciona:
 *  - Cabecera con ordenación dinámicamente resaltada
 *  - Paginación "Mostrando X–Y de N"
 *  - Exportación rápida a CSV y XLSX (vía App.exportCSV / XLSX)
 *  - Filtro integrado con contador de registros activos
 */

class ErpDataTable {
  /**
   * @param {Object} config
   * @param {string} config.containerId Id del elemento donde renderizar
   * @param {Array<Object>} config.columns Configuración de columnas
   *  [{ key: 'crotal', label: 'Crotal / ID', sortable: true, align: 'left', render: fn }, ...]
   * @param {Array<Object>} config.data Filas de datos
   * @param {number} [config.pageSize=15] Tamaño de página por defecto
   * @param {string} [config.title="Listado"] Título o etiqueta del dataset
   * @param {boolean} [config.exportable=true] Habilitar botón exportar CSV/XLSX
   */
  constructor(config) {
    this.containerId = config.containerId;
    this.columns = config.columns || [];
    this.rawData = config.data || [];
    this.pageSize = config.pageSize || 15;
    this.title = config.title || 'Listado';
    this.exportable = config.exportable !== false;

    this.currentPage = 1;
    this.sortKey = null;
    this.sortAsc = true;
    this.searchTerm = '';

    this.filteredData = [...this.rawData];

    this._heredarEstado();
  }

  /**
   * Las vistas repintan la tabla creando una instancia nueva en cada refresco
   * (new window.ErpDataTable({...}).render()): al guardar un registro, al
   * teclear en el buscador propio de la vista, al cambiar de submodulo... Sin
   * esto, cada repintado devolvia la tabla a la pagina 1, sin orden y sin el
   * texto que el usuario habia escrito en el buscador de la tabla, en silencio.
   * render() ya registra la instancia en window['dt_<containerId>'], asi que
   * basta con recoger de ahi el estado de la anterior. Solo se hereda si las
   * columnas siguen siendo las mismas: si cambian, el orden y la busqueda
   * anteriores ya no son aplicables.
   */
  _heredarEstado() {
    const previa = typeof window !== 'undefined' && window['dt_' + this.containerId];
    if (!previa || previa === this || !Array.isArray(previa.columns)) return;

    const mismasColumnas = previa.columns.length === this.columns.length
      && previa.columns.every((c, i) => c && this.columns[i] && c.key === this.columns[i].key);
    if (!mismasColumnas) return;

    this.searchTerm = previa.searchTerm || '';
    this.sortKey = previa.sortKey || null;
    this.sortAsc = previa.sortAsc !== false;

    if (this.searchTerm || this.sortKey) this.applyFiltersAndSort();

    // La pagina solo se conserva si sigue existiendo tras el nuevo filtrado.
    const paginas = Math.max(1, Math.ceil(this.filteredData.length / this.pageSize));
    this.currentPage = Math.min(Math.max(1, previa.currentPage || 1), paginas);
  }

  updateData(newData) {
    this.rawData = newData || [];
    this.applyFiltersAndSort();
  }

  setSearchTerm(term) {
    this.searchTerm = (term || '').toLowerCase().trim();
    this.currentPage = 1;
    this.applyFiltersAndSort();
  }

  setSort(key) {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }
    this.applyFiltersAndSort();
  }

  applyFiltersAndSort() {
    let result = [...this.rawData];

    // Búsqueda global
    if (this.searchTerm) {
      result = result.filter(item => {
        return this.columns.some(col => {
          const val = item[col.key];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(this.searchTerm);
        });
      });
    }

    // Ordenación
    if (this.sortKey) {
      result.sort((a, b) => {
        let valA = a[this.sortKey];
        let valB = b[this.sortKey];

        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        const dateA = this._toDate(valA);
        const dateB = this._toDate(valB);
        if (dateA && dateB) {
          const tA = dateA.getTime();
          const tB = dateB.getTime();
          return this.sortAsc ? tA - tB : tB - tA;
        }

        const numA = this._toNumber(valA);
        const numB = this._toNumber(valB);
        if (numA !== null && numB !== null) {
          return this.sortAsc ? numA - numB : numB - numA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return this.sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    this.filteredData = result;
    this.render();
  }

  // Convierte un valor a número si es realmente numérico:
  // nativo, string sin unidades, o moneda/cantidad formateada con toLocaleString.
  _toNumber(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s) return null;
    // Sin ningun digito no hay nada que ordenar como numero.
    if (!/\d/.test(s)) return null;
    // Las fechas las resuelve _toDate, no este metodo.
    if (/\//.test(s)) return null;
    // Quitar primero unidades y simbolos, de mas larga a mas corta para que
    // «litros» no deje una «L» suelta. Este paso va ANTES de descartar por
    // letras: si no, «1.500 kg» o «12,5 L» nunca llegarian a parsearse.
    const sinUnidades = s
      .replace(/\s+/g, '')
      .replace(/litros|meses|días|dias|unid|kg|KG|ud|€|%|L/g, '');
    // Lo que sobreviva con letras no es un numero: texto libre, crotales (ES2100…).
    if (/[a-záéíóúñ]/i.test(sinUnidades)) return null;
    const cleaned = sinUnidades
      .replace(/\.(?=\d{3}\b|\.)/g, '')
      .replace(',', '.');
    // Exigir que TODO el resto sea el numero, no solo su prefijo.
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : null;
  }

  // Convierte un valor a Date si es una fecha reconocible (ISO, DD/MM/AAAA, DD/MM/AA).
  _toDate(v) {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  exportCSV() {
    if (!this.filteredData.length) return;
    const headers = this.columns.map(c => c.label).join(';');
    const rows = this.filteredData.map(row => {
      return this.columns.map(col => {
        let val = row[col.key];
        if (val === null || val === undefined) val = '';
        // Escapar comillas dobles y punto y coma
        const clean = String(val).replace(/"/g, '""');
        return `"${clean}"`;
      }).join(';');
    });

    // Blob y no data: URI. encodeURI no escapa la almohadilla, asi que un valor
    // con «#» (referencias tipo «Fra. #123», lotes) truncaba el fichero por ahi
    // sin avisar. El Blob ademas no tiene el limite de tamano del data: URI.
    const csvContent = '﻿' + [headers, ...rows].join('\n');
    // El CSV exporta lo que se ve (filteredData), no toda la tabla. Cuando hay
    // busqueda activa eso significa menos filas de las que existen, asi que se
    // marca en el nombre: sin el sufijo, un fichero incompleto es
    // indistinguible de uno completo al abrirlo semanas despues.
    const sufijo = this.searchTerm ? '_filtrado' : '';
    const nombre = `${this.title.toLowerCase().replace(/\s+/g, '_')}${sufijo}_${new Date().toISOString().slice(0,10)}.csv`;

    // En Android el WebView de Capacitor ignora <a download>: el fichero nunca
    // llegaba a guardarse y el boton parecia no hacer nada. ExportService ya
    // resuelve el caso nativo (Filesystem + Share) y cae al blob en navegador.
    if (window.ExportService && typeof window.ExportService.descargar === 'function') {
      window.ExportService.descargar(csvContent, nombre, 'text/csv;charset=utf-8;');
      return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', nombre);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const total = this.filteredData.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;
    this.currentPage = Math.min(this.currentPage, totalPages);

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = Math.min(startIdx + this.pageSize, total);
    const pageItems = this.filteredData.slice(startIdx, endIdx);

    let html = `
      <div class="erp-table-wrapper">
        <!-- Toolbar Superior: Búsqueda, Contador y Exportar -->
        <div class="erp-table-toolbar">
          <div class="erp-table-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="erp-search-input" placeholder="Buscar en ${this.title.toLowerCase()}..." value="${this.searchTerm}" oninput="window['dt_${this.containerId}'].setSearchTerm(this.value)">
          </div>

          <div class="erp-toolbar-right">
            <span class="erp-counter-badge">
              Mostrando <strong>${total ? startIdx + 1 : 0}–${endIdx}</strong> de <strong>${total}</strong>
            </span>
            ${this.exportable ? `
              <button class="btn-erp-secondary btn-sm erp-btn-csv" onclick="window['dt_${this.containerId}'].exportCSV()" title="Exportar vista a CSV">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                CSV
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Tabla Densa -->
        <div class="erp-table-responsive">
          <table class="erp-data-table">
            <thead>
              <tr>
                ${this.columns.map(col => {
                  const isSorted = this.sortKey === col.key;
                  const sortIcon = isSorted
                    ? (this.sortAsc ? Icons.chevronArriba() : Icons.chevronAbajo())
                    : (Icons.sortNeutral ? Icons.sortNeutral() : '');
                  const alignClass = col.align ? `text-${col.align}` : 'text-left';
                  return `
                    <th class="${alignClass} ${col.sortable !== false ? 'sortable' : ''}"
                        ${col.sortable !== false ? `onclick="window['dt_${this.containerId}'].setSort('${col.key}')"` : ''}>
                      <div class="th-content">
                        <span>${col.label}</span>
                        ${col.sortable !== false ? `<span class="sort-indicator ${isSorted ? 'active' : ''}">${sortIcon}</span>` : ''}
                      </div>
                    </th>
                  `;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${pageItems.length ? pageItems.map(row => `
                <tr>
                  ${this.columns.map(col => {
                    const alignClass = col.align ? `text-${col.align}` : 'text-left';
                    // col.cellClass permite conservar en la tabla el color que el
                    // campo tenía en la tarjeta (identificador en dorado, importes
                    // en verde, alertas en rojo…). Admite función (val, row).
                    const extraClass = typeof col.cellClass === 'function'
                      ? (col.cellClass(row[col.key], row) || '')
                      : (col.cellClass || '');
                    const rawVal = row[col.key];
                    const renderedVal = col.render ? col.render(rawVal, row) : (rawVal !== null && rawVal !== undefined ? rawVal : '—');
                    return `<td class="${(alignClass + ' ' + extraClass).trim()}">${renderedVal}</td>`;
                  }).join('')}
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="${this.columns.length}" class="text-center erp-empty-td">
                    No se encontraron registros
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- Paginación Inferior -->
        ${totalPages > 1 ? `
          <div class="erp-table-pagination">
            <button class="btn-erp-pagi" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window['dt_${this.containerId}'].goToPage(${this.currentPage - 1})">
              ‹ Anterior
            </button>
            <span class="pagi-info">Página ${this.currentPage} de ${totalPages}</span>
            <button class="btn-erp-pagi" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window['dt_${this.containerId}'].goToPage(${this.currentPage + 1})">
              Siguiente ›
            </button>
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;
    window[`dt_${this.containerId}`] = this;
    this._ocultarBuscadorDeVista(container);
  }

  /**
   * Las vistas nacieron en movil con tarjetas y su propio buscador. La tabla
   * ERP llego despues como componente autonomo, con buscador propio, y nadie
   * retiro el de la vista: en modo tabla se veian dos cajas de busqueda con
   * estados independientes, y la de la vista, ademas, repintaba la tabla desde
   * cero. Aqui se esconde la de la vista mientras la tabla esta en pantalla,
   * porque la de la tabla busca en todas las columnas y mantiene coherentes el
   * orden, la paginacion y la exportacion a CSV.
   *
   * Se oculta solo el buscador emparejado con esta tabla (el mas cercano
   * subiendo por los ancestros), no todos los de la pagina: hay vistas con
   * varias secciones y solo una de ellas lleva tabla.
   */
  _ocultarBuscadorDeVista(container) {
    let ancestro = container.parentElement;
    for (let i = 0; ancestro && i < 6; i++, ancestro = ancestro.parentElement) {
      const propio = Array.from(ancestro.querySelectorAll('input.search-input'))
        .find(el => !container.contains(el));
      if (!propio) continue;

      // Si el input va solo en su envoltorio, se oculta el envoltorio entero
      // para no dejar un hueco con los margenes del contenedor vacio.
      const padre = propio.parentElement;
      const soloEl = padre && padre !== ancestro
        && padre.children.length === 1 && !padre.textContent.trim();
      const objetivo = soloEl ? padre : propio;
      objetivo.style.display = 'none';
      objetivo.setAttribute('data-buscador-vista-oculto', 'tabla-erp');
      return;
    }
  }

  goToPage(page) {
    this.currentPage = page;
    this.render();
  }
}

window.ErpDataTable = ErpDataTable;
