/*
 * The panel's words, in Italian and English. The language follows Claude Code's `language`
 * setting: Italian when it starts with "it", English otherwise. tr() fills {placeholders}.
 * Every label of both views lives here, so the two views stay consistent.
 */
import type { Lang } from './types'

const IT = {
  piano: 'Piano', sessioni: 'Sessioni', stageOf: 'tappa {n} di {m}',
  noPlan: 'Nessun piano in questo progetto. Inizia con /blueprint.',
  planUnreadable: 'Il piano non si legge in questo momento: mostro l\'ultima versione buona.',
  yourTurn: 'tocca a te', kids: '{n} figlie', stopped: 'ferma',
  size_small: 'Piccolo', size_medium: 'Medio', size_project: 'Progetto',
  type_discussion: 'discussione', type_implementation: 'implementazione', type_delivery: 'consegna', type_quick_task: 'attività breve',
  ph_clarify: 'contesto', ph_plan: 'piano', ph_build: 'costruzione', ph_test: 'test', ph_review: 'revisione',
  ph_first_use: 'prova primo utente', ph_integrate: 'unione', ph_proposal: 'proposta', ph_convergence: 'convergenza',
  ph_decision: 'decisione', ph_do: 'fare', ph_check: 'controllo', ph_report: 'resoconto', ph_prepare: 'preparare',
  ph_rehearse: 'prova generale', ph_deliver: 'consegna', ph_feedback: 'parere',
  phaseNow: 'Fase: {phase}', phaseThen: '{phase} → poi {next}',
  topics: 'Argomenti', decisions: 'Decisioni della tappa', how: 'Come', notes: 'Note',
  addNote: 'Aggiungi una nota…', noteSaved: 'nota salvata',
  legend: 'Barre:', lg_done: 'fatto', lg_running: 'in corso', lg_stopped: 'ferma', lg_todo: 'da fare',
  session: 'sessione', context: 'contesto', timeCost: 'tempo · costo', mother: 'madre',
  thisSession: 'questa sessione', waitingKids: 'attende le figlie',
  enter: '↗ entra nella sessione', copied: 'comando copiato: {cmd}', others: 'altre sessioni',
  st_ended: 'terminata', st_done: 'finita', st_running: 'al lavoro', st_blocked: 'ferma: aspetta te',
  total: 'Totale tappa: {cost} · {n} sessioni', noParallel: 'Nessuna tappa in parallelo in corso.',
  notifySwitch: '🔔 Avvisami quando tocca a me', switchOn: 'attivo', switchOff: 'spento',
  statusLine: 'Blueprint · tappa {n}/{m}', statusYourTurn: 'Blueprint · tocca a te: tappa {n}',
  pushYourTurn: 'Blueprint: tocca a te nella tappa «{stage}»',
  opened: 'Pannello di Blueprint aperto.', closed: 'Pannello di Blueprint chiuso.',
  cmdDescription: 'Apre o chiude il pannello di Blueprint (piano | sessioni)',
}

type TextKey = keyof typeof IT

const EN: Record<TextKey, string> = {
  piano: 'Plan', sessioni: 'Sessions', stageOf: 'stage {n} of {m}',
  noPlan: 'No plan in this project. Start with /blueprint.',
  planUnreadable: 'The plan cannot be read right now: showing the last good version.',
  yourTurn: 'your turn', kids: '{n} children', stopped: 'stopped',
  size_small: 'Small', size_medium: 'Medium', size_project: 'Project',
  type_discussion: 'discussion', type_implementation: 'implementation', type_delivery: 'delivery', type_quick_task: 'quick task',
  ph_clarify: 'context', ph_plan: 'plan', ph_build: 'build', ph_test: 'test', ph_review: 'review',
  ph_first_use: 'first use', ph_integrate: 'merge', ph_proposal: 'proposal', ph_convergence: 'convergence',
  ph_decision: 'decision', ph_do: 'do', ph_check: 'check', ph_report: 'report', ph_prepare: 'prepare',
  ph_rehearse: 'rehearsal', ph_deliver: 'delivery', ph_feedback: 'feedback',
  phaseNow: 'Phase: {phase}', phaseThen: '{phase} → then {next}',
  topics: 'Topics', decisions: 'Decisions of this stage', how: 'How', notes: 'Notes',
  addNote: 'Add a note…', noteSaved: 'note saved',
  legend: 'Bars:', lg_done: 'done', lg_running: 'running', lg_stopped: 'stopped', lg_todo: 'to do',
  session: 'session', context: 'context', timeCost: 'time · cost', mother: 'mother',
  thisSession: 'this session', waitingKids: 'waiting for the children',
  enter: '↗ enter the session', copied: 'command copied: {cmd}', others: 'other sessions',
  st_ended: 'ended', st_done: 'finished', st_running: 'working', st_blocked: 'stopped: waiting for you',
  total: 'Stage total: {cost} · {n} sessions', noParallel: 'No parallel stage running.',
  notifySwitch: '🔔 Notify me when it is my turn', switchOn: 'on', switchOff: 'off',
  statusLine: 'Blueprint · stage {n}/{m}', statusYourTurn: 'Blueprint · your turn: stage {n}',
  pushYourTurn: 'Blueprint: your turn in stage «{stage}»',
  opened: 'Blueprint panel opened.', closed: 'Blueprint panel closed.',
  cmdDescription: 'Opens or closes the Blueprint panel (plan | sessions)',
}

export type { TextKey }

export function langFrom(setting: unknown): Lang {
  return typeof setting === 'string' && setting.trim().toLowerCase().startsWith('it') ? 'it' : 'en'
}

export function tr(lang: Lang, key: TextKey | string, vars: Record<string, string | number> = {}): string {
  const table = (lang === 'it' ? IT : EN) as Record<string, string>
  const raw = table[key] ?? key
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m))
}
