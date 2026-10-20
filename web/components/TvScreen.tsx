"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { PatchRing } from "./PatchRing";
import { createSession, useSession, VIDEO_CREDIT, VIDEO_SOURCES } from "@/lib/client";
import styles from "./tv.module.css";

type Phase = "pairing" | "playing" | "paused-off" | "paused-stale" | "paused-covered";

export function TvScreen({ initialCode }: { initialCode?: string | null }) {
  const [code, setCode] = useState<string | null>(initialCode ?? null);
  const [forceState, setForceState] = useState<string | null>(null);
  // ?code= pins a pairing code, ?state= forces a screen state for review.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const c = q.get("code"); if (c) setCode(c.toUpperCase());
    setForceState(q.get("state"));
  }, []);
  const [qr, setQr] = useState<string>("");
  const [started, setStarted] = useState(false);
  const [pauseNote, setPauseNote] = useState<string>("");
  const video = useRef<HTMLVideoElement>(null);
  const wasPlaying = useRef(false);
  const { view, error, missing } = useSession(code);

  // A TV gets its own pairing code; it survives a reload.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("code") && !missing) return;
    if (code && !missing) return;
    const saved = !missing ? localStorage.getItem("ph.tv.code") : null;
    if (saved) { setCode(saved); return; }
    createSession().then((s) => { localStorage.setItem("ph.tv.code", s.code); setCode(s.code); }).catch(() => setTimeout(() => setCode(null), 3000));
  }, [code, missing]);

  useEffect(() => {
    if (!code) return;
    QRCode.toDataURL(`${location.origin}/check?code=${code}`, { margin: 1, width: 560, color: { dark: "#1D1714", light: "#F6EDE4" } }).then(setQr);
  }, [code]);

  let phase: Phase = !view?.paired ? "pairing" : view.playable ? "playing" : view.stale ? "paused-stale" : view.flag.cls === "covered" ? "paused-covered" : "paused-off";
  if (forceState && ["pairing", "playing", "paused-off", "paused-stale", "paused-covered"].includes(forceState)) phase = forceState as Phase;

  // Play or pause the reward strictly by the session state.
  useEffect(() => {
    const v = video.current;
    if (!v || !started) return;
    if (phase === "playing") { v.play().catch(() => {}); setPauseNote(""); }
    else {
      v.pause();
      if (wasPlaying.current && view && view.changedAt) {
        const s = Math.max(0, (view.serverNow - view.changedAt) / 1000);
        setPauseNote(phase === "paused-stale" ? "Paused: the phone stopped reporting" : `Paused ${s.toFixed(1)} s after the patch came off`);
      }
    }
    wasPlaying.current = phase === "playing";
  }, [phase, started, view]);

  const minutes = (view?.today.verifiedSec ?? 0) / 60;
  const prescribed = view?.prescribedMin ?? 120;
  const off = phase !== "playing" && phase !== "pairing";

  return (
    <div className={styles.tv} data-phase={phase}>
      <div className={styles.stage}>
        <video ref={video} className={styles.video} playsInline preload="auto" loop
          aria-label="Reward video" onClick={() => setStarted(true)}>
          {VIDEO_SOURCES.map((v) => <source key={v.src} src={v.src} type={v.type} />)}
        </video>
        {phase === "pairing" && (
          <div className={styles.pair}>
            <h1 className={styles.pairTitle}>Pair a phone to start</h1>
            <div className={styles.pairRow}>
              {qr ? <img src={qr} alt={`QR code for the phone check, code ${code}`} className={styles.qr} /> : <div className={styles.qr} />}
              <div>
                <p className={styles.pairLabel}>Code</p>
                <p className={`${styles.code} display num`} aria-live="polite">{code ?? "······"}</p>
                <p className="muted">Scan with the phone that will watch the patch,<br />or open <b>/check</b> and type the code.</p>
              </div>
            </div>
          </div>
        )}
        {off && (
          <div className={styles.prompt} role="status">
            <p className={`${styles.promptText} display`}>
              {phase === "paused-stale" ? "The phone can\u2019t see the patch" : phase === "paused-covered" ? "That\u2019s a hand, not the patch" : "Patch back on to keep watching"}
            </p>
            {pauseNote && <p className={`${styles.pauseNote} num`}>{pauseNote}</p>}
          </div>
        )}
        {!started && phase !== "pairing" && (
          <button className={`btn ${styles.start}`} onClick={() => setStarted(true)} autoFocus>Press OK to start the show</button>
        )}
      </div>
      <aside className={styles.rail}>
        <p className={`${styles.brand} display`}>Patch Hours</p>
        <PatchRing minutes={minutes} prescribed={prescribed} off={off} size={320} />
        <p className={`${styles.minutes} display num`}>{fmt(minutes)} <span>of {prescribed} min today</span></p>
        <p className={styles.chip} data-on={phase === "playing"}>
          <span aria-hidden className={styles.dot} />
          {phase === "pairing" ? "Waiting for the phone" : phase === "playing" ? "Patch on" : phase === "paused-stale" ? "Phone not reporting" : "Patch off"}
        </p>
        {error && <p className={styles.err} role="alert">Can't reach Patch Hours. Retrying…</p>}
        <p className={styles.credit}>{VIDEO_CREDIT}</p>
      </aside>
    </div>
  );
}

// Under ten minutes, show seconds so the counter visibly moves.
function fmt(min: number) {
  if (min >= 10) return String(Math.floor(min));
  const s = Math.floor(min * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
