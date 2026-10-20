# Architecture

Two clients and one small API. Camera frames never leave the phone.

```
 Phone (web, /check)                    Vercel (web/)                      Fire TV (tv/, Vega app)
 camera -> MediaPipe face landmarks     POST /api/session      <-------    create pair code
        -> crop prescribed eye          GET  /api/session/:code <------    poll every 1 s: playable?
        -> image embedding (on device)  POST /api/session/:code/flag       play / pause the video
        -> nearest-neighbour vote  ---> {on, cls, conf, sentAt}            show minutes vs prescription
                                        store: Upstash Redis (prod), memory (dev)
```

| Component | Why it exists (requirement) | Choice | Fallback |
|---|---|---|---|
| Fire TV app | the track requires a Fire TV app (Fire OS or Vega) | React Native for Vega, Vega SDK 0.24, run on the Vega Virtual Device | web `/tv` with the same rules, labelled as a preview |
| Phone check | the patch has to be seen, and the child is already in front of a phone's camera | browser page, getUserMedia, `@mediapipe/tasks-vision` Face Landmarker + Image Embedder, models self-hosted in `web/public/models` | none: no flag means the TV pauses |
| Classifier | patches differ by child; a fixed rule cannot tell a patch from a hand | per-child calibration, k-nearest-neighbour (cosine) over embeddings, held-out precision/recall | low agreement counts as off |
| API | phone and TV are separate devices | Next.js route handlers on Vercel | TV polling tolerates misses; stale = pause |
| Store | state shared across serverless invocations | Upstash Redis (REST); in-memory in dev and tests | none in prod |

Rules live in one pure module, `web/lib/rules.ts` (playable, minute accounting), shared by tests; the Vega app reads `playable` from the API rather than re-deciding it.

Not built: accounts, push sockets (1 s polling is enough for a ~3 s pause target), queues, a database beyond Redis.
