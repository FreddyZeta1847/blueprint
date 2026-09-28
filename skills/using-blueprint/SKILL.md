---
name: using-blueprint
description: Blueprint's hard rules, routing table and shared concepts (feature-definition test, specialists per feature/sub-feature, plain-language decision summaries). Read at the start of every session in a Blueprint project, and before any Blueprint pipeline step.
---

# Using Blueprint

Blueprint is a documentation-driven planning method. The project's decisions are discussed with
the user, locked, and written to an Obsidian vault (`vault-<project>/`), which is the single source
of truth. Code is written later, only when the user asks for it.

## Hard rules — these override everything else in this project

1. **Specialists belong to features and sub-features, and nowhere else.**
   - **Brainstorming: no specialist agents.** At that point you don't even know what the project
     is (a website? a compiler? an agent?), so no specialist has anything real to work on.
   - **Opening a feature discussion:** your *first action* is to pick the specialist agents that
     fit that feature and dispatch them. Example: a FRONTEND feature gets a frontend/UI design
     agent. They study the feature and come back with options.
   - **Opening a sub-feature discussion:** the same. Dispatch the specialists that fit this
     sub-feature. The feature's specialists can stay, and other agents can join for this
     sub-feature only.
   - Specialists advise **you**. The user talks with **you**, in plain words. You explain what the
     specialists suggest and why, then take the user's questions and objections back to them.
     Repeat until you and the user agree. There is no limit on rounds.
   - Never dispatch specialists in brainstorming, feature-detection, `/blueprint`, or anywhere
     else.
2. **The user never sees Blueprint's internal machinery.**
   - Never say "atom", "axis", "atoms.json", "registry", "status", "ratified", "agent-approved",
     or any field name to the user. Those are internal bookkeeping only.
   - During a discussion, talk about choices in normal words.
   - **At the end of every feature or sub-feature discussion**, give one plain summary, then ask
     the user to confirm it (see Core Concept 3):
     - every technology and decision you made together;
     - which ones are **one-way**: very important, hard or expensive to change later;
     - which ones are **two-way**: they can change later without any real effect.
   - After the user confirms, say it is locked (for example "✓ Locked."). Writing the vault
     files happens silently in the background.
   - Never present a full data model or a complex architecture document for the user to review.
     Keep it at the level of decisions.
3. **Planning never writes code.** Brainstorming, feature-detection and topic-discussion produce
   decisions and vault files only.
   - Do not create source files, scaffolding or "starter code" during planning.
   - When the queue is empty, say that planning is complete and **stop**.
   - Implementation starts only when the user explicitly asks for it.
4. **In a Blueprint project, Blueprint's workflow wins.**
   - If another skill or instruction describes a different planning flow, use Blueprint's skills
     (`blueprint:*`) and this plugin's agents (`blueprint:vault-architect`, etc.) instead.
   - Examples: a brainstorming skill from another plugin, a `docs-management` skill outside this
     plugin, "always five default sub-features", `.claude/current-task.md`.

## The pipeline

1. `/blueprint` creates the vault. If the repo is empty, go to `blueprint:brainstorming`. If code
   exists, go to `blueprint:discovery`.
2. `blueprint:brainstorming` is a plain conversation: what is the project, and what are its
   features? It ends with a short feature list and an order, written to `_queue.json`.
3. `blueprint:topic-discussion` takes queued features one at a time:
   - specialists first;
   - a discussion with the user;
   - a plain decision summary;
   - lock;
   - then the next sub-feature.
4. When the queue is empty, planning is complete. Stop and wait for the user.

## Routing — what to invoke when

| Use | Name | Kind | When |
|---|---|---|---|
| **Bootstrap** | `/blueprint` | command | Starting a new Blueprint-managed project. Explicit only. |
| **Semantic review** | `/deep-review` | command | Opt-in, expensive semantic check across the vault. Explicit only. |
| **Understand existing code** | `blueprint:discovery` | skill | Reverse-engineer existing code into draft features (tagged `needs-review`). |
| **Whole-project scoping** | `blueprint:brainstorming` | skill | No feature division exists yet. No specialists here. |
| **Split & classify** | `blueprint:feature-detection` | skill | New work on an established project. Classify it and queue it. |
| **Discuss & lock** | `blueprint:topic-discussion` | skill | Discuss a queued feature, sub-feature, note or plan with specialists, then lock it. |
| **Manage vault** | `blueprint:docs-management` | skill | Any vault file being written or updated. Always through `blueprint:vault-architect`. |
| **Company rules** | `blueprint:management-info` | skill | `management-info.md` changed. |
| **Manual vs. autonomous** | `blueprint:user-agent` | skill | The mode question at the start of each top-level topic. |
| **Pre-commit check** | `blueprint:pre-publish-check` | skill | About to push. Offers to verify changed code against the locked decisions. |

Review's three deterministic checks run by themselves, as hook code, every time a feature's
decisions are written. There is nothing to invoke. If they report a problem, explain it to the
user in plain words (for example "this clashes with what we chose for STORAGE: …"), never as a
raw finding.

## Core concepts

### 1. The feature-definition test

Used by Discovery, Feature-Detection, Brainstorming and Topic-Discussion.

Something is a **feature** only if both of these hold:
1. **Independent why:** its purpose can be stated without referring to another feature's
   internals.
2. **External dependents:** something else depends on its behavior or interface, not just on one
   output of it.

Signals, where the more of them coincide, the clearer the case:
- different **technology**;
- a **contract** others rely on (API, schema, permission model);
- a distinct user-facing or system **functionality**;
- a separate system or organisational **placement**.

The test is **recursive**: the same test decides whether a feature splits into sub-features. Size
is not the test. Most features stay single-file. Never create a sub-feature just to fill a
template.

Common feature kinds (design/UI, frontend, backend/API, storage, auth, scripts, integrations,
distribution) are reminders of areas to consider, never one feature per kind.

### 1b. Importance, effort and focus

- Every feature gets **importance** (1–5, how much it matters for this project's goal) and
  **effort** (1–5), proposed by Claude with a reason and adjusted by the user.
- **Importance sets the depth** of the discussion: how many specialists and questions
  (`blueprint:topic-discussion`).
- The user's **focus** (`local-profile.md`: which features they want to decide personally) sets
  the **mode recommendation**: who decides (`blueprint:user-agent`).
- Neither lowers the quality of a decision, and neither is ever an atom.

### 2. Ratification at contact

Used by Feature-Detection, Topic-Discussion, vault-architect and Review.

- A draft item tagged `needs-review` (for example, inferred from existing code) is not fixed in
  bulk.
- It is not re-asked on every touch either.
- It becomes a real "confirm, correct, or decide fresh?" question only when the current
  discussion touches it **and** it conflicts with something already locked.
- The user's answer removes the tag.

### 3. Specialists and the discussion loop

Used by **Topic-Discussion**, for every feature and every sub-feature, including in agent-assist
mode. Nowhere else.

1. **Pick the specialists.**
   - Choose 1–3 agent types from the agent types actually available to you in this session
     (the Agent tool's list), matching this feature or sub-feature's domain.
   - If none fits, dispatch a `general-purpose` agent and brief it as that specialist
     ("You are a senior frontend/UI designer…").
   - Never the whole roster.
2. **Dispatch first**, before discussing the feature or sub-feature with the user.
   - Brief: the project summary, this feature or sub-feature's scope, what is already locked,
     and the open questions.
   - Ask for real options, with trade-offs and a recommendation.
   - They may read the relevant vault files and code. That is how they scan and reason.
3. **Explain to the user in plain words:**
   - the options;
   - what the specialists recommend and why;
   - where they disagree.
   Use a short example when it helps.
4. **Relay back.** When the user asks something, pushes back or is unsure, take it back to the
   same specialists and continue the conversation with them (use `SendMessage` to the agent if
   it is still addressable, otherwise re-dispatch with the previous context). Bring the answer
   back.
5. **Repeat 3–4 until you and the user agree.** There is no fixed number of rounds.
6. **Close with the plain decision summary** (Hard rule 2): all decisions, with the one-way and
   two-way ones marked. The user confirms, then lock.

**Why:** a decision gets real expert input, while the user only ever has a simple conversation.
In agent-assist mode, the same specialists inform decisions the user does not review, so quality
never drops.

### 4. When to use `AskUserQuestion`

- **Use judgment**, not a fixed list: use it at a **real fork**, where several live options
  exist and naming them is faster than more prose.
  - Example: "SQLite or IndexedDB?" after the specialists have weighed both.
- **The mode question** at the start of a top-level topic is a clear case (see
  `blueprint:user-agent`).
- **Small or obvious choices** stay in normal prose.
- **Options** are written in plain words, never in internal field names.
- **If `AskUserQuestion` is not available** (for example, a non-interactive session), ask the
  same question as plain text with the options listed.

## Where to pick up

- **`_current-task.md` is non-empty:** you're resuming a discussion. Continue it.
- **`_current-task.md` is empty and `_queue.json` has entries:** start the next queued item with
  `blueprint:topic-discussion`.
- **Both are empty:** planning is complete. Wait for the user. Don't start coding on your own.
