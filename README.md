# Patch Hours

**The show plays only while the eye patch is on.** A Fire TV app and a phone check for children patching for amblyopia (lazy eye): the cartoon pauses when the patch comes off, and the minutes the phone saw the patch on are counted.

- **Video (2:43):** https://youtu.be/g5KP7FcY02Q
- **Live:** https://patch-hours.vercel.app (the TV screen in a browser, with a scripted run for judges without a phone)
- **Phone check:** https://patch-hours.vercel.app/check
- **Fire TV app, ready to run:** `patch-hours-fire-tv.zip` from [Releases](https://github.com/itssaharsh/patch-hours/releases): `./run.sh` installs and opens it on the Vega Virtual Device, `./run.sh phone CODE` stands in for the phone

| Patch on: the show plays | Patch off: the show pauses |
|---|---|
| ![Playing on the Vega Virtual Device](docs/img/vega-playing.png) | ![Paused on the Vega Virtual Device](docs/img/vega-paused.png) |

## Why

About half of the patching prescribed to children is never worn. In 152 children whose patching was measured by an occlusion dose monitor, mean compliance was 44% and on 42% of days no patch was worn at all ([Wallace et al., IOVS 2013](https://openaccess.city.ac.uk/id/eprint/2796)). A 2026 review puts adherence at 40 to 60% by week 6 and about 30% by week 12 ([OEPF](https://www.oepf.org/wp-content/uploads/2026/07/OVP-14-2-Chow-Final-New-Newest.pdf)). Families keep diaries from memory. The TV is already the child's reward.

## How it works

1. **The TV shows a pairing code.** The parent scans it with their phone.
2. **The phone learns this patch.** The parent captures a few seconds of "patch on", "no patch" and "hand over the eye"; the phone trains a nearest-neighbour model on the eye crop, on the phone, and shows held-out precision and recall.
3. **The TV plays only while the patch is seen.** The phone sends on or off about twice a second. When the patch comes off, or the phone stops reporting, the show pauses with "Patch back on to keep watching"; the TV prints how long the pause took. The web TV also says it aloud, for children too young to read.
4. **Once a week, a note for the eye clinic.** On the week sheet the parent taps "Write this week's note". Plain code totals the minutes; Amazon Nova phrases them as a short note for the orthoptist and a one-line cheer for the child; every number is checked against the table and a Bedrock guardrail screens both texts; Amazon Polly speaks the cheer, which the web TV plays the next time the patch goes on.

Minutes the camera saw are counted apart from minutes the parent adds by hand, so the orthoptist sees both.

## What's real and what's simulated

| Part | Status |
|---|---|
| Fire TV app (Vega SDK 0.24, React Native) on the Vega Virtual Device | real; no physical Fire TV was used |
| Phone check (camera, face landmarks, eye crop, on-device classifier) | real; demo footage uses a synthetic face, not a child |
| Pause and resume, minute counting, week sheet | real, through the deployed API |
| Week note and spoken cheer (AWS) | real and live; added after the video was recorded |
| "Run the scripted check" on the home page, `./run.sh phone CODE` | send the same on/off signals a phone sends, on a script, labelled "Scripted run" on the TV |
| Sound on the virtual device | the cartoon starts with sound; under WSL2 the device's audio stalls, so the app switches to a silent copy and says "Sound off" |
| Reward video | Big Buck Bunny, Blender Foundation, CC BY 3.0 |

Only the on/off flag, a class name, a confidence and timestamps leave the phone: the API rejects any other field and any body over 512 bytes. No pictures are sent or stored. The week note is made from minute totals only.

## Architecture

```
 Phone (/check)                      Vercel (Next.js API + Neon Postgres)          Fire TV (Vega app)
 camera -> face landmarks -> eye crop  POST /api/session/:code/flag  <-- on/off      poll every 1 s
        -> embedding -> kNN vote  ---> GET  /api/session/:code       --> playable?   play / pause the video

 Week sheet  --> POST /api/session/:code/report --> Amazon Nova 2 Lite (served by Amazon Bedrock) -> number check
                                                --> Bedrock Guardrails -> Amazon Polly -> Amazon S3 (private)
```

- `tv/`: Vega app. `src/App.tsx` plays or pauses only when the session's state changes; `src/session.ts` pairs and polls.
- `web/`: the API, the phone check, the web TV preview, the week sheet. Rules live in `web/lib/rules.ts` (when the TV may play, how minutes count), the classifier in `web/lib/knn.ts`, the week note in `web/lib/report.ts` and `web/lib/note.ts`, all unit-tested.
- `aws/patch-hours.yaml`: everything on AWS, in one CloudFormation template.
- `release/`: the ready-to-run zip (`run.sh`, `make-zip.sh`).

Run the checks: `npm --prefix web test` · `npm --prefix tv test`.

## AWS

| Service | What it does here | Code |
|---|---|---|
| Amazon Nova 2 Lite (served by Amazon Bedrock) | Phrases the week's minutes, computed by plain code, as a 2 to 4 sentence note for the orthoptist and a one-line cheer. Any number not in the facts sends it back once, then to a plain template. | `web/lib/aws.ts`, `web/lib/report.ts`, `web/lib/note.ts` |
| Amazon Bedrock Guardrails | `ApplyGuardrail` on both texts before anyone reads or hears them: content filters, a profanity list, and a denied topic for treatment changes ("you can stop patching now" is blocked). | `aws/patch-hours.yaml`, `web/lib/aws.ts` |
| Amazon Polly | Generative voice (Kajal, en-IN) for the cheer, and for the fixed pause prompt (`web/scripts/voice-prompts.mjs`). | `web/lib/aws.ts` |
| Amazon S3 | Private bucket, 30-day expiry, for the cheer clips; the app reads them and serves them itself. | `web/app/api/session/[code]/voice/route.ts` |
| AWS IAM (OIDC federation) and CloudFormation | The app on Vercel trades its own short-lived OIDC token for a role allowed only that model, that guardrail, Polly and one bucket folder. No AWS keys are stored. | `aws/patch-hours.yaml` |

This account's Bedrock model quota is 0 and the increase was declined, so the app reaches Nova 2 Lite through Vercel AI Gateway, which serves it from Amazon Bedrock. With Bedrock model access, `NOTE_VIA=bedrock` calls it directly through the Converse API with the same prompt. A note is made again only when the week's numbers change, at most once a minute per TV.

## Run it yourself

**Try it without building anything:** open https://patch-hours.vercel.app, press **Run the scripted check**, then click the TV picture to start the show. For the real loop, scan the TV's code with a phone and follow the three steps on the phone page (a skin-coloured sticky note over one eye works as a patch). The week sheet and its note: `https://patch-hours.vercel.app/week?code=CODE`.

**Fire TV app without building:** download `patch-hours-fire-tv.zip` from Releases, unzip, run `./run.sh` (macOS or Ubuntu; on Windows inside WSL2). It checks the machine, starts the virtual device, installs and opens the app; `./run.sh phone CODE` then plays a scripted phone against the code on the TV.

**Web app and API** (Node 22):
```bash
cd web
npm install
npm run dev          # http://localhost:3000 — sessions are kept in memory
# optional: set DATABASE_URL (Postgres, e.g. Neon) in web/.env.local to persist sessions
```
The phone page needs the camera, so open it on `localhost` or over HTTPS. Without the AWS settings below, the week note is the plain template and has no voice.

**AWS** (optional, us-east-1):
```bash
aws cloudformation deploy --region us-east-1 --stack-name patch-hours \
  --template-file aws/patch-hours.yaml --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides VercelTeamSlug=<your-team> VercelProject=<your-project>
```
Then set `AWS_ROLE_ARN`, `VOICE_BUCKET`, `GUARDRAIL_ID` and `GUARDRAIL_VERSION` from the stack outputs on the Vercel project (and `NOTE_VIA=bedrock` if your account has Bedrock model access).

**Fire TV app from source** (Vega SDK 0.24, Ubuntu x86_64 or macOS; under WSL2 also `sudo apt-get install libpulse0` and add yourself to the `kvm` group):
```bash
curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash   # Amazon's Vega SDK installer
cd tv
npm install
npm run build:debug
vega virtual-device start
vega run-app build/x86_64-debug/patchhours_x86_64.vpkg
```
The app talks to `https://patch-hours.vercel.app` by default. To use a local web app instead, set `USE_DEV = true` in `tv/src/config.ts` (the virtual device reaches your machine at `10.0.2.2`). If the device won't boot, `npx github:itssaharsh/vvd-kit doctor` names the cause.

## Limits

- An adherence aid for a prescribed patch. It does not treat amblyopia or change a prescription; the guardrail keeps treatment advice out of the generated text.
- Fire TV blocks apps from opening content inside other apps, so the reward plays inside Patch Hours.
- Tested on the Vega Virtual Device only, not on a physical Fire TV.
- The Fire TV app shows the pause prompt as text; only the web TV speaks it. A second media player (`Audio`) froze the app on the virtual device (FRICTION_LOG.md 14).
- The TV app makes a new pairing code each time it starts, so the phone pairs again (and is taught again) after a restart.
- Anyone holding a pairing code can send on/off signals for it; codes are random, six characters, and expire after 30 days.
- The held-out precision and recall come from frames captured in the same session, so they are an upper bound.

Built for the Build, Ship, Shape: Amazon Developer Hackathon. This repository was started on 20 October 2026; nothing in it existed before the event. AI tools used: Claude Code (planning and code). See [FRICTION_LOG.md](FRICTION_LOG.md), [FEEDBACK.md](FEEDBACK.md) and, for other Vega builders, [vvd-kit](https://github.com/itssaharsh/vvd-kit).
