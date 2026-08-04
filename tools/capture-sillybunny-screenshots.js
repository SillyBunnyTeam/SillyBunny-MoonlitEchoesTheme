#!/usr/bin/env node

/**
 * Moonlit Echoes (SillyBunny fork) — README screenshot capture.
 *
 * Drives a running SillyBunny instance with Playwright and photographs the theme
 * the way the README presents it: the shell overview, system messages, the preset
 * manager, all eight chat styles, visual novel mode, and a mobile pair.
 *
 * The shots in .github/SillyBunnyPreview/ are produced by this script, so a future
 * SillyBunny or theme release can be re-photographed instead of re-staged by hand.
 *
 * Requires:
 *   - a SillyBunny instance serving this extension (see --url)
 *   - Playwright, which this repo does not vendor (see --sillybunny)
 *
 * Staging the instance (the script drives the browser, it cannot place files):
 *   - copy "theme/Glimmer - by Rivelle.json" into data/<user>/themes/ so --ui-theme resolves
 *   - keep the bundled Bunny Guide welcome chat; it is the subject of every chat shot
 *   - set a persona avatar. The published shots use SillyBunny's own pixel bunny
 *     (public/img/sillybunny-pixel-logo.png); the stock silhouette dominates the frame
 *     in the avatar-forward styles (Echo, Whisper, Ripple).
 *
 * Usage:
 *   node tools/capture-sillybunny-screenshots.js --sillybunny=/path/to/SillyBunny
 *   node tools/capture-sillybunny-screenshots.js --desktop-only --out=/tmp/shots
 */

import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readFile } from 'fs/promises';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const hit = args.find(arg => arg.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
};

const baseURL = flag('url', 'http://127.0.0.1:4444');
const sillyBunnyRoot = flag('sillybunny', process.env.SILLYBUNNY_ROOT || '');
const outDir = resolve(flag('out', join(repoRoot, '.github', 'SillyBunnyPreview')));
const uiThemeName = flag('ui-theme', 'Glimmer - by Rivelle');
const presetFile = resolve(flag('preset', join(repoRoot, 'theme', '[Moonlit] Glimmer - by Rivelle.json')));
// Moonlit is built around a blurred backdrop; on the default transparent background the
// theme's translucency and blur have nothing to sit on and the shots read as flat black.
const backgroundName = flag('background', 'landscape beach night.jpg');
const desktopOnly = args.includes('--desktop-only');
const mobileOnly = args.includes('--mobile-only');

// Desktop stays at 1x: these shots carry a photographic backdrop, and at 2x the set costs
// ~30 MB in a repo that every user of the theme clones. Phones are shot at 2x because the
// files are small and 390px wide is unreadable in a README.
const viewports = {
    desktop: {
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: Number(flag('desktop-scale', '1')),
    },
    mobile: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: Number(flag('mobile-scale', '2')),
        isMobile: true,
        hasTouch: true,
    },
};

/** Moonlit's own settings key, from src/services/settings-service.js. */
const MOONLIT_SETTINGS_KEY = 'SillyTavernMoonlitEchoesTheme';

/**
 * Chat styles in the order the README presents them, with the slash command that
 * selects each one and the body class it must leave behind. The class check is the
 * point: a silently failed switch would otherwise produce a duplicate screenshot.
 */
const CHAT_STYLES = [
    { file: 'style-1-flat', command: '/moonlit-flat', bodyClass: 'flatchat', label: 'Flat' },
    { file: 'style-2-bubble', command: '/moonlit-bubble', bodyClass: 'bubblechat', label: 'Bubble' },
    { file: 'style-3-document', command: '/moonlit-document', bodyClass: 'documentstyle', label: 'Document' },
    { file: 'style-4-echo', command: '/echostyle', bodyClass: 'echostyle', label: 'Echo' },
    { file: 'style-5-whisper', command: '/whisperstyle', bodyClass: 'whisperstyle', label: 'Whisper' },
    { file: 'style-6-hush', command: '/hushstyle', bodyClass: 'hushstyle', label: 'Hush' },
    { file: 'style-7-ripple', command: '/ripplestyle', bodyClass: 'ripplestyle', label: 'Ripple' },
    { file: 'style-8-tide', command: '/tidestyle', bodyClass: 'tidestyle', label: 'Tide' },
];

/**
 * Playwright is a SillyBunny dev dependency, not one of ours — this repo ships as an
 * extension and has no node_modules. Resolve it from a SillyBunny checkout, or from
 * the ambient install if the caller happens to have one.
 */
async function loadPlaywright() {
    const candidates = [];
    if (sillyBunnyRoot) {
        candidates.push(pathToFileURL(join(sillyBunnyRoot, 'tests', 'node_modules', 'playwright', 'index.js')).href);
        candidates.push(pathToFileURL(join(sillyBunnyRoot, 'node_modules', 'playwright', 'index.js')).href);
    }
    candidates.push('playwright');

    for (const candidate of candidates) {
        try {
            const mod = await import(candidate);
            return mod.default ?? mod;
        } catch {
            // Try the next candidate.
        }
    }

    throw new Error(
        'Could not load Playwright. Pass --sillybunny=/path/to/SillyBunny (its tests/ tree vendors it), ' +
        'or set SILLYBUNNY_ROOT.',
    );
}

async function dismissOnboardingIfPresent(page) {
    const onboarding = page.locator('dialog[open]:has(.onboarding)').first();
    if (await onboarding.isVisible().catch(() => false)) {
        await onboarding.locator('.popup-input').fill('User');
        await onboarding.locator('.popup-button-ok').click({ force: true });
        await page.waitForTimeout(1500);
    }
}

/**
 * SillyBunny re-parents the classic drawers into its own shell and marks their toggles
 * `sb-hidden-toggle`, so a plain click misses often enough to matter.
 */
async function forceClick(page, selector) {
    await page.waitForSelector(selector, { state: 'attached', timeout: 10000 });
    try {
        await page.locator(selector).click({ force: true, timeout: 5000 });
    } catch {
        await page.locator(selector).dispatchEvent('click');
    }
    await page.waitForTimeout(400);
}

/**
 * Drawer state machine: SillyBunny's three overlays fight each other, so every section
 * declares the one drawer it wants and this closes the rest first.
 */
async function ensureOnlyOpen(page, target) {
    const drawers = [
        { key: 'left', panel: '#left-nav-panel', toggle: '#sb-left-shell-toggle' },
        { key: 'customize', panel: '#user-settings-block', toggle: '#sb-right-shell-toggle' },
        { key: 'characters', panel: '#right-nav-panel', toggle: '#sb-character-toggle' },
    ];

    for (const drawer of drawers) {
        const open = await page.locator(`${drawer.panel}.openDrawer`).isVisible().catch(() => false);
        if (open && drawer.key !== target) {
            await forceClick(page, drawer.toggle);
            await page.waitForSelector(`${drawer.panel}.openDrawer`, { state: 'hidden', timeout: 5000 }).catch(() => {});
        }
    }

    const wanted = drawers.find(drawer => drawer.key === target);
    if (wanted) {
        const open = await page.locator(`${wanted.panel}.openDrawer`).isVisible().catch(() => false);
        if (!open) {
            await forceClick(page, wanted.toggle);
            await page.waitForSelector(`${wanted.panel}.openDrawer`, { timeout: 10000 });
        }
    }

    await page.waitForTimeout(500);
}

async function runSlashCommand(page, command) {
    return page.evaluate(async (cmd) => {
        const context = globalThis.SillyTavern?.getContext?.();
        if (!context?.executeSlashCommandsWithOptions) throw new Error('slash command API unavailable');
        await context.executeSlashCommandsWithOptions(cmd, { handleExecutionErrors: true });
    }, command);
}

/** Select one of SillyBunny's own UI themes, the way the Customize drawer does. */
async function applyUiTheme(page, themeName) {
    const applied = await page.evaluate((name) => {
        const select = document.getElementById('themes');
        if (!select) return 'no-select';
        const option = [...select.options].find(o => o.value === name);
        if (!option) return 'missing';
        select.value = name;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return 'ok';
    }, themeName);

    if (applied !== 'ok') {
        throw new Error(`UI theme "${themeName}" could not be applied (${applied}). Copy theme/${themeName}.json into data/<user>/themes/ first.`);
    }
    await page.waitForTimeout(2500);
}

/**
 * Store the shipped Moonlit preset, then activate it through the preset selector's own
 * change handler so the real activation path runs rather than a hand-rolled copy of it.
 */
async function applyMoonlitPreset(page, preset) {
    await page.evaluate(({ key, name, settings }) => {
        const context = globalThis.SillyTavern?.getContext?.();
        const store = context?.extensionSettings?.[key];
        if (!store) throw new Error('Moonlit settings not found — is the extension installed and enabled?');
        store.presets ||= {};
        store.presets[name] = settings;
        context.saveSettingsDebounced();
    }, { key: MOONLIT_SETTINGS_KEY, name: preset.presetName, settings: preset.settings });

    await page.waitForTimeout(1500);

    const selected = await page.evaluate((name) => {
        const select = document.getElementById('moonlit-preset-selector');
        if (!select) return 'no-selector';
        if (![...select.options].some(o => o.value === name)) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        }
        select.value = name;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return 'ok';
    }, preset.presetName);

    if (selected !== 'ok') {
        throw new Error(`Moonlit preset "${preset.presetName}" could not be activated (${selected}).`);
    }
    await page.waitForTimeout(2500);
}

/**
 * Park the chat so a user message sits at the top of the frame with the character's
 * reply below it. Every style shot then shows the same two messages, which is what
 * makes the eight of them comparable.
 */
async function frameChatOnExchange(page) {
    await page.evaluate(() => {
        const messages = [...document.querySelectorAll('#chat .mes')];
        const target = messages.find(m => m.getAttribute('is_user') === 'true' && m === messages.at(-2))
            ?? messages.at(-2)
            ?? messages.at(-1);
        target?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    await page.waitForTimeout(800);
}

async function openBunnyGuideChat(page) {
    await ensureOnlyOpen(page, 'none');

    const alreadyInChat = await page.locator('#chat .mes').first().isVisible().catch(() => false);
    if (alreadyInChat) return;

    const onHome = await page.locator('button[data-assistant-id="guide"][data-action="open-assistant"]').first()
        .isVisible().catch(() => false);
    if (!onHome) {
        await forceClick(page, '#sb-home-toggle');
    }

    const assistant = page.locator('button[data-assistant-id="guide"][data-action="open-assistant"]').first();
    await assistant.click({ force: true, timeout: 5000 }).catch(async () => {
        await assistant.dispatchEvent('click');
    });

    await page.waitForSelector('#chat', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#chat .mes', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1500);
}

const sections = {
    /** Hero shot: SillyBunny's own home screen wearing the theme. */
    'hero-home': async (page) => {
        await ensureOnlyOpen(page, 'none');
        const onHome = await page.locator('button[data-assistant-id="guide"][data-action="open-assistant"]')
            .first().isVisible().catch(() => false);
        if (!onHome) await forceClick(page, '#sb-home-toggle');
        await page.waitForTimeout(1500);
    },

    /**
     * Mirrors upstream's system_messages.png. Needs a chat open — with none selected
     * SillyBunny fills the chat area with its home screen and the message never shows.
     * The message is pushed in memory only; the teardown drops it before anything saves.
     */
    'system-messages': async (page) => {
        await openBunnyGuideChat(page);
        await page.evaluate(() => {
            // 'welcome' is system_message_types.WELCOME; the enum itself is not on the context.
            globalThis.SillyTavern?.getContext?.()?.sendSystemMessage('welcome');
        });
        await page.waitForSelector('#chat .mes.last_mes', { state: 'visible', timeout: 10000 });
        await page.evaluate(() => {
            document.querySelector('#chat .mes.last_mes')?.scrollIntoView({ block: 'start', behavior: 'instant' });
        });
        await page.waitForTimeout(1500);
    },

    /** The whole shell at once: an open chat with the character list alongside it. */
    'ui-overview': async (page) => {
        await openBunnyGuideChat(page);
        await ensureOnlyOpen(page, 'characters');
        // The drawer reopens on whichever tab was last used, which is usually the card
        // editor for the selected character — not an overview of anything.
        await page.locator('#right-nav-panel button[role="tab"]', { hasText: 'Characters' })
            .first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(1500);
    },

    /** The preset manager, popped out so it is photographed at its own size. */
    'theme-presets': async (page) => {
        await ensureOnlyOpen(page, 'customize');
        await forceClick(page, '#moonlit_settings_popout_button');
        await page.waitForSelector('#moonlit_echoes_popout', { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(1500);
    },

    'mobile-in-chat': async (page) => {
        await openBunnyGuideChat(page);
        await runSlashCommand(page, '/echostyle');
        await page.waitForFunction(() => document.body.classList.contains('echostyle'), null, { timeout: 10000 });
        await frameChatOnExchange(page);
    },

    /** Moonlit's own settings panel on a phone, not SillyBunny's generic Customize page. */
    'mobile-settings': async (page) => {
        await ensureOnlyOpen(page, 'customize');
        await page.locator('#user-settings-block button[role="tab"]', { hasText: 'Extensions' })
            .first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        await page.locator('#SillyTavernMoonlitEchoesTheme-drawer .inline-drawer-toggle')
            .first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(1200);
        await page.locator('#SillyTavernMoonlitEchoesTheme-drawer')
            .scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(800);
    },
};

/** Teardowns for the sections that change global shell state. */
const teardowns = {
    // Drop the injected welcome message again. It only ever lived in memory, but leaving
    // it in `chat` would let an unrelated save write it into the user's chat file.
    'system-messages': async (page) => {
        await page.evaluate(() => {
            const context = globalThis.SillyTavern?.getContext?.();
            context?.chat?.pop();
            document.querySelector('#chat .mes.last_mes')?.remove();
        });
        await page.waitForTimeout(500);
    },
    'theme-presets': async (page) => {
        await page.locator('#moonlit_echoes_popout .fa-circle-xmark, #moonlitEchoesPopoutHeader .fa-circle-xmark')
            .first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(800);
        await ensureOnlyOpen(page, 'none');
    },
    'mobile-settings': async (page) => {
        await ensureOnlyOpen(page, 'none');
    },
};

/** Sections photographed as a single element rather than the whole viewport. */
const elementShots = {
    'theme-presets': '#moonlit_echoes_popout',
};

const desktopPlan = ['hero-home', 'ui-overview', 'system-messages', 'theme-presets'];
const mobilePlan = ['mobile-in-chat', 'mobile-settings'];

async function shoot(page, name) {
    const path = join(outDir, `${name}.png`);
    const selector = elementShots[name];
    if (selector) {
        await page.locator(selector).screenshot({ path, type: 'png' });
    } else {
        await page.screenshot({ path, fullPage: false, type: 'png' });
    }
    console.log(`   ✓ ${name}.png`);
}

async function capture(chromium, viewportName, preset) {
    const options = viewports[viewportName];
    const { width, height } = options.viewport;
    console.log(`\n📸 ${viewportName} (${width}x${height} @${options.deviceScaleFactor}x)`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(options);
    const page = await context.newPage();
    page.on('console', msg => {
        if (msg.type() === 'error') console.log(`      [browser] ${msg.text().slice(0, 160)}`);
    });

    try {
        await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(7000);
        await dismissOnboardingIfPresent(page);

        await applyUiTheme(page, uiThemeName);
        await applyMoonlitPreset(page, preset);
        await runSlashCommand(page, `/bg ${backgroundName}`);
        await page.waitForTimeout(2000);

        const plan = viewportName === 'desktop' ? desktopPlan : mobilePlan;
        for (const name of plan) {
            console.log(`   ${name}...`);
            await sections[name](page);
            await shoot(page, name);
            await teardowns[name]?.(page);
        }

        if (viewportName === 'desktop') {
            await openBunnyGuideChat(page);
            for (const style of CHAT_STYLES) {
                console.log(`   ${style.file} (${style.label})...`);
                await runSlashCommand(page, style.command);
                await page.waitForFunction(
                    (cls) => document.body.classList.contains(cls),
                    style.bodyClass,
                    { timeout: 10000 },
                );
                await page.waitForTimeout(1200);
                await frameChatOnExchange(page);
                await shoot(page, style.file);
            }
        }
    } finally {
        await browser.close();
    }
}

async function main() {
    console.log('🐰 Moonlit Echoes — SillyBunny screenshot capture');
    console.log(`   target : ${baseURL}`);
    console.log(`   output : ${outDir}`);

    try {
        const response = await fetch(baseURL);
        if (!response.ok) throw new Error(`server returned ${response.status}`);
    } catch (error) {
        console.error(`\n❌ No SillyBunny at ${baseURL} (${error.message}). Start it with: node server.js --port 4444`);
        process.exit(1);
    }

    const preset = JSON.parse(await readFile(presetFile, 'utf8'));
    if (!preset?.moonlitEchoesPreset || !preset.settings) {
        console.error(`\n❌ ${presetFile} is not a Moonlit preset export.`);
        process.exit(1);
    }

    mkdirSync(outDir, { recursive: true });
    const { chromium } = await loadPlaywright();

    if (!mobileOnly) await capture(chromium, 'desktop', preset);
    if (!desktopOnly) await capture(chromium, 'mobile', preset);

    console.log('\n✅ Done.');
}

main().catch(error => {
    console.error(`\n❌ Capture failed: ${error.message}`);
    process.exit(1);
});
