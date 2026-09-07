import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
    applyPresetBackground,
    BUNDLED_BACKGROUND_ASSETS,
    getPresetBackgroundFilename,
    installBundledBackgrounds,
} from '../src/services/background-installer.js';
import { REGEX_AGENT_PRESETS } from '../src/config/regex-agent-presets.generated.js';
import { settingsKey } from '../src/services/settings-service.js';

registerHooks({
    resolve(specifier, context, nextResolve) {
        let source;
        if (specifier.endsWith('/backgrounds.js')) source = `
            export let background_settings = {};
            export const setState = state => { background_settings = state; };
            export const getBackgroundPath = name => '/backgrounds/' + name;
        `;
        if (specifier.endsWith('/script.js')) source = `
            export let chat_metadata = {};
            export const setMetadata = value => { chat_metadata = value; };
            export const saveSettingsDebounced = () => globalThis.__backgroundTest.saves++;
        `;
        if (source) return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
        return nextResolve(specifier, context);
    },
});

const backgroundHost = await import('../backgrounds.js');
const scriptHost = await import('../script.js');

const backgroundsRoot = new URL('../backgrounds/', import.meta.url);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const allNames = BUNDLED_BACKGROUND_ASSETS.map(({ filename }) => filename);
const presetName = REGEX_AGENT_PRESETS[0].name;
const presetFilename = getPresetBackgroundFilename(presetName);

function setup(t, images = []) {
    const files = new Map(images.map(name => [name, 'personal file']));
    const calls = { requests: [], decoded: 0, closed: 0, saves: 0, styles: [], errors: [] };
    const settings = { enabled: true, activePreset: presetName, syncBackgroundWithPreset: true };
    const context = {
        extensionSettings: { [settingsKey]: settings },
        getRequestHeaders: options => options?.omitContentType
            ? { 'X-CSRF-Token': 'test' }
            : { 'X-CSRF-Token': 'test', 'Content-Type': 'application/json' },
    };
    const background = { name: 'keep.png', url: 'url("/backgrounds/keep.png")' };
    backgroundHost.setState(background);
    scriptHost.setMetadata({});
    const style = new Map([['background-image', background.url]]);
    const element = { style: {
        getPropertyValue: name => style.get(name) ?? '',
        setProperty: (name, value) => { style.set(name, value); calls.styles.push([name, value]); },
    } };
    const document = new EventTarget();
    document.querySelector = selector => selector === '#bg1' ? element : null;
    const environment = {
        __backgroundTest: calls,
        SillyTavern: { getContext: () => context },
        document,
        createImageBitmap: async blob => {
            calls.decoded++;
            assert.deepEqual(Buffer.from(await blob.arrayBuffer()), png);
            return { close: () => calls.closed++ };
        },
        fetch: async (url, options = {}) => {
            url = String(url);
            calls.requests.push({ url, options });
            if (url === '/api/backgrounds/all') {
                const images = [...files.keys()].map((filename, index) => index % 2 ? { filename } : filename);
                return { ok: true, json: async () => ({ images }) };
            }
            if (url.startsWith('file:')) return { ok: true, blob: async () => new Blob([png], { type: 'image/png' }) };
            if (url === '/api/backgrounds/upload-new') {
                const file = options.body.get('avatar');
                assert.equal(file.type, 'image/png');
                assert.equal(options.method, 'POST');
                assert.deepEqual(options.headers, { 'X-CSRF-Token': 'test' });
                if (files.has(file.name)) return { ok: false, status: 409 };
                files.set(file.name, file);
                return { ok: true, status: 201, text: async () => file.name };
            }
            throw new Error(`Unexpected request: ${url}`);
        },
    };
    for (const [name, value] of Object.entries(environment)) {
        const original = Object.getOwnPropertyDescriptor(globalThis, name);
        globalThis[name] = value;
        t.after(() => {
            if (original) Object.defineProperty(globalThis, name, original);
            else delete globalThis[name];
        });
    }
    t.mock.method(console, 'error', (...args) => calls.errors.push(args));
    return { files, calls, settings, context, background, document, element };
}

function deferInventory() {
    const started = Promise.withResolvers();
    const response = Promise.withResolvers();
    globalThis.fetch = async url => {
        assert.equal(url, '/api/backgrounds/all');
        started.resolve();
        return response.promise;
    };
    return { started: started.promise, resolve: (images = [presetFilename]) => response.resolve({ ok: true, json: async () => ({ images }) }) };
}

test('catalogues every bundled background asset', () => {
    assert.equal(BUNDLED_BACKGROUND_ASSETS.length, 158);
    assert.equal(new Set(BUNDLED_BACKGROUND_ASSETS.map(({ filename }) => filename)).size, 158);
    assert(BUNDLED_BACKGROUND_ASSETS.every(({ path }) => fs.existsSync(new URL(path, backgroundsRoot))));
});

test('maps catalog presets to matching scene backgrounds', () => {
    for (const { name } of REGEX_AGENT_PRESETS) {
        assert.equal(
            getPresetBackgroundFilename(name),
            `${name.replace(/^\[Moonlit\]\s*/, '').replace(/\s+-\s+by\s+.+$/, '').replace(/&/g, 'and').replace(/\s+/g, '-').toLowerCase()}-scene.png`,
        );
    }
    assert.equal(getPresetBackgroundFilename('[Moonlit] Marshmallow - by platberlitz'), 'marshmallow-scene.png');
    assert.equal(getPresetBackgroundFilename('User Preset'), null);
});

test('keeps background syncing off by default and skips existing files', async t => {
    const defaultSettingsSource = fs.readFileSync(new URL('../src/config/default-settings.js', import.meta.url), 'utf8');
    assert.match(defaultSettingsSource, /syncBackgroundWithPreset:\s*false/);
    assert(REGEX_AGENT_PRESETS.every(({ settings }) => !Object.hasOwn(settings, 'syncBackgroundWithPreset')));

    const { calls, files, background } = setup(t, [allNames[0]]);
    assert.deepEqual(await installBundledBackgrounds(), { installed: 157, skipped: 1 });
    assert.equal(calls.requests.filter(({ url }) => url === '/api/backgrounds/upload-new').length, 157);
    assert.equal(calls.decoded, 157);
    assert.equal(calls.closed, 157);
    assert.equal(files.get(allNames[0]), 'personal file');
    assert.equal(background.name, 'keep.png');
    assert.equal(calls.saves, 0);
    files.set(allNames[1], 'edited in another tab');
    assert.deepEqual(await installBundledBackgrounds(), { installed: 0, skipped: 158 });
    assert.equal(files.get(allNames[1]), 'edited in another tab');
    assert.equal(calls.requests.filter(({ url }) => url === '/api/backgrounds/all').length, 2);
});

test('concurrent installs count 409 conflicts without replacing personal or newly created files', async t => {
    const { calls, files } = setup(t);
    const fetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
        const response = await fetch(url, options);
        if (url === '/api/backgrounds/all') files.set(allNames[0], 'saved after inventory');
        return response;
    };
    const results = await Promise.all([installBundledBackgrounds(), installBundledBackgrounds()]);
    assert.equal(results.reduce((sum, result) => sum + result.installed, 0), 157);
    assert.equal(results.reduce((sum, result) => sum + result.skipped, 0), 159);
    assert.equal(files.get(allNames[0]), 'saved after inventory');
    assert.equal(files.size, 158);
    assert.equal(calls.decoded, calls.closed);
});

test('partial background install retries use fresh inventory and preserve later edits', async t => {
    const { calls, files } = setup(t);
    const fetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
        if (url === '/api/backgrounds/upload-new' && files.size === 2) return { ok: false, status: 500 };
        return fetch(url, options);
    };
    await assert.rejects(installBundledBackgrounds(), /Failed to upload/);
    assert.equal(files.size, 2);
    files.set(allNames[0], 'personal edit');
    globalThis.fetch = fetch;
    assert.deepEqual(await installBundledBackgrounds(), { installed: 156, skipped: 2 });
    assert.equal(files.get(allNames[0]), 'personal edit');
    assert.equal(calls.requests.filter(({ url }) => url === '/api/backgrounds/all').length, 2);
});

test('failed and malformed background inventories never become empty inventories', async t => {
    setup(t);
    for (const response of [
        { ok: false, status: 500 },
        { ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } },
        ...[null, {}, { images: null }, { images: {} }, { images: [null] }, { images: [1] },
            { images: [''] }, { images: ['  '] }, { images: [{}] }, { images: [{ filename: 1 }] },
            ...['../a.png', 'a/b.png', 'a\\b.png', '.', '..', 'a\0.png', 'a\n.png']
                .map(filename => ({ images: [filename] })),
            { images: ['valid.png', { filename: '' }] }]
            .map(data => ({ ok: true, json: async () => data })),
    ]) {
        const urls = [];
        globalThis.fetch = async (url, options) => {
            urls.push(url);
            assert.equal(options.cache, 'no-store');
            return response;
        };
        await assert.rejects(installBundledBackgrounds());
        assert.deepEqual(urls, ['/api/backgrounds/all']);
    }
});

test('rejects HTML, empty assets and every incorrect PNG signature byte before decode or upload', async t => {
    const { calls, files } = setup(t);
    const fetch = globalThis.fetch;
    const invalid = [Buffer.from('<html>not a PNG</html>'), Buffer.alloc(0), png.subarray(0, 7)];
    for (let index = 0; index < 8; index++) {
        const bytes = Buffer.from(png);
        bytes[index] ^= 1;
        invalid.push(bytes);
    }
    for (const bytes of invalid) {
        globalThis.fetch = async (url, options) => String(url).startsWith('file:')
            ? { ok: true, blob: async () => new Blob([bytes], { type: 'image/png' }) }
            : fetch(url, options);
        await assert.rejects(installBundledBackgrounds(), /Invalid PNG background/);
    }
    assert.equal(calls.decoded, 0);
    assert.equal(files.size, 0);
});

test('PNG signature alone is insufficient: native decode rejection prevents upload', async t => {
    const { files } = setup(t);
    const fetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => String(url).startsWith('file:')
        ? { ok: true, blob: async () => new Blob([png.subarray(0, 8)], { type: 'image/png' }) }
        : fetch(url, options);
    let decoded = false;
    globalThis.createImageBitmap = async blob => {
        decoded = true;
        assert.deepEqual(Buffer.from(await blob.arrayBuffer()), png.subarray(0, 8));
        throw new Error('truncated PNG');
    };
    await assert.rejects(installBundledBackgrounds(), error => /Unable to decode PNG/.test(error.message)
        && error.cause.message === 'truncated PNG');
    assert.equal(decoded, true);
    assert.equal(files.size, 0);
});

test('missing native decode support and failed asset reads fail without upload', async t => {
    const { files } = setup(t);
    globalThis.createImageBitmap = undefined;
    await assert.rejects(installBundledBackgrounds(), /requires a browser with createImageBitmap/);
    const fetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => String(url).startsWith('file:')
        ? { ok: false, status: 404 } : fetch(url, options);
    await assert.rejects(installBundledBackgrounds(), /Failed to read bundled background/);
    assert.equal(files.size, 0);
});

test('old host 404 and invalid success responses fail with no unsafe upload fallback', async t => {
    const { calls } = setup(t);
    const fetch = globalThis.fetch;
    for (const response of [
        { ok: false, status: 404 },
        { ok: true, status: 200 },
        { ok: true, status: 201, text: async () => 'wrong.png' },
    ]) {
        const uploads = [];
        globalThis.fetch = async (url, options) => {
            if (String(url).startsWith('/api/backgrounds/upload')) {
                uploads.push(url);
                return response;
            }
            return fetch(url, options);
        };
        await assert.rejects(installBundledBackgrounds(), response.status === 404
            ? /requires an updated.*host/ : /Failed to upload|Unexpected uploaded/);
        assert.deepEqual(uploads, ['/api/backgrounds/upload-new']);
    }
    assert.match(calls.errors[0][0], /requires an updated.*host/);
});

test('does not query backgrounds when disabled, unchecked, unknown or no longer active', async t => {
    const { settings, calls } = setup(t);
    for (const changes of [
        { enabled: false }, { enabled: true, syncBackgroundWithPreset: false },
        { syncBackgroundWithPreset: true, activePreset: 'Other' },
    ]) {
        Object.assign(settings, changes);
        assert.equal(await applyPresetBackground(presetName), false);
    }
    assert.equal(await applyPresetBackground('User Preset'), false);
    assert.equal(calls.requests.length, 0);
    assert.equal(calls.saves, 0);
});

test('manual selection during lazy imports cancels even when a chat lock hides the change', async t => {
    const { background, document, calls } = setup(t, [presetFilename]);
    const started = Promise.withResolvers();
    const loaded = Promise.withResolvers();
    calls.coldImport = { started, loaded, background };
    const hooks = registerHooks({
        resolve(specifier, context, nextResolve) {
            if (!specifier.endsWith('/backgrounds.js')) return nextResolve(specifier, context);
            const source = `
                const pending = globalThis.__backgroundTest.coldImport;
                pending.started.resolve();
                await pending.loaded.promise;
                export const background_settings = pending.background;
                export const getBackgroundPath = name => '/backgrounds/' + name;
            `;
            return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
        },
    });
    t.after(() => hooks.deregister());
    scriptHost.setMetadata({ custom_background: 'locked.png' });
    const applying = applyPresetBackground(presetName);
    await started.promise;
    document.dispatchEvent(new Event('click'));
    background.name = 'manual.png';
    background.url = 'url("manual.png")';
    loaded.resolve();
    assert.equal(await applying, false);
    assert.equal(background.name, 'manual.png');
    assert.equal(calls.requests.length, 0);
    assert.equal(calls.saves, 0);
    assert.deepEqual(calls.styles, []);
    for (const event of ['pointerdown', 'keydown', 'click', 'input', 'change']) {
        assert.equal(getEventListeners(document, event).length, 0);
    }
});

for (const change of ['disable', 'uncheck', 'preset', 'visible background']) {
    test(`${change} during imports cancels before inventory lookup`, async t => {
        const { settings, element, calls } = setup(t, [presetFilename]);
        const applying = applyPresetBackground(presetName);
        if (change === 'disable') settings.enabled = false;
        if (change === 'uncheck') settings.syncBackgroundWithPreset = false;
        if (change === 'preset') settings.activePreset = 'Other';
        if (change === 'visible background') element.style.setProperty('background-image', 'url("manual.png")');
        calls.styles.length = 0;
        assert.equal(await applying, false);
        assert.equal(calls.requests.length, 0);
        assert.equal(calls.saves, 0);
        assert.deepEqual(calls.styles, []);
    });
}

test('applies a matching background and saves once, but leaves a missing match untouched', async t => {
    const { calls, files, background } = setup(t);
    assert.equal(await applyPresetBackground(presetName), false);
    assert.equal(background.name, 'keep.png');
    assert.equal(calls.saves, 0);
    files.set(presetFilename, png);
    assert.equal(await applyPresetBackground(presetName), true);
    assert.equal(background.name, presetFilename);
    assert.equal(background.url, `url("/backgrounds/${presetFilename}")`);
    assert.deepEqual(calls.styles, [['background-image', background.url]]);
    assert.equal(calls.saves, 1);
});

test('uses the latest per-chat override at commit time', async t => {
    const { calls, background } = setup(t);
    const inventory = deferInventory();
    const applying = applyPresetBackground(presetName);
    await inventory.started;
    scriptHost.setMetadata({ custom_background: 'locked-after-lookup.png' });
    inventory.resolve();
    assert.equal(await applying, true);
    assert.equal(background.name, presetFilename);
    assert.deepEqual(calls.styles, []);
    assert.equal(calls.saves, 1);
});

test('malformed or failed matching inventory never writes background state', async t => {
    const { calls, background } = setup(t);
    for (const response of [{ ok: false }, { ok: true, json: async () => ({}) }]) {
        globalThis.fetch = async () => response;
        await assert.rejects(applyPresetBackground(presetName));
        assert.equal(background.name, 'keep.png');
        assert.equal(calls.saves, 0);
        assert.deepEqual(calls.styles, []);
    }
});

for (const change of ['disable', 'uncheck', 'preset', 'manual name', 'manual URL', 'state replacement']) {
    test(`${change} while inventory is pending cancels all background writes`, async t => {
        const { settings, background, calls } = setup(t);
        const inventory = deferInventory();
        const applying = applyPresetBackground(presetName);
        await inventory.started;
        if (change === 'disable') settings.enabled = false;
        if (change === 'uncheck') settings.syncBackgroundWithPreset = false;
        if (change === 'preset') settings.activePreset = 'Other';
        if (change === 'manual name') background.name = 'manual.png';
        if (change === 'manual URL') background.url = 'url("manual.png")';
        if (change === 'state replacement') backgroundHost.setState({ ...background });
        const before = { ...backgroundHost.background_settings };
        inventory.resolve();
        assert.equal(await applying, false);
        assert.deepEqual(backgroundHost.background_settings, before);
        assert.equal(calls.saves, 0);
        assert.deepEqual(calls.styles, []);
    });
}

test('newer same-preset lookup cancels older calls even when the newer lookup has no match', async t => {
    const { calls, background } = setup(t);
    const olderInventory = deferInventory();
    const older = applyPresetBackground(presetName);
    await olderInventory.started;
    const newerInventory = deferInventory();
    const newer = applyPresetBackground(presetName);
    await newerInventory.started;
    newerInventory.resolve([]);
    assert.equal(await newer, false);
    olderInventory.resolve();
    assert.equal(await older, false);
    assert.equal(background.name, 'keep.png');
    assert.equal(calls.saves, 0);
    assert.deepEqual(calls.styles, []);
});

test('newer same-preset success is the only call allowed to save', async t => {
    const { calls } = setup(t);
    const olderInventory = deferInventory();
    const older = applyPresetBackground(presetName);
    await olderInventory.started;
    const newerInventory = deferInventory();
    const newer = applyPresetBackground(presetName);
    await newerInventory.started;
    newerInventory.resolve();
    assert.equal(await newer, true);
    olderInventory.resolve();
    assert.equal(await older, false);
    assert.equal(calls.saves, 1);
    assert.equal(calls.styles.length, 1);
});
