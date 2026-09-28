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
     database/storage agent). How many depends on its importance — see "Set the depth" below.
   - Brief them on the project summary and this feature's scope. Ask them for:
     - the feature's role;
     - its key decisions;
     - whether it naturally splits into sub-features (apply the feature-definition test).
   - Discuss their view with the user in plain words: what the feature is and what it does.
   - **Always say whether it splits, and why**, in one or two sentences. Examples: "APP stays
     one part: …" or "APP has two sub-features, SCREENS and LOOK, because …".
   - **Keep it digestible.** If the specialists come back with many decisions (more than about
     8–10), don't dump them all at once. Present the few that matter most first (the one-way
     ones and the real choices). Group the small, easy-to-change details and handle them
     afterwards, or leave them to Claude under agent-assist.
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

1. **Mode question first**, only for a fresh top-level topic (no `target` on the queue entry).
   Ask it and **wait for the answer** before anything else. See `blueprint:user-agent`.
   Sub-features inherit the mode of their parent feature.
2. **Start immediately.** Don't re-confirm the shape hint.
3. **Dispatch the specialists. This is your first real action after the mode answer.** Don't
   open the discussion with the user before the specialists have reported.
   - While they work, stay quiet. Don't post "still waiting…" messages. Speak once, when you
     have their combined view.

## The discussion loop (the core)

### 1. Specialists propose (diverge)

**Pick the specialists.**
- Choose from the agent types actually available to you in this session (the Agent tool's
  list), matching this item's domain.
- 1–3 agents, never the whole roster.
- If none fits, dispatch `general-purpose` and brief it as that specialist.

**Set the depth from importance** (from `_queue.json`; sub-features and notes use their parent
feature's):
- **4–5, the heart of the project:** 2–3 specialists, and the full range of questions, including
  the operational ones. Don't rush the user.
- **3:** the normal treatment described here.
- **1–2:** 1 specialist. Settle only the few decisions that really matter (the one-way ones and
  the real choices). Small, easy-to-change details go straight into the summary with the
  specialists' recommendation.
- **No score** (an older vault): treat it as 3.

Depth changes *how many* decisions get discussed, never how well each one is made. Every
decision still gets real specialist input. Who decides — the user or Claude — is the mode's job
(`blueprint:user-agent`), not importance's.

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
- No surprises: the summary contains only decisions that were already raised in the
  discussion. If a specialist's report holds an extra decision, bring it up in the discussion
  first; never slip it in for the first time in the summary.
- No JSON, and no full data-model dump.
- **Manual mode:** wait for the user's confirmation.
- **Agent-assist mode:** see `blueprint:user-agent`. The two-way decisions lock without
  stopping. The one-way ones still need the user's confirmation.

### 4. Recheck (internal, before writing)

- **Shape:** is this its own file (sub-feature) or a paragraph on an existing file (note)?
- **Target:** which feature does it belong to?
- If it anchors to no feature at all, it may be a new feature. Tell the user in plain words
  ("this looks like its own feature — should I add it to the list?").

### 5. Lock: save, check, report, *then* speak

Never say "✓ Locked" before the save is confirmed. The order is fixed:

1. **Brief `blueprint:vault-architect` with one line per decision**, and mark each line:
   - **`confirmed`**: the user explicitly agreed to it. This covers every decision in a summary
     the user confirmed, and in agent-assist mode every one-way decision the user OK'd.
   - **`agent-decided`**: agent-assist mode only; a two-way decision you made without asking.

   The agent sets each decision's internal status from this mark (`confirmed` → `ratified`,
   `agent-decided` → `agent-approved`). It never derives the status from the topic's mode.
2. **Dispatch it with a fresh `Agent` call and wait for its result.**
   - Do not send the job with `SendMessage` to an earlier agent.
   - Do not run it in the background, and do not end your turn while it runs.
   It writes, in one pass:
   - the prose file;
   - this feature's `atoms.json`;
   - the `_current-task.md` cleanup;
   - the `_queue.json` check-off.
   The hooks fire during those writes: the one-way guard and Review's checks.
3. **Read its report.** It lists:
   - every write: saved, or blocked;
   - every `[Blueprint]` hook message, verbatim.
4. **Only then speak:**
   - **All saved, no findings:** "✓ Locked." plus what comes next ("Next: the APP feature.").
   - **A write was blocked by the one-way guard:** a hard-to-undo decision was marked
     `agent-decided`. Ask the user about that decision in plain words ("This one is hard to change
     later, so I need your clear OK: …"). Then dispatch the save again with it marked `confirmed`.
   - **Review found something** (a clash with another feature, the same answer used for two
     questions, a dangling link): explain it in plain words, with the options, and let the user
     decide *before* anything is changed. Then re-dispatch the save with the decision.
   - Never tell the user something is locked while any part of it is still unsaved or unresolved.

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
- Don't say "✓ Locked" before vault-architect's report confirms every write succeeded
- Don't let vault-architect resolve a Review finding or a guard block on its own. The user
  decides, through you
- Don't answer a real objection yourself when it touches the specialists' reasoning. Relay it.
  (Trimming scope the user doesn't want is fine to handle directly.)
- Don't pre-decide Recheck's shape or target. Let the discussion reveal it
- Don't use `AskUserQuestion` for every small choice. Keep it for real forks

## Technical notes

**Queue insertion:** sub-features queued by a feature's intro stage go into `_queue.json` right
after the parent. The order is not re-proposed.

**Mode:** asked once per fresh top-level topic. Sub-features inherit it.

**Importance vs. focus:** importance sets the depth (how many specialists and questions); the
user's focus, via the mode question, sets who decides. Neither ever lowers the quality of a
single decision.

**Live logging:** decisions go into `_current-task.md` as they are reached, so a resumed session
can continue.
