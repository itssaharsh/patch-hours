import { ai } from "@/lib/aws";
import { store } from "@/lib/store";
import { codeOk, err } from "@/lib/api";

/** The spoken cheer (an Amazon Polly MP3 kept in a private S3 bucket), served from this app for the TV and the week sheet. */
export async function GET(_req: Request, ctx: RouteContext<"/api/session/[code]/voice">) {
  const code = (await ctx.params).code.toUpperCase();
  if (!codeOk(code)) return err(400, "bad code");
  const s = await store().get(code);
  const a = ai();
  if (!s?.report?.voiceKey || !a) return err(404, "no cheer yet");
  try {
    const mp3 = await a.getVoice(s.report.voiceKey);
    return new Response(Buffer.from(mp3), {
      headers: { "Content-Type": "audio/mpeg", "Content-Length": String(mp3.length), "Cache-Control": "private, max-age=3600", "Access-Control-Allow-Origin": "*" },
    });
  } catch {
    return err(404, "cheer not available");
  }
}
