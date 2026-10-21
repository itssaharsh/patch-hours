// Makes the fixed spoken prompts the TV plays (web/public/voice/*.mp3) with Amazon Polly.
// Young children can't read "Patch back on to keep watching", so the TV says it.
// Run once with AWS credentials that allow polly:SynthesizeSpeech:  node scripts/voice-prompts.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

export const PROMPTS = {
  "patch-back-on": "Patch back on, and your show comes back!",
};
// Same voice as the week cheer (web/lib/aws.ts).
export const VOICE = { VoiceId: "Kajal", Engine: "generative", LanguageCode: "en-IN" };

const polly = new PollyClient({ region: process.env.AWS_REGION || "us-east-1" });
const out = new URL("../public/voice/", import.meta.url);
await mkdir(out, { recursive: true });
for (const [name, text] of Object.entries(PROMPTS)) {
  const r = await polly.send(new SynthesizeSpeechCommand({ Text: text, OutputFormat: "mp3", ...VOICE }));
  const mp3 = await r.AudioStream.transformToByteArray();
  await writeFile(new URL(`${name}.mp3`, out), mp3);
  console.log(`${name}.mp3  ${mp3.length} bytes  "${text}"`);
}
