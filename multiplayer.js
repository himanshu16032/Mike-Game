// ============ MULTIPLAYER (PeerJS) ============
let peer = null;
let conn = null;
let isHost = false;
let roomCode = '';
let localReady = false;
let remoteReady = false;

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

    peer = new Peer('mikegame-' + roomCode);

    peer.on('open', (id) => {
        console.log('Host peer open with ID:', id);
        document.getElementById('room-code').textContent = roomCode;
        document.getElementById('room-code-display').classList.remove('hidden');
        document.getElementById('connection-status').textContent = 'Room created! Waiting for opponent...';
        isHost = true;
    });

    peer.on('connection', (connection) => {
        console.log('Host received connection');
        conn = connection;
        onConnected();
        conn.on('open', () => {
            console.log('Host conn open event');
            onConnected();
        });
        conn.on('data', (data) => handlePeerData(data));
        conn.on('close', () => {
            if (gameRunning) endGame('Opponent Disconnected!');
        });
    });

    peer.on('error', (err) => {
        console.error('Host peer error:', err);
        document.getElementById('connection-status').textContent = 'Error: ' + err.type + ' - ' + err.message;
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

    peer = new Peer();

    peer.on('open', (id) => {
        console.log('Joiner peer open with ID:', id);
        conn = peer.connect('mikegame-' + code, { reliable: true });

        conn.on('open', () => {
            console.log('Joiner conn open event');
            onConnected();
        });
        conn.on('data', (data) => handlePeerData(data));
        conn.on('close', () => {
            if (gameRunning) endGame('Opponent Disconnected!');
        });
        conn.on('error', (err) => {
            console.error('Joiner conn error:', err);
            document.getElementById('connection-status').textContent = 'Connection failed: ' + err;
            document.getElementById('btn-join').disabled = false;
        });
    });

    peer.on('error', (err) => {
        console.error('Joiner peer error:', err);
        document.getElementById('connection-status').textContent = 'Error: ' + err.type + ' - ' + err.message;
        document.getElementById('btn-join').disabled = false;
    });
}

// ============ ON CONNECTED ============
let connected = false;

function onConnected() {
    if (connected) return; // Only run once
    // Check if connection is actually open
    if (!conn || !conn.open) {
        console.log('onConnected called but conn not open yet, waiting...');
        return;
    }
    connected = true;
    console.log('Connection established! Sending charSelect:', myChar);

    // Move to waiting screen
    document.getElementById('step-connect').classList.remove('active');
    document.getElementById('step-waiting').classList.add('active');
    document.getElementById('waiting-status').textContent = 'Connected! Setting up game...';

    // Send character choice
    conn.send({ type: 'charSelect', char: myChar });
}

// ============ HANDLE PEER DATA ============
function handlePeerData(data) {
    if (!data || !data.type) return;
    console.log('Received:', data.type);

    switch (data.type) {
        case 'charSelect':
            const opponentChar = data.char;
            if (opponentChar === myChar) {
                // Both picked same character - host keeps their pick, joiner swaps
                if (!isHost) {
                    myChar = myChar === 'boy' ? 'girl' : 'boy';
                    document.getElementById('waiting-status').textContent =
                        'Opponent picked same character! You are now ' +
                        (myChar === 'boy' ? 'LASER BOY' : 'MIC GIRL');
                }
            }
            // Mark remote as ready and send our ready signal
            remoteReady = true;
            conn.send({ type: 'ready' });
            tryStartGame();
            break;

        case 'ready':
            remoteReady = true;
            tryStartGame();
            break;

        case 'state':
            applyRemoteState(data);
            break;

        case 'restart':
            resetPlayers();
            break;
    }
}

function tryStartGame() {
    // We need: connection open + we sent charSelect (localReady) + received charSelect (remoteReady)
    if (!localReady) {
        localReady = true;
        conn.send({ type: 'ready' });
    }

    if (localReady && remoteReady) {
        console.log('Both ready! Starting game. I am:', myChar);
        document.getElementById('waiting-status').textContent = 'Starting!';
        updatePlayerLabels();
        setTimeout(() => startGameLoop(), 300);
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
    if (sendCounter % 2 !== 0) return;

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
