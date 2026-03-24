---
description: Fixture scripts — uv-only Python generation, Effect-native TS schema check
globs: "effect-search/scripts/**"
alwaysApply: true
---

# effect-search/scripts

Scripts for fixture generation, verification, and schema checking. Python scripts use [uv](https://docs.astral.sh/uv/) with PEP 723 inline metadata — never invoke `python3` directly.

## Commands

| Task              | Command                     |
| ----------------- | --------------------------- |
| Check fixtures    | `bun run fixtures:check`    |
| Generate fixtures | `bun run fixtures:generate` |
| Lock Python deps  | `bun run fixtures:lock`     |
| Verify fixtures   | `bun run fixtures:verify`   |

Run all commands from `effect-search/`.

## Structure

- `check-fixtures.ts` — Effect-native TS script; schema-decodes every committed fixture through `KnownFixtureSchema`, detects orphan files
- `generate-optuna-fixtures.py` — orchestrator; imports family modules, writes JSON + manifest
- `verify-optuna-fixtures.py` — re-derives values from live Optuna, asserts committed fixtures match
- `fixtures/` — one module per FM family, each exports `generate(generated_at: str) -> list[dict]`
- `fixtures/_common.py` — shared `metadata()`, `write_json()`, constants

## Prerequisites

Verify `uv` is installed before running any script: `uv --version`. If missing, install via `curl -LsSf https://astral.sh/uv/install.sh | sh`.

## Rules

1. **Never hardcode expected values** — derive from Optuna APIs or document the mathematical source.
2. **One family per module** — new FM fixtures get a new file in `fixtures/`, not inline in the orchestrator.
3. **Fixture output must match TS schemas** — field names and shapes must align with `test/helpers/fixtures/schemas.ts`.
4. **Run `fixtures:lock` after changing dependencies** — commit the `.lock` files for reproducibility.
5. **Run `fixtures:verify` after regenerating** — proves committed values match live Optuna.
