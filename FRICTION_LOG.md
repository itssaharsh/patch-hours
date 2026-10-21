# Friction log: Vega SDK 0.24 and the Vega Virtual Device

Built on Ubuntu 24.04 under WSL2 (Windows 11), 16 cores, 7.7 GB RAM, SDK 0.24.12112, Vega CLI 1.4.5, 20 to 21 October 2026. Entries are in the order we hit them.
Each entry: task · steps · expected vs actual · severity · workaround · suggestion.

## 1. The virtual device times out with no error on the console
- **Task:** start the Vega Virtual Device after a clean install.
- **Steps:** `NONINTERACTIVE=true bash get_vvm.sh`, then `vega virtual-device start`.
- **Expected:** the device boots, or the CLI says why not.
- **Actual:** "Deadline reached (120s) but virtual device unresponsive." The cause was only in `vvd/instances/<id>/virtual_device.err`: `libpulse.so.0: cannot open shared object file`.
- **Severity:** high (blocks every no-device builder on a fresh Ubuntu).
- **Workaround:** `sudo apt-get install -y libpulse0`.
- **Suggestion:** have the installer check `ldd` on the emulator binary, or have `virtual-device start` print the last line of `virtual_device.err` on timeout.

## 2. KVM permission is not checked
- **Task:** same.
- **Expected:** a message that the user is not in the `kvm` group.
- **Actual:** nothing; the boot just times out.
- **Severity:** medium.
- **Workaround:** `sudo usermod -aG kvm $USER && sudo chmod 666 /dev/kvm`.
- **Suggestion:** test `/dev/kvm` access before launching QEMU.

## 3. WSL2 works, but the docs say it is untested
- **Task:** decide whether a Windows laptop can build for Fire TV.
- **Actual:** with `/dev/kvm` exposed by WSL2 and WSLg for the window, the device booted and ran our app. The install page only says Windows and WSL "haven't been tested".
- **Severity:** low.
- **Suggestion:** a short "known to work on WSL2 with these two packages" note would save Windows users a day of doubt.

## 4. Video fails with MEDIA_ERR 4 and no message for a plain-HTTP source
- **Task:** play an MP4 from the dev server (`http://10.0.2.2:3107/bunny.mp4`) with the `Video` component of `@amazon-devices/react-native-w3cmedia`.
- **Expected:** playback, or an error that names the cause (cleartext HTTP).
- **Actual:** `error` event, `error.code` 4, `error.message` empty. `curl` from the device to the same URL returned 200. An HTTPS URL to the same file played.
- **Severity:** high (looks like a codec problem; cost an hour).
- **Workaround:** serve media over HTTPS.
- **Suggestion:** put the reason in `MediaError.message`, and say in the README that sources must be HTTPS.

## 5. The README's media example is incomplete
- **Task:** play one URL.
- **Actual:** the README shows the `ref` but no complete URL example, and the manifest services are listed on the web page but not with a full working `manifest.toml`.
- **Severity:** medium.
- **Suggestion:** one runnable "play this MP4 URL" sample with its `manifest.toml`.

## 6. Playback stutters at 480p High profile on the default 4 cores
- **Task:** play an 854×480 H.264 High-profile clip.
- **Actual:** the player clock advanced about 1 s per 10 s of wall time.
- **Severity:** medium (a demo on the simulator looks broken).
- **Workaround:** re-encode to 640×360 Baseline 24 fps and set `hw.cpu.ncore = 8` in the instance `config.ini`; the clock then advanced in real time.
- **Suggestion:** document the simulator's decode limits and a CLI flag for cores.

## 7. `journalctl` is refused in the device shell; `loggingctl` rejects relative times
- **Task:** read the app's logs.
- **Actual:** `vega device run-cmd -c 'journalctl …'` prints a notice to use `loggingctl`; `loggingctl log -S "-3min"` fails with "unexpected argument '-3'".
- **Severity:** low.
- **Workaround:** `loggingctl log -v <package id>`.
- **Suggestion:** accept relative times, or show an example time format in `--help`.

## 8. The UI is 960×540 dp, not 1920×1080
- **Task:** lay out a 10-foot UI.
- **Actual:** sizes written for 1920×1080 rendered twice as large (density 320).
- **Severity:** low.
- **Suggestion:** say the logical size near the top of the layout guide.

## 9. The video was playing but never visible
- **Task:** show the reward video under the app's UI.
- **Steps:** a `Video` component inside a `View` with a dark background colour; dim it with `opacity` when paused.
- **Expected:** frames on screen; dimming works.
- **Actual:** the player fired `playing` and its clock advanced, but the area stayed black, also in the emulator's own screenshot. The video draws on a plane under the UI, so any opaque background over it hides it, and `opacity` on `Video` does nothing.
- **Severity:** high (cost two hours; looks like a decode failure).
- **Workaround:** keep every view over the video transparent, paint the page colour around the video window in separate views, and dim with a semi-transparent scrim view on top.
- **Suggestion:** one sentence in the `Video` README: "video renders below the React Native layer; keep views above it transparent".

## 10. No screenshot command for the virtual device
- **Task:** take stills and a recording for the submission.
- **Actual:** an X11 grab of the window shows the UI but not the video plane; `vega device` has no screenshot command.
- **Severity:** low.
- **Workaround:** the emulator console on port 5554 (`auth <token>`, then `screenrecord screenshot <dir>` or `screenrecord start <file>.webm`) captures the composed screen, video included.
- **Suggestion:** wrap it as `vega device screenshot` and `vega device screenrecord`.

## 11. Playback freezes at about 6 s because the audio clock stops
- **Task:** play a clip with sound on the virtual device under WSL2.
- **Actual:** the player reports `playing`, but `currentTime` stops near 6 s. The device log shows `leaudiosink … audioPositionDiff 0` (the audio position never advances), and the video queue starves at 0–4%.
- **Severity:** high (the reward video looks frozen in every demo).
- **Workaround:** for the simulator, serve a copy of the clip with no audio track (`ffmpeg -c:v copy -an`); the clock then advances in real time, pauses and resumes. A physical Fire TV is not affected as far as we know.
- **Suggestion:** fall back to the system clock when the audio sink stops advancing, or log a clear "audio output stalled" error.

## 12. After a WSL restart the device dies at boot, again with only the deadline message
- **Task:** start the virtual device the next day.
- **Steps:** `vega virtual-device start`.
- **Expected:** the device boots, or the CLI says why not.
- **Actual:** "Deadline reached (60s) but virtual device unresponsive." `virtual_device.err` had `libc++abi: terminating due to uncaught exception of type std::__1::__fs::filesystem::filesystem_error: filesystem error: in create_directories: Permission denied ["/run/user/1000"]`. `XDG_RUNTIME_DIR` still pointed at `/run/user/1000/`, which WSL had not recreated.
- **Severity:** high (same silent timeout as entry 1; looks like the earlier fixes stopped working).
- **Workaround:** `export XDG_RUNTIME_DIR=/mnt/wslg/runtime-dir`, then start again.
- **Suggestion:** fall back to a temporary runtime directory, or print the emulator's last fatal line when the deadline passes.

## 13. Console capture fails silently in small ways
- **Task:** script screenshots and recordings through the emulator console (entry 10).
- **Actual:** `screenrecord screenshot <dir>` replies `OK` and writes nothing when `<dir>` doesn't exist; relative paths resolve against the directory the device was started from; a path with a space is split into two arguments; `hw.cpu.ncore = 8` is quietly lowered to 6 ("Emualtor does not support more than 6 cores", only in `virtual_device.err`).
- **Severity:** low.
- **Suggestion:** reply `KO` when nothing was written, and document the 6-core cap next to the `config.ini` settings.

## 14. A second media player froze the app, and only the crash history said so
- **Task:** speak "Patch back on, and your show comes back!" from an MP3 when the show pauses, for children too young to read.
- **Steps:** mount the `Audio` component of `@amazon-devices/react-native-w3cmedia` next to the `Video` component; set `src` and call `play()` on pause.
- **Expected:** the clip plays, or an error event.
- **Actual:** on the virtual device under WSL2 the speakers gave short "ting" sounds a couple of seconds apart, and within a minute the app vanished back to "Your apps", sometimes before any clip had played. The app's log was empty. `vlcm crash-history` (run with `vega device run-cmd`) had the reason: `LCM_KILLREASON: AppNotResponding`, `LCM_ANR_THREAD_NAME: JSReactThread`.
- **Severity:** high (the app silently disappears; nothing in the CLI output).
- **Workaround:** no `Audio` player in the Vega app; the prompt stays on screen there, and the web TV says it aloud.
- **Suggestion:** surface ANR kills in `vega run-app` / the CLI, mention `vlcm crash-history` in the debugging docs, and keep a stalled audio sink from blocking the JS thread.

We packaged the checks from entries 1, 2, 6 and 12 and the capture workaround from entries 10 and 13 as an open-source tool for other Vega builders: [vvd-kit](https://github.com/itssaharsh/vvd-kit) (`npx github:itssaharsh/vvd-kit doctor`).
