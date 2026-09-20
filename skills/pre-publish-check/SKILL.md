---
name: pre-publish-check
description: "Pre-push code coherence check — verify changed code against locked atoms before pushing"
---

# Pre-Publish Check

Use this skill when you're about to push code. It checks for coherence between your changed code and the locked atoms that should govern it.

## How to use

When you're ready to push changes:
```
/push
```

Claude will automatically offer the pre-publish check at that moment. Choose to run it or skip it. **Running it costs real tokens; skipping it costs rigor.**

## What it does

1. **Identifies changed files** since the last push
2. **Finds relevant atoms** — which feature's atoms govern these files?
3. **Asks first, never silent** — "Want me to run a code review against the atoms before this goes out?"
4. **If yes:** Dispatches a fresh-context agent to verify:
   - Code actually implements the locked decision atoms
   - No reversals of locked one-way decisions
   - Rationale matches the implementation
   - Hidden architectural assumptions match locked atoms
5. **If no:** Claude does NOT push normally; it does everything possible to make it safer — different branch, separate folder, external location — keeping the risk contained without touching the real target

## Contrast with deep-review

- **deep-review** (via `/deep-review`): Checks vault prose against atoms — expensive semantic review, on-demand, for whole features or vault-wide
- **pre-publish-check** (here): Checks actual code against atoms — at one specific moment (push time), asks first, verifies implementation coherence

Both are high-cost semantic checks. They answer different questions: vault consistency vs. code-atoms alignment.

## Key principle

**Safety is never silently skipped.** Whether you run the check or skip it, Claude does what it can to keep the push safe — run a real verification or constrain the push to a protected location. The question is never "do we check?" but "how do we verify before this goes out?"
