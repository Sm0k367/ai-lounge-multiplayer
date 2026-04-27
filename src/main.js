import * as THREE from 'three';
import { io } from 'socket.io-client';

let scene, camera, renderer;
let player, players = {};
let keys = {};
let socket;

function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x110022, 10, 50);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 12);
    camera.lookAt(0, 2, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Neon lighting
    const ambient = new THREE.AmbientLight(0x4400ff, 0.6);
    scene.add(ambient);
    
    const pointLight = new THREE.PointLight(0xff00aa, 2, 50);
    pointLight.position.set(5, 10, 5);
    scene.add(pointLight);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(40, 40);
    const floorMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x110022, 
        wireframe: true,
        wireframeLinewidth: 1.5
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Player (glowing avatar)
    const playerGeometry = new THREE.SphereGeometry(0.8, 32, 32);
    const playerMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.8,
        shininess: 100
    });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.y = 1;
    scene.add(player);

    // Grid lines
    const grid = new THREE.GridHelper(40, 20, 0xff00ff, 0x00ffff);
    grid.position.y = 0.01;
    scene.add(grid);

    // Initialize socket
    socket = io();

    socket.on('connect', () => {
        console.log('%cConnected to the Neon Grid', 'color:#00ffff; font-family:monospace');
    });

    socket.on('init', (existingPlayers) => {
        players = existingPlayers;
        Object.keys(players).forEach(id => {
            if (id !== socket.id) createOtherPlayer(id, players[id]);
        });
    });

    socket.on('playerJoined', (data) => {
        if (data.id !== socket.id) createOtherPlayer(data.id, data.player);
    });

    socket.on('playerMoved', (data) => {
        if (players[data.id]) {
            players[data.id] = data.player;
            if (players[data.id].mesh) {
                players[data.id].mesh.position.set(data.player.x, data.player.y, data.player.z);
            }
        }
    });

    socket.on('playerLeft', (id) => {
        if (players[id] && players[id].mesh) {
            scene.remove(players[id].mesh);
            delete players[id];
        }
    });

    // Keyboard controls
    window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function createOtherPlayer(id, data) {
    const geometry = new THREE.SphereGeometry(0.8, 32, 32);
    const material = new THREE.MeshPhongMaterial({ 
        color: data.color || 0xff00ff,
        emissive: data.color || 0xff00ff,
        emissiveIntensity: 0.6
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(data.x, data.y, data.z);
    scene.add(mesh);
    players[id].mesh = mesh;
}

function animate() {
    requestAnimationFrame(animate);

    const speed = 0.15;

    if (keys['w']) player.position.z -= speed;
    if (keys['s']) player.position.z += speed;
    if (keys['a']) player.position.x -= speed;
    if (keys['d']) player.position.x += speed;

    // Send position to server
    if (socket) {
        socket.emit('move', {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
            rotationY: 0
        });
    }

    renderer.render(scene, camera);
}

init();
