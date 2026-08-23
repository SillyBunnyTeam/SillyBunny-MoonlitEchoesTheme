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

function createEnvironment({ existingNames = [], fetch } = {}) {
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
        fetch,
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
            return { ok: true };
        },
    });

    await withGlobals(environment, async () => {
        const result = await installRegexAgentUiThemes();

        assert.deepEqual(result, { installed: 74, skipped: 1 });
        assert.equal(calls.length, 74);
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
        assert.equal(JSON.parse(call.options.body).quote_text_color, 'rgba(247, 143, 179, 1)');
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
