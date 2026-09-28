---
name: user-agent
description: "Ask manual-vs-agent-assist once per top-level topic, and apply the Profile's learned defaults — Blueprint's one global, cross-project mechanism. Use when a queued topic with no target is about to start its discussion, when the user asks to switch mode mid-project, or when a ratified decision may reveal a tendency worth remembering."
---

# User-Agent

Blueprint's **one global** mechanism. Every other part of Blueprint lives inside a single
project's vault. This one doesn't — because how a person reasons, and what they tend to choose,
repeats across their whole body of work rather than one repo.

Two jobs. **Never mix them.**

| | Profile | Agent-assist mode |
|---|---|---|
| What it does | Remembers past choices and tendencies | Decides *for* the user |
| Risk | None — advisory only, never acts | Real — it locks things |
| Where it lives | `~/.claude/blueprint/profile.json` (global) | Per topic, inside one project |

---

## 1. The mode question

**Ask once, per top-level topic, right as that topic's own discussion is about to start.**

### When it fires

The test is **`target`**, not shape:

- **No `target`** on the queue entry → **ask.** This is a fresh top-level topic: a whole feature,
  a standalone note, or a plan. All three get asked.
- **Has a `target`** → **do not ask.** It was queued underneath a feature already in progress, so
  it inherits that feature's already-decided mode.

A common mistake is branching on "is it a feature?" instead. That's wrong — it silently skips
standalone notes and plans, which are exactly the items a user may want handled differently.

### Why not earlier, and why not once per session

- **Not a session-wide toggle.** One switch can't express "agent-assist for the boring features,
  manual for anything sensitive" — which is the whole point of having the mode at all.
- **Not an upfront batch question** (this was tried and removed). Asking at the top of the project
  means judging "boring vs. sensitive" from a bare topic name, before anyone knows what the topic
  actually involves. Worse information, and no less friction — Topic-Discussion already pauses at
  the start of each topic anyway.
- It also gets **better with experience inside one project**: by feature 3, the user has real
  outcomes from features 1 and 2 to judge against, instead of a guess from a name.

### How to ask

Use `AskUserQuestion` — see `using-blueprint`, Core Concept 4. One question, two fixed options,
real consequences either way. The Profile's suggestion is the **pre-recommended option**, not a
sentence of advice followed by a separate ask.

```
How do you want to handle the decisions for <topic>?
  - Let Claude decide the easy ones (Recommended — you usually prefer this for setup work)
      Decisions that are easy to change later get saved without stopping.
      Anything hard to undo still comes back to you first.
  - Review everything myself
      At the end, you see a short summary of every decision and confirm it.
```

Plain words only. Never mention atoms, statuses, or the guard hook in this question.

### Which option to pre-recommend

Go down this list and stop at the first one that gives an answer:

1. **`local-profile.md` (this project's focus).** The feature is in "Cares most about" →
   recommend *Review everything myself*. It is in "Wants Claude to handle" → recommend *Let
   Claude decide the easy ones*. If the focus is "all of them", it doesn't separate anything —
   go to the next step.
2. **The global Profile's tendencies** — e.g. "usually cares about the visual side".
3. **Importance.** 4–5 → *Review everything myself*; 1–2 → *Let Claude decide the easy ones*;
   3 → no recommendation.

The recommendation text gives the reason in plain words: *"(Recommended — you said design is
what you care about most)"* or *"(Recommended — this is a small, supporting part)"*. The user
always chooses.

**Focus is not importance.** Importance controls how deep the specialists go
(`blueprint:topic-discussion`); focus controls who decides. A feature can be important for the
project and still be handed to Claude.

**If the answer contradicts the local profile** (the user picks *Review everything myself* for a
feature listed under "Wants Claude to handle"), ask once whether to update `local-profile.md`.
Never update it silently.

**Per-feature assignment IS the targeting mechanism.** There is nothing extra to build for
"agent-assist on easy features only" — assigning per topic already does exactly that.

### Where the answer is stored

A small annotation on that feature's own entry in `_features.md`, which `vault-architect` already
keeps current on every change. **No new file.** Written the moment the question is answered.

---

## 2. What each mode actually does

### Manual mode
At the end of the discussion, the user gets the plain decision summary (see
`blueprint:topic-discussion`, step 3): every decision, with the one-way and two-way ones marked.
The user confirms. Internally the lock is written as `status: ratified`, which the user never
sees.

### Agent-assist mode
- **Two-way decisions you make without asking:** they lock without stopping, internally as
  `status: agent-approved`. Mention them briefly afterwards ("✓ I locked the easy-to-change ones:
  …").
- **One-way (hard to undo):** never takes the fast path. It is shown to the user in plain words
  and waits for a real confirmation, exactly as in manual mode.
- **Anything the user explicitly confirmed is `ratified`, even in agent-assist mode.** The status
  follows *each decision* (did the user confirm it?), never the topic's mode. When you hand
  decisions to `blueprint:vault-architect`, mark each one `confirmed` or `agent-decided` (see
  `blueprint:topic-discussion`, step 5).

Either way, the user only ever sees plain decisions, never atoms or statuses.

`agent-approved` means *remembered as a guess*, not a human confirmation. It is deliberately a
different value from `ratified`, and that difference is load-bearing (see §4).

### The floor cannot be switched off
`hooks/one-way-guard.js` (PreToolUse) blocks any write where `reversibility: one-way` and
`status: agent-approved` appear together. It fires before any permission-mode check — including
`acceptEdits` and `bypassPermissions` — so no mode setting can outrun it.

**If the guard blocks a write:** this usually happens inside `vault-architect`, which reports it
as `BLOCKED` in its final report.
1. Tell the user in plain words that this decision is hard to undo, so you need their
   confirmation.
2. Get a real answer.
3. Re-dispatch the save with that decision marked `confirmed`, so it is written as `ratified`.
   The whole file write was blocked, so re-send *all* of that feature's decisions, not just the
   one.
Do **not** relabel `reversibility` to get past the hook. If the reversibility really was wrong,
correct it as its own decision and say why.

### Autonomous still means well-informed
Agent-assist decisions use the **same specialists** as a manual discussion (see
`blueprint:using-blueprint`, Core Concept 3). A decision made for the user gets the same specialist input it
would have gotten with the user present — never a faster, thinner substitute.

---

## 3. The Profile

Lives at `~/.claude/blueprint/profile.json` — **global, outside any project's vault.**

Stores two shapes:

1. **Concrete past choices** — "chose Postgres over Mongo for the analytics service".
2. **General tendencies** — short plain-language style notes that colour how future options get
   framed, not tied to one axis. For example: *"prefers boring, well-documented tools over new
   ones"*, or *"wants the cheap option named first, even when recommending the expensive one"*.

**(2) is weighted as more valuable than (1).** A tendency transfers to new situations; a past
choice usually doesn't.

**Focus tendencies.** When the user answers the focus question in a project, dispatch
`profile-updater` with the answer. It records it as a past choice, and once the same focus shows
up in a second project it may propose a tendency like *"usually cares most about design and frontend, lets Claude handle
infrastructure"*. It is shown to the user before saving, like any other tendency.

### The local profile — `vault-<project>/local-profile.md`

The global Profile is shared by all projects, but focus changes between projects: the same person
can be the designer in one project and do everything alone in another. So each project keeps its
own answer in `local-profile.md` (format in `blueprint:docs-management`). It is written by
`vault-architect`, never an atom, never checked by Review. **For this project it beats the global
Profile** — the global Profile only fills in when the local file says nothing about a feature.

**Neither is ever stored as an atom.** An atom records a decision that was actually made and
locked. A profile entry is a pattern noticed afterwards. Writing one as an atom would land it in
the compiled decision index and have Review start comparing features against a "decision" nobody
ever made.

### Four authority layers

Strongest first. Each layer only fills a gap the layer above left open — it never overrules it.

1. **Locked company rule** (`management-info.md` → Rules) — binding, a real locked atom
2. **Company-seeded preferences** (`management-info.md` → Preferences) — a suggestion
3. **Personal learned Profile** (this file) — a suggestion
4. **Nothing set** — fully open discussion

If layers 2 and 3 disagree, the company preference wins as the *starting suggestion*, because it
sits higher. But neither is locked, so the user overrides freely in discussion. **Only layer 1 can
block anything.**

---

## 4. Updating the Profile — closed-loop protection

**Only `ratified` decisions ever update the Profile.**

`agent-approved` decisions are logged for the record and **never feed learning**. This is not
bureaucracy — without it, the agent's own guess would reinforce itself into a "tendency", and the
next guess would be more confident for no reason. That is the failure mode this rule exists to
prevent, one level up from the decision itself.

**Trigger:** the instant an atom locks as `ratified`. Never batched, never at session end.

**Two halves:**
- *Mechanical* — `hooks/file-watcher.js` already reads `atoms.json` on every write, so it notices
  the new `ratified` atom for free and flags that a dispatch is due.
- *Reasoning* — the `profile-updater` agent decides whether this actually reveals a new or updated
  tendency, and **shows the user what it is about to write before saving**, as a plain sentence
  about their preferences ("I noticed you prefer simple, boring tools — should I remember that?"). A misread tendency
  would silently colour every future suggestion, which is the same anti-poisoning logic as
  management-info's conversion step.

**Not `vault-architect`.** That agent is explicitly project-scoped. The Profile lives outside any
project, so it gets its own writer: `agents/profile-updater.md`.

---

## 5. One friction point you must handle at setup

`Write` and `Edit` can target any absolute path, so writing the Profile is fine. But
`Read`, `Grep` and `Glob` on a path **outside** the project directory prompt for permission
**every single time**.

The update pass has to *read* the current Profile before deciding how to change it. Left
unaddressed, that means a permission prompt after every ratified decision — which quietly breaks
the one thing agent-assist mode promises.

**Fix:** `/blueprint` requests durable read/write permission on `~/.claude/blueprint/` once, as a
permission rule in the **user-level** settings file `~/.claude/settings.json`, not the project's
`.claude/settings.json`. The Profile is global, so its permission must be global too.
- Granted once, it covers every Blueprint project.
- If the rule is already there, `/blueprint` doesn't ask again.
- If you notice repeated prompts on the Profile path, the rule is missing. Fix the rule; don't
  work around it.

---

## What NOT to do

- Don't ask the mode question per sub-feature — a `target` means it inherits
- Don't branch the question on feature-vs-topic; branch on `target` / no `target`
- Don't ask it upfront for the whole project in one batch (removed on purpose)
- Don't write a Profile entry as an atom, ever — the same goes for `local-profile.md` and the
  importance/effort scores
- Don't use importance to lower the quality of a decision — it only changes depth, and only the
  mode decides who decides
- Don't let an `agent-approved` decision update the Profile
- Don't relabel `reversibility` to get past the one-way guard
- Don't let agent-assist mode use weaker reasoning than a manual discussion would
