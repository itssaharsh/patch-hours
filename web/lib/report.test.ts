import { afterEach, describe, expect, it } from "vitest";
import { checkTexts, factsKey, parseTexts, templateTexts, ungrounded, weekFacts } from "./report";
import { makeReport } from "./note";
import { setAi, type Ai } from "./aws";
import { newSession } from "./rules";
import type { Session } from "./types";

const TO = "2026-10-21"; // a Wednesday
function week(): Session {
  const s = newSession("ABCDEF", 0, 120, "R");
  s.days = {
    "2026-10-15": { verifiedSec: 125 * 60, attestedSec: 0 },
    "2026-10-16": { verifiedSec: 90 * 60, attestedSec: 30 * 60 },
    "2026-10-18": { verifiedSec: 40 * 60, attestedSec: 0 },
    "2026-10-21": { verifiedSec: 121 * 60, attestedSec: 0 },
    "2026-10-01": { verifiedSec: 999 * 60, attestedSec: 0 }, // outside the week
  };
  return s;
}

function fake(over: Partial<Ai> = {}): Ai & { spoken: string[]; stored: string[] } {
  const spoken: string[] = [], stored: string[] = [];
  return {
    spoken, stored,
    write: async () => ({ texts: { note: "Prescribed 120 minutes a day. The camera saw 376 minutes, 45% of 840, on 4 of 7 days; Friday and Saturday were missed.", cheer: "You wore your patch on 4 days. Great job!" }, model: "test" }),
    guard: async () => "passed",
    speak: async (t) => { spoken.push(t); return new Uint8Array([1, 2, 3]); },
    putVoice: async (k) => { stored.push(k); },
    getVoice: async () => new Uint8Array([7, 7]),
    ...over,
  };
}

afterEach(() => setAi(undefined));

describe("week facts", () => {
  it("counts only the 7 days ending today, in whole minutes", () => {
    const f = weekFacts(week(), TO);
    expect(f.from).toBe("2026-10-15");
    expect(f.days.map((d) => d.weekday)).toEqual(["Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"]);
    expect(f.cameraMinWeek).toBe(376);
    expect(f.addedMinWeek).toBe(30);
    expect(f.prescribedMinWeek).toBe(840);
    expect(f.cameraPctOfPrescribed).toBe(45);
    expect(f.daysWithCamera).toBe(4);
    expect(f.daysMet).toBe(2);
  });

  it("changes its key when any minute changes", () => {
    const s = week();
    const k = factsKey(weekFacts(s, TO));
    s.days["2026-10-21"].verifiedSec += 60;
    expect(factsKey(weekFacts(s, TO))).not.toBe(k);
  });
});

describe("number check", () => {
  const f = weekFacts(week(), TO);
  it("accepts numbers from the facts and the dates", () => {
    expect(ungrounded("376 minutes of 840 (45%) by 2026-10-21, on four days", f)).toEqual([]);
  });
  it("rejects numbers the model made up, as digits or words", () => {
    expect(ungrounded("about 6.3 hours, 380 minutes", f)).toEqual(["6.3", "380"]);
    expect(ungrounded("fifty minutes extra", f)).toEqual(["fifty"]);
  });
  it("rejects a cheer that is too long", () => {
    expect(checkTexts({ note: templateTexts(f).note, cheer: "word ".repeat(25) }, f)).toContain("cheer length");
  });
  it("reads JSON with or without a code fence", () => {
    expect(parseTexts('```json\n{"note":"a","cheer":"b"}\n```')).toEqual({ note: "a", cheer: "b" });
    expect(parseTexts("no json")).toBeNull();
  });
});

describe("makeReport", () => {
  it("uses Nova's wording when every number checks out and the guardrail passes, and speaks the cheer", async () => {
    const a = fake();
    const r = await makeReport(week(), TO, 1, a);
    expect(r.source).toBe("nova");
    expect(r.checks).toMatchObject({ numbers: "passed", guardrail: "passed" });
    expect(a.spoken).toEqual([r.cheer]);
    expect(r.voiceKey).toMatch(/^voice\/ABCDEF\/[0-9a-f]{16}\.mp3$/);
  });

  it("falls back to the template when the model invents a number twice", async () => {
    let calls = 0;
    const a = fake({ write: async () => { calls++; return { texts: { note: "The camera saw 9 hours this week, which is plenty for now.", cheer: "Great job, superstar!" }, model: "test" }; } });
    const r = await makeReport(week(), TO, 1, a);
    expect(calls).toBe(2);
    expect(r.source).toBe("template");
    expect(r.checks.numbers).toBe("failed");
    expect(r.note).toContain("376 minutes");
  });

  it("falls back to the template when the guardrail intervenes", async () => {
    const r = await makeReport(week(), TO, 1, fake({ guard: async () => "intervened" }));
    expect(r.source).toBe("template");
    expect(r.checks.guardrail).toBe("intervened");
  });

  it("still returns a note when Bedrock or Polly fail", async () => {
    const boom = async () => { const e = new Error("x"); e.name = "ValidationException"; throw e; };
    const r = await makeReport(week(), TO, 1, fake({ write: boom, speak: boom }));
    expect(r.source).toBe("template");
    expect(r.voiceKey).toBeUndefined();
    expect(r.checks.why).toContain("bedrock: ValidationException");
  });

  it("works with no AWS at all", async () => {
    const r = await makeReport(week(), TO, 1, null);
    expect(r).toMatchObject({ source: "template", checks: { guardrail: "off" } });
  });
});
