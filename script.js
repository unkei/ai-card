import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';

let scene, camera, renderer, car;
let speed = 0;
const maxSpeed = 0.2;
const acceleration = 0.0005;
const turnDecel = 0.001;
let steering = 0;
let keySteer = 0;

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('game') });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const light = new THREE.HemisphereLight(0xffffff, 0x444444);
    scene.add(light);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.MeshPhongMaterial({ color: 0x447744 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const carGeo = new THREE.BoxGeometry(1, 0.5, 2);
    const carMat = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    car = new THREE.Mesh(carGeo, carMat);
    car.position.y = 0.25;
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

    camera.position.lerp(car.position.clone().add(new THREE.Vector3(0, 2, 5).applyEuler(car.rotation)), 0.1);
    camera.lookAt(car.position);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
