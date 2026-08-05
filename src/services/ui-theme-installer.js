import { REGEX_AGENT_UI_THEMES } from '../config/regex-agent-presets.generated.js';

/**
 * Save the bundled Regex Agent UI themes into the host theme library.
 * Existing themes with the same name are left untouched.
 * @returns {Promise<{installed: number, skipped: number}>}
 */
export async function installRegexAgentUiThemes() {
    const context = SillyTavern.getContext();
    const existing = new Set(Array.from(document.getElementById('themes')?.options ?? [], option => option.value));
    let installed = 0;

    for (const theme of REGEX_AGENT_UI_THEMES) {
        if (existing.has(theme.name)) continue;

        const response = await fetch('/api/themes/save', {
            method: 'POST',
            headers: context.getRequestHeaders(),
            body: JSON.stringify(theme),
        });

        if (!response.ok) {
            throw new Error(`Failed to save UI theme "${theme.name}"`);
        }

        installed += 1;
    }

    return { installed, skipped: REGEX_AGENT_UI_THEMES.length - installed };
}
