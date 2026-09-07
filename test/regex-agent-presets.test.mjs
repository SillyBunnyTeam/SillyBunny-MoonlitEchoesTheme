import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
    REGEX_AGENT_PRESET_CATALOG_VERSION,
    REGEX_AGENT_PRESETS,
} from '../src/config/regex-agent-presets.generated.js';
import { seedRegexAgentPresets } from '../src/config/regex-agent-presets.js';

// Load the real setting definitions without a SillyTavern host or its translation service.
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === '../../../../../i18n.js') {
            return { url: 'data:text/javascript,export const t = String.raw;', shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});
const { BUILT_IN_PRESET_NAME, defaultSettings, ensureSettingsStructure } = await import('../src/config/default-settings.js');
const { themeCustomSettings } = await import('../src/config/theme-settings.js');
hooks.deregister();

// Independent snapshots from 1e405fd (v1), ad503fe (v2), and ad642b9 (v3).
// Never build historical fixtures from the current catalogue or its migration metadata.
const DEFAULTS = {
    customThemeColor: 'rgba(81, 160, 222, 1)',
    customThemeColor2: 'rgba(250, 198, 121, 1)',
    customBgColor1: 'rgba(255, 255, 255, 0.1)',
    customBgColor2: 'rgba(255, 255, 255, 0.05)',
    customTopBarColor: 'rgba(23, 23, 23, 0.7)',
    'Drawer-iconColor': 'rgba(255, 255, 255, 0.8)',
    sheldBackgroundColor: 'rgba(0, 0, 0, 0.2)',
    customScrollbarColor: 'rgba(255, 255, 255, 0.5)',
    hideAvatarBorder: false,
    'custom-ChatAvatar': '40px',
    mesParagraphSpacingTop: '0.4em',
    mesParagraphSpacingBottom: '0.6em',
    charNameFontSize: 'inherit',
    userNameFontSize: 'inherit',
    messageTextFontSize: '15px',
    messageLineHeight: '',
    messageTextLetterSpacing: 'inherit',
    customlastInContext: '1px solid var(--customThemeColor)',
    'customCSS-bg-blur': '3',
    'customCSS-bg-opacity': '1',
    sheldBlurStrength: '5',
    mobileSheldBlurStrength: '0',
    enableThemeColorization: false,
    disableTopMenuAnimation: false,
    forceFixedMenuHeight: true,
    newMenuMaxHeight: false,
    disableAllBorderRadius: false,
    expandEntryInputWidth: true,
    compactWorldsLorebooksTopBar: true,
    rawCustomCss: '',
    'customCSS-ChatGradientBlur': 'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 2%, rgba(0, 0, 0, 1) 98%, rgba(0, 0, 0, 0) 100%)',
    showLLMReasoningIcon: false,
    justifyParagraphText: false,
    enableMessageDetails: false,
    messageDetailsAnimationDuration: '0.8s',
    favoriteSymbol: '"\u2665\ufe0e"',
    favoriteSymbolAnimation: true,
    'VN-sheld-height': '40dvh',
    'VN-expression-holder': 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 90%, rgba(0, 0, 0, 0) 100%)',
    'custom-EchoAvatarWidth': '25%',
    'custom-EchoAvatarHeight': '300px',
    'custom-EchoAvatarMobileWidth': '25%',
    'custom-EchoAvatarMobileHeight': '250px',
    hideEchoUserIllustration: false,
    hideMobileEchoBackground: false,
    customWhisperAvatarWidth: '50%',
    customWhisperAvatarAlign: 'center',
    customRippleAvatarWidth: '180px',
    customRippleAvatarMobileWidth: '100px',
    hideRippleUserAvatar: false,
    'enableMobile-hidden_scrollbar': true,
    'enableMobile-send_form': false,
    inlineMobileMeta: false,
    increaseMobileInputSpacing: false,
    increaseDesktopInputSpacing: false,
    fixTabletMenuLayout: false,
    mobileQRsBarHeight: '2',
    'enableMobile-horizontal_qrs': false,
    moveQRsBelowInputMobile: true,
    'enableMobile-horizontal_hotswap': false,
};
const MARSHMALLOW = 'Marshmallow - by platberlitz';
const GAME_BOY = 'Game Boy DMG - by platberlitz';
const BUBBLE_TEA = 'Bubble Tea - by platberlitz';
const ADAPTIVE_INK = 'Adaptive Ink - by platberlitz';
const V1 = {
    [MARSHMALLOW]: {
        customThemeColor: 'rgba(17, 19, 24, 1)',
        customThemeColor2: 'rgba(17, 19, 24, 1)',
        customBgColor1: 'rgba(255, 238, 245, 1)',
        customBgColor2: 'rgba(255, 248, 251, 1)',
        customTopBarColor: 'rgba(255, 230, 240, 1)',
        'Drawer-iconColor': 'rgba(138, 79, 109, 1)',
        sheldBackgroundColor: 'rgba(255, 249, 252, 1)',
        customScrollbarColor: 'rgba(255, 196, 220, 1)',
        customlastInContext: '4px solid rgba(17, 19, 24, 1)',
        rawCustomCss: '',
    },
    [ADAPTIVE_INK]: {
        customThemeColor: 'color-mix(in srgb, var(--SmartThemeQuoteColor, #bd93f9) 88%, var(--SmartThemeBodyColor, #f8f8f2))',
        customThemeColor2: 'color-mix(in srgb, var(--SmartThemeEmColor, #8be9fd) 80%, var(--SmartThemeBodyColor, #f8f8f2))',
        customBgColor1: 'color-mix(in srgb, var(--SmartThemeQuoteColor, #bd93f9) 10%, transparent)',
        customBgColor2: 'transparent',
        customTopBarColor: 'transparent',
        'Drawer-iconColor': 'var(--SmartThemeBodyColor, #f8f8f2)',
        sheldBackgroundColor: 'transparent',
        customScrollbarColor: 'color-mix(in srgb, var(--SmartThemeBodyColor, #f8f8f2) 48%, transparent)',
        customlastInContext: 'none',
        rawCustomCss: '',
    },
};
const V2 = {
    [GAME_BOY]: {
        customThemeColor: 'rgba(251, 251, 253, 1)',
        customThemeColor2: 'rgba(251, 251, 253, 1)',
        customBgColor1: 'rgba(20, 41, 20, 0.1)',
        customBgColor2: 'rgba(65, 79, 6, 0.05)',
        customTopBarColor: 'rgba(20, 41, 20, 0.7)',
        'Drawer-iconColor': 'rgba(251, 251, 253, 1)',
        sheldBackgroundColor: 'rgba(58, 72, 6, 0.2)',
        customScrollbarColor: 'rgba(15, 56, 15, 1)',
        customlastInContext: '4px solid rgba(251, 251, 253, 1)',
        rawCustomCss: '',
    },
    [BUBBLE_TEA]: {
        customThemeColor: 'rgba(17, 19, 24, 1)',
        customThemeColor2: 'rgba(17, 19, 24, 1)',
        customBgColor1: 'rgba(243, 228, 211, 0.1)',
        customBgColor2: 'rgba(255, 253, 250, 0.05)',
        customTopBarColor: 'rgba(222, 196, 171, 0.7)',
        'Drawer-iconColor': 'rgba(74, 52, 35, 1)',
        sheldBackgroundColor: 'rgba(250, 242, 234, 0.2)',
        customScrollbarColor: 'rgba(196, 161, 132, 1)',
        customlastInContext: '5px solid rgba(17, 19, 24, 1)',
        rawCustomCss: '',
    },
    [ADAPTIVE_INK]: {
        ...V1[ADAPTIVE_INK],
        customTopBarColor: 'color-mix(in srgb, transparent 70%, transparent)',
        sheldBackgroundColor: 'color-mix(in srgb, transparent 20%, transparent)',
    },
};
const V3 = {
    [MARSHMALLOW]: {
        ...V1[MARSHMALLOW],
        customBgColor1: 'rgba(255, 238, 245, 0.1)',
        customBgColor2: 'rgba(255, 248, 251, 0.05)',
        customTopBarColor: 'rgba(255, 230, 240, 0.7)',
        sheldBackgroundColor: 'rgba(255, 249, 252, 0.65)',
    },
};

test('live defaults still match the independent 60-setting historical snapshot', () => {
    assert.equal(themeCustomSettings.length, 60);
    assert.deepEqual(Object.fromEntries(themeCustomSettings.map(({ varId, default: value }) => [varId, value])), DEFAULTS);
    assert.equal(Object.keys(defaultSettings.presets).length, 79);
    assert.equal(defaultSettings.regexAgentPresetCatalogVersion, 4);
});

test('seeds the catalog once without changing user state or collisions', () => {
    const collision = { custom: 'keep me', customBgColor1: V1[MARSHMALLOW].customBgColor1 };
    const settings = {
        activePreset: 'User Preset',
        presets: {
            'User Preset': { custom: 'user' },
            [MARSHMALLOW]: collision,
        },
    };
    const before = structuredClone(settings);

    seedRegexAgentPresets(settings, DEFAULTS);

    assert.equal(settings.regexAgentPresetCatalogVersion, REGEX_AGENT_PRESET_CATALOG_VERSION);
    assert.equal(settings.activePreset, 'User Preset');
    assert.equal(settings.presets[MARSHMALLOW], collision);
    assert.deepEqual(collision, before.presets[MARSHMALLOW]);
    assert.deepEqual(settings.presets['User Preset'], before.presets['User Preset']);
    assert.equal(settings.presets[GAME_BOY].messageTextFontSize, DEFAULTS.messageTextFontSize);
    assert(REGEX_AGENT_PRESETS.every(({ name }) => Object.hasOwn(settings.presets, name)));

    delete settings.presets[GAME_BOY];
    const seeded = structuredClone(settings);
    seedRegexAgentPresets(settings, DEFAULTS);
    assert.deepEqual(settings, seeded);
});

for (const [version, snapshots] of [[1, V1], [2, V2], [3, V3]]) {
    for (const complete of [false, true]) {
        test(`migrates untouched v${version} ${complete ? 'default-complete' : 'colour-only'} snapshots once`, () => {
            const presets = Object.fromEntries(Object.entries(snapshots).map(([name, palette]) => [name, {
                ...(complete ? DEFAULTS : {}), ...palette,
            }]));
            const settings = { regexAgentPresetCatalogVersion: version, activePreset: Object.keys(presets)[0], presets };
            const before = structuredClone(settings);
            seedRegexAgentPresets(settings, DEFAULTS);

            assert.equal(settings.presets, presets);
            assert.equal(settings.activePreset, before.activePreset);
            assert.deepEqual(Object.keys(settings.presets), Object.keys(before.presets));
            assert.equal(settings.regexAgentPresetCatalogVersion, 4);
            for (const name of Object.keys(snapshots)) {
                const expected = REGEX_AGENT_PRESETS.find(preset => preset.name === name).settings;
                assert.deepEqual(presets[name], { ...(complete ? DEFAULTS : {}), ...expected }, name);
            }
            const migrated = structuredClone(settings);
            seedRegexAgentPresets(settings, DEFAULTS);
            assert.deepEqual(settings, migrated);
        });
    }

    test(`v${version} preserves palette, layout and custom-field edits in their own named snapshots`, () => {
        const name = version === 2 ? BUBBLE_TEA : MARSHMALLOW;
        const snapshot = snapshots[name];
        for (const edits of [
            { customBgColor1: 'rgba(1, 2, 3, 0.4)' },
            { sheldBackgroundColor: 'rgba(10, 20, 30, 0.2)' },
            { customThemeColor: 'rgba(40, 50, 60, 1)' },
            { rawCustomCss: '.mes_text { color: red; }' },
            { messageTextFontSize: '18px' },
            { enableThemeColorization: true },
            { quote_text_color: 'rgba(70, 80, 90, 1)', custom: { keep: true } },
        ]) {
            const settings = { regexAgentPresetCatalogVersion: version, presets: { [name]: { ...DEFAULTS, ...snapshot, ...edits } } };
            const before = structuredClone(settings.presets);
            seedRegexAgentPresets(settings, DEFAULTS);
            assert.deepEqual(settings.presets, before, Object.keys(edits).join(', '));
        }
    });

    test(`v${version} preserves same-name partial collisions and deleted presets`, () => {
        const name = version === 2 ? GAME_BOY : MARSHMALLOW;
        for (const collision of [
            { customBgColor1: snapshots[name].customBgColor1, custom: 'owned' },
            { ...snapshots[name], rawCustomCss: undefined },
            { ...DEFAULTS, sheldBackgroundColor: snapshots[name].sheldBackgroundColor },
            null,
            'legacy record',
            [],
        ]) {
            const settings = { regexAgentPresetCatalogVersion: version, presets: { [name]: collision } };
            const before = structuredClone(settings.presets);
            seedRegexAgentPresets(settings, DEFAULTS);
            assert.deepEqual(settings.presets, before);
            assert.equal(settings.presets[name], collision);
        }
        const empty = { regexAgentPresetCatalogVersion: version, presets: {} };
        seedRegexAgentPresets(empty, DEFAULTS);
        assert.deepEqual(empty.presets, {});
    });
}

test('migrates normalised defaults without requiring all optional default fields', () => {
    const settings = {
        regexAgentPresetCatalogVersion: 2,
        presets: { [BUBBLE_TEA]: { ...V2[BUBBLE_TEA], messageTextFontSize: '15px', enableMessageDetails: false } },
    };
    seedRegexAgentPresets(settings, DEFAULTS);
    assert.deepEqual(settings.presets[BUBBLE_TEA], {
        ...REGEX_AGENT_PRESETS.find(({ name }) => name === BUBBLE_TEA).settings,
        messageTextFontSize: '15px', enableMessageDetails: false,
    });
});

test('does not mistake a v3 shell edit for an untouched older palette', () => {
    const settings = {
        regexAgentPresetCatalogVersion: 3,
        presets: { [MARSHMALLOW]: { ...V3[MARSHMALLOW], sheldBackgroundColor: 'rgba(255, 249, 252, 0.2)' } },
    };
    const before = structuredClone(settings.presets);
    seedRegexAgentPresets(settings, DEFAULTS);
    assert.deepEqual(settings.presets, before);
});

test('invalid markers recover known history without coercion, reseeding or losing custom records', () => {
    const invalidMarkers = [
        -1, -0.5, 1.5, 2.5, NaN, Infinity, -Infinity, null, undefined, '', '2', 'unknown',
        true, false, [], [2], {}, new Number(2), 2n, Symbol('version'),
        { [Symbol.toPrimitive]() { throw new Error('must not coerce'); } },
    ];
    for (const marker of invalidMarkers) {
        const custom = { ...V2[GAME_BOY], customThemeColor: 'user edit', custom: { keep: true } };
        const beforeCustom = structuredClone(custom);
        const presets = { ...structuredClone(V3), [ADAPTIVE_INK]: { ...V1[ADAPTIVE_INK] }, [BUBBLE_TEA]: { ...V2[BUBBLE_TEA] }, [GAME_BOY]: custom };
        const settings = { regexAgentPresetCatalogVersion: marker, activePreset: GAME_BOY, presets };
        const names = Object.keys(presets);
        ensureSettingsStructure(settings);
        assert.equal(settings.presets, presets);
        assert.deepEqual(Object.keys(presets), names);
        assert.equal(settings.activePreset, GAME_BOY);
        assert.equal(settings.regexAgentPresetCatalogVersion, 4);
        for (const name of [MARSHMALLOW, ADAPTIVE_INK, BUBBLE_TEA]) {
            assert.deepEqual(presets[name], { ...DEFAULTS, ...REGEX_AGENT_PRESETS.find(preset => preset.name === name).settings });
        }
        assert.deepEqual(presets[GAME_BOY], { ...DEFAULTS, ...beforeCustom });
        const recovered = structuredClone(settings);
        ensureSettingsStructure(settings);
        assert.deepEqual(settings, recovered);
    }
});

test('current and future integer markers leave the catalogue untouched', () => {
    for (const marker of [4, 5, Number.MAX_SAFE_INTEGER]) {
        const settings = { regexAgentPresetCatalogVersion: marker, presets: structuredClone(V1) };
        const before = structuredClone(settings);
        seedRegexAgentPresets(settings, DEFAULTS);
        assert.deepEqual(settings, before);
    }
});

test('initialisation migrates colour-only v2 imports before live-value backfill, then stays unchanged', () => {
    const settings = {
        regexAgentPresetCatalogVersion: 2,
        activePreset: BUBBLE_TEA,
        messageTextFontSize: '19px',
        enableMessageDetails: true,
        presets: structuredClone(V2),
    };
    ensureSettingsStructure(settings);
    assert.equal(settings.presets[BUBBLE_TEA].sheldBackgroundColor, 'rgba(250, 242, 234, 0.65)');
    assert.equal(settings.presets[GAME_BOY].sheldBackgroundColor, 'rgba(58, 72, 6, 0.65)');
    assert.equal(settings.presets[ADAPTIVE_INK].sheldBackgroundColor, 'color-mix(in srgb, transparent 65%, transparent)');
    assert.equal(settings.presets[BUBBLE_TEA].messageTextFontSize, '19px');
    assert.equal(settings.presets[BUBBLE_TEA].enableMessageDetails, true);
    assert.equal(settings.messageTextFontSize, '19px');
    assert.equal(settings.activePreset, BUBBLE_TEA);
    delete settings.presets[GAME_BOY];
    const before = structuredClone(settings);
    ensureSettingsStructure(settings);
    assert.deepEqual(settings, before);
});

test('preserves legitimate legacy names, including a Moonlit Echoes name collision', () => {
    const settings = {
        regexAgentPresetCatalogVersion: 4,
        activePreset: 'Moonlit Echoes',
        presets: Object.fromEntries([BUILT_IN_PRESET_NAME, 'Moonlit Echoes', 'Default', '  My Old Preset  ', 'constructor', '__proto__']
            .map(name => [name, { ...DEFAULTS, rawCustomCss: `/* ${name} */`, custom: { name } }])),
    };
    const before = structuredClone(settings);
    ensureSettingsStructure(settings);
    assert.deepEqual(settings, { ...before, messageLineHeight: '' });
    ensureSettingsStructure(settings);
    assert.deepEqual(settings, { ...before, messageLineHeight: '' });
});

test('retains the collision-free built-in rename and all its stored settings', () => {
    const preset = { ...DEFAULTS, messageTextFontSize: '21px', custom: 'keep' };
    const before = structuredClone(preset);
    const settings = { regexAgentPresetCatalogVersion: 4, activePreset: 'Moonlit Echoes', presets: { 'Moonlit Echoes': preset } };
    ensureSettingsStructure(settings);
    assert.equal(settings.presets[BUILT_IN_PRESET_NAME], preset);
    assert.deepEqual(preset, before);
    assert.equal(settings.activePreset, BUILT_IN_PRESET_NAME);
    assert.deepEqual(Object.keys(settings.presets), [BUILT_IN_PRESET_NAME]);
});
