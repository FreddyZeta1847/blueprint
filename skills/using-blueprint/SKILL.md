---
name: using-blueprint
description: Understand Blueprint's routing and core concepts (feature-definition test, Ratification-at-Contact, specialist-dispatch pattern) — injected at session start to orient on pipeline steps and shared decision frameworks
---

# Using Blueprint

This skill is injected at the start of every Blueprint-managed session by the `SessionStart` hook. It explains what Blueprint is, routes to the right skill/command for each pipeline step, and documents three shared core concepts used across multiple features.

## What is Blueprint?

Blueprint is a documentation-driven development methodology — design and code move together, decisions are locked as atoms before implementation, and the Obsidian vault is the single source of truth. Every change — whether a design choice, a new feature, or a code fix — is recorded and ratified, so the vault reflects the exact state of the project.

The pipeline has two phases:

1. **Orientation & Planning** — Understand the project, divide it into features, define features into sub-features, discuss each one, lock decisions as atoms, and write the vault.
2. **Implementation** — Build code against the locked vault, run deterministic checks before every commit, and sync code changes back into the vault.

## Routing — What to invoke when

| Use | Name | Kind | When |
|---|---|---|---|
| **Bootstrap** | `/blueprint` | command | Starting a new Blueprint-managed project — explicit only, never auto-triggers |
| **Semantic review** | `/deep-review` | command | Opt-in, expensive, agent-driven semantic check across atoms and prose — explicit only |
| **Understand existing code** | discovery | skill | Reverse-engineer existing code into draft features/atoms (`inferito` status) |
| **Whole-project scoping** | brainstorming | skill | No feature division exists — mandatory when starting or when a new addition touches the whole project |
| **Split & classify** | feature-detection | skill | Classify multi-item input: one firm needs-docs call + non-binding shape hint per item, queued for discussion |
| **Discuss & lock** | topic-discussion | skill | Converge a queued topic (feature/sub-feature/note/plan) into locked atoms or an ordered task list |
| **Manage vault** | docs-management | skill | Any vault file being written or updated (naming, frontmatter, templates, the vault-architect agent) |
| **Company rules** | management-info | skill | `management-info.md` changed — convert Rules/Preferences into locked atoms |
| **Manual vs. autonomous** | user-agent | skill | Choose manual or agent-assist mode for a topic; profile-based default applied |
| **Pre-commit check** | pre-publish-check | skill | About to push — offers to verify changed code against atoms |

**Note:** Review's three deterministic checks (vocabulary/conflict/value-inversion) run automatically as hook code the instant `atoms.json` changes. They have no invocation step — they fire by themselves.

## Three Core Concepts (Shared Across Multiple Skills)

### 1. The Feature-Definition Test

Used by: Discovery, Feature-Detection, Brainstorming, Topic-Discussion, User-Agent.

**What makes something a "feature"?** Core test — both must hold:

1. **Independent why** — purpose statable without referencing another feature's internals
2. **External dependents** — something else depends on its behavior/interface, not just consuming an output

**Delimiting signals** (OR'd, not AND'd — the more that coincide, the more obviously it's a feature):
- **Technology** — chosen tech stack differs from another part of the system
- **Contracts** — defines or enforces a contract others depend on (API, schema, permission model)
- **Functionality** — encapsulates a distinct user-facing or system behavior
- **Placement** — lives in a separate system or organizational boundary

**Recursive.** The same test applies at any granularity — not a special top-level-only rule. A sub-feature inside a feature is tested the same way. Size is explicitly not the test.

**How to decide if something needs a sub-feature split:** Apply the feature-definition test at the sub-level. Most features stay single-file. Split only when the test actually justifies it — don't manufacture a sub-feature to fit a template.

### 2. Ratification at Contact

Used by: Feature-Detection, Topic-Discussion, vault-architect, Review.

An inherited or drafted item tagged `needs-review` (e.g., inferred from code, proposed during discovery, or unconfirmed in a first draft) is not something to fix in bulk, and not something re-litigated on every touch either.

**The pattern:**
- A touch (a reference to the item during discussion, an update to a file containing it, a new atom depending on it) is only a real "confirm, correct, or decide fresh?" conversation IF the coherence check actually finds a conflict with existing locked atoms.
- Never as a default ritual run on every contact.
- When a conflict is found, the open question goes on the table and the answer removes the `needs-review` tag.

This is the same pattern used elsewhere in Review's design (the conflict check, the sync-check, the orphan-check): no false positives, no redundant work.

### 3. Specialist-Dispatch Pattern

Used by: Brainstorming (whole-project divergence), Topic-Discussion (sub-feature divergence), User-Agent (agent-assist mode).

**When a decision is actually being weighed**, dispatch relevant persistent specialist agents (global or project-local) to propose alternatives and inform the user.

**How it works:**

1. **Identify relevant specialists** — which agents in the repo's `~/.claude/agents/` or `.claude/agents/` address this specific question?
   - Example: for frontend + caching, dispatch `frontend-architect` + `cache-expert` + `data-analyst` (relevant trio), NOT 10 agents in parallel
   - If no existing specialist fits, create one just-in-time (standard agent frontmatter + focused prompt)

2. **Call agents for proposals** — prompt: "We're discussing [specific sub-feature/axis]. Here's our state. What options and trade-offs do you see?"
   - Agents respond with alternatives + pros/cons each
   - Agents flag where they agree/disagree, uncertainties

3. **Present unified list to the user** — Claude synthesizes:
   - All options with pros/cons
   - Where agents align/conflict
   - Uncertainties flagged

4. **User picks an option** — "I'm choosing B"

5. **Validate with agents** — call relevant agents again: "User chose B — what problems foresee? Any conflicts with other decisions?"
   - Agents flag concerns/issues
   - Claude explains to user

6. **Lock** — record choice with rationale including agent feedback

**Key insight:** Agents are called *multiple times* (propose → user picks → validate). Divergence/convergence is automatic, not a hard gate — just the natural rhythm of discussion.

**Why specialists matter:** A decision made autonomously (in agent-assist mode) gets the same specialized input a manual discussion would, not a lower-quality substitute. Used everywhere a decision is weighed so quality stays consistent.

---

## Next Steps

- **If `_current-task.md` is non-empty:** You're resuming a feature from last session. Continue locking its remaining sub-features.
- **If `_current-task.md` is empty and `_queue.json` has entries:** Pick the next queued topic and start discussing it.
- **If both are empty:** The vault is fully caught up. You can either start a new feature (create a new `_queue.json` entry and discuss it), run Discovery to reverse-engineer existing code, or take a moment to verify everything is in order.

Read the routing table above to find the right skill for your next step.
