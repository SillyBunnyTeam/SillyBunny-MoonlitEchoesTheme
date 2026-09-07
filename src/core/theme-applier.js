import { isNativeMessageLineHeightValue } from '../config/theme-settings.js';

export function shouldApplyThemeSetting(varId, value) {
    return varId !== 'messageLineHeight' || !isNativeMessageLineHeightValue(value);
}

export function getThemeCssVariable(varId) {
    return `--${varId === 'messageLineHeight' ? 'moonlit-message-line-height' : varId}`;
}

/**
 * Apply all theme settings by writing computed CSS variables to the document root.
 * @param {string} settingsKey - Extension settings key.
 * @param {Array} themeCustomSettings - Array of setting definitions containing varId/value pairs.
 * @param {Object} [contextOverride] - Optional SillyTavern context override.
 */
export function applyAllThemeSettings(settingsKey, themeCustomSettings, contextOverride) {
    if (!settingsKey || !Array.isArray(themeCustomSettings)) {
        return;
    }

    const context = contextOverride || SillyTavern?.getContext?.();
    const settings = context?.extensionSettings?.[settingsKey];
    if (!settings) {
        return;
    }

    let themeStyleElement = document.getElementById('dynamic-theme-styles');
    if (!themeStyleElement) {
        themeStyleElement = document.createElement('style');
        themeStyleElement.id = 'dynamic-theme-styles';
        document.head.appendChild(themeStyleElement);
    }

    let cssVars = ':root {\n';
    themeCustomSettings.forEach(({ varId }) => {
        if (varId && settings[varId] !== undefined && shouldApplyThemeSetting(varId, settings[varId])) {
            cssVars += `  ${getThemeCssVariable(varId)}: ${settings[varId]} !important;\n`;
        }
    });
    cssVars += '}';

    themeStyleElement.textContent = cssVars;
}
