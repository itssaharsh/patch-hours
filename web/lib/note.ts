// Makes the week note: plain code computes the facts, Nova phrases them, the number check and the
// guardrail decide whether that phrasing is used, Polly speaks the cheer, S3 keeps the clip.
import { createHash } from "node:crypto";
import { ai, type Ai } from "./aws";
import { checkTexts, factsKey, templateTexts, weekFacts, type Texts } from "./report";
import type { Report, Session } from "./types";

export async function makeReport(s: Session, to: string, now: number, a: Ai | null = ai()): Promise<Report> {
  const f = weekFacts(s, to);
  const base = { at: now, to, factsKey: factsKey(f) };
  const tpl = templateTexts(f);
  if (!a) return { ...base, ...tpl, source: "template", checks: { numbers: "n/a", guardrail: "off", why: "AWS not configured" } };

  let texts: Texts | null = null;
  let model: string | undefined;
  let why: string | undefined;
  for (let i = 0; i < 2 && !texts; i++) {
    try {
      const w = await a.write(f);
      model = w.model;
      const problems = w.texts ? checkTexts(w.texts, f) : ["unreadable reply"];
      if (w.texts && problems.length === 0) texts = w.texts;
      else why = problems.join("; ");
    } catch (e) {
      why = `bedrock: ${(e as Error).name || "error"}`;
      break;
    }
  }
  const report: Report = texts
    ? { ...base, ...texts, source: "nova", model, checks: { numbers: "passed", guardrail: "off" } }
    : { ...base, ...tpl, source: "template", model, checks: { numbers: "failed", guardrail: "off", why } };

  if (report.source === "nova") {
    try {
      report.checks.guardrail = await a.guard([report.note, report.cheer]);
    } catch (e) {
      report.checks.guardrail = "intervened"; // can't screen it, so don't show it
      report.checks.why = `guardrail: ${(e as Error).name || "error"}`;
    }
    if (report.checks.guardrail === "intervened") Object.assign(report, tpl, { source: "template" });
  }

  try {
    const key = `voice/${s.code}/${createHash("sha256").update(report.cheer).digest("hex").slice(0, 16)}.mp3`;
    await a.putVoice(key, await a.speak(report.cheer));
    report.voiceKey = key;
  } catch (e) {
    report.checks.why = [report.checks.why, `voice: ${(e as Error).name || "error"}`].filter(Boolean).join("; ");
  }
  return report;
}

/** What the week sheet shows. The clip is served by this app (app/api/session/[code]/voice), not by a link into S3. */
export function publicReport(code: string, r: Report) {
  const { at, to, note, cheer, source, model, checks } = r;
  return { at, to, note, cheer, source, model, checks, voiceUrl: r.voiceKey ? `/api/session/${code}/voice?at=${at}` : undefined };
}
