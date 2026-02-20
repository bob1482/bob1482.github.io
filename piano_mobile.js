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