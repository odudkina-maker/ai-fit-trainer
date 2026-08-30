document.addEventListener('DOMContentLoaded', () => {
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
    const canvasCtx = canvasElement ? canvasElement.getContext('2d') : null;

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

    // Three.js 3D-Аватар
    let scene, camera3D, renderer, clock;
    let avatarGroup, bodyGroup, leftLeg, rightLeg, leftArm, rightArm, headGroup;
    let currentExerciseType = "squat";

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

    // --- Перемикання вкладок ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetContent = document.getElementById(btn.dataset.tab);
            if (targetContent) targetContent.classList.add('active');

            if (btn.dataset.tab === 'tab-library') renderLibrary();
            if (btn.dataset.tab === 'tab-progress') renderProgress();
        });
    });

    // --- Створення 3D Персонажа Pixar ---
    function init3DPixarTrainer() {
        const container = document.getElementById('threejs-canvas-container');
        if (!container) return;
        container.innerHTML = '';

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0e091b);

        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || 400;

        camera3D = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        camera3D.position.set(0, 1.1, 2.8);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        // Світло
        const ambient = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambient);

        const mainLight = new THREE.DirectionalLight(0xffe0ff, 1.8);
        mainLight.position.set(2, 4, 3);
        mainLight.castShadow = true;
        scene.add(mainLight);

        const purpleRim = new THREE.PointLight(0xec4899, 2.5, 8);
        purpleRim.position.set(-2, 2, -1);
        scene.add(purpleRim);

        // Килимок для фітнесу
        const matMat = new THREE.MeshStandardMaterial({ color: 0x241838, roughness: 0.5 });
        const mat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 1.6), matMat);
        mat.position.set(0, -0.01, 0);
        scene.add(mat);

        // Матеріали дівчини
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd2b5, roughness: 0.3 });
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x3a1e05, roughness: 0.4 });
        const clothTopMat = new THREE.MeshStandardMaterial({ color: 0x181325, roughness: 0.2 });
        const clothLegMat = new THREE.MeshStandardMaterial({ color: 0x2d1f47, roughness: 0.3 });
        const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

        avatarGroup = new THREE.Group();
        bodyGroup = new THREE.Group();

        // 1. Голова і Волосся (Pixar Style)
        headGroup = new THREE.Group();
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 32), skinMat);
        head.scale.set(1, 1.15, 1);
        headGroup.add(head);

        // Зачіска та Хвіст
        const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.148, 32, 32), hairMat);
        hairTop.position.set(0, 0.02, -0.01);
        headGroup.add(hairTop);

        const ponytail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, 0.3, 16), hairMat);
        ponytail.position.set(0, 0.05, -0.15);
        ponytail.rotation.x = -Math.PI / 3;
        headGroup.add(ponytail);

        // Очі
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a0d00 });
        const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 16), eyeMat);
        leftEye.position.set(-0.045, 0.02, 0.125);
        const rightEye = leftEye.clone();
        rightEye.position.x = 0.045;
        headGroup.add(leftEye, rightEye);

        headGroup.position.y = 1.38;
        bodyGroup.add(headGroup);

        // 2. Торс і Спортивний Топ
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.32, 32), clothTopMat);
        torso.position.y = 1.08;
        bodyGroup.add(torso);

        // 3. Руки
        const armGeo = new THREE.CylinderGeometry(0.03, 0.022, 0.38, 16);
        leftArm = new THREE.Mesh(armGeo, skinMat);
        leftArm.position.set(-0.15, 1.05, 0);
        
        rightArm = new THREE.Mesh(armGeo, skinMat);
        rightArm.position.set(0.15, 1.05, 0);

        bodyGroup.add(leftArm, rightArm);

        // 4. Таз та Ноги
        const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.16, 32), clothLegMat);
        pelvis.position.y = 0.84;
        bodyGroup.add(pelvis);

        const legGeo = new THREE.CylinderGeometry(0.05, 0.035, 0.7, 16);
        leftLeg = new THREE.Mesh(legGeo, clothLegMat);
        leftLeg.position.set(-0.08, 0.42, 0);

        rightLeg = new THREE.Mesh(legGeo, clothLegMat);
        rightLeg.position.set(0.08, 0.42, 0);

        const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.14), shoeMat);
        leftShoe.position.set(0, -0.36, 0.03);
        leftLeg.add(leftShoe);

        const rightShoe = leftShoe.clone();
        rightLeg.add(rightShoe);

        avatarGroup.add(leftLeg, rightLeg, bodyGroup);
        scene.add(avatarGroup);

        animate3D();
    }

    // --- Динамічна Анімація Вправ ---
    function animate3D() {
        requestAnimationFrame(animate3D);
        if (!clock || !avatarGroup) return;

        const time = clock.getElapsedTime();

        if (currentExerciseType === "squat") {
            const squat = (Math.sin(time * 2.5) + 1) / 2;
            bodyGroup.position.y = -squat * 0.32;
            
            // Руки витягнуті вперед як на скріншоті
            leftArm.rotation.x = -Math.PI / 2.2;
            rightArm.rotation.x = -Math.PI / 2.2;
            leftArm.position.z = 0.12;
            rightArm.position.z = 0.12;

            leftLeg.scale.set(1, 1 - squat * 0.2, 1);
            rightLeg.scale.set(1, 1 - squat * 0.2, 1);
        } else {
            const idle = Math.sin(time * 2) * 0.03;
            bodyGroup.position.y = idle;
            leftArm.rotation.x = 0;
            rightArm.rotation.x = 0;
            leftArm.position.z = 0;
            rightArm.position.z = 0;
        }

        renderer.render(scene, camera3D);
    }

    function pulseTrainerAvatar() {
        if (bodyGroup) {
            bodyGroup.position.y += 0.05;
        }
    }

    function detectExerciseType(name) {
        const lower = name.toLowerCase();
        if (lower.includes("присід") || lower.includes("squat")) return "squat";
        return "generic";
    }

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

    if (dropZone) dropZone.addEventListener('click', () => imageInput.click());

    if (imageInput) {
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
    }

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

    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            initAudioContext();
            workoutScreen.classList.remove('hidden');

            exerciseTitle.textContent = "Аналізуємо...";
            aiFeedback.textContent = "Готую 3D-техніку для завантаженої вправи... 💅";
            speak("Привіт! Зачекай секунду, розбираю твоє фото вправи.", true);

            const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";

            if (!apiKey) {
                setTimeout(() => {
                    const demoData = {
                        name: "Присідання",
                        instruction: "Тримай спину рівно, коліна дивляться в бік носків.",
                        duration: 45
                    };
                    saveToLibrary(demoData);
                    startWorkoutWithAI(demoData);
                }, 1200);
                return;
            }

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: "Аналізуй зображення вправи. Формат JSON: {\"name\": \"назва вправи\", \"instruction\": \"інструкція\", \"duration\": 45}" },
                                { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                            ]
                        }]
                    })
                });

                const data = await response.json();
                let rawText = data.candidates[0].content.parts[0].text;
                rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                const exerciseData = JSON.parse(rawText);

                saveToLibrary(exerciseData);
                startWorkoutWithAI(exerciseData);

            } catch (error) {
                console.error(error);
                exerciseTitle.textContent = "Помилка";
                aiFeedback.textContent = "Спробуй ще раз!";
            }
        });
    }

    function saveToLibrary(data) {
        const exists = exerciseLibrary.some(item => item.name === data.name);
        if (!exists) {
            exerciseLibrary.push(data);
            localStorage.setItem('fitmae_library', JSON.stringify(exerciseLibrary));
        }
    }

    function renderLibrary() {
        if (!libraryList) return;
        if (exerciseLibrary.length === 0) {
            libraryList.innerHTML = `<p class="empty-msg" style="text-align:center; color:var(--text-muted); padding:20px;">Немає збережених вправ.</p>`;
            return;
        }

        libraryList.innerHTML = exerciseLibrary.map((item, index) => `
            <div class="card" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:12px; border-radius:12px;">
                <div>
                    <h4 style="margin:0;">${item.name}</h4>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin:4px 0 0 0;">${item.duration} сек</p>
                </div>
                <button class="btn btn-primary" style="width:auto; padding:8px 16px;" onclick="startFromLibrary(${index})">Старт ▶</button>
            </div>
        `).join('');
    }

    function renderProgress() {
        const w = document.getElementById('statWorkouts');
        const m = document.getElementById('statMinutes');
        const c = document.getElementById('statCalories');
        if (w) w.textContent = userStats.workouts;
        if (m) m.textContent = (userStats.minutes / 60).toFixed(1);
        if (c) c.textContent = userStats.calories;
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
        if (repCountDisplay) repCountDisplay.textContent = repCount;

        currentExerciseType = detectExerciseType(data.name);
        setTimeout(init3DPixarTrainer, 100);

        playBeep('start');
        speak(`Починаємо ${data.name}! Дивись на мене і повторюй!`, true);
        
        startTimer(data.duration || 45);
        initPoseDetection();
    }

    function initPoseDetection() {
        if (typeof Pose === 'undefined' || !videoElement) return;

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
        if (!canvasCtx || !canvasElement) return;
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
                    if (repCountDisplay) repCountDisplay.textContent = repCount;
                    
                    pulseTrainerAvatar();

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
        if (timerDisplay) timerDisplay.textContent = Math.max(0, sec);
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            const span = pauseBtn.querySelector('span');
            if (span) span.textContent = isPaused ? "▶" : "⏸";
            speak(isPaused ? "Пауза" : "Продовжуємо!", true);
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            stopWorkout();
            workoutScreen.classList.add('hidden');
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            stopWorkout();
            workoutScreen.classList.add('hidden');
        });
    }

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
});
