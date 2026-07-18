# Auditoría UI/UX — Adaptación a escritorio Windows (Microsoft Store)

**Fecha**: 2026-07-18
**Alcance**: `livestock-pwa-msix` (esta versión Microsoft Store). No aplica a `LIVESTOCK-MANAGER` (Android/Play), donde el diseño mobile-first es correcto y no debe tocarse.

## Resumen ejecutivo

El CSS/HTML de la app es 100% mobile-first, sin ninguna adaptación para pantallas anchas. Verificado en vivo (`https://sadockdog.github.io/livestock-pwa-msix/`) a **1920×1080**: la app carga y funciona correctamente, pero el resultado visual es un contenido apilado en una sola columna vertical, con espaciados y tipografía pensados para el pulgar de un móvil, dejando gran parte de la ventana de escritorio infrautilizada. No es solo "se ve pequeño" — hay además un bug concreto de layout (ver Hallazgo 3) que hace que listas que deberían usar múltiples columnas se apilen en una sola.

**No es necesario ni deseable "hacer un rediseño de cero"**: el 90% del trabajo es añadir un conjunto de reglas `@media (min-width: ...)` y ajustar unos pocos componentes clave, reutilizando el sistema de diseño (tokens, colores, componentes `.card`) que ya existe y funciona bien.

## Metodología

- Lectura de `css/layout.css`, `css/design-tokens.css`, `css/styles.css` (4114 líneas) buscando media queries existentes.
- Carga real de la app en navegador a 1920×1080 (`resize_window` + captura + inspección de `getBoundingClientRect()` de los elementos clave vía consola).
- Vistas comprobadas: Dashboard (`#/`) y Animales (`#/animales`), tras cargar la finca de demo "CHAMORRO".

## Hallazgos

### 1. Cero breakpoints de escritorio — todo el CSS es "shrink-only"

`grep "@media" css/*.css` solo devuelve reglas `max-width` (400px, 480px, 600px, 768px) pensadas para achicar aún más el layout en móviles pequeños. **No existe ni una sola regla `min-width` en todo el proyecto.** No hay ningún punto en el que el CSS reaccione a tener *más* espacio disponible.

### 2. El contenedor principal se estira, pero el contenido interior no aprovecha el ancho

`#app-content { max-width: 100%; }` y `.card` sí ocupan el ancho completo de la ventana (verificado: `.card` mide 1880px de ancho en una ventana de 1904px). El problema no es que esté centrado en una columna estrecha — es que **dentro** de esa card ancha, el contenido sigue organizándose como si fuera estrecho: listas de un solo ítem por fila, formularios de un campo por fila, texto pequeño con mucho espacio en blanco alrededor. Resultado: en el Dashboard, el body mide **2315px de alto** dentro de un viewport de 1080px (más del doble de scroll vertical del necesario) para mostrar la misma información que en móvil ocupa una pantalla, simplemente porque nada se reorganiza en columnas.

### 3. Bug concreto: `grid-cols-12` no existe → apilado forzoso de una sola columna

La sección "Registro rápido de actividad" del Dashboard usa `class="grid grid-cols-12 gap-12"`. Pero `.grid-cols-12` **no está definido en ningún CSS** (`grep -rn "grid-cols-12" css/` no devuelve nada salvo el uso en el HTML/JS). El sistema de diseño sí define `.grid-cols-2` y `.grid-cols-3` (`css/styles.css:1162-1163`), pero nunca se implementó la variante de 12 columnas. Efecto: `.grid { display: grid; }` sin `grid-template-columns` cae al comportamiento por defecto (una columna implícita), así que cada fila de actividad ocupa el 100% del ancho aunque hubiera espacio de sobra para 3-4 columnas. Esto es una **corrección rápida y de bajo riesgo** (añadir la clase que falta), independiente del resto de la auditoría.

### 4. Navegación inferior fija (`bottom-nav`) no tiene sentido en escritorio

`nav.bottom-nav` (`position: fixed; bottom:0; left:0; right:0`) se estira also a los 1904px completos en escritorio: 7 items de navegación (Inicio, Animales, Rebaños, GeGan, ExPro, CoMer, Más) repartidos a lo ancho de toda la ventana, muy separados entre sí — cómodo para el pulgar en un móvil de 360px, incómodo y poco natural para un usuario con ratón en una ventana de 1920px (movimientos de ratón innecesariamente largos, sin agrupación visual). El menú "Más" (`more-sheet`, bottom-sheet que sube desde abajo) tampoco es un patrón habitual de escritorio.

### 5. Modales y diálogos: cajas estrechas centradas en un lienzo enorme

El asistente de primer uso y los diálogos de confirmación (ej. "Cargar Demo") son cajas de ~420-500px centradas en medio de la ventana, dejando el resto de la pantalla en negro sin usar. Funcionalmente correcto, pero visualmente da sensación de app "perdida" en una ventana de escritorio grande — especialmente notorio en ventanas maximizadas de 1920px+.

### 6. Tipografía y densidad pensadas para toque, no para lectura de escritorio

Tamaños de fuente `0.75rem`–`0.85rem` para datos tabulares (`css/styles.css:2977-2981`), pensados para dedo/pantalla pequeña. En un monitor de escritorio a distancia de brazo, esa densidad es aceptable pero desaprovecha la posibilidad de mostrar más columnas de datos por fila (ej. tablas de animales con más campos visibles sin scroll horizontal) o usar un tamaño más cómodo de lectura sin sacrificar cantidad de información.

## Recomendaciones (priorizadas)

### Prioridad alta — bajo riesgo, alto impacto

1. **Arreglar el bug de `grid-cols-12`** (Hallazgo 3): añadir la clase que falta o corregir el HTML/JS que la referencia. Cambio de una línea de CSS, sin riesgo.
2. **Añadir un breakpoint de escritorio base** (`@media (min-width: 1024px)`) en `css/styles.css` que:
   - Limite `#app-content` a un `max-width` razonable (ej. 1200-1400px) centrado, con más `padding` lateral — igual que hacen la mayoría de apps de escritorio, en vez de estirar el contenido a los 1900px completos.
   - Reorganice el Dashboard y otras vistas de listado en una rejilla de 2-3 columnas (`.grid-cols-2`/`.grid-cols-3` ya existen y se pueden reutilizar) en vez de una columna de filas apiladas.

### Prioridad media — cambios de componente, riesgo moderado

3. **Sustituir (o complementar) `bottom-nav` por una barra lateral de navegación** en `min-width: 1024px`: reutilizar los mismos 7 destinos (`#/`, `#/animales`, `#/rebanos`, `#/ganaderia`, `#/explotacion`, `#/comercializacion`, menú "Más") en una sidebar vertical fija a la izquierda, ocultando `.bottom-nav` en ese breakpoint. Esto es un cambio de estructura HTML/CSS moderado pero contenido — no toca lógica de routing (`App.route()` sigue funcionando igual, solo cambia qué elemento de navegación está visible).
4. **Adaptar `more-sheet`** (menú "Más") a un dropdown/popover anclado al botón en vez de bottom-sheet, cuando la sidebar esté activa.

### Prioridad baja — pulido visual

5. Revisar tamaños de fuente de tablas/listados en `min-width: 1024px` (aumentar ligeramente sin perder densidad).
6. Modales: considerar tamaños ligeramente mayores en escritorio (`max-width` más generoso) para formularios largos (wizards), aprovechando el espacio disponible.

## Lo que NO hay que hacer

- No reescribir el sistema de diseño (tokens de color, tipografía de marca, efectos "Marco Galáctico"/neón) — eso es identidad visual, no un problema de escritorio.
- No tocar nada de `LIVESTOCK-MANAGER` (repo Android) — esta auditoría y sus cambios futuros deben vivir enteramente dentro de `livestock-pwa-msix`.
- No es necesario un framework de componentes nuevo (React, etc.) — el enfoque de "un `@media (min-width)` grande + reutilizar clases de grid existentes" es suficiente y consistente con la arquitectura vanilla JS actual.

## Siguiente paso sugerido

Implementar primero el punto 1 (bug `grid-cols-12`) y el punto 2 (breakpoint base de escritorio) como una primera iteración acotada y verificable visualmente, antes de abordar el cambio de navegación (punto 3), que es más invasivo.
