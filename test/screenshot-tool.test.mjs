import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after, mock } from 'node:test';

const toolUrl = new URL('../tools/capture-sillybunny-screenshots.js', import.meta.url).href;
const playwrightImports = [];
const network = mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network access'); });
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.includes('playwright')) {
            playwrightImports.push(specifier);
            throw new Error('Playwright must not load in these tests');
        }
        const sources = {
            'node:fs': 'export function mkdirSync() { throw new Error("Unexpected file write"); }',
            'node:fs/promises': 'export function readFile() { throw new Error("Unexpected file read"); }',
            '/scripts/system-messages.js': 'export const getSystemMessageByType = (...args) => globalThis.screenshotHost.getSystemMessageByType(...args);',
            '/script.js': 'export const updateMessageElement = (...args) => globalThis.screenshotHost.updateMessageElement(...args);',
        };
        if (context.parentURL === toolUrl && Object.hasOwn(sources, specifier)) {
            return { url: `data:text/javascript,${encodeURIComponent(sources[specifier])}`, shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});
const { main, parseArgs, openBunnyGuideChat, captureSection, capture, shoot } = await import(toolUrl);
after(() => { hooks.deregister(); network.mock.restore(); });

function setup(t) {
    const previous = Object.fromEntries(['SillyTavern', 'document', 'screenshotHost'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    t.after(() => {
        for (const [key, descriptor] of Object.entries(previous)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
    t.mock.method(console, 'log', () => {});
    const guideMessages = [{ mes: 'Bundled example' }];
    const nodes = [];
    const makeNode = id => ({
        id, isConnected: false,
        scrollIntoView() {},
        remove() {
            const index = nodes.indexOf(this);
            if (index !== -1) nodes.splice(index, 1);
            this.isConnected = false;
        },
    });
    const original = makeNode('original');
    original.isConnected = true;
    nodes.push(original);
    const context = {
        characters: [
            { name: 'Bunny Guide', avatar: 'unrelated.png' },
            { name: 'Bunny Guide', avatar: 'default_SillyBunnyGuide.png' },
        ],
        characterId: 0,
        groupId: null,
        chatId: 'unrelated-chat',
        chat: [{ mes: 'Unrelated chat' }],
        async selectCharacterById(id, options) {
            env.selections.push([id, options]);
            context.characterId = id;
            context.chatId = 'guide-chat';
            context.chat = guideMessages;
            env.home = false;
        },
        sendSystemMessage() { assert.fail('Temporary messages must not enter chat history'); },
        saveChat() { assert.fail('The tool must not save chat history'); },
    };
    const env = {
        context, guideMessages, nodes, original, makeNode,
        selections: [], screenshots: [], handles: [], home: false, renders: [],
        welcome: { mes: 'Welcome', is_system: true, extra: { type: 'welcome' } },
    };
    globalThis.SillyTavern = { getContext: () => context };
    globalThis.document = {
        querySelector(selector) {
            if (selector === '.welcomePanel') return { checkVisibility: () => env.home };
            assert.equal(selector, '#chat');
            return {
                appendChild(node) {
                    nodes.push(node);
                    node.isConnected = true;
                    if (env.failAppend) throw new Error('Append failed after insertion');
                },
            };
        },
    };
    globalThis.screenshotHost = {
        getSystemMessageByType(type) { assert.equal(type, 'welcome'); return env.welcome; },
        updateMessageElement(message, options) {
            env.renders.push([message, options]);
            const node = makeNode('temporary');
            env.temporary = node;
            return [node];
        },
    };
    env.page = {
        async evaluate(fn, arg) { return fn(arg); },
        async evaluateHandle(fn, arg) {
            const state = await fn(arg);
            const handle = {
                state, disposed: false,
                async evaluate(callback, value) { return callback(state, value); },
                async dispose() { this.disposed = true; },
            };
            env.handles.push(handle);
            return handle;
        },
        async waitForTimeout() {},
        async waitForSelector() {},
        locator(selector) {
            return {
                first() { return this; },
                async isVisible() { return selector.includes('data-assistant-id') ? env.home : false; },
                async click() {
                    assert.equal(selector, '#sb-home-toggle');
                    context.characterId = undefined;
                    context.chatId = undefined;
                    context.chat = [];
                    env.home = true;
                },
                async screenshot(options) { env.screenshots.push({ selector, ...options }); },
            };
        },
        async screenshot(options) { env.screenshots.push(options); },
    };
    return env;
}

test('import, help and rejected arguments do not access the host, files or Playwright', async t => {
    const output = t.mock.method(console, 'log', () => {});
    assert.equal(network.mock.callCount(), 0);
    for (const args of [[], ['--disposable-test-profile=false']]) {
        await assert.rejects(main(args), /disposable-test-profile/);
    }
    for (const extra of [[], ['--disposable-test-profile'], ['--help']]) {
        await assert.rejects(main(['--desktop-only', '--mobile-only', ...extra]), /cannot be used together/);
    }
    await main(['--help']);
    await main(['-h']);
    assert.match(output.mock.calls[0].arguments[0], /disposable test profile/);
    assert.equal(network.mock.callCount(), 0);
    assert.deepEqual(playwrightImports, []);
    const config = parseArgs(['--disposable-test-profile', '--mobile-only', '--url=http://test.invalid', '--out=/unused']);
    assert.equal(config.baseURL, 'http://test.invalid');
    assert.equal(config.outDir, '/unused');
    assert.equal(config.mobileOnly, true);
    assert.equal(config.desktopOnly, false);
});

test('an already open chat is explicitly replaced by the stock Guide, not a matching display name', async t => {
    const env = setup(t);
    const target = await openBunnyGuideChat(env.page);
    assert.deepEqual(env.selections, [[1, { switchMenu: false }]]);
    assert.equal(env.context.chat, env.guideMessages);
    assert.equal(env.screenshots.length, 0);
    await target.dispose();
});

for (const failure of ['missing guide', 'selection refused', 'group still active']) {
    test(`capture rejects ${failure} before temporary messages or screenshots`, async t => {
        const env = setup(t);
        if (failure === 'missing guide') env.context.characters.pop();
        if (failure === 'selection refused') env.context.selectCharacterById = async () => false;
        if (failure === 'group still active') env.context.groupId = 0;
        await assert.rejects(captureSection(env.page, 'system-messages', '/unused'), /Bunny Guide/);
        assert.equal(env.renders.length, 0);
        assert.equal(env.screenshots.length, 0);
        assert.deepEqual(env.nodes, [env.original]);
    });
}

for (const failCapture of [false, true]) {
    test(`temporary content never enters saved chat and exact-node cleanup survives ${failCapture ? 'capture failure' : 'new messages'}`, async t => {
        const env = setup(t);
        const addedMessage = { mes: 'Another message' };
        const addedNode = env.makeNode('new-message');
        env.page.screenshot = async () => {
            assert.deepEqual(env.context.chat, [{ mes: 'Bundled example' }]);
            assert.equal(env.context.chat.includes(env.welcome), false);
            // Model a save and a new message while the temporary display is still present.
            env.savedChat = structuredClone(env.context.chat);
            env.context.chat.push(addedMessage);
            env.nodes.push(addedNode);
            if (failCapture) throw new Error('Capture failed');
        };
        const result = captureSection(env.page, 'system-messages', '/unused');
        if (failCapture) await assert.rejects(result, /Capture failed/);
        else await result;
        assert.deepEqual(env.renders, [[env.welcome, { messageId: -1 }]]);
        assert.deepEqual(env.savedChat, [{ mes: 'Bundled example' }]);
        assert.deepEqual(env.context.chat, [{ mes: 'Bundled example' }, addedMessage]);
        assert.deepEqual(env.nodes, [env.original, addedNode]);
        assert.equal(env.handles[0].disposed, true);
    });
}

for (const failure of ['append', 'visibility', 'missing welcome']) {
    test(`cleanup runs even when system-message setup fails at ${failure}`, async t => {
        const env = setup(t);
        env.failAppend = failure === 'append';
        if (failure === 'missing welcome') env.welcome = undefined;
        env.page.waitForSelector = async selector => {
            if (selector === '#moonlit-screenshot-system-message' && failure === 'visibility') throw new Error('Visibility failed');
        };
        await assert.rejects(captureSection(env.page, 'system-messages', '/unused'), /failed|unavailable/);
        assert.deepEqual(env.nodes, [env.original]);
        assert.deepEqual(env.context.chat, [{ mes: 'Bundled example' }]);
        assert.equal(env.screenshots.length, 0);
        assert.equal(env.handles[0].disposed, true);
    });
}

for (const change of ['character', 'chat', 'element']) {
    test(`capture aborts on a changed ${change} without removing unrelated content`, async t => {
        const env = setup(t);
        const replacement = env.makeNode('moonlit-screenshot-system-message');
        env.page.waitForTimeout = async () => {
            if (!env.temporary) return;
            if (change === 'character') env.context.characterId = 0;
            if (change === 'chat') env.context.chatId = 'different-guide-chat';
            if (change === 'element') env.temporary.remove();
            env.nodes.push(replacement);
        };
        await assert.rejects(captureSection(env.page, 'system-messages', '/unused'), /refusing capture/);
        assert.deepEqual(env.nodes, [env.original, replacement]);
        assert.equal(env.screenshots.length, 0);
        assert.equal(env.handles[0].disposed, true);
    });
}

test('Home capture selects and verifies Guide first, then permits only a visible Home with no chat', async t => {
    const env = setup(t);
    await captureSection(env.page, 'hero-home', '/unused');
    assert.equal(env.selections.length, 1);
    assert.equal(env.screenshots.length, 1);
    const target = await openBunnyGuideChat(env.page);
    env.context.characterId = 0;
    env.home = true;
    await assert.rejects(shoot(env.page, 'hero-home', '/unused', target), /refusing capture/);
    await assert.rejects(shoot(env.page, 'theme-presets', '/unused', target), /refusing capture/);
    env.context.characterId = undefined;
    env.home = false;
    await assert.rejects(shoot(env.page, 'hero-home', '/unused', target), /refusing capture/);
    assert.equal(env.screenshots.length, 1);
    await target.dispose();
});

for (const stage of ['context', 'page', 'navigation']) {
    test(`browser is closed on ${stage} setup failure`, async t => {
        t.mock.method(console, 'log', () => {});
        let closed = 0;
        const chromium = { async launch() {
            return {
                async newContext() {
                    if (stage === 'context') throw new Error('Setup failed');
                    return { async newPage() {
                        if (stage === 'page') throw new Error('Setup failed');
                        return { on() {}, async goto() { throw new Error('Setup failed'); } };
                    } };
                },
                async close() { closed += 1; },
            };
        } };
        await assert.rejects(capture(chromium, 'desktop', {}, parseArgs(['--disposable-test-profile'])), /Setup failed/);
        assert.equal(closed, 1);
    });
}
