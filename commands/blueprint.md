---
description: Bootstrap a repository into Blueprint's documentation-driven workflow — scaffolds the vault, then branches on whether the repo already contains code
---

# /blueprint

Bootstrap a repository into Blueprint's documentation-driven workflow.

## What it does

Creates the vault scaffold (folder structure, index files, registry), evaluates whether the repo has existing code, and branches explicitly to the next step:
- **If code exists:** Invoke the `discovery` skill to reverse-engineer it into draft features and atoms.
- **If the repo is empty:** Invoke the `brainstorming` skill with scope "whole project" to define features from scratch.

## How to use

From the repo root, type:
```
/blueprint
```

That's it. No arguments. The command creates the vault structure, checks for existing code, and tells you what to do next.

## What gets created

The command creates a `vault-<project-name>/` folder at the repo root with this structure:

```
vault-<project-name>/
├── _index.md              (map of every vault file)
├── _features.md           (list of features)
├── _plans.md              (list of implementation phases)
├── _architecture.md       (cross-feature connections, unconfirmed candidates)
├── _current-task.md       (currently open discussion — empty at start)
├── _queue.json            (pending topics to discuss)
├── Vocabulary/
│   ├── registry.json         (shared axis vocabulary: { id, question } pairs)
│   ├── dismissed.json        (findings dismissed during review, with reason)
│   └── ignored-values.json   (seeded — see below)
└── features/              (folder for feature files)
    └── .gitkeep           (ensures folder is tracked)
```

It also creates `_index/` and `Sheets/` as empty folders (populated later as features are written and optional engineering-sheets are rendered). `_audit.md` and `_full-context.md` are **not** created here — the `PostToolUse` hook creates each one the first time it has something to write.

**Seed `Vocabulary/ignored-values.json`** with the absent-answer values the value-inversion check must skip. Without it, every feature that correctly answers "nothing here" on caching, retries or rate limiting flags against every other one, and the check becomes noise the user stops reading:

```json
{ "values": ["none", "n/a", "not-applicable", "default", "standard", "disabled", "tbd"] }
```

A starter seed, not a closed set — a project extends it. Note `yes` and `no` are deliberately absent: a yes/no `choice` means the *axis* was authored wrong, which is a finding worth surfacing rather than silencing.

**Request durable permission on `~/.claude/blueprint/`.** Ask once, here, for read/write access to that folder as a `settings.json` permission rule. This is not optional polish. `Read`/`Grep`/`Glob` outside the project directory prompt every single time, and the user-agent's Profile pass must *read* the Profile before updating it — so without this rule, every ratified decision triggers a permission prompt, which silently breaks agent-assist mode's one promise (that two-way decisions don't stop). Granted once, never asked again per lock.

If the vault already exists, the command skips file creation (idempotent) but still evaluates the empty-vs-existing branch.

## Next: your choice, determined by what the command found

**The command will tell you** whether existing code was found. Choose your next step:

- **If existing code was found:** Run the `discovery` skill to reverse-engineer it into draft atoms.
  ```
  /discovery
  ```

- **If the repo is empty:** Run the `brainstorming` skill to scope the whole project.
  ```
  /brainstorming
  ```

If unsure, re-run `/blueprint` — it will re-evaluate and tell you which branch to take.

---

## Implementation notes

The command is idempotent on structure (never overwrites existing files) but deterministic on the branch (re-evaluates empty vs. existing every run). Project name is derived from the repo's folder name or `package.json`'s `name` field, falling back to `project` if neither is available.
