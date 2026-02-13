// ============ PRELOAD IMAGES ============
const gameImages = {};
function preloadImages() {
    const imgList = {
        girlSassy: 'images/girl_sassy_mix_cute_image.jpeg',
        girlShades: 'images/girl_sassy_image_in_shades.jpeg',
        couple1: 'images/couple_image.jpeg',
        couple2: 'images/couple_image_2.jpeg'
    };
    for (const [key, src] of Object.entries(imgList)) {
        const img = new Image();
        img.src = src;
        gameImages[key] = img;
    }
}
preloadImages();

// Helper: draw image in a rounded frame with border
function drawFramedImage(ct, img, x, y, w, h, borderColor, borderWidth, radius) {
    if (!img || !img.complete || !img.naturalWidth) return;
    ct.save();
    ct.beginPath(); ct.roundRect(x, y, w, h, radius || 10); ct.clip();
    // Cover-fit the image
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = w / h;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (imgRatio > boxRatio) { sw = img.naturalHeight * boxRatio; sx = (img.naturalWidth - sw) / 2; }
    else { sh = img.naturalWidth / boxRatio; sy = (img.naturalHeight - sh) / 2; }
    ct.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ct.restore();
    // Border
    if (borderColor) {
        ct.strokeStyle = borderColor; ct.lineWidth = borderWidth || 3;
        ct.beginPath(); ct.roundRect(x, y, w, h, radius || 10); ct.stroke();
    }
}

// ============ GAME STATE ============
const CANVAS_W = 960;
const CANVAS_H = 540;
const GROUND_Y = 460;
const GRAVITY = 0.5;
const MOVE_SPEED = 4;
const JUMP_FORCE = -10;
const MAX_HP = 150;          // more HP = longer game
const MAX_SUPER = 100;
const SUPER_FILL_RATE = 0.18;
const DODGE_SPEED = 12;
const DODGE_DURATION = 10;
const DODGE_COOLDOWN = 45;

let myChar = null;
let gameRunning = false;
let gameOver = false;
let canvas, ctx;
const keys = {};
let lastTime = 0;
let screenShake = 0;
let hitParticles = [];
let idleTimer = 0;
let endSequencePhase = 0; // 0=none, 1=sassy msg, 2=drag anim, 3=proposal, 4=no-escape
let endSequenceTimer = 0;
let noButtonPos = { x: 0, y: 0 };

let players = { boy: null, girl: null };
let projectiles = [];

// Floating platform state — one per character
const PLAT_W = 130;
const PLAT_H = 16;
const PLAT_SPEED = 0.5;
const PLAT_FRICTION = 0.92;
const PLAT_BOUNDS = { minX: 80, maxX: CANVAS_W - 80, minY: 60, maxY: CANVAS_H - 60 };
let platformBoy = { x: CANVAS_W / 3, y: CANVAS_H / 2, vx: 0, vy: 0, w: PLAT_W, h: PLAT_H };
let platformGirl = { x: (CANVAS_W / 3) * 2, y: CANVAS_H / 2, vx: 0, vy: 0, w: PLAT_W, h: PLAT_H };

function makePlayer(x, facing) {
    return {
        x: x, y: GROUND_Y, vy: 0, hp: MAX_HP, facing: facing,
        attacking: false, attackCooldown: 0, onGround: true,
        walkCycle: 0, hitFlash: 0,
        superPower: 0, superReady: false, usingSuperAnim: 0,
        dodging: false, dodgeTimer: 0, dodgeCooldown: 0, dodgeDir: 0,
        invincible: false
    };
}

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
    if (type === 'boy') drawBoy(ct, 80, 160, 1, 0, false, 0, false);
    else drawGirl(ct, 80, 160, 1, 0, false, 0, false, 0);
}

// ============ DRAW BOY ============
function drawBoy(ct, x, y, facing, walkCycle, attacking, hitFlash, kissMode) {
    ct.save();
    ct.translate(x, y);
    if (hitFlash > 0) ct.globalAlpha = 0.5 + Math.sin(hitFlash * 10) * 0.3;
    const s = facing;
    const legSwing = Math.sin(walkCycle) * 15;

    ct.strokeStyle = '#4ecdc4'; ct.lineWidth = 4; ct.lineCap = 'round';
    ct.beginPath(); ct.moveTo(0, -20); ct.lineTo(-10 + legSwing, 10); ct.lineTo(-12 + legSwing * 0.5, 25); ct.stroke();
    ct.beginPath(); ct.moveTo(0, -20); ct.lineTo(10 - legSwing, 10); ct.lineTo(12 - legSwing * 0.5, 25); ct.stroke();
    ct.fillStyle = '#2c3e50';
    ct.beginPath(); ct.ellipse(-12 + legSwing * 0.5, 27, 8, 4, 0, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.ellipse(12 - legSwing * 0.5, 27, 8, 4, 0, 0, Math.PI * 2); ct.fill();
    ct.strokeStyle = '#4ecdc4'; ct.lineWidth = 5;
    ct.beginPath(); ct.moveTo(0, -20); ct.lineTo(0, -55); ct.stroke();
    ct.fillStyle = '#2ecc71';
    ct.beginPath(); ct.moveTo(-12, -50); ct.lineTo(12, -50); ct.lineTo(10, -22); ct.lineTo(-10, -22); ct.closePath(); ct.fill();

    ct.strokeStyle = '#4ecdc4'; ct.lineWidth = 3.5;
    if (kissMode) {
        ct.beginPath(); ct.moveTo(0, -48); ct.lineTo(s * 18, -50); ct.lineTo(s * 28, -60); ct.stroke();
        ct.beginPath(); ct.moveTo(0, -45); ct.lineTo(s * -15, -35); ct.lineTo(s * -18, -25); ct.stroke();
        ct.fillStyle = '#f5c6a0';
        ct.beginPath(); ct.arc(s * 28, -62, 5, 0, Math.PI * 2); ct.fill();
    } else if (attacking) {
        ct.beginPath(); ct.moveTo(0, -48); ct.lineTo(s * 25, -55); ct.lineTo(s * 40, -52); ct.stroke();
        ct.beginPath(); ct.moveTo(0, -45); ct.lineTo(s * 22, -42); ct.lineTo(s * 38, -48); ct.stroke();
        ct.fillStyle = '#f5c6a0';
        ct.beginPath(); ct.arc(s * 40, -50, 4, 0, Math.PI * 2); ct.fill();
    } else {
        const armSwing = Math.sin(walkCycle) * 12;
        ct.beginPath(); ct.moveTo(0, -48); ct.lineTo(-12 - armSwing, -32); ct.lineTo(-14 - armSwing * 0.5, -20); ct.stroke();
        ct.beginPath(); ct.moveTo(0, -48); ct.lineTo(12 + armSwing, -32); ct.lineTo(14 + armSwing * 0.5, -20); ct.stroke();
    }

    ct.strokeStyle = '#f5c6a0'; ct.lineWidth = 5;
    ct.beginPath(); ct.moveTo(0, -55); ct.lineTo(0, -62); ct.stroke();
    ct.fillStyle = '#f5c6a0';
    ct.beginPath(); ct.arc(0, -80, 22, 0, Math.PI * 2); ct.fill();
    ct.fillStyle = '#2c3e50';
    ct.beginPath();
    ct.moveTo(-20, -85); ct.lineTo(-15, -108); ct.lineTo(-5, -95); ct.lineTo(2, -112);
    ct.lineTo(10, -95); ct.lineTo(18, -106); ct.lineTo(22, -85);
    ct.arc(0, -82, 22, -0.2, Math.PI + 0.2, true); ct.closePath(); ct.fill();

    if (kissMode) {
        ct.fillStyle = '#2c3e50';
        ct.beginPath(); ct.ellipse(s * 7, -83, 4, 5, 0, 0, Math.PI * 2); ct.fill();
        ct.strokeStyle = '#2c3e50'; ct.lineWidth = 2;
        ct.beginPath(); ct.moveTo(s * -10, -83); ct.lineTo(s * -4, -83); ct.stroke();
        ct.fillStyle = '#e94560'; ct.font = '10px serif';
        ct.fillText('\u2764', s * 12, -90);
    } else {
        const ec = attacking ? '#ff0000' : '#2c3e50';
        ct.fillStyle = ec;
        ct.beginPath(); ct.ellipse(s * 7, -83, 4, 5, 0, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.ellipse(s * -7, -83, 4, 5, 0, 0, Math.PI * 2); ct.fill();
        if (!attacking) {
            ct.fillStyle = '#fff';
            ct.beginPath(); ct.arc(s * 7, -84, 2, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(s * -7, -84, 2, 0, Math.PI * 2); ct.fill();
        } else {
            ct.shadowColor = '#ff0000'; ct.shadowBlur = 15; ct.fillStyle = '#ff4444';
            ct.beginPath(); ct.arc(s * 7, -83, 3, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(s * -7, -83, 3, 0, Math.PI * 2); ct.fill();
            ct.shadowBlur = 0;
        }
    }
    ct.strokeStyle = '#c0392b'; ct.lineWidth = 2;
    if (kissMode) {
        ct.fillStyle = '#e94560';
        ct.beginPath(); ct.arc(s * 5, -71, 4, 0, Math.PI * 2); ct.fill();
        ct.fillStyle = '#ff6b81';
        ct.beginPath(); ct.arc(s * 5, -70, 2.5, 0, Math.PI * 2); ct.fill();
    } else if (attacking) {
        ct.beginPath(); ct.arc(0, -72, 5, 0, Math.PI); ct.stroke();
    } else {
        ct.beginPath(); ct.moveTo(-5, -71); ct.quadraticCurveTo(0, -67, 5, -71); ct.stroke();
    }
    ct.restore();
}

// ============ DRAW GIRL ============
function drawGirl(ct, x, y, facing, walkCycle, attacking, hitFlash, sonicBoom, idleTm) {
    ct.save();
    ct.translate(x, y);
    if (hitFlash > 0) ct.globalAlpha = 0.5 + Math.sin(hitFlash * 10) * 0.3;
    const s = facing;
    const legSwing = Math.sin(walkCycle) * 15;
    const it = idleTm || 0;
    const hipTilt = attacking ? 0 : Math.sin(it * 0.05) * 2;

    ct.strokeStyle = '#e94560'; ct.lineWidth = 4; ct.lineCap = 'round';
    ct.beginPath(); ct.moveTo(-2 + hipTilt, -15); ct.lineTo(-10 + legSwing, 10); ct.lineTo(-12 + legSwing * 0.5, 25); ct.stroke();
    ct.beginPath(); ct.moveTo(2 + hipTilt, -15); ct.lineTo(10 - legSwing, 10); ct.lineTo(12 - legSwing * 0.5, 25); ct.stroke();
    ct.fillStyle = '#e94560';
    ct.beginPath(); ct.ellipse(-12 + legSwing * 0.5, 27, 7, 4, 0, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.ellipse(12 - legSwing * 0.5, 27, 7, 4, 0, 0, Math.PI * 2); ct.fill();
    ct.fillStyle = '#e94560';
    ct.beginPath(); ct.moveTo(-14 + hipTilt, -20); ct.lineTo(14 + hipTilt, -20); ct.lineTo(18, -8); ct.lineTo(-18, -8); ct.closePath(); ct.fill();
    ct.strokeStyle = '#e94560'; ct.lineWidth = 5;
    ct.beginPath(); ct.moveTo(hipTilt, -15); ct.lineTo(hipTilt * 0.5, -50); ct.stroke();
    ct.fillStyle = '#ff6b81';
    ct.beginPath(); ct.moveTo(-11 + hipTilt * 0.5, -48); ct.lineTo(11 + hipTilt * 0.5, -48); ct.lineTo(9 + hipTilt, -20); ct.lineTo(-9 + hipTilt, -20); ct.closePath(); ct.fill();

    ct.strokeStyle = '#f5c6a0'; ct.lineWidth = 3.5;
    if (sonicBoom > 0) {
        ct.beginPath(); ct.moveTo(0, -45); ct.lineTo(s * 25, -50); ct.lineTo(s * 42, -48); ct.stroke();
        ct.beginPath(); ct.moveTo(0, -42); ct.lineTo(s * 20, -44); ct.lineTo(s * 38, -45); ct.stroke();
    } else if (attacking) {
        ct.beginPath(); ct.moveTo(0, -45); ct.lineTo(s * 20, -55); ct.lineTo(s * 35, -58); ct.stroke();
        ct.beginPath(); ct.moveTo(0, -42); ct.lineTo(s * -15, -28); ct.lineTo(s * -10, -20); ct.stroke();
    } else {
        const mw = Math.sin(it * 0.08) * 15, mb = Math.cos(it * 0.06) * 8;
        ct.beginPath(); ct.moveTo(0, -45); ct.lineTo(s * 18 + mw * 0.3, -42 + mb * 0.3); ct.lineTo(s * 28 + mw, -50 + mb); ct.stroke();
        ct.beginPath(); ct.moveTo(0, -42); ct.lineTo(s * -14, -28); ct.lineTo(s * -10, -20); ct.stroke();
    }

    // PINK NEON MIC (bigger)
    let micX, micY;
    if (sonicBoom > 0) { micX = s * 44; micY = -47; }
    else if (attacking) { micX = s * 37; micY = -60; }
    else { const mw = Math.sin(it * 0.08) * 15, mb = Math.cos(it * 0.06) * 8; micX = s * 28 + mw; micY = -52 + mb; }
    // Neon glow always
    ct.shadowColor = '#ff69b4'; ct.shadowBlur = 12;
    // Handle (pink)
    ct.strokeStyle = '#ff69b4'; ct.lineWidth = 4;
    ct.beginPath(); ct.moveTo(micX, micY + 2); ct.lineTo(micX, micY + 18); ct.stroke();
    // Mic head (bigger, pink)
    ct.fillStyle = '#ff1493';
    ct.beginPath(); ct.arc(micX, micY, 10, 0, Math.PI * 2); ct.fill();
    // Grid
    ct.strokeStyle = 'rgba(255,255,255,0.4)'; ct.lineWidth = 0.8;
    for (let i = -6; i <= 6; i += 3) {
        ct.beginPath(); ct.moveTo(micX - 7, micY + i); ct.lineTo(micX + 7, micY + i); ct.stroke();
    }
    // Outer neon ring
    ct.strokeStyle = '#ff69b4'; ct.lineWidth = 2;
    const glowPulse = 12 + Math.sin(Date.now() * 0.008) * 3;
    ct.beginPath(); ct.arc(micX, micY, glowPulse, 0, Math.PI * 2); ct.stroke();
    if (attacking || sonicBoom > 0) {
        ct.shadowBlur = sonicBoom > 0 ? 40 : 25;
        ct.strokeStyle = '#ff69b4'; ct.lineWidth = 3;
        ct.beginPath(); ct.arc(micX, micY, glowPulse + 5, 0, Math.PI * 2); ct.stroke();
    }
    ct.shadowBlur = 0;

    // Head
    ct.strokeStyle = '#f5c6a0'; ct.lineWidth = 4;
    ct.beginPath(); ct.moveTo(hipTilt * 0.5, -50); ct.lineTo(0, -58); ct.stroke();
    ct.fillStyle = '#f5c6a0';
    ct.beginPath(); ct.arc(0, -76, 22, 0, Math.PI * 2); ct.fill();
    ct.fillStyle = '#e17055';
    ct.beginPath(); ct.arc(0, -78, 24, Math.PI, 0, false);
    ct.lineTo(22, -60); ct.quadraticCurveTo(26, -40, 20 + Math.sin(walkCycle * 0.5 + it * 0.02) * 4, -28);
    ct.lineTo(16, -55); ct.lineTo(0, -54); ct.lineTo(-16, -55);
    ct.lineTo(-20 - Math.sin(walkCycle * 0.5 + it * 0.02) * 4, -28);
    ct.quadraticCurveTo(-26, -40, -22, -60); ct.closePath(); ct.fill();
    ct.beginPath(); ct.moveTo(-20, -85); ct.quadraticCurveTo(-10, -105, 0, -100);
    ct.quadraticCurveTo(10, -105, 20, -85); ct.arc(0, -78, 24, -0.3, Math.PI + 0.3, true);
    ct.closePath(); ct.fill();

    ct.fillStyle = '#2c3e50';
    if (!attacking && !sonicBoom) {
        ct.beginPath(); ct.ellipse(s * 7, -79, 4, 3.5, 0, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.ellipse(s * -7, -79, 4, 3.5, 0, 0, Math.PI * 2); ct.fill();
        ct.strokeStyle = '#e17055'; ct.lineWidth = 2;
        ct.beginPath(); ct.moveTo(s * 3, -87); ct.quadraticCurveTo(s * 7, -91, s * 11, -87); ct.stroke();
    } else {
        ct.beginPath(); ct.ellipse(s * 7, -79, 4, 5, 0, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.ellipse(s * -7, -79, 4, 5, 0, 0, Math.PI * 2); ct.fill();
    }
    ct.fillStyle = '#fff';
    ct.beginPath(); ct.arc(s * 8, -80, 2, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.arc(s * -6, -80, 2, 0, Math.PI * 2); ct.fill();
    ct.strokeStyle = '#2c3e50'; ct.lineWidth = 1.5;
    ct.beginPath(); ct.moveTo(s * 11, -82); ct.lineTo(s * 14, -85); ct.stroke();
    ct.beginPath(); ct.moveTo(s * -3, -82); ct.lineTo(s * -6, -85); ct.stroke();
    ct.fillStyle = 'rgba(255,107,129,0.3)';
    ct.beginPath(); ct.ellipse(-13, -73, 5, 3, 0, 0, Math.PI * 2); ct.fill();
    ct.beginPath(); ct.ellipse(13, -73, 5, 3, 0, 0, Math.PI * 2); ct.fill();

    if (sonicBoom > 0) {
        ct.fillStyle = '#c0392b'; ct.beginPath(); ct.ellipse(0, -68, 8, 9, 0, 0, Math.PI * 2); ct.fill();
        ct.fillStyle = '#fff'; ct.beginPath(); ct.rect(-4, -75, 8, 3); ct.fill();
    } else if (attacking) {
        ct.fillStyle = '#c0392b'; ct.beginPath(); ct.ellipse(0, -68, 6, 7, 0, 0, Math.PI * 2); ct.fill();
        ct.fillStyle = '#fff'; ct.beginPath(); ct.rect(-3, -73, 6, 3); ct.fill();
    } else {
        ct.strokeStyle = '#e94560'; ct.lineWidth = 2;
        ct.beginPath(); ct.moveTo(s * -5, -69); ct.quadraticCurveTo(s * 2, -64, s * 7, -69); ct.stroke();
        ct.fillStyle = '#ff6b81'; ct.beginPath(); ct.arc(s * 6, -67, 3, 0, Math.PI); ct.fill();
    }
    ct.fillStyle = '#e94560';
    ct.beginPath(); ct.moveTo(s * 15, -95); ct.quadraticCurveTo(s * 22, -105, s * 15, -100);
    ct.quadraticCurveTo(s * 15, -97, s * 8, -100); ct.quadraticCurveTo(s * 8, -105, s * 15, -95); ct.fill();

    if (!attacking && !sonicBoom) {
        ct.globalAlpha = 0.6 + Math.sin(it * 0.07) * 0.3;
        ct.fillStyle = '#ff6b81'; ct.font = '14px serif';
        ct.fillText('\u266A', s * 20 + Math.sin(it * 0.04) * 8, -100 + Math.cos(it * 0.05) * 5);
        ct.font = '11px serif';
        ct.fillText('\u266B', s * 10 + Math.cos(it * 0.06) * 6, -108 + Math.sin(it * 0.04) * 4);
        ct.globalAlpha = 1;
    }
    ct.restore();
}

// ============ HIT PARTICLES ============
function spawnHitParticles(x, y, type) {
    const colors = type === 'kiss' ? ['#ff69b4','#e94560','#ff1493','#fff'] :
                   type === 'sonicboom' ? ['#ff69b4','#e94560','#f9ca24','#fff','#ff6b81'] :
                   type === 'laser' ? ['#ff0000','#ff4444','#ff6666','#fff'] :
                   ['#e94560','#ff6b81','#fff'];
    const count = (type === 'kiss' || type === 'sonicboom') ? 25 : 10;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * (type === 'sonicboom' ? 8 : 5);
        hitParticles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            life: 30 + Math.random() * 20,
            maxLife: 50,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: (type === 'kiss' || type === 'sonicboom') ? 3 + Math.random() * 5 : 2 + Math.random() * 3,
            isHeart: type === 'kiss' && Math.random() > 0.5,
            isNote: type === 'sonicboom' && Math.random() > 0.6
        });
    }
    screenShake = (type === 'kiss' || type === 'sonicboom') ? 12 : 5;
}

function updateParticles() {
    for (let i = hitParticles.length - 1; i >= 0; i--) {
        const p = hitParticles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--;
        if (p.life <= 0) hitParticles.splice(i, 1);
    }
}

function drawParticles(ct) {
    for (const p of hitParticles) {
        ct.save();
        ct.globalAlpha = p.life / p.maxLife;
        if (p.isHeart) {
            ct.fillStyle = p.color; ct.font = p.size * 2 + 'px serif';
            ct.fillText('\u2764', p.x, p.y);
        } else if (p.isNote) {
            ct.fillStyle = p.color; ct.font = p.size * 2 + 'px serif';
            ct.fillText('\u266A', p.x, p.y);
        } else {
            ct.fillStyle = p.color;
            ct.beginPath(); ct.arc(p.x, p.y, p.size, 0, Math.PI * 2); ct.fill();
        }
        ct.restore();
    }
}

// ============ PROJECTILES ============
function drawProjectiles(ct) {
    for (const p of projectiles) {
        ct.save();
        if (p.type === 'laser') {
            ct.shadowColor = '#ff0000'; ct.shadowBlur = 12;
            ct.strokeStyle = '#ff0000'; ct.lineWidth = 4;
            ct.beginPath(); ct.moveTo(p.x, p.y); ct.lineTo(p.x - p.vx * 3, p.y); ct.stroke();
            ct.strokeStyle = '#ff6666'; ct.lineWidth = 2;
            ct.beginPath(); ct.moveTo(p.x, p.y); ct.lineTo(p.x - p.vx * 3, p.y); ct.stroke();
            ct.fillStyle = '#fff';
            ct.beginPath(); ct.arc(p.x, p.y, 3, 0, Math.PI * 2); ct.fill();
        } else if (p.type === 'sonic') {
            const a = Math.max(0, 0.8 - p.life * 0.01);
            ct.strokeStyle = 'rgba(255,105,180,' + a + ')'; ct.lineWidth = 3;
            const r = 8 + p.life * 0.5;
            ct.beginPath(); ct.arc(p.x, p.y, r, -Math.PI * 0.4, Math.PI * 0.4); ct.stroke();
            ct.strokeStyle = 'rgba(255,107,129,' + (a * 0.7) + ')'; ct.lineWidth = 2;
            ct.beginPath(); ct.arc(p.x, p.y, r + 6, -Math.PI * 0.3, Math.PI * 0.3); ct.stroke();
            ct.fillStyle = 'rgba(255,105,180,' + a + ')'; ct.font = '16px serif';
            ct.fillText('\u266A', p.x + Math.sin(p.life * 0.2) * 10, p.y - 12);
        } else if (p.type === 'kiss') {
            // BIG kiss - huge floating heart
            const pulse = 1 + Math.sin(p.life * 0.2) * 0.3;
            const a = Math.max(0, 1 - p.life * 0.006);
            ct.globalAlpha = a;
            ct.shadowColor = '#ff69b4'; ct.shadowBlur = 30;
            ct.fillStyle = '#e94560'; ct.font = (35 * pulse) + 'px serif';
            ct.fillText('\u2764', p.x - 18, p.y + 12);
            // Sparkle ring
            ct.strokeStyle = '#ff69b4'; ct.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
                const angle = (Date.now() * 0.005 + i * Math.PI / 3);
                const sx = p.x + Math.cos(angle) * 25;
                const sy = p.y + Math.sin(angle) * 25;
                ct.beginPath(); ct.arc(sx, sy, 2, 0, Math.PI * 2); ct.stroke();
            }
            // Trail hearts
            ct.globalAlpha = a * 0.5; ct.font = '18px serif';
            ct.fillText('\u2764', p.x - p.vx * 3 + Math.sin(p.life) * 8, p.y - 15);
            ct.font = '14px serif';
            ct.fillText('\u2764', p.x - p.vx * 6 + Math.cos(p.life) * 6, p.y + 10);
            ct.fillText('\u2764', p.x - p.vx * 8 + Math.sin(p.life * 0.7) * 10, p.y - 5);
            ct.shadowBlur = 0;
        } else if (p.type === 'sonicboom') {
            // MASSIVE sonic boom
            const age = p.life;
            const r = 20 + age * 3;
            const a = Math.max(0, 1 - age * 0.008);
            ct.globalAlpha = a;
            ct.shadowColor = '#ff69b4'; ct.shadowBlur = 35;
            // Multiple shockwave rings
            ct.strokeStyle = '#ff1493'; ct.lineWidth = 6;
            ct.beginPath(); ct.arc(p.x, p.y, r, -Math.PI * 0.6, Math.PI * 0.6); ct.stroke();
            ct.strokeStyle = '#ff69b4'; ct.lineWidth = 4;
            ct.beginPath(); ct.arc(p.x, p.y, r * 0.7, -Math.PI * 0.5, Math.PI * 0.5); ct.stroke();
            ct.strokeStyle = '#fff'; ct.lineWidth = 2;
            ct.beginPath(); ct.arc(p.x, p.y, r * 0.4, -Math.PI * 0.4, Math.PI * 0.4); ct.stroke();
            // Flying music notes
            ct.fillStyle = '#ff69b4'; ct.font = (22 + age * 0.4) + 'px serif';
            ct.fillText('\u266B', p.x + Math.sin(age * 0.3) * r * 0.6, p.y - r * 0.5);
            ct.font = (18 + age * 0.3) + 'px serif';
            ct.fillText('\u266A', p.x + Math.cos(age * 0.2) * r * 0.4, p.y + r * 0.5);
            ct.fillText('\u266B', p.x - Math.sin(age * 0.25) * r * 0.3, p.y - r * 0.3);
            ct.shadowBlur = 0;
        }
        ct.restore();
    }
}

// ============ DRAW DODGE AFTERIMAGE ============
function drawDodgeAfterimage(ct, charType, p) {
    if (!p || !p.dodging) return;
    ct.save(); ct.globalAlpha = 0.25;
    const offX = -p.dodgeDir * 20;
    if (charType === 'boy') drawBoy(ct, p.x + offX, p.y, p.facing, p.walkCycle, false, 0, false);
    else drawGirl(ct, p.x + offX, p.y, p.facing, p.walkCycle, false, 0, false, 0);
    ct.restore();
}

// ============ SUPER BAR ============
function drawSuperBar(ct, p, side) {
    if (!p) return;
    const barW = 120, barH = 10;
    const x = side === 'left' ? 30 : CANVAS_W - 30 - barW;
    const y = 42;
    ct.fillStyle = '#aaa'; ct.font = 'bold 9px sans-serif';
    ct.textAlign = side === 'left' ? 'left' : 'right';
    ct.fillText('SUPER', side === 'left' ? x : x + barW, y - 3);
    ct.textAlign = 'left';
    ct.fillStyle = 'rgba(255,255,255,0.1)'; ct.strokeStyle = 'rgba(255,255,255,0.2)'; ct.lineWidth = 1;
    ct.beginPath(); ct.roundRect(x, y, barW, barH, 5); ct.fill(); ct.stroke();
    const pct = p.superPower / MAX_SUPER;
    if (pct > 0) {
        const fillW = barW * pct;
        const grad = ct.createLinearGradient(x, y, x + fillW, y);
        if (p === players.boy) { grad.addColorStop(0, '#ff69b4'); grad.addColorStop(1, '#e94560'); }
        else { grad.addColorStop(0, '#f9ca24'); grad.addColorStop(1, '#e94560'); }
        ct.fillStyle = grad; ct.beginPath(); ct.roundRect(x, y, fillW, barH, 5); ct.fill();
    }
    if (p.superReady) {
        const pulse = 0.4 + Math.sin(Date.now() * 0.008) * 0.3;
        const col = p === players.boy ? '#ff69b4' : '#f9ca24';
        ct.shadowColor = col; ct.shadowBlur = 15 + Math.sin(Date.now() * 0.01) * 8;
        ct.strokeStyle = col.replace(')', ',' + pulse + ')').replace('rgb', 'rgba');
        ct.lineWidth = 2;
        ct.beginPath(); ct.roundRect(x - 2, y - 2, barW + 4, barH + 4, 6); ct.stroke();
        ct.shadowBlur = 0;
        ct.fillStyle = col;
        ct.globalAlpha = 0.6 + Math.sin(Date.now() * 0.006) * 0.4;
        ct.font = 'bold 10px sans-serif'; ct.textAlign = 'center';
        ct.fillText('[ Q ] READY!', x + barW / 2, y + barH + 13);
        ct.textAlign = 'left'; ct.globalAlpha = 1;
    }
}

// ============ BACKGROUND ============
function drawBackground(ct) {
    const grad = ct.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1a1a3e'); grad.addColorStop(0.6, '#2d1b4e'); grad.addColorStop(1, '#0f3460');
    ct.fillStyle = grad; ct.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ct.fillStyle = '#fff';
    const seeds = [23,67,134,200,290,370,450,520,600,700,780,850,910,45,160,310,680,740];
    for (let i = 0; i < seeds.length; i++) {
        const sx = seeds[i], sy = (sx * 37 + i * 53) % 300;
        ct.globalAlpha = 0.5 + Math.sin(Date.now() * 0.002 + i) * 0.3;
        ct.beginPath(); ct.arc(sx, sy, (i % 3 === 0) ? 2 : 1, 0, Math.PI * 2); ct.fill();
    }
    ct.globalAlpha = 1;
    // Spotlight beams
    ct.save(); ct.globalAlpha = 0.06;
    ct.fillStyle = '#e94560'; ct.beginPath(); ct.moveTo(200, 0); ct.lineTo(100, CANVAS_H); ct.lineTo(300, CANVAS_H); ct.closePath(); ct.fill();
    ct.fillStyle = '#4ecdc4'; ct.beginPath(); ct.moveTo(760, 0); ct.lineTo(660, CANVAS_H); ct.lineTo(860, CANVAS_H); ct.closePath(); ct.fill();
    ct.restore();
    // Draw floating platforms (boy=teal, girl=pink)
    drawFloatingPlatform(ct, platformBoy, '#4ecdc4', '#4ecdc4');
    drawFloatingPlatform(ct, platformGirl, '#e94560', '#ff69b4');
}

function drawFloatingPlatform(ct, p, neonColor, sideColor) {
    ct.save();
    ct.shadowColor = neonColor; ct.shadowBlur = 18;
    const pg = ct.createLinearGradient(p.x - p.w / 2, p.y - 6, p.x - p.w / 2, p.y + p.h);
    pg.addColorStop(0, '#3d2060'); pg.addColorStop(0.5, '#2d1b4e'); pg.addColorStop(1, '#1a0a2e');
    ct.fillStyle = pg;
    ct.beginPath();
    ct.roundRect(p.x - p.w / 2, p.y - 4, p.w, p.h, 6);
    ct.fill();
    ct.shadowBlur = 0;
    ct.strokeStyle = neonColor; ct.lineWidth = 2.5;
    ct.shadowColor = neonColor; ct.shadowBlur = 12;
    ct.beginPath(); ct.moveTo(p.x - p.w / 2 + 4, p.y - 3); ct.lineTo(p.x + p.w / 2 - 4, p.y - 3); ct.stroke();
    ct.shadowBlur = 0;
    ct.strokeStyle = sideColor; ct.lineWidth = 1.5;
    ct.shadowColor = sideColor; ct.shadowBlur = 6;
    ct.beginPath(); ct.moveTo(p.x - p.w / 2 + 2, p.y); ct.lineTo(p.x - p.w / 2 + 2, p.y + p.h - 2); ct.stroke();
    ct.beginPath(); ct.moveTo(p.x + p.w / 2 - 2, p.y); ct.lineTo(p.x + p.w / 2 - 2, p.y + p.h - 2); ct.stroke();
    ct.shadowBlur = 0;
    for (let i = 0; i < 3; i++) {
        const tx = p.x - p.w / 4 + i * (p.w / 2);
        const flicker = Math.sin(Date.now() * 0.008 + i * 1.3) * 3;
        const rgb = neonColor === '#4ecdc4' ? '78,205,196' : '233,69,96';
        ct.fillStyle = 'rgba(' + rgb + ',' + (0.15 + Math.sin(Date.now() * 0.005 + i) * 0.1) + ')';
        ct.beginPath(); ct.arc(tx, p.y + p.h + 4 + flicker, 3 + Math.sin(Date.now() * 0.01 + i) * 2, 0, Math.PI * 2); ct.fill();
    }
    if (Math.abs(p.vx) > 0.3 || Math.abs(p.vy) > 0.3) {
        ct.fillStyle = 'rgba(255,255,255,0.3)'; ct.font = '12px sans-serif';
        if (p.vx > 0.3) ct.fillText('\u25B6', p.x + p.w / 2 + 4, p.y + 7);
        if (p.vx < -0.3) ct.fillText('\u25C0', p.x - p.w / 2 - 15, p.y + 7);
        if (p.vy < -0.3) ct.fillText('\u25B2', p.x - 4, p.y - 8);
        if (p.vy > 0.3) ct.fillText('\u25BC', p.x - 4, p.y + p.h + 16);
    }
    ct.restore();
}

// ============ END GAME SEQUENCE ============
function drawEndSequence(ct) {
    endSequenceTimer++;
    ct.save();

    if (endSequencePhase === 1) {
        // Phase 1: Sassy message from boy
        ct.fillStyle = 'rgba(0,0,0,0.8)';
        ct.fillRect(0, 0, CANVAS_W, CANVAS_H);
        drawBackground(ct);
        // Boy standing victorious center
        drawBoy(ct, CANVAS_W / 2, GROUND_Y, 1, 0, false, 0, true);
        // Speech bubble
        const bubX = CANVAS_W / 2 + 50, bubY = GROUND_Y - 130;
        ct.fillStyle = '#fff';
        ct.beginPath(); ct.roundRect(bubX - 10, bubY - 30, 260, 55, 12); ct.fill();
        ct.beginPath(); ct.moveTo(bubX + 10, bubY + 25); ct.lineTo(bubX - 20, bubY + 40); ct.lineTo(bubX + 40, bubY + 25); ct.fill();
        ct.fillStyle = '#1a1a2e'; ct.font = 'bold 14px sans-serif';
        ct.fillText("It's MY game...", bubX + 5, bubY - 8);
        ct.fillText("I ALWAYS win! hehe", bubX + 5, bubY + 12);
        // Floating hearts
        for (let i = 0; i < 5; i++) {
            ct.fillStyle = '#e94560'; ct.globalAlpha = 0.4 + Math.sin(Date.now() * 0.003 + i) * 0.3;
            ct.font = (12 + i * 3) + 'px serif';
            ct.fillText('\u2764', CANVAS_W / 2 - 80 + i * 40 + Math.sin(Date.now() * 0.002 + i) * 10, GROUND_Y - 50 - i * 20 + Math.cos(Date.now() * 0.003 + i) * 8);
        }
        ct.globalAlpha = 1;
        // Girl's sassy photo (she looks unbothered even though she lost)
        const imgX = CANVAS_W / 2 - 190, imgY = GROUND_Y - 160;
        ct.save();
        ct.rotate(-0.08); // slight tilt
        drawFramedImage(ct, gameImages.girlShades, imgX, imgY, 110, 140, '#e94560', 3, 12);
        ct.restore();
        // Caption under photo
        ct.fillStyle = '#ff69b4'; ct.font = 'italic 11px sans-serif'; ct.textAlign = 'center';
        ct.fillText('"Still looks cool tho"', imgX + 55, imgY + 155);
        ct.textAlign = 'left';
        if (endSequenceTimer > 240) { endSequencePhase = 2; endSequenceTimer = 0; }
    } else if (endSequencePhase === 2) {
        // Phase 2: Comedy drag animation — full of emotion!
        ct.fillStyle = 'rgba(0,0,0,0.85)'; ct.fillRect(0, 0, CANVAS_W, CANVAS_H);
        drawBackground(ct);
        const progress = Math.min(1, endSequenceTimer / 480);
        const bx = 150 + progress * 400;
        const gx = bx - 65;

        // Dust cloud behind girl
        for (let d = 0; d < 6; d++) {
            ct.fillStyle = 'rgba(200,180,150,' + (0.15 - d * 0.02) + ')';
            ct.beginPath();
            ct.arc(gx - 30 - d * 18 + Math.sin(endSequenceTimer * 0.1 + d) * 5,
                   GROUND_Y + 15 + Math.cos(endSequenceTimer * 0.15 + d) * 4,
                   8 + d * 3, 0, Math.PI * 2);
            ct.fill();
        }

        // Boy walking — smug happy face
        drawBoy(ct, bx, GROUND_Y, 1, endSequenceTimer * 0.12, false, 0, false);
        // Whistling music notes above boy
        ct.fillStyle = '#2ecc71'; ct.font = '14px serif';
        const noteY = GROUND_Y - 115 + Math.sin(endSequenceTimer * 0.06) * 8;
        ct.fillText('\u266A', bx + 15 + Math.sin(endSequenceTimer * 0.04) * 5, noteY);
        ct.fillText('\u266B', bx + 30 + Math.cos(endSequenceTimer * 0.05) * 4, noteY - 10);
        // Smug speech from boy cycling
        const boyLines = ["Come on, let's go~", "Don't be dramatic!", "Hehe, you're cute when mad", "Almost there!"];
        const boyLine = boyLines[Math.floor(endSequenceTimer / 120) % boyLines.length];
        if (endSequenceTimer % 120 < 100) {
            ct.save();
            ct.fillStyle = '#fff';
            ct.beginPath(); ct.roundRect(bx - 20, GROUND_Y - 148, ct.measureText(boyLine).width + 30 || 180, 28, 8); ct.fill();
            ct.beginPath(); ct.moveTo(bx + 5, GROUND_Y - 120); ct.lineTo(bx - 5, GROUND_Y - 115); ct.lineTo(bx + 20, GROUND_Y - 120); ct.fill();
            ct.fillStyle = '#1a1a2e'; ct.font = 'bold 12px sans-serif';
            ct.fillText(boyLine, bx - 8, GROUND_Y - 130);
            ct.restore();
        }

        // Boy's arm reaching back to grab girl
        ct.strokeStyle = '#f5c6a0'; ct.lineWidth = 3.5; ct.lineCap = 'round';
        ct.beginPath(); ct.moveTo(bx - 12, GROUND_Y - 42); ct.lineTo(gx + 18, GROUND_Y - 30); ct.stroke();

        // Girl being dragged (lying on ground, throwing a tantrum)
        ct.save();
        ct.translate(gx, GROUND_Y + 8);

        // Body lying sideways
        ct.strokeStyle = '#e94560'; ct.lineWidth = 5;
        ct.beginPath(); ct.moveTo(5, -5); ct.lineTo(-32, -5); ct.stroke();

        // Head
        ct.fillStyle = '#f5c6a0';
        ct.beginPath(); ct.arc(-40, -8, 16, 0, Math.PI * 2); ct.fill();
        // Hair flowing behind
        ct.fillStyle = '#e17055';
        ct.beginPath(); ct.arc(-40, -12, 18, Math.PI, 0.1, false);
        ct.lineTo(-22, -2); ct.lineTo(-58, -2); ct.closePath(); ct.fill();
        // Extra hair strands (messy from dragging)
        ct.strokeStyle = '#e17055'; ct.lineWidth = 2;
        for (let h = 0; h < 3; h++) {
            ct.beginPath();
            ct.moveTo(-48 - h * 4, -14 + h * 3);
            ct.lineTo(-58 - h * 6 + Math.sin(endSequenceTimer * 0.08 + h) * 4, -10 + h * 5);
            ct.stroke();
        }

        // Legs kicking wildly
        const kick1 = Math.sin(endSequenceTimer * 0.25) * 20;
        const kick2 = Math.cos(endSequenceTimer * 0.25) * 18;
        ct.strokeStyle = '#e94560'; ct.lineWidth = 3.5; ct.lineCap = 'round';
        ct.beginPath(); ct.moveTo(5, -5); ct.lineTo(20, -20 + kick1); ct.stroke();
        ct.beginPath(); ct.moveTo(5, -5); ct.lineTo(22, 8 + kick2); ct.stroke();
        // Little shoes
        ct.fillStyle = '#d63031';
        ct.beginPath(); ct.arc(22, -20 + kick1, 4, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.arc(24, 8 + kick2, 4, 0, Math.PI * 2); ct.fill();

        // Free arm hammering ground in fury
        const hammerCycle = Math.sin(endSequenceTimer * 0.18);
        const fistX = -50 + hammerCycle * 8;
        const fistY = 8 + Math.abs(hammerCycle) * 12;
        ct.strokeStyle = '#f5c6a0'; ct.lineWidth = 3;
        ct.beginPath(); ct.moveTo(-32, -6); ct.lineTo(fistX, fistY); ct.stroke();
        // Fist
        ct.fillStyle = '#f5c6a0';
        ct.beginPath(); ct.arc(fistX, fistY, 4, 0, Math.PI * 2); ct.fill();
        // Impact effects when fist hits ground
        if (hammerCycle > 0.85) {
            ct.fillStyle = '#f9ca24'; ct.font = 'bold 16px serif';
            ct.fillText('BAM!', fistX - 18, fistY + 18);
            for (let s = 0; s < 4; s++) {
                ct.fillStyle = '#f9ca24'; ct.globalAlpha = 0.7;
                ct.beginPath();
                ct.arc(fistX - 5 + Math.cos(s * 1.5) * 12, fistY + 5 + Math.sin(s * 1.5) * 8, 2, 0, Math.PI * 2);
                ct.fill();
            }
            ct.globalAlpha = 1;
        }

        // FACE — cycling emotions
        const facePhase = Math.floor(endSequenceTimer / 90) % 4;
        // Tears streaming constantly
        ct.fillStyle = 'rgba(100,180,255,0.6)';
        const tearOff = (endSequenceTimer * 2) % 20;
        ct.beginPath(); ct.arc(-44, -3 + tearOff * 0.5, 2, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.arc(-36, -2 + (tearOff + 5) % 20 * 0.5, 2, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.arc(-44, 2 + tearOff * 0.3, 1.5, 0, Math.PI * 2); ct.fill();

        if (facePhase === 0) {
            // Angry squint
            ct.fillStyle = '#2c3e50';
            ct.fillRect(-44, -12, 6, 3); ct.fillRect(-37, -12, 6, 3);
            ct.strokeStyle = '#2c3e50'; ct.lineWidth = 2;
            ct.beginPath(); ct.moveTo(-46, -15); ct.lineTo(-40, -13); ct.stroke();
            ct.beginPath(); ct.moveTo(-33, -13); ct.lineTo(-27, -15); ct.stroke();
            ct.fillStyle = '#c0392b';
            ct.beginPath(); ct.ellipse(-40, -3, 5, 4, 0, 0, Math.PI * 2); ct.fill();
        } else if (facePhase === 1) {
            // Crying/wailing — big open mouth
            ct.fillStyle = '#2c3e50';
            ct.beginPath(); ct.arc(-43, -10, 2.5, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(-36, -10, 2.5, 0, Math.PI * 2); ct.fill();
            ct.fillStyle = '#c0392b';
            ct.beginPath(); ct.ellipse(-40, -2, 6, 5, 0, 0, Math.PI * 2); ct.fill();
            ct.fillStyle = '#fff';
            ct.fillRect(-43, -3, 2, 2); // teeth
        } else if (facePhase === 2) {
            // Pouty / sulking
            ct.fillStyle = '#2c3e50';
            ct.beginPath(); ct.arc(-43, -10, 2, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(-36, -10, 2, 0, Math.PI * 2); ct.fill();
            // Puffed cheeks
            ct.fillStyle = 'rgba(255,150,150,0.5)';
            ct.beginPath(); ct.arc(-47, -5, 5, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(-33, -5, 5, 0, Math.PI * 2); ct.fill();
            ct.strokeStyle = '#c0392b'; ct.lineWidth = 2;
            ct.beginPath(); ct.moveTo(-43, -2); ct.lineTo(-37, -2); ct.stroke(); // flat mouth
        } else {
            // Defiant yelling
            ct.fillStyle = '#2c3e50';
            ct.beginPath(); ct.arc(-43, -11, 2, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(-36, -11, 2, 0, Math.PI * 2); ct.fill();
            ct.strokeStyle = '#2c3e50'; ct.lineWidth = 2;
            ct.beginPath(); ct.moveTo(-46, -14); ct.lineTo(-41, -13); ct.stroke();
            ct.beginPath(); ct.moveTo(-34, -13); ct.lineTo(-29, -14); ct.stroke();
            ct.fillStyle = '#c0392b';
            ct.beginPath(); ct.ellipse(-40, -3, 4, 5, 0, 0, Math.PI * 2); ct.fill();
        }
        // Red angry blush
        ct.fillStyle = 'rgba(255,100,100,0.25)';
        ct.beginPath(); ct.arc(-47, -5, 4, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.arc(-33, -5, 4, 0, Math.PI * 2); ct.fill();

        ct.restore();

        // Girl's speech bubbles — cycling funny complaints
        const girlLines = [
            "NOOOO! LET ME GOOO! 😤",
            "THIS IS SO UNFAIR!!",
            "I DEMAND A REMATCH!",
            "MY MIC IS BETTER THAN YOUR LASER!!",
            "WAIT TILL MY MOM HEARS ABOUT THIS!",
            "I'm filing a complaint!! 😭",
            "YOU CAN'T DO THIS TO ME!!"
        ];
        const girlLine = girlLines[Math.floor(endSequenceTimer / 80) % girlLines.length];
        ct.save();
        ct.fillStyle = '#ffe0ec';
        const glw = ct.measureText ? 190 : 190;
        ct.beginPath(); ct.roundRect(gx - 95, GROUND_Y - 65, glw, 32, 10); ct.fill();
        ct.strokeStyle = '#e94560'; ct.lineWidth = 2; ct.stroke();
        ct.beginPath(); ct.moveTo(gx - 30, GROUND_Y - 33); ct.lineTo(gx - 25, GROUND_Y - 20); ct.lineTo(gx - 15, GROUND_Y - 33); ct.fill();
        ct.fillStyle = '#c0392b'; ct.font = 'bold 11px sans-serif';
        ct.fillText(girlLine, gx - 88, GROUND_Y - 44);
        ct.restore();

        // Girl's sassy photo floating as a "wanted poster" in corner
        ct.save();
        ct.globalAlpha = 0.6 + Math.sin(endSequenceTimer * 0.01) * 0.15;
        const posterX = CANVAS_W - 140, posterY = 40 + Math.sin(endSequenceTimer * 0.01) * 5;
        ct.translate(posterX + 50, posterY + 60);
        ct.rotate(Math.sin(endSequenceTimer * 0.008) * 0.05);
        ct.translate(-(posterX + 50), -(posterY + 60));
        drawFramedImage(ct, gameImages.girlSassy, posterX, posterY, 100, 120, '#ff69b4', 3, 8);
        ct.fillStyle = '#ff69b4'; ct.font = 'bold 10px sans-serif'; ct.textAlign = 'center';
        ct.fillText('DRAMA QUEEN', posterX + 50, posterY + 137);
        ct.textAlign = 'left';
        ct.restore();

        // Scratch marks on ground behind girl
        ct.strokeStyle = 'rgba(200,200,200,0.3)'; ct.lineWidth = 1;
        for (let s = 0; s < 8; s++) {
            const sx = gx - 40 - s * 25;
            if (sx > 50) {
                ct.beginPath(); ct.moveTo(sx, GROUND_Y + 20); ct.lineTo(sx + 12, GROUND_Y + 22); ct.stroke();
                ct.beginPath(); ct.moveTo(sx + 3, GROUND_Y + 24); ct.lineTo(sx + 15, GROUND_Y + 26); ct.stroke();
            }
        }

        if (endSequenceTimer > 550) { endSequencePhase = 3; endSequenceTimer = 0; }
    } else if (endSequencePhase === 3) {
        // Phase 3: Valentine proposal
        ct.fillStyle = 'rgba(0,0,0,0.85)'; ct.fillRect(0, 0, CANVAS_W, CANVAS_H);
        // Starry romantic bg
        for (let i = 0; i < 30; i++) {
            ct.fillStyle = '#e94560'; ct.globalAlpha = 0.2 + Math.sin(Date.now() * 0.002 + i * 0.5) * 0.2;
            ct.font = (8 + (i % 5) * 4) + 'px serif';
            ct.fillText('\u2764', (i * 97) % CANVAS_W, (i * 53 + Math.sin(Date.now() * 0.001 + i) * 20) % CANVAS_H);
        }
        ct.globalAlpha = 1;
        // Boy on one knee
        ct.save(); ct.translate(CANVAS_W / 2 - 60, GROUND_Y);
        // Back leg (kneeling)
        ct.strokeStyle = '#4ecdc4'; ct.lineWidth = 4; ct.lineCap = 'round';
        ct.beginPath(); ct.moveTo(0, -20); ct.lineTo(-10, 5); ct.lineTo(-15, 25); ct.stroke();
        // Front leg (knee down)
        ct.beginPath(); ct.moveTo(0, -20); ct.lineTo(15, 10); ct.lineTo(20, 25); ct.stroke();
        ct.fillStyle = '#2c3e50';
        ct.beginPath(); ct.ellipse(-15, 27, 8, 4, 0, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.ellipse(20, 27, 8, 4, 0, 0, Math.PI * 2); ct.fill();
        // Body
        ct.strokeStyle = '#4ecdc4'; ct.lineWidth = 5;
        ct.beginPath(); ct.moveTo(0, -20); ct.lineTo(0, -55); ct.stroke();
        ct.fillStyle = '#2ecc71';
        ct.beginPath(); ct.moveTo(-12, -50); ct.lineTo(12, -50); ct.lineTo(10, -22); ct.lineTo(-10, -22); ct.closePath(); ct.fill();
        // Arm holding flowers forward
        ct.strokeStyle = '#4ecdc4'; ct.lineWidth = 3.5;
        ct.beginPath(); ct.moveTo(0, -48); ct.lineTo(25, -45); ct.lineTo(40, -50); ct.stroke();
        // Flowers bouquet
        const flowerColors = ['#e94560', '#ff69b4', '#f9ca24', '#e94560', '#ff1493'];
        for (let i = 0; i < 5; i++) {
            ct.fillStyle = flowerColors[i];
            const fx = 42 + Math.cos(i * 1.2) * 8;
            const fy = -55 + Math.sin(i * 1.3) * 6;
            ct.beginPath(); ct.arc(fx, fy, 5, 0, Math.PI * 2); ct.fill();
            ct.fillStyle = '#2ecc71';
            ct.beginPath(); ct.moveTo(fx, fy + 4); ct.lineTo(40, -48); ct.stroke();
        }
        // Other arm on chest
        ct.beginPath(); ct.moveTo(0, -45); ct.lineTo(-15, -38); ct.lineTo(-10, -30); ct.stroke();
        // Head
        ct.strokeStyle = '#f5c6a0'; ct.lineWidth = 5;
        ct.beginPath(); ct.moveTo(0, -55); ct.lineTo(0, -62); ct.stroke();
        ct.fillStyle = '#f5c6a0';
        ct.beginPath(); ct.arc(0, -80, 22, 0, Math.PI * 2); ct.fill();
        ct.fillStyle = '#2c3e50';
        ct.beginPath(); ct.moveTo(-20, -85); ct.lineTo(-15, -108); ct.lineTo(-5, -95); ct.lineTo(2, -112);
        ct.lineTo(10, -95); ct.lineTo(18, -106); ct.lineTo(22, -85);
        ct.arc(0, -82, 22, -0.2, Math.PI + 0.2, true); ct.closePath(); ct.fill();
        // Loving eyes
        ct.fillStyle = '#e94560'; ct.font = '10px serif';
        ct.fillText('\u2764', 3, -83); ct.fillText('\u2764', -11, -83);
        // Smile
        ct.strokeStyle = '#c0392b'; ct.lineWidth = 2;
        ct.beginPath(); ct.moveTo(-5, -71); ct.quadraticCurveTo(0, -65, 5, -71); ct.stroke();
        ct.restore();
        // Girl standing (shy)
        ct.save(); ct.translate(CANVAS_W / 2 + 80, GROUND_Y);
        drawGirl(ct, 0, 0, -1, 0, false, 0, false, endSequenceTimer);
        ct.restore();
        // Couple photo top-right with decorative frame
        ct.save();
        ct.shadowColor = '#e94560'; ct.shadowBlur = 15;
        drawFramedImage(ct, gameImages.couple1, CANVAS_W - 190, 90, 160, 200, '#ff69b4', 4, 14);
        ct.restore();
        // Little heart decoration on photo
        ct.fillStyle = '#e94560'; ct.font = '16px serif'; ct.globalAlpha = 0.7 + Math.sin(Date.now() * 0.003) * 0.3;
        ct.fillText('\u2764', CANVAS_W - 120, 85);
        ct.globalAlpha = 1;
        // Text
        ct.fillStyle = '#ff69b4'; ct.font = 'bold 28px sans-serif'; ct.textAlign = 'center';
        ct.shadowColor = '#ff69b4'; ct.shadowBlur = 20;
        ct.fillText('Will you be my Valentine?', CANVAS_W / 2 - 30, 80);
        ct.shadowBlur = 0; ct.textAlign = 'left';
    } else if (endSequencePhase === 4) {
        // Phase 4: Happily Ever After on the Moon — full rewrite
        try { if (endSequenceTimer === 1) playHeartbeat(); } catch(e) {}
        const t = endSequenceTimer;
        const slow = Date.now() * 0.001; // slow time base for gentle zero-g

        // Deep space background
        ct.fillStyle = '#050518';
        ct.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Nebula glow
        const nebGrad = ct.createRadialGradient(200, 150, 20, 200, 150, 250);
        nebGrad.addColorStop(0, 'rgba(100,40,180,0.08)'); nebGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ct.fillStyle = nebGrad; ct.fillRect(0, 0, CANVAS_W, CANVAS_H);
        const nebGrad2 = ct.createRadialGradient(750, 100, 10, 750, 100, 180);
        nebGrad2.addColorStop(0, 'rgba(233,69,96,0.06)'); nebGrad2.addColorStop(1, 'rgba(0,0,0,0)');
        ct.fillStyle = nebGrad2; ct.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Stars twinkling (more, varied)
        for (let i = 0; i < 120; i++) {
            const sx = (i * 127 + 23) % CANVAS_W;
            const sy = (i * 89 + 17) % (CANVAS_H - 100);
            const twinkle = 0.2 + Math.sin(slow * 3 + i * 0.7) * 0.5;
            ct.fillStyle = i % 7 === 0 ? 'rgba(200,220,255,' + twinkle + ')' : 'rgba(255,255,255,' + twinkle + ')';
            ct.beginPath(); ct.arc(sx, sy, 0.5 + (i % 4) * 0.4, 0, Math.PI * 2); ct.fill();
        }

        // Shooting stars occasionally
        if (t % 150 < 18) {
            const sx = (t * 4.5) % CANVAS_W;
            ct.strokeStyle = 'rgba(255,255,200,0.5)'; ct.lineWidth = 1.5;
            ct.beginPath(); ct.moveTo(sx, 20); ct.lineTo(sx + 80, 55); ct.stroke();
            ct.strokeStyle = 'rgba(255,255,200,0.15)';
            ct.beginPath(); ct.moveTo(sx + 5, 18); ct.lineTo(sx + 60, 42); ct.stroke();
        }

        // Earth in the sky (top-right)
        ct.save();
        ct.beginPath(); ct.arc(820, 75, 50, 0, Math.PI * 2); ct.clip();
        ct.fillStyle = '#1a6fc4'; ct.fillRect(770, 25, 100, 100);
        ct.fillStyle = '#2ecc71';
        ct.beginPath(); ct.ellipse(810, 65, 18, 13, 0.3, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.ellipse(830, 82, 10, 16, -0.2, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.ellipse(800, 88, 7, 5, 0.5, 0, Math.PI * 2); ct.fill();
        ct.fillStyle = 'rgba(255,255,255,0.35)';
        ct.beginPath(); ct.ellipse(815, 60, 22, 5, 0.2, 0, Math.PI * 2); ct.fill();
        ct.restore();
        ct.shadowColor = '#4a9eff'; ct.shadowBlur = 20;
        ct.strokeStyle = 'rgba(74,158,255,0.25)'; ct.lineWidth = 2;
        ct.beginPath(); ct.arc(820, 75, 53, 0, Math.PI * 2); ct.stroke();
        ct.shadowBlur = 0;

        // ===== MOON: Semi-circle planet at bottom =====
        const moonCX = CANVAS_W / 2;
        const moonR = 380; // large radius so it looks like a small planet
        const moonTopY = CANVAS_H - 120; // visible arc top
        // Moon body
        const moonGrad = ct.createRadialGradient(moonCX - 60, moonTopY - 30, 50, moonCX, moonTopY + moonR, moonR);
        moonGrad.addColorStop(0, '#d8d8e0'); moonGrad.addColorStop(0.4, '#c0c0cc'); moonGrad.addColorStop(1, '#8a8a9a');
        ct.fillStyle = moonGrad;
        ct.beginPath(); ct.arc(moonCX, moonTopY + moonR, moonR, Math.PI, 0); ct.fill();
        // Moon edge highlight
        ct.strokeStyle = 'rgba(255,255,255,0.15)'; ct.lineWidth = 2;
        ct.beginPath(); ct.arc(moonCX, moonTopY + moonR, moonR, Math.PI, 0); ct.stroke();
        // Craters on moon surface
        const craters = [{x:-120,y:15,r:22},{x:80,y:25,r:16},{x:-200,y:8,r:12},{x:180,y:18,r:20},{x:-30,y:30,r:10},{x:260,y:12,r:14}];
        for (const cr of craters) {
            ct.fillStyle = 'rgba(150,150,165,0.5)';
            ct.beginPath(); ct.ellipse(moonCX + cr.x, moonTopY + cr.y, cr.r, cr.r * 0.4, 0, 0, Math.PI * 2); ct.fill();
            ct.fillStyle = 'rgba(130,130,145,0.3)';
            ct.beginPath(); ct.ellipse(moonCX + cr.x + 2, moonTopY + cr.y + 2, cr.r * 0.7, cr.r * 0.25, 0, 0, Math.PI * 2); ct.fill();
        }

        // Helper: Y position on moon surface given X offset from center
        function moonSurfY(xOff) { return moonTopY + moonR - Math.sqrt(Math.max(0, moonR * moonR - xOff * xOff)) + 2; }

        // ===== TREES on moon surface =====
        function drawMoonTree(ct, xOff, size, color) {
            const tx = moonCX + xOff;
            const ty = moonSurfY(xOff);
            ct.save(); ct.translate(tx, ty);
            // Trunk
            ct.fillStyle = '#8b6b3d';
            ct.fillRect(-3 * size, -20 * size, 6 * size, 20 * size);
            // Foliage (round puffs)
            ct.fillStyle = color;
            ct.beginPath(); ct.arc(0, -25 * size, 12 * size, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(-8 * size, -20 * size, 9 * size, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(8 * size, -20 * size, 9 * size, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(0, -32 * size, 8 * size, 0, Math.PI * 2); ct.fill();
            // Gentle sway in zero-g
            const sway = Math.sin(slow * 0.4 + xOff * 0.01) * 2 * size;
            ct.fillStyle = color;
            ct.beginPath(); ct.arc(sway, -35 * size, 6 * size, 0, Math.PI * 2); ct.fill();
            ct.restore();
        }
        drawMoonTree(ct, -250, 0.9, '#2ecc71');
        drawMoonTree(ct, -180, 1.1, '#27ae60');
        drawMoonTree(ct, 200, 1.0, '#2ecc71');
        drawMoonTree(ct, 270, 0.8, '#1abc9c');
        drawMoonTree(ct, -60, 0.6, '#27ae60');
        drawMoonTree(ct, 310, 0.7, '#2ecc71');

        // ===== BIG HOUSE =====
        const hx = moonCX - 30, hy = moonSurfY(-30);
        ct.save(); ct.translate(hx, hy);
        // House body
        ct.fillStyle = '#e8d5b7';
        ct.fillRect(-50, -80, 100, 80);
        // Roof
        ct.fillStyle = '#c0392b';
        ct.beginPath(); ct.moveTo(-60, -80); ct.lineTo(0, -120); ct.lineTo(60, -80); ct.closePath(); ct.fill();
        // Roof trim
        ct.strokeStyle = '#a93226'; ct.lineWidth = 2;
        ct.beginPath(); ct.moveTo(-60, -80); ct.lineTo(0, -120); ct.lineTo(60, -80); ct.stroke();
        // Door
        ct.fillStyle = '#6b3a1f';
        ct.beginPath(); ct.roundRect(-12, -35, 24, 35, [6, 6, 0, 0]); ct.fill();
        ct.fillStyle = '#f9ca24';
        ct.beginPath(); ct.arc(6, -16, 3, 0, Math.PI * 2); ct.fill();
        // Windows with warm glow (bigger)
        ct.fillStyle = '#f9e547';
        ct.shadowColor = '#f9ca24'; ct.shadowBlur = 12;
        ct.fillRect(-42, -65, 22, 18); ct.fillRect(20, -65, 22, 18);
        ct.shadowBlur = 0;
        // Window crosses
        ct.strokeStyle = '#6b3a1f'; ct.lineWidth = 1.5;
        ct.beginPath(); ct.moveTo(-31, -65); ct.lineTo(-31, -47); ct.stroke();
        ct.beginPath(); ct.moveTo(-42, -56); ct.lineTo(-20, -56); ct.stroke();
        ct.beginPath(); ct.moveTo(31, -65); ct.lineTo(31, -47); ct.stroke();
        ct.beginPath(); ct.moveTo(20, -56); ct.lineTo(42, -56); ct.stroke();
        // Chimney
        ct.fillStyle = '#8b4513';
        ct.fillRect(28, -115, 14, 30);
        // Heart smoke from chimney
        ct.fillStyle = 'rgba(255,180,200,0.5)'; ct.font = '14px serif';
        for (let s = 0; s < 4; s++) {
            const smokeY = -120 - s * 20 - (t * 0.2) % 25;
            ct.globalAlpha = 0.5 - s * 0.12;
            ct.fillText('\u2764', 30 + Math.sin(slow * 0.5 + s) * 5, smokeY);
        }
        ct.globalAlpha = 1;
        // Welcome mat
        ct.fillStyle = '#c0392b';
        ct.fillRect(-15, -2, 30, 5);
        // Framed couple photo on house wall (floating slightly — zero-g!)
        const photoFloat = Math.sin(slow * 0.2) * 2;
        drawFramedImage(ct, gameImages.couple2, -38, -72 + photoFloat, 28, 22, '#d4af37', 2, 3);
        ct.restore();

        // ===== COUPLE SITTING TOGETHER ON A BENCH =====
        const benchX = moonCX + 80;
        const benchY = moonSurfY(80);
        ct.save(); ct.translate(benchX, benchY);

        // ---- Park bench ----
        // Bench legs
        ct.fillStyle = '#5a3a1a';
        ct.fillRect(-42, -2, 6, 18); ct.fillRect(36, -2, 6, 18);
        // Bench seat
        ct.fillStyle = '#8b5e3c';
        ct.beginPath(); ct.roundRect(-46, -8, 92, 10, 3); ct.fill();
        // Bench seat highlight
        ct.fillStyle = '#a0714a';
        ct.fillRect(-44, -8, 88, 3);
        // Bench backrest
        ct.fillStyle = '#7a4f2e';
        ct.beginPath(); ct.roundRect(-44, -38, 88, 8, 3); ct.fill();
        ct.fillStyle = '#6b3a1f';
        ct.beginPath(); ct.roundRect(-44, -28, 88, 8, 3); ct.fill();
        // Backrest vertical supports
        ct.fillStyle = '#5a3a1a';
        ct.fillRect(-42, -38, 5, 36); ct.fillRect(37, -38, 5, 36);
        // Armrests
        ct.fillStyle = '#7a4f2e';
        ct.fillRect(-48, -14, 8, 5); ct.fillRect(40, -14, 8, 5);

        // ---- BOY sitting on bench (left side) ----
        ct.save(); ct.translate(-16, -8);
        // Legs relaxed on bench
        ct.strokeStyle = '#4ecdc4'; ct.lineWidth = 3.5; ct.lineCap = 'round';
        const bSwing = Math.sin(slow * 0.25) * 2;
        ct.beginPath(); ct.moveTo(-5, 0); ct.lineTo(-8, 14 + bSwing); ct.stroke();
        ct.beginPath(); ct.moveTo(5, 0); ct.lineTo(8, 13 - bSwing); ct.stroke();
        ct.fillStyle = '#2c3e50';
        ct.beginPath(); ct.ellipse(-9, 16 + bSwing, 6, 3, 0, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.ellipse(9, 15 - bSwing, 6, 3, 0, 0, Math.PI * 2); ct.fill();
        // Body
        ct.strokeStyle = '#4ecdc4'; ct.lineWidth = 4;
        ct.beginPath(); ct.moveTo(0, 0); ct.lineTo(0, -28); ct.stroke();
        ct.fillStyle = '#2ecc71';
        ct.beginPath(); ct.moveTo(-9, -26); ct.lineTo(9, -26); ct.lineTo(7, -2); ct.lineTo(-7, -2); ct.closePath(); ct.fill();
        // Arm around girl (reaching right)
        ct.strokeStyle = '#f5c6a0'; ct.lineWidth = 3;
        ct.beginPath(); ct.moveTo(6, -22); ct.lineTo(18, -20); ct.lineTo(28, -22); ct.stroke();
        // Other arm resting on knee
        ct.beginPath(); ct.moveTo(-6, -22); ct.lineTo(-12, -12); ct.lineTo(-8, -2); ct.stroke();
        // Neck
        ct.strokeStyle = '#f5c6a0'; ct.lineWidth = 4;
        ct.beginPath(); ct.moveTo(0, -28); ct.lineTo(0, -34); ct.stroke();
        // Head
        ct.fillStyle = '#f5c6a0';
        ct.beginPath(); ct.arc(0, -48, 16, 0, Math.PI * 2); ct.fill();
        // Hair
        ct.fillStyle = '#2c3e50';
        ct.beginPath(); ct.moveTo(-14, -54); ct.lineTo(-10, -70); ct.lineTo(-2, -59);
        ct.lineTo(4, -72); ct.lineTo(10, -58); ct.lineTo(16, -68); ct.lineTo(18, -52);
        ct.arc(0, -50, 16, -0.1, Math.PI + 0.1, true); ct.closePath(); ct.fill();
        // Hair floating (zero-g)
        ct.strokeStyle = '#2c3e50'; ct.lineWidth = 2;
        const bhF = Math.sin(slow * 0.25) * 3;
        ct.beginPath(); ct.moveTo(-6, -64); ct.quadraticCurveTo(-8, -74 + bhF, -4, -78 + bhF); ct.stroke();
        ct.beginPath(); ct.moveTo(5, -66); ct.quadraticCurveTo(7, -76 - bhF, 9, -80 - bhF); ct.stroke();
        // Happy closed eyes (content)
        ct.strokeStyle = '#2c3e50'; ct.lineWidth = 2;
        ct.beginPath(); ct.arc(-6, -50, 3, 0, Math.PI); ct.stroke();
        ct.beginPath(); ct.arc(6, -50, 3, 0, Math.PI); ct.stroke();
        // Gentle smile
        ct.strokeStyle = '#c0392b'; ct.lineWidth = 2;
        ct.beginPath(); ct.arc(0, -42, 5, 0.2, Math.PI - 0.2); ct.stroke();
        ct.restore();

        // ---- GIRL sitting on bench (right side, leaning on boy) ----
        ct.save(); ct.translate(16, -8);
        // Legs
        const gSwing = Math.sin(slow * 0.25 + 0.5) * 2;
        ct.strokeStyle = '#e94560'; ct.lineWidth = 3.5; ct.lineCap = 'round';
        ct.beginPath(); ct.moveTo(-5, 0); ct.lineTo(-7, 14 + gSwing); ct.stroke();
        ct.beginPath(); ct.moveTo(5, 0); ct.lineTo(7, 12 - gSwing); ct.stroke();
        ct.fillStyle = '#d63031';
        ct.beginPath(); ct.ellipse(-8, 16 + gSwing, 5, 3, 0, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.ellipse(8, 14 - gSwing, 5, 3, 0, 0, Math.PI * 2); ct.fill();
        // Body
        ct.strokeStyle = '#e94560'; ct.lineWidth = 4;
        ct.beginPath(); ct.moveTo(0, 0); ct.lineTo(-2, -28); ct.stroke();
        ct.fillStyle = '#ff69b4';
        ct.beginPath(); ct.moveTo(-9, -26); ct.lineTo(9, -26); ct.lineTo(7, -2); ct.lineTo(-7, -2); ct.closePath(); ct.fill();
        // Skirt
        ct.fillStyle = '#e94560';
        ct.beginPath(); ct.moveTo(-9, -2); ct.lineTo(-12, 4); ct.lineTo(12, 4); ct.lineTo(9, -2); ct.closePath(); ct.fill();
        // Arm resting on boy's leg
        ct.strokeStyle = '#f5c6a0'; ct.lineWidth = 3;
        ct.beginPath(); ct.moveTo(-6, -22); ct.lineTo(-18, -14); ct.lineTo(-22, -6); ct.stroke();
        // Other arm in lap
        ct.beginPath(); ct.moveTo(6, -22); ct.lineTo(10, -12); ct.lineTo(6, -4); ct.stroke();
        // Neck
        ct.strokeStyle = '#f5c6a0'; ct.lineWidth = 3.5;
        ct.beginPath(); ct.moveTo(-2, -28); ct.lineTo(-4, -34); ct.stroke();
        // Head (tilted toward boy — leaning on shoulder)
        ct.save(); ct.rotate(-0.2);
        ct.fillStyle = '#f5c6a0';
        ct.beginPath(); ct.arc(-4, -48, 15, 0, Math.PI * 2); ct.fill();
        // Hair
        ct.fillStyle = '#e17055';
        ct.beginPath(); ct.arc(-4, -50, 17, Math.PI, 0.1, false);
        ct.lineTo(13, -40); ct.lineTo(-21, -40); ct.closePath(); ct.fill();
        // Long flowing hair (zero-g float)
        ct.strokeStyle = '#e17055'; ct.lineWidth = 2;
        for (let h = 0; h < 4; h++) {
            const hFloat = Math.sin(slow * 0.2 + h * 0.8) * 6;
            ct.beginPath();
            ct.moveTo(-14 + h * 5, -56);
            ct.quadraticCurveTo(-12 + h * 5, -68 + hFloat, -10 + h * 5, -76 + hFloat);
            ct.stroke();
        }
        // Hair draping down right side
        ct.strokeStyle = '#e17055'; ct.lineWidth = 3;
        const drape = Math.sin(slow * 0.15) * 3;
        ct.beginPath(); ct.moveTo(10, -42); ct.quadraticCurveTo(16, -30 + drape, 14, -18 + drape); ct.stroke();
        ct.beginPath(); ct.moveTo(12, -44); ct.quadraticCurveTo(19, -32 + drape, 17, -20 + drape); ct.stroke();
        // Closed happy eyes
        ct.strokeStyle = '#2c3e50'; ct.lineWidth = 2;
        ct.beginPath(); ct.arc(-8, -50, 3, 0, Math.PI); ct.stroke();
        ct.beginPath(); ct.arc(2, -50, 3, 0, Math.PI); ct.stroke();
        // Blush
        ct.fillStyle = 'rgba(255,150,150,0.4)';
        ct.beginPath(); ct.arc(-12, -45, 4, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.arc(6, -45, 4, 0, Math.PI * 2); ct.fill();
        // Cute smile
        ct.strokeStyle = '#e94560'; ct.lineWidth = 2;
        ct.beginPath(); ct.arc(-3, -42, 4, 0.2, Math.PI - 0.2); ct.stroke();
        // Heart bow in hair
        ct.fillStyle = '#e94560';
        ct.beginPath(); ct.moveTo(8, -62); ct.quadraticCurveTo(14, -70, 8, -67);
        ct.quadraticCurveTo(8, -64, 2, -67); ct.quadraticCurveTo(2, -70, 8, -62); ct.fill();
        ct.restore(); // un-rotate head
        ct.restore(); // un-translate girl

        ct.restore(); // un-translate bench

        // ===== LOVE BUBBLES popping out from the couple =====
        for (let b = 0; b < 8; b++) {
            const bubPhase = slow * 0.4 + b * 1.1;
            const bubLife = ((bubPhase % 4) / 4); // 0..1 cycle
            const bubX = benchX + Math.sin(b * 2.3 + slow * 0.15) * (30 + b * 8);
            const bubBaseY = benchY - 50;
            const bubY = bubBaseY - bubLife * 120 - b * 10;
            const bubR = 8 + b * 1.5 + Math.sin(slow * 0.5 + b) * 2;
            const bubAlpha = Math.max(0, 0.7 - bubLife * 0.8);
            if (bubAlpha <= 0) continue;
            ct.save();
            ct.globalAlpha = bubAlpha;
            // Bubble circle
            ct.strokeStyle = 'rgba(255,105,180,0.6)'; ct.lineWidth = 1.5;
            ct.beginPath(); ct.arc(bubX, bubY, bubR, 0, Math.PI * 2); ct.stroke();
            // Bubble highlight
            ct.fillStyle = 'rgba(255,200,220,0.25)';
            ct.beginPath(); ct.arc(bubX - bubR * 0.3, bubY - bubR * 0.3, bubR * 0.4, 0, Math.PI * 2); ct.fill();
            // Heart inside bubble
            ct.fillStyle = '#e94560';
            ct.font = (bubR * 0.9) + 'px serif';
            ct.textAlign = 'center';
            ct.fillText('\u2764', bubX, bubY + bubR * 0.3);
            ct.textAlign = 'left';
            // Pop sparkles when bubble is about to vanish
            if (bubAlpha < 0.15) {
                ct.globalAlpha = 0.6;
                ct.fillStyle = '#ff69b4'; ct.font = '6px serif';
                for (let s = 0; s < 4; s++) {
                    const sa = s * Math.PI * 0.5;
                    ct.fillText('\u2726', bubX + Math.cos(sa) * (bubR + 4), bubY + Math.sin(sa) * (bubR + 4));
                }
            }
            ct.restore();
        }

        // Extra large love bubbles rising slowly
        for (let lb = 0; lb < 3; lb++) {
            const lbPhase = slow * 0.2 + lb * 2.5;
            const lbLife = ((lbPhase % 5) / 5);
            const lbX = benchX - 40 + lb * 50 + Math.sin(slow * 0.1 + lb * 1.5) * 15;
            const lbY = benchY - 30 - lbLife * 160;
            const lbR = 14 + Math.sin(slow * 0.3 + lb) * 3;
            const lbAlpha = Math.max(0, 0.5 - lbLife * 0.55);
            if (lbAlpha <= 0) continue;
            ct.save(); ct.globalAlpha = lbAlpha;
            // Outer bubble with iridescent tint
            const bubGrad = ct.createRadialGradient(lbX - 3, lbY - 3, 2, lbX, lbY, lbR);
            bubGrad.addColorStop(0, 'rgba(255,200,230,0.3)');
            bubGrad.addColorStop(0.7, 'rgba(255,105,180,0.1)');
            bubGrad.addColorStop(1, 'rgba(255,105,180,0.05)');
            ct.fillStyle = bubGrad;
            ct.beginPath(); ct.arc(lbX, lbY, lbR, 0, Math.PI * 2); ct.fill();
            ct.strokeStyle = 'rgba(255,150,200,0.5)'; ct.lineWidth = 1.5;
            ct.beginPath(); ct.arc(lbX, lbY, lbR, 0, Math.PI * 2); ct.stroke();
            // Shine
            ct.fillStyle = 'rgba(255,255,255,0.35)';
            ct.beginPath(); ct.arc(lbX - lbR * 0.3, lbY - lbR * 0.35, lbR * 0.3, 0, Math.PI * 2); ct.fill();
            // Big heart inside
            ct.fillStyle = '#e94560'; ct.font = (lbR * 1.1) + 'px serif'; ct.textAlign = 'center';
            ct.fillText('\u2764', lbX, lbY + lbR * 0.35);
            ct.textAlign = 'left';
            ct.restore();
        }

        // ===== FLOATING CAT (slow, gentle, peaceful) =====
        const catBaseX = moonCX - 200;
        const catBaseY = moonTopY - 60;
        const catDriftX = Math.sin(slow * 0.15) * 15; // very slow drift
        const catDriftY = Math.cos(slow * 0.12) * 10;
        ct.save(); ct.translate(catBaseX + catDriftX, catBaseY + catDriftY);
        ct.rotate(Math.sin(slow * 0.1) * 0.08); // gentle tumble
        // Body
        ct.fillStyle = '#f5a623';
        ct.beginPath(); ct.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2); ct.fill();
        // Head
        ct.fillStyle = '#e8951a';
        ct.beginPath(); ct.arc(14, -5, 10, 0, Math.PI * 2); ct.fill();
        // Ears
        ct.fillStyle = '#d4830f';
        ct.beginPath(); ct.moveTo(10, -14); ct.lineTo(8, -22); ct.lineTo(14, -15); ct.closePath(); ct.fill();
        ct.beginPath(); ct.moveTo(18, -14); ct.lineTo(20, -22); ct.lineTo(16, -15); ct.closePath(); ct.fill();
        // Inner ears
        ct.fillStyle = '#ffb8d0';
        ct.beginPath(); ct.moveTo(10, -14); ct.lineTo(9, -19); ct.lineTo(13, -15); ct.closePath(); ct.fill();
        ct.beginPath(); ct.moveTo(18, -14); ct.lineTo(19, -19); ct.lineTo(17, -15); ct.closePath(); ct.fill();
        // Sleeping eyes (closed lines)
        ct.strokeStyle = '#2c3e50'; ct.lineWidth = 1.5;
        ct.beginPath(); ct.arc(11, -6, 2, 0, Math.PI); ct.stroke();
        ct.beginPath(); ct.arc(17, -6, 2, 0, Math.PI); ct.stroke();
        // Tiny nose
        ct.fillStyle = '#ff69b4';
        ct.beginPath(); ct.arc(14, -3, 1.5, 0, Math.PI * 2); ct.fill();
        // Mouth
        ct.strokeStyle = '#2c3e50'; ct.lineWidth = 1;
        ct.beginPath(); ct.moveTo(13, -1); ct.quadraticCurveTo(14, 1, 15, -1); ct.stroke();
        // Whiskers
        ct.strokeStyle = 'rgba(50,50,50,0.4)'; ct.lineWidth = 0.8;
        ct.beginPath(); ct.moveTo(7, -3); ct.lineTo(-2, -5); ct.stroke();
        ct.beginPath(); ct.moveTo(7, -1); ct.lineTo(-2, 0); ct.stroke();
        ct.beginPath(); ct.moveTo(21, -3); ct.lineTo(30, -5); ct.stroke();
        ct.beginPath(); ct.moveTo(21, -1); ct.lineTo(30, 0); ct.stroke();
        // Tail curling slowly
        ct.strokeStyle = '#f5a623'; ct.lineWidth = 3; ct.lineCap = 'round';
        const tailCurl = Math.sin(slow * 0.2) * 8;
        ct.beginPath(); ct.moveTo(-14, 0); ct.quadraticCurveTo(-24, -5 + tailCurl, -28, -12 + tailCurl); ct.stroke();
        // Paws tucked
        ct.fillStyle = '#e8951a';
        ct.beginPath(); ct.ellipse(-8, 8, 4, 3, 0, 0, Math.PI * 2); ct.fill();
        ct.beginPath(); ct.ellipse(8, 8, 4, 3, 0, 0, Math.PI * 2); ct.fill();
        // Zzz
        ct.fillStyle = 'rgba(255,255,255,0.5)'; ct.font = '10px sans-serif';
        ct.fillText('z', 22, -16 + Math.sin(slow * 0.3) * 2);
        ct.fillStyle = 'rgba(255,255,255,0.35)'; ct.font = '8px sans-serif';
        ct.fillText('z', 28, -22 + Math.sin(slow * 0.25) * 2);
        ct.fillStyle = 'rgba(255,255,255,0.2)'; ct.font = '6px sans-serif';
        ct.fillText('z', 33, -27 + Math.sin(slow * 0.2) * 2);
        ct.restore();

        // ===== 3 ROBOTS on moon surface =====
        function drawRobot(ct, xOff, type, walkSpeed) {
            const rx = moonCX + xOff + Math.sin(slow * walkSpeed) * 25;
            const ry = moonSurfY(xOff);
            ct.save(); ct.translate(rx, ry);
            const rWalk = Math.sin(slow * walkSpeed * 2) * 3;
            // Body
            ct.fillStyle = type === 0 ? '#7f8c8d' : type === 1 ? '#5dade2' : '#af7ac5';
            ct.fillRect(-12, -42, 24, 26);
            // Chest light
            ct.fillStyle = type === 0 ? '#2ecc71' : type === 1 ? '#f9ca24' : '#e74c3c';
            ct.shadowColor = ct.fillStyle; ct.shadowBlur = 6;
            ct.beginPath(); ct.arc(0, -32, 3, 0, Math.PI * 2); ct.fill();
            ct.shadowBlur = 0;
            // Head
            ct.fillStyle = type === 0 ? '#bdc3c7' : type === 1 ? '#85c1e9' : '#d2b4de';
            ct.fillRect(-10, -56, 20, 16);
            // Visor
            ct.fillStyle = '#1a1a2e';
            ct.fillRect(-7, -53, 14, 8);
            // Eyes (LED)
            ct.fillStyle = '#00ff88';
            ct.beginPath(); ct.arc(-3, -49, 2, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(3, -49, 2, 0, Math.PI * 2); ct.fill();
            // Antenna
            ct.strokeStyle = '#7f8c8d'; ct.lineWidth = 2;
            ct.beginPath(); ct.moveTo(0, -56); ct.lineTo(0, -64); ct.stroke();
            ct.fillStyle = type === 0 ? '#e74c3c' : type === 1 ? '#f39c12' : '#2ecc71';
            ct.beginPath(); ct.arc(0, -65, 3, 0, Math.PI * 2); ct.fill();
            // Arms
            ct.strokeStyle = type === 0 ? '#95a5a6' : type === 1 ? '#5dade2' : '#af7ac5';
            ct.lineWidth = 3;
            if (type === 0) {
                // Carrying tray
                ct.beginPath(); ct.moveTo(12, -36); ct.lineTo(24, -40); ct.stroke();
                ct.beginPath(); ct.moveTo(-12, -36); ct.lineTo(-24, -40); ct.stroke();
                ct.fillStyle = '#d4af37';
                ct.fillRect(-22, -43, 44, 3);
                ct.fillStyle = '#fff';
                ct.fillRect(-14, -49, 10, 6); ct.fillRect(4, -49, 10, 6);
            } else if (type === 1) {
                // Waving
                ct.beginPath(); ct.moveTo(12, -36); ct.lineTo(22, -50 + Math.sin(slow * 1.5) * 5); ct.stroke();
                ct.beginPath(); ct.moveTo(-12, -36); ct.lineTo(-20, -28); ct.stroke();
            } else {
                // Carrying broom (sweeping)
                ct.beginPath(); ct.moveTo(12, -36); ct.lineTo(18, -20); ct.stroke();
                ct.beginPath(); ct.moveTo(-12, -36); ct.lineTo(-16, -26); ct.stroke();
                ct.strokeStyle = '#8b6b3d'; ct.lineWidth = 2;
                ct.beginPath(); ct.moveTo(18, -20); ct.lineTo(18, 5); ct.stroke();
                ct.strokeStyle = '#f9ca24'; ct.lineWidth = 4;
                ct.beginPath(); ct.moveTo(14, 5); ct.lineTo(22, 5); ct.stroke();
            }
            // Legs
            ct.strokeStyle = '#7f8c8d'; ct.lineWidth = 3;
            ct.beginPath(); ct.moveTo(-6, -16); ct.lineTo(-6, 2 + rWalk); ct.stroke();
            ct.beginPath(); ct.moveTo(6, -16); ct.lineTo(6, 2 - rWalk); ct.stroke();
            // Feet
            ct.fillStyle = '#2c3e50';
            ct.fillRect(-10, 2 + rWalk, 8, 4);
            ct.fillRect(2, 2 - rWalk, 8, 4);
            ct.restore();
        }
        drawRobot(ct, -140, 0, 0.04);  // tray robot
        drawRobot(ct, 80, 1, 0.035);    // waving robot
        drawRobot(ct, 230, 2, 0.045);   // sweeping robot

        // ===== ARMAGEDDON-STYLE SPACESHIPS =====
        function drawArmageddonShip(ct, baseX, baseY, size, speed, flipDir) {
            const sx = ((t * speed) % (CANVAS_W + 300)) - 150;
            const drift = Math.sin(slow * 0.3 + baseY * 0.01) * 8;
            ct.save();
            ct.translate(flipDir > 0 ? sx : CANVAS_W - sx, baseY + drift);
            ct.scale(flipDir, 1);
            const s = size;
            // Main hull
            ct.fillStyle = '#4a4a5a';
            ct.beginPath();
            ct.moveTo(50 * s, 0);
            ct.lineTo(35 * s, -10 * s);
            ct.lineTo(-30 * s, -12 * s);
            ct.lineTo(-45 * s, -6 * s);
            ct.lineTo(-50 * s, 0);
            ct.lineTo(-45 * s, 6 * s);
            ct.lineTo(-30 * s, 12 * s);
            ct.lineTo(35 * s, 10 * s);
            ct.closePath(); ct.fill();
            // Hull detail lines
            ct.strokeStyle = '#6a6a7a'; ct.lineWidth = 1;
            ct.beginPath(); ct.moveTo(-20 * s, -10 * s); ct.lineTo(-20 * s, 10 * s); ct.stroke();
            ct.beginPath(); ct.moveTo(10 * s, -9 * s); ct.lineTo(10 * s, 9 * s); ct.stroke();
            // Cockpit window
            ct.fillStyle = 'rgba(100,180,255,0.6)';
            ct.beginPath(); ct.ellipse(30 * s, 0, 10 * s, 5 * s, 0, 0, Math.PI * 2); ct.fill();
            ct.strokeStyle = 'rgba(150,200,255,0.4)'; ct.lineWidth = 1;
            ct.stroke();
            // Wings (top and bottom)
            ct.fillStyle = '#3a3a4a';
            ct.beginPath(); ct.moveTo(-10 * s, -12 * s); ct.lineTo(-25 * s, -24 * s); ct.lineTo(-35 * s, -20 * s); ct.lineTo(-25 * s, -12 * s); ct.closePath(); ct.fill();
            ct.beginPath(); ct.moveTo(-10 * s, 12 * s); ct.lineTo(-25 * s, 24 * s); ct.lineTo(-35 * s, 20 * s); ct.lineTo(-25 * s, 12 * s); ct.closePath(); ct.fill();
            // Engine pods
            ct.fillStyle = '#5a5a6a';
            ct.beginPath(); ct.ellipse(-42 * s, -8 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.ellipse(-42 * s, 8 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2); ct.fill();
            // Engine flames
            const flameLen = 12 + Math.sin(slow * 8 + baseY) * 5;
            ct.fillStyle = '#3498db';
            ct.beginPath(); ct.moveTo(-50 * s, -8 * s); ct.lineTo(-50 * s - flameLen * s, -8 * s + 1); ct.lineTo(-50 * s, -8 * s - 1); ct.closePath(); ct.fill();
            ct.beginPath(); ct.moveTo(-50 * s, 8 * s); ct.lineTo(-50 * s - flameLen * s, 8 * s - 1); ct.lineTo(-50 * s, 8 * s + 1); ct.closePath(); ct.fill();
            ct.fillStyle = '#85c1e9';
            ct.beginPath(); ct.moveTo(-50 * s, -8 * s); ct.lineTo(-50 * s - flameLen * 0.6 * s, -8 * s); ct.lineTo(-50 * s, -8 * s - 0.5); ct.closePath(); ct.fill();
            ct.beginPath(); ct.moveTo(-50 * s, 8 * s); ct.lineTo(-50 * s - flameLen * 0.6 * s, 8 * s); ct.lineTo(-50 * s, 8 * s + 0.5); ct.closePath(); ct.fill();
            // Running lights
            ct.fillStyle = '#e74c3c';
            ct.globalAlpha = 0.5 + Math.sin(slow * 3 + baseY) * 0.5;
            ct.beginPath(); ct.arc(48 * s, 0, 2 * s, 0, Math.PI * 2); ct.fill();
            ct.fillStyle = '#2ecc71';
            ct.beginPath(); ct.arc(-28 * s, -22 * s, 1.5 * s, 0, Math.PI * 2); ct.fill();
            ct.beginPath(); ct.arc(-28 * s, 22 * s, 1.5 * s, 0, Math.PI * 2); ct.fill();
            ct.globalAlpha = 1;
            ct.restore();
        }
        drawArmageddonShip(ct, 0, 55, 0.9, 0.7, 1);
        drawArmageddonShip(ct, 0, 130, 0.65, 0.5, -1);

        // ===== FLOATING ITEMS (very slow zero-g) =====
        const floatItems = [
            { emoji: '\u2B50', x: 100, y: 180, spd: 0.0008, amp: 12, sz: 14 },
            { emoji: '\uD83D\uDC8D', x: 700, y: 140, spd: 0.0006, amp: 10, sz: 15 },
            { emoji: '\uD83C\uDF39', x: 50, y: 250, spd: 0.0007, amp: 8, sz: 16 },
            { emoji: '\uD83C\uDF82', x: 880, y: 200, spd: 0.0009, amp: 14, sz: 14 },
        ];
        for (const item of floatItems) {
            ct.font = item.sz + 'px serif';
            ct.globalAlpha = 0.6 + Math.sin(slow * 0.5 + item.x * 0.01) * 0.2;
            ct.fillText(item.emoji, item.x + Math.sin(Date.now() * item.spd) * item.amp,
                        item.y + Math.cos(Date.now() * item.spd * 0.7) * item.amp * 0.5);
        }
        ct.globalAlpha = 1;

        // ===== FLOATING COUPLE PHOTOS (zero-g drift) =====
        ct.save();
        const ph1X = 50, ph1Y = 100 + Math.sin(slow * 0.15) * 10;
        ct.translate(ph1X + 55, ph1Y + 70);
        ct.rotate(Math.sin(slow * 0.1) * 0.06 - 0.05);
        ct.translate(-(ph1X + 55), -(ph1Y + 70));
        ct.shadowColor = '#e94560'; ct.shadowBlur = 10;
        drawFramedImage(ct, gameImages.couple1, ph1X, ph1Y, 110, 140, '#ff69b4', 3, 10);
        ct.shadowBlur = 0;
        ct.fillStyle = 'rgba(255,105,180,0.6)'; ct.font = 'italic 9px sans-serif'; ct.textAlign = 'center';
        ct.fillText('Our first date', ph1X + 55, ph1Y + 153);
        ct.textAlign = 'left';
        ct.restore();

        ct.save();
        const ph2X = 680, ph2Y = 160 + Math.cos(slow * 0.12) * 8;
        ct.translate(ph2X + 50, ph2Y + 65);
        ct.rotate(Math.sin(slow * 0.08 + 1) * 0.05 + 0.04);
        ct.translate(-(ph2X + 50), -(ph2Y + 65));
        ct.shadowColor = '#4ecdc4'; ct.shadowBlur = 10;
        drawFramedImage(ct, gameImages.couple2, ph2X, ph2Y, 100, 130, '#4ecdc4', 3, 10);
        ct.shadowBlur = 0;
        ct.fillStyle = 'rgba(78,205,196,0.6)'; ct.font = 'italic 9px sans-serif'; ct.textAlign = 'center';
        ct.fillText('Adventure time!', ph2X + 50, ph2Y + 143);
        ct.textAlign = 'left';
        ct.restore();

        // ===== TITLE =====
        ct.save();
        ct.textAlign = 'center';
        ct.shadowColor = '#ff69b4'; ct.shadowBlur = 25;
        ct.fillStyle = '#fff'; ct.font = 'bold 30px sans-serif';
        ct.fillText('Happily Ever After', CANVAS_W / 2, 38);
        ct.shadowBlur = 0;
        ct.fillStyle = '#ff69b4'; ct.font = '15px sans-serif';
        ct.globalAlpha = 0.6 + Math.sin(slow * 0.5) * 0.3;
        ct.fillText('\u2764  on the Moon  \u2764', CANVAS_W / 2, 60);
        ct.globalAlpha = 1;
        ct.textAlign = 'left';
        ct.restore();

        // Play Again button
        if (t > 180 && !document.getElementById('moon-replay-btn')) {
            const btn = document.createElement('button');
            btn.id = 'moon-replay-btn';
            btn.textContent = 'Play Again';
            btn.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);padding:14px 40px;font-size:1.2rem;font-weight:bold;background:linear-gradient(135deg,#e94560,#ff69b4);color:#fff;border:none;border-radius:25px;cursor:pointer;z-index:30;box-shadow:0 4px 15px rgba(233,69,96,0.4);';
            btn.onclick = restartGame;
            document.getElementById('game-screen').appendChild(btn);
        }
    }
    ct.restore();
}

// ============ INIT ============
function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_W; canvas.height = CANVAS_H;
    resetPlayers();
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true; keys[e.key] = true;
        if (e.key === ' ') e.preventDefault();
        highlightKey(e.key, true);
    });
    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false; keys[e.key] = false;
        highlightKey(e.key, false);
    });
}

function resetPlayers() {
    platformBoy = { x: CANVAS_W / 3, y: CANVAS_H / 2, vx: 0, vy: 0, w: PLAT_W, h: PLAT_H };
    platformGirl = { x: (CANVAS_W / 3) * 2, y: CANVAS_H / 2, vx: 0, vy: 0, w: PLAT_W, h: PLAT_H };
    players.boy = makePlayer(platformBoy.x, 1);
    players.girl = makePlayer(platformGirl.x, -1);
    projectiles = []; hitParticles = [];
    gameOver = false; idleTimer = 0; screenShake = 0;
    endSequencePhase = 0; endSequenceTimer = 0;
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('valentine-screen').classList.add('hidden');
}

// ============ INPUT ============
function processLocalInput() {
    if (!myChar || gameOver) return;
    const me = players[myChar];
    const plat = myChar === 'boy' ? platformBoy : platformGirl;
    // Dodge = quick platform dash in facing direction
    if ((keys['shift'] || keys['Shift']) && me.dodgeCooldown <= 0 && !me.dodging) {
        me.dodging = true; me.dodgeTimer = DODGE_DURATION; me.dodgeCooldown = DODGE_COOLDOWN;
        me.invincible = true;
        plat.vx += me.facing * DODGE_SPEED * 0.7;
        try { playDodge(); } catch(e) {}
    }
    // Platform movement — WASD / arrows move the platform freely in all directions
    if (!me.dodging) {
        if (keys['a'] || keys['arrowleft']) plat.vx -= PLAT_SPEED;
        if (keys['d'] || keys['arrowright']) plat.vx += PLAT_SPEED;
        if (keys['w'] || keys['arrowup']) plat.vy -= PLAT_SPEED;
        if (keys['s'] || keys['arrowdown']) plat.vy += PLAT_SPEED;
    }
    // Walk animation when platform is moving
    if (Math.abs(plat.vx) > 0.5 || Math.abs(plat.vy) > 0.5) me.walkCycle += 0.12;
    // Attack
    if (keys[' '] && me.attackCooldown <= 0 && !me.dodging) {
        me.attacking = true; me.attackCooldown = 25; fireProjectile(myChar);
    }
    if (keys['q'] && me.superReady && !me.dodging) {
        me.superReady = false; me.superPower = 0; me.usingSuperAnim = 30; fireSuperPower(myChar);
    }
}

function fireProjectile(charType) {
    const p = players[charType];
    if (charType === 'boy') {
        projectiles.push({ x: p.x + p.facing * 15, y: p.y - 83, vx: p.facing * 10, vy: 0, owner: 'boy', type: 'laser', life: 0, damage: 5 });
        try { playLaser(); } catch(e) {}
    } else {
        projectiles.push({ x: p.x + p.facing * 37, y: p.y - 60, vx: p.facing * 7, vy: 0, owner: 'girl', type: 'sonic', life: 0, damage: 7 });
        try { playSonic(); } catch(e) {}
    }
}

function fireSuperPower(charType) {
    const p = players[charType];
    if (charType === 'boy') {
        projectiles.push({ x: p.x + p.facing * 30, y: p.y - 75, vx: p.facing * 5, vy: -0.5, owner: 'boy', type: 'kiss', life: 0, damage: 22 });
        try { playKissSuper(); } catch(e) {}
    } else {
        projectiles.push({ x: p.x + p.facing * 44, y: p.y - 47, vx: p.facing * 4, vy: 0, owner: 'girl', type: 'sonicboom', life: 0, damage: 22 });
        try { playSonicBoomSuper(); } catch(e) {}
    }
}

// ============ PHYSICS ============
function updatePhysics() {
    idleTimer++;
    if (screenShake > 0) screenShake -= 0.5;
    updateParticles();

    // Update both platforms (friction, velocity, bounds)
    for (const plat of [platformBoy, platformGirl]) {
        plat.vx *= PLAT_FRICTION;
        plat.vy *= PLAT_FRICTION;
        plat.x += plat.vx;
        plat.y += plat.vy;
        plat.x = Math.max(PLAT_BOUNDS.minX, Math.min(PLAT_BOUNDS.maxX, plat.x));
        plat.y = Math.max(PLAT_BOUNDS.minY, Math.min(PLAT_BOUNDS.maxY, plat.y));
    }

    // Stick each player to their own platform (always standing on it)
    if (players.boy) {
        players.boy.x = platformBoy.x;
        players.boy.y = platformBoy.y - 4;
    }
    if (players.girl) {
        players.girl.x = platformGirl.x;
        players.girl.y = platformGirl.y - 4;
    }

    // Auto-face toward opponent
    if (players.boy && players.girl) {
        players.boy.facing = players.girl.x > players.boy.x ? 1 : -1;
        players.girl.facing = players.boy.x > players.girl.x ? 1 : -1;
    }

    for (const key of ['boy', 'girl']) {
        const p = players[key];
        if (!p) continue;
        if (p.attackCooldown > 0) p.attackCooldown--;
        if (p.attackCooldown <= 20) p.attacking = false;
        if (p.hitFlash > 0) p.hitFlash -= 0.1;
        if (p.usingSuperAnim > 0) p.usingSuperAnim--;
        if (p.dodging) { p.dodgeTimer--; if (p.dodgeTimer <= 0) { p.dodging = false; p.invincible = false; } }
        if (p.dodgeCooldown > 0) p.dodgeCooldown--;
        if (p.superPower < MAX_SUPER) p.superPower = Math.min(MAX_SUPER, p.superPower + SUPER_FILL_RATE);
        p.superReady = p.superPower >= MAX_SUPER;
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const pr = projectiles[i];
        pr.x += pr.vx; pr.y += pr.vy; pr.life++;
        const target = pr.owner === 'boy' ? 'girl' : 'boy';
        const t = players[target];
        if (t && !t.invincible) {
            const dx = pr.x - t.x, dy = pr.y - (t.y - 50);
            let hr = 20;
            if (pr.type === 'sonic') hr = 30;
            if (pr.type === 'kiss') hr = 35;
            if (pr.type === 'sonicboom') hr = 40 + pr.life * 2;
            if (Math.abs(dx) < hr && Math.abs(dy) < 50) {
                t.hp = Math.max(0, t.hp - pr.damage);
                t.hitFlash = 1;
                spawnHitParticles(t.x, t.y - 50, pr.type);
                try { if (pr.type === 'kiss' || pr.type === 'sonicboom') playSuperHit(); else playHit(); } catch(e) {}
                projectiles.splice(i, 1); continue;
            }
        }
        const ml = (pr.type === 'kiss' || pr.type === 'sonicboom') ? 120 : 80;
        if (pr.x < -80 || pr.x > CANVAS_W + 80 || pr.life > ml) projectiles.splice(i, 1);
    }

    if (players.boy && players.boy.hp <= 0 && !gameOver) endGame('MIC GIRL WINS!');
    else if (players.girl && players.girl.hp <= 0 && !gameOver) endGame('LASER BOY WINS!');
}

function endGame(text) {
    gameOver = true;
    // Always trigger boy's win sequence (it's his game after all)
    endSequencePhase = 1; endSequenceTimer = 0;
    document.getElementById('winner-text').textContent = text;
    try { playVictory(); } catch(e) {}
}

// ============ HUD ============
function updateHUD() {
    if (!players.boy || !players.girl) return;
    document.getElementById('p1-health').style.width = (players.boy.hp / MAX_HP * 100) + '%';
    document.getElementById('p1-hp').textContent = Math.ceil(players.boy.hp);
    document.getElementById('p2-health').style.width = (players.girl.hp / MAX_HP * 100) + '%';
    document.getElementById('p2-hp').textContent = Math.ceil(players.girl.hp);
}

// ============ GAME LOOP ============
function gameLoop(timestamp) {
    if (!gameRunning) return;
    lastTime = timestamp;
    processLocalInput(); updatePhysics(); updateHUD(); sendState();

    // Screen shake
    ctx.save();
    if (screenShake > 0) {
        ctx.translate(Math.random() * screenShake - screenShake / 2, Math.random() * screenShake - screenShake / 2);
    }

    ctx.clearRect(-10, -10, CANVAS_W + 20, CANVAS_H + 20);
    drawBackground(ctx);

    if (endSequencePhase > 0) {
        drawEndSequence(ctx);
        if (endSequencePhase === 3 && endSequenceTimer > 60) {
            // Show valentine buttons
            document.getElementById('valentine-screen').classList.remove('hidden');
        }
    } else {
        drawDodgeAfterimage(ctx, 'boy', players.boy);
        drawDodgeAfterimage(ctx, 'girl', players.girl);
        const ba = players.boy && players.boy.dodging ? 0.4 : 1;
        const ga = players.girl && players.girl.dodging ? 0.4 : 1;
        ctx.save(); ctx.globalAlpha = ba;
        if (players.boy) drawBoy(ctx, players.boy.x, players.boy.y, players.boy.facing, players.boy.walkCycle, players.boy.attacking, players.boy.hitFlash, players.boy.usingSuperAnim > 0);
        ctx.restore();
        ctx.save(); ctx.globalAlpha = ga;
        if (players.girl) drawGirl(ctx, players.girl.x, players.girl.y, players.girl.facing, players.girl.walkCycle, players.girl.attacking, players.girl.hitFlash, players.girl.usingSuperAnim > 0 ? players.girl.usingSuperAnim : 0, idleTimer);
        ctx.restore();
        drawProjectiles(ctx);
        drawParticles(ctx);
        drawSuperBar(ctx, players.boy, 'left');
        drawSuperBar(ctx, players.girl, 'right');
    }
    ctx.restore();
    requestAnimationFrame(gameLoop);
}

function startGameLoop() {
    gameRunning = true; lastTime = performance.now();
    document.getElementById('selection-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    initGame(); requestAnimationFrame(gameLoop);
}

// ============ VALENTINE RESPONSES ============
let noClickCount = 0;

function valentineYes() {
    document.getElementById('valentine-screen').classList.add('hidden');
    endSequencePhase = 4; endSequenceTimer = 0;
    try { playVictory(); } catch(e) {}
}

function valentineNo() {
    noClickCount++;
    const noBtn = document.getElementById('no-btn');
    const yesBtn = document.getElementById('yes-btn');

    if (noClickCount === 1) {
        noBtn.textContent = 'Are you sure?';
        yesBtn.style.fontSize = '1.3rem';
        yesBtn.style.padding = '16px 50px';
    } else if (noClickCount === 2) {
        noBtn.textContent = 'Really really?';
        yesBtn.style.fontSize = '1.6rem';
        yesBtn.style.padding = '20px 60px';
    } else if (noClickCount === 3) {
        noBtn.textContent = 'Think again...';
        yesBtn.style.fontSize = '2rem';
        yesBtn.style.padding = '24px 80px';
        noBtn.style.fontSize = '0.7rem';
    } else if (noClickCount === 4) {
        noBtn.textContent = 'Wrong button!';
        yesBtn.style.fontSize = '2.5rem';
        yesBtn.style.padding = '28px 100px';
        noBtn.style.fontSize = '0.5rem';
        noBtn.style.opacity = '0.5';
    } else if (noClickCount >= 5) {
        // No button runs away
        noBtn.textContent = 'Can\'t catch me!';
        noBtn.style.position = 'fixed';
        noBtn.style.fontSize = '0.5rem';
        const moveNoBtn = () => {
            noBtn.style.left = Math.random() * (window.innerWidth - 100) + 'px';
            noBtn.style.top = Math.random() * (window.innerHeight - 50) + 'px';
        };
        moveNoBtn();
        noBtn.onmouseenter = moveNoBtn;
        noBtn.ontouchstart = moveNoBtn;
        yesBtn.style.fontSize = '3rem';
        yesBtn.style.padding = '30px 120px';
        yesBtn.textContent = 'YES!!!';
    }
}

// ============ KEY HIGHLIGHT ============
function highlightKey(key, active) {
    const keyMap = { 'w': 0, 'W': 0, 'ArrowUp': 0, 'e': 1, 'E': 1, 'a': 2, 'A': 2, 'ArrowLeft': 2, 's': 3, 'S': 3, 'ArrowDown': 3, 'd': 4, 'D': 4, 'ArrowRight': 4, ' ': 5, 'Shift': 6, 'shift': 6, 'q': 7, 'Q': 7 };
    const idx = keyMap[key];
    if (idx === undefined) return;
    const allKeys = document.querySelectorAll('#controls-overlay .key');
    if (allKeys[idx]) { if (active) allKeys[idx].classList.add('active'); else allKeys[idx].classList.remove('active'); }
}
