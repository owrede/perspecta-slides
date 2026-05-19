#!/usr/bin/env bash
# Start Obsidian with the Chrome DevTools Protocol exposed on localhost:9222.
#
# This enables agent-driven preview workflows: the agent can connect to the
# running Obsidian over CDP (via Playwright's connectOverCDP) and take
# screenshots of the live plugin state — same fonts, same theme overrides,
# same inspector edits the user sees.
#
# Usage:
#   ./scripts/start-obsidian-debug.sh
#
# Safety:
#   The debug port is bound to localhost only and exposes Obsidian's full
#   browser context. Only use on a trusted machine. Close Obsidian when done.

set -euo pipefail

PORT="${OBSIDIAN_DEBUG_PORT:-9222}"
OBSIDIAN_APP="${OBSIDIAN_APP:-/Applications/Obsidian.app}"

if [[ ! -d "$OBSIDIAN_APP" ]]; then
  echo "Error: Obsidian.app not found at $OBSIDIAN_APP" >&2
  echo "Set OBSIDIAN_APP=/path/to/Obsidian.app to override." >&2
  exit 1
fi

# Kill any running Obsidian so the flag actually takes effect.
# (A running instance without the flag won't suddenly expose CDP.)
if pgrep -x Obsidian >/dev/null; then
  echo "Stopping existing Obsidian process…"
  pkill -x Obsidian || true
  # Give it a moment to release window state.
  sleep 1
fi

echo "Starting Obsidian with --remote-debugging-port=$PORT"
"$OBSIDIAN_APP/Contents/MacOS/Obsidian" --remote-debugging-port="$PORT" &
disown

# Wait for the debug endpoint to come up so callers can rely on it.
echo -n "Waiting for CDP endpoint to become available"
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/json/version" >/dev/null 2>&1; then
    echo
    echo "Obsidian is up. CDP available at http://localhost:$PORT"
    exit 0
  fi
  echo -n "."
  sleep 0.5
done

echo
echo "Warning: Obsidian started but the CDP endpoint did not respond within 15 seconds." >&2
echo "Check that the build of Obsidian respects --remote-debugging-port." >&2
exit 1
