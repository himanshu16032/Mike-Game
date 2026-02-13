// ============ MULTIPLAYER (PeerJS) ============
let peer = null;
let conn = null;
let isHost = false;
let roomCode = '';

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ============ CHARACTER SELECTION ============
function selectCharacter(char) {
    myChar = char;
    document.getElementById('step-choose').classList.remove('active');
    document.getElementById('step-connect').classList.add('active');
    document.getElementById('selected-char-label').textContent =
        `You selected: ${char === 'boy' ? 'LASER BOY' : 'MIC GIRL'}`;
}

function goBack() {
    myChar = null;
    if (peer) { peer.destroy(); peer = null; }
    document.getElementById('step-connect').classList.remove('active');
    document.getElementById('step-choose').classList.add('active');
    document.getElementById('room-code-display').classList.add('hidden');
    document.getElementById('connection-status').textContent = '';
}

// ============ HOST GAME ============
function hostGame() {
    roomCode = generateCode();
    document.getElementById('btn-host').disabled = true;
    document.getElementById('connection-status').textContent = 'Creating room...';

    peer = new Peer('mikegame-' + roomCode, {
        debug: 0
    });

    peer.on('open', (id) => {
        document.getElementById('room-code').textContent = roomCode;
        document.getElementById('room-code-display').classList.remove('hidden');
        document.getElementById('connection-status').textContent = 'Room created! Waiting for opponent...';
        isHost = true;
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection();
    });

    peer.on('error', (err) => {
        document.getElementById('connection-status').textContent = 'Error: ' + err.message;
        document.getElementById('btn-host').disabled = false;
    });
}

// ============ JOIN GAME ============
function joinGame() {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!code) {
        document.getElementById('connection-status').textContent = 'Enter a room code!';
        return;
    }

    document.getElementById('btn-join').disabled = true;
    document.getElementById('connection-status').textContent = 'Connecting...';

    peer = new Peer(undefined, { debug: 0 });

    peer.on('open', () => {
        conn = peer.connect('mikegame-' + code, { reliable: true });
        setupConnection();
    });

    peer.on('error', (err) => {
        document.getElementById('connection-status').textContent = 'Error: ' + err.message;
        document.getElementById('btn-join').disabled = false;
    });
}

// ============ CONNECTION HANDLING ============
function setupConnection() {
    conn.on('open', () => {
        document.getElementById('step-connect').classList.remove('active');
        document.getElementById('step-waiting').classList.add('active');
        document.getElementById('waiting-status').textContent = 'Connected! Setting up game...';

        // Send character choice
        conn.send({ type: 'charSelect', char: myChar });
    });

    conn.on('data', (data) => {
        handlePeerData(data);
    });

    conn.on('close', () => {
        if (gameRunning) {
            endGame('Opponent Disconnected!');
        }
    });
}

function handlePeerData(data) {
    if (!data || !data.type) return;

    switch (data.type) {
        case 'charSelect':
            // Opponent selected their character
            const opponentChar = data.char;
            if (opponentChar === myChar) {
                // Both picked same - swap the joiner
                if (!isHost) {
                    myChar = myChar === 'boy' ? 'girl' : 'boy';
                    conn.send({ type: 'charSelect', char: myChar });
                }
            }
            // Update HUD labels
            updatePlayerLabels();
            // Small delay then start
            setTimeout(() => {
                conn.send({ type: 'ready' });
                checkReady();
            }, 500);
            break;

        case 'ready':
            checkReady();
            break;

        case 'state':
            // Receive opponent state
            applyRemoteState(data);
            break;

        case 'projectile':
            // Opponent fired
            projectiles.push(data.proj);
            break;

        case 'restart':
            resetPlayers();
            break;
    }
}

let localReady = false;
let remoteReady = false;

function checkReady() {
    if (!localReady) {
        localReady = true;
        conn.send({ type: 'ready' });
    } else {
        remoteReady = true;
    }

    if (localReady && remoteReady) {
        updatePlayerLabels();
        startGameLoop();
    } else if (localReady) {
        // Received ready from peer, mark remote as ready too
        remoteReady = true;
        updatePlayerLabels();
        startGameLoop();
    }
}

function updatePlayerLabels() {
    if (myChar === 'boy') {
        document.getElementById('p1-name').textContent = 'LASER BOY (You)';
        document.getElementById('p2-name').textContent = 'MIC GIRL';
    } else {
        document.getElementById('p1-name').textContent = 'LASER BOY';
        document.getElementById('p2-name').textContent = 'MIC GIRL (You)';
    }
}

// ============ SYNC STATE ============
let sendCounter = 0;

function sendState() {
    if (!conn || !conn.open || !myChar) return;

    sendCounter++;
    if (sendCounter % 2 !== 0) return; // Send every other frame

    const me = players[myChar];
    conn.send({
        type: 'state',
        char: myChar,
        x: me.x,
        y: me.y,
        vy: me.vy,
        hp: me.hp,
        facing: me.facing,
        attacking: me.attacking,
        walkCycle: me.walkCycle,
        onGround: me.onGround,
        hitFlash: me.hitFlash,
        projectiles: projectiles.filter(p => p.owner === myChar).map(p => ({
            x: p.x, y: p.y, vx: p.vx, vy: p.vy,
            owner: p.owner, type: p.type, life: p.life, damage: p.damage
        }))
    });
}

function applyRemoteState(data) {
    const opponentChar = data.char;
    if (!opponentChar || opponentChar === myChar) return;

    const opp = players[opponentChar];
    opp.x = data.x;
    opp.y = data.y;
    opp.vy = data.vy;
    opp.facing = data.facing;
    opp.attacking = data.attacking;
    opp.walkCycle = data.walkCycle;
    opp.onGround = data.onGround;
    opp.hitFlash = data.hitFlash;

    // Sync opponent projectiles
    const myProjectiles = projectiles.filter(p => p.owner === myChar);
    const remoteProjectiles = data.projectiles || [];
    projectiles = [...myProjectiles, ...remoteProjectiles];
}

// ============ COPY CODE ============
function copyCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
        const btn = event.target;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });
}
