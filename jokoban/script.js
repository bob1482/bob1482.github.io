// ===== CONSTANTS =====
const maxLevel = 5;
const size = 128;
let c = 0;    // current move index
let lv = 0;   // current level
const picdif = 5;
const pic = "abcdeABCDE";
const wasd = "DSAW";
const arrowKeys = "RDLU";
const good = ["W","A","S","D","P","N","Z","R","Right","Down","Left","Up"];

// Direction vectors: Right, Down, Left, Up
const dir = [[0,1],[1,0],[0,-1],[-1,0]];

// Player starting positions: [p1row,p1col, p2row,p2col, p3row,p3col]
const playerStarts = [
    [4,2,4,7,4,2],
    [2,2,7,7,2,2],
    [2,2,7,7,2,2],
    [2,2,2,7,7,7],
    [4,4,2,7,4,5]
];

// Level maps
const mapspace = [
    [
        "aaaaaaaaaa",
        "aaaaaaaaaa",
        "aaaaaaaaaa",
        "aaaaaaaaaa",
        "aaaaddacaa",
        "aaaaaaaaaa",
        "aaaaaaaaaa",
        "aaaaaaaaaa",
        "aaaaaaaaaa",
        "aaaaaaaaaa"
    ],
    [
        "aaaaaaaaaa",
        "aaaaaaaaaa",
        "aadaaaadaa",
        "aaaaaaaaaa",
        "aaaacaaaaa",
        "AAAAACAAAA",
        "AAAAAAAAAA",
        "AADAAAAAAA",
        "AAAAAAAAAA",
        "AAAAAAAAAA"
    ],
    [
        "aaaaaaaaaa",
        "adaaaaaaca",
        "aaCAAAAAaa",
        "aaAAAAAAaa",
        "aaAAcaAAaa",
        "aaAAadAAaa",
        "aaAAAAAAaa",
        "aaAAAAAAaa",
        "acaaaaaada",
        "aaaaaaaaaa"
    ],
    [
        "aaaaaAAAAA",
        "aaacaAAAAA",
        "aaaaaAADAA",
        "acaaaAAAAA",
        "aaaaaAAAAA",
        "AAAAAaaaaa",
        "AAAAAaaada",
        "AACAAaaaaa",
        "AAAAAadaaa",
        "AAAAAaaaaa"
    ],
    [
        "aaaaaaaaAA",
        "aaaaaaaaaA",
        "aaDAAAAAaa",
        "aaaaaaaaaa",
        "aadeddedaa",
        "aaaaaaaaaa",
        "aacAAAAcaa",
        "aaACAACAaa",
        "Aaaaaaaaaa",
        "AAaaaaaaaa"
    ]
];

// ===== STATE =====
let maptime = [];
let p1 = [];
let p2 = [];
let p3 = [];
let complete = false;
let pressed = true;
let clicked = true;

// ===== DOM REFS =====
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
// ===== IMAGE LOADING =====
const images = {};
const imageFiles = [];
for (let i = 0; i <= 9; i++) imageFiles.push(i + '.png');

let imagesLoaded = 0;

function loadImages(callback) {
    let total = imageFiles.length;
    imageFiles.forEach(f => {
        const img = new Image();
        img.onload = () => {
            imagesLoaded++;
            if (imagesLoaded >= total && callback) callback();
        };
        img.onerror = () => {
            imagesLoaded++;
            if (imagesLoaded >= total && callback) callback();
        };
        img.src = 'assets/' + f;
        images[f] = img;
    });
}

// ===== SOUND =====
let sfxAudio = null;

function initAudio() {
    sfxAudio = new Audio();
    sfxAudio.volume = 0.7;
}

function playSfx(file) {
    if (!clicked) return;
    sfxAudio.src = 'assets/' + file;
    sfxAudio.currentTime = 0;
    sfxAudio.play().catch(() => {});
}

// ===== GAME LOGIC =====

function startLevel() {
    c = 0;
    maptime = [];
    maptime[0] = mapspace[lv].slice();

    p1 = []; p2 = []; p3 = [];
    p1[0] = [playerStarts[lv][0], playerStarts[lv][1]];
    p2[0] = [playerStarts[lv][2], playerStarts[lv][3]];
    p3[0] = [playerStarts[lv][4], playerStarts[lv][5]];

    render();
}

function nextMove() {
    c++;
    maptime[c] = maptime[c - 1].slice();
    p1[c] = [p1[c - 1][0], p1[c - 1][1]];
    p2[c] = [p2[c - 1][0], p2[c - 1][1]];
    p3[c] = [p3[c - 1][0], p3[c - 1][1]];
}

function valid(keyIdx, mult, playerArr) {
    let a = playerArr[c][0] + mult * dir[keyIdx][0];
    let b = playerArr[c][1] + mult * dir[keyIdx][1];
    return !(a > 9 || a < 0 || b > 9 || b < 0);
}

function replaceFn(keyIdx, a, b, playerArr) {
    let row2 = dir[keyIdx][0] * 2 + playerArr[c][0];
    let col2 = dir[keyIdx][1] * 2 + playerArr[c][1];
    let row1 = dir[keyIdx][0] + playerArr[c][0];
    let col1 = dir[keyIdx][1] + playerArr[c][1];

    let carray = maptime[c][row2].split('');
    carray[col2] = a;
    maptime[c][row2] = carray.join('');

    carray = maptime[c][row1].split('');
    carray[col1] = b;
    maptime[c][row1] = carray.join('');

    playerArr[c][0] += dir[keyIdx][0];
    playerArr[c][1] += dir[keyIdx][1];
}

function moving(keyIdx, playerArr) {
    let row1 = dir[keyIdx][0] + playerArr[c][0];
    let col1 = dir[keyIdx][1] + playerArr[c][1];
    let move1 = maptime[c][row1].charAt(col1);

    if (move1 === pic.charAt(0) || move1 === pic.charAt(3) ||
        move1 === pic.charAt(2 + picdif) || move1 === pic.charAt(4 + picdif)) {
        playerArr[c][0] += dir[keyIdx][0];
        playerArr[c][1] += dir[keyIdx][1];
    }

    if (valid(keyIdx, 2, playerArr)) {
        let row2 = dir[keyIdx][0] * 2 + playerArr[c][0];
        let col2 = dir[keyIdx][1] * 2 + playerArr[c][1];
        let move2 = maptime[c][row2].charAt(col2);

        if (move1 === pic.charAt(2)) {
            if (move2 === pic.charAt(0))
                replaceFn(keyIdx, pic.charAt(2), pic.charAt(0), playerArr);
            if (move2 === pic.charAt(3))
                replaceFn(keyIdx, pic.charAt(4), pic.charAt(0), playerArr);
        }
        if (move1 === pic.charAt(4)) {
            if (move2 === pic.charAt(0))
                replaceFn(keyIdx, pic.charAt(2), pic.charAt(3), playerArr);
            if (move2 === pic.charAt(3))
                replaceFn(keyIdx, pic.charAt(4), pic.charAt(3), playerArr);
        }
        if (playerArr[c][0] === p2[c][0] && playerArr[c][1] === p2[c][1]) {
            p2[c][0] += dir[keyIdx][0];
            p2[c][1] += dir[keyIdx][1];
        }
    }
}

function handleKeyPress(keyName) {
    if (!good.includes(keyName)) return;

    switch (keyName) {
        case "N":
            if (lv < maxLevel - 1) {
                lv++;
                startLevel();
            }
            return;
        case "P":
            if (lv > 0) {
                lv--;
                startLevel();
            }
            return;
        case "Z":
            if (c > 0) {
                c--;
                render();
            }
            return;
        case "R":
            startLevel();
            return;
    }

    // Movement keys
    let key3 = wasd.indexOf(keyName.charAt(0));
    let key4 = arrowKeys.indexOf(keyName.charAt(0));

    nextMove();

    if (keyName.length === 1) {
        if (valid(key3, 1, p1)) moving(key3, p1);
        if (valid(key3, 1, p3)) moving(key3, p3);
    } else {
        if (valid(key4, 1, p2)) {
            let row1 = dir[key4][0] + p2[c][0];
            let col1 = dir[key4][1] + p2[c][1];
            let move1 = maptime[c][row1].charAt(col1);

            if (move1 === pic.charAt(picdif) || move1 === pic.charAt(3 + picdif) ||
                move1 === pic.charAt(2) || move1 === pic.charAt(4)) {
                p2[c][0] += dir[key4][0];
                p2[c][1] += dir[key4][1];
            }

            if (valid(key4, 2, p2)) {
                let row2 = dir[key4][0] * 2 + p2[c][0];
                let col2 = dir[key4][1] * 2 + p2[c][1];
                let move2 = maptime[c][row2].charAt(col2);

                if (move1 === pic.charAt(2 + picdif)) {
                    if (move2 === pic.charAt(picdif))
                        replaceFn(key4, pic.charAt(2 + picdif), pic.charAt(picdif), p2);
                    if (move2 === pic.charAt(3 + picdif))
                        replaceFn(key4, pic.charAt(4 + picdif), pic.charAt(picdif), p2);
                }
                if (move1 === pic.charAt(4 + picdif)) {
                    if (move2 === pic.charAt(picdif))
                        replaceFn(key4, pic.charAt(2 + picdif), pic.charAt(3 + picdif), p2);
                    if (move2 === pic.charAt(3 + picdif))
                        replaceFn(key4, pic.charAt(4 + picdif), pic.charAt(3 + picdif), p2);
                }
                if (p1[c][0] === p2[c][0] && p1[c][1] === p2[c][1]) {
                    p1[c][0] += dir[key4][0];
                    p1[c][1] += dir[key4][1];
                }
                if (p3[c][0] === p2[c][0] && p3[c][1] === p2[c][1]) {
                    p3[c][0] += dir[key4][0];
                    p3[c][1] += dir[key4][1];
                }
            }
        }
    }

    // Check completion
    complete = true;
    for (let i = 0; i < 100; i++) {
        let row = Math.floor(i / 10);
        let col = i % 10;
        let ch = maptime[c][row].charAt(col);
        if (ch === pic.charAt(3) || ch === pic.charAt(3 + picdif)) {
            if (!((p1[c][0] === row && p1[c][1] === col) ||
                  (p2[c][0] === row && p2[c][1] === col) ||
                  (p3[c][0] === row && p3[c][1] === col))) {
                complete = false;
            }
        }
    }

    render();

    if (complete) {
        if (clicked) playSfx('win.wav');
        if (lv < maxLevel - 1) {
            setTimeout(() => {
                lv++;
                startLevel();
            }, 1000);
        }
    }
}

// ===== RENDERING =====

function render() {
    ctx.clearRect(0, 0, 1280, 1280);

    for (let i = 0; i < 100; i++) {
        let row = Math.floor(i / 10);
        let col = i % 10;
        let ch = maptime[c][row].charAt(col);
        let idx = pic.indexOf(ch);
        let imgName = idx + '.png';
        let img = images[imgName];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, col * size, row * size, size, size);
        } else {
            ctx.fillStyle = idx < 5 ? '#444' : '#885';
            ctx.fillRect(col * size, row * size, size, size);
        }
    }

    drawChar(p1[c][0], p1[c][1], '1.png');
    drawChar(p2[c][0], p2[c][1], '6.png');
    drawChar(p3[c][0], p3[c][1], '1.png');
}

function drawChar(row, col, imgName) {
    let img = images[imgName];
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, col * size, row * size, size, size);
    }
}

// ===== INPUT HANDLING =====

const keyMap = {
    'w': 'W', 'a': 'A', 's': 'S', 'd': 'D',
    'W': 'W', 'A': 'A', 'S': 'S', 'D': 'D',
    'p': 'P', 'P': 'P',
    'n': 'N', 'N': 'N',
    'z': 'Z', 'Z': 'Z',
    'r': 'R', 'R': 'R',
    'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right'
};

document.addEventListener('keydown', (e) => {
    let keyName = keyMap[e.key] || null;
    if (!keyName) return;
    e.preventDefault();

    if (!pressed) return;

    pressed = false;
    handleKeyPress(keyName);
});

document.addEventListener('keyup', (e) => {
    let keyName = keyMap[e.key] || null;
    if (!keyName) return;
    e.preventDefault();
    pressed = true;
});

// ===== INITIALIZATION =====

function init() {
    initAudio();
    loadImages(() => {
        startLevel();
    });
}

init();