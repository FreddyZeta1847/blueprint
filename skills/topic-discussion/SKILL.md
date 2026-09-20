---
name: topic-discussion
description: "Converge an open discussion into a locked decision — the core engine for features, sub-features, notes, and plans"
---

# Topic-Discussion

This is the core discussion engine. Use it when processing any queued topic (feature, sub-feature, note, or plan) — the one shared mechanism that converges open discussions into locked decisions or ordered task lists.

Topic-Discussion is invoked automatically by the queue-processing loop, but you should understand its full mechanics to run effective discussions.

## Four terminal shapes, one engine

Topic-Discussion handles four distinct output shapes. All share the same diverge-then-converge cycle; only the output and termination criterion differ:

### Feature
A new top-level feature. **Two-stage process:**
1. **Intro stage:** Short feature-scoped introduction (like a mini-Brainstorming for just this feature)
   - Understand the feature's role and scope
   - Decide whether it needs sub-features (apply feature-definition test)
   - If yes: identify sub-features, write the lean `FEATURE-NAME.md`, queue each sub-feature
   - If no: write the single-file `FEATURE-NAME.md`, proceed to converge
2. **Sub-feature stage:** Process each queued sub-feature through diverge-then-converge below, one at a time

### Sub-feature
Part of an existing feature. **Single cycle:**
- Diverge: weigh alternatives for this sub-feature's axes using specialist-dispatch
- Converge: pick one per axis, record why others lost
- Lock: write the sub-feature file AND its atoms into the parent feature's `atoms.json`
- PostToolUse hook fires immediately (deterministic checks before next queued item starts)

### Note
A smaller decision, not worthy of its own file. **Single cycle, identical to sub-feature:**
- Diverge: weigh alternatives for this decision
- Converge: pick one, record rationale
- Lock: atoms written to an existing sub-feature's `atoms.json`
- Prose appended as a paragraph (not a new file)

**Decision rule:** Applied during discussion itself. Is this a question that deserves its own documentation file, or does it fit as a paragraph in an existing one? Recheck decides (see below).

### Plan (Plan-Discussion)
An ordered, verifiable task list for an already-decided feature. **Same cycle, different output:**
- Diverge: weigh alternatives for task ordering and implementation approach
- Converge: lock an ordered task list with verifiable exit criteria
- Output: `PHASE-N-NAME.json` with task entries (not atoms)
- Termination: every task has a machine-verifiable exit criterion

## Entry: Mode question, then start

When a fresh top-level topic enters (a feature, or a topic with no existing `target`):

1. **Ask the mode question** (User-Agent feature owns this): Manual or agent-assist?
   - Manual: you decide convergence points
   - Agent-assist: USER-AGENT's learned Profile decides (with PreToolUse hook blocking one-way + agent-approved combos)
   
2. **Start immediately** — don't re-confirm the shape hint (Feature-Detection already settled it via batch review). Proceed according to the hint, or ask only if genuinely ambiguous.

3. **For a feature:** Enter intro stage
   **For a sub-feature/note:** Enter diverge (skip intro)

## The diverge-then-converge cycle (the core)

### Phase 1: Diverge
Enumerate real alternatives per axis using specialist-dispatch (not generic agents).

**For each axis this topic needs to weigh:**

1. Identify relevant specialist agents — agents in `~/.claude/agents/` or `.claude/agents/` that address this specific axis/domain
   - Example: "auth method" → dispatch backend-security-expert, compliance-officer
   - Create just-in-time if no existing specialist fits
   
2. **Call agents with context:** "We're discussing [sub-feature]. For the axis '[full question]', what options and trade-offs do you see?"
   - Agents respond with alternatives + pros/cons each
   - Agents flag where they agree/disagree, uncertainties
   
3. **Present unified list to user:**
   - All options with pros/cons
   - Where agents align/conflict
   - Uncertainties flagged
   - Specialist-dispatch called ONCE per axis (propose alternatives)

4. **User investigates naturally** — no hard gate, just the rhythm of discussion:
   - Asks questions
   - Explores trade-offs
   - Gradually gravitates toward a choice

**Diverge's scope is broad:** Headline choice (framework? database?) AND operational axes (failure recovery, caching, concurrency, security, state management). These aren't separate concerns; they're all axes the same specialist weighs.

**Cheap, targeted lookups during diverge are normal reasoning** — if the discussion implies a gap worth checking ("add a statistics page" when nothing currently produces stats), check it via a targeted grep/read, not a full project scan. Token-safe, not a dedicated scanning system.

**Ratification-at-Contact fires here, if touched:** If diverge's own grounding makes genuine contact with a relevant `needs-review` draft (e.g., Discovery inferred a caching strategy that this discussion is now deciding whether to adopt), surface the draft, get confirm/correct/decide-fresh, remove the `needs-review` tag. This happens naturally inside discussion, not as a pre-discussion scan.

### Gate: Diverge must produce alternatives before converge starts
This is a structural gate, not a tone instruction. The model cannot jump to conclusion-picking without first exhausting alternatives. Phase 1's only job is alternatives; phase 2 cannot begin until phase 1 has actually produced them.

### Phase 2: Converge & Recheck
Evaluate alternatives, make the call, record why others lost.

**For each axis:**
1. Weigh the alternatives (specialist feedback already captured)
2. User picks an option (or agents pick in agent-assist mode)
3. **Call agents again for validation:** "User chose [option] — what problems foresee? Any conflicts with other locked atoms?"
   - Agents flag concerns/issues
   - Claude explains to user
4. **Record the atom:** axis, choice, rejected (with reasons), rationale (including agent feedback), reversibility, depends_on

**Real forks deserve `AskUserQuestion`**, not every decision. A real fork is:
- A converge-time choice with genuine alternatives ("which DB?")
- A drafting moment where Claude has a recommendation but user might want something else
- A spot mid-discussion where multiple valid interpretations exist

**Anti-sycophancy rule:** If you see a real problem with the user's chosen direction, push back **once**: name what's being traded away, explain why it matters, then defer to their call. No endless re-litigating — that blocks convergence.

**Recheck (the decision point for shape & target):**
Immediately after converge, before writing anything:
- **Shape:** Is this worthy of its own file (sub-feature), or a paragraph on an existing one (note)?
- **Target:** Which feature/file does this belong to? (Feature-Detection's guess is a starting point; discussion might have revealed a better one)

A topic that never anchors to any existing feature (not by FD's guess, not by discussion) is the signal to spin it off as its own feature instead.

State the decision plainly: "Attach this to AUTH as a paragraph" or "New sub-feature file under BACKEND-API" or "This is actually a whole new feature — let's create it."

## Writing (after Recheck)

Once Recheck decides shape and target:

1. **Use vault-architect** to write:
   - Feature: `FEATURE-NAME.md` + update `atoms.json` + update `_index.md`
   - Sub-feature: `FEATURE-NAME--subfeature.md` + update parent's `atoms.json`
   - Note: append to existing sub-feature's file + update parent's `atoms.json`
   - Plan: `PHASE-N-NAME.json`

2. **Update `_current-task.md`:** Log this topic's lock (entry updated or added)
3. **Update `_queue.json`:** Check off this item (remove it)
4. Both happen in the vault-architect pass — write and cleanup are atomic

**PostToolUse hook fires immediately:** deterministic checks run before the next queued item starts.

## Termination criteria

**For feature/sub-feature/note:**
- Every touched axis has a decision recorded (axis, choice, rejected, rationale)
- Every `reversibility: one-way` axis has a non-empty `rejected` (proof the alternative was weighed, not defaulted)
- Recheck decision made (shape, target)
- vault-architect has written the files and cleared `_current-task.md`

**For plan:**
- Every task has a machine-verifiable exit criterion
- Task order is locked
- vault-architect has written `PHASE-N-NAME.json`

## Key constraints

- **Specialist-dispatch for diverge:** Not generic subagents, only specialists relevant to THIS axis
- **Diverge is structural:** A passage gate, not a tone instruction; alternatives must be produced before converge starts
- **One validation call per axis:** Agents called twice (propose alternatives, then validate user's choice), not per-option
- **Ratification-at-Contact fires inside diverge:** Only if discussion makes genuine contact with a needs-review draft
- **Live logging to `_current-task.md`:** Decisions written as they happen (diverge → converge → lock), visible if session resumes
- **Anti-sycophancy is bounded:** One pushback, then defer. No endless re-litigating.
- **vault-architect is the sole writer:** Never write vault files directly

## What NOT to do

- Don't skip diverge to jump straight to converge
- Don't pre-decide Recheck's shape/target (let discussion reveal it)
- Don't call agents for every option-level question (specialist per-axis is enough)
- Don't assume a fixed topic starting shape (Feature-Detection guesses, Recheck decides)
- Don't run Ratification-at-Contact as a pre-discussion scan (only if discussion makes genuine contact)
- Don't use `AskUserQuestion` for every decision (only real forks, judgment-based)
- Don't silence the anti-sycophancy rule (push back once when you see a problem)

## Technical notes

**The Blueprint/Super Powers boundary:** Blueprint decides WHAT and WHY (converges on decisions). Super Powers decides HOW and IN WHAT ORDER (converges on tasks). If Super Powers finds itself making an irreversible architectural choice, that's a signal the decision escaped Blueprint's layer and must come back here.

**Feature-to-sub-feature queue insertion:** When a feature's intro stage queues its sub-features, they're inserted into `_queue.json` right after the parent — not a fresh re-proposal of the whole queue order. Same mechanism as any other queued item; same processing.

**Mode is asked once per fresh top-level topic:** Sub-features inherit the top-level topic's mode (manual/agent-assist). Only fresh entries (no existing target) get the question.
