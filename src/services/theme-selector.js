import { addThemeButtonsHint } from './hints.js';
import { getSettings as getExtensionSettings } from './settings-service.js';
import { configurePresetManager, loadPreset } from '../ui/preset-manager.js';

let settingsEventSource;
let settingsUpdatedEvent;
let lastNativeTheme;

export function integrateWithThemeSelector() {
    configurePresetManager({ onPresetActivated: recordNativeTheme });
    const themeSelector = document.getElementById('themes');
    themeSelector?.addEventListener('change', handleMoonlitThemeChange);

    const context = SillyTavern.getContext();
    const eventType = context.event_types?.SETTINGS_UPDATED;
    if (settingsEventSource !== context.eventSource || settingsUpdatedEvent !== eventType) {
        settingsEventSource?.removeListener(settingsUpdatedEvent, handleHostSettingsUpdated);
        settingsEventSource = context.eventSource;
        settingsUpdatedEvent = eventType;
        lastNativeTheme = context.powerUserSettings?.theme;
        if (settingsUpdatedEvent) {
            settingsEventSource?.on(settingsUpdatedEvent, handleHostSettingsUpdated);
        }
    }

    addThemeButtonsHint();
}

function recordNativeTheme() {
    // A newer Moonlit choice supersedes any native save still awaiting its response.
    lastNativeTheme = SillyTavern.getContext().powerUserSettings?.theme;
}

function handleMoonlitThemeChange() {
    recordNativeTheme();
    syncMoonlitPreset(lastNativeTheme);
}

function handleHostSettingsUpdated() {
    // Native imports apply a theme without dispatching a select change event.
    const nativeTheme = SillyTavern.getContext().powerUserSettings?.theme;
    if (nativeTheme === lastNativeTheme) return;
    lastNativeTheme = nativeTheme;
    syncMoonlitPreset(nativeTheme);
}

function syncMoonlitPreset(presetName) {
    const settings = getExtensionSettings();
    if (!settings?.enabled || !Object.hasOwn(settings.presets || {}, presetName) || settings.activePreset === presetName) {
        return;
    }

    try {
        loadPreset(presetName);
    } catch (error) {
        console.error('Moonlit Echoes failed to synchronise the selected theme', error);
    }
}
