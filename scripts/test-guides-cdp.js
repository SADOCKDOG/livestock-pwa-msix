const { chromium } = require('playwright');

async function testGuide(browser, guideId, route, tab, stepsCount) {
  const context = browser.contexts()[0];
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('localhost'));
  if (!page) {
    page = await context.newPage();
    await page.goto('http://localhost:8793', { waitUntil: 'networkidle' });
  }

  console.log(`\n=== Testing ${guideId} ===`);
  console.log(`Route: ${route}, Tab: ${tab || 'none'}`);

  // Navigate
  const hash = tab ? `#/ganaderia?tab=${tab}` : `#${route}`;
  await page.evaluate((h) => window.location.hash = h, hash);
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');

  // Start guide
  await page.evaluate((id) => window.GuideManager?.start(id), guideId);
  await page.waitForTimeout(1500);

  // Run through all steps
  const results = [];
  for (let i = 0; i < stepsCount; i++) {
    const state = await page.evaluate((stepIdx) => {
      const popover = document.querySelector('.guide-popover');
      const overlay = document.querySelector('.guide-overlay');
      if (!popover) return { done: true };

      const r = popover.getBoundingClientRect();
      const nb = popover.querySelector('button[data-guide-action="next"]');
      const br = nb ? nb.getBoundingClientRect() : null;
      const title = popover.querySelector('.guide-popover-title')?.textContent || '';
      const visible = popover.style.display !== 'none' && getComputedStyle(popover).display !== 'none' && r.width > 0;
      const reach = br && br.bottom <= innerHeight && br.top >= 0 && br.right <= innerWidth && br.left >= 0;

      const wizards = document.querySelectorAll(".wizard-full-screen");
      const wizDetails = [...wizards].map(w => ({ className: w.className, style: w.style.cssText, id: w.id }));

      // Spotlight check
      let spot = { has: false };
      const hole = overlay?.querySelector('[id*="guide-hole"]');
      const allGuides = window.GuideRegistry?.getAll?.() || [];
      // Find the active guide by checking which one has steps matching current state
      const baseGuideId = 'gegan.panoramica'; // fallback
      let guide = allGuides.find(g => g.id === baseGuideId);
      // Try to find any guide with steps
      if (!guide && allGuides.length > 0) guide = allGuides[0];
      const step = guide?.steps?.[stepIdx];
      if (step?.target && hole) {
        const trg = document.querySelector(step.target);
        if (trg) {
          const tr = trg.getBoundingClientRect();
          const x = +hole.getAttribute('x'), y = +hole.getAttribute('y'), w = +hole.getAttribute('width'), h = +hole.getAttribute('height');
          spot = { has: true, aligned: Math.abs(tr.left-8-x)<=10 && Math.abs(tr.top-8-y)<=10 && Math.abs(tr.width+16-w)<=10 && Math.abs(tr.height+16-h)<=10, dx: Math.abs(tr.left-8-x), dy: Math.abs(tr.top-8-y) };
        }
      }

      return {
        step: stepIdx,
        title,
        visible,
        reach: !!reach,
        popRect: {t:r.top,l:r.left,w:r.width,h:r.height},
        btnRect: br?{t:br.top,l:br.left,w:br.width,h:br.height}:null,
        spot,
        wizardCount: wizards.length,
        wizards: wizDetails,
      };
    }, i);

    if (!state || state.done) { console.log('Guía terminada'); break; }

    console.log(`\n  Paso ${state.step+1}: "${state.title}"`);
    console.log(`    visible=${state.visible}, reach=${state.reach}, spotAligned=${state.spot.aligned??'n/a'}${state.spot.dx?` dx${state.spot.dx} dy${state.spot.dy}`:''}`);
    console.log(`    wizards: ${state.wizardCount}`, state.wizards.length ? state.wizards : '');
    if (!state.visible || !state.reach) console.log('    ❌ FALLO POPOVER');

    results.push(state);

    // If wizard is open, simulate closing it
    if (state.wizardCount > 0) {
      console.log('    🔄 Wizard abierto - simulando cierre (remove)');
      await page.evaluate(() => {
        const wizard = document.querySelector('.wizard-full-screen');
        if (wizard) wizard.remove();
      });
      await page.waitForTimeout(1500); // Wait for guide to resume
    } else {
      // Click next
      await page.evaluate(() => {
        const btn = document.querySelector('.guide-popover button[data-guide-action="next"]');
        if (btn) btn.click();
      });
      await page.waitForTimeout(1000);
    }
  }

  // Summary
  const passed = results.filter(r => r.visible && r.reach).length;
  const failed = results.filter(r => !r.visible || !r.reach).length;
  console.log(`\n  📊 ${guideId}: ${passed}/${results.length} OK, ${failed} FALLOS`);

  return { guideId, passed, failed, total: results.length, results };
}

async function main() {
  console.log('=== CDP DEBUG: Testing 3 Priority Guides ===\n');

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  console.log('Conectado a Edge via CDP (puerto 9222)');

  const results = [];

  // Test gegan.panoramica (12 steps)
  results.push(await testGuide(browser, 'gegan.panoramica', '/ganaderia', null, 12));

  // Test expro.panoramica (13 steps)
  results.push(await testGuide(browser, 'expro.panoramica', '/explotacion', null, 13));

  // Test comer.panoramica (11 steps)
  results.push(await testGuide(browser, 'comer.panoramica', '/comercializacion', null, 11));

  // Final summary
  console.log('\n\n=== RESUMEN FINAL ===');
  for (const r of results) {
    const status = r.failed === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${r.guideId}: ${r.passed}/${r.total} pasos OK`);
  }

  const allPassed = results.every(r => r.failed === 0);
  console.log(`\n${allPassed ? '🎉 TODAS LAS GUÍAS PASAN' : '⚠️ HAY GUÍAS CON FALLOS'}`);

  console.log('\n⏳ Browser abierto para inspección manual. Ctrl+C para cerrar.');
}

main().catch(console.error);