---
name: topic-discussion
description: "Blueprint's discussion engine. Runs the phases of every topic of a discussion stage in blueprint/plan.json — context check, divergent proposal, convergence, decision — for a shared area, contract, section or note. Specialists first, one proposal that opens many options and then recommends, a plain one-way/two-way summary, then you write the decisions yourself and lock."
---

# Topic-Discussion

<!--
Header comment: the only "how" Blueprint keeps. It runs the phases of a discussion stage's topics
(data/loops.json, type `discussion`: clarify → proposal → convergence → decision): the context
check, specialists, one divergent proposal, the user's choice, then the decision written to the
decisions folder (or the context card when there is none). The block format and the save sequence are defined in
blueprint:docs-management; the one-way/two-way test and the hard rules in blueprint:using-blueprint.
-->

Every topic of a **discussion** stage goes through here. First read `blueprint:using-blueprint`.
The rules that matter most here:
- **Context check first**, then **specialists**, then **one proposal** to the user that opens many
  options and recommends.
- **Plain words only** in chat. End with a plain summary marking one-way and two-way decisions.
- **No production code.** If a decision needs something to look at first (a mockup, a test), that
  is a delivery stage or a quick task before this one: propose it as re-planning.

## What a topic can be

| Shape | What it is | Written to (`blueprint/decisions/`) |
|---|---|---|
| **Shared area** | A choice many parts rely on (DB, cloud, CI/CD, auth…) | `foundations/AREA/AREA.md` (+ `AREA--details.md`) |
| **Contract** | An API, type set or event between parts | `contracts/NAME.md` |
| **Section** | A piece of value for the end user | `sections/SEZ/SEZ.md` (+ `SEZ--details.md`) |
| **Note** | A small decision inside an existing area or section | a block in that file |

**No decisions folder** (the card says the card is enough): the decisions go in plain words into
the context card, under a `## Decisions` section after the answers, with the one-way ones marked.

A section discussion is usually light: most of it is detail Claude settles. It becomes a real
discussion only where it touches a shared area (then that part is an addition or a revision of
the area, below).

## The phases and the plan

The loop of a discussion stage is in `data/loops.json`: `clarify` (the context check) →
`proposal` (divergent) → `convergence` (the user) → `decision`. Each topic of the stage moves
through them, and you record every move in `blueprint/plan.json` as described in
`blueprint:create-plan` §7: one phase at a time, none skipped. If the user says the proposal
misread the context (yours or a specialist's), the topic goes back from `proposal` to `clarify`.
A topic is done when its decision is written, or postponed with a reason told to the user.

## Entry

1. **Read** the topic in `blueprint/plan.json`, the card (`blueprint/context.md`), and, in the
   decisions folder, the area or section file, `_architecture.md` and the files of the areas it
   depends on.
2. **Who decides** comes from the card's `roles` answer. If the area is not listed there, ask once
   with a multiple-choice question and add the answer to the card.
3. **Ask one question if it applies:** for areas that depend on tools or recent facts (design,
   AI models, cloud services, prices), ask *"Do you already use or want to use a tool for this?"*
   Record the answer in the area file.
4. **Context check (`clarify`).** Ask yourself: *"Do I have enough context to take this topic on
   my own?"* Usually yes — the discussion is where the context comes from — so say so in one line
   and move on. If not (what this topic is for, a limit someone set, a word you don't understand),
   ask one or two questions first. Same when the user tells you the context was misread: go back
   here, ask, then brief the specialists again.
5. **Unknowns.** If a decision depends on something nobody knows yet (does this library handle our
   case? what does it cost at our volume?), don't guess a one-way decision: postpone that topic
   and propose a quick task that finds out (re-planning).
6. **Dispatch the specialists. This is your first real action of the proposal phase.** Don't open
   the discussion before they have reported. While they work, stay quiet: no "still waiting…"
   messages.

## The discussion loop

### 1. Specialists work (diverge)

- **Pick 1–3 specialists** from the agent types actually available (the Agent tool's list),
  matching this item. None fits → `general-purpose`, briefed as that specialist. Never the whole
  roster.
- **Depth from the card:** high risk or a calm pace → 2–3 specialists and the full range of
  questions, including the operational ones (failure recovery, caching, security, state); low
  risk or a rushed pace → 1 specialist, only the decisions that are hard to change. Depth changes
  how many decisions are discussed, never how well.
- **Brief them** with: the card's goal and constraints, this item's scope, what is already locked
  (the areas it depends on), the user's tool answer, and the open questions. Ask for, per
  question: real options, trade-offs, a recommendation, and whether the choice is **one-way**,
  judged with the test in `blueprint:using-blueprint` concept 3 (copy its four questions into the
  brief).
- **Fixed points are not options.** The decisions live in the same repository as the code (hard
  rule 7). Don't let a specialist's proposal move them elsewhere.
- **Research.** If the item depends on tools or recent facts, the specialists (or you, before
  briefing them) search online and check which libraries or services exist, with links. Record
  the chosen tools and their source in the decisions folder, so a later session doesn't search
  again.
- **Ratification at contact:** if the discussion touches a draft found in existing code
  (`Decided by: discovery` / `inherited`), raise it: confirm, correct, or decide fresh.

**Gate:** you may not present anything to the user until the specialists have produced real
alternatives — many of them, not the first two that come to mind.

### 2. One divergent proposal

Combine the specialists' work into **one message**, in plain words. It is **divergent**: it opens
the range first, then recommends.
- **The decisions that matter** (one-way, or a real choice), each with: **the possible options —
  the whole serious range, including the less obvious ones** — what each means in practice, then
  **your recommendation and why it beats the others**, and where specialists disagree. If two or
  more options are still alive on a one-way decision, ask it as a multiple-choice question,
  recommendation first.
- **The details** (two-way, low stakes): one short list with your choice for each, one line each.
  The user doesn't need to discuss them; they can object to any.
- **Every two-way decision in a shared area or contract carries its reason** ("two-way: …").
  If you can't write that reason in one line, the decision is one-way.
- **Length: about 20 lines.** Decisions that matter first; details compressed; explanations only
  when asked. More than about 8 decisions → split the proposal over two rounds.

### 3. Talk it through (convergence)

- The user asks, pushes back or leans to an option. **Relay** every real question or objection
  to the same specialists (`SendMessage` if still addressable, otherwise re-dispatch with the
  previous context) and bring the answer back. Trivial wording or a scope trim you can answer
  yourself.
- **Repeat until you agree.** No limit on rounds.
- **Anti-sycophancy:** if you see a real problem with the user's direction, push back **once**,
  say what is being traded away, then defer.
- **In a Claude-owned area:** you settle the two-way decisions yourself with the specialists'
  input; every one-way decision still goes to the user in this loop.

### 4. Plain summary

> **Here's what we decided for DB:**
> - PostgreSQL, managed by the cloud provider.
> - …
>
> **One-way — hard to change later:**
> - PostgreSQL: changing engine later means migrating all data and rewriting queries.
>
> **Two-way — easy to change later:**
> - Daily backups kept 7 days — two-way: only a setting, no data depends on it.
>
> **Details I settled myself** *(only if any)*: connection pooling with the provider's default;
> table names in snake_case. Tell me if you want to change any.
>
> Shall I lock these?

- No internal words, no JSON, no full data-model dump.
- **No surprises:** only decisions already raised in step 2 or 3.
- **"None" is suspicious.** A shared area or contract with no one-way decision at all gets a
  second look with the test before you present it; if it is still none, say in one line why.
- **"Details I settled myself"** lists every two-way decision Claude took without the user —
  including inside a **user-owned area**. It is a notice: confirming the summary does not need a
  discussion of each one.
- **User-owned area:** wait for the confirmation. **Claude-owned area:** the two-way decisions
  lock without waiting; the one-way ones still need the user's clear OK.

### 5. Recheck (internal, before writing)

- **Does any decision belong to another area too?** Example: while discussing the NOTIFICATIONS
  section you chose a message queue → that is also a CLOUD decision. Say it in plain words: *"This
  also goes into CLOUD — add it there?"* (see Additions and revisions).
- **Does the item belong where it was planned?** If it anchors nowhere, it may be a new area or
  section: *"This looks like its own area — add it?"* A new area or section changes the plan:
  propose it as re-planning (`blueprint:create-plan` §6).
- **Does a section add something to a shared area** (a table, an endpoint)? It is written in both
  places: the section says it needs it, the area gets it as an addition.

### 6. Lock (decision phase): write, read the hooks, *then* speak

Never say "✓ Locked" before the files are written and the hooks have answered. You write the
decisions yourself, following the save sequence in `blueprint:docs-management` §9; the block
format is in §6 there. Write in the user's language (an Italian user gets `Scelta`, `Deciso da:
utente`…).
In short, each decision is one block:

```markdown
### db-engine — Which database engine does the system use?
- **Choice:** PostgreSQL (managed)
- **Reversibility:** one-way
- **Decided by:** user (2026-11-04)
- **Rejected:** MongoDB — data is relational; SQLite — no concurrent access
- **Why:** orders and users are relational and queries are standard SQL
- **Stage:** foundations
- **Depends on:** cloud-provider
- **Used by:** SIGNUP, ORDER-HISTORY
```

1. **Register new questions first** in `Vocabulary/registry.json` (reuse an existing id when the
   question is the same).
2. **Pick the file by who decided:** `Decided by: user` and `rule` → the main file; `Decided by:
   claude` (two-way only) → the `--details.md` file. A one-way decision is **never** `Decided by:
   claude`: the hook blocks it.
3. **Write** the blocks (with `Stage:` set to the id of the plan stage), update `_architecture.md`
   or `_sections.md` if they changed, and clear the settled lines from `_current-task.md`.
4. **Read every `[Blueprint]` message** the hooks returned:
   - **a block was refused** (a one-way decision marked `claude`): ask the user about that
     decision in plain words ("This one is hard to change later, so I need your clear OK: …"),
     then write it again as `Decided by: user`. Never relabel it two-way to get past the hook;
   - **an unreadable block** (missing key, wrong value): fix the block and write it again;
   - **a check found something** (a clash with another area, the same answer to two questions, a
     dangling link, a `Used by` name that doesn't exist): explain it in plain words with the
     options and let the user decide before changing anything.
5. **Record the topic in `blueprint/plan.json`:** its phase at `decision`, `done: true`.
6. **Only then speak:** "✓ Locked." plus one line on what was saved, and name the next topic of the
   stage. When the stage's last topic is done, close the stage (`blueprint:create-plan` §7).

## Additions and revisions (a locked area needs to change)

When a later discussion, a build or a delivery needs something from an area that is already
locked:
- **Addition** — new decisions that contradict nothing ("add a queue", "add an `orders`
  table"). Light: a short confirmation (or, in a Claude-owned area, a notice), then written
  straight into the area under `## Added for <stage>`.
- **Revision** — an existing decision changes ("move from App Service to Container Apps").
  A real discussion of that point, with its specialists, decided by whoever owns the area. Then
  every section in that decision's `Used by` is warned, in plain words. A **correction** forced by
  an implementation (the chosen library cannot do what we need) is a revision too: it is written
  with the implementation stage as its `Stage`.
- If it is unclear which of the two it is, ask as a multiple-choice question.
- If the change is not part of the current plan, propose it as new topics first (re-planning).

## Done when

- the context check was answered, the specialists produced alternatives and one divergent
  proposal reached the user;
- the user agreed (or, in a Claude-owned area, only the two-way decisions locked without them);
- the blocks are written, the hooks' messages are handled, the topic is recorded in `plan.json`;
- every one-way decision lists the alternatives it beat (`Rejected`).

## What NOT to do

- Don't skip the context check, and don't open a discussion without dispatching its specialists
  first
- Don't propose only the option you like: open the range, then recommend
- Don't send the specialists' reports to the user one by one — one combined proposal
- Don't show field names, JSON or a full architecture dump in chat
- Don't write production code
- Don't say "✓ Locked" before the writes are done and the `[Blueprint]` messages are handled
- Don't settle a hook finding on your own — the user decides, through you
- Don't write a one-way decision as `Decided by: claude`
- Don't slip a decision into the summary that wasn't raised before
- Don't start building after a lock — building is another stage, opened with the user

## Live logging

Decisions go into `blueprint/decisions/_current-task.md` as they are reached (the chosen option, why,
pros, cons, risks), so a resumed session can continue. It is cleared when the topic is written to
its permanent home; git keeps the history.
