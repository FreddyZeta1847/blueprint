---
name: get-context
description: "Understand a request before any plan. Answers every question in Blueprint's data/context-questions.json (deduced where possible and shown to the user, asked otherwise), derives the pace, writes blueprint/context.md and waits for the user's confirmation. Use right after the entry step classifies a request as new work (small, medium or a project). Never for a tiny request."
---

# Get Context

<!--
Header comment: Blueprint v3's context step. It turns a request into a confirmed context card
(blueprint/context.md) by answering every question listed in the plugin's
data/context-questions.json: deduced from the repo, the conversation and an existing card where
possible, asked otherwise. It replaces v2's brainstorming Phase 1, feature-detection and the
user-agent skill (the `roles` question says who decides each area). The card format is an
interface read by the hooks: change it only together with hooks/. Nothing is planned until the
user confirms the card; planning is blueprint:create-plan.
-->

Blueprint plans only after it knows the context: what the goal is, who approves, how much a
mistake costs, which parts the work has. This skill finds those answers, writes them on one card,
and gets the user's yes. First read `blueprint:using-blueprint` (hard rules, plain language).

## 1. Pick the scale

The scale comes from the entry step in `blueprint:using-blueprint`. It decides how much of this
skill runs.

| Scale | Example | What you do |
|---|---|---|
| **Tiny** | "change the button colour" | Don't run this skill. One line of confirmation in chat ("Small change, no plan: I change the colour in the theme file. OK?"). **No files at all.** |
| **Small** | "check whether our Azure plan supports WebSockets" | Almost everything is deduced. Show the deductions, ask one confirmation. |
| **Medium, card already confirmed** | "add Google login" on a running project | Reuse `blueprint/context.md`. Repeat the answers that still hold in one short block, ask only what is new. |
| **Project, or no card yet** | "a booking site for a gym" | Every question. |

Example (medium, card already confirmed):
> The context still holds: personal project, you approve, no deadline, foundations decided.
> One new point: Google login touches the foundations (security). Who picks the provider setup —
> 1. you (recommended: it is hard to change once users have accounts), or 2. me?

## 2. Read the questions

Read `data/context-questions.json` at the root of the Blueprint plugin (two folders up from this
skill file). **That file is the list.** Every `id` in it needs exactly one answer on the card;
`ask` is the plain question, `why` tells you what the answer is for. Don't work from memory: the
list can change between versions.

## 3. First question, always: does it touch the foundations?

Before anything else, say in plain words what you understood and answer: **does this touch the
foundations** — a shared choice that is expensive to change (a contract between parts, the data
model, auth, hosting, CI/CD, a project rule)?

- Deduce it when you can (from the vault, the code, the request) and say how you know.
- It shapes the rest: if it touches the foundations, `roles` must say who decides each touched
  area, and the plan will need a discussion stage for it. If it touches none, the details are
  Claude's and the plan stays small.
- Write the answer into the `roles` line of the card (which areas are touched, who decides each).

## 4. Deduce what you can, and show it

Answer on your own every question the evidence already settles. Sources, in this order:
1. an existing `blueprint/context.md` (answers that still hold);
2. the request and the conversation;
3. the repo: README, manifests, git remote and history, CI files, an existing `blueprint/vault/`;
4. the user's `CLAUDE.md` rules (global and project);
5. Discovery's results, when it ran.

**Show every deduction** in one compact block before asking anything else, so the user can correct
it: "From what I see: personal project (no client in the repo), you approve, no deadline…".
A question that does not apply gets "not needed" with a one-line reason (for example `approver`
for a quick personal check).

**Existing code you don't know.** If the repo holds code and there is no vault or card that
describes it, offer Discovery before going on: *"There is code here I don't know yet. Shall I read
it first (Discovery)? It fills several answers by itself."* It is a proposal, never automatic.
See `blueprint:discovery`.

## 5. Ask the rest — one or two at a time

- **One or two questions per message**, then stop and wait. Never a questionnaire.
- **Multiple choice, recommendation first**, each option in plain words, plus "other". Ask as
  plain text with numbered options (use a multiple-choice tool only if one is available).
- Use the `ask` text of the file as a starting point, rephrased for this request.
- Never answer your own question, never "assume for now and continue".

Questions that need care:
- **`roles`** — who decides each area. List the areas the work touches and ask once: *"Which of
  these do you want to decide yourself? I handle the others and write down every choice; anything
  hard to change later still comes back to you."* Recommend the user for areas where a mistake is
  costly, Claude for the rest. Write it as one line per area ("DB: user · CI/CD: Claude"). The user
  can switch an area at any time: update the card in the same turn.
- **`parts`** — name the parts (frontend, backend, app, documents…) and say which ones can be
  built **independently** once their shared contracts are fixed. This is what lets the plan work in
  parallel.
- **`documentation`** — you propose, the user confirms. Propose a **vault** for a project, high
  risk, several foundation areas or client work; propose **the card alone** for small and medium
  work. A vault answer means the plan will create `blueprint/vault/`.

## 6. Derive the pace — never ask it

Pace is not a question. Derive it from `timing`, `kind` and `risk`, and write it in plain words.
- Personal, no deadline → *"Calm: we discuss every hard-to-change choice fully."*
- Demo tomorrow → *"Rush: we discuss only the hard-to-change choices, build in parallel, keep a
  plan B for the demo."*
- Client project, long-lived product → *"Steady: discuss the foundations fully, early feedback
  from the client."*

## 7. Write the card and get the yes

Write `blueprint/context.md` with the `Write` tool (it creates the folder). Exact format — the hooks
read it:

```markdown
# Context — <project>
Pace: <plain words, derived by you>

## Answers
- **goal** · user — <answer>
- **kind** · deduced — <answer>
- **approver** · not needed — <reason>
```

- One line per `id` of the questions file, each id exactly once, in the file's order.
- Source is `user`, `deduced` or `not needed` (the hooks also accept `utente`, `dedotta`,
  `non serve`).
- Keep the headings, ids and source values as above; write the answers in the user's language.
- Project name: the repo folder, or the manifest's `name`.
- **No `Confirmed:` line yet.**

Then show the card in plain words (a short list, not the raw file) and ask: *"Is this right? Once
you confirm, I propose the plan."*
- **Yes** → add the line `Confirmed: <YYYY-MM-DD>` right under the title, then go to
  `blueprint:create-plan`.
- **Corrections** → fix the card, show what changed, ask again.

**No plan before the confirmation.** Not a draft, not "a first idea of the stages".

## 8. When the card changes later

The user's role, the approver, a deadline or the budget can change mid-project. Update the
answer, show the change, get a new yes (update the `Confirmed:` date), then propose the matching
plan change through `blueprint:create-plan` (re-planning).

## What NOT to do

- Don't write any file for a tiny request
- Don't plan, or sketch stages, before the card is confirmed
- Don't ask the pace, and don't ask what you can deduce — show the deduction instead
- Don't ask more than two questions in one message
- Don't add the `Confirmed:` line before the user's yes
- Don't run Discovery without the user's OK
- Don't name tools, sessions or plugins here: how the work is executed is not Blueprint's business
