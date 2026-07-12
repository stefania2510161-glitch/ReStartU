const API_BASE = 'http://127.0.0.1:8000';
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const statusPill = document.getElementById('statusPill');
const themeToggle = document.getElementById('themeToggle');
const paletteDots = document.querySelectorAll('[data-palette]');
const scheduleContainer = document.getElementById('scheduleContainer');
const scheduleTableBody = document.querySelector('#scheduleTable tbody');
const planTarget = document.getElementById('planTarget');
const planPoints = document.getElementById('planPoints');
const unlockList = document.getElementById('unlockList');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const editPlanBtn = document.getElementById('editPlanBtn');
const saveTableBtn = document.getElementById('saveTableBtn');
const startTaskBtn = document.getElementById('startTaskBtn');
const suggestBtn = document.getElementById('suggestBtn');
const timerPanel = document.getElementById('timerPanel');
const timerLabel = document.getElementById('timerLabel');
const timerClock = document.getElementById('timerClock');
const stopTimerBtn = document.getElementById('stopTimerBtn');

const defaultState = {
    step: 0,
    userName: '',
    subjects: [],
    days: 0,
    dailyHours: 0,
    confidence: 6,
    notes: '',
    schedule: null,
    points: 0,
    unlocks: {
        extraBreak: false,
        premiumTheme: false,
    },
    currentTaskIndex: -1,
    timerId: null,
    timerRemaining: 0,
    flashcards: [],
    currentFlashcard: 0,
};

let state = { ...defaultState };

const prompts = [
    'Welcome to ReStartU! What is your name?',
    'Great, {{name}}. Which subjects do you want to study? List them separated by commas.',
    'How many days should this study plan cover?',
    'How many hours per day can you invest in study?',
    'How confident are you about the material, on a scale of 1 to 10?',
    'Would you like to paste some subject notes now for a quick review and flashcards? If yes, paste them. If no, type "skip".',
    'Working on your plan now...'
];

function addMessage(text, type = 'bot') {
    const bubble = document.createElement('div');
    bubble.className = `message ${type}`;
    bubble.innerText = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function ask(prompt) {
    addMessage(prompt, 'bot');
    statusPill.innerText = 'Waiting for answer...';
}

function saveState() {
    const cloned = { ...state };
    delete cloned.timerId;
    localStorage.setItem('restartuState', JSON.stringify(cloned));
}

function loadState() {
    const stored = localStorage.getItem('restartuState');
    if (stored) {
        state = { ...defaultState, ...JSON.parse(stored) };
    }
}

function normalizeSubjects(input) {
    return input
        .split(',')
        .map((subject) => subject.trim())
        .filter(Boolean)
        .slice(0, 6);
}

function formatTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatTimeAMPM(hhmm) {
    // hhmm like '09:00' or '14:30'
    const [hStr, mStr] = hhmm.split(':');
    let h = Number(hStr);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    if (h > 12) h = h - 12;
    return `${String(h).padStart(2, '0')}:${mStr} ${ampm}`;
}

function formatSeconds(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
    } else {
        alert(`${title}\n${body}`);
    }
}

function computeUnlocks() {
    state.unlocks.extraBreak = state.points >= 30;
    state.unlocks.premiumTheme = state.points >= 50;
    document.body.classList.toggle('premium-theme', state.unlocks.premiumTheme);
}

function updateRewards() {
    computeUnlocks();
    const items = [
        state.unlocks.extraBreak
            ? 'Extra break time unlocked'
            : 'Earn 30 points to unlock extra breaks',
        state.unlocks.premiumTheme
            ? 'Premium theme unlocked'
            : 'Earn 50 points to unlock premium theme',
    ];

    unlockList.innerHTML = items
        .map((item) => `<div class="unlock-item"><span>${item}</span></div>`)
        .join('');

    const progress = Math.min(100, (state.points / 50) * 100);
    progressFill.style.width = `${progress}%`;
    progressText.innerText = `Points: ${state.points}. ${Math.round(progress)}% to premium theme.`;
}

function assignTimes(sessions) {
    const dayLength = Math.round(state.dailyHours * 60);
    const startOfDay = 9 * 60;
    let currentDay = 1;
    let currentMinute = 0;

    return sessions.map((session, index) => {
        const required = session.studyMinutes + session.breakMinutes;
        if (currentMinute + required > dayLength && currentDay < state.days) {
            currentDay += 1;
            currentMinute = 0;
        }
        const start = startOfDay + currentMinute;
        const end = start + session.studyMinutes;
        const result = {
            ...session,
            index,
            day: currentDay,
            startTime: formatTime(start),
            endTime: formatTime(end),
        };
        currentMinute += required;
        return result;
    });
}

function buildSchedule(sessionData) {
    state.schedule = sessionData;
    saveState();
}

function renderSchedule() {
    const schedule = state.schedule;
    if (!schedule) return;

    scheduleContainer.classList.remove('hidden');
    planTarget.innerText = `Total planned time: ${schedule.totalMinutes} minutes across ${state.days} day(s)`;
    planPoints.innerText = `Points: ${state.points}`;
    updateRewards();

    scheduleTableBody.innerHTML = schedule.sessions
        .map((session) => {
            const statusLabel = session.status === 'done' ? 'Done' : session.status === 'running' ? 'Running' : 'Pending';
            return `
                <tr data-index="${session.index}" class="session-row ${session.status}">
                    <td>${session.index + 1}</td>
                    <td>${session.day}</td>
                    <td>${session.subject}</td>
                    <td>${session.startTime}</td>
                    <td>${session.endTime}</td>
                    <td><input type="number" min="5" value="${session.studyMinutes}" class="study-input"></td>
                    <td><input type="number" min="0" value="${session.breakMinutes}" class="break-input"></td>
                    <td>${statusLabel}</td>
                </tr>
            `;
        })
        .join('');

    // Populate visual overlapping slot-canvas
    const slotCanvas = document.querySelector('.slot-canvas');
    if (slotCanvas) {
        slotCanvas.innerHTML = '';
        const visible = schedule.sessions.slice(0, 6);
        visible.forEach((s, i) => {
            const card = document.createElement('div');
            const tone = i % 2 === 0 ? 'purple' : 'lime';
            card.className = `slot-card ${tone} s${i + 1}`;
            const time = document.createElement('span');
            time.className = 'slot-time';
            time.innerText = formatTimeAMPM(s.startTime);
            const title = document.createElement('span');
            title.className = 'slot-title';
            title.innerText = `${s.subject.toUpperCase()}`;
            card.appendChild(time);
            card.appendChild(title);
            slotCanvas.appendChild(card);
        });
    }
}

function recalculateSchedule() {
    state.schedule.sessions = assignTimes(state.schedule.sessions.map((session) => ({
        ...session,
        plannedMinutes: session.studyMinutes + session.breakMinutes,
    })));
    state.schedule.totalMinutes = state.schedule.sessions.reduce(
        (sum, item) => sum + item.studyMinutes + item.breakMinutes,
        0
    );
}

function saveTableEdits() {
    const rows = Array.from(scheduleTableBody.querySelectorAll('tr'));
    rows.forEach((row) => {
        const index = Number(row.dataset.index);
        const studyInput = row.querySelector('.study-input');
        const breakInput = row.querySelector('.break-input');
        const session = state.schedule.sessions[index];
        if (session) {
            session.studyMinutes = Math.max(5, Number(studyInput.value) || session.studyMinutes);
            session.breakMinutes = Math.max(0, Number(breakInput.value) || session.breakMinutes);
        }
    });
    recalculateSchedule();
    saveState();
    renderSchedule();
    addMessage('Schedule changes saved. You can start the next task when ready.', 'bot');
}

function getNextPendingIndex() {
    if (!state.schedule) return -1;
    return state.schedule.sessions.findIndex((session) => session.status === 'pending');
}

function startNextTask() {
    const nextIndex = getNextPendingIndex();
    if (nextIndex === -1) {
        addMessage('All planned tasks are complete. Great job!', 'bot');
        return;
    }
    startTask(nextIndex);
}

function startTask(index) {
    const session = state.schedule.sessions[index];
    if (!session) return;
    if (state.timerId) {
        clearInterval(state.timerId);
    }
    session.status = 'running';
    state.currentTaskIndex = index;
    state.timerRemaining = session.studyMinutes * 60;
    state.timerId = setInterval(runTimer, 1000);
    saveState();
    timerLabel.innerText = `Working on ${session.subject}`;
    timerClock.innerText = formatSeconds(state.timerRemaining);
    timerPanel.classList.remove('hidden');
    renderSchedule();
    requestNotificationPermission();
    showNotification('Task started', `Focus on ${session.subject} for ${session.studyMinutes} minutes.`);
}

function runTimer() {
    state.timerRemaining -= 1;
    if (state.timerRemaining < 0) {
        completeCurrentTask();
        return;
    }
    timerClock.innerText = formatSeconds(state.timerRemaining);
}

async function completeCurrentTask() {
    clearInterval(state.timerId);
    state.timerId = null;
    const session = state.schedule.sessions[state.currentTaskIndex];
    if (!session) return;
    session.status = 'done';
    state.points += 10;
    saveState();
    renderSchedule();
    timerPanel.classList.add('hidden');
    showNotification('Task complete', `You finished ${session.subject}!`);

    const confirmQuiz = confirm(`Well done on ${session.subject}! Ready for a short mini test? Press OK for quiz, Cancel if you're done.`);
    if (confirmQuiz) {
        await runMiniQuiz();
    } else {
        addMessage(`Nice work! ${session.subject} is marked complete.`, 'bot');
    }
}

async function runMiniQuiz() {
    if (!state.notes || state.notes.trim().toLowerCase() === 'skip') {
        addMessage('No notes were provided for a quiz. Add notes next time to activate review challenges.', 'bot');
        return;
    }
    addMessage('Generating a little review quiz from your notes...', 'bot');
    try {
        const response = await fetch(`${API_BASE}/review-notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: state.subjects.join(', '), notes: state.notes }),
        });
        const data = await response.json();
        if (data.flashcards && data.flashcards.length) {
            const card = data.flashcards[state.currentFlashcard % data.flashcards.length];
            state.currentFlashcard += 1;
            saveState();
            addMessage(`Mini test question: ${card.question}`, 'bot');
            addMessage(`Answer hint: ${card.answer}`, 'bot');
        } else {
            addMessage(data.summary || 'Unable to create quiz right now.', 'bot');
        }
    } catch (err) {
        addMessage('Unable to request AI quiz right now. Please check your backend.', 'bot');
    }
}

function showSuggestion() {
    if (!state.schedule) {
        addMessage('Generate a schedule first, then I can suggest improvements.', 'bot');
        return;
    }
    const ratio = state.schedule.totalMinutes / state.schedule.availableMinutes;
    if (ratio > 0.85) {
        addMessage('Your plan is intense. Consider shorter sessions or a longer break to stay refreshed.', 'bot');
    } else if (ratio > 0.65) {
        addMessage('Nice balance! You can keep this pace or add one review block if you want a bit more depth.', 'bot');
    } else {
        addMessage('You have spare time available. Add another subject review session or extend current study blocks.', 'bot');
    }
}

async function requestSchedule() {
    addMessage('Creating your schedule with the AI planner...', 'bot');
    const payload = {
        subjects: state.subjects.map((subject) => ({ name: subject, hours_per_day: 1.0 })),
        days: state.days,
        daily_hours: state.dailyHours,
        confidence: state.confidence,
        notes: state.notes,
    };

    try {
        const response = await fetch(`${API_BASE}/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error('Backend schedule generation failed');
        }
        const data = await response.json();
        const sessions = data.sessions.map((session, index) => ({
            ...session,
            status: 'pending',
            index,
            studyMinutes: session.study_minutes,
            breakMinutes: session.break_minutes,
        }));
        const schedule = {
            totalMinutes: data.recommended_minutes,
            availableMinutes: data.available_minutes,
            sessions: assignTimes(sessions),
        };
        buildSchedule(schedule);
        renderSchedule();
        requestNotificationPermission();
    } catch (error) {
        addMessage('Error generating schedule. Make sure the backend is running.', 'bot');
    }
}

function handleAnswer(text) {
    const value = text.trim();
    if (!value) return;
    addMessage(value, 'user');
    inputEl.value = '';
    statusPill.innerText = 'Processing...';

    switch (state.step) {
        case 0:
            state.userName = value;
            state.step = 1;
            saveState();
            ask(prompts[1].replace('{{name}}', state.userName));
            break;
        case 1:
            state.subjects = normalizeSubjects(value);
            if (!state.subjects.length) {
                ask('Please list at least one subject, separated by commas.');
                break;
            }
            state.step = 2;
            saveState();
            ask(prompts[2]);
            break;
        case 2:
            state.days = parseInt(value, 10);
            if (isNaN(state.days) || state.days <= 0) {
                ask('Enter a valid number of days (for example 3).');
                break;
            }
            state.step = 3;
            saveState();
            ask(prompts[3]);
            break;
        case 3:
            state.dailyHours = parseFloat(value);
            if (isNaN(state.dailyHours) || state.dailyHours <= 0) {
                ask('Enter a valid number of hours per day, like 2 or 4.5.');
                break;
            }
            state.step = 4;
            saveState();
            ask(prompts[4]);
            break;
        case 4:
            state.confidence = Math.min(10, Math.max(1, parseInt(value, 10) || 5));
            state.step = 5;
            saveState();
            ask(prompts[5]);
            break;
        case 5:
            state.notes = value;
            state.step = 6;
            saveState();
            ask(prompts[6]);
            requestSchedule();
            if (state.notes.trim().toLowerCase() !== 'skip') {
                addMessage('Notes saved. You can use them for AI review and mini quizzes.', 'bot');
            }
            break;
        case 6:
            if (/^y(es)?$/i.test(value)) {
                addMessage('Great! Your plan is confirmed. Use the buttons to start, edit, or save your schedule.', 'bot');
                statusPill.innerText = 'Plan confirmed';
                state.step = 7;
            } else if (/^change|edit|no$/i.test(value)) {
                addMessage('Which part do you want to update? Type "subjects", "days", "hours", or "confidence".', 'bot');
                state.step = 8;
            } else {
                addMessage('Please answer with "yes" or "change".', 'bot');
            }
            saveState();
            break;
        case 8:
            if (/subjects/i.test(value)) {
                state.step = 1;
                ask('Enter the subjects again, separated by commas.');
            } else if (/days/i.test(value)) {
                state.step = 2;
                ask('How many days should your new plan cover?');
            } else if (/hours/i.test(value)) {
                state.step = 3;
                ask('How many hours per day can you invest now?');
            } else if (/confidence/i.test(value)) {
                state.step = 4;
                ask('How confident are you about the material, from 1 to 10?');
            } else {
                addMessage('Type one of: subjects, days, hours, or confidence.', 'bot');
            }
            saveState();
            break;
        default:
            if (/restart/i.test(value)) {
                state = { ...defaultState };
                saveState();
                scheduleContainer.classList.add('hidden');
                ask(prompts[0]);
            } else {
                addMessage('If you want to restart the plan, type "restart" or press the scheduler buttons.', 'bot');
            }
            break;
    }
}

sendBtn.addEventListener('click', () => handleAnswer(inputEl.value));
inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleAnswer(inputEl.value);
    }
});

themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light-mode');
    const isLight = document.documentElement.classList.contains('light-mode');
    themeToggle.innerText = isLight ? 'Dark Mode' : 'Light Mode';
});

paletteDots.forEach((dot) => {
    dot.addEventListener('click', () => {
        const palette = dot.dataset.palette;
        document.documentElement.dataset.palette = palette;
    });
});

saveTableBtn.addEventListener('click', saveTableEdits);
startTaskBtn.addEventListener('click', startNextTask);
suggestBtn.addEventListener('click', showSuggestion);
stopTimerBtn.addEventListener('click', () => {
    if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
        timerPanel.classList.add('hidden');
        addMessage('Timer stopped. You can start the next task when ready.', 'bot');
    }
});

editPlanBtn.addEventListener('click', () => {
    state.step = 8;
    ask('What would you like to edit? Type "subjects", "days", "hours", or "confidence".');
});

window.addEventListener('load', () => {
    loadState();
    if (state.step === 0 || !state.userName) {
        ask(prompts[0]);
    } else if (state.schedule) {
        addMessage(`Welcome back, ${state.userName}! Your saved plan is ready.`, 'bot');
        renderSchedule();
    } else {
        ask(prompts[state.step].replace('{{name}}', state.userName));
    }
});
