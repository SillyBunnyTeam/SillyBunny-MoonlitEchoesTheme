import { configurePopout, togglePopout, isPopoutVisible } from './popout.js';

let currentSettingsKey = '';
let translateTag = null;
let sidebarStylesInjected = false;
let drawerHeaderFixRegistered = false;
let messageClickHandlersInitialized = false;
let isMessageDetailsEnabled = () => false;

/**
 * Initialize Moonlit Echoes UI controls.
 * @param {object} options
 * @param {string} options.settingsKey
 * @param {Function} options.t
 * @param {Function} options.dragElement
 * @param {Function} options.loadMovingUIState
 * @param {Function} options.isMessageDetailsEnabled
 */
export function initControls(options = {}) {
    currentSettingsKey = options.settingsKey || currentSettingsKey;
    translateTag = options.t || translateTag;
    isMessageDetailsEnabled = options.isMessageDetailsEnabled || isMessageDetailsEnabled;

    configurePopout({
        settingsKey: currentSettingsKey,
        dragElement: options.dragElement,
        loadMovingUIState: options.loadMovingUIState,
        onVisibilityChange: updateSidebarButtonState,
    });

    initializeSidebarButton();
    addSettingsPopoutButton();
    registerDrawerHeaderFix();
    ensureMessageClickHandlers();
    addExtensionMenuButton();
}

export { togglePopout as toggleSettingsPopout } from './popout.js';

function addExtensionMenuButton() {
    const $extensionsMenu = $('#extensionsMenu');
    if (!$extensionsMenu.length) {
        return;
    }

    $extensionsMenu
        .children('[data-moonlit-extension-menu-button="true"], .moonlit-echoes-menu-button')
        .remove();
    $extensionsMenu
        .children()
        .filter((_, element) => element.title === 'Open Moonlit Echoes Theme Settings'
            && element.textContent.trim() === 'Moonlit Echoes')
        .remove();

    const $button = $(`
        <div class="list-group-item flex-container flexGap5 interactable moonlit-echoes-menu-button" data-moonlit-extension-menu-button="true" title="Open Moonlit Echoes Theme Settings" data-i18n="[title]Open Moonlit Echoes Theme Settings" tabindex="0">
            <i class="fa-solid fa-moon"></i>
            <span>Moonlit Echoes</span>
        </div>
    `);

    $button.appendTo($extensionsMenu);
    $button.on('click', togglePopout);
}

function initializeSidebarButton() {
    if ($('#moonlit_sidebar_button').length === 0) {
        const $button = $(`
            <button type="button" id="moonlit_sidebar_button" class="fa-solid fa-moon" title="Moonlit Echoes" aria-label="Moonlit Echoes"></button>
        `);

        $('#sidebar-buttons').append($button);

        $button.on('click', togglePopout);
    }

    if (!sidebarStylesInjected) {
        const buttonStyles = `
            .moonlit-tip-container {
                margin: 10px 0;
                border: 1px solid color-mix(in srgb, var(--SmartThemeBodyColor) 10%, transparent);
                border-radius: 5px;
                overflow: hidden;
                font-size: 0.9em !important;
            }

            .moonlit-tip-header {
                padding: 6px 10px;
                background: color-mix(in srgb, var(--SmartThemeBodyColor) 10%, transparent);
                cursor: pointer;
                display: flex;
                align-items: center;
            }

            #moonlit_sidebar_button {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                cursor: pointer;
                border: 0;
                background: transparent;
                border-radius: 8px;
                margin-bottom: 5px;
                color: var(--SmartThemeBodyColor);
                transition: all 0.3s ease;
                font-size: 16px;
            }

            #moonlit_sidebar_button:hover {
                background-color: var(--SmartThemeButtonHoverColor);
                transform: scale(1.05);
            }

            #moonlit_sidebar_button.active {
                background-color: var(--customThemeColor, var(--SmartThemeButtonActiveColor));
                color: var(--SmartThemeButtonActiveTextColor);
            }

            #moonlit_echoes_popout {
                top: var(--topBarBlockSize);
                max-width: 100dvw;
                max-height: calc(100dvh - var(--topBarBlockSize));
                overflow: hidden;
                border-radius: 0;
                z-index: 10000;
                padding: 0;
                padding-bottom: 15px;
                border: 0;
                border-top: 1px solid color-mix(in srgb, var(--SmartThemeBodyColor) 25%, transparent) !important;

                @media screen and (max-width: 1000px) {
                    max-height: calc(100dvh - var(--topBarBlockSize)) !important;
                }
            }

            #moonlit_echoes_content_container {
                padding: 0 15px;
                overflow: auto;
                max-height: calc(100dvh - var(--topBarBlockSize) - 65px);

                .moonlit-tab-buttons {
                    position: sticky;
                    top: 0;
                    backdrop-filter: blur(var(--SmartThemeBlurStrength));
                    background-color: var(--SmartThemeBlurTintColor);
                    z-index: 100;
                }

                .inline-drawer-content {
                    @media screen and (max-width: 1000px) {
                        padding: 0px !important;
                    }
                }
            }

            #moonlit_echoes_popout .panelControlBar {
                padding: 10px 15px;
                justify-content: space-between;
                align-items: center;
                position: sticky;
                top: 0;
                font-weight: 500;
                border-bottom: 1px solid color-mix(in srgb, var(--SmartThemeBodyColor) 25%, transparent);
            }

            #moonlit_echoes_popout .dragClose {
                cursor: pointer;
                margin-bottom: 5px;
            }
        `;

        $('head').append(`<style>${buttonStyles}</style>`);
        sidebarStylesInjected = true;
    }

    updateSidebarButtonState();
}

function addSettingsPopoutButton() {
    if (!currentSettingsKey) return;
    if ($('#moonlit_settings_popout_button').length > 0) return;

    const $header = $(`#${currentSettingsKey}-drawer .inline-drawer-header`);
    if ($header.length === 0) return;

    const translate = getTranslate();
    const titleText = translate`Pop out settings to a floating window`;

    const $button = $(`
        <i id="moonlit_settings_popout_button" class="fa-solid fa-window-restore menu_button margin0 interactable"
        tabindex="0" title="${titleText}"></i>
    `);

    const $title = $header.find('b');

    if ($title.length && !$title.parent().hasClass('title-container')) {
        $title.wrap('<div class="title-container" style="display: flex; align-items: center;"></div>');
    }

    $title.after($button);

    $button.css({
        'margin-left': '5px',
        'display': 'inline-flex',
        'vertical-align': 'middle',
    });

    $title.css({
        'flex': '0 1 auto',
        'white-space': 'nowrap',
        'overflow': 'hidden',
        'text-overflow': 'ellipsis',
    });

    $button.on('click', (event) => {
        togglePopout(event);
        event.stopPropagation();
    });

    $header.css({
        'display': 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
    });
}

function registerDrawerHeaderFix() {
    if (drawerHeaderFixRegistered || !currentSettingsKey) return;

    const applyFix = () => fixDrawerHeaderLayout(currentSettingsKey);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyFix, { once: true });
    } else {
        applyFix();
    }

    drawerHeaderFixRegistered = true;
}

function fixDrawerHeaderLayout(settingsKey) {
    if (document.getElementById('moonlit-header-fix-style')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'moonlit-header-fix-style';
    styleElement.textContent = `
        #${settingsKey}-drawer .inline-drawer-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
        }

        #${settingsKey}-drawer .inline-drawer-header b {
            flex: 0 1 auto !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            margin-right: 10px !important;
        }

        #moonlit_settings_popout_button {
            margin-left: 5px !important;
            margin-right: auto !important;
        }

        .title-container {
            display: flex !important;
            align-items: center !important;
            flex: 1 !important;
            min-width: 0 !important;
        }

        #${settingsKey}-drawer .inline-drawer-icon {
            margin-left: auto !important;
        }
    `;

    document.head.appendChild(styleElement);
}

function ensureMessageClickHandlers() {
    if (messageClickHandlersInitialized) return;
    initMessageClickHandlers();
    messageClickHandlersInitialized = true;
}

function initMessageClickHandlers() {
    document.addEventListener('click', onDocumentClickForMessageToggles);
    document.addEventListener('themeSettingChanged', onThemeSettingChanged);
}

function onDocumentClickForMessageToggles(event) {
    if (!getMessageDetailsEnabledState()) {
        clearActiveMessages();
        return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;

    const messageElement = target.closest('.mes');

    if (messageElement) {
        const isMessageAction = target.closest(
            '.extraMesButtonsHint, .extraMesButtons, .mes_button, .mes_edit, .mes_edit_buttons',
        );
        if (isMessageAction) {
            messageElement.classList.add('active-message');
            return;
        }

        const isInteractiveElement = target.closest(
            'a, button, input, textarea, select, [contenteditable="true"]',
        );
        const isClickInsideDetails = target.closest(
            '.ch_name, .mesIDDisplay, .mes_timer, .tokenCounterDisplay, .mes_reasoning_details',
        );
        if (isInteractiveElement || isClickInsideDetails) return;

        messageElement.classList.toggle('active-message');
    } else {
        clearActiveMessages();
    }
}

function onThemeSettingChanged(event) {
    const { varId, value } = event.detail || {};
    if (
        varId === 'enableMessageDetails' &&
        (value === false || value === 'false' || !getMessageDetailsEnabledState())
    ) {
        clearActiveMessages();
    }
}

function getMessageDetailsEnabledState() {
    try {
        return isMessageDetailsEnabled() === true;
    } catch {
        return false;
    }
}

export function clearActiveMessages() {
    document.querySelectorAll('.mes.active-message').forEach((activeMessage) => {
        activeMessage.classList.remove('active-message');
    });
}

function updateSidebarButtonState() {
    const $button = $('#moonlit_sidebar_button');
    if ($button.length === 0) return;

    if (isPopoutVisible()) {
        $button.addClass('active');
    } else {
        $button.removeClass('active');
    }
}

function getTranslate() {
    if (typeof translateTag === 'function') {
        return translateTag;
    }

    return (strings, ...values) => strings.reduce((result, part, index) => {
        const value = index < values.length ? values[index] : '';
        return result + part + value;
    }, '');
}
