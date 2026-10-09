import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SALES_TEST_URL || 'http://localhost:3107';
const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
const browser = await chromium.launch({ headless: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1100 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
    await context.addCookies([{ name: 'veg_basket_session', value: token, url: base }]);
    const page = await context.newPage();
    let sawAnimatedScroll = false;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Emulate keyboard-driven VisualViewport changes without changing layout height.
    await page.addInitScript(() => {
      const viewport = new EventTarget();
      Object.assign(viewport, { height: window.innerHeight, offsetTop: 0 });
      Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
      window.setKeyboardViewport = (height, top = 0) => {
        Object.assign(viewport, { height, offsetTop: top });
        viewport.dispatchEvent(new Event('resize'));
        viewport.dispatchEvent(new Event('scroll'));
      };
    });
    await page.goto(base + '/sales');
    await page.evaluate(() => window.setKeyboardViewport(window.innerHeight));
    await page.getByRole('button', { name: 'Add sale', exact: true }).click();
    const editor = page.locator('.sales-editor');
    const lines = editor.locator('.sale-line');
    const names = editor.getByPlaceholder('Enter item name');
    const visibleFocus = async index => {
      await page.waitForFunction(index => {
        const input = document.querySelectorAll('.sale-line input[placeholder="Enter item name"]')[index];
        if (!input || document.activeElement !== input) return false;
        const r = input.getBoundingClientRect();
        const editor = document.querySelector('.sales-editor').getBoundingClientRect();
        const footer = document.querySelector('.sales-submit').getBoundingClientRect();
        const v = window.visualViewport;
        return r.top >= Math.max(editor.top, v.offsetTop) && r.bottom <= Math.min(editor.bottom, footer.top, v.offsetTop + v.height) && r.left >= 0 && r.right <= innerWidth;
      }, index);
    };
    await names.nth(0).fill('tomato');
    assert.equal(await names.nth(0).inputValue(), 'TOMATO');
    await names.nth(0).fill('fresh onion');
    assert.equal(await names.nth(0).inputValue(), 'FRESH ONION');
    await names.nth(0).fill('green chilli');
    assert.equal(await names.nth(0).inputValue(), 'GREEN CHILLI');
    await names.nth(0).evaluate(input => input.setSelectionRange(6, 6));
    await page.keyboard.type('fresh ');
    assert.equal(await names.nth(0).inputValue(), 'GREEN FRESH CHILLI');
    assert.equal(await names.nth(0).evaluate(input => input.selectionStart), 12);
    await lines.nth(0).getByRole('textbox').nth(1).fill('2box');
    await lines.nth(0).getByRole('spinbutton').fill('12.50');
    // Already-visible desktop insertion should preserve scroll position.
    const before = await editor.evaluate(el => el.scrollTop);
    await lines.nth(0).getByRole('button', { name: 'Next Item (→)', exact: true }).click();
    await visibleFocus(1);
    assert.equal(await editor.evaluate(el => el.scrollTop), before);
    await names.nth(1).fill('SECOND ITEM');
    // Insertion in the middle must preserve rows and move focus to the empty row.
    await lines.nth(0).getByRole('button', { name: 'Next Item (→)', exact: true }).click();
    await visibleFocus(1);
    assert.equal(await names.nth(1).inputValue(), '');
    assert.equal(await names.nth(2).inputValue(), 'SECOND ITEM');
    if (mobile) {
      await page.evaluate(() => window.setKeyboardViewport(360, 45));
      await visibleFocus(1);
    }
    await editor.evaluate(el => {
      el.addEventListener('pointerdown', () => { window.itemScrollSamples = []; });
      el.addEventListener('scroll', () => { window.itemScrollSamples?.push(el.scrollTop); });
    });
    for (let count = 3; count < 15; count++) {
      await names.last().fill('Item ' + count);
      await lines.last().getByRole('button', { name: 'Next Item (→)', exact: true }).evaluate(button => {
        const editor = button.closest('.sales-editor');
        const footer = editor.querySelector('.sales-submit').getBoundingClientRect();
        editor.scrollTop += button.getBoundingClientRect().bottom - (footer.top - 8);
      });
      await lines.last().getByRole('button', { name: 'Next Item (→)', exact: true }).click();
      await visibleFocus(count);
      const samples = await page.evaluate(() => window.itemScrollSamples || []);
      if (new Set(samples.map(Math.round)).size > 1) sawAnimatedScroll = true;
      assert.equal(await names.last().inputValue(), '');
      assert.equal(await lines.count(), count + 1);
    }
    // Keyboard resizing must reveal the active input even after initial focus.
    if (mobile) {
      await page.evaluate(() => window.setKeyboardViewport(290, 60));
      await visibleFocus(14);
      await page.evaluate(() => window.setKeyboardViewport(844, 0));
      await visibleFocus(14);
    }
    assert.equal(await lines.nth(0).getByRole('textbox').nth(1).inputValue(), '2box');
    assert.equal(await lines.nth(0).getByRole('spinbutton').inputValue(), '12.50');
    assert.match(await editor.locator('.sale-totals').innerText(), /AED 12.50/);
    assert.equal(sawAnimatedScroll, true, 'Offscreen rows must scroll through intermediate positions.');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('Passed: ' + (mobile ? 'mobile with simulated keyboard viewport' : 'desktop') + ' focus, visibility, continuous entry, middle insertion and no-scroll when visible.');
  }
} finally { await browser.close(); }
