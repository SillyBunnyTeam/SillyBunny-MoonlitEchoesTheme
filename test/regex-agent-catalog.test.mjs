import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { REGEX_AGENT_PRESETS, REGEX_AGENT_UI_THEMES } from '../src/config/regex-agent-presets.generated.js';
import { THEME_VERSION } from '../src/config/theme-info.js';
import { THEMES } from '../../SillyBunny-Regex-Agent-Themes/src/themes/index.js';
import { resolveTheme } from '../../SillyBunny-Regex-Agent-Themes/src/tokens.js';
import { composite, contrastRatio, mixColors, parseColor } from '../../SillyBunny-Regex-Agent-Themes/src/color.js';

const ROOT = new URL('../', import.meta.url);
const SOURCE = fileURLToPath(new URL('../../SillyBunny-Regex-Agent-Themes', import.meta.url));
const json = async path => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));

test('all 78 presets and 75 UI companions exactly match the released catalogue', async () => {
    assert.equal(REGEX_AGENT_PRESETS.length, 78);
    assert.equal(REGEX_AGENT_UI_THEMES.length, 75);
    assert.equal(THEME_VERSION, '3.2.0-sb18');
    assert.equal((await json('manifest.json')).version, THEME_VERSION);
    const expectedFiles = [];
    for (const { name, settings } of REGEX_AGENT_PRESETS) {
        const file = `[Moonlit] ${name}.json`;
        expectedFiles.push(file);
        assert.deepEqual(await json(`theme/${file}`), {
            moonlitEchoesPreset: true, presetVersion: THEME_VERSION, presetName: name, settings,
        });
        assert.equal(Object.keys(settings).length, 10);
    }
    for (const ui of REGEX_AGENT_UI_THEMES) {
        expectedFiles.push(`${ui.name}.json`);
        assert.deepEqual(await json(`theme/${ui.name}.json`), ui);
    }
    assert.deepEqual((await readdir(new URL('theme/', ROOT))).filter(file => file.endsWith(' - by platberlitz.json')).sort(), expectedFiles.sort());
});

test('all fixed palettes keep authored decoration and readable text on the actual composited intended surfaces', t => {
    let minimum = Infinity;
    let adjustedQuotes = 0;
    for (const theme of THEMES.filter(theme => theme.mode !== 'adaptive')) {
        const tokens = resolveTheme(theme, { density: 'normal', adaptiveNeutrals: false, glyphs: 'theme' });
        const name = `${theme.name} - by platberlitz`;
        const settings = REGEX_AGENT_PRESETS.find(preset => preset.name === name).settings;
        const ui = REGEX_AGENT_UI_THEMES.find(preset => preset.name === name);
        const authored = parseColor(tokens.accents[0]);
        const authoredCss = `rgba(${Math.round(authored.r)}, ${Math.round(authored.g)}, ${Math.round(authored.b)}, ${Math.round(authored.a * 1000) / 1000})`;
        assert(settings.customlastInContext === 'none' || settings.customlastInContext.endsWith(` ${authoredCss}`), name);
        if (ui.quote_text_color !== authoredCss) adjustedQuotes += 1;

        const canvas = parseColor(tokens.a11y.canvas);
        const shell = composite(parseColor(settings.sheldBackgroundColor), canvas);
        const panel = composite(parseColor(ui.blur_tint_color), canvas);
        const backgrounds = [shell, panel];
        // Flat chat is transparent; bubble chat and Moonlit styles add their own translucent rows.
        for (const base of [shell, panel]) {
            const chat = composite(parseColor(ui.chat_tint_color), base);
            backgrounds.push(chat);
            for (const colour of [settings.customBgColor1, settings.customBgColor2, ui.user_mes_blur_tint_color, ui.bot_mes_blur_tint_color]) {
                backgrounds.push(composite(parseColor(colour), chat));
            }
        }
        // Also retain readability on the source palette's opaque, scrim-composited swatches.
        const paint = (colour, beneath) => {
            const painted = composite(parseColor(colour), beneath);
            return tokens.a11y.scrim ? composite(parseColor(tokens.a11y.scrim), painted) : painted;
        };
        const body = mixColors(paint(tokens.surface.bodyFrom, canvas), paint(tokens.surface.bodyTo, canvas), 0.5);
        backgrounds.push(body, paint(tokens.surface.row, body), paint(tokens.surface.rowAlt, body));
        const colours = { ...ui, ...settings };
        for (const key of ['customThemeColor', 'customThemeColor2', 'main_text_color', 'italics_text_color', 'underline_text_color', 'quote_text_color']) {
            for (const background of backgrounds) {
                const ratio = contrastRatio(composite(parseColor(colours[key]), background), background);
                assert(ratio >= 4.5, `${name}: ${key} contrast ${ratio}`);
                minimum = Math.min(minimum, ratio);
            }
        }
    }
    assert.equal(adjustedQuotes, 31);
    t.diagnostic(`75 fixed palettes, 31 adjusted quote colours; minimum text contrast ${minimum.toFixed(3)}:1 on intended surfaces.`);
});

test('legacy Glimmer primary and native text colours remain readable across its paired surfaces', async t => {
    const ui = await json('theme/Glimmer - by Rivelle.json');
    const preset = await json('theme/[Moonlit] Glimmer - by Rivelle.json');
    assert.equal(preset.presetName, ui.name);
    assert.equal(preset.presetVersion, THEME_VERSION);
    const canvas = parseColor(ui.blur_tint_color);
    const shell = composite(parseColor(preset.settings.sheldBackgroundColor), canvas);
    const backgrounds = [shell, ...[preset.settings.customBgColor1, preset.settings.customBgColor2, ui.user_mes_blur_tint_color, ui.bot_mes_blur_tint_color]
        .map(colour => composite(parseColor(colour), shell))];
    let minimum = Infinity;
    let primaryMinimum = Infinity;
    const colours = { ...ui, ...preset.settings };
    for (const key of ['customThemeColor', 'customThemeColor2', 'main_text_color', 'italics_text_color', 'underline_text_color', 'quote_text_color']) {
        for (const background of backgrounds) {
            const ratio = contrastRatio(parseColor(colours[key]), background);
            assert(ratio >= 4.5, `${key}: ${ratio}`);
            if (key === 'italics_text_color') minimum = Math.min(minimum, ratio);
            if (key === 'customThemeColor') primaryMinimum = Math.min(primaryMinimum, ratio);
        }
    }
    t.diagnostic(`Glimmer minimum primary contrast ${primaryMinimum.toFixed(3)}:1, italic contrast ${minimum.toFixed(3)}:1 on intended surfaces.`);
});

test('generator rejects malformed arguments before writes and --check never writes', async () => {
    const paths = ['src/config/regex-agent-presets.generated.js', ...(await readdir(new URL('theme/', ROOT))).map(file => `theme/${file}`)];
    const snapshot = () => Promise.all(paths.map(async path => {
        const url = new URL(path, ROOT);
        const details = await stat(url, { bigint: true });
        return [path, details.mtimeNs, details.ctimeNs, createHash('sha256').update(await readFile(url)).digest('hex')];
    }));
    const before = await snapshot();
    const run = args => spawnSync(process.execPath, ['tools/generate-regex-agent-presets.mjs', ...args], {
        cwd: ROOT, encoding: 'utf8', timeout: 30_000,
    });
    for (const args of [
        ['--source'], ['--source', '--check'], ['--source='], ['--source', '   '],
        ['--source=--check'], ['--source', '-x'], ['--check=false'], ['--unknown'],
        ['--source', SOURCE, '--source=elsewhere'], ['--check', '--check'],
        ['--check', `--source=${SOURCE}`, '--unknown'],
    ]) {
        const result = run(args);
        assert.equal(result.error, undefined);
        assert.notEqual(result.status, 0, args.join(' '));
        assert.match(result.stderr, /requires a non-option path|Only one --source|Duplicate argument|Unknown argument/);
    }
    for (const args of [['--check', `--source=${SOURCE}`], ['--source', SOURCE, '--check']]) {
        const result = run(args);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /Checked 78 Moonlit presets and 75 UI themes/);
    }
    assert.deepEqual(await snapshot(), before);
});
