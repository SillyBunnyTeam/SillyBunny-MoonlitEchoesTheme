import { themeCustomSettings as defaultThemeCustomSettings } from '../config/theme-settings.js';
import {
    applyPresetBackground,
    installBundledBackgrounds,
} from '../services/background-installer.js';
import {
    BUILT_IN_PRESET_NAME,
    isBuiltInPresetName,
    resolveActivePresetName,
} from '../config/default-settings.js';
import { installBundledUiThemes as runBundledUiThemes } from './ui-theme-installer-actions.js';

const defaultTranslate = (strings, ...values) => strings.reduce((result, part, index) => {
    const value = index < values.length ? values[index] : '';
    return result + part + value;
}, '');

const noop = () => {};
const RESERVED_PRESET_NAMES = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(value) {
    try {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const prototype = Object.getPrototypeOf(value);
        if (prototype === null) return true;
        if (Object.getPrototypeOf(prototype) !== null) return false;

        const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value;
        return typeof constructor === 'function' && constructor.name === 'Object';
    } catch {
        return false;
    }
}

function clonePresetSettings(settings) {
    if (!isPlainObject(settings)) return null;

    try {
        const clonedSettings = structuredClone(settings);
        if (!isPlainObject(clonedSettings)) return null;

        delete clonedSettings.syncBackgroundWithPreset;
        return clonedSettings;
    } catch {
        return null;
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function normalizePresetName(name, { stripMoonlitPrefix = false } = {}) {
    if (typeof name !== 'string') return null;

    let normalizedName = name.trim();
    if (stripMoonlitPrefix && normalizedName.startsWith('[Moonlit] ')) {
        normalizedName = normalizedName.slice('[Moonlit] '.length).trim();
    }

    if (!normalizedName || RESERVED_PRESET_NAMES.has(normalizedName)) return null;
    return normalizedName;
}

export function resolveStoredPresetName(presets, name) {
    if (typeof name === 'string' && Object.hasOwn(presets || {}, name)) {
        return name;
    }

    const normalizedName = normalizePresetName(name);
    return normalizedName && Object.hasOwn(presets || {}, normalizedName) ? normalizedName : null;
}

export function validatePresetImportData(jsonData) {
    if (!isPlainObject(jsonData) || !jsonData.moonlitEchoesPreset || typeof jsonData.presetName !== 'string') return null;

    const trimmedName = jsonData.presetName.trim();
    const presetName = trimmedName.startsWith('[Moonlit] ')
        ? normalizePresetName(trimmedName, { stripMoonlitPrefix: true })
        : trimmedName && jsonData.presetName;
    if (!presetName || !isPlainObject(jsonData.settings)) return null;

    return { presetName, settings: jsonData.settings };
}

let managerConfig = {
    settingsKey: '',
    themeVersion: '',
    t: defaultTranslate,
    themeCustomSettings: defaultThemeCustomSettings,
    applyThemeSetting: noop,
    applyAllThemeSettings: noop,
    updateSettingsUI: noop,
    updateColorPickerUI: noop,
    updateSelectUI: noop,
    updateThemeSelector: noop,
};

export function configurePresetManager(options = {}) {
    managerConfig = {
        ...managerConfig,
        ...options,
        t: options.t || defaultTranslate,
        themeCustomSettings: options.themeCustomSettings || managerConfig.themeCustomSettings,
        applyThemeSetting: options.applyThemeSetting || managerConfig.applyThemeSetting,
        applyAllThemeSettings: options.applyAllThemeSettings || managerConfig.applyAllThemeSettings,
        updateSettingsUI: options.updateSettingsUI || managerConfig.updateSettingsUI,
        updateColorPickerUI: options.updateColorPickerUI || managerConfig.updateColorPickerUI,
        updateSelectUI: options.updateSelectUI || managerConfig.updateSelectUI,
        updateThemeSelector: options.updateThemeSelector || managerConfig.updateThemeSelector,
    };
}

function getContextAndSettings() {
    const context = SillyTavern.getContext();
    const settings = managerConfig.settingsKey ? context.extensionSettings[managerConfig.settingsKey] : undefined;
    return { context, settings };
}

export function upsertPresetSnapshot(name, presetSettings, { activate = false } = {}) {
    const clonedSettings = clonePresetSettings(presetSettings);
    const { context, settings } = getContextAndSettings();
    const presetName = resolveStoredPresetName(settings?.presets, name) || normalizePresetName(name);
    if (!presetName || !clonedSettings || !settings) return null;

    settings.presets ||= {};
    const replacesActivePreset = settings.activePreset === presetName;
    settings.presets[presetName] = clonedSettings;
    if (activate) {
        settings.activePreset = presetName;
        managerConfig.updateThemeSelector(presetName);
    }

    if (activate || replacesActivePreset) {
        applyPresetToSettings(presetName);
    }

    updatePresetSelector();
    syncMoonlitPresetsWithThemeList();
    context.saveSettingsDebounced();
    return presetName;
}

export function importPresetSnapshot(jsonData, { activate = true } = {}) {
    const importData = validatePresetImportData(jsonData);
    if (!importData) return null;

    return upsertPresetSnapshot(importData.presetName, importData.settings, { activate });
}

export function deletePresetSnapshot(name) {
    const { context, settings } = getContextAndSettings();
    const presetName = resolveStoredPresetName(settings?.presets, name);
    if (
        !presetName ||
        !settings ||
        isBuiltInPresetName(presetName) ||
        !Object.hasOwn(settings.presets || {}, presetName) ||
        Object.keys(settings.presets).length <= 1
    ) {
        return false;
    }

    const previousActivePreset = settings.activePreset;
    delete settings.presets[presetName];
    settings.activePreset = resolveActivePresetName(settings.presets, previousActivePreset);
    if (settings.activePreset !== previousActivePreset) {
        applyPresetToSettings(settings.activePreset);
    }

    updatePresetSelector();
    syncMoonlitPresetsWithThemeList();
    context.saveSettingsDebounced();
    return true;
}

export function createPresetManagerUI(container, settingsOverride) {
    if (!container) {
        return;
    }

    const { settings: contextSettings } = getContextAndSettings();
    const settings = settingsOverride || contextSettings || {};
    const t = managerConfig.t;

    const presetManagerContainer = document.createElement('div');
    presetManagerContainer.id = 'moonlit-preset-manager';
    presetManagerContainer.classList.add('moonlit-preset-manager');
    presetManagerContainer.style.marginBottom = '5px';

    const presetTitle = document.createElement('h4');
    presetTitle.textContent = t`Moonlit Echoes Theme Presets`;
    presetTitle.style.marginBottom = '10px';
    presetManagerContainer.appendChild(presetTitle);

    const presetSelector = document.createElement('select');
    presetSelector.id = 'moonlit-preset-selector';
    presetSelector.classList.add('moonlit-preset-selector');
    presetSelector.style.width = '100%';

    const presets = settings.presets || { [BUILT_IN_PRESET_NAME]: {} };
    for (const presetName in presets) {
        const option = document.createElement('option');
        option.value = presetName;
        option.textContent = presetName;
        option.selected = settings.activePreset === presetName;
        presetSelector.appendChild(option);
    }

    presetSelector.addEventListener('change', () => {
        loadPreset(presetSelector.value);
    });

    presetManagerContainer.appendChild(presetSelector);

    const buttonsRow = document.createElement('div');
    buttonsRow.style.display = 'flex';
    buttonsRow.style.alignItems = 'center';
    buttonsRow.style.gap = '8px';
    buttonsRow.style.justifyContent = 'flex-start';
    buttonsRow.style.width = '100%';
    buttonsRow.style.minWidth = '0';
    buttonsRow.style.maxWidth = '100%';
    buttonsRow.style.flexWrap = 'nowrap';
    buttonsRow.style.overflowX = 'auto';
    buttonsRow.style.overflowY = 'hidden';
    buttonsRow.style.overscrollBehaviorX = 'contain';
    buttonsRow.style.touchAction = 'pan-x';
    buttonsRow.style.webkitOverflowScrolling = 'touch';
    buttonsRow.addEventListener('focusin', event => {
        const target = event.target;
        if (target instanceof HTMLElement && target.matches(':focus-visible')) {
            target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    });

    let touchScrollState = null;
    buttonsRow.addEventListener('touchstart', event => {
        if (event.touches?.length !== 1) {
            touchScrollState = null;
            return;
        }

        const touch = event.touches[0];
        touchScrollState = {
            identifier: touch.identifier,
            clientX: touch.clientX,
            clientY: touch.clientY,
            scrollLeft: buttonsRow.scrollLeft,
        };
    }, { passive: true });

    buttonsRow.addEventListener('touchmove', event => {
        if (!event.defaultPrevented || !touchScrollState || event.touches?.length !== 1) return;

        const touch = event.touches[0];
        if (touch.identifier !== touchScrollState.identifier) return;

        const deltaX = touch.clientX - touchScrollState.clientX;
        const deltaY = touch.clientY - touchScrollState.clientY;
        if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

        buttonsRow.scrollLeft = touchScrollState.scrollLeft - deltaX;
    }, { passive: true });

    const clearTouchScrollState = () => {
        touchScrollState = null;
    };
    buttonsRow.addEventListener('touchend', clearTouchScrollState, { passive: true });
    buttonsRow.addEventListener('touchcancel', clearTouchScrollState, { passive: true });

    const importButton = document.createElement('button');
    importButton.id = 'moonlit-preset-import';
    importButton.classList.add('menu_button');
    importButton.title = t`Import Preset`;
    importButton.innerHTML = '<i class="fa-solid fa-file-import"></i>';
    importButton.addEventListener('click', importPreset);
    buttonsRow.appendChild(importButton);

    const exportButton = document.createElement('button');
    exportButton.id = 'moonlit-preset-export';
    exportButton.classList.add('menu_button');
    exportButton.title = t`Export Preset`;
    exportButton.innerHTML = '<i class="fa-solid fa-file-export"></i>';
    exportButton.addEventListener('click', exportActivePreset);
    buttonsRow.appendChild(exportButton);

    const saveButton = document.createElement('button');
    saveButton.id = 'moonlit-preset-save';
    saveButton.classList.add('menu_button');
    saveButton.title = t`Update Current Preset`;
    saveButton.innerHTML = '<i class="fa-solid fa-save"></i>';
    saveButton.addEventListener('click', updateCurrentPreset);
    buttonsRow.appendChild(saveButton);

    const newButton = document.createElement('button');
    newButton.id = 'moonlit-preset-new';
    newButton.classList.add('menu_button');
    newButton.title = t`Save as New Preset`;
    newButton.innerHTML = '<i class="fa-solid fa-file-circle-plus"></i>';
    newButton.addEventListener('click', saveAsNewPreset);
    buttonsRow.appendChild(newButton);

    const deleteButton = document.createElement('button');
    deleteButton.id = 'moonlit-preset-delete';
    deleteButton.classList.add('menu_button');
    deleteButton.title = t`Delete Preset`;
    deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    deleteButton.addEventListener('click', deleteCurrentPreset);
    buttonsRow.appendChild(deleteButton);

    const installUiThemesButton = document.createElement('button');
    installUiThemesButton.id = 'moonlit-install-ui-themes';
    installUiThemesButton.type = 'button';
    installUiThemesButton.classList.add('menu_button');
    installUiThemesButton.title = t`Install Bundled UI Themes`;
    installUiThemesButton.setAttribute('aria-label', t`Install Bundled UI Themes`);
    installUiThemesButton.innerHTML = '<i class="fa-solid fa-palette" aria-hidden="true"></i>';
    installUiThemesButton.addEventListener('click', installBundledUiThemes);
    buttonsRow.appendChild(installUiThemesButton);

    const installBackgroundsButton = document.createElement('button');
    installBackgroundsButton.id = 'moonlit-install-backgrounds';
    installBackgroundsButton.classList.add('menu_button');
    installBackgroundsButton.title = t`Install Bundled Backgrounds`;
    installBackgroundsButton.innerHTML = '<i class="fa-solid fa-images"></i>';
    installBackgroundsButton.addEventListener('click', installBundledBackgroundsFromUi);
    buttonsRow.appendChild(installBackgroundsButton);

    presetManagerContainer.appendChild(buttonsRow);

    const reinstallUiThemesButton = document.createElement('button');
    reinstallUiThemesButton.id = 'moonlit-reinstall-ui-themes';
    reinstallUiThemesButton.type = 'button';
    reinstallUiThemesButton.classList.add('menu_button');
    reinstallUiThemesButton.style.width = '100%';
    reinstallUiThemesButton.style.marginTop = '8px';
    reinstallUiThemesButton.title = t`Reinstall / Update Bundled UI Themes`;

    const reinstallUiThemesIcon = document.createElement('i');
    reinstallUiThemesIcon.className = 'fa-solid fa-rotate';
    reinstallUiThemesIcon.setAttribute('aria-hidden', 'true');
    reinstallUiThemesButton.appendChild(reinstallUiThemesIcon);

    const reinstallUiThemesLabel = document.createElement('span');
    reinstallUiThemesLabel.textContent = t`Reinstall / Update Bundled UI Themes`;
    reinstallUiThemesButton.appendChild(reinstallUiThemesLabel);
    reinstallUiThemesButton.addEventListener('click', event => installBundledUiThemes(event, { overwriteExisting: true }));
    presetManagerContainer.appendChild(reinstallUiThemesButton);

    const backgroundSyncLabel = document.createElement('label');
    backgroundSyncLabel.style.display = 'flex';
    backgroundSyncLabel.style.alignItems = 'center';
    backgroundSyncLabel.style.gap = '6px';
    backgroundSyncLabel.style.marginTop = '8px';

    const backgroundSyncCheckbox = document.createElement('input');
    backgroundSyncCheckbox.id = 'moonlit-sync-background-with-preset';
    backgroundSyncCheckbox.type = 'checkbox';
    backgroundSyncCheckbox.checked = settings.syncBackgroundWithPreset === true;
    backgroundSyncCheckbox.addEventListener('change', () => {
        const { context, settings: currentSettings } = getContextAndSettings();
        if (!currentSettings) return;

        currentSettings.syncBackgroundWithPreset = backgroundSyncCheckbox.checked;
        context.saveSettingsDebounced();
    });
    backgroundSyncLabel.appendChild(backgroundSyncCheckbox);

    const backgroundSyncText = document.createElement('span');
    backgroundSyncText.textContent = t`Use matching scene background when switching presets`;
    backgroundSyncLabel.appendChild(backgroundSyncText);
    presetManagerContainer.appendChild(backgroundSyncLabel);

    const fileInput = document.createElement('input');
    fileInput.id = 'moonlit-preset-file-input';
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handlePresetFileSelected);
    presetManagerContainer.appendChild(fileInput);

    container.appendChild(presetManagerContainer);
}

export function initPresetManager() {
    // Placeholder for future shared initialization logic
}

function handlePresetFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            const presetName = importPresetSnapshot(jsonData);
            if (!presetName) {
                throw new Error(managerConfig.t`Invalid Moonlit Echoes theme preset file format`);
            }

            toastr.success(managerConfig.t`Preset "${escapeHtml(presetName)}" imported successfully`);
        } catch (error) {
            toastr.error(managerConfig.t`Unable to import preset: invalid file or preset data`);
        }

        event.target.value = '';
    };

    reader.readAsText(file);
}

export async function installBundledUiThemes(event, options = {}) {
    return runBundledUiThemes(event, { ...options, t: managerConfig.t });
}

export async function installBundledBackgroundsFromUi(event) {
    const button = event?.currentTarget || document.getElementById('moonlit-install-backgrounds');
    const originalHtml = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
        const { installed, skipped } = await installBundledBackgrounds();
        toastr.success(managerConfig.t`Installed ${installed} backgrounds (${skipped} already present). Reload SillyBunny to use them.`);
    } catch (error) {
        toastr.error(managerConfig.t`Unable to install the bundled backgrounds`);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHtml || '<i class="fa-solid fa-images"></i>';
        }
    }
}

export function importPreset() {
    const fileInput = document.getElementById('moonlit-preset-file-input');
    if (fileInput) {
        fileInput.click();
    } else {
        toastr.error(managerConfig.t`File input element not found`);
    }
}

export function exportActivePreset() {
    const { settings } = getContextAndSettings();
    if (!settings) return;

    const presetName = settings.activePreset;
    const preset = settings.presets?.[presetName];

    if (!preset) {
        toastr.error(managerConfig.t`Preset "${escapeHtml(presetName)}" not found`);
        return;
    }

    const exportSettings = { ...preset };
    delete exportSettings.syncBackgroundWithPreset;

    const exportData = {
        moonlitEchoesPreset: true,
        presetVersion: managerConfig.themeVersion,
        presetName,
        settings: exportSettings,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `[Moonlit] ${presetName.replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toastr.success(managerConfig.t`Preset "${escapeHtml(presetName)}" exported successfully`);
}

export function updateCurrentPreset() {
    const { settings } = getContextAndSettings();
    if (!settings) return;

    const presetName = settings.activePreset;

    if (isBuiltInPresetName(presetName) && Object.keys(settings.presets).length > 1) {
        if (!confirm(managerConfig.t`Are you sure you want to update the built-in preset? This will overwrite the original settings.`)) {
            return;
        }
    }

    const currentSettings = { ...(settings.presets[presetName] || {}) };
    managerConfig.themeCustomSettings.forEach(({ varId }) => {
        currentSettings[varId] = settings[varId];
    });

    if (upsertPresetSnapshot(presetName, currentSettings)) {
        toastr.success(managerConfig.t`Moonlit Echoes theme preset "${escapeHtml(presetName)}" updated successfully`);
    }
}

export function saveAsNewPreset() {
    import('../../../../../popup.js').then(({ POPUP_TYPE, callGenericPopup }) => {
        callGenericPopup(
            `<h3 data-i18n="Save New Moonlit Echoes Theme Preset">Save New Moonlit Echoes Theme Preset</h3>
            <p data-i18n="Please enter a name for your new Moonlit Echoes theme preset:">Please enter a name for your new Moonlit Echoes theme preset:</p>`,
            POPUP_TYPE.INPUT,
            '',
            'New preset name'
        ).then((presetName) => {
            if (!presetName) return;

            const { settings } = getContextAndSettings();
            if (!settings) return;

            const normalizedName = resolveStoredPresetName(settings.presets, presetName) || normalizePresetName(presetName);
            if (!normalizedName) {
                toastr.error('Preset name is invalid');
                return;
            }

            if (Object.hasOwn(settings.presets, normalizedName)) {
                const escapedName = escapeHtml(normalizedName);
                import('../../../../../popup.js').then(({ POPUP_TYPE, callGenericPopup }) => {
                    callGenericPopup(
                        `<h3 data-i18n="Confirm Overwrite">Confirm Overwrite</h3>
                        <p>A preset named "${escapedName}" already exists. Do you want to overwrite it?</p>`,
                        POPUP_TYPE.CONFIRM
                    ).then((confirmed) => {
                        if (!confirmed) return;
                        createNewPreset(normalizedName, settings);
                    });
                });
            } else {
                createNewPreset(normalizedName, settings);
            }
        });
    });
}

function createNewPreset(presetName, settings) {
    const currentSettings = { ...(settings.presets?.[settings.activePreset] || {}) };
    managerConfig.themeCustomSettings.forEach(({ varId }) => {
        currentSettings[varId] = settings[varId];
    });

    const savedPresetName = upsertPresetSnapshot(presetName, currentSettings, { activate: true });
    if (savedPresetName) {
        toastr.success(managerConfig.t`Preset "${escapeHtml(savedPresetName)}" saved successfully`);
    }
}

export function deleteCurrentPreset() {
    const { settings } = getContextAndSettings();
    if (!settings) return;

    const presetName = settings.activePreset;

    if (Object.keys(settings.presets).length <= 1) {
        toastr.error(managerConfig.t`Cannot delete the only preset`);
        return;
    }

    if (isBuiltInPresetName(presetName)) {
        toastr.error(managerConfig.t`Cannot delete the Moonlit Echoes theme preset`);
        return;
    }

    import('../../../../../popup.js').then(({ POPUP_TYPE, callGenericPopup }) => {
        const escapedPresetName = escapeHtml(presetName);
        callGenericPopup(
            `<h3>${managerConfig.t`Delete Theme Preset`}</h3><p>Are you sure you want to delete the preset "${escapedPresetName}"?</p>`,
            POPUP_TYPE.CONFIRM
        ).then((confirmed) => {
            if (!confirmed) return;

            if (deletePresetSnapshot(presetName)) {
                toastr.success(managerConfig.t`Preset "${escapeHtml(presetName)}" deleted successfully`);
            }
        });
    });
}

export function loadPreset(presetName) {
    const { context, settings } = getContextAndSettings();
    if (!settings) return;

    const storedPresetName = resolveStoredPresetName(settings.presets, presetName);
    if (!storedPresetName) {
        toastr.error(managerConfig.t`Preset "${escapeHtml(presetName)}" not found`);
        return;
    }

    settings.activePreset = storedPresetName;
    managerConfig.updateThemeSelector(storedPresetName);
    applyPresetToSettings(storedPresetName);
    updatePresetSelector();
    context.saveSettingsDebounced();
    toastr.success(managerConfig.t`Preset "${escapeHtml(storedPresetName)}" loaded successfully`);
}

export function applyActivePreset() {
    const { settings } = getContextAndSettings();
    if (!settings) return;

    settings.activePreset = resolveActivePresetName(settings.presets, settings.activePreset);
    if (!settings.activePreset) return;

    applyPresetToSettings(settings.activePreset);
}

export function applyPresetToSettings(presetName) {
    const { context, settings } = getContextAndSettings();
    if (!settings) return;

    const preset = settings.presets?.[presetName];
    if (!preset) return;

    managerConfig.themeCustomSettings.forEach(({ varId, default: defaultValue }) => {
        const value = preset[varId] !== undefined ? preset[varId] : defaultValue;
        settings[varId] = value;
        managerConfig.applyThemeSetting(varId, value);
    });

    managerConfig.applyAllThemeSettings();
    managerConfig.updateSettingsUI();

    if (settings.syncBackgroundWithPreset === true) {
        void applyPresetBackground(presetName).catch(() => {});
    }

    setTimeout(() => {
        managerConfig.themeCustomSettings.forEach(({ varId, type }) => {
            const value = settings[varId];
            if (value === undefined) return;

            if (type === 'color') {
                managerConfig.updateColorPickerUI(varId, value);
            } else if (type === 'select') {
                managerConfig.updateSelectUI(varId, value);
            }
        });
    }, 100);
}

export function updatePresetSelector() {
    const presetSelector = document.getElementById('moonlit-preset-selector');
    if (!presetSelector) return;

    const { settings } = getContextAndSettings();
    if (!settings) return;

    presetSelector.innerHTML = '';

    for (const presetName in settings.presets) {
        const option = document.createElement('option');
        option.value = presetName;
        option.textContent = presetName;
        option.selected = settings.activePreset === presetName;
        presetSelector.appendChild(option);
    }
}

export function handleMoonlitPresetImport(jsonData) {
    const presetName = importPresetSnapshot(jsonData);
    if (!presetName) {
        toastr.error('Invalid Moonlit Echoes preset format');
        return false;
    }

    toastr.success(managerConfig.t`Preset "${escapeHtml(presetName)}" imported successfully`);
    return true;
}

export function syncMoonlitPresetsWithThemeList() {
    const { settings } = getContextAndSettings();
    if (!settings || !settings.presets) return;

    const themeSelector = document.getElementById('themes');
    if (!themeSelector) return;

    if (settings.enabled) {
        const activePreset = settings.activePreset;
        const currentThemeValue = themeSelector.value;
        const isCurrentThemeMoonlitPreset = Object.prototype.hasOwnProperty.call(settings.presets, currentThemeValue);

        if (isCurrentThemeMoonlitPreset) {
            let optionExists = false;
            for (let i = 0; i < themeSelector.options.length; i++) {
                if (themeSelector.options[i].value === activePreset) {
                    optionExists = true;
                    break;
                }
            }

            if (optionExists && themeSelector.value !== activePreset) {
                themeSelector.value = activePreset;
            }
        }
    }
}
