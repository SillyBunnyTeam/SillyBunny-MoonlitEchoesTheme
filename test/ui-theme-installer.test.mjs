import assert from 'node:assert/strict';
import test from 'node:test';

import { REGEX_AGENT_UI_THEMES } from '../src/config/regex-agent-presets.generated.js';
import { installRegexAgentUiThemes } from '../src/services/ui-theme-installer.js';
import { installBundledUiThemes } from '../src/ui/ui-theme-installer-actions.js';

const requestHeaders = { 'X-CSRF-Token': 'test' };

async function withGlobals(values, callback) {
    const previous = new Map(Object.keys(values).map((name) => [name, {
        existed: Object.hasOwn(globalThis, name),
        value: globalThis[name],
    }]));

    Object.assign(globalThis, values);
    try {
        return await callback();
    } finally {
        for (const [name, { existed, value }] of previous) {
            if (existed) globalThis[name] = value;
            else delete globalThis[name];
        }
    }
}

function createEnvironment({ existingNames = [], inventory = () => ({ themes: existingNames.map(name => ({ name })) }), fetch } = {}) {
    const themeSelect = { options: existingNames.map(value => ({ value })) };
    const context = { getRequestHeaders: () => requestHeaders };

    return {
        SillyTavern: { getContext: () => context },
        document: {
            getElementById(id) {
                if (id === 'themes') return themeSelect;
                return null;
            },
        },
        fetch: async (url, options) => url === '/api/settings/get'
            ? { ok: true, json: inventory }
            : fetch(url, options),
    };
}

function createButton() {
    const attributes = new Map();
    return {
        disabled: false,
        innerHTML: '<span>Update</span>',
        setAttribute(name, value) {
            attributes.set(name, value);
        },
        getAttribute(name) {
            return attributes.get(name) ?? null;
        },
        removeAttribute(name) {
            attributes.delete(name);
        },
    };
}

test('default mode skips existing names without posting them', async () => {
    const existingName = REGEX_AGENT_UI_THEMES[0].name;
    const calls = [];
    const environment = createEnvironment({
        existingNames: [existingName],
        fetch: async (url, options) => {
            calls.push({ url, options });
            return { ok: true, status: 201 };
        },
    });

    await withGlobals(environment, async () => {
        const result = await installRegexAgentUiThemes();

        assert.deepEqual(result, { installed: 74, skipped: 1 });
        assert.equal(calls.length, 74);
        assert(calls.every(({ url }) => url === '/api/themes/create'));
        assert(calls.every(({ options }) => JSON.parse(options.body).name !== existingName));
    });
});

test('overwrite mode posts the full corrected Marshmallow theme', async () => {
    const marshmallow = REGEX_AGENT_UI_THEMES.find(({ name }) => name === 'Marshmallow - by platberlitz');
    const calls = [];
    const environment = createEnvironment({
        existingNames: [marshmallow.name],
        fetch: async (url, options) => {
            calls.push({ url, options });
            return { ok: true };
        },
    });

    await withGlobals(environment, async () => {
        const result = await installRegexAgentUiThemes({ overwriteExisting: true });

        const call = calls.find(({ options }) => JSON.parse(options.body).name === marshmallow.name);
        assert.deepEqual(result, { installed: 75, skipped: 0 });
        assert.equal(call.url, '/api/themes/save');
        assert.equal(call.options.method, 'POST');
        assert.deepEqual(call.options.headers, requestHeaders);
        assert.equal(call.options.body, JSON.stringify(marshmallow));
        assert.equal(JSON.parse(call.options.body).quote_text_color, 'rgba(17, 19, 24, 1)');
    });
});

test('overwrite mode installs every bundled theme when every name exists', async () => {
    const calls = [];
    const environment = createEnvironment({
        existingNames: REGEX_AGENT_UI_THEMES.map(({ name }) => name),
        fetch: async (url, options) => {
            calls.push({ url, options });
            return { ok: true };
        },
    });

    await withGlobals(environment, async () => {
        assert.deepEqual(await installRegexAgentUiThemes({ overwriteExisting: true }), { installed: 75, skipped: 0 });
        assert.equal(calls.length, 75);
    });
});

test('non-2xx responses reject with the failing theme name', async () => {
    const failingName = REGEX_AGENT_UI_THEMES[2].name;
    const environment = createEnvironment({
        fetch: async (url, options) => ({ ok: JSON.parse(options.body).name !== failingName }),
    });

    await withGlobals(environment, async () => {
        await assert.rejects(
            installRegexAgentUiThemes({ overwriteExisting: true }),
            error => error.message === `Failed to save UI theme "${failingName}"`,
        );
    });
});

test('repeated installs read fresh inventory and preserve edits despite a stale or missing dropdown', async () => {
    const stored = new Map();
    let reads = 0;
    let writes = 0;
    const environment = createEnvironment({
        existingNames: REGEX_AGENT_UI_THEMES.map(({ name }) => name),
        inventory: async () => { reads++; return { themes: [...stored.values()] }; },
        fetch: async (url, options) => {
            assert.equal(url, '/api/themes/create');
            const theme = JSON.parse(options.body);
            stored.set(theme.name, theme);
            writes++;
            return { ok: true, status: 201 };
        },
    });
    await withGlobals(environment, async () => {
        assert.deepEqual(await installRegexAgentUiThemes(), { installed: 75, skipped: 0 });
        stored.get(REGEX_AGENT_UI_THEMES[0].name).custom_css = 'personal edit';
        document.getElementById = () => null;
        assert.deepEqual(await installRegexAgentUiThemes(), { installed: 0, skipped: 75 });
        assert.equal(reads, 2);
        assert.equal(writes, 75);
        assert.equal(stored.get(REGEX_AGENT_UI_THEMES[0].name).custom_css, 'personal edit');
    });
});

test('concurrent creates count conflicts as skipped and preserve the winner', async () => {
    const stored = new Map([[REGEX_AGENT_UI_THEMES[0].name, { personal: true }]]);
    const environment = createEnvironment({
        // Both calls see inventory from before another tab saved its personal theme.
        fetch: async (url, options) => {
            assert.equal(url, '/api/themes/create');
            const theme = JSON.parse(options.body);
            if (stored.has(theme.name)) return { ok: false, status: 409 };
            stored.set(theme.name, theme);
            return { ok: true, status: 201 };
        },
    });
    await withGlobals(environment, async () => {
        const results = await Promise.all([installRegexAgentUiThemes(), installRegexAgentUiThemes()]);
        assert.equal(results.reduce((sum, result) => sum + result.installed, 0), 74);
        assert.equal(results.reduce((sum, result) => sum + result.skipped, 0), 76);
        assert.deepEqual(stored.get(REGEX_AGENT_UI_THEMES[0].name), { personal: true });
    });
});

test('partial failure retries obtain fresh inventory and leave successful or edited themes alone', async () => {
    const stored = new Map();
    let fail = true;
    let reads = 0;
    const writes = [];
    const environment = createEnvironment({
        inventory: async () => { reads++; return { themes: [...stored.values()] }; },
        fetch: async (url, options) => {
            assert.equal(url, '/api/themes/create');
            const theme = JSON.parse(options.body);
            if (fail && stored.size === 2) return { ok: false, status: 500 };
            writes.push(theme.name);
            stored.set(theme.name, theme);
            return { ok: true, status: 201 };
        },
    });
    await withGlobals(environment, async () => {
        await assert.rejects(installRegexAgentUiThemes(), /Failed to save/);
        stored.get(REGEX_AGENT_UI_THEMES[0].name).custom_css = 'edited after partial install';
        fail = false;
        assert.deepEqual(await installRegexAgentUiThemes(), { installed: 73, skipped: 2 });
        assert.equal(reads, 2);
        assert.equal(new Set(writes).size, writes.length);
        assert.equal(stored.get(REGEX_AGENT_UI_THEMES[0].name).custom_css, 'edited after partial install');
    });
});

test('inventory failures and malformed inventories stop before any write', async () => {
    const responses = [
        { ok: false, status: 500 },
        { ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } },
        ...[null, {}, { themes: null }, { themes: {} }, { themes: ['theme'] },
            { themes: [null] }, { themes: [{ name: '' }] }, { themes: [{ name: '   ' }] },
            { themes: [{ name: 'valid' }, { name: 42 }] }]
            .map(data => ({ ok: true, json: async () => data })),
    ];
    for (const response of responses) {
        const environment = createEnvironment();
        const urls = [];
        environment.fetch = async (url, options) => {
            urls.push(url);
            assert.equal(options.method, 'POST');
            assert.equal(options.cache, 'no-store');
            assert.deepEqual(options.headers, requestHeaders);
            return response;
        };
        await withGlobals(environment, async () => {
            await assert.rejects(installRegexAgentUiThemes());
            assert.deepEqual(urls, ['/api/settings/get']);
        });
    }
});

test('old hosts and unexpected create responses fail without falling back to overwrite', async () => {
    for (const status of [404, 200]) {
        const urls = [];
        const environment = createEnvironment({
            fetch: async url => { urls.push(url); return { ok: status === 200, status }; },
        });
        await withGlobals(environment, async () => {
            await assert.rejects(installRegexAgentUiThemes(), status === 404 ? /requires an updated.*host/ : /Failed to save/);
            assert.deepEqual(urls, ['/api/themes/create']);
        });
    }
});

test('only explicit true enables overwrite and overwrite conflicts are failures, not skips', async () => {
    const urls = [];
    const environment = createEnvironment({
        inventory: async () => ({ themes: REGEX_AGENT_UI_THEMES }),
        fetch: async url => { urls.push(url); return { ok: false, status: 409 }; },
    });
    await withGlobals(environment, async () => {
        assert.deepEqual(await installRegexAgentUiThemes({ overwriteExisting: 'true' }), { installed: 0, skipped: 75 });
        await assert.rejects(installRegexAgentUiThemes({ overwriteExisting: true }), /Failed to save/);
        assert.deepEqual(urls, ['/api/themes/save']);
    });
});

test('reinstall confirmation can cancel without touching the button or installer', async () => {
    const button = createButton();
    let installCalls = 0;

    await installBundledUiThemes({ currentTarget: button }, {
        overwriteExisting: true,
        confirmAction: () => false,
        install: async () => { installCalls += 1; },
    });

    assert.equal(installCalls, 0);
    assert.equal(button.disabled, false);
    assert.equal(button.innerHTML, '<span>Update</span>');
    assert.equal(button.getAttribute('aria-busy'), null);
});

test('reinstall restores the button after success and reports reload guidance', async () => {
    const button = createButton();
    const successMessages = [];
    let pendingState;

    await installBundledUiThemes({ currentTarget: button }, {
        overwriteExisting: true,
        confirmAction: () => true,
        install: async options => {
            pendingState = { options, disabled: button.disabled, busy: button.getAttribute('aria-busy') };
            return { installed: 75, skipped: 0 };
        },
        toast: { success: message => successMessages.push(message) },
    });

    assert.deepEqual(pendingState, {
        options: { overwriteExisting: true },
        disabled: true,
        busy: 'true',
    });
    assert.equal(button.disabled, false);
    assert.equal(button.innerHTML, '<span>Update</span>');
    assert.equal(button.getAttribute('aria-busy'), null);
    assert.match(successMessages[0], /Reload SillyBunny/);
});

test('reinstall restores the button and reports failures', async () => {
    const button = createButton();
    const errorMessages = [];
    const logged = [];
    const failure = new Error('network down');

    await installBundledUiThemes({ currentTarget: button }, {
        overwriteExisting: true,
        confirmAction: () => true,
        install: async () => { throw failure; },
        toast: { error: message => errorMessages.push(message) },
        log: (...args) => logged.push(args),
    });

    assert.equal(button.disabled, false);
    assert.equal(button.innerHTML, '<span>Update</span>');
    assert.equal(button.getAttribute('aria-busy'), null);
    assert.equal(errorMessages.length, 1);
    assert.deepEqual(logged[0], ['Failed to reinstall/update bundled UI themes', failure]);
});
