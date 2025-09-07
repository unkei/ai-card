import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';

let scene, camera, renderer, car, speedometer;
let speed = 0;
const maxSpeed = 0.2;
const acceleration = 0.0005;
const turnDecel = 0.001;
let steering = 0;
let keySteer = 0;
let dragSteer = 0;
let isDragging = false;
let dragStartX = 0;

// Track data (spline-based closed circuit)
const trackWidth = 8; // approximate width of the road in world units
let trackSamples = []; // populated with { pos: Vector3, tangent: Vector3, normal: Vector3 }

function init() {
    scene = new THREE.Scene();
    // Blue sky background
    scene.background = new THREE.Color(0x87ceeb);
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

    // Build a closed race track from a Catmull-Rom spline
    const controlXZ = [
        [0, -26], [12, -26], [26, -20], [32, -6], [28, 8],
        [15, 20], [-2, 26], [-20, 22], [-30, 8], [-30, -6],
        [-22, -18], [-8, -24]
    ];
    const controlPts = controlXZ.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(controlPts, true, 'catmullrom', 0.1);

    const samples = 400;
    trackSamples = [];
    const leftPts = [];
    const rightPts = [];
    for (let i = 0; i < samples; i++) {
        const u = i / samples;
        const p = curve.getPointAt(u);
        const t = curve.getTangentAt(u).setY(0).normalize();
        const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
        const half = trackWidth / 2;
        const left = p.clone().addScaledVector(n, half);
        const right = p.clone().addScaledVector(n, -half);
        left.y = 0.02; // slightly above ground
        right.y = 0.02;
        leftPts.push(left);
        rightPts.push(right);
        trackSamples.push({ pos: p.clone(), tangent: t.clone(), normal: n.clone() });
    }

    // Build road mesh as a triangle strip between left and right edges
    const positions = new Float32Array(samples * 2 * 3);
    const normals = new Float32Array(samples * 2 * 3);
    const indices = [];
    for (let i = 0; i < samples; i++) {
        const li = i * 2 * 3;
        const l = leftPts[i];
        const r = rightPts[i];
        positions[li + 0] = l.x; positions[li + 1] = l.y; positions[li + 2] = l.z;
        positions[li + 3] = r.x; positions[li + 4] = r.y; positions[li + 5] = r.z;
        // Upward normals for both vertices
        normals[li + 0] = 0; normals[li + 1] = 1; normals[li + 2] = 0;
        normals[li + 3] = 0; normals[li + 4] = 1; normals[li + 5] = 0;
        const i0 = i * 2;
        const i1 = i * 2 + 1;
        const i2 = ((i + 1) % samples) * 2;
        const i3 = ((i + 1) % samples) * 2 + 1;
        indices.push(i0, i1, i3, i0, i3, i2);
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    roadGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    roadGeo.setIndex(indices);
    const roadMat = new THREE.MeshPhongMaterial({ color: 0x555555, side: THREE.DoubleSide });
    const road = new THREE.Mesh(roadGeo, roadMat);
    scene.add(road);

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
    // Place car on the track start and align with tangent
    if (trackSamples.length > 0) {
        const start = trackSamples[0];
        car.position.set(start.pos.x, car.position.y, start.pos.z);
        const fx = start.tangent.x, fz = start.tangent.z;
        car.rotation.y = Math.atan2(fx, fz) + Math.PI; // align forward (-Z base) to tangent
    }

    // Raise camera a bit
    camera.position.set(0, 3, 5);
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
                info.textContent = 'Drag or tilt to steer';
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

    document.addEventListener('pointerdown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
    });
    document.addEventListener('pointermove', (e) => {
        if (isDragging) {
            dragSteer = (dragStartX - e.clientX) * 0.005;
        }
    });
    function endDrag() {
        isDragging = false;
        dragSteer = 0;
    }
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
}

function onOrientation(e) {
    steering = THREE.MathUtils.degToRad(e.gamma || 0);
}

function animate() {
    requestAnimationFrame(animate);

    const steer = steering + keySteer + dragSteer;
    if (Math.abs(steer) > 0.05) {
        speed = Math.max(0, speed - turnDecel);
    } else {
        speed = Math.min(maxSpeed, speed + acceleration);
    }

    car.rotation.y -= steer * 0.03;
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(car.rotation).multiplyScalar(speed);
    car.position.add(dir);

    // Clamp car within track width using nearest point on the spline (sampled)
    if (trackSamples.length > 0) {
        let nearest = 0;
        let minD2 = Infinity;
        for (let i = 0; i < trackSamples.length; i++) {
            const p = trackSamples[i].pos;
            const dx = car.position.x - p.x;
            const dz = car.position.z - p.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < minD2) { minD2 = d2; nearest = i; }
        }
        const s = trackSamples[nearest];
        const nx = s.normal.x, nz = s.normal.z;
        const relX = car.position.x - s.pos.x;
        const relZ = car.position.z - s.pos.z;
        const lateral = relX * nx + relZ * nz; // signed perpendicular distance to centerline
        const half = trackWidth / 2;
        if (Math.abs(lateral) > half) {
            const clamped = Math.sign(lateral) * half;
            car.position.x = s.pos.x + nx * clamped;
            car.position.z = s.pos.z + nz * clamped;
            speed = 0; // hit the boundary -> stop
        }
    }

    camera.position.lerp(car.position.clone().add(new THREE.Vector3(0, 3, 5).applyEuler(car.rotation)), 0.1);
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
