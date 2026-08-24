const { chromium } = require('playwright');

async function main() {
  console.log('=== CDP DEBUG: Full Guide with Wizard Close Simulation ===\n');

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  console.log('Conectado a Edge via CDP (puerto 9222)');

  const contexts = browser.contexts();
  if (!contexts.length) {
    console.log('No hay contextos');
    await browser.close();
    return;
  }
  const context = contexts[0];
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('localhost'));
  if (!page) {
    page = await context.newPage();
    await page.goto('http://localhost:8793', { waitUntil: 'networkidle' });
  }

  console.log('Page URL:', page.url());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Navigate
  await page.evaluate(() => window.location.hash = '#/ganaderia?tab=sanidad');
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');

  // Start guide
  console.log('\n--- Iniciando gegan.sanidad ---');
  await page.evaluate(() => window.GuideManager?.start('gegan.sanidad'));
  await page.waitForTimeout(1000);

  // Run through all steps properly
  console.log('\n--- Running through all steps (with wizard close simulation) ---');
  for (let i = 0; i < 12; i++) {
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
      const guide = allGuides.find(g => g.id === 'gegan.sanidad');
      const step = guide?.steps?.[stepIdx];
      if (step?.target && hole) {
        const trg = document.querySelector(step.target);
        if (trg) {
          const tr = trg.getBoundingClientRect();
          const x = +hole.getAttribute('x'), y = +hole.getAttribute('y'), w = +hole.getAttribute('width'), h = +hole.getAttribute('height');
          // Compare hole (with 8px padding) with target + padding
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

    console.log(`\n=== Paso ${state.step+1}: "${state.title}" ===`);
    console.log(`  visible=${state.visible}, reach=${state.reach}, spotAligned=${state.spot.aligned??'n/a'}${state.spot.dx?` dx${state.spot.dx} dy${state.spot.dy}`:''}`);
    console.log(`  wizards: ${state.wizardCount}`, state.wizards.length ? state.wizards : '');
    if (!state.visible || !state.reach) console.log('  ❌ FALLO POPOVER');

    // If wizard is open, simulate closing it instead of clicking Next
    if (state.wizardCount > 0) {
      console.log('  🔄 Wizard abierto - simulando cierre (remove)');
      await page.evaluate(() => {
        const wizard = document.querySelector('.wizard-full-screen');
        if (wizard) {
          // Remove wizard to simulate close (triggers MutationObserver removedNodes)
          wizard.remove();
        }
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

  console.log('\n⏳ Browser abierto para inspección manual. Ctrl+C para cerrar.');
}

main().catch(console.error);