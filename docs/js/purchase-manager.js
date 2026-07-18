(function () {
  'use strict';

  var STORAGE_KEY = 'livestock_premium_purchased';
  var PRODUCT_ID = 'premium_unlock';

  if (window.FREE_MODE === false) {
    window.PurchaseManager = { isPurchased: function () { return true; }, isReady: function () { return true; }, purchase: function () {}, restorePurchases: function () {} };
    return;
  }

  var PurchaseManager = {
    _initialized: false,
    // Lectura síncrona: las vistas del primer render ya conocen el estado Premium
    _purchased: (function () {
      try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch (e) { return false; }
    })(),
    _store: null,

    isPurchased: function () {
      return this._purchased;
    },

    isReady: function () {
      return this._initialized;
    },

    purchase: function () {
      var self = this;
      if (self._purchased) {
        App.toast('Ya eres Premium. Todas las funciones están desbloqueadas.', 'success');
        return;
      }
      if (!self._store) {
        App.toastError('El sistema de pago no está disponible. Inténtalo de nuevo.');
        return;
      }
      var product = self._store.get(PRODUCT_ID);
      if (!product) {
        App.toastError('Producto no disponible. Conéctate a Internet y reinicia la app.');
        return;
      }
      var offer = product.getOffer();
      if (!offer) {
        App.toastError('Oferta no disponible para este producto.');
        return;
      }
      offer.order();
    },

    restorePurchases: function () {
      var self = this;
      if (!self._store) {
        App.toastError('El sistema de pago no está disponible.');
        return;
      }
      self._store.restorePurchases();
    },

    init: function () {
      var self = this;

      if (typeof CdvPurchase === 'undefined' || !CdvPurchase.store) {
        console.warn('[PurchaseManager] CdvPurchase no disponible');
        self._checkLocal();
        return;
      }

      var store = CdvPurchase.store;
      self._store = store;
      store.verbosus = true;

      store.register([{
        id: PRODUCT_ID,
        type: CdvPurchase.ProductType.NON_CONSUMABLE,
        platform: CdvPurchase.Platform.GOOGLE_PLAY
      }]);

      store.when()
        .productUpdated(function (product) {
          console.log('[PurchaseManager] productUpdated:', product.id, product);
        })
        .approved(function (transaction) {
          console.log('[PurchaseManager] approved:', transaction);
          transaction.verify();
        })
        .verified(function (receipt) {
          console.log('[PurchaseManager] verified:', receipt);
          self._markPurchased();
          receipt.finish();
          if (window.PremiumManager && window.PremiumManager.cleanDemoData) {
            window.PremiumManager.cleanDemoData().then(function (n) {
              if (n > 0) {
                App.toast('Datos demo eliminados. Bienvenido a Premium');
                setTimeout(function () { window.location.reload(); }, 1500);
              }
            });
          }
        })
        .finished(function (transaction) {
          console.log('[PurchaseManager] finished:', transaction);
        })
        .receiptsReady(function () {
          // v13: el callback NO recibe argumentos; los recibos se leen del store
          var receipts = (self._store && self._store.localReceipts) || [];
          console.log('[PurchaseManager] receiptsReady, recibos locales:', receipts.length);
          for (var i = 0; i < receipts.length; i++) {
            if (receiptHasProduct(receipts[i], PRODUCT_ID)) {
              self._markPurchased();
              break;
            }
          }
        });

      store.error(function (err) {
        console.error('[PurchaseManager] error:', err && err.code, err && err.message);
        // Autocuración: si Google responde "ya comprado", marcar Premium localmente
        var msg = (err && err.message) || '';
        if ((err && err.code === 6777003) || /already owned|ya has comprado/i.test(msg)) {
          self._markPurchased();
          App.toast('Compra Premium restaurada.', 'success');
        }
      });

      store.initialize([CdvPurchase.Platform.GOOGLE_PLAY])
        .then(function () {
          self._initialized = true;
          console.log('[PurchaseManager] initialized OK');
          if (!self._purchased) {
            self._checkLocal();
          }
        })
        .catch(function (err) {
          console.error('[PurchaseManager] init error:', err);
          self._checkLocal();
        });

      function receiptHasProduct(receipt, productId) {
        if (!receipt || !receipt.transactions) return false;
        for (var t = 0; t < receipt.transactions.length; t++) {
          var tx = receipt.transactions[t];
          if (tx.products && tx.products.indexOf(productId) !== -1) return true;
        }
        return false;
      }
    },

    _markPurchased: function () {
      var yaEstaba = this._purchased;
      this._purchased = true;
      this._initialized = true;
      try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (e) {}
      console.log('[PurchaseManager] Premium marcado como comprado');
      // Repintar la vista actual para que desaparezcan los banners/candados Free
      if (!yaEstaba && window.App && typeof App.route === 'function') {
        try { App.route(); } catch (e) {}
      }
    },

    _checkLocal: function () {
      try {
        this._purchased = localStorage.getItem(STORAGE_KEY) === 'true';
      } catch (e) {}
      this._initialized = true;
      console.log('[PurchaseManager] check local:', this._purchased);
    }
  };

  window.PurchaseManager = PurchaseManager;

  if (window.Capacitor && window.Capacitor.isNative) {
    document.addEventListener('deviceready', function () {
      PurchaseManager.init();
    }, false);
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        PurchaseManager.init();
      });
    } else {
      PurchaseManager.init();
    }
  }
})();
