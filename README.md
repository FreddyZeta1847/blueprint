<p align="center">
  <h1 align="center">Blueprint</h1>
  <p align="center"><b>A documentation-driven development methodology for Claude Code</b></p>
  <p align="center">Waterfall docs, agile implementation — a vault as the only memory for a stateless AI implementer.</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude-D97757?style=for-the-badge&logo=anthropic&logoColor=white" />
  <img src="https://img.shields.io/badge/Claude%20Code%20Plugin-2563EB?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white" />
</p>

---

## Status: designed, not yet built

Be clear-eyed about what this repo currently is. Blueprint's full design is done: **12
features**, each fully written up in an internal vault, checked against each other across
**4 separate audit passes** (each one found and fixed real contradictions — see
[`PROGRESS.md`](PROGRESS.md) for the sanitized log).

What actually *runs* today is much smaller. **Phase 1** of implementation is complete: the
vault's file schema (`skills/docs-management/SKILL.md`) and its one writer agent
(`agents/vault-architect.md`) both exist in this repo. Everything else described below —
all 3 hooks, 9 of the 10 skills, both commands, and 2 of the 3 agents — is design
only. It is written down in detail (see `vault-blueprint/` if you have access to it), but
none of it is running code yet. **You cannot install and use Blueprint today.** This README
describes the finished design so you can evaluate it, and states plainly, later on, what
already exists versus what's still on paper.

---

## The problem Blueprint is trying to solve

Claude Code already has a **Plan Mode** — you describe what you want, Claude drafts a plan,
you approve it, it builds. That works well for one task in one sitting. It has two limits
that matter once a project grows past a single session:

1. **It doesn't persist.** A plan lives inside one conversation. Once that session ends,
   the reasoning behind what was decided is gone — Claude starts the next session with no
   memory of it, unless someone happens to paste the old plan back in.
2. **It doesn't cross-check.** Say you decide in week 1 that a feature uses JWT tokens for
   authentication. In week 6, while building something unrelated, Claude has no way of
   knowing that decision exists — so nothing stops it from quietly building a second,
   contradicting login flow, or assuming a database table that was never actually created.

Blueprint is built around one fact: **Claude Code has no memory between sessions except
what is written down somewhere it will actually read.** Given that, the methodology follows
a simple split:

- **Waterfall docs** — decide first, record the decision, *then* build. Not because
  waterfall is fashionable (it isn't), but because a decision that only exists in someone's
  head, or in a chat transcript nobody re-reads, is a decision Claude will contradict later
  without knowing it.
- **Agile implementation** — once a piece of the design is locked, building it is fast and
  iterative, the same as any normal coding workflow. Blueprint doesn't slow down
  implementation; it front-loads the parts of a project (naming, contradictions, scope)
  that are cheap to fix on paper and expensive to fix in code.
- **A vault as the only memory** — every locked decision lives in a folder of Markdown and
  JSON files called the *vault* (the term comes from Obsidian, a note-taking app that reads
  a folder of linked Markdown files as a single knowledge base). Claude is treated as fully
  **stateless**: it is never trusted to "just remember" a decision from three sessions ago.
  If it isn't in the vault, as far as the next session is concerned, it never happened.

## Who this is for

This is a genuine tradeoff, not a universal upgrade — Blueprint is worth adopting on
**larger or longer-lived projects**, where a decision made in month one still needs to hold
in month six, and where a silent contradiction between two features is expensive to find
after the fact.

It is *not* free to run. Locking a decision, running the automatic checks, and keeping a
parallel vault in sync all cost real setup and real discipline. For a quick script or a
weekend project, that overhead buys almost nothing — there's no "month six" to protect
against, and nobody but you will ever read the audit trail. Use plain Plan Mode for that.
Reach for Blueprint when the project is big enough, or will live long enough, that forgetting
a decision actually costs something.

---

## How it works: the pipeline

A session under Blueprint follows one continuous flow, from opening the repo to pushing
code. Here's the walkthrough, feature by feature:

1. **A session starts.** A `SessionStart` hook fires automatically — no user action needed
   — and does four things in one shot: it tells Claude what Blueprint is and how to route
   itself, shows the project's current state (what's mid-discussion, what's already
   decided), injects a **constraints digest** (a compact list of every locked, irreversible
   decision, so Claude knows what it can't silently override *before* it writes anything),
   and runs a staleness check (did any files change outside Blueprint since last time?).
   This is Blueprint's answer to "how do you force a stateless agent to actually read the
   vault" — a hook guarantees it happens, where a written instruction only hopes it does.

2. **The user runs `/blueprint`.** This bootstraps the repo and branches deterministically:
   an **empty repo** goes straight into a whole-project brainstorm; an **existing repo**
   first goes through **Discovery**, which reverse-engineers the current codebase into
   draft features and draft decisions (tagged `needs-review`, since nobody has confirmed
   them yet) before anything else happens.

3. **Brainstorming** scopes the work at a coarse level — "what kind of project is this,
   have you considered X" — and ends with a feature list (for a whole project) or a single
   scoped idea (for one addition to an existing project). It never locks fine-grained
   decisions itself; that's the next feature's job.

4. **Feature-Detection** looks at everything the user just described — one item or several
   — and, in a single pass, makes exactly one firm call per item: does this need
   documentation at all, or is it routine work under an already-decided pattern (in which
   case it's just code, nothing recorded)? For anything that does need documentation, it
   adds one soft, non-binding hint — a whole new **feature**, or something smaller
   (internally called a **topic**; that word never surfaces to the user). "Feature" is only
   ever proposed when the grounding is genuinely strong, because guessing wrong there is
   expensive — it commits to a different starting structure — where guessing wrong on a
   topic's exact shape isn't; that gets sorted out cheaply, later, once real discussion
   happens. The whole list, plus a suggested processing order, is shown once for the user to
   correct and confirm — never a separate interruption per item.

5. **Topic-Discussion** converges each queued item into a locked design. A feature gets a
   short scoping pass first (deciding its own sub-feature split); each sub-feature — or a
   smaller topic, directly — then goes through two structurally separated phases: **diverge**
   first (real alternatives get weighed — say, JWT vs. sessions vs. OAuth-only for an auth
   sub-feature, and just as naturally how it caches, recovers from a dropped connection, or
   behaves if two of it run at once, not only its headline choice), *then* **converge** (pick
   one, record why the others lost). This is a real structural gate, not just a tone
   instruction — phase 2 cannot start until phase 1 has actually produced alternatives, so
   the discussion can't skip straight to a conclusion. At a real fork — especially a
   converge-time choice with genuine alternatives, like "what type of database should we
   use?" — Claude may put the options in front of the user directly with Claude Code's own
   multiple-choice tool, its own recommendation included as one option, instead of only
   prose. Only once discussion has actually happened does a final **Recheck** step decide
   the shape (its own file, or a paragraph on an existing one) and which feature it belongs
   to — never guessed upfront.

6. **Every lock writes two things at once**: the sub-feature's own Markdown file, and its
   **decision atom** (see below) into that feature's `atoms.json`. That single write
   immediately fires an automatic check for contradictions — **before** the next
   sub-feature's discussion even starts. This ordering is deliberate: if checks only ran at
   the very end, an early bad decision could sit unnoticed while five later sub-features
   quietly build on top of it.

7. Throughout all of this, **`vault-architect`** is the one agent that actually writes to
   the vault. No other feature, and no ad-hoc edit, writes a vault file directly — one
   writer means the format never drifts between features.

## Decision atoms: what makes cross-checking cheap

Prose is for humans. Two features can each describe an authentication decision in a full
paragraph, and the only way to know if they agree is for someone (or some LLM) to re-read
both and compare — which is slow, and can give a different answer each time you ask.

A **decision atom** is a small, structured record of exactly one locked decision, designed
to be compared by a plain script instead. Every atom has:

| Field | What it holds | Example |
|---|---|---|
| `axis` | The question, written as a full sentence — never a short label | `"what database engine does this feature use?"` |
| `choice` | The answer that was actually picked | `"postgres"` |
| `rejected` | The real alternatives considered, and why they lost | `[{"mysql": "no ops experience on the team"}]` |
| `reversibility` | `one-way` (hard to undo) or `two-way` (easy to change later) | `one-way` |
| `status` | How confidently this was decided | `ratified` (a live human confirmation), `locked` (a manager's Rule), `agent-approved` (a fast, agent-made guess), `inferito`/`ereditato-ignoto` (an inferred guess from existing code) |

Writing `axis` as a full question, not a bare noun like `db`, matters more than it looks:
a label like `db: sql` could mean "which engine" or "how many tables" — two different
questions colliding under one name. A full question makes that collision impossible.

Every time an atom locks, three checks run automatically — for free, as real code, never
as an LLM "eyeballing" a comparison (which can drift between runs; a script can't):

- **Vocabulary check** — does this `axis` even exist in the project's shared vocabulary?
  (a spell-checker)
- **Conflict check** — do two features answer the *same* question with a *different*
  answer? (a fact-checker — e.g. Feature A locks `auth: jwt`, Feature B locks `auth:
  sessions`; same axis, different choice, flagged instantly)
- **Value-inversion check** — does the same literal value show up answering two *different*
  questions? (a backstop against a mislabeled axis)

## The audit trail — a report for humans, not a fallback for Claude

Blueprint keeps an auto-generated changelog of every decision change: who changed it, when,
and why (reusing the atom's own `rationale` field — no separate write needed). It's written
the instant a change happens, never batched at the end of a session, so a crash or an abrupt
close never loses the record. This file exists for **people** — a teammate arriving six
months later and finding, say, no JWT anywhere, can see immediately who removed it and why,
instead of guessing.

This is a completely different file from `_full-context.md`, an internal, machine-only
fallback that mirrors the live discussion log append-only. `_full-context.md` has no human
audience — it exists purely so Claude can re-ground itself after a mistake, and is read only
when something has clearly gone wrong (a hallucination, a repeated error), never as part of
normal flow. One is a report; the other is a safety net. They are never the same file.

## `management-info.md` — encoding a manager's input

A manager or tech lead can drop top-down input into one plain Markdown file, split into two
sections with different authority:

```markdown
## Rules (binding)
- Always use JWT for auth
- Anthropic, not OpenAI

## Preferences (defaults, can be overridden)
- We lean cost-sensitive over maximum scalability
- Prefer managed services where the cost is close
```

**Rules** become real locked atoms — exactly as binding as any decision reached in a live
discussion, and enforced by the same conflict check described above. **Preferences** never
become atoms; they're read as background color during a discussion (nudging suggestions
toward "cost-sensitive," say) but never treated as an actual decision, because nobody
decided them — they're a starting lean, not a lock.

When a discussion runs into a locked Rule, the alternatives it blocks still show up in the
conversation, marked **"blocked by management-info"** — never silently removed. That keeps
the *why* visible: six months later, someone can still see that OAuth was considered and
rejected because of a rule, instead of wondering whether anyone ever thought of it.

## The user-agent — the one thing that isn't scoped to one project

Every other piece of Blueprint lives inside one project's vault. The user-agent doesn't,
because how a person reasons and what they tend to pick tends to repeat across their whole
body of work, not just one repo. It has two separate parts:

- **Profile** — passively remembers past choices and general tendencies. Advisory only; it
  never acts on its own, and only real, human-confirmed decisions are ever allowed to shape
  it (an agent's own fast guess never feeds back into what it learns — that would let a
  guess reinforce itself).
- **Agent-assist mode** — can act on the user's behalf, but only for **two-way**
  (reversible) decisions. For anything **one-way** (irreversible), it always stops and asks
  first — a floor enforced by a dedicated hook, not just an instruction, so it holds no
  matter what permission mode Claude Code is currently running in.

Assignment happens once, in a single batch question right after a project's feature list
locks — "which of these features should run on agent-assist, which stay manual?" — with the
option to override any one feature live, later, if it turns out to need closer attention.

## Two checks that actually cost tokens — and why almost nothing else does

Everything described above (the three deterministic checks, the sync-check, the constraints
digest) is free: real code, zero LLM calls, running automatically off file changes. Blueprint
keeps exactly two checks that are expensive and optional, both off by default:

- **`deep-review`** — an explicit command that dispatches real subagents to read full
  prose *and* atoms together, across every feature, catching paraphrase-level
  contradictions the free checks structurally can't see (two features that agree on every
  atom but subtly contradict each other in the reasoning paragraphs around them).
- **The pre-publish coherence check** — the same idea, aimed at real code instead of vault
  prose, offered right when the user is about to push: "do you want to verify the code you
  just wrote still matches what was decided?" Never silent, never forced — a yes dispatches
  a real check; a no just makes the push safer without blocking it.

A third mechanism, `engineering-sheets`, shares that same real-cost, ask-first discipline —
see below.

## Engineering sheets — a second, opt-in view of the same vault

Everything above produces prose and JSON. Engineering sheets are a different lens on the
exact same data: one self-contained HTML file, built only when asked, with a project-wide
**Sheet 0** — every component, every connection between them, drawn as if for the engineer
who has to hold the whole system in their head — plus one sheet per feature, written as if
for the engineer who owns only that one piece: that feature's own internal mechanism in full
(state management, caching, how it recovers when a connection drops, what happens if two of
it run at once), with every neighboring feature reduced to a black box — just the contract,
what goes in and what comes out, never its internals. Every failure point gets a small
numbered badge exactly where it can happen, and one legend at the end explains every badge in
plain language: what breaks, when, and how it's already handled.

None of this needs a new way of capturing information. A choice about caching or failure
recovery is already an ordinary decision atom, exactly like a choice of framework —
Topic-Discussion's diverge phase already weighs it that way (see above). Engineering sheets
are a pure rendering step over decisions that were already locked; building or refreshing one
is always offered, never automatic — the same "asked, never silent, never forced" rule that
governs `deep-review` and the pre-publish check.

## Token-safe by design

This is a deliberate, named principle, not a side effect: **nearly everything in the hot
path costs nothing.** Every hook, the three deterministic checks, the sync-check, and the
staleness check are all real, deterministic code — zero LLM calls, every time. The only
real token costs anywhere in the system are opt-in and deliberate: `deep-review`, the
pre-publish check, `engineering-sheets`, and two reasoning passes (turning a manager's prose
into atoms, and updating the user-agent's Profile).

The same discipline applies to conversation cost, not just hook cost. The live discussion
log (`_current-task.md`) is deliberately kept lean: scoped to one feature at a time, and
cleared the moment that feature's decisions get written to their permanent home. Without
that discipline, a growing project would make every new session more expensive just to
orient into — Blueprint is built specifically so it doesn't.

---

## Using Blueprint (once it's built)

Blueprint ships as a single, self-hosting Claude Code plugin: the same repo is both the
plugin and its own marketplace entry. Once Distribution's manifests exist and are
published, installation follows the normal Claude Code plugin flow:

```
/plugin marketplace add <owner>/blueprint
/plugin install blueprint
```

From there, a session looks like this: open a repo, and the `SessionStart` hook orients
Claude automatically. Run `/blueprint` once — it detects whether the repo is empty or
already has code and branches accordingly (straight to brainstorming, or through Discovery
first). Every decision from there on gets discussed, locked, and written to the vault as it
happens, checked automatically as it's written, with the vault carrying every session's
memory forward so nothing has to be re-explained to Claude next time.

None of this is installable yet — see **Status**, above.

## What's actually built right now

| Piece | Count (design) | Built |
|---|---|---|
| Hooks (`SessionStart`, `PostToolUse`, `PreToolUse`) | 3 | 0 |
| Skills | 10 | 1 — `skills/docs-management/SKILL.md` |
| Commands (`/blueprint`, `/deep-review`) | 2 | 0 |
| Agents (`vault-architect`, `profile-updater`, `sheet-designer`) | 3 | 1 — `agents/vault-architect.md` |

`docs-management` and `vault-architect` together are Phase 1: the vault's file schema and
its one writer. Everything else in the table — every hook, the remaining 9 skills, both
commands, and the `profile-updater`/`sheet-designer` agents — exists only as design, written
up in full detail in the project's internal vault, not yet implemented.

## Repository layout

```
blueprint/
├── agents/
│   └── vault-architect.md      # the vault's one writer — built
├── skills/
│   └── docs-management/
│       └── SKILL.md            # the vault's file schema — built
├── PROGRESS.md                 # sanitized, git-tracked log of design milestones
└── README.md
```

Everything else described in this README — `commands/`, `hooks/`, the other 9 `skills/`
folders, and `agents/profile-updater.md`/`agents/sheet-designer.md` — will land here as later
implementation phases complete.
