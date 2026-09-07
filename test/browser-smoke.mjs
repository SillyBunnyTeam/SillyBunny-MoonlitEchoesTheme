// Opt-in: node test/browser-smoke.mjs [host checkout] [Playwright module path]
// No installs. Only a loopback static server and a disposable browser context.
import assert from 'node:assert/strict';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUNDLED_BACKGROUND_ASSETS } from '../src/services/background-installer.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = resolve(process.argv[2] || '/home/platinum/SillyBunny', 'public');
const playwrightPath = process.argv[3] || '/home/platinum/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
let playwright;
try { playwright = createRequire(import.meta.url)('playwright'); }
catch { playwright = await import(pathToFileURL(playwrightPath).href); }
const prefix = '/scripts/extensions/third-party/SillyBunny-MoonlitEchoesTheme/';
const png = (await Promise.all(BUNDLED_BACKGROUND_ASSETS.map(async asset => ({
    ...asset, bytes: (await stat(resolve(root, 'backgrounds', asset.path))).size,
})))).sort((a, b) => a.bytes - b.bytes)[0];
const pngPath = `${prefix}backgrounds/${png.path}`;
const violations = [];
const stubs = {
    '/scripts/i18n.js': 'export const t = String.raw;',
    '/scripts/power-user.js': 'export const power_user = SillyTavern.getContext().powerUserSettings; export const loadMovingUIState = () => smoke.movingLoads++;',
    '/scripts/RossAscends-mods.js': 'export const dragElement = element => smoke.dragCalls.push({ jquery: Boolean(element.jquery), id: element[0]?.id, handle: Boolean(document.getElementById(element[0]?.id + "header")) });',
};
const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/{2,}/g, '/');
        assert.equal(req.method, 'GET', 'Fixture rejects all writes');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'");
        if (Object.hasOwn(stubs, path)) {
            res.setHeader('Content-Type', 'text/javascript'); res.end(stubs[path]); return;
        }
        let base, relative;
        if (path === '/') { base = root; relative = 'test/fixtures/browser-smoke.html'; }
        else if (path === '/fixture-host-index') { base = host; relative = 'index.html'; }
        else if (path === pngPath) { base = root; relative = `backgrounds/${png.path}`; }
        else if (path.startsWith(prefix) && /\.(?:js|css)$/.test(path)) { base = root; relative = path.slice(prefix.length); }
        else if (path === '/style.css' || /^\/css\/[\w.-]+\.css$/.test(path)
            || path === '/lib/jquery-3.5.1.min.js' || path === '/lib/dialog-polyfill.css'
            || path === '/img/down-arrow.svg'
            || /^\/scripts\/extensions\/(?:quick-reply|guided-generations)\/style\.css$/.test(path)
            || /^\/(?:webfonts|fonts)\/[\w./-]+\.(?:woff2?|ttf)$/.test(path)) { base = host; relative = path.slice(1); }
        else throw new Error(`Not allowlisted: ${path}`);
        const file = await realpath(resolve(base, relative));
        assert.ok(file.startsWith((await realpath(base)) + sep), 'File must stay inside static root');
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(file)] || 'application/octet-stream');
        res.end(await readFile(file));
    } catch (error) {
        violations.push(`${req.method} ${req.url}: ${error.message}`);
        res.writeHead(403); res.end('Fixture request denied');
    }
});
let browser;
const results = [];
try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await playwright.chromium.launch({ headless: true });
    console.log(`Chromium ${browser.version()}; native CSS/markup: ${host}`);
    for (const width of [1440, 390, 320, 768, 1000, 1001]) {
        const mobile = width <= 1000;
        const name = `${mobile ? 'mobile' : 'desktop'} ${width}px`;
        const viewport = { width, height: mobile ? 844 : 1000 };
        const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
        await context.route('**/*', route => {
            const request = route.request();
            if (request.url().startsWith(origin + '/') && request.method() === 'GET') return route.continue();
            violations.push(`Blocked browser request: ${request.method()} ${request.url()}`);
            return route.abort();
        });
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        const check = async (label, action) => {
            try { await action(); results.push({ name, label, pass: true }); console.log(`PASS ${name}: ${label}`); }
            catch (error) { results.push({ name, label, pass: false }); console.error(`FAIL ${name}: ${label}\n${error.message}`); }
        };
        try {
            await page.goto(origin, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.smoke?.ready);
            if (width === 1440) for (const truncated of [false, true]) {
                await check(`native PNG decode: ${truncated ? 'truncated signature-preserving asset rejects before upload' : 'one bundled asset installs; 157 skipped'}`, async () => {
                    const result = await page.evaluate(async ({ prefix, pngPath, truncated }) => {
                        const { BUNDLED_BACKGROUND_ASSETS: assets, installBundledBackgrounds } = await import(`${prefix}src/services/background-installer.js`);
                        const asset = assets.find(asset => `${prefix}backgrounds/${asset.path}` === pngPath);
                        const originalFetch = window.fetch, nativeDecode = window.createImageBitmap;
                        const result = { inventories: 0, gets: 0, uploads: [], decodeCalls: 0, decoded: [], nativeDecoder: /\[native code\]/.test(Function.prototype.toString.call(nativeDecode)), inventorySize: assets.length - 1 };
                        try {
                            // Record calls, but use the real browser decoder and real ImageBitmap result.
                            window.createImageBitmap = async (...args) => {
                                result.decodeCalls++;
                                const image = await Reflect.apply(nativeDecode, window, args);
                                result.decoded.push({ nativeBitmap: image instanceof ImageBitmap, width: image.width, height: image.height });
                                return image;
                            };
                            window.fetch = async (input, options = {}) => {
                                const url = new URL(input instanceof Request ? input.url : input, location.href);
                                if (url.origin !== location.origin) throw new Error(`Unexpected origin: ${url.origin}`);
                                if (url.pathname === '/api/backgrounds/all' && options.method === 'POST') {
                                    result.inventories++;
                                    return Response.json({ images: assets.filter(item => item !== asset).map(item => item.filename) });
                                }
                                if (url.pathname === pngPath && (options.method || 'GET') === 'GET') {
                                    result.gets++;
                                    const response = await originalFetch(input, options);
                                    if (!response.ok) throw new Error(`Fixture PNG GET failed: ${response.status}`);
                                    const bytes = new Uint8Array(await response.arrayBuffer());
                                    result.originalBytes = bytes.length;
                                    const payload = truncated ? bytes.slice(0, 8) : bytes;
                                    result.signature = [...payload.slice(0, 8)]; result.payloadBytes = payload.length;
                                    return new Response(payload, { headers: { 'Content-Type': 'image/png' } });
                                }
                                if (url.pathname === '/api/backgrounds/upload-new' && options.method === 'POST') {
                                    const file = options.body.get('avatar');
                                    result.uploads.push({ filename: file.name, type: file.type, bytes: file.size, decodedBeforeUpload: result.decoded.length });
                                    return new Response(file.name, { status: 201 });
                                }
                                throw new Error(`Unexpected installer fetch: ${options.method || 'GET'} ${url.pathname}`);
                            };
                            try { result.install = await installBundledBackgrounds(); }
                            catch (error) { result.error = error.message; }
                        } finally {
                            window.fetch = originalFetch;
                            window.createImageBitmap = nativeDecode;
                        }
                        result.restored = window.fetch === originalFetch && window.createImageBitmap === nativeDecode;
                        return result;
                    }, { prefix, pngPath, truncated });
                    assert.equal(result.restored, true);
                    assert.equal(result.nativeDecoder, true);
                    assert.equal(result.inventorySize, 157);
                    assert.equal(result.inventories, 1); assert.equal(result.gets, 1); assert.equal(result.decodeCalls, 1);
                    assert.equal(result.originalBytes, png.bytes);
                    assert.deepEqual(result.signature, [137, 80, 78, 71, 13, 10, 26, 10]);
                    if (truncated) {
                        assert.match(result.error, /Unable to decode PNG background/);
                        assert.equal(result.payloadBytes, 8);
                        assert.deepEqual(result.uploads, []); assert.deepEqual(result.decoded, []);
                        assert.equal(result.install, undefined);
                    } else {
                        assert.equal(result.error, undefined);
                        assert.deepEqual(result.install, { installed: 1, skipped: 157 });
                        assert.deepEqual(result.uploads, [{ filename: png.filename, type: 'image/png', bytes: png.bytes, decodedBeforeUpload: 1 }]);
                        assert.equal(result.decoded.length, 1);
                        assert.ok(result.decoded[0].nativeBitmap && result.decoded[0].width > 0 && result.decoded[0].height > 0, JSON.stringify(result));
                        console.log(`Native PNG decode: ${png.filename}, ${png.bytes} bytes, ${result.decoded[0].width}x${result.decoded[0].height}`);
                    }
                });
            }
            await page.locator('#moonlit_sidebar_button').click();
            await page.waitForFunction(() => document.activeElement?.matches('#moonlit_echoes_popout .dragClose'));
            await check('settings render with labelled inputs', async () => {
                assert.equal(await page.evaluate(() => innerWidth), width, 'Layout viewport must match the requested boundary');
                assert.equal(await page.locator('.moonlit-tab-button').count(), 3);
                assert.ok(await page.locator('.theme-setting-item input').count() > 50);
                assert.deepEqual(await page.locator('.theme-setting-item input, .theme-setting-item select, .theme-setting-item textarea').evaluateAll(nodes => nodes.filter(node => !node.getAttribute('aria-label') && !document.getElementById(node.getAttribute('aria-labelledby'))).map(node => node.id)), []);
            });
            await check('popout fits viewport and settings scroll vertically', async () => {
                const dimensions = await page.locator('#moonlit_echoes_popout').evaluate(node => {
                    const box = node.getBoundingClientRect(), content = node.querySelector('#moonlit_echoes_content_container');
                    content.scrollTop = 100;
                    return { left: box.left, right: box.right, bottom: box.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, scroll: content.scrollTop };
                });
                assert.ok(dimensions.left >= -1 && dimensions.right <= dimensions.viewportWidth + 1 && dimensions.bottom <= dimensions.viewportHeight + 1 && dimensions.scroll > 0, JSON.stringify(dimensions));
            });
            await check('section Enter/Space, inert and focus exclusion', async () => {
                const toggle = page.locator('#moonlit-section-background-effects button');
                const content = page.locator('#moonlit-section-content-background-effects');
                await toggle.focus();
                if (await toggle.getAttribute('aria-expanded') === 'true') await page.keyboard.press('Space');
                assert.equal(await content.evaluate(node => node.inert), true);
                await content.locator('input').first().evaluate(node => node.focus());
                assert.equal(await toggle.evaluate(node => node === document.activeElement), true);
                await page.keyboard.press('Enter');
                assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
                assert.equal(await content.evaluate(node => node.inert), false);
                await page.keyboard.press('Tab');
                assert.equal(await content.evaluate(node => node.contains(document.activeElement)), true);
                await toggle.focus(); await page.keyboard.press('Space');
                assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
                await page.keyboard.press('Tab');
                assert.equal(await content.evaluate(node => node.contains(document.activeElement)), false);
                await toggle.focus(); await page.keyboard.press('Enter');
            });
            await check('numeric rejection and zero persistence', async () => {
                const input = page.locator('#cts-number-customCSS-bg-blur');
                const initialSaves = await page.evaluate(() => smoke.saves);
                for (const value of ['', '999', '-1', '0.5']) {
                    await input.fill(value); await input.press('Tab');
                    assert.equal(await input.inputValue(), '0', `reject ${JSON.stringify(value)}`);
                    assert.equal(await page.locator('#cts-slider-customCSS-bg-blur').inputValue(), '0');
                }
                await input.fill(''); await input.pressSequentially('e'); await input.press('Tab');
                assert.equal(await input.inputValue(), '0', 'reject non-numeric draft');
                assert.equal(await page.evaluate(() => smoke.saves), initialSaves);
                for (const value of ['10', '0']) { await input.fill(value); await input.press('Tab'); }
                assert.deepEqual(await page.evaluate(() => [smoke.settings['customCSS-bg-blur'], smoke.settings.presets[smoke.settings.activePreset]['customCSS-bg-blur']]), ['0', '0']);
            });
            await check('invalid colour restores saved picker/preview/opacity/thumb', async () => {
                const input = page.locator('#cts-customThemeColor-text');
                const initialSaves = await page.evaluate(() => smoke.saves);
                await input.fill('#0000ff');
                assert.equal(await page.locator('#cts-customThemeColor-color').inputValue(), '#0000ff');
                await input.fill('#0000ff-invalid'); await input.press('Tab');
                assert.equal(await input.inputValue(), '#ff0000');
                assert.equal(await page.locator('#cts-customThemeColor-color').inputValue(), '#ff0000');
                assert.equal(await page.locator('#cts-customThemeColor-alpha').inputValue(), '25');
                assert.equal(await page.locator('#cts-customThemeColor-alpha-value').textContent(), '25');
                assert.equal(await page.locator('#cts-customThemeColor-preview').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(255, 0, 0, 0.25)');
                assert.match(await page.locator('#thumb-style-customThemeColor').textContent(), /#ff0000/);
                assert.deepEqual(await page.evaluate(() => [smoke.saves, smoke.settings.customThemeColor]), [initialSaves, 'rgba(255, 0, 0, 0.25)']);
            });
            await check('raw CSS saved but not applied while disabled; enable restores it', async () => {
                await page.locator('#SillyTavernMoonlitEchoesTheme-enabled').uncheck();
                const raw = page.locator('#cts-rawCustomCss');
                await raw.evaluate(node => {
                    node.value = ':root { --fixture-raw: enabled; }';
                    node.dispatchEvent(new Event('input', { bubbles: true }));
                    node.dispatchEvent(new Event('change', { bubbles: true }));
                });
                assert.equal(await page.locator('#moonlit-raw-css').count(), 0);
                assert.equal(await page.evaluate(() => smoke.settings.presets[smoke.settings.activePreset].rawCustomCss), ':root { --fixture-raw: enabled; }');
                await page.locator('#SillyTavernMoonlitEchoesTheme-enabled').check();
                await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--fixture-raw').trim() === 'enabled');
            });
            await check('popout close focus, same nodes and single mocked drag setup', async () => {
                await page.evaluate(() => { smoke.contentNode = document.querySelector('#moonlit_echoes_content_container > .inline-drawer-content'); });
                for (let i = 0; i < 3; i++) {
                    await page.locator('#moonlit_echoes_popout .dragClose').click();
                    await page.waitForFunction(() => document.activeElement?.id === 'moonlit_sidebar_button');
                    assert.equal(await page.locator('#moonlit_echoes_popout').evaluate(node => node.inert), true);
                    await page.locator('#moonlit_sidebar_button').press('Enter');
                    await page.waitForFunction(() => document.activeElement?.matches('#moonlit_echoes_popout .dragClose'));
                    assert.equal(await page.evaluate(() => smoke.contentNode === document.querySelector('#moonlit_echoes_content_container > .inline-drawer-content')), true);
                    assert.equal(await page.locator('#moonlit_echoes_popout').count(), 1);
                }
                assert.deepEqual(await page.evaluate(() => smoke.dragCalls), [{ jquery: true, id: 'moonlit_echoes_popout', handle: true }]);
                await page.keyboard.press('Escape');
                await page.waitForFunction(() => document.activeElement?.id === 'moonlit_sidebar_button');
            });
            // Exercise the actual CSS for every native body class, without running host settings writes.
            const classes = ['flatchat', 'bubblechat', 'documentstyle', 'echostyle', 'whisperstyle', 'hushstyle', 'ripplestyle', 'tidestyle'];
            await page.evaluate(() => document.documentElement.style.setProperty('--messageLineHeight', '31px'));
            for (const style of classes) {
                await page.evaluate(({ style, classes }) => { document.body.classList.remove(...classes); document.body.classList.add(style); }, { style, classes });
                // Wait for real CSS transitions rather than sampling interpolated avatar sizes.
                await page.locator('#chat').evaluate(async node => {
                    void node.offsetHeight;
                    await Promise.all(node.getAnimations({ subtree: true }).filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
                });
                await check(`${style}: native/explicit line height and paragraph/list consistency`, async () => {
                    for (const value of ['2', '']) {
                        await page.evaluate(value => {
                            smoke.settings.messageLineHeight = value;
                            smoke.entry.applyThemeSetting('messageLineHeight', value);
                            smoke.settings.mesParagraphSpacingTop = '0.7em'; smoke.settings.mesParagraphSpacingBottom = '0.9em';
                            smoke.entry.applyAllThemeSettings();
                        }, value);
                        const samples = await page.locator('#chat .mes_text').evaluateAll(nodes => nodes.map(node => {
                            const css = getComputedStyle(node);
                            const probe = document.createElement('span');
                            probe.style.lineHeight = innerWidth <= 1000 ? 'calc(var(--mainFontSize) + var(--lineSpacingMobileLeading, .35rem))' : 'calc(var(--mainFontSize) + var(--lineSpacingDesktopLeading, .5rem))';
                            document.body.append(probe);
                            const native = parseFloat(getComputedStyle(probe).lineHeight); probe.remove();
                            const paragraph = getComputedStyle(node.querySelector('p'));
                            return { font: parseFloat(css.fontSize), line: parseFloat(css.lineHeight), children: [...node.querySelectorAll('p, li, em')].map(child => parseFloat(getComputedStyle(child).lineHeight)), top: parseFloat(paragraph.marginTop), bottom: parseFloat(paragraph.marginBottom), native };
                        }));
                        for (const sample of samples) {
                            const expected = value === '2' ? sample.font * 2 : sample.native;
                            assert.ok(Math.abs(sample.line - expected) < 0.1, `${value}: ${JSON.stringify(sample)} expected ${expected}`);
                            assert.ok(sample.children.every(line => Math.abs(line - sample.line) < 0.1), JSON.stringify(sample));
                            assert.ok(Math.abs(sample.top - sample.font * 0.7) < 0.1 && Math.abs(sample.bottom - sample.font * 0.9) < 0.1, JSON.stringify(sample));
                        }
                    }
                });
                await check(`${style}: previous/next controls stay inside message without overlap`, async () => {
                    const box = await page.locator('#chat .last_mes').evaluate(node => {
                        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
                        return { message: rect(node), left: rect(node.querySelector('.swipe_left')), right: rect(node.querySelector('.swipe_right')), counter: rect(node.querySelector('.swipes-counter')) };
                    });
                    for (const control of [box.left, box.right, box.counter]) {
                        assert.ok(control.width > 0 && control.height > 0, JSON.stringify(box));
                        assert.ok(control.x >= box.message.x - 1 && control.right <= box.message.right + 1 && control.y >= box.message.y - 1 && control.bottom <= box.message.bottom + 1, JSON.stringify(box));
                    }
                    assert.ok(box.left.right <= box.right.x + 1 || box.right.right <= box.left.x + 1, JSON.stringify(box));
                    assert.ok(Math.abs((box.left.y + box.left.height / 2) - (box.right.y + box.right.height / 2)) < 1, JSON.stringify(box));
                    if (style === 'ripplestyle') {
                        const avatar = await page.locator('#chat .last_mes .mesAvatarWrapper .avatar').evaluate(node => {
                            const rect = node.getBoundingClientRect(); const img = node.querySelector('img').getBoundingClientRect();
                            const root = getComputedStyle(document.documentElement);
                            const localMobileWidth = getComputedStyle(node).getPropertyValue('--moonlit-sb-ripple-avatar-mobile-width').trim();
                            // The host deliberately caps phone avatars; verify its resolved local contract.
                            const probe = document.createElement('div'); probe.style.width = localMobileWidth; document.body.append(probe);
                            const expectedWidth = innerWidth <= 1000 ? probe.getBoundingClientRect().width : parseFloat(root.getPropertyValue('--customRippleAvatarWidth'));
                            probe.remove();
                            return { width: rect.width, height: rect.height, imageWidth: img.width, imageHeight: img.height, expectedWidth, localMobileWidth, ratio: parseFloat(root.getPropertyValue('--customRippleAvatarRatio')) };
                        });
                        assert.ok(Math.abs(avatar.width - avatar.expectedWidth) < 1 && Math.abs(avatar.height - avatar.width * avatar.ratio) < 1, JSON.stringify(avatar));
                        assert.ok(Math.abs(avatar.imageWidth - avatar.width) < 1 && Math.abs(avatar.imageHeight - avatar.height) < 1, JSON.stringify(avatar));
                        console.log(`Ripple avatar ${name}: ${JSON.stringify(avatar)}`);
                    }
                });
            }
            await check('popup horizontal overflow remains scrollable', async () => {
                const dimensions = await page.evaluate(() => {
                    const dialog = document.createElement('dialog');
                    dialog.className = 'popup horizontal_scrolling_dialogue_popup';
                    dialog.innerHTML = '<div class="popup-body"><div class="popup-content"><div style="width:1600px;height:80px">Wide fixture content</div></div></div>';
                    document.body.append(dialog); dialog.showModal();
                    const content = dialog.querySelector('.popup-content'); content.scrollLeft = 100;
                    const result = { overflow: getComputedStyle(content).overflowX, scroll: content.scrollLeft, width: content.clientWidth, full: content.scrollWidth };
                    dialog.close(); dialog.remove(); return result;
                });
                assert.equal(dimensions.overflow, 'auto');
                assert.ok(dimensions.full > dimensions.width && dimensions.scroll > 0, JSON.stringify(dimensions));
            });
            if (mobile) await check('multiple QR sets scroll on outer bar; hidden InputHistory stays hidden', async () => {
                await page.evaluate(() => {
                    smoke.settings['enableMobile-horizontal_qrs'] = true;
                    smoke.factory.updateAllCheckboxStyles(true);
                });
                const qr = await page.locator('#qr--bar').evaluate(bar => {
                    bar.scrollLeft = 0;
                    const start = bar.querySelector('[data-name="Fixture A"]').getBoundingClientRect().left;
                    bar.scrollLeft = 200;
                    return { overflow: getComputedStyle(bar).overflowX, width: bar.clientWidth, full: bar.scrollWidth, scroll: bar.scrollLeft, moved: start - bar.querySelector('[data-name="Fixture A"]').getBoundingClientRect().left, hidden: getComputedStyle(bar.firstElementChild).display, sets: [...bar.children].slice(1).map(node => ({ wrap: getComputedStyle(node).flexWrap, top: node.getBoundingClientRect().top })) };
                });
                assert.equal(qr.overflow, 'auto'); assert.equal(qr.hidden, 'none');
                assert.ok(qr.full > qr.width && qr.scroll > 0 && qr.moved > 0, JSON.stringify(qr));
                assert.ok(qr.sets.every(set => set.wrap === 'nowrap'), JSON.stringify(qr));
                assert.ok(Math.abs(qr.sets[0].top - qr.sets[1].top) < 1, JSON.stringify(qr));
            });
            await check('disable removes extension CSS/variables, preserves native line height, stops observers', async () => {
                await page.evaluate(() => {
                    smoke.entry.applyThemeSetting('messageLineHeight', '1.8');
                    smoke.entry.applyThemeSetting('customThemeColor', 'rgb(1, 2, 3)');
                    smoke.settings.enabled = false; smoke.entry.toggleCss(false);
                });
                assert.equal(await page.locator('#MoonlitEchosTheme-style, #MoonlitEchosTheme-extension, #MoonlitEchosTheme-chat-styles, #dynamic-theme-styles, #moonlit-raw-css').count(), 0);
                assert.equal(await page.locator('style[id^="css-block-"]').evaluateAll(nodes => nodes.every(node => node.textContent === '')), true);
                assert.deepEqual(await page.evaluate(() => ({ alias: document.documentElement.style.getPropertyValue('--moonlit-message-line-height'), colour: document.documentElement.style.getPropertyValue('--customThemeColor'), native: document.documentElement.style.getPropertyValue('--messageLineHeight'), form: document.documentElement.style.getPropertyValue('--formSheldHeight'), avatarUpdater: Boolean(window.updateAvatars), formController: Boolean(window.formSheldHeightController) })), { alias: '', colour: '', native: '31px', form: '', avatarUpdater: false, formController: false });
            });
            await check('disabled native Flat next arrow remains inside message (comparison)', async () => {
                await page.evaluate(classes => { document.body.classList.remove(...classes); document.body.classList.add('flatchat'); }, classes);
                const box = await page.locator('#chat .last_mes').evaluate(node => ({ messageRight: node.getBoundingClientRect().right, arrowRight: node.querySelector('.swipe_right').getBoundingClientRect().right }));
                assert.ok(box.arrowRight <= box.messageRight + 1, JSON.stringify(box));
            });
            await check('no browser console errors', async () => assert.deepEqual(errors, []));
        } catch (error) {
            results.push({ name, label: 'fixture setup/completion', pass: false });
            console.error(`FAIL ${name}: ${error.message}\nConsole: ${JSON.stringify(errors)}`);
        } finally { await context.close(); }
    }
    assert.deepEqual(violations, [], 'No unapproved network/static requests');
    console.log(`${results.filter(result => result.pass).length}/${results.length} checks passed`);
    if (results.some(result => !result.pass)) process.exitCode = 1;
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    console.log('Disposable browser closed; loopback fixture server stopped.');
}
