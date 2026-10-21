#!/usr/bin/env bash
# Patch Hours for Fire TV, ready to run: installs and opens the app on the Vega Virtual Device,
# then can stand in for the phone so you can watch the show pause and resume without one.
#
#   ./run.sh              check this machine, start the virtual device, install and open the app
#   ./run.sh phone CODE   play a scripted phone for the code on the TV (patch on, off, a hand, on again)
#   ./run.sh check        only the checks
#
# Needs: macOS or Ubuntu x86_64 (on Windows, use WSL2 Ubuntu), the Amazon Vega SDK, curl.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
API="${PATCH_HOURS_API:-https://patch-hours.vercel.app}"
APP_ID="com.patchhours.tv.main"
PATH="$HOME/vega/bin:$PATH"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✖\033[0m %s\n' "$*"; }
die() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo x86_64 ;;
    arm64 | aarch64) echo aarch64 ;;
    *) die "Unsupported CPU $(uname -m). The virtual device runs on x86_64 or arm64." ;;
  esac
}

check() {
  bold "Checking this machine"
  local fail=0
  case "$(uname -s)" in
    Linux | Darwin) ok "$(uname -s) $(uname -m)" ;;
    *) bad "Run this on macOS or Ubuntu (on Windows, inside WSL2 Ubuntu)"; fail=1 ;;
  esac
  if curl -fsS -o /dev/null --max-time 15 "$API/about"; then ok "Patch Hours service reachable ($API)"
  else bad "Can't reach $API (the TV app needs it)"; fail=1; fi
  if command -v vega >/dev/null; then
    ok "Vega SDK: $(vega --version 2>/dev/null | tr '\n' ' ' | sed 's/  */ /g')"
  else
    bad "Vega SDK not found"
    echo "    Install it (Amazon's installer, about 20 minutes):"
    echo "      curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash"
    echo "    then open a new terminal and run ./run.sh again."
    fail=1
  fi
  if [ "$(uname -s)" = Linux ]; then
    # Both of these make the virtual device time out with no message (see FRICTION_LOG.md 1 and 2).
    if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then ok "/dev/kvm usable"
    else bad "/dev/kvm not usable by $USER"; echo "    sudo usermod -aG kvm \$USER && sudo chmod 666 /dev/kvm"; fail=1; fi
    if ldconfig -p 2>/dev/null | grep -q 'libpulse.so.0'; then ok "libpulse0 installed"
    else bad "libpulse0 missing"; echo "    sudo apt-get install -y libpulse0"; fail=1; fi
  fi
  return $fail
}

start_device() {
  # After a WSL restart XDG_RUNTIME_DIR can name a missing /run/user/<uid>; the device then dies at boot
  # with only "Deadline reached" on the console. WSLg's own runtime folder works.
  if [ -n "${XDG_RUNTIME_DIR:-}" ] && [ ! -w "$XDG_RUNTIME_DIR" ]; then
    if [ -d /mnt/wslg/runtime-dir ]; then export XDG_RUNTIME_DIR=/mnt/wslg/runtime-dir
    else export XDG_RUNTIME_DIR="${TMPDIR:-/tmp}/runtime-$(id -u)"; mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"; fi
    ok "XDG_RUNTIME_DIR was missing; using $XDG_RUNTIME_DIR"
  fi
  if vega virtual-device status 2>/dev/null | grep -q '"running":true'; then
    ok "Virtual device already running"
    return
  fi
  bold "Starting the Vega Virtual Device (first boot takes a minute or two)"
  vega virtual-device start
  # "ready" comes before the home screen; an app launched earlier can be lost.
  echo "Waiting for the home screen…"
  sleep 25
}

install_app() {
  local pkg="$HERE/tv/patchhours_$(arch).vpkg"
  [ -f "$pkg" ] || die "Missing $pkg"
  bold "Installing and opening Patch Hours"
  vega run-app "$pkg" "$APP_ID"
  cat <<EOF

If the TV shows "Your apps" instead, open Patch Hours there or run ./run.sh again.

The TV now shows a six-letter pairing code.
  - With a phone: scan the QR code on the TV, or open $API/check and type the code.
    Teach it a few seconds each of "Patch on" (a skin-coloured sticky note over one eye works),
    "No patch" and "Hand over the eye", then press Start checking.
  - Without a phone: ./run.sh phone CODE
EOF
}

# Sends what the phone would send, about twice a second, marked as scripted ("sim") so the TV labels it.
beat() { # on cls seconds caption
  local on="$1" cls="$2" secs="$3" end=$((SECONDS + $3)) code_http
  printf '  %-34s' "$4"
  while [ $SECONDS -lt $end ]; do
    code_http=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST "$API/api/session/$CODE/flag" \
      -H 'content-type: application/json' \
      -d "{\"on\":$on,\"cls\":\"$cls\",\"conf\":0.9,\"day\":\"$(date +%F)\",\"sim\":true}") || code_http=000
    case "$code_http" in
      200 | 429) ;;
      404) echo; die "The TV code $CODE isn't known. Check the code on the TV." ;;
      *) printf '!' ;;
    esac
    sleep 0.5
  done
  echo "done"
}

phone() {
  CODE="$(printf '%s' "${1:-}" | tr '[:lower:]' '[:upper:]')"
  [[ "$CODE" =~ ^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$ ]] || die "Usage: ./run.sh phone CODE   (the six letters on the TV)"
  bold "Scripted phone for TV $CODE (watch the TV)"
  beat true patch 20 "Patch on: the show plays"
  beat false bare 10 "Patch off: the show pauses"
  beat false covered 8 "Hand over the eye: still paused"
  beat true patch 20 "Patch on again: the show resumes"
  echo
  echo "Minutes counted: $API/week?code=$CODE"
  echo "Then stop sending: the TV pauses about 4 s later (the phone went quiet)."
}

case "${1:-}" in
  phone) phone "${2:-}" ;;
  check) check ;;
  "" | run)
    check || die "Fix the items marked ✖, then run ./run.sh again."
    start_device
    install_app
    ;;
  *) die "Usage: ./run.sh | ./run.sh phone CODE | ./run.sh check" ;;
esac
