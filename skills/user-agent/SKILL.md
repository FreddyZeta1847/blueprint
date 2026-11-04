---
name: user-agent
description: "Who decides each foundation area — the user or Claude — and the global Profile of the user's learned tendencies. Use when areas are assigned at the end of brainstorming, when the user wants to switch an area, or when a user-confirmed decision may reveal a tendency."
---

# User-Agent

Two jobs. **Never mix them.**

| | Area ownership | Profile |
|---|---|---|
| What it does | Says who decides each area: the user, or Claude (the user agent) | Remembers the user's past choices and tendencies |
| Risk | Real — Claude locks things | None — advisory only, never acts |
| Where it lives | `vault-<project>/local-profile.md` (per project) | `~/.claude/blueprint/profile.json` (global) |

---

## 1. Area ownership

### When it is set

**Once, at the end of brainstorming** (Phase 3 of `blueprint:brainstorming`), with one
multiple-choice question covering all areas: *"Which of these areas do you want to decide
yourself?"* It is set again only for a **new area** (feature-detection asks it in its list) or
when the user asks to switch an area — at any time, in plain words ("let Claude handle CI/CD
from now on").

Sections are not assigned: a section's foundation-level choices follow the areas they touch, and
its own details are Claude's unless the user says otherwise.

### Which answer to recommend

1. The global Profile's tendencies (for example "usually decides infrastructure, leaves design to
   Claude") — say so: *"(Recommended — last time you decided the infrastructure yourself)"*.
2. Otherwise importance: areas at 4–5 are suggested as the user's, 1–2 as Claude's, 3 no
   suggestion.
The user always chooses.

### Where it is stored

`local-profile.md`, one line per area: `user` or `claude` (format in `blueprint:docs-management`).
You write it yourself. It is never a decision block and the checks never read it. If the user
switches an area, update the line in the same turn.

---

## 2. What each owner means

### User-owned area
Every decision that matters goes through the discussion and the plain summary, and the user
confirms it. Written as `Decided by: user` in the main area file. Small two-way details Claude
settles itself still appear in the summary under **"Details I settled myself"** (a notice, not a
discussion) and are written as `Decided by: claude` in the area's `--details.md`.

### Claude-owned area
- **Two-way decisions:** Claude settles them with the specialists' input and locks them without
  stopping, as `Decided by: claude` in `--details.md`. Mention them briefly in the summary.
- **One-way decisions:** never take the fast path. They are shown to the user in plain words and
  wait for a real confirmation, exactly as in a user-owned area. Then `Decided by: user`.
- **Anything the user explicitly confirmed is `Decided by: user`**, whoever owns the area.
  `Decided by` follows *each decision*, never the area's owner.

Either way the user only sees plain decisions in chat, never field names.

### The floor cannot be switched off
`hooks/one-way-guard.js` (PreToolUse) refuses any vault write where a block has
`Reversibility: one-way` together with `Decided by: claude`. It fires before any permission-mode
check, including `acceptEdits` and `bypassPermissions`.

**If the guard refuses a write:**
1. Tell the user in plain words that this decision is hard to undo, so you need their OK.
2. Get a real answer.
3. Write the block again as `Decided by: user` (and the rest of that write with it).
Do **not** relabel the decision two-way to get past the hook. If the reversibility really was
wrong, correct it as its own decision and say why.

### Autonomous still means well-informed
Claude-owned decisions use the **same specialists** as a discussion with the user present
(`blueprint:using-blueprint`, Core concept 5). Never a faster, thinner substitute.

---

## 3. The Profile

Lives at `~/.claude/blueprint/profile.json` — **global, outside any project's vault.**

It stores two shapes:
1. **Concrete past choices** — "chose Postgres over Mongo for the analytics service".
2. **General tendencies** — short plain-language notes that colour how future options are
   framed. For example *"prefers boring, well-documented tools"* or *"wants the cheap option named
   first"*. **(2) is worth more than (1)**: a tendency transfers to new situations.

**Ownership tendencies.** After the brainstorming ownership answer, dispatch `profile-updater`
with it. Once the same pattern shows up in a second project it may propose a tendency like
*"decides infrastructure, lets Claude handle design"* — shown to the user before saving.

**`local-profile.md` beats the global Profile for this project.** The global Profile only fills
in what the local file doesn't say.

**Neither is ever a decision block.** A block records a decision actually made. A profile entry is
a pattern noticed afterwards; writing it as a decision would put it in the compiled index and the
checks would start comparing areas against a "decision" nobody made.

### Four authority layers
Strongest first; each fills only a gap left by the one above.
1. **Project rule** (`management-info.md` → Rules, `Decided by: rule`) — binding
2. **Company-seeded preferences** (`management-info.md` → Preferences) — a suggestion
3. **Personal learned Profile** — a suggestion
4. **Nothing set** — fully open discussion

Only layer 1 can block anything.

---

## 4. Updating the Profile — closed-loop protection

**Only decisions the user confirmed (`Decided by: user`) ever update the Profile.** Decisions
Claude took (`Decided by: claude`) are recorded but **never feed learning**: otherwise Claude's
own guesses would reinforce themselves into a "tendency".

- *Mechanical half:* the file-watcher hook reads every decision write and returns a
  `[Blueprint]` line when a new user-confirmed decision appears, flagging that a Profile pass is
  due.
- *Reasoning half:* dispatch `profile-updater`. It decides whether the decision reveals a new or
  changed tendency. A tendency needs at least two decisions or projects behind it.

**The save always takes two dispatches**, because the agent cannot talk to the user:
1. **Propose:** dispatch `profile-updater` normally. It returns the entry it would write and
   writes nothing.
2. Show the entry to the user as a plain sentence and wait for the answer.
3. **Save:** only if the user agreed, dispatch a **fresh** `profile-updater` (a new Agent call, not
   `SendMessage` to the first one) with `mode: save`, the exact approved entry, and the user's own
   words quoted verbatim.
- If the user declines or says "not now", write nothing and don't ask again in this session.
- **You never write `profile.json` yourself** — not even when the agent's write fails. In that case
  give the user the entry and the permission rule (§5), and move on: planning never depends on the
  Profile.

---

## 5. One friction point at setup

`Read`, `Grep` and `Glob` on a path **outside** the project prompt for permission every time, and
the Profile pass must read the Profile first. `/blueprint` therefore asks once for read/write
permission on `~/.claude/blueprint/`, as a rule in the **user-level** `~/.claude/settings.json`
(the Profile is global). If you notice repeated prompts on that path, the rule is missing: fix the
rule, don't work around it.

The rule is `Read` + `Edit` only — Claude Code matches every file-editing tool (Write included)
with `Edit(...)` rules, and warns that a `Write(...)` rule is never matched:

```json
{ "permissions": { "allow": ["Read(~/.claude/blueprint/**)", "Edit(~/.claude/blueprint/**)"] } }
```

Files under `~/.claude/` may still ask for approval in some modes (a non-interactive session can't
answer it). That is expected: report it, don't work around it.

---

## What NOT to do

- Don't ask "who decides" at the start of every discussion — it was set at brainstorming
- Don't ask it one area at a time — one multiple-choice question for all
- Don't derive `Decided by` from the area's owner — it follows each decision
- Don't write a one-way decision as `Decided by: claude`, and don't relabel reversibility to pass
  the guard
- Don't write a Profile entry, `local-profile.md` or importance as a decision block
- Don't let a `Decided by: claude` decision update the Profile
- Don't let a Claude-owned area use weaker reasoning than a discussion with the user would
