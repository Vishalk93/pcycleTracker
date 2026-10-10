import { useState, useMemo, useEffect } from "react";

const KEY = "cycle-periods-v1";
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (k: any) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const diff = (a: any, b: any) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
const add = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return keyOf(d); };
const fmt = (k) => parse(k).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtY = (k) => parse(k).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const HKEY = "cycle-habits-v1";
const LKEY = "cycle-habitlogs-v1";
const DEFAULT_HABITS = ["Drink 2L water", "Sleep 8 hours", "Walk or stretch", "Take vitamins", "Eat fruits & veggies"]
  .map((name, i) => ({ id: "h" + (i + 1), name }));

function load(k, fallback) {
  try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch { return fallback; }
}

function getStats(periods, todayK) {
  const starts = periods.map((p) => p.s).sort();
  const gaps = [];
  for (let i = 1; i < starts.length; i++) {
    const g = diff(starts[i - 1], starts[i]);
    if (g >= 15 && g <= 60) gaps.push(g);
  }
  const avg = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  const lens = periods.map((p) => diff(p.s, p.e) + 1);
  const plen = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 5;
  const cyc = avg || 28;
  let next = null;
  if (starts.length) {
    next = add(starts[starts.length - 1], cyc);
    let guard = 0;
    while (diff(next, todayK) > plen && guard++ < 24) next = add(next, cyc);
  }
  return { avg, plen, cyc, next };
}

export default function PeriodTracker() {
  const todayK = keyOf(new Date());
  const [periods, setPeriods] = useState(() => load(KEY, []));
  const [habits, setHabits] = useState(() => load(HKEY, DEFAULT_HABITS));
  const [logs, setLogs] = useState(() => load(LKEY, {}));
  const [mode, setMode] = useState("period");
  const [selDay, setSelDay] = useState(todayK);
  const [newHabit, setNewHabit] = useState("");
  const [view, setView] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [sel, setSel] = useState({ s: null, e: null });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(periods));
      localStorage.setItem(HKEY, JSON.stringify(habits));
      localStorage.setItem(LKEY, JSON.stringify(logs));
    } catch { /* storage unavailable */ }
  }, [periods, habits, logs]);

  const st = useMemo(() => getStats(periods, todayK), [periods, todayK]);

  const predSet = useMemo(() => {
    const set = new Set();
    if (st.next) for (let c = -1; c < 4; c++) for (let n = 0; n < st.plen; n++) set.add(add(st.next, c * st.cyc + n));
    return set;
  }, [st]);

  const inPeriod = (k) => periods.find((p) => k >= p.s && k <= p.e);

  const onDay = (k) => {
    if (mode === "habit") return setSelDay(k);
    if (inPeriod(k) && !sel.s) return;
    if (!sel.s || (sel.s && sel.e)) return setSel({ s: k, e: null });
    const [s, e] = k < sel.s ? [k, sel.s] : [sel.s, k];
    if (diff(s, e) > 14) return setSel({ s: k, e: null });
    setSel({ s, e });
  };

  const save = () => {
    if (!sel.s || !sel.e) return;
    const { s, e } = sel;
    setPeriods((ps) => [...ps.filter((p) => p.e < s || p.s > e), { s, e }]);
    const d = parse(s);
    setView(new Date(d.getFullYear(), d.getMonth(), 1));
    setSel({ s: null, e: null });
  };

  const shift = (n) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));

  const first = view.getDay();
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const selMax = sel.s ? sel.e || sel.s : null;

  const cells = [];
  for (let i = 0; i < first; i++) cells.push(<button key={"o" + i} className="day out" tabIndex={-1} aria-hidden="true" />);
  for (let d = 1; d <= days; d++) {
    const date = new Date(view.getFullYear(), view.getMonth(), d);
    const k = keyOf(date), wd = date.getDay();
    const p = inPeriod(k);
    const inSel = sel.s && k >= sel.s && k <= selMax;
    const cls = ["day"];
    if (k === todayK) cls.push("today");
    if (mode === "habit") {
      const dn = (logs[k] || []).filter((id) => habits.some((h) => h.id === id)).length;
      if (dn > 0) cls.push(dn >= habits.length ? "hdone" : "hsome");
      if (k === selDay) cls.push("picked");
    }
    if (p || inSel) {
      const s = p ? p.s : sel.s, e = p ? p.e : selMax;
      cls.push("band");
      if (k === s || wd === 0) cls.push("cs");
      if (k === e || wd === 6 || d === days) cls.push("ce");
      if (k === s || k === e) cls.push("cap");
    } else if (predSet.has(k) && k > todayK) cls.push("predict");
    cells.push(
      <button key={k} className={cls.join(" ")} onClick={() => onDay(k)}
        aria-label={fmtY(k) + (p ? ", period day" : predSet.has(k) && k > todayK ? ", predicted period" : "")}>
        <span>{d}</span>
      </button>
    );
  }

  const until = st.next ? diff(todayK, st.next) : null;
  const nextLabel = until === null ? "Log a period to see a prediction"
    : until > 0 ? `Next period in ${until} ${until === 1 ? "day" : "days"}`
    : until === 0 ? "Expected today" : `Expected ${-until} ${until === -1 ? "day" : "days"} ago`;

  const barMsg = !sel.s ? "Select the first day of your period."
    : !sel.e ? `Starts ${fmt(sel.s)}. Now select the last day.`
    : `${fmt(sel.s)} to ${fmt(sel.e)} (${diff(sel.s, sel.e) + 1} ${diff(sel.s, sel.e) === 0 ? "day" : "days"})`;

  const sorted = [...periods].sort((a, b) => (a.s < b.s ? 1 : -1));

  const doneIds = logs[selDay] || [];
  const doneCount = habits.filter((h) => doneIds.includes(h.id)).length;
  const toggleHabit = (id) =>
    setLogs((l) => {
      const cur = l[selDay] || [];
      return { ...l, [selDay]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  const addHabit = () => {
    const name = newHabit.trim();
    if (!name) return;
    setHabits((h) => [...h, { id: "h" + Date.now(), name }]);
    setNewHabit("");
  };
  const removeHabit = (id) => setHabits((h) => h.filter((x) => x.id !== id));

  const habitPanel = (
    <section className="hpanel" aria-label="Habits">
      <h3>{selDay === todayK ? "Today" : fmtY(selDay)}</h3>
      <span className="hcount">{doneCount} of {habits.length} done</span>
      <div className="hprog"><i style={{ width: habits.length ? `${(doneCount / habits.length) * 100}%` : 0 }} /></div>
      {habits.length === 0 && <p className="empty">No habits yet. Add one below.</p>}
      {habits.map((h) => {
        const on = doneIds.includes(h.id);
        return (
          <div key={h.id} className={"hitem" + (on ? " done" : "")}>
            <label>
              <input type="checkbox" checked={on} onChange={() => toggleHabit(h.id)} />
              <span>{h.name}</span>
            </label>
            <button aria-label={`Remove ${h.name}`} onClick={() => removeHabit(h.id)}>×</button>
          </div>
        );
      })}
      <div className="hadd">
        <input value={newHabit} placeholder="Add a habit" onChange={(e) => setNewHabit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addHabit()} />
        <button className="btn primary" onClick={addHabit}>Add</button>
      </div>
    </section>
  );

  return (
    <div className="pt-root">
      <style>{css}</style>
      <main>
        <h1>Cycle &amp; habit calendar</h1>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === "period"} className={mode === "period" ? "on" : ""} onClick={() => setMode("period")}>Period</button>
          <button role="tab" aria-selected={mode === "habit"} className={mode === "habit" ? "on" : ""} onClick={() => setMode("habit")}>Habits</button>
        </div>
        <p className="sub">{mode === "period" ? "Tap a start date, then an end date." : "Tap a day to see its habit checklist."}</p>

        <section className="summary" aria-label="Summary">
          <div className="stat next"><b>{st.next ? fmt(st.next) : "–"}</b><span>{nextLabel}</span></div>
          <div className="stat"><b>{st.avg || "–"}</b><span>Average cycle (days)</span></div>
        </section>

        <section className="cal" aria-label="Calendar">
          <div className="nav">
            <button onClick={() => shift(-1)} aria-label="Previous month">‹</button>
            <h2>{view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
            <button onClick={() => shift(1)} aria-label="Next month">›</button>
          </div>
          <div className="grid">{["S", "M", "T", "W", "T", "F", "S"].map((x, i) => <div key={i} className="dow">{x}</div>)}</div>
          <div className="grid">{cells}</div>
          <div className="legend">
            <span><i style={{ background: "var(--period)" }} />Period</span>
            <span><i style={{ border: "2px dashed var(--predict)" }} />Predicted</span>
            <span><i style={{ boxShadow: "inset 0 0 0 2px var(--today)" }} />Today</span>
            {mode === "habit" && <span><i style={{ background: "var(--predict)" }} />All habits done</span>}
            {mode === "habit" && <span><i style={{ border: "2px solid var(--predict)" }} />Some done</span>}
          </div>
        </section>

        {mode === "period" && (<>
        <div className="bar" aria-live="polite">
          <p>{barMsg}</p>
          <div className="btns">
            {sel.s && <button className="btn" onClick={() => setSel({ s: null, e: null })}>Clear</button>}
            <button className="btn primary" disabled={!sel.e} onClick={save}>Save period</button>
          </div>
        </div>

        <h3>Logged periods</h3>
        <ul className="list">
          {sorted.length === 0 && <li className="empty">No periods logged yet. Pick dates on the calendar to add one.</li>}
          {sorted.map((p) => {
            const n = diff(p.s, p.e) + 1;
            return (
              <li key={p.s + p.e}>
                <div>{fmtY(p.s)}{p.s !== p.e ? ` to ${fmt(p.e)}` : ""}<small>{n} {n === 1 ? "day" : "days"}</small></div>
                <button aria-label={`Delete period starting ${fmtY(p.s)}`}
                  onClick={() => setPeriods((ps) => ps.filter((x) => x !== p))}>Delete</button>
              </li>
            );
          })}
        </ul>
        </>)}
        {mode === "habit" && habitPanel}
        <p className="note">For tracking only. Predictions are estimates and not a form of birth control or medical advice.</p>
      </main>
    </div>
  );
}

const css = `
.pt-root{--bg:#F4EFFA;--card:#fff;--ink:#2B1637;--muted:#7A6A88;--period:#D6336C;--period-soft:#FBD9E5;--predict:#8E5BD6;--today:#2B1637;--line:#E4DAF0;
  background:var(--bg);color:var(--ink);min-height:100vh;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){.pt-root{--bg:#1A0F24;--card:#271636;--ink:#F5ECFB;--muted:#B09CC4;--period:#F0679A;--period-soft:#5A2142;--predict:#B58CF2;--today:#F5ECFB;--line:#3D2753}}
.pt-root *{box-sizing:border-box}
.pt-root main{max-width:460px;margin:0 auto;padding:20px 16px 40px}
.pt-root h1{font-size:30px;font-weight:800;margin:4px 0 2px;letter-spacing:-.02em}
.pt-root .sub{color:var(--muted);margin:0 0 18px;font-size:15px}
.pt-root .summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.pt-root .stat{background:var(--card);border-radius:18px;padding:14px;border:1px solid var(--line)}
.pt-root .stat b{display:block;font-size:26px;font-weight:800;line-height:1.1}
.pt-root .stat span{font-size:13px;color:var(--muted)}
.pt-root .stat.next b{color:var(--predict)}
.pt-root .cal{background:var(--card);border-radius:24px;padding:14px 10px 12px;border:1px solid var(--line)}
.pt-root .nav{display:flex;align-items:center;justify-content:space-between;padding:0 6px 10px}
.pt-root .nav h2{margin:0;font-size:19px;font-weight:600}
.pt-root .nav button{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink);font-size:18px;cursor:pointer}
.pt-root .grid{display:grid;grid-template-columns:repeat(7,1fr);row-gap:4px}
.pt-root .dow{text-align:center;font-size:12px;color:var(--muted);padding:4px 0 8px}
.pt-root .day{position:relative;height:44px;border:0;background:transparent;color:var(--ink);font:inherit;font-size:15px;cursor:pointer;padding:0}
.pt-root .day span{position:relative;z-index:1;display:inline-flex;width:38px;height:38px;align-items:center;justify-content:center;border-radius:50%}
.pt-root .day.out{visibility:hidden}
.pt-root .day.today span{box-shadow:inset 0 0 0 2px var(--today);font-weight:600}
.pt-root .day.band::before{content:"";position:absolute;left:0;right:0;top:3px;bottom:3px;background:var(--period-soft)}
.pt-root .day.band.cs::before{border-radius:999px 0 0 999px;left:3px}
.pt-root .day.band.ce::before{border-radius:0 999px 999px 0;right:3px}
.pt-root .day.band.cs.ce::before{border-radius:999px}
.pt-root .day.cap span{background:var(--period);color:#fff;font-weight:600}
.pt-root .day.predict span{border:2px dashed var(--predict)}
.pt-root .day:focus-visible{outline:2px solid var(--predict);outline-offset:-2px;border-radius:12px}
.pt-root .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);padding:10px 6px 0}
.pt-root .legend i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.pt-root .bar{margin-top:14px;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.pt-root .bar p{margin:0;font-size:15px;flex:1 1 180px}
.pt-root .btns{display:flex;gap:8px}
.pt-root .btn{font:inherit;font-weight:600;font-size:15px;border-radius:999px;padding:11px 18px;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer}
.pt-root .btn.primary{background:var(--period);border-color:var(--period);color:#fff}
.pt-root .btn:disabled{opacity:.4;cursor:default}
.pt-root h3{font-size:17px;margin:24px 4px 8px}
.pt-root .list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.pt-root .list li{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px}
.pt-root .list li.empty{background:none;border:0;color:var(--muted);padding:4px;font-size:15px}
.pt-root .list small{display:block;color:var(--muted);font-size:13px}
.pt-root .list button{border:0;background:transparent;color:var(--period);font:inherit;font-weight:600;cursor:pointer;padding:8px}
.pt-root .note{color:var(--muted);font-size:12.5px;margin:22px 4px 0}
.pt-root .tabs{display:flex;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px;margin-bottom:14px}
.pt-root .tabs button{flex:1;border:0;background:transparent;color:var(--muted);font:inherit;font-weight:600;font-size:15px;padding:10px;border-radius:999px;cursor:pointer}
.pt-root .tabs button.on{background:var(--period);color:#fff}
.pt-root .day.picked span{background:var(--predict);color:#fff;font-weight:600}
.pt-root .day.hsome::after,.pt-root .day.hdone::after{content:"";position:absolute;bottom:1px;left:50%;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;z-index:1;border:2px solid var(--predict)}
.pt-root .day.hdone::after{background:var(--predict)}
.pt-root .hpanel{margin-top:14px;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px}
.pt-root .hpanel h3{margin:0 0 2px}
.pt-root .hcount{font-size:13px;color:var(--muted)}
.pt-root .hprog{height:6px;border-radius:99px;background:var(--line);margin:8px 0 6px;overflow:hidden}
.pt-root .hprog i{display:block;height:100%;background:var(--predict);transition:width .2s}
.pt-root .hitem{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)}
.pt-root .hitem label{flex:1;display:flex;align-items:center;gap:12px;cursor:pointer;font-size:16px;padding:6px 0}
.pt-root .hitem input{width:22px;height:22px;accent-color:var(--predict);flex:none}
.pt-root .hitem.done span{text-decoration:line-through;color:var(--muted)}
.pt-root .hitem button{border:0;background:transparent;color:var(--muted);font-size:20px;cursor:pointer;padding:6px 10px}
.pt-root .hadd{display:flex;gap:8px;margin-top:12px}
.pt-root .hadd input{flex:1;min-width:0;font:inherit;padding:11px 14px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--ink)}
.pt-root .empty{color:var(--muted);font-size:15px}
`;
