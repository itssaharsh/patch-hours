import { inherit, isCode, view } from "@/lib/rules";
import { Conflict, store } from "@/lib/store";
import { codeOk, dayFrom, err, json, preflight } from "@/lib/api";

export const OPTIONS = preflight;

// The phone pairs with a new TV code (a TV restart makes one) and carries over the earlier code's minutes.
export async function POST(req: Request, ctx: RouteContext<"/api/session/[code]/inherit">) {
  const code = (await ctx.params).code.toUpperCase();
  if (!codeOk(code)) return err(400, "bad code");
  let b: { from?: string };
  try { b = await req.json(); } catch { return err(400, "json body required"); }
  const fromCode = String(b?.from ?? "").toUpperCase();
  if (!isCode(fromCode) || fromCode === code) return err(400, "from must be another pairing code");
  const from = await store().get(fromCode);
  if (!from) return err(404, "earlier code not found");
  try {
    const next = await store().mutate(code, (s) => inherit(s, from));
    if (!next) return err(404, "unknown code");
    return json(view(next, Date.now(), dayFrom(req)));
  } catch (e) {
    if (e instanceof Conflict) return err(409, "busy, try again");
    throw e;
  }
}
