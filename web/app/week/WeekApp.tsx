"use client";
import { useEffect, useState } from "react";
import { today } from "@/lib/client";
import type { SessionView } from "@/lib/types";

export function WeekApp() {
  const [v, setV] = useState<SessionView | null>(null);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [days, setDays] = useState<string[]>([]);
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("code")?.toUpperCase() ?? "";
    setCode(c);
    setDays(Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return today(d); }));
    if (!c) { setErr("Open this page from the phone check, or add ?code= with the TV code."); return; }
    fetch(`/api/session/${c}?day=${today()}`).then(async (r) => r.ok ? setV(await r.json()) : setErr("Couldn't load this TV's minutes."));
  }, []);
  const by = Object.fromEntries((v?.days ?? []).map((d) => [d.day, d]));
  const total = (k: "verifiedSec" | "attestedSec") => days.reduce((n, d) => n + (by[d]?.[k] ?? 0), 0) / 60;
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px" }}>
      <p className="display" style={{ color: "var(--accent)", fontSize: 24, margin: 0 }}>Patch Hours</p>
      <h1 style={{ fontSize: 40, margin: "8px 0 4px" }}>Minutes this week</h1>
      <p className="muted" style={{ marginTop: 0 }}>TV {code}. The camera&apos;s minutes and the minutes you added are kept apart, so the clinic sees both.</p>
      {err && <p role="alert" style={{ color: "var(--off)" }}>{err}</p>}
      {!err && !v && <p className="muted">Loading…</p>}
      {v && (
        <div role="region" aria-labelledby="wk" tabIndex={0} style={{ overflowX: "auto" }}>
          <table className="num" style={{ width: "100%", borderCollapse: "collapse", fontSize: 16 }}>
            <caption id="wk" className="sr">Patching minutes per day</caption>
            <thead><tr style={{ textAlign: "right", color: "var(--ink-muted)" }}>
              <th style={{ textAlign: "left", padding: "8px 0" }}>Day</th><th>Seen by the camera</th><th>Added by you</th><th>Prescribed</th></tr></thead>
            <tbody>{days.map((d) => (
              <tr key={d} style={{ borderTop: "1px solid var(--line)", textAlign: "right" }}>
                <td style={{ textAlign: "left", padding: "10px 0" }}>{new Date(d + "T12:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td style={{ color: "var(--data-patch)", fontWeight: 600 }}>{Math.floor((by[d]?.verifiedSec ?? 0) / 60)}</td>
                <td>{Math.floor((by[d]?.attestedSec ?? 0) / 60)}</td>
                <td className="muted">{v.prescribedMin}</td>
              </tr>))}</tbody>
            <tfoot><tr style={{ borderTop: "2px solid var(--line-input)", textAlign: "right", fontWeight: 600 }}>
              <td style={{ textAlign: "left", padding: "10px 0" }}>Week</td><td>{Math.floor(total("verifiedSec"))}</td><td>{Math.floor(total("attestedSec"))}</td><td className="muted">{v.prescribedMin * 7}</td></tr></tfoot>
          </table>
        </div>
      )}
      {v && v.days.length === 0 && <p className="muted">No sessions yet. Minutes appear here once the phone has checked a show.</p>}
      <p style={{ marginTop: 24 }}><a href={`/check?code=${code}`}>Back to the phone check</a></p>
    </main>
  );
}
