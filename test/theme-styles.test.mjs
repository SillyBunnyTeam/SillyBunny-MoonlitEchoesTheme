import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Source contracts only. Layout, the cascade, touch and keyboard interaction
// still need browser fixtures with the host stylesheets and message markup.
async function loadConfig(name) {
    const source = await readFile(new URL(`../src/config/theme-settings-${name}.js`, import.meta.url), 'utf8');
    const translationImport = "import { t } from '../../../../../i18n.js';";
    assert(source.startsWith(translationImport));
    return import(`data:text/javascript,${encodeURIComponent(source.replace(translationImport, 'const t = String.raw;'))}`);
}

const [core, chat, mobile, styleCss, chatCss, extensionCss] = await Promise.all([
    loadConfig('core'),
    loadConfig('chat'),
    loadConfig('mobile'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
    readFile(new URL('../chat-styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../extension.css', import.meta.url), 'utf8'),
]);
const settings = new Map([
    ...core.coreThemeSettings,
    ...chat.chatThemeSettings,
    ...mobile.mobileThemeSettings,
].map(setting => [setting.varId, setting]));

// Extract one named source block, without trying to implement CSS selection.
function block(source, selector) {
    source = source.replace(/\/\*[\s\S]*?\*\//g, '');
    const marker = `${selector} {`;
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `Missing block: ${selector}`);
    const contentStart = start + marker.length;
    let depth = 1;
    for (let index = contentStart; index < source.length; index++) {
        if (source[index] === '{') depth++;
        if (source[index] === '}' && --depth === 0) return source.slice(contentStart, index);
    }
    assert.fail(`Unclosed block: ${selector}`);
}

function declarations(source, selector) {
    const body = block(source, selector);
    assert(!body.includes('{'), `Expected a declaration-only block: ${selector}`);
    return Object.fromEntries(body.split(';').filter(part => part.trim()).map(part => {
        const colon = part.indexOf(':');
        assert(colon > 0, `Missing declaration colon: ${part}`);
        return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()];
    }));
}

test('native line-height values remain distinct from saved overrides', () => {
    assert.equal(settings.get('messageLineHeight').default, '');
    for (const value of [undefined, null, '', '  ', 'calc(var(--mainFontSize) + .5rem)', 'calc(var(--mainFontSize) + var(--lineSpacingDesktopLeading, 0.5rem))']) {
        assert(core.isNativeMessageLineHeightValue(value), String(value));
    }
    for (const value of ['1.8', '28px', 'normal', 'calc(1em + 8px)']) {
        assert.equal(core.isNativeMessageLineHeightValue(value), false, value);
    }
    for (const id of ['charNameFontSize', 'userNameFontSize', 'messageTextLetterSpacing']) {
        assert.equal(settings.get(id).default, 'inherit');
    }
    assert.equal(settings.get('mesParagraphSpacingTop').default, '0.4em');
    assert.equal(settings.get('mesParagraphSpacingBottom').default, '0.6em');
});

test('message-detail contracts use opacity and expose focus-within reveal hooks', () => {
    const css = settings.get('enableMessageDetails').cssBlock;
    const faded = declarations(css, '.mes .tokenCounterDisplay');
    assert.equal(faded.opacity, '0 !important');
    assert.equal(faded.visibility, undefined);
    assert(!faded.transition.includes('!important'));
    const reveal = '.mes:is(:hover, :focus-within, .active-message)';
    assert.equal(declarations(css, `${reveal} .tokenCounterDisplay`).opacity, '1 !important');
    const reasoning = declarations(css, `${reveal} .mes_reasoning_details`);
    assert.equal(reasoning.opacity, '1');
    assert.equal(reasoning['pointer-events'], 'auto');
    assert.equal(reasoning['max-height'], '100%');
    assert(block(css, 'body.ripplestyle').includes(`${reveal} .ch_name`));
    assert(block(css, 'body.ripplestyle').includes('margin-top: unset;'));
    assert(css.includes(`${reveal} .tokenCounterDisplay {\n                    transform: translateY(0);`));
});

test('shadow removal excludes keyboard focus and leaves native focus colours intact', () => {
    const reset = declarations(styleCss, "input[type='checkbox']:not(:focus-visible)");
    assert.equal(reset['box-shadow'], 'none !important');
    assert(!styleCss.includes('--interactable-outline-color: transparent;'));
    assert(!styleCss.includes('--interactable-outline-color-faint: transparent;'));
    assert(!styleCss.includes('outline: 0px solid var(--customThemeColor);'));
});

test('Input History visibility remains owned by its hidden-state rules', () => {
    for (const selector of [
        '#send_form #gg-action-button-container .stih--buttons',
        '#send_form .stih--standalone .stih--arrows',
        '#send_form .stih--standalone',
        '.stih--buttons .stih--arrows',
    ]) {
        assert.equal(declarations(extensionCss, selector).display, undefined, selector);
    }
});

test('horizontal QR contracts put scrolling on the host-allowed outer bar', () => {
    const css = settings.get('enableMobile-horizontal_qrs').cssBlock;
    const outer = declarations(css, '#send_form #qr--bar');
    assert.equal(outer['overflow-x'], 'auto');
    assert.equal(outer['overflow-y'], 'hidden');
    assert.equal(outer['flex-wrap'], 'nowrap');
    assert.equal(outer['justify-content'], 'flex-start');
    assert.equal(outer['max-height'], 'none');
    const sets = declarations(css, '#send_form #qr--bar > .qr--buttons');
    assert.equal(sets.flex, '0 0 auto');
    assert.equal(sets.width, 'max-content');
    assert.equal(sets['flex-wrap'], 'nowrap');
    assert.equal(sets['overflow-x'], undefined);
    assert.equal(declarations(css, '#send_form #qr--bar .qr--button')['flex-shrink'], '0');
    const position = settings.get('moveQRsBelowInputMobile').cssBlock;
    assert.equal(declarations(position, '#gg-action-button-container:has(#qr--bar)').order, '3 !important');
    assert.equal(declarations(extensionCss, '.ctx-menu')['margin-left'], undefined);
});

test('shared swipe declarations do not reset the previous button positioning', () => {
    const prefix = 'body:is(.echostyle, .whisperstyle, .hushstyle, .ripplestyle, .tidestyle) #chat .last_mes';
    const shared = declarations(chatCss, `${prefix} :is(.swipe_left, .swipe_right)`);
    assert.equal(shared.position, undefined);
    assert.equal(shared.right, undefined);
    const previous = declarations(chatCss, `${prefix} .swipe_left`);
    assert.equal(previous.position, 'absolute !important');
    assert(previous.right.startsWith('calc('));
    const next = declarations(chatCss, `${prefix} .swipe_right`);
    assert.equal(next.position, 'relative !important');
    assert.equal(next.right, 'auto !important');
});

test('toolbar and safe-area geometry stay with the host', () => {
    assert(!styleCss.includes('--topBarBlockSize:'));
    assert(!styleCss.includes('--sb-topbar-layout-offset:'));
    assert.equal(declarations(styleCss, '#form_sheld').padding, undefined);
    const chat = block(styleCss, '#chat');
    assert(!chat.includes('padding: 0 8px !important;'));
    const documentChat = block(block(styleCss, 'body.documentstyle'), '#chat');
    assert(documentChat.includes('padding-block: 1em !important;'));
    const heightRules = styleCss.slice(styleCss.indexOf('body:has(#sb-topbar-stack) :is('), styleCss.indexOf('height: calc(100dvh - var(--topBarBlockSize)) !important;', styleCss.indexOf('body:has(#sb-topbar-stack) :is(')));
    assert.equal(heightRules.split('#WorldInfo:where(:not(.sb-shell-embedded-content))').length - 1, 2);
});

test('typography contracts target message bodies and keep paragraph layout separate', () => {
    const root = declarations(styleCss, ':root');
    assert.equal(root['--moonlit-message-paragraph-spacing-top'], 'var(--mesParagraphSpacingTop, 0.5em)');
    assert.equal(root['--moonlit-message-paragraph-spacing-bottom'], 'var(--mesParagraphSpacingBottom, 0.5em)');
    const body = declarations(styleCss, '#chat .mes_text');
    assert.equal(body['font-size'], 'var(--messageTextFontSize, var(--mainFontSize)) !important');
    assert.equal(body['letter-spacing'], 'var(--messageTextLetterSpacing, inherit) !important');
    assert.equal(body['line-height'], 'var(--moonlit-message-line-height, var(--moonlit-sb-message-line-height-desktop)) !important');
    const paragraph = declarations(styleCss, 'body #chat .mes .mes_block .mes_text p');
    for (const property of ['font-size', 'letter-spacing', 'line-height']) assert.equal(paragraph[property], 'inherit !important');
    assert.equal(paragraph['margin-top'], 'var(--moonlit-message-paragraph-spacing-top) !important');
    assert.equal(paragraph['margin-bottom'], 'var(--moonlit-message-paragraph-spacing-bottom) !important');
    assert.equal(paragraph.display, undefined);
    for (const [user, variable] of [['false', 'charNameFontSize'], ['true', 'userNameFontSize']]) {
        assert.equal(declarations(styleCss, `body #chat .mes[is_user="${user}"] .ch_name .name_text`)['font-size'], `var(--${variable}, inherit) !important`);
    }
    assert(styleCss.includes('line-height: var(--moonlit-message-line-height, var(--moonlit-sb-message-line-height-mobile)) !important;'));
});

test('composer and Ripple derived sizes are evaluated on their components', () => {
    const composer = declarations(styleCss, '#send_form #nonQRFormItems');
    assert.equal(composer['--moonlit-sb-composer-button-size'], 'var(--sb-composer-action-size, var(--bottomFormBlockSize, 36px))');
    assert.equal(composer['--moonlit-sb-composer-send-width'], 'var(--sb-composer-send-width, calc(var(--moonlit-sb-composer-button-size) * var(--moonlit-sb-composer-send-ratio)))');
    assert.equal(composer['--moonlit-sb-composer-icon-size'], 'var(--sb-composer-action-icon-size, calc(var(--bottomFormIconSize, 24px) * 0.72))');
    const root = block(styleCss.slice(styleCss.indexOf('/* SillyBunny compatibility guardrails.')), ':root');
    assert(!root.includes('--moonlit-sb-composer-button-size:'));
    assert(!root.includes('--moonlit-sb-ripple-avatar-mobile-height:'));
    const ripple = declarations(chatCss, 'body.ripplestyle #chat .mes:not(.smallSysMes)');
    assert.equal(ripple['--moonlit-sb-ripple-avatar-mobile-height'], 'calc(var(--moonlit-sb-ripple-avatar-mobile-width) * var(--customRippleAvatarRatio, 1.5))');
    assert(!block(chatCss, ':root').includes('--moonlit-sb-ripple-avatar-mobile-height:'));
});

test('popup overflow, Whisper width and Document blur defer to existing contracts', () => {
    assert(!block(styleCss, '.popup-content').includes('overflow-x:'));
    const whisper = block(chatCss, 'body.whisperstyle #chat');
    assert(whisper.includes('width: var(--customWhisperAvatarWidth, 50%);'));
    assert(!whisper.includes('width: 55%;'));
    assert.equal(declarations(block(styleCss, 'body.documentstyle'), '#sheld::before')['backdrop-filter'], undefined);
    assert(block(styleCss, '#sheld').includes('backdrop-filter: blur(calc(var(--mobileSheldBlurStrength) * 1px));'));
});

test('motion declarations allow the native reduced-motion rules to win', () => {
    assert(!block(styleCss, '#HotSwapWrapper:hover .hotswap.avatars_inline').includes('ease-in-out !important'));
    assert(!block(extensionCss, '.stih--history .stih--item').includes('transition: all 0.5s ease !important'));
    assert(!declarations(settings.get('enableThemeColorization').cssBlock, '.mes_button').transition.includes('!important'));
});

test('navigation controls cover the current shell and gate legacy height changes', () => {
    const animation = settings.get('disableTopMenuAnimation').cssBlock;
    for (const selector of ['.sb-shell-root,', '.sb-shell-main,', '#right-nav-panel,', '#sb-topbar-stack,', '#sb-mobile-nav,']) assert(animation.includes(selector));
    assert.equal(declarations(animation, '#sb-mobile-chat-tools').animation, 'none !important');
    const height = settings.get('newMenuMaxHeight').cssBlock;
    const legacy = block(height, 'body:not(:has(.sb-shell-root)):not(:has(#sb-topbar-stack))');
    assert(legacy.includes('max-height: calc(100dvh - var(--topBarBlockSize) - var(--formSheldHeight)'));
    assert(styleCss.includes('#sb-topbar-stack :is(.sb-proxy-button, .sb-chatbar-button) > i,'));
    assert.equal(declarations(styleCss, '.sb-shell-tab > i').color, 'var(--Drawer-iconColor) !important');
    assert.equal(declarations(styleCss, ':root')['--sb-scrollbar-thumb'], 'var(--customScrollbarColor, rgba(255, 255, 255, 0.5))');
});
