const { chromium } = require('playwright');
const CDP = require('chrome-remote-interface');

async function main() {
  console.log('=== CDP DEBUG: gegan.sanidad en Xiaomi ===\n');

  // Connect to Chrome on device via CDP
  const cdp = await CDP({ port: 9222 });
  await cdp.Runtime.enable();
  await cdp.Page.enable();

  // Get tabs
  const tabs = await cdp.List();
  const targetTab = tabs.find(t => t.url.includes('localhost:8793'));
  if (!targetTab) {
    console.log('No se encontró tab con localhost:8793');
    console.log('Tabs:', tabs.map(t => t.url));
    await cdp.close();
    return;
  }

  console.log('Tab encontrado:', targetTab.url);
  await cdp.Target.attachToTarget({ targetId: targetTab.id, flatten: true });

  const session = await cdp.Target.getSessionTargetId({ targetId: targetTab.id });
  const client = await CDP({ port: 9222, target: session.sessionId });
  await client.Runtime.enable();
  await client.Page.enable();

  // Function to evaluate and log
  async function evalLog(expr) {
    const result = await client.Runtime.evaluate({ expression: expr, awaitPromise: true });
    if (result.result) {
      if (result.result.type === 'object') {
        return result.result.value;
      }
      return result.result.value;
    }
    return null;
  }

  // Check current state
  console.log('\n--- Estado inicial ---');
  await evalLog('window.GuideManager?.isRunning()');
  await evalLog('document.querySelectorAll(".wizard-full-screen").length');
  await evalLog('document.querySelector(".wizard-full-screen")?.className');

  // Start guide
  console.log('\n--- Iniciando gegan.sanidad ---');
  await evalLog('GuideManager.start("gegan.sanidad")');
  await new Promise(r => setTimeout(r, 2000));

  for (let i = 0; i < 10; i++) {
    const state = await evalLog(`
      (() => {
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
        return { step: i, title: t, visible: v, reach: !!reach, popRect: {t:r.top,l:r.left,w:r.width,h:r.height}, btnRect: br?{t:br.top,l:br.left,w:br.width,h:br.height}:null, spot, wizardCount: document.querySelectorAll(".wizard-full-screen").length, nodePausa: window.GuideManager?._state?.currentGuide?._nodoPausa ? true : false };
      })()
    `);

    if (!state || state.done) { console.log('Guía terminada'); break; }

    console.log(`\nPaso ${state.step+1}: "${state.title}"`);
    console.log(`  visible=${state.visible}, reach=${state.reach}, spotAligned=${state.spot.aligned??'n/a'}${state.spot.dx?` dx${state.spot.dx} dy${state.spot.dy}`:''}`);
    console.log(`  wizards en DOM: ${state.wizardCount}, _nodoPausa: ${state.nodePausa}`);
    if (!state.visible || !state.reach) console.log('  ❌ FALLO POPOVER');

    // Check if launch step
    const stepInfo = await evalLog(`window.GuideManager?._state?.currentGuide?.step`);
    if (stepInfo?.launch) console.log(`  ⚡ PASO CON LAUNCH`);

    // Click next
    await client.Runtime.evaluate({ expression: `
      const btn = document.querySelector('.guide-popover button[data-guide-action="next"]');
      if (btn) btn.click();
    `, awaitPromise: true });

    await new Promise(r => setTimeout(r, 1500));
  }

  await cdp.close();
}

main().catch(console.error);