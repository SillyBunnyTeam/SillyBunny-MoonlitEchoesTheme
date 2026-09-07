import { t } from '../../../../../i18n.js';

export const chatThemeSettings = [
    // - - - - - - - - - - - - - - - - - - -
    // Chat Interface Tab 聊天樣式分頁
    // - - - - - - - - - - - - - - - - - - -

    // General Chat Settings (chat-general) 一般聊天設定
    {
        "type": "select",
        "varId": "customCSS-ChatGradientBlur",
        "displayText": t`Chat Field Gradient Blur`,
        "default": "linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 2%, rgba(0, 0, 0, 1) 98%, rgba(0, 0, 0, 0) 100%)",
        "options": [
            {
                "label": t`Enable`,
                "value": "linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 2%, rgba(0, 0, 0, 1) 98%, rgba(0, 0, 0, 0) 100%)"
            },
            {
                "label": t`Disabled`,
                "value": "none"
            }
        ],
        "category": "chat-general",
        "description": t`Applies a transparent gradient effect to the top and bottom of the chat field (#chat)`
    },
    {
    "type": "checkbox",
    "varId": "showLLMReasoningIcon",
    "displayText": t`Display LLM Icon in Reasoning Block`,
    "default": false,
    "category": "chat-general",
    "description": t`Shows the LLM icon in the reasoning block header for clearer identification`,
    "cssBlock": `
            .mes_reasoning_header > .icon-svg {
                display: block;
                opacity: 1 !important;
            }
        `
    },
    {
        "type": "checkbox",
        "varId": "justifyParagraphText",
        "displayText": t`Justify Paragraph Text`,
        "default": false,
        "category": "chat-general",
        "description": t`Aligns paragraph text for Chinese, Japanese, and Korean for better readability; not suitable for English layout`,
        "cssBlock": `
            .mes_text p {
                text-align: justify;
                text-justify: inter-ideograph;
                }
        `
    },
    {
        "type": "checkbox",
        "varId": "enableMessageDetails",
        "displayText": t`Hide Additional Message Details`,
        "default": false,
        "category": "chat-general",
        "description": t`Show message details on hover, click or keyboard focus`,
        "cssBlock": `
            /* The header contains native actions, so keep it keyboard-focusable while faded. */
            .mes .ch_name,
            .mes .mesIDDisplay,
            .mes .mes_timer,
            .mes .tokenCounterDisplay {
                opacity: 0 !important;
                transition: all var(--messageDetailsAnimationDuration) cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10 !important;
                pointer-events: auto !important;
            }

            .mes:is(:hover, :focus-within, .active-message) .ch_name,
            .mes:is(:hover, :focus-within, .active-message) .mesIDDisplay,
            .mes:is(:hover, :focus-within, .active-message) .mes_timer,
            .mes:is(:hover, :focus-within, .active-message) .tokenCounterDisplay {
                opacity: 1 !important;
            }

            .mes .mes_reasoning_details {
                opacity: 0;
                max-height: 1px;
                transform: translateY(-10px);
                pointer-events: none;
                transition:
                    opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                    transform 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                    max-height 0.3s cubic-bezier(0, 0, 0.2, 1);
                will-change: opacity, transform;
            }
            .mes:is(:hover, :focus-within, .active-message) .mes_reasoning_details {
                opacity: 1;
                transform: translateY(0);
                max-height: 100%;
                pointer-events: auto;
            }

            body.flatchat,
            body.bubblechat,
            body.ripplestyle {
                .mes .ch_name,
                .mes .mesIDDisplay,
                .mes .mes_timer,
                .mes .tokenCounterDisplay {
                    margin-top: -40px;
                    background: none;
                }

                .mes:is(:hover, :focus-within, .active-message) .ch_name,
                .mes:is(:hover, :focus-within, .active-message) .mesIDDisplay,
                .mes:is(:hover, :focus-within, .active-message) .mes_timer,
                .mes:is(:hover, :focus-within, .active-message) .tokenCounterDisplay {
                    margin-top: unset;
                    background: unset;
                }
            }

            body.flatchat,
            body.bubblechat,
            body.documentstyle,
            body.ripplestyle {
                .mes .ch_name,
                .mes .mesIDDisplay,
                .mes .mes_timer,
                .mes .tokenCounterDisplay {
                    transform: translateY(-40px);
                }

                .mes:is(:hover, :focus-within, .active-message) .ch_name,
                .mes:is(:hover, :focus-within, .active-message) .mesIDDisplay,
                .mes:is(:hover, :focus-within, .active-message) .mes_timer,
                .mes:is(:hover, :focus-within, .active-message) .tokenCounterDisplay {
                    transform: translateY(0);
                }
            }
        `
    },
    {
        "type": "text",
        "varId": "messageDetailsAnimationDuration",
        "displayText": t`Message Details Animation Duration`,
        "default": "0.8s",
        "category": "chat-general",
        "description": t`Controls the animation speed for message details appearing/disappearing (e.g. 0.5s, 1.2s)`
    },
    {
    "type": "text",
    "varId": "favoriteSymbol",
    "displayText": t`Favorite Symbol`,
    "default": "\"♥︎\"",
    "category": "chat-general",
    "description": t`Sets the symbol displayed before a favorite character in the character management menu`
    },
    {
    "type": "checkbox",
    "varId": "favoriteSymbolAnimation",
    "displayText": t`Favorite Symbol Animation`,
    "default": true,
    "category": "chat-general",
    "description": t`Enables the pulsing animation effect for the favorite symbol before character names`,
    "cssBlock": `
        .character_select.is_fav .ch_name::before,
        .group_select.is_fav .ch_name::before,
        .group_member.is_fav .ch_name::before {
            animation: fadePulse 1s ease-in-out infinite;
        }
        @keyframes fadePulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
        }
    `
    },

    // Visual Novel Mode (visual-novel) 視覺小說模式
    {
        "type": "text",
        "varId": "VN-sheld-height",
        "displayText": t`Visual Novel Mode Chat Field Height`,
        "default": "40dvh",
        "category": "visual-novel",
        "description": t`Maximum height of the chat field (#sheld) in Visual Novel mode`
    },
    {
        "type": "select",
        "varId": "VN-expression-holder",
        "displayText": t`Visual Novel Mode Character Portrait Gradient Transparency`,
        "default": "linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 90%, rgba(0, 0, 0, 0) 100%)",
        "options": [
            {
                "label": t`Enabled`,
                "value": "linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 90%, rgba(0, 0, 0, 0) 100%)"
            },
            {
                "label": t`Disabled`,
                "value": "none"
            }
        ],
        "category": "visual-novel",
        "description": t`Bottom transparency effect for character portraits in Visual Novel mode`
    },

    // Echo Style Settings (chat-echo)
    {
        "type": "text",
        "varId": "custom-EchoAvatarWidth",
        "displayText": t`[Echo] Message Background Avatar Width`,
        "default": "25%",
        "category": "chat-echo",
        "description": t`Width of character avatars in the message background for the Echo style`
    },
    {
        "type": "text",
        "varId": "custom-EchoAvatarHeight",
        "displayText": t`[Echo] Message Background Avatar Height`,
        "default": "300px",
        "category": "chat-echo",
        "description": t`Height of character avatars in the message background for the Echo style`
    },
    {
        "type": "text",
        "varId": "custom-EchoAvatarMobileWidth",
        "displayText": t`[Echo] Mobile Message Background Avatar Width`,
        "default": "25%",
        "category": "chat-echo",
        "description": t`Width of character avatars in the message background for the Echo style on mobile devices`
    },
    {
        "type": "text",
        "varId": "custom-EchoAvatarMobileHeight",
        "displayText": t`[Echo] Mobile Message Background Avatar Height`,
        "default": "250px",
        "category": "chat-echo",
        "description": t`Height of character avatars in the message background for the Echo style on mobile devices`
    },
    {
        "type": "checkbox",
        "varId": "hideEchoUserIllustration",
        "displayText": t`[Echo] Hide User Message Illustration`,
        "default": false,
        "category": "chat-echo",
        "description": t`Hide user message illustrations in Echo style`,
        "cssBlock": `
            body.echostyle #chat {
                .mes[is_user="true"] {
                    .name_text {
                            display: inline-block !important;
                            margin-right: 5px;
                        }
                    .mes_text,
                        .last_mes .mes_text {
                            padding: 10px 20px !important;
                            min-height: unset !important;
                        }
                    .mes_text::before {
                        display: none !important;
                    }
                }
            }
        `
    },
    {
        "type": "checkbox",
        "varId": "hideMobileEchoBackground",
        "displayText": t`[Echo] Hide Message Background on Mobile`,
        "default": false,
        "category": "chat-echo",
        "description": t`Hide message background illustrations on mobile for the Echo style`,
        "cssBlock": `
            body.echostyle #chat {
                @media screen and (max-width: 1000px) {
                    .mes[is_user="true"],
                    .mes[is_user="false"] {
                        .mes_text,
                        .last_mes .mes_text {
                            padding: 10px 20px !important;
                            min-height: unset !important;
                        }
                    }
                    .mes_text::before {
                        display: none !important;
                    }
                }

                .ch_name {
                    .name_text {
                        display: inline-block !important;
                        margin-right: 5px;
                    }
                }
            }
        `
    },

    // Whisper Style Settings (chat-whisper) 低語聊天風格
    {
        "type": "text",
        "varId": "customWhisperAvatarWidth",
        "displayText": t`[Whisper] Message Background Avatar Width`,
        "default": "50%",
        "category": "chat-whisper",
        "description": t`Width of character avatars in the message background for the Whisper style`
    },
    {
        "type": "select",
        "varId": "customWhisperAvatarAlign",
        "displayText": t`[Whisper] Avatar Alignment`,
        "default": "center",
        "options": [
            {
                "label": t`Top Aligned`,
                "value": "top"
            },
            {
                "label": t`Center Aligned`,
                "value": "center"
            },
            {
                "label": t`Bottom Aligned`,
                "value": "bottom"
            }
        ],
        "category": "chat-whisper",
        "description": t`Vertical alignment of character avatars in the message background for the Whisper style`
    },

    // Ripple Style Settings (chat-ripple) 漣漪聊天風格
    {
        "type": "text",
        "varId": "customRippleAvatarWidth",
        "displayText": t`[Ripple] Message Avatar Width`,
        "default": "180px",
        "category": "chat-ripple",
        "description": t`Width of character avatars in the message for the Ripple style`
    },
    {
        "type": "text",
        "varId": "customRippleAvatarMobileWidth",
        "displayText": t`[Ripple] Mobile Message Avatar Width`,
        "default": "100px",
        "category": "chat-ripple",
        "description": t`Width of character avatars in the message for the mobile Ripple style`
    },
    {
        "type": "checkbox",
        "varId": "hideRippleUserAvatar",
        "displayText": t`[Ripple] Hide User Avatar`,
        "default": false,
        "category": "chat-ripple",
        "description": t`Hide user avatars in the message for the Ripple style`,
        "cssBlock": `
            body.ripplestyle #chat .mes[is_user="true"] {
                .mesAvatarWrapper {
                    margin-top: 35px;
                    top: 35px;
                }
                .avatar {
                    display: none !important;
                }
                .mes_timer,
                .mesIDDisplay,
                .tokenCounterDisplay {
                    margin-left: 10px;
                }
            }
        `
    }
];
