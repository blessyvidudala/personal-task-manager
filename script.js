// ===== Deadlines: personal task manager =====
// Data is saved in your browser (localStorage). Use "Export backup" to keep a file copy.

const STORAGE_KEY = "deadlines.tasks.v1";
const PRIORITY_NAMES = { 1: "High", 2: "Medium", 3: "Low" };
const SOON_DAYS = 7; // "due this week" window in the summary

const $ = (id) => document.getElementById(id);
let tasks = load();
let filter = "all";

/* ---------- storage ---------- */
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
}

/* ---------- dates ---------- */
function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysUntil(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d) - todayStart()) / 86400000);
}
function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function status(t) {
  if (t.done) return "done";
  const n = daysUntil(t.due);
  return n < 0 ? "overdue" : n === 0 ? "today" : "upcoming";
}
function dueLabel(t) {
  const n = daysUntil(t.due);
  if (t.done) return "Completed";
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} overdue`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `Due in ${n} days`;
}

/* ---------- actions ---------- */
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function saveTask(e) {
  e.preventDefault();
  const id = $("task-id").value;
  const data = {
    title: $("title").value.trim(),
    due: $("due").value,
    time: $("time").value,
    remind: Number($("remind").value),
    priority: Number($("priority").value),
    category: $("category").value.trim(),
  };
  if (!data.title || !data.due) return;
  if (id) {
    tasks = tasks.map((t) => {
      if (t.id !== id) return t;
      const retimed = t.due !== data.due || (t.time || "") !== data.time || t.remind !== data.remind;
      return retimed ? rearm({ ...t, ...data }) : { ...t, ...data };
    });
  } else {
    tasks.push(rearm({ id: newId(), done: false, created: Date.now(), ...data }));
  }
  save();
  resetForm();
  render();
}

function editTask(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  $("task-id").value = t.id;
  $("title").value = t.title;
  $("due").value = t.due;
  $("time").value = t.time || "";
  $("remind").value = String(t.remind ?? -1);
  $("priority").value = t.priority;
  $("category").value = t.category || "";
  $("save-btn").textContent = "Save changes";
  $("cancel-btn").hidden = false;
  $("title").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  $("task-form").reset();
  $("task-id").value = "";
  $("due").value = toISO(todayStart());
  $("save-btn").textContent = "Add task";
  $("cancel-btn").hidden = true;
}

function toggleDone(id) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  save(); render();
}

function deleteTask(id) {
  const t = tasks.find((x) => x.id === id);
  if (t && confirm(`Delete "${t.title}"?`)) {
    tasks = tasks.filter((x) => x.id !== id);
    save(); render();
  }
}

/* ---------- rendering ---------- */
function visibleTasks() {
  const q = $("search").value.trim().toLowerCase();
  let list = tasks.filter((t) => {
    const s = status(t);
    if (filter === "done") return s === "done";
    if (filter !== "all" && s !== filter) return false;
    return true;
  });
  if (q) list = list.filter((t) => (t.title + " " + (t.category || "")).toLowerCase().includes(q));

  const sort = $("sort").value;
  list.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1; // finished tasks sink to the bottom
    if (sort === "priority") return a.priority - b.priority || a.due.localeCompare(b.due);
    if (sort === "added") return b.created - a.created;
    return a.due.localeCompare(b.due) || a.priority - b.priority;
  });
  return list;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render() {
  const list = $("list");
  list.replaceChildren();
  const items = visibleTasks();

  items.forEach((t) => {
    const s = status(t);
    const li = el("li", `task ${s}`);

    const box = el("input");
    box.type = "checkbox";
    box.checked = t.done;
    box.setAttribute("aria-label", `Mark "${t.title}" as done`);
    box.addEventListener("change", () => toggleDone(t.id));

    const body = el("div");
    body.append(el("div", "title", t.title));
    const meta = el("div", "meta");
    meta.append(el("span", `when ${s}`, dueLabel(t)), el("span", "", formatDate(t.due) + (t.time ? " at " + formatTime(t.time) : "")), el("span", "", `${PRIORITY_NAMES[t.priority]} priority`));
    if (t.category) meta.append(el("span", "", t.category));
    if (t.remind >= 0 && !t.done) meta.append(el("span", "", `Alarm ${REMIND_TEXT[t.remind]}`));
    body.append(meta);

    const actions = el("div", "actions");
    const edit = el("button", "", "Edit");
    edit.addEventListener("click", () => editTask(t.id));
    const del = el("button", "", "Delete");
    del.addEventListener("click", () => deleteTask(t.id));
    actions.append(edit, del);

    li.append(box, body, actions);
    list.append(li);
  });

  const empty = $("empty");
  empty.hidden = items.length > 0;
  empty.textContent = tasks.length ? "No tasks match this view." : "No tasks yet. Add your first deadline above.";

  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => daysUntil(t.due) < 0).length;
  const soon = open.filter((t) => { const n = daysUntil(t.due); return n >= 0 && n <= SOON_DAYS; }).length;
  $("summary").textContent = `${open.length} open · ${overdue} overdue · ${soon} due in the next ${SOON_DAYS} days`;
}

/* ---------- alarms ---------- */
// Alarms ring only while this page is open in a browser tab.
const REMIND_TEXT = { 0: "at due time", 10: "10 min before", 60: "1 hour before", 1440: "1 day before" };
const DEFAULT_TIME = "09:00";      // used when a task has a date but no time
const SNOOZE_MINUTES = 10;
const CHECK_EVERY_MS = 15000;
let audioCtx = null;

function formatTime(hhmm) {
  return new Date(`1970-01-01T${hhmm}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function dueDate(t) {
  const [y, m, d] = t.due.split("-").map(Number);
  const [hh, mm] = (t.time || DEFAULT_TIME).split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}
function alarmTime(t) {
  if (!(t.remind >= 0)) return null; // no alarm set
  return new Date(dueDate(t).getTime() - t.remind * 60000);
}
// Mark alarms whose time has already passed as handled, so new tasks don't ring instantly.
function rearm(t) {
  const at = alarmTime(t);
  t.alarmed = !!at && at.getTime() <= Date.now();
  t.snoozeUntil = null;
  return t;
}

function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {}
}
function beep() {
  if (!audioCtx) return;
  try {
    [0, 0.35, 0.7].forEach((delay) => {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.frequency.value = 880; gain.gain.value = 0.2;
      osc.connect(gain); gain.connect(audioCtx.destination);
      const start = audioCtx.currentTime + delay;
      osc.start(start); osc.stop(start + 0.25);
    });
  } catch {}
}

function showBanner(t) {
  const box = el("div", "alarm");
  box.dataset.id = t.id;
  box.append(el("span", "", `${t.title}: ${dueLabel(t)}`));
  const actions = el("div", "actions");
  const snooze = el("button", "", `Snooze ${SNOOZE_MINUTES} min`);
  snooze.addEventListener("click", () => {
    t.snoozeUntil = Date.now() + SNOOZE_MINUTES * 60000; save(); box.remove();
  });
  const done = el("button", "", "Mark done");
  done.addEventListener("click", () => { box.remove(); toggleDone(t.id); });
  const dismiss = el("button", "", "Dismiss");
  dismiss.addEventListener("click", () => box.remove());
  actions.append(snooze, done, dismiss);
  box.append(actions);
  document.querySelectorAll(`#alarms [data-id="${t.id}"]`).forEach((n) => n.remove());
  $("alarms").append(box);
}

function ring(t) {
  beep();
  showBanner(t);
  try {
    if (window.Notification && Notification.permission === "granted") {
      new Notification(`Deadline: ${t.title}`, { body: dueLabel(t) });
    }
  } catch {}
}

function checkAlarms() {
  const now = Date.now();
  let changed = false;
  tasks.forEach((t) => {
    if (t.done) return;
    if (t.snoozeUntil) {
      if (now >= t.snoozeUntil) { t.snoozeUntil = null; changed = true; ring(t); }
      return;
    }
    if (t.alarmed) return;
    const at = alarmTime(t);
    if (!at || now < at.getTime()) return;
    t.alarmed = true; changed = true;
    if (now - at.getTime() < 86400000) ring(t); // alarms missed by over a day are skipped
  });
  if (changed) save();
}

function updateAlarmBtn() {
  $("alarm-btn").textContent = window.Notification && Notification.permission === "granted"
    ? "Alarms on (test sound)" : "Turn on alarms";
}

/* ---------- backup ---------- */
function exportTasks() {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
  const a = el("a");
  a.href = URL.createObjectURL(blob);
  a.download = `deadlines-backup-${toISO(todayStart())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importTasks(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error();
      const valid = data.filter((t) => t && t.title && /^\d{4}-\d{2}-\d{2}$/.test(t.due));
      if (confirm(`Replace your current tasks with ${valid.length} imported tasks?`)) {
        tasks = valid.map((t) => ({
          id: t.id || newId(), title: String(t.title), due: t.due, done: !!t.done,
          priority: [1, 2, 3].includes(t.priority) ? t.priority : 2,
          category: t.category ? String(t.category) : "", created: t.created || Date.now(),
        }));
        save(); render();
      }
    } catch { alert("That file isn't a valid Deadlines backup."); }
  };
  reader.readAsText(file);
}

/* ---------- events ---------- */
$("task-form").addEventListener("submit", saveTask);
$("cancel-btn").addEventListener("click", resetForm);
$("search").addEventListener("input", render);
$("sort").addEventListener("change", render);
$("filters").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-filter]");
  if (!btn) return;
  filter = btn.dataset.filter;
  document.querySelectorAll("#filters button").forEach((b) => b.classList.toggle("active", b === btn));
  render();
});
$("export-btn").addEventListener("click", exportTasks);
$("import-btn").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", (e) => { if (e.target.files[0]) importTasks(e.target.files[0]); e.target.value = ""; });
$("clear-btn").addEventListener("click", () => {
  const n = tasks.filter((t) => t.done).length;
  if (n && confirm(`Delete ${n} completed task${n === 1 ? "" : "s"}?`)) {
    tasks = tasks.filter((t) => !t.done);
    save(); render();
  }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) { render(); checkAlarms(); } }); // refresh labels after midnight

$("alarm-btn").addEventListener("click", () => {
  unlockAudio(); beep();
  try { if (window.Notification && Notification.permission === "default") Notification.requestPermission().then(updateAlarmBtn); } catch {}
});
document.addEventListener("pointerdown", unlockAudio, { once: true }); // browsers only allow sound after a click

resetForm();
render();
updateAlarmBtn();
checkAlarms();
setInterval(checkAlarms, CHECK_EVERY_MS);
