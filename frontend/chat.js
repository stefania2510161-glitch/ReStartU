const API_BASE = window.location.origin || 'http://127.0.0.1:8000';
let googleUser = null;
const authView = document.getElementById('authView');
const onboardingView = document.getElementById('onboardingView');
const workspaceView = document.getElementById('workspaceView');
const signInBtn = document.getElementById('signInBtn');
const onboardingForm = document.getElementById('onboardingForm');
const themeToggle = document.getElementById('themeToggle');
const paletteDots = document.querySelectorAll('[data-palette]');
const welcomeTitle = document.getElementById('welcomeTitle');
const welcomeText = document.getElementById('welcomeText');
const subjectInput = document.getElementById('subjectInput');
const subjectList = document.getElementById('subjectList');
const addSubjectsBtn = document.getElementById('addSubjectsBtn');
const addSubjectBtn = document.getElementById('addSubjectBtn');
const addSubjectQuickBtn = document.getElementById('addSubjectQuickBtn');
const generatePlanBtn = document.getElementById('generatePlanBtn');
const planSummary = document.getElementById('planSummary');
const timetableList = document.getElementById('timetableList');
const historyList = document.getElementById('historyList');
const newChatBtn = document.getElementById('newChatBtn');
const deleteChatBtn = document.getElementById('deleteChatBtn');

const defaultState = {
    auth: false,
    onboarded: false,
    profile: {
        name: '',
        username: '',
        age: '',
        gender: '',
        year: '',
    },
    theme: 'light',
    palette: 'warm',
    subjects: [],
    plan: null,
    chatHistory: [],
    activeChatId: null,
};

let state = { ...defaultState };

function saveState() {
    localStorage.setItem('restartuStateV2', JSON.stringify(state));
}

function loadState() {
    const stored = localStorage.getItem('restartuStateV2');
    if (stored) {
        state = { ...defaultState, ...JSON.parse(stored) };
        state.profile = { ...defaultState.profile, ...(stored ? JSON.parse(stored).profile || {} : {}) };
    }
}

function applyTheme() {
    document.documentElement.classList.toggle('light-mode', state.theme === 'light');
    themeToggle.innerText = state.theme === 'light' ? 'Dark mode' : 'Light mode';
}

function applyPalette(palette) {
    state.palette = palette;
    document.documentElement.dataset.palette = palette;
    saveState();
}

function showView(view) {
    authView.classList.add('hidden');
    onboardingView.classList.add('hidden');
    workspaceView.classList.add('hidden');
    view.classList.remove('hidden');
}

function createHistoryEntry(title, preview, planData = null) {
    const entry = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        title,
        preview,
        plan: planData ? JSON.parse(JSON.stringify(planData)) : null,
        updatedAt: Date.now(),
    };
    state.chatHistory = [entry, ...state.chatHistory];
    state.activeChatId = entry.id;
    saveState();
    renderHistoryList();
}

function renderHistoryList() {
    if (!historyList) return;
    historyList.innerHTML = '';

    if (!state.chatHistory.length) {
        const empty = document.createElement('div');
        empty.className = 'history-empty';
        empty.innerText = 'No saved plans yet';
        historyList.appendChild(empty);
        return;
    }

    const sorted = [...state.chatHistory].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    sorted.forEach((chat) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `history-item ${chat.id === state.activeChatId ? 'active' : ''}`;
        item.innerHTML = `
            <span class="history-title">${chat.title}</span>
            <span class="history-meta">${chat.preview}</span>
        `;
        item.addEventListener('click', () => {
            state.activeChatId = chat.id;
            if (chat.plan) {
                state.plan = chat.plan;
                renderPlan();
            }
            saveState();
            renderHistoryList();
        });
        historyList.appendChild(item);
    });
}

function renderSubjects() {
    subjectList.innerHTML = '';

    if (!state.subjects.length) {
        const empty = document.createElement('div');
        empty.className = 'history-empty';
        empty.innerText = 'No subjects added yet';
        subjectList.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();
    state.subjects.forEach((subject, index) => {
        const chip = document.createElement('div');
        chip.className = 'subject-chip';
        chip.innerHTML = `
            <span>${subject}</span>
            <button type="button" aria-label="Remove ${subject}">×</button>
        `;
        chip.querySelector('button').addEventListener('click', () => {
            state.subjects.splice(index, 1);
            saveState();
            renderSubjects();
        });
        fragment.appendChild(chip);
    });
    subjectList.appendChild(fragment);
}

function renderWorkspace() {
    const profileName = state.profile.name || 'student';
    welcomeTitle.innerText = `Welcome, ${profileName}`;
    welcomeText.innerText = `You are set up for a calm, focused semester. Add your subjects and generate your first timetable.`;
    renderSubjects();
    renderHistoryList();
    renderPlan();
}

function renderPlan() {
    if (!state.plan) {
        planSummary.innerText = 'No timetable yet. Add subjects to begin.';
        timetableList.innerHTML = '';
        return;
    }

    const totalMinutes = state.plan.totalMinutes || 0;
    const days = state.plan.days || 3;
    const blocks = state.plan.blocks || [];

    planSummary.innerHTML = `
        <div class="plan-summary-card">
            <strong>${totalMinutes} minutes planned</strong>
            <span>Across ${days} study day(s) with a calm, steady rhythm.</span>
        </div>
    `;

    if (!blocks.length) {
        timetableList.innerHTML = '<div class="history-empty">Your generated blocks will appear here.</div>';
        return;
    }

    timetableList.innerHTML = blocks
        .map((block) => `
            <div class="timetable-item">
                <div>
                    <div class="timetable-title">${block.title}</div>
                    <div class="timetable-meta">${block.minutes ? `${block.minutes} min` : ''}${block.breakMinutes ? ` · ${block.breakMinutes} min break` : ''}</div>
                </div>
                <strong>${block.time}</strong>
            </div>
        `)
        .join('');
}

function addSubjectFromInput() {
    const inputValue = subjectInput.value.trim();
    if (!inputValue) {
        return;
    }
    const parsed = inputValue
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
    if (!parsed.length) {
        return;
    }

    state.subjects = [...new Set([...state.subjects, ...parsed])];
    subjectInput.value = '';
    saveState();
    renderSubjects();
    createHistoryEntry('Subjects added', parsed.slice(0, 3).join(', '));
}

function addQuickSubject() {
    const label = `Focus block ${state.subjects.length + 1}`;
    state.subjects = [...state.subjects, label];
    saveState();
    renderSubjects();
    createHistoryEntry('New focus block', label);
}

function buildFallbackPlan() {
    const baseMinutes = Math.max(90, state.subjects.length * 45);
    const blocks = state.subjects.slice(0, 4).map((subject, index) => ({
        title: subject,
        minutes: 30 + index * 10,
        breakMinutes: index === 1 ? 5 : 0,
        time: `${9 + index}:00` + (index % 2 === 0 ? ' AM' : ' PM'),
    }));
    state.plan = {
        totalMinutes: baseMinutes,
        days: 3,
        blocks,
    };
    saveState();
    renderPlan();
    localStorage.setItem('studyMins', baseMinutes);
}

async function generatePlan() {
    if (!state.subjects.length) {
        planSummary.innerText = 'Add at least one subject before generating your timetable.';
        return;
    }

    planSummary.innerText = 'Generating your timetable...';
    try {
        const response = await fetch(`${API_BASE}/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subjects: state.subjects.map((subject) => ({ name: subject, hours_per_day: 1.0 })),
                days: 3,
                daily_hours: 3,
                confidence: 7,
                notes: '',
            }),
        });
        if (!response.ok) {
            throw new Error('Backend unavailable');
        }
        const data = await response.json();
        const planData = {
            totalMinutes: data.recommended_minutes,
            days: 3,
            blocks: data.sessions.slice(0, 6).map((session, index) => ({
                title: session.subject,
                minutes: session.study_minutes,
                breakMinutes: session.break_minutes || 0,
                time: `${9 + Math.floor(index / 2)}:${index % 2 === 0 ? '00' : '30'} ${index < 2 ? 'AM' : 'PM'}`,
            })),
        };
        state.plan = planData;
        localStorage.setItem('studyMins', data.recommended_minutes);
        saveState();
        renderPlan();
        createHistoryEntry('Plan generated', `${state.subjects.length} subjects ready`, planData);
    } catch (error) {
        buildFallbackPlan();
        createHistoryEntry('Plan generated', 'Fallback timetable created', state.plan);
    }
}

function startAuth() {
    if (window.google && window.google.accounts) {
        window.google.accounts.id.prompt();
        return;
    }

    state.auth = true;
    state.profile.name = state.profile.name || 'Guest';
    saveState();
    if (state.onboarded) {
        showView(workspaceView);
        renderWorkspace();
    } else {
        showView(onboardingView);
    }
}

function handleGoogleCredentialResponse(response) {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    googleUser = payload;
    state.auth = true;
    state.profile = {
        ...state.profile,
        name: payload.name || '',
        username: payload.given_name || payload.email?.split('@')[0] || '',
        age: state.profile.age || '',
        gender: state.profile.gender || '',
        year: state.profile.year || '',
    };
    saveState();
    if (state.onboarded) {
        showView(workspaceView);
        renderWorkspace();
    } else {
        showView(onboardingView);
    }
}

function completeOnboarding(event) {
    event.preventDefault();
    const formData = new FormData(onboardingForm);
    state.profile = {
        name: formData.get('name')?.toString().trim() || '',
        username: formData.get('username')?.toString().trim() || '',
        age: formData.get('age')?.toString().trim() || '',
        gender: formData.get('gender')?.toString().trim() || '',
        year: formData.get('year')?.toString().trim() || '',
    };
    state.onboarded = true;
    saveState();
    showView(workspaceView);
    renderWorkspace();
    createHistoryEntry('Profile ready', `Welcome ${state.profile.name || 'student'}`);
}

function resetCurrentChat() {
    state.chatHistory = [];
    state.activeChatId = null;
    state.plan = null;
    saveState();
    renderHistoryList();
    renderPlan();
}

function deleteCurrentChat() {
    state.chatHistory = [];
    state.activeChatId = null;
    state.plan = null;
    saveState();
    renderHistoryList();
    renderPlan();
}

if (signInBtn) {
    signInBtn.addEventListener('click', (event) => {
        if (event.target === signInBtn) {
            startAuth();
        }
    });
}
onboardingForm.addEventListener('submit', completeOnboarding);
addSubjectsBtn.addEventListener('click', addSubjectFromInput);
addSubjectBtn.addEventListener('click', addQuickSubject);
addSubjectQuickBtn.addEventListener('click', addQuickSubject);
generatePlanBtn.addEventListener('click', generatePlan);
newChatBtn.addEventListener('click', resetCurrentChat);
deleteChatBtn.addEventListener('click', deleteCurrentChat);

 themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveState();
});

paletteDots.forEach((dot) => {
    dot.addEventListener('click', () => {
        applyPalette(dot.dataset.palette);
    });
});

window.addEventListener('load', () => {
    loadState();
    applyTheme();
    applyPalette(state.palette);

    if (window.google?.accounts?.id && window.RESTARTU_GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
            client_id: window.RESTARTU_GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
        });
        window.google.accounts.id.renderButton(document.getElementById('signInBtn'), {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
        });
    }

    if (!state.auth) {
        showView(authView);
        return;
    }

    if (!state.onboarded) {
        showView(onboardingView);
    } else {
        showView(workspaceView);
        renderWorkspace();
    }
});
