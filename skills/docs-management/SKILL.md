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
├── _queue.json                 (pending topics: features/subfeatures/notes, see below)
├── _audit.md                   (committed — auto-generated who/when/what/why changelog, see below)
├── _full-context.md            (gitignored — machine-read only, mirrored from _current-task.md, see below)
├── Vocabulary/
│   ├── registry.json           (committed — shared axis vocabulary: { id, question } pairs)
│   ├── dismissed.json          (committed — Review findings dismissed, with reason)
│   └── ignored-values.json     (committed — absent-answer values the value-inversion check skips)
├── _index/
│   ├── decisions.json          (gitignored — compiled from every feature's atoms.json)
│   └── unassigned.json         (gitignored — source files owned by no feature yet)
├── Sheets/
│   └── engineering-sheets.html (optional — see 'Engineering sheets' below)
├── management-info.md          (optional, per-project — manager-authored rules/preferences)
├── local-profile.md            (the user's focus for this project — see below)
├── features/
│   └── FEATURE-NAME/                         ← one folder per feature, named after it
│       ├── FEATURE-NAME.md                   ← the lean parent, always present
│       ├── atoms.json                         ← this feature's decisions
│       ├── modules.json                       ← gitignored: the source files this feature owns
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

`_features.md` — overview of all features with a short description of each, plus its importance
and effort scores. Updated whenever a new feature is added.

`local-profile.md` — the user's **focus** for this project: which features they want to decide
personally, and which they hand to Claude. Written by `vault-architect` after brainstorming's (or
discovery's, or feature-detection's) focus question. Read by `blueprint:user-agent` to
pre-recommend the mode. Kept separate from `management-info.md` on purpose: management-info is the
manager's voice about the project, while focus is one person's choice about their own time — in a
team, two people can have opposite focus on the same project.

**Importance/effort scores and the local profile are never atoms.** They are not decisions — they
never enter `atoms.json`, the compiled index, or Review's checks.

`_plans.md` — overview of all implementation phases with a short description of each. Updated
whenever a new phase is added.

`_current-task.md` — the live discussion log, scoped to **one feature or topic at a time**. The
unit written into it is **"a decision was made"**, never "a sub-feature was locked" — finer-grained
than a lock, written the moment the decision is reached, never batched to the end.

**What one decision block holds:** the **chosen** option and nothing about the ones that lost — the
alternatives already live in the atom's `rejected` field. Concretely: the decision, **why** it was
chosen, its **pros**, its **cons**, known **problems** or risks it carries, and anything else needed
to understand it later. That content is the whole reason `_full-context.md` is worth keeping: the
atom holds `choice` + `rejected` + a short rationale, the feature prose holds the settled
description, and **neither holds the weighing**.

If a decision is later revised, its entry is updated to show the current answer only — this file is
a live snapshot, never a history (the history lives in `_full-context.md`). Each sub-feature's real
vault file is still written the moment that sub-feature's own discussion concludes (see
`vault-architect`'s job description below) — but `_current-task.md` itself is only cleared once the
*whole* feature or topic is discussed and written.

`_queue.json` — every topic identified but not yet individually taken through `topic-discussion`'s
full cycle. JSON, not Markdown — this is structured data for machine comparison, not prose, same
reasoning that already put atoms and the registry in JSON. Schema: `{ entries: [{ id, description,
shape_hint, target, importance?, effort?, status }] }` — `importance` and `effort` are optional 1–5
integers, set on top-level features only; sub-features and notes inherit their target feature's
scores (an entry with no score and no scored parent is treated as 3). `shape_hint` is `feature` / `topic` — `topic` meaning "needs
documentation, not a feature," internal data only, never shown to the user as the word "topic" — and
is Claude's best grounded guess at classification time, **explicitly non-binding**. `target` names a
likely related feature, if one was identified, same non-binding caveat. `topic-discussion`'s Recheck
step is what actually confirms or revises both, once real discussion has happened; only the "does this
need documentation at all" call is firm, decided before anything is queued. The array
order **is** the processing order — no separate ordering field. Claude proposes it once, when the
queue is first populated; items added later (a feature's own sub-feature split) get inserted into
the existing order, never trigger a full re-proposal. Populated
at three moments, all using the same file: Feature-Detection splitting a request that describes more
than one item (the feature-definition test applies here, not only at whole-project scale — "today we
make frontend and backend" is two entries, not one); a feature's own intro stage deciding its
sub-feature split (same mechanism, one level deeper — a feature's sub-features are queued exactly
like top-level topics are); and Brainstorming's whole-project feature list. `SessionStart` injects
this file every session alongside `_current-task.md` and `_index.md`, so a pending item is never
something Claude has to remember on its own. `vault-architect` writes new entries and checks one
off — removes it — the moment that item's own cycle is fully written to its permanent home. Stays
small by the same discipline as `_current-task.md`: nothing lingers once it's done.

`_full-context.md` — a machine-read-only fallback file, plain Markdown, never HTML (HTML recaps
stay human-facing; this one is read by Claude, never shown to the user as a deliverable). The
`PostToolUse` hook appends **the exact same string** that was just written to `_current-task.md` —
not a filtered subset, not a re-summary, the identical block. There is no marker convention and no
id, because the hook has nothing to tell apart: everything in the scratchpad is worth preserving.
**Append-only** — never overwritten, so a later reversal (a decision changed, then changed back)
leaves the full trail standing even after `_current-task.md` has been cleared.

Mechanically the hook branches on the tool: an **`Edit`** carries `new_string`, which *is* the newly
added text, so it is appended directly. A **`Write`** carries the whole file, so appending it would
duplicate everything already mirrored — and a `Write` here happens exactly twice in the file's life,
at first creation and at the clear. So a `Write` is appended only when the mirror is still empty;
otherwise it is skipped, because a clear adds no new reasoning.
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
| `_*.md` (index/meta: `_index`, `_features`, `_plans`, `_architecture`, `_current-task`, `_full-context`), and `local-profile.md` | `tags: [index]` |
| `FEATURE-NAME.md` | `tags: [feature]` |
| `FEATURE-NAME--subfeature.md` | `tags: [subfeature]` |
| `PHASE-N-NAME.md` | `tags: [phase]` |
| `PHASE-N-NAME--substep.md` | `tags: [substep]` |
| any unconfirmed / drafted-without-live-confirmation file | add `needs-review` → e.g. `tags: [feature, needs-review]` |
| any parked / future file | add `parked` → e.g. `tags: [subfeature, parked]` |

`atoms.json`, `Vocabulary/registry.json`, `_index/decisions.json`, `_queue.json`, and
`PHASE-N-NAME.json` are plain JSON data files, not frontmatter-tagged Markdown — the
frontmatter/tags system above only applies to `.md` files.

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
| `axis` | The **registry id** of the question this atom answers — e.g. `"db-engine"`. The question text itself lives once, in `Vocabulary/registry.json`, and is never copied into the atom, so rewording a question never rewrites an atom. The *registered question* must still be written in full (`"what database engine does this feature use?"`), never a bare noun: a noun-style axis like `db` invites two different questions (engine choice vs. table count) to collide under one label. Register the full question; store the id. |
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
   other features. It catches an obvious conflict before writing.
3. The user has already confirmed the **plain-language decision summary** (every decision, with
   the one-way and two-way ones marked; see `blueprint:topic-discussion`). Atoms are internal and
   are **never shown to the user**. The user must never see the words atom, axis, status, or any
   field name.

**The lock sequence:**
1. Register every genuinely new question in `registry.json` first.
2. Write `atoms.json`, with each decision's status taken from its per-decision mark
   (`confirmed` → `ratified`, `agent-decided` → `agent-approved`).
3. Review's three deterministic checks run against the compiled index.
4. `vault-architect` returns every result in its final report.
5. The main conversation explains any finding to the user in plain words, and the user decides.
6. Only then is the item told to the user as locked.

Registering first matters. If a question were registered only *after* the checks, the
vocabulary check would flag every new question as unknown, a guaranteed false alarm. With
registration first, the check still catches the real error it exists for: a decision pointing
to a misspelled or unregistered id.

**Review's three deterministic checks**, all against `_index/decisions.json`, zero inference —
executed as a real script folded into the merged `PostToolUse` file-watcher, never performed by
Claude reading and comparing JSON itself (an LLM "eyeballing" a comparison is still inference and
can drift between runs; a script can't). Claude's role is presenting the script's findings, never
running the comparison:
- **Vocabulary check** — does any atom's `axis` id fail to exist as an `id` in `registry.json`?
  Exact id membership, never a comparison of question text. (a spell-checker)
- **Conflict check** — same axis, different choice, across two features? (a fact-checker)
- **Value-inversion check** — the same literal `choice` showing up under two different axes.
  Skips the absent-answer values listed in `Vocabulary/ignored-values.json`, because a headline
  choice is a specific named thing (`jwt`) while non-headline axes (caching, retry, rate limiting)
  legitimately land on "nothing here" over and over — three correct `none` atoms would otherwise
  flag every pair and bury the one real collision. `yes`/`no` are deliberately **not** ignorable:
  a yes/no choice means the axis itself was authored wrong, which is a finding worth surfacing.

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
| `Vocabulary/registry.json` | yes | Original, shared, append-mostly. `{ id, question }` pairs. |
| `Vocabulary/dismissed.json` | yes | Original — findings the user ruled not real, with the reason, so they don't resurface. Written by `vault-architect` only, never a direct user edit. |
| `Vocabulary/ignored-values.json` | yes | Original — absent-answer values the value-inversion check skips. Shipped as a starter seed, extended per project. |
| `_index/decisions.json` | no (gitignored) | Pure aggregation of every `atoms.json`, rebuilt automatically whenever any of them changes — committing it would only produce meaningless full-file-rewrite conflicts. |
| `_index/unassigned.json` | no (gitignored) | Source files the module map doesn't own yet. Appended by the hook, which never guesses an owner. |
| `features/FEATURE-NAME/modules.json` | no (gitignored) | Pure derivation — the source files this feature owns. Rebuilt by the hook. |
| `_audit.md` | yes | Original and **not re-derivable** — the who/when/what/why changelog. See below. |

**The rule behind that column is "re-derivable", not "auto-generated".** `_index/decisions.json`
and `modules.json` are machine-written *and* rebuildable in a second from files that are themselves
committed, so tracking them buys nothing and costs conflicts. `_audit.md` is equally
machine-written but **cannot** be rebuilt — delete it and the authorship and timing history is gone
permanently — so it is committed. `_full-context.md` is the one deliberate exception on the other
side: also not re-derivable, but machine-only, with no human audience, and it grows without bound.

**`_audit.md` — the decision changelog.** Plain Markdown at the vault root, auto-generated,
append-only, **never hand-edited** (the hook appends it in the same pass as the sync-check, so it
costs nothing extra). Markdown rather than JSON on purpose: its entire job is being read by a
person who wasn't there, and a format that is easy for the script but unreadable to that person
fails its own requirement. It logs every atom change (added / changed / removed), pre-publish check
findings, and one-way-guard blocked-write events — **not** ordinary code edits, which are already
git history. The "why" reuses the atom's `rationale`, so no new field is needed. The "who" is
`git config user.name`, falling back to the OS username; reading the Claude account identity from a
hook was checked and is impossible. Entries carry a session id and are grouped at read time.

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
| `features/FEATURE-NAME/atoms.json` | Sync-check + recompile `_index/decisions.json` + all three Review checks (vocabulary/conflict/value-inversion, real script, never Claude comparing by reading) + orphan-check's `depends_on` direction + append the `_audit.md` entry + flag a new `ratified` atom for `profile-updater` | Checks free; the profile pass is a real reasoning step |
| `Vocabulary/registry.json` | Orphan-check's registry direction only | Free |
| `management-info.md` | Trigger only, hands off to the Rules/Preferences conversion pass | Trigger is free; the conversion pass itself is a real reasoning step, not free |
| `_current-task.md` | Append the written text **verbatim** into `_full-context.md` (`Edit` → append `new_string`; `Write` → only if the mirror is empty, since a `Write` here is the clear) | Free — pure copying, no interpretation |
| `_queue.json`, `local-profile.md` | None — plain read/write, no derived recompilation | Free |
| any other source file | Refresh that file's node in `features/*/modules.json`. A file owned by no feature yet is appended to `_index/unassigned.json` and its count surfaced — the hook never guesses an owner | Free |

**Delivery is load-bearing, not a detail.** `PostToolUse` cannot block anything — by the time it
runs, the write already happened. So its findings only reach Claude if the script returns JSON
carrying `hookSpecificOutput.additionalContext` (or `systemMessage`). Plain text printed on a normal
exit lands in a transcript a human may never open, and Claude never sees it. Every reminder in the
table above depends on that.

**Findings are presented, never resolved unilaterally.**
- The hook's messages reach whoever made the write, and that is normally the `vault-architect`
  subagent. It must **not** act on them. It copies them verbatim into its final report.
- The main conversation then presents them to the user.
- Nothing is dismissed, ignored, or rewritten until the user has decided. That includes
  extending `Vocabulary/ignored-values.json`.

Put all the findings in one message, in plain words (for example "the id scheme we chose for CAPTURE clashes with STORAGE's"), never as raw
axis or atom output. Group them by check type, with **conflicts first** (a same-axis conflict is the most likely to actually break
something). Never ordered by "confidence": these are pure yes/no comparisons with nothing to rank.
A dismissal goes through `vault-architect` into `Vocabulary/dismissed.json` with its reason, so it
never resurfaces — Review never writes that file itself.

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

## Engineering sheets (`Sheets/engineering-sheets.html` — opt-in, not a new writer)

Each sheet is a complete engineering reference for one piece, not a contract diagram: one
project-wide **Sheet 0** (every component as a subgraph, real steps as short 2-4-word nodes, real
cross-component arrows, already-locked tech decisions called out in a keynote box) plus one sheet
**per top-level feature**, drawn "as if for the engineer who owns only that piece" — that feature's
own complete internal mechanism in full detail (state management, caching, concurrency/locking,
security/sanitization, retry and backoff policies, every locked axis relevant to it, not only its
contracts), while every *neighboring* feature appears only as an opaque contract box (what goes in,
what comes out, never its internals). Every failure point is woven inline as a small numbered
badge at the exact spot it can occur, and one consolidated **Error Legend** at the end of the
document (grouped by which sheet owns each badge) states, per entry, what breaks, when, and how
it's already handled. All sheets live together in one single self-contained HTML file, navigable
via a sticky sidebar TOC — not scattered one-per-feature-folder.

A second agent, `sheet-designer`, reads every feature's already-committed atoms and prose and
renders this file. Nothing here is a new capture mechanism: state-management, caching,
concurrency, security, and failure-recovery choices are already exactly the shape of an ordinary
decision atom (see Decision atoms above, and `topic-discussion/SKILL.md`'s diverge-scope note) — a
sheet's keynote callouts of already-locked tech are literally just its `ratified`/`locked` atoms
read back in prose. `sheet-designer` never writes or edits vault Markdown or `atoms.json` —
`vault-architect` remains the single writer of every *authoritative* vault file; `sheet-designer`
only ever produces a derived, non-authoritative artifact from what's already locked.

Ships as a **skill, not a command — notices, never builds without asking.** Real token cost (a
real agent dispatch synthesizing an entire feature's worth of atoms into one engineering
narrative), so it follows `deep-review`/`pre-publish-check`'s rule: asked, never silent, never
forced. The skill notices its trigger (a feature reaching its last sub-feature; a relevant atom
changing after a sheet already exists) and *offers* to build or refresh — it never generates on
its own. Refreshing one feature's sheet also flags Sheet 0, and any feature whose contract with it
might have changed, as possibly stale, and offers to refresh those too — same ask-first
discipline, never automatic. No staleness-detection hook in v1 — build/refresh on demand only.

**Feature-placement note, kept honest about its own uncertainty.** `engineering-sheets` folds into
Documentation rather than earning its own top-level feature, because it fails the
feature-definition test's second half: nothing else in the pipeline reads a sheet back in, so it
has no external dependent — the same reason a generic `feature-recap` convention (see below) never
becomes a required vault feature either. That call could flip if a real dependent ever shows up (a
future check reading Sheet 0's data back in, say) — recorded here as open and revisitable, not
permanently settled.

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

- **FEATURE-NAME** — one-line description · importance 5/5 · effort 4/5 (manual)
- **FEATURE-NAME** — one-line description · importance 2/5 · effort 1/5 (agent-assist)
```
The scores are proposed by Claude and confirmed by the user when the feature list is agreed (see
`blueprint:brainstorming`, step 3). They stay here after the queue entry is checked off, so
the scores survive the queue.

The `(agent-assist)` / `(manual)` tag records that topic's answer to the mode
question — see `skills/user-agent/SKILL.md`. It is asked **once per top-level
topic**, at the moment that topic's own discussion begins, for any queue entry
with no `target`. There is no upfront batch question (that was tried and
removed: it asked the user to judge "boring vs. sensitive" from a bare name,
before anyone knew what the topic involved). So the tag is absent until that
feature's own discussion actually starts, and a sub-feature or note queued
underneath it inherits the parent's mode rather than getting its own tag.
`vault-architect` adds and updates it, never the user by hand.

### `local-profile.md`
```markdown
---
tags: [index]
---

# Local Profile

## Focus
- Cares most about: DESIGN, FRONTEND
- Wants Claude to handle: HOSTING, CONTACT
```
"All of them" is a valid answer: write `- Cares most about: all features` and leave the second
line out. A feature in neither list falls back to the global Profile, then to its importance (see
`blueprint:user-agent`). `vault-architect` updates it whenever the user changes their mind ("I
don't care about X"), never silently.

### `_index.md`
```markdown
---
tags: [index]
---

# Vault Index

Map of every file in the vault. Update on every file add or remove.

## Overview files
- [[_features]]
- [[_plans]]
- [[_architecture]]
- [[_current-task]]
- [[local-profile]]
- `_queue.json` — pending topics
- `_audit.md` — decision changelog (hook-maintained)
- `Vocabulary/registry.json`, `Vocabulary/dismissed.json`, `Vocabulary/ignored-values.json`

## Features
- [[FEATURE-NAME]]

## Plans
- [[PHASE-N-NAME]]
```
`SessionStart` injects this file every session, so keep it a map and nothing else — no
descriptions, no status prose. It is the cheapest thing in the vault and must stay that way.

### `_current-task.md`
```markdown
---
tags: [index]
---

# Current Task — Live Discussion Log

**Holds ONLY the currently-open feature or topic — cleared once it is fully written.**

## Now discussing — <FEATURE or TOPIC name> (<date>)

### <the decision that was just made>
- **Chosen:** <the option>
- **Why:** <the reasoning>
- **Pros:** <...>
- **Cons:** <...>
- **Problems / risks:** <... or "none identified">
```
One block per decision, appended the moment it is reached. Empty when nothing is open.

### The `Vocabulary/` files — exact shapes

These are read by real hook code, so the shape is not a matter of taste. Getting one wrong fails
**silently**: a `dismissed.json` in the wrong shape means dismissals never suppress anything, and
the user re-sees a finding they already ruled out, forever.

```json
// Vocabulary/registry.json
{ "entries": [ { "id": "db-engine", "question": "what database engine does this feature use?" } ] }
```
```json
// Vocabulary/dismissed.json
{ "entries": [ { "id": "d-001", "title": "<the finding text, verbatim>", "features": ["AUTH", "API"],
                 "date": "2026-09-26", "reason": "<why it is not real>" } ] }
```
```json
// Vocabulary/ignored-values.json  — the starter seed, verbatim
{ "values": ["none", "n/a", "not-applicable", "default", "standard", "disabled", "tbd"] }
```
Empty files use the same wrapper with an empty array (`{ "entries": [] }`), **never a bare `[]`**.
The seed list above is the literal set to ship — extend per project, but do not drop entries, and
never add `yes` or `no` (a yes/no `choice` means the axis was authored wrong, which is a finding
worth surfacing).

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

- Session start: read `vault-<project-name>/_index.md`, `_current-task.md`, and `_queue.json`.
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
