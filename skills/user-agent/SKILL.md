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
Manual or agent-assist for <topic>?
  - Agent-assist (Recommended — your profile leans this way for infra topics)
      Two-way decisions lock automatically, no stopping. One-way decisions
      still always stop and come back to you.
  - Manual
      Every decision is shown to you before it locks.
```

**Per-feature assignment IS the targeting mechanism.** There is nothing extra to build for
"agent-assist on easy features only" — assigning per topic already does exactly that.

### Where the answer is stored

A small annotation on that feature's own entry in `_features.md`, which `vault-architect` already
keeps current on every change. **No new file.** Written the moment the question is answered.

---

## 2. What each mode actually does

### Manual mode
Every decision stops and shows the proposed atom(s) before locking — including which axes are
being reused and which are newly proposed, and why a new axis doesn't fit an existing one when
that's the case. Waits for confirmation. Locks as `status: ratified`.

### Agent-assist mode
- **Two-way (reversible) decision** → locks immediately, no stopping, `status: agent-approved`.
  That is the entire point of the mode.
- **One-way (irreversible) decision** → never takes the fast path. Stops, and comes back to the
  user for a real confirmation, exactly as manual mode would.

`agent-approved` means *remembered as a guess*, not a human confirmation. It is deliberately a
different value from `ratified`, and that difference is load-bearing (see §4).

### The floor cannot be switched off
`hooks/one-way-guard.js` (PreToolUse) blocks any write where `reversibility: one-way` and
`status: agent-approved` appear together. It fires before any permission-mode check — including
`acceptEdits` and `bypassPermissions` — so no mode setting can outrun it.

**If the guard blocks you:** present the decision, get a real answer, and write it as `ratified`.
Do **not** relabel `reversibility` to get past the hook. If the reversibility really was wrong,
correct it as its own decision and say why.

### Autonomous still means well-informed
Agent-assist decisions use the **same specialist-dispatch pattern** as a manual discussion (see
`using-blueprint`, Core Concept 3). A decision made for the user gets the same specialist input it
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
  tendency, and **shows the user what it is about to write before saving.** A misread tendency
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
`settings.json` permission rule. Granted once, never asked again per lock. If you notice repeated
prompts on the Profile path, that rule is missing — fix the rule, don't work around it.

---

## What NOT to do

- Don't ask the mode question per sub-feature — a `target` means it inherits
- Don't branch the question on feature-vs-topic; branch on `target` / no `target`
- Don't ask it upfront for the whole project in one batch (removed on purpose)
- Don't write a Profile entry as an atom, ever
- Don't let an `agent-approved` decision update the Profile
- Don't relabel `reversibility` to get past the one-way guard
- Don't let agent-assist mode use weaker reasoning than a manual discussion would
