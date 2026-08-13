// SillyBunny core owns #chat_display natively (Flat/Bubbles/Document/Echo/
// Whisper/Hush/Ripple/Tide) and applies the exact same body classes this file
// used to manage. Anything here that also listens, applies or persists just
// fights power-user.js, so the slash commands drive the native select instead.

const CHAT_STYLE_LABELS = Object.freeze({
    '0': 'Flat',
    '1': 'Bubbles',
    '2': 'Document',
    '3': 'Echo',
    '4': 'Whisper',
    '5': 'Hush',
    '6': 'Ripple',
    '7': 'Tide',
});

export function setChatStyle(value) {
    const normalized = String(value ?? '').trim();
    const styleValue = Object.hasOwn(CHAT_STYLE_LABELS, normalized) ? normalized : '0';
    const select = document.getElementById('chat_display');

    if (select instanceof HTMLSelectElement) {
        select.value = styleValue;

        const jquery = globalThis.jQuery || globalThis.$;
        if (typeof jquery === 'function') {
            jquery(select).trigger('change');
        } else {
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    return { value: styleValue, label: CHAT_STYLE_LABELS[styleValue] };
}
