---
name: discovery
description: "Read existing code Claude doesn't know yet and turn it into Blueprint material — records the git baseline, prefills the context answers the code already gives, and (when a decisions folder is wanted) drafts foundation areas, contracts, sections and the decisions found in the code as unconfirmed, with one file per external system. Run on request (/blueprint:discovery) or when get-context proposes it and the user agrees."
---

# Discovery

<!--
Header comment: Blueprint v3's code-to-context bootstrap. Runs on existing code Claude doesn't
know, only with the user's OK. It prefills the answers of the context questions that the code
already gives (for blueprint:get-context) and, when the project keeps a decisions folder, drafts it in
blueprint/decisions/ with decisions tagged needs-review and carrying `Decided by: discovery` or
`Decided by: inherited`, the git baseline, and one file per external system. The schema it writes
is defined in blueprint:docs-management.
-->

Use this skill on a repo with code that Claude doesn't know yet: when the user asks for it, or when
`blueprint:get-context` proposes it and the user agrees. It turns what the code already decided
into context answers and, if wanted, a draft decisions folder. Nothing it writes counts as decided: every
decision waits for **Ratification at contact** (see `blueprint:using-blueprint`).

Load `blueprint:docs-management` first: it defines the folders, the block format and the templates
used below. You are the only writer; write every file yourself with `Write`/`Edit`.

## 1. Record the git baseline

So Blueprint can tell inherited code from the user's own work:

1. Find the default branch (`main`, else `master`, else the remote's HEAD) and its commit
   (`git rev-parse <branch>`).
2. Keep it for the decisions folder's `_architecture.md` (`## Baseline`: "`main` at `<sha>` on `<date>`") and
   for the `existing` answer of the card.
3. The user's own work is `git log <branch>..HEAD` plus uncommitted changes. Describe it apart
   ("work in progress on your branch: …"), never as an inherited decision.

If the folder is not a git repo, skip this step and say so in one line.

## 2. Ask once about external systems

Ask the user one question, in plain words: *"Which external systems does this project rely on
(payment providers, company services, third-party APIs)?"* Combine the answer with what you find in
the code, the README and any docs folder.

## 3. Read the code and the docs

- **Map the code first.** If the user has a code-mapping tool (a knowledge graph of the codebase,
  a code index — their `CLAUDE.md` or tool list says which), use it before reading files one by
  one: build the map if the project has none, update it if it is old, then ask it the questions
  below (the parts, how they talk, the entry points, the external systems). Read individual files
  only where the map is not enough. Without such a tool, read as described next.
- Read the README, any `docs/` folder and the key configuration files (package manifests, CI
  workflows, infrastructure files, Docker files). Facts written there are part of the result.
- For a large codebase, fan out read-only exploration agents (one per module or major boundary)
  to locate the pieces. They are search helpers, not specialists: specialists only join
  discussions.

## 4. Prefill the context answers

Hand `blueprint:get-context` every answer the code already gives, marked as deduced, with where you
found it. Typically:
- **`existing`** — the stack, what is built, the baseline, inherited constraints;
- **`constraints`** — mandatory technologies, rules written in the repo (a CONTRIBUTING file, CI
  checks, licence);
- **`parts`** — the parts the code is made of (frontend, backend, mobile app…) and how they talk;
- **`kind`**, **`approver`** — only when the repo makes them evident (a client's name, a review
  rule).

Never invent the answers about intent (`goal`, `risk`, `timing`, `roles`): those are the user's.
get-context shows the deductions to the user and asks the rest.

## 5. Propose the split

From what you found, propose in plain words:
- **foundation areas** — the shared choices the code already fixed (DB, cloud, CI/CD, auth, …),
  using the area test in `blueprint:using-blueprint`;
- **contracts** — APIs, shared types, events between parts;
- **sections** — the pieces of user value (signup, checkout, admin, …);
- **the dependency graph** between them.

Who decides each area from now on is not asked here: it is the `roles` question of get-context,
which uses this list.

## 6. Write the drafts — only if the project keeps a decisions folder

If the user wants a decisions folder (the card's `documentation` answer, or the user says so now), create
`blueprint/decisions/` with the scaffold in `blueprint:docs-management` §3, then write for each area,
contract and section its main file, tagged `needs-review` on top of its type tag. Write every
decision the code already made as a block:

| What you found | Decided by |
|---|---|
| A choice with a visible reason (constants, defaults, a comment explaining it) | `discovery` |
| A choice stated or used with no discoverable reason ("uses Redis", no why) | `inherited` |
| A binding rule written in the repo, confirmed by the user as a rule | `rule` |

- Register each new question id in `Vocabulary/registry.json` before writing its block.
- Leave `Stage` out: these decisions come from the code, not from a plan stage.
- Inherited choices are **constraints**, not discussion topics: record them, don't reopen them.
  They are confirmed only when later work touches them and conflicts with something.
- A one-way block needs `Rejected`. When the code shows no alternative, write what the choice
  excludes ("any non-relational store — excluded by the existing schema").

Then write:
- **one file per external system** in `foundations/INTEGRATIONS/` (template in docs-management):
  what it is and who uses it; where its code and docs live; the calls used, with parameters and
  data shapes as found; **known unknowns, written explicitly** ("refund error codes: we don't have
  them"); examples to copy; open questions for its owner;
- `_architecture.md` (overview, components, graph, areas, contracts, baseline) tagged
  `[index, needs-review]`;
- `_sections.md`, `_index.md`.

Read the `[Blueprint]` hook messages after the writes and explain any finding in plain words.

Without a decisions folder, keep the result in the card: the prefilled answers, and the inherited one-way
choices listed in the `existing` answer.

## 7. Hand off

Discovery stops at drafting and goes back to `blueprint:get-context`, which shows the prefilled
answers and asks the rest. Write the points the code answered into the draft card
(`blueprint/context.md`) and **end the Discovery report with one line** that says where you go
next, for example: *"Back to the context: still open — timing, who decides hosting."* Then
continue with get-context in the same turn. Confirmation of the drafted decisions happens later, inside real work,
through Ratification at contact.

## What NOT to do

- Don't run without the user's OK
- Don't write `Decided by: user` for anything you found in the code. The user hasn't confirmed it
- Don't answer the questions about intent (goal, risk, timing, who decides)
- Don't write a plan: planning starts only after the card is confirmed
- Don't run semantic review; the deterministic checks fire on their own
- Don't dispatch specialists here
- Don't describe the user's branch work as inherited decisions
- Don't skip external systems because the code doesn't show their details: the unknowns are the
  point

## Verification

- The baseline is recorded (or the note that there is no git repo).
- get-context received the prefilled answers, each with its source.
- With a decisions folder: every drafted file carries `needs-review`; every block uses `discovery`,
  `inherited` or `rule`; every external system has its own file with an explicit "Known unknowns"
  section.
