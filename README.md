# Claude Context Optics

**Token-saving audit tool for Claude Code**

Audit your local Claude Code usage logs and project configurations to get concrete, actionable recommendations for reducing token consumption.

## Install

```bash
npm install -g claude-token-audit
# or
npx claude-context-optics
```

## What it does

Scans `~/.claude/projects/` for session logs and analyzes:

- **Redundant Reads** — files read multiple times across sessions
- **Token Sinks** — large bash/ls outputs suggesting missing `.claudeignore` rules
- **Reasoning Efficiency** — flags sessions where thinking tokens exceed 20% on simple tasks
- **CLAUDE.md Size** — warns when >1000 tokens (suggests modularization)
- **`.claudeignore` Quality** — checks for essential entries like `node_modules`, `dist`, `.git`

## CLI Options

```bash
-p, --projects <path>   Path to ~/.claude/projects directory
-s, --session <path>   Audit a specific session .jsonl file
--json                  Output results as JSON
-V, --version           Show version
-h, --help              Show help
```

## Example Output

```
╔══════════════════════════════════════════════════════╗
║     Claude Context Optics — Token Audit Report      ║
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

## Privacy

All analysis runs locally. No data is sent to any external API.

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