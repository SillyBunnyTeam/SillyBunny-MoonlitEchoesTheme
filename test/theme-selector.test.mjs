import assert from 'node:assert/strict';
import { EventEmitter, getEventListeners } from 'node:events';
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

const { integrateWithThemeSelector } = await import('../src/services/theme-selector.js');
const { addThemeButtonsHint } = await import('../src/services/hints.js');
const manager = await import('../src/ui/preset-manager.js');
const { settingsKey } = await import('../src/services/settings-service.js');

class Element extends EventTarget {
    constructor(tagName) {
        super();
        Object.assign(this, { tagName, children: [], style: {}, value: '' });
    }
    get options() { return this.children; }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html || ''; }
    appendChild(child) {
        child.parent = this;
        this.children.push(child);
        if (this.tagName === 'select' && child.selected) this.value = child.value;
        return child;
    }
    remove() { this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
}

function setup({ enabled = true } = {}) {
    const body = new Element('body');
    const find = (node, id) => node.id === id ? node : node.children.map(child => find(child, id)).find(Boolean);
    globalThis.document = { createElement: tag => new Element(tag), getElementById: id => find(body, id) || null };
    const element = (id, tag = 'div') => body.appendChild(Object.assign(new Element(tag), { id }));
    const themes = element('themes', 'select');
    for (const value of ['A', 'B', 'Native only']) themes.appendChild(Object.assign(new Element('option'), { value }));
    themes.value = 'A';
    element('UI-presets-block');
    element('moonlit-preset-selector', 'select');
    const settings = {
        enabled, activePreset: 'A', accent: 'a', syncBackgroundWithPreset: false,
        presets: { A: { accent: 'a' }, B: { accent: 'b' }, 'Moonlit only': { accent: 'custom' } },
    };
    const calls = { saves: 0, hostSaves: 0, hostApplied: [], selectorUpdates: [], applied: [], ui: 0 };
    const context = {
        extensionSettings: { [settingsKey]: settings },
        powerUserSettings: { theme: 'A' },
        eventSource: new EventEmitter(),
        event_types: { SETTINGS_UPDATED: 'settings_updated' },
        saveSettingsDebounced: () => calls.saves++,
    };
    globalThis.SillyTavern = { getContext: () => context };
    globalThis.toastr = { success() {}, error() {} };
    globalThis.fetch = () => { throw new Error('Tests must not access the host or network'); };
    // The host registers this synchronous change handler before extension initialisation.
    themes.addEventListener('change', () => {
        context.powerUserSettings.theme = themes.value;
        calls.hostApplied.push(themes.value);
        calls.hostSaves++;
    });
    manager.configurePresetManager({
        settingsKey,
        t: String.raw,
        themeCustomSettings: [{ varId: 'accent', type: 'text', default: 'a' }],
        applyThemeSetting: (...args) => calls.applied.push(args),
        applyAllThemeSettings: () => {},
        updateSettingsUI: () => calls.ui++,
        updateThemeSelector: name => {
            calls.selectorUpdates.push(name);
            const selector = document.getElementById('themes');
            if (selector.options.some(option => option.value === name)) {
                selector.value = name;
                selector.dispatchEvent(new Event('change'));
            }
        },
    });
    const saved = () => context.eventSource.emit(context.event_types.SETTINGS_UPDATED);
    return { body, element, themes, settings, calls, context, saved };
}

test('native action and file listeners remain host-owned after repeated integration', () => {
    const { element, calls, context } = setup();
    const actions = [
        ['ui_preset_import_button', 'click'], ['ui_preset_export_button', 'click'],
        ['ui-preset-update-button', 'click'], ['ui-preset-save-button', 'click'],
        ['ui-preset-delete-button', 'click'], ['ui_preset_import_file', 'change'],
    ].map(([id, event]) => {
        const target = element(id);
        let hostCalls = 0;
        target.addEventListener(event, () => hostCalls++);
        return { target, event, hostCalls: () => hostCalls };
    });
    integrateWithThemeSelector();
    integrateWithThemeSelector();
    for (const { target, event, hostCalls } of actions) {
        assert.equal(getEventListeners(target, event).length, 1, target.id);
        target.dispatchEvent(new Event(event));
        assert.equal(hostCalls(), 1, target.id);
    }
    assert.equal(context.eventSource.listenerCount('settings_updated'), 1);
    assert.equal(calls.saves, 0);
});

test('native selection syncs once without reapplying the host theme or looping on saves', () => {
    const { themes, settings, calls, saved } = setup();
    integrateWithThemeSelector();
    integrateWithThemeSelector();
    themes.value = 'B';
    themes.dispatchEvent(new Event('change'));
    assert.equal(settings.activePreset, 'B');
    assert.equal(settings.accent, 'b');
    assert.equal(document.getElementById('moonlit-preset-selector').value, 'B');
    assert.deepEqual(calls.hostApplied, ['B']);
    assert.deepEqual(calls.selectorUpdates, []);
    assert.equal(calls.saves, 1);
    saved();
    saved();
    assert.equal(calls.saves, 1);
    assert.equal(calls.ui, 1);
});

test('host imports sync on actual theme changes, not unrelated saves or reintegration', () => {
    const { themes, settings, context, calls, saved } = setup();
    integrateWithThemeSelector();
    manager.loadPreset('Moonlit only');
    saved();
    assert.equal(settings.activePreset, 'Moonlit only');
    assert.equal(calls.saves, 1);

    // Host saveTheme updates selection and power_user.theme; importTheme then applies it.
    themes.value = 'B';
    context.powerUserSettings.theme = 'B';
    calls.hostApplied.push('B');
    integrateWithThemeSelector();
    saved();
    assert.equal(settings.activePreset, 'B');
    assert.equal(settings.accent, 'b');
    assert.equal(calls.saves, 2);
    assert.deepEqual(calls.selectorUpdates, []);
    saved();
    assert.equal(calls.saves, 2);

    manager.loadPreset('Moonlit only');
    saved();
    assert.equal(settings.activePreset, 'Moonlit only');
    assert.equal(calls.saves, 3);
    themes.value = 'Native only';
    context.powerUserSettings.theme = 'Native only';
    saved();
    assert.equal(settings.activePreset, 'Moonlit only');
    assert.equal(calls.saves, 3);
});

test('a delayed native-import save cannot undo a newer Moonlit-only activation', async () => {
    const activations = [
        () => manager.loadPreset('Moonlit only'),
        () => manager.upsertPresetSnapshot('Moonlit only', { accent: 'custom' }, { activate: true }),
        () => manager.importPresetSnapshot({
            moonlitEchoesPreset: true, presetName: 'Moonlit only', settings: { accent: 'custom' },
        }, { overwrite: true }),
        ({ settings }) => {
            settings.presets = { 'Moonlit only': settings.presets['Moonlit only'], A: settings.presets.A, B: settings.presets.B };
            manager.deletePresetSnapshot('A');
        },
        null,
    ];
    for (const activate of activations) {
        const fixture = setup();
        const { themes, settings, context, calls, saved } = fixture;
        integrateWithThemeSelector();

        // The host applies B, but its settings-save HTTP response is still pending.
        themes.value = 'B';
        context.powerUserSettings.theme = 'B';
        calls.hostApplied.push('B');
        const response = Promise.withResolvers();
        const pendingSave = response.promise.then(saved);
        activate?.(fixture);
        response.resolve();
        await pendingSave;
        saved();

        assert.equal(settings.activePreset, activate ? 'Moonlit only' : 'B');
        assert.equal(settings.accent, activate ? 'custom' : 'b');
        assert.equal(document.getElementById('moonlit-preset-selector').value, settings.activePreset);
        assert.equal(context.powerUserSettings.theme, 'B');
        assert.equal(themes.value, 'B');
        assert.deepEqual(calls.hostApplied, ['B']);
        assert.deepEqual(calls.selectorUpdates, []);
        assert.equal(calls.saves, 1);
        assert.equal(calls.ui, 1);

        // A genuinely later native change still synchronises normally.
        themes.value = 'Native only';
        context.powerUserSettings.theme = 'Native only';
        saved();
        themes.value = 'B';
        context.powerUserSettings.theme = 'B';
        saved();
        assert.equal(settings.activePreset, 'B');
        assert.equal(calls.saves, activate ? 2 : 1);
    }
});

test('integrating the activation callback preserves configured translation', () => {
    setup();
    let translations = 0;
    manager.configurePresetManager({ t: () => { translations++; return 'translated'; } });
    integrateWithThemeSelector();
    manager.loadPreset('Moonlit only');
    assert.equal(translations, 1);
});

test('disabled native synchronisation leaves saved state untouched but explicit Moonlit editing works', () => {
    const { themes, settings, context, calls, saved } = setup({ enabled: false });
    integrateWithThemeSelector();
    const before = JSON.stringify(settings);
    themes.value = 'B';
    themes.dispatchEvent(new Event('change'));
    saved();
    assert.equal(JSON.stringify(settings), before);
    assert.equal(calls.saves, 0);
    assert.equal(calls.applied.length, 0);
    assert.equal(manager.upsertPresetSnapshot('B', { accent: 'edited' }, { activate: true }), 'B');
    assert.equal(settings.activePreset, 'B');
    assert.equal(settings.accent, 'edited');
    assert.equal(calls.saves, 1);
    assert.deepEqual(calls.selectorUpdates, []);

    themes.value = 'A';
    context.powerUserSettings.theme = 'A';
    saved();
    assert.equal(settings.activePreset, 'B');
    settings.enabled = true;
    saved();
    assert.equal(settings.activePreset, 'B');
    assert.equal(calls.saves, 1);
    themes.dispatchEvent(new Event('change'));
    assert.equal(settings.activePreset, 'A');
    assert.equal(calls.saves, 2);
});

test('companion synchronisation applies the host theme, including deletion fallback, without redundant saves', () => {
    const { themes, settings, context, calls } = setup();
    integrateWithThemeSelector();
    // A matching dropdown label is not proof that the host has applied that theme.
    context.powerUserSettings.theme = 'B';
    manager.syncMoonlitPresetsWithThemeList();
    manager.syncMoonlitPresetsWithThemeList();
    assert.equal(context.powerUserSettings.theme, 'A');
    assert.deepEqual(calls.hostApplied, ['A']);
    assert.deepEqual(calls.selectorUpdates, ['A']);
    assert.equal(calls.saves, 0);

    manager.loadPreset('B');
    assert.equal(manager.deletePresetSnapshot('B'), true);
    assert.equal(settings.activePreset, 'A');
    assert.equal(settings.accent, 'a');
    assert.equal(themes.value, 'A');
    assert.equal(context.powerUserSettings.theme, 'A');
    assert.deepEqual(calls.hostApplied, ['A', 'B', 'A']);
    assert.equal(calls.saves, 2);
    manager.syncMoonlitPresetsWithThemeList();
    assert.equal(calls.hostSaves, 3);

    manager.loadPreset('Moonlit only');
    assert.equal(context.powerUserSettings.theme, 'A');
    assert.equal(calls.hostSaves, 3);
    settings.enabled = false;
    settings.activePreset = 'A';
    context.powerUserSettings.theme = 'Native only';
    manager.syncMoonlitPresetsWithThemeList();
    assert.equal(context.powerUserSettings.theme, 'Native only');
    assert.equal(calls.hostSaves, 3);
});

test('host event subscriptions survive missing selectors and detach from replaced event sources', () => {
    const { themes, settings, context, calls, saved } = setup();
    integrateWithThemeSelector();
    const oldSource = context.eventSource;
    context.eventSource = new EventEmitter();
    themes.remove();
    integrateWithThemeSelector();
    assert.equal(oldSource.listenerCount('settings_updated'), 0);
    assert.equal(context.eventSource.listenerCount('settings_updated'), 1);
    context.powerUserSettings.theme = 'B';
    saved();
    assert.equal(settings.activePreset, 'B');
    assert.equal(calls.saves, 1);
    assert.deepEqual(calls.selectorUpdates, []);
});

test('non-activating preset edits preserve a deliberately selected native-only theme', () => {
    const { themes, settings, context, calls, saved } = setup();
    integrateWithThemeSelector();
    themes.value = 'Native only';
    themes.dispatchEvent(new Event('change'));
    assert.equal(manager.upsertPresetSnapshot('B', { accent: 'edited' }), 'B');
    assert.equal(manager.upsertPresetSnapshot('A', { accent: 'updated active' }), 'A');
    assert.equal(manager.importPresetSnapshot({
        moonlitEchoesPreset: true, presetName: 'Imported', settings: { accent: 'imported' },
    }, { activate: false }), 'Imported');
    assert.equal(manager.deletePresetSnapshot('B'), true);
    saved();
    assert.equal(settings.activePreset, 'A');
    assert.equal(settings.accent, 'updated active');
    assert.equal(context.powerUserSettings.theme, 'Native only');
    assert.equal(themes.value, 'Native only');
    assert.deepEqual(calls.selectorUpdates, []);
    assert.deepEqual(calls.hostApplied, ['Native only']);
    assert.equal(calls.saves, 4);
});

test('hints reuse one listener across toggles, detached hints, replaced settings, and replaced selectors', () => {
    const { themes, settings, context, element } = setup();
    addThemeButtonsHint();
    const initialCount = getEventListeners(themes, 'change').length;
    const detachedHint = document.getElementById('moonlit-theme-buttons-hint');
    const initialHtml = detachedHint.innerHTML;
    detachedHint.remove();
    addThemeButtonsHint();
    assert.equal(getEventListeners(themes, 'change').length, initialCount);
    for (let i = 0; i < 3; i++) {
        settings.enabled = false;
        addThemeButtonsHint();
        assert.equal(document.getElementById('moonlit-theme-buttons-hint'), null);
        assert.equal(getEventListeners(themes, 'change').length, initialCount - 1);
        settings.enabled = true;
        addThemeButtonsHint();
        addThemeButtonsHint();
        assert.equal(getEventListeners(themes, 'change').length, initialCount);
    }
    themes.value = 'Moonlit Echoes - by Rivelle';
    themes.dispatchEvent(new Event('change'));
    assert.match(document.getElementById('moonlit-theme-buttons-hint').innerHTML, /Thank you for choosing/);
    assert.equal(detachedHint.innerHTML, initialHtml);

    context.extensionSettings[settingsKey] = { ...settings, enabled: false };
    themes.dispatchEvent(new Event('change'));
    assert.equal(document.getElementById('moonlit-theme-buttons-hint'), null);
    assert.equal(getEventListeners(themes, 'change').length, initialCount - 1);
    context.extensionSettings[settingsKey].enabled = true;
    addThemeButtonsHint();
    themes.remove();
    const replacement = element('themes', 'select');
    addThemeButtonsHint();
    addThemeButtonsHint();
    assert.equal(getEventListeners(themes, 'change').length, initialCount - 1);
    assert.equal(getEventListeners(replacement, 'change').length, 1);
});
