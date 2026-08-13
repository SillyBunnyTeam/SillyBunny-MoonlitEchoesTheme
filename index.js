/**
 * Moonlit Echoes Theme for SillyTavern
 * A beautiful theme with extensive customization options
 */

// Global settings and constants
import { EXTENSION_NAME, EXTENSION_ID, THEME_VERSION, EXTENSION_REPOSITORY_URL } from './src/config/theme-info.js';
export { THEME_VERSION } from './src/config/theme-info.js';

// Import required functions for drag functionality
import { dragElement } from '../../../RossAscends-mods.js';
import { loadMovingUIState, power_user } from '../../../power-user.js';
import { t } from '../../../i18n.js';
import { tabMappings, themeCustomSettings } from './src/config/theme-settings.js';
import { settingsKey, getSettings as getExtensionSettings, saveSettings as saveExtensionSettings } from './src/services/settings-service.js';
import { initializeSlashCommands } from './src/services/slash-commands.js';
import { initExtension } from './src/bootstrap/init-extension.js';
import { installLifecycleHooks, registerDomReadyHandler } from './src/bootstrap/lifecycle-hooks.js';
import { clearActiveMessages, initControls } from './src/ui/controls.js';
import {
    configurePresetManager,
    createPresetManagerUI,
    applyActivePreset,
} from './src/ui/preset-manager.js';
import {
    addSettingToTabbedUI,
    configureSettingsTabs,
    createTabbedSettingsUI,
} from './src/ui/settings-tabs.js';
import {
    configureSettingsFactory,
    createSettingItem,
    updateSettingsUI,
    updateColorPickerUI,
    updateSelectUI,
    updateAllCheckboxStyles,
    addModernCompactStyles,
} from './src/ui/settings-factory.js';
import {
    applyAllThemeSettings as applyAllThemeSettingsCore,
    shouldApplyThemeSetting,
} from './src/core/theme-applier.js';
import { initAvatarInjector } from './src/core/observers.js';
import { addThemeButtonsHint } from './src/services/hints.js';
import { integrateWithThemeSelector } from './src/services/theme-selector.js';

export function applyAllThemeSettings(contextOverride) {
    const settings = getMoonlitSettings(contextOverride);
    if (settings?.enabled === false) {
        removeDynamicThemeStyles();
        clearInlineThemeSettings();
        removeRawCustomCss();
        return;
    }

    return applyAllThemeSettingsCore(settingsKey, themeCustomSettings, contextOverride);
}

const DISABLE_CHAT_SURFACE_RESET_ID = 'moonlit-disable-chat-surface-reset';
const DISABLE_CHAT_SURFACE_RESET_CLASS = 'moonlit-disable-chat-surface-reset';
const RAW_CUSTOM_CSS_ID = 'moonlit-raw-css';

const NATIVE_THEME_EFFECT_RESTORES = Object.freeze([
    { varId: 'customCSS-bg-blur', cssVar: '--customCSS-bg-blur', defaultValue: 0, min: 0, max: 10 },
    { varId: 'customCSS-bg-opacity', cssVar: '--customCSS-bg-opacity', defaultValue: 1, min: 0, max: 1 },
    {
        varId: 'sheldBlurStrength',
        cssVar: '--sheldBlurStrength',
        linkedCssVars: ['--mobileSheldBlurStrength'],
        defaultValue: 0,
        min: 0,
        max: 10,
    },
    { varId: 'sheldBackgroundColor', cssVar: '--sheldBackgroundColor', defaultValue: 'transparent' },
]);

const NATIVE_THEME_EFFECT_VAR_IDS = new Set(NATIVE_THEME_EFFECT_RESTORES.map(({ varId }) => varId));


function getMoonlitSettings(contextOverride) {
    try {
        const context = contextOverride || globalThis.SillyTavern?.getContext?.();
        return context ? getExtensionSettings(context) : null;
    } catch {
        return null;
    }
}


function normalizeNativeThemeEffectValue(property) {
    const value = power_user?.[property.varId] ?? property.defaultValue;
    if (typeof property.min === 'number' && typeof property.max === 'number') {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return property.defaultValue;
        }

        return Math.min(property.max, Math.max(property.min, numericValue));
    }

    const stringValue = String(value ?? '').trim();
    return stringValue || property.defaultValue;
}


function restoreNativeThemeEffects() {
    const rootStyle = document.documentElement.style;
    for (const property of NATIVE_THEME_EFFECT_RESTORES) {
        const value = String(normalizeNativeThemeEffectValue(property));
        rootStyle.setProperty(property.cssVar, value);
        for (const linkedCssVar of property.linkedCssVars || []) {
            rootStyle.setProperty(linkedCssVar, value);
        }
    }
}


function clearInlineThemeSettings({ restoreNative = true } = {}) {
    const rootStyle = document.documentElement.style;
    themeCustomSettings.forEach(({ varId }) => {
        if (varId) {
            rootStyle.removeProperty(`--${varId}`);
        }
    });

    if (restoreNative) {
        restoreNativeThemeEffects();
    }
}


function removeDynamicThemeStyles() {
    document.getElementById('dynamic-theme-styles')?.remove();
}


function removeRawCustomCss() {
    document.getElementById(RAW_CUSTOM_CSS_ID)?.remove();
}


function removeDisableChatSurfaceReset() {
    document.documentElement.classList.remove(DISABLE_CHAT_SURFACE_RESET_CLASS);
    document.getElementById(DISABLE_CHAT_SURFACE_RESET_ID)?.remove();
}


function installDisableChatSurfaceReset() {
    let resetStyle = document.getElementById(DISABLE_CHAT_SURFACE_RESET_ID);
    if (!resetStyle) {
        resetStyle = document.createElement('style');
        resetStyle.id = DISABLE_CHAT_SURFACE_RESET_ID;
        document.head.append(resetStyle);
    }

    resetStyle.textContent = `
@supports (-webkit-touch-callout: none) {
    html.${DISABLE_CHAT_SURFACE_RESET_CLASS} #sheld:not([data-sb-conversation-mode="on"]) > #chat {
        -webkit-mask: none !important;
        mask: none !important;
    }
}`;

    document.documentElement.classList.add(DISABLE_CHAT_SURFACE_RESET_CLASS);
    flushChatSurfaceLayout();
}


function flushChatSurfaceLayout() {
    const chat = document.getElementById('chat');
    if (chat instanceof HTMLElement) {
        void window.getComputedStyle(chat).maskImage;
        void chat.offsetHeight;
    }
}


/**
 * Initialize UI elements and events for the extension
 * Includes settings panel, chat style, color picker, and sidebar button
 */
export function initExtensionUI() {
    configureSettingsTabs({
        t,
        tabMappings,
        themeCustomSettings,
        createSettingItem,
        addModernCompactStyles,
    });

    Promise.resolve().then(() => {
        renderExtensionSettings();
        initAvatarInjector();

        // Apply active preset
        applyActivePreset();

        // Add creator information
        addThemeCreatorInfo();

        // Add modern compact styles
        addModernCompactStyles();

        // Integrate with theme selector
        integrateWithThemeSelector();

        // Add theme buttons hint
        addThemeButtonsHint();

        // Initialize sidebar button, popout, and message interactions
        initControls({
            settingsKey,
            t,
            dragElement,
            loadMovingUIState,
            isMessageDetailsEnabled: () => {
                const settings = getMoonlitSettings();
                return settings?.enabled === true && settings?.enableMessageDetails === true;
            },
        });

        // Initialize slash commands (only when enabled)
        initializeSlashCommands();

        const context = SillyTavern.getContext();
        const settings = getExtensionSettings(context) || {};
        if (settings.enabled === false) {
            removeRawCustomCss();
        } else {
            applyRawCustomCss(settings.rawCustomCss || '');
        }
    });

}

/**
 * Add thumbnail tip
 * Add thumbnail setting tip in the settings panel
 */
function addThumbnailTip(container) {
    // Check if tip already added
    if (document.getElementById('moonlit-thumbnail-tip')) return;

    // Create tip container
    const tipContainer = document.createElement('div');
    tipContainer.id = 'moonlit-thumbnail-tip';
    tipContainer.classList.add('moonlit-tip-container');
    tipContainer.style.borderRadius = '5px';
    tipContainer.style.overflow = 'hidden';

    // Create tip header block
    const tipHeader = document.createElement('div');
    tipHeader.classList.add('moonlit-tip-header');
    tipHeader.style.display = 'flex'; // Add flex display
    tipHeader.style.alignItems = 'center'; // Center align items vertically

    // Add small icon with better alignment
    const tipIcon = document.createElement('i');
    tipIcon.classList.add('fa', 'fa-info-circle');
    tipIcon.style.marginRight = '8px';
    tipIcon.style.display = 'flex'; // Make icon a flex container
    tipIcon.style.alignItems = 'center'; // Align icon content vertically
    tipIcon.style.justifyContent = 'center'; // Center icon content horizontally
    tipIcon.style.width = '16px'; // Fixed width
    tipIcon.style.height = '16px'; // Fixed height

    // Add tip title text
    const tipTitle = document.createElement('span');
    tipTitle.textContent = t`Blurry or thumbnail-sized character images in chat?`;
    tipTitle.style.fontWeight = 'normal';

    // Add small expand icon with consistent sizing
    const toggleIcon = document.createElement('i');
    toggleIcon.classList.add('fa', 'fa-chevron-down');
    toggleIcon.style.marginLeft = 'auto';
    toggleIcon.style.fontSize = '0.85em';
    toggleIcon.style.opacity = '0.8';
    toggleIcon.style.transition = 'transform 0.3s';
    toggleIcon.style.display = 'flex'; // Make icon a flex container
    toggleIcon.style.alignItems = 'center'; // Align icon content vertically
    toggleIcon.style.width = '16px'; // Fixed width for consistency
    toggleIcon.style.justifyContent = 'center'; // Center horizontally

    // Assemble title
    tipHeader.appendChild(tipIcon);
    tipHeader.appendChild(tipTitle);
    tipHeader.appendChild(toggleIcon);
    tipContainer.appendChild(tipHeader);

    // Create tip content
    const tipContent = document.createElement('div');
    tipContent.classList.add('moonlit-tip-content');
    tipContent.style.padding = '0';
    tipContent.style.maxHeight = '0';
    tipContent.style.overflow = 'hidden';
    tipContent.style.transition = 'all 0.3s ease';

    // Set tip content, more concise
    tipContent.innerHTML = `
        <div style="line-height: 1.4;">
            <span data-i18n="Please refer to the">Please refer to the</span> <a href="${EXTENSION_REPOSITORY_URL}" target="_blank">Moonlit Echoes Theme GitHub README</a> <span data-i18n="and complete the necessary setup.">and complete the necessary setup.</span>
            </div>
        </div>
    `;

    tipContainer.appendChild(tipContent);

    // Add click event
    tipHeader.addEventListener('click', () => {
        const isExpanded = tipContent.style.maxHeight !== '0px' && tipContent.style.maxHeight !== '0';

        if (isExpanded) {
            // Collapse
            tipContent.style.maxHeight = '0';
            tipContent.style.padding = '0 10px';
            toggleIcon.style.transform = 'rotate(0deg)';
        } else {
            // Expand
            tipContent.style.maxHeight = '1000px';
            tipContent.style.padding = '10px';
            toggleIcon.style.transform = 'rotate(180deg)';
        }
    });

    // Add to container
    container.appendChild(tipContainer);
}

/**
 * Add slash commands tip
 * Add a tip about available slash commands in the settings panel
 */
function addSlashCommandsTip(container) {
    // Check if tip already added
    if (document.getElementById('moonlit-slashcmd-tip')) return;

    // Create tip container
    const tipContainer = document.createElement('div');
    tipContainer.id = 'moonlit-slashcmd-tip';
    tipContainer.classList.add('moonlit-tip-container');
    tipContainer.style.borderRadius = '5px';
    tipContainer.style.overflow = 'hidden';

    // Create tip header block
    const tipHeader = document.createElement('div');
    tipHeader.classList.add('moonlit-tip-header');
    tipHeader.style.display = 'flex'; // Add flex display
    tipHeader.style.alignItems = 'center'; // Center align items vertically

    // Add small icon with better alignment
    const tipIcon = document.createElement('i');
    tipIcon.classList.add('fa', 'fa-terminal');
    tipIcon.style.marginRight = '8px';
    tipIcon.style.display = 'flex'; // Make icon a flex container
    tipIcon.style.alignItems = 'center'; // Align icon content vertically
    tipIcon.style.justifyContent = 'center'; // Center icon content horizontally
    tipIcon.style.width = '16px'; // Fixed width
    tipIcon.style.height = '16px'; // Fixed height

    // Add tip title text with a more concise title
    const tipTitle = document.createElement('span');
    tipTitle.textContent = t`Chat Style Slash Commands`;
    tipTitle.setAttribute('data-i18n', 'Chat Style Slash Commands');
    tipTitle.style.fontWeight = 'normal';

    // Add small expand icon with consistent sizing
    const toggleIcon = document.createElement('i');
    toggleIcon.classList.add('fa', 'fa-chevron-down');
    toggleIcon.style.marginLeft = 'auto';
    toggleIcon.style.fontSize = '0.85em';
    toggleIcon.style.opacity = '0.8';
    toggleIcon.style.transition = 'transform 0.3s';
    toggleIcon.style.display = 'flex'; // Make icon a flex container
    toggleIcon.style.alignItems = 'center'; // Align icon content vertically
    toggleIcon.style.width = '16px'; // Fixed width for consistency
    toggleIcon.style.justifyContent = 'center'; // Center horizontally

    // Assemble title
    tipHeader.appendChild(tipIcon);
    tipHeader.appendChild(tipTitle);
    tipHeader.appendChild(toggleIcon);
    tipContainer.appendChild(tipHeader);

    // Create tip content
    const tipContent = document.createElement('div');
    tipContent.classList.add('moonlit-tip-content');
    tipContent.style.padding = '0';
    tipContent.style.maxHeight = '0';
    tipContent.style.overflow = 'hidden';
    tipContent.style.transition = 'all 0.3s ease';

    // Set tip content with slash command info and increased list item spacing
    tipContent.innerHTML = `
    <div style="line-height: 1.5;">
        <span style="font-weight:500;" data-i18n="Moonlit Echoes Styles:">Moonlit Echoes Styles:</span>
        <ul style="margin-top: 5px; margin-bottom: 10px; padding-left: 20px;">
            <li style="margin-bottom: 8px;"><code>/echostyle</code> - <span data-i18n="Switch to Echo style">Switch to Echo style</span></li>
            <li style="margin-bottom: 8px;"><code>/whisperstyle</code> - <span data-i18n="Switch to Whisper style">Switch to Whisper style</span></li>
            <li style="margin-bottom: 8px;"><code>/hushstyle</code> - <span data-i18n="Switch to Hush style">Switch to Hush style</span></li>
            <li style="margin-bottom: 8px;"><code>/ripplestyle</code> - <span data-i18n="Switch to Ripple style">Switch to Ripple style</span></li>
            <li><code>/tidestyle</code> - <span data-i18n="Switch to Tide style">Switch to Tide style</span></li>
        </ul>

        <span style="font-weight:500;" data-i18n="SillyTavern Safe Switch Commands:">SillyTavern Safe Switch Commands:</span>
        <ul style="margin-top: 5px; margin-bottom: 10px; padding-left: 20px;">
            <li style="margin-bottom: 8px;"><code>/moonlit-flat</code> - <span data-i18n="Switch to Flat style">Switch to Flat style</span></li>
            <li style="margin-bottom: 8px;"><code>/moonlit-bubble</code> - <span data-i18n="Switch to Bubble style">Switch to Bubble style</span></li>
            <li><code>/moonlit-document</code> - <span data-i18n="Switch to Document style">Switch to Document style</span></li>
        </ul>

        <div style="margin-top: 8px; margin-bottom: 5px; text-align: center;">
            <span data-i18n="For more commands, see">For more commands, see</span>
            <button class="menu_button menu_button_icon inline-flex interactable" onclick="window.open('https://docs.sillytavern.app/usage/st-script/', '_blank')" tabindex="0" style="margin-left: 5px; font-size: 0.9em;">
                <i class="fa-solid fa-terminal"></i>
                <span data-i18n="STscript Reference">STscript Reference</span>
            </button>
        </div>
    </div>
`;

    tipContainer.appendChild(tipContent);

    // Add click event
    tipHeader.addEventListener('click', () => {
        const isExpanded = tipContent.style.maxHeight !== '0px' && tipContent.style.maxHeight !== '0';

        if (isExpanded) {
            // Collapse
            tipContent.style.maxHeight = '0';
            tipContent.style.padding = '0 10px';
            toggleIcon.style.transform = 'rotate(0deg)';
        } else {
            // Expand
            tipContent.style.maxHeight = '1000px';
            tipContent.style.padding = '10px';
            toggleIcon.style.transform = 'rotate(180deg)';
        }
    });

    // Add to container
    container.appendChild(tipContainer);
}


function updateThemeSelector(presetName) {
    const themeSelector = document.getElementById('themes');
    if (!themeSelector) return;

    // Only update theme selector when option already exists, don't add any new options
    let optionExists = false;

    // Check if option already exists
    for (let i = 0; i < themeSelector.options.length; i++) {
        if (themeSelector.options[i].value === presetName) {
            optionExists = true;
            themeSelector.selectedIndex = i; // Select that option
            break;
        }
    }

    // Only trigger change event if option exists
    if (optionExists) {
        themeSelector.dispatchEvent(new Event('change'));
    }
}

/**
 * Automatically load or remove CSS based on enabled status in settings
 * @param {boolean} shouldLoad - If true, load CSS, otherwise remove
 */
export function toggleCss(shouldLoad) {
    const baseUrl = getBaseUrl();
    const cssVersion = encodeURIComponent(THEME_VERSION);

    // Get existing <link> elements
    const existingLinkStyle = document.getElementById('MoonlitEchosTheme-style');
    const existingLinkExt = document.getElementById('MoonlitEchosTheme-extension');
    const existingChatStyleLink = document.getElementById('MoonlitEchosTheme-chat-styles');
    const existingDynamicThemeStyles = document.getElementById('dynamic-theme-styles');
    const existingRawCustomCss = document.getElementById(RAW_CUSTOM_CSS_ID);
    const shouldRefreshChatSurface = Boolean(
        existingLinkStyle
        || existingLinkExt
        || existingChatStyleLink
        || existingDynamicThemeStyles
        || existingRawCustomCss
        || document.documentElement.classList.contains(DISABLE_CHAT_SURFACE_RESET_CLASS),
    );

    if (shouldLoad) {
        removeDisableChatSurfaceReset();
        ensureChatStyleCss(baseUrl, cssVersion);

        // Load theme style
        const cssUrl = `${baseUrl}/style.css?v=${cssVersion}`;
        if (existingLinkStyle) {
            if (existingLinkStyle.href !== cssUrl) {
                existingLinkStyle.href = cssUrl;
            }
        } else {
            const linkStyle = document.createElement('link');
            linkStyle.id = 'MoonlitEchosTheme-style';
            linkStyle.rel = 'stylesheet';
            linkStyle.href = cssUrl;
            document.head.append(linkStyle);
        }

        // Load extension style
        const extUrl = `${baseUrl}/extension.css?v=${cssVersion}`;
        if (existingLinkExt) {
            if (existingLinkExt.href !== extUrl) {
                existingLinkExt.href = extUrl;
            }
        } else {
            const linkExt = document.createElement('link');
            linkExt.id = 'MoonlitEchosTheme-extension';
            linkExt.rel = 'stylesheet';
            linkExt.href = extUrl;
            document.head.append(linkExt);
        }

        // Ensure hint is visible
        addThemeButtonsHint();

        // Re-apply all checkbox styles if they were enabled
        updateAllCheckboxStyles(true);

        // Re-apply theme CSS variables (may have been removed on disable)
        applyAllThemeSettings();

        const settings = getMoonlitSettings();
        applyRawCustomCss(settings?.rawCustomCss || '');
    } else {
        clearActiveMessages();
        if (shouldRefreshChatSurface) {
            // Neutralize Moonlit's mask before detaching its stylesheet so the
            // browser cannot retain a transparent composited chat layer.
            installDisableChatSurfaceReset();
        } else {
            removeDisableChatSurfaceReset();
        }

        // Remove CSS
        if (existingLinkStyle) existingLinkStyle.remove();
        if (existingLinkExt) existingLinkExt.remove();
        if (existingChatStyleLink) existingChatStyleLink.remove();

        // Remove dynamic theme variables so base app CSS (e.g.
        // #chat backdrop-filter blur) doesn't use orphaned theme values
        if (existingDynamicThemeStyles) existingDynamicThemeStyles.remove();
        clearInlineThemeSettings();
        removeRawCustomCss();

        // Remove hint
        const existingHint = document.getElementById('moonlit-theme-buttons-hint');
        if (existingHint) existingHint.remove();

        // Clear all checkbox styles
        updateAllCheckboxStyles(false);

        if (shouldRefreshChatSurface) {
            flushChatSurfaceLayout();
        }
    }
}

function ensureChatStyleCss(baseUrl, cssVersion) {
    const cssUrl = `${baseUrl}/chat-styles.css?v=${cssVersion}`;
    const existingLink = document.getElementById('MoonlitEchosTheme-chat-styles');

    if (existingLink) {
        if (existingLink.href !== cssUrl) {
            existingLink.href = cssUrl;
        }
        return;
    }

    const link = document.createElement('link');
    link.id = 'MoonlitEchosTheme-chat-styles';
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.append(link);
}

/**
* Get the base URL path for the extension
* @returns {string} Base URL for the extension
*/
function getBaseUrl() {
let baseUrl = '';

// Try various possible path retrieval methods
if (typeof import.meta !== 'undefined' && import.meta.url) {
    baseUrl = new URL('.', import.meta.url).href;
} else {
    const currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
        baseUrl = currentScript.src.substring(0, currentScript.src.lastIndexOf('/'));
    } else {
        // If above methods fail, use hardcoded path
        baseUrl = `${window.location.origin}/scripts/extensions/third-party/${EXTENSION_ID}`;
    }
}

return baseUrl;
}

/**
 * Render extension settings panel - Refactored with tabbed interface
 * Create UI elements and set up event handling
 */
function renderExtensionSettings() {
    const context = SillyTavern.getContext();
    const settingsContainer = document.getElementById(`${settingsKey}-container`) ?? document.getElementById('extensions_settings2');
    if (!settingsContainer) {
        return;
    }

    // Find existing settings drawer to avoid duplication
    let existingDrawer = settingsContainer.querySelector(`#${settingsKey}-drawer`);
    if (existingDrawer) {
        return; // Don't recreate if exists
    }

    // Create settings drawer
    const inlineDrawer = document.createElement('div');
    inlineDrawer.id = `${settingsKey}-drawer`;
    inlineDrawer.classList.add('inline-drawer');
    inlineDrawer.dataset.sbDrawerPersistence = 'off';
    settingsContainer.append(inlineDrawer);

    // Create drawer title
    const inlineDrawerToggle = document.createElement('div');
    inlineDrawerToggle.classList.add('inline-drawer-toggle', 'inline-drawer-header');

    const extensionNameElement = document.createElement('b');
    extensionNameElement.textContent = EXTENSION_NAME;

    const inlineDrawerIcon = document.createElement('div');
    inlineDrawerIcon.classList.add('inline-drawer-icon', 'fa-solid', 'fa-circle-chevron-down', 'down');

    inlineDrawerToggle.append(extensionNameElement, inlineDrawerIcon);

    // Create settings content area
    const inlineDrawerContent = document.createElement('div');
    inlineDrawerContent.classList.add('inline-drawer-content');
    inlineDrawerContent.style.display = 'none';

    // Add to drawer
    inlineDrawer.append(inlineDrawerToggle, inlineDrawerContent);

    // Get settings
    const settings = getExtensionSettings(context);

    // Add creator
    addThemeCreatorInfo(inlineDrawerContent);

    // Create enable switch
    const enabledCheckboxLabel = document.createElement('label');
    enabledCheckboxLabel.classList.add('checkbox_label');
    enabledCheckboxLabel.htmlFor = `${settingsKey}-enabled`;

    const enabledCheckbox = document.createElement('input');
    enabledCheckbox.id = `${settingsKey}-enabled`;
    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.checked = settings.enabled;

    enabledCheckbox.addEventListener('change', () => {
        settings.enabled = enabledCheckbox.checked;
        toggleCss(settings.enabled);

        // Update hint display when enable status changes
        addThemeButtonsHint();

        // Re-initialize slash commands based on enabled status
        if (settings.enabled) {
            initializeSlashCommands();
        }

        saveExtensionSettings(context);
    });

    const enabledCheckboxText = document.createElement('span');
    enabledCheckboxText.textContent = t`Enable Moonlit Echoes Theme`;

    enabledCheckboxLabel.append(enabledCheckbox, enabledCheckboxText);
    inlineDrawerContent.append(enabledCheckboxLabel);

    // Toggle using original avatar images instead of thumbnails
    const originalAvatarLabel = document.createElement('label');
    originalAvatarLabel.classList.add('checkbox_label');
    originalAvatarLabel.htmlFor = `${settingsKey}-use-original-avatars`;

    const originalAvatarCheckbox = document.createElement('input');
    originalAvatarCheckbox.id = `${settingsKey}-use-original-avatars`;
    originalAvatarCheckbox.type = 'checkbox';
    originalAvatarCheckbox.checked = settings.useOriginalAvatarImages === true;

    originalAvatarCheckbox.addEventListener('change', () => {
        settings.useOriginalAvatarImages = originalAvatarCheckbox.checked;
        saveExtensionSettings(context);
        window.updateAvatars?.();
    });

    const originalAvatarText = document.createElement('span');
    originalAvatarText.textContent = t`Use original character avatars in chat messages`;

    originalAvatarLabel.append(originalAvatarCheckbox, originalAvatarText);
    inlineDrawerContent.append(originalAvatarLabel);

    // Add spacer for visual spacing
    const spacer = document.createElement('div');
    spacer.style.height = '15px';
    inlineDrawerContent.append(spacer);

    // Create preset manager
    createPresetManagerUI(inlineDrawerContent, settings);

    // Add tips
    addThumbnailTip(inlineDrawerContent);
    addSlashCommandsTip(inlineDrawerContent);

    // Add spacer for visual spacing
    const spacer2 = document.createElement('div');
    spacer2.style.height = '10px';
    inlineDrawerContent.append(spacer2);

    // Create tabbed settings UI
    createTabbedSettingsUI(inlineDrawerContent, settings);

    // Add version information
    addThemeVersionInfo(inlineDrawerContent);

    // Initialize drawer toggle functionality
    inlineDrawerToggle.addEventListener('click', function() {
        this.classList.toggle('open');
        inlineDrawerIcon.classList.toggle('down');
        inlineDrawerIcon.classList.toggle('up');
        inlineDrawerContent.classList.toggle('open');
    });
}

/**
 * Add theme creator information to settings panel
 * @param {HTMLElement} [container] - Optional container, uses default settings container if not provided
 */
function addThemeCreatorInfo(container) {
    // Check if creator info already added
    if (document.getElementById('moonlit-echoes-creator')) return;

    // If no container passed, use default settings container
    if (!container) {
        container = document.querySelector('.settings-container');
    }

    // Check if container exists
    if (!container) return;

    // Create creator info container
    const creatorContainer = document.createElement('div');
    creatorContainer.classList.add('moonlit-echoes', 'flex-container', 'flexFlowColumn');
    creatorContainer.style.marginTop = '5px';
    creatorContainer.style.marginBottom = '15px';
    creatorContainer.style.textAlign = 'center';

    // Set HTML content
    creatorContainer.innerHTML = `
        <small id="moonlit-echoes-creator">
            <span>Created with Heartfelt Passion by</span>
            <a href="https://github.com/RivelleDays" target="_blank" rel="noopener noreferrer">Rivelle</a><br>
            <span>Dedicated to All 可愛 (Kind & Wonderful) People</span><br>
            <a href="${EXTENSION_REPOSITORY_URL}" target="_blank" rel="noopener noreferrer">This is a fork specifically modified for SillyBunny. Redirect all fork issues to purachina on Github.</a>
        </small>
    `;

    // Add to settings panel container
    container.appendChild(creatorContainer);
}


/**
* Add theme version information to settings panel
* @param {HTMLElement} container - Container to add version info
*/
function addThemeVersionInfo(container) {
// Check if version info already added
if (document.getElementById('moonlit-echoes-version')) return;

// Check if container exists
if (!container) return;

// Create version info container
const versionContainer = document.createElement('div');
versionContainer.classList.add('moonlit-echoes', 'flex-container', 'flexFlowColumn');
versionContainer.style.marginTop = '5px';
versionContainer.style.marginBottom = '15px';
versionContainer.style.textAlign = 'center';

// Set HTML content
versionContainer.innerHTML = `
    <small class="flex-container justifyCenter alignitemscenter">
        <span data-i18n="Moonlit Echoes Theme Version">Moonlit Echoes Theme Version</span>
        <a id="moonlit-echoes-version"
            href="${EXTENSION_REPOSITORY_URL}"
            target="_blank"
            rel="noopener noreferrer"
            style="margin-left: 5px;">${THEME_VERSION}</a>
    </small>
`;

// Add to provided container
container.appendChild(versionContainer);
}

/**
* Apply single theme setting
* @param {string} varId - CSS variable ID
* @param {string} value - Setting value
*/
export function applyThemeSetting(varId, value) {
    const settings = getMoonlitSettings();
    if (settings?.enabled === false) {
        document.documentElement.style.removeProperty(`--${varId}`);
        if (NATIVE_THEME_EFFECT_VAR_IDS.has(varId)) {
            restoreNativeThemeEffects();
        }

        document.dispatchEvent(new CustomEvent('themeSettingChanged', {
            detail: { varId, value }
        }));
        return;
    }

    if (shouldApplyThemeSetting(varId, value)) {
        document.documentElement.style.setProperty(`--${varId}`, value, 'important');
    } else {
        document.documentElement.style.removeProperty(`--${varId}`);
        applyAllThemeSettings();
    }

    // Trigger custom event
    document.dispatchEvent(new CustomEvent('themeSettingChanged', {
        detail: { varId, value }
    }));
}
// Inject raw CSS (unfiltered) into the page via a dedicated <style> tag
function applyRawCustomCss(cssText) {
    let rawStyle = document.getElementById(RAW_CUSTOM_CSS_ID);
    if (!rawStyle) {
        rawStyle = document.createElement('style');
        rawStyle.id = RAW_CUSTOM_CSS_ID;
        // DO NOT sanitize or filter; user explicitly wants full control
        document.head.appendChild(rawStyle);
    }
    rawStyle.textContent = cssText || '';
}
// Re-apply when the setting changes (optional safety net)
document.addEventListener('themeSettingChanged', (ev) => {
    const { varId, value } = ev.detail || {};
    if (varId === 'rawCustomCss') {
        const settings = getMoonlitSettings();
        if (settings?.enabled === false) {
            removeRawCustomCss();
        } else {
            applyRawCustomCss(value);
        }
    }
});

/**
* Dynamically add a new custom setting
* Use this function to add new settings at runtime
* @param {Object} settingConfig - Setting configuration object
*/
export function addCustomSetting(settingConfig) {
    // Check setting validity
    if (!settingConfig || !settingConfig.varId || !settingConfig.type) {
        return;
    }

    // Check if already exists
    const existing = themeCustomSettings.find(s => s.varId === settingConfig.varId);
    if (existing) {
        return;
    }

    // Add to setting configuration
    themeCustomSettings.push(settingConfig);

    // Get settings and add default value
    const context = SillyTavern.getContext();
    const settings = getExtensionSettings(context);

    // If settings don't have this item, add default value
    if (settings[settingConfig.varId] === undefined) {
        settings[settingConfig.varId] = settingConfig.default;
    }

    // Save settings
    saveExtensionSettings(context);

    addSettingToTabbedUI(settingConfig, settings);
}

configureSettingsFactory({
    applyThemeSetting,
    applyRawCustomCss,
});

configurePresetManager({
    settingsKey,
    themeVersion: THEME_VERSION,
    t,
    themeCustomSettings,
    applyThemeSetting,
    applyAllThemeSettings,
    updateSettingsUI,
    updateColorPickerUI,
    updateSelectUI,
    updateThemeSelector,
});

export { addModernCompactStyles };

installLifecycleHooks({
    addModernCompactStyles,
    applyAllThemeSettings,
    addCustomSetting,
    applyThemeSetting,
    themeVersion: THEME_VERSION,
});

initExtension({
    initExtensionUI,
    toggleCss,
    registerDomReadyHandler,
});
