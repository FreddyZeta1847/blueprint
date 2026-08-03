---
name: docs-management
description: Use whenever creating, reading, or updating a project's design documentation (its Obsidian vault, `vault-<project-name>/`, or equivalent doc system) — the single source of truth for decisions, rationale, and architecture. Covers folder/file layout, naming conventions, frontmatter tags, the Mermaid-diagram rule, the Contracts file, and every file template. Triggers on writing a feature/sub-feature/phase/substep file, updating `_index`/`_features`/`_plans`/`_architecture`, adding or looking up a value in `Contracts/contracts.md`, or any question about where something belongs in the docs.
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
below (optional sub-features, `contracts.md` naming, no mandatory recap, no `perché` field, no
assumed `PROGRESS.md`). Do not silently re-merge those differences back in.
-->

## Structure

```
vault-<project-name>/
├── _index.md
├── _architecture.md
├── _features.md
├── _plans.md
├── _current-task.md
├── Contracts/
│   ├── contracts.md   (confirmed, live values only)
│   └── dismissed.md
├── features/
│   └── FEATURE-NAME/                         ← one folder per feature, named after it
│       ├── FEATURE-NAME.md                   ← the lean parent, always present
│       └── FEATURE-NAME--subfeature-name.md  ← optional, only where the feature-definition
│                                                test justifies a split within this feature
└── plans/
    ├── PHASE-1-NAME.md
    └── PHASE-1-NAME--substep-name.md         ← optional, same rule as sub-features
```

The vault folder is named after the project itself (`vault-<project-name>/`), never a generic
`vault/`. It is gitignored — it's the reasoning behind the code, not a mirror of it.

**Each feature gets its own folder** under `features/`, named exactly after the feature. The lean
parent file and any of that feature's sub-feature files live inside it. Obsidian resolves
`[[wikilinks]]` by filename regardless of folder, so links are unaffected by the folder layout.

`_index.md` — map of every file in the vault. Update every time a file is added or removed.

`_architecture.md` — global, system-level architecture: how all features connect and the
end-to-end workflow of the system. Bird's-eye view; per-feature internal structure lives in that
feature's own file(s). Updated whenever a feature is added or the connections between features
change. Also holds any unconfirmed Contracts candidates (tagged `needs-review`) until ratified —
see Contracts below.

`_features.md` — overview of all features with a short description of each. Updated whenever a new
feature is added.

`_plans.md` — overview of all implementation phases with a short description of each. Updated
whenever a new phase is added.

`_current-task.md` — the live discussion log. Everything belongs here while a topic is still
open: reasoning, decisions, tradeoffs, candidate splits. Holds only the *currently-open* thread,
never a history of settled decisions — the moment something is written to its permanent vault
home, the corresponding entry is removed from `_current-task.md` in the same pass (see
`vault-architect`'s job description below).

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
| `_*.md` (index/meta: `_index`, `_features`, `_plans`, `_architecture`, `_current-task`) | `tags: [index]` |
| `FEATURE-NAME.md` | `tags: [feature]` |
| `FEATURE-NAME--subfeature.md` | `tags: [subfeature]` |
| `PHASE-N-NAME.md` | `tags: [phase]` |
| `PHASE-N-NAME--substep.md` | `tags: [substep]` |
| `Contracts/contracts.md`, `Contracts/dismissed.md` | `tags: [contract]` |
| any unconfirmed / drafted-without-live-confirmation file | add `needs-review` → e.g. `tags: [feature, needs-review]` |
| any parked / future file | add `parked` → e.g. `tags: [subfeature, parked]` |

**No `perché` field.** Superseded by the Ratification-at-Contact mechanism (owned by
`using-blueprint`): an item's open questions live as prose (or as the `needs-review` tag) and get
resolved the moment work actually touches them, not through a dedicated frontmatter field.

Recommended Graph view color groups (Graph view → Settings ⚙ → Groups → New group):
`tag:#feature` blue · `tag:#subfeature` light blue · `tag:#phase` green ·
`tag:#substep` light green · `tag:#contract` red · `tag:#index` grey ·
`tag:#needs-review` yellow · `tag:#parked` muted orange.

## Diagrams — use Mermaid, not ASCII

All diagrams in vault Markdown use **Mermaid** fenced code blocks (` ```mermaid `). Obsidian
renders them **natively** (no plugin) and they're far cleaner than ASCII box-drawing art, which
doesn't render as a diagram at all and is painful to edit. **Do not use ASCII diagrams in vault
Markdown.**

## Contracts (`Contracts/contracts.md` — not `registry.md`)

`Contracts/contracts.md` holds only **confirmed, live values** — durations, budgets, limits, enum
values — that another feature depends on, or that isn't obviously scoped to one feature alone.

**Rules:**
- Feature and Plan docs reference contract values **by id, never by literal** — `CONTRACT-001`,
  sequential, never reused even once an entry is removed.
- A literal number appearing in two different feature docs is a documentation bug — Review's
  deterministic pre-pass catches it directly; it means a value should have been registered here
  instead of copy-pasted.
- **Unconfirmed candidates never enter `contracts.md` directly.** A value drafted by Discovery
  (inferred from existing code, not yet confirmed by the user) lives inside `_architecture.md`,
  tagged `needs-review`, until it is ratified in conversation — only then does it get a
  `CONTRACT-00N` id and move into `contracts.md`.

Schema per entry:

```markdown
### CONTRACT-001 — [name]
- **Value:** ...
- **Owning feature:** [[FEATURE-NAME]]
- **Consuming features:** [[FEATURE-A]], [[FEATURE-B]]
- **Rationale:** one line
```

`Contracts/dismissed.md` logs findings from a cross-review pass that were raised and explicitly
dismissed by the user, with the reason — so they don't resurface in future review runs.

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

- **FEATURE-NAME** — one-line description
- **FEATURE-NAME** — one-line description
```

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

## Unconfirmed Contracts candidates
Values inferred (not yet confirmed) — tagged `needs-review`, promoted to `Contracts/contracts.md`
only once ratified.
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
Specific decisions, constraints, or requirements for this subfeature. Reference Contracts values
by id (`CONTRACT-00N`), never by literal, if the value is externally observable — see Contracts
above.

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

## When to read

- Session start: read `vault-<project-name>/_index.md` and `_current-task.md`.
- Before implementing a feature: read the relevant `FEATURE-NAME.md` and any sub-feature files.
- Before starting a phase: read the relevant `PHASE-N-NAME.md` and any substep files.
- Architecturally ambiguous: check `_architecture.md`, or `features/` for a specific feature.
- Before writing a value that might be externally observable: check `Contracts/contracts.md` for
  an existing id before inventing a new literal.

## When to write

Only after a full discussion is complete — never during, never incrementally. The one exception:
if a significant change (including one discovered during implementation) invalidates a prior
decision, update the affected vault files immediately and note what changed and why.

**Who writes them.** Dispatch the `vault-architect` agent to perform the actual vault writes and
edits. The main conductor's job is discussing and deciding with the user and logging the outcome
in `_current-task.md`; once a decision is locked, hand it to `vault-architect` (pointing at the
relevant `_current-task.md` section and any vault files it touches) to author or update the files
— and to remove the now-settled entry from `_current-task.md` in that same pass. Don't write or
edit vault files directly in the main conversation.
