#!/bin/sh
# Install the nunc-fluens daily user units (Linux/WSL with systemd).
#   install.sh <sandbox-dir> [OnCalendar]
# Substitutes the unit placeholders, reloads the user daemon, and
# enables the timer. Cron fallback (no systemd): add to crontab -e:
#   30 6 * * * cd <repo> && NS_SANDBOX=<sandbox> node engines/nunc-fluens/pipeline/src/cli.ts run
set -eu

SANDBOX="${1:?usage: install.sh <sandbox-dir> [OnCalendar]}"
ONCALENDAR="${2:-*-*-* 06:30:00}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../.." && pwd)"
NODE="$(command -v node)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

SANDBOX="$(cd "$SANDBOX" && pwd)"
[ -d "$SANDBOX/news" ] || { echo "not a sandbox (no news/): $SANDBOX" >&2; exit 1; }

mkdir -p "$UNIT_DIR"
sed -e "s|@REPO@|$REPO|g" -e "s|@SANDBOX@|$SANDBOX|g" -e "s|@NODE@|$NODE|g" \
  "$HERE/nunc-fluens-daily.service" > "$UNIT_DIR/nunc-fluens-daily.service"
sed -e "s|@ONCALENDAR@|$ONCALENDAR|g" \
  "$HERE/nunc-fluens-daily.timer" > "$UNIT_DIR/nunc-fluens-daily.timer"

systemctl --user daemon-reload
systemctl --user enable --now nunc-fluens-daily.timer
echo "installed: $UNIT_DIR/nunc-fluens-daily.{service,timer}"
echo "sandbox  : $SANDBOX"
echo "schedule : $ONCALENDAR (Persistent=true)"
echo "next     : systemctl --user list-timers nunc-fluens-daily.timer"
echo "manual   : systemctl --user start nunc-fluens-daily.service"
