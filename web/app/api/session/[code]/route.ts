import { view } from "@/lib/rules";
import { store } from "@/lib/store";
import { codeOk, dayFrom, err, json, preflight } from "@/lib/api";

export const OPTIONS = preflight;

export async function GET(req: Request, ctx: RouteContext<"/api/session/[code]">) {
  const code = (await ctx.params).code.toUpperCase();
  if (!codeOk(code)) return err(400, "bad code");
  const s = await store().get(code);
  if (!s) return err(404, "unknown code");
  return json(view(s, Date.now(), dayFrom(req)));
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/session/[code]">) {
  const code = (await ctx.params).code.toUpperCase();
  if (!codeOk(code)) return err(400, "bad code");
  const s = await store().get(code);
  if (!s) return err(404, "unknown code");
  let b: { prescribedMin?: number; eye?: string };
  try { b = await req.json(); } catch { return err(400, "json body required"); }
  if (!b || typeof b !== "object") return err(400, "json object required");
  if (b.prescribedMin !== undefined) {
    const m = Number(b.prescribedMin);
    if (!(m >= 10 && m <= 600)) return err(400, "prescribedMin must be 10 to 600");
    s.prescribedMin = Math.round(m);
  }
  if (b.eye === "L" || b.eye === "R") s.eye = b.eye;
  await store().put(s);
  return json(view(s, Date.now(), dayFrom(req)));
}
