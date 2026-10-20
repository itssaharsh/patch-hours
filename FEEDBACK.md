# Product feedback

| Tool | What it was for | What worked | What needs work | Onboarding | Would build with it again |
|---|---|---|---|---|---|
| Vega SDK 0.24 + CLI | the Fire TV app | `vega project generate`, `npm run build:debug`, `vega run-app` worked first time; React Native 0.83 felt familiar | silent failures on the virtual device (see FRICTION_LOG.md 1, 2, 4) | one script install, about 20 minutes | yes |
| Vega Virtual Device | running the app with no Fire TV | booted under WSL2 once two packages were added; remote control on screen | no screenshot command; slow video decode on 4 cores | needed `libpulse0` and the `kvm` group | yes |
| `@amazon-devices/react-native-w3cmedia` | the reward video | the `Video` component played HTTPS MP4 with standard `play()`/`pause()` and events | empty `MediaError.message`; no complete URL example | README only | yes |
| Vercel | web app, API, hosting the clip | deploy from the CLI in under a minute | build fails on `new Date()` in a client component during prerender (clear message) | already set up | yes |
| Neon (via the Vercel Marketplace) | storing pairing sessions | provisioned from the CLI with env vars pulled | Upstash needed terms accepted in a browser, so we used Neon | one command | yes |
| MediaPipe Tasks Vision | face landmarks and eye-crop embeddings on the phone | runs in the browser with self-hosted models | logs an INFO line as a console error | docs clear | yes |
