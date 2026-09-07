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
import { parseColorValue } from '../utils/color.js';

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

function cloneJsonData(value, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    const isArray = Array.isArray(value);
    if ((!isArray && !isPlainObject(value)) || ancestors.has(value)) {
        throw new TypeError('Preset data must be JSON-compatible');
    }

    // Do not invoke getters or toJSON while validating imported data.
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (isArray && keys.length !== value.length + 1) {
        throw new TypeError('Preset arrays must not contain holes or extra properties');
    }

    ancestors.add(value);
    const cloned = isArray ? [] : {};
    for (const key of keys) {
        if (isArray && key === 'length') continue;
        const descriptor = descriptors[key];
        if (
            typeof key !== 'string' || RESERVED_PRESET_NAMES.has(key) ||
            !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') ||
            (isArray && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))
        ) {
            throw new TypeError('Preset data contains an unsafe or non-JSON property');
        }
        cloned[key] = cloneJsonData(descriptor.value, ancestors);
    }
    ancestors.delete(value);
    return cloned;
}

function clonePresetSettings(settings) {
    if (!isPlainObject(settings)) return null;
    try {
        const clonedSettings = cloneJsonData(settings);
        for (const { varId, type, min, max, options } of managerConfig.themeCustomSettings) {
            if (!Object.hasOwn(clonedSettings, varId)) continue;
            const value = clonedSettings[varId];
            switch (type) {
                case 'checkbox':
                    if (typeof value !== 'boolean') return null;
                    break;
                case 'slider': {
                    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
                    const numericValue = Number(value);
                    if (!Number.isFinite(numericValue) || numericValue < min || numericValue > max) return null;
                    break;
                }
                case 'select':
                    if (!['string', 'number', 'boolean'].includes(typeof value) || !options?.some(option =>
                        value === option.value || (typeof value === 'string' && value === String(option.value)))) return null;
                    break;
                case 'color':
                    if (typeof value !== 'string' || !(parseColorValue(value) || globalThis.CSS?.supports('color', value))) return null;
                    break;
                case 'text':
                case 'textarea':
                    if (typeof value !== 'string') return null;
                    break;
            }
        }

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
    if (stripMoonlitPrefix && (normalizedName === '[Moonlit]' || normalizedName.startsWith('[Moonlit] '))) {
        normalizedName = normalizedName.slice('[Moonlit] '.length).trim();
    }

    if (!normalizedName || RESERVED_PRESET_NAMES.has(normalizedName)) return null;
    return normalizedName;
}

export function resolveStoredPresetName(presets, name) {
    const normalizedName = normalizePresetName(name);
    if (!normalizedName) return null;
    if (Object.hasOwn(presets || {}, name)) {
        return name;
    }

    return Object.hasOwn(presets || {}, normalizedName) ? normalizedName : null;
}

export function validatePresetImportData(jsonData) {
    try {
        if (!isPlainObject(jsonData)) return null;
        const data = cloneJsonData(jsonData);
        if (data.moonlitEchoesPreset !== true || !normalizePresetName(data.presetName, { stripMoonlitPrefix: true })) return null;

        const trimmedName = data.presetName.trim();
        const presetName = trimmedName.startsWith('[Moonlit] ')
            ? normalizePresetName(trimmedName, { stripMoonlitPrefix: true })
            : data.presetName;
        const settings = clonePresetSettings(data.settings);
        return presetName && settings ? { presetName, settings } : null;
    } catch {
        return null;
    }
}

let managerConfig = {
    settingsKey: '',
    themeVersion: '',
    t: defaultTranslate,
    themeCustomSettings: defaultThemeCustomSettings,
    applyThemeSetting: noop,
    applyAllThemeSettings: noop,
    updateSettingsUI: noop,
    updateThemeSelector: noop,
    onPresetActivated: noop,
};

export function configurePresetManager(options = {}) {
    managerConfig = {
        ...managerConfig,
        ...options,
        t: options.t || managerConfig.t,
        themeCustomSettings: options.themeCustomSettings || managerConfig.themeCustomSettings,
        applyThemeSetting: options.applyThemeSetting || managerConfig.applyThemeSetting,
        applyAllThemeSettings: options.applyAllThemeSettings || managerConfig.applyAllThemeSettings,
        updateSettingsUI: options.updateSettingsUI || managerConfig.updateSettingsUI,
        updateThemeSelector: options.updateThemeSelector || managerConfig.updateThemeSelector,
        onPresetActivated: options.onPresetActivated || managerConfig.onPresetActivated,
    };
}

function getContextAndSettings() {
    const context = SillyTavern.getContext();
    const settings = managerConfig.settingsKey ? context.extensionSettings[managerConfig.settingsKey] : undefined;
    return { context, settings };
}

function createImportStateCheck() {
    // Reads and confirmation dialogs must not replace intervening edits.
    const { context, settings } = getContextAndSettings();
    const settingsBefore = JSON.stringify(settings);
    const nativeThemeBefore = context.powerUserSettings?.theme;
    const selectionBefore = document.getElementById('themes')?.value;
    return () => {
        const current = getContextAndSettings();
        return current.settings === settings && JSON.stringify(current.settings) === settingsBefore &&
            current.context.powerUserSettings?.theme === nativeThemeBefore &&
            document.getElementById('themes')?.value === selectionBefore;
    };
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
        syncMoonlitPresetsWithThemeList();
    }

    if (activate || replacesActivePreset) {
        applyPresetToSettings(presetName);
    }
    if (activate) managerConfig.onPresetActivated();

    updatePresetSelector();
    context.saveSettingsDebounced();
    return presetName;
}

// Imports require explicit overwrite permission; upsert remains the intentional update path.
export function importPresetSnapshot(jsonData, { activate = true, overwrite = false } = {}) {
    const importData = validatePresetImportData(jsonData);
    if (!importData) return null;

    const { settings } = getContextAndSettings();
    if (overwrite !== true && resolveStoredPresetName(settings?.presets, importData.presetName)) return null;

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
        syncMoonlitPresetsWithThemeList();
        applyPresetToSettings(settings.activePreset);
        managerConfig.onPresetActivated();
    }

    updatePresetSelector();
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
    presetSelector.setAttribute('aria-label', t`Moonlit Echoes Theme Presets`);
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
    installBackgroundsButton.type = 'button';
    installBackgroundsButton.classList.add('menu_button');
    installBackgroundsButton.title = t`Install Bundled Backgrounds`;
    installBackgroundsButton.setAttribute('aria-label', t`Install Bundled Backgrounds`);
    installBackgroundsButton.innerHTML = '<i class="fa-solid fa-images" aria-hidden="true"></i>';
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

async function handlePresetFileSelected(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    const wasDisabled = input.disabled;
    input.disabled = true;
    try {
        const importStateIsCurrent = createImportStateCheck();
        const jsonData = JSON.parse(await file.text());
        if (!importStateIsCurrent()) {
            toastr.error(managerConfig.t`Settings changed while reading the file. Import it again.`);
            return;
        }
        await handleMoonlitPresetImport(jsonData);
    } catch {
        toastr.error(managerConfig.t`Unable to import preset: unreadable file or invalid preset data`);
    } finally {
        input.value = '';
        input.disabled = wasDisabled;
    }
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
    syncMoonlitPresetsWithThemeList();
    applyPresetToSettings(storedPresetName);
    managerConfig.onPresetActivated();
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
    const { settings } = getContextAndSettings();
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

    if (settings.enabled && settings.syncBackgroundWithPreset === true) {
        void applyPresetBackground(presetName).catch(() => {});
    }
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

export async function handleMoonlitPresetImport(jsonData) {
    try {
        const data = cloneJsonData(jsonData);
        const importData = validatePresetImportData(data);
        const { context, settings } = getContextAndSettings();
        if (!importData || !settings) throw new Error('Invalid preset data');

        const overwrite = Boolean(resolveStoredPresetName(settings.presets, importData.presetName));
        const hasCustomCss = Boolean(importData.settings.rawCustomCss?.trim());
        if (overwrite || hasCustomCss) {
            const importStateIsCurrent = createImportStateCheck();
            const message = [
                overwrite ? managerConfig.t`A preset named '${escapeHtml(importData.presetName)}' already exists. Replace it?` : '',
                hasCustomCss ? managerConfig.t`This preset contains raw CSS, which can change the interface and load remote content. Import it only if you trust its source.` : '',
            ].filter(Boolean).join('<br><br>');
            const confirmed = await context.Popup.show.confirm(managerConfig.t`Import Preset`, message);
            if (confirmed !== context.POPUP_RESULT.AFFIRMATIVE) return false;

            if (!importStateIsCurrent()) {
                toastr.error(managerConfig.t`Settings changed while confirming. Import the file again.`);
                return false;
            }
        }

        const presetName = importPresetSnapshot(data, { overwrite });
        if (!presetName) throw new Error('Invalid preset data or preset name collision');
        toastr.success(managerConfig.t`Preset "${escapeHtml(presetName)}" imported successfully`);
        return true;
    } catch {
        toastr.error(managerConfig.t`Unable to import preset: invalid file or preset data`);
        return false;
    }
}

export function syncMoonlitPresetsWithThemeList() {
    const { context, settings } = getContextAndSettings();
    if (!settings?.enabled || !settings.presets) return;

    const themeSelector = document.getElementById('themes');
    if (!themeSelector) return;

    const activePreset = settings.activePreset;
    if (
        Object.hasOwn(settings.presets, activePreset) &&
        Array.from(themeSelector.options).some(option => option.value === activePreset) &&
        (themeSelector.value !== activePreset || context.powerUserSettings?.theme !== activePreset)
    ) {
        managerConfig.updateThemeSelector(activePreset);
    }
}
