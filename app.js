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

let timerInterval = null;
let secondsPassed = 0;
let isPaused = false;
let base64Image = "";

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

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'uk-UA';
        utterance.rate = 1.0;
        utterance.pitch = voiceSelect.value === 'female' ? 1.2 : 0.8;
        window.speechSynthesis.speak(utterance);
    }
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
    speak("Аналізую вправу зі скріншота.");

    try {
        // Використовуємо модель gemini-2.5-flash
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Аналізуй зображення вправи. Відповідай виключно у чистому форматі JSON без маркдаун-тегів. Формат: {\"name\": \"назва вправи українською\", \"instruction\": \"коротка техніка до 15 слів\", \"duration\": 30}" },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || "Помилка API");
        }

        let rawText = data.candidates[0].content.parts[0].text;
        
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const exerciseData = JSON.parse(rawText);
        startWorkoutWithAI(exerciseData);

    } catch (error) {
        console.error("Помилка:", error);
        exerciseTitle.textContent = "Помилка розпізнавання";
        aiFeedback.textContent = error.message || "Не вдалося зчитати вправу. Перевірте API key.";
        speak("Не вдалося розпізнати вправу. Перевірте API ключ.");
    }
});

function startWorkoutWithAI(data) {
    exerciseTitle.textContent = data.name;
    aiFeedback.textContent = data.instruction;
    
    speak(`Вправу розпізнано! Це ${data.name}. ${data.instruction}. Починаємо!`);
    
    startTimer(data.duration || 30);
}

function startTimer(targetDuration) {
    clearInterval(timerInterval);
    secondsPassed = 0;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        if (!isPaused) {
            secondsPassed++;
            updateTimerDisplay();
            
            if (secondsPassed === Math.floor(targetDuration / 2)) {
                aiFeedback.textContent = "Половина шляху пройдена!";
                speak("Половина вже позаду! Тримайся!");
            } else if (secondsPassed >= targetDuration) {
                stopWorkout();
                aiFeedback.textContent = "Чудова робота! Вправу виконано!";
                speak("Стоп! Вправу успішно виконано!");
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
    speak(isPaused ? "Пауза." : "Продовжуємо!");
});

stopBtn.addEventListener('click', () => {
    stopWorkout();
    speak("Тренування завершено.");
});

function stopWorkout() {
    clearInterval(timerInterval);
    isPaused = false;
    pauseBtn.textContent = "Пауза";
}
