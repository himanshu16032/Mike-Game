// ============ MULTIPLAYER (MQTT Relay) ============
let mqttClient = null;
let roomCode = '';
let myId = 'p_' + Math.random().toString(36).substr(2, 9);
let isHost = false;
let opponentJoined = false;
let gameStarted = false;

const BROKER = 'wss://broker.hivemq.com:8884/mqtt';

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function connectBroker(callback) {
    mqttClient = mqtt.connect(BROKER, {
        clientId: myId,
        clean: true,
        connectTimeout: 10000,
        keepalive: 30,
        reconnectPeriod: 2000
    });

    mqttClient.on('connect', () => {
        console.log('Connected to MQTT broker');
        callback();
    });

    mqttClient.on('error', (err) => {
        console.error('MQTT error:', err);
        document.getElementById('connection-status').textContent = 'Broker error: ' + err.message;
    });

    mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.sender === myId) return; // Ignore own messages
            handleMessage(topic, data);
        } catch (e) {
            console.error('Parse error:', e);
        }
    });
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
    if (mqttClient) { mqttClient.end(); mqttClient = null; }
    document.getElementById('step-connect').classList.remove('active');
    document.getElementById('step-choose').classList.add('active');
    document.getElementById('room-code-display').classList.add('hidden');
    document.getElementById('connection-status').textContent = '';
}

// ============ HOST GAME ============
function hostGame() {
    roomCode = generateCode();
    isHost = true;
    document.getElementById('btn-host').disabled = true;
    document.getElementById('connection-status').textContent = 'Connecting to server...';

    connectBroker(() => {
        const topic = 'mikegame/' + roomCode + '/#';
        mqttClient.subscribe(topic, { qos: 0 }, (err) => {
            if (err) {
                document.getElementById('connection-status').textContent = 'Subscribe failed!';
                return;
            }
            document.getElementById('room-code').textContent = roomCode;
            document.getElementById('room-code-display').classList.remove('hidden');
            document.getElementById('connection-status').textContent = 'Room created! Waiting for opponent...';
        });
    });
}

// ============ JOIN GAME ============
function joinGame() {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!code) {
        document.getElementById('connection-status').textContent = 'Enter a room code!';
        return;
    }

    roomCode = code;
    isHost = false;
    document.getElementById('btn-join').disabled = true;
    document.getElementById('connection-status').textContent = 'Connecting...';

    connectBroker(() => {
        const topic = 'mikegame/' + roomCode + '/#';
        mqttClient.subscribe(topic, { qos: 0 }, (err) => {
            if (err) {
                document.getElementById('connection-status').textContent = 'Subscribe failed!';
                return;
            }
            // Tell host we joined
            publish('join', { char: myChar });
            document.getElementById('step-connect').classList.remove('active');
            document.getElementById('step-waiting').classList.add('active');
            document.getElementById('waiting-status').textContent = 'Connected! Waiting for host to start...';
        });
    });
}

// ============ PUBLISH HELPER ============
function publish(subtopic, data) {
    if (!mqttClient || !mqttClient.connected) return;
    data.sender = myId;
    mqttClient.publish(
        'mikegame/' + roomCode + '/' + subtopic,
        JSON.stringify(data),
        { qos: 0 }
    );
}

// ============ MESSAGE HANDLER ============
function handleMessage(topic, data) {
    const parts = topic.split('/');
    const subtopic = parts[2]; // mikegame/CODE/subtopic

    switch (subtopic) {
        case 'join':
            if (isHost && !opponentJoined) {
                opponentJoined = true;
                // Handle character conflict
                if (data.char === myChar) {
                    // Host keeps pick, tell joiner to swap
                    publish('swap', { swapTo: myChar === 'boy' ? 'girl' : 'boy' });
                }
                document.getElementById('step-connect').classList.remove('active');
                document.getElementById('step-waiting').classList.add('active');
                document.getElementById('waiting-status').textContent = 'Opponent joined! Starting game...';
                // Start game after short delay
                setTimeout(() => {
                    publish('start', {});
                    beginGame();
                }, 800);
            }
            break;

        case 'swap':
            if (!isHost) {
                myChar = data.swapTo;
                document.getElementById('waiting-status').textContent =
                    'Same character picked! You are now ' + (myChar === 'boy' ? 'LASER BOY' : 'MIC GIRL');
            }
            break;

        case 'start':
            if (!isHost && !gameStarted) {
                beginGame();
            }
            break;

        case 'state':
            applyRemoteState(data);
            break;

        case 'restart':
            resetPlayers();
            break;
    }
}

function beginGame() {
    if (gameStarted) return;
    gameStarted = true;
    updatePlayerLabels();
    startGameLoop();
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
    if (!mqttClient || !mqttClient.connected || !myChar) return;

    sendCounter++;
    if (sendCounter % 3 !== 0) return; // Send every 3rd frame (~20 updates/sec)

    const me = players[myChar];
    publish('state', {
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

// ============ RESTART ============
function restartGame() {
    resetPlayers();
    publish('restart', {});
}

// ============ COPY CODE ============
function copyCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
        const btn = event.target;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });
}
