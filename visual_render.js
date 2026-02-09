// ==========================================
// VISUAL RENDER: Canvas & Draw Loop
// ==========================================

const canvas = document.getElementById("synthesia-canvas");
const ctx = canvas.getContext("2d", { alpha: true }); 

let resizeTimeout;

// --- INITIALIZATION ---
function initVisualizer() {
    resizeCanvas();
    startVisualizerLoop();
}

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resizeCanvas, 150);
});

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight * 0.83; 
  updateKeyCoordinates();
}

function updateKeyCoordinates() {
  const keys = document.querySelectorAll('.p-key');
  keys.forEach(key => {
    const freq = key.getAttribute('data-note');
    const rect = key.getBoundingClientRect();
    keyCoordinates[freq] = { x: rect.left | 0, width: rect.width | 0 };
  });
}

// --- THE VIEW LOOP ---
function startVisualizerLoop() {
  let lastFrameTime = performance.now();
  const borderStyle = "rgba(255, 255, 255, 0.7)"; 

  function loop(currentTime) {
    const dt = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    if (dt > 0.1) {
        requestAnimationFrame(loop);
        return;
    }

    // 1. UPDATE PHYSICS
    if (typeof updatePhysics === 'function') updatePhysics(dt);

    // 2. CLEAR CANVAS
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 3. CHECK VISUALIZER STATE
    if (!isVisualizerOn) {
        requestAnimationFrame(loop);
        return; 
    }
    
    // --- DRAWING LOGIC (Only runs if isVisualizerOn is true) ---
    ctx.strokeStyle = borderStyle;
    ctx.lineWidth = 2;

    // A. Render Falling Notes
    if (fallingNotes.length > 0) {
        ctx.fillStyle = 'rgb(93, 0, 150)'; 
        ctx.beginPath(); 
        for (let i = 0; i < fallingNotes.length; i++) {
            const note = fallingNotes[i];
            ctx.roundRect(note.x | 0, (note.drawY | 0), note.width | 0, note.height | 0, 4);
        }
        ctx.fill();
        ctx.stroke(); 
    }

    // B. Render Manual Notes
    for (let i = 0; i < visualNotes.length; i++) {
        const note = visualNotes[i];
        ctx.fillStyle = note.color; 
        ctx.beginPath();
        ctx.roundRect(note.x | 0, note.y | 0, note.width | 0, note.height | 0, 7);
        ctx.fill();
        ctx.stroke();
    }
    
    // Particle rendering removed

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}