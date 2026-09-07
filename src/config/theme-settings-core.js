import { t } from '../../../../../i18n.js';

export const MESSAGE_LINE_HEIGHT_NATIVE_VALUE = '';

const NATIVE_MESSAGE_LINE_HEIGHT_VALUES = new Set([
    '',
    'calc(var(--mainfontsize)+.5rem)',
    'calc(var(--mainfontsize)+0.5rem)',
    'calc(var(--mainfontsize)+var(--linespacingdesktopleading,.5rem))',
    'calc(var(--mainfontsize)+var(--linespacingdesktopleading,0.5rem))',
]);

function normalizeCssValue(value) {
    return String(value ?? '').replace(/\s+/g, '').toLowerCase();
}

export function isNativeMessageLineHeightValue(value) {
    return NATIVE_MESSAGE_LINE_HEIGHT_VALUES.has(normalizeCssValue(value));
}

export const coreThemeSettings = [
    // - - - - - - - - - - - - - - - - - - -
    // Theme Colors Tab 主題顏色分頁
    // - - - - - - - - - - - - - - - - - - -

    // Theme Colors (theme-colors) 主題顏色
    {
        "type": "color",
        "varId": "customThemeColor",
        "displayText": t`Primary Theme Color`,
        "default": "rgba(81, 160, 222, 1)",
        "category": "theme-colors",
        "description": t`The main interface theme color, used for highlights and accents`
    },
    {
        "type": "color",
        "varId": "customThemeColor2",
        "displayText": t`Secondary Theme Color`,
        "default": "rgba(250, 198, 121, 1)",
        "category": "theme-colors",
        "description": t`A complementary secondary color, used for special highlights`
    },
    {
        "type": "color",
        "varId": "customBgColor1",
        "displayText": t`Main Background Color`,
        "default": "rgba(255, 255, 255, 0.1)",
        "category": "theme-colors",
        "description": t`The primary background color used across various menus and buttons`
    },
    {
        "type": "color",
        "varId": "customBgColor2",
        "displayText": t`Secondary Background Color`,
        "default": "rgba(255, 255, 255, 0.05)",
        "category": "theme-colors",
        "description": t`The secondary background color used across various menus and buttons`
    },
    {
        "type": "color",
        "varId": "customTopBarColor",
        "displayText": t`Top Menu Color`,
        "default": "rgba(23, 23, 23, 0.7)",
        "category": "theme-colors",
        "description": t`Background color of the top menu (#top-bar)`
    },
    {
        "type": "color",
        "varId": "Drawer-iconColor",
        "displayText": t`Menu Icon Color`,
        "default": "rgba(255, 255, 255, 0.8)",
        "category": "theme-colors",
        "description": t`Color of icons in the top menu, sidebar, and dropdown menus`
    },
    {
        "type": "color",
        "varId": "sheldBackgroundColor",
        "displayText": t`Chat Field Background Color`,
        "default": "rgba(0, 0, 0, 0.2)",
        "category": "theme-colors",
        "description": t`Background color of the chat field (#sheld)`
    },
    {
        "type": "color",
        "varId": "customScrollbarColor",
        "displayText": t`Scrollbar Color`,
        "default": "rgba(255, 255, 255, 0.5)",
        "category": "theme-colors",
        "description": t`The scrollbar color on SillyTavern`
    },

    // Global Chat Style 全局聊天樣式
    {
        "type": "checkbox",
        "varId": "hideAvatarBorder",
        "displayText": t`Hide Avatar Border`,
        "default": false,
        "category": "chat-style",
        "description": t`Hide the border around character avatars in chat messages`,
        "cssBlock": `
            #chat .mes .avatar {
                border: unset !important;
            }
        `
    },
    {
        "type": "text",
        "varId": "custom-ChatAvatar",
        "displayText": t`Chat Field Avatar Size`,
        "default": "40px",
        "category": "chat-style",
        "description": t`Width and height of character avatars in the chat field`
    },
    {
        "type": "text",
        "varId": "mesParagraphSpacingTop",
        "displayText": t`Message Paragraph Spacing (Top)`,
        "default": "0.4em",
        "category": "chat-style",
        "description": t`Sets the spacing above each paragraph in chat messages (e.g. 0.5em, 1em)`
    },
    {
        "type": "text",
        "varId": "mesParagraphSpacingBottom",
        "displayText": t`Message Paragraph Spacing (Bottom)`,
        "default": "0.6em",
        "category": "chat-style",
        "description": t`Sets the spacing below each paragraph in chat messages (e.g. 0.5em, 1em)`
    },
    {
        "type": "text",
        "varId": "charNameFontSize",
        "displayText": t`Character Name Font Size`,
        "default": "inherit",
        "category": "chat-style",
        "description": t`Font size for character (non-user) name text (e.g. 0.9rem, 1rem)`
    },
    {
        "type": "text",
        "varId": "userNameFontSize",
        "displayText": t`User Name Font Size`,
        "default": "inherit",
        "category": "chat-style",
        "description": t`Font size for user name text (e.g. 0.9rem, 1rem)`
    },
    {
        "type": "text",
        "varId": "messageTextFontSize",
        "displayText": t`Message Text Font Size`,
        "default": "15px",
        "category": "chat-style",
        "description": t`Font size for message body text (e.g. 0.95rem, 1rem, 1.05rem)`
    },
    {
        "type": "text",
        "varId": "messageLineHeight",
        "displayText": t`Message Text Line Height`,
        "default": MESSAGE_LINE_HEIGHT_NATIVE_VALUE,
        "category": "chat-style",
        "description": t`Override message line height on desktop and mobile. Leave blank to use SillyBunny's native Line Spacing slider`
    },
    {
        "type": "text",
        "varId": "messageTextLetterSpacing",
        "displayText": t`Message Text Letter Spacing`,
        "default": "inherit",
        "category": "chat-style",
        "description": t`Letter spacing for message body text (e.g. 0em, 0.02em)`
    },
    {
        "type": "text",
        "varId": "customlastInContext",
        "displayText": t`Maximum Context Marker Style`,
        "default": "1px solid var(--customThemeColor)",
        "category": "chat-style",
        "description": t`Line style for the maximum context marker`
    },

    // Background Effects (background-effects) 背景效果
    {
        "type": "slider",
        "varId": "customCSS-bg-blur",
        "displayText": t`Background Blur Intensity`,
        "default": "3",
        "min": 0,
        "max": 10,
        "step": 1,
        "category": "background-effects",
        "description": t`Adjusts the blur level of the background image`
    },
    {
        "type": "slider",
        "varId": "customCSS-bg-opacity",
        "displayText": t`Background Image Opacity`,
        "default": "1",
        "min": 0,
        "max": 1,
        "step": 0.05,
        "category": "background-effects",
        "description": t`Adjusts the opacity level of the background image`
    },
    {
        "type": "slider",
        "varId": "sheldBlurStrength",
        "displayText": t`Chat Field Background Blur Intensity`,
        "default": "5",
        "min": 0,
        "max": 10,
        "step": 1,
        "category": "background-effects",
        "description": t`Blur level of the chat field background (#sheld)`
    },
    {
        "type": "slider",
        "varId": "mobileSheldBlurStrength",
        "displayText": t`Mobile Chat Field Background Blur Intensity`,
        "default": "0",
        "min": 0,
        "max": 10,
        "step": 1,
        "category": "background-effects",
        "description": t`Blur level of the chat field background on mobile devices (#sheld)`
    },

    // Theme Extras (theme-extras) 額外主題自定義選項
    {
        "type": "checkbox",
        "varId": "enableThemeColorization",
        "displayText": t`Apply Theme Colors to More UI Elements`,
        "default": false,
        "category": "theme-extras",
        "description": t`Applies theme colors to more parts of the UI for a more personalized look`,
        "cssBlock": `
            /* Theme Colorization */
            .drawer-icon,
            #rightSendForm>div,
            #leftSendForm>div,
            .options-content a,
            .list-group-item,
            .mes_button {
                transition: all 0.5s ease;
            }
            .drawer-icon.openIcon,
            #rightSendForm>div:hover,
            #leftSendForm>div:hover,
            .options-content a:hover,
            .list-group-item:hover,
            .mes_button:hover {
                color: var(--customThemeColor) !important;
            }
            #left-nav-panel,
            #right-nav-panel,
            .drawer-content,
            #character_popup,
            #logprobsViewer,
            #floatingPrompt,
            #cfgConfig {
                border-top: 1px solid color-mix(in srgb, var(--customThemeColor) 50%, transparent) !important;
            }
            #left-nav-panel,
            #right-nav-panel,
            .drawer-content,
            #WorldInfo {
                @media screen and (max-width: 1000px) {
                    border-bottom: 1px solid color-mix(in srgb, var(--customThemeColor) 50%, transparent);
                }
            }
        `
    },
    {
    "type": "checkbox",
    "varId": "disableTopMenuAnimation",
    "displayText": t`Disable Top Menu Animations`,
    "default": false,
    "category": "theme-extras",
    "description": t`Disable top menu animation effects for a smoother experience on mobile devices`,
    "cssBlock": `
        .drawer-content,
        .fillLeft,
        .fillRight,
        .sb-shell-root,
        .sb-shell-nav-wrapper,
        .sb-shell-main,
        .sb-shell-tab,
        #right-nav-panel,
        #right-nav-panel > *,
        #sb-topbar-stack,
        #sb-topbar-stack *,
        #sb-topbar-stack *::before,
        #sb-topbar-stack *::after,
        #sb-mobile-nav,
        #sb-mobile-chat-tools {
            transition: none !important;
            animation: none !important;
        }
    `
    },
    {
    "type": "checkbox",
    "varId": "forceFixedMenuHeight",
    "displayText": t`Lock AI Response & Character Menu Height`,
    "default": true,
    "category": "theme-extras",
    "description": t`Fix AI config & character menus' height to avoid display issues. Disable if using MovingUI`,
    "cssBlock": `
            /* Force Fixed Menu Height */
            .fillLeft,
            .fillRight,
            #left-nav-panel,
            #right-nav-panel {
                min-height: calc(100dvh - var(--topBarBlockSize)) !important;
                height: calc(100dvh - var(--topBarBlockSize)) !important;
                max-height: calc(100dvh - var(--topBarBlockSize)) !important;
            }
    `
    },
    {
        "type": "checkbox",
        "varId": "newMenuMaxHeight",
        "displayText": t`Dynamically Adjust Menu Max Height (Legacy)`,
        "default": false,
        "category": "theme-extras",
        "description": t`Legacy menu height adjustment for non-SillyBunny shells. SillyBunny's native navigation handles menu sizing.`,
        "cssBlock": `
            /* Dynamic Menu Height */
            body:not(:has(.sb-shell-root)):not(:has(#sb-topbar-stack)) {
                .drawer-content {
                    max-height: calc(100dvh - var(--topBarBlockSize) - var(--formSheldHeight) - 5px) !important;
                }
                @media screen and (max-width: 1000px) {
                    .drawer-content,
                    .fillLeft, .fillRight,
                    #left-nav-panel, #right-nav-panel {
                        max-height: calc(100dvh - var(--topBarBlockSize) - var(--formSheldHeight) + 4px) !important;
                    }

                    #floatingPrompt,
                    #cfgConfig,
                    #logprobsViewer,
                    #movingDivs > div,
                    #character_popup {
                        max-height: calc(100dvh - var(--topBarBlockSize)) !important;
                        padding-bottom: 15px !important;
                    }
                }
            }
        `
    },
    {
        "type": "checkbox",
        "varId": "disableAllBorderRadius",
        "displayText": t`Disable All Border Radius`,
        "default": false,
        "category": "theme-extras",
        "description": t`Completely disable all border-radius and outline-radius effects throughout the UI`,
        "cssBlock": `
            /* Disable Border Radius */
            :root {
                --avatar-base-border-radius: 0 !important;
            }
            *, *::before, *::after {
                border-radius: 0 !important;
                border-top-left-radius: 0 !important;
                border-top-right-radius: 0 !important;
                border-bottom-left-radius: 0 !important;
                border-bottom-right-radius: 0 !important;
                outline-radius: 0 !important;
                -moz-outline-radius: 0 !important;
            }
            body.whisperstyle #chat .mes::before {
                border-radius: 0 !important;
            }
            body.ripplestyle #chat .mes .mesAvatarWrapper .avatar,
            body.ripplestyle #chat .mes .mesAvatarWrapper .avatar img,
            #extensionTopBar,
            body:has(#extensionConnectionProfiles.visible) #extensionTopBar,
            #rm_ch_create_block .avatar img {
                border-radius: 0 !important;
            }
            @media screen and (max-width: 1000px) {
                #send_form {
                    border-radius: 0 !important;
                }
            }
            svg * {
                rx: 0 !important;
                ry: 0 !important;
            }
        `
    },
    {
        "type": "checkbox",
        "varId": "expandEntryInputWidth",
        "displayText": t`Expand Entry Input Width`,
        "default": true,
        "category": "theme-extras",
        "description": t`Hide the browser’s up/down arrows in number input fields to give more space for typing`,
        "cssBlock": `
            input[type=number]::-webkit-outer-spin-button,
            input[type=number]::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            input[type=number] {
                -moz-appearance:textfield;
            }
        `
    },
    {
        "type": "checkbox",
        "varId": "compactWorldsLorebooksTopBar",
        "displayText": t`Compact Worlds/Lorebooks Top Bar`,
        "default": true,
        "category": "theme-extras",
        "description": t`Make the top fields in Worlds/Lorebooks more compact by reducing header padding and entry spacing`,
        "cssBlock": `
            .world_entry .inline-drawer-header {
                padding: 2px 10px;
            }
            .wi-card-entry {
                padding: 2px;
                margin: 2px;
            }
        `
    },

    // Advanced Custom CSS (raw-css) 無過濾額外自定義 CSS
    {
        "type": "textarea",
        "varId": "rawCustomCss",
        "displayText": t`Raw Custom CSS`,
        "default": "",
        "category": "raw-css",
        "description": t`Note: This is raw, unfiltered CSS with full support (including @import for custom fonts). Use with caution. Please use the Custom CSS option in User Settings first!!!`
    }
];
