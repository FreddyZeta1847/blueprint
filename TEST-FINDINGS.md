# Blueprint plugin — live test findings

Each entry is something the side-project Claude did that goes against Blueprint's intended design.
We use this list to fix the plugin and test again.

**Categories**
- **PLUGIN**: a skill, agent, command or hook is wrong or unclear. Fix it in this repo.
- **ENV**: the machine setup interferes (global CLAUDE.md, other plugins, permissions).
- **HARNESS**: the test setup itself caused it. Not a plugin bug.
- **MODEL**: the plugin text was clear, but the model still misread it.

**Status:** OPEN · FIXED (commit) · WONTFIX (reason)

---

## Run 5 — 2026-11-06, Blueprint 3.0

Setup:
- plugin 3.0 from the `feat/blueprint-v3` worktree (uncommitted), loaded with `--plugin-dir` into a
  separate test repository (`blueprint-test`);
- sessions run with `claude -p`, prompt passed through stdin; a simulated persona answered as the
  user;
- three scenarios: **T1** a new project (padel court bookings, empty repo), **T2** a running
  project plus one task (sync a notes app between PC and phone), **T3** a running project plus
  four tiny changes;
- about **$9** of tested sessions plus about **$2.5** of persona. Hook unit tests: 65/65 at the
  time of the run.

### The plans

| Scenario | Expected | Result |
|---|---|---|
| T1, new project (7 turns) | a plan with many stages, contracts before parallel work | ✓ **7 stages**: base choices (discussion) → contracts and data (discussion, API contract included) → base: data, API and login (implementation, sequential on purpose) → frontend, admin area and emails (implementation, **`independent_parts`: the three parts, in parallel on the stage 2 contract**) → publishing (implementation) → checks (verification) → demo to the club president (delivery, deadline) |
| T2, running project + one task (7 turns) | Discovery, then a short plan on the foundations | ✓ Discovery proposed first, then **3 stages**: foundations (discussion) → sync and phone (implementation, `independent_parts`: sync and UI, in parallel after the stage 1 contract) → verification |
| T3, tiny changes (4 turns) | no plan | ✓ **No plan, no card, no `blueprint/` folder**, four changes in four turns |

### What worked

| # | What happened | Evidence |
|---|---|---|
| R5-01 | **Context in T1:** the 10 answers in 4 turns, two questions at a time, multiple choice with a recommendation. Discovery skipped (empty repo), pace derived ("steady: the app must last years, the demo is a soft milestone"), the user's correction on risk (high → medium) accepted, the card written and the plan held until "confermo" | T1 turns 1–4 |
| R5-02 | **Parallel work planned as designed:** contracts discussed first (stage 2), independent parts recorded (stage 4), and the session explained why stage 3 is *not* parallel | T1 plan |
| R5-03 | **Stage opening in T1:** the 4 topics, the loop's phases, which optional phase it would use (the probe only for hosting, "to see what a free plan really offers") and how it would work; then it waited for the OK | T1 last turn |
| R5-04 | **Vault** created in `blueprint/vault/` because the card asked for one | T1 |
| R5-05 | **Discovery in T2** found on its own that the notes live only in the PC browser, that the phone cannot reach them and that the To-Do screen is an empty placeholder. It advised an Export first as a safety net, asked only what the code could not answer (timing, constraints, roles, documentation), proposed a vault and accepted "the card is enough" | T2 turns 1–4 |
| R5-06 | **T2 stayed short:** the unfinished To-Do screen was left out of the plan, as the user asked, with an offer to add it later as before → after. At the opening it said which topics would use the probe phase and why | T2 |
| R5-07 | **T3, a "tiny" request that was not tiny:** the to-do list code did not exist, so the session said so, did not widen the work silently, and offered two ways forward | T3 turn 3 |
| R5-08 | **Hooks live on the T1 plan:** orientation in 3 lines with the "not opened yet" instruction ✓; an implementation stage moved straight to `test` denied ("the mandatory phase "plan" comes first") ✓; an unknown stage type denied, with the valid types ✓; an optional phase skipped without a reason denied, with a reason allowed ✓; a discussion stage marked done without decisions ✗ accepted (R5-09) | scripted payloads |

### Problems

| # | Category | Problem | Status |
|---|---|---|---|
| R5-09 | PLUGIN | A discussion (or verification) stage could be marked `done` with no topic decided: the guard checked each topic's phase, not that every topic was closed | **FIXED:** such a stage is done only when every topic is done or carries `"postponed": "<reason>"`; test added, `create-plan` updated |
| R5-10 | PLUGIN / MODEL | **Steps vs phases.** In the T1 delivery stage Claude listed "Rehearsal, Demo, Feedback" as its steps: those are the delivery phases. In single-part stages (publishing, a quick task) the steps added nothing | **FIXED (decision S-14):** plan steps renamed **topics**; required (at least one) in `discussion` and `verification`, optional in `implementation`, `delivery` and `quick_task`. The plan-guard now refuses the old `steps` field, a topic named like a phase of its stage type, and independent parts that are not topics. `create-plan` gained the topic rules and stage-count guidance (a full project usually lands around 8–12 stages; fewer → check that no stage is too big) |
| R5-11 | ENV | In T3 Claude loaded no Blueprint skill and made the colour change without the one-line confirmation. Without a plan the orientation hook is silent, so nothing points to `using-blueprint`. It also quoted "the plan decided with Blueprint", inferred from an old code comment and the global CLAUDE.md | OPEN — the outcome (no plan) is right; the confirmation line belongs in the user's CLAUDE.md, not in Blueprint |
| R5-12 | PLUGIN | The plan-guard reports one problem per stage at a time: a stage moved from `todo` to `test` is first refused for the missing skip reason of `clarify`, then, once fixed, for the missing `plan` phase. It works but costs an extra attempt | OPEN (minor) — could list every problem at once |
| R5-13 | MODEL | Load order: on the first message the session ran `/blueprint`, then `get-context`, and only then `using-blueprint` (which should come first). No visible effect | OPEN (note) |
| R5-14 | ENV | The global CLAUDE.md still describes the old flow ("Blueprint plans everything, then superpowers"). It did not interfere | OPEN — to update in the user's CLAUDE.md |

### Not exercised

- phases moving during real work (each run stopped at the opening of the first stage);
- a re-planning (a moved deadline) and a quick-task stage;
- the hand-off to the user's own implementation tooling;
- a check that `context.md` holds all 10 answers: in the spec, not built, so today only the skill
  guarantees it;
- the `Stage` field of vault decisions, live (built and unit-tested only);
- the topics rename itself (S-14) was verified by the hook unit tests only (68/68), not live.

---

## Run 4 — 2026-11-04 (night), verification of the run 3 fixes, Italian vault

Setup:
- same harness as run 3, in a fresh side project (`blueprint-side-v3`);
- the persona spoke Italian, same Vertigo project;
- 7 turns, **$1.91**;
- stopped after two foundation areas: CLOUD-DATI (user-owned) and CI-CD (Claude-owned).

| # | Check | Result |
|---|---|---|
| R4-01 | Vault in the user's language | ✓ Every file in Italian: headings, prose, block keys (`Scelta`, `Reversibilità`, `Deciso da: utente`). File/folder names, tags and ids stay English. The hooks read it (`utente` → ratified) |
| R4-02 | Code with the vault (R3-18) | ✓ Code hosting was raised as a one-way decision; its `Perché` says the code stays with the vault in the same repository |
| R4-03 | Reversibility (R3-20) | ✓ CLOUD-DATI: 7 one-way, CI-CD: 3 one-way, all confirmed by the user; every Claude detail carries "two-way: …" in its `Perché` |
| R4-04 | Claude-owned area | ✓ The 3 one-way choices went to the user, 8 two-way details went to `CI-CD--details.md`, and Claude announced the revision of one of its own CLOUD-DATI details |
| R4-05 | Profile (R3-19) | ✓ `profile-updater` ran in propose mode; nothing to save; no write attempted by the main session. The save dispatch itself was not exercised |
| R4-06 | Permission snippet | ✓ `Read` + `Edit` only |
| R4-07 | Ambiguity | ✓ The session asked what "anche dopo" meant instead of guessing; ✗ it took "pensavo Azure" as a fixed constraint until corrected (minor) |
| R4-08 | Proposal length (R3-22) | ~ Still ~45 lines for 4 real choices + details (target ~25) |
| R4-09 | Filler (R3-23) | ~ One line per finished specialist report ("non ti scrivo finché…") |
| R4-10 | Entry step, small request that does **not** touch the foundations (fresh session: "full classes shown in grey") | ✓ "It does not touch the foundations: a visual detail inside PRENOTAZIONI". It noticed there is no code yet, offered to record the choice, then went back to the path. ✗ For a colour it still showed a 3-option table: more discussion than a two-way detail needs |
| R4-11 | Entry step, small request that **does** touch the foundations (fresh session: "add the members' phone number") | ✓ "Yes, it touches the foundations, in one point". It folded the point into the AUTH discussion already planned instead of opening a new one, named the one-way part (number format, who can see it), flagged the privacy angle and left SMS out of scope. ~ It did not mention the minors (whose contact is the guardian's) |
| R4-12 | Environment | Every session wastes one call: chained Bash commands rewritten by the RTK hook need approval in `-p`, so it falls back to Read/Glob. Not a Blueprint issue |
| R4-13 | **Discovery** on a real codebase (copy of the run-2 notes/to-do app, vault removed, nothing explained) | ✓ Same logic as the foundations. Output: git baseline (no `main`, so it used `master`, and kept the branch work as the user's own); 4 foundation areas, 2 contracts, 3 sections; 27 blocks, all `scoperta`/`ereditata`, files tagged `needs-review`, written in Italian. It asked which external systems exist and who decides each area, with a recommendation, and noticed that the old vault was missing. When git commands were denied, it read `.git/refs` directly |
| R4-14 | **All hooks, live**, on a copy of the Discovery vault (realistic payloads) | ✓ 16/16: SessionStart (770 chars); atoms derived for all 9 units; conflict across units; unreadable block; unknown `Usata da`; id missing from the registry; guard denies one-way + `claude`, allows `utente`, denies an Edit that flips to `claude`; full-rewrite and Bash writes both reach `_full-context.md`; no false alarm on `docs/`; Stop blocks once, is silent for the same changes and when `stop_hook_active` is set; malformed input exits 0 |
| R4-15 | **One-way guard in a real session** (`-p`, acceptEdits, asked to Write a one-way block `Deciso da: claude`) | ✓ Blocked by `PreToolUse`. The file was not created, and the session quoted the hook message and explained it in plain words |
| R4-16 | Bug found by R4-14 | A section's **two-way** decision that re-decided a foundation question (same id, different choice) escaped the conflict check: the checks only saw foundation, contract and one-way atoms. **FIXED:** the conflict check also sees any decision that answers a question already settled in a foundation or contract. Two-way details clashing only with each other stay out. Test updated and added |

---

## Run 3 — 2026-11-04, plugin 2.0.0 (uncommitted), REAL environment, Sonnet 5.5 headless

Setup:
- side project `blueprint-side-v2` (empty git repo, outside this folder);
- Blueprint installed from the directory marketplace at project scope, and the session loaded 2.0.0;
- real environment: global CLAUDE.md, superpowers 7.0.0 and the other plugins on;
- `claude -p --resume`, `acceptEdits`, the CLI's default model (Sonnet 5.5);
- the persona ("Vertigo", booking site for a climbing gym: frontend, backend, DB, login, CI/CD,
  cloud) was played by the coordinator session through a relay script (persona notes kept outside
  the project);
- 18 turns, **$8.04**.

Harness limits:
- `AskUserQuestion` does not exist in `-p` mode, so the plain-text fallback is what got tested;
- WebFetch/WebSearch must be pre-allowed (`--allowedTools`); from turn 7 they were, standing in
  for the user approving the prompt.

### What worked

| # | What happened | Evidence |
|---|---|---|
| R3-01 | `/blueprint` built the v2 vault exactly as spec A1: versioned, with the vault `.gitignore` covering only derived files | turn 1 |
| R3-02 | **Brainstorming stopped at every phase** (C-06 fixed). Each phase was a separate turn: questions → division → who decides → path | turns 1–5 |
| R3-03 | **Multiple choice at every fork, in the text fallback, always with a recommendation** (C-14). Covered: MVP split, who decides (one numbered question for all areas), path order | turns 2–4 |
| R3-04 | **Division output:** 5 foundation areas (including the BOOKINGS-API contract), 5 sections with MVP, Mermaid graph, importance. Merges were explained out loud | turn 2 |
| R3-05 | **Path in mode B:** discussion and build steps alternate, each build step with its profile (backend/frontend) and runner (session/mother) | turn 4 |
| R3-06 | **Specialists first in every discussion, 1–2 depending on importance.** Each discussion ended in ONE combined proposal, with the specialists' disagreement stated | turns 6–7, 11–12, 15–17 |
| R3-07 | **Objection relayed to the specialist** (`SendMessage`), who redid the pricing from Azure's official price list. "Can I change this later?" was answered in plain words | turn 8 |
| R3-08 | **Online research when allowed (C-10).** When it was denied, the session refused to invent prices and asked how to proceed | turns 6–7 |
| R3-09 | **Hierarchy is visible:** user decisions in `AREA.md`, Claude's in `AREA--details.md` (tag `details`), and `_architecture.md` shows each area's status. All 6 one-way decisions sit in the main files, decided by the user | vault |
| R3-10 | **Decision blocks** in A2 format. Registry was updated before every write. The hook derived 70 atoms. `_audit.md` logged 42 entries, revisions included as "changed". "✓ Locked" only came after the writes | turns 10, 14, 16, 17 |
| R3-11 | **Additions and revisions (C-07):** "the previews touch CLOUD, add it there?". The DB specialists found a mistake in a decision already locked in CLOUD (previews would have copied the real members' data), and the session asked permission before revising it | turns 11–14 |
| R3-12 | **Gap found:** no area decided the API language, so the session proposed a STACK area and added it | turn 12 |
| R3-13 | Reordering the path and moving an area to Claude (BOOKINGS-API) both handled, through `user-agent` | turns 11–12 |
| R3-14 | "Build now or discuss the next one?" at the end of every step | every lock |
| R3-15 | **Stop hook:** a source file changed, so the hook blocked once and the session asked "did this change the foundations?", with what to answer in both cases | turn 18 |
| R3-16 | No production code written. The persona's feedback "it's long to read" was taken on board: the next proposals were short | turns 13, 16 |
| R3-17 | A specialist found instructions inside a tool result, ignored them, and the session reported it | turn 11 |

### Problems

| # | Cat | What happened | Expected | Fix direction | Status |
|---|---|---|---|---|---|
| R3-18 | PLUGIN 🔴 | In CI-CD (an area Claude owned), Claude decided "the code lives in a **separate** GitHub repository, not with the vault" | The vault lives in the same repo as the code: worktrees and children only see the vault that way (P1) | Fixed rule in `using-blueprint` + `docs-management`: the vault is part of the code repo. A decision that moves the code away from the vault is one-way, so it comes back to the user | FIXED — hard rule 6 + docs-management; run 4: code stays "together with the vault in the same repository", raised as one-way |
| R3-19 | PLUGIN | Profile save broken. `profile-updater` correctly refused a confirmation relayed by the main session. The main session then tried to write `profile.json` itself and was blocked as a sensitive file | The user's confirmation reaches the Profile write in a valid way | Show the entry to the user and get the OK **before** dispatching, then pass the user's own words in the brief. The main session never writes the Profile. Also fix the suggested permission snippet: the CLI warns that `Write(...)` rules are not matched and only `Edit(...)` rules count | FIXED — two-dispatch save, agent never asked to relay, Read+Edit snippet; run 4: propose dispatch ran, nothing to save (save path not exercised live) |
| R3-20 | PLUGIN (design) | Reversibility judged very generously. CLOUD: everything two-way "if the portability rule holds". BOOKINGS-API: everything two-way. The one-way guard never fired live, because no one-way decision ever landed in a Claude-owned area | Foundation and contract decisions get an explicit one-way/two-way justification | Topic for the user: e.g. in a Claude-owned area, foundation/contract decisions labelled two-way must say *why* in the summary. Guard behaviour is still covered by the unit tests | FIXED — concept 7 test + one-line reason for every two-way foundation decision; run 4: 10 one-way decisions in CLOUD-DATI/CI-CD (vs 0 in run 3 CLOUD), every detail carries "two-way: …" |
| R3-21 | PLUGIN (minor) | Hook unit naming: `contracts/BOOKINGS-API--details.md` became its own unit (`contracts/BOOKINGS-API--details`) instead of joining `contracts/BOOKINGS-API` | A contract's details file belongs to the contract's unit | `hooks/lib/vault.js`: strip `--details` when mapping contract files to units | FIXED — unitOf strips `--details`; unit test added |
| R3-22 | PLUGIN (minor) | The first DB proposal was about two pages long. It improved after the persona complained | A short proposal by default | `topic-discussion`: length guidance (e.g. ~25 lines; details as one compact list) | PARTLY FIXED — ~25-line guidance; run 4 proposals still ~45 lines |
| R3-23 | MODEL (minor) | Filler messages while specialists ran in the background ("report X arrived, waiting for Y"), as in R2-08 | One message, when the combined view is ready | Already in the skill. Keep watching | OPEN (minor) — guidance strengthened; run 4 still posts one line per finished report |
| R3-24 | DOC | `/blueprint` is not a command name in CLI 2.1.303: it is `/blueprint:blueprint`. The session worked it out by itself | README and skills name the real command | Update README / command docs | FIXED — README and command name `/blueprint:blueprint` |
| R3-25 | ENV / design | The vault prose was written in English while the user spoke Italian | — | Ask the user: default vault language = conversation language, or keep English unless `_doc-rules.md` says otherwise | FIXED — vault written in the user's language (docs-management §4b), Italian keys and `Deciso da` values accepted by the hooks; run 4 vault fully Italian |
| R3-26 | HARNESS | `claude.CMD` (the Windows npm launcher) cut `-p` arguments at the first newline. The rest of the message and every later flag (`--resume`, `--permission-mode`) were lost silently | — | Relay now sends the message through stdin | FIXED in harness |
| R3-27 | HARNESS | The CLI was logged out (`claude auth status` → `loggedIn: false`); the user logged in again | — | — | — |

**Not exercised:**
- one-way guard live (unit tests only);
- Discovery (empty repo);
- the section discussions;
- `/deep-review` and engineering sheets;
- a real build step and mother/children.

---

## Run 1 — 2026-09-27, Haiku 4.5, first attempt (13 disconnected sessions)

| # | Cat | What happened | Expected | Cause | Status |
|---|---|---|---|---|---|
| R1-01 | PLUGIN | Claude listed the decisions as "atoms" (choice / rejected / reversibility) and asked the user to confirm them | The user never sees atoms, only a plain decision summary | `docs-management:242`, `user-agent:55-61,77-79` and `vault-architect.md:61-63` all said "show the atoms to the user" | FIXED 32509e4 |
| R1-02 | PLUGIN | Specialists were not dispatched when STORAGE opened. One was dispatched later, and only through the global agent-coordinator | Dispatching specialists is the first action of every feature/sub-feature | No explicit "dispatch first" rule. The loop was capped at propose once / validate once. Single-file features skipped the diverge step | FIXED 32509e4 |
| R1-03 | PLUGIN | Nothing stopped planning from turning into coding | Planning never writes code; stop when the queue is empty | No rule anywhere. `feature-detection:40` said "just normal coding" | FIXED 32509e4 |
| R1-04 | PLUGIN | The SessionStart output (9.8 KB) was saved to a file. The model saw only a 2 KB preview and never got the rules or the "run /blueprint" line | Key rules fully visible | `hooks/orientation.js` printed the whole using-blueprint skill | FIXED 32509e4 (now ~3.7 KB JSON) |
| R1-05 | PLUGIN | `/blueprint` tried to build folders with mkdir, brace expansion and PowerShell script blocks. All were blocked | Build the vault with the Write tool only | `commands/blueprint.md` said nothing about how to create the files | FIXED 32509e4 |
| R1-06 | ENV | It proposed "the five default sub-features", used `.claude/current-task.md`, `tree.md`, the global `setup` skill and agent-coordinator | Blueprint's own flow | The global `~/.claude/CLAUDE.md` holds an older copy of the Blueprint method | WORKAROUND for run 2: global CLAUDE.md emptied (backup in `.claude/global-CLAUDE.backup.md`) |
| R1-07 | ENV | `superpowers:brainstorming` ("You MUST use…") competes with `blueprint:brainstorming` | Blueprint's brainstorming | Same skill name, and much stronger wording | WORKAROUND for run 2: superpowers disabled. The plugin's brainstorming description was also made stronger |
| R1-08 | ENV | Same-named global skill `docs-management` and global agent `vault-architect` sit next to the plugin's | Only the plugin's | Name collision | OPEN — the plugin now uses `blueprint:` names everywhere. Renaming is still worth considering |
| R1-09 | HARNESS | Git Bash turned `/blueprint` into `C:/Program Files/Git/blueprint`; one `cd` failed and ran in the wrong repo | — | Test driver | Fixed in harness (PowerShell + stdin) |
| R1-10 | HARNESS | Each call was a new session with no memory, and every write was refused (no permissions) | — | Test driver | Fixed in harness (`--resume`, `--permission-mode acceptEdits`) |
| R1-11 | HARNESS | The driver put "atoms", "manual mode" and "topic-discussion" into the user's messages, and the persona file inside the project revealed it was a test | — | Test driver | Fixed in harness (persona outside the project, relayed word for word) |
| R1-12 | PLUGIN | The plugin cache copies git-ignored private files (`vault-blueprint/`, `.claude/`, `.impeccable/`) into every install | Ship only the plugin files | The directory marketplace copies the whole folder | OPEN |

---

## Build run — 2026-09-27, plugin e60f935, REAL environment (global CLAUDE.md + superpowers on)

The user's split: **Blueprint for discussion, superpowers for implementation**, with the vault as the source of truth. A new session (no memory of run 2) builds the APP feature, plus the data module it needs.

| # | Stage | Cat | What happened | Expected | Evidence | Status |
|---|---|---|---|---|---|---|
| B-01 | start | ✓ OK | **The vault worked as the only memory.** A fresh session restated every locked APP and DATA decision from the vault, promised not to re-decide any of them, and asked only about details the vault leaves open. It explicitly separated Blueprint (planning, finished) from superpowers (building) | — | build session 9f714f88, turn 1 | — |
| B-03 | spec | PLUGIN (minor) | The file-watcher counted superpowers' spec document (`docs/superpowers/specs/…md`) as a **source file owned by no feature**, added it to `_index/unassigned.json`, and suggested assigning it | Planning and spec documents are not source code, so the module map should skip them | build turn 5, hook message at transcript line 113 | OPEN: `file-watcher.js` "any other source file" rule needs an ignore list (e.g. `docs/`, `*.md` outside the vault) |
| B-04 | build | ✓ OK | superpowers flow on top of the vault: brainstorming (only the questions the vault left open) → spec → plan → one builder helper plus one checker helper per step. Steps 1–4 were built in 5 small commits, plain HTML/CSS/JS, 24/24 tests pass. The reviewer caught and fixed a real save bug. The server serves JS with the correct MIME type. **Stopped by the user at the step-4 checkpoint** (To-Do and the final check not built) | — | build session 9f714f88; blueprint-side branch `feature/app-and-data` | — |
| B-05 | build | ENV (harmless) | Headless, superpowers couldn't run its helper scripts or read its own prompt templates (outside the project), so it wrote the helper briefs itself. It's the same "rule file outside the project" class of problem as R2-06 | — | build turn 7, transcript lines 176–199 | not a Blueprint issue |
| B-02 | start | ENV (harmless) | It tried `Glob ~/.claude/issues`: the startup routine from the global CLAUDE.md | — | turn 1 permission denials | expected with the real environment |

## Fixes applied after run 2 (to verify in run 3)

| Finding(s) | Fix | Where |
|---|---|---|
| R2-19, R2-21 | "✓ Locked" only **after** vault-architect's report confirms every write. The save is a fresh, foreground `Agent` call (no SendMessage to an old agent, no background). A blocked write means: ask the user, then re-send the whole save | `topic-discussion` step 5; `user-agent` §2 |
| R2-20, R2-26 | Status is set **per decision** from a mark the main thread passes (`confirmed` → `ratified`, `agent-decided` → `agent-approved`), never from the topic's mode | `topic-discussion` step 5; `vault-architect.md` step 4; `user-agent` §2; `docs-management` lock sequence |
| R2-13, R2-27 | vault-architect never acts on hook messages. It copies them verbatim into a mandatory final report (writes saved/BLOCKED, hook messages, not done). The main thread explains them and the user decides first | `vault-architect.md` (new "report, never resolve" and "Final report" sections); `docs-management` findings rule; guard's deny message |
| R2-12 | New questions are registered in `registry.json` **before** `atoms.json` is written. The vocabulary check still catches misspelled ids | `vault-architect.md` step 5; `docs-management` lock sequence |
| R2-06 | Agents preload their rule-book skill (`skills: [blueprint:…]` frontmatter, per the Claude Code docs), with the Skill tool as fallback. They never Read the plugin folder. **To verify:** whether the namespaced name resolves (the docs don't say) | `vault-architect.md`, `profile-updater.md`, `sheet-designer.md` |
| R2-22 | The one-way guard appends every block to `_audit.md` (unit-tested: 4/4 cases correct) | `hooks/one-way-guard.js` |
| R2-01 | `/blueprint` gets the exact starting content: `{ "entries": [] }` for queue, registry and dismissed | `commands/blueprint.md` |
| R2-03 | The Profile permission goes into the **user-level** `~/.claude/settings.json`; skipped if it's already present | `commands/blueprint.md`; `user-agent` §5 |
| R2-08 | Ask the mode question first and wait for the answer, then dispatch. No "still waiting…" filler | `topic-discussion` Entry |
| R2-10 | The summary holds no decision that wasn't raised in the discussion first | `topic-discussion` step 3 |
| R2-15 | profile-updater: a tendency needs ≥2 decisions/features; at most 1–2 notes per pass | `profile-updater.md` |
| R2-17 | The intro always states whether the feature splits, and why. More than ~8–10 decisions are paced (one-way decisions and real choices first) | `topic-discussion` intro stage |
| R2-23 | Real objections go back to the specialists; trimming scope can be handled directly | `topic-discussion` "What NOT to do" |

Still open: R1-08 (the same-named global skill/agent; the plugin now uses `blueprint:` names, but a rename is still worth considering) and R1-12 (the plugin cache copies private git-ignored files).

## Run 2 — summary (read this first)

**Result:** the pipeline ran end to end in 7 turns (about $11 for the 6 turns whose cost was recorded; turn 6's cost wasn't captured):
- `/blueprint` → brainstorming (2 features) → DATA (hands-on) → APP (assisted) → planning complete;
- 24 decisions locked, all hooks fired, no code written.

**The corrected design mostly holds:**
- no specialists in brainstorming;
- specialists dispatched *first* in every feature;
- plain words throughout, no atoms ever shown;
- the one-way / two-way summary in exactly the intended form;
- planning stopped instead of coding.

**What to fix next (priority order):**
1. **R2-19 🔴** "✓ Locked" was said before the write was confirmed. The write had actually failed.
2. **R2-20 / R2-26** vault-architect picks the status by *mode*, not per decision, so the guard blocks the write every time a user-confirmed one-way decision sits in an assisted topic.
3. **R2-21** A guard block inside the subagent loses the whole write, and nothing tells the user or recovers.
4. **R2-13 / R2-27** Hook findings reach only the subagent, which then settles them itself. The main conversation and the user never see them first.
5. **R2-12** The vocabulary check fails on every new question (circular "register only after the checks pass" rule).
6. **R2-06** vault-architect can't read `docs-management` (outside the project): a prompt or a denial on every vault write.
7. **R2-22** One-way-guard blocks are never written to `_audit.md` (the spec says they should be).
8. **R2-01** `/blueprint` writes a bare `[]` instead of `{ "entries": [] }`.
9. **R2-03** The Profile permission goes into the project settings, so it isn't really "granted once".
10. Minor: R2-08 (mode question after dispatch, plus filler messages), R2-10, R2-15, R2-17, R2-23.

**Not exercised in this run:**
- `/deep-review`, `pre-publish-check` and `engineering-sheets`: offered correctly (ask-first), but the persona declined;
- the discovery path (the repo was empty);
- actually saving the Profile (the permission was never granted);
- a real `AskUserQuestion` call (headless).

---

## Run 2 — 2026-09-27, plugin 32509e4, clean environment, one persistent session

Setup:
- global CLAUDE.md empty, superpowers disabled;
- blueprint-side recreated empty, plugin installed at project scope;
- the side session runs headless (`claude -p --resume`, `acceptEdits`), with the user's default model (Opus 5.5);
- the naive "Fede" persona talks to it through a word-for-word relay.

Harness limits:
- In headless mode `AskUserQuestion` may not be available, so the side Claude has to ask in plain text.
- A permission request (for example the `~/.claude/blueprint/` rule) cannot be answered; it shows up as a denial.

| # | Stage | Cat | What happened | Expected | Evidence | Likely cause | Status |
|---|---|---|---|---|---|---|---|
| R2-00 | bootstrap | ✓ OK | These worked: SessionStart injected 3,754 chars in full (not truncated) · `/blueprint` → `blueprint:using-blueprint` → vault built with Write only → `blueprint:brainstorming` · no specialists · a plain "what is this project?" question · the `~/.claude/blueprint/` permission asked in plain words | — | session 1f1c0291, transcript lines 2–69 | — | — |
| R2-01 | bootstrap | PLUGIN | `/blueprint` wrote `_queue.json`, `Vocabulary/registry.json` and `Vocabulary/dismissed.json` as a bare `[]` | `{ "entries": [] }`, never a bare `[]` (the spec says so explicitly) | the files in `vault-blueprint-side/` after turn 1 | `commands/blueprint.md` lists the files but gives no starting content, except for `ignored-values.json`. `docs-management:494` has the rule, but `/blueprint` never tells Claude to read it | OPEN |
| R2-02 | bootstrap | ✓ OK | The file-watcher leaves no transcript entry when it has nothing to say | — | turn 2: writing `_current-task.md` created `_full-context.md`, the hook's mirror side effect | Silent on no-op, by design | VERIFIED |
| R2-03 | brainstorming | HARNESS / PLUGIN | The `~/.claude/blueprint/` permission rule could not be saved: the Edit to `.claude/settings.json` was denied (protected, even in acceptEdits). Claude handled it well: it explained and gave the snippet | In real use the user approves the prompt | turn 2, transcript line 86–87 | Harness: headless can't approve. **Plugin design point:** the rule goes into the *project* `.claude/settings.json`, but the Profile is global, so every new project asks again. The user-level `~/.claude/settings.json` would really be "granted once" | OPEN (design) |
| R2-05 | DATA · open | ✓ OK | After Fede confirmed the split, Claude said "✓ Locked", then `blueprint:vault-architect` wrote the vault and brainstorming was cleaned up. `blueprint:topic-discussion DATA` → **first action: 2 specialists dispatched** (`database-administrator`, `frontend-architect`) with Fede's own question ("why a server?"). A plain-words synthesis followed: agreement, disagreement, its own pick, then questions. No atoms. The mode question was in plain words ("Hands-on / Assisted"). DATA was judged single-file, with the reason stated | — | turn 3, transcript lines 117–182 | — | — |
| R2-06 | DATA · open | PLUGIN | The `blueprint:vault-architect` subagent was **denied Read/Glob** on `…\blueprint\skills\docs-management\SKILL.md`: the plugin's folder is outside the project. The main thread recovered by loading `blueprint:docs-management` itself and pasting the conventions to the agent via SendMessage | vault-architect reads its conventions with no permission prompts | subagent `agent-a9c0f55f…`, lines 9, 17, 51 | `agents/vault-architect.md:15-22` tells the agent to Read the skill file from the plugin root. For any real install that path is outside the project, so it means a prompt (or a denial) on **every** vault write. Fix: preload the skill via agent frontmatter (`skills:`), or have the main thread pass the conventions | OPEN |
| R2-07 | DATA · open | HARNESS | Headless `-p` returns only the **last** message of a turn. The mode question and "✓ Locked" were in earlier messages, so they never reached Fede, and the side Claude then said "the earlier question is still open" | A real user sees every message | turn 3, TEXT at lines 135/153/168/174 | Test driver | Fixed in harness: all assistant texts of each turn are relayed, in order |
| R2-08 | DATA · open | MODEL (minor) | The mode question came *after* the specialists were dispatched, not before. While the background agents ran, Claude posted 3 extra "still waiting…" messages | Entry step 1 is the mode question, then dispatch. Fewer filler messages | turn 3, lines 126–174 | `topic-discussion` Entry order was followed loosely. Harmless here, since specialists run in both modes. The filler messages are noise for the user | OPEN (minor) |
| R2-09 | DATA · summary | ✓ OK | The decision summary is in exactly the intended form: "Here's what we decided for Data" + **One-way — hard to change later** (ids, dates, data-module actions) + **Two-way — easy to change later** (storage engine, launch method, backup mode, notes/tasks together) + "Shall I lock these?". No atoms or field names. Hands-on mode waits for confirmation. `_current-task.md` was updated live | — | turn 4, transcript line 209 | — | — |
| R2-10 | DATA · summary | MODEL (minor) | The summary added one decision never raised with Fede before: "the app asks the browser not to auto-delete its data" (persistent storage) | New decisions are raised in the discussion before they appear in the summary | turn 4 | Probably from a specialist report that wasn't relayed in full. Low impact, since the user still confirms the summary | OPEN (minor) |
| R2-11 | DATA · lock | ✓ OK | The lock pipeline works end to end. Fede's question was answered in plain words, then "✓ Locked. Data is done." `blueprint:vault-architect` wrote `features/DATA/DATA.md` + `atoms.json` (8 decisions, each with its rejected alternatives and reasons, 3 one-way, all `ratified`). The PostToolUse file-watcher fired on `atoms.json`: `_index/decisions.json` was compiled and `_audit.md` got 8 entries. The registry was updated and DATA was checked off `_queue.json`. The PROFILE flag led to `blueprint:profile-updater` being dispatched. The user never saw an atom | — | turn 5; vault-architect subagent lines 83–104 | — | — |
| R2-12 | DATA · lock | PLUGIN | The **vocabulary check flagged all 8 new questions** ("axis not registered in registry.json") on the first lock. Every new question will trigger it, every time | A genuinely new question should not look like a vocabulary error | hook message at vault-architect line 88 | Circular design: `docs-management` (lock sequence) and `vault-architect.md` step 5 say "promote the new question into the registry **only after** the three checks pass", but the vocabulary check *fails* exactly because it isn't promoted yet. Fix: register candidates before writing (marked new), or have the check skip questions introduced in the same write | OPEN |
| R2-13 | DATA · lock | PLUGIN | The hook's findings went to the **vault-architect subagent**, which settled them on its own (it promoted the questions). The main conversation and the user never saw them | "Present findings, never resolve on your own": findings should reach the main conversation | hook output inside subagent `agent-a9c0f55f…` | PostToolUse `additionalContext` goes to whoever made the write, and the writer is always the subagent. The profile flag only got through because the agent passed it on. Fix: vault-architect must return every hook finding in its final report, or the checks move to the main thread | OPEN |
| R2-14 | DATA · lock | ✓ OK / ENV | `profile-updater`: its Read on `~/.claude/blueprint/` was denied (the permission from R2-03 is missing). It still proposed 3 tendencies **in plain words** and asked before saving | — | subagent `agent-ac58036…` | Denial comes from R2-03 | — |
| R2-15 | DATA · lock | MODEL (minor) | profile-updater proposed 3 "tendencies" after a single discussion | The agent's own rule is "one instance is rarely a pattern" | turn 5 text line 269 | Over-eager | OPEN (minor) |
| R2-16 | APP · open | ✓ OK | APP opened by **dispatching specialists first** (`ui-designer`, `frontend-architect`). A plain-words proposal followed, with the one choice that's hard to change later named, and questions for Fede | — | turn 5, lines 231–264 | — | — |
| R2-17 | APP · open | PLUGIN (minor) | APP's intro never said whether APP splits into sub-features. It went straight to a long, detailed proposal (≈25 decisions at once) | The intro states the split decision. Decisions stay digestible for a non-expert user | turn 5, text at line 264 | `topic-discussion` intro stage: "whether it naturally splits" is asked of the specialists, but nothing says to *state* the result to the user, or to pace a large feature | OPEN (minor) |
| R2-18 | APP · lock | ✓ OK | **The one-way guard fired live.** Under assisted mode, vault-architect tried to write `page-structure` (one-way) as `agent-approved`. `hooks/one-way-guard.js` (PreToolUse) **blocked it**: "Blueprint one-way floor: blocked an agent-assist lock on `page-structure`…" | — | vault-architect subagent line 121–122 | — | — |
| R2-19 | APP · lock | 🔴 PLUGIN | **Claude told the user "✓ Locked… Planning is complete. I won't start writing code" while APP was never saved.** It handed the write to the background vault-architect (SendMessage), then ended the turn without waiting for the result. The guard blocked the write, so no `features/APP/` exists and APP is still `pending` in `_queue.json` | Say "✓ Locked" only **after** vault-architect confirms the write succeeded. If a write is blocked, tell the user and resolve it | turn 6: SendMessage at line 294, "✓ Locked" at line 298. Disk: no `features/APP/`, queue still lists APP | `topic-discussion` step 5 says "tell the user only ✓ Locked" but never says *wait for vault-architect's confirmation first*. Headless also killed the background agent at turn end (HARNESS side), but the claim was false either way | OPEN |
| R2-20 | APP · lock | PLUGIN | The one-way decision was written as `agent-approved`, even though the main conversation told the user "you already agreed to this one". A decision the user confirmed should be `ratified` whatever the mode | Status depends on whether *this decision* was confirmed by the user, not only on the topic's mode | guard block, line 122 | `vault-architect.md` step 4 branches on **mode** only. It should branch per decision: confirmed by the user → `ratified`; agent-decided two-way → `agent-approved`. The main thread's brief should also list which decisions the user confirmed | OPEN |
| R2-21 | APP · lock | PLUGIN | The guard blocks the **whole** `atoms.json` write, so every APP decision was lost (including the two-way ones), and no recovery happened | A block triggers a recovery: ask the user about the one-way decision, then rewrite | vault-architect's transcript ends at line 123, just after the block | No recovery step in `vault-architect.md` or `user-agent` for a block raised *inside the subagent*. `user-agent` only covers "if the guard blocks **you**" | OPEN |
| R2-22 | APP · lock | PLUGIN | The blocked write was **not logged** in `_audit.md` | `docs-management:299`: the audit log records "one-way-guard blocked-write events" | `_audit.md` has only the 8 DATA entries; `one-way-guard.js` has no audit code | Spec and implementation disagree | OPEN |
| R2-23 | APP · summary | MODEL (minor) | Fede's objection ("do I really need shortcuts and the private-browsing warning?") was answered by the main thread itself, not taken back to the specialists | Real objections go back to the specialists (the relay loop) | turn 6: no Agent/SendMessage to a specialist | Borderline: a scope trim the main thread can reasonably judge alone. The skill's "don't call specialists for trivial questions" exception leaves room for this | OPEN (minor) |
| R2-24 | APP · end | ✓ OK | "Planning is complete… I won't start writing code until you ask me to." It offered the optional one-page overview (engineering-sheets) *ask-first*. No code files were written anywhere | — | turn 6 line 298; blueprint-side contains only `.claude/` and the vault | — | — |
| R2-25 | wrap-up | ✓ OK | On resume, the side Claude **noticed on its own** that APP was never saved (via the SessionStart state or a Glob). It re-dispatched vault-architect and told Fede honestly: "saving the app's decisions was interrupted the first time, so I re-ran it". Final state is correct: APP has 16 decisions (10 confirmed by Fede → `ratified`, including the one-way `page-structure`; 6 decided by Claude, all two-way → `agent-approved`), 16 APP audit entries, queue empty | — | turn 7; subagent `agent-a1171598…` | — | — |
| R2-26 | wrap-up | PLUGIN | The new vault-architect **repeated the R2-20 mistake**: its first write put the one-way decision as `agent-approved` and was blocked again. It recovered by rewriting as `ratified` | Correct status on the first write | subagent `agent-a1171598…` line 32–33 | Same cause as R2-20 (status chosen by mode, not per decision) | OPEN |
| R2-27 | wrap-up | PLUGIN (minor) | The value-inversion check flagged `not-in-v1` answering 3 questions. vault-architect **settled it by itself** (added `not-in-v1` to `ignored-values.json`) and the user was told only afterwards ("say if you'd rather I handle it differently") | Present the finding in plain words, and let the user decide *before* changing anything | subagent line 66, 74; turn 7 reply | Same root cause as R2-13: the findings arrive inside the subagent, which then acts on them. Adding to `ignored-values` was a sensible fix, but it was taken unilaterally | OPEN (minor) |
| R2-28 | whole run | ✓ OK | **No code was written at any point.** blueprint-side contains only `.claude/settings.json` and the vault | — | file listing after turn 7 | — | — |
| R2-04 | brainstorming | ✓ OK | Brainstorming: no Agent calls, plain words, proposed the *smallest* split (DATA, APP; notes/to-dos merged, with the reason given; LOGIN only if hosted), logged `_current-task.md` live | — | turn 2 | — | — |

