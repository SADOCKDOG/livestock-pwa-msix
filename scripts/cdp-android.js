const { chromium } = require('playwright');

async function main() {
  console.log('=== CDP DEBUG: gegan.sanidad en Xiaomi (Chrome existente) ===\n');

  // Connect to Chrome on Android via CDP
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  console.log('Conectado a Chrome via CDP');

  const contexts = browser.contexts();
  if (!contexts.length) {
    console.log('No hay contextos');
    await browser.close();
    return;
  }
  const context = contexts[0];
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('localhost:8793'));
  if (!page) {
    page = pages[0];
    await page.goto('http://localhost:8793', { waitUntil: 'networkidle' });
  }

  console.log('Page URL:', page.url());

  // Wait for app load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Check if welcome screen
  const welcomeBtn = await page.$('button:has-text("Cargar Demo"), button:has-text("Demo CHAMORRO")');
  if (welcomeBtn) {
    console.log('Cargando Demo CHAMORRO...');
    await welcomeBtn.click();
    await page.waitForTimeout(8000);
  }

  // Check active farm
  const fincaId = await page.evaluate(async () => {
    try { return await window.Fincas?.getActiveId?.(); } catch { return null; }
  });
  console.log('Finca activa:', fincaId);

  // Start guide
  console.log('\n--- Iniciando gegan.sanidad ---');
  await page.evaluate(() => window.GuideManager?.start('gegan.sanidad'));
  await page.waitForTimeout(2000);

  for (let i = 0; i < 10; i++) {
    const state = await page.evaluate((stepIdx) => {
      const p = document.querySelector('.guide-popover');
      const o = document.querySelector('.guide-overlay');
      if (!p) return { done: true };
      const r = p.getBoundingClientRect();
      const nb = p.querySelector('button[data-guide-action="next"]');
      const br = nb ? nb.getBoundingClientRect() : null;
      const t = p.querySelector('.guide-popover-title')?.textContent || '';
      const v = p.style.display !== 'none' && getComputedStyle(p).display !== 'none' && r.width > 0;
      const reach = br && br.bottom <= innerHeight && br.top >= 0 && br.right <= innerWidth && br.left >= 0;
      const gs = window.GuideManager?._state?.currentGuide;
      let spot = { has: false };
      if (gs?.step?.target) {
        const trg = document.querySelector(gs.step.target);
        if (trg) {
          const tr = trg.getBoundingClientRect();
          const hole = o?.querySelector('[id*="guide-hole"]');
          if (hole) {
            const x = +hole.getAttribute('x'), y = +hole.getAttribute('y'), w = +hole.getAttribute('width'), h = +hole.getAttribute('height');
            spot = { has: true, aligned: Math.abs(tr.left-x)<=10 && Math.abs(tr.top-y)<=10 && Math.abs(tr.width-w)<=10 && Math.abs(tr.height-h)<=10, dx: Math.abs(tr.left-x), dy: Math.abs(tr.top-y) };
          }
        }
      }
      const wizards = document.querySelectorAll(".wizard-full-screen");
      return { step: stepIdx, title: t, visible: v, reach: !!reach, popRect: {t:r.top,l:r.left,w:r.width,h:r.height}, btnRect: br?{t:br.top,l:br.left,w:br.width,h:br.height}:null, spot, wizardCount: wizards.length, nodePausa: window.GuideManager?._state?.currentGuide?._nodoPausa ? true : false };
    }, i);

    if (!state || state.done) { console.log('Guía terminada'); break; }

    console.log(`\nPaso ${state.step+1}: "${state.title}"`);
    console.log(`  visible=${state.visible}, reach=${state.reach}, spotAligned=${state.spot.aligned??'n/a'}${state.spot.dx?` dx${state.spot.dx} dy${state.spot.dy}`:''}`);
    console.log(`  wizards en DOM: ${state.wizardCount}, _nodoPausa: ${state.nodePausa}`);
    if (!state.visible || !state.reach) console.log('  ❌ FALLO POPOVER');

    // Click next
    await page.evaluate(() => {
      const btn = document.querySelector('.guide-popover button[data-guide-action="next"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);
  }

  // Keep browser open for manual inspection
  console.log('\n⏳ Browser abierto para inspección manual. Ctrl+C para cerrar.');
}

main().catch(console.error);