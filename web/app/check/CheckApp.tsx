"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { evaluate, isOn, vote, type Example, type Label } from "@/lib/knn";
import type { Frame, Vision } from "@/lib/vision";
import { today } from "@/lib/client";
import type { PatchClass, SessionView } from "@/lib/types";
import s from "./check.module.css";

type Phase = "need-code" | "idle" | "loading" | "denied" | "error" | "ready";
const PER_CAPTURE = 20;
const LABELS: { id: Label; name: string; hint: string; required: boolean }[] = [
  { id: "patch", name: "Patch on", hint: "The patch on the prescribed eye. Move a little.", required: true },
  { id: "bare", name: "No patch", hint: "Both eyes open, no patch.", required: true },
  { id: "covered", name: "Hand over the eye", hint: "A hand or a toy covering the eye, so it isn't counted.", required: false },
];
const CLS_TEXT: Record<PatchClass, string> = { patch: "Patch on", bare: "No patch", covered: "Hand over the eye", noface: "Can't see a face" };

export function CheckApp() {
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("need-code");
  const [session, setSession] = useState<SessionView | null>(null);
  const [eye, setEye] = useState<"L" | "R">("R");
  const [examples, setExamples] = useState<Example[]>([]);
  const [capturing, setCapturing] = useState<Label | null>(null);
  const [checking, setChecking] = useState(false);
  const [live, setLive] = useState<{ cls: PatchClass; conf: number; on: boolean; face: boolean } | null>(null);
  const [sent, setSent] = useState<{ ok: boolean; at: number } | null>(null);
  const [attestMin, setAttestMin] = useState("");
  const [note, setNote] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vision = useRef<Vision | null>(null);
  const ex = useRef<Example[]>([]);
  const cap = useRef<Label | null>(null);
  const chk = useRef(false);
  const recent = useRef<PatchClass[]>([]);
  const current = useRef<{ cls: PatchClass; since: number } | null>(null);
  const lastSend = useRef(0);

  ex.current = examples; cap.current = capturing; chk.current = checking;

  // Read ?code= and the saved calibration for this TV and eye.
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("code")?.toUpperCase();
    if (c) { setCode(c); setPhase("idle"); }
  }, []);
  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const r = await fetch(`/api/session/${code}?day=${today()}`);
        if (!r.ok) { setNote(r.status === 404 ? "That code isn't a TV we know. Check the code on the TV screen." : "Can't reach Patch Hours. Check the connection and reload."); setPhase("need-code"); return; }
        let v = (await r.json()) as SessionView;
        // A TV restart makes a new code: carry this phone's earlier minutes and settings over to it, once.
        const last = localStorage.getItem("ph.lastCode");
        if (last && last !== code) {
          const ir = await fetch(`/api/session/${code}/inherit?day=${today()}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from: last }) });
          if (ir.ok) v = await ir.json();
        }
        localStorage.setItem("ph.lastCode", code);
        setSession(v); setEye(v.eye);
      } catch {
        setNote("Can't reach Patch Hours. Check the connection and reload."); setPhase("need-code");
      }
    })();
  }, [code]);
  useEffect(() => {
    if (!code) return;
    try { const saved = localStorage.getItem(`ph.cal.${eye}`); setExamples(saved ? JSON.parse(saved) : []); } catch { setExamples([]); }
  }, [code, eye]);
  useEffect(() => {
    if (!code) return;
    try { localStorage.setItem(`ph.cal.${eye}`, JSON.stringify(examples)); } catch { /* storage full: keep in memory */ }
  }, [examples, code, eye]);

  const send = useCallback(async (hb: { on: boolean; cls: PatchClass; conf: number; lagMs: number }) => {
    try {
      const r = await fetch(`/api/session/${code}/flag`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ on: hb.on, cls: hb.cls, conf: Math.round(hb.conf * 100) / 100, day: today(), lagMs: Math.round(hb.lagMs) }) });
      if (r.ok) setSession(await r.json());
      setSent({ ok: r.ok || r.status === 429, at: Date.now() });
    } catch { setSent({ ok: false, at: Date.now() }); }
  }, [code]);

  const onFrame = useCallback((f: Frame) => {
    const c = canvasRef.current, v = videoRef.current;
    if (c && v) {
      c.width = v.videoWidth; c.height = v.videoHeight;
      const g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height);
      if (f.box) { g.lineWidth = 4; g.strokeStyle = "#FFC145"; g.beginPath(); g.roundRect(f.box.x, f.box.y, f.box.s, f.box.s, 18); g.stroke(); }
    }
    // Calibration capture.
    if (cap.current && f.embedding) {
      const label = cap.current;
      setExamples((prev) => {
        const n = prev.filter((e) => e.label === label).length;
        if (n >= PER_CAPTURE * 3) return prev;
        return [...prev, { label, v: f.embedding! }];
      });
    }
    // Live check.
    let cls: PatchClass = "noface", conf = 1;
    if (f.embedding) { const vt = vote(ex.current, f.embedding); if (vt) { cls = isOn(vt) ? "patch" : vt.label === "patch" ? "bare" : vt.label; conf = vt.share; } }
    else if (f.face) { cls = "noface"; }
    recent.current = [...recent.current.slice(-2), cls];
    const counts = recent.current.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
    const smoothed = (Object.keys(counts) as PatchClass[]).sort((a, b) => counts[b] - counts[a])[0];
    const on = smoothed === "patch" && counts.patch >= 2;
    const now = performance.now();
    if (!current.current || current.current.cls !== smoothed) current.current = { cls: smoothed, since: now };
    setLive({ cls: smoothed, conf, on, face: f.face });
    if (chk.current) {
      const changed = recent.current.length > 1 && recent.current[recent.current.length - 2] !== cls && smoothed === cls;
      if (changed || Date.now() - lastSend.current > 500) {
        lastSend.current = Date.now();
        send({ on, cls: on ? "patch" : smoothed === "patch" ? "bare" : smoothed, conf, lagMs: now - current.current.since });
      }
    }
  }, [send]);

  // Stop capturing once this round has enough frames.
  useEffect(() => {
    if (!capturing) return;
    const n = examples.filter((e) => e.label === capturing).length;
    if (n % PER_CAPTURE === 0 && n > 0) setCapturing(null);
  }, [examples, capturing]);

  const start = async () => {
    setPhase("loading"); setNote("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch { setPhase("denied"); return; }
    try {
      const { loadVision, look } = await import("@/lib/vision");
      vision.current = await loadVision();
      const v = videoRef.current!; v.srcObject = stream; await v.play();
      setPhase("ready");
      let last = 0;
      const loop = (t: number) => {
        if (v.readyState >= 2 && t - last > 180 && vision.current) { last = t; onFrame(look(vision.current, v, eyeRef.current, t)); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) { setNote(`The on-phone model didn't load (${String(e).slice(0, 80)}). Reload to try again.`); setPhase("error"); }
  };
  const eyeRef = useRef(eye); eyeRef.current = eye;

  const setEyeRemote = async (e: "L" | "R") => {
    setEye(e); setChecking(false);
    try {
      const r = await fetch(`/api/session/${code}?day=${today()}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ eye: e }) });
      if (r.ok) setSession(await r.json()); else setNote("Couldn't save the patched eye. Try again.");
    } catch { setNote("Couldn't save the patched eye. Check the connection."); }
  };
  const attest = async () => {
    const m = Number(attestMin);
    try {
      const r = await fetch(`/api/session/${code}/attest`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ day: today(), minutes: m }) });
      if (r.ok) { setSession(await r.json()); setAttestMin(""); setNote(`Added ${m} min, kept apart from the minutes the camera saw.`); }
      else setNote(r.status === 409 ? "Busy. Press Add minutes again." : "Minutes must be between 1 and 240.");
    } catch { setNote("Couldn't add the minutes. Check the connection."); }
  };

  const ev = evaluate(examples);
  const count = (l: Label) => examples.filter((e) => e.label === l).length;
  const canCheck = count("patch") >= 5 && count("bare") >= 5;

  if (phase === "need-code") {
    return (
      <main className={s.wrap}>
        <h1 className={s.title}>Patch Hours</h1>
        <p>Type the code shown on the TV.</p>
        <form className={s.row} onSubmit={(e) => { e.preventDefault(); const c = typed.trim().toUpperCase(); if (c.length === 6) { history.replaceState(null, "", `?code=${c}`); setCode(c); setPhase("idle"); } }}>
          <label className="sr" htmlFor="code">TV code</label>
          <input id="code" className={s.input} value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={6} autoCapitalize="characters" autoComplete="off" placeholder="GTZZMT" />
          <button className="btn" type="submit">Pair</button>
        </form>
        {note && <p className={s.warn} role="alert">{note}</p>}
      </main>
    );
  }

  return (
    <main className={s.wrap}>
      <header className={s.head}>
        <h1 className={s.title}>Patch Hours</h1>
        <p className="muted num">TV {code}</p>
      </header>

      <div className={s.cam} data-on={live?.on ? "true" : "false"}>
        <video ref={videoRef} className={s.video} playsInline muted />
        <canvas ref={canvasRef} className={s.overlay} aria-hidden />
        {phase !== "ready" && (
          <div className={s.camMsg}>
            {phase === "idle" && <button className="btn" onClick={start}>Turn on the camera</button>}
            {phase === "loading" && <p>Loading the on-phone model…</p>}
            {phase === "denied" && <p>The camera is blocked. Allow it in your browser&apos;s site settings, then reload this page.</p>}
            {phase === "error" && <p>{note}</p>}
          </div>
        )}
        {phase === "ready" && live && (
          <p className={s.status} role="status" aria-live="polite" data-cls={!live.face ? "noface" : canCheck ? live.cls : "teach"}>
            {!live.face ? CLS_TEXT.noface : !canCheck ? "Face found · teach the patch below" : live.on ? "Patch on" : CLS_TEXT[live.cls]}
          </p>
        )}
      </div>
      <p className={s.privacy}>Only on/off leaves this phone. No pictures are sent.</p>

      <section className={s.card} aria-labelledby="teach">
        <h2 id="teach">1 · Teach the phone this patch</h2>
        <div className={s.eye} role="radiogroup" aria-label="Prescribed eye">
          <span className="muted">Patched eye</span>
          {(["L", "R"] as const).map((e) => (
            <button key={e} role="radio" aria-checked={eye === e} className={`btn ${eye === e ? "" : "tonal"}`} onClick={() => setEyeRemote(e)}>{e === "L" ? "Child's left" : "Child's right"}</button>
          ))}
        </div>
        <ul className={s.labels}>
          {LABELS.map((l) => (
            <li key={l.id}>
              <div>
                <p className={s.lname}>{l.name}{!l.required && <span className="muted"> · recommended</span>}</p>
                <p className="muted">{l.hint}</p>
              </div>
              <button className={`btn ${count(l.id) ? "tonal" : ""}`} aria-disabled={phase !== "ready" || !!capturing}
                onClick={() => phase === "ready" && !capturing && setCapturing(l.id)}>
                {capturing === l.id ? `Capturing ${count(l.id) % PER_CAPTURE}/${PER_CAPTURE}` : `Capture · ${count(l.id)}`}
              </button>
            </li>
          ))}
        </ul>
        {ev ? (
          <p className={`${s.eval} num`}>
            Held-out check on {ev.n} frames: precision <b>{(ev.precision * 100).toFixed(0)}%</b> · recall <b>{(ev.recall * 100).toFixed(0)}%</b>
            {ev.coveredN > 0 && <> · hand refused <b>{ev.coveredRefused}/{ev.coveredN}</b></>}
          </p>
        ) : <p className="muted">Capture at least 5 frames each of “Patch on” and “No patch”.</p>}
        {examples.length > 0 && <button className="btn tonal" onClick={() => { setExamples([]); setChecking(false); }}>Start over</button>}
      </section>

      <section className={s.card} aria-labelledby="check">
        <h2 id="check">2 · Check during the show</h2>
        <button className="btn" aria-disabled={!canCheck || phase !== "ready"}
          onClick={() => canCheck && phase === "ready" && setChecking((c) => !c)}>
          {checking ? "Stop checking" : "Start checking"}
        </button>
        {!canCheck && <p className="muted">Teach the phone first (step 1).</p>}
        {checking && sent && <p className={sent.ok ? "muted" : s.warn}>{sent.ok ? "Sending to the TV" : "Not sent. The TV pauses until the phone reconnects."}</p>}
        {session && (
          <p className="num">Today: <b>{Math.floor(session.today.verifiedSec / 60)}</b> min seen by the camera · <b>{Math.floor(session.today.attestedSec / 60)}</b> min added by you · {session.prescribedMin} min prescribed</p>
        )}
      </section>

      <section className={s.card} aria-labelledby="attest">
        <h2 id="attest">Worn but not seen?</h2>
        <p className="muted">Add minutes the patch was on away from the TV. They are kept apart from what the camera saw.</p>
        <form className={s.row} onSubmit={(e) => { e.preventDefault(); attest(); }}>
          <label className="sr" htmlFor="am">Minutes</label>
          <input id="am" className={s.input} inputMode="numeric" value={attestMin} onChange={(e) => setAttestMin(e.target.value.replace(/\D/g, ""))} placeholder="30" />
          <button className="btn tonal" type="submit">Add minutes</button>
        </form>
        {note && phase === "ready" && <p className="muted" role="status">{note}</p>}
        <p><a href={`/week?code=${code}`}>See this week&apos;s minutes</a></p>
      </section>
      {checking && live && (
        <div className={s.bar} data-on={live.on ? "true" : "false"} aria-hidden>
          <span>{live.on ? "Patch on · the show plays" : `${!live.face ? CLS_TEXT.noface : CLS_TEXT[live.cls]} · the show is paused`}</span>
          <button className="btn tonal" onClick={() => setChecking(false)}>Stop</button>
        </div>
      )}
      <p className={s.foot}>An aid for wearing a prescribed patch. It does not treat amblyopia or change a prescription.</p>
    </main>
  );
}
