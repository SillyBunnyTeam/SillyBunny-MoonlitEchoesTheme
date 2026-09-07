import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/ui/popout.js', import.meta.url), 'utf8').replace(/^export /gm, '');

function setup({ style, open = false, instantAnimations = false } = {}) {
    const document = { events: new Map() };
    class Element {
        constructor(tag = 'div') {
            this.tagName = tag.toUpperCase();
            this.children = [];
            this.attributes = new Map();
            this.events = new Map();
            this.classes = new Set();
            this.style = {};
            this.textContent = '';
        }
        get id() { return this.getAttribute('id') || ''; }
        set id(value) { this.setAttribute('id', value); }
        get isConnected() { return document.body.contains(this); }
        get parentElement() { return this.parentNode; }
        setAttribute(name, value) {
            this.attributes.set(name, String(value));
            if (name === 'class') this.classes = new Set(value.split(/\s+/));
            if (name === 'inert') this.inert = true;
            if (name === 'style') this.style = Object.fromEntries(value.split(';').filter(part => part.includes(':'))
                .map(part => part.split(':').map(value => value.trim())));
        }
        getAttribute(name) { return this.attributes.get(name) ?? null; }
        removeAttribute(name) {
            this.attributes.delete(name);
            if (name === 'style') this.style = {};
        }
        setCss(name, value) {
            this.style[name] = value;
            this.attributes.set('style', Object.entries(this.style).map(([key, value]) => `${key}: ${value};`).join(' '));
        }
        append(...nodes) {
            for (const node of nodes) {
                node.remove();
                this.children.push(node);
                node.parentNode = this;
            }
        }
        insertBefore(node, anchor) {
            node.remove();
            this.children.splice(this.children.indexOf(anchor), 0, node);
            node.parentNode = this;
        }
        before(node) { this.parentNode.insertBefore(node, this); }
        remove() {
            if (this.parentNode) {
                const siblings = this.parentNode.children;
                siblings.splice(siblings.indexOf(this), 1);
                this.parentNode = null;
            }
        }
        contains(node) { return node === this || this.children.some(child => child.contains(node)); }
        matches(selector) {
            if (selector.startsWith('#')) return this.id === selector.slice(1);
            if (selector.startsWith('.')) return this.classes.has(selector.slice(1));
            if (selector === 'dialog[open]') return this.tagName === 'DIALOG' && this.attributes.has('open');
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
        focus(options) {
            if (!this.isConnected) return;
            for (let node = this; node; node = node.parentNode) {
                if (node.inert || node.style.display === 'none') return;
            }
            document.activeElement = this;
            this.focusOptions = options;
        }
        click() { this.clickCount = (this.clickCount || 0) + 1; emit(this, 'click'); }
    }
    document.body = new Element('body');
    document.activeElement = document.body;
    document.createComment = () => new Element('#comment');
    document.querySelectorAll = selector => document.body.querySelectorAll(selector);
    document.querySelector = selector => document.body.querySelector(selector);
    document.getElementById = id => document.querySelector(`#${id}`);

    function emit(node, type, properties = {}) {
        const event = { target: node, currentTarget: node, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }, ...properties };
        for (const [name, handlers] of [...node.events]) {
            if (name.split('.')[0] === type) handlers.slice().forEach(handler => handler(event));
        }
        return event;
    }

    const animations = [];
    class Wrapper {
        constructor(nodes) { this.nodes = nodes; this.length = nodes.length; Object.assign(this, nodes); }
        find(selector) { return new Wrapper(this.nodes.flatMap(node => node.querySelectorAll(selector))); }
        attr(name, value) {
            if (value === undefined) return this[0]?.getAttribute(name) ?? undefined;
            this.nodes.forEach(node => node.setAttribute(name, value));
            return this;
        }
        removeAttr(name) { this.nodes.forEach(node => node.removeAttribute(name)); return this; }
        hasClass(name) { return this[0]?.classes.has(name) ?? false; }
        addClass(name) { this.nodes.forEach(node => node.classes.add(name)); return this; }
        removeClass(name) { this.nodes.forEach(node => node.classes.delete(name)); return this; }
        toggleClass(name, enabled) { return enabled ? this.addClass(name) : this.removeClass(name); }
        append(child) { this[0].append(...$(child).nodes); return this; }
        appendTo(parent) { $(parent).append(this); return this; }
        detach() { this.nodes.forEach(node => node.remove()); return this; }
        remove() { this.nodes.forEach(node => { node.remove(); node.events.clear(); }); return this; }
        css(name, value) { this.nodes.forEach(node => node.setCss(name, value)); return this; }
        show() { return this.css('display', 'block'); }
        hide() { return this.css('display', 'none'); }
        on(name, handler) {
            this.nodes.forEach(node => node.events.set(name, [...(node.events.get(name) || []), handler]));
            return this;
        }
        off(name) { this.nodes.forEach(node => node.events.delete(name)); return this; }
        stop() { this.nodes.forEach(node => node.animation?.finish(true)); return this; }
        fadeIn() { this.show(); return this.animate('in'); }
        fadeOut() { return this.animate('out'); }
        animate(direction) {
            const node = this[0];
            const animation = {
                callbacks: [], done: false,
                finish(cancelled = false) {
                    if (this.done) return;
                    this.done = true;
                    if (!cancelled) node.setCss('display', direction === 'in' ? 'block' : 'none');
                    this.callbacks.forEach(callback => callback());
                },
            };
            node.animation = animation;
            animations.push(animation);
            if (instantAnimations) animation.finish();
            return this;
        }
        promise() {
            const animation = this[0].animation;
            return { always(callback) {
                if (animation.done) callback();
                else animation.callbacks.push(callback);
            } };
        }
    }

    function $(value) {
        if (value instanceof Wrapper) return value;
        if (typeof value !== 'string') return new Wrapper(value ? [value] : []);
        if (!value.trim().startsWith('<')) return new Wrapper(document.querySelectorAll(value));
        // Parse the actual popout template so IDs, native tags and labels are tested, not supplied by the substitute.
        const root = new Element('fragment');
        const stack = [root];
        for (const token of value.matchAll(/<\/?([\w-]+)([^>]*)>|([^<]+)/g)) {
            if (token[0].startsWith('</')) stack.pop();
            else if (token[1]) {
                const node = new Element(token[1]);
                for (const attribute of token[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
                    node.setAttribute(attribute[1], attribute[2] ?? '');
                }
                stack.at(-1).append(node);
                stack.push(node);
            } else stack.at(-1).textContent += token[3].trim();
        }
        return new Wrapper([...root.children]);
    }

    const moving = new Element();
    moving.id = 'movingDivs';
    const drawer = new Element();
    drawer.id = 'moonlit-drawer';
    const header = new Element();
    header.classes.add('inline-drawer-header');
    const content = new Element();
    content.classes.add('inline-drawer-content');
    if (open) { content.classes.add('open'); header.classes.add('open'); }
    if (style !== undefined) content.setAttribute('style', style);
    const input = new Element('textarea');
    input.value = 'Unsubmitted input';
    content.append(input);
    const sibling = new Element();
    drawer.append(header, content, sibling);
    const launcher = new Element('button');
    document.body.append(drawer, moving, launcher);
    launcher.focus();

    const api = runInNewContext(`${source}\n({ configurePopout, openPopout, closePopout, togglePopout, isPopoutVisible })`, { document, $ });
    const dragged = [], grips = [], visibility = [];
    let loads = 0;
    api.configurePopout({
        settingsKey: 'moonlit',
        dragElement($node) {
            dragged.push($node[0]);
            grips.push(document.getElementById(`${$node[0].id}header`));
            $(document).on('mouseup', () => {});
        },
        loadMovingUIState: () => { loads++; },
        onVisibilityChange: visible => visibility.push(visible),
    });
    return {
        ...api, $, document, Element, drawer, header, content, input, sibling, launcher,
        dragged, grips, visibility, animations, get loads() { return loads; },
        emit, get: id => document.getElementById(id),
        finish: () => animations.filter(animation => !animation.done).forEach(animation => animation.finish()),
        key: (key, properties) => emit(document, 'keydown', { key, ...properties }),
    };
}

test('popout restores the original drawer node, order, style attribute and open state', () => {
    for (const style of [undefined, '', 'display: none; color: red; padding: 4px !important;']) {
        for (const open of [false, true]) {
            const ui = setup({ style, open });
            let changes = 0;
            ui.$(ui.input).on('change', () => changes++);
            ui.openPopout();
            ui.finish();
            const popout = ui.get('moonlit_echoes_popout');
            assert.equal(ui.content.parentNode, ui.get('moonlit_echoes_content_container'));
            assert.equal(ui.content.children[0], ui.input);
            assert.equal(ui.input.value, 'Unsubmitted input');
            ui.closePopout();
            assert.equal(popout.inert, true);
            ui.finish();
            assert.deepEqual(ui.drawer.children, [ui.header, ui.content, ui.sibling]);
            assert.equal(ui.content.getAttribute('style'), style ?? null);
            assert.equal(ui.content.classes.has('open'), open);
            assert.equal(ui.header.classes.has('open'), open);
            assert.equal(ui.get('moonlit_echoes_popout'), popout);
            assert.equal(popout.style.display, 'none');
            assert.equal(ui.isPopoutVisible(), false);
            ui.emit(ui.input, 'change');
            assert.equal(changes, 1);
        }
    }
});

test('one labelled non-modal popout and one host drag initialisation survive repeated opens', () => {
    const ui = setup();
    let popout;
    for (let index = 0; index < 12; index++) {
        ui.togglePopout({ currentTarget: ui.launcher });
        ui.openPopout();
        ui.finish();
        popout ??= ui.get('moonlit_echoes_popout');
        assert.equal(ui.get('moonlit_echoes_popout'), popout);
        assert.equal(popout.getAttribute('role'), 'dialog');
        assert.equal(popout.getAttribute('aria-modal'), 'false');
        assert.equal(ui.get(popout.getAttribute('aria-labelledby')).textContent, 'Moonlit Echoes Theme');
        assert.equal(popout.inert, false);
        const close = popout.querySelector('.dragClose');
        assert.equal(close.tagName, 'BUTTON');
        assert.equal(close.getAttribute('type'), 'button');
        assert.match(close.getAttribute('aria-label'), /Close.*Moonlit Echoes/);
        assert.equal(close.classes.has('menu_button'), false);
        assert.equal(ui.document.activeElement, close);
        assert.equal(close.events.get('click').length, 1);
        close.click();
        ui.finish();
        assert.equal(ui.document.activeElement, ui.launcher);
        assert.equal(ui.launcher.focusOptions.preventScroll, true);
        assert.equal(ui.document.events.has('keydown.moonlit_popout'), false);
    }
    assert.equal(ui.dragged.length, 1);
    assert.equal(ui.grips[0], ui.get('moonlit_echoes_popoutheader'));
    assert.ok(ui.grips[0].classes.has('drag-grabber'));
    assert.equal(ui.document.events.get('mouseup').length, 1);
    assert.equal(ui.document.querySelectorAll('#moonlit_echoes_popout').length, 1);
    assert.equal(ui.loads, 12);
    ui.content.setAttribute('style', 'display: block; color: blue;');
    ui.content.classes.add('open');
    ui.openPopout();
    ui.finish();
    ui.closePopout();
    ui.finish();
    assert.equal(ui.content.getAttribute('style'), 'display: block; color: blue;');
    assert.equal(ui.content.classes.has('open'), true);
});

test('interrupted fades and stale completions cannot restore or hide a reopened popout', () => {
    const ui = setup();
    ui.openPopout();
    const firstOpen = ui.animations.at(-1);
    ui.closePopout();
    const firstClose = ui.animations.at(-1);
    ui.openPopout();
    ui.finish();
    for (const animation of [firstOpen, firstClose]) animation.callbacks.forEach(callback => callback());
    assert.equal(ui.isPopoutVisible(), true);
    assert.equal(ui.get('moonlit_echoes_popout').style.display, 'block');
    assert.equal(ui.get('moonlit_echoes_popout').inert, false);
    assert.equal(ui.content.parentNode, ui.get('moonlit_echoes_content_container'));
    assert.equal(ui.dragged.length, 1);
    ui.closePopout();
    ui.closePopout();
    ui.finish();
    assert.deepEqual(ui.drawer.children, [ui.header, ui.content, ui.sibling]);
    assert.equal(ui.document.activeElement, ui.launcher);
});

test('reentrant dependency and visibility callbacks preserve close/reopen ownership', () => {
    for (const hook of ['dragElement', 'loadMovingUIState', 'onVisibilityChange']) {
        const ui = setup();
        let calls = 0;
        ui.configurePopout({ [hook]: () => {
            if (calls++ === 0) { ui.closePopout(); ui.openPopout(); }
        } });
        ui.openPopout();
        ui.finish();
        const popout = ui.get('moonlit_echoes_popout');
        assert.equal(ui.isPopoutVisible(), true, hook);
        assert.equal(ui.content.parentNode, ui.get('moonlit_echoes_content_container'), hook);
        ui.closePopout();
        ui.finish();
        assert.equal(ui.content.parentNode, ui.drawer, hook);
        ui.openPopout();
        ui.finish();
        assert.equal(ui.get('moonlit_echoes_popout'), popout, hook);
        if (hook === 'dragElement') assert.equal(calls, 1);
    }
    const ui = setup();
    ui.openPopout();
    ui.finish();
    ui.configurePopout({ onVisibilityChange: visible => { if (!visible) ui.openPopout(); } });
    ui.closePopout();
    ui.finish();
    assert.equal(ui.isPopoutVisible(), true);
    assert.equal(ui.content.parentNode, ui.get('moonlit_echoes_content_container'));
});

test('detached setup is restored and reuses its cached popout without another drag initialisation', () => {
    for (const target of ['popout', 'drawer-content']) {
        const ui = setup({ style: 'display: none;', open: false });
        let first = true;
        ui.configurePopout({ loadMovingUIState: () => {
            if (first) {
                first = false;
                (target === 'popout' ? ui.get('moonlit_echoes_popout') : ui.content).remove();
            }
        } });
        ui.openPopout();
        assert.equal(ui.isPopoutVisible(), false);
        assert.equal(ui.content.parentNode, ui.drawer);
        assert.equal(ui.content.getAttribute('style'), 'display: none;');
        ui.openPopout();
        ui.finish();
        assert.equal(ui.isPopoutVisible(), true);
        assert.equal(ui.dragged.length, 1);
        assert.equal(ui.get('moonlit_echoes_popout'), ui.dragged[0]);
    }
});

test('reserved host IDs and missing or duplicate containers prevent mutation', () => {
    for (const id of ['moonlit_echoes_popout', 'moonlit_echoes_popoutheader', 'moonlit_echoes_popout_title', 'moonlit_echoes_content_container', 'movingDivs']) {
        const ui = setup();
        const collision = new ui.Element();
        collision.id = id;
        ui.document.body.append(collision);
        ui.openPopout();
        assert.equal(ui.isPopoutVisible(), false, id);
        assert.deepEqual(ui.drawer.children, [ui.header, ui.content, ui.sibling], id);
        assert.equal(ui.dragged.length, 0, id);
    }
    const ui = setup();
    ui.header.remove();
    ui.openPopout();
    assert.equal(ui.get('moonlit_echoes_popout'), null);
    assert.equal(ui.content.parentNode, ui.drawer);

    const cached = setup();
    cached.openPopout();
    cached.finish();
    cached.closePopout();
    cached.finish();
    const popout = cached.get('moonlit_echoes_popout');
    const collision = new cached.Element();
    collision.id = 'moonlit_echoes_popoutheader';
    cached.document.body.append(collision);
    cached.openPopout();
    assert.equal(cached.isPopoutVisible(), false);
    assert.equal(cached.content.parentNode, cached.drawer);
    collision.remove();
    cached.openPopout();
    cached.finish();
    assert.equal(cached.get('moonlit_echoes_popout'), popout);
    assert.equal(cached.dragged.length, 1);
});

test('Escape defers to prevented events and host dialogs, while Tab remains untrapped', () => {
    const ui = setup();
    ui.openPopout();
    ui.finish();
    ui.key('Escape', { defaultPrevented: true });
    assert.equal(ui.isPopoutVisible(), true);
    ui.key('Escape', { isDefaultPrevented: () => true });
    assert.equal(ui.isPopoutVisible(), true);
    const dialog = new ui.Element('dialog');
    dialog.setAttribute('open', '');
    ui.document.body.append(dialog);
    dialog.focus();
    assert.equal(ui.key('Escape').defaultPrevented, false);
    assert.equal(ui.isPopoutVisible(), true);
    dialog.setAttribute('closing', '');
    ui.key('Escape');
    assert.equal(ui.isPopoutVisible(), true);
    dialog.remove();
    assert.equal(ui.key('Tab').defaultPrevented, false);
    ui.launcher.focus();
    assert.equal(ui.document.activeElement, ui.launcher);
    assert.equal(ui.isPopoutVisible(), true);
    assert.equal(ui.key('Escape').defaultPrevented, true);
    ui.finish();
    assert.equal(ui.isPopoutVisible(), false);
    assert.equal(ui.document.activeElement, ui.launcher);
});

test('focus returns to the supplied launcher and never moves out of an active host dialog', () => {
    const ui = setup();
    const launcher = new ui.Element('button');
    ui.document.body.append(launcher);
    ui.togglePopout({ currentTarget: launcher });
    ui.finish();
    ui.closePopout();
    ui.finish();
    assert.equal(ui.document.activeElement, launcher);

    const dialog = new ui.Element('dialog');
    dialog.setAttribute('open', '');
    ui.document.body.append(dialog);
    dialog.focus();
    ui.openPopout(launcher);
    ui.finish();
    assert.equal(ui.document.activeElement, dialog);
    ui.closePopout();
    ui.finish();
    assert.equal(ui.document.activeElement, dialog);
    dialog.remove();
    ui.openPopout(launcher);
    launcher.remove();
    ui.closePopout();
    assert.doesNotThrow(ui.finish);
    assert.equal(ui.content.parentNode, ui.drawer);
});

test('synchronous fades, removed anchors and optional helper failures do not lose drawer content', () => {
    const ui = setup({ instantAnimations: true });
    ui.configurePopout({ loadMovingUIState: () => { throw new Error('Unavailable'); } });
    ui.openPopout();
    assert.equal(ui.isPopoutVisible(), true);
    ui.drawer.children.find(node => node.tagName === '#COMMENT').remove();
    ui.closePopout();
    assert.equal(ui.isPopoutVisible(), false);
    assert.equal(ui.content.parentNode, ui.drawer);
    assert.equal(ui.content.getAttribute('style'), null);
    ui.openPopout();
    ui.closePopout();
    assert.equal(ui.dragged.length, 1);

    const failing = setup({ instantAnimations: true });
    let dragAttempts = 0;
    failing.configurePopout({ dragElement: () => {
        dragAttempts++;
        failing.$(failing.document).on('mouseup', () => {});
        throw new Error('Failed after registering a listener');
    } });
    for (let index = 0; index < 3; index++) {
        failing.openPopout();
        failing.closePopout();
    }
    assert.equal(dragAttempts, 1);
    assert.equal(failing.document.events.get('mouseup').length, 1);
    assert.equal(failing.content.parentNode, failing.drawer);
});
