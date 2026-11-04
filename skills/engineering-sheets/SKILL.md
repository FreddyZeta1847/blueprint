---
name: engineering-sheets
description: "Offer to build or refresh Sheets/engineering-sheets.html — one self-contained visual reference drawn from already-locked decisions. Use when a foundation area or section finishes its discussion, when a decision changes after a sheet exists, or when the user asks how the system fits together. Always offers, never builds on its own."
---

# Engineering Sheets

<!--
Header comment: Blueprint v2's optional visual lens on the vault. It never captures decisions and
never writes vault Markdown; it asks the user, then dispatches sheet-designer to render one derived
HTML file from the decision blocks in foundations/, contracts/ and sections/.
-->

A second **lens** on the vault, not a second source of truth. The decision blocks are for Claude
and for tracking; this is the same data drawn for a human engineer who needs the shape of the
system at a glance. It invents no capture step: a caching choice or a retry policy was already a
decision block the moment it was discussed.

**Output:** one file, `vault-<project>/Sheets/engineering-sheets.html`. Self-contained, navigable
by a sticky sidebar TOC. Never one file per area.

## The rule that comes first: ask, never build

Real token cost (an agent synthesising a whole area's decisions into one narrative), so:

> **Asked, never silent, never forced.**

You **notice** the trigger and **offer**. A "no" costs nothing; asking again later is free.

| Situation | What to offer |
|---|---|
| A foundation area or section just finished its discussion | Build its sheet (and Sheet 0 if missing) |
| A decision changed in an area or section that already has a sheet | Refresh that sheet |
| The user asks for an overview, a diagram, or "how does this fit together" | Build or refresh what's missing |

Refreshing one sheet also flags **Sheet 0**, and any area or section whose contract with it may
have changed, as possibly stale — and **offers** to refresh those too. Never an automatic cascade.

## What the document contains

- **Sheet 0 — the whole project:** every component as a subgraph, steps as 2–4 word nodes, real
  cross-component arrows, and a keynote box naming the locked technology choices (decisions marked
  `Decided by: user` or `rule`).
- **One sheet per foundation area and per section,** drawn "as if for the engineer who owns only
  this piece": its full internal mechanism (state, caching, concurrency, security, retries, every
  relevant decision), while every neighbour is an **opaque contract box** — what goes in, what
  comes out, never its internals.
- **Failure points woven in place:** a small numbered badge exactly where each failure can occur.
- **One Error Legend at the end,** grouped by sheet: what breaks, when, how it is already handled.
  A badge with no "how it's handled" is a real design gap: surface it, never invent a mitigation.

## How to run it

1. Name what you'd build or refresh and that it costs a real agent dispatch. Ask.
2. On yes, dispatch `sheet-designer` with: which areas or sections, the vault root, first build or
   refresh.
3. Report what changed, and offer (don't do) any refresh it flagged as stale.

`sheet-designer` reads the vault and writes exactly one derived file. The main session remains the
only writer of authoritative vault files. A sheet that seems to need a decision nobody made goes
back to a real discussion; it is never drawn around.

## What NOT to do

- Don't build or refresh without asking.
- Don't write one file per area; it's one document with a TOC.
- Don't show a neighbour's internals.
- Don't collect failure points in a separate section away from where they occur.
- Don't present a decision made by Claude, by Discovery or inherited as settled: the sheet marks it
  unconfirmed.
