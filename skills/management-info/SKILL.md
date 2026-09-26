---
name: management-info
description: "Create or update management-info.md — encode top-down rules and preferences as locked atoms"
---

# Management-Info

Use this skill when a manager or tech lead needs to set binding constraints or starting preferences for a Blueprint-managed project.

## What it does

Converts plain-Markdown management input (`management-info.md`) into locked atoms:
- **Rules** (binding) → become `status: locked` atoms (enforceable, checked by Review)
- **Preferences** (defaults, can be overridden) → stay as reference text, never atoms

The file lives at `vault-<project>/management-info.md`, authored in plain Markdown, and is compiled into locked atoms by vault-architect.

## When to use

- **Project setup:** Manager sets binding constraints ("always JWT", "Anthropic, not OpenAI")
- **Mid-project:** Tech lead adds new rules or preferences
- **Policy change:** Manager updates constraints as needs shift

## How to write management-info.md

```markdown
# Management Info

## Rules (binding, cannot be overridden in discussion)

- Always use JWT for authentication
- Use Anthropic API, not OpenAI
- Database must support transactions

## Preferences (non-binding defaults, starting suggestions)

- We lean cost-sensitive over maximum scalability
- Prefer managed services where the cost is close
- When in doubt, choose the simpler solution
```

**Section headings matter:**
- `## Rules` → compile to `status: locked` atoms
- `## Preferences` → reference text only (never atoms — they're suggestions, not decisions)

Each bullet becomes one atom (for Rules) or one preference entry (for Preferences).

## Key mechanics

### Rules are real decisions
A locked Rule:
- Appears in the constraints digest (injected at session start)
- Blocks conflicting alternatives during discussion (shown but flagged "blocked by management-info")
- Triggers Review checks the same way any atom does
- Counts as decided — no discussion can override it

### Preferences are suggestions, not decisions
A preference:
- Never written as an atom (would corrupt the compiled atom index)
- Visible as context during discussion
- Can be silently overridden by discussion outcomes
- Used as starting guidance, not enforcement

### Conflicts are shown, not hidden
When discussion hits a locked Rule:
- Conflicting options still appear in alternatives
- Marked "blocked by management-info"
- Rejected field records: "OAuth — blocked by management rule"
- Keeps the rationale visible (why was this option ruled out?)

Hard-blocking would hide the option, leaving no trace. This way, someone reviewing later sees what was considered and why it was set aside.

## The conversion process

When you save `management-info.md`:

1. **File-watcher notices the change** (automatic, free — part of PostToolUse hook)
2. **vault-architect reads and interprets** (real reasoning, not mechanical)
   - Maps manager's words onto the controlled vocabulary (axis + choice)
   - Example: "always JWT" → `axis: "authentication method", choice: "JWT"`
   - Needs to understand context ("prefer Postgres where possible" = strong default, not absolute law)
3. **Shows you the interpretation** (before saving)
   - "I read this as: [Rule/Preference]. Is that right?"
   - Prevents silent misinterpretation from poisoning future discussions
4. **Asks for rationale on Rules** (optional if missing)
   - Prompted but not required (avoids junk rationales written just to satisfy the check)
5. **Writes atoms if confirmed** (same flow as any other atom, Review checks fire)

## What NOT to do

- Don't hand-write JSON — write plain Markdown only
- Don't put preferences into Rules section (they're suggestions, not locked)
- Don't write overly broad rules ("no closed-source software" when you meant one specific vendor)
- Don't expect hard blocks — options appear marked as blocked, not disappear silently
- Don't assume rationales aren't needed — they're optional but prompted

## Example

```markdown
# Management Info

## Rules

- Always use PostgreSQL for persistent data storage
- API authentication must use JWT with RS256 signature
- All customer data encrypted at rest (AES-256)

## Preferences

- Prefer open-source libraries over proprietary equivalents
- Cost-sensitive — prefer spot instances and auto-scaling
- Minimize external vendor lock-in where practical
```

**Result:**
- Three locked atoms (Rules) appear in constraints digest and block conflicting choices
- Three preferences sit as context, available but not enforced
- During discussion, if someone proposes MySQL, it appears "blocked by management-info: always PostgreSQL"
- That option is not hidden; the rationale is visible in the rejected field

## After editing

Once `management-info.md` is saved, vault-architect:
1. Converts Rules to locked atoms
2. Logs Rules to the audit file
3. Injects Rules into the constraints digest (shown at session start)
4. Prefers appear as reference text (not atoms)

Next session, `/blueprint` or any topic-discussion will see these Rules active.

---

## Technical notes

**Per-project only:** No company-wide management file. User-Agent's global Profile is separate (company-wide, per-Claude, learned).

**Conversion is one of vault-architect's jobs:** Not a separate agent or step. Same writer, same atomic action (write + cleanup together).

**Same review checks apply:** A Rule is just an atom with `status: locked`. Review's conflict check (same axis, different choice → conflict) catches violations automatically — no new logic needed.
