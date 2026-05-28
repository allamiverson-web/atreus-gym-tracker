const STORAGE_KEY = "atreus-state-v1";
const LEGACY_STORAGE_KEY = "repquest-state-v1";
const muscles = ["chest", "back", "shoulders", "arms", "core", "legs"];
const muscleLabels = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  legs: "Legs"
};

const starterState = {
  selectedMuscle: "chest",
  timer: {
    running: false,
    startedAt: null,
    elapsed: 0
  },
  sessions: [],
  workouts: []
};

let state = loadState();
let ticker = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
    return saved ? { ...starterState, ...saved } : { ...starterState };
  } catch {
    return { ...starterState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function currentElapsed() {
  if (!state.timer.running || !state.timer.startedAt) {
    return state.timer.elapsed;
  }
  return state.timer.elapsed + Math.floor((Date.now() - state.timer.startedAt) / 1000);
}

function xpForWorkout(workout) {
  return Math.max(1, workout.sets * workout.reps + Math.floor(workout.weight / 10));
}

function totalXp() {
  return state.workouts.reduce((sum, workout) => sum + xpForWorkout(workout), 0);
}

function workoutsForDay(day) {
  return state.workouts.filter((workout) => workout.date === day);
}

function sessionsForDay(day) {
  return state.sessions.filter((session) => session.date === day);
}

function uniqueWorkoutDays() {
  return [...new Set([...state.sessions.map((s) => s.date), ...state.workouts.map((w) => w.date)])].sort();
}

function streak() {
  const days = new Set(uniqueWorkoutDays());
  let count = 0;
  const cursor = new Date();
  while (days.has(todayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function muscleXp(muscle) {
  return state.workouts
    .filter((workout) => workout.muscle === muscle)
    .reduce((sum, workout) => sum + xpForWorkout(workout), 0);
}

function setSelectedMuscle(muscle) {
  state.selectedMuscle = muscle;
  saveState();
  render();
}

function startTimer() {
  if (state.timer.running) return;
  state.timer.running = true;
  state.timer.startedAt = Date.now();
  saveState();
  startTicker();
  render();
}

function pauseTimer() {
  if (!state.timer.running) return;
  state.timer.elapsed = currentElapsed();
  state.timer.running = false;
  state.timer.startedAt = null;
  saveState();
  stopTicker();
  render();
}

function finishSession() {
  const elapsed = currentElapsed();
  const today = todayKey();
  if ((elapsed < 1 && workoutsForDay(today).length === 0) || sessionsForDay(today).length > 0) return;

  state.sessions.push({
    id: crypto.randomUUID(),
    date: today,
    duration: elapsed,
    finishedAt: new Date().toISOString()
  });
  state.timer = { running: false, startedAt: null, elapsed: 0 };
  saveState();
  stopTicker();
  render();
}

function addWorkout(event) {
  event.preventDefault();
  const exercise = $("#exercise-input").value.trim();
  const sets = Number($("#sets-input").value);
  const reps = Number($("#reps-input").value);
  const weight = Number($("#weight-input").value);
  if (!exercise || sets < 1 || reps < 1 || weight < 0) return;

  state.workouts.unshift({
    id: crypto.randomUUID(),
    date: todayKey(),
    muscle: state.selectedMuscle,
    exercise,
    sets,
    reps,
    weight,
    createdAt: new Date().toISOString()
  });
  $("#workout-form").reset();
  $("#sets-input").value = 3;
  $("#reps-input").value = 10;
  $("#weight-input").value = 0;
  saveState();
  render();
}

function deleteWorkout(id) {
  state.workouts = state.workouts.filter((workout) => workout.id !== id);
  saveState();
  render();
}

function resetData() {
  state = { ...starterState, timer: { ...starterState.timer }, sessions: [], workouts: [] };
  saveState();
  stopTicker();
  render();
}

function switchView(view) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  $$(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `${view}-view`));
  renderTrends();
}

function startTicker() {
  stopTicker();
  ticker = setInterval(() => {
    $("#timer-display").textContent = formatTime(currentElapsed());
  }, 250);
}

function stopTicker() {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

function render() {
  const selectedLabel = muscleLabels[state.selectedMuscle];
  const today = todayKey();
  const todaysWorkouts = workoutsForDay(today);
  const todaysSessions = sessionsForDay(today);
  const reps = state.workouts.reduce((sum, workout) => sum + workout.sets * workout.reps, 0);
  const xp = totalXp();

  $("#timer-display").textContent = formatTime(currentElapsed());
  $("#session-status").textContent = state.timer.running ? "Gym session live" : state.timer.elapsed > 0 ? "Paused session" : "Ready to train";
  $("#today-status").textContent = todaysSessions.length ? "Completed today" : todaysWorkouts.length ? "Workout in progress" : "No session today";
  $("#start-btn").disabled = state.timer.running;
  $("#pause-btn").disabled = !state.timer.running;
  $("#finish-btn").disabled = (currentElapsed() < 1 && todaysWorkouts.length === 0) || todaysSessions.length > 0;

  $("#level-stat").textContent = Math.floor(xp / 250) + 1;
  $("#xp-stat").textContent = xp;
  $("#streak-stat").textContent = `${streak()} days`;
  $("#reps-stat").textContent = reps;

  $("#selected-copy").textContent = `${selectedLabel} selected`;
  $("#form-title").textContent = `${selectedLabel} workout`;
  $("#muscle-xp").textContent = `${muscleXp(state.selectedMuscle)} XP`;
  $$(".muscle-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.muscle === state.selectedMuscle);
  });
  $$("[data-muscle-fill]").forEach((part) => {
    part.classList.toggle("active", part.dataset.muscleFill === state.selectedMuscle);
  });
  $$("[data-muscle-chip]").forEach((button) => {
    button.classList.toggle("active", button.dataset.muscleChip === state.selectedMuscle);
  });

  renderLog(todaysWorkouts);
  renderTrends();
}

function renderLog(items) {
  const list = $("#log-list");
  list.innerHTML = "";

  if (!items.length) {
    list.append($("#empty-template").content.cloneNode(true));
    return;
  }

  items.forEach((workout) => {
    const item = document.createElement("article");
    item.className = "log-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(workout.exercise)} · ${muscleLabels[workout.muscle]}</strong>
        <span>${workout.sets} sets x ${workout.reps} reps · ${workout.weight || 0} lb · +${xpForWorkout(workout)} XP</span>
      </div>
      <button class="delete-log" type="button" aria-label="Delete ${escapeHtml(workout.exercise)}" data-delete="${workout.id}">X</button>
    `;
    list.append(item);
  });
}

function renderTrends() {
  renderCalendar();
  renderBars();
  renderMuscles();
}

function renderCalendar() {
  const calendar = $("#calendar");
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const workedDays = new Set(uniqueWorkoutDays());

  $("#month-label").textContent = now.toLocaleString(undefined, { month: "long", year: "numeric" });
  calendar.innerHTML = "";

  for (let i = 0; i < first.getDay(); i += 1) {
    calendar.append(document.createElement("span"));
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(year, month, day);
    const key = todayKey(date);
    const cell = document.createElement("div");
    cell.className = `day${workedDays.has(key) ? " worked" : ""}`;
    cell.textContent = day;
    cell.title = workedDays.has(key) ? "Workout completed" : "No workout logged";
    calendar.append(cell);
  }
}

function renderBars() {
  const bars = $("#bars");
  const data = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 6);

  for (let i = 0; i < 7; i += 1) {
    const key = todayKey(cursor);
    const reps = workoutsForDay(key).reduce((sum, workout) => sum + workout.sets * workout.reps, 0);
    data.push({
      label: cursor.toLocaleDateString(undefined, { weekday: "short" }),
      reps
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const max = Math.max(...data.map((item) => item.reps), 1);
  const total = data.reduce((sum, item) => sum + item.reps, 0);
  $("#trend-summary").textContent = `${total} reps`;
  bars.innerHTML = "";

  data.forEach((item) => {
    const wrap = document.createElement("div");
    wrap.className = "bar-wrap";
    wrap.innerHTML = `
      <div class="bar" style="height: ${Math.max(6, (item.reps / max) * 210)}px" title="${item.reps} reps"></div>
      <span>${item.label}</span>
    `;
    bars.append(wrap);
  });
}

function renderMuscles() {
  const list = $("#muscle-list");
  const scores = muscles.map((muscle) => ({ muscle, xp: muscleXp(muscle) }));
  const max = Math.max(...scores.map((item) => item.xp), 1);
  list.innerHTML = "";

  scores.forEach(({ muscle, xp }) => {
    const card = document.createElement("article");
    card.className = "muscle-card";
    card.innerHTML = `
      <strong>${muscleLabels[muscle]}</strong>
      <span class="pill">${xp} XP</span>
      <div class="meter" aria-label="${muscleLabels[muscle]} progress"><span style="width: ${(xp / max) * 100}%"></span></div>
    `;
    list.append(card);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function bindEvents() {
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  $$(".muscle-btn").forEach((button) => {
    button.addEventListener("click", () => setSelectedMuscle(button.dataset.muscle));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelectedMuscle(button.dataset.muscle);
      }
    });
  });
  $$("[data-muscle-chip]").forEach((button) => {
    button.addEventListener("click", () => setSelectedMuscle(button.dataset.muscleChip));
  });
  $("#start-btn").addEventListener("click", startTimer);
  $("#pause-btn").addEventListener("click", pauseTimer);
  $("#finish-btn").addEventListener("click", finishSession);
  $("#workout-form").addEventListener("submit", addWorkout);
  $("#clear-demo-btn").addEventListener("click", resetData);
  $("#log-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete]");
    if (button) deleteWorkout(button.dataset.delete);
  });
}

function updateCityScroll() {
  const bg = $(".city-bg");
  if (bg) bg.style.setProperty("--scroll", `${window.scrollY}px`);
}

bindEvents();
window.addEventListener("scroll", updateCityScroll, { passive: true });
updateCityScroll();
if (state.timer.running) startTicker();
render();
