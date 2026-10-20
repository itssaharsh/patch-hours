import { newCode, newSession, view } from "@/lib/rules";
import { store } from "@/lib/store";
import { dayFrom, err, json, preflight } from "@/lib/api";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  let body: { prescribedMin?: number; eye?: string } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const min = Number(body.prescribedMin ?? 120);
  if (!(min >= 10 && min <= 600)) return err(400, "prescribedMin must be 10 to 600");
  const eye = body.eye === "L" ? "L" : "R";
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    const s = newSession(newCode(), now, Math.round(min), eye);
    if (await store().create(s)) return json(view(s, now, dayFrom(req)), 201);
  }
  return err(503, "could not allocate a code");
}
