const API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Handle API responses and catch errors.
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Set headers if not already set
    if (!options.headers) {
        options.headers = {
            'Content-Type': 'application/json',
        };
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        
        // Dispatch custom event to trigger the offline alert banner on the frontend
        window.dispatchEvent(new CustomEvent('backend-offline', { detail: error.message }));
        
        throw error;
    }
}

/**
 * ReStartU API Services
 */
const ReStartU_API = {
    // Check if the backend is online
    async checkHealth() {
        try {
            return await apiRequest('/');
        } catch (e) {
            return { status: 'offline' };
        }
    },

    // Request a study session
    async getSession(userId, subject, confidence, daysOff, studyHours, fatigue) {
        return await apiRequest('/get-session', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
                subject: subject,
                confidence: parseInt(confidence),
                days_off: parseInt(daysOff),
                study_hours: parseFloat(studyHours),
                fatigue: parseInt(fatigue)
            })
        });
    },

    // Get study session history for a user
    async getHistory(userId) {
        return await apiRequest(`/history/${userId}`);
    },

    // Update study session completion status
    async completeSession(sessionId, completedMinutes, isCompleted = true) {
        return await apiRequest('/complete-session', {
            method: 'POST',
            body: JSON.stringify({
                id: sessionId,
                completed_minutes: parseInt(completedMinutes),
                is_completed: isCompleted
            })
        });
    }
};

// Add global error handler listener to display the offline banner across all pages
window.addEventListener('DOMContentLoaded', () => {
    // Inject custom CSS for the error alert banner if it doesn't exist
    const style = document.createElement('style');
    style.textContent = `
        .backend-offline-banner {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: linear-gradient(135deg, #ff416c, #ff4b2b);
            color: white;
            padding: 15px 30px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(255, 75, 43, 0.4);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 15px;
            font-weight: 600;
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            font-family: 'Inter', sans-serif;
            border: 1px solid rgba(255, 255, 255, 0.2);
            pointer-events: auto;
        }
        .backend-offline-banner.visible {
            transform: translateX(-50%) translateY(0);
        }
        .backend-offline-banner button {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 5px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 12px;
            transition: 0.2s;
        }
        .backend-offline-banner button:hover {
            background: rgba(255,255,255,0.3);
        }
    `;
    document.head.appendChild(style);

    // Create the banner element
    const banner = document.createElement('div');
    banner.className = 'backend-offline-banner';
    banner.innerHTML = `
        <span>⚠️ Server is temporarily unavailable. Please try again.</span>
        <button onclick="location.reload()">Retry</button>
    `;
    document.body.appendChild(banner);

    // Show banner on offline event
    window.addEventListener('backend-offline', () => {
        banner.classList.add('visible');
    });
});
