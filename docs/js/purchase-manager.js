(function () {
  'use strict';

  var STORAGE_KEY = 'livestock_premium_purchased';
  var PRODUCT_ID = 'premium_unlock';
  // Licencia del modulo de soporte con IA. Es un producto DISTINTO de
  // premium_unlock: la app es gratuita, lo que se cobra es el soporte.
  var SUPPORT_PRODUCT_ID = 'support_unlock';
  // InAppOfferToken del complemento en Partner Center. Es independiente del id
  // de Google Play: si al crear el add-on se usa otro token, hay que cambiarlo
  // aqui, porque la Digital Goods API no permite listar los ids disponibles.
  var MS_STORE_PRODUCT_ID = 'premium_unlock';
  var MS_STORE_BILLING = 'https://store.microsoft.com/billing';

  // FREE_MODE === false es el build "Premium": la app va desbloqueada sin pasar
  // por la tienda. Pero el SOPORTE es un producto DISTINTO y de pago, asi que su
  // flujo de compra tiene que ser el real tambien aqui.
  // Antes esta rama devolvia stubs que solo mostraban "se compra desde la version
  // de la tienda", asi que el soporte era inaccesible justo en el unico build que
  // se publica. Ahora se conserva el desbloqueo Premium y se mantiene vivo el
  // motor de compras, registrando unicamente el producto de soporte.
  var BUILD_PREMIUM = window.FREE_MODE === false;

  // Transaction.products NO es un array de ids: es {id, offerId}[]. Buscarlo con
  // indexOf(productId) devolvia siempre -1, asi que ningun recibo se reconocia
  // nunca y la licencia comprada resultaba invisible para la app.
  function txTieneProducto(tx, productId) {
    var lista = (tx && tx.products) || [];
    for (var i = 0; i < lista.length; i++) {
      var p = lista[i];
      if (p === productId) return true;              // por si la forma cambia
      if (p && p.id === productId) return true;
    }
    return false;
  }

  function reciboTieneProducto(recibo, productId) {
    var txs = (recibo && recibo.transactions) || [];
    for (var t = 0; t < txs.length; t++) {
      if (txTieneProducto(txs[t], productId)) return true;
    }
    return false;
  }

  var PurchaseManager = {
    _initialized: false,
    // Lectura síncrona: las vistas del primer render ya conocen el estado Premium
    _purchased: (function () {
      if (BUILD_PREMIUM) return true;
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

      var catalogo = [{
        // Licencia del modulo de soporte: suscripcion, no compra unica. El
        // soporte cuesta dinero cada mes (cada ticket gasta IA), asi que el
        // ingreso tiene que ser recurrente. En el Worker, el flag equivalente
        // es SOPORTE_ES_SUSCRIPCION, que decide si se consulta el endpoint de
        // suscripciones o el de productos de Google Play.
        id: SUPPORT_PRODUCT_ID,
        type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
        platform: CdvPurchase.Platform.GOOGLE_PLAY
      }];
      // En el build Premium la app ya va desbloqueada, asi que registrar
      // premium_unlock solo generaria ruido de "producto no encontrado".
      if (!BUILD_PREMIUM) {
        catalogo.unshift({
          id: PRODUCT_ID,
          type: CdvPurchase.ProductType.NON_CONSUMABLE,
          platform: CdvPurchase.Platform.GOOGLE_PLAY
        });
      }
      store.register(catalogo);

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
          // Filtrar por producto: son dos compras distintas. Sin esto, comprar
          // la licencia de SOPORTE desbloqueaba Premium de regalo.
          if (receiptHasProduct(receipt, SUPPORT_PRODUCT_ID)) {
            receipt.finish();
            self._sincronizarSoporte();
            return;
          }
          if (!receiptHasProduct(receipt, PRODUCT_ID)) {
            receipt.finish();
            return;
          }
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
        var code = err && err.code;
        var msg = (err && err.message) || '';
        var producto = (err && err.productId) || '';
        console.error('[PurchaseManager] error:', code, producto, msg);

        // El usuario cerro el dialogo de Google: no hay nada que contarle.
        if (code === CdvPurchase.ErrorCode.PAYMENT_CANCELLED) return;

        // "Ya lo tienes": Google rechaza la compra porque la licencia sigue viva.
        // Se detecta SOLO por el texto. Antes tambien se daba por bueno el codigo
        // 6777003, que en realidad es ErrorCode.PURCHASE ("la compra fallo"): un
        // fallo cualquiera desbloqueaba Premium y anunciaba "Compra restaurada".
        //
        // El plugin entrega la constante de Billing con guiones bajos
        // (ITEM_ALREADY_OWNED), no la frase que ve el usuario en el dialogo, asi
        // que hace falta aceptar los dos separadores o no casa nunca.
        if (/already[ _]owned|ya (lo )?has comprado|ya tienes una suscripci/i.test(msg)) {
          if (producto === SUPPORT_PRODUCT_ID) {
            self._sincronizarSoporte();
          } else {
            self._markPurchased();
            App.toast('Compra Premium restaurada.', 'success');
          }
          return;
        }

        // Un fallo real en la compra del soporte tiene que verse como fallo.
        if (producto === SUPPORT_PRODUCT_ID || code === CdvPurchase.ErrorCode.PURCHASE) {
          App.toastError('No se pudo completar la compra. Intentalo de nuevo.');
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
        return reciboTieneProducto(receipt, productId);
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

    // --- Licencia de soporte -------------------------------------------
    // El estado real lo decide el backend verificando la compra contra Google
    // Play. Aqui solo se lanza el flujo de compra y se pasa el token.

    comprarSoporte: function () {
      var self = this;
      if (!self._store) {
        App.toastError('El sistema de pago no está disponible ahora mismo.');
        return Promise.resolve(false);
      }
      try {
        var producto = self._store.get(SUPPORT_PRODUCT_ID);
        if (!producto) {
          App.toastError('La licencia de soporte no está disponible todavía.');
          return Promise.resolve(false);
        }
        // order() espera una Offer, NO un Product. Pasarle el producto hacia que
        // el plugin mandase productId=null a Google ("Product not registered:
        // null", codigo 6777003), asi que la compra no llegaba a abrirse nunca.
        var oferta = producto.getOffer();
        if (!oferta) {
          App.toastError('El plan de soporte no está disponible todavía.');
          return Promise.resolve(false);
        }
        return self._store.order(oferta).then(function (err) {
          if (err) {
            console.warn('[PurchaseManager] order devolvio error:', err.code, err.message);
            return false;
          }
          return self._sincronizarSoporte();
        });
      } catch (e) {
        console.warn('[PurchaseManager] comprarSoporte fallo:', e);
        App.toastError('No se pudo iniciar la compra.');
        return Promise.resolve(false);
      }
    },

    restaurarSoporte: function () {
      return this._sincronizarSoporte();
    },

    /**
     * Revalidacion silenciosa contra Google, para cuando el backend contesta
     * que la licencia ha caducado. La suscripcion puede haberse renovado ya:
     * el token local sigue siendo el bueno y basta con volver a canjearlo.
     *
     * No muestra ningun aviso a proposito. Quien la llama decide que contar,
     * porque esto ocurre en mitad de otra operacion del usuario.
     */
    revalidarSoporte: function () {
      if (!window.SupportAPI) return Promise.resolve(false);
      var token = this._tokenDeSoporte();
      if (!token) return Promise.resolve(false);
      return window.SupportAPI.iniciarSesion(token, 'android')
        .then(function () { return true; })
        .catch(function () { return false; });
    },

    /**
     * Guarda (o borra, con cadena vacia) el correo de contacto de soporte.
     *
     * Reaprovecha la revalidacion de la compra en vez de estrenar un endpoint:
     * la sesion se reemite con el correo nuevo y de paso se comprueba que la
     * licencia sigue viva.
     */
    registrarCorreoSoporte: function (correo) {
      if (!window.SupportAPI) return Promise.reject(new Error('Soporte no disponible.'));
      var token = this._tokenDeSoporte();
      if (!token) return Promise.reject(new Error('No hay licencia de soporte activa.'));
      return window.SupportAPI.iniciarSesion(token, 'android', correo || '', true);
    },

    /**
     * Manda el token de compra al backend, que lo valida contra Google Play y
     * devuelve la sesion. Nunca se concede la licencia desde el cliente.
     */
    _sincronizarSoporte: function () {
      var self = this;
      if (!window.SupportAPI) return Promise.resolve(false);

      var token = self._tokenDeSoporte();
      if (!token) {
        App.toast('No se encontró ninguna licencia de soporte en esta cuenta.', 'info');
        return Promise.resolve(false);
      }

      return window.SupportAPI.iniciarSesion(token, 'android')
        .then(function () {
          App.toast('Soporte activado.', 'success');
          return true;
        })
        .catch(function (e) {
          App.toastError((e && e.message) || 'No se pudo activar el soporte.');
          return false;
        });
    },

    /** Busca el purchase token de support_unlock entre los recibos locales. */
    _tokenDeSoporte: function () {
      try {
        var recibos = (this._store && this._store.localReceipts) || [];
        for (var i = 0; i < recibos.length; i++) {
          var txs = recibos[i].transactions || [];
          for (var t = 0; t < txs.length; t++) {
            var tx = txs[t];
            if (!txTieneProducto(tx, SUPPORT_PRODUCT_ID)) continue;
            var token = tx.purchaseToken ||
                        (tx.nativePurchase && tx.nativePurchase.purchaseToken) ||
                        tx.transactionId || null;
            if (token) return token;
          }
        }
        console.warn('[PurchaseManager] sin token de soporte en', recibos.length, 'recibos');
      } catch (e) {
        console.warn('[PurchaseManager] no se pudo leer el recibo de soporte:', e);
      }
      return null;
    },

    _checkLocal: function () {
      // En el build Premium la app va desbloqueada por definicion: leer el
      // localStorage aqui la degradaria a Free en cuanto fallase el store.
      if (BUILD_PREMIUM) { this._initialized = true; return; }
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
