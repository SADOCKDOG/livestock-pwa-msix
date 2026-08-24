# Livestock Manager — PWA / MSIX (Microsoft Store)

Proyecto **independiente** del repo `LIVESTOCK-MANAGER` (Android/Google Play). No comparte historial git, no toca `capacitor.config.ts`, `android/`, ni ningún script `build:*`/`cap:*` del proyecto original. Solo reutiliza como snapshot el HTML/CSS/JS raíz de esa app, que ya es una PWA autocontenida (manifest + service worker propios, sin dependencia real de Capacitor en el código fuente).

## Qué se copió y qué se ajustó

- `index.html`, `sw.js`, `css/`, `js/`, `icons/`, `manual/`: copia directa desde la raíz de `LIVESTOCK-MANAGER`.
- `js/mode-config.js`: versión propia y fija — **`window.FREE_MODE = false;`** (Soporte desbloqueado gratis en esta plataforma, ver "Modelo Free/Soporte en Microsoft Store" más abajo), sin el paso de build `prebuild:free`/`prebuild:premium` del proyecto original.
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

## Modelo Free/Soporte en Microsoft Store

Se investigó implementar compras Soporte reales vía `Windows.Services.Store` (WinRT). Conclusión: **no es viable con el modelo de paquete que genera PWABuilder** ("hosted app" sobre el runtime de Microsoft Edge WebView2, identificable por `uap10:HostRuntimeDependency` en el `AppxManifest.xml` — el mismo motivo por el que el paquete requiere la capacidad restringida `runFullTrust`).

Evidencia:
- La única vía documentada por Microsoft para exponer WinRT a JS en WebView2 (`AddHostObjectToScript`) exige escribir una aplicación nativa host propia (C#/C++) — no algo activable solo con el manifest de un paquete PWABuilder genérico.
- El [issue de PWABuilder #2478](https://github.com/pwa-builder/PWABuilder/issues/2478), que pide exactamente esta funcionalidad, sigue etiquetado `blocked` + `external-dependency`. PWABuilder ha declarado públicamente que están trabajando con el equipo de Edge en implementar la *Digital Goods API* para esto, pero no existe todavía.

**Decisión tomada**: en lugar de construir infraestructura de servidor nueva (verificación de compras vía API de Microsoft Store + backend) solo para esta plataforma, se optó por **desbloquear Soporte gratis** en la versión de Microsoft Store (`window.FREE_MODE = false`). Todo el que instale la app desde la Store tiene acceso completo sin coste, sin flujo de compra. `js/purchase-manager.js` sigue presente en el repo tal cual (copiado del proyecto Android) pero es inerte en este contexto — no se ejecuta ninguna lógica de Google Play Billing.

Si en el futuro Microsoft/PWABuilder habilitan la Digital Goods API para PWAs empaquetadas, se podría revisar esta decisión y monetizar también en este canal.

## Piel ERP (sidebar + tablas de escritorio)

Desde PR #38 (`d436ce3`, ago 2026), la adaptación a escritorio de `AUDITORIA-DESKTOP-UI-UX.md`
(sidebar propia `#desktopSidebar`, bottom-nav oculto en `>=1024px`) quedó **superada** por
la "piel ERP": un sidebar de navegación (`#erpSidebar`, 240px) y tablas de datos
(`erp-data-table.js`) que se originan en `LIVESTOCK-MANAGER` (rama `desktop-mvp`) y se
sincronizan aquí vía `scripts/sync-from-source.ps1`. Ficheros clave: `js/erp-shell.js`,
`js/erp-data-table.js`, `css/erp-tokens.css`, `css/erp-sidebar.css`, `css/erp-data-table.css`.
Se activan solo en `min-width: 1024px` (`matchMedia` en `erp-shell.js`, evaluado una vez en
`DOMContentLoaded` — un resize de ventana sin recargar no los activa/desactiva).

**`css/erp-overrides.css` es el fichero de ajuste específico de esta PWA** (no viene del
sincronizado): neutraliza conflictos entre la piel ERP y `css/desktop.css`, que es un fichero
**heredado, exclusivo de este repo** (no existe en `LIVESTOCK-MANAGER` ni en `livestock-desktop`)
escrito antes de que existiera la piel ERP. Se carga después de `styles.css` en el `<head>`, así
que gana por cascada/especificidad salvo que se le contrarreste explícitamente. Bugs ya resueltos
por este choque (PRs #39–#42 en `main`):

- `#desktopSidebar` (z-index alto) tapaba al nuevo `#erpSidebar` → oculto con `display:none !important`.
- `_setGroupCollapsed` no existía en `erp-shell.js` (bug también presente en el maestro, corregido ahí también).
- `.card-registro-quick.col-span-4 { grid-column: span 4 !important }` (2 clases) ganaba al override
  de la piel (1 clase) → tarjetas de "Registro rápido" apiladas en vez de 5-6 por fila.
- `main#app-content { padding: 20px 48px 40px }` en `desktop.css` ganaba por orden de carga →
  margen lateral de más, robando espacio a la última tarjeta de cada fila.
- Convención de tema invertida: `design-tokens.css` es oscuro por defecto (claro con
  `body[data-modo="claro"]`); `desktop.css` en `>=1024px` asume lo contrario (claro por defecto,
  oscuro con `body[data-modo="oscuro"]`). `js/app.js` nunca marcaba ese segundo atributo, así que
  el modo oscuro OLED (activado por defecto) no se veía en escritorio pese al checkbox marcado.

**Ante cualquier bug visual nuevo que solo aparezca en esta PWA** (y no en `LIVESTOCK-MANAGER` ni
en `livestock-desktop`), sospechar primero de `css/desktop.css` antes de tocar la piel ERP o los
tokens de color.

**Importante — recordar en cada `sync-from-source.ps1`**: el módulo de Soporte (chat con IA)
sigue parado a propósito en `feature/soporte-ia` del maestro hasta cerrar decisiones pendientes
(add-on en tiendas, precio, pago web, URL del Worker). Si el sync trae `js/views/soporte-view.js`
o `js/views/mis-incidencias-view.js`, son ficheros muertos que dependen de un `window.SupportAPI`
inexistente aquí — descartarlos del commit (ver `4e1da54`).

## Resuelto

- **Auditoría de rediseño para escritorio** (`AUDITORIA-DESKTOP-UI-UX.md`, jul 2026): sus 4 puntos
  se implementaron primero con sidebar/bottom-nav propios, pero ese enfoque fue reemplazado por la
  piel ERP unificada (ver sección de arriba) — el documento queda como registro histórico, no como
  estado actual.
- **Piel ERP**: sidebar y tablas de escritorio migradas desde el maestro y con paridad visual
  verificada frente a `livestock-desktop` (PRs #38–#42, ago 2026).
- **Compra de Premium en Microsoft Store**: `js/purchase-manager.js` soporta la *Digital Goods API*
  (`getDigitalGoodsService`, add-on `premium_unlock` de Partner Center) — commit `e6c05aa`. Distinto
  del modelo de Soporte (ver sección de abajo), que sigue desbloqueado gratis vía `FREE_MODE`.
- **Icono maskable**: `icons/maskable_icon_512.png` generado y declarado en `manifest.webmanifest` con
  `purpose: "maskable"` (commit `85a1fd0`), además de los iconos `purpose: "any"` existentes.
- **`AppxManifest.xml`**: se sacó del repositorio (`87b0871`) — tenía marcadores de plantilla
  (`YourPublisher.YourProduct`) sin identidad real; ahora vive en `.gitignore` y lo genera la
  herramienta de empaquetado con la identidad real de la Store en el momento de firmar.

## Otros pendientes conocidos

- **Screenshots**: el manifest no incluye `screenshots` (recomendado por PWABuilder para un listing más rico en Store). Añadir cuando haya capturas de la app en modo escritorio/ancho.
