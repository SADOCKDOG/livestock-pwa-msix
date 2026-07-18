# Livestock Manager — PWA / MSIX (Microsoft Store)

Proyecto **independiente** del repo `LIVESTOCK-MANAGER` (Android/Google Play). No comparte historial git, no toca `capacitor.config.ts`, `android/`, ni ningún script `build:*`/`cap:*` del proyecto original. Solo reutiliza como snapshot el HTML/CSS/JS raíz de esa app, que ya es una PWA autocontenida (manifest + service worker propios, sin dependencia real de Capacitor en el código fuente).

## Qué se copió y qué se ajustó

- `index.html`, `sw.js`, `css/`, `js/`, `icons/`, `manual/`: copia directa desde la raíz de `LIVESTOCK-MANAGER`.
- `js/mode-config.js`: versión propia y fija (`window.FREE_MODE = true;`), sin el paso de build `prebuild:free`/`prebuild:premium` del proyecto original.
- `index.html`: se quitó `<script src="capacitor.js">` (ese archivo lo inyecta Capacitor al hacer `cap sync` y no existe fuera del proyecto Android; su ausencia es inofensiva porque el propio código detecta `window.Capacitor` y cae a modo web automáticamente — ver `js/app.js` y el guard `window.isNative = !!window.Capacitor` en `index.html`).
- `manifest.webmanifest`: se corrigió el icono (el original apuntaba a `Logo aplicación.png`, que es un banner de 1272×337, no un icono cuadrado) para usar `Icono de aplicación.png` (1024×1024), y se añadieron `id`, `scope` y `lang` para cumplir mejor los requisitos de PWABuilder/Store.

## Pipeline de publicación

1. **Build local**: `npm run build` copia los archivos estáticos de la raíz a `docs/` (carpeta que sirve GitHub Pages). No requiere Node más que para lanzar el script PowerShell; no hay bundler.
2. **Push** a `main` en [SADOCKDOG/livestock-pwa-msix](https://github.com/SADOCKDOG/livestock-pwa-msix).
3. **GitHub Pages**: activar en Settings → Pages, sirviendo desde `docs/` en `main`.
4. **PWABuilder**: ir a [pwabuilder.com](https://www.pwabuilder.com) e introducir la URL pública de Pages (ej. `https://sadockdog.github.io/livestock-pwa-msix/`) — **no** la URL de `/settings/pages`, que es una página de configuración de GitHub sin contenido y hace que PWABuilder analice `github.com` por error. PWABuilder analiza el manifest/service worker y genera el paquete `.msix`.
5. **Microsoft Partner Center**: subir el `.msix` generado y completar el listing (descripción, capturas de pantalla, clasificación de contenido, precio).

## Mantener sincronizado con el proyecto original

No hay submódulos ni subtrees (para no crear una dependencia real entre repos). La sincronización es **manual y bajo demanda**:

```powershell
pwsh scripts/sync-from-source.ps1
```

Copia `css/`, `js/` (excepto `mode-config*.js`), `icons/`, `manual/`, `index.html` y `sw.js` desde `..\LIVESTOCK-MANAGER`. **Revisa siempre `git diff` antes de commitear** — y si habías reaplicado el ajuste de quitar `<script src="capacitor.js">` u otros cambios propios de este proyecto, vuelve a aplicarlos tras sincronizar.

## Pendientes conocidos

- **Compras in-app**: `js/purchase-manager.js` está pensado para Google Play Billing (vía Capacitor). En modo web puro no se ejecuta (no hay `window.Capacitor`), así que el modo Free/Premium queda fijo por `mode-config.js`. Si se quiere vender la versión Premium en Microsoft Store, hará falta integrar la Store API de Microsoft (Microsoft Store Services SDK) — no está implementado todavía.
- **Icono maskable**: los iconos actuales (`Icono de aplicación.png` / `Icono_aplicacion.png`) no tienen verificada la zona de seguridad del 20% que exige `purpose: "maskable"`; de momento se declaran solo como `purpose: "any"`. Si Windows recorta mal el icono, generar una variante con más margen.
- **Screenshots**: el manifest no incluye `screenshots` (recomendado por PWABuilder para un listing más rico en Store). Añadir cuando haya capturas de la app en modo escritorio/ancho.
