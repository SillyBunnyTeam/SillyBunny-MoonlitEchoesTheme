import {
    REGEX_AGENT_PRESET_CATALOG_VERSION,
    REGEX_AGENT_PRESETS,
} from './regex-agent-presets.generated.js';

export function seedRegexAgentPresets(settings, defaultPreset) {
    const storedVersion = Number(settings.regexAgentPresetCatalogVersion ?? 0) || 0;
    if (storedVersion >= REGEX_AGENT_PRESET_CATALOG_VERSION) return;

    for (const preset of REGEX_AGENT_PRESETS) {
        if (storedVersion === 0 && !Object.hasOwn(settings.presets, preset.name)) {
            settings.presets[preset.name] = { ...defaultPreset, ...preset.settings };
        } else if (storedVersion === 1 && settings.presets[preset.name] && typeof settings.presets[preset.name] === 'object') {
            for (const [key, value] of Object.entries(preset.migrateFromV1)) {
                if (settings.presets[preset.name][key] === value) {
                    settings.presets[preset.name][key] = preset.settings[key];
                }
            }
        }
    }
    settings.regexAgentPresetCatalogVersion = REGEX_AGENT_PRESET_CATALOG_VERSION;
}
