// ============ GAME STATE ============
const CANVAS_W = 960;
const CANVAS_H = 540;
const GROUND_Y = 460;
const GRAVITY = 0.5;
const MOVE_SPEED = 4;
const JUMP_FORCE = -10;
const MAX_HP = 100;

let myChar = null;       // 'boy' or 'girl'
let gameRunning = false;
let gameOver = false;
let canvas, ctx;

const keys = {};
let lastTime = 0;

// Players
let players = {
    boy: {
        x: 200, y: GROUND_Y, vy: 0, hp: MAX_HP, facing: 1,
        attacking: false, attackCooldown: 0, onGround: true,
        animFrame: 0, animTimer: 0, walkCycle: 0, hitFlash: 0
    },
    girl: {
        x: 700, y: GROUND_Y, vy: 0, hp: MAX_HP, facing: -1,
        attacking: false, attackCooldown: 0, onGround: true,
        animFrame: 0, animTimer: 0, walkCycle: 0, hitFlash: 0
    }
};

let projectiles = [];  // { x, y, vx, vy, owner, type, life }

// ============ CHARACTER PREVIEWS ============
window.addEventListener('load', () => {
    drawPreview('preview-boy', 'boy');
    drawPreview('preview-girl', 'girl');
});

function drawPreview(canvasId, type) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ct = c.getContext('2d');
    ct.clearRect(0, 0, c.width, c.height);
    if (type === 'boy') {
        drawBoy(ct, 80, 160, 1, 0, false, 0);
    } else {
        drawGirl(ct, 80, 160, 1, 0, false, 0);
    }
}

// ============ DRAW BOY (Stick cartoon, bigger head, fires lasers) ============
function drawBoy(ct, x, y, facing, walkCycle, attacking, hitFlash) {
    ct.save();
    ct.translate(x, y);

    // Hit flash effect
    if (hitFlash > 0) {
        ct.globalAlpha = 0.5 + Math.sin(hitFlash * 10) * 0.3;
    }

    const s = facing;

    // Legs (walking animation)
    const legSwing = Math.sin(walkCycle) * 15;
    ct.strokeStyle = '#4ecdc4';
    ct.lineWidth = 4;
    ct.lineCap = 'round';

    // Left leg
    ct.beginPath();
    ct.moveTo(0, -20);
    ct.lineTo(-10 + legSwing, 10);
    ct.lineTo(-12 + legSwing * 0.5, 25);
    ct.stroke();

    // Right leg
    ct.beginPath();
    ct.moveTo(0, -20);
    ct.lineTo(10 - legSwing, 10);
    ct.lineTo(12 - legSwing * 0.5, 25);
    ct.stroke();

    // Shoes
    ct.fillStyle = '#2c3e50';
    ct.beginPath();
    ct.ellipse(-12 + legSwing * 0.5, 27, 8, 4, 0, 0, Math.PI * 2);
    ct.fill();
    ct.beginPath();
    ct.ellipse(12 - legSwing * 0.5, 27, 8, 4, 0, 0, Math.PI * 2);
    ct.fill();

    // Body
    ct.strokeStyle = '#4ecdc4';
    ct.lineWidth = 5;
    ct.beginPath();
    ct.moveTo(0, -20);
    ct.lineTo(0, -55);
    ct.stroke();

    // T-shirt
    ct.fillStyle = '#2ecc71';
    ct.beginPath();
    ct.moveTo(-12, -50);
    ct.lineTo(12, -50);
    ct.lineTo(10, -22);
    ct.lineTo(-10, -22);
    ct.closePath();
    ct.fill();

    // Arms
    ct.strokeStyle = '#4ecdc4';
    ct.lineWidth = 3.5;

    if (attacking) {
        // Both arms forward for laser pose
        ct.beginPath();
        ct.moveTo(0, -48);
        ct.lineTo(s * 25, -55);
        ct.lineTo(s * 40, -52);
        ct.stroke();

        ct.beginPath();
        ct.moveTo(0, -45);
        ct.lineTo(s * 22, -42);
        ct.lineTo(s * 38, -48);
        ct.stroke();
    } else {
        // Normal arms
        const armSwing = Math.sin(walkCycle) * 12;
        ct.beginPath();
        ct.moveTo(0, -48);
        ct.lineTo(-12 - armSwing, -32);
        ct.lineTo(-14 - armSwing * 0.5, -20);
        ct.stroke();

        ct.beginPath();
        ct.moveTo(0, -48);
        ct.lineTo(12 + armSwing, -32);
        ct.lineTo(14 + armSwing * 0.5, -20);
        ct.stroke();
    }

    // Hands
    ct.fillStyle = '#f5c6a0';
    if (attacking) {
        ct.beginPath();
        ct.arc(s * 40, -50, 4, 0, Math.PI * 2);
        ct.fill();
        ct.beginPath();
        ct.arc(s * 38, -47, 4, 0, Math.PI * 2);
        ct.fill();
    }

    // HEAD (bigger!)
    // Neck
    ct.strokeStyle = '#f5c6a0';
    ct.lineWidth = 5;
    ct.beginPath();
    ct.moveTo(0, -55);
    ct.lineTo(0, -62);
    ct.stroke();

    // Head circle
    ct.fillStyle = '#f5c6a0';
    ct.beginPath();
    ct.arc(0, -80, 22, 0, Math.PI * 2);
    ct.fill();

    // Hair (spiky)
    ct.fillStyle = '#2c3e50';
    ct.beginPath();
    ct.moveTo(-20, -85);
    ct.lineTo(-15, -108);
    ct.lineTo(-5, -95);
    ct.lineTo(2, -112);
    ct.lineTo(10, -95);
    ct.lineTo(18, -106);
    ct.lineTo(22, -85);
    ct.arc(0, -82, 22, -0.2, Math.PI + 0.2, true);
    ct.closePath();
    ct.fill();

    // Eyes (with laser glow if attacking)
    const eyeColor = attacking ? '#ff0000' : '#2c3e50';
    ct.fillStyle = eyeColor;
    ct.beginPath();
    ct.ellipse(s * 7, -83, 4, 5, 0, 0, Math.PI * 2);
    ct.fill();
    ct.beginPath();
    ct.ellipse(s * -7, -83, 4, 5, 0, 0, Math.PI * 2);
    ct.fill();

    // Eye whites/pupils
    if (!attacking) {
        ct.fillStyle = '#fff';
        ct.beginPath();
        ct.arc(s * 7, -84, 2, 0, Math.PI * 2);
        ct.fill();
        ct.beginPath();
        ct.arc(s * -7, -84, 2, 0, Math.PI * 2);
        ct.fill();
    } else {
        // Laser glow
        ct.shadowColor = '#ff0000';
        ct.shadowBlur = 15;
        ct.fillStyle = '#ff4444';
        ct.beginPath();
        ct.arc(s * 7, -83, 3, 0, Math.PI * 2);
        ct.fill();
        ct.beginPath();
        ct.arc(s * -7, -83, 3, 0, Math.PI * 2);
        ct.fill();
        ct.shadowBlur = 0;
    }

    // Mouth
    ct.strokeStyle = '#c0392b';
    ct.lineWidth = 2;
    ct.beginPath();
    if (attacking) {
        ct.arc(0, -72, 5, 0, Math.PI);
    } else {
        ct.moveTo(-5, -71);
        ct.quadraticCurveTo(0, -67, 5, -71);
    }
    ct.stroke();

    ct.restore();
}

// ============ DRAW GIRL (Stick cartoon, mic, sonic waves) ============
function drawGirl(ct, x, y, facing, walkCycle, attacking, hitFlash) {
    ct.save();
    ct.translate(x, y);

    if (hitFlash > 0) {
        ct.globalAlpha = 0.5 + Math.sin(hitFlash * 10) * 0.3;
    }

    const s = facing;
    const legSwing = Math.sin(walkCycle) * 15;

    // Legs
    ct.strokeStyle = '#e94560';
    ct.lineWidth = 4;
    ct.lineCap = 'round';

    ct.beginPath();
    ct.moveTo(0, -15);
    ct.lineTo(-10 + legSwing, 10);
    ct.lineTo(-12 + legSwing * 0.5, 25);
    ct.stroke();

    ct.beginPath();
    ct.moveTo(0, -15);
    ct.lineTo(10 - legSwing, 10);
    ct.lineTo(12 - legSwing * 0.5, 25);
    ct.stroke();

    // Cute shoes
    ct.fillStyle = '#e94560';
    ct.beginPath();
    ct.ellipse(-12 + legSwing * 0.5, 27, 7, 4, 0, 0, Math.PI * 2);
    ct.fill();
    ct.beginPath();
    ct.ellipse(12 - legSwing * 0.5, 27, 7, 4, 0, 0, Math.PI * 2);
    ct.fill();

    // Skirt
    ct.fillStyle = '#e94560';
    ct.beginPath();
    ct.moveTo(-14, -20);
    ct.lineTo(14, -20);
    ct.lineTo(18, -8);
    ct.lineTo(-18, -8);
    ct.closePath();
    ct.fill();

    // Body
    ct.strokeStyle = '#e94560';
    ct.lineWidth = 5;
    ct.beginPath();
    ct.moveTo(0, -15);
    ct.lineTo(0, -50);
    ct.stroke();

    // Top
    ct.fillStyle = '#ff6b81';
    ct.beginPath();
    ct.moveTo(-11, -48);
    ct.lineTo(11, -48);
    ct.lineTo(9, -20);
    ct.lineTo(-9, -20);
    ct.closePath();
    ct.fill();

    // Arms
    ct.strokeStyle = '#f5c6a0';
    ct.lineWidth = 3.5;

    if (attacking) {
        // Mic arm forward
        ct.beginPath();
        ct.moveTo(0, -45);
        ct.lineTo(s * 20, -55);
        ct.lineTo(s * 35, -58);
        ct.stroke();

        // Other arm on hip
        ct.beginPath();
        ct.moveTo(0, -42);
        ct.lineTo(s * -15, -30);
        ct.lineTo(s * -12, -22);
        ct.stroke();
    } else {
        // Holding mic casually
        const armSwing = Math.sin(walkCycle) * 10;
        ct.beginPath();
        ct.moveTo(0, -45);
        ct.lineTo(s * 15 + armSwing, -38);
        ct.lineTo(s * 18 + armSwing, -28);
        ct.stroke();

        ct.beginPath();
        ct.moveTo(0, -42);
        ct.lineTo(s * -12 - armSwing, -32);
        ct.lineTo(s * -14 - armSwing, -22);
        ct.stroke();
    }

    // MICROPHONE
    const micX = attacking ? s * 37 : s * 18;
    const micY = attacking ? -60 : -28;
    // Handle
    ct.strokeStyle = '#888';
    ct.lineWidth = 3;
    ct.beginPath();
    ct.moveTo(micX, micY);
    ct.lineTo(micX, micY + 14);
    ct.stroke();
    // Mic head
    ct.fillStyle = '#333';
    ct.beginPath();
    ct.arc(micX, micY, 7, 0, Math.PI * 2);
    ct.fill();
    // Mic grid
    ct.strokeStyle = '#666';
    ct.lineWidth = 0.8;
    for (let i = -4; i <= 4; i += 2) {
        ct.beginPath();
        ct.moveTo(micX - 5, micY + i);
        ct.lineTo(micX + 5, micY + i);
        ct.stroke();
    }

    // Mic glow when attacking
    if (attacking) {
        ct.shadowColor = '#ff6b81';
        ct.shadowBlur = 20;
        ct.strokeStyle = '#ff6b81';
        ct.lineWidth = 2;
        ct.beginPath();
        ct.arc(micX, micY, 10, 0, Math.PI * 2);
        ct.stroke();
        ct.shadowBlur = 0;
    }

    // Neck
    ct.strokeStyle = '#f5c6a0';
    ct.lineWidth = 4;
    ct.beginPath();
    ct.moveTo(0, -50);
    ct.lineTo(0, -58);
    ct.stroke();

    // HEAD
    ct.fillStyle = '#f5c6a0';
    ct.beginPath();
    ct.arc(0, -76, 22, 0, Math.PI * 2);
    ct.fill();

    // Hair (long, flowing)
    ct.fillStyle = '#e17055';
    // Main hair
    ct.beginPath();
    ct.arc(0, -78, 24, Math.PI, 0, false);
    ct.lineTo(22, -60);
    ct.quadraticCurveTo(26, -40, 20 + Math.sin(walkCycle * 0.5) * 3, -30);
    ct.lineTo(16, -55);
    ct.lineTo(0, -54);
    ct.lineTo(-16, -55);
    ct.lineTo(-20 - Math.sin(walkCycle * 0.5) * 3, -30);
    ct.quadraticCurveTo(-26, -40, -22, -60);
    ct.closePath();
    ct.fill();

    // Bangs
    ct.beginPath();
    ct.moveTo(-20, -85);
    ct.quadraticCurveTo(-10, -105, 0, -100);
    ct.quadraticCurveTo(10, -105, 20, -85);
    ct.arc(0, -78, 24, -0.3, Math.PI + 0.3, true);
    ct.closePath();
    ct.fill();

    // Eyes
    ct.fillStyle = '#2c3e50';
    ct.beginPath();
    ct.ellipse(s * 7, -79, 4, 5, 0, 0, Math.PI * 2);
    ct.fill();
    ct.beginPath();
    ct.ellipse(s * -7, -79, 4, 5, 0, 0, Math.PI * 2);
    ct.fill();

    // Eye sparkle
    ct.fillStyle = '#fff';
    ct.beginPath();
    ct.arc(s * 8, -80, 2, 0, Math.PI * 2);
    ct.fill();
    ct.beginPath();
    ct.arc(s * -6, -80, 2, 0, Math.PI * 2);
    ct.fill();

    // Eyelashes
    ct.strokeStyle = '#2c3e50';
    ct.lineWidth = 1.5;
    ct.beginPath();
    ct.moveTo(s * 11, -82);
    ct.lineTo(s * 14, -85);
    ct.stroke();
    ct.beginPath();
    ct.moveTo(s * -3, -82);
    ct.lineTo(s * -6, -85);
    ct.stroke();

    // Blush
    ct.fillStyle = 'rgba(255, 107, 129, 0.3)';
    ct.beginPath();
    ct.ellipse(-13, -73, 5, 3, 0, 0, Math.PI * 2);
    ct.fill();
    ct.beginPath();
    ct.ellipse(13, -73, 5, 3, 0, 0, Math.PI * 2);
    ct.fill();

    // Mouth
    ct.strokeStyle = '#e94560';
    ct.lineWidth = 2;
    ct.beginPath();
    if (attacking) {
        // Singing/shouting mouth
        ct.fillStyle = '#c0392b';
        ct.beginPath();
        ct.ellipse(0, -68, 6, 7, 0, 0, Math.PI * 2);
        ct.fill();
        ct.fillStyle = '#fff';
        ct.beginPath();
        ct.rect(-3, -73, 6, 3);
        ct.fill();
    } else {
        ct.moveTo(-5, -68);
        ct.quadraticCurveTo(0, -63, 5, -68);
        ct.stroke();
    }

    // Hair bow
    ct.fillStyle = '#e94560';
    ct.beginPath();
    ct.moveTo(s * 15, -95);
    ct.quadraticCurveTo(s * 22, -105, s * 15, -100);
    ct.quadraticCurveTo(s * 15, -97, s * 8, -100);
    ct.quadraticCurveTo(s * 8, -105, s * 15, -95);
    ct.fill();

    ct.restore();
}

// ============ PROJECTILES ============
function drawProjectiles(ct) {
    for (const p of projectiles) {
        ct.save();
        if (p.type === 'laser') {
            // Red laser beam
            ct.shadowColor = '#ff0000';
            ct.shadowBlur = 12;
            ct.strokeStyle = '#ff0000';
            ct.lineWidth = 4;
            ct.beginPath();
            ct.moveTo(p.x, p.y);
            ct.lineTo(p.x - p.vx * 3, p.y);
            ct.stroke();

            ct.strokeStyle = '#ff6666';
            ct.lineWidth = 2;
            ct.beginPath();
            ct.moveTo(p.x, p.y);
            ct.lineTo(p.x - p.vx * 3, p.y);
            ct.stroke();

            // Glow tip
            ct.fillStyle = '#fff';
            ct.beginPath();
            ct.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ct.fill();
        } else if (p.type === 'sonic') {
            // Sonic wave rings
            ct.strokeStyle = `rgba(233, 69, 96, ${0.8 - p.life * 0.01})`;
            ct.lineWidth = 3;
            const radius = 8 + p.life * 0.5;
            ct.beginPath();
            ct.arc(p.x, p.y, radius, -Math.PI * 0.4, Math.PI * 0.4);
            ct.stroke();

            ct.strokeStyle = `rgba(255, 107, 129, ${0.6 - p.life * 0.01})`;
            ct.lineWidth = 2;
            ct.beginPath();
            ct.arc(p.x, p.y, radius + 6, -Math.PI * 0.3, Math.PI * 0.3);
            ct.stroke();

            // Music notes
            ct.fillStyle = `rgba(233, 69, 96, ${0.7 - p.life * 0.01})`;
            ct.font = '16px serif';
            ct.fillText('♪', p.x + Math.sin(p.life * 0.2) * 10, p.y - 12 + Math.cos(p.life * 0.3) * 5);
            ct.font = '12px serif';
            ct.fillText('♫', p.x - 5 + Math.cos(p.life * 0.15) * 8, p.y + 10 + Math.sin(p.life * 0.25) * 5);
        }
        ct.restore();
    }
}

// ============ DRAW BACKGROUND ============
function drawBackground(ct) {
    // Sky gradient
    const grad = ct.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1a1a3e');
    grad.addColorStop(0.6, '#2d1b4e');
    grad.addColorStop(1, '#0f3460');
    ct.fillStyle = grad;
    ct.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Stars
    ct.fillStyle = '#fff';
    const starSeed = [23, 67, 134, 200, 290, 370, 450, 520, 600, 700, 780, 850, 910, 45, 160, 310, 680, 740];
    for (let i = 0; i < starSeed.length; i++) {
        const sx = starSeed[i];
        const sy = (sx * 37 + i * 53) % 300;
        const sr = (i % 3 === 0) ? 2 : 1;
        ct.globalAlpha = 0.5 + Math.sin(Date.now() * 0.002 + i) * 0.3;
        ct.beginPath();
        ct.arc(sx, sy, sr, 0, Math.PI * 2);
        ct.fill();
    }
    ct.globalAlpha = 1;

    // Stage/ground
    ct.fillStyle = '#1a0a2e';
    ct.fillRect(0, GROUND_Y + 25, CANVAS_W, CANVAS_H - GROUND_Y);

    // Stage platform
    const stageGrad = ct.createLinearGradient(0, GROUND_Y + 10, 0, GROUND_Y + 30);
    stageGrad.addColorStop(0, '#2d1b4e');
    stageGrad.addColorStop(1, '#1a0a2e');
    ct.fillStyle = stageGrad;
    ct.fillRect(50, GROUND_Y + 20, CANVAS_W - 100, 25);

    // Stage edge highlight
    ct.strokeStyle = '#e94560';
    ct.lineWidth = 2;
    ct.shadowColor = '#e94560';
    ct.shadowBlur = 10;
    ct.beginPath();
    ct.moveTo(50, GROUND_Y + 22);
    ct.lineTo(CANVAS_W - 50, GROUND_Y + 22);
    ct.stroke();
    ct.shadowBlur = 0;

    // Spotlights
    ct.save();
    ct.globalAlpha = 0.06;
    ct.fillStyle = '#e94560';
    ct.beginPath();
    ct.moveTo(200, 0);
    ct.lineTo(100, GROUND_Y + 25);
    ct.lineTo(300, GROUND_Y + 25);
    ct.closePath();
    ct.fill();

    ct.fillStyle = '#4ecdc4';
    ct.beginPath();
    ct.moveTo(760, 0);
    ct.lineTo(660, GROUND_Y + 25);
    ct.lineTo(860, GROUND_Y + 25);
    ct.closePath();
    ct.fill();
    ct.restore();
}

// ============ GAME INIT ============
function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    resetPlayers();

    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        if (e.key === ' ') e.preventDefault();
    });
    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });
}

function resetPlayers() {
    players.boy = {
        x: 200, y: GROUND_Y, vy: 0, hp: MAX_HP, facing: 1,
        attacking: false, attackCooldown: 0, onGround: true,
        animFrame: 0, animTimer: 0, walkCycle: 0, hitFlash: 0
    };
    players.girl = {
        x: 700, y: GROUND_Y, vy: 0, hp: MAX_HP, facing: -1,
        attacking: false, attackCooldown: 0, onGround: true,
        animFrame: 0, animTimer: 0, walkCycle: 0, hitFlash: 0
    };
    projectiles = [];
    gameOver = false;
    document.getElementById('game-over').classList.add('hidden');
}

// ============ LOCAL INPUT ============
function processLocalInput() {
    if (!myChar || gameOver) return;

    const me = players[myChar];
    let moved = false;

    if (keys['a'] || keys['arrowleft']) {
        me.x -= MOVE_SPEED;
        me.facing = -1;
        moved = true;
    }
    if (keys['d'] || keys['arrowright']) {
        me.x += MOVE_SPEED;
        me.facing = 1;
        moved = true;
    }
    if ((keys['w'] || keys['arrowup']) && me.onGround) {
        me.vy = JUMP_FORCE;
        me.onGround = false;
    }

    if (moved) {
        me.walkCycle += 0.15;
    }

    // Attack
    if (keys[' '] && me.attackCooldown <= 0) {
        me.attacking = true;
        me.attackCooldown = 25;
        fireProjectile(myChar);
    }

    // Clamp position
    me.x = Math.max(30, Math.min(CANVAS_W - 30, me.x));
}

function fireProjectile(charType) {
    const p = players[charType];
    if (charType === 'boy') {
        projectiles.push({
            x: p.x + p.facing * 15, y: p.y - 83,
            vx: p.facing * 10, vy: 0,
            owner: 'boy', type: 'laser', life: 0, damage: 8
        });
    } else {
        projectiles.push({
            x: p.x + p.facing * 37, y: p.y - 60,
            vx: p.facing * 7, vy: 0,
            owner: 'girl', type: 'sonic', life: 0, damage: 10
        });
    }
}

// ============ PHYSICS & COLLISION ============
function updatePhysics() {
    for (const key of ['boy', 'girl']) {
        const p = players[key];

        // Gravity
        if (!p.onGround) {
            p.vy += GRAVITY;
            p.y += p.vy;
            if (p.y >= GROUND_Y) {
                p.y = GROUND_Y;
                p.vy = 0;
                p.onGround = true;
            }
        }

        // Cooldowns
        if (p.attackCooldown > 0) p.attackCooldown--;
        if (p.attackCooldown <= 20) p.attacking = false;
        if (p.hitFlash > 0) p.hitFlash -= 0.1;
    }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const pr = projectiles[i];
        pr.x += pr.vx;
        pr.y += pr.vy;
        pr.life++;

        // Check hit
        const target = pr.owner === 'boy' ? 'girl' : 'boy';
        const t = players[target];
        const dx = pr.x - t.x;
        const dy = pr.y - (t.y - 50);
        const hitRadius = pr.type === 'sonic' ? 30 : 20;

        if (Math.abs(dx) < hitRadius && Math.abs(dy) < 50) {
            t.hp = Math.max(0, t.hp - pr.damage);
            t.hitFlash = 1;
            projectiles.splice(i, 1);
            continue;
        }

        // Remove if off screen or old
        if (pr.x < -50 || pr.x > CANVAS_W + 50 || pr.life > 80) {
            projectiles.splice(i, 1);
        }
    }

    // Check game over
    if (players.boy.hp <= 0 && !gameOver) {
        endGame('MIC GIRL WINS!');
    } else if (players.girl.hp <= 0 && !gameOver) {
        endGame('LASER BOY WINS!');
    }
}

function endGame(text) {
    gameOver = true;
    document.getElementById('winner-text').textContent = text;
    document.getElementById('game-over').classList.remove('hidden');
}

// restartGame is defined in multiplayer.js

// ============ HUD UPDATE ============
function updateHUD() {
    const boyHP = players.boy.hp;
    const girlHP = players.girl.hp;

    document.getElementById('p1-health').style.width = boyHP + '%';
    document.getElementById('p1-hp').textContent = Math.ceil(boyHP);
    document.getElementById('p2-health').style.width = girlHP + '%';
    document.getElementById('p2-hp').textContent = Math.ceil(girlHP);
}

// ============ GAME LOOP ============
function gameLoop(timestamp) {
    if (!gameRunning) return;

    const dt = timestamp - lastTime;
    lastTime = timestamp;

    processLocalInput();
    updatePhysics();
    updateHUD();

    // Send state to peer
    sendState();

    // Render
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawBackground(ctx);

    drawBoy(ctx, players.boy.x, players.boy.y, players.boy.facing,
        players.boy.walkCycle, players.boy.attacking, players.boy.hitFlash);

    drawGirl(ctx, players.girl.x, players.girl.y, players.girl.facing,
        players.girl.walkCycle, players.girl.attacking, players.girl.hitFlash);

    drawProjectiles(ctx);

    requestAnimationFrame(gameLoop);
}

function startGameLoop() {
    gameRunning = true;
    lastTime = performance.now();
    document.getElementById('selection-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    initGame();
    requestAnimationFrame(gameLoop);
}
