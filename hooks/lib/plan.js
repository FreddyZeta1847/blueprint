/*
 * Blueprint hooks — blueprint/plan.json rules: the stage loops (data/loops.json), the current
 * stage, and the validator behind the plan-guard hook.
 *
 * validatePlan(next, previous, loops) checks the plan as it will be after a write against the
 * plan on disk and returns { deny: [...], ask: [...] } (short messages). The rules (shared
 * interface with the skills, "Rules the plan-guard hook enforces"):
 *   1. shape: version 3, project, stages[]; stage ids kebab-case and unique; type is a loops.json
 *      type; status in the enum; topics have a string name (unique in the stage, never the name
 *      of a phase) and boolean done, and `postponed` is a non-empty reason when present. Topics
 *      are required (at least one) in per_step types and optional in per_stage types (a stage
 *      with a single part has none); the old field name "steps" is refused; every name in
 *      `independent_parts` is one of the stage's topics;
 *   2. phase ids belong to the type's loop (on the stage for per_stage types, on the topics for
 *      per_step types); `skipped` names only optional phases, each with a reason;
 *   3. a phase moves only to the next phase (optional ones in between must be in `skipped`) or
 *      back to the old phase's `back_to`; it is never cleared; in_progress per_stage stages
 *      have a phase. New stages/topics are checked as if they started before the first phase;
 *   4. done (stage, or a per_step topic) only at or after the last mandatory phase; a done
 *      per_step stage has every topic done or postponed with a reason; a done per_stage stage
 *      has every topic done;
 *   5. a stage that was done cannot be changed or removed → ask (the user may have asked);
 *   6. a new stage cannot be created already done.
 *
 * Used by: hooks/plan-guard.js (validator), hooks/orientation.js and hooks/step-close.js
 * (loops, current stage).
 */

const path = require('path');
const { readJson } = require('./common');

const LOOPS_FILE = path.join(__dirname, '..', '..', 'data', 'loops.json');
const STATUSES = ['todo', 'in_progress', 'done', 'postponed'];
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function loadLoops() {
  const loops = readJson(LOOPS_FILE, null);
  return loops && loops.types && typeof loops.types === 'object' ? loops : null;
}

/** The stage being worked on: the first in_progress one, else the first todo one. */
function currentStage(plan) {
  const stages = (plan && Array.isArray(plan.stages) ? plan.stages : []).filter((s) => s && typeof s === 'object');
  const index = [stages.findIndex((s) => s.status === 'in_progress'), stages.findIndex((s) => s.status === 'todo')].find((i) => i >= 0);
  return index === undefined ? null : { stage: stages[index], index, total: stages.length };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';
const label = (stage) => `«${(stage && (stage.name || stage.id)) || '?'}»`;

/** Key-order-insensitive JSON, so reformatting a done stage is not "changing" it. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

// ---------------------------------------------------------------- rules 1 + 2: shape

function checkTop(plan, deny) {
  if (!isObject(plan)) return deny.push('rule 1: the plan must be a JSON object with version, project and stages.');
  if (plan.version !== 3) deny.push('rule 1: "version" must be 3.');
  if (!nonEmpty(plan.project)) deny.push('rule 1: "project" must be a non-empty string.');
  if (!Array.isArray(plan.stages)) deny.push('rule 1: "stages" must be an array.');
  return undefined;
}

/** A topic named like a phase ("Rehearse", "Feedback") is a phase listed by mistake. */
const isPhaseName = (name, loop) => loop.phases.some((p) => p.id.replace(/_/g, ' ') === name.trim().toLowerCase());

function checkTopic(stage, topic, loop, deny) {
  if (topic.postponed !== undefined && !nonEmpty(topic.postponed)) deny.push(`rule 1: topic "${topic.name}" of ${label(stage)}: "postponed" must be the reason, as non-empty text.`);
  if (isPhaseName(topic.name, loop)) deny.push(`rule 1: stage ${label(stage)}: "${topic.name}" is a ${stage.type} phase, not a topic; phases come from the loop, topics are what the stage is about.`);
  if (topic.phase === undefined) return;
  if (loop.cycle !== 'per_step') deny.push(`rule 2: stage ${label(stage)} is ${stage.type} (one phase per stage): put "phase" on the stage, not on topic "${topic.name}".`);
  else if (!loop.phases.some((p) => p.id === topic.phase)) deny.push(`rule 2: topic "${topic.name}": "${topic.phase}" is not a ${stage.type} phase (${loop.phases.map((p) => p.id).join(', ')}).`);
}

function checkTopics(stage, loop, deny) {
  if (stage.steps !== undefined) deny.push(`rule 1: stage ${label(stage)}: "steps" is now called "topics"; rename the field.`);
  if (stage.topics === undefined || (Array.isArray(stage.topics) && !stage.topics.length)) {
    if (loop.cycle === 'per_step') deny.push(`rule 1: stage ${label(stage)} is ${stage.type} (one phase per topic): list at least one topic in "topics".`);
    return undefined;
  }
  if (!Array.isArray(stage.topics)) return deny.push(`rule 1: stage ${label(stage)}: "topics" must be an array.`);
  const names = new Set();
  for (const topic of stage.topics) {
    if (!isObject(topic) || !nonEmpty(topic.name) || typeof topic.done !== 'boolean') {
      deny.push(`rule 1: stage ${label(stage)}: every topic needs a string "name" and a boolean "done".`);
      continue;
    }
    if (names.has(topic.name)) deny.push(`rule 1: stage ${label(stage)}: two topics are named "${topic.name}"; topic names must be unique.`);
    names.add(topic.name);
    checkTopic(stage, topic, loop, deny);
  }
  return undefined;
}

function checkIndependentParts(stage, deny) {
  if (stage.independent_parts === undefined) return;
  if (!(Array.isArray(stage.independent_parts) && stage.independent_parts.every((p) => typeof p === 'string'))) {
    deny.push(`rule 1: stage ${label(stage)}: "independent_parts" must be an array of strings.`);
    return;
  }
  const topics = new Set((Array.isArray(stage.topics) ? stage.topics : []).filter(isObject).map((t) => t.name));
  const missing = stage.independent_parts.filter((p) => !topics.has(p));
  if (missing.length) deny.push(`rule 1: stage ${label(stage)}: independent part(s) ${missing.map((p) => `"${p}"`).join(', ')} are not topics of the stage; each independent part must also be a topic with the same name.`);
}

function checkSkipped(stage, loop, deny) {
  if (stage.skipped === undefined) return;
  if (!Array.isArray(stage.skipped)) return deny.push(`rule 2: stage ${label(stage)}: "skipped" must be an array of { id, reason }.`);
  for (const s of stage.skipped) {
    const phase = isObject(s) && loop.phases.find((p) => p.id === s.id);
    if (!phase) deny.push(`rule 2: stage ${label(stage)}: skipped "${isObject(s) ? s.id : s}" is not a ${stage.type} phase.`);
    else if (!phase.optional) deny.push(`rule 2: stage ${label(stage)}: "${phase.id}" is mandatory and cannot be skipped.`);
    else if (!nonEmpty(s.reason)) deny.push(`rule 2: stage ${label(stage)}: skipped "${phase.id}" needs a non-empty "reason".`);
  }
  return undefined;
}

function checkStage(stage, loops, ids, deny) {
  if (!isObject(stage)) return deny.push('rule 1: every stage must be an object.');
  if (typeof stage.id !== 'string' || !ID_RE.test(stage.id)) deny.push(`rule 1: stage id "${stage.id}" must be lowercase kebab-case (e.g. "demo-frontend").`);
  else if (ids.has(stage.id)) deny.push(`rule 1: stage id "${stage.id}" is used twice; ids must be unique.`);
  ids.add(stage.id);
  if (!nonEmpty(stage.name)) deny.push(`rule 1: stage "${stage.id}" needs a non-empty "name".`);
  if (!STATUSES.includes(stage.status)) deny.push(`rule 1: stage ${label(stage)}: "status" must be one of ${STATUSES.join(', ')}.`);
  if (stage.deadline !== undefined && !(typeof stage.deadline === 'string' && DATE_RE.test(stage.deadline))) deny.push(`rule 1: stage ${label(stage)}: "deadline" must be YYYY-MM-DD.`);
  if (stage.how !== undefined && typeof stage.how !== 'string') deny.push(`rule 1: stage ${label(stage)}: "how" must be text.`);
  checkIndependentParts(stage, deny);
  const loop = loops.types[stage.type];
  if (!loop) return deny.push(`rule 1: stage ${label(stage)}: type "${stage.type}" does not exist; use one of ${Object.keys(loops.types).join(', ')}.`);
  if (stage.phase !== undefined) {
    if (loop.cycle === 'per_step') deny.push(`rule 2: stage ${label(stage)} is ${stage.type} (one phase per topic): put "phase" on each topic, not on the stage.`);
    else if (!loop.phases.some((p) => p.id === stage.phase)) deny.push(`rule 2: stage ${label(stage)}: "${stage.phase}" is not a ${stage.type} phase (${loop.phases.map((p) => p.id).join(', ')}).`);
  }
  checkTopics(stage, loop, deny);
  checkSkipped(stage, loop, deny);
  return undefined;
}

// ---------------------------------------------------------------- rule 3: phase order

function skippedIdsOf(stage) {
  return new Set((Array.isArray(stage.skipped) ? stage.skipped : []).filter((s) => isObject(s) && nonEmpty(s.reason)).map((s) => s.id));
}

/** One phase move (oldPhase undefined = not started yet). `who` names the stage or topic. */
function checkMove(who, oldPhase, newPhase, loop, skipped, deny) {
  if (newPhase === undefined) {
    if (oldPhase !== undefined) deny.push(`rule 3: ${who}: the phase "${oldPhase}" cannot be removed; to redo work, move back to its back_to phase.`);
    return;
  }
  if (oldPhase === newPhase) return;
  const ids = loop.phases.map((p) => p.id);
  const from = ids.indexOf(oldPhase);   // -1: not started (or an unknown old phase)
  const to = ids.indexOf(newPhase);
  if (to < from) {
    const back = loop.phases[from].back_to;
    if (back !== newPhase) {
      deny.push(`rule 3: ${who}: "${oldPhase}" can go back ${back ? `only to "${back}"` : 'to no phase'}, not to "${newPhase}".`);
    }
    return;
  }
  for (const phase of loop.phases.slice(from + 1, to)) {
    if (!phase.optional) {
      deny.push(`rule 3: ${who}: cannot reach "${newPhase}" ${from < 0 ? 'from the start' : `from "${oldPhase}"`}: the mandatory phase "${phase.id}" comes first. Record "${phase.id}" first.`);
      return;
    }
    if (!skipped.has(phase.id)) {
      deny.push(`rule 3: ${who}: the optional phase "${phase.id}" is skipped without a reason; add { "id": "${phase.id}", "reason": "..." } to the stage's "skipped".`);
      return;
    }
  }
}

function checkMoves(stage, before, loop, deny) {
  const sameType = before && before.type === stage.type;
  const skipped = skippedIdsOf(stage);
  if (loop.cycle === 'per_step') {
    const oldTopics = new Map((sameType && Array.isArray(before.topics) ? before.topics : []).filter(isObject).map((t) => [t.name, t]));
    for (const topic of stage.topics || []) {
      const old = oldTopics.get(topic.name);
      checkMove(`topic "${topic.name}" of ${label(stage)}`, old && old.phase, topic.phase, loop, skipped, deny);
    }
    return;
  }
  checkMove(`stage ${label(stage)}`, sameType ? before.phase : undefined, stage.phase, loop, skipped, deny);
  if (stage.status === 'in_progress' && stage.phase === undefined) {
    deny.push(`rule 3: stage ${label(stage)} is in_progress: set "phase" to the phase being worked on.`);
  }
}

// ---------------------------------------------------------------- rule 4: done

function lastMandatory(loop) {
  let last = -1;
  loop.phases.forEach((p, i) => { if (!p.optional) last = i; });
  return last;
}

function checkDone(stage, loop, deny) {
  const ids = loop.phases.map((p) => p.id);
  const need = loop.phases[lastMandatory(loop)].id;
  if (loop.cycle === 'per_step') {
    for (const topic of stage.topics || []) {
      if (topic.done && ids.indexOf(topic.phase) < lastMandatory(loop)) {
        deny.push(`rule 4: topic "${topic.name}" of ${label(stage)} is done before the phase "${need}"; record "${need}" first.`);
      }
    }
    // A per_step stage closes only when every topic is done or postponed with a reason
    // (loops.json done_when: "every topic has a written decision or is postponed with a reason").
    if (stage.status === 'done') {
      const open = (stage.topics || []).filter((t) => !t.done && !nonEmpty(t.postponed));
      if (open.length) {
        deny.push(`rule 4: stage ${label(stage)} is done but topic(s) ${open.map((t) => `"${t.name}"`).join(', ')} are neither done nor postponed; finish them, or add "postponed": "<reason>" to the topic.`);
      }
    }
    return;
  }
  if (stage.status !== 'done') return;
  if (ids.indexOf(stage.phase) < lastMandatory(loop)) {
    deny.push(`rule 4: stage ${label(stage)} is done before the phase "${need}"; record "${need}" first.`);
  }
  if ((stage.topics || []).some((t) => !t.done)) deny.push(`rule 4: stage ${label(stage)} is done but some topics are not; mark every topic done (or keep the stage open).`);
}

// ---------------------------------------------------------------- rules 5 + 6 and the entry point

function checkHistory(next, previous, ask, deny) {
  const nextById = new Map(next.stages.map((s) => [s.id, s]));
  for (const old of previous.values()) {
    if (old.status !== 'done') continue;
    const now = nextById.get(old.id);
    if (!now) ask.push(`rule 5: stage ${label(old)} is done and would be removed. Done stages change only on the user's explicit request.`);
    else if (canonical(now) !== canonical(old)) ask.push(`rule 5: stage ${label(old)} is done and would be changed. Done stages change only on the user's explicit request.`);
  }
  for (const stage of next.stages) {
    if (stage.status === 'done' && !previous.has(stage.id)) {
      deny.push(`rule 6: the new stage ${label(stage)} cannot be created already done; create it as "todo" and let it run its phases.`);
    }
  }
}

/** Stages of the plan on disk, by id (empty when there is none or it is unreadable). */
function previousStages(previous) {
  const map = new Map();
  if (!isObject(previous) || !Array.isArray(previous.stages)) return map;
  for (const s of previous.stages) if (isObject(s) && typeof s.id === 'string') map.set(s.id, s);
  return map;
}

function validatePlan(next, previous, loops) {
  const deny = [];
  const ask = [];
  checkTop(next, deny);
  if (deny.length) return { deny, ask };
  const ids = new Set();
  for (const stage of next.stages) checkStage(stage, loops, ids, deny);
  if (deny.length) return { deny, ask };   // rules 3–6 need a well-formed plan

  const before = previousStages(previous);
  for (const stage of next.stages) {
    const loop = loops.types[stage.type];
    checkMoves(stage, before.get(stage.id), loop, deny);
    checkDone(stage, loop, deny);
  }
  checkHistory(next, before, ask, deny);
  return { deny, ask };
}

module.exports = { loadLoops, currentStage, validatePlan, STATUSES };
