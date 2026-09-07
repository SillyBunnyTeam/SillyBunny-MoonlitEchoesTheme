let popoutVisible = false;
let popoutState = 'closed';
let popoutSession = null;
let transitionVersion = 0;
let $popout = null;
let dragInitialized = false;

let settingsKey = '';
let dragElementFn = null;
let loadMovingUIStateFn = null;
let visibilityChangeCallback = null;

/**
 * Configure popout dependencies and callbacks.
 * @param {object} options
 * @param {string} options.settingsKey - Drawer settings key.
 * @param {Function} [options.dragElement] - Drag helper from RossAscends mods.
 * @param {Function} [options.loadMovingUIState] - Loader for persisted positions.
 * @param {Function} [options.onVisibilityChange] - Called with popout visibility state.
 */
export function configurePopout(options = {}) {
    settingsKey = options.settingsKey || settingsKey;
    dragElementFn = options.dragElement || dragElementFn;
    loadMovingUIStateFn = options.loadMovingUIState || loadMovingUIStateFn;
    visibilityChangeCallback = options.onVisibilityChange || visibilityChangeCallback;
}

/**
 * Returns whether the popout is currently visible.
 * @returns {boolean}
 */
export function isPopoutVisible() {
    return popoutVisible;
}

/**
 * Toggle the popout between open and closed states.
 */
export function togglePopout(event) {
    if (popoutVisible) {
        closePopout();
    } else {
        openPopout(event?.currentTarget || document.activeElement);
    }
}

/**
 * Open the settings popout and move the drawer content inside it.
 */
export function openPopout(launcher = document.activeElement) {
    if (popoutState === 'open' || popoutState === 'opening') return;

    if (popoutState === 'closing' && popoutSession) {
        startOpening(popoutSession);
        return;
    }

    if (!settingsKey) return;

    const drawerElement = document.getElementById(`${settingsKey}-drawer`);
    const $drawer = $(drawerElement);
    const $drawerHeader = $drawer.find('.inline-drawer-header');
    const $drawerContentElement = $drawer.find('.inline-drawer-content');
    const $movingDivs = $('#movingDivs');
    const reservedElements = document.querySelectorAll(
        '#moonlit_echoes_popout, #moonlit_echoes_popoutheader, #moonlit_echoes_popout_title, #moonlit_echoes_content_container',
    );
    if (
        $drawer.length !== 1 ||
        $drawerHeader.length !== 1 ||
        $drawerContentElement.length !== 1 ||
        $movingDivs.length !== 1 ||
        document.querySelectorAll('#movingDivs').length !== 1 ||
        Array.from(reservedElements).some(element => !$popout?.[0].contains(element))
    ) {
        return;
    }

    const setupVersion = ++transitionVersion;
    popoutState = 'opening';

    if (!$popout) {
        $popout = $(`
            <div id="moonlit_echoes_popout" class="draggable" role="dialog" aria-modal="false" aria-labelledby="moonlit_echoes_popout_title" inert style="display: none;">
                <div class="panelControlBar flex-container">
                    <div class="fa-solid fa-moon" aria-hidden="true" style="margin-right: 10px;"></div>
                    <div class="title" id="moonlit_echoes_popout_title">Moonlit Echoes Theme</div>
                    <div class="flex1"></div>
                    <div id="moonlit_echoes_popoutheader" class="fa-solid fa-grip drag-grabber hoverglow" aria-hidden="true"></div>
                    <button type="button" class="fa-solid fa-circle-xmark hoverglow dragClose" aria-label="Close Moonlit Echoes settings" data-i18n="[aria-label]Close Moonlit Echoes settings"></button>
                </div>
                <div id="moonlit_echoes_content_container"></div>
            </div>
        `);
        $popout.find('.dragClose').on('click', closePopout);
    }

    const contentParent = $drawerContentElement[0].parentNode;
    const contentAnchor = document.createComment('moonlit-echoes-drawer-content');
    const contentStyle = $drawerContentElement.attr('style');
    const contentHadOpenClass = $drawerContentElement.hasClass('open');
    $drawerContentElement[0].before(contentAnchor);

    $movingDivs.append($popout);

    $drawerContentElement.removeClass('open').detach()
        .appendTo($popout.find('#moonlit_echoes_content_container'));
    $drawerContentElement.addClass('open').show();
    const session = {
        $popout,
        $drawerContent: $drawerContentElement,
        contentParent,
        contentAnchor,
        contentStyle,
        contentHadOpenClass,
        launcher,
    };
    popoutSession = session;

    if (!dragInitialized && typeof dragElementFn === 'function') {
        // The host retains an anonymous document mouseup listener for each initialisation.
        dragInitialized = true;
        try {
            dragElementFn($popout);
        } catch (error) {
            // Silent error handling to avoid breaking UI.
        }
    }
    if (!isCurrentSetup(session, setupVersion)) {
        cleanUpInterruptedSetup(session, setupVersion);
        return;
    }

    if (typeof loadMovingUIStateFn === 'function') {
        try {
            loadMovingUIStateFn();
        } catch (error) {
            // Silent error handling to avoid breaking UI.
        }
    }
    if (!isCurrentSetup(session, setupVersion)) {
        cleanUpInterruptedSetup(session, setupVersion);
        return;
    }

    startOpening(session);
}

function isCurrentSetup(session, version) {
    return popoutSession === session &&
        popoutState === 'opening' &&
        transitionVersion === version &&
        session.$popout[0].isConnected &&
        session.$drawerContent[0].isConnected;
}

function cleanUpInterruptedSetup(session, version) {
    if (
        popoutSession !== session ||
        popoutState !== 'opening' ||
        transitionVersion !== version
    ) {
        return;
    }

    restoreDrawerContent(session);
    session.$popout.hide();
    session.$popout[0].inert = true;
    popoutSession = null;
    popoutState = 'closed';
}

/**
 * Close the settings popout and return the drawer content to its original location.
 */
export function closePopout() {
    if (popoutState === 'closed' || popoutState === 'closing' || !popoutSession) return;

    const session = popoutSession;
    const version = ++transitionVersion;
    popoutState = 'closing';

    $(document).off('keydown.moonlit_popout');
    session.$popout[0].inert = true;
    setVisibility(false);
    if (
        popoutSession !== session ||
        popoutState !== 'closing' ||
        transitionVersion !== version
    ) {
        return;
    }

    session.$popout.stop(true, false).fadeOut(250).promise('fx').always(() => {
        if (
            popoutSession !== session ||
            popoutState !== 'closing' ||
            transitionVersion !== version
        ) {
            return;
        }

        restoreDrawerContent(session);
        session.$popout.hide();
        popoutSession = null;
        popoutState = 'closed';
        if (session.launcher?.isConnected && !document.querySelector('dialog[open]')) {
            session.launcher.focus({ preventScroll: true });
        }
    });
}

function startOpening(session) {
    const version = ++transitionVersion;
    popoutState = 'opening';
    session.$popout[0].inert = false;

    $(document)
        .off('keydown.moonlit_popout')
        .on('keydown.moonlit_popout', (event) => {
            if (
                event.key === 'Escape' &&
                !event.defaultPrevented &&
                !event.isDefaultPrevented?.() &&
                !document.querySelector('dialog[open]')
            ) {
                event.preventDefault();
                closePopout();
            }
        });
    setVisibility(true);
    if (
        popoutSession !== session ||
        popoutState !== 'opening' ||
        transitionVersion !== version
    ) {
        return;
    }

    const $opening = session.$popout.stop(true, false).fadeIn(250);
    if (
        popoutSession === session &&
        transitionVersion === version &&
        !document.querySelector('dialog[open]')
    ) {
        session.$popout.find('.dragClose')[0].focus({ preventScroll: true });
    }
    $opening.promise('fx').always(() => {
        if (
            popoutSession === session &&
            popoutState === 'opening' &&
            transitionVersion === version
        ) {
            session.$popout.css('opacity', '').show();
            popoutState = 'open';
        }
    });
}

function restoreDrawerContent(session) {
    const contentElement = session.$drawerContent[0];
    const anchorParent = session.contentAnchor.parentNode;
    session.$drawerContent.detach();

    if (anchorParent) {
        anchorParent.insertBefore(contentElement, session.contentAnchor);
        session.contentAnchor.remove();
    } else {
        session.contentParent.append(contentElement);
    }

    session.$drawerContent.toggleClass('open', session.contentHadOpenClass);
    if (session.contentStyle === undefined) {
        session.$drawerContent.removeAttr('style');
    } else {
        session.$drawerContent.attr('style', session.contentStyle);
    }
}

function setVisibility(visible) {
    if (popoutVisible === visible) return;
    popoutVisible = visible;

    if (typeof visibilityChangeCallback === 'function') {
        try {
            visibilityChangeCallback(visible);
        } catch (error) {
            // Silent error handling to avoid interrupting UI flow.
        }
    }
}
