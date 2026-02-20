# clockodo-cli

CLI for the [Clockodo](https://www.clockodo.com) time tracking API. Human-friendly tables and colors, machine-friendly JSON output for AI agents and scripts.

```
Usage: clockodo [options] [command]

Options:
  -j, --json     Output as JSON
  -p, --plain    Output as plain text (no colors)
  --no-color     Disable colors
  --no-input     Disable interactive prompts
  -v, --verbose  Verbose output

Commands:
  config         Manage CLI configuration
  status         Show running clock and today's summary
  start          Start time tracking
  stop           Stop time tracking
  entries        Manage time entries
  customers      Manage customers
  projects       Manage projects
  services       Manage services
  users          User management
  report         Aggregated time reports
  absences       Manage absences
  worktimes      Show work time intervals
  userreport     Show user report (overtime, holidays, absences)
  userreports    Show user reports for all users
  schema         Output machine-readable CLI structure (for AI agents)
```

Every command supports `--help` for full usage details.

## Installation

```bash
npm install -g @liebig-technology/clockodo-cli
```

Requires Node.js >= 22.

## Setup

```bash
clockodo config set        # configure API credentials interactively
clockodo status            # verify it works
```

Credentials are stored in `~/.config/clockodo-cli/config.json`. Environment variables `CLOCKODO_EMAIL` and `CLOCKODO_API_KEY` take precedence.

## Usage

```bash
# Time tracking
clockodo start --customer 123 --service 456 --text "Working on feature"
clockodo stop
clockodo status

# Entries
clockodo entries                                         # list today's entries
clockodo entries --since 2026-01-01 --until 2026-01-31   # date range
clockodo entries create --from "09:00" --to "12:30" --customer 123 --service 456

# Reports
clockodo report              # today
clockodo report week         # this week
clockodo report month        # this month

# Absences, work times, user reports
clockodo absences list --year 2026
clockodo worktimes --since 2026-02-17 --until 2026-02-21
clockodo userreport --year 2026
```

When `--customer` or `--service` is not provided, `start` and `entries create` launch an interactive picker (disable with `--no-input`). You can also set defaults via `clockodo config set`.

## AI Agent Integration

```bash
# JSON output for structured parsing
clockodo status --json
clockodo entries --json | jq '.data[].text'

# Auto-JSON when piped (disable with CLOCKODO_AUTO_JSON=0)
result=$(clockodo status)

# Discover all commands and options programmatically
clockodo schema | jq '.cli.subcommands[].name'
```

Every error maps to a specific exit code (0=success, 2=invalid args, 4=auth failure, etc.) so agents can branch on the code rather than parsing messages.

## Development

```bash
pnpm install
pnpm dev -- status         # run without building
pnpm build                 # compile to dist/
pnpm test                  # vitest
pnpm typecheck             # tsc --noEmit
pnpm lint                  # biome
```

## License

MIT
