import { describe, expect, it } from "vitest";
import { POST as create } from "./route";
import { GET as read } from "./[code]/route";
import { POST as flag } from "./[code]/flag/route";

const ctx = (code: string) => ({ params: Promise.resolve({ code }) }) as never;
const day = new Date().toISOString().slice(0, 10);

describe("session API round trip (AC-1..AC-3, AC-8)", () => {
  it("creates a code, accepts a flag, and reports playable", async () => {
    const r = await create(new Request("http://x/api/session", { method: "POST", body: "{}" }));
    expect(r.status).toBe(201);
    const s = await r.json();
    expect(s.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(s.playable).toBe(false);

    const hb = await flag(new Request("http://x", { method: "POST", body: JSON.stringify({ on: true, cls: "patch", conf: 0.9, day }) }), ctx(s.code));
    expect(hb.status).toBe(200);
    const g = await (await read(new Request(`http://x/api/session/${s.code}?day=${day}`), ctx(s.code))).json();
    expect(g.playable).toBe(true);
    expect(g.flag.cls).toBe("patch");
  });

  it("rejects image data and unknown codes", async () => {
    const s = await (await create(new Request("http://x", { method: "POST", body: "{}" }))).json();
    const big = await flag(new Request("http://x", { method: "POST", body: JSON.stringify({ on: false, cls: "bare", conf: 1, day, image: "x".repeat(600) }) }), ctx(s.code));
    expect(big.status).toBe(413);
    const extra = await flag(new Request("http://x", { method: "POST", body: JSON.stringify({ on: false, cls: "bare", conf: 1, day, image: "x" }) }), ctx(s.code));
    expect(extra.status).toBe(400);
    const nf = await read(new Request("http://x"), ctx("ZZZZZZ"));
    expect(nf.status).toBe(404);
  });
});
