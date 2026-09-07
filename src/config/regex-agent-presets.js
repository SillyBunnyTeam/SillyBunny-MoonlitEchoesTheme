import {
    REGEX_AGENT_PRESET_CATALOG_VERSION,
    REGEX_AGENT_PRESETS,
} from './regex-agent-presets.generated.js';

function matchesGeneratedPreset(preset, expectedSettings, defaultPreset) {
    return preset && typeof preset === 'object' && !Array.isArray(preset)
        && Object.entries(expectedSettings).every(([key, value]) => Object.hasOwn(preset, key) && preset[key] === value)
        && Object.entries(preset).every(([key, value]) => Object.hasOwn(expectedSettings, key)
            || (Object.hasOwn(defaultPreset, key) && value === defaultPreset[key]));
}

export function seedRegexAgentPresets(settings, defaultPreset) {
    const marker = settings.regexAgentPresetCatalogVersion;
    const storedVersion = !Object.hasOwn(settings, 'regexAgentPresetCatalogVersion') ? 0
        : typeof marker === 'number' && Number.isInteger(marker) && marker >= 0 ? marker : null;
    if (storedVersion >= REGEX_AGENT_PRESET_CATALOG_VERSION) return;

    // An invalid marker is an unknown upgrade, not permission to re-add deleted presets.
    const previousVersions = storedVersion === null ? [1, 2, 3] : [storedVersion];
    for (const preset of REGEX_AGENT_PRESETS) {
        if (storedVersion === 0) {
            if (!Object.hasOwn(settings.presets, preset.name)) {
                settings.presets[preset.name] = { ...defaultPreset, ...preset.settings };
            }
            continue;
        }
        if (!Object.hasOwn(settings.presets, preset.name)) continue;

        for (const version of previousVersions) {
            const previousSettings = {
                ...preset.settings,
                ...preset.migrateFromV3,
                ...(version === 1 ? preset.migrateFromV1 : version === 2 ? preset.migrateFromV2 : {}),
            };
            const existingPreset = settings.presets[preset.name];
            // All ten palette fields must match; missing layout defaults are normal for JSON imports.
            if (matchesGeneratedPreset(existingPreset, previousSettings, defaultPreset)) {
                Object.assign(existingPreset, preset.settings);
                break;
            }
        }
    }
    settings.regexAgentPresetCatalogVersion = REGEX_AGENT_PRESET_CATALOG_VERSION;
}
