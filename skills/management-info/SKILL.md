---
name: management-info
description: Create or update management-info.md (project rules and preferences) and _doc-rules.md (how to write the docs). Rules become decision blocks marked Decided by rule; preferences stay reference text.
---

# Management-Info

<!--
Header comment: Blueprint v2's channel for top-down project rules. The human-authored
management-info.md stays plain Markdown; each binding Rule is written by the main session as a
decision block with `Decided by: rule` in the area it governs, so the hooks derive a `locked` atom
from it. Also owns _doc-rules.md, the project's rules on how the vault itself is written (C-08).
-->

Use this skill when someone sets binding constraints or starting preferences for a Blueprint
project, or rules on how its documentation must be written.

## Two files, two jobs

| File | Holds | Becomes decisions? |
|---|---|---|
| `management-info.md` | rules and preferences about **what** to build | Rules: yes. Preferences: no |
| `_doc-rules.md` | rules about **how the vault is written** ("every external API gets an error-code table", "write the vault in Italian") | Never |

## `management-info.md`

```markdown
---
tags: [index]
---

# Management Info

## Rules (binding)
- Always use JWT for authentication
- Database must support transactions

## Preferences (starting suggestions)
- We lean cost-sensitive over maximum scalability
- When in doubt, choose the simpler solution
```

- `## Rules` → each bullet becomes one decision block, `Decided by: rule`.
- `## Preferences` → reference text read during discussions. Never a decision: a discussion may
  override a preference.

## Converting a rule

You are the only writer. When `management-info.md` changes:

1. **Interpret.** Map each rule onto a question id and a choice ("always JWT" → `auth-method`,
   `JWT`). Reuse an id from `Vocabulary/registry.json` when one fits.
2. **Show your reading before saving:** "I read this as a binding rule: authentication always uses
   JWT. Right?" A misread rule poisons every later discussion.
3. **Ask for the reason** if it's missing. Prompted, not required.
4. **Write the block** in the area it governs (`foundations/AUTH/AUTH.md`). A rule with no matching
   area goes to `foundations/PROJECT-RULES/PROJECT-RULES.md`. Register a new id first.

```markdown
### auth-method — Which authentication method does the system use?
- **Choice:** JWT
- **Reversibility:** one-way
- **Decided by:** rule (2026-11-04)
- **Rejected:** server sessions — excluded by management rule; OAuth-only — excluded by management rule
- **Why:** company-wide standard set by management
```

A rule is always `one-way`, so it needs `Rejected`: list what the rule excludes, or write "any
other option — excluded by management rule".

5. **Read the `[Blueprint]` messages.** The conflict check flags any existing decision that
   contradicts the rule; explain it to the user in plain words and let them decide.

## How rules behave in discussions

- A rule counts as decided: no discussion overrides it.
- Options that conflict with a rule are **still shown**, marked "blocked by a project rule", and
  recorded in `Rejected` with that reason. Someone reading later sees what was set aside and why.
- One-way rules appear in the session-start digest.

## `_doc-rules.md`

Plain Markdown, one rule per bullet, frontmatter `tags: [index]`. Written by the user, or by you
when the user says "from now on, always …" about the docs. Read it before every vault write.

A global version can exist at `~/.claude/blueprint/doc-rules.md` for rules valid in every project.
When both exist, the project file wins on conflicts.

## What NOT to do

- Don't put preferences in the Rules section.
- Don't write a rule broader than the user meant ("no closed-source software" when they meant one
  vendor). Ask.
- Don't hide conflicting options: show them as blocked.
- Don't turn `_doc-rules.md` into decisions.
