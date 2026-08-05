import assert from 'node:assert/strict';
import test from 'node:test';

import { REGEX_AGENT_PRESETS } from '../src/config/regex-agent-presets.generated.js';
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

    assert.equal(settings.activePreset, 'User Preset');
    assert.equal(settings.presets[REGEX_AGENT_PRESETS[0].name], collision);
    assert.equal(settings.presets[REGEX_AGENT_PRESETS[1].name].layout, defaults.layout);
    assert(REGEX_AGENT_PRESETS.every(({ name }) => Object.hasOwn(settings.presets, name)));

    const deletedName = REGEX_AGENT_PRESETS[1].name;
    delete settings.presets[deletedName];
    seedRegexAgentPresets(settings, defaults);
    assert.equal(Object.hasOwn(settings.presets, deletedName), false);
});
