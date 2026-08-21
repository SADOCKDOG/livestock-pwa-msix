/**
 * Módulo ADSG — Livestock Manager Premium
 * Gestión de Agrupaciones de Defensa Sanitaria Ganadera
 */
window.ADSGs = (() => {
  'use strict';

  async function list(fincaId = null) {
    const fId = fincaId || await window.Fincas?.getActiveId();
    if (!fId) return [];
    const all = await window.db.getAllFromIndex('adsgs', 'fincaId', Number(fId));
    return all.filter(a => !a.anulado);
  }

  async function get(id) {
    return await window.db.get('adsgs', Number(id));
  }

  async function save(data) {
    const fId = await window.Fincas?.getActiveId();
    if (!fId) throw new Error("No hay finca activa");

    const record = {
      ...data,
      fincaId: fId,
      actualizadoEn: new Date().toISOString()
    };

    if (record.id) {
      await window.db.put('adsgs', record);
      return record.id;
    } else {
      record.creadoEn = new Date().toISOString();
      return await window.db.add('adsgs', record);
    }
  }

  async function remove(id) {
    const record = await get(id);
    if (!record) return;
    record.anulado = true;
    record.anuladoEn = new Date().toISOString();
    await window.db.put('adsgs', record);
  }

  return { list, get, save, remove };
})();
