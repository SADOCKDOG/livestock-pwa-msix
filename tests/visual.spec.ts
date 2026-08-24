import { test, expect } from '@playwright/test';

test('captura de pantalla de la PWA', async ({ page }) => {
  await page.goto('http://localhost:8080');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/pwa-home.png', fullPage: true });
});

test('navegación básica y rellenar formulario - manejar wizard y tour', async ({ page }) => {
  await page.goto('http://localhost:8080');
  await page.waitForLoadState('networkidle');

  // Tomar captura inicial
  await page.screenshot({ path: 'screenshots/01-home.png', fullPage: true });

  // Helper: cerrar overlay si existe
  async function closeOverlay(selector: string, name: string) {
    const overlay = page.locator(selector);
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({ path: `screenshots/01b-${name}.png`, fullPage: true });

      // Buscar botones en el overlay
      const buttons = overlay.locator('button, [role="button"]');
      const buttonTexts = ['Siguiente', 'Continuar', 'Aceptar', 'Guardar', 'Saltar', 'Omitir', 'Cerrar', 'Hecho', 'Finalizar', 'Entendido', 'OK'];
      for (const text of buttonTexts) {
        const btn = buttons.filter({ hasText: text }).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(500);
          break;
        }
      }

      // Fallback: cualquier botón visible
      const anyBtn = buttons.first();
      if (await anyBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await anyBtn.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({ path: `screenshots/01c-${name}-closed.png`, fullPage: true });
      return true;
    }
    return false;
  }

  // Cerrar wizard de configuración
  await closeOverlay('#asistente-configuracion-contenedor', 'wizard');

  // Cerrar tour flotante
  await closeOverlay('#tour-flotante-overlay', 'tour');

  // También buscar backdrop genérico
  const backdrop = page.locator('.tour-flotante-backdrop, .modal-backdrop, .overlay-backdrop');
  for (const b of await backdrop.all()) {
    if (await b.isVisible({ timeout: 500 }).catch(() => false)) {
      // Intentar clic en el backdrop para cerrar (algunos modales se cierran así)
      await b.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/01d-after-overlays.png', fullPage: true });

  // Ahora navegar - buscar enlaces de navegación
  const navLinks = page.locator('nav a, .sidebar a, [data-nav], button:has-text("Inventario"), button:has-text("Animales"), a.sidebar-item');

  if (await navLinks.count() > 0) {
    // Usar force click para ignorar overlays residuales
    await navLinks.first().click({ force: true });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/02-nav.png', fullPage: true });
  } else {
    // Fallback: buscar cualquier elemento clickeable en sidebar/nav
    const sidebarItems = page.locator('.sidebar-item, [id^="sidebar-"], nav [role="menuitem"]');
    if (await sidebarItems.count() > 0) {
      await sidebarItems.first().click({ force: true });
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'screenshots/02-nav.png', fullPage: true });
    }
  }

  // Buscar formularios (inputs, selects, textareas)
  const inputs = page.locator('input:not([type="hidden"]), select, textarea');
  const inputCount = await inputs.count();

  if (inputCount > 0) {
    // Rellenar el primer input visible
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
        const tagName = await input.evaluate(el => el.tagName.toLowerCase());
        const type = await input.getAttribute('type');

        if (tagName === 'select') {
          const options = await input.locator('option').all();
          if (options.length > 1) {
            await input.selectOption({ index: 1 });
          }
        } else if (type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'checkbox' && type !== 'radio') {
          await input.fill('Test Playwright');
        }
        break;
      }
    }
    await page.screenshot({ path: 'screenshots/03-form-filled.png', fullPage: true });
  }
});