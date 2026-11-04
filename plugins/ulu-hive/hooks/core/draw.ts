// The hive's colors and bars.

// The role's color, as in ULU's honeycomb.
export const ROLE_COLOR: Record<string, string> = {
  capitan: '#ffd34d', pm: '#f08a24', lead: '#4aa8ff', dev: '#aeb4c2', frontend: '#a877ff',
  designer: '#ff5c7c', security: '#35d685', devops: '#6c7bff', qe: '#2bc4ad',
}

// Black or white words, whichever has more contrast on the color (WCAG).
export function ink(hex: string): string {
  const L = luminance(hex)
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#111111' : '#ffffff'
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255)
}

// The color at 45%: the chip of a bee that has finished.
export function darken(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const d = (c: number) => Math.round(c * 0.45).toString(16).padStart(2, '0')
  return `#${d((n >> 16) & 255)}${d((n >> 8) & 255)}${d(n & 255)}`
}

// A bar of `width` cells, `part` of it full (0..1); with part < 0 a block
// slides along it, for work whose length is not known.
export function bar(width: number, part: number, tick: number): { full: string; empty: string; lead: string } {
  const w = Math.max(4, width)
  if (part < 0) {
    const size = Math.max(2, Math.round(w / 5))
    const at = tick % (w + size) - size
    const left = Math.max(0, at)
    const mid = Math.max(0, Math.min(w, at + size) - left)
    return { lead: '─'.repeat(left), full: '━'.repeat(mid), empty: '─'.repeat(Math.max(0, w - left - mid)) }
  }
  const n = Math.round(w * Math.min(1, part))
  return { lead: '', full: '━'.repeat(n), empty: '─'.repeat(w - n) }
}
