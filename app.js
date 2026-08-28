// Елементи DOM
const imageInput = document.getElementById('imageInput');
const dropZone = document.getElementById('dropZone');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const startBtn = document.getElementById('startBtn');
const voiceSelect = document.getElementById('voiceSelect');

const workoutScreen = document.getElementById('workoutScreen');
const exerciseTitle = document.getElementById('exerciseTitle');
const timerDisplay = document.getElementById('timer');
const aiFeedback = document.getElementById('aiFeedback');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');

let timerInterval = null;
let secondsPassed = 0;
let isPaused = false;

// Клік по зоні завантаження
dropZone.addEventListener('click', () => imageInput.click());

// Обробка вибору файлу
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            imagePreview.src = event.target.result;
            previewContainer.classList.remove('hidden');
            startBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

// Синтез мовлення (Голос тренера)
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // зупинити попередню мову
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'uk-UA'; // Українська мова
        utterance.rate = 1.0;
        
        // Вибір тональності залежно від обраного тренера
        if (voiceSelect.value === 'female') {
            utterance.pitch = 1.2;
        } else {
            utterance.pitch = 0.8;
        }
        
        window.speechSynthesis.speak(utterance);
    }
}

// Запуск тренування
startBtn.addEventListener('click', () => {
    workoutScreen.classList.remove('hidden');
    exerciseTitle.textContent = "Вправа зі скріншота";
    aiFeedback.textContent = "Готові? Починаємо вправу!";
    
    speak("Привіт! Я твій AI тренер. Починаємо вправу! Тримай темп і слідкуй за технікою.");
    
    startTimer();
});

// Логіка таймера
function startTimer() {
    clearInterval(timerInterval);
    secondsPassed = 0;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        if (!isPaused) {
            secondsPassed++;
            updateTimerDisplay();
            
            // AI підказки/мотивація під час вправи
            if (secondsPassed === 10) {
                aiFeedback.textContent = "Чудово працюєш! Не забувай дихати.";
                speak("Чудово працюєш! Спину тримай рівно та не забувай дихати.");
            } else if (secondsPassed === 20) {
                aiFeedback.textContent = "Ще трохи! Залишилося зовсім трохи.";
                speak("Ще 10 секунд! Дотисни цей підхід!");
            } else if (secondsPassed === 30) {
                stopWorkout();
                aiFeedback.textContent = "Підхід завершено! Відпочинок.";
                speak("Молодець! Підхід завершено. Відпочинь 30 секунд.");
            }
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = String(Math.floor(secondsPassed / 60)).padStart(2, '0');
    const secs = String(secondsPassed % 60).padStart(2, '0');
    timerDisplay.textContent = `${mins}:${secs}`;
}

// Пауза
pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
        pauseBtn.textContent = "Продовжити";
        aiFeedback.textContent = "Пауза";
        speak("Пауза.");
    } else {
        pauseBtn.textContent = "Пауза";
        aiFeedback.textContent = "Продовжуємо!";
        speak("Продовжуємо тренування.");
    }
});

// Завершення
stopBtn.addEventListener('click', () => {
    stopWorkout();
    speak("Тренування зупинено. Гарна робота!");
});

function stopWorkout() {
    clearInterval(timerInterval);
    pauseBtn.textContent = "Пауза";
    isPaused = false;
}
