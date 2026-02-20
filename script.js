// Landing Page
if (document.getElementById("startBtn")) {
    document.getElementById("startBtn").addEventListener("click", function () {
        window.location.href = "input.html";
    });
}

// Input Page
if (document.getElementById("predictBtn")) {
    document.getElementById("predictBtn").addEventListener("click", function () {

        let breakDays = Number(document.getElementById("breakDays").value);
        let confidence = Number(document.getElementById("confidence").value);
        let freeHours = Number(document.getElementById("freeHours").value);

        // ML-based formula (from linear regression idea)
        let difficulty =
            (0.02 * breakDays) +
            (0.5 * confidence) +
            (0.3 * freeHours) + 1;

        difficulty = Math.round(difficulty);
        difficulty = Math.max(1, Math.min(3, difficulty));

        localStorage.setItem("difficulty", difficulty);
        localStorage.setItem("day", 1);

        window.location.href = "planner.html";
    });
}

// Planner Page
if (document.getElementById("dayText")) {

    let difficulty = Number(localStorage.getItem("difficulty")) || 1;
    let day = Number(localStorage.getItem("day")) || 1;

    document.getElementById("dayText").innerText = "Day " + day;
    document.getElementById("difficultyText").innerText = "Difficulty: " + difficulty;

    let easy = ["Revise basics", "Solve 5 easy questions"];
    let medium = ["Solve 10 moderate questions", "Write short notes"];
    let hard = ["Take 30 min mock test", "Mixed concept practice"];

    function generateQuestion() {
        let question;

        if (difficulty === 1)
            question = easy[Math.floor(Math.random() * easy.length)];
        else if (difficulty === 2)
            question = medium[Math.floor(Math.random() * medium.length)];
        else
            question = hard[Math.floor(Math.random() * hard.length)];

        document.getElementById("questionBox").innerText = question;
    }

    generateQuestion();

    document.getElementById("completeBtn").addEventListener("click", function () {
        difficulty++;
        day++;

        localStorage.setItem("difficulty", difficulty);
        localStorage.setItem("day", day);

        location.reload();
    });

    document.getElementById("notCompleteBtn").addEventListener("click", function () {
        difficulty = Math.max(1, difficulty - 1);
        day++;

        localStorage.setItem("difficulty", difficulty);
        localStorage.setItem("day", day);

        location.reload();
    });
}