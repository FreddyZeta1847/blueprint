# Progress Log

Public, sanitized record of design work. Names *what kind* of decision was made — never the
resolution itself. Full rationale lives in the (gitignored) vault.

- 2026-07-26 — BLUEPRINT: project feature breakdown and plugin/marketplace repo structure locked
- 2026-07-26 — BLUEPRINT--SETUP: pipeline-step feature documented (command-vs-skill + handoff-mechanism decision)
- 2026-07-26 — BLUEPRINT--ORIENTATION: pipeline-step feature documented (session-start mechanism design)
- 2026-07-27 — BLUEPRINT: vault frontmatter/status-tracking convention revised, superseding original spec
- 2026-07-27 — BLUEPRINT--DISCOVERY: multi-agent implementation shape confirmed
- 2026-07-27 — BLUEPRINT--DISCOVERY: pipeline-step feature documented
- 2026-07-28 — BLUEPRINT--BRAINSTORMING: pipeline-step feature documented
- 2026-07-30 — BLUEPRINT--ORIENTATION: shared-concept ownership decision revisited
- 2026-07-30 — BLUEPRINT--FEATURE-DETECTION: pipeline-step feature documented
- 2026-07-30 — BLUEPRINT--REVIEW: pipeline-step feature documented
- 2026-07-31 — BLUEPRINT--DOCUMENTATION: pipeline-step feature documented
- 2026-08-02 — BLUEPRINT--DISTRIBUTION: pipeline-step feature documented — all 8 features now designed
- 2026-08-02 — BLUEPRINT: Review's --all mode dogfooded on the vault; 10 findings triaged, 2 fixed, 8 dismissed
- 2026-08-03 — BLUEPRINT--PHASE-1-FOUNDATION: first implementation phase discussed, built, and recorded; repo tooling bug found and fixed (see .claude/issues/001). Remaining phases to be discussed and scoped one at a time.
- 2026-08-06 — BLUEPRINT: feature-level discussion reopened — a set of candidate additions (decision-indexing, entry-flow/gate, user-agent, governance) under discussion, none locked yet
- 2026-08-06 — BLUEPRINT: decision-indexing candidate addition settled (structure, storage, and consistency-check mechanism); touches two already-shipped pieces, not yet applied
- 2026-08-06 — BLUEPRINT: user-agent candidate addition settled (scope, safety boundary, and storage); one mechanism still needs technical verification before it's built
- 2026-08-07 — BLUEPRINT: entry-flow/gate candidate addition settled (routing, brownfield scanning, and a two-mechanism consistency check); the most heavily-discussed item so far, shares an unverified mechanism with the user-agent addition
- 2026-08-07 — BLUEPRINT: discussion-skills candidate addition settled (skill boundaries, shared-engine shape, termination rules, and a conversational-posture rule)
- 2026-08-08 — BLUEPRINT: governance-input candidate addition settled (authoring format, compilation step, and conflict-presentation rule)
- 2026-08-08 — BLUEPRINT: shared-vocabulary lifecycle settled (when terms are registered and which checks catch what); full inventory audit run over every designed component, consolidating the automation layer and retiring one inherited check
- 2026-08-08 — BLUEPRINT: audit-trail candidate addition settled (contents, identity source, generation model); one identity-source assumption still needs verification
- 2026-08-08 — BLUEPRINT--DOCUMENTATION: vault version-control default reversed, superseding the shipped spec; this repo keeps the opt-out path
- 2026-08-08 — BLUEPRINT: seeded-preferences candidate addition settled (authoring surface, precedence rule, and a boundary correction applied back to an earlier item) — all 7 candidate additions now resolved; vault rewrite and three technical verifications outstanding
- 2026-08-08 — BLUEPRINT: version-control layout settled (which artifacts are tracked vs. regenerated, and how one is restructured to avoid merge pain); narrows the stated purpose of an earlier-settled check
- 2026-08-08 — BLUEPRINT: enforcement-model simplified — a mechanism from the most heavily-discussed candidate addition dissolved entirely into pieces that already existed; one automation layer removed, one technical verification dropped, one earlier item reopened for re-check
