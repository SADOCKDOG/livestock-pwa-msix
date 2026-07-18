/**
 * Helper transversal para el modo de explotación (Leche / Carne).
 * Dos flags independientes y persistentes: el usuario puede activar uno o ambos.
 * No existe un tercer estado "híbrido": tener ambos flags activos ES el caso mixto.
 */
const ModoContextoHelper = {
  FLAGS_KEY: 'lm.explotacion.flags',
  LEGACY_MODE_KEY: 'lm.explotacion.modo_global',
  ACTIVE_FINCA_KEY: 'activeFincaIdLivestock',
  VALID_LEGACY_MODES: new Set(['carne', 'leche', 'hibrido']),

  /**
   * Id de la finca activa, leído de forma síncrona (misma clave que Fincas.getActiveId
   * usa como caché rápida). Puede ser null si aún no hay finca activa.
   */
  _activeFincaId() {
    try {
      const id = localStorage.getItem(this.ACTIVE_FINCA_KEY);
      return id || null;
    } catch (_) {
      return null;
    }
  },

  _scopedKey(fincaId) {
    return `${this.FLAGS_KEY}.${fincaId}`;
  },

  getModeMeta(mode) {
    const map = {
      carne: { icon: Icons.carne(), label: 'Cárnico', color: 'var(--c-success)' },
      leche: { icon: Icons.leche(), label: 'Lácteo', color: 'var(--c-info)' }
    };
    return map[mode] || map.leche;
  },

  detectFlagsFromRebanos(rebanos) {
    let tieneCarne = false;
    let tieneLeche = false;

    (rebanos || []).forEach(r => {
      const tipo = (r.tipo || '').toLowerCase();
      if (tipo.includes('carne') || tipo.includes('cárn')) tieneCarne = true;
      if (tipo.includes('leche') || tipo.includes('láct')) tieneLeche = true;
      if (tipo.includes('mixt') || tipo.includes('híbr') || tipo.includes('doble')) { tieneCarne = true; tieneLeche = true; }
    });

    if (!tieneCarne && !tieneLeche) return { leche: true, carne: false };
    return { leche: tieneLeche, carne: tieneCarne };
  },

  _matchTipoByMode(tipo, flags) {
    const t = (tipo || '').toLowerCase();
    const esCarne = t.includes('carne') || t.includes('cárn');
    const esLeche = t.includes('leche') || t.includes('láct');
    const esHibrido = t.includes('mixt') || t.includes('híbr') || t.includes('doble');

    if (esHibrido) return flags.leche || flags.carne;
    if (esCarne && esLeche) return flags.leche || flags.carne;
    if (esCarne) return !!flags.carne;
    if (esLeche) return !!flags.leche;
    // Tipos no clasificables (p.ej. "Ibérico" o tipos personalizados): siempre visibles
    // para no ocultar datos que no encajan en la taxonomía leche/carne.
    return true;
  },

  filterRebanosByMode(rebanos, flags) {
    return (rebanos || []).filter(r => this._matchTipoByMode(r.tipo, flags));
  },

  /**
   * Lee los flags persistidos para una finca, migrando desde claves antiguas si hace falta.
   * Los flags son por finca: cada finca puede tener su propia combinación Leche/Carne.
   * @param {number|string} [fincaId] - Si se omite, se usa la finca activa (lectura síncrona de localStorage).
   */
  getFlags(fincaId) {
    const fid = fincaId !== undefined && fincaId !== null ? fincaId : this._activeFincaId();

    // Sin finca resuelta: no hay ámbito al que asociar la preferencia todavía.
    if (fid === null) return null;

    const scopedKey = this._scopedKey(fid);
    try {
      const saved = localStorage.getItem(scopedKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.leche || parsed.carne)) {
          return { leche: !!parsed.leche, carne: !!parsed.carne };
        }
      }
    } catch (_) {}

    // Migración: semilla desde la antigua clave global (una sola preferencia para toda la app).
    // Se copia a la finca (no se borra la global) para que otras fincas sin preferencia propia
    // también puedan heredarla la primera vez que se consulten.
    try {
      const savedGlobal = localStorage.getItem(this.FLAGS_KEY);
      if (savedGlobal) {
        const parsed = JSON.parse(savedGlobal);
        if (parsed && (parsed.leche || parsed.carne)) {
          const flags = { leche: !!parsed.leche, carne: !!parsed.carne };
          this.setFlags(flags, fid);
          return flags;
        }
      }
    } catch (_) {}

    // Migración desde el modo único antiguo (leche/carne/hibrido)
    try {
      const legacy = localStorage.getItem(this.LEGACY_MODE_KEY);
      if (legacy && this.VALID_LEGACY_MODES.has(legacy)) {
        const flags = legacy === 'hibrido' ? { leche: true, carne: true }
          : legacy === 'carne' ? { leche: false, carne: true }
          : { leche: true, carne: false };
        this.setFlags(flags, fid);
        return flags;
      }
    } catch (_) {}

    return null; // null indica que no hay preferencia establecida todavía para esta finca
  },

  /**
   * Guarda los flags de una finca. Si ambos vienen desactivados, no hace nada (se exige al menos uno activo).
   * @param {{leche:boolean, carne:boolean}} flags
   * @param {number|string} [fincaId] - Si se omite, se usa la finca activa.
   */
  setFlags(flags, fincaId) {
    const leche = !!flags.leche;
    const carne = !!flags.carne;
    if (!leche && !carne) return false;

    const fid = fincaId !== undefined && fincaId !== null ? fincaId : this._activeFincaId();
    if (fid === null) return false;

    try {
      localStorage.setItem(this._scopedKey(fid), JSON.stringify({ leche, carne }));
    } catch (_) {}
    return true;
  },

  /**
   * Flags efectivos de una finca: preferencia guardada, o detección automática
   * a partir de sus rebaños (y persistencia) la primera vez.
   */
  async getEffectiveFlags(fincaId) {
    const fid = fincaId !== undefined && fincaId !== null ? fincaId : this._activeFincaId();
    const saved = this.getFlags(fid);
    if (saved) return saved;

    try {
      if (fid !== null) {
        const rebanos = await window.db.getAllFromIndex('rebanos', 'fincaId', fid).catch(() => []);
        const detected = this.detectFlagsFromRebanos(rebanos);
        this.setFlags(detected, fid);
        return detected;
      }
    } catch (_) {}

    return { leche: true, carne: false };
  },

  isLecheActivo(fincaId) {
    const flags = this.getFlags(fincaId);
    return flags ? flags.leche : true;
  },

  isCarneActivo(fincaId) {
    const flags = this.getFlags(fincaId);
    return flags ? !!flags.carne : false;
  },

  /**
   * Banner informativo de registros ocultos por el filtro de tipo de explotación.
   * Devuelve '' si no hay ninguno oculto.
   */
  bannerOcultosPorModo(cantidadOculta, etiquetaSingular, etiquetaPlural) {
    if (!cantidadOculta || cantidadOculta <= 0) return '';
    const etiqueta = cantidadOculta === 1
      ? `${etiquetaSingular} oculto`
      : `${etiquetaPlural} ocultos`;
    return `
      <div class="card p-10 mb-12 border-222" style="background: rgba(255, 214, 0, 0.03); border-left: 3px solid var(--c-warning);">
        <div class="flex items-center justify-between gap-8">
          <span class="text-[0.62rem] text-aaa font-800 uppercase tracking-wide flex items-center gap-6">
            ${Icons.alerta()} ${cantidadOculta} ${etiqueta} por el tipo de explotación configurado
          </span>
          <a href="#/ajustes" class="text-[0.6rem] font-900 uppercase no-underline" style="color: var(--c-warning); white-space: nowrap;">Ajustes -></a>
        </div>
      </div>`;
  },

  getEspecieColor(especie) {
    if (!especie) return '#6b7280'; // Gray
    const e = especie.toLowerCase();
    if (e.includes('vaca') || e.includes('bovin')) return 'var(--c-danger)'; // Red
    if (e.includes('oveja') || e.includes('ovin')) return 'var(--c-info)'; // Blue
    if (e.includes('cabra') || e.includes('caprin')) return '#4FADF5'; // Purple
    if (e.includes('cerdo') || e.includes('porcin')) return 'var(--c-success)'; // Green
    if (e.includes('equin') || e.includes('caball')) return 'var(--c-orange)';
    if (e.includes('avicol') || e.includes('ave')) return 'var(--c-warning)'; // Amber
    return '#6b7280'; // Default
  }
};

window.ModoContextoHelper = ModoContextoHelper;
