#!/usr/bin/env node
// beacon: publish how many AI chats you have per day, and nothing else.
//
//   node beacon.mjs                 write beacon.json and print it
//   node beacon.mjs --publish       ...then upload it to your gist (BEACON_GIST)
//
// Privacy: this file never reads message text. A chat is counted from its
// file path (Codex) or the first timestamp in its transcript (Claude Code).
// The output holds only harness names, local dates and counts.
//
// Apache-2.0. Requires Node 18+; publishing requires the GitHub CLI (gh).

import { execFileSync } from "node:child_process"
import { createReadStream, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"

const OUT = new URL("beacon.json", import.meta.url).pathname
const HOME = homedir()

/** A local calendar date, YYYY-MM-DD: the only time detail that leaves your machine. */
const localDate = (time) => {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const files = (dir, match) => {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true }).filter((f) => match.test(f)).map((f) => join(dir, f))
}

/** Claude Code: one transcript per chat at ~/.claude/projects/<project>/<session>.jsonl.
 *  Subagent transcripts live one level deeper and are not chats of their own. */
async function claudeCode() {
  const dates = []
  for (const file of files(join(HOME, ".claude", "projects"), /^[^/]+\/[^/]+\.jsonl$/)) {
    const lines = createInterface({ input: createReadStream(file) })
    for await (const line of lines) {
      const time = line.match(/"timestamp":"([^"]+)"/)?.[1]
      if (time) { dates.push(localDate(time)); break }
    }
    lines.close()
  }
  return dates
}

/** Codex: one rollout per chat, already filed under its local date:
 *  ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl (older ones .jsonl.zst). */
function codex() {
  return files(join(HOME, ".codex", "sessions"), /rollout-[^/]*\.jsonl(\.zst)?$/)
    .map((f) => f.match(/(\d{4})\/(\d{2})\/(\d{2})\/rollout-/)?.slice(1).join("-"))
    .filter(Boolean)
}

const tally = (dates) => {
  const daily = {}
  for (const d of dates.sort()) daily[d] = (daily[d] ?? 0) + 1
  return daily
}

// Harnesses delete old transcripts (Claude Code after 30 days by default), so a
// day once counted keeps its highest count instead of shrinking as files go.
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).harnesses : {}
const keep = (name, daily) => {
  const merged = { ...previous[name]?.daily }
  for (const [day, n] of Object.entries(daily)) merged[day] = Math.max(merged[day] ?? 0, n)
  return { daily: Object.fromEntries(Object.entries(merged).sort()) }
}

const beacon = {
  schema: 1,
  name: process.env.BEACON_NAME ?? "anonymous",
  updated: new Date().toISOString().slice(0, 16) + "Z",
  harnesses: {
    "claude-code": keep("claude-code", tally(await claudeCode())),
    codex: keep("codex", tally(codex())),
  },
}

writeFileSync(OUT, JSON.stringify(beacon, null, 2) + "\n")
console.log(JSON.stringify(beacon, null, 2))

if (process.argv.includes("--publish")) {
  const gist = process.env.BEACON_GIST
  if (!gist) {
    console.error("\nSet BEACON_GIST to your gist id. Create one with: gh gist create --public beacon.json")
    process.exit(1)
  }
  execFileSync("gh", ["gist", "edit", gist, "--filename", "beacon.json", OUT], { stdio: "inherit" })
  const owner = execFileSync("gh", ["api", `gists/${gist}`, "--jq", ".owner.login"], { encoding: "utf8" }).trim()
  // The unpinned raw URL always serves the latest revision (GitHub caches it for a few minutes).
  console.error(`\npublished: https://gist.githubusercontent.com/${owner}/${gist}/raw/beacon.json`)
}
