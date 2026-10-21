import { attest, view } from "@/lib/rules";
import { Conflict, store } from "@/lib/store";
import { codeOk, err, json, preflight } from "@/lib/api";

export const OPTIONS = preflight;

export async function POST(req: Request, ctx: RouteContext<"/api/session/[code]/attest">) {
  const code = (await ctx.params).code.toUpperCase();
  if (!codeOk(code)) return err(400, "bad code");
  let b: { day?: string; minutes?: number };
  try { b = await req.json(); } catch { return err(400, "json body required"); }
  if (!b || typeof b !== "object") return err(400, "json object required");
  try {
    const next = await store().mutate(code, (s) => attest(s, String(b.day), Number(b.minutes)));
    if (!next) return err(404, "unknown code");
    return json(view(next, Date.now(), String(b.day)));
  } catch (e) {
    if (e instanceof Conflict) return err(409, "busy, try again");
    return err(400, "minutes must be 1 to 240 and day a date within two days of today");
  }
}
