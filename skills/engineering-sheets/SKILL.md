---
name: engineering-sheets
description: "Offer to build or refresh the project's engineering-sheets.html — a single self-contained visual reference rendered from already-locked atoms and prose. Use when a feature reaches its last sub-feature, when an atom changes after a sheet already exists, or when the user asks for a diagram or overview of how the system fits together. Always offers, never builds on its own."
---

# Engineering Sheets

A second **lens** on the vault, not a second source of truth. Prose and atoms are for Claude and
for tracking decisions. This is the same data drawn for a human engineer who needs the shape of the
system at a glance.

It invents no new capture step. A caching choice, a retry policy, a concurrency rule — each of
those was already an ordinary decision atom the moment Topic-Discussion's diverge phase weighed it
that way. This reads them back out as a picture.

**Output:** one file, `vault-<project>/Sheets/engineering-sheets.html`. Self-contained, navigable
by a sticky sidebar TOC. Never one file per feature.

---

## The rule that comes first: ask, never build

Real token cost — a real agent dispatch synthesising a whole feature's atoms into one narrative. So
it follows the same discipline as `deep-review` and `pre-publish-check`:

> **Asked, never silent, never forced.**

You **notice** the trigger and **offer**. You never generate on your own, and a "no" costs nothing
because asking again later is free.

### Triggers

| Situation | What to offer |
|---|---|
| A feature just reached its **last** sub-feature | Build that feature's sheet (and Sheet 0 if it doesn't exist yet) |
| An atom changed and a sheet already covers that feature | Refresh that feature's sheet |
| The user asks for an overview, a diagram, or "how does this all fit together" | Build or refresh, whatever is missing |

**There is no staleness-detection hook in v1.** Build and refresh happen on demand only — the same
reason the markdown-reflow hook and Review's graph-index acceleration are deferred. Ship the
minimal complete thing, then discuss enhancements once it exists and is used.

### Refreshing pulls neighbours in

Refreshing one feature's sheet also flags **Sheet 0**, and any feature whose contract with it may
have changed, as possibly stale — and **offers** to refresh those too. Same ask-first rule. Never
automatic, never a cascade the user didn't agree to.

---

## What the document contains

### Sheet 0 — the whole project
- Every component as a subgraph
- Real steps as short nodes, **2–4 words each** — not sentences
- Real cross-component arrows, showing what actually moves
- Already-locked technology decisions called out in a **keynote box**, read straight back from
  `ratified` / `locked` atoms

### One sheet per top-level feature
Drawn **"as if for the engineer who owns only this piece."** That framing decides everything:

- **This** feature's own internal mechanism, in full detail — state management, caching,
  concurrency and locking, security and sanitisation, retry and backoff policies, and every locked
  axis relevant to it. Not just its headline choice.
- **Every neighbouring feature reduced to an opaque contract box** — what goes in, what comes out.
  Never its internals. A neighbour's internals belong on the neighbour's own sheet, and duplicating
  them is how two sheets start disagreeing.

### Failure points, woven in
Every failure point appears as a **small numbered badge at the exact spot it can occur** — not
collected in a separate "risks" section divorced from where they happen.

### The Error Legend
One consolidated legend at the end, **grouped by which sheet owns each badge**. Per entry: what
breaks, when, and how it is already handled. If a badge has no answer for "how is it handled", that
is a real gap in the design — surface it to the user rather than inventing a mitigation.

---

## How to run it

1. **Confirm the trigger and ask.** Name what you would build or refresh, and that it costs a real
   agent dispatch.
2. **On yes, dispatch `sheet-designer`.** Give it: which feature(s), the vault root, and whether
   this is a first build or a refresh.
3. **Report what changed**, and flag any neighbour sheet or Sheet 0 now possibly stale — with an
   offer, not an action.

**`sheet-designer` is a reader, never a writer of authoritative files.** It reads atoms and prose
and writes exactly one derived artifact. `vault-architect` remains the single writer of every
authoritative vault file. If a sheet appears to need a decision that doesn't exist yet, that is not
something to draw around — it goes back through Topic-Discussion as a real topic.

---

## Boundaries

- **Renders only what is already locked.** Never a capture pass, never an interview. If the atoms
  don't say it, the sheet doesn't claim it.
- **Never writes vault Markdown or `atoms.json`.** Not once, not "just to fix a typo".
- **Never invents a mechanism to make a diagram look complete.** A visible gap is the useful
  output; a plausible-looking invention is the harmful one.
- **Not a contract diagram.** A contract diagram shows boundaries. This shows one piece's whole
  working mechanism, with boundaries only at the edges.

## What NOT to do

- Don't build or refresh without asking — not even when the trigger is obvious
- Don't write one file per feature; it is one document with a TOC
- Don't show a neighbour's internals on this feature's sheet
- Don't collect failure points into a separate section away from where they occur
- Don't silently refresh Sheet 0 or a neighbour because you refreshed one feature
- Don't invent a mitigation for a badge the design doesn't actually handle
