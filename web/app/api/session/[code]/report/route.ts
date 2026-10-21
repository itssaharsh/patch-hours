import { isRecentDay } from "@/lib/rules";
import { factsKey, weekFacts } from "@/lib/report";
import { makeReport, publicReport } from "@/lib/note";
import { Conflict, store } from "@/lib/store";
import { codeOk, err, json, preflight } from "@/lib/api";

export const OPTIONS = preflight;
export const maxDuration = 30;

const MIN_GAP_MS = 60_000; // at most one new note a minute per TV, and none while the week is unchanged

/** The latest note, without making a new one. */
export async function GET(_req: Request, ctx: RouteContext<"/api/session/[code]/report">) {
  const code = (await ctx.params).code.toUpperCase();
  if (!codeOk(code)) return err(400, "bad code");
  const s = await store().get(code);
  if (!s) return err(404, "unknown code");
  if (!s.report) return err(404, "no note yet");
  return json(publicReport(code, s.report));
}

/** Makes this week's note (body: {"to": "YYYY-MM-DD"}, the phone's today), or returns the current one if nothing changed. */
export async function POST(req: Request, ctx: RouteContext<"/api/session/[code]/report">) {
  const code = (await ctx.params).code.toUpperCase();
  if (!codeOk(code)) return err(400, "bad code");
  let b: { to?: string };
  try { b = await req.json(); } catch { return err(400, "json body required"); }
  const to = String(b?.to ?? "");
  if (!isRecentDay(to)) return err(400, "to must be today's date");
  const s = await store().get(code);
  if (!s) return err(404, "unknown code");
  const prev = s.report;
  const now = Date.now();
  if (prev && prev.to === to && (prev.factsKey === factsKey(weekFacts(s, to)) || now - prev.at < MIN_GAP_MS)) {
    return json({ ...publicReport(code, prev), cached: true });
  }
  const report = await makeReport(s, to, now);
  try {
    await store().mutate(code, (cur) => ({ ...cur, report }));
  } catch (e) {
    if (!(e instanceof Conflict)) throw e; // heartbeats are busy; the note is still returned
  }
  return json(publicReport(code, report));
}
