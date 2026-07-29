import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Home as HomeIcon, Dumbbell, TrendingUp, CalendarDays, BarChart3, MoreHorizontal,
  Flame, Target, Trash2, X, PartyPopper, Scale, Camera, BookOpen, Check,
  ChevronLeft, ChevronRight, Plus, Settings as SettingsIcon, Upload, Download,
  Lock, Info, Moon, Droplet, Smartphone, Users, Brain, Star, ListChecks,
} from "lucide-react";

/* Maps a stored habit icon key (e.g. "BookOpen") to its lucide component.
   Falls back to rendering the raw string (covers old emoji-based icons
   from before this update, so nothing already saved ever breaks). */
const HABIT_ICONS = { BookOpen, Moon, Droplet, Smartphone, Users, Brain, Star, Target, Flame };
function HabitIcon({ name, size = 18 }) {
  const Icon = HABIT_ICONS[name];
  if (Icon) return <Icon size={size} strokeWidth={2.2} />;
  return <span style={{ fontSize: size - 2 }}>{name}</span>;
}

/* Category color coding, used consistently everywhere a workout category shows up. */
const CATEGORY_COLORS = {
  "Upper Body": "#2563EB",
  "Lower Body": "#0D9488",
  "Full Body": "#16A34A",
  "Cardio": "#DC2626",
  "Core": "#B45309",
  "Other": "#6B7280",
};
function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
}
function CategoryBadge({ category, style }) {
  if (!category) return null;
  return (
    <span style={{ background: categoryColor(category), color: "#fff", fontSize: 12, fontWeight: 600, padding: "2px 9px", borderRadius: 10, ...style }}>
      {category}
    </span>
  );
}

/* ---------------- storage helpers ----------------
   window.storage is provided automatically inside Claude artifacts.
   When running this app standalone (outside Claude), it falls back
   to plain localStorage so everything still persists normally. */
const hasNativeStorage = typeof window !== "undefined" && !!window.storage;
const localStorageShim = {
  get: async (key) => {
    const v = window.localStorage.getItem("wj:" + key);
    return v == null ? null : { key, value: v };
  },
  set: async (key, value) => {
    window.localStorage.setItem("wj:" + key, value);
    return { key, value };
  },
};
const storage = hasNativeStorage ? window.storage : localStorageShim;

/* Races any promise against a timeout so a slow/hung storage call can
   never block the app from starting up. */
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("storage timeout")), ms)),
  ]);

const load = async (key, fallback) => {
  try {
    const r = await withTimeout(storage.get(key), 5000);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
};
const save = async (key, value) => {
  try {
    await withTimeout(storage.set(key, JSON.stringify(value)), 5000);
  } catch {}
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);
const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtDateShort = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtTime = (t) => t;

const DEFAULT_HABITS = [
  { key: "read", name: "Read", icon: "BookOpen", goal: "20 minutes a day", description: "Read a book, article, or anything not on a screen for work." },
  { key: "sleep", name: "Sleep Goal", icon: "Moon", goal: "8 hours a night", description: "Track nights you hit your target sleep window." },
  { key: "hydration", name: "Hydration", icon: "Droplet", goal: "64 oz of water", description: "Check in whenever you've hit your daily water goal." },
  { key: "screentime", name: "Screen Time Goal", icon: "Smartphone", goal: "Under 2 hours", description: "Keep recreational screen time under your daily limit." },
  { key: "social", name: "Social Media Limit", icon: "Users", goal: "Under 30 minutes", description: "Cap time spent on social apps." },
  { key: "meditate", name: "Meditation", icon: "Brain", goal: "10 minutes a day", description: "A few quiet minutes to reset." },
];

/* ---------------- root ---------------- */
export default function App() {
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState("system");
  const [systemDark, setSystemDark] = useState(true);
  const [tab, setTab] = useState("home");
  const [workouts, setWorkouts] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [habits, setHabits] = useState([]);
  const [records, setRecords] = useState([]);
  const [goals, setGoals] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null); // in-progress workout
  const [openWorkoutId, setOpenWorkoutId] = useState(null); // viewing detail
  const [openExercise, setOpenExercise] = useState(null); // viewing exercise history
  const [openHabit, setOpenHabit] = useState(null);
  const [openRecord, setOpenRecord] = useState(null);

  useEffect(() => {
    let settled = false;
    const failsafe = setTimeout(() => {
      if (!settled) { settled = true; setReady(true); }
    }, 8000);

    (async () => {
      try {
        const [w, wl, p, h, s, r, g] = await Promise.all([
          load("workouts", []),
          load("weightLogs", []),
          load("photos", []),
          load("habits", null),
          load("settings", { theme: "system" }),
          load("records", []),
          load("goals", []),
        ]);
        setWorkouts(w);
        setWeightLogs(wl);
        setPhotos(p);
        setHabits(h || DEFAULT_HABITS.map((d) => ({ id: uid(), name: d.name, icon: d.icon, goal: d.goal, description: d.description, checkins: {}, notes: {} })));
        setRecords(r);
        setGoals(g);
        setTheme(s.theme || "system");
      } catch {
        // Even if something unexpected goes wrong, fall through to ready
        // with whatever defaults are already in state rather than hanging.
      } finally {
        settled = true;
        clearTimeout(failsafe);
        setReady(true);
      }
    })();

    const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (mq) {
      setSystemDark(mq.matches);
      const listener = (e) => setSystemDark(e.matches);
      mq.addEventListener && mq.addEventListener("change", listener);
      return () => { mq.removeEventListener && mq.removeEventListener("change", listener); clearTimeout(failsafe); };
    }
    return () => clearTimeout(failsafe);
  }, []);

  useEffect(() => { if (ready) save("workouts", workouts); }, [workouts, ready]);
  useEffect(() => { if (ready) save("weightLogs", weightLogs); }, [weightLogs, ready]);
  useEffect(() => { if (ready) save("photos", photos); }, [photos, ready]);
  useEffect(() => { if (ready) save("habits", habits); }, [habits, ready]);
  useEffect(() => { if (ready) save("records", records); }, [records, ready]);
  useEffect(() => { if (ready) save("goals", goals); }, [goals, ready]);
  useEffect(() => { if (ready) save("settings", { theme }); }, [theme, ready]);

  const dark = theme === "dark" || (theme === "system" && systemDark);

  const streak = useMemo(() => computeStreak(workouts), [workouts]);
  const thisWeekCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return workouts.filter((w) => new Date(w.date) >= start).length;
  }, [workouts]);

  if (!ready) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? "#000" : "#F2F2F7" }}>
        <div className="spinner" />
        <Style dark={dark} />
      </div>
    );
  }

  return (
    <div className={dark ? "dark" : "light"} style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
      <Style dark={dark} />
      <div style={{ maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 90 }}>
        {tab === "home" && (
          <Home
            workouts={workouts}
            weightLogs={weightLogs}
            photos={photos}
            streak={streak}
            thisWeekCount={thisWeekCount}
            onStart={() => { setActiveWorkout(newBlankWorkout()); setTab("workouts"); }}
            goTo={setTab}
            goals={goals}
            setGoals={setGoals}
            records={records}
          />
        )}
        {tab === "workouts" && (
          <Workouts
            workouts={workouts}
            setWorkouts={setWorkouts}
            activeWorkout={activeWorkout}
            setActiveWorkout={setActiveWorkout}
            openWorkoutId={openWorkoutId}
            setOpenWorkoutId={setOpenWorkoutId}
            openExercise={openExercise}
            setOpenExercise={setOpenExercise}
          />
        )}
        {tab === "progress" && (
          <Progress weightLogs={weightLogs} setWeightLogs={setWeightLogs} photos={photos} setPhotos={setPhotos} />
        )}
        {tab === "calendar" && (
          <CalendarTab
            workouts={workouts}
            weightLogs={weightLogs}
            habits={habits}
            photos={photos}
            onOpenWorkout={(id) => { setOpenWorkoutId(id); setTab("workouts"); }}
          />
        )}
        {tab === "stats" && (
          <Stats
            workouts={workouts}
            streak={streak}
            onOpenWorkout={(id) => { setOpenWorkoutId(id); setTab("workouts"); }}
            records={records}
            setRecords={setRecords}
            openRecord={openRecord}
            setOpenRecord={setOpenRecord}
          />
        )}
        {tab === "more" && (
          <More
            theme={theme}
            setTheme={setTheme}
            workouts={workouts}
            weightLogs={weightLogs}
            photos={photos}
            habits={habits}
            setHabits={setHabits}
            openHabit={openHabit}
            setOpenHabit={setOpenHabit}
            setWorkouts={setWorkouts}
            setWeightLogs={setWeightLogs}
            setPhotos={setPhotos}
          />
        )}
      </div>
      <TabBar tab={tab} setTab={(t) => { setOpenWorkoutId(null); setOpenExercise(null); setOpenHabit(null); setOpenRecord(null); setTab(t); }} />
    </div>
  );
}

function newBlankWorkout() {
  return { id: uid(), date: todayStr(), startedAt: Date.now(), category: null, exercises: [], mood: null, energy: null, notes: "" };
}

const WORKOUT_CATEGORIES = ["Upper Body", "Lower Body", "Full Body", "Cardio", "Core", "Other"];

function computeStreak(workouts) {
  if (!workouts.length) return 0;
  const days = new Set(workouts.map((w) => w.date));
  let streak = 0;
  let d = new Date();
  if (!days.has(todayStr(d))) d.setDate(d.getDate() - 1);
  while (days.has(todayStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/* ---------------- shared UI atoms ---------------- */
function Card({ children, style, onClick }) {
  return (
    <div className="card" style={style} onClick={onClick}>
      {children}
    </div>
  );
}
function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 4px 10px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--subtext)", letterSpacing: 0.3, textTransform: "uppercase" }}>{children}</div>
      {right}
    </div>
  );
}
function BigTitle({ children, sub }) {
  return (
    <div style={{ padding: "18px 4px 6px" }}>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }}>{children}</div>
      {sub && <div style={{ fontSize: 15, color: "var(--subtext)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Pill({ children, active, onClick, color }) {
  return (
    <button
      className={"pill" + (active ? " pill-active" : "")}
      onClick={onClick}
      style={active && color ? { background: color } : undefined}
    >
      {children}
    </button>
  );
}
function Button({ children, onClick, variant = "primary", style, disabled }) {
  return (
    <button className={"btn btn-" + variant} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}
/* Uncontrolled field: owns its own DOM value so mid-typing re-renders elsewhere
   in the tree can never overwrite what's on screen. Commits each keystroke
   upstream via onCommit, but never reads back a `value` prop. */
function EField({ as, initialValue, onCommit, ...props }) {
  const Tag = as || "input";
  return (
    <Tag
      {...props}
      defaultValue={initialValue}
      onChange={(e) => onCommit && onCommit(e.target.value)}
    />
  );
}
/* iOS-style swipe-to-delete. Wrap any row's content; swipe left to reveal
   a red Delete action, tap it to commit. Drag is tracked with pointer
   events so it works with touch and mouse alike. */
function SwipeRow({ onDelete, children }) {
  const DELETE_WIDTH = 84;
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const startXRef = useRef(0);
  const baseXRef = useRef(0);
  const movedRef = useRef(false);

  const clientX = (e) => (e.touches && e.touches.length ? e.touches[0].clientX : e.clientX);

  const onDown = (e) => {
    startXRef.current = clientX(e);
    baseXRef.current = revealed ? -DELETE_WIDTH : 0;
    movedRef.current = false;
    setDragging(true);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const delta = clientX(e) - startXRef.current;
    if (Math.abs(delta) > 4) movedRef.current = true;
    let next = baseXRef.current + delta;
    next = Math.max(-DELETE_WIDTH - 16, Math.min(0, next));
    setDragX(next);
  };
  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragX < -DELETE_WIDTH / 2) {
      setDragX(-DELETE_WIDTH);
      setRevealed(true);
    } else {
      setDragX(0);
      setRevealed(false);
    }
  };
  const onCaptureClick = (e) => {
    if (movedRef.current || revealed) {
      e.stopPropagation();
      movedRef.current = false;
      if (revealed) { setDragX(0); setRevealed(false); }
    }
  };

  return (
    <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", marginBottom: 10 }}>
      <div
        onClick={onDelete}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: DELETE_WIDTH, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Delete</span>
      </div>
      <div
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={endDrag}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClickCapture={onCaptureClick}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform .2s ease",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
function BackHeader({ title, onBack, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 4px 4px" }}>
      <button className="back-btn" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 2 }}><ChevronLeft size={19} strokeWidth={2.5} />Back</button>
      <div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div>
      <div style={{ width: 56, textAlign: "right" }}>{right}</div>
    </div>
  );
}
function StarRating({ value, onChange, max = 5, icon = "●" }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          onClick={() => onChange(n)}
          style={{
            width: 34, height: 34, borderRadius: 17, display: "flex", alignItems: "center", justifyContent: "center",
            background: value >= n ? "var(--accent)" : "var(--fill)", color: value >= n ? "#fff" : "var(--subtext)",
            fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .15s",
          }}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

/* ---------------- HOME ---------------- */
function Home({ workouts, weightLogs, photos, streak, thisWeekCount, onStart, goTo, goals, setGoals, records }) {
  const [manageGoals, setManageGoals] = useState(false);
  const last = useMemo(() => [...workouts].sort((a, b) => b.startedAt - a.startedAt)[0], [workouts]);
  const lastWeight = useMemo(() => [...weightLogs].sort((a, b) => (a.date + a.time > b.date + b.time ? -1 : 1))[0], [weightLogs]);
  const lastPhoto = useMemo(() => [...photos].sort((a, b) => (a.date > b.date ? -1 : 1))[0], [photos]);
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const goalCtx = { weightLogs, thisWeekCount, records };

  if (manageGoals) {
    return <GoalsManage goals={goals} setGoals={setGoals} weightLogs={weightLogs} thisWeekCount={thisWeekCount} records={records} onBack={() => setManageGoals(false)} />;
  }

  return (
    <div style={{ padding: "0 14px" }}>
      <BigTitle sub={dateLabel}>Home</BigTitle>

      {goals.length > 0 ? (
        <>
          <SectionTitle right={<button className="link-btn" onClick={() => setManageGoals(true)}>Manage</button>}>Goals</SectionTitle>
          {goals.map((g) => {
            const current = currentGoalValue(g, goalCtx);
            const prog = goalProgress(g, current);
            return (
              <Card key={g.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 700 }}>{g.name}</div>
                  {prog && prog.reached && <div style={{ fontSize: 12, color: "var(--green)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><PartyPopper size={13} /> Reached</div>}
                </div>
                <div style={{ fontSize: 14, color: "var(--subtext)", marginTop: 2 }}>
                  {current != null ? `${current}${g.unit ? " " + g.unit : ""} now` : "No data yet"} · target {g.target}{g.unit ? " " + g.unit : ""}
                </div>
                {prog && prog.pct != null && (
                  <div style={{ marginTop: 8, height: 8, borderRadius: 4, background: "var(--fill)", overflow: "hidden" }}>
                    <div style={{ width: `${prog.pct}%`, height: "100%", background: prog.reached ? "var(--green)" : "var(--accent)" }} />
                  </div>
                )}
              </Card>
            );
          })}
        </>
      ) : (
        <Card onClick={() => setManageGoals(true)} style={{ marginTop: 14 }}>
          <div style={{ textAlign: "center", fontWeight: 600, color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Target size={16} /> Set a Goal</div>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: "hidden", marginTop: 14 }}>
        <button className="start-btn" onClick={onStart}>
          <Plus size={20} strokeWidth={2.6} /> Start Workout
        </button>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <Card>
          <div className="stat-label">Streak</div>
          <div className="stat-value"><Flame size={20} style={{ verticalAlign: "-3px" }} /> {streak}<span className="stat-unit"> day{streak === 1 ? "" : "s"}</span></div>
        </Card>
        <Card>
          <div className="stat-label">This Week</div>
          <div className="stat-value">{thisWeekCount}<span className="stat-unit"> workouts</span></div>
        </Card>
        <Card onClick={() => goTo("progress")}>
          <div className="stat-label">Current Weight</div>
          <div className="stat-value">{lastWeight ? lastWeight.weight : "—"}<span className="stat-unit">{lastWeight ? " lb" : ""}</span></div>
        </Card>
        <Card onClick={() => goTo("progress")}>
          <div className="stat-label">Last Photo</div>
          {lastPhoto ? (
            <img src={lastPhoto.dataUrl} alt="" style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 12, marginTop: 4 }} />
          ) : (
            <div className="stat-value" style={{ fontSize: 15, color: "var(--subtext)" }}>None yet</div>
          )}
        </Card>
      </div>

      <SectionTitle>Last Workout</SectionTitle>
      {last ? (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>{fmtDate(last.date)}<CategoryBadge category={last.category} /></div>
            <div style={{ color: "var(--subtext)", fontSize: 13 }}>{last.duration ? Math.round(last.duration / 60) + " min" : ""}</div>
          </div>
          <div style={{ marginTop: 6, color: "var(--subtext)", fontSize: 14 }}>
            {last.exercises.length} exercise{last.exercises.length === 1 ? "" : "s"} · {last.exercises.reduce((a, e) => a + e.sets.length, 0)} sets
          </div>
          {last.exercises.slice(0, 3).map((e) => (
            <div key={e.id} style={{ fontSize: 14, marginTop: 4 }}>• {e.name}</div>
          ))}
        </Card>
      ) : (
        <Card><div style={{ color: "var(--subtext)" }}>No workouts yet. Start your first one above.</div></Card>
      )}

      <SectionTitle>Quick Actions</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card onClick={() => goTo("progress")}><div style={{ textAlign: "center", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Scale size={16} /> Log Weight</div></Card>
        <Card onClick={() => goTo("progress")}><div style={{ textAlign: "center", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Camera size={16} /> View Progress</div></Card>
      </div>
    </div>
  );
}

/* ---------------- GOALS ---------------- */
const GOAL_TYPES = [
  { key: "weight", label: "Body Weight" },
  { key: "consistency", label: "Consistency" },
  { key: "record", label: "Linked Record" },
  { key: "custom", label: "Custom" },
];

function currentGoalValue(goal, { weightLogs, thisWeekCount, records }) {
  if (goal.type === "weight") {
    const sorted = [...weightLogs].sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
    const last = sorted[sorted.length - 1];
    const v = last ? parseFloat(last.weight) : NaN;
    return isNaN(v) ? null : v;
  }
  if (goal.type === "consistency") {
    return thisWeekCount;
  }
  if (goal.type === "record") {
    const rec = records.find((r) => r.id === goal.recordId);
    return rec ? bestOf(rec) : null;
  }
  if (goal.type === "custom") {
    const v = parseFloat(goal.manualValue);
    return isNaN(v) ? null : v;
  }
  return null;
}

function goalProgress(goal, current) {
  if (current == null) return null;
  const target = parseFloat(goal.target);
  if (isNaN(target)) return null;
  const direction = goal.type === "consistency" ? "higher" : (goal.direction || "higher");
  const reached = direction === "lower" ? current <= target : current >= target;
  let pct = null;
  if (goal.type === "consistency") {
    pct = target > 0 ? (current / target) * 100 : null;
  } else {
    const start = goal.startValue != null ? parseFloat(goal.startValue) : NaN;
    if (!isNaN(start) && start !== target) {
      pct = direction === "lower" ? ((start - current) / (start - target)) * 100 : ((current - start) / (target - start)) * 100;
    }
  }
  if (pct != null) pct = Math.max(0, Math.min(100, pct));
  return { pct, reached };
}

function GoalsManage({ goals, setGoals, weightLogs, thisWeekCount, records, onBack }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("weight");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [direction, setDirection] = useState("lower");
  const [recordId, setRecordId] = useState("");
  const ctx = { weightLogs, thisWeekCount, records };

  const addGoal = () => {
    if (!target.trim()) return;
    const draft = { type, target: target.trim(), unit: unit.trim(), direction, recordId: recordId || null, manualValue: "" };
    const start = currentGoalValue(draft, ctx);
    const typeLabel = GOAL_TYPES.find((t) => t.key === type)?.label || "Goal";
    const defaultName = type === "record" ? (records.find((r) => r.id === recordId)?.name || typeLabel) : typeLabel;
    setGoals((prev) => [...prev, { id: uid(), name: name.trim() || defaultName, type, target: target.trim(), unit: unit.trim(), direction, recordId: recordId || null, startValue: start, manualValue: "" }]);
    setShowForm(false); setName(""); setTarget(""); setUnit(""); setRecordId(""); setDirection("lower");
  };

  return (
    <div style={{ padding: "0 14px" }}>
      <BackHeader title="Goals" onBack={onBack} />
      <Card>
        {!showForm ? (
          <button className="link-btn" onClick={() => setShowForm(true)}>+ New Goal</button>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {GOAL_TYPES.map((t) => <Pill key={t.key} active={type === t.key} onClick={() => setType(t.key)}>{t.label}</Pill>)}
            </div>
            <EField className="input" placeholder="Goal name (optional)" initialValue={name} onCommit={setName} style={{ width: "100%", marginTop: 8 }} />
            {type === "record" && (
              <select className="input" value={recordId} onChange={(e) => setRecordId(e.target.value)} style={{ width: "100%", marginTop: 8 }}>
                <option value="">Choose a record</option>
                {records.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <EField className="input" type="text" placeholder="Target" autoComplete="off" initialValue={target} onCommit={setTarget} style={{ flex: 1 }} />
              <EField className="input" placeholder="Unit" initialValue={unit} onCommit={setUnit} style={{ width: 90 }} />
            </div>
            {type !== "consistency" && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <Pill active={direction === "lower"} onClick={() => setDirection("lower")}>Lower is better</Pill>
                <Pill active={direction === "higher"} onClick={() => setDirection("higher")}>Higher is better</Pill>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={addGoal}>Add Goal</Button>
            </div>
          </div>
        )}
      </Card>

      <SectionTitle>Your Goals</SectionTitle>
      {goals.map((g) => {
        const current = currentGoalValue(g, ctx);
        const prog = goalProgress(g, current);
        return (
          <Card key={g.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>{g.name}</div>
              <button className="icon-btn" onClick={() => setGoals((prev) => prev.filter((x) => x.id !== g.id))}><X size={14} /></button>
            </div>
            <div style={{ fontSize: 13, color: "var(--subtext)", marginTop: 4 }}>
              {current != null ? `${current}${g.unit ? " " + g.unit : ""}` : "—"} → {g.target}{g.unit ? " " + g.unit : ""}
            </div>
            {g.type === "custom" && (
              <EField className="input" type="text" placeholder="Update current value" autoComplete="off" initialValue={g.manualValue} onCommit={(v) => setGoals((prev) => prev.map((x) => x.id === g.id ? { ...x, manualValue: v } : x))} style={{ width: "100%", marginTop: 8 }} />
            )}
            {prog && prog.pct != null && (
              <div style={{ marginTop: 8, height: 8, borderRadius: 4, background: "var(--fill)", overflow: "hidden" }}>
                <div style={{ width: `${prog.pct}%`, height: "100%", background: prog.reached ? "var(--green)" : "var(--accent)" }} />
              </div>
            )}
          </Card>
        );
      })}
      {!goals.length && <Card><div style={{ color: "var(--subtext)" }}>No goals yet.</div></Card>}
    </div>
  );
}

/* ---------------- WORKOUTS ---------------- */
function Workouts({ workouts, setWorkouts, activeWorkout, setActiveWorkout, openWorkoutId, setOpenWorkoutId, openExercise, setOpenExercise }) {
  const [subTab, setSubTab] = useState("history");
  const [categoryFilter, setCategoryFilter] = useState(null);

  const exerciseNames = useMemo(() => {
    const set = new Map();
    workouts.forEach((w) => w.exercises.forEach((e) => set.set(e.name.trim().toLowerCase(), e.name.trim())));
    return Array.from(set.values()).sort();
  }, [workouts]);

  const activeCategories = useMemo(
    () => WORKOUT_CATEGORIES.filter((c) => workouts.some((w) => w.category === c)),
    [workouts]
  );

  const sortedHistory = useMemo(
    () => [...workouts]
      .filter((w) => !categoryFilter || w.category === categoryFilter)
      .sort((a, b) => b.startedAt - a.startedAt),
    [workouts, categoryFilter]
  );

  useEffect(() => {
    if (openWorkoutId && !workouts.find((x) => x.id === openWorkoutId)) {
      setOpenWorkoutId(null);
    }
  }, [openWorkoutId, workouts, setOpenWorkoutId]);

  if (activeWorkout) {
    return (
      <ActiveWorkoutFlow
        workout={activeWorkout}
        setWorkout={setActiveWorkout}
        library={exerciseNames}
        onFinish={(w) => {
          setWorkouts((prev) => [...prev, w]);
          setActiveWorkout(null);
        }}
        onCancel={() => setActiveWorkout(null)}
      />
    );
  }

  if (openWorkoutId) {
    const w = workouts.find((x) => x.id === openWorkoutId);
    if (!w) return null;
    return (
      <WorkoutDetail
        workout={w}
        onBack={() => setOpenWorkoutId(null)}
        onOpenExercise={(name) => setOpenExercise(name)}
        onDelete={() => {
          setWorkouts((prev) => prev.filter((x) => x.id !== w.id));
          setOpenWorkoutId(null);
        }}
      />
    );
  }

  if (openExercise) {
    return <ExerciseHistory name={openExercise} workouts={workouts} onBack={() => setOpenExercise(null)} />;
  }

  return (
    <div style={{ padding: "0 14px" }}>
      <BigTitle>Workouts</BigTitle>
      <Card style={{ padding: 0, marginBottom: 14 }}>
        <button className="start-btn" onClick={() => setActiveWorkout(newBlankWorkout())}>
          <Plus size={20} strokeWidth={2.6} /> Start Workout
        </button>
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        <Pill active={subTab === "history"} onClick={() => setSubTab("history")}>History</Pill>
        <Pill active={subTab === "exercises"} onClick={() => setSubTab("exercises")}>Exercises</Pill>
      </div>

      {subTab === "history" && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <Pill active={categoryFilter === null} onClick={() => setCategoryFilter(null)}>All</Pill>
            {activeCategories.map((c) => (
              <Pill key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(categoryFilter === c ? null : c)} color={categoryColor(c)}>{c}</Pill>
            ))}
          </div>
          {sortedHistory.map((w) => (
            <Card key={w.id} onClick={() => setOpenWorkoutId(w.id)} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{fmtDate(w.date)}<CategoryBadge category={w.category} /></div>
                <div style={{ color: "var(--subtext)", fontSize: 13 }}>{w.duration ? Math.round(w.duration / 60) + " min" : ""}</div>
              </div>
              <div style={{ color: "var(--subtext)", fontSize: 14, marginTop: 4 }}>
                {w.exercises.length} exercises · {w.exercises.reduce((a, e) => a + e.sets.length, 0)} sets
              </div>
            </Card>
          ))}
          {!workouts.length && <Card><div style={{ color: "var(--subtext)" }}>No workout history yet.</div></Card>}
        </div>
      )}

      {subTab === "exercises" && (
        <div style={{ marginTop: 12 }}>
          {exerciseNames.map((n) => (
            <Card key={n} onClick={() => setOpenExercise(n)} style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>{n}</div>
              <ChevronRight size={16} style={{ color: "var(--subtext)" }} />
            </Card>
          ))}
          {!exerciseNames.length && <Card><div style={{ color: "var(--subtext)" }}>No exercises logged yet.</div></Card>}
        </div>
      )}
    </div>
  );
}

function ActiveWorkoutFlow({ workout, setWorkout, library, onFinish, onCancel }) {
  const [showFinish, setShowFinish] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const addExercise = () => {
    setWorkout({ ...workout, exercises: [...workout.exercises, { id: uid(), name: "", equipment: "", sets: [{ id: uid(), weight: "", reps: "" }], notes: "" }] });
  };
  const addExerciseFromLibrary = (name) => {
    setWorkout({ ...workout, exercises: [...workout.exercises, { id: uid(), name, equipment: "", sets: [{ id: uid(), weight: "", reps: "" }], notes: "" }] });
    setShowLibrary(false);
  };
  const updateExercise = (id, patch) => {
    setWorkout({ ...workout, exercises: workout.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  };
  const removeExercise = (id) => setWorkout({ ...workout, exercises: workout.exercises.filter((e) => e.id !== id) });

  if (showFinish) {
    return (
      <div style={{ padding: "0 14px" }}>
        <BackHeader title="Finish Workout" onBack={() => setShowFinish(false)} />
        <SectionTitle>Mood</SectionTitle>
        <Card><StarRating value={workout.mood} onChange={(v) => setWorkout({ ...workout, mood: v })} /></Card>
        <SectionTitle>Energy</SectionTitle>
        <Card><StarRating value={workout.energy} onChange={(v) => setWorkout({ ...workout, energy: v })} /></Card>
        <SectionTitle>Notes</SectionTitle>
        <Card>
          <EField
            as="textarea"
            className="input"
            placeholder="How did it feel?"
            initialValue={workout.notes}
            onCommit={(v) => setWorkout({ ...workout, notes: v })}
            style={{ width: "100%", minHeight: 80, border: "none", resize: "none" }}
          />
        </Card>
        <div style={{ marginTop: 20 }}>
          <Button
            onClick={() => {
              const duration = Math.floor((Date.now() - workout.startedAt) / 1000);
              const cleaned = { ...workout, exercises: workout.exercises.filter((e) => e.name.trim()), duration };
              onFinish(cleaned);
            }}
          >
            Save Workout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 4px 4px" }}>
        <button className="back-btn" onClick={onCancel}>Cancel</button>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Workout</div>
        <button className="back-btn" style={{ color: "var(--accent)", fontWeight: 700 }} onClick={() => setShowFinish(true)}>Finish</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {WORKOUT_CATEGORIES.map((c) => (
          <Pill key={c} active={workout.category === c} onClick={() => setWorkout({ ...workout, category: workout.category === c ? null : c })} color={categoryColor(c)}>{c}</Pill>
        ))}
      </div>

      {workout.exercises.map((ex, i) => (
        <Card key={ex.id} style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <EField
              className="input"
              placeholder={`Exercise ${i + 1} name`}
              initialValue={ex.name}
              onCommit={(v) => updateExercise(ex.id, { name: v })}
              style={{ flex: 1, fontWeight: 700, fontSize: 16 }}
            />
            <button className="icon-btn" onClick={() => removeExercise(ex.id)}><X size={14} /></button>
          </div>
          <EField
            className="input"
            placeholder="Machine / equipment (optional)"
            initialValue={ex.equipment || ""}
            onCommit={(v) => updateExercise(ex.id, { equipment: v })}
            style={{ width: "100%", marginTop: 8, fontSize: 13 }}
          />
          {ex.sets.map((s, si) => (
            <div key={s.id || si} style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <div style={{ width: 28, fontSize: 13, color: "var(--subtext)" }}>#{si + 1}</div>
              <EField
                className="input small"
                type="text"
                placeholder="lb"
                autoComplete="off"
                initialValue={s.weight}
                onCommit={(v) => {
                  const sets = ex.sets.map((x, xi) => (xi === si ? { ...x, weight: v } : x));
                  updateExercise(ex.id, { sets });
                }}
              />
              <EField
                className="input small"
                type="text"
                placeholder="reps"
                autoComplete="off"
                initialValue={s.reps}
                onCommit={(v) => {
                  const sets = ex.sets.map((x, xi) => (xi === si ? { ...x, reps: v } : x));
                  updateExercise(ex.id, { sets });
                }}
              />
              <button
                className="icon-btn"
                onClick={() => updateExercise(ex.id, { sets: ex.sets.filter((_, xi) => xi !== si) })}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button className="link-btn" onClick={() => updateExercise(ex.id, { sets: [...ex.sets, { id: uid(), weight: "", reps: "" }] })}>
            + Add Set
          </button>
          <EField
            as="textarea"
            className="input"
            placeholder="Notes"
            initialValue={ex.notes}
            onCommit={(v) => updateExercise(ex.id, { notes: v })}
            style={{ width: "100%", marginTop: 8, minHeight: 40, fontSize: 14 }}
          />
        </Card>
      ))}

      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={addExercise} style={{ flex: 1 }}>+ Add Exercise</Button>
          {library && library.length > 0 && (
            <Button variant="secondary" onClick={() => setShowLibrary((s) => !s)} style={{ flex: 1 }}><BookOpen size={15} /> From Library</Button>
          )}
        </div>
        {showLibrary && (
          <Card style={{ marginTop: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {library.map((n) => (
                <Pill key={n} onClick={() => addExerciseFromLibrary(n)}>{n}</Pill>
              ))}
            </div>
          </Card>
        )}
      </div>
      <div style={{ marginBottom: 20 }} />
    </div>
  );
}

function WorkoutDetail({ workout, onBack, onOpenExercise, onDelete }) {
  return (
    <div style={{ padding: "0 14px" }}>
      <BackHeader title={fmtDate(workout.date)} onBack={onBack} right={<button className="icon-btn" onClick={onDelete}><Trash2 size={16} /></button>} />
      {workout.category && <div style={{ padding: "0 4px 6px" }}><Pill active color={categoryColor(workout.category)}>{workout.category}</Pill></div>}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div className="stat-label">Duration</div>
            <div style={{ fontWeight: 700 }}>{workout.duration ? Math.round(workout.duration / 60) + " min" : "—"}</div>
          </div>
          <div>
            <div className="stat-label">Mood</div>
            <div style={{ fontWeight: 700 }}>{workout.mood ? "●".repeat(workout.mood) : "—"}</div>
          </div>
          <div>
            <div className="stat-label">Energy</div>
            <div style={{ fontWeight: 700 }}>{workout.energy ? "●".repeat(workout.energy) : "—"}</div>
          </div>
        </div>
        {workout.notes && <div style={{ marginTop: 10, fontSize: 14, color: "var(--subtext)" }}>{workout.notes}</div>}
      </Card>

      {workout.exercises.map((ex) => (
        <Card key={ex.id} onClick={() => onOpenExercise(ex.name)} style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700 }}>{ex.name}</div>
          {ex.equipment && <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}><Dumbbell size={13} /> {ex.equipment}</div>}
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ex.sets.map((s, i) => (
              <span key={i} className="setchip">{s.weight || 0} lb × {s.reps || 0}</span>
            ))}
          </div>
          {ex.notes && <div style={{ marginTop: 6, fontSize: 13, color: "var(--subtext)" }}>{ex.notes}</div>}
        </Card>
      ))}
    </div>
  );
}

function ExerciseHistory({ name, workouts, onBack }) {
  const instances = useMemo(() => {
    const list = [];
    workouts.forEach((w) => {
      w.exercises.forEach((e) => {
        if (e.name.trim().toLowerCase() === name.trim().toLowerCase()) {
          list.push({ date: w.date, startedAt: w.startedAt, sets: e.sets, notes: e.notes, equipment: e.equipment });
        }
      });
    });
    return list.sort((a, b) => b.startedAt - a.startedAt);
  }, [workouts, name]);

  const last = instances[0];
  const pr = instances.reduce((max, inst) => {
    inst.sets.forEach((s) => { const w = parseFloat(s.weight) || 0; if (w > max) max = w; });
    return max;
  }, 0);
  const lastEquipment = instances.find((inst) => inst.equipment)?.equipment;
  const graphData = [...instances].reverse().map((inst) => ({
    date: inst.date,
    value: inst.sets.reduce((m, s) => Math.max(m, parseFloat(s.weight) || 0), 0),
  }));

  return (
    <div style={{ padding: "0 14px" }}>
      <BackHeader title={name} onBack={onBack} />
      {lastEquipment && <div style={{ padding: "0 4px 6px", fontSize: 13, color: "var(--accent)", display: "flex", alignItems: "center", gap: 5 }}><Dumbbell size={14} /> {lastEquipment}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card>
          <div className="stat-label">Last Used</div>
          <div style={{ fontWeight: 700 }}>{last ? (last.sets[last.sets.length - 1]?.weight || 0) + " lb × " + (last.sets[last.sets.length - 1]?.reps || 0) : "—"}</div>
        </Card>
        <Card>
          <div className="stat-label">Personal Record</div>
          <div style={{ fontWeight: 700 }}>{pr} lb</div>
        </Card>
        <Card>
          <div className="stat-label">Times Performed</div>
          <div style={{ fontWeight: 700 }}>{instances.length}</div>
        </Card>
        <Card>
          <div className="stat-label">Last Session</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{last ? fmtDateShort(last.date) : "—"}</div>
        </Card>
      </div>

      <SectionTitle>Progress</SectionTitle>
      <Card><LineGraph data={graphData} /></Card>

      <SectionTitle>History</SectionTitle>
      {instances.map((inst, i) => (
        <Card key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{fmtDate(inst.date)}</div>
          {inst.equipment && <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}><Dumbbell size={13} /> {inst.equipment}</div>}
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {inst.sets.map((s, si) => <span key={si} className="setchip">{s.weight || 0} lb × {s.reps || 0}</span>)}
          </div>
        </Card>
      ))}
    </div>
  );
}

function LineGraph({ data, height = 140, unit = "", showValues = false }) {
  if (!data.length) return <div style={{ color: "var(--subtext)", padding: 20, textAlign: "center" }}>Not enough data yet</div>;
  const vals = data.map((d) => d.value);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const w = 300;
  const topPad = showValues ? 28 : 20;
  const pts = data.map((d, i) => {
    const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
    const y = height - 20 - ((d.value - min) / (range || 1)) * (height - 20 - topPad);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height}>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="var(--accent)" />)}
      {showValues && pts.map((p, i) => {
        const above = i % 2 === 0;
        const ly = above ? Math.max(9, p[1] - 8) : Math.min(height - 4, p[1] + 15);
        return (
          <text key={"v" + i} x={p[0]} y={ly} fontSize="9" fill="var(--text)" textAnchor="middle">
            ({data[i].value})
          </text>
        );
      })}
      <text x="4" y="14" fontSize="11" fill="var(--subtext)">{max}{unit}</text>
      <text x="4" y={height - 6} fontSize="11" fill="var(--subtext)">{min}{unit}</text>
    </svg>
  );
}

/* ---------------- PROGRESS ---------------- */
function Progress({ weightLogs, setWeightLogs, photos, setPhotos }) {
  const [subTab, setSubTab] = useState("weight");
  return (
    <div style={{ padding: "0 14px" }}>
      <BigTitle>Progress</BigTitle>
      <div style={{ display: "flex", gap: 8 }}>
        <Pill active={subTab === "weight"} onClick={() => setSubTab("weight")}>Weight</Pill>
        <Pill active={subTab === "photos"} onClick={() => setSubTab("photos")}>Photos</Pill>
      </div>
      {subTab === "weight" ? <WeightTracking weightLogs={weightLogs} setWeightLogs={setWeightLogs} /> : <ProgressPhotos photos={photos} setPhotos={setPhotos} />}
    </div>
  );
}

function WeightTracking({ weightLogs, setWeightLogs }) {
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState("");
  const [tag, setTag] = useState("");
  const sorted = useMemo(() => [...weightLogs].sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1)), [weightLogs]);
  const vals = weightLogs.map((w) => parseFloat(w.weight)).filter((n) => !isNaN(n));
  const highest = vals.length ? Math.max(...vals) : null;
  const lowest = vals.length ? Math.min(...vals) : null;
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;

  const weekTrend = useMemo(() => {
    if (sorted.length < 2) return null;
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const recent = sorted.filter((w) => new Date(w.date).getTime() >= weekAgo);
    if (recent.length < 2) return null;
    const diff = parseFloat(recent[recent.length - 1].weight) - parseFloat(recent[0].weight);
    return diff;
  }, [sorted]);

  const submit = () => {
    if (!weight) return;
    const now = new Date();
    setWeightLogs((prev) => [...prev, { id: uid(), weight, date: todayStr(now), time: now.toTimeString().slice(0, 5), tag }]);
    setWeight(""); setTag(""); setShowForm(false);
  };

  return (
    <div>
      <SectionTitle right={<button className="link-btn" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ Log Weight"}</button>}>Log</SectionTitle>
      {showForm && (
        <Card>
          <EField
            className="input"
            type="text"
            placeholder="Weight (lb)"
            autoComplete="off"
            initialValue={weight}
            onCommit={(v) => setWeight(v)}
            style={{ fontSize: 17, fontWeight: 700 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {["Weekly Check-in", "Morning", "Evening", "After Workout"].map((t) => (
              <Pill key={t} active={tag === t} onClick={() => setTag(tag === t ? "" : t)}>{t}</Pill>
            ))}
          </div>
          <div style={{ marginTop: 12 }}><Button onClick={submit}>Save Entry</Button></div>
        </Card>
      )}

      <SectionTitle>Trend</SectionTitle>
      <Card><LineGraph data={sorted.map((w) => ({ date: w.date, value: parseFloat(w.weight) || 0 }))} unit=" lb" showValues /></Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
        <Card><div className="stat-label">Highest</div><div style={{ fontWeight: 700 }}>{highest ?? "—"}</div></Card>
        <Card><div className="stat-label">Lowest</div><div style={{ fontWeight: 700 }}>{lowest ?? "—"}</div></Card>
        <Card><div className="stat-label">Average</div><div style={{ fontWeight: 700 }}>{avg ?? "—"}</div></Card>
      </div>
      {weekTrend !== null && (
        <Card style={{ marginTop: 10 }}>
          <div className="stat-label">7-Day Trend</div>
          <div style={{ fontWeight: 700, color: weekTrend > 0 ? "var(--red)" : weekTrend < 0 ? "var(--green)" : "var(--text)" }}>
            {weekTrend > 0 ? "+" : ""}{weekTrend.toFixed(1)} lb
          </div>
        </Card>
      )}

      <SectionTitle>Entries</SectionTitle>
      {[...sorted].reverse().map((w) => (
        <Card key={w.id} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700 }}>{w.weight} lb</div>
            <div style={{ fontSize: 12, color: "var(--subtext)" }}>{fmtDateShort(w.date)} · {w.time}{w.tag ? " · " + w.tag : ""}</div>
          </div>
          <button className="icon-btn" onClick={() => setWeightLogs((prev) => prev.filter((x) => x.id !== w.id))}><X size={14} /></button>
        </Card>
      ))}
      {!weightLogs.length && <Card><div style={{ color: "var(--subtext)" }}>No entries yet.</div></Card>}
    </div>
  );
}

function resizeImage(file, maxW = 480, mirror = false) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (mirror) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    reader.readAsDataURL(file);
  });
}

function ProgressPhotos({ photos, setPhotos }) {
  const fileRef = useRef(null);
  const [category, setCategory] = useState("Front");
  const [frontCamera, setFrontCamera] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [dateA, setDateA] = useState(null);
  const [dateB, setDateB] = useState(null);
  const [slider, setSlider] = useState(50);

  const grouped = useMemo(() => {
    const map = {};
    [...photos].sort((a, b) => (a.date < b.date ? 1 : -1)).forEach((p) => {
      if (!map[p.date]) map[p.date] = [];
      map[p.date].push(p);
    });
    return map;
  }, [photos]);

  const dates = Object.keys(grouped);

  const onPick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await resizeImage(file, 480, frontCamera);
    setPhotos((prev) => [...prev, { id: uid(), date: todayStr(), category, dataUrl }]);
    e.target.value = "";
  };

  if (compareMode) {
    const photoA = dateA ? (grouped[dateA] || []).find((p) => p.category === category) || (grouped[dateA] || [])[0] : null;
    const photoB = dateB ? (grouped[dateB] || []).find((p) => p.category === category) || (grouped[dateB] || [])[0] : null;
    return (
      <div>
        <BackHeader title="Compare" onBack={() => setCompareMode(false)} />
        <div style={{ display: "flex", gap: 8 }}>
          {["Front", "Side", "Back"].map((c) => <Pill key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Pill>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <select className="input" value={dateA || ""} onChange={(e) => setDateA(e.target.value)}>
            <option value="">Date A</option>
            {dates.map((d) => <option key={d} value={d}>{fmtDateShort(d)}</option>)}
          </select>
          <select className="input" value={dateB || ""} onChange={(e) => setDateB(e.target.value)}>
            <option value="">Date B</option>
            {dates.map((d) => <option key={d} value={d}>{fmtDateShort(d)}</option>)}
          </select>
        </div>
        {photoA && photoB ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ position: "relative", width: "100%", paddingTop: "125%", borderRadius: 16, overflow: "hidden", background: "#000" }}>
              <img src={photoB.dataUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, width: `${slider}%`, overflow: "hidden" }}>
                <img src={photoA.dataUrl} alt="" style={{ width: `${100 / (slider / 100)}%`, height: "100%", objectFit: "cover", maxWidth: "none" }} />
              </div>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${slider}%`, width: 3, background: "#fff", transform: "translateX(-1.5px)" }} />
            </div>
            <input type="range" min="0" max="100" value={slider} onChange={(e) => setSlider(+e.target.value)} style={{ width: "100%", marginTop: 10 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--subtext)" }}>
              <span>{fmtDateShort(dateA)}</span><span>{fmtDateShort(dateB)}</span>
            </div>
          </div>
        ) : (
          <Card style={{ marginTop: 14 }}><div style={{ color: "var(--subtext)" }}>Pick two dates with photos to compare.</div></Card>
        )}
      </div>
    );
  }

  return (
    <div>
      <SectionTitle right={<button className="link-btn" onClick={() => setCompareMode(true)}>Compare</button>}>Capture</SectionTitle>
      <div style={{ display: "flex", gap: 8 }}>
        {["Front", "Side", "Back"].map((c) => <Pill key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Pill>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Pill active={!frontCamera} onClick={() => setFrontCamera(false)}>Back Camera</Pill>
        <Pill active={frontCamera} onClick={() => setFrontCamera(true)}>Front Camera</Pill>
      </div>
      <Card style={{ padding: 0, marginTop: 10 }}>
        <button className="start-btn" onClick={() => fileRef.current?.click()}><Camera size={18} /> Take Photo — {category}</button>
        <input ref={fileRef} type="file" accept="image/*" capture={frontCamera ? "user" : "environment"} style={{ display: "none" }} onChange={onPick} />
      </Card>

      <SectionTitle>Timeline</SectionTitle>
      {dates.map((d) => (
        <div key={d} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--subtext)", marginBottom: 6 }}>{fmtDate(d)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {grouped[d].map((p) => (
              <div key={p.id} style={{ position: "relative" }}>
                <img src={p.dataUrl} alt="" style={{ width: 84, height: 105, objectFit: "cover", borderRadius: 12 }} />
                <div style={{ position: "absolute", bottom: 4, left: 4, fontSize: 10, background: "rgba(0,0,0,0.55)", color: "#fff", padding: "1px 6px", borderRadius: 8 }}>{p.category}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!dates.length && <Card><div style={{ color: "var(--subtext)" }}>No progress photos yet.</div></Card>}
    </div>
  );
}

/* ---------------- STATS ---------------- */
function Stats({ workouts, streak, onOpenWorkout, records, setRecords, openRecord, setOpenRecord }) {
  const [showRecords, setShowRecords] = useState(false);

  const totalWorkouts = workouts.length;
  const totalSets = workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.length, 0), 0);
  const totalReps = workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.reduce((c, s) => c + (parseFloat(s.reps) || 0), 0), 0), 0);
  const totalWeight = workouts.reduce(
    (a, w) => a + w.exercises.reduce((b, e) => b + e.sets.reduce((c, s) => c + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0), 0), 0),
    0
  );

  const freq = {};
  const prs = {};
  workouts.forEach((w) => w.exercises.forEach((e) => {
    const key = e.name.trim();
    if (!key) return;
    freq[key] = (freq[key] || 0) + 1;
    const maxW = e.sets.reduce((m, s) => Math.max(m, parseFloat(s.weight) || 0), 0);
    prs[key] = Math.max(prs[key] || 0, maxW);
  }));
  const favorites = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const strengthPRs = Object.entries(prs).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (openRecord) {
    const rec = records.find((r) => r.id === openRecord);
    return <RecordDetail record={rec} setRecords={setRecords} onBack={() => setOpenRecord(null)} />;
  }

  if (showRecords) {
    return <RecordsList records={records} setRecords={setRecords} onBack={() => setShowRecords(false)} onOpen={setOpenRecord} />;
  }

  return (
    <div style={{ padding: "0 14px" }}>
      <BigTitle>Stats</BigTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card><div className="stat-label">Total Workouts</div><div className="stat-value">{totalWorkouts}</div></Card>
        <Card><div className="stat-label">Streak</div><div className="stat-value" style={{ display: "flex", alignItems: "center", gap: 6 }}><Flame size={20} /> {streak}</div></Card>
        <Card><div className="stat-label">Total Sets</div><div className="stat-value">{totalSets}</div></Card>
        <Card><div className="stat-label">Total Reps</div><div className="stat-value">{totalReps}</div></Card>
        <Card style={{ gridColumn: "1 / span 2" }}><div className="stat-label">Total Weight Lifted</div><div className="stat-value">{totalWeight.toLocaleString()} <span className="stat-unit">lb</span></div></Card>
      </div>

      <SectionTitle>Favorite Exercises</SectionTitle>
      <Card>
        {favorites.length ? favorites.map(([name, count]) => (
          <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span>{name}</span><span style={{ color: "var(--subtext)" }}>{count}×</span>
          </div>
        )) : <div style={{ color: "var(--subtext)" }}>No data yet</div>}
      </Card>

      <SectionTitle>Strength PRs</SectionTitle>
      <Card>
        {strengthPRs.length ? strengthPRs.map(([name, w]) => (
          <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span>{name}</span><span style={{ color: "var(--accent)", fontWeight: 700 }}>{w} lb</span>
          </div>
        )) : <div style={{ color: "var(--subtext)" }}>No data yet</div>}
      </Card>

      <SectionTitle right={<button className="link-btn" onClick={() => setShowRecords(true)}>Manage</button>}>Custom Records</SectionTitle>
      <Card>
        {records.length ? records.slice(0, 6).map((r) => {
          const best = bestOf(r);
          return (
            <div key={r.id} onClick={() => setOpenRecord(r.id)} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", cursor: "pointer" }}>
              <span>{r.name}</span>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>{best !== null ? `${best}${r.unit ? " " + r.unit : ""}` : "—"}</span>
            </div>
          );
        }) : <div style={{ color: "var(--subtext)" }}>Track plank holds, mile times, or anything else — tap Manage to add one.</div>}
      </Card>

      <SectionTitle>Calendar</SectionTitle>
      <Card><WorkoutCalendar workouts={workouts} onOpenWorkout={onOpenWorkout} /></Card>
    </div>
  );
}

function bestOf(record) {
  const vals = record.entries.map((e) => parseFloat(e.value)).filter((n) => !isNaN(n));
  if (!vals.length) return null;
  return record.direction === "lower" ? Math.min(...vals) : Math.max(...vals);
}

function RecordsList({ records, setRecords, onBack, onOpen }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [direction, setDirection] = useState("higher");

  const addRecord = () => {
    if (!name.trim()) return;
    setRecords((prev) => [...prev, { id: uid(), name: name.trim(), unit: unit.trim(), direction, entries: [] }]);
    setName(""); setUnit(""); setDirection("higher"); setShowForm(false);
  };

  return (
    <div style={{ padding: "0 14px" }}>
      <BackHeader title="Records" onBack={onBack} />
      <Card>
        {!showForm ? (
          <button className="link-btn" onClick={() => setShowForm(true)}>+ New Record</button>
        ) : (
          <div>
            <EField className="input" placeholder="Record name (e.g. Plank Hold)" initialValue={name} onCommit={setName} style={{ width: "100%", fontWeight: 700 }} />
            <EField className="input" placeholder="Unit (e.g. sec, min, miles, lb)" initialValue={unit} onCommit={setUnit} style={{ width: "100%", marginTop: 8 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <Pill active={direction === "higher"} onClick={() => setDirection("higher")}>Higher is better</Pill>
              <Pill active={direction === "lower"} onClick={() => setDirection("lower")}>Lower is better</Pill>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={addRecord}>Add Record</Button>
            </div>
          </div>
        )}
      </Card>
      <SectionTitle>Your Records</SectionTitle>
      {records.map((r) => {
        const best = bestOf(r);
        return (
          <Card key={r.id} onClick={() => onOpen(r.id)} style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{r.name}</div>
              <div style={{ fontSize: 12, color: "var(--subtext)" }}>{r.entries.length} log{r.entries.length === 1 ? "" : "s"} · {r.direction === "lower" ? "lower is better" : "higher is better"}</div>
            </div>
            <div style={{ fontWeight: 700, color: "var(--accent)" }}>{best !== null ? `${best}${r.unit ? " " + r.unit : ""}` : "—"}</div>
          </Card>
        );
      })}
      {!records.length && <Card><div style={{ color: "var(--subtext)" }}>No records yet.</div></Card>}
    </div>
  );
}

function RecordDetail({ record, setRecords, onBack }) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!record) onBack();
  }, [record, onBack]);

  if (!record) return null;

  const sorted = [...record.entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const best = bestOf(record);

  const addEntry = () => {
    if (!value.trim()) return;
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, entries: [...r.entries, { id: uid(), value: value.trim(), date: todayStr(), notes: notes.trim() }] } : r));
    setValue(""); setNotes("");
  };

  const deleteRecord = () => {
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
    onBack();
  };

  const removeEntry = (id) => {
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, entries: r.entries.filter((x) => x.id !== id) } : r));
  };

  const graphData = sorted.map((e) => ({ date: e.date, value: parseFloat(e.value) || 0 }));

  return (
    <div style={{ padding: "0 14px" }}>
      <BackHeader title={record.name} onBack={onBack} right={<button className="icon-btn" onClick={deleteRecord}><Trash2 size={16} /></button>} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card><div className="stat-label">Best</div><div className="stat-value">{best !== null ? best : "—"}<span className="stat-unit">{record.unit ? " " + record.unit : ""}</span></div></Card>
        <Card><div className="stat-label">Logs</div><div className="stat-value">{record.entries.length}</div></Card>
      </div>

      <SectionTitle>Log New Attempt</SectionTitle>
      <Card>
        <EField className="input" type="text" placeholder={`Value${record.unit ? " (" + record.unit + ")" : ""}`} autoComplete="off" initialValue={value} onCommit={setValue} style={{ width: "100%", fontWeight: 700 }} />
        <EField as="textarea" className="input" placeholder="Notes (optional)" initialValue={notes} onCommit={setNotes} style={{ width: "100%", marginTop: 8, minHeight: 40 }} />
        <div style={{ marginTop: 10 }}><Button onClick={addEntry}>Log Attempt</Button></div>
      </Card>

      <SectionTitle>Progress</SectionTitle>
      <Card><LineGraph data={graphData} unit={record.unit ? " " + record.unit : ""} /></Card>

      <SectionTitle>History</SectionTitle>
      {[...sorted].reverse().map((e) => (
        <Card key={e.id} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700 }}>{e.value}{record.unit ? " " + record.unit : ""}</div>
            <div style={{ fontSize: 12, color: "var(--subtext)" }}>{fmtDateShort(e.date)}{e.notes ? " · " + e.notes : ""}</div>
          </div>
          <button className="icon-btn" onClick={() => removeEntry(e.id)}><X size={14} /></button>
        </Card>
      ))}
      {!sorted.length && <Card><div style={{ color: "var(--subtext)" }}>No attempts logged yet.</div></Card>}
    </div>
  );
}

/* ---------------- CALENDAR TAB ---------------- */
function CalendarTab({ workouts, weightLogs, habits, photos, onOpenWorkout }) {
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const byDate = useMemo(() => {
    const workoutsByDate = {};
    workouts.forEach((w) => {
      if (!workoutsByDate[w.date]) workoutsByDate[w.date] = [];
      workoutsByDate[w.date].push(w);
    });
    const weightsByDate = {};
    weightLogs.forEach((w) => {
      if (!weightsByDate[w.date]) weightsByDate[w.date] = [];
      weightsByDate[w.date].push(w);
    });
    const photosByDate = {};
    photos.forEach((p) => {
      if (!photosByDate[p.date]) photosByDate[p.date] = [];
      photosByDate[p.date].push(p);
    });
    const habitsByDate = {};
    habits.forEach((h) => {
      Object.keys(h.checkins).forEach((d) => {
        if (h.checkins[d]) {
          if (!habitsByDate[d]) habitsByDate[d] = [];
          habitsByDate[d].push(h);
        }
      });
    });
    return { workoutsByDate, weightsByDate, photosByDate, habitsByDate };
  }, [workouts, weightLogs, photos, habits]);

  const dayInfo = (iso) => ({
    dayWorkouts: byDate.workoutsByDate[iso] || [],
    dayWeights: byDate.weightsByDate[iso] || [],
    dayPhotos: byDate.photosByDate[iso] || [],
    dayHabits: byDate.habitsByDate[iso] || [],
  });

  const hasActivity = (iso) => {
    const info = dayInfo(iso);
    return info.dayWorkouts.length || info.dayWeights.length || info.dayPhotos.length || info.dayHabits.length;
  };

  const selInfo = selectedDate ? dayInfo(selectedDate) : null;
  const todayIso = todayStr();

  return (
    <div style={{ padding: "0 14px" }}>
      <BigTitle>Calendar</BigTitle>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button className="icon-btn" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
          <div style={{ fontWeight: 700 }}>{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
          <button className="icon-btn" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, fontSize: 11, color: "var(--subtext)", textAlign: "center", marginBottom: 4 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const active = hasActivity(iso);
            const isSelected = iso === selectedDate;
            const isToday = iso === todayIso;
            return (
              <div
                key={i}
                onClick={() => setSelectedDate(iso)}
                style={{
                  aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, fontSize: 13, cursor: "pointer",
                  background: isSelected ? "var(--accent)" : active ? "var(--fill)" : "transparent",
                  color: isSelected ? "#fff" : "var(--text)",
                  fontWeight: active || isSelected ? 700 : 400,
                  border: isToday && !isSelected ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                }}
              >
                {d}
              </div>
            );
          })}
        </div>
      </Card>

      {selInfo && (
        <>
          <SectionTitle>{fmtDate(selectedDate)}</SectionTitle>

          {selInfo.dayWorkouts.length > 0 && (
            <Card style={{ marginBottom: 10 }}>
              <div className="stat-label">Workouts</div>
              {selInfo.dayWorkouts.map((w) => (
                <div key={w.id} onClick={() => onOpenWorkout(w.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", cursor: "pointer" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><CategoryBadge category={w.category} />{w.exercises.length} exercise{w.exercises.length === 1 ? "" : "s"}</span>
                  <ChevronRight size={16} style={{ color: "var(--accent)" }} />
                </div>
              ))}
            </Card>
          )}

          {selInfo.dayWeights.length > 0 && (
            <Card style={{ marginBottom: 10 }}>
              <div className="stat-label">Weight</div>
              {selInfo.dayWeights.map((w) => (
                <div key={w.id} style={{ padding: "4px 0" }}>{w.weight} lb{w.time ? " at " + w.time : ""}{w.tag ? " · " + w.tag : ""}</div>
              ))}
            </Card>
          )}

          {selInfo.dayHabits.length > 0 && (
            <Card style={{ marginBottom: 10 }}>
              <div className="stat-label">Habits Checked</div>
              {selInfo.dayHabits.map((h) => (
                <div key={h.id} style={{ padding: "4px 0", display: "flex", alignItems: "center", gap: 8 }}><HabitIcon name={h.icon} size={16} /> {h.name}</div>
              ))}
            </Card>
          )}

          {selInfo.dayPhotos.length > 0 && (
            <Card style={{ marginBottom: 10 }}>
              <div className="stat-label">Progress Photos</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                {selInfo.dayPhotos.map((p) => (
                  <img key={p.id} src={p.dataUrl} alt="" style={{ width: 72, height: 90, objectFit: "cover", borderRadius: 10 }} />
                ))}
              </div>
            </Card>
          )}

          {!selInfo.dayWorkouts.length && !selInfo.dayWeights.length && !selInfo.dayHabits.length && !selInfo.dayPhotos.length && (
            <Card><div style={{ color: "var(--subtext)" }}>Nothing logged this day.</div></Card>
          )}
        </>
      )}
    </div>
  );
}

function WorkoutCalendar({ workouts, onOpenWorkout }) {
  const [cursor, setCursor] = useState(new Date());
  const byDate = useMemo(() => {
    const m = {};
    workouts.forEach((w) => { if (!m[w.date]) m[w.date] = []; m[w.date].push(w); });
    return m;
  }, [workouts]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button className="icon-btn" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
        <div style={{ fontWeight: 700 }}>{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
        <button className="icon-btn" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, fontSize: 11, color: "var(--subtext)", textAlign: "center", marginBottom: 4 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const has = byDate[iso];
          return (
            <div
              key={i}
              onClick={() => has && onOpenWorkout(has[0].id)}
              style={{
                aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, fontSize: 13,
                background: has ? "var(--accent)" : "transparent", color: has ? "#fff" : "var(--text)", fontWeight: has ? 700 : 400, cursor: has ? "pointer" : "default",
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- MORE ---------------- */
function More({ theme, setTheme, workouts, weightLogs, photos, habits, setHabits, openHabit, setOpenHabit, setWorkouts, setWeightLogs, setPhotos }) {
  const [section, setSection] = useState("menu");
  const [importText, setImportText] = useState("");

  if (openHabit) {
    return <HabitDetail habit={habits.find((h) => h.id === openHabit)} setHabits={setHabits} onBack={() => setOpenHabit(null)} />;
  }

  if (section === "habits") {
    return <Habits habits={habits} setHabits={setHabits} onBack={() => setSection("menu")} onOpen={setOpenHabit} />;
  }

  if (section === "settings") {
    return (
      <div style={{ padding: "0 14px" }}>
        <BackHeader title="Settings" onBack={() => setSection("menu")} />
        <SectionTitle>Theme</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 8 }}>
            {["light", "dark", "system"].map((t) => (
              <Pill key={t} active={theme === t} onClick={() => setTheme(t)}>{t[0].toUpperCase() + t.slice(1)}</Pill>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (section === "export") {
    const data = JSON.stringify({ workouts, weightLogs, photos, habits }, null, 2);
    return (
      <div style={{ padding: "0 14px" }}>
        <BackHeader title="Export Data" onBack={() => setSection("menu")} />
        <Card><div style={{ color: "var(--subtext)", fontSize: 13, marginBottom: 8 }}>Copy this backup and store it somewhere safe. In the exported app, this will save directly as a file.</div>
          <textarea readOnly className="input" value={data} style={{ width: "100%", height: 220, fontSize: 11, fontFamily: "monospace" }} />
        </Card>
      </div>
    );
  }

  if (section === "import") {
    return (
      <div style={{ padding: "0 14px" }}>
        <BackHeader title="Import Backup" onBack={() => setSection("menu")} />
        <Card>
          <EField
            as="textarea"
            className="input"
            placeholder="Paste backup JSON here"
            initialValue={importText}
            onCommit={(v) => setImportText(v)}
            style={{ width: "100%", height: 180, fontSize: 12, fontFamily: "monospace" }}
          />
          <div style={{ marginTop: 10 }}>
            <Button onClick={() => {
              try {
                const parsed = JSON.parse(importText);
                if (parsed.workouts) setWorkouts(parsed.workouts);
                if (parsed.weightLogs) setWeightLogs(parsed.weightLogs);
                if (parsed.photos) setPhotos(parsed.photos);
                if (parsed.habits) setHabits(parsed.habits);
                setSection("menu");
              } catch { alert("Invalid backup data"); }
            }}>Import</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (section === "privacy") {
    return (
      <div style={{ padding: "0 14px" }}>
        <BackHeader title="Privacy" onBack={() => setSection("menu")} />
        <Card>
          <div style={{ lineHeight: 1.6, color: "var(--subtext)", fontSize: 14 }}>
            All workout data, weight logs, and progress photos are stored locally on your device. Nothing is uploaded automatically. Photos never touch your Photos app — they live only inside Workout Journal.
          </div>
        </Card>
      </div>
    );
  }

  if (section === "about") {
    return (
      <div style={{ padding: "0 14px" }}>
        <BackHeader title="About" onBack={() => setSection("menu")} />
        <Card>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Workout Journal</div>
          <div style={{ color: "var(--subtext)", marginTop: 6, fontSize: 14 }}>A private, personal fitness journal — not a coach. Version 1.0</div>
        </Card>
      </div>
    );
  }

  const rows = [
    { key: "settings", label: "Settings", Icon: SettingsIcon },
    { key: "export", label: "Export Data", Icon: Upload },
    { key: "import", label: "Import Backup", Icon: Download },
    { key: "privacy", label: "Privacy", Icon: Lock },
    { key: "about", label: "About", Icon: Info },
  ];

  return (
    <div style={{ padding: "0 14px" }}>
      <BigTitle>More</BigTitle>
      <Card style={{ padding: 0 }}>
        {rows.map((r, i) => (
          <div key={r.key} className="menu-row" onClick={() => setSection(r.key)} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--sep)" : "none" }}>
            <r.Icon size={18} style={{ marginRight: 10 }} />{r.label}<ChevronRight size={16} style={{ marginLeft: "auto", color: "var(--subtext)" }} />
          </div>
        ))}
      </Card>

      <SectionTitle>Habits</SectionTitle>
      <Card className="menu-row" onClick={() => setSection("habits")} style={{ display: "flex", alignItems: "center" }}>
        <ListChecks size={18} style={{ marginRight: 10 }} />Manage Habits<ChevronRight size={16} style={{ marginLeft: "auto", color: "var(--subtext)" }} />
      </Card>
    </div>
  );
}

function Habits({ habits, setHabits, onBack, onOpen }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const today = todayStr();

  const streakOf = (h) => {
    let streak = 0;
    let d = new Date();
    if (!h.checkins[todayStr(d)]) d.setDate(d.getDate() - 1);
    while (h.checkins[todayStr(d)]) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  };

  const toggleToday = (h) => {
    setHabits((prev) => prev.map((x) => x.id === h.id ? { ...x, checkins: { ...x.checkins, [today]: !x.checkins[today] } } : x));
  };

  const addHabit = () => {
    if (!name.trim()) return;
    setHabits((prev) => [...prev, { id: uid(), name: name.trim(), icon: "Star", goal: goal.trim(), description: description.trim(), checkins: {}, notes: {} }]);
    setName(""); setGoal(""); setDescription(""); setShowForm(false);
  };

  return (
    <div style={{ padding: "0 14px" }}>
      <BackHeader title="Habits" onBack={onBack} />
      <Card>
        {!showForm ? (
          <button className="link-btn" onClick={() => setShowForm(true)}>+ New Habit</button>
        ) : (
          <div>
            <EField
              className="input"
              placeholder="Habit name"
              initialValue={name}
              onCommit={(v) => setName(v)}
              style={{ width: "100%", fontWeight: 700 }}
            />
            <EField
              className="input"
              placeholder="Goal (e.g. 8 hours a night)"
              initialValue={goal}
              onCommit={(v) => setGoal(v)}
              style={{ width: "100%", marginTop: 8 }}
            />
            <EField
              as="textarea"
              className="input"
              placeholder="Description (optional)"
              initialValue={description}
              onCommit={(v) => setDescription(v)}
              style={{ width: "100%", marginTop: 8, minHeight: 50 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={addHabit}>Add Habit</Button>
            </div>
          </div>
        )}
      </Card>
      <SectionTitle>Today</SectionTitle>
      <div style={{ fontSize: 12, color: "var(--subtext)", padding: "0 4px 8px" }}>Swipe a habit left to delete</div>
      {habits.map((h) => (
        <SwipeRow key={h.id} onDelete={() => setHabits((prev) => prev.filter((x) => x.id !== h.id))}>
          <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 0, borderRadius: 18 }}>
            <div onClick={() => onOpen(h.id)} style={{ flex: 1, cursor: "pointer" }}>
              <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><HabitIcon name={h.icon} /> {h.name}</div>
              {h.goal && <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}><Target size={13} /> {h.goal}</div>}
              <div style={{ fontSize: 12, color: "var(--subtext)", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}><Flame size={13} /> {streakOf(h)} day streak</div>
            </div>
            <div className={"checkbox" + (h.checkins[today] ? " checked" : "")} onClick={() => toggleToday(h)}>
              {h.checkins[today] ? <Check size={16} strokeWidth={3} /> : ""}
            </div>
          </Card>
        </SwipeRow>
      ))}
      {!habits.length && <Card><div style={{ color: "var(--subtext)" }}>No habits yet. Add one above.</div></Card>}
    </div>
  );
}

function HabitDetail({ habit, setHabits, onBack }) {
  const [note, setNote] = useState(habit ? habit.notes[todayStr()] || "" : "");
  const [goal, setGoal] = useState(habit ? habit.goal || "" : "");
  const [description, setDescription] = useState(habit ? habit.description || "" : "");
  const days = useMemo(() => (habit ? Object.keys(habit.checkins).filter((d) => habit.checkins[d]).sort() : []), [habit]);
  const last30 = useMemo(() => {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = todayStr(d);
      arr.push({ date: iso, value: habit && habit.checkins[iso] ? 1 : 0 });
    }
    return arr;
  }, [habit]);

  useEffect(() => {
    if (!habit) onBack();
  }, [habit, onBack]);

  if (!habit) return null;

  const saveNote = () => {
    setHabits((prev) => prev.map((h) => h.id === habit.id ? { ...h, notes: { ...h.notes, [todayStr()]: note } } : h));
  };
  const saveGoal = () => {
    setHabits((prev) => prev.map((h) => h.id === habit.id ? { ...h, goal } : h));
  };
  const saveDescription = () => {
    setHabits((prev) => prev.map((h) => h.id === habit.id ? { ...h, description } : h));
  };
  const deleteHabit = () => {
    setHabits((prev) => prev.filter((h) => h.id !== habit.id));
    onBack();
  };

  return (
    <div style={{ padding: "0 14px" }}>
      <BackHeader title={habit.name} onBack={onBack} right={<button className="icon-btn" onClick={deleteHabit}><Trash2 size={16} /></button>} />
      <SectionTitle>Goal</SectionTitle>
      <Card>
        <EField
          className="input"
          placeholder="e.g. 8 hours a night"
          initialValue={goal}
          onCommit={(v) => setGoal(v)}
          onBlur={saveGoal}
          style={{ width: "100%", fontWeight: 700, color: "var(--accent)" }}
        />
      </Card>
      <SectionTitle>Description</SectionTitle>
      <Card>
        <EField
          as="textarea"
          className="input"
          placeholder="What is this habit about?"
          initialValue={description}
          onCommit={(v) => setDescription(v)}
          onBlur={saveDescription}
          style={{ width: "100%", minHeight: 60 }}
        />
      </Card>
      <SectionTitle>Last 30 Days</SectionTitle>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 4 }}>
          {last30.map((d, i) => (
            <div key={i} style={{ aspectRatio: "1", borderRadius: 4, background: d.value ? "var(--accent)" : "var(--fill)" }} />
          ))}
        </div>
      </Card>
      <SectionTitle>Total Check-ins</SectionTitle>
      <Card><div className="stat-value">{days.length}</div></Card>
      <SectionTitle>Today's Note</SectionTitle>
      <Card>
        <EField
          as="textarea"
          className="input"
          initialValue={note}
          onCommit={(v) => setNote(v)}
          onBlur={saveNote}
          style={{ width: "100%", minHeight: 70 }}
          placeholder="Add a note..."
        />
      </Card>
    </div>
  );
}

/* ---------------- TAB BAR ---------------- */
function TabBar({ tab, setTab }) {
  const items = [
    { key: "home", label: "Home", Icon: HomeIcon },
    { key: "workouts", label: "Workouts", Icon: Dumbbell },
    { key: "progress", label: "Progress", Icon: TrendingUp },
    { key: "calendar", label: "Calendar", Icon: CalendarDays },
    { key: "stats", label: "Stats", Icon: BarChart3 },
    { key: "more", label: "More", Icon: MoreHorizontal },
  ];
  return (
    <div className="tabbar">
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex" }}>
        {items.map((it) => (
          <div key={it.key} className={"tab-item" + (tab === it.key ? " tab-active" : "")} onClick={() => setTab(it.key)}>
            <it.Icon size={21} strokeWidth={tab === it.key ? 2.4 : 2} />
            <div style={{ fontSize: 10, marginTop: 3, fontWeight: 600 }}>{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
function Style({ dark }) {
  return (
    <style>{`
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      body { margin: 0; }
      .light {
        --bg: #F2F2F7; --card: #FFFFFF; --text: #1C1C1E; --subtext: #8E8E93;
        --accent: #1D4ED8; --accent2: #16348C; --fill: #E5E5EA; --sep: #E5E5EA; --red:#FF3B30; --green:#34C759;
      }
      .dark {
        --bg: #000000; --card: #1C1C1E; --text: #FFFFFF; --subtext: #8E8E93;
        --accent: #3B63E8; --accent2: #1B3EAE; --fill: #2C2C2E; --sep: #38383A; --red:#FF453A; --green:#30D158;
      }
      .card { background: var(--card); border-radius: 18px; padding: 16px; margin-bottom: 0; }
      .stat-label { font-size: 12px; color: var(--subtext); font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
      .stat-value { font-size: 24px; font-weight: 800; margin-top: 4px; }
      .stat-unit { font-size: 13px; font-weight: 500; color: var(--subtext); }
      .start-btn {
        width: 100%; border: none; background: linear-gradient(135deg, var(--accent), var(--accent2));
        color: #fff; font-size: 17px; font-weight: 700; padding: 18px; display: flex;
        align-items: center; justify-content: center; gap: 8px; cursor: pointer;
      }
      .pill { border: none; background: var(--fill); color: var(--text); padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .pill-active { background: var(--accent); color: #fff; }
      .btn { width: 100%; border: none; padding: 14px; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; }
      .btn-primary { background: var(--accent); color: #fff; }
      .btn-secondary { background: var(--fill); color: var(--text); }
      .back-btn { border: none; background: none; color: var(--accent); font-size: 16px; font-weight: 600; cursor: pointer; padding: 6px; }
      .icon-btn { border: none; background: var(--fill); color: var(--text); width: 30px; height: 30px; border-radius: 15px; cursor: pointer; font-size: 14px; }
      .link-btn { border: none; background: none; color: var(--accent); font-weight: 700; font-size: 14px; cursor: pointer; padding: 8px 0; }
      .input { border: none; background: var(--fill); border-radius: 10px; padding: 10px 12px; font-size: 15px; color: var(--text); outline: none; font-family: inherit; }
      .input.small { width: 60px; text-align: center; }
      .setchip { background: var(--fill); padding: 4px 10px; border-radius: 10px; font-size: 13px; }
      .menu-row { display: flex; align-items: center; padding: 14px 16px; cursor: pointer; font-size: 15px; font-weight: 500; }
      .checkbox { width: 28px; height: 28px; border-radius: 14px; border: 2px solid var(--fill); display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; font-weight: 700; }
      .checkbox.checked { background: var(--green); border-color: var(--green); }
      .tabbar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--card); border-top: 1px solid var(--sep); padding: 6px 0 max(6px, env(safe-area-inset-bottom)); backdrop-filter: blur(20px); }
      .tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 6px 0; cursor: pointer; color: var(--subtext); }
      .tab-active { color: var(--accent); }
      .spinner { width: 24px; height: 24px; border: 3px solid var(--fill, #ccc); border-top-color: var(--accent, #1D4ED8); border-radius: 50%; animation: spin .7s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      select.input { -webkit-appearance: none; appearance: none; }
      textarea.input { font-family: inherit; }
    `}</style>
  );
}
