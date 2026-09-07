import { themeCustomSettings } from '../config/theme-settings.js';
import { getSettings as getExtensionSettings } from '../services/settings-service.js';
import {
    deletePresetSnapshot,
    importPresetSnapshot,
    loadPreset,
    resolveStoredPresetName,
    syncMoonlitPresetsWithThemeList,
    upsertPresetSnapshot,
} from '../ui/preset-manager.js';

const domReadyHandlers = new Set();
let lifecycleInstalled = false;
let addModernCompactStyles;
let applyAllThemeSettings;
let addCustomSetting;
let applyThemeSetting;
let themeVersion;

/**
 * Register a handler to run once the DOM is ready.
 * If the DOM is already ready, the handler executes immediately.
 *
 * @param {Function} handler - Function to invoke when DOM is ready.
 */
export function registerDomReadyHandler(handler) {
    if (typeof handler !== 'function') {
        return;
    }

    if (document.readyState === 'loading') {
        domReadyHandlers.add(handler);
    } else {
        handler();
    }
}

function runDomReadyHandlers() {
    domReadyHandlers.forEach((handler) => {
        try {
            handler();
        } catch (error) {
            console.error('Moonlit Echoes DOM ready handler failed', error);
        }
    });
    domReadyHandlers.clear();

    try {
        addModernCompactStyles();
    } catch (error) {
        console.error('Moonlit Echoes failed to add compact styles', error);
    }

    try {
        syncMoonlitPresetsWithThemeList();
    } catch (error) {
        console.error('Moonlit Echoes failed to sync presets after DOM ready', error);
    }
}

function initializeThemeColorOnDemand() {
    applyAllThemeSettings();
    syncMoonlitPresetsWithThemeList();
}

const moonlitEchoesApi = {
    init: function() {
        applyAllThemeSettings();
        initializeThemeColorOnDemand();
        syncMoonlitPresetsWithThemeList();
    },

    addSetting: addCustomSetting,

    applySetting: applyThemeSetting,

    getSettings: function() {
        return getExtensionSettings();
    },

    getSettingsConfig: function() {
        return [...themeCustomSettings];
    },

    presets: {
        getAll: function() {
            const context = SillyTavern.getContext();
            const settings = getExtensionSettings(context);
            return settings?.presets || {};
        },

        getActive: function() {
            const context = SillyTavern.getContext();
            const settings = getExtensionSettings(context);
            return {
                name: settings.activePreset,
                settings: settings.presets[settings.activePreset] || {}
            };
        },

        create: function(name, settingsObj) {
            return Boolean(upsertPresetSnapshot(name, settingsObj ?? {}));
        },

        load: function(name) {
            return loadPreset(name);
        },

        update: function(name, settingsObj) {
            const context = SillyTavern.getContext();
            const settings = getExtensionSettings(context);
            const presetName = resolveStoredPresetName(settings?.presets, name);

            if (!presetName || !Object.hasOwn(settings.presets || {}, presetName)) {
                return false;
            }

            return Boolean(upsertPresetSnapshot(
                presetName,
                settingsObj ?? settings.presets[presetName],
            ));
        },

        delete: function(name) {
            return deletePresetSnapshot(name);
        },

        export: function(name) {
            const context = SillyTavern.getContext();
            const settings = getExtensionSettings(context);
            const presetName = resolveStoredPresetName(settings?.presets, name);

            if (!presetName) {
                return null;
            }

            return {
                moonlitEchoesPreset: true,
                presetVersion: themeVersion,
                presetName,
                settings: settings.presets[presetName]
            };
        },

        import: function(jsonData, { overwrite = false } = {}) {
            return Boolean(importPresetSnapshot(jsonData, { activate: false, overwrite }));
        }
    }
};

/**
 * Install lifecycle hooks and public APIs after the entry point is initialized.
 * @param {object} dependencies - Runtime dependencies provided by the entry point.
 */
export function installLifecycleHooks(dependencies) {
    if (lifecycleInstalled) return;

    ({
        addModernCompactStyles,
        applyAllThemeSettings,
        addCustomSetting,
        applyThemeSetting,
        themeVersion,
    } = dependencies);
    lifecycleInstalled = true;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runDomReadyHandlers, { once: true });
    } else {
        // Preserve deferred follow-up work until entry point initialization completes.
        if (typeof queueMicrotask === 'function') {
            queueMicrotask(runDomReadyHandlers);
        } else {
            setTimeout(runDomReadyHandlers, 0);
        }
    }

    moonlitEchoesApi.addSetting = addCustomSetting;
    moonlitEchoesApi.applySetting = applyThemeSetting;
    window.initializeThemeColorOnDemand = initializeThemeColorOnDemand;
    window.MoonlitEchoesTheme = moonlitEchoesApi;
}
