// ============ MULTIPLAYER (MQTT Relay with fallback brokers) ============
let mqttClient = null;
let roomCode = '';
let myId = 'p_' + Math.random().toString(36).substr(2, 9);
let isHost = false;
let opponentJoined = false;
let gameStarted = false;

// Multiple brokers - try in order until one works
const BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081'
];

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function setStatus(msg) {
    const el = document.getElementById('connection-status');
    if (el) el.textContent = msg;
    console.log('[MikeGame]', msg);
}

function connectBroker(callback, brokerIndex) {
    if (brokerIndex === undefined) brokerIndex = 0;
    if (brokerIndex >= BROKERS.length) {
        setStatus('All brokers failed. Check your internet connection and try again.');
        document.getElementById('btn-host').disabled = false;
        document.getElementById('btn-join').disabled = false;
        return;
    }

    const brokerUrl = BROKERS[brokerIndex];
    setStatus('Connecting to server ' + (brokerIndex + 1) + '/' + BROKERS.length + '...');
    console.log('[MikeGame] Trying broker:', brokerUrl);

    // Clean up previous attempt
    if (mqttClient) {
        try { mqttClient.end(true); } catch (e) {}
        mqttClient = null;
    }

    let connectTimeout = setTimeout(() => {
        console.log('[MikeGame] Broker timeout:', brokerUrl);
        try { mqttClient.end(true); } catch (e) {}
        connectBroker(callback, brokerIndex + 1);
    }, 6000);

    try {
        mqttClient = mqtt.connect(brokerUrl, {
            clientId: myId + '_' + Date.now(),
            clean: true,
            connectTimeout: 5000,
            keepalive: 30,
            reconnectPeriod: 0,  // Don't auto-reconnect, we handle fallback
            protocolVersion: 4
        });
    } catch (e) {
        console.error('[MikeGame] mqtt.connect threw:', e);
        clearTimeout(connectTimeout);
        connectBroker(callback, brokerIndex + 1);
        return;
    }

    mqttClient.on('connect', () => {
        clearTimeout(connectTimeout);
        console.log('[MikeGame] Connected to:', brokerUrl);
        setStatus('Connected to server!');
        callback();
    });

    mqttClient.on('error', (err) => {
        console.error('[MikeGame] MQTT error on', brokerUrl, ':', err.message);
    });

    mqttClient.on('close', () => {
        console.log('[MikeGame] Connection closed for', brokerUrl);
    });

    mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.sender === myId) return;
            handleMessage(topic, data);
        } catch (e) {
            console.error('[MikeGame] Parse error:', e);
        }
    });
}

// ============ CHARACTER SELECTION ============
function selectCharacter(char) {
    myChar = char;
    document.getElementById('step-choose').classList.remove('active');
    document.getElementById('step-connect').classList.add('active');
    document.getElementById('selected-char-label').textContent =
        'You selected: ' + (char === 'boy' ? 'LASER BOY' : 'MIC GIRL');
}

function goBack() {
    myChar = null;
    if (mqttClient) { try { mqttClient.end(true); } catch (e) {} mqttClient = null; }
    document.getElementById('step-connect').classList.remove('active');
    document.getElementById('step-choose').classList.add('active');
    document.getElementById('room-code-display').classList.add('hidden');
    setStatus('');
}

// ============ HOST GAME ============
function hostGame() {
    roomCode = generateCode();
    isHost = true;
    document.getElementById('btn-host').disabled = true;

    connectBroker(() => {
        const topic = 'mikegame/' + roomCode + '/#';
        mqttClient.subscribe(topic, { qos: 0 }, (err) => {
            if (err) {
                setStatus('Subscribe failed! Try again.');
                document.getElementById('btn-host').disabled = false;
                return;
            }
            document.getElementById('room-code').textContent = roomCode;
            document.getElementById('room-code-display').classList.remove('hidden');
            setStatus('Room created! Share the code and wait...');
        });
    });
}

// ============ JOIN GAME ============
function joinGame() {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!code) {
        setStatus('Enter a room code!');
        return;
    }

    roomCode = code;
    isHost = false;
    document.getElementById('btn-join').disabled = true;

    connectBroker(() => {
        const topic = 'mikegame/' + roomCode + '/#';
        mqttClient.subscribe(topic, { qos: 0 }, (err) => {
            if (err) {
                setStatus('Subscribe failed! Try again.');
                document.getElementById('btn-join').disabled = false;
                return;
            }
            // Tell host we joined
            publish('join', { char: myChar });
            document.getElementById('step-connect').classList.remove('active');
            document.getElementById('step-waiting').classList.add('active');
            document.getElementById('waiting-status').textContent = 'Connected! Waiting for host...';
        });
    });
}

// ============ PUBLISH HELPER ============
function publish(subtopic, data) {
    if (!mqttClient || !mqttClient.connected) return;
    data.sender = myId;
    const topic = 'mikegame/' + roomCode + '/' + subtopic;
    mqttClient.publish(topic, JSON.stringify(data), { qos: 0 });
}

// ============ MESSAGE HANDLER ============
function handleMessage(topic, data) {
    const parts = topic.split('/');
    const subtopic = parts[2];

    switch (subtopic) {
        case 'join':
            if (isHost && !opponentJoined) {
                opponentJoined = true;
                if (data.char === myChar) {
                    publish('swap', { swapTo: myChar === 'boy' ? 'girl' : 'boy' });
                }
                document.getElementById('step-connect').classList.remove('active');
                document.getElementById('step-waiting').classList.add('active');
                document.getElementById('waiting-status').textContent = 'Opponent joined! Starting...';
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
                    'Same pick! You are now ' + (myChar === 'boy' ? 'LASER BOY' : 'MIC GIRL');
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
    if (sendCounter % 3 !== 0) return;

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
