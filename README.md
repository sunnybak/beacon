# beacon

Publish how many AI chats you have per day, and nothing else.

`beacon.sh` is one short shell script with no dependencies: only `sh`, `find`,
`grep`, `awk` and `date`, which every Mac and Linux machine has. It counts your
Claude Code and Codex chats from their local transcripts and writes `beacon.json`:

```json
{
  "schema": 1,
  "name": "anonymous",
  "updated": "2026-11-15T18:53Z",
  "harnesses": {
    "claude-code": { "daily": {
      "2026-11-10": 14
    } },
    "codex": { "daily": {
      "2026-11-10": 6
    } }
  }
}
```

Monthly and yearly totals are sums of `daily`; readers compute them.

## What it reads, and what it never does

- **Claude Code**: one transcript per chat at `~/.claude/projects/<project>/<session>.jsonl`.
  It reads up to the first `"timestamp"` to date the chat. Subagent transcripts are not chats.
- **Codex**: one rollout per chat under `~/.codex/sessions/YYYY/MM/DD/`. The date comes
  from the path; the file is never opened.

`CLAUDE_CONFIG_DIR` and `CODEX_HOME` are respected if you moved those folders.

It never reads or publishes message text, prompts, project names, folders or
times of day. Before anything is written, every line must be a known harness,
a `YYYY-MM-DD` date and a whole number, or it is dropped. Read the script;
it is short on purpose.

Daily counts still show which days you work, and roughly how much. Publish
only if you are fine with that.

## Your history

Harnesses delete old transcripts (Claude Code after 30 days by default), so
the script keeps every day it has counted in `history.tsv`, one
`harness date count` line each, and a day keeps its highest count.
`beacon.json` is generated from it. Keep `history.tsv`; it is your record.

A resumed Claude Code chat starts a new transcript that begins with the old
chat's timestamp, so it counts again on its original day.

## Use

```bash
./beacon.sh                          # writes and prints beacon.json
```

To publish, create a public gist once with the [GitHub CLI](https://cli.github.com):

```bash
gh gist create --public beacon.json  # prints the gist id
```

Then:

```bash
BEACON_NAME=yourname BEACON_GIST=<id> ./beacon.sh --publish
```

Your beacon is at `https://gist.githubusercontent.com/<you>/<id>/raw/beacon.json`.
GitHub serves it with open CORS, so any page can read it, and it stays up
while your computer sleeps.

## Keep it fresh (macOS)

The transcripts live on your machine, so the beacon has to run there. A
launchd agent at `~/Library/LaunchAgents/local.beacon.plist` publishes every
15 minutes. Use absolute paths, and set `PATH` so launchd can find `gh`:

```xml
<key>Label</key>                <string>local.beacon</string>
<key>ProgramArguments</key>
<array>
  <string>/bin/sh</string>
  <string>/path/to/beacon/beacon.sh</string>
  <string>--publish</string>
</array>
<key>EnvironmentVariables</key>
<dict>
  <key>PATH</key>               <string>/opt/homebrew/bin:/usr/bin:/bin</string>
  <key>BEACON_GIST</key>        <string>your-gist-id</string>
</dict>
<key>StartInterval</key>        <integer>900</integer>
<key>RunAtLoad</key>            <true/>
<key>StandardErrorPath</key>    <string>/Users/you/Library/Logs/beacon.log</string>
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.beacon.plist   # start
launchctl bootout gui/$(id -u)/local.beacon                                   # stop
```

On Linux, a cron entry does the same: `*/15 * * * * BEACON_GIST=<id> /path/to/beacon/beacon.sh --publish`.

## License

Apache-2.0
