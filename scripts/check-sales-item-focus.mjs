import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SALES_TEST_URL || 'http://localhost:3107';
const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
const browser = await chromium.launch({ headless: true });
try {
  for (const size of [{ width: 1440, height: 1100 }, { width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    const mobile = size.width <= 700;
    const context = await browser.newContext({ viewport: size, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
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
    const panel = page.locator('.sales-editor');
    const editor = mobile ? panel.locator('form') : panel;
    const panelBounds = await panel.boundingBox();
    const lines = editor.locator('.sale-line');
    const names = editor.getByPlaceholder('Enter item name');
    const visibleFocus = async index => {
      await page.waitForFunction(index => {
        const input = document.querySelectorAll('.sale-line input[placeholder="Enter item name"]')[index];
        if (!input || document.activeElement !== input) return false;
        const r = input.getBoundingClientRect();
        const panel = document.querySelector('.sales-editor');
        const form = panel.querySelector('form');
        const editor = (getComputedStyle(form).overflowY === 'auto' ? form : panel).getBoundingClientRect();
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
    if (!mobile || size.height >= 800) assert.equal(await editor.evaluate(el => el.scrollTop), before);
    await names.nth(1).fill('SECOND ITEM');
    // Insertion in the middle must preserve rows and move focus to the empty row.
    await lines.nth(0).getByRole('button', { name: 'Next Item (→)', exact: true }).click();
    await visibleFocus(1);
    assert.equal(await names.nth(1).inputValue(), '');
    assert.equal(await names.nth(2).inputValue(), 'SECOND ITEM');
    if (mobile) {
      await page.evaluate(() => window.setKeyboardViewport(360, 45));
      await visibleFocus(1);
      assert.deepEqual(await panel.boundingBox(), panelBounds, 'Panel must remain stationary while keyboard is open.');
    }
    await editor.evaluate(el => {
      el.addEventListener('pointerdown', () => { window.itemScrollSamples = []; });
      el.addEventListener('scroll', () => { window.itemScrollSamples?.push(el.scrollTop); });
    });
    for (let count = 3; count < 15; count++) {
      await names.last().fill('Item ' + count);
      await lines.last().getByRole('button', { name: 'Next Item (→)', exact: true }).evaluate(button => {
        const panel = button.closest('.sales-editor');
        const form = panel.querySelector('form');
        const editor = getComputedStyle(form).overflowY === 'auto' ? form : panel;
        const footer = editor.querySelector('.sales-submit').getBoundingClientRect();
        editor.scrollTop += button.getBoundingClientRect().bottom - (Math.min(footer.top, editor.getBoundingClientRect().bottom) - 8);
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
      assert.deepEqual(await panel.boundingBox(), panelBounds, 'Panel must remain stationary at the shortest keyboard viewport.');
      await page.evaluate(height => window.setKeyboardViewport(height, 0), size.height);
      await visibleFocus(14);
    }
    if (mobile) {
      const finalBounds = await panel.boundingBox();
      assert.deepEqual(finalBounds, panelBounds, 'Keyboard opening/closing must not reposition or resize the panel.');
      assert.equal(await editor.evaluate(el => el.scrollWidth <= el.clientWidth), true, 'No horizontal overflow.');
      assert.equal(await page.evaluate(() => window.scrollY), 0, 'Only the form should scroll.');
      assert.equal(await editor.locator('.sales-submit').evaluate(el => getComputedStyle(el).position), 'static', 'Save must not overlap fields.');
      const beforeTyping = await names.nth(0).evaluate(input => {
        const form = input.closest('form');
        const rect = input.getBoundingClientRect();
        return { left: rect.left, width: rect.width, contentTop: rect.top + form.scrollTop };
      });
      await names.nth(0).fill('fresh onion');
      const afterTyping = await names.nth(0).evaluate(input => {
        const form = input.closest('form');
        const rect = input.getBoundingClientRect();
        return { left: rect.left, width: rect.width, contentTop: rect.top + form.scrollTop };
      });
      assert.deepEqual(afterTyping, beforeTyping, 'Typing should not reflow the field.');
    }
    assert.equal(await lines.nth(0).getByRole('textbox').nth(1).inputValue(), '2box');
    assert.equal(await lines.nth(0).getByRole('spinbutton').inputValue(), '12.50');
    assert.match(await editor.locator('.sale-totals').innerText(), /AED 12.50/);
    assert.equal(sawAnimatedScroll, true, 'Offscreen rows must scroll through intermediate positions.');
    // Draft item deletion must bypass global confirmation and preserve the bill.
    await names.nth(1).fill('remove this item');
    await lines.nth(1).getByRole('spinbutton').fill('10.00');
    await editor.locator('[name="discount"]').fill('2.50');
    await editor.locator('[name="paid"]').fill('5.00');
    await editor.locator('[name="notes"]').fill('Keep these notes');
    await editor.locator('[name="method"]').selectOption('Card');
    const remaining = await lines.evaluateAll(rows => rows.filter((_, index) => index !== 1).map(row => Array.from(row.querySelectorAll('input')).map(input => input.value)));
    const billFields = await editor.locator('[name]').evaluateAll(fields => fields.map(field => [field.name, field.value]));
    const deleteButton = lines.nth(1).getByRole('button', { name: 'Remove invoice item', exact: true });
    await deleteButton.scrollIntoViewIfNeeded();
    const scrollBeforeDelete = await editor.evaluate(el => el.scrollTop);
    const urlBeforeDelete = page.url();
    let salesWrites = 0;
    const recordWrite = request => {
      if (request.url().includes('/api/sales') && request.method() !== 'GET') salesWrites++;
    };
    page.on('request', recordWrite);
    await deleteButton.click();
    await page.waitForFunction(() => document.querySelectorAll('.sales-editor .sale-line').length === 14);
    assert.equal(await page.locator('.delete-confirm-modal').count(), 0);
    assert.equal(await panel.isVisible(), true);
    assert.equal(page.url(), urlBeforeDelete);
    assert.equal(salesWrites, 0, 'Removing a draft line must not submit or delete a saved invoice.');
    page.off('request', recordWrite);
    assert.deepEqual(await lines.evaluateAll(rows => rows.map(row => Array.from(row.querySelectorAll('input')).map(input => input.value))), remaining);
    assert.deepEqual(await editor.locator('[name]').evaluateAll(fields => fields.map(field => [field.name, field.value])), billFields);
    assert.equal(await editor.evaluate(el => el.scrollTop), scrollBeforeDelete, 'Deleting an item must not jump the form.');
    const totals = await editor.locator('.sale-totals span').allTextContents();
    assert.match(totals[0], /AED 12.50/);
    assert.match(totals[1], /AED 2.50/);
    assert.match(totals[2], /AED 10.00/);
    assert.match(totals[3], /AED 5.00/);
    assert.match(totals[4], /AED 5.00/);
    if (mobile) {
      assert.equal(await editor.locator('input').evaluateAll(inputs => inputs.every(input => parseFloat(getComputedStyle(input).fontSize) >= 16)), true, 'All input sizes must prevent iOS focus zoom.');
      const manualScroll = await editor.evaluate(el => { el.scrollTop += 30; return el.scrollTop; });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await editor.evaluate(el => el.scrollTop), manualScroll, 'Manual content scrolling must not snap back to the focused input.');
      await panel.locator('.sheet-close').click();
      await panel.waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.body.style.position !== 'fixed');
      assert.equal(await page.evaluate(() => document.body.style.position), '', 'Closing must restore body scrolling.');
      assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '', 'Closing must restore root scrolling.');
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log('Passed: ' + (mobile ? 'mobile ' + size.width + 'px with simulated keyboard viewport' : 'desktop') + ' focus, visibility, continuous entry, middle insertion, direct deletion, preserved bill fields, recalculated totals and stable scrolling.');
  }
} finally { await browser.close(); }
