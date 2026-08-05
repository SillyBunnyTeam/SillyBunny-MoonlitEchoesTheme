import { t } from '../../../../../i18n.js';
import { EXTENSION_FOLDER_PATH } from '../config/theme-info.js';
import { themeCustomSettings } from '../config/theme-settings.js';
import { getSettings as getExtensionSettings, saveSettings as saveExtensionSettings } from '../services/settings-service.js';
import { rgbaToHex, hexToRgba, parseColorValue } from '../utils/color.js';

const SETTINGS_STYLES_ID = 'moonlit-modern-styles';
const SETTINGS_STYLES_URL = new URL('./settings-factory.css', import.meta.url).href;

let applyThemeSettingFn = () => {};
let applyRawCustomCssFn = () => {};
const checkboxCssVersions = new Map();

/**
 * Persist the current live settings, syncing every themeCustomSettings value
 * into the active preset so changes survive reloads (applyActivePreset reads
 * from presets on boot). Falls back to a plain debounced save when no preset
 * is available.
 */
function syncAndSaveSettings(settings, context) {
    if (settings && settings.presets && settings.activePreset && settings.presets[settings.activePreset]) {
        const activePreset = settings.presets[settings.activePreset];
        themeCustomSettings.forEach(({ varId }) => {
            if (settings[varId] !== undefined) {
                activePreset[varId] = settings[varId];
            }
        });
    }
    saveExtensionSettings(context);
}

function commitSettingChange(settings, context, varId, value, applyChange = applyThemeSettingFn) {
    settings[varId] = value;
    applyChange?.(varId, value);
    syncAndSaveSettings(settings, context);
}

export function configureSettingsFactory(options = {}) {
    applyThemeSettingFn = options.applyThemeSetting || (() => {});
    applyRawCustomCssFn = options.applyRawCustomCss || (() => {});
}

export function addModernCompactStyles() {
    if (document.getElementById(SETTINGS_STYLES_ID)) {
        return;
    }

    const linkElement = document.createElement('link');
    linkElement.id = SETTINGS_STYLES_ID;
    linkElement.rel = 'stylesheet';
    linkElement.href = SETTINGS_STYLES_URL;
    document.head.appendChild(linkElement);
}

export function createCustomSettingsUI(container, settings) {
    const categories = {};
    themeCustomSettings.forEach(setting => {
        const category = setting.category || 'general';
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(setting);
    });

    const categoryNames = {
        'colors': t`Theme Color Settings`,
        'background': t`Background Settings`,
        'chat': t`Chat Interface`,
        'visualNovel': t`Visual Novel Mode`,
        'general': t`General Settings`,
        'features': t`Advanced Settings`
    };

    Object.keys(categories).forEach(category => {
        const categoryContainer = document.createElement('div');
        categoryContainer.classList.add('theme-setting-category');

        const titleContainer = document.createElement('div');
        titleContainer.classList.add('theme-category-header');
        titleContainer.style.cursor = 'pointer';
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        titleContainer.style.marginBottom = '5px';
        titleContainer.style.padding = '5px 0';
        titleContainer.style.borderBottom = '1px solid color-mix(in srgb, var(--SmartThemeBodyColor) 10%, transparent)';

        const toggleIcon = document.createElement('i');
        toggleIcon.classList.add('fa', 'fa-chevron-down');
        toggleIcon.style.marginRight = '8px';
        toggleIcon.style.transition = 'transform 0.3s';
        toggleIcon.style.transform = 'rotate(-90deg)';

        const categoryTitle = document.createElement('h4');
        categoryTitle.textContent = categoryNames[category] || category;
        categoryTitle.style.margin = '0';

        titleContainer.appendChild(toggleIcon);
        titleContainer.appendChild(categoryTitle);
        categoryContainer.appendChild(titleContainer);

        const contentContainer = document.createElement('div');
        contentContainer.classList.add('theme-category-content');
        contentContainer.style.transition = 'max-height 0.3s ease-out, opacity 0.2s ease-out';
        contentContainer.style.overflow = 'hidden';
        contentContainer.style.maxHeight = '0px';
        contentContainer.style.opacity = '0';
        contentContainer.style.padding = '5px';

        categories[category].forEach(setting => {
            const settingContainer = document.createElement('div');
            settingContainer.classList.add('theme-setting-item');

            createSettingItem(settingContainer, setting, settings);
            contentContainer.appendChild(settingContainer);
        });

        let isCollapsed = true;
        titleContainer.addEventListener('click', () => {
            if (isCollapsed) {
                const scrollHeight = contentContainer.scrollHeight;
                contentContainer.style.maxHeight = scrollHeight + 'px';
                contentContainer.style.opacity = '1';
                toggleIcon.style.transform = 'rotate(0deg)';
            } else {
                contentContainer.style.maxHeight = '0px';
                contentContainer.style.opacity = '0';
                toggleIcon.style.transform = 'rotate(-90deg)';
            }
            isCollapsed = !isCollapsed;
        });

        categoryContainer.appendChild(contentContainer);
        container.appendChild(categoryContainer);
    });

    addModernCompactStyles();
}

export function createSettingItem(container, setting, settings) {
    const settingContainer = document.createElement('div');
    settingContainer.classList.add('theme-setting-container');

    if (setting.type !== 'checkbox') {
        const label = document.createElement('label');
        label.textContent = setting.displayText;
        settingContainer.appendChild(label);

        if (setting.description) {
            const description = document.createElement('small');
            description.textContent = setting.description;
            settingContainer.appendChild(description);
        }
    }

    switch (setting.type) {
        case 'color':    createColorPicker(settingContainer, setting, settings); break;
        case 'slider':   createSlider(settingContainer, setting, settings); break;
        case 'select':   createSelect(settingContainer, setting, settings); break;
        case 'text':     createTextInput(settingContainer, setting, settings); break;
        case 'checkbox': createCheckbox(settingContainer, setting, settings); break;
        case 'textarea': createTextareaInput(settingContainer, setting, settings); break;
        default:
            break;
    }

    container.appendChild(settingContainer);
}

function createColorPicker(container, setting, settings) {
    const context = SillyTavern.getContext();
    const { varId, default: defaultValue } = setting;
    const currentValue = settings[varId] || defaultValue;
    const literalColor = parseColorValue(currentValue);
    const initialColor = literalColor || parseCssColorValue(currentValue);
    const initialHexValue = initialColor?.hex;
    const initialAlphaValue = initialColor?.alpha ?? 1;

    const colorPickerContainer = document.createElement('div');
    colorPickerContainer.classList.add('theme-color-picker');
    colorPickerContainer.style.display = 'flex';
    colorPickerContainer.style.alignItems = 'center';
    colorPickerContainer.style.gap = '10px';
    colorPickerContainer.style.padding = '2px 0';
    colorPickerContainer.style.minHeight = '36px';

    const colorPreview = document.createElement('div');
    colorPreview.id = `cts-${varId}-preview`;
    colorPreview.classList.add('color-preview');
    colorPreview.style.width = '30px';
    colorPreview.style.height = '30px';
    colorPreview.style.minWidth = '30px';
    colorPreview.style.minHeight = '30px';
    colorPreview.style.borderRadius = '4px';
    colorPreview.style.border = '1px solid color-mix(in srgb, var(--SmartThemeBodyColor) 10%, transparent)';
    colorPreview.style.background = currentValue;
    colorPreview.style.cursor = 'pointer';
    colorPreview.style.boxShadow = '0 1px 3px var(--SmartThemeShadowColor)';

    const textInput = document.createElement('input');
    textInput.id = `cts-${varId}-text`;
    textInput.type = 'text';
    textInput.value = literalColor?.hex || currentValue;
    textInput.classList.add('color-input-text');
    textInput.style.flex = '1';
    textInput.style.minWidth = '80px';
    textInput.style.minHeight = '28px';
    textInput.style.padding = '4px 6px';
    textInput.style.backgroundColor = 'var(--black30a)';
    textInput.style.border = '1px solid color-mix(in srgb, var(--SmartThemeBodyColor) 10%, transparent)';
    textInput.style.borderRadius = '4px';
    textInput.style.color = 'var(--SmartThemeBodyColor)';

    const colorInput = document.createElement('input');
    colorInput.id = `cts-${varId}-color`;
    colorInput.type = 'color';
    colorInput.value = initialHexValue || '#ffffff';
    colorInput.style.width = '1px';
    colorInput.style.height = '1px';
    colorInput.style.opacity = '0';
    colorInput.style.position = 'absolute';
    colorInput.style.pointerEvents = 'auto';

    const alphaContainer = document.createElement('div');
    alphaContainer.style.display = 'flex';
    alphaContainer.style.flexDirection = 'column';
    alphaContainer.style.width = '120px';
    alphaContainer.style.gap = '3px';

    const alphaLabel = document.createElement('span');
    alphaLabel.textContent = t`Opacity`;
    alphaLabel.style.fontSize = '10px';
    alphaLabel.style.opacity = '0.7';
    alphaLabel.style.alignSelf = 'flex-start';

    const alphaRow = document.createElement('div');
    alphaRow.style.display = 'flex';
    alphaRow.style.alignItems = 'center';
    alphaRow.style.width = '100%';
    alphaRow.style.gap = '5px';

    const alphaSlider = document.createElement('input');
    alphaSlider.id = `cts-${varId}-alpha`;
    alphaSlider.type = 'range';
    alphaSlider.min = '0';
    alphaSlider.max = '100';
    alphaSlider.step = '1';
    alphaSlider.value = Math.round(initialAlphaValue * 100);
    alphaSlider.style.flex = '1';
    alphaSlider.style.height = '5px';
    alphaSlider.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    alphaSlider.style.borderRadius = '2px';
    alphaSlider.style.appearance = 'none';
    alphaSlider.style.outline = 'none';

    const alphaValue = document.createElement('span');
    alphaValue.id = `cts-${varId}-alpha-value`;
    alphaValue.textContent = Math.round(initialAlphaValue * 100);
    alphaValue.style.minWidth = '28px';
    alphaValue.style.textAlign = 'right';

    textInput.addEventListener('input', () => {
        if (!isSixDigitHex(textInput.value)) return;

        const parsedColor = parseColorValue(textInput.value);
        const alpha = alphaSlider.value / 100;
        colorPreview.style.background = hexToRgba(parsedColor.hex, alpha);
        colorInput.value = parsedColor.hex;
    });

    textInput.addEventListener('change', () => {
        const inputValue = textInput.value.trim();
        const isHexInput = isSixDigitHex(inputValue);
        const parsedColor = isHexInput
            ? withAlpha(parseColorValue(inputValue), alphaSlider.value / 100)
            : parseCssColorValue(inputValue);

        if (!parsedColor) {
            restoreTextInput();
            return;
        }

        commitColor(parsedColor, {
            updateText: isHexInput,
            dispatchColorChanged: isHexInput,
        });
    });

    colorPreview.addEventListener('click', () => {
        colorInput.click();
    });

    colorInput.addEventListener('input', () => {
        commitColor(withAlpha(parseColorValue(colorInput.value), alphaSlider.value / 100), {
            updateText: true,
        });
    });

    alphaSlider.addEventListener('input', () => {
        commitCurrentControls();
    });

    alphaSlider.addEventListener('change', () => {
        commitCurrentControls();
    });

    textInput.addEventListener('focusout', () => {
        if (!isSixDigitHex(textInput.value.trim())) restoreTextInput();
    });

    function commitCurrentControls() {
        commitColor(withAlpha(parseColorValue(colorInput.value), alphaSlider.value / 100));
    }

    function commitColor(color, options = {}) {
        const { updateText = false, dispatchColorChanged = false } = options;
        renderColor(color, updateText);
        settings[varId] = color.rgba;
        applyThemeSettingFn(varId, color.rgba);
        syncAndSaveSettings(settings, context);

        if (dispatchColorChanged) {
            document.dispatchEvent(new CustomEvent('colorChanged', {
                detail: { varId, value: color.rgba, hexColor: color.hex }
            }));
        }
    }

    function renderColor(color, updateText) {
        const alphaPercent = Math.round(color.alpha * 100);
        colorPreview.style.background = color.rgba;
        colorInput.value = color.hex;
        alphaSlider.value = alphaPercent;
        alphaValue.textContent = alphaPercent;
        updateColorSliderThumb(varId, color.hex);

        if (updateText) textInput.value = color.hex;
    }

    function restoreTextInput() {
        const previousValue = settings[varId] || defaultValue;
        textInput.value = rgbaToHex(previousValue) || previousValue;
    }

    alphaRow.appendChild(alphaSlider);
    alphaRow.appendChild(alphaValue);
    alphaContainer.appendChild(alphaLabel);
    alphaContainer.appendChild(alphaRow);

    colorPickerContainer.appendChild(colorPreview);
    colorPickerContainer.appendChild(textInput);
    colorPickerContainer.appendChild(alphaContainer);
    colorPickerContainer.appendChild(colorInput);

    container.appendChild(colorPickerContainer);

    setTimeout(() => {
        updateColorSliderThumb(varId, initialHexValue || '#ffffff');
    }, 10);
}

function isSixDigitHex(value) {
    return /^#[0-9a-f]{6}$/i.test(value);
}

function withAlpha(color, alpha) {
    if (!color) return null;

    return {
        hex: color.hex,
        rgba: hexToRgba(color.hex, alpha),
        alpha,
    };
}

function parseCssColorValue(value) {
    const parsedColor = parseColorValue(value);
    if (parsedColor) return parsedColor;

    const colorProbe = document.createElement('span');
    colorProbe.style.position = 'absolute';
    colorProbe.style.visibility = 'hidden';
    colorProbe.style.color = value;
    if (!colorProbe.style.color) return null;

    const parent = document.body || document.documentElement;
    if (!parent) return null;

    parent.appendChild(colorProbe);
    try {
        const computedColor = getComputedStyle(colorProbe).color;
        return parseColorValue(computedColor) || parseRenderedColorValue(computedColor);
    } catch {
        return null;
    } finally {
        colorProbe.remove();
    }
}

function parseRenderedColorValue(value) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    // Canvas converts CSS Color 4 values into the sRGB bytes required by the native picker.
    const serializedColor = serializeColor(value);
    if (!serializedColor) return null;

    const alphaByte = readPixel(serializedColor)[3];
    const opaqueColor = serializeColor(`rgb(from ${serializedColor} r g b / 1)`) || serializedColor;
    const [r, g, b] = readPixel(opaqueColor);
    const alphaPattern = /\/\s*((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(%)?\s*\)$/i;
    const alphaMatch = value.match(alphaPattern) || serializedColor.match(alphaPattern);
    const renderedAlpha = alphaMatch
        ? Number(alphaMatch[1]) / (alphaMatch[2] ? 100 : 1)
        : alphaByte / 255;
    const alpha = Math.min(Math.max(renderedAlpha, 0), 1);
    return parseColorValue(`rgba(${r}, ${g}, ${b}, ${alpha})`);

    function serializeColor(color) {
        context.fillStyle = '#010203';
        context.fillStyle = color;
        const firstResult = context.fillStyle;

        context.fillStyle = '#040506';
        context.fillStyle = color;
        return context.fillStyle === firstResult ? firstResult : null;
    }

    function readPixel(color) {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return context.getImageData(0, 0, 1, 1).data;
    }
}

function createSlider(container, setting, settings) {
    const context = SillyTavern.getContext();
    const { varId, default: defaultValue, min, max, step } = setting;

    const sliderContainer = document.createElement('div');
    sliderContainer.style.display = 'flex';
    sliderContainer.style.alignItems = 'center';
    sliderContainer.style.gap = '10px';
    sliderContainer.style.maxWidth = '480px';

    const slider = document.createElement('input');
    slider.id = `cts-slider-${varId}`;
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = settings[varId] || defaultValue;
    slider.classList.add('moonlit-neo-range-input');
    slider.style.flex = '1';

    const numberInput = document.createElement('input');
    numberInput.id = `cts-number-${varId}`;
    numberInput.type = 'number';
    numberInput.min = min;
    numberInput.max = max;
    numberInput.step = step;
    numberInput.value = settings[varId] || defaultValue;
    numberInput.classList.add('moonlit-neo-range-input');
    numberInput.style.width = '60px';

    slider.addEventListener('input', () => {
        numberInput.value = slider.value;
        commitSettingChange(settings, context, varId, slider.value);
    });

    numberInput.addEventListener('change', () => {
        slider.value = numberInput.value;
        commitSettingChange(settings, context, varId, numberInput.value);
    });

    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(numberInput);
    container.appendChild(sliderContainer);
}

function createSelect(container, setting, settings) {
    const context = SillyTavern.getContext();
    const { varId, default: defaultValue, options } = setting;

    const select = document.createElement('select');
    select.id = `cts-${varId}`;
    select.classList.add('widthNatural', 'flex1', 'margin0', 'moonlit-select');

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        optionElement.selected = (settings[varId] || defaultValue) === option.value;
        select.appendChild(optionElement);
    });

    select.addEventListener('change', () => {
        commitSettingChange(settings, context, varId, select.value);
    });

    container.appendChild(select);
}

function createTextInput(container, setting, settings) {
    const context = SillyTavern.getContext();
    const { varId, default: defaultValue } = setting;

    const input = document.createElement('input');
    input.id = `cts-${varId}`;
    input.type = 'text';
    input.value = settings[varId] || defaultValue;
    input.classList.add('text_pole', 'wide100p', 'widthNatural', 'flex1', 'margin0', 'moonlit-input');

    input.addEventListener('change', () => {
        commitSettingChange(settings, context, varId, input.value);
    });

    container.appendChild(input);
}

function createTextareaInput(container, setting, settings) {
    const context = SillyTavern.getContext();
    const { varId, default: defaultValue } = setting;

    const textarea = document.createElement('textarea');
    textarea.id = `cts-${varId}`;
    textarea.classList.add('text_pole', 'margin0', 'margin-r5', 'textarea_compact', 'monospace');
    textarea.rows = 10;
    textarea.spellcheck = false;
    textarea.value = (settings[varId] ?? defaultValue) || '';

    const applyChange = varId === 'rawCustomCss'
        ? (_varId, value) => applyRawCustomCssFn(value)
        : null;
    const apply = () => {
        commitSettingChange(settings, context, varId, textarea.value, applyChange);
    };

    textarea.addEventListener('change', apply);
    textarea.addEventListener('input', apply);

    container.appendChild(textarea);
}

function getCheckboxStyleElement(varId) {
    let styleElement = document.getElementById(`css-block-${varId}`);
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = `css-block-${varId}`;
        document.head.appendChild(styleElement);
    }
    return styleElement;
}

async function applyCheckboxCss(setting, settings, enabled) {
    const { varId, cssBlock, cssFile } = setting;
    if (!cssBlock && !cssFile) return;

    const version = (checkboxCssVersions.get(varId) || 0) + 1;
    checkboxCssVersions.set(varId, version);
    const styleElement = getCheckboxStyleElement(varId);
    if (!settings || !settings.enabled || !enabled) {
        styleElement.textContent = '';
        return;
    }

    if (cssFile) {
        try {
            const response = await fetch(`${EXTENSION_FOLDER_PATH}/css/${cssFile}`);
            if (response.ok) {
                const cssText = await response.text();
                if (
                    checkboxCssVersions.get(varId) === version &&
                    settings.enabled &&
                    settings[varId] === true
                ) {
                    styleElement.textContent = cssText;
                }
            }
        } catch {
            // Silently ignore CSS loading errors.
        }
        return;
    }

    styleElement.textContent = cssBlock;
}

export function updateAllCheckboxStyles(extensionEnabled) {
    if (!extensionEnabled) {
        themeCustomSettings.forEach(({ type, varId }) => {
            if (type === 'checkbox') {
                checkboxCssVersions.set(varId, (checkboxCssVersions.get(varId) || 0) + 1);
            }
        });
        document.querySelectorAll('style[id^="css-block-"]').forEach((styleElement) => {
            styleElement.textContent = '';
        });
        return;
    }

    const context = SillyTavern.getContext();
    const settings = getExtensionSettings(context);
    if (!settings) return;

    themeCustomSettings.forEach((setting) => {
        if (setting.type === 'checkbox') {
            void applyCheckboxCss(setting, settings, extensionEnabled && settings[setting.varId] === true);
        }
    });
}

function createCheckbox(container, setting, settings) {
    const context = SillyTavern.getContext();
    const { varId, default: defaultValue, displayText, description } = setting;

    const checkboxContainer = document.createElement('div');
    checkboxContainer.classList.add('checkbox-container');
    checkboxContainer.style.display = 'flex';
    checkboxContainer.style.flexDirection = 'column';
    checkboxContainer.style.marginTop = '8px';

    const checkboxRow = document.createElement('div');
    checkboxRow.style.display = 'flex';
    checkboxRow.style.alignItems = 'center';

    const label = document.createElement('label');
    label.htmlFor = `cts-checkbox-${varId}`;
    label.textContent = displayText;
    label.style.marginRight = '8px';
    label.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.id = `cts-checkbox-${varId}`;
    checkbox.type = 'checkbox';
    checkbox.checked = settings[varId] === true;
    checkbox.style.marginLeft = 'auto';

    void applyCheckboxCss(setting, settings, checkbox.checked);

    checkbox.addEventListener('change', () => {
        commitSettingChange(settings, context, varId, checkbox.checked, (changedVarId, enabled) => {
            void applyCheckboxCss(setting, settings, enabled);
            applyThemeSettingFn(changedVarId, enabled ? 'true' : 'false');
        });
    });

    checkboxRow.appendChild(label);
    checkboxRow.appendChild(checkbox);
    checkboxContainer.appendChild(checkboxRow);

    if (description) {
        const descriptionElement = document.createElement('small');
        descriptionElement.textContent = description;
        descriptionElement.style.marginLeft = '0';
        descriptionElement.style.marginTop = '4px';
        descriptionElement.style.opacity = '0.7';
        descriptionElement.style.fontSize = '0.85em';
        checkboxContainer.appendChild(descriptionElement);
    }

    container.appendChild(checkboxContainer);
}

export function updateSettingsUI() {
    const context = SillyTavern.getContext();
    const settings = getExtensionSettings(context);

    themeCustomSettings.forEach(setting => {
        const { varId, type } = setting;
        const value = settings[varId];

        switch (type) {
            case 'color':
                updateColorPickerUI(varId, value);
                break;
            case 'slider':
                updateSliderUI(varId, value);
                break;
            case 'select':
                updateSelectUI(varId, value);
                break;
            case 'text':
            case 'textarea':
                updateTextInputUI(varId, value);
                break;
            case 'checkbox':
                updateCheckboxUI(varId, value, settings);
                break;
        }
    });
}

export function updateColorPickerUI(varId, value) {
    const literalColor = parseColorValue(value);
    const resolvedColor = literalColor || parseCssColorValue(value);
    const colorPreview = document.querySelector(`#cts-${varId}-preview`);
    if (colorPreview) {
        colorPreview.style.background = value;
    }

    const colorPicker = document.querySelector(`#cts-${varId}-color`);
    if (colorPicker && resolvedColor) {
        colorPicker.value = resolvedColor.hex;
    }

    const textInput = document.querySelector(`#cts-${varId}-text`);
    if (textInput) {
        textInput.value = literalColor?.hex || value;
    }

    const alphaSlider = document.querySelector(`#cts-${varId}-alpha`);
    const alphaValue = document.querySelector(`#cts-${varId}-alpha-value`);

    if (alphaSlider && alphaValue) {
        const alpha = resolvedColor?.alpha ?? 1;
        const alphaPercent = Math.round(alpha * 100);
        alphaSlider.value = alphaPercent;
        alphaValue.textContent = alphaPercent;

        if (resolvedColor) {
            setTimeout(() => {
                updateColorSliderThumb(varId, resolvedColor.hex);
            }, 10);
        }
    }
}

function updateSliderUI(varId, value) {
    const slider = document.querySelector(`#cts-slider-${varId}`);
    if (slider) {
        slider.value = value;
    }

    const numberInput = document.querySelector(`#cts-number-${varId}`);
    if (numberInput) {
        numberInput.value = value;
    }
}

export function updateSelectUI(varId, value) {
    const select = document.querySelector(`#cts-${varId}`);
    if (!select) return;

    const settingConfig = themeCustomSettings.find(s => s.varId === varId);
    if (!settingConfig || !settingConfig.options) return;

    select.innerHTML = '';

    settingConfig.options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        optionElement.selected = value === option.value;
        select.appendChild(optionElement);
    });

    select.value = value;
}

export function updateTextInputUI(varId, value) {
    const input = document.querySelector(`#cts-${varId}`);
    if (input) {
        input.value = value;
    }
}

export function updateCheckboxUI(varId, value, settingsOverride) {
    const checkbox = document.querySelector(`#cts-checkbox-${varId}`);
    if (checkbox) {
        checkbox.checked = value === true;
    }

    const setting = themeCustomSettings.find(({ varId: settingVarId }) => settingVarId === varId);
    if (!setting) return;

    const context = SillyTavern.getContext();
    const settings = settingsOverride || getExtensionSettings(context);
    void applyCheckboxCss(setting, settings, value === true);
}

function updateColorSliderThumb(varId, hexColor) {
    const alphaSlider = document.querySelector(`#cts-${varId}-alpha`);
    if (!alphaSlider) return;

    let styleElement = document.getElementById(`thumb-style-${varId}`);
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = `thumb-style-${varId}`;
        document.head.appendChild(styleElement);
    }

    const newThumbStyle = `
        #cts-${varId}-alpha::-webkit-slider-thumb {
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${hexColor};
            border: 1px solid color-mix(in srgb, var(--SmartThemeBodyColor) 10%, transparent);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            cursor: pointer;
        }
        #cts-${varId}-alpha::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${hexColor};
            border: 1px solid color-mix(in srgb, var(--SmartThemeBodyColor) 10%, transparent);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            cursor: pointer;
        }
    `;

    styleElement.textContent = newThumbStyle;
}

document.addEventListener('colorChanged', (event) => {
    const { varId, hexColor } = event.detail;
    updateColorSliderThumb(varId, hexColor);
});
