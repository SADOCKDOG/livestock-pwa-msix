(function () {
  'use strict';

  var isFree = function () {
    if (window.FREE_MODE === false) return false;
    if (window.PurchaseManager && window.PurchaseManager.isPurchased()) return false;
    return true;
  };

  var isDemo = function (record) {
    return record && record.demo === true;
  };

  var canModify = function (record) {
    return !isFree() || !isDemo(record);
  };

  var canDelete = function (record) {
    return !isFree() || !isDemo(record);
  };

  var canExport = function () {
    return !isFree();
  };

  var canImportBackup = function () {
    return !isFree();
  };

  var canSeedData = function () {
    return !isFree();
  };

  var maxAnimals = function () {
    return isFree() ? 15 : Infinity;
  };

  var maxGastos = function () {
    return isFree() ? 30 : Infinity;
  };

  var cleanDemoData = function () {
    return new Promise(function (resolve) {
      if (!window.db) { resolve(0); return; }
      try {
        var storeNames = Array.from(window.db.objectStoreNames);
        var totalEliminados = 0;
        var completed = 0;

        if (storeNames.length === 0) { resolve(0); return; }

        storeNames.forEach(function (storeName) {
          var tx = window.db.transaction(storeName, 'readwrite');
          var store = tx.objectStore(storeName);
          var req = store.openCursor();
          var idsAEliminar = [];

          req.onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor) {
              if (cursor.value && cursor.value.demo === true) {
                idsAEliminar.push(cursor.primaryKey);
              }
              cursor.continue();
            } else {
              idsAEliminar.forEach(function (id) { store.delete(id); });
              totalEliminados += idsAEliminar.length;
              completed++;
              if (completed === storeNames.length) {
                console.log('[Premium] Demo limpio: ' + totalEliminados + ' registros');
                resolve(totalEliminados);
              }
            }
          };

          req.onerror = function () {
            completed++;
            if (completed === storeNames.length) resolve(totalEliminados);
          };
        });
      } catch (e) {
        console.error('[Premium] Error limpiando demo:', e);
        resolve(0);
      }
    });
  };

  var PremiumManager = {
    isFree: isFree,
    isDemo: isDemo,
    canModify: canModify,
    canDelete: canDelete,
    canExport: canExport,
    canImportBackup: canImportBackup,
    canSeedData: canSeedData,
    maxAnimals: maxAnimals,
    maxGastos: maxGastos,
    cleanDemoData: cleanDemoData
  };

  window.PremiumManager = PremiumManager;
})();
