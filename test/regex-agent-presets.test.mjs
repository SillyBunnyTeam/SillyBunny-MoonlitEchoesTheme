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
