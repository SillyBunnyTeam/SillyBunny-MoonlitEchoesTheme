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
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error('Failed to list existing backgrounds');
    }

    const data = await response.json();
    if (!Array.isArray(data?.images)) throw new Error('Invalid background inventory');
    const filenames = data.images.map(image => typeof image === 'string' ? image : image?.filename);
    if (filenames.some(filename => typeof filename !== 'string' || !filename.trim()
        || filename === '.' || filename === '..' || /[\\/\x00-\x1f\x7f]/.test(filename))) {
        throw new Error('Invalid background inventory filename');
    }
    return new Set(filenames);
}

async function uploadBackgroundAsset(asset) {
    const assetUrl = new URL(`../../backgrounds/${asset.path}`, import.meta.url);
    const response = await fetch(assetUrl);
    if (!response.ok) {
        throw new Error(`Failed to read bundled background "${asset.filename}"`);
    }

    const blob = await response.blob();
    const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)) {
        throw new Error(`Invalid PNG background "${asset.filename}"`);
    }
    if (typeof globalThis.createImageBitmap !== 'function') {
        throw new Error('Installing backgrounds safely requires a browser with createImageBitmap support');
    }
    try {
        const image = await globalThis.createImageBitmap(blob);
        image.close();
    } catch (error) {
        throw new Error(`Unable to decode PNG background "${asset.filename}"`, { cause: error });
    }
    const formData = new FormData();
    formData.append('avatar', new File([blob], asset.filename, { type: 'image/png' }));

    const uploadResponse = await fetch('/api/backgrounds/upload-new', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        body: formData,
        cache: 'no-cache',
    });

    if (uploadResponse.status === 409) return false;
    if (uploadResponse.status === 404) {
        const error = new Error('Installing backgrounds safely requires an updated SillyBunny host with /api/backgrounds/upload-new');
        console.error(error.message);
        throw error;
    }
    if (!uploadResponse.ok || uploadResponse.status !== 201) {
        throw new Error(`Failed to upload background "${asset.filename}"`);
    }
    if (await uploadResponse.text() !== asset.filename) {
        throw new Error(`Unexpected uploaded background filename for "${asset.filename}"`);
    }
    return true;
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

        if (await uploadBackgroundAsset(asset)) installed += 1;
        else skipped += 1;
        existing.add(asset.filename);
    }

    return { installed, skipped };
}

async function getBackgroundState() {
    const [backgrounds, host] = await Promise.all([
        import('../../../../../backgrounds.js'),
        import('../../../../../../script.js'),
    ]);

    return { backgrounds, host };
}

let backgroundApplyVersion = 0;

export async function applyPresetBackground(name) {
    const version = ++backgroundApplyVersion;
    const filename = getPresetBackgroundFilename(name);
    if (!filename) return false;

    const isCurrent = () => {
        const settings = getContext().extensionSettings?.[settingsKey];
        return version === backgroundApplyVersion && settings?.enabled === true
            && settings.syncBackgroundWithPreset === true && settings.activePreset === name;
    };
    if (!isCurrent()) return false;

    // The host context has no background state. User input during lazy imports
    // cancels this call rather than mistaking a newer manual choice for our baseline.
    let interrupted = false;
    const interrupt = () => { interrupted = true; };
    const events = ['pointerdown', 'keydown', 'click', 'input', 'change'];
    const initialBackground = document.querySelector('#bg1');
    const initialImage = initialBackground?.style.getPropertyValue('background-image');
    let state;
    for (const event of events) document.addEventListener(event, interrupt, { capture: true });
    try {
        state = await getBackgroundState();
    } finally {
        for (const event of events) document.removeEventListener(event, interrupt, { capture: true });
    }
    if (interrupted || !isCurrent() || initialBackground !== document.querySelector('#bg1')
        || initialImage !== initialBackground?.style.getPropertyValue('background-image')) return false;

    const { backgrounds, host } = state;
    const background = backgrounds.background_settings;
    const previousName = background.name;
    const previousUrl = background.url;

    const existing = await getExistingBackgrounds();
    if (!existing.has(filename) || !isCurrent() || backgrounds.background_settings !== background
        || background.name !== previousName || background.url !== previousUrl) return false;

    const url = `url("${backgrounds.getBackgroundPath(filename)}")`;

    background.name = filename;
    background.url = url;
    if (!host.chat_metadata?.custom_background) {
        document.querySelector('#bg1')?.style.setProperty('background-image', url);
    }
    host.saveSettingsDebounced();
    return true;
}
