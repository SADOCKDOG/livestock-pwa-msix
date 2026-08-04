# Validación de guías interactivas — Datos DEMO Chamorro

**Fecha**: 2026-08-04
**Alcance**: `livestock-pwa-msix` (PWA escritorio/MSIX). Las guías interactivas portadas desde `LIVESTOCK-MANAGER` (Android) validadas con la finca de demostración.

## Contexto de la prueba

- **Finca activa**: Ganadería CHAMORRO (DEMO) — id 1.
- **Flags de explotación**: `{ leche: true, carne: true }` (Híbrida).
- **Crotal de cabecera**: `ES210050001234`.
- **Modo**: oscuro por defecto (implementado y verificado).
- **URL de prueba**: `index.html?lm_qa_tools=1#/…` (los scripts `qa-guias.js` solo cargan con `lm_qa_tools=1`).
- **Entorno**: servidor local `http://localhost:8091` + navegador Playwright.

## Método

1. **Carga limpia por pilar**: navegar con query único (`_v=6.47c` etc.) para forzar recarga del documento en el pilar correcto. Navegar entre pilares por hash deja la vista con tabs corruptos (Ganadería daba 19/38 desde estado corrupto vs 36/38 desde carga limpia) — la recarga por pilar es la única forma fiable de validar.
2. Descartar la panorámica del pilar con click programático de "Saltar".
3. Ejecutar `GuiaQA.validarTargets('<NombreVista>')` (recibe el NOMBRE DE VISTA: `GanaderiaView`, `ExplotacionView`, `ComercializacionView`), que respeta `applies(flags)` y `disponible()` async de cada guía.

## Resultados

### Suite completa `GuiaQA.runAll()`

- **1303 passed / 0 failed / 1303 total** con Datos Demo Chamorro.

### Validación de targets por pilar (carga limpia)

| Pilar | ConTarget | Resuelven | Inválidos | Sin coincidencia |
|---|---|---|---|---|
| **GeGan** | 38 | **36** | 0 | 2 |
| **ExPro** | 55 | **52** | 0 | 3 |
| **CoMer** | 42 | **40** | 0 | 2 |

**0 selectores inválidos** en los 21 recorridos de guía (ningún `data-guide` roto en el código).

### Desglose de pasos sin coincidencia (todos legítimos)

Un paso "sin coincidencia" es legítimo cuando su elemento solo existe tras abrir un formulario o tras una condición de datos que la demo no cumple:

#### GeGan (2)
- `gegan.sanidad` paso 3 → `[data-guide="alertas-supresion"]`: bloque solo visible cuando hay alertas de supresión activas en Sanidad.
- `gegan.zonas` paso 7 → `#z-edit-nombre, #z-edit-pac, #z-edit-superficie`: campos del modal de edición de zona, solo existen al abrir el formulario.

#### ExPro (3)
- `expro.explotacion` paso 3 → `.card-resumen[style*="border-left: 4px solid var(--c-danger)"]`: card de peligro solo aparece con stock crítico.
- `expro.silos` paso 2 → mismo selector: card danger del silo al 18.75% solo en ciertos estados.
- `expro.gastos` paso 1 → `[data-guide="grafico-evolucion"]`: gráfico de evolución requiere seleccionar un período.

#### CoMer (2)
- `comer.compradores` paso 6 → `[onclick*="_cambiarModulo('contratos')"], [onclick*="CompradoresView._cambiarModulo"]`.
- `comer.contratos` paso 6 → `[onclick*="_cambiarModulo('compradores')"]`.

### Detalle por guía (resumen por pilar)

#### GeGan (`GanaderiaView`)
| Guía | ConTarget | Resuelven |
|---|---|---|
| gegan.panoramica | 8 | 8 |
| gegan.animales | 6 | 6 |
| gegan.rebanos | 5 | 5 |
| gegan.patrimonio | 6 | 6 |
| gegan.sanidad | 6 | 5 |
| gegan.zonas | 7 | 6 |

#### ExPro (`ExplotacionView`)
52/55 con 0 inválidos; los 3 sin coincidencia son los estados de card danger y el gráfico de evolución (ver arriba).

#### CoMer (`ComercializacionView`)
| Guía | ConTarget | Resuelven |
|---|---|---|
| comer.panoramica | 9 | 9 |
| comer.leche | 6 | 6 |
| comer.carne | 6 | 6 |
| comer.compradores | 7 | 6 |
| comer.contratos | 7 | 6 |
| comer.transportistas | 7 | 7 |

## Artefactos de la versión

- `CACHE_NAME = corcho-v6.47.0` (sw.js línea 1).
- Cache-busting `?v=6.47` en `index.html`, `js/app.js` (carga de scripts) y `js/asistente-configuracion.js` (seed-data).
- Build publicado = carpeta `docs/` (espejo byte-idéntico de la raíz salvo CRLF), verificado en vivo en `https://sadockdog.github.io/livestock-pwa-msix/`.

## Notas

- La versión Android (`LIVESTOCK-MANAGER`) mantiene sus propios números de validación; este spec es exclusivo de la PWA/MSIX.
- Pendiente ajeno: en `LIVESTOCK-MANAGER` otro agente trabaja las guías con finca vacía (no aplica a este spec).
