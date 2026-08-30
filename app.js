const imageInput = document.getElementById('imageInput');
const dropZone = document.getElementById('dropZone');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const voiceSelect = document.getElementById('voiceSelect');
const apiKeyInput = document.getElementById('apiKeyInput');

const workoutScreen = document.getElementById('workoutScreen');
const exerciseTitle = document.getElementById('exerciseTitle');
const timerDisplay = document.getElementById('timer');
const aiFeedback = document.getElementById('aiFeedback');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
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

// Three.js змінні
let scene, camera3D, renderer, mixer, clock;

let exerciseLibrary = JSON.parse(localStorage.getItem('fitmae_library')) || [];
let userStats = JSON.parse(localStorage.getItem('fitmae_stats')) || { workouts: 0, minutes: 0, calories: 0 };

const motivationalPhrases = [
    "Давай, давай! Вже бачу, як жир на попі тане!",
    "Працюємо на результат! Молодчина!",
    "Ще трішки, не здавайся!",
    "Ідеально! Твоє тіло скаже тобі дякую!",
    "Оце так техніка! Просто вогонь!",
    "Палає? Значить працює!",
    "Не філонь, дотискай до кінця!"
];

// Ініціалізація 3D анімованого тренера
function init3DAvatar() {
    const container = document.getElementById('avatar3DContainer');
    if (!container) return;
    container.innerHTML = ''; // Очищаємо перед створенням

    clock = new THREE.Clock();
    scene = new THREE.Scene();
    
    camera3D = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera3D.position.set(0, 1.2, 2.5);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(80, 80);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Світло
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    // Завантаження 3D-моделі манекена-тренера з анімацією
    const loader = new THREE.GLTFLoader();
    // Використовуємо якісну анімовану модель персонажа з CDN
    const modelUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

    loader.load(modelUrl, (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.28, 0.28, 0.28);
        model.position.set(0, -0.6, 0);
        scene.add(model);

        // Налаштування анімацій
        mixer = new THREE.AnimationMixer(model);
        const animations = gltf.animations;

        // Пошук анімації (привітання або діяльності)
        const danceAnim = THREE.AnimationClip.findByName(animations, 'Dance') || animations[0];
        if (danceAnim) {
            const action = mixer.clipAction(danceAnim);
            action.play();
        }

        animate3D();
    }, undefined, (error) => {
        console.error("Помилка завантаження 3D моделі:", error);
    });
}

function animate3D() {
    requestAnimationFrame(animate3D);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    if (renderer && scene && camera3D) {
        renderer.render(scene, camera3D);
    }
}

// Перемикач вкладок
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
        } else if (type === 'finish') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.6, audioCtx.currentTime + 0.6);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.6);
        }
    } catch (e) {
        console.error(e);
    }
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

        const isMale = voiceSelect.value === 'male';
        const voices = window.speechSynthesis.getVoices();
        const ukrVoice = voices.find(v => v.lang.includes('uk'));
        if (ukrVoice) utterance.voice = ukrVoice;

        utterance.rate = isMale ? 0.95 : 1.05;
        utterance.pitch = isMale ? 0.65 : 1.3;

        window.speechSynthesis.speak(utterance);
        lastVoiceTime = now;
    }
}

function getRandomMotivationalPhrase() {
    const randomIndex = Math.floor(Math.random() * motivationalPhrases.length);
    return motivationalPhrases[randomIndex];
}

function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
        angle = 360 - angle;
    }
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
    init3DAvatar();
    exerciseTitle.textContent = "Аналізуємо...";
    aiFeedback.textContent = "Зчитуємо зображення за допомогою AI...";
    speak("Так-так, вивчаю вашу вправу зі скріншота.", true);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Аналізуй зображення вправи. Відповідай виключно у чистому формат format JSON без маркдаун-тегів. Формат: {\"name\": \"назва вправи українською\", \"instruction\": \"детальна інструкція виконання з 25-35 слів українською мовою\", \"duration\": 45}" },
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
        exerciseTitle.textContent = "Помилка розпізнавання";
        aiFeedback.textContent = error.message || "Не вдалося зчитати вправу.";
        speak("Упс, щось пішло не так при розпізнаванні.", true);
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
        libraryList.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Немає збережених вправ. Завантажте першу через сканер!</p>`;
        return;
    }

    libraryList.innerHTML = exerciseLibrary.map((item, index) => `
        <div class="exercise-card">
            <div class="exercise-info">
                <h4>${item.name}</h4>
                <p>Таймер: ${item.duration} сек</p>
            </div>
            <button class="btn-start-mini" onclick="startFromLibrary(${index})">Старт ▶</button>
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
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    workoutScreen.classList.remove('hidden');
    init3DAvatar();
    startWorkoutWithAI(item);
};

function startWorkoutWithAI(data) {
    exerciseTitle.textContent = data.name;
    aiFeedback.textContent = data.instruction;
    repCount = 0;
    repCountDisplay.textContent = repCount;

    playBeep('start');
    const introSpeech = `Вправу розпізнано: ${data.name}. Як виконувати: ${data.instruction}. Ставайте перед камерою і починаємо!`;
    speak(introSpeech, true);
    
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

            canvasCtx.beginPath();
            canvasCtx.moveTo(hip.x * canvasElement.width, hip.y * canvasElement.height);
            canvasCtx.lineTo(knee.x * canvasElement.width, knee.y * canvasElement.height);
            canvasCtx.lineTo(ankle.x * canvasElement.width, ankle.y * canvasElement.height);
            canvasCtx.lineWidth = 6;
            canvasCtx.strokeStyle = '#00FF00';
            canvasCtx.stroke();

            [hip, knee, ankle].forEach(pt => {
                canvasCtx.beginPath();
                canvasCtx.arc(pt.x * canvasElement.width, pt.y * canvasElement.height, 8, 0, 2 * Math.PI);
                canvasCtx.fillStyle = '#FF0055';
                canvasCtx.fill();
            });

            if (kneeAngle < 105 && exerciseStage === "up") {
                exerciseStage = "down";
                aiFeedback.textContent = "Нижче! Дотискай!";
            }

            if (kneeAngle > 155 && exerciseStage === "down") {
                exerciseStage = "up";
                repCount++;
                repCountDisplay.textContent = repCount;
                
                if (repCount % 3 === 0) {
                    const phrase = getRandomMotivationalPhrase();
                    aiFeedback.textContent = `${repCount} — ${phrase}`;
                    speak(`${repCount}! ${phrase}`);
                } else {
                    aiFeedback.textContent = `Зараховано! Повторення: ${repCount}`;
                    speak(`${repCount}`);
                }
            }
        }
    }
    canvasCtx.restore();
}

function startTimer(targetDuration) {
    clearInterval(timerInterval);
    secondsPassed = 0;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        if (!isPaused) {
            secondsPassed++;
            updateTimerDisplay();

            if (secondsPassed >= targetDuration) {
                stopWorkout();
                playBeep('finish');
                aiFeedback.textContent = `Час! Зробли ${repCount} повторень. Чудова робота! 🔥`;
                speak(`Стоп! Тренування закінчено! Ви зробили ${repCount} повторень. Відмінний результат!`, true);
            }
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = String(Math.floor(secondsPassed / 60)).padStart(2, '0');
    const secs = String(secondsPassed % 60).padStart(2, '0');
    timerDisplay.textContent = `${mins}:${secs}`;
}

pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? "Продовжити" : "Пауза";
    speak(isPaused ? "Пауза. Перепочиньте." : "Продовжуємо тренування!", true);
});

stopBtn.addEventListener('click', () => {
    stopWorkout();
    playBeep('finish');
    speak("Тренування завершено!", true);
});

function stopWorkout() {
    clearInterval(timerInterval);
    if (camera) camera.stop();
    isPaused = false;
    pauseBtn.textContent = "Пауза";

    if (secondsPassed > 5) {
        userStats.workouts += 1;
        userStats.minutes += secondsPassed;
        userStats.calories += Math.round(repCount * 0.5 + (secondsPassed / 60) * 4);
        localStorage.setItem('fitmae_stats', JSON.stringify(userStats));
    }
}
