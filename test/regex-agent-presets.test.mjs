import assert from 'node:assert/strict';
import test from 'node:test';

import {
    REGEX_AGENT_PRESET_CATALOG_VERSION,
    REGEX_AGENT_PRESETS,
} from '../src/config/regex-agent-presets.generated.js';
import { seedRegexAgentPresets } from '../src/config/regex-agent-presets.js';

test('seeds the catalog once without changing user state or collisions', () => {
    const collision = { custom: 'keep me' };
    const settings = {
        activePreset: 'User Preset',
        presets: {
            'User Preset': { custom: 'user' },
            [REGEX_AGENT_PRESETS[0].name]: collision,
        },
    };
    const defaults = { layout: 'moonlit-default' };

    seedRegexAgentPresets(settings, defaults);

    assert.equal(settings.regexAgentPresetCatalogVersion, REGEX_AGENT_PRESET_CATALOG_VERSION);
    assert.equal(settings.activePreset, 'User Preset');
    assert.equal(settings.presets[REGEX_AGENT_PRESETS[0].name], collision);
    assert.equal(settings.presets[REGEX_AGENT_PRESETS[1].name].layout, defaults.layout);
    assert(REGEX_AGENT_PRESETS.every(({ name }) => Object.hasOwn(settings.presets, name)));

    const deletedName = REGEX_AGENT_PRESETS[1].name;
    delete settings.presets[deletedName];
    seedRegexAgentPresets(settings, defaults);
    assert.equal(Object.hasOwn(settings.presets, deletedName), false);
});

test('migrates unchanged v1 overlays without replacing edits or deleted presets', () => {
    const fixed = REGEX_AGENT_PRESETS[0];
    const adaptive = REGEX_AGENT_PRESETS.at(-1);
    const editedBackground = 'rgba(1, 2, 3, 0.4)';
    const deletedName = REGEX_AGENT_PRESETS[1].name;
    const collision = { custom: 'keep me' };
    const settings = {
        activePreset: fixed.name,
        regexAgentPresetCatalogVersion: 1,
        presets: {
            [fixed.name]: { ...fixed.migrateFromV1, customBgColor1: editedBackground },
            [adaptive.name]: { ...adaptive.migrateFromV1 },
            [REGEX_AGENT_PRESETS[2].name]: collision,
        },
    };

    seedRegexAgentPresets(settings, {});

    assert.equal(settings.regexAgentPresetCatalogVersion, REGEX_AGENT_PRESET_CATALOG_VERSION);
    assert.equal(settings.activePreset, fixed.name);
    assert.equal(settings.presets[fixed.name].customBgColor1, editedBackground);
    for (const key of Object.keys(fixed.migrateFromV1).filter(key => key !== 'customBgColor1')) {
        assert.equal(settings.presets[fixed.name][key], fixed.settings[key]);
    }
    for (const key of Object.keys(adaptive.migrateFromV1)) {
        assert.equal(settings.presets[adaptive.name][key], adaptive.settings[key]);
    }
    assert.equal(settings.presets[REGEX_AGENT_PRESETS[2].name], collision);
    assert.equal(Object.hasOwn(settings.presets, deletedName), false);
});

test('migrates unchanged v2 shell colors without replacing edits or collisions', () => {
    const fixed = REGEX_AGENT_PRESETS.find(({ settings }) => settings.sheldBackgroundColor.startsWith('rgba('));
    const adaptive = REGEX_AGENT_PRESETS.find(({ settings }) => settings.sheldBackgroundColor.startsWith('color-mix('));
    const defaults = { customDefault: 'keep me' };
    const fixedPrevious = { ...defaults, ...fixed.settings, sheldBackgroundColor: fixed.migrateFromV2.sheldBackgroundColor };
    const adaptivePrevious = { ...defaults, ...adaptive.settings, sheldBackgroundColor: adaptive.migrateFromV2.sheldBackgroundColor };
    const editedName = REGEX_AGENT_PRESETS.find(({ name }) => name !== fixed.name && name !== adaptive.name).name;
    const collisionName = REGEX_AGENT_PRESETS.find(({ name }) => name !== fixed.name && name !== adaptive.name && name !== editedName).name;
    const edited = { ...fixedPrevious, customThemeColor: 'rgba(1, 2, 3, 0.4)' };
    const collision = { sheldBackgroundColor: fixed.migrateFromV2.sheldBackgroundColor };
    const settings = {
        activePreset: fixed.name,
        regexAgentPresetCatalogVersion: 2,
        presets: {
            [fixed.name]: fixedPrevious,
            [adaptive.name]: adaptivePrevious,
            [editedName]: edited,
            [collisionName]: collision,
        },
    };

    seedRegexAgentPresets(settings, defaults);

    assert.equal(settings.regexAgentPresetCatalogVersion, REGEX_AGENT_PRESET_CATALOG_VERSION);
    assert.equal(settings.activePreset, fixed.name);
    assert.equal(settings.presets[fixed.name].sheldBackgroundColor, fixed.settings.sheldBackgroundColor);
    assert.equal(settings.presets[adaptive.name].sheldBackgroundColor, adaptive.settings.sheldBackgroundColor);
    assert.equal(settings.presets[editedName].sheldBackgroundColor, fixed.migrateFromV2.sheldBackgroundColor);
    assert.equal(settings.presets[editedName].customThemeColor, edited.customThemeColor);
    assert.deepEqual(settings.presets[collisionName], collision);
});

test('changes generated shell colors only in their final opacity', () => {
    for (const { settings, migrateFromV2 } of REGEX_AGENT_PRESETS) {
        const previous = migrateFromV2.sheldBackgroundColor;
        const expected = previous.startsWith('rgba(')
            ? previous.replace(/, 0\.2\)$/, ', 0.65)')
            : previous.replace(/ 20%, transparent\)$/, ' 65%, transparent)');
        assert.notEqual(expected, previous);
        assert.equal(settings.sheldBackgroundColor, expected);
    }
});
