import { REGEX_AGENT_UI_THEMES } from '../config/regex-agent-presets.generated.js';

/**
 * Save the bundled Regex Agent UI themes into the host theme library.
 * Existing themes with the same name are left untouched unless overwrite is requested.
 * @param {{overwriteExisting?: boolean}} [options]
 * @returns {Promise<{installed: number, skipped: number}>}
 */
export async function installRegexAgentUiThemes({ overwriteExisting = false } = {}) {
    const context = SillyTavern.getContext();
    const existing = new Set();
    if (overwriteExisting !== true) {
        const response = await fetch('/api/settings/get', {
            method: 'POST',
            headers: context.getRequestHeaders(),
            body: JSON.stringify({}),
            cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to list existing UI themes');
        const data = await response.json();
        if (!Array.isArray(data?.themes) || data.themes.some(theme => (
            !theme || typeof theme.name !== 'string' || !theme.name.trim()
        ))) {
            throw new Error('Invalid UI theme inventory');
        }
        for (const theme of data.themes) existing.add(theme.name);
    }
    let installed = 0;

    for (const theme of REGEX_AGENT_UI_THEMES) {
        if (overwriteExisting !== true && existing.has(theme.name)) continue;

        const response = await fetch(overwriteExisting === true ? '/api/themes/save' : '/api/themes/create', {
            method: 'POST',
            headers: context.getRequestHeaders(),
            body: JSON.stringify(theme),
        });

        if (overwriteExisting !== true && response.status === 409) continue;
        if (overwriteExisting !== true && response.status === 404) {
            throw new Error('Installing UI themes safely requires an updated SillyBunny host with /api/themes/create');
        }
        if (!response.ok || (overwriteExisting !== true && response.status !== 201)) {
            throw new Error(`Failed to save UI theme "${theme.name}"`);
        }

        installed += 1;
    }

    return { installed, skipped: REGEX_AGENT_UI_THEMES.length - installed };
}
