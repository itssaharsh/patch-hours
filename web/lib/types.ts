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
}

export interface SessionView extends Omit<Session, "days" | "v" | "inherited"> {
  playable: boolean;
  stale: boolean; // a phone was seen, but not in the last STALE_MS
  paired: boolean; // any heartbeat ever
  serverNow: number;
  today: DayTotals & { day: string };
  days: Array<DayTotals & { day: string }>;
}
