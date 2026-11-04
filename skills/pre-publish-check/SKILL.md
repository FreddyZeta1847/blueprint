---
name: pre-publish-check
description: Before a push, offer to verify the user's own changes against the locked decisions that govern them. Ask first, never silent.
---

# Pre-Publish Check

<!--
Header comment: Blueprint v2's pre-push coherence check. It looks only at the user's own diff
(correction C-02), finds the decisions that govern the changed files, and offers an independent
review. Later, the merge gate of the implementation method can call the same check.
-->

Use this skill when the user asks to push, or when you are about to push on their behalf.

## What it does

1. **Find the user's own changes only.** Compare against the default branch: `git diff
   <branch>...HEAD` plus uncommitted changes. Code that arrived from other people's merges is not
   part of this check. If `_architecture.md` records a Discovery baseline, use that branch.
2. **Find the governing decisions.** For each changed file: its owner from the module map
   (`modules.json`), the decision blocks of that area or section, the contracts it uses, and any
   foundation decision whose `Used by` names that section.
3. **Ask first:** "Want me to check these changes against the decisions they rely on before they
   go out? It costs a fresh review." Never run it silently.
4. **If yes:** dispatch a fresh-context agent (not the one that wrote the code) with the diff and
   the decisions. It checks that:
   - the code implements the decisions it relies on;
   - no one-way decision or contract was reversed;
   - no hidden assumption contradicts a decision.
   Explain its findings in plain words. A real contradiction is either fixed in the code or taken
   back to a discussion (a revision), never patched by editing the decision quietly.
5. **If no:** don't push straight to the shared branch. Keep the risk contained (a separate branch,
   or ask the user where it should go).

## Contrast with `/deep-review`

- `/deep-review` checks the **vault** against itself (prose vs. decisions).
- This checks **code** against the vault, at push time.

Both cost real tokens; both are always asked, never forced.
