import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUTHOR = 'platberlitz';
const CATALOG_VERSION = 2;
const EXPECTED_MODES = { light: 37, dark: 38, adaptive: 3 };
const SETTINGS_FILES = [
    'src/config/theme-settings-core.js',
    'src/config/theme-settings-chat.js',
    'src/config/theme-settings-mobile.js',
];
const MOONLIT_COLOR_KEYS = [
    'customThemeColor',
    'customThemeColor2',
    'customBgColor1',
    'customBgColor2',
    'customTopBarColor',
    'Drawer-iconColor',
    'sheldBackgroundColor',
    'customScrollbarColor',
];
const MOONLIT_KEYS = [...MOONLIT_COLOR_KEYS, 'customlastInContext', 'rawCustomCss'];
const UI_COLOR_KEYS = [
    'main_text_color',
    'italics_text_color',
    'underline_text_color',
    'quote_text_color',
    'blur_tint_color',
    'chat_tint_color',
    'user_mes_blur_tint_color',
    'bot_mes_blur_tint_color',
    'shadow_color',
    'border_color',
    'sheldBackgroundColor',
];
const UI_KEYS = [
    'name',
    ...UI_COLOR_KEYS.slice(0, 10),
    'customCSS-bg-blur',
    'customCSS-bg-opacity',
    'sheldBlurStrength',
    'sheldBackgroundColor',
    'custom_css',
];
const ADAPTIVE_HOST_VARIABLES = new Set([
    '--SmartThemeBodyColor',
    '--SmartThemeBlurTintColor',
    '--SmartThemeQuoteColor',
    '--SmartThemeEmColor',
]);

const options = parseArguments(process.argv.slice(2));
const sourceRoot = resolve(options.source ?? join(ROOT, '..', 'SillyBunny-Regex-Agent-Themes'));
const sourceUrl = relativePath => pathToFileURL(join(sourceRoot, relativePath)).href;

const [themeModule, tokenModule, colorModule, sourcePackage, targetManifest, targetInfo] = await Promise.all([
    import(sourceUrl('src/themes/index.js')),
    import(sourceUrl('src/tokens.js')),
    import(sourceUrl('src/color.js')),
    readJson(join(sourceRoot, 'package.json')),
    readJson(join(ROOT, 'manifest.json')),
    readFile(join(ROOT, 'src/config/theme-info.js'), 'utf8'),
]);

const { THEMES } = themeModule;
const { resolveTheme } = tokenModule;
const { composite, contrastRatio, mixColors, parseColor, readableColor } = colorModule;
const infoVersion = /THEME_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(targetInfo)?.[1];
assert.equal(infoVersion, targetManifest.version, 'manifest and theme-info versions differ');

const knownSettingIds = await readTargetSettingIds();
const records = THEMES.map(buildRecord);
validateRecords(records, knownSettingIds);

const outputs = buildOutputs(records, targetManifest.version, sourcePackage.version);
if (options.check) {
    await checkOutputs(outputs);
    console.log(`Checked ${records.length} Moonlit presets and ${records.filter(({ uiTheme }) => uiTheme).length} UI themes.`);
} else {
    await writeOutputs(outputs);
    console.log(`Generated ${records.length} Moonlit presets and ${records.filter(({ uiTheme }) => uiTheme).length} UI themes.`);
}

function parseArguments(args) {
    const parsed = { check: false, source: null };
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--check') {
            parsed.check = true;
        } else if (argument.startsWith('--source=')) {
            parsed.source = argument.slice('--source='.length);
        } else if (argument === '--source' && args[index + 1]) {
            parsed.source = args[index += 1];
        } else {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    return parsed;
}

async function readJson(path) {
    return JSON.parse(await readFile(path, 'utf8'));
}

async function readTargetSettingIds() {
    const ids = [];
    for (const file of SETTINGS_FILES) {
        const source = await readFile(join(ROOT, file), 'utf8');
        ids.push(...[...source.matchAll(/"varId"\s*:\s*"([^"]+)"/g)].map(match => match[1]));
    }
    assert.equal(ids.length, 60, 'expected 60 target settings');
    assert.equal(new Set(ids).size, ids.length, 'target setting IDs must be unique');
    return new Set(ids);
}

function buildRecord(theme) {
    const tokens = resolveTheme(theme, {
        density: 'normal',
        adaptiveNeutrals: false,
        glyphs: 'theme',
    });
    const name = `${theme.name} - by ${AUTHOR}`;
    assert.equal(theme.name, theme.name.trim(), `${theme.slug}: padded name`);
    assert.match(name, /^[^<>:"/\\|?*\u0000-\u001f]+$/, `${theme.slug}: unsafe filename`);

    if (tokens.mode !== 'adaptive') return fixedRecord(theme, tokens, name);

    const { settings, migrateFromV1 } = adaptiveSettings(tokens);
    return { slug: theme.slug, family: theme.family, mode: theme.mode, name, settings, migrateFromV1, uiTheme: null };
}

function fixedRecord(theme, tokens, name) {
    const surfaces = effectiveSurfaces(tokens, theme.slug);
    const readableBackgrounds = [surfaces.body, surfaces.row, surfaces.rowAlt];
    const primary = rgba(readableColor(tokens.accents[0], readableBackgrounds, 4.5), `${theme.slug}: primary`);
    const secondary = rgba(readableColor(tokens.accents[1], readableBackgrounds, 4.5), `${theme.slug}: secondary`);
    const settings = {
        customThemeColor: primary,
        customThemeColor2: secondary,
        customBgColor1: rgba(surfaces.rowAlt, `${theme.slug}: alternate row`, 0.1),
        customBgColor2: rgba(surfaces.row, `${theme.slug}: row`, 0.05),
        customTopBarColor: rgba(surfaces.head, `${theme.slug}: header`, 0.7),
        'Drawer-iconColor': rgba(tokens.on.head, `${theme.slug}: head ink`),
        sheldBackgroundColor: rgba(surfaces.body, `${theme.slug}: shell`, 0.2),
        customScrollbarColor: rgba(tokens.line.head, `${theme.slug}: scrollbar`),
        customlastInContext: contextMarker(tokens, primary),
        rawCustomCss: '',
    };
    const migrateFromV1 = {
        customBgColor1: rgba(surfaces.rowAlt),
        customBgColor2: rgba(surfaces.row),
        customTopBarColor: rgba(surfaces.head),
        sheldBackgroundColor: rgba(surfaces.body),
    };
    const uiTheme = {
        name,
        main_text_color: rgba(tokens.on.body, `${theme.slug}: body ink`),
        italics_text_color: rgba(tokens.on.muted, `${theme.slug}: muted ink`),
        underline_text_color: secondary,
        quote_text_color: primary,
        blur_tint_color: rgba(surfaces.bodyFrom, `${theme.slug}: blur tint`, 0.65),
        chat_tint_color: rgba(surfaces.bodyTo, `${theme.slug}: chat tint`, 0),
        user_mes_blur_tint_color: rgba(surfaces.rowAlt, `${theme.slug}: user tint`, 0.5),
        bot_mes_blur_tint_color: rgba(surfaces.row, `${theme.slug}: bot tint`, 0.65),
        shadow_color: rgba(lastShadowColor(tokens.shadow.head), `${theme.slug}: shadow`),
        border_color: rgba(tokens.line.body, `${theme.slug}: border`),
        'customCSS-bg-blur': 3,
        'customCSS-bg-opacity': 1,
        sheldBlurStrength: 5,
        sheldBackgroundColor: rgba(surfaces.body, `${theme.slug}: UI shell`, 0),
        custom_css: '',
    };
    return { slug: theme.slug, family: theme.family, mode: theme.mode, name, settings, migrateFromV1, uiTheme, surfaces };
}

function effectiveSurfaces(tokens, slug) {
    const canvas = requiredColor(tokens.a11y.canvas, `${slug}: canvas`);
    const scrim = tokens.a11y.scrim ? requiredColor(tokens.a11y.scrim, `${slug}: scrim`) : null;
    const paint = (value, beneath, role) => {
        const painted = composite(requiredColor(value, `${slug}: ${role}`), beneath);
        return scrim ? composite(scrim, painted) : painted;
    };
    const headFrom = paint(tokens.surface.headFrom, canvas, 'headFrom');
    const headTo = paint(tokens.surface.headTo, canvas, 'headTo');
    const bodyFrom = paint(tokens.surface.bodyFrom, canvas, 'bodyFrom');
    const bodyTo = paint(tokens.surface.bodyTo, canvas, 'bodyTo');
    const body = mixColors(bodyFrom, bodyTo, 0.5);
    return {
        headFrom,
        headTo,
        head: mixColors(headFrom, headTo, 0.5),
        bodyFrom,
        bodyTo,
        body,
        row: paint(tokens.surface.row, body, 'row'),
        rowAlt: paint(tokens.surface.rowAlt, body, 'rowAlt'),
    };
}

function adaptiveSettings(tokens) {
    const primary = tokens.accents[0];
    const rowAlt = tokens.surface.rowAlt;
    const row = tokens.surface.row;
    const head = midpointExpression(tokens.surface.headFrom, tokens.surface.headTo);
    const body = midpointExpression(tokens.surface.bodyFrom, tokens.surface.bodyTo);
    return {
        settings: {
            customThemeColor: primary,
            customThemeColor2: tokens.accents[1],
            customBgColor1: rowAlt,
            customBgColor2: row,
            customTopBarColor: opacityExpression(head, 70),
            'Drawer-iconColor': tokens.ink.head,
            sheldBackgroundColor: opacityExpression(body, 20),
            customScrollbarColor: tokens.line.head,
            customlastInContext: contextMarker(tokens, primary),
            rawCustomCss: '',
        },
        migrateFromV1: {
            customBgColor1: rowAlt,
            customBgColor2: row,
            customTopBarColor: head,
            sheldBackgroundColor: body,
        },
    };
}

function midpointExpression(first, second) {
    return first === second ? first : `color-mix(in srgb, ${first} 50%, ${second})`;
}

function opacityExpression(value, percentage) {
    return `color-mix(in srgb, ${value} ${percentage}%, transparent)`;
}

function contextMarker(tokens, color) {
    const edge = String(tokens.line.edge).trim();
    return edge === 'none' || Number.parseFloat(edge) === 0 || tokens.line.edgeSide === 'none'
        ? 'none'
        : `${edge} ${tokens.line.style} ${color}`;
}

function lastShadowColor(value) {
    if (!value || value === 'none') return 'transparent';
    const candidates = String(value).match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|oklch\([^)]*\)|\btransparent\b/gi) ?? [];
    return candidates.reverse().find(candidate => parseColor(candidate)) ?? 'transparent';
}

function requiredColor(value, label) {
    const color = typeof value === 'string' ? parseColor(value) : value;
    assert(color, `${label}: invalid color ${value}`);
    return color;
}

function rgba(value, label = 'color', alphaOverride) {
    const color = requiredColor(value, label);
    const channels = ['r', 'g', 'b'].map(key => Math.round(Math.max(0, Math.min(255, color[key]))));
    const alpha = Math.round(Math.max(0, Math.min(1, alphaOverride ?? color.a)) * 1000) / 1000;
    return `rgba(${channels.join(', ')}, ${alpha})`;
}

function validateRecords(records, knownSettingIds) {
    assert.equal(records.length, 78, 'expected 78 source themes');
    const modes = Object.fromEntries(Object.keys(EXPECTED_MODES).map(mode => [mode, records.filter(record => record.mode === mode).length]));
    assert.deepEqual(modes, EXPECTED_MODES, 'unexpected light/dark/adaptive split');
    assert.equal(new Set(records.map(({ slug }) => slug)).size, records.length, 'theme slugs must be unique');
    assert.equal(new Set(records.map(({ name }) => name)).size, records.length, 'preset names must be unique');
    assert(MOONLIT_KEYS.every(key => knownSettingIds.has(key)), 'generated catalog uses an unknown Moonlit setting');

    const fixed = records.filter(({ mode }) => mode !== 'adaptive');
    const adaptive = records.filter(({ mode }) => mode === 'adaptive');
    assert.equal(fixed.length, 75, 'expected 75 fixed themes');
    assert.equal(adaptive.length, 3, 'expected 3 adaptive themes');
    assert(fixed.every(({ uiTheme }) => uiTheme), 'fixed themes require UI companions');
    assert(adaptive.every(({ uiTheme }) => !uiTheme), 'adaptive themes must not have UI companions');

    for (const record of records) {
        assert.deepEqual(Object.keys(record.settings), MOONLIT_KEYS, `${record.slug}: unexpected Moonlit schema`);
        assert.deepEqual(Object.keys(record.migrateFromV1), ['customBgColor1', 'customBgColor2', 'customTopBarColor', 'sheldBackgroundColor'], `${record.slug}: unexpected v1 migration schema`);
        assert.equal(record.settings.rawCustomCss, '', `${record.slug}: rawCustomCss must be empty`);
        if (record.mode === 'adaptive') {
            for (const [key, value] of Object.entries(record.settings)) {
                if (key !== 'rawCustomCss' && value !== 'none') validateAdaptiveValue(value, `${record.slug}: ${key}`);
            }
            continue;
        }

        for (const key of MOONLIT_COLOR_KEYS) assertRgba(record.settings[key], `${record.slug}: ${key}`);
        assert.deepEqual(Object.keys(record.uiTheme), UI_KEYS, `${record.slug}: unexpected UI theme schema`);
        assert.equal(record.uiTheme.custom_css, '', `${record.slug}: custom_css must be empty`);
        for (const key of UI_COLOR_KEYS) assertRgba(record.uiTheme[key], `${record.slug}: ${key}`);

        const surfaces = [record.surfaces.body, record.surfaces.row, record.surfaces.rowAlt];
        assertContrast(record.settings.customThemeColor, surfaces, `${record.slug}: primary`);
        assertContrast(record.settings.customThemeColor2, surfaces, `${record.slug}: secondary`);
        assertContrast(record.uiTheme.main_text_color, surfaces, `${record.slug}: body ink`);
        assertContrast(record.uiTheme.italics_text_color, surfaces, `${record.slug}: muted ink`);
        assertContrast(record.settings['Drawer-iconColor'], [record.surfaces.head], `${record.slug}: drawer ink`);
    }

    const fixedNames = new Set(fixed.map(({ name }) => name));
    const uiNames = new Set(fixed.map(({ uiTheme }) => uiTheme.name));
    assert.deepEqual(uiNames, fixedNames, 'fixed preset/UI names must match exactly');
}

function validateAdaptiveValue(value, label) {
    assert.equal(typeof value, 'string', `${label}: expected a CSS string`);
    const references = [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]);
    const fallbacks = [...value.matchAll(/var\(\s*(--[\w-]+)\s*,\s*(?:#[0-9a-f]{3,8}\b|rgba?\(|oklch\()/gi)].map(match => match[1]);
    assert.equal(fallbacks.length, references.length, `${label}: every host variable needs a literal fallback`);
    for (const variable of references) assert(ADAPTIVE_HOST_VARIABLES.has(variable), `${label}: unsupported host variable ${variable}`);
}

function assertRgba(value, label) {
    assert.match(value, /^rgba\(\d+, \d+, \d+, (?:0|1|0?\.\d+)\)$/, `${label}: expected canonical rgba()`);
    requiredColor(value, label);
}

function assertContrast(foreground, backgrounds, label) {
    const color = requiredColor(foreground, label);
    const minimum = Math.min(...backgrounds.map(background => contrastRatio(color, background)));
    assert(minimum + 1e-9 >= 4.5, `${label}: contrast ${minimum.toFixed(3)} is below 4.5`);
}

function buildOutputs(records, presetVersion, sourceVersion) {
    const outputs = new Map();
    const catalog = records.map(({ name, settings, migrateFromV1 }) => ({ name, settings, migrateFromV1 }));
    const uiThemes = records.filter(({ uiTheme }) => uiTheme).map(({ uiTheme }) => uiTheme);
    outputs.set('src/config/regex-agent-presets.generated.js',
        `// Generated by tools/generate-regex-agent-presets.mjs from Regex Agent Themes v${sourceVersion}. Do not edit.\n`
        + `export const REGEX_AGENT_PRESET_CATALOG_VERSION = ${CATALOG_VERSION};\n\n`
        + `export const REGEX_AGENT_PRESETS = ${JSON.stringify(catalog, null, 4)};\n\n`
        + `export const REGEX_AGENT_UI_THEMES = ${JSON.stringify(uiThemes, null, 4)};\n`);

    for (const record of records) {
        const preset = {
            moonlitEchoesPreset: true,
            presetVersion,
            presetName: record.name,
            settings: record.settings,
        };
        outputs.set(join('theme', `[Moonlit] ${record.name}.json`), `${JSON.stringify(preset, null, 2)}\n`);
        if (record.uiTheme) outputs.set(join('theme', `${record.name}.json`), `${JSON.stringify(record.uiTheme, null, 2)}\n`);
    }
    return outputs;
}

async function checkOutputs(outputs) {
    const expectedThemeFiles = new Set([...outputs.keys()]
        .filter(path => path.startsWith(`theme${join('', '/')}`))
        .map(path => basename(path)));
    for (const [path, expected] of outputs) {
        let actual = null;
        try {
            actual = await readFile(join(ROOT, path), 'utf8');
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
        assert.equal(actual, expected, `${path} is missing or stale; run the generator`);
        if (path.endsWith('.json')) JSON.parse(actual);
    }
    const stale = (await readdir(join(ROOT, 'theme')))
        .filter(file => file.endsWith(` - by ${AUTHOR}.json`) && !expectedThemeFiles.has(file));
    assert.deepEqual(stale, [], `stale generated themes: ${stale.join(', ')}`);
}

async function writeOutputs(outputs) {
    const expectedThemeFiles = new Set([...outputs.keys()]
        .filter(path => path.startsWith(`theme${join('', '/')}`))
        .map(path => basename(path)));
    const stale = (await readdir(join(ROOT, 'theme')))
        .filter(file => file.endsWith(` - by ${AUTHOR}.json`) && !expectedThemeFiles.has(file));
    await Promise.all(stale.map(file => rm(join(ROOT, 'theme', file))));
    for (const [path, content] of outputs) {
        const outputPath = join(ROOT, path);
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, content);
    }
}
