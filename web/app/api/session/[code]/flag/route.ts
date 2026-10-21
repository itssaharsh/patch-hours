import { applyHeartbeat, MIN_HEARTBEAT_MS, parseHeartbeat, view } from "@/lib/rules";
import { Conflict, store } from "@/lib/store";
import { codeOk, err, json, preflight } from "@/lib/api";

export const OPTIONS = preflight;

class TooFast extends Error {}

export async function POST(req: Request, ctx: RouteContext<"/api/session/[code]/flag">) {
  const code = (await ctx.params).code.toUpperCase();
  if (!codeOk(code)) return err(400, "bad code");
  const raw = await req.text();
  if (raw.length > 512) return err(413, "heartbeat too large: only a flag is accepted");
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return err(400, "json body required"); }
  const hb = parseHeartbeat(body);
  if (!hb) return err(400, "heartbeat must be {on, cls, conf, day, lagMs?}");
  let now = 0;
  try {
    const next = await store().mutate(code, (s) => {
      now = Date.now();
      if (s.lastSeen && now - s.lastSeen < MIN_HEARTBEAT_MS) throw new TooFast();
      return applyHeartbeat(s, hb, now);
    });
    if (!next) return err(404, "unknown code");
    return json(view(next, now, hb.day));
  } catch (e) {
    if (e instanceof TooFast) return err(429, "too many heartbeats");
    if (e instanceof Conflict) return err(409, "busy, send the next heartbeat");
    throw e;
  }
}
