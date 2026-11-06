---
name: using-blueprint
description: "How Blueprint works: the pipeline (context → plan → stages), the hard rules, the routing table to the six skills, the boundary (Blueprint plans and discusses, it doesn't execute) and the shared concepts (one-way/two-way, who decides, how decisions are organised, plain-language summaries). Read at the start of every session in a Blueprint project and before any Blueprint step."
---

# Using Blueprint

<!--
Header comment: the entry point of Blueprint v3. It tells Claude how Blueprint works — the
pipeline, the hard rules every other Blueprint skill assumes, the routing table to the six
skills, the boundary between planning (Blueprint) and execution (not Blueprint) and the shared
concepts. It does not size requests: get-context does, from the context it derives. Keep it
short: details belong to the skill that uses them.
-->

## How Blueprint works

Blueprint gives the **pipeline**: **context → plan → stages**.

1. **Context** (`blueprint:get-context`). Every new request starts here. Claude derives what it
   needs to know from the context it already has (the request, the conversation, the repo, the
   user's rules), asks only what it cannot derive, and draws the **conclusions**: how big the work
   is, how difficult, at what pace. The conclusions decide what happens next:
   - **tiny** → one line of confirmation and do it, no files, no plan;
   - **fits the existing plan** → re-planning: new topics or a new stage, before → after;
   - **new work** (small, medium or a project) → the context card `blueprint/context.md`, confirmed
     by the user, then the plan.
2. **Plan** (`blueprint:create-plan`). Stages, each of one type, with optional topics and
   deadlines, saved in `blueprint/plan.json` after the user's OK. The plan can change (before →
   after, the user confirms).
3. **Stages.** Each stage runs through the fixed loop of its type (the plugin's
   `data/loops.json`): **discussion**, **implementation**, **delivery**, **quick task**. Every loop
   starts with the same mandatory **context check**: Claude must ask itself whether it has enough
   context to carry out the stage on its own, and fills the gap with the user when it has not. At
   the opening Claude says the answer, the topics, the phases and how it would do it; the user
   confirms.

The decisions taken in discussions (and the corrections an implementation forces on them) are
written, when the project needs it, in the **decisions folder** `blueprint/decisions/`.

## The boundary — what Blueprint does not do

**How a stage is executed is not Blueprint's business**: implementing, checking, design, sessions,
plugins, git. At the opening of each stage you tell the user how you would do it, with whatever
they have (their own skills, plugins, agents, habits), and they confirm. Blueprint never
prescribes it.

**Blueprint never hides other plugins.** Blueprint decides only *which phase* the work is in.
Inside any phase of any stage, every plugin, skill and agent the user has stays available, and
several can serve the same stage, one per phase. Example — a quick task "admin mockup": the
context check is a short discussion run with Blueprint; the mockup itself is made with a design
plugin; the check uses whatever the user checks with. In parallel work, each session gets the
plugins, skills and agents its part needs; a single session can use all of them. Being in a
Blueprint project is never a reason to skip a tool the user would otherwise use.

Two exceptions only:
- **Discussion** is Blueprint's own job (`blueprint:topic-discussion`): deciding is its trade.
- **Parallel work.** Blueprint knows work can run in parallel, so the plan puts the shared
  contracts first and records which parts are independent (`independent_parts`). *How* the
  parallel work is organised is decided at the opening.

## Hard rules — these override everything else in this project

1. **Speak the user's language, in plain words.** Never show Blueprint's machinery in chat: no
   field names, no JSON, no "atom", "registry", "status", "phase id". Talk about choices and
   stages in normal words. The card and the decisions are written in the user's language too (see
   `blueprint:docs-management` §5).
2. **Every new request goes through `blueprint:get-context` first**, even a small one. For a tiny
   request it takes one line; it is never a questionnaire.
3. **Nothing is planned before the context card is confirmed, and no stage starts before its
   opening is confirmed.** The card is confirmed in `blueprint:get-context`; the opening is in
   `blueprint:create-plan` §7.
4. **Discussion never writes production code.** A discussion stage produces decisions only. If a
   decision needs something to look at (a mockup, a small demo), that is a delivery stage, or a
   quick task when it only has to find something out.
5. **Specialists belong to discussions** — dispatched by `blueprint:topic-discussion`, and nowhere
   else in Blueprint (not in get-context, create-plan or `/blueprint`).
6. **Blueprint's plan wins over other planning, and only over planning.** A planning skill from
   another plugin never re-plans what Blueprint has planned or decided; it may still help *inside*
   a stage (for example, writing the implementation plan of the `plan` phase). Every other plugin
   is free in every phase (see "The boundary").
7. **The decisions live in the same repository as the code.** Never move the code elsewhere "away
   from the decisions": parallel work only sees them when they sit next to the code. Two
   repositories is a one-way decision for the user.

## Routing

| Use | Name | When |
|---|---|---|
| **Start** | `/blueprint` (command) | Starting Blueprint in a repo. Explicit only. |
| **Context** | `blueprint:get-context` | Every new request: derive the context, draw the conclusions (size, difficulty, pace), route. |
| **Understand existing code** | `blueprint:discovery` | Code exists that Claude doesn't know. On request, or proposed by get-context. |
| **Plan** | `blueprint:create-plan` | After the card is confirmed; re-planning; opening and closing a stage. |
| **Discuss & decide** | `blueprint:topic-discussion` | Every topic of a discussion stage. |
| **Decisions format** | `blueprint:docs-management` | Before writing anything in `blueprint/decisions/`. |
| **Semantic review** | `/deep-review` (command) | Opt-in, expensive check of the decisions' meaning. Explicit only. |

The hooks talk to you in lines starting with `[Blueprint]`. Explain every finding to the user in
plain words and let them decide before anything changes. When a hook refuses a write, read its
reason and fix the cause; never work around it.

## Where to pick up

At the start of a session the orientation hook tells you the current stage and phase.
- A discussion in progress (`blueprint/decisions/_current-task.md` not empty) → resume it.
- The current stage is in progress → continue its phase.
- The current stage is not opened yet → do its opening (topics if any, phases, how) and wait for the OK.
- A draft context card (`blueprint/context.md` without `Confirmed:`) → resume `blueprint:get-context`
  from its open points.
- A confirmed card and no plan → `blueprint:create-plan`.
- No plan → every new request starts with `blueprint:get-context`. Don't start coding on your own.

The hooks repeat this when it matters: the orientation hook at the start of a session, and
step-close at the end of a turn while the card is still a draft (for example after a Discovery).

## Shared concepts

### 1. One-way or two-way — the test

A decision is **one-way** if any of these is yes:
- changing it later means **migrating stored data** (ids, date formats, the database engine once
  data exists);
- **people or systems outside the code** depend on it (links sent by email, a public API, a
  domain, accounts already created, a payment provider);
- changing it means **rebuilding more than one part**, or re-doing a contract between parts;
- it moves **where the code or the data lives** (repository, provider, region with legal weight).

Otherwise it is two-way. **When in doubt, it is one-way.** For every two-way decision, say in one
line *why* it is easy to change ("two-way: no data depends on it, switching is a config change").

### 2. Who decides

The card's `roles` answer says, area by area, whether the **user** or **Claude** decides it. The
user can switch an area at any time: update the card in the same turn.
- In a user-owned area, the user confirms every decision that matters.
- In a Claude-owned area, Claude settles the two-way decisions and records them.
- **Every one-way decision comes back to the user, whoever owns the area.** A hook enforces it.

### 3. How decisions are organised

When a project keeps a decisions folder, its decisions are filed in three kinds of places
(details in `blueprint:docs-management`):
- **shared areas** (`foundations/`) — choices many parts rely on: database, hosting, login and
  security, deploy, external systems, project rules. Test: *"Would changing it later force changes
  in several parts?"*
- **contracts** (`contracts/`) — what two parts agree on to talk to each other (an API, a set of
  types or events). They are what parallel parts share, so they are decided first.
- **sections** (`sections/`) — a piece of value for the end user (SIGNUP, BOOKINGS) that uses the
  shared areas and contracts without re-deciding them.

### 4. Plain summaries

At the end of every discussion, one plain summary for the user to confirm: every decision, which
ones are **one-way** (hard to change later) and which **two-way**. Never a data-model or
architecture dump; keep it at decision level.

### 5. Ratification at contact

A decision found in existing code (Discovery) is not confirmed in bulk. It becomes a real
"confirm, correct, or decide fresh?" question only when a discussion touches it.

### 6. Questions to the user

At real forks, ask a multiple-choice question: options in plain words, your recommendation first.
If no multiple-choice tool is available, ask as plain text with numbered options, and stop until
the user answers. Small or obvious choices stay in prose.
