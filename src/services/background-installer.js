import { REGEX_AGENT_PRESETS } from '../config/regex-agent-presets.generated.js';
import { settingsKey } from './settings-service.js';

const GENERAL_BACKGROUND_FILES = [
    'platberlitz-dark-aurora.png',
    'platberlitz-light-garden.png',
];

function getPresetSlug(name) {
    return name
        .replace(/^\[Moonlit\]\s*/, '')
        .replace(/\s+-\s+by\s+.+$/, '')
        .normalize('NFKD')
        .replace(/&/g, 'and')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}

function getContext() {
    const context = globalThis.SillyTavern?.getContext?.();
    if (!context) {
        throw new Error('SillyBunny context is unavailable');
    }
    return context;
}

function getRequestHeaders(options = {}) {
    return getContext().getRequestHeaders?.(options) || {};
}

function createPresetBackgroundAssets() {
    return REGEX_AGENT_PRESETS.flatMap(({ name }) => {
        const slug = getPresetSlug(name);
        return ['scene', 'texture'].map((kind) => {
            const filename = `${slug}-${kind}.png`;
            return {
                filename,
                path: `platberlitz-presets/${filename}`,
                presetName: name,
                kind,
            };
        });
    });
}

export const BUNDLED_BACKGROUND_ASSETS = Object.freeze([
    ...GENERAL_BACKGROUND_FILES.map((filename) => ({ filename, path: filename })),
    ...createPresetBackgroundAssets(),
].map((asset) => Object.freeze(asset)));

const PRESET_BACKGROUND_FILENAMES = new Map(
    REGEX_AGENT_PRESETS.map(({ name }) => [name, `${getPresetSlug(name)}-scene.png`]),
);

export function getPresetBackgroundFilename(name) {
    if (typeof name !== 'string') return null;

    const catalogName = name.replace(/^\[Moonlit\]\s*/, '').trim();
    return PRESET_BACKGROUND_FILENAMES.get(catalogName) || null;
}

async function getExistingBackgrounds() {
    const response = await fetch('/api/backgrounds/all', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (!response.ok) {
        throw new Error('Failed to list existing backgrounds');
    }

    const data = await response.json();
    return new Set((data.images || [])
        .map((image) => typeof image === 'string' ? image : image?.filename)
        .filter(Boolean));
}

async function uploadBackgroundAsset(asset) {
    const assetUrl = new URL(`../../backgrounds/${asset.path}`, import.meta.url);
    const response = await fetch(assetUrl);
    if (!response.ok) {
        throw new Error(`Failed to read bundled background "${asset.filename}"`);
    }

    const blob = await response.blob();
    const formData = new FormData();
    formData.append('avatar', new File([blob], asset.filename, { type: blob.type || 'image/png' }));

    const uploadResponse = await fetch('/api/backgrounds/upload', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        body: formData,
        cache: 'no-cache',
    });

    if (!uploadResponse.ok) {
        throw new Error(`Failed to upload background "${asset.filename}"`);
    }
}

export async function installBundledBackgrounds() {
    const existing = await getExistingBackgrounds();
    let installed = 0;
    let skipped = 0;

    for (const asset of BUNDLED_BACKGROUND_ASSETS) {
        if (existing.has(asset.filename)) {
            skipped += 1;
            continue;
        }

        await uploadBackgroundAsset(asset);
        existing.add(asset.filename);
        installed += 1;
    }

    return { installed, skipped };
}

async function getBackgroundState() {
    const [{ background_settings, getBackgroundPath }, { chat_metadata, saveSettingsDebounced }] = await Promise.all([
        import('../../../../../backgrounds.js'),
        import('../../../../../../script.js'),
    ]);

    return { background_settings, getBackgroundPath, chat_metadata, saveSettingsDebounced };
}

export async function applyPresetBackground(name) {
    const filename = getPresetBackgroundFilename(name);
    if (!filename) return false;

    const context = getContext();
    const settings = context.extensionSettings?.[settingsKey];
    if (settings?.syncBackgroundWithPreset !== true || settings.activePreset !== name) return false;

    const existing = await getExistingBackgrounds();
    if (!existing.has(filename)) return false;

    const currentSettings = getContext().extensionSettings?.[settingsKey];
    if (currentSettings?.syncBackgroundWithPreset !== true || currentSettings.activePreset !== name) return false;

    const { background_settings, getBackgroundPath, chat_metadata, saveSettingsDebounced } = await getBackgroundState();
    const latestSettings = getContext().extensionSettings?.[settingsKey];
    if (latestSettings?.syncBackgroundWithPreset !== true || latestSettings.activePreset !== name) return false;

    const url = `url("${getBackgroundPath(filename)}")`;

    background_settings.name = filename;
    background_settings.url = url;
    if (!chat_metadata?.custom_background) {
        document.querySelector('#bg1')?.style.setProperty('background-image', url);
    }
    saveSettingsDebounced();
    return true;
}
