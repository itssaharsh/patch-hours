"use client";
import { useEffect, useState } from "react";
import { today } from "@/lib/client";
import type { SessionView } from "@/lib/types";

interface Note {
  note: string; cheer: string; source: "nova" | "template"; model?: string; voiceUrl?: string; cached?: boolean;
  checks: { numbers: string; guardrail: string; why?: string };
}

export function WeekApp() {
  const [v, setV] = useState<SessionView | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteErr, setNoteErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [days, setDays] = useState<string[]>([]);
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("code")?.toUpperCase() ?? "";
    setCode(c);
    setDays(Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return today(d); }));
    if (!c) { setErr("Open this page from the phone check, or add ?code= with the TV code."); return; }
    fetch(`/api/session/${c}?day=${today()}`)
      .then(async (r) => r.ok ? setV(await r.json()) : setErr(r.status === 404 ? "That TV code isn't known. Open this page from the phone check." : "Couldn't load this TV's minutes."))
      .catch(() => setErr("Couldn't reach Patch Hours. Check the connection and reload."));
    fetch(`/api/session/${c}/report`).then(async (r) => { if (r.ok) setNote(await r.json()); }).catch(() => {});
  }, []);
  async function writeNote() {
    setNoteBusy(true); setNoteErr(""); setCopied(false);
    try {
      const r = await fetch(`/api/session/${code}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: today() }) });
      if (!r.ok) throw new Error(String(r.status));
      setNote(await r.json());
    } catch {
      setNoteErr("Couldn't write the note just now. Try again in a minute.");
    } finally {
      setNoteBusy(false);
    }
  }
  const by = Object.fromEntries((v?.days ?? []).map((d) => [d.day, d]));
  const total = (k: "verifiedSec" | "attestedSec") => days.reduce((n, d) => n + (by[d]?.[k] ?? 0), 0) / 60;
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px" }}>
      <p className="display" style={{ color: "var(--accent)", fontSize: 24, margin: 0 }}>Patch Hours</p>
      <h1 style={{ fontSize: 40, margin: "8px 0 4px" }}>Minutes this week</h1>
      <p className="muted" style={{ marginTop: 0 }}>{code && <>TV {code}. </>}The camera&apos;s minutes and the minutes you added are kept apart, so the clinic sees both.</p>
      {v?.simulated && <p role="note" style={{ color: "var(--accent)" }}>Some of these minutes came from the scripted run on the home page, not from a camera.</p>}
      {err && <p role="alert" style={{ color: "var(--off)" }}>{err}</p>}
      {!err && !v && <p className="muted">Loading…</p>}
      {v && (
        <div role="region" aria-labelledby="wk" tabIndex={0} style={{ overflowX: "auto" }}>
          <table className="num" style={{ width: "100%", borderCollapse: "collapse", fontSize: 16 }}>
            <caption id="wk" className="sr">Patching minutes per day</caption>
            <thead><tr style={{ textAlign: "right", color: "var(--ink-muted)" }}>
              <th style={{ textAlign: "left", padding: "8px 0" }}>Day</th><th>Seen by the camera (min)</th><th>Added by you (min)</th><th>Prescribed (min)</th></tr></thead>
            <tbody>{days.map((d) => (
              <tr key={d} style={{ borderTop: "1px solid var(--line)", textAlign: "right" }}>
                <td style={{ textAlign: "left", padding: "10px 0" }}>{new Date(d + "T12:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td style={{ color: "var(--data-patch)", fontWeight: 600 }}>{fmt(by[d]?.verifiedSec ?? 0)}</td>
                <td>{fmt(by[d]?.attestedSec ?? 0)}</td>
                <td className="muted">{v.prescribedMin}</td>
              </tr>))}</tbody>
            <tfoot><tr style={{ borderTop: "2px solid var(--line-input)", textAlign: "right", fontWeight: 600 }}>
              <td style={{ textAlign: "left", padding: "10px 0" }}>Week</td><td>{fmt(total("verifiedSec") * 60)}</td><td>{fmt(total("attestedSec") * 60)}</td><td className="muted">{v.prescribedMin * 7}</td></tr></tfoot>
          </table>
        </div>
      )}
      {v && v.days.length === 0 && <p className="muted">No sessions yet. Minutes appear here once the phone has checked a show.</p>}
      {v && (
        <section aria-labelledby="clinic" style={{ marginTop: 36, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
          <h2 id="clinic" style={{ fontSize: 26, margin: "0 0 4px" }}>Note for the eye clinic</h2>
          <p className="muted" style={{ marginTop: 0 }}>Made from the table above. Amazon Nova phrases it; every number is checked against the table and the text passes a guardrail before you see it. The short cheer is spoken on the web TV the next time the patch goes on.</p>
          <button className="btn" onClick={writeNote} aria-disabled={noteBusy} disabled={noteBusy}>{noteBusy ? "Writing…" : note ? "Write it again" : "Write this week's note"}</button>
          {noteErr && <p role="alert" style={{ color: "var(--off)" }}>{noteErr}</p>}
          {note && (
            <div aria-live="polite" style={{ marginTop: 16 }}>
              <p style={{ fontSize: 18, lineHeight: 1.5, margin: "0 0 8px", padding: "12px 16px", background: "var(--surface-1)", borderRadius: 12 }}>{note.note}</p>
              <button className="btn tonal" onClick={() => navigator.clipboard?.writeText(note.note).then(() => setCopied(true)).catch(() => {})}>{copied ? "Copied" : "Copy the note"}</button>
              <p style={{ margin: "16px 0 4px" }}>For your child: <strong>&ldquo;{note.cheer}&rdquo;</strong></p>
              {note.voiceUrl && <audio controls src={note.voiceUrl} style={{ width: "100%", maxWidth: 360 }} aria-label="The cheer, spoken" />}
              <p className="muted" style={{ fontSize: 14 }}>{provenance(note)}</p>
            </div>
          )}
        </section>
      )}
      {code && <p style={{ marginTop: 24 }}><a href={`/check?code=${code}`}>Back to the phone check</a></p>}
    </main>
  );
}

function provenance(n: Note) {
  const voice = n.voiceUrl ? " Voice: Amazon Polly." : "";
  if (n.source === "nova") return `Phrased by Amazon Nova 2 Lite (served by Amazon Bedrock). Numbers checked against the table; Bedrock guardrail ${n.checks.guardrail === "passed" ? "passed" : "not configured"}.${voice}`;
  const why = n.checks.guardrail === "intervened" ? "the guardrail stopped Nova's wording"
    : n.checks.numbers === "failed" ? "Nova's wording didn't pass the number check or the model was unavailable"
    : "the AWS services aren't configured here";
  return `Plain template, because ${why}.${voice}`;
}

// Minutes; under ten minutes shown as m:ss so a short session is visible.
function fmt(sec: number) {
  const s = Math.floor(sec);
  if (s >= 600) return String(Math.floor(s / 60));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
