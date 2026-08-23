import { installRegexAgentUiThemes } from '../services/ui-theme-installer.js';

const defaultTranslate = (strings, ...values) => strings.reduce((result, part, index) => {
    const value = index < values.length ? values[index] : '';
    return result + part + value;
}, '');

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export async function installBundledUiThemes(event, {
    overwriteExisting = false,
    t = defaultTranslate,
    confirmAction = globalThis.confirm,
    documentRef = globalThis.document,
    install = installRegexAgentUiThemes,
    toast = globalThis.toastr,
    log = console.error,
} = {}) {
    if (overwriteExisting && !confirmAction(t`Reinstalling or updating bundled UI themes will replace existing themes with the same names. Continue?`)) {
        return;
    }

    const button = event?.currentTarget || documentRef?.getElementById(
        overwriteExisting ? 'moonlit-reinstall-ui-themes' : 'moonlit-install-ui-themes',
    );
    const originalHtml = button?.innerHTML;
    const originalDisabled = button?.disabled ?? false;
    const originalAriaBusy = button?.getAttribute?.('aria-busy') ?? null;
    if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> <span>${escapeHtml(t`Installing bundled UI themes…`)}</span>`;
    }

    try {
        const { installed, skipped } = await install({ overwriteExisting });
        toast?.success(overwriteExisting
            ? t`Updated ${installed} bundled UI themes (${skipped} skipped). Reload SillyBunny to use them.`
            : t`Installed ${installed} UI themes (${skipped} already present). Reload SillyBunny to use them.`);
    } catch (error) {
        toast?.error(overwriteExisting
            ? t`Unable to reinstall or update the bundled UI themes`
            : t`Unable to install the bundled UI themes`);
        log(`Failed to ${overwriteExisting ? 'reinstall/update' : 'install'} bundled UI themes`, error);
    } finally {
        if (button) {
            button.disabled = originalDisabled;
            button.innerHTML = originalHtml ?? '<i class="fa-solid fa-palette" aria-hidden="true"></i>';
            if (originalAriaBusy === null) {
                button.removeAttribute('aria-busy');
            } else {
                button.setAttribute('aria-busy', originalAriaBusy);
            }
        }
    }
}
