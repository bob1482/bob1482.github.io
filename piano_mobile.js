// ==========================================
// PIANO MOBILE: Android/Brave Immersive Fullscreen
// ==========================================

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

// Check if we are in mobile mode
function isMobileMode() {
    return window.innerWidth <= 850 || window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

// Re-render the board automatically if the user resizes the window or rotates their device
let wasMobile = isMobileMode();
window.addEventListener('resize', () => {
    const isNowMobile = isMobileMode();
    if (wasMobile !== isNowMobile) {
        wasMobile = isNowMobile;
        if (typeof renderBoard === 'function') renderBoard();
    }
});

// Toggle the settings panel on mobile
function toggleMobileSettings() {
    const controls = document.getElementById('controls');
    if (controls) {
        controls.classList.toggle('mobile-visible');
    }
}

// Optional: Automatically close the mobile settings if the user taps the canvas/board
window.addEventListener('touchstart', (e) => {
    const controls = document.getElementById('controls');
    const settingsBtn = document.getElementById('btn-mobile-settings');
    
    // If we are touching outside the controls AND outside the settings button
    if (controls && controls.classList.contains('mobile-visible')) {
        if (!controls.contains(e.target) && !settingsBtn.contains(e.target)) {
            controls.classList.remove('mobile-visible');
        }
    }
});