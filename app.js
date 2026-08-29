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

// Трекінг повторень
let repCount = 0;
let exerciseStage = "up"; // "up" або "down"
let lastVoiceTime = 0;

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
    // Обмеження: підказки голосом не частіше ніж раз на 3 секунди
    if (!force && now - lastVoiceTime < 3000) return;
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'uk-UA';
        utterance.rate = 1.0;
        utterance.pitch = voiceSelect.value === 'female' ? 1.2 : 0.8;
        window.speechSynthesis.speak(utterance);
        lastVoiceTime = now;
    }
}

// Розрахунок кута між трьома точками тіла
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
    speak("Аналізую вправу зі скріншота.", true);

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
        speak("Помилка зчитування.", true);
    }
});

function startWorkoutWithAI(data) {
    exerciseTitle.textContent = data.name;
    aiFeedback.textContent = data.instruction;
    repCount = 0;
    repCountDisplay.textContent = repCount;

    speak(`Вправу розпізнано! Це ${data.name}. Увімкніть камеру. Починаємо!`, true);
    
    startTimer(data.duration || 45);
    initPoseDetection();
}

// Налаштування комп'ютерного зору MediaPipe Pose
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

        // Ключові точки: Стегно(24), Коліно(26), Щиколотка(28) - ліва/права нога
        const hip = landmarks[24];
        const knee = landmarks[26];
        const ankle = landmarks[28];

        if (hip && knee && ankle) {
            const kneeAngle = calculateAngle(hip, knee, ankle);

            // Візуалізація лінії коліна
            canvasCtx.beginPath();
            canvasCtx.moveTo(hip.x * canvasElement.width, hip.y * canvasElement.height);
            canvasCtx.lineTo(knee.x * canvasElement.width, knee.y * canvasElement.height);
            canvasCtx.lineTo(ankle.x * canvasElement.width, ankle.y * canvasElement.height);
            canvasCtx.lineWidth = 4;
            canvasCtx.strokeStyle = '#4CAF50';
            canvasCtx.stroke();

            // Логіка підрахунку повторень (присідання / випади)
            if (kneeAngle < 100 && exerciseStage === "up") {
                exerciseStage = "down";
                aiFeedback.textContent = "Чудово! Опускайся ще трохи.";
            }

            if (kneeAngle > 160 && exerciseStage === "down") {
                exerciseStage = "up";
                repCount++;
                repCountDisplay.textContent = repCount;
                aiFeedback.textContent = `Зараховано! Повторення: ${repCount}`;
                speak(`${repCount}`);
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
                aiFeedback.textContent = `Час вийшов! Ви зробили ${repCount} повторень!`;
                speak(`Час вийшов! Чудова робота, зроблено ${repCount} повторень!`, true);
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
    speak(isPaused ? "Пауза." : "Продовжуємо!", true);
});

stopBtn.addEventListener('click', () => {
    stopWorkout();
    speak("Тренування завершено.", true);
});

function stopWorkout() {
    clearInterval(timerInterval);
    if (camera) camera.stop();
    isPaused = false;
    pauseBtn.textContent = "Пауза";
}
