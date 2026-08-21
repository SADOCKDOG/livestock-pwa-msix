(function () {
  'use strict';

  var STORAGE_KEY = 'livestock_premium_purchased';
  var PRODUCT_ID = 'premium_unlock';
  // InAppOfferToken del complemento en Partner Center. Es independiente del id
  // de Google Play: si al crear el add-on se usa otro token, hay que cambiarlo
  // aqui, porque la Digital Goods API no permite listar los ids disponibles.
  var MS_STORE_PRODUCT_ID = 'premium_unlock';
  var MS_STORE_BILLING = 'https://store.microsoft.com/billing';

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
      if (self._dgs) {
        self._comprarEnMicrosoftStore();
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
      if (self._dgs) {
        // En la Store no hay «restaurar» como tal: se vuelve a preguntar que
        // posee el usuario, que es lo que reconstruye el derecho.
        self._sincronizarConStore().then(function (ok) {
          if (ok) App.toast('Premium restaurado.', 'success');
          else App.toast('No se encontraron compras asociadas a esta cuenta.', 'info');
        });
        return;
      }
      if (!self._store) {
        App.toastError('El sistema de pago no está disponible.');
        return;
      }
      self._store.restorePurchases();
    },

    // ── Microsoft Store (PWA empaquetada en MSIX) ─────────────────────────
    // No se usa Windows.Services.Store: una PWA empaquetada no tiene acceso a
    // WinRT. El mecanismo es la Digital Goods API + Payment Request API, que
    // solo existe si la PWA se instalo DESDE la Store en Windows.
    _dgs: null,

    /** ¿Estamos dentro de la PWA instalada desde Microsoft Store? */
    _tieneMicrosoftStore: function () {
      return typeof window.getDigitalGoodsService === 'function';
    },

    /** Conecta con el servicio de facturacion de la Store. */
    _initMicrosoftStore: function () {
      var self = this;
      window.getDigitalGoodsService(MS_STORE_BILLING).then(function (dgs) {
        self._dgs = dgs;
        self._initialized = true;
        console.log('[PurchaseManager] Microsoft Store Billing conectado');
        // La Store es la fuente de verdad de lo que el usuario posee; el
        // localStorage solo sirve de cache para el primer render.
        return self._sincronizarConStore();
      }).catch(function (e) {
        // Ocurre al abrir la PWA en el navegador, fuera de la Store.
        console.warn('[PurchaseManager] Microsoft Store no disponible:', e && e.message);
        self._checkLocal();
      });
    },

    /** Pregunta a la Store que posee el usuario y ajusta el estado Premium. */
    _sincronizarConStore: function () {
      var self = this;
      if (!self._dgs) return Promise.resolve(false);
      return self._dgs.listPurchases().then(function (compras) {
        var tienePremium = (compras || []).some(function (c) {
          return c.itemId === MS_STORE_PRODUCT_ID;
        });
        if (tienePremium) {
          self._markPurchased();
        } else if (self._purchased) {
          // Estaba marcado en local pero la Store dice que no: se revoca, para
          // que un localStorage manipulado no conceda Premium.
          self._purchased = false;
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          console.log('[PurchaseManager] Premium revocado: la Store no lo reconoce');
        }
        return tienePremium;
      }).catch(function (e) {
        console.warn('[PurchaseManager] listPurchases fallo:', e && e.message);
        return false;
      });
    },

    /** Lanza el flujo de compra de la Store (Payment Request API). */
    _comprarEnMicrosoftStore: function () {
      var self = this;
      if (!self._dgs) {
        App.toastError('El sistema de pago no esta disponible.');
        return;
      }
      self._dgs.getDetails([MS_STORE_PRODUCT_ID]).then(function (items) {
        var item = (items || [])[0];
        if (!item) {
          App.toastError('Producto no disponible en la Store.');
          return;
        }
        var request = new PaymentRequest([{
          supportedMethods: MS_STORE_BILLING,
          data: { sku: item.itemId }
        }]);
        return request.show().then(function (respuesta) {
          // El token llega en details; se confirma contra listPurchases antes
          // de conceder nada, en vez de fiarse solo de la respuesta.
          return self._sincronizarConStore().then(function (ok) {
            if (respuesta && respuesta.complete) respuesta.complete(ok ? 'success' : 'fail');
            if (ok) App.toast('Premium activado. Gracias por tu compra.', 'success');
            else App.toastError('No se pudo confirmar la compra. Usa «Restaurar compras».');
          });
        });
      }).catch(function (e) {
        // Cancelar el dialogo tambien entra aqui: no es un error que reportar.
        var msg = (e && e.message) || '';
        if (/cancel/i.test(msg) || (e && e.name === 'AbortError')) return;
        console.warn('[PurchaseManager] compra fallida:', msg);
        App.toastError('No se pudo completar la compra.');
      });
    },

    init: function () {
      var self = this;

      // En la PWA de Microsoft Store manda la Digital Goods API; CdvPurchase
      // solo existe en el build nativo de Android.
      if (self._tieneMicrosoftStore()) {
        self._initMicrosoftStore();
        return;
      }

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
