---
name: using-blueprint
description: "Blueprint's hard rules, entry step (how big is the request, does it touch the foundations?), routing table to the six skills, the boundary (Blueprint plans, it doesn't execute) and the shared concepts (foundations vs sections, one-way/two-way, who decides, plain-language summaries). Read at the start of every session in a Blueprint project and before any Blueprint step."
---

# Using Blueprint

<!--
Header comment: the entry point of Blueprint v3. It holds the rules every other Blueprint skill
assumes: the hard rules, the entry step that sizes each request, the routing table to the six
skills, the boundary between planning (Blueprint) and execution (not Blueprint), and the shared
concepts (foundations vs sections, one-way/two-way, who decides, plain summaries). Keep it short:
details belong to the skill that uses them.
-->

Blueprint gives the **pipeline**: context → plan → stages. It finds out the context
(`blueprint/context.md`), builds a plan of stages (`blueprint/plan.json`), and runs each stage
through the fixed loop of its type (the plugin's `data/loops.json`). The decisions that are
expensive to get wrong (the **foundations**) are discussed with the user and, when the project
needs it, written to a decision vault (`blueprint/vault/`).

## The boundary — what Blueprint does not do

**How a stage is executed is not Blueprint's business**: implementing, checking, design, sessions,
plugins, git. At the opening of each stage you tell the user how you would do it, with whatever
they have (their own skills, plugins, habits), and they confirm. Blueprint never prescribes it.

Two exceptions only:
- **Discussion** is Blueprint's own job (`blueprint:topic-discussion`): deciding is its trade.
- **Parallel work.** Blueprint knows work can run in parallel, so the plan puts the shared
  contracts and foundations first and records which parts are independent
  (`independent_parts`). *How* the parallel work is organised is decided at the opening.

## Hard rules — these override everything else in this project

1. **Speak the user's language, in plain words.** Never show Blueprint's machinery in chat: no
   field names, no JSON, no "atom", "registry", "status", "phase id". Talk about choices and
   stages in normal words. The vault and the card are written in the user's language too (see
   `blueprint:docs-management` §5).
2. **Every request goes through the entry step first** (below), even a small one.
3. **Nothing is planned before the context card is confirmed, and no stage starts before its
   opening is confirmed.** The card is confirmed in `blueprint:get-context`; the opening is in
   `blueprint:create-plan` §7.
4. **Discussion never writes production code.** A discussion stage produces decisions only. A
   throwaway probe (a mockup, a test) is kept apart from the production code, and at its end the
   user chooses: throw it away, or rebuild it properly in an implementation stage.
5. **Specialists belong to discussions of a foundation area, contract or section** — dispatched
   by `blueprint:topic-discussion`, and nowhere else in Blueprint (not in get-context, create-plan
   or `/blueprint`).
6. **In a Blueprint project, Blueprint's plan wins.** A planning skill from another plugin never
   re-plans what Blueprint has planned or decided; it may help *inside* a stage.
7. **The vault lives in the same repository as the code.** Never move the code elsewhere "away
   from the vault": parallel work only sees the foundations when the vault sits next to the code.
   Two repositories is a one-way decision for the user.

## The entry step

Every new request starts here. It is the first thing you say, not a silent classifier.

1. Say in plain words what you understood, and answer: **does this touch the foundations?** (a
   contract, the data model, auth, hosting, CI/CD, a project rule). Read the card, the plan and the
   relevant slice of the vault first, if they exist.
2. Size the request:

| Size | Example | What happens |
|---|---|---|
| **Tiny** | "change the button colour" | One line of confirmation, then do it. No files, no plan. |
| **Fits the existing plan** | a task inside a stage that is planned | Re-planning (`blueprint:create-plan` §6): new topics in a stage, or a new stage, proposed as before → after. |
| **New work** — small, medium or a project | "check if Azure supports WebSockets", "add Google login", "a booking site" | `blueprint:get-context`, then `blueprint:create-plan`. |

What is "tiny" is your judgement; the user can correct it. If it touches the foundations, it is
never tiny.

## Routing

| Use | Name | When |
|---|---|---|
| **Start** | `/blueprint` (command) | Starting Blueprint in a repo. Explicit only. |
| **Understand existing code** | `blueprint:discovery` | Code exists that Claude doesn't know. On request, or proposed by get-context. |
| **Context** | `blueprint:get-context` | New work: answer every context question, write and confirm the card. |
| **Plan** | `blueprint:create-plan` | After the card is confirmed; re-planning; opening and closing a stage. |
| **Discuss & decide** | `blueprint:topic-discussion` | The proposal and decision phases of every discussion stage. |
| **Vault format** | `blueprint:docs-management` | Before writing anything in `blueprint/vault/`. |
| **Semantic review** | `/deep-review` (command) | Opt-in, expensive check of the vault's meaning. Explicit only. |

The hooks talk to you in lines starting with `[Blueprint]`. Explain every finding to the user in
plain words and let them decide before anything changes. When a hook refuses a write, read its
reason and fix the cause; never work around it.

## Where to pick up

At the start of a session the orientation hook tells you the current stage and phase.
- A discussion in progress (`blueprint/vault/_current-task.md` not empty) → resume it.
- The current stage is in progress → continue its phase.
- The current stage is not opened yet → do its opening (topics if any, phases, how) and wait for the OK.
- No plan → ask the user what they want to do. Don't start coding on your own.

## Shared concepts

### 1. Foundations and sections

- **Foundation area** — a choice shared by many parts, expensive to get wrong. Test: *"Do several
  parts rely on this, and would changing it later force changes in them?"* Typical: DB, cloud,
  CI/CD, auth and security, external integrations, deploy, project rules. Only the ones the
  project really has.
- **Contract** — an API, a set of types or events between parts. A foundation kept one per file,
  and the thing parallel parts share.
- **Section** — a piece of value for the end user (SIGNUP, BOOKINGS). Test: *"Is it something the
  user gets, and can it be built and tested on its own against the contracts?"* It uses the
  foundations without re-deciding them.

### 2. Who decides each area

The card's `roles` answer says, area by area, whether the **user** or **Claude** decides it. The
user can switch an area at any time: update the card in the same turn.
- In a user-owned area, the user confirms every decision that matters.
- In a Claude-owned area, Claude settles the two-way decisions and records them.
- **Every one-way decision comes back to the user, whoever owns the area.** A hook enforces it.

### 3. One-way or two-way — the test

A decision is **one-way** if any of these is yes:
- changing it later means **migrating stored data** (ids, date formats, the database engine once
  data exists);
- **people or systems outside the code** depend on it (links sent by email, a public API, a
  domain, accounts already created, a payment provider);
- changing it means **rebuilding more than one section**, or re-doing a contract;
- it moves **where the code or the data lives** (repository, provider, region with legal weight).

Otherwise it is two-way. **When in doubt, it is one-way.** For every two-way decision in a
foundation area or contract, say in one line *why* it is easy to change ("two-way: no data depends
on it, switching is a config change").

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
