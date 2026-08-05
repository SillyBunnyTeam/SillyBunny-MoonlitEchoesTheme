import {
    MESSAGE_LINE_HEIGHT_NATIVE_VALUE,
    isNativeMessageLineHeightValue,
    themeCustomSettings,
} from './theme-settings.js';
import { seedRegexAgentPresets } from './regex-agent-presets.js';

export const BUILT_IN_PRESET_NAME = 'Moonlit Echoes - by Rivelle';
const LEGACY_BUILT_IN_PRESET_NAMES = new Set(['Default', 'Moonlit Echoes']);

export function isBuiltInPresetName(name) {
    return name === BUILT_IN_PRESET_NAME || LEGACY_BUILT_IN_PRESET_NAMES.has(name);
}

export function resolveActivePresetName(presets, activePreset) {
    const presetNames = Object.keys(presets || {});
    return presetNames.includes(activePreset) ? activePreset : presetNames[0] || null;
}

/**
 * Generate default settings snapshot used for initial bootstrapping.
 * This mirrors the original inline logic so existing behaviour stays the same.
 */
function generateDefaultSettings() {
    const settings = {
        enabled: true,
        useOriginalAvatarImages: false,
        chatStyle: '',
        presets: {
            [BUILT_IN_PRESET_NAME]: {}
        },
        activePreset: BUILT_IN_PRESET_NAME
    };

    themeCustomSettings.forEach((setting) => {
        settings[setting.varId] = setting.default;
        settings.presets[BUILT_IN_PRESET_NAME][setting.varId] = setting.default;
    });
    seedRegexAgentPresets(settings, settings.presets[BUILT_IN_PRESET_NAME]);

    return Object.freeze(settings);
}

export const defaultSettings = generateDefaultSettings();

function migrateMessageLineHeightFallback(settings) {
    if (isNativeMessageLineHeightValue(settings.messageLineHeight)) {
        settings.messageLineHeight = MESSAGE_LINE_HEIGHT_NATIVE_VALUE;
    }

    Object.values(settings.presets || {}).forEach((preset) => {
        if (preset && typeof preset === 'object' && isNativeMessageLineHeightValue(preset.messageLineHeight)) {
            preset.messageLineHeight = MESSAGE_LINE_HEIGHT_NATIVE_VALUE;
        }
    });
}

/**
 * Ensure the settings structure is up-to-date.
 * @param {Object} settings - Settings object
 */
export function ensureSettingsStructure(settings) {
    if (!settings.presets) {
        settings.presets = {};
    }

    if (Object.keys(settings.presets).length === 0) {
        settings.presets[BUILT_IN_PRESET_NAME] = {};

        themeCustomSettings.forEach((setting) => {
            const { varId } = setting;
            if (settings[varId] !== undefined) {
                settings.presets[BUILT_IN_PRESET_NAME][varId] = settings[varId];
            } else {
                settings.presets[BUILT_IN_PRESET_NAME][varId] = setting.default;
            }
        });
    }

    if (settings.presets['Moonlit Echoes']) {
        if (!settings.presets[BUILT_IN_PRESET_NAME]) {
            settings.presets[BUILT_IN_PRESET_NAME] = settings.presets['Moonlit Echoes'];
        }

        delete settings.presets['Moonlit Echoes'];

        if (settings.activePreset === 'Moonlit Echoes') {
            settings.activePreset = BUILT_IN_PRESET_NAME;
        }
    }

    const defaultPreset = Object.fromEntries(themeCustomSettings.map(({ varId, default: value }) => [varId, value]));
    seedRegexAgentPresets(settings, defaultPreset);

    // Backfill any newly added settings into every existing preset so older
    // presets stay in sync with the current setting catalogue. Prefer the
    // live top-level value when present, otherwise fall back to the default.
    Object.keys(settings.presets).forEach((presetName) => {
        const preset = settings.presets[presetName];
        if (!preset || typeof preset !== 'object') {
            return;
        }
        themeCustomSettings.forEach((setting) => {
            const { varId } = setting;
            if (preset[varId] === undefined) {
                preset[varId] = settings[varId] !== undefined ? settings[varId] : setting.default;
            }
        });
    });

    settings.activePreset = resolveActivePresetName(settings.presets, settings.activePreset);

    migrateMessageLineHeightFallback(settings);
}
