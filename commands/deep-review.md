---
description: Opt-in, expensive semantic review of a foundation area, contract or section (or the whole vault) — catches meaning-level contradictions the free deterministic checks cannot see
---

# /deep-review

<!--
Header comment: Blueprint's opt-in semantic review command (v3). It dispatches fresh-context
agents that read the decision blocks of blueprint/vault/ and the surrounding prose together. The
deterministic checks run by the file-watcher hook cover only structural issues; this covers
meaning.
-->

Run an expensive semantic review of the decision vault (`blueprint/vault/`, or a legacy
`vault-<project>/` folder) when certainty matters more than token cost. A project without a vault
has nothing to review here: say so in one line.

## How to use

```
/deep-review [AREA, CONTRACT or SECTION name]
```

- **With a name:** reviews that one and everything it links to.
- **Without a name:** reviews the whole vault (expensive — before a big milestone).

## What it checks

Fresh-context agents read the decision blocks and the prose of `blueprint/vault/foundations/`,
`contracts/` and `sections/` together, looking for:
- **paraphrase-level contradictions:** a block says X, the prose says or implies Y;
- **unsupported claims:** prose stating something no decision backs;
- **cross-area contradictions:** a section assumes X about a contract or foundation that decided
  otherwise;
- **missing reasons:** decisions with a thin `Why`, especially one-way ones;
- **details that should be foundations:** a `--details.md` decision that other sections actually
  depend on.

Findings are explained to the user in plain words; the user decides what changes.

## Contrast with the automatic checks

- **Automatic** (file-watcher hook, free, always on): structural only — unknown ids, same question
  answered differently, the same value answering two questions, dangling links, unreadable blocks.
- **`/deep-review`** (explicit, on demand): meaning-level issues. Run before releases or before a
  change that touches many sections.
