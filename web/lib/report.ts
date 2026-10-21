// The week note for the eye clinic and the child's cheer.
// The numbers are computed here; the model only phrases them, and every number it writes is checked
// against these facts before anyone sees it (a failed check falls back to the plain template).
import type { Session } from "./types";

export interface DayFact { day: string; weekday: string; cameraMin: number; addedMin: number; met: boolean }

export interface WeekFacts {
  from: string;
  to: string;
  prescribedMinPerDay: number;
  prescribedMinWeek: number;
  days: DayFact[];
  cameraMinWeek: number;
  addedMinWeek: number;
  cameraPctOfPrescribed: number;
  daysWithCamera: number;
  daysMet: number;
  simulated: boolean;
}

export interface Texts { note: string; cheer: string }

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The 7 days ending on `to` (YYYY-MM-DD), oldest first. */
export function weekDays(to: string): string[] {
  const t = Date.parse(to + "T12:00:00Z");
  return Array.from({ length: 7 }, (_, i) => new Date(t - (6 - i) * 86400000).toISOString().slice(0, 10));
}

export function weekFacts(s: Session, to: string): WeekFacts {
  const days = weekDays(to).map((day) => {
    const t = s.days[day] ?? { verifiedSec: 0, attestedSec: 0 };
    const cameraMin = Math.round(t.verifiedSec / 60);
    return {
      day, weekday: WEEKDAY[new Date(day + "T12:00:00Z").getUTCDay()],
      cameraMin, addedMin: Math.round(t.attestedSec / 60), met: cameraMin >= s.prescribedMin,
    };
  });
  const cameraMinWeek = days.reduce((n, d) => n + d.cameraMin, 0);
  const prescribedMinWeek = s.prescribedMin * 7;
  return {
    from: days[0].day, to, prescribedMinPerDay: s.prescribedMin, prescribedMinWeek, days,
    cameraMinWeek, addedMinWeek: days.reduce((n, d) => n + d.addedMin, 0),
    cameraPctOfPrescribed: Math.round((100 * cameraMinWeek) / prescribedMinWeek),
    daysWithCamera: days.filter((d) => d.cameraMin >= 1).length,
    daysMet: days.filter((d) => d.met).length,
    simulated: !!s.simulated,
  };
}

/** A short key that changes whenever the facts do, so an unchanged week is never sent to the model twice. */
export function factsKey(f: WeekFacts): string {
  return [f.to, f.prescribedMinPerDay, f.simulated ? 1 : 0, ...f.days.map((d) => `${d.cameraMin}/${d.addedMin}`)].join(",");
}

const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100,
};

/** Every number a text may contain: the facts, day counts up to 7, and the dates' parts. */
export function allowedNumbers(f: WeekFacts): Set<number> {
  const ok = new Set<number>([0, 1, 2, 3, 4, 5, 6, 7, f.prescribedMinPerDay, f.prescribedMinWeek, f.cameraMinWeek,
    f.addedMinWeek, f.cameraPctOfPrescribed, f.daysWithCamera, f.daysMet]);
  for (const d of f.days) {
    ok.add(d.cameraMin); ok.add(d.addedMin);
    for (const p of d.day.split("-")) ok.add(Number(p));
  }
  return ok;
}

/** Numbers in the text (digits and number words) that the facts don't contain. Empty means grounded. */
export function ungrounded(text: string, f: WeekFacts): string[] {
  const ok = allowedNumbers(f);
  const bad: string[] = [];
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const n = Number(m[0].replace(",", ""));
    if (!ok.has(n)) bad.push(m[0]);
  }
  for (const m of text.toLowerCase().matchAll(/\b[a-z]+\b/g)) {
    if (m[0] in WORDS && !ok.has(WORDS[m[0]])) bad.push(m[0]);
  }
  return bad;
}

/** Shape rules on top of the number check: lengths, and a cheer short enough to say to a small child. */
export function checkTexts(t: Texts, f: WeekFacts): string[] {
  const problems = [...ungrounded(t.note, f).map((n) => `note has ${n}`), ...ungrounded(t.cheer, f).map((n) => `cheer has ${n}`)];
  if (t.note.length < 40 || t.note.length > 700) problems.push("note length");
  const words = t.cheer.trim().split(/\s+/).length;
  if (words < 3 || words > 20) problems.push("cheer length");
  return problems;
}

export function templateTexts(f: WeekFacts): Texts {
  const parts = [
    `Week ${f.from} to ${f.to}. Prescribed ${f.prescribedMinPerDay} minutes a day (${f.prescribedMinWeek} for the week).`,
    `The camera saw the patch on for ${f.cameraMinWeek} minutes, ${f.cameraPctOfPrescribed}% of the prescribed time, on ${f.daysWithCamera} of 7 days; the full prescription was met on ${f.daysMet} days.`,
    `The parent added ${f.addedMinWeek} minutes by hand, listed separately.`,
  ];
  if (f.simulated) parts.push("Some minutes came from the scripted demo, not a camera.");
  const cheer = f.daysWithCamera > 0
    ? `You wore your patch on ${f.daysWithCamera} ${f.daysWithCamera === 1 ? "day" : "days"} this week. Super job!`
    : "Let's put the patch on and watch together!";
  return { note: parts.join(" "), cheer };
}

export const SYSTEM_PROMPT = [
  "You write two short texts from a family's eye-patching log. The child is being treated for amblyopia (lazy eye) with an eye patch.",
  "Use only numbers that appear in the data. Write numbers as digits. Use minutes, never hours. Do not round or convert.",
  "Never give treatment advice: do not suggest changing, stopping, shortening or adding patching time.",
  'Reply with JSON only, no code fence: {"note": "...", "cheer": "..."}',
  "note: for the child's orthoptist, 2 to 4 plain sentences. Camera-verified minutes against the prescription, on how many days, the pattern across the week (name the weekdays that were missed or strongest), and that minutes the parent added by hand are listed separately. If simulated is true, say some minutes came from a scripted demo, not a camera.",
  "cheer: one warm sentence of at most 15 words, spoken aloud to a child aged 3 to 7. Praise the effort. No medical words. No numbers above 7.",
].join("\n");

export function userPrompt(f: WeekFacts): string {
  return JSON.stringify({
    week: `${f.from} to ${f.to}`, prescribedMinPerDay: f.prescribedMinPerDay, prescribedMinWeek: f.prescribedMinWeek,
    cameraMinWeek: f.cameraMinWeek, cameraPctOfPrescribed: f.cameraPctOfPrescribed, daysWithCamera: f.daysWithCamera,
    daysMetPrescription: f.daysMet, parentAddedMinWeek: f.addedMinWeek, simulated: f.simulated,
    days: f.days.map((d) => ({ weekday: d.weekday, date: d.day, cameraMin: d.cameraMin, parentAddedMin: d.addedMin })),
  });
}

/** Pulls {"note","cheer"} out of a model reply; tolerates a code fence or text around the JSON. */
export function parseTexts(reply: string): Texts | null {
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    if (typeof o.note === "string" && typeof o.cheer === "string") return { note: o.note.trim(), cheer: o.cheer.trim() };
  } catch { /* fall through */ }
  return null;
}
