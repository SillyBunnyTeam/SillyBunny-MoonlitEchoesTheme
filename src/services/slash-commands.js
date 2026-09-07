import { t } from '../../../../../i18n.js';
import { getSettings as getExtensionSettings } from './settings-service.js';
import { setChatStyle } from './chat-styles.js';

let slashCommandsRegistered = false;

/**
 * Initialize slash commands - only when theme is enabled.
 * Register various chat style slash commands for Moonlit Echoes Theme.
 */
export function initializeSlashCommands() {
    if (slashCommandsRegistered) {
        return;
    }

    const context = SillyTavern.getContext();
    const settings = getExtensionSettings(context);

    if (!settings?.enabled) {
        return;
    }

    const { SlashCommandParser, SlashCommand } = context;

    function switchChatStyle(styleValue) {
        try {
            const currentSettings = getExtensionSettings(SillyTavern.getContext());
            if (!currentSettings?.enabled) {
                return t`Moonlit Echoes Theme is disabled`;
            }

            const result = setChatStyle(styleValue);
            return t`Chat style switched to ${result.label}`;
        } catch (error) {
            return t`Error switching chat style: ${error.message}`;
        }
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'moonlit-bubble',
        description: t`Switch to Bubble chat style`,
        callback: () => switchChatStyle('1'),
        helpString: t`Switch to Bubble chat style by Moonlit Echoes Theme`,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'moonlit-flat',
        description: t`Switch to Flat chat style`,
        callback: () => switchChatStyle('0'),
        helpString: t`Switch to Flat chat style by Moonlit Echoes Theme`,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'moonlit-document',
        description: t`Switch to Document chat style`,
        callback: () => switchChatStyle('2'),
        helpString: t`Switch to Document chat style by Moonlit Echoes Theme`,
    }));

    slashCommandsRegistered = true;
}
