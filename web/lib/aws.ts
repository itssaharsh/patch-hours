// AWS for the week note and the child's cheer: Amazon Nova 2 Lite (served by Amazon Bedrock) phrases the note,
// Bedrock Guardrails screens it, Amazon Polly speaks the cheer, Amazon S3 keeps the clip.
// On Vercel the app signs in with its own OIDC token (role in aws/patch-hours.yaml); no AWS keys are stored.
// Nova is reached through Vercel AI Gateway, which serves it from Amazon Bedrock, because this AWS account's
// Bedrock model quota is 0 (the increase was declined). Set NOTE_VIA=bedrock to call Bedrock directly instead.
import { ApplyGuardrailCommand, BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { generateText } from "ai";
import { SYSTEM_PROMPT, parseTexts, userPrompt, type Texts, type WeekFacts } from "./report";

export const MODEL_ID = "us.amazon.nova-2-lite-v1:0"; // Bedrock inference profile (NOTE_VIA=bedrock)
export const GATEWAY_MODEL = "amazon/nova-2-lite"; // the same model through AI Gateway, served by Bedrock
export const VOICE = { VoiceId: "Kajal", Engine: "generative", LanguageCode: "en-IN" } as const;

export interface Ai {
  write(f: WeekFacts): Promise<{ texts: Texts | null; model: string }>;
  /** "passed", "intervened", or "off" when no guardrail is configured. */
  guard(texts: string[]): Promise<"passed" | "intervened" | "off">;
  speak(text: string): Promise<Uint8Array>;
  putVoice(key: string, mp3: Uint8Array): Promise<void>;
  getVoice(key: string): Promise<Uint8Array>;
}

let override: Ai | null | undefined;
/** Tests swap in a fake; `undefined` restores the real one. */
export function setAi(a: Ai | null | undefined) { override = a; }

let real: Ai | null = null;
export function ai(): Ai | null {
  if (override !== undefined) return override;
  if (!process.env.AWS_ROLE_ARN) return null; // local dev and tests: the plain template note, no voice
  return (real ??= awsAi());
}

function awsAi(): Ai {
  const region = process.env.PH_AWS_REGION || "us-east-1"; // AWS_REGION is reserved on Vercel
  const credentials = awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN! });
  const bedrock = new BedrockRuntimeClient({ region, credentials });
  const polly = new PollyClient({ region, credentials });
  const s3 = new S3Client({ region, credentials });
  const bucket = process.env.VOICE_BUCKET!;
  const guardrail = process.env.GUARDRAIL_ID;
  return {
    async write(f) {
      if (process.env.NOTE_VIA !== "bedrock") {
        const r = await generateText({
          model: GATEWAY_MODEL,
          system: SYSTEM_PROMPT,
          prompt: userPrompt(f),
          temperature: 0.2,
          maxOutputTokens: 400,
          providerOptions: { gateway: { only: ["bedrock"] } },
        });
        return { texts: parseTexts(r.text), model: `${GATEWAY_MODEL} (Amazon Bedrock via Vercel AI Gateway)` };
      }
      const r = await bedrock.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [{ role: "user", content: [{ text: userPrompt(f) }] }],
        inferenceConfig: { maxTokens: 400, temperature: 0.2 },
      }));
      const reply = (r.output?.message?.content ?? []).map((c) => c.text ?? "").join("");
      return { texts: parseTexts(reply), model: MODEL_ID };
    },
    async guard(texts) {
      if (!guardrail) return "off";
      const r = await bedrock.send(new ApplyGuardrailCommand({
        guardrailIdentifier: guardrail,
        guardrailVersion: process.env.GUARDRAIL_VERSION || "1",
        source: "OUTPUT",
        content: texts.map((text) => ({ text: { text } })),
      }));
      return r.action === "GUARDRAIL_INTERVENED" ? "intervened" : "passed";
    },
    async speak(text) {
      const r = await polly.send(new SynthesizeSpeechCommand({ Text: text, OutputFormat: "mp3", ...VOICE }));
      if (!r.AudioStream) throw new Error("polly: no audio");
      return r.AudioStream.transformToByteArray();
    },
    async putVoice(key, mp3) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: mp3, ContentType: "audio/mpeg", CacheControl: "private, max-age=86400" }));
    },
    async getVoice(key) {
      const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!r.Body) throw new Error("s3: empty");
      return r.Body.transformToByteArray();
    },
  };
}
