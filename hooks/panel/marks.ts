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
  teal: '#4FB8A8',
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

export function pillSvg(label: string, tone: 'amber' | 'accent' | 'muted'): string {
  const w = Math.round(label.length * 6.6 + 18)
  const [fg, bg] = tone === 'amber' ? [C.amber, C.amberSoft] : tone === 'accent' ? [C.accent, C.accentSoft] : [C.muted, C.surface]
  return doc(w, 20, `<rect x="0" y="1" width="${w}" height="18" rx="9" fill="${bg}"/><text x="${w / 2}" y="14" font-size="11" font-weight="600" fill="${fg}" text-anchor="middle" ${FONT}>${esc(label)}</text>`)
}

/** Phase rail of an open stage; the current phase is labelled under its mark. */
export function railSvg(phases: { state: PhaseState }[], label: string, width = 300): string {
  const n = Math.max(phases.length, 2); const x0 = 10; const step = (width - 20) / (n - 1)
  const live = phases.findIndex(p => p.state === 'running' || p.state === 'stopped')
  const at = Math.max(live, 0)
  const stopped = phases[at]?.state === 'stopped'
  // the label sits under the current phase, but never runs out of the picture: it is anchored
  // at its start or end near an edge; a stage with no current phase gets it centred, muted
  const half = (label.length * 6.8) / 2
  const cx = live < 0 ? width / 2 : x0 + step * at
  const [x, anchor] = cx - half < 2 ? [2, 'start'] : cx + half > width - 2 ? [width - 2, 'end'] : [cx, 'middle']
  const fill = live < 0 ? C.muted : stopped ? C.amber : C.accent
  return doc(width, 46,
    `<line x1="${x0}" y1="12" x2="${x0 + step * (n - 1)}" y2="12" stroke="${C.line}" stroke-width="1.5"/>` +
    phases.map((p, i) => markShape(x0 + step * i, 12, p.state, p.state === 'running' || p.state === 'stopped' ? 7 : 5)).join('') +
    `<text x="${x}" y="38" font-size="12" font-weight="600" fill="${fill}" text-anchor="${anchor}" ${FONT}>${esc(label)}</text>`)
}

/** Words into lines of at most `room` characters (a longer word gets a line of its own). */
export function wrapWords(text: string, room: number): string[] {
  const lines: string[] = []
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1]
    if (last !== undefined && last.length + 1 + word.length <= room) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines.length > 0 ? lines : ['']
}

/**
 * A column of steps: marks joined by a vertical line in the session's colour, each step's text on
 * its right, wrapped over as many lines as it needs.
 */
export function stepsSvg(steps: { state: PhaseState; text: string }[], line: string, width = 320): string {
  const x = 9; const lineH = 16; const pad = 8; const room = Math.floor((width - 30) / 6.4)
  let y = 0
  const rows = steps.map(s => {
    const lines = wrapWords(s.text, room)
    const row = { s, lines, cy: y + pad / 2 + lineH / 2 }
    y += lines.length * lineH + pad
    return row
  })
  const first = rows[0]?.cy ?? 0; const last = rows[rows.length - 1]?.cy ?? 0
  const join = rows.length > 1 ? `<line x1="${x}" y1="${first}" x2="${x}" y2="${last}" stroke="${line}" stroke-width="2"/>` : ''
  const marks = rows.map(({ s, lines, cy }) => {
    const fill = s.state === 'done' ? C.muted : s.state === 'todo' ? C.faint : C.ink
    const text = lines.map((l, k) => `<text x="26" y="${cy + 4 + k * lineH}" font-size="12" fill="${fill}" ${FONT}>${esc(l)}</text>`).join('')
    return `<circle cx="${x}" cy="${cy}" r="7" fill="${C.hole}"/>` + markShape(x, cy, s.state, s.state === 'running' || s.state === 'stopped' ? 7 : 6) + text
  }).join('')
  return doc(width, Math.max(y, 1), join + marks)
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
