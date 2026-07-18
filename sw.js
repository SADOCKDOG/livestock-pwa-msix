const CACHE_NAME = 'corcho-v6.31.3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/design-tokens.css',
  './css/styles.css',
  './js/app-version.js',
  './js/module-colors.js',
  './js/app.js',
  './js/db.js',
  './js/mode-config.js',
  './js/html5-qrcode.min.js',
  './js/purchase-manager.js',
  './js/premium-manager.js',
  './js/analitica.js',
  './js/animales.js',
  './js/fincas.js',
  './js/rebanos.js',
  './js/movimientos.js',
  './js/gastos.js',
  './js/notificaciones-rega.js',
  './js/pedidos-crotales.js',
  './js/produccion.js',
  './js/pesajes.js',
  './js/pesajes-ui.js',
  './js/snapshot-service.js',
  './js/wizard-manager.js',
  './js/modal-manager.js',
  './js/zonas.js',
  './js/reproduccion.js',
  './js/services/event-bus.js',
  './js/services/cache-service.js',
  './js/services/alertas-service.js',
  './js/services/export-service.js',
  './js/services/pdf-service.js',
  './js/services/document-viewer.js',
  './js/views/sanidad-view.js',
  './js/views/patrimonio-view.js',
  './js/views/ganaderia-view.js',
  './js/views/explotacion-view.js',
  './js/views/helpers/modo-contexto.js',
  './js/views/dashboard-view.js',
  './js/views/cuaderno-view.js',
  './js/views/trazabilidad-view.js',
  './js/views/informes-view.js',
  './js/views/informes-data.js',
  './js/views/informes-export.js',
  './js/views/manuales-view.js',
  './js/views/documentos-view.js',
  './js/views/albaranes-ventas-view.js',
  './js/views/comercializacion-view.js',
  './js/views/compradores-view.js',
  './js/views/contratos-view.js',
  './js/views/transportistas-view.js',
  './js/views/proveedores-view.js',
  './js/views/silos-view.js',
  './js/views/gastos-view.js',
  './js/views/fitosanitarios-view.js',
  './js/views/animales-view.js',
  './js/views/rebanos-view.js',
  './js/views/ajustes-view.js',
  './js/views/config-sistema-view.js',
  './js/views/produccion-view.js',
  './js/views/helpers/calidad-leche.js',
  './js/views/wizards/wizard-censo.js',
  './js/views/zonas-view.js',
  './js/views/wizards/wizard-traslado.js',
  './js/views/wizards/wizard-tratamiento.js',
  './js/views/wizards/wizard-finca.js',
  './js/views/wizards/wizard-crotales.js',
  './js/views/wizards/wizard-albaran-leche.js',
  './js/views/wizards/wizard-gasto.js',
  './js/views/wizards/wizard-venta-masiva.js',
  './js/views/wizards/wizard-guia-movimiento.js',
  './js/views/helpers/ayuda.js',
  './js/qa-siggan.js',
  './js/qa-premium.js',
  './js/idb-local.js',
  './manual/index.html',
  './manual/estilo-manuales.css',
  './manual/ejemplo-ovino-carne.html',
  './manual/ejemplo-ovino-leche.html',
  './manual/registros-produccion.html',
  './manual/manual-comercializacion.html',
  './manual/manual-pesadas.html',
  './manual/manual-control-lechero.html',
  './manual/manual-gastos.html',
  './manual/manual-animales-rebanos.html',
  './manual/manual-compradores.html',
  './manual/manual-contratos.html',
  './manual/manual-proveedores.html',
  './manual/manual-reproduccion.html',
  './manual/manual-sanitarios.html',
  './manual/manual-transportistas.html',
  './manual/manual-cuaderno-digital.html',
  './manual/manual-trazabilidad.html',
  './manual/manual-informes-analitica.html',
  './manual/manual-gestion-documental.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-placeholder.svg',
  './icons/logo-header.png',
  './icons/Logo aplicación.png',
  './icons/Logo%20aplicaci%C3%B3n.png',
  './icons/app-icon.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Archivo+Expanded:wght@700;900&family=IBM+Plex+Mono:wght@400;600;700&family=Inter:wght@400;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/idb@8/build/umd.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Cacheando assets iniciales');
        return Promise.allSettled(
          ASSETS.map(url => cache.add(url).catch(err => console.warn(`SW: Error cacheando ${url}`, err)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log(`SW: Borrando caché antigua: ${key}`);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          console.log('SW: Fallo de red, sirviendo desde caché o fallback.');
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match('./index.html');
          return cachedResponse;
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
