import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { registerHooks } from 'node:module';
import test from 'node:test';

const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.endsWith('/i18n.js')) {
            return { url: 'data:text/javascript,export const t = String.raw;', shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});
const { initAvatarInjector, initFormSheldHeightMonitor } = await import('../src/core/observers.js');
const { applyAllThemeSettings } = await import('../src/core/theme-applier.js');
const { initializeSlashCommands } = await import('../src/services/slash-commands.js');
const { installLifecycleHooks } = await import('../src/bootstrap/lifecycle-hooks.js');
const { configurePresetManager } = await import('../src/ui/preset-manager.js');
const { settingsKey } = await import('../src/services/settings-service.js');
hooks.deregister();

function setup(t) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const settings = { enabled: true, useOriginalAvatarImages: false };
    const context = { extensionSettings: { [settingsKey]: settings }, saveSettingsDebounced: t.mock.fn() };
    const elements = new Map([['chat', {}]]);
    const messages = [];
    const mutations = [], resizes = [];
    const styles = new Map([['--messageLineHeight', '31px']]);
    const setProperty = t.mock.fn((name, value) => styles.set(name, value));
    globalThis.SillyTavern = { getContext: () => context };
    globalThis.fetch = () => { throw new Error('Tests must not access the host or network'); };
    globalThis.window = Object.assign(new EventTarget(), { updateSillyBunnyChatAvatars: t.mock.fn() });
    globalThis.document = Object.assign(new EventTarget(), {
        readyState: 'loading', body: {}, documentElement: { style: { setProperty } },
        getElementById: id => elements.get(id) || null,
        querySelectorAll: selector => selector === '.mes' ? messages : [],
        createElement: () => ({}),
        head: { appendChild: element => elements.set(element.id, element) },
    });
    globalThis.MutationObserver = class {
        constructor(callback) { this.callback = callback; mutations.push(this); }
        observe = t.mock.fn();
        disconnect = t.mock.fn();
    };
    globalThis.ResizeObserver = class {
        constructor(callback) { this.callback = callback; resizes.push(this); }
        observe = t.mock.fn();
        disconnect = t.mock.fn();
    };
    t.after(() => {
        window.updateAvatars?.destroy();
        window.formSheldHeightController?.destroy();
    });
    function avatar(source, original) {
        const attributes = { src: source, 'data-original-src': original, 'data-thumbnail-src': source };
        const image = {
            attributes, isConnected: true,
            getAttribute: name => attributes[name] ?? null,
            setAttribute: t.mock.fn((name, value) => { attributes[name] = value; }),
        };
        messages.push({ querySelector: selector => selector === '.avatar img' ? image : null });
        return image;
    }
    return { settings, context, elements, messages, mutations, resizes, styles, setProperty, avatar };
}

const original = '/characters/Alice%20Smith%23%25.png';
const thumbnail = '/thumbnail?type=avatar&file=Alice%20Smith%23%25.png&preset=mobile&t=1723456789';

test('original-avatar preference off leaves encoded, mobile, data and external sources byte-for-byte intact', t => {
    const { avatar, mutations } = setup(t);
    const sources = [original, thumbnail, 'data:image/png;base64,AA==', 'https://example.invalid/avatar.png?t=a%2Bb'];
    const images = sources.map(source => avatar(source, original));
    const update = initAvatarInjector();
    update();
    mutations[0].callback([]);
    t.mock.timers.tick(100);
    update.destroy();
    images.forEach((image, index) => {
        assert.equal(image.attributes.src, sources[index]);
        assert.equal(image.attributes['data-thumbnail-src'], sources[index]);
        assert.equal(image.setAttribute.mock.callCount(), 0);
    });
    assert.equal(window.updateSillyBunnyChatAvatars.mock.callCount(), 0);
});

test('original-avatar preference uses only host data-original-src, including its encoding and query', t => {
    const { settings, avatar, mutations, elements } = setup(t);
    settings.useOriginalAvatarImages = true;
    const encoded = avatar(thumbnail, original);
    const hostUrl = 'https://example.invalid/host%23avatar.png?preset=original&t=a%2Bb';
    const external = avatar('/thumbnail?file=different.png', hostUrl);
    const missingOriginal = avatar(thumbnail);
    const update = initAvatarInjector();
    assert.equal(encoded.attributes.src, original);
    assert.equal(external.attributes.src, hostUrl);
    assert.equal(missingOriginal.attributes.src, thumbnail);
    assert.equal(missingOriginal.setAttribute.mock.callCount(), 0);
    assert.equal(encoded.attributes['data-thumbnail-src'], thumbnail);
    assert.equal(window.updateSillyBunnyChatAvatars.mock.callCount(), 1);
    update();
    assert.equal(encoded.setAttribute.mock.callCount(), 1, 'unchanged originals are not rewritten');
    assert.equal(mutations[0].observe.mock.calls[0].arguments[0], elements.get('chat'));
    assert.deepEqual(mutations[0].observe.mock.calls[0].arguments[1].attributeFilter,
        ['src', 'data-original-src', 'data-thumbnail-src']);
    // A host change to the original URL must not replace the remembered thumbnail.
    encoded.attributes['data-original-src'] = original + '?t=2';
    mutations[0].callback([]);
    t.mock.timers.tick(100);
    assert.equal(encoded.attributes.src, original + '?t=2');
    update.destroy();
    assert.equal(encoded.attributes.src, thumbnail);
});

for (const action of ['preference off', 'disable', 'destroy']) {
    test(`avatar ${action} restores only owned sources, never a newer native choice`, t => {
        const { settings, avatar } = setup(t);
        settings.useOriginalAvatarImages = true;
        const owned = avatar(thumbnail, original);
        const native = avatar(thumbnail, original);
        const update = initAvatarInjector();
        native.attributes.src = '/thumbnail?file=New%20Choice.png&preset=mobile&t=999';
        if (action === 'preference off') settings.useOriginalAvatarImages = false;
        if (action === 'disable') settings.enabled = false;
        if (action === 'destroy') update.destroy();
        else update();
        assert.equal(owned.attributes.src, thumbnail);
        assert.equal(native.attributes.src, '/thumbnail?file=New%20Choice.png&preset=mobile&t=999');
        assert.equal(native.setAttribute.mock.callCount(), 1, 'only the initial override wrote this image');
        update.destroy();
        assert.equal(owned.setAttribute.mock.callCount(), 2);
        assert.equal(Object.hasOwn(window, 'updateAvatars'), false);
    });
}

test('removed avatars are forgotten before reattachment or teardown', t => {
    const { settings, avatar, messages, mutations } = setup(t);
    settings.useOriginalAvatarImages = true;
    const image = avatar(thumbnail, original);
    const update = initAvatarInjector();
    image.isConnected = false;
    messages.length = 0;
    mutations[0].callback([{ removedNodes: [image] }]);
    t.mock.timers.tick(100);
    // A retained override would restore this reattached image despite preference being off.
    image.isConnected = true;
    settings.useOriginalAvatarImages = false;
    update();
    update.destroy();
    assert.equal(image.attributes.src, original);
    assert.equal(image.setAttribute.mock.callCount(), 1);
    assert.equal(window.updateSillyBunnyChatAvatars.mock.callCount(), 1);
});

test('avatar reinitialisation disconnects the old observer and late callbacks cannot write after teardown', t => {
    const { settings, avatar, mutations } = setup(t);
    settings.useOriginalAvatarImages = true;
    const image = avatar(thumbnail, original);
    const first = initAvatarInjector();
    mutations[0].callback([]);
    const second = initAvatarInjector();
    assert.equal(mutations[0].disconnect.mock.callCount(), 1);
    assert.equal(window.updateAvatars, second);
    const writes = image.setAttribute.mock.callCount();
    first();
    first.destroy();
    mutations[0].callback([]);
    t.mock.timers.tick(100);
    assert.equal(image.setAttribute.mock.callCount(), writes);
    assert.equal(window.updateAvatars, second);
    mutations[1].callback([]);
    second.destroy();
    const finalWrites = image.setAttribute.mock.callCount();
    const finalRefreshes = window.updateSillyBunnyChatAvatars.mock.callCount();
    second();
    mutations.forEach(observer => observer.callback([]));
    t.mock.timers.tick(1000);
    assert.equal(image.attributes.src, thumbnail);
    assert.equal(image.setAttribute.mock.callCount(), finalWrites);
    assert.equal(window.updateSillyBunnyChatAvatars.mock.callCount(), finalRefreshes);
    assert.equal(mutations[1].disconnect.mock.callCount(), 1);
    assert.equal(Object.hasOwn(window, 'updateAvatars'), false);
});

function formFixture(t) {
    const fixture = setup(t);
    const textarea = new EventTarget();
    const button = new EventTarget();
    const form = {
        id: 'form_sheld', height: 93.75, parentElement: {},
        getBoundingClientRect() { return { height: this.height }; },
        contains: target => target === textarea,
    };
    fixture.elements.set('form_sheld', form);
    fixture.elements.set('send_textarea', textarea);
    fixture.elements.set('options_button', button);
    return { ...fixture, form, textarea, button };
}

test('resize-observer and direct height updates both measure the border box, not contentRect', t => {
    const { form, resizes, styles } = formFixture(t);
    const controller = window.formSheldHeightController = initFormSheldHeightMonitor();
    assert.equal(styles.get('--formSheldHeight'), '93.75px');
    assert.equal(resizes[0].observe.mock.calls[0].arguments[0], form);
    form.height = 127.5;
    resizes[0].callback([{ target: form, contentRect: { height: 71.5 }, borderBoxSize: [{ blockSize: 127.5 }] }]);
    assert.equal(styles.get('--formSheldHeight'), '127.5px');
    controller.update();
    assert.equal(styles.get('--formSheldHeight'), '127.5px');
});

for (const action of ['stop', 'destroy']) {
    test(`height ${action} cancels queued work and ignores late observer, input and window callbacks`, t => {
        const { settings, form, textarea, button, mutations, resizes, setProperty } = formFixture(t);
        const controller = window.formSheldHeightController = initFormSheldHeightMonitor();
        t.mock.timers.tick(1000);
        assert.equal(getEventListeners(button, 'click').length, 1);
        textarea.dispatchEvent(new Event('input'));
        window.dispatchEvent(new Event('orientationchange'));
        button.dispatchEvent(new Event('click'));
        mutations[0].callback([{ target: form, addedNodes: [] }]);
        mutations[1].callback([{ addedNodes: [form] }]);
        settings.enabled = false;
        controller[action](); // index.js disables the monitor through its teardown controls.
        assert.equal(getEventListeners(textarea, 'input').length, 0);
        const writes = setProperty.mock.callCount();
        const observations = [...mutations, ...resizes].map(observer => observer.observe.mock.callCount());
        form.height = 250;
        controller.update();
        resizes[0].callback([{ target: form, contentRect: { height: 200 } }]);
        mutations[0].callback([{ target: form, addedNodes: [form] }]);
        mutations[1].callback([{ addedNodes: [form] }]);
        textarea.dispatchEvent(new Event('input'));
        button.dispatchEvent(new Event('click'));
        for (const event of ['resize', 'orientationchange', 'load']) window.dispatchEvent(new Event(event));
        document.dispatchEvent(new Event('DOMContentLoaded'));
        t.mock.timers.tick(2000);
        assert.equal(setProperty.mock.callCount(), writes);
        assert.deepEqual([...mutations, ...resizes].map(observer => observer.observe.mock.callCount()), observations);
        assert.ok([...mutations, ...resizes].every(observer => observer.disconnect.mock.callCount() > 0));
        if (action === 'stop') {
            settings.enabled = true;
            controller.start();
            assert.ok(setProperty.mock.callCount() > writes, 'stop remains resumable');
            controller.destroy();
        }
        controller.start();
        assert.equal(Object.hasOwn(window, 'formSheldHeightController'), false);
        assert.equal(getEventListeners(button, 'click').length, 0);
        for (const event of ['resize', 'orientationchange', 'load']) assert.equal(getEventListeners(window, event).length, 0);
        assert.equal(getEventListeners(document, 'DOMContentLoaded').length, 0);
    });
}

test('height reinitialisation destroys previous observers and listeners', t => {
    const { form, mutations, resizes, setProperty, textarea } = formFixture(t);
    const first = window.formSheldHeightController = initFormSheldHeightMonitor();
    const oldObservers = [...mutations, ...resizes];
    const disconnects = oldObservers.map(observer => observer.disconnect.mock.callCount());
    const second = window.formSheldHeightController = initFormSheldHeightMonitor();
    oldObservers.forEach((observer, index) => assert.equal(observer.disconnect.mock.callCount(), disconnects[index] + 1));
    assert.equal(getEventListeners(window, 'resize').length, 1);
    assert.equal(getEventListeners(textarea, 'input').length, 1);
    const writes = setProperty.mock.callCount();
    first.start();
    first.update();
    first.destroy();
    resizes[0].callback([{ target: form }]);
    t.mock.timers.tick(500);
    assert.equal(setProperty.mock.callCount(), writes);
    assert.equal(window.formSheldHeightController, second);
});

test('bulk line-height writes only the Moonlit alias and removes it for native values', t => {
    const { settings, context, elements, styles, setProperty } = setup(t);
    const definitions = [{ varId: 'messageLineHeight' }];
    settings.messageLineHeight = '1.7';
    applyAllThemeSettings(settingsKey, definitions, context);
    const style = elements.get('dynamic-theme-styles');
    assert.equal(style.textContent, ':root {\n  --moonlit-message-line-height: 1.7 !important;\n}');
    for (const native of ['', '  ', 'calc(var(--mainFontSize) + .5rem)', 'calc(var(--mainFontSize) + var(--lineSpacingDesktopLeading, 0.5rem))']) {
        settings.messageLineHeight = native;
        applyAllThemeSettings(settingsKey, definitions);
        assert.equal(elements.get('dynamic-theme-styles'), style, 'reuse the existing style element');
        assert.equal(style.textContent, ':root {\n}', native);
    }
    assert.equal(styles.get('--messageLineHeight'), '31px');
    assert.equal(setProperty.mock.callCount(), 0, 'bulk writes must not alter host inline variables');
});

test('slash commands preserve five core names, register only three aliases once, and recheck enabled state', t => {
    const { settings, context, elements } = setup(t);
    globalThis.HTMLSelectElement = class extends EventTarget { value = '7'; };
    const select = new HTMLSelectElement();
    const change = t.mock.fn();
    select.addEventListener('change', change);
    elements.set('chat_display', select);
    const core = ['echostyle', 'whisperstyle', 'hushstyle', 'ripplestyle', 'tidestyle']
        .map(name => [name, { name, callback: t.mock.fn() }]);
    const commands = new Map(core);
    context.SlashCommand = { fromProps: props => props };
    context.SlashCommandParser = { addCommandObject: t.mock.fn(command => commands.set(command.name, command)) };
    settings.enabled = false;
    initializeSlashCommands();
    assert.equal(context.SlashCommandParser.addCommandObject.mock.callCount(), 0);
    settings.enabled = true;
    initializeSlashCommands();
    const aliases = [['moonlit-flat', '0', 'Flat'], ['moonlit-bubble', '1', 'Bubbles'], ['moonlit-document', '2', 'Document']];
    assert.deepEqual([...commands.keys()].sort(), [...core.map(([name]) => name), ...aliases.map(([name]) => name)].sort());
    for (const [name, value, label] of aliases) {
        assert.equal(commands.get(name).callback(), `Chat style switched to ${label}`);
        assert.equal(select.value, value);
    }
    assert.equal(change.mock.callCount(), 3);
    for (let cycle = 0; cycle < 3; cycle++) {
        context.extensionSettings[settingsKey] = { enabled: false };
        initializeSlashCommands();
        for (const [name] of aliases) assert.match(commands.get(name).callback(), /disabled/);
        assert.equal(select.value, '2');
        assert.equal(change.mock.callCount(), 3);
        context.extensionSettings[settingsKey] = { enabled: true };
        initializeSlashCommands();
    }
    assert.equal(context.SlashCommandParser.addCommandObject.mock.callCount(), 3);
    for (const [name, command] of core) assert.equal(commands.get(name), command);
});

test('lifecycle preset import requires explicit overwrite and never activates an imported preset', t => {
    const { settings, context } = setup(t);
    Object.assign(settings, {
        activePreset: 'Active', messageLineHeight: '1.2',
        presets: { Active: { messageLineHeight: '1.2' }, Existing: { messageLineHeight: '1.4' } },
    });
    const apply = t.mock.fn();
    configurePresetManager({
        settingsKey, themeCustomSettings: [{ varId: 'messageLineHeight', type: 'text', default: '' }],
        applyThemeSetting: apply, applyAllThemeSettings: apply, updateSettingsUI: apply,
        updateThemeSelector: apply, onPresetActivated: apply,
    });
    installLifecycleHooks({
        addModernCompactStyles: t.mock.fn(), applyAllThemeSettings: apply,
        addCustomSetting: t.mock.fn(), applyThemeSetting: apply, themeVersion: 'test',
    });
    const api = window.MoonlitEchoesTheme.presets;
    const data = { moonlitEchoesPreset: true, presetName: 'Existing', settings: { messageLineHeight: '1.8' } };
    const before = structuredClone(settings);
    for (const options of [undefined, {}, { overwrite: false }, { overwrite: 'true' }]) {
        assert.equal(api.import(data, options), false);
        assert.deepEqual(settings, before);
        assert.equal(context.saveSettingsDebounced.mock.callCount(), 0);
    }
    assert.equal(api.import(data, { overwrite: true }), true);
    assert.deepEqual(settings.presets.Existing, data.settings);
    assert.equal(api.import({ ...data, presetName: 'New' }), true);
    assert.deepEqual(settings.presets.New, data.settings);
    assert.equal(settings.activePreset, 'Active');
    assert.equal(settings.messageLineHeight, '1.2');
    assert.equal(context.saveSettingsDebounced.mock.callCount(), 2);
    assert.equal(apply.mock.callCount(), 0);
});
