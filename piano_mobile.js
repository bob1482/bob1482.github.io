// ==========================================
// PIANO MOBILE: Android/Brave Immersive Fullscreen
// ==========================================

// Dynamically move controls between the top bar and the gear menu
function rearrangeUI() {
    const isMobile = isMobileMode();
    const quickControls = document.getElementById('quick-controls');
    const settingsPanel = document.getElementById('settings-panel');

    const groupsToMove = [
        document.getElementById('group-recorder'),
        document.getElementById('group-memory'),
        document.getElementById('group-labels'),
        document.getElementById('group-transpose')
    ];

    if (isMobile) {
        if (quickControls) quickControls.style.display = 'none';

        for (let i = groupsToMove.length - 1; i >= 0; i--) {
            const ctrl = groupsToMove[i];
            if (ctrl && settingsPanel) {
                settingsPanel.insertBefore(ctrl, settingsPanel.firstChild);
            }
        }
    } else {
        if (quickControls) quickControls.style.display = 'flex';

        groupsToMove.forEach(ctrl => {
            if (ctrl && quickControls) quickControls.appendChild(ctrl);
        });
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
    }
}

// Automatically close the settings if the user clicks/taps outside of it.
window.addEventListener('pointerdown', (e) => {
    const panel = document.getElementById('settings-panel');
    const settingsBtn = document.getElementById('btn-settings');
    
    // If settings are open, and the click was outside the panel and the button, close them.
    if (panel && panel.classList.contains('settings-visible')) {
        if (!panel.contains(e.target) && settingsBtn && !settingsBtn.contains(e.target)) {
            panel.classList.remove('settings-visible');
        }
    }
});

window.addEventListener('DOMContentLoaded', rearrangeUI);
