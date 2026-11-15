# beacon

Publish how many AI chats you have per day, and nothing else.

`beacon.mjs` is one zero-dependency file. It counts your Claude Code and Codex
chats from their local transcripts and writes `beacon.json`:

```json
{
  "schema": 1,
  "name": "anonymous",
  "updated": "2026-11-12T01:55Z",
  "harnesses": {
    "claude-code": { "daily": { "2026-11-10": 14 } },
    "codex":       { "daily": { "2026-11-10": 6 } }
  }
}
```

Monthly and yearly totals are sums of `daily`; readers compute them.

## What it reads, and what it never does

- **Claude Code**: one transcript per chat at `~/.claude/projects/<project>/<session>.jsonl`.
  It reads up to the first `"timestamp"` to date the chat. Subagent transcripts are not chats.
- **Codex**: one rollout per chat under `~/.codex/sessions/YYYY/MM/DD/`. The date comes
  from the path; the file is never opened.

It never reads or publishes message text, prompts, project names, folders or
times of day. Only harness names, local dates and counts leave your machine.
Read the file; it is short on purpose.

Harnesses delete old transcripts (Claude Code after 30 days by default), so
each run merges with the previous `beacon.json` and a day keeps its highest
count. Keep that file around.

## Use

Requires Node 18+.

```bash
node beacon.mjs                      # writes and prints beacon.json
```

To publish, create a public gist once with the [GitHub CLI](https://cli.github.com):

```bash
gh gist create --public beacon.json  # prints the gist id
```

Then:

```bash
BEACON_NAME=yourname BEACON_GIST=<id> node beacon.mjs --publish
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
  <string>/opt/homebrew/bin/node</string>
  <string>/path/to/beacon/beacon.mjs</string>
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

## License

Apache-2.0
