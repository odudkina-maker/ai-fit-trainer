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

let exerciseLibrary = JSON.parse(localStorage.getItem('fitmae_library')) || [];
let userStats = JSON.parse(localStorage.getItem('fitmae_stats')) || { workouts: 0, minutes: 0, calories: 0 };

const motivationalPhrases = [
    "Чудовий темп! Сідниці передають привіт! 🍑",
    "Не філонь, тримай техніку ідеальною! 💅",
    "Палає? Значить жирок покидає чат! 🔥",
    "Спинку рівно! Уяви, що ззаду твоя мрія! 😉",
    "Ще трішки! Не здавайся, красуне!",
    "Ідеальне виконання! Мені аж заздрісно стало! ✨"
];

// Колекція анімованих аватарок у Pixar-стилі під різні вправи
const avatarVisuals = {
    squat: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=800&q=80",
    plank: "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=800&q=80",
    lunge: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=800&q=80",
    generic: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80"
};

// Функція відображення HD-тренерки
function renderPixarTrainerContainer(exerciseType = "squat") {
    const container = document.getElementById('threejs-canvas-container');
    if (!container) return;

    // Встановлюємо стилізований інтерфейс з кінематографічним підсвічуванням
    container.innerHTML = `
        <div style="position:relative; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background: radial-gradient(circle at center, #2e1a47 0%, #0b0914 100%); overflow:hidden;">
            <!-- Неоновий німб/освітлення за персонажем -->
            <div style="position:absolute; width: 280px; height: 280px; background: rgba(236, 72, 153, 0.25); filter: blur(60px); border-radius: 50%;"></div>
            
            <!-- Основна HD-ілюстрація персонажа -->
            <div id="trainerAvatarCard" style="position:relative; z-index:2; transition: transform 0.3s ease;">
                <img src="${avatarVisuals[exerciseType] || avatarVisual visuals.generic}" 
                     alt="AI Trainer" 
                     style="max-width: 85%; max-height: 55vh; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(168, 85, 247, 0.4); object-fit: cover;">
            </div>

            <!-- Підкладка килимка під персонажем -->
            <div style="width: 70%; height: 12px; background: #261f3b; border-radius: 6px; margin-top: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>
        </div>
    `;
}

// Запуск динамічного мікро-руху персонажа при повторах
function pulseTrainerAvatar() {
    const card = document.getElementById('trainerAvatarCard');
    if (card) {
        card.style.transform = "scale(1.05)";
        setTimeout(() => { card.style.transform = "scale(1)"; }, 300);
    }
}

function detectExerciseType(name) {
    const lower = name.toLowerCase();
    if (lower.includes("присід") || lower.includes("squat")) return "squat";
    if (lower.includes("планк") || lower.includes("plank")) return "plank";
    if (lower.includes("випад") || lower.includes("lunge")) return "lunge";
    return "generic";
}

// Навігація
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
    startWorkoutWithAI(item);
};

function startWorkoutWithAI(data) {
    exerciseTitle.textContent = data.name;
    aiFeedback.textContent = data.instruction;
    repCount = 0;
    repCountDisplay.textContent = repCount;

    const exerciseType = detectExerciseType(data.name);
    renderPixarTrainerContainer(exerciseType);

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
                
                pulseTrainerAvatar(); // Анімаційний відгук персонажа

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
