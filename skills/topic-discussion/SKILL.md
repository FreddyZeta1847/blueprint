---
name: topic-discussion
description: "Blueprint's core discussion engine — takes a queued feature, sub-feature, note or plan, dispatches the right specialist agents first, discusses their options with the user in plain words, closes with a plain one-way/two-way decision summary, then locks. Use for every queued item after brainstorming/feature-detection."
---

# Topic-Discussion

The core engine. Every queued item (feature, sub-feature, note or plan) goes through it. First
read the hard rules in `blueprint:using-blueprint`. The three that matter most here:
- **Specialists first.** Every feature and every sub-feature starts by dispatching its
  specialists.
- **Plain words only.** Never show atoms, axes or field names. End with a plain decision summary
  that marks the one-way and two-way decisions.
- **No code.** Planning never writes source files.

## Four shapes, one engine

### Feature
A new top-level feature. It has two stages.

1. **Intro stage**
   - Ask the mode question if this is a fresh top-level topic (see Entry, below).
   - **Dispatch the feature's specialists first.** Pick the 1–3 agent types that fit this
     feature's domain (a FRONTEND feature → a frontend/UI design agent; a STORAGE feature → a
     database/storage agent).
   - Brief them on the project summary and this feature's scope. Ask them for:
     - the feature's role;
     - its key decisions;
     - whether it naturally splits into sub-features (apply the feature-definition test).
   - Discuss their view with the user in plain words: what the feature is, what it does, and
     whether it needs sub-features.
   - **If it has sub-features:** `blueprint:vault-architect` writes the lean `FEATURE-NAME.md`
     (only *what it is and what it does*). Queue each sub-feature right after the parent. Then
     discuss them one by one.
   - **If it doesn't:** run the discussion loop (below) on the feature itself, with its
     specialists. A single-file feature still gets specialists and still gets a decision
     summary.
2. **Sub-feature stage**
   - Each queued sub-feature goes through the discussion loop, one at a time.
   - Each one gets its own specialists: the feature's specialists can stay, and others can join
     for that sub-feature.

### Sub-feature
Part of a feature. **Dispatch this sub-feature's specialists first**, then run the discussion
loop, then the decision summary, then lock.

### Note
A smaller decision that belongs as a paragraph in an existing file. It runs the same loop, with
the specialists of the feature it belongs to.

### Plan
An ordered, verifiable task list for a feature that is already decided.
- It runs the same loop, with the specialists that know how such work is usually built.
- The output is `PHASE-N-NAME.json`, where every task has a machine-verifiable exit criterion.
- **A plan is a list of tasks, not code.** Writing the code is implementation. That starts only
  when the user explicitly asks.

## Entry

When a queue item starts:

1. **Mode question**, only for a fresh top-level topic (no `target` on the queue entry). See
   `blueprint:user-agent`. Sub-features inherit the mode of their parent feature.
2. **Start immediately.** Don't re-confirm the shape hint.
3. **Dispatch the specialists. This is your first real action.** Don't open the discussion with
   the user before the specialists have reported.

## The discussion loop (the core)

### 1. Specialists propose (diverge)

**Pick the specialists.**
- Choose from the agent types actually available to you in this session (the Agent tool's
  list), matching this item's domain.
- 1–3 agents, never the whole roster.
- If none fits, dispatch `general-purpose` and brief it as that specialist.

**Brief them.**
- Include the project summary, this item's scope, what is already locked (read `_features.md`
  and the related feature files), and the open questions.
- Ask for real options per question, trade-offs for each, and a recommendation.
- They may read relevant vault files and code. That is how they scan and reason.

**Cover all of it.** Their answer should cover the headline choices (framework? storage?) *and*
the operational ones: failure recovery, caching, security, and state management where relevant.

**Gate:** you may not move on to picking an answer until the specialists have produced real
alternatives. Never skip this step.

**Ratification at contact:** if the specialists or the discussion touch a `needs-review` draft
(from Discovery), raise it naturally inside the discussion: confirm, correct, or decide fresh.

### 2. Talk it through with the user

- Explain the options in plain words:
  - what each option means in practice;
  - what the specialists recommend, and why;
  - where they disagree.
  Use a short example when it helps.
- The user asks questions, pushes back, or leans toward an option.
- **Relay back.** Take each real question or objection back to the same specialists: use
  `SendMessage` if the agent is still addressable, otherwise re-dispatch with the previous
  context. Bring their answer back to the user.
- **Repeat until you and the user agree.** There is no limit on rounds. Don't call the
  specialists for trivial wording questions you can answer yourself.
- At a real fork, `AskUserQuestion` is a good tool (see `blueprint:using-blueprint`, Core
  Concept 4). Its options are always written in plain words.
- **Anti-sycophancy:** if you see a real problem with the user's direction, push back **once**.
  Say what is being traded away, then defer to the user.

### 3. Decision summary (converge)

When the discussion has settled, give **one plain summary**. Use this format:

> **Here's what we decided for STORAGE:**
> - We store everything in the browser (localStorage) for now.
> - Every item gets a random unique id, so syncing between devices later stays possible.
> - …
>
> **One-way — hard to change later:**
> - The unique-id scheme: changing it later means migrating every stored item.
>
> **Two-way — easy to change later:**
> - localStorage now; moving to SQLite later doesn't change the rest of the app.
>
> Shall I lock these?

- No internal words: never "atom", "axis", "status", "rejected" or "reversibility".
- No JSON, and no full data-model dump.
- **Manual mode:** wait for the user's confirmation.
- **Agent-assist mode:** see `blueprint:user-agent`. The two-way decisions lock without
  stopping. The one-way ones still need the user's confirmation.

### 4. Recheck (internal, before writing)

- **Shape:** is this its own file (sub-feature) or a paragraph on an existing file (note)?
- **Target:** which feature does it belong to?
- If it anchors to no feature at all, it may be a new feature. Tell the user in plain words
  ("this looks like its own feature — should I add it to the list?").

### 5. Lock (silent)

After confirmation, **`blueprint:vault-architect`** writes everything in one pass:
- the prose file;
- this feature's `atoms.json`, which holds one internal record per decision, with its
  alternatives and why they lost;
- the `_current-task.md` cleanup;
- the `_queue.json` check-off.

Tell the user only "✓ Locked." plus what comes next ("Next: the CAPTURE feature."). The
PostToolUse hook then runs its checks by itself. If it reports a problem, explain it in plain
words and let the user decide.

## Termination

**For a feature, sub-feature or note:**
- the specialists produced alternatives;
- the user agreed;
- the decision summary was confirmed (or auto-locked under agent-assist, for two-way decisions
  only);
- `blueprint:vault-architect` has written the files and cleaned `_current-task.md`.

Internally, every one-way decision must record the alternatives it beat. That is proof they were
really weighed.

**For a plan:** every task has a machine-verifiable exit criterion, the order is locked, and
`PHASE-N-NAME.json` is written.

**When the queue is empty:** tell the user planning is complete and **stop**. Don't start
implementing.

## What NOT to do

- Don't open a feature or sub-feature discussion without dispatching its specialists first
- Don't dispatch specialists anywhere outside feature and sub-feature discussions
- Don't cap the specialists at "propose once, validate once". Relay until you and the user agree
- Don't show the user atoms, axes, field names, JSON, or a full architecture dump
- Don't write code, scaffolding or starter files. Planning produces decisions and vault files only
- Don't write vault files yourself. `blueprint:vault-architect` is the only writer
- Don't pre-decide Recheck's shape or target. Let the discussion reveal it
- Don't use `AskUserQuestion` for every small choice. Keep it for real forks

## Technical notes

**Queue insertion:** sub-features queued by a feature's intro stage go into `_queue.json` right
after the parent. The order is not re-proposed.

**Mode:** asked once per fresh top-level topic. Sub-features inherit it.

**Live logging:** decisions go into `_current-task.md` as they are reached, so a resumed session
can continue.
