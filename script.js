import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';

let scene, camera, renderer, car, speedometer;
let speed = 0;
const maxSpeed = 0.2;
const acceleration = 0.0005;
const turnDecel = 0.001;
let steering = 0;
let keySteer = 0;

// Track dimensions
const outerTrack = { width: 80, height: 40 };
const innerTrack = { width: 40, height: 10 };

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('game') });
    renderer.setSize(window.innerWidth, window.innerHeight);

    speedometer = document.getElementById('speedometer');

    const light = new THREE.HemisphereLight(0xffffff, 0x444444);
    scene.add(light);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.MeshPhongMaterial({ color: 0x447744 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Track surface
    const shape = new THREE.Shape();
    shape.moveTo(-outerTrack.width / 2, -outerTrack.height / 2);
    shape.lineTo(outerTrack.width / 2, -outerTrack.height / 2);
    shape.lineTo(outerTrack.width / 2, outerTrack.height / 2);
    shape.lineTo(-outerTrack.width / 2, outerTrack.height / 2);
    shape.lineTo(-outerTrack.width / 2, -outerTrack.height / 2);

    const hole = new THREE.Path();
    hole.moveTo(-innerTrack.width / 2, -innerTrack.height / 2);
    hole.lineTo(innerTrack.width / 2, -innerTrack.height / 2);
    hole.lineTo(innerTrack.width / 2, innerTrack.height / 2);
    hole.lineTo(-innerTrack.width / 2, innerTrack.height / 2);
    hole.lineTo(-innerTrack.width / 2, -innerTrack.height / 2);
    shape.holes.push(hole);

    const trackGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
    const trackMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.01;
    scene.add(track);

    // Track walls
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const wallH = 1;
    const wallT = 1;
    function addWall(x, z, w, h) {
        const geo = new THREE.BoxGeometry(w, wallH, h);
        const wall = new THREE.Mesh(geo, wallMat);
        wall.position.set(x, wallH / 2, z);
        scene.add(wall);
    }

    addWall(0, -outerTrack.height / 2, outerTrack.width, wallT); // outer top
    addWall(0, outerTrack.height / 2, outerTrack.width, wallT); // outer bottom
    addWall(-outerTrack.width / 2, 0, wallT, outerTrack.height); // outer left
    addWall(outerTrack.width / 2, 0, wallT, outerTrack.height); // outer right

    addWall(0, -innerTrack.height / 2, innerTrack.width, wallT); // inner top
    addWall(0, innerTrack.height / 2, innerTrack.width, wallT); // inner bottom
    addWall(-innerTrack.width / 2, 0, wallT, innerTrack.height); // inner left
    addWall(innerTrack.width / 2, 0, wallT, innerTrack.height); // inner right

    // Car
    car = new THREE.Group();
    car.position.y = 0.2;

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.2, 2),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
    );
    body.position.y = 0.2;
    car.add(body);

    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.2, 0.8),
        new THREE.MeshPhongMaterial({ color: 0xffffff })
    );
    cabin.position.set(0, 0.4, -0.2);
    car.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
    const wheelMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
    [-0.5, 0.5].forEach(x => {
        [-0.9, 0.9].forEach(z => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0, z);
            car.add(wheel);
        });
    });
    scene.add(car);

    camera.position.set(0, 2, 5);
    camera.lookAt(car.position);

    window.addEventListener('resize', onWindowResize);
    setupControls();

    animate();
}

function setupControls() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const info = document.getElementById('info');
        info.addEventListener('click', async () => {
            const res = await DeviceOrientationEvent.requestPermission();
            if (res === 'granted') {
                window.addEventListener('deviceorientation', onOrientation);
                info.textContent = 'Tilt to steer';
            }
        }, { once: true });
    } else {
        window.addEventListener('deviceorientation', onOrientation);
    }

    document.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowLeft') keySteer = 0.5;
        if (e.code === 'ArrowRight') keySteer = -0.5;
    });
    document.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') keySteer = 0;
    });
}

function onOrientation(e) {
    steering = THREE.MathUtils.degToRad(e.gamma || 0);
}

function animate() {
    requestAnimationFrame(animate);

    const steer = steering + keySteer;
    if (Math.abs(steer) > 0.05) {
        speed = Math.max(0, speed - turnDecel);
    } else {
        speed = Math.min(maxSpeed, speed + acceleration);
    }

    car.rotation.y -= steer * 0.03;
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(car.rotation).multiplyScalar(speed);
    car.position.add(dir);

    // Collision with track walls
    const outerX = outerTrack.width / 2 - 0.5;
    const outerZ = outerTrack.height / 2 - 0.5;
    const innerX = innerTrack.width / 2 + 0.5;
    const innerZ = innerTrack.height / 2 + 0.5;

    if (car.position.x > outerX) { car.position.x = outerX; speed = 0; }
    if (car.position.x < -outerX) { car.position.x = -outerX; speed = 0; }
    if (car.position.z > outerZ) { car.position.z = outerZ; speed = 0; }
    if (car.position.z < -outerZ) { car.position.z = -outerZ; speed = 0; }

    if (car.position.x < innerX && car.position.x > -innerX && car.position.z < innerZ && car.position.z > -innerZ) {
        const dx = innerX - Math.abs(car.position.x);
        const dz = innerZ - Math.abs(car.position.z);
        if (dx < dz) {
            car.position.x = Math.sign(car.position.x) * innerX;
        } else {
            car.position.z = Math.sign(car.position.z) * innerZ;
        }
        speed = 0;
    }

    camera.position.lerp(car.position.clone().add(new THREE.Vector3(0, 2, 5).applyEuler(car.rotation)), 0.1);
    camera.lookAt(car.position);

    if (speedometer) {
        speedometer.textContent = `Speed: ${(speed * 1000).toFixed(0)}`;
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
