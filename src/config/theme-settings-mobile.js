import { t } from '../../../../../i18n.js';

export const mobileThemeSettings = [
    // - - - - - - - - - - - - - - - - - - -
    // Mobile Devices Tab 行動裝置設定分頁
    // - - - - - - - - - - - - - - - - - - -

    // Mobile Global Settings (mobile-global-settings) 一般行動樣式
    {
        "type": "checkbox",
        "varId": "enableMobile-hidden_scrollbar",
        "displayText": t`Enable Mobile Hidden Scrollbar`,
        "default": true,
        "category": "mobile-global-settings",
        "description": t`Hides scrollbars for a clean mobile interface`,
        "cssBlock":  `
            /* Mobile Hidden Scrollbar */
            @media screen and (max-width: 1000px) {
                * {
                    scrollbar-width: none !important;
                    -ms-overflow-style: none !important;
                }
                *::-webkit-scrollbar {
                    display: none !important;
                }

                .scrollableInner,
                #form_create,
                #rm_print_characters_block,
                #extensionSideBar #extensionSideBarContainer {
                    padding: 0 !important;
                }
            }
        `
    },
    {
        "type": "checkbox",
        "varId": "enableMobile-send_form",
        "displayText": t`Enable New Mobile Input Field (Legacy)`,
        "default": false,
        "category": "mobile-global-settings",
        "description": t`Legacy mobile input layout for non-SillyBunny shells. SillyBunny's native composer now handles this layout and sizing.`,
        "cssBlock":  `
            /* Mobile Input Field */
            @media screen and (max-width: 1000px) {
                body:not(:has(.sb-shell-root)):not(:has(#sb-topbar-stack)) {
                    #form_sheld {}

                    &:has([data-slide-toggle="shown"]) #send_form  {
                        border-radius: 0 !important;
                    }

                    /* Mobile Chat Input Overall */
                    #send_form {
                        margin-bottom: 0 !important;
                        min-height: 0 !important;
                        height: auto !important;
                        padding: 5px 15px;
                        padding-top: 8px;
                        border-radius: 15px 15px 0 0 !important;
                        transition: all 0.5s ease;

                        &:focus-within {
                            border-top: 1.25px solid var(--customThemeColor) !important;
                            box-shadow: 0 0 5px var(--customThemeColor);
                        }

                        &.compact {
                            #leftSendForm,
                            #rightSendForm {
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                flex-wrap: nowrap;
                                width: unset;
                            }
                        }
                    }

                    /* Mobile Chat Menu */
                    #nonQRFormItems {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        grid-template-rows: auto auto;
                        grid-template-areas:
                        "textarea textarea"
                        "left right";
                        gap: 0;
                        padding: 0;

                        #send_textarea {
                            grid-area: textarea;
                            box-sizing: border-box;
                            width: 100%;
                            padding: 5px 6px;
                            margin-top: 3px;
                        }
                    }

                    /* Mobile Left & Right Chat Menu */
                    #leftSendForm,
                    #rightSendForm {
                        margin: 3px 0;
                    }
                    #leftSendForm {
                        grid-area: left;
                        display: flex;
                        align-items: center;
                        justify-content: flex-start !important;
                    }
                    #rightSendForm {
                        grid-area: right;
                        display: flex;
                        align-items: center;
                        justify-content: flex-end !important;
                    }

                    #rightSendForm > div,
                    #leftSendForm > div,
                    #nonQRFormItems #options_button {
                        font-size: 16px;
                    }
                    #nonQRFormItems #options_button {
                        margin-right: 10px;
                    }
                }
            }
    `
    },
    {
    "type": "checkbox",
    "varId": "inlineMobileMeta",
    "displayText": t`Inline Character, Timestamp & Icons on Mobile`,
    "default": false,
    "category": "mobile-global-settings",
    "description": t`Show character names, timestamps, and model icons in one line on mobile`,
    "cssBlock": `
        @media (max-width: 1000px) {
            body:not(.echostyle) .name_text {
                width: unset !important;
            }
            body.whisperstyle:not(.big-avatars) #chat {
                .mes {
                    padding-top: 75px !important;
                }
            }
        }
    `
    },
    {
        "type": "checkbox",
        "varId": "increaseMobileInputSpacing",
        "displayText": t`Increase Chat Input Field Spacing on Mobile`,
        "default": false,
        "category": "mobile-global-settings",
        "description": t`Legacy extra bottom padding for chat input fields on narrow screens (width ≤ 1000px), for non-SillyBunny shells. SillyBunny's native composer already handles this spacing.`,
        "cssBlock": `
            @media screen and (max-width: 1000px) {
                body:not(:has(.sb-shell-root)):not(:has(#sb-topbar-stack)) #send_form {
                    padding-bottom: 23px;
                }
            }
        `
    },
    {
        "type": "checkbox",
        "varId": "increaseDesktopInputSpacing",
        "displayText": t`Increase Chat Input Field Spacing on Desktop & Tablet`,
        "default": false,
        "category": "mobile-global-settings",
        "description": t`Add extra bottom margin to chat input fields on larger screens (tablets and desktops)`,
        "cssBlock": `
            #form_sheld {
                margin-bottom: 5px;

                @media only screen and (min-width: 1024px) and (-webkit-min-device-pixel-ratio: 2) and (pointer: fine) {
                    margin-bottom: 22.5px;
                }
            }
        `
    },
    {
        "type": "checkbox",
        "varId": "fixTabletMenuLayout",
        "displayText": t`Fix Tablet Menu Layout`,
        "default": false,
        "category": "mobile-global-settings",
        "description": t`Optimized for tablet users to prevent menu layout issues. Note: Tablet support in SillyTavern is currently limited and may not address all issues`,
        "cssBlock": `
            .drawer-content {
                top: -3px !important;
            }
            .fillLeft,
            .fillRight {
                width: 100dvw !important;
                min-width: 100dvw !important;
            }
        `
    },

    // Mobile Detailed Settings (mobile-detailed-settings) 進階行動樣式
    {
        "type": "select",
        "varId": "mobileQRsBarHeight",
        "displayText": t`Mobile QRs Bar Height`,
        "default": "2",
        "options": [
            {
                "label": t`Compact (1 row)`,
                "value": "1"
            },
            {
                "label": t`Default (2 rows)`,
                "value": "2"
            },
            {
                "label": t`Extended (3 rows)`,
                "value": "3"
            }
        ],
        "category": "mobile-detailed-settings",
        "description": t`Sets the maximum number of visible rows in the QRs bar on mobile devices (supports scrolling)`
    },
    {
        "type": "checkbox",
        "varId": "enableMobile-horizontal_qrs",
        "displayText": t`Enable Horizontal QR Scroll on Mobile`,
        "default": false,
        "category": "mobile-detailed-settings",
        "description": t`Keep Quick Reply buttons on a single horizontal row on mobile (screen width ≤ 1000px) with horizontal scrolling, instead of wrapping into multiple lines`,
        "cssBlock": `
            @media screen and (max-width: 1000px) {
                #qr--bar {
                    justify-content: center !important;
                    max-height: unset !important;
                    overflow: hidden !important;
                }
                #qr--bar > .qr--buttons {
                    flex-wrap: nowrap !important;
                    justify-content: flex-start !important;
                    margin-inline: auto !important;
                    overflow-x: auto !important;
                    overflow-y: hidden !important;
                    width: max-content !important;
                    max-width: 100% !important;

                    *:focus {
                        outline: none;
                    }
                }
            }
        `
    },
    {
        "type": "checkbox",
        "varId": "moveQRsBelowInputMobile",
        "displayText": t`Move QRs Bar Below Input on Mobile`,
        "default": true,
        "category": "mobile-detailed-settings",
        "description": t`On mobile devices (screen width ≤ 1000px), move the QRs menu below the chat input to avoid interference from message input`,
        "cssBlock": `
            /* Mobile QR position adjustment */
            @media screen and (max-width: 1000px) {
                #send_form.compact {
                    flex-direction: column;
                }

                #file_form {
                    order: 1 !important;
                }
                #nonQRFormItems {
                    order: 2 !important;
                }
                #qr--bar {
                    order: 3 !important;
                }

                #leftSendForm {
                    padding-left: 6px;
                }
                #rightSendForm {
                    padding-right: 6px;
                }
            }
        `
    },
    {
        "type": "checkbox",
        "varId": "enableMobile-horizontal_hotswap",
        "displayText": t`Enable Horizontal HotSwap Scroll on Mobile`,
        "default": false,
        "category": "mobile-detailed-settings",
        "description": t`Allows horizontal scrolling for the quick character selection menu (#HotSwapWrapper) on mobile`,
        "cssBlock":  `
            @media screen and (max-width: 1000px) {
                body.big-avatars #HotSwapWrapper .hotswap.avatars_inline {
                    max-height: unset;
                }
                #HotSwapWrapper:hover .hotswap.avatars_inline {
                    max-height: unset;
                    overflow: unset;
                    transition: unset;
                }
                #HotSwapWrapper:not(:hover) .hotswap.avatars_inline {
                    transition: unset;
                }
                .hotswap.avatars_inline {
                    flex-wrap: nowrap !important;
                    overflow-x: auto !important;
                    overflow-y: hidden !important;
                    padding-right: 30px !important;

                    *:focus {
                        outline: none;
                    }
                }
            }
        `
    }
];
