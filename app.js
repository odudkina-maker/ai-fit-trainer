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

const motivationalPhrases = [
    "Давай, давай! Вже бачу, як жир на попі тане!",
    "Красуня! Працюємо на результат!",
    "Ще трішки, не здавайся!",
    "Ідеально! Твоє тіло скаже тобі дякую!",
    "Оце так техніка! Просто вогонь!",
    "Палає? Значить працює!",
    "Не філонь, дотискай до кінця!"
];

// Генератор звукових сигналів (Web Audio API)
function playBeep(type = 'start') {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        if (type === 'start') {
            // Подвійний високий біп для початку (880 Гц)
            [0, 0.15].forEach(delay => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, audioCtx.currentTime + delay);
                gain.gain.setValueAtTime(0.1, audioCtx.currentTime + delay);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + 0.1);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + delay);
                osc.stop(audioCtx.currentTime + delay + 0.1);
            });
        } else if (type === 'finish') {
            // Довгий низький/перехідний біп для завершення
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // До (C5)
            osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.4); // Мі (E5)
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.5);
        }
    } catch (e) {
        console.error("Помилка відтворення звуку:", e);
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
        utterance.rate = 1.05;
        utterance.pitch = voiceSelect.value === 'female' ? 1.25 : 0.85;
        
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
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert("Будь ласка, введіть свій Gemini API Key!");
        return;
    }

    workoutScreen.classList.remove('hidden');
    exerciseTitle.textContent = "Аналізуємо...";
    aiFeedback.textContent = "Зчитуємо зображення за допомогою AI...";
    speak("Так-так, дивимося на вашу вправу...", true);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Аналізуй зображення вправи. Відповідай виключно у чистому форматі JSON без маркдаун-тегів. Формат: {\"name\": \"назва вправи українською\", \"instruction\": \"коротка техніка до 15 слів\", \"duration\": 45}" },
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

        startWorkoutWithAI(exerciseData);

    } catch (error) {
        console.error(error);
        exerciseTitle.textContent = "Помилка розпізнавання";
        aiFeedback.textContent = error.message || "Не вдалося зчитати вправу.";
        speak("Упс, щось пішло не так при розпізнаванні.", true);
    }
});

function startWorkoutWithAI(data) {
    exerciseTitle.textContent = data.name;
    aiFeedback.textContent = data.instruction;
    repCount = 0;
    repCountDisplay.textContent = repCount;

    // Звуковий сигнал старту
    playBeep('start');
    speak(`Чудово! Зчитуємо ${data.name}. Ставайте перед камерою та починаємо працювати!`, true);
    
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
                // Звуковий сигнал фінішу
                playBeep('finish');
                aiFeedback.textContent = `Час! Зроблено ${repCount} повторень. Ти просто зірка! 🔥`;
                speak(`Стоп! Тренування закінчено! Зроблено ${repCount} повторень. Ти просто зірка!`, true);
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
    speak(isPaused ? "Пауза. Відпочинь і попий водички." : "Погнали далі!", true);
});

stopBtn.addEventListener('click', () => {
    stopWorkout();
    playBeep('finish');
    speak("Тренування завершено! Відпочивай!", true);
});

function stopWorkout() {
    clearInterval(timerInterval);
    if (camera) camera.stop();
    isPaused = false;
    pauseBtn.textContent = "Пауза";
}
