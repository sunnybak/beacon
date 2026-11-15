#!/bin/sh
# beacon: publish how many AI chats you have per day, and nothing else.
#
#   ./beacon.sh              write beacon.json and print it
#   ./beacon.sh --publish    ...then upload it to your gist (BEACON_GIST)
#
# Never reads message text: a chat is dated from its folder (Codex) or the first
# "timestamp" in its transcript (Claude Code). Uses only sh, find, grep, awk, date.
set -eu
cd "$(dirname "$0")"

claude="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects"
codex="${CODEX_HOME:-$HOME/.codex}/sessions"
name="${BEACON_NAME:-anonymous}"
case "$name" in *[!A-Za-z0-9_.-]*|'') echo "BEACON_NAME: letters, digits, . _ - only" >&2; exit 1 ;; esac

# Seconds since 1970 -> local YYYY-MM-DD. BSD (macOS) and GNU date spell it differently.
if date -r 0 >/dev/null 2>&1; then day() { date -r "$1" +%Y-%m-%d; }; else day() { date -d "@$1" +%Y-%m-%d; }; fi

# One "harness date" line per chat.
chats() {
  # Claude Code: top-level transcripts only (subagents live deeper). The first
  # timestamp, in UTC, becomes seconds since 1970 by plain arithmetic.
  [ -d "$claude" ] && find "$claude" -mindepth 2 -maxdepth 2 -name '*.jsonl' \
    -exec grep -m1 -oH '"timestamp":"[0-9T:-]*' {} + |
    awk '{
      i = index($0, ":\"timestamp\":\""); file = substr($0, 1, i - 1)
      if (file in seen) next; seen[file] = 1                  # first timestamp per file only
      if (split(substr($0, i + 14), t, /[-T:]/) != 6) next    # YYYY MM DD hh mm ss, else skip
      y = t[1]; m = t[2]; d = t[3]; if (m <= 2) { y--; m += 12 }   # days from civil (Hinnant)
      days = 365*y + int(y/4) - int(y/100) + int(y/400) + int((153*(m-3)+2)/5) + d - 719469
      print days*86400 + t[4]*3600 + t[5]*60 + t[6] }' |
    while read -r t; do echo "claude-code $(day "$t")"; done
  # Codex: one rollout per chat, filed under its local date. Never opened.
  [ -d "$codex" ] && find "$codex" -name 'rollout-*.jsonl*' |
    sed -nE 's|.*/([0-9]{4})/([0-9]{2})/([0-9]{2})/rollout-[^/]*$|codex \1-\2-\3|p'
  return 0
}

# history.tsv keeps every day ever counted: harnesses delete old transcripts
# (Claude Code after 30 days), so a day keeps its highest count.
touch history.tsv
{ chats | sort | uniq -c | awk '{ print $2, $3, $1 }'; cat history.tsv; } |
  awk '$1 ~ /^(claude-code|codex)$/ && $2 ~ /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/ && $3 ~ /^[0-9]+$/ {
         k = $1 " " $2; if ($3 + 0 > n[k] + 0) n[k] = $3 }
       END { for (k in n) print k, n[k] }' | sort > history.tsv.new
mv history.tsv.new history.tsv

# Render beacon.json from history.tsv. Every value was checked above, so no escaping is needed.
awk -v name="$name" -v updated="$(date -u +%Y-%m-%dT%H:%MZ)" '
  BEGIN { printf "{\n  \"schema\": 1,\n  \"name\": \"%s\",\n  \"updated\": \"%s\",\n  \"harnesses\": {", name, updated }
  $1 != h { printf "%s\n    \"%s\": { \"daily\": {", (h ? "\n    } }," : ""), $1; h = $1; sep = "" }
  { printf "%s\n      \"%s\": %d", sep, $2, $3; sep = "," }
  END { printf "%s\n  }\n}\n", (h ? "\n    } }" : "") }' history.tsv > beacon.json
cat beacon.json

if [ "${1:-}" = --publish ]; then
  : "${BEACON_GIST:?set BEACON_GIST to your gist id (create one: gh gist create --public beacon.json)}"
  gh gist edit "$BEACON_GIST" --filename beacon.json beacon.json
fi
