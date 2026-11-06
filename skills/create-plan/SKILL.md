---
name: create-plan
description: "Build, change and run Blueprint's plan. From the confirmed context card, the planning best practices, the user's CLAUDE.md rules and data/loops.json it proposes the stages (type, name, one-line topics where they help, deadlines, independent parts), discusses them and writes blueprint/plan.json only after the user's OK. Also covers re-planning (before → after) and the life of a stage: opening, phases, closing."
---

# Create Plan

<!--
Header comment: Blueprint v3's planning skill. It turns a confirmed blueprint/context.md into
blueprint/plan.json (stages, one-line topics, current phase, deadlines, independent parts), using
the best practices written below and the stage loops in the plugin's data/loops.json. It also
owns re-planning and the stage lifecycle (open → phases → close). It never says HOW a stage is
executed: that is decided with the user when the stage opens and is outside Blueprint. The
plan-guard hook validates every write of plan.json; the format is an interface with hooks/.
-->

Blueprint gives the **pipeline**: the plan says *what* (stages and their topics), the loop of each stage
type says *which phases* it goes through. *How* each phase is done is not Blueprint's business.
First read `blueprint:using-blueprint`.

## 1. Before planning

- **The card must be confirmed.** `blueprint/context.md` has a `Confirmed:` line. If not, go back to
  `blueprint:get-context`. No exceptions.
- **Tiny work gets no plan.** If you got here with a tiny request, stop: one line of confirmation
  and do it.
- Read:
  - the card (`blueprint/context.md`);
  - `data/loops.json` at the root of the Blueprint plugin (two folders up from this skill file):
    the stage types, their `purpose`, their phases and `done_when`;
  - the user's `CLAUDE.md` rules (global and project): their rules on reviews, git, pull requests
    and tools stay theirs, and the plan respects them;
  - an existing `blueprint/plan.json` (then this is re-planning, §6) and, if there is a vault,
    `blueprint/vault/_architecture.md`.

## 2. Best practices

They are universal. Follow them unless the card gives a reason not to, and say when you don't.

1. **Aim to parallelize.** When the work has 2 or more independent parts (`parts` on the card),
   plan first a **discussion of the shared contracts and foundations** between those parts, then
   an **implementation stage that builds them in parallel**, and record the parts in that stage's
   `independent_parts`. It says *what* can run in parallel, never *how*.
2. **First what other things rest on.** Foundations and contracts before the parts that use them.
3. **Unknowns first.** If a decision depends on something nobody knows (cost, feasibility,
   access), put a **quick task** that finds out before the discussion that needs it.
4. **Early feedback.** If the approver is someone else (a client, a manager), put a delivery stage
   (a demo) early, before everything is built.
5. **Work backwards from deadlines.** With a rushed pace: less discussion (only the
   hard-to-change choices), more parallel work, a delivery with a plan B.
6. **Discuss what is hard to change.** Easy-to-change choices are decided by whoever owns the area
   (`roles` on the card), without discussing them.
7. **Every stage has a verifiable result**, said in one line when you propose it ("Result: the
   demo runs on the test data").
8. **One-line topics.** A topic is something you tell a colleague in one line — no file names, no
   task lists. "Booking and cancellation", not "create `BookingService.ts` with 4 methods".
9. **Small stages.** A stage that does not close in a few working sessions gets split. "Database +
   API + login" in one stage is three stages, or at least two.
10. **Small work, small plan.** Don't add stages for completeness. One stage is a fine plan.
11. **Try to break it (project-size plans).** Before showing a project plan, you may ask one fresh
    agent to attack it: missing contracts, "parallel" parts that would touch the same files,
    stages with no verifiable result. Fix what holds up, then show the plan.

**How many stages** (guidance, not a rule):

| Size | Example | Stages |
|---|---|---|
| Tiny | "change the button colour" | no plan |
| Small | "check whether our hosting supports WebSockets" | 1–3 (often one quick task) |
| Medium | "add Google login" | 2–5, or topics added to an existing stage |
| Full project | "a booking site for a gym" | usually around **8–12** |

If a full project comes out with fewer stages, check practice 9 first: one stage is probably too
big. Never pad stages to reach the range (practice 10 still holds). The format is the same at
every scale.

## 3. Choose the stage types

Each stage has one type from `loops.json`; pick the one whose `purpose` fits. In short:
- **discussion** — decide (no production code); each topic is one decision to take;
- **implementation** — build and verify one or more parts;
- **verification** — check something that already exists (user test, load, security…);
- **delivery** — show the work to someone (demo, presentation, document);
- **quick_task** — a short job of any nature (a mini discussion, ten lines of code, a mockup, a
  check).

The phases come from the type, not from you. You choose the stages and their topics.

### Topics

Topics say what a stage is about, one line each (practice 8). When you talk to the user, use their
language (in Italian: *argomenti*).
- **discussion, verification** (one phase per topic): at least one topic. Each topic is one
  decision to take or one check to run, and moves through the phases on its own.
- **implementation, delivery, quick task** (one phase for the whole stage): topics are optional.
  Use them when the stage has several parts ("Calendar", "Booking and cancellation"). A stage with
  a single part ("Publish the site") has none: its name says it all.
- **A topic is never a phase.** The phases come from the loop. "Rehearsal, Demo, Feedback" are the
  delivery phases (rehearse → deliver → feedback), not topics. A demo's topics are what is shown
  ("Booking flow", "Admin area"), or there are none.
- When a stage has `independent_parts`, each part is also a topic with the same name.

## 4. Propose and discuss

Show the plan in chat in plain words, one block per stage. Example:

> **Plan — Gym bookings** (pace: calm, no deadline)
> 1. **Foundations** (discussion) — stack and hosting · the API contract between frontend and
>    backend · data model for bookings.
> 2. **Frontend demo** (implementation) — calendar · booking and cancellation. *Independent parts,
>    can be built in parallel on the contract from stage 1.* Result: the demo runs on the test
>    data.
> 3. **Publish the demo** (implementation) — on the free hosting chosen in stage 1. Result: the
>    owner can open it from his phone.
> 4. **Demo to the owner** (delivery) — the booking flow, end to end. Deadline 13 Nov.
>
> **Vault:** yes — several foundation areas and a client who approves.
> Anything to change?

- Say in one line why each stage sits where it is when it is not obvious.
- Propose the vault according to the card's `documentation` answer; the user confirms.
- Real alternatives (for example "demo first or backend first?") → a multiple-choice question,
  recommendation first.
- Discuss until the user says OK. Push back once if they drop something you think is needed (say
  what is traded away), then follow their call.

## 5. Write `blueprint/plan.json` — only after the OK

```json
{
  "version": 3,
  "project": "Gym bookings",
  "context": "blueprint/context.md",
  "stages": [
    {
      "id": "foundations",
      "name": "Foundations",
      "type": "discussion",
      "status": "todo",
      "topics": [
        { "name": "Stack and hosting", "done": false },
        { "name": "API contract between frontend and backend", "done": false }
      ]
    },
    {
      "id": "frontend-demo",
      "name": "Frontend demo",
      "type": "implementation",
      "status": "todo",
      "deadline": "2026-11-13",
      "independent_parts": ["Calendar", "Booking and cancellation"],
      "topics": [
        { "name": "Calendar", "done": false },
        { "name": "Booking and cancellation", "done": false }
      ]
    },
    {
      "id": "publish-demo",
      "name": "Publish the demo",
      "type": "implementation",
      "status": "todo"
    }
  ]
}
```

- `id`: lowercase kebab-case (`frontend-demo`), unique, never changed later. `name` and topic
  names in the user's language; topic names are unique inside a stage (they identify the topic).
- `type`: a key of `loops.json`. `status`: `todo` · `in_progress` · `done` · `postponed`.
- `deadline` optional (`YYYY-MM-DD`). `independent_parts` only where practice 1 applies.
- A new stage has no `phase`, no `how`, no `skipped`: those are set when it opens (§7).
- `topics` (see "Topics" in §3): required, at least one, in discussion and verification stages;
  optional in implementation, delivery and quick task stages (the parts to do, when there are
  several). Each topic is `{ "name", "done" }`; `phase` and `postponed` are added while the stage
  runs (§7).
- Only the main session writes this file, with `Write` or `Edit`.

**The plan-guard hook checks every write.** If it refuses, read its reason, fix the file and
write again. Never work around it. If it asks for confirmation (a `done` stage being changed),
that change needs the user's explicit request.

If the card asks for a vault and `blueprint/vault/` does not exist yet, create it now with the
scaffold in `blueprint:docs-management` §3.

Then tell the user the plan is saved and ask whether to open the first stage.

## 6. Re-planning

**What triggers it:** the user asks; a deadline moves; the card changes (role, approver, budget);
a verification fails; delivery feedback asks for something else; a new task arrives on a running
project and fits this plan.

**How:**
1. Propose the change as **before → after**, in plain words. Example: *"The demo moves from Friday
   to Wednesday → stage 2 in a rush: I drop the design discussion, the three parts are built in
   parallel."* A new task that fits the plan becomes new topics in a stage that is not done yet, or
   a new stage in the right place.
2. Wait for the user's yes.
3. Rewrite `blueprint/plan.json`. The plan-guard hook checks it.

**Stages already done are not touched** unless the user explicitly asks. Git keeps the history of
the plan; don't keep old versions in the file.

## 7. The life of a stage

### Opening (Blueprint)

Before any work on a stage, read it and its loop in `loops.json`, and tell the user three things:
its **topics** (if it has any), the **phases** (strike the optional ones you would skip, with the
reason) and **how you would do it**. Then wait for the OK.

> Stage 3 "WebSocket check on Azure" (quick task, no topics): does our hosting plan support
> WebSockets? Phases: do → check → report.
> How: I read the provider's docs and try a small test connection. OK?

> Stage 2 "Frontend demo" (implementation). Topics: calendar, booking (independent).
> Phases: ~~clarify~~ (foundations already decided) → plan → build → test → review → integrate.
> How: the two parts in parallel on the fixed API contract. OK?

The "how" is yours to propose with whatever the user has (their own skills, plugins, habits); the
user confirms or changes it. Blueprint never prescribes it. After the yes, write in `plan.json`:
- `status: "in_progress"`;
- `phase`: the first phase actually done — on the stage only for per-stage types, on each topic
  only for discussion and verification (never both);
- `skipped`: every optional phase skipped, each with its `reason`;
- `how`: one line with what the user confirmed.

### Phases (not Blueprint)

The phases run in order, with the tools chosen at the opening. A discussion stage runs its phases
through `blueprint:topic-discussion`. Blueprint only records each move:
- move the `phase` forward **one phase at a time**, as soon as the phase has produced what the loop
  says it `produces`;
- a phase marked `user: true` needs the user (a choice, a delivery, an outcome to see): stop there
  and ask;
- if a result is not good enough, go back to the phase in its `back_to`, nowhere else;
- an optional phase is skipped only with a reason in `skipped`;
- a phase, once set, is never removed;
- in a discussion or verification stage, a topic that is postponed stays `done: false` and gets
  `"postponed": "<reason>"`: tell the user why, and move it to a later stage when you re-plan.

### Closing (Blueprint)

When the type's `done_when` holds: tick the finished topics `done: true` (all of them in a
per-stage type; in a discussion or verification stage every topic must be done or carry
`"postponed": "<reason>"`, which the plan-guard checks), set `status: "done"`, and tell the
user in one line what the stage produced. Then ask whether the rest of the plan still holds (a
result can change later stages → re-planning, §6), and whether to open the next stage.

## What NOT to do

- Don't plan before the card is confirmed, and don't plan tiny work
- Don't write `plan.json` before the user's OK
- Don't put files, tasks or tool names in topics, and never use a phase as a topic
- Don't pad a plan with stages to reach a number, and don't squeeze a project into a few big stages
- Don't say how a stage will be executed in the plan: `how` is set at the opening, with the user
- Don't add stages for completeness
- Don't change a done stage unless the user explicitly asks
- Don't jump phases, and don't skip a mandatory one
- Don't start a stage without the opening and the user's OK
