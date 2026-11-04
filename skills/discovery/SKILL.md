---
name: discovery
description: Bootstrap a Blueprint vault from an existing codebase — records the git baseline, drafts foundation areas, contracts and sections, writes decisions found in the code as unconfirmed, and documents every external system.
---

# Discovery

<!--
Header comment: Blueprint v2's code-to-vault bootstrap. Runs once, when /blueprint finds existing
code. Produces drafts tagged needs-review whose decisions carry `Decided by: discovery` or
`Decided by: inherited`, so the hooks derive real atoms from them (correction C-04), records the
git baseline (C-02) and one file per external system (C-05). The schema it writes is defined in
blueprint:docs-management.
-->

Use this skill when `/blueprint` finds existing code. It turns what the code already decided into
a draft vault. Nothing it writes counts as decided: every decision waits for **Ratification at
contact** (see `blueprint:using-blueprint`).

Load `blueprint:docs-management` first: it defines the folders, the decision-block format and the
templates used below. You are the only writer; write every file yourself with `Write`/`Edit`.

## 1. Record the git baseline

So Blueprint can tell inherited code from the user's own work:

1. Find the default branch (`main`, else `master`, else the remote's HEAD) and its commit
   (`git rev-parse <branch>`).
2. Write it in `_architecture.md` under `## Baseline`: "`main` at `<sha>` on `<date>`".
3. The user's own work is `git log <branch>..HEAD` plus uncommitted changes. Describe it apart
   ("work in progress on your branch: …"), never as an inherited decision.

If the folder is not a git repo, skip this step and say so in one line.

## 2. Ask once about external systems

Ask the user one question, in plain words: *"Which external systems does this project rely on
(payment providers, company services, third-party APIs)?"* Combine the answer with what you find in
the code, the README and any docs folder.

## 3. Read the code and the docs

- Read the README, any `docs/` folder and the key configuration files (package manifests, CI
  workflows, infrastructure files, Docker files). Facts written there belong in the vault too.
- For a large codebase, fan out read-only exploration agents (one per module or major boundary)
  to locate the pieces. They are search helpers, not specialists: specialists only join area and
  section discussions.

## 4. Propose the split

From what you found, propose:
- **foundation areas** — the shared choices the code already fixed (DB, cloud, CI/CD, auth,
  versioning, …), using the area test in `blueprint:using-blueprint`;
- **contracts** — APIs, shared types, events between parts;
- **sections** — the pieces of user value (signup, checkout, admin, …);
- **the dependency graph** between them.

Give each area a proposed **importance** (1–5, marked as a guess from the code). Show the list to
the user in plain words and ask, for each area, **who decides it from now on**: the user, or Claude
for the easy-to-change details. Write the answers to `local-profile.md`. Use `AskUserQuestion` for
this question when it is available.

## 5. Write the drafts

For each area, contract and section, write its main file (docs-management templates), tagged
`needs-review` on top of its type tag. Write every decision the code already made as a block:

| What you found | Decided by |
|---|---|
| A choice with a visible reason (constants, defaults, a comment explaining it) | `discovery` |
| A choice stated or used with no discoverable reason ("uses Redis", no why) | `inherited` |
| A rule in `management-info.md` | `rule` (see `blueprint:management-info`) |

- Register each new question id in `Vocabulary/registry.json` before writing its block.
- Inherited choices are **constraints**, not discussion topics: record them, don't reopen them.
  They are confirmed only when later work touches them and conflicts with something.
- A one-way block needs `Rejected`. When the code shows no alternative, write what the choice
  excludes ("any non-relational store — excluded by the existing schema").

Then write:
- **one file per external system** in `foundations/INTEGRATIONS/` (template in docs-management):
  what it is and who uses it; where its code and docs live (repos, paths, classes); the calls used,
  with parameters and data shapes as found; **known unknowns, written explicitly** ("refund error
  codes: we don't have them"); existing examples to copy; open questions for its owner;
- `_architecture.md` (overview, components, graph, areas, contracts, baseline) tagged
  `[index, needs-review]`;
- `_sections.md`, `_index.md`;
- `_queue.json` only with the steps the user wants next (mode B: propose, the user confirms).

Read the `[Blueprint]` hook messages after the writes and explain any finding to the user in plain
words.

## 6. Hand off

Discovery stops at drafting. Confirmation happens later, inside real work, through Ratification at
contact.

## What NOT to do

- Don't write `Decided by: user` for anything you found in the code. The user hasn't confirmed it.
- Don't run semantic review; the deterministic checks fire on their own.
- Don't dispatch specialists here.
- Don't describe the user's branch work as inherited decisions.
- Don't skip external systems because the code doesn't show their details: the unknowns are the
  point.

## Verification

- `_architecture.md` holds the baseline (or the note that there is no git repo).
- Every drafted file carries `needs-review`.
- Every decision block uses `discovery`, `inherited` or `rule`.
- Every external system has its own file with an explicit "Known unknowns" section.
- `local-profile.md` says who decides each area.
