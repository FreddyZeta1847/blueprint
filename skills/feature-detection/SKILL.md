---
name: feature-detection
description: New work on an established Blueprint project — after the entry step, split the request, decide per item whether it touches the foundations, classify it (routine, note, addition, revision, new area or section) and propose the steps, in one list for the user to correct.
---

# Feature-Detection

Use this skill on an **established project with a vault** (brainstorming or discovery already
ran) when the entry step of `blueprint:using-blueprint` says the request touches the foundations
or more than one section. It turns the request into steps of the path, in one organized list.

## 1. Split the request if needed

Does it describe more than one independent item?
- "Add a cache layer and fix the API response schema" → two items
- "Add multi-factor authentication" → one item

Split along the foundations/sections tests (`blueprint:using-blueprint`, Core concept 1).

## 2. Per item: does it touch the foundations?

Ground the answer in the vault (the area and section files, `_architecture.md`), the code, and any
project rule. Default to **yes** when unsure. Never dispatch specialists here.

Then classify it:

| Class | What it means | What happens |
|---|---|---|
| **Routine** | Inside one section, follows an established pattern, nothing new to decide (e.g. one more page like the others) | No discussion. Built directly **only if the user asked for the work now**. New details are recorded as `Decided by: claude` |
| **Note** | One small decision inside an existing area or section | Light discussion (below) |
| **Addition** | Adds to a locked area without contradicting it ("add a queue to CLOUD") | Short confirmation, written into the area |
| **Revision** | Changes a locked decision ("move from App Service to Container Apps") | Real discussion with specialists, decided by the area's owner; dependents warned |
| **New area / new section** | A new shared choice, or a new piece of value for the user | Full discussion; added to the graph, with importance and (for an area) who decides |

**A note is light.** It gets **one** specialist, who first reads the code it touches and then
proposes 2–3 concrete ways to fit in. The user picks; it is written as a block in the existing
file.

**A new area** also needs its owner: ask in the same list *"Do you want to decide this one, or
leave it to me?"* and record the answer in `local-profile.md`.

## 3. Propose the steps

Turn the items into path steps (`discuss`, `prototype`, `mockup`, `build`), mode B: dependencies
first, following the graph. Put a `prototype` step first when a decision depends on unknown
feasibility. Explain the order in one line.

## 4. Show one organized list

**One list, one pass of corrections. Never a series of small questions.**

```
## Routine (no discussion)
- Item X — follows the existing pattern of Y

## Touches the foundations
- Item Y — revision of CLOUD: today we use App Service, this needs containers
- Item Z — addition to DB: a new `invoices` table
- Item W — new section INVOICES · importance 3/5 (uses DB, AUTH)

Proposed steps: discuss CLOUD (revision) → discuss INVOICES → build INVOICES
```

Never use internal words ("topic", "atom", "shape") with the user.

## 5. Write the steps

When the user confirms, append the steps to `_queue.json` (schema in `blueprint:docs-management`)
in the right place of the existing order, and add any new area or section file and its graph
edges. You write these files yourself.

## 6. Hand-off to implementation

For a `build` step, prepare what the implementer reads, so planning and building stay separate:
- the section file and its `--details.md`;
- the contracts it uses or exposes;
- the one-way decisions of the areas it depends on;
- the acceptance criteria;
- the skills and profile named in the step.

Point the process plugin (for example `superpowers:writing-plans`) at exactly these files. The
implementer never re-decides what they contain; if it finds a decision wrong or missing, it stops
and it comes back here as a note, addition or revision.

## What NOT to do

- Don't write code from a planning conversation unless the user asked for the work now
- Don't quiz the user on Blueprint terminology — you classify, they correct
- Don't interrupt with per-item questions — one list, one pass
- Don't skip a project rule silently — if one applies, say it plainly
- Don't treat a revision as an addition to avoid a discussion

## Anti-sycophancy rule

If the user wants to skip a discussion you think is needed (for example a revision presented as
"just a small change"), push back once: say what is being traded away, then respect their call.
