---
description: Opt-in, expensive semantic review across a feature's atoms and prose — catches paraphrase-level contradictions the free deterministic checks cannot see
---

# /deep-review

Run an expensive, semantic review across a feature's atoms and prose for real certainty before major milestones.

## What it does

Dispatches fresh-context subagents to read both atoms (decision records) and full prose documentation together, checking for paraphrase-level contradictions, unsupported claims, and semantic inconsistencies across a feature and its related features.

## How to use

From a Blueprint-managed repo:
```
/deep-review [feature-name]
```

- **With feature name:** Reviews that one feature and related cross-references
- **Without feature name:** Reviews all features (expensive — use before big milestones)

## What it checks

- **Paraphrase-level contradictions:** atoms say X, but prose says Y (or implies something different)
- **Unsupported claims:** prose makes claims not backed by atoms
- **Cross-feature contradictions:** Feature A assumes X about Feature B, but Feature B's atoms say different
- **Incomplete rationale:** atoms recorded but no prose explaining why

## When to use

- Before a major release or milestone
- Before shipping a feature that touches many other features
- When semantic certainty matters more than token cost
- Not on every change (use automatic deterministic checks for that)

## Contrast with automatic checks

- **Deterministic checks** (automatic, always-on): catch structural issues only — conflicting axes, unknown vocabulary, value-inversion contradictions. Real code, no cost, always running.
- **deep-review** (explicit, on-demand): catch semantic issues — paraphrase contradictions, unsupported prose claims, meaning-level inconsistencies. Expensive, high-confidence, run only when certainty matters.

Both are necessary; they answer different questions at different depths.
