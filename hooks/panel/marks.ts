/*
 * The panel's visual vocabulary, from the approved mockup D: colours, the status glyphs used in
 * text rows (state is never colour alone), and small SVG documents — status mark, segmented
 * phase bar, pill, phase rail, progress bar, context bar. Each function returns a whole <svg>.
 */
import type { PhaseState } from './types'

export const C = {
  ink: '#ECEBE8', muted: '#A9A7A0', faint: '#5E5C57', line: '#3A3936', surface: '#2E2D2A',
  accent: '#6AA5FA', accentSoft: '#22324A', amber: '#E5AC52', amberSoft: '#3D2F18', hole: '#1B1B1A',
  /** the line of a child session's steps (the mother's is `muted`): never a state colour */
  teal: '#4FB8A8', tealSoft: '#1D3532',
  /** a decision hard to change: always with the padlock, never a state */
  violet: '#B39DFA', violetSoft: '#2A2540',
  /** who decided: the user, and Claude */
  you: '#9FE0CF', youSoft: '#243832', clay: '#D9896A', claySoft: '#3A2A23',
  /** a failed test or a high-severity problem: always next to words, never colour alone */
  coral: '#EE8A6E',
  /** tests all passed: always next to the fraction in words, so never colour alone */
  green: '#5DBB7A',
}
const FONT = 'font-family="system-ui, -apple-system, Segoe UI, sans-serif"'

export const GLYPH: Record<PhaseState, string> = { done: '✓', running: '●', stopped: '!', todo: '○', skipped: '–' }

const doc = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The mark's shapes centred on (cx, cy): ring+tick, filled ring, amber "!", hollow ring. */
export function markShape(cx: number, cy: number, state: PhaseState, r = 7): string {
  if (state === 'done' || state === 'skipped')
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.muted}" stroke-width="1.5"/>` +
      (state === 'done' ? `<path d="M${cx - 3.2} ${cy} l2.2 2.4 l4.2 -4.6" fill="none" stroke="${C.muted}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M${cx - 3} ${cy} h6" stroke="${C.muted}" stroke-width="1.6"/>`)
  if (state === 'running') return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.accent}"/><circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="${C.hole}"/>`
  if (state === 'stopped') return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.amber}"/><text x="${cx}" y="${cy + 4}" font-size="11" font-weight="700" fill="${C.hole}" text-anchor="middle" ${FONT}>!</text>`
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.faint}" stroke-width="1.5"/>`
}

export const markSvg = (state: PhaseState, r = 7) => doc(r * 2 + 4, r * 2 + 4, markShape(r + 2, r + 2, state, r))

const SEG_FILL: Record<PhaseState, string> = { done: C.muted, skipped: C.line, running: C.accent, stopped: C.amber, todo: C.line }

/** Segmented bar, one segment per phase or topic; a done stage gets the ticked circle after it. */
export function barSvg(segments: PhaseState[], width = 120, tick = false): string {
  const n = Math.max(segments.length, 1); const gap = 3; const seg = (width - gap * (n - 1)) / n
  const rects = segments.map((s, i) => `<rect x="${i * (seg + gap)}" y="5" width="${seg}" height="6" rx="2" fill="${SEG_FILL[s]}"/>`).join('')
  return doc(width + (tick ? 26 : 0), 16, rects + (tick ? markShape(width + 14, 8, 'done', 7) : ''))
}

export function pillSvg(label: string, tone: 'amber' | 'accent' | 'teal' | 'muted'): string {
  const w = Math.round(label.length * 6.6 + 18)
  const [fg, bg] = tone === 'amber' ? [C.amber, C.amberSoft] : tone === 'accent' ? [C.accent, C.accentSoft] : tone === 'teal' ? [C.teal, C.tealSoft] : [C.muted, C.surface]
  return doc(w, 20, `<rect x="0" y="1" width="${w}" height="18" rx="9" fill="${bg}"/><text x="${w / 2}" y="14" font-size="11" font-weight="600" fill="${fg}" text-anchor="middle" ${FONT}>${esc(label)}</text>`)
}

/**
 * Phase rail of an open stage: one mark per phase on a line. The phase the user looks at with the
 * arrows gets a dashed ring; its name is in the ◀ ▶ line under the rail, not drawn here twice.
 * The line between two done phases is muted, so the way already walked shows.
 */
export function railSvg(phases: { state: PhaseState }[], width = 300, chosen?: number): string {
  const n = Math.max(phases.length, 2); const x0 = 11; const step = (width - 22) / (n - 1)
  const walked = phases.filter(p => p.state === 'done' || p.state === 'skipped').length
  const ring = chosen === undefined ? ''
    : `<circle cx="${x0 + step * chosen}" cy="12" r="10.5" fill="none" stroke="${C.ink}" stroke-width="1.2" stroke-dasharray="2 2"/>`
  return doc(width, 24,
    `<line x1="${x0}" y1="12" x2="${x0 + step * (n - 1)}" y2="12" stroke="${C.line}" stroke-width="1.5"/>` +
    (walked > 0 ? `<line x1="${x0}" y1="12" x2="${x0 + step * Math.min(walked, n - 1)}" y2="12" stroke="${C.muted}" stroke-width="1.5"/>` : '') +
    phases.map((p, i) => markShape(x0 + step * i, 12, p.state, p.state === 'running' || p.state === 'stopped' ? 7 : 5)).join('') + ring)
}

/**
 * The rest of a step's line, under its mark: a Box placed from the second text row to the row's
 * bottom stretches it, so the line goes on however many lines the text takes.
 */
export function stepLineSvg(line: string): string {
  // a plain stroke that may be stretched to any height (preserveAspectRatio none)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="20" viewBox="0 0 18 20" preserveAspectRatio="none">` +
    `<line x1="9" y1="0" x2="9" y2="20" stroke="${line}" stroke-width="2"/></svg>`
}

/**
 * The step's mark (18×20) with the line's pieces above and below it, stopping at its edge: the
 * first row has no piece above, the last none below. Below this picture the line goes on in
 * stepLineSvg, which never reaches the mark.
 */
export function stepMarkSvg(state: PhaseState, line: string, first: boolean, last: boolean): string {
  const x = 9; const cy = 10; const r = 8
  const seg = (y1: number, y2: number) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${line}" stroke-width="2"/>`
  return doc(18, 20, (first ? '' : seg(0, cy - r)) + (last ? '' : seg(cy + r, 20)) +
    markShape(x, cy, state, state === 'running' || state === 'stopped' ? 7 : 6))
}

/** A mark of the work tree (18×20), with no line: the tree's guides are drawn by the levels. */
export function treeMarkSvg(state: PhaseState): string {
  return doc(18, 20, markShape(9, 10, state, state === 'running' || state === 'stopped' ? 7 : 6))
}

/**
 * A finding's severity as three bars of growing height: three filled for high, two for medium, one
 * for low. Neutral colours only (ink for high, grey otherwise): amber stays for «your turn».
 */
export function severitySvg(sev: 'high' | 'medium' | 'low'): string {
  const filled = sev === 'high' ? 3 : sev === 'medium' ? 2 : 1
  const fill = sev === 'high' ? C.ink : C.muted
  const bars = [4, 7, 10].map((h, i) => `<rect x="${1 + i * 5}" y="${12 - h}" width="3" height="${h}" rx="1" fill="${i < filled ? fill : C.line}"/>`).join('')
  return doc(16, 12, bars)
}

/** The countdown's ring: an amber arc for the part of the 30 seconds still left. */
export function ringSvg(fraction: number): string {
  const r = 7; const c = 2 * Math.PI * r
  const left = Math.min(Math.max(fraction, 0), 1) * c
  return doc(18, 18, `<circle cx="9" cy="9" r="${r}" fill="none" stroke="${C.line}" stroke-width="2"/>` +
    `<circle cx="9" cy="9" r="${r}" fill="none" stroke="${C.amber}" stroke-width="2" stroke-dasharray="${left.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 9 9)"/>`)
}

/** A topic's own small rail: one dot per phase of the discussion, done, current or to do. */
export function topicRailSvg(states: PhaseState[]): string {
  // small dots read as shapes, not marks: no tick inside (it looked like «Ø»)
  const step = 14
  const dot = (s: PhaseState, i: number) => {
    const cx = 7 + i * step
    if (s === 'done' || s === 'skipped') return `<circle cx="${cx}" cy="7" r="4.5" fill="${C.muted}"/>`
    if (s === 'running') return `<circle cx="${cx}" cy="7" r="4.5" fill="${C.hole}" stroke="${C.accent}" stroke-width="2.2"/>`
    if (s === 'stopped') return `<circle cx="${cx}" cy="7" r="5.5" fill="${C.amber}"/><text x="${cx}" y="10.5" font-size="9" font-weight="800" fill="${C.hole}" text-anchor="middle" ${FONT}>!</text>`
    return `<circle cx="${cx}" cy="7" r="4" fill="${C.hole}" stroke="${C.faint}" stroke-width="1.5"/>`
  }
  const line = `<line x1="7" y1="7" x2="${7 + (states.length - 1) * step}" y2="7" stroke="${C.line}" stroke-width="1"/>`
  return doc(Math.max(states.length, 1) * step, 14, line + states.map(dot).join(''))
}

/** A one-way decision: a padlock in neutral ink (a shape, not a state colour). */
export const lockSvg = (color: string = C.muted) => doc(12, 13, `<rect x="1.5" y="5.5" width="9" height="7" rx="1.5" fill="${color}"/><path d="M3.8 5.5 V4 a2.2 2.2 0 0 1 4.4 0 V5.5" fill="none" stroke="${color}" stroke-width="1.5"/>`)

/** A two-way decision: two opposite arrows. */
export const swapSvg = () => doc(12, 12, `<path d="M2 4 H9 M7 2 L9.5 4 L7 6 M10 8.5 H3 M5 6.5 L2.5 8.5 L5 10.5" fill="none" stroke="${C.muted}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`)

/**
 * One bead per Task of a letter (work tree): filled grey when done, a ring in the state's colour
 * while in progress or stopped, hollow when to do — the shapes differ, not only the colours.
 */
export function beadsSvg(states: PhaseState[]): string {
  const step = 12
  const bead = (s: PhaseState, i: number) => {
    const cx = 6 + i * step
    if (s === 'done') return `<circle cx="${cx}" cy="6" r="4" fill="${C.muted}"/>`
    if (s === 'running' || s === 'stopped') return `<circle cx="${cx}" cy="6" r="3.5" fill="none" stroke="${s === 'running' ? C.accent : C.amber}" stroke-width="2"/>`
    return `<circle cx="${cx}" cy="6" r="3.5" fill="none" stroke="${C.faint}" stroke-width="1.5"/>`
  }
  return doc(Math.max(states.length, 1) * step, 12, states.map(bead).join(''))
}

/** A group's tests: the bar green when all passed, coral when some failed. */
export function fractionSvg(passed: number, total: number, width = 90): string {
  const f = total > 0 ? Math.min(passed / total, 1) : 0
  return doc(width, 8, `<rect x="0" y="1" width="${width}" height="6" rx="2" fill="${C.line}"/>` +
    (f > 0 ? `<rect x="0" y="1" width="${width * f}" height="6" rx="2" fill="${passed === total ? C.green : C.coral}"/>` : ''))
}

/** Header progress: done stages muted, the current one blue (amber when stopped). */
export function progressSvg(done: number, total: number, stopped: boolean, width = 320): string {
  const t = Math.max(total, 1); const unit = width / t
  return doc(width, 6, `<rect x="0" y="1" width="${width}" height="4" rx="2" fill="${C.line}"/>` +
    `<rect x="0" y="1" width="${unit * done}" height="4" rx="2" fill="${C.muted}"/>` +
    (done < t ? `<rect x="${unit * done}" y="1" width="${unit / 2}" height="4" rx="2" fill="${stopped ? C.amber : C.accent}"/>` : ''))
}

export function contextBarSvg(percent: number, width = 60): string {
  const p = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0
  return doc(width, 6, `<rect x="0" y="1" width="${width}" height="4" rx="2" fill="${C.line}"/><rect x="0" y="1" width="${width * p / 100}" height="4" rx="2" fill="${p > 70 ? C.amber : C.muted}"/>`)
}

/** Text fallback of a bar for surfaces without Svg: ■ done, ▶ running, ! stopped, □ todo. */
export function barText(segments: PhaseState[]): string {
  return segments.map(s => (s === 'done' ? '■' : s === 'running' ? '▶' : s === 'stopped' ? '!' : s === 'skipped' ? '–' : '□')).join('')
}
