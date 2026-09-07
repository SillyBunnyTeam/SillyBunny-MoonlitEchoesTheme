import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { hexToRgba, parseColorValue } from '../src/utils/color.js';

const sources = ['settings-factory.js', 'settings-tabs.js'].map(file =>
    readFileSync(new URL(`../src/ui/${file}`, import.meta.url), 'utf8')
        .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '')
        .replaceAll('import.meta.url', JSON.stringify(new URL(`../src/ui/${file}`, import.meta.url).href)),
).join('\n');

const blur = {
    type: 'slider', varId: 'customCSS-bg-blur', displayText: 'Background blur',
    description: 'Blur intensity', default: '3', min: 0, max: 10, step: 1,
    category: 'background-effects',
};
const colour = {
    type: 'color', varId: 'customThemeColor', displayText: 'Primary theme colour',
    description: 'Highlight colour', default: 'rgba(255, 0, 0, 0.25)', category: 'theme-colors',
};
const rawCss = {
    type: 'textarea', varId: 'rawCustomCss', displayText: 'Raw CSS',
    description: 'Custom styles', default: '', category: 'raw-css',
};

function setup(definitions, values = {}, stored = {}) {
    const cssColours = { blue: 'rgb(0, 0, 255)', 'var(--saved-colour)': 'rgba(255, 0, 0, 0.25)' };
    const document = new EventTarget();
    class Element extends EventTarget {
        constructor(tag) {
            super();
            this.tagName = tag.toUpperCase();
            this.children = [];
            this.attributes = new Map();
            this._value = null;
            this._text = '';
            const classes = new Set();
            this.classList = {
                add: (...names) => names.forEach(name => classes.add(name)),
                remove: (...names) => names.forEach(name => classes.delete(name)),
                contains: name => classes.has(name),
                toggle(name, force = !classes.has(name)) {
                    if (force) classes.add(name);
                    else classes.delete(name);
                    return force;
                },
            };
            this.style = new Proxy({}, {
                get: (target, property) => target[property] ?? '',
                set(target, property, value) {
                    if (property !== 'color' || parseColorValue(value) || cssColours[value]) {
                        target[property] = String(value);
                    }
                    return true;
                },
            });
        }
        appendChild(child) {
            child.remove();
            this.children.push(child);
            child.parentElement = this;
            return child;
        }
        append(...children) {
            for (const child of children) {
                if (typeof child === 'string') this._text += child;
                else this.appendChild(child);
            }
        }
        remove() {
            if (this.parentElement) {
                const siblings = this.parentElement.children;
                siblings.splice(siblings.indexOf(this), 1);
                this.parentElement = null;
            }
        }
        contains(node) { return node === this || this.children.some(child => child.contains(node)); }
        setAttribute(name, value) { this.attributes.set(name, String(value)); }
        getAttribute(name) { return this.attributes.get(name) ?? null; }
        hasAttribute(name) { return this.attributes.has(name); }
        matches(selector) {
            if (selector.startsWith('#')) return this.id === selector.slice(1);
            if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
            return this.tagName === selector.toUpperCase();
        }
        querySelectorAll(selector) {
            const selectors = selector.split(',').map(value => value.trim());
            return this.children.flatMap(child => [
                ...(selectors.some(value => child.matches(value)) ? [child] : []),
                ...child.querySelectorAll(selector),
            ]);
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
        get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
        set textContent(value) {
            for (const child of [...this.children]) child.remove();
            this._text = String(value);
        }
        set innerHTML(value) { assert.equal(value, ''); this.textContent = ''; this._value = null; }
        get value() {
            if (this.tagName === 'SELECT' && this._value === null) {
                return (this.children.find(child => child.selected) || this.children[0])?.value ?? '';
            }
            return this._value ?? '';
        }
        set value(value) {
            // Model the native range sanitisation that exposed the number/range mismatch.
            if (this.type === 'range') {
                const min = Number(this.min ?? 0);
                const max = Number(this.max ?? 100);
                const step = this.step === 'any' ? 0 : Number(this.step ?? 1);
                let number = Number(value);
                if (!Number.isFinite(number)) number = (min + max) / 2;
                number = Math.max(min, Math.min(max, number));
                if (step > 0) number = min + Math.round((number - min) / step) * step;
                value = Number(Math.max(min, Math.min(max, number)).toPrecision(12));
            }
            this._value = String(value);
        }
        get valueAsNumber() { return this.value.trim() === '' ? NaN : Number(this.value); }
        get validity() {
            if (this.value === '') return { valid: true };
            const number = this.valueAsNumber;
            const steps = (number - Number(this.min ?? 0)) / Number(this.step ?? 1);
            return { valid: Number.isFinite(number) && number >= Number(this.min ?? -Infinity)
                && number <= Number(this.max ?? Infinity)
                && (this.step === 'any' || Math.abs(steps - Math.round(steps)) < 1e-7) };
        }
        focus() {
            for (let node = this; node; node = node.parentElement) {
                if (node.hidden || node.inert || node.style.display === 'none') return;
            }
            document.activeElement = this;
        }
        click() {
            this.dispatchEvent(new Event('click'));
            if (this.tagName === 'LABEL') document.getElementById(this.htmlFor)?.click();
            if (this.type === 'checkbox') {
                this.checked = !this.checked;
                this.dispatchEvent(new Event('change'));
            }
        }
    }
    document.createElement = tag => new Element(tag);
    document.documentElement = new Element('html');
    document.head = new Element('head');
    document.body = new Element('body');
    document.documentElement.append(document.head, document.body);
    document.querySelectorAll = selector => document.documentElement.querySelectorAll(selector);
    document.querySelector = selector => document.documentElement.querySelector(selector);
    document.getElementById = id => document.querySelector(`#${id}`);
    document.activeElement = document.body;

    const settings = { enabled: true, ...Object.fromEntries(definitions.map(s => [s.varId, s.default])), ...values };
    settings.activePreset = 'Default';
    settings.presets = { Default: { ...settings } };
    const storage = new Map(Object.entries(stored));
    const localStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
    };
    const applied = [], rawApplied = [], saves = [], timers = [];
    const api = runInNewContext(`${sources}\n({
        configureSettingsFactory, configureSettingsTabs, createSettingItem, createCustomSettingsUI,
        createTabbedSettingsUI, addSettingToTabbedUI, updateSettingsUI,
    })`, {
        document, localStorage, t: String.raw, URL, hexToRgba, parseColorValue,
        EXTENSION_FOLDER_PATH: '/moonlit',
        themeCustomSettings: definitions, defaultThemeCustomSettings: definitions,
        defaultTabMappings: {
            'core-settings': ['theme-colors', 'background-effects', 'raw-css'],
            'chat-interface': ['chat-general'], 'mobile-devices': [],
        },
        SillyTavern: { getContext: () => ({}) },
        getExtensionSettings: () => settings,
        saveExtensionSettings: () => saves.push(structuredClone(settings)),
        setTimeout: callback => timers.push(callback),
        getComputedStyle: element => ({ color: cssColours[element.style.color] || element.style.color }),
        CustomEvent: class extends Event {
            constructor(type, options) { super(type); this.detail = options.detail; }
        },
    });
    api.configureSettingsFactory({
        applyThemeSetting: (...args) => applied.push(args),
        applyRawCustomCss: value => rawApplied.push(value),
    });
    api.configureSettingsTabs({ createSettingItem: api.createSettingItem });
    const container = document.createElement('div');
    document.body.append(container);
    return {
        ...api, document, settings, storage, localStorage, container, applied, rawApplied, saves,
        flushTimers: () => { while (timers.length) timers.shift()(); },
        render: setting => api.createSettingItem(container, setting, settings),
        get: id => document.getElementById(id),
    };
}

function change(input, value, type = 'change') {
    input.value = value;
    input.dispatchEvent(new Event(type));
}

function pressKey(element, key) {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: key });
    element.dispatchEvent(event);
    // The host synthesises Enter clicks for menu_button/interactable ancestors without cancelling the native click.
    if (key === 'Enter') {
        let target = element;
        while (target && !['menu_button', 'interactable', 'custom_interactable'].some(name => target.classList.contains(name))) {
            target = target.parentElement;
        }
        target?.click();
    }
    if (!event.defaultPrevented && (element.tagName === 'BUTTON' && ['Enter', ' '].includes(key)
        || element.type === 'checkbox' && key === ' ')) element.click();
}

test('slider rejects empty, non-numeric, out-of-bounds and off-step numbers without saving; zero survives', () => {
    const ui = setup([blur], { [blur.varId]: 0 });
    ui.render(blur);
    const slider = ui.get(`cts-slider-${blur.varId}`);
    const number = ui.get(`cts-number-${blur.varId}`);
    assert.equal(slider.value, '0');
    assert.equal(number.value, '0');
    for (const invalid of ['999', '-1', '', 'not a number', '0.5', 'Infinity']) {
        change(number, invalid);
        assert.equal(number.value, '0', invalid);
        assert.equal(slider.value, '0', invalid);
        assert.equal(ui.settings[blur.varId], 0, invalid);
        assert.equal(ui.settings.presets.Default[blur.varId], 0, invalid);
    }
    assert.equal(ui.saves.length, 0);
    assert.equal(ui.applied.length, 0);
    change(number, '10');
    change(number, '0');
    assert.equal(ui.settings[blur.varId], '0');
    assert.equal(ui.settings.presets.Default[blur.varId], '0');
    assert.equal(ui.saves.length, 2);
    change(slider, '7', 'input');
    assert.equal(number.value, '7');
    assert.equal(ui.settings[blur.varId], '7');
    ui.settings[blur.varId] = 0;
    ui.updateSettingsUI();
    assert.equal(slider.value, '0');
    assert.equal(number.value, '0');
});

test('fractional slider uses native step validity and accepts aligned decimal values', () => {
    const opacity = { ...blur, default: '0.3', max: 1, step: 0.05 };
    const ui = setup([opacity]);
    ui.render(opacity);
    const number = ui.get(`cts-number-${opacity.varId}`);
    change(number, '0.03');
    assert.equal(number.value, '0.3');
    assert.equal(ui.saves.length, 0);
    change(number, '0.35');
    assert.equal(ui.get(`cts-slider-${opacity.varId}`).value, '0.35');
    assert.equal(number.value, '0.35');
    assert.equal(ui.settings[opacity.varId], '0.35');
});

test('rejected colour drafts restore the picker, preview, opacity and thumb from saved state', () => {
    for (const saved of [colour.default, 'var(--saved-colour)']) {
        const ui = setup([colour], { [colour.varId]: saved });
        ui.render(colour);
        const text = ui.get('cts-customThemeColor-text');
        const picker = ui.get('cts-customThemeColor-color');
        const alpha = ui.get('cts-customThemeColor-alpha');
        change(text, '#0000ff', 'input');
        assert.equal(picker.value, '#0000ff');
        change(text, '#0000ff-invalid', 'input');
        text.dispatchEvent(new Event('change'));
        text.dispatchEvent(new Event('focusout'));
        ui.flushTimers();
        assert.equal(text.value, saved.startsWith('var(') ? saved : '#ff0000');
        assert.equal(picker.value, '#ff0000');
        assert.equal(ui.get('cts-customThemeColor-preview').style.background, saved);
        assert.equal(alpha.value, '25');
        assert.equal(ui.get('cts-customThemeColor-alpha-value').textContent, '25');
        assert.match(ui.get('thumb-style-customThemeColor').textContent, /background: #ff0000/);
        assert.equal(ui.settings[colour.varId], saved);
        assert.equal(ui.saves.length, 0);
        change(alpha, '40', 'input');
        assert.equal(ui.settings[colour.varId], 'rgba(255, 0, 0, 0.4)');
        assert.equal(ui.settings.presets.Default[colour.varId], 'rgba(255, 0, 0, 0.4)');
        change(text, '#0000ff');
        assert.equal(ui.settings[colour.varId], 'rgba(0, 0, 255, 0.4)');
    }
});

test('raw CSS edits save to the active preset without applying while disabled', () => {
    const ui = setup([rawCss], { enabled: false });
    ui.render(rawCss);
    const textarea = ui.get('cts-rawCustomCss');
    const css = '@import url("example.css"); body { color: blue; }';
    change(textarea, css, 'input');
    textarea.dispatchEvent(new Event('change'));
    assert.equal(ui.settings.rawCustomCss, css);
    assert.equal(ui.settings.presets.Default.rawCustomCss, css);
    assert.equal(ui.saves.length, 2);
    assert.deepEqual(ui.rawApplied, []);
    ui.settings.enabled = true;
    change(textarea, '', 'input');
    assert.deepEqual(ui.rawApplied, ['']);
    assert.equal(ui.settings.presets.Default.rawCustomCss, '');
});

test('all generated fields have labels/descriptions and colour controls have distinct names', () => {
    const definitions = [colour, blur, rawCss,
        { type: 'select', varId: 'choice', default: 'a', options: [{ value: 'a', label: 'A' }] },
        { type: 'text', varId: 'text', default: '' },
        { type: 'checkbox', varId: 'hideAvatarBorder', default: false },
    ].map(setting => ({ displayText: 'Setting', description: 'Help', ...setting }));
    const ui = setup(definitions);
    definitions.forEach(ui.render);
    for (const item of ui.container.children) {
        const label = item.querySelector('label');
        const description = item.querySelector('small');
        assert.ok(ui.get(label.htmlFor));
        for (const control of item.querySelectorAll('input, select, textarea')) {
            assert.ok(control.getAttribute('aria-label') || control.getAttribute('aria-labelledby') === label.id);
            assert.equal(control.getAttribute('aria-describedby'), description.id);
        }
    }
    const colourNames = ['text', 'color', 'alpha'].map(suffix => ui.get(`cts-customThemeColor-${suffix}`).getAttribute('aria-label'));
    assert.equal(new Set(colourNames).size, 3);
    assert.ok(colourNames.every(name => name.includes(colour.displayText)));
    const checkbox = ui.get('cts-checkbox-hideAvatarBorder');
    ui.get('cts-hideAvatarBorder-label').click();
    assert.equal(checkbox.checked, true);
    assert.equal(ui.saves.length, 1);
    checkbox.classList.add('menu_button');
    pressKey(checkbox, 'Enter');
    assert.equal(checkbox.checked, false);
    assert.equal(ui.saves.length, 2);
    pressKey(checkbox, ' ');
    assert.equal(checkbox.checked, true);
    assert.equal(ui.saves.length, 3);
});

test('tabs reject stale IDs and native section toggles exclude collapsed controls from focus', () => {
    const ui = setup([colour, blur, rawCss], {}, {
        moonlit_active_tab: 'removed-tab',
        moonlit_section_states: JSON.stringify({ 'background-effects': false }),
    });
    ui.createTabbedSettingsUI(ui.container, ui.settings);
    assert.equal(ui.get('moonlit-tab-content-core-settings').hidden, false);
    assert.equal(ui.get('moonlit-tab-content-chat-interface').hidden, true);
    const section = ui.get('moonlit-section-background-effects');
    const toggle = section.querySelector('button');
    const content = ui.get(toggle.getAttribute('aria-controls'));
    const number = content.querySelector('input');
    assert.equal(toggle.type, 'button');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(content.inert, true);
    number.focus();
    assert.equal(ui.document.activeElement, ui.document.body);
    pressKey(toggle, 'Enter');
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(content.inert, false);
    number.focus();
    assert.equal(ui.document.activeElement, number);
    pressKey(toggle, ' ');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(content.inert, true);
    assert.equal(JSON.parse(ui.storage.get('moonlit_section_states'))['background-effects'], false);
    assert.equal(ui.addSettingToTabbedUI({ ...blur, varId: 'extra-blur' }, ui.settings), true);
    assert.equal(content.inert, true);
    const first = ui.get('moonlit-section-theme-colors');
    assert.equal(first.querySelector('.moonlit-section-content').inert, false);
    assert.equal(first.querySelector('button'), null);
    pressKey(ui.get('moonlit-tab-btn-chat-interface'), 'Enter');
    assert.equal(ui.get('moonlit-tab-content-core-settings').hidden, true);
    assert.equal(ui.get('moonlit-tab-content-chat-interface').hidden, false);
    assert.equal(ui.storage.get('moonlit_active_tab'), 'chat-interface');
});

test('restored valid tabs, corrupt section state and denied storage remain usable', () => {
    for (const state of ['null', '[]', '{broken', '{"background-effects":"false"}']) {
        const ui = setup([colour, blur], {}, { moonlit_active_tab: 'chat-interface', moonlit_section_states: state });
        ui.createTabbedSettingsUI(ui.container, ui.settings);
        assert.equal(ui.get('moonlit-tab-content-chat-interface').hidden, false);
        assert.equal(ui.get('moonlit-section-background-effects').querySelector('button').getAttribute('aria-expanded'), 'true');
    }
    const ui = setup([colour, blur]);
    ui.localStorage.getItem = ui.localStorage.setItem = () => { throw new Error('Storage denied'); };
    ui.createTabbedSettingsUI(ui.container, ui.settings);
    assert.equal(ui.get('moonlit-tab-content-core-settings').hidden, false);
    assert.doesNotThrow(() => ui.get('moonlit-section-background-effects').querySelector('button').click());
    assert.doesNotThrow(() => ui.get('moonlit-tab-btn-mobile-devices').click());
});

test('non-tabbed category toggles also use native buttons and inert collapsed content', () => {
    const ui = setup([blur]);
    ui.createCustomSettingsUI(ui.container, ui.settings);
    const toggle = ui.container.querySelector('button');
    const content = ui.get(toggle.getAttribute('aria-controls'));
    assert.equal(content.inert, true);
    pressKey(toggle, 'Enter');
    assert.equal(content.inert, false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    pressKey(toggle, ' ');
    assert.equal(content.inert, true);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

test('compact select sizing is limited to Moonlit selects', () => {
    const css = readFileSync(new URL('../src/ui/settings-factory.css', import.meta.url), 'utf8');
    assert.match(css, /select\.moonlit-select\.widthNatural\.flex1\.margin0\s*\{/);
    assert.doesNotMatch(css, /(?:^|[\n,])\s*select\.widthNatural\.flex1\.margin0\s*\{/);
});
