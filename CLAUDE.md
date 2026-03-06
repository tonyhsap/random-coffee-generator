# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

A CLI tool that automatically pairs team members for bi-weekly random coffee meetings. It reads participants from a YAML file, generates non-repeating pairings, tracks history, and outputs Markdown files + a static HTML site. Runs on a GitHub Actions cron schedule (every Monday) or manually.

## Build & Run Commands

- `npm run build` — compile TypeScript via NestJS CLI (`nest build`)
- `npm run generate` — build + generate pairings for next Monday
- `npm run generate:dry` — build + preview pairings without writing files
- `npm run generate:date` — build + generate with `--date YYYY-MM-DD` flag
- `npm run undo` — build + remove the last generated round
- `npm run reset` — wipe `history.json` back to empty
- `npm run test` — run Jest tests
- `npm run test:cov` — run tests with coverage
- `npm run lint` — ESLint with auto-fix

Direct CLI usage after build: `node dist/main.js generate [--date YYYY-MM-DD] [--dry-run]` or `node dist/main.js undo`

## Architecture

NestJS CLI application using **nest-commander** for command dispatch (not an HTTP server). Entry point `src/main.ts` bootstraps via `CommandFactory.run()`.

### Commands (`src/commands/`)
- **GenerateCommand** — orchestrates pairing generation: loads participants, checks bi-weekly cadence, generates pairings, writes output files, updates history
- **UndoCommand** — removes the last round from history and deletes its Markdown file

### Services (`src/services/`)
- **ParticipantsService** — reads and validates `participants.yml` (YAML with `js-yaml`)
- **HistoryService** — manages `history.json`: load/save, track used pairs, sit-out counts, bi-weekly cadence check (`isTooSoon`), detect when all pair combinations are exhausted (`shouldReset`)
- **PairingService** — core matching algorithm: greedy shuffle → retry with different shuffles → backtracking → reset-and-retry. Handles odd-participant sit-out selection (fairness-based)
- **OutputService** — generates per-round Markdown files in `pairings/` and a static HTML site page in `docs/index.html`

### Key Data Files
- `participants.yml` — source of truth for team members (YAML array with `name` fields)
- `history.json` — persisted pairing history (array of rounds with date, pairings, sit-outs)
- `pairings/` — generated Markdown files per round (`YYYY-MM-DD.md`)
- `docs/index.html` — generated static site showing all rounds (for GitHub Pages)

### Pairing Algorithm
Pairs are canonicalized as sorted `"A|B"` strings. The algorithm avoids repeating any pair from history. When all possible pair combinations are exhausted, history resets for a fresh cycle. For odd participant counts, sit-out selection is fairness-weighted (fewest sit-outs first, then least recent).

## CI/CD

GitHub Actions workflow (`.github/workflows/random-coffee.yml`) runs every Monday at 20:00 UTC. Supports `workflow_dispatch` with optional `date` override and `dry_run` toggle. On success, auto-commits changes to `pairings/`, `history.json`, and `docs/`.
