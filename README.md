# claude-session-profiler

**One-shot token profiler for Claude Code** — reads your local session data, analyzes it, and prints findings. No reports saved, no data sent anywhere.

## Install

```bash
npm install -g claude-session-profiler
```

After installation, run directly:

```bash
claude-session-profiler
```

No npx needed after global install — the binary is in your PATH.

Or run once without installing:

```bash
npx claude-session-profiler
```

## Usage

```bash
# Full profile of all sessions in default ~/.claude/projects/
claude-session-profiler

# Profile a specific directory
claude-session-profiler --projects /path/to/.claude/projects

# Profile a single session file
claude-session-profiler --session /path/to/session-2024-01-15-1234.jsonl

# JSON output (for scripting)
claude-session-profiler --json
```

## What this tool does

Reads your Claude Code session logs from `~/.claude/projects/` and analyzes them for token-wasting patterns. Prints findings to stdout. Runs once, exits.

**What it does NOT do:** It does not fix anything, write files, or persist data.

## How it works

The tool reads your session `.jsonl` files and project configs, extracts metrics, and prints an analysis. Everything stays on your machine.

## What it checks

### 1. Redundant File Reads
Scans session logs for `read_file` / `read` blocks. Flags files that were read multiple times within a session.

- **What it looks at:** `content[].type === 'read_file'` blocks in your session messages
- **Output:** list of files + read count
- **What this tells you:** Which files are read repeatedly and may benefit from being summarized once and referenced via context

### 2. Token Sinks
Looks for bash/terminal commands with very large outputs (usually from `ls`, `find`, or similar).

- **What it looks at:** `content[].type === 'bash'` blocks where output exceeds ~2000 chars
- **Output:** commands with large output + suggested `.claudeignore` entries
- **What this tells you:** Which directories are generating excessive output (node_modules, .git, dist/, build/)

### 3. Reasoning Efficiency
Calculates the ratio of thinking tokens to total tokens per session.

- **What it looks at:** `thinking_tokens` vs `total_tokens` from session usage data
- **Output:** sessions where thinking exceeds 20% of total tokens AND total tokens are below 50k
- **What this tells you:** Sessions that may have excessive back-and-forth reasoning for simple tasks

### 4. CLAUDE.md Size
Checks if a `CLAUDE.md` file exists and estimates its size.

- **What it looks at:** File size of `CLAUDE.md` in the project root
- **Output:** warning when estimated tokens exceed ~1000 (rough char/4 approximation)
- **What this tells you:** Large CLAUDE.md files that may benefit from modularization

### 5. .claudeignore Quality
Checks if `.claudeignore` exists and what entries are present.

- **What it looks at:** Presence of `.claudeignore` and its contents
- **Output:** which essential entries are missing (node_modules, dist, .git, build)
- **What this tells you:** Which commonly large directories are NOT excluded from context

## CLI Options

```bash
-p, --projects <path>   Path to ~/.claude/projects directory (default: ~/.claude/projects)
-s, --session <path>    Profile a single session .jsonl file only
--json                  Output machine-readable JSON instead of the formatted report
-V, --version           Show version
-h, --help              Show help
```

## Example Output

```
╔══════════════════════════════════════════════════════╗
║      claude-session-profiler — Token Profiler       ║
╚══════════════════════════════════════════════════════╝

  Efficiency Score: B  (78/100)

  Summary
  ──────────────────────────────────────────
  Sessions analyzed     : 12
  Total tokens used     : 148,320
  Estimated savings     : ~18%

  Top 3 Action Items
  ──────────────────────────────────────────

  🔴 Create .claudeignore
     Create a .claudeignore file in your project root.
     Add: node_modules, dist, .git, build
     ~15% savings

  🟡 Cache repeated reads of types.ts
     This file was read 4 times. Use session context
     or ask to summarize instead of re-reading.
     ~12% savings

  🔵 Add build artifacts to .claudeignore
     Large command outputs detected. Add build/ or dist/
     to .claudeignore to avoid scanning generated files.
     ~8% savings
```

## Scope & Privacy

- **One-shot:** Runs once, prints output, exits. No state, no history, no reports.
- **Local only:** Reads from your local `~/.claude/projects/` directory. No network requests, no external APIs.
- **No persistence:** No files are written, no data is stored.
- **Your data stays yours:** Nothing leaves your machine.

## Development

```bash
git clone https://github.com/thomasender/claude-token-audit.git
cd claude-token-audit
npm install
npm run build
node dist/index.js
```

## License

MIT
