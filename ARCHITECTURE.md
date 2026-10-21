# Architecture

Two clients and one small API. Camera frames never leave the phone.

```
 Phone (web, /check)                    Vercel (web/)                      Fire TV (tv/, Vega app)
 camera -> MediaPipe face landmarks     POST /api/session      <-------    create pair code
        -> crop prescribed eye          GET  /api/session/:code <------    poll every 1 s: playable?
        -> image embedding (on device)  POST /api/session/:code/flag       play / pause the video
        -> nearest-neighbour vote  ---> {on, cls, conf, day, lagMs}            show minutes vs prescription
                                        store: Neon Postgres (prod), memory (dev)
```

| Component | Why it exists (requirement) | Choice | Fallback |
|---|---|---|---|
| Fire TV app | the track requires a Fire TV app (Fire OS or Vega) | React Native for Vega, Vega SDK 0.24, run on the Vega Virtual Device | web `/tv` with the same rules, labelled as a preview |
| Phone check | the patch has to be seen, and the child is already in front of a phone's camera | browser page, getUserMedia, `@mediapipe/tasks-vision` Face Landmarker + Image Embedder, models self-hosted in `web/public/mediapipe` | none: no flag means the TV pauses |
| Classifier | patches differ by child; a fixed rule cannot tell a patch from a hand | per-child calibration, k-nearest-neighbour (cosine) over embeddings, held-out precision/recall | low agreement counts as off |
| API | phone and TV are separate devices | Next.js route handlers on Vercel | TV polling tolerates misses; stale = pause |
| Store | state shared across serverless invocations | Neon Postgres (one jsonb row per code); in-memory in dev and tests | none in prod |
| Week note | a note for the eye clinic and a cheer for the child, from minute totals | facts by plain code (`web/lib/report.ts`); Amazon Nova 2 Lite phrases them (via Vercel AI Gateway, served by Amazon Bedrock); a number check and Bedrock Guardrails gate the text; Amazon Polly voices it; Amazon S3 keeps the clip (`web/lib/note.ts`, `web/lib/aws.ts`, `aws/patch-hours.yaml`) | plain template if any step fails; the TV never waits on it |

Rules live in one pure module, `web/lib/rules.ts` (playable, minute accounting), shared by tests; the Vega app reads `playable` from the API rather than re-deciding it.

Not built: accounts, push sockets (1 s polling is enough for a ~3 s pause target), queues, a second database.
