---
name: discovery
description: Reverse-engineer an existing codebase into draft Blueprint features, atoms (inferito/ereditato-ignoto), and architecture — one-time bootstrap from code to vault
---

# Discovery

Use this skill when `/blueprint` finds existing code and you need to reverse-engineer it into draft vault features. Discovery produces draft `FEATURE-NAME.md` files, populates `_architecture.md` with unconfirmed candidates, and proposes atom candidates — all tagged `needs-review` and ready for Ratification-at-Contact.

## How to use

Invoke this skill when:
- `/blueprint` detected existing code in the repo
- You need to bootstrap the vault from the codebase, not from scratch

The skill will fan out exploration agents (one per module/major boundary), identify features using the shared feature-definition test, draft files with the vault-architect, and leave everything tagged `needs-review` for later ratification.

## Your approach

1. **Understand the codebase structure** — read key files, understand module boundaries, architecture, and major dependencies. Use the feature-definition test (independent why + external dependents) to propose feature candidates.

2. **Fan out exploration agents** — one agent per module/boundary, each reading their specific area and proposing feature candidates with brief rationale. Agents should flag technology choices, contracts, functional boundaries, and placement that indicate a feature split.

3. **Synthesize feature list** — from agent proposals, build a consolidated list of identified features. Cross-check against the feature-definition test: does each have an independent why? Do other features depend on its behavior/interface?
   - Give each feature a proposed **importance** and **effort** (1–5, see `blueprint:brainstorming`, step 3), marked as a guess from the code. Show them to the user with the list, and ask the same focus question ("which of these do you care about most?"). The answers go to `_features.md`, `_queue.json` and `local-profile.md` like in brainstorming.

4. **For each feature: draft the vault files**
   - Read the feature-definition test from `skills/using-blueprint/SKILL.md` to remind yourself of the criteria
   - Use the `vault-architect` agent to write each draft `features/FEATURE-NAME/FEATURE-NAME.md` file with:
     - **What it does** — one-line role
     - **Rationale** — why it's a feature (independent why + dependents)
     - **Technology/Contracts/Responsibilities** — what this feature owns
     - **Frontmatter:** `tags: [feature, needs-review]`
   - Sub-features: apply the feature-definition test recursively. Most features stay single-file; only split if the test justifies it.

5. **Draft `_architecture.md`** — use the vault-architect to populate/draft it with:
   - **Overview** — high-level system diagram (Mermaid)
   - **Features & connections** — list of identified features and how they depend on each other
   - **End-to-end workflow** — a request or operation flowing through the system
   - **Unconfirmed candidates** — atom suggestions (status: `inferito` for inferred, `ereditato-ignoto` for inherited from docs/comments), NOT locked atoms, marked `needs-review`
   - **Frontmatter:** `tags: [index, needs-review]`

6. **Atom candidates** — propose axis/choice pairs *inside* the drafted files (not as separate atoms.json yet). For example:
   - **Inferred (`inferito`)** — "from the code, timeout is 30s" (derived from constants, defaults, observed behavior)
   - **Inherited (`ereditato-ignoto`)** — "from a README: uses Redis for caching" (stated in existing docs/comments, adopted as-is)
   - All tagged `needs-review` — they wait for Ratification-at-Contact, not confirmed as locked.

7. **Hand off** — Discovery produces drafts; the user (via Topic-Discussion + Ratification-at-Contact later) confirms or corrects them. Your job stops at drafting, not at approval.

## What NOT to do

- Don't write confirmed, locked atoms — only draft candidates with `inferito`/`ereditato-ignoto` status
- Don't run semantic review — deterministic checks fire automatically as a side effect of the vault-architect's writes; you don't need to trigger them separately
- Don't embed Discovery logic into Setup — Setup only creates structure and branches; Discovery is its own step
- Don't try to guess sub-features prematurely — apply the feature-definition test, don't manufacture splits

## Key constraints

- **Feature-definition test** — read `skills/using-blueprint/SKILL.md` first to remind yourself; the same test Discovery, Brainstorming, and Feature-Detection all use
- **vault-architect is the sole writer** — use that agent to write every vault file; never write directly
- **`needs-review` tag is mandatory** — every file Discovery produces must carry it
- **No new atom statuses** — only `inferito` (inferred) and `ereditato-ignoto` (inherited); locked atoms come later
- **No semantic review** — deterministic checks run automatically; deep-review is opt-in for the user

## Verification

- Every drafted `FEATURE-NAME.md` exists and is tagged `[feature, needs-review]`
- `_architecture.md` is drafted, tagged `[index, needs-review]`, and includes unconfirmed atom candidates
- All atom candidates have status `inferito` or `ereditato-ignoto`, never `locked`
- Sub-features were only split when the feature-definition test justified it
- Cross-check: do identified features actually have independent whys and external dependents?

---

## Technical notes

**Implementation shape:** Exploration agents fan out (one per module/boundary) to identify candidates; vault-architect writes files. Exact fan-out granularity for very large codebases is parked as an implementation detail.

**Deterministic checks are side effects:** The merged `PostToolUse` hook fires the instant any `atoms.json` changes, regardless of source. Discovery's drafted atoms trigger the same hook as locked atoms — there is no "Discovery writes differently" code path. Ratification-at-Contact is the real checkpoint, not a separate review gate.
