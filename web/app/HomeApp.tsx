"use client";
import { useEffect, useRef, useState } from "react";
import { TvScreen } from "@/components/TvScreen";
import { createSession, today } from "@/lib/client";
import type { PatchClass } from "@/lib/types";

// A scripted run sends the same on/off signals a phone sends, for judges without a phone at hand.
const SCRIPT: { cls: PatchClass; on: boolean; sec: number }[] = [
  { cls: "patch", on: true, sec: 14 }, { cls: "bare", on: false, sec: 6 },
  { cls: "covered", on: false, sec: 6 }, { cls: "patch", on: true, sec: 10 },
];

export function HomeApp() {
  const [code, setCode] = useState<string | null>(null);
  const [running, setRunning] = useState<string>("");
  const stop = useRef(false);
  useEffect(() => {
    const saved = sessionStorage.getItem("ph.home.code");
    if (saved) { setCode(saved); return; }
    createSession().then((s) => { sessionStorage.setItem("ph.home.code", s.code); setCode(s.code); });
  }, []);

  const run = async () => {
    if (!code || running) return;
    stop.current = false;
    for (const step of SCRIPT) {
      setRunning(step.on ? "Scripted run: patch on" : step.cls === "covered" ? "Scripted run: hand over the eye" : "Scripted run: patch off");
      const end = Date.now() + step.sec * 1000;
      while (Date.now() < end && !stop.current) {
        await fetch(`/api/session/${code}/flag`, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ on: step.on, cls: step.cls, conf: 1, day: today(), lagMs: 0 }) });
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    setRunning("");
  };

  return (
    <main className="home">
      <h1 className="sr">Patch Hours: the show plays only while the eye patch is on</h1>
      {code ? <TvScreen key={code} initialCode={code} /> : <div style={{ aspectRatio: "16/9", background: "var(--surface-1)", borderRadius: 20 }} />}
      <section aria-labelledby="judge" className="homeSide">
        <div style={{ background: "var(--surface-1)", borderRadius: 20, padding: 20 }}>
          <h2 id="judge" style={{ fontSize: 26, margin: "0 0 8px" }}>How to judge this in 90 seconds</h2>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Scan the code on the TV above with your phone.</li>
            <li>Teach it: “Patch on” (a sticky note over one eye works), then “No patch”.</li>
            <li>Press <b>Start checking</b>, then lift the patch. The show stops.</li>
          </ol>
        </div>
        <div style={{ background: "var(--surface-1)", borderRadius: 20, padding: 20, display: "grid", gap: 10, alignContent: "start" }}>
          <p style={{ margin: 0 }}>No phone at hand? Send the same signals a phone sends, on a script.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={run} aria-disabled={!code || !!running}>Run the scripted check</button>
            {running && <button className="btn tonal" onClick={() => { stop.current = true; }}>Stop</button>}
          </div>
          <p role="status" className="muted" style={{ margin: 0 }}>{running || "Then press OK (or click) on the TV to start the show."}</p>
        </div>
        <div style={{ background: "var(--surface-1)", borderRadius: 20, padding: 20 }}>
          <p style={{ margin: "0 0 8px" }}>A Fire TV app (Vega) and a phone page. The phone checks the patch on the device and sends only on or off. <a href="/about">How it works</a></p>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>This page shows the TV app&apos;s screen in the browser. Big Buck Bunny, Blender Foundation, CC BY 3.0.</p>
        </div>
      </section>
    </main>
  );
}
