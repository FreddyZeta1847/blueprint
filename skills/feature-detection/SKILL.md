---
name: feature-detection
description: Classify raw user input into documented work — firm needs-docs call plus provisional shape/target hints, one organized list for user review
---

# Feature-Detection

Use this skill when the user describes work to be done on an established Blueprint project. Feature-Detection splits multi-item input, makes one firm call per item (needs documentation?), offers soft hints about shape and target, and queues everything in one organized list for the user to review.

## When to invoke

- On an **established project with a vault** (Brainstorming has already run, or Discovery has bootstrapped from code)
- The **user states what needs to be done** (ongoing work, not a whole-project scope)
- Automatically, OR explicitly by mentioning "feature-detection" if you want to trigger it mid-conversation

## Your approach

### 1. Split input if needed

Does the user's input actually describe more than one independent item?

- "Add a cache layer and fix the API response schema" → two items
- "Improve the frontend by optimizing images and adding a dark mode" → two items
- "Add multi-factor authentication" → one item

Apply the feature-definition test from `skills/using-blueprint/SKILL.md`: independent why + external dependents? Use technology, contracts, functionality, placement as signals.

### 2. For each item: Make the firm call

**Question:** Does this need documentation (discussion + locked atoms + vault entries)?

**Ground it in:**
- The item's existing atoms and prose (if it touches an existing feature)
- The codebase itself (patterns, established conventions)
- Any locked management-info Rule (Rules can force "needs documentation" outright)
- Your judgment when genuinely unsure (default to "needs documentation")

**Answer:** Yes or No. That's it. No hedging here.

**What counts as "routine execution"?** Adding a page to frontend, following frontend's established pattern for pages, with nothing new to decide → no queue entry, no discussion. Just normal coding.

**What counts as "needs documentation"?** Anything that brings a real choice, an unestablished pattern, or a decision not yet locked in atoms → queue it, discuss it, lock atoms.

### 3. For documented items: Offer soft hints

If the item needs documentation, offer two **provisional** hints (not decisions — just your best guess based on context):

#### Hint 1: Shape
- **"feature"** — looks like a whole new feature (independent why, external dependents, strong signals)
- **"topic"** — needs documentation but not a feature (smaller scope, might be a note on an existing feature, or a sub-feature spin-off). Never shown to the user as jargon; phrase it naturally: "needs documentation, but probably not a whole new feature."

**Why different bars?** A `topic` is cheap to get wrong — it runs through the same discussion mechanism regardless. A `feature` costs more to undo (different starting structure in Topic-Discussion). So "feature" only gets offered when grounding is actually strong.

#### Hint 2: Target (for topics only)
- Which existing feature does this probably relate to?
- Ground it: existing atoms, codebase, established patterns
- Leave blank if nothing obviously anchors
- Explicitly provisional — Topic-Discussion might find a better one

**Natural-language color is OK:** "probably just a paragraph on X," "might want its own file" — this is prose, not a tracked value, and never becomes a decision without real discussion.

### 4. Propose processing order

Once all items are classified, propose an order for discussion:
- Dependencies first (things other items need)
- Simplest-first (foundations before dependents)
- As-raised (the order the user mentioned them)
- Grouped by type (routine first, features, then topics)

Explain your reasoning briefly for the order.

### 5. Show one organized list

**Never a loop of small interruptions. Never two passes.**

Present everything together in one organized list, grouped by outcome:

```
## Routine Execution (no queue entry)
- Item X (with brief reasoning)

## New Features (queued)
- Item Y (with reasoning and processing order rationale)

## Needs Documentation (shape undecided, queued)
- Item Z — probably just an update to Feature-Name (reasoning)
- Item W — needs documentation, might be its own thing (reasoning)

Proposed processing order: Item Y (needs Z's foundation), then Item Z, then Item W.
```

The user reviews this *one* clear picture and corrects it in a *single* pass.

### 6. Queue everything

Write confirmed items to `_queue.json` with:
- `id` — unique identifier
- `description` — what needs to be done
- `shape_hint` — `feature` or `topic`
- `target` — likely related feature (for topics; blank if unclear)
- `status` — `pending`

**All hints are provisional.** Topic-Discussion will confirm or revise them during real discussion (Recheck step).

## What NOT to do

- Don't write vault files — vault-architect owns that
- Don't guess sub-feature vs. note distinction — collapse that to one "topic" bucket; Topic-Discussion decides shape at Recheck
- Don't silently skip decisions — if a management-info Rule applies, state it plainly
- Don't ask the user to classify (don't quiz them on Blueprint terminology) — you classify, they correct
- Don't interrupt with small per-item questions — show one organized list, get one pass of corrections
- Don't use the word "topic" with the user — that's internal jargon; say "needs documentation, but probably not a feature"

## Key constraints

- **One firm call: needs documentation?** Ground it in atoms, codebase, management-info Rules; default to "yes" when unsure
- **Two soft hints:** shape (`feature`/`topic`) and target feature (for topics only)
- **One organized list, one pass of user review** — routine items, feature items, topic items, grouped by outcome
- **All provisional** — Topic-Discussion will confirm, correct, or revise during real discussion

## Anti-sycophancy rule

If the user downgrades something you still think matters (wants to skip documentation when you see it's really needed), push back once: name what's being traded away, explain why documentation matters here, then respect their call. No re-asking on the same item.

## After Feature-Detection

Items are queued in `_queue.json`. Next: invoke `topic-discussion` to start processing them one at a time.

---

## Technical notes

**Shape hints were simplified:** Originally three-way (feature/sub-feature/note), collapsed to two (`feature`/`topic`) because sub-feature and note always get treated identically in Topic-Discussion (same mechanism, different output based on Recheck). One distinction: feature gets a higher confidence bar.

**Ratification-at-Contact moved:** No longer triggered here by finding a `needs-review` draft. Now happens naturally inside Topic-Discussion's diverge phase — the exact moment real discussion makes genuine contact with a relevant draft, which is strictly better timing than a shallow upfront check before any conversation started.

**Handoff always through the queue:** Confirmed items go to `_queue.json`, never a direct shortcut to Topic-Discussion. Same mechanism, same consistency, whether the queue has one item or ten.
