PATCH HOURS for Fire TV (Vega OS): ready to run
================================================

The show plays only while the eye patch is on. A Fire TV app and a phone check for children
patching for amblyopia (lazy eye). Source: https://github.com/itssaharsh/patch-hours
Video: https://youtu.be/g5KP7FcY02Q


QUICKEST (no install, any browser)
  Open https://patch-hours.vercel.app and press "Run the scripted check", then click the TV picture.


ON THE VEGA VIRTUAL DEVICE (macOS or Ubuntu; on Windows use WSL2 Ubuntu)
  1. Unzip, open a terminal in this folder and run:

       ./run.sh

     It checks the machine (Vega SDK, /dev/kvm, libpulse0 on Linux) and prints the fix for anything
     missing, starts the virtual device, then installs and opens Patch Hours. The TV shows a pairing code.

  2. Pair a phone, or let the script be the phone:

       ./run.sh phone CODE

     It sends what a phone sends, for 60 seconds: patch on (the show plays), patch off (it pauses),
     a hand over the eye (still paused), patch on (it resumes). The TV marks it "Scripted run".

  3. Minutes counted, and the note for the eye clinic: https://patch-hours.vercel.app/week?code=CODE

  The app uses the live Patch Hours service (kept up until judging ends). In the virtual device the
  cartoon plays without sound: its audio clock stalls under WSL2 (FRICTION_LOG.md, item 11).


ON A FIRE TV DEVICE IN DEVELOPER MODE (not tested on hardware)
    vega device list
    vega run-app tv/patchhours_armv7.vpkg com.patchhours.tv.main -d <serial>
  (use tv/patchhours_aarch64.vpkg on a 64-bit device)


WHAT'S IN HERE
  run.sh                      the script above
  tv/patchhours_x86_64.vpkg   release build for the virtual device on Intel/AMD
  tv/patchhours_aarch64.vpkg  release build for arm64 (Apple silicon virtual device, 64-bit Fire TV)
  tv/patchhours_armv7.vpkg    release build for 32-bit Fire TV devices
  Built with Vega SDK 0.24.12112.
