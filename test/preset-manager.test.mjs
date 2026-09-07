import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.endsWith('/i18n.js')) {
            return { url: 'data:text/javascript,export const t = String.raw;', shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});

const manager = await import('../src/ui/preset-manager.js');
const { themeCustomSettings } = await import('../src/config/theme-settings.js');
const { defaultSettings } = await import('../src/config/default-settings.js');
const { settingsKey } = await import('../src/services/settings-service.js');

class Element extends EventTarget {
    constructor(tagName) {
        super();
        Object.assign(this, { tagName, children: [], style: {}, attributes: {}, value: '', disabled: false });
        this.classList = { add() {} };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html || ''; }
    get options() { return this.children; }
    appendChild(child) {
        child.parent = this;
        this.children.push(child);
        if (this.tagName === 'select' && child.selected) this.value = child.value;
        return child;
    }
    remove() { this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
}

function setup() {
    const definitions = [...themeCustomSettings];
    const defaults = Object.fromEntries(definitions.map(({ varId, default: value }) => [varId, value]));
    const settings = {
        ...defaults,
        enabled: true,
        syncBackgroundWithPreset: false,
        activePreset: 'Saved',
        presets: { Saved: { ...defaults }, Other: { ...defaults } },
    };
    const calls = { saves: 0, themes: [], applied: [], all: 0, ui: 0, errors: [], successes: [], prompts: [] };
    const body = new Element('body');
    const find = (element, id) => element.id === id ? element : element.children.map(child => find(child, id)).find(Boolean);
    globalThis.document = {
        body,
        createElement: tag => new Element(tag),
        getElementById: id => find(body, id) || null,
    };
    const themes = body.appendChild(new Element('select'));
    themes.id = 'themes';
    for (const value of ['Saved', 'Other']) themes.appendChild(Object.assign(new Element('option'), { value }));
    themes.value = 'Saved';
    const context = {
        extensionSettings: { [settingsKey]: settings },
        powerUserSettings: { theme: 'Saved' },
        saveSettingsDebounced: () => calls.saves++,
        POPUP_RESULT: { AFFIRMATIVE: 1 },
        Popup: { show: { confirm: async (...args) => { calls.prompts.push(args); return 0; } } },
    };
    globalThis.SillyTavern = { getContext: () => context };
    globalThis.toastr = { error: message => calls.errors.push(message), success: message => calls.successes.push(message) };
    globalThis.fetch = () => { throw new Error('Tests must not access the host or network'); };
    // Only the browser CSS parser is substituted; literal colour parsing uses the real utility.
    const cssColours = new Set(['transparent', 'rebeccapurple', 'var(--accent)', 'hsl(120 50% 50%)']);
    for (const preset of Object.values(defaultSettings.presets)) {
        for (const { varId, type } of definitions) if (type === 'color') cssColours.add(preset[varId]);
    }
    globalThis.CSS = { supports: (property, value) => property === 'color' && cssColours.has(value) };
    manager.configurePresetManager({
        settingsKey,
        themeCustomSettings: definitions,
        applyThemeSetting: (...args) => calls.applied.push(args),
        applyAllThemeSettings: () => calls.all++,
        updateSettingsUI: () => calls.ui++,
        updateThemeSelector: name => {
            calls.themes.push(name);
            themes.value = name;
            context.powerUserSettings.theme = name;
        },
    });
    const state = () => JSON.stringify({
        settings: context.extensionSettings[settingsKey], native: context.powerUserSettings,
        selection: themes.value, saves: calls.saves, themes: calls.themes,
        applied: calls.applied, all: calls.all, ui: calls.ui,
    });
    return { settings, calls, context, themes, definitions, state };
}

const presetFile = (settings, presetName = 'Imported') => ({ moonlitEchoesPreset: true, presetName, settings });

test('invalid snapshots never mutate presets, active settings, native selection, or save counts', () => {
    const { settings, calls, state } = setup();
    const cycle = {};
    cycle.self = cycle;
    let accessorReads = 0;
    const accessor = { get customThemeColor() { accessorReads++; return '#123456'; } };
    const invalid = [
        null, [], new Date(),
        ...['false', 0, null, {}].map(value => ({ hideAvatarBorder: value })),
        ...['', ' ', 'NaN', 'Infinity', NaN, Infinity, -1, 11, false, [], {}].map(value => ({ 'customCSS-bg-blur': value })),
        ...[null, 1, {}, 'not-a-colour'].map(value => ({ customThemeColor: value })),
        ...[null, 2, {}, [], 'sideways'].map(value => ({ customWhisperAvatarAlign: value })),
        { messageLineHeight: {} }, { rawCustomCss: 1 },
        cycle, { legacy: cycle }, { legacy: 1n }, { legacy: Infinity },
        { legacy: undefined }, { legacy: () => {} }, { legacy: Symbol('value') },
        { legacy: new Map() }, { legacy: new Date() }, { [Symbol('key')]: 1 },
        { legacy: Array(1) }, { legacy: Object.assign([1], { extra: 2 }) },
        { toJSON: () => ({}) }, accessor,
        JSON.parse('{"__proto__":{"polluted":true}}'),
        JSON.parse('{"legacy":{"constructor":{"prototype":{"polluted":true}}}}'),
    ];
    const before = state();
    const stored = settings.presets.Saved;
    for (const [index, badSettings] of invalid.entries()) {
        assert.equal(manager.upsertPresetSnapshot('Saved', badSettings, { activate: true }), null, `upsert case ${index}`);
        assert.equal(manager.importPresetSnapshot(presetFile(badSettings, 'Saved'), { overwrite: true }), null, `import case ${index}`);
        assert.equal(state(), before, `state after case ${index}`);
        assert.equal(settings.presets.Saved, stored);
    }
    assert.equal(accessorReads, 0);
    assert.equal(calls.saves, 0);
    assert.equal({}.polluted, undefined);
});

test('valid CSS, numeric strings, custom definitions, and unknown JSON fields survive without aliasing', () => {
    const { settings, definitions } = setup();
    definitions.push(
        { varId: 'customSlider', type: 'slider', min: -2, max: 2, default: 0 },
        { varId: 'customSelect', type: 'select', options: [{ value: 0 }, { value: 1 }], default: 0 },
    );
    const rawCustomCss = '@import url("https://example.invalid/font.css"); body { color: red; }';
    const values = {
        messageLineHeight: 'calc(var(--mainFontSize) + .5rem)',
        customlastInContext: '3px solid color-mix(in srgb, var(--accent), transparent)',
        customThemeColor: 'var(--accent)', 'customCSS-bg-blur': '0',
        customSlider: '-1.5', customSelect: 1, rawCustomCss,
        legacy: { nested: [null, true, 42, 'keep me'] }, syncBackgroundWithPreset: true,
    };
    assert.equal(manager.importPresetSnapshot(presetFile(values)), 'Imported');
    assert.equal(settings.presets.Imported.rawCustomCss, rawCustomCss);
    assert.equal(settings.presets.Imported['customCSS-bg-blur'], '0');
    assert.equal(settings.presets.Imported.customSlider, '-1.5');
    assert.equal(Object.hasOwn(settings.presets.Imported, 'syncBackgroundWithPreset'), false);
    assert.equal(settings.syncBackgroundWithPreset, false);
    values.legacy.nested[3] = 'changed outside the manager';
    assert.equal(settings.presets.Imported.legacy.nested[3], 'keep me');
    assert.equal(manager.upsertPresetSnapshot('Invalid custom slider', { customSlider: 3 }), null);
    assert.equal(manager.upsertPresetSnapshot('Invalid custom select', { customSelect: 2 }), null);
    assert.equal(manager.upsertPresetSnapshot('String option', { customSelect: '1' }), 'String option');
});

test('every bundled preset still passes the configured setting boundary', () => {
    setup();
    for (const [name, settings] of Object.entries(defaultSettings.presets)) {
        const validated = manager.validatePresetImportData(presetFile(settings, name));
        assert.ok(validated, name);
        assert.deepEqual(validated.settings, settings, name);
    }
});

test('names and envelope data are safe while historical stored whitespace names remain usable', () => {
    const { settings, state } = setup();
    settings.presets['  Historical  '] = { messageLineHeight: '' };
    for (const name of ['__proto__', 'constructor', 'prototype', '[Moonlit] __proto__', ' ', '[Moonlit] ']) {
        assert.equal(manager.importPresetSnapshot(presetFile({}, name), { overwrite: true }), null, name);
    }
    assert.equal(manager.importPresetSnapshot(presetFile({}, '  Historical  ')), null);
    assert.equal(manager.importPresetSnapshot(presetFile({}, '  Historical  '), { overwrite: true, activate: false }), '  Historical  ');
    assert.equal(manager.importPresetSnapshot(presetFile({}, '[Moonlit] New Name')), 'New Name');
    const before = state();
    const cyclicEnvelope = presetFile({});
    cyclicEnvelope.extra = cyclicEnvelope;
    assert.equal(manager.importPresetSnapshot(cyclicEnvelope), null);
    assert.equal(manager.importPresetSnapshot({ ...presetFile({}), extra: 1n }), null);
    assert.equal(manager.importPresetSnapshot({ ...presetFile({}), moonlitEchoesPreset: 'yes' }), null);
    assert.equal(state(), before);
});

test('imports reject collisions by default while explicit overwrite and upsert keep update semantics', () => {
    const { settings, calls, state } = setup();
    const data = presetFile({ 'customCSS-bg-blur': '2' }, '[Moonlit] Saved');
    const before = state();
    assert.equal(manager.importPresetSnapshot(data), null);
    assert.equal(manager.importPresetSnapshot(data, { overwrite: 'true' }), null);
    assert.equal(state(), before);
    assert.equal(manager.importPresetSnapshot(data, { overwrite: true, activate: false }), 'Saved');
    assert.equal(settings.activePreset, 'Saved');
    assert.equal(settings['customCSS-bg-blur'], '2');
    assert.equal(calls.saves, 1);
    assert.equal(calls.ui, 1);
    assert.equal(manager.upsertPresetSnapshot('Saved', { 'customCSS-bg-blur': 3 }), 'Saved');
    assert.equal(settings['customCSS-bg-blur'], 3);
    assert.equal(calls.saves, 2);
});

test('UI imports need explicit confirmation for collisions or raw CSS, never for a new no-CSS preset', async () => {
    const { calls, context, state, settings } = setup();
    for (const result of [0, null, undefined, 1001]) {
        context.Popup.show.confirm = async () => result;
        const before = state();
        assert.equal(await manager.handleMoonlitPresetImport(presetFile({}, 'Saved')), false);
        assert.equal(state(), before);
    }
    context.Popup.show.confirm = async (...args) => { calls.prompts.push(args); return 0; };
    const beforeCss = state();
    assert.equal(await manager.handleMoonlitPresetImport(presetFile({ rawCustomCss: 'body { display: none; }' })), false);
    assert.equal(state(), beforeCss);
    assert.equal(calls.prompts.length, 1);
    assert.match(calls.prompts[0][1], /raw CSS/);
    assert.equal(await manager.handleMoonlitPresetImport(presetFile({ rawCustomCss: '  ' })), true);
    assert.equal(calls.prompts.length, 1);
    assert.equal(calls.saves, 1);
    const unsafeName = '<img src=x onerror=alert(1)>';
    settings.presets[unsafeName] = {};
    context.Popup.show.confirm = async (...args) => { calls.prompts.push(args); return 1; };
    assert.equal(await manager.handleMoonlitPresetImport(presetFile({}, unsafeName)), true);
    assert.match(calls.prompts.at(-1)[1], /&lt;img/);
    assert.doesNotMatch(calls.prompts.at(-1)[1], /<img/);
    const rawCustomCss = '@import url("https://example.invalid/font.css"); body { color: red; }';
    assert.equal(await manager.handleMoonlitPresetImport(presetFile({ rawCustomCss }, 'Trusted CSS')), true);
    assert.equal(settings.presets['Trusted CSS'].rawCustomCss, rawCustomCss);
    assert.match(calls.prompts.at(-1)[1], /raw CSS/);
    const beforeFailure = state();
    context.Popup.show.confirm = async () => { throw new Error('Popup failed'); };
    assert.equal(await manager.handleMoonlitPresetImport(presetFile({}, 'Saved')), false);
    assert.equal(state(), beforeFailure);
});

test('pending import confirmations cannot overwrite intervening edits, replaced settings, or native choices', async () => {
    const changes = [
        ({ settings }) => { settings.presets.Saved.messageLineHeight = '2em'; },
        ({ settings }) => { settings.activePreset = 'Other'; },
        ({ settings }) => { settings.enabled = false; },
        ({ settings }) => { delete settings.presets.Saved; },
        ({ context }) => { context.extensionSettings[settingsKey] = structuredClone(context.extensionSettings[settingsKey]); },
        ({ context }) => { context.powerUserSettings.theme = 'Other'; },
        ({ themes }) => { themes.value = 'Other'; },
    ];
    for (const change of changes) {
        const fixture = setup();
        const confirmation = Promise.withResolvers();
        fixture.context.Popup.show.confirm = () => confirmation.promise;
        const pending = manager.handleMoonlitPresetImport(presetFile({}, 'Saved'));
        change(fixture);
        const afterEdit = fixture.state();
        confirmation.resolve(1);
        assert.equal(await pending, false);
        assert.equal(fixture.state(), afterEdit);
        assert.match(fixture.calls.errors.at(-1), /Settings changed/);
    }

    const { settings, context, state } = setup();
    const confirmation = Promise.withResolvers();
    context.Popup.show.confirm = () => confirmation.promise;
    const pending = manager.handleMoonlitPresetImport(presetFile({ rawCustomCss: 'body { color: red; }' }));
    settings.presets.Imported = { messageLineHeight: '2em' };
    const afterCreation = state();
    confirmation.resolve(1);
    assert.equal(await pending, false);
    assert.equal(state(), afterCreation);
});

test('UI confirmation imports the validated copy and rechecks newly registered setting definitions', async () => {
    const { settings, context, definitions, state } = setup();
    let confirmation = Promise.withResolvers();
    context.Popup.show.confirm = () => confirmation.promise;
    const data = presetFile({ 'customCSS-bg-blur': '2' }, 'Saved');
    const pending = manager.handleMoonlitPresetImport(data);
    data.settings['customCSS-bg-blur'] = 9;
    confirmation.resolve(1);
    assert.equal(await pending, true);
    assert.equal(settings.presets.Saved['customCSS-bg-blur'], '2');

    confirmation = Promise.withResolvers();
    const invalidated = manager.handleMoonlitPresetImport(presetFile({ newSetting: 'not a checkbox' }, 'Saved'));
    definitions.push({ varId: 'newSetting', type: 'checkbox', default: false });
    const before = state();
    confirmation.resolve(1);
    assert.equal(await invalidated, false);
    assert.equal(state(), before);

    const saved = settings.presets.Saved;
    assert.equal(await manager.handleMoonlitPresetImport(presetFile({}, '[Moonlit] [Moonlit] Saved')), true);
    assert.equal(settings.activePreset, '[Moonlit] Saved');
    assert.equal(settings.presets.Saved, saved);
});

test('file read/parse failures and cancelled imports reset the input so the same file can be retried', async () => {
    const { settings, calls, state } = setup();
    manager.createPresetManagerUI(document.body, settings);
    assert.ok(document.getElementById('moonlit-preset-selector').getAttribute('aria-label'));
    assert.ok(document.getElementById('moonlit-install-backgrounds').getAttribute('aria-label'));
    const input = document.getElementById('moonlit-preset-file-input');
    const handler = getEventListeners(input, 'change')[0];
    let reads = 0;
    const file = { text: async () => {
        if (++reads === 1) throw new Error('File is unreadable');
        return JSON.stringify(presetFile({}));
    } };
    const before = state();
    input.files = [file];
    input.value = 'same-file.json';
    await handler({ target: input });
    assert.equal(input.value, '');
    assert.equal(input.disabled, false);
    assert.equal(calls.errors.length, 1);
    assert.equal(state(), before);
    input.value = 'same-file.json';
    await handler({ target: input });
    assert.equal(input.value, '');
    assert.equal(reads, 2);
    assert.equal(calls.saves, 1);

    for (const text of ['not json', JSON.stringify(presetFile({}, 'Saved'))]) {
        input.files = [new File([text], 'preset.json')];
        input.value = 'preset.json';
        const previous = state();
        await handler({ target: input });
        assert.equal(input.value, '');
        assert.equal(input.disabled, false);
        assert.equal(state(), previous);
    }
});

test('applying a preset refreshes settings synchronously without an extra delayed refresh', t => {
    const { calls } = setup();
    const timer = t.mock.method(globalThis, 'setTimeout', () => {});
    manager.applyPresetToSettings('Saved');
    assert.equal(calls.ui, 1);
    assert.equal(calls.all, 1);
    assert.equal(calls.applied.length, themeCustomSettings.length);
    assert.equal(timer.mock.callCount(), 0);
    assert.equal(calls.saves, 0);
});

test('slow file reads cannot import over newer settings or native theme choices', async () => {
    for (const change of [
        ({ settings }) => { settings.presets.Other.messageLineHeight = '2em'; },
        ({ context }) => { context.powerUserSettings.theme = 'Other'; },
    ]) {
        const fixture = setup();
        manager.createPresetManagerUI(document.body, fixture.settings);
        const input = document.getElementById('moonlit-preset-file-input');
        const read = Promise.withResolvers();
        input.files = [{ text: () => read.promise }];
        input.value = 'slow.json';
        const pending = getEventListeners(input, 'change')[0]({ target: input });
        change(fixture);
        const afterEdit = fixture.state();
        read.resolve(JSON.stringify(presetFile({})));
        await pending;
        assert.equal(fixture.state(), afterEdit);
        assert.equal(input.value, '');
        assert.equal(input.disabled, false);
        assert.match(fixture.calls.errors.at(-1), /Settings changed/);
    }
});

test('explicit editing while disabled does not request or apply a companion background', t => {
    const { settings } = setup();
    const [name, preset] = Object.entries(defaultSettings.presets)[1];
    settings.enabled = false;
    settings.syncBackgroundWithPreset = true;
    settings.presets[name] = preset;
    const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected background request'); });
    manager.loadPreset(name);
    assert.equal(settings.activePreset, name);
    assert.equal(fetch.mock.callCount(), 0);
});
