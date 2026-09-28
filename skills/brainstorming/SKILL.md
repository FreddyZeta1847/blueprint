---
name: brainstorming
description: "Use this (not any other brainstorming skill) in a Blueprint project that has no feature list yet — right after /blueprint on an empty repo. A plain conversation with the user, with NO specialist agents, that finds out what the project is and ends with a short feature list and a processing order."
---

# Brainstorming

Use this skill when a Blueprint project has **no feature division yet** (a brand-new, empty project). This skill runs the whole-project scoping discussion: understand what the project is, what major features it needs, and establish the initial queue for detailed discussion.

Brainstorming does NOT run for ongoing additions to an established project — those go straight to Feature-Detection.

## When to invoke

- `/blueprint` found an **empty repository** (no existing code)
- OR: You're explicitly starting a new Blueprint project with no features defined yet

If the project already has features, the user's input goes directly to Feature-Detection, not here.

## Your approach

**The goal:** Converge on a project overview and initial feature list, live in conversation.

### 1. Understand the project scope

Ask open-ended questions to understand:
- What is this project? (role, main purpose, users/consumers)
- What are the major functional areas or subsystems?
- What technology choices constrain the feature split? (backend vs. frontend, data layer vs. API layer, etc.)
- What external contracts or dependencies shape the architecture?

Use the shared **feature-definition test** from `skills/using-blueprint/SKILL.md`: a feature has (1) independent why + (2) external dependents. Technology, contracts, functionality, placement are delimiting signals.

### 2. Identify initial features

Propose feature candidates based on:
- Functional boundaries (what the user described as distinct)
- Technology choices (different stacks for different parts)
- Contracts (distinct APIs, schemas, permission models)
- Placement (separate systems, organizational boundaries)

Apply the feature-definition test recursively — don't manufacture sub-features; only split when both criteria hold.

**Common feature kinds — areas to think about, not a checklist.** Design/UI, frontend,
backend/API, database/storage, auth/security, scripts/automation, integrations,
distribution/deployment. Use them to make sure nothing big is forgotten. **Never one feature per
kind:** a small site may put design and frontend in one feature and have no backend at all.

**Do NOT dispatch specialist agents here.** This is a conversation with the user, and you do not yet know what the project is — there is nothing specific enough for a domain specialist to weigh in on. Handing one a half-formed brief makes it design instead of scope: on a real run, three specialists returned 13 feature candidates for a five-file app, including "routing" and "API client" as separate top-level features. Domain agents come later, per sub-feature, in `topic-discussion`.

**Your job here is to REDUCE, not to collect.** Produce the *smallest* feature division that still passes the feature-definition test — not every candidate that could pass it. The test deliberately refuses to consider size, so this step is the only place that weighs it, and you must do that out loud: if the division is heading toward one feature per file, say so and merge. A small household app is three or four features, not thirteen.

### 3. Score each feature, and ask the user's focus

**Scores.** Show each feature in the proposed list with two 1–5 scores and a one-line reason:
- **Importance** — how much this part matters for *this project's goal*.
  1 = nice to have · 3 = a normal, needed part · 5 = the heart of the project.
- **Effort** — 1 = small, quick · 3 = a normal chunk of work · 5 = the biggest, hardest part.
  An effort-5 feature is a hint to check whether it should split.

Importance is relative to the goal. Example: for an artist's portfolio website, DESIGN and
FRONTEND (with the animations) are 5, while a CONTACT form is 2. The user changes any score in
the same pass as the feature list.

**Focus.** Right after, ask one question: *"Which of these do you care about most — the parts
you want to decide yourself? It can be all of them."* Read the global Profile first
(`~/.claude/blueprint/profile.json`); if it holds a tendency about focus, offer it as the
starting answer ("Last time you cared most about the visual side — same here?").

Importance and focus are **different things**. Importance is about the project: it controls how
much work the specialists do. Focus is about the user: it controls who makes the decisions. A
backend developer building a SaaS may not care about design, but design still matters for the
product — so it gets a deep specialist discussion, while Claude handles the decisions.

A low score **never** means lower quality. It means fewer and simpler decisions.

Scores and focus are never atoms. `vault-architect` writes them to `_features.md`,
`_queue.json` and `local-profile.md` (see `blueprint:docs-management`). After the focus answer,
also dispatch `blueprint:profile-updater` with it, so the global Profile can learn the pattern
across projects (see `blueprint:user-agent`). This is a Profile update, not a specialist — the
no-specialists rule still holds.

### 4. Propose a processing order

Once the feature list stabilizes, propose an order for detailed discussion:
- Simplest-first (foundational features before dependents)
- As-raised (respect the order you discovered them)
- Dependencies-first (start with features others depend on)

The user accepts, adjusts, or re-orders. **This order is proposed exactly once** — it's not re-litigated for every item. Later updates (sub-features discovered during detailed discussion) insert into this order, they don't restart the proposal.

### 5. Log decisions live

As the conversation happens — features identified, order locked, project scope agreed — log these into `_current-task.md` immediately. Don't hold decisions in conversation and write them all at once at the end. This preserves memory if the session is long or interrupted.

### 6. Hand off explicitly

Once the whole-project scope is locked (project overview + feature list + initial order), write that explicitly:

> "The feature list is locked and queued. Next we'll go through the features one by one."

Then invoke `blueprint:topic-discussion` for the first feature. That is where the specialists
come in.

## What to produce

- **Project overview** — what the project is, its role, main constraints
- **Initial feature list** — features identified, brief description for each, rationale
- **Scores** — importance and effort (1–5) per feature, with a one-line reason each
- **Focus** — which features the user wants to decide personally (can be all)
- **Processing order** — the order features will be discussed in detail
- **All logged to `_current-task.md`** — live, as decisions lock, not at the end

## What NOT to do

- Don't write locked atoms yet — that's Topic-Discussion's job
- Don't write vault files — vault-architect owns writing (after your decisions lock, it writes `_features.md` and updates `_index.md`)
- Don't pre-approve sub-features — apply the feature-definition test, let the test decide
- Don't re-propose the queue order on every item — propose once, then maintain (insert new items, don't restart)
- Don't dispatch specialist agents at all — they belong to `topic-discussion`, per sub-feature
- Don't arrive assuming you know what the project is — ask, and let the user tell you
- Don't hand back every candidate that passes the feature-definition test — hand back the smallest division that does
- Don't create one feature per common feature kind — the kinds are reminders, not a template
- Don't mix up importance and focus — a feature the user doesn't care about can still be important

## Key constraints

- **Feature-definition test applies** — read `skills/using-blueprint/SKILL.md` first; recursive, not just top-level
- **No specialist-dispatch here** — it is scoped to `topic-discussion`'s per-sub-feature divergence and the user-agent's agent-assist mode, nowhere else
- **You start without knowing the project** — discovering it by asking the user IS this step's job, not a preliminary to it
- **Queue gets proposed once** — "here's the order" → user accepts/adjusts → locked. No re-proposal loop.
- **Live logging to `_current-task.md`** — decisions written as they happen, not batched at the end
- **No vault writes** — vault-architect does that, atomically with cleanup

## After Brainstorming

Once locked:
1. vault-architect writes `_features.md` with the feature list, scores and initial order
2. vault-architect writes to `_queue.json` with queued features, scores and initial order
3. vault-architect writes `local-profile.md` with the user's focus, and updates `_index.md`
4. vault-architect removes the now-redundant entries from `_current-task.md`
5. All in one atomic pass (write + cleanup = one action)

**Next:** Invoke `blueprint:topic-discussion` to start discussing the first feature in detail.

**Never write code here.** Brainstorming produces a feature list, not files in the repo.

---

## Technical notes

**Live output, not batched:** Brainstorming logs to `_current-task.md` as decisions lock, not at the end. This is why that file exists — as a working surface during exploration that survives session interruption.

**One-time proposal, ongoing maintenance:** The queue order is proposed once. Items added mid-stream (sub-features discovered during detailed discussion) are inserted into the existing order — they don't reopen the "what's the right processing order?" conversation.

**No manual-vs-agent-assist here:** The User-Agent feature's question fires later, once per topic, when Topic-Discussion actually starts on that item. Not here, not tied to the feature list locking.
