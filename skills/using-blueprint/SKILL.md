---
name: using-blueprint
description: Blueprint's hard rules, entry step, routing table and shared concepts (foundations vs sections, the path, who decides each area, plain-language summaries). Read at the start of every session in a Blueprint project and before any Blueprint step.
---

# Using Blueprint

Blueprint is a documentation-driven method. The decisions that are expensive to get wrong (the
**foundations**) are discussed with the user, locked, and written to a versioned Obsidian vault
(`vault-<project>/`), which is the single source of truth. Everything else Claude decides itself
and records too, so every choice can be remembered later. Work moves along a **path**: a list of
steps where discussion, prototypes, mockups and building alternate.

## Hard rules — these override everything else in this project

1. **Specialists belong to foundation areas and sections, and nowhere else.**
   - **Brainstorming: no specialist agents.** At that point you don't even know what the project
     is, so no specialist has anything real to work on.
   - **Opening the discussion of a foundation area, contract or section:** your *first action* is
     to pick the specialist agents that fit it and dispatch them. Example: the DB area gets a
     database agent; a LANDING-PAGE section gets a UI design agent.
   - Specialists advise **you**. The user talks with **you**, in plain words. You turn their work
     into **one proposal** and take the user's questions back to them. No limit on rounds.
   - Never dispatch specialists in brainstorming, feature-detection, `/blueprint`, or anywhere
     else.
2. **The user never sees Blueprint's internal machinery in chat.**
   - Never say "atom", "axis", "atoms.json", "registry", "status", "ratified", "agent-approved",
     or any field name to the user. Talk about choices in normal words.
   - **At the end of every discussion**, give one plain summary and ask the user to confirm it:
     every decision, which ones are **one-way** (hard or expensive to change later) and which are
     **two-way** (easy to change later).
   - Never present a full data model or architecture dump for review. Keep it at decision level.
   - The vault files themselves use fixed keys (`Choice`, `Decided by`…). That is file content,
     readable in Obsidian; it is not something you recite in chat.
   - **Write the vault in the language the user speaks** (an Italian user gets an Italian vault:
     prose, headings and block keys). Details in `blueprint:docs-management` §4b.
3. **Planning never writes production code.**
   - Discussion steps produce decisions and vault files only: no source files, no scaffolding.
   - A **prototype** or **mockup** step may write throwaway code, but only in `prototypes/` or on a
     `proto/*` branch. At its end the user chooses: throw it away, or promote it (then it is
     rebuilt or cleaned up in a normal build step).
   - **Stop at the end of every step of the path** and ask: *"Build this now, or discuss the next
     one?"* Never start building on your own.
4. **Every request that changes how the code behaves goes through the entry step first** (below).
   Even a small one. Only after the entry step do you talk implementation.
5. **In a Blueprint project, Blueprint's workflow wins for planning.** A planning or
   brainstorming skill from another plugin (such as `superpowers:brainstorming`) never re-plans
   what Blueprint is discussing or has decided. Such skills are for implementation, inside a build
   step.
6. **The code lives in the same repository as the vault.** Never decide — not even in an area you
   own — to move the application code to a separate repository. Parallel sessions, worktrees and
   the merge gate only see the foundations when the vault sits next to the code. If the user wants
   two repositories, it is a one-way decision for the user to make.

## The entry step — "does it touch the foundations?"

Every new request starts here. It is not an automatic classifier: it is the first thing you say.

1. Read the relevant slice of the vault (`_architecture.md`, the touched area or section).
2. Say in plain words what you understood and answer one question: **does this touch the
   foundations** (a contract, the DB schema, auth, a cloud or CI/CD choice, a project rule)?
   - **No** → it is routine work inside one section. Propose a short plan or do it directly
     **if the user asked for the work to be done now**. Record any new detail decision.
   - **Yes, one point** → a short discussion of just that point (an *addition* or a *revision*,
     see `blueprint:topic-discussion`), then build.
   - **New project or several sections** → `blueprint:brainstorming` (empty repo) or
     `blueprint:feature-detection` (established project).
3. Propose the path for this request (mode B, below). The user confirms or changes it.

## The pipeline

1. `/blueprint` creates the vault. Empty repo → `blueprint:brainstorming`. Code exists →
   `blueprint:discovery`.
2. `blueprint:brainstorming` is a conversation with stop points. It ends with the **foundation
   areas**, the **sections**, the dependency **graph**, **who decides each area**, and a proposed
   **path** in `_queue.json`.
3. Each step of the path runs in order:
   - `discuss` → `blueprint:topic-discussion` (specialists first, one proposal, plain summary,
     lock);
   - `prototype` / `mockup` → throwaway work under Hard rule 3;
   - `build` → implementation, with the process plugin and the skills the step names.
4. After each step: stop, ask "build this now, or discuss the next one?", and when code changed
   ask **"did this work change the foundations?"** If yes, it goes back into the vault as an
   addition or a revision.

## Routing — what to invoke when

| Use | Name | Kind | When |
|---|---|---|---|
| **Bootstrap** | `/blueprint` | command | Starting a Blueprint project. Explicit only. |
| **Semantic review** | `/deep-review` | command | Opt-in, expensive semantic check. Explicit only. |
| **Understand existing code** | `blueprint:discovery` | skill | Turn existing code into draft areas, sections and decisions. |
| **Whole-project scoping** | `blueprint:brainstorming` | skill | No areas/sections exist yet. No specialists. |
| **New work on a running project** | `blueprint:feature-detection` | skill | The entry step said it touches the foundations or several sections. |
| **Discuss & lock** | `blueprint:topic-discussion` | skill | Every `discuss` step of the path. |
| **Vault schema** | `blueprint:docs-management` | skill | Before writing any vault file. You write vault files yourself. |
| **Project rules** | `blueprint:management-info` | skill | `management-info.md` or `_doc-rules.md` changed. |
| **Who decides** | `blueprint:user-agent` | skill | Assigning areas to the user or to Claude; switching later. |
| **Pre-commit check** | `blueprint:pre-publish-check` | skill | About to push. Checks the user's own diff against the locked decisions. |

The hooks check every vault write on their own and talk to you with lines starting `[Blueprint]`.
Explain any finding to the user in plain words (for example "this clashes with what we chose for
the DB area: …"), never as a raw finding, and let the user decide before anything changes.

## Core concepts

### 1. Foundations and sections

Two kinds of thing go into the vault. Use these two tests instead of a feature/sub-feature split.

- **Foundation area** — a choice shared by many parts of the project, expensive to get wrong.
  Test: *"Do several sections rely on this, and would changing it later force changes in
  them?"* Typical areas: DB, cloud, CI/CD, versioning, auth and security, contracts/API,
  external integrations, acceptance tests, deploy, project rules. The real list comes out of
  brainstorming, project by project; never one area per kind just to fill a template.
- **Section** — a piece of value for the end user (SIGNUP, LANDING-PAGE, ORDER-HISTORY). Test:
  *"Is this something the user gets, and can it be built and tested on its own against the
  contracts?"* A section uses the foundations without re-deciding them, and says what it adds
  to them (a table, an endpoint, a queue).
- **Contracts** (API, types, events between sections) are foundations kept one per file, so they
  can be read and protected on their own.
- There is no sub-feature level. A part that needs its own discussion is an area or a section;
  the rest is a detail inside one.

Each area and section declares what it depends on. The vault shows the graph in Mermaid
(`_architecture.md`). The graph gives the discussion order (foundations first), shows which
sections can be built in parallel, and tells who to warn when a foundation changes.

### 2. The path (`_queue.json`)

The path is the ordered list of steps (`discuss`, `prototype`, `mockup`, `build`). Exact schema in
`blueprint:docs-management`. Three modes, same format:
- **A** — fixed: discuss everything, then build;
- **B** — Claude proposes the steps, the user confirms (**default**);
- **C** — the user writes the steps.

Example (mode B): discuss CLOUD + DB → build the backend and test it with Postman → discuss the
design → mockup → build the frontend → publish.

### 3. Who decides each area

At the end of brainstorming the user says, area by area, who discusses it: **the user** or
**Claude** (the user agent). It is stored in `local-profile.md` and can change at any time
(`blueprint:user-agent`).
- In a user-owned area, the user confirms every decision.
- In a Claude-owned area, Claude decides the two-way decisions and records them; every one-way
  decision still comes back to the user. A hook enforces this.
- Decisions Claude takes on its own go in the area's `--details.md` file, below the foundations
  in the vault's hierarchy.

### 4. Ratification at contact

A draft found in existing code (`Decided by: discovery` / `inherited`) is not confirmed in bulk.
It becomes a real "confirm, correct, or decide fresh?" question only when the current discussion
touches it. The user's answer turns it into a normal decision.

### 5. Specialists and the discussion loop

Used by `blueprint:topic-discussion`, for every area, contract and section, in both modes.
1. **Pick 1–3 specialists** from the agent types actually available (the Agent tool's list).
   None fits → a `general-purpose` agent briefed as that specialist. Never the whole roster.
2. **Dispatch first**, before discussing with the user. Ask for options, trade-offs, a
   recommendation, and which choices are one-way (with the test in concept 7).
   - While they work, say one line that they are working, then **nothing** until the combined
     view is ready. When one report arrives and another is still running, do not post a message.
3. **Combine** their work into **one proposal** in plain words: the recommended choices, the
   one-way points highlighted with their alternatives, where the specialists disagree.
   - **Keep it short:** about 25 lines. The choices the user must make come first, each with its
     options and your recommendation. The details you settled go in one compact list (one line
     each). Long explanations only when the user asks.
4. **Relay back** every real question or objection to the same specialists (`SendMessage` if
   still addressable, otherwise re-dispatch with the previous context).
5. **Repeat until you and the user agree.** Then the plain summary, then lock.

### 6. When to ask a multiple-choice question

Use `AskUserQuestion` at these named forks (options in plain words, your recommendation first):
- **Brainstorming:** the kind of project (when it is still unclear after the first answers); the
  MVP split; **who decides each area** (one question with the areas as a multi-select of "I want
  to decide these"); the path proposal when there are real alternatives.
- **Topic-discussion:** every one-way decision where two or more options are still alive after
  the specialists' proposal; addition vs. revision when it is not obvious.
- **End of a step:** "build this now, or discuss the next one?"

Small or obvious choices stay in prose. **If `AskUserQuestion` is not available** (for example a
non-interactive session), ask the same question as plain text with the options numbered, and
stop there until the user answers.

### 7. One-way or two-way — the test

The label decides who confirms a decision, so don't be generous with "two-way". A decision is
**one-way** if any of these is yes:
- changing it later means **migrating stored data** (ids, date format, how deleted records are
  kept, the database engine once data exists);
- **people or systems outside the code** depend on it (links sent by email, a public API, a
  domain, accounts already created, a payment provider);
- changing it means **rebuilding more than one section**, or re-doing a contract;
- it moves **where the code or the data lives** (repository, provider, region with legal weight).

Otherwise it is two-way. **When in doubt, it is one-way.** "It stays two-way as long as we follow
rule X" means it is one-way unless rule X is itself locked as a decision.

For every **two-way** decision in a foundation area or a contract, say in one short line *why* it
is easy to change — in the proposal, in the summary, and in the block's `Why`. Example: "two-way:
no data depends on it, switching is a config change".

## Where to pick up

- `_current-task.md` is non-empty → you are resuming a discussion. Continue it.
- Otherwise, the first `pending` or `in-progress` step in `_queue.json` is next. Say which step it
  is and ask whether to start it.
- No pending step → the path is finished. Ask the user what they want to do next. Don't start
  coding on your own.
