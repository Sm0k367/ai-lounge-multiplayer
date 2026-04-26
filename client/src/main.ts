import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';

interface PlayerData {
    x: number;
    y: number;
    z: number;
    rotationY?: number;
}

interface OtherPlayer {
    mesh: THREE.Mesh;
    label?: THREE.Sprite;
}

interface ChatMessage {
    id: string;
    msg: string;
    username?: string;
}

const socket: Socket = io('http://localhost:3000', {
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 10000
});

let playerId: string;
const players: { [id: string]: PlayerData } = {};
const otherPlayers: { [id: string]: OtherPlayer } = {};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x110022, 0.035);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 8, 15);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: false,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// === CYBERPUNK LIGHTING ===
const ambient = new THREE.AmbientLight(0x220033, 0.4);
scene.add(ambient);

const neonLights: THREE.PointLight[] = [];
const colors = [0x9d00ff, 0x00f0ff, 0xff2a2a];

colors.forEach((color, i) => {
    const light = new THREE.PointLight(color, 4.5, 80);
    light.position.set(
        (i - 1) * 18, 
        12 + Math.random() * 8, 
        (i - 1) * -12
    );
    scene.add(light);
    neonLights.push(light);
});

// Floor - reflective cyber grid
const floorGeo = new THREE.PlaneGeometry(200, 200);
const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x0a0011, 
    metalness: 0.9, 
    roughness: 0.2,
    emissive: 0x220044,
    emissiveIntensity: 0.6
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI * 0.5;
floor.receiveShadow = true;
scene.add(floor);

// Grid helper for cyber feel
const grid = new THREE.GridHelper(200, 60, 0x00ffff, 0x00ffff);
grid.material.opacity = 0.15;
grid.material.transparent = true;
scene.add(grid);

// Central platform
const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 12, 1.2, 6),
    new THREE.MeshStandardMaterial({
        color: 0x110022,
        emissive: 0x440066,
        metalness: 0.8,
        roughness: 0.3
    })
);
platform.position.y = 0.6;
scene.add(platform);

// Player (self) - glowing capsule
const playerGeometry = new THREE.CapsuleGeometry(0.8, 2.2, 8, 16);
const playerMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 1.2,
    metalness: 0.3,
    roughness: 0.1
});
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.castShadow = true;
player.receiveShadow = true;
player.position.set(0, 2, 0);
scene.add(player);

// Simple particle system for ambient neon sparks
const particlesGeometry = new THREE.BufferGeometry();
const particleCount = 180;
const positions = new Float32Array(particleCount * 3);
const colorsArray = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 120;
    positions[i + 1] = Math.random() * 35;
    positions[i + 2] = (Math.random() - 0.5) * 120;
    
    const hue = Math.random();
    colorsArray[i] = hue > 0.6 ? 0.6 : 0.1;     // R
    colorsArray[i+1] = 0.9;                      // G
    colorsArray[i+2] = 1.0;                      // B
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.35,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending
});

const sparkParticles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(sparkParticles);

// Networking state
let keys: { [key: string]: boolean } = {};
let moveSpeed = 0.28;
let lastSendTime = 0;
const SEND_RATE = 1000 / 30; // 30 times per second

// Chat
const chatMessages = document.getElementById('chat-messages') as HTMLDivElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const fpsCounter = document.getElementById('fps') as HTMLDivElement;

let frameCount = 0;
let lastTime = Date.now();
let currentFPS = 60;

function addChatMessage(data: ChatMessage, isSelf = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${data.id === 'SYSTEM' ? 'system' : ''}`;
    
    const username = data.id === playerId ? 'YOU' : `PLAYER-${data.id.slice(0,6)}`;
    msgDiv.innerHTML = `<span style="color:#ff2a2a">[${username}]</span> ${data.msg}`;
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Auto remove old messages
    if (chatMessages.children.length > 12) {
        chatMessages.removeChild(chatMessages.children[0]);
    }
}

// Socket handlers
socket.on('connect', () => {
    console.log('%cConnected to AI Lounge server', 'color:#00ff9d; font-weight:bold');
    addChatMessage({ id: 'SYSTEM', msg: 'CONNECTED TO THE LOUNGE...' }, true);
});

socket.on('init', (serverPlayers: { [id: string]: PlayerData }) => {
    playerId = socket.id;
    Object.keys(serverPlayers).forEach(id => {
        if (id !== socket.id) {
            createOtherPlayer(id, serverPlayers[id]);
        }
    });
    addChatMessage({ id: 'SYSTEM', msg: `Welcome, PLAYER ${socket.id.slice(0,6)}. ${Object.keys(serverPlayers).length} souls online.` });
});

socket.on('playerJoined', ({ id, player }: { id: string; player: PlayerData }) => {
    if (id !== socket.id) {
        createOtherPlayer(id, player);
        addChatMessage({ id: 'SYSTEM', msg: `PLAYER ${id.slice(0,6)} ENTERED THE LOUNGE` });
    }
});

socket.on('playerMoved', ({ id, player }: { id: string; player: PlayerData }) => {
    if (otherPlayers[id]) {
        otherPlayers[id].mesh.position.set(player.x, player.y || 2, player.z);
        if (player.rotationY !== undefined) {
            otherPlayers[id].mesh.rotation.y = player.rotationY;
        }
    }
});

socket.on('playerLeft', (id: string) => {
    if (otherPlayers[id]) {
        scene.remove(otherPlayers[id].mesh);
        delete otherPlayers[id];
        addChatMessage({ id: 'SYSTEM', msg: `PLAYER ${id.slice(0,6)} LEFT THE VOID` });
    }
});

socket.on('chat', (data: ChatMessage) => {
    addChatMessage(data);
});

socket.on('disconnect', () => {
    addChatMessage({ id: 'SYSTEM', msg: 'DISCONNECTED FROM THE LOUNGE. RECONNECTING...' });
});

// Create other player avatar
function createOtherPlayer(id: string, initialData: PlayerData) {
    const hue = Math.random();
    const color = new THREE.Color().setHSL(hue, 1.0, 0.7);
    
    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 1.8,
        metalness: 0.4,
        roughness: 0.2
    });
    
    const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.75, 2.0, 6, 12), 
        material
    );
    
    mesh.position.set(initialData.x, initialData.y || 2, initialData.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    scene.add(mesh);
    otherPlayers[id] = { mesh };
}

// Input
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    if (e.key === 'Enter') {
        if (document.activeElement !== chatInput) {
            chatInput.focus();
        } else if (chatInput.value.trim()) {
            const msg = chatInput.value.trim();
            socket.emit('chat', msg);
            chatInput.value = '';
            chatInput.blur();
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Click to lock pointer for future mouse look
renderer.domElement.addEventListener('click', () => {
    if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
    }
});

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Master 15-second cycle for "After Dark" chaos
function getCycleTime(): number {
    return (performance.now() / 1000) % 15;
}

function updateLightingAndEffects(time: number) {
    const cycle = getCycleTime();
    
    // Pulse all neon lights
    neonLights.forEach((light, i) => {
        const phase = cycle * 1.8 + i * 1.2;
        light.intensity = 3.5 + Math.sin(phase) * 2.2;
        light.position.y = 11 + Math.sin(phase * 0.6) * 4;
    });
    
    // Spark particles float and pulse
    const positions = sparkParticles.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 1; i < positions.count * 3; i += 3) {
        positions.array[i] += 0.012 + Math.sin(time * 0.001 + i) * 0.008;
        if (positions.array[i] > 38) positions.array[i] = 3;
    }
    positions.needsUpdate = true;
    
    // Subtle floor emissive pulse
    if (floor.material instanceof THREE.MeshStandardMaterial) {
        floor.material.emissiveIntensity = 0.5 + Math.sin(cycle * 2) * 0.3;
    }
    
    // Occasional "glitch" on platform
    if (Math.random() < 0.015) {
        platform.scale.set(1 + Math.random() * 0.1, 1, 1 + Math.random() * 0.1);
        setTimeout(() => {
            platform.scale.set(1, 1, 1);
        }, 120);
    }
}

function updateMovement(delta: number) {
    let moved = false;
    
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    
    // Simple WASD in world space for starter (improve with camera relative later)
    if (keys['w']) {
        player.position.x -= 0.02 * 12 * delta * 60;
        player.position.z -= 0.02 * 12 * delta * 60;
        moved = true;
    }
    if (keys['s']) {
        player.position.x += 0.02 * 12 * delta * 60;
        player.position.z += 0.02 * 12 * delta * 60;
        moved = true;
    }
    if (keys['a']) {
        player.position.x -= 0.03 * 12 * delta * 60;
        moved = true;
    }
    if (keys['d']) {
        player.position.x += 0.03 * 12 * delta * 60;
        moved = true;
    }
    
    // Keep player on platform-ish level
    player.position.y = 2.2;
    
    // Send position updates at fixed rate
    const now = Date.now();
    if (moved && now - lastSendTime > SEND_RATE) {
        const data: PlayerData = {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
            rotationY: player.rotation.y
        };
        socket.emit('move', data);
        lastSendTime = now;
        players[socket.id] = data;
    }
    
    // Camera follows with cinematic lag
    const idealCameraX = player.position.x * 0.6;
    const idealCameraZ = player.position.z + 18;
    
    camera.position.x += (idealCameraX - camera.position.x) * 0.065;
    camera.position.z += (idealCameraZ - camera.position.z) * 0.085;
    camera.position.y = 9 + Math.sin(Date.now() * 0.0008) * 1.5;
    
    camera.lookAt(
        player.position.x * 0.3, 
        player.position.y + 3.5, 
        player.position.z * 0.3
    );
}

let previousTime = performance.now();

function animate() {
    const now = performance.now();
    const delta = (now - previousTime) / 1000;
    previousTime = now;
    
    requestAnimationFrame(animate);
    
    frameCount++;
    if (now - lastTime > 1000) {
        currentFPS = frameCount;
        frameCount = 0;
        lastTime = now;
        fpsCounter.textContent = `FPS: ${currentFPS} | ${Object.keys(otherPlayers).length + 1} SOULS`;
    }
    
    const time = Date.now();
    
    updateMovement(delta);
    updateLightingAndEffects(time);
    
    // Gentle player bob
    player.position.y = 2.2 + Math.sin(time * 0.003) * 0.12;
    player.rotation.y = Math.sin(time * 0.0015) * 0.1;
    
    renderer.render(scene, camera);
}

// Start the experience
animate();

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    socket.disconnect();
});

console.log('%c🎮 AI LOUNGE AFTER DARK INITIALIZED — NEON PROTOCOL ACTIVE', 'color:#ff00ff; font-size:13px; font-family:monospace');
