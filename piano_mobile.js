// ==========================================
// PIANO MOBILE: Android/Brave Immersive Fullscreen
// ==========================================

// Dynamically move controls into the gear menu for a minimal UI on all devices
function rearrangeUI() {
    const settingsPanel = document.getElementById('settings-panel');
    const quickControls = document.getElementById('quick-controls');
    const isMobile = typeof isMobileMode === 'function' ? isMobileMode() : false;

    const groupsToMove = [
        document.getElementById('group-recorder'),
        document.getElementById('group-memory'),
        document.getElementById('group-labels'),
        document.getElementById('group-layout')
    ];

    for (let i = groupsToMove.length - 1; i >= 0; i--) {
        const ctrl = groupsToMove[i];
        if (ctrl && settingsPanel) {
            if (ctrl.parentNode !== settingsPanel) {
                settingsPanel.insertBefore(ctrl, settingsPanel.firstChild);
            }
        }
    }

    const pedalGroup = document.getElementById('group-pedal');
    const settingsBtnGroup = document.getElementById('group-settings-btn');

    if (pedalGroup && settingsPanel && quickControls) {
        if (isMobile) {
            if (pedalGroup.parentNode !== settingsPanel) {
                settingsPanel.insertBefore(pedalGroup, settingsPanel.firstChild);
            }
        } else if (pedalGroup.parentNode !== quickControls) {
            if (settingsBtnGroup && settingsBtnGroup.parentNode === quickControls) {
                quickControls.insertBefore(pedalGroup, settingsBtnGroup);
            } else {
                quickControls.appendChild(pedalGroup);
            }
        }
    }
}

function toggleFullScreen() {
    const docEl = document.documentElement;

    if (!document.fullscreenElement) {
        // Request fullscreen and explicitly ask to hide system navigation bars
        docEl.requestFullscreen({ navigationUI: "hide" }).then(() => {
            console.log("Entered immersive fullscreen mode.");
            // Optional: If you want to force landscape mode when they go fullscreen, 
            // uncomment the line below:
            // screen.orientation.lock("landscape").catch(console.warn);
        }).catch(err => {
            console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        // Exit Fullscreen
        document.exitFullscreen().catch(err => {
            console.warn(`Error attempting to exit fullscreen: ${err.message}`);
        });
    }
}

// Listen for fullscreen changes to update the button text automatically
document.addEventListener('fullscreenchange', updateFullscreenButton);

function updateFullscreenButton() {
    const btn = document.getElementById('btn-fullscreen');
    if (!btn) return;
    
    const isFullscreen = !!document.fullscreenElement;
    btn.innerText = isFullscreen ? "EXIT" : "FULL";
}

// Check if we are in mobile mode (Respects User Override)
function isMobileMode() {
    if (typeof layoutMode !== 'undefined') {
        if (layoutMode === 1) return false; // Force Desktop
        if (layoutMode === 2) return true;  // Force Mobile
    }
    // Auto Mode Default
    return window.innerWidth <= 850 || window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

// NEW: Apply the CSS class to the body based on the current mode
function applyLayoutModeClass() {
    if (isMobileMode()) {
        document.body.classList.add('is-mobile');
    } else {
        document.body.classList.remove('is-mobile');
    }
}

// Re-render the board automatically if the user resizes the window or rotates their device
let wasMobile = isMobileMode();
window.addEventListener('resize', () => {
    applyLayoutModeClass(); // Keep CSS in sync when window resizes
    const isNowMobile = isMobileMode();
    if (wasMobile !== isNowMobile) {
        wasMobile = isNowMobile;
        if (!isNowMobile) resetQuickControlsPosition();
        rearrangeUI();
        if (typeof renderBoard === 'function') renderBoard();
        if (typeof resizeCanvas === 'function') resizeCanvas();
    }
});

// Toggle the settings panel globally
function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
        panel.classList.toggle('settings-visible');
        if (!panel.classList.contains('settings-visible')) {
            panel.style.transition = '';
            panel.style.boxShadow = '';
            panel.style.transform = '';
        }
    }
}

function closeSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    if (!panel || !panel.classList.contains('settings-visible')) return;

    panel.classList.remove('settings-visible');
    panel.style.transition = '';
    panel.style.boxShadow = '';
    panel.style.transform = '';
}

// Automatically close the settings if the user clicks/taps outside of it.
window.addEventListener('pointerdown', (e) => {
    const panel = document.getElementById('settings-panel');
    const settingsBtn = document.getElementById('btn-settings');
    
    // If settings are open, and the click was outside the panel and the button, close them.
    if (panel && panel.classList.contains('settings-visible')) {
        if (!panel.contains(e.target) && settingsBtn && !settingsBtn.contains(e.target)) {
            closeSettingsPanel();
        }
    }
});

window.addEventListener('DOMContentLoaded', rearrangeUI);

// ==========================================
// QUICK CONTROLS DRAGGING (LONG PRESS)
// ==========================================
let qcDragTimer = null;
let isDraggingQC = false;
let qcStartX = 0;
let qcStartY = 0;
let qcCurrentOffsetX = 0;
let qcCurrentOffsetY = 0;
let qcStartOffsetX = 0;
let qcStartOffsetY = 0;

const quickControls = document.getElementById('quick-controls');

if (quickControls) {
    quickControls.addEventListener('touchstart', handleQCTouchStart, { passive: false });
    quickControls.addEventListener('touchmove', handleQCTouchMove, { passive: false });
    document.addEventListener('touchend', handleQCTouchEnd);
    document.addEventListener('touchcancel', handleQCTouchEnd);
}

function handleQCTouchStart(e) {
    if (!isMobileMode()) return;
    if (e.touches.length > 1) return;
    if (e.target.closest('button, input, select, option')) return;

    if (qcDragTimer) {
        clearTimeout(qcDragTimer);
        qcDragTimer = null;
    }

    const touch = e.touches[0];
    qcStartX = touch.clientX;
    qcStartY = touch.clientY;
    qcStartOffsetX = qcCurrentOffsetX;
    qcStartOffsetY = qcCurrentOffsetY;

    qcDragTimer = setTimeout(() => {
        isDraggingQC = true;
        quickControls.style.transition = 'none';
        quickControls.style.boxShadow = '0 0 20px rgba(0, 210, 255, 0.8)';

        if (navigator.vibrate) navigator.vibrate(20);
    }, 400);
}

function handleQCTouchMove(e) {
    if (!isDraggingQC) {
        if (qcDragTimer) {
            const touch = e.touches[0];
            if (Math.abs(touch.clientX - qcStartX) > 10 || Math.abs(touch.clientY - qcStartY) > 10) {
                clearTimeout(qcDragTimer);
                qcDragTimer = null;
            }
        }
        return;
    }

    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - qcStartX;
    const dy = touch.clientY - qcStartY;

    qcCurrentOffsetX = qcStartOffsetX + dx;
    qcCurrentOffsetY = qcStartOffsetY + dy;

    quickControls.style.transform = `translate(calc(-50% + ${qcCurrentOffsetX}px), calc(0px + ${qcCurrentOffsetY}px))`;
}

function handleQCTouchEnd() {
    if (qcDragTimer) {
        clearTimeout(qcDragTimer);
        qcDragTimer = null;
    }

    if (isDraggingQC) {
        isDraggingQC = false;
        quickControls.style.transition = '';
        quickControls.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    }
}

function resetQuickControlsPosition() {
    if (!quickControls) return;

    if (qcDragTimer) {
        clearTimeout(qcDragTimer);
        qcDragTimer = null;
    }

    isDraggingQC = false;
    qcCurrentOffsetX = 0;
    qcCurrentOffsetY = 0;
    qcStartOffsetX = 0;
    qcStartOffsetY = 0;
    quickControls.style.transition = '';
    quickControls.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    quickControls.style.transform = '';
}
