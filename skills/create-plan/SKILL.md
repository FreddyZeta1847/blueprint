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
  - an existing `blueprint/plan.json` (then this is re-planning, §6) and, if there is a decisions
    folder, `blueprint/decisions/_architecture.md`.

## 2. Best practices

They are universal. Follow them unless the card gives a reason not to, and say when you don't.

1. **Aim to parallelize.** When the work has 2 or more independent parts (`parts` on the card),
   plan first a **discussion of the shared contracts** between those parts (and of the shared
   choices they all rely on), then
   an **implementation stage that builds them in parallel**, and record the parts in that stage's
   `independent_parts`. It says *what* can run in parallel, never *how*.
2. **First what other things rest on.** Shared choices and contracts before the parts that use
   them.
3. **Unknowns first.** If a decision depends on something nobody knows (cost, feasibility,
   access), put a **quick task** that finds out before the discussion that needs it.
4. **Early feedback.** If the approver is someone else (a client, a manager), put a delivery stage
   (a mockup, a small demo) early, before everything is built. Same when a choice is easier to
   make by looking at something: a delivery stage (a mockup) before the discussion that needs it.
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
- **implementation** — build one or more parts; its loop ends with tests and a review, so the
  check of what is built is inside it, not a stage of its own;
- **delivery** — make something to show, quickly and at low risk: a mockup, a small demo on code
  or infrastructure that already exists, a presentation, a video, a document. Never new production
  features (those are implementation);
- **quick_task** — a short, low-risk job that is neither a discussion nor something to show: find
  out an unknown, check something that already exists (load, security), a small fix.

The phases come from the type, not from you. You choose the stages and their topics.

### Topics

Topics say what a stage is about, one line each (practice 8). When you talk to the user, use their
language (in Italian: *argomenti*).
- **discussion** (one phase per topic): at least one topic. Each topic is one decision to take,
  and moves through the phases on its own.
- **implementation, delivery, quick task** (one phase for the whole stage): topics are optional.
  Use them when the stage has several parts ("Calendar", "Booking and cancellation"). A stage with
  a single part ("Publish the site") has none: its name says it all.
- **A topic is never a phase.** The phases come from the loop. "Rehearsal, Demo, Feedback" are the
  delivery phases (prepare → rehearse → deliver → feedback), not topics. A demo's topics are what is
  shown ("Booking flow", "Admin area"), or there are none.
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
> **Decisions folder:** yes — several areas of hard-to-change choices and a client who approves.
> Anything to change?

- Say in one line why each stage sits where it is when it is not obvious.
- Propose where the decisions live according to the card's `documentation` answer (decisions
  folder, single decisions file `blueprint/decisions.md`, or the card); the user confirms.
- Real alternatives (for example "demo first or backend first?") → a multiple-choice question,
  recommendation first.
- Discuss until the user says OK. Push back once if they drop something you think is needed (say
  what is traded away), then follow their call. **Always push back once** when the user drops a
  mockup / design-direction stage from work where the look matters (a website, an app, a
  presentation): say concretely what is lost (the look is chosen without seeing it, and a bad one
  is found only at the end), then follow their call — the implementation still shows real mockups
  before building.

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
- `topics` (see "Topics" in §3): required, at least one, in discussion stages;
  optional in implementation, delivery and quick task stages (the parts to do, when there are
  several). Each topic is `{ "name", "done" }`; `phase` and `postponed` are added while the stage
  runs (§7).
- Only the main session writes this file, with `Write` or `Edit` — never with the shell
  (`cat >`, `printf >`, heredocs): the hooks check only Write and Edit. The same holds for every
  file in `blueprint/`.

**The plan-guard hook checks every write.** If it refuses, read its reason, fix the file and
write again. Never work around it. If it asks for confirmation (a `done` stage being changed),
that change needs the user's explicit request.

If the card asks for a decisions folder and `blueprint/decisions/` does not exist yet, create it
now with the scaffold in `blueprint:docs-management` §3.

Then tell the user the plan is saved and ask whether to open the first stage.

## 6. Re-planning

**What triggers it:** the user asks; a deadline moves; the card changes (role, approver, budget);
tests or a review show the plan was wrong; delivery feedback asks for something else; a new task arrives on a running
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

Before any work on a stage, read it and its loop in `loops.json`.

**The context check comes first, always.** Every loop starts with the mandatory phase `clarify`:
ask yourself *"Do I have enough context to carry out this stage on my own?"* — and answer it out
loud. Look at the card, the written decisions, the stage's notes, the code. How often the answer is
"no" depends on the type:
- **discussion** — rarely: the discussion itself is where the context comes from;
- **implementation** — sometimes (a decision missing, code you don't know); the stage always has
  its own implementation plan anyway (the `plan` phase);
- **quick task** — sometimes: how the user wants it done, parameters someone gave them;
- **delivery** — almost always: who it is for, the format, the message, the limits.

If the answer is "no", the phase is a short — not hurried — discussion with the user that fills
the gap (one or two questions per message, recommendation first). If it is "yes", say in one line
why, and the phase is done.

Then tell the user three things: its **topics** (if it has any), the **phases** (strike the
optional ones you would skip, with the reason) and **how you would do it** — phase by phase when
different tools serve different phases. Then wait for the OK.

> Stage 3 "Admin mockup" (quick task, no topics).
> Context: not enough — I don't know the style you want or what the client gave you. Two
> questions first: …
> Phases: context check → do → check → report.
> How: the context check with you here; the mockup with impeccable; then I check it at phone
> width. OK?

> Stage 2 "Frontend demo" (implementation). Topics: calendar, booking (independent).
> Context: enough — the API contract and the stack are written in the decisions.
> Phases: context check → plan → build → test → review → first use (started with your own instructions, a fresh database, every action tried) → integrate.
> How: the two parts in parallel on the fixed API contract. OK?

The "how" is yours to propose with whatever the user has (their own skills, plugins, agents,
habits); the user confirms or changes it. Blueprint never prescribes it and never limits it: any
plugin, skill or agent can serve any phase of any stage (see `blueprint:using-blueprint`, "The
boundary"). After the yes, write in `plan.json`:
- `status: "in_progress"`;
- `phase: "clarify"` (the context check is the first phase recorded, even when it took one line),
  then forward one phase at a time — on the stage only for per-stage types, on each topic only for
  discussion (never both);
- `skipped`: every optional phase skipped, each with its `reason`;
- `how`: one line with what the user confirmed.

### Phases (not Blueprint)

The phases run in order, with the tools chosen at the opening. A discussion stage runs its phases
through `blueprint:topic-discussion`. Blueprint only records each move:
- move the `phase` forward **one phase at a time**, as soon as the phase has produced what the loop
  says it `produces`;
- a phase marked `user: true` needs the user (a choice, a delivery, an outcome to see): stop there
  and ask;
- **`first_use` (implementation) is never a formality.** Green tests prove the code does what the
  tests ask, not that the product works for the person who opens it. Start the work exactly with
  the instructions you will give the user, in every way of starting it you offer (e.g. a single
  server *and* a dev server + backend), on a fresh empty store (the page must say what is missing)
  and then with sample data, with the real clock; try every action as a first-time user would
  (every write, every page, the first screen they see); send the screenshots and the start-up
  instructions to the user, who tries it too. Anything that fails goes back to `build`. Never give
  the user start-up instructions you have not run yourself;
- if a result is not good enough, go back to the phase in its `back_to`, nowhere else;
- an optional phase is skipped only with a reason in `skipped`;
- a phase, once set, is never removed;
- if the work shows that a written decision is wrong (an implementation hits a limit, a delivery's
  feedback rejects it), stop and tell the user. The correction is written where the card's
  `documentation` answer keeps decisions, like any decision, with this stage as its `Stage` (a
  one-way correction is the user's to make); if it changes later stages, propose the re-planning
  (§6);
- every stage type records the choices it settles (a quick task's parameters, the direction a
  delivery's feedback rounds converge on) in the same place: decisions folder, single decisions file
  or the card (`blueprint:docs-management` §1). A choice that lives only in the chat is lost;
- anything the user must judge by looking (a mockup, a page, a design) is shown as **real images**
  or a running page, never only described in words; the user's OK counts only on what they saw;
- in a discussion stage, a topic that is postponed stays `done: false` and gets
  `"postponed": "<reason>"`: tell the user why, and move it to a later stage when you re-plan.

### Closing (Blueprint)

When the type's `done_when` holds: tick the finished topics `done: true` (all of them in a
per-stage type; in a discussion stage every topic must be done or carry
`"postponed": "<reason>"`, which the plan-guard checks), set `status: "done"`, and tell the
user in one line what the stage produced. Do it in **one coherent write** (topics, final phase and
status together; the next stage's opening may go in the same write): two separate edits leave the
plan inconsistent in between. In a project under git where `main` takes only approved PRs, the
closing travels in the stage's own PR — for the **last** stage too, so no extra PR is needed for
the plan alone. Then ask whether the rest of the plan still holds (a
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
