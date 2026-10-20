import { applyHeartbeat, MIN_HEARTBEAT_MS, parseHeartbeat, view } from "@/lib/rules";
import { store } from "@/lib/store";
import { codeOk, err, json, preflight } from "@/lib/api";

export const OPTIONS = preflight;

export async function POST(req: Request, ctx: RouteContext<"/api/session/[code]/flag">) {
  const code = (await ctx.params).code.toUpperCase();
  if (!codeOk(code)) return err(400, "bad code");
  const raw = await req.text();
  if (raw.length > 512) return err(413, "heartbeat too large: only a flag is accepted");
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return err(400, "json body required"); }
  const hb = parseHeartbeat(body);
  if (!hb) return err(400, "heartbeat must be {on, cls, conf, day, lagMs?}");
  const s = await store().get(code);
  if (!s) return err(404, "unknown code");
  const now = Date.now();
  if (s.lastSeen && now - s.lastSeen < MIN_HEARTBEAT_MS) return err(429, "too many heartbeats");
  const next = applyHeartbeat(s, hb, now);
  await store().put(next);
  return json(view(next, now, hb.day));
}
