const imageInput = document.getElementById('imageInput');
const dropZone = document.getElementById('dropZone');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const apiKeyInput = document.getElementById('apiKeyInput');

const workoutScreen = document.getElementById('workoutScreen');
const exerciseTitle = document.getElementById('exerciseTitle');
const timerDisplay = document.getElementById('timer');
const aiFeedback = document.getElementById('aiFeedback');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const backBtn = document.getElementById('backBtn');
const repCountDisplay = document.getElementById('repCount');
const libraryList = document.getElementById('libraryList');

const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');

let timerInterval = null;
let secondsPassed = 0;
let isPaused = false;
let base64Image = "";
let camera = null;
let pose = null;

let repCount = 0;
let exerciseStage = "up";
let lastVoiceTime = 0;
let audioCtx = null;

// Three.js Сцена та 3D Аватар
let scene, camera3D, renderer, clock;
let avatarModel = null;
let avatarBones = {};
let currentExerciseType = "squat";

let exerciseLibrary = JSON.parse(localStorage.getItem('fitmae_library')) || [];
let userStats = JSON.parse(localStorage.getItem('fitmae_stats')) || { workouts: 0, minutes: 0, calories: 0 };

const motivationalPhrases = [
    "Чудовий темп! Твоє тіло скаже дякую! ✨",
    "Не філонь, тримай техніку ідеальною! 💅",
    "Палає? Значить жирок покидає чат! 🔥",
    "Спинку рівно! Уяви, що ззаду твоя мрія! 😉",
    "Ще трішки! Не здавайся, красуне!",
    "Ідеальне виконання! Працюємо далі! 💪"
];

// Побудова деталізованої 3D дівчини-тренерки у стилі Pixar
function createPixarAvatar() {
    avatarModel = new THREE.Group();

    // Високоякісні матеріали з м'якими відблисками
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.35, metalness: 0.05 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x2c1609, roughness: 0.5 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0x1a1528, roughness: 0.2, metalness: 0.1 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.3 }); // Рожева неонова смужка
    const leggingsMat = new THREE.MeshStandardMaterial({ color: 0x110c1f, roughness: 0.3, metalness: 0.1 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });

    // Скелетні вузли для повноцінних анімацій будь-якої вправи
    const spine = new THREE.Group();
    const headGroup = new THREE.Group();
    const leftHip = new THREE.Group();
    const rightHip = new THREE.Group();
    const leftKnee = new THREE.Group();
    const rightKnee = new THREE.Group();
    const leftShoulder = new THREE.Group();
    const rightShoulder = new THREE.Group();
    const leftElbow = new THREE.Group();
    const rightElbow = new THREE.Group();

    avatarBones = {
        spine, headGroup, leftHip, rightHip, leftKnee, rightKnee,
        leftShoulder, rightShoulder, leftElbow, rightElbow
    };

    // 1. Голова у стилі Pixar (більші очі, м'які форми)
    const headGeo = new THREE.SphereGeometry(0.13, 32, 32);
    headGeo.scale(1, 1.15, 0.95);
    const head = new THREE.Mesh(headGeo, skinMat);
    headGroup.position.y = 1.48;
    headGroup.add(head);

    // Волосся та високий хвіст
    const hairCapGeo = new THREE.SphereGeometry(0.136, 32, 32);
    const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
    hairCap.position.set(0, 0.02, -0.01);
    headGroup.add(hairCap);

    const ponytailGroup = new THREE.Group();
    ponytailGroup.position.set(0, 0.05, -0.12);
    const ponytailGeo = new THREE.CylinderGeometry(0.02, 0.06, 0.32, 16);
    const ponytail = new THREE.Mesh(ponytailGeo, hairMat);
    ponytail.rotation.x = -Math.PI / 3;
    ponytail.position.y = -0.12;
    ponytailGroup.add(ponytail);
    headGroup.add(ponytailGroup);
    avatarBones.ponytail = ponytailGroup;

    // Виразні очі Pixar
    const eyeGeo = new THREE.SphereGeometry(0.022, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1f1105 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.045, 0.01, 0.11);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.045, 0.01, 0.11);
    headGroup.add(leftEye, rightEye);

    // 2. Торс і Спортивний Топ
    spine.position.y = 1.15;
    const torsoGeo = new THREE.CylinderGeometry(0.11, 0.08, 0.35, 32);
    const torso = new THREE.Mesh(torsoGeo, topMat);
    torso.castShadow = true;
    spine.add(torso);

    const stripeGeo = new THREE.CylinderGeometry(0.112, 0.108, 0.04, 32);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = -0.06;
    spine.add(stripe);

    spine.add(headGroup);

    // 3. Таз та Ноги
    const pelvisGeo = new THREE.CylinderGeometry(0.08, 0.115, 0.16, 32);
    const pelvis = new THREE.Mesh(pelvisGeo, leggingsMat);
    pelvis.position.y = 0.92;
    avatarModel.add(pelvis);

    // Ліва нога
    leftHip.position.set(-0.085, 0.86, 0);
    const lThighGeo = new THREE.CylinderGeometry(0.058, 0.042, 0.38, 16);
    const lThigh = new THREE.Mesh(lThighGeo, leggingsMat);
    lThigh.position.y = -0.19;
    leftHip.add(lThigh);

    leftKnee.position.y = -0.38;
    const lShinGeo = new THREE.CylinderGeometry(0.042, 0.032, 0.38, 16);
    const lShin = new THREE.Mesh(lShinGeo, leggingsMat);
    lShin.position.y = -0.19;
    leftKnee.add(lShin);

    const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.15), shoeMat);
    lShoe.position.set(0, -0.4, 0.03);
    leftKnee.add(lShoe);
    leftHip.add(leftKnee);

    // Права нога
    rightHip.position.set(0.085, 0.86, 0);
    const rThigh = new THREE.Mesh(lThighGeo, leggingsMat);
    rThigh.position.y = -0.19;
    rightHip.add(rThigh);

    rightKnee.position.y = -0.38;
    const rShin = new THREE.Mesh(lShinGeo, leggingsMat);
    rShin.position.y = -0.19;
    rightKnee.add(rShin);

    const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.15), shoeMat);
    rShoe.position.set(0, -0.4, 0.03);
    rightKnee.add(rShoe);
    rightHip.add(rightKnee);

    avatarModel.add(leftHip, rightHip, spine);

    // 4. Руки
    leftShoulder.position.set(-0.145, 0.12, 0);
    const lArmGeo = new THREE.CylinderGeometry(0.034, 0.028, 0.32, 16);
    const lArm = new THREE.Mesh(lArmGeo, skinMat);
    lArm.position.y = -0.16;
    leftShoulder.add(lArm);

    leftElbow.position.y = -0.32;
    const lForearmGeo = new THREE.CylinderGeometry(0.028, 0.022, 0.3, 16);
    const lForearm = new THREE.Mesh(lForearmGeo, skinMat);
    lForearm.position.y = -0.15;
    leftElbow.add(lForearm);
    leftShoulder.add(leftElbow);

    rightShoulder.position.set(0.145, 0.12, 0);
    const rArm = new THREE.Mesh(lArmGeo, skinMat);
    rArm.position.y = -0.16;
    rightShoulder.add(rArm);

    rightElbow.position.y = -0.32;
    const rForearm = new THREE.Mesh(lForearmGeo, skinMat);
    rForearm.position.y = -0.15;
    rightElbow.add(rForearm);
    rightShoulder.add(rightElbow);

    spine.add(leftShoulder, rightShoulder);

    scene.add(avatarModel);
}

// 3D Сцена
function initFull3DScene() {
    const container = document.getElementById('threejs-canvas-container');
    if (!container) return;
    container.innerHTML = '';

    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0813);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    camera3D = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera3D.position.set(0, 1.1, 2.7);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // М'яке студійне світло
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xa855f7, 2.0);
    mainLight.position.set(2, 4, 3);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const pinkRimLight = new THREE.PointLight(0xec4899, 2.2, 10);
    pinkRimLight.position.set(-2, 2, 2);
    scene.add(pinkRimLight);

    // 3D Килимок
    const matMat = new THREE.MeshStandardMaterial({ color: 0x221a36, roughness: 0.6 });
    const mat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 1.8), matMat);
    mat.position.set(0, -0.01, 0);
    mat.receiveShadow = true;
    scene.add(mat);

    createPixarAvatar();
    animate3D();

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    const container = document.getElementById('threejs-canvas-container');
    if (!container || !renderer || !camera3D) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera3D.aspect = width / height;
    camera3D.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Генератор анімацій будь-якої розпізнаної вправи
function animate3D() {
    requestAnimationFrame(animate3D);
    const time = clock.getElapsedTime();

    if (!avatarModel || !avatarBones.spine) return;

    const b = avatarBones;

    // Скидання кісток у базове положення
    avatarModel.position.set(0, 0, 0);
    avatarModel.rotation.set(0, 0, 0);
    b.spine.rotation.set(0, 0, 0);
    b.leftHip.rotation.set(0, 0, 0);
    b.rightHip.rotation.set(0, 0, 0);
    b.leftKnee.rotation.set(0, 0, 0);
    b.rightKnee.rotation.set(0, 0, 0);
    b.leftShoulder.rotation.set(0, 0, 0.2);
    b.rightShoulder.rotation.set(0, 0, -0.2);
    b.leftElbow.rotation.set(0, 0, 0);
    b.rightElbow.rotation.set(0, 0, 0);

    // 1. Присідання (Squat)
    if (currentExerciseType === "squat") {
        const squat = (Math.sin(time * 2.2) + 1) / 2;
        avatarModel.position.y = -squat * 0.35;
        b.leftHip.rotation.x = -squat * 1.1;
        b.rightHip.rotation.x = -squat * 1.1;
        b.leftKnee.rotation.x = squat * 1.25;
        b.rightKnee.rotation.x = squat * 1.25;
        b.spine.rotation.x = squat * 0.3;
        b.leftShoulder.rotation.x = -squat * 1.3;
        b.rightShoulder.rotation.x = -squat * 1.3;
    }
    // 2. Планка (Plank)
    else if (currentExerciseType === "plank") {
        avatarModel.rotation.x = Math.PI / 2;
        avatarModel.position.set(0, 0.25, 0);
        b.leftShoulder.rotation.x = Math.PI / 2.2;
        b.rightShoulder.rotation.x = Math.PI / 2.2;
        b.leftElbow.rotation.x = -Math.PI / 3;
        b.rightElbow.rotation.x = -Math.PI / 3;
        avatarModel.position.y = 0.25 + Math.sin(time * 3) * 0.015;
    }
    // 3. Випади (Lunge)
    else if (currentExerciseType === "lunge") {
        const lunge = (Math.sin(time * 2.0) + 1) / 2;
        avatarModel.position.y = -lunge * 0.3;
        b.leftHip.rotation.x = -lunge * 1.2;
        b.leftKnee.rotation.x = lunge * 1.2;
        b.rightHip.rotation.x = lunge * 0.6;
        b.rightKnee.rotation.x = lunge * 0.8;
    }
    // 4. Віджимання (Push-ups)
    else if (currentExerciseType === "pushup") {
        avatarModel.rotation.x = Math.PI / 2;
        const push = (Math.sin(time * 2.5) + 1) / 2;
        avatarModel.position.set(0, 0.18 + push * 0.2, 0);
        b.leftShoulder.rotation.z = 0.8;
        b.rightShoulder.rotation.z = -0.8;
        b.leftElbow.rotation.x = (1 - push) * 1.2;
        b.rightElbow.rotation.x = (1 - push) * 1.2;
    }
    // 5. Махи ногами (Leg raise)
    else if (currentExerciseType === "leg_raise") {
        const raise = (Math.sin(time * 3.0) + 1) / 2;
        b.rightHip.rotation.x = -raise * 1.3;
        b.leftShoulder.rotation.z = 0.5;
        b.rightShoulder.rotation.z = -0.5;
    }
    // 6. Універсальна анімація для інших вправ
    else {
        const move = Math.sin(time * 2.5);
        avatarModel.position.y = Math.abs(move) * 0.06;
        b.leftShoulder.rotation.x = move * 0.5;
        b.rightShoulder.rotation.x = -move * 0.5;
        b.leftHip.rotation.x = -move * 0.2;
        b.rightHip.rotation.x = move * 0.2;
    }

    if (b.ponytail) {
        b.ponytail.rotation.z = Math.sin(time * 3) * 0.12;
    }

    if (renderer && scene && camera3D) {
        renderer.render(scene, camera3D);
    }
}

// Визначення вправи за текстом Gemini AI
function mapExerciseToAnimation(name) {
    const lower = name.toLowerCase();
    if (lower.includes("присід") || lower.includes("squat")) return "squat";
    if (lower.includes("планк") || lower.includes("plank")) return "plank";
    if (lower.includes("випад") || lower.includes("lunge")) return "lunge";
    if (lower.includes("віджим") || lower.includes("pushup") || lower.includes("пушап")) return "pushup";
    if (lower.includes("мах") || lower.includes("поднимани") || lower.includes("підйом") || lower.includes("ноги")) return "leg_raise";
    return "generic";
}

// Навігація вкладок
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');

        if (btn.dataset.tab === 'tab-library') renderLibrary();
        if (btn.dataset.tab === 'tab-progress') renderProgress();
    });
});

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playBeep(type = 'start') {
    initAudioContext();
    if (!audioCtx) return;

    try {
        if (type === 'start') {
            [0, 0.18].forEach(delay => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, audioCtx.currentTime + delay);
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime + delay);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + 0.12);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + delay);
                osc.stop(audioCtx.currentTime + delay + 0.12);
            });
        }
    } catch (e) { console.error(e); }
}

dropZone.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            imagePreview.src = event.target.result;
            base64Image = event.target.result.split(',')[1];
            previewContainer.classList.remove('hidden');
            analyzeBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

function speak(text, force = false) {
    const now = Date.now();
    if (!force && now - lastVoiceTime < 2500) return;
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'uk-UA';

        const voices = window.speechSynthesis.getVoices();
        const ukrVoice = voices.find(v => v.lang.includes('uk'));
        if (ukrVoice) utterance.voice = ukrVoice;

        utterance.rate = 1.05;
        utterance.pitch = 1.25;

        window.speechSynthesis.speak(utterance);
        lastVoiceTime = now;
    }
}

function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

analyzeBtn.addEventListener('click', async () => {
    initAudioContext();

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert("Будь ласка, введіть свій Gemini API Key!");
        return;
    }

    workoutScreen.classList.remove('hidden');
    setTimeout(initFull3DScene, 100);

    exerciseTitle.textContent = "Аналізуємо...";
    aiFeedback.textContent = "Готую 3D-техніку для завантаженої вправи... 💅";
    speak("Привіт! Зачекай секунду, розбираю твоє фото вправи.", true);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Аналізуй зображення вправи. Відповідай виключно у чистому форматі JSON без маркдаун-тегів. Формат: {\"name\": \"назва вправи українською\", \"instruction\": \"детальна інструкція виконання з 20-30 слів українською мовою\", \"duration\": 45}" },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const exerciseData = JSON.parse(rawText);

        saveToLibrary(exerciseData);
        startWorkoutWithAI(exerciseData);

    } catch (error) {
        console.error(error);
        exerciseTitle.textContent = "Помилка";
        aiFeedback.textContent = "Не вдалося розпізнати фото. Спробуй інше!";
    }
});

function saveToLibrary(data) {
    const exists = exerciseLibrary.some(item => item.name === data.name);
    if (!exists) {
        exerciseLibrary.push(data);
        localStorage.setItem('fitmae_library', JSON.stringify(exerciseLibrary));
    }
}

function renderLibrary() {
    if (exerciseLibrary.length === 0) {
        libraryList.innerHTML = `<p class="empty-msg">Немає збережених вправ. Завантажте першу через сканер!</p>`;
        return;
    }

    libraryList.innerHTML = exerciseLibrary.map((item, index) => `
        <div class="card" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h4>${item.name}</h4>
                <p style="font-size:0.75rem; color:var(--text-muted);">${item.duration} сек</p>
            </div>
            <button class="btn btn-primary" style="width:auto; padding:8px 16px;" onclick="startFromLibrary(${index})">Старт ▶</button>
        </div>
    `).join('');
}

function renderProgress() {
    document.getElementById('statWorkouts').textContent = userStats.workouts;
    document.getElementById('statMinutes').textContent = (userStats.minutes / 60).toFixed(1);
    document.getElementById('statCalories').textContent = userStats.calories;
}

window.startFromLibrary = function(index) {
    const item = exerciseLibrary[index];
    workoutScreen.classList.remove('hidden');
    setTimeout(initFull3DScene, 100);
    startWorkoutWithAI(item);
};

function startWorkoutWithAI(data) {
    exerciseTitle.textContent = data.name;
    aiFeedback.textContent = data.instruction;
    repCount = 0;
    repCountDisplay.textContent = repCount;

    // Встановлення анімації під точний тип розпізнаної вправи
    currentExerciseType = mapExerciseToAnimation(data.name);

    playBeep('start');
    speak(`Починаємо ${data.name}! Дивись на мене і повторюй!`, true);
    
    startTimer(data.duration || 45);
    initPoseDetection();
}

function initPoseDetection() {
    pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);

    camera = new Camera(videoElement, {
        onFrame: async () => {
            if (!isPaused && pose) {
                await pose.send({ image: videoElement });
            }
        },
        width: 640,
        height: 480
    });

    camera.start();
}

function onPoseResults(results) {
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        const landmarks = results.poseLandmarks;
        const hip = landmarks[24];
        const knee = landmarks[26];
        const ankle = landmarks[28];

        if (hip && knee && ankle) {
            const kneeAngle = calculateAngle(hip, knee, ankle);

            if (kneeAngle < 105 && exerciseStage === "up") {
                exerciseStage = "down";
                aiFeedback.textContent = "Тримай амплітуду! 😉";
            }

            if (kneeAngle > 155 && exerciseStage === "down") {
                exerciseStage = "up";
                repCount++;
                repCountDisplay.textContent = repCount;
                
                const phrase = motivationalPhrases[repCount % motivationalPhrases.length];
                aiFeedback.textContent = phrase;
                speak(`${repCount}! ${phrase}`);
            }
        }
    }
    canvasCtx.restore();
}

function startTimer(targetDuration) {
    clearInterval(timerInterval);
    secondsPassed = 0;
    updateTimerDisplay(targetDuration);

    timerInterval = setInterval(() => {
        if (!isPaused) {
            secondsPassed++;
            const remaining = targetDuration - secondsPassed;
            updateTimerDisplay(remaining);

            if (remaining <= 0) {
                stopWorkout();
                aiFeedback.textContent = `Чудово! Зроблено ${repCount} повторень! 🎉`;
                speak(`Стоп! Тренування закінчено! Ви чудово впоралися!`, true);
            }
        }
    }, 1000);
}

function updateTimerDisplay(sec) {
    timerDisplay.textContent = Math.max(0, sec);
}

pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.querySelector('span').textContent = isPaused ? "▶" : "⏸";
    speak(isPaused ? "Пауза" : "Продовжуємо!", true);
});

stopBtn.addEventListener('click', () => {
    stopWorkout();
    workoutScreen.classList.add('hidden');
});

backBtn.addEventListener('click', () => {
    stopWorkout();
    workoutScreen.classList.add('hidden');
});

function stopWorkout() {
    clearInterval(timerInterval);
    if (camera) camera.stop();
    isPaused = false;

    if (secondsPassed > 5) {
        userStats.workouts += 1;
        userStats.minutes += secondsPassed;
        userStats.calories += Math.round(repCount * 0.5 + (secondsPassed / 60) * 4);
        localStorage.setItem('fitmae_stats', JSON.stringify(userStats));
    }
}
