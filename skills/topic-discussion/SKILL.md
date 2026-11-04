---
name: topic-discussion
description: "Blueprint's discussion engine for every discuss step of the path — a foundation area, contract, section, note or plan. Specialists first, one combined proposal, plain one-way/two-way summary, then you write the decisions yourself and lock."
---

# Topic-Discussion

Every `discuss` step of the path goes through here. First read `blueprint:using-blueprint`. The
rules that matter most here:
- **Specialists first**, then **one proposal** to the user.
- **Plain words only** in chat. End with a plain summary marking one-way and two-way decisions.
- **No production code.** If a decision needs a test first, propose a prototype step instead.

## What can be discussed

| Shape | What it is | Written to |
|---|---|---|
| **Foundation area** | A shared choice (DB, cloud, CI/CD, auth…) | `foundations/AREA/AREA.md` (+ `AREA--details.md`) |
| **Contract** | An API, type set or event between sections | `contracts/NAME.md` |
| **Section** | A piece of value for the end user | `sections/SEZ/SEZ.md` (+ `SEZ--details.md`) |
| **Note** | A small decision inside an existing area or section | a block in that file |
| **Plan** | An ordered, verifiable task list for something already decided | `plans/PHASE-N-NAME.json` |

A section discussion is usually light: most of it is detail Claude settles. It becomes a real
discussion only where it touches a foundation (then that part is an addition or a revision of the
area, below).

## Entry

1. **Read** the step in `_queue.json`, the area or section file, `_architecture.md`, and the files
   of the areas it depends on. Mark the step `in-progress`.
2. **Who decides** comes from `local-profile.md` (`blueprint:user-agent`). There is no mode
   question here: it was asked once, at the end of brainstorming. If the area has no entry, ask
   once with a multiple-choice question and save the answer.
3. **Ask one question if it applies:** for areas that depend on tools or recent facts (design,
   AI models, cloud services, 3D, prices), ask *"Do you already use or want to use a tool for
   this?"* Record the answer in the area file.
4. **Dispatch the specialists. This is your first real action.** Don't open the discussion before
   they have reported. While they work, stay quiet: no "still waiting…" messages.

## The discussion loop

### 1. Specialists work (diverge)

- **Pick 1–3 specialists** from the agent types actually available (the Agent tool's list),
  matching this item. None fits → `general-purpose`, briefed as that specialist. Never the whole
  roster.
- **Depth from importance** (the step's importance; notes use their parent's):
  4–5 → 2–3 specialists, the full range of questions including the operational ones (failure
  recovery, caching, security, state); 3 → normal; 1–2 → 1 specialist, only the decisions that
  really matter. Depth changes how many decisions are discussed, never how well.
- **Brief them** with: the project overview, this item's scope, what is already locked (the
  dependent areas), the user's tool answer, and the open questions. Ask for, per question: real
  options, trade-offs, a recommendation, and whether the choice is **one-way**, judged with the
  test in `blueprint:using-blueprint` concept 7 (copy its four questions into the brief).
- **Fixed points are not options.** The code lives in the same repository as the vault (hard rule
  6). Don't let a specialist's proposal move it elsewhere.
- **Research step.** If the item depends on tools or recent facts, the specialists (or you,
  before briefing them) search online and check which libraries, MCP servers or plugins exist,
  with links and how to install them. Record the chosen tools and their source in the vault, so a
  later session doesn't search again.
- **Feasibility.** If a decision depends on something nobody knows yet (does this library handle
  our case? what does it cost at our volume?), say so and propose a `prototype` step before
  locking it. Don't guess a one-way decision.
- **Ratification at contact:** if the discussion touches a draft found in existing code
  (`Decided by: discovery` / `inherited`), raise it: confirm, correct, or decide fresh.

**Gate:** you may not present anything to the user until the specialists have produced real
alternatives.

### 2. One proposal (converge for the user)

Combine the specialists' work into **one message**, in plain words:
- **The decisions that matter** (one-way, or a real choice), each with: the options, what each
  means in practice, the recommendation and why, where specialists disagree. Use a short example
  when it helps. If two or more options are still alive on a one-way decision, ask it as a
  multiple-choice question.
- **The details** (two-way, low stakes): one short list with your choice for each, one line each.
  The user doesn't need to discuss them; they can object to any.
- **Every two-way decision in a foundation area or contract carries its reason** ("two-way: …").
  If you can't write that reason in one line, the decision is one-way (concept 7).
- **Length: about 25 lines.** Decisions that matter first; details compressed; explanations only
  when asked. If there are more than about 8–10 decisions, split the proposal over two rounds.

### 3. Talk it through

- The user asks, pushes back or leans to an option. **Relay** every real question or objection
  to the same specialists (`SendMessage` if still addressable, otherwise re-dispatch with the
  previous context) and bring the answer back. Trivial wording or a scope trim you can answer
  yourself.
- **Repeat until you agree.** No limit on rounds.
- **Anti-sycophancy:** if you see a real problem with the user's direction, push back **once**,
  say what is being traded away, then defer.
- **In a Claude-owned area** (`blueprint:user-agent`): you settle the two-way decisions yourself
  with the specialists' input; every one-way decision still goes to the user in this loop.

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
- **"None" is suspicious.** A foundation area or contract whose summary has no one-way decision at
  all gets a second look with concept 7 before you present it; if it is still none, say in one
  line why.
- **"Details I settled myself"** lists every two-way decision Claude took without the user —
  including inside a **user-owned area**. It is a notice: confirming the summary does not need a
  discussion of each one.
- **User-owned area:** wait for the confirmation. **Claude-owned area:** the two-way decisions
  lock without waiting; the one-way ones still need the user's clear OK.

### 5. Recheck (internal, before writing)

- **Does any decision belong to another area too?** Example: while discussing the NOTIFICATIONS
  section you chose a message queue → that is also a CLOUD decision. Say it in plain words: *"This
  also goes into CLOUD — add it there?"* (see Additions and revisions).
- **Does the item belong where it was queued?** If it anchors nowhere, it may be a new area or
  section: *"This looks like its own area — add it to the map?"*
- **Does a section add something to a foundation** (a table, an endpoint)? It is written in both
  places: the section says it needs it, the area gets it as an addition.

### 6. Lock: write, read the hooks, *then* speak

Never say "✓ Locked" before the files are written and the hooks have answered. You write the
vault yourself; the exact block format, file names and frontmatter are in
`blueprint:docs-management`. Write in the vault's language (§4b there: an Italian user gets
`Scelta`, `Deciso da: utente`…). In short, each decision is one block:

```markdown
### db-engine — Which database engine does the system use?
- **Choice:** PostgreSQL (managed)
- **Reversibility:** one-way
- **Decided by:** user (2026-11-04)
- **Rejected:** MongoDB — data is relational; SQLite — no concurrent access
- **Why:** orders and users are relational and queries are standard SQL
- **Depends on:** cloud-provider
- **Used by:** SIGNUP, ORDER-HISTORY
```

0. **Register new questions first.** Add every genuinely new decision id to
   `Vocabulary/registry.json` *before* writing the blocks (reuse an existing id when the question
   is the same). Otherwise the vocabulary check flags every new decision as unknown.
1. **Pick the file by who decided:**
   - `Decided by: user` (the user confirmed it, in any area) and `rule` → the main file
     (`AREA.md`, `SEZ.md`, or the contract file);
   - `Decided by: claude` (two-way only, taken by Claude) → the `--details.md` file;
   - a one-way decision is **never** `Decided by: claude`. The hook blocks it.
2. **Write** the blocks, update `_architecture.md` (areas/contracts tables, graph) or
   `_sections.md` if they changed, clear the settled lines from `_current-task.md`, and mark the
   step `done` in `_queue.json`.
3. **Read every `[Blueprint]` message** the hooks returned on those writes:
   - **a block was refused** (a one-way decision marked `claude`): ask the user about that
     decision in plain words ("This one is hard to change later, so I need your clear OK: …"),
     then write it again as `Decided by: user`. Never relabel it two-way to get past the hook;
   - **an unreadable block** (missing key, wrong value): fix the block and write it again;
   - **a check found something** (a clash with another area, the same answer to two questions, a
     dangling link, a `Used by` name that doesn't exist): explain it in plain words with the
     options and let the user decide before changing anything.
4. **Only then speak:** "✓ Locked." plus one line on what was saved.
5. **End of the step:** ask *"Build this now, or discuss the next one?"* (multiple-choice
   question when available). Name the next step of the path.

## Additions and revisions (a locked area needs to change)

When a later discussion, a build or a prototype needs something from an area that is already
locked:
- **Addition** — new decisions that contradict nothing ("add a queue", "add an `orders`
  table"). Light: a short confirmation (or, in a Claude-owned area, a notice), then written
  straight into the area with the stage that introduced it (for example "MVP2").
- **Revision** — an existing decision changes ("move from App Service to Container Apps").
  A real discussion of that point, with its specialists, decided by whoever owns the area. Then
  every section in that decision's `Used by` is warned, in plain words.
- If it is unclear which of the two it is, ask as a multiple-choice question.

## Done when

- the specialists produced alternatives and one proposal reached the user;
- the user agreed (or, in a Claude-owned area, only the two-way decisions locked without them);
- the blocks are written, the hooks' messages are handled, the step is `done`;
- every one-way decision lists the alternatives it beat (`Rejected`).

**For a plan:** every task has a machine-verifiable exit criterion, the order is locked, and
`PHASE-N-NAME.json` is written.

## What NOT to do

- Don't open a discussion without dispatching its specialists first
- Don't send the specialists' reports to the user one by one — one combined proposal
- Don't show atoms, field names, JSON or a full architecture dump in chat
- Don't write production code; propose a prototype step when feasibility is unknown
- Don't say "✓ Locked" before the writes are done and the `[Blueprint]` messages are handled
- Don't settle a hook finding on your own — the user decides, through you
- Don't write a one-way decision as `Decided by: claude`
- Don't slip a decision into the summary that wasn't raised before
- Don't start building after a lock — ask "build this now, or discuss the next one?"

## Technical notes

**Live logging:** decisions go into `_current-task.md` as they are reached (the chosen option, why,
pros, cons, risks), so a resumed session can continue. The hook keeps the full trail in
`_full-context.md`.

**Importance vs who decides:** importance sets the depth (how many specialists and questions);
`local-profile.md` sets who decides. Neither lowers the quality of a decision.
