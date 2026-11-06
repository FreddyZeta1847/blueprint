---
name: get-context
description: "The first step of every new request in a Blueprint project. Derives from the context what Blueprint's data/context-questions.json says must be known, asks only what cannot be derived (other questions too, when the work needs them), draws the conclusions — size, difficulty, pace — and routes: tiny → one line and do it; fits the plan → re-planning; new work → writes blueprint/context.md and waits for the user's confirmation."
---

# Get Context

<!--
Header comment: Blueprint v3's context step, and the first step of every new request. It finds
out what data/context-questions.json says must be known — derived from the request, the
conversation, the repo and an existing card wherever possible, asked otherwise — then draws the
conclusions (size, difficulty, pace) that route the request: tiny, fits the existing plan, or new
work with a confirmed context card (blueprint/context.md). Planning itself is
blueprint:create-plan.
-->

Blueprint plans only after it knows the context: what the goal is, who approves, how much a
mistake costs, which parts the work has. This skill finds that out, draws the conclusions and,
for new work, writes them on one card and gets the user's yes. First read
`blueprint:using-blueprint` (hard rules, plain language).

## 1. What must be known

Read `data/context-questions.json` at the root of the Blueprint plugin (two folders up from this
skill file). **It is a list of things to know, not a questionnaire.** Each entry has an `id`, an
`ask` (the plain question to use *if* you have to ask) and a `why` (what the answer is for). Don't
work from memory: the list can change between versions.

## 2. Derive first

Answer on your own everything the context already settles. Sources, in this order:
1. an existing `blueprint/context.md` (answers that still hold);
2. the request and the conversation;
3. the repo: README, manifests, git remote and history, CI files, an existing
   `blueprint/decisions/`;
4. the user's `CLAUDE.md` rules (global and project);
5. Discovery's results, when it ran.

An entry that does not apply gets "not needed" with a one-line reason (for example `approver` for
a quick personal check).

**Save the draft right away — unless the work is tiny.** As soon as you see the work is not tiny
(you usually know from the request), write `blueprint/context.md` as a **draft**, before asking
anything and before any Discovery or search: what you derived, and every point still unknown with
the source `open` (format in §5, no `Confirmed:` line). Update it as answers arrive. The draft is
what keeps this step alive: after a Discovery, a long search, a compacted conversation or a new
session, the hooks see the draft and bring you back here with its open points. For tiny work write
nothing.

**Existing code you don't know.** If the repo holds code and there is no card and no decisions
folder that describe it, offer Discovery before going on: *"There is code here I don't know yet.
Shall I read it first (Discovery)? It answers several points by itself."* It is a proposal, never
automatic. See `blueprint:discovery`.

**Getting more context is part of this step.** The sources above are what you have at hand, not
the limit. The user can ask you — and you can propose, when a point stays open — to go and find
more context, with any tool or plugin they have:
- **look online** (prices, limits of a service, what a library does, recent facts);
- **run Discovery** on code you don't know;
- **read what the user points you to**: a document, a link, an email, another repository, notes
  from a meeting;
- **wait for the user** to ask someone else (a colleague, the client) and come back with the answer.

Whatever comes back fills the points it answers (source `deduced`, or `user` when the user brought
it). Then go on with this skill where you left it: the points still open, then the conclusions.

## 3. Ask what you cannot derive

- **Show what you derived first**, in one compact block, so the user can correct it: "From what I
  see: personal project (no client in the repo), you approve, no deadline…".
- Then ask only what is still missing — **one or two questions per message**, then stop and wait.
  Never a questionnaire.
- The list is the minimum, not the limit: if the work needs to know something else (an account,
  a format, who the users are), ask it too.
- **Multiple choice, recommendation first**, each option in plain words, plus "other". Ask as
  plain text with numbered options (use a multiple-choice tool only if one is available).
- Never answer your own question, never "assume for now and continue".

Points that need care:
- **`roles`** — who decides what. List the areas of choices the work involves and ask once:
  *"Which of these do you want to decide yourself? I handle the others and write down every
  choice; anything hard to change later still comes back to you."* Recommend the user for areas
  where a mistake is costly, Claude for the rest. One line per area ("DB: user · CI/CD: Claude").
  The user can switch an area at any time: update the card in the same turn.
- **`parts`** — name the parts (frontend, backend, app, documents…) and say which ones can be
  built **independently** once their shared contracts are fixed. This is what lets the plan work in
  parallel.
- **`documentation`** — you propose, the user confirms. Propose a **decisions folder** for a
  project, high risk, several areas of choices or client work; propose **the card alone** for small
  and medium work. A "decisions folder" answer means the plan will create `blueprint/decisions/`.

## 4. Draw the conclusions

From the answers, conclude three things and say them in plain words:

- **Size** — how big the work is:

| Size | Example | What happens next |
|---|---|---|
| **Tiny** | "change the button colour" | One line of confirmation, then do it. **No files, no plan.** |
| **Fits the existing plan** | a task inside a planned stage | Re-planning (`blueprint:create-plan` §6): new topics or a new stage, before → after. The card is reused. |
| **Small** | "check whether our hosting supports WebSockets" | The card (§5), then a plan of 1–3 stages. |
| **Medium** | "add Google login" | The card, then 2–5 stages (or topics in an existing stage). |
| **Project** | "a booking site for a gym" | The card, then usually around 8–12 stages. |

- **Difficulty** — what makes it hard, in one line: choices that are hard to change, unknowns,
  many parts, someone else approving, sensitive data. *"Difficult: payments and personal data, and
  the client approves every step."* or *"Easy: one part, nothing hard to change."*
- **Pace** — never asked. Derive it from `timing`, `kind` and `risk`:
  - personal, no deadline → *"Calm: we discuss every hard-to-change choice fully."*;
  - demo tomorrow → *"Rush: we discuss only the hard-to-change choices, build in parallel, keep a
    plan B for the demo."*;
  - client project, long-lived product → *"Steady: discuss the hard-to-change choices fully, early
    feedback from the client."*

What is "tiny" is your judgement; the user can correct it. Work with a one-way choice in it is
never tiny.

Example (tiny):
> Small change, no plan: I change the colour in the theme file. OK?

Example (medium, card already confirmed):
> The context still holds: personal project, you approve, no deadline. New: Google login means
> choices about security that are hard to change once users have accounts. Medium size, difficult
> on one point. Who picks the provider setup — 1. you (recommended), or 2. me?

## 5. The card: draft, then the yes (new work only)

`blueprint/context.md` is written with the `Write` tool (it creates the folder): first as a draft
(§2), then completed with the conclusions. Format:

```markdown
# Context — <project>
Size: <small | medium | project> — <one line why>
Difficulty: <plain words>
Pace: <plain words>

## Answers
- **goal** · user — <answer>
- **kind** · deduced — <answer>
- **approver** · not needed — <reason>
- **account-access** · user — <an extra point the work needed>
- **timing** · open — <what is still unknown>   ← only while it is a draft
```

- One line per `id` of the questions file, each id exactly once, in the file's order; then any
  extra point you asked about, with a kebab-case id of your choice.
- Source is `user`, `deduced` or `not needed` (`utente`, `dedotta`, `non serve` in Italian); in the
  draft, a point not known yet is `open` (`aperto`). The hooks read the `open` points to bring you
  back here. In the draft the three conclusion lines may say "to be drawn".
- **Before asking for the yes, no point is `open`** and the conclusions are drawn.
- Keep the headings, ids, size values and source values as above; write everything else in the
  user's language.
- Project name: the repo folder, or the manifest's `name`.
- **No `Confirmed:` line yet.**

Then show the card in plain words (a short list, not the raw file) and ask: *"Is this right? Once
you confirm, I propose the plan."*
- **Yes** → add the line `Confirmed: <YYYY-MM-DD>` right under the title, then go to
  `blueprint:create-plan`.
- **Corrections** → fix the card, show what changed, ask again.

**No plan before the confirmation.** Not a draft, not "a first idea of the stages".

## 6. When the card changes later

The user's role, the approver, a deadline or the budget can change mid-project. Update the
answer (and the conclusions, if they move), show the change, get a new yes (update the
`Confirmed:` date), then propose the matching plan change through `blueprint:create-plan`
(re-planning).

## What NOT to do

- Don't turn the list into a questionnaire: derive first, ask only what is missing
- Don't write any file for a tiny request
- Don't plan, or sketch stages, before the card is confirmed
- Don't ask the pace — derive it
- Don't ask more than two questions in one message
- Don't add the `Confirmed:` line before the user's yes
- Don't run Discovery without the user's OK
- Don't name tools, sessions or plugins here: how the work is executed is not Blueprint's business
