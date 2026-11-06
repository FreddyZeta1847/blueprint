---
description: Start Blueprint in a repository — creates the blueprint/ folder, offers Discovery when there is code Claude doesn't know, then starts get-context (the vault is created later, only if the context says so)
---

# /blueprint

<!--
Header comment: the start command of the Blueprint plugin (v3). It creates the project's
blueprint/ folder (layout in blueprint:docs-management §1), offers Discovery when the repo holds
code Claude doesn't know, and starts blueprint:get-context. It never creates the vault: the vault
is created only when the confirmed context card asks for one. Idempotent: it never overwrites an
existing file.
-->

Start Blueprint's pipeline (context → plan → stages) in this repository. No arguments. Plugin
commands are namespaced, so the user may type `/blueprint:blueprint`; `/blueprint` also reaches
this command when nothing else has that name.

## 1. Check what is already there

- **`blueprint/plan.json` exists** → Blueprint is already running here. Say in one line where the
  plan stands (stage, phase) and ask what the user wants to do: go on, or start new work (then the
  entry step of `blueprint:using-blueprint`).
- **`blueprint/context.md` exists but no plan** → show the card briefly. If it is confirmed, go to
  `blueprint:create-plan`; if not, go on with `blueprint:get-context` to finish it.
- **A legacy v2 vault** (`vault-<project>/` at the repo root) → tell the user in plain words that it
  uses the old layout and that its decisions are still read. Don't move or convert it
  automatically.

## 2. Create the `blueprint/` folder

If `blueprint/` does not exist, create it by writing `blueprint/.gitkeep` with the `Write` tool
(it creates the folder). Never use shell commands (`mkdir`, `echo >`): they need extra approval
and, on Windows, can write UTF-16 files.

Create nothing else here: the card is written by get-context, the plan by create-plan, and the
vault (`blueprint/vault/`) only when the confirmed card says the project needs one.

Say once, in plain words, that `blueprint/` is committed with the code so every branch sees the
context, the plan and the decisions at its own version, and that a private project can opt out by
ignoring the folder.

**Blueprint creates nothing outside `blueprint/`.** No source files. The user's own conventions
(for example a `tree.md`) still apply.

## 3. Route

Check whether the repo holds code (source files outside `blueprint/`, `.git`, `.claude/` and
`docs/`).

- **Code Claude doesn't know** → offer Discovery: *"There is code here I don't know yet. Shall I
  read it first? It fills several context answers by itself."* Yes → `blueprint:discovery`, then
  `blueprint:get-context`. No → `blueprint:get-context` directly.
- **Empty repo** → `blueprint:get-context` right away: start with what the user wants to build.

Re-running `/blueprint` is safe: it re-checks the folder and the route.
