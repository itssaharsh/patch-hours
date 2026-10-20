import { describe, expect, it } from "vitest";
import { applyHeartbeat, attest, isCode, isPlayable, newCode, newSession, parseHeartbeat, view, STALE_MS } from "./rules";

const day = "2026-10-21";
const on = { on: true, cls: "patch" as const, conf: 1, day };
const off = { on: false, cls: "bare" as const, conf: 1, day };

describe("pairing codes", () => {
  it("are six unambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(isCode(newCode())).toBe(true);
    expect(isCode("ABC10O")).toBe(false);
  });
});

describe("playable (AC-2, AC-3)", () => {
  it("is false before any heartbeat", () => {
    expect(isPlayable(newSession("AAAAAA", 0), 0)).toBe(false);
  });
  it("is true right after an on heartbeat and false once it goes stale", () => {
    const s = applyHeartbeat(newSession("AAAAAA", 0), on, 1000);
    expect(isPlayable(s, 1000 + STALE_MS)).toBe(true);
    expect(isPlayable(s, 1001 + STALE_MS)).toBe(false);
    expect(view(s, 1001 + STALE_MS, day).stale).toBe(true);
  });
  it("is false after an off heartbeat", () => {
    let s = applyHeartbeat(newSession("AAAAAA", 0), on, 1000);
    s = applyHeartbeat(s, off, 2000);
    expect(isPlayable(s, 2000)).toBe(false);
  });
});

describe("minute accounting (AC-4)", () => {
  it("counts gaps between on heartbeats up to 5 s", () => {
    let s = newSession("AAAAAA", 0);
    s = applyHeartbeat(s, on, 1000);
    s = applyHeartbeat(s, on, 2000);
    s = applyHeartbeat(s, on, 6000);
    expect(s.days[day].verifiedSec).toBe(5);
  });
  it("never counts a gap longer than 5 s, or time after an off", () => {
    let s = newSession("AAAAAA", 0);
    s = applyHeartbeat(s, on, 1000);
    s = applyHeartbeat(s, on, 7001);
    s = applyHeartbeat(s, off, 8000);
    s = applyHeartbeat(s, on, 9000);
    expect(s.days[day].verifiedSec).toBe(0);
  });
  it("keeps attested minutes apart from verified ones", () => {
    let s = applyHeartbeat(newSession("AAAAAA", 0), on, 1000);
    s = attest(s, day, 20);
    expect(s.days[day]).toEqual({ verifiedSec: 0, attestedSec: 1200 });
    expect(() => attest(s, day, 0)).toThrow();
  });
  it("records when the flag changed, corrected by the phone's lag", () => {
    let s = applyHeartbeat(newSession("AAAAAA", 0), on, 1000);
    s = applyHeartbeat(s, { ...off, lagMs: 300 }, 5000);
    expect(s.changedAt).toBe(4700);
  });
});

describe("heartbeat validation (AC-8)", () => {
  it("accepts the flag shape only", () => {
    expect(parseHeartbeat(on)).toEqual({ ...on, lagMs: undefined });
    expect(parseHeartbeat({ ...on, image: "data:image/png;base64,AAAA" })).toBeNull();
    expect(parseHeartbeat({ ...on, cls: "bare" })).toBeNull();
    expect(parseHeartbeat({ ...on, conf: 2 })).toBeNull();
    expect(parseHeartbeat({ ...on, day: "today" })).toBeNull();
  });
});
