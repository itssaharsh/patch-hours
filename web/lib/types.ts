// Shared contract between the phone, the API, the web TV preview and the Vega TV app.
// Only these fields ever leave the phone: no images, no landmarks.

export type PatchClass = "patch" | "bare" | "covered" | "noface";

export interface Heartbeat {
  on: boolean; // true only when the vote says "patch" with enough agreement
  cls: PatchClass;
  conf: number; // 0..1 share of nearest neighbours that agreed
  day: string; // phone's local date, YYYY-MM-DD
  lagMs?: number; // ms since the phone first saw this class (for time-to-pause)
  sim?: boolean; // sent by the scripted run on the home page, not by a camera
}

export interface DayTotals {
  verifiedSec: number; // seen by the camera
  attestedSec: number; // added by the parent, kept apart
}

export interface Session {
  code: string;
  createdAt: number;
  prescribedMin: number;
  eye: "L" | "R";
  flag: { on: boolean; cls: PatchClass; conf: number };
  lastSeen: number; // server ms of the last heartbeat, 0 if none
  changedAt: number; // server ms when flag.on last changed (lag-corrected)
  days: Record<string, DayTotals>;
  v?: number; // version, for safe concurrent updates
  simulated?: boolean; // any heartbeat came from the scripted run
  inherited?: string[]; // earlier codes whose minutes were carried over
  report?: Report; // the latest week note and cheer
}

/** The week note for the eye clinic and the cheer the TV says to the child (see lib/note.ts). */
export interface Report {
  at: number;
  to: string; // last day of the week it covers
  factsKey: string;
  note: string;
  cheer: string;
  source: "nova" | "template";
  model?: string;
  checks: { numbers: "passed" | "failed" | "n/a"; guardrail: "passed" | "intervened" | "off"; why?: string };
  voiceKey?: string; // S3 key of the spoken cheer
}

export interface SessionView extends Omit<Session, "days" | "v" | "inherited" | "report"> {
  playable: boolean;
  stale: boolean; // a phone was seen, but not in the last STALE_MS
  paired: boolean; // any heartbeat ever
  serverNow: number;
  today: DayTotals & { day: string };
  days: Array<DayTotals & { day: string }>;
  cheerAt?: number; // set when a spoken cheer is ready; the TV plays it once
}
