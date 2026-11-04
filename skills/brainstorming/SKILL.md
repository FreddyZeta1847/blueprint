---
name: brainstorming
description: "Use this (not any other brainstorming skill) in a Blueprint project with no areas or sections yet — right after /blueprint on an empty repo. A conversation with stop points and NO specialists that ends with foundation areas, sections, graph, who decides each area, and a proposed path."
---

# Brainstorming

Use this skill when a Blueprint project has **nothing divided yet** (a brand-new, empty project).
It finds out what the project is and ends with everything the next steps need: the foundation
areas, the sections, the dependency graph, who decides each area, and a proposed path.

Ongoing work on an established project goes to `blueprint:feature-detection`, not here.

Read `blueprint:using-blueprint` first: Core concept 1 (foundations vs sections), 2 (the path),
3 (who decides each area) and 6 (multiple-choice questions) are used below.

## The flow — four phases, three hard stops

You may **not** merge phases into one message. Each `STOP` means: send the message, end your
turn, and wait for the user's answer. Never answer your own questions, never "assume for now and
continue".

### Phase 1 — Understand the project → STOP

Ask what the project is, in plain words. Cover, in a few short questions (not a questionnaire):
- what it is and who uses it;
- the main things a user can do with it;
- anything already fixed (a cloud the company uses, a language the team knows, a deadline, a
  budget);
- whether it ships in stages (MVP1, MVP2…).

If the kind of project is still unclear after the user's first answer (website? app? internal
tool?), ask it as a multiple-choice question (Core concept 6).

Log what you learn into `_current-task.md` as you go.

**STOP. Wait for the answers.** If the answers leave a big gap, ask one more short round, and STOP
again. Do not propose anything in this phase.

### Phase 2 — Propose the division → STOP

In one message, propose:

1. **A short project overview** (3–5 lines): what it is, for whom, the fixed constraints.
2. **The foundation areas** — the shared choices that are expensive to get wrong. Typical areas:
   DB, cloud, CI/CD, versioning, auth and security, contracts/API, external integrations,
   acceptance tests, deploy, project rules. Propose only the ones this project actually has, each
   with one line on *what will be decided there* (not the decision itself). A small static site
   may have three areas; a SaaS may have eight.
3. **The sections** — the pieces of value for the end user (SIGNUP, LANDING-PAGE…), each with one
   line, the MVP it belongs to, and the areas it uses.
4. **The graph** as a Mermaid diagram: areas on top, sections below, arrows for "depends on".
5. **Importance** (1–5) of each area and section, with a one-line reason. Importance sets how deep
   the specialists go later. It never lowers the quality of a decision.

**Your job here is to REDUCE.** Propose the smallest division that still separates the things
that need their own discussion. Never one area per common kind just to fill a template. Say out
loud when you merge two candidates and why.

If there is a real choice in the MVP split (for example "payments in MVP1 or MVP2?"), ask it as a
multiple-choice question.

**STOP. Wait.** The user corrects the division in one pass. Repeat Phase 2 only if they ask for
big changes.

### Phase 3 — Who decides each area → STOP

Ask, in one multiple-choice question (multi-select): *"Which of these areas do you want to decide
yourself? I handle the others and write down every choice, and anything hard to change later
still comes back to you."* List the areas in plain words.

- Read the global Profile first (`~/.claude/blueprint/profile.json`). If it holds a tendency
  about this ("usually decides infrastructure, leaves design to Claude"), use it as the
  recommended answer and say so.
- Sections are not asked here: a section's decisions follow the areas it touches, and its own
  details are Claude's unless the user says otherwise.
- If `AskUserQuestion` is not available, list the areas numbered and ask the user to name the
  ones they want to decide.

**STOP. Wait for the answer.**

### Phase 4 — Propose the path → STOP

Propose the path (mode B, Core concept 2): the ordered steps, each with its kind (`discuss`,
`prototype`, `mockup`, `build`) and one line on why it sits there.
- Foundations before the sections that need them, following the graph.
- Discussion and building alternate when that helps. Example: discuss CLOUD + DB → build the
  backend and test it with Postman → discuss the design → mockup → build the frontend → publish.
- If a choice depends on feasibility nobody knows yet (a library, a cost, a performance limit),
  put a `prototype` step before the discussion that needs it, and say why.
- For each `build` step, name the profile (backend, frontend…) and who runs it (`session` for
  one section, `mother` when several sections can be built in parallel).

If there are real alternatives (for example "design first or backend first?"), ask as a
multiple-choice question.

**STOP. Wait for the confirmation.**

## Writing the result

When the user has confirmed Phase 4, write the vault yourself (schema and templates in
`blueprint:docs-management`):

1. `_architecture.md` — overview, the graph, the table of foundation areas (with a link to each
   area file), the contracts table (empty for now).
2. `_sections.md` — the sections table.
3. `local-profile.md` — who decides each area.
4. `_queue.json` — the path, `"mode": "B"`, every step `pending`, importance on `discuss` steps.
5. One file per area (`foundations/AREA/AREA.md`) and per section (`sections/SEZ/SEZ.md`) with
   frontmatter and a short "what will be decided here" — no decisions yet.
6. `_index.md` updated; the settled lines removed from `_current-task.md`.

Then read the `[Blueprint]` messages the hooks returned, if any, and explain them in plain words.
Only then tell the user it is saved, and ask: *"Shall I start the first step — <name>?"*

After the Phase 3 answer, also dispatch `blueprint:profile-updater` with it, so the global Profile
can learn the pattern. This is a Profile update, not a specialist. It follows the two-dispatch save
in `blueprint:user-agent` §4 (propose → the user agrees → a fresh save dispatch); you never write
the Profile yourself.

## What to produce

- Project overview
- Foundation areas (with what will be decided in each and its importance)
- Sections (with MVP, areas used, importance)
- The graph (Mermaid)
- Who decides each area
- The path, in `_queue.json`
- All logged live in `_current-task.md` and then written to the vault

## What NOT to do

- Don't merge phases or skip a STOP. Proposing the division before the user has described the
  project is the most common failure of this skill
- Don't dispatch specialist agents — they belong to `blueprint:topic-discussion`
- Don't decide anything inside an area here (no "we'll use PostgreSQL"). Brainstorming says
  *what will be decided where*; the deciding is topic-discussion's job
- Don't create one area per common kind, and don't hand back every possible section — the
  smallest division that works
- Don't ask "who decides" one area at a time — one multiple-choice question for all
- Don't write code or create source files

## After brainstorming

Start the first step of the path only when the user says so. A `discuss` step opens
`blueprint:topic-discussion`, where the specialists come in.
