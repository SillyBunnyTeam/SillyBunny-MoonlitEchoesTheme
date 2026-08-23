import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    applyPresetBackground,
    BUNDLED_BACKGROUND_ASSETS,
    getPresetBackgroundFilename,
    installBundledBackgrounds,
} from '../src/services/background-installer.js';
import { REGEX_AGENT_PRESETS } from '../src/config/regex-agent-presets.generated.js';

const backgroundsRoot = new URL('../backgrounds/', import.meta.url);

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

test('keeps background syncing off by default and skips existing files', async () => {
    const defaultSettingsSource = fs.readFileSync(new URL('../src/config/default-settings.js', import.meta.url), 'utf8');
    assert.match(defaultSettingsSource, /syncBackgroundWithPreset:\s*false/);
    assert(REGEX_AGENT_PRESETS.every(({ settings }) => !Object.hasOwn(settings, 'syncBackgroundWithPreset')));

    const originalFetch = globalThis.fetch;
    const originalSillyTavern = globalThis.SillyTavern;
    const calls = [];
    const context = {
        extensionSettings: {
            SillyTavernMoonlitEchoesTheme: { background: { name: 'keep.png' } },
        },
        getRequestHeaders: () => ({ 'X-CSRF-Token': 'test' }),
    };

    globalThis.SillyTavern = { getContext: () => context };
    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (String(url) === '/api/backgrounds/all') {
            return { ok: true, json: async () => ({ images: [{ filename: BUNDLED_BACKGROUND_ASSETS[0].filename }] }) };
        }
        if (String(url).startsWith('file:')) {
            return { ok: true, blob: async () => new Blob(['png'], { type: 'image/png' }) };
        }
        if (String(url) === '/api/backgrounds/upload') {
            return { ok: true };
        }
        throw new Error(`Unexpected request: ${url}`);
    };

    try {
        const result = await installBundledBackgrounds();
        assert.deepEqual(result, { installed: 157, skipped: 1 });
        assert.equal(calls.filter(({ url }) => url === '/api/backgrounds/upload').length, 157);
        assert.deepEqual(context.extensionSettings.SillyTavernMoonlitEchoesTheme.background, { name: 'keep.png' });
    } finally {
        globalThis.fetch = originalFetch;
        globalThis.SillyTavern = originalSillyTavern;
    }
});

test('does not query backgrounds while matching is unchecked', async () => {
    const originalFetch = globalThis.fetch;
    const originalSillyTavern = globalThis.SillyTavern;
    let fetchCalled = false;
    const presetName = REGEX_AGENT_PRESETS[0].name;

    globalThis.SillyTavern = {
        getContext: () => ({
            extensionSettings: {
                SillyTavernMoonlitEchoesTheme: {
                    activePreset: presetName,
                    syncBackgroundWithPreset: false,
                },
            },
        }),
    };
    globalThis.fetch = async () => {
        fetchCalled = true;
        throw new Error('background lookup should not run');
    };

    try {
        assert.equal(await applyPresetBackground(presetName), false);
        assert.equal(fetchCalled, false);
        assert.equal(await applyPresetBackground('User Preset'), false);
    } finally {
        globalThis.fetch = originalFetch;
        globalThis.SillyTavern = originalSillyTavern;
    }
});
