import { attest, view } from "@/lib/rules";
import { store } from "@/lib/store";
import { codeOk, err, json, preflight } from "@/lib/api";

export const OPTIONS = preflight;

export async function POST(req: Request, ctx: RouteContext<"/api/session/[code]/attest">) {
  const code = (await ctx.params).code.toUpperCase();
  if (!codeOk(code)) return err(400, "bad code");
  let b: { day?: string; minutes?: number };
  try { b = await req.json(); } catch { return err(400, "json body required"); }
  const s = await store().get(code);
  if (!s) return err(404, "unknown code");
  try {
    const next = attest(s, String(b.day), Number(b.minutes));
    await store().put(next);
    return json(view(next, Date.now(), String(b.day)));
  } catch {
    return err(400, "minutes must be 1 to 240 and day YYYY-MM-DD");
  }
}
