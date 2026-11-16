/*
 * The panel's visual vocabulary, from the approved mockup D: colours, the status glyphs used in
 * text rows (state is never colour alone), and small SVG documents — status mark, segmented
 * phase bar, pill, phase rail, progress bar, context bar. Each function returns a whole <svg>.
 */
import type { PhaseState } from './types'

export const C = {
  ink: '#ECEBE8', muted: '#A9A7A0', faint: '#5E5C57', line: '#3A3936', surface: '#2E2D2A',
  accent: '#6AA5FA', accentSoft: '#22324A', amber: '#E5AC52', amberSoft: '#3D2F18', hole: '#1B1B1A',
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
  const at = Math.max(phases.findIndex(p => p.state === 'running' || p.state === 'stopped'), 0)
  const stopped = phases[at]?.state === 'stopped'
  const lx = Math.min(Math.max(x0 + step * at, 50), width - 50)
  return doc(width, 46,
    `<line x1="${x0}" y1="12" x2="${x0 + step * (n - 1)}" y2="12" stroke="${C.line}" stroke-width="1.5"/>` +
    phases.map((p, i) => markShape(x0 + step * i, 12, p.state, p.state === 'running' || p.state === 'stopped' ? 7 : 5)).join('') +
    `<text x="${lx}" y="38" font-size="12" font-weight="600" fill="${stopped ? C.amber : C.accent}" text-anchor="middle" ${FONT}>${esc(label)}</text>`)
}

/** Header progress: done stages muted, the current one blue (amber when stopped). */
export function progressSvg(done: number, total: number, stopped: boolean, width = 320): string {
  const t = Math.max(total, 1); const unit = width / t
  return doc(width, 6, `<rect x="0" y="1" width="${width}" height="4" rx="2" fill="${C.line}"/>` +
    `<rect x="0" y="1" width="${unit * done}" height="4" rx="2" fill="${C.muted}"/>` +
    (done < t ? `<rect x="${unit * done}" y="1" width="${unit / 2}" height="4" rx="2" fill="${stopped ? C.amber : C.accent}"/>` : ''))
}

export function contextBarSvg(percent: number, width = 60): string {
  const p = Math.min(Math.max(percent, 0), 100)
  return doc(width, 6, `<rect x="0" y="1" width="${width}" height="4" rx="2" fill="${C.line}"/><rect x="0" y="1" width="${width * p / 100}" height="4" rx="2" fill="${p > 70 ? C.amber : C.muted}"/>`)
}

/** Text fallback of a bar for surfaces without Svg: ■ done, ▶ running, ! stopped, □ todo. */
export function barText(segments: PhaseState[]): string {
  return segments.map(s => (s === 'done' ? '■' : s === 'running' ? '▶' : s === 'stopped' ? '!' : s === 'skipped' ? '–' : '□')).join('')
}
