const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = 'C:/Users/yo/AppData/Local/Temp/claude/auditoria-guias-pwa';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPageLoad(page) {
  await page.waitForLoadState('networkidle');
  await sleep(1000); // Extra wait for app initialization
}

async function loadDemoChamorro(page) {
  console.log('Cargando Demo CHAMORRO...');

  // Check if welcome screen is present
  await page.waitForSelector('#tour-flotante-overlay, .welcome-overlay, [data-welcome], button:has-text("Cargar Demo")', { timeout: 10000 }).catch(() => {});

  // Try to find and click the "Cargar Demo CHAMORRO" button
  const loadButton = await page.$('button:has-text("Cargar Demo CHAMORRO"), button:has-text("Demo CHAMORRO"), button:has-text("Cargar Demo"), .btn:has-text("Demo")');
  if (loadButton) {
    await loadButton.click();
    console.log('Botón Demo CHAMORRO pulsado');
    await sleep(8000); // Wait for demo to load
  } else {
    console.log('Botón Demo no encontrado, verificando si ya hay datos...');
  }

  // Verify active farm - retry a few times
  let fincaId = null;
  for (let i = 0; i < 5; i++) {
    fincaId = await page.evaluate(async () => {
      try {
        return await window.Fincas?.getActiveId?.();
      } catch (e) {
        return null;
      }
    });
    if (fincaId) break;
    console.log(`Finca activa: null, reintento ${i+1}/5...`);
    await sleep(2000);
  }
  console.log('Finca activa:', fincaId);
  return fincaId;
}

async function startGuide(page, guideId) {
  console.log(`Iniciando guía: ${guideId}`);
  await page.evaluate((id) => {
    return window.GuideManager?.start(id);
  }, guideId);
  await sleep(1000); // Wait for guide to mount
}

async function measureStep(page, guideId, stepIndex) {
  const result = await page.evaluate((stepIdx) => {
    const popover = document.querySelector('.guide-popover');
    const overlay = document.querySelector('.guide-overlay');

    if (!popover) return { error: 'No hay popover' };

    const popoverRect = popover.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // Check if Next/Finish button is reachable
    const nextBtn = popover.querySelector('button[data-guide-action="next"]');
    const btnRect = nextBtn ? nextBtn.getBoundingClientRect() : null;

    const btnReachable = btnRect &&
      btnRect.bottom <= viewportH &&
      btnRect.top >= 0 &&
      btnRect.right <= viewportW &&
      btnRect.left >= 0;

    // Get popover title
    const titleEl = popover.querySelector('.guide-popover-title');
    const title = titleEl ? titleEl.textContent : '';

    // Check spotlight alignment if target exists
    let spotlightInfo = { hasTarget: false, aligned: false, targetRect: null, holeRect: null };

    // Get the current guide state to find the target
    const guideState = window.GuideManager?._state?.currentGuide;
    let targetSelector = null;
    if (guideState?.step?.target) {
      targetSelector = guideState.step.target;
      spotlightInfo.hasTarget = true;

      const target = document.querySelector(targetSelector);
      if (target) {
        const targetRect = target.getBoundingClientRect();
        spotlightInfo.targetRect = {
          top: targetRect.top, left: targetRect.left,
          width: targetRect.width, height: targetRect.height,
          bottom: targetRect.bottom, right: targetRect.right
        };

        // Get the hole rect from SVG
        const holeRect = overlay?.querySelector('#guide-hole, [id*="guide-hole"]');
        if (holeRect) {
          const x = parseFloat(holeRect.getAttribute('x'));
          const y = parseFloat(holeRect.getAttribute('y'));
          const w = parseFloat(holeRect.getAttribute('width'));
          const h = parseFloat(holeRect.getAttribute('height'));

          spotlightInfo.holeRect = { x, y, width: w, height: h };

          // Check alignment (within 10px tolerance)
          const dx = Math.abs(targetRect.left - x);
          const dy = Math.abs(targetRect.top - y);
          const dw = Math.abs(targetRect.width - w);
          const dh = Math.abs(targetRect.height - h);

          spotlightInfo.aligned = dx <= 10 && dy <= 10 && dw <= 10 && dh <= 10;
          spotlightInfo.delta = { dx, dy, dw, dh };
        } else {
          spotlightInfo.aligned = false;
          spotlightInfo.reason = 'No se pudo leer el atributo hole del SVG';
        }
      } else {
        spotlightInfo.aligned = false;
        spotlightInfo.reason = 'Target no existe en el DOM';
      }
    }

    // Check if popover is visible
    const popoverVisible = popover.style.display !== 'none' &&
      getComputedStyle(popover).display !== 'none' &&
      popoverRect.width > 0 && popoverRect.height > 0;

    return {
      title,
      stepIndex: stepIdx,
      popoverRect: {
        top: popoverRect.top, left: popoverRect.left,
        width: popoverRect.width, height: popoverRect.height,
        bottom: popoverRect.bottom, right: popoverRect.right
      },
      btnRect: btnRect ? {
        top: btnRect.top, left: btnRect.left,
        width: btnRect.width, height: btnRect.height,
        bottom: btnRect.bottom, right: btnRect.right
      } : null,
      btnReachable: btnReachable || false,
      popoverVisible,
      viewportH,
      viewportW,
      spotlightInfo
    };
  });

  return result;
}

async function navigateNext(page) {
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('.guide-popover button[data-guide-action="next"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (clicked) await sleep(800);
  return clicked;
}

async function runAuditForGuide(page, guideId, guideName) {
  console.log(`\n=== AUDITORÍA: ${guideName} (${guideId}) ===`);

  const results = {
    guideId,
    guideName,
    steps: [],
    summary: {
      total: 0,
      popoverUnreachable: 0,
      spotlightMisaligned: 0,
      targetMissing: 0
    }
  };

  await startGuide(page, guideId);
  await sleep(1000);

  let stepCount = 0;
  let consecutiveErrors = 0;

  while (stepCount < 30) { // Safety limit
    const measurement = await measureStep(page, guideId, stepCount);

    if (measurement.error) {
      console.log(`Paso ${stepCount}: ${measurement.error} - guía terminada o error`);
      break;
    }

    stepCount++;
    results.summary.total++;

    const hasPopoverIssue = !measurement.btnReachable || !measurement.popoverVisible;
    const hasSpotlightIssue = measurement.spotlightInfo.hasTarget && !measurement.spotlightInfo.aligned;
    const hasTargetMissing = measurement.spotlightInfo.hasTarget && measurement.spotlightInfo.reason === 'Target no existe en el DOM';

    if (hasPopoverIssue) results.summary.popoverUnreachable++;
    if (hasSpotlightIssue) results.summary.spotlightMisaligned++;
    if (hasTargetMissing) results.summary.targetMissing++;

    const stepResult = {
      stepIndex: measurement.stepIndex,
      title: measurement.title,
      popoverRect: measurement.popoverRect,
      btnRect: measurement.btnRect,
      btnReachable: measurement.btnReachable,
      popoverVisible: measurement.popoverVisible,
      spotlightInfo: measurement.spotlightInfo,
      issues: []
    };

    if (!measurement.btnReachable) {
      stepResult.issues.push('POPOVER INALCANZABLE: botón Siguiente/Finalizar fuera del viewport');
    }
    if (!measurement.popoverVisible) {
      stepResult.issues.push('POPOVER INVISIBLE: display:none o dimensiones 0');
    }
    if (hasSpotlightIssue) {
      stepResult.issues.push(`SPOTLIGHT DESCOLADO: delta x=${measurement.spotlightInfo.delta?.dx}, y=${measurement.spotlightInfo.delta?.dy}, w=${measurement.spotlightInfo.delta?.dw}, h=${measurement.spotlightInfo.delta?.dh}`);
    }
    if (hasTargetMissing) {
      stepResult.issues.push('TARGET INEXISTENTE: selector no encuentra elemento en DOM');
    }

    results.steps.push(stepResult);

    // Log
    console.log(`Paso ${stepCount} "${measurement.title}":`);
    console.log(`  Popover: visible=${measurement.popoverVisible}, rect=[${measurement.popoverRect.top.toFixed(0)},${measurement.popoverRect.left.toFixed(0)} ${measurement.popoverRect.width.toFixed(0)}x${measurement.popoverRect.height.toFixed(0)}]`);
    console.log(`  Botón alcanzable: ${measurement.btnReachable}`);
    if (measurement.spotlightInfo.hasTarget) {
      console.log(`  Spotlight: targetFound=${!!measurement.spotlightInfo.targetRect}, aligned=${measurement.spotlightInfo.aligned}`);
      if (!measurement.spotlightInfo.aligned && measurement.spotlightInfo.delta) {
        console.log(`    Delta: dx=${measurement.spotlightInfo.delta.dx}, dy=${measurement.spotlightInfo.delta.dy}`);
      }
    }
    if (stepResult.issues.length > 0) {
      console.log(`  ⚠ FALLOS: ${stepResult.issues.join('; ')}`);
    }

    // Screenshot on issues
    if (stepResult.issues.length > 0 || stepCount <= 2) {
      try {
        const screenshotPath = path.join(OUTPUT_DIR, `${guideName}-paso-${stepCount}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        stepResult.screenshot = screenshotPath;
        console.log(`  📸 Captura: ${screenshotPath}`);
      } catch (e) {
        console.log(`  ⚠ Screenshot fallido: ${e.message}`);
      }
    }

    // Navigate to next step
    const hasNext = await navigateNext(page);
    if (!hasNext) {
      console.log('No hay botón Siguiente - guía completada');
      break;
    }

    // Check if guide finished
    const guideStillRunning = await page.evaluate(() => window.GuideManager?.isRunning?.());
    if (!guideStillRunning) {
      console.log('Guía finalizada');
      break;
    }
  }

  return results;
}

async function main() {
  console.log('Iniciando auditoría de guías interactivas PWA Livestock Manager');
  console.log('==============================================================');

  const browser = await chromium.launch({ headless: false }); // visible for debugging
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();

  try {
    // Navigate to PWA
    console.log('Navegando a http://localhost:8793...');
    await page.goto('http://localhost:8793', { waitUntil: 'networkidle' });
    await sleep(3000);

    // Load Demo CHAMORRO
    await loadDemoChamorro(page);
    await sleep(2000);

    // Get available guides
    const guides = await page.evaluate(() => {
      return window.GuideRegistry?.getAll?.().map(g => ({ id: g.id, title: g.title, pillar: g.pillar, tab: g.tab })) || [];
    });
    console.log('\nGuías disponibles:', guides.map(g => g.id).join(', '));

    // Priority guides to audit
    const priorityGuides = [
      'gegan.sanidad', // Main reported case
      'gegan.panoramica',
      'expro.panoramica',
      'comer.panoramica'
    ];

    const allResults = [];

    for (const guideId of priorityGuides) {
      const guide = guides.find(g => g.id === guideId);
      if (!guide) {
        console.log(`\n⚠ Guía ${guideId} no encontrada, saltando...`);
        continue;
      }

      const result = await runAuditForGuide(page, guideId, guideId.replace('.', '_'));
      allResults.push(result);

      // Clean up between guides
      await page.evaluate(() => window.GuideManager?.skip?.());
      await sleep(500);
    }

    // Summary report
    console.log('\n\n==============================================================');
    console.log('RESUMEN DE AUDITORÍA');
    console.log('==============================================================\n');

    for (const r of allResults) {
      console.log(`${r.guideName}:`);
      console.log(`  Pasos totales: ${r.summary.total}`);
      console.log(`  Popover inalcanzable: ${r.summary.popoverUnreachable}`);
      console.log(`  Spotlight descolocado: ${r.summary.spotlightMisaligned}`);
      console.log(`  Target inexistente: ${r.summary.targetMissing}`);

      // Detail each failure
      for (const step of r.steps) {
        if (step.issues.length > 0) {
          console.log(`  Paso ${step.stepIndex} "${step.title}":`);
          for (const issue of step.issues) {
            console.log(`    - ${issue}`);
          }
        }
      }
      console.log('');
    }

    // Save JSON report
    const reportPath = path.join(OUTPUT_DIR, 'auditoria-guias-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2));
    console.log(`\nInforme completo guardado en: ${reportPath}`);

  } catch (error) {
    console.error('Error en auditoría:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);