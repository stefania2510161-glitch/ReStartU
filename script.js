document.getElementById('predictBtn').addEventListener('click', async () => {
    const breakDays = document.getElementById('breakDays').value;
    const confidence = document.getElementById('confidence').value;
    const freeHours = document.getElementById('freeHours').value;

    if (!breakDays || !confidence || !freeHours) {
        alert("Please fill in all details before starting!");
        return;
    }

    const btn = document.getElementById('predictBtn');
    btn.innerText = "ReStartU AI is calculating...";

    try {
        const response = await fetch(`http://127.0.0.1:8000/get-session?confidence=${confidence}&days_off=${breakDays}&free_hours=${freeHours}`);
        
        if (!response.ok) throw new Error("Backend error");

        const data = await response.json();

        localStorage.setItem('studyMins', data.recommended_minutes);
        window.location.href = "planner.html";

    } catch (err) {
        alert("Error: Is your Python backend running? Run 'uvicorn main:app --reload'");
        btn.innerText = "Start My Plan";
    }
});
