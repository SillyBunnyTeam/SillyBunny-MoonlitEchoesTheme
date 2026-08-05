import {
    REGEX_AGENT_PRESET_CATALOG_VERSION,
    REGEX_AGENT_PRESETS,
} from './regex-agent-presets.generated.js';

export function seedRegexAgentPresets(settings, defaultPreset) {
    if (Number(settings.regexAgentPresetCatalogVersion ?? 0) >= REGEX_AGENT_PRESET_CATALOG_VERSION) return;

    for (const preset of REGEX_AGENT_PRESETS) {
        if (!Object.hasOwn(settings.presets, preset.name)) {
            settings.presets[preset.name] = { ...defaultPreset, ...preset.settings };
        }
    }
    settings.regexAgentPresetCatalogVersion = REGEX_AGENT_PRESET_CATALOG_VERSION;
}
