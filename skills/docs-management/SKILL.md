---
name: docs-management
description: Use whenever creating, reading, or updating a project's design documentation (its Obsidian vault, `vault-<project-name>/`, or equivalent doc system) — the single source of truth for decisions, rationale, and architecture. Covers folder/file layout, naming conventions, frontmatter tags, the Mermaid-diagram rule, the decision-atoms system, and every file template. Triggers on writing a feature/sub-feature/phase/substep file, updating `_index`/`_features`/`_plans`/`_architecture`, adding or looking up a value in `Vocabulary/registry.json` or a feature's `atoms.json`, or any question about where something belongs in the docs.
---

# Docs Management

The canonical spec for this project's design documentation: the Obsidian vault convention below.
This skill is the **single source of truth** for the schema — `vault-architect` and any other
agent that touches vault files read this skill directly rather than carrying their own copy. One
document that can go stale beats two that can go stale independently.

<!--
Header comment (Markdown has no native comment syntax, so this HTML comment stands in for one):
this file defines the vault schema shipped by the Blueprint plugin. It is a deliberate,
documented fork of a more general Obsidian-vault convention — see the divergences called out
below (optional sub-features, the atoms/registry decision index replacing a hand-maintained
contracts.md, a machine-only fallback file, no mandatory recap, no `perché` field, no assumed
`PROGRESS.md`). Do not silently re-merge those differences back in.
-->

## Structure

```
vault-<project-name>/
├── _index.md
├── _architecture.md
├── _features.md
├── _plans.md
├── _current-task.md
├── _queue.md                   (pending features/notes/promotions, see below)
├── _full-context.md            (gitignored — machine-read only, mirrored from _current-task.md, see below)
├── Vocabulary/
│   ├── registry.json           (committed — shared axis vocabulary)
│   └── dismissed.json          (committed — Review findings dismissed, with reason)
├── _index/
│   └── decisions.json          (gitignored — compiled from every feature's atoms.json)
├── management-info.md          (optional, per-project — manager-authored rules/preferences)
├── features/
│   └── FEATURE-NAME/                         ← one folder per feature, named after it
│       ├── FEATURE-NAME.md                   ← the lean parent, always present
│       ├── atoms.json                         ← this feature's decisions
│       └── FEATURE-NAME--subfeature-name.md  ← optional, only where the feature-definition
│                                                test justifies a split within this feature
└── plans/
    ├── PHASE-1-NAME.md
    ├── PHASE-1-NAME--substep-name.md         ← optional, same rule as sub-features
    └── PHASE-1-NAME.json                     ← Plan-Discussion's tasks, see below
```

The vault folder is named after the project itself (`vault-<project-name>/`), never a generic
`vault/`. **Committed by default** — the vault is the reasoning behind the code, and a teammate
reading the repo should see it too (the audit/report file, for instance, only means something if
it can actually reach a teammate). Any installation that wants it private (public repo, sensitive
project, personal preference) adds it to their own `.gitignore` — a one-line opt-out on their side,
not a rule the methodology imposes on every project.

**Each feature gets its own folder** under `features/`, named exactly after the feature. The lean
parent file and any of that feature's sub-feature files live inside it. Obsidian resolves
`[[wikilinks]]` by filename regardless of folder, so links are unaffected by the folder layout.

`_index.md` — map of every file in the vault. Update every time a file is added or removed.

`_architecture.md` — global, system-level architecture: how all features connect and the
end-to-end workflow of the system. Bird's-eye view; per-feature internal structure lives in that
feature's own file(s). Updated whenever a feature is added or the connections between features
change. Also holds any unconfirmed decision candidates (tagged `needs-review`) until ratified into
a `status: locked` atom — see Decision atoms below.

`_features.md` — overview of all features with a short description of each. Updated whenever a new
feature is added.

`_plans.md` — overview of all implementation phases with a short description of each. Updated
whenever a new phase is added.

`_current-task.md` — the live discussion log, scoped to **one feature at a time** — not one
sub-feature, not one single decision. Every decision locked during that feature's discussion is
written in as it happens (reasoning, tradeoffs, candidate splits); if a decision is later revised,
its entry is updated to show the current answer only — this file is a live snapshot, never a
history. Each sub-feature's real vault file is still written the moment that sub-feature's own
discussion concludes (see `vault-architect`'s job description below) — but `_current-task.md`
itself is only cleared once every sub-feature of the *whole* feature is discussed and written.

`_queue.md` — every feature/note/promotion identified but not yet individually taken through its
own full cycle. Populated the moment a single request turns out to describe more than one item
(the feature-definition test applies to single-addition scope too, not only whole-project scope —
see `using-blueprint`'s feature-definition test), each entry carrying its provisional
classification (Note/Promotion/New Feature — Feature-Detection's checks are mechanical enough to
run on the whole list up front). `SessionStart` injects this file every session alongside
`_current-task.md` and `_index.md`, so a pending item is never something Claude has to remember on
its own. `vault-architect` writes new entries and checks one off — removes it — the moment that
item's own cycle is fully written to its permanent home. Stays small by the same discipline as
`_current-task.md`: nothing lingers once it's done.

`_full-context.md` — a machine-read-only fallback file, plain Markdown, never HTML (HTML recaps
stay human-facing; this one is read by Claude, never shown to the user as a deliverable). A hook
mirrors every lock event out of `_current-task.md` into this file, **append-only** — never
overwritten, so a later reversal (a decision changed, then changed back) leaves the full trail
standing even after `_current-task.md` has already moved on to showing only the current answer.
Read only when strictly necessary — a hallucination, a big or repeating mistake, or a clear
misunderstanding with the user — never in normal flow, or it defeats its own token-saving purpose.
Distinct from any team-facing audit/report file some installations layer on top: this file has no
human audience, it exists purely so Claude can re-ground itself.

## Naming conventions

| Type | Convention | Example |
|---|---|---|
| Feature folder | `features/FEATURE-NAME/` — all caps, hyphens | `features/AGENT-ENGINE/` |
| Feature file | `FEATURE-NAME.md` inside its folder | `AGENT-ENGINE/AGENT-ENGINE.md` |
| Sub-feature file (optional) | `FEATURE-NAME--subfeature-name.md` inside the feature folder — parent all caps, double dash, child lowercase | `AGENT-ENGINE/AGENT-ENGINE--orchestrator.md` |
| Phase file | `PHASE-N-NAME.md` — all caps | `PHASE-1-SETUP.md` |
| Substep file (optional) | `PHASE-N-NAME--substep-name.md` — parent all caps, double dash, child lowercase | `PHASE-1-SETUP--env-config.md` |

There is no recap file convention shipped by this skill — see "Explicitly not part of this
schema" below.

## Sub-features are optional — apply the feature-definition test

Unlike a more generic version of this convention (which mandates five default sub-features —
`--architecture`, `--technologies`, `--caching`, `--security`, `--resilience` — on every feature,
no exceptions), Blueprint does **not** assume any of them. Whether a feature splits at all, and
into what, is decided by applying the same recursive feature-definition test (owned by
`using-blueprint`, not restated here) to the feature's own content:

- Independent why — can a piece of this feature's reasoning be stated without leaning on the
  rest of the parent file?
- External dependents — does something else depend on that piece specifically?

If neither holds, the feature stays a single lean file. Most features don't need a split at all —
prefer one well-organized parent file over manufacturing sub-features to fill a template. When a
split is justified, name the sub-feature after what it actually covers (it does not have to be one
of the five default aspect names above — `--architecture`, `--technologies`, `--caching`,
`--security`, `--resilience` remain available as sub-feature *names* when a feature genuinely
needs that particular cut, but none is assumed by default).

## Frontmatter tags (MANDATORY — drives Obsidian graph colors)

Every vault Markdown file **must** begin with YAML frontmatter carrying exactly one type tag
(plus `needs-review` when the content hasn't been confirmed by the user, and/or `parked` when the
file is a future / not-yet-built placeholder). Apply the tag the moment a file is created — never
leave a vault Markdown file untagged.

| File | Frontmatter |
|---|---|
| `_*.md` (index/meta: `_index`, `_features`, `_plans`, `_architecture`, `_current-task`, `_queue`, `_full-context`) | `tags: [index]` |
| `FEATURE-NAME.md` | `tags: [feature]` |
| `FEATURE-NAME--subfeature.md` | `tags: [subfeature]` |
| `PHASE-N-NAME.md` | `tags: [phase]` |
| `PHASE-N-NAME--substep.md` | `tags: [substep]` |
| any unconfirmed / drafted-without-live-confirmation file | add `needs-review` → e.g. `tags: [feature, needs-review]` |
| any parked / future file | add `parked` → e.g. `tags: [subfeature, parked]` |

`atoms.json`, `Vocabulary/registry.json`, and `_index/decisions.json` are plain JSON data files,
not frontmatter-tagged Markdown — the frontmatter/tags system above only applies to `.md` files.

**No `perché` field.** Superseded by the Ratification-at-Contact mechanism (owned by
`using-blueprint`): an item's open questions live as prose (or as the `needs-review` tag) and get
resolved the moment work actually touches them, not through a dedicated frontmatter field.

Recommended Graph view color groups (Graph view → Settings ⚙ → Groups → New group):
`tag:#feature` blue · `tag:#subfeature` light blue · `tag:#phase` green ·
`tag:#substep` light green · `tag:#index` grey ·
`tag:#needs-review` yellow · `tag:#parked` muted orange.

## Diagrams — use Mermaid, not ASCII

All diagrams in vault Markdown use **Mermaid** fenced code blocks (` ```mermaid `). Obsidian
renders them **natively** (no plugin) and they're far cleaner than ASCII box-drawing art, which
doesn't render as a diagram at all and is painful to edit. **Do not use ASCII diagrams in vault
Markdown.**

## Decision atoms (`atoms.json` + `Vocabulary/registry.json` — not a hand-maintained Contracts file)

What used to be a hand-maintained `Contracts/contracts.md` is now compiled data. Every locked
decision is a small JSON object (an **atom**) living in its own feature's `atoms.json`, matched
against a project-wide shared vocabulary at write time. No `CONTRACT-00N` ids, no separate
confirmed/dismissed files to hand-maintain.

**Atom schema** — one JSON object per decision:

| Field | Meaning |
|---|---|
| `id` | Stable identifier for this atom, never reused. |
| `axis` | The question this atom answers, written as a full question (e.g. `"what database engine does this feature use?"`), never a bare noun — a noun-style axis invites two different questions to collide under the same label. |
| `choice` | The value actually decided (e.g. `"jwt"`). |
| `rejected` | Alternatives genuinely considered and set aside, with a short reason each. Required non-empty for a one-way decision. |
| `facts` | Secondary properties derived from the choice, useful to later checks. |
| `rationale` | Short, always present — also the "why" for any audit/report logging, no separate field needed. |
| `reversibility` | `one-way` or `two-way`. Governs eligibility for the constraints digest and whether a non-empty `rejected` is required. |
| `depends_on` | Pointer(s) to other atom ids this one presumes — watched by the orphan-check for dangling references. |
| `status` | `ratified` (confirmed live), `locked` (a management-info Rule, same weight as `ratified`), `agent-approved` (fast-path, a guess not a confirmation), `inferito` (Discovery's inferred guess), `ereditato-ignoto` (inherited, no discoverable reasoning). Every consumer branches on one derived signal — "counts as decided" (`ratified`/`locked`) vs. everything else. |

**Storage — one `atoms.json` per feature folder.** Fixed filename inside each
`features/FEATURE-NAME/` folder, holding only that feature's atoms. Small per-feature files, not
a shared per-domain file — two people touching different features never collide.

**`Vocabulary/registry.json`** — a flat, project-wide list of `{ id, question }` entries, no
taxonomy above it. A small starter seed ships with the plugin; it grows feature by feature, at
each lock.

**The write flow**, every time `vault-architect` is about to lock a new atom:
1. Read the full `registry.json` (cheap regardless of vault size) and judge whether this decision
   matches an existing axis or needs a new one.
2. Do a scoped lookup into `_index/decisions.json` for just the axes this write touches, across
   other features — catches an obvious conflict before the atom is even shown to the user.
3. Show the proposed atom(s) to the user before locking — which axes are reused vs. new, and why.
   The user confirms before the lock proceeds.

**The lock sequence:** lock → Review's three deterministic checks run against the compiled index
→ pass promotes any genuinely new axis into `registry.json` → fail interrupts the lock, reports
the finding, the user decides, then it's re-reported.

**Review's three deterministic checks**, all against `_index/decisions.json`, zero inference —
executed as a real script folded into the merged `PostToolUse` file-watcher, never performed by
Claude reading and comparing JSON itself (an LLM "eyeballing" a comparison is still inference and
can drift between runs; a script can't). Claude's role is presenting the script's findings, never
running the comparison:
- **Vocabulary check** — does any axis fail to exist in `registry.json`? (a spell-checker)
- **Conflict check** — same axis, different choice, across two features? (a fact-checker)
- **Value-inversion check** — same literal value showing up under two different axes?

No separate manual "check everything" command exists — the hook fires on every `atoms.json`
write regardless of source (a normal lock, a management-info conversion, Discovery's bootstrap
dump), so there's no gap for a manual sweep to fill.

**Management-info's Rules vs. Preferences** compile differently: Rules become real
`status: locked` atoms (same path as any other atom). Preferences never become atoms — they stay
plain reference text, read during discussion, never entering the compiled decision index.

**The JSON file matrix:**

| File | Committed? | Role |
|---|---|---|
| `features/FEATURE-NAME/atoms.json` | yes | Original, per feature — small files avoid merge collisions. |
| `Vocabulary/registry.json` | yes | Original, shared, append-mostly. |
| `_index/decisions.json` | no (gitignored) | Pure aggregation of every `atoms.json`, rebuilt automatically whenever any of them changes — committing it would only produce meaningless full-file-rewrite conflicts. |

**Supporting mechanisms**, all part of the merged `PostToolUse` file-watcher (see the file's
dispatch table below): the **sync-check** (a feature's `.md` changed without its `atoms.json`, or
vice versa — one-line reminder, no LLM call), the **orphan-check** (a dangling `depends_on`, or a
`registry.json` entry still referenced after removal), and the **constraints digest** (axis +
choice only, no prose, every `locked`/one-way atom, injected at `SessionStart` — so Claude already
knows what it can't silently override before it writes anything).

**`PostToolUse` file-watcher — dispatch by filename, precise (not every row does the same thing):**

| File changed | What fires | Cost |
|---|---|---|
| `FEATURE-NAME.md` / `--subfeature.md` | Sync-check only, against this feature's `atoms.json` | Free |
| `features/FEATURE-NAME/atoms.json` | Sync-check + recompile `_index/decisions.json` + all three Review checks (vocabulary/conflict/value-inversion, real script, never Claude comparing by reading) + orphan-check's `depends_on` direction | Free |
| `Vocabulary/registry.json` | Orphan-check's registry direction only | Free |
| `management-info.md` | Trigger only, hands off to the Rules/Preferences conversion pass | Trigger is free; the conversion pass itself is a real reasoning step, not free |
| `_current-task.md` | Mirror newly-locked entries into `_full-context.md`, append-only | Free — pure copying, no interpretation |
| any other source file | Refresh that file's module-map node | Free |

`atoms.json` is the one row that cascades into everything — it's the only file the deterministic
checks actually compare, so a pure `.md` or `registry.json` edit alone never triggers Review's
three checks. First action on every fire is a cheap "is this in the vault at all, or a tracked
source file?" path check with an immediate exit — the common case during normal coding.

**Build requirement: reminders must use `additionalContext`, not plain stdout.** `PostToolUse`
can't block anything — the write already happened by the time it runs — and plain stdout text on
a normal exit never reaches Claude, only the human's transcript. The only way a sync-check or
orphan-check finding actually reaches Claude is a JSON response with a
`hookSpecificOutput.additionalContext` (or `systemMessage`) field. Skipping this makes every
finding above silently invisible to Claude.

## Explicitly not part of this schema

- **No mandatory HTML recap.** A generic version of this convention builds a
  `feature-name--recap.html` per feature; Blueprint's shipped methodology does not require one.
  A project may still choose to build one as its own convention, but `docs-management` doesn't
  assume or template it.
- **No `PROGRESS.md` requirement.** Logging design-work milestones to a git-tracked
  `PROGRESS.md` is a personal/team convention some installations layer on top of Blueprint — it
  is not part of the methodology this skill ships, and nothing here assumes the file exists.
- **The feature-definition test and Ratification-at-Contact are not owned here.** Both live in
  `using-blueprint`, guaranteed present every session via the Orientation hook. This skill
  references them (see "Sub-features are optional" above) but never restates their logic —
  keeping that boundary explicit avoids the two copies drifting apart.

## Vault File Formats

### `_features.md`
```markdown
---
tags: [index]
---

# Features Overview

- **FEATURE-NAME** — one-line description (agent-assist)
- **FEATURE-NAME** — one-line description (manual)
```
The `(agent-assist)` / `(manual)` tag is the user-agent's batch assignment
— see `skills/user-agent/SKILL.md`. Absent until the batch question first
locks (e.g. a brand-new, not-yet-scoped project); `vault-architect` adds
and updates it, never the user by hand.

### `_plans.md`
```markdown
---
tags: [index]
---

# Plans Overview

- **PHASE-1-NAME** — one-line description
- **PHASE-2-NAME** — one-line description
```

### `_architecture.md`
Global, system-level view of how the whole thing fits together — sits above the per-feature files.
```markdown
---
tags: [index]
---

# System Architecture

## Overview
What the system is, end to end, in a few sentences.

## Features & connections
How the features relate — who calls whom, what flows between them. Prose first; a Mermaid diagram
if it helps.

## End-to-end workflow
Walk a single request/scenario through the system from input to output, naming each feature as it
participates.

## Feature map
- [[FEATURE-A]] — one-line role in the system
- [[FEATURE-B]] — one-line role in the system

## Unconfirmed decisions
Values inferred (not yet confirmed) — tagged `needs-review`, locked into the relevant feature's
`atoms.json` (`status: locked`/`ratified`) only once ratified in conversation.
```

### `features/FEATURE-NAME/FEATURE-NAME.md`

The lean parent — and, whenever the feature-definition test doesn't justify a split, the *only*
file for that feature. Says what the feature is, what it does, and why — depth (decisions,
tradeoffs, requirements) only moves into a sub-feature file when a split is actually justified.

```markdown
---
tags: [feature]
---

# Feature Name

## What it does
Plain-language description of the feature's role and responsibilities. No tech, no implementation
details. What does this part of the system need to accomplish?

## Rationale
Why this feature exists, and any tradeoffs in how it is scoped or shipped (command vs. skill,
what it deliberately does NOT own, etc.). If the feature stays single-file, this is also where its
key decisions live.

## Details
Specific decisions, constraints, or requirements. Only present when the feature is single-file
(no sub-feature split was justified) — otherwise this section lives in the sub-feature file(s)
instead, and this parent stays limited to What it does / Rationale.

## Sub-features
Only present when at least one sub-feature exists.
- [[FEATURE-NAME--subfeature-name]]

## Links
- [[OTHER-FEATURE]] — nature of the connection
- [[PHASE-N-NAME]] — phase where this is implemented
```

### `features/FEATURE-NAME/FEATURE-NAME--subfeature-name.md`
Written only when the feature-definition test justifies splitting this piece out of the parent.
```markdown
---
tags: [subfeature]
---

# Subfeature Name

## Rationale
Why this specific approach was chosen.

## Details
Specific decisions, constraints, or requirements for this subfeature. Record each locked decision
as an atom in this feature's `atoms.json` — see Decision atoms above — rather than a literal
value copy-pasted into prose if it's externally observable or another feature might depend on it.

## Illustrative snippet
Short code reference — not source of truth. Source lives in the repo.

```python
def example():
    pass
```

## Links
- [[FEATURE-NAME]]      ← parent feature
- [[PHASE-N-NAME]]      ← phase where this is implemented
```

### `plans/PHASE-N-NAME.md`
```markdown
---
tags: [phase]
---

# Phase N — Name

## Scope
What gets built in this phase and what is verifiable at the end.

## Steps
1. [[PHASE-N-NAME--step-a]]
2. [[PHASE-N-NAME--step-b]]

## Linked features
- [[FEATURE-NAME]]
- [[FEATURE-NAME--subfeature-name]]
```

### `plans/PHASE-N-NAME--substep-name.md`
Written only when a phase step is substantial enough to warrant its own file.
```markdown
---
tags: [substep]
---

# Substep Name

## What
Specific task description.

## How
Approach and implementation notes.

```python
def relevant_function():
    pass
```

## Links
- [[PHASE-N-NAME]]                  ← parent phase
- [[FEATURE-NAME--subfeature-name]] ← related sub-feature, if any
```

### `plans/PHASE-N-NAME.json`
Plan-Discussion's task storage — one flat file per phase (matching `plans/`'s own flat layout,
unlike features which get folders). Fields mirror an atom: `id`, `description`, `exit_criterion`
(the machine-verifiable check a task is done), `depends_on`, `status`. Same writer
(`vault-architect`), same principle as `atoms.json`.

## When to read

- Session start: read `vault-<project-name>/_index.md`, `_current-task.md`, and `_queue.md`.
- Before implementing a feature: read the relevant `FEATURE-NAME.md` and any sub-feature files.
- Before starting a phase: read the relevant `PHASE-N-NAME.md` and any substep files.
- Architecturally ambiguous: check `_architecture.md`, or `features/` for a specific feature.
- Before locking a new decision: read `Vocabulary/registry.json` to check whether an axis for this
  question already exists before coining a new one — see Decision atoms above.
- **Only when strictly necessary** (a hallucination, a big or repeating mistake, a clear
  misunderstanding with the user): read `_full-context.md`. This is the one exception to every
  rule above — never open it in normal flow.

## When to write

Only after a sub-feature's discussion is complete — never during, never incrementally. The one
exception: if a significant change (including one discovered during implementation) invalidates a
prior decision, update the affected vault files immediately and note what changed and why.

**Who writes them.** Dispatch the `vault-architect` agent to perform the actual vault writes and
edits. The main conductor's job is discussing and deciding with the user and logging every locked
decision into `_current-task.md` as it happens (`_full-context.md` is mirrored automatically by
the file-watcher hook — never written directly). Once a sub-feature's discussion concludes, hand
it to `vault-architect` to author or update that sub-feature's file. `_current-task.md` itself is
only cleared once every sub-feature of the *current feature* is discussed and written — not after
each individual sub-feature. Don't write or edit vault files directly in the main conversation.
