---
description: Bootstrap a repository into Blueprint — scaffolds the versioned vault, then starts brainstorming (empty repo) or discovery (existing code)
---

# /blueprint

<!--
Header comment: the bootstrap command of the Blueprint plugin (v2). It creates the vault layout
defined in blueprint:docs-management (section 2) with exact starting contents, then routes to
blueprint:brainstorming or blueprint:discovery. Idempotent on structure: it never overwrites an
existing file.
-->

Bootstrap a repository into Blueprint's documentation-driven workflow. No arguments. Plugin
commands are namespaced, so the user may type `/blueprint:blueprint`; `/blueprint` also reaches
this command when nothing else has that name.

## 1. Create the vault

Create `vault-<project-name>/` at the repo root. The project name comes from the repo folder name,
or `package.json`'s `name`, falling back to `project`. Load `blueprint:docs-management` for the
templates.

**Create every file with the `Write` tool.** `Write` creates missing parent folders by itself.
Never use shell commands (`mkdir`, brace expansion, PowerShell blocks, `echo >`): they need extra
approval and, on Windows, can write UTF-16 files. For an empty folder, write a `.gitkeep` inside it.

| File | Starting content |
|---|---|
| `.gitignore` | the four lines below |
| `_index.md` | docs-management template, no entries yet |
| `_architecture.md` | docs-management template, sections empty |
| `_sections.md` | docs-management template, empty table |
| `_current-task.md` | frontmatter `tags: [index]` + `# Current Task`, nothing else |
| `_plans.md` | frontmatter `tags: [index]` + `# Plans Overview` |
| `local-profile.md` | frontmatter `tags: [index]` + `# Local Profile` + empty `## Who decides each area` |
| `_queue.json` | `{ "mode": "B", "entries": [] }` |
| `Vocabulary/registry.json` | `{ "entries": [] }` |
| `Vocabulary/dismissed.json` | `{ "entries": [] }` |
| `Vocabulary/ignored-values.json` | `{ "values": ["none", "n/a", "not-applicable", "default", "standard", "disabled", "tbd"] }` |
| `foundations/.gitkeep`, `contracts/.gitkeep`, `sections/.gitkeep`, `plans/.gitkeep` | empty |

The vault `.gitignore`:

```gitignore
_index/
_full-context.md
**/atoms.json
**/modules.json
```

**Language.** Write the Markdown files in the language the user speaks (docs-management §4b): if
the conversation or the user's `CLAUDE.md` shows Italian, the headings are Italian (`# Attività in
corso`, `## Chi decide ogni area`…). File and folder names stay as in the table.

Every list file uses the `{ "entries": [...] }` wrapper, **never a bare `[]`**. Keep `yes` and `no`
out of the ignored values on purpose: a yes/no choice means a question was written wrong.

Not created here: `_audit.md`, `_full-context.md` and `_index/` (the hooks create them the first
time they have something to write); `management-info.md`, `_doc-rules.md` and `Sheets/` (only when
needed).

**The vault is versioned.** Don't add it to the project's `.gitignore`. Say once, in plain words,
that it lives in the repo so every branch and worktree sees the decisions at its own version, and
that a private project can opt out by ignoring the folder.

**If the vault already exists,** create only the missing files and never overwrite one. If it is a
v1 vault (it has `features/`), tell the user in plain words that it uses the old layout; don't
convert it automatically.

**Blueprint creates nothing outside the vault.** No source files, no second scratchpad. The user's
own conventions (for example a `tree.md`) still apply.

## 2. One permission, asked once

Ask once for read/write access to `~/.claude/blueprint/` (the global Profile), as a rule in the
**user-level** `~/.claude/settings.json`, never the project's settings. The exact rule — `Read` and
`Edit` only, because `Edit(...)` rules cover every file-editing tool and Claude Code ignores
`Write(...)` rules:

```json
{ "permissions": { "allow": ["Read(~/.claude/blueprint/**)", "Edit(~/.claude/blueprint/**)"] } }
```

- If the rule is already there, don't ask.
- If the edit is refused, give the user this snippet and carry on. It never blocks planning.

## 3. Route

Check whether the repo holds code (source files outside the vault, `.git`, `.claude/` and `docs/`).

- **Empty repo:** invoke `blueprint:brainstorming` (not any other brainstorming skill) and start
  the conversation right away: ask the user what the project is.
- **Code exists:** invoke `blueprint:discovery`.

Re-running `/blueprint` is safe: it re-checks the structure and the route.
